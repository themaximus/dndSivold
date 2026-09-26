import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { db, CharacterEntity } from '../db';
import { authMiddleware } from './auth';
import {
  DND_CLASSES,
  calculateBaseHP,
  calculateBaseAC,
  calculateModifier
} from '../services/dndRules';

const router = Router();

// GET /api/characters - Get all characters belonging to current user
router.get('/', authMiddleware, (req: Request, res: Response): void => {
  const userId = (req as any).userId;
  const characters = db.characters.findByUserId(userId);
  res.json(characters);
});

// GET /api/characters/:id - Get single character
router.get('/:id', authMiddleware, (req: Request, res: Response): void => {
  const char = db.characters.findById(req.params.id);
  if (!char) {
    res.status(404).json({ error: 'Персонаж не найден' });
    return;
  }
  res.json(char);
});

// POST /api/characters - Create character
router.post('/', authMiddleware, (req: Request, res: Response): void => {
  try {
    const userId = (req as any).userId;
    const {
      name,
      race,
      characterClass,
      stats,
      skills,
      bio,
      avatarUrl,
      customAbilities,
      customInventory
    } = req.body;

    if (!name || !characterClass || !race) {
      res.status(400).json({ error: 'Имя, раса и класс обязательны для создания персонажа' });
      return;
    }

    const classKey = characterClass.toLowerCase();
    const classConfig = DND_CLASSES[classKey] || DND_CLASSES.fighter;

    const defaultStats = {
      str: 14,
      dex: 12,
      con: 14,
      int: 10,
      wis: 10,
      cha: 10,
      ...(stats || {}),
    };

    const hpMax = calculateBaseHP(classKey, defaultStats.con);
    const ac = calculateBaseAC(classKey, defaultStats.dex, classConfig.startingInventory.find(i => i.type === 'armor')?.ac_bonus || 0);

    const abilities = (customAbilities && customAbilities.length > 0)
      ? customAbilities
      : classConfig.startingAbilities;

    const inventory = (customInventory && customInventory.length > 0)
      ? customInventory.filter((i: any) => i && typeof i.name === 'string' && i.name.trim().length > 0)
      : classConfig.startingInventory;

    const firstWeapon = inventory.find((i: any) => i.type === 'weapon' || /(?:меч|клинок|кинжал|лук|арбалет|топор|секира|булава|посох|молот)/i.test(i.name));
    const firstArmor = inventory.find((i: any) => (i.type === 'armor' && !/(?:щит|баклер|тарч)/i.test(i.name)) || /(?:доспех|латы|кольчуг|кирас|нагрудник|кожанк)/i.test(i.name));
    const firstShield = inventory.find((i: any) => /(?:щит|баклер|тарч|павез)/i.test(i.name));
    const isTwoHanded = firstWeapon && /(?:двуручн|клеймор|эспадон|цвайхендер|секир[аы]\s+предков|великая\s+секир)/i.test(firstWeapon.name);
    const shieldBonus = (!isTwoHanded && firstShield) ? (firstShield.ac_bonus || 2) : 0;

    const newCharacter: CharacterEntity = {
      id: crypto.randomUUID(),
      userId,
      name: name.trim(),
      race: race.trim(),
      characterClass: classConfig.nameRu || characterClass,
      level: 1,
      hpCurrent: hpMax,
      hpMax,
      ac: ac + shieldBonus,
      stats: defaultStats,
      skills: Array.isArray(skills) && skills.length > 0 ? skills : classConfig.savingThrows,
      abilities,
      inventory,
      bio: bio?.trim() || '',
      avatarUrl: avatarUrl?.trim() || `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(name)}`,
      activeWeaponId: firstWeapon?.id,
      activeArmorId: firstArmor?.id,
      activeShieldId: (!isTwoHanded && firstShield) ? firstShield.id : undefined,
      createdAt: new Date().toISOString(),
    };

    const saved = db.characters.create(newCharacter);
    res.status(201).json(saved);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Ошибка при создании персонажа' });
  }
});

// DELETE /api/characters/:id - Delete character
router.delete('/:id', authMiddleware, (req: Request, res: Response): void => {
  const userId = (req as any).userId;
  const success = db.characters.delete(req.params.id, userId);
  if (!success) {
    res.status(404).json({ error: 'Персонаж не найден или уже удален' });
    return;
  }
  res.json({ success: true });
});

import { characterRepository } from '../repositories/CharacterRepository';
import { gameSessionService } from '../services/game/GameSessionService';

// POST /api/characters/sync-backup - Restore user's characters from client-side backup
router.post('/sync-backup', authMiddleware, (req: Request, res: Response): void => {
  try {
    const userId = (req as any).userId;
    const backupList: CharacterEntity[] = Array.isArray(req.body.characters) ? req.body.characters : [];
    const currentChars = db.characters.findByUserId(userId);
    let restoredCount = 0;

    for (const char of backupList) {
      if (!char || !char.name) continue;
      const exists = currentChars.some(c => c.id === char.id || c.name.toLowerCase().trim() === char.name.toLowerCase().trim());
      if (!exists) {
        db.characters.create({
          ...char,
          id: char.id || crypto.randomUUID(),
          userId,
          createdAt: char.createdAt || new Date().toISOString(),
        });
        restoredCount++;
      }
    }

    const updatedChars = db.characters.findByUserId(userId);
    res.json({ success: true, restoredCount, characters: updatedChars });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Ошибка синхронизации резервной копии' });
  }
});

// POST /api/characters/:id/talents - Learn talent with instant level increase
router.post('/:id/talents', authMiddleware, (req: Request, res: Response): void => {
  try {
    const { talentId } = req.body;
    if (!talentId) {
      res.status(400).json({ error: 'talentId обязателен' });
      return;
    }
    const updatedChar = gameSessionService.learnTalent(req.params.id, talentId);
    if (!updatedChar) {
      res.status(400).json({ error: 'Не удалось изучить талант (недостаточно очков или талант не найден)' });
      return;
    }
    res.json(updatedChar);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Ошибка прокачки таланта' });
  }
});

// POST /api/characters/:id/rest/short - Perform Short Rest with Hit Dice
router.post('/:id/rest/short', authMiddleware, (req: Request, res: Response): void => {
  try {
    const diceCount = typeof req.body.diceCount === 'number' ? req.body.diceCount : 1;
    const result = characterRepository.performShortRest(req.params.id, diceCount);
    if (!result.character) {
      res.status(404).json({ error: 'Персонаж не найден' });
      return;
    }
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Ошибка короткого отдыха' });
  }
});

// POST /api/characters/:id/rest/long - Perform Long Rest (full recovery)
router.post('/:id/rest/long', authMiddleware, (req: Request, res: Response): void => {
  try {
    const result = characterRepository.performLongRest(req.params.id);
    if (!result.character) {
      res.status(404).json({ error: 'Персонаж не найден' });
      return;
    }
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Ошибка длинного отдыха' });
  }
});

export default router;
