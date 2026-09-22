import { GameLogEntity, RoomEntity } from '../../db';

export interface CompressedEpisodicMemory {
  roundRange: string;
  summary: string;
  significantEvents: string[];
}

export class EpisodicMemoryCompressor {
  /**
   * Maximum number of raw, uncompressed recent logs kept in prompt context.
   */
  private readonly RECENT_WINDOW_SIZE = 3;

  /**
   * Compresses logs older than RECENT_WINDOW_SIZE into concise episodic memories.
   * Prevents LLM context window overflow while preserving long-term narrative causality.
   */
  public compressLogs(
    logs: GameLogEntity[],
    room: RoomEntity
  ): {
    recentLogs: GameLogEntity[];
    episodicSummaries: string[];
    consolidatedMemoryText: string;
  } {
    if (!logs || logs.length === 0) {
      return {
        recentLogs: [],
        episodicSummaries: [],
        consolidatedMemoryText: '',
      };
    }

    // Sort chronologically ascending
    const sortedLogs = [...logs].sort((a, b) => a.roundNumber - b.roundNumber);

    // If total logs <= RECENT_WINDOW_SIZE, no compression needed yet
    if (sortedLogs.length <= this.RECENT_WINDOW_SIZE) {
      return {
        recentLogs: sortedLogs,
        episodicSummaries: [],
        consolidatedMemoryText: '',
      };
    }

    const splitIndex = sortedLogs.length - this.RECENT_WINDOW_SIZE;
    const olderLogs = sortedLogs.slice(0, splitIndex);
    const recentLogs = sortedLogs.slice(splitIndex);

    const episodicSummaries: string[] = [];

    // Group older logs into chronological chunks (e.g. 2-3 rounds per episode)
    const chunkSize = 3;
    for (let i = 0; i < olderLogs.length; i += chunkSize) {
      const chunk = olderLogs.slice(i, i + chunkSize);
      const startRound = chunk[0].roundNumber;
      const endRound = chunk[chunk.length - 1].roundNumber;
      const roundLabel = startRound === endRound ? `Раунд ${startRound}` : `Раунды ${startRound}–${endRound}`;

      const beats: string[] = [];
      for (const log of chunk) {
        const actionSnippet = log.actionsSummary ? log.actionsSummary.trim() : '';
        // Extract 1-2 key sentences from narrative (avoid bloated paragraphs)
        const narrativeFirstSentence = (log.narrativeText || '')
          .split(/[.!?]\s+/)
          .filter((s) => s.trim().length > 10)
          .slice(0, 2)
          .join('. ');

        if (actionSnippet && narrativeFirstSentence) {
          beats.push(`• [${actionSnippet}]: ${narrativeFirstSentence}.`);
        } else if (narrativeFirstSentence) {
          beats.push(`• ${narrativeFirstSentence}.`);
        } else if (actionSnippet) {
          beats.push(`• Действия героев: ${actionSnippet}.`);
        }
      }

      if (beats.length > 0) {
        episodicSummaries.push(`📜 ${roundLabel}:\n${beats.join('\n')}`);
      }
    }

    // Include existing room milestones / lore journal entries if available
    const milestones = room.loreJournal || [];
    const milestoneSummaries = milestones.map((m) => `⭐ [Р${m.round}]: ${m.milestone}`);

    const consolidatedMemoryText = [
      ...episodicSummaries,
      ...(milestoneSummaries.length > 0 ? ['\n🏆 Ключевые вехи приключения:', ...milestoneSummaries] : []),
    ].join('\n\n');

    return {
      recentLogs,
      episodicSummaries,
      consolidatedMemoryText,
    };
  }

  /**
   * Augments an AI DM Context's campaign plot or situation with episodic memory
   * if older logs exist.
   */
  public augmentContextWithMemory(
    contextText: string | undefined,
    consolidatedMemory: string
  ): string {
    if (!consolidatedMemory || !consolidatedMemory.trim()) {
      return contextText || '';
    }

    const memoryHeader = `\n\n🧠 ЭПИЗОДИЧЕСКАЯ ДОЛГОВРЕМЕННАЯ ПАМЯТЬ (ПРЕДЫДУЩИЕ СОБЫТИЯ ПОХОДА):\n${consolidatedMemory}\n`;
    return (contextText || '') + memoryHeader;
  }
}

export const episodicMemoryCompressor = new EpisodicMemoryCompressor();
