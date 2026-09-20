import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '3001', 10),
  jwtSecret: process.env.JWT_SECRET || 'mauporia-dnd-secret-key-2026',
  deepseekApiKey: process.env.DEEPSEEK_API_KEY || '',
  deepseekModel: process.env.DEEPSEEK_MODEL || 'deepseek-chat',
  geminiApiKey: process.env.GEMINI_API_KEY || '',
  dataDir: path.resolve(__dirname, '../../data'),
};
