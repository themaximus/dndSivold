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
  const title = log.roundNumber === 0 
    ? 'Преамбула' 
    : log.turnPlayerName 
      ? `Раунд ${log.roundNumber} • Ход: ${log.turnPlayerName}` 
      : `Хроника Раунда ${log.roundNumber}`;

  const { displayNarrative, effectiveSituation, effectiveDilemma } = React.useMemo(() => {
    let raw = log.narrativeText || '';
    let sit = log.currentSituation;
    let dil = log.choiceDilemma;

    // Safeguard against raw JSON strings in narrativeText
    if (raw.trim().startsWith('{') && raw.includes('"narrative"')) {
      const match = raw.match(/"narrative"\s*:\s*"((?:[^"\\]|\\.)*)"/);
      if (match && match[1]) {
        try {
          raw = JSON.parse(`"${match[1]}"`);
        } catch {
          raw = match[1].replace(/\\n/g, '\n').replace(/\\"/g, '"');
        }
      }
      if (!sit) {
        const sitMatch = log.narrativeText.match(/"currentSituation"\s*:\s*"((?:[^"\\]|\\.)*)"/);
        if (sitMatch && sitMatch[1]) sit = sitMatch[1];
      }
      if (!dil) {
        const dilMatch = log.narrativeText.match(/"choiceDilemma"\s*:\s*"((?:[^"\\]|\\.)*)"/);
        if (dilMatch && dilMatch[1]) dil = dilMatch[1];
      }
    }

    const outcomeMatch = raw.match(/📌\s*Итог ситуации:\s*([\s\S]*?)(?=(\n*❓\s*Выбор|$))/i);
    if (!sit && outcomeMatch && outcomeMatch[1]) {
      sit = outcomeMatch[1].trim();
    }
    const dilemmaMatch = raw.match(/❓\s*Выбор[^:]*:\s*([\s\S]*)$/i);
    if (!dil && dilemmaMatch && dilemmaMatch[1]) {
      dil = dilemmaMatch[1].trim();
    }

    const clean = raw
      .replace(/\n*📌\s*Итог ситуации:[\s\S]*?(?=(\n*❓\s*Выбор|$))/i, '')
      .replace(/\n*❓\s*Выбор[\s\S]*$/i, '')
      .trim();

    return {
      displayNarrative: clean,
      effectiveSituation: sit,
      effectiveDilemma: dil,
    };
  }, [log.narrativeText, log.currentSituation, log.choiceDilemma]);

  return (
    <div className="bg-fantasy-card/90 border border-fantasy-border/80 rounded-2xl p-5 shadow-lg relative group transition-all animate-card-reveal">
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
      <div className="text-[15px] sm:text-base text-slate-100 leading-relaxed whitespace-pre-line font-sans">
        {displayNarrative}
      </div>

      {/* Step 2: Player Actions & Dice Check Verdicts */}
      {log.actionsSummary && (
        <div className="mt-4 p-3.5 rounded-2xl bg-slate-950/70 border border-slate-800/80 space-y-2.5">
          <div className="font-rpg font-semibold text-amber-400 text-[11px] uppercase tracking-wider flex items-center gap-1.5">
            <span>🎲 Ходы героев и проверки:</span>
          </div>
          <div className="space-y-2">
            {log.actionsSummary.split('\n\n').filter(Boolean).map((block, idx) => {
              const lines = block.split('\n').map(l => l.trim()).filter(Boolean);
              const playerLine = lines[0] || block;
              const subLines = lines.slice(1);

              const itemLines = subLines.filter(l => l.includes('🎒 [Инвентарь]:') || l.startsWith('🎒'));
              const reactionLines = subLines.filter(l => l.includes('[Противодействие]') || l.includes('[Защита') || l.includes('[Содействие]'));
              const verdictLines = subLines.filter(l => !l.includes('🎒 [Инвентарь]:') && !l.startsWith('🎒') && !l.includes('[Противодействие]') && !l.includes('[Защита') && !l.includes('[Содействие]'));
              const rawVerdict = verdictLines.join(' ').replace(/^↳\s*/, '');
              const isCritSuccess = rawVerdict.includes('КРИТИЧЕСКИЙ УСПЕХ') || rawVerdict.includes('КРИТИЧЕСКОЕ ПОПАДАНИЕ');
              const isCritFail = rawVerdict.includes('КРИТИЧЕСКИЙ ПРОВАЛ') || rawVerdict.includes('КРИТИЧЕСКИЙ ПРОМАХ');
              const isSuccess = isCritSuccess || rawVerdict.includes('УСПЕХ') || rawVerdict.includes('ПОПАДАНИЕ');
              const isFail = isCritFail || rawVerdict.includes('ПРОВАЛ') || rawVerdict.includes('ПРОМАХ');
              
              const cleanVerdictLine = rawVerdict
                .replace(/^★\s*(КРИТИЧЕСКИЙ\s+)?(УСПЕХ|ПОПАДАНИЕ)[!:]?\s*/i, '')
                .replace(/^☠\s*(КРИТИЧЕСКИЙ\s+)?(ПРОВАЛ|ПРОМАХ)[!:]?\s*/i, '')
                .replace(/^✗\s*(КРИТИЧЕСКИЙ\s+)?(ПРОВАЛ|ПРОМАХ)[!:]?\s*/i, '')
                .replace(/^(КРИТИЧЕСКИЙ\s+)?(УСПЕХ|ПОПАДАНИЕ|ПРОВАЛ|ПРОМАХ)[!:]?\s*/i, '')
                .trim();

              return (
                <div
                  key={idx}
                  className={`p-2.5 rounded-xl border text-xs leading-relaxed transition-all ${
                    isCritSuccess
                      ? 'bg-amber-500/10 border-amber-500/40 text-amber-200 shadow-sm'
                      : isCritFail
                      ? 'bg-red-950/40 border-red-500/50 text-red-200 shadow-sm'
                      : isSuccess
                      ? 'bg-emerald-950/30 border-emerald-500/30 text-emerald-200 shadow-sm'
                      : isFail
                      ? 'bg-rose-950/30 border-rose-500/30 text-rose-200 shadow-sm'
                      : 'bg-slate-900/60 border-slate-800 text-slate-300'
                  }`}
                >
                  <div className="font-medium text-slate-100">{playerLine}</div>
                  
                  {rawVerdict && (
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5 font-mono text-[11px] font-bold">
                      {isSuccess ? (
                        <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 inline-flex items-center gap-1">
                          {isCritSuccess ? '★ КРИТ. УСПЕХ' : '★ УСПЕХ'}
                        </span>
                      ) : isFail ? (
                        <span className="px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/40 inline-flex items-center gap-1">
                          {isCritFail ? '☠ КРИТ. ПРОВАЛ' : '✗ ПРОВАЛ'}
                        </span>
                      ) : null}
                      {cleanVerdictLine ? (
                        <span className="text-slate-300 font-sans font-normal">{cleanVerdictLine}</span>
                      ) : !isSuccess && !isFail ? (
                        <span className="text-slate-300 font-sans font-normal">{rawVerdict}</span>
                      ) : null}
                    </div>
                  )}

                  {/* Reaction Lines */}
                  {reactionLines.map((rLine, rIdx) => (
                    <div key={rIdx} className="mt-1.5 px-2.5 py-1 rounded-lg bg-indigo-950/40 border border-indigo-500/30 text-indigo-200 text-[11px] font-sans">
                      {rLine.replace(/^↳\s*/, '')}
                    </div>
                  ))}

                  {/* Inventory Activity (Found, Used, Lost items) */}
                  {itemLines.map((iLine, iIdx) => (
                    <div key={iIdx} className="mt-1.5 px-2.5 py-1 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-200 text-[11px] font-sans flex items-center gap-1.5">
                      <Package className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                      <span>{iLine.replace(/^↳\s*/, '').replace(/^🎒\s*(\[Инвентарь\]:)?\s*/, '')}</span>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Step 3: Current Situation & Choice Dilemma Callout */}
      {(effectiveSituation || effectiveDilemma) && (
        <div className="mt-4 p-3.5 rounded-xl bg-gradient-to-r from-amber-950/40 via-purple-950/30 to-amber-950/40 border border-amber-500/40 space-y-2 shadow-md">
          {effectiveSituation && (
            <div className="flex items-start gap-2 text-xs">
              <Compass className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <div className="leading-relaxed">
                <span className="font-bold text-amber-300 font-rpg uppercase tracking-wider text-[11px] mr-1.5">
                  Итог ситуации:
                </span>
                <span className="text-slate-200 font-sans">{effectiveSituation}</span>
              </div>
            </div>
          )}
          {effectiveDilemma && (
            <div className="flex items-start gap-2 text-xs pt-1.5 border-t border-amber-500/20">
              <Sparkles className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
              <div className="leading-relaxed">
                <span className="font-bold text-purple-300 font-rpg uppercase tracking-wider text-[11px] mr-1.5">
                  Выбор перед отрядом:
                </span>
                <span className="text-amber-100 font-medium font-sans">{effectiveDilemma}</span>
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
      {log.playerUpdates && log.playerUpdates.filter(u => u.hpDelta !== 0).length > 0 && (
        <div className="mt-3 pt-2 border-t border-fantasy-border/30 flex flex-wrap gap-2">
          {log.playerUpdates.filter(u => u.hpDelta !== 0).map((u, i) => (
            <span
              key={i}
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${
                u.hpDelta < 0
                  ? 'bg-red-500/10 text-red-400 border-red-500/30'
                  : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
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
