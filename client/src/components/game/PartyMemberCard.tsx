import React from 'react';
import { RoomPlayer } from '../../types';
import { Heart, CheckCircle2, Clock, Eye } from 'lucide-react';

interface PartyMemberCardProps {
  player: RoomPlayer;
  isCurrentUser: boolean;
  isActiveTurn?: boolean;
  onInspect?: () => void;
}

const CONDITION_BADGES: Record<string, { label: string; color: string; desc: string }> = {
  prone: { label: 'Ничком', color: 'bg-amber-900/60 text-amber-300 border-amber-600/50', desc: 'Сбит с ног: атаки ближнего боя по цели с преимуществом' },
  poisoned: { label: 'Отравлен', color: 'bg-emerald-950/70 text-emerald-300 border-emerald-600/50', desc: 'Отравлен: помеха на броски атаки и проверки' },
  restrained: { label: 'Обездвижен', color: 'bg-blue-950/70 text-blue-300 border-blue-600/50', desc: 'Обездвижен: скорость 0, атаки противника с преимуществом' },
  frightened: { label: 'Испуган', color: 'bg-purple-950/70 text-purple-300 border-purple-600/50', desc: 'Испуган: помеха на проверки пока источник страха в поле зрения' },
  stunned: { label: 'Оглушён', color: 'bg-red-950/70 text-red-300 border-red-600/50', desc: 'Оглушён: не может действовать, проваливает спасброски СИЛ/ЛОВ' },
  cover_half: { label: 'Укрытие 1/2', color: 'bg-indigo-950/70 text-indigo-300 border-indigo-600/50', desc: 'Половинное укрытие (+2 к КБ и спасброскам ЛОВ)' },
  cover_three_quarters: { label: 'Укрытие 3/4', color: 'bg-indigo-950/80 text-cyan-300 border-cyan-600/50', desc: 'Укрытие на три четверти (+5 к КБ и спасброскам ЛОВ)' },
};

export const PartyMemberCard: React.FC<PartyMemberCardProps> = ({
  player,
  isCurrentUser,
  isActiveTurn,
  onInspect,
}) => {
  const char = player.character;
  if (!char) return null;

  const hpPercent = Math.max(0, Math.min(100, Math.round((char.hpCurrent / char.hpMax) * 100)));

  const isDead = char.lifeState === 'dead';
  const isDowned = char.lifeState === 'downed';

  return (
    <div
      className={`p-3 rounded-xl border transition-all relative ${
        isDead
          ? 'bg-red-950/40 border-red-500/60 opacity-80'
          : isDowned
          ? 'bg-rose-950/30 border-rose-500/70 shadow-lg animate-pulse'
          : isActiveTurn
          ? 'bg-amber-500/15 border-amber-400 shadow-glow-gold ring-1 ring-amber-400/50'
          : isCurrentUser
          ? 'bg-amber-500/10 border-amber-500/40 shadow-glow-gold'
          : 'bg-fantasy-card/70 border-fantasy-border/60 hover:border-slate-500'
      }`}
    >
      {/* Active turn indicator banner */}
      {isActiveTurn && !isDead && (
        <div className="absolute -top-2 right-3 z-10 bg-amber-500 text-black text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full shadow-md animate-bounce">
          Ходит сейчас
        </div>
      )}

      {/* Character Identity */}
      <div className="flex items-center justify-between gap-2 mb-2">
        <div
          onClick={onInspect}
          className="flex items-center gap-2.5 min-w-0 cursor-pointer group/char flex-1"
          title="Нажмите, чтобы просмотреть полное досье персонажа"
        >
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-amber-600 to-amber-900 border border-amber-500/50 flex items-center justify-center font-bold text-amber-200 text-sm overflow-hidden flex-shrink-0 group-hover/char:scale-105 transition-transform">
            {char.avatarUrl ? (
              <img src={char.avatarUrl} alt={char.name} className="w-full h-full object-cover" />
            ) : (
              char.name[0]?.toUpperCase()
            )}
          </div>
          <div className="min-w-0 flex-1">
            <h4 className="font-bold text-slate-100 text-xs truncate flex items-center gap-1 group-hover/char:text-amber-300 transition-colors">
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

        {/* Turn / Life Status & Inspect Button */}
        <div className="flex items-center gap-1">
          {onInspect && (
            <button
              type="button"
              onClick={onInspect}
              className="p-1 rounded-lg bg-slate-800/80 hover:bg-amber-500/20 text-slate-400 hover:text-amber-300 border border-slate-700 hover:border-amber-500/40 transition-colors"
              title="Открыть досье персонажа"
            >
              <Eye className="w-3.5 h-3.5" />
            </button>
          )}

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
              title={isActiveTurn ? "Совершает ход..." : "Ожидает очереди"}
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

      {/* Conditions list */}
      {char.conditions && char.conditions.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {char.conditions.map(cond => {
            const badge = CONDITION_BADGES[cond] || {
              label: cond,
              color: 'bg-slate-800 text-slate-300 border-slate-700',
              desc: cond,
            };
            return (
              <span
                key={cond}
                className={`px-1.5 py-0.5 rounded text-[9px] font-bold border ${badge.color}`}
                title={badge.desc}
              >
                {badge.label}
              </span>
            );
          })}
        </div>
      )}

      {/* Stats, Hit Dice & Spell Slots snippet */}
      <div
        onClick={onInspect}
        className="grid grid-cols-4 gap-1 text-center bg-fantasy-card p-1 rounded-lg text-[10px] text-slate-400 cursor-pointer hover:bg-slate-800/80 transition-colors"
        title="Нажмите для подробного листа персонажа"
      >
        <div>
          КБ: <strong className="text-blue-400">{char.ac}</strong>
        </div>
        <div>
          СИЛ: <strong className="text-amber-400">{char.stats.str}</strong>
        </div>
        <div>
          ЛОВ: <strong className="text-amber-400">{char.stats.dex}</strong>
        </div>
        <div title="Кости хитов для короткого отдыха">
          КХ: <strong className="text-emerald-400">{char.hitDiceCurrent ?? (char.level || 1)}/{char.hitDiceMax ?? (char.level || 1)}</strong>
        </div>
      </div>

      {/* Spell slots counter if character is a spellcaster */}
      {char.spellSlots && Object.keys(char.spellSlots).length > 0 && (
        <div className="mt-1.5 flex items-center gap-1 text-[9px] font-mono text-purple-300/90 px-1 overflow-x-auto">
          <span className="text-purple-400 font-bold shrink-0">Ячейки:</span>
          {Object.entries(char.spellSlots).map(([lvl, s]) => (
            <span
              key={lvl}
              className={`px-1 py-0.2 rounded border ${
                s.current > 0
                  ? 'bg-purple-950/60 border-purple-700/50 text-purple-300'
                  : 'bg-slate-900 border-slate-800 text-slate-500'
              }`}
              title={`Ячейки ${lvl} круга: ${s.current} из ${s.max}`}
            >
              {lvl}к: {s.current}/{s.max}
            </span>
          ))}
        </div>
      )}
    </div>
  );
};
