import React, { useState } from 'react';
import { Character, DiceRollResult } from '../types';
import { getSocket } from '../services/socket';
import { soundFx } from '../utils/audio';
import { Dices, Sparkles, X, ShieldAlert, Check } from 'lucide-react';

interface DiceRollerModalProps {
  roomCode: string;
  character?: Character;
  defaultStatKey?: string;
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
  const [lastRoll, setLastRoll] = useState<DiceRollResult | null>(null);

  const stats = character?.stats || { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 };
  const calcMod = (val: number) => Math.floor((val - 10) / 2);

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
      } else if (result.isCriticalFail) {
        soundFx.playCriticalFail();
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

        {/* D20 Modifiers */}
        {diceType === 'd20' && (
          <div className="mb-4">
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
              Характеристика для модификатора
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { key: 'str', label: 'СИЛ', val: stats.str },
                { key: 'dex', label: 'ЛОВ', val: stats.dex },
                { key: 'con', label: 'ТЕЛ', val: stats.con },
                { key: 'int', label: 'ИНТ', val: stats.int },
                { key: 'wis', label: 'МУД', val: stats.wis },
                { key: 'cha', label: 'ХАР', val: stats.cha },
              ].map((st) => {
                  const isRecommended = defaultStatKey && defaultStatKey.toLowerCase() === st.key;
                  const mod = calcMod(st.val);
                  return (
                    <button
                      key={st.key}
                      type="button"
                      onClick={() => setStatKey(st.key)}
                      className={`p-2 rounded-lg border text-left transition-all relative ${
                        statKey === st.key
                          ? 'bg-amber-500/20 border-amber-500 text-amber-300 ring-1 ring-amber-400/40'
                          : isRecommended
                          ? 'bg-amber-500/10 border-amber-500/50 text-slate-200'
                          : 'bg-fantasy-card border-fantasy-border text-slate-300 hover:border-slate-500'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-slate-400">{st.label}</span>
                        {isRecommended && (
                          <span className="text-[9px] font-mono px-1 py-0.2 bg-amber-500/30 text-amber-300 rounded font-bold">
                            СЛ
                          </span>
                        )}
                      </div>
                      <div className="font-bold text-sm">
                        {st.val} ({mod >= 0 ? `+${mod}` : mod})
                      </div>
                    </button>
                  );
              })}
            </div>

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

        {/* Purpose */}
        <div className="mb-5">
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
            Цель броска
          </label>
          <input
            type="text"
            value={purpose}
            onChange={(e) => setPurpose(e.target.value)}
            placeholder="Например: Атака гоблина мечом, проверка Скрытности"
            className="w-full px-3 py-2 bg-fantasy-card border border-fantasy-border rounded-xl text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-500"
          />
        </div>

        {/* Roll Result Display */}
        {lastRoll && (
          <div className={`p-4 rounded-xl border mb-5 text-center transition-all ${
            lastRoll.isCriticalSuccess
              ? 'bg-amber-500/20 border-amber-400 shadow-glow-gold'
              : lastRoll.isCriticalFail
              ? 'bg-red-950/40 border-red-500'
              : 'bg-fantasy-card border-fantasy-border'
          }`}>
            <div className="text-xs uppercase tracking-wider text-slate-400 mb-1">
              Результат {lastRoll.purpose}:
            </div>
            <div className="text-4xl font-extrabold font-rpg text-amber-400 mb-1">
              {lastRoll.total}
            </div>
            <div className="text-xs text-slate-300">
              Кость [{lastRoll.rolls.join(', ')}] {lastRoll.modifier >= 0 ? `+ ${lastRoll.modifier}` : `- ${Math.abs(lastRoll.modifier)}`} ({lastRoll.statName || 'модификатор'})
            </div>
            {lastRoll.isCriticalSuccess && (
              <div className="mt-2 text-xs font-bold text-amber-300 flex items-center justify-center gap-1">
                <Sparkles className="w-4 h-4" /> КРИТИЧЕСКИЙ УСПЕХ (20)!
              </div>
            )}
            {lastRoll.isCriticalFail && (
              <div className="mt-2 text-xs font-bold text-red-400 flex items-center justify-center gap-1">
                <ShieldAlert className="w-4 h-4" /> КРИТИЧЕСКИЙ ПРОВАЛ (1)!
              </div>
            )}
          </div>
        )}

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
