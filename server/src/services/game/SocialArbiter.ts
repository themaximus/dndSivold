import {
  CharacterEntity,
  TurnActionEntity,
  RoomNPC,
  NPCDisposition,
  NPCCombatRole,
  CharacterReactionRequest,
} from '../../db';

export type SocialActionType =
  | 'aid_heal'
  | 'persuasion'
  | 'intimidation'
  | 'deception'
  | 'bribe_gift'
  | 'attack_betrayal'
  | 'neutral_talk';

export interface SocialResolutionResult {
  npcId: string;
  npcName: string;
  actionType: SocialActionType;
  statUsed?: string;
  rollTotal?: number;
  dc?: number;
  isSuccess?: boolean;
  affinityDelta: number;
  newAffinity: number;
  previousDisposition: NPCDisposition;
  newDisposition: NPCDisposition;
  previousCombatRole: NPCCombatRole;
  newCombatRole: NPCCombatRole;
  promptDirective: string;
  auditNote: string;
  trustNote?: string;
}

export interface ContestedReactionResult {
  reactionRequestId: string;
  initiatorCharacterName: string;
  targetCharacterName: string;
  initiatorRollTotal?: number;
  reactionRollTotal?: number;
  responseType: 'positive' | 'negative' | 'counter';
  outcome: 'parried' | 'dodged' | 'glancing_hit' | 'full_hit' | 'assisted' | 'retaliated';
  damageMitigationMultiplier: number;
  initiatorRollModifier: number;
  promptDirective: string;
  auditNote: string;
}

export class SocialArbiter {
  /**
   * Detects the social or behavioral intent of a player's action towards an NPC
   */
  public detectSocialIntent(actionText: string): SocialActionType {
    const text = actionText.toLowerCase();

    // 1. Healing / Aid / Protection
    if (
      /исцел|зелье|попо(ил|ить)|леч|перевяз|помощ|спаст|забинтов|укрыл|щитом.*прикры|налож.*повяз/i.test(text)
    ) {
      return 'aid_heal';
    }

    // 2. Direct violent attack / Betrayal
    if (
      /атак|удар|рассек|убить|метнул.*в|выстрел.*в|вонзил|поразил|приконч|обезглав/i.test(text)
    ) {
      return 'attack_betrayal';
    }

    // 3. Bribes / Gifts / Sharing Resources
    if (
      /золот|монет|деньг|подар|взятк|отдал.*(хлеб|еду|клинок|сапфир|серебр|припас)|протягива.*(золот|монет)/i.test(text)
    ) {
      return 'bribe_gift';
    }

    // 4. Intimidation / Coercion / Threats
    if (
      /запуг|угроз|сломаю|убью.*если|прижал.*к|грозно|оружием.*в.*лицо|скрут|выпыта|допрос.*с.*пристрасти/i.test(text)
    ) {
      return 'intimidation';
    }

    // 5. Deception / Lies / Disguise
    if (
      /обман|солгал|соврал|притвори|блеф|выдал.*себя|втерс.*в.*довер|ввести.*в.*заблужд/i.test(text)
    ) {
      return 'deception';
    }

    // 6. Persuasion / Diplomacy / Negotiation
    if (
      /убежд|диплом|договор|предлож|уговор|договори|попросил|разумн|воззвал|мирно|союз/i.test(text)
    ) {
      return 'persuasion';
    }

    return 'neutral_talk';
  }

  /**
   * Maps numerical affinity (-100 to +100) to standard D&D / RPG disposition
   */
  public calculateAffinityDisposition(affinity: number): NPCDisposition {
    if (affinity >= 40) return 'friendly';
    if (affinity >= 15) return 'cautious';
    if (affinity >= -10) return 'neutral';
    if (affinity >= -39) return 'offended';
    return 'hostile';
  }

  /**
   * Determines how the NPC acts in tactical / combat scenes based on disposition and archetype
   */
  public calculateCombatRole(
    npc: RoomNPC,
    disposition: NPCDisposition,
    actionType: SocialActionType
  ): NPCCombatRole {
    const isMartial = /страж|воин|наемник|егерь|следопыт|рыцарь|маг|паладин|лучник|караульн/i.test(
      `${npc.role} ${npc.name}`
    );

    if (disposition === 'hostile' || actionType === 'attack_betrayal') {
      return isMartial ? 'hiding' : 'fled';
    }

    if (disposition === 'friendly' || (actionType === 'aid_heal' && isMartial)) {
      return isMartial ? 'ally_combatant' : 'neutral_observer';
    }

    if (disposition === 'frightened') {
      return 'hiding';
    }

    if (disposition === 'offended') {
      return 'neutral_observer';
    }

    return npc.combatRole || (isMartial && disposition === 'cautious' ? 'ally_combatant' : 'neutral_observer');
  }

  /**
   * Procedural evaluation of a social or medical action performed on an NPC
   */
  public evaluateSocialAction(
    action: TurnActionEntity,
    character: CharacterEntity,
    npc: RoomNPC,
    roundNumber: number
  ): SocialResolutionResult {
    const actionType = this.detectSocialIntent(action.actionText);
    const prevAffinity = typeof npc.affinity === 'number' ? npc.affinity : this.getDefaultAffinity(npc.disposition);
    const prevDisposition = npc.disposition;
    const prevCombatRole = npc.combatRole;

    // Extract d20 roll from action if present
    const roll = Array.isArray(action.diceRolls) ? action.diceRolls.find((r: any) => r.sides === 20 || r.type === 'd20') : null;
    const rollTotal = roll ? (roll.total ?? roll.result) : undefined;
    const isNat20 = roll?.isCritSuccess || roll?.result === 20;
    const isNat1 = roll?.isCritFail || roll?.result === 1;

    let affinityDelta = 0;
    let isSuccess: boolean | undefined = undefined;
    let dc: number | undefined = undefined;
    let statUsed: string | undefined = undefined;
    let trustNote: string | undefined = undefined;

    switch (actionType) {
      case 'aid_heal': {
        // Healing or assisting always boosts affinity dramatically (+25 to +40)
        affinityDelta = isNat20 ? 40 : 25;
        isSuccess = true;
        trustNote = `Раунд ${roundNumber}: ${character.name} оказал медицинскую помощь / спас (+${affinityDelta})`;
        break;
      }

      case 'bribe_gift': {
        // Offering valuable items or coins (+15 to +30)
        affinityDelta = isNat20 ? 30 : 20;
        isSuccess = true;
        trustNote = `Раунд ${roundNumber}: ${character.name} одарил / подкупил ресурсами (+${affinityDelta})`;
        break;
      }

      case 'persuasion': {
        statUsed = 'cha';
        // Base DC scales with current disposition
        dc = prevDisposition === 'hostile' ? 20 : prevDisposition === 'offended' ? 16 : prevDisposition === 'cautious' ? 14 : 12;
        const chaMod = Math.floor(((character.stats?.cha || 10) - 10) / 2);
        const effectiveRoll = rollTotal ?? (10 + chaMod);

        isSuccess = isNat20 || (!isNat1 && effectiveRoll >= dc);
        if (isSuccess) {
          affinityDelta = isNat20 ? 30 : 18;
          trustNote = `Раунд ${roundNumber}: ${character.name} убедил вескими аргументами (+${affinityDelta})`;
        } else {
          affinityDelta = isNat1 ? -15 : -5;
          trustNote = `Раунд ${roundNumber}: ${character.name} не сумел убедить (${affinityDelta})`;
        }
        break;
      }

      case 'intimidation': {
        statUsed = (character.stats?.str || 10) > (character.stats?.cha || 10) ? 'str' : 'cha';
        dc = prevDisposition === 'hostile' ? 18 : 13;
        const mod = Math.floor(((character.stats?.[statUsed as 'str' | 'cha'] || 10) - 10) / 2);
        const effectiveRoll = rollTotal ?? (10 + mod);

        isSuccess = isNat20 || (!isNat1 && effectiveRoll >= dc);
        if (isSuccess) {
          // Intimidation gives temporary submission but causes long-term resentment (-20)
          affinityDelta = -20;
          trustNote = `Раунд ${roundNumber}: ${character.name} запугал угрозой расправы (-20, страх)`;
        } else {
          affinityDelta = isNat1 ? -35 : -25;
          trustNote = `Раунд ${roundNumber}: ${character.name} попытался угрожать, вызвав презрение (-25)`;
        }
        break;
      }

      case 'deception': {
        statUsed = 'cha';
        dc = 14;
        const chaMod = Math.floor(((character.stats?.cha || 10) - 10) / 2);
        const effectiveRoll = rollTotal ?? (10 + chaMod);

        isSuccess = isNat20 || (!isNat1 && effectiveRoll >= dc);
        if (isSuccess) {
          affinityDelta = 10;
          trustNote = `Раунд ${roundNumber}: ${character.name} успешно солгал / отвел подозрения (+10)`;
        } else {
          affinityDelta = isNat1 ? -40 : -25;
          trustNote = `Раунд ${roundNumber}: Ложь ${character.name} была раскрыта (-25)`;
        }
        break;
      }

      case 'attack_betrayal': {
        // Attacking an NPC turns them into an enemy immediately
        affinityDelta = -75;
        isSuccess = true;
        trustNote = `Раунд ${roundNumber}: ${character.name} вероломно напал (-75, враждебность)`;
        break;
      }

      case 'neutral_talk':
      default: {
        affinityDelta = 5;
        isSuccess = true;
        trustNote = `Раунд ${roundNumber}: Диалог с ${character.name} (+5)`;
        break;
      }
    }

    const newAffinity = Math.max(-100, Math.min(100, prevAffinity + affinityDelta));
    let newDisposition = this.calculateAffinityDisposition(newAffinity);

    // If successfully intimidated, override to 'frightened'
    if (actionType === 'intimidation' && isSuccess) {
      newDisposition = 'frightened';
    }

    const newCombatRole = this.calculateCombatRole(npc, newDisposition, actionType);

    const promptDirective = `[СОЦИАЛЬНЫЙ АРБИТР: ${character.name} взаимодействует с ${npc.name} (${actionType.toUpperCase()}). Результат броска: ${rollTotal ?? 'без кубика'} vs СЛ ${dc ?? '-'}. Итог: ${isSuccess ? 'УСПЕХ' : 'ПРОВАЛ'}. Отношение: ${newAffinity > 0 ? '+' : ''}${newAffinity} (${newDisposition}). Тактическая роль: ${newCombatRole}. ИИ обязан строго передать эти изменения в реакции и словах NPC!]`;

    const auditNote = `${actionType}: ${isSuccess ? 'SUCCESS' : 'FAIL'} (delta: ${affinityDelta > 0 ? '+' : ''}${affinityDelta}, newAffinity: ${newAffinity}, disposition: ${newDisposition})`;

    return {
      npcId: npc.id,
      npcName: npc.name,
      actionType,
      statUsed,
      rollTotal,
      dc,
      isSuccess,
      affinityDelta,
      newAffinity,
      previousDisposition: prevDisposition,
      newDisposition,
      previousCombatRole: prevCombatRole,
      newCombatRole,
      promptDirective,
      auditNote,
      trustNote,
    };
  }

  /**
   * Procedurally resolves a player's reaction (parry, dodge, assist, retaliation) against another player's action
   */
  public evaluateContestedReaction(
    reaction: CharacterReactionRequest,
    initiatorAction?: TurnActionEntity,
    initiatorChar?: CharacterEntity,
    targetChar?: CharacterEntity
  ): ContestedReactionResult {
    const initRollTotal = reaction.initiatorRoll?.total ?? reaction.initiatorRoll?.result ?? 12;
    const reactRollTotal = reaction.reactionRoll?.total ?? reaction.reactionRoll?.result;

    const responseType = reaction.responseType || 'positive';

    // 1. Cooperative Assist / Support Reaction
    if (responseType === 'positive') {
      const promptDirective = `[РЕАКЦИЯ-ПОМОЩЬ: ${reaction.targetCharacterName} поддерживает действие ${reaction.initiatorCharacterName} («${reaction.reactionText || 'Помогает'}»). Инициатор получает тактическое преимущество и бонус +3 к результату!]`;
      return {
        reactionRequestId: reaction.id,
        initiatorCharacterName: reaction.initiatorCharacterName,
        targetCharacterName: reaction.targetCharacterName,
        initiatorRollTotal: initRollTotal,
        reactionRollTotal: reactRollTotal,
        responseType,
        outcome: 'assisted',
        damageMitigationMultiplier: 1.0,
        initiatorRollModifier: 3,
        promptDirective,
        auditNote: `Assisted: +3 modifier granted to ${reaction.initiatorCharacterName}`,
      };
    }

    // 2. Defensive / Parry / Dodge Reaction (PvP or Contested)
    if (reactRollTotal !== undefined) {
      if (reactRollTotal >= initRollTotal) {
        // Complete deflection / parry / dodge
        const isParry = /парир|блок|щит|меч.*отбил|отразил/i.test(reaction.reactionText || '');
        const outcome = isParry ? 'parried' : 'dodged';
        const promptDirective = `[РЕАКЦИЯ-ЗАЩИТА: ${reaction.targetCharacterName} успешно ${isParry ? 'парировал' : 'уклонился от'} атаки ${reaction.initiatorCharacterName}! (Защита: ${reactRollTotal} vs Атака: ${initRollTotal}). Урон ПОЛНОСТЬЮ АННУЛИРОВАН (0 урона)!]`;

        return {
          reactionRequestId: reaction.id,
          initiatorCharacterName: reaction.initiatorCharacterName,
          targetCharacterName: reaction.targetCharacterName,
          initiatorRollTotal: initRollTotal,
          reactionRollTotal: reactRollTotal,
          responseType,
          outcome,
          damageMitigationMultiplier: 0, // 0 damage dealt!
          initiatorRollModifier: 0,
          promptDirective,
          auditNote: `${outcome.toUpperCase()}: Full damage mitigation (0 damage). Defender ${reactRollTotal} >= Attacker ${initRollTotal}`,
        };
      } else if (initRollTotal - reactRollTotal <= 2) {
        // Glancing blow (half damage)
        const promptDirective = `[РЕАКЦИЯ-ЗАЩИТА: ${reaction.targetCharacterName} частично смягчил удар ${reaction.initiatorCharacterName} (Скользящее попадание: Защита ${reactRollTotal} vs Атака ${initRollTotal}). Урон снижен наполовину (50%)!]`;

        return {
          reactionRequestId: reaction.id,
          initiatorCharacterName: reaction.initiatorCharacterName,
          targetCharacterName: reaction.targetCharacterName,
          initiatorRollTotal: initRollTotal,
          reactionRollTotal: reactRollTotal,
          responseType,
          outcome: 'glancing_hit',
          damageMitigationMultiplier: 0.5, // 50% damage
          initiatorRollModifier: 0,
          promptDirective,
          auditNote: `Glancing hit: 50% damage. Defender ${reactRollTotal} was within 2 of Attacker ${initRollTotal}`,
        };
      }
    }

    // Full hit penetrated defense
    const promptDirective = `[РЕАКЦИЯ: ${reaction.targetCharacterName} попытался защититься («${reaction.reactionText || 'Уклонение'}»), но атака ${reaction.initiatorCharacterName} пробила защиту (${initRollTotal} vs ${reactRollTotal ?? 'без кубика'}).]`;

    return {
      reactionRequestId: reaction.id,
      initiatorCharacterName: reaction.initiatorCharacterName,
      targetCharacterName: reaction.targetCharacterName,
      initiatorRollTotal: initRollTotal,
      reactionRollTotal: reactRollTotal,
      responseType,
      outcome: 'full_hit',
      damageMitigationMultiplier: 1.0,
      initiatorRollModifier: 0,
      promptDirective,
      auditNote: `Full hit: Attacker ${initRollTotal} penetrated defense ${reactRollTotal ?? 'none'}`,
    };
  }

  private getDefaultAffinity(disposition?: NPCDisposition): number {
    switch (disposition) {
      case 'friendly':
        return 35;
      case 'cautious':
        return 15;
      case 'offended':
        return -20;
      case 'frightened':
        return -15;
      case 'hostile':
        return -50;
      case 'neutral':
      default:
        return 0;
    }
  }
}

export const socialArbiter = new SocialArbiter();
