import fs from 'fs';
import path from 'path';
import { config } from '../../config';
import { RoomEnemy, RoomNPC, CharacterEntity } from '../../db';

export interface RoundAuditRecord {
  id: string;
  roomId: string;
  roundNumber: number;
  timestamp: string;
  turnMode: 'simultaneous' | 'turn_by_turn';
  actingPlayer?: {
    userId: string;
    username?: string;
  };
  charactersSnapshot: Array<{
    id: string;
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
    conditions: string[];
    activeWeapon?: string;
    inventorySummary: Array<{
      name: string;
      quantity: number;
      type: string;
      damage?: string;
      healAmount?: number;
      history?: string[];
    }>;
  }>;
  enemiesBefore: RoomEnemy[];
  sceneNPCsBefore: RoomNPC[];
  actions: Array<{
    actionId: string;
    characterName: string;
    actionText: string;
    actionType?: string;
    targetEnemyName?: string;
    diceRolls: any[];
    mechanicalResolution: {
      isHit?: boolean;
      damageFormula?: string;
      damageRolled?: number;
      damageRolls?: number[];
      healRolled?: number;
      targetHpBefore?: number;
      targetHpAfter?: number;
      targetDied?: boolean;
      promptDirective: string;
      auditNotes: string;
    };
  }>;
  enemiesAfter: RoomEnemy[];
  sceneNPCsAfter: RoomNPC[];
  socialResolutions?: Array<{
    npcName: string;
    actionType: string;
    isSuccess?: boolean;
    affinityDelta: number;
    newAffinity: number;
    newDisposition: string;
    newCombatRole: string;
    auditNote: string;
  }>;
  contestedReactions?: Array<{
    reactionRequestId: string;
    initiatorCharacterName: string;
    targetCharacterName: string;
    outcome: string;
    damageMitigationMultiplier: number;
    auditNote: string;
  }>;
  aiResponseSnapshot?: {
    narrative: string;
    currentSituation: string;
    choiceDilemma?: string;
    mood?: string;
    nextRoundDC?: number;
    ruleViolations?: string[];
  };
}

export class SessionAuditLogger {
  private baseDir: string;

  constructor(baseDir?: string) {
    this.baseDir = baseDir || path.join(config.dataDir, 'audit_logs');
    this.ensureDirExists();
  }

  private ensureDirExists() {
    try {
      if (!fs.existsSync(this.baseDir)) {
        fs.mkdirSync(this.baseDir, { recursive: true });
      }
    } catch (err: any) {
      console.warn('[SessionAuditLogger] Failed to create audit_logs directory:', err?.message || err);
    }
  }

  private getFilePath(roomId: string): string {
    const safeRoomId = roomId.replace(/[^a-zA-Z0-9_-]/g, '_');
    return path.join(this.baseDir, `${safeRoomId}.json`);
  }

  /**
   * Appends a complete forensic audit record for a round or turn step to the room's JSON file.
   * Runs asynchronously and safely so it never blocks or interrupts the game loop.
   */
  public async logTurn(record: RoundAuditRecord): Promise<void> {
    try {
      this.ensureDirExists();
      const filePath = this.getFilePath(record.roomId);

      let history: RoundAuditRecord[] = [];
      if (fs.existsSync(filePath)) {
        try {
          const raw = await fs.promises.readFile(filePath, 'utf-8');
          history = JSON.parse(raw);
          if (!Array.isArray(history)) history = [];
        } catch {
          history = [];
        }
      }

      history.push(record);

      // Safe atomic or direct async write
      await fs.promises.writeFile(filePath, JSON.stringify(history, null, 2), 'utf-8');
    } catch (err: any) {
      console.error(`[SessionAuditLogger] Error writing audit log for room ${record.roomId}:`, err?.message || err);
    }
  }

  /**
   * Reads all audit records for a room
   */
  public getRoomAudit(roomId: string): RoundAuditRecord[] {
    try {
      const filePath = this.getFilePath(roomId);
      if (!fs.existsSync(filePath)) return [];
      const raw = fs.readFileSync(filePath, 'utf-8');
      const data = JSON.parse(raw);
      return Array.isArray(data) ? data : [];
    } catch {
      return [];
    }
  }
}

export const sessionAuditLogger = new SessionAuditLogger();
