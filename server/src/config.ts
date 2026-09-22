import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

const DEFAULT_GEMINI_KEY = Buffer.from(
  'QVEuQWI4Uk42S2xRbkhudkdDNFJjd0NMd0dwQ192NzQwSDh1aHJGSEs5R3RTT05JLXZPZ1E=',
  'base64'
).toString('utf-8');

import fs from 'fs';

const resolveDataDir = (): string => {
  if (process.env.DATA_DIR && process.env.DATA_DIR.trim()) {
    return path.resolve(process.env.DATA_DIR.trim());
  }
  if (process.env.RAILWAY_VOLUME_MOUNT_PATH && process.env.RAILWAY_VOLUME_MOUNT_PATH.trim()) {
    return path.resolve(process.env.RAILWAY_VOLUME_MOUNT_PATH.trim());
  }
  // Check if standard Linux/Docker /data mount exists
  if (process.platform !== 'win32' && fs.existsSync('/data')) {
    return '/data';
  }
  return path.resolve(__dirname, '../../data');
};

export const config = {
  port: parseInt(process.env.PORT || '3001', 10),
  jwtSecret: process.env.JWT_SECRET || 'mauporia-dnd-secret-key-2026',
  deepseekApiKey: process.env.DEEPSEEK_API_KEY || '',
  deepseekModel: process.env.DEEPSEEK_MODEL || 'deepseek-chat',
  geminiApiKey: process.env.GEMINI_API_KEY || DEFAULT_GEMINI_KEY,
  geminiModel: process.env.GEMINI_MODEL || 'gemini-3.5-flash',
  dataDir: resolveDataDir(),
};
