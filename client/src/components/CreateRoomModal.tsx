import React, { useState } from 'react';
import { api } from '../services/api';
import { Sparkles, Key, Compass, Shield, ArrowLeft } from 'lucide-react';

interface CreateRoomModalProps {
  onRoomCreated: (code: string) => void;
  onCancel: () => void;
}

const SETTING_TEMPLATES = [
  {
    title: 'Заброшенный склеп под Вайтруном',
    setting: 'Древний каменный склеп, скрытый под корнями старого дуба. По слухам, здесь покоится не упокоенный некромант со своей армией нежити. Холодный сквозняк колышет факелы отряда. В воздухе пахнет сыростью и темной магией.'
  },
  {
    title: 'Засада в Сумеречном Лесу',
    setting: 'Караван торговцев был атакован бандами гоблинов и хобгоблинов на тракте через Сумеречный Лес. Отряд наемников прибыл на место крушения телег. Вокруг следы борьбы, кровь на листьях и звуки подкрадывающихся тварей среди густых ветвей.'
  },
  {
    title: 'Таверна «Пьяный Грифон» перед штурмом',
    setting: 'Уютная теплая таверна на краю диких земель. За окнами бушует буря, а к дверям приближается отряд разбойников с факелами. В трактире только вы, трактирщик и пара испуганных крестьян. Пора занять оборону!'
  }
];

export const CreateRoomModal: React.FC<CreateRoomModalProps> = ({ onRoomCreated, onCancel }) => {
  const [title, setTitle] = useState(SETTING_TEMPLATES[0].title);
  const [setting, setSetting] = useState(SETTING_TEMPLATES[0].setting);
  const [customApiKey, setCustomApiKey] = useState('');
  const [showKeyField, setShowKeyField] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSelectTemplate = (tpl: typeof SETTING_TEMPLATES[0]) => {
    setTitle(tpl.title);
    setSetting(tpl.setting);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !setting.trim()) {
      setError('Заполните название и описание сеттинга');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const room = await api.createRoom({
        title,
        setting,
        deepseekApiKey: customApiKey.trim() || undefined,
      });
      onRoomCreated(room.code);
    } catch (err: any) {
      setError(err.message || 'Ошибка создания комнаты');
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto p-4 sm:p-6">
      <button
        onClick={onCancel}
        className="flex items-center gap-2 text-sm text-slate-400 hover:text-amber-400 mb-6 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" /> Назад
      </button>

      <div className="bg-fantasy-panel border border-fantasy-border rounded-2xl p-6 sm:p-8 shadow-2xl relative overflow-hidden">
        <div className="mb-6 border-b border-fantasy-border pb-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-400">
              <Compass className="w-6 h-6" />
            </div>
            <h2 className="text-2xl font-bold font-rpg text-amber-400">
              Создать игровую комнату
            </h2>
          </div>
          <p className="text-sm text-slate-400">
            Задайте сеттинг и преамбулу приключения. ИИ-Мастер будет вести сюжет строго по этим правилам.
          </p>
        </div>

        {error && (
          <div className="mb-6 p-3 rounded-xl bg-red-900/30 border border-red-700/50 text-red-300 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Templates */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
              Готовые шаблоны сценариев
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {SETTING_TEMPLATES.map((tpl, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => handleSelectTemplate(tpl)}
                  className={`p-3 rounded-xl border text-left text-xs transition-all ${
                    title === tpl.title
                      ? 'bg-amber-500/15 border-amber-500 text-amber-300 shadow-glow-gold'
                      : 'bg-fantasy-card border-fantasy-border text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <div className="font-bold text-sm text-slate-200 mb-1">{tpl.title}</div>
                  <div className="line-clamp-2 text-slate-400 text-[11px]">{tpl.setting}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Title */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
              Название кампании / сессии *
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Например: Забытые сокровища башни мага"
              className="w-full px-4 py-2.5 bg-fantasy-card border border-fantasy-border rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-500 text-sm"
            />
          </div>

          {/* Setting */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
              Сеттинг и завязка сюжета (Преамбула) *
            </label>
            <textarea
              rows={4}
              required
              value={setting}
              onChange={(e) => setSetting(e.target.value)}
              placeholder="Опишите мир, локацию, начальную обстановку, опасности и цели героев. ИИ-Мастер адаптирует повествование под ваше описание."
              className="w-full px-4 py-2.5 bg-fantasy-card border border-fantasy-border rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-500 text-sm"
            />
          </div>

          {/* Custom API Key toggle */}
          <div>
            <button
              type="button"
              onClick={() => setShowKeyField(!showKeyField)}
              className="flex items-center gap-1.5 text-xs text-amber-400 hover:text-amber-300 font-medium transition-colors"
            >
              <Key className="w-3.5 h-3.5" />
              {showKeyField ? 'Скрыть настройки API-ключа' : 'Указать свой API-ключ нейросети (необязательно)'}
            </button>
            {showKeyField && (
              <div className="mt-2 p-3 bg-fantasy-card border border-fantasy-border/80 rounded-xl space-y-2">
                <label className="block text-[11px] text-slate-300 font-medium">
                  Свой ключ Google Gemini или DeepSeek:
                </label>
                <input
                  type="password"
                  value={customApiKey}
                  onChange={(e) => setCustomApiKey(e.target.value)}
                  placeholder="Вставьте API-ключ (AQ... или sk-...)"
                  className="w-full px-3 py-2 bg-slate-900/80 border border-fantasy-border rounded-lg text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-500 font-mono"
                />
                <p className="text-[10px] text-slate-400">
                  Если поле оставить пустым, игра автоматически использует встроенную быструю нейросеть платформы (Google Gemini).
                </p>
              </div>
            )}
          </div>

          {/* AI Master Engine Status */}
          <div className="p-4 bg-fantasy-card/70 border border-fantasy-border rounded-xl flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse flex-shrink-0"></span>
              <div>
                <h4 className="text-sm font-bold font-rpg text-amber-300">
                  Нейросеть Google Gemini активна
                </h4>
                <p className="text-[11px] text-slate-400">
                  ИИ-Мастер вводит в сюжет, создает пролог и генерирует литературную хронику ходов по правилам D&D 5e
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-fantasy-panel border border-fantasy-border rounded-lg text-xs text-emerald-400 font-semibold flex-shrink-0">
              <Shield className="w-3.5 h-3.5" />
              Нейросеть подключена
            </div>
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
              disabled={isLoading}
              className="px-6 py-2.5 bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-slate-950 font-bold font-rpg rounded-xl shadow-lg shadow-amber-600/30 transition-all flex items-center gap-2 disabled:opacity-50"
            >
              <Sparkles className="w-4 h-4" />
              {isLoading ? 'Создание комнаты...' : 'Создать и получить ссылку'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
