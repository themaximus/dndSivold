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
import { ITTSService, ttsService } from '../tts/TTSService';
import { RoomEntity, RoomPlayerEntity, GameLogEntity, CharacterEntity, RoomLootItem, LoreMilestone } from '../../db';
import { talentTreeGenerator } from '../progression/TalentTreeGenerator';

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

    return { room, players: populatedPlayers };
  }

  public joinRoom(roomCode: string, userId: string, username: string) {
    const room = this.rooms.findByCode(roomCode);
    if (!room) return null;

    let player = this.rooms.findPlayer(room.id, userId);
    if (!player) {
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

  public startGame(roomId: string, hostUserId: string) {
    const room = this.rooms.findById(roomId);
    if (!room || room.hostUserId !== hostUserId) return null;

    this.rooms.update(room.id, {
      status: 'active',
      roundNumber: 1,
      targetDC: room.targetDC || 12,
      dcReason: room.dcReason || 'Оценка обстановки и первый шаг в неизвестность',
    });

    // Create prologue log
    this.gameLogs.create({
      id: crypto.randomUUID(),
      roomId: room.id,
      roundNumber: 0,
      narrativeText: room.currentSituation || 'Приключение начинается!',
      createdAt: new Date().toISOString(),
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

    this.rooms.updatePlayer(player.id, { hasActedThisRound: true });

    const allPlayers = this.rooms.findPlayersByRoomId(room.id);
    const activePlayers = allPlayers.filter(p => p.characterId);
    const readyPlayers = activePlayers.filter(p => p.hasActedThisRound);
    const shouldResolveRound = activePlayers.length > 0 && readyPlayers.length === activePlayers.length;

    return {
      room,
      player,
      characterName: charName,
      shouldResolveRound,
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
    const provider = this.aiFactory.getProvider(room.deepseekApiKey, room.deepseekModel);
    const dmResult = await provider.generateRound({
      apiKey: room.deepseekApiKey,
      model: room.deepseekModel,
      setting: room.setting,
      roundNumber: room.roundNumber,
      currentSituation: room.currentSituation,
      currentDC: room.targetDC,
      currentDCReason: room.dcReason,
      loreJournal: room.loreJournal,
      characters: activeCharacters,
      actions: currentRoundActions,
      previousHistory: previousLogs,
    });

    // Apply player updates (HP changes)
    if (Array.isArray(dmResult.playerUpdates)) {
      dmResult.playerUpdates.forEach(update => {
        this.characters.updateHp(update.characterId, update.hpDelta || 0);
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
      const milestones: LoreMilestone[] = dmResult.newMilestones.map(m => ({
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
      droppedLoot: droppedLootItems.length > 0 ? droppedLootItems : undefined,
      playerUpdates: dmResult.playerUpdates?.map(u => {
        const c = this.characters.findById(u.characterId);
        return {
          characterId: u.characterId,
          characterName: c?.name || 'Герой',
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

    this.rooms.update(room.id, {
      roundNumber: nextRound,
      currentSituation: dmResult.currentSituation || 'Что вы делаете дальше?',
      targetDC: nextDC,
      dcReason: nextDCReason,
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
    return { room, character: updatedChar, item };
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
}

export const gameSessionService = new GameSessionService();
