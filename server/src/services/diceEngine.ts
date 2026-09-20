import crypto from 'crypto';
import { calculateModifier } from './dndRules';
import { CharacterEntity } from '../db';

export interface RollRequest {
  diceType: string; // 'd20', 'd6', '2d6', '1d12', etc.
  statKey?: 'str' | 'dex' | 'con' | 'int' | 'wis' | 'cha';
  customModifier?: number;
  advantage?: boolean;
  disadvantage?: boolean;
  purpose: string; // 'Атака мечом', 'Проверка Атлетики', 'Спасбросок'
}

export interface RollResult {
  diceType: string;
  rolls: number[];
  baseRoll: number;
  modifier: number;
  statName?: string;
  total: number;
  isCriticalSuccess: boolean;
  isCriticalFail: boolean;
  purpose: string;
  timestamp: string;
}

export function rollSingleDie(sides: number): number {
  return crypto.randomInt(1, sides + 1);
}

export function executeServerRoll(req: RollRequest, character?: CharacterEntity): RollResult {
  let count = 1;
  let sides = 20;

  // Parse dice string e.g. "2d6", "d20", "1d8"
  const match = req.diceType.trim().toLowerCase().match(/^(\d*)d(\d+)$/);
  if (match) {
    count = match[1] ? parseInt(match[1], 10) : 1;
    sides = parseInt(match[2], 10);
  }

  // Cap dice to prevent abuse
  count = Math.min(Math.max(1, count), 10);
  sides = Math.min(Math.max(2, sides), 100);

  // Calculate modifier
  let modifier = req.customModifier || 0;
  let statName = '';

  if (req.statKey && character) {
    const score = character.stats[req.statKey] || 10;
    const statMod = calculateModifier(score);
    modifier += statMod;

    const statLabels: Record<string, string> = {
      str: 'Сила',
      dex: 'Ловкость',
      con: 'Телосложение',
      int: 'Интеллект',
      wis: 'Мудрость',
      cha: 'Харизма'
    };
    statName = statLabels[req.statKey] || req.statKey;
  }

  // Perform rolls
  const rolls: number[] = [];
  for (let i = 0; i < count; i++) {
    rolls.push(rollSingleDie(sides));
  }

  let baseRoll = rolls.reduce((a, b) => a + b, 0);
  let isCriticalSuccess = false;
  let isCriticalFail = false;

  // D20 specific advantage / disadvantage / crits
  if (sides === 20 && count === 1) {
    if (req.advantage) {
      const secondRoll = rollSingleDie(20);
      rolls.push(secondRoll);
      baseRoll = Math.max(rolls[0], rolls[1]);
    } else if (req.disadvantage) {
      const secondRoll = rollSingleDie(20);
      rolls.push(secondRoll);
      baseRoll = Math.min(rolls[0], rolls[1]);
    }

    if (baseRoll === 20) isCriticalSuccess = true;
    if (baseRoll === 1) isCriticalFail = true;
  }

  const total = Math.max(1, baseRoll + modifier);

  return {
    diceType: req.diceType,
    rolls,
    baseRoll,
    modifier,
    statName,
    total,
    isCriticalSuccess,
    isCriticalFail,
    purpose: req.purpose || 'Бросок кости',
    timestamp: new Date().toISOString(),
  };
}
