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
    <div className="bg-[#12141c] border border-[#3d3424] rounded-xl p-3.5 shadow-md relative my-3 animate-in fade-in font-serif">
      {/* Dismiss Button */}
      <button
        type="button"
        onClick={onDismiss}
        className="absolute top-2.5 right-2.5 text-[#968e7f] hover:text-[#ded7c8] p-1 rounded-lg hover:bg-[#1a1f2b] transition-colors z-10"
        title="Скрыть карточку броска"
      >
        <X className="w-4 h-4" />
      </button>

      {/* Header with Roller Character Info */}
      <div className="flex flex-col items-center text-center">
        <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded bg-[#181c25] border border-[#4a3e26] text-[#e2c26a] text-xs font-rpg font-bold">
          <Dices className="w-3.5 h-3.5 text-[#c5a059]" />
          <span>Бросок кубика: {broadcast.characterName || broadcast.username}</span>
        </div>

        {roll.purpose && (
          <p className="text-xs text-[#ded7c8] italic mt-1 line-clamp-2 max-w-md font-serif">
            «{roll.purpose}»
          </p>
        )}

        {/* 3D d20 Canvas */}
        <div className="my-2 p-1 rounded-lg bg-[#0c0d11] border border-[#2a303d] relative flex items-center justify-center">
          <ThreeD20Die
            isRolling={isSpinning}
            targetNumber={rawDie}
            targetDC={targetDC}
            size={150}
            onSettle={handleSettle}
          />

          {isSpinning && (
            <div className="absolute bottom-1 px-2.5 py-0.5 rounded bg-black/80 border border-[#4a3e26] text-[10px] text-[#e2c26a] font-serif animate-pulse">
              Судьба решает исход...
            </div>
          )}
        </div>

        {/* Settled Outcome */}
        {!isSpinning && (
          <div className="w-full space-y-1 animate-result-bounce">
            {isCritSuccess && (
              <div className="py-0.5 px-3 rounded bg-[#2b2213] border border-[#785e2b] text-[#e2c26a] font-bold font-rpg text-xs uppercase inline-flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5" />
                <span>★ КРИТИЧЕСКИЙ УСПЕХ (20)</span>
              </div>
            )}
            {isCritFail && (
              <div className="py-0.5 px-3 rounded bg-[#2b1316] border border-[#782b32] text-[#fca5a5] font-bold font-rpg text-xs uppercase inline-flex items-center gap-1">
                <ShieldAlert className="w-3.5 h-3.5" />
                <span>☠ КРИТИЧЕСКИЙ ПРОВАЛ (1)</span>
              </div>
            )}
            {!isCritSuccess && !isCritFail && isSuccess && (
              <div className="py-0.5 px-3 rounded bg-[#152a1e] border border-[#29563d] text-[#86efac] font-bold font-rpg text-xs uppercase inline-flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>★ УСПЕХ ({roll.total} против СЛ {targetDC})</span>
              </div>
            )}
            {!isCritSuccess && !isCritFail && isFail && (
              <div className="py-0.5 px-3 rounded bg-[#2b1619] border border-[#6b252c] text-[#fca5a5] font-bold font-rpg text-xs uppercase inline-flex items-center gap-1">
                <XCircle className="w-3.5 h-3.5" />
                <span>✗ ПРОВАЛ ({roll.total} против СЛ {targetDC})</span>
              </div>
            )}

            {/* Total and formula */}
            <div className="text-2xl sm:text-3xl font-extrabold font-rpg text-[#e2c26a]">
              Итог: {roll.total}
            </div>

            <div className="text-[11px] text-[#ded7c8]/80 font-mono">
              Кость [{rawDie}] {roll.modifier >= 0 ? `+ ${roll.modifier}` : `- ${Math.abs(roll.modifier)}`} ({roll.statName ? roll.statName.toUpperCase() : 'мод'})
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
