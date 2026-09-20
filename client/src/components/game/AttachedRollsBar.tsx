import React from 'react';
import { DiceRollResult } from '../../types';
import { Dices, X } from 'lucide-react';

interface AttachedRollsBarProps {
  rolls: DiceRollResult[];
  targetDC?: number;
  onRemoveRoll: (index: number) => void;
}

export const AttachedRollsBar: React.FC<AttachedRollsBarProps> = ({ rolls, targetDC, onRemoveRoll }) => {
  if (rolls.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2 mb-3">
      {rolls.map((roll, idx) => {
        const isD20 = roll.diceType.toLowerCase() === 'd20';
        const isSuccess = targetDC ? roll.total >= targetDC : undefined;

        let borderClass = 'border-slate-700 bg-slate-800 text-slate-200';
        if (roll.isCriticalSuccess) {
          borderClass = 'bg-amber-500/20 text-amber-300 border-amber-500 shadow-glow-gold';
        } else if (roll.isCriticalFail) {
          borderClass = 'bg-red-500/20 text-red-300 border-red-500';
        } else if (isD20 && isSuccess !== undefined) {
          borderClass = isSuccess
            ? 'bg-emerald-950/40 text-emerald-200 border-emerald-500/60'
            : 'bg-rose-950/40 text-rose-200 border-rose-500/60';
        }

        return (
          <span
            key={idx}
            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-mono font-semibold border ${borderClass}`}
          >
            <Dices className="w-3.5 h-3.5 text-amber-400" />
            {roll.purpose ? `${roll.purpose}: ` : ''}
            {roll.diceType} ({roll.rolls.join('+')}
            {roll.modifier !== 0 ? `${roll.modifier >= 0 ? '+' : ''}${roll.modifier}` : ''}) ={' '}
            <strong className="text-amber-300">{roll.total}</strong>

            {isD20 && targetDC !== undefined && (
              <span
                className={`ml-1.5 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide ${
                  roll.isCriticalSuccess
                    ? 'bg-amber-400/30 text-amber-200'
                    : roll.isCriticalFail
                    ? 'bg-red-500/30 text-red-200'
                    : isSuccess
                    ? 'bg-emerald-500/30 text-emerald-300'
                    : 'bg-rose-500/30 text-rose-300'
                }`}
              >
                {roll.isCriticalSuccess
                  ? '★ Крит!'
                  : roll.isCriticalFail
                  ? '☠ Крит. провал'
                  : isSuccess
                  ? `✓ Успех (${roll.total} ≥ ${targetDC})`
                  : `✗ Провал (${roll.total} < ${targetDC})`}
              </span>
            )}

            <button
              type="button"
              onClick={() => onRemoveRoll(idx)}
              className="ml-1 text-slate-400 hover:text-red-400"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </span>
        );
      })}
    </div>
  );
};
