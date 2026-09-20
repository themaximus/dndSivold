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
} from '../../repositories';
import { AIProviderFactory, aiProviderFactory } from '../ai/AIProviderFactory';
import { SimulationAIProvider } from '../ai/SimulationAIProvider';
import { AIDMResponse, AIDMPrologueContext } from '../../domain/types';
import { ITTSService, ttsService } from '../tts/TTSService';
import { RoomEntity, RoomPlayerEntity, GameLogEntity, CharacterEntity, RoomLootItem, LoreMilestone } from '../../db';
import { talentTreeGenerator } from '../progression/TalentTreeGenerator';
import { cryptoService, sanitizeRoom } from '../security/CryptoService';

export interface RoundResolutionResult {
  log: GameLogEntity;
  room: RoomEntity;
  players: RoomPlayerEntity[];
  nextRoundNumber: number;
}

export class GameSessionService {
  private rooms: IRoomRepository;
  private characters: ICharacterRepository;
  private turnActions: ITurnActionRepository;
  private gameLogs: IGameLogRepository;
  private aiFactory: AIProviderFactory;
  private tts: ITTSService;

  constructor(
    rooms: IRoomRepository = roomRepository,
    characters: ICharacterRepository = characterRepository,
    turnActions: ITurnActionRepository = turnActionRepository,
    gameLogs: IGameLogRepository = gameLogRepository,
    aiFactory: AIProviderFactory = aiProviderFactory,
    tts: ITTSService = ttsService
  ) {
    this.rooms = rooms;
    this.characters = characters;
    this.turnActions = turnActions;
    this.gameLogs = gameLogs;
    this.aiFactory = aiFactory;
    this.tts = tts;
  }

  public getRoomAndPlayers(roomCode: string) {
    const room = this.rooms.findByCode(roomCode);
    if (!room) return null;

    const players = this.rooms.findPlayersByRoomId(room.id);
    const populatedPlayers = players.map(p => ({
      ...p,
      character: p.characterId ? this.characters.findById(p.characterId) : undefined,
    }));

    return { room: sanitizeRoom(room), players: populatedPlayers };
  }

  public joinRoom(roomCode: string, userId: string, username: string): { room: RoomEntity; players: any[] } | { error: string } | null {
    const room = this.rooms.findByCode(roomCode);
    if (!room) return null;

    const existingPlayers = this.rooms.findPlayersByRoomId(room.id);
    let player = existingPlayers.find(p => p.userId === userId);
    if (!player) {
      if (existingPlayers.length >= 6) {
        return { error: 'В комнате уже максимальное количество участников (6 из 6)' };
      }
      player = this.rooms.addPlayer({
        id: crypto.randomUUID(),
        roomId: room.id,
        userId,
        username,
        isReady: false,
        hasActedThisRound: false,
        isOnline: true,
        joinedAt: new Date().toISOString(),
      });
    } else {
      this.rooms.updatePlayer(player.id, { isOnline: true });
    }

    return this.getRoomAndPlayers(roomCode);
  }

  public setPlayerOnline(roomId: string, userId: string, isOnline: boolean) {
    const player = this.rooms.findPlayer(roomId, userId);
    if (player) {
      this.rooms.updatePlayer(player.id, { isOnline });
    }
  }

  public canForceResolve(roomId: string, hostUserId: string): boolean {
    const room = this.rooms.findById(roomId);
    if (!room || room.status !== 'active') return false;
    return room.hostUserId === hostUserId;
  }

  public selectCharacter(roomId: string, userId: string, characterId: string) {
    const player = this.rooms.findPlayer(roomId, userId);
    if (!player) return null;

    this.rooms.updatePlayer(player.id, {
      characterId,
      isReady: true,
    });

    const room = this.rooms.findById(roomId);
    if (!room) return null;
    return this.getRoomAndPlayers(room.code);
  }

  public async startGame(roomId: string, hostUserId: string) {
    const room = this.rooms.findById(roomId);
    if (!room || room.hostUserId !== hostUserId) return null;

    const allPlayers = this.rooms.findPlayersByRoomId(room.id);
    const activeCharacters: CharacterEntity[] = allPlayers
      .map(p => (p.characterId ? this.characters.findById(p.characterId) : undefined))
      .filter((c): c is CharacterEntity => !!c);

    // AI Provider neural prologue generation with world, lore, and characters
    const decryptedApiKey = cryptoService.decrypt(room.deepseekApiKey || '');
    const provider = this.aiFactory.getProvider(decryptedApiKey, room.deepseekModel);
    
    let prologueResult: AIDMResponse;
    const prologueContext: AIDMPrologueContext = {
      apiKey: decryptedApiKey,
      model: room.deepseekModel,
      title: room.title,
      setting: room.setting,
      characters: activeCharacters,
    };

    try {
      prologueResult = await provider.generatePrologue(prologueContext);
    } catch (err: any) {
      console.warn('AI Provider prologue generation failed, falling back to procedural prologue:', err?.message || err);
      const fallback = new SimulationAIProvider();
      prologueResult = await fallback.generatePrologue(prologueContext);
    }

    const startDC = prologueResult.nextRoundDC || 12;
    const startDCReason = prologueResult.nextRoundDCReason || 'Оценка обстановки и первый решительный шаг';
    const startCheckStat = prologueResult.requiredCheckStat || 'dex';
    const campaignPlot = prologueResult.campaignPlot || room.campaignPlot || 'Генеральная сюжетная арка: исследование тайны, нарастание угрозы, кульминация.';

    // Initialize turn order for party
    const partyPlayers = this.rooms.findPlayersByRoomId(room.id).filter(p => p.characterId);
    const turnOrder = partyPlayers.map(p => p.userId);

    this.rooms.update(room.id, {
      status: 'active',
      roundNumber: 1,
      currentSituation: prologueResult.currentSituation || 'Что предпринимает отряд?',
      targetDC: startDC,
      dcReason: startDCReason,
      requiredCheckStat: startCheckStat,
      campaignPlot,
      turnMode: room.turnMode || 'simultaneous',
      turnOrder,
      activePlayerUserId: turnOrder[0] || undefined,
    });
    this.rooms.resetPlayersTurn(room.id);

    // Process prologue milestones
    if (Array.isArray(prologueResult.newMilestones) && prologueResult.newMilestones.length > 0) {
      const milestones: LoreMilestone[] = prologueResult.newMilestones.map((m) => ({
        id: crypto.randomUUID(),
        round: 0,
        milestone: m,
      }));
      this.rooms.addMilestones(room.id, milestones);
    }

    // Create prologue log
    const prologueLog = this.gameLogs.create({
      id: crypto.randomUUID(),
      roomId: room.id,
      roundNumber: 0,
      narrativeText: prologueResult.narrative,
      targetDC: startDC,
      dcReason: startDCReason,
      requiredCheckStat: startCheckStat,
      createdAt: new Date().toISOString(),
    });

    // Pre-warm neural TTS audio in background for instant voice playback
    this.tts.synthesize(prologueLog.narrativeText, prologueResult.mood || 'mystery').catch(err => {
      console.warn('Background prologue TTS pre-warm failed:', err.message);
    });

    return this.getRoomAndPlayers(room.code);
  }

  public submitAction(
    roomCode: string,
    userId: string,
    actionText: string,
    diceRolls: any[]
  ) {
    const room = this.rooms.findByCode(roomCode);
    if (!room || room.status !== 'active') return null;

    const player = this.rooms.findPlayer(room.id, userId);
    if (!player) return null;

    const character = player.characterId ? this.characters.findById(player.characterId) : undefined;
    const charName = character?.name || player.username;

    this.turnActions.create({
      id: crypto.randomUUID(),
      roomId: room.id,
      roundNumber: room.roundNumber,
      playerId: userId,
      characterId: character?.id || '',
      characterName: charName,
      actionText: actionText.trim(),
      diceRolls: diceRolls || [],
      submittedAt: new Date().toISOString(),
    });

    this.rooms.updatePlayer(player.id, {
      hasActedThisRound: true,
      hasRolledThisRound: true,
    });

    const allPlayers = this.rooms.findPlayersByRoomId(room.id);
    const playersWithChar = allPlayers.filter(p => p.characterId);
    const onlineActive = playersWithChar.filter(p => p.isOnline);
    const targetPlayers = onlineActive.length > 0 ? onlineActive : playersWithChar;

    let shouldResolveRound = false;
    let nextActiveUserId: string | undefined;

    if (room.turnMode === 'turn_by_turn') {
      const order = (room.turnOrder && room.turnOrder.length > 0)
        ? room.turnOrder.filter(uid => targetPlayers.some(p => p.userId === uid))
        : targetPlayers.map(p => p.userId);

      const currentIndex = order.indexOf(userId);
      const nextIndex = currentIndex + 1;

      if (nextIndex < order.length) {
        nextActiveUserId = order[nextIndex];
        this.rooms.update(room.id, { activePlayerUserId: nextActiveUserId });
      } else {
        shouldResolveRound = true;
        this.rooms.update(room.id, { activePlayerUserId: order[0] });
      }
    } else {
      const readyPlayers = targetPlayers.filter(p => p.hasActedThisRound);
      shouldResolveRound = targetPlayers.length > 0 && readyPlayers.length === targetPlayers.length;
    }

    const updatedRoom = this.rooms.findByCode(roomCode) || room;

    return {
      room: sanitizeRoom(updatedRoom),
      player,
      characterName: charName,
      shouldResolveRound,
      nextActiveUserId,
    };
  }

  public async resolveRound(roomId: string): Promise<RoundResolutionResult | null> {
    const room = this.rooms.findById(roomId);
    if (!room) return null;

    const allPlayers = this.rooms.findPlayersByRoomId(room.id);
    const currentRoundActions = this.turnActions.findByRoomAndRound(room.id, room.roundNumber);
    const activeCharacters: CharacterEntity[] = allPlayers
      .map(p => (p.characterId ? this.characters.findById(p.characterId) : undefined))
      .filter((c): c is CharacterEntity => !!c);

    const previousLogs = this.gameLogs.findByRoomId(room.id).map(l => l.narrativeText);

    // AI Provider resolution with DC, quenta, and milestones context
    const decryptedApiKey = cryptoService.decrypt(room.deepseekApiKey || '');
    const provider = this.aiFactory.getProvider(decryptedApiKey, room.deepseekModel);
    
    let dmResult: AIDMResponse;
    const aiContext = {
      apiKey: decryptedApiKey,
      model: room.deepseekModel,
      setting: room.setting,
      roundNumber: room.roundNumber,
      currentSituation: room.currentSituation,
      currentDC: room.targetDC,
      currentDCReason: room.dcReason,
      requiredCheckStat: room.requiredCheckStat,
      campaignPlot: room.campaignPlot,
      loreJournal: room.loreJournal,
      characters: activeCharacters,
      actions: currentRoundActions,
      previousHistory: previousLogs,
    };

    try {
      dmResult = await provider.generateRound(aiContext);
    } catch (err: any) {
      console.warn('Primary AI provider failed, seamlessly resolving with Procedural Narrative Engine:', err?.message || err);
      const fallback = new SimulationAIProvider();
      dmResult = await fallback.generateRound(aiContext);
    }

    // Apply player updates (HP changes) with exact ID or name matching
    if (Array.isArray(dmResult.playerUpdates)) {
      dmResult.playerUpdates.forEach(update => {
        const target = this.characters.findById(update.characterId) ||
          activeCharacters.find(c =>
            c.name.toLowerCase().trim() === (update.characterName || update.characterId || '').toLowerCase().trim() ||
            c.name.toLowerCase().includes((update.characterName || update.characterId || '').toLowerCase().trim()) ||
            (update.characterName || update.characterId || '').toLowerCase().includes(c.name.toLowerCase().trim())
          );

        if (target) {
          this.characters.updateHp(target.id, update.hpDelta || 0);
          update.characterId = target.id;
          update.characterName = target.name;
        }
      });
    }

    // Process Dropped Loot
    let droppedLootItems: RoomLootItem[] = [];
    if (Array.isArray(dmResult.droppedLoot) && dmResult.droppedLoot.length > 0) {
      droppedLootItems = dmResult.droppedLoot.map(item => ({
        id: crypto.randomUUID(),
        name: item.name,
        type: item.type,
        description: item.description,
        quantity: 1,
        damage: item.damage,
        ac_bonus: item.ac_bonus,
        healAmount: item.healAmount,
        roundDropped: room.roundNumber,
      }));
      this.rooms.addLoot(room.id, droppedLootItems);
    }

    // Process Lore Journal Milestones
    if (Array.isArray(dmResult.newMilestones) && dmResult.newMilestones.length > 0) {
      const milestones: LoreMilestone[] = dmResult.newMilestones.map((m) => ({
        id: crypto.randomUUID(),
        round: room.roundNumber,
        milestone: m,
      }));
      this.rooms.addMilestones(room.id, milestones);
    }

    // Award XP to active characters
    const xpToAward = dmResult.xpAwarded && dmResult.xpAwarded > 0 ? dmResult.xpAwarded : 25;
    activeCharacters.forEach(c => {
      this.characters.awardXp(c.id, xpToAward);
    });

    // Save game log
    const newLog = this.gameLogs.create({
      id: crypto.randomUUID(),
      roomId: room.id,
      roundNumber: room.roundNumber,
      narrativeText: dmResult.narrative,
      actionsSummary: currentRoundActions.map(a => `${a.characterName}: ${a.actionText}`).join('\n'),
      targetDC: room.targetDC,
      dcReason: room.dcReason,
      requiredCheckStat: room.requiredCheckStat,
      droppedLoot: droppedLootItems.length > 0 ? droppedLootItems : undefined,
      playerUpdates: dmResult.playerUpdates?.map(u => {
        const c = this.characters.findById(u.characterId) ||
          activeCharacters.find(ch => ch.name.toLowerCase().trim() === (u.characterName || u.characterId || '').toLowerCase().trim());
        const resolvedName = c?.name || u.characterName || (activeCharacters[0]?.name) || 'Герой';
        return {
          characterId: c?.id || u.characterId,
          characterName: resolvedName,
          hpDelta: u.hpDelta,
          hpCurrent: c?.hpCurrent || 0,
          note: u.note,
        };
      }),
      createdAt: new Date().toISOString(),
    });

    // Advance round & update Target DC for the next round
    const nextRound = room.roundNumber + 1;
    const nextDC = dmResult.nextRoundDC || 12;
    const nextDCReason = dmResult.nextRoundDCReason || 'Преодоление препятствий';
    const nextCheckStat = dmResult.requiredCheckStat || room.requiredCheckStat || 'dex';
    const firstActiveUserId = (room.turnOrder && room.turnOrder.length > 0) ? room.turnOrder[0] : undefined;

    this.rooms.update(room.id, {
      roundNumber: nextRound,
      currentSituation: dmResult.currentSituation || 'Что вы делаете дальше?',
      targetDC: nextDC,
      dcReason: nextDCReason,
      requiredCheckStat: nextCheckStat,
      activePlayerUserId: firstActiveUserId,
      campaignPlot: dmResult.campaignPlot || room.campaignPlot,
    });
    this.rooms.resetPlayersTurn(room.id);

    // Pre-warm neural TTS audio in the background for zero-latency instant playback
    this.tts.synthesize(newLog.narrativeText, dmResult.mood).catch(err => {
      console.warn('Background TTS pre-warm failed:', err.message);
    });

    const updated = this.getRoomAndPlayers(room.code);
    return {
      log: newLog,
      room: updated!.room,
      players: updated!.players,
      nextRoundNumber: nextRound,
    };
  }

  public pickupLoot(roomId: string, characterId: string, lootId: string) {
    const { room, item } = this.rooms.removeLoot(roomId, lootId);
    if (!item) return null;
    const updatedChar = this.characters.addItemToInventory(characterId, item);
    return { room: sanitizeRoom(room), character: updatedChar, item };
  }

  public useItem(characterId: string, itemId: string) {
    return this.characters.useConsumableItem(characterId, itemId);
  }

  public equipWeapon(characterId: string, itemId: string) {
    return this.characters.equipWeapon(characterId, itemId);
  }

  public rollDeathSave(
    characterId: string,
    rollRequest: { rollTotal: number; isNat20: boolean; isNat1: boolean }
  ) {
    return this.characters.applyDeathSave(
      characterId,
      rollRequest.rollTotal,
      rollRequest.isNat20,
      rollRequest.isNat1
    );
  }

  public getCharacterTalents(characterId: string) {
    const character = this.characters.findById(characterId);
    if (!character) return null;
    return talentTreeGenerator.generateTree(character);
  }

  public learnTalent(characterId: string, talentId: string) {
    const character = this.characters.findById(characterId);
    if (!character) return null;

    const tree = talentTreeGenerator.generateTree(character);
    const allTalents = [
      ...tree.classBranch.talents,
      ...tree.raceBranch.talents,
      ...tree.quentaBranch.talents,
    ];

    const talent = allTalents.find(t => t.id === talentId);
    if (!talent) return null;

    return this.characters.learnTalent(characterId, talentId, talent.effects);
  }

  public setTurnMode(roomId: string, mode: 'simultaneous' | 'turn_by_turn') {
    const room = this.rooms.findById(roomId);
    if (!room) return null;
    const allPlayers = this.rooms.findPlayersByRoomId(roomId).filter(p => p.characterId);
    const turnOrder = allPlayers.map(p => p.userId);
    const activePlayerUserId = mode === 'turn_by_turn' ? (turnOrder[0] || undefined) : undefined;
    const updated = this.rooms.update(roomId, {
      turnMode: mode,
      turnOrder,
      activePlayerUserId,
    });
    return updated ? sanitizeRoom(updated) : null;
  }
}

export const gameSessionService = new GameSessionService();
