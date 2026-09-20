import React, { useState } from 'react';
import { api } from '../services/api';
import { Sparkles, Key, Compass, Shield, ArrowLeft, Dices, Clock, Swords } from 'lucide-react';

interface CreateRoomModalProps {
  onRoomCreated: (code: string) => void;
  onCancel: () => void;
}

const GENRES = [
  { id: 'fantasy', name: 'Фэнтези', icon: '⚔️', desc: 'Мечи, магия, руины и драконы' },
  { id: 'cyberpunk', name: 'Киберпанк', icon: '🦾', desc: 'Импланты, хакеры, мегакорпорации' },
  { id: 'mafia', name: 'Мафия 1930', icon: '🕵️', desc: 'Сухой закон, Томпсоны, синдикаты' },
  { id: 'scifi', name: 'Sci-Fi Космос', icon: '🚀', desc: 'Бластеры, звездолёты, пришельцы' },
  { id: 'detective', name: 'Детектив', icon: '🔍', desc: 'Улики, погони, расследования' },
  { id: 'horror', name: 'Хоррор', icon: '🕯️', desc: 'Оккультизм, древние культы, безумие' },
];

const DURATIONS = [
  { id: 'short' as const, name: 'Короткая (Ваншот)', rounds: '10 раундов', badge: '10 р.', desc: 'Динамичный сюжет на один вечер' },
  { id: 'medium' as const, name: 'Средняя (Классика)', rounds: '16 раундов', badge: '16 р.', desc: 'Сбалансированная сюжетная арка' },
  { id: 'long' as const, name: 'Длительная (Эпос)', rounds: '20+ раундов', badge: '20+ р.', desc: 'Масштабная многоактовая сага' },
];

const SETTING_TEMPLATES: Record<string, Array<{ title: string; setting: string }>> = {
  fantasy: [
    {
      title: 'Заброшенный склеп под Вайтруном',
      setting: 'Древний каменный склеп, скрытый под корнями старого дуба. По слухам, здесь покоится не упокоенный некромант со своей армией нежити. Холодный сквозняк колышет факелы отряда. В воздухе пахнет сыростью и темной магией.'
    },
    {
      title: 'Засада в Сумеречном Лесу',
      setting: 'Караван торговцев был атакован бандами гоблинов и хобгоблинов на тракте через Сумеречный Лес. Отряд наемников прибыл на место крушения телег. Вокруг следы борьбы, кровь на листьях и звуки подкрадывающихся тварей среди густых ветвей.'
    }
  ],
  cyberpunk: [
    {
      title: 'Хроники Неонового Затмения',
      setting: 'Нео-Чикаго, 2099 год. Дождь из кислотного конденсата заливает сверкающие рекламой небоскрёбы мегакорпорации «Синтек». Отряд беглых наёмников соглашается на опасный контракт: взломать защищённый сервер нижнего уровня и выкрасть прототип биочипа.'
    }
  ],
  mafia: [
    {
      title: 'Кровавая Вендетта в Чикаго',
      setting: '1931 год, эпоха сухого закона. Улицы ночного города окутаны густым смогом, а звуки джаза перекрывает треск очередей автоматов Томпсона. Семья Дона Моретти объявляет войну конкурентам за контроль над портовыми складами.'
    }
  ],
  scifi: [
    {
      title: 'Дрейф Станции «Прометей»',
      setting: 'Исследовательская станция в глубоком космосе перестала отвечать на радиозапросы. Разведывательный шаттл отряда стыкуется со шлюзом полутёмного комплекса. В аварийном освещении мелькают тени неизвестных биоформ.'
    }
  ]
};

export const CreateRoomModal: React.FC<CreateRoomModalProps> = ({ onRoomCreated, onCancel }) => {
  const [genre, setGenre] = useState('fantasy');
  const [campaignDuration, setCampaignDuration] = useState<'short' | 'medium' | 'long'>('medium');
  const [title, setTitle] = useState(SETTING_TEMPLATES.fantasy[0].title);
  const [setting, setSetting] = useState(SETTING_TEMPLATES.fantasy[0].setting);
  const [customApiKey, setCustomApiKey] = useState('');
  const [showKeyField, setShowKeyField] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isGeneratingStory, setIsGeneratingStory] = useState(false);
  const [error, setError] = useState('');

  const handleSelectGenre = (selectedGenre: string) => {
    setGenre(selectedGenre);
    const pool = SETTING_TEMPLATES[selectedGenre] || SETTING_TEMPLATES.fantasy;
    if (pool && pool[0]) {
      setTitle(pool[0].title);
      setSetting(pool[0].setting);
    }
  };

  const handleSelectTemplate = (tpl: { title: string; setting: string }) => {
    setTitle(tpl.title);
    setSetting(tpl.setting);
  };

  const handleGenerateRandomStory = async () => {
    setIsGeneratingStory(true);
    setError('');
    try {
      const res = await api.generateStory({
        genre,
        campaignDuration,
        deepseekApiKey: customApiKey.trim() || undefined,
      });
      setTitle(res.title);
      setSetting(res.setting);
      if (res.genre) setGenre(res.genre);
      if (res.campaignDuration) setCampaignDuration(res.campaignDuration);
    } catch (err: any) {
      setError(err.message || 'Ошибка генерации сюжета');
    } finally {
      setIsGeneratingStory(false);
    }
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
        genre,
        campaignDuration,
        deepseekApiKey: customApiKey.trim() || undefined,
      });
      onRoomCreated(room.code);
    } catch (err: any) {
      setError(err.message || 'Ошибка создания комнаты');
      setIsLoading(false);
    }
  };

  const currentTemplates = SETTING_TEMPLATES[genre] || SETTING_TEMPLATES.fantasy;

  return (
    <div className="max-w-3xl mx-auto p-4 sm:p-6 animate-fadeIn">
      <button
        onClick={onCancel}
        className="flex items-center gap-2 text-sm text-slate-400 hover:text-amber-400 mb-6 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" /> Назад
      </button>

      <div className="bg-fantasy-panel border border-fantasy-border rounded-2xl p-6 sm:p-8 shadow-2xl relative overflow-hidden">
        <div className="mb-6 border-b border-fantasy-border pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-1.5">
              <div className="p-2 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-400">
                <Compass className="w-6 h-6" />
              </div>
              <h2 className="text-2xl font-bold font-rpg text-amber-400">
                Создать мир кампании
              </h2>
            </div>
            <p className="text-sm text-slate-400">
              Выберите жанр, длительность и преамбулу. Правила D&D 5e работают в любом выбранном сеттинге!
            </p>
          </div>

          {/* AI Random Story Generator Button */}
          <button
            type="button"
            onClick={handleGenerateRandomStory}
            disabled={isGeneratingStory}
            className="px-4 py-2.5 bg-gradient-to-r from-purple-700 to-indigo-600 hover:from-purple-600 hover:to-indigo-500 text-white rounded-xl text-xs font-bold font-rpg shadow-lg shadow-purple-900/30 transition-all flex items-center gap-2 disabled:opacity-50 flex-shrink-0 self-start sm:self-auto border border-purple-400/30"
          >
            <Dices className={`w-4 h-4 ${isGeneratingStory ? 'animate-spin' : ''}`} />
            <span>{isGeneratingStory ? 'Генерация сюжета...' : '🎲 Случайный сюжет (ИИ)'}</span>
          </button>
        </div>

        {error && (
          <div className="mb-6 p-3 rounded-xl bg-red-900/30 border border-red-700/50 text-red-300 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Genre Selection Chips */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
              Сеттинг и жанр приключения
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {GENRES.map((g) => (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => handleSelectGenre(g.id)}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    genre === g.id
                      ? 'bg-amber-500/15 border-amber-500 text-amber-300 shadow-glow-gold'
                      : 'bg-fantasy-card border-fantasy-border text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-base">{g.icon}</span>
                    <span className="font-bold text-xs text-slate-200">{g.name}</span>
                  </div>
                  <div className="text-[10px] text-slate-400 truncate">{g.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Campaign Duration Selection (10, 16, 20+ rounds) */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
              Длительность кампании (Количество раундов)
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {DURATIONS.map((d) => (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => setCampaignDuration(d.id)}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    campaignDuration === d.id
                      ? 'bg-indigo-500/20 border-indigo-400 text-indigo-300 shadow-sm'
                      : 'bg-fantasy-card border-fantasy-border text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-xs text-slate-200">{d.name}</span>
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-slate-800 text-indigo-300 border border-slate-700">
                      {d.badge}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-400">{d.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Templates for current genre */}
          {currentTemplates.length > 0 && (
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                Готовые варианты сценариев
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {currentTemplates.map((tpl, i) => (
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
          )}

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
                  ИИ-Мастер генерирует интерактивную карту пути сюжета, адаптирует врагов и ведет историю по правилам D&D 5e
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
