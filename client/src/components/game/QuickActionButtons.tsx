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
    <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
      <span className="text-[#c5a059] text-xs font-rpg font-bold whitespace-nowrap">⚡ Быстрые действия:</span>
      {abilities.map(a => (
        <button
          key={a.id}
          type="button"
          onClick={() => onSelectAction(`Применяю способность "${a.name}": ${a.description}.`)}
          className="px-3 py-1 rounded-lg bg-gradient-to-b from-[#1c2438] to-[#101624] hover:from-[#2a3654] hover:to-[#172033] border border-[#3b82f6]/70 text-[#bfdbfe] hover:text-white whitespace-nowrap text-xs font-rpg font-bold transition-all shadow-sm active:translate-y-0.5 flex items-center gap-1"
        >
          <span>✨</span>
          <span>{a.name}</span>
        </button>
      ))}
      {weapons.map(w => (
        <button
          key={w.id}
          type="button"
          onClick={() => onSelectAction(`Атакую оружием ${w.name}.`)}
          className="px-3 py-1 rounded-lg bg-gradient-to-b from-[#2b1418] to-[#180a0c] hover:from-[#3d1d22] hover:to-[#220e11] border border-[#ef4444]/70 text-[#fca5a5] hover:text-white whitespace-nowrap text-xs font-rpg font-bold transition-all shadow-sm active:translate-y-0.5 flex items-center gap-1"
        >
          <span>⚔️</span>
          <span>{w.name}</span>
        </button>
      ))}
    </div>
  );
};
