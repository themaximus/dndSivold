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
  useConsumableItem(id: string, itemId: string): { character: CharacterEntity | null; healAmount: number; itemName: string };
  equipWeapon(id: string, itemId: string): CharacterEntity | null;
  awardXp(id: string, xpAmount: number): CharacterEntity | null;
  learnTalent(id: string, talentId: string, effects: any): CharacterEntity | null;
}

export class CharacterRepository implements ICharacterRepository {
  public findById(id: string): CharacterEntity | undefined {
    return db.characters.findById(id);
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

    // Apply healing if any
    let updatedChar: CharacterEntity | null = null;
    if (healAmount > 0) {
      updatedChar = this.updateHp(id, healAmount);
    } else {
      updatedChar = this.update(id, { inventory });
    }

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
}

export const characterRepository = new CharacterRepository();
