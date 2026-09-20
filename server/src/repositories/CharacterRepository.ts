import crypto from 'crypto';
import { db, CharacterEntity } from '../db';
import { IRepository } from './IRepository';

export interface ICharacterRepository extends IRepository<CharacterEntity> {
  findByUserId(userId: string): CharacterEntity[];
  update(id: string, updates: Partial<CharacterEntity>): CharacterEntity | null;
  delete(id: string, userId: string): boolean;
  updateHp(id: string, delta: number): CharacterEntity | null;
  applyDeathSave(
    id: string,
    rollTotal: number,
    isNat20: boolean,
    isNat1: boolean
  ): { character: CharacterEntity | null; message: string; state: 'alive' | 'downed' | 'dead' | 'stable' };
  addItemToInventory(id: string, item: any): CharacterEntity | null;
  removeItemFromInventory(id: string, itemNameOrId: string, quantity?: number): CharacterEntity | null;
  useConsumableItem(id: string, itemId: string): { character: CharacterEntity | null; healAmount: number; itemName: string };
  equipWeapon(id: string, itemId: string): CharacterEntity | null;
  awardXp(id: string, xpAmount: number): CharacterEntity | null;
  performShortRest(id: string, diceCount?: number): {
    character: CharacterEntity | null;
    healedHp: number;
    diceSpent: number;
    rolls: number[];
  };
  performLongRest(id: string, currentRound?: number): { character: CharacterEntity | null; healedHp: number };
  useSpellSlot(id: string, level: number): CharacterEntity | null;
  updateConditions(id: string, conditions: string[]): CharacterEntity | null;
  learnTalent(id: string, talentId: string, effects: any): CharacterEntity | null;
}

export class CharacterRepository implements ICharacterRepository {
  public findById(id: string): CharacterEntity | undefined {
    const raw = db.characters.findById(id);
    if (!raw) return undefined;
    return this.hydrateDnd5eDefaults(raw);
  }

  public hydrateDnd5eDefaults(char: CharacterEntity): CharacterEntity {
    let needsUpdate = false;
    const updates: Partial<CharacterEntity> = {};

    if (!char.hitDiceType || char.hitDiceMax === undefined) {
      const cClass = (char.characterClass || '').toLowerCase();
      let hdType = 'd8';
      if (/варвар/i.test(cClass)) hdType = 'd12';
      else if (/воин|паладин|следопыт/i.test(cClass)) hdType = 'd10';
      else if (/волшебник|чародей/i.test(cClass)) hdType = 'd6';

      updates.hitDiceType = hdType;
      updates.hitDiceMax = char.level || 1;
      updates.hitDiceCurrent = char.level || 1;
      needsUpdate = true;
    }

    if (!char.conditions) {
      updates.conditions = [];
      needsUpdate = true;
    }

    if (char.spellSlots === undefined) {
      const cClass = (char.characterClass || '').toLowerCase();
      const isCaster = /волшебник|маг|жрец|чародей|друид|колдун|бард|паладин/i.test(cClass);
      if (isCaster) {
        const lvl = char.level || 1;
        const slots: Record<string, { current: number; max: number }> = {};
        if (lvl === 1) {
          slots['1'] = { current: 2, max: 2 };
        } else if (lvl === 2) {
          slots['1'] = { current: 3, max: 3 };
        } else {
          slots['1'] = { current: 4, max: 4 };
          slots['2'] = { current: 2, max: 2 };
        }
        updates.spellSlots = slots;
        needsUpdate = true;
      }
    }

    if (needsUpdate) {
      const updated = db.characters.update(char.id, updates);
      return updated || { ...char, ...updates };
    }
    return char;
  }

  public findByUserId(userId: string): CharacterEntity[] {
    return db.characters.findByUserId(userId);
  }

  public create(char: CharacterEntity): CharacterEntity {
    return db.characters.create(char);
  }

  public update(id: string, updates: Partial<CharacterEntity>): CharacterEntity | null {
    return db.characters.update(id, updates);
  }

  public delete(id: string, userId: string): boolean {
    return db.characters.delete(id, userId);
  }

  public updateHp(id: string, delta: number): CharacterEntity | null {
    const char = this.findById(id);
    if (!char) return null;

    const newHp = Math.max(0, Math.min(char.hpMax, char.hpCurrent + delta));
    const updates: Partial<CharacterEntity> = { hpCurrent: newHp };

    // Real HP & Death State handling
    if (newHp === 0 && char.lifeState !== 'dead') {
      updates.lifeState = 'downed';
      if (!char.deathSaves) {
        updates.deathSaves = { successes: 0, failures: 0, isStable: false };
      }
    } else if (newHp > 0 && char.lifeState === 'downed') {
      updates.lifeState = 'alive';
      updates.deathSaves = { successes: 0, failures: 0, isStable: false };
    }

    return this.update(id, updates);
  }

  public applyDeathSave(
    id: string,
    rollTotal: number,
    isNat20: boolean,
    isNat1: boolean
  ): { character: CharacterEntity | null; message: string; state: 'alive' | 'downed' | 'dead' | 'stable' } {
    const char = this.findById(id);
    if (!char) {
      return { character: null, message: 'Персонаж не найден', state: 'dead' };
    }

    if (char.lifeState === 'dead') {
      return { character: char, message: 'Персонаж уже погиб', state: 'dead' };
    }

    const currentSaves = char.deathSaves || { successes: 0, failures: 0, isStable: false };

    // Nat 20: Instantly regains consciousness with 1 HP!
    if (isNat20 || rollTotal >= 20) {
      const updated = this.update(id, {
        hpCurrent: 1,
        lifeState: 'alive',
        deathSaves: { successes: 0, failures: 0, isStable: false },
      });
      return {
        character: updated,
        message: '★ КРИТИЧЕСКИЙ УСПЕХ (20)! Герой открывает глаза и возвращается к жизни с 1 HP!',
        state: 'alive',
      };
    }

    // Nat 1: 2 failures
    if (isNat1) {
      const failures = currentSaves.failures + 2;
      const isDead = failures >= 3;
      const updated = this.update(id, {
        lifeState: isDead ? 'dead' : 'downed',
        deathSaves: { ...currentSaves, failures },
      });
      return {
        character: updated,
        message: isDead
          ? '☠ КРИТИЧЕСКИЙ ПРОВАЛ (1)! Получено 2 провала. Персонаж испустил последний вздох...'
          : `☠ КРИТИЧЕСКИЙ ПРОВАЛ (1)! Получено 2 провала спасброска (${failures}/3)!`,
        state: isDead ? 'dead' : 'downed',
      };
    }

    // Standard D&D 5e check: 10+ is success, 2-9 is failure
    if (rollTotal >= 10) {
      const successes = currentSaves.successes + 1;
      const isStable = successes >= 3;
      const updated = this.update(id, {
        deathSaves: { ...currentSaves, successes, isStable },
      });
      return {
        character: updated,
        message: isStable
          ? '★ 3 Успеха! Состояние героя стабилизировалось, дыхание выровнялось.'
          : `★ Успех спасброска от смерти (${successes}/3)!`,
        state: isStable ? 'stable' : 'downed',
      };
    } else {
      const failures = currentSaves.failures + 1;
      const isDead = failures >= 3;
      const updated = this.update(id, {
        lifeState: isDead ? 'dead' : 'downed',
        deathSaves: { ...currentSaves, failures },
      });
      return {
        character: updated,
        message: isDead
          ? '☠ 3 Провала спасброска от смерти... Герой пал на поле боя.'
          : `☠ Провал спасброска от смерти (${failures}/3)!`,
        state: isDead ? 'dead' : 'downed',
      };
    }
  }

  public addItemToInventory(id: string, item: any): CharacterEntity | null {
    const char = this.findById(id);
    if (!char) return null;

    const inventory = [...(char.inventory || [])];
    const existing = inventory.find(i => i.name.toLowerCase() === item.name.toLowerCase());

    if (existing) {
      existing.quantity = (existing.quantity || 1) + (item.quantity || 1);
    } else {
      inventory.push({
        id: item.id || crypto.randomUUID(),
        name: item.name,
        type: item.type || 'misc',
        description: item.description || '',
        quantity: item.quantity || 1,
        damage: item.damage,
        ac_bonus: item.ac_bonus,
        healAmount: item.healAmount,
      });
    }

    return this.update(id, { inventory });
  }

  public removeItemFromInventory(id: string, itemNameOrId: string, quantity = 1): CharacterEntity | null {
    const char = this.findById(id);
    if (!char) return null;

    const inventory = [...(char.inventory || [])];
    const targetQuery = itemNameOrId.toLowerCase().trim();
    const idx = inventory.findIndex(i =>
      i.id === itemNameOrId ||
      i.name.toLowerCase().trim() === targetQuery ||
      i.name.toLowerCase().includes(targetQuery) ||
      targetQuery.includes(i.name.toLowerCase().trim())
    );

    if (idx === -1) return char;

    const item = inventory[idx];
    if (item.quantity && item.quantity > quantity) {
      item.quantity -= quantity;
    } else {
      inventory.splice(idx, 1);
    }

    return this.update(id, { inventory });
  }

  public useConsumableItem(id: string, itemId: string): { character: CharacterEntity | null; healAmount: number; itemName: string } {
    const char = this.findById(id);
    if (!char) return { character: null, healAmount: 0, itemName: '' };

    const inventory = [...(char.inventory || [])];
    const idx = inventory.findIndex(i => i.id === itemId);
    if (idx === -1) return { character: char, healAmount: 0, itemName: '' };

    const item = inventory[idx];
    const healAmount = item.healAmount || (item.type === 'potion' ? 8 : 0);
    const itemName = item.name;

    if (item.quantity > 1) {
      item.quantity -= 1;
    } else {
      inventory.splice(idx, 1);
    }

    // Apply inventory decrement and healing atomically
    const updates: Partial<CharacterEntity> = { inventory };
    if (healAmount > 0) {
      const newHp = Math.max(0, Math.min(char.hpMax, char.hpCurrent + healAmount));
      updates.hpCurrent = newHp;
      if (newHp > 0 && char.lifeState === 'downed') {
        updates.lifeState = 'alive';
        updates.deathSaves = { successes: 0, failures: 0, isStable: false };
      }
    }

    const updatedChar = this.update(id, updates);
    return { character: updatedChar, healAmount, itemName };
  }

  public equipWeapon(id: string, itemId: string): CharacterEntity | null {
    const char = this.findById(id);
    if (!char) return null;
    return this.update(id, { activeWeaponId: itemId });
  }

  public awardXp(id: string, xpAmount: number): CharacterEntity | null {
    const char = this.findById(id);
    if (!char) return null;

    const currentXp = char.xp || 0;
    const newXp = currentXp + xpAmount;
    const currentPoints = char.skillPoints || 0;

    // Award 1 skill point every 100 XP
    const prevPointsEarned = Math.floor(currentXp / 100);
    const newPointsEarned = Math.floor(newXp / 100);
    const additionalPoints = Math.max(0, newPointsEarned - prevPointsEarned);

    return this.update(id, {
      xp: newXp,
      skillPoints: currentPoints + additionalPoints,
    });
  }

  public learnTalent(id: string, talentId: string, effects: any): CharacterEntity | null {
    const char = this.findById(id);
    if (!char) return null;

    const points = char.skillPoints || 0;
    if (points < 1) return null;

    const learned = [...(char.learnedTalents || [])];
    if (learned.includes(talentId)) return char;

    learned.push(talentId);

    const updates: Partial<CharacterEntity> = {
      skillPoints: points - 1,
      learnedTalents: learned,
    };

    if (effects.hpBonus) {
      updates.hpMax = char.hpMax + effects.hpBonus;
      updates.hpCurrent = char.hpCurrent + effects.hpBonus;
    }

    if (effects.acBonus) {
      updates.ac = char.ac + effects.acBonus;
    }

    if (effects.statBonus) {
      const stats = { ...char.stats };
      const sKey = effects.statBonus.stat as keyof typeof stats;
      if (stats[sKey] !== undefined) {
        stats[sKey] += effects.statBonus.amount;
        updates.stats = stats;
      }
    }

    if (effects.newAbility) {
      const abilities = [...char.abilities];
      abilities.push({
        id: crypto.randomUUID(),
        name: effects.newAbility.name,
        type: effects.newAbility.type,
        description: effects.newAbility.description,
      });
      updates.abilities = abilities;
    }

    return this.update(id, updates);
  }

  public performShortRest(id: string, diceCount = 1): {
    character: CharacterEntity | null;
    healedHp: number;
    diceSpent: number;
    rolls: number[];
  } {
    const char = this.findById(id);
    if (!char) return { character: null, healedHp: 0, diceSpent: 0, rolls: [] };

    if ((char.shortRestsCount ?? 0) >= 2) {
      throw new Error('Вы уже совершили максимум коротких отдыхов (2) до долгого отдыха! Требуется продолжительный отдых.');
    }

    const currentDice = char.hitDiceCurrent ?? (char.level || 1);
    if (currentDice <= 0) {
      throw new Error('У вас не осталось доступных костей хитов для короткого отдыха!');
    }

    const actualSpend = Math.min(Math.max(1, diceCount), currentDice);
    if (actualSpend <= 0) {
      return { character: char, healedHp: 0, diceSpent: 0, rolls: [] };
    }

    const sides = char.hitDiceType === 'd12' ? 12 : char.hitDiceType === 'd10' ? 10 : char.hitDiceType === 'd6' ? 6 : 8;
    const conMod = Math.floor(((char.stats?.con || 10) - 10) / 2);

    const rolls: number[] = [];
    let totalHeal = 0;
    for (let i = 0; i < actualSpend; i++) {
      const roll = crypto.randomInt(1, sides + 1);
      const dieHeal = Math.max(1, roll + conMod);
      rolls.push(dieHeal);
      totalHeal += dieHeal;
    }

    const newHp = Math.min(char.hpMax, char.hpCurrent + totalHeal);
    const newDice = currentDice - actualSpend;

    // Clear temporary conditions on rest
    const updatedConditions = (char.conditions || []).filter(c => c !== 'prone');

    const updated = this.update(char.id, {
      hpCurrent: newHp,
      hitDiceCurrent: newDice,
      conditions: updatedConditions,
      shortRestsCount: (char.shortRestsCount || 0) + 1,
      lifeState: char.lifeState === 'downed' && newHp > 0 ? 'alive' : char.lifeState,
    });

    return {
      character: updated,
      healedHp: totalHeal,
      diceSpent: actualSpend,
      rolls,
    };
  }

  public performLongRest(id: string, currentRound?: number): { character: CharacterEntity | null; healedHp: number } {
    const char = this.findById(id);
    if (!char) return { character: null, healedHp: 0 };

    if (currentRound !== undefined && char.lastLongRestRound !== undefined && (currentRound - char.lastLongRestRound) < 6) {
      const remaining = 6 - (currentRound - char.lastLongRestRound);
      throw new Error(`Долгий отдых доступен не чаще одного раза в 6 раундов (24 часа в игре). До следующего отдыха осталось раундов: ${remaining}.`);
    }

    const maxHd = char.hitDiceMax ?? (char.level || 1);
    const curHd = char.hitDiceCurrent ?? 0;
    const restoredHd = Math.min(maxHd, curHd + Math.max(1, Math.floor(maxHd / 2)));

    // Reset spell slots to max
    const resetSlots = char.spellSlots ? { ...char.spellSlots } : undefined;
    if (resetSlots) {
      for (const lvl of Object.keys(resetSlots)) {
        resetSlots[lvl] = { current: resetSlots[lvl].max, max: resetSlots[lvl].max };
      }
    }

    const healed = char.hpMax - char.hpCurrent;
    const updated = this.update(char.id, {
      hpCurrent: char.hpMax,
      hitDiceCurrent: restoredHd,
      spellSlots: resetSlots,
      conditions: [],
      shortRestsCount: 0,
      lastLongRestRound: currentRound ?? 0,
      lifeState: char.lifeState === 'downed' ? 'alive' : char.lifeState,
    });

    return { character: updated, healedHp: Math.max(0, healed) };
  }

  public useSpellSlot(id: string, level: number): CharacterEntity | null {
    const char = this.findById(id);
    if (!char || !char.spellSlots) return null;
    const lvlKey = String(level);
    const slot = char.spellSlots[lvlKey];
    if (slot && slot.current > 0) {
      const updatedSlots = {
        ...char.spellSlots,
        [lvlKey]: { ...slot, current: slot.current - 1 },
      };
      return this.update(id, { spellSlots: updatedSlots });
    }
    return char;
  }

  public updateConditions(id: string, conditions: string[]): CharacterEntity | null {
    return this.update(id, { conditions: Array.from(new Set(conditions)) });
  }
}

export const characterRepository = new CharacterRepository();
