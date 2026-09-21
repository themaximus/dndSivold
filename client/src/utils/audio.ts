// Web Audio API Sound Effects, Procedural Ambience & Edge Neural TTS for СиволДнДаево
// Modular Object-Oriented Architecture (SOLID / Facade Pattern)

export type AmbienceMood = 'combat' | 'tension' | 'mystery' | 'triumph' | 'calm' | 'neutral';

/**
 * Audio Context Manager (SRP: Managing Web Audio context lifecycle)
 */
export class AudioContextManager {
  private static instance: AudioContextManager;
  private ctx: AudioContext | null = null;

  public static getInstance(): AudioContextManager {
    if (!AudioContextManager.instance) {
      AudioContextManager.instance = new AudioContextManager();
    }
    return AudioContextManager.instance;
  }

  public getContext(): AudioContext | null {
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    return this.ctx;
  }
}

/**
 * Procedural Sound Effects (SRP: Synthesizing game dice and turn sound cues)
 */
export class DiceSoundEffects {
  constructor(private contextManager: AudioContextManager = AudioContextManager.getInstance()) {}

  public playDiceRoll(isMuted: boolean): void {
    if (isMuted) return;
    const ctx = this.contextManager.getContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    for (let i = 0; i < 6; i++) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(120 + Math.random() * 240, now + i * 0.05);

      gain.gain.setValueAtTime(0.15, now + i * 0.05);
      gain.gain.exponentialRampToValueAtTime(0.01, now + i * 0.05 + 0.04);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now + i * 0.05);
      osc.stop(now + i * 0.05 + 0.05);
    }
  }

  public playCriticalSuccess(isMuted: boolean): void {
    if (isMuted) return;
    const ctx = this.contextManager.getContext();
    if (!ctx) return;

    const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
    const now = ctx.currentTime;

    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + idx * 0.08);

      gain.gain.setValueAtTime(0.2, now + idx * 0.08);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.08 + 0.35);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now + idx * 0.08);
      osc.stop(now + idx * 0.08 + 0.4);
    });
  }

  public playCriticalFail(isMuted: boolean): void {
    if (isMuted) return;
    const ctx = this.contextManager.getContext();
    if (!ctx) return;

    const notes = [300, 260, 220, 180];
    const now = ctx.currentTime;

    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, now + idx * 0.1);

      gain.gain.setValueAtTime(0.18, now + idx * 0.1);
      gain.gain.exponentialRampToValueAtTime(0.01, now + idx * 0.1 + 0.25);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now + idx * 0.1);
      osc.stop(now + idx * 0.1 + 0.25);
    });
  }

  public playTurnStart(isMuted: boolean): void {
    if (isMuted) return;
    const ctx = this.contextManager.getContext();
    if (!ctx) return;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(440, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.15);

    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 0.3);
  }

  public playLootPickup(isMuted: boolean): void {
    if (isMuted) return;
    const ctx = this.contextManager.getContext();
    if (!ctx) return;

    const notes = [587.33, 880, 1174.66]; // D5, A5, D6 - reward chime
    const now = ctx.currentTime;

    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + idx * 0.06);

      gain.gain.setValueAtTime(0.12, now + idx * 0.06);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.06 + 0.25);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now + idx * 0.06);
      osc.stop(now + idx * 0.06 + 0.28);
    });
  }
}

/**
 * Procedural Ambience Synthesizer (SRP: Ambient soundscape & audio ducking)
 */
export class AmbienceSynthesizer {
  private ambienceOsc: OscillatorNode | null = null;
  private ambienceGain: GainNode | null = null;
  private currentMood: AmbienceMood = 'neutral';

  constructor(private contextManager: AudioContextManager = AudioContextManager.getInstance()) {}

  public setAmbience(mood: AmbienceMood, isMuted: boolean): void {
    if (isMuted) return;
    const ctx = this.contextManager.getContext();
    if (!ctx) return;

    this.currentMood = mood;
    if (!this.ambienceOsc) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const filter = ctx.createBiquadFilter();

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(220, ctx.currentTime);

      osc.type = 'sine';
      osc.frequency.setValueAtTime(55, ctx.currentTime);

      gain.gain.setValueAtTime(0.05, ctx.currentTime);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      this.ambienceOsc = osc;
      this.ambienceGain = gain;
    }

    if (this.ambienceGain && this.ambienceOsc) {
      if (mood === 'combat') {
        this.ambienceOsc.frequency.linearRampToValueAtTime(73.4, ctx.currentTime + 1);
      } else if (mood === 'tension') {
        this.ambienceOsc.frequency.linearRampToValueAtTime(48.9, ctx.currentTime + 1);
      } else {
        this.ambienceOsc.frequency.linearRampToValueAtTime(55, ctx.currentTime + 1);
      }
    }
  }

  public setDucking(isSpeaking: boolean): void {
    const ctx = this.contextManager.getContext();
    if (this.ambienceGain && ctx) {
      const targetGain = isSpeaking ? 0.015 : 0.05;
      this.ambienceGain.gain.linearRampToValueAtTime(targetGain, ctx.currentTime + 0.4);
    }
  }

  public setMute(isMuted: boolean): void {
    const ctx = this.contextManager.getContext();
    if (this.ambienceGain && ctx) {
      this.ambienceGain.gain.setValueAtTime(isMuted ? 0 : 0.05, ctx.currentTime);
    }
  }
}

/**
 * Neural Voice Service (SRP: Managing Microsoft Edge Dmitry Neural TTS playback)
 */
export class NeuralVoiceService {
  private currentAudio: HTMLAudioElement | null = null;
  private currentBlobUrl: string | null = null;
  private isSpeaking: boolean = false;
  private activeText: string | null = null;
  private speechListeners: Array<(isSpeaking: boolean, text: string | null) => void> = [];
  private abortController: AbortController | null = null;
  private playbackSessionId: number = 0;
  private lastStartedAt: number = 0;
  private lastStartedText: string = '';

  constructor(private ambience: AmbienceSynthesizer) {}

  public subscribe(callback: (isSpeaking: boolean, text: string | null) => void) {
    this.speechListeners.push(callback);
    return () => {
      this.speechListeners = this.speechListeners.filter(cb => cb !== callback);
    };
  }

  private notify(isSpeaking: boolean, text: string | null = null): void {
    this.isSpeaking = isSpeaking;
    this.activeText = isSpeaking ? text : null;
    this.ambience.setDucking(isSpeaking);

    this.speechListeners.forEach(cb => {
      try {
        cb(isSpeaking, this.activeText);
      } catch (e) {
        console.error('Speech listener error:', e);
      }
    });
  }

  public async speak(text: string, isSpeechEnabled: boolean, mood?: AmbienceMood): Promise<boolean> {
    if (!isSpeechEnabled || typeof window === 'undefined') {
      return false;
    }

    const cleanText = text.replace(/<[^>]*>?/gm, '').trim();
    if (!cleanText) return false;

    const now = Date.now();
    // Prevent duplicate triggers for the exact same text within 2.5 seconds
    if (this.isSpeaking && this.activeText === cleanText) {
      if (now - this.lastStartedAt < 2500) {
        return true;
      }
      this.stop();
      return false;
    }

    // Stop any current audio and cancel in-flight network requests
    this.stop();

    const sessionId = ++this.playbackSessionId;
    this.abortController = new AbortController();
    this.lastStartedAt = now;
    this.lastStartedText = cleanText;

    try {
      // 30 second timeout for procedural synthesis
      const timeoutId = setTimeout(() => {
        if (this.abortController) {
          this.abortController.abort();
        }
      }, 30000);

      const response = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: cleanText, mood }),
        signal: this.abortController.signal,
      });

      clearTimeout(timeoutId);

      // If a newer playback was started or stop was called, abort
      if (sessionId !== this.playbackSessionId) {
        return false;
      }

      if (!response.ok) {
        throw new Error(`TTS server responded with ${response.status}`);
      }

      const blob = await response.blob();
      if (sessionId !== this.playbackSessionId) {
        return false;
      }

      const blobUrl = URL.createObjectURL(blob);
      this.currentBlobUrl = blobUrl;

      const audio = new Audio(blobUrl);
      this.currentAudio = audio;

      audio.onended = () => {
        if (sessionId === this.playbackSessionId) {
          this.stop();
        }
      };

      audio.onerror = (e) => {
        console.warn('Neural voice audio playback error:', e);
        if (sessionId === this.playbackSessionId) {
          this.stop();
        }
      };

      try {
        await audio.play();
        this.notify(true, cleanText);
        return true;
      } catch (playErr: any) {
        console.warn('Audio play prevented by browser policy or audio device issue:', playErr);
        if (sessionId === this.playbackSessionId) {
          this.stop();
        }
        return false;
      }
    } catch (err: any) {
      if (err.name === 'AbortError' && sessionId !== this.playbackSessionId) {
        // Request was deliberately aborted by a newer action; silently exit
        return false;
      }
      console.warn('Neural voice synthesis request failed:', err?.message || err);
      if (sessionId === this.playbackSessionId) {
        this.stop();
      }
      return false;
    }
  }

  public stop(): void {
    this.playbackSessionId++;
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
      } catch (e) {}
      (window as any).__currentDndUtterance = null;
    }
    if (this.currentAudio) {
      this.currentAudio.pause();
      this.currentAudio.onended = null;
      this.currentAudio.onerror = null;
      this.currentAudio.currentTime = 0;
      this.currentAudio = null;
    }
    if (this.currentBlobUrl) {
      URL.revokeObjectURL(this.currentBlobUrl);
      this.currentBlobUrl = null;
    }
    this.notify(false, null);
  }

  public getSpeakingState(): boolean {
    return this.isSpeaking;
  }

  public isCurrentlySpeaking(text?: string): boolean {
    if (!this.isSpeaking) return false;
    if (text) {
      return this.activeText === text.replace(/<[^>]*>?/gm, '').trim();
    }
    return this.isSpeaking;
  }
}

/**
 * Sound Effects Facade (Facade Pattern: Unified interface)
 */
export class SoundEffectsFacade {
  private isMuted: boolean = false;
  private isSpeechEnabled: boolean = true;

  private contextManager = AudioContextManager.getInstance();
  private diceSounds = new DiceSoundEffects(this.contextManager);
  private ambience = new AmbienceSynthesizer(this.contextManager);
  private voice = new NeuralVoiceService(this.ambience);

  public subscribeSpeaking(callback: (isSpeaking: boolean, text: string | null) => void) {
    return this.voice.subscribe(callback);
  }

  public playDiceRoll(): void {
    this.diceSounds.playDiceRoll(this.isMuted);
  }

  public playCriticalSuccess(): void {
    this.diceSounds.playCriticalSuccess(this.isMuted);
  }

  public playCriticalFail(): void {
    this.diceSounds.playCriticalFail(this.isMuted);
  }

  public playTurnStart(): void {
    this.diceSounds.playTurnStart(this.isMuted);
  }

  public playLootPickup(): void {
    this.diceSounds.playLootPickup(this.isMuted);
  }

  public setAmbience(mood: AmbienceMood): void {
    this.ambience.setAmbience(mood, this.isMuted);
  }

  public async speakNarrative(text: string, mood?: AmbienceMood): Promise<boolean> {
    return this.voice.speak(text, this.isSpeechEnabled, mood);
  }

  public stopSpeech(): void {
    this.voice.stop();
  }

  public toggleMute(): boolean {
    this.isMuted = !this.isMuted;
    if (this.isMuted) {
      this.voice.stop();
    }
    this.ambience.setMute(this.isMuted);
    return this.isMuted;
  }

  public toggleSpeech(): boolean {
    this.isSpeechEnabled = !this.isSpeechEnabled;
    if (!this.isSpeechEnabled) {
      this.voice.stop();
    }
    return this.isSpeechEnabled;
  }

  public getSpeechState(): boolean {
    return this.isSpeechEnabled;
  }

  public getIsSpeaking(): boolean {
    return this.voice.getSpeakingState();
  }

  public isCurrentlySpeaking(text?: string): boolean {
    return this.voice.isCurrentlySpeaking(text);
  }
}

export const soundFx = new SoundEffectsFacade();
