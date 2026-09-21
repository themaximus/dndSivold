import React, { useState } from 'react';
import {
  X,
  Award,
  Crown,
  Moon,
  Sparkles,
  ArrowLeft,
  Share2,
  CheckCircle2
} from 'lucide-react';
import { Room } from '../../types';

interface AdventureFinishModalProps {
  isOpen: boolean;
  onClose: () => void;
  room: Room;
  isHost: boolean;
  onFinishAdventure?: (data: {
    finishType: 'cliffhanger' | 'triumph' | 'open_ended';
    title?: string;
    epilogue?: string;
  }) => void;
  onReturnToLobby: () => void;
}

export const AdventureFinishModal: React.FC<AdventureFinishModalProps> = ({
  isOpen,
  onClose,
  room,
  isHost,
  onFinishAdventure,
  onReturnToLobby,
}) => {
  const isFinished = room.status === 'finished';

  const [finishType, setFinishType] = useState<'cliffhanger' | 'triumph' | 'open_ended'>('cliffhanger');
  const [customTitle, setCustomTitle] = useState('');
  const [customEpilogue, setCustomEpilogue] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!onFinishAdventure) return;

    onFinishAdventure({
      finishType,
      title: customTitle.trim() || undefined,
      epilogue: customEpilogue.trim() || undefined,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl bg-slate-950 border border-amber-500/40 rounded-3xl shadow-2xl flex flex-col overflow-hidden text-slate-200">
        
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-fantasy-border/60 bg-gradient-to-r from-amber-950/40 via-slate-900 to-purple-950/40 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-amber-500/20 border border-amber-500/40 text-amber-400 shadow-glow-gold">
              {isFinished ? <Award className="w-6 h-6" /> : <Crown className="w-6 h-6" />}
            </div>
            <div>
              <h2 className="text-xl font-bold font-rpg text-amber-300">
                {isFinished ? 'Финал Приключения' : 'Завершение Сессии / Модуля'}
              </h2>
              <p className="text-xs text-slate-400">
                {room.title} • Раунд {room.roundNumber}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 sm:p-6 overflow-y-auto custom-scrollbar space-y-5">
          {isFinished ? (
            /* FINISHED STATE DISPLAY */
            <div className="space-y-4 text-center">
              <div className="inline-flex p-3 rounded-full bg-amber-500/20 border border-amber-400 text-amber-300 shadow-glow-gold">
                <Crown className="w-8 h-8" />
              </div>
              <h3 className="text-2xl font-bold font-rpg text-amber-300">
                Приключение Завершено!
              </h3>
              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed max-w-xl mx-auto italic font-sans">
                {room.currentSituation || 'История подошла к своему логическому финалу. Отряд проявил великое мужество и находчивость!'}
              </p>

              {room.loreJournal && room.loreJournal.length > 0 && (
                <div className="p-4 rounded-2xl bg-slate-900/80 border border-fantasy-border text-left space-y-2 mt-4">
                  <h4 className="font-rpg text-xs uppercase tracking-wider text-amber-400 font-bold flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-amber-400" />
                    Главные вехи и достижения похода:
                  </h4>
                  <ul className="space-y-1.5 text-xs text-slate-300">
                    {room.loreJournal.map((m, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                        <span>{m.milestone}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="pt-4 flex items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={onReturnToLobby}
                  className="px-5 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black font-rpg font-bold text-xs rounded-xl shadow-md shadow-amber-500/20 transition-all flex items-center gap-2"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Вернуться в Лобби</span>
                </button>
              </div>
            </div>
          ) : isHost ? (
            /* HOST CONTROLS TO FINISH */
            <form onSubmit={handleSubmit} className="space-y-4">
              <p className="text-xs text-slate-300 leading-relaxed">
                Как Ведущий (Хост), вы можете в любой момент поставить точку в сегодняшней сессии на интригующем клиффхэнгере либо объявить триумфальную победу отряда в текущем модуле:
              </p>

              {/* Type selection */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <button
                  type="button"
                  onClick={() => setFinishType('cliffhanger')}
                  className={`p-3 rounded-2xl border text-left transition-all ${
                    finishType === 'cliffhanger'
                      ? 'bg-purple-950/50 border-purple-400 ring-2 ring-purple-400/40 text-purple-200'
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center gap-1.5 font-rpg font-bold text-xs mb-1 text-purple-300">
                    <Moon className="w-4 h-4 text-purple-400" />
                    <span>Клиффхэнгер</span>
                  </div>
                  <p className="text-[11px] leading-tight text-slate-300">
                    Завершить сессию на самом остром моменте перед отдыхом.
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setFinishType('triumph')}
                  className={`p-3 rounded-2xl border text-left transition-all ${
                    finishType === 'triumph'
                      ? 'bg-amber-950/50 border-amber-400 ring-2 ring-amber-400/40 text-amber-200'
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center gap-1.5 font-rpg font-bold text-xs mb-1 text-amber-300">
                    <Award className="w-4 h-4 text-amber-400" />
                    <span>Триумф</span>
                  </div>
                  <p className="text-[11px] leading-tight text-slate-300">
                    Победа над главным злом и завершение всего модуля!
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setFinishType('open_ended')}
                  className={`p-3 rounded-2xl border text-left transition-all ${
                    finishType === 'open_ended'
                      ? 'bg-blue-950/50 border-blue-400 ring-2 ring-blue-400/40 text-blue-200'
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center gap-1.5 font-rpg font-bold text-xs mb-1 text-blue-300">
                    <Sparkles className="w-4 h-4 text-blue-400" />
                    <span>Открытый финал</span>
                  </div>
                  <p className="text-[11px] leading-tight text-slate-300">
                    Модуль закрыт, впереди ждут новые горизонты.
                  </p>
                </button>
              </div>

              {/* Custom Title */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                  Заголовок финала (необязательно)
                </label>
                <input
                  type="text"
                  value={customTitle}
                  onChange={(e) => setCustomTitle(e.target.value)}
                  placeholder={
                    finishType === 'cliffhanger'
                      ? 'Конец Первой Сессии (Продолжение следует...)'
                      : 'Великий Триумф Отряда'
                  }
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-400"
                />
              </div>

              {/* Custom Epilogue */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                  Финальные слова Мастера (необязательно)
                </label>
                <textarea
                  value={customEpilogue}
                  onChange={(e) => setCustomEpilogue(e.target.value)}
                  rows={3}
                  placeholder="Оставьте пустым для эпичного автоматического завершения хроники..."
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-400"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs rounded-xl font-semibold transition-colors"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black font-rpg font-bold text-xs rounded-xl shadow-md shadow-amber-500/20 transition-all"
                >
                  Объявить Финал
                </button>
              </div>
            </form>
          ) : (
            <div className="p-4 rounded-xl bg-slate-900 text-center text-xs text-slate-400">
              Приключение находится в активной фазе. Только Хост комнаты может объявить официальный финал сессии или модуля.
            </div>
          )}
        </div>

      </div>
    </div>
  );
};
