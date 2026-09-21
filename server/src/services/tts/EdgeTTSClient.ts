import { MsEdgeTTS, OUTPUT_FORMAT } from 'msedge-tts';

export interface ProsodyOptions {
  rate: string;
  pitch: string;
  volume: string;
}

export interface ITTSClient {
  synthesizeChunk(chunk: string, prosody: ProsodyOptions): Promise<Buffer>;
}

export class EdgeTTSClient implements ITTSClient {
  private voice: string;

  constructor(voice: string = 'ru-RU-DmitryNeural') {
    this.voice = voice;
  }

  public async synthesizeChunk(chunk: string, prosody: ProsodyOptions, retries = 2): Promise<Buffer> {
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        const tts = new MsEdgeTTS();
        await tts.setMetadata(this.voice, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3);

        const { audioStream } = tts.toStream(chunk, {
          rate: prosody.rate,
          pitch: prosody.pitch,
          volume: prosody.volume,
        });

        return await new Promise<Buffer>((resolve, reject) => {
          const buffers: Buffer[] = [];
          audioStream.on('data', (part: Buffer) => buffers.push(part));
          audioStream.on('end', () => resolve(Buffer.concat(buffers)));
          audioStream.on('error', (err: any) => reject(err));
        });
      } catch (err: any) {
        if (attempt >= retries) {
          throw err;
        }
        // Brief backoff before retry
        await new Promise((resolve) => setTimeout(resolve, 350 * attempt));
      }
    }
    throw new Error('TTS synthesis failed after retries');
  }
}

export const edgeTTSClient = new EdgeTTSClient();
