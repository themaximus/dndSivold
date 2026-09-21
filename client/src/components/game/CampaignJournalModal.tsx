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
    <div className={`border rounded p-4 sm:p-5 transition-all duration-300 shadow-sm ${
      isItemEvent
        ? 'bg-[#181a22] border-[#443825] hover:border-[#c5a059]/70'
        : 'bg-[#181c25] border-[#2a303d] hover:border-[#3e4758]'
    }`}>
      <div className="flex items-center justify-between mb-2.5 pb-2 border-b border-[#242b38]">
        <div className="flex items-center gap-1.5 px-2.5 py-0.5 bg-[#1f1b13] border border-[#524126] rounded text-[#ffd98a] font-rpg font-bold text-xs">
          <Calendar className="w-3.5 h-3.5 text-[#c5a059]" />
          <span>РАУНД {item.round}</span>
        </div>
        {isItemEvent ? (
          <span className="flex items-center gap-1 text-[11px] text-[#ffd98a] font-serif bg-[#251f15] px-2 py-0.5 rounded border border-[#524126]">
            <Package className="w-3 h-3 text-[#c5a059]" /> Инвентарь и трофеи
          </span>
        ) : (
          <span className="flex items-center gap-1 text-[11px] text-[#c5a059] font-serif">
            <Sparkles className="w-3 h-3 text-[#c5a059]" /> Веха истории
          </span>
        )}
      </div>

      <p className="text-sm text-[#ded7c8] font-book leading-relaxed mt-2">
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-3xl bg-[#13161d] border border-[#3b4455] rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#2a303d] flex items-center justify-between bg-[#0e1117]">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-[#1f1b13] border border-[#524126] rounded text-[#c5a059]">
              <BookMarked className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-rpg font-bold text-[#ffd98a] tracking-wide">Летопись ключевых событий</h2>
              <p className="text-xs text-[#8e8574] font-serif">
                {campaignTitle} • Записи походов и решений отряда
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-[#8e8574] hover:text-[#ded7c8] hover:bg-[#1a202c] rounded transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search Bar */}
        <div className="px-6 py-3 bg-[#0b0e14] border-b border-[#242b38] flex items-center gap-2">
          <Search className="w-4 h-4 text-[#8e8574]" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Поиск по событиям, монстрам, находкам и битвам..."
            className="flex-1 bg-transparent text-xs text-[#ded7c8] placeholder-[#665e52] font-serif focus:outline-none"
          />
        </div>

        {/* Milestone Cards Content */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-4 flex-1 custom-scrollbar">
          {filtered.length === 0 ? (
            <div className="text-center py-16 text-[#8e8574] font-serif text-sm space-y-2 italic">
              <BookMarked className="w-8 h-8 text-[#554d3f] mx-auto" />
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
        <div className="px-6 py-3 border-t border-[#2a303d] bg-[#0e1117] flex items-center justify-between">
          <span className="text-xs text-[#8e8574] font-serif">
            Всего записей в летописи: <strong className="text-[#ffd98a] font-mono">{milestones.length}</strong>
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-[#181c25] hover:bg-[#222735] border border-[#2a303d] text-[#ded7c8] rounded font-serif text-xs font-semibold transition-colors"
          >
            Закрыть
          </button>
        </div>
      </div>
    </div>
  );
};
