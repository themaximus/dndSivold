import React, { useState } from 'react';
import { LoreMilestone } from '../../types';
import { X, BookMarked, Search, Sparkles, Calendar, Maximize2, ImageIcon } from 'lucide-react';

interface CampaignJournalModalProps {
  isOpen: boolean;
  onClose: () => void;
  milestones: LoreMilestone[];
  campaignTitle?: string;
}

function getMilestoneImage(item: LoreMilestone, campaignTitle: string): { primary: string; fallback: string } {
  // 1. Thematic Unsplash fallback based on keywords
  const lower = (item.milestone + ' ' + campaignTitle).toLowerCase();
  let fallback = 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=800&q=80'; // dark dungeon
  if (lower.includes('лес') || lower.includes('засад') || lower.includes('дерев') || lower.includes('чащ') || lower.includes('сумеречн')) {
    fallback = 'https://images.unsplash.com/photo-1511497584788-87676104235f?auto=format&fit=crop&w=800&q=80'; // dark forest
  } else if (lower.includes('бой') || lower.includes('прорыв') || lower.includes('удар') || lower.includes('враг') || lower.includes('схват')) {
    fallback = 'https://images.unsplash.com/photo-1579783902614-a3fb3927b675?auto=format&fit=crop&w=800&q=80'; // fantasy battle
  } else if (lower.includes('триумф') || lower.includes('побед') || lower.includes('тайник') || lower.includes('лут') || lower.includes('золот')) {
    fallback = 'https://images.unsplash.com/photo-1563089145-599997674d42?auto=format&fit=crop&w=800&q=80'; // treasure / victory
  } else if (lower.includes('маг') || lower.includes('рун') || lower.includes('заклят') || lower.includes('портал')) {
    fallback = 'https://images.unsplash.com/photo-1518709766631-a6a7f45921c3?auto=format&fit=crop&w=800&q=80'; // arcane magic
  } else if (lower.includes('склеп') || lower.includes('нежит') || lower.includes('тлен') || lower.includes('могил')) {
    fallback = 'https://images.unsplash.com/photo-1534447677768-be436bb09401?auto=format&fit=crop&w=800&q=80'; // crypt
  }

  // 2. Primary dynamic AI generation via Pollinations
  const seed = Math.abs(
    item.milestone.split('').reduce((acc, c) => (acc << 5) - acc + c.charCodeAt(0), 0) + item.round * 31
  );
  const cleanPrompt = `dnd dark fantasy concept art, highly detailed digital painting: ${item.milestone}, ${campaignTitle}`.slice(0, 160);
  const primary = item.imageUrl || `https://image.pollinations.ai/prompt/${encodeURIComponent(cleanPrompt)}?width=720&height=360&nologo=true&seed=${seed}`;

  return { primary, fallback };
}

const MilestoneCard: React.FC<{
  item: LoreMilestone;
  campaignTitle: string;
  onPreview: (url: string, caption: string) => void;
}> = ({ item, campaignTitle, onPreview }) => {
  const { primary, fallback } = getMilestoneImage(item, campaignTitle);
  const [currentSrc, setCurrentSrc] = useState(primary);
  const [hasLoaded, setHasLoaded] = useState(false);

  const handleError = () => {
    if (currentSrc !== fallback) {
      setCurrentSrc(fallback);
    }
  };

  return (
    <div className="bg-fantasy-panel border border-fantasy-border hover:border-amber-500/50 rounded-2xl overflow-hidden transition-all duration-300 shadow-xl group">
      {/* Visual Illustration Banner */}
      <div className="relative h-44 sm:h-52 w-full bg-slate-950 overflow-hidden">
        {/* Loading skeleton placeholder */}
        {!hasLoaded && (
          <div className="absolute inset-0 bg-slate-900 animate-pulse flex items-center justify-center">
            <div className="flex items-center gap-2 text-xs text-amber-400/60 font-mono">
              <ImageIcon className="w-4 h-4 animate-bounce" />
              <span>Генерация иллюстрации события...</span>
            </div>
          </div>
        )}

        <img
          src={currentSrc}
          alt={item.milestone}
          onLoad={() => setHasLoaded(true)}
          onError={handleError}
          className={`w-full h-full object-cover transition-all duration-500 group-hover:scale-105 ${
            hasLoaded ? 'opacity-100' : 'opacity-0'
          }`}
          loading="lazy"
        />

        {/* Ambient Dark Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent pointer-events-none" />

        {/* Top-Left Round Badge */}
        <div className="absolute top-3 left-3 z-10 flex items-center gap-1.5 px-3 py-1 bg-black/70 backdrop-blur-md border border-amber-500/40 rounded-xl text-amber-300 font-mono font-bold text-xs shadow-lg">
          <Calendar className="w-3.5 h-3.5 text-amber-400" />
          <span>РАУНД {item.round}</span>
        </div>

        {/* Top-Right Fullscreen Preview Button */}
        <button
          type="button"
          onClick={() => onPreview(currentSrc, `[Раунд ${item.round}] ${item.milestone}`)}
          className="absolute top-3 right-3 z-10 p-2 bg-black/60 hover:bg-black/85 backdrop-blur-md border border-slate-700/60 hover:border-amber-400 text-slate-300 hover:text-amber-300 rounded-xl transition-all shadow-lg opacity-80 hover:opacity-100"
          title="Открыть иллюстрацию во весь экран"
        >
          <Maximize2 className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Narrative & Details */}
      <div className="p-4 sm:p-5 space-y-2 bg-gradient-to-b from-slate-950 to-fantasy-panel">
        <div className="flex items-center justify-between text-[11px] text-amber-400/80 font-mono">
          <span className="flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-amber-400" /> Ключевое событие истории
          </span>
          <span className="text-slate-500 uppercase tracking-wider">ИИ-иллюстрация</span>
        </div>

        <p className="text-sm text-slate-100 font-medium leading-relaxed font-sans">
          {item.milestone}
        </p>
      </div>
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
  const [previewImage, setPreviewImage] = useState<{ url: string; caption: string } | null>(null);

  if (!isOpen) return null;

  const filtered = milestones.filter(m =>
    m.milestone.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <>
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
                  {campaignTitle} • Иллюстрированная летопись походов отряда
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
          <div className="p-4 sm:p-6 overflow-y-auto space-y-5 flex-1 custom-scrollbar">
            {filtered.length === 0 ? (
              <div className="text-center py-16 text-slate-400 text-sm space-y-2">
                <BookMarked className="w-8 h-8 text-slate-600 mx-auto" />
                <p>
                  {searchQuery
                    ? 'События по вашему запросу не найдены'
                    : 'Ключевые события еще формируются. Каждое важное решение отряда будет зафиксировано и проиллюстрировано здесь!'}
                </p>
              </div>
            ) : (
              filtered.map((item, index) => (
                <MilestoneCard
                  key={item.id || index}
                  item={item}
                  campaignTitle={campaignTitle}
                  onPreview={(url, caption) => setPreviewImage({ url, caption })}
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

      {/* Lightbox Modal for Fullscreen Image Preview */}
      {previewImage && (
        <div
          className="fixed inset-0 z-[60] bg-black/90 backdrop-blur-md flex items-center justify-center p-4"
          onClick={() => setPreviewImage(null)}
        >
          <div
            className="max-w-4xl w-full bg-slate-950 border border-slate-700 rounded-2xl overflow-hidden shadow-2xl relative"
            onClick={e => e.stopPropagation()}
          >
            <button
              onClick={() => setPreviewImage(null)}
              className="absolute top-4 right-4 z-10 p-2 bg-black/70 hover:bg-black text-slate-300 hover:text-white rounded-full transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
            <img
              src={previewImage.url}
              alt="Иллюстрация события"
              className="w-full max-h-[75vh] object-contain bg-black"
            />
            <div className="p-4 bg-slate-900 border-t border-slate-800">
              <p className="text-xs sm:text-sm text-amber-300 font-medium text-center">
                {previewImage.caption}
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
