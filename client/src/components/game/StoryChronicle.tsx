import React, { useEffect, useRef } from 'react';
import { GameLogEntry, FeedActivity } from '../../types';
import { ChronicleLogEntry } from './ChronicleLogEntry';
import { ChronicleDiceBroadcast, RoomRollBroadcast } from './ChronicleDiceBroadcast';

interface StoryChronicleProps {
  logs: GameLogEntry[];
  loadingLogId: string | null;
  recentActivities?: FeedActivity[];
  isSpeakingText: (text?: string) => boolean;
  onToggleVoice: (logId: string, narrativeText: string) => void;
  activeRoomRolls?: RoomRollBroadcast[];
  activeRoomRoll?: RoomRollBroadcast | null;
  targetDC?: number;
  onDismissRoomRoll?: (id?: string) => void;
}

export const StoryChronicle: React.FC<StoryChronicleProps> = ({
  logs,
  loadingLogId,
  recentActivities,
  isSpeakingText,
  onToggleVoice,
  activeRoomRolls,
  activeRoomRoll,
  targetDC,
  onDismissRoomRoll,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const prevLogsLengthRef = useRef(logs.length);

  const rollsToRender = (activeRoomRolls && activeRoomRolls.length > 0)
    ? activeRoomRolls
    : activeRoomRoll
    ? [activeRoomRoll]
    : [];

  useEffect(() => {
    // Only auto-scroll if the container exists and the user was already near bottom or initial load
    if (logs.length > prevLogsLengthRef.current && containerRef.current) {
      const container = containerRef.current;
      const distanceFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
      if (prevLogsLengthRef.current === 0 || distanceFromBottom < 250) {
        container.scrollTo({
          top: container.scrollHeight,
          behavior: 'smooth',
        });
      }
    }
    prevLogsLengthRef.current = logs.length;
  }, [logs.length]);

  return (
    <div ref={containerRef} className="flex-1 overflow-y-auto p-3 sm:p-5 space-y-4 custom-scrollbar">
      {recentActivities && recentActivities.length > 0 && (
        <div className="space-y-1.5 pb-2 border-b border-slate-800/80 animate-in fade-in">
          {recentActivities.slice(0, 2).map((act) => (
            <div key={act.id} className="text-[11px] font-mono text-amber-200 bg-slate-950/80 px-2.5 py-1 rounded-lg border border-slate-800 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span>{act.text}</span>
            </div>
          ))}
        </div>
      )}
      {logs.map(log => (
        <ChronicleLogEntry
          key={log.id}
          log={log}
          isPlaying={isSpeakingText(log.narrativeText)}
          isLoading={loadingLogId === log.id}
          onToggleVoice={() => onToggleVoice(log.id, log.narrativeText)}
        />
      ))}

      {/* 3D Dice Roll Animation directly inside the Chronicle Events feed for observers */}
      {rollsToRender.map(broadcast => (
        <ChronicleDiceBroadcast
          key={broadcast.id}
          broadcast={broadcast}
          targetDC={targetDC}
          onDismiss={() => onDismissRoomRoll?.(broadcast.id)}
        />
      ))}
    </div>
  );
};
