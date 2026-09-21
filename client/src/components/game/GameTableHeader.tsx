import React from 'react';
import { Room } from '../../types';
import { ArrowLeft, Clock, Package, Award, BookMarked, Zap, ListOrdered, Users, BookOpen, Flame, Flag } from 'lucide-react';

interface GameTableHeaderProps {
  room: Room;
  readyCount: number;
  totalActivePlayers: number;
  characterLevel?: number;
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
  characterLevel,
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
    <div className="bg-[#13161d] border border-[#2a303d] rounded-xl p-3 sm:p-4 mb-3.5 shadow-xl space-y-3">
      {/* Top Row: Title, Core Status, Main Hero Dossiers & Invite */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#242935] pb-3">
        {/* Left: Leave button + Campaign Title + Round & Turn status */}
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={onLeave}
            className="p-1.5 text-[#968e7f] hover:text-[#c5a059] rounded-lg hover:bg-[#1a1f29] border border-transparent hover:border-[#3d3424] transition-colors shrink-0"
            title="Вернуться в лобби"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2.5 flex-wrap min-w-0">
            <h2 className="text-base sm:text-lg font-bold font-rpg text-[#e2c26a] tracking-wide truncate">
              {room.title}
            </h2>
            <span className="px-2 py-0.5 rounded text-[11px] font-mono bg-[#181c25] text-[#c5a059] border border-[#4a3e26] shrink-0">
              Раунд {room.roundNumber}
            </span>
            <div className="flex items-center gap-1.5 bg-[#181c25] px-2.5 py-0.5 rounded border border-[#2a303d] text-[11px] font-mono shrink-0">
              <Clock className="w-3.5 h-3.5 text-[#c5a059]" />
              <span className="text-[#ded7c8]">
                Ход: <strong className="text-[#e2c26a]">{readyCount}</strong> / <strong>{totalActivePlayers}</strong>
              </span>
            </div>
          </div>
        </div>

        {/* Right: Primary Hero Dossiers & Books */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Quick launcher: Inventory */}
          {onOpenInventory && (
            <button
              onClick={onOpenInventory}
              className="px-3 py-1.5 bg-gradient-to-b from-[#231e15] to-[#17140e] hover:from-[#352c1e] hover:to-[#221c13] border border-[#c5a059]/70 hover:border-[#facc15] rounded-lg text-[#fef08a] text-xs font-rpg font-bold transition-all flex items-center gap-1.5 shadow-md active:translate-y-0.5"
              title="Инвентарь и снаряжение"
            >
              <span className="text-sm">🎒</span>
              <span>Инвентарь</span>
              {inventoryCount > 0 && (
                <span className="px-1.5 py-0.2 bg-[#0c0d11] text-[10px] text-[#facc15] rounded font-mono font-bold border border-[#c5a059]">
                  {inventoryCount}
                </span>
              )}
            </button>
          )}

          {/* Quick launcher: Talents */}
          {onOpenTalents && (
            <button
              onClick={onOpenTalents}
              className={`px-3 py-1.5 rounded-lg text-xs font-rpg font-bold transition-all flex items-center gap-1.5 shadow-md active:translate-y-0.5 ${
                skillPoints > 0
                  ? 'bg-gradient-to-b from-[#b45309] to-[#78350f] border-2 border-[#f59e0b] text-white animate-pulse'
                  : 'bg-gradient-to-b from-[#221c13] to-[#15120c] hover:from-[#332a1d] hover:to-[#1e1911] border border-[#785e2b] text-[#fef08a]'
              }`}
              title="Древо талантов персонажа"
            >
              <span className="text-sm">⚡</span>
              <span>Таланты</span>
              {characterLevel ? (
                <span className="px-1.5 py-0.2 bg-[#0c0d11] text-[10px] text-[#facc15] rounded font-mono font-bold border border-[#785e2b]">
                  {characterLevel} ур.
                </span>
              ) : null}
              {skillPoints > 0 && (
                <span className="px-1.5 py-0.2 bg-[#facc15] text-black font-bold text-[10px] rounded-full">
                  +{skillPoints}
                </span>
              )}
            </button>
          )}

          {/* Quick launcher: Lore Journal */}
          {onOpenJournal && (
            <button
              onClick={onOpenJournal}
              className="px-3 py-1.5 bg-gradient-to-b from-[#1e1528] to-[#120d1a] hover:from-[#2d203d] hover:to-[#1a1324] border border-[#7c3aed]/60 hover:border-[#a78bfa] rounded-lg text-[#e9d5ff] text-xs font-rpg font-bold transition-all flex items-center gap-1.5 shadow-md active:translate-y-0.5"
              title="Летопись и хроника кампании"
            >
              <span className="text-sm">📜</span>
              <span>Летопись</span>
              {milestonesCount > 0 && (
                <span className="px-1.5 py-0.2 bg-[#0c0d11] text-[10px] text-[#c084fc] rounded font-mono font-bold border border-[#7c3aed]/50">
                  {milestonesCount}
                </span>
              )}
            </button>
          )}

          {/* Quick launcher: Rest */}
          {onOpenRest && (
            <button
              onClick={onOpenRest}
              className="px-3 py-1.5 bg-gradient-to-b from-[#241712] to-[#170e0b] hover:from-[#38241d] hover:to-[#221510] border border-[#ea580c]/60 hover:border-[#fb923c] rounded-lg text-[#fed7aa] text-xs font-rpg font-bold transition-all flex items-center gap-1.5 shadow-md active:translate-y-0.5"
              title="Привал: короткий или продолжительный отдых"
            >
              <span className="text-sm">⛺</span>
              <span>Привал</span>
            </button>
          )}

          {/* Invite Link Button */}
          <button
            onClick={handleCopyInvite}
            className="px-3 py-1.5 bg-gradient-to-b from-[#16221a] to-[#0e1711] hover:from-[#203326] hover:to-[#14221a] border border-[#10b981]/60 hover:border-[#34d399] rounded-lg text-[#a7f3d0] text-xs font-rpg font-bold transition-all flex items-center gap-1.5 shadow-md active:translate-y-0.5"
            title="Скопировать ссылку для приглашения друзей"
          >
            <span className="text-sm">🔗</span>
            <span>Пригласить</span>
          </button>
        </div>
      </div>

      {/* Bottom Row: Story Setting & DM Utilities Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
        {/* Left: Setting description & Badges */}
        <div className="flex items-center gap-3 flex-wrap min-w-0 flex-1">
          {room.genre && (
            <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-[#162033] text-[#93c5fd] border border-[#233555] shrink-0 font-bold">
              🎭 {GENRE_SHORT_LABELS[room.genre] || room.genre}
            </span>
          )}
          {room.campaignDuration && (
            <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-[#221833] text-[#c084fc] border border-[#3d265a] shrink-0 font-bold">
              ⏳ {DURATION_SHORT_LABELS[room.campaignDuration] || room.campaignDuration}
            </span>
          )}
          {room.setting && (
            <p className="text-[13px] text-[#ded7c8] font-serif leading-relaxed line-clamp-1 max-w-2xl" title={room.setting}>
              📖 {room.setting}
            </p>
          )}
        </div>

        {/* Right: Turn Mode & Host Master Commands */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Turn Mode Selector / Indicator */}
          {isHost && onToggleTurnMode ? (
            <button
              onClick={() => onToggleTurnMode(room.turnMode === 'turn_by_turn' ? 'simultaneous' : 'turn_by_turn')}
              className={`px-3 py-1 border rounded-lg text-xs font-rpg font-bold transition-all flex items-center gap-1.5 shadow-sm active:translate-y-0.5 ${
                room.turnMode === 'turn_by_turn'
                  ? 'bg-gradient-to-b from-[#2a1d3d] to-[#181124] border-[#8b5cf6] text-[#e9d5ff]'
                  : 'bg-gradient-to-b from-[#1c2230] to-[#121620] border-[#38bdf8]/60 text-[#bae6fd]'
              }`}
              title={`Режим ходов: ${room.turnMode === 'turn_by_turn' ? 'По очереди' : 'Общий ход'}`}
            >
              {room.turnMode === 'turn_by_turn' ? (
                <>
                  <span className="text-sm">🔄</span>
                  <span>По очереди</span>
                </>
              ) : (
                <>
                  <span className="text-sm">👥</span>
                  <span>Общий ход</span>
                </>
              )}
            </button>
          ) : (
            <div
              className={`px-2.5 py-1 border rounded-lg text-xs font-rpg font-bold flex items-center gap-1.5 ${
                room.turnMode === 'turn_by_turn'
                  ? 'bg-[#221833] border-[#4a2e72] text-[#d8b4fe]'
                  : 'bg-[#181c25] border-[#2e3544] text-[#ded7c8]'
              }`}
            >
              {room.turnMode === 'turn_by_turn' ? (
                <>
                  <span className="text-sm">🔄</span>
                  <span>По очереди</span>
                </>
              ) : (
                <>
                  <span className="text-sm">👥</span>
                  <span>Общий ход</span>
                </>
              )}
            </div>
          )}

          {/* Quick launcher: Authentic D&D Guide */}
          {onOpenGuide && (
            <button
              onClick={onOpenGuide}
              className="px-3 py-1 bg-gradient-to-b from-[#1e2330] to-[#131720] hover:from-[#293042] hover:to-[#1a1f2b] border border-[#475569] hover:border-[#94a3b8] rounded-lg text-[#e2e8f0] text-xs font-rpg font-bold transition-all flex items-center gap-1.5 shadow-sm active:translate-y-0.5"
              title="О D&D 5e: 3-шаговый цикл, характеристики, правила"
            >
              <span className="text-sm">📖</span>
              <span>О D&D</span>
            </button>
          )}

          {/* Host Finish Session / Adventure */}
          {isHost && onOpenFinishModal && (
            <button
              onClick={onOpenFinishModal}
              className="px-3 py-1 bg-gradient-to-b from-[#2d1420] to-[#1c0c14] hover:from-[#3f1c2d] hover:to-[#28111d] border border-[#ec4899]/60 hover:border-[#f472b6] rounded-lg text-[#fbcfe8] text-xs font-rpg font-bold transition-all flex items-center gap-1.5 shadow-sm active:translate-y-0.5"
              title="Завершить сессию на клиффхэнгере или объявить победу в модуле"
            >
              <span className="text-sm">🏁</span>
              <span>Финал сессии</span>
            </button>
          )}

          {/* Host Force Turn Button */}
          {isHost && onForceResolve && (
            <button
              onClick={onForceResolve}
              disabled={isDMThinking}
              className="game-btn-gold px-3.5 py-1 rounded-lg text-xs font-rpg font-extrabold uppercase tracking-wider transition-all flex items-center gap-1.5 disabled:opacity-50"
              title="Завершить раунд и запустить ход Мастера"
            >
              <Zap className="w-3.5 h-3.5 text-black fill-current" />
              <span>ХОД МАСТЕРА</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
