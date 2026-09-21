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
    <div className="bg-[#12151f] border-2 border-[#3d3422] rounded-xl p-4 sm:p-6 shadow-2xl relative transition-all font-serif space-y-4">
      {/* Video Game Quest Log Header */}
      <div className="flex items-center justify-between border-b border-[#28251e] pb-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-base">👑</span>
          <h4 className="font-extrabold font-rpg text-base sm:text-lg text-[#facc15] tracking-wide flex items-center gap-1.5">
            <span>ГОЛОС МАСТЕРА</span>
            <span className="text-xs font-mono font-normal text-[#c5a059] px-2 py-0.5 rounded bg-[#1f1a12] border border-[#524126]">
              {title}
            </span>
          </h4>
          {log.targetDC && (
            <span className="ml-1 px-2.5 py-0.5 rounded text-xs font-mono font-bold bg-[#1f1a12] border border-[#f59e0b]/60 text-[#fef08a] flex items-center gap-1 shadow-sm">
              <span className="text-sm">🎯</span>
              <span>СЛ {log.targetDC}</span>
              {log.requiredCheckStat && (
                <span className="text-[#f59e0b] ml-0.5">[{log.requiredCheckStat.toUpperCase()}]</span>
              )}
            </span>
          )}
        </div>

        <NarrativeVoiceButton
          isPlaying={isPlaying}
          isLoading={isLoading}
          onToggle={onToggleVoice}
        />
      </div>

      {/* Story text - LARGE, IMMERSIVE, HIGH CONTRAST */}
      <div className="text-base sm:text-[18px] text-[#fbf8f0] leading-[1.85] whitespace-pre-line font-serif drop-shadow-sm tracking-wide">
        {displayNarrative}
      </div>

      {/* Step 2: Player Actions & Dice Check Verdicts */}
      {log.actionsSummary && (
        <div className="mt-4 p-3.5 rounded-lg bg-[#0e1017] border border-[#242935] space-y-2.5">
          <div className="font-rpg font-semibold text-[#c5a059] text-xs uppercase tracking-wider flex items-center gap-1.5">
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
                  className={`p-2.5 rounded-lg border text-xs font-serif leading-relaxed transition-all ${
                    isCritSuccess
                      ? 'bg-[#231d13] border-[#785e2b] text-[#e2c26a]'
                      : isCritFail
                      ? 'bg-[#261316] border-[#782b32] text-[#fca5a5]'
                      : isSuccess
                      ? 'bg-[#122319] border-[#29563d] text-[#86efac]'
                      : isFail
                      ? 'bg-[#221316] border-[#6b252c] text-[#fca5a5]'
                      : 'bg-[#131620] border-[#252a36] text-[#ded7c8]'
                  }`}
                >
                  <div className="font-medium text-[#ded7c8]">{playerLine}</div>
                  
                  {rawVerdict && (
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5 font-mono text-[11px] font-bold">
                      {isSuccess ? (
                        <span className="px-2 py-0.5 rounded bg-[#163829] text-[#86efac] border border-[#29563d] inline-flex items-center gap-1">
                          {isCritSuccess ? '★ КРИТ. УСПЕХ' : '★ УСПЕХ'}
                        </span>
                      ) : isFail ? (
                        <span className="px-2 py-0.5 rounded bg-[#2b1316] text-[#fca5a5] border border-[#782b32] inline-flex items-center gap-1">
                          {isCritFail ? '☠ КРИТ. ПРОВАЛ' : '✗ ПРОВАЛ'}
                        </span>
                      ) : null}
                      {cleanVerdictLine ? (
                        <span className="text-[#ded7c8] font-serif font-normal">{cleanVerdictLine}</span>
                      ) : !isSuccess && !isFail ? (
                        <span className="text-[#ded7c8] font-serif font-normal">{rawVerdict}</span>
                      ) : null}
                    </div>
                  )}

                  {/* Reaction Lines */}
                  {reactionLines.map((rLine, rIdx) => (
                    <div key={rIdx} className="mt-1.5 px-2.5 py-1 rounded bg-[#1a1728] border border-[#44376b] text-[#d8b4fe] text-[11px] font-serif">
                      {rLine.replace(/^↳\s*/, '')}
                    </div>
                  ))}

                  {/* Inventory Activity (Found, Used, Lost items) */}
                  {itemLines.map((iLine, iIdx) => (
                    <div key={iIdx} className="mt-1.5 px-2.5 py-1 rounded bg-[#1c1913] border border-[#4a3e26] text-[#e2c26a] text-[11px] font-serif flex items-center gap-1.5">
                      <Package className="w-3.5 h-3.5 text-[#c5a059] shrink-0" />
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
        <div className="mt-4 p-3.5 rounded-lg bg-[#11131a] border border-[#3d3424] space-y-2 shadow-sm">
          {effectiveSituation && (
            <div className="flex items-start gap-2 text-xs font-serif">
              <Compass className="w-4 h-4 text-[#c5a059] shrink-0 mt-0.5" />
              <div className="leading-relaxed">
                <span className="font-bold text-[#e2c26a] font-rpg uppercase tracking-wider text-[11px] mr-1.5">
                  Итог ситуации:
                </span>
                <span className="text-[#ded7c8]">{effectiveSituation}</span>
              </div>
            </div>
          )}
          {effectiveDilemma && (
            <div className="flex items-start gap-2 text-xs font-serif pt-2 border-t border-[#2a2e3b]">
              <Sparkles className="w-4 h-4 text-[#c084fc] shrink-0 mt-0.5" />
              <div className="leading-relaxed">
                <span className="font-bold text-[#d8b4fe] font-rpg uppercase tracking-wider text-[11px] mr-1.5">
                  Выбор перед отрядом:
                </span>
                <span className="text-[#e2c26a] font-medium">{effectiveDilemma}</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Dropped Loot in this round */}
      {log.droppedLoot && log.droppedLoot.length > 0 && (
        <div className="mt-4 pt-3 border-t border-[#242935] flex flex-wrap items-center gap-2 font-serif">
          <span className="text-xs font-rpg text-[#c5a059] flex items-center gap-1 font-semibold">
            <Package className="w-3.5 h-3.5" /> Найдено:
          </span>
          {log.droppedLoot.map((item, i) => (
            <span
              key={i}
              className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-xs bg-[#1c1913] text-[#e2c26a] border border-[#4a3e26]"
            >
              {item.name}
              {item.damage && <span className="text-[10px] text-[#c5a059] font-mono">({item.damage})</span>}
              {item.healAmount && <span className="text-[10px] text-[#4ade80] font-mono">(+{item.healAmount} HP)</span>}
            </span>
          ))}
        </div>
      )}

      {/* Damage / HP Updates Badge */}
      {log.playerUpdates && log.playerUpdates.length > 0 && (
        <div className="mt-3 pt-2 border-t border-[#242935] flex flex-wrap gap-2 font-serif">
          {log.playerUpdates.map((u, i) => (
            <span
              key={i}
              className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded text-xs border ${
                u.hpDelta < 0
                  ? 'bg-[#281316] text-[#fca5a5] border-[#6b252c]'
                  : u.hpDelta > 0
                  ? 'bg-[#122319] text-[#86efac] border-[#29563d]'
                  : 'bg-[#181c25] text-[#ded7c8] border-[#2e3544]'
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
