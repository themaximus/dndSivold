import React, { useState, useEffect } from 'react';
import { UserRoomSummary } from '../types';
import { api } from '../services/api';
import {
  Compass,
  Plus,
  Play,
  Copy,
  Check,
  Users,
  Shield,
  Clock,
  Sparkles,
  ArrowRight,
  RefreshCw,
  Crown,
  Heart
} from 'lucide-react';

interface MyCampaignsListProps {
  onEnterRoom: (roomCode: string) => void;
  onCreateRoom: () => void;
}

export const MyCampaignsList: React.FC<MyCampaignsListProps> = ({
  onEnterRoom,
  onCreateRoom,
}) => {
  const [rooms, setRooms] = useState<UserRoomSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [joinCodeInput, setJoinCodeInput] = useState('');
  const [joinError, setJoinError] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const loadRooms = async () => {
    setIsLoading(true);
    try {
      const data = await api.getMyRooms();
      setRooms(data);
    } catch (err) {
      console.error('Failed to load my rooms:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadRooms();
  }, []);

  const handleCopyLink = (code: string) => {
    const inviteUrl = `${window.location.origin}/?room=${code}`;
    navigator.clipboard.writeText(inviteUrl);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2500);
  };

  const handleJoinByCode = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCode = joinCodeInput.trim().toUpperCase();
    if (!cleanCode) return;
    setJoinError(null);
    onEnterRoom(cleanCode);
  };

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
      {/* Header & Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h2 className="text-3xl font-bold font-rpg text-amber-400 flex items-center gap-3">
            <Compass className="w-8 h-8 text-amber-500" />
            Ваши кампании и комнаты
          </h2>
          <p className="text-sm text-slate-400 mt-1">
            Сохраненные сессии с вашим участием. Возвращайтесь к начатым битвам в один клик.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={loadRooms}
            title="Обновить список"
            className="p-2.5 rounded-xl border border-fantasy-border bg-fantasy-card text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>

          <button
            onClick={onCreateRoom}
            className="px-5 py-2.5 bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-slate-950 font-bold font-rpg rounded-xl shadow-lg shadow-amber-600/30 transition-all flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Создать комнату
          </button>
        </div>
      </div>

      {/* Quick Join By Code Bar */}
      <div className="bg-fantasy-panel border border-fantasy-border/80 rounded-2xl p-4 sm:p-5 mb-8 shadow-lg">
        <form onSubmit={handleJoinByCode} className="flex flex-col sm:flex-row items-center gap-3">
          <div className="flex-1 w-full relative">
            <input
              type="text"
              value={joinCodeInput}
              onChange={(e) => setJoinCodeInput(e.target.value)}
              placeholder="Вставьте код комнаты (например: DUNGEON-342)"
              className="w-full px-4 py-2.5 bg-fantasy-card border border-fantasy-border rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-500 text-sm uppercase tracking-wider font-mono font-bold"
            />
          </div>
          <button
            type="submit"
            className="w-full sm:w-auto px-6 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold font-rpg rounded-xl text-sm transition-all flex items-center justify-center gap-2 shadow-glow-gold"
          >
            Войти по коду
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>
        {joinError && (
          <p className="text-red-400 text-xs mt-2">{joinError}</p>
        )}
      </div>

      {/* Campaign Cards */}
      {isLoading ? (
        <div className="text-center py-16">
          <div className="w-10 h-10 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
          <p className="text-slate-400 text-sm font-rpg">Загрузка ваших кампаний...</p>
        </div>
      ) : rooms.length === 0 ? (
        <div className="bg-fantasy-panel border border-fantasy-border rounded-2xl p-12 text-center max-w-xl mx-auto my-8">
          <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 mx-auto mb-4 shadow-glow-gold">
            <Sparkles className="w-8 h-8" />
          </div>
          <h3 className="text-xl font-bold font-rpg text-slate-200 mb-2">
            Вы пока не участвуете ни в одной кампании
          </h3>
          <p className="text-sm text-slate-400 mb-6">
            Создайте свою комнату или введите код приглашения от друзей, чтобы отправиться в совместное приключение с ИИ-Мастером!
          </p>
          <button
            onClick={onCreateRoom}
            className="px-6 py-3 bg-amber-500 hover:bg-amber-400 text-black font-bold font-rpg rounded-xl transition-colors inline-flex items-center gap-2"
          >
            <Plus className="w-5 h-5" />
            Создать первую кампанию
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {rooms.map((room) => {
            const isPlaying = room.status === 'active';
            const isWaiting = room.status === 'waiting';

            return (
              <div
                key={room.id}
                className="bg-fantasy-panel border border-fantasy-border hover:border-amber-500/50 rounded-2xl p-5 shadow-xl transition-all duration-200 hover:-translate-y-1 flex flex-col justify-between group relative overflow-hidden"
              >
                {/* Glow accent */}
                <div className="absolute -top-16 -right-16 w-32 h-32 bg-amber-500/5 rounded-full blur-2xl pointer-events-none group-hover:bg-amber-500/10 transition-colors"></div>

                <div>
                  {/* Top Badges */}
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <div className="flex items-center gap-2">
                      {isPlaying ? (
                        <span className="px-2.5 py-1 rounded-lg bg-emerald-500/15 border border-emerald-500/40 text-emerald-400 text-[11px] font-bold flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                          Раунд {room.roundNumber}
                        </span>
                      ) : isWaiting ? (
                        <span className="px-2.5 py-1 rounded-lg bg-amber-500/15 border border-amber-500/40 text-amber-400 text-[11px] font-bold flex items-center gap-1.5">
                          <Clock className="w-3 h-3 text-amber-400" />
                          Сбор в лобби
                        </span>
                      ) : (
                        <span className="px-2.5 py-1 rounded-lg bg-slate-800 border border-slate-700 text-slate-400 text-[11px]">
                          Завершена
                        </span>
                      )}

                      {room.isHost && (
                        <span className="px-2 py-0.5 rounded-md bg-amber-500/20 border border-amber-500/30 text-amber-300 text-[10px] font-bold flex items-center gap-1">
                          <Crown className="w-3 h-3 text-amber-400" />
                          Ведущий
                        </span>
                      )}
                    </div>

                    {/* Players Count Badge */}
                    <div className="flex items-center gap-1 text-xs text-slate-400 bg-fantasy-card px-2 py-1 rounded-lg border border-fantasy-border/60">
                      <Users className="w-3.5 h-3.5 text-amber-400" />
                      <span>{room.playerCount} / {room.maxPlayers}</span>
                    </div>
                  </div>

                  {/* Title & Code */}
                  <h3 className="text-lg font-bold font-rpg text-amber-300 group-hover:text-amber-200 transition-colors line-clamp-1 mb-1">
                    {room.title}
                  </h3>

                  <div className="flex items-center justify-between text-xs text-slate-400 mb-3 font-mono">
                    <span>Код: <strong className="text-slate-200">{room.code}</strong></span>
                    <button
                      onClick={() => handleCopyLink(room.code)}
                      className="text-[11px] text-amber-400/80 hover:text-amber-300 flex items-center gap-1 font-sans transition-colors"
                    >
                      {copiedCode === room.code ? (
                        <>
                          <Check className="w-3 h-3 text-emerald-400" />
                          <span className="text-emerald-400">Ссылка скопирована!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3" />
                          <span>Пригласить</span>
                        </>
                      )}
                    </button>
                  </div>

                  {/* Setting Excerpt */}
                  <div className="bg-fantasy-card p-2.5 rounded-xl border border-fantasy-border/60 text-xs text-slate-300 line-clamp-2 leading-relaxed mb-4">
                    {room.setting}
                  </div>

                  {/* User's Assigned Character if exists */}
                  {room.myCharacter ? (
                    <div className="p-2.5 bg-slate-900/80 border border-slate-800 rounded-xl flex items-center gap-3 mb-4">
                      <img
                        src={room.myCharacter.avatarUrl}
                        alt={room.myCharacter.name}
                        className="w-10 h-10 rounded-lg object-cover border border-amber-500/50"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = `https://api.dicebear.com/7.x/bottts/svg?seed=${room.myCharacter?.name}`;
                        }}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-xs text-amber-300 truncate">
                            {room.myCharacter.name}
                          </span>
                          <span className="text-[10px] text-emerald-400 font-bold flex items-center gap-0.5">
                            <Heart className="w-2.5 h-2.5 fill-emerald-500" />
                            {room.myCharacter.hpCurrent}/{room.myCharacter.hpMax}
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-400 truncate">
                          {room.myCharacter.race} • {room.myCharacter.characterClass} ({room.myCharacter.level} ур.)
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="p-2 bg-slate-900/40 border border-dashed border-slate-800 rounded-xl text-center text-[11px] text-slate-500 mb-4">
                      Герой еще не выбран в этой комнате
                    </div>
                  )}
                </div>

                {/* Return to Room Button */}
                <button
                  onClick={() => onEnterRoom(room.code)}
                  className="w-full py-2.5 bg-amber-500/15 hover:bg-amber-500 text-amber-300 hover:text-black font-bold text-xs font-rpg rounded-xl border border-amber-500/40 transition-all flex items-center justify-center gap-2 shadow-glow-gold"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  {isPlaying ? 'Продолжить приключение' : 'Войти в лобби'}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
