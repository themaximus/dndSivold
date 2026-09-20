export interface ITextChunker {
  chunk(text: string, maxChunkLen?: number): string[];
}

export class SentenceChunker implements ITextChunker {
  public chunk(text: string, maxChunkLen = 420): string[] {
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
          // Fallback for unusually long sentence: split on spaces
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
}

export const sentenceChunker = new SentenceChunker();
