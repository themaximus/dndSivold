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
      <div className="bg-[#13161d] border border-[#2a303d] rounded-xl p-3 sm:p-3.5 shadow-md flex flex-col h-full overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between mb-2.5 border-b border-[#242935] pb-2">
          <h3 className="text-sm font-bold font-rpg text-[#e2c26a] flex items-center gap-2 tracking-wide">
            <Shield className="w-4 h-4 text-[#c5a059]" />
            Отряд героев ({activeCount})
          </h3>
          <div className="flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded bg-[#0c0d11] border border-[#2e3544] text-[#968e7f]">
            {turnMode === 'turn_by_turn' ? (
              <span className="flex items-center gap-1 text-[#d8b4fe]" title="Пошаговый режим: игроки ходят строго по очереди">
                <ListOrdered className="w-3 h-3 text-[#c084fc]" /> По очереди
              </span>
            ) : (
              <span className="flex items-center gap-1 text-[#c5a059]" title="Общий режим: одновременные заявки">
                <Users className="w-3 h-3 text-[#c5a059]" /> Общий ход
              </span>
            )}
          </div>
        </div>

        {/* Member Cards */}
        <div className="space-y-3 overflow-y-auto flex-1 pr-1 custom-scrollbar">
          {players.map(p => {
            if (!p.character) return null;
            const isActiveTurn = turnMode === 'turn_by_turn' && activePlayerUserId === p.userId;
            return (
              <PartyMemberCard
                key={p.id}
                player={p}
                isCurrentUser={p.userId === currentUserId}
                isActiveTurn={isActiveTurn}
                onInspect={() => setInspectedCharacter(p.character || null)}
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
