import React, { useState } from 'react';
import { Character } from '../../types';
import { Flame, Tent, Moon, Heart, Sparkles, X, Dices, Shield, CheckCircle2 } from 'lucide-react';
import { soundFx } from '../../utils/audio';

interface RestModalProps {
  isOpen: boolean;
  character: Character | null;
  isCombat?: boolean;
  currentRound?: number;
  onClose: () => void;
  onShortRest: (diceCount: number) => Promise<{ healedHp: number; diceSpent: number; rolls: number[] } | void>;
  onLongRest: () => Promise<{ healedHp: number } | void>;
}

export const RestModal: React.FC<RestModalProps> = ({
  isOpen,
  character,
  isCombat = false,
  currentRound,
  onClose,
  onShortRest,
  onLongRest,
}) => {
  const [restType, setRestType] = useState<'short' | 'long'>('short');
  const [diceCount, setDiceCount] = useState<number>(1);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [resultMessage, setResultMessage] = useState<string | null>(null);

  if (!isOpen || !character) return null;

  const maxDice = character.hitDiceCurrent ?? (character.level || 1);
  const hdType = character.hitDiceType || 'd8';
  const conMod = Math.floor(((character.stats?.con ?? 10) - 10) / 2);
  const missingHp = character.hpMax - character.hpCurrent;

  const shortRestsUsed = character.shortRestsCount ?? 0;
  const isShortRestLimitReached = shortRestsUsed >= 2;
  const longRestCooldown = (character.lastLongRestRound !== undefined && currentRound !== undefined)
    ? Math.max(0, 6 - (currentRound - character.lastLongRestRound))
    : 0;

  const isShortRestDisabled = isProcessing || maxDice <= 0 || isCombat || isShortRestLimitReached;
  const isLongRestDisabled = isProcessing || isCombat || longRestCooldown > 0;

  const handleShortRest = async () => {
    if (maxDice <= 0) {
      alert('У вас не осталось костей хитов для короткого отдыха!');
      return;
    }
    setIsProcessing(true);
    setResultMessage(null);
    try {
      soundFx.playDiceRoll();
      const res = await onShortRest(Math.min(diceCount, maxDice));
      if (res) {
        soundFx.playTurnStart();
        setResultMessage(`★ Короткий отдых завершён! Восстановлено +${res.healedHp} HP (потрачено ${res.diceSpent} ${hdType}). Броски: [${res.rolls.join(', ')}].`);
      }
    } catch (err: any) {
      alert(err.message || 'Ошибка при проведении отдыха');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleLongRest = async () => {
    setIsProcessing(true);
    setResultMessage(null);
    try {
      soundFx.playTurnStart();
      const res = await onLongRest();
      if (res) {
        setResultMessage(`★ Продолжительный отдых завершён! Здоровье полностью восстановлено (+${res.healedHp} HP), восстановлена половина костей хитов и все ячейки заклинаний.`);
      }
    } catch (err: any) {
      alert(err.message || 'Ошибка при проведении отдыха');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-fantasy-card border border-fantasy-border rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-4 bg-fantasy-panel border-b border-fantasy-border flex items-center justify-between">
          <div className="flex items-center gap-2 text-amber-400">
            <Flame className="w-5 h-5 text-amber-500 fill-amber-500/30" />
            <h3 className="font-bold font-rpg text-base tracking-wide">
              Привал и Отдых отряда (D&D 5e)
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-5 overflow-y-auto custom-scrollbar">
          {/* Combat warning banner */}
          {isCombat && (
            <div className="p-3 bg-red-950/60 border border-red-500/60 rounded-xl flex items-center gap-2.5 text-xs text-red-200">
              <Shield className="w-5 h-5 text-red-400 shrink-0" />
              <span>⚔️ Нельзя отдыхать во время активного боя! Сначала одолейте противников или отступите в безопасную зону.</span>
            </div>
          )}

          {/* Character Status Overview */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 bg-slate-900/60 p-3 rounded-xl border border-slate-800 text-xs">
            <div>
              <span className="text-slate-400 block mb-0.5">Здоровье (HP):</span>
              <span className="font-bold text-slate-100 text-sm flex items-center gap-1">
                <Heart className="w-3.5 h-3.5 text-red-400 fill-red-400/30" />
                {character.hpCurrent} / {character.hpMax}
                {missingHp > 0 ? (
                  <span className="text-[10px] text-red-400">(-{missingHp})</span>
                ) : (
                  <span className="text-[10px] text-emerald-400">(полное)</span>
                )}
              </span>
            </div>

            <div>
              <span className="text-slate-400 block mb-0.5">Кости хитов:</span>
              <span className="font-bold text-amber-400 text-sm flex items-center gap-1">
                <Dices className="w-3.5 h-3.5 text-amber-400" />
                {maxDice} / {character.hitDiceMax ?? character.level} <span className="text-slate-400 text-xs font-normal">({hdType})</span>
              </span>
            </div>

            <div>
              <span className="text-slate-400 block mb-0.5">Мод. ТЕЛ:</span>
              <span className="font-bold text-blue-400 text-sm">
                {conMod >= 0 ? `+${conMod}` : conMod} к кости
              </span>
            </div>

            <div>
              <span className="text-slate-400 block mb-0.5">Коротких отдыха:</span>
              <span className={`font-bold text-sm ${isShortRestLimitReached ? 'text-rose-400' : 'text-emerald-400'}`}>
                {shortRestsUsed} / 2 {isShortRestLimitReached ? '(макс)' : ''}
              </span>
            </div>
          </div>

          {/* Spell Slots Summary if present */}
          {character.spellSlots && Object.keys(character.spellSlots).length > 0 && (
            <div className="bg-purple-950/20 border border-purple-800/40 p-3 rounded-xl">
              <span className="text-xs font-semibold text-purple-300 block mb-1.5 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                Ячейки заклинаний:
              </span>
              <div className="flex flex-wrap gap-2">
                {Object.entries(character.spellSlots).map(([lvl, slot]) => (
                  <span
                    key={lvl}
                    className="px-2 py-0.5 rounded-lg text-xs font-mono bg-purple-900/40 text-purple-200 border border-purple-700/50"
                  >
                    {lvl} круг: {slot.current}/{slot.max}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Rest Mode Selection Tabs */}
          <div className="grid grid-cols-2 gap-2 p-1 bg-slate-900 rounded-xl border border-slate-800">
            <button
              type="button"
              onClick={() => { setRestType('short'); setResultMessage(null); }}
              className={`py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                restType === 'short'
                  ? 'bg-amber-500 text-black shadow-md'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <Tent className="w-4 h-4" />
              Короткий отдых (1 ч)
            </button>
            <button
              type="button"
              onClick={() => { setRestType('long'); setResultMessage(null); }}
              className={`py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                restType === 'long'
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <Moon className="w-4 h-4" />
              Длительный отдых (8 ч)
            </button>
          </div>

          {/* Rest Tab Content */}
          {restType === 'short' ? (
            <div className="space-y-4 bg-amber-500/5 border border-amber-500/20 p-4 rounded-xl">
              <div>
                <h4 className="font-bold text-amber-300 text-sm mb-1 flex items-center gap-1.5">
                  <Tent className="w-4 h-4 text-amber-400" />
                  Передышка и перевязка ран
                </h4>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Потратьте доступные кости хитов (<strong>{hdType}</strong> + мод. ТЕЛ), чтобы восстановить здоровье в течение короткого привала.
                </p>
              </div>

              {maxDice > 0 ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-300">Сколько костей хитов потратить:</span>
                    <span className="font-mono font-bold text-amber-400 text-sm">
                      {diceCount} из {maxDice}
                    </span>
                  </div>

                  <div className="flex items-center gap-3">
                    <input
                      type="range"
                      min={1}
                      max={maxDice}
                      value={diceCount}
                      onChange={(e) => setDiceCount(Number(e.target.value))}
                      className="flex-1 accent-amber-500 h-2 bg-slate-800 rounded-lg cursor-pointer"
                    />
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setDiceCount(prev => Math.max(1, prev - 1))}
                        className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-xs border border-slate-700"
                      >
                        -
                      </button>
                      <button
                        type="button"
                        onClick={() => setDiceCount(prev => Math.min(maxDice, prev + 1))}
                        className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-xs border border-slate-700"
                      >
                        +
                      </button>
                    </div>
                  </div>

                  <div className="text-[11px] text-slate-400 bg-slate-900/60 p-2 rounded-lg border border-slate-800">
                    Ожидаемое исцеление: <strong>{diceCount} × ({hdType} + {conMod})</strong>
                  </div>
                </div>
              ) : (
                <div className="p-3 bg-red-950/30 border border-red-500/30 rounded-lg text-xs text-red-300">
                  ⚠️ У вас не осталось костей хитов (0/{character.hitDiceMax ?? character.level}). Проведите продолжительный отдых, чтобы восстановить их!
                </div>
              )}

              {isShortRestLimitReached && (
                <div className="p-3 bg-amber-950/30 border border-amber-500/30 rounded-lg text-xs text-amber-300">
                  ⚠️ Вы уже совершили 2 коротких отдыха до сна. Требуется длительный отдых!
                </div>
              )}

              <button
                type="button"
                onClick={handleShortRest}
                disabled={isShortRestDisabled}
                className="w-full py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black font-bold font-rpg text-xs rounded-xl shadow-lg shadow-amber-500/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Dices className="w-4 h-4" />
                {isProcessing ? 'Бросок костей...' : isCombat ? 'Недоступно во время боя' : isShortRestLimitReached ? 'Лимит отдыха исчерпан (2/2)' : `Потратить ${diceCount} ${hdType} и восстановить HP`}
              </button>
            </div>
          ) : (
            <div className="space-y-4 bg-indigo-950/20 border border-indigo-800/30 p-4 rounded-xl">
              <div>
                <h4 className="font-bold text-indigo-300 text-sm mb-1 flex items-center gap-1.5">
                  <Moon className="w-4 h-4 text-indigo-400" />
                  Полноценный сон и восстановление сил
                </h4>
                <p className="text-xs text-slate-300 leading-relaxed">
                  8 часов непрерывного отдыха в безопасном месте (доступен не чаще раза в 6 раундов).
                </p>
              </div>

              <ul className="text-xs text-slate-300 space-y-1.5 bg-slate-900/60 p-3 rounded-lg border border-slate-800">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span>Полное восстановление здоровья до максимума (<strong>{character.hpMax} HP</strong>).</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span>Восстановление половины максимума костей хитов (+{Math.max(1, Math.floor((character.hitDiceMax ?? character.level) / 2))}).</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span>Полное восстановление всех ячеек заклинаний.</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span>Снятие временных боевых состояний и сброс счетчика коротких отдыхов.</span>
                </li>
              </ul>

              {longRestCooldown > 0 && (
                <div className="p-3 bg-indigo-950/40 border border-indigo-500/40 rounded-lg text-xs text-indigo-300">
                  ⚠️ Длительный отдых доступен не чаще одного раза в 6 раундов. До следующего отдыха осталось: <strong>{longRestCooldown} раунд(ов)</strong>.
                </div>
              )}

              <button
                type="button"
                onClick={handleLongRest}
                disabled={isLongRestDisabled}
                className="w-full py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold font-rpg text-xs rounded-xl shadow-lg shadow-indigo-600/30 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Moon className="w-4 h-4" />
                {isProcessing ? 'Отдых...' : isCombat ? 'Недоступно во время боя' : longRestCooldown > 0 ? `Перезарядка (${longRestCooldown} раунд.)` : 'Провести длительный отдых'}
              </button>
            </div>
          )}

          {/* Rest Outcome Message */}
          {resultMessage && (
            <div className="p-3 bg-emerald-950/40 border border-emerald-500/50 rounded-xl text-xs text-emerald-300 leading-relaxed animate-in fade-in">
              {resultMessage}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-fantasy-panel border-t border-fantasy-border flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl transition-colors"
          >
            Закрыть
          </button>
        </div>
      </div>
    </div>
  );
};
