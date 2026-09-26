import { AIProviderFactory, aiProviderFactory } from '../ai/AIProviderFactory';
import { ITTSService, ttsService } from '../tts/TTSService';
import { DMPromptBuilder, dmPromptBuilder } from '../ai/DMPromptBuilder';
import { DMResponseValidator, dmResponseValidator } from '../ai/DMResponseValidator';
import { AIDMResponse, AIDMContext, AIDMPrologueContext } from '../../domain/types';
import { RoomEntity } from '../../db';
import { sceneEntityManager } from './SceneEntityManager';

/**
 * Strips raw JSON formatting or accidental delimiters from LLM narrative text.
 */
export function sanitizeNarrativeText(text: string): string {
  if (!text) return '';
  let clean = text.trim();

  // If raw JSON leaked in (e.g. { "narrative": "..." })
  if (clean.startsWith('{') && clean.includes('"narrative"')) {
    const match = clean.match(/"narrative"\s*:\s*"((?:[^"\\]|\\.)*)"/);
    if (match && match[1]) {
      try {
        clean = JSON.parse(`"${match[1]}"`);
      } catch {
        clean = match[1].replace(/\\n/g, '\n').replace(/\\"/g, '"');
      }
    }
  }

  return clean
    .replace(/\n*📌\s*Итог ситуации:[\s\S]*?(?=(\n*❓\s*Выбор|$))/i, '')
    .replace(/\n*❓\s*Выбор[\s\S]*$/i, '')
    .trim();
}

export class NarrativeSynthesizer {
  private aiFactory: AIProviderFactory;
  private tts: ITTSService;
  private promptBuilder: DMPromptBuilder;
  private validator: DMResponseValidator;

  constructor(
    aiFactory: AIProviderFactory = aiProviderFactory,
    tts: ITTSService = ttsService,
    promptBuilder: DMPromptBuilder = dmPromptBuilder,
    validator: DMResponseValidator = dmResponseValidator
  ) {
    this.aiFactory = aiFactory;
    this.tts = tts;
    this.promptBuilder = promptBuilder;
    this.validator = validator;
  }

  /**
   * Generates AI DM prologue for a new adventure.
   */
  public async synthesizePrologue(
    room: RoomEntity,
    context: AIDMPrologueContext
  ): Promise<{ response: AIDMResponse; audioUrl?: string }> {
    const provider = this.aiFactory.getProvider(context.apiKey, context.model);
    const validated = await provider.generatePrologue(context);

    validated.narrative = sanitizeNarrativeText(validated.narrative);

    // Procedural entity management:
    // If the AI explicitly provided structured sceneNPCs, register them directly.
    // Only fall back to narrative text regex synthesis if no explicit sceneNPCs were provided.
    if (validated.sceneNPCs && validated.sceneNPCs.length > 0) {
      for (const npc of validated.sceneNPCs) {
        sceneEntityManager.registerEntity(room, {
          name: npc.name,
          role: npc.role,
          hpCurrent: npc.hpCurrent,
          hpMax: npc.hpMax,
          ac: npc.ac,
          disposition: npc.disposition,
          combatRole: npc.combatRole,
          status: npc.status,
        });
      }
    } else {
      sceneEntityManager.synthesizeEntitiesFromNarrative(room, validated.narrative, validated.currentSituation);
    }

    sceneEntityManager.syncLegacyArrays(room);
    sceneEntityManager.buildSceneProjection(room);

    // Optional TTS audio generation
    let audioUrl: string | undefined;
    try {
      if (this.tts && validated.narrative) {
        const ttsRes = await this.tts.synthesize(validated.narrative, validated.mood);
        audioUrl = ttsRes.filePath;
      }
    } catch (err) {
      console.warn('TTS generation failed for prologue:', err);
    }

    return { response: validated, audioUrl };
  }

  /**
   * Synthesizes narrative and consequence response for a gameplay round/turn.
   */
  public async synthesizeTurnResponse(
    room: RoomEntity,
    context: AIDMContext
  ): Promise<{ response: AIDMResponse; audioUrl?: string }> {
    const provider = this.aiFactory.getProvider(context.apiKey, context.model);
    const validated = await provider.generateRound(context);

    validated.narrative = sanitizeNarrativeText(validated.narrative);

    // Procedural synthesis fallback: ensure newly introduced actors exist with UUIDs if AI omitted sceneNPCs
    if (!validated.sceneNPCs || validated.sceneNPCs.length === 0) {
      sceneEntityManager.synthesizeEntitiesFromNarrative(room, validated.narrative, validated.currentSituation);
    }

    // Check departed NPCs
    sceneEntityManager.handleNPCDepartures(
      room,
      validated.narrative,
      validated.currentSituation,
      validated.departedNPCs
    );

    sceneEntityManager.syncLegacyArrays(room);
    sceneEntityManager.buildSceneProjection(room);

    // Generate speech audio
    let audioUrl: string | undefined;
    try {
      if (this.tts && validated.narrative) {
        const ttsRes = await this.tts.synthesize(validated.narrative, validated.mood);
        audioUrl = ttsRes.filePath;
      }
    } catch (err) {
      console.warn('TTS generation failed for turn response:', err);
    }

    return { response: validated, audioUrl };
  }
}

export const narrativeSynthesizer = new NarrativeSynthesizer();
