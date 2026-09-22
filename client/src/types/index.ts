export interface User {
  id: string;
  username: string;
}

export interface CharacterStats {
  str: number;
  dex: number;
  con: number;
  int: number;
  wis: number;
  cha: number;
}

export interface CharacterAbility {
  id: string;
  name: string;
  type: 'action' | 'spell' | 'bonus' | 'passive';
  description: string;
  cost?: string;
  damage?: string;
  range?: string;
}

export interface InventoryItem {
  id: string;
  name: string;
  type: 'weapon' | 'armor' | 'potion' | 'scroll' | 'food' | 'misc';
  description: string;
  quantity: number;
  damage?: string;
  ac_bonus?: number;
  healAmount?: number;
  history?: string[];
}

export interface Character {
  id: string;
  userId: string;
  name: string;
  race: string;
  characterClass: string;
  level: number;
  hpCurrent: number;
  hpMax: number;
  ac: number;
  stats: CharacterStats;
  skills: string[];
  abilities: CharacterAbility[];
  inventory: InventoryItem[];
  bio: string;
  avatarUrl: string;
  lifeState?: 'alive' | 'downed' | 'dead';
  deathSaves?: {
    successes: number;
    failures: number;
    isStable?: boolean;
  };
  xp?: number;
  skillPoints?: number;
  learnedTalents?: string[];
  activeWeaponId?: string;
  conditions?: string[];
  hitDiceMax?: number;
  hitDiceCurrent?: number;
  hitDiceType?: string;
  spellSlots?: Record<string, { current: number; max: number }>;
  shortRestsCount?: number;
  lastLongRestRound?: number;
  createdAt?: string;
}

export interface RoomPlayer {
  id: string;
  roomId: string;
  userId: string;
  username: string;
  characterId?: string;
  character?: Character;
  isReady: boolean;
  hasActedThisRound: boolean;
  hasRolledThisRound?: boolean;
  pendingRoll?: any;
  isOnline: boolean;
}

export interface LoreMilestone {
  id: string;
  round: number;
  milestone: string;
  imageUrl?: string;
  tags?: string[];
  timestamp?: string;
}

export interface RoomLootItem {
  id: string;
  name: string;
  type: 'weapon' | 'armor' | 'potion' | 'misc';
  description: string;
  quantity: number;
  damage?: string;
  ac_bonus?: number;
  healAmount?: number;
  roundDropped: number;
}

export interface TalentNode {
  id: string;
  name: string;
  description: string;
  tier: 1 | 2 | 3;
  cost: number;
  branch: 'class' | 'race' | 'quenta';
  icon?: string;
  effects: {
    hpBonus?: number;
    acBonus?: number;
    statBonus?: {
      stat: 'str' | 'dex' | 'con' | 'int' | 'wis' | 'cha';
      amount: number;
    };
    newAbility?: {
      name: string;
      type: 'action' | 'spell' | 'bonus' | 'passive';
      description: string;
    };
  };
}

export interface CharacterTalentTree {
  classBranch: { name: string; talents: TalentNode[] };
  raceBranch: { name: string; talents: TalentNode[] };
  quentaBranch: { name: string; talents: TalentNode[] };
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

export interface RoomEnemy {
  id: string;
  name: string;
  type?: 'boss' | 'elite' | 'minion' | 'monster' | 'beast' | 'undead' | string;
  hpCurrent: number;
  hpMax: number;
  ac?: number;
  conditions?: string[];
  status: string;
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

export interface CharacterReactionRequest {
  id: string;
  initiatorUserId: string;
  initiatorCharacterName: string;
  initiatorActionText: string;
  initiatorRoll?: any;
  targetUserId: string;
  targetCharacterId: string;
  targetCharacterName: string;
  status: 'pending' | 'completed' | 'skipped';
  reactionText?: string;
  reactionRoll?: any;
  responseType?: 'positive' | 'negative' | 'counter';
  createdAt: string;
}

export type EntityFaction = 'party' | 'allied' | 'neutral' | 'hostile';
export type EntityCombatRole = 'hostile_threat' | 'ally_combatant' | 'neutral_observer' | 'bystander' | 'hiding' | 'fled';
export type EntityLifecycle = 'active' | 'hiding' | 'departed' | 'defeated' | 'unconscious' | 'archived';

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

export type EnvironmentObjectState =
  | 'operational'
  | 'broken'
  | 'locked'
  | 'in_progress'
  | 'depleted'
  | 'hazardous';

export interface EnvironmentObjectEntity {
  id: string;
  roomId: string;
  key: string;
  name: string;
  state: EnvironmentObjectState;
  isOperational: boolean;
  physicalBlocker?: string;
  requiredPrerequisites: string[];
  progressStage: {
    current: number;
    max: number;
    currentStageText: string;
  };
  interactableActions: string[];
  narrativeNotes?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface SpatialEntitySnapshot {
  entityId: string;
  canonicalName: string;
  role?: string;
  faction: string;
  combatRole: string;
  lifecycle: string;
  hpCurrent: number;
  hpMax: number;
  ac?: number;
  status: string;
  conditions: string[];
  leftAtRound: number;
  heldItems?: string[];
  narrativeStateNote?: string;
}

export interface SpatialZoneEntity {
  id: string;
  roomId: string;
  zoneKey: string;
  name: string;
  description?: string;
  isCurrent: boolean;
  firstVisitedRound: number;
  lastVisitedRound: number;
  leftEntities: SpatialEntitySnapshot[];
  environmentObjects?: EnvironmentObjectEntity[];
  searchedObjects?: SearchedObjectEntry[];
  threatsPresent?: string[];
}

export interface VehicleManifest {
  vehicleKey: string;
  driverName?: string;
  passengerNames: string[];
}

export interface SceneProjectionViewModel {
  threats: ProjectedEntityView[];
  allies: ProjectedEntityView[];
  sceneNPCs: ProjectedEntityView[];
  searchedObjects: SearchedObjectEntry[];
  worldArchive: WorldNPCEntry[];
  environmentObjects?: EnvironmentObjectEntity[];
  currentZoneName?: string;
  spatialZones?: SpatialZoneEntity[];
  activeCombat: boolean;
  currentSituation: string;
  choiceDilemma?: string;
  mood?: string;
  roomDC?: number;
  roomDCReason?: string;
}

export interface Room {
  id: string;
  code: string;
  hostUserId: string;
  title: string;
  setting: string;
  genre?: string;
  campaignDuration?: 'short' | 'medium' | 'long';
  campaignMap?: CampaignMapData;
  status: 'waiting' | 'active' | 'finished';
  roundNumber: number;
  currentSituation: string;
  hasDeepSeekKey: boolean;
  targetDC?: number;
  dcReason?: string;
  requiredCheckStat?: string;
  campaignPlot?: string;
  turnMode?: 'simultaneous' | 'turn_by_turn';
  activePlayerUserId?: string;
  turnOrder?: string[];
  activeEnemies?: RoomEnemy[];
  sceneNPCs?: RoomNPC[];
  loreJournal?: LoreMilestone[];
  availableLoot?: RoomLootItem[];
  pendingReactions?: CharacterReactionRequest[];
  itemLedger?: ItemLedgerEntry[];
  worldNPCRegistry?: WorldNPCEntry[];
  worldQuests?: QuestEntity[];
  searchedObjectsRegistry?: SearchedObjectEntry[];
  environmentObjects?: EnvironmentObjectEntity[];
  currentZoneKey?: string;
  spatialZones?: SpatialZoneEntity[];
  vehicleManifest?: VehicleManifest;
  sceneProjection?: SceneProjectionViewModel;
  sceneEntities?: any[];
  createdAt: string;
}

export interface SearchedObjectEntry {
  id: string;
  roomId: string;
  targetKey: string;
  targetName: string;
  targetType: 'vehicle' | 'container' | 'room' | 'corpse' | 'cache' | 'environment';
  status: 'searched' | 'exhausted' | 'empty';
  searchedInRound: number;
  searchedByCharacterName?: string;
  extractedItems: string[];
  narrativeNote?: string;
  timestamp: string;
}

export type QuestStatus = 'active' | 'completed' | 'failed' | 'abandoned';
export type QuestCategory = 'main' | 'side' | 'task' | 'repair' | 'investigation' | 'social';

export interface QuestEntity {
  id: string;
  roomId: string;
  title: string;
  description: string;
  category: QuestCategory;
  status: QuestStatus;
  giverName?: string;
  targetName?: string;
  roundCreated: number;
  roundCompleted?: number;
  resolutionNote?: string;
  createdAt: string;
  updatedAt: string;
}

export type ItemLifecycleStatus = 'in_inventory' | 'broken' | 'consumed' | 'dropped';

export interface ItemLedgerEntry {
  id: string;
  characterId: string;
  itemId: string;
  itemName: string;
  status: ItemLifecycleStatus;
  statusReason?: string;
  roundChanged?: number;
  timestamp: string;
}

export interface WorldNPCEntry {
  id: string;
  roomId: string;
  name: string;
  role: string;
  originalType: 'npc' | 'enemy';
  departureReason: 'fled' | 'departed' | 'defeated' | 'unconscious' | 'left_behind' | 'location_transition' | string;
  departureRound: number;
  finalStatus?: string;
  affinity: number;
  disposition?: NPCDisposition;
  notes: string[];
  narrativeNote?: string;
  potentialHooks?: string[];
  reinstated?: boolean;
  reinstatedRound?: number;
}

export interface UserRoomSummary {
  id: string;
  code: string;
  title: string;
  setting: string;
  genre?: string;
  campaignDuration?: 'short' | 'medium' | 'long';
  campaignMap?: CampaignMapData;
  status: 'waiting' | 'active' | 'finished';
  roundNumber: number;
  currentSituation: string;
  isHost: boolean;
  playerCount: number;
  maxPlayers: number;
  myPlayer?: {
    id: string;
    username: string;
    isReady: boolean;
    hasActedThisRound: boolean;
  };
  myCharacter?: {
    id: string;
    name: string;
    characterClass: string;
    race: string;
    level: number;
    hpCurrent: number;
    hpMax: number;
    avatarUrl: string;
  };
  createdAt: string;
}

export interface DiceRollResult {
  diceType: string; // 'd20', 'd6', etc.
  rolls: number[];
  modifier: number;
  statName?: string;
  total: number;
  isCriticalSuccess: boolean;
  isCriticalFail: boolean;
  purpose: string; // e.g., 'Атака мечом', 'Проверка внимательности'
  baseRoll?: number;
  breakdown?: string;
}

export interface ConditionUpdate {
  targetId: string;
  targetName?: string;
  targetType: 'character' | 'player' | 'enemy';
  action: 'add' | 'remove';
  condition: string;
  reason?: string;
}

export interface RestResult {
  type: 'short' | 'long';
  characterId: string;
  characterName: string;
  healedHp: number;
  diceSpent?: number;
  rolls?: number[];
}

export interface TurnAction {
  id: string;
  playerId: string;
  characterName: string;
  actionText: string;
  diceRolls: DiceRollResult[];
  actionType?: 'attack' | 'check' | 'save' | 'improvise';
  targetEnemyId?: string;
  targetEnemyName?: string;
  advantage?: boolean;
  disadvantage?: boolean;
  spellLevelUsed?: number;
  submittedAt: string;
}

export interface GameLogEntry {
  id: string;
  roomId: string;
  roundNumber: number;
  turnPlayerName?: string;
  narrativeText: string;
  imageUrl?: string;
  actionsSummary?: string;
  targetDC?: number;
  dcReason?: string;
  requiredCheckStat?: string;
  droppedLoot?: RoomLootItem[];
  playerUpdates?: {
    characterId: string;
    characterName: string;
    hpDelta: number;
    hpCurrent: number;
    note: string;
  }[];
  currentSituation?: string;
  choiceDilemma?: string;
  createdAt: string;
}

export interface FeedActivity {
  id: string;
  type: 'item_used' | 'weapon_equipped' | 'rest' | 'loot_pickup' | 'route_selected' | 'turn_action' | 'player_action' | string;
  text: string;
  timestamp: string;
}

export interface ActionRejectedEvent {
  characterName: string;
  reason: string;
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

export interface RoomRollBroadcast {
  id: string;
  playerId: string;
  username: string;
  characterName: string;
  roll: DiceRollResult;
}
