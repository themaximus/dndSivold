import React, { useState, useEffect } from 'react';
import {
  RoomEnemy,
  RoomNPC,
  NPCDisposition,
  NPCCombatRole,
  QuestEntity,
  WorldNPCEntry,
  SearchedObjectEntry,
  SceneProjectionViewModel,
  ProjectedEntityView,
  EnvironmentObjectEntity,
} from '../../types';
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
  Compass,
  History,
  Archive,
} from 'lucide-react';

interface OpponentsHUDProps {
  projection?: SceneProjectionViewModel;
  enemies?: RoomEnemy[];
  enemiesStatus?: string;
  sceneNPCs?: RoomNPC[];
  quests?: QuestEntity[];
  worldNPCRegistry?: WorldNPCEntry[];
  searchedObjects?: SearchedObjectEntry[];
  environmentObjects?: EnvironmentObjectEntity[];
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
  const s = (e.status || '').toLowerCase();
  return /(повержен|без сознания|не подает признаков|мертв|убит|погиб|покинул локацию|ушел прочь)/i.test(s);
};

const isSameEntity = (
  a?: { id?: string; name?: string; role?: string; type?: string },
  b?: { id?: string; name?: string; role?: string; type?: string }
): boolean => {
  if (!a || !b) return false;
  if (a.id && b.id && a.id === b.id) return true;
  const nameA = (a.name || '').trim().toLowerCase();
  const nameB = (b.name || '').trim().toLowerCase();
  return !!(nameA && nameB && (nameA === nameB || nameA.includes(nameB) || nameB.includes(nameA)));
};

export const OpponentsHUD: React.FC<OpponentsHUDProps> = ({
  projection,
  enemies = [],
  enemiesStatus,
  sceneNPCs = [],
  quests = [],
  worldNPCRegistry: rawWorldNPCRegistry = [],
  searchedObjects: rawSearchedObjects = [],
  environmentObjects: rawEnvironmentObjects = [],
}) => {
  const worldNPCRegistry = projection?.worldArchive && projection.worldArchive.length > 0 ? projection.worldArchive : rawWorldNPCRegistry;
  const searchedObjects = projection?.searchedObjects && projection.searchedObjects.length > 0 ? projection.searchedObjects : rawSearchedObjects;
  const environmentObjects = projection?.environmentObjects && projection.environmentObjects.length > 0 ? projection.environmentObjects : rawEnvironmentObjects;

  let activeEnemies: RoomEnemy[];
  let defeatedEnemies: RoomEnemy[];
  let livingNPCs: RoomNPC[];
  let fallenNPCs: RoomNPC[];
  let allyCombatants: RoomNPC[];

  if (projection && (projection.threats?.length > 0 || projection.sceneNPCs?.length > 0 || projection.allies?.length > 0)) {
    // Authoritative Server Projection (Thin Client)
    activeEnemies = (projection.threats || []).map((t: ProjectedEntityView) => ({
      id: t.entityId,
      name: t.name,
      type: t.type || t.role,
      hpCurrent: t.hpCurrent,
      hpMax: t.hpMax,
      ac: t.ac,
      status: t.status,
      conditions: t.conditions,
      isDead: t.isDead,
      willpower: t.willpower,
      willpowerMax: t.willpowerMax,
    }));
    defeatedEnemies = [];

    const mappedAllies: RoomNPC[] = (projection.allies || []).map((a: ProjectedEntityView) => ({
      id: a.entityId,
      name: a.name,
      role: a.role || 'Союзник',
      hpCurrent: a.hpCurrent,
      hpMax: a.hpMax,
      ac: a.ac,
      disposition: a.disposition || 'friendly',
      combatRole: 'ally_combatant' as const,
      status: a.status,
      conditions: a.conditions,
      isDead: a.isDead,
      willpower: a.willpower,
      willpowerMax: a.willpowerMax,
    }));

    const mappedNPCs: RoomNPC[] = (projection.sceneNPCs || []).map((n: ProjectedEntityView) => ({
      id: n.entityId,
      name: n.name,
      role: n.role || 'Персонаж',
      hpCurrent: n.hpCurrent,
      hpMax: n.hpMax,
      ac: n.ac,
      disposition: n.disposition || 'neutral',
      combatRole: n.combatRole as any,
      status: n.status,
      conditions: n.conditions,
      isDead: n.isDead,
      willpower: n.willpower,
      willpowerMax: n.willpowerMax,
    }));

    livingNPCs = [...mappedAllies, ...mappedNPCs];
    allyCombatants = mappedAllies;
    fallenNPCs = [];
  } else {
    activeEnemies = enemies.filter((e) => !isEntityDepartedOrDefeated(e));
    defeatedEnemies = enemies.filter((e) => isEntityDepartedOrDefeated(e));

    const isArchivedInWorld = (name?: string) => {
      if (!name) return false;
      const clean = name.toLowerCase().trim();
      return worldNPCRegistry.some((w: WorldNPCEntry) => {
        const wClean = (w.name || '').toLowerCase().trim();
        return wClean && (clean.includes(wClean) || wClean.includes(clean));
      });
    };

    livingNPCs = sceneNPCs.filter(
      (n) =>
        !isEntityDepartedOrDefeated(n) &&
        !isArchivedInWorld(n.name) &&
        !activeEnemies.some((e) => isSameEntity(e, n))
    );
    fallenNPCs = sceneNPCs.filter(
      (n) => isEntityDepartedOrDefeated(n) && !defeatedEnemies.some((e) => isSameEntity(e, n))
    );
    allyCombatants = livingNPCs.filter((n) => n.combatRole === 'ally_combatant');
  }

  const activeQuests = quests.filter(q => q.status === 'active');
  const completedQuests = quests.filter(q => q.status === 'completed');

  // Read initial tab from URL ?hud=threats|npcs|quests|history|all if provided
  const [activeTab, setActiveTab] = useState<'threats' | 'npcs' | 'quests' | 'history' | 'all'>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const hud = params.get('hud');
      if (hud === 'threats' || hud === 'npcs' || hud === 'quests' || hud === 'history' || hud === 'all') return hud as any;
    }
    return 'threats';
  });

  const [userManuallySelectedTab, setUserManuallySelectedTab] = useState(false);

  const handleTabChange = (tab: 'threats' | 'npcs' | 'quests' | 'history' | 'all') => {
    setActiveTab(tab);
    setUserManuallySelectedTab(true);
    if (typeof window !== 'undefined') {
      try {
        const url = new URL(window.location.href);
        url.searchParams.set('hud', tab);
        window.history.replaceState(null, '', url.pathname + url.search);
      } catch (e) {}
    }
  };

  // Automatic smart tab selection only if user hasn't explicitly chosen manually or via URL
  useEffect(() => {
    if (userManuallySelectedTab) return;
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (!params.has('hud')) {
        if (activeEnemies.length > 0) {
          setActiveTab('threats');
        } else if (livingNPCs.length > 0) {
          setActiveTab('npcs');
        } else if (activeQuests.length > 0) {
          setActiveTab('quests');
        }
      }
    }
  }, [activeEnemies.length, livingNPCs.length, activeQuests.length, userManuallySelectedTab]);

  const showThreats = activeTab === 'threats' || activeTab === 'all';
  const showNPCs = activeTab === 'npcs' || activeTab === 'all';
  const showQuests = activeTab === 'quests' || activeTab === 'all';
  const showHistory = activeTab === 'history' || activeTab === 'all';

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
      <div className="grid grid-cols-5 gap-1 bg-slate-900/60 p-1 rounded-xl border border-slate-800/80 mb-3 text-[11px]">
        <button
          type="button"
          onClick={() => handleTabChange('threats')}
          className={`flex flex-col items-center justify-center py-1.5 px-0.5 rounded-lg font-bold transition-all relative ${
            activeTab === 'threats'
              ? 'bg-red-950/70 text-red-200 border border-red-600/50 shadow-sm'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
          }`}
          title="Враги и угрозы на поле боя"
        >
          <div className="relative">
            <Skull className="w-3.5 h-3.5" />
            {activeEnemies.length > 0 && (
              <span className="absolute -top-1.5 -right-2.5 px-1 py-0.2 rounded-full text-[8px] bg-red-600 text-white font-mono leading-none">
                {activeEnemies.length}
              </span>
            )}
          </div>
          <span className="text-[10px] mt-1 leading-none">Враги</span>
        </button>

        <button
          type="button"
          onClick={() => handleTabChange('npcs')}
          className={`flex flex-col items-center justify-center py-1.5 px-0.5 rounded-lg font-bold transition-all relative ${
            activeTab === 'npcs'
              ? 'bg-emerald-950/70 text-emerald-200 border border-emerald-600/50 shadow-sm'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
          }`}
          title="Нейтральные персонажи и спутники сцены"
        >
          <div className="relative">
            <Users className="w-3.5 h-3.5" />
            {livingNPCs.length > 0 && (
              <span className={`absolute -top-1.5 -right-2.5 px-1 py-0.2 rounded-full text-[8px] font-mono leading-none ${
                allyCombatants.length > 0
                  ? 'bg-emerald-600 text-white font-bold animate-pulse'
                  : 'bg-slate-700 text-slate-200'
              }`}>
                {livingNPCs.length}
              </span>
            )}
          </div>
          <span className="text-[10px] mt-1 leading-none">Сцена</span>
        </button>

        <button
          type="button"
          onClick={() => handleTabChange('quests')}
          className={`flex flex-col items-center justify-center py-1.5 px-0.5 rounded-lg font-bold transition-all relative ${
            activeTab === 'quests'
              ? 'bg-amber-950/70 text-amber-200 border border-amber-600/50 shadow-sm'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
          }`}
          title="Задачи, квесты и цели отряда"
        >
          <div className="relative">
            <Compass className="w-3.5 h-3.5 text-amber-400" />
            {activeQuests.length > 0 ? (
              <span className="absolute -top-1.5 -right-2.5 px-1 py-0.2 rounded-full text-[8px] bg-amber-800 text-amber-100 font-mono leading-none">
                {activeQuests.length}
              </span>
            ) : completedQuests.length > 0 ? (
              <span className="absolute -top-1.5 -right-2 px-1 py-0.2 rounded-full text-[8px] bg-emerald-900/80 text-emerald-300 font-mono leading-none">
                ✓
              </span>
            ) : null}
          </div>
          <span className="text-[10px] mt-1 leading-none">Квесты</span>
        </button>

        <button
          type="button"
          onClick={() => handleTabChange('history')}
          className={`flex flex-col items-center justify-center py-1.5 px-0.5 rounded-lg font-bold transition-all relative ${
            activeTab === 'history'
              ? 'bg-purple-950/70 text-purple-200 border border-purple-600/50 shadow-sm'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
          }`}
          title="Архив мира и история обысков"
        >
          <div className="relative">
            <History className="w-3.5 h-3.5 text-purple-400" />
            {(worldNPCRegistry.length > 0 || searchedObjects.length > 0) && (
              <span className="absolute -top-1.5 -right-2.5 px-1 py-0.2 rounded-full text-[8px] bg-purple-900/90 text-purple-200 font-mono leading-none">
                {worldNPCRegistry.length + searchedObjects.length}
              </span>
            )}
          </div>
          <span className="text-[10px] mt-1 leading-none">Архив</span>
        </button>

        <button
          type="button"
          onClick={() => handleTabChange('all')}
          className={`flex flex-col items-center justify-center py-1.5 px-0.5 rounded-lg font-bold transition-all relative ${
            activeTab === 'all'
              ? 'bg-indigo-950/70 text-indigo-200 border border-indigo-600/50 shadow-sm'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
          }`}
          title="Показать всё"
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span className="text-[10px] mt-1 leading-none">Все</span>
        </button>
      </div>

      {/* Main List Container */}
      <div className="flex-1 overflow-y-auto space-y-3 pr-1 custom-scrollbar">
        {/* Empty State only when 'all' tab is selected and everything is completely empty */}
        {activeTab === 'all' &&
         activeEnemies.length === 0 &&
         livingNPCs.length === 0 &&
         defeatedEnemies.length === 0 &&
         fallenNPCs.length === 0 &&
         activeQuests.length === 0 &&
         completedQuests.length === 0 &&
         worldNPCRegistry.length === 0 &&
         searchedObjects.length === 0 ? (
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

            {/* Interactive Environment Objects (Vehicles, Barriers, Mechanisms) */}
            {showNPCs && environmentObjects.length > 0 && (
              <div className="space-y-2 pt-2 border-t border-slate-800/80">
                <div className="flex items-center justify-between px-1">
                  <span className="text-[10px] font-mono uppercase font-bold tracking-wider text-amber-400 flex items-center gap-1.5">
                    <Package className="w-3 h-3 text-amber-400" /> Объекты окружения ({environmentObjects.length})
                  </span>
                </div>

                {environmentObjects.map((obj) => {
                  const isOperational = obj.isOperational;
                  const currentStage = obj.progressStage?.current ?? 0;
                  const maxStage = obj.progressStage?.max ?? 2;
                  const stagePercent = maxStage > 0 ? Math.round((currentStage / maxStage) * 100) : 0;

                  return (
                    <div
                      key={obj.id || obj.key}
                      className="bg-fantasy-card border border-fantasy-border hover:border-amber-500/50 rounded-xl p-3 transition-all relative overflow-hidden group shadow-sm"
                    >
                      {/* Top Bar: Name & Operational Status Badge */}
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="min-w-0">
                          <span className="font-bold text-xs text-slate-200 truncate group-hover:text-amber-300 transition-colors flex items-center gap-1.5">
                            {obj.key.includes('wagon') ? '🚜' : obj.key.includes('gate') || obj.key.includes('door') ? '🚪' : '⚙️'} {obj.name}
                          </span>
                        </div>

                        <span
                          className={`shrink-0 px-2 py-0.5 rounded text-[9px] font-mono font-bold border flex items-center gap-1 ${
                            isOperational
                              ? 'bg-emerald-950/70 text-emerald-300 border-emerald-600/50'
                              : obj.state === 'in_progress'
                              ? 'bg-amber-950/70 text-amber-300 border-amber-600/50 animate-pulse'
                              : 'bg-red-950/70 text-red-300 border-red-600/50'
                          }`}
                        >
                          {isOperational ? (
                            <>
                              <CheckCircle2 className="w-2.5 h-2.5 text-emerald-400" />
                              <span>На ходу / Исправен</span>
                            </>
                          ) : obj.state === 'in_progress' ? (
                            <>
                              <Sparkles className="w-2.5 h-2.5 text-amber-400" />
                              <span>В процессе починки</span>
                            </>
                          ) : (
                            <>
                              <AlertTriangle className="w-2.5 h-2.5 text-red-400" />
                              <span>Сломан / Неисправен</span>
                            </>
                          )}
                        </span>
                      </div>

                      {/* Progress Stage Bar */}
                      <div className="mb-2">
                        <div className="flex items-center justify-between text-[10px] font-mono mb-1">
                          <span className="text-slate-400">
                            Этап готовности:
                          </span>
                          <span className={`font-bold ${isOperational ? 'text-emerald-400' : 'text-amber-300'}`}>
                            {currentStage} / {maxStage}
                          </span>
                        </div>
                        <div className="w-full h-1.5 bg-slate-800/80 rounded-full overflow-hidden border border-slate-700/50">
                          <div
                            className={`h-full transition-all duration-500 rounded-full ${
                              isOperational
                                ? 'bg-gradient-to-r from-emerald-600 to-emerald-400'
                                : 'bg-gradient-to-r from-amber-600 to-amber-400'
                            }`}
                            style={{ width: `${stagePercent}%` }}
                          />
                        </div>
                        {obj.progressStage?.currentStageText && (
                          <p className="text-[10px] text-slate-400 mt-1 italic">
                            {obj.progressStage.currentStageText}
                          </p>
                        )}
                      </div>

                      {/* Physical Blocker Alert (if not operational) */}
                      {!isOperational && obj.physicalBlocker && (
                        <div className="flex items-start gap-1.5 text-[10px] p-1.5 rounded-lg bg-red-950/30 border border-red-900/40 text-red-300 mb-1.5">
                          <AlertTriangle className="w-3 h-3 text-red-400 mt-0.5 shrink-0" />
                          <span><strong>Физический блокер:</strong> {obj.physicalBlocker}</span>
                        </div>
                      )}

                      {/* Required Prerequisites */}
                      {obj.requiredPrerequisites && obj.requiredPrerequisites.length > 0 && !isOperational && (
                        <div className="text-[10px] text-slate-400 flex items-center gap-1 font-mono">
                          <span className="text-amber-400">Требуется:</span>
                          <span className="text-slate-300">{obj.requiredPrerequisites.join(' ➔ ')}</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Empty NPCs placeholder if tab is selected and both livingNPCs and environmentObjects are empty */}
            {activeTab === 'npcs' && livingNPCs.length === 0 && environmentObjects.length === 0 && (
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
            {(defeatedEnemies.length > 0 || fallenNPCs.length > 0) && (showThreats || showNPCs) && (
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

            {/* 4. QUESTS & OBJECTIVES (when showQuests is true) */}
            {showQuests && (activeTab !== 'all' || activeQuests.length > 0 || completedQuests.length > 0) && (
              <div className={`${activeTab === 'all' ? 'pt-3 border-t border-slate-800/80' : ''} space-y-3`}>
                {/* Active Quests */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between px-1">
                    <span className="text-[11px] font-bold font-rpg uppercase text-amber-300 flex items-center gap-1.5">
                      <Compass className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                      Активные задачи ({activeQuests.length})
                    </span>
                  </div>

                  {activeQuests.length === 0 ? (
                    <div className="p-3 text-center text-slate-400 bg-fantasy-card/40 rounded-xl border border-fantasy-border text-xs">
                      <p className="text-slate-300 font-semibold mb-0.5">Нет активных задач</p>
                      <p className="text-[10px] text-slate-500">Отряд исследует мир без срочных поручений.</p>
                    </div>
                  ) : (
                    activeQuests.map((q) => (
                      <div
                        key={q.id}
                        className="bg-slate-900/80 border border-amber-500/30 hover:border-amber-500/60 rounded-xl p-3 shadow-md transition-all group"
                      >
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <h4 className="text-xs font-bold text-amber-200 group-hover:text-amber-100 leading-snug">
                            {q.title}
                          </h4>
                          <span className={`px-1.5 py-0.5 rounded text-[9px] font-mono shrink-0 border ${
                            q.category === 'main' ? 'bg-amber-950/70 text-amber-300 border-amber-600/50' :
                            q.category === 'repair' ? 'bg-blue-950/70 text-blue-300 border-blue-600/50' :
                            q.category === 'investigation' ? 'bg-purple-950/70 text-purple-300 border-purple-600/50' :
                            q.category === 'social' ? 'bg-cyan-950/70 text-cyan-300 border-cyan-600/50' :
                            'bg-slate-800 text-slate-300 border-slate-700'
                          }`}>
                            {q.category === 'main' ? '👑 Основной' :
                             q.category === 'repair' ? '🔧 Ремонт' :
                             q.category === 'investigation' ? '🔍 Поиск' :
                             q.category === 'social' ? '🤝 Диалог' : '⚔️ Задача'}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-300 leading-relaxed font-sans mb-1.5">
                          {q.description}
                        </p>
                        {q.giverName && (
                          <div className="text-[10px] text-amber-400/80 font-mono flex items-center gap-1">
                            <span>Заказчик: {q.giverName}</span>
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>

                {/* Completed Quests */}
                {completedQuests.length > 0 && (
                  <div className="pt-2 border-t border-slate-800/80 space-y-1.5">
                    <span className="text-[11px] font-bold font-rpg uppercase text-emerald-400 flex items-center gap-1.5 px-1">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      Выполнено ({completedQuests.length})
                    </span>

                    {completedQuests.map((q) => (
                      <div
                        key={q.id}
                        className="bg-emerald-950/20 border border-emerald-800/40 rounded-xl p-2.5 flex flex-col gap-1 text-xs"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-emerald-300 text-[11px] flex items-center gap-1.5">
                            <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
                            {q.title}
                          </span>
                          <span className="text-[9px] font-mono text-emerald-400/70 bg-emerald-950/60 px-1.5 py-0.5 rounded border border-emerald-800/50 shrink-0">
                            Раунд {q.roundCompleted || q.roundCreated}
                          </span>
                        </div>
                        {q.resolutionNote && (
                          <p className="text-[10px] text-slate-300 italic pl-4.5 leading-tight">
                            {q.resolutionNote}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* 5. WORLD HISTORY & SEARCHED OBJECTS (when showHistory is true) */}
            {showHistory && (activeTab !== 'all' || worldNPCRegistry.length > 0 || searchedObjects.length > 0) && (
              <div className={`${activeTab === 'all' ? 'pt-3 border-t border-slate-800/80' : ''} space-y-3`}>
                {activeTab === 'history' && worldNPCRegistry.length === 0 && searchedObjects.length === 0 ? (
                  <div className="p-4 text-center text-slate-400 bg-fantasy-card/40 rounded-xl border border-fantasy-border">
                    <History className="w-6 h-6 mx-auto mb-2 text-purple-400/70" />
                    <p className="text-xs font-bold text-slate-300 mb-1">Архив мира пуст</p>
                    <p className="text-[11px] text-slate-500">Пока нет выбывших персонажей или исследованных объектов в летописи.</p>
                  </div>
                ) : (
                  <>
                    {/* World NPC Archive (Departed NPCs) */}
                    {(activeTab === 'history' || worldNPCRegistry.length > 0) && (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between px-1">
                          <span className="text-[11px] font-bold font-rpg uppercase text-purple-300 flex items-center gap-1.5">
                            <Archive className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                            Архив мира / История ({worldNPCRegistry.length})
                          </span>
                        </div>

                        {worldNPCRegistry.length === 0 ? (
                          <div className="p-3 text-center text-slate-400 bg-fantasy-card/40 rounded-xl border border-fantasy-border text-xs">
                            <p className="text-slate-300 font-semibold mb-0.5">Архив персонажей пуст</p>
                            <p className="text-[10px] text-slate-500">Все встреченные персонажи находятся в текущей сцене.</p>
                          </div>
                        ) : (
                          worldNPCRegistry.map((wn: WorldNPCEntry) => (
                            <div
                              key={wn.id}
                              className="bg-slate-900/80 border border-purple-900/40 rounded-xl p-2.5 space-y-1 shadow-sm"
                            >
                              <div className="flex items-start justify-between gap-1.5">
                                <span className="font-bold text-purple-200 text-xs flex items-center gap-1.5">
                                  <Users className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                                  {wn.name} <span className="text-[10px] text-slate-400 font-normal">({wn.role})</span>
                                </span>
                                <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-purple-950/70 text-purple-300 border border-purple-800/50 shrink-0">
                                  Р{wn.departureRound} • {
                                    wn.departureReason === 'left_behind' ? 'Остался позади' :
                                    wn.departureReason === 'location_transition' ? 'Смена локации' :
                                    wn.departureReason === 'fled' ? 'В бегстве' :
                                    wn.departureReason === 'defeated' ? 'Повержен' : 'Вне сцены'
                                  }
                                </span>
                              </div>
                              {wn.narrativeNote && (
                                <p className="text-[10px] text-slate-300 italic pl-5 leading-tight">
                                  {wn.narrativeNote}
                                </p>
                              )}
                              {wn.potentialHooks && wn.potentialHooks.length > 0 && (
                                <div className="text-[9px] text-amber-300/80 pl-5 flex items-center gap-1">
                                  <span className="text-amber-500">✦</span>
                                  <span>{wn.potentialHooks[0]}</span>
                                </div>
                              )}
                            </div>
                          ))
                        )}
                      </div>
                    )}

                    {/* Searched & Exhausted Objects Registry */}
                    {(activeTab === 'history' || searchedObjects.length > 0) && (
                      <div className={`space-y-2 ${worldNPCRegistry.length > 0 ? 'pt-2 border-t border-slate-800/80' : ''}`}>
                        <div className="flex items-center justify-between px-1">
                          <span className="text-[11px] font-bold font-rpg uppercase text-cyan-300 flex items-center gap-1.5">
                            <Package className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                            Обысканные объекты ({searchedObjects.length})
                          </span>
                        </div>

                        {searchedObjects.length === 0 ? (
                          <div className="p-3 text-center text-slate-400 bg-fantasy-card/40 rounded-xl border border-fantasy-border text-xs">
                            <p className="text-slate-300 font-semibold mb-0.5">Нет обысканных объектов</p>
                            <p className="text-[10px] text-slate-500">Повозки, сундуки и помещения ещё не подвергались обыску.</p>
                          </div>
                        ) : (
                          searchedObjects.map((obj: SearchedObjectEntry) => (
                            <div
                              key={obj.id}
                              className="bg-slate-900/80 border border-cyan-900/40 rounded-xl p-2.5 space-y-1 shadow-sm"
                            >
                              <div className="flex items-start justify-between gap-1.5">
                                <span className="font-bold text-cyan-200 text-xs flex items-center gap-1.5">
                                  <Package className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                                  {obj.targetName}
                                </span>
                                <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-cyan-950/70 text-cyan-300 border border-cyan-800/60 shrink-0">
                                  ОБЫЩЕНО • Р{obj.searchedInRound}
                                </span>
                              </div>
                              <div className="text-[10px] text-slate-300 pl-5">
                                <span className="text-slate-500">Извлечено: </span>
                                <span className="text-amber-300 font-semibold">
                                  {obj.extractedItems && obj.extractedItems.length > 0 ? obj.extractedItems.join(', ') : 'Все ценные вещи'}
                                </span>
                              </div>
                              {obj.narrativeNote && (
                                <p className="text-[10px] text-slate-400 italic pl-5 leading-tight">
                                  {obj.narrativeNote}
                                </p>
                              )}
                            </div>
                          ))
                        )}
                      </div>
                    )}
                  </>
                )}
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
