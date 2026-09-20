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
      ? customInventory
      : classConfig.startingInventory;

    const newCharacter: CharacterEntity = {
      id: crypto.randomUUID(),
      userId,
      name: name.trim(),
      race: race.trim(),
      characterClass: classConfig.nameRu || characterClass,
      level: 1,
      hpCurrent: hpMax,
      hpMax,
      ac,
      stats: defaultStats,
      skills: Array.isArray(skills) && skills.length > 0 ? skills : classConfig.savingThrows,
      abilities,
      inventory,
      bio: bio?.trim() || '',
      avatarUrl: avatarUrl?.trim() || `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(name)}`,
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

export default router;
