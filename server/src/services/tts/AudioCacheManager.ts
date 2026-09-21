import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { config } from '../../config';

export interface IAudioCache {
  get(key: string): string | null;
  set(key: string, buffer: Buffer): string;
  createKey(text: string, mood?: string): string;
}

export class AudioCacheManager implements IAudioCache {
  private cacheDir: string;

  constructor(cacheDir?: string) {
    this.cacheDir = cacheDir || path.join(config.dataDir, 'audio_cache');
    this.init();
  }

  private init(): void {
    if (!fs.existsSync(this.cacheDir)) {
      try {
        fs.mkdirSync(this.cacheDir, { recursive: true });
      } catch (err) {
        console.warn('Could not create audio cache directory:', err);
      }
    }
  }

  public createKey(text: string, mood: string = 'neutral'): string {
    return crypto.createHash('md5').update(`${text}_${mood}`).digest('hex');
  }

  public get(key: string): string | null {
    const filePath = path.join(this.cacheDir, `${key}.mp3`);
    if (fs.existsSync(filePath) && fs.statSync(filePath).size > 1000) {
      return filePath;
    }
    return null;
  }

  public set(key: string, buffer: Buffer): string {
    const filePath = path.join(this.cacheDir, `${key}.mp3`);
    fs.writeFileSync(filePath, buffer);
    return filePath;
  }
}

export const audioCacheManager = new AudioCacheManager();
