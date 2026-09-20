import React, { useState } from 'react';
import { Character, DiceRollResult, RoomEnemy, ActionRejectedEvent } from '../../types';
import { Dices, Send, Clock, Skull, AlertTriangle, Shield, Swords, Sparkles, CheckCircle2 } from 'lucide-react';

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
  rejectedAction?: ActionRejectedEvent | null;
  onRemoveRoll: (index: number) => void;
  onOpenDiceModal: (opts?: { defaultPurpose?: string; defaultAdvantage?: boolean; defaultDisadvantage?: boolean; defaultStatKey?: string }) => void;
  onSubmit: (actionText: string, meta?: ActionMeta) => void;
  onRollDeathSave?: (rollResult: { rollTotal: number; isNat20: boolean; isNat1: boolean }) => void;
}

const STAT_LABELS: Record<string, string> = {
  str: 'СИЛ',
  dex: 'ЛОВ',
  con: 'ТЕЛ',
  int: 'ИНТ',
  wis: 'МУД',
  cha: 'ХАР',
};

export const ActionConsole: React.FC<ActionConsoleProps> = ({
  hasCharacter,
  hasSubmittedThisRound,
  isDMThinking,
  currentSituation,
  targetDC = 12,
  dcReason,
  requiredCheckStat = 'dex',
  isMyTurn = true,
  activePlayerName,
  turnMode = 'simultaneous',
  character,
  attachedRolls,
  lastDeathSaveMessage,
  activeEnemies = [],
  rejectedAction,
  onOpenDiceModal,
  onSubmit,
  onRollDeathSave,
}) => {
  const [actionText, setActionText] = useState('');

  const livingEnemies = activeEnemies.filter(e => !e.isDead && e.hpCurrent > 0);
  const primaryEnemy = livingEnemies[0];
  const d20Roll = attachedRolls.find(r => r.diceType.toLowerCase() === 'd20');

  const statShort = STAT_LABELS[requiredCheckStat.toLowerCase()] || requiredCheckStat.toUpperCase();

  const handleOpenDice = () => {
    onOpenDiceModal({
      defaultPurpose: `Проверка характеристики (${statShort})`,
      defaultStatKey: requiredCheckStat,
    });
  };

  const handleSuggestionClick = (suggestion: string) => {
    setActionText(prev => (prev ? `${prev}. ${suggestion}` : suggestion));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!d20Roll) {
      alert('Перед завершением хода необходимо совершить бросок кубика d20 для проверки действия!');
      handleOpenDice();
      return;
    }

    if (!actionText.trim()) {
      alert('Опишите действие вашего персонажа!');
      return;
    }

    // Auto-detect action type and target from player text under the hood
    const textLower = actionText.toLowerCase();
    const isAttack = textLower.includes('атак') || textLower.includes('удар') || textLower.includes('стрел') || textLower.includes('рубл') || textLower.includes('выстрел');
    const isSpell = textLower.includes('заклин') || textLower.includes('маги') || textLower.includes('свит');

    const meta: ActionMeta = {
      actionType: isAttack ? 'attack' : isSpell ? 'improvise' : 'check',
      targetEnemyId: isAttack && primaryEnemy ? primaryEnemy.id : undefined,
      targetEnemyName: isAttack && primaryEnemy ? primaryEnemy.name : undefined,
    };

    onSubmit(actionText, meta);
    setActionText('');
  };

  const handleDeathSaveClick = () => {
    if (!onRollDeathSave) return;
    const d20 = Math.floor(Math.random() * 20) + 1;
    onRollDeathSave({
      rollTotal: d20,
      isNat20: d20 === 20,
      isNat1: d20 === 1,
    });
  };

  if (!hasCharacter) {
    return (
      <div className="p-3 bg-fantasy-card border-t border-fantasy-border text-center text-xs text-slate-400">
        Выберите персонажа в лобби комнаты, чтобы участвовать в приключении.
      </div>
    );
  }

  // 1. Character DEAD
  if (character?.lifeState === 'dead') {
    return (
      <div className="p-3 bg-red-950/60 border-t border-red-500/40 text-center space-y-1">
        <div className="flex items-center justify-center gap-2 text-red-400 font-rpg font-bold text-xs tracking-wide">
          <Skull className="w-4 h-4 text-red-400 animate-pulse" />
          <span>Герой пал на поле боя</span>
        </div>
        <p className="text-[11px] text-slate-300">
          3 провала спасбросков от смерти. Ожидайте воскрешения или исхода похода отряда.
        </p>
      </div>
    );
  }

  // 2. Character DOWNED (0 HP)
  if (character?.lifeState === 'downed') {
    const saves = character.deathSaves || { successes: 0, failures: 0, isStable: false };

    return (
      <div className="p-3 bg-rose-950/50 border-t border-rose-500/40 space-y-2">
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-1.5 text-rose-400 font-bold font-rpg">
            <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
            <span>0 HP — Спасбросок от смерти</span>
          </div>
          <div className="flex items-center gap-3 font-mono font-bold text-[11px]">
            <span className="text-emerald-400">Успехи: {saves.successes}/3</span>
            <span className="text-rose-400">Провалы: {saves.failures}/3</span>
          </div>
        </div>

        {lastDeathSaveMessage && (
          <p className="text-[11px] text-amber-300 italic bg-black/40 px-2.5 py-1 rounded-lg border border-rose-500/20">
            {lastDeathSaveMessage}
          </p>
        )}

        <div className="flex items-center justify-between gap-2 pt-1">
          <span className="text-[11px] text-slate-300">10+ успех, 2-9 провал, 20 оживление с 1 HP</span>
          <button
            type="button"
            onClick={handleDeathSaveClick}
            className="px-4 py-1.5 bg-rose-600 hover:bg-rose-500 text-white font-bold font-rpg text-xs rounded-xl shadow transition-all flex items-center gap-1.5"
          >
            <Dices className="w-3.5 h-3.5" /> Бросить d20
          </button>
        </div>
      </div>
    );
  }

  // 3. Submitted this round
  if (hasSubmittedThisRound) {
    return (
      <div className="p-3 bg-fantasy-card/95 border-t border-fantasy-border flex items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2 text-amber-300">
          <Clock className="w-4 h-4 text-amber-400 animate-spin" />
          <span>
            {isDMThinking
              ? 'Мастер Подземелий обдумывает исход раунда...'
              : 'Действие принято! Ожидание остальных искателей приключений...'}
          </span>
        </div>
      </div>
    );
  }

  // 4. Turn-by-turn wait
  if (turnMode === 'turn_by_turn' && !isMyTurn) {
    return (
      <div className="p-3 bg-fantasy-card/95 border-t border-fantasy-border flex items-center gap-2 text-xs text-amber-300">
        <Clock className="w-4 h-4 text-amber-400 animate-spin" />
        <span>
          Ходит: <strong className="text-amber-400">{activePlayerName || 'Соратник'}</strong>... Ожидайте своей очереди.
        </span>
      </div>
    );
  }

  // 5. Active Action Console (Compact, High-Efficiency Dock)
  return (
    <div className="p-2.5 sm:p-3 bg-slate-950/95 border-t border-fantasy-border space-y-2">
      {/* Rejection Alert Banner if DM rejected turn */}
      {rejectedAction && (
        <div className="px-3 py-1.5 rounded-xl bg-red-950/70 border border-red-500/50 flex items-center gap-2 text-xs text-red-200 animate-in fade-in">
          <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
          <div className="flex-1 leading-tight">
            <span className="font-bold text-red-400">Ход отклонен Мастером: </span>
            <span>{rejectedAction.reason}</span>
          </div>
        </div>
      )}

      {/* Current Situation Context Banner */}
      {currentSituation && (
        <div className="px-2.5 py-1 rounded-lg bg-amber-950/30 border border-amber-500/20 text-[11px] text-slate-300 flex items-center gap-1.5 overflow-hidden">
          <span className="font-bold text-amber-400 font-rpg uppercase text-[10px] shrink-0">Обстановка:</span>
          <span className="truncate italic text-slate-200">{currentSituation}</span>
        </div>
      )}

      {/* Suggestion Chips & DC indicator Row */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-1.5 overflow-x-auto custom-scrollbar text-[11px] py-0.5">
          <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Подсказки:</span>
          {primaryEnemy && (
            <button
              type="button"
              onClick={() => handleSuggestionClick(`Атакую ${primaryEnemy.name}`)}
              className="px-2 py-0.5 rounded-full bg-red-950/40 text-red-300 border border-red-800/40 hover:bg-red-900/50 transition-colors flex items-center gap-1 shrink-0"
            >
              <Swords className="w-2.5 h-2.5" />
              <span>Атака ({primaryEnemy.name})</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => handleSuggestionClick('Ищу укрытие от врагов')}
            className="px-2 py-0.5 rounded-full bg-slate-800/80 text-slate-300 border border-slate-700 hover:bg-slate-700 transition-colors flex items-center gap-1 shrink-0"
          >
            <Shield className="w-2.5 h-2.5" />
            <span>Укрыться</span>
          </button>
          <button
            type="button"
            onClick={() => handleSuggestionClick('Использую заклинание')}
            className="px-2 py-0.5 rounded-full bg-purple-950/40 text-purple-300 border border-purple-800/40 hover:bg-purple-900/50 transition-colors flex items-center gap-1 shrink-0"
          >
            <Sparkles className="w-2.5 h-2.5" />
            <span>Заклинание</span>
          </button>
          <button
            type="button"
            onClick={() => handleSuggestionClick('Опрокидываю стол и импровизирую')}
            className="px-2 py-0.5 rounded-full bg-amber-950/40 text-amber-300 border border-amber-800/40 hover:bg-amber-900/50 transition-colors shrink-0"
          >
            🤸 Окружение
          </button>
        </div>

        {/* Challenge DC badge */}
        <div className="text-[10px] font-mono text-slate-400 flex items-center gap-1 shrink-0">
          <span className="text-amber-400 font-bold">СЛ {targetDC}</span>
          <span className="text-slate-500">[{statShort}]</span>
          {dcReason && <span className="text-slate-500 hidden sm:inline">• {dcReason}</span>}
        </div>
      </div>

      {/* Main Console Input Row */}
      <form onSubmit={handleSubmit} className="flex items-center gap-2">
        {/* Dice roll button / result chip */}
        {d20Roll ? (
          <button
            type="button"
            onClick={handleOpenDice}
            className="px-3 py-2 rounded-xl bg-amber-500/20 border border-amber-400 text-amber-300 font-mono text-xs font-bold flex items-center gap-1.5 shadow-glow-gold transition-all shrink-0"
            title="Бросок d20 совершен. Нажмите для повторного просмотра."
          >
            <CheckCircle2 className="w-3.5 h-3.5 text-amber-400" />
            <span>d20: {d20Roll.total}</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={handleOpenDice}
            className="px-3 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black font-rpg text-xs font-bold flex items-center gap-1.5 shadow-md shadow-amber-500/20 transition-all shrink-0"
            title="Бросить d20 против проверки мастера"
          >
            <Dices className="w-4 h-4" />
            <span>Бросить d20 [{statShort}]</span>
          </button>
        )}

        {/* Natural Language Action Input */}
        <div className="flex-1 relative min-w-0">
          <input
            type="text"
            value={actionText}
            onChange={(e) => setActionText(e.target.value)}
            placeholder="Шаг 2: Опишите действие героя (свободная тактика, диалог, укрытие, трюк, магия)..."
            className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs sm:text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400/30"
          />
        </div>

        {/* Submit Turn Button */}
        <button
          type="submit"
          disabled={!d20Roll || !actionText.trim()}
          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-600 text-white font-rpg text-xs font-bold rounded-xl shadow-md transition-all flex items-center gap-1.5 shrink-0"
        >
          <Send className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Ход</span>
        </button>
      </form>
    </div>
  );
};
