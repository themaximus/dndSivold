import { useState, useEffect, useCallback, useRef } from 'react';
import { soundFx } from '../utils/audio';
import { getSocket, connectSocket } from '../services/socket';

export function useNarrativeVoice(roomCode?: string) {
  const [loadingLogId, setLoadingLogId] = useState<string | null>(null);
  const [speakingText, setSpeakingText] = useState<string | null>(null);
  const [speakingLogId, setSpeakingLogId] = useState<string | null>(null);
  const lastLocalPlayRef = useRef<{ id: string; text: string; time: number }>({ id: '', text: '', time: 0 });

  useEffect(() => {
    const unsubscribe = soundFx.subscribeSpeaking((isSpeaking, text) => {
      setSpeakingText(isSpeaking ? text : null);
      if (!isSpeaking) {
        setLoadingLogId(null);
        setSpeakingLogId(null);
      }
    });
    return unsubscribe;
  }, []);

  // Listen to synchronized narrator events from socket
  useEffect(() => {
    const socket = connectSocket();

    const handleNarratorPlaying = async (data: {
      logId: string;
      narrativeText: string;
      mood?: any;
      startedBy?: string;
    }) => {
      if (!soundFx.getSpeechState()) return;

      // Ignore if this client locally initiated playback for this log within the last 4 seconds
      const now = Date.now();
      if (
        lastLocalPlayRef.current.id === data.logId &&
        now - lastLocalPlayRef.current.time < 4000
      ) {
        return;
      }

      if (soundFx.isCurrentlySpeaking(data.narrativeText)) return;

      setLoadingLogId(data.logId);
      setSpeakingLogId(data.logId);
      try {
        await soundFx.speakNarrative(data.narrativeText, data.mood);
      } finally {
        setLoadingLogId(null);
      }
    };

    const handleNarratorStopped = () => {
      soundFx.stopSpeech();
      setLoadingLogId(null);
      setSpeakingLogId(null);
      setSpeakingText(null);
    };

    socket.on('narrator_playing', handleNarratorPlaying);
    socket.on('narrator_stopped', handleNarratorStopped);

    return () => {
      socket.off('narrator_playing', handleNarratorPlaying);
      socket.off('narrator_stopped', handleNarratorStopped);
    };
  }, []);

  const toggleVoice = useCallback(async (logId: string, narrativeText: string) => {
    const socket = getSocket();
    const isThisSpeaking =
      soundFx.isCurrentlySpeaking(narrativeText) ||
      speakingLogId === logId ||
      loadingLogId === logId;

    if (isThisSpeaking) {
      soundFx.stopSpeech();
      if (roomCode) {
        socket.emit('narrator_stop', { roomCode });
      }
      setLoadingLogId(null);
      setSpeakingLogId(null);
      return;
    }

    setLoadingLogId(logId);
    setSpeakingLogId(logId);
    lastLocalPlayRef.current = { id: logId, text: narrativeText, time: Date.now() };

    // Explicitly un-suspend browser AudioContext on user interaction
    soundFx.resume();

    // If speech was turned off in the header/navbar, enable it on deliberate user action
    if (!soundFx.getSpeechState()) {
      soundFx.toggleSpeech();
    }

    if (roomCode) {
      socket.emit('narrator_play', { roomCode, logId, narrativeText });
    }

    try {
      await soundFx.speakNarrative(narrativeText);
    } finally {
      setLoadingLogId(null);
    }
  }, [roomCode, speakingLogId, loadingLogId]);

  const isSpeakingText = useCallback((text?: string) => {
    return soundFx.isCurrentlySpeaking(text);
  }, []);

  return {
    loadingLogId,
    speakingText,
    speakingLogId,
    toggleVoice,
    isSpeakingText,
    stopVoice: () => {
      soundFx.stopSpeech();
      if (roomCode) {
        const socket = getSocket();
        socket.emit('narrator_stop', { roomCode });
      }
    },
  };
}
