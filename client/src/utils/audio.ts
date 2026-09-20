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

    // Toggle off if currently speaking this exact text
    if (this.isSpeaking && this.activeText === cleanText) {
      this.stop();
      return false;
    }

    this.stop();

    try {
      this.notify(true, cleanText);

      const response = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: cleanText, mood }),
      });

      if (!response.ok) {
        throw new Error(`TTS server responded with ${response.status}`);
      }

      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      this.currentBlobUrl = blobUrl;

      const audio = new Audio(blobUrl);
      this.currentAudio = audio;

      audio.onended = () => {
        this.stop();
      };

      audio.onerror = (e) => {
        console.error('Audio playback error:', e);
        this.stop();
      };

      await audio.play();
      return true;
    } catch (err) {
      console.error('Neural voice playback failed:', err);
      this.stop();
      return false;
    }
  }

  public stop(): void {
    if (this.currentAudio) {
      this.currentAudio.pause();
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
