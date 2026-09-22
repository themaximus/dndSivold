import { RoomSessionManager, roomSessionManager } from './RoomSessionManager';
import { TurnExecutionPipeline, turnExecutionPipeline } from './TurnExecutionPipeline';
import { SceneEntityManager, sceneEntityManager } from './SceneEntityManager';
import { InventoryLedgerService, inventoryLedgerService } from './InventoryLedgerService';
import { CharacterProgressionService, characterProgressionService } from './CharacterProgressionService';
import { ActionIntentEngine, actionIntentEngine } from './ActionIntentEngine';
import { NarrativeSynthesizer, narrativeSynthesizer } from './NarrativeSynthesizer';
import { QuestArbiter, questArbiter } from '../game/QuestArbiter';
import { RoomTransactionMutex, roomTransactionMutex } from './RoomTransactionMutex';
import { SessionAuditLogger, sessionAuditLogger } from '../logging/SessionAuditLogger';
import { MechanicalArbiter, mechanicalArbiter } from '../game/MechanicalArbiter';
import { SocialArbiter, socialArbiter } from '../game/SocialArbiter';

/**
 * Registry map of all domain and session services.
 */
export interface SessionServiceMap {
  roomSessionManager: RoomSessionManager;
  turnExecutionPipeline: TurnExecutionPipeline;
  sceneEntityManager: SceneEntityManager;
  inventoryLedgerService: InventoryLedgerService;
  characterProgressionService: CharacterProgressionService;
  actionIntentEngine: ActionIntentEngine;
  narrativeSynthesizer: NarrativeSynthesizer;
  questArbiter: QuestArbiter;
  roomTransactionMutex: RoomTransactionMutex;
  sessionAuditLogger: SessionAuditLogger;
  mechanicalArbiter: MechanicalArbiter;
  socialArbiter: SocialArbiter;
}

/**
 * ServiceLocator / SystemLocator
 *
 * Implements the Service Locator pattern according to OOP and Single Responsibility principles.
 * Decouples micro-services, facilitates modular testing and mocking, and provides
 * a clean, central registry for session orchestration.
 */
export class ServiceLocator {
  private services: Map<keyof SessionServiceMap, any> = new Map();

  constructor() {
    this.registerDefaults();
  }

  /**
   * Registers default singleton implementations.
   */
  public registerDefaults(): void {
    this.services.set('roomSessionManager', roomSessionManager);
    this.services.set('turnExecutionPipeline', turnExecutionPipeline);
    this.services.set('sceneEntityManager', sceneEntityManager);
    this.services.set('inventoryLedgerService', inventoryLedgerService);
    this.services.set('characterProgressionService', characterProgressionService);
    this.services.set('actionIntentEngine', actionIntentEngine);
    this.services.set('narrativeSynthesizer', narrativeSynthesizer);
    this.services.set('questArbiter', questArbiter);
    this.services.set('roomTransactionMutex', roomTransactionMutex);
    this.services.set('sessionAuditLogger', sessionAuditLogger);
    this.services.set('mechanicalArbiter', mechanicalArbiter);
    this.services.set('socialArbiter', socialArbiter);
  }

  /**
   * Registers or overrides a service by key.
   */
  public register<K extends keyof SessionServiceMap>(key: K, service: SessionServiceMap[K]): void {
    this.services.set(key, service);
  }

  /**
   * Retrieves a strongly-typed service instance.
   */
  public get<K extends keyof SessionServiceMap>(key: K): SessionServiceMap[K] {
    const service = this.services.get(key);
    if (!service) {
      throw new Error(`[ServiceLocator] Service '${String(key)}' is not registered.`);
    }
    return service;
  }

  /**
   * Checks if a service is registered.
   */
  public has<K extends keyof SessionServiceMap>(key: K): boolean {
    return this.services.has(key);
  }

  /**
   * Resets all services to their default singletons (useful for test isolation).
   */
  public reset(): void {
    this.services.clear();
    this.registerDefaults();
  }
}

// Global Singleton instances
export const serviceLocator = new ServiceLocator();
export const systemLocator = serviceLocator;

// Type alias
export type SystemLocator = ServiceLocator;
