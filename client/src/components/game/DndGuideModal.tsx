import React, { useState } from 'react';
import {
  X,
  Compass,
  BookOpen,
  Dice5,
  Shield,
  Sparkles,
  Swords,
  Flame,
  Award,
  Crown,
  Heart,
  Lightbulb,
  CheckCircle2
} from 'lucide-react';

interface DndGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const DndGuideModal: React.FC<DndGuideModalProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<'loop' | 'stats' | 'campaign'>('loop');

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-4xl max-h-[90vh] bg-slate-950 border border-amber-500/40 rounded-3xl shadow-2xl flex flex-col overflow-hidden text-slate-200">
        
        {/* Modal Header */}
        <div className="p-4 sm:p-6 border-b border-fantasy-border/60 bg-gradient-to-r from-amber-950/40 via-slate-900 to-purple-950/40 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-amber-500/20 border border-amber-500/40 text-amber-400 shadow-glow-gold">
              <BookOpen className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-bold font-rpg text-amber-300 flex items-center gap-2">
                Аутентичные Правила D&D 5e
              </h2>
              <p className="text-xs text-slate-400">
                Живое словесное творчество без рельсов • Броски d20 • Тактическая свобода
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-fantasy-border/50 bg-slate-900/60 px-4 sm:px-6 pt-2 gap-2 shrink-0">
          <button
            onClick={() => setActiveTab('loop')}
            className={`px-4 py-2.5 text-xs sm:text-sm font-rpg font-semibold border-b-2 transition-all flex items-center gap-2 ${
              activeTab === 'loop'
                ? 'border-amber-400 text-amber-300 bg-amber-500/10 rounded-t-xl'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Compass className="w-4 h-4" />
            <span>3-Шаговый Цикл Раунда</span>
          </button>

          <button
            onClick={() => setActiveTab('stats')}
            className={`px-4 py-2.5 text-xs sm:text-sm font-rpg font-semibold border-b-2 transition-all flex items-center gap-2 ${
              activeTab === 'stats'
                ? 'border-amber-400 text-amber-300 bg-amber-500/10 rounded-t-xl'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Dice5 className="w-4 h-4" />
            <span>Характеристики и Броски d20</span>
          </button>

          <button
            onClick={() => setActiveTab('campaign')}
            className={`px-4 py-2.5 text-xs sm:text-sm font-rpg font-semibold border-b-2 transition-all flex items-center gap-2 ${
              activeTab === 'campaign'
                ? 'border-amber-400 text-amber-300 bg-amber-500/10 rounded-t-xl'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Crown className="w-4 h-4" />
            <span>Сессия, Модуль и Финалы</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-6 overflow-y-auto custom-scrollbar flex-1 space-y-6 text-sm">
          
          {/* TAB 1: CORE 3-STEP LOOP */}
          {activeTab === 'loop' && (
            <div className="space-y-5 animate-in fade-in">
              <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-3">
                <Lightbulb className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                <div className="text-xs sm:text-sm leading-relaxed text-slate-200">
                  <strong className="text-amber-300 font-rpg">Главная философия настольной D&D:</strong>{' '}
                  Это совместное словесное повествование, где игроки управляют своими персонажами, а Мастер оживляет мир. Здесь нет заранее нарисованных жестких сеток или принудительных развилок («рельсов») — сюжет создается прямо на ходу из столкновения замысла Мастера и ваших решений!
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Step 1 */}
                <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-2 hover:border-amber-500/40 transition-all">
                  <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center font-rpg font-bold">
                    1
                  </div>
                  <h3 className="font-rpg font-bold text-amber-300 text-base">
                    Мастер описывает ситуацию
                  </h3>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    Ведущий погружает вас в атмосферу: описывает локацию, запахи, видимые угрозы, перемещения врагов и ставит отряд перед тактическим вызовом.
                  </p>
                </div>

                {/* Step 2 */}
                <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-2 hover:border-emerald-500/40 transition-all">
                  <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-rpg font-bold">
                    2
                  </div>
                  <h3 className="font-rpg font-bold text-emerald-300 text-base">
                    Игроки говорят, что делают
                  </h3>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    Полная свобода слов и импровизации! Вы можете атаковать оружием или магией, опрокинуть дубовый стол для укрытия (+2 к КБ), залезть на балку, заговорить зубы врагам или сорвать факел со стены.
                  </p>
                </div>

                {/* Step 3 */}
                <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-2 hover:border-purple-500/40 transition-all">
                  <div className="w-8 h-8 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center font-rpg font-bold">
                    3
                  </div>
                  <h3 className="font-rpg font-bold text-purple-300 text-base">
                    Мастер описывает последствия
                  </h3>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    Кубик d20 определяет успех или провал вашей задумки. Мастер красочно раскрывает, попал ли ваш клинок, дрогнул ли противник и как изменилась сцена к следующему раунду.
                  </p>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-slate-900/60 border border-fantasy-border space-y-2">
                <h4 className="font-rpg font-bold text-slate-200 text-xs uppercase tracking-wider flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-amber-400" />
                  Как действовать эффективно:
                </h4>
                <ul className="text-xs text-slate-300 space-y-1.5 list-disc list-inside">
                  <li><strong className="text-amber-300">Используйте окружение:</strong> Колонны, столы, бочки, цепи, факелы и лестницы всегда доступны для сочной тактики.</li>
                  <li><strong className="text-amber-300">Согласовывайте действия с соратниками:</strong> Комбинируйте атаки, прикрывайте раненых и координируйте фокус огня.</li>
                  <li><strong className="text-amber-300">Бросайте d20 перед ходом:</strong> Ваш бросок кубика d20 связывается с вашей заявкой и проверяется сервером.</li>
                </ul>
              </div>
            </div>
          )}

          {/* TAB 2: STATS & D20 CHECKS */}
          {activeTab === 'stats' && (
            <div className="space-y-4 animate-in fade-in">
              <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-xs text-slate-200 leading-relaxed">
                <strong className="text-amber-300">Назначение характеристики Мастером:</strong> В зависимости от обстановки сцены и типа вызова Мастер определяет, какая характеристика героя испытывается на прочность в текущем раунде. Если вам повезло и Мастер выбрал ваш сильный навык — у вас высокий шанс на успех; если выпал непрокачанный — придется проявить хитрость!
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 space-y-1">
                  <div className="font-rpg font-bold text-amber-400 text-sm flex items-center justify-between">
                    <span>СИЛА (STR)</span>
                    <Swords className="w-4 h-4 text-amber-400" />
                  </div>
                  <p className="text-xs text-slate-400">Таран дверей, удержание тяжелых ворот, рукопашный бой тяжелым оружием, прыжки через пропасть.</p>
                </div>

                <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 space-y-1">
                  <div className="font-rpg font-bold text-emerald-400 text-sm flex items-center justify-between">
                    <span>ЛОВКОСТЬ (DEX)</span>
                    <Shield className="w-4 h-4 text-emerald-400" />
                  </div>
                  <p className="text-xs text-slate-400">Уклонение от ловушек и стрел, бесшумное перемещение, стрельба из лука/арбалета, акробатика.</p>
                </div>

                <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 space-y-1">
                  <div className="font-rpg font-bold text-red-400 text-sm flex items-center justify-between">
                    <span>ТЕЛОСЛОЖЕНИЕ (CON)</span>
                    <Heart className="w-4 h-4 text-red-400" />
                  </div>
                  <p className="text-xs text-slate-400">Сопротивление ядам и болезням, стойкость к ледяному ветру, выносливость при истощении, концентрация на заклинаниях.</p>
                </div>

                <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 space-y-1">
                  <div className="font-rpg font-bold text-blue-400 text-sm flex items-center justify-between">
                    <span>ИНТЕЛЛЕКТ (INT)</span>
                    <BookOpen className="w-4 h-4 text-blue-400" />
                  </div>
                  <p className="text-xs text-slate-400">Поиск улик, расшифровка древних рун, магические знания, дедукция и разгадывание головоломок.</p>
                </div>

                <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 space-y-1">
                  <div className="font-rpg font-bold text-purple-400 text-sm flex items-center justify-between">
                    <span>МУДРОСТЬ (WIS)</span>
                    <Compass className="w-4 h-4 text-purple-400" />
                  </div>
                  <p className="text-xs text-slate-400">Внимательность к засадам, проницательность при распознавании лжи, интуиция, медицина и первая помощь.</p>
                </div>

                <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 space-y-1">
                  <div className="font-rpg font-bold text-pink-400 text-sm flex items-center justify-between">
                    <span>ХАРИЗМА (CHA)</span>
                    <Sparkles className="w-4 h-4 text-pink-400" />
                  </div>
                  <p className="text-xs text-slate-400">Переговоры и дипломатия, запугивание стражи, вдохновение отряда, ложь и театральный обман.</p>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-300 space-y-1">
                <div className="font-bold text-amber-400">★ Критические броски d20:</div>
                <p>• <strong>Натуральная 20 (★ КРИТИЧЕСКИЙ УСПЕХ)</strong>: Автоматическое феерическое попадание или триумф в проверке, удвоенный урон!</p>
                <p>• <strong>Натуральная 1 (☠ КРИТИЧЕСКИЙ ПРОВАЛ)</strong>: Автоматический промах или комичная/опасная осечка (тетива лопнула, меч застрял в щите).</p>
              </div>
            </div>
          )}

          {/* TAB 3: CAMPAIGN STRUCTURE & FINALES */}
          {activeTab === 'campaign' && (
            <div className="space-y-4 animate-in fade-in">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-2">
                  <div className="flex items-center gap-2 text-amber-400 font-rpg font-bold text-sm">
                    <Flame className="w-4 h-4" />
                    <span>1. Игровая Сессия («Катка»)</span>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    Отдельная встреча друзей на 1–2 часа. Она не обязана ставить точку во всей истории: сессия логично завершается привалом (коротким/длинным отдыхом) либо эффектным обрывом на самом захватывающем моменте.
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-2">
                  <div className="flex items-center gap-2 text-purple-400 font-rpg font-bold text-sm">
                    <Award className="w-4 h-4" />
                    <span>2. Приключение («Модуль»)</span>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    Законченная сюжетная арка (1–5 сессий) с ясной целью: освободить захваченную крепость, найти древний артефакт или одолеть главаря разбойников. Финал модуля приносит победу и награды.
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-2">
                  <div className="flex items-center gap-2 text-emerald-400 font-rpg font-bold text-sm">
                    <Crown className="w-4 h-4" />
                    <span>3. Кампания</span>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    Глобальная сага, объединяющая череду приключений. Персонажи растут в уровнях, обретают легендарное снаряжение и меняют судьбы целых королевств или галактик.
                  </p>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-slate-900/80 border border-fantasy-border space-y-3">
                <h4 className="font-rpg font-bold text-amber-400 text-xs uppercase tracking-wider flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-amber-400" />
                  Варианты завершения приключения:
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                  <div className="p-2.5 rounded-xl bg-emerald-950/30 border border-emerald-500/30 text-emerald-200">
                    <strong className="text-emerald-300">🏆 Триумфальная победа:</strong> Цель достигнута, главный босс повержен, а слава отряда гремит по всему миру.
                  </div>
                  <div className="p-2.5 rounded-xl bg-purple-950/30 border border-purple-500/30 text-purple-200">
                    <strong className="text-purple-300">🌙 Клиффхэнгер сессии:</strong> История замирает на самом интригующем моменте (распахнулись врата цитадели, зазвучал боевой горн) до следующей игры.
                  </div>
                  <div className="p-2.5 rounded-xl bg-blue-950/30 border border-blue-500/30 text-blue-200">
                    <strong className="text-blue-300">🌌 Открытый финал:</strong> Угроза отбита, но герои смотрят за горизонт, готовые к новым странствиям.
                  </div>
                  <div className="p-2.5 rounded-xl bg-red-950/30 border border-red-500/30 text-red-200">
                    <strong className="text-red-300">💀 Героическая гибель:</strong> Все герои пали в неравной схватке. Их имена навсегда останутся легендой.
                  </div>
                </div>
              </div>
            </div>
          )}

        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-fantasy-border/60 bg-slate-900/60 flex items-center justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black font-rpg font-bold text-xs rounded-xl shadow-md shadow-amber-500/20 transition-all"
          >
            Понятно, к приключению!
          </button>
        </div>

      </div>
    </div>
  );
};
