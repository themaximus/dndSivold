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
      className={`p-3 rounded-lg border font-serif transition-all relative ${
        isDead
          ? 'bg-[#241316] border-[#6b252c] opacity-80'
          : isDowned
          ? 'bg-[#281316] border-[#8b262a] shadow-md animate-pulse'
          : isActiveTurn
          ? 'bg-[#201d16] border-[#c5a059] shadow-sm'
          : isCurrentUser
          ? 'bg-[#181c26] border-[#4a3e26]'
          : 'bg-[#141720] border-[#252a36] hover:border-[#3d3424]'
      }`}
    >
      {/* Active turn indicator banner */}
      {isActiveTurn && !isDead && (
        <div className="absolute -top-2 right-3 z-10 bg-[#c5a059] text-black text-[9px] font-bold font-rpg uppercase tracking-wider px-2 py-0.5 rounded shadow-sm">
          Ходит сейчас
        </div>
      )}

      {/* Character Identity */}
      <div className="flex items-center justify-between gap-2.5 mb-2.5">
        <div
          onClick={onInspect}
          className="flex items-center gap-3 min-w-0 cursor-pointer group/char flex-1"
          title="Нажмите, чтобы открыть полное досье героя"
        >
          <div className="w-12 h-12 rounded-lg bg-[#1c1813] border-2 border-[#facc15] shadow-md flex items-center justify-center font-bold text-[#facc15] text-lg overflow-hidden flex-shrink-0 group-hover/char:scale-105 transition-transform">
            {char.avatarUrl ? (
              <img src={char.avatarUrl} alt={char.name} className="w-full h-full object-cover" />
            ) : (
              char.name[0]?.toUpperCase()
            )}
          </div>
          <div className="min-w-0 flex-1">
            <h4 className="font-extrabold font-rpg text-[#fef08a] text-sm sm:text-base truncate flex items-center gap-1.5 group-hover/char:text-[#fde047] transition-colors">
              <span>{char.name}</span>
              {isCurrentUser && (
                <span className="text-[10px] text-[#facc15] font-bold px-1.5 py-0.2 rounded bg-[#2b2213] border border-[#785e2b]">(Вы)</span>
              )}
            </h4>
            <p className="text-xs text-[#c5a059] font-medium truncate">
              {char.race} {char.characterClass} • {char.level} ур.
            </p>
          </div>
        </div>

        {/* Turn / Life Status & Inspect Button */}
        <div className="flex items-center gap-1.5 shrink-0">
          {onInspect && (
            <button
              type="button"
              onClick={onInspect}
              className="p-1.5 rounded-lg bg-[#141824] hover:bg-[#1e2538] text-[#c5a059] hover:text-[#facc15] border border-[#3b3425] hover:border-[#facc15] transition-colors shadow-sm"
              title="Открыть досье персонажа"
            >
              <Eye className="w-4 h-4" />
            </button>
          )}

          {isDead ? (
            <span className="px-2 py-0.5 rounded text-xs font-bold bg-[#281316] text-[#fca5a5] border border-[#6b252c]">
              ☠ Погиб
            </span>
          ) : isDowned ? (
            <span className="px-2 py-0.5 rounded text-xs font-bold bg-[#281316] text-[#fca5a5] border border-[#8b262a] animate-pulse">
              ⚠️ 0 HP
            </span>
          ) : player.hasActedThisRound ? (
            <span
              className="px-2 py-0.5 rounded bg-[#122319] text-[#86efac] border border-[#29563d] flex items-center gap-1 text-xs font-bold font-serif"
              title="Действие заявлено"
            >
              <CheckCircle2 className="w-3.5 h-3.5" /> Ход сделан
            </span>
          ) : (
            <span
              className="px-2 py-0.5 rounded bg-[#1f1a12] text-[#fde047] border border-[#785e2b] flex items-center gap-1 text-xs font-bold font-serif"
              title={isActiveTurn ? "Совершает ход..." : "Ожидает очереди"}
            >
              <Clock className="w-3.5 h-3.5 animate-spin text-[#facc15]" /> Ожидание
            </span>
          )}
        </div>
      </div>

      {/* HP Bar & Death Saves - Video Game RPG Health Gauge */}
      <div className="mb-2.5 bg-[#090b10] p-2 rounded-lg border border-[#252a36]">
        <div className="flex items-center justify-between text-xs font-bold mb-1 font-mono">
          <span className="text-[#e2c26a] flex items-center gap-1">
            <span className="text-sm">❤️</span> HP:
          </span>
          <span className={isDead ? 'text-[#f87171]' : isDowned ? 'text-[#f87171] animate-pulse' : char.hpCurrent <= 4 ? 'text-[#f87171]' : 'text-[#86efac]'}>
            {isDead ? '0 / ' + char.hpMax + ' (МЕРТВ)' : isDowned ? '0 / ' + char.hpMax + ' (ПРИ СМЕРТИ)' : `${char.hpCurrent} / ${char.hpMax}`}
          </span>
        </div>
        <div className="w-full bg-[#181113] h-2.5 rounded-full overflow-hidden border border-[#3b1c20] shadow-inner">
          <div
            className={`h-full transition-all duration-500 rounded-full shadow-md ${
              isDead ? 'bg-[#5c1c20]' : isDowned ? 'bg-[#8b262a]' : hpPercent > 50 ? 'bg-gradient-to-r from-[#10b981] to-[#059669]' : hpPercent > 25 ? 'bg-gradient-to-r from-[#f59e0b] to-[#d97706]' : 'bg-gradient-to-r from-[#ef4444] to-[#b91c1c]'
            }`}
            style={{ width: `${hpPercent}%` }}
          />
        </div>

        {isDowned && char.deathSaves && (
          <div className="mt-1.5 flex items-center justify-between text-xs font-mono font-bold px-1">
            <span className="text-[#86efac]">✓ Успехи: {char.deathSaves.successes}/3</span>
            <span className="text-[#fca5a5]">✗ Провалы: {char.deathSaves.failures}/3</span>
          </div>
        )}
      </div>

      {/* Conditions list */}
      {char.conditions && char.conditions.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {char.conditions.map(cond => {
            const badge = CONDITION_BADGES[cond] || {
              label: cond,
              color: 'bg-[#181c25] text-[#ded7c8] border-[#2e3544]',
              desc: cond,
            };
            return (
              <span
                key={cond}
                className={`px-2 py-0.5 rounded text-[10px] font-bold border ${badge.color}`}
                title={badge.desc}
              >
                {badge.label}
              </span>
            );
          })}
        </div>
      )}

      {/* Stats, Hit Dice & Spell Slots snippet - Crisp Video Game RPG Badges */}
      <div
        onClick={onInspect}
        className="grid grid-cols-4 gap-1.5 text-center cursor-pointer font-serif"
        title="Нажмите для подробного листа персонажа"
      >
        <div className="bg-[#101826] border border-[#25426b] p-1.5 rounded-lg text-xs">
          <span className="text-[10px] text-[#93c5fd] font-bold block">🛡️ КБ</span>
          <strong className="text-sm font-mono text-[#bfdbfe]">{char.ac}</strong>
        </div>
        <div className="bg-[#241c10] border border-[#6b4e1e] p-1.5 rounded-lg text-xs">
          <span className="text-[10px] text-[#fde047] font-bold block">💪 СИЛ</span>
          <strong className="text-sm font-mono text-[#fef08a]">{char.stats.str}</strong>
        </div>
        <div className="bg-[#122319] border border-[#225737] p-1.5 rounded-lg text-xs">
          <span className="text-[10px] text-[#86efac] font-bold block">🎯 ЛОВ</span>
          <strong className="text-sm font-mono text-[#bbf7d0]">{char.stats.dex}</strong>
        </div>
        <div className="bg-[#1a1426] border border-[#482c6b] p-1.5 rounded-lg text-xs" title="Кости хитов для короткого отдыха">
          <span className="text-[10px] text-[#d8b4fe] font-bold block">🎲 КХ</span>
          <strong className="text-sm font-mono text-[#e9d5ff]">{char.hitDiceCurrent ?? (char.level || 1)}/{char.hitDiceMax ?? (char.level || 1)}</strong>
        </div>
      </div>

      {/* Spell slots counter if character is a spellcaster */}
      {char.spellSlots && Object.keys(char.spellSlots).length > 0 && (
        <div className="mt-1.5 flex items-center gap-1 text-[9px] font-mono text-[#d8b4fe] px-1 overflow-x-auto">
          <span className="text-[#c084fc] font-bold shrink-0">Ячейки:</span>
          {Object.entries(char.spellSlots).map(([lvl, s]) => (
            <span
              key={lvl}
              className={`px-1 py-0.2 rounded border ${
                s.current > 0
                  ? 'bg-[#1a1728] border-[#44376b] text-[#d8b4fe]'
                  : 'bg-[#0c0d11] border-[#222733] text-[#6e675b]'
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
