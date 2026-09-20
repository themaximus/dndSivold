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
  type: 'weapon' | 'armor' | 'potion' | 'misc';
  description: string;
  quantity: number;
  damage?: string;
  ac_bonus?: number;
  healAmount?: number;
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
  isOnline: boolean;
}

export interface LoreMilestone {
  id: string;
  round: number;
  milestone: string;
  tags?: string[];
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

export interface Room {
  id: string;
  code: string;
  hostUserId: string;
  title: string;
  setting: string;
  status: 'waiting' | 'active' | 'finished';
  roundNumber: number;
  currentSituation: string;
  hasDeepSeekKey: boolean;
  targetDC?: number;
  dcReason?: string;
  loreJournal?: LoreMilestone[];
  availableLoot?: RoomLootItem[];
  createdAt: string;
}

export interface UserRoomSummary {
  id: string;
  code: string;
  title: string;
  setting: string;
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
}

export interface TurnAction {
  id: string;
  playerId: string;
  characterName: string;
  actionText: string;
  diceRolls: DiceRollResult[];
  submittedAt: string;
}

export interface GameLogEntry {
  id: string;
  roomId: string;
  roundNumber: number;
  narrativeText: string;
  actionsSummary?: string;
  targetDC?: number;
  dcReason?: string;
  droppedLoot?: RoomLootItem[];
  playerUpdates?: {
    characterId: string;
    characterName: string;
    hpDelta: number;
    hpCurrent: number;
    note: string;
  }[];
  createdAt: string;
}
