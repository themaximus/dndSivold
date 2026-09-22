import crypto from 'crypto';
import {
  IRoomRepository,
  roomRepository,
  ICharacterRepository,
  characterRepository,
  ITurnActionRepository,
  turnActionRepository,
  IGameLogRepository,
  gameLogRepository,
  IQuestRepository,
  questRepository,
  ISearchedObjectRepository,
  searchedObjectRepository,
  IWorldNPCRepository,
  worldNPCRepository,
} from '../../repositories';
import {
  RoomEntity,
  RoomPlayerEntity,
  GameLogEntity,
  CharacterEntity,
  TurnActionEntity,
  CharacterReactionRequest,
  LoreMilestone,
} from '../../db';
import {
  AIDMContext,
  AIDMResponse,
  InventoryNotification,
} from '../../domain/types';
import { sanitizeRoom } from '../security/CryptoService';
import { mechanicalArbiter, MechanicalResolution } from '../game/MechanicalArbiter';
import { socialArbiter, ContestedReactionResult } from '../game/SocialArbiter';
import { questArbiter } from '../game/QuestArbiter';
import { sessionAuditLogger } from '../logging/SessionAuditLogger';
import { roomTransactionMutex } from './RoomTransactionMutex';
import { sceneEntityManager } from './SceneEntityManager';
import { actionIntentEngine } from './ActionIntentEngine';
import { inventoryLedgerService } from './InventoryLedgerService';
import { narrativeSynthesizer } from './NarrativeSynthesizer';
import { roomSessionManager } from './RoomSessionManager';
import { episodicMemoryCompressor } from '../ai/EpisodicMemoryCompressor';
import { systemLocator } from './ServiceLocator';

export interface RoundResolutionResult {
  log?: GameLogEntity;
  room: RoomEntity;
  players: any[];
  nextRoundNumber: number;
  inventoryNotifications?: InventoryNotification[];
  rejectedAction?: {
    characterName: string;
    reason: string;
  };
}

export interface TurnStepResolutionResult {
  log?: GameLogEntity;
  room: RoomEntity;
  players: any[];
  isRoundComplete: boolean;
  nextActiveUserId?: string;
  nextRoundNumber?: number;
  inventoryNotifications?: InventoryNotification[];
  rejectedAction?: {
    characterName: string;
    reason: string;
  };
}

export class TurnExecutionPipeline {
  private rooms: IRoomRepository;
  private characters: ICharacterRepository;
  private turnActions: ITurnActionRepository;
  private gameLogs: IGameLogRepository;
  private quests: IQuestRepository;
  private searchedObjects: ISearchedObjectRepository;
  private worldNPCs: IWorldNPCRepository;

  constructor(
    rooms: IRoomRepository = roomRepository,
    characters: ICharacterRepository = characterRepository,
    turnActions: ITurnActionRepository = turnActionRepository,
    gameLogs: IGameLogRepository = gameLogRepository,
    quests: IQuestRepository = questRepository,
    searchedObjects: ISearchedObjectRepository = searchedObjectRepository,
    worldNPCs: IWorldNPCRepository = worldNPCRepository
  ) {
    this.rooms = rooms;
    this.characters = characters;
    this.turnActions = turnActions;
    this.gameLogs = gameLogs;
    this.quests = quests;
    this.searchedObjects = searchedObjects;
    this.worldNPCs = worldNPCs;
  }

  /**
   * Resolves a single turn step in turn-by-turn mode.
   */
  public async resolveTurnStep(
    roomId: string,
    actingUserId: string,
    completedReactions?: CharacterReactionRequest[]
  ): Promise<TurnStepResolutionResult | null> {
    return roomTransactionMutex.runExclusive(roomId, async () => {
      const room = this.rooms.findById(roomId);
      if (!room || room.status !== 'active') return null;

      const currentRoundActions = this.turnActions.findByRoomAndRound(room.id, room.roundNumber);
      const actingAction =
        currentRoundActions.find((a) => a.playerId === actingUserId) ||
        currentRoundActions[currentRoundActions.length - 1];

      if (!actingAction) return null;

      return this.executeTurnCycle({
        room,
        isTurnByTurn: true,
        actingUserId,
        actionsToResolve: [actingAction],
        completedReactions,
      }) as Promise<TurnStepResolutionResult>;
    });
  }

  /**
   * Resolves a full round in simultaneous mode.
   */
  public async resolveRound(
    roomId: string,
    completedReactions?: CharacterReactionRequest[]
  ): Promise<RoundResolutionResult | null> {
    return roomTransactionMutex.runExclusive(roomId, async () => {
      const room = this.rooms.findById(roomId);
      if (!room || room.status !== 'active') return null;

      const currentRoundActions = this.turnActions.findByRoomAndRound(room.id, room.roundNumber);
      if (!currentRoundActions || currentRoundActions.length === 0) return null;

      return this.executeTurnCycle({
        room,
        isTurnByTurn: false,
        actionsToResolve: currentRoundActions,
        completedReactions,
      }) as Promise<RoundResolutionResult>;
    });
  }

  /**
   * Unified turn processing engine.
   * Eliminates 1900 lines of duplicated code between resolveTurnStep and resolveRound.
   */
  private async executeTurnCycle(params: {
    room: RoomEntity;
    isTurnByTurn: boolean;
    actingUserId?: string;
    actionsToResolve: TurnActionEntity[];
    completedReactions?: CharacterReactionRequest[];
  }): Promise<TurnStepResolutionResult | RoundResolutionResult> {
    const { room, isTurnByTurn, actingUserId, actionsToResolve, completedReactions } = params;

    // 1. Ensure entities exist and have UUIDs, and ensure spatial zones
    const spatialEngine = systemLocator.get('spatialLocationEngine');
    spatialEngine.ensureCurrentZone(room);
    sceneEntityManager.ensureSceneEntities(room);

    const allPlayers = this.rooms.findPlayersByRoomId(room.id);
    const activeCharacters: CharacterEntity[] = allPlayers
      .map((p) => (p.characterId ? this.characters.findById(p.characterId) : undefined))
      .filter((c): c is CharacterEntity => !!c);

    const fullLogs = this.gameLogs.findByRoomId(room.id);
    const roomSearched = this.searchedObjects.findByRoomId(room.id);

    // 2. Structured Action Intent & Mechanical Resolution
    const mechanicalDirectives: Record<string, string> = {};
    const mechanicalResolutions: MechanicalResolution[] = [];

    for (const action of actionsToResolve) {
      const char = activeCharacters.find((c) => c.id === action.characterId);
      
      // Parse intent & resolve entity UUID
      const intentDTO = actionIntentEngine.parseActionIntent(action, char, room);

      // Evaluate mechanics
      const res = mechanicalArbiter.evaluateAction(
        action,
        char,
        room.activeEnemies || [],
        room.sceneNPCs || [],
        room.targetDC || 12,
        roomSearched,
        room.environmentObjects || [],
        room
      );

      // Advance environment object stage on successful staged progress
      if (res.actionType === 'staged_affordance') {
        const affordanceService = (this as any).affordanceService || require('./SceneAffordanceService').sceneAffordanceService;
        const matchingObj = affordanceService.findMatchingObject(action.actionText, room);
        const d20 = action.diceRolls && action.diceRolls.length > 0 ? action.diceRolls[0] : null;
        const isSuccess = (d20 ? d20.total : 10) >= (room.targetDC || 12) || (d20?.isCriticalSuccess ?? false);
        if (matchingObj && isSuccess) {
          affordanceService.advanceObjectStage(room, matchingObj.key, 1);
        }
      }

      mechanicalResolutions.push(res);
      mechanicalDirectives[action.id] = res.promptDirective;

      // If intent resolved an exact entity target, update the directive
      if (intentDTO.targetEntityId && intentDTO.targetEntityName) {
        mechanicalDirectives[action.id] += ` [Цель идентифицирована: ${intentDTO.targetEntityName} (ID: ${intentDTO.targetEntityId})]`;
      }
    }

    // 3. Contested Reactions
    const completedReactionsList =
      completedReactions || (room.pendingReactions || []).filter((r) => r.status === 'completed');
    const contestedReactionResults: ContestedReactionResult[] = [];

    for (const react of completedReactionsList) {
      const matchingAction = actionsToResolve.find((a) => a.playerId === react.initiatorUserId);
      if (matchingAction) {
        const initChar = activeCharacters.find((c) => c.id === matchingAction.characterId);
        const targetChar = activeCharacters.find((c) => c.id === react.targetCharacterId);
        const evalResult = socialArbiter.evaluateContestedReaction(react, matchingAction, initChar, targetChar);
        contestedReactionResults.push(evalResult);
        mechanicalDirectives[matchingAction.id] =
          (mechanicalDirectives[matchingAction.id] || '') + '\n' + evalResult.promptDirective;
      }
    }

    const allRoomQuests = this.quests.findByRoomId(room.id);

    // 4. Build AI Context with Episodic Long-Term Memory Compression
    const memory = episodicMemoryCompressor.compressLogs(fullLogs, room);
    const campaignPlotWithMemory = episodicMemoryCompressor.augmentContextWithMemory(
      room.campaignPlot,
      memory.consolidatedMemoryText
    );

    const aiContext: AIDMContext = {
      apiKey: room.deepseekApiKey,
      model: room.deepseekModel,
      setting: room.setting,
      genre: room.genre || 'fantasy',
      campaignDuration: room.campaignDuration || 'medium',
      roundNumber: room.roundNumber,
      currentSituation: room.currentSituation,
      currentDC: room.targetDC,
      currentDCReason: room.dcReason,
      requiredCheckStat: room.requiredCheckStat,
      campaignPlot: campaignPlotWithMemory,
      loreJournal: room.loreJournal,
      availableLoot: room.availableLoot,
      characters: activeCharacters,
      activeEnemies: room.activeEnemies,
      sceneNPCs: room.sceneNPCs,
      actions: actionsToResolve,
      previousHistory: memory.recentLogs.map((l) => l.narrativeText),
      turnMode: room.turnMode || 'turn_by_turn',
      turnPlayerName: isTurnByTurn
        ? actionsToResolve[0]?.characterName || 'Игрок'
        : undefined,
      characterReactions: completedReactionsList,
      mechanicalDirectives,
      activeQuests: allRoomQuests.filter((q) => q.status === 'active'),
      completedQuests: allRoomQuests.filter((q) => q.status === 'completed'),
      searchedObjects: roomSearched,
      worldNPCRegistry: this.worldNPCs.findByRoomId(room.id),
      environmentObjects: room.environmentObjects,
      currentZoneName: room.spatialZones?.find((z) => z.isCurrent || z.zoneKey === room.currentZoneKey)?.name || 'Текущая локация',
      currentZoneKey: room.currentZoneKey,
      spatialZones: room.spatialZones ? [...room.spatialZones] : [],
      vehicleManifest: room.vehicleManifest,
    };

    // 5. Invoke AI Narrative Synthesizer
    const synthResult = await narrativeSynthesizer.synthesizeTurnResponse(room, aiContext);
    const dmResult = synthResult.response;

    // 6. Check for rejected action (absurd request)
    if (dmResult.rejectedAction && dmResult.rejectedAction.characterName) {
      const updated = roomSessionManager.getRoomAndPlayers(room.code);
      return {
        room: updated?.room || sanitizeRoom(room),
        players: updated?.players || this.rooms.findPlayersByRoomId(room.id),
        isRoundComplete: false,
        nextRoundNumber: room.roundNumber,
        rejectedAction: dmResult.rejectedAction,
      } as any;
    }

    // 7. Authoritative State Mutation: Player HP Updates
    const playerHpDeltas: Record<string, number> = {};
    if (dmResult.playerUpdates && Array.isArray(dmResult.playerUpdates)) {
      for (const update of dmResult.playerUpdates) {
        if (!update.characterId) continue;
        const char = this.characters.findById(update.characterId);
        if (char) {
          const delta = update.hpDelta || 0;
          playerHpDeltas[char.id] = delta;
          if (delta !== 0) {
            this.characters.updateHp(char.id, delta);
          }
        }
      }
    }

    // Also apply healing/damage from Mechanical Resolutions directly
    for (const res of mechanicalResolutions) {
      if (res.targetUpdate) {
        const tu = res.targetUpdate;
        if (tu.targetType === 'enemy' || tu.targetType === 'npc') {
          sceneEntityManager.updateEntity(room, tu.targetId, {
            hpDelta: -tu.damage,
            status: tu.newStatus,
          });
        }
      }
      if (res.healRolled && res.characterId) {
        this.characters.updateHp(res.characterId, res.healRolled);
        playerHpDeltas[res.characterId] = (playerHpDeltas[res.characterId] || 0) + res.healRolled;
      }
    }

    // 8. Inventory & Searched Objects
    const inventoryNotifications: InventoryNotification[] = [];
    const itemActivities: Record<string, string[]> = {};

    inventoryLedgerService.applyInventoryUpdates(
      room,
      dmResult.inventoryUpdates,
      room.roundNumber,
      inventoryNotifications,
      itemActivities
    );

    inventoryLedgerService.handleSearchedObjects(
      room,
      room.roundNumber,
      dmResult.searchedObjectUpdates,
      actionsToResolve[0]?.characterName,
      actionsToResolve[0]?.characterId,
      inventoryNotifications,
      itemActivities
    );

    // Procedural item recovery for acting characters
    for (const action of actionsToResolve) {
      const char = activeCharacters.find((c) => c.id === action.characterId);
      if (char) {
        inventoryLedgerService.handleProceduralItemRecovery(
          room,
          action,
          char,
          dmResult,
          false,
          itemActivities,
          inventoryNotifications
        );
      }
    }

    // 9. Quests
    const questSync = questArbiter.processRoundQuests(room, actionsToResolve, dmResult);
    room.worldQuests = questSync.allQuests;

    // 10. Milestones & Dropped Loot
    if (dmResult.newMilestones && dmResult.newMilestones.length > 0) {
      const newMs: LoreMilestone[] = dmResult.newMilestones.map((m) => ({
        id: crypto.randomUUID(),
        round: room.roundNumber,
        milestone: m,
        timestamp: new Date().toISOString(),
      }));
      this.rooms.addMilestones(room.id, newMs);
    }

    if (dmResult.droppedLoot && dmResult.droppedLoot.length > 0) {
      const lootItems = dmResult.droppedLoot.map((l) => ({
        id: crypto.randomUUID(),
        name: l.name,
        type: l.type,
        description: l.description,
        damage: l.damage,
        ac_bonus: l.ac_bonus,
        healAmount: l.healAmount,
        quantity: 1,
        roundDropped: room.roundNumber,
      }));
      this.rooms.addLoot(room.id, lootItems);
    }

    // 11. Synchronize Scene Entities & Projection (with hostile transitions and dynamic status)
    sceneEntityManager.processRoundEntities(room, dmResult, actionsToResolve, mechanicalResolutions);

    // 11b. Actions Summary & Spatial Transition Evacuation
    const actionsSummary = this.formatActionsSummary(
      actionsToResolve,
      room.targetDC || 12,
      itemActivities,
      completedReactionsList
    );

    const transitionCheck = spatialEngine.detectLocationTransition(
      actionsSummary,
      dmResult.narrative || '',
      room
    );

    if (transitionCheck.isTransition && transitionCheck.toZoneKey) {
      const travelerNames: string[] = activeCharacters.map((c) => c.name);
      if (room.vehicleManifest?.passengerNames) {
        travelerNames.push(...room.vehicleManifest.passengerNames);
      }
      if (room.vehicleManifest?.driverName) {
        travelerNames.push(room.vehicleManifest.driverName);
      }
      if (/бальтазар/i.test(dmResult.narrative || '') || /бальтазар/i.test(actionsSummary)) {
        travelerNames.push('Бальтазар', 'купец Бальтазар');
      }

      spatialEngine.evacuateNonTravelers(
        room,
        room.currentZoneKey || 'crossroads_seven_roads',
        transitionCheck.toZoneKey,
        travelerNames,
        dmResult.narrative || ''
      );
      // Re-synchronize legacy arrays after evacuation of non-travelers
      sceneEntityManager.syncLegacyArrays(room);
    }

    const sceneProjection = sceneEntityManager.buildSceneProjection(room);

    // 12. Determine turn/round progression
    let isRoundComplete = false;
    let nextActiveUserId: string | undefined;
    let nextRoundNumber = room.roundNumber;

    if (isTurnByTurn) {
      const playersWithChar = allPlayers.filter((p) => p.characterId);
      const onlineActive = playersWithChar.filter((p) => p.isOnline);
      const targetPlayers = onlineActive.length > 0 ? onlineActive : playersWithChar;

      const order =
        room.turnOrder && room.turnOrder.length > 0
          ? room.turnOrder.filter((uid) => targetPlayers.some((p) => p.userId === uid))
          : targetPlayers.map((p) => p.userId);

      const currentIndex = actingUserId ? order.indexOf(actingUserId) : 0;
      const nextIndex = currentIndex + 1;

      if (nextIndex < order.length) {
        nextActiveUserId = order[nextIndex];
        isRoundComplete = false;
      } else {
        isRoundComplete = true;
        nextRoundNumber = room.roundNumber + 1;
        nextActiveUserId = order[0];
      }
    } else {
      isRoundComplete = true;
      nextRoundNumber = room.roundNumber + 1;
    }

    // 13. Create Game Log
    const createdLoot =
      dmResult.droppedLoot && dmResult.droppedLoot.length > 0
        ? dmResult.droppedLoot.map((l) => ({
            id: crypto.randomUUID(),
            name: l.name,
            type: l.type,
            description: l.description,
            damage: l.damage,
            ac_bonus: l.ac_bonus,
            healAmount: l.healAmount,
            quantity: 1,
            roundDropped: room.roundNumber,
          }))
        : undefined;

    const createdLog = this.gameLogs.create({
      id: crypto.randomUUID(),
      roomId: room.id,
      roundNumber: room.roundNumber,
      turnPlayerName: isTurnByTurn
        ? actionsToResolve[0]?.characterName || 'Игрок'
        : undefined,
      actionsSummary,
      narrativeText: dmResult.narrative,
      audioUrl: synthResult.audioUrl,
      currentSituation: dmResult.currentSituation,
      choiceDilemma: dmResult.choiceDilemma,
      mood: dmResult.mood,
      targetDC: dmResult.nextRoundDC || room.targetDC,
      dcReason: dmResult.nextRoundDCReason || room.dcReason,
      requiredCheckStat: dmResult.requiredCheckStat || room.requiredCheckStat,
      playerUpdates: (dmResult.playerUpdates || []).map((u) => ({
        characterId: u.characterId,
        characterName: u.characterName || 'Персонаж',
        hpDelta: u.hpDelta || 0,
        hpCurrent: u.hpCurrent ?? 0,
        note: u.note || '',
      })),
      ruleViolations: dmResult.ruleViolations || [],
      droppedLoot: createdLoot,
      createdAt: new Date().toISOString(),
    });

    // 14. Update Room Entity in DB
    const updatedRoom = this.rooms.update(room.id, {
      roundNumber: nextRoundNumber,
      currentSituation: dmResult.currentSituation || room.currentSituation,
      targetDC: dmResult.nextRoundDC || room.targetDC,
      dcReason: dmResult.nextRoundDCReason || room.dcReason,
      requiredCheckStat: dmResult.requiredCheckStat || room.requiredCheckStat,
      activePlayerUserId: nextActiveUserId,
      pendingReactions: [],
      sceneEntities: room.sceneEntities,
      sceneProjection,
      activeEnemies: room.activeEnemies,
      sceneNPCs: room.sceneNPCs,
      searchedObjectsRegistry: room.searchedObjectsRegistry,
      worldNPCRegistry: room.worldNPCRegistry,
      worldQuests: room.worldQuests,
      environmentObjects: room.environmentObjects,
      currentZoneKey: room.currentZoneKey,
      spatialZones: room.spatialZones,
      vehicleManifest: room.vehicleManifest,
    });

    if (isRoundComplete) {
      this.rooms.resetPlayersTurn(room.id);
    }

    // 15. Audit Log
    sessionAuditLogger.logTurn({
      id: crypto.randomUUID(),
      roomId: room.id,
      roundNumber: room.roundNumber,
      timestamp: new Date().toISOString(),
      turnMode: room.turnMode || 'turn_by_turn',
      charactersSnapshot: activeCharacters.map((c) => {
        const fresh = this.characters.findById(c.id) || c;
        return {
          id: fresh.id,
          name: fresh.name,
          race: fresh.race,
          characterClass: fresh.characterClass,
          level: fresh.level,
          hpCurrent: fresh.hpCurrent,
          hpMax: fresh.hpMax,
          ac: fresh.ac,
          stats: fresh.stats,
          conditions: fresh.conditions || [],
          inventorySummary: (fresh.inventory || []).map((i) => ({
            name: i.name,
            quantity: i.quantity,
            type: i.type,
          })),
        };
      }),
      enemiesBefore: room.activeEnemies || [],
      sceneNPCsBefore: room.sceneNPCs || [],
      actions: actionsToResolve.map((a) => ({
        actionId: a.id,
        characterName: a.characterName,
        actionText: a.actionText,
        actionType: a.actionType,
        diceRolls: a.diceRolls || [],
        mechanicalResolution: {
          promptDirective: mechanicalDirectives[a.id] || '',
          auditNotes: '',
        },
      })),
      enemiesAfter: room.activeEnemies || [],
      sceneNPCsAfter: room.sceneNPCs || [],
      aiResponseSnapshot: {
        narrative: dmResult.narrative,
        currentSituation: dmResult.currentSituation,
        choiceDilemma: dmResult.choiceDilemma,
        mood: dmResult.mood,
        nextRoundDC: dmResult.nextRoundDC,
        ruleViolations: dmResult.ruleViolations,
      },
    });

    const updated = roomSessionManager.getRoomAndPlayers(room.code);
    const finalRoom = updated?.room || sanitizeRoom(updatedRoom || room);
    const finalPlayers = updated?.players || this.rooms.findPlayersByRoomId(room.id);

    if (isTurnByTurn) {
      return {
        log: createdLog,
        room: finalRoom,
        players: finalPlayers,
        isRoundComplete,
        nextActiveUserId,
        nextRoundNumber,
        inventoryNotifications,
      } as TurnStepResolutionResult;
    } else {
      return {
        log: createdLog,
        room: finalRoom,
        players: finalPlayers,
        nextRoundNumber,
        inventoryNotifications,
      } as RoundResolutionResult;
    }
  }

  /**
   * Formats player actions, d20 checks, check verdicts (★ УСПЕХ / ✗ ПРОВАЛ),
   * inventory activities, and companion reactions into a rich summary.
   */
  private formatActionsSummary(
    actions: TurnActionEntity[],
    targetDC: number,
    itemActivities: Record<string, string[]>,
    completedReactions?: CharacterReactionRequest[]
  ): string {
    const actionBlocks = actions.map((a) => {
      const roll = a.diceRolls && a.diceRolls.length > 0 ? a.diceRolls[0] : null;
      let verdict = '';
      if (roll) {
        const sign = (roll.modifier ?? 0) >= 0 ? '+' : '';
        const statLabel = roll.statName ? ` (${roll.statName.toUpperCase()})` : '';
        const rollExpr = `d20 [${roll.baseRoll ?? roll.total}]${sign}${roll.modifier ?? 0} = ${roll.total}${statLabel}`;
        const dc = targetDC || 12;

        if (roll.isCriticalSuccess || roll.total >= 20) {
          verdict = `★ КРИТ. УСПЕХ (${rollExpr})`;
        } else if (roll.isCriticalFail || roll.total <= 1) {
          verdict = `☠ КРИТ. ПРОВАЛ (${rollExpr})`;
        } else if (roll.total >= dc) {
          verdict = `★ УСПЕХ (${rollExpr} vs СЛ ${dc})`;
        } else {
          verdict = `✗ ПРОВАЛ (${rollExpr} vs СЛ ${dc})`;
        }
      }

      const charItems = itemActivities[a.characterId];
      const itemsLine =
        charItems && charItems.length > 0
          ? `\n   ↳ 🎒 [Инвентарь]: ${charItems.join('; ')}`
          : '';

      return `【${a.characterName}】: «${a.actionText}»${verdict ? `\n   ↳ ${verdict}` : ''}${itemsLine}`;
    });

    let reactionsText = '';
    if (completedReactions && completedReactions.length > 0) {
      reactionsText =
        '\n\n' +
        completedReactions
          .map((r) => {
            const rRoll = r.reactionRoll;
            let rVerdict = '';
            if (rRoll) {
              const sign = (rRoll.modifier ?? 0) >= 0 ? '+' : '';
              const rollExpr = `d20 [${rRoll.baseRoll ?? rRoll.total}]${sign}${rRoll.modifier ?? 0} = ${rRoll.total}`;
              const dc = targetDC || 12;
              rVerdict = rRoll.isCriticalSuccess
                ? `★ КРИТ. УСПЕХ (${rollExpr})`
                : rRoll.isCriticalFail
                ? `☠ КРИТ. ПРОВАЛ (${rollExpr})`
                : rRoll.total >= dc
                ? `★ УСПЕХ (${rollExpr} vs СЛ ${dc})`
                : `✗ ПРОВАЛ (${rollExpr} vs СЛ ${dc})`;
            }
            const typeBadge =
              r.responseType === 'negative'
                ? '⚔️ [Противодействие]'
                : r.responseType === 'counter'
                ? '🛡️ [Защита/Парирование]'
                : '🤝 [Содействие]';
            return `【${r.targetCharacterName}】: ${typeBadge} «${r.reactionText || ''}»${rVerdict ? `\n   ↳ ${rVerdict}` : ''}`;
          })
          .join('\n\n');
    }

    return actionBlocks.join('\n\n') + reactionsText;
  }
}

export const turnExecutionPipeline = new TurnExecutionPipeline();
