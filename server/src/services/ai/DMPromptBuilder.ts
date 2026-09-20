import { CharacterEntity, TurnActionEntity } from '../../db';
import { AIDMContext } from '../../domain/types';

export class DMPromptBuilder {
  public buildSystemPrompt(): string {
    return `Ты — беспристрастный, кинематографичный и строгий Мастер Подземелий (Dungeon Master) по правилам D&D 5-й редакции.
Твоя задача — вести захватывающее, честное текстовое настольное ролевое приключение на русском языке.

ГЛАВНЫЕ ПРАВИЛА, БАЛАНС И СЛОЖНОСТЬ (DC / СЛ):
1. ОЦЕНКА БРОСКОВ ИГРОКОВ ПРОТИВ СЛОЖНОСТИ РАУНДА (СЛ):
   - Игроки бросают кубик d20 на успешность своих действий против установленной Сложности (СЛ / DC).
   - Если результат броска >= СЛ: это УСПЕХ. Действие героя увенчалось успехом, опиши триумф и продвижение вперед.
   - Если результат броска < СЛ: это ПРОВАЛ. Противники контратакуют, попытка срывается, нанеси персонажу соразмерный урон (hpDelta).
   - Если выпала Натуральная 20: КРИТИЧЕСКИЙ ТРИУМФ! Окружение подыгрывает герою, ошеломляющий результат, максимальный урон врагам.
   - Если выпала Натуральная 1: КРИТИЧЕСКИЙ ПРОВАЛ! Катастрофический конфуз, оружие выбито или застряло, тяжелая контратака.

2. ЧИСТОЕ ЛИТЕРАТУРНОЕ ПОВЕСТВОВАНИЕ ДЛЯ ГОЛОСОВОГО ДИКТОРА:
   - Текст поля "narrative" читается нейросетевым диктором вслух!
   - КАТЕГОРИЧЕСКИ ЗАПРЕЩЕНО писать в narrative технические скобки и циферки вроде «(итоговый результат проверки 5)», «(СЛ 14)», «-4 HP», «d20».
   - Пиши живую, сочную художественную аудиокнигу. Все числовые изменения здоровья пиши СТРОГО в массив playerUpdates.
   - Обязательно используй букву «ё» везде, где она нужна (тяжёлый, нанёс, ослеплённый, рассечён, разъярён, мёртвый).

3. ЛУТ, ОПЫТ (XP), СЛОЖНОСТЬ СЛЕДУЮЩЕГО ХОДА И ПАМЯТЬ:
   - Назначай сложность следующего испытания "nextRoundDC" (число от 10 до 20) и краткое тактическое объяснение "nextRoundDCReason".
   - Если враги повержены или найден тайник/сундук, генерируй выпавший лут в "droppedLoot".
   - Если произошло важное сюжетное событие, запиши его в "newMilestones" (это веха для долгосрочной памяти сюжета).
   - Начисляй опыт отряду в поле "xpAwarded" (обычно 25-100 XP за бой или испытание).

ОБЯЗАТЕЛЬНЫЙ ФОРМАТ ОТВЕТА (ТОЛЬКО ЧИСТЫЙ JSON без префиксов и без markdown блоков кода):
{
  "narrative": "Художественное повествование раунда...",
  "playerUpdates": [
    {
      "characterId": "id_персонажа",
      "hpDelta": -3,
      "note": "Удар эфесом меча"
    }
  ],
  "currentSituation": "Краткое описание обстановки и вопрос игрокам 'Что вы делаете?'",
  "enemiesStatus": "Состояние врагов",
  "mood": "combat", // "combat" | "tension" | "mystery" | "triumph" | "calm"
  "nextRoundDC": 14, // Сложность следующего раунда (10-20)
  "nextRoundDCReason": "Хобгоблины заняли возвышенность и целятся из арбалетов",
  "droppedLoot": [
    {
      "name": "Зелье малого исцеления",
      "type": "potion", // "weapon" | "armor" | "potion" | "misc"
      "description": "Флакон с мерцающей алой жидкостью. Восстанавливает 2d4+2 HP.",
      "healAmount": 8
    }
  ],
  "newMilestones": [
    "Отряд одолел засаду гоблинов на тракте и раскрыл ложь о фальшивом кладе."
  ],
  "xpAwarded": 50
}`;
  }

  public buildUserPrompt(context: AIDMContext): string {
    const partyInfo = this.formatPartyInfo(context.characters);
    const actionsSummary = this.formatActionsSummary(context.actions);

    const loreSummary = context.loreJournal && context.loreJournal.length > 0
      ? context.loreJournal.map(m => `* [Раунд ${m.round}]: ${m.milestone}`).join('\n')
      : 'Приключение только началось. Значимых вех пока нет.';

    return `СЕТТИНГ И ПРЕМБУЛА КАМПАНИИ:
${context.setting}

ХРОНИКА КЛЮЧЕВЫХ ВЕХ ИСТОРИИ (Долгосрочная память мира):
${loreSummary}

ТЕКУЩИЙ СОСТАВ ОТРЯДА (Учитывай квенты, страхи и характеры героев):
${partyInfo}

ТЕКУЩАЯ ОБСТАНОВКА (Раунд ${context.roundNumber}):
${context.currentSituation || 'Приключение начинается.'}
ТЕКУЩАЯ СЛОЖНОСТЬ ЭТОГО РАУНДА (СЛ): ${context.currentDC || 12} (${context.currentDCReason || 'Стандартная угроза'})

ДЕЙСТВИЯ ИГРОКОВ В ЭТОМ РАУНДЕ (Сравни их броски с СЛ ${context.currentDC || 12}):
${actionsSummary}

Разреши раунд согласно правилам D&D 5e и верни чистый JSON.`;
  }

  public formatPartyInfo(characters: CharacterEntity[]): string {
    return characters.map(c => `
- Имя: ${c.name} (${c.race} ${c.characterClass}, уровень ${c.level})
  Статус: ${c.lifeState === 'dead' ? '☠ ПОГИБ' : c.lifeState === 'downed' ? '⚠️ ПРИ СМЕРТИ (0 HP)' : 'В строю'}
  HP: ${c.hpCurrent}/${c.hpMax}, КБ: ${c.ac}
  Характеристики: СИЛ ${c.stats.str}, ЛОВ ${c.stats.dex}, ТЕЛ ${c.stats.con}, ИНТ ${c.stats.int}, МУД ${c.stats.wis}, ХАР ${c.stats.cha}
  Способности: ${c.abilities.map(a => a.name).join(', ')}
  Инвентарь/Оружие: ${c.inventory.map(i => `${i.name} (${i.type})`).join(', ')}
  Квента / Личная история / Характер: ${c.bio || 'Опытный искатель приключений'}
`).join('\n');
  }

  public formatActionsSummary(actions: TurnActionEntity[]): string {
    return actions.map(a => {
      const diceInfo = a.diceRolls && a.diceRolls.length > 0
        ? a.diceRolls.map((r: any) => `[Кость: ${r.diceType}, Выпало: ${r.rolls.join('+')} (${r.modifier >= 0 ? '+' : ''}${r.modifier}) = Итого: ${r.total}${r.isCriticalSuccess ? ' ★ КРИТИЧЕСКИЙ УСПЕХ (20)!' : ''}${r.isCriticalFail ? ' ☠ КРИТИЧЕСКИЙ ПРОВАЛ (1)!' : ''}, Цель: ${r.purpose}]`).join('; ')
        : 'Без броска кубика';

      return `* Игрок ${a.characterName}: "${a.actionText}"\n  Официальный результат броска: ${diceInfo}`;
    }).join('\n\n');
  }
}

export const dmPromptBuilder = new DMPromptBuilder();
