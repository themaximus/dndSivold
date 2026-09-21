import crypto from 'crypto';
import { CharacterEntity, TurnActionEntity, RoomEnemy, RoomNPC, NPCDisposition } from '../../db';
import { calculateModifier } from '../dndRules';
import { itemLedgerRepository } from '../../repositories/ItemLedgerRepository';

export type ThreatLevel = 'low' | 'moderate' | 'high' | 'deadly';

export type FailureConsequenceType =
  | 'damage_hp'              // Прямой встречный урон здоровью от врага/ловушки
  | 'tactical_complication'  // Осложнение позиции: повален (prone), зажат, окружен, шум
  | 'gear_mishap'            // Снаряжение: выронил оружие, потух факел, застрял клинок
  | 'social_backfire'        // Обострение: враг счел за слабость, насмешка, ожесточение
  | 'mild_setback';          // Обошлось: заминка, уворот, потерян темп без вреда

export interface FailureConsequence {
  type: FailureConsequenceType;
  severity: ThreatLevel;
  hpDelta: number; // 0 или отрицательное число (-3, -5 и т.д.)
  conditionAdded?: string; // 'prone', 'restrained', 'stunned'
  description: string;
  narrativeDirective: string;
}

export type ActionIntentType =
  | 'attack'
  | 'heal'
  | 'pacify_animal'
  | 'persuasion_negotiate'
  | 'intimidation_repel'
  | 'defensive_guard'
  | 'flee_retreat'
  | 'distraction_environment'
  | 'general_check';

export interface LeverageEvaluation {
  bonus: number;
  willpowerDamagePercent: number;
  appliedLeverage: string[];
  consumedFoodItem?: { id?: string; name: string };
}

export interface PacificationOutcome {
  targetId: string;
  targetName: string;
  willpowerBefore: number;
  willpowerAfter: number;
  willpowerDelta: number;
  stage: 'resisted' | 'hesitation' | 'pacified' | 'tamed_or_docile';
  leverageApplied: string[];
  newStatus: string;
  newDisposition?: NPCDisposition;
  promptDirective: string;
}

export interface MechanicalTargetUpdate {
  targetId: string;
  targetName: string;
  targetType: 'enemy' | 'npc';
  hpBefore: number;
  hpAfter: number;
  damage: number;
  isDead: boolean;
  newStatus: string;
  willpowerAfter?: number;
}

export interface ConsumedItemRecord {
  itemId?: string;
  itemName: string;
  quantity: number;
  reason: string;
}

export interface MechanicalResolution {
  actionId: string;
  characterId: string;
  characterName: string;
  actionType: 'attack' | 'check' | 'heal' | 'pacify' | 'defense' | string;
  isHit?: boolean;
  damageFormula?: string;
  damageRolled?: number;
  damageRolls?: number[];
  healRolled?: number;
  targetUpdate?: MechanicalTargetUpdate;
  consumedItems: ConsumedItemRecord[];
  failureConsequence?: FailureConsequence;
  pacificationOutcome?: PacificationOutcome;
  promptDirective: string;
  auditNotes: string;
}

export class MechanicalArbiter {
  /**
   * Main entry point: evaluates player action against enemies and scene NPCs,
   * returning deterministic math, damage rolls, and strict prompt directives.
   */
  public evaluateAction(
    action: TurnActionEntity,
    character: CharacterEntity | undefined,
    currentEnemies: RoomEnemy[],
    currentNPCs: RoomNPC[],
    roomDC: number = 12
  ): MechanicalResolution {
    const actionText = action.actionText || '';
    const intent = this.classifyIntent(actionText, action.actionType);

    switch (intent) {
      case 'heal':
        return this.resolveHealingAction(action, character, currentEnemies, currentNPCs);

      case 'pacify_animal':
        return this.resolvePacificationAction(action, character, currentEnemies, currentNPCs, roomDC);

      case 'persuasion_negotiate': {
        // If the target is a beast/monster, route to pacification
        const targetInfo = this.findTarget(action, currentEnemies, currentNPCs);
        const isBeastTarget = this.isAnimalOrBeast(targetInfo?.target?.name || actionText);
        if (isBeastTarget) {
          return this.resolvePacificationAction(action, character, currentEnemies, currentNPCs, roomDC);
        }
        return this.resolveSocialNegotiationAction(action, character, currentEnemies, currentNPCs, roomDC);
      }

      case 'defensive_guard':
        return this.resolveDefensiveGuardAction(action, character, currentEnemies, currentNPCs, roomDC);

      case 'attack': {
        const targetFound = this.findTarget(action, currentEnemies, currentNPCs);
        return this.resolveCombatAttack(action, character, currentEnemies, currentNPCs, targetFound);
      }

      case 'flee_retreat':
        return this.resolveFleeRetreatAction(action, character, currentEnemies, currentNPCs, roomDC);

      case 'distraction_environment':
      case 'intimidation_repel':
      case 'general_check':
      default: {
        const targetFound = this.findTarget(action, currentEnemies, currentNPCs);
        return this.resolveGeneralCheckOrSave(action, character, targetFound?.target || null, roomDC);
      }
    }
  }

  /**
   * Extracts dialogue / spoken text from physical narrative action.
   * Separates what characters say (inside quotes or after speech verbs)
   * from what physical actions they perform (drinking potions, swinging axes, moving).
   */
  public extractSpeechAndAction(text: string): {
    spokenDialogue: string[];
    physicalAction: string;
    isPureSpeech: boolean;
    hasSecondPersonAddress: boolean;
    addressedTargetName?: string;
  } {
    const raw = (text || '').trim();
    const spokenDialogue: string[] = [];
    const quoteRegex = /(?:«([^»]+)»|"([^"]+)"|“([^”]+)”)/g;
    let match: RegExpExecArray | null;
    let cleanPhysical = raw;

    while ((match = quoteRegex.exec(raw)) !== null) {
      const quoteText = match[1] || match[2] || match[3];
      if (quoteText && quoteText.trim()) {
        spokenDialogue.push(quoteText.trim());
      }
    }

    if (spokenDialogue.length > 0) {
      cleanPhysical = raw.replace(quoteRegex, ' ').replace(/\s+/g, ' ').trim();
    }

    const isSpeechVerbOnly = /^(говор(ю|ит)|крич(у|ит)|шепч(у|ет)|восклица(ю|ет)|обраща(юсь|ется)|обратившись|произнош(у|ит)|заявля(ю|ет))(\s.*)?$/i.test(cleanPhysical);
    const isPureSpeech = spokenDialogue.length > 0 && (cleanPhysical.length === 0 || isSpeechVerbOnly);
    const hasSecondPersonAddress = /(?:^|[^\p{L}\p{N}_])(теб[яе]|тобой|ты|вас|вам|вами|вы)(?:$|[^\p{L}\p{N}_])/iu.test(raw);

    let addressedTargetName: string | undefined;
    const nameAddressMatch = raw.match(/^(?:«|")?([А-Яа-яЁёA-Za-z]+)[,!:]/);
    if (nameAddressMatch && nameAddressMatch[1]) {
      const candidate = nameAddressMatch[1].trim();
      if (!/^(я|мы|он|она|они|вы|ты|что|как|стой|стойте|эй|но|а|о)$/i.test(candidate)) {
        addressedTargetName = candidate;
      }
    }

    return {
      spokenDialogue,
      physicalAction: cleanPhysical,
      isPureSpeech,
      hasSecondPersonAddress,
      addressedTargetName,
    };
  }

  /**
   * Multi-factor intent classification with robust negation and dialogue safeguards.
   * Prevents spoken dialogue like "ТЕБЯ НУЖНО ВЫЛЕЧИТЬ!" from triggering physical item consumption,
   * and prevents phrases like "не атаковать", "мирный", "убедить ящера" from being treated as melee attacks!
   */
  public classifyIntent(actionText: string, explicitType?: string): ActionIntentType {
    const text = (actionText || '').toLowerCase().trim();
    const speech = this.extractSpeechAndAction(actionText);

    // Safeguard: If action is pure spoken dialogue in quotes (e.g. «бальтазар, ты одержим демоном... ТЕБЯ НУЖНО ВЫЛЕЧИТЬ!»)
    // Spoken dialogue is a social argument / persuasion / RP, NEVER physical item consumption!
    if (speech.isPureSpeech) {
      if (/(ящер|волк|медвед|звер|пес|собак|лошад|хищник)/i.test(text)) {
        return 'pacify_animal';
      }
      if (/(убью|разорву|смерть|дрожи|уничтож|порешу)/i.test(text) && !/(не|мир)/i.test(text)) {
        return 'intimidation_repel';
      }
      return 'persuasion_negotiate';
    }

    // 1. Healing / potions / bandaging
    // Requires physical consumption verbs (drinking, pouring, administering, wrapping bandages)
    // Spoken dialogue alone without physical consumption verbs does NOT trigger heal!
    const hasPhysicalHealVerb = /(выпи(л|ть|ваю)|пь(ет|ю|ем)|глота(ет|ю|ть)|пои(т|ть|л)\s+(зельем|водой|снадобь)|наложи(л|ть|ваю)\s+повязк|перевяз(ал|ать|ываю)|влива(ет|ю|ть)\s+в\s+рот)/i.test(speech.physicalAction || text);
    const mentionsPotionItemExplicitly = /(зель[ея]\s+лечения|лечебн(ое|ым|ого)\s+зель|исцеляющ(ее|им)\s+зель|склянк(а|у)\s+с\s+зельем)/i.test(speech.physicalAction || text);

    if (hasPhysicalHealVerb || (mentionsPotionItemExplicitly && !speech.isPureSpeech)) {
      return 'heal';
    }

    // 2. Distraction / environment (throwing sand/stones/torches, noise, collapsing)
    if (/(отвлеч(ь|у|ение)|(бросить|кинуть|швырнуть|метнуть)\s+.*(песок|песка|камень|камн|факел|горсть|земл|пыл|гряз)|опрокинуть|завалить|создать шум|обрушить)/i.test(text)) {
      return 'distraction_environment';
    }

    // 3. Flee / retreat
    if (/(беж(ать|им|у|ит)|отступ(ить|аем|аю|айте)|убег(ать|аю|аем|айте)?|спаса(ться|емся|йся)|дать деру|удира(ть|ем|йте))/i.test(text)) {
      return 'flee_retreat';
    }

    // 4. Defensive guard / parry / dodge
    if (/(защит(а|иться|аюсь)|в глухую защиту|прикры(ться|ваюсь) щитом|парир(овать|ую)|уклон(иться|яюсь)|занять оборону|обороня(ться|юсь)|держать строй|блокиров(ать|аю))/i.test(text)) {
      return 'defensive_guard';
    }

    // 5. Animal / Monster pacification & calming & feeding
    const isAnimalMentioned = /(ящер|волк|медвед|звер|собак|пес|лошад|конь|хищник|тварь|паук|змея|чудовищ|варан|геккон)/i.test(text);
    const isPacifyPhrase = /(убедить|успокоить|утихомирить|приручить|задобрить|покормить|угостить|скормить|дать|бросить|протянуть|опустить оружие|опустить секиру|опустить меч|не атаковать|стать мирным|мирно|ладить|погладить|не бояться|мир)/i.test(text);
    const isFoodMentioned = /(мяс|окорок|ед[уа]|паек|пайк|рыб|сыр|колбас|хлеб|корма|лакомств|кость|кусок)/i.test(text);

    if ((isPacifyPhrase && isAnimalMentioned) || (isFoodMentioned && isAnimalMentioned) || /(не атаковать|стать мирным|успокоить)/i.test(text)) {
      return 'pacify_animal';
    }

    // 6. Social persuasion / negotiation
    if (/(убежд(аю|ать)|уговар(иваю|ивать)|договор(иться|имся)|переговор(ы|ить)|предлож(ить|ение)|миром|сдавай(тесь|ся)|слож(ите|и) оружие|пощад(и|ить)|отпусти(те)?|подкуп(ить)?|заплат(ить|им)|убед(ить|и)|одержим|демон|приди в себя|вразуми)/i.test(text)) {
      return 'persuasion_negotiate';
    }

    // 7. Intimidation / show of force
    if (/(запуг(ать|иваю)|устраш(ить|аю)|грозн(о|ый)|рычу|рявк(нуть|нул)|угрож(аю|ать)|показать силу|демонстрация силы)/i.test(text)) {
      return 'intimidation_repel';
    }

    // 8. Attack check (Strictly checks for negation like "не атаковать", "без боя")
    const hasNegatedAttack = /(не\s+(атаковать|бить|стрелять|рубить|убивать|нападать)|без\s+(боя|нападения|атаки|драки)|прекратить\s+(атаковать|бой|атаку))/i.test(text);
    if (!hasNegatedAttack) {
      if (explicitType === 'attack') return 'attack';
      const isAggressiveVerb = /(атак(а|ую|овать)|удар(ить|яю|ом)?|рубл(ю|ить)|выстрел(ить|ю)?|стреля(ю|ть)|дуэл(ь|и)|напад(аю|ать|ение)|сража(ться|юсь)|всаживаю|приконч(ить|у)|уб(ить|ью)|срубаю|отрубаю|колю|пыряю|рассекаю|смертельный удар)/i.test(text);
      if (isAggressiveVerb) return 'attack';
    }

    return 'general_check';
  }

  /**
   * Evaluates player leverage (food, peaceful posture, wounds, distance) vs empty words.
   */
  public evaluateLeverage(
    actionText: string,
    character?: CharacterEntity,
    target?: RoomEnemy | RoomNPC | null
  ): LeverageEvaluation {
    const text = (actionText || '').toLowerCase();
    let bonus = 0;
    let willpowerDamagePercent = 0;
    const appliedLeverage: string[] = [];
    let consumedFoodItem: { id?: string; name: string } | undefined;

    // 1. Food / Meat leverage
    const mentionsFood = /(мяс(о|ом|а)|окорок|кусок|паек|пайк|рыб(а|у|ой)|сыр|колбас|хлеб|корма|еда|еду|скормить|угостить|поделиться едой|бросить кусок)/i.test(text);
    if (mentionsFood) {
      const foodItem = (character?.inventory || []).find(i =>
        i && (i.type === 'food' || /(мясо|окорок|паек|рыба|рацион|хлеб|сыр|колбас)/i.test(i.name))
      );
      if (foodItem) {
        bonus += 5;
        willpowerDamagePercent += 30;
        appliedLeverage.push(`Сытное угощение из инвентаря: «${foodItem.name}» (+5 к проверке, -30% воли)`);
        consumedFoodItem = { id: foodItem.id, name: foodItem.name };
      } else {
        bonus += 3;
        willpowerDamagePercent += 20;
        appliedLeverage.push('Предложено подручное угощение / припасы (+3 к проверке, -20% воли)');
      }
    }

    // 2. Lowered weapon / peaceful posture
    const mentionsLoweringWeapon = /(опустил( оружие| секиру| меч| клинок)?|убрал( оружие| клинок)?|спрятал( оружие| клинок)?|за спину|не двигаться|медленно|присел|ладони|раскрытые ладони|без резких движений|не делаю резких движений)/i.test(text);
    if (mentionsLoweringWeapon) {
      bonus += 3;
      willpowerDamagePercent += 15;
      appliedLeverage.push('Мирный язык тела (опущенное оружие / медленные жесты) (+3 к проверке, -15% воли)');
    }

    // 3. Safe distance / retreat
    const mentionsDistance = /(дистанци|расстояни|отступил|шаг назад|не приближаясь|держать дистанцию)/i.test(text);
    if (mentionsDistance) {
      bonus += 2;
      willpowerDamagePercent += 10;
      appliedLeverage.push('Сохранение безопасной дистанции (+2 к проверке, -10% воли)');
    }

    // 4. Empathy / soothing voice
    const mentionsVoice = /(спокойн(ым|о) голос|мягко|ласково|примирительно|негромко|говорю тихо)/i.test(text);
    if (mentionsVoice) {
      bonus += 2;
      willpowerDamagePercent += 10;
      appliedLeverage.push('Успокаивающий тон и интонация (+2 к проверке, -10% воли)');
    }

    // 5. Target is severely wounded (<50% HP)
    if (target && target.hpCurrent < target.hpMax * 0.5) {
      willpowerDamagePercent += 25;
      appliedLeverage.push(`Цель изранена (${target.hpCurrent}/${target.hpMax} HP) — её боевой дух сломлен (-25% воли)`);
    }

    // 6. Penalty for empty talk without leverage during battle
    if (appliedLeverage.length === 0 && !mentionsFood && !mentionsLoweringWeapon) {
      bonus -= 3;
      appliedLeverage.push('Попытка договориться голыми словами без еды и без опускания оружия (-3 штраф к проверке)');
    }

    return {
      bonus,
      willpowerDamagePercent,
      appliedLeverage,
      consumedFoodItem,
    };
  }

  /**
   * Procedural Failure Consequences Engine:
   * Selects appropriate consequence based on Threat Level (low/moderate/high/deadly):
   * - HP damage (counter-attack)
   * - Tactical complications (prone, cornered, flanked, noise)
   * - Gear mishap (dropped weapon, torch out)
   * - Mild setback (clean dodge, 0 HP lost)
   */
  public generateFailureConsequence(
    action: TurnActionEntity,
    character: CharacterEntity | undefined,
    target: RoomEnemy | RoomNPC | null,
    roomDC: number,
    isCritFail: boolean
  ): FailureConsequence {
    // 1. Calculate Threat Level
    let threat: ThreatLevel = 'moderate';
    if (roomDC <= 11) threat = 'low';
    else if (roomDC <= 15) threat = 'moderate';
    else if (roomDC <= 18) threat = 'high';
    else threat = 'deadly';

    const enemyTarget = target && 'type' in target ? (target as RoomEnemy) : null;
    if (enemyTarget && (enemyTarget.type === 'boss' || enemyTarget.type === 'elite')) {
      if (threat === 'low') threat = 'moderate';
      else if (threat === 'moderate') threat = 'high';
      else threat = 'deadly';
    }

    if (isCritFail) {
      if (threat === 'low') threat = 'moderate';
      else if (threat === 'moderate') threat = 'high';
      else threat = 'deadly';
    }

    // 2. Roll 1-100 on Threat Matrix
    const roll = crypto.randomInt(1, 101);
    const targetName = target?.name || 'Противник';

    if (threat === 'low') {
      // 60% mild_setback, 25% tactical_complication, 15% social_backfire. 0% HP loss.
      if (roll <= 60) {
        return {
          type: 'mild_setback',
          severity: 'low',
          hpDelta: 0,
          description: 'Легкая заминка. Потерян темп, но персонаж невредим.',
          narrativeDirective: 'УРОН: 0 HP. Действие не увенчалось успехом, но персонаж не пострадал. Опиши заминку или неловкую паузу.',
        };
      } else if (roll <= 85) {
        return {
          type: 'tactical_complication',
          severity: 'low',
          hpDelta: 0,
          description: 'Неудобная позиция и лишний шум под ногами.',
          narrativeDirective: 'УРОН: 0 HP. Персонаж оступился или создал лишний шум, привлекая настороженные взгляды.',
        };
      } else {
        return {
          type: 'social_backfire',
          severity: 'low',
          hpDelta: 0,
          description: 'Враг или свидетель насмехается над неудачной попыткой.',
          narrativeDirective: 'УРОН: 0 HP. Опиши саркастическую реакцию или презрительный взгляд оппонента.',
        };
      }
    }

    if (threat === 'moderate') {
      // 20% mild_setback, 30% tactical_complication (prone/pinned), 20% gear_mishap, 30% damage_hp
      if (roll <= 20) {
        return {
          type: 'mild_setback',
          severity: 'moderate',
          hpDelta: 0,
          description: 'Чистый уворот: герой вовремя отпрянул, челюсти или клинок противника рассекли лишь воздух.',
          narrativeDirective: 'УРОН: 0 HP. Персонаж чудом избежал удара в последний момент благодаря быстрой реакции. Никаких ран!',
        };
      } else if (roll <= 50) {
        const isProne = roll <= 35;
        const conditionAdded = isProne ? 'prone' : undefined;
        const desc = isProne
          ? 'Повален на землю (Prone)! Мощный толчок сбил персонажа с ног.'
          : 'Зажат в угол: противник нависает, блокируя свободное перемещение.';
        return {
          type: 'tactical_complication',
          severity: 'moderate',
          hpDelta: 0,
          conditionAdded,
          description: desc,
          narrativeDirective: `УРОН: 0 HP. Но тактическая позиция ухудшилась: ${desc}. Опиши потерю равновесия или зажатость у препятствия.`,
        };
      } else if (roll <= 70) {
        const gearDesc = 'Оружие выскользнуло из рук в грязь или застряло в препятствии.';
        return {
          type: 'gear_mishap',
          severity: 'moderate',
          hpDelta: 0,
          description: gearDesc,
          narrativeDirective: `УРОН: 0 HP. Осложнение со снаряжением: ${gearDesc}. Герою придется потратить движение, чтобы поднять или высвободить его.`,
        };
      } else {
        const dmg = crypto.randomInt(3, 7);
        return {
          type: 'damage_hp',
          severity: 'moderate',
          hpDelta: -dmg,
          description: `Встречный выпад «${targetName}»: герой получает ${dmg} урона.`,
          narrativeDirective: `ВСТРЕЧНЫЙ УРОН: «${targetName}» молниеносно контратакует и наносит ровно ${dmg} HP урона! Опиши укус, когти или секущий удар.`,
        };
      }
    }

    // High or Deadly Threat
    // 10% mild_setback, 30% severe condition, 60% heavy damage
    if (roll <= 10) {
      return {
        type: 'mild_setback',
        severity: threat,
        hpDelta: 0,
        description: 'Чудесное спасение на волоске от смертоносного выпада.',
        narrativeDirective: 'УРОН: 0 HP. Герой чудом разминулся со смертельным ударом, почувствовав лишь свист стали или дыхание твари.',
      };
    } else if (roll <= 40) {
      const conditionAdded = roll <= 25 ? 'stunned' : 'restrained';
      const condLabel = conditionAdded === 'stunned' ? 'Оглушён (Stunned)' : 'Обездвижен (Restrained)';
      return {
        type: 'tactical_complication',
        severity: threat,
        hpDelta: 0,
        conditionAdded,
        description: `Критическое осложнение: персонаж ${condLabel}!`,
        narrativeDirective: `УРОН ЗДОРОВЬЮ: 0 HP. Но персонаж ${condLabel}! Враг навалился всей массой или оглушил мощным ударом. Герой временно обездвижен!`,
      };
    } else {
      const d1 = crypto.randomInt(1, 7);
      const d2 = crypto.randomInt(1, 7);
      const dmg = d1 + d2 + 3;
      return {
        type: 'damage_hp',
        severity: threat,
        hpDelta: -dmg,
        description: `Тяжёлое ранение от смертоносной атаки «${targetName}»: -${dmg} HP.`,
        narrativeDirective: `ТЯЖЁЛЫЙ УРОН: «${targetName}» сокрушительно пробивает оборону, нанося ${dmg} HP урона! Опиши глубокую рану, кровь и боль.`,
      };
    }
  }

  /**
   * Resolves Beast Pacification with Anti-IMBA progression and Willpower mechanics.
   */
  private resolvePacificationAction(
    action: TurnActionEntity,
    character: CharacterEntity | undefined,
    currentEnemies: RoomEnemy[],
    currentNPCs: RoomNPC[],
    roomDC: number
  ): MechanicalResolution {
    const targetInfo = this.findTarget(action, currentEnemies, currentNPCs);
    const target = targetInfo?.target || currentEnemies.find(e => !e.isDead && e.hpCurrent > 0) || null;

    const leverage = this.evaluateLeverage(action.actionText, character, target);
    const d20Roll = action.diceRolls && action.diceRolls.length > 0 ? action.diceRolls[0] : null;
    const baseRollTotal = d20Roll?.total ?? 10;
    const isCritSuccess = !!d20Roll?.isCriticalSuccess;
    const isCritFail = !!d20Roll?.isCriticalFail;

    const effectiveRoll = isCritSuccess ? baseRollTotal : Math.max(1, baseRollTotal + leverage.bonus);
    const isSuccess = !isCritFail && (isCritSuccess || effectiveRoll >= roomDC);

    const wpBefore = target?.willpower ?? 80;
    let wpAfter = wpBefore;
    let stage: 'resisted' | 'hesitation' | 'pacified' | 'tamed_or_docile' = 'resisted';

    const consumedItems: ConsumedItemRecord[] = [];
    if (leverage.consumedFoodItem) {
      consumedItems.push({
        itemId: leverage.consumedFoodItem.id,
        itemName: leverage.consumedFoodItem.name,
        quantity: 1,
        reason: `Скормлено существу (${target?.name || 'зверь'}) для умиротворения`,
      });
    }

    let promptDirective = '';
    let auditNotes = '';
    let targetUpdate: MechanicalTargetUpdate | undefined;
    let failureConsequence: FailureConsequence | undefined;

    if (isSuccess) {
      let erosion = 20 + Math.max(0, (effectiveRoll - roomDC) * 3) + leverage.willpowerDamagePercent;
      if (isCritSuccess) erosion = Math.max(60, erosion + 30);
      wpAfter = Math.max(0, wpBefore - erosion);

      if (isCritSuccess && leverage.consumedFoodItem) {
        stage = 'tamed_or_docile';
      } else if (wpAfter <= 25 || leverage.consumedFoodItem) {
        stage = 'pacified';
      } else {
        stage = 'hesitation';
      }

      const targetName = target?.name || 'Существо';

      if (stage === 'hesitation') {
        promptDirective = `⚖️ МЕХАНИЧЕСКИЙ АРБИТР (УМИРОТВОРЕНИЕ — ЭТАП 1: КОЛЕБАНИЕ):
- Результат проверки: ЧАСТИЧНЫЙ УСПЕХ (${effectiveRoll} vs СЛ ${roomDC}). Воля цели снижена: ${wpBefore}% -> ${wpAfter}%.
- Применённые рычаги: ${leverage.appliedLeverage.join('; ')}.
- 🛑 АНТИ-ИМБА ОГРАНИЧЕНИЕ: ${targetName} НЕ СТАЛ МИРНЫМ И НЕ ПОКОРИЛСЯ!
- Зверь опешил, затормозил выпад, утробно рычит и принюхивается, не спуская глаз с персонажа.
- ТАКТИЧЕСКИЙ ЭФФЕКТ: ${targetName} ПРОПУСКАЕТ АТАКУ В ЭТОМ ХОДЕ (выжидает следующего шага героя).
- 🛑 КАТЕГОРИЧЕСКИ ЗАПРЕЩЕНО наносить урон существу оружием в этом ходе! Это мирная попытка.`;

        auditNotes = `Умиротворение: ${action.characterName} vs ${targetName}. Бросок: ${effectiveRoll} vs СЛ ${roomDC}. Воля: ${wpBefore}% -> ${wpAfter}%. Итог: КОЛЕБАНИЕ (пропуск атаки зверя).`;

        if (target) {
          targetUpdate = {
            targetId: target.id,
            targetName: target.name,
            targetType: targetInfo?.type || 'enemy',
            hpBefore: target.hpCurrent,
            hpAfter: target.hpCurrent,
            damage: 0,
            isDead: false,
            newStatus: `Опешил и колеблется (Воля: ${wpAfter}%), выжидает`,
            willpowerAfter: wpAfter,
          };
        }
      } else if (stage === 'pacified') {
        promptDirective = `⚖️ МЕХАНИЧЕСКИЙ АРБИТР (УСПЕШНОЕ УМИРОТВОРЕНИЕ / ДЕЭСКАЛАЦИЯ):
- Результат: ПОЛНЫЙ УСПЕХ (${effectiveRoll} vs СЛ ${roomDC}). Воля цели сломлена: ${wpBefore}% -> ${wpAfter}%.
- Применённые рычаги: ${leverage.appliedLeverage.join('; ')}.
- ${targetName} принимает пищу / видит отсутствие угрозы и прекращает вражду! Зверь отступает в укрытие или ложится на безопасном расстоянии.
- 🛑 БОЙ ОКОНЧЕН МИРОМ: Существо больше не нападает на отряд. Урон оружием НЕ наносился!`;

        auditNotes = `Умиротворение: ${action.characterName} успешно деэскалировал ${targetName} (${effectiveRoll} vs СЛ ${roomDC}). Воля: ${wpBefore}% -> ${wpAfter}%. Зверь мирно отступает.`;

        if (target) {
          targetUpdate = {
            targetId: target.id,
            targetName: target.name,
            targetType: targetInfo?.type || 'enemy',
            hpBefore: target.hpCurrent,
            hpAfter: target.hpCurrent,
            damage: 0,
            isDead: false,
            newStatus: `Умиротворён / Утратил агрессию (Воля: ${wpAfter}%)`,
            willpowerAfter: wpAfter,
          };
        }
      } else {
        // tamed_or_docile
        promptDirective = `⚖️ МЕХАНИЧЕСКИЙ АРБИТР (КРИТИЧЕСКИЙ ТРИУМФ — ПРИРУЧЕНИЕ):
- Результат: КРИТИЧЕСКИЙ УСПЕХ (Нат 20 + угощение). Воля зверя полностью подчинена доверию (Воля: 0%).
- ${targetName} берет пищу с рук, признает силу духа героя и проявляет привязанность.
- Никакого вреда существу не нанесено.`;

        auditNotes = `Крит. успех приручения ${targetName} с угощением.`;

        if (target) {
          targetUpdate = {
            targetId: target.id,
            targetName: target.name,
            targetType: targetInfo?.type || 'enemy',
            hpBefore: target.hpCurrent,
            hpAfter: target.hpCurrent,
            damage: 0,
            isDead: false,
            newStatus: `Приручен / Доверяет герою (Воля: 0%)`,
            willpowerAfter: 0,
          };
        }
      }
    } else {
      stage = 'resisted';
      wpAfter = Math.min(100, wpBefore + (isCritFail ? 15 : 5));
      failureConsequence = this.generateFailureConsequence(action, character, target, roomDC, isCritFail);

      promptDirective = `⚖️ МЕХАНИЧЕСКИЙ АРБИТР (ПРОВАЛ УМИРОТВОРЕНИЯ):
- Проверка: ПРОВАЛ (${effectiveRoll} vs СЛ ${roomDC}${isCritFail ? ', КРИТ 1!' : ''}).
- Воля зверя непоколебима (${wpBefore}% -> ${wpAfter}%). ${target?.name || 'Зверь'} счел жест слабостью или ощетинился!
- ⚡ ПРОЦЕДУРНОЕ ПОСЛЕДСТВИЕ ПРОВАЛА:
  ↳ Тип: ${failureConsequence.type}
  ↳ Описание: ${failureConsequence.description}
  ↳ Урон здоровью героя: ${failureConsequence.hpDelta} HP.
  ${failureConsequence.conditionAdded ? `↳ Наложенное состояние: ${failureConsequence.conditionAdded}` : ''}
- 🛑 ТРЕБОВАНИЕ МАСТЕРУ: ${failureConsequence.narrativeDirective}`;

      auditNotes = `Провал умиротворения ${target?.name || 'существа'}. Бросок: ${effectiveRoll} vs СЛ ${roomDC}. Последствие: ${failureConsequence.type} (${failureConsequence.description}).`;
    }

    return {
      actionId: action.id,
      characterId: action.characterId,
      characterName: action.characterName,
      actionType: 'pacify',
      consumedItems,
      targetUpdate,
      failureConsequence,
      pacificationOutcome: {
        targetId: target?.id || 'target',
        targetName: target?.name || 'Существо',
        willpowerBefore: wpBefore,
        willpowerAfter: wpAfter,
        willpowerDelta: wpAfter - wpBefore,
        stage,
        leverageApplied: leverage.appliedLeverage,
        newStatus: targetUpdate?.newStatus || 'Агрессивен',
        promptDirective,
      },
      promptDirective,
      auditNotes,
    };
  }

  /**
   * Resolves negotiation / persuasion with intelligent NPCs or humanoid foes.
   */
  private resolveSocialNegotiationAction(
    action: TurnActionEntity,
    character: CharacterEntity | undefined,
    currentEnemies: RoomEnemy[],
    currentNPCs: RoomNPC[],
    roomDC: number
  ): MechanicalResolution {
    const targetInfo = this.findTarget(action, currentEnemies, currentNPCs);
    const target = targetInfo?.target || currentEnemies.find(e => !e.isDead && e.hpCurrent > 0) || null;

    const d20Roll = action.diceRolls && action.diceRolls.length > 0 ? action.diceRolls[0] : null;
    const total = d20Roll?.total ?? 10;
    const isCritSuccess = !!d20Roll?.isCriticalSuccess;
    const isCritFail = !!d20Roll?.isCriticalFail;
    const isSuccess = !isCritFail && (isCritSuccess || total >= roomDC);

    const wpBefore = target?.willpower ?? 70;
    let wpAfter = wpBefore;
    let failureConsequence: FailureConsequence | undefined;
    let targetUpdate: MechanicalTargetUpdate | undefined;

    const targetName = target?.name || 'Оппонент';

    if (isSuccess) {
      const erosion = isCritSuccess ? 50 : 25 + Math.max(0, (total - roomDC) * 2);
      wpAfter = Math.max(0, wpBefore - erosion);

      const directive = `⚖️ МЕХАНИЧЕСКИЙ АРБИТР (ПЕРЕГОВОРЫ):
- Результат: УСПЕХ (${total} vs СЛ ${roomDC}${isCritSuccess ? ', КРИТ 20!' : ''}).
- Воля «${targetName}» к сопротивлению снижена: ${wpBefore}% -> ${wpAfter}%.
- Аргументы подействовали: оппонент готов слушать условия, снижает градус агрессии или соглашается на сделку.`;

      if (target) {
        targetUpdate = {
          targetId: target.id,
          targetName: target.name,
          targetType: targetInfo?.type || 'enemy',
          hpBefore: target.hpCurrent,
          hpAfter: target.hpCurrent,
          damage: 0,
          isDead: false,
          newStatus: wpAfter <= 20 ? 'Сложил оружие / Готов к диалогу' : `Колеблется в споре (Воля: ${wpAfter}%)`,
          willpowerAfter: wpAfter,
        };
      }

      return {
        actionId: action.id,
        characterId: action.characterId,
        characterName: action.characterName,
        actionType: 'social',
        targetUpdate,
        consumedItems: [],
        promptDirective: directive,
        auditNotes: `Переговоры с ${targetName}: УСПЕХ (${total} vs СЛ ${roomDC}). Воля: ${wpBefore}% -> ${wpAfter}%.`,
      };
    } else {
      wpAfter = Math.min(100, wpBefore + 10);
      failureConsequence = this.generateFailureConsequence(action, character, target, roomDC, isCritFail);

      const directive = `⚖️ МЕХАНИЧЕСКИЙ АРБИТР (ПРОВАЛ ПЕРЕГОВОРОВ):
- Результат: ПРОВАЛ (${total} vs СЛ ${roomDC}${isCritFail ? ', КРИТ 1!' : ''}).
- «${targetName}» непреклонен (Воля: ${wpAfter}%). Аргументы отвергнуты или сочтены за оскорбление!
- ⚡ ПОСЛЕДСТВИЕ ПРОВАЛА: ${failureConsequence.description}
- 🛑 ТРЕБОВАНИЕ МАСТЕРУ: ${failureConsequence.narrativeDirective}`;

      return {
        actionId: action.id,
        characterId: action.characterId,
        characterName: action.characterName,
        actionType: 'social',
        targetUpdate,
        consumedItems: [],
        failureConsequence,
        promptDirective: directive,
        auditNotes: `Переговоры с ${targetName}: ПРОВАЛ (${total} vs СЛ ${roomDC}). Последствие: ${failureConsequence.type}.`,
      };
    }
  }

  /**
   * Resolves defensive stance, dodge or parry action.
   */
  private resolveDefensiveGuardAction(
    action: TurnActionEntity,
    character: CharacterEntity | undefined,
    currentEnemies: RoomEnemy[],
    currentNPCs: RoomNPC[],
    roomDC: number
  ): MechanicalResolution {
    const d20Roll = action.diceRolls && action.diceRolls.length > 0 ? action.diceRolls[0] : null;
    const total = d20Roll?.total ?? 10;
    const isSuccess = total >= roomDC;

    const directive = isSuccess
      ? `⚖️ МЕХАНИЧЕСКИЙ АРБИТР (ГЛУХАЯ ЗАЩИТА / УКЛОНЕНИЕ):
- Результат: УСПЕШНО (${total} vs СЛ ${roomDC}).
- Герой занял устойчивую глухую стойку, укрылся щитом или приготовился к встречному парированию.
- Урон в этом раунде по герою снижается или блокируется щитом.`
      : `⚖️ МЕХАНИЧЕСКИЙ АРБИТР (НЕУДАЧНАЯ ЗАЩИТА):
- Результат: ПРОВАЛ стойки (${total} vs СЛ ${roomDC}).
- Нога соскользнула, щит повело в сторону. Герой открыт для встречного выпада.`;

    const failureConsequence = isSuccess ? undefined : this.generateFailureConsequence(action, character, null, roomDC, !!d20Roll?.isCriticalFail);

    return {
      actionId: action.id,
      characterId: action.characterId,
      characterName: action.characterName,
      actionType: 'defense',
      consumedItems: [],
      failureConsequence,
      promptDirective: isSuccess ? directive : `${directive}\n⚡ ПОСЛЕДСТВИЕ: ${failureConsequence?.description}`,
      auditNotes: `Защитная стойка: ${isSuccess ? 'УСПЕХ' : 'ПРОВАЛ'} (${total} vs СЛ ${roomDC}).`,
    };
  }

  /**
   * Resolves healing action (potion / bandage / spell)
   */
  /**
   * Resolves healing action (potion / bandage / spell).
   * Validates speech vs action, inventory & item ledger availability, and prevents phantom healing.
   */
  private resolveHealingAction(
    action: TurnActionEntity,
    character: CharacterEntity | undefined,
    currentEnemies: RoomEnemy[],
    currentNPCs: RoomNPC[]
  ): MechanicalResolution {
    const actionLower = action.actionText.toLowerCase();
    const speech = this.extractSpeechAndAction(action.actionText);

    // 1. Resolve Target (speech address, 2nd-person pronouns, explicit target or keywords)
    let targetName = character?.name || action.characterName;
    let targetType: 'self' | 'npc' | 'enemy' = 'self';
    let targetEntity: RoomNPC | RoomEnemy | undefined;

    // Check if target was found via findTarget (which handles addressed names & ids)
    const foundTarget = this.findTarget(action, currentEnemies, currentNPCs);
    if (foundTarget) {
      targetName = foundTarget.target.name;
      targetType = foundTarget.type;
      targetEntity = foundTarget.target;
    } else if (speech.hasSecondPersonAddress) {
      // Addressed in 2nd person ("ТЕБЯ", "ВАС", "ТЫ") -> target is not self!
      if (speech.addressedTargetName) {
        const addr = speech.addressedTargetName.toLowerCase();
        const e = currentEnemies.find(x => x.name.toLowerCase().includes(addr) || addr.includes(x.name.toLowerCase()));
        if (e) {
          targetName = e.name;
          targetType = 'enemy';
          targetEntity = e;
        } else {
          const n = currentNPCs.find(x => x.name.toLowerCase().includes(addr) || addr.includes(x.name.toLowerCase()));
          if (n) {
            targetName = n.name;
            targetType = 'npc';
            targetEntity = n;
          }
        }
      }
      // If still not identified but there are NPCs/enemies present, choose the first prominent NPC/enemy
      if (!targetEntity) {
        if (currentNPCs.length > 0) {
          targetName = currentNPCs[0].name;
          targetType = 'npc';
          targetEntity = currentNPCs[0];
        } else if (currentEnemies.length > 0) {
          targetName = currentEnemies[0].name;
          targetType = 'enemy';
          targetEntity = currentEnemies[0];
        }
      }
    } else {
      // Keyword matching across NPCs and Enemies
      for (const npc of currentNPCs) {
        const nLower = (npc.name || '').toLowerCase();
        const rLower = (npc.role || '').toLowerCase();
        if (
          (nLower && actionLower.includes(nLower)) ||
          (rLower.length > 3 && actionLower.includes(rLower)) ||
          actionLower.includes('ранен') ||
          actionLower.includes('гонц') ||
          actionLower.includes('купц') ||
          actionLower.includes('союзник')
        ) {
          targetName = npc.name;
          targetType = 'npc';
          targetEntity = npc;
          break;
        }
      }
      if (!targetEntity) {
        for (const e of currentEnemies) {
          const eLower = (e.name || '').toLowerCase();
          if (eLower && actionLower.includes(eLower)) {
            targetName = e.name;
            targetType = 'enemy';
            targetEntity = e;
            break;
          }
        }
      }
    }

    // 2. Item & Ledger Verification (Catches phantom potions)
    const availablePotions = (character?.inventory || []).filter(i => {
      if (!i) return false;
      const isPotionType = i.type === 'potion' || i.name.toLowerCase().includes('зелье') || ((i.healAmount || 0) > 0);
      if (!isPotionType) return false;
      if (character && itemLedgerRepository) {
        return itemLedgerRepository.isItemAvailable(character.id, i.id);
      }
      return true;
    });

    const potion = availablePotions[0];

    // If character does NOT have an available potion
    if (!potion) {
      const directive = `⚖️ МЕХАНИЧЕСКИЙ АРБИТР: У персонажа ${character?.name || action.characterName} НЕТ доступного зелья исцеления (оно разбито, израсходовано или отсутствует в рюкзаке). Предмет НЕ МОЖЕТ быть применено! Исцеление не состоялось (+0 HP). Персонаж лишь обнаруживает пустой подсумок, осколки склянки или тратит время впустую.`;
      return {
        actionId: action.id,
        characterId: character?.id || action.characterId,
        characterName: character?.name || action.characterName,
        actionType: 'heal',
        healRolled: 0,
        consumedItems: [],
        promptDirective: directive,
        auditNotes: `Попытка исцеления без доступного зелья: предмет отсутствует в инвентаре или разбит/израсходован в ItemLedger. +0 HP.`,
      };
    }

    // 3. Roll healing amount
    let healAmount = potion.healAmount || 0;
    let healFormula = '2d4 + 2';
    if (!healAmount || healAmount <= 0) {
      const d1 = crypto.randomInt(1, 5);
      const d2 = crypto.randomInt(1, 5);
      healAmount = d1 + d2 + 2;
    }

    const consumedItems: ConsumedItemRecord[] = [{
      itemId: potion.id,
      itemName: potion.name,
      quantity: 1,
      reason: `Использовано для исцеления (${targetName})`,
    }];

    let targetUpdate: MechanicalTargetUpdate | undefined;
    if ((targetType === 'npc' || targetType === 'enemy') && targetEntity) {
      const hpBefore = targetEntity.hpCurrent;
      const hpAfter = Math.min(targetEntity.hpMax, hpBefore + healAmount);
      targetUpdate = {
        targetId: targetEntity.id,
        targetName: targetEntity.name,
        targetType,
        hpBefore,
        hpAfter,
        damage: 0,
        isDead: false,
        newStatus: `Восстановил силы благодаря зелью (+${healAmount} HP). Отношение улучшено.`,
      };
    }

    const isSelfHeal = targetType === 'self';
    const effectiveSelfHeal = isSelfHeal ? healAmount : 0;

    const directive = `⚖️ МЕХАНИЧЕСКИЙ АРБИТР: Применено зелье «${potion.name}». Восстановлено +${healAmount} HP для ${targetName}. ${isSelfHeal ? 'Раны персонажа затягиваются.' : `Зелье передано / влито ${targetName}, его состояние стабилизируется.`} Предмет «${potion.name}» израсходован из рюкзака.`;

    return {
      actionId: action.id,
      characterId: character?.id || action.characterId,
      characterName: character?.name || action.characterName,
      actionType: 'heal',
      healRolled: effectiveSelfHeal,
      targetUpdate,
      consumedItems,
      promptDirective: directive,
      auditNotes: `Исцеление: ${targetName} получил +${healAmount} HP (${healFormula}). Предмет: ${potion.name}. Инициатор получил: +${effectiveSelfHeal} HP.`,
    };
  }

  /**
   * Resolves combat attack: Hit vs AC, procedural weapon damage, HP clamping, anti-oneshot directive.
   */
  private resolveCombatAttack(
    action: TurnActionEntity,
    character: CharacterEntity | undefined,
    currentEnemies: RoomEnemy[],
    currentNPCs: RoomNPC[],
    knownTarget: { target: RoomEnemy | RoomNPC; type: 'enemy' | 'npc' } | null
  ): MechanicalResolution {
    const d20Roll = action.diceRolls && action.diceRolls.length > 0 ? action.diceRolls[0] : null;
    const targetInfo = knownTarget || this.findTarget(action, currentEnemies, currentNPCs);

    let target = targetInfo?.target;
    let targetType = targetInfo?.type || 'enemy';

    if (!target) {
      const actionLower = action.actionText.toLowerCase();
      let derivedName = action.targetEnemyName || 'Противник';
      let derivedHp = 20;
      let derivedAc = 13;

      if (actionLower.includes('капитан') || actionLower.includes('командир') || actionLower.includes('вожак')) {
        derivedName = 'Капитан стражи';
        derivedHp = 32;
        derivedAc = 15;
      } else if (actionLower.includes('страж')) {
        derivedName = 'Городской стражник';
        derivedHp = 18;
        derivedAc = 14;
      } else if (actionLower.includes('разбойник') || actionLower.includes('бандит')) {
        derivedName = 'Опытный разбойник';
        derivedHp = 22;
        derivedAc = 13;
      } else if (actionLower.includes('ящер') || actionLower.includes('варан')) {
        derivedName = 'Исполинский ящер';
        derivedHp = 28;
        derivedAc = 13;
      } else if (actionLower.includes('гоблин')) {
        derivedName = 'Гоблин-налётчик';
        derivedHp = 10;
        derivedAc = 12;
      }

      target = {
        id: `enemy_${crypto.randomUUID().slice(0, 8)}`,
        name: derivedName,
        type: 'minion',
        hpCurrent: derivedHp,
        hpMax: derivedHp,
        ac: derivedAc,
        status: 'Вступил в бой',
        isDead: false,
        willpower: 75,
      };
      targetType = 'enemy';
    }

    const targetAc = target.ac || 12;
    const rollTotal = d20Roll?.total ?? 10;
    const isCritSuccess = !!d20Roll?.isCriticalSuccess;
    const isCritFail = !!d20Roll?.isCriticalFail;

    const isHit = !isCritFail && (isCritSuccess || rollTotal >= targetAc);

    if (!isHit) {
      const missReason = isCritFail
        ? 'Критический промах (d20=1)'
        : `Промах (Бросок ${rollTotal} vs КБ ${targetAc})`;

      let failureConsequence: FailureConsequence | undefined;
      if (isCritFail) {
        failureConsequence = this.generateFailureConsequence(action, character, target, targetAc, true);
      }

      const directive = `⚖️ МЕХАНИЧЕСКИЙ АРБИТР: Атака ПРОМАХНУЛАСЬ (${rollTotal} vs КБ ${targetAc} цели «${target.name}»). Урон цели: 0 HP. Цель ${target.name} уклонилась или отразила выпад доспехом/щитом. Никакого вреда цели не нанесено.${failureConsequence ? `\n⚡ ПОСЛЕДСТВИЕ КРИТИЧЕСКОГО ПРОМАХА: ${failureConsequence.description}` : ''}`;

      return {
        actionId: action.id,
        characterId: action.characterId,
        characterName: action.characterName,
        actionType: 'attack',
        isHit: false,
        damageRolled: 0,
        consumedItems: [],
        failureConsequence,
        promptDirective: directive,
        auditNotes: `${action.characterName} атаковал ${target.name}: ${missReason}. Урон: 0.${failureConsequence ? ` Последствие: ${failureConsequence.type}.` : ''}`,
      };
    }

    // Attack HIT! Procedural weapon damage
    const { damageTotal, formula, rolls } = this.calculateWeaponDamage(character, action.actionText, isCritSuccess);

    const hpBefore = target.hpCurrent;
    const hpAfter = Math.max(0, hpBefore - damageTotal);
    const isDead = hpAfter <= 0;

    // Damage also damages enemy willpower
    const wpBefore = target.willpower ?? 80;
    const wpDamage = Math.round((damageTotal / target.hpMax) * 60) + (isCritSuccess ? 20 : 0);
    const wpAfter = Math.max(0, wpBefore - wpDamage);

    const newStatus = isDead
      ? 'Повержен в бою / Мёртв'
      : hpAfter <= target.hpMax * 0.3
      ? `Тяжело ранен, на пределе сил (${hpAfter}/${target.hpMax} HP, Воля: ${wpAfter}%)`
      : `Ранен, продолжает яростное сопротивление (${hpAfter}/${target.hpMax} HP, Воля: ${wpAfter}%)`;

    const targetUpdate: MechanicalTargetUpdate = {
      targetId: target.id,
      targetName: target.name,
      targetType,
      hpBefore,
      hpAfter,
      damage: damageTotal,
      isDead,
      newStatus,
      willpowerAfter: wpAfter,
    };

    let directive = '';
    if (!isDead) {
      directive = `⚖️ МЕХАНИЧЕСКИЙ АРБИТР:
- Результат атаки: ПОПАДАНИЕ (${rollTotal} vs КБ ${targetAc}).
- Процедурный урон оружия: ${damageTotal} (Бросок: ${formula} = [${rolls.join('+')}]).
- Состояние цели: У «${target.name}» осталось ${hpAfter}/${target.hpMax} HP (Воля: ${wpAfter}%).
- 🛑 СТРОГОЕ ТРЕБОВАНИЕ МАСТЕРУ: Цель «${target.name}» ЖИВА И ОСТАЁТСЯ В СТРОЮ!
- КАТЕГОРИЧЕСКИ ЗАПРЕЩЕНО описывать смерть, обезглавливание или вывод ${target.name} из строя в этом ходе!
- Опиши сочный удар, звон рассечённого доспеха или кровь, но покажи стойкость и яростную контратаку противника!`;
    } else {
      directive = `⚖️ МЕХАНИЧЕСКИЙ АРБИТР:
- Результат атаки: СМЕРТЕЛЬНОЕ ПОПАДАНИЕ (${rollTotal} vs КБ ${targetAc})!
- Процедурный урон оружия: ${damageTotal} (Бросок: ${formula} = [${rolls.join('+')}]).
- Состояние цели: Урон ${damageTotal} добил оставшиеся ${hpBefore} HP цели «${target.name}».
- Цель «${target.name}» ПОВЕРЖЕНА (0/${target.hpMax} HP). Опиши зрелищный добивающий удар.`;
    }

    return {
      actionId: action.id,
      characterId: action.characterId,
      characterName: action.characterName,
      actionType: 'attack',
      isHit: true,
      damageRolled: damageTotal,
      damageFormula: formula,
      damageRolls: rolls,
      targetUpdate,
      consumedItems: [],
      promptDirective: directive,
      auditNotes: `Атака по «${target.name}»: ПОПАДАНИЕ (${rollTotal} vs КБ ${targetAc}). Урон: ${damageTotal} (${formula}). HP цели: ${hpBefore} -> ${hpAfter}/${target.hpMax}. Воля: ${wpBefore}% -> ${wpAfter}%.`,
    };
  }

  /**
   * Resolves general skill check or saving throw with procedural failure consequences.
   */
  private resolveGeneralCheckOrSave(
    action: TurnActionEntity,
    character: CharacterEntity | undefined,
    target: RoomEnemy | RoomNPC | null,
    roomDC: number
  ): MechanicalResolution {
    const roll = action.diceRolls && action.diceRolls.length > 0 ? action.diceRolls[0] : null;
    const total = roll?.total ?? 10;
    const isCrit = !!roll?.isCriticalSuccess;
    const isFail = !!roll?.isCriticalFail;
    const isSuccess = !isFail && (isCrit || total >= roomDC);

    let failureConsequence: FailureConsequence | undefined;
    if (!isSuccess) {
      failureConsequence = this.generateFailureConsequence(action, character, target, roomDC, isFail);
    }

    let standUpDirective = '';
    const standUpRegex = /(вста(ю|ть|л|ла|ли|ем|йте)|поднима(юсь|ется|ться|лась|лся|лись)|на ноги|отряхива(юсь|ется|ясь|лась|лся)|подня(лся|лась|лись)|выпрям(ился|илась|иться))/i;
    if (isSuccess && character?.conditions?.includes('prone') && standUpRegex.test(action.actionText || '')) {
      standUpDirective = `\n🏃 [СНЯТИЕ СОСТОЯНИЯ «НИЧКОМ»]: Герой ${character.name} успешно поднимается с земли. ОБЯЗАТЕЛЬНО сними состояние 'prone' ("conditionUpdates": [{"targetId": "${character.id}", "targetName": "${character.name}", "action": "remove", "condition": "prone", "reason": "Встал на ноги"}])!`;
    }

    const directive = isSuccess
      ? `⚖️ МЕХАНИЧЕСКИЙ АРБИТР: Проверка УСПЕШНА (${total} vs СЛ ${roomDC}${isCrit ? ', КРИТ 20!' : ''}). Задуманное действие полностью удается.${standUpDirective}`
      : `⚖️ МЕХАНИЧЕСКИЙ АРБИТР: Проверка ПРОВАЛЕНА (${total} vs СЛ ${roomDC}${isFail ? ', КРИТ 1!' : ''}).
⚡ ПОСЛЕДСТВИЕ ПРОВАЛА: ${failureConsequence?.description}
🛑 ТРЕБОВАНИЕ МАСТЕРУ: ${failureConsequence?.narrativeDirective}`;

    return {
      actionId: action.id,
      characterId: action.characterId,
      characterName: action.characterName,
      actionType: action.actionType || 'check',
      consumedItems: [],
      failureConsequence,
      promptDirective: directive,
      auditNotes: `Проверка: ${action.characterName} выбросил ${total} vs СЛ ${roomDC}. Итог: ${isSuccess ? 'УСПЕХ' : `ПРОВАЛ (${failureConsequence?.type})`}.`,
    };
  }

  /**
   * Calculates procedural weapon damage based on character's equipped/active weapon
   * and relevant stat modifier, doubling dice on Nat 20.
   */
  private calculateWeaponDamage(
    character: CharacterEntity | undefined,
    actionText: string,
    isCrit: boolean
  ): { damageTotal: number; formula: string; rolls: number[] } {
    if (!character) {
      const d = crypto.randomInt(1, 7);
      return { damageTotal: d, formula: '1d6', rolls: [d] };
    }

    const inventory = character.inventory || [];
    let weapon = inventory.find(i => i && i.id === character.activeWeaponId);
    if (!weapon) {
      weapon = inventory.find(i => i && i.type === 'weapon');
    }

    const actLower = actionText.toLowerCase();
    for (const item of inventory) {
      if (item && item.type === 'weapon' && actLower.includes(item.name.toLowerCase().trim())) {
        weapon = item;
        break;
      }
    }

    let diceCount = 1;
    let diceSides = 6;
    let explicitBonus = 0;

    const rawDamage = weapon?.damage?.trim().toLowerCase() || '1d8';
    const match = rawDamage.match(/^(\d*)d(\d+)(?:\s*\+\s*(\d+))?$/);
    if (match) {
      diceCount = match[1] ? parseInt(match[1], 10) : 1;
      diceSides = parseInt(match[2], 10);
      if (match[3]) explicitBonus = parseInt(match[3], 10);
    }

    diceCount = Math.min(Math.max(1, diceCount), 6);
    diceSides = Math.min(Math.max(4, diceSides), 20);

    const effectiveDiceCount = isCrit ? diceCount * 2 : diceCount;

    const isFinesseOrRanged = /(лук|арбалет|кинжал|рапир|кортик|шпага|дротик|bow|dagger|rapier|crossbow)/i.test(weapon?.name || rawDamage);
    const statKey = isFinesseOrRanged ? 'dex' : 'str';
    const statScore = character.stats?.[statKey] || 10;
    const statMod = calculateModifier(statScore);

    const totalModifier = statMod + explicitBonus;

    const rolls: number[] = [];
    for (let i = 0; i < effectiveDiceCount; i++) {
      rolls.push(crypto.randomInt(1, diceSides + 1));
    }

    const diceSum = rolls.reduce((sum, val) => sum + val, 0);
    const damageTotal = Math.max(1, diceSum + totalModifier);

    const modSign = totalModifier >= 0 ? `+${totalModifier}` : `${totalModifier}`;
    const formula = `${effectiveDiceCount}d${diceSides}${totalModifier !== 0 ? ` ${modSign}` : ''}${isCrit ? ' (КРИТИЧЕСКИЙ УДАР)' : ''}`;

    return {
      damageTotal,
      formula,
      rolls,
    };
  }

  /**
   * Helper: checks if a target name indicates an animal, beast, or wild monster.
   */
  public isAnimalOrBeast(nameOrText: string): boolean {
    return /(ящер|волк|медвед|звер|собак|пес|лошад|конь|хищник|тварь|паук|змея|чудовищ|варан|геккон|вепрь|кабан)/i.test(nameOrText);
  }

  /**
   * Identifies target from action metadata, enemy list, or scene NPCs.
   */
  public findTarget(
    action: TurnActionEntity,
    enemies: RoomEnemy[],
    npcs: RoomNPC[]
  ): { target: RoomEnemy | RoomNPC; type: 'enemy' | 'npc' } | null {
    if (action.targetEnemyId) {
      const e = enemies.find(x => x.id === action.targetEnemyId);
      if (e) return { target: e, type: 'enemy' };
      const n = npcs.find(x => x.id === action.targetEnemyId);
      if (n) return { target: n, type: 'npc' };
    }

    if (action.targetEnemyName) {
      const nameLower = action.targetEnemyName.toLowerCase().trim();
      const e = enemies.find(x => x.name.toLowerCase().includes(nameLower) || nameLower.includes(x.name.toLowerCase()));
      if (e) return { target: e, type: 'enemy' };
      const n = npcs.find(x => x.name.toLowerCase().includes(nameLower) || nameLower.includes(x.name.toLowerCase()));
      if (n) return { target: n, type: 'npc' };
    }

    // Check extracted speech address (e.g. «бальтазар, ...»)
    const speech = this.extractSpeechAndAction(action.actionText);
    if (speech.addressedTargetName) {
      const addrLower = speech.addressedTargetName.toLowerCase();
      const e = enemies.find(x => x.name.toLowerCase().includes(addrLower) || addrLower.includes(x.name.toLowerCase()));
      if (e) return { target: e, type: 'enemy' };
      const n = npcs.find(x => x.name.toLowerCase().includes(addrLower) || addrLower.includes(x.name.toLowerCase()));
      if (n) return { target: n, type: 'npc' };
    }

    const actLower = action.actionText.toLowerCase();
    for (const e of enemies) {
      if (!e.isDead && e.hpCurrent > 0) {
        const eName = e.name.toLowerCase();
        if (actLower.includes(eName) || (eName.length >= 4 && actLower.includes(eName.slice(0, -1)))) {
          return { target: e, type: 'enemy' };
        }
      }
    }

    for (const n of npcs) {
      const nName = n.name.toLowerCase();
      const nRole = n.role.toLowerCase();
      if (
        (nName && actLower.includes(nName)) ||
        (nRole.length >= 4 && actLower.includes(nRole))
      ) {
        return { target: n, type: 'npc' };
      }
    }

    const livingEnemies = enemies.filter(e => !e.isDead && e.hpCurrent > 0);
    if (livingEnemies.length === 1 && (action.actionType === 'attack' || /(атак|удар|выстрел|рубл|ящер|враг|противник)/i.test(actLower))) {
      return { target: livingEnemies[0], type: 'enemy' };
    }

    return null;
  }

  /**
   * Resolves fleeing / retreating from combat according to D&D 5e mechanics.
   * If in combat, checks for Disengage action. If running without Disengage,
   * closest enemy takes an Opportunity Attack. Also requires Athletics / Acrobatics roll vs Escape DC.
   * If the check fails, Master is strictly instructed that enemies remain and combat continues.
   */
  private resolveFleeRetreatAction(
    action: TurnActionEntity,
    character: CharacterEntity | undefined,
    currentEnemies: RoomEnemy[],
    currentNPCs: RoomNPC[],
    roomDC: number
  ): MechanicalResolution {
    const livingEnemies = currentEnemies.filter(e => !e.isDead && e.hpCurrent > 0);
    const isInCombat = livingEnemies.length > 0;

    const d20Roll = action.diceRolls && action.diceRolls.length > 0 ? action.diceRolls[0] : null;
    const rollTotal = d20Roll?.total ?? 10;
    const isCritSuccess = !!d20Roll?.isCriticalSuccess;
    const isCritFail = !!d20Roll?.isCriticalFail;

    // If not in combat, player can freely relocate/retreat without threat
    if (!isInCombat) {
      return {
        actionId: action.id,
        characterId: action.characterId,
        characterName: action.characterName,
        actionType: 'check',
        consumedItems: [],
        promptDirective: `⚖️ МЕХАНИЧЕСКИЙ АРБИТР: Боевого столкновения нет. Персонаж «${action.characterName}» свободно отступает или меняет позицию.`,
        auditNotes: `Мирное перемещение/отход вне боя.`,
      };
    }

    // In active combat: D&D 5e Opportunity Attack & Escape Check
    const actTextLower = (action.actionText || '').toLowerCase();
    const isDisengage = /(отход|действие отход|осторожно отступа|прикрыва(ясь|юсь)|разорвать дистанцию|не подставля(ясь|юсь))/i.test(actTextLower);
    const escapeDC = Math.max(roomDC, 13);
    const isEscapeSuccess = !isCritFail && (isCritSuccess || rollTotal >= escapeDC);

    const closestEnemy = livingEnemies[0];
    let oppAttackHit = false;
    let oppDamage = 0;
    let failureConsequence: FailureConsequence | undefined;

    // Attack of Opportunity if no Disengage action declared
    if (!isDisengage) {
      const enemyHitBonus = Math.max(2, Math.floor((closestEnemy.ac || 12) / 3));
      const enemyRoll = crypto.randomInt(1, 21);
      const enemyTotal = enemyRoll + enemyHitBonus;
      const charAC = character?.ac || 12;

      if (enemyRoll === 20 || enemyTotal >= charAC) {
        oppAttackHit = true;
        oppDamage = crypto.randomInt(3, 8); // 1d6 + 2
        failureConsequence = {
          type: 'damage_hp',
          severity: 'moderate',
          hpDelta: -oppDamage,
          description: `Провоцированная атака в спину: ${closestEnemy.name} наносит ${oppDamage} урона по КБ ${charAC}`,
          narrativeDirective: `Ближайший противник «${closestEnemy.name}» совершает внеочередную провоцированную атаку по бегущему герою в спину! Нанеси -${oppDamage} HP урона в "playerUpdates".`,
        };
      }
    }

    let promptDirective = '';
    let auditNotes = '';

    if (!isEscapeSuccess) {
      // ESCAPE FAILED
      promptDirective = `⚖️ МЕХАНИЧЕСКИЙ АРБИТР (ПОПЫТКА БЕГСТВА ИЗ БОЯ ПРОВАЛЕНА):
- Проверка побега (Атлетика/Акробатика): ПРОВАЛ (${rollTotal} vs СЛ ${escapeDC}${isCritFail ? ', КРИТ 1!' : ''}).
${!isDisengage ? (oppAttackHit ? `- ⚠️ ПРОВОЦИРОВАННАЯ АТАКА (Opportunity Attack): Герой бежал без «Отхода»! «${closestEnemy.name}» наносит удар вдогонку (-${oppDamage} HP в "playerUpdates").` : `- Герой рванул без «Отхода», но выпад «${closestEnemy.name}» просвистел мимо.`) : `- Герой осторожно отходил действием «Отход», избежав ударов в спину.`}
- 🛑 СТРОЖАЙШИЙ ЗАПРЕТ МАСТЕРУ: КАТЕГОРИЧЕСКИ ЗАПРЕЩЕНО удалять врагов из "activeEnemies" или объявлять, что герой успешно сбежал!
- Противники настигли беглеца, перекрыли проход или зажали в угол. БОЙ ПРОДОЛЖАЕТСЯ! Враги остаются в "activeEnemies".`;

      auditNotes = `Провал побега: ${action.characterName} vs ${closestEnemy.name}. Бросок: ${rollTotal} vs СЛ ${escapeDC}. Провоцированная атака: ${oppAttackHit ? `ПОПАДАНИЕ (-${oppDamage} HP)` : 'промах'}. Враги удерживают бой.`;
    } else {
      // ESCAPE SUCCEEDED
      promptDirective = `⚖️ МЕХАНИЧЕСКИЙ АРБИТР (УСПЕШНЫЙ МАНЕВР РАЗРЫВА ДИСТАНЦИИ):
- Проверка побега (Атлетика/Акробатика): УСПЕХ (${rollTotal} vs СЛ ${escapeDC}${isCritSuccess ? ', КРИТ 20!' : ''}).
${!isDisengage && oppAttackHit ? `- ⚠️ Однако без действия «Отход» враг «${closestEnemy.name}» успел полоснуть вдогонку (-${oppDamage} HP в "playerUpdates")!` : ''}
- Герою удаётся разорвать контакт и оторваться от преследователей на безопасную дистанцию.
- Если остальные соратники ещё в бою — враги продолжают бой с отрядом. Враги не исчезают просто так!`;

      auditNotes = `Успешный отрыв: ${action.characterName}. Бросок: ${rollTotal} vs СЛ ${escapeDC}.`;
    }

    return {
      actionId: action.id,
      characterId: action.characterId,
      characterName: action.characterName,
      actionType: 'check',
      consumedItems: [],
      failureConsequence,
      promptDirective,
      auditNotes,
    };
  }
}

export const mechanicalArbiter = new MechanicalArbiter();
