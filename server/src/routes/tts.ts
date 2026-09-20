import { Router } from 'express';
import { ttsService } from '../services/tts';
import { MoodType } from '../domain/types';
import fs from 'fs';

const router = Router();

// GET /api/tts?text=...&mood=...
router.get('/', async (req, res) => {
  try {
    const text = (req.query.text as string) || '';
    const mood = (req.query.mood as MoodType) || undefined;

    if (!text || text.trim().length === 0) {
      return res.status(400).json({ error: 'Text parameter is required' });
    }

    const safeText = text.slice(0, 10000);
    const { filePath, mood: detectedMood } = await ttsService.synthesize(safeText, mood);

    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('X-Detected-Mood', detectedMood);
    res.setHeader('Cache-Control', 'public, max-age=86400');

    const readStream = fs.createReadStream(filePath);
    readStream.pipe(res);
  } catch (error: any) {
    console.error('TTS Generation Error:', error);
    res.status(500).json({ error: 'Failed to synthesize speech', details: error.message });
  }
});

// POST /api/tts { text, mood }
router.post('/', async (req, res) => {
  try {
    const { text, mood } = req.body;
    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      return res.status(400).json({ error: 'Text field is required' });
    }

    const safeText = text.slice(0, 10000);
    const { filePath, mood: detectedMood } = await ttsService.synthesize(safeText, mood);

    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('X-Detected-Mood', detectedMood);
    res.setHeader('Cache-Control', 'public, max-age=86400');

    const readStream = fs.createReadStream(filePath);
    readStream.pipe(res);
  } catch (error: any) {
    console.error('TTS Generation Error:', error);
    res.status(500).json({ error: 'Failed to synthesize speech', details: error.message });
  }
});

export default router;
