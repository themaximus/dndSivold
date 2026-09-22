import {
  CharacterEntity,
  TurnActionEntity,
  LoreMilestone,
  RoomLootItem,
  CharacterReactionRequest,
  QuestEntity,
  WorldNPCEntry,
  SearchedObjectEntry,
  SearchedObjectType,
  EnvironmentObjectEntity,
  EnvironmentObjectState,
} from '../db';
export {
  CharacterReactionRequest,
  QuestEntity,
  WorldNPCEntry,
  SearchedObjectEntry,
  SearchedObjectType,
  EnvironmentObjectEntity,
  EnvironmentObjectState,
};

export type EntityFaction = 'party' | 'allied' | 'neutral' | 'hostile';
export type EntityCombatRole = 'hostile_threat' | 'ally_combatant' | 'neutral_observer' | 'bystander' | 'hiding' | 'fled';
export type EntityLifecycle = 'active' | 'hiding' | 'departed' | 'defeated' | 'unconscious' | 'archived';

/**
 * Universal authoritative Scene Entity.
 * Single source of truth for all creatures, NPCs, enemies and interactive actors in the scene.
 * Identified by an immutable UUID (entityId).
 */
export interface SceneEntity {
  entityId: string;                     // Immutable UUID (e.g. ent_1234abcd-...)
  canonicalName: string;                // Primary display name
  aliases: string[];                    // Known names, grammatical variations, and speech references
  entityType: 'creature' | 'npc' | 'interactive_object' | 'boss';
  faction: EntityFaction;               // Determines base loyalty
  combatRole: EntityCombatRole;         // Stance in combat
  lifecycle: EntityLifecycle;           // Active, hiding, departed, etc.
  stats: {
    hpCurrent: number;
    hpMax: number;
    ac: number;
    conditions: string[];
    willpower?: number;
    willpowerMax?: number;
  };
  role?: string;                        // Flavor title (e.g. "Караванщик", "Посланник графской стражи")
  status: string;                       // Dynamic narrative summary of what the entity is currently doing
  disposition?: NPCDisposition;
  location?: {
    roomId: string;
    zoneId?: string;                    // Dungeon room, campsite, crossroads, etc.
  };
  narrativeNotes?: string[];
  metadata?: Record<string, any>;
  createdAt?: string;
  updatedAt?: string;
}

/**
 * Thin Client Projected Entity View.
 * Clean, computed projection sent to frontend. No regex heuristics needed on client.
 */
export interface ProjectedEntityView {
  entityId: string;
  name: string;
  role?: string;
  type?: string;
  faction: EntityFaction;
  combatRole: EntityCombatRole;
  lifecycle: EntityLifecycle;
  hpCurrent: number;
  hpMax: number;
  ac?: number;
  status: string;
  conditions: string[];
  isDead: boolean;
  willpower?: number;
  willpowerMax?: number;
  disposition?: NPCDisposition;
  affinity?: number;
}

/**
 * Server-projected ViewModel for the thin client.
 */
export interface SceneProjectionViewModel {
  threats: ProjectedEntityView[];        // Hostile combatants in active battle
  allies: ProjectedEntityView[];         // Allies fighting alongside the party
  sceneNPCs: ProjectedEntityView[];      // Neutral, peaceful, or bystander NPCs
  searchedObjects: SearchedObjectEntry[];// Containers / vehicles / rooms with "searched" status
  worldArchive: WorldNPCEntry[];         // Departed / historical NPCs
  environmentObjects?: EnvironmentObjectEntity[]; // Interactive environment objects (vehicles, gates, etc.)
  activeCombat: boolean;
  currentSituation: string;
  choiceDilemma?: string;
  mood?: MoodType;
  roomDC?: number;
  roomDCReason?: string;
}

/**
 * Structured intent classification produced by ActionIntentEngine.
 * Eliminates fragile regex matching on raw player text.
 */
export type ActionIntentClass =
  | 'combat_attack'
  | 'heal_assist'
  | 'social_influence'
  | 'investigate_search'
  | 'defensive_guard'
  | 'flee_retreat'
  | 'environment_interaction'
  | 'rest_recovery'
  | 'general_action';

export interface ActionIntentDTO {
  actorUserId: string;
  actorCharacterId: string;
  actorCharacterName: string;
  intentClass: ActionIntentClass;
  actionText: string;
  spokenDialogue: string[];
  physicalAction: string;
  isPureSpeech: boolean;
  targetEntityId?: string;              // Resolved exact UUID from SceneEntityManager!
  targetEntityName?: string;
  targetObjectKey?: string;             // Resolved searched object key
  usedItemId?: string;                  // Resolved item ID from character inventory
  usedItemName?: string;
  confidence: number;
}


export interface CampaignMapNode {
  id: string;
  title: string;
  description: string;
  act: number;
  type: 'start' | 'battle' | 'mystery' | 'boss' | 'climax' | 'rest';
  status: 'visited' | 'current' | 'discovered' | 'locked';
  x: number; // 0-100 percentage
  y: number; // 0-100 percentage
}

export interface CampaignMapEdge {
  from: string;
  to: string;
}

export interface CampaignMapData {
  nodes: CampaignMapNode[];
  edges: CampaignMapEdge[];
  currentNodeId: string;
}

export interface AIDMPrologueContext {
  apiKey?: string;
  model?: string;
  title: string;
  setting: string;
  genre?: string;
  campaignDuration?: 'short' | 'medium' | 'long';
  characters: CharacterEntity[];
  campaignPlot?: string;
  sceneNPCs?: RoomNPC[];
}

export interface ConditionUpdate {
  targetId: string;
  targetName?: string;
  targetType: 'character' | 'player' | 'enemy';
  action: 'add' | 'remove';
  condition: 'prone' | 'poisoned' | 'restrained' | 'frightened' | 'stunned' | 'cover_half' | 'cover_three_quarters' | string;
  reason?: string;
}

export interface RoomEnemy {
  id: string;
  name: string;
  type?: 'boss' | 'elite' | 'minion' | 'monster' | 'beast' | 'undead' | string;
  hpCurrent: number;
  hpMax: number;
  ac?: number;
  status: string;
  conditions?: string[];
  isDead: boolean;
  willpower?: number;     // 0 - 100%
  willpowerMax?: number;  // 100%
}

export type NPCDisposition = 'friendly' | 'neutral' | 'cautious' | 'offended' | 'frightened' | 'hostile';
export type NPCCombatRole = 'ally_combatant' | 'neutral_observer' | 'hiding' | 'fled';

export interface RoomNPC {
  id: string;
  name: string;
  role: string; // e.g. "Купец", "Стражник", "Следопыт", "Раненый гонец"
  hpCurrent: number;
  hpMax: number;
  ac?: number;
  disposition: NPCDisposition;
  combatRole: NPCCombatRole;
  status: string; // e.g. "Стреляет из арбалета по гоблинам", "Прячется под телегой"
  conditions?: string[];
  isDead: boolean;
  affinity?: number;
  trustNotes?: string[];
  lastActionVerdict?: string;
  willpower?: number;     // 0 - 100%
  willpowerMax?: number;  // 100%
}

export interface InventoryUpdate {
  characterId?: string;
  characterName?: string;
  action: 'add' | 'remove';
  reason?: string;
  item: {
    name: string;
    quantity?: number;
    type?: 'weapon' | 'armor' | 'potion' | 'misc';
    description?: string;
    damage?: string;
    healAmount?: number;
    ac_bonus?: number;
    history?: string[];
  };
}

export interface InventoryNotification {
  id: string;
  characterId: string;
  characterName: string;
  action: 'add' | 'remove';
  itemName: string;
  quantity: number;
  reason: string;
  timestamp: string;
}

export interface QuestUpdate {
  title: string;
  description?: string;
  category?: 'main' | 'side' | 'task' | 'repair' | 'investigation' | 'social';
  action: 'add' | 'complete' | 'fail';
  resolutionNote?: string;
}

export interface AIDMContext {
  apiKey?: string;
  model?: string;
  setting: string;
  genre?: string;
  campaignDuration?: 'short' | 'medium' | 'long';
  roundNumber: number;
  currentSituation: string;
  currentDC?: number;
  currentDCReason?: string;
  requiredCheckStat?: string;
  campaignPlot?: string;
  campaignMap?: CampaignMapData;
  loreJournal?: LoreMilestone[];
  availableLoot?: RoomLootItem[];
  characters: CharacterEntity[];
  activeEnemies?: RoomEnemy[];
  sceneNPCs?: RoomNPC[];
  actions: TurnActionEntity[];
  previousHistory: string[];
  turnMode?: 'simultaneous' | 'turn_by_turn';
  turnPlayerName?: string;
  characterReactions?: CharacterReactionRequest[];
  mechanicalDirectives?: Record<string, string>;
  activeQuests?: QuestEntity[];
  completedQuests?: QuestEntity[];
  searchedObjects?: SearchedObjectEntry[];
  worldNPCRegistry?: WorldNPCEntry[];
  environmentObjects?: EnvironmentObjectEntity[];
}

export interface DepartedNPCEntry {
  name: string;
  reason: 'left_behind' | 'departed' | 'fled' | 'defeated' | 'location_transition' | string;
  narrativeNote?: string;
}

export interface SearchedObjectUpdate {
  targetName: string;
  targetType: SearchedObjectType;
  extractedItems?: string[];
  narrativeNote?: string;
}

export interface EnvironmentObjectUpdate {
  key: string;
  stageDelta?: number;
  newStage?: number;
  isOperational?: boolean;
  state?: EnvironmentObjectState;
  narrativeNote?: string;
}

export interface PlayerHpUpdate {
  characterId: string;
  hpDelta: number;
  note: string;
  characterName?: string;
  hpCurrent?: number;
}

export interface AIDMResponse {
  narrative: string;
  playerUpdates: PlayerHpUpdate[];
  currentSituation: string;
  choiceDilemma?: string;
  enemiesStatus?: string;
  activeEnemies?: RoomEnemy[];
  sceneNPCs?: RoomNPC[];
  departedNPCs?: DepartedNPCEntry[];
  searchedObjectUpdates?: SearchedObjectUpdate[];
  environmentObjectUpdates?: EnvironmentObjectUpdate[];
  inventoryUpdates?: InventoryUpdate[];
  conditionUpdates?: ConditionUpdate[];
  questUpdates?: QuestUpdate[];
  ruleViolations?: string[];
  mood?: MoodType;
  nextRoundDC?: number;
  nextRoundDCReason?: string;
  requiredCheckStat?: string;
  campaignPlot?: string;
  campaignMap?: CampaignMapData;
  droppedLoot?: Array<{
    name: string;
    type: 'weapon' | 'armor' | 'potion' | 'misc';
    description: string;
    damage?: string;
    ac_bonus?: number;
    healAmount?: number;
  }>;
  newMilestones?: string[];
  xpAwarded?: number;
  rejectedAction?: {
    characterName: string;
    reason: string;
  };
  campaignFinished?: {
    isFinished: boolean;
    finishType: 'triumph' | 'cliffhanger' | 'open_ended';
    title: string;
    epilogue: string;
  };
}

export type MoodType = 'combat' | 'tension' | 'mystery' | 'triumph' | 'calm' | 'neutral' | 'social' | 'exploration';

