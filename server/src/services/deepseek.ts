import { config } from '../config';
import { CharacterEntity, TurnActionEntity } from '../db';

export interface DeepSeekDMResponse {
  narrative: string;
  playerUpdates: {
    characterId: string;
    hpDelta: number;
    note: string;
  }[];
  currentSituation: string;
  enemiesStatus?: string;
}

export async function generateDMTurn(params: {
  apiKey?: string;
  model?: string;
  setting: string;
  roundNumber: number;
  currentSituation: string;
  characters: CharacterEntity[];
  actions: TurnActionEntity[];
  previousHistory: string[];
}): Promise<DeepSeekDMResponse> {
  const { apiKey, model, setting, roundNumber, currentSituation, characters, actions, previousHistory } = params;
  
  // Resolve key: check passed key, or gemini, or deepseek
  const activeKey = apiKey?.trim() || config.geminiApiKey?.trim() || config.deepseekApiKey?.trim();
  const isGemini = activeKey?.startsWith('AIza') || activeKey?.startsWith('AQ.') || model?.toLowerCase().startsWith('gemini');
  const activeModel = model || (isGemini ? 'gemini-3.5-flash' : (config.deepseekModel || 'deepseek-chat'));

  // Format players info
  const partyInfo = characters.map(c => `
- Имя: ${c.name} (${c.race} ${c.characterClass}, уровень ${c.level})
  HP: ${c.hpCurrent}/${c.hpMax}, КБ: ${c.ac}
  Характеристики: СИЛ ${c.stats.str}, ЛОВ ${c.stats.dex}, ТЕЛ ${c.stats.con}, ИНТ ${c.stats.int}, МУД ${c.stats.wis}, ХАР ${c.stats.cha}
  Способности: ${c.abilities.map(a => a.name).join(', ')}
  Инвентарь/Оружие: ${c.inventory.map(i => `${i.name} (${i.type})`).join(', ')}
  Биография/Внешность: ${c.bio || 'Опытный искатель приключений'}
`).join('\n');

  // Format verified actions with server dice rolls
  const actionsSummary = actions.map(a => {
    const diceInfo = a.diceRolls && a.diceRolls.length > 0
      ? a.diceRolls.map(r => `[Кость: ${r.diceType}, Выпало: ${r.rolls.join('+')} (${r.modifier >= 0 ? '+' : ''}${r.modifier} от ${r.statName || 'модификатора'}) = Итого: ${r.total}${r.isCriticalSuccess ? ' ★ КРИТИЧЕСКИЙ УСПЕХ (20)!' : ''}${r.isCriticalFail ? ' ☠ КРИТИЧЕСКИЙ ПРОВАЛ (1)!' : ''}, Цель: ${r.purpose}]`).join('; ')
      : 'Без броска кубика';

    return `* Игрок ${a.characterName}: "${a.actionText}"\n  Официальные броски костей: ${diceInfo}`;
  }).join('\n\n');

  const systemPrompt = `Ты — беспристрастный, атмосферный и строгий Мастер Подземелий (Dungeon Master) по правилам D&D 5-й редакции.
Твоя задача — вести захватывающее, честное текстовое настольное ролевое приключение на русском языке.

ГЛАВНЫЕ ПРАВИЛА И АНТИЧИТ:
1. СТРОГОЕ СОБЛЮДЕНИЕ ПРАВИЛ D&D 5e:
   - Учитывай реальные броски кубиков игроков. Высокие броски (15-20+) означают успех или критический триумф. Низкие броски (1-9) означают неудачу, промах, осложнения или контратаку врагов.
   - Игроки НЕ МОГУТ совершать невозможные действия (например: мгновенно уничтожить всех врагов, телепортироваться без заклинания, игнорировать урон). Если игрок пытается «читерить» или заявляет слишком самонадеянное действие — опиши его реалистичный провал, конфуз или последствия.
   - Следи за здоровьем (HP) персонажей. Враги атакуют персонажей в ответ! Наноси урон персонажам при логичной контратаке врагов или провале защиты.
2. ФОРМАТ ПОВЕСТВОВАНИЯ:
   - Яркий художественный слог в стиле классического фэнтези D&D (Mauporia / Baldur's Gate).
   - ЧИСТОЕ ЛИТЕРАТУРНОЕ ПОГРУЖЕНИЕ ДЛЯ ГОЛОСОВОЙ ОЗВУЧКИ:
     * НЕ пиши технические скобки и формулы механики (например: «(итоговый результат проверки 5)», «(СЛ 14)», «-4 HP») прямо в поле narrative! Текст narrative читается диктором вслух, поэтому пиши его как живую художественную аудиокнигу без технических циферок (все численные изменения HP указывай строго в поле playerUpdates).
     * Обязательно используй букву «ё» везде, где она нужна (тяжёлый, нанёс, ослеплённый, рассечён, разъярён, мёртвый), чтобы диктор озвучивал идеальные ударения.
   - Объедини действия всех игроков в один слаженный, динамичный раунд.
   - Опиши, как разрешились действия каждого героя по очереди и что предприняли монстры/окружение.
   - В конце обрисуй текущую ситуацию и тактический вызов для следующего хода.

ОБЯЗАТЕЛЬНЫЙ ФОРМАТ ОТВЕТА (ТОЛЬКО ЧИСТЫЙ JSON без лишних префиксов и без markdown блоков кода):
{
  "narrative": "Подробный художественный текст повествования раунда...",
  "playerUpdates": [
    {
      "characterId": "id_персонажа",
      "hpDelta": -3, // отрицательное число если урон, положительное если лечение, 0 если без изменений
      "note": "Краткая причина (например: 'Укус пещерного паука')"
    }
  ],
  "currentSituation": "Краткое описание обстановки для следующего раунда, вопрос игрокам 'Что вы делаете?'",
  "enemiesStatus": "Состояние противников (например: 'Один гоблин сражен, вожак ранен')"
}`;

  const userPrompt = `СЕТТИНГ И ПРЕМБУЛА КАМПАНИИ:
${setting}

ТЕКУЩИЙ СОСТАВ ОТРЯДА:
${partyInfo}

ТЕКУЩАЯ ОБСТАНОВКА (Раунд ${roundNumber}):
${currentSituation || 'Приключение начинается. Отряд сталкивается с первыми испытаниями.'}

ПРЕДЫДУЩИЕ СОБЫТИЯ (Контекст):
${previousHistory.slice(-3).join('\n---\n')}

ДЕЙСТВИЯ ВСЕХ ИГРОКОВ В ЭТОМ РАУНДЕ (И ИХ СЕРВЕРНЫЕ БРОСКИ):
${actionsSummary}

Разреши этот раунд согласно правилам D&D 5e и верни чистый JSON.`;

  // If no API key, return mock simulation
  if (!activeKey) {
    return generateMockDMResponse(characters, actions, roundNumber);
  }

  try {
    let rawContent = '{}';

    if (isGemini) {
      // Google Gemini API call with automatic demand failover
      let candidateModels = [
        'gemini-3.5-flash',
        'gemini-flash-lite-latest',
        'gemini-3.1-flash-lite',
        'gemini-3.5-flash-lite',
        'gemini-3.7-flash',
        'gemini-3.8-flash'
      ];
      if (activeModel.startsWith('gemini') && !activeModel.includes('1.5') && !activeModel.includes('2.0')) {
        candidateModels = [activeModel, ...candidateModels.filter(m => m !== activeModel)];
      }

      let lastError: Error | null = null;
      let success = false;

      for (const m of candidateModels) {
        try {
          const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${activeKey}`;
          const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              contents: [
                {
                  parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }]
                }
              ],
              generationConfig: {
                response_mime_type: 'application/json',
                temperature: 0.7,
              }
            })
          });

          if (!response.ok) {
            const errText = await response.text();
            console.warn(`Gemini model ${m} status ${response.status}: ${errText}`);
            lastError = new Error(`Gemini ${m} error: ${response.statusText} (${errText})`);
            continue; // try next candidate model
          }

          const data = await response.json();
          rawContent = data.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
          success = true;
          break;
        } catch (err: any) {
          lastError = err;
        }
      }

      if (!success && lastError) {
        throw lastError;
      }
    } else {
      // DeepSeek API call
      const response = await fetch('https://api.deepseek.com/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${activeKey}`
        },
        body: JSON.stringify({
          model: activeModel,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ],
          temperature: 0.7,
          max_tokens: 2000,
          response_format: { type: 'json_object' }
        })
      });

      if (!response.ok) {
        const errText = await response.text();
        console.error('DeepSeek API error status:', response.status, errText);
        throw new Error(`DeepSeek API error: ${response.statusText} (${errText})`);
      }

      const data = await response.json();
      rawContent = data.choices?.[0]?.message?.content || '{}';
    }
    
    // Parse JSON
    let parsed: DeepSeekDMResponse;
    try {
      const cleaned = rawContent.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim();
      parsed = JSON.parse(cleaned);
    } catch (parseErr) {
      console.warn('Failed to parse clean JSON, extracting manually:', parseErr);
      parsed = {
        narrative: rawContent,
        playerUpdates: [],
        currentSituation: 'Раунд завершен. Что предпринимает отряд?',
      };
    }

    if (!Array.isArray(parsed.playerUpdates)) {
      parsed.playerUpdates = [];
    }

    return parsed;
  } catch (err: any) {
    console.error('Error in generateDMTurn, falling back to simulation:', err.message);
    const providerName = isGemini ? 'Gemini' : 'DeepSeek';
    return generateMockDMResponse(characters, actions, roundNumber, `(Примечание мастера: Ошибка ${providerName} API: ${err.message}. Включен резервный режим)`);
  }
}

function generateMockDMResponse(
  characters: CharacterEntity[],
  actions: TurnActionEntity[],
  roundNumber: number,
  prefixNote: string = ''
): DeepSeekDMResponse {
  const narratives: string[] = [];
  const playerUpdates: { characterId: string; hpDelta: number; note: string }[] = [];

  if (prefixNote) {
    narratives.push(prefixNote);
  }

  narratives.push(`⚔️ **Раунд ${roundNumber}: Разрешение действий отряда**\n`);

  actions.forEach(action => {
    const highestRoll = action.diceRolls?.[0]?.total || 10;
    const isCritSuccess = action.diceRolls?.some(r => r.isCriticalSuccess);
    const isCritFail = action.diceRolls?.some(r => r.isCriticalFail);

    if (isCritSuccess) {
      narratives.push(`🌟 **${action.characterName}** проявляет невероятное мастерство! Бросок 20! Действие "${action.actionText}" завершается сокрушительным триумфом, повергая врагов в ужас.`);
    } else if (isCritFail) {
      narratives.push(`☠️ **${action.characterName}** терпит неудачу при броске 1! Действие "${action.actionText}" срывается из-за внезапной оплошности или скользкого пола.`);
      playerUpdates.push({
        characterId: action.characterId,
        hpDelta: -2,
        note: 'Урон от оплошности или ответного удара',
      });
    } else if (highestRoll >= 13) {
      narratives.push(`🗡️ **${action.characterName}** действует четко и решительно (Итоговый бросок: ${highestRoll}). Замысел "${action.actionText}" успешно воплощается в жизнь.`);
    } else {
      narratives.push(`🛡️ **${action.characterName}** встречает яростное сопротивление (Итоговый бросок: ${highestRoll}). Заявленное действие "${action.actionText}" лишь частично достигает цели, а противник контратакует.`);
      playerUpdates.push({
        characterId: action.characterId,
        hpDelta: -1,
        note: 'Легкое ранение в пылу схватки',
      });
    }
  });

  narratives.push(`\nФакелы тревожно колышутся в полумраке подземелья. Эхо схватки разносится по каменным сводам. Враги перегруппировываются для нового натиска.`);

  return {
    narrative: narratives.join('\n\n'),
    playerUpdates,
    currentSituation: `Напряжение нарастает. Враги готовятся к новой атаке, оценивая расстановку сил отряда.`,
    enemiesStatus: 'Противники настороже и готовы к новому столкновению.'
  };
}
