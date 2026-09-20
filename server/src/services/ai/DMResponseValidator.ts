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
          ? parsed.inventoryUpdates
              .filter((u: any) => u && u.item && typeof u.item.name === 'string' && u.item.name.trim().length > 0)
              .map((u: any) => ({
                characterId: String(u.characterId || ''),
                characterName: u.characterName ? String(u.characterName) : undefined,
                action: u.action === 'remove' ? 'remove' : 'add',
                reason: typeof u.reason === 'string' && u.reason.trim() ? u.reason.trim() : undefined,
                item: {
                  name: String(u.item.name).trim(),
                  quantity: typeof u.item.quantity === 'number' && u.item.quantity > 0 ? u.item.quantity : 1,
                  type: u.item.type || 'misc',
                  description: typeof u.item.description === 'string' ? u.item.description.trim() : '',
                  damage: u.item.damage,
                  healAmount: u.item.healAmount,
                  ac_bonus: u.item.ac_bonus,
                  history: Array.isArray(u.item.history)
                    ? u.item.history.map(String)
                    : (u.reason ? [String(u.reason)] : undefined),
                },
              }))
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
