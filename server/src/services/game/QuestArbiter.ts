import { QuestEntity, RoomEntity, TurnActionEntity, GameLogEntity, LoreMilestone } from '../../db';
import { AIDMResponse } from '../../domain/types';
import { IQuestRepository, questRepository } from '../../repositories/QuestRepository';

export interface QuestArbiterSyncResult {
  activeQuests: QuestEntity[];
  completedQuests: QuestEntity[];
  allQuests: QuestEntity[];
  sanitizedDilemma?: string;
  sanitizedSituation?: string;
}

export class QuestArbiter {
  private quests: IQuestRepository;

  constructor(quests: IQuestRepository = questRepository) {
    this.quests = quests;
  }

  /**
   * Synchronizes room quests from the repository without fabricating artificial quests.
   * Completely procedural and non-intrusive.
   */
  public reconcileRoomQuests(
    room: RoomEntity,
    _allLogs: GameLogEntity[] = [],
    _milestones: LoreMilestone[] = []
  ): { activeQuests: QuestEntity[]; completedQuests: QuestEntity[] } {
    const existing = this.quests.findByRoomId(room.id);
    return {
      activeQuests: existing.filter(q => q.status === 'active'),
      completedQuests: existing.filter(q => q.status === 'completed'),
    };
  }

  /**
   * Processes round actions and AI DM response to update quest progression dynamically
   * via structured questUpdates (add, complete, fail).
   */
  public processRoundQuests(
    room: RoomEntity,
    _currentRoundActions: TurnActionEntity[],
    dmResult: AIDMResponse
  ): QuestArbiterSyncResult {
    // 1. Process explicit questUpdates returned by the AI DM
    if (Array.isArray(dmResult.questUpdates) && dmResult.questUpdates.length > 0) {
      for (const update of dmResult.questUpdates) {
        if (!update || !update.title || !update.title.trim()) continue;
        const titleTrimmed = update.title.trim();

        if (update.action === 'add') {
          const existing = this.quests.findByRoomId(room.id);
          const alreadyExists = existing.some(
            q => q.title.toLowerCase().trim() === titleTrimmed.toLowerCase()
          );
          if (!alreadyExists) {
            this.quests.createOrGetQuest(
              room.id,
              titleTrimmed,
              (update.description || titleTrimmed).trim(),
              update.category || 'task',
              room.roundNumber
            );
          }
        } else if (update.action === 'complete') {
          const active = this.quests.getActiveQuests(room.id);
          const match = this.findMatchingQuest(active, titleTrimmed);
          if (match) {
            this.quests.completeQuest(
              room.id,
              match.id,
              room.roundNumber,
              update.resolutionNote || `Задача «${match.title}» успешно решена в раунде ${room.roundNumber}.`
            );
          }
        } else if (update.action === 'fail') {
          const active = this.quests.getActiveQuests(room.id);
          const match = this.findMatchingQuest(active, titleTrimmed);
          if (match) {
            this.quests.failQuest(
              room.id,
              match.id,
              room.roundNumber,
              update.resolutionNote || `Задача «${match.title}» провалена в раунде ${room.roundNumber}.`
            );
          }
        }
      }
    }

    // 2. Fallback check: If AI narrative explicitly states that an existing active quest is accomplished
    const activeQuests = this.quests.getActiveQuests(room.id);
    const narrativeCombined = `${dmResult.narrative || ''} ${dmResult.currentSituation || ''}`.toLowerCase();
    for (const q of activeQuests) {
      const qTitle = q.title.toLowerCase().trim();
      if (
        narrativeCombined.includes(qTitle) &&
        /(?:успешно\s+(?:выполнен|завершен|решен)|задача\s+(?:выполнена|решена)|цель\s+достигнута)/i.test(narrativeCombined)
      ) {
        this.quests.completeQuest(
          room.id,
          q.id,
          room.roundNumber,
          `Задача «${q.title}» успешно решена в раунде ${room.roundNumber}.`
        );
      }
    }

    const all = this.quests.findByRoomId(room.id);
    return {
      activeQuests: all.filter(q => q.status === 'active'),
      completedQuests: all.filter(q => q.status === 'completed'),
      allQuests: all,
      sanitizedDilemma: dmResult.choiceDilemma,
      sanitizedSituation: dmResult.currentSituation,
    };
  }

  private findMatchingQuest(quests: QuestEntity[], query: string): QuestEntity | undefined {
    const qLower = query.toLowerCase().trim();
    return quests.find(q => {
      const tLower = q.title.toLowerCase().trim();
      return (
        q.id === query ||
        tLower === qLower ||
        tLower.includes(qLower) ||
        qLower.includes(tLower)
      );
    });
  }
}

export const questArbiter = new QuestArbiter();
