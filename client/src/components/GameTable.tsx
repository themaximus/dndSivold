import React, { useState, useEffect } from 'react';
import { DiceRollResult } from '../types';
import { useAuth } from '../context/AuthContext';
import { useGameSession } from '../hooks/useGameSession';
import { useNarrativeVoice } from '../hooks/useNarrativeVoice';
import { GameTableHeader } from './game/GameTableHeader';
import { PartyHUD } from './game/PartyHUD';
import { StoryChronicle } from './game/StoryChronicle';
import { ActionConsole } from './game/ActionConsole';
import { LootDropsBar } from './game/LootDropsBar';
import { InventoryModal } from './game/InventoryModal';
import { TalentTreeModal } from './game/TalentTreeModal';
import { CampaignJournalModal } from './game/CampaignJournalModal';
import { DiceRollerModal } from './DiceRollerModal';

interface GameTableProps {
  roomCode: string;
  onLeave: () => void;
}

export const GameTable: React.FC<GameTableProps> = ({ roomCode, onLeave }) => {
  const { user } = useAuth();
  const [attachedRolls, setAttachedRolls] = useState<DiceRollResult[]>([]);
  const [isDiceModalOpen, setIsDiceModalOpen] = useState(false);
  const [isInventoryOpen, setIsInventoryOpen] = useState(false);
  const [isTalentsOpen, setIsTalentsOpen] = useState(false);
  const [isJournalOpen, setIsJournalOpen] = useState(false);

  // Custom Domain Hooks
  const {
    room,
    players,
    logs,
    myPlayer,
    myCharacter,
    activePlayers,
    readyCount,
    hasSubmittedThisRound,
    isDMThinking,
    talentTree,
    lastDeathSaveMessage,
    submitAction,
    forceResolveRound,
    pickupLoot,
    useItem,
    equipWeapon,
    rollDeathSave,
    fetchTalents,
    learnTalent,
  } = useGameSession(roomCode);

  const { loadingLogId, isSpeakingText, toggleVoice } = useNarrativeVoice();

  if (!room) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-400">
        Загрузка игрового стола...
      </div>
    );
  }

  useEffect(() => {
    setAttachedRolls([]);
  }, [room.roundNumber]);

  const handleAttachRoll = (roll: DiceRollResult) => {
    // Strictly 1 dice roll per turn
    setAttachedRolls([roll]);
  };

  const handleRemoveRoll = () => {
    // Rolls cannot be discarded mid-turn
  };

  const handleSubmitAction = (actionText: string) => {
    submitAction(actionText, attachedRolls);
    setAttachedRolls([]);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-5rem)] max-w-7xl mx-auto px-2 sm:px-4">
      {/* Table Header with Quick Access to Inventory, Talents, Lore Journal */}
      <GameTableHeader
        room={room}
        readyCount={readyCount}
        totalActivePlayers={activePlayers.length}
        inventoryCount={myCharacter?.inventory?.length || 0}
        skillPoints={myCharacter?.skillPoints || 0}
        milestonesCount={room.loreJournal?.length || 0}
        isHost={room.hostUserId === user?.id}
        isDMThinking={isDMThinking}
        onForceResolve={forceResolveRound}
        onOpenInventory={() => setIsInventoryOpen(true)}
        onOpenTalents={() => setIsTalentsOpen(true)}
        onOpenJournal={() => setIsJournalOpen(true)}
        onLeave={onLeave}
      />

      {/* Main Grid: Party HUD (Left) + Chronicle & Action Console (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 flex-1 min-h-0">
        {/* Party HUD Column */}
        <PartyHUD players={players} currentUserId={user?.id} />

        {/* DM Chronicle + Action Console Column */}
        <div className="lg:col-span-3 flex flex-col min-h-0 bg-fantasy-panel border border-fantasy-border rounded-2xl shadow-xl overflow-hidden">
          {/* Battlefield Loot Drops if any items dropped */}
          <LootDropsBar
            loot={room.availableLoot || []}
            onPickup={pickupLoot}
            disabled={!myPlayer?.characterId || myCharacter?.lifeState === 'dead'}
          />

          <StoryChronicle
            logs={logs}
            loadingLogId={loadingLogId}
            isSpeakingText={isSpeakingText}
            onToggleVoice={toggleVoice}
          />

          <ActionConsole
            hasCharacter={!!myPlayer?.characterId}
            hasSubmittedThisRound={hasSubmittedThisRound}
            isDMThinking={isDMThinking}
            currentSituation={room.currentSituation}
            targetDC={room.targetDC || 12}
            dcReason={room.dcReason}
            character={myCharacter}
            attachedRolls={attachedRolls}
            lastDeathSaveMessage={lastDeathSaveMessage}
            onRemoveRoll={handleRemoveRoll}
            onOpenDiceModal={() => setIsDiceModalOpen(true)}
            onSubmit={handleSubmitAction}
            onRollDeathSave={rollDeathSave}
          />
        </div>
      </div>

      {/* Dice Roller Modal */}
      {isDiceModalOpen && (
        <DiceRollerModal
          roomCode={roomCode}
          character={myCharacter || undefined}
          onClose={() => setIsDiceModalOpen(false)}
          onRollComplete={handleAttachRoll}
        />
      )}

      {/* Inventory Modal */}
      <InventoryModal
        isOpen={isInventoryOpen}
        onClose={() => setIsInventoryOpen(false)}
        character={myCharacter}
        onUseItem={useItem}
        onEquipWeapon={equipWeapon}
      />

      {/* Talent Progression Tree Modal */}
      <TalentTreeModal
        isOpen={isTalentsOpen}
        onClose={() => setIsTalentsOpen(false)}
        character={myCharacter}
        tree={talentTree}
        onFetchTalents={fetchTalents}
        onLearnTalent={learnTalent}
      />

      {/* Campaign Lore Milestones Journal Modal */}
      <CampaignJournalModal
        isOpen={isJournalOpen}
        onClose={() => setIsJournalOpen(false)}
        milestones={room.loreJournal || []}
        campaignTitle={room.title}
      />
    </div>
  );
};
