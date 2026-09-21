import crypto from 'crypto';
import { db, WorldNPCEntry, RoomNPC, RoomEnemy } from '../db';
import { IRepository } from './IRepository';

export interface IWorldNPCRepository extends IRepository<WorldNPCEntry> {
  findByRoomId(roomId: string): WorldNPCEntry[];
  archiveNPC(
    roomId: string,
    npc: RoomNPC | RoomEnemy,
    departureReason: string,
    roundNumber: number,
    narrativeNote?: string
  ): WorldNPCEntry;
  findCandidateForReEncounter(
    roomId: string,
    currentRound: number,
    minRoundsSinceDeparture?: number
  ): WorldNPCEntry | null;
  markNPCReinstated(roomId: string, npcId: string, currentRound: number): void;
  updateAffinity(roomId: string, npcNameOrId: string, delta: number): WorldNPCEntry | null;
  isDeparted(roomId: string, npcNameOrId: string): boolean;
}

export class WorldNPCRepository implements IWorldNPCRepository {
  public findById(id: string): WorldNPCEntry | undefined {
    return (db as any).worldNPCs?.findByRoomId?.('')?.find((n: WorldNPCEntry) => n.id === id);
  }

  public create(entry: WorldNPCEntry): WorldNPCEntry {
    return db.worldNPCs.create(entry);
  }

  public findByRoomId(roomId: string): WorldNPCEntry[] {
    return db.worldNPCs.findByRoomId(roomId);
  }

  public archiveNPC(
    roomId: string,
    npc: RoomNPC | RoomEnemy,
    departureReason: string,
    roundNumber: number,
    narrativeNote?: string
  ): WorldNPCEntry {
    const isNPC = 'role' in npc;
    const existing = db.worldNPCs.findByRoomId(roomId).find(
      e => e.id === npc.id || e.name.toLowerCase().trim() === npc.name.toLowerCase().trim()
    );

    const notes: string[] = existing?.notes ? [...existing.notes] : [];
    notes.push(`Раунд ${roundNumber}: ${departureReason} (статус: ${npc.status || 'покинул сцену'})`);

    const potentialHooks: string[] = existing?.potentialHooks ? [...existing.potentialHooks] : [];
    if (isNPC && (npc as RoomNPC).disposition === 'friendly') {
      potentialHooks.push('Встреча на тракте или в таверне с дружеской помощью / торговлей со скидкой');
      potentialHooks.push('Предупреждение отряда о засаде на пути');
    } else if (isNPC && (npc as RoomNPC).disposition === 'hostile') {
      potentialHooks.push('Подготовка засады или донос властям/бандитам');
    } else if (npc.name.toLowerCase().includes('бальтазар')) {
      potentialHooks.push('Возвращение с восстановленным караваном и наградой за спасение');
    } else if (npc.name.toLowerCase().includes('помощник')) {
      potentialHooks.push('Возвращение после изгнания порчи / исцеления');
    }

    const entry: WorldNPCEntry = {
      id: npc.id || crypto.randomUUID(),
      roomId,
      name: npc.name,
      role: isNPC ? (npc as RoomNPC).role : 'Противник',
      hpCurrent: npc.hpCurrent,
      hpMax: npc.hpMax,
      ac: npc.ac || 12,
      disposition: isNPC ? (npc as RoomNPC).disposition : 'hostile',
      affinity: isNPC ? ((npc as RoomNPC).affinity ?? 0) : -50,
      status: `В мире: ${departureReason}`,
      combatRole: isNPC ? (npc as RoomNPC).combatRole : 'fled',
      notes,
      departureRound: roundNumber,
      departureReason,
      narrativeNote: narrativeNote || existing?.narrativeNote,
      potentialHooks,
    };

    return db.worldNPCs.create(entry);
  }

  public findCandidateForReEncounter(
    roomId: string,
    currentRound: number,
    minRoundsSinceDeparture: number = 2
  ): WorldNPCEntry | null {
    const candidates = db.worldNPCs.findByRoomId(roomId).filter(entry => {
      // Must not have returned in the same or very recent round
      if (entry.returnedInRound && currentRound - entry.returnedInRound < 3) return false;
      // Must have departed at least minRoundsSinceDeparture rounds ago
      return currentRound - entry.departureRound >= minRoundsSinceDeparture;
    });

    if (candidates.length === 0) return null;

    // Pick a candidate (prioritize friendly characters or notable NPCs)
    const sorted = candidates.sort((a, b) => {
      const aScore = Math.abs(a.affinity) + (a.disposition === 'friendly' ? 20 : 0);
      const bScore = Math.abs(b.affinity) + (b.disposition === 'friendly' ? 20 : 0);
      return bScore - aScore;
    });

    return sorted[0] || null;
  }

  public markNPCReinstated(roomId: string, npcId: string, currentRound: number): void {
    const existing = db.worldNPCs.findByRoomId(roomId).find(
      e => e.id === npcId || e.name.toLowerCase() === npcId.toLowerCase()
    );
    if (existing) {
      db.worldNPCs.update(existing.id, {
        returnedInRound: currentRound,
        status: `Вернулся в сцену в раунде ${currentRound}`,
      }, roomId);
    }
  }

  public updateAffinity(roomId: string, npcNameOrId: string, delta: number): WorldNPCEntry | null {
    const query = npcNameOrId.toLowerCase().trim();
    const existing = db.worldNPCs.findByRoomId(roomId).find(
      e => e.id === npcNameOrId || e.name.toLowerCase().trim() === query
    );
    if (!existing) return null;

    const newAffinity = Math.max(-100, Math.min(100, existing.affinity + delta));
    return db.worldNPCs.update(existing.id, { affinity: newAffinity }, roomId);
  }

  public isDeparted(roomId: string, npcNameOrId: string): boolean {
    const query = npcNameOrId.toLowerCase().trim();
    return db.worldNPCs.findByRoomId(roomId).some(
      e => (e.id === npcNameOrId || e.name.toLowerCase().trim() === query || query.includes(e.name.toLowerCase().trim())) && !e.returnedInRound
    );
  }
}

export const worldNPCRepository = new WorldNPCRepository();
