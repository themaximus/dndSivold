import { db, RoomEntity, RoomPlayerEntity, RoomLootItem, LoreMilestone } from '../db';
import { IRepository } from './IRepository';

export interface IRoomRepository extends IRepository<RoomEntity> {
  findByCode(code: string): RoomEntity | undefined;
  update(id: string, updates: Partial<RoomEntity>): RoomEntity | null;
  findPlayersByRoomId(roomId: string): RoomPlayerEntity[];
  findPlayer(roomId: string, userId: string): RoomPlayerEntity | undefined;
  addPlayer(player: RoomPlayerEntity): RoomPlayerEntity;
  updatePlayer(id: string, updates: Partial<RoomPlayerEntity>): RoomPlayerEntity | null;
  resetPlayersTurn(roomId: string): void;
  addLoot(roomId: string, items: RoomLootItem[]): RoomEntity | null;
  removeLoot(roomId: string, lootId: string): { room: RoomEntity | null; item: RoomLootItem | null };
  addMilestones(roomId: string, milestones: LoreMilestone[]): RoomEntity | null;
  updateDC(roomId: string, targetDC: number, dcReason: string): RoomEntity | null;
}

export class RoomRepository implements IRoomRepository {
  public findById(id: string): RoomEntity | undefined {
    return db.rooms.findById(id);
  }

  public findByCode(code: string): RoomEntity | undefined {
    return db.rooms.findByCode(code);
  }

  public create(room: RoomEntity): RoomEntity {
    return db.rooms.create(room);
  }

  public update(id: string, updates: Partial<RoomEntity>): RoomEntity | null {
    return db.rooms.update(id, updates);
  }

  public findPlayersByRoomId(roomId: string): RoomPlayerEntity[] {
    return db.roomPlayers.findByRoomId(roomId);
  }

  public findPlayer(roomId: string, userId: string): RoomPlayerEntity | undefined {
    return db.roomPlayers.findPlayer(roomId, userId);
  }

  public addPlayer(player: RoomPlayerEntity): RoomPlayerEntity {
    return db.roomPlayers.create(player);
  }

  public updatePlayer(id: string, updates: Partial<RoomPlayerEntity>): RoomPlayerEntity | null {
    return db.roomPlayers.update(id, updates);
  }

  public resetPlayersTurn(roomId: string): void {
    const players = this.findPlayersByRoomId(roomId);
    players.forEach(p => {
      this.updatePlayer(p.id, { hasActedThisRound: false });
    });
  }

  public addLoot(roomId: string, items: RoomLootItem[]): RoomEntity | null {
    const room = this.findById(roomId);
    if (!room) return null;
    const currentLoot = room.availableLoot || [];
    return this.update(roomId, { availableLoot: [...currentLoot, ...items] });
  }

  public removeLoot(roomId: string, lootId: string): { room: RoomEntity | null; item: RoomLootItem | null } {
    const room = this.findById(roomId);
    if (!room) return { room: null, item: null };
    const currentLoot = room.availableLoot || [];
    const item = currentLoot.find(i => i.id === lootId) || null;
    if (!item) return { room, item: null };
    const updatedLoot = currentLoot.filter(i => i.id !== lootId);
    const updatedRoom = this.update(roomId, { availableLoot: updatedLoot });
    return { room: updatedRoom, item };
  }

  public addMilestones(roomId: string, milestones: LoreMilestone[]): RoomEntity | null {
    const room = this.findById(roomId);
    if (!room) return null;
    const currentJournal = room.loreJournal || [];
    return this.update(roomId, { loreJournal: [...currentJournal, ...milestones] });
  }

  public updateDC(roomId: string, targetDC: number, dcReason: string): RoomEntity | null {
    return this.update(roomId, { targetDC, dcReason });
  }
}

export const roomRepository = new RoomRepository();
