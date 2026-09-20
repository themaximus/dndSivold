import React, { useEffect } from 'react';
import { Character, CharacterTalentTree, TalentNode } from '../../types';
import { X, Award, Shield, Sparkles, BookOpen, CheckCircle, Lock, Zap } from 'lucide-react';

interface TalentTreeModalProps {
  isOpen: boolean;
  onClose: () => void;
  character: Character | null;
  tree: CharacterTalentTree | null;
  onFetchTalents: () => void;
  onLearnTalent: (talentId: string) => void;
}

export const TalentTreeModal: React.FC<TalentTreeModalProps> = ({
  isOpen,
  onClose,
  character,
  tree,
  onFetchTalents,
  onLearnTalent,
}) => {
  useEffect(() => {
    if (isOpen && character) {
      onFetchTalents();
    }
  }, [isOpen, character?.id]);

  if (!isOpen || !character) return null;

  const learnedTalents = character.learnedTalents || [];
  const skillPoints = character.skillPoints || 0;
  const currentXp = character.xp || 0;
  const nextLevelXp = (Math.floor(currentXp / 100) + 1) * 100;
  const xpProgress = currentXp % 100;

  const renderTalentCard = (node: TalentNode, branchTalents: TalentNode[], index: number) => {
    const isLearned = learnedTalents.includes(node.id);
    const prevTalent = index > 0 ? branchTalents[index - 1] : null;
    const isUnlocked = !prevTalent || learnedTalents.includes(prevTalent.id);
    const canLearn = isUnlocked && !isLearned && skillPoints >= node.cost;

    return (
      <div
        key={node.id}
        className={`p-3.5 rounded-xl border transition-all relative flex flex-col justify-between ${
          isLearned
            ? 'bg-emerald-950/25 border-emerald-500/50 shadow-sm'
            : isUnlocked
            ? 'bg-fantasy-panel/90 border-fantasy-border hover:border-amber-500/40'
            : 'bg-black/30 border-slate-800 opacity-60'
        }`}
      >
        <div>
          <div className="flex items-center justify-between gap-2 mb-1.5">
            <span className="font-bold text-xs text-slate-100 flex items-center gap-1.5">
              <span className="px-1.5 py-0.2 bg-slate-800 text-[10px] text-amber-400 font-mono rounded">
                T{node.tier}
              </span>
              {node.name}
            </span>
            {isLearned ? (
              <span className="text-emerald-400 text-[10px] font-bold flex items-center gap-1">
                <CheckCircle className="w-3 h-3" /> Изучено
              </span>
            ) : !isUnlocked ? (
              <span className="text-slate-500 text-[10px] flex items-center gap-1">
                <Lock className="w-3 h-3" /> Требуется T{node.tier - 1}
              </span>
            ) : (
              <span className="text-amber-400 text-[10px] font-mono">1 Очко</span>
            )}
          </div>

          <p className="text-[11px] text-slate-300 leading-relaxed">{node.description}</p>

          {node.effects && (
            <div className="mt-2 flex flex-wrap gap-1.5 text-[10px] font-mono">
              {node.effects.hpBonus && (
                <span className="px-1.5 py-0.5 bg-emerald-900/40 text-emerald-300 rounded border border-emerald-500/30">
                  +{node.effects.hpBonus} HP
                </span>
              )}
              {node.effects.acBonus && (
                <span className="px-1.5 py-0.5 bg-blue-900/40 text-blue-300 rounded border border-blue-500/30">
                  +{node.effects.acBonus} КБ
                </span>
              )}
              {node.effects.statBonus && (
                <span className="px-1.5 py-0.5 bg-purple-900/40 text-purple-300 rounded border border-purple-500/30">
                  +{node.effects.statBonus.amount} {node.effects.statBonus.stat.toUpperCase()}
                </span>
              )}
              {node.effects.newAbility && (
                <span className="px-1.5 py-0.5 bg-amber-900/40 text-amber-300 rounded border border-amber-500/30">
                  Навык: {node.effects.newAbility.name}
                </span>
              )}
            </div>
          )}
        </div>

        {!isLearned && (
          <div className="mt-3 pt-2 border-t border-slate-800/80 flex justify-end">
            <button
              type="button"
              disabled={!canLearn}
              onClick={() => onLearnTalent(node.id)}
              className="px-3 py-1 bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-slate-950 font-bold text-[11px] font-rpg rounded-lg shadow-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1"
            >
              <Zap className="w-3 h-3" />
              Изучить
            </button>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-4xl bg-fantasy-card border border-fantasy-border rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-fantasy-border flex items-center justify-between bg-fantasy-panel">
          <div className="flex items-center gap-3">
            <Award className="w-6 h-6 text-amber-400" />
            <div>
              <h2 className="text-base font-rpg font-bold text-amber-300">Древо прокачки и талантов</h2>
              <p className="text-xs text-slate-400">
                Персональный путь развития героя на основе класса, расы и биографии (квенты)
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-100 hover:bg-slate-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* XP & Points Bar */}
        <div className="px-6 py-3 bg-slate-900/80 border-b border-slate-800 flex flex-wrap items-center justify-between gap-4 text-xs">
          <div className="flex items-center gap-4">
            <div>
              <span className="text-slate-400">Опыт героя: </span>
              <strong className="text-amber-400 font-mono">{currentXp} XP</strong>
            </div>
            <div className="w-32 bg-slate-800 rounded-full h-2 overflow-hidden border border-slate-700">
              <div
                className="bg-amber-400 h-full rounded-full transition-all"
                style={{ width: `${xpProgress}%` }}
              />
            </div>
            <span className="text-[11px] text-slate-400">
              (До нового очка: {100 - xpProgress} XP)
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-slate-300 font-medium">Доступно очков талантов:</span>
            <span className="px-2.5 py-0.5 bg-amber-500/20 border border-amber-500/40 text-amber-300 font-mono font-bold text-sm rounded-lg shadow-glow-gold">
              {skillPoints}
            </span>
          </div>
        </div>

        {/* Content - 3 Branches */}
        <div className="p-6 overflow-y-auto flex-1">
          {!tree ? (
            <div className="text-center py-12 text-slate-400 text-sm">
              Генерация персонального древа талантов...
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {/* 1. Class Branch */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 pb-2 border-b border-fantasy-border">
                  <Shield className="w-4 h-4 text-amber-400" />
                  <h3 className="font-rpg font-bold text-xs text-amber-300 uppercase tracking-wide">
                    {tree.classBranch.name}
                  </h3>
                </div>
                <div className="space-y-3">
                  {tree.classBranch.talents.map((node, i) =>
                    renderTalentCard(node, tree.classBranch.talents, i)
                  )}
                </div>
              </div>

              {/* 2. Race Branch */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 pb-2 border-b border-fantasy-border">
                  <Sparkles className="w-4 h-4 text-blue-400" />
                  <h3 className="font-rpg font-bold text-xs text-blue-300 uppercase tracking-wide">
                    {tree.raceBranch.name}
                  </h3>
                </div>
                <div className="space-y-3">
                  {tree.raceBranch.talents.map((node, i) =>
                    renderTalentCard(node, tree.raceBranch.talents, i)
                  )}
                </div>
              </div>

              {/* 3. Quenta Branch */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 pb-2 border-b border-fantasy-border">
                  <BookOpen className="w-4 h-4 text-purple-400" />
                  <h3 className="font-rpg font-bold text-xs text-purple-300 uppercase tracking-wide">
                    {tree.quentaBranch.name}
                  </h3>
                </div>
                <div className="space-y-3">
                  {tree.quentaBranch.talents.map((node, i) =>
                    renderTalentCard(node, tree.quentaBranch.talents, i)
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-fantasy-border bg-fantasy-panel flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition-colors"
          >
            Закрыть
          </button>
        </div>
      </div>
    </div>
  );
};
