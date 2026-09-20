import React from 'react';
import { RoomPlayer } from '../../types';
import { Shield } from 'lucide-react';
import { PartyMemberCard } from './PartyMemberCard';

interface PartyHUDProps {
  players: RoomPlayer[];
  currentUserId?: string;
}

export const PartyHUD: React.FC<PartyHUDProps> = ({ players, currentUserId }) => {
  return (
    <div className="bg-fantasy-panel border border-fantasy-border rounded-2xl p-4 shadow-xl flex flex-col h-full overflow-hidden">
      <div className="flex items-center justify-between mb-3 border-b border-fantasy-border pb-2.5">
        <h3 className="text-sm font-bold font-rpg text-amber-400 flex items-center gap-2">
          <Shield className="w-4 h-4 text-amber-500" />
          Отряд героев ({players.filter(p => p.characterId).length})
        </h3>
      </div>

      <div className="space-y-3 overflow-y-auto flex-1 pr-1">
        {players.map(p => {
          if (!p.character) return null;
          return (
            <PartyMemberCard
              key={p.id}
              player={p}
              isCurrentUser={p.userId === currentUserId}
            />
          );
        })}
      </div>
    </div>
  );
};
