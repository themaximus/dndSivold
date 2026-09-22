import { IAIProvider } from './IAIProvider';
import { AIDMContext, AIDMPrologueContext, AIDMResponse } from '../../domain/types';
import { dmPromptBuilder } from './DMPromptBuilder';
import { dmResponseValidator } from './DMResponseValidator';

export class GeminiAIProvider implements IAIProvider {
  public readonly name = 'Google Gemini';

  private apiKey: string;
  private primaryModel: string;
  private candidateModels = [
    'gemini-2.5-flash',
    'gemini-2.0-flash',
    'gemini-1.5-flash',
    'gemini-2.5-pro',
    'gemini-3.1-flash-lite',
    'gemini-3.5-flash-lite',
    'gemini-3.6-flash',
    'gemini-flash-lite-latest',
    'gemini-flash-latest',
  ];

  constructor(apiKey: string, model: string = 'gemini-2.5-flash') {
    this.apiKey = apiKey;
    this.primaryModel = model || 'gemini-2.5-flash';
  }

  public async generatePrologue(context: AIDMPrologueContext): Promise<AIDMResponse> {
    const systemPrompt = dmPromptBuilder.buildPrologueSystemPrompt();
    const userPrompt = dmPromptBuilder.buildPrologueUserPrompt(context);
    return this.executeGeminiRequest(`${systemPrompt}\n\n${userPrompt}`);
  }

  public async generateRound(context: AIDMContext): Promise<AIDMResponse> {
    const systemPrompt = dmPromptBuilder.buildSystemPrompt();
    const userPrompt = dmPromptBuilder.buildUserPrompt(context);
    return this.executeGeminiRequest(`${systemPrompt}\n\n${userPrompt}`);
  }

  public async generateRaw(prompt: string): Promise<string> {
    let modelsToTry = [...this.candidateModels];
    if (this.primaryModel && !modelsToTry.includes(this.primaryModel)) {
      modelsToTry = [this.primaryModel, ...modelsToTry];
    } else if (this.primaryModel) {
      modelsToTry = [this.primaryModel, ...modelsToTry.filter(m => m !== this.primaryModel)];
    }

    for (const model of modelsToTry) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 20000);
      try {
        const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${this.apiKey}`;
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              response_mime_type: 'application/json',
              temperature: 0.8,
            },
          }),
          signal: controller.signal,
        });

        if (response.ok) {
          const data = await response.json();
          return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
        }
      } catch {
        continue;
      } finally {
        clearTimeout(timeout);
      }
    }
    throw new Error('Gemini raw generation failed across all candidate models');
  }

  private async executeGeminiRequest(fullPromptText: string): Promise<AIDMResponse> {
    let modelsToTry = [...this.candidateModels];
    if (this.primaryModel && !modelsToTry.includes(this.primaryModel)) {
      modelsToTry = [this.primaryModel, ...modelsToTry];
    } else if (this.primaryModel) {
      modelsToTry = [this.primaryModel, ...modelsToTry.filter(m => m !== this.primaryModel)];
    }

    let lastError: Error | null = null;

    for (const model of modelsToTry) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 35000);

      try {
        const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${this.apiKey}`;
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            contents: [
              {
                parts: [{ text: fullPromptText }],
              },
            ],
            generationConfig: {
              response_mime_type: 'application/json',
              temperature: 0.75,
            },
          }),
          signal: controller.signal,
        });

        if (!response.ok) {
          const errText = await response.text();
          console.warn(`Gemini model ${model} status ${response.status}: ${errText.slice(0, 120)}`);
          lastError = new Error(`Gemini ${model} error: ${response.statusText}`);
          continue; // failover to next model
        }

        const data = await response.json();
        const rawContent = data.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
        return dmResponseValidator.validateAndParse(rawContent);
      } catch (err: any) {
        console.warn(`Gemini model ${model} failed:`, err?.message || err);
        lastError = err;
      } finally {
        clearTimeout(timeout);
      }
    }

    throw lastError || new Error('All Gemini candidate models failed to respond');
  }
}
