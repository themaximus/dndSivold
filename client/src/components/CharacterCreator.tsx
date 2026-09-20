import React, { useState } from 'react';
import { Character, CharacterStats } from '../types';
import { api } from '../services/api';
import {
  Shield,
  Heart,
  Sparkles,
  Sword,
  Wand2,
  Backpack,
  ArrowLeft,
  Check,
  RefreshCw
} from 'lucide-react';

interface CharacterCreatorProps {
  onCreated: (character: Character) => void;
  onCancel: () => void;
}

const RACES = [
  { id: 'Человек', desc: 'Универсальный и стойкий (+1 ко всем характеристикам)' },
  { id: 'Эльф', desc: 'Ловкий, грациозный, с острыми чувствами и темным зрением' },
  { id: 'Дворф', desc: 'Выносливый воин, знаток камня и мастер брони' },
  { id: 'Полуорк', desc: 'Неукротимая сила и способность выдерживать смертельные удары' },
  { id: 'Тифлинг', desc: 'Обаятельный и опасный, владеющий наследием темного пламени' },
];

const CLASSES = [
  { id: 'fighter', nameRu: 'Воин', icon: Sword, desc: 'Мастер владения любым оружием и тяжелыми доспехами' },
  { id: 'wizard', nameRu: 'Волшебник', icon: Wand2, desc: 'Владетель разрушительных заклинаний и тайных знаний' },
  { id: 'rogue', nameRu: 'Плут', icon: Sparkles, desc: 'Мастер скрытности, точечных ударов и поиска ловушек' },
  { id: 'cleric', nameRu: 'Жрец', icon: Shield, desc: 'Служитель богов, целитель и защитник от нежити' },
  { id: 'barbarian', nameRu: 'Варвар', icon: Sword, desc: 'Яростный боец с колоссальным запасом жизненных сил' },
  { id: 'ranger', nameRu: 'Следопыт', icon: Sparkles, desc: 'Охотник пустошей, мастер дальнего боя и выслеживания' },
];

const AVATAR_PRESETS = [
  'https://images.unsplash.com/photo-1579783902614-a3fb3927b675?auto=format&fit=crop&w=300&q=80',
  'https://images.unsplash.com/photo-1534447677768-be436bb09401?auto=format&fit=crop&w=300&q=80',
  'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=300&q=80',
  'https://images.unsplash.com/photo-1563089145-599997674d42?auto=format&fit=crop&w=300&q=80',
  'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=300&q=80',
];

export const CharacterCreator: React.FC<CharacterCreatorProps> = ({ onCreated, onCancel }) => {
  const [name, setName] = useState('');
  const [race, setRace] = useState('Человек');
  const [characterClass, setCharacterClass] = useState('fighter');
  const [stats, setStats] = useState<CharacterStats>({
    str: 15,
    dex: 14,
    con: 13,
    int: 12,
    wis: 10,
    cha: 8,
  });
  const [bio, setBio] = useState('');
  const [avatarUrl, setAvatarUrl] = useState(AVATAR_PRESETS[0]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const calcMod = (score: number) => Math.floor((score - 10) / 2);

  const rollStats4d6 = () => {
    const rollSingle = () => {
      const rolls = [
        Math.floor(Math.random() * 6) + 1,
        Math.floor(Math.random() * 6) + 1,
        Math.floor(Math.random() * 6) + 1,
        Math.floor(Math.random() * 6) + 1,
      ];
      rolls.sort((a, b) => a - b);
      return rolls[1] + rolls[2] + rolls[3]; // Drop lowest
    };

    setStats({
      str: rollSingle(),
      dex: rollSingle(),
      con: rollSingle(),
      int: rollSingle(),
      wis: rollSingle(),
      cha: rollSingle(),
    });
  };

  const setStandardArray = () => {
    setStats({
      str: 15,
      dex: 14,
      con: 13,
      int: 12,
      wis: 10,
      cha: 8,
    });
  };

  // Live estimated stats
  const conMod = calcMod(stats.con);
  const dexMod = calcMod(stats.dex);
  const hitDieMap: Record<string, number> = {
    fighter: 10,
    wizard: 6,
    rogue: 8,
    cleric: 8,
    barbarian: 12,
    ranger: 10,
  };
  const hitDie = hitDieMap[characterClass] || 8;
  const estimatedHp = Math.max(1, hitDie + conMod);
  const estimatedAc = characterClass === 'fighter' ? 16 : 10 + dexMod + 1;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Пожалуйста, введите имя персонажа');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      const created = await api.createCharacter({
        name,
        race,
        characterClass,
        stats,
        bio,
        avatarUrl,
      });
      onCreated(created);
    } catch (err: any) {
      setError(err.message || 'Ошибка создания персонажа');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-6">
      <button
        onClick={onCancel}
        className="flex items-center gap-2 text-sm text-slate-400 hover:text-amber-400 mb-6 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" /> Назад к списку персонажей
      </button>

      <div className="bg-fantasy-panel border border-fantasy-border rounded-2xl p-6 sm:p-8 shadow-2xl relative overflow-hidden">
        <div className="mb-6 border-b border-fantasy-border pb-4">
          <h2 className="text-2xl font-bold font-rpg text-amber-400">
            Создание нового персонажа
          </h2>
          <p className="text-sm text-slate-400">
            Сформируйте героя по канонам D&D 5e. Навыки и экипировка конвертируются автоматически.
          </p>
        </div>

        {error && (
          <div className="mb-6 p-3 rounded-xl bg-red-900/30 border border-red-700/50 text-red-300 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Main Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                Имя персонажа *
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Например: Роланд Железнорукий"
                className="w-full px-4 py-2.5 bg-fantasy-card border border-fantasy-border rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-500 text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                Раса
              </label>
              <select
                value={race}
                onChange={(e) => setRace(e.target.value)}
                className="w-full px-4 py-2.5 bg-fantasy-card border border-fantasy-border rounded-xl text-slate-100 focus:outline-none focus:border-amber-500 text-sm"
              >
                {RACES.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.id}
                  </option>
                ))}
              </select>
              <p className="text-xs text-slate-500 mt-1">
                {RACES.find((r) => r.id === race)?.desc}
              </p>
            </div>
          </div>

          {/* Class Selection */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
              Класс героя (D&D 5e)
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {CLASSES.map((c) => {
                const Icon = c.icon;
                const isSelected = characterClass === c.id;
                return (
                  <div
                    key={c.id}
                    onClick={() => setCharacterClass(c.id)}
                    className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                      isSelected
                        ? 'bg-amber-500/15 border-amber-500 text-amber-300 shadow-glow-gold'
                        : 'bg-fantasy-card border-fantasy-border text-slate-300 hover:border-slate-500'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <Icon className="w-4 h-4 text-amber-400" />
                      <span className="font-bold text-sm font-rpg">{c.nameRu}</span>
                    </div>
                    <p className="text-xs text-slate-400 line-clamp-2">{c.desc}</p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Stats Rolling */}
          <div className="border border-fantasy-border bg-fantasy-card/50 rounded-xl p-4">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
              <div>
                <h4 className="text-sm font-bold font-rpg text-amber-400">
                  Характеристики персонажа
                </h4>
                <p className="text-xs text-slate-400">
                  Базовые параметры влияют на здоровье, класс брони и проверки кубика
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={setStandardArray}
                  className="px-2.5 py-1 text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg border border-slate-700"
                >
                  Стандартный набор
                </button>
                <button
                  type="button"
                  onClick={rollStats4d6}
                  className="px-2.5 py-1 text-xs bg-amber-600 hover:bg-amber-500 text-black font-semibold rounded-lg flex items-center gap-1 shadow-sm"
                >
                  <RefreshCw className="w-3 h-3" /> Бросить 4d6
                </button>
              </div>
            </div>

            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 text-center">
              {[
                { key: 'str', label: 'Сила' },
                { key: 'dex', label: 'Ловкость' },
                { key: 'con', label: 'Телосложение' },
                { key: 'int', label: 'Интеллект' },
                { key: 'wis', label: 'Мудрость' },
                { key: 'cha', label: 'Харизма' },
              ].map(({ key, label }) => {
                const val = stats[key as keyof CharacterStats];
                const mod = calcMod(val);
                return (
                  <div key={key} className="bg-fantasy-panel border border-fantasy-border p-2.5 rounded-xl">
                    <span className="text-[11px] uppercase font-bold text-slate-400 block">{label}</span>
                    <input
                      type="number"
                      min={3}
                      max={20}
                      value={val}
                      onChange={(e) =>
                        setStats({ ...stats, [key]: parseInt(e.target.value, 10) || 10 })
                      }
                      className="w-14 text-center text-lg font-bold font-rpg bg-transparent text-amber-400 focus:outline-none my-1"
                    />
                    <div className="text-xs text-slate-300 font-semibold">
                      {mod >= 0 ? `+${mod}` : mod}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Live Stats Preview */}
            <div className="flex gap-4 mt-4 pt-3 border-t border-fantasy-border/60 text-xs">
              <div className="flex items-center gap-1.5 text-emerald-400 font-semibold">
                <Heart className="w-4 h-4" /> Здоровье (HP): {estimatedHp}
              </div>
              <div className="flex items-center gap-1.5 text-blue-400 font-semibold">
                <Shield className="w-4 h-4" /> Класс брони (КБ): {estimatedAc}
              </div>
              <div className="flex items-center gap-1.5 text-amber-400 font-semibold">
                <Backpack className="w-4 h-4" /> Стартовое снаряжение: Включено
              </div>
            </div>
          </div>

          {/* Avatar & Appearance */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
              Портрет / Аватар
            </label>
            <div className="flex items-center gap-4 mb-3">
              <img
                src={avatarUrl}
                alt="Avatar"
                className="w-16 h-16 rounded-xl object-cover border-2 border-amber-500 shadow-glow-gold"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = `https://api.dicebear.com/7.x/bottts/svg?seed=hero`;
                }}
              />
              <div className="flex-1">
                <input
                  type="text"
                  value={avatarUrl}
                  onChange={(e) => setAvatarUrl(e.target.value)}
                  placeholder="URL изображения или выберите из галереи"
                  className="w-full px-3 py-2 bg-fantasy-card border border-fantasy-border rounded-xl text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-500"
                />
                <div className="flex gap-2 mt-2">
                  {AVATAR_PRESETS.map((p, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setAvatarUrl(p)}
                      className="w-8 h-8 rounded-lg overflow-hidden border border-slate-700 hover:border-amber-500 transition-colors"
                    >
                      <img src={p} alt="Preset" className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Bio */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
              Биография и описание внешности
            </label>
            <textarea
              rows={3}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Опишите характер, манеры, приметы или происхождение вашего героя. ИИ Мастер будет учитывать это в диалогах!"
              className="w-full px-4 py-2.5 bg-fantasy-card border border-fantasy-border rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-500 text-sm"
            />
          </div>

          {/* Submit */}
          <div className="flex justify-end gap-3 pt-4 border-t border-fantasy-border">
            <button
              type="button"
              onClick={onCancel}
              className="px-5 py-2.5 rounded-xl border border-fantasy-border text-slate-300 hover:bg-slate-800 text-sm font-medium transition-colors"
            >
              Отмена
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-6 py-2.5 bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-slate-950 font-bold font-rpg rounded-xl shadow-lg shadow-amber-600/30 transition-all flex items-center gap-2 disabled:opacity-50"
            >
              <Check className="w-4 h-4" />
              {isSubmitting ? 'Создание...' : 'Создать героя'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
