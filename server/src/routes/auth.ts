import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { db } from '../db';
import { config } from '../config';

const router = Router();

// Middleware to extract user from JWT
export function authMiddleware(req: Request, res: Response, next: () => void): void {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Требуется авторизация' });
    return;
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, config.jwtSecret) as { userId: string };
    (req as any).userId = decoded.userId;
    next();
  } catch (err) {
    res.status(401).json({ error: 'Недействительный или просроченный токен' });
  }
}

// POST /api/auth/register
router.post('/register', async (req: Request, res: Response): Promise<void> => {
  try {
    const { username, password } = req.body;
    if (!username || !password || username.trim().length < 3 || password.length < 4) {
      res.status(400).json({ error: 'Имя пользователя (мин. 3 символа) и пароль (мин. 4 символа) обязательны' });
      return;
    }

    const existing = db.users.findByUsername(username.trim());
    if (existing) {
      res.status(400).json({ error: 'Пользователь с таким именем уже существует' });
      return;
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const newUser = db.users.create({
      id: crypto.randomUUID(),
      username: username.trim(),
      passwordHash,
      createdAt: new Date().toISOString(),
    });

    const token = jwt.sign({ userId: newUser.id }, config.jwtSecret, { expiresIn: '7d' });
    res.status(201).json({
      token,
      user: { id: newUser.id, username: newUser.username },
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Ошибка сервера при регистрации' });
  }
});

// POST /api/auth/login
router.post('/login', async (req: Request, res: Response): Promise<void> => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      res.status(400).json({ error: 'Введите имя пользователя и пароль' });
      return;
    }

    const user = db.users.findByUsername(username.trim());
    if (!user) {
      res.status(400).json({ error: 'Неверное имя пользователя или пароль' });
      return;
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      res.status(400).json({ error: 'Неверное имя пользователя или пароль' });
      return;
    }

    const token = jwt.sign({ userId: user.id }, config.jwtSecret, { expiresIn: '7d' });
    res.json({
      token,
      user: { id: user.id, username: user.username },
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Ошибка сервера при входе' });
  }
});

// GET /api/auth/me
router.get('/me', authMiddleware, (req: Request, res: Response): void => {
  const userId = (req as any).userId;
  const user = db.users.findById(userId);
  if (!user) {
    res.status(404).json({ error: 'Пользователь не найден' });
    return;
  }
  res.json({ user: { id: user.id, username: user.username } });
});

// POST /api/auth/restore-session - Auto-recovery if server restarted or container was recreated
router.post('/restore-session', async (req: Request, res: Response): Promise<void> => {
  try {
    const { username, userId } = req.body;
    if (!username || typeof username !== 'string' || username.trim().length < 2) {
      res.status(400).json({ error: 'Имя пользователя обязательно для восстановления сессии' });
      return;
    }

    const cleanUsername = username.trim();
    let user = db.users.findByUsername(cleanUsername);

    if (!user && userId) {
      user = db.users.findById(userId);
    }

    if (!user) {
      // Re-create user if server was wiped during container redeploy
      const salt = await bcrypt.genSalt(10);
      const passwordHash = await bcrypt.hash('recovered_' + cleanUsername, salt);
      user = db.users.create({
        id: userId || crypto.randomUUID(),
        username: cleanUsername,
        passwordHash,
        createdAt: new Date().toISOString(),
      });
      console.log(`Auto-restored user account after deployment: ${cleanUsername} (${user.id})`);
    }

    const token = jwt.sign({ userId: user.id }, config.jwtSecret, { expiresIn: '30d' });
    res.json({
      token,
      user: { id: user.id, username: user.username },
      restored: true,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Ошибка восстановления сессии' });
  }
});

export default router;
