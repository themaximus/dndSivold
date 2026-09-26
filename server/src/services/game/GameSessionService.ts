import {
  CharacterEntity,
  CharacterReactionRequest,
  RoomEntity,
  RoomPlayerEntity,
  GameLogEntity,
} from '../../db';
import { InventoryNotification } from '../../domain/types';
import {
  roomSessionManager,
  RoomSessionManager,
} from '../session/RoomSessionManager';
import {
  turnExecutionPipeline,
  TurnExecutionPipeline,
  RoundResolutionResult,
  TurnStepResolutionResult,
} from '../session/TurnExecutionPipeline';
import {
  inventoryLedgerService,
  InventoryLedgerService,
} from '../session/InventoryLedgerService';
import {
  characterProgressionService,
  CharacterProgressionService,
} from '../session/CharacterProgressionService';
import {
  sceneEntityManager,
  SceneEntityManager,
  extractSearchTokens,
} from '../session/SceneEntityManager';
import { sanitizeNarrativeText } from '../session/NarrativeSynthesizer';

import { ServiceLocator, systemLocator, SystemLocator } from '../session/ServiceLocator';

export { sanitizeNarrativeText, RoundResolutionResult, TurnStepResolutionResult, ServiceLocator, systemLocator, SystemLocator };

/**
 * Backward-compatible entity comparison helper.
 * Compares IDs, exact/normalized names, number suffixes, and Russian word stems.
 */
export function isSameEntity(
  a?: { id?: string; name?: string; role?: string; type?: string },
  b?: { id?: string; name?: string; role?: string; type?: string }
): boolean {
  if (!a || !b) return false;
  if (a.id && b.id && a.id === b.id) return true;

  const nameA = (a.name || '').trim();
  const nameB = (b.name || '').trim();
  if (!nameA && !nameB) return false;

  const normA = nameA.toLowerCase().replace(/[.,/#!$%^&*;:{}=\-_`~()]/g, ' ').trim();
  const normB = nameB.toLowerCase().replace(/[.,/#!$%^&*;:{}=\-_`~()]/g, ' ').trim();
  if (normA && normA === normB) return true;

  // Numeric distinction: "Бандит 1" vs "Бандит 2" must never match
  const numA = normA.match(/\b(\d+)\b/);
  const numB = normB.match(/\b(\d+)\b/);
  if (numA && numB && numA[1] !== numB[1]) return false;

  const tokensA = extractSearchTokens(normA);
  const tokensB = extractSearchTokens(normB);

  for (const tA of tokensA) {
    for (const tB of tokensB) {
      if (tA === tB || (tA.length >= 4 && tB.length >= 4 && (tA.includes(tB) || tB.includes(tA)))) {
        return true;
      }
    }
  }

  return false;
}

/**
 * GameSessionService (Thin Facade)
 *
 * Exposes a unified API delegating to specialized micro-domain services via SystemLocator:
 * - RoomSessionManager: Room lifecycle, players, character selection, turn modes.
 * - TurnExecutionPipeline: Atomic turn & round execution, AI synthesis, state persistence.
 * - InventoryLedgerService: Loot pickups, consumables, ledger durability, searched containers.
 * - CharacterProgressionService: Death saves, short/long rests, progression trees.
 * - SceneEntityManager: Universal UUID tracking, alias resolution, scene projection.
 */
export class GameSessionService {
  private locator: ServiceLocator;

  constructor(
    sessionManagerOrLocator?: RoomSessionManager | ServiceLocator,
    executionPipeline?: TurnExecutionPipeline,
    inventoryService?: InventoryLedgerService,
    progressionService?: CharacterProgressionService,
    entityManager?: SceneEntityManager
  ) {
    if (sessionManagerOrLocator instanceof ServiceLocator) {
      this.locator = sessionManagerOrLocator;
    } else {
      this.locator = systemLocator;
      if (sessionManagerOrLocator) this.locator.register('roomSessionManager', sessionManagerOrLocator);
      if (executionPipeline) this.locator.register('turnExecutionPipeline', executionPipeline);
      if (inventoryService) this.locator.register('inventoryLedgerService', inventoryService);
      if (progressionService) this.locator.register('characterProgressionService', progressionService);
      if (entityManager) this.locator.register('sceneEntityManager', entityManager);
    }
  }

  public get sessionManager(): RoomSessionManager {
    return this.locator.get('roomSessionManager');
  }

  public get executionPipeline(): TurnExecutionPipeline {
    return this.locator.get('turnExecutionPipeline');
  }

  public get inventoryService(): InventoryLedgerService {
    return this.locator.get('inventoryLedgerService');
  }

  public get progressionService(): CharacterProgressionService {
    return this.locator.get('characterProgressionService');
  }

  public get entityManager(): SceneEntityManager {
    return this.locator.get('sceneEntityManager');
  }

  public getLocator(): ServiceLocator {
    return this.locator;
  }

  // --- Session & Room Lifecycle ---

  public reconcileCharacterConditions(characterId: string, roomId?: string): CharacterEntity | null {
    return this.sessionManager.reconcileCharacterConditions(characterId, roomId);
  }

  public getRoomAndPlayers(roomCode: string) {
    return this.sessionManager.getRoomAndPlayers(roomCode);
  }

  public joinRoom(roomCode: string, userId: string, username: string) {
    return this.sessionManager.joinRoom(roomCode, userId, username);
  }

  public setPlayerOnline(roomId: string, userId: string, isOnline: boolean) {
    return this.sessionManager.setPlayerOnline(roomId, userId, isOnline);
  }

  public canForceResolve(roomId: string, hostUserId: string): boolean {
    return this.sessionManager.canForceResolve(roomId, hostUserId);
  }

  public selectCharacter(roomId: string, userId: string, characterId: string) {
    return this.sessionManager.selectCharacter(roomId, userId, characterId);
  }

  public async startGame(roomId: string, hostUserId: string) {
    return this.sessionManager.startGame(roomId, hostUserId);
  }

  public detectCharacterMentions(actionText: string, roomId: string, actingUserId: string) {
    return this.sessionManager.detectCharacterMentions(actionText, roomId, actingUserId);
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
    return this.sessionManager.submitAction(roomCode, userId, actionText, diceRolls, meta);
  }

  public submitReaction(
    roomCode: string,
    userId: string,
    reactionRequestId: string,
    reactionText: string,
    reactionRoll: any,
    responseType?: 'positive' | 'negative' | 'counter'
  ) {
    return this.sessionManager.submitReaction(
      roomCode,
      userId,
      reactionRequestId,
      reactionText,
      reactionRoll,
      responseType
    );
  }

  public skipReaction(roomCode: string, userId: string, reactionRequestId: string) {
    return this.sessionManager.skipReaction(roomCode, userId, reactionRequestId);
  }

  public setTurnMode(roomId: string, mode: 'simultaneous' | 'turn_by_turn') {
    return this.sessionManager.setTurnMode(roomId, mode);
  }

  public finishAdventure(
    roomId: string,
    finishType: 'cliffhanger' | 'triumph' | 'open_ended',
    title?: string,
    epilogue?: string
  ) {
    return this.sessionManager.finishAdventure(roomId, finishType, title, epilogue);
  }

  // --- Turn & Round Execution ---

  public async resolveTurnStep(
    roomId: string,
    actingUserId: string,
    completedReactions?: CharacterReactionRequest[]
  ): Promise<TurnStepResolutionResult | null> {
    return this.executionPipeline.resolveTurnStep(roomId, actingUserId, completedReactions);
  }

  public async resolveRound(
    roomId: string,
    completedReactions?: CharacterReactionRequest[]
  ): Promise<RoundResolutionResult | null> {
    return this.executionPipeline.resolveRound(roomId, completedReactions);
  }

  // --- Inventory & Items ---

  public pickupLoot(roomId: string, characterId: string, lootId: string) {
    return this.inventoryService.pickupLoot(roomId, characterId, lootId);
  }

  public useItem(characterId: string, itemId: string, targetName?: string) {
    return this.inventoryService.useItem(characterId, itemId, targetName);
  }

  public equipWeapon(characterId: string, itemId: string) {
    return this.inventoryService.equipWeapon(characterId, itemId);
  }

  public equipShield(characterId: string, itemId: string) {
    return this.inventoryService.equipShield(characterId, itemId);
  }

  public equipArmor(characterId: string, itemId: string) {
    return this.inventoryService.equipArmor(characterId, itemId);
  }

  // --- Character Progression & Rests ---

  public rollDeathSave(
    characterId: string,
    rollRequest: { rollTotal: number; isNat20: boolean; isNat1: boolean }
  ) {
    return this.progressionService.rollDeathSave(characterId, rollRequest);
  }

  public getCharacterTalents(characterId: string) {
    return this.progressionService.getCharacterTalents(characterId);
  }

  public learnTalent(characterId: string, talentId: string) {
    return this.progressionService.learnTalent(characterId, talentId);
  }

  public performShortRest(roomId: string, characterId: string, diceCount?: number) {
    return this.progressionService.performShortRest(roomId, characterId, diceCount);
  }

  public performLongRest(roomId: string, characterId: string) {
    return this.progressionService.performLongRest(roomId, characterId);
  }
}

export const gameSessionService = new GameSessionService();
