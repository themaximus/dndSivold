import { CharacterEntity, TurnActionEntity, RoomLootItem, LoreMilestone } from '../../db';
import { AIDMContext, AIDMPrologueContext } from '../../domain/types';

export class DMPromptBuilder {
  public getRandomEncounterSeed(genre: string = 'fantasy'): string {
    const fantasySeeds = [
      'Встреча с бродячим торговцем диковинками и зельями (едет на муле, просит помощи со сбруей, предлагает редкие снадобья и делится слухом о древнем склепе неподалёку).',
      'Встреча с караваном купцов (остановились у развилки, чинят сломанную ось повозки, предлагают награду за сопровождение или делятся горячей похлёбкой и новостями).',
      'Встреча с патрулем стражи или дозорным егерем (останавливает для расспросов о подозрительных знаках, предупреждает об опасной топи или ищет беглеца).',
      'Встреча с раненым путником / беглым послушником (нуждается в перевязке или зелье, шепчет тайное предостережение о заговоре, отдаёт странный ключ или карту тайника).',
      'Загадочное дорожное святилище или рунический обелиск с древней головоломкой/загадкой, дарующей благословение путникам.',
      'Покинутый лагерь первопроходцев со следами поспешного ухода, дневником с ценной зацепкой и забытыми припасами.',
    ];

    const cyberpunkSeeds = [
      'Встреча с уличным фиксером или подпольным торговцем имплантами в переулке, предлагающим срочный контракт или редкий биочип.',
      'Встреча с патрулем корпоративной службы безопасности (сканирование биометрии, проверка ID-чипов, возможность договориться или дать взятку).',
      'Транспортный фургон курьеров заглох из-за ЭМИ-вспышки; водитель просит помощи в починке блока питания в обмен на инфо-кристаллы.',
      'Раненый нетраннер прячется в вентиляционной шахте, умоляет укрыть его от дронов-ищеек и передает зашифрованную флешку.',
      'Заброшенный терминал доступа к узлу Сети с забытыми логами и прототипом программы.',
    ];

    const mafiaSeeds = [
      'Встреча с бродячим разносчиком газет и информатором, знающим тайны соперничающих семей.',
      'Подозрительный патруль полиции или продажный детектив, требующий взятку за проезд через квартал.',
      'Сломанный грузовик бутлегеров на лесной дороге; контрабандисты просят помочь вытащить ящики в обмен на долю.',
      'Раненый беглец из синдиката с бухгалтерской книгой клана, умоляющий об убежище.',
    ];

    const scifiSeeds = [
      'Автоматический торговый дроид-челнок, блуждающий между секторами с каталогом редких минералов и запчастей.',
      'Охранный патруль станции или инспектор карантинной службы со сканерами биоугроз.',
      'Грузовой космический шаттл с разгерметизированным отсеком, подающий сигнал SOS.',
      'Раненый инженер-исследователь в аварийном скафандре с зашифрованным планшетом.',
    ];

    let pool = fantasySeeds;
    if (/кибер|cyber/i.test(genre)) pool = cyberpunkSeeds;
    else if (/мафи|mafia/i.test(genre)) pool = mafiaSeeds;
    else if (/sci|космос/i.test(genre)) pool = scifiSeeds;

    return pool[Math.floor(Math.random() * pool.length)];
  }

  public buildSystemPrompt(): string {
    return `Ты — непревзойдённый, кинематографичный Мастер Подземелий (Dungeon Master) по правилам D&D 5-й редакции.
Твоя миссия — вести захватывающее, живое приключение на русском языке по циклу:
1. Описание последствий действий героев и бросков d20 (сравнение с КБ цели или СЛ проверки).
2. Развитие обстановки, реакция NPC и врагов.
3. Постановка новой тактической, социальной или моральной дилеммы перед отрядом.

ПРАВИЛА И ЗАКОНЫ МИРА:
1. ТРИ СТОЛПА D&D: Социальное взаимодействие, Исследование и Бой. Не своди игру к бесконечной резне! Бой начинается ТОЛЬКО когда игроки атакуют, нарываются на стражу/разбойников или входят в опасное логово. При победе над врагами бой завершается — переходи к исследованию, сбору трофеев, диалогам или отдыху.
2. МЕХАНИЧЕСКИЙ АРБИТР (⚖️): Строго следуй директивам арбитра в заявках!
   - Атака: сравнивай d20 + модификатор с КБ цели (enemy.ac). Попадание снижает hpCurrent врага; крит 20 — сокрушительный удар; крит 1 — досадный промах.
   - Проверки навыков и спасброски: сравнивай с текущей СЛ (room DC).
   - Запрет необоснованных ваншотов: если механический урон не снижает HP цели до 0, цель выживает и продолжает бой!
3. ВРАГИ ("activeEnemies"): Добавляй врагов ТОЛЬКО если идёт бой (с уникальным id, именем name, type, hpMax, hpCurrent, ac, status="В бою", isDead=false). При победе или мирной сцене — пустой массив [].
4. ПЕРСОНАЖИ В СЦЕНЕ ("sceneNPCs"): Все встреченные NPC (торговцы, раненые путники, стражники, союзники) фиксируются в "sceneNPCs" (id, name, role, hpCurrent, hpMax, ac, disposition="friendly"|"neutral"|"cautious"|"offended"|"frightened"|"hostile", combatRole="ally_combatant"|"neutral_observer"|"hiding"|"fled", status, isDead).
   - Если NPC прячется — combatRole="hiding", status="Прячется в укрытии". ЗАПРЕЩЕНО удалять NPC со сцены только потому, что он спрятался!
   - Удалять со сцены ("departedNPCs") ТОЛЬКО если персонаж физически покинул локацию или отстал.
   - Если персонажа лечат — увеличь hpCurrent и обнови status.
5. ИНВЕНТАРЬ ("inventoryUpdates"): Если предмет выпит, потрачен или сломан — action="remove". Если найден, подобран или получен — action="add" с историей history.
6. СОСТОЯНИЯ ("conditionUpdates"): Если сбитый с ног персонаж встает — сними состояние "prone" (action="remove", condition="prone").
7. ЗАДАЧИ И КВЕСТЫ ("questUpdates"): Добавляй новые задачи (action="add"), завершай выполненные (action="complete" с resolutionNote).
8. ОБЫСКАННЫЕ ОБЪЕКТЫ ("searchedObjectUpdates"): Фиксируй опустошённые контейнеры и повозки. Повторный обыск того же объекта запрещён!
9. ЧИСТЫЙ ТЕКСТ NARRATIVE: Пиши ТОЛЬКО художественный текст для озвучки диктором! КАТЕГОРИЧЕСКИ ЗАПРЕЩЕНО писать "📌 Итог ситуации" или "❓ Выбор перед вами" внутри narrative.
10. ИТОГ И ВЫБОР: "currentSituation" (1-2 предложения) и "choiceDilemma" (вопрос/вызов к отряду) заполняй ТОЛЬКО в своих JSON-полях!
11. АБСУРДНЫЕ ДЕЙСТВИЯ: Если заявка игрока ломает логику мира (бластер в замке, бессмысленный спам), заполни "rejectedAction": { "characterName": "Имя", "reason": "Причина" }.

ОБЯЗАТЕЛЬНЫЙ ФОРМАТ ОТВЕТА (ТОЛЬКО ЧИСТЫЙ JSON без markdown \`\`\`):
{
  "narrative": "Художественное повествование раунда с описанием действий героев, диалогов и реакций окружения...",
  "playerUpdates": [],
  "activeEnemies": [],
  "sceneNPCs": [
    {
      "id": "npc_1",
      "name": "Имя NPC",
      "role": "Роль NPC",
      "hpCurrent": 15,
      "hpMax": 15,
      "ac": 11,
      "disposition": "friendly",
      "combatRole": "neutral_observer",
      "status": "Мирно беседует с отрядом",
      "isDead": false
    }
  ],
  "departedNPCs": [],
  "searchedObjectUpdates": [],
  "conditionUpdates": [],
  "inventoryUpdates": [],
  "questUpdates": [],
  "currentSituation": "Краткий итог раунда в 1-2 предложениях.",
  "choiceDilemma": "Конкретный тактический или моральный выбор перед отрядом на следующий ход.",
  "enemiesStatus": "Врагов поблизости нет. Обстановка спокойная.",
  "mood": "social",
  "nextRoundDC": 12,
  "nextRoundDCReason": "Стандартная проверка бдительности или диалога",
  "requiredCheckStat": "wis",
  "newMilestones": [
    "Отряд успешно совершил ход."
  ],
  "xpAwarded": 25,
  "rejectedAction": null,
  "campaignFinished": null
}`;
  }

  public formatPartyInfo(characters: CharacterEntity[] = []): string {
    if (!characters || characters.length === 0) return 'Информация о персонажах отсутствует.';
    return characters.map(c => {
      const condStr = c.conditions && c.conditions.length > 0 ? ` | Состояния: ${c.conditions.join(', ')}` : '';
      const activeWep = c.activeWeaponId
        ? c.inventory?.find(i => i.id === c.activeWeaponId || i.name.toLowerCase() === c.activeWeaponId?.toLowerCase())?.name
        : undefined;
      const activeShield = c.activeShieldId
        ? c.inventory?.find(i => i.id === c.activeShieldId || i.name.toLowerCase() === c.activeShieldId?.toLowerCase())?.name
        : undefined;
      const activeArmor = c.activeArmorId
        ? c.inventory?.find(i => i.id === c.activeArmorId || i.name.toLowerCase() === c.activeArmorId?.toLowerCase())?.name
        : undefined;
      const wepStr = activeWep ? ` | Оружие: ${activeWep}` : '';
      const shieldStr = activeShield ? ` | Щит: ${activeShield}` : '';
      const armorStr = activeArmor ? ` | Доспех: ${activeArmor}` : '';
      const itemsList = c.inventory && c.inventory.length > 0
        ? c.inventory.map(i => `${i.name}${i.quantity && i.quantity > 1 ? ` (x${i.quantity})` : ''}`).join(', ')
        : 'пусто';
      const statsStr = `СИЛ ${c.stats?.str ?? 10}, ЛОВ ${c.stats?.dex ?? 10}, ТЕЛ ${c.stats?.con ?? 10}, ИНТ ${c.stats?.int ?? 10}, МУД ${c.stats?.wis ?? 10}, ХАР ${c.stats?.cha ?? 10}`;
      const statusStr = c.lifeState === 'dead' ? ' [☠ ПОГИБ]' : c.lifeState === 'downed' ? ' [⚠️ ПРИ СМЕРТИ]' : '';

      return `* ID: "${c.id}" | ${c.name} (${c.race} ${c.characterClass}, ур. ${c.level})${statusStr}: HP ${c.hpCurrent}/${c.hpMax}, КБ ${c.ac} | ${statsStr}${wepStr}${shieldStr}${armorStr}${condStr}\n  Рюкзак: ${itemsList}${c.bio ? `\n  Квента: "${c.bio}"` : ''}`;
    }).join('\n');
  }

  public formatActionsSummary(
    actions: TurnActionEntity[],
    characters?: CharacterEntity[],
    mechanicalDirectives?: Record<string, string>,
    availableLoot?: RoomLootItem[],
    loreJournal?: LoreMilestone[]
  ): string {
    return actions.map(a => {
      const typeLabel = a.actionType === 'attack'
        ? `АТАКА ПО ЦЕЛИ: ${a.targetEnemyName || a.targetEnemyId || 'Враг'}`
        : a.actionType === 'save'
        ? 'СПАСБРОСОК'
        : a.actionType === 'check'
        ? 'ПРОВЕРКА НАВЫКА'
        : 'ДЕЙСТВИЕ';

      const advLabel = a.advantage ? ' [Преимущество]' : a.disadvantage ? ' [Помеха]' : '';
      const spellLabel = a.spellLevelUsed ? ` [Ячейка ${a.spellLevelUsed} круга]` : '';

      const diceInfo = a.diceRolls && a.diceRolls.length > 0
        ? a.diceRolls.map((r: any) => `d20 [${r.rolls.join('+')}${r.modifier >= 0 ? '+' : ''}${r.modifier} = ${r.total}${r.isCriticalSuccess ? ' ★ Крит 20!' : ''}${r.isCriticalFail ? ' ☠ Крит 1!' : ''}, ${r.purpose || 'Бросок'}]`).join('; ')
        : 'Без броска';

      const char = characters?.find(c => c.id === a.characterId || c.name.toLowerCase() === (a.characterName || '').toLowerCase());
      const actLower = a.actionText.toLowerCase();

      // Mentioned inventory item
      const mentionedItems: string[] = [];
      if (char && Array.isArray(char.inventory)) {
        for (const item of char.inventory) {
          if (item?.name && actLower.includes(item.name.toLowerCase().trim())) {
            mentionedItems.push(`«${item.name}»`);
          }
        }
      }
      const itemNote = mentionedItems.length > 0 ? ` [Использует: ${mentionedItems.join(', ')}]` : '';

      // Pick up item from loot
      const pickupRegex = /(подня(л|ть|ли|ла)|подобра(л|ть|ли|ла)|вытащи(л|ть|ли|ла)|выдерну(л|ть|ли|ла)|схвати(л|ть|ли|ла)|подхвати(л|ть|ли|ла)|наш(ел|ла|ли)|забра(л|ть|ли|ла)|верну(л|ть|ли|ла)|достал(а)?)/i;
      let pickupNote = '';
      if (pickupRegex.test(actLower)) {
        for (const loot of (availableLoot || [])) {
          if (loot?.name && actLower.includes(loot.name.toLowerCase().trim())) {
            pickupNote = ` [Подбор: «${loot.name}»]`;
            break;
          }
        }
      }

      // Stand up from prone
      const standUpRegex = /(вста(ю|ть|л|ла|ли|ем|йте)|поднима(юсь|ется|ться|лась|лся|лись)|на ноги|отряхива(юсь|ется|ясь|лась|лся)|подня(лся|лась|лись)|выпрям(ился|илась|иться))/i;
      const standUpNote = (char && char.conditions?.includes('prone') && standUpRegex.test(actLower)) ? ' [Встает на ноги]' : '';

      // Arbiter directive
      const arbiterDirective = mechanicalDirectives && mechanicalDirectives[a.id]
        ? `\n  ${mechanicalDirectives[a.id]}`
        : '';

      // Aggressive action
      const hasNegatedAggression = /(не\s+(атаковать|бить|стрелять|рубить|убивать|нападать)|без\s+(боя|нападения|драки)|прекратить\s+(атаковать|бой)|мирн(ый|о)|умиротвор|успоко)/i.test(a.actionText);
      const aggressiveRegex = /(атак(а|ую|овать)|удар(ить|яю)?|рубл(ю|ить)|выстрел(ить|ю)?|стреля(ю|ть)|дуэл(ь|и)|напад(аю|ать|ение)|сража(ться|юсь)|вступаю в бой|выхватываю (меч|клинок|оружие)|достаю (меч|клинок|топор|лук)|врезать|приконч(ить|у)|уб(ить|ью)|вламыва(юсь|ться)|взламыва(ю|ть)|захожу в запретн|прокрадыва(юсь|ться) в покои|нарыва(юсь|ется)|провоцир(ую|овать))/i;
      const combatTriggerNote = (!hasNegatedAggression && (a.actionType === 'attack' || aggressiveRegex.test(a.actionText)) && !arbiterDirective)
        ? ' [Агрессия: инициация боя]'
        : '';

      return `* Игрок "${a.characterName}" (ID: "${a.characterId}") — ${typeLabel}${advLabel}${spellLabel}: "${a.actionText}"\n  Бросок: ${diceInfo}${itemNote}${pickupNote}${standUpNote}${combatTriggerNote}${arbiterDirective}`;
    }).join('\n\n');
  }

  public buildUserPrompt(context: AIDMContext): string {
    const partyInfo = this.formatPartyInfo(context.characters);
    const actionsSummary = this.formatActionsSummary(
      context.actions,
      context.characters,
      context.mechanicalDirectives,
      context.availableLoot,
      context.loreJournal
    );

    const livingEnemies = (context.activeEnemies || []).filter(e => !e.isDead && e.hpCurrent > 0);
    const enemiesSummary = livingEnemies.length > 0
      ? livingEnemies.map(e => `* [ID: "${e.id}"] ${e.name} (${e.type || 'враг'}): HP ${e.hpCurrent}/${e.hpMax}, КБ ${e.ac || 12}. Статус: ${e.status}`).join('\n')
      : 'Врагов нет (мирная сцена).';

    const livingNPCs = (context.sceneNPCs || []).filter(n => !n.isDead && n.hpCurrent > 0);
    const npcsSummary = livingNPCs.length > 0
      ? livingNPCs.map(n => `* [ID: "${n.id}"] ${n.name} (${n.role}): HP ${n.hpCurrent}/${n.hpMax}, КБ ${n.ac || 11}. Отношение: ${n.disposition}, роль: ${n.combatRole}. "${n.status}"`).join('\n')
      : '';

    const parts: string[] = [];

    // Core setting & context
    parts.push(`СЕТТИНГ: ${context.setting} (Жанр: ${context.genre || 'фэнтези'}, Раунд: ${context.roundNumber})`);
    if (context.campaignPlot) parts.push(`СЮЖЕТНАЯ КАНВА: ${context.campaignPlot}`);
    if (context.previousHistory?.length) parts.push(`ПРЕДЫДУЩИЕ СОБЫТИЯ: ${context.previousHistory.slice(-2).join(' ')}`);
    if (context.loreJournal?.length) parts.push(`ХРОНИКА ВЕХ: ${context.loreJournal.slice(-4).map(m => `[Р${m.round}]: ${m.milestone}`).join('; ')}`);

    // Quests, searched objects, departed NPCs - ONLY when non-empty
    if (context.activeQuests?.length) {
      parts.push(`АКТИВНЫЕ КВЕСТЫ:\n${context.activeQuests.map(q => `* [${q.category}] «${q.title}»: ${q.description}${q.giverName ? ` (${q.giverName})` : ''}`).join('\n')}`);
    }
    if (context.completedQuests?.length) {
      parts.push(`ЗАВЕРШЁННЫЕ КВЕСТЫ (не повторять их!): ${context.completedQuests.map(q => `«${q.title}»`).join(', ')}`);
    }
    if (context.searchedObjects?.length) {
      parts.push(`ОБЫСКАННЫЕ ОБЪЕКТЫ (лут пуст): ${context.searchedObjects.map(s => `«${s.targetName}»`).join(', ')}`);
    }
    if (context.worldNPCRegistry?.length) {
      parts.push(`ВЫБЫВШИЕ ПЕРСОНАЖИ: ${context.worldNPCRegistry.map(n => `«${n.name}» (${n.departureReason || 'покинул сцену'})`).join(', ')}`);
    }
    if (context.environmentObjects?.length) {
      parts.push(`ОБЪЕКТЫ ОКРУЖЕНИЯ:\n${context.environmentObjects.map(o => `* «${o.name}» (${o.isOperational ? 'готов' : 'не готов'}, ${o.state})`).join('\n')}`);
    }
    if (context.currentZoneName) {
      parts.push(`ЛОКАЦИЯ: «${context.currentZoneName}»`);
    }

    // Party, enemies, scene NPCs
    parts.push(`\nОТРЯД:\n${partyInfo}`);
    parts.push(`\nВРАГИ:\n${enemiesSummary}`);
    if (npcsSummary) parts.push(`\nNPC В СЦЕНЕ:\n${npcsSummary}`);

    // Situation & Room DC
    parts.push(`\nОБСТАНОВКА (Раунд ${context.roundNumber}): ${context.currentSituation || 'Приключение продолжается.'}`);
    parts.push(`СЛ проверки: ${context.currentDC || 12} (${context.currentDCReason || 'Стандарт'}) [Характеристика: ${context.requiredCheckStat?.toUpperCase() || 'ЛЮБАЯ'}]`);

    // Companion reactions if any
    const completedReactions = (context.characterReactions || []).filter(r => r.status === 'completed');
    if (completedReactions.length > 0) {
      const reactLines = completedReactions.map(r => {
        const rollStr = r.reactionRoll ? ` (d20: ${r.reactionRoll.total})` : '';
        const toneStr = r.responseType === 'negative' ? 'Отказ' : r.responseType === 'counter' ? 'Контратака' : 'Помощь';
        return `* Соратник «${r.targetCharacterName}» [${toneStr}]: «${r.reactionText}»${rollStr}`;
      }).join('\n');
      parts.push(`\nРЕАКЦИИ СОРАТНИКОВ:\n${reactLines}`);
    }

    // Turn mode guidance
    if (context.turnMode === 'turn_by_turn' && context.actions.length === 1) {
      parts.push(`\nРЕЖИМ: Пошаговый. Ход совершает «${context.actions[0].characterName}». Опиши последствия его действий и обнови обстановку для следующего игрока.`);
    }

    // Actions & closing directive
    parts.push(`\nДЕЙСТВИЯ ГЕРОЕВ:\n${actionsSummary}`);
    parts.push('\nОпиши художественные последствия действий героев, реакцию мира/NPC и сформулируй новую дилемму. Верни чистый JSON.');

    return parts.join('\n');
  }

  public buildPrologueSystemPrompt(): string {
    return `Ты — великий Мастер Подземелий (Dungeon Master) по правилам D&D 5-й редакции, способный создавать захватывающие кинематографичные истории в ЛЮБОМ жанре (фэнтези, киберпанк, мафия 1930-х, sci-fi, детектив, хоррор).
Твоя задача — создать захватывающий Пролог приключения, заложить генеральную сюжетную арку (campaignPlot) и поставить перед героями первую интригующую дилемму без каких-либо искусственных ограничений и жестких «рельсов».

ГЛАВНЫЕ ТРЕБОВАНИЯ К ПРОЛОГУ:
1. АТМОСФЕРА И РАЗНООБРАЗИЕ ЗАВЯЗОК (ПРОЛОГ НЕ ДОЛЖЕН НАЧИНАТЬСЯ СО СПЛОШНОГО БОЯ!):
   - Напиши выразительный текст (2–3 художественных абзаца), строго выдержанный в заданном сеттинге и жанре.
   - Детально представь каждого собравшегося героя отряда, их экипировку, класс и характер.
   - Начни историю с интригующей завязки, подходящей под тип приключения (исследование заброшенных руин/подземелья, дорожное происшествие в открытом мире, городское расследование, засада или тайное святилище).
   - Сделай ВСЕХ встреченных персонажей живыми, надели их речью, манерами и интересными проблемами, которые задают направление приключения!
2. ГЕНЕРАЛЬНАЯ СЮЖЕТНАЯ АРКА МОДУЛЯ (campaignPlot):
   - Сформулируй сквозной замысел приключения на 5 актов под заданную длительность (Завязка -> Развитие -> Кризис -> Кульминация -> Развязка).
3. ОБЯЗАТЕЛЬНЫЙ ИТОГ СИТУАЦИИ И ВЫБОР (ТОЛЬКО В ОТДЕЛЬНЫЕ JSON-ПОЛЯ, НЕ В NARRATIVE!):
   - "currentSituation": краткий итог происходящего прямо сейчас (1-2 предложения).
   - "choiceDilemma": конкретный выбор или вызов, перед которым оказались герои на первый ход.
   - КАТЕГОРИЧЕСКИ ЗАПРЕЩЕНО писать фразы "📌 Итог ситуации:" или "❓ Выбор перед вами:" внутри поля narrative! Текст narrative предназначен для художественного чтения и голосового диктора.
4. СИНХРОНИЗАЦИЯ ВСЕХ ДЕЙСТВУЮЩИХ ЛИЦ (sceneNPCs и activeEnemies):
   - Если пролог мирный или исследовательский — оставь "activeEnemies": [] и выстави mood в "social", "mystery" или "exploration".
   - КАЖДЫЙ персонаж, упомянутый в тексте пролога (будь то купец, раненый путник, дозорный, наниматель, сопровождающий), ОБЯЗАН быть добавлен в массив "sceneNPCs" с реалистичными HP, КБ, "disposition" и "combatRole"! Если в тексте два или три персонажа — добавь в "sceneNPCs" ВСЕХ ИХ!
   - Добавляй врагов в activeEnemies ТОЛЬКО если сцена прямо начинается с открытой боевой стычки!

ОБЯЗАТЕЛЬНЫЙ ФОРМАТ ОТВЕТА (ТОЛЬКО ЧИСТЫЙ JSON без markdown \`\`\`):
{
  "narrative": "Атмосферный художественный пролог в сеттинге приключения с представлением героев и встречей с колоритными персонажами или первой загадкой...",
  "playerUpdates": [],
  "currentSituation": "Краткое описание обстановки, в которой отряд начинает свои действия.",
  "choiceDilemma": "Конкретный тактический или моральный выбор перед отрядом на первый раунд.",
  "activeEnemies": [],
  "sceneNPCs": [
    {
      "id": "ent_npc_first",
      "name": "Имя Персонажа",
      "role": "Роль или профессия в сцене",
      "hpCurrent": 18,
      "hpMax": 18,
      "ac": 12,
      "disposition": "friendly",
      "combatRole": "neutral_observer",
      "status": "Краткое описание текущего состояния и позы",
      "isDead": false
    }
  ],
  "enemiesStatus": "Врагов поблизости нет. Обстановка спокойная.",
  "mood": "social",
  "nextRoundDC": 12,
  "nextRoundDCReason": "Осмотр окружения или разговор с персонажем",
  "requiredCheckStat": "cha",
  "campaignPlot": "Акт 1: Завязка и открытие тайны. Акт 2: Расследование знамений. Акт 3: Поиски логова. Акт 4: Штурм твердыни. Акт 5: Финал.",
  "newMilestones": [
    "Начало приключения: отряд ступил на путь испытаний."
  ],
  "xpAwarded": 25
}`;
  }

  public buildPrologueUserPrompt(context: AIDMPrologueContext): string {
    const partyInfo = this.formatPartyInfo(context.characters);
    const durationRounds = context.campaignDuration === 'short' ? '10 раундов' : context.campaignDuration === 'long' ? '20+ раундов' : '16 раундов';
    const randomEncounterSeed = this.getRandomEncounterSeed(context.genre);

  return `НАЗВАНИЕ ПРИКЛЮЧЕНИЯ:
${context.title}

ЖАНР: ${context.genre || 'фэнтези'} (Используй оружие, окружение и стиль выбранного жанра!)
ДЛИТЕЛЬНОСТЬ МОДУЛЯ: ${context.campaignDuration || 'medium'} (примерно ${durationRounds})

СЕТТИНГ, ПРЕДЫСТОРИЯ И ЛОР:
${context.setting}

СОСТАВ ОТРЯДА ПРИКЛЮЧЕНЦЕВ:
${partyInfo}

СЛУЧАЙНЫЙ ИМПУЛЬС ДЛЯ СТАРТА (ИСПОЛЬЗУЙ ДЛЯ ВДОХНОВЕНИЯ — НЕ НАЧИНАЙ СО СПЛОШНОГО БОЯ!):
👉 ${randomEncounterSeed}

ИНСТРУКЦИЯ ПО ГЕНЕРАЦИИ:
Создай кинематографичный пролог (2-3 художественных абзаца) под жанр «${context.genre || 'фэнтези'}».
Пусть завязка будет живой, случайной и не шаблонной: встреча с торговцем, караваном, раненым путником, стражей или интересным происшествием.
Если в сцене фигурирует встреченный NPC — добавь его в "sceneNPCs" (с id, name, role, hpCurrent, hpMax, ac, disposition="friendly"/"neutral", combatRole="neutral_observer", status).
Сформулируй campaignPlot, currentSituation и choiceDilemma.
Поле narrative пиши ЧИСТЫМ художественным текстом (БЕЗ фраз "📌 Итог ситуации" или "❓ Выбор перед вами").
Если бой не начинается сразу, оставь activeEnemies пустым ([]), а mood установи в "social" или "mystery". Верни чистый JSON.`;
  }
}

export const dmPromptBuilder = new DMPromptBuilder();
