import React, { useEffect, useState } from 'react';
import { DiceRollResult } from '../../types';
import { ThreeD20Die } from './ThreeD20Die';
import { Dices, Sparkles, ShieldAlert, CheckCircle2, XCircle, X } from 'lucide-react';
import { soundFx } from '../../utils/audio';
import confetti from 'canvas-confetti';

export interface RoomRollBroadcast {
  id: string;
  playerId: string;
  username: string;
  characterName: string;
  roll: DiceRollResult;
}

interface RoomDiceBroadcastModalProps {
  broadcast: RoomRollBroadcast;
  targetDC?: number;
  onClose: () => void;
}

export const RoomDiceBroadcastModal: React.FC<RoomDiceBroadcastModalProps> = ({
  broadcast,
  targetDC,
  onClose,
}) => {
  const [isSpinning, setIsSpinning] = useState(true);
  const [hasLanded, setHasLanded] = useState(false);

  const roll = broadcast.roll;
  const rawDie = roll.baseRoll || (roll.rolls && roll.rolls.length > 0 ? roll.rolls[0] : roll.total);

  useEffect(() => {
    // 1.4s tumbling, then settles on target number
    const spinTimer = setTimeout(() => {
      setIsSpinning(false);
    }, 1400);

    // Auto close after 5.5s
    const autoCloseTimer = setTimeout(() => {
      onClose();
    }, 5500);

    return () => {
      clearTimeout(spinTimer);
      clearTimeout(autoCloseTimer);
    };
  }, [broadcast.id, onClose]);

  const handleSettle = () => {
    if (hasLanded) return;
    setHasLanded(true);

    if (roll.isCriticalSuccess) {
      soundFx.playCriticalSuccess();
      confetti({
        particleCount: 60,
        spread: 80,
        origin: { y: 0.55 },
      });
    } else if (roll.isCriticalFail) {
      soundFx.playCriticalFail();
    } else if (targetDC && roll.total >= targetDC) {
      confetti({
        particleCount: 35,
        spread: 60,
        origin: { y: 0.6 },
      });
    }
  };

  const isCritSuccess = !!roll.isCriticalSuccess;
  const isCritFail = !!roll.isCriticalFail;
  const isSuccess = !isCritFail && (isCritSuccess || (targetDC !== undefined && roll.total >= targetDC));
  const isFail = !isCritSuccess && (isCritFail || (targetDC !== undefined && roll.total < targetDC));

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-sm sm:max-w-md bg-gradient-to-b from-slate-900 to-slate-950 border border-amber-500/40 rounded-3xl p-5 sm:p-6 shadow-2xl relative text-center flex flex-col items-center">
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-lg transition-colors"
          title="Закрыть"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header: Who is rolling */}
        <div className="flex items-center gap-2 mb-1 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-rpg font-bold">
          <Dices className="w-4 h-4 text-amber-400" />
          <span>Бросок совершает: {broadcast.characterName || broadcast.username}</span>
        </div>

        {broadcast.roll.purpose && (
          <p className="text-[11px] text-slate-300 italic mb-2 line-clamp-1 max-w-xs">
            «{broadcast.roll.purpose}»
          </p>
        )}

        {/* 3D d20 Canvas */}
        <div className="my-1 relative flex items-center justify-center">
          <ThreeD20Die
            isRolling={isSpinning}
            targetNumber={rawDie}
            targetDC={targetDC}
            size={200}
            onSettle={handleSettle}
          />

          {isSpinning && (
            <div className="absolute bottom-1 px-3 py-1 rounded-full bg-black/60 border border-amber-500/30 text-[10px] text-amber-300/90 font-mono animate-pulse">
              🎲 Кость d20 вращается в 3D...
            </div>
          )}
        </div>

        {/* Outcome Display once settled */}
        {!isSpinning && (
          <div className="w-full animate-result-bounce space-y-2 mt-2">
            {isCritSuccess && (
              <div className="py-1 px-4 rounded-full bg-amber-400 text-black font-extrabold font-rpg text-xs sm:text-sm tracking-wider uppercase inline-flex items-center gap-1.5 shadow-md shadow-amber-500/40">
                <Sparkles className="w-4 h-4 fill-current" />
                <span>★ КРИТИЧЕСКИЙ УСПЕХ (20)!</span>
              </div>
            )}
            {isCritFail && (
              <div className="py-1 px-4 rounded-full bg-red-600 text-white font-extrabold font-rpg text-xs sm:text-sm tracking-wider uppercase inline-flex items-center gap-1.5 shadow-md shadow-red-600/40">
                <ShieldAlert className="w-4 h-4 fill-current" />
                <span>☠ КРИТИЧЕСКИЙ ПРОВАЛ (1)!</span>
              </div>
            )}
            {!isCritSuccess && !isCritFail && isSuccess && (
              <div className="py-1 px-4 rounded-full bg-emerald-500 text-black font-extrabold font-rpg text-xs sm:text-sm tracking-wider uppercase inline-flex items-center gap-1.5 shadow-md shadow-emerald-500/30">
                <CheckCircle2 className="w-4 h-4" />
                <span>★ УСПЕХ! ({roll.total} против СЛ {targetDC})</span>
              </div>
            )}
            {!isCritSuccess && !isCritFail && isFail && (
              <div className="py-1 px-4 rounded-full bg-rose-600 text-white font-extrabold font-rpg text-xs sm:text-sm tracking-wider uppercase inline-flex items-center gap-1.5 shadow-md shadow-rose-600/30">
                <XCircle className="w-4 h-4" />
                <span>✗ ПРОВАЛ! ({roll.total} против СЛ {targetDC})</span>
              </div>
            )}

            {/* Total and formula */}
            <div className="text-3xl sm:text-4xl font-extrabold font-rpg text-amber-300">
              {roll.total}
            </div>

            <div className="text-[11px] text-slate-300 font-mono">
              Кость [{roll.rolls?.join('+') || rawDie}] {roll.modifier >= 0 ? `+ ${roll.modifier}` : `- ${Math.abs(roll.modifier)}`} ({roll.statName ? roll.statName.toUpperCase() : 'мод'})
            </div>
          </div>
        )}

        <button
          type="button"
          onClick={onClose}
          className="mt-4 px-6 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-rpg transition-colors"
        >
          Закрыть
        </button>
      </div>
    </div>
  );
};
