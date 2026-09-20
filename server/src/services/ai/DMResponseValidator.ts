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
        campaignMap: parsed.campaignMap && Array.isArray(parsed.campaignMap.nodes)
          ? {
              nodes: parsed.campaignMap.nodes.map((n: any, idx: number) => ({
                id: typeof n.id === 'string' && n.id ? n.id : `node_${idx + 1}`,
                title: typeof n.title === 'string' && n.title ? n.title : `Локация ${idx + 1}`,
                description: typeof n.description === 'string' ? n.description : '',
                act: typeof n.act === 'number' ? n.act : 1,
                type: ['start', 'battle', 'mystery', 'boss', 'climax', 'rest'].includes(n.type) ? n.type : 'battle',
                status: ['visited', 'current', 'discovered', 'locked'].includes(n.status) ? n.status : (idx === 0 ? 'current' : 'locked'),
                x: typeof n.x === 'number' ? Math.max(5, Math.min(95, n.x)) : Math.round(10 + (idx * 15)),
                y: typeof n.y === 'number' ? Math.max(15, Math.min(85, n.y)) : 50,
              })),
              edges: Array.isArray(parsed.campaignMap.edges)
                ? parsed.campaignMap.edges.map((e: any) => ({ from: String(e.from), to: String(e.to) }))
                : [],
              currentNodeId: typeof parsed.campaignMap.currentNodeId === 'string' && parsed.campaignMap.currentNodeId
                ? parsed.campaignMap.currentNodeId
                : (parsed.campaignMap.nodes[0]?.id || 'node_1'),
            }
          : undefined,
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
