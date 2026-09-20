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
    type: 'weapon' | 'armor' | 'potion' | 'misc';
    description: string;
    quantity: number;
    damage?: string;
    ac_bonus?: number;
    healAmount?: number;
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
  createdAt: string;
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
  loreJournal?: LoreMilestone[];
  availableLoot?: RoomLootItem[];
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
  diceRolls: any[];
  submittedAt: string;
}

export interface GameLogEntity {
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

interface DatabaseSchema {
  users: UserEntity[];
  characters: CharacterEntity[];
  rooms: RoomEntity[];
  roomPlayers: RoomPlayerEntity[];
  turnActions: TurnActionEntity[];
  gameLogs: GameLogEntity[];
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
  };

  constructor() {
    this.filePath = path.join(config.dataDir, 'database.json');
    this.init();
  }

  private init() {
    if (!fs.existsSync(config.dataDir)) {
      fs.mkdirSync(config.dataDir, { recursive: true });
    }

    if (fs.existsSync(this.filePath)) {
      try {
        const raw = fs.readFileSync(this.filePath, 'utf-8');
        this.data = JSON.parse(raw);
      } catch (err) {
        console.error('Failed to parse database.json, initializing default empty db', err);
        this.save();
      }
    } else {
      const defaultPath = path.join(config.dataDir, 'database.default.json');
      if (fs.existsSync(defaultPath)) {
        try {
          fs.copyFileSync(defaultPath, this.filePath);
          const raw = fs.readFileSync(this.filePath, 'utf-8');
          this.data = JSON.parse(raw);
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
      fs.writeFileSync(tempPath, JSON.stringify(this.data, null, 2), 'utf-8');
      fs.renameSync(tempPath, this.filePath);
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
}

export const db = new Database();
