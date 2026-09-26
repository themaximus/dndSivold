import React, { useState, useEffect } from 'react';
import { Character, CharacterReactionRequest, DiceRollResult } from '../../types';
import { ThreeD20Die } from './ThreeD20Die';
import { soundFx } from '../../utils/audio';
import confetti from 'canvas-confetti';
import { ShieldAlert, Shield, Swords, Handshake, Dices, X, CheckCircle, Sparkles } from 'lucide-react';

interface ReactionModalProps {
  isOpen: boolean;
  reactionRequest: CharacterReactionRequest | null;
  character: Character | null;
  targetDC?: number;
  onSubmit: (
    reactionRequestId: string,
    reactionText: string,
    reactionRoll: DiceRollResult | null,
    responseType: 'positive' | 'negative' | 'counter'
  ) => void;
  onSkip: (reactionRequestId: string) => void;
}

export const ReactionModal: React.FC<ReactionModalProps> = ({
  isOpen,
  reactionRequest,
  character,
  targetDC = 12,
  onSubmit,
  onSkip,
}) => {
  const [responseType, setResponseType] = useState<'positive' | 'negative' | 'counter'>('counter');
  const [reactionText, setReactionText] = useState('Уклоняюсь в сторону или прикрываюсь щитом');
  const [isRolling, setIsRolling] = useState(false);
  const [hasRolled, setHasRolled] = useState(false);
  const [rollResult, setRollResult] = useState<DiceRollResult | null>(null);
  const [pendingDie, setPendingDie] = useState<number | null>(null);

  // Reset local state when a new request arrives
  useEffect(() => {
    if (reactionRequest) {
      setResponseType('counter');
      setReactionText('Уклоняюсь в сторону или прикрываюсь щитом');
      setIsRolling(false);
      setHasRolled(false);
      setRollResult(null);
      setPendingDie(null);
    }
  }, [reactionRequest?.id]);

  if (!isOpen || !reactionRequest) return null;

  const isYielding = responseType === 'positive';

  const handleRollDice = () => {
    if (isRolling || hasRolled) return;

    setIsRolling(true);
    soundFx.playDiceRoll();

    // Determine relevant stat modifier
    let statKey: 'str' | 'dex' | 'con' | 'int' | 'wis' | 'cha' = 'dex';
    if (responseType === 'negative') statKey = 'str';
    else statKey = 'dex';

    const statScore = character?.stats?.[statKey] ?? 10;
    const modifier = Math.floor((statScore - 10) / 2);

    const baseRoll = Math.floor(Math.random() * 20) + 1;
    setPendingDie(baseRoll);
    const total = baseRoll + modifier;
    const isCriticalSuccess = baseRoll === 20;
    const isCriticalFail = baseRoll === 1;

    setTimeout(() => {
      setIsRolling(false);
      setHasRolled(true);
      const res: DiceRollResult = {
        diceType: 'd20',
        rolls: [baseRoll],
        baseRoll,
        total,
        modifier,
        isCriticalSuccess,
        isCriticalFail,
        statName: statKey,
        purpose: `Реакция защиты (${statKey.toUpperCase()})`,
        breakdown: `d20 [${baseRoll}] + ${modifier} (${statKey.toUpperCase()}) = ${total}`,
      };
      setRollResult(res);

      if (isCriticalSuccess || total >= targetDC) {
        soundFx.playCriticalSuccess();
        confetti({
          particleCount: 50,
          spread: 60,
          origin: { y: 0.6 },
        });
      } else {
        soundFx.playCriticalFail();
      }
    }, 1800);
  };

  const handleSubmit = () => {
    if (!reactionRequest) return;
    if (!isYielding && !rollResult) return;

    const fallbackRoll: DiceRollResult = {
      diceType: 'd20',
      rolls: [10],
      baseRoll: 10,
      total: 10,
      modifier: 0,
      isCriticalSuccess: false,
      isCriticalFail: false,
      statName: 'принятие',
      purpose: 'Добровольное принятие без сопротивления',
      breakdown: 'Без проверки',
    };

    const text = reactionText.trim() || (
      isYielding
        ? 'Добровольно подчиняется и не оказывает сопротивления'
        : responseType === 'negative'
        ? 'Парирует оружием и контратакует в ответ'
        : 'Уклоняется или закрывается щитом'
    );

    onSubmit(reactionRequest.id, text, rollResult || fallbackRoll, responseType);
  };

  const handleSelectPreset = (type: 'positive' | 'negative' | 'counter', defaultSnippet: string) => {
    setResponseType(type);
    setReactionText(defaultSnippet);
    if (type === 'positive') {
      setIsRolling(false);
      setHasRolled(false);
      setRollResult(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-fade-in">
      <div className="w-full max-w-xl bg-fantasy-card border-2 border-amber-500/60 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-5 py-3.5 bg-gradient-to-r from-red-950/60 via-amber-950/50 to-slate-900 border-b border-fantasy-border flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-red-500/20 rounded-xl border border-red-500/40 text-red-400">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-rpg font-bold text-amber-300">
                Попытка воздействия на вашего героя!
              </h3>
              <p className="text-xs text-slate-400">
                {reactionRequest.initiatorCharacterName} предпринимает прямое действие против {character?.name || 'вас'}
              </p>
            </div>
          </div>
          <button
            onClick={() => onSkip(reactionRequest.id)}
            className="text-slate-400 hover:text-slate-200 p-1.5 rounded-lg hover:bg-slate-800 transition-colors"
            title="Пропустить реакцию (решение ДМ)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4 overflow-y-auto custom-scrollbar">
          {/* Initiator Action Quote */}
          <div className="bg-slate-950/70 border border-amber-500/30 rounded-xl p-3.5 relative">
            <span className="text-[10px] font-mono text-amber-400 font-bold uppercase tracking-wider block mb-1">
              Действие инициатора ({reactionRequest.initiatorCharacterName}):
            </span>
            <p className="text-xs sm:text-sm text-slate-200 italic leading-relaxed">
              «{reactionRequest.initiatorActionText}»
            </p>
            {reactionRequest.initiatorRoll && (
              <div className="mt-2 text-[11px] font-mono text-slate-400 flex items-center gap-1.5">
                <Dices className="w-3.5 h-3.5 text-amber-400" />
                <span>Бросок инициатора: total {reactionRequest.initiatorRoll.total}</span>
              </div>
            )}
          </div>

          {/* Stance Selector */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-2">
              Как ваш герой реагирует на воздействие?
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => handleSelectPreset('counter', 'Уклоняюсь в сторону или прикрываюсь щитом')}
                className={`p-2.5 rounded-xl border text-xs font-semibold flex flex-col items-center gap-1 transition-all ${
                  responseType === 'counter'
                    ? 'bg-blue-950/70 border-blue-500 text-blue-300 shadow-glow-gold'
                    : 'bg-slate-900/60 border-slate-700 text-slate-400 hover:border-blue-600/40'
                }`}
              >
                <Shield className="w-4 h-4 text-blue-400" />
                <span>🛡️ Защита</span>
              </button>

              <button
                type="button"
                onClick={() => handleSelectPreset('negative', 'Парирую оружием и наношу встречный контрудар')}
                className={`p-2.5 rounded-xl border text-xs font-semibold flex flex-col items-center gap-1 transition-all ${
                  responseType === 'negative'
                    ? 'bg-red-950/70 border-red-500 text-red-300 shadow-glow-gold'
                    : 'bg-slate-900/60 border-slate-700 text-slate-400 hover:border-red-600/40'
                }`}
              >
                <Swords className="w-4 h-4 text-red-400" />
                <span>⚔️ Контрудар</span>
              </button>

              <button
                type="button"
                onClick={() => handleSelectPreset('positive', 'Не оказываю сопротивления и позволяю совершить действие')}
                className={`p-2.5 rounded-xl border text-xs font-semibold flex flex-col items-center gap-1 transition-all ${
                  responseType === 'positive'
                    ? 'bg-emerald-950/70 border-emerald-500 text-emerald-300 shadow-glow-gold'
                    : 'bg-slate-900/60 border-slate-700 text-slate-400 hover:border-emerald-600/40'
                }`}
              >
                <Handshake className="w-4 h-4 text-emerald-400" />
                <span>🏳️ Принять</span>
              </button>
            </div>
          </div>

          {/* Description Textarea */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Описание ответной реакции ({character?.name || 'Вы'}):
            </label>
            <textarea
              value={reactionText}
              onChange={(e) => setReactionText(e.target.value)}
              placeholder="Опишите ваше действие или ответные слова..."
              rows={2}
              className="w-full bg-slate-950/90 border border-slate-700 rounded-xl p-3 text-xs sm:text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-500/80 resize-none transition-colors"
            />
          </div>

          {/* Dynamic Action Section: Voluntary yield banner OR d20 Roll */}
          {isYielding ? (
            <div className="bg-emerald-950/40 border border-emerald-500/40 rounded-2xl p-4 text-center space-y-1.5 animate-in fade-in">
              <div className="flex items-center justify-center gap-2 text-emerald-300 font-semibold text-xs">
                <CheckCircle className="w-4 h-4 text-emerald-400" />
                <span>Добровольное согласие (без сопротивления)</span>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                Вы решили не сопротивляться попытке воздействия соратника. Бросок кубика не требуется — действие разрешится мирно и без встречной проверки.
              </p>
            </div>
          ) : (
            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 flex flex-col items-center justify-center relative overflow-hidden animate-in fade-in">
              <div className="flex items-center gap-2 mb-2 text-xs font-mono text-slate-400">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                <span>Встречный бросок d20 против броска инициатора</span>
              </div>

              {/* 3D d20 Canvas */}
              <div className="relative my-1">
                <ThreeD20Die
                  size={150}
                  isRolling={isRolling}
                  targetNumber={rollResult?.baseRoll ?? pendingDie ?? null}
                  targetDC={targetDC}
                />
              </div>

              {/* Roll result display or roll button */}
              {!hasRolled ? (
                <button
                  type="button"
                  disabled={isRolling}
                  onClick={handleRollDice}
                  className="mt-2 px-6 py-2.5 bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-black font-rpg font-bold text-xs sm:text-sm rounded-xl shadow-lg shadow-amber-600/30 transition-all flex items-center gap-2 disabled:opacity-50"
                >
                  <Dices className="w-4 h-4" />
                  {isRolling ? 'Кубик вращается...' : 'Бросить кубик d20 на реакцию'}
                </button>
              ) : (
                <div className="mt-2 text-center">
                  <div className="flex items-center justify-center gap-2 font-mono">
                    <span className="text-xs text-slate-400">Результат реакции:</span>
                    <span className={`text-base font-bold px-2 py-0.5 rounded-lg border ${
                      rollResult?.isCriticalSuccess
                        ? 'bg-amber-500/30 border-amber-400 text-amber-300'
                        : rollResult?.isCriticalFail
                        ? 'bg-red-500/30 border-red-500 text-red-400'
                        : (rollResult?.total ?? 0) >= (reactionRequest.initiatorRoll?.total ?? targetDC)
                        ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
                        : 'bg-slate-800 border-slate-700 text-slate-300'
                    }`}>
                      {rollResult?.total}
                    </span>
                    <span className="text-xs text-slate-500">
                      ({rollResult?.breakdown})
                    </span>
                  </div>
                  <p className="text-[11px] text-emerald-400 font-semibold mt-1">
                    ✓ Встречный бросок зафиксирован. Подтвердите отправку ответа.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 bg-slate-900/90 border-t border-fantasy-border flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => onSkip(reactionRequest.id)}
            className="px-4 py-2 text-xs text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-xl transition-colors"
          >
            Пропустить (решение ДМ)
          </button>

          <button
            type="button"
            disabled={!isYielding && (!hasRolled || !rollResult)}
            onClick={handleSubmit}
            className="px-6 py-2.5 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-slate-950 font-bold font-rpg text-xs sm:text-sm rounded-xl shadow-lg shadow-emerald-600/30 transition-all flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <CheckCircle className="w-4 h-4" />
            <span>
              {isYielding
                ? 'Принять без сопротивления'
                : hasRolled
                ? `Отправить ответ (d20: ${rollResult?.total})`
                : 'Сначала бросьте d20'}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};
