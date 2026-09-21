import React, { useState, useEffect } from 'react';
import { RoomEnemy, RoomNPC, NPCDisposition, NPCCombatRole } from '../../types';
import {
  Skull,
  Shield,
  Heart,
  ShieldAlert,
  Crosshair,
  CheckCircle2,
  Users,
  Swords,
  Eye,
  Package,
  Sparkles,
  Smile,
  Frown,
  AlertTriangle,
} from 'lucide-react';

interface OpponentsHUDProps {
  enemies?: RoomEnemy[];
  enemiesStatus?: string;
  sceneNPCs?: RoomNPC[];
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

const DISPOSITION_CONFIG: Record<NPCDisposition, { label: string; color: string; icon: React.ReactNode }> = {
  friendly: {
    label: 'Дружелюбен',
    color: 'bg-emerald-950/70 text-emerald-300 border-emerald-500/50',
    icon: <Smile className="w-3 h-3 text-emerald-400" />,
  },
  neutral: {
    label: 'Нейтрален',
    color: 'bg-slate-800/80 text-slate-300 border-slate-700',
    icon: <Eye className="w-3 h-3 text-slate-400" />,
  },
  cautious: {
    label: 'Осторожен',
    color: 'bg-amber-950/70 text-amber-300 border-amber-600/50',
    icon: <AlertTriangle className="w-3 h-3 text-amber-400" />,
  },
  offended: {
    label: 'Обижен',
    color: 'bg-orange-950/70 text-orange-300 border-orange-600/50',
    icon: <Frown className="w-3 h-3 text-orange-400" />,
  },
  frightened: {
    label: 'Напуган',
    color: 'bg-purple-950/70 text-purple-300 border-purple-600/50',
    icon: <AlertTriangle className="w-3 h-3 text-purple-400" />,
  },
  hostile: {
    label: 'Враждебен',
    color: 'bg-red-950/80 text-red-300 border-red-600/50',
    icon: <Skull className="w-3 h-3 text-red-400" />,
  },
};

const COMBAT_ROLE_CONFIG: Record<NPCCombatRole, { label: string; color: string; icon: React.ReactNode; isCombatAlly?: boolean }> = {
  ally_combatant: {
    label: 'В бою за отряд',
    color: 'bg-emerald-950/80 text-emerald-300 border-emerald-500 font-bold animate-pulse',
    icon: <Swords className="w-3 h-3 text-emerald-400" />,
    isCombatAlly: true,
  },
  neutral_observer: {
    label: 'Наблюдает',
    color: 'bg-slate-800/80 text-slate-400 border-slate-700',
    icon: <Eye className="w-3 h-3 text-slate-400" />,
  },
  hiding: {
    label: 'Прячется в укрытии',
    color: 'bg-amber-950/60 text-amber-300 border-amber-600/40',
    icon: <Package className="w-3 h-3 text-amber-400" />,
  },
  fled: {
    label: 'В бегстве',
    color: 'bg-zinc-850 text-zinc-400 border-zinc-700',
    icon: <AlertTriangle className="w-3 h-3 text-zinc-400" />,
  },
};

const isEntityDepartedOrDefeated = (e: { isDead?: boolean; hpCurrent?: number; status?: string; combatRole?: string }) => {
  if (e.isDead || (e.hpCurrent !== undefined && e.hpCurrent <= 0)) return true;
  if (e.combatRole === 'fled') return true;
  const s = (e.status || '').toLowerCase();
  return /(повержен|без сознания|не подает признаков|мертв|убит|погиб|покинул|ушел|уехал|скрылся|убежал|сбежал|исчез|отступил|в бегстве|в панике бежит|забился под)/i.test(s);
};

const isSameEntityName = (name1?: string, name2?: string): boolean => {
  if (!name1 || !name2) return false;
  const clean = (s: string) => s.toLowerCase().trim().replace(/^(купец|торговец|послушник|стражник|страж|вожак|главарь|адепт|культист|караванщик|бандит)\s+/i, '');
  const n1 = clean(name1);
  const n2 = clean(name2);
  if (n1 === n2) return true;
  if (n1.length >= 4 && n2.length >= 4 && (n1.includes(n2) || n2.includes(n1))) return true;
  const o1 = name1.toLowerCase().trim();
  const o2 = name2.toLowerCase().trim();
  return o1 === o2 || (o1.length >= 4 && o2.length >= 4 && (o1.includes(o2) || o2.includes(o1)));
};

export const OpponentsHUD: React.FC<OpponentsHUDProps> = ({
  enemies = [],
  enemiesStatus,
  sceneNPCs = [],
}) => {
  const activeEnemies = enemies.filter(e => !isEntityDepartedOrDefeated(e));
  const defeatedEnemies = enemies.filter(e => isEntityDepartedOrDefeated(e));

  // Exclude NPCs who are already present as active enemies in combat (prevents clone / dual existence)
  const livingNPCs = sceneNPCs.filter(n =>
    !isEntityDepartedOrDefeated(n) &&
    !activeEnemies.some(e => isSameEntityName(e.name, n.name))
  );
  const fallenNPCs = sceneNPCs.filter(n =>
    isEntityDepartedOrDefeated(n) &&
    !defeatedEnemies.some(e => isSameEntityName(e.name, n.name))
  );
  const allyCombatants = livingNPCs.filter(n => n.combatRole === 'ally_combatant');

  // Read initial tab from URL ?hud=threats|npcs|all if provided
  const [activeTab, setActiveTab] = useState<'threats' | 'npcs' | 'all'>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const hud = params.get('hud');
      if (hud === 'threats' || hud === 'npcs' || hud === 'all') return hud;
    }
    return 'threats';
  });

  const handleTabChange = (tab: 'threats' | 'npcs' | 'all') => {
    setActiveTab(tab);
    if (typeof window !== 'undefined') {
      try {
        const url = new URL(window.location.href);
        url.searchParams.set('hud', tab);
        window.history.replaceState(null, '', url.pathname + url.search);
      } catch (e) {}
    }
  };

  // Automatic smart tab selection only if user hasn't explicitly chosen via URL
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (!params.has('hud')) {
        if (activeEnemies.length > 0) {
          setActiveTab('threats');
        } else if (livingNPCs.length > 0) {
          setActiveTab('npcs');
        }
      }
    }
  }, [activeEnemies.length, livingNPCs.length]);

  const showThreats = activeTab === 'threats' || activeTab === 'all';
  const showNPCs = activeTab === 'npcs' || activeTab === 'all';

  return (
    <div className="bg-fantasy-panel border border-fantasy-border rounded-2xl p-4 shadow-xl flex flex-col min-h-0 h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 mb-2.5 border-b border-fantasy-border/80">
        <div className="flex items-center gap-2">
          <div className={`p-1.5 rounded-lg border ${
            activeEnemies.length > 0
              ? 'bg-red-950/50 border-red-500/50 text-red-400 animate-pulse'
              : livingNPCs.length > 0
              ? 'bg-emerald-950/50 border-emerald-500/50 text-emerald-400'
              : 'bg-slate-800/80 border-slate-700 text-slate-400'
          }`}>
            {activeEnemies.length > 0 ? (
              <Skull className="w-4 h-4" />
            ) : livingNPCs.length > 0 ? (
              <Users className="w-4 h-4" />
            ) : (
              <Shield className="w-4 h-4" />
            )}
          </div>
          <div>
            <h3 className="text-xs font-extrabold font-rpg uppercase tracking-wider text-slate-200">
              Сцена и окружение
            </h3>
            <p className="text-[10px] text-slate-400">
              {activeEnemies.length > 0
                ? `${activeEnemies.length} ${activeEnemies.length === 1 ? 'угроза в бою' : 'угроз в бою'}`
                : livingNPCs.length > 0
                ? `${livingNPCs.length} ${livingNPCs.length === 1 ? 'персонаж в сцене' : 'персонажей в сцене'}`
                : 'Зона безопасности'}
            </p>
          </div>
        </div>

        {/* Global state pill */}
        {activeEnemies.length > 0 ? (
          <span className="px-2 py-0.5 rounded-full text-[11px] font-mono font-bold bg-red-950/60 text-red-300 border border-red-500/50 flex items-center gap-1">
            <Swords className="w-3 h-3 animate-spin" /> Бой
          </span>
        ) : (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-mono text-emerald-400 bg-emerald-950/40 border border-emerald-800/40 flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" /> Спокойно
          </span>
        )}
      </div>

      {/* Tabs Filter */}
      <div className="grid grid-cols-3 gap-1 bg-slate-900/60 p-1 rounded-xl border border-slate-800/80 mb-3 text-[11px]">
        <button
          type="button"
          onClick={() => handleTabChange('threats')}
          className={`flex items-center justify-center gap-1.5 py-1 px-1.5 rounded-lg font-bold transition-all ${
            activeTab === 'threats'
              ? 'bg-red-950/70 text-red-200 border border-red-600/50 shadow-sm'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
          }`}
          title="Враги и угрозы на поле боя"
        >
          <Skull className="w-3.5 h-3.5" />
          <span className="truncate">Угрозы</span>
          {activeEnemies.length > 0 && (
            <span className="px-1.5 py-0.2 rounded-full text-[9px] bg-red-800 text-red-100 font-mono">
              {activeEnemies.length}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => handleTabChange('npcs')}
          className={`flex items-center justify-center gap-1.5 py-1 px-1.5 rounded-lg font-bold transition-all ${
            activeTab === 'npcs'
              ? 'bg-emerald-950/70 text-emerald-200 border border-emerald-600/50 shadow-sm'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
          }`}
          title="Нейтральные персонажи и союзники сцены"
        >
          <Users className="w-3.5 h-3.5" />
          <span className="truncate">Спутники</span>
          {livingNPCs.length > 0 && (
            <span className={`px-1.5 py-0.2 rounded-full text-[9px] font-mono ${
              allyCombatants.length > 0
                ? 'bg-emerald-600 text-white font-bold animate-pulse'
                : 'bg-slate-700 text-slate-200'
            }`}>
              {livingNPCs.length}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => handleTabChange('all')}
          className={`flex items-center justify-center gap-1.5 py-1 px-1.5 rounded-lg font-bold transition-all ${
            activeTab === 'all'
              ? 'bg-indigo-950/70 text-indigo-200 border border-indigo-600/50 shadow-sm'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
          }`}
          title="Показать всех участников сцены"
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>Все</span>
          {(activeEnemies.length + livingNPCs.length) > 0 && (
            <span className="px-1.5 py-0.2 rounded-full text-[9px] bg-slate-700 text-slate-200 font-mono">
              {activeEnemies.length + livingNPCs.length}
            </span>
          )}
        </button>
      </div>

      {/* Main List Container */}
      <div className="flex-1 overflow-y-auto space-y-3 pr-1 custom-scrollbar">
        {/* Empty State */}
        {enemies.length === 0 && sceneNPCs.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-4 text-slate-400">
            <div className="p-3 rounded-2xl bg-fantasy-card/60 border border-fantasy-border mb-2.5 text-slate-500">
              <Shield className="w-6 h-6 stroke-[1.5]" />
            </div>
            <p className="text-xs font-bold text-slate-300 mb-1">
              Сцена спокойна
            </p>
            <p className="text-[11px] text-slate-500 leading-relaxed max-w-[210px]">
              В текущей сцене нет активных угроз или встреченных персонажей. Отряд может исследовать окружение или сделать привал.
            </p>
          </div>
        ) : (
          <>
            {/* 1. SCENE NPCS SECTION */}
            {showNPCs && livingNPCs.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between px-1">
                  <span className="text-[10px] font-mono uppercase font-bold tracking-wider text-emerald-400/90 flex items-center gap-1">
                    <Users className="w-3 h-3 text-emerald-400" /> Нейтралы и союзники ({livingNPCs.length})
                  </span>
                  {allyCombatants.length > 0 && (
                    <span className="text-[9px] font-bold text-emerald-300 bg-emerald-950/70 border border-emerald-500/50 px-1.5 py-0.5 rounded">
                      ⚔️ {allyCombatants.length} в бою за отряд
                    </span>
                  )}
                </div>

                {livingNPCs.map((npc) => {
                  const hpPercent = Math.max(0, Math.min(100, Math.round((npc.hpCurrent / npc.hpMax) * 100)));
                  const isCriticallyWounded = hpPercent <= 25;
                  const isWounded = hpPercent <= 60;
                  const isAlly = npc.combatRole === 'ally_combatant';
                  const disp = DISPOSITION_CONFIG[npc.disposition] || DISPOSITION_CONFIG.neutral;
                  const combatRole = COMBAT_ROLE_CONFIG[npc.combatRole] || COMBAT_ROLE_CONFIG.neutral_observer;

                  return (
                    <div
                      key={npc.id}
                      className={`rounded-xl p-3 transition-all relative overflow-hidden group shadow-sm border ${
                        isAlly
                          ? 'bg-emerald-950/20 border-emerald-500/60 shadow-[0_0_15px_rgba(16,185,129,0.15)] hover:border-emerald-400'
                          : npc.combatRole === 'hiding'
                          ? 'bg-slate-900/60 border-amber-700/40 hover:border-amber-600/60'
                          : 'bg-fantasy-card border-fantasy-border hover:border-emerald-500/40'
                      }`}
                    >
                      {/* Top Bar: Name, Role & AC */}
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className={`font-bold text-xs truncate ${
                              isAlly ? 'text-emerald-300 font-extrabold' : 'text-slate-200'
                            }`}>
                              {npc.name}
                            </span>
                            {npc.role && (
                              <span className="px-1.5 py-0.2 rounded text-[9px] uppercase font-bold tracking-wider bg-slate-800 text-slate-300 border border-slate-700">
                                {npc.role}
                              </span>
                            )}
                          </div>
                        </div>

                        {npc.ac && (
                          <span
                            className="shrink-0 flex items-center gap-1 text-[11px] font-mono px-1.5 py-0.5 bg-slate-800/80 border border-slate-700/80 rounded-md text-cyan-300"
                            title={`Класс брони: ${npc.ac} КБ`}
                          >
                            <Shield className="w-3 h-3 text-cyan-400" />
                            <span>{npc.ac}</span>
                          </span>
                        )}
                      </div>

                      {/* HP Bar */}
                      <div className="mb-2">
                        <div className="flex items-center justify-between text-[10px] font-mono mb-1">
                          <span className="text-slate-400 flex items-center gap-1">
                            <Heart className={`w-3 h-3 ${isCriticallyWounded ? 'text-rose-500 animate-pulse' : 'text-rose-400'}`} />
                            <span>Здоровье</span>
                          </span>
                          <span className={`font-bold ${isCriticallyWounded ? 'text-rose-400' : 'text-slate-300'}`}>
                            {npc.hpCurrent} / {npc.hpMax}
                          </span>
                        </div>

                        <div className="w-full h-1.5 bg-slate-800/80 rounded-full overflow-hidden border border-slate-700/50">
                          <div
                            className={`h-full transition-all duration-500 rounded-full ${
                              isCriticallyWounded
                                ? 'bg-gradient-to-r from-red-600 to-rose-500'
                                : isWounded
                                ? 'bg-gradient-to-r from-amber-600 to-amber-400'
                                : 'bg-gradient-to-r from-emerald-600 to-teal-400'
                            }`}
                            style={{ width: `${hpPercent}%` }}
                          />
                        </div>
                      </div>

                      {/* NPC Willpower Bar */}
                      {npc.willpower !== undefined && (
                        <div className="mb-2">
                          <div className="flex items-center justify-between text-[10px] font-mono mb-1">
                            <span className="text-slate-400 flex items-center gap-1">
                              <Sparkles className="w-3 h-3 text-indigo-400" />
                              <span>Решимость / Воля</span>
                            </span>
                            <span className="font-bold text-indigo-300">
                              {npc.willpower}%
                            </span>
                          </div>
                          <div className="w-full h-1.5 bg-slate-800/80 rounded-full overflow-hidden border border-slate-700/50">
                            <div
                              className="h-full transition-all duration-500 rounded-full bg-gradient-to-r from-indigo-600 to-purple-400"
                              style={{ width: `${Math.max(0, Math.min(100, npc.willpower))}%` }}
                            />
                          </div>
                        </div>
                      )}

                      {/* Badges Bar: Disposition & Combat Role */}
                      <div className="flex flex-wrap gap-1 mb-2">
                        {/* Disposition Badge */}
                        <span
                          className={`px-1.5 py-0.5 rounded text-[9px] font-bold border flex items-center gap-1 ${disp.color}`}
                          title={`Отношение к отряду: ${disp.label}`}
                        >
                          {disp.icon}
                          <span>{disp.label}</span>
                        </span>

                        {/* Combat Role Badge */}
                        <span
                          className={`px-1.5 py-0.5 rounded text-[9px] font-bold border flex items-center gap-1 ${combatRole.color}`}
                          title={`Поведение в сцене: ${combatRole.label}`}
                        >
                          {combatRole.icon}
                          <span>{combatRole.label}</span>
                        </span>
                      </div>

                      {/* Status / Tactical Behavior */}
                      {npc.status && (
                        <div className={`flex items-start gap-1.5 text-[11px] p-1.5 rounded-lg border ${
                          isAlly
                            ? 'bg-emerald-950/40 border-emerald-800/40 text-emerald-200'
                            : 'bg-slate-900/50 border-slate-800 text-slate-300'
                        }`}>
                          {isAlly ? (
                            <Swords className="w-3 h-3 text-emerald-400 mt-0.5 shrink-0" />
                          ) : npc.combatRole === 'hiding' ? (
                            <Package className="w-3 h-3 text-amber-400 mt-0.5 shrink-0" />
                          ) : (
                            <Eye className="w-3 h-3 text-slate-400 mt-0.5 shrink-0" />
                          )}
                          <span className="italic leading-snug">{npc.status}</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Empty NPCs placeholder if tab is selected */}
            {activeTab === 'npcs' && livingNPCs.length === 0 && (
              <div className="p-4 text-center text-slate-400 bg-fantasy-card/40 rounded-xl border border-fantasy-border">
                <Users className="w-6 h-6 mx-auto mb-2 text-slate-500" />
                <p className="text-xs font-bold text-slate-300 mb-1">
                  Нет встреченных персонажей
                </p>
                <p className="text-[11px] text-slate-500">
                  В текущей сцене нет мирных жителей, торговцев или союзников.
                </p>
              </div>
            )}

            {/* 2. THREATS / OPPONENTS SECTION */}
            {showThreats && activeEnemies.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between px-1">
                  <span className="text-[10px] font-mono uppercase font-bold tracking-wider text-red-400 flex items-center gap-1">
                    <Skull className="w-3 h-3 text-red-400" /> Противники ({activeEnemies.length})
                  </span>
                  <span className="text-[9px] font-bold text-red-300 bg-red-950/70 border border-red-500/50 px-1.5 py-0.5 rounded">
                    ⚔️ В бою
                  </span>
                </div>

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

                      {/* Enemy Willpower / Resolve Bar */}
                      {enemy.willpower !== undefined && (
                        <div className="mb-2">
                          <div className="flex items-center justify-between text-[10px] font-mono mb-1">
                            <span className="text-slate-400 flex items-center gap-1">
                              <Sparkles className="w-3 h-3 text-indigo-400" />
                              <span>Воля к бою</span>
                            </span>
                            <span className={`font-bold ${enemy.willpower <= 25 ? 'text-indigo-400' : 'text-slate-300'}`}>
                              {enemy.willpower}%
                            </span>
                          </div>

                          <div className="w-full h-1.5 bg-slate-800/80 rounded-full overflow-hidden border border-slate-700/50">
                            <div
                              className={`h-full transition-all duration-500 rounded-full ${
                                enemy.willpower <= 25
                                  ? 'bg-gradient-to-r from-purple-600 to-indigo-400 animate-pulse'
                                  : 'bg-gradient-to-r from-indigo-600 to-purple-400'
                              }`}
                              style={{ width: `${Math.max(0, Math.min(100, enemy.willpower))}%` }}
                            />
                          </div>
                        </div>
                      )}

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
              </div>
            )}

            {/* Empty Threats placeholder if tab is selected */}
            {activeTab === 'threats' && activeEnemies.length === 0 && (
              <div className="p-4 text-center text-slate-400 bg-fantasy-card/40 rounded-xl border border-fantasy-border">
                <Shield className="w-6 h-6 mx-auto mb-2 text-slate-500" />
                <p className="text-xs font-bold text-slate-300 mb-1">
                  Угрозы не обнаружены
                </p>
                <p className="text-[11px] text-slate-500">
                  В текущей сцене нет врагов. Перейдите во вкладку «Спутники», чтобы увидеть NPC.
                </p>
              </div>
            )}

            {/* 3. DEFEATED / FALLEN ENTITIES */}
            {(defeatedEnemies.length > 0 || fallenNPCs.length > 0) && (
              <div className="pt-2 border-t border-slate-800/80 space-y-1.5">
                <p className="text-[10px] font-mono uppercase text-slate-500 px-1">
                  Покинули сцену / повержены ({defeatedEnemies.length + fallenNPCs.length}):
                </p>
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
                      {enemy.status || 'Повержен / скрылся'}
                    </span>
                  </div>
                ))}
                {fallenNPCs.map((npc) => (
                  <div
                    key={npc.id}
                    className="bg-red-950/20 border border-red-900/40 rounded-lg p-2 flex items-center justify-between text-xs opacity-50"
                  >
                    <div className="flex items-center gap-1.5">
                      <Skull className="w-3 h-3 text-red-500" />
                      <span className="line-through text-red-300 text-[11px]">
                        {npc.name} ({npc.role})
                      </span>
                    </div>
                    <span className="text-[10px] font-mono text-red-400 italic">
                      {npc.status || 'Покинул сцену'}
                    </span>
                  </div>
                ))}
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
