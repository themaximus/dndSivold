import { useState, useEffect, useCallback } from 'react';
import { soundFx } from '../utils/audio';

export function useNarrativeVoice() {
  const [loadingLogId, setLoadingLogId] = useState<string | null>(null);
  const [speakingText, setSpeakingText] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = soundFx.subscribeSpeaking((isSpeaking, text) => {
      setSpeakingText(isSpeaking ? text : null);
      if (!isSpeaking) {
        setLoadingLogId(null);
      }
    });
    return unsubscribe;
  }, []);

  const toggleVoice = useCallback(async (logId: string, narrativeText: string) => {
    if (soundFx.isCurrentlySpeaking(narrativeText)) {
      soundFx.stopSpeech();
      setLoadingLogId(null);
      return;
    }

    setLoadingLogId(logId);
    try {
      await soundFx.speakNarrative(narrativeText);
    } finally {
      setLoadingLogId(null);
    }
  }, []);

  const isSpeakingText = useCallback((text?: string) => {
    return soundFx.isCurrentlySpeaking(text);
  }, []);

  return {
    loadingLogId,
    speakingText,
    toggleVoice,
    isSpeakingText,
    stopVoice: () => soundFx.stopSpeech(),
  };
}
