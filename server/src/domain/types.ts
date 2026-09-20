import { CharacterEntity, TurnActionEntity, LoreMilestone, RoomLootItem } from '../db';

export interface AIDMPrologueContext {
  apiKey?: string;
  model?: string;
  title: string;
  setting: string;
  characters: CharacterEntity[];
  campaignPlot?: string;
}

export interface AIDMContext {
  apiKey?: string;
  model?: string;
  setting: string;
  roundNumber: number;
  currentSituation: string;
  currentDC?: number;
  currentDCReason?: string;
  requiredCheckStat?: string;
  campaignPlot?: string;
  loreJournal?: LoreMilestone[];
  characters: CharacterEntity[];
  actions: TurnActionEntity[];
  previousHistory: string[];
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
  enemiesStatus?: string;
  mood?: 'combat' | 'tension' | 'mystery' | 'triumph' | 'calm' | 'neutral';
  nextRoundDC?: number;
  nextRoundDCReason?: string;
  requiredCheckStat?: string;
  campaignPlot?: string;
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
}

export type MoodType = 'combat' | 'tension' | 'mystery' | 'triumph' | 'calm' | 'neutral';
