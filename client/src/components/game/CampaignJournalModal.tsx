import React, { useState } from 'react';
import { LoreMilestone } from '../../types';
import { X, BookMarked, Search, Sparkles, Calendar, Package } from 'lucide-react';

interface CampaignJournalModalProps {
  isOpen: boolean;
  onClose: () => void;
  milestones: LoreMilestone[];
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
  campaignTitle = 'Хроника приключения',
}) => {
  const [searchQuery, setSearchQuery] = useState('');

  if (!isOpen) return null;

  const filtered = milestones.filter(m =>
    m.milestone.toLowerCase().includes(searchQuery.toLowerCase())
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

        {/* Search Bar */}
        <div className="px-6 py-3 bg-slate-900/60 border-b border-slate-800 flex items-center gap-2">
          <Search className="w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Поиск по событиям, монстрам, находкам и битвам..."
            className="flex-1 bg-transparent text-xs text-slate-100 placeholder-slate-500 focus:outline-none"
          />
        </div>

        {/* Milestone Cards Content */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-4 flex-1 custom-scrollbar">
          {filtered.length === 0 ? (
            <div className="text-center py-16 text-slate-400 text-sm space-y-2">
              <BookMarked className="w-8 h-8 text-slate-600 mx-auto" />
              <p>
                {searchQuery
                  ? 'События по вашему запросу не найдены'
                  : 'Ключевые события еще формируются. Каждое важное решение отряда будет зафиксировано здесь!'}
              </p>
            </div>
          ) : (
            filtered.map((item, index) => (
              <MilestoneCard
                key={item.id || index}
                item={item}
              />
            ))
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-fantasy-border bg-fantasy-panel flex items-center justify-between">
          <span className="text-xs text-slate-400 font-mono">
            Всего событий в летописи: <strong className="text-amber-400">{milestones.length}</strong>
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
