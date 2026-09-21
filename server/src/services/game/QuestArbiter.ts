import crypto from 'crypto';
import { QuestEntity, QuestCategory, RoomEntity, TurnActionEntity, GameLogEntity, LoreMilestone } from '../../db';
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
   * Self-heals and synchronizes all quests for a room based on historical logs,
   * current round actions, and prior milestones.
   */
  public reconcileRoomQuests(
    room: RoomEntity,
    allLogs: GameLogEntity[] = [],
    milestones: LoreMilestone[] = []
  ): { activeQuests: QuestEntity[]; completedQuests: QuestEntity[] } {
    const existing = this.quests.findByRoomId(room.id);

    // 1. Audit logs & milestones for historical cart repair
    const allText = [
      ...allLogs.map(l => `${l.narrativeText} ${l.actionsSummary || ''} ${l.currentSituation || ''}`),
      ...milestones.map(m => m.milestone),
      room.currentSituation || '',
    ].join(' ').toLowerCase();

    const isCartRepaired = /(?:почин(?:ил|ила|ить|или)|чинить|отремонтир(?:овал|овали|овать)|исправил(?:и)?|заменил(?:и)?\s+(?:колесо|ось)|почини(?:л|ли)\s+(?:ось|повозку)|ремонт.*повозк|исправил.*повозк|повозк.*(отремонтирована|починена|готова|на ходу))/i.test(allText);

    if (isCartRepaired) {
      const cartQuest = existing.find(q =>
        q.id === 'quest_balthazar_cart_repair' ||
        /повозк.*(бальтазар|торговц|ремонт)/i.test(q.title)
      );

      if (!cartQuest) {
        this.quests.create({
          id: 'quest_balthazar_cart_repair',
          roomId: room.id,
          title: 'Починить повозку Бальтазара',
          description: 'Отремонтировать сломанную ось и повреждённое колесо повозки торговца Бальтазара',
          category: 'repair',
          status: 'completed',
          giverName: 'Купец Бальтазар',
          targetName: 'Повозка Бальтазара',
          roundCreated: 1,
          roundCompleted: 2,
          resolutionNote: 'Повозка успешно отремонтирована отрядом и готова к дальнейшему пути.',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      } else if (cartQuest.status !== 'completed') {
        this.quests.completeQuest(
          room.id,
          cartQuest.id,
          cartQuest.roundCompleted || 2,
          'Повозка успешно отремонтирована отрядом и готова к дальнейшему пути.'
        );
      }
    }

    // 2. Audit for defeated wisps / spirits if mentioned in history
    const isWispsDefeated = /(?:призрачн.*огон(?:ек|ька|ьки)|огон(?:ек|ька|ьки).*рассыпа|рассыпаясь мириадами холодных искр|ядро.*огонька|секир.*предков.*огон)/i.test(allText);
    if (isWispsDefeated) {
      const wispQuest = existing.find(q =>
        q.id === 'quest_defeat_wisps' ||
        /призрачн.*огн|огоньк/i.test(q.title)
      );

      if (!wispQuest) {
        this.quests.create({
          id: 'quest_defeat_wisps',
          roomId: room.id,
          title: 'Уничтожить призрачные огоньки на тракте',
          description: 'Рассеять мистические сущности, преграждающие путь каравану',
          category: 'task',
          status: 'completed',
          targetName: 'Призрачные огоньки',
          roundCreated: 3,
          roundCompleted: room.roundNumber,
          resolutionNote: 'Призрачные огоньки рассеяны и уничтожены сокрушительными ударами отряда.',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      } else if (wispQuest.status !== 'completed') {
        this.quests.completeQuest(
          room.id,
          wispQuest.id,
          room.roundNumber,
          'Призрачные огоньки рассеяны и уничтожены сокрушительными ударами отряда.'
        );
      }
    }

    // 3. Return fresh active and completed quests
    const fresh = this.quests.findByRoomId(room.id);
    return {
      activeQuests: fresh.filter(q => q.status === 'active'),
      completedQuests: fresh.filter(q => q.status === 'completed'),
    };
  }

  /**
   * Evaluates round actions and AI DM response to update quest progression,
   * detect new objectives, and sanitize any hallucinated dilemmas that contradict
   * completed tasks.
   */
  public processRoundQuests(
    room: RoomEntity,
    currentRoundActions: TurnActionEntity[],
    dmResult: AIDMResponse
  ): QuestArbiterSyncResult {
    const activeQuests = this.quests.getActiveQuests(room.id);
    const completedQuests = this.quests.getCompletedQuests(room.id);

    const narrativeLower = (dmResult.narrative || '').toLowerCase();
    const situationLower = (dmResult.currentSituation || '').toLowerCase();
    const dilemmaLower = (dmResult.choiceDilemma || '').toLowerCase();

    // Check actions for direct cart repair attempts
    for (const action of currentRoundActions) {
      const actLower = action.actionText.toLowerCase();
      if (/(?:почин(?:ил|ила|ить|или)|чинить|отремонтир(?:овал|овали|овать)|исправил(?:и)?|заменил(?:и)?\s+(?:колесо|ось)|почини(?:л|ли)\s+(?:ось|повозку)|ремонт.*повозк)/i.test(actLower)) {
        this.quests.completeQuest(
          room.id,
          'quest_balthazar_cart_repair',
          room.roundNumber,
          'Повозка починена действиями отряда.'
        );
      }
    }

    // Check active quests against narrative and milestones
    for (const q of activeQuests) {
      const titleLower = q.title.toLowerCase();
      const isMentionedDone =
        (narrativeLower.includes(titleLower) || situationLower.includes(titleLower)) &&
        /(?:выполнен|завершен|успешн|побежд|спасен|уничтожен|рассеян|готов|найден)/i.test(narrativeLower + ' ' + situationLower);

      if (isMentionedDone) {
        this.quests.completeQuest(
          room.id,
          q.id,
          room.roundNumber,
          `Задача «${q.title}» успешно решена в раунде ${room.roundNumber}.`
        );
      }
    }

    // SANITIZATION GUARD: Prevent DM from hallucinating completed tasks in choiceDilemma or currentSituation!
    let cleanDilemma = dmResult.choiceDilemma;
    let cleanSituation = dmResult.currentSituation;

    const freshCompleted = this.quests.getCompletedQuests(room.id);
    const isCartDone = freshCompleted.some(q =>
      q.id === 'quest_balthazar_cart_repair' ||
      /повозк.*(бальтазар|торговц|ремонт)/i.test(q.title)
    );

    if (isCartDone) {
      // If AI DM mistakenly suggests repairing the cart again
      const repairGlitchRegex = /(?:повозка\s+Бальтазара\s+требует\s+ремонта|чинить\s+повозку|отремонтировать\s+повозку|починить\s+повозку)/gi;

      if (cleanDilemma && repairGlitchRegex.test(cleanDilemma)) {
        cleanDilemma = cleanDilemma.replace(
          repairGlitchRegex,
          'повозка Бальтазара уже починена и готова к отправлению'
        );
      }

      if (cleanSituation && repairGlitchRegex.test(cleanSituation)) {
        cleanSituation = cleanSituation.replace(
          repairGlitchRegex,
          'повозка Бальтазара на ходу'
        );
      }
    }

    // Extract novel active quest if DM proposed a clear quest in dilemma
    this.extractProceduralQuestsFromDM(room, dmResult, freshCompleted);

    const all = this.quests.findByRoomId(room.id);
    return {
      activeQuests: all.filter(q => q.status === 'active'),
      completedQuests: all.filter(q => q.status === 'completed'),
      allQuests: all,
      sanitizedDilemma: cleanDilemma,
      sanitizedSituation: cleanSituation,
    };
  }

  /**
   * Extracts clean, actionable quests from DM dilemmas and narrative if not already completed.
   */
  private extractProceduralQuestsFromDM(
    room: RoomEntity,
    dmResult: AIDMResponse,
    completedQuests: QuestEntity[]
  ): void {
    if (!dmResult.choiceDilemma) return;

    const dilemma = dmResult.choiceDilemma;

    // Common story hook patterns
    const candidates: { title: string; desc: string; category: QuestCategory }[] = [];

    if (/сопровод(?:ить|ите)\s+(?:караван|Бальтазара|купца)/i.test(dilemma)) {
      candidates.push({
        title: 'Сопроводить караван Бальтазара',
        desc: 'Обеспечить безопасный проход торговца через опасные участки тракта',
        category: 'main',
      });
    }

    if (/исследов(?:ать|айте)\s+(?:руины|источник|алтарь|следы|склеп)/i.test(dilemma)) {
      candidates.push({
        title: 'Исследовать таинственные руины / следы',
        desc: 'Осмотреть подозрительное место и выяснить причину аномалий',
        category: 'investigation',
      });
    }

    if (/расспрос(?:ить|ите)\s+(?:Бальтазара|купца|свидетеля)\s+о\s+(?:слухах|артефакте|порче)/i.test(dilemma)) {
      candidates.push({
        title: 'Выяснить происхождение странного артефакта',
        desc: 'Расспросить купца об истории найденных диковинок и предупредить опасность порчи',
        category: 'social',
      });
    }

    for (const cand of candidates) {
      // Check if already completed
      const isAlreadyCompleted = completedQuests.some(cq =>
        cq.title.toLowerCase().trim() === cand.title.toLowerCase().trim() ||
        cand.title.toLowerCase().includes(cq.title.toLowerCase().trim())
      );
      if (!isAlreadyCompleted) {
        this.quests.createOrGetQuest(
          room.id,
          cand.title,
          cand.desc,
          cand.category,
          room.roundNumber
        );
      }
    }
  }
}

export const questArbiter = new QuestArbiter();
