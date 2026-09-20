import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

const DEFAULT_GEMINI_KEY = Buffer.from(
  'QVEuQWI4Uk42S2xRbkhudkdDNFJjd0NMd0dwQ192NzQwSDh1aHJGSEs5R3RTT05JLXZPZ1E=',
  'base64'
).toString('utf-8');

export const config = {
  port: parseInt(process.env.PORT || '3001', 10),
  jwtSecret: process.env.JWT_SECRET || 'mauporia-dnd-secret-key-2026',
  deepseekApiKey: process.env.DEEPSEEK_API_KEY || '',
  deepseekModel: process.env.DEEPSEEK_MODEL || 'deepseek-chat',
  geminiApiKey: process.env.GEMINI_API_KEY || DEFAULT_GEMINI_KEY,
  geminiModel: process.env.GEMINI_MODEL || 'gemini-3.1-flash-lite',
  dataDir: path.resolve(__dirname, '../../data'),
};
