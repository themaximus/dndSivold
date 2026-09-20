import { IAIProvider } from './IAIProvider';
import { GeminiAIProvider } from './GeminiAIProvider';
import { DeepSeekAIProvider } from './DeepSeekAIProvider';
import { SimulationAIProvider } from './SimulationAIProvider';
import { config } from '../../config';

export class AIProviderFactory {
  public getProvider(apiKey?: string, model?: string): IAIProvider {
    const activeKey = apiKey?.trim() || config.geminiApiKey?.trim() || config.deepseekApiKey?.trim();

    if (!activeKey) {
      return new SimulationAIProvider();
    }

    const isGemini =
      activeKey.startsWith('AIza') ||
      activeKey.startsWith('AQ.') ||
      model?.toLowerCase().startsWith('gemini');

    if (isGemini) {
      const geminiModel = model?.startsWith('gemini') ? model : 'gemini-3.5-flash';
      return new GeminiAIProvider(activeKey, geminiModel);
    }

    const deepseekModel = model || config.deepseekModel || 'deepseek-chat';
    return new DeepSeekAIProvider(activeKey, deepseekModel);
  }
}

export const aiProviderFactory = new AIProviderFactory();
