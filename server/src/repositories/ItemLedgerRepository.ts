import crypto from 'crypto';
import { db, ItemLedgerEntry, ItemLifecycleStatus } from '../db';
import { IRepository } from './IRepository';

export interface IItemLedgerRepository extends IRepository<ItemLedgerEntry> {
  findByRoomId(roomId: string): ItemLedgerEntry[];
  findByCharacterId(characterId: string): ItemLedgerEntry[];
  recordItemEvent(
    characterId: string,
    characterName: string,
    itemId: string,
    itemName: string,
    itemType: 'weapon' | 'armor' | 'potion' | 'scroll' | 'food' | 'misc',
    status: ItemLifecycleStatus,
    quantity: number,
    roundNumber: number,
    reason: string,
    roomId?: string
  ): ItemLedgerEntry;
  isItemAvailable(characterId: string, itemNameOrId: string): boolean;
  getItemStatus(characterId: string, itemNameOrId: string): ItemLifecycleStatus | 'not_found';
  markItemDestroyed(characterId: string, itemNameOrId: string, reason: string, roundNumber: number, roomId?: string): void;
  markItemConsumed(characterId: string, itemNameOrId: string, quantity: number, reason: string, roundNumber: number, roomId?: string): void;
  markItemDropped(characterId: string, itemNameOrId: string, quantity: number, reason: string, roundNumber: number, roomId?: string): void;
  markItemRecovered(characterId: string, item: any, reason: string, roundNumber: number, roomId?: string): void;
}

export class ItemLedgerRepository implements IItemLedgerRepository {
  public findById(id: string): ItemLedgerEntry | undefined {
    return (db as any).itemLedgers?.findByRoomId?.('')?.find((i: ItemLedgerEntry) => i.id === id);
  }

  public create(entry: ItemLedgerEntry): ItemLedgerEntry {
    return db.itemLedgers.create(entry);
  }

  public findByRoomId(roomId: string): ItemLedgerEntry[] {
    return db.itemLedgers.findByRoomId(roomId);
  }

  public findByCharacterId(characterId: string): ItemLedgerEntry[] {
    return db.itemLedgers.findByCharacterId(characterId);
  }

  public recordItemEvent(
    characterId: string,
    characterName: string,
    itemId: string,
    itemName: string,
    itemType: 'weapon' | 'armor' | 'potion' | 'scroll' | 'food' | 'misc',
    status: ItemLifecycleStatus,
    quantity: number,
    roundNumber: number,
    reason: string,
    roomId?: string
  ): ItemLedgerEntry {
    const entry: ItemLedgerEntry = {
      id: crypto.randomUUID(),
      roomId,
      characterId,
      characterName,
      itemId,
      itemName,
      itemType,
      status,
      quantity,
      lastRound: roundNumber,
      reason,
      timestamp: new Date().toISOString(),
    };
    return db.itemLedgers.create(entry);
  }

  public isItemAvailable(characterId: string, itemNameOrId: string): boolean {
    const char = db.characters.findById(characterId);
    if (!char || !char.inventory || char.inventory.length === 0) return false;

    const query = itemNameOrId.toLowerCase().trim();
    const invItem = char.inventory.find(i =>
      i.id === itemNameOrId ||
      i.name.toLowerCase().trim() === query ||
      i.name.toLowerCase().includes(query) ||
      query.includes(i.name.toLowerCase().trim())
    );

    if (!invItem || (invItem.quantity !== undefined && invItem.quantity <= 0)) {
      return false;
    }

    // Check ledger records for explicit destruction or loss in this room
    const charEntries = db.itemLedgers.findByCharacterId(characterId);
    const itemEntries = charEntries.filter(e =>
      e.itemId === invItem.id ||
      e.itemName.toLowerCase().trim() === invItem.name.toLowerCase().trim()
    );

    if (itemEntries.length > 0) {
      const lastEntry = itemEntries[itemEntries.length - 1];
      if (lastEntry.status === 'broken' || lastEntry.status === 'destroyed' || lastEntry.status === 'consumed') {
        return false;
      }
    }

    return true;
  }

  public getItemStatus(characterId: string, itemNameOrId: string): ItemLifecycleStatus | 'not_found' {
    const char = db.characters.findById(characterId);
    const query = itemNameOrId.toLowerCase().trim();
    const invItem = char?.inventory?.find(i =>
      i.id === itemNameOrId ||
      i.name.toLowerCase().trim() === query ||
      i.name.toLowerCase().includes(query)
    );

    const charEntries = db.itemLedgers.findByCharacterId(characterId);
    const itemEntries = charEntries.filter(e =>
      e.itemId === itemNameOrId ||
      e.itemName.toLowerCase().trim() === query ||
      (invItem && e.itemId === invItem.id)
    );

    if (itemEntries.length > 0) {
      return itemEntries[itemEntries.length - 1].status;
    }

    return invItem ? 'in_inventory' : 'not_found';
  }

  public markItemDestroyed(
    characterId: string,
    itemNameOrId: string,
    reason: string,
    roundNumber: number,
    roomId?: string
  ): void {
    const char = db.characters.findById(characterId);
    const query = itemNameOrId.toLowerCase().trim();
    const invItem = char?.inventory?.find(i =>
      i.id === itemNameOrId ||
      i.name.toLowerCase().trim() === query ||
      i.name.toLowerCase().includes(query)
    );

    this.recordItemEvent(
      characterId,
      char?.name || 'Герой',
      invItem?.id || itemNameOrId,
      invItem?.name || itemNameOrId,
      invItem?.type || 'misc',
      'destroyed',
      invItem?.quantity || 1,
      roundNumber,
      reason,
      roomId
    );
  }

  public markItemConsumed(
    characterId: string,
    itemNameOrId: string,
    quantity: number,
    reason: string,
    roundNumber: number,
    roomId?: string
  ): void {
    const char = db.characters.findById(characterId);
    const query = itemNameOrId.toLowerCase().trim();
    const invItem = char?.inventory?.find(i =>
      i.id === itemNameOrId ||
      i.name.toLowerCase().trim() === query ||
      i.name.toLowerCase().includes(query)
    );

    this.recordItemEvent(
      characterId,
      char?.name || 'Герой',
      invItem?.id || itemNameOrId,
      invItem?.name || itemNameOrId,
      invItem?.type || 'potion',
      'consumed',
      quantity,
      roundNumber,
      reason,
      roomId
    );
  }

  public markItemDropped(
    characterId: string,
    itemNameOrId: string,
    quantity: number,
    reason: string,
    roundNumber: number,
    roomId?: string
  ): void {
    const char = db.characters.findById(characterId);
    const query = itemNameOrId.toLowerCase().trim();
    const invItem = char?.inventory?.find(i =>
      i.id === itemNameOrId ||
      i.name.toLowerCase().trim() === query ||
      i.name.toLowerCase().includes(query)
    );

    this.recordItemEvent(
      characterId,
      char?.name || 'Герой',
      invItem?.id || itemNameOrId,
      invItem?.name || itemNameOrId,
      invItem?.type || 'weapon',
      'dropped_on_ground',
      quantity,
      roundNumber,
      reason,
      roomId
    );
  }

  public markItemRecovered(
    characterId: string,
    item: any,
    reason: string,
    roundNumber: number,
    roomId?: string
  ): void {
    const char = db.characters.findById(characterId);
    this.recordItemEvent(
      characterId,
      char?.name || 'Герой',
      item.id || crypto.randomUUID(),
      item.name,
      item.type || 'misc',
      'in_inventory',
      item.quantity || 1,
      roundNumber,
      reason,
      roomId
    );
  }
}

export const itemLedgerRepository = new ItemLedgerRepository();
