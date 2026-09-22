import crypto from 'crypto';
import { Server, Socket } from 'socket.io';
import { systemLocator } from '../../services/session/ServiceLocator';
import { sanitizeRoom } from '../../services/security/CryptoService';
import { roomRepository } from '../../repositories';

export interface AuthenticatedSocket extends Socket {
  userId?: string;
  username?: string;
}

export class TurnSocketController {
  // Idempotency tracking: prevents duplicate submissions from rapid clicks or flaky connections
  private inFlightActions: Set<string> = new Set();
  private recentActionTimestamps: Map<string, number> = new Map();

  private get sessionService() {
    return systemLocator.get('turnExecutionPipeline');
  }

  private get roomManager() {
    return systemLocator.get('roomSessionManager');
  }

  public broadcastCharacterUpdates(io: Server, roomId: string, players?: any[]): void {
    if (!Array.isArray(players)) return;
    for (const p of players) {
      if (p.character) {
        io.to(roomId).emit('character_updated', p.character);
      }
    }
  }

  public broadcastNotificationsAndFeed(
    io: Server,
    roomId: string,
    notifications: any[],
    actionText?: string,
    characterName?: string,
    shortVerdict?: string
  ): void {
    if (actionText && characterName) {
      io.to(roomId).emit('feed_activity', {
        id: crypto.randomUUID(),
        type: 'player_action',
        text: `🎲 ${characterName}: «${actionText}» ${shortVerdict ? `(${shortVerdict})` : ''}`,
        timestamp: new Date().toISOString(),
      });
    }

    if (notifications && notifications.length > 0) {
      notifications.forEach((notif) => {
        io.to(roomId).emit('inventory_notification', notif);
        const icon = notif.action === 'add' ? '🎒' : '⚠️';
        const actWord = notif.action === 'add' ? 'получил предмет' : 'потерял/израсходовал';
        io.to(roomId).emit('feed_activity', {
          id: crypto.randomUUID(),
          type: notif.action === 'add' ? 'inventory_add' : 'inventory_remove',
          text: `${icon} ${notif.characterName} ${actWord}: «${notif.itemName}» (${notif.reason})`,
          timestamp: notif.timestamp,
        });
      });
    }
  }

  public broadcastResolution(io: Server, roomId: string, resolved: any, isStep: boolean): void {
    const eventName = isStep ? 'turn_step_resolved' : 'round_resolved';
    const payload = isStep
      ? {
          log: resolved.log,
          room: sanitizeRoom(resolved.room),
          players: resolved.players,
          nextActiveUserId: resolved.nextActiveUserId,
        }
      : {
          ...resolved,
          room: sanitizeRoom(resolved.room),
        };

    io.to(roomId).emit(eventName, payload);
    io.to(roomId).emit('room_players_updated', resolved.players);
    this.broadcastCharacterUpdates(io, roomId, resolved.players);

    if (resolved.log) {
      io.to(roomId).emit('narrator_playing', {
        logId: resolved.log.id,
        narrativeText: resolved.log.narrativeText,
        startedBy: 'DM',
      });
      systemLocator.get('streamingAIService').streamNarrativeToRoom(
        io,
        roomId,
        resolved.log.id,
        resolved.log.narrativeText,
        { delayMs: 15, chunkSize: 40 }
      ).catch((err) => console.warn('[TurnSocketController] Streaming error:', err));
    }
  }

  public async handleSubmitAction(
    io: Server,
    socket: AuthenticatedSocket,
    data: {
      roomCode: string;
      actionText: string;
      diceRolls: any[];
      actionType?: 'attack' | 'check' | 'save' | 'improvise';
      targetEnemyId?: string;
      targetEnemyName?: string;
      advantage?: boolean;
      disadvantage?: boolean;
      spellLevelUsed?: number;
    }
  ): Promise<void> {
    const userId = socket.userId!;
    const idempotencyKey = `${userId}_${data.roomCode}`;

    // 1. Idempotency Guard: prevent double execution
    const now = Date.now();
    const lastTimestamp = this.recentActionTimestamps.get(idempotencyKey) || 0;
    if (this.inFlightActions.has(idempotencyKey) || (now - lastTimestamp < 800)) {
      socket.emit('error_message', 'Действие уже обрабатывается. Пожалуйста, подождите.');
      return;
    }

    this.inFlightActions.add(idempotencyKey);
    this.recentActionTimestamps.set(idempotencyKey, now);

    try {
      const submission = this.roomManager.submitAction(
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

      // Broadcast action submission
      io.to(room.id).emit('player_action_submitted', {
        userId,
        characterName,
        hasActedThisRound: true,
        room,
      });

      // If action requires companion reactions, broadcast and halt
      if (submission.waitingForReactions) {
        io.to(room.id).emit('reactions_requested', {
          pendingReactions: submission.pendingReactions,
          room: submission.room,
        });

        submission.pendingReactions.forEach((r) => {
          io.to(room.id).emit('feed_activity', {
            id: crypto.randomUUID(),
            type: 'player_action',
            text: `💬 ${characterName} вовлекает ${r.targetCharacterName} в совместное действие: «${r.initiatorActionText}». Ожидается реакция и бросок d20!`,
            timestamp: new Date().toISOString(),
          });
        });
        return;
      }

      // Turn-by-Turn mode: resolve step immediately
      if (submission.isTurnByTurn) {
        io.to(room.id).emit('dm_thinking');
        try {
          const turnResolved = await this.sessionService.resolveTurnStep(room.id, userId);
          if (turnResolved) {
            if (turnResolved.rejectedAction) {
              io.to(room.id).emit('action_rejected', turnResolved.rejectedAction);
              io.to(room.id).emit('room_players_updated', turnResolved.players);
              return;
            }

            const roll = data.diceRolls?.[0];
            const shortVerdict = roll?.isCriticalSuccess
              ? '★ Критический успех!'
              : roll?.isCriticalFail
              ? '☠ Критический провал!'
              : (roll?.total >= (room.targetDC || 12) ? '★ Успех' : '✗ Провал');

            this.broadcastNotificationsAndFeed(
              io,
              room.id,
              turnResolved.inventoryNotifications || [],
              data.actionText,
              characterName,
              shortVerdict
            );

            this.broadcastResolution(io, room.id, turnResolved, !turnResolved.isRoundComplete);
          }
        } catch (error: any) {
          console.error('Error resolving turn step:', error);
          const updatedPlayers = this.roomManager.revertPlayerTurnAction(room.id, userId);
          if (updatedPlayers) {
            io.to(room.id).emit('room_players_updated', updatedPlayers);
          }
          io.to(room.id).emit('dm_thinking_failed', { error: error?.message || 'Ошибка обработки хода' });
          io.to(room.id).emit('error_message', 'Ошибка при обработке хода мастером. Ход сброшен, попробуйте еще раз.');
        }
        return;
      }

      // Simultaneous mode: resolve round if all players have acted
      if (shouldResolveRound) {
        io.to(room.id).emit('dm_thinking');
        try {
          const resolved = await this.sessionService.resolveRound(room.id);
          if (resolved) {
            if (resolved.rejectedAction) {
              io.to(room.id).emit('action_rejected', resolved.rejectedAction);
              io.to(room.id).emit('room_players_updated', resolved.players);
              return;
            }

            this.broadcastNotificationsAndFeed(
              io,
              room.id,
              resolved.inventoryNotifications || []
            );

            this.broadcastResolution(io, room.id, resolved, false);
          }
        } catch (error: any) {
          console.error('Error resolving round:', error);
          const updatedPlayers = this.roomManager.revertPlayerTurnAction(room.id, userId);
          if (updatedPlayers) {
            io.to(room.id).emit('room_players_updated', updatedPlayers);
          }
          io.to(room.id).emit('dm_thinking_failed', { error: error?.message || 'Ошибка обработки раунда' });
          io.to(room.id).emit('error_message', 'Ошибка при обработке раунда мастером. Ход сброшен, попробуйте еще раз.');
        }
      }
    } finally {
      this.inFlightActions.delete(idempotencyKey);
    }
  }

  public async handleSubmitReaction(
    io: Server,
    socket: AuthenticatedSocket,
    data: {
      roomCode: string;
      reactionRequestId: string;
      reactionText: string;
      reactionRoll: any;
      responseType?: 'positive' | 'negative' | 'counter';
    }
  ): Promise<void> {
    const userId = socket.userId!;
    const result = this.roomManager.submitReaction(
      data.roomCode,
      userId,
      data.reactionRequestId,
      data.reactionText,
      data.reactionRoll,
      data.responseType
    );
    if (!result) return;

    const { room, initiatorUserId, initiatorCharacterName, targetCharacterName, allCompleted, completedReactions, shouldResolveRound } = result;

    io.to(room.id).emit('reaction_submitted', {
      reactionRequestId: data.reactionRequestId,
      targetUserId: userId,
      targetCharacterName,
      initiatorCharacterName,
      responseType: data.responseType,
      room,
    });

    const reactionTone = data.responseType === 'negative' ? 'отказывает / сопротивляется' : data.responseType === 'counter' ? 'контратакует / парирует' : 'помогает / соглашается';
    io.to(room.id).emit('feed_activity', {
      id: crypto.randomUUID(),
      type: 'player_action',
      text: `🤝 ${targetCharacterName} реагирует на действие ${initiatorCharacterName} (${reactionTone}): «${data.reactionText}»`,
      timestamp: new Date().toISOString(),
    });

    if (allCompleted) {
      io.to(room.id).emit('reactions_cleared', { room });
      io.to(room.id).emit('dm_thinking');

      try {
        const isTurnByTurn = (room.turnMode || 'turn_by_turn') === 'turn_by_turn';
        if (isTurnByTurn && initiatorUserId) {
          const turnResolved = await this.sessionService.resolveTurnStep(room.id, initiatorUserId, completedReactions);
          if (turnResolved) {
            this.broadcastNotificationsAndFeed(io, room.id, turnResolved.inventoryNotifications || []);
            this.broadcastResolution(io, room.id, turnResolved, !turnResolved.isRoundComplete);
          }
        } else if (shouldResolveRound) {
          const resolved = await this.sessionService.resolveRound(room.id, completedReactions);
          if (resolved) {
            this.broadcastNotificationsAndFeed(io, room.id, resolved.inventoryNotifications || []);
            this.broadcastResolution(io, room.id, resolved, false);
          }
        }
      } catch (error: any) {
        console.error('Error resolving turn after reaction:', error);
        io.to(room.id).emit('dm_thinking_failed', { error: error?.message || 'Ошибка обработки реакции' });
      }
    }
  }

  public async handleSkipReaction(
    io: Server,
    socket: AuthenticatedSocket,
    data: { roomCode: string; reactionRequestId: string }
  ): Promise<void> {
    const userId = socket.userId!;
    const result = this.roomManager.skipReaction(data.roomCode, userId, data.reactionRequestId);
    if (!result) return;

    const { room, initiatorUserId, allCompleted, completedReactions, shouldResolveRound } = result;
    io.to(room.id).emit('reaction_skipped', {
      reactionRequestId: data.reactionRequestId,
      userId,
      room,
    });

    if (allCompleted) {
      io.to(room.id).emit('reactions_cleared', { room });
      io.to(room.id).emit('dm_thinking');

      try {
        const isTurnByTurn = (room.turnMode || 'turn_by_turn') === 'turn_by_turn';
        if (isTurnByTurn && initiatorUserId) {
          const turnResolved = await this.sessionService.resolveTurnStep(room.id, initiatorUserId, completedReactions);
          if (turnResolved) {
            this.broadcastNotificationsAndFeed(io, room.id, turnResolved.inventoryNotifications || []);
            this.broadcastResolution(io, room.id, turnResolved, !turnResolved.isRoundComplete);
          }
        } else if (shouldResolveRound) {
          const resolved = await this.sessionService.resolveRound(room.id, completedReactions);
          if (resolved) {
            this.broadcastNotificationsAndFeed(io, room.id, resolved.inventoryNotifications || []);
            this.broadcastResolution(io, room.id, resolved, false);
          }
        }
      } catch (error: any) {
        console.error('Error resolving round after skipped reaction:', error);
        io.to(room.id).emit('dm_thinking_failed', { error: error?.message || 'Ошибка обработки' });
      }
    }
  }

  public async handleForceResolveRound(
    io: Server,
    socket: AuthenticatedSocket,
    data: { roomCode: string }
  ): Promise<void> {
    const userId = socket.userId!;
    const room = roomRepository.findByCode(data.roomCode);
    if (!room || room.hostUserId !== userId || room.status !== 'active') return;

    io.to(room.id).emit('dm_thinking');
    try {
      if ((room.turnMode || 'turn_by_turn') === 'turn_by_turn' && room.activePlayerUserId) {
        const turnResolved = await this.sessionService.resolveTurnStep(room.id, room.activePlayerUserId);
        if (turnResolved && turnResolved.log) {
          this.broadcastNotificationsAndFeed(io, room.id, turnResolved.inventoryNotifications || []);
          this.broadcastResolution(io, room.id, turnResolved, !turnResolved.isRoundComplete);
          return;
        }
      }

      const resolved = await this.sessionService.resolveRound(room.id);
      if (resolved) {
        if (resolved.rejectedAction) {
          io.to(room.id).emit('action_rejected', resolved.rejectedAction);
          io.to(room.id).emit('room_players_updated', resolved.players);
          return;
        }
        if (resolved.log) {
          this.broadcastNotificationsAndFeed(io, room.id, resolved.inventoryNotifications || []);
          this.broadcastResolution(io, room.id, resolved, false);
        }
      }
    } catch (error: any) {
      console.error('Error in force_resolve_round:', error);
      io.to(room.id).emit('dm_thinking_failed', { error: error?.message || 'Ошибка обработки раунда' });
      io.to(room.id).emit('error_message', 'Ошибка при обработке раунда мастером. Попробуйте повторить ход.');
    }
  }

  public async handleResetPlayerTurn(
    io: Server,
    socket: AuthenticatedSocket,
    data: { roomCode: string; targetUserId?: string }
  ): Promise<void> {
    const userId = socket.userId!;
    const room = roomRepository.findByCode(data.roomCode);
    if (!room) return;

    const targetUserId = (room.hostUserId === userId && data.targetUserId) ? data.targetUserId : userId;
    const updatedPlayers = this.roomManager.revertPlayerTurnAction(room.id, targetUserId);
    if (updatedPlayers) {
      io.to(room.id).emit('room_players_updated', updatedPlayers);
      io.to(room.id).emit('dm_thinking_failed', { error: 'Ход сброшен' });
    }
  }
}

export const turnSocketController = new TurnSocketController();
