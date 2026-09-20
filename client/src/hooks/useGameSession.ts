import { useState, useEffect, useCallback } from 'react';
import { Room, RoomPlayer, GameLogEntry, DiceRollResult, Character, CharacterTalentTree, RoomLootItem, FeedActivity, ActionRejectedEvent } from '../types';
import { api } from '../services/api';
import { getSocket, connectSocket } from '../services/socket';
import { useAuth } from '../context/AuthContext';
import { soundFx } from '../utils/audio';
import confetti from 'canvas-confetti';

export function useGameSession(roomCode: string) {
  const { user } = useAuth();
  const [room, setRoom] = useState<Room | null>(null);
  const [players, setPlayers] = useState<RoomPlayer[]>([]);
  const [logs, setLogs] = useState<GameLogEntry[]>([]);
  const [myPlayer, setMyPlayer] = useState<RoomPlayer | null>(null);
  const [myCharacter, setMyCharacter] = useState<Character | null>(null);
  const [hasSubmittedThisRound, setHasSubmittedThisRound] = useState(false);
  const [isDMThinking, setIsDMThinking] = useState(false);
  const [talentTree, setTalentTree] = useState<CharacterTalentTree | null>(null);
  const [lastDeathSaveMessage, setLastDeathSaveMessage] = useState<string | null>(null);
  const [rejectedAction, setRejectedAction] = useState<ActionRejectedEvent | null>(null);
  const [recentActivities, setRecentActivities] = useState<FeedActivity[]>([]);
  const [finishedAdventure, setFinishedAdventure] = useState<{
    finishType: 'cliffhanger' | 'triumph' | 'open_ended';
    title: string;
    epilogue: string;
  } | null>(null);

  useEffect(() => {
    let isMounted = true;

    const loadData = async () => {
      try {
        const roomData = await api.getRoomByCode(roomCode);
        if (!isMounted) return;

        setRoom(roomData.room);
        setPlayers(roomData.players);
        setLogs(roomData.logs || []);

        const me = roomData.players.find((p: RoomPlayer) => p.userId === user?.id);
        if (me) {
          setMyPlayer(me);
          setHasSubmittedThisRound(me.hasActedThisRound);
          if (me.character) setMyCharacter(me.character);
        }
      } catch (err) {
        console.error('Failed to load room data:', err);
      }
    };

    loadData();

    const socket = connectSocket();

    const handleConnect = () => {
      socket.emit('join_room', { roomCode });
      loadData();
    };

    if (socket.connected) {
      socket.emit('join_room', { roomCode });
    }
    socket.on('connect', handleConnect);

    socket.on('room_players_updated', (updatedPlayers: RoomPlayer[]) => {
      setPlayers(updatedPlayers);
      const me = updatedPlayers.find(p => p.userId === user?.id);
      if (me) {
        setMyPlayer(me);
        setHasSubmittedThisRound(me.hasActedThisRound);
        if (me.character) setMyCharacter(me.character);
      }
    });

    socket.on('room_updated', (updatedRoom: Room) => {
      setRoom(updatedRoom);
    });

    socket.on('player_action_submitted', (data: { userId: string; characterName: string; hasActedThisRound: boolean; room?: Room }) => {
      setPlayers(prev =>
        prev.map(p => (p.userId === data.userId ? { ...p, hasActedThisRound: true } : p))
      );
      if (data.userId === user?.id) {
        setHasSubmittedThisRound(true);
      }
      if (data.room) {
        setRoom(data.room);
      }
    });

    socket.on('dm_thinking', () => {
      setIsDMThinking(true);
    });

    socket.on('turn_step_resolved', (data: { log: GameLogEntry; room: Room; players: RoomPlayer[]; nextActiveUserId?: string }) => {
      setIsDMThinking(false);

      setLogs(prev => [...prev, data.log]);
      setRoom(data.room);
      setPlayers(data.players);

      const me = data.players.find(p => p.userId === user?.id);
      if (me) {
        setMyPlayer(me);
        setHasSubmittedThisRound(me.hasActedThisRound);
        if (me.character) setMyCharacter(me.character);
      }

      soundFx.playTurnStart();
    });

    socket.on('round_resolved', (data: { log: GameLogEntry; room: Room; players: RoomPlayer[]; nextRoundNumber: number }) => {
      setIsDMThinking(false);
      setHasSubmittedThisRound(false);

      setLogs(prev => [...prev, data.log]);
      setRoom(data.room);
      setPlayers(data.players);

      const me = data.players.find(p => p.userId === user?.id);
      if (me) {
        setMyPlayer(me);
        if (me.character) setMyCharacter(me.character);
      }

      soundFx.playTurnStart();

      confetti({
        particleCount: 50,
        spread: 60,
        origin: { y: 0.8 },
      });
    });

    socket.on('dice_rolled', () => {
      soundFx.playDiceRoll();
    });

    socket.on('loot_picked_up', (data: { lootId: string; characterId?: string; item: RoomLootItem; character: Character; room: Room }) => {
      if (data.room) setRoom(data.room);
      if (data.character && (myPlayer?.characterId === data.character.id || myPlayer?.characterId === data.characterId)) {
        setMyCharacter(data.character);
      }
    });

    socket.on('item_used', (data: { characterId: string; character: Character; itemName: string; healAmount: number }) => {
      if (data.character && myPlayer?.characterId === data.characterId) {
        setMyCharacter(data.character);
      }
    });

    socket.on('character_updated', (updatedChar: Character) => {
      if (myPlayer?.characterId === updatedChar.id) {
        setMyCharacter(updatedChar);
      }
    });

    socket.on('death_save_result', (data: { characterId: string; character: Character; message: string; state: string }) => {
      if (myPlayer?.characterId === data.characterId) {
        setMyCharacter(data.character);
        setLastDeathSaveMessage(data.message);
      }
    });

    socket.on('talents_loaded', (data: { characterId: string; tree: CharacterTalentTree }) => {
      setTalentTree(data.tree);
    });

    socket.on('action_rejected', (data: ActionRejectedEvent) => {
      setIsDMThinking(false);
      setHasSubmittedThisRound(false);
      setRejectedAction(data);
      soundFx.playCriticalFail();
    });

    socket.on('feed_activity', (data: FeedActivity) => {
      setRecentActivities(prev => [data, ...prev.slice(0, 9)]);
    });

    socket.on('dm_thinking_failed', (data?: { error?: string }) => {
      setIsDMThinking(false);
      setHasSubmittedThisRound(false);
      if (data?.error) {
        console.warn('DM Thinking failed:', data.error);
      }
    });

    socket.on('adventure_finished', (data: { finishType: 'cliffhanger' | 'triumph' | 'open_ended'; title: string; epilogue: string }) => {
      setFinishedAdventure(data);
    });

    return () => {
      isMounted = false;
      socket.off('connect', handleConnect);
      socket.off('room_players_updated');
      socket.off('room_updated');
      socket.off('player_action_submitted');
      socket.off('dm_thinking');
      socket.off('dm_thinking_failed');
      socket.off('turn_step_resolved');
      socket.off('round_resolved');
      socket.off('dice_rolled');
      socket.off('loot_picked_up');
      socket.off('item_used');
      socket.off('character_updated');
      socket.off('death_save_result');
      socket.off('talents_loaded');
      socket.off('action_rejected');
      socket.off('feed_activity');
      socket.off('adventure_finished');
    };
  }, [roomCode, user?.id, myPlayer?.characterId]);

  // Safety watchdog: reset DM thinking state if it takes longer than 40s
  useEffect(() => {
    if (!isDMThinking) return;
    const watchdogTimer = setTimeout(() => {
      setIsDMThinking(false);
    }, 40000);
    return () => clearTimeout(watchdogTimer);
  }, [isDMThinking]);

  const setTurnMode = useCallback((mode: 'simultaneous' | 'turn_by_turn') => {
    const socket = getSocket();
    socket.emit('set_turn_mode', { roomCode, mode });
  }, [roomCode]);

  const submitAction = useCallback((
    actionText: string,
    attachedRolls: DiceRollResult[],
    meta?: {
      actionType?: 'attack' | 'check' | 'save' | 'improvise';
      targetEnemyId?: string;
      targetEnemyName?: string;
      advantage?: boolean;
      disadvantage?: boolean;
      spellLevelUsed?: number;
    }
  ) => {
    const socket = getSocket();
    socket.emit('submit_action', {
      roomCode,
      actionText: actionText.trim() || 'Совершает бросок кубика',
      diceRolls: attachedRolls,
      actionType: meta?.actionType,
      targetEnemyId: meta?.targetEnemyId,
      targetEnemyName: meta?.targetEnemyName,
      advantage: meta?.advantage,
      disadvantage: meta?.disadvantage,
      spellLevelUsed: meta?.spellLevelUsed,
    });
    setHasSubmittedThisRound(true);
    setRejectedAction(null);
  }, [roomCode]);

  const finishAdventure = useCallback((data: {
    finishType: 'cliffhanger' | 'triumph' | 'open_ended';
    title?: string;
    epilogue?: string;
  }) => {
    const socket = getSocket();
    socket.emit('finish_adventure', { roomCode, ...data });
  }, [roomCode]);

  const pickupLoot = useCallback((lootId: string) => {
    if (!myCharacter) return;
    const socket = getSocket();
    socket.emit('pickup_loot', {
      roomCode,
      lootId,
      characterId: myCharacter.id,
    });
  }, [roomCode, myCharacter]);

  const useItem = useCallback((itemId: string) => {
    if (!myCharacter) return;
    const socket = getSocket();
    socket.emit('use_item', {
      roomCode,
      characterId: myCharacter.id,
      itemId,
    });
  }, [roomCode, myCharacter]);

  const equipWeapon = useCallback((itemId: string) => {
    if (!myCharacter) return;
    const socket = getSocket();
    socket.emit('equip_weapon', {
      roomCode,
      characterId: myCharacter.id,
      itemId,
    });
  }, [roomCode, myCharacter]);

  const rollDeathSave = useCallback((rollResult: { rollTotal: number; isNat20: boolean; isNat1: boolean }) => {
    if (!myCharacter) return;
    const socket = getSocket();
    socket.emit('roll_death_save', {
      roomCode,
      characterId: myCharacter.id,
      rollResult,
    });
  }, [roomCode, myCharacter]);

  const fetchTalents = useCallback(() => {
    if (!myCharacter) return;
    const socket = getSocket();
    socket.emit('get_talents', {
      characterId: myCharacter.id,
    });
  }, [myCharacter]);

  const learnTalent = useCallback((talentId: string) => {
    if (!myCharacter) return;
    const socket = getSocket();
    socket.emit('learn_talent', {
      roomCode,
      characterId: myCharacter.id,
      talentId,
    });
  }, [roomCode, myCharacter]);

  const forceResolveRound = useCallback(() => {
    const socket = getSocket();
    socket.emit('force_resolve_round', { roomCode });
  }, [roomCode]);

  const shortRest = useCallback(async (diceCount: number = 1): Promise<{ healedHp: number; diceSpent: number; rolls: number[] }> => {
    if (!myCharacter) throw new Error('Персонаж не выбран');
    const socket = getSocket();
    return new Promise((resolve, reject) => {
      socket.emit(
        'player_short_rest',
        {
          roomCode,
          characterId: myCharacter.id,
          diceCount,
        },
        (res: any) => {
          if (res?.error) {
            reject(new Error(res.error));
          } else {
            resolve(res);
          }
        }
      );
    });
  }, [roomCode, myCharacter]);

  const longRest = useCallback(async (): Promise<{ healedHp: number }> => {
    if (!myCharacter) throw new Error('Персонаж не выбран');
    const socket = getSocket();
    return new Promise((resolve, reject) => {
      socket.emit(
        'player_long_rest',
        {
          roomCode,
          characterId: myCharacter.id,
        },
        (res: any) => {
          if (res?.error) {
            reject(new Error(res.error));
          } else {
            resolve(res);
          }
        }
      );
    });
  }, [roomCode, myCharacter]);

  const activePlayers = players.filter(p => p.characterId);
  const readyCount = activePlayers.filter(p => p.hasActedThisRound).length;

  return {
    room,
    players,
    logs,
    myPlayer,
    myCharacter,
    activePlayers,
    readyCount,
    hasSubmittedThisRound,
    isDMThinking,
    talentTree,
    lastDeathSaveMessage,
    rejectedAction,
    setRejectedAction,
    recentActivities,
    finishedAdventure,
    setFinishedAdventure,
    finishAdventure,
    submitAction,
    forceResolveRound,
    setTurnMode,
    pickupLoot,
    useItem,
    equipWeapon,
    rollDeathSave,
    fetchTalents,
    learnTalent,
    shortRest,
    longRest,
  };
}
