import React from 'react';
import { Volume2, Square, Loader2 } from 'lucide-react';

interface NarrativeVoiceButtonProps {
  isPlaying: boolean;
  isLoading: boolean;
  onToggle: () => void;
}

export const NarrativeVoiceButton: React.FC<NarrativeVoiceButtonProps> = ({
  isPlaying,
  isLoading,
  onToggle,
}) => {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onToggle();
      }}
      className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 border ${
        isPlaying
          ? 'bg-amber-500/20 border-amber-500 text-amber-300 shadow-glow-gold animate-pulse'
          : isLoading
          ? 'bg-slate-800 border-amber-500/50 text-amber-400'
          : 'bg-fantasy-panel border-fantasy-border text-slate-400 hover:text-amber-300 hover:border-amber-500/40 hover:bg-slate-800'
      }`}
      title={
        isPlaying
          ? 'Остановить нейро-озвучку'
          : isLoading
          ? 'Нейросеть генерирует голос Дмитрия...'
          : 'Слушать нейро-голос Дмитрия'
      }
    >
      {isLoading ? (
        <>
          <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-400" />
          <span className="text-[11px]">Синтез...</span>
        </>
      ) : isPlaying ? (
        <>
          <Square className="w-3.5 h-3.5 fill-current text-amber-400" />
          <span className="text-[11px]">Стоп</span>
        </>
      ) : (
        <>
          <Volume2 className="w-3.5 h-3.5" />
          <span className="text-[11px]">Голос DM</span>
        </>
      )}
    </button>
  );
};
