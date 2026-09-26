import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { userRepository } from '../repositories';
import { roomSocketController } from './controllers/RoomSocketController';
import { turnSocketController, AuthenticatedSocket } from './controllers/TurnSocketController';
import { inventorySocketController } from './controllers/InventorySocketController';

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
    // --- Room / Lobby & Dice Events ---
    socket.on('join_room', (data) => roomSocketController.handleJoinRoom(io, socket, data));
    socket.on('select_character', (data) => roomSocketController.handleSelectCharacter(io, socket, data));
    socket.on('toggle_ready', (data) => roomSocketController.handleToggleReady(io, socket, data));
    socket.on('start_game', (data) => roomSocketController.handleStartGame(io, socket, data));
    socket.on('roll_dice', (data) => roomSocketController.handleRollDice(io, socket, data));
    socket.on('narrator_play', (data) => roomSocketController.handleNarratorPlay(socket, data));
    socket.on('narrator_stop', (data) => roomSocketController.handleNarratorStop(socket, data));
    socket.on('disconnect', () => roomSocketController.handleDisconnect(io, socket));

    // --- Turn & Resolution Events ---
    socket.on('submit_action', (data) => turnSocketController.handleSubmitAction(io, socket, data));
    socket.on('submit_reaction', (data) => turnSocketController.handleSubmitReaction(io, socket, data));
    socket.on('skip_reaction', (data) => turnSocketController.handleSkipReaction(io, socket, data));
    socket.on('force_resolve_round', (data) => turnSocketController.handleForceResolveRound(io, socket, data));
    socket.on('reset_player_turn', (data) => turnSocketController.handleResetPlayerTurn(io, socket, data));

    // --- Inventory, Rest & Progression Events ---
    socket.on('set_turn_mode', (data) => inventorySocketController.handleSetTurnMode(io, socket, data));
    socket.on('pickup_loot', (data) => inventorySocketController.handlePickupLoot(io, socket, data));
    socket.on('use_item', (data) => inventorySocketController.handleUseItem(io, socket, data));
    socket.on('drop_item', (data) => inventorySocketController.handleDropItem(io, socket, data));
    socket.on('equip_weapon', (data) => inventorySocketController.handleEquipWeapon(io, socket, data));
    socket.on('player_short_rest', (data, callback) => inventorySocketController.handleShortRest(io, socket, data, callback));
    socket.on('player_long_rest', (data, callback) => inventorySocketController.handleLongRest(io, socket, data, callback));
    socket.on('get_talents', (data) => inventorySocketController.handleGetTalents(socket, data));
    socket.on('learn_talent', (data, callback) => inventorySocketController.handleLearnTalent(io, socket, data, callback));
    socket.on('roll_death_save', (data) => inventorySocketController.handleRollDeathSave(io, socket, data));
    socket.on('finish_adventure', (data) => inventorySocketController.handleFinishAdventure(io, socket, data));
  });
}
