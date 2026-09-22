import { IAIProvider } from './IAIProvider';
import { GeminiAIProvider } from './GeminiAIProvider';
import { DeepSeekAIProvider } from './DeepSeekAIProvider';
import { SimulationAIProvider } from './SimulationAIProvider';
import { config } from '../../config';
import { cryptoService } from '../security/CryptoService';

export class AIProviderFactory {
  public getProvider(apiKey?: string, model?: string): IAIProvider {
    const rawKey = apiKey?.trim() || config.geminiApiKey?.trim() || config.deepseekApiKey?.trim();
    const activeKey = rawKey ? cryptoService.decrypt(rawKey).trim() : '';

    if (!activeKey) {
      return new SimulationAIProvider();
    }

    const isGemini =
      activeKey.startsWith('AIza') ||
      activeKey.startsWith('AQ.') ||
      model?.toLowerCase().startsWith('gemini');

    if (isGemini) {
      const geminiModel = model?.startsWith('gemini') ? model : (config.geminiModel || 'gemini-3.5-flash-lite');
      return new GeminiAIProvider(activeKey, geminiModel);
    }

    const deepseekModel = model || config.deepseekModel || 'deepseek-chat';
    return new DeepSeekAIProvider(activeKey, deepseekModel);
  }
}

export const aiProviderFactory = new AIProviderFactory();
