import React from 'react';
import { RoomEnemy } from '../../types';
import { Skull, Shield, Heart, ShieldAlert, Crosshair, CheckCircle2 } from 'lucide-react';

interface OpponentsHUDProps {
  enemies?: RoomEnemy[];
  enemiesStatus?: string;
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

export const OpponentsHUD: React.FC<OpponentsHUDProps> = ({
  enemies = [],
  enemiesStatus,
}) => {
  const activeEnemies = enemies.filter(e => !e.isDead && e.hpCurrent > 0);
  const defeatedEnemies = enemies.filter(e => e.isDead || e.hpCurrent <= 0);

  return (
    <div className="bg-[#13161d] border border-[#2a303d] rounded-xl p-3 sm:p-3.5 shadow-md flex flex-col shrink-0 max-h-80 overflow-hidden font-serif">
      {/* Header */}
      <div className="flex items-center justify-between pb-2.5 mb-2.5 border-b border-[#242935]">
        <div className="flex items-center gap-2">
          <div className={`p-1.5 rounded border ${
            activeEnemies.length > 0
              ? 'bg-[#281316] border-[#6b252c] text-[#f87171]'
              : 'bg-[#181c25] border-[#2e3544] text-[#968e7f]'
          }`}>
            <Skull className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-xs font-bold font-rpg uppercase tracking-wider text-[#ded7c8]">
              Оппоненты
            </h3>
            <p className="text-[10px] text-[#968e7f]">
              {activeEnemies.length > 0 ? 'Угрозы на поле боя' : 'Зона безопасности'}
            </p>
          </div>
        </div>

        {activeEnemies.length > 0 ? (
          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-[#281316] text-[#fca5a5] border border-[#6b252c]">
            {activeEnemies.length} в бою
          </span>
        ) : (
          <span className="px-2 py-0.5 rounded text-[10px] font-serif text-[#86efac] bg-[#122319] border border-[#29563d] flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" /> Спокойно
          </span>
        )}
      </div>

      {/* Enemies List */}
      <div className="flex-1 overflow-y-auto space-y-2.5 pr-1 custom-scrollbar">
        {enemies.length === 0 ? (
          <div className="flex items-center gap-2.5 p-2.5 rounded-lg bg-[#0c0d11] border border-[#222733] text-[#968e7f] text-xs">
            <span className="text-base">🕊️</span>
            <div className="leading-snug">
              <span className="text-[#86efac] font-semibold">Угрозы не обнаружены</span>
              <p className="text-[11px] text-[#786e60]">В текущей сцене спокойно, отряд может свободно исследовать мир.</p>
            </div>
          </div>
        ) : (
          <>
            {/* Active Enemies */}
            {activeEnemies.map((enemy) => {
              const hpPercent = Math.max(0, Math.min(100, Math.round((enemy.hpCurrent / enemy.hpMax) * 100)));
              const isCriticallyWounded = hpPercent <= 25;
              const isWounded = hpPercent <= 60;

              return (
                <div
                  key={enemy.id}
                  className="bg-[#141720] border border-[#252a36] hover:border-[#4a262a] rounded-lg p-3 transition-all relative overflow-hidden group shadow-sm"
                >
                  {/* Top Bar: Name, Type Badge & AC */}
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-xs text-[#ded7c8] truncate group-hover:text-[#fca5a5] transition-colors">
                          {enemy.name}
                        </span>
                        {enemy.type && (
                          <span className={`px-1.5 py-0.2 rounded text-[9px] uppercase font-bold font-serif tracking-wider ${
                            enemy.type === 'boss'
                              ? 'bg-[#281316] text-[#fca5a5] border border-[#6b252c]'
                              : enemy.type === 'elite'
                              ? 'bg-[#1e1528] text-[#d8b4fe] border border-[#442c5c]'
                              : 'bg-[#0c0d11] text-[#968e7f] border border-[#252a36]'
                          }`}>
                            {enemy.type === 'boss' ? 'Босс' : enemy.type === 'elite' ? 'Элита' : enemy.type}
                          </span>
                        )}
                      </div>
                    </div>

                    {enemy.ac && (
                      <span className="shrink-0 flex items-center gap-1 text-[11px] font-mono px-1.5 py-0.5 bg-[#0c0d11] border border-[#222733] rounded text-[#93c5fd]" title={`Класс брони: ${enemy.ac} КБ`}>
                        <Shield className="w-3 h-3 text-[#60a5fa]" />
                        <span>{enemy.ac}</span>
                      </span>
                    )}
                  </div>

                  {/* HP Bar */}
                  <div className="mb-2">
                    <div className="flex items-center justify-between text-[10px] font-mono mb-1">
                      <span className="text-[#968e7f] flex items-center gap-1">
                        <Heart className={`w-3 h-3 ${isCriticallyWounded ? 'text-[#f87171] animate-pulse' : 'text-[#fca5a5]'}`} />
                        <span>Здоровье</span>
                      </span>
                      <span className={`font-bold ${isCriticallyWounded ? 'text-[#f87171]' : 'text-[#ded7c8]'}`}>
                        {enemy.hpCurrent} / {enemy.hpMax}
                      </span>
                    </div>

                    <div className="w-full h-1.5 bg-[#0c0d11] rounded overflow-hidden border border-[#222733]">
                      <div
                        className={`h-full transition-all duration-500 rounded ${
                          isCriticallyWounded
                            ? 'bg-[#8b262a]'
                            : isWounded
                            ? 'bg-[#785e2b]'
                            : 'bg-[#29563d]'
                        }`}
                        style={{ width: `${hpPercent}%` }}
                      />
                    </div>
                  </div>

                  {/* Conditions List */}
                  {enemy.conditions && enemy.conditions.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-2">
                      {enemy.conditions.map(cond => {
                        const badge = CONDITION_BADGES[cond] || {
                          label: cond,
                          color: 'bg-[#181c25] text-[#ded7c8] border-[#2e3544]',
                          desc: cond,
                        };
                        return (
                          <span
                            key={cond}
                            className={`px-1.5 py-0.2 rounded text-[9px] font-bold border ${badge.color}`}
                            title={badge.desc}
                          >
                            {badge.label}
                          </span>
                        );
                      })}
                    </div>
                  )}

                  {/* Status / Tactical Behavior */}
                  {enemy.status && (
                    <div className="flex items-start gap-1.5 text-[11px] text-[#ded7c8]/90 bg-[#0c0d11] p-1.5 rounded border border-[#222733]">
                      <Crosshair className="w-3 h-3 text-[#f87171] mt-0.5 shrink-0" />
                      <span className="italic leading-snug">{enemy.status}</span>
                    </div>
                  )}
                </div>
              );
            })}

            {/* Defeated Enemies Collapsible or compact list */}
            {defeatedEnemies.length > 0 && (
              <div className="pt-2 border-t border-[#242935]">
                <p className="text-[10px] font-mono uppercase text-[#736c5f] mb-1.5 px-1">
                  Повержены ({defeatedEnemies.length}):
                </p>
                <div className="space-y-1.5">
                  {defeatedEnemies.map((enemy) => (
                    <div
                      key={enemy.id}
                      className="bg-[#0c0d11] border border-[#1e232d] rounded p-2 flex items-center justify-between text-xs opacity-50"
                    >
                      <div className="flex items-center gap-1.5">
                        <Skull className="w-3 h-3 text-[#736c5f]" />
                        <span className="line-through text-[#968e7f] text-[11px]">
                          {enemy.name}
                        </span>
                      </div>
                      <span className="text-[10px] font-mono text-[#736c5f] italic">
                        {enemy.status || 'Пал в бою'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Master Tactical Note if provided */}
      {enemiesStatus && activeEnemies.length > 0 && (
        <div className="mt-2.5 pt-2 border-t border-[#242935] text-[11px] text-[#968e7f] flex items-start gap-1.5 bg-[#0c0d11] p-2 rounded">
          <ShieldAlert className="w-3.5 h-3.5 text-[#c5a059] shrink-0 mt-0.5" />
          <span className="italic line-clamp-2 leading-tight">
            {enemiesStatus}
          </span>
        </div>
      )}
    </div>
  );
};
