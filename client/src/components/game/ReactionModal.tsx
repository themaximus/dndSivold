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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-xl bg-[#13161d] border border-[#3d4554] rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-5 py-3.5 bg-[#0e1117] border-b border-[#2a303d] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-[#201c15] rounded border border-[#524126] text-[#c5a059]">
              <MessageSquare className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-rpg font-bold text-[#ffd98a] tracking-wide">
                Вас упомянули в действии!
              </h3>
              <p className="text-xs text-[#8e8574] font-serif">
                {reactionRequest.initiatorCharacterName} обращается к вам или вовлекает в сцену
              </p>
            </div>
          </div>
          <button
            onClick={() => onSkip(reactionRequest.id)}
            className="text-[#8e8574] hover:text-[#ded7c8] p-1.5 rounded hover:bg-[#1f2533] transition-colors"
            title="Пропустить реакцию"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4 overflow-y-auto custom-scrollbar">
          {/* Initiator Action Quote */}
          <div className="bg-[#0b0e13] border border-[#3b3121] rounded-lg p-3.5 relative">
            <span className="text-[10px] font-rpg text-[#c5a059] font-bold uppercase tracking-wider block mb-1">
              Заявка соратника ({reactionRequest.initiatorCharacterName}):
            </span>
            <p className="text-xs sm:text-sm text-[#ded7c8] italic font-serif leading-relaxed">
              «{reactionRequest.initiatorActionText}»
            </p>
            {reactionRequest.initiatorRoll && (
              <div className="mt-2 text-[11px] font-mono text-[#8e8574] flex items-center gap-1.5">
                <Dices className="w-3.5 h-3.5 text-[#c5a059]" />
                <span>Бросок инициатора: {reactionRequest.initiatorRoll.total}</span>
              </div>
            )}
          </div>

          {/* Tone / Stance Selector */}
          <div>
            <label className="block text-xs font-serif font-semibold text-[#ded7c8] mb-2">
              Выберите характер вашей реакции:
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => handleSelectPreset('positive', 'Соглашаюсь и помогаю завершить задуманное')}
                className={`p-2.5 rounded border text-xs font-serif flex flex-col items-center gap-1 transition-all ${
                  responseType === 'positive'
                    ? 'bg-[#122219] border-[#2d5a3f] text-[#a7f3d0] font-semibold'
                    : 'bg-[#181c25] border-[#2a303d] text-[#8e8574] hover:border-[#c5a059]/40'
                }`}
              >
                <Handshake className="w-4 h-4 text-[#34d399]" />
                <span>🤝 Помощь</span>
              </button>

              <button
                type="button"
                onClick={() => handleSelectPreset('counter', 'Уклоняюсь или готовлю щит к защите')}
                className={`p-2.5 rounded border text-xs font-serif flex flex-col items-center gap-1 transition-all ${
                  responseType === 'counter'
                    ? 'bg-[#131c2d] border-[#2c4e7a] text-[#93c5fd] font-semibold'
                    : 'bg-[#181c25] border-[#2a303d] text-[#8e8574] hover:border-[#c5a059]/40'
                }`}
              >
                <Shield className="w-4 h-4 text-[#60a5fa]" />
                <span>🛡️ Защита</span>
              </button>

              <button
                type="button"
                onClick={() => handleSelectPreset('negative', 'Оказываю активное сопротивление и перехватываю инициативу')}
                className={`p-2.5 rounded border text-xs font-serif flex flex-col items-center gap-1 transition-all ${
                  responseType === 'negative'
                    ? 'bg-[#271517] border-[#6d2d31] text-[#fca5a5] font-semibold'
                    : 'bg-[#181c25] border-[#2a303d] text-[#8e8574] hover:border-[#c5a059]/40'
                }`}
              >
                <Swords className="w-4 h-4 text-[#f87171]" />
                <span>⚔️ Отпор</span>
              </button>
            </div>
          </div>

          {/* Player Response Textarea */}
          <div>
            <label className="block text-xs font-serif font-semibold text-[#ded7c8] mb-1.5">
              Что делает ваш персонаж ({character?.name || 'Вы'})?
            </label>
            <textarea
              value={reactionText}
              onChange={(e) => setReactionText(e.target.value)}
              placeholder="Опишите ваши слова, жест или ответное движение..."
              rows={2}
              className="w-full bg-[#0b0e14] border border-[#2a303d] rounded-lg p-3 text-xs sm:text-sm text-[#ded7c8] placeholder-[#665e52] focus:outline-none focus:border-[#c5a059] font-serif resize-none transition-colors"
            />
          </div>

          {/* Mandatory 3D d20 Roll Area */}
          <div className="bg-[#0e1117] border border-[#2a303d] rounded-lg p-4 flex flex-col items-center justify-center relative overflow-hidden">
            <div className="flex items-center gap-2 mb-2 text-xs font-serif text-[#8e8574]">
              <Sparkles className="w-3.5 h-3.5 text-[#c5a059]" />
              <span>Обязательный бросок кубика судьбы d20 для определения исхода</span>
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
                className="mt-2 px-6 py-2 bg-[#252016] hover:bg-[#382f1e] border border-[#c5a059] text-[#ffd98a] font-serif font-bold text-xs sm:text-sm rounded transition-all flex items-center gap-2 disabled:opacity-50"
              >
                <Dices className="w-4 h-4 text-[#c5a059]" />
                {isRolling ? 'Кубик вращается...' : 'Бросить кубик d20 на реакцию'}
              </button>
            ) : (
              <div className="mt-2 text-center">
                <div className="flex items-center justify-center gap-2 font-mono">
                  <span className="text-xs text-[#8e8574]">Результат:</span>
                  <span className={`text-base font-bold px-2 py-0.5 rounded border ${
                    rollResult?.isCriticalSuccess
                      ? 'bg-[#312513] border-[#c5a059] text-[#ffd98a]'
                      : rollResult?.isCriticalFail
                      ? 'bg-[#331515] border-[#7f2626] text-[#fca5a5]'
                      : (rollResult?.total ?? 0) >= targetDC
                      ? 'bg-[#14291c] border-[#2e6b43] text-[#a7f3d0]'
                      : 'bg-[#181c25] border-[#2a303d] text-[#ded7c8]'
                  }`}>
                    {rollResult?.total}
                  </span>
                  <span className="text-xs text-[#8e8574]">
                    ({rollResult?.breakdown})
                  </span>
                </div>
                <p className="text-[11px] text-[#6ee7b7] font-serif font-semibold mt-1">
                  ✓ Бросок совершен! Теперь подтвердите отправку реакции.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 bg-[#0e1117] border-t border-[#2a303d] flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => onSkip(reactionRequest.id)}
            className="px-3.5 py-1.5 text-xs text-[#8e8574] hover:text-[#ded7c8] hover:bg-[#1a202c] rounded transition-colors font-serif"
          >
            Пропустить (ход без реакции)
          </button>

          <button
            type="button"
            disabled={!hasRolled || !rollResult}
            onClick={handleSubmit}
            className="px-5 py-2 bg-[#172e21] hover:bg-[#20422f] border border-[#2e6b43] text-[#a7f3d0] font-serif font-bold text-xs sm:text-sm rounded transition-all flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
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
