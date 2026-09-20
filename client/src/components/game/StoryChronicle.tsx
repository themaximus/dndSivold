import React, { useEffect, useRef } from 'react';
import { GameLogEntry } from '../../types';
import { ChronicleLogEntry } from './ChronicleLogEntry';

interface StoryChronicleProps {
  logs: GameLogEntry[];
  loadingLogId: string | null;
  isSpeakingText: (text?: string) => boolean;
  onToggleVoice: (logId: string, narrativeText: string) => void;
}

export const StoryChronicle: React.FC<StoryChronicleProps> = ({
  logs,
  loadingLogId,
  isSpeakingText,
  onToggleVoice,
}) => {
  const logEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
      {logs.map(log => (
        <ChronicleLogEntry
          key={log.id}
          log={log}
          isPlaying={isSpeakingText(log.narrativeText)}
          isLoading={loadingLogId === log.id}
          onToggleVoice={() => onToggleVoice(log.id, log.narrativeText)}
        />
      ))}
      <div ref={logEndRef} />
    </div>
  );
};
