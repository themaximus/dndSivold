import React from 'react';
import { RoomLootItem } from '../../types';
import { Package, Shield, Sword, Sparkles, PlusCircle } from 'lucide-react';

interface LootDropsBarProps {
  loot: RoomLootItem[];
  onPickup: (lootId: string) => void;
  disabled?: boolean;
}

export const LootDropsBar: React.FC<LootDropsBarProps> = ({ loot, onPickup, disabled = false }) => {
  if (!loot || loot.length === 0) return null;

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
    <div className="mx-4 my-2 p-3 bg-gradient-to-r from-amber-950/40 via-purple-950/30 to-amber-950/40 border border-amber-500/30 rounded-xl shadow-lg">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-rpg font-semibold text-amber-300 flex items-center gap-1.5">
          <Package className="w-4 h-4 text-amber-400" />
          Добыча на поле боя:
        </span>
        <span className="text-[10px] text-slate-400 font-sans">
          Предметы, найденные в ходе повествования
        </span>
      </div>

      <div className="flex flex-wrap gap-2">
        {loot.map(item => (
          <div
            key={item.id}
            className="flex items-center justify-between gap-2.5 px-3 py-1.5 bg-fantasy-card/90 border border-fantasy-border hover:border-amber-500/50 rounded-lg text-xs transition-all shadow-sm group"
          >
            <div className="flex items-center gap-2">
              {getItemIcon(item.type)}
              <div>
                <span className="font-medium text-slate-200">{item.name}</span>
                {item.damage && <span className="ml-1 text-[10px] text-amber-400 font-mono">({item.damage})</span>}
                {item.ac_bonus && <span className="ml-1 text-[10px] text-blue-400 font-mono">(+{item.ac_bonus} КБ)</span>}
                {item.healAmount && <span className="ml-1 text-[10px] text-emerald-400 font-mono">(+{item.healAmount} HP)</span>}
              </div>
            </div>

            <button
              type="button"
              disabled={disabled}
              onClick={() => onPickup(item.id)}
              className="px-2 py-0.5 bg-amber-500/20 hover:bg-amber-500 text-amber-300 hover:text-black font-semibold text-[11px] rounded transition-colors flex items-center gap-1 disabled:opacity-50"
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
