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
    <div className="bg-fantasy-panel border border-fantasy-border rounded-2xl p-4 shadow-xl flex flex-col min-h-0 h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 mb-3 border-b border-fantasy-border/80">
        <div className="flex items-center gap-2">
          <div className={`p-1.5 rounded-lg border ${
            activeEnemies.length > 0
              ? 'bg-red-950/50 border-red-500/50 text-red-400 animate-pulse'
              : 'bg-slate-800/80 border-slate-700 text-slate-400'
          }`}>
            <Skull className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-xs font-extrabold font-rpg uppercase tracking-wider text-slate-200">
              Оппоненты
            </h3>
            <p className="text-[10px] text-slate-400">
              {activeEnemies.length > 0 ? 'Угрозы на поле боя' : 'Зона безопасности'}
            </p>
          </div>
        </div>

        {activeEnemies.length > 0 ? (
          <span className="px-2 py-0.5 rounded-full text-[11px] font-mono font-bold bg-red-950/60 text-red-300 border border-red-500/50">
            {activeEnemies.length} в бою
          </span>
        ) : (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-mono text-emerald-400 bg-emerald-950/40 border border-emerald-800/40 flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" /> Спокойно
          </span>
        )}
      </div>

      {/* Enemies List */}
      <div className="flex-1 overflow-y-auto space-y-2.5 pr-1 custom-scrollbar">
        {enemies.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-4 text-slate-400">
            <div className="p-3 rounded-2xl bg-fantasy-card/60 border border-fantasy-border mb-2.5 text-slate-500">
              <Shield className="w-6 h-6 stroke-[1.5]" />
            </div>
            <p className="text-xs font-bold text-slate-300 mb-1">
              Угрозы не обнаружены
            </p>
            <p className="text-[11px] text-slate-500 leading-relaxed max-w-[200px]">
              В текущей сцене нет активных врагов. Отряд может исследовать окружение или вести диалог.
            </p>
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
                  className="bg-fantasy-card border border-fantasy-border hover:border-red-500/50 rounded-xl p-3 transition-all relative overflow-hidden group shadow-sm"
                >
                  {/* Top Bar: Name, Type Badge & AC */}
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-xs text-slate-200 truncate group-hover:text-red-300 transition-colors">
                          {enemy.name}
                        </span>
                        {enemy.type && (
                          <span className={`px-1.5 py-0.2 rounded text-[9px] uppercase font-bold tracking-wider ${
                            enemy.type === 'boss'
                              ? 'bg-red-950/80 text-red-300 border border-red-500/60'
                              : enemy.type === 'elite'
                              ? 'bg-purple-950/80 text-purple-300 border border-purple-500/60'
                              : 'bg-slate-800 text-slate-400 border border-slate-700'
                          }`}>
                            {enemy.type === 'boss' ? 'Босс' : enemy.type === 'elite' ? 'Элита' : enemy.type}
                          </span>
                        )}
                      </div>
                    </div>

                    {enemy.ac && (
                      <span className="shrink-0 flex items-center gap-1 text-[11px] font-mono px-1.5 py-0.5 bg-slate-800/80 border border-slate-700/80 rounded-md text-blue-300" title={`Класс брони: ${enemy.ac} КБ`}>
                        <Shield className="w-3 h-3 text-blue-400" />
                        <span>{enemy.ac}</span>
                      </span>
                    )}
                  </div>

                  {/* HP Bar */}
                  <div className="mb-2">
                    <div className="flex items-center justify-between text-[10px] font-mono mb-1">
                      <span className="text-slate-400 flex items-center gap-1">
                        <Heart className={`w-3 h-3 ${isCriticallyWounded ? 'text-red-500 animate-pulse' : 'text-red-400'}`} />
                        <span>Здоровье</span>
                      </span>
                      <span className={`font-bold ${isCriticallyWounded ? 'text-red-400' : 'text-slate-300'}`}>
                        {enemy.hpCurrent} / {enemy.hpMax}
                      </span>
                    </div>

                    <div className="w-full h-1.5 bg-slate-800/80 rounded-full overflow-hidden border border-slate-700/50">
                      <div
                        className={`h-full transition-all duration-500 rounded-full ${
                          isCriticallyWounded
                            ? 'bg-gradient-to-r from-red-600 to-rose-500'
                            : isWounded
                            ? 'bg-gradient-to-r from-amber-600 to-amber-400'
                            : 'bg-gradient-to-r from-emerald-600 to-emerald-400'
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
                          color: 'bg-slate-800 text-slate-300 border-slate-700',
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
                    <div className="flex items-start gap-1.5 text-[11px] text-slate-300 bg-slate-900/50 p-1.5 rounded-lg border border-slate-800">
                      <Crosshair className="w-3 h-3 text-red-400/80 mt-0.5 shrink-0" />
                      <span className="italic leading-snug">{enemy.status}</span>
                    </div>
                  )}
                </div>
              );
            })}

            {/* Defeated Enemies Collapsible or compact list */}
            {defeatedEnemies.length > 0 && (
              <div className="pt-2 border-t border-slate-800/80">
                <p className="text-[10px] font-mono uppercase text-slate-500 mb-1.5 px-1">
                  Повержены ({defeatedEnemies.length}):
                </p>
                <div className="space-y-1.5">
                  {defeatedEnemies.map((enemy) => (
                    <div
                      key={enemy.id}
                      className="bg-slate-900/40 border border-slate-800/60 rounded-lg p-2 flex items-center justify-between text-xs opacity-50"
                    >
                      <div className="flex items-center gap-1.5">
                        <Skull className="w-3 h-3 text-slate-500" />
                        <span className="line-through text-slate-400 text-[11px]">
                          {enemy.name}
                        </span>
                      </div>
                      <span className="text-[10px] font-mono text-slate-500 italic">
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
        <div className="mt-3 pt-2.5 border-t border-fantasy-border/60 text-[11px] text-slate-400 flex items-start gap-1.5 bg-fantasy-card/40 p-2 rounded-xl">
          <ShieldAlert className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
          <span className="italic line-clamp-2 leading-tight">
            {enemiesStatus}
          </span>
        </div>
      )}
    </div>
  );
};
