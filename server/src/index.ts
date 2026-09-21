import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { config } from './config';
import authRoutes from './routes/auth';
import characterRoutes from './routes/characters';
import roomRoutes from './routes/rooms';
import ttsRoutes from './routes/tts';
import { setupGameSockets } from './sockets/gameSocket';

const app = express();
const server = http.createServer(app);

// Configure Socket.IO
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
    credentials: true,
  },
  transports: ['websocket', 'polling'],
  pingTimeout: 30000,
  pingInterval: 25000,
  maxHttpBufferSize: 1e6,
});

app.use(cors());
app.use(express.json());

import { storyGeneratorService } from './services/ai/StoryGeneratorService';

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/characters', characterRoutes);
app.use('/api/rooms', roomRoutes);
app.use('/api/tts', ttsRoutes);

// Story generation aliases (POST & GET) to guarantee no 404s
const handleStoryGen = async (req: express.Request, res: express.Response) => {
  try {
    const params = req.method === 'GET' ? req.query : req.body;
    const story = await storyGeneratorService.generateStory(params as any);
    res.json(story);
  } catch (err: any) {
    res.json({
      title: 'Караван на Перепутье Семи Дорог',
      setting: 'На широкой развилке древних трактов встал лагерем торговый караван купца Бальтазара. Сломанное колесо повозки задерживает путь, а возницы шепчутся о странных огнях в чащобе. Купец ищет спутников, предлагает редкие диковинки и готов щедро наградить за помощь и охрану в пути.',
      genre: 'fantasy',
      campaignDuration: 'medium',
    });
  }
};
app.post('/api/generate-story', handleStoryGen);
app.get('/api/generate-story', handleStoryGen);
app.post('/api/story/generate', handleStoryGen);
app.get('/api/story/generate', handleStoryGen);

// Favicon handler to avoid browser 404 logs
app.get('/favicon.ico', (_req, res) => res.status(204).end());

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    aiConfigured: !!config.deepseekApiKey,
    deepseekConfigured: !!config.deepseekApiKey,
    timestamp: new Date().toISOString(),
  });
});

// Setup WebSockets
setupGameSockets(io);

// Serve static frontend in production / fallback
import path from 'path';
import fs from 'fs';

const possibleClientPaths = [
  path.resolve(__dirname, '../../client/dist'),
  path.resolve(__dirname, '../client/dist'),
  path.resolve(__dirname, '../../../client/dist'),
  path.resolve(process.cwd(), 'client/dist'),
  path.resolve(process.cwd(), 'dist'),
];
const clientDist = possibleClientPaths.find(p => fs.existsSync(path.join(p, 'index.html'))) || possibleClientPaths[0];

app.use(express.static(clientDist));
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api') || req.path.startsWith('/socket.io')) {
    return next();
  }
  const indexPath = path.join(clientDist, 'index.html');
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(200).send('СиволДнДаево AI Dungeon Master API Server Running');
  }
});

// Start server
server.listen(config.port, () => {
  console.log(`
=====================================================
🛡️  СИВОЛДНДАЕВО - AI DUNGEON MASTER SERVER RUNNING
=====================================================
⚡ Server Port:        http://localhost:${config.port}
🎲 AI Master Engine:   ${config.deepseekApiKey ? 'Configured (Global Key Active)' : 'Waiting for Room Key or Simulation Mode'}
🗡️  D&D 5e Anti-Cheat:  Enabled (Server-Side Dice Engine)
=====================================================
`);
});
