import { IAIProvider } from './IAIProvider';
import { AIDMContext, AIDMResponse } from '../../domain/types';
import { dmPromptBuilder } from './DMPromptBuilder';
import { dmResponseValidator } from './DMResponseValidator';

export class GeminiAIProvider implements IAIProvider {
  public readonly name = 'Google Gemini';

  private apiKey: string;
  private primaryModel: string;
  private candidateModels = [
    'gemini-3.5-flash',
    'gemini-flash-lite-latest',
    'gemini-3.1-flash-lite',
    'gemini-3.5-flash-lite',
    'gemini-3.7-flash',
    'gemini-3.8-flash',
  ];

  constructor(apiKey: string, model: string = 'gemini-3.5-flash') {
    this.apiKey = apiKey;
    this.primaryModel = model;
  }

  public async generateRound(context: AIDMContext): Promise<AIDMResponse> {
    const systemPrompt = dmPromptBuilder.buildSystemPrompt();
    const userPrompt = dmPromptBuilder.buildUserPrompt(context);

    let modelsToTry = [...this.candidateModels];
    if (this.primaryModel && !modelsToTry.includes(this.primaryModel)) {
      modelsToTry = [this.primaryModel, ...modelsToTry];
    } else if (this.primaryModel) {
      modelsToTry = [this.primaryModel, ...modelsToTry.filter(m => m !== this.primaryModel)];
    }

    let lastError: Error | null = null;

    for (const model of modelsToTry) {
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
                parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }],
              },
            ],
            generationConfig: {
              response_mime_type: 'application/json',
              temperature: 0.7,
            },
          }),
        });

        if (!response.ok) {
          const errText = await response.text();
          console.warn(`Gemini model ${model} status ${response.status}: ${errText}`);
          lastError = new Error(`Gemini ${model} error: ${response.statusText} (${errText})`);
          continue; // failover to next model
        }

        const data = await response.json();
        const rawContent = data.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
        return dmResponseValidator.validateAndParse(rawContent);
      } catch (err: any) {
        lastError = err;
      }
    }

    throw lastError || new Error('All Gemini candidate models failed to respond');
  }
}
