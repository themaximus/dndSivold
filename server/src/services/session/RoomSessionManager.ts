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
import {
  RoomEntity,
  RoomPlayerEntity,
  CharacterEntity,
  CharacterReactionRequest,
  GameLogEntity,
} from '../../db';
import { AIDMPrologueContext, AIDMResponse } from '../../domain/types';
import { cryptoService, sanitizeRoom } from '../security/CryptoService';
import { AIProviderFactory, aiProviderFactory } from '../ai/AIProviderFactory';
import { SimulationAIProvider } from '../ai/SimulationAIProvider';
import { sceneEntityManager } from './SceneEntityManager';
import { narrativeSynthesizer } from './NarrativeSynthesizer';

export class RoomSessionManager {
  private rooms: IRoomRepository;
  private characters: ICharacterRepository;
  private turnActions: ITurnActionRepository;
  private gameLogs: IGameLogRepository;
  private aiFactory: AIProviderFactory;

  constructor(
    rooms: IRoomRepository = roomRepository,
    characters: ICharacterRepository = characterRepository,
    turnActions: ITurnActionRepository = turnActionRepository,
    gameLogs: IGameLogRepository = gameLogRepository,
    aiFactory: AIProviderFactory = aiProviderFactory
  ) {
    this.rooms = rooms;
    this.characters = characters;
    this.turnActions = turnActions;
    this.gameLogs = gameLogs;
    this.aiFactory = aiFactory;
  }

  public reconcileCharacterConditions(characterId: string, roomId?: string): CharacterEntity | null {
    const char = this.characters.findById(characterId);
    if (!char || !char.conditions || char.conditions.length === 0) return char || null;

    const isProne = (c: string) => /prone|ничком|сбит.*ног/i.test(c);
    if (char.conditions.some(isProne)) {
      const standUpRegex = /(вста(ю|ть|л|ла|ли|ем|йте)|поднима(юсь|ется|ться|лась|лся|лись)|на ноги|отряхива(юсь|ется|ясь|лась|лся)|подня(лся|лась|лись)|выпрям(ился|илась|иться))/i;
      let hasStoodUp = false;

      if (roomId) {
        const logs = this.gameLogs.findByRoomId(roomId);
        const charNameLower = char.name.toLowerCase();

        for (let i = logs.length - 1; i >= 0; i--) {
          const log = logs[i];
          const actSummaryLower = (log.actionsSummary || '').toLowerCase();
          const narrativeLower = (log.narrativeText || '').toLowerCase();

          if (
            (actSummaryLower.includes(charNameLower) || narrativeLower.includes(charNameLower)) &&
            /(сбит(ы)? с ног|пада(ет|ют|л|ла) ничком|опрокинут|грохается на землю)/i.test(narrativeLower)
          ) {
            break;
          }

          if (
            (actSummaryLower.includes(charNameLower) && standUpRegex.test(actSummaryLower)) ||
            (narrativeLower.includes(charNameLower) && standUpRegex.test(narrativeLower))
          ) {
            hasStoodUp = true;
            break;
          }
        }

        if (!hasStoodUp && logs.length > 0) {
          const lastRound = logs[logs.length - 1].roundNumber;
          const actions = this.turnActions.findByRoomAndRound(roomId, lastRound);
          const charActions = actions.filter(
            (a) => a.characterId === char.id || a.characterName.toLowerCase() === charNameLower
          );
          if (charActions.length > 0) {
            const lastAction = charActions[charActions.length - 1];
            if (standUpRegex.test(lastAction.actionText || '')) {
              hasStoodUp = true;
            }
          }
        }
      }

      if (hasStoodUp) {
        const updated = char.conditions.filter((c) => !isProne(c));
        this.characters.updateConditions(char.id, updated);
        return this.characters.findById(char.id) || null;
      }
    }

    return char;
  }

  public getRoomAndPlayers(roomCode: string) {
    const room = this.rooms.findByCode(roomCode);
    if (!room) return null;

    sceneEntityManager.ensureSceneEntities(room);
    sceneEntityManager.syncLegacyArrays(room);
    sceneEntityManager.buildSceneProjection(room);

    const players = this.rooms.findPlayersByRoomId(room.id);
    const playersWithCharacters = players.map((p) => {
      let character = p.characterId ? this.characters.findById(p.characterId) : undefined;
      if (character) {
        character = this.reconcileCharacterConditions(character.id, room.id) || character;
      }
      return {
        ...p,
        character,
      };
    });

    return {
      room: sanitizeRoom(room),
      players: playersWithCharacters,
    };
  }

  public joinRoom(
    roomCode: string,
    userId: string,
    username: string
  ): { room: RoomEntity; players: any[] } | { error: string } | null {
    const room = this.rooms.findByCode(roomCode);
    if (!room) return null;

    const existingPlayers = this.rooms.findPlayersByRoomId(room.id);
    let player = existingPlayers.find((p) => p.userId === userId);
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
      .map((p) => (p.characterId ? this.characters.findById(p.characterId) : undefined))
      .filter((c): c is CharacterEntity => !!c);

    const decryptedApiKey = cryptoService.decrypt(room.deepseekApiKey || '');
    const prologueContext: AIDMPrologueContext = {
      apiKey: decryptedApiKey,
      model: room.deepseekModel,
      title: room.title,
      setting: room.setting,
      genre: room.genre || 'fantasy',
      campaignDuration: room.campaignDuration || 'medium',
      characters: activeCharacters,
    };

    let synthResult: { response: AIDMResponse; audioUrl?: string };
    try {
      synthResult = await narrativeSynthesizer.synthesizePrologue(room, prologueContext);
    } catch (err: any) {
      console.warn('Neural prologue generation failed, falling back to simulation:', err?.message || err);
      const fallback = new SimulationAIProvider();
      const fallbackResponse = await fallback.generatePrologue(prologueContext);
      synthResult = { response: fallbackResponse };
    }

    const prologueResult = synthResult.response;
    const startDC = prologueResult.nextRoundDC || 12;
    const startDCReason = prologueResult.nextRoundDCReason || 'Оценка обстановки и первый решительный шаг';
    const startCheckStat = prologueResult.requiredCheckStat || 'dex';
    const campaignPlot =
      prologueResult.campaignPlot ||
      room.campaignPlot ||
      'Генеральная сюжетная арка: исследование тайны, нарастание угрозы, кульминация.';

    const partyPlayers = this.rooms.findPlayersByRoomId(room.id).filter((p) => p.characterId);
    const turnOrder = partyPlayers.map((p) => p.userId);

    this.rooms.update(room.id, {
      status: 'active',
      roundNumber: 1,
      currentSituation: prologueResult.currentSituation || 'Что предпринимает отряд?',
      targetDC: startDC,
      dcReason: startDCReason,
      requiredCheckStat: startCheckStat,
      campaignPlot,
      turnOrder,
      activePlayerUserId: room.turnMode === 'turn_by_turn' ? turnOrder[0] : undefined,
    });

    // Create initial log
    this.gameLogs.create({
      id: crypto.randomUUID(),
      roomId: room.id,
      roundNumber: 0,
      actionsSummary: 'Пролог: начало приключения',
      narrativeText: prologueResult.narrative,
      audioUrl: synthResult.audioUrl,
      currentSituation: prologueResult.currentSituation,
      choiceDilemma: prologueResult.choiceDilemma,
      mood: prologueResult.mood || 'mystery',
      targetDC: startDC,
      dcReason: startDCReason,
      requiredCheckStat: startCheckStat,
      playerUpdates: [],
      ruleViolations: [],
      createdAt: new Date().toISOString(),
    });

    this.rooms.resetPlayersTurn(room.id);
    return this.getRoomAndPlayers(room.code);
  }

  public detectCharacterMentions(
    actionText: string,
    roomId: string,
    actingUserId: string
  ): Array<{ userId: string; characterId: string; characterName: string }> {
    const players = this.rooms.findPlayersByRoomId(roomId);
    const mentions: Array<{ userId: string; characterId: string; characterName: string }> = [];
    const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    for (const player of players) {
      if (player.userId === actingUserId || !player.characterId) continue;
      if (player.isOnline === false) continue;

      const character = this.characters.findById(player.characterId);
      if (!character || !character.name) continue;
      if (character.lifeState === 'dead' || character.hpCurrent <= 0) continue;

      const charName = character.name.trim();
      const nameLower = charName.toLowerCase();
      const endsInVowel = /[аяиыеоую]$/i.test(nameLower);
      const stem =
        charName.length >= 3 && endsInVowel
          ? nameLower.slice(0, -1)
          : charName.length >= 5
          ? nameLower.slice(0, -1)
          : nameLower;

      const namePattern = new RegExp(
        `(?<=^|[^\\p{L}\\p{N}])(?:${escapeRegex(nameLower)}|${escapeRegex(stem)}(?:[а-яё]{1,3})?)(?=[^\\p{L}\\p{N}]|$)`,
        'iu'
      );

      const usernamePattern = player.username
        ? new RegExp(`(?<=^|[^\\p{L}\\p{N}])(?:@?${escapeRegex(player.username.toLowerCase())})(?=[^\\p{L}\\p{N}]|$)`, 'iu')
        : null;

      if (namePattern.test(actionText) || (usernamePattern ? usernamePattern.test(actionText) : false)) {
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

    const mentionedCharacters = this.detectCharacterMentions(actionText, room.id, userId);
    let pendingReactions: CharacterReactionRequest[] = [];

    if (mentionedCharacters.length > 0) {
      pendingReactions = mentionedCharacters.map((m) => ({
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
    const playersWithChar = allPlayers.filter((p) => p.characterId);
    const onlineActive = playersWithChar.filter((p) => p.isOnline);
    const targetPlayers = onlineActive.length > 0 ? onlineActive : playersWithChar;

    let shouldResolveRound = false;
    let nextActiveUserId: string | undefined;

    if (room.turnMode === 'turn_by_turn') {
      const order =
        room.turnOrder && room.turnOrder.length > 0
          ? room.turnOrder.filter((uid) => targetPlayers.some((p) => p.userId === uid))
          : targetPlayers.map((p) => p.userId);

      const currentIndex = order.indexOf(userId);
      const nextIndex = currentIndex + 1;

      if (nextIndex < order.length) {
        nextActiveUserId = order[nextIndex];
      } else {
        shouldResolveRound = true;
      }
    } else {
      const readyPlayers = targetPlayers.filter((p) => p.hasActedThisRound);
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
    const targetReq = currentReactions.find((r) => r.id === reactionRequestId && r.targetUserId === userId);
    if (!targetReq) return null;

    const updatedReactions = currentReactions.map((r) => {
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
    const allCompleted = updatedReactions.every((r) => r.status === 'completed' || r.status === 'skipped');
    const completedReactions = updatedReactions.filter((r) => r.status === 'completed');

    const allPlayers = this.rooms.findPlayersByRoomId(room.id);
    const playersWithChar = allPlayers.filter((p) => p.characterId);
    const onlineActive = playersWithChar.filter((p) => p.isOnline);
    const targetPlayers = onlineActive.length > 0 ? onlineActive : playersWithChar;
    const readyPlayers = targetPlayers.filter((p) => p.hasActedThisRound);
    const shouldResolveRound =
      room.turnMode === 'simultaneous' && targetPlayers.length > 0 && readyPlayers.length === targetPlayers.length;

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
    const targetReq = currentReactions.find((r) => r.id === reactionRequestId);
    if (!targetReq) return null;

    if (userId !== room.hostUserId && userId !== targetReq.initiatorUserId && userId !== targetReq.targetUserId) {
      return null;
    }

    const updatedReactions = currentReactions.map((r) => {
      if (r.id === reactionRequestId) {
        return { ...r, status: 'skipped' as const };
      }
      return r;
    });

    const updatedRoom = this.rooms.update(room.id, { pendingReactions: updatedReactions }) || room;
    const allCompleted = updatedReactions.every((r) => r.status === 'completed' || r.status === 'skipped');
    const completedReactions = updatedReactions.filter((r) => r.status === 'completed');

    const allPlayers = this.rooms.findPlayersByRoomId(room.id);
    const playersWithChar = allPlayers.filter((p) => p.characterId);
    const onlineActive = playersWithChar.filter((p) => p.isOnline);
    const targetPlayers = onlineActive.length > 0 ? onlineActive : playersWithChar;
    const readyPlayers = targetPlayers.filter((p) => p.hasActedThisRound);
    const shouldResolveRound =
      room.turnMode === 'simultaneous' && targetPlayers.length > 0 && readyPlayers.length === targetPlayers.length;

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

  public setTurnMode(roomId: string, mode: 'simultaneous' | 'turn_by_turn') {
    const room = this.rooms.findById(roomId);
    if (!room) return null;
    const allPlayers = this.rooms.findPlayersByRoomId(roomId).filter((p) => p.characterId);
    const turnOrder = allPlayers.map((p) => p.userId);
    const activePlayerUserId = mode === 'turn_by_turn' ? turnOrder[0] || undefined : undefined;
    const updated = this.rooms.update(roomId, {
      turnMode: mode,
      turnOrder,
      activePlayerUserId,
    });
    return updated ? sanitizeRoom(updated) : null;
  }

  public finishAdventure(
    roomId: string,
    finishType: 'cliffhanger' | 'triumph' | 'open_ended',
    title?: string,
    epilogue?: string
  ): { room: RoomEntity; log: GameLogEntity } | null {
    const room = this.rooms.findById(roomId);
    if (!room) return null;

    const finalTitle =
      title ||
      (finishType === 'cliffhanger'
        ? 'Кульминация на лезвии бритвы'
        : finishType === 'triumph'
        ? 'Триумфальное завершение похода'
        : 'Эпилог: Новые горизонты');

    const finalNarrative =
      epilogue ||
      (finishType === 'cliffhanger'
        ? 'В самый неожиданный момент земля содрогнулась, и тьма сгустилась над горизонтом...'
        : finishType === 'triumph'
        ? 'Отряд одержал великую победу, их имена будут воспеты в балладах!'
        : 'Приключение завершилось, но впереди героев ждет еще множество неизведанных дорог.');

    const updatedRoom = this.rooms.update(room.id, {
      status: 'finished',
    });

    const finalLog = this.gameLogs.create({
      id: crypto.randomUUID(),
      roomId: room.id,
      roundNumber: (room.roundNumber || 1) + 1,
      actionsSummary: `Финал приключения: ${finalTitle}`,
      narrativeText: finalNarrative,
      currentSituation: 'Приключение официально завершено.',
      playerUpdates: [],
      ruleViolations: [],
      createdAt: new Date().toISOString(),
    });

    return {
      room: updatedRoom || room,
      log: finalLog,
    };
  }
}

export const roomSessionManager = new RoomSessionManager();
