import React, { useState, useEffect } from 'react';
import { Character, DiceRollResult } from '../types';
import { getSocket } from '../services/socket';
import { soundFx } from '../utils/audio';
import confetti from 'canvas-confetti';
import { Dices, Sparkles, X, ShieldAlert, Check, CheckCircle2, XCircle } from 'lucide-react';

interface DiceRollerModalProps {
  roomCode: string;
  character?: Character;
  defaultStatKey?: string;
  targetDC?: number;
  initialPurpose?: string;
  initialAdvantage?: boolean;
  initialDisadvantage?: boolean;
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
  onClose,
  onRollComplete,
}) => {
  const [diceType, setDiceType] = useState('d20');
  const [statKey, setStatKey] = useState<string>(defaultStatKey ? defaultStatKey.toLowerCase() : 'str');
  const [purpose, setPurpose] = useState(initialPurpose || '');
  const [advantage, setAdvantage] = useState(initialAdvantage);
  const [disadvantage, setDisadvantage] = useState(initialDisadvantage);
  const [isRolling, setIsRolling] = useState(false);
  const [animatedNumber, setAnimatedNumber] = useState<number>(10);
  const [lastRoll, setLastRoll] = useState<DiceRollResult | null>(null);

  const stats = character?.stats || { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 };
  const calcMod = (val: number) => Math.floor((val - 10) / 2);

  // Cycling numbers animation while rolling
  useEffect(() => {
    let interval: any;
    if (isRolling) {
      interval = setInterval(() => {
        const maxVal = parseInt(diceType.replace('d', ''), 10) || 20;
        setAnimatedNumber(Math.floor(Math.random() * maxVal) + 1);
      }, 70);
    }
    return () => clearInterval(interval);
  }, [isRolling, diceType]);

  const handleRoll = () => {
    if (isRolling || lastRoll) return;
    setIsRolling(true);
    soundFx.playDiceRoll();

    const socket = getSocket();

    const handleResult = (result: DiceRollResult) => {
      setLastRoll(result);
      setIsRolling(false);

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

      socket.off('your_dice_result', handleResult);
      socket.off('dice_roll_rejected', handleRejected);
    };

    const handleRejected = (data: { message: string }) => {
      setIsRolling(false);
      alert(data.message || 'Вы уже бросили кубик в этом раунде!');
      socket.off('your_dice_result', handleResult);
      socket.off('dice_roll_rejected', handleRejected);
      onClose();
    };

    socket.on('your_dice_result', handleResult);
    socket.on('dice_roll_rejected', handleRejected);

    socket.emit('roll_dice', {
      roomCode,
      request: {
        diceType,
        statKey: diceType === 'd20' ? statKey : undefined,
        purpose: purpose || (diceType === 'd20' ? `Проверка характеристики` : `Бросок ${diceType}`),
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
    }, 4000);
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

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-fantasy-panel border border-fantasy-border rounded-2xl p-6 shadow-2xl relative">
        <button
          onClick={handleClose}
          disabled={isRolling}
          className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-lg transition-colors disabled:opacity-50"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-5">
          <div className="p-2.5 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-400">
            <Dices className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-xl font-bold font-rpg text-amber-400">Бросок кубика</h3>
            <p className="text-xs text-slate-400">Честный расчет на сервере — строго 1 бросок за ход</p>
          </div>
        </div>

        {/* Dice Selector */}
        <div className="mb-4">
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
            Тип кости
          </label>
          <div className="grid grid-cols-6 gap-2">
            {['d4', 'd6', 'd8', 'd10', 'd12', 'd20'].map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setDiceType(d)}
                className={`py-2 text-sm font-bold font-rpg rounded-lg border transition-all ${
                  diceType === d
                    ? 'bg-amber-500 border-amber-400 text-black shadow-glow-gold'
                    : 'bg-fantasy-card border-fantasy-border text-slate-300 hover:border-slate-500'
                }`}
              >
                {d}
              </button>
            ))}
          </div>
        </div>

        {/* D20 Stat Challenge - Dictated by Dungeon Master */}
        {diceType === 'd20' && (
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400">
                Характеристика проверки (Назначена Мастером)
              </label>
              {defaultStatKey && (
                <span className="text-[10px] font-mono px-2 py-0.5 bg-amber-500/20 text-amber-300 rounded-full font-bold border border-amber-500/30">
                  Выбор Мастера
                </span>
              )}
            </div>

            {/* Display character stats with DM required stat highlighted and locked */}
            <div className="grid grid-cols-3 gap-2">
              {[
                { key: 'str', label: 'СИЛА (STR)', val: stats.str },
                { key: 'dex', label: 'ЛОВКОСТЬ (DEX)', val: stats.dex },
                { key: 'con', label: 'ТЕЛО (CON)', val: stats.con },
                { key: 'int', label: 'ИНТЕЛЛЕКТ (INT)', val: stats.int },
                { key: 'wis', label: 'МУДРОСТЬ (WIS)', val: stats.wis },
                { key: 'cha', label: 'ХАРИЗМА (CHA)', val: stats.cha },
              ].map((st) => {
                const isDMChoice = (defaultStatKey ? defaultStatKey.toLowerCase() : 'dex') === st.key;
                const isSelected = statKey === st.key;
                const mod = calcMod(st.val);

                return (
                  <div
                    key={st.key}
                    className={`p-2.5 rounded-xl border text-left transition-all ${
                      isSelected
                        ? 'bg-amber-500/20 border-amber-500 text-amber-300 ring-2 ring-amber-400/40'
                        : isDMChoice
                        ? 'bg-amber-500/10 border-amber-500/40 text-slate-300'
                        : 'bg-slate-900/40 border-slate-800 text-slate-500 opacity-60'
                    }`}
                  >
                    <div className="flex items-center justify-between text-[11px]">
                      <span>{st.label.split(' ')[0]}</span>
                      {isSelected && (
                        <span className="text-[9px] font-mono font-bold text-amber-400">
                          {defaultStatKey ? 'СЛ ДМ' : 'АКТИВНА'}
                        </span>
                      )}
                    </div>
                    <div className="font-bold text-sm mt-0.5">
                      {st.val} <span className="text-xs font-mono font-normal">({mod >= 0 ? `+${mod}` : mod})</span>
                    </div>
                  </div>
                );
              })}
            </div>

            <p className="text-[11px] text-slate-400 mt-2 italic">
              * Характеристику проверки назначает Мастер Подземелий по ситуации сцены.
            </p>

            {/* Advantage / Disadvantage */}
            <div className="grid grid-cols-2 gap-2 mt-3">
              <button
                type="button"
                onClick={() => {
                  setAdvantage(!advantage);
                  setDisadvantage(false);
                }}
                className={`py-1.5 px-3 rounded-lg border text-xs font-semibold transition-all ${
                  advantage
                    ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300'
                    : 'bg-fantasy-card border-fantasy-border text-slate-400 hover:text-slate-200'
                }`}
              >
                ✦ Преимущество (2d20 max)
              </button>
              <button
                type="button"
                onClick={() => {
                  setDisadvantage(!disadvantage);
                  setAdvantage(false);
                }}
                className={`py-1.5 px-3 rounded-lg border text-xs font-semibold transition-all ${
                  disadvantage
                    ? 'bg-red-500/20 border-red-500 text-red-300'
                    : 'bg-fantasy-card border-fantasy-border text-slate-400 hover:text-slate-200'
                }`}
              >
                ▼ Помеха (2d20 min)
              </button>
            </div>
          </div>
        )}

        {/* Rolling State Display */}
        {isRolling && (
          <div className="p-6 rounded-2xl bg-gradient-to-b from-amber-500/15 to-slate-900 border border-amber-500/40 mb-5 text-center flex flex-col items-center justify-center gap-2 animate-pulse">
            <div className="p-3.5 bg-amber-500/20 rounded-2xl text-amber-400 animate-dice-tumble shadow-glow-gold">
              <Dices className="w-10 h-10" />
            </div>
            <div className="text-4xl font-extrabold font-rpg text-amber-300 font-mono">
              {animatedNumber}
            </div>
            <p className="text-xs text-amber-200/80 font-medium">Кость брошена... Решается судьба раунда!</p>
          </div>
        )}

        {/* Roll Result Display */}
        {lastRoll && !isRolling && (() => {
          const isCritSuccess = !!lastRoll.isCriticalSuccess;
          const isCritFail = !!lastRoll.isCriticalFail;
          const isSuccess = !isCritFail && (isCritSuccess || (targetDC !== undefined && lastRoll.total >= targetDC));
          const isFail = !isCritSuccess && (isCritFail || (targetDC !== undefined && lastRoll.total < targetDC));

          return (
            <div className={`p-4 sm:p-5 rounded-2xl border mb-5 text-center transition-all animate-result-bounce ${
              isCritSuccess
                ? 'bg-amber-500/25 border-amber-400 shadow-glow-gold animate-glow-success'
                : isCritFail
                ? 'bg-red-950/60 border-red-500 animate-fail-tremor shadow-glow-crimson'
                : isSuccess
                ? 'bg-emerald-950/40 border-emerald-400 shadow-lg shadow-emerald-500/20 animate-glow-success'
                : isFail
                ? 'bg-rose-950/40 border-rose-500 animate-fail-tremor shadow-lg shadow-red-500/20'
                : 'bg-fantasy-card border-fantasy-border'
            }`}>
              {/* Huge explicit SUCCESS or FAILURE banner */}
              {isCritSuccess && (
                <div className="mb-2 py-1.5 px-4 rounded-full bg-amber-400 text-black font-extrabold font-rpg text-xs sm:text-sm tracking-wider uppercase inline-flex items-center gap-1.5 shadow-md shadow-amber-500/40">
                  <Sparkles className="w-4 h-4 fill-current" />
                  <span>★ КРИТИЧЕСКИЙ УСПЕХ (20)!</span>
                </div>
              )}
              {isCritFail && (
                <div className="mb-2 py-1.5 px-4 rounded-full bg-red-600 text-white font-extrabold font-rpg text-xs sm:text-sm tracking-wider uppercase inline-flex items-center gap-1.5 shadow-md shadow-red-600/40">
                  <ShieldAlert className="w-4 h-4 fill-current" />
                  <span>☠ КРИТИЧЕСКИЙ ПРОВАЛ (1)!</span>
                </div>
              )}
              {!isCritSuccess && !isCritFail && isSuccess && (
                <div className="mb-2 py-1.5 px-4 rounded-full bg-emerald-500 text-black font-extrabold font-rpg text-xs sm:text-sm tracking-wider uppercase inline-flex items-center gap-1.5 shadow-md shadow-emerald-500/30">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>★ УСПЕХ! ({lastRoll.total} против СЛ {targetDC})</span>
                </div>
              )}
              {!isCritSuccess && !isCritFail && isFail && (
                <div className="mb-2 py-1.5 px-4 rounded-full bg-rose-600 text-white font-extrabold font-rpg text-xs sm:text-sm tracking-wider uppercase inline-flex items-center gap-1.5 shadow-md shadow-rose-600/30">
                  <XCircle className="w-4 h-4" />
                  <span>✗ ПРОВАЛ! ({lastRoll.total} против СЛ {targetDC})</span>
                </div>
              )}

              <div className="text-xs uppercase tracking-wider text-slate-400 mt-1">
                {lastRoll.purpose || 'Бросок проверки'}:
              </div>
              <div className="text-4xl sm:text-5xl font-extrabold font-rpg text-amber-300 my-1">
                {lastRoll.total}
              </div>
              <div className="text-xs text-slate-300 font-mono">
                Кость [{lastRoll.rolls.join(', ')}] {lastRoll.modifier >= 0 ? `+ ${lastRoll.modifier}` : `- ${Math.abs(lastRoll.modifier)}`} ({lastRoll.statName ? lastRoll.statName.toUpperCase() : 'модификатор'})
              </div>
            </div>
          );
        })()}

        {/* Actions */}
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
              {isRolling ? 'Кубик катится...' : 'Бросить кубик (1 попытка)'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
