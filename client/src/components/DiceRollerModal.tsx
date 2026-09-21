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
  const statKey = defaultStatKey ? defaultStatKey.toLowerCase() : 'dex';
  const [purpose] = useState(initialPurpose || '');
  const [advantage, setAdvantage] = useState(initialAdvantage);
  const [disadvantage, setDisadvantage] = useState(initialDisadvantage);
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
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 animate-in fade-in overflow-y-auto">
      <div className="w-full max-w-md bg-[#13161d] border border-[#3d3424] rounded-xl p-4 sm:p-5 shadow-2xl relative my-auto space-y-3">
        {/* Close Button */}
        <button
          onClick={handleClose}
          disabled={isRolling}
          className="absolute top-3 right-3 text-[#968e7f] hover:text-[#ded7c8] p-1 rounded-lg hover:bg-[#1c212d] transition-colors disabled:opacity-50"
          title="Закрыть окно"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-2.5 border-b border-[#242935] pb-2.5 pr-8">
          <div className="p-2 bg-[#1c1913] border border-[#4a3e26] rounded-lg text-[#c5a059]">
            <Dices className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base sm:text-lg font-bold font-rpg text-[#e2c26a] tracking-wide">
                Испытание судьбы (d20)
              </h3>
              <span className="text-[10px] font-mono px-1.5 py-0.2 bg-[#181c25] text-[#c5a059] rounded border border-[#3a3224]">
                D&D 5e
              </span>
            </div>
            <p className="text-[11px] text-[#968e7f] font-serif">
              Честный бросок на сервере • 1 попытка на раунд
            </p>
          </div>
        </div>

        {purpose && (
          <div className="px-3 py-1.5 bg-[#181c25] border border-[#332b1d] rounded-lg text-xs text-[#ded7c8] font-serif italic">
            Действие: «{purpose}»
          </div>
        )}

        {/* 3D d20 Interactive Viewport (Compact aperture: 160px height) */}
        <div className="h-[165px] rounded-lg bg-[#0c0d11] border border-[#2a303d] flex flex-col items-center justify-center relative overflow-hidden">
          <ThreeD20Die
            isRolling={isRolling}
            targetNumber={rawDie}
            targetDC={targetDC}
            size={160}
          />

          {isRolling && (
            <div className="absolute bottom-1.5 px-3 py-0.5 rounded bg-black/80 border border-[#4a3e26] text-[10px] text-[#e2c26a] font-serif animate-pulse">
              Судьба решает исход...
            </div>
          )}
        </div>

        {/* D20 Stat Challenge Display */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs font-serif">
            <span className="text-[#c5a059] font-medium">Характеристика персонажа:</span>
            {targetDC && (
              <span className="font-mono font-bold text-[#e2c26a] text-xs">
                Сложность: СЛ {targetDC}
              </span>
            )}
          </div>

          <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
            {[
              { key: 'str', label: 'СИЛ', val: stats.str },
              { key: 'dex', label: 'ЛОВ', val: stats.dex },
              { key: 'con', label: 'ТЕЛ', val: stats.con },
              { key: 'int', label: 'ИНТ', val: stats.int },
              { key: 'wis', label: 'МУД', val: stats.wis },
              { key: 'cha', label: 'ХАР', val: stats.cha },
            ].map((st) => {
              const isSelected = statKey === st.key;
              const mod = calcMod(st.val);

              return (
                <div
                  key={st.key}
                  className={`p-1.5 rounded border text-center transition-all ${
                    isSelected
                      ? 'bg-[#2b2213] border-[#785e2b] text-[#e2c26a] shadow-sm'
                      : 'bg-[#0c0d11] border-[#252c38] text-[#968e7f] opacity-75'
                  }`}
                >
                  <div className="text-[10px] font-serif uppercase tracking-wider">
                    {st.label}
                  </div>
                  <div className="font-bold text-xs font-mono mt-0.5">
                    {st.val} <span className="font-normal text-[10px]">({mod >= 0 ? `+${mod}` : mod})</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Advantage / Disadvantage toggles */}
          <div className="grid grid-cols-2 gap-2 pt-1">
            <button
              type="button"
              disabled={isRolling || !!lastRoll}
              onClick={() => {
                setAdvantage(!advantage);
                setDisadvantage(false);
              }}
              className={`py-1 px-2 rounded border text-xs font-serif transition-all disabled:opacity-50 ${
                advantage
                  ? 'bg-[#152a1e] border-[#29563d] text-[#86efac]'
                  : 'bg-[#181c25] border-[#2a303d] text-[#968e7f] hover:text-[#ded7c8]'
              }`}
            >
              ✦ Преимущество
            </button>
            <button
              type="button"
              disabled={isRolling || !!lastRoll}
              onClick={() => {
                setDisadvantage(!disadvantage);
                setAdvantage(false);
              }}
              className={`py-1 px-2 rounded border text-xs font-serif transition-all disabled:opacity-50 ${
                disadvantage
                  ? 'bg-[#2b1619] border-[#6b252c] text-[#fca5a5]'
                  : 'bg-[#181c25] border-[#2a303d] text-[#968e7f] hover:text-[#ded7c8]'
              }`}
            >
              ▼ Помеха
            </button>
          </div>
        </div>

        {/* Roll Result Outcome Display (Compact Noble Decree) */}
        {lastRoll && !isRolling && (() => {
          const isCritSuccess = !!lastRoll.isCriticalSuccess;
          const isCritFail = !!lastRoll.isCriticalFail;
          const isSuccess = !isCritFail && (isCritSuccess || (targetDC !== undefined && lastRoll.total >= targetDC));
          const isFail = !isCritSuccess && (isCritFail || (targetDC !== undefined && lastRoll.total < targetDC));
          const rawDieVal = lastRoll.baseRoll || (lastRoll.rolls && lastRoll.rolls.length > 0 ? lastRoll.rolls[0] : lastRoll.total);

          return (
            <div
              className={`p-3 rounded-lg border text-center transition-all animate-result-bounce ${
                isCritSuccess
                  ? 'bg-[#2b2213] border-[#785e2b] text-[#e2c26a]'
                  : isCritFail
                  ? 'bg-[#2b1316] border-[#782b32] text-[#fca5a5]'
                  : isSuccess
                  ? 'bg-[#152a1e] border-[#29563d] text-[#86efac]'
                  : isFail
                  ? 'bg-[#2b1619] border-[#6b252c] text-[#fca5a5]'
                  : 'bg-[#181c25] border-[#2a303d]'
              }`}
            >
              <div className="font-serif text-xs font-bold tracking-wide">
                {isCritSuccess && '★ КРИТИЧЕСКИЙ УСПЕХ (20)'}
                {isCritFail && '☠ КРИТИЧЕСКИЙ ПРОВАЛ (1)'}
                {!isCritSuccess && !isCritFail && isSuccess && `★ УСПЕХ (${lastRoll.total} против СЛ ${targetDC})`}
                {!isCritSuccess && !isCritFail && isFail && `✗ ПРОВАЛ (${lastRoll.total} против СЛ ${targetDC})`}
              </div>

              <div className="text-2xl sm:text-3xl font-extrabold font-rpg text-[#e2c26a] my-0.5">
                Итог: {lastRoll.total}
              </div>
              <div className="text-[11px] font-mono text-[#ded7c8]/80">
                Кость [{rawDieVal}] {lastRoll.modifier >= 0 ? `+ ${lastRoll.modifier}` : `- ${Math.abs(lastRoll.modifier)}`} ({lastRoll.statName ? lastRoll.statName.toUpperCase() : 'модификатор'})
              </div>
            </div>
          );
        })()}

        {/* Action Buttons */}
        <div className="pt-1">
          {lastRoll ? (
            <button
              type="button"
              onClick={confirmRoll}
              className="w-full py-2.5 bg-[#1b3d2b] hover:bg-[#25523a] text-[#a7f3d0] hover:text-white border border-[#3b7857] hover:border-[#4ade80] font-rpg font-bold rounded-lg shadow-sm transition-all flex items-center justify-center gap-2 text-sm"
            >
              <Check className="w-4 h-4" />
              <span>Прикрепить бросок к ходу ({lastRoll.total})</span>
            </button>
          ) : (
            <button
              type="button"
              disabled={isRolling}
              onClick={handleRoll}
              className="w-full py-2.5 bg-[#2b2213] hover:bg-[#3d301a] text-[#e2c26a] hover:text-white border border-[#785e2b] hover:border-[#c5a059] font-rpg font-bold rounded-lg shadow-sm transition-all flex items-center justify-center gap-2 disabled:opacity-50 text-sm"
            >
              <Dices className={`w-4 h-4 ${isRolling ? 'animate-spin' : ''}`} />
              <span>{isRolling ? 'Судьба решается...' : 'Бросить кубик d20'}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
