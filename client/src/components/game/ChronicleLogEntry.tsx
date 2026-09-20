import React from 'react';
import { GameLogEntry } from '../../types';
import { Heart, ShieldAlert, Package, Compass, Sparkles } from 'lucide-react';
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

      {/* Step 2: Player Actions & Dice Check Verdicts */}
      {log.actionsSummary && (
        <div className="mt-4 p-3 rounded-xl bg-slate-950/70 border border-slate-800/80 space-y-1.5">
          <div className="font-rpg font-semibold text-amber-400 text-[11px] uppercase tracking-wider flex items-center gap-1.5">
            <span>🎲 Ходы героев и проверки:</span>
          </div>
          <div className="font-sans text-xs text-slate-300 whitespace-pre-line leading-relaxed">
            {log.actionsSummary}
          </div>
        </div>
      )}

      {/* Step 3: Current Situation & Choice Dilemma Callout */}
      {(log.currentSituation || log.choiceDilemma) && (
        <div className="mt-4 p-3.5 rounded-xl bg-gradient-to-r from-amber-950/40 via-purple-950/30 to-amber-950/40 border border-amber-500/40 space-y-2 shadow-md">
          {log.currentSituation && (
            <div className="flex items-start gap-2 text-xs">
              <Compass className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <div className="leading-relaxed">
                <span className="font-bold text-amber-300 font-rpg uppercase tracking-wider text-[11px] mr-1.5">
                  Итог ситуации:
                </span>
                <span className="text-slate-200 font-sans">{log.currentSituation}</span>
              </div>
            </div>
          )}
          {log.choiceDilemma && (
            <div className="flex items-start gap-2 text-xs pt-1.5 border-t border-amber-500/20">
              <Sparkles className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
              <div className="leading-relaxed">
                <span className="font-bold text-purple-300 font-rpg uppercase tracking-wider text-[11px] mr-1.5">
                  Выбор перед отрядом:
                </span>
                <span className="text-amber-100 font-medium font-sans">{log.choiceDilemma}</span>
              </div>
            </div>
          )}
        </div>
      )}

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
