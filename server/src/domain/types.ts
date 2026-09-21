import { CharacterEntity, TurnActionEntity, LoreMilestone, RoomLootItem, CharacterReactionRequest } from '../db';
export { CharacterReactionRequest };

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
}

export interface InventoryUpdate {
  characterId: string;
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
  characters: CharacterEntity[];
  activeEnemies?: RoomEnemy[];
  actions: TurnActionEntity[];
  previousHistory: string[];
  turnMode?: 'simultaneous' | 'turn_by_turn';
  turnPlayerName?: string;
  characterReactions?: CharacterReactionRequest[];
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
  inventoryUpdates?: InventoryUpdate[];
  conditionUpdates?: ConditionUpdate[];
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

