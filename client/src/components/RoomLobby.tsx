import React, { useState, useEffect } from 'react';
import { Room, RoomPlayer, Character } from '../types';
import { api } from '../services/api';
import { getSocket, connectSocket } from '../services/socket';
import { useAuth } from '../context/AuthContext';
import {
  Users,
  Copy,
  Check,
  Play,
  Shield,
  Heart,
  Sparkles,
  ArrowLeft,
  UserCheck,
  Clock,
  ListOrdered,
  Plus
} from 'lucide-react';

interface RoomLobbyProps {
  roomCode: string;
  onGameStarted: () => void;
  onLeave: () => void;
  onCreateCharacter?: () => void;
}

export const RoomLobby: React.FC<RoomLobbyProps> = ({
  roomCode,
  onGameStarted,
  onLeave,
  onCreateCharacter,
}) => {
  const { user } = useAuth();
  const [room, setRoom] = useState<Room | null>(null);
  const [players, setPlayers] = useState<RoomPlayer[]>([]);
  const [myCharacters, setMyCharacters] = useState<Character[]>([]);
  const [selectedCharId, setSelectedCharId] = useState<string>('');
  const [isReady, setIsReady] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isStartingGame, setIsStartingGame] = useState<boolean>(false);
  const [error, setError] = useState<string>('');

  const isHost = user && room && user.id === room.hostUserId;

  useEffect(() => {
    let isMounted = true;

    const loadData = async () => {
      try {
        const [roomData, chars] = await Promise.all([
          api.getRoomByCode(roomCode),
          api.getCharacters(),
        ]);

        if (!isMounted) return;

        setRoom(roomData.room);
        setPlayers(roomData.players);
        setMyCharacters(chars);

        // Find my current player in room
        const myPlayer = roomData.players.find((p: RoomPlayer) => p.userId === user?.id);
        if (myPlayer) {
          setIsReady(myPlayer.isReady);
          if (myPlayer.characterId) {
            setSelectedCharId(myPlayer.characterId);
          } else if (chars.length > 0) {
            setSelectedCharId(chars[0].id);
          }
        } else if (chars.length > 0) {
          setSelectedCharId(chars[0].id);
        }

        // If game already active, immediately transition
        if (roomData.room.status === 'active') {
          onGameStarted();
        }
      } catch (err: any) {
        if (isMounted) setError(err.message || 'Ошибка загрузки комнаты');
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    loadData();

    // Socket.IO setup
    const socket = connectSocket();

    socket.emit('join_room', {
      roomCode,
      characterId: selectedCharId || undefined,
    });

    socket.on('room_players_updated', (updatedPlayers: RoomPlayer[]) => {
      setPlayers(updatedPlayers);
      const myP = updatedPlayers.find((p) => p.userId === user?.id);
      if (myP) {
        setIsReady(myP.isReady);
        if (myP.characterId) setSelectedCharId(myP.characterId);
      }
    });

    socket.on('room_updated', (updatedRoom: Room) => {
      setRoom(updatedRoom);
    });

    socket.on('dm_thinking', () => {
      setIsStartingGame(true);
    });

    socket.on('game_started', () => {
      setIsStartingGame(false);
      onGameStarted();
    });

    socket.on('error_message', (msg: string) => {
      setIsStartingGame(false);
      alert(msg);
    });

    return () => {
      isMounted = false;
      socket.off('room_players_updated');
      socket.off('room_updated');
      socket.off('dm_thinking');
      socket.off('game_started');
      socket.off('error_message');
    };
  }, [roomCode, user?.id]);

  const handleSetTurnMode = (mode: 'simultaneous' | 'turn_by_turn') => {
    const socket = getSocket();
    socket.emit('set_turn_mode', { roomCode, mode });
  };

  const handleSelectCharacter = (charId: string) => {
    setSelectedCharId(charId);
    const socket = getSocket();
    socket.emit('select_character', { roomCode, characterId: charId });
  };

  const handleToggleReady = () => {
    if (!selectedCharId) {
      alert('Сначала выберите персонажа для участия!');
      return;
    }
    const newReady = !isReady;
    setIsReady(newReady);
    const socket = getSocket();
    socket.emit('toggle_ready', { roomCode, isReady: newReady });
  };

  const handleStartGame = () => {
    setIsStartingGame(true);
    const socket = getSocket();
    socket.emit('start_game', { roomCode });
  };

  const copyInviteLink = () => {
    const url = `${window.location.origin}/?room=${roomCode}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  if (isLoading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-400 font-rpg">Вход в таверну приключенцев...</p>
        </div>
      </div>
    );
  }

  if (error || !room) {
    return (
      <div className="max-w-md mx-auto p-6 text-center">
        <div className="bg-red-900/30 border border-red-700/50 p-6 rounded-2xl text-red-300">
          <p className="font-bold text-lg mb-2">Ошибка подключения</p>
          <p className="text-sm mb-4">{error || 'Комната не найдена'}</p>
          <button
            onClick={onLeave}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-sm"
          >
            Вернуться назад
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-6 lg:p-8">
      {/* Top Bar */}
      <div className="flex items-center justify-between gap-4 mb-6">
        <button
          onClick={onLeave}
          className="flex items-center gap-2 text-sm text-slate-400 hover:text-amber-400 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Покинуть комнату
        </button>

        {/* Invite link button */}
        <button
          onClick={copyInviteLink}
          className="px-4 py-2 bg-fantasy-panel border border-amber-500/40 hover:border-amber-500 text-amber-300 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all shadow-glow-gold"
        >
          {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
          <span>{copied ? 'Ссылка скопирована!' : `Пригласить друзей (${room.code})`}</span>
        </button>
      </div>

      {/* Main Lobby Container */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Campaign Overview & Character Select */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-fantasy-panel border border-fantasy-border rounded-2xl p-5 shadow-xl">
            <h2 className="text-xl font-bold font-rpg text-amber-400 mb-2">
              {room.title}
            </h2>
            <div className="p-3 bg-fantasy-card rounded-xl border border-fantasy-border/60 text-xs text-slate-300 leading-relaxed max-h-48 overflow-y-auto">
              <span className="font-bold text-amber-500 block mb-1">Сеттинг приключения:</span>
              {room.setting}
            </div>

            <div className="mt-4 pt-4 border-t border-fantasy-border text-xs text-slate-400 flex items-center justify-between">
              <span>Ведущий (DM): <strong className="text-amber-400">ИИ-Мастер Подземелий</strong></span>
              <span>Код: <strong className="font-mono text-slate-200">{room.code}</strong></span>
            </div>
          </div>

          {/* My Character Picker */}
          <div className="bg-fantasy-panel border border-fantasy-border rounded-2xl p-5 shadow-xl">
            <div className="flex items-center justify-between mb-3 border-b border-fantasy-border/60 pb-2">
              <h3 className="text-sm font-bold font-rpg text-slate-200 uppercase tracking-wider flex items-center gap-2">
                <UserCheck className="w-4 h-4 text-amber-400" />
                Ваш герой в этой сессии
              </h3>
              {onCreateCharacter && (
                <button
                  type="button"
                  onClick={onCreateCharacter}
                  className="text-xs text-amber-400 hover:text-amber-300 font-semibold flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-amber-500/10 transition-colors"
                  title="Создать нового персонажа для этой кампании"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Создать</span>
                </button>
              )}
            </div>

            {myCharacters.length === 0 ? (
              <div className="text-center py-4">
                <p className="text-xs text-slate-400 mb-3">
                  У вас еще нет персонажа. Создайте его, чтобы отправиться в поход!
                </p>
                <button
                  type="button"
                  onClick={() => (onCreateCharacter ? onCreateCharacter() : onLeave())}
                  className="px-4 py-2 bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-slate-950 font-bold text-xs rounded-xl shadow-lg transition-all flex items-center gap-1.5 mx-auto"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Создать персонажа
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {myCharacters.map((c) => (
                  <div
                    key={c.id}
                    onClick={() => handleSelectCharacter(c.id)}
                    className={`p-3 rounded-xl border cursor-pointer flex items-center gap-3 transition-all ${
                      selectedCharId === c.id
                        ? 'bg-amber-500/20 border-amber-500 text-amber-300 shadow-glow-gold'
                        : 'bg-fantasy-card border-fantasy-border text-slate-300 hover:border-slate-500'
                    }`}
                  >
                    <img
                      src={c.avatarUrl}
                      alt={c.name}
                      className="w-10 h-10 rounded-lg object-cover border border-amber-500/60"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = `https://api.dicebear.com/7.x/bottts/svg?seed=${c.name}`;
                      }}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-sm truncate">{c.name}</div>
                      <div className="text-xs text-slate-400">
                        {c.race} • {c.characterClass} ({c.hpCurrent}/{c.hpMax} HP)
                      </div>
                    </div>
                    {selectedCharId === c.id && (
                      <Check className="w-5 h-5 text-amber-400 flex-shrink-0" />
                    )}
                  </div>
                ))}

                {/* Ready Toggle */}
                <button
                  type="button"
                  onClick={handleToggleReady}
                  className={`w-full mt-4 py-3 rounded-xl font-bold font-rpg text-sm transition-all flex items-center justify-center gap-2 ${
                    isReady
                      ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/30'
                      : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700'
                  }`}
                >
                  {isReady ? (
                    <>
                      <Check className="w-4 h-4" /> Вы готовы к игре!
                    </>
                  ) : (
                    <>
                      <Clock className="w-4 h-4" /> Нажмите, когда будете готовы
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Right: Party Members & Host Start */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-fantasy-panel border border-fantasy-border rounded-2xl p-6 shadow-xl">
            <div className="flex items-center justify-between mb-4 border-b border-fantasy-border pb-3">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-amber-400" />
                <h3 className="text-lg font-bold font-rpg text-slate-200">
                  Участники похода ({players.length})
                </h3>
              </div>
              <span className="text-xs text-slate-400">
                {players.filter((p) => p.isReady).length} из {players.length} готовы
              </span>
            </div>

            {/* Players Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {players.map((p) => {
                const char = p.character;
                return (
                  <div
                    key={p.id}
                    className="bg-fantasy-card border border-fantasy-border rounded-xl p-4 flex items-start gap-3 relative overflow-hidden"
                  >
                    {/* Ready status indicator strip */}
                    <div
                      className={`absolute top-0 left-0 bottom-0 w-1 ${
                        p.isReady ? 'bg-emerald-500' : 'bg-slate-700'
                      }`}
                    ></div>

                    {char ? (
                      <img
                        src={char.avatarUrl}
                        alt={char.name}
                        className="w-12 h-12 rounded-xl object-cover border border-amber-500/60 shadow-sm"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = `https://api.dicebear.com/7.x/bottts/svg?seed=${char.name}`;
                        }}
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-500 text-xs">
                        ?
                      </div>
                    )}

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-sm text-slate-100 truncate">
                          {char ? char.name : p.username}
                        </span>
                        {p.userId === room.hostUserId && (
                          <span className="text-[10px] bg-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded font-semibold">
                            Создатель
                          </span>
                        )}
                      </div>

                      {char ? (
                        <p className="text-xs text-slate-400 mt-0.5">
                          {char.race} • {char.characterClass}
                        </p>
                      ) : (
                        <p className="text-xs text-amber-400/80 italic mt-0.5">
                          Выбирает героя...
                        </p>
                      )}

                      {char && (
                        <div className="flex items-center gap-3 mt-2 text-xs">
                          <span className="text-emerald-400 font-semibold flex items-center gap-1">
                            <Heart className="w-3 h-3" /> {char.hpCurrent}/{char.hpMax}
                          </span>
                          <span className="text-blue-400 font-semibold flex items-center gap-1">
                            <Shield className="w-3 h-3" /> {char.ac} КБ
                          </span>
                        </div>
                      )}

                      {/* Ready Badge */}
                      <div className="mt-2">
                        {p.isReady ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-400 bg-emerald-950/40 border border-emerald-800/60 px-2 py-0.5 rounded-full">
                            <Check className="w-3 h-3" /> Готов к походу
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] text-slate-400 bg-slate-800/60 border border-slate-700 px-2 py-0.5 rounded-full">
                            <Clock className="w-3 h-3" /> Подготовка...
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Host Start Game Action */}
            {isHost && (
              <div className="mt-8 pt-6 border-t border-fantasy-border space-y-4">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-fantasy-card p-4 rounded-xl border border-fantasy-border">
                  <div>
                    <h5 className="text-xs font-bold font-rpg text-amber-300 uppercase tracking-wider">
                      Режим ходов отряда
                    </h5>
                    <p className="text-[11px] text-slate-400">
                      {room.turnMode === 'turn_by_turn'
                        ? 'Пошаговый: игроки ходят строго по очереди один за другим'
                        : 'Одновременный: все игроки заявляют действия одновременно в рамках раунда'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleSetTurnMode('simultaneous')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                        room.turnMode !== 'turn_by_turn'
                          ? 'bg-amber-500 text-slate-950 shadow-md font-bold'
                          : 'bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-700'
                      }`}
                    >
                      <Users className="w-3.5 h-3.5" />
                      <span>Общий ход</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSetTurnMode('turn_by_turn')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                        room.turnMode === 'turn_by_turn'
                          ? 'bg-purple-600 text-white shadow-md font-bold'
                          : 'bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-700'
                      }`}
                    >
                      <ListOrdered className="w-3.5 h-3.5" />
                      <span>По очереди</span>
                    </button>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div>
                    <h4 className="text-sm font-bold font-rpg text-slate-200">
                      Панель создателя комнаты
                    </h4>
                    <p className="text-xs text-slate-400">
                      Убедитесь, что все ваши друзья выбрали персонажей, и нажмите кнопку запуска.
                    </p>
                  </div>

                  <button
                    onClick={handleStartGame}
                    disabled={isStartingGame}
                    className="w-full sm:w-auto px-8 py-3.5 bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-slate-950 font-extrabold font-rpg rounded-xl shadow-xl shadow-amber-600/30 transition-all flex items-center justify-center gap-2 disabled:opacity-75 disabled:cursor-wait"
                  >
                    {isStartingGame ? (
                      <>
                        <div className="w-5 h-5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                        <span>Мастер создаёт мир...</span>
                      </>
                    ) : (
                      <>
                        <Play className="w-5 h-5 fill-current" />
                        <span>Запустить игру</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Full-screen Loading Overlay when Master is generating the adventure */}
      {isStartingGame && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-fantasy-panel border border-amber-500/50 rounded-2xl p-8 max-w-md w-full text-center shadow-2xl space-y-6 relative overflow-hidden">
            <div className="absolute -top-12 -left-12 w-36 h-36 bg-amber-500/20 rounded-full blur-2xl pointer-events-none" />
            <div className="absolute -bottom-12 -right-12 w-36 h-36 bg-purple-500/20 rounded-full blur-2xl pointer-events-none" />

            <div className="relative">
              <div className="w-20 h-20 rounded-2xl bg-amber-500/15 border border-amber-500/40 flex items-center justify-center text-amber-400 mx-auto shadow-glow-gold animate-bounce">
                <Sparkles className="w-10 h-10 animate-spin-slow" />
              </div>
            </div>

            <div className="space-y-2">
              <h3 className="text-xl font-bold font-rpg text-amber-300">
                ИИ-Мастер создаёт приключение...
              </h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                Генерация художественного пролога, расстановка сил на поле боя и подготовка первой развилки для отряда.
              </p>
            </div>

            <div className="flex items-center justify-center gap-2 text-xs font-mono text-amber-400/90 pt-2">
              <div className="w-4 h-4 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
              <span>Пожалуйста, подождите несколько секунд...</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
