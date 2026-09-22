import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { db, RoomEntity } from '../db';
import { authMiddleware } from './auth';
import { cryptoService, sanitizeRoom } from '../services/security/CryptoService';
import { gameSessionService } from '../services/game/GameSessionService';
import { config } from '../config';
import { storyGeneratorService } from '../services/ai/StoryGeneratorService';

const router = Router();

function generateRoomCode(): string {
  const prefixes = ['DUNGEON', 'VALLEY', 'CASTLE', 'DRAGON', 'TAVERN', 'ABYSS', 'FOREST'];
  const prefix = prefixes[crypto.randomInt(0, prefixes.length)];
  const num = crypto.randomInt(100, 999);
  return `${prefix}-${num}`;
}

// POST & GET /api/rooms/generate-story - Generate a random story/campaign via AI or procedural generator
router.post('/generate-story', async (req: Request, res: Response): Promise<void> => {
  try {
    const { genre, campaignDuration, deepseekApiKey, deepseekModel } = req.body || {};
    const story = await storyGeneratorService.generateStory({
      genre,
      campaignDuration,
      apiKey: deepseekApiKey,
      model: deepseekModel,
    });
    res.json(story);
  } catch (err: any) {
    console.warn('Story generation service error, returning fallback:', err?.message || err);
    res.json({
      title: 'Караван на Перепутье Семи Дорог',
      setting: 'На широкой развилке древних трактов встал лагерем торговый караван купца Бальтазара. Сломанное колесо повозки задерживает путь, а возницы шепчутся о странных огнях в чащобе. Купец ищет спутников, предлагает редкие диковинки и готов щедро наградить за помощь и охрану в пути.',
      genre: req.body?.genre || 'fantasy',
      campaignDuration: req.body?.campaignDuration || 'medium',
    });
  }
});

router.get('/generate-story', async (req: Request, res: Response): Promise<void> => {
  try {
    const genre = (req.query.genre as string) || 'fantasy';
    const campaignDuration = (req.query.campaignDuration as any) || 'medium';
    const story = await storyGeneratorService.generateStory({ genre, campaignDuration });
    res.json(story);
  } catch (err: any) {
    res.json({
      title: 'Караван на Перепутье Семи Дорог',
      setting: 'На широкой развилке древних трактов встал лагерем торговый караван купца Бальтазара. Сломанное колесо повозки задерживает путь, а возницы шепчутся о странных огнях в чащобе.',
      genre: 'fantasy',
      campaignDuration: 'medium',
    });
  }
});

router.post('/generateStory', async (req: Request, res: Response): Promise<void> => {
  const story = await storyGeneratorService.generateStory(req.body);
  res.json(story);
});

// POST /api/rooms - Create a new room
router.post('/', authMiddleware, (req: Request, res: Response): void => {
  try {
    const userId = (req as any).userId;
    const { title, setting, genre, campaignDuration, turnMode, deepseekApiKey, deepseekModel } = req.body;

    if (!title || !setting) {
      res.status(400).json({ error: 'Название и описание сеттинга обязательны для создания комнаты' });
      return;
    }

    let code = generateRoomCode();
    while (db.rooms.findByCode(code)) {
      code = generateRoomCode();
    }

    // Encrypt room API key using AES-256-GCM before saving to database
    const encryptedKey = deepseekApiKey?.trim() ? cryptoService.encrypt(deepseekApiKey.trim()) : undefined;

    const newRoom: RoomEntity = {
      id: crypto.randomUUID(),
      code,
      hostUserId: userId,
      title: title.trim(),
      setting: setting.trim(),
      genre: genre || 'fantasy',
      campaignDuration: campaignDuration || 'medium',
      turnMode: turnMode === 'simultaneous' ? 'simultaneous' : 'turn_by_turn',
      status: 'waiting',
      roundNumber: 1,
      currentSituation: 'Отряд собрался вместе перед началом опасного пути. Осмотритесь и подготовьтесь к первому действию.',
      deepseekApiKey: encryptedKey,
      deepseekModel: deepseekModel?.trim() || 'deepseek-chat',
      createdAt: new Date().toISOString(),
    };

    const saved = db.rooms.create(newRoom);

    // Automatically add Host as first player in room
    const hostUser = db.users.findById(userId);
    if (hostUser) {
      db.roomPlayers.create({
        id: crypto.randomUUID(),
        roomId: saved.id,
        userId: hostUser.id,
        username: hostUser.username,
        isReady: false,
        hasActedThisRound: false,
        isOnline: true,
        joinedAt: new Date().toISOString(),
      });
    }

    res.status(201).json(sanitizeRoom(saved));
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Ошибка при создании комнаты' });
  }
});

// GET /api/rooms/my - Get all rooms where user is host or player
router.get('/my', authMiddleware, (req: Request, res: Response): void => {
  try {
    const userId = (req as any).userId;
    const allRooms = db.rooms.getAll();
    const userPlayerRecords = db.roomPlayers.findByUserId(userId);
    const joinedRoomIds = new Set(userPlayerRecords.map(rp => rp.roomId));

    // Rooms where user is host OR has a player record
    const userRooms = allRooms.filter(r => r.hostUserId === userId || joinedRoomIds.has(r.id));

    const summaries = userRooms.map(room => {
      const roomPlayers = db.roomPlayers.findByRoomId(room.id);
      const myPlayerRecord = roomPlayers.find(p => p.userId === userId);
      const myCharacter = myPlayerRecord?.characterId
        ? db.characters.findById(myPlayerRecord.characterId)
        : undefined;

      const isHost = room.hostUserId === userId;

      return {
        id: room.id,
        code: room.code,
        title: room.title,
        setting: room.setting,
        status: room.status,
        roundNumber: room.roundNumber,
        currentSituation: room.currentSituation,
        isHost,
        playerCount: roomPlayers.length,
        maxPlayers: 6,
        myPlayer: myPlayerRecord ? {
          id: myPlayerRecord.id,
          username: myPlayerRecord.username,
          isReady: myPlayerRecord.isReady,
          hasActedThisRound: myPlayerRecord.hasActedThisRound,
        } : undefined,
        myCharacter: myCharacter ? {
          id: myCharacter.id,
          name: myCharacter.name,
          characterClass: myCharacter.characterClass,
          race: myCharacter.race,
          level: myCharacter.level,
          hpCurrent: myCharacter.hpCurrent,
          hpMax: myCharacter.hpMax,
          avatarUrl: myCharacter.avatarUrl,
        } : undefined,
        genre: room.genre,
        campaignDuration: room.campaignDuration,
        campaignMap: room.campaignMap,
        createdAt: room.createdAt,
      };
    });

    // Sort by createdAt descending (newest first)
    summaries.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    res.json(summaries);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Ошибка получения списка комнат' });
  }
});

// GET /api/rooms/:code - Get room details by code
router.get('/:code', authMiddleware, (req: Request, res: Response): void => {
  const room = db.rooms.findByCode(req.params.code);
  if (!room) {
    res.status(404).json({ error: 'Комната не найдена' });
    return;
  }

  const roomData = gameSessionService.getRoomAndPlayers(room.code);
  const logs = db.gameLogs.findByRoomId(room.id);

  res.json({
    room: roomData?.room || sanitizeRoom(room),
    players: roomData?.players || [],
    logs,
  });
});

// POST /api/rooms/:code/join - Join a room
router.post('/:code/join', authMiddleware, (req: Request, res: Response): void => {
  try {
    const userId = (req as any).userId;
    const user = db.users.findById(userId);
    if (!user) {
      res.status(404).json({ error: 'Пользователь не найден' });
      return;
    }

    const result = gameSessionService.joinRoom(req.params.code, userId, user.username);
    if (!result) {
      res.status(404).json({ error: 'Комната не найдена' });
      return;
    }
    if ('error' in result) {
      res.status(400).json({ error: result.error });
      return;
    }

    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Ошибка присоединения к комнате' });
  }
});

// POST /api/rooms/:code/settings - Update room settings (host only)
router.post('/:code/settings', authMiddleware, (req: Request, res: Response): void => {
  const userId = (req as any).userId;
  const room = db.rooms.findByCode(req.params.code);
  if (!room) {
    res.status(404).json({ error: 'Комната не найдена' });
    return;
  }

  if (room.hostUserId !== userId) {
    res.status(403).json({ error: 'Только создатель комнаты может менять настройки' });
    return;
  }

  const { deepseekApiKey, deepseekModel, setting } = req.body;
  const updates: Partial<RoomEntity> = {};

  // Encrypt updated API key if provided
  if (deepseekApiKey !== undefined) {
    updates.deepseekApiKey = deepseekApiKey.trim() ? cryptoService.encrypt(deepseekApiKey.trim()) : undefined;
  }
  if (deepseekModel !== undefined) updates.deepseekModel = deepseekModel.trim();
  if (setting !== undefined) updates.setting = setting.trim();

  const updated = db.rooms.update(room.id, updates);
  res.json({ success: true, room: sanitizeRoom(updated) });
});

export default router;
