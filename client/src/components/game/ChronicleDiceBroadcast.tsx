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

interface ChronicleDiceBroadcastProps {
  broadcast: RoomRollBroadcast;
  targetDC?: number;
  onDismiss: () => void;
}

export const ChronicleDiceBroadcast: React.FC<ChronicleDiceBroadcastProps> = ({
  broadcast,
  targetDC,
  onDismiss,
}) => {
  const [isSpinning, setIsSpinning] = useState(true);
  const [hasLanded, setHasLanded] = useState(false);

  const roll = broadcast.roll;
  const rawDie = roll.baseRoll || (roll.rolls && roll.rolls.length > 0 ? roll.rolls[0] : roll.total);

  useEffect(() => {
    // 1.3s tumbling, then settles on the real target number
    const spinTimer = setTimeout(() => {
      setIsSpinning(false);
    }, 1300);

    return () => {
      clearTimeout(spinTimer);
    };
  }, [broadcast.id]);

  const handleSettle = () => {
    if (hasLanded) return;
    setHasLanded(true);

    if (roll.isCriticalSuccess) {
      soundFx.playCriticalSuccess();
      confetti({
        particleCount: 50,
        spread: 70,
        origin: { y: 0.6 },
      });
    } else if (roll.isCriticalFail) {
      soundFx.playCriticalFail();
    } else if (targetDC && roll.total >= targetDC) {
      confetti({
        particleCount: 25,
        spread: 50,
        origin: { y: 0.65 },
      });
    }
  };

  const isCritSuccess = !!roll.isCriticalSuccess;
  const isCritFail = !!roll.isCriticalFail;
  const isSuccess = !isCritFail && (isCritSuccess || (targetDC !== undefined && roll.total >= targetDC));
  const isFail = !isCritSuccess && (isCritFail || (targetDC !== undefined && roll.total < targetDC));

  return (
    <div className="bg-gradient-to-b from-slate-900/95 via-slate-950/95 to-slate-900/95 border-2 border-amber-500/50 rounded-2xl p-4 shadow-2xl relative my-3 animate-in fade-in slide-in-from-bottom-3 duration-300">
      {/* Dismiss Button */}
      <button
        type="button"
        onClick={onDismiss}
        className="absolute top-3 right-3 text-slate-400 hover:text-white p-1 rounded-lg transition-colors z-10"
        title="Скрыть бросок"
      >
        <X className="w-4 h-4" />
      </button>

      {/* Header with Roller Character Info */}
      <div className="flex flex-col items-center text-center">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/15 border border-amber-500/40 text-amber-300 text-xs font-rpg font-bold">
          <Dices className="w-4 h-4 text-amber-400 animate-spin-slow" />
          <span>Бросок кубика: {broadcast.characterName || broadcast.username}</span>
        </div>

        {roll.purpose && (
          <p className="text-xs text-slate-300 italic mt-1.5 line-clamp-2 max-w-md font-sans">
            «{roll.purpose}»
          </p>
        )}

        {/* 3D d20 Canvas */}
        <div className="my-2 relative flex items-center justify-center">
          <ThreeD20Die
            isRolling={isSpinning}
            targetNumber={rawDie}
            targetDC={targetDC}
            size={160}
            onSettle={handleSettle}
          />

          {isSpinning && (
            <div className="absolute bottom-0 px-2.5 py-0.5 rounded-full bg-black/70 border border-amber-500/30 text-[10px] text-amber-300/90 font-mono animate-pulse">
              🎲 Кость d20 вращается в 3D...
            </div>
          )}
        </div>

        {/* Settled Outcome */}
        {!isSpinning && (
          <div className="w-full space-y-1.5 animate-result-bounce">
            {isCritSuccess && (
              <div className="py-0.5 px-3 rounded-full bg-amber-400 text-black font-extrabold font-rpg text-xs tracking-wider uppercase inline-flex items-center gap-1 shadow-md shadow-amber-500/40">
                <Sparkles className="w-3.5 h-3.5 fill-current" />
                <span>★ КРИТИЧЕСКИЙ УСПЕХ (20)!</span>
              </div>
            )}
            {isCritFail && (
              <div className="py-0.5 px-3 rounded-full bg-red-600 text-white font-extrabold font-rpg text-xs tracking-wider uppercase inline-flex items-center gap-1 shadow-md shadow-red-600/40">
                <ShieldAlert className="w-3.5 h-3.5 fill-current" />
                <span>☠ КРИТИЧЕСКИЙ ПРОВАЛ (1)!</span>
              </div>
            )}
            {!isCritSuccess && !isCritFail && isSuccess && (
              <div className="py-0.5 px-3 rounded-full bg-emerald-500 text-black font-extrabold font-rpg text-xs tracking-wider uppercase inline-flex items-center gap-1 shadow-md shadow-emerald-500/30">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>★ УСПЕХ! ({roll.total} против СЛ {targetDC})</span>
              </div>
            )}
            {!isCritSuccess && !isCritFail && isFail && (
              <div className="py-0.5 px-3 rounded-full bg-rose-600 text-white font-extrabold font-rpg text-xs tracking-wider uppercase inline-flex items-center gap-1 shadow-md shadow-rose-600/30">
                <XCircle className="w-3.5 h-3.5" />
                <span>✗ ПРОВАЛ! ({roll.total} против СЛ {targetDC})</span>
              </div>
            )}

            {/* Total and formula */}
            <div className="text-2xl sm:text-3xl font-extrabold font-rpg text-amber-300">
              Итог: {roll.total}
            </div>

            <div className="text-[11px] text-slate-300 font-mono">
              Кость [{rawDie}] {roll.modifier >= 0 ? `+ ${roll.modifier}` : `- ${Math.abs(roll.modifier)}`} ({roll.statName ? roll.statName.toUpperCase() : 'мод'})
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
