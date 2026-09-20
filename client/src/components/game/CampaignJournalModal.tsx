import React, { useState } from 'react';
import { LoreMilestone } from '../../types';
import { X, BookMarked, Search, Sparkles, Calendar } from 'lucide-react';

interface CampaignJournalModalProps {
  isOpen: boolean;
  onClose: () => void;
  milestones: LoreMilestone[];
  campaignTitle?: string;
}

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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-2xl bg-fantasy-card border border-fantasy-border rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-fantasy-border flex items-center justify-between bg-fantasy-panel">
          <div className="flex items-center gap-3">
            <BookMarked className="w-5 h-5 text-amber-400" />
            <div>
              <h2 className="text-base font-rpg font-bold text-amber-300">Журнал ключевых событий</h2>
              <p className="text-xs text-slate-400">
                {campaignTitle} • Память мира, на которую ссылается Мастер Подземелий (AI)
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
            placeholder="Поиск по ключевым событиям и фактам сюжета..."
            className="flex-1 bg-transparent text-xs text-slate-100 placeholder-slate-500 focus:outline-none"
          />
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-3 flex-1">
          {filtered.length === 0 ? (
            <div className="text-center py-12 text-slate-400 text-sm">
              {searchQuery
                ? 'События по вашему запросу не найдены'
                : 'Ключевые события еще формируются. Каждое важное решение отряда будет зафиксировано здесь!'}
            </div>
          ) : (
            filtered.map((item, index) => (
              <div
                key={item.id || index}
                className="p-4 bg-fantasy-panel/80 border border-fantasy-border rounded-xl transition-all hover:border-amber-500/40 relative flex gap-3"
              >
                <div className="flex flex-col items-center">
                  <div className="w-7 h-7 rounded-lg bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-[11px] font-mono font-bold text-amber-300">
                    R{item.round}
                  </div>
                </div>

                <div className="flex-1 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-slate-400 uppercase tracking-wider font-mono flex items-center gap-1">
                      <Calendar className="w-3 h-3 text-amber-400" /> Раунд {item.round}
                    </span>
                  </div>
                  <p className="text-xs text-slate-200 leading-relaxed font-sans">{item.milestone}</p>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-fantasy-border bg-fantasy-panel flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition-colors"
          >
            Закрыть
          </button>
        </div>
      </div>
    </div>
  );
};
