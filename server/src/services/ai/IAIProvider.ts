import { AIDMContext, AIDMResponse } from '../../domain/types';

export interface IAIProvider {
  readonly name: string;
  generateRound(context: AIDMContext): Promise<AIDMResponse>;
}
