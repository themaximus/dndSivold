import { AIDMResponse } from '../../domain/types';

export class DMResponseValidator {
  public validateAndParse(rawText: string): AIDMResponse {
    let cleaned = rawText.trim();

    // Remove markdown code blocks if model wrapped them
    if (cleaned.startsWith('```json')) {
      cleaned = cleaned.replace(/^```json\s*/, '').replace(/\s*```$/, '');
    } else if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```\s*/, '').replace(/\s*```$/, '');
    }

    try {
      const parsed = JSON.parse(cleaned);

      if (!parsed.narrative || typeof parsed.narrative !== 'string') {
        throw new Error('Response JSON missing valid narrative field');
      }

      return {
        narrative: parsed.narrative,
        playerUpdates: Array.isArray(parsed.playerUpdates) ? parsed.playerUpdates : [],
        currentSituation: parsed.currentSituation || 'Что вы делаете дальше?',
        enemiesStatus: parsed.enemiesStatus,
        activeEnemies: Array.isArray(parsed.activeEnemies)
          ? parsed.activeEnemies.map((e: any, idx: number) => ({
              id: typeof e.id === 'string' && e.id ? e.id : `enemy_${idx + 1}`,
              name: typeof e.name === 'string' && e.name ? e.name : 'Противник',
              type: typeof e.type === 'string' ? e.type : 'monster',
              hpCurrent: typeof e.hpCurrent === 'number' ? Math.max(0, e.hpCurrent) : 10,
              hpMax: typeof e.hpMax === 'number' ? Math.max(1, e.hpMax) : 10,
              ac: typeof e.ac === 'number' ? e.ac : 12,
              status: typeof e.status === 'string' ? e.status : 'В боевой стойке',
              isDead: Boolean(e.isDead || (typeof e.hpCurrent === 'number' && e.hpCurrent <= 0)),
            }))
          : undefined,
        inventoryUpdates: Array.isArray(parsed.inventoryUpdates)
          ? parsed.inventoryUpdates.filter((u: any) => u && (u.characterId || u.characterName) && u.item && u.item.name)
          : [],
        ruleViolations: Array.isArray(parsed.ruleViolations) ? parsed.ruleViolations : [],
        mood: parsed.mood,
        nextRoundDC: typeof parsed.nextRoundDC === 'number' ? parsed.nextRoundDC : 13,
        nextRoundDCReason: parsed.nextRoundDCReason,
        requiredCheckStat: typeof parsed.requiredCheckStat === 'string' ? parsed.requiredCheckStat.toLowerCase() : undefined,
        campaignPlot: typeof parsed.campaignPlot === 'string' ? parsed.campaignPlot : undefined,
        droppedLoot: Array.isArray(parsed.droppedLoot) ? parsed.droppedLoot : [],
        newMilestones: Array.isArray(parsed.newMilestones) ? parsed.newMilestones : [],
        xpAwarded: typeof parsed.xpAwarded === 'number' ? parsed.xpAwarded : 35,
      };
    } catch (err: any) {
      console.warn('JSON parsing error from AI response, using fallback format', err.message);
      return {
        narrative: cleaned || 'Мастер обдумывает последствия ваших действий...',
        playerUpdates: [],
        currentSituation: 'Что вы делаете дальше?',
        nextRoundDC: 13,
        nextRoundDCReason: 'Обострение обстановки',
        droppedLoot: [],
        newMilestones: [],
        xpAwarded: 25,
      };
    }
  }
}

export const dmResponseValidator = new DMResponseValidator();
