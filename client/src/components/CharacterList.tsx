import React from 'react';
import { Character } from '../types';
import { api } from '../services/api';
import {
  Shield,
  Heart,
  Sparkles,
  Plus,
  Trash2,
  Backpack,
  Sword,
  Dices
} from 'lucide-react';

interface CharacterListProps {
  characters: Character[];
  onSelectCharacter?: (char: Character) => void;
  onCreateNew: () => void;
  onRefresh: () => void;
}

export const CharacterList: React.FC<CharacterListProps> = ({
  characters,
  onSelectCharacter,
  onCreateNew,
  onRefresh,
}) => {
  const calcMod = (score: number) => {
    const m = Math.floor((score - 10) / 2);
    return m >= 0 ? `+${m}` : `${m}`;
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!confirm('Вы уверены, что хотите удалить этого персонажа?')) return;
    try {
      await api.deleteCharacter(id);
      onRefresh();
    } catch (err) {
      alert('Ошибка при удалении персонажа');
    }
  };

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h2 className="text-3xl font-bold font-rpg text-amber-400">
            Ваши герои D&D
          </h2>
          <p className="text-sm text-slate-400 mt-1">
            Выберите персонажа для участия в сессиях или создайте нового искателя приключений.
          </p>
        </div>
        <button
          onClick={onCreateNew}
          className="px-5 py-2.5 bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-slate-950 font-bold font-rpg rounded-xl shadow-lg shadow-amber-600/30 transition-all flex items-center gap-2 self-start sm:self-auto"
        >
          <Plus className="w-5 h-5" />
          Создать персонажа
        </button>
      </div>

      {characters.length === 0 ? (
        <div className="bg-fantasy-panel border border-fantasy-border rounded-2xl p-12 text-center max-w-xl mx-auto my-8">
          <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 mx-auto mb-4 shadow-glow-gold">
            <Sparkles className="w-8 h-8" />
          </div>
          <h3 className="text-xl font-bold font-rpg text-slate-200 mb-2">
            У вас пока нет персонажей
          </h3>
          <p className="text-sm text-slate-400 mb-6">
            Создайте своего первого героя: выберите расу, класс, характеристики и отправляйтесь в приключение с ИИ-Мастером!
          </p>
          <button
            onClick={onCreateNew}
            className="px-6 py-3 bg-amber-500 hover:bg-amber-400 text-black font-bold font-rpg rounded-xl transition-colors inline-flex items-center gap-2"
          >
            <Plus className="w-5 h-5" />
            Создать первого героя
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {characters.map((char) => {
            const hpPercent = Math.round((char.hpCurrent / char.hpMax) * 100);
            return (
              <div
                key={char.id}
                onClick={() => onSelectCharacter && onSelectCharacter(char)}
                className="bg-fantasy-panel border border-fantasy-border hover:border-amber-500/60 rounded-2xl p-5 shadow-xl transition-all duration-200 hover:-translate-y-1 group relative flex flex-col justify-between"
              >
                <div>
                  {/* Top Row: Avatar & Basic Info */}
                  <div className="flex items-start gap-4 mb-4">
                    <img
                      src={char.avatarUrl}
                      alt={char.name}
                      className="w-16 h-16 rounded-xl object-cover border-2 border-amber-500/70 shadow-glow-gold"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = `https://api.dicebear.com/7.x/bottts/svg?seed=${char.name}`;
                      }}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <h3 className="text-lg font-bold font-rpg text-amber-300 truncate">
                          {char.name}
                        </h3>
                        <button
                          onClick={(e) => handleDelete(e, char.id)}
                          title="Удалить персонажа"
                          className="text-slate-500 hover:text-red-400 p-1 rounded transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {char.race} • {char.characterClass} (Уровень {char.level})
                      </p>

                      {/* HP & AC Mini Badges */}
                      <div className="flex items-center gap-3 mt-2">
                        <div className="flex items-center gap-1 text-xs font-bold text-emerald-400">
                          <Heart className="w-3.5 h-3.5" />
                          <span>{char.hpCurrent} / {char.hpMax} HP</span>
                        </div>
                        <div className="flex items-center gap-1 text-xs font-bold text-blue-400">
                          <Shield className="w-3.5 h-3.5" />
                          <span>{char.ac} КБ</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* HP Progress Bar */}
                  <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden mb-4">
                    <div
                      className={`h-full transition-all ${
                        hpPercent > 50 ? 'bg-emerald-500' : hpPercent > 25 ? 'bg-amber-500' : 'bg-red-500'
                      }`}
                      style={{ width: `${hpPercent}%` }}
                    ></div>
                  </div>

                  {/* Stats Grid */}
                  <div className="grid grid-cols-6 gap-1 text-center bg-fantasy-card p-2 rounded-xl border border-fantasy-border/60 mb-4">
                    {[
                      { l: 'СИЛ', v: char.stats.str },
                      { l: 'ЛОВ', v: char.stats.dex },
                      { l: 'ТЕЛ', v: char.stats.con },
                      { l: 'ИНТ', v: char.stats.int },
                      { l: 'МУД', v: char.stats.wis },
                      { l: 'ХАР', v: char.stats.cha },
                    ].map((s, i) => (
                      <div key={i} className="text-[10px]">
                        <span className="text-slate-400 font-semibold block">{s.l}</span>
                        <span className="font-bold text-amber-400">{s.v}</span>
                        <span className="text-slate-500 block text-[9px]">({calcMod(s.v)})</span>
                      </div>
                    ))}
                  </div>

                  {/* Abilities Preview */}
                  <div className="space-y-1 mb-3">
                    <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                      <Sword className="w-3 h-3 text-amber-500" /> Способности
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {char.abilities.slice(0, 3).map((a) => (
                        <span
                          key={a.id}
                          className="px-2 py-0.5 rounded-md bg-slate-800/80 border border-slate-700 text-[11px] text-slate-300 truncate max-w-[200px]"
                        >
                          {a.name}
                        </span>
                      ))}
                      {char.abilities.length > 3 && (
                        <span className="px-1.5 py-0.5 text-[10px] text-slate-500">
                          +{char.abilities.length - 3}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Inventory Preview */}
                  <div>
                    <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                      <Backpack className="w-3 h-3 text-amber-500" /> Снаряжение
                    </div>
                    <p className="text-xs text-slate-400 truncate">
                      {char.inventory.map((i) => i.name).join(', ')}
                    </p>
                  </div>
                </div>

                {onSelectCharacter && (
                  <button
                    onClick={() => onSelectCharacter(char)}
                    className="w-full mt-4 py-2 bg-amber-500/15 hover:bg-amber-500 text-amber-300 hover:text-black font-semibold text-xs font-rpg rounded-lg border border-amber-500/40 transition-all flex items-center justify-center gap-1.5"
                  >
                    <Dices className="w-3.5 h-3.5" />
                    Выбрать этого героя
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
