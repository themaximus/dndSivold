import crypto from 'crypto';
import { RoomEntity, TurnActionEntity, EnvironmentObjectEntity, EnvironmentObjectState } from '../../db';

export interface AffordanceFeasibilityResult {
  isFeasible: boolean;           // Can the final goal be achieved right now?
  isStagedProgress: boolean;     // Did this advance progress towards the goal?
  currentStage: number;
  maxStage: number;
  stageText: string;
  isNowOperational: boolean;
  promptDirective: string;
  auditNote: string;
}

/**
 * SceneAffordanceService
 *
 * Enforces physical world consistency and rules of affordance in D&D sessions.
 * Implements Progressive Staged Success:
 * - If an object is broken/unusable (e.g. wagon without wheels, locked iron gate),
 *   a high d20 roll does NOT perform an impossible miracle (e.g. driving without wheels).
 * - Instead, a successful roll produces progressive staged advance:
 *   discovering spare wheels/tools, prying a hinge, or advancing repair stages.
 */
export class SceneAffordanceService {
  /**
   * Keywords for identifying common physical objects and vehicles
   */
  private readonly objectPatterns: Array<{
    key: string;
    defaultName: string;
    keywords: string[];
    operationalVerbs: string[];
    repairVerbs: string[];
  }> = [
    {
      key: 'wagon_cart',
      defaultName: 'Торговая повозка',
      keywords: ['повозк', 'телег', 'фургон', 'обоз', 'колес', 'wagon', 'cart'],
      operationalVerbs: [
        'уехать', 'ехать', 'поехать', 'тронуться', 'гнать', 'мчать',
        'удирать на повозке', 'сесть и поехать', 'двинуться на повозке',
        'уезжаю', 'еду', 'гоню', 'трогаюсь'
      ],
      repairVerbs: [
        'чинить', 'починить', 'поставить', 'найти колес', 'инструмент',
        'монтаж', 'установить', 'ремонт', 'ось', 'поднять', 'домкрат',
        'ставлю', 'чиню', 'устанавливаю', 'приладить', 'прикрутить'
      ],
    },
    {
      key: 'iron_gate',
      defaultName: 'Кованые ворота',
      keywords: ['ворот', 'двер', 'решетк', 'замок', 'gate', 'door'],
      operationalVerbs: [
        'войти', 'пройти', 'открыть', 'прорваться', 'зайти в ворота',
        'вхожу', 'прохожу', 'открываю'
      ],
      repairVerbs: [
        'вскрыть', 'отмычк', 'сломать замок', 'найти ключ', 'смазать петли',
        'выбить засов', 'поддеть засов', 'взлом', 'взламываю', 'вскрываю'
      ],
    },
    {
      key: 'rope_bridge',
      defaultName: 'Канатный мост',
      keywords: ['мост', 'переправ', 'трос', 'bridge'],
      operationalVerbs: [
        'перейти', 'пробежать', 'переправиться', 'перебежать', 'ступаю на мост'
      ],
      repairVerbs: [
        'натянуть трос', 'связать веревки', 'починить настил', 'укрепить опору',
        'чиню мост', 'подвязать'
      ],
    },
  ];

  /**
   * Finds an environment object that matches the action text.
   */
  public findMatchingObject(actionText: string, room: RoomEntity): EnvironmentObjectEntity | undefined {
    if (!actionText) return undefined;
    const lower = actionText.toLowerCase();

    // 1. Check existing room environment objects first
    const existing = room.environmentObjects || [];
    for (const obj of existing) {
      const objNameLower = obj.name.toLowerCase();
      const objKeyLower = obj.key.toLowerCase();
      if (lower.includes(objNameLower) || lower.includes(objKeyLower)) {
        return obj;
      }
      // Check keywords for this object type
      const pattern = this.objectPatterns.find(p => p.key === obj.key);
      if (pattern && pattern.keywords.some(k => lower.includes(k))) {
        return obj;
      }
    }

    // 2. If not registered but action refers to wagon/cart and room situation mentions wagon, lazy-init
    const matchedPattern = this.objectPatterns.find(p => p.keywords.some(k => lower.includes(k)));
    if (matchedPattern) {
      const situationLower = (room.currentSituation || '').toLowerCase();
      const campaignLower = (room.campaignPlot || '').toLowerCase();

      // Check if situation or plot mentions this object
      const isPresentInScene = matchedPattern.keywords.some(k => situationLower.includes(k) || campaignLower.includes(k));
      if (isPresentInScene) {
        return this.ensureDefaultObject(room, matchedPattern.key);
      }
    }

    return undefined;
  }

  /**
   * Checks if the action demands the primary operational function of the object
   * (e.g. driving a wagon, passing through a closed gate).
   */
  public isActionDemandingOperationalFunction(actionText: string, obj: EnvironmentObjectEntity): boolean {
    if (!actionText) return false;
    const lower = actionText.toLowerCase();
    const pattern = this.objectPatterns.find(p => p.key === obj.key);
    if (!pattern) {
      // General heuristic
      return /(уехать|ехать|поехать|открыть|войти|пройти)/i.test(lower);
    }
    return pattern.operationalVerbs.some(v => lower.includes(v));
  }

  /**
   * Checks if the action aims at repairing, fixing, searching for parts, or solving prerequisites.
   */
  public isActionAdvancingPrerequisite(actionText: string, obj: EnvironmentObjectEntity): boolean {
    if (!actionText) return false;
    const lower = actionText.toLowerCase();
    const pattern = this.objectPatterns.find(p => p.key === obj.key);
    if (!pattern) {
      return /(чинить|починить|ремонт|установить|вскрыть|отмычк|найти)/i.test(lower);
    }
    return pattern.repairVerbs.some(v => lower.includes(v));
  }

  /**
   * Evaluates physical feasibility and applies Progressive Staged Success.
   *
   * Rules:
   * 1. If object is already operational (isOperational === true), action proceeds normally.
   * 2. If object is broken/unusable (isOperational === false) and action demands driving/using it:
   *    - The direct final action is physically impossible right now (isFeasible = false).
   *    - BUT if rollTotal >= dc: It provides progressive staged advance!
   *      Player discovers the missing parts / tools or prepares the object for repair.
   *      progressStage increases, and promptDirective instructs AI DM to honor the roll
   *      by describing the breakthrough while maintaining physical laws.
   *    - If rollTotal < dc: Player fails to make progress and encounters the physical blocker.
   */
  public evaluatePhysicalFeasibility(
    action: TurnActionEntity,
    targetObj: EnvironmentObjectEntity,
    rollTotal: number,
    dc: number,
    isCriticalSuccess: boolean = false
  ): AffordanceFeasibilityResult {
    const actionText = action.actionText || '';
    const demandsOperation = this.isActionDemandingOperationalFunction(actionText, targetObj);
    const isAdvancingPrereq = this.isActionAdvancingPrerequisite(actionText, targetObj);

    // Case 1: Object is fully operational
    if (targetObj.isOperational) {
      return {
        isFeasible: true,
        isStagedProgress: false,
        currentStage: targetObj.progressStage.current,
        maxStage: targetObj.progressStage.max,
        stageText: targetObj.progressStage.currentStageText,
        isNowOperational: true,
        promptDirective: `⚙️ ОБЪЕКТ СЦЕНЫ «${targetObj.name}»: Полностью исправен и готов к использованию.`,
        auditNote: `Object ${targetObj.key} is already operational.`,
      };
    }

    const isSuccess = rollTotal >= dc || isCriticalSuccess;

    // Case 2: Player attempts to use/drive an unoperational object (e.g. drive a wagon without wheels)
    if (demandsOperation && !targetObj.isOperational) {
      if (isSuccess) {
        // Progressive Staged Success!
        // The player CANNOT drive off, but their high roll grants the vital prerequisite!
        const nextStage = Math.min(targetObj.progressStage.max, targetObj.progressStage.current + 1);
        const stageProgressText = this.describeStageProgress(targetObj.key, nextStage);

        return {
          isFeasible: false, // Cannot instantly drive away!
          isStagedProgress: true,
          currentStage: nextStage,
          maxStage: targetObj.progressStage.max,
          stageText: stageProgressText,
          isNowOperational: false,
          promptDirective:
            `⚖️ ФИЗИЧЕСКИЙ ЗАКОН СЦЕНЫ И ЭТАПНЫЙ ПРОГРЕСС: «${targetObj.name}» прямо сейчас НЕ на ходу (${targetObj.physicalBlocker || 'отсутствуют ключевые детали'}).\n` +
            `Бросок игрока УСПЕШЕН (d20: ${rollTotal} >= СЛ ${dc}${isCriticalSuccess ? ' ★ КРИТ!' : ''}).\n` +
            `❌ СТРОГИЙ ЗАПРЕТ: Чудес не бывает! Категорически запрещено описывать, что повозка волшебным образом сама покатилась без колёс или отряд уже уехал!\n` +
            `✅ ЭТАПНЫЙ УСПЕХ: Но бросок не сгорает! Герой добивается решающего продвижения: в зарослях у дороги / под брезентом он находит запасные колёса и рычаг-домкрат (Этап ${nextStage}/${targetObj.progressStage.max}: ${stageProgressText})!\n` +
            `Опиши обнаружение колёс и инструментов и чётко укажи в дилемме, что следующим действием требуется установить их на ось!`,
          auditNote: `Blocked final operation on ${targetObj.key}. High roll transformed into staged progress (${nextStage}/${targetObj.progressStage.max}).`,
        };
      } else {
        // Roll failed against the blocker
        return {
          isFeasible: false,
          isStagedProgress: false,
          currentStage: targetObj.progressStage.current,
          maxStage: targetObj.progressStage.max,
          stageText: targetObj.progressStage.currentStageText,
          isNowOperational: false,
          promptDirective:
            `⚖️ ФИЗИЧЕСКИЙ БЛОКЕР СЦЕНЫ: «${targetObj.name}» неисправна (${targetObj.physicalBlocker || 'сломана'}).\n` +
            `Бросок игрока НЕУСПЕШЕН (d20: ${rollTotal} < СЛ ${dc}).\n` +
            `Опиши, что персонаж пытается тронуться или сдвинуть повозку с места, но ось с глухим стуком зарывается в дорожную грязь. Уехать невозможно без ремонта!`,
          auditNote: `Failed roll against physical blocker on ${targetObj.key}.`,
        };
      }
    }

    // Case 3: Player specifically performs repair / installation / unlocking
    if (isAdvancingPrereq) {
      if (isSuccess) {
        const nextStage = Math.min(targetObj.progressStage.max, targetObj.progressStage.current + 1);
        const isComplete = nextStage >= targetObj.progressStage.max;
        const stageProgressText = this.describeStageProgress(targetObj.key, nextStage);

        return {
          isFeasible: true,
          isStagedProgress: true,
          currentStage: nextStage,
          maxStage: targetObj.progressStage.max,
          stageText: stageProgressText,
          isNowOperational: isComplete,
          promptDirective: isComplete
            ? `🔧 РЕМОНТ ЗАВЕРШЁН: Герой успешно установил все детали! «${targetObj.name}» полностью готова к эксплуатации (Этап ${nextStage}/${targetObj.progressStage.max}). Теперь отряд может свободно двигаться дальше!`
            : `🔧 ЭТАП РЕМОНТА ВЫПОЛНЕН: Герой успешно продвигает починку «${targetObj.name}» (Этап ${nextStage}/${targetObj.progressStage.max}: ${stageProgressText}). Требуется ещё одно усилие для полного ввода в строй.`,
          auditNote: `Prerequisite repair advanced to stage ${nextStage}/${targetObj.progressStage.max}. Complete: ${isComplete}`,
        };
      } else {
        return {
          isFeasible: false,
          isStagedProgress: false,
          currentStage: targetObj.progressStage.current,
          maxStage: targetObj.progressStage.max,
          stageText: targetObj.progressStage.currentStageText,
          isNowOperational: false,
          promptDirective: `🔧 ЗАМИНКА ПРИ РЕМОНТЕ: Бросок ${rollTotal} < СЛ ${dc}. Сорвался рычаг или застряла гайка. Починка «${targetObj.name}» требует повторной попытки.`,
          auditNote: `Failed repair roll on ${targetObj.key}.`,
        };
      }
    }

    // Default inspection or general interaction
    return {
      isFeasible: true,
      isStagedProgress: false,
      currentStage: targetObj.progressStage.current,
      maxStage: targetObj.progressStage.max,
      stageText: targetObj.progressStage.currentStageText,
      isNowOperational: targetObj.isOperational,
      promptDirective: `🔍 ОСМОТР ОБЪЕКТА «${targetObj.name}»: ${targetObj.physicalBlocker || 'Обычное состояние'}. Требуется: ${targetObj.requiredPrerequisites.join(', ')}.`,
      auditNote: `Inspection of ${targetObj.key}.`,
    };
  }

  /**
   * Advances object stage in room and authoritative state.
   */
  public advanceObjectStage(
    room: RoomEntity,
    objectKey: string,
    delta: number = 1,
    customStageText?: string
  ): EnvironmentObjectEntity | undefined {
    if (!room.environmentObjects) {
      room.environmentObjects = [];
    }

    let obj = room.environmentObjects.find(o => o.key === objectKey);
    if (!obj) {
      obj = this.ensureDefaultObject(room, objectKey);
    }

    const current = Math.min(obj.progressStage.max, Math.max(0, obj.progressStage.current + delta));
    obj.progressStage.current = current;
    if (customStageText) {
      obj.progressStage.currentStageText = customStageText;
    } else {
      obj.progressStage.currentStageText = this.describeStageProgress(obj.key, current);
    }

    if (current >= obj.progressStage.max) {
      obj.isOperational = true;
      obj.state = 'operational';
      obj.physicalBlocker = undefined;
    } else if (current > 0) {
      obj.isOperational = false;
      obj.state = 'in_progress';
    }

    obj.updatedAt = new Date().toISOString();
    return obj;
  }

  /**
   * Registers or updates an interactive environment object in a room.
   */
  public registerObject(room: RoomEntity, objData: Partial<EnvironmentObjectEntity> & { key: string; name: string }): EnvironmentObjectEntity {
    if (!room.environmentObjects) {
      room.environmentObjects = [];
    }

    const existingIndex = room.environmentObjects.findIndex(o => o.key === objData.key);
    const now = new Date().toISOString();

    const entity: EnvironmentObjectEntity = {
      id: objData.id || `env_${crypto.randomUUID()}`,
      roomId: room.id,
      key: objData.key,
      name: objData.name,
      state: objData.state || 'broken',
      isOperational: objData.isOperational ?? false,
      physicalBlocker: objData.physicalBlocker,
      requiredPrerequisites: objData.requiredPrerequisites || ['Найти запчасти', 'Установить на место'],
      progressStage: objData.progressStage || {
        current: 0,
        max: 2,
        currentStageText: 'Неисправно / разобрано',
      },
      interactableActions: objData.interactableActions || ['repair', 'drive', 'search'],
      narrativeNotes: objData.narrativeNotes || [],
      createdAt: objData.createdAt || now,
      updatedAt: now,
    };

    if (existingIndex >= 0) {
      room.environmentObjects[existingIndex] = entity;
    } else {
      room.environmentObjects.push(entity);
    }

    return entity;
  }

  /**
   * Initializes standard objects if referenced by scene narrative.
   */
  public ensureDefaultObject(room: RoomEntity, objectKey: string): EnvironmentObjectEntity {
    if (objectKey === 'wagon_cart') {
      return this.registerObject(room, {
        key: 'wagon_cart',
        name: 'Торговая повозка',
        state: 'broken',
        isOperational: false,
        physicalBlocker: 'Отсутствуют колёса, ось застряла в дорожной грязи',
        requiredPrerequisites: ['найти запасные колёса', 'установить колёса на ось'],
        progressStage: {
          current: 0,
          max: 2,
          currentStageText: 'Колёса отсутствуют, повозка недвижима',
        },
        interactableActions: ['repair', 'drive', 'search', 'barricade'],
        narrativeNotes: ['Торговая повозка каравана, брошенная у развилки тракта.'],
      });
    }

    if (objectKey === 'iron_gate') {
      return this.registerObject(room, {
        key: 'iron_gate',
        name: 'Кованые ворота',
        state: 'locked',
        isOperational: false,
        physicalBlocker: 'Заперты на тяжелый кованый засов и амбарный замок',
        requiredPrerequisites: ['вскрыть замок отмычкой или выбить засов'],
        progressStage: {
          current: 0,
          max: 2,
          currentStageText: 'Наглухо заперто',
        },
        interactableActions: ['pick_lock', 'force_open', 'inspect'],
        narrativeNotes: ['Массивные ворота с железной решеткой.'],
      });
    }

    return this.registerObject(room, {
      key: objectKey,
      name: 'Интерактивный объект',
      state: 'broken',
      isOperational: false,
      requiredPrerequisites: ['исследовать', 'починить'],
      progressStage: { current: 0, max: 2, currentStageText: 'Требуется ремонт' },
    });
  }

  private describeStageProgress(key: string, stage: number): string {
    if (key === 'wagon_cart') {
      switch (stage) {
        case 0:
          return 'Колёса отсутствуют, повозка недвижима';
        case 1:
          return 'Колёса и инструменты найдены, требуется монтаж на ось';
        case 2:
        default:
          return 'Колёса установлены, повозка на ходу';
      }
    }
    if (key === 'iron_gate') {
      switch (stage) {
        case 0:
          return 'Заперто на засов';
        case 1:
          return 'Замок взломан, засов поддет';
        case 2:
        default:
          return 'Ворота распахнуты';
      }
    }
    return `Прогресс: этап ${stage}`;
  }
}

export const sceneAffordanceService = new SceneAffordanceService();
