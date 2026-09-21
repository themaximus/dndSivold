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
import { DndGuideModal } from './game/DndGuideModal';
import { AdventureFinishModal } from './game/AdventureFinishModal';
import { RestModal } from './game/RestModal';
import { DiceRollerModal } from './DiceRollerModal';
import { OpponentsHUD } from './game/OpponentsHUD';
import { InventoryToastStack } from './game/InventoryToastStack';
import { ReactionModal } from './game/ReactionModal';

interface GameTableProps {
  roomCode: string;
  onLeave: () => void;
}

export const GameTable: React.FC<GameTableProps> = ({ roomCode, onLeave }) => {
  const { user } = useAuth();
  const [attachedRolls, setAttachedRolls] = useState<DiceRollResult[]>([]);
  const [isDiceModalOpen, setIsDiceModalOpen] = useState(false);
  const [diceModalOpts, setDiceModalOpts] = useState<{
    defaultPurpose?: string;
    defaultAdvantage?: boolean;
    defaultDisadvantage?: boolean;
    defaultStatKey?: string;
  }>({});
  const [isInventoryOpen, setIsInventoryOpen] = useState(false);
  const [isTalentsOpen, setIsTalentsOpen] = useState(false);
  const [isJournalOpen, setIsJournalOpen] = useState(false);
  const [isGuideOpen, setIsGuideOpen] = useState(false);
  const [isFinishModalOpen, setIsFinishModalOpen] = useState(false);
  const [isRestOpen, setIsRestOpen] = useState(false);

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
    rejectedAction,
    recentActivities,
    inventoryNotifications,
    dismissInventoryNotification,
    roomRollBroadcasts,
    dismissRoomRoll,
    finishedAdventure,
    finishAdventure,
    submitAction,
    forceResolveRound,
    setTurnMode,
    pickupLoot,
    useItem,
    equipWeapon,
    rollDeathSave,
    fetchTalents,
    learnTalent,
    shortRest,
    longRest,
    submitReaction,
    skipReaction,
  } = useGameSession(roomCode);

  const { loadingLogId, isSpeakingText, toggleVoice } = useNarrativeVoice(roomCode);

  useEffect(() => {
    setAttachedRolls([]);
  }, [room?.roundNumber]);

  useEffect(() => {
    if (myPlayer?.pendingRoll && attachedRolls.length === 0) {
      setAttachedRolls([myPlayer.pendingRoll]);
    }
  }, [myPlayer?.pendingRoll]);

  if (!room) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-400">
        Загрузка игрового стола...
      </div>
    );
  }

  const isTurnByTurn = room.turnMode === 'turn_by_turn';
  const isMyTurn = !isTurnByTurn || !room.activePlayerUserId || room.activePlayerUserId === user?.id;
  const activePlayer = players.find(p => p.userId === room.activePlayerUserId);
  const activePlayerName = activePlayer?.character?.name || activePlayer?.username || 'Игрок';

  const pendingReactionForMe = room.pendingReactions?.find(
    r => r.status === 'pending' && (r.targetUserId === user?.id || (myCharacter && r.targetCharacterId === myCharacter.id))
  );

  const pendingWaitingNames = room.pendingReactions
    ?.filter(r => r.status === 'pending')
    ?.map(r => r.targetCharacterName) || [];

  const handleAttachRoll = (roll: DiceRollResult) => {
    // Strictly 1 dice roll per turn
    setAttachedRolls([roll]);
  };

  const handleRemoveRoll = () => {
    // Rolls cannot be discarded mid-turn
  };

  const handleOpenDiceModal = (opts?: { defaultPurpose?: string; defaultAdvantage?: boolean; defaultDisadvantage?: boolean; defaultStatKey?: string }) => {
    setDiceModalOpts(opts || {});
    setIsDiceModalOpen(true);
  };

  const handleSubmitAction = (actionText: string, meta?: any) => {
    submitAction(actionText, attachedRolls, meta);
    setAttachedRolls([]);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-5rem)] max-w-7xl mx-auto px-2 sm:px-4">
      {/* Table Header with Quick Access to Inventory, Talents, Lore Journal */}
      <GameTableHeader
        room={room}
        readyCount={readyCount}
        totalActivePlayers={activePlayers.length}
        characterLevel={myCharacter?.level}
        inventoryCount={myCharacter?.inventory?.length || 0}
        skillPoints={myCharacter?.skillPoints || 0}
        milestonesCount={room.loreJournal?.length || 0}
        isHost={room.hostUserId === user?.id}
        isDMThinking={isDMThinking}
        onForceResolve={forceResolveRound}
        onToggleTurnMode={setTurnMode}
        onOpenInventory={() => setIsInventoryOpen(true)}
        onOpenTalents={() => setIsTalentsOpen(true)}
        onOpenJournal={() => setIsJournalOpen(true)}
        onOpenGuide={() => setIsGuideOpen(true)}
        onOpenFinishModal={() => setIsFinishModalOpen(true)}
        onOpenRest={() => setIsRestOpen(true)}
        onLeave={onLeave}
      />

      {/* Main Grid: Party HUD (Left) + Chronicle & Action Console (Center) + Opponents HUD (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 flex-1 min-h-0">
        {/* Party HUD Column */}
        <div className="lg:col-span-3 flex flex-col min-h-0">
          <PartyHUD
            players={players}
            currentUserId={user?.id}
            activePlayerUserId={room.activePlayerUserId}
            turnMode={room.turnMode}
          />
        </div>

        {/* DM Chronicle + Action Console Column */}
        <div className="lg:col-span-6 flex flex-col min-h-0 bg-[#13161d] border border-[#2a303d] rounded-xl shadow-2xl overflow-hidden">
          {/* Battlefield Loot Drops if any items dropped */}
          <LootDropsBar
            loot={room.availableLoot || []}
            onPickup={pickupLoot}
            disabled={!myPlayer?.characterId || myCharacter?.lifeState === 'dead'}
          />

          <StoryChronicle
            logs={logs}
            loadingLogId={loadingLogId}
            recentActivities={recentActivities}
            isSpeakingText={isSpeakingText}
            onToggleVoice={toggleVoice}
            activeRoomRolls={roomRollBroadcasts.filter(b => b.playerId !== user?.id)}
            targetDC={room.targetDC}
            onDismissRoomRoll={dismissRoomRoll}
          />

          <ActionConsole
            hasCharacter={!!myPlayer?.characterId}
            hasSubmittedThisRound={hasSubmittedThisRound}
            isDMThinking={isDMThinking}
            currentSituation={room.currentSituation}
            targetDC={room.targetDC || 12}
            dcReason={room.dcReason}
            requiredCheckStat={room.requiredCheckStat}
            isMyTurn={isMyTurn}
            activePlayerName={activePlayerName}
            turnMode={room.turnMode}
            character={myCharacter}
            attachedRolls={attachedRolls}
            lastDeathSaveMessage={lastDeathSaveMessage}
            activeEnemies={room.activeEnemies || []}
            rejectedAction={rejectedAction}
            pendingReactionNames={pendingWaitingNames}
            onRemoveRoll={handleRemoveRoll}
            onOpenDiceModal={handleOpenDiceModal}
            onSubmit={handleSubmitAction}
            onRollDeathSave={rollDeathSave}
          />
        </div>

        {/* Opponents & Threats Column */}
        <div className="lg:col-span-3 flex flex-col min-h-0">
          <OpponentsHUD
            enemies={room.activeEnemies || []}
          />
        </div>
      </div>

      {/* Dice Roller Modal for the active roller */}
      {isDiceModalOpen && (
        <DiceRollerModal
          roomCode={roomCode}
          character={myCharacter || undefined}
          defaultStatKey={diceModalOpts.defaultStatKey || room.requiredCheckStat}
          targetDC={room.targetDC}
          initialPurpose={diceModalOpts.defaultPurpose}
          initialAdvantage={diceModalOpts.defaultAdvantage}
          initialDisadvantage={diceModalOpts.defaultDisadvantage}
          onClose={() => setIsDiceModalOpen(false)}
          onRollComplete={handleAttachRoll}
        />
      )}

      {/* Rest Modal (Short & Long Rest D&D 5e) */}
      <RestModal
        isOpen={isRestOpen}
        character={myCharacter}
        isCombat={(room.activeEnemies || []).some(e => !e.isDead && e.hpCurrent > 0)}
        currentRound={room.roundNumber}
        onClose={() => setIsRestOpen(false)}
        onShortRest={shortRest}
        onLongRest={longRest}
      />

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

      {/* Authentic D&D 5e Guide Modal */}
      <DndGuideModal
        isOpen={isGuideOpen}
        onClose={() => setIsGuideOpen(false)}
      />

      {/* Adventure Finale / Session Cliffhanger Modal */}
      <AdventureFinishModal
        isOpen={isFinishModalOpen || !!finishedAdventure || room.status === 'finished'}
        onClose={() => setIsFinishModalOpen(false)}
        room={room}
        isHost={room.hostUserId === user?.id}
        onFinishAdventure={finishAdventure}
        onReturnToLobby={onLeave}
      />

      {/* Reaction Prompt Modal for Mentioned Characters */}
      <ReactionModal
        isOpen={!!pendingReactionForMe}
        reactionRequest={pendingReactionForMe || null}
        character={myCharacter}
        targetDC={room.targetDC || 12}
        onSubmit={submitReaction}
        onSkip={skipReaction}
      />

      {/* Floating Inventory Activity Toasts */}
      <InventoryToastStack
        notifications={inventoryNotifications}
        onDismiss={dismissInventoryNotification}
      />
    </div>
  );
};
