import React from 'react';
import { RoomLootItem } from '../../types';
import { Package, Shield, Sword, Sparkles, PlusCircle } from 'lucide-react';

interface LootDropsBarProps {
  loot: RoomLootItem[];
  onPickup: (lootId: string) => void;
  disabled?: boolean;
}

export const LootDropsBar: React.FC<LootDropsBarProps> = ({ loot, onPickup, disabled = false }) => {
  const validLoot = (loot || []).filter(item => item && typeof item.name === 'string' && item.name.trim().length > 0);
  if (validLoot.length === 0) return null;

  const getItemIcon = (type: string) => {
    switch (type) {
      case 'weapon':
        return <Sword className="w-3.5 h-3.5 text-amber-400" />;
      case 'armor':
        return <Shield className="w-3.5 h-3.5 text-blue-400" />;
      case 'potion':
        return <Sparkles className="w-3.5 h-3.5 text-emerald-400" />;
      default:
        return <Package className="w-3.5 h-3.5 text-purple-400" />;
    }
  };

  return (
    <div className="mx-4 my-2 p-3 bg-[#13161f] border border-[#3a3224] rounded-lg shadow-md">
      <div className="flex items-center justify-between mb-2 pb-1.5 border-b border-[#28231a]">
        <span className="text-xs font-rpg tracking-wider text-[#d8b872] flex items-center gap-1.5">
          <Package className="w-3.5 h-3.5 text-[#c5a059]" />
          Добыча на поле боя:
        </span>
        <span className="text-[10px] text-[#8e8574] font-serif italic">
          Предметы, найденные в ходе событий
        </span>
      </div>

      <div className="flex flex-wrap gap-2">
        {validLoot.map(item => (
          <div
            key={item.id}
            className="flex items-center justify-between gap-2.5 px-3 py-1.5 bg-[#181c26] border border-[#2a303d] hover:border-[#c5a059]/70 rounded text-xs transition-all shadow-sm group"
          >
            <div className="flex items-center gap-2">
              {getItemIcon(item.type)}
              <div>
                <span className="font-serif font-medium text-[#ded7c8]">{item.name}</span>
                {item.damage && <span className="ml-1 text-[10px] text-[#c5a059] font-mono">({item.damage})</span>}
                {item.ac_bonus && <span className="ml-1 text-[10px] text-[#7fb4e8] font-mono">(+{item.ac_bonus} КБ)</span>}
                {item.healAmount && <span className="ml-1 text-[10px] text-[#6ee7b7] font-mono">(+{item.healAmount} HP)</span>}
              </div>
            </div>

            <button
              type="button"
              disabled={disabled}
              onClick={() => onPickup(item.id)}
              className="px-2.5 py-0.5 bg-[#252016] hover:bg-[#382e1c] border border-[#5a482b] hover:border-[#c5a059] text-[#e0cfab] hover:text-[#ffd98a] font-serif text-[11px] tracking-wide rounded transition-all flex items-center gap-1 disabled:opacity-40"
            >
              <PlusCircle className="w-3 h-3" />
              Взять
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};
