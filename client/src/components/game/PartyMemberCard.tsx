import React from 'react';
import { RoomPlayer } from '../../types';
import { Shield, Heart, CheckCircle2, Clock } from 'lucide-react';

interface PartyMemberCardProps {
  player: RoomPlayer;
  isCurrentUser: boolean;
}

export const PartyMemberCard: React.FC<PartyMemberCardProps> = ({
  player,
  isCurrentUser,
}) => {
  const char = player.character;
  if (!char) return null;

  const hpPercent = Math.max(0, Math.min(100, Math.round((char.hpCurrent / char.hpMax) * 100)));

  const isDead = char.lifeState === 'dead';
  const isDowned = char.lifeState === 'downed';

  return (
    <div
      className={`p-3 rounded-xl border transition-all ${
        isDead
          ? 'bg-red-950/40 border-red-500/60 opacity-80'
          : isDowned
          ? 'bg-rose-950/30 border-rose-500/70 shadow-lg animate-pulse'
          : isCurrentUser
          ? 'bg-amber-500/10 border-amber-500/40 shadow-glow-gold'
          : 'bg-fantasy-card/70 border-fantasy-border/60'
      }`}
    >
      {/* Character Identity */}
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-amber-600 to-amber-900 border border-amber-500/50 flex items-center justify-center font-bold text-amber-200 text-sm overflow-hidden flex-shrink-0">
            {char.avatarUrl ? (
              <img src={char.avatarUrl} alt={char.name} className="w-full h-full object-cover" />
            ) : (
              char.name[0]?.toUpperCase()
            )}
          </div>
          <div className="min-w-0">
            <h4 className="font-bold text-slate-100 text-xs truncate flex items-center gap-1">
              {char.name}
              {isCurrentUser && (
                <span className="text-[10px] text-amber-400 font-normal">(Вы)</span>
              )}
            </h4>
            <p className="text-[10px] text-slate-400 truncate">
              {char.race} {char.characterClass}, {char.level} ур.
            </p>
          </div>
        </div>

        {/* Turn / Life Status Icon */}
        <div>
          {isDead ? (
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-red-600/30 text-red-300 border border-red-500/50">
              ☠ Погиб
            </span>
          ) : isDowned ? (
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-600/30 text-rose-300 border border-rose-500/50">
              При смерти
            </span>
          ) : player.hasActedThisRound ? (
            <span
              className="p-1 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center"
              title="Действие заявлено"
            >
              <CheckCircle2 className="w-4 h-4" />
            </span>
          ) : (
            <span
              className="p-1 rounded-lg bg-slate-800 text-slate-500 flex items-center"
              title="Выбирает действие"
            >
              <Clock className="w-4 h-4 animate-spin" />
            </span>
          )}
        </div>
      </div>

      {/* HP Bar & Death Saves */}
      <div className="mb-2">
        <div className="flex items-center justify-between text-[11px] font-semibold mb-1">
          <span className="text-slate-400 flex items-center gap-1">
            <Heart className={`w-3 h-3 ${isDead || isDowned ? 'text-rose-500' : 'text-red-500'}`} /> HP:
          </span>
          <span className={isDead ? 'text-red-500 font-bold' : isDowned ? 'text-rose-400 font-bold animate-pulse' : char.hpCurrent <= 4 ? 'text-red-400 font-bold animate-pulse' : 'text-slate-200'}>
            {isDead ? '0 / ' + char.hpMax + ' (МЕРТВ)' : isDowned ? '0 / ' + char.hpMax + ' (0 HP)' : `${char.hpCurrent} / ${char.hpMax}`}
          </span>
        </div>
        <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
          <div
            className={`h-full transition-all duration-500 ${
              isDead ? 'bg-red-800' : isDowned ? 'bg-rose-600' : hpPercent > 50 ? 'bg-emerald-500' : hpPercent > 25 ? 'bg-amber-500' : 'bg-red-500'
            }`}
            style={{ width: `${hpPercent}%` }}
          />
        </div>

        {isDowned && char.deathSaves && (
          <div className="mt-1.5 flex items-center justify-between text-[10px] font-mono px-1">
            <span className="text-emerald-400">Успехи: {char.deathSaves.successes}/3</span>
            <span className="text-rose-400">Провалы: {char.deathSaves.failures}/3</span>
          </div>
        )}
      </div>

      {/* Stats snippet */}
      <div className="grid grid-cols-4 gap-1 text-center bg-fantasy-card p-1 rounded-lg text-[10px] text-slate-400">
        <div>
          КБ: <strong className="text-blue-400">{char.ac}</strong>
        </div>
        <div>
          СИЛ: <strong className="text-amber-400">{char.stats.str}</strong>
        </div>
        <div>
          ЛОВ: <strong className="text-amber-400">{char.stats.dex}</strong>
        </div>
        <div>
          ИНТ: <strong className="text-amber-400">{char.stats.int}</strong>
        </div>
      </div>
    </div>
  );
};
