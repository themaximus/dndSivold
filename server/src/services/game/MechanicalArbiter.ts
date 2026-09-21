import crypto from 'crypto';
import { CharacterEntity, TurnActionEntity, RoomEntity, RoomEnemy, RoomNPC } from '../../db';
import { calculateModifier } from '../dndRules';

export interface MechanicalTargetUpdate {
  targetId: string;
  targetName: string;
  targetType: 'enemy' | 'npc';
  hpBefore: number;
  hpAfter: number;
  damage: number;
  isDead: boolean;
  newStatus: string;
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
  actionType: 'attack' | 'heal' | 'check' | 'save' | 'improvise';
  isHit?: boolean;
  damageRolled?: number;
  damageFormula?: string;
  damageRolls?: number[];
  healRolled?: number;
  targetUpdate?: MechanicalTargetUpdate;
  consumedItems: ConsumedItemRecord[];
  promptDirective: string;
  auditNotes: string;
}

export class MechanicalArbiter {
  /**
   * Resolves a turn action procedurally:
   * 1. Evaluates hits vs AC
   * 2. Rolls authentic weapon damage formulas + stat modifiers (with double dice on Nat 20)
   * 3. Clamps target HP (preventing unrealistic instant kills of bosses/captains)
   * 4. Evaluates consumable heals (potions)
   * 5. Produces strict DM prompt directives for the LLM
   */
  public evaluateAction(
    action: TurnActionEntity,
    character: CharacterEntity | undefined,
    currentEnemies: RoomEnemy[],
    currentNPCs: RoomNPC[],
    roomDC: number = 12
  ): MechanicalResolution {
    const actionText = action.actionText || '';
    const actionLower = actionText.toLowerCase();

    // 1. Check for Healing Potion or healing consumable usage
    const isHealing = /(выпи(л|ть|ваю)|исцел(ил|ить|яю)|поит|леч(у|ил|ить)|попо(ил|ить)|перевяз|наложил повязку|зелье лечения|исцеляющ)/i.test(actionLower);
    if (isHealing && character) {
      return this.resolveHealingAction(action, character, currentEnemies, currentNPCs);
    }

    // 2. Check for Attack or aggressive strike
    const isAttackExplicit = action.actionType === 'attack';
    const isAggressiveText = /(атак(а|ую|овать)|удар(ить|яю|ом)?|рубл(ю|ить)|выстрел(ить|ю)?|стреля(ю|ть)|дуэл(ь|и)|напад(аю|ать|ение)|сража(ться|юсь)|выхватываю (меч|клинок|оружие)|всаживаю|приконч(ить|у)|уб(ить|ью)|срубаю|отрубаю|колю|пыряю|рассекаю|смертельный удар)/i.test(actionLower);

    const targetFound = this.findTarget(action, currentEnemies, currentNPCs);

    if (isAttackExplicit || isAggressiveText || targetFound) {
      return this.resolveCombatAttack(action, character, currentEnemies, currentNPCs, targetFound);
    }

    // 3. Fallback: Skill Check or Saving Throw vs DC
    return this.resolveGeneralCheckOrSave(action, roomDC);
  }

  /**
   * Resolves healing action (potion / spell / bandage)
   */
  private resolveHealingAction(
    action: TurnActionEntity,
    character: CharacterEntity,
    currentEnemies: RoomEnemy[],
    currentNPCs: RoomNPC[]
  ): MechanicalResolution {
    const actionLower = action.actionText.toLowerCase();

    // Find healing potion in character inventory
    const potion = (character.inventory || []).find(i =>
      i && (i.type === 'potion' || i.name.toLowerCase().includes('зелье') || (i.healAmount && i.healAmount > 0))
    );

    // Roll healing dice: 2d4 + 2 or item's healAmount
    let healAmount = potion?.healAmount || 0;
    let healFormula = '2d4 + 2';
    if (!healAmount || healAmount <= 0) {
      const d1 = crypto.randomInt(1, 5);
      const d2 = crypto.randomInt(1, 5);
      healAmount = d1 + d2 + 2;
    }

    // Determine healing target: self, an ally NPC, or target mentioned
    let targetName = character.name;
    let targetType: 'self' | 'npc' = 'self';
    let targetNPC: RoomNPC | undefined;

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
        targetNPC = npc;
        break;
      }
    }

    const consumedItems: ConsumedItemRecord[] = [];
    if (potion) {
      consumedItems.push({
        itemId: potion.id,
        itemName: potion.name,
        quantity: 1,
        reason: `Использовано для исцеления (${targetName})`,
      });
    }

    let targetUpdate: MechanicalTargetUpdate | undefined;
    if (targetType === 'npc' && targetNPC) {
      const hpBefore = targetNPC.hpCurrent;
      const hpAfter = Math.min(targetNPC.hpMax, hpBefore + healAmount);
      targetUpdate = {
        targetId: targetNPC.id,
        targetName: targetNPC.name,
        targetType: 'npc',
        hpBefore,
        hpAfter,
        damage: 0,
        isDead: false,
        newStatus: `Восстановил силы благодаря зелью (+${healAmount} HP). Отношение: союзник.`,
      };
    }

    const directive = `⚖️ МЕХАНИЧЕСКИЙ АРБИТР: Применено исцеление (${potion ? `«${potion.name}»` : 'зелье / помощь'}). Восстановлено +${healAmount} HP для ${targetName}. Раны затягиваются, силы возвращаются.`;

    return {
      actionId: action.id,
      characterId: character.id,
      characterName: character.name,
      actionType: 'heal',
      healRolled: healAmount,
      targetUpdate,
      consumedItems,
      promptDirective: directive,
      auditNotes: `Исцеление: ${targetName} получил +${healAmount} HP (${healFormula}). Предмет: ${potion?.name || 'зелье'}.`,
    };
  }

  /**
   * Resolves combat attack: Hit vs AC, procedural weapon damage, HP clamping, anti-oneshot directive
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

    // If no target exists on field at all, create a fallback contextual target
    let target = targetInfo?.target;
    let targetType = targetInfo?.type || 'enemy';

    if (!target) {
      // Heuristic target creation from action text (e.g. "капитан стражи", "бандит", "гоблин")
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
      };
      targetType = 'enemy';
    }

    const targetAc = target.ac || 12;
    const rollTotal = d20Roll?.total ?? 10;
    const isCritSuccess = !!d20Roll?.isCriticalSuccess;
    const isCritFail = !!d20Roll?.isCriticalFail;

    // Check hit: Nat 20 is always hit, Nat 1 is always miss
    const isHit = !isCritFail && (isCritSuccess || rollTotal >= targetAc);

    if (!isHit) {
      const missReason = isCritFail
        ? 'Критический промах (d20=1)'
        : `Промах (Бросок ${rollTotal} vs КБ ${targetAc})`;

      const directive = `⚖️ МЕХАНИЧЕСКИЙ АРБИТР: Атака ПРОМАХНУЛАСЬ (${rollTotal} vs КБ ${targetAc} цели «${target.name}»). Урон: 0 HP. Цель ${target.name} уклонилась или отразила выпад доспехом/щитом. Никакого вреда цели не нанесено.`;

      return {
        actionId: action.id,
        characterId: action.characterId,
        characterName: action.characterName,
        actionType: 'attack',
        isHit: false,
        damageRolled: 0,
        consumedItems: [],
        promptDirective: directive,
        auditNotes: `${action.characterName} атаковал ${target.name}: ${missReason}. Урон: 0.`,
      };
    }

    // Attack HIT! Calculate procedural weapon damage
    const { damageTotal, formula, rolls } = this.calculateWeaponDamage(character, action.actionText, isCritSuccess);

    const hpBefore = target.hpCurrent;
    const hpAfter = Math.max(0, hpBefore - damageTotal);
    const isDead = hpAfter <= 0;

    const newStatus = isDead
      ? 'Повержен в бою / Мёртв'
      : hpAfter <= target.hpMax * 0.3
      ? `Тяжело ранен, на пределе сил (${hpAfter}/${target.hpMax} HP)`
      : `Ранен, продолжает яростное сопротивление (${hpAfter}/${target.hpMax} HP)`;

    const targetUpdate: MechanicalTargetUpdate = {
      targetId: target.id,
      targetName: target.name,
      targetType,
      hpBefore,
      hpAfter,
      damage: damageTotal,
      isDead,
      newStatus,
    };

    // Construct Strict Anti-One-Shot Directive for LLM
    let directive = '';
    if (!isDead) {
      directive = `⚖️ МЕХАНИЧЕСКИЙ АРБИТР:
- Результат атаки: ПОПАДАНИЕ (${rollTotal} vs КБ ${targetAc}).
- Процедурный урон оружия: ${damageTotal} (Бросок: ${formula} = [${rolls.join('+')}]).
- Состояние цели: У «${target.name}» осталось ${hpAfter}/${target.hpMax} HP.
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
      auditNotes: `Атака по «${target.name}»: ПОПАДАНИЕ (${rollTotal} vs КБ ${targetAc}). Урон: ${damageTotal} (${formula}). HP цели: ${hpBefore} -> ${hpAfter}/${target.hpMax}. Статус: ${isDead ? 'Мёртв' : 'Жив'}.`,
    };
  }

  /**
   * Resolves skill check or save against Room DC
   */
  private resolveGeneralCheckOrSave(action: TurnActionEntity, roomDC: number): MechanicalResolution {
    const roll = action.diceRolls && action.diceRolls.length > 0 ? action.diceRolls[0] : null;
    const total = roll?.total ?? 10;
    const isCrit = !!roll?.isCriticalSuccess;
    const isFail = !!roll?.isCriticalFail;
    const isSuccess = !isFail && (isCrit || total >= roomDC);

    const directive = isSuccess
      ? `⚖️ МЕХАНИЧЕСКИЙ АРБИТР: Проверка УСПЕШНА (${total} vs СЛ ${roomDC}${isCrit ? ', КРИТ 20!' : ''}). Задуманное действие удается.`
      : `⚖️ МЕХАНИЧЕСКИЙ АРБИТР: Проверка ПРОВАЛЕНА (${total} vs СЛ ${roomDC}${isFail ? ', КРИТ 1!' : ''}). Возникает осложнение или препятствие.`;

    return {
      actionId: action.id,
      characterId: action.characterId,
      characterName: action.characterName,
      actionType: action.actionType || 'check',
      consumedItems: [],
      promptDirective: directive,
      auditNotes: `Проверка: ${action.characterName} выбросил ${total} vs СЛ ${roomDC}. Итог: ${isSuccess ? 'УСПЕХ' : 'ПРОВАЛ'}.`,
    };
  }

  /**
   * Calculates procedural weapon damage based on character's equipped/active weapon
   * and relevant stat modifier (STR for melee, DEX for finesse/ranged), doubling dice on Nat 20.
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

    // 1. Locate weapon from inventory: active weapon or first weapon
    const inventory = character.inventory || [];
    let weapon = inventory.find(i => i && i.id === character.activeWeaponId);
    if (!weapon) {
      weapon = inventory.find(i => i && i.type === 'weapon');
    }

    // Check if player mentioned a specific weapon by name
    const actLower = actionText.toLowerCase();
    for (const item of inventory) {
      if (item && item.type === 'weapon' && actLower.includes(item.name.toLowerCase().trim())) {
        weapon = item;
        break;
      }
    }

    // Default weapon damage formula if not specified
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

    // Cap dice parsing
    diceCount = Math.min(Math.max(1, diceCount), 6);
    diceSides = Math.min(Math.max(4, diceSides), 20);

    // If Critical Hit (Nat 20), DOUBLE the number of damage dice!
    const effectiveDiceCount = isCrit ? diceCount * 2 : diceCount;

    // Stat modifier: DEX for finesse/ranged, STR for melee
    const isFinesseOrRanged = /(лук|арбалет|кинжал|рапир|кортик|шпага|дротик|bow|dagger|rapier|crossbow)/i.test(weapon?.name || rawDamage);
    const statKey = isFinesseOrRanged ? 'dex' : 'str';
    const statScore = character.stats?.[statKey] || 10;
    const statMod = calculateModifier(statScore);

    const totalModifier = statMod + explicitBonus;

    // Roll damage dice
    const rolls: number[] = [];
    for (let i = 0; i < effectiveDiceCount; i++) {
      rolls.push(crypto.randomInt(1, diceSides + 1));
    }

    const diceSum = rolls.reduce((sum, val) => sum + val, 0);
    // Damage on hit is at least 1
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
   * Identifies target from action metadata, enemy list, or scene NPCs
   */
  private findTarget(
    action: TurnActionEntity,
    enemies: RoomEnemy[],
    npcs: RoomNPC[]
  ): { target: RoomEnemy | RoomNPC; type: 'enemy' | 'npc' } | null {
    // 1. Direct targetEnemyId or targetEnemyName
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

    // 2. Text heuristics against active enemies
    const actLower = action.actionText.toLowerCase();
    for (const e of enemies) {
      if (!e.isDead && e.hpCurrent > 0) {
        const eName = e.name.toLowerCase();
        if (actLower.includes(eName) || (eName.length >= 4 && actLower.includes(eName.slice(0, -1)))) {
          return { target: e, type: 'enemy' };
        }
      }
    }

    // 3. Text heuristics against scene NPCs
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

    // 4. If there's only 1 living enemy and action is an attack, default to that enemy
    const livingEnemies = enemies.filter(e => !e.isDead && e.hpCurrent > 0);
    if (livingEnemies.length === 1 && (action.actionType === 'attack' || /(атак|удар|выстрел|рубл)/i.test(actLower))) {
      return { target: livingEnemies[0], type: 'enemy' };
    }

    return null;
  }
}

export const mechanicalArbiter = new MechanicalArbiter();
