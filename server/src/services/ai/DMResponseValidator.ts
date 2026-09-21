import { AIDMResponse } from '../../domain/types';

function repairJson(raw: string): string {
  let s = raw.trim();

  // Remove markdown code blocks if model wrapped them
  if (s.startsWith('```json')) {
    s = s.replace(/^```json\s*/, '').replace(/\s*```$/, '');
  } else if (s.startsWith('```')) {
    s = s.replace(/^```\s*/, '').replace(/\s*```$/, '');
  }

  // Extract outermost { ... }
  const firstBrace = s.indexOf('{');
  const lastBrace = s.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    s = s.slice(firstBrace, lastBrace + 1);
  }

  // Remove trailing commas before closing brackets or braces (e.g. [ { ... }, ] or { "a": 1, })
  s = s.replace(/,\s*([}\]])/g, '$1');

  return s;
}

function extractStringField(raw: string, field: string): string | undefined {
  const regex = new RegExp(`"${field}"\\s*:\\s*"((?:[^"\\\\]|\\\\.)*)"`, 's');
  const match = raw.match(regex);
  if (match && match[1]) {
    try {
      return JSON.parse(`"${match[1]}"`);
    } catch {
      return match[1].replace(/\\n/g, '\n').replace(/\\"/g, '"');
    }
  }
  return undefined;
}

export class DMResponseValidator {
  public validateAndParse(rawText: string): AIDMResponse {
    const cleaned = repairJson(rawText);

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
        sceneNPCs: Array.isArray(parsed.sceneNPCs)
          ? parsed.sceneNPCs.map((n: any, idx: number) => {
              const validDispositions = ['friendly', 'neutral', 'cautious', 'offended', 'frightened', 'hostile'];
              const validRoles = ['ally_combatant', 'neutral_observer', 'hiding', 'fled'];
              const disposition = validDispositions.includes(n.disposition) ? n.disposition : 'neutral';
              const combatRole = validRoles.includes(n.combatRole) ? n.combatRole : 'neutral_observer';
              return {
                id: typeof n.id === 'string' && n.id ? n.id : `npc_${idx + 1}`,
                name: typeof n.name === 'string' && n.name ? n.name : 'Незнакомец',
                role: typeof n.role === 'string' && n.role ? n.role : 'Персонаж сцены',
                hpCurrent: typeof n.hpCurrent === 'number' ? Math.max(0, n.hpCurrent) : 15,
                hpMax: typeof n.hpMax === 'number' ? Math.max(1, n.hpMax) : 15,
                ac: typeof n.ac === 'number' ? Math.max(5, n.ac) : 11,
                disposition,
                combatRole,
                status: typeof n.status === 'string' && n.status ? n.status : 'Присутствует в сцене',
                conditions: Array.isArray(n.conditions) ? n.conditions : [],
                isDead: typeof n.isDead === 'boolean' ? n.isDead : (typeof n.hpCurrent === 'number' && n.hpCurrent <= 0),
              };
            })
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
      console.warn('JSON parsing error from AI response, recovering via regex extraction:', err.message);

      // Attempt resilient regex extraction of fields so raw JSON never leaks to narrative
      const extractedNarrative = extractStringField(cleaned, 'narrative');
      const extractedSituation = extractStringField(cleaned, 'currentSituation');
      const extractedDilemma = extractStringField(cleaned, 'choiceDilemma');

      let fallbackNarrative = extractedNarrative;
      if (!fallbackNarrative || fallbackNarrative.trim().startsWith('{')) {
        fallbackNarrative = 'Мастер обдумывает последствия действий отряда и следит за реакцией окружающего мира.';
      }

      return {
        narrative: fallbackNarrative,
        playerUpdates: [],
        currentSituation: extractedSituation || 'Что вы предпринимаете дальше?',
        choiceDilemma: extractedDilemma,
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
