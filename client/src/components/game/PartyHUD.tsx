import React, { useState } from 'react';
import { RoomPlayer, Character } from '../../types';
import { Shield, Users, ListOrdered } from 'lucide-react';
import { PartyMemberCard } from './PartyMemberCard';
import { PartyMemberModal } from './PartyMemberModal';

interface PartyHUDProps {
  players: RoomPlayer[];
  currentUserId?: string;
  activePlayerUserId?: string;
  turnMode?: 'simultaneous' | 'turn_by_turn';
}

export const PartyHUD: React.FC<PartyHUDProps> = ({
  players,
  currentUserId,
  activePlayerUserId,
  turnMode = 'simultaneous',
}) => {
  const [inspectedCharacter, setInspectedCharacter] = useState<Character | null>(null);

  const activeCount = players.filter(p => p.characterId).length;

  return (
    <>
      <div className="bg-fantasy-panel border border-fantasy-border rounded-2xl p-4 shadow-xl flex flex-col h-full overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between mb-3 border-b border-fantasy-border pb-2.5">
          <h3 className="text-sm font-bold font-rpg text-amber-400 flex items-center gap-2">
            <Shield className="w-4 h-4 text-amber-500" />
            Отряд героев ({activeCount})
          </h3>
          <div className="flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-900 border border-slate-700 text-slate-300">
            {turnMode === 'turn_by_turn' ? (
              <span className="flex items-center gap-1 text-amber-400" title="Пошаговый режим: игроки ходят строго по очереди">
                <ListOrdered className="w-3 h-3" /> По очереди
              </span>
            ) : (
              <span className="flex items-center gap-1 text-slate-400" title="Общий режим: одновременные заявки">
                <Users className="w-3 h-3" /> Общий ход
              </span>
            )}
          </div>
        </div>

        {/* Member Cards */}
        <div className="space-y-3 overflow-y-auto flex-1 pr-1 custom-scrollbar">
          {players.map(p => {
            const isActiveTurn = turnMode === 'turn_by_turn' && activePlayerUserId === p.userId;
            return (
              <PartyMemberCard
                key={p.id || p.userId}
                player={p}
                isCurrentUser={p.userId === currentUserId}
                isActiveTurn={isActiveTurn}
                onInspect={() => p.character && setInspectedCharacter(p.character)}
              />
            );
          })}
        </div>
      </div>

      {/* Inspect Modal */}
      <PartyMemberModal
        isOpen={!!inspectedCharacter}
        onClose={() => setInspectedCharacter(null)}
        character={inspectedCharacter}
      />
    </>
  );
};
