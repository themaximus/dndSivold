import React from 'react';
import { Character } from '../../types';

interface QuickActionButtonsProps {
  character: Character | null;
  onSelectAction: (actionText: string) => void;
}

export const QuickActionButtons: React.FC<QuickActionButtonsProps> = ({
  character,
  onSelectAction,
}) => {
  if (!character) return null;

  const abilities = character.abilities.slice(0, 3);
  const weapons = character.inventory.filter(i => i.type === 'weapon');

  if (abilities.length === 0 && weapons.length === 0) return null;

  return (
    <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
      <span className="text-[#8e8574] text-[11px] font-serif whitespace-nowrap">Быстрые действия:</span>
      {abilities.map(a => (
        <button
          key={a.id}
          type="button"
          onClick={() => onSelectAction(`Применяю способность "${a.name}": ${a.description}.`)}
          className="px-2.5 py-1 rounded bg-[#181c25] hover:bg-[#222735] border border-[#2a303d] hover:border-[#c5a059]/60 text-[#ded7c8] whitespace-nowrap text-[11px] font-serif transition-colors"
        >
          ⚡ {a.name}
        </button>
      ))}
      {weapons.map(w => (
        <button
          key={w.id}
          type="button"
          onClick={() => onSelectAction(`Атакую оружием ${w.name}.`)}
          className="px-2.5 py-1 rounded bg-[#181c25] hover:bg-[#222735] border border-[#2a303d] hover:border-[#c5a059]/60 text-[#ded7c8] whitespace-nowrap text-[11px] font-serif transition-colors"
        >
          ⚔️ {w.name}
        </button>
      ))}
    </div>
  );
};
