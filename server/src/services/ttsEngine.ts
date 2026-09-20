import { MsEdgeTTS, OUTPUT_FORMAT } from 'msedge-tts';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

export type MoodType = 'combat' | 'tension' | 'mystery' | 'triumph' | 'calm' | 'neutral';

const CACHE_DIR = path.resolve(__dirname, '../../data/audio_cache');
if (!fs.existsSync(CACHE_DIR)) {
  try {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
  } catch (e) {
    console.warn('Could not create audio cache dir', e);
  }
}

/**
 * D&D 5e Stress & Phonetic Dictionary for Russian Neural TTS (ru-RU-DmitryNeural).
 * Uses standard Russian combining acute accent (\u0301) to guarantee proper actor stresses.
 * Also restores missing 'ё' which is essential for natural Russian neural pronunciation.
 */
const STRESS_CORRECTIONS: Array<[RegExp, string]> = [
  // Characters & Specific Names
  [/(?<!\p{L})Кирильчик([а-яё]*)/giu, 'Кири́льчик$1'],
  [/(?<!\p{L})Кирильчик/giu, 'Кири́льчик'],

  // Fantasy Races
  [/(?<!\p{L})хобгоблин([а-яё]*)/giu, 'хо́бгоблин$1'],
  [/(?<!\p{L})хобгоблин/giu, 'хо́бгоблин'],
  [/(?<!\p{L})дворф([а-яё]*)/giu, 'дво́рф$1'],
  [/(?<!\p{L})дворф/giu, 'дво́рф'],
  [/(?<!\p{L})тифлинг([а-яё]*)/giu, 'ти́флинг$1'],
  [/(?<!\p{L})полуорк([а-яё]*)/giu, 'полуо́рк$1'],

  // Classes & Archetypes
  [/(?<!\p{L})паладин([а-яё]*)/giu, 'палади́н$1'],
  [/(?<!\p{L})варвар([а-яё]*)/giu, 'ва́рвар$1'],
  [/(?<!\p{L})плут([а-яё]*)/giu, 'плу́т$1'],
  [/(?<!\p{L})бард([а-яё]*)/giu, 'ба́рд$1'],
  [/(?<!\p{L})следопыт([а-яё]*)/giu, 'следопы́т$1'],
  [/(?<!\p{L})колдун([а-яё]*)/giu, 'колду́н$1'],
  [/(?<!\p{L})чародей([а-яё]*)/giu, 'чароде́й$1'],
  [/(?<!\p{L})жрец([а-яё]*)/giu, 'жре́ц$1'],

  // Weapons, Combat & Items
  [/(?<!\p{L})эфес([а-яё]*)/giu, 'эфе́с$1'],
  [/(?<!\p{L})эфесом/giu, 'эфе́сом'],
  [/(?<!\p{L})секира([а-яё]*)/giu, 'секи́ра$1'],
  [/(?<!\p{L})секирой/giu, 'секи́рой'],
  [/(?<!\p{L})арбалет([а-яё]*)/giu, 'арбале́т$1'],
  [/(?<!\p{L})кинжал([а-яё]*)/giu, 'кинжа́л$1'],
  [/(?<!\p{L})булава([а-яё]*)/giu, 'булава́$1'],
  [/(?<!\p{L})хабарчик([а-яё]*)/giu, 'хаба́рчик$1'],
  [/(?<!\p{L})зелье([а-яё]*)/giu, 'зе́лье$1'],
  [/(?<!\p{L})спасбросок([а-яё]*)/giu, 'спасбросо́к$1'],
  [/(?<!\p{L})инспирация([а-яё]*)/giu, 'инспира́ция$1'],
  [/(?<!\p{L})палая/giu, 'па́лая'],
  [/(?<!\p{L})палую/giu, 'па́лую'],
  [/(?<!\p{L})палой/giu, 'па́лой'],
  [/(?<!\p{L})склеп([а-яё]*)/giu, 'скле́п$1'],

  // Missing 'ё' restoration for correct neural phonetics
  [/(?<!\p{L})тяжел([а-яё]+)/giu, 'тяжёл$1'],
  [/(?<!\p{L})нанес([а-яё]*)/giu, 'нанёс$1'],
  [/(?<!\p{L})ослепленн([а-яё]+)/giu, 'ослеплённ$1'],
  [/(?<!\p{L})сражен([а-яё]*)/giu, 'сражён$1'],
  [/(?<!\p{L})рассечен([а-яё]*)/giu, 'рассечён$1'],
  [/(?<!\p{L})разъярен([а-яё]*)/giu, 'разъярён$1'],
  [/(?<!\p{L})сокрушен([а-яё]*)/giu, 'сокрушён$1'],
  [/(?<!\p{L})мертв([а-яё]+)/giu, 'мёртв$1'],
  [/(?<!\p{L})темн([а-яё]+)/giu, 'тёмн$1'],
  [/(?<!\p{L})черн([а-яё]+)/giu, 'чёрн$1'],
];

/**
 * Cleans out technical game mechanics, dice roll annotations,
 * damage notifications, and applies pronunciation enhancements.
 */
export function cleanNarrativeForSpeech(rawText: string): string {
  let cleaned = rawText;

  // 1. Remove parenthetical game mechanic annotations e.g.:
  // "(итоговый результат проверки 5)"
  // "(СЛ 14, провал)"
  // "(критический успех!)"
  // "(урон: 8)"
  cleaned = cleaned.replace(/\([^)]*(?:проверк|бросок|результат|итогов|кубик|d20|к20|сложност|сл\s*\d|hp|хп|урон|модификатор|спасбросок|кб)[^)]*\)/giu, '');

  // 2. Remove square brackets with rolls e.g. [Кость: d20...], [Цель: ...]
  cleaned = cleaned.replace(/\[[^\]]*\]/gu, '');

  // 3. Remove standalone dice mechanic codes: "d20", "2d6+3", "1к20", "2к6"
  cleaned = cleaned.replace(/(?<!\p{L})\d*[dkдк]\d+(\s*[\+\-]\s*\d+)?(?!\p{L})/giu, '');

  // 4. Remove standalone HP / AC / Damage notifications like "-4 HP", "HP -4", "КБ 16"
  cleaned = cleaned.replace(/[-+]\s*\d+\s*(HP|ХП|хп|hp)(?!\p{L})/giu, '');
  cleaned = cleaned.replace(/(?<!\p{L})(HP|ХП|хп|hp)\s*[-+:]\s*\d+(?!\p{L})/giu, '');
  cleaned = cleaned.replace(/(?<!\p{L})(КБ|AC)\s*[:=\-]?\s*\d+(?!\p{L})/giu, '');

  // 5. Remove question to players at end like "Что делает Кирильчик?", "Что вы делаете?"
  cleaned = cleaned.replace(/Что\s+(?:вы\s+делаете|делает\s+[\p{L}]+)\??/giu, '');

  // 6. Remove DM/Round prefixes like "Мастер:", "Раунд 8:"
  cleaned = cleaned.replace(/^(?:Мастер|DM|Хроника(?:\s+раунда\s+\d+)?|Раунд\s+\d+)\s*[:\-]\s*/giu, '');

  // 7. Remove HTML tags and markdown symbols
  cleaned = cleaned.replace(/<[^>]*>?/gm, '');
  cleaned = cleaned.replace(/[*_~`#\[\]]/gu, '');

  // 8. Remove dangling empty parentheses
  cleaned = cleaned.replace(/\(\s*\)/gu, '');

  // 9. Apply D&D stress & phonetic dictionary
  for (const [pattern, replacement] of STRESS_CORRECTIONS) {
    cleaned = cleaned.replace(pattern, replacement);
  }

  // 10. Normalize whitespace and punctuation spacing
  cleaned = cleaned.replace(/\s+/gu, ' ');
  cleaned = cleaned.replace(/\s+([,\.!\?:;])/gu, '$1');

  return cleaned.trim();
}

/**
 * Intelligent text heuristic for mood detection if not explicitly passed by DM
 */
export function detectMood(text: string): MoodType {
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

/**
 * Prosody rules: pitch and rate dynamic modulation for DM atmosphere
 */
export function getProsodyForMood(mood: MoodType) {
  switch (mood) {
    case 'combat':
      // Dynamic, fast-paced, alert and forceful
      return { rate: '+6%', pitch: '+2Hz', volume: '+0%' };
    case 'tension':
      // Slow, hushed, deep dungeon dread
      return { rate: '-5%', pitch: '-4Hz', volume: '+0%' };
    case 'mystery':
      // Introspective, deep and measured
      return { rate: '-4%', pitch: '-3Hz', volume: '+0%' };
    case 'triumph':
      // Heroic, elevated, resonant
      return { rate: '+3%', pitch: '+3Hz', volume: '+0%' };
    case 'calm':
      // Warm, cozy storyteller pacing
      return { rate: '-2%', pitch: '-2Hz', volume: '+0%' };
    case 'neutral':
    default:
      // Cinematic fantasy narrator baseline (deep & velvet)
      return { rate: '-1%', pitch: '-2Hz', volume: '+0%' };
  }
}

/**
 * Splits text into sentence-aware chunks of safe size (~400 chars)
 * to prevent Edge Neural TTS payload timeouts and enable parallel synthesis.
 */
export function splitIntoSafeChunks(text: string, maxChunkLen = 420): string[] {
  if (text.length <= maxChunkLen) {
    return [text];
  }

  const sentences = text.match(/[^.!?]+[.!?]+|\S+$/gu) || [text];
  const chunks: string[] = [];
  let currentChunk = '';

  for (const sentence of sentences) {
    const trimmed = sentence.trim();
    if (!trimmed) continue;

    if ((currentChunk + ' ' + trimmed).trim().length <= maxChunkLen) {
      currentChunk = currentChunk ? `${currentChunk} ${trimmed}` : trimmed;
    } else {
      if (currentChunk) chunks.push(currentChunk);

      if (trimmed.length > maxChunkLen) {
        // Fallback for unusually long sentence: split on commas or spaces
        const words = trimmed.split(' ');
        let subChunk = '';
        for (const w of words) {
          if ((subChunk + ' ' + w).trim().length <= maxChunkLen) {
            subChunk = subChunk ? `${subChunk} ${w}` : w;
          } else {
            if (subChunk) chunks.push(subChunk);
            subChunk = w;
          }
        }
        currentChunk = subChunk || '';
      } else {
        currentChunk = trimmed;
      }
    }
  }

  if (currentChunk) {
    chunks.push(currentChunk);
  }

  return chunks;
}

/**
 * Synthesizes a single chunk using a dedicated MsEdgeTTS instance.
 */
async function synthesizeChunkBuffer(
  chunk: string,
  prosody: { rate: string; pitch: string; volume: string }
): Promise<Buffer> {
  const tts = new MsEdgeTTS();
  await tts.setMetadata('ru-RU-DmitryNeural', OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3);

  const { audioStream } = tts.toStream(chunk, {
    rate: prosody.rate,
    pitch: prosody.pitch,
    volume: prosody.volume,
  });

  return new Promise((resolve, reject) => {
    const buffers: Buffer[] = [];
    audioStream.on('data', (part: Buffer) => buffers.push(part));
    audioStream.on('end', () => resolve(Buffer.concat(buffers)));
    audioStream.on('error', (err: any) => reject(err));
  });
}

/**
 * Synthesizes speech using Microsoft Edge Neural TTS (ru-RU-DmitryNeural).
 * Features:
 * - Technical message removal (clean fantasy immersion)
 * - Accent and phonetics dictionary
 * - Parallel chunking for large texts with zero timeout
 * - Disk caching for instant (< 50ms) replay
 */
export async function getOrGenerateSpeech(
  rawText: string,
  moodOverride?: MoodType
): Promise<{ filePath: string; mood: MoodType }> {
  const clean = cleanNarrativeForSpeech(rawText);
  const mood = moodOverride && moodOverride !== 'neutral' ? moodOverride : detectMood(clean);
  const prosody = getProsodyForMood(mood);

  // Hash key for file cache based on cleaned text & mood
  const hash = crypto.createHash('md5').update(`${clean}_${mood}`).digest('hex');
  const cachedFilePath = path.join(CACHE_DIR, `${hash}.mp3`);

  if (fs.existsSync(cachedFilePath) && fs.statSync(cachedFilePath).size > 1000) {
    return { filePath: cachedFilePath, mood };
  }

  // Split into safe chunks for fast parallel synthesis
  const chunks = splitIntoSafeChunks(clean);

  // Run chunks in parallel across Edge TTS instances
  const chunkBuffers = await Promise.all(
    chunks.map((chunk) => synthesizeChunkBuffer(chunk, prosody))
  );

  // Combine MP3 audio frames into one seamless file
  const combinedBuffer = Buffer.concat(chunkBuffers);
  fs.writeFileSync(cachedFilePath, combinedBuffer);

  return { filePath: cachedFilePath, mood };
}
