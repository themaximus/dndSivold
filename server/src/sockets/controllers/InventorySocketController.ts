import crypto from 'crypto';
import { Server } from 'socket.io';
import { AuthenticatedSocket } from './TurnSocketController';
import { systemLocator } from '../../services/session/ServiceLocator';
import { sanitizeRoom } from '../../services/security/CryptoService';
import { roomRepository } from '../../repositories';

export class InventorySocketController {
  private get inventoryService() {
    return systemLocator.get('inventoryLedgerService');
  }

  private get progressionService() {
    return systemLocator.get('characterProgressionService');
  }

  private get roomManager() {
    return systemLocator.get('roomSessionManager');
  }

  public handleSetTurnMode(
    io: Server,
    socket: AuthenticatedSocket,
    { roomCode, mode }: { roomCode: string; mode: 'simultaneous' | 'turn_by_turn' }
  ): void {
    const userId = socket.userId!;
    const room = roomRepository.findByCode(roomCode);
    if (!room || room.hostUserId !== userId) return;

    const updated = this.roomManager.setTurnMode(room.id, mode);
    if (updated) {
      io.to(room.id).emit('room_updated', updated);
    }
  }

  public handlePickupLoot(
    io: Server,
    socket: AuthenticatedSocket,
    { roomCode, lootId, characterId }: { roomCode: string; lootId: string; characterId: string }
  ): void {
    const room = roomRepository.findByCode(roomCode);
    if (!room) return;

    const result = this.inventoryService.pickupLoot(room.id, characterId, lootId);
    if (result && result.character) {
      io.to(room.id).emit('loot_picked_up', {
        lootId,
        characterId: result.character.id,
        item: result.item,
        character: result.character,
        room: sanitizeRoom(result.room),
      });

      io.to(room.id).emit('character_updated', result.character);

      const charName = result.character.name || 'Герой';
      io.to(room.id).emit('feed_activity', {
        id: crypto.randomUUID(),
        type: 'loot_pickup',
        text: `📦 ${charName} подобрал трофей: ${result.item.name}`,
        timestamp: new Date().toISOString(),
      });

      const updatedRoom = roomRepository.addMilestones(room.id, [
        {
          id: crypto.randomUUID(),
          round: room.roundNumber,
          milestone: `📦 ${charName} подобрал предмет: «${result.item.name}».`,
          timestamp: new Date().toISOString(),
        },
      ]);

      if (updatedRoom) {
        io.to(room.id).emit('room_updated', sanitizeRoom(updatedRoom));
      }

      io.to(room.id).emit('inventory_notification', {
        id: crypto.randomUUID(),
        characterId: result.character.id,
        characterName: charName,
        action: 'add',
        itemName: result.item.name,
        quantity: 1,
        reason: 'Подобран трофей с поля боя',
        timestamp: new Date().toISOString(),
      });

      const updated = this.roomManager.getRoomAndPlayers(roomCode);
      if (updated) {
        io.to(room.id).emit('room_players_updated', updated.players);
      }
    }
  }

  public handleUseItem(
    io: Server,
    socket: AuthenticatedSocket,
    {
      roomCode,
      characterId,
      itemId,
      targetName,
    }: { roomCode: string; characterId: string; itemId: string; targetName?: string }
  ): void {
    const room = roomRepository.findByCode(roomCode);
    if (!room) return;

    const result = this.inventoryService.useItem(characterId, itemId, targetName);
    if (result.character) {
      io.to(room.id).emit('item_used', {
        characterId,
        character: result.character,
        itemName: result.itemName,
        healAmount: result.healAmount,
        targetName,
      });

      const healNote = result.healAmount > 0 ? ` (+${result.healAmount} HP)` : '';
      const targetNote = targetName ? ` на цели «${targetName}»` : '';
      io.to(room.id).emit('feed_activity', {
        id: crypto.randomUUID(),
        type: 'item_used',
        text: `🧪 ${result.character.name} использовал предмет: «${result.itemName}»${targetNote}${healNote}`,
        timestamp: new Date().toISOString(),
      });

      const updatedRoom = roomRepository.addMilestones(room.id, [
        {
          id: crypto.randomUUID(),
          round: room.roundNumber,
          milestone: `🧪 ${result.character.name} использовал предмет: «${result.itemName}»${targetNote}${healNote}.`,
          timestamp: new Date().toISOString(),
        },
      ]);

      if (updatedRoom) {
        io.to(room.id).emit('room_updated', sanitizeRoom(updatedRoom));
      }

      io.to(room.id).emit('inventory_notification', {
        id: crypto.randomUUID(),
        characterId: result.character.id,
        characterName: result.character.name,
        action: 'remove',
        itemName: result.itemName,
        quantity: 1,
        reason: result.healAmount > 0 ? `Исцеление (+${result.healAmount} HP)` : 'Использован предмет',
        timestamp: new Date().toISOString(),
      });

      io.to(room.id).emit('character_updated', result.character);

      const updated = this.roomManager.getRoomAndPlayers(roomCode);
      if (updated) {
        io.to(room.id).emit('room_players_updated', updated.players);
      }
    }
  }

  public handleDropItem(
    io: Server,
    socket: AuthenticatedSocket,
    { roomCode, characterId, itemId }: { roomCode: string; characterId: string; itemId: string }
  ): void {
    const room = roomRepository.findByCode(roomCode);
    if (!room) return;

    const result = this.inventoryService.dropItem(room.id, characterId, itemId);
    if (result && result.character) {
      io.to(room.id).emit('item_dropped', {
        itemId,
        characterId: result.character.id,
        item: result.item,
        character: result.character,
        room: result.room,
      });

      io.to(room.id).emit('character_updated', result.character);

      const charName = result.character.name || 'Герой';
      io.to(room.id).emit('feed_activity', {
        id: crypto.randomUUID(),
        type: 'item_dropped',
        text: `🗑️ ${charName} выбросил предмет: «${result.item.name}»`,
        timestamp: new Date().toISOString(),
      });

      const updatedRoom = roomRepository.addMilestones(room.id, [
        {
          id: crypto.randomUUID(),
          round: room.roundNumber,
          milestone: `🗑️ ${charName} оставил на земле предмет: «${result.item.name}».`,
          timestamp: new Date().toISOString(),
        },
      ]);

      if (updatedRoom) {
        io.to(room.id).emit('room_updated', sanitizeRoom(updatedRoom));
      }

      io.to(room.id).emit('inventory_notification', {
        id: crypto.randomUUID(),
        characterId: result.character.id,
        characterName: charName,
        action: 'remove',
        itemName: result.item.name,
        quantity: 1,
        reason: 'Предмет выброшен из инвентаря на землю',
        timestamp: new Date().toISOString(),
      });

      const updated = this.roomManager.getRoomAndPlayers(roomCode);
      if (updated) {
        io.to(room.id).emit('room_players_updated', updated.players);
      }
    }
  }

  public handleEquipWeapon(
    io: Server,
    socket: AuthenticatedSocket,
    { roomCode, characterId, itemId }: { roomCode: string; characterId: string; itemId: string }
  ): void {
    const room = roomRepository.findByCode(roomCode);
    if (!room) return;

    const updatedChar = this.inventoryService.equipWeapon(characterId, itemId);
    if (updatedChar) {
      io.to(room.id).emit('character_updated', updatedChar);

      const weapon = updatedChar.inventory?.find((i) => i.id === itemId);
      const weaponName = weapon?.name || 'Оружие';
      io.to(room.id).emit('feed_activity', {
        id: crypto.randomUUID(),
        type: 'gear_equipped',
        text: `⚔️ ${updatedChar.name} экипировал оружие: ${weaponName}`,
        timestamp: new Date().toISOString(),
      });

      const updated = this.roomManager.getRoomAndPlayers(roomCode);
      if (updated) {
        io.to(room.id).emit('room_players_updated', updated.players);
      }
    }
  }

  public handleShortRest(
    io: Server,
    socket: AuthenticatedSocket,
    { roomCode, characterId, diceCount }: { roomCode: string; characterId: string; diceCount?: number },
    callback?: (res: any) => void
  ): void {
    const room = roomRepository.findByCode(roomCode);
    if (!room) {
      if (callback) callback({ error: 'Комната не найдена' });
      return;
    }

    try {
      const result = this.progressionService.performShortRest(room.id, characterId, diceCount);
      if (result.character) {
        io.to(room.id).emit('character_updated', result.character);
        io.to(room.id).emit('rest_completed', {
          type: 'short',
          characterId,
          characterName: result.character.name,
          healedHp: result.healedHp,
          diceSpent: result.diceSpent,
          rolls: result.rolls,
        });

        io.to(room.id).emit('feed_activity', {
          id: crypto.randomUUID(),
          type: 'rest',
          text: `⛺ ${result.character.name} завершил короткий отдых (+${result.healedHp} HP)`,
          timestamp: new Date().toISOString(),
        });

        const updated = this.roomManager.getRoomAndPlayers(roomCode);
        if (updated) {
          io.to(room.id).emit('room_players_updated', updated.players);
        }

        if (callback) callback({ success: true, ...result });
      }
    } catch (err: any) {
      if (callback) callback({ error: err.message });
    }
  }

  public handleLongRest(
    io: Server,
    socket: AuthenticatedSocket,
    { roomCode, characterId }: { roomCode: string; characterId: string },
    callback?: (res: any) => void
  ): void {
    const room = roomRepository.findByCode(roomCode);
    if (!room) {
      if (callback) callback({ error: 'Комната не найдена' });
      return;
    }

    try {
      const result = this.progressionService.performLongRest(room.id, characterId);
      if (result.character) {
        io.to(room.id).emit('character_updated', result.character);
        io.to(room.id).emit('rest_completed', {
          type: 'long',
          characterId,
          characterName: result.character.name,
          healedHp: result.healedHp,
        });

        io.to(room.id).emit('feed_activity', {
          id: crypto.randomUUID(),
          type: 'rest',
          text: `🌙 ${result.character.name} совершил продолжительный отдых (HP и слоты восстановлены)`,
          timestamp: new Date().toISOString(),
        });

        const updated = this.roomManager.getRoomAndPlayers(roomCode);
        if (updated) {
          io.to(room.id).emit('room_players_updated', updated.players);
        }

        if (callback) callback({ success: true, ...result });
      }
    } catch (err: any) {
      if (callback) callback({ error: err.message });
    }
  }

  public handleLearnTalent(
    io: Server,
    socket: AuthenticatedSocket,
    { roomCode, characterId, talentId }: { roomCode: string; characterId: string; talentId: string },
    callback?: (res: any) => void
  ): void {
    const room = roomRepository.findByCode(roomCode);
    if (!room) {
      if (callback) callback({ error: 'Комната не найдена' });
      return;
    }

    const updatedChar = this.progressionService.learnTalent(characterId, talentId);
    if (updatedChar) {
      io.to(room.id).emit('character_updated', updatedChar);
      const talentTree = this.progressionService.getCharacterTalents(characterId);
      const allTalents = talentTree
        ? [
            ...talentTree.classBranch.talents,
            ...talentTree.raceBranch.talents,
            ...talentTree.quentaBranch.talents,
          ]
        : [];
      const learned = allTalents.find((t) => t.id === talentId);

      io.to(room.id).emit('feed_activity', {
        id: crypto.randomUUID(),
        type: 'talent_learned',
        text: `✨ ${updatedChar.name} освоил талант: «${learned?.name || talentId}»`,
        timestamp: new Date().toISOString(),
      });

      const updated = this.roomManager.getRoomAndPlayers(roomCode);
      if (updated) {
        io.to(room.id).emit('room_players_updated', updated.players);
      }

      if (callback) callback({ success: true, character: updatedChar });
    } else {
      if (callback) callback({ error: 'Не удалось изучить талант' });
    }
  }

  public handleGetTalents(
    socket: AuthenticatedSocket,
    { characterId }: { characterId: string }
  ): void {
    const tree = this.progressionService.getCharacterTalents(characterId);
    if (tree) {
      socket.emit('talents_loaded', { characterId, tree });
    }
  }

  public handleRollDeathSave(
    io: Server,
    socket: AuthenticatedSocket,
    {
      roomCode,
      characterId,
      rollResult,
    }: {
      roomCode: string;
      characterId: string;
      rollResult: { rollTotal: number; isNat20: boolean; isNat1: boolean };
    }
  ): void {
    const room = roomRepository.findByCode(roomCode);
    if (!room) return;

    const outcome = this.progressionService.rollDeathSave(characterId, rollResult);
    if (outcome.character) {
      io.to(room.id).emit('death_save_result', {
        characterId,
        character: outcome.character,
        message: outcome.message,
        state: outcome.state,
        roll: rollResult,
      });

      io.to(room.id).emit('character_updated', outcome.character);

      io.to(room.id).emit('feed_activity', {
        id: crypto.randomUUID(),
        type: 'death_save',
        text: `💀 ${outcome.character.name}: ${outcome.message}`,
        timestamp: new Date().toISOString(),
      });

      const updated = this.roomManager.getRoomAndPlayers(roomCode);
      if (updated) {
        io.to(room.id).emit('room_players_updated', updated.players);
      }
    }
  }

  public handleFinishAdventure(
    io: Server,
    socket: AuthenticatedSocket,
    {
      roomCode,
      finishType,
      title,
      epilogue,
    }: {
      roomCode: string;
      finishType: 'cliffhanger' | 'triumph' | 'open_ended';
      title?: string;
      epilogue?: string;
    }
  ): void {
    const userId = socket.userId!;
    const room = roomRepository.findByCode(roomCode);
    if (!room || room.hostUserId !== userId) return;

    const result = this.roomManager.finishAdventure(room.id, finishType, title, epilogue);
    if (result) {
      io.to(room.id).emit('room_updated', sanitizeRoom(result.room));
      io.to(room.id).emit('new_log', result.log);
      io.to(room.id).emit('adventure_finished', {
        finishType,
        title: title || (finishType === 'cliffhanger' ? 'Сессия завершена' : 'Триумф приключения'),
        epilogue: result.log.narrativeText,
      });
      io.to(room.id).emit('feed_activity', {
        id: crypto.randomUUID(),
        type: 'adventure_finished',
        text:
          finishType === 'cliffhanger'
            ? '🌙 Сессия завершена на захватывающем клиффхэнгере! До встречи на следующей встрече!'
            : '🏆 Приключение триумфально завершено! Поздравляем отряд с великой победой!',
        timestamp: new Date().toISOString(),
      });
    }
  }
}

export const inventorySocketController = new InventorySocketController();
