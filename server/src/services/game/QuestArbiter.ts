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
    const isSuccessReported = /(?:успешно\s+(?:выполнен|завершен|решен|починен|исцелен|спасен)|задача\s+(?:выполнена|решена)|цель\s+достигнута|враги\s+(?:повержены|рассеяны)|нападение\s+отражено)/i.test(narrativeCombined);

    if (isSuccessReported) {
      for (const q of activeQuests) {
        const qWords = `${q.title} ${q.description || ''}`.toLowerCase().split(/[\s,.:;«»"—]+/).filter(w => w.length >= 4);
        const matchedWords = qWords.filter(w => narrativeCombined.includes(w));
        if (matchedWords.length >= 2 || (qWords.length === 1 && matchedWords.length === 1)) {
          this.quests.completeQuest(
            room.id,
            q.id,
            room.roundNumber,
            `Задача «${q.title}» успешно решена в раунде ${room.roundNumber}.`
          );
        }
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
    // 1. Exact or substring match
    const exact = quests.find(q => {
      const tLower = q.title.toLowerCase().trim();
      return (
        q.id === query ||
        tLower === qLower ||
        tLower.includes(qLower) ||
        qLower.includes(tLower)
      );
    });
    if (exact) return exact;

    // 2. Token overlap match (handles paraphrasing like "Починить повозку" vs "Помочь каравану купца с повозкой")
    const qWords = qLower.split(/[\s,.:;«»"—]+/).filter(w => w.length >= 4);
    if (qWords.length > 0) {
      let bestMatch: QuestEntity | undefined;
      let maxOverlap = 0;
      for (const q of quests) {
        const tWords = `${q.title} ${q.description || ''}`.toLowerCase().split(/[\s,.:;«»"—]+/).filter(w => w.length >= 4);
        const overlap = qWords.filter(qw => tWords.some(tw => tw.includes(qw) || qw.includes(tw))).length;
        if (overlap > maxOverlap) {
          maxOverlap = overlap;
          bestMatch = q;
        }
      }
      if (maxOverlap >= 1) return bestMatch;
    }

    return undefined;
  }
}

export const questArbiter = new QuestArbiter();
