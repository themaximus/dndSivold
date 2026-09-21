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

      // In active gameplay, block roll if the player has already submitted their turn OR already rolled this round
      if (room.status === 'active' && (player?.hasActedThisRound || player?.hasRolledThisRound)) {
        socket.emit('dice_roll_rejected', {
          message: 'Вы уже совершили бросок кубика для этого хода! Повторный переброс запрещен правилами честной игры.',
        });
        return;
      }

      const character = player?.characterId ? characterRepository.findById(player.characterId) : undefined;
      const rollResult = executeServerRoll(data.request, character);

      if (room.status === 'active' && player) {
        roomRepository.updatePlayer(player.id, {
          hasRolledThisRound: true,
          pendingRoll: rollResult,
        });
      }

      // Broadcast dice animation to other players in room (roller already has their own dice modal)
      socket.to(room.id).emit('dice_rolled', {
        playerId: userId,
        username,
        characterName: character?.name || username,
        roll: rollResult,
      });

      socket.emit('your_dice_result', rollResult);
    });

    // Submit player action for round
    socket.on('submit_action', async (data: {
      roomCode: string;
      actionText: string;
      diceRolls: any[];
      actionType?: 'attack' | 'check' | 'save' | 'improvise';
      targetEnemyId?: string;
      targetEnemyName?: string;
      advantage?: boolean;
      disadvantage?: boolean;
      spellLevelUsed?: number;
    }) => {
      const submission = gameSessionService.submitAction(
        data.roomCode,
        userId,
        data.actionText,
        data.diceRolls,
        {
          actionType: data.actionType,
          targetEnemyId: data.targetEnemyId,
          targetEnemyName: data.targetEnemyName,
          advantage: data.advantage,
          disadvantage: data.disadvantage,
          spellLevelUsed: data.spellLevelUsed,
        }
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

      // If action mentioned other characters, pause resolution and await companion reactions!
      if (submission.waitingForReactions) {
        io.to(room.id).emit('reactions_requested', {
          pendingReactions: submission.pendingReactions,
          room: submission.room,
        });

        submission.pendingReactions.forEach(r => {
          io.to(room.id).emit('feed_activity', {
            id: crypto.randomUUID(),
            type: 'player_action',
            text: `💬 ${characterName} вовлекает ${r.targetCharacterName} в совместное действие: «${r.initiatorActionText}». Ожидается реакция и бросок d20!`,
            timestamp: new Date().toISOString(),
          });
        });

        return;
      }

      // IN TURN-BY-TURN MODE: Resolve THIS player's turn step immediately!
      if (submission.isTurnByTurn) {
        io.to(room.id).emit('dm_thinking');

        try {
          const turnResolved = await gameSessionService.resolveTurnStep(room.id, userId);
          if (turnResolved) {
            if (turnResolved.rejectedAction) {
              io.to(room.id).emit('action_rejected', turnResolved.rejectedAction);
              io.to(room.id).emit('room_players_updated', turnResolved.players);
              return;
            }

            if (turnResolved.log) {
              const roll = data.diceRolls?.[0];
              const shortVerdict = roll?.isCriticalSuccess
                ? '★ Критический успех!'
                : roll?.isCriticalFail
                ? '☠ Критический провал!'
                : (roll?.total >= (room.targetDC || 12) ? '★ Успех' : '✗ Провал');

              io.to(room.id).emit('feed_activity', {
                id: crypto.randomUUID(),
                type: 'player_action',
                text: `🎲 ${characterName}: «${data.actionText}» (${shortVerdict})`,
                timestamp: new Date().toISOString(),
              });

              if (turnResolved.inventoryNotifications && turnResolved.inventoryNotifications.length > 0) {
                turnResolved.inventoryNotifications.forEach(notif => {
                  io.to(room.id).emit('inventory_notification', notif);
                  const icon = notif.action === 'add' ? '🎒' : '⚠️';
                  const actWord = notif.action === 'add' ? 'получил предмет' : 'потерял/израсходовал';
                  io.to(room.id).emit('feed_activity', {
                    id: crypto.randomUUID(),
                    type: notif.action === 'add' ? 'inventory_add' : 'inventory_remove',
                    text: `${icon} ${notif.characterName} ${actWord}: «${notif.itemName}» (${notif.reason})`,
                    timestamp: notif.timestamp,
                  });
                });
              }

              if (!turnResolved.isRoundComplete) {
                io.to(room.id).emit('turn_step_resolved', {
                  log: turnResolved.log,
                  room: sanitizeRoom(turnResolved.room),
                  players: turnResolved.players,
                  nextActiveUserId: turnResolved.nextActiveUserId,
                });
                io.to(room.id).emit('room_players_updated', turnResolved.players);
                io.to(room.id).emit('narrator_playing', {
                  logId: turnResolved.log.id,
                  narrativeText: turnResolved.log.narrativeText,
                  startedBy: 'DM',
                });
              } else {
                io.to(room.id).emit('round_resolved', {
                  log: turnResolved.log,
                  room: sanitizeRoom(turnResolved.room),
                  players: turnResolved.players,
                  nextRoundNumber: turnResolved.nextRoundNumber,
                });
                io.to(room.id).emit('room_players_updated', turnResolved.players);
                io.to(room.id).emit('narrator_playing', {
                  logId: turnResolved.log.id,
                  narrativeText: turnResolved.log.narrativeText,
                  startedBy: 'DM',
                });
              }
            }
          }
        } catch (error: any) {
          console.error('Error resolving turn step via GameSessionService:', error);
          io.to(room.id).emit('dm_thinking_failed', { error: error?.message || 'Ошибка обработки хода' });
          io.to(room.id).emit('error_message', 'Ошибка при обработке хода мастером. Попробуйте еще раз.');
        }
        return;
      }

      // IN SIMULTANEOUS MODE: If all active players have submitted, resolve round with AI DM
      if (shouldResolveRound) {
        io.to(room.id).emit('dm_thinking');

        try {
          const resolved = await gameSessionService.resolveRound(room.id);
          if (resolved) {
            if (resolved.rejectedAction) {
              io.to(room.id).emit('action_rejected', resolved.rejectedAction);
              io.to(room.id).emit('room_players_updated', resolved.players);
              return;
            }
            if (resolved.log) {
              if (resolved.inventoryNotifications && resolved.inventoryNotifications.length > 0) {
                resolved.inventoryNotifications.forEach(notif => {
                  io.to(room.id).emit('inventory_notification', notif);
                  const icon = notif.action === 'add' ? '🎒' : '⚠️';
                  const actWord = notif.action === 'add' ? 'получил предмет' : 'потерял/израсходовал';
                  io.to(room.id).emit('feed_activity', {
                    id: crypto.randomUUID(),
                    type: notif.action === 'add' ? 'inventory_add' : 'inventory_remove',
                    text: `${icon} ${notif.characterName} ${actWord}: «${notif.itemName}» (${notif.reason})`,
                    timestamp: notif.timestamp,
                  });
                });
              }

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
          }
        } catch (error: any) {
          console.error('Error resolving round via GameSessionService:', error);
          io.to(room.id).emit('dm_thinking_failed', { error: error?.message || 'Ошибка обработки раунда' });
          io.to(room.id).emit('error_message', 'Ошибка при обработке раунда мастером. Попробуйте еще раз или нажмите «Ход Мастера».');
        }
      }
    });

    // Player submits their reaction to being mentioned in another player's action
    socket.on('submit_reaction', async (data: {
      roomCode: string;
      reactionRequestId: string;
      reactionText: string;
      reactionRoll: any;
      responseType?: 'positive' | 'negative' | 'counter';
    }) => {
      const result = gameSessionService.submitReaction(
        data.roomCode,
        userId,
        data.reactionRequestId,
        data.reactionText,
        data.reactionRoll,
        data.responseType
      );
      if (!result) return;

      const { room, initiatorUserId, initiatorCharacterName, targetCharacterName, allCompleted, completedReactions, shouldResolveRound } = result;

      io.to(room.id).emit('reaction_updated', {
        reactionRequestId: data.reactionRequestId,
        room: sanitizeRoom(room),
      });

      const sign = data.reactionRoll?.modifier >= 0 ? '+' : '';
      const rollExpr = data.reactionRoll ? ` (d20 [${data.reactionRoll.baseRoll ?? data.reactionRoll.total}]${sign}${data.reactionRoll.modifier ?? 0} = ${data.reactionRoll.total})` : '';
      const typeLabel = data.responseType === 'negative' ? 'противодействует' : (data.responseType === 'counter' ? 'парирует/защищается' : 'содействует');
      io.to(room.id).emit('feed_activity', {
        id: crypto.randomUUID(),
        type: 'player_action',
        text: `⚡ ${targetCharacterName} ${typeLabel} действию ${initiatorCharacterName}: «${data.reactionText}»${rollExpr}`,
        timestamp: new Date().toISOString(),
      });

      // If all pending reactions are completed, proceed to DM resolution
      if (allCompleted) {
        if (room.turnMode === 'turn_by_turn') {
          io.to(room.id).emit('dm_thinking');
          try {
            const turnResolved = await gameSessionService.resolveTurnStep(room.id, initiatorUserId, completedReactions);
            if (turnResolved) {
              if (turnResolved.rejectedAction) {
                io.to(room.id).emit('action_rejected', turnResolved.rejectedAction);
                io.to(room.id).emit('room_players_updated', turnResolved.players);
                return;
              }

              if (turnResolved.log) {
                if (turnResolved.inventoryNotifications && turnResolved.inventoryNotifications.length > 0) {
                  turnResolved.inventoryNotifications.forEach(notif => {
                    io.to(room.id).emit('inventory_notification', notif);
                    const icon = notif.action === 'add' ? '🎒' : '⚠️';
                    const actWord = notif.action === 'add' ? 'получил предмет' : 'потерял/израсходовал';
                    io.to(room.id).emit('feed_activity', {
                      id: crypto.randomUUID(),
                      type: notif.action === 'add' ? 'inventory_add' : 'inventory_remove',
                      text: `${icon} ${notif.characterName} ${actWord}: «${notif.itemName}» (${notif.reason})`,
                      timestamp: notif.timestamp,
                    });
                  });
                }

                if (!turnResolved.isRoundComplete) {
                  io.to(room.id).emit('turn_step_resolved', {
                    log: turnResolved.log,
                    room: sanitizeRoom(turnResolved.room),
                    players: turnResolved.players,
                    nextActiveUserId: turnResolved.nextActiveUserId,
                  });
                  io.to(room.id).emit('room_players_updated', turnResolved.players);
                  io.to(room.id).emit('narrator_playing', {
                    logId: turnResolved.log.id,
                    narrativeText: turnResolved.log.narrativeText,
                    startedBy: 'DM',
                  });
                } else {
                  io.to(room.id).emit('round_resolved', {
                    log: turnResolved.log,
                    room: sanitizeRoom(turnResolved.room),
                    players: turnResolved.players,
                    nextRoundNumber: turnResolved.nextRoundNumber,
                  });
                  io.to(room.id).emit('room_players_updated', turnResolved.players);
                  io.to(room.id).emit('narrator_playing', {
                    logId: turnResolved.log.id,
                    narrativeText: turnResolved.log.narrativeText,
                    startedBy: 'DM',
                  });
                }
              }
            }
          } catch (error: any) {
            console.error('Error resolving turn step with reactions:', error);
            io.to(room.id).emit('dm_thinking_failed', { error: error?.message || 'Ошибка обработки хода' });
            io.to(room.id).emit('error_message', 'Ошибка при обработке хода мастером.');
          }
        } else if (shouldResolveRound) {
          io.to(room.id).emit('dm_thinking');
          try {
            const resolved = await gameSessionService.resolveRound(room.id, completedReactions);
            if (resolved && resolved.log) {
              if (resolved.inventoryNotifications && resolved.inventoryNotifications.length > 0) {
                resolved.inventoryNotifications.forEach(notif => {
                  io.to(room.id).emit('inventory_notification', notif);
                  const icon = notif.action === 'add' ? '🎒' : '⚠️';
                  const actWord = notif.action === 'add' ? 'получил предмет' : 'потерял/израсходовал';
                  io.to(room.id).emit('feed_activity', {
                    id: crypto.randomUUID(),
                    type: notif.action === 'add' ? 'inventory_add' : 'inventory_remove',
                    text: `${icon} ${notif.characterName} ${actWord}: «${notif.itemName}» (${notif.reason})`,
                    timestamp: notif.timestamp,
                  });
                });
              }

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
            console.error('Error resolving round with reactions:', error);
            io.to(room.id).emit('dm_thinking_failed', { error: error?.message || 'Ошибка обработки раунда' });
            io.to(room.id).emit('error_message', 'Ошибка при обработке раунда мастером.');
          }
        }
      }
    });

    // Skip reaction (by target player, initiator, or host if inactive)
    socket.on('skip_reaction', async (data: {
      roomCode: string;
      reactionRequestId: string;
    }) => {
      const result = gameSessionService.skipReaction(data.roomCode, userId, data.reactionRequestId);
      if (!result) return;

      const { room, initiatorUserId, targetCharacterName, allCompleted, completedReactions, shouldResolveRound } = result;

      io.to(room.id).emit('reaction_updated', {
        reactionRequestId: data.reactionRequestId,
        room: sanitizeRoom(room),
      });

      io.to(room.id).emit('feed_activity', {
        id: crypto.randomUUID(),
        type: 'player_action',
        text: `⏩ Реакция персонажа ${targetCharacterName} была пропущена.`,
        timestamp: new Date().toISOString(),
      });

      if (allCompleted) {
        if (room.turnMode === 'turn_by_turn') {
          io.to(room.id).emit('dm_thinking');
          try {
            const turnResolved = await gameSessionService.resolveTurnStep(room.id, initiatorUserId, completedReactions);
            if (turnResolved && turnResolved.log) {
              if (turnResolved.inventoryNotifications && turnResolved.inventoryNotifications.length > 0) {
                turnResolved.inventoryNotifications.forEach(notif => {
                  io.to(room.id).emit('inventory_notification', notif);
                  const icon = notif.action === 'add' ? '🎒' : '⚠️';
                  const actWord = notif.action === 'add' ? 'получил предмет' : 'потерял/израсходовал';
                  io.to(room.id).emit('feed_activity', {
                    id: crypto.randomUUID(),
                    type: notif.action === 'add' ? 'inventory_add' : 'inventory_remove',
                    text: `${icon} ${notif.characterName} ${actWord}: «${notif.itemName}» (${notif.reason})`,
                    timestamp: notif.timestamp,
                  });
                });
              }

              if (!turnResolved.isRoundComplete) {
                io.to(room.id).emit('turn_step_resolved', {
                  log: turnResolved.log,
                  room: sanitizeRoom(turnResolved.room),
                  players: turnResolved.players,
                  nextActiveUserId: turnResolved.nextActiveUserId,
                });
                io.to(room.id).emit('room_players_updated', turnResolved.players);
                io.to(room.id).emit('narrator_playing', {
                  logId: turnResolved.log.id,
                  narrativeText: turnResolved.log.narrativeText,
                  startedBy: 'DM',
                });
              } else {
                io.to(room.id).emit('round_resolved', {
                  log: turnResolved.log,
                  room: sanitizeRoom(turnResolved.room),
                  players: turnResolved.players,
                  nextRoundNumber: turnResolved.nextRoundNumber,
                });
                io.to(room.id).emit('room_players_updated', turnResolved.players);
                io.to(room.id).emit('narrator_playing', {
                  logId: turnResolved.log.id,
                  narrativeText: turnResolved.log.narrativeText,
                  startedBy: 'DM',
                });
              }
            }
          } catch (error: any) {
            console.error('Error resolving turn step after reaction skip:', error);
            io.to(room.id).emit('dm_thinking_failed', { error: error?.message || 'Ошибка обработки хода' });
          }
        } else if (shouldResolveRound) {
          io.to(room.id).emit('dm_thinking');
          try {
            const resolved = await gameSessionService.resolveRound(room.id, completedReactions);
            if (resolved && resolved.log) {
              if (resolved.inventoryNotifications && resolved.inventoryNotifications.length > 0) {
                resolved.inventoryNotifications.forEach(notif => {
                  io.to(room.id).emit('inventory_notification', notif);
                  const icon = notif.action === 'add' ? '🎒' : '⚠️';
                  const actWord = notif.action === 'add' ? 'получил предмет' : 'потерял/израсходовал';
                  io.to(room.id).emit('feed_activity', {
                    id: crypto.randomUUID(),
                    type: notif.action === 'add' ? 'inventory_add' : 'inventory_remove',
                    text: `${icon} ${notif.characterName} ${actWord}: «${notif.itemName}» (${notif.reason})`,
                    timestamp: notif.timestamp,
                  });
                });
              }

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
            console.error('Error resolving round after reaction skip:', error);
            io.to(room.id).emit('dm_thinking_failed', { error: error?.message || 'Ошибка обработки раунда' });
          }
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
      }
    });

    // Pickup battlefield loot
    socket.on('pickup_loot', ({ roomCode, lootId, characterId }: { roomCode: string; lootId: string; characterId: string }) => {
      const room = roomRepository.findByCode(roomCode);
      if (!room) return;

      const result = gameSessionService.pickupLoot(room.id, characterId, lootId);
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

        // Log item pickup to Campaign Journal (loreJournal)
        const updatedRoom = roomRepository.addMilestones(room.id, [{
          id: crypto.randomUUID(),
          round: room.roundNumber,
          milestone: `📦 ${charName} подобрал предмет: «${result.item.name}».`,
          timestamp: new Date().toISOString(),
        }]);

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

        const updated = gameSessionService.getRoomAndPlayers(roomCode);
        if (updated) {
          io.to(room.id).emit('room_players_updated', updated.players);
        }
      }
    });

    // Use Consumable Item
    socket.on('use_item', ({ roomCode, characterId, itemId, targetName }: { roomCode: string; characterId: string; itemId: string; targetName?: string }) => {
      const room = roomRepository.findByCode(roomCode);
      if (!room) return;

      const result = gameSessionService.useItem(characterId, itemId, targetName);
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

        // Log item usage to Campaign Journal (loreJournal)
        const updatedRoom = roomRepository.addMilestones(room.id, [{
          id: crypto.randomUUID(),
          round: room.roundNumber,
          milestone: `🧪 ${result.character.name} использовал предмет: «${result.itemName}»${targetNote}${healNote}.`,
          timestamp: new Date().toISOString(),
        }]);

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

        const updated = gameSessionService.getRoomAndPlayers(roomCode);
        if (updated) {
          io.to(room.id).emit('room_players_updated', updated.players);
        }
      }
    });

    // Perform Short Rest
    socket.on('player_short_rest', ({ roomCode, characterId, diceCount }: { roomCode: string; characterId: string; diceCount?: number }, callback?: (res: any) => void) => {
      const room = roomRepository.findByCode(roomCode);
      if (!room) {
        if (callback) callback({ error: 'Комната не найдена' });
        return;
      }

      try {
        const result = gameSessionService.performShortRest(room.id, characterId, diceCount);
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

          const updated = gameSessionService.getRoomAndPlayers(roomCode);
          if (updated) {
            io.to(room.id).emit('room_players_updated', updated.players);
          }

          if (callback) {
            callback({
              healedHp: result.healedHp,
              diceSpent: result.diceSpent,
              rolls: result.rolls,
            });
          }
        }
      } catch (err: any) {
        socket.emit('error_message', err.message || 'Ошибка короткого отдыха');
        if (callback) callback({ error: err.message || 'Ошибка короткого отдыха' });
      }
    });

    // Perform Long Rest
    socket.on('player_long_rest', ({ roomCode, characterId }: { roomCode: string; characterId: string }, callback?: (res: any) => void) => {
      const room = roomRepository.findByCode(roomCode);
      if (!room) {
        if (callback) callback({ error: 'Комната не найдена' });
        return;
      }

      try {
        const result = gameSessionService.performLongRest(room.id, characterId);
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
            text: `🌙 ${result.character.name} завершил длительный отдых (здоровье полностью восстановлено)`,
            timestamp: new Date().toISOString(),
          });

          const updated = gameSessionService.getRoomAndPlayers(roomCode);
          if (updated) {
            io.to(room.id).emit('room_players_updated', updated.players);
          }

          if (callback) {
            callback({
              healedHp: result.healedHp,
            });
          }
        }
      } catch (err: any) {
        socket.emit('error_message', err.message || 'Ошибка длительного отдыха');
        if (callback) callback({ error: err.message || 'Ошибка длительного отдыха' });
      }
    });

    // Equip weapon
    socket.on('equip_weapon', ({ roomCode, characterId, itemId }: { roomCode: string; characterId: string; itemId: string }) => {
      const room = roomRepository.findByCode(roomCode);
      if (!room) return;

      const updatedChar = gameSessionService.equipWeapon(characterId, itemId);
      if (updatedChar) {
        io.to(room.id).emit('character_updated', updatedChar);

        const weapon = updatedChar.inventory?.find(i => i.id === itemId);
        io.to(room.id).emit('feed_activity', {
          id: crypto.randomUUID(),
          type: 'weapon_equipped',
          text: `⚔️ ${updatedChar.name} экипировал оружие: ${weapon?.name || 'оружие'}`,
          timestamp: new Date().toISOString(),
        });

        const updated = gameSessionService.getRoomAndPlayers(roomCode);
        if (updated) {
          io.to(room.id).emit('room_players_updated', updated.players);
        }
      }
    });

    // Finish Session / Adventure (Cliffhanger or Module Triumph)
    socket.on('finish_adventure', ({
      roomCode,
      finishType,
      title,
      epilogue
    }: {
      roomCode: string;
      finishType: 'cliffhanger' | 'triumph' | 'open_ended';
      title?: string;
      epilogue?: string;
    }) => {
      const room = roomRepository.findByCode(roomCode);
      if (!room) return;

      const result = gameSessionService.finishAdventure(room.id, finishType, title, epilogue);
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
          text: finishType === 'cliffhanger'
            ? '🌙 Сессия завершена на захватывающем клиффхэнгере! До встречи на следующей встрече!'
            : '🏆 Приключение триумфально завершено! Поздравляем отряд с великой победой!',
          timestamp: new Date().toISOString(),
        });
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

          io.to(room.id).emit('feed_activity', {
            id: crypto.randomUUID(),
            type: 'player_action',
            text: `⭐ ${updatedChar.name} повысил уровень до ${updatedChar.level}! Изучен новый талант.`,
            timestamp: new Date().toISOString(),
          });
        }
      }
    });

    // Force DM turn resolution by room host
    socket.on('force_resolve_round', async ({ roomCode }: { roomCode: string }) => {
      const room = roomRepository.findByCode(roomCode);
      if (!room || room.hostUserId !== userId || room.status !== 'active') return;

      io.to(room.id).emit('dm_thinking');
      try {
        if (room.turnMode === 'turn_by_turn' && room.activePlayerUserId) {
          const turnResolved = await gameSessionService.resolveTurnStep(room.id, room.activePlayerUserId);
          if (turnResolved && turnResolved.log) {
            if (turnResolved.inventoryNotifications && turnResolved.inventoryNotifications.length > 0) {
              turnResolved.inventoryNotifications.forEach(notif => {
                io.to(room.id).emit('inventory_notification', notif);
                const icon = notif.action === 'add' ? '🎒' : '⚠️';
                const actWord = notif.action === 'add' ? 'получил предмет' : 'потерял/израсходовал';
                io.to(room.id).emit('feed_activity', {
                  id: crypto.randomUUID(),
                  type: notif.action === 'add' ? 'inventory_add' : 'inventory_remove',
                  text: `${icon} ${notif.characterName} ${actWord}: «${notif.itemName}» (${notif.reason})`,
                  timestamp: notif.timestamp,
                });
              });
            }

            if (!turnResolved.isRoundComplete) {
              io.to(room.id).emit('turn_step_resolved', {
                log: turnResolved.log,
                room: sanitizeRoom(turnResolved.room),
                players: turnResolved.players,
                nextActiveUserId: turnResolved.nextActiveUserId,
              });
            } else {
              io.to(room.id).emit('round_resolved', {
                log: turnResolved.log,
                room: sanitizeRoom(turnResolved.room),
                players: turnResolved.players,
                nextRoundNumber: turnResolved.nextRoundNumber,
              });
            }
            io.to(room.id).emit('room_players_updated', turnResolved.players);
            io.to(room.id).emit('narrator_playing', {
              logId: turnResolved.log.id,
              narrativeText: turnResolved.log.narrativeText,
              startedBy: 'DM',
            });
            return;
          }
        }

        const resolved = await gameSessionService.resolveRound(room.id);
        if (resolved) {
          if (resolved.rejectedAction) {
            io.to(room.id).emit('action_rejected', resolved.rejectedAction);
            io.to(room.id).emit('room_players_updated', resolved.players);
            return;
          }
          if (resolved.log) {
            if (resolved.inventoryNotifications && resolved.inventoryNotifications.length > 0) {
              resolved.inventoryNotifications.forEach(notif => {
                io.to(room.id).emit('inventory_notification', notif);
                const icon = notif.action === 'add' ? '🎒' : '⚠️';
                const actWord = notif.action === 'add' ? 'получил предмет' : 'потерял/израсходовал';
                io.to(room.id).emit('feed_activity', {
                  id: crypto.randomUUID(),
                  type: notif.action === 'add' ? 'inventory_add' : 'inventory_remove',
                  text: `${icon} ${notif.characterName} ${actWord}: «${notif.itemName}» (${notif.reason})`,
                  timestamp: notif.timestamp,
                });
              });
            }

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
        }
      } catch (error: any) {
        console.error('Error in force_resolve_round:', error);
        io.to(room.id).emit('dm_thinking_failed', { error: error?.message || 'Ошибка обработки раунда' });
        io.to(room.id).emit('error_message', 'Ошибка при обработке раунда мастером. Попробуйте повторить ход.');
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
