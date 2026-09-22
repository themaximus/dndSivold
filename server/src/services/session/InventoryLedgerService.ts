import crypto from 'crypto';
import {
  IRoomRepository,
  roomRepository,
  ICharacterRepository,
  characterRepository,
  IItemLedgerRepository,
  itemLedgerRepository,
  ISearchedObjectRepository,
  searchedObjectRepository,
} from '../../repositories';
import {
  RoomEntity,
  RoomLootItem,
  CharacterEntity,
  SearchedObjectEntry,
  TurnActionEntity,
} from '../../db';
import {
  InventoryUpdate,
  InventoryNotification,
  AIDMResponse,
  SearchedObjectUpdate,
} from '../../domain/types';
import { sanitizeRoom } from '../security/CryptoService';

export class InventoryLedgerService {
  private rooms: IRoomRepository;
  private characters: ICharacterRepository;
  private itemLedgers: IItemLedgerRepository;
  private searchedObjects: ISearchedObjectRepository;

  constructor(
    rooms: IRoomRepository = roomRepository,
    characters: ICharacterRepository = characterRepository,
    itemLedgers: IItemLedgerRepository = itemLedgerRepository,
    searchedObjects: ISearchedObjectRepository = searchedObjectRepository
  ) {
    this.rooms = rooms;
    this.characters = characters;
    this.itemLedgers = itemLedgers;
    this.searchedObjects = searchedObjects;
  }

  /**
   * Character picks up a dropped loot item from the room.
   */
  public pickupLoot(roomId: string, characterId: string, lootId: string) {
    const { room, item } = this.rooms.removeLoot(roomId, lootId);
    if (!room || !item || !item.name || !item.name.trim()) return null;

    const reason = `Подобран как боевой трофей в раунде ${room.roundNumber}.`;
    const updatedChar = this.characters.addItemToInventory(characterId, item, reason);

    this.itemLedgers.recordItemEvent(
      characterId,
      updatedChar?.name || 'Персонаж',
      item.id,
      item.name,
      item.type,
      'in_inventory',
      item.quantity || 1,
      room.roundNumber,
      reason,
      roomId
    );

    return { room: sanitizeRoom(room), character: updatedChar, item };
  }

  /**
   * Uses a consumable item from character's inventory.
   */
  public useItem(characterId: string, itemId: string, targetName?: string) {
    return this.characters.useConsumableItem(characterId, itemId, targetName);
  }

  /**
   * Equips a weapon.
   */
  public equipWeapon(characterId: string, itemId: string) {
    return this.characters.equipWeapon(characterId, itemId);
  }

  /**
   * Checks if an object/container has already been searched.
   */
  public isObjectExhausted(room: RoomEntity, targetKey: string): boolean {
    if (!room.searchedObjectsRegistry) return false;
    return room.searchedObjectsRegistry.some(
      (entry) => entry.targetKey.toLowerCase() === targetKey.toLowerCase() && entry.status === 'searched'
    );
  }

  /**
   * Applies inventory updates from AI or DM resolution, recording ledger entries.
   */
  public applyInventoryUpdates(
    room: RoomEntity,
    updates: InventoryUpdate[] | undefined,
    roundNumber: number,
    inventoryNotifications: InventoryNotification[],
    itemActivitiesByCharacter: Record<string, string[]>
  ): void {
    if (!updates || !Array.isArray(updates)) return;

    for (const update of updates) {
      if (!update.item || !update.item.name) continue;

      let targetChar: CharacterEntity | undefined;
      if (update.characterId) {
        targetChar = this.characters.findById(update.characterId);
      }
      if (!targetChar && update.characterName) {
        const roomPlayers = this.rooms.findPlayersByRoomId(room.id);
        for (const p of roomPlayers) {
          if (p.characterId) {
            const c = this.characters.findById(p.characterId);
            if (c && c.name.toLowerCase().trim() === update.characterName.toLowerCase().trim()) {
              targetChar = c;
              break;
            }
          }
        }
      }
      if (!targetChar) continue;

      const itemName = update.item.name.trim();
      const qty = update.item.quantity || 1;

      if (update.action === 'add') {
        const historyNote = update.reason || `Получено в раунде ${roundNumber}`;
        const itemPayload = {
          id: crypto.randomUUID(),
          name: itemName,
          type: (update.item.type as any) || 'misc',
          description: update.item.description || 'Полученный предмет.',
          quantity: qty,
          damage: update.item.damage,
          ac_bonus: update.item.ac_bonus,
          healAmount: update.item.healAmount,
          history: [historyNote],
        };

        this.characters.addItemToInventory(targetChar.id, itemPayload, historyNote);

        this.itemLedgers.recordItemEvent(
          targetChar.id,
          targetChar.name,
          itemPayload.id,
          itemPayload.name,
          itemPayload.type,
          'in_inventory',
          qty,
          roundNumber,
          historyNote,
          room.id
        );

        inventoryNotifications.push({
          id: crypto.randomUUID(),
          characterId: targetChar.id,
          characterName: targetChar.name,
          action: 'add',
          itemName,
          quantity: qty,
          reason: historyNote,
          timestamp: new Date().toISOString(),
        });

        if (!itemActivitiesByCharacter[targetChar.id]) itemActivitiesByCharacter[targetChar.id] = [];
        itemActivitiesByCharacter[targetChar.id].push(`Получен предмет: ${itemName} (${qty} шт.)`);
      } else if (update.action === 'remove') {
        const removeReason = update.reason || `Израсходовано/утрачено в раунде ${roundNumber}`;
        this.characters.removeItemFromInventory(targetChar.id, itemName, qty, removeReason);

        this.itemLedgers.recordItemEvent(
          targetChar.id,
          targetChar.name,
          crypto.randomUUID(),
          itemName,
          (update.item.type as any) || 'misc',
          'consumed',
          qty,
          roundNumber,
          removeReason,
          room.id
        );

        inventoryNotifications.push({
          id: crypto.randomUUID(),
          characterId: targetChar.id,
          characterName: targetChar.name,
          action: 'remove',
          itemName,
          quantity: qty,
          reason: removeReason,
          timestamp: new Date().toISOString(),
        });

        if (!itemActivitiesByCharacter[targetChar.id]) itemActivitiesByCharacter[targetChar.id] = [];
        itemActivitiesByCharacter[targetChar.id].push(`Утрачен/израсходован предмет: ${itemName}`);
      }
    }
  }

  /**
   * Manages registry of searched objects, carts, containers, rooms.
   * Ensures that once an object is searched, it is marked 'searched' in DB to prevent infinite loot.
   */
  public handleSearchedObjects(
    room: RoomEntity,
    roundNumber: number,
    searchedUpdates: SearchedObjectUpdate[] | undefined,
    actingCharacterName?: string
  ): void {
    if (!room.searchedObjectsRegistry) {
      room.searchedObjectsRegistry = [];
    }

    if (!searchedUpdates || !Array.isArray(searchedUpdates)) return;

    for (const update of searchedUpdates) {
      const targetName = update.targetName || 'Объект';
      const targetKey = targetName
        .toLowerCase()
        .replace(/[^a-zа-я0-9]/gi, '_')
        .replace(/_+/g, '_')
        .slice(0, 50);

      const existingIndex = room.searchedObjectsRegistry.findIndex(
        (e) => e.targetKey === targetKey || e.targetName.toLowerCase() === targetName.toLowerCase()
      );

      const entry: SearchedObjectEntry = {
        id: crypto.randomUUID(),
        roomId: room.id,
        targetKey,
        targetName,
        targetType: update.targetType || 'container',
        status: 'searched',
        searchedInRound: roundNumber,
        searchedByCharacterName: actingCharacterName,
        extractedItems: update.extractedItems || [],
        narrativeNote: update.narrativeNote || 'Обыскано, ценностей больше нет.',
        timestamp: new Date().toISOString(),
      };

      if (existingIndex >= 0) {
        // Merge extracted items
        const existing = room.searchedObjectsRegistry[existingIndex];
        const mergedItems = Array.from(new Set([...existing.extractedItems, ...(update.extractedItems || [])]));
        room.searchedObjectsRegistry[existingIndex] = {
          ...existing,
          extractedItems: mergedItems,
          narrativeNote: update.narrativeNote || existing.narrativeNote,
          status: 'searched',
        };
      } else {
        room.searchedObjectsRegistry.push(entry);
      }

      this.searchedObjects.recordSearch(
        room.id,
        entry.targetName,
        entry.targetType,
        entry.searchedInRound,
        entry.extractedItems,
        entry.narrativeNote
      );
    }
  }

  /**
   * Procedural item recovery from the ground when a character rolls a successful check.
   */
  public handleProceduralItemRecovery(
    room: RoomEntity,
    action: TurnActionEntity,
    char: CharacterEntity,
    dmResult: AIDMResponse,
    hasFailureConsequence: boolean,
    itemActivitiesByCharacter: Record<string, string[]>,
    inventoryNotifications: InventoryNotification[]
  ): void {
    if (!action || !char) return;

    const pickupRegex = /(подня(л|ть|ли|ла)|подобра(л|ть|ли|ла)|вытащи(л|ть|ли|ла)|выдерну(л|ть|ли|ла)|схвати(л|ть|ли|ла)|подхвати(л|ть|ли|ла)|наш(ел|ла|ли)|забра(л|ть|ли|ла)|верну(л|ть|ли|ла)|достал(а)?|взя(л|ть|ла|ли))/i;
    const actionLower = (action.actionText || '').toLowerCase();
    const narrativeLower = (dmResult.narrative || '').toLowerCase();

    if (!pickupRegex.test(actionLower) && !pickupRegex.test(narrativeLower)) return;

    const roll = action.diceRolls && action.diceRolls.length > 0 ? action.diceRolls[0] : (action as any).diceRoll;
    const isRollSuccess = roll ? roll.isCriticalSuccess || roll.isNat20 || roll.total >= (room.targetDC || 12) : true;

    if (!isRollSuccess || hasFailureConsequence) return;

    const freshChar = this.characters.findById(char.id) || char;
    const currentInv = freshChar.inventory || [];

    const isAlreadyRecoveredOrAdded = (nameLower: string) => {
      const inCurrentInv = currentInv.some(
        (i) => i.name.toLowerCase().trim() === nameLower || i.name.toLowerCase().includes(nameLower)
      );
      const addedInDm =
        Array.isArray(dmResult.inventoryUpdates) &&
        dmResult.inventoryUpdates.some(
          (u) =>
            u.action === 'add' &&
            (u.characterId === char.id || u.characterName?.toLowerCase() === char.name.toLowerCase()) &&
            u.item &&
            (u.item.name.toLowerCase().includes(nameLower) || nameLower.includes(u.item.name.toLowerCase().trim()))
        );
      const addedInNotifications = inventoryNotifications.some(
        (n) =>
          n.characterId === char.id &&
          n.action === 'add' &&
          (n.itemName.toLowerCase().includes(nameLower) || nameLower.includes(n.itemName.toLowerCase().trim()))
      );
      return inCurrentInv || addedInDm || addedInNotifications;
    };

    const lootList = [...(room.availableLoot || [])];
    for (const loot of lootList) {
      if (!loot || !loot.name) continue;
      const lootLower = loot.name.toLowerCase().trim();
      const isMatched =
        actionLower.includes(lootLower) ||
        (lootLower.length > 4 && actionLower.includes(lootLower.slice(0, -2))) ||
        (loot.type === 'weapon' && /(оружие|секир|топор|меч|клинок|лук|арбалет|щит|кинжал|молот)/i.test(actionLower));

      if (isMatched && !isAlreadyRecoveredOrAdded(lootLower)) {
        const reason = `Успешно поднято из грязи / с земли в раунде ${room.roundNumber}`;
        const newInvItem = {
          id: loot.id || crypto.randomUUID(),
          name: loot.name,
          type: loot.type,
          description: loot.description || 'Предмет, поднятый с земли.',
          quantity: loot.quantity || 1,
          damage: loot.damage,
          ac_bonus: loot.ac_bonus,
          healAmount: loot.healAmount,
          history: [reason],
        };

        this.characters.addItemToInventory(char.id, newInvItem, reason);
        this.rooms.removeLoot(room.id, loot.id);

        if (!char.activeWeaponId && loot.type === 'weapon') {
          this.characters.equipWeapon(char.id, newInvItem.id);
        }

        inventoryNotifications.push({
          id: crypto.randomUUID(),
          characterId: char.id,
          characterName: char.name,
          action: 'add',
          itemName: newInvItem.name,
          quantity: newInvItem.quantity || 1,
          reason,
          timestamp: new Date().toISOString(),
        });

        if (!itemActivitiesByCharacter[char.id]) itemActivitiesByCharacter[char.id] = [];
        itemActivitiesByCharacter[char.id].push(`Поднят предмет: ${newInvItem.name}`);
        break;
      }
    }
  }
}

export const inventoryLedgerService = new InventoryLedgerService();
