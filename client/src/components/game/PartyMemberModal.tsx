import React from 'react';
import { Character } from '../../types';
import { X, Shield, Heart, Sword, Package, Sparkles, Scroll, User } from 'lucide-react';

interface PartyMemberModalProps {
  isOpen: boolean;
  onClose: () => void;
  character: Character | null;
}

export const PartyMemberModal: React.FC<PartyMemberModalProps> = ({
  isOpen,
  onClose,
  character,
}) => {
  if (!isOpen || !character) return null;

  const calcMod = (val: number) => {
    const mod = Math.floor((val - 10) / 2);
    return mod >= 0 ? `+${mod}` : `${mod}`;
  };

  const hpPercent = Math.max(0, Math.min(100, Math.round((character.hpCurrent / character.hpMax) * 100)));
  const isDead = character.lifeState === 'dead';
  const isDowned = character.lifeState === 'downed';

  const statList = [
    { key: 'str', label: 'Сила', val: character.stats.str },
    { key: 'dex', label: 'Ловкость', val: character.stats.dex },
    { key: 'con', label: 'Телосложение', val: character.stats.con },
    { key: 'int', label: 'Интеллект', val: character.stats.int },
    { key: 'wis', label: 'Мудрость', val: character.stats.wis },
    { key: 'cha', label: 'Харизма', val: character.stats.cha },
  ];

  const activeWeapon = character.inventory.find(i => i.id === character.activeWeaponId);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-2xl bg-fantasy-card border border-fantasy-border rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-fantasy-border flex items-center justify-between bg-fantasy-panel">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-600 to-amber-950 border border-amber-500/50 flex items-center justify-center font-bold text-amber-200 text-lg overflow-hidden shadow-md flex-shrink-0">
              {character.avatarUrl ? (
                <img src={character.avatarUrl} alt={character.name} className="w-full h-full object-cover" />
              ) : (
                character.name[0]?.toUpperCase()
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-rpg font-bold text-amber-300">{character.name}</h3>
                {isDead ? (
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-red-600/30 text-red-300 border border-red-500/50">
                    ☠ Погиб
                  </span>
                ) : isDowned ? (
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-600/30 text-rose-300 border border-rose-500/50 animate-pulse">
                    При смерти
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-600/20 text-emerald-300 border border-emerald-500/40">
                    В строю
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400">
                {character.race} • {character.characterClass} ({character.level} уровень)
              </p>
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
        <div className="p-6 overflow-y-auto space-y-5 flex-1 custom-scrollbar">
          {/* Health & Armor Class Row */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-fantasy-panel border border-fantasy-border/80 p-3.5 rounded-xl">
              <div className="flex items-center justify-between text-xs font-semibold mb-1.5">
                <span className="text-slate-400 flex items-center gap-1.5">
                  <Heart className="w-4 h-4 text-red-400" /> Очки здоровья (HP)
                </span>
                <span className="text-slate-200 font-mono">
                  {character.hpCurrent} / {character.hpMax}
                </span>
              </div>
              <div className="w-full bg-slate-800 h-2.5 rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all duration-500 ${
                    isDead ? 'bg-red-800' : isDowned ? 'bg-rose-600' : hpPercent > 50 ? 'bg-emerald-500' : hpPercent > 25 ? 'bg-amber-500' : 'bg-red-500'
                  }`}
                  style={{ width: `${hpPercent}%` }}
                />
              </div>
            </div>

            <div className="bg-fantasy-panel border border-fantasy-border/80 p-3.5 rounded-xl flex items-center justify-between">
              <div>
                <span className="text-xs text-slate-400 flex items-center gap-1.5">
                  <Shield className="w-4 h-4 text-amber-400" /> Класс брони (КБ)
                </span>
                <div className="text-xl font-bold font-mono text-amber-300 mt-0.5">
                  {character.ac}
                </div>
              </div>
              {activeWeapon && (
                <div className="text-right">
                  <span className="text-[10px] text-slate-500 uppercase tracking-wider block">Оружие в руке</span>
                  <span className="text-xs text-amber-200 font-medium flex items-center gap-1 justify-end">
                    <Sword className="w-3.5 h-3.5 text-amber-400" /> {activeWeapon.name}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* 6 Attributes Grid */}
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2.5 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" /> Характеристики D&D 5e
            </h4>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
              {statList.map(st => {
                const mod = calcMod(st.val);
                return (
                  <div
                    key={st.key}
                    className="bg-fantasy-panel border border-fantasy-border/80 p-2.5 rounded-xl text-center"
                  >
                    <div className="text-[11px] text-slate-400 uppercase font-medium">{st.label}</div>
                    <div className="text-lg font-bold font-mono text-amber-300">{st.val}</div>
                    <div className="text-xs font-mono font-bold text-slate-300 bg-black/40 rounded px-1 mt-0.5">
                      {mod}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Abilities */}
          {character.abilities && character.abilities.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2.5 flex items-center gap-1.5">
                <Scroll className="w-3.5 h-3.5 text-amber-400" /> Способности и заклинания
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {character.abilities.map((ab, idx) => (
                  <div
                    key={ab.id || idx}
                    className="bg-fantasy-panel border border-fantasy-border/70 p-3 rounded-xl space-y-1"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-amber-300">{ab.name}</span>
                      <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
                        {ab.type}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-300 leading-relaxed">{ab.description}</p>
                    {ab.damage && (
                      <div className="text-[10px] text-amber-400 font-mono">Урон: {ab.damage}</div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Inventory Items */}
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2.5 flex items-center gap-1.5">
              <Package className="w-3.5 h-3.5 text-amber-400" /> Инвентарь и снаряжение ({character.inventory?.length || 0})
            </h4>
            {character.inventory && character.inventory.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {character.inventory.map((item, idx) => (
                  <div
                    key={item.id || idx}
                    className="bg-fantasy-panel border border-fantasy-border/70 p-2.5 rounded-xl flex items-center justify-between text-xs"
                  >
                    <div>
                      <div className="font-semibold text-slate-200">{item.name}</div>
                      <div className="text-[10px] text-slate-400 truncate max-w-[200px]">
                        {item.description || item.type}
                      </div>
                    </div>
                    <div className="text-right">
                      {item.damage && (
                        <span className="text-[10px] text-amber-400 font-mono block">({item.damage})</span>
                      )}
                      {item.healAmount && (
                        <span className="text-[10px] text-emerald-400 font-mono block">(+{item.healAmount} HP)</span>
                      )}
                      <span className="text-[10px] text-slate-500 font-mono">x{item.quantity || 1}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-500 italic">Рюкзак пуст</p>
            )}
          </div>

          {/* Biography & Quenta */}
          {character.bio && (
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-amber-400" /> Квента и предыстория
              </h4>
              <div className="bg-fantasy-panel border border-fantasy-border/70 p-3.5 rounded-xl text-xs text-slate-300 leading-relaxed font-serif whitespace-pre-line">
                {character.bio}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-fantasy-border bg-fantasy-panel flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold transition-colors"
          >
            Закрыть
          </button>
        </div>
      </div>
    </div>
  );
};
