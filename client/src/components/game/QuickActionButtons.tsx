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
      <span className="text-slate-500 text-[11px] whitespace-nowrap">Быстрые действия:</span>
      {abilities.map(a => (
        <button
          key={a.id}
          type="button"
          onClick={() => onSelectAction(`Применяю способность "${a.name}": ${a.description}.`)}
          className="px-2.5 py-1 rounded-lg bg-slate-800/80 hover:bg-slate-700 border border-slate-700 text-slate-300 whitespace-nowrap text-[11px] transition-colors"
        >
          ⚡ {a.name}
        </button>
      ))}
      {weapons.map(w => (
        <button
          key={w.id}
          type="button"
          onClick={() => onSelectAction(`Атакую оружием ${w.name}.`)}
          className="px-2.5 py-1 rounded-lg bg-slate-800/80 hover:bg-slate-700 border border-slate-700 text-slate-300 whitespace-nowrap text-[11px] transition-colors"
        >
          ⚔️ {w.name}
        </button>
      ))}
    </div>
  );
};
