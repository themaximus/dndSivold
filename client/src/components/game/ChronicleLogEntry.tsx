import React, { useState } from 'react';
import { GameLogEntry } from '../../types';
import { Heart, ShieldAlert, Package, Maximize2, ImageIcon, Sparkles, X } from 'lucide-react';
import { NarrativeVoiceButton } from './NarrativeVoiceButton';

interface ChronicleLogEntryProps {
  log: GameLogEntry;
  isPlaying: boolean;
  isLoading: boolean;
  onToggleVoice: () => void;
}

function getLogIllustration(log: GameLogEntry): { primary: string; fallback: string } {
  // 1. Thematic Unsplash fallback based on keywords
  const lower = (log.narrativeText || '').toLowerCase();
  let fallback = 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=800&q=80'; // dark dungeon
  if (lower.includes('лес') || lower.includes('засад') || lower.includes('дерев') || lower.includes('чащ') || lower.includes('сумеречн')) {
    fallback = 'https://images.unsplash.com/photo-1511497584788-87676104235f?auto=format&fit=crop&w=800&q=80';
  } else if (lower.includes('бой') || lower.includes('прорыв') || lower.includes('удар') || lower.includes('враг') || lower.includes('схват') || lower.includes('меч') || lower.includes('монстр')) {
    fallback = 'https://images.unsplash.com/photo-1579783902614-a3fb3927b675?auto=format&fit=crop&w=800&q=80';
  } else if (lower.includes('маг') || lower.includes('рун') || lower.includes('заклят') || lower.includes('портал') || lower.includes('свет')) {
    fallback = 'https://images.unsplash.com/photo-1518709766631-a6a7f45921c3?auto=format&fit=crop&w=800&q=80';
  } else if (lower.includes('склеп') || lower.includes('нежит') || lower.includes('тлен') || lower.includes('могил') || lower.includes('пещер')) {
    fallback = 'https://images.unsplash.com/photo-1534447677768-be436bb09401?auto=format&fit=crop&w=800&q=80';
  } else if (lower.includes('триумф') || lower.includes('побед') || lower.includes('тайник') || lower.includes('лут') || lower.includes('золот')) {
    fallback = 'https://images.unsplash.com/photo-1563089145-599997674d42?auto=format&fit=crop&w=800&q=80';
  }

  // 2. Primary dynamic image
  if (log.imageUrl) {
    return { primary: log.imageUrl, fallback };
  }

  const seed = Math.abs(
    (log.id || log.narrativeText || '').split('').reduce((acc, c) => (acc << 5) - acc + c.charCodeAt(0), 0) + log.roundNumber * 37
  );
  const prompt = `dnd dark fantasy cinematic scene: ${log.narrativeText.slice(0, 120)}`;
  const primary = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=800&height=400&nologo=true&seed=${seed}`;
  return { primary, fallback };
}

export const ChronicleLogEntry: React.FC<ChronicleLogEntryProps> = ({
  log,
  isPlaying,
  isLoading,
  onToggleVoice,
}) => {
  const { primary, fallback } = getLogIllustration(log);
  const [currentSrc, setCurrentSrc] = useState(primary);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const handleError = () => {
    if (currentSrc !== fallback) {
      setCurrentSrc(fallback);
    }
  };

  const title = log.roundNumber === 0 ? 'Преамбула' : `Хроника Раунда ${log.roundNumber}`;

  return (
    <>
      <div className="bg-fantasy-card/90 border border-fantasy-border/80 rounded-2xl overflow-hidden shadow-lg relative group transition-all">
        {/* Visual Scene Illustration Banner */}
        <div className="relative h-44 sm:h-60 w-full bg-slate-950 overflow-hidden border-b border-fantasy-border/50">
          {!hasLoaded && (
            <div className="absolute inset-0 bg-slate-900 animate-pulse flex items-center justify-center">
              <div className="flex items-center gap-2 text-xs text-amber-400/70 font-mono">
                <ImageIcon className="w-4 h-4 animate-bounce" />
                <span>Генерация иллюстрации сцены...</span>
              </div>
            </div>
          )}

          <img
            src={currentSrc}
            alt={title}
            onLoad={() => setHasLoaded(true)}
            onError={handleError}
            className={`w-full h-full object-cover transition-all duration-700 group-hover:scale-105 ${
              hasLoaded ? 'opacity-100' : 'opacity-0'
            }`}
            loading="lazy"
          />

          {/* Ambient Dark Gradient Overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/30 to-transparent pointer-events-none" />

          {/* Top-Right Fullscreen Preview Button */}
          <button
            type="button"
            onClick={() => setIsFullscreen(true)}
            className="absolute top-3 right-3 z-10 p-2 bg-black/60 hover:bg-black/90 backdrop-blur-md border border-slate-700/60 hover:border-amber-400 text-slate-300 hover:text-amber-300 rounded-xl transition-all shadow-lg opacity-80 hover:opacity-100"
            title="Развернуть иллюстрацию на весь экран"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>

          {/* Bottom-left illustration badge */}
          <div className="absolute bottom-2 left-4 z-10 flex items-center gap-1.5 text-[10px] text-amber-300/80 font-mono bg-black/50 px-2 py-0.5 rounded-md backdrop-blur-sm">
            <Sparkles className="w-3 h-3 text-amber-400" />
            <span>ИИ-иллюстрация сцены</span>
          </div>
        </div>

        {/* Content Section */}
        <div className="p-5">
          {/* Header */}
          <div className="flex items-center justify-between mb-3 border-b border-fantasy-border/50 pb-2">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-amber-500"></span>
              <h4 className="font-bold font-rpg text-sm text-amber-400">
                {title}
              </h4>
              {log.targetDC && (
                <span className="ml-2 px-2 py-0.5 rounded-full text-[10px] font-mono bg-amber-500/15 border border-amber-500/30 text-amber-300 font-bold flex items-center gap-1">
                  <ShieldAlert className="w-3 h-3 text-amber-400" />
                  СЛ: {log.targetDC}
                </span>
              )}
            </div>

            <NarrativeVoiceButton
              isPlaying={isPlaying}
              isLoading={isLoading}
              onToggle={onToggleVoice}
            />
          </div>

          {/* Story text */}
          <div className="text-sm text-slate-200 leading-relaxed whitespace-pre-line font-serif">
            {log.narrativeText}
          </div>

          {/* Dropped Loot in this round */}
          {log.droppedLoot && log.droppedLoot.length > 0 && (
            <div className="mt-4 pt-3 border-t border-fantasy-border/50 flex flex-wrap items-center gap-2">
              <span className="text-[11px] font-rpg text-amber-400 flex items-center gap-1 font-semibold">
                <Package className="w-3.5 h-3.5" /> Найдено:
              </span>
              {log.droppedLoot.map((item, i) => (
                <span
                  key={i}
                  className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-[11px] font-medium bg-amber-500/15 text-amber-200 border border-amber-500/30"
                >
                  {item.name}
                  {item.damage && <span className="text-[10px] text-amber-400 font-mono">({item.damage})</span>}
                  {item.healAmount && <span className="text-[10px] text-emerald-400 font-mono">(+{item.healAmount} HP)</span>}
                </span>
              ))}
            </div>
          )}

          {/* Damage / HP Updates Badge */}
          {log.playerUpdates && log.playerUpdates.length > 0 && (
            <div className="mt-3 pt-2 border-t border-fantasy-border/30 flex flex-wrap gap-2">
              {log.playerUpdates.map((u, i) => (
                <span
                  key={i}
                  className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${
                    u.hpDelta < 0
                      ? 'bg-red-500/10 text-red-400 border-red-500/30'
                      : u.hpDelta > 0
                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                      : 'bg-slate-800 text-slate-400 border-slate-700'
                  }`}
                >
                  <Heart className="w-3.5 h-3.5" />
                  {u.characterName}: {u.hpDelta > 0 ? `+${u.hpDelta}` : u.hpDelta} HP
                  {u.note && <span className="opacity-75 font-normal">({u.note})</span>}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Fullscreen Lightbox Modal */}
      {isFullscreen && (
        <div
          className="fixed inset-0 z-[60] bg-black/90 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in"
          onClick={() => setIsFullscreen(false)}
        >
          <div
            className="max-w-4xl w-full bg-slate-950 border border-slate-700 rounded-2xl overflow-hidden shadow-2xl relative"
            onClick={e => e.stopPropagation()}
          >
            <button
              onClick={() => setIsFullscreen(false)}
              className="absolute top-4 right-4 z-10 p-2 bg-black/70 hover:bg-black text-slate-300 hover:text-white rounded-full transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
            <img
              src={currentSrc}
              alt={title}
              className="w-full max-h-[75vh] object-contain bg-black"
            />
            <div className="p-4 bg-slate-900 border-t border-slate-800">
              <p className="text-xs sm:text-sm text-amber-300 font-medium text-center">
                {title} • Иллюстрация сцены
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
