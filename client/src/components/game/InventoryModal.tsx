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
      <div className="w-full max-w-xl bg-[#13161d] border border-[#3b4455] rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#2a303d] flex items-center justify-between bg-[#0e1117]">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-[#1f1b13] rounded border border-[#524126] text-[#c5a059]">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-rpg font-bold text-[#ffd98a] tracking-wide">Инвентарь героя</h2>
              <p className="text-xs text-[#8e8574] font-serif">{character.name} • Здоровье: {character.hpCurrent}/{character.hpMax} HP</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-[#8e8574] hover:text-[#ded7c8] hover:bg-[#1a202c] rounded transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-3 flex-1 custom-scrollbar">
          {items.length === 0 ? (
            <div className="text-center py-12 text-[#8e8574] font-serif text-sm italic">
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
                  className={`p-3.5 rounded border transition-all flex flex-col gap-2.5 ${
                    isEquipped
                      ? 'bg-[#1f1b13] border-[#c5a059]/60 shadow-sm'
                      : 'bg-[#181c26] border-[#2a303d] hover:border-[#3d4554]'
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <div className="p-2 bg-[#0e1117] rounded border border-[#2a303d] mt-0.5">
                        {getItemIcon(item.type)}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-serif font-semibold text-sm text-[#ded7c8]">{item.name}</span>
                          {item.quantity > 1 && (
                            <span className="text-xs text-[#ffd98a] font-mono font-bold">x{item.quantity}</span>
                          )}
                          {isEquipped && (
                            <span className="px-2 py-0.5 bg-[#2a2416] border border-[#c5a059] text-[#ffd98a] text-[10px] font-serif font-bold rounded flex items-center gap-1">
                              <Check className="w-2.5 h-2.5" /> Экипировано
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-[#8e8574] font-serif mt-0.5 line-clamp-2">{item.description}</p>
                        <div className="flex items-center gap-3 mt-1 text-[11px] font-mono">
                          {item.damage && <span className="text-[#ffd98a]">Урон: {item.damage}</span>}
                          {item.ac_bonus && <span className="text-[#93c5fd]">КБ: +{item.ac_bonus}</span>}
                          {item.healAmount && <span className="text-[#6ee7b7]">Исцеление: +{item.healAmount} HP</span>}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0">
                      {isPotion && (
                        <button
                          type="button"
                          onClick={() => onUseItem(item.id)}
                          className="px-3 py-1 bg-[#172e21] hover:bg-[#20422f] border border-[#2e6b43] text-[#a7f3d0] font-serif text-xs rounded transition-colors flex items-center gap-1.5"
                        >
                          <Heart className="w-3.5 h-3.5" />
                          Выпить
                        </button>
                      )}

                      {isWeapon && !isEquipped && (
                        <button
                          type="button"
                          onClick={() => onEquipWeapon(item.id)}
                          className="px-3 py-1 bg-[#252016] hover:bg-[#382f1e] border border-[#5a482b] hover:border-[#c5a059] text-[#ffd98a] font-serif text-xs rounded transition-colors flex items-center gap-1.5"
                        >
                          <Sword className="w-3.5 h-3.5" />
                          Экипировать
                        </button>
                      )}
                    </div>
                  </div>

                  {item.history && item.history.length > 0 && (
                    <div className="mt-1 pt-2 border-t border-[#2a303d] space-y-1">
                      <span className="text-[10px] uppercase font-rpg font-bold tracking-wider text-[#c5a059]">Хроника предмета:</span>
                      <ul className="space-y-0.5 pl-1">
                        {item.history.map((h, i) => (
                          <li key={i} className="text-[11px] text-[#ded7c8] font-serif flex items-start gap-1.5 leading-relaxed">
                            <span className="text-[#c5a059] text-[10px] select-none mt-0.5">•</span>
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
        <div className="px-6 py-3 border-t border-[#2a303d] bg-[#0e1117] flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-[#181c25] hover:bg-[#222735] border border-[#2a303d] text-[#ded7c8] font-serif rounded text-xs font-semibold transition-colors"
          >
            Закрыть
          </button>
        </div>
      </div>
    </div>
  );
};
