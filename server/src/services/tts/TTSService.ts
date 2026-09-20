import { ITextSanitizer, dndTextSanitizer } from './DndTextSanitizer';
import { IStressDictionary, dndStressDictionary } from './DndStressDictionary';
import { ITextChunker, sentenceChunker } from './SentenceChunker';
import { ITTSClient, edgeTTSClient, ProsodyOptions } from './EdgeTTSClient';
import { IAudioCache, audioCacheManager } from './AudioCacheManager';
import { MoodType } from '../../domain/types';

export interface ITTSService {
  synthesize(rawText: string, moodOverride?: MoodType): Promise<{ filePath: string; mood: MoodType }>;
  detectMood(text: string): MoodType;
}

export class TTSService implements ITTSService {
  private sanitizer: ITextSanitizer;
  private stressDictionary: IStressDictionary;
  private chunker: ITextChunker;
  private ttsClient: ITTSClient;
  private cache: IAudioCache;

  constructor(
    sanitizer: ITextSanitizer = dndTextSanitizer,
    stressDictionary: IStressDictionary = dndStressDictionary,
    chunker: ITextChunker = sentenceChunker,
    ttsClient: ITTSClient = edgeTTSClient,
    cache: IAudioCache = audioCacheManager
  ) {
    this.sanitizer = sanitizer;
    this.stressDictionary = stressDictionary;
    this.chunker = chunker;
    this.ttsClient = ttsClient;
    this.cache = cache;
  }

  public detectMood(text: string): MoodType {
    const lower = text.toLowerCase();
    if (/(атак|удар|клинок|меч|рубит|кров|бой|сражен|выпад|стрел|заклинани|взрыв|чудовищ|урон|ранил)/i.test(lower)) {
      return 'combat';
    }
    if (/(крад|тень|темнот|тишин|шепот|ловушк|опасност|пещер|мрак|склеп|запах гнил|шорох|жутк)/i.test(lower)) {
      return 'tension';
    }
    if (/(древн|руны|маги|тайн|загадк|свиток|портал|артефакт|свечени|мерцает)/i.test(lower)) {
      return 'mystery';
    }
    if (/(побед|триумф|повержен|наград|сокровищ|спасен|радост|ликован|смерть враг)/i.test(lower)) {
      return 'triumph';
    }
    if (/(таверн|кружк|эль|камин|огонь|отдых|трактир|смех|город|покой|уют)/i.test(lower)) {
      return 'calm';
    }
    return 'neutral';
  }

  public getProsodyForMood(mood: MoodType): ProsodyOptions {
    switch (mood) {
      case 'combat':
        return { rate: '+6%', pitch: '+2Hz', volume: '+0%' };
      case 'tension':
        return { rate: '-5%', pitch: '-4Hz', volume: '+0%' };
      case 'mystery':
        return { rate: '-4%', pitch: '-3Hz', volume: '+0%' };
      case 'triumph':
        return { rate: '+3%', pitch: '+3Hz', volume: '+0%' };
      case 'calm':
        return { rate: '-2%', pitch: '-2Hz', volume: '+0%' };
      case 'neutral':
      default:
        return { rate: '-1%', pitch: '-2Hz', volume: '+0%' };
    }
  }

  public async synthesize(
    rawText: string,
    moodOverride?: MoodType
  ): Promise<{ filePath: string; mood: MoodType }> {
    // 1. Sanitize technical annotations & D&D rolls
    const cleaned = this.sanitizer.sanitize(rawText);

    // 2. Apply stress marks & restore 'ё'
    const accented = this.stressDictionary.apply(cleaned);

    // 3. Detect mood
    const mood = moodOverride && moodOverride !== 'neutral' ? moodOverride : this.detectMood(cleaned);
    const prosody = this.getProsodyForMood(mood);

    // 4. Check cache
    const cacheKey = this.cache.createKey(accented, mood);
    const cachedPath = this.cache.get(cacheKey);
    if (cachedPath) {
      return { filePath: cachedPath, mood };
    }

    // 5. Chunk text
    const chunks = this.chunker.chunk(accented);

    // 6. Synthesize chunks concurrently
    const buffers = await Promise.all(
      chunks.map(c => this.ttsClient.synthesizeChunk(c, prosody))
    );

    // 7. Combine & cache
    const combinedBuffer = Buffer.concat(buffers);
    const savedPath = this.cache.set(cacheKey, combinedBuffer);

    return { filePath: savedPath, mood };
  }
}

export const ttsService = new TTSService();
