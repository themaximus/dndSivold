import { Server } from 'socket.io';

export interface StreamNarrativeOptions {
  chunkSize?: number;
  delayMs?: number;
}

export class StreamingAIService {
  /**
   * Progressively streams a generated narrative text to players in the room,
   * providing immediate tactile feedback and DM storytelling ambiance.
   */
  public async streamNarrativeToRoom(
    io: Server,
    roomId: string,
    logId: string,
    narrativeText: string,
    options: StreamNarrativeOptions = {}
  ): Promise<void> {
    if (!narrativeText || !narrativeText.trim()) return;

    const chunkSize = options.chunkSize || 30; // ~5-7 words per chunk
    const delayMs = options.delayMs || 35; // 35ms cadence creates a natural reading speed

    io.to(roomId).emit('narrative_stream_start', {
      logId,
      totalLength: narrativeText.length,
    });

    let currentOffset = 0;
    let accumulatedText = '';

    while (currentOffset < narrativeText.length) {
      // Find a natural word boundary near currentOffset + chunkSize
      let nextOffset = Math.min(currentOffset + chunkSize, narrativeText.length);
      if (nextOffset < narrativeText.length) {
        const spaceIdx = narrativeText.indexOf(' ', nextOffset);
        if (spaceIdx !== -1 && spaceIdx - nextOffset < 15) {
          nextOffset = spaceIdx + 1;
        }
      }

      const chunk = narrativeText.slice(currentOffset, nextOffset);
      accumulatedText += chunk;
      currentOffset = nextOffset;

      io.to(roomId).emit('narrative_chunk', {
        logId,
        chunk,
        accumulatedText,
        isComplete: currentOffset >= narrativeText.length,
      });

      if (delayMs > 0 && currentOffset < narrativeText.length) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }

    io.to(roomId).emit('narrative_stream_end', {
      logId,
      fullNarrative: narrativeText,
    });
  }

  /**
   * Creates a token emitter callback for providers supporting real-time SSE streaming.
   */
  public createTokenEmitter(
    io: Server,
    roomId: string,
    logId: string
  ): (token: string) => void {
    let accumulated = '';
    return (token: string) => {
      accumulated += token;
      io.to(roomId).emit('narrative_chunk', {
        logId,
        chunk: token,
        accumulatedText: accumulated,
        isComplete: false,
      });
    };
  }
}

export const streamingAIService = new StreamingAIService();
