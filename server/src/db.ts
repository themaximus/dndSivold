import fs from 'fs';
import path from 'path';
import { config } from './config';

export interface UserEntity {
  id: string;
  username: string;
  passwordHash: string;
  createdAt: string;
}

export interface CharacterEntity {
  id: string;
  userId: string;
  name: string;
  race: string;
  characterClass: string;
  level: number;
  hpCurrent: number;
  hpMax: number;
  ac: number;
  stats: {
    str: number;
    dex: number;
    con: number;
    int: number;
    wis: number;
    cha: number;
  };
  skills: string[];
  abilities: {
    id: string;
    name: string;
    type: 'action' | 'spell' | 'bonus' | 'passive';
    description: string;
    damage?: string;
    range?: string;
  }[];
  inventory: {
    id: string;
    name: string;
    type: 'weapon' | 'armor' | 'potion' | 'scroll' | 'food' | 'misc';
    description: string;
    quantity: number;
    damage?: string;
    ac_bonus?: number;
    healAmount?: number;
    history?: string[];
  }[];
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
  createdAt: string;
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

export interface RoomEnemy {
  id: string;
  name: string;
  type?: string;
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
  role: string;
  hpCurrent: number;
  hpMax: number;
  ac?: number;
  disposition: NPCDisposition;
  combatRole: NPCCombatRole;
  status: string;
  conditions?: string[];
  isDead: boolean;
  affinity?: number;
  trustNotes?: string[];
  lastActionVerdict?: string;
  willpower?: number;     // 0 - 100%
  willpowerMax?: number;  // 100%
}

export type ItemLifecycleStatus =
  | 'in_inventory'
  | 'equipped'
  | 'dropped_on_ground'
  | 'consumed'
  | 'broken'
  | 'destroyed'
  | 'lost'
  | 'transferred';

export interface ItemLedgerEntry {
  id: string;
  roomId?: string;
  characterId?: string;
  characterName?: string;
  itemId: string;
  itemName: string;
  itemType: 'weapon' | 'armor' | 'potion' | 'scroll' | 'food' | 'misc';
  status: ItemLifecycleStatus;
  quantity: number;
  lastRound: number;
  reason: string;
  timestamp: string;
}

export interface WorldNPCEntry {
  id: string;
  roomId: string;
  name: string;
  role: string;
  hpCurrent: number;
  hpMax: number;
  ac?: number;
  disposition: NPCDisposition;
  affinity: number; // -100 .. +100
  status: string;
  combatRole: NPCCombatRole;
  notes: string[];
  departureRound: number;
  departureReason: string;
  lastKnownLocation?: string;
  narrativeNote?: string;
  potentialHooks: string[];
  returnedInRound?: number;
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

export type QuestStatus = 'active' | 'completed' | 'failed';
export type QuestCategory = 'main' | 'side' | 'task' | 'repair' | 'investigation' | 'social';

export interface QuestEntity {
  id: string;
  roomId: string;
  title: string;
  description: string;
  category: QuestCategory;
  status: QuestStatus;
  roundCreated: number;
  roundCompleted?: number;
  giverName?: string;
  targetName?: string;
  resolutionNote?: string;
  createdAt: string;
  updatedAt: string;
}

export type SearchedObjectType = 'vehicle' | 'container' | 'room' | 'corpse' | 'cache' | 'environment' | 'other';

export interface SearchedObjectEntry {
  id: string;
  roomId: string;
  targetKey: string;
  targetName: string;
  targetType: SearchedObjectType;
  status: 'searched' | 'exhausted' | 'empty';
  searchedInRound: number;
  searchedByCharacterName?: string;
  extractedItems: string[];
  narrativeNote?: string;
  timestamp: string;
}

export interface RoomEntity {
  id: string;
  code: string;
  hostUserId: string;
  title: string;
  setting: string;
  status: 'waiting' | 'active' | 'finished';
  roundNumber: number;
  currentSituation: string;
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
  genre?: string;
  campaignDuration?: 'short' | 'medium' | 'long';
  campaignMap?: any;
  deepseekApiKey?: string;
  deepseekModel?: string;
  createdAt: string;
}

export interface RoomPlayerEntity {
  id: string;
  roomId: string;
  userId: string;
  username: string;
  characterId?: string;
  isReady: boolean;
  hasActedThisRound: boolean;
  hasRolledThisRound?: boolean;
  pendingRoll?: any;
  isOnline: boolean;
  joinedAt: string;
}

export interface TurnActionEntity {
  id: string;
  roomId: string;
  roundNumber: number;
  playerId: string;
  characterId: string;
  characterName: string;
  actionText: string;
  actionType?: 'attack' | 'check' | 'save' | 'improvise';
  targetEnemyId?: string;
  targetEnemyName?: string;
  advantage?: boolean;
  disadvantage?: boolean;
  spellLevelUsed?: number;
  diceRolls: any[];
  submittedAt: string;
}

export interface GameLogEntity {
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
  mood?: string;
  createdAt: string;
}

interface DatabaseSchema {
  users: UserEntity[];
  characters: CharacterEntity[];
  rooms: RoomEntity[];
  roomPlayers: RoomPlayerEntity[];
  turnActions: TurnActionEntity[];
  gameLogs: GameLogEntity[];
  itemLedgers: ItemLedgerEntry[];
  worldNPCs: WorldNPCEntry[];
  worldQuests: QuestEntity[];
  searchedObjects: SearchedObjectEntry[];
}

class Database {
  private filePath: string;
  private data: DatabaseSchema = {
    users: [],
    characters: [],
    rooms: [],
    roomPlayers: [],
    turnActions: [],
    gameLogs: [],
    itemLedgers: [],
    worldNPCs: [],
    worldQuests: [],
    searchedObjects: [],
  };

  constructor() {
    this.filePath = path.join(config.dataDir, 'database.json');
    this.init();
  }

  private init() {
    if (!fs.existsSync(config.dataDir)) {
      fs.mkdirSync(config.dataDir, { recursive: true });
    }

    const repoDefaultPath = path.resolve(__dirname, '../../data/database.default.json');
    const defaultPath = fs.existsSync(repoDefaultPath)
      ? repoDefaultPath
      : path.join(config.dataDir, 'database.default.json');

    if (fs.existsSync(this.filePath)) {
      try {
        const raw = fs.readFileSync(this.filePath, 'utf-8');
        this.data = JSON.parse(raw);
        this.data.itemLedgers = this.data.itemLedgers || [];
        this.data.worldNPCs = this.data.worldNPCs || [];
        this.data.worldQuests = this.data.worldQuests || [];
        this.data.searchedObjects = this.data.searchedObjects || [];
      } catch (err) {
        console.error('Failed to parse database.json, initializing empty db', err);
        this.save();
      }
    } else {
      if (fs.existsSync(defaultPath)) {
        try {
          fs.copyFileSync(defaultPath, this.filePath);
          const raw = fs.readFileSync(this.filePath, 'utf-8');
          this.data = JSON.parse(raw);
          this.data.itemLedgers = this.data.itemLedgers || [];
          this.data.worldNPCs = this.data.worldNPCs || [];
          this.data.worldQuests = this.data.worldQuests || [];
          this.data.searchedObjects = this.data.searchedObjects || [];
        } catch (err) {
          console.error('Failed to initialize from database.default.json, creating empty db', err);
          this.save();
        }
      } else {
        this.save();
      }
    }
  }

  public save() {
    try {
      const tempPath = `${this.filePath}.tmp`;
      const jsonStr = JSON.stringify(this.data, null, 2);
      fs.writeFileSync(tempPath, jsonStr, 'utf-8');
      fs.renameSync(tempPath, this.filePath);

      // Also mirror to repository default file if different, so git deployments preserve latest state
      const repoDefaultPath = path.resolve(__dirname, '../../data/database.default.json');
      if (repoDefaultPath !== this.filePath && fs.existsSync(path.dirname(repoDefaultPath))) {
        try {
          fs.writeFileSync(repoDefaultPath, jsonStr, 'utf-8');
        } catch (e) {
          // ignore in environments with restricted permissions
        }
      }
    } catch (err) {
      console.error('Database write error:', err);
    }
  }

  // Users
  public users = {
    findById: (id: string) => this.data.users.find(u => u.id === id),
    findByUsername: (username: string) =>
      this.data.users.find(u => u.username.toLowerCase() === username.toLowerCase()),
    create: (user: UserEntity) => {
      this.data.users.push(user);
      this.save();
      return user;
    },
  };

  // Characters
  public characters = {
    findById: (id: string) => this.data.characters.find(c => c.id === id),
    findByUserId: (userId: string) => this.data.characters.filter(c => c.userId === userId),
    create: (char: CharacterEntity) => {
      this.data.characters.push(char);
      this.save();
      return char;
    },
    update: (id: string, updates: Partial<CharacterEntity>) => {
      const idx = this.data.characters.findIndex(c => c.id === id);
      if (idx !== -1) {
        this.data.characters[idx] = { ...this.data.characters[idx], ...updates };
        this.save();
        return this.data.characters[idx];
      }
      return null;
    },
    delete: (id: string, userId: string) => {
      const initialLen = this.data.characters.length;
      this.data.characters = this.data.characters.filter(c => !(c.id === id && c.userId === userId));
      this.save();
      return this.data.characters.length < initialLen;
    }
  };

  // Rooms
  public rooms = {
    getAll: () => [...this.data.rooms],
    findById: (id: string) => this.data.rooms.find(r => r.id === id),
    findByCode: (code: string) => this.data.rooms.find(r => r.code.toUpperCase() === code.toUpperCase()),
    create: (room: RoomEntity) => {
      this.data.rooms.push(room);
      this.save();
      return room;
    },
    update: (id: string, updates: Partial<RoomEntity>) => {
      const idx = this.data.rooms.findIndex(r => r.id === id);
      if (idx !== -1) {
        this.data.rooms[idx] = { ...this.data.rooms[idx], ...updates };
        this.save();
        return this.data.rooms[idx];
      }
      return null;
    },
  };

  // Room Players
  public roomPlayers = {
    findByUserId: (userId: string) => this.data.roomPlayers.filter(rp => rp.userId === userId),
    findByRoomId: (roomId: string) => this.data.roomPlayers.filter(rp => rp.roomId === roomId),
    findPlayer: (roomId: string, userId: string) =>
      this.data.roomPlayers.find(rp => rp.roomId === roomId && rp.userId === userId),
    create: (player: RoomPlayerEntity) => {
      this.data.roomPlayers.push(player);
      this.save();
      return player;
    },
    update: (id: string, updates: Partial<RoomPlayerEntity>) => {
      const idx = this.data.roomPlayers.findIndex(rp => rp.id === id);
      if (idx !== -1) {
        this.data.roomPlayers[idx] = { ...this.data.roomPlayers[idx], ...updates };
        this.save();
        return this.data.roomPlayers[idx];
      }
      return null;
    },
    remove: (roomId: string, userId: string) => {
      this.data.roomPlayers = this.data.roomPlayers.filter(rp => !(rp.roomId === roomId && rp.userId === userId));
      this.save();
    },
  };

  // Turn Actions
  public turnActions = {
    findByRoomAndRound: (roomId: string, round: number) =>
      this.data.turnActions.filter(ta => ta.roomId === roomId && ta.roundNumber === round),
    create: (action: TurnActionEntity) => {
      // replace if player already submitted this round
      this.data.turnActions = this.data.turnActions.filter(
        ta => !(ta.roomId === action.roomId && ta.roundNumber === action.roundNumber && ta.playerId === action.playerId)
      );
      this.data.turnActions.push(action);
      this.save();
      return action;
    },
    remove: (id: string) => {
      this.data.turnActions = this.data.turnActions.filter(ta => ta.id !== id);
      this.save();
    },
    removeByPlayerAndRound: (roomId: string, round: number, playerId: string) => {
      this.data.turnActions = this.data.turnActions.filter(
        ta => !(ta.roomId === roomId && ta.roundNumber === round && ta.playerId === playerId)
      );
      this.save();
    },
  };

  // Game Logs
  public gameLogs = {
    findByRoomId: (roomId: string) =>
      this.data.gameLogs.filter(gl => gl.roomId === roomId).sort((a, b) => a.roundNumber - b.roundNumber),
    create: (log: GameLogEntity) => {
      this.data.gameLogs.push(log);
      this.save();
      return log;
    }
  };

  // Item Ledgers (procedural item tracking)
  public itemLedgers = {
    findByRoomId: (roomId: string) => (this.data.itemLedgers || []).filter(il => il.roomId === roomId),
    findByCharacterId: (charId: string) => (this.data.itemLedgers || []).filter(il => il.characterId === charId),
    create: (entry: ItemLedgerEntry) => {
      if (!this.data.itemLedgers) this.data.itemLedgers = [];
      this.data.itemLedgers.push(entry);
      this.save();
      return entry;
    },
    update: (id: string, updates: Partial<ItemLedgerEntry>) => {
      if (!this.data.itemLedgers) this.data.itemLedgers = [];
      const idx = this.data.itemLedgers.findIndex(il => il.id === id);
      if (idx !== -1) {
        this.data.itemLedgers[idx] = { ...this.data.itemLedgers[idx], ...updates };
        this.save();
        return this.data.itemLedgers[idx];
      }
      return null;
    },
  };

  // World NPCs (departed characters registry)
  public worldNPCs = {
    findByRoomId: (roomId: string) => (this.data.worldNPCs || []).filter(wn => wn.roomId === roomId),
    create: (entry: WorldNPCEntry) => {
      if (!this.data.worldNPCs) this.data.worldNPCs = [];
      // replace if already present by ID or exact name
      this.data.worldNPCs = this.data.worldNPCs.filter(wn => !(wn.roomId === entry.roomId && (wn.id === entry.id || wn.name.toLowerCase() === entry.name.toLowerCase())));
      this.data.worldNPCs.push(entry);
      this.save();
      return entry;
    },
    update: (id: string, updates: Partial<WorldNPCEntry>, roomId?: string) => {
      if (!this.data.worldNPCs) this.data.worldNPCs = [];
      const idx = this.data.worldNPCs.findIndex(wn => wn.id === id && (!roomId || wn.roomId === roomId));
      if (idx !== -1) {
        this.data.worldNPCs[idx] = { ...this.data.worldNPCs[idx], ...updates };
        this.save();
        return this.data.worldNPCs[idx];
      }
      return null;
    },
    remove: (roomId: string, id: string) => {
      if (!this.data.worldNPCs) return;
      this.data.worldNPCs = this.data.worldNPCs.filter(wn => !(wn.roomId === roomId && (wn.id === id || wn.name.toLowerCase() === id.toLowerCase())));
      this.save();
    },
  };

  // World Quests & Objectives
  public quests = {
    findByRoomId: (roomId: string) => (this.data.worldQuests || []).filter(q => q.roomId === roomId),
    findById: (id: string) => (this.data.worldQuests || []).find(q => q.id === id),
    create: (entry: QuestEntity) => {
      if (!this.data.worldQuests) this.data.worldQuests = [];
      const existingIdx = this.data.worldQuests.findIndex(
        q => q.roomId === entry.roomId && (q.id === entry.id || q.title.toLowerCase().trim() === entry.title.toLowerCase().trim())
      );
      if (existingIdx !== -1) {
        this.data.worldQuests[existingIdx] = {
          ...this.data.worldQuests[existingIdx],
          ...entry,
          updatedAt: new Date().toISOString(),
        };
        this.save();
        return this.data.worldQuests[existingIdx];
      }
      this.data.worldQuests.push(entry);
      this.save();
      return entry;
    },
    update: (id: string, updates: Partial<QuestEntity>, roomId?: string) => {
      if (!this.data.worldQuests) this.data.worldQuests = [];
      const idx = this.data.worldQuests.findIndex(q => q.id === id && (!roomId || q.roomId === roomId));
      if (idx !== -1) {
        this.data.worldQuests[idx] = {
          ...this.data.worldQuests[idx],
          ...updates,
          updatedAt: new Date().toISOString(),
        };
        this.save();
        return this.data.worldQuests[idx];
      }
      return null;
    },
    complete: (roomId: string, questIdOrTitle: string, roundNumber: number, resolutionNote?: string) => {
      if (!this.data.worldQuests) this.data.worldQuests = [];
      const questIdLower = questIdOrTitle.toLowerCase().trim();
      const target = this.data.worldQuests.find(
        q => q.roomId === roomId && (q.id === questIdOrTitle || q.title.toLowerCase().trim() === questIdLower || questIdLower.includes(q.title.toLowerCase().trim()))
      );
      if (target) {
        target.status = 'completed';
        target.roundCompleted = roundNumber;
        if (resolutionNote) target.resolutionNote = resolutionNote;
        target.updatedAt = new Date().toISOString();
        this.save();
        return target;
      }
      return null;
    },
    fail: (roomId: string, questIdOrTitle: string, roundNumber: number, note?: string) => {
      if (!this.data.worldQuests) this.data.worldQuests = [];
      const questIdLower = questIdOrTitle.toLowerCase().trim();
      const target = this.data.worldQuests.find(
        q => q.roomId === roomId && (q.id === questIdOrTitle || q.title.toLowerCase().trim() === questIdLower || questIdLower.includes(q.title.toLowerCase().trim()))
      );
      if (target) {
        target.status = 'failed';
        target.roundCompleted = roundNumber;
        if (note) target.resolutionNote = note;
        target.updatedAt = new Date().toISOString();
        this.save();
        return target;
      }
      return null;
    },
  };

  // Searched & Looted Objects Registry
  public searchedObjects = {
    findByRoomId: (roomId: string) => (this.data.searchedObjects || []).filter(s => s.roomId === roomId),
    findMatching: (roomId: string, query: string) => {
      const q = query.toLowerCase().trim();
      return (this.data.searchedObjects || []).find(s =>
        s.roomId === roomId && (
          s.targetKey === q ||
          s.targetName.toLowerCase().includes(q) ||
          q.includes(s.targetName.toLowerCase()) ||
          (q.includes('повозк') && s.targetKey.includes('повозк')) ||
          (q.includes('телег') && s.targetKey.includes('повозк')) ||
          (q.includes('отсек') && (s.targetKey.includes('отсек') || s.targetName.toLowerCase().includes('отсек')))
        )
      );
    },
    record: (entry: SearchedObjectEntry) => {
      if (!this.data.searchedObjects) this.data.searchedObjects = [];
      const existingIdx = this.data.searchedObjects.findIndex(
        s => s.roomId === entry.roomId && (s.id === entry.id || s.targetKey === entry.targetKey)
      );
      if (existingIdx !== -1) {
        const prev = this.data.searchedObjects[existingIdx];
        const mergedItems = Array.from(new Set([...(prev.extractedItems || []), ...(entry.extractedItems || [])]));
        this.data.searchedObjects[existingIdx] = {
          ...prev,
          ...entry,
          extractedItems: mergedItems,
        };
        this.save();
        return this.data.searchedObjects[existingIdx];
      }
      this.data.searchedObjects.push(entry);
      this.save();
      return entry;
    },
  };
}

export const db = new Database();
