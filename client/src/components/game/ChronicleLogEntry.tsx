import React from 'react';
import { GameLogEntry } from '../../types';
import { Heart, ShieldAlert, Package } from 'lucide-react';
import { NarrativeVoiceButton } from './NarrativeVoiceButton';

interface ChronicleLogEntryProps {
  log: GameLogEntry;
  isPlaying: boolean;
  isLoading: boolean;
  onToggleVoice: () => void;
}

export const ChronicleLogEntry: React.FC<ChronicleLogEntryProps> = ({
  log,
  isPlaying,
  isLoading,
  onToggleVoice,
}) => {
  const title = log.roundNumber === 0 ? 'Преамбула' : `Хроника Раунда ${log.roundNumber}`;

  return (
    <div className="bg-fantasy-card/90 border border-fantasy-border/80 rounded-2xl p-5 shadow-lg relative group transition-all">
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
              СЛ: {log.targetDC} {log.requiredCheckStat ? `[${log.requiredCheckStat.toUpperCase()}]` : ''}
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
  );
};
