import React, { useState } from 'react';
import { Character, DiceRollResult, RoomEnemy, ActionRejectedEvent } from '../../types';
import { Dices, Send, Clock, Skull, AlertTriangle, Shield, Swords, Sparkles, CheckCircle2, ShieldAlert, Lock } from 'lucide-react';

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
  pendingReactionNames?: string[];
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
  pendingReactionNames = [],
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
    if (!actionText.trim()) {
      alert('Сначала опишите задуманное действие вашего персонажа, а затем бросьте кубик!');
      return;
    }
    onOpenDiceModal({
      defaultPurpose: `Проверка характеристики (${statShort}): ${actionText.trim().slice(0, 40)}`,
      defaultStatKey: requiredCheckStat,
    });
  };

  const handleSuggestionClick = (suggestion: string) => {
    if (d20Roll) return;
    setActionText(prev => (prev ? `${prev}. ${suggestion}` : suggestion));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!actionText.trim()) {
      alert('Опишите задуманное действие вашего персонажа!');
      return;
    }
    if (!d20Roll) {
      alert('Действие описано! Теперь совершите бросок кубика d20 для проверки действия.');
      handleOpenDice();
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
    const isWaitingForReactions = pendingReactionNames && pendingReactionNames.length > 0;

    return (
      <div className="p-3 bg-fantasy-card/95 border-t border-fantasy-border flex items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2 text-amber-300">
          <Clock className="w-4 h-4 text-amber-400 animate-spin" />
          <span>
            {isWaitingForReactions
              ? `⏳ Ожидание реакции соратника (${pendingReactionNames.join(', ')}) на совместное действие...`
              : isDMThinking
              ? (turnMode === 'turn_by_turn' ? 'Мастер Подземелий описывает последствия вашего хода...' : 'Мастер Подземелий обдумывает исход раунда...')
              : (turnMode === 'turn_by_turn' ? 'Ваш ход совершен! Ожидание других героев...' : 'Действие принято! Ожидание остальных искателей приключений...')}
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
          {isDMThinking
            ? `Мастер Подземелий описывает исход хода игрока (${activePlayerName || 'Соратник'})...`
            : <>Ходит: <strong className="text-amber-400">{activePlayerName || 'Соратник'}</strong>... Ожидайте своей очереди.</>}
        </span>
      </div>
    );
  }

  // 5. Active Action Console (Sir Brante "Book of Decisions" aesthetic)
  return (
    <div className="p-3 sm:p-4 bg-[#11131a] border-t border-[#2a303d] space-y-3">
      {/* Rejection Alert Banner if DM rejected turn */}
      {rejectedAction && (
        <div className="px-3.5 py-2 rounded-lg bg-[#281418] border border-[#69252c] flex items-center gap-2.5 text-xs text-[#fca5a5] animate-in fade-in font-serif">
          <AlertTriangle className="w-4 h-4 text-[#f87171] shrink-0" />
          <div className="flex-1 leading-snug">
            <span className="font-bold text-[#f87171]">Мастер отклонил заявку: </span>
            <span>{rejectedAction.reason}</span>
          </div>
        </div>
      )}

      {/* Decision Header: Challenge DC & Stat requirement */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#28251e] pb-2.5">
        <div className="flex items-center gap-2 text-xs sm:text-sm font-rpg text-[#ded7c8]">
          <span className="text-[#facc15] font-extrabold tracking-wide flex items-center gap-1.5">
            <span className="text-base">🎯</span>
            <span>ИСПЫТАНИЕ РАУНДА:</span>
          </span>
          <span className="px-2.5 py-0.5 rounded bg-[#1f1a12] border-2 border-[#f59e0b] text-[#fef08a] font-mono font-extrabold text-xs shadow-sm">
            СЛ {targetDC} [{statShort}]
          </span>
          {dcReason && (
            <span className="text-[#c5a059] italic font-serif hidden sm:inline">
              — {dcReason}
            </span>
          )}
        </div>
        <div className="text-xs font-serif text-[#968e7f] flex items-center gap-1">
          {d20Roll ? (
            <span className="text-[#86efac] font-bold">✓ Шаг 2: Подтверждение хода</span>
          ) : (
            <span className="text-[#facc15]">Шаг 1: Выберите намерение и бросьте d20</span>
          )}
        </div>
      </div>

      {/* Video Game Action Choices with intuitive colors and emojis */}
      {!d20Roll && (
        <div className="space-y-1.5">
          <div className="flex items-center gap-1.5 text-xs font-rpg text-[#c5a059] font-bold uppercase tracking-wider">
            <span>⚔️ Возможные действия героя:</span>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs font-serif">
            {livingEnemies.length === 0 ? (
              <>
                <button
                  type="button"
                  onClick={() => handleSuggestionClick('Вступаю в разговор и расспрашиваю')}
                  className="px-3 py-1.5 rounded-lg bg-gradient-to-b from-[#17253d] to-[#0f192b] hover:from-[#23385c] hover:to-[#17263e] text-[#93c5fd] hover:text-white border border-[#3b82f6]/60 hover:border-[#60a5fa] font-bold transition-all shadow-md flex items-center gap-1.5 active:translate-y-0.5"
                >
                  <span className="text-sm">💬</span>
                  <span>I. Диалог и расспрос</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleSuggestionClick('Внимательно осматриваю местность и ищу зацепки')}
                  className="px-3 py-1.5 rounded-lg bg-gradient-to-b from-[#2d2212] to-[#1e160a] hover:from-[#42321a] hover:to-[#2b1f0e] text-[#fde047] hover:text-white border border-[#eab308]/60 hover:border-[#facc15] font-bold transition-all shadow-md flex items-center gap-1.5 active:translate-y-0.5"
                >
                  <span className="text-sm">👁️</span>
                  <span>II. Осмотр местности</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleSuggestionClick('Предлагаю помощь или торговлю')}
                  className="px-3 py-1.5 rounded-lg bg-gradient-to-b from-[#14291c] to-[#0c1c12] hover:from-[#1e3d2a] hover:to-[#132d1d] text-[#86efac] hover:text-white border border-[#22c55e]/60 hover:border-[#4ade80] font-bold transition-all shadow-md flex items-center gap-1.5 active:translate-y-0.5"
                >
                  <span className="text-sm">🤝</span>
                  <span>III. Помощь или сделка</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleSuggestionClick('Использую заклинание или трюк')}
                  className="px-3 py-1.5 rounded-lg bg-gradient-to-b from-[#251533] to-[#190c24] hover:from-[#3a204f] hover:to-[#261338] text-[#d8b4fe] hover:text-white border border-[#a855f7]/60 hover:border-[#c084fc] font-bold transition-all shadow-md flex items-center gap-1.5 active:translate-y-0.5"
                >
                  <span className="text-sm">✨</span>
                  <span>IV. Магический трюк</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleSuggestionClick('Продолжаем путь по тракту')}
                  className="px-3 py-1.5 rounded-lg bg-gradient-to-b from-[#1e2330] to-[#121620] hover:from-[#2c3345] hover:to-[#1c2230] text-[#ded7c8] hover:text-white border border-[#64748b]/60 hover:border-[#94a3b8] font-bold transition-all shadow-md flex items-center gap-1.5 active:translate-y-0.5"
                >
                  <span className="text-sm">🏃</span>
                  <span>V. Следовать в путь</span>
                </button>
              </>
            ) : (
              <>
                {primaryEnemy && (
                  <button
                    type="button"
                    onClick={() => handleSuggestionClick(`Атакую ${primaryEnemy.name}`)}
                    className="px-3.5 py-1.5 rounded-lg bg-gradient-to-b from-[#3b1217] to-[#26090d] hover:from-[#521920] hover:to-[#380e14] text-[#fca5a5] hover:text-white border-2 border-[#ef4444]/70 hover:border-[#f87171] font-bold transition-all shadow-md flex items-center gap-1.5 active:translate-y-0.5"
                  >
                    <span className="text-sm">⚔️</span>
                    <span>Атаковать ({primaryEnemy.name})</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => handleSuggestionClick('Ищу надежное укрытие от вражеских атак')}
                  className="px-3 py-1.5 rounded-lg bg-gradient-to-b from-[#17253d] to-[#0f192b] hover:from-[#23385c] hover:to-[#17263e] text-[#93c5fd] hover:text-white border border-[#3b82f6]/60 hover:border-[#60a5fa] font-bold transition-all shadow-md flex items-center gap-1.5 active:translate-y-0.5"
                >
                  <span className="text-sm">🛡️</span>
                  <span>Укрыться в оборону</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleSuggestionClick('Сотворяю боевое заклинание')}
                  className="px-3 py-1.5 rounded-lg bg-gradient-to-b from-[#251533] to-[#190c24] hover:from-[#3a204f] hover:to-[#261338] text-[#d8b4fe] hover:text-white border border-[#a855f7]/60 hover:border-[#c084fc] font-bold transition-all shadow-md flex items-center gap-1.5 active:translate-y-0.5"
                >
                  <span className="text-sm">✨</span>
                  <span>Боевое заклинание</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleSuggestionClick('Использую элементы окружения и импровизирую')}
                  className="px-3 py-1.5 rounded-lg bg-gradient-to-b from-[#2d2212] to-[#1e160a] hover:from-[#42321a] hover:to-[#2b1f0e] text-[#fde047] hover:text-white border border-[#eab308]/60 hover:border-[#facc15] font-bold transition-all shadow-md flex items-center gap-1.5 active:translate-y-0.5"
                >
                  <span className="text-sm">🎯</span>
                  <span>Окружение и трюк</span>
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Outcome Banner if d20 is already rolled */}
      {d20Roll && (() => {
        const isCritSuccess = !!d20Roll.isCriticalSuccess;
        const isCritFail = !!d20Roll.isCriticalFail;
        const isSuccess = !isCritFail && (isCritSuccess || (targetDC !== undefined && d20Roll.total >= targetDC));
        const rawDie = d20Roll.baseRoll || (d20Roll.rolls && d20Roll.rolls.length > 0 ? d20Roll.rolls[0] : d20Roll.total);

        return (
          <div
            className={`p-3 rounded-xl border-2 text-sm font-serif flex items-center justify-between gap-3 shadow-lg animate-in fade-in ${
              isCritSuccess
                ? 'bg-gradient-to-r from-[#3d2c14] to-[#251b0a] border-[#f59e0b] text-[#fef08a]'
                : isCritFail
                ? 'bg-gradient-to-r from-[#3d1217] to-[#260a0e] border-[#ef4444] text-[#fca5a5]'
                : isSuccess
                ? 'bg-gradient-to-r from-[#143320] to-[#0c2114] border-[#22c55e] text-[#86efac]'
                : 'bg-gradient-to-r from-[#351419] to-[#210c0f] border-[#f43f5e] text-[#fca5a5]'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <span className="text-xl">
                {isCritSuccess ? '🌟' : isCritFail ? '☠️' : isSuccess ? '✅' : '❌'}
              </span>
              <div>
                <span className="font-extrabold font-rpg tracking-wide text-base">
                  {isCritSuccess ? 'ТРИУМФ (КРИТ. УСПЕХ)' : isCritFail ? 'РОКОВОЙ ПРОВАЛ' : isSuccess ? 'УСПЕШНОЕ ДЕЙСТВИЕ' : 'НЕУДАЧА'}
                </span>
                <span className="ml-2.5 font-mono text-xs font-bold opacity-90">
                  (Итог: {d20Roll.total} против СЛ {targetDC})
                </span>
              </div>
            </div>
            <div className="text-xs font-mono font-bold text-right opacity-90 hidden sm:block">
              d20 [{rawDie}] {d20Roll.modifier !== undefined ? (d20Roll.modifier >= 0 ? `+ ${d20Roll.modifier}` : `- ${Math.abs(d20Roll.modifier)}`) : ''}
            </div>
          </div>
        );
      })()}

      {/* Main Console Form */}
      <form onSubmit={handleSubmit} className="space-y-2.5">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
          {/* Action Input Field */}
          <div className="flex-1 relative">
            <input
              type="text"
              value={actionText}
              onChange={(e) => {
                if (!d20Roll) setActionText(e.target.value);
              }}
              readOnly={!!d20Roll}
              placeholder={
                d20Roll
                  ? "Действие скреплено броском кубика"
                  : livingEnemies.length > 0
                  ? "Опишите задуманное действие героя (атака, укрытие, магия, трюк)..."
                  : "Опишите задуманное действие героя (диалог, осмотр, сделка, помощь, путь)..."
              }
              className={`w-full py-3 px-4 border-2 rounded-xl text-sm sm:text-base font-serif transition-all ${
                d20Roll
                  ? 'bg-[#0b0d13] border-[#785e2b] text-[#fef08a] cursor-not-allowed pl-10 shadow-inner'
                  : 'bg-[#090b10] border-[#3a3528] text-[#fef8ed] placeholder-[#787163] focus:outline-none focus:border-[#facc15] shadow-inner'
              }`}
            />
            {d20Roll && (
              <Lock className="w-4 h-4 text-[#facc15] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            )}
          </div>

          {/* Action Button: Step 1 (Roll d20) -> Step 2 (Submit Move) */}
          {!d20Roll ? (
            <button
              type="button"
              onClick={handleOpenDice}
              className="game-btn-gold px-6 py-3 rounded-xl text-sm font-rpg font-extrabold uppercase tracking-wider flex items-center justify-center gap-2 shrink-0 shadow-lg"
              title="Бросить кубик d20 для проверки задуманного действия"
            >
              <span className="text-base">🎲</span>
              <span>БРОСИТЬ КУБИК D20</span>
            </button>
          ) : (
            <button
              type="submit"
              disabled={!actionText.trim()}
              className="game-btn-emerald px-6 py-3 rounded-xl text-sm font-rpg font-extrabold uppercase tracking-wider flex items-center justify-center gap-2 shrink-0 shadow-lg animate-pulse"
              title="Отправить готовый ход Мастеру Подземелий"
            >
              <span className="text-base">📜</span>
              <span>СДЕЛАТЬ ХОД</span>
            </button>
          )}
        </div>

        {/* Informative Guidance Line */}
        <div className="flex flex-wrap items-center justify-between text-[11px] font-serif text-[#968e7f] px-0.5 pt-0.5">
          {d20Roll ? (
            <span className="text-[#c5a059]">
              ✓ Бросок выполнен и зафиксирован. Нажмите «Сделать ход» для передачи заявки Мастеру.
            </span>
          ) : (
            <span>
              Шаг 1: введите действие героя, затем нажмите «Бросить кубик d20».
            </span>
          )}
          <span className="text-[#6e675b] font-mono text-[10px]">
            1 ход в раунд
          </span>
        </div>
      </form>
    </div>
  );
};
