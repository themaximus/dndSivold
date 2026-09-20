import { IAIProvider } from './IAIProvider';
import { AIDMContext, AIDMResponse, PlayerHpUpdate } from '../../domain/types';

export class SimulationAIProvider implements IAIProvider {
  public readonly name = 'Offline Simulation';

  public async generateRound(context: AIDMContext): Promise<AIDMResponse> {
    const { characters, actions, roundNumber } = context;

    const narratives: string[] = [];
    const playerUpdates: PlayerHpUpdate[] = [];

    narratives.push(`Раунд ${roundNumber}. Напряжение нарастает, звуки битвы разносятся эхом.`);

    actions.forEach((action) => {
      const char = characters.find((c) => c.id === action.characterId);
      const roll = action.diceRolls && action.diceRolls.length > 0 ? action.diceRolls[0] : null;

      if (roll) {
        if (roll.isCriticalSuccess || roll.total >= 18) {
          narratives.push(
            `★ ${action.characterName} совершает выдающийся триумф! Действие "${action.actionText}" увенчалось сокрушительным успехом (${roll.total} очков). Враги ошеломлены мастерством героя!`
          );
        } else if (roll.isCriticalFail || roll.total <= 6) {
          narratives.push(
            `☠ ${action.characterName} терпит неудачу при попытке "${action.actionText}" (${roll.total} очков). Противник пользуется заминкой и наносит коварный контрудар!`
          );
          if (char) {
            playerUpdates.push({
              characterId: char.id,
              characterName: char.name,
              hpDelta: -3,
              note: 'Контратака врага при провале',
            });
          }
        } else if (roll.total >= 12) {
          narratives.push(
            `${action.characterName} успешно выполняет "${action.actionText}" (${roll.total} очков), достигая тактического преимущества.`
          );
        } else {
          narratives.push(
            `${action.characterName} совершает "${action.actionText}", однако вражеская броня отражает атаку.`
          );
        }
      } else {
        narratives.push(
          `${action.characterName} сосредотачивается и заявляет: "${action.actionText}". Окружающая обстановка мгновенно меняется.`
        );
      }
    });

    return {
      narrative: narratives.join('\n\n'),
      playerUpdates,
      currentSituation: 'Очередной раунд столкновения позади. Противники перегруппировываются. Что делает отряд?',
      enemiesStatus: 'Враги оценивают обстановку, готовясь к новому натиску.',
      mood: playerUpdates.length > 0 ? 'combat' : 'tension',
    };
  }
}

export const simulationAIProvider = new SimulationAIProvider();
