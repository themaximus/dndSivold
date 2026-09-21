import React from 'react';
import { Character, InventoryItem } from '../../types';
import { X, Package, Sword, Shield, Sparkles, Heart, Check } from 'lucide-react';

interface InventoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  character: Character | null;
  onUseItem: (itemId: string) => void;
  onEquipWeapon: (itemId: string) => void;
}

export const InventoryModal: React.FC<InventoryModalProps> = ({
  isOpen,
  onClose,
  character,
  onUseItem,
  onEquipWeapon,
}) => {
  if (!isOpen || !character) return null;

  const items = (character.inventory || []).filter(i => i && typeof i.name === 'string' && i.name.trim().length > 0);

  const getItemIcon = (type: string) => {
    switch (type) {
      case 'weapon':
        return <Sword className="w-4 h-4 text-amber-400" />;
      case 'armor':
        return <Shield className="w-4 h-4 text-blue-400" />;
      case 'potion':
        return <Sparkles className="w-4 h-4 text-emerald-400" />;
      default:
        return <Package className="w-4 h-4 text-purple-400" />;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-xl bg-fantasy-card border border-fantasy-border rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-fantasy-border flex items-center justify-between bg-fantasy-panel">
          <div className="flex items-center gap-3">
            <Package className="w-5 h-5 text-amber-400" />
            <div>
              <h2 className="text-base font-rpg font-bold text-amber-300">Инвентарь героя</h2>
              <p className="text-xs text-slate-400">{character.name} • Здоровье: {character.hpCurrent}/{character.hpMax} HP</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-100 hover:bg-slate-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-3 flex-1">
          {items.length === 0 ? (
            <div className="text-center py-12 text-slate-400 text-sm">
              Инвентарь пуст. Исследуйте мир и собирайте трофеи!
            </div>
          ) : (
            items.map(item => {
              const isEquipped = character.activeWeaponId === item.id;
              const isPotion = item.type === 'potion' || !!item.healAmount;
              const isWeapon = item.type === 'weapon';

              return (
                <div
                  key={item.id}
                  className={`p-3.5 rounded-xl border transition-all flex flex-col gap-2.5 ${
                    isEquipped
                      ? 'bg-amber-950/25 border-amber-500/50'
                      : 'bg-fantasy-panel/70 border-fantasy-border hover:border-slate-600'
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <div className="p-2 bg-slate-800/80 rounded-lg border border-slate-700/60 mt-0.5">
                        {getItemIcon(item.type)}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-sm text-slate-100">{item.name}</span>
                          {item.quantity > 1 && (
                            <span className="text-xs text-amber-400 font-mono font-bold">x{item.quantity}</span>
                          )}
                          {isEquipped && (
                            <span className="px-2 py-0.5 bg-amber-500/20 border border-amber-500/40 text-amber-300 text-[10px] font-bold rounded-full flex items-center gap-1">
                              <Check className="w-2.5 h-2.5" /> Экипировано
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-400 mt-0.5 line-clamp-2">{item.description}</p>
                        <div className="flex items-center gap-3 mt-1 text-[11px] font-mono">
                          {item.damage && <span className="text-amber-400">Урон: {item.damage}</span>}
                          {item.ac_bonus && <span className="text-blue-400">КБ: +{item.ac_bonus}</span>}
                          {item.healAmount && <span className="text-emerald-400">Исцеление: +{item.healAmount} HP</span>}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0">
                      {isPotion && (
                        <button
                          type="button"
                          onClick={() => onUseItem(item.id)}
                          className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs rounded-lg shadow-sm transition-colors flex items-center gap-1.5"
                        >
                          <Heart className="w-3.5 h-3.5" />
                          Выпить
                        </button>
                      )}

                      {isWeapon && !isEquipped && (
                        <button
                          type="button"
                          onClick={() => onEquipWeapon(item.id)}
                          className="px-3 py-1.5 bg-amber-500/20 hover:bg-amber-500 border border-amber-500/40 text-amber-300 hover:text-black font-semibold text-xs rounded-lg transition-colors flex items-center gap-1.5"
                        >
                          <Sword className="w-3.5 h-3.5" />
                          Экипировать
                        </button>
                      )}
                    </div>
                  </div>

                  {item.history && item.history.length > 0 && (
                    <div className="mt-1 pt-2 border-t border-slate-700/40 space-y-1">
                      <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Хроника предмета:</span>
                      <ul className="space-y-0.5 pl-1">
                        {item.history.map((h, i) => (
                          <li key={i} className="text-[11px] text-slate-300 flex items-start gap-1.5 leading-relaxed">
                            <span className="text-amber-500/80 text-[10px] select-none mt-0.5">•</span>
                            <span>{h}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-fantasy-border bg-fantasy-panel flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition-colors"
          >
            Закрыть
          </button>
        </div>
      </div>
    </div>
  );
};
