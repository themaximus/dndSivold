import React from 'react';
import { Room } from '../../types';
import { ArrowLeft, Clock, Package, Award, BookMarked, Zap, ListOrdered, Users, BookOpen, Flame, Flag } from 'lucide-react';

interface GameTableHeaderProps {
  room: Room;
  readyCount: number;
  totalActivePlayers: number;
  inventoryCount?: number;
  skillPoints?: number;
  milestonesCount?: number;
  isHost?: boolean;
  isDMThinking?: boolean;
  onForceResolve?: () => void;
  onToggleTurnMode?: (mode: 'simultaneous' | 'turn_by_turn') => void;
  onOpenInventory?: () => void;
  onOpenTalents?: () => void;
  onOpenJournal?: () => void;
  onOpenGuide?: () => void;
  onOpenFinishModal?: () => void;
  onOpenRest?: () => void;
  onLeave: () => void;
}

const GENRE_SHORT_LABELS: Record<string, string> = {
  fantasy: '⚔️ Фэнтези',
  cyberpunk: '🦾 Киберпанк',
  mafia: '🕵️ Мафия 1930',
  scifi: '🚀 Sci-Fi',
  detective: '🔍 Детектив',
  horror: '🕯️ Хоррор',
};

const DURATION_SHORT_LABELS: Record<string, string> = {
  short: '⚡ 10 раундов',
  medium: '🛡️ 16 раундов',
  long: '👑 20+ раундов',
};

export const GameTableHeader: React.FC<GameTableHeaderProps> = ({
  room,
  readyCount,
  totalActivePlayers,
  inventoryCount = 0,
  skillPoints = 0,
  milestonesCount = 0,
  isHost = false,
  isDMThinking = false,
  onForceResolve,
  onToggleTurnMode,
  onOpenInventory,
  onOpenTalents,
  onOpenJournal,
  onOpenGuide,
  onOpenFinishModal,
  onOpenRest,
  onLeave,
}) => {
  const handleCopyInvite = () => {
    const url = `${window.location.origin}/?room=${room.code}`;
    navigator.clipboard.writeText(url);
    alert(`Ссылка на комнату скопирована в буфер обмена!\n\n${url}`);
  };

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 bg-fantasy-panel border border-fantasy-border rounded-2xl p-4 mb-4 shadow-xl">
      <div className="flex items-center gap-3">
        <button
          onClick={onLeave}
          className="p-2 text-slate-400 hover:text-amber-400 rounded-lg hover:bg-slate-800 transition-colors"
          title="В лобби"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-lg font-bold font-rpg text-amber-400">
              {room.title}
            </h2>
            <span className="px-2 py-0.5 rounded-full text-[11px] font-mono bg-amber-500/20 text-amber-300 border border-amber-500/40">
              Раунд {room.roundNumber}
            </span>
            {room.genre && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-blue-950/40 text-blue-300 border border-blue-800/40">
                {GENRE_SHORT_LABELS[room.genre] || room.genre}
              </span>
            )}
            {room.campaignDuration && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-indigo-950/40 text-indigo-300 border border-indigo-800/40">
                {DURATION_SHORT_LABELS[room.campaignDuration] || room.campaignDuration}
              </span>
            )}
          </div>
          <p className="text-xs text-slate-400 truncate max-w-xl">
            {room.setting}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {/* Quick launcher: Authentic D&D Guide */}
        {onOpenGuide && (
          <button
            onClick={onOpenGuide}
            className="px-3 py-1.5 bg-fantasy-card hover:bg-slate-800 border border-fantasy-border hover:border-amber-500/50 rounded-xl text-slate-200 hover:text-amber-300 text-xs font-semibold transition-all flex items-center gap-1.5 shadow-sm"
            title="О D&D 5e: 3-шаговый цикл, характеристики, отсутствие рельсов"
          >
            <BookOpen className="w-3.5 h-3.5 text-amber-400" />
            <span>О D&D</span>
          </button>
        )}

        {/* Quick launcher: Host Finish Session / Adventure */}
        {isHost && onOpenFinishModal && (
          <button
            onClick={onOpenFinishModal}
            className="px-3 py-1.5 bg-purple-950/40 hover:bg-purple-900/60 border border-purple-500/50 hover:border-purple-400 rounded-xl text-purple-200 hover:text-white text-xs font-semibold transition-all flex items-center gap-1.5 shadow-sm"
            title="Завершить сессию на клиффхэнгере или объявить победу в модуле"
          >
            <Flag className="w-3.5 h-3.5 text-purple-400" />
            <span>Сессия / Финал</span>
          </button>
        )}

        {/* Quick launcher: Inventory */}
        {onOpenInventory && (
          <button
            onClick={onOpenInventory}
            className="px-3 py-1.5 bg-fantasy-card hover:bg-slate-800 border border-fantasy-border hover:border-amber-500/50 rounded-xl text-slate-200 hover:text-amber-300 text-xs font-semibold transition-all flex items-center gap-1.5 relative shadow-sm"
          >
            <Package className="w-3.5 h-3.5 text-amber-400" />
            <span>Инвентарь</span>
            {inventoryCount > 0 && (
              <span className="px-1.5 py-0.2 bg-slate-800 text-[10px] text-amber-300 rounded font-mono">
                {inventoryCount}
              </span>
            )}
          </button>
        )}

        {/* Quick launcher: Talents */}
        {onOpenTalents && (
          <button
            onClick={onOpenTalents}
            className={`px-3 py-1.5 border rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 relative shadow-sm ${
              skillPoints > 0
                ? 'bg-amber-500/20 border-amber-500/60 text-amber-300 animate-pulse hover:bg-amber-500 hover:text-black'
                : 'bg-fantasy-card hover:bg-slate-800 border-fantasy-border hover:border-amber-500/50 text-slate-200 hover:text-amber-300'
            }`}
          >
            <Award className="w-3.5 h-3.5 text-amber-400" />
            <span>Таланты</span>
            {skillPoints > 0 && (
              <span className="px-1.5 py-0.2 bg-amber-500 text-black font-bold text-[10px] rounded-full">
                +{skillPoints}
              </span>
            )}
          </button>
        )}

        {/* Quick launcher: Lore Journal */}
        {onOpenJournal && (
          <button
            onClick={onOpenJournal}
            className="px-3 py-1.5 bg-fantasy-card hover:bg-slate-800 border border-fantasy-border hover:border-purple-500/50 rounded-xl text-slate-200 hover:text-purple-300 text-xs font-semibold transition-all flex items-center gap-1.5 shadow-sm"
          >
            <BookMarked className="w-3.5 h-3.5 text-purple-400" />
            <span>Журнал</span>
            {milestonesCount > 0 && (
              <span className="px-1.5 py-0.2 bg-slate-800 text-[10px] text-purple-300 rounded font-mono">
                {milestonesCount}
              </span>
            )}
          </button>
        )}

        {/* Quick launcher: Rest */}
        {onOpenRest && (
          <button
            onClick={onOpenRest}
            className="px-3 py-1.5 bg-fantasy-card hover:bg-slate-800 border border-fantasy-border hover:border-amber-500/50 rounded-xl text-slate-200 hover:text-amber-300 text-xs font-semibold transition-all flex items-center gap-1.5 shadow-sm"
            title="Привал: короткий или продолжительный отдых"
          >
            <Flame className="w-3.5 h-3.5 text-amber-500" />
            <span>Отдых</span>
          </button>
        )}

        {/* Turn Mode Selector / Indicator */}
        {isHost && onToggleTurnMode ? (
          <button
            onClick={() => onToggleTurnMode(room.turnMode === 'turn_by_turn' ? 'simultaneous' : 'turn_by_turn')}
            className={`px-3 py-1.5 border rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 shadow-sm ${
              room.turnMode === 'turn_by_turn'
                ? 'bg-purple-950/50 border-purple-500/60 text-purple-200 hover:bg-purple-900/60'
                : 'bg-fantasy-card hover:bg-slate-800 border-fantasy-border text-slate-300 hover:text-amber-300'
            }`}
            title={`Режим ходов: ${room.turnMode === 'turn_by_turn' ? 'По очереди (нажмите, чтобы переключить на общий ход)' : 'Общий ход (нажмите, чтобы переключить на поочередный ход)'}`}
          >
            {room.turnMode === 'turn_by_turn' ? (
              <>
                <ListOrdered className="w-3.5 h-3.5 text-purple-400" />
                <span>По очереди</span>
              </>
            ) : (
              <>
                <Users className="w-3.5 h-3.5 text-amber-400" />
                <span>Общий ход</span>
              </>
            )}
          </button>
        ) : (
          <div
            className={`px-3 py-1.5 border rounded-xl text-xs font-medium flex items-center gap-1.5 ${
              room.turnMode === 'turn_by_turn'
                ? 'bg-purple-950/30 border-purple-500/40 text-purple-300'
                : 'bg-fantasy-card border-fantasy-border text-slate-300'
            }`}
            title={`Режим ходов: ${room.turnMode === 'turn_by_turn' ? 'По очереди' : 'Общий ход'}`}
          >
            {room.turnMode === 'turn_by_turn' ? (
              <>
                <ListOrdered className="w-3.5 h-3.5 text-purple-400" />
                <span>По очереди</span>
              </>
            ) : (
              <>
                <Users className="w-3.5 h-3.5 text-amber-400" />
                <span>Общий ход</span>
              </>
            )}
          </div>
        )}

        {/* Round Action Status */}
        <div className="flex items-center gap-2 bg-fantasy-card px-3 py-1.5 rounded-xl border border-fantasy-border text-xs">
          <Clock className="w-4 h-4 text-amber-400" />
          <span className="text-slate-300">
            Ход: <strong className="text-amber-400">{readyCount}</strong> из <strong>{totalActivePlayers}</strong>
          </span>
        </div>

        {/* Host Force Turn Button */}
        {isHost && onForceResolve && (
          <button
            onClick={onForceResolve}
            disabled={isDMThinking}
            className="px-3 py-1.5 bg-amber-500/20 hover:bg-amber-500 text-amber-300 hover:text-black border border-amber-500/50 rounded-xl text-xs font-bold font-rpg transition-all flex items-center gap-1.5 shadow-sm disabled:opacity-50"
            title="Завершить раунд и запустить ход Мастера (даже если кто-то из игроков не успел)"
          >
            <Zap className="w-3.5 h-3.5 fill-current" />
            <span>Ход Мастера</span>
          </button>
        )}

        <button
          onClick={handleCopyInvite}
          className="px-3 py-1.5 bg-fantasy-card hover:bg-slate-800 border border-fantasy-border rounded-xl text-amber-300 hover:text-white text-xs font-semibold transition-colors flex items-center gap-1.5"
          title="Скопировать ссылку для приглашения друзей"
        >
          <span>Пригласить</span>
        </button>
      </div>
    </div>
  );
};
