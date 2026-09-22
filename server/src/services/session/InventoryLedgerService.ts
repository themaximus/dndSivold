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
import { stemRussianWord } from './SceneEntityManager';

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
   * Checks if action text targets an already searched/exhausted object, vehicle, room, or container.
   */
  public findMatchingSearchedObject(
    actionText: string,
    searchedObjects: SearchedObjectEntry[]
  ): SearchedObjectEntry | undefined {
    if (!searchedObjects || searchedObjects.length === 0) return undefined;
    const textLower = (actionText || '').toLowerCase();

    // Check if the action conveys search / investigation / looting / unlocking intent
    const isSearchIntent = /(обыск|поиск|искать|ищу|обшар|переры(ть|л|ваю)|вскры(ть|л|ваю)|провер(ить|яю|ка)|осмотр|исследовать|лут|loot|search|investigat)/i.test(textLower);
    if (!isSearchIntent) return undefined;

    return searchedObjects.find((obj) => {
      const objNameLower = (obj.targetName || '').toLowerCase();
      // 1. Direct substring match
      if (textLower.includes(objNameLower)) return true;

      // 2. Word stems match (handles Russian inflections: повозка -> повозку/повозке, сундук -> сундука, etc.)
      const words = objNameLower.split(/[\s,()]+/).filter((w) => w.length >= 3);
      for (const w of words) {
        const stem = w.replace(/[аяоеуыиью]+$/i, '');
        if (stem.length >= 3 && textLower.includes(stem)) {
          return true;
        }
      }

      // 3. Target type synonyms
      if (obj.targetType === 'vehicle' && /(повозк|телег|фургон|арб[аеыу]|wagon|cart)/i.test(textLower)) {
        return true;
      }
      if (obj.targetType === 'room' && /(комнат|помещени|зал|трактир|хижин|подвал|комнату|room)/i.test(textLower)) {
        return true;
      }
      if (obj.targetType === 'container' && /(сундук|ящик|шкаф|сейф|бочк|короб|chest|box)/i.test(textLower)) {
        return true;
      }

      return false;
    });
  }

  /**
   * Applies inventory updates from AI or DM resolution, recording ledger entries.
   */
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

    // Collect all characters currently in the room
    const roomPlayers = this.rooms.findPlayersByRoomId(room.id);
    const roomCharacters: CharacterEntity[] = [];
    for (const p of roomPlayers) {
      if (p.characterId) {
        const c = this.characters.findById(p.characterId);
        if (c) roomCharacters.push(c);
      }
    }

    for (const update of updates) {
      if (!update.item || !update.item.name) continue;

      let targetChar: CharacterEntity | undefined;

      // 1. Direct ID match within room characters
      if (update.characterId) {
        targetChar = roomCharacters.find((c) => c.id === update.characterId);
      }

      // 2. Match by exact or stemmed character name among room characters
      if (!targetChar && update.characterName) {
        const queryName = update.characterName.trim().toLowerCase();
        const stemmedQuery = stemRussianWord(queryName);

        targetChar = roomCharacters.find((c) => {
          const cName = c.name.trim().toLowerCase();
          return (
            cName === queryName ||
            stemRussianWord(cName) === stemmedQuery ||
            cName.includes(queryName) ||
            queryName.includes(cName)
          );
        });
      }

      // 3. Match if update.characterId was actually an alias/name (e.g. "char_kirilchik" or "Кирильчик")
      if (!targetChar && update.characterId) {
        const queryId = update.characterId.trim().toLowerCase();
        const stemmedId = stemRussianWord(queryId);

        targetChar = roomCharacters.find((c) => {
          const cName = c.name.trim().toLowerCase();
          return (
            cName === queryId ||
            stemRussianWord(cName) === stemmedId ||
            queryId.includes(cName) ||
            cName.includes(queryId)
          );
        });
      }

      // 4. Single-player fallback: if only 1 character is in the room, route updates to them
      if (!targetChar && roomCharacters.length === 1) {
        targetChar = roomCharacters[0];
      }

      // 5. Global database lookup fallback
      if (!targetChar && update.characterId) {
        targetChar = this.characters.findById(update.characterId);
      }

      if (!targetChar) continue;

      const itemName = update.item.name.trim();
      const qty = update.item.quantity || 1;

      // Auto-detect item type and weapon/armor/potion properties if omitted or generic
      let itemType: string = (update.item.type as any) || 'misc';
      let damage = update.item.damage;
      let ac_bonus = update.item.ac_bonus;
      let healAmount = update.item.healAmount;

      const lowerName = itemName.toLowerCase();
      if (!itemType || itemType === 'misc') {
        if (
          lowerName.includes('арбалет') ||
          lowerName.includes('лук') ||
          lowerName.includes('меч') ||
          lowerName.includes('топор') ||
          lowerName.includes('секира') ||
          lowerName.includes('кинжал') ||
          lowerName.includes('молот') ||
          lowerName.includes('копь') ||
          lowerName.includes('клинок') ||
          lowerName.includes('булава') ||
          lowerName.includes('посох')
        ) {
          itemType = 'weapon';
        } else if (
          lowerName.includes('щит') ||
          lowerName.includes('доспех') ||
          lowerName.includes('кольчуга') ||
          lowerName.includes('латы') ||
          lowerName.includes('шлем')
        ) {
          itemType = 'armor';
        } else if (
          lowerName.includes('зелье') ||
          lowerName.includes('эликсир') ||
          lowerName.includes('снадобье')
        ) {
          itemType = 'potion';
        }
      }

      // Sensible defaults for weapons/armor/potions if damage/bonus missing
      if (itemType === 'weapon' && !damage) {
        if (lowerName.includes('арбалет') || lowerName.includes('тяжел') || lowerName.includes('двуруч')) {
          damage = '1d8';
        } else if (lowerName.includes('секира') || lowerName.includes('великий')) {
          damage = '1d12';
        } else if (lowerName.includes('кинжал')) {
          damage = '1d4';
        } else {
          damage = '1d6';
        }
      }

      if (itemType === 'armor' && !ac_bonus) {
        if (lowerName.includes('щит')) ac_bonus = 2;
        else if (lowerName.includes('лат')) ac_bonus = 3;
        else ac_bonus = 1;
      }

      if (itemType === 'potion' && !healAmount) {
        healAmount = 8;
      }

      if (update.action === 'add') {
        const historyNote = update.reason || `Получено в раунде ${roundNumber}`;
        const itemPayload = {
          id: crypto.randomUUID(),
          name: itemName,
          type: itemType as any,
          description: update.item.description || 'Полученный предмет.',
          quantity: qty,
          damage,
          ac_bonus,
          healAmount,
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
   * Also guarantees that any items listed in extractedItems are added to the acting character's inventory
   * if not already added by inventoryUpdates.
   */
  public handleSearchedObjects(
    room: RoomEntity,
    roundNumber: number,
    searchedUpdates: SearchedObjectUpdate[] | undefined,
    actingCharacterName?: string,
    actingCharacterId?: string,
    inventoryNotifications?: InventoryNotification[],
    itemActivitiesByCharacter?: Record<string, string[]>
  ): void {
    if (!room.searchedObjectsRegistry) {
      room.searchedObjectsRegistry = [];
    }

    if (!searchedUpdates || !Array.isArray(searchedUpdates)) return;

    // Resolve room characters
    const roomPlayers = this.rooms.findPlayersByRoomId(room.id);
    const roomCharacters: CharacterEntity[] = [];
    for (const p of roomPlayers) {
      if (p.characterId) {
        const c = this.characters.findById(p.characterId);
        if (c) roomCharacters.push(c);
      }
    }

    let recipientChar: CharacterEntity | undefined;
    if (actingCharacterId) {
      recipientChar = roomCharacters.find((c) => c.id === actingCharacterId) || this.characters.findById(actingCharacterId);
    }
    if (!recipientChar && actingCharacterName) {
      const q = actingCharacterName.trim().toLowerCase();
      const sq = stemRussianWord(q);
      recipientChar = roomCharacters.find((c) => {
        const cName = c.name.trim().toLowerCase();
        return cName === q || stemRussianWord(cName) === sq || cName.includes(q) || q.includes(cName);
      });
    }
    if (!recipientChar && roomCharacters.length === 1) {
      recipientChar = roomCharacters[0];
    }

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

      // GUARANTEE: If items were extracted, ensure they exist in recipient character's inventory!
      if (recipientChar && update.extractedItems && update.extractedItems.length > 0) {
        const freshChar = this.characters.findById(recipientChar.id) || recipientChar;
        for (const rawItemName of update.extractedItems) {
          if (!rawItemName || typeof rawItemName !== 'string') continue;
          const cleanItemName = rawItemName.trim();
          if (!cleanItemName) continue;

          // Check if already notified or added this round
          const alreadyNotified = inventoryNotifications?.some(
            (n) => n.characterId === freshChar.id && n.itemName.toLowerCase().trim() === cleanItemName.toLowerCase()
          );
          const alreadyInInventory = freshChar.inventory?.some(
            (i) => i.name.toLowerCase().trim() === cleanItemName.toLowerCase()
          );

          if (!alreadyNotified && !alreadyInInventory) {
            const lowerName = cleanItemName.toLowerCase();
            let type: any = 'misc';
            let damage: string | undefined;
            let quantity = 1;

            if (
              lowerName.includes('арбалет') ||
              lowerName.includes('лук') ||
              lowerName.includes('меч') ||
              lowerName.includes('топор') ||
              lowerName.includes('секира') ||
              lowerName.includes('кинжал') ||
              lowerName.includes('молот') ||
              lowerName.includes('копь')
            ) {
              type = 'weapon';
              damage = lowerName.includes('арбалет') ? '1d8' : lowerName.includes('секира') ? '1d12' : '1d6';
            } else if (lowerName.includes('болт') || lowerName.includes('стрел')) {
              type = 'misc';
              quantity = 20;
            } else if (lowerName.includes('зелье') || lowerName.includes('эликсир') || lowerName.includes('снадобье')) {
              type = 'potion';
            }

            const historyNote = `Извлечено из: ${update.targetName || 'тайника'} в раунде ${roundNumber}`;
            const itemPayload = {
              id: crypto.randomUUID(),
              name: cleanItemName,
              type,
              description: `Предмет, найденный при обыске (${update.targetName || 'тайник'}).`,
              quantity,
              damage,
              history: [historyNote],
            };

            this.characters.addItemToInventory(freshChar.id, itemPayload, historyNote);

            this.itemLedgers.recordItemEvent(
              freshChar.id,
              freshChar.name,
              itemPayload.id,
              itemPayload.name,
              itemPayload.type,
              'in_inventory',
              quantity,
              roundNumber,
              historyNote,
              room.id
            );

            if (inventoryNotifications) {
              inventoryNotifications.push({
                id: crypto.randomUUID(),
                characterId: freshChar.id,
                characterName: freshChar.name,
                action: 'add',
                itemName: cleanItemName,
                quantity,
                reason: historyNote,
                timestamp: new Date().toISOString(),
              });
            }

            if (itemActivitiesByCharacter) {
              if (!itemActivitiesByCharacter[freshChar.id]) itemActivitiesByCharacter[freshChar.id] = [];
              itemActivitiesByCharacter[freshChar.id].push(`Извлечен предмет: ${cleanItemName} (${quantity} шт.)`);
            }
          }
        }
      }
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
