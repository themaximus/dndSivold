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
import { EpisodicMemoryCompressor, episodicMemoryCompressor } from '../ai/EpisodicMemoryCompressor';
import { StreamingAIService, streamingAIService } from '../ai/StreamingAIService';
import { SceneAffordanceService, sceneAffordanceService } from './SceneAffordanceService';
import { db } from '../../db';

/**
 * Registry map of all domain and session services.
 */
export interface SessionServiceMap {
  database: typeof db;
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
  episodicMemoryCompressor: EpisodicMemoryCompressor;
  streamingAIService: StreamingAIService;
  sceneAffordanceService: SceneAffordanceService;
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
  private factories: Map<keyof SessionServiceMap, () => any> = new Map();

  constructor() {
    this.registerDefaults();
  }

  /**
   * Registers default singleton factories lazily.
   */
  public registerDefaults(): void {
    this.factories.set('database', () => db);
    this.factories.set('roomSessionManager', () => roomSessionManager);
    this.factories.set('turnExecutionPipeline', () => turnExecutionPipeline);
    this.factories.set('sceneEntityManager', () => sceneEntityManager);
    this.factories.set('inventoryLedgerService', () => inventoryLedgerService);
    this.factories.set('characterProgressionService', () => characterProgressionService);
    this.factories.set('actionIntentEngine', () => actionIntentEngine);
    this.factories.set('narrativeSynthesizer', () => narrativeSynthesizer);
    this.factories.set('questArbiter', () => questArbiter);
    this.factories.set('roomTransactionMutex', () => roomTransactionMutex);
    this.factories.set('sessionAuditLogger', () => sessionAuditLogger);
    this.factories.set('mechanicalArbiter', () => mechanicalArbiter);
    this.factories.set('socialArbiter', () => socialArbiter);
    this.factories.set('episodicMemoryCompressor', () => episodicMemoryCompressor);
    this.factories.set('streamingAIService', () => streamingAIService);
    this.factories.set('sceneAffordanceService', () => sceneAffordanceService);
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
    if (this.services.has(key)) {
      return this.services.get(key);
    }
    const factory = this.factories.get(key);
    if (factory) {
      const instance = factory();
      this.services.set(key, instance);
      return instance;
    }
    throw new Error(`[ServiceLocator] Service '${String(key)}' is not registered.`);
  }

  /**
   * Checks if a service is registered.
   */
  public has<K extends keyof SessionServiceMap>(key: K): boolean {
    return this.services.has(key) || this.factories.has(key);
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
