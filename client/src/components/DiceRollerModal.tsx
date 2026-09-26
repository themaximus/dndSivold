import React, { useState } from 'react';
import { Character, DiceRollResult } from '../types';
import { getSocket } from '../services/socket';
import { soundFx } from '../utils/audio';
import confetti from 'canvas-confetti';
import { Dices, Sparkles, X, ShieldAlert, Check, CheckCircle2, XCircle } from 'lucide-react';
import { ThreeD20Die } from './game/ThreeD20Die';

interface DiceRollerModalProps {
  roomCode: string;
  character?: Character;
  defaultStatKey?: string;
  targetDC?: number;
  initialPurpose?: string;
  initialAdvantage?: boolean;
  initialDisadvantage?: boolean;
  advantageReason?: string;
  disadvantageReason?: string;
  isMutualCancel?: boolean;
  onClose: () => void;
  onRollComplete: (roll: DiceRollResult) => void;
}

export const DiceRollerModal: React.FC<DiceRollerModalProps> = ({
  roomCode,
  character,
  defaultStatKey,
  targetDC,
  initialPurpose,
  initialAdvantage = false,
  initialDisadvantage = false,
  advantageReason,
  disadvantageReason,
  isMutualCancel = false,
  onClose,
  onRollComplete,
}) => {
  const statKey = defaultStatKey ? defaultStatKey.toLowerCase() : 'dex';
  const [purpose] = useState(initialPurpose || '');
  const advantage = !isMutualCancel && initialAdvantage;
  const disadvantage = !isMutualCancel && initialDisadvantage;
  const [isRolling, setIsRolling] = useState(false);
  const [lastRoll, setLastRoll] = useState<DiceRollResult | null>(null);
  const [pendingDie, setPendingDie] = useState<number | null>(null);

  const stats = character?.stats || { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 };
  const calcMod = (val: number) => Math.floor((val - 10) / 2);

  const handleRoll = () => {
    if (isRolling || lastRoll) return;
    setIsRolling(true);
    soundFx.playDiceRoll();

    const socket = getSocket();

    const handleResult = (result: DiceRollResult) => {
      // Determine the exact d20 face value (1-20)
      const dieFace = result.baseRoll || (result.rolls && result.rolls.length > 0 ? result.rolls[0] : result.total);
      setPendingDie(dieFace);

      // Allow 3D tumble for 1.1s before settling on the exact target number
      setTimeout(() => {
        setIsRolling(false);
        setLastRoll(result);

        if (result.isCriticalSuccess) {
          soundFx.playCriticalSuccess();
          confetti({
            particleCount: 70,
            spread: 80,
            origin: { y: 0.6 },
          });
        } else if (result.isCriticalFail) {
          soundFx.playCriticalFail();
        } else if (targetDC && result.total >= targetDC) {
          confetti({
            particleCount: 40,
            spread: 60,
            origin: { y: 0.65 },
          });
        }
      }, 1100);

      socket.off('your_dice_result', handleResult);
      socket.off('dice_roll_rejected', handleRejected);
    };

    const handleRejected = (data: { message: string }) => {
      setIsRolling(false);
      alert(data.message || 'Вы уже совершили бросок в этом раунде!');
      socket.off('your_dice_result', handleResult);
      socket.off('dice_roll_rejected', handleRejected);
      onClose();
    };

    socket.on('your_dice_result', handleResult);
    socket.on('dice_roll_rejected', handleRejected);

    socket.emit('roll_dice', {
      roomCode,
      request: {
        diceType: 'd20',
        statKey,
        purpose: purpose || 'Проверка характеристики',
        advantage,
        disadvantage,
      },
    });

    // Timeout fallback
    setTimeout(() => {
      if (isRolling) {
        setIsRolling(false);
        socket.off('your_dice_result', handleResult);
        socket.off('dice_roll_rejected', handleRejected);
      }
    }, 4500);
  };

  const confirmRoll = () => {
    if (lastRoll) {
      onRollComplete(lastRoll);
      onClose();
    }
  };

  const handleClose = () => {
    if (isRolling) return;
    if (lastRoll) {
      onRollComplete(lastRoll);
    }
    onClose();
  };

  const rawDie = lastRoll
    ? (lastRoll.baseRoll || (lastRoll.rolls && lastRoll.rolls.length > 0 ? lastRoll.rolls[0] : lastRoll.total))
    : pendingDie;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 animate-in fade-in">
      <div className="w-full max-w-md bg-gradient-to-b from-slate-900 to-slate-950 border border-fantasy-border rounded-3xl p-5 sm:p-6 shadow-2xl relative max-h-[95vh] overflow-y-auto custom-scrollbar">
        {/* Close Button */}
        <button
          onClick={handleClose}
          disabled={isRolling}
          className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-lg transition-colors disabled:opacity-50"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2.5 bg-amber-500/10 border border-amber-500/30 rounded-2xl text-amber-400">
            <Dices className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-lg sm:text-xl font-bold font-rpg text-amber-400">Бросок кубика d20</h3>
              <span className="text-[10px] font-mono px-2 py-0.5 bg-amber-500/20 text-amber-300 rounded-full font-bold border border-amber-500/40">
                D&D 5e
              </span>
            </div>
            <p className="text-xs text-slate-400">Строго 1 бросок за ход • Честный расчет на сервере</p>
          </div>
        </div>

        {purpose && (
          <div className="mb-3 px-3 py-1.5 bg-amber-950/20 border border-amber-500/20 rounded-xl text-xs text-amber-200/90 italic">
            Действие: «{purpose}»
          </div>
        )}

        {/* 3D d20 Interactive Viewport */}
        <div className="my-2 p-2 rounded-2xl bg-black/40 border border-slate-800 flex flex-col items-center justify-center relative min-h-[220px]">
          <ThreeD20Die
            isRolling={isRolling}
            targetNumber={rawDie}
            targetDC={targetDC}
            size={220}
          />

          {isRolling && (
            <div className="absolute bottom-2 px-3 py-1 rounded-full bg-black/70 border border-amber-500/40 text-[11px] text-amber-300 font-mono animate-pulse">
              🎲 Кость d20 брошена... Судьба решается!
            </div>
          )}
        </div>

        {/* D20 Stat Challenge Display */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400">
              Характеристика (Назначена Мастером)
            </label>
            {targetDC && (
              <span className="text-xs font-mono font-bold text-amber-400">
                СЛ {targetDC}
              </span>
            )}
          </div>

          <div className="grid grid-cols-3 gap-1.5">
            {[
              { key: 'str', label: 'СИЛА', val: stats.str },
              { key: 'dex', label: 'ЛОВКОСТЬ', val: stats.dex },
              { key: 'con', label: 'ТЕЛО', val: stats.con },
              { key: 'int', label: 'ИНТЕЛЛЕКТ', val: stats.int },
              { key: 'wis', label: 'МУДРОСТЬ', val: stats.wis },
              { key: 'cha', label: 'ХАРИЗМА', val: stats.cha },
            ].map((st) => {
              const isSelected = statKey === st.key;
              const mod = calcMod(st.val);

              return (
                <div
                  key={st.key}
                  className={`p-2 rounded-xl border text-left transition-all ${
                    isSelected
                      ? 'bg-amber-500/20 border-amber-500 text-amber-300 ring-2 ring-amber-400/40'
                      : 'bg-slate-900/40 border-slate-800/80 text-slate-500 opacity-60'
                  }`}
                >
                  <div className="flex items-center justify-between text-[10px]">
                    <span>{st.label}</span>
                    {isSelected && (
                      <span className="text-[8px] font-mono font-bold text-amber-400 uppercase">
                        Активна
                      </span>
                    )}
                  </div>
                  <div className="font-bold text-xs mt-0.5">
                    {st.val} <span className="font-mono font-normal">({mod >= 0 ? `+${mod}` : mod})</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Circumstances: Advantage, Disadvantage, or Mutual Cancellation */}
          {isMutualCancel ? (
            <div className="mt-3 p-3 rounded-2xl bg-amber-950/30 border border-amber-500/40 text-xs text-amber-200 flex items-start gap-2.5">
              <span className="text-base leading-none mt-0.5">⚖️</span>
              <div className="flex-1 leading-tight">
                <span className="font-bold text-amber-300">Взаимная компенсация (Правило D&D 5e):</span>
                <p className="text-[11px] text-amber-200/80 mt-0.5">
                  Условия Преимущества и Помехи действуют одновременно и взаимно аннулируют друг друга. Совершается стандартный бросок 1d20.
                </p>
              </div>
            </div>
          ) : advantage ? (
            <div className="mt-3 p-3 rounded-2xl bg-emerald-950/40 border border-emerald-500/50 text-xs text-emerald-200 flex items-start gap-2.5 animate-in fade-in">
              <span className="text-base leading-none text-emerald-400 mt-0.5">✦</span>
              <div className="flex-1 leading-tight">
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-emerald-300">Преимущество (2d20 max)</span>
                  <span className="text-[10px] font-mono px-1.5 py-0.5 bg-emerald-500/20 text-emerald-300 rounded border border-emerald-500/30 font-bold">АКТИВНО</span>
                </div>
                <p className="text-[11px] text-emerald-200/90 mt-0.5">
                  {advantageReason || 'Особые тактические условия / Командная помощь соратника'}
                </p>
              </div>
            </div>
          ) : disadvantage ? (
            <div className="mt-3 p-3 rounded-2xl bg-rose-950/40 border border-rose-500/50 text-xs text-rose-200 flex items-start gap-2.5 animate-in fade-in">
              <span className="text-base leading-none text-rose-400 mt-0.5">▼</span>
              <div className="flex-1 leading-tight">
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-rose-300">Помеха (2d20 min)</span>
                  <span className="text-[10px] font-mono px-1.5 py-0.5 bg-rose-500/20 text-rose-300 rounded border border-rose-500/30 font-bold">АКТИВНО</span>
                </div>
                <p className="text-[11px] text-rose-200/90 mt-0.5">
                  {disadvantageReason || 'Негативное состояние / Опасные условия окружения'}
                </p>
              </div>
            </div>
          ) : null}
        </div>

        {/* Roll Result Outcome Display */}
        {lastRoll && !isRolling && (() => {
          const isCritSuccess = !!lastRoll.isCriticalSuccess;
          const isCritFail = !!lastRoll.isCriticalFail;
          const isSuccess = !isCritFail && (isCritSuccess || (targetDC !== undefined && lastRoll.total >= targetDC));
          const isFail = !isCritSuccess && (isCritFail || (targetDC !== undefined && lastRoll.total < targetDC));

          return (
            <div className={`p-4 rounded-2xl border mb-4 text-center transition-all animate-result-bounce ${
              isCritSuccess
                ? 'bg-amber-500/25 border-amber-400 shadow-glow-gold'
                : isCritFail
                ? 'bg-red-950/60 border-red-500 shadow-glow-crimson'
                : isSuccess
                ? 'bg-emerald-950/40 border-emerald-400 shadow-lg shadow-emerald-500/20'
                : isFail
                ? 'bg-rose-950/40 border-rose-500 shadow-lg shadow-red-500/20'
                : 'bg-slate-900 border-slate-800'
            }`}>
              {isCritSuccess && (
                <div className="mb-2 py-1 px-4 rounded-full bg-amber-400 text-black font-extrabold font-rpg text-xs tracking-wider uppercase inline-flex items-center gap-1.5 shadow-md shadow-amber-500/40">
                  <Sparkles className="w-4 h-4 fill-current" />
                  <span>★ КРИТИЧЕСКИЙ УСПЕХ (20)!</span>
                </div>
              )}
              {isCritFail && (
                <div className="mb-2 py-1 px-4 rounded-full bg-red-600 text-white font-extrabold font-rpg text-xs tracking-wider uppercase inline-flex items-center gap-1.5 shadow-md shadow-red-600/40">
                  <ShieldAlert className="w-4 h-4 fill-current" />
                  <span>☠ КРИТИЧЕСКИЙ ПРОВАЛ (1)!</span>
                </div>
              )}
              {!isCritSuccess && !isCritFail && isSuccess && (
                <div className="mb-2 py-1 px-4 rounded-full bg-emerald-500 text-black font-extrabold font-rpg text-xs tracking-wider uppercase inline-flex items-center gap-1.5 shadow-md shadow-emerald-500/30">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>★ УСПЕХ! ({lastRoll.total} против СЛ {targetDC})</span>
                </div>
              )}
              {!isCritSuccess && !isCritFail && isFail && (
                <div className="mb-2 py-1 px-4 rounded-full bg-rose-600 text-white font-extrabold font-rpg text-xs tracking-wider uppercase inline-flex items-center gap-1.5 shadow-md shadow-rose-600/30">
                  <XCircle className="w-4 h-4" />
                  <span>✗ ПРОВАЛ! ({lastRoll.total} против СЛ {targetDC})</span>
                </div>
              )}

              <div className="text-3xl sm:text-4xl font-extrabold font-rpg text-amber-300 my-1">
                {lastRoll.total}
              </div>
              <div className="text-xs text-slate-300 font-mono">
                {lastRoll.rolls.length > 1
                  ? advantage
                    ? `Кости [${lastRoll.rolls.join(', ')}] (выбран max: ${lastRoll.baseRoll})`
                    : disadvantage
                    ? `Кости [${lastRoll.rolls.join(', ')}] (выбран min: ${lastRoll.baseRoll})`
                    : `Кости [${lastRoll.rolls.join(', ')}] (база: ${lastRoll.baseRoll})`
                  : `Кость [${lastRoll.baseRoll}]`}{' '}
                {lastRoll.modifier >= 0 ? `+ ${lastRoll.modifier}` : `- ${Math.abs(lastRoll.modifier)}`} ({lastRoll.statName ? lastRoll.statName.toUpperCase() : 'модификатор'})
              </div>
            </div>
          );
        })()}

        {/* Action Button */}
        <div className="flex gap-3">
          {lastRoll ? (
            <button
              type="button"
              onClick={confirmRoll}
              className="w-full py-3 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white font-bold font-rpg rounded-xl shadow-lg shadow-emerald-600/30 transition-all flex items-center justify-center gap-2 text-sm"
            >
              <Check className="w-5 h-5" />
              Прикрепить бросок к ходу ({lastRoll.total})
            </button>
          ) : (
            <button
              type="button"
              disabled={isRolling}
              onClick={handleRoll}
              className="w-full py-3 bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-slate-950 font-bold font-rpg rounded-xl shadow-lg shadow-amber-600/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50 text-sm"
            >
              <Dices className={`w-5 h-5 ${isRolling ? 'animate-spin' : ''}`} />
              {isRolling ? '3D кость крутится...' : 'Бросить кубик d20'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
