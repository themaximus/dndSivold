import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { executeServerRoll, RollRequest } from '../services/diceEngine';
import { gameSessionService } from '../services/game/GameSessionService';
import {
  userRepository,
  characterRepository,
  roomRepository,
  gameLogRepository,
} from '../repositories';
import { sanitizeRoom } from '../services/security/CryptoService';

interface AuthenticatedSocket extends Socket {
  userId?: string;
  username?: string;
}

export function setupGameSockets(io: Server) {
  // Authentication middleware
  io.use((socket: AuthenticatedSocket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) {
      return next(new Error('Authentication token required'));
    }

    try {
      const decoded = jwt.verify(token, config.jwtSecret) as { userId: string };
      const user = userRepository.findById(decoded.userId);
      if (!user) {
        return next(new Error('User not found'));
      }
      socket.userId = user.id;
      socket.username = user.username;
      next();
    } catch (err) {
      return next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket: AuthenticatedSocket) => {
    const userId = socket.userId!;
    const username = socket.username!;

    // Join room
    socket.on('join_room', async ({ roomCode, characterId }: { roomCode: string; characterId?: string }) => {
      const roomData = gameSessionService.joinRoom(roomCode, userId, username);
      if (!roomData) {
        socket.emit('error_message', 'Комната не найдена');
        return;
      }
      if ('error' in roomData) {
        socket.emit('error_message', roomData.error);
        return;
      }

      (socket as any).currentRoomId = roomData.room.id;
      (socket as any).currentRoomCode = roomCode;

      socket.join(roomData.room.id);

      if (characterId) {
        gameSessionService.selectCharacter(roomData.room.id, userId, characterId);
      }

      const updated = gameSessionService.getRoomAndPlayers(roomCode);
      if (updated) {
        io.to(updated.room.id).emit('room_players_updated', updated.players);
        socket.emit('room_state', {
          room: sanitizeRoom(updated.room),
          players: updated.players,
          logs: gameLogRepository.findByRoomId(updated.room.id),
        });
      }
    });

    // Select character
    socket.on('select_character', ({ roomCode, characterId }: { roomCode: string; characterId: string }) => {
      const room = roomRepository.findByCode(roomCode);
      if (!room) return;

      const updated = gameSessionService.selectCharacter(room.id, userId, characterId);
      if (updated) {
        io.to(room.id).emit('room_players_updated', updated.players);
      }
    });

    // Toggle player ready status
    socket.on('toggle_ready', ({ roomCode }: { roomCode: string }) => {
      const room = roomRepository.findByCode(roomCode);
      if (!room) return;

      const player = roomRepository.findPlayer(room.id, userId);
      if (player && player.characterId) {
        roomRepository.updatePlayer(player.id, { isReady: !player.isReady });
        const updated = gameSessionService.getRoomAndPlayers(roomCode);
        if (updated) {
          io.to(room.id).emit('room_players_updated', updated.players);
        }
      }
    });

    // Start game
    socket.on('start_game', async ({ roomCode }: { roomCode: string }) => {
      const room = roomRepository.findByCode(roomCode);
      if (!room || room.hostUserId !== userId) return;

      io.to(room.id).emit('dm_thinking');

      const updated = await gameSessionService.startGame(room.id, userId);
      if (updated) {
        const logs = gameLogRepository.findByRoomId(room.id);
        io.to(room.id).emit('game_started', {
          room: sanitizeRoom(updated.room),
          players: updated.players,
          logs,
        });

        if (logs.length > 0) {
          io.to(room.id).emit('narrator_playing', {
            logId: logs[0].id,
            narrativeText: logs[0].narrativeText,
            mood: 'mystery',
            startedBy: 'DM',
          });
        }
      }
    });

    // Perform server-side anti-cheat dice roll (Single roll per turn in active room)
    socket.on('roll_dice', (data: { roomCode: string; request: RollRequest }) => {
      const room = roomRepository.findByCode(data.roomCode);
      if (!room) return;

      const player = roomRepository.findPlayer(room.id, userId);

      // In active gameplay, block roll only if the player has already submitted their turn
      if (room.status === 'active' && player?.hasActedThisRound) {
        socket.emit('dice_roll_rejected', {
          message: 'Вы уже завершили свой ход в этом раунде! Ожидайте начала следующего раунда.',
        });
        return;
      }

      const character = player?.characterId ? characterRepository.findById(player.characterId) : undefined;
      const rollResult = executeServerRoll(data.request, character);

      io.to(room.id).emit('dice_rolled', {
        playerId: userId,
        username,
        characterName: character?.name || username,
        roll: rollResult,
      });

      socket.emit('your_dice_result', rollResult);
    });

    // Submit player action for round
    socket.on('submit_action', async (data: { roomCode: string; actionText: string; diceRolls: any[] }) => {
      const submission = gameSessionService.submitAction(
        data.roomCode,
        userId,
        data.actionText,
        data.diceRolls
      );

      if (!submission) return;

      const { room, characterName, shouldResolveRound } = submission;

      // Broadcast that player submitted their action
      io.to(room.id).emit('player_action_submitted', {
        userId,
        characterName,
        hasActedThisRound: true,
        room,
      });

      // If all active players have submitted, resolve round with AI DM
      if (shouldResolveRound) {
        io.to(room.id).emit('dm_thinking');

        try {
          const resolved = await gameSessionService.resolveRound(room.id);
          if (resolved) {
            io.to(room.id).emit('round_resolved', {
              ...resolved,
              room: sanitizeRoom(resolved.room),
            });
            io.to(room.id).emit('room_players_updated', resolved.players);
            io.to(room.id).emit('narrator_playing', {
              logId: resolved.log.id,
              narrativeText: resolved.log.narrativeText,
              startedBy: 'DM',
            });
          }
        } catch (error: any) {
          console.error('Error resolving round via GameSessionService:', error);
          io.to(room.id).emit('error_message', 'Ошибка при обработке раунда мастером');
        }
      }
    });

    // Host toggles turn mode (simultaneous vs turn_by_turn)
    socket.on('set_turn_mode', ({ roomCode, mode }: { roomCode: string; mode: 'simultaneous' | 'turn_by_turn' }) => {
      const room = roomRepository.findByCode(roomCode);
      if (!room || room.hostUserId !== userId) return;

      const updated = gameSessionService.setTurnMode(room.id, mode);
      if (updated) {
        io.to(room.id).emit('room_updated', updated);
        const data = gameSessionService.getRoomAndPlayers(roomCode);
        if (data) {
          io.to(room.id).emit('room_players_updated', data.players);
        }
      }
    });

    // Loot pickup from story
    socket.on('pickup_loot', ({ roomCode, lootId, characterId }: { roomCode: string; lootId: string; characterId: string }) => {
      const room = roomRepository.findByCode(roomCode);
      if (!room) return;

      const result = gameSessionService.pickupLoot(room.id, characterId, lootId);
      if (result) {
        io.to(room.id).emit('loot_picked_up', {
          lootId,
          characterId,
          item: result.item,
          character: result.character,
          room: sanitizeRoom(result.room),
        });

        const updated = gameSessionService.getRoomAndPlayers(roomCode);
        if (updated) {
          io.to(room.id).emit('room_players_updated', updated.players);
        }
      }
    });

    // Use consumable item (e.g. healing potion)
    socket.on('use_item', ({ roomCode, characterId, itemId }: { roomCode: string; characterId: string; itemId: string }) => {
      const room = roomRepository.findByCode(roomCode);
      if (!room) return;

      const result = gameSessionService.useItem(characterId, itemId);
      if (result.character) {
        io.to(room.id).emit('item_used', {
          characterId,
          character: result.character,
          itemName: result.itemName,
          healAmount: result.healAmount,
        });

        const updated = gameSessionService.getRoomAndPlayers(roomCode);
        if (updated) {
          io.to(room.id).emit('room_players_updated', updated.players);
        }
      }
    });

    // Equip weapon
    socket.on('equip_weapon', ({ roomCode, characterId, itemId }: { roomCode: string; characterId: string; itemId: string }) => {
      const room = roomRepository.findByCode(roomCode);
      if (!room) return;

      const updatedChar = gameSessionService.equipWeapon(characterId, itemId);
      if (updatedChar) {
        io.to(room.id).emit('character_updated', updatedChar);

        const updated = gameSessionService.getRoomAndPlayers(roomCode);
        if (updated) {
          io.to(room.id).emit('room_players_updated', updated.players);
        }
      }
    });

    // Roll Death Saving Throw (0 HP)
    socket.on(
      'roll_death_save',
      ({
        roomCode,
        characterId,
        rollResult,
      }: {
        roomCode: string;
        characterId: string;
        rollResult: { rollTotal: number; isNat20: boolean; isNat1: boolean };
      }) => {
        const room = roomRepository.findByCode(roomCode);
        if (!room) return;

        const outcome = gameSessionService.rollDeathSave(characterId, rollResult);
        if (outcome.character) {
          io.to(room.id).emit('death_save_result', {
            characterId,
            character: outcome.character,
            message: outcome.message,
            state: outcome.state,
            roll: rollResult,
          });

          const updated = gameSessionService.getRoomAndPlayers(roomCode);
          if (updated) {
            io.to(room.id).emit('room_players_updated', updated.players);
          }
        }
      }
    );

    // Get character talent tree (generated procedurally based on quenta & class)
    socket.on('get_talents', ({ characterId }: { characterId: string }) => {
      const tree = gameSessionService.getCharacterTalents(characterId);
      if (tree) {
        socket.emit('talents_loaded', { characterId, tree });
      }
    });

    // Learn talent
    socket.on('learn_talent', ({ roomCode, characterId, talentId }: { roomCode: string; characterId: string; talentId: string }) => {
      const room = roomRepository.findByCode(roomCode);
      const updatedChar = gameSessionService.learnTalent(characterId, talentId);
      if (updatedChar) {
        socket.emit('character_updated', updatedChar);
        if (room) {
          io.to(room.id).emit('character_updated', updatedChar);

          const updated = gameSessionService.getRoomAndPlayers(roomCode);
          if (updated) {
            io.to(room.id).emit('room_players_updated', updated.players);
          }
        }
      }
    });

    // Force DM turn resolution by room host
    socket.on('force_resolve_round', async ({ roomCode }: { roomCode: string }) => {
      const room = roomRepository.findByCode(roomCode);
      if (!room || room.hostUserId !== userId || room.status !== 'active') return;

      io.to(room.id).emit('dm_thinking');
      try {
        const resolved = await gameSessionService.resolveRound(room.id);
        if (resolved) {
          io.to(room.id).emit('round_resolved', {
            ...resolved,
            room: sanitizeRoom(resolved.room),
          });
          io.to(room.id).emit('narrator_playing', {
            logId: resolved.log.id,
            narrativeText: resolved.log.narrativeText,
            startedBy: 'DM',
          });
        }
      } catch (error: any) {
        console.error('Error in force_resolve_round:', error);
        io.to(room.id).emit('error_message', 'Ошибка при обработке раунда мастером');
      }
    });

    // Synchronize TTS Narrator playback across all players in the room
    socket.on('narrator_play', ({ roomCode, logId, narrativeText, mood }: { roomCode: string; logId: string; narrativeText: string; mood?: string }) => {
      const room = roomRepository.findByCode(roomCode);
      if (!room) return;

      io.to(room.id).emit('narrator_playing', {
        logId,
        narrativeText,
        mood,
        startedBy: username,
      });
    });

    socket.on('narrator_stop', ({ roomCode }: { roomCode: string }) => {
      const room = roomRepository.findByCode(roomCode);
      if (!room) return;

      io.to(room.id).emit('narrator_stopped', {
        stoppedBy: username,
      });
    });

    socket.on('disconnect', () => {
      const roomId = (socket as any).currentRoomId;
      const roomCode = (socket as any).currentRoomCode;
      if (roomId && roomCode) {
        gameSessionService.setPlayerOnline(roomId, userId, false);
        const updated = gameSessionService.getRoomAndPlayers(roomCode);
        if (updated) {
          io.to(roomId).emit('room_players_updated', updated.players);
        }
      }
    });
  });
}
