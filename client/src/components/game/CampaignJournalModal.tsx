import React, { useState } from 'react';
import { LoreMilestone, QuestEntity } from '../../types';
import { X, BookMarked, Search, Sparkles, Calendar, Package, Compass, CheckCircle2 } from 'lucide-react';

interface CampaignJournalModalProps {
  isOpen: boolean;
  onClose: () => void;
  milestones: LoreMilestone[];
  quests?: QuestEntity[];
  campaignTitle?: string;
}

const MilestoneCard: React.FC<{
  item: LoreMilestone;
}> = ({ item }) => {
  const isItemEvent = item.milestone.includes('🎒') || item.milestone.includes('📦') || item.milestone.includes('🧪') || item.milestone.toLowerCase().includes('предмет') || item.milestone.toLowerCase().includes('трофей');

  return (
    <div className={`bg-fantasy-panel border rounded-2xl p-4 sm:p-5 transition-all duration-300 shadow-xl group ${
      isItemEvent ? 'border-amber-500/30 hover:border-amber-500/60 bg-slate-900/80' : 'border-fantasy-border hover:border-amber-500/50'
    }`}>
      <div className="flex items-center justify-between mb-2 pb-2 border-b border-fantasy-border/40">
        <div className="flex items-center gap-1.5 px-3 py-1 bg-black/60 border border-amber-500/40 rounded-xl text-amber-300 font-mono font-bold text-xs shadow-md">
          <Calendar className="w-3.5 h-3.5 text-amber-400" />
          <span>РАУНД {item.round}</span>
        </div>
        {isItemEvent ? (
          <span className="flex items-center gap-1 text-[11px] text-amber-300 font-mono bg-amber-500/10 px-2 py-0.5 rounded-lg border border-amber-500/30">
            <Package className="w-3 h-3 text-amber-400" /> Инвентарь и трофеи
          </span>
        ) : (
          <span className="flex items-center gap-1 text-[11px] text-amber-400/80 font-mono">
            <Sparkles className="w-3 h-3 text-amber-400" /> Веха истории
          </span>
        )}
      </div>

      <p className="text-sm text-slate-100 font-medium leading-relaxed font-sans mt-2">
        {item.milestone}
      </p>
    </div>
  );
};

export const CampaignJournalModal: React.FC<CampaignJournalModalProps> = ({
  isOpen,
  onClose,
  milestones = [],
  quests = [],
  campaignTitle = 'Хроника приключения',
}) => {
  const [activeTab, setActiveTab] = useState<'milestones' | 'quests'>('milestones');
  const [searchQuery, setSearchQuery] = useState('');

  if (!isOpen) return null;

  const filteredMilestones = milestones.filter(m =>
    m.milestone.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const activeQuests = quests.filter(q => q.status === 'active');
  const completedQuests = quests.filter(q => q.status === 'completed');
  const filteredQuests = quests.filter(q =>
    q.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    q.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (q.resolutionNote && q.resolutionNote.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-3xl bg-fantasy-card border border-fantasy-border rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-fantasy-border flex items-center justify-between bg-fantasy-panel">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-400">
              <BookMarked className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-rpg font-bold text-amber-300">Журнал ключевых событий</h2>
              <p className="text-xs text-slate-400">
                {campaignTitle} • Летопись походов и решений отряда
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

        {/* Tab Navigation */}
        <div className="flex border-b border-fantasy-border bg-slate-900/80 px-6 pt-2 gap-2 text-xs font-semibold">
          <button
            onClick={() => setActiveTab('milestones')}
            className={`pb-2.5 px-3 border-b-2 flex items-center gap-2 transition-colors ${
              activeTab === 'milestones'
                ? 'border-amber-400 text-amber-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <BookMarked className="w-4 h-4" />
            <span>Летопись вех</span>
            <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-slate-800 font-mono text-slate-300">
              {milestones.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('quests')}
            className={`pb-2.5 px-3 border-b-2 flex items-center gap-2 transition-colors ${
              activeTab === 'quests'
                ? 'border-amber-400 text-amber-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Compass className="w-4 h-4 text-amber-400" />
            <span>Задачи и квесты</span>
            <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-amber-950/80 border border-amber-500/40 font-mono text-amber-300">
              {activeQuests.length} акт. / {completedQuests.length} вып.
            </span>
          </button>
        </div>

        {/* Search Bar */}
        <div className="px-6 py-3 bg-slate-900/60 border-b border-slate-800 flex items-center gap-2">
          <Search className="w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder={activeTab === 'milestones' ? "Поиск по событиям, монстрам, находкам..." : "Поиск по задачам, ремонту, квестам..."}
            className="flex-1 bg-transparent text-xs text-slate-100 placeholder-slate-500 focus:outline-none"
          />
        </div>

        {/* Cards Content */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-4 flex-1 custom-scrollbar">
          {activeTab === 'milestones' ? (
            filteredMilestones.length === 0 ? (
              <div className="text-center py-16 text-slate-400 text-sm space-y-2">
                <BookMarked className="w-8 h-8 text-slate-600 mx-auto" />
                <p>
                  {searchQuery
                    ? 'События по вашему запросу не найдены'
                    : 'Ключевые события еще формируются. Каждое важное решение отряда будет зафиксировано здесь!'}
                </p>
              </div>
            ) : (
              filteredMilestones.map((item, index) => (
                <MilestoneCard
                  key={item.id || index}
                  item={item}
                />
              ))
            )
          ) : (
            filteredQuests.length === 0 ? (
              <div className="text-center py-16 text-slate-400 text-sm space-y-2">
                <Compass className="w-8 h-8 text-slate-600 mx-auto text-amber-500/60" />
                <p>
                  {searchQuery
                    ? 'Задачи по вашему запросу не найдены'
                    : 'Задачи и квесты генерируются процедурно по ходу приключения.'}
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Active Section */}
                {filteredQuests.filter(q => q.status === 'active').length > 0 && (
                  <div className="space-y-3">
                    <h3 className="text-xs font-mono uppercase text-amber-400 font-bold flex items-center gap-2">
                      <Compass className="w-4 h-4" /> Активные задачи и поручения ({filteredQuests.filter(q => q.status === 'active').length})
                    </h3>
                    {filteredQuests.filter(q => q.status === 'active').map(q => (
                      <div
                        key={q.id}
                        className="bg-fantasy-panel border border-amber-500/40 rounded-2xl p-4 sm:p-5 shadow-lg"
                      >
                        <div className="flex items-center justify-between gap-2 mb-2 pb-2 border-b border-fantasy-border/40">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-mono border ${
                            q.category === 'main' ? 'bg-amber-950/70 text-amber-300 border-amber-600/50' :
                            q.category === 'repair' ? 'bg-blue-950/70 text-blue-300 border-blue-600/50' :
                            q.category === 'investigation' ? 'bg-purple-950/70 text-purple-300 border-purple-600/50' :
                            'bg-slate-800 text-slate-300 border-slate-700'
                          }`}>
                            {q.category === 'main' ? '👑 Основной квест' :
                             q.category === 'repair' ? '🔧 Ремонт / Задача' :
                             q.category === 'investigation' ? '🔍 Расследование' :
                             q.category === 'social' ? '🤝 Переговоры' : '⚔️ Поручение'}
                          </span>
                          <span className="text-[10px] font-mono text-amber-400/80">
                            Открыт в раунде {q.roundCreated}
                          </span>
                        </div>
                        <h4 className="text-sm font-bold text-slate-100 font-rpg mb-1">
                          {q.title}
                        </h4>
                        <p className="text-xs text-slate-300 font-sans leading-relaxed">
                          {q.description}
                        </p>
                        {q.giverName && (
                          <p className="mt-2 text-[11px] font-mono text-amber-400/90">
                            Источник / Заказчик: {q.giverName}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Completed Section */}
                {filteredQuests.filter(q => q.status === 'completed').length > 0 && (
                  <div className="space-y-3 pt-2">
                    <h3 className="text-xs font-mono uppercase text-emerald-400 font-bold flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4" /> Выполненные задачи ({filteredQuests.filter(q => q.status === 'completed').length})
                    </h3>
                    {filteredQuests.filter(q => q.status === 'completed').map(q => (
                      <div
                        key={q.id}
                        className="bg-emerald-950/20 border border-emerald-800/40 rounded-2xl p-4 shadow-md"
                      >
                        <div className="flex items-center justify-between gap-2 mb-1.5">
                          <span className="text-xs font-bold text-emerald-300 flex items-center gap-1.5">
                            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                            {q.title}
                          </span>
                          <span className="text-[10px] font-mono text-emerald-400/80 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-800/50 shrink-0">
                            Завершено в раунде {q.roundCompleted || q.roundCreated}
                          </span>
                        </div>
                        {q.resolutionNote && (
                          <p className="text-xs text-slate-300 italic pl-5 leading-relaxed">
                            {q.resolutionNote}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-fantasy-border bg-fantasy-panel flex items-center justify-between">
          <span className="text-xs text-slate-400 font-mono">
            {activeTab === 'milestones' ? (
              <>Всего событий в летописи: <strong className="text-amber-400">{milestones.length}</strong></>
            ) : (
              <>Всего задач: <strong className="text-amber-400">{quests.length}</strong> ({activeQuests.length} активных, {completedQuests.length} решено)</>
            )}
          </span>
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
