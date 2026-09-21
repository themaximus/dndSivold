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
        <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
          {/* Quick launcher: Inventory */}
          {onOpenInventory && (
            <button
              onClick={onOpenInventory}
              className="px-2.5 sm:px-3 py-1.5 bg-[#181c25] hover:bg-[#1f2430] border border-[#2e3544] hover:border-[#c5a059]/60 rounded-lg text-[#ded7c8] hover:text-[#e2c26a] text-xs font-serif font-semibold transition-all flex items-center gap-1.5 shadow-sm"
              title="Инвентарь и снаряжение"
            >
              <Package className="w-3.5 h-3.5 text-[#c5a059]" />
              <span>Инвентарь</span>
              {inventoryCount > 0 && (
                <span className="px-1.5 py-0.2 bg-[#0c0d11] text-[10px] text-[#c5a059] rounded font-mono border border-[#3a3224]">
                  {inventoryCount}
                </span>
              )}
            </button>
          )}

          {/* Quick launcher: Talents */}
          {onOpenTalents && (
            <button
              onClick={onOpenTalents}
              className={`px-2.5 sm:px-3 py-1.5 border rounded-lg text-xs font-serif font-semibold transition-all flex items-center gap-1.5 shadow-sm ${
                skillPoints > 0
                  ? 'bg-[#2b2213] border-[#785e2b] text-[#e2c26a] animate-pulse hover:bg-[#3d301a]'
                  : 'bg-[#181c25] hover:bg-[#1f2430] border-[#2e3544] hover:border-[#c5a059]/60 text-[#ded7c8] hover:text-[#e2c26a]'
              }`}
              title="Древо талантов персонажа"
            >
              <Award className="w-3.5 h-3.5 text-[#c5a059]" />
              <span>Таланты</span>
              {characterLevel ? (
                <span className="px-1.5 py-0.2 bg-[#0c0d11] text-[10px] text-[#c5a059] rounded font-mono border border-[#3a3224]">
                  {characterLevel} ур.
                </span>
              ) : null}
              {skillPoints > 0 && (
                <span className="px-1.5 py-0.2 bg-[#c5a059] text-black font-bold text-[10px] rounded-full">
                  +{skillPoints}
                </span>
              )}
            </button>
          )}

          {/* Quick launcher: Lore Journal */}
          {onOpenJournal && (
            <button
              onClick={onOpenJournal}
              className="px-2.5 sm:px-3 py-1.5 bg-[#181c25] hover:bg-[#1f2430] border border-[#2e3544] hover:border-[#8b5cf6]/50 rounded-lg text-[#ded7c8] hover:text-[#c4b5fd] text-xs font-serif font-semibold transition-all flex items-center gap-1.5 shadow-sm"
              title="Летопись и хроника кампании"
            >
              <BookMarked className="w-3.5 h-3.5 text-[#a78bfa]" />
              <span>Летопись</span>
              {milestonesCount > 0 && (
                <span className="px-1.5 py-0.2 bg-[#0c0d11] text-[10px] text-[#c4b5fd] rounded font-mono border border-[#372d54]">
                  {milestonesCount}
                </span>
              )}
            </button>
          )}

          {/* Quick launcher: Rest */}
          {onOpenRest && (
            <button
              onClick={onOpenRest}
              className="px-2.5 sm:px-3 py-1.5 bg-[#181c25] hover:bg-[#1f2430] border border-[#2e3544] hover:border-[#c5a059]/60 rounded-lg text-[#ded7c8] hover:text-[#e2c26a] text-xs font-serif font-semibold transition-all flex items-center gap-1.5 shadow-sm"
              title="Привал: короткий или продолжительный отдых"
            >
              <Flame className="w-3.5 h-3.5 text-[#d97706]" />
              <span>Привал</span>
            </button>
          )}

          {/* Invite Link Button */}
          <button
            onClick={handleCopyInvite}
            className="px-2.5 sm:px-3 py-1.5 bg-[#1c1813] hover:bg-[#2b2217] border border-[#4a3a24] hover:border-[#c5a059] rounded-lg text-[#e2c26a] hover:text-white text-xs font-serif font-semibold transition-all flex items-center gap-1.5 shadow-sm"
            title="Скопировать ссылку для приглашения друзей"
          >
            <span>Пригласить</span>
          </button>
        </div>
      </div>

      {/* Bottom Row: Story Setting & DM Utilities Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
        {/* Left: Setting description & Badges */}
        <div className="flex items-center gap-3 flex-wrap min-w-0 flex-1">
          {room.genre && (
            <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-[#162033] text-[#93c5fd] border border-[#233555] shrink-0">
              {GENRE_SHORT_LABELS[room.genre] || room.genre}
            </span>
          )}
          {room.campaignDuration && (
            <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-[#221833] text-[#c084fc] border border-[#3d265a] shrink-0">
              {DURATION_SHORT_LABELS[room.campaignDuration] || room.campaignDuration}
            </span>
          )}
          {room.setting && (
            <p className="text-[12px] text-[#968e7f] font-serif leading-relaxed line-clamp-1 max-w-2xl" title={room.setting}>
              {room.setting}
            </p>
          )}
        </div>

        {/* Right: Turn Mode & Host Master Commands */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Turn Mode Selector / Indicator */}
          {isHost && onToggleTurnMode ? (
            <button
              onClick={() => onToggleTurnMode(room.turnMode === 'turn_by_turn' ? 'simultaneous' : 'turn_by_turn')}
              className={`px-2.5 py-1 border rounded-lg text-xs font-serif font-medium transition-all flex items-center gap-1.5 shadow-sm ${
                room.turnMode === 'turn_by_turn'
                  ? 'bg-[#221833] border-[#4a2e72] text-[#d8b4fe] hover:bg-[#2c1d42]'
                  : 'bg-[#181c25] hover:bg-[#1f2430] border-[#2e3544] text-[#ded7c8] hover:text-[#e2c26a]'
              }`}
              title={`Режим ходов: ${room.turnMode === 'turn_by_turn' ? 'По очереди (нажмите для переключения на общий ход)' : 'Общий ход (нажмите для переключения на поочередный)'}`}
            >
              {room.turnMode === 'turn_by_turn' ? (
                <>
                  <ListOrdered className="w-3.5 h-3.5 text-[#c084fc]" />
                  <span>По очереди</span>
                </>
              ) : (
                <>
                  <Users className="w-3.5 h-3.5 text-[#c5a059]" />
                  <span>Общий ход</span>
                </>
              )}
            </button>
          ) : (
            <div
              className={`px-2.5 py-1 border rounded-lg text-xs font-serif font-medium flex items-center gap-1.5 ${
                room.turnMode === 'turn_by_turn'
                  ? 'bg-[#221833] border-[#4a2e72] text-[#d8b4fe]'
                  : 'bg-[#181c25] border-[#2e3544] text-[#ded7c8]'
              }`}
              title={`Режим ходов: ${room.turnMode === 'turn_by_turn' ? 'По очереди' : 'Общий ход'}`}
            >
              {room.turnMode === 'turn_by_turn' ? (
                <>
                  <ListOrdered className="w-3.5 h-3.5 text-[#c084fc]" />
                  <span>По очереди</span>
                </>
              ) : (
                <>
                  <Users className="w-3.5 h-3.5 text-[#c5a059]" />
                  <span>Общий ход</span>
                </>
              )}
            </div>
          )}

          {/* Quick launcher: Authentic D&D Guide */}
          {onOpenGuide && (
            <button
              onClick={onOpenGuide}
              className="px-2.5 py-1 bg-[#181c25] hover:bg-[#1f2430] border border-[#2e3544] hover:border-[#c5a059]/60 rounded-lg text-[#ded7c8] hover:text-[#e2c26a] text-xs font-serif font-medium transition-all flex items-center gap-1.5 shadow-sm"
              title="О D&D 5e: 3-шаговый цикл, характеристики, отсутствие рельсов"
            >
              <BookOpen className="w-3.5 h-3.5 text-[#c5a059]" />
              <span>О D&D</span>
            </button>
          )}

          {/* Host Finish Session / Adventure */}
          {isHost && onOpenFinishModal && (
            <button
              onClick={onOpenFinishModal}
              className="px-2.5 py-1 bg-[#23151f] hover:bg-[#331c2c] border border-[#522944] hover:border-[#7c3d66] rounded-lg text-[#f49db2] hover:text-white text-xs font-serif font-medium transition-all flex items-center gap-1.5 shadow-sm"
              title="Завершить сессию на клиффхэнгере или объявить победу в модуле"
            >
              <Flag className="w-3.5 h-3.5 text-[#f472b6]" />
              <span>Финал сессии</span>
            </button>
          )}

          {/* Host Force Turn Button */}
          {isHost && onForceResolve && (
            <button
              onClick={onForceResolve}
              disabled={isDMThinking}
              className="px-3 py-1 bg-[#2b2213] hover:bg-[#3d301a] text-[#e2c26a] hover:text-white border border-[#785e2b] hover:border-[#c5a059] rounded-lg text-xs font-bold font-rpg tracking-wider uppercase transition-all flex items-center gap-1.5 shadow-sm disabled:opacity-50"
              title="Завершить раунд и запустить ход Мастера"
            >
              <Zap className="w-3.5 h-3.5 text-[#e2c26a] fill-current" />
              <span>Ход Мастера</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
