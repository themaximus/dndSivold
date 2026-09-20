import React, { useState, useEffect } from 'react';
import { Character, DiceRollResult, RoomEnemy } from '../../types';
import { Sparkles, Dices, Send, Clock, ShieldAlert, Skull, Package, Crosshair, Shield, Zap } from 'lucide-react';
import { AttachedRollsBar } from './AttachedRollsBar';
import { QuickActionButtons } from './QuickActionButtons';

export interface ActionMeta {
  actionType?: 'attack' | 'check' | 'save' | 'improvise';
  targetEnemyId?: string;
  targetEnemyName?: string;
  advantage?: boolean;
  disadvantage?: boolean;
  spellLevelUsed?: number;
}

interface ActionConsoleProps {
  hasCharacter: boolean;
  hasSubmittedThisRound: boolean;
  isDMThinking: boolean;
  currentSituation?: string;
  targetDC?: number;
  dcReason?: string;
  requiredCheckStat?: string;
  isMyTurn?: boolean;
  activePlayerName?: string;
  turnMode?: 'simultaneous' | 'turn_by_turn';
  character: Character | null;
  attachedRolls: DiceRollResult[];
  lastDeathSaveMessage?: string | null;
  activeEnemies?: RoomEnemy[];
  onRemoveRoll: (index: number) => void;
  onOpenDiceModal: (opts?: { defaultPurpose?: string; defaultAdvantage?: boolean; defaultDisadvantage?: boolean; defaultStatKey?: string }) => void;
  onSubmit: (actionText: string, meta?: ActionMeta) => void;
  onRollDeathSave?: (rollResult: { rollTotal: number; isNat20: boolean; isNat1: boolean }) => void;
}

const STAT_LABELS: Record<string, string> = {
  str: 'СИЛА (STR)',
  dex: 'ЛОВКОСТЬ (DEX)',
  con: 'ТЕЛОСЛОЖЕНИЕ (CON)',
  int: 'ИНТЕЛЛЕКТ (INT)',
  wis: 'МУДРОСТЬ (WIS)',
  cha: 'ХАРИЗМА (CHA)',
};

export const ActionConsole: React.FC<ActionConsoleProps> = ({
  hasCharacter,
  hasSubmittedThisRound,
  isDMThinking,
  currentSituation,
  targetDC = 12,
  dcReason,
  requiredCheckStat,
  isMyTurn = true,
  activePlayerName,
  turnMode = 'simultaneous',
  character,
  attachedRolls,
  lastDeathSaveMessage,
  activeEnemies = [],
  onRemoveRoll,
  onOpenDiceModal,
  onSubmit,
  onRollDeathSave,
}) => {
  const [actionText, setActionText] = useState('');
  const [actionType, setActionType] = useState<'attack' | 'check' | 'save' | 'improvise'>('check');
  const [targetEnemyId, setTargetEnemyId] = useState<string>('');
  const [advantage, setAdvantage] = useState<boolean>(false);
  const [disadvantage, setDisadvantage] = useState<boolean>(false);
  const [selectedSpellLevel, setSelectedSpellLevel] = useState<number>(0);

  const livingEnemies = activeEnemies.filter(e => !e.isDead && e.hpCurrent > 0);

  // Sync target enemy when living enemies change
  useEffect(() => {
    if (livingEnemies.length > 0) {
      const stillAlive = livingEnemies.some(e => e.id === targetEnemyId);
      if (!targetEnemyId || !stillAlive) {
        setTargetEnemyId(livingEnemies[0].id);
      }
    } else {
      setTargetEnemyId('');
      if (actionType === 'attack') {
        setActionType('check');
      }
    }
  }, [livingEnemies.length, targetEnemyId, actionType]);

  const targetEnemy = livingEnemies.find(e => e.id === targetEnemyId);
  const hasD20Roll = attachedRolls.some(r => r.diceType.toLowerCase() === 'd20');

  // If in attack mode, compare vs enemy AC; otherwise vs room targetDC
  const effectiveTargetDC = actionType === 'attack' && targetEnemy ? (targetEnemy.ac || 12) : targetDC;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!hasD20Roll) {
      alert('Перед завершением хода необходимо бросить d20 для проверки успеха против СЛ мастера или КБ цели!');
      handleOpenDiceModal();
      return;
    }

    if (!actionText.trim() && attachedRolls.length === 0) {
      alert('Опишите ваше действие или совершите бросок кубика!');
      return;
    }

    const meta: ActionMeta = {
      actionType,
      targetEnemyId: actionType === 'attack' ? targetEnemy?.id : undefined,
      targetEnemyName: actionType === 'attack' ? targetEnemy?.name : undefined,
      advantage,
      disadvantage,
      spellLevelUsed: selectedSpellLevel > 0 ? selectedSpellLevel : undefined,
    };

    onSubmit(actionText, meta);
    setActionText('');
    setAdvantage(false);
    setDisadvantage(false);
    setSelectedSpellLevel(0);
  };

  const handleOpenDiceModal = () => {
    let defaultPurpose = 'Проверка навыка';
    if (actionType === 'attack' && targetEnemy) {
      defaultPurpose = `Атака по ${targetEnemy.name} (КБ ${targetEnemy.ac || 12})`;
    } else if (actionType === 'save') {
      defaultPurpose = `Спасбросок (${requiredCheckStat ? requiredCheckStat.toUpperCase() : 'общий'})`;
    } else if (actionType === 'improvise') {
      defaultPurpose = 'Импровизация / Тактический трюк';
    }

    onOpenDiceModal({
      defaultPurpose,
      defaultAdvantage: advantage,
      defaultDisadvantage: disadvantage,
      defaultStatKey: requiredCheckStat || (actionType === 'attack' ? 'str' : 'dex'),
    });
  };

  const handleSelectQuickAction = (text: string) => {
    setActionText(prev => (prev ? `${prev} ${text}` : text));
  };

  const handleDeathSaveClick = () => {
    if (!onRollDeathSave) return;
    const d20 = Math.floor(Math.random() * 20) + 1;
    const isNat20 = d20 === 20;
    const isNat1 = d20 === 1;
    onRollDeathSave({
      rollTotal: d20,
      isNat20,
      isNat1,
    });
  };

  if (!hasCharacter) {
    return (
      <div className="p-4 bg-fantasy-card border-t border-fantasy-border text-center text-xs text-slate-400">
        Выберите персонажа в лобби комнаты, чтобы участвовать в битвах.
      </div>
    );
  }

  // 1. Character is DEAD
  if (character?.lifeState === 'dead') {
    return (
      <div className="p-4 bg-red-950/60 border-t border-red-500/40 text-center space-y-2">
        <div className="flex items-center justify-center gap-2 text-red-400 font-rpg font-bold text-sm tracking-wide">
          <Skull className="w-5 h-5 text-red-400 animate-pulse" />
          <span>Герой пал на поле боя...</span>
        </div>
        <p className="text-xs text-slate-300 max-w-md mx-auto">
          Вы получили 3 провала спасбросков от смерти и испустили последний вздох. Ожидайте воскрешения или исхода похода отряда.
        </p>
      </div>
    );
  }

  // 2. Character is DOWNED (0 HP - Death Saves)
  if (character?.lifeState === 'downed') {
    const saves = character.deathSaves || { successes: 0, failures: 0, isStable: false };

    return (
      <div className="p-4 bg-rose-950/40 border-t border-rose-500/50 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-rose-400 font-rpg font-bold text-sm">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping" />
            <span>ПРИ СМЕРТИ (0 HP) — СПАСБРОСКИ ОТ СМЕРТИ</span>
          </div>

          <div className="flex items-center gap-4 text-xs font-mono font-bold">
            <span className="text-emerald-400">Успехи: {saves.successes}/3</span>
            <span className="text-rose-400">Провалы: {saves.failures}/3</span>
          </div>
        </div>

        {lastDeathSaveMessage && (
          <p className="text-xs text-amber-300 italic bg-black/40 px-3 py-1.5 rounded-lg border border-rose-500/30">
            {lastDeathSaveMessage}
          </p>
        )}

        <div className="flex items-center justify-between gap-3 pt-1">
          <p className="text-xs text-slate-300">
            Вы без сознания. Бросьте d20: <strong>10+</strong> = успех, <strong>2-9</strong> = провал, <strong>1</strong> = 2 провала, <strong>20</strong> = оживление с 1 HP!
          </p>

          <button
            type="button"
            onClick={handleDeathSaveClick}
            className="px-5 py-2.5 bg-rose-600 hover:bg-rose-500 text-white font-bold font-rpg text-xs rounded-xl shadow-lg shadow-rose-600/30 transition-all flex items-center gap-2 flex-shrink-0"
          >
            <Dices className="w-4 h-4 text-rose-200" />
            Бросить спасбросок (d20)
          </button>
        </div>
      </div>
    );
  }

  // 3. Round action already submitted
  if (hasSubmittedThisRound) {
    return (
      <div className="p-4 bg-fantasy-card/95 border-t border-fantasy-border flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 text-xs text-amber-300">
          <Clock className="w-4 h-4 text-amber-400 animate-spin" />
          <span>
            {isDMThinking
              ? 'Мастер Подземелий (AI) обдумывает исход раунда...'
              : 'Ваше действие принято! Ожидание остальных искателей приключений...'}
          </span>
        </div>
      </div>
    );
  }

  // 4. Turn-by-turn mode: not your turn
  if (turnMode === 'turn_by_turn' && !isMyTurn) {
    return (
      <div className="p-4 bg-fantasy-card/95 border-t border-fantasy-border flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 text-xs text-amber-300">
          <Clock className="w-4 h-4 text-amber-400 animate-spin" />
          <span>
            Сейчас совершает ход: <strong className="text-amber-400 font-bold">{activePlayerName || 'Соратник'}</strong>... Ожидайте своей очереди.
          </span>
        </div>
      </div>
    );
  }

  // 5. Standard Turn Action Input
  const statLabel = requiredCheckStat ? STAT_LABELS[requiredCheckStat.toLowerCase()] || requiredCheckStat.toUpperCase() : null;

  return (
    <div className="p-4 bg-fantasy-card border-t border-fantasy-border space-y-3">
      {/* Action Type Tabs (Attack vs Check vs Save vs Improvise) */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1 p-1 bg-slate-900/80 rounded-xl border border-slate-800 text-xs">
          <button
            type="button"
            onClick={() => setActionType('attack')}
            disabled={livingEnemies.length === 0}
            className={`px-3 py-1 rounded-lg font-bold transition-all flex items-center gap-1.5 ${
              actionType === 'attack'
                ? 'bg-red-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200 disabled:opacity-30 disabled:cursor-not-allowed'
            }`}
            title={livingEnemies.length === 0 ? 'Нет активных врагов на поле боя' : 'Атаковать выбранного противника (бросок против КБ)'}
          >
            <Crosshair className="w-3.5 h-3.5" />
            <span>Атака</span>
          </button>

          <button
            type="button"
            onClick={() => setActionType('check')}
            className={`px-3 py-1 rounded-lg font-bold transition-all flex items-center gap-1.5 ${
              actionType === 'check'
                ? 'bg-amber-500 text-black shadow-md'
                : 'text-slate-400 hover:text-slate-200'
            }`}
            title="Проверка характеристики или навыка против СЛ мастера"
          >
            <Dices className="w-3.5 h-3.5" />
            <span>Проверка</span>
          </button>

          <button
            type="button"
            onClick={() => setActionType('save')}
            className={`px-3 py-1 rounded-lg font-bold transition-all flex items-center gap-1.5 ${
              actionType === 'save'
                ? 'bg-blue-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200'
            }`}
            title="Спасбросок от опасности или эффекта"
          >
            <Shield className="w-3.5 h-3.5" />
            <span>Спасбросок</span>
          </button>

          <button
            type="button"
            onClick={() => setActionType('improvise')}
            className={`px-3 py-1 rounded-lg font-bold transition-all flex items-center gap-1.5 ${
              actionType === 'improvise'
                ? 'bg-purple-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200'
            }`}
            title="Импровизация, трюк или использование окружения"
          >
            <Zap className="w-3.5 h-3.5" />
            <span>Импровизация</span>
          </button>
        </div>

        {/* Advantage & Disadvantage Toggles */}
        <div className="flex items-center gap-1 p-1 bg-slate-900/80 rounded-xl border border-slate-800 text-xs">
          <button
            type="button"
            onClick={() => { setAdvantage(false); setDisadvantage(false); }}
            className={`px-2.5 py-1 rounded-lg font-mono text-[11px] font-bold transition-all ${
              !advantage && !disadvantage
                ? 'bg-slate-700 text-slate-100 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
            title="Обычный бросок 1d20"
          >
            1d20
          </button>

          <button
            type="button"
            onClick={() => { setAdvantage(prev => !prev); setDisadvantage(false); }}
            className={`px-2.5 py-1 rounded-lg font-mono text-[11px] font-bold transition-all ${
              advantage
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-emerald-400 hover:bg-emerald-950/40'
            }`}
            title="Преимущество: бросок 2d20, берётся максимальный результат"
          >
            ▲ Преимущество
          </button>

          <button
            type="button"
            onClick={() => { setDisadvantage(prev => !prev); setAdvantage(false); }}
            className={`px-2.5 py-1 rounded-lg font-mono text-[11px] font-bold transition-all ${
              disadvantage
                ? 'bg-rose-600 text-white shadow-sm'
                : 'text-rose-400 hover:bg-rose-950/40'
            }`}
            title="Помеха: бросок 2d20, берётся минимальный результат"
          >
            ▼ Помеха
          </button>
        </div>
      </div>

      {/* Target Enemy Selector if Attack Mode */}
      {actionType === 'attack' && livingEnemies.length > 0 && (
        <div className="flex items-center gap-2 p-2.5 bg-red-950/20 border border-red-500/30 rounded-xl text-xs">
          <Crosshair className="w-4 h-4 text-red-400 shrink-0" />
          <span className="text-red-300 font-bold shrink-0">Цель атаки:</span>
          <select
            value={targetEnemyId}
            onChange={(e) => setTargetEnemyId(e.target.value)}
            className="flex-1 bg-slate-900 border border-red-500/40 rounded-lg px-3 py-1.5 text-xs text-slate-100 font-mono focus:outline-none focus:border-red-400"
          >
            {livingEnemies.map(enemy => (
              <option key={enemy.id} value={enemy.id}>
                {enemy.name} (КБ {enemy.ac || 12} | HP {enemy.hpCurrent}/{enemy.hpMax}) {enemy.status ? `— ${enemy.status}` : ''}
              </option>
            ))}
          </select>
          {targetEnemy && (
            <span className="px-2 py-1 rounded bg-slate-900 border border-slate-700 text-blue-300 font-mono font-bold text-xs" title="Класс брони цели">
              КБ: {targetEnemy.ac || 12}
            </span>
          )}
        </div>
      )}

      {/* Spell Slot Selector if character is a caster */}
      {character?.spellSlots && Object.values(character.spellSlots).some(s => s.max > 0) && (
        <div className="flex items-center gap-2 p-2 bg-purple-950/20 border border-purple-800/30 rounded-xl text-xs">
          <Zap className="w-3.5 h-3.5 text-purple-400 shrink-0" />
          <span className="text-purple-300 font-semibold shrink-0">Ячейка заклинания:</span>
          <select
            value={selectedSpellLevel}
            onChange={(e) => setSelectedSpellLevel(Number(e.target.value))}
            className="bg-slate-900 border border-purple-700/50 rounded-lg px-2.5 py-1 text-xs text-purple-200 font-mono focus:outline-none"
          >
            <option value={0}>Без траты ячейки (заговор / обычное действие)</option>
            {Object.entries(character.spellSlots).map(([lvl, slot]) => (
              <option key={lvl} value={Number(lvl)} disabled={slot.current <= 0}>
                {lvl} круг ({slot.current}/{slot.max} доступно) {slot.current <= 0 ? '— исчерпано' : ''}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Target DC & Situation Banner */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 bg-amber-500/10 border border-amber-500/25 rounded-xl">
        <div className="flex items-center gap-2 text-xs">
          <ShieldAlert className="w-4 h-4 text-amber-400 flex-shrink-0" />
          <span className="text-amber-200 font-semibold font-rpg tracking-wide">
            {actionType === 'attack' && targetEnemy ? (
              <>
                КЛАСС БРОНИ ЦЕЛИ (КБ): <strong className="text-red-400 text-sm font-mono">{targetEnemy.ac || 12}</strong>
              </>
            ) : (
              <>
                СЛОЖНОСТЬ (СЛ): <strong className="text-amber-400 text-sm font-mono">{targetDC}</strong>
              </>
            )}
          </span>
          {statLabel && actionType !== 'attack' && (
            <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
              Проверка: {statLabel}
            </span>
          )}
          {dcReason && (
            <span className="text-slate-400 text-[11px] hidden sm:inline">
              — {dcReason}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5 text-[11px] font-semibold">
          {hasD20Roll ? (
            <span className="text-emerald-400 flex items-center gap-1 bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 rounded-lg">
              ✓ Бросок d20 выполнен
            </span>
          ) : (
            <span className="text-amber-400 flex items-center gap-1 bg-amber-500/15 border border-amber-500/30 px-2 py-0.5 rounded-lg">
              ⚠️ Обязателен бросок d20
            </span>
          )}
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        {/* Tactical Situation Prompt */}
        <div className="text-xs text-amber-300/90 font-medium flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
          <span>{currentSituation || 'Что предпринимает ваш герой?'}</span>
        </div>

        {/* Attached Dice Badges with Target DC comparison */}
        <AttachedRollsBar rolls={attachedRolls} targetDC={effectiveTargetDC} onRemoveRoll={onRemoveRoll} />

        {/* Action Input & Action Buttons */}
        <div className="flex gap-2">
          <textarea
            rows={2}
            value={actionText}
            onChange={e => setActionText(e.target.value)}
            placeholder={
              actionType === 'attack' && targetEnemy
                ? `Опишите атаку по ${targetEnemy.name} (оружие, выстрел или заклинание)...`
                : "Опишите ваши действия (персонаж может использовать предметы инвентаря или окружения)..."
            }
            className="flex-1 px-4 py-2.5 bg-fantasy-panel border border-fantasy-border rounded-xl text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-500 resize-none"
          />

          <div className="flex flex-col gap-2">
            {hasD20Roll ? (
              <button
                type="button"
                disabled
                className="px-4 py-2 border font-bold text-xs font-rpg rounded-xl flex items-center justify-center gap-1.5 shadow-sm bg-emerald-500/15 border-emerald-500/40 text-emerald-400 cursor-default"
                title="Бросок d20 зафиксирован на этот раунд"
              >
                ✓ Бросок сделан
              </button>
            ) : (
              <button
                type="button"
                onClick={handleOpenDiceModal}
                disabled={isDMThinking}
                className="px-4 py-2 border font-bold text-xs font-rpg rounded-xl transition-all flex items-center justify-center gap-1.5 shadow-sm bg-amber-500/20 hover:bg-amber-500/30 border-amber-500/50 text-amber-300 animate-pulse"
                title="Обязательный бросок d20 перед ходом"
              >
                <Dices className="w-4 h-4 text-amber-400" />
                Бросить d20
              </button>
            )}

            <button
              type="submit"
              disabled={isDMThinking || !hasD20Roll}
              className="px-5 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black font-bold font-rpg text-xs rounded-xl shadow-lg shadow-amber-500/20 transition-all flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
              title={!hasD20Roll ? 'Сначала сделайте бросок d20' : 'Отправить ход'}
            >
              <Send className="w-3.5 h-3.5" />
              Ход
            </button>
          </div>
        </div>

        {/* Quick Inventory Summary / Hint */}
        {character && character.inventory && (
          <div className="flex items-center justify-between text-[10px] text-slate-400 px-1">
            <span className="flex items-center gap-1">
              <Package className="w-3 h-3 text-amber-400/80" />
              Доступно в инвентаре: {character.inventory.map(i => i.name).slice(0, 4).join(', ')}{character.inventory.length > 4 ? '...' : ''}
            </span>
            <span className="text-slate-500">Инвентарь + любые логичные предметы сцены (столы, факелы и т.д.)</span>
          </div>
        )}

        {/* Quick Action Suggestion Buttons */}
        <QuickActionButtons character={character} onSelectAction={handleSelectQuickAction} />
      </form>
    </div>
  );
};
