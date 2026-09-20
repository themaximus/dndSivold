import { AIDMContext, AIDMPrologueContext, AIDMResponse } from '../../domain/types';

export interface IAIProvider {
  readonly name: string;
  generateRound(context: AIDMContext): Promise<AIDMResponse>;
  generatePrologue(context: AIDMPrologueContext): Promise<AIDMResponse>;
  generateRaw?(prompt: string): Promise<string>;
}
