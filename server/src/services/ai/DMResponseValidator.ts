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

      let currentSituation = typeof parsed.currentSituation === 'string' && parsed.currentSituation.trim() ? parsed.currentSituation.trim() : '';
      let choiceDilemma = typeof parsed.choiceDilemma === 'string' && parsed.choiceDilemma.trim() ? parsed.choiceDilemma.trim() : undefined;

      const outcomeMatch = parsed.narrative.match(/📌\s*Итог ситуации:\s*([\s\S]*?)(?=(\n*❓\s*Выбор|$))/i);
      if (!currentSituation && outcomeMatch && outcomeMatch[1]) {
        currentSituation = outcomeMatch[1].trim();
      }
      const dilemmaMatch = parsed.narrative.match(/❓\s*Выбор[^:]*:\s*([\s\S]*)$/i);
      if (!choiceDilemma && dilemmaMatch && dilemmaMatch[1]) {
        choiceDilemma = dilemmaMatch[1].trim();
      }

      const cleanedNarrative = parsed.narrative
        .replace(/\n*📌\s*Итог ситуации:[\s\S]*?(?=(\n*❓\s*Выбор|$))/i, '')
        .replace(/\n*❓\s*Выбор[\s\S]*$/i, '')
        .trim();

      return {
        narrative: cleanedNarrative || parsed.narrative,
        playerUpdates: Array.isArray(parsed.playerUpdates) ? parsed.playerUpdates : [],
        currentSituation: currentSituation || 'Что вы делаете дальше?',
        choiceDilemma,
        enemiesStatus: parsed.enemiesStatus,
        activeEnemies: Array.isArray(parsed.activeEnemies)
          ? parsed.activeEnemies.map((e: any, idx: number) => ({
              id: typeof e.id === 'string' && e.id ? e.id : `enemy_${idx + 1}`,
              name: typeof e.name === 'string' && e.name ? e.name : 'Противник',
              type: ['boss', 'minion', 'caster'].includes(e.type) ? e.type : 'minion',
              hpCurrent: typeof e.hpCurrent === 'number' ? Math.max(0, e.hpCurrent) : 10,
              hpMax: typeof e.hpMax === 'number' ? Math.max(1, e.hpMax) : 10,
              ac: typeof e.ac === 'number' ? Math.max(5, e.ac) : 10,
              status: typeof e.status === 'string' ? e.status : 'В боевой готовности',
              isDead: typeof e.isDead === 'boolean' ? e.isDead : (typeof e.hpCurrent === 'number' && e.hpCurrent <= 0),
              conditions: Array.isArray(e.conditions) ? e.conditions : [],
            }))
          : [],
        conditionUpdates: Array.isArray(parsed.conditionUpdates) ? parsed.conditionUpdates : [],
        inventoryUpdates: Array.isArray(parsed.inventoryUpdates)
          ? parsed.inventoryUpdates.filter((u: any) => u && u.item && typeof u.item.name === 'string' && u.item.name.trim().length > 0)
          : [],
        ruleViolations: Array.isArray(parsed.ruleViolations) ? parsed.ruleViolations : [],
        mood: parsed.mood,
        nextRoundDC: typeof parsed.nextRoundDC === 'number' ? parsed.nextRoundDC : 13,
        nextRoundDCReason: parsed.nextRoundDCReason,
        requiredCheckStat: typeof parsed.requiredCheckStat === 'string' ? parsed.requiredCheckStat.toLowerCase() : undefined,
        campaignPlot: typeof parsed.campaignPlot === 'string' ? parsed.campaignPlot : undefined,
        droppedLoot: Array.isArray(parsed.droppedLoot)
          ? parsed.droppedLoot.filter((item: any) => item && typeof item.name === 'string' && item.name.trim().length > 0)
          : [],
        newMilestones: Array.isArray(parsed.newMilestones) ? parsed.newMilestones : [],
        xpAwarded: typeof parsed.xpAwarded === 'number' ? parsed.xpAwarded : 35,
        rejectedAction: parsed.rejectedAction && typeof parsed.rejectedAction.reason === 'string'
          ? {
              characterName: String(parsed.rejectedAction.characterName || 'Игрок'),
              reason: String(parsed.rejectedAction.reason),
            }
          : undefined,
        campaignFinished: parsed.campaignFinished && parsed.campaignFinished.isFinished
          ? {
              isFinished: true,
              finishType: ['triumph', 'defeat', 'cliffhanger', 'open_ended'].includes(parsed.campaignFinished.finishType)
                ? parsed.campaignFinished.finishType
                : 'triumph',
              title: typeof parsed.campaignFinished.title === 'string' ? parsed.campaignFinished.title : 'Финал Приключения',
              epilogue: typeof parsed.campaignFinished.epilogue === 'string' ? parsed.campaignFinished.epilogue : '',
            }
          : undefined,
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
