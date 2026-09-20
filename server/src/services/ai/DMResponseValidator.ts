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

      let sanitizedCampaignMap = undefined;
      if (parsed.campaignMap && Array.isArray(parsed.campaignMap.nodes) && parsed.campaignMap.nodes.length > 0) {
        const totalNodes = parsed.campaignMap.nodes.length;
        const mappedNodes = parsed.campaignMap.nodes.map((n: any, idx: number) => {
          const id = typeof n.id === 'string' && n.id ? n.id : `node_${idx + 1}`;
          const title = typeof n.title === 'string' && n.title ? n.title : `Локация ${idx + 1}`;
          const description = typeof n.description === 'string' ? n.description : '';
          const act = typeof n.act === 'number' ? n.act : (idx === 0 ? 1 : Math.min(5, Math.floor((idx / Math.max(1, totalNodes - 1)) * 4) + 1));
          const type = ['start', 'battle', 'mystery', 'boss', 'climax', 'rest'].includes(n.type) ? n.type : (idx === 0 ? 'start' : idx === totalNodes - 1 ? 'boss' : 'battle');
          const status = ['visited', 'current', 'discovered', 'locked'].includes(n.status) ? n.status : (idx === 0 ? 'current' : idx === 1 ? 'discovered' : 'locked');
          
          const defaultX = Math.round(8 + (idx / Math.max(1, totalNodes - 1)) * 84);
          const rawX = typeof n.x === 'number' ? Math.max(6, Math.min(94, n.x)) : defaultX;
          const defaultY = idx % 2 === 0 ? 40 : 65;
          const rawY = typeof n.y === 'number' ? Math.max(22, Math.min(78, n.y)) : defaultY;

          return { id, title, description, act, type, status, x: rawX, y: rawY };
        });

        // Enforce collision-free spacing between consecutive nodes
        for (let i = 1; i < mappedNodes.length; i++) {
          const prev = mappedNodes[i - 1];
          const curr = mappedNodes[i];
          if (curr.x <= prev.x + 13) {
            curr.x = Math.min(95, prev.x + 14);
          }
          if (Math.abs(curr.y - prev.y) < 16) {
            curr.y = prev.y > 50 ? Math.max(24, prev.y - 30) : Math.min(76, prev.y + 30);
          }
        }

        sanitizedCampaignMap = {
          nodes: mappedNodes,
          edges: Array.isArray(parsed.campaignMap.edges)
            ? parsed.campaignMap.edges.map((e: any) => ({ from: String(e.from), to: String(e.to) }))
            : [],
          currentNodeId: typeof parsed.campaignMap.currentNodeId === 'string' && parsed.campaignMap.currentNodeId
            ? parsed.campaignMap.currentNodeId
            : (mappedNodes[0]?.id || 'node_1'),
        };
      }

      return {
        narrative: parsed.narrative,
        playerUpdates: Array.isArray(parsed.playerUpdates) ? parsed.playerUpdates : [],
        currentSituation: parsed.currentSituation || 'Что вы делаете дальше?',
        choiceDilemma: typeof parsed.choiceDilemma === 'string' && parsed.choiceDilemma.trim() ? parsed.choiceDilemma.trim() : undefined,
        enemiesStatus: parsed.enemiesStatus,
        activeEnemies: Array.isArray(parsed.activeEnemies)
          ? parsed.activeEnemies.map((e: any, idx: number) => ({
              id: typeof e.id === 'string' && e.id ? e.id : `enemy_${idx + 1}`,
              name: typeof e.name === 'string' && e.name ? e.name : 'Противник',
              type: typeof e.type === 'string' ? e.type : 'monster',
              hpCurrent: typeof e.hpCurrent === 'number' ? Math.max(0, e.hpCurrent) : 10,
              hpMax: typeof e.hpMax === 'number' ? Math.max(1, e.hpMax) : 10,
              ac: typeof e.ac === 'number' ? e.ac : 12,
              conditions: Array.isArray(e.conditions) ? e.conditions.map(String) : [],
              status: typeof e.status === 'string' ? e.status : 'В боевой стойке',
              isDead: Boolean(e.isDead || (typeof e.hpCurrent === 'number' && e.hpCurrent <= 0)),
            }))
          : undefined,
        conditionUpdates: Array.isArray(parsed.conditionUpdates)
          ? parsed.conditionUpdates.filter((u: any) => u && (u.targetId || u.targetName) && u.condition && (u.action === 'add' || u.action === 'remove'))
          : [],
        inventoryUpdates: Array.isArray(parsed.inventoryUpdates)
          ? parsed.inventoryUpdates.filter((u: any) => u && (u.characterId || u.characterName) && u.item && u.item.name)
          : [],
        ruleViolations: Array.isArray(parsed.ruleViolations) ? parsed.ruleViolations : [],
        mood: parsed.mood,
        nextRoundDC: typeof parsed.nextRoundDC === 'number' ? parsed.nextRoundDC : 13,
        nextRoundDCReason: parsed.nextRoundDCReason,
        requiredCheckStat: typeof parsed.requiredCheckStat === 'string' ? parsed.requiredCheckStat.toLowerCase() : undefined,
        campaignPlot: typeof parsed.campaignPlot === 'string' ? parsed.campaignPlot : undefined,
        campaignMap: sanitizedCampaignMap,
        droppedLoot: Array.isArray(parsed.droppedLoot) ? parsed.droppedLoot : [],
        newMilestones: Array.isArray(parsed.newMilestones) ? parsed.newMilestones : [],
        xpAwarded: typeof parsed.xpAwarded === 'number' ? parsed.xpAwarded : 35,
        rejectedAction: parsed.rejectedAction && typeof parsed.rejectedAction.reason === 'string'
          ? {
              characterName: String(parsed.rejectedAction.characterName || 'Игрок'),
              reason: String(parsed.rejectedAction.reason),
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
