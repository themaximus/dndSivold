import { IAIProvider } from './IAIProvider';
import { AIDMContext, AIDMPrologueContext, AIDMResponse } from '../../domain/types';
import { dmPromptBuilder } from './DMPromptBuilder';
import { dmResponseValidator } from './DMResponseValidator';

export class GeminiAIProvider implements IAIProvider {
  public readonly name = 'Google Gemini';

  private apiKey: string;
  private primaryModel: string;
  private candidateModels = [
    'gemini-3.6-flash',
    'gemini-3.5-flash-lite',
  ];

  constructor(apiKey: string, model: string = 'gemini-3.6-flash') {
    this.apiKey = apiKey;
    this.primaryModel = model || 'gemini-3.6-flash';
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
          let parsedMsg = errText.slice(0, 160);
          try {
            const errObj = JSON.parse(errText);
            if (errObj.error?.message) {
              parsedMsg = errObj.error.message;
            }
          } catch {}
          console.warn(`Gemini model ${model} status ${response.status}: ${parsedMsg}`);
          lastError = new Error(`Google Gemini (${model}): ${parsedMsg}`);
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

    throw lastError || new Error('Google Gemini: не удалось получить ответ от моделей ИИ');
  }
}
