import React from 'react';
import { DiceRollResult } from '../../types';
import { Dices } from 'lucide-react';

interface AttachedRollsBarProps {
  rolls: DiceRollResult[];
  targetDC?: number;
  onRemoveRoll?: (index: number) => void;
}

export const AttachedRollsBar: React.FC<AttachedRollsBarProps> = ({ rolls, targetDC }) => {
  if (rolls.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2 mb-3">
      {rolls.map((roll, idx) => {
        const isD20 = roll.diceType.toLowerCase() === 'd20';
        const isSuccess = targetDC ? roll.total >= targetDC : undefined;

        let borderClass = 'border-[#2a303d] bg-[#141720] text-[#ded7c8]';
        if (roll.isCriticalSuccess) {
          borderClass = 'bg-[#231e14] text-[#ffd98a] border-[#c5a059] shadow-sm';
        } else if (roll.isCriticalFail) {
          borderClass = 'bg-[#251313] text-[#fca5a5] border-[#7f2626] shadow-sm';
        } else if (isD20 && isSuccess !== undefined) {
          borderClass = isSuccess
            ? 'bg-[#122219] text-[#a7f3d0] border-[#2d5a3f]'
            : 'bg-[#221315] text-[#fecaca] border-[#6b2c2c]';
        }

        return (
          <span
            key={idx}
            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded text-xs font-serif border ${borderClass}`}
          >
            <Dices className="w-3.5 h-3.5 text-[#c5a059]" />
            {roll.purpose ? `${roll.purpose}: ` : ''}
            <span className="font-mono text-[11px]">
              {roll.diceType} ({roll.rolls.join('+')}
              {roll.modifier !== 0 ? `${roll.modifier >= 0 ? '+' : ''}${roll.modifier}` : ''}) ={' '}
            </span>
            <strong className="text-[#ffd98a] font-mono text-xs">{roll.total}</strong>

            {isD20 && targetDC !== undefined && (
              <span
                className={`ml-1.5 px-1.5 py-0.5 rounded text-[10px] font-sans font-bold uppercase tracking-wider ${
                  roll.isCriticalSuccess
                    ? 'bg-[#3d3119] text-[#ffd98a] border border-[#c5a059]'
                    : roll.isCriticalFail
                    ? 'bg-[#3b1818] text-[#fca5a5] border border-[#7f2626]'
                    : isSuccess
                    ? 'bg-[#183624] text-[#a7f3d0] border border-[#2d5a3f]'
                    : 'bg-[#361a1a] text-[#fecaca] border border-[#6b2c2c]'
                }`}
              >
                {roll.isCriticalSuccess
                  ? '★ Триумф'
                  : roll.isCriticalFail
                  ? '☠ Рок'
                  : isSuccess
                  ? `✓ Успех (${roll.total} ≥ ${targetDC})`
                  : `✗ Провал (${roll.total} < ${targetDC})`}
              </span>
            )}
          </span>
        );
      })}
    </div>
  );
};
