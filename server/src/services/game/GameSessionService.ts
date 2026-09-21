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
import { AIDMResponse, AIDMPrologueContext, AIDMContext, InventoryNotification } from '../../domain/types';
import { ITTSService, ttsService } from '../tts/TTSService';
import { RoomEntity, RoomPlayerEntity, GameLogEntity, CharacterEntity, RoomLootItem, LoreMilestone, RoomEnemy, CharacterReactionRequest } from '../../db';
import { talentTreeGenerator } from '../progression/TalentTreeGenerator';
import { cryptoService, sanitizeRoom } from '../security/CryptoService';

export function sanitizeNarrativeText(text: string): string {
  if (!text) return '';
  return text
    .replace(/\n*📌\s*Итог ситуации:[\s\S]*?(?=(\n*❓\s*Выбор|$))/i, '')
    .replace(/\n*❓\s*Выбор[\s\S]*$/i, '')
    .trim();
}

export interface RoundResolutionResult {
  log?: GameLogEntity;
  room: RoomEntity;
  players: RoomPlayerEntity[];
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
  players: RoomPlayerEntity[];
  isRoundComplete: boolean;
  nextActiveUserId?: string;
  nextRoundNumber?: number;
  inventoryNotifications?: InventoryNotification[];
  rejectedAction?: {
    characterName: string;
    reason: string;
  };
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
      genre: room.genre || 'fantasy',
      campaignDuration: room.campaignDuration || 'medium',
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
      activeEnemies: prologueResult.activeEnemies || [],
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

    // Create prologue log with sanitized narrative
    const cleanPrologueNarrative = sanitizeNarrativeText(prologueResult.narrative);
    const prologueLog = this.gameLogs.create({
      id: crypto.randomUUID(),
      roomId: room.id,
      roundNumber: 0,
      narrativeText: cleanPrologueNarrative,
      currentSituation: prologueResult.currentSituation,
      choiceDilemma: prologueResult.choiceDilemma,
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

  public detectCharacterMentions(actionText: string, roomId: string, actingUserId: string): Array<{
    userId: string;
    characterId: string;
    characterName: string;
  }> {
    const players = this.rooms.findPlayersByRoomId(roomId);
    const mentions: Array<{ userId: string; characterId: string; characterName: string }> = [];
    const textLower = actionText.toLowerCase();

    for (const player of players) {
      if (player.userId === actingUserId || !player.characterId) continue;
      const character = this.characters.findById(player.characterId);
      if (!character || !character.name) continue;

      const charName = character.name.trim();
      const nameLower = charName.toLowerCase();
      // Stem for Russian name inflections
      const endsInVowel = /[аяиыеоую]$/i.test(nameLower);
      const stem = (charName.length >= 4 && endsInVowel)
        ? nameLower.slice(0, -1)
        : (charName.length >= 5 ? nameLower.slice(0, -1) : nameLower);

      const isMentioned =
        textLower.includes(nameLower) ||
        textLower.includes(stem) ||
        (player.username && textLower.includes(player.username.toLowerCase())) ||
        textLower.includes(`@${nameLower}`) ||
        textLower.includes(`@${player.username.toLowerCase()}`);

      if (isMentioned) {
        mentions.push({
          userId: player.userId,
          characterId: character.id,
          characterName: character.name,
        });
      }
    }

    return mentions;
  }

  public submitAction(
    roomCode: string,
    userId: string,
    actionText: string,
    diceRolls: any[],
    meta?: {
      actionType?: 'attack' | 'check' | 'save' | 'improvise';
      targetEnemyId?: string;
      targetEnemyName?: string;
      advantage?: boolean;
      disadvantage?: boolean;
      spellLevelUsed?: number;
    }
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
      actionType: meta?.actionType,
      targetEnemyId: meta?.targetEnemyId,
      targetEnemyName: meta?.targetEnemyName,
      advantage: meta?.advantage,
      disadvantage: meta?.disadvantage,
      spellLevelUsed: meta?.spellLevelUsed,
      submittedAt: new Date().toISOString(),
    });

    if (character && meta?.spellLevelUsed && meta.spellLevelUsed > 0) {
      this.characters.useSpellSlot(character.id, meta.spellLevelUsed);
    }

    this.rooms.updatePlayer(player.id, {
      hasActedThisRound: true,
      hasRolledThisRound: true,
    });

    // Detect if any other party member is mentioned in actionText
    const mentionedCharacters = this.detectCharacterMentions(actionText, room.id, userId);
    let pendingReactions: CharacterReactionRequest[] = [];

    if (mentionedCharacters.length > 0) {
      pendingReactions = mentionedCharacters.map(m => ({
        id: crypto.randomUUID(),
        initiatorUserId: userId,
        initiatorCharacterName: charName,
        initiatorActionText: actionText.trim(),
        initiatorRoll: diceRolls?.[0],
        targetUserId: m.userId,
        targetCharacterId: m.characterId,
        targetCharacterName: m.characterName,
        status: 'pending',
        createdAt: new Date().toISOString(),
      }));

      this.rooms.update(room.id, { pendingReactions });
    }

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
      } else {
        shouldResolveRound = true;
      }
    } else {
      const readyPlayers = targetPlayers.filter(p => p.hasActedThisRound);
      shouldResolveRound = targetPlayers.length > 0 && readyPlayers.length === targetPlayers.length;
    }

    const updatedRoom = this.rooms.findByCode(roomCode) || room;
    const waitingForReactions = pendingReactions.length > 0;

    return {
      room: sanitizeRoom(updatedRoom),
      player,
      characterName: charName,
      shouldResolveRound: waitingForReactions ? false : shouldResolveRound,
      waitingForReactions,
      pendingReactions,
      isTurnByTurn: room.turnMode === 'turn_by_turn',
      nextActiveUserId,
    };
  }

  public submitReaction(
    roomCode: string,
    userId: string,
    reactionRequestId: string,
    reactionText: string,
    reactionRoll: any,
    responseType?: 'positive' | 'negative' | 'counter'
  ) {
    const room = this.rooms.findByCode(roomCode);
    if (!room || room.status !== 'active') return null;

    const currentReactions = room.pendingReactions || [];
    const targetReq = currentReactions.find(r => r.id === reactionRequestId && r.targetUserId === userId);
    if (!targetReq) return null;

    const updatedReactions = currentReactions.map(r => {
      if (r.id === reactionRequestId) {
        return {
          ...r,
          status: 'completed' as const,
          reactionText: reactionText.trim(),
          reactionRoll,
          responseType: responseType || 'positive',
        };
      }
      return r;
    });

    const updatedRoom = this.rooms.update(room.id, { pendingReactions: updatedReactions }) || room;
    const allCompleted = updatedReactions.every(r => r.status === 'completed' || r.status === 'skipped');
    const completedReactions = updatedReactions.filter(r => r.status === 'completed');

    // Check if round should resolve (simultaneous mode)
    const allPlayers = this.rooms.findPlayersByRoomId(room.id);
    const playersWithChar = allPlayers.filter(p => p.characterId);
    const onlineActive = playersWithChar.filter(p => p.isOnline);
    const targetPlayers = onlineActive.length > 0 ? onlineActive : playersWithChar;
    const readyPlayers = targetPlayers.filter(p => p.hasActedThisRound);
    const shouldResolveRound = room.turnMode === 'simultaneous' && targetPlayers.length > 0 && readyPlayers.length === targetPlayers.length;

    return {
      room: updatedRoom,
      initiatorUserId: targetReq.initiatorUserId,
      initiatorCharacterName: targetReq.initiatorCharacterName,
      targetCharacterName: targetReq.targetCharacterName,
      allCompleted,
      completedReactions,
      shouldResolveRound,
    };
  }

  public skipReaction(roomCode: string, userId: string, reactionRequestId: string) {
    const room = this.rooms.findByCode(roomCode);
    if (!room || room.status !== 'active') return null;

    const currentReactions = room.pendingReactions || [];
    const targetReq = currentReactions.find(r => r.id === reactionRequestId);
    if (!targetReq) return null;

    if (userId !== room.hostUserId && userId !== targetReq.initiatorUserId && userId !== targetReq.targetUserId) {
      return null;
    }

    const updatedReactions = currentReactions.map(r => {
      if (r.id === reactionRequestId) {
        return { ...r, status: 'skipped' as const };
      }
      return r;
    });

    const updatedRoom = this.rooms.update(room.id, { pendingReactions: updatedReactions }) || room;
    const allCompleted = updatedReactions.every(r => r.status === 'completed' || r.status === 'skipped');
    const completedReactions = updatedReactions.filter(r => r.status === 'completed');

    const allPlayers = this.rooms.findPlayersByRoomId(room.id);
    const playersWithChar = allPlayers.filter(p => p.characterId);
    const onlineActive = playersWithChar.filter(p => p.isOnline);
    const targetPlayers = onlineActive.length > 0 ? onlineActive : playersWithChar;
    const readyPlayers = targetPlayers.filter(p => p.hasActedThisRound);
    const shouldResolveRound = room.turnMode === 'simultaneous' && targetPlayers.length > 0 && readyPlayers.length === targetPlayers.length;

    return {
      room: updatedRoom,
      initiatorUserId: targetReq.initiatorUserId,
      initiatorCharacterName: targetReq.initiatorCharacterName,
      targetCharacterName: targetReq.targetCharacterName,
      allCompleted,
      completedReactions,
      shouldResolveRound,
    };
  }

  public async resolveTurnStep(roomId: string, actingUserId: string, completedReactions?: CharacterReactionRequest[]): Promise<TurnStepResolutionResult | null> {
    const room = this.rooms.findById(roomId);
    if (!room) return null;

    const allPlayers = this.rooms.findPlayersByRoomId(room.id);
    const playersWithChar = allPlayers.filter(p => p.characterId);
    const onlineActive = playersWithChar.filter(p => p.isOnline);
    const targetPlayers = onlineActive.length > 0 ? onlineActive : playersWithChar;

    const currentRoundActions = this.turnActions.findByRoomAndRound(room.id, room.roundNumber);
    const actingAction = currentRoundActions.find(a => a.playerId === actingUserId) ||
      currentRoundActions[currentRoundActions.length - 1];

    if (!actingAction) return null;

    const activeCharacters: CharacterEntity[] = allPlayers
      .map(p => (p.characterId ? this.characters.findById(p.characterId) : undefined))
      .filter((c): c is CharacterEntity => !!c);

    const actingChar = activeCharacters.find(c => c.id === actingAction.characterId);
    const previousLogs = this.gameLogs.findByRoomId(room.id).map(l => l.narrativeText);

    const decryptedApiKey = cryptoService.decrypt(room.deepseekApiKey || '');
    const provider = this.aiFactory.getProvider(decryptedApiKey, room.deepseekModel);

    let dmResult: AIDMResponse;
    const aiContext: AIDMContext = {
      apiKey: decryptedApiKey,
      model: room.deepseekModel,
      setting: room.setting,
      genre: room.genre,
      campaignDuration: room.campaignDuration,
      roundNumber: room.roundNumber,
      currentSituation: room.currentSituation,
      currentDC: room.targetDC,
      currentDCReason: room.dcReason,
      requiredCheckStat: room.requiredCheckStat,
      campaignPlot: room.campaignPlot,
      campaignMap: room.campaignMap,
      loreJournal: room.loreJournal,
      characters: activeCharacters,
      activeEnemies: room.activeEnemies || [],
      actions: [actingAction],
      previousHistory: previousLogs,
      turnMode: 'turn_by_turn',
      turnPlayerName: actingAction.characterName,
      characterReactions: completedReactions,
    };

    try {
      dmResult = await provider.generateRound(aiContext);
    } catch (err: any) {
      console.warn('Primary AI provider failed in turn step, resolving with SimulationAIProvider:', err?.message || err);
      const fallback = new SimulationAIProvider();
      dmResult = await fallback.generateRound(aiContext);
    }

    // Handle Rejected Action
    if (dmResult.rejectedAction) {
      const playerRec = this.rooms.findPlayer(room.id, actingAction.playerId);
      if (playerRec) {
        this.rooms.updatePlayer(playerRec.id, { hasActedThisRound: false });
      }
      this.turnActions.delete(actingAction.id);
      const updatedPlayers = this.rooms.findPlayersByRoomId(room.id);
      return {
        room,
        players: updatedPlayers,
        isRoundComplete: false,
        rejectedAction: dmResult.rejectedAction,
      };
    }

    // Apply player updates
    if (Array.isArray(dmResult.playerUpdates)) {
      dmResult.playerUpdates.forEach(update => {
        const target = this.characters.findById(update.characterId) ||
          activeCharacters.find(c =>
            c.name.toLowerCase().trim() === (update.characterName || update.characterId || '').toLowerCase().trim() ||
            c.name.toLowerCase().includes((update.characterName || update.characterId || '').toLowerCase().trim())
          );
        if (target) {
          this.characters.updateHp(target.id, update.hpDelta || 0);
          update.characterId = target.id;
          update.characterName = target.name;
        }
      });
    }

    // Process Dynamic Inventory Updates
    const itemActivitiesByCharacter: Record<string, string[]> = {};
    const inventoryNotifications: InventoryNotification[] = [];
    if (Array.isArray(dmResult.inventoryUpdates) && dmResult.inventoryUpdates.length > 0) {
      dmResult.inventoryUpdates.forEach(invUpdate => {
        const target = this.characters.findById(invUpdate.characterId) ||
          activeCharacters.find(c =>
            c.name.toLowerCase().trim() === (invUpdate.characterName || invUpdate.characterId || '').toLowerCase().trim() ||
            c.name.toLowerCase().includes((invUpdate.characterName || invUpdate.characterId || '').toLowerCase().trim())
          );
        if (target && invUpdate.item && typeof invUpdate.item.name === 'string' && invUpdate.item.name.trim()) {
          const cleanItemName = invUpdate.item.name.trim();
          if (!itemActivitiesByCharacter[target.id]) {
            itemActivitiesByCharacter[target.id] = [];
          }
          if (invUpdate.action === 'remove') {
            const reason = invUpdate.reason || `Израсходовано или утрачено в раунде ${room.roundNumber}`;
            this.characters.removeItemFromInventory(target.id, cleanItemName, invUpdate.item.quantity || 1, reason);
            itemActivitiesByCharacter[target.id].push(`Потрачено/утрачено: «${cleanItemName}» (${reason})`);
            inventoryNotifications.push({
              id: crypto.randomUUID(),
              characterId: target.id,
              characterName: target.name,
              action: 'remove',
              itemName: cleanItemName,
              quantity: invUpdate.item.quantity || 1,
              reason,
              timestamp: new Date().toISOString(),
            });
          } else if (invUpdate.action === 'add') {
            const reason = invUpdate.reason || (Array.isArray(invUpdate.item.history) && invUpdate.item.history.length > 0 ? invUpdate.item.history[0] : `Получено в раунде ${room.roundNumber}`);
            this.characters.addItemToInventory(target.id, {
              ...invUpdate.item,
              name: cleanItemName,
            }, reason);
            itemActivitiesByCharacter[target.id].push(`Получено: «${cleanItemName}» (${reason})`);
            inventoryNotifications.push({
              id: crypto.randomUUID(),
              characterId: target.id,
              characterName: target.name,
              action: 'add',
              itemName: cleanItemName,
              quantity: invUpdate.item.quantity || 1,
              reason,
              timestamp: new Date().toISOString(),
            });
          }
        }
      });
    }

    // Fallback heuristic for acting player
    if (actingChar && actingChar.inventory) {
      const actionLower = actingAction.actionText.toLowerCase();
      const narrativeLower = (dmResult.narrative || '').toLowerCase();
      const consumeRegex = /(выпи(л|ть|ваю)|исцел(ил|ить|яю)|поит|леч(у|ил|ить)|передал|отдал|поделился|скормил|использ(овал|ую)|бросаю|метнул|зажёг)/i;
      const breakRegex = /(сломал(ся|ась)?|разбил(ся|ась)?|расколол(ся|ась)?|уничтожен|похищен|украл(и)?|среза(л|ли)|отобрал(и)?)/i;

      actingChar.inventory.forEach(item => {
        if (!item || !item.name) return;
        const itemNameLower = item.name.toLowerCase().trim();
        if (itemNameLower.length < 3) return;

        const mentionedInAction = actionLower.includes(itemNameLower);
        const mentionedInNarrative = narrativeLower.includes(itemNameLower);

        const alreadyProcessed = Array.isArray(dmResult.inventoryUpdates) && dmResult.inventoryUpdates.some(u =>
          (u.characterId === actingChar.id || (u.characterName && u.characterName.toLowerCase() === actingChar.name.toLowerCase())) &&
          u.item && u.item.name.toLowerCase().includes(itemNameLower)
        );

        if (!alreadyProcessed) {
          if (mentionedInAction && consumeRegex.test(actionLower) && (item.type === 'potion' || item.type === 'scroll' || item.type === 'food' || (item.healAmount && item.healAmount > 0))) {
            const reason = `Израсходовано в ходе заявки: «${item.name}»`;
            this.characters.removeItemFromInventory(actingChar.id, item.id, 1, reason);
            if (!itemActivitiesByCharacter[actingChar.id]) itemActivitiesByCharacter[actingChar.id] = [];
            itemActivitiesByCharacter[actingChar.id].push(`Использовано: «${item.name}» (${reason})`);
            inventoryNotifications.push({
              id: crypto.randomUUID(),
              characterId: actingChar.id,
              characterName: actingChar.name,
              action: 'remove',
              itemName: item.name,
              quantity: 1,
              reason,
              timestamp: new Date().toISOString(),
            });
          } else if ((mentionedInAction || mentionedInNarrative) && (breakRegex.test(actionLower) || breakRegex.test(narrativeLower))) {
            const reason = `Сломано или утрачено в ходе событий раунда ${room.roundNumber}`;
            this.characters.removeItemFromInventory(actingChar.id, item.id, 1, reason);
            if (!itemActivitiesByCharacter[actingChar.id]) itemActivitiesByCharacter[actingChar.id] = [];
            itemActivitiesByCharacter[actingChar.id].push(`Сломано/утрачено: «${item.name}» (${reason})`);
            inventoryNotifications.push({
              id: crypto.randomUUID(),
              characterId: actingChar.id,
              characterName: actingChar.name,
              action: 'remove',
              itemName: item.name,
              quantity: 1,
              reason,
              timestamp: new Date().toISOString(),
            });
          }
        }
      });
    }

    // Process Dropped Loot
    let droppedLootItems: RoomLootItem[] = [];
    if (Array.isArray(dmResult.droppedLoot) && dmResult.droppedLoot.length > 0) {
      droppedLootItems = dmResult.droppedLoot
        .filter(item => item && typeof item.name === 'string' && item.name.trim().length > 0)
        .map(item => ({
          id: crypto.randomUUID(),
          name: item.name.trim(),
          type: item.type || 'misc',
          description: item.description?.trim() || 'Предмет, найденный в бою',
          quantity: 1,
          damage: item.damage,
          ac_bonus: item.ac_bonus,
          healAmount: item.healAmount,
          roundDropped: room.roundNumber,
        }));
      if (droppedLootItems.length > 0) {
        this.rooms.addLoot(room.id, droppedLootItems);
      }
    }

    // Process Lore Journal Milestones (including item drops, acquisitions and usages)
    const itemMilestones: LoreMilestone[] = [];
    if (droppedLootItems.length > 0) {
      itemMilestones.push({
        id: crypto.randomUUID(),
        round: room.roundNumber,
        milestone: `📦 На поле боя обнаружены трофеи: ${droppedLootItems.map(i => `«${i.name}»`).join(', ')}.`,
      });
    }
    inventoryNotifications.forEach(notif => {
      if (notif.action === 'add') {
        itemMilestones.push({
          id: crypto.randomUUID(),
          round: room.roundNumber,
          milestone: `🎒 ${notif.characterName} находит/получает предмет: «${notif.itemName}» (${notif.reason || 'в ходе действий'}).`,
        });
      } else if (notif.action === 'remove') {
        itemMilestones.push({
          id: crypto.randomUUID(),
          round: room.roundNumber,
          milestone: `🎒 ${notif.characterName} использует/теряет: «${notif.itemName}» (${notif.reason || 'израсходован или утрачен'}).`,
        });
      }
    });

    const dmMilestones: LoreMilestone[] = Array.isArray(dmResult.newMilestones) && dmResult.newMilestones.length > 0
      ? dmResult.newMilestones.map(m => ({
          id: crypto.randomUUID(),
          round: room.roundNumber,
          milestone: m,
        }))
      : [];

    const allMilestones = [...dmMilestones, ...itemMilestones];
    if (allMilestones.length > 0) {
      this.rooms.addMilestones(room.id, allMilestones);
    }

    // Award XP for turn step
    const xpToAward = dmResult.xpAwarded && dmResult.xpAwarded > 0 ? dmResult.xpAwarded : 15;
    if (actingChar) {
      this.characters.awardXp(actingChar.id, xpToAward);
    }

    // Format Actions Summary for this single action
    const roll = actingAction.diceRolls && actingAction.diceRolls.length > 0 ? actingAction.diceRolls[0] : null;
    let verdict = '';
    if (roll) {
      const sign = roll.modifier >= 0 ? '+' : '';
      const statLabel = roll.statName ? ` (${roll.statName.toUpperCase()})` : '';
      const rollExpr = `d20 [${roll.baseRoll ?? roll.total}]${sign}${roll.modifier ?? 0}${statLabel} = ${roll.total}`;

      const targetEnemy = room.activeEnemies?.find(e =>
        e.id === actingAction.targetEnemyId || (actingAction.targetEnemyName && e.name.toLowerCase().includes(actingAction.targetEnemyName.toLowerCase()))
      );

      if (actingAction.actionType === 'attack' || targetEnemy) {
        const ac = targetEnemy?.ac || 12;
        const enemyName = targetEnemy?.name || actingAction.targetEnemyName || 'Враг';
        if (roll.isCriticalSuccess) {
          verdict = `★ КРИТИЧЕСКИЙ УСПЕХ! (${rollExpr} vs КБ ${ac} ${enemyName})`;
        } else if (roll.isCriticalFail) {
          verdict = `☠ КРИТИЧЕСКИЙ ПРОВАЛ! (${rollExpr} vs КБ ${ac} ${enemyName})`;
        } else if (roll.total >= ac) {
          verdict = `★ УСПЕХ (Попадание: ${rollExpr} vs КБ ${ac} ${enemyName})`;
        } else {
          verdict = `✗ ПРОВАЛ (Промах: ${rollExpr} vs КБ ${ac} ${enemyName})`;
        }
      } else {
        const dc = room.targetDC || 12;
        if (roll.isCriticalSuccess) {
          verdict = `★ КРИТИЧЕСКИЙ УСПЕХ! (${rollExpr} vs СЛ ${dc})`;
        } else if (roll.isCriticalFail) {
          verdict = `☠ КРИТИЧЕСКИЙ ПРОВАЛ! (${rollExpr} vs СЛ ${dc})`;
        } else if (roll.total >= dc) {
          verdict = `★ УСПЕХ (${rollExpr} vs СЛ ${dc})`;
        } else {
          verdict = `✗ ПРОВАЛ (${rollExpr} vs СЛ ${dc})`;
        }
      }
    }

    const itemActivities = itemActivitiesByCharacter[actingAction.characterId];
    const itemsLine = itemActivities && itemActivities.length > 0
      ? `\n   🎒 [Инвентарь]: ${itemActivities.join('; ')}`
      : '';

    let reactionSummaryLines = '';
    if (completedReactions && completedReactions.length > 0) {
      reactionSummaryLines = '\n' + completedReactions.map(r => {
        const rRoll = r.reactionRoll;
        let rVerdict = '';
        if (rRoll) {
          const sign = rRoll.modifier >= 0 ? '+' : '';
          const rollExpr = `d20 [${rRoll.baseRoll ?? rRoll.total}]${sign}${rRoll.modifier ?? 0} = ${rRoll.total}`;
          const dc = room.targetDC || 12;
          rVerdict = rRoll.isCriticalSuccess
            ? `★ КРИТ. УСПЕХ (${rollExpr})`
            : rRoll.isCriticalFail
            ? `☠ КРИТ. ПРОВАЛ (${rollExpr})`
            : rRoll.total >= dc
            ? `★ УСПЕХ (${rollExpr} vs СЛ ${dc})`
            : `✗ ПРОВАЛ (${rollExpr} vs СЛ ${dc})`;
        }
        const typeBadge = r.responseType === 'negative' ? '⚔️ [Противодействие]' : (r.responseType === 'counter' ? '🛡️ [Защита/Парирование]' : '🤝 [Содействие]');
        return `   ↳ ${typeBadge} Реакция ${r.targetCharacterName}: «${r.reactionText || ''}»${rVerdict ? ` — ${rVerdict}` : ''}`;
      }).join('\n');
    }

    const formattedActionsSummary = `【${actingAction.characterName}】: «${actingAction.actionText}»${verdict ? `\n   ↳ ${verdict}` : ''}${reactionSummaryLines}${itemsLine}`;

    // Update active enemies from dmResult
    const updatedEnemies: RoomEnemy[] = Array.isArray(dmResult.activeEnemies)
      ? [...dmResult.activeEnemies]
      : [...(room.activeEnemies || [])];

    // Save Game Log
    const cleanRoundNarrative = sanitizeNarrativeText(dmResult.narrative);
    const newLog = this.gameLogs.create({
      id: crypto.randomUUID(),
      roomId: room.id,
      roundNumber: room.roundNumber,
      turnPlayerName: actingAction.characterName,
      narrativeText: cleanRoundNarrative,
      actionsSummary: formattedActionsSummary,
      currentSituation: dmResult.currentSituation,
      choiceDilemma: dmResult.choiceDilemma,
      targetDC: dmResult.nextRoundDC || room.targetDC,
      dcReason: dmResult.nextRoundDCReason || room.dcReason,
      requiredCheckStat: dmResult.requiredCheckStat || room.requiredCheckStat,
      droppedLoot: droppedLootItems.length > 0 ? droppedLootItems : undefined,
      playerUpdates: dmResult.playerUpdates?.map(u => {
        const c = this.characters.findById(u.characterId) ||
          activeCharacters.find(ch => ch.name.toLowerCase().trim() === (u.characterName || u.characterId || '').toLowerCase().trim());
        return {
          characterId: c?.id || u.characterId,
          characterName: c?.name || u.characterName || 'Герой',
          hpDelta: u.hpDelta,
          hpCurrent: c?.hpCurrent || 10,
          note: u.note,
        };
      }),
      createdAt: new Date().toISOString(),
    });

    // Determine turn order progression
    const order = (room.turnOrder && room.turnOrder.length > 0)
      ? room.turnOrder.filter(uid => targetPlayers.some(p => p.userId === uid))
      : targetPlayers.map(p => p.userId);

    const currentIndex = order.indexOf(actingUserId);
    const isLastInOrder = (currentIndex >= order.length - 1) || (currentIndex === -1);

    // Pre-warm neural TTS audio
    this.tts.synthesize(newLog.narrativeText, dmResult.mood || 'mystery').catch(err => {
      console.warn('Background turn TTS pre-warm failed:', err.message);
    });

    if (!isLastInOrder) {
      const nextActiveUserId = order[currentIndex + 1];
      this.rooms.update(room.id, {
        currentSituation: dmResult.currentSituation,
        targetDC: dmResult.nextRoundDC || room.targetDC,
        dcReason: dmResult.nextRoundDCReason || room.dcReason,
        requiredCheckStat: dmResult.requiredCheckStat || room.requiredCheckStat,
        activeEnemies: updatedEnemies,
        activePlayerUserId: nextActiveUserId,
        pendingReactions: [],
      });

      const updated = this.getRoomAndPlayers(room.code);
      return {
        log: newLog,
        room: updated!.room,
        players: updated!.players,
        isRoundComplete: false,
        nextActiveUserId,
        inventoryNotifications,
      };
    } else {
      // Last player in order: complete the round and advance to next round!
      const nextRound = room.roundNumber + 1;
      this.rooms.resetPlayersTurn(room.id);
      this.rooms.update(room.id, {
        roundNumber: nextRound,
        currentSituation: dmResult.currentSituation,
        targetDC: dmResult.nextRoundDC || room.targetDC,
        dcReason: dmResult.nextRoundDCReason || room.dcReason,
        requiredCheckStat: dmResult.requiredCheckStat || room.requiredCheckStat,
        activeEnemies: updatedEnemies,
        activePlayerUserId: order[0] || undefined,
        pendingReactions: [],
      });

      const updated = this.getRoomAndPlayers(room.code);
      return {
        log: newLog,
        room: updated!.room,
        players: updated!.players,
        isRoundComplete: true,
        nextRoundNumber: nextRound,
        inventoryNotifications,
      };
    }
  }

  public async resolveRound(roomId: string, completedReactions?: CharacterReactionRequest[]): Promise<RoundResolutionResult | null> {
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
      genre: room.genre,
      campaignDuration: room.campaignDuration,
      roundNumber: room.roundNumber,
      currentSituation: room.currentSituation,
      currentDC: room.targetDC,
      currentDCReason: room.dcReason,
      requiredCheckStat: room.requiredCheckStat,
      campaignPlot: room.campaignPlot,
      campaignMap: room.campaignMap,
      loreJournal: room.loreJournal,
      characters: activeCharacters,
      activeEnemies: room.activeEnemies || [],
      actions: currentRoundActions,
      previousHistory: previousLogs,
      characterReactions: completedReactions,
    };

    try {
      dmResult = await provider.generateRound(aiContext);
    } catch (err: any) {
      console.warn('Primary AI provider failed, seamlessly resolving with Procedural Narrative Engine:', err?.message || err);
      const fallback = new SimulationAIProvider();
      dmResult = await fallback.generateRound(aiContext);
    }

    // Handle Rejected Action if player's submission was critical absurdity
    if (dmResult.rejectedAction) {
      const rejectedCharName = (dmResult.rejectedAction.characterName || '').toLowerCase().trim();
      const offendingAction = currentRoundActions.find(a =>
        a.characterName.toLowerCase().trim().includes(rejectedCharName) ||
        rejectedCharName.includes(a.characterName.toLowerCase().trim())
      );

      if (offendingAction) {
        const playerRec = this.rooms.findPlayer(room.id, offendingAction.playerId);
        if (playerRec) {
          this.rooms.updatePlayer(playerRec.id, { hasActedThisRound: false });
        }
        this.turnActions.delete(offendingAction.id);
      } else {
        allPlayers.forEach(p => {
          this.rooms.updatePlayer(p.id, { hasActedThisRound: false });
        });
      }

      const updatedPlayers = this.rooms.findPlayersByRoomId(room.id);
      return {
        room,
        players: updatedPlayers,
        nextRoundNumber: room.roundNumber,
        rejectedAction: dmResult.rejectedAction,
      };
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

    // Track item activities per character to include in actions summary and feed
    const itemActivitiesByCharacter: Record<string, string[]> = {};
    const inventoryNotifications: InventoryNotification[] = [];

    // Process Dynamic Inventory Updates (items consumed, lost, broken or acquired)
    if (Array.isArray(dmResult.inventoryUpdates) && dmResult.inventoryUpdates.length > 0) {
      dmResult.inventoryUpdates.forEach(invUpdate => {
        const target = this.characters.findById(invUpdate.characterId) ||
          activeCharacters.find(c =>
            c.name.toLowerCase().trim() === (invUpdate.characterName || invUpdate.characterId || '').toLowerCase().trim() ||
            c.name.toLowerCase().includes((invUpdate.characterName || invUpdate.characterId || '').toLowerCase().trim())
          );

        if (target && invUpdate.item && typeof invUpdate.item.name === 'string' && invUpdate.item.name.trim()) {
          const cleanItemName = invUpdate.item.name.trim();
          if (!itemActivitiesByCharacter[target.id]) {
            itemActivitiesByCharacter[target.id] = [];
          }

          if (invUpdate.action === 'remove') {
            const reason = invUpdate.reason || `Израсходовано или утрачено в раунде ${room.roundNumber}`;
            this.characters.removeItemFromInventory(target.id, cleanItemName, invUpdate.item.quantity || 1, reason);
            itemActivitiesByCharacter[target.id].push(`Потрачено/утрачено: «${cleanItemName}» (${reason})`);
            inventoryNotifications.push({
              id: crypto.randomUUID(),
              characterId: target.id,
              characterName: target.name,
              action: 'remove',
              itemName: cleanItemName,
              quantity: invUpdate.item.quantity || 1,
              reason,
              timestamp: new Date().toISOString(),
            });
          } else if (invUpdate.action === 'add') {
            const reason = invUpdate.reason || (Array.isArray(invUpdate.item.history) && invUpdate.item.history.length > 0 ? invUpdate.item.history[0] : `Получено в раунде ${room.roundNumber}`);
            this.characters.addItemToInventory(target.id, {
              ...invUpdate.item,
              name: cleanItemName,
            }, reason);
            itemActivitiesByCharacter[target.id].push(`Получено: «${cleanItemName}» (${reason})`);
            inventoryNotifications.push({
              id: crypto.randomUUID(),
              characterId: target.id,
              characterName: target.name,
              action: 'add',
              itemName: cleanItemName,
              quantity: invUpdate.item.quantity || 1,
              reason,
              timestamp: new Date().toISOString(),
            });
          }
        }
      });
    }

    // Intelligent Fallback Heuristic: If player action or DM narrative mentioned using, breaking or losing an inventory item and AI omitted inventoryUpdates
    currentRoundActions.forEach(a => {
      const char = activeCharacters.find(c => c.id === a.characterId || c.name.toLowerCase().trim() === a.characterName.toLowerCase().trim());
      if (!char || !char.inventory) return;

      const actionLower = a.actionText.toLowerCase();
      const narrativeLower = (dmResult.narrative || '').toLowerCase();

      // Check for consumable usage (healing potion, scroll, bread/food)
      const consumeRegex = /(выпи(л|ть|ваю)|исцел(ил|ить|яю)|поит|леч(у|ил|ить)|передал|отдал|поделился|скормил|использ(овал|ую)|бросаю|метнул|зажёг)/i;
      // Check for broken item or theft
      const breakRegex = /(сломал(ся|ась)?|разбил(ся|ась)?|расколол(ся|ась)?|уничтожен|похищен|украл(и)?|среза(л|ли)|отобрал(и)?)/i;

      char.inventory.forEach(item => {
        if (!item || !item.name) return;
        const itemNameLower = item.name.toLowerCase().trim();
        if (itemNameLower.length < 3) return;

        const mentionedInAction = actionLower.includes(itemNameLower);
        const mentionedInNarrative = narrativeLower.includes(itemNameLower);

        // Check if already processed in dmResult.inventoryUpdates
        const alreadyProcessed = Array.isArray(dmResult.inventoryUpdates) && dmResult.inventoryUpdates.some(u =>
          (u.characterId === char.id || (u.characterName && u.characterName.toLowerCase() === char.name.toLowerCase())) &&
          u.item && u.item.name.toLowerCase().includes(itemNameLower)
        );

        if (!alreadyProcessed) {
          if (mentionedInAction && consumeRegex.test(actionLower) && (item.type === 'potion' || item.type === 'scroll' || item.type === 'food' || (item.healAmount && item.healAmount > 0))) {
            const reason = `Израсходовано в ходе заявки: «${item.name}»`;
            this.characters.removeItemFromInventory(char.id, item.id, 1, reason);
            if (!itemActivitiesByCharacter[char.id]) itemActivitiesByCharacter[char.id] = [];
            itemActivitiesByCharacter[char.id].push(`Использовано: «${item.name}» (${reason})`);
            inventoryNotifications.push({
              id: crypto.randomUUID(),
              characterId: char.id,
              characterName: char.name,
              action: 'remove',
              itemName: item.name,
              quantity: 1,
              reason,
              timestamp: new Date().toISOString(),
            });
          } else if ((mentionedInAction || mentionedInNarrative) && (breakRegex.test(actionLower) || breakRegex.test(narrativeLower))) {
            const reason = `Сломано или утрачено в ходе событий раунда ${room.roundNumber}`;
            this.characters.removeItemFromInventory(char.id, item.id, 1, reason);
            if (!itemActivitiesByCharacter[char.id]) itemActivitiesByCharacter[char.id] = [];
            itemActivitiesByCharacter[char.id].push(`Сломано/утрачено: «${item.name}» (${reason})`);
            inventoryNotifications.push({
              id: crypto.randomUUID(),
              characterId: char.id,
              characterName: char.name,
              action: 'remove',
              itemName: item.name,
              quantity: 1,
              reason,
              timestamp: new Date().toISOString(),
            });
          }
        }
      });
    });

    // Process Dropped Loot (strictly filtering out empty items)
    let droppedLootItems: RoomLootItem[] = [];
    if (Array.isArray(dmResult.droppedLoot) && dmResult.droppedLoot.length > 0) {
      droppedLootItems = dmResult.droppedLoot
        .filter(item => item && typeof item.name === 'string' && item.name.trim().length > 0)
        .map(item => ({
          id: crypto.randomUUID(),
          name: item.name.trim(),
          type: item.type || 'misc',
          description: item.description?.trim() || 'Предмет, найденный в бою',
          quantity: 1,
          damage: item.damage,
          ac_bonus: item.ac_bonus,
          healAmount: item.healAmount,
          roundDropped: room.roundNumber,
        }));
      if (droppedLootItems.length > 0) {
        this.rooms.addLoot(room.id, droppedLootItems);
      }
    }

    // Process Lore Journal Milestones (ensure rich, expanded chronicles including item drops, acquisitions, and usages)
    const itemMilestones: LoreMilestone[] = [];
    if (droppedLootItems.length > 0) {
      itemMilestones.push({
        id: crypto.randomUUID(),
        round: room.roundNumber,
        milestone: `📦 На поле боя обнаружены трофеи: ${droppedLootItems.map(i => `«${i.name}»`).join(', ')}.`,
      });
    }
    inventoryNotifications.forEach(notif => {
      if (notif.action === 'add') {
        itemMilestones.push({
          id: crypto.randomUUID(),
          round: room.roundNumber,
          milestone: `🎒 ${notif.characterName} находит/получает предмет: «${notif.itemName}» (${notif.reason || 'в ходе раунда'}).`,
        });
      } else if (notif.action === 'remove') {
        itemMilestones.push({
          id: crypto.randomUUID(),
          round: room.roundNumber,
          milestone: `🎒 ${notif.characterName} использует/теряет: «${notif.itemName}» (${notif.reason || 'израсходован или утрачен'}).`,
        });
      }
    });

    const rawMilestones = (Array.isArray(dmResult.newMilestones) && dmResult.newMilestones.length > 0)
      ? dmResult.newMilestones
      : [
          `Раунд ${room.roundNumber}: ${dmResult.currentSituation || 'Отряд преодолел очередное испытание.'}`
        ];
    const milestones: LoreMilestone[] = rawMilestones.map((m) => ({
      id: crypto.randomUUID(),
      round: room.roundNumber,
      milestone: m,
    }));
    this.rooms.addMilestones(room.id, [...milestones, ...itemMilestones]);

    // Award XP to active characters
    const xpToAward = dmResult.xpAwarded && dmResult.xpAwarded > 0 ? dmResult.xpAwarded : 25;
    activeCharacters.forEach(c => {
      this.characters.awardXp(c.id, xpToAward);
    });

    // Format Actions Summary with Player text, Roll math, DC/AC verdicts, and Item consumption/breakage
    let formattedActionsSummary = currentRoundActions.map(a => {
      const roll = a.diceRolls && a.diceRolls.length > 0 ? a.diceRolls[0] : null;
      let verdict = '';
      if (roll) {
        const sign = roll.modifier >= 0 ? '+' : '';
        const statLabel = roll.statName ? ` (${roll.statName.toUpperCase()})` : '';
        const rollExpr = `d20 [${roll.baseRoll ?? roll.total}]${sign}${roll.modifier ?? 0}${statLabel} = ${roll.total}`;

        const targetEnemy = room.activeEnemies?.find(e =>
          e.id === a.targetEnemyId || (a.targetEnemyName && e.name.toLowerCase().includes(a.targetEnemyName.toLowerCase()))
        );

        if (a.actionType === 'attack' || targetEnemy) {
          const ac = targetEnemy?.ac || 12;
          const enemyName = targetEnemy?.name || a.targetEnemyName || 'Враг';
          if (roll.isCriticalSuccess) {
            verdict = `★ КРИТИЧЕСКИЙ УСПЕХ! (${rollExpr} vs КБ ${ac} ${enemyName})`;
          } else if (roll.isCriticalFail) {
            verdict = `☠ КРИТИЧЕСКИЙ ПРОВАЛ! (${rollExpr} vs КБ ${ac} ${enemyName})`;
          } else if (roll.total >= ac) {
            verdict = `★ УСПЕХ (Попадание: ${rollExpr} vs КБ ${ac} ${enemyName})`;
          } else {
            verdict = `✗ ПРОВАЛ (Промах: ${rollExpr} vs КБ ${ac} ${enemyName})`;
          }
        } else {
          const dc = room.targetDC || 12;
          if (roll.isCriticalSuccess) {
            verdict = `★ КРИТИЧЕСКИЙ УСПЕХ! (${rollExpr} vs СЛ ${dc})`;
          } else if (roll.isCriticalFail) {
            verdict = `☠ КРИТИЧЕСКИЙ ПРОВАЛ! (${rollExpr} vs СЛ ${dc})`;
          } else if (roll.total >= dc) {
            verdict = `★ УСПЕХ (${rollExpr} vs СЛ ${dc})`;
          } else {
            verdict = `✗ ПРОВАЛ (${rollExpr} vs СЛ ${dc})`;
          }
        }
      }

      const itemActivities = itemActivitiesByCharacter[a.characterId];
      const itemsLine = itemActivities && itemActivities.length > 0
        ? `\n   🎒 [Инвентарь]: ${itemActivities.join('; ')}`
        : '';

      return `【${a.characterName}】: «${a.actionText}»${verdict ? `\n   ↳ ${verdict}` : ''}${itemsLine}`;
    }).join('\n\n');

    if (completedReactions && completedReactions.length > 0) {
      const reactionsText = '\n\n' + completedReactions.map(r => {
        const rRoll = r.reactionRoll;
        let rVerdict = '';
        if (rRoll) {
          const sign = rRoll.modifier >= 0 ? '+' : '';
          const rollExpr = `d20 [${rRoll.baseRoll ?? rRoll.total}]${sign}${rRoll.modifier ?? 0} = ${rRoll.total}`;
          const dc = room.targetDC || 12;
          rVerdict = rRoll.isCriticalSuccess
            ? `★ КРИТ. УСПЕХ (${rollExpr})`
            : rRoll.isCriticalFail
            ? `☠ КРИТ. ПРОВАЛ (${rollExpr})`
            : rRoll.total >= dc
            ? `★ УСПЕХ (${rollExpr} vs СЛ ${dc})`
            : `✗ ПРОВАЛ (${rollExpr} vs СЛ ${dc})`;
        }
        const typeBadge = r.responseType === 'negative' ? '⚔️ [Противодействие]' : (r.responseType === 'counter' ? '🛡️ [Защита/Парирование]' : '🤝 [Содействие]');
        return `【${r.targetCharacterName}】: ${typeBadge} «${r.reactionText || ''}»${rVerdict ? `\n   ↳ ${rVerdict}` : ''}`;
      }).join('\n\n');
      formattedActionsSummary += reactionsText;
    }

    // Save game log with sanitized narrative
    const cleanRoundNarrative = sanitizeNarrativeText(dmResult.narrative);
    const newLog = this.gameLogs.create({
      id: crypto.randomUUID(),
      roomId: room.id,
      roundNumber: room.roundNumber,
      narrativeText: cleanRoundNarrative,
      actionsSummary: formattedActionsSummary,
      currentSituation: dmResult.currentSituation,
      choiceDilemma: dmResult.choiceDilemma,
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

    const updatedEnemies: RoomEnemy[] = Array.isArray(dmResult.activeEnemies)
      ? [...dmResult.activeEnemies]
      : [...(room.activeEnemies || [])];

    // Safety Guard: Check for narrative-enemy desynchronization (STRICTLY for active combat only)
    const livingEnemies = updatedEnemies.filter(e => !e.isDead && e.hpCurrent > 0);
    const narrativeFullText = ((dmResult.narrative || '') + ' ' + (dmResult.currentSituation || '')).toLowerCase();
    const isCombatMood = dmResult.mood === 'combat';
    const isPeacefulOrSocial = ['social', 'mystery', 'calm', 'exploration', 'triumph'].includes(dmResult.mood || '');

    if (livingEnemies.length === 0 && isCombatMood && !isPeacefulOrSocial) {
      const hasCombatEnemyMention = /(?:гоблин|разбойник|бандит|культист|враг|противник|лучник|вожак|мутант|стрелок|мафиоз|гангстер|киборг|наёмник|чудовищ|тварь|паук).*(?:атаку|стреля|целит|надвига|замахи|выглядыва|рубит|бросает|окружа|огрыза|отбива)/i.test(narrativeFullText);

      if (hasCombatEnemyMention) {
        let enemyName = 'Противник в укрытии';
        if (/гоблин/i.test(narrativeFullText)) enemyName = 'Гоблин-стрелок';
        else if (/разбойник|бандит/i.test(narrativeFullText)) enemyName = 'Разбойник';
        else if (/лучник|стрелок/i.test(narrativeFullText)) enemyName = 'Вражеский стрелок';
        else if (/мафиоз|гангстер/i.test(narrativeFullText)) enemyName = 'Гангстер синдиката';
        else if (/киборг|наёмник/i.test(narrativeFullText)) enemyName = 'Корпоративный наёмник';
        else if (/культист/i.test(narrativeFullText)) enemyName = 'Адепт культа';
        else if (/мутант|чудовищ/i.test(narrativeFullText)) enemyName = 'Мутант';

        const fallbackEnemy: RoomEnemy = {
          id: `enemy_${crypto.randomUUID().slice(0, 6)}`,
          name: enemyName,
          type: 'minion',
          hpCurrent: 12,
          hpMax: 12,
          ac: 12,
          status: 'Ведёт бой, используя укрытия и окружение',
          isDead: false,
        };
        updatedEnemies.push(fallbackEnemy);
      }
    }

    // Process Condition Updates for Players and Enemies
    if (Array.isArray(dmResult.conditionUpdates) && dmResult.conditionUpdates.length > 0) {
      dmResult.conditionUpdates.forEach(update => {
        if (update.targetType === 'player' || update.targetType === 'character') {
          const target = this.characters.findById(update.targetId) ||
            activeCharacters.find(c =>
              c.name.toLowerCase().trim() === (update.targetName || update.targetId || '').toLowerCase().trim() ||
              c.name.toLowerCase().includes((update.targetName || update.targetId || '').toLowerCase().trim())
            );
          if (target) {
            const currentConditions = target.conditions || [];
            let nextConditions: string[];
            if (update.action === 'add') {
              nextConditions = Array.from(new Set([...currentConditions, update.condition]));
            } else {
              nextConditions = currentConditions.filter(c => c !== update.condition);
            }
            this.characters.updateConditions(target.id, nextConditions);
          }
        } else if (update.targetType === 'enemy') {
          const enemy = updatedEnemies.find(e =>
            e.id === update.targetId ||
            e.name.toLowerCase().trim() === (update.targetName || update.targetId || '').toLowerCase().trim() ||
            e.name.toLowerCase().includes((update.targetName || update.targetId || '').toLowerCase().trim())
          );
          if (enemy) {
            const currentConditions = enemy.conditions || [];
            if (update.action === 'add') {
              enemy.conditions = Array.from(new Set([...currentConditions, update.condition]));
            } else {
              enemy.conditions = currentConditions.filter(c => c !== update.condition);
            }
          }
        }
      });
    }

    const isFinished = !!(dmResult.campaignFinished && dmResult.campaignFinished.isFinished);

    this.rooms.update(room.id, {
      status: isFinished ? 'finished' : 'active',
      roundNumber: nextRound,
      currentSituation: dmResult.currentSituation || 'Что вы делаете дальше?',
      targetDC: nextDC,
      dcReason: nextDCReason,
      requiredCheckStat: nextCheckStat,
      activePlayerUserId: firstActiveUserId,
      campaignPlot: dmResult.campaignPlot || room.campaignPlot,
      activeEnemies: updatedEnemies,
      pendingReactions: [],
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
      inventoryNotifications,
    };
  }

  public pickupLoot(roomId: string, characterId: string, lootId: string) {
    const { room, item } = this.rooms.removeLoot(roomId, lootId);
    if (!room || !item || !item.name || !item.name.trim()) return null;
    const updatedChar = this.characters.addItemToInventory(characterId, item, `Подобран как боевой трофей в раунде ${room.roundNumber}.`);
    return { room: sanitizeRoom(room), character: updatedChar, item };
  }

  public useItem(characterId: string, itemId: string, targetName?: string) {
    return this.characters.useConsumableItem(characterId, itemId, targetName);
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

  public performShortRest(roomId: string, characterId: string, diceCount?: number) {
    const room = this.rooms.findById(roomId);
    if (room && room.activeEnemies && room.activeEnemies.some(e => !e.isDead && e.hpCurrent > 0)) {
      throw new Error('Нельзя отдыхать во время активного боя! Сначала одолейте противников.');
    }
    return this.characters.performShortRest(characterId, diceCount);
  }

  public performLongRest(roomId: string, characterId: string) {
    const room = this.rooms.findById(roomId);
    if (room && room.activeEnemies && room.activeEnemies.some(e => !e.isDead && e.hpCurrent > 0)) {
      throw new Error('Нельзя отдыхать во время активного боя! Сначала одолейте противников.');
    }
    return this.characters.performLongRest(characterId, room?.roundNumber);
  }

  public finishAdventure(
    roomId: string,
    finishType: 'cliffhanger' | 'triumph' | 'open_ended',
    title?: string,
    epilogue?: string
  ): { room: RoomEntity; log: GameLogEntity } | null {
    const room = this.rooms.findById(roomId);
    if (!room) return null;

    const finalTitle = title || (
      finishType === 'cliffhanger'
        ? 'Сессия завершена (Клиффхэнгер)'
        : finishType === 'triumph'
        ? 'Триумф Приключения: Великая Победа!'
        : 'Эпилог Приключения'
    );

    const defaultEpilogue = epilogue || (
      finishType === 'cliffhanger'
        ? 'Пыль битвы осела, но из тьмы впереди донесся леденящий душу рокот. Взоры искателей приключений устремлены во мрак... На этом напряженном моменте игровая сессия подходит к концу. Продолжение следует!'
        : finishType === 'triumph'
        ? 'Славный поход увенчался триумфальной победой! Враги повержены, зло рассеяно, а имена героев навеки вписаны в скрижали легенд этого мира!'
        : 'Приключение подошло к своему логическому завершению. Герои преодолели суровые испытания, но впереди их ждет бескрайний и полный неизведанных тайн мир.'
    );

    const updatedRoom = this.rooms.update(roomId, {
      status: 'finished',
      currentSituation: `${finalTitle}: ${defaultEpilogue}`,
    });
    if (!updatedRoom) return null;

    const epilogueLog: GameLogEntity = {
      id: crypto.randomUUID(),
      roomId: room.id,
      roundNumber: room.roundNumber,
      narrativeText: `📜 ${finalTitle.toUpperCase()}\n\n${defaultEpilogue}`,
      currentSituation: 'Приключение завершено',
      choiceDilemma: finishType === 'cliffhanger' ? 'Дожить до следующей сессии и приготовиться к развязке!' : 'Отпраздновать победу и подготовиться к новому модулю!',
      targetDC: undefined,
      requiredCheckStat: undefined,
      createdAt: new Date().toISOString(),
    };

    this.gameLogs.create(epilogueLog);

    return {
      room: updatedRoom,
      log: epilogueLog,
    };
  }
}

export const gameSessionService = new GameSessionService();
