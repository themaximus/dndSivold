import { Server } from 'socket.io';
import { AuthenticatedSocket } from './TurnSocketController';
import { systemLocator } from '../../services/session/ServiceLocator';
import { sanitizeRoom } from '../../services/security/CryptoService';
import { executeServerRoll, RollRequest } from '../../services/diceEngine';
import {
  roomRepository,
  characterRepository,
  gameLogRepository,
} from '../../repositories';

export class RoomSocketController {
  private get roomManager() {
    return systemLocator.get('roomSessionManager');
  }

  public handleJoinRoom(
    io: Server,
    socket: AuthenticatedSocket,
    { roomCode, characterId }: { roomCode: string; characterId?: string }
  ): void {
    const userId = socket.userId!;
    const username = socket.username!;

    const roomData = this.roomManager.joinRoom(roomCode, userId, username);
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
      this.roomManager.selectCharacter(roomData.room.id, userId, characterId);
    }

    const updated = this.roomManager.getRoomAndPlayers(roomCode);
    if (updated) {
      io.to(updated.room.id).emit('room_players_updated', updated.players);
      socket.emit('room_state', {
        room: sanitizeRoom(updated.room),
        players: updated.players,
        logs: gameLogRepository.findByRoomId(updated.room.id),
      });
    }
  }

  public handleSelectCharacter(
    io: Server,
    socket: AuthenticatedSocket,
    { roomCode, characterId }: { roomCode: string; characterId: string }
  ): void {
    const userId = socket.userId!;
    const room = roomRepository.findByCode(roomCode);
    if (!room) return;

    const updated = this.roomManager.selectCharacter(room.id, userId, characterId);
    if (updated) {
      io.to(room.id).emit('room_players_updated', updated.players);
    }
  }

  public handleToggleReady(
    io: Server,
    socket: AuthenticatedSocket,
    { roomCode }: { roomCode: string }
  ): void {
    const userId = socket.userId!;
    const room = roomRepository.findByCode(roomCode);
    if (!room) return;

    const player = roomRepository.findPlayer(room.id, userId);
    if (player && player.characterId) {
      roomRepository.updatePlayer(player.id, { isReady: !player.isReady });
      const updated = this.roomManager.getRoomAndPlayers(roomCode);
      if (updated) {
        io.to(room.id).emit('room_players_updated', updated.players);
      }
    }
  }

  public async handleStartGame(
    io: Server,
    socket: AuthenticatedSocket,
    { roomCode }: { roomCode: string }
  ): Promise<void> {
    const userId = socket.userId!;
    const room = roomRepository.findByCode(roomCode);
    if (!room || room.hostUserId !== userId) return;

    io.to(room.id).emit('dm_thinking');

    const updated = await this.roomManager.startGame(room.id, userId);
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
  }

  public handleRollDice(
    io: Server,
    socket: AuthenticatedSocket,
    data: { roomCode: string; request: RollRequest }
  ): void {
    const userId = socket.userId!;
    const username = socket.username!;
    const room = roomRepository.findByCode(data.roomCode);
    if (!room) return;

    const player = roomRepository.findPlayer(room.id, userId);

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

    socket.to(room.id).emit('dice_rolled', {
      playerId: userId,
      username,
      characterName: character?.name || username,
      roll: rollResult,
    });

    socket.emit('your_dice_result', rollResult);
  }

  public handleNarratorPlay(
    socket: AuthenticatedSocket,
    data: { roomCode: string; logId: string; narrativeText: string; mood?: string }
  ): void {
    const username = socket.username!;
    const room = roomRepository.findByCode(data.roomCode);
    if (!room) return;

    socket.to(room.id).emit('narrator_playing', {
      logId: data.logId,
      narrativeText: data.narrativeText,
      mood: data.mood,
      startedBy: username,
    });
  }

  public handleNarratorStop(socket: AuthenticatedSocket, data: { roomCode: string }): void {
    const username = socket.username!;
    const room = roomRepository.findByCode(data.roomCode);
    if (!room) return;

    socket.to(room.id).emit('narrator_stopped', {
      stoppedBy: username,
    });
  }

  public handleDisconnect(io: Server, socket: AuthenticatedSocket): void {
    const userId = socket.userId;
    const roomId = (socket as any).currentRoomId;
    const roomCode = (socket as any).currentRoomCode;
    if (userId && roomId && roomCode) {
      this.roomManager.setPlayerOnline(roomId, userId, false);
      const updated = this.roomManager.getRoomAndPlayers(roomCode);
      if (updated) {
        io.to(roomId).emit('room_players_updated', updated.players);
      }
    }
  }
}

export const roomSocketController = new RoomSocketController();
