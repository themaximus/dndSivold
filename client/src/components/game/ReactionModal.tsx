import React, { useState, useEffect } from 'react';
import { Character, CharacterReactionRequest, DiceRollResult } from '../../types';
import { ThreeD20Die } from './ThreeD20Die';
import { soundFx } from '../../utils/audio';
import confetti from 'canvas-confetti';
import { MessageSquare, Shield, Swords, Handshake, Dices, X, CheckCircle, Sparkles } from 'lucide-react';

interface ReactionModalProps {
  isOpen: boolean;
  reactionRequest: CharacterReactionRequest | null;
  character: Character | null;
  targetDC?: number;
  onSubmit: (
    reactionRequestId: string,
    reactionText: string,
    reactionRoll: DiceRollResult,
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
  const [responseType, setResponseType] = useState<'positive' | 'negative' | 'counter'>('positive');
  const [reactionText, setReactionText] = useState('');
  const [isRolling, setIsRolling] = useState(false);
  const [hasRolled, setHasRolled] = useState(false);
  const [rollResult, setRollResult] = useState<DiceRollResult | null>(null);
  const [pendingDie, setPendingDie] = useState<number | null>(null);

  // Reset local state when a new request arrives
  useEffect(() => {
    if (reactionRequest) {
      setReactionText('');
      setIsRolling(false);
      setHasRolled(false);
      setRollResult(null);
      setPendingDie(null);
      setResponseType('positive');
    }
  }, [reactionRequest?.id]);

  if (!isOpen || !reactionRequest) return null;

  const handleRollDice = () => {
    if (isRolling || hasRolled) return;

    setIsRolling(true);
    soundFx.playDiceRoll();

    // Determine relevant stat modifier (e.g. dex for dodge/counter, cha for social help, str for resistance)
    let statKey: 'str' | 'dex' | 'con' | 'int' | 'wis' | 'cha' = 'dex';
    if (responseType === 'positive') statKey = 'cha';
    else if (responseType === 'negative') statKey = 'str';
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
        purpose: `Реакция на действие (${statKey.toUpperCase()})`,
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
    if (!reactionRequest || !rollResult) return;
    const text = reactionText.trim() || (
      responseType === 'positive'
        ? `Оказывает поддержку и содействие`
        : responseType === 'counter'
        ? `Уклоняется или парирует выпад`
        : `Оказывает активное сопротивление и противодействует`
    );

    onSubmit(reactionRequest.id, text, rollResult, responseType);
  };

  const handleSelectPreset = (type: 'positive' | 'negative' | 'counter', defaultSnippet: string) => {
    setResponseType(type);
    if (!reactionText.trim()) {
      setReactionText(defaultSnippet);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-fade-in">
      <div className="w-full max-w-xl bg-fantasy-card border-2 border-amber-500/60 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-5 py-3.5 bg-gradient-to-r from-amber-950/60 to-slate-900 border-b border-fantasy-border flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-amber-500/20 rounded-xl border border-amber-500/40 text-amber-400">
              <MessageSquare className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-rpg font-bold text-amber-300">
                Вас упомянули в действии!
              </h3>
              <p className="text-xs text-slate-400">
                {reactionRequest.initiatorCharacterName} обращается к вам или вовлекает в сцену
              </p>
            </div>
          </div>
          <button
            onClick={() => onSkip(reactionRequest.id)}
            className="text-slate-400 hover:text-slate-200 p-1.5 rounded-lg hover:bg-slate-800 transition-colors"
            title="Пропустить реакцию"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4 overflow-y-auto custom-scrollbar">
          {/* Initiator Action Quote */}
          <div className="bg-slate-950/70 border border-amber-500/30 rounded-xl p-3.5 relative">
            <span className="text-[10px] font-mono text-amber-400 font-bold uppercase tracking-wider block mb-1">
              Заявка соратника ({reactionRequest.initiatorCharacterName}):
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

          {/* Tone / Stance Selector */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-2">
              Выберите характер вашей реакции:
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => handleSelectPreset('positive', 'Соглашаюсь и помогаю завершить задуманное')}
                className={`p-2.5 rounded-xl border text-xs font-semibold flex flex-col items-center gap-1 transition-all ${
                  responseType === 'positive'
                    ? 'bg-emerald-950/60 border-emerald-500 text-emerald-300 shadow-glow-gold'
                    : 'bg-slate-900/60 border-slate-700 text-slate-400 hover:border-emerald-600/40'
                }`}
              >
                <Handshake className="w-4 h-4 text-emerald-400" />
                <span>🤝 Помощь</span>
              </button>

              <button
                type="button"
                onClick={() => handleSelectPreset('counter', 'Уклоняюсь или готовлю щит к защите')}
                className={`p-2.5 rounded-xl border text-xs font-semibold flex flex-col items-center gap-1 transition-all ${
                  responseType === 'counter'
                    ? 'bg-blue-950/60 border-blue-500 text-blue-300 shadow-glow-gold'
                    : 'bg-slate-900/60 border-slate-700 text-slate-400 hover:border-blue-600/40'
                }`}
              >
                <Shield className="w-4 h-4 text-blue-400" />
                <span>🛡️ Защита</span>
              </button>

              <button
                type="button"
                onClick={() => handleSelectPreset('negative', 'Оказываю активное сопротивление и перехватываю инициативу')}
                className={`p-2.5 rounded-xl border text-xs font-semibold flex flex-col items-center gap-1 transition-all ${
                  responseType === 'negative'
                    ? 'bg-red-950/60 border-red-500 text-red-300 shadow-glow-gold'
                    : 'bg-slate-900/60 border-slate-700 text-slate-400 hover:border-red-600/40'
                }`}
              >
                <Swords className="w-4 h-4 text-red-400" />
                <span>⚔️ Отпор</span>
              </button>
            </div>
          </div>

          {/* Player Response Textarea */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Что делает ваш персонаж ({character?.name || 'Вы'})?
            </label>
            <textarea
              value={reactionText}
              onChange={(e) => setReactionText(e.target.value)}
              placeholder="Опишите ваши слова, жест или ответное движение..."
              rows={2}
              className="w-full bg-slate-950/90 border border-slate-700 rounded-xl p-3 text-xs sm:text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-500/80 resize-none transition-colors"
            />
          </div>

          {/* Mandatory 3D d20 Roll Area */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 flex flex-col items-center justify-center relative overflow-hidden">
            <div className="flex items-center gap-2 mb-2 text-xs font-mono text-slate-400">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>Обязательный бросок кубика d20 для определения успеха реакции</span>
            </div>

            {/* 3D d20 Canvas */}
            <div className="relative my-1">
              <ThreeD20Die
                size={160}
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
                  <span className="text-xs text-slate-400">Результат:</span>
                  <span className={`text-base font-bold px-2 py-0.5 rounded-lg border ${
                    rollResult?.isCriticalSuccess
                      ? 'bg-amber-500/30 border-amber-400 text-amber-300'
                      : rollResult?.isCriticalFail
                      ? 'bg-red-500/30 border-red-500 text-red-400'
                      : (rollResult?.total ?? 0) >= targetDC
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
                  ✓ Бросок совершен! Теперь подтвердите отправку реакции.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 bg-slate-900/90 border-t border-fantasy-border flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => onSkip(reactionRequest.id)}
            className="px-4 py-2 text-xs text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-xl transition-colors"
          >
            Пропустить (ход без реакции)
          </button>

          <button
            type="button"
            disabled={!hasRolled || !rollResult}
            onClick={handleSubmit}
            className="px-6 py-2.5 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-slate-950 font-bold font-rpg text-xs sm:text-sm rounded-xl shadow-lg shadow-emerald-600/30 transition-all flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <CheckCircle className="w-4 h-4" />
            <span>
              {hasRolled
                ? `Отправить реакцию (d20: ${rollResult?.total})`
                : 'Сначала бросьте d20'}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};
