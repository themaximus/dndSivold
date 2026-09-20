import { IAIProvider } from './IAIProvider';
import { AIDMContext, AIDMPrologueContext, AIDMResponse } from '../../domain/types';
import { dmPromptBuilder } from './DMPromptBuilder';
import { dmResponseValidator } from './DMResponseValidator';

export class DeepSeekAIProvider implements IAIProvider {
  public readonly name = 'DeepSeek';

  private apiKey: string;
  private model: string;

  constructor(apiKey: string, model: string = 'deepseek-chat') {
    this.apiKey = apiKey;
    this.model = model;
  }

  public async generatePrologue(context: AIDMPrologueContext): Promise<AIDMResponse> {
    const systemPrompt = dmPromptBuilder.buildPrologueSystemPrompt();
    const userPrompt = dmPromptBuilder.buildPrologueUserPrompt(context);
    return this.executeChatCompletion(systemPrompt, userPrompt);
  }

  public async generateRound(context: AIDMContext): Promise<AIDMResponse> {
    const systemPrompt = dmPromptBuilder.buildSystemPrompt();
    const userPrompt = dmPromptBuilder.buildUserPrompt(context);
    return this.executeChatCompletion(systemPrompt, userPrompt);
  }

  private async executeChatCompletion(systemPrompt: string, userPrompt: string): Promise<AIDMResponse> {
    const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.75,
        response_format: { type: 'json_object' },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`DeepSeek API error ${response.status}: ${response.statusText} (${errText})`);
    }

    const data = await response.json();
    const rawContent = data.choices?.[0]?.message?.content || '{}';
    return dmResponseValidator.validateAndParse(rawContent);
  }
}
