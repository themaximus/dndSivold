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
      : 'Врагов в текущей сцене нет (мирная фаза, диалог, исследование, отдых или затишье).';

    const livingNPCs = (context.sceneNPCs || []).filter(n => !n.isDead && n.hpCurrent > 0);
    const npcsSummary = livingNPCs.length > 0
      ? livingNPCs.map(n => {
          const roleLabel = n.combatRole === 'ally_combatant'
            ? '⚔️ В БОЮ ЗА ОТРЯД (Союзник)'
            : n.combatRole === 'hiding'
            ? '📦 ПРЯЧЕТСЯ В УКРЫТИИ'
            : n.combatRole === 'fled'
            ? '🏃 В БЕГСТВЕ'
            : '👀 НАБЛЮДАЕТ СО СТОРОНЫ';
          const dispLabel = n.disposition === 'friendly'
            ? 'Дружелюбен'
            : n.disposition === 'offended'
            ? 'Обижен'
            : n.disposition === 'frightened'
            ? 'Напуган'
            : n.disposition === 'hostile'
            ? 'Враждебен'
            : n.disposition === 'cautious'
            ? 'Осторожен'
            : 'Нейтрален';
          return `* [ID: "${n.id}"] ${n.name} (${n.role}): HP ${n.hpCurrent}/${n.hpMax}, КБ ${n.ac || 11}. Отношение: ${dispLabel}. Боевой статус: ${roleLabel}. Действие: "${n.status}"`;
        }).join('\n')
      : 'В сцене нет дополнительных персонажей или спутников.';

    const durationRounds = context.campaignDuration === 'short' ? '10 раундов' : context.campaignDuration === 'long' ? '20+ раундов' : '16 раундов';
    const loreSummary = (context.loreJournal && context.loreJournal.length > 0)
      ? context.loreJournal.slice(-8).map(m => `[Раунд ${m.round}]: ${m.milestone}`).join('\n')
      : 'Летопись только начинается.';

    const activeQuestsSummary = (context.activeQuests && context.activeQuests.length > 0)
      ? context.activeQuests.map(q => `* [${q.category.toUpperCase()}] «${q.title}»: ${q.description}${q.giverName ? ` (Источник/заказчик: ${q.giverName})` : ''}`).join('\n')
      : 'Особых активных задач нет (свободное исследование мира).';

    const completedQuestsSummary = (context.completedQuests && context.completedQuests.length > 0)
      ? context.completedQuests.map(q => `* ✅ [ВЫПОЛНЕНО в раунде ${q.roundCompleted || q.roundCreated}] «${q.title}» — ${q.resolutionNote || 'Задача успешно решена отрядом. КАТЕГОРИЧЕСКИ ЗАПРЕЩЕНО ПОВТОРНО ПРЕДЛАГАТЬ ЭТУ ПРОБЛЕМУ!'}`).join('\n')
      : 'Пока нет завершённых задач.';

    const searchedObjectsSummary = (context.searchedObjects && context.searchedObjects.length > 0)
      ? context.searchedObjects.map(s => `* 📦 [ОБЫЩЕНО в раунде ${s.searchedInRound}] «${s.targetName}» (${s.targetType}) — Извлечено: ${s.extractedItems && s.extractedItems.length > 0 ? s.extractedItems.join(', ') : 'всё ценное извлечено'}. СТАТУС: ОБЪЕКТ ПУСТ!`).join('\n')
      : 'Пока нет обысканных или опустошённых объектов/транспорта.';

    const worldNPCsSummary = (context.worldNPCRegistry && context.worldNPCRegistry.length > 0)
      ? context.worldNPCRegistry.map(n => `* 🏛️ «${n.name}» (${n.role || 'персонаж'}) — Выбыл в раунде ${n.departureRound || '?'}. Причина: ${n.departureReason || 'покинул сцену'}. Заметка: ${n.narrativeNote || 'Вне текущей сцены'}`).join('\n')
      : 'Архив покинувших сцену персонажей пуст.';

    const environmentObjectsSummary = (context.environmentObjects && context.environmentObjects.length > 0)
      ? context.environmentObjects.map(obj => {
          const statusIcon = obj.isOperational ? '🟢' : '🔴';
          const stageInfo = obj.progressStage ? `[Этап ${obj.progressStage.current}/${obj.progressStage.max}: ${obj.progressStage.currentStageText}]` : '';
          const blockerInfo = obj.physicalBlocker ? ` | БЛОКЕР: ${obj.physicalBlocker}` : '';
          const prereqInfo = obj.requiredPrerequisites?.length ? ` | ТРЕБУЕТСЯ: ${obj.requiredPrerequisites.join(', ')}` : '';
          return `* ${statusIcon} «${obj.name}» (ID: "${obj.key}", Состояние: ${obj.state}, На ходу/готов: ${obj.isOperational ? 'ДА' : 'НЕТ'}) ${stageInfo}${blockerInfo}${prereqInfo}`;
        }).join('\n')
      : 'В сцене нет специфических интерактивных объектов окружения.';

    const currentZoneLabel = context.currentZoneName || 'Текущая локация';
    const spatialZonesSummary = (context.spatialZones && context.spatialZones.length > 0)
      ? context.spatialZones.map(z => {
          const isCurr = z.isCurrent ? '📍 [ТЕКУЩАЯ ЛОКАЦИЯ]' : '🗺️ [ПОКИНУТАЯ ЛОКАЦИЯ]';
          const leftSummary = z.leftEntities && z.leftEntities.length > 0
            ? ` | ОСТАВЛЕНЫ: ${z.leftEntities.map(e => `«${e.canonicalName}» (${e.status}, раунд ${e.leftAtRound})`).join(', ')}`
            : '';
          return `* ${isCurr} «${z.name}» (Ключ: "${z.zoneKey}", Последний визит: раунд ${z.lastVisitedRound})${leftSummary}`;
        }).join('\n')
      : `* 📍 [ТЕКУЩАЯ ЛОКАЦИЯ] «${currentZoneLabel}»`;

    const historySnippet = (context.previousHistory && context.previousHistory.length > 0)
      ? context.previousHistory.slice(-3).map((h, i) => `[Предыдущее событие ${i + 1}]:\n${h}`).join('\n\n')
      : 'События только разворачиваются.';

    const turnGuidance = (context.turnMode || 'turn_by_turn') === 'turn_by_turn' && context.actions.length === 1
      ? `\n\n🎯 ОСОБАЯ ИНСТРУКЦИЯ ДЛЯ ПОШАГОВОГО РЕЖИМА (ХОД ЗА ХОДОМ):
Сейчас совершает свой индивидуальный ход герой «${context.actions[0].characterName}».
Разыграй конкретно последствия ЕГО действия вперед:
1. Опиши художественно и выразительно результат броска (успех или провал vs КБ цели или СЛ).
2. Измени здоровье цели (если атака попала по КБ) или здоровье героя (если получил ответный удар/урон), обнови состояния и инвентарь (поломка/расход).
3. В "currentSituation" зафиксируй обновленную обстановку в результате этого хода, так как СЛЕДУЮЩИЙ герой отряда будет делать свой ход, видя эти изменения!
4. В "choiceDilemma" сформулируй вызов или дилемму для следующего игрока отряда.`
      : '';

    const completedReactions = (context.characterReactions || []).filter(r => r.status === 'completed');
    const reactionsGuidance = completedReactions.length > 0
      ? `\n\n🤝⚡ ВЗАИМОДЕЙСТВИЕ ГЕРОЕВ И ВСТРЕЧНЫЕ РЕАКЦИИ СОРАТНИКОВ:
Игрок-инициатор («${completedReactions[0].initiatorCharacterName}») взаимодействует со своими соратниками по отряду.
Ответные реакции упомянутых соратников:
${completedReactions.map(r => {
  const rollStr = r.reactionRoll ? `[d20: ${r.reactionRoll.total}${r.reactionRoll.isCriticalSuccess ? ' ★ Крит. Успех' : r.reactionRoll.isCriticalFail ? ' ☠ Крит. Провал' : ''}]` : '[без броска]';
  const toneStr = r.responseType === 'negative' ? 'ОТКАЗ / СОПРОТИВЛЕНИЕ' : r.responseType === 'counter' ? 'КОНТРАТАКА / ПАРИРОВАНИЕ' : 'СОДЕЙСТВИЕ / ПОМОЩЬ';
  return `* Герой «${r.targetCharacterName}» (Характер ответа: ${toneStr}): «${r.reactionText}» (Бросок d20 реакции: ${rollStr})`;
}).join('\n')}

ИНСТРУКЦИЯ МАСТЕРУ:
Обязательно свяжи действие инициатора и ответные реакции соратников в единую кинематографичную сцену взаимодействия!
1. Сравни броски инициатора и реагирующих соратников:
   - Если соратник помогает/содействует: высокий бросок реакции усиливает действие инициатора, снижает урон отряду или гарантирует успех.
   - Если соратник сопротивляется/уклоняется/парирует: побеждает тот, чей результат d20 выше! Опиши, удалось ли инициатору задуманное или соратник ловко увернулся / блокировал выпад.
2. В повествовании отрази эмоциональную и тактическую динамику между соратниками (взаимовыручка, спор, ссора, спасение от верной гибели или слаженная комбо-атака).`
      : '';

    const encounterGuidance = livingEnemies.length === 0
      ? `ОБСТАНОВКА ДО ЭТОГО ХОДА БЫЛА БЕЗ АКТИВНОГО БОЯ:
- Если действия игроков мирные и обстановка спокойная — развивай социальное взаимодействие, тайну, торговлю, диалог или исследование ("activeEnemies": []).
- ⚠️ НО ЕСЛИ:
  1) Игроки атакуют кого-либо, провоцируют драку или дуэль, нарываются на стражу или бандитов;
  2) Игроки заходят туда, куда вход запрещен (тайные покои, лагерь врага, логово чудовищ, закрытые архивы);
  3) NPC логично проявляют агрессию на дерзость, воровство или действия игроков;
  4) Ситуация предвещает явную битву (засада, нападение нежити, монстр) — НЕ ТЯНИ ВРЕМЯ!
  -> НЕМЕДЛЕННО ИНИЦИИРУЙ БОЙ! Создай противников в "activeEnemies" (с "name", "ac" ~11-16, "hpMax" ~20-50, "hpCurrent", "status": "В бою"), установи "mood": "combat", рассчитай урон по КБ и брось вызов героям!${turnGuidance}${reactionsGuidance}`
      : `ИДЕТ БОЕВОЕ СТОЛКНОВЕНИЕ:
Сравнивай броски атак с КБ врагов. Наноси ответные удары героям (playerUpdates). Если все враги повержены — объяви победу, опиши затишье и переведи отряд в фазу триумфа и сбора трофеев ("mood": "triumph").${turnGuidance}${reactionsGuidance}`;

    return `СЕТТИНГ И ПРЕМБУЛА КАМПАНИИ:
${context.setting}

ЖАНР: ${context.genre || 'фэнтези'} (Используй термины, оружие, стилистику и технологии этого жанра по правилам D&D 5e!)
ДЛИТЕЛЬНОСТЬ КАМПАНИИ: ${context.campaignDuration || 'medium'} (Целевой объем: ${durationRounds}). Текущий раунд: ${context.roundNumber}.

ГЕНЕРАЛЬНАЯ СЮЖЕТНАЯ АРКА КАМПАНИИ (Веди отряд по этой канве с учётом сопротивления и решений):
${context.campaignPlot || 'Генеральная сюжетная линия: исследование, дорожные встречи, нарастание тайны, кульминация.'}

ПРЕДЫДУЩИЕ СОБЫТИЯ (Контекст недавних действий отряда — продолжай эту историю непрерывно!):
${historySnippet}

ХРОНИКА КЛЮЧЕВЫХ ВЕХ ИСТОРИИ (Долгосрочная память мира — сверяйся с ней):
${loreSummary}

АКТИВНЫЕ ЗАДАЧИ И КВЕСТЫ ОТРЯДА:
${activeQuestsSummary}

ВЫПОЛНЕННЫЕ ЗАДАЧИ И РЕШЁННЫЕ ПРОБЛЕМЫ (КАТЕГОРИЧЕСКИ ЗАПРЕЩЕНО ПОВТОРЯТЬ ИХ В ДИЛЕММАХ!):
${completedQuestsSummary}

РЕЕСТР УЖЕ ОБЫСКАННЫХ ОБЪЕКТОВ И ПОМЕЩЕНИЙ (КАТЕГОРИЧЕСКИЙ ЗАПРЕТ ПОВТОРНОГО ЛУТА):
${searchedObjectsSummary}

АРХИВ ВЫБЫВШИХ ПЕРСОНАЖЕЙ И ИСТОРИЯ МИРА (ОНИ ВНЕ ТЕКУЩЕЙ СЦЕНЫ!):
${worldNPCsSummary}

ИНТЕРАКТИВНЫЕ ОБЪЕКТЫ ОКРУЖЕНИЯ И ТРАНСПОРТ (ФИЗИЧЕСКАЯ ДОСТОВЕРНОСТЬ И ЭТАПЫ):
${environmentObjectsSummary}

ПРОСТРАНСТВЕННЫЙ РЕЕСТР И ЛОКАЦИИ МИРА (СВЕРЯЙСЯ С ЗОНАМИ И ОСТАВЛЕННЫМИ ГЕРОЯМИ):
${spatialZonesSummary}

СОСТАВ ОТРЯДА, ЛИЧНОЕ СНАРЯЖЕНИЕ, ХРОНИКА ПРЕДМЕТОВ И КВЕНТЫ (СВЕРЯЙСЯ С НИМИ):
${partyInfo}
(Герои могут использовать указанные выше предметы из рюкзака, А ТАКЖЕ любые логичные предметы текущего окружения сцены: укрытия, мебель, подручные вещи, окружение).

ТЕКУЩИЕ ОППОНЕНТЫ НА ПОЛЕ:
${enemiesSummary}

ПЕРСОНАЖИ В СЦЕНЕ / СПУТНИКИ И СОЮЗНИКИ:
${npcsSummary}

ТЕКУЩАЯ ОБСТАНОВКА (Раунд ${context.roundNumber}):
${context.currentSituation || 'Приключение продолжается.'}
ТЕКУЩАЯ СЛОЖНОСТЬ (СЛ): ${context.currentDC || 12} (${context.currentDCReason || 'Стандартная задача'})
ТРЕБУЕМАЯ ХАРАКТЕРИСТИКА ДЛЯ ЭТОЙ ПРОВЕРКИ: ${context.requiredCheckStat ? context.requiredCheckStat.toUpperCase() : 'ЛЮБАЯ'}

ДЕЙСТВИЯ ИГРОКОВ В ЭТОМ РАУНДЕ (Сравни их броски с СЛ ${context.currentDC || 12} или КБ врагов):
${actionsSummary}

НАПРАВЛЯЮЩАЯ ИНСТРУКЦИЯ К РАУНДУ:
${encounterGuidance}

ИНСТРУКЦИЯ ПО ГЕНЕРАЦИИ:
1. Сверь заявки игроков с КОДЕКСОМ ЗАКОНОВ МИРА D&D: пресекай бред, несоответствие жанру.
2. Обязательно сверяйся с КВЕНТАМИ игроков, ИСТОРИЕЙ ПРЕДМЕТОВ, ЖУРНАЛОМ игры и ВЫПОЛНЕННЫМИ ЗАДАЧАМИ!
3. Принимай креативные словесные задумки (диалоги, уловки, торговлю, осмотр, тактику).
4. Если предметы расходуются, ломаются, теряются или приобретаются — отрази их в "inventoryUpdates".
5. УПРАВЛЯЙ ПЕРСОНАЖАМИ СЦЕНЫ ("sceneNPCs"):
   - Всегда возвращай массив "sceneNPCs" с актуальным состоянием NPC сцены.
   - Если начался бой и NPC дружелюбен/храбр или игроки призвали его на помощь — переведи его в "ally_combatant", опиши его атаку/помощь в "narrative" и обнови "status"!
   - Если NPC слаб или напуган — он прячется ("hiding", "status": "Прячется в укрытии"). Если обижен — держится в стороне ("neutral_observer").
   - Если враги атакуют NPC или он ранен — снижай "hpCurrent" (при 0 "isDead": true).
   - Если герои лечат или защищают NPC — улучшай отношение ("disposition": "friendly")!
   - ⚠️ СОХРАНЯЙ ПЕРСОНАЖЕЙ В СЦЕНЕ: Персонажи, укрывшиеся в кустах, под повозкой или за деревьями, ОСТАЮТСЯ в "sceneNPCs" (combatRole: "hiding")! УДАЛЯТЬ их из массива можно ТОЛЬКО если они окончательно покинули локацию (ушли в другой город/скрылись за горизонтом).
6. В "narrative" пиши ТОЛЬКО художественный текст! КАТЕГОРИЧЕСКИ ЗАПРЕЩЕНО писать в "narrative" слова "📌 Итог ситуации" или "❓ Выбор перед вами".
7. Заполни "currentSituation" и "choiceDilemma" как отдельные строковые поля JSON.
8. В "newMilestones" запиши развернутые отчеты о ключевых событиях и последствиях хода (1-2 предложения).
9. В "activeEnemies" ОБЯЗАТЕЛЬНО включай врагов, когда идет бой, игроки атакуют, нарываются, дуэлируют или заходят в запретную зону/логово. Только при полностью мирной сцене массив "activeEnemies": [].
10. Укажи requiredCheckStat ("str", "dex", "con", "int", "wis" или "cha") для следующей проверки.
11. СВЕРЯЙСЯ С ВЫПОЛНЕННЫМИ ЗАДАЧАМИ: Запрещено снова предлагать в "choiceDilemma" или "currentSituation" проблемы, которые уже решены в блоке «ВЫПОЛНЕННЫЕ ЗАДАЧИ». Управляй целями отряда через массив "questUpdates" (action: "add", "complete", "fail").
12. ПРАВИЛА БЕГСТВА И ПОГОНИ (ЗАКОН 15): Нельзя безнаказанно убежать из боя. При побеге без действия «Отход» враги наносят провоцированную атаку. При провале проверки бегства отряд настигнут, бой продолжается, а враги остаются в "activeEnemies"!
13. ВЫБЫВАНИЕ И СМЕНА ЛОКАЦИЙ (ЗАКОН 8): Если персонаж остался позади (например, купец Бальтазар при угоне повозки) или отряд сменил локацию (прибыл в город Какахинск) — КАТЕГОРИЧЕСКИ ЗАПРЕЩЕНО возвращать его в "sceneNPCs"! Добавь его в "departedNPCs" (reason: "left_behind" или "location_transition"), чтобы он перешёл в историю мира.
14. ЗАПРЕТ ПОВТОРНОГО ОБЫСКА (ЗАКОН 16): Если объект уже обыскан в блоке «РЕЕСТР УЖЕ ОБЫСКАННЫХ ОБЪЕКТОВ» — КАТЕГОРИЧЕСКИ ЗАПРЕЩЕНО давать игрокам повторно лутать его или находить там новые предметы. Опиши, что объект пуст, и не добавляй предметы в "inventoryUpdates"/"droppedLoot". Если найден новый тайник/объект — зарегистрируй его в "searchedObjectUpdates".
Верни чистый JSON.`;
  }

  public formatPhysicalAndEmotionalState(c: CharacterEntity): string {
    const hpRatio = c.hpMax > 0 ? c.hpCurrent / c.hpMax : 1;
    let healthTag = '🟢 Свеж и полон сил (100% HP)';
    if (c.hpCurrent <= 0 || c.lifeState === 'downed' || c.lifeState === 'dead') {
      healthTag = '☠ Без сознания / при смерти (0 HP)';
    } else if (hpRatio <= 0.3) {
      healthTag = `🔴 Окровавлен (Bloodied), на пределе сил, шатается от ран (${c.hpCurrent}/${c.hpMax} HP)`;
    } else if (hpRatio <= 0.6) {
      healthTag = `🟠 Изранен, сбивчивое дыхание, ощущает боль (${c.hpCurrent}/${c.hpMax} HP)`;
    } else if (hpRatio < 1.0) {
      healthTag = `🟡 Бодр, поверхностные ссадины (${c.hpCurrent}/${c.hpMax} HP)`;
    }

    const stats = c.stats || { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 };
    let highestStat: 'str' | 'dex' | 'con' | 'int' | 'wis' | 'cha' = 'str';
    let highestVal = -1;
    for (const [k, v] of Object.entries(stats)) {
      if (typeof v === 'number' && v > highestVal) {
        highestVal = v;
        highestStat = k as any;
      }
    }

    let statTag = `СИЛ ${stats.str}`;
    if (highestStat === 'str') statTag = `Атлетическая мощь и напор (СИЛ ${stats.str})`;
    else if (highestStat === 'dex') statTag = `Молниеносная ловкость и грация (ЛОВ ${stats.dex})`;
    else if (highestStat === 'con') statTag = `Несокрушимая выносливость (ТЕЛ ${stats.con})`;
    else if (highestStat === 'int') statTag = `Острый аналитический ум (ИНТ ${stats.int})`;
    else if (highestStat === 'wis') statTag = `Обострённая интуиция и чутье (МУД ${stats.wis})`;
    else if (highestStat === 'cha') statTag = `Внушительное лидерство и шарм (ХАР ${stats.cha})`;

    let moodTag = 'Решимость и сосредоточенность';
    const clsLower = (c.characterClass || '').toLowerCase();
    if (c.conditions && c.conditions.includes('frightened')) {
      moodTag = 'Подавлен страхом, тревога';
    } else if (hpRatio <= 0.3) {
      moodTag = 'Превозмогание жгучей боли';
    } else if (clsLower.includes('варвар') || clsLower.includes('barbarian')) {
      moodTag = 'Бурлящая ярость и боевой раж';
    } else if (clsLower.includes('плут') || clsLower.includes('rogue')) {
      moodTag = 'Хладнокровная расчётливость';
    } else if (clsLower.includes('маг') || clsLower.includes('волшеб') || clsLower.includes('wizard')) {
      moodTag = 'Концентрация на тайных плетениях магии';
    } else if (clsLower.includes('паладин') || clsLower.includes('жрец') || clsLower.includes('cleric')) {
      moodTag = 'Непоколебимая вера и готовность защищать';
    } else if (clsLower.includes('воин') || clsLower.includes('fighter')) {
      moodTag = 'Боевой азарт и тактическое спокойствие';
    }

    return `[${healthTag} | ${statTag} | Настрой: ${moodTag}]`;
  }

  public formatPartyInfo(characters: CharacterEntity[] = []): string {
    if (!characters || characters.length === 0) return 'Информация о персонажах отсутствует.';
    return characters.map(c => {
      const condList = c.conditions && c.conditions.length > 0 ? c.conditions.join(', ') : 'В норме';
      const hdInfo = `${c.hitDiceCurrent ?? 1}/${c.hitDiceMax ?? 1} (${c.hitDiceType || 'd8'})`;
      const slotsInfo = c.spellSlots
        ? Object.entries(c.spellSlots).map(([lvl, s]) => `${lvl} ур: ${s.current}/${s.max}`).join(', ')
        : 'Нет';

      const stateTag = this.formatPhysicalAndEmotionalState(c);

      // Compact lean inventory representation to conserve context tokens
      const inventoryFormatted = c.inventory && c.inventory.length > 0
        ? c.inventory.map(i => {
            const latestHist = Array.isArray(i.history) && i.history.length > 0
              ? ` [Хроника: ${i.history[i.history.length - 1]}]`
              : '';
            const stats = [
              `тип: ${i.type}`,
              i.quantity && i.quantity > 1 ? `кол-во: ${i.quantity}` : '',
              i.damage ? `урон: ${i.damage}` : '',
              i.ac_bonus ? `КБ +${i.ac_bonus}` : '',
              i.healAmount ? `лечение: ${i.healAmount}` : '',
            ].filter(Boolean).join(', ');
            return `    - "${i.name}" (${stats})${latestHist}`;
          }).join('\n')
        : '    - Пусто (нет снаряжения)';

      const activeWeapon = c.activeWeaponId
        ? c.inventory.find(i => i.id === c.activeWeaponId || i.name.toLowerCase() === c.activeWeaponId?.toLowerCase())?.name || 'В руках'
        : 'Базовое оружие';

      return `
- ID: "${c.id}"
  Имя: ${c.name} (${c.race} ${c.characterClass}, уровень ${c.level})
  Статус: ${c.lifeState === 'dead' ? '☠ ПОГИБ' : c.lifeState === 'downed' ? '⚠️ ПРИ СМЕРТИ (0 HP)' : 'В строю'}
  HP: ${c.hpCurrent}/${c.hpMax}, КБ: ${c.ac}
  Физическое и душевное состояние (ОБЯЗАТЕЛЬНО ОТРАЖАТЬ В ПОВЕСТВОВАНИИ): ${stateTag}
  Кости хитов: ${hdInfo}
  Ячейки заклинаний: ${slotsInfo}
  Состояния (Conditions): ${condList}
  Характеристики: СИЛ ${c.stats.str}, ЛОВ ${c.stats.dex}, ТЕЛ ${c.stats.con}, ИНТ ${c.stats.int}, МУД ${c.stats.wis}, ХАР ${c.stats.cha}
  Способности: ${c.abilities && c.abilities.length > 0 ? c.abilities.map(a => a.name).join(', ') : 'Базовые приёмы'}
  Активное оружие: ${activeWeapon}
  Личный инвентарь:
${inventoryFormatted}
  Квента / Личная история: "${c.bio || 'Опытный искатель приключений'}"
`;
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
        ? `⚔️ АТАКА ПО ЦЕЛИ: ${a.targetEnemyName || a.targetEnemyId || 'Враг'}`
        : a.actionType === 'save'
        ? '🛡️ СПАСБРОСОК'
        : a.actionType === 'check'
        ? '🎲 ПРОВЕРКА НАВЫКА'
        : '💡 ДЕЙСТВИЕ / ИМПРОВИЗАЦИЯ';

      const advLabel = a.advantage ? ' [С ПРЕИМУЩЕСТВОМ 2d20]' : a.disadvantage ? ' [С ПОМЕХОЙ 2d20]' : '';
      const spellLabel = a.spellLevelUsed ? ` [Потрачена ячейка ${a.spellLevelUsed}-го круга]` : '';

      const diceInfo = a.diceRolls && a.diceRolls.length > 0
        ? a.diceRolls.map((r: any) => `[Кость: ${r.diceType}, Характеристика: ${r.statKey ? r.statKey.toUpperCase() : 'Общая'}, Выпало: ${r.rolls.join('+')} (${r.modifier >= 0 ? '+' : ''}${r.modifier}) = Итого: ${r.total}${r.isCriticalSuccess ? ' ★ КРИТИЧЕСКИЙ УСПЕХ (20)!' : ''}${r.isCriticalFail ? ' ☠ КРИТИЧЕСКИЙ ПРОВАЛ (1)!' : ''}, Назначение: ${r.purpose}]`).join('; ')
        : 'Без броска кубика';

      // Check if player action mentions any item from their inventory
      const char = characters?.find(c => c.id === a.characterId || c.name.toLowerCase() === (a.characterName || '').toLowerCase());
      const mentionedItems: string[] = [];
      if (char && Array.isArray(char.inventory)) {
        for (const item of char.inventory) {
          if (item && item.name && a.actionText.toLowerCase().includes(item.name.toLowerCase().trim())) {
            mentionedItems.push(`«${item.name}»`);
          }
        }
      }

      let itemTrackingDirective = '';
      if (mentionedItems.length > 0) {
        itemTrackingDirective = `\n  🔍 [ВНИМАНИЕ — ИГРОК ИСПОЛЬЗУЕТ ПРЕДМЕТ]: В тексте заявки упомянут(ы) предмет(ы) из рюкзака: ${mentionedItems.join(', ')}.
     Разреши судьбу предмета:
     - Если предмет выпит, скормлен союзнику/путнику, применён, сломан или утерян/украден — ОБЯЗАТЕЛЬНО добавь его в "inventoryUpdates" с action="remove" и укажи причину "reason" (лаконичное предложение). Если это было активное оружие, его бонусы пропадут!
     - Если получен новый предмет — добавь его в "inventoryUpdates" с action="add" и стартовой историей "history".`;
      }

      // Check if player action attempts to PICK UP a dropped item or ground loot
      const pickupRegex = /(подня(л|ть|ли|ла)|подобра(л|ть|ли|ла)|вытащи(л|ть|ли|ла)|выдерну(л|ть|ли|ла)|схвати(л|ть|ли|ла)|подхвати(л|ть|ли|ла)|наш(ел|ла|ли)|забра(л|ть|ли|ла)|верну(л|ть|ли|ла)|достал(а)?)/i;
      const actLower = a.actionText.toLowerCase();
      const isTryingToPickup = pickupRegex.test(actLower);
      const itemsToPickup: string[] = [];

      if (isTryingToPickup) {
        for (const loot of (availableLoot || [])) {
          if (loot && loot.name) {
            const lootLower = loot.name.toLowerCase().trim();
            if (actLower.includes(lootLower) || (lootLower.length > 4 && actLower.includes(lootLower.slice(0, -2))) || (loot.type === 'weapon' && /(оружие|секир|топор|меч|клинок)/i.test(actLower))) {
              itemsToPickup.push(`«${loot.name}» (лежит на земле/в грязи)`);
            }
          }
        }
        for (const m of (loreJournal || [])) {
          if (m && m.milestone && (m.milestone.includes('теряет') || m.milestone.includes('выскользну') || m.milestone.includes('утрачено'))) {
            const match = m.milestone.match(/«([^»]+)»/);
            if (match && match[1]) {
              const lostName = match[1].trim();
              if (actLower.includes(lostName.toLowerCase()) && !itemsToPickup.some(p => p.includes(lostName))) {
                itemsToPickup.push(`«${lostName}» (ранее выронено)`);
              }
            }
          }
        }
      }

      let pickupDirective = '';
      if (itemsToPickup.length > 0) {
        pickupDirective = `\n  🔍 [ВНИМАНИЕ — ИГРОК ПОДНИМАЕТ ПРЕДМЕТ]: В тексте заявки указана попытка поднять/подобрать: ${itemsToPickup.join(', ')}.
     - Если бросок кубика УСПЕШЕН (>= СЛ) — ОБЯЗАТЕЛЬНО добавь этот предмет обратно в "inventoryUpdates" с action="add" и понятной причиной "reason" (например, "Поднято из грязи / с земли")!`;
      }

      // Check if character is prone and attempting to stand up
      const standUpRegex = /(вста(ю|ть|л|ла|ли|ем|йте)|поднима(юсь|ется|ться|лась|лся|лись)|на ноги|отряхива(юсь|ется|ясь|лась|лся)|подня(лся|лась|лись)|выпрям(ился|илась|иться))/i;
      let standUpDirective = '';
      if (char && char.conditions?.includes('prone') && standUpRegex.test(actLower)) {
        standUpDirective = `\n  🏃 [ВНИМАНИЕ — ГЕРОЙ ВСТАЕТ НА НОГИ]: ${char.name} находится в положении лёжа ('prone') и встает на ноги с земли. ОБЯЗАТЕЛЬНО сними состояние 'prone' через "conditionUpdates" с action="remove" и condition="prone"!`;
      }

      // Check for mechanical arbiter directive for this action
      const arbiterDirective = mechanicalDirectives && mechanicalDirectives[a.id]
        ? `\n  ${mechanicalDirectives[a.id]}`
        : '';

      // Detect combat trigger, duel, trespassing or aggressive provocation
      const hasNegatedAggression = /(не\s+(атаковать|бить|стрелять|рубить|убивать|нападать)|без\s+(боя|нападения|драки)|прекратить\s+(атаковать|бой)|мирн(ый|о)|умиротвор|успоко)/i.test(a.actionText);
      const aggressiveRegex = /(атак(а|ую|овать)|удар(ить|яю)?|рубл(ю|ить)|выстрел(ить|ю)?|стреля(ю|ть)|дуэл(ь|и)|напад(аю|ать|ение)|сража(ться|юсь)|вступаю в бой|выхватываю (меч|клинок|оружие)|достаю (меч|клинок|топор|лук)|врезать|приконч(ить|у)|уб(ить|ью)|вламыва(юсь|ться)|взламыва(ю|ть)|захожу в запретн|прокрадыва(юсь|ться) в покои|нарыва(юсь|ется)|провоцир(ую|овать))/i;
      const isAggressiveAction = !hasNegatedAggression && (a.actionType === 'attack' || aggressiveRegex.test(a.actionText));
      let combatTriggerDirective = '';
      if (isAggressiveAction && !arbiterDirective) {
        combatTriggerDirective = `\n  ⚔️ [ТРИГГЕР БОЕВОЙ АГРЕССИИ / ДУЭЛИ / ВТОРЖЕНИЯ]: Игрок инициировал явную атаку, дуэль, нарывается на драку или вторгается в охраняемую/запретную зону! Если бой еще не начался, ОБЯЗАТЕЛЬНО СОЗДАЙ противника(ов) в массиве "activeEnemies" (укажи реалистичные name, КБ ~12-16, HP ~15-40, status: "В бою"), установи "mood": "combat", опиши начало битвы и рассчитай попадание/урон по КБ!`;
      }

      return `* Игрок "${a.characterName}" (ID персонажа: "${a.characterId}") — ${typeLabel}${advLabel}${spellLabel}: "${a.actionText}"\n  Бросок: ${diceInfo}${arbiterDirective}${itemTrackingDirective}${pickupDirective}${standUpDirective}${combatTriggerDirective}`;
    }).join('\n\n');
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
