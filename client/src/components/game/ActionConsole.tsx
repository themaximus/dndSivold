import React, { useState } from 'react';
import { Character, DiceRollResult } from '../../types';
import { Sparkles, Dices, Send, Clock, ShieldAlert, Skull, Package } from 'lucide-react';
import { AttachedRollsBar } from './AttachedRollsBar';
import { QuickActionButtons } from './QuickActionButtons';

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
  onRemoveRoll: (index: number) => void;
  onOpenDiceModal: () => void;
  onSubmit: (actionText: string) => void;
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
  onRemoveRoll,
  onOpenDiceModal,
  onSubmit,
  onRollDeathSave,
}) => {
  const [actionText, setActionText] = useState('');

  const hasD20Roll = attachedRolls.some(r => r.diceType.toLowerCase() === 'd20');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!hasD20Roll) {
      alert('Перед завершением хода необходимо бросить d20 для проверки успеха против СЛ мастера!');
      onOpenDiceModal();
      return;
    }

    if (!actionText.trim() && attachedRolls.length === 0) {
      alert('Опишите ваше действие или совершите бросок кубика!');
      return;
    }
    onSubmit(actionText);
    setActionText('');
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
      {/* Target DC & Situation Banner */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 bg-amber-500/10 border border-amber-500/25 rounded-xl">
        <div className="flex items-center gap-2 text-xs">
          <ShieldAlert className="w-4 h-4 text-amber-400 flex-shrink-0" />
          <span className="text-amber-200 font-semibold font-rpg tracking-wide">
            СЛОЖНОСТЬ (СЛ): <strong className="text-amber-400 text-sm font-mono">{targetDC}</strong>
          </span>
          {statLabel && (
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

        {/* Attached Dice Badges with DC comparison */}
        <AttachedRollsBar rolls={attachedRolls} targetDC={targetDC} onRemoveRoll={onRemoveRoll} />

        {/* Action Input & Action Buttons */}
        <div className="flex gap-2">
          <textarea
            rows={2}
            value={actionText}
            onChange={e => setActionText(e.target.value)}
            placeholder="Опишите ваши действия (персонаж может использовать только то, что есть в его инвентаре или в руках)..."
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
                onClick={onOpenDiceModal}
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
            <span className="text-slate-500">Инвентарь + любые логичные предметы окружения (столы, факелы и т.д.)</span>
          </div>
        )}

        {/* Quick Action Suggestion Buttons */}
        <QuickActionButtons character={character} onSelectAction={handleSelectQuickAction} />
      </form>
    </div>
  );
};
