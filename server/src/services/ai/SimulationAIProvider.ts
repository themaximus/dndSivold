import { IAIProvider } from './IAIProvider';
import { AIDMContext, AIDMPrologueContext, AIDMResponse, PlayerHpUpdate } from '../../domain/types';

interface ActionAnalysis {
  characterId: string;
  characterName: string;
  characterClass: string;
  actionText: string;
  rollTotal: number;
  isCritSuccess: boolean;
  isCritFail: boolean;
  isSuccess: boolean;
  isSevereFail: boolean;
  intent: 'melee' | 'ranged' | 'magic' | 'heal' | 'stealth' | 'defense' | 'athletics' | 'investigation' | 'dialogue' | 'flee' | 'general';
}

export class SimulationAIProvider implements IAIProvider {
  public readonly name = 'Offline Procedural Narrative Engine';

  public async generateRound(context: AIDMContext): Promise<AIDMResponse> {
    const { characters, actions, roundNumber, currentDC = 12, setting = '' } = context;

    // 1. Analyze every player action in the round
    const analyzedActions: ActionAnalysis[] = actions.map(action => {
      const char = characters.find(c => c.id === action.characterId);
      const roll = action.diceRolls && action.diceRolls.length > 0 ? action.diceRolls[0] : null;

      const rollTotal = typeof roll?.total === 'number' ? roll.total : 12;
      const isCritSuccess = !!roll?.isCriticalSuccess || rollTotal >= 20;
      const isCritFail = !!roll?.isCriticalFail || rollTotal <= 1;
      const isSuccess = isCritSuccess || rollTotal >= currentDC;
      const isSevereFail = isCritFail || rollTotal <= Math.max(1, currentDC - 4);

      const textLower = action.actionText.toLowerCase();
      let intent: ActionAnalysis['intent'] = 'general';

      if (/зел|флакон|исцел|леч|перевяз|помоч|поддерж|спасти|вдохнов|благослов/.test(textLower)) {
        intent = 'heal';
      } else if (/маги|заклинани|сотворя|касту|плам|огонь|файер|молни|лед|мороз|искра|луч|чар|заговор|мистик|кар|смайт|свет|взрыв|свиток/.test(textLower)) {
        intent = 'magic';
      } else if (/лук|арбалет|выстрел|стреля|тетив|прицел|спустит|болт/.test(textLower)) {
        intent = 'ranged';
      } else if (/меч|клинок|топор|секир|молот|булав|удар|атак|руб|кол|выпад|рассеч|сокруш|щитом|кинжал|рапир|палиц|вруба|бью/.test(textLower)) {
        intent = 'melee';
      } else if (/скрыт|тень|подкрас|со спин|обойти|спрята|за спин|крадусь/.test(textLower)) {
        intent = 'stealth';
      } else if (/блок|парир|уклон|закрыт|отскоч|защит|прикры/.test(textLower)) {
        intent = 'defense';
      } else if (/беж|убега|удира|спасаться бегств|отступ|побег|уйти из боя/.test(textLower)) {
        intent = 'flee';
      } else if (/прыж|толкн|сбит|слома|выбит|пнут|рывок|бег/.test(textLower)) {
        intent = 'athletics';
      } else if (/осмотр|изуч|найт|замок|ловушк|взлом|разгляд|поиск|огляд|следы/.test(textLower)) {
        intent = 'investigation';
      } else if (/крич|закрич|запуг|сказа|приказ|переговор|насмешк|призыв|спроси|говор|бесед|диалог|купи|торг|обмен/.test(textLower)) {
        intent = 'dialogue';
      }

      return {
        characterId: action.characterId,
        characterName: action.characterName,
        characterClass: char?.characterClass || 'Искатель приключений',
        actionText: action.actionText.trim(),
        rollTotal,
        isCritSuccess,
        isCritFail,
        isSuccess,
        isSevereFail,
        intent,
      };
    });

    const playerUpdates: PlayerHpUpdate[] = [];
    const narrativeParagraphs: string[] = [];

    const livingEnemiesInContext = (context.activeEnemies || []).filter(e => !e.isDead && e.hpCurrent > 0);
    const isCombat = livingEnemiesInContext.length > 0;

    // 2. Setting theme & Atmosphere opener
    const isDarkDungeon = /подземел|катакомб|склеп|гробниц|пещер|шахт/i.test(setting);
    const isForest = /лес|чащ|болот|пущ|дерев/i.test(setting);
    const isRuins = /руин|замок|крепост|храм|башн/i.test(setting);

    let atmosphereIntro = '';
    if (!isCombat) {
      if (isDarkDungeon) {
        atmosphereIntro = 'Отряд осторожно продвигается по древним каменным галереям. Факелы отбрасывают тёплые отсветы на замшелые плиты, вокруг царит гулкая тишина и покой.';
      } else if (isForest) {
        atmosphereIntro = 'Лесной тракт манит прохладой и шелестом крон. Впереди у развилки виднеется походный костёр и силуэты встречных путников.';
      } else if (isRuins) {
        atmosphereIntro = 'Среди полуразрушенных арок и колонн гуляет лёгкий ветерок. Опасности не видно — отряд может свободно осмотреться и пообщаться.';
      } else {
        atmosphereIntro = 'Дорога вьётся среди холмов. Обстановка спокойная и располагающая к неспешной беседе, поиску зацепок и привалу.';
      }
    } else if (roundNumber === 1) {
      if (isDarkDungeon) {
        atmosphereIntro = 'Сырой воздух подземелья пахнет вековой пылью, озоном и близкой опасностью. Тени от факелов тревожно вздрагивают на каменных плитах, когда герои без колебаний вступают в бой.';
      } else if (isForest) {
        atmosphereIntro = 'Под сенью древних крон воцаряется зловещая тишина, нарушаемая лишь хрустом веток и свирепым рычанием из туманной чащи. Отряд мгновенно занимает боевые позиции.';
      } else if (isRuins) {
        atmosphereIntro = 'Холодный сквозняк гонит серый пепел меж разбитых статуй и колонн. Враги ощетинились оружием, но отряд непоколебимо идёт на сближение.';
      } else {
        atmosphereIntro = 'Сталь звенит о сталь, и пространство вокруг сотрясается от первых яростных столкновений. Время для раздумий вышло — начинается решительная схватка.';
      }
    } else {
      const livingEnemies = (context.activeEnemies || []).filter(e => !e.isDead && e.hpCurrent > 0);
      const enemyNames = livingEnemies.map(e => e.name);
      const enemyLabel = enemyNames.length > 0 ? enemyNames.join(', ') : 'противники';

      if (isDarkDungeon) {
        atmosphereIntro = `Эхо битвы гулко разносится под сводами каменного зала. В воздухе витает едкий дым, а ${enemyLabel} перегруппировываются для нового удара.`;
      } else if (isForest) {
        atmosphereIntro = `Сквозь лесные кроны пробиваются лучи света, освещая место схватки. ${enemyLabel} оценивают манёвры отряда и держат оружие наготове.`;
      } else {
        atmosphereIntro = `Схватка переходит в критическую фазу: ${enemyLabel} маневрируют, стремясь занять выгодную позицию.`;
      }
    }

    // 3. Compose the syncretic party onslaught / actions (Paragraph 1 & 2)
    const partyProseLines: string[] = [];

    analyzedActions.forEach((item, index) => {
      let connector = '';
      if (index === 0) {
        connector = analyzedActions.length === 1 ? 'В эпицентре происходящего ' : 'Во главе отряда ';
      } else if (index === 1) {
        connector = 'Одновременно с этим ';
      } else if (index === 2) {
        connector = 'Подхватив общий темп, ';
      } else if (index === 3) {
        connector = 'Тем временем, зорко оценивая обстановку, ';
      } else {
        connector = 'Не теряя ни секунды, ';
      }

      let outcomePhrase = '';
      if (item.isCritSuccess) {
        switch (item.intent) {
          case 'dialogue':
            outcomePhrase = `находит безупречные, проникновенные слова — собеседник глубоко тронут искренностью героя, раскрывает сокровенную тайну и охотно предлагает свою помощь!`;
            break;
          case 'investigation':
            outcomePhrase = `проявляет феноменальную наблюдательность: мгновенно подмечает скрытый знак на камне и находит потайной схрон с ценными вещами!`;
            break;
          case 'heal':
            outcomePhrase = `направляет исцеляющее тепло точно в очаг боли — раны затягиваются на глазах, возвращая силы и бодрость духа!`;
            break;
          case 'melee':
            outcomePhrase = `совершает сокрушительный, эталонный выпад — оружие с глухим хрустом рассекает вражескую броню, повергая врага наземь!`;
            break;
          case 'ranged':
            outcomePhrase = `пускает оперённую стрелу со сверхъестественной точностью: свистящий снаряд насквозь пробивает преграду!`;
            break;
          case 'magic':
            outcomePhrase = `высвобождает сокрушительный вихрь чародейской энергии — ослепительная вспышка сотрясает всё вокруг!`;
            break;
          case 'stealth':
            outcomePhrase = `буквально растворяется в клубящихся тенях и бесшумно обходит преграду, оставаясь абсолютно незамеченным!`;
            break;
          case 'defense':
            outcomePhrase = `встречает угрозу монолитным блоком, ошеломляя противника встречным контрударом!`;
            break;
          case 'athletics':
            outcomePhrase = `совершает безупречный атлетический рывок, легко расчищая путь от завала!`;
            break;
          case 'flee':
            outcomePhrase = `совершает молниеносный маневр выхода из боя, разрывая дистанцию с врагами без малейшего риска!`;
            break;
          default:
            outcomePhrase = `демонстрирует высшее мастерство: всё задуманное исполняется с безукоризненной лёгкостью!`;
        }
      } else if (item.isSuccess) {
        switch (item.intent) {
          case 'dialogue':
            outcomePhrase = `умело ведёт беседу, располагая к себе встреченного персонажа и выясняя ценные дорожные подробности.`;
            break;
          case 'investigation':
            outcomePhrase = `внимательно осматривает окружение, подмечая свежие следы и находя важные зацепки.`;
            break;
          case 'heal':
            outcomePhrase = `своевременно оказывает помощь, облегчая боль и восстанавливая душевное равновесие.`;
            break;
          case 'melee':
            outcomePhrase = `уверенным ударом теснит противника назад, нанося ощутимый урон.`;
            break;
          case 'ranged':
            outcomePhrase = `находит открытую брешь — меткий выстрел точно поражает намеченную цель.`;
            break;
          case 'magic':
            outcomePhrase = `сплетает заклятие, направляя потоки стихийной мощи точно по замыслу.`;
            break;
          case 'stealth':
            outcomePhrase = `ловко выскальзывает из поля зрения, занимая скрытную позицию.`;
            break;
          case 'defense':
            outcomePhrase = `хладнокровно парирует выпад, прикрывая соратников.`;
            break;
          case 'athletics':
            outcomePhrase = `силовым движением устраняет преграду, прокладывая дорогу вперёд.`;
            break;
          case 'flee':
            outcomePhrase = `ловко разрывает дистанцию и отступает на безопасное расстояние от противников.`;
            break;
          default:
            outcomePhrase = `действует расчётливо и уверенно, добиваясь желаемого результата.`;
        }
      } else if (item.isCritFail) {
        if (item.intent === 'flee') {
          outcomePhrase = `в панике спотыкается при попытке бежать — враг наносит жестокий удар в беззащитную спину!`;
        } else {
          outcomePhrase = `оступается в самый неподходящий момент: движение выходит неуклюжим, привлекая ненужное внимание и ставя отряд в неловкое положение!`;
        }
      } else {
        switch (item.intent) {
          case 'dialogue':
            outcomePhrase = `наталкивается на холодное непонимание или подозрительность собеседника.`;
            break;
          case 'investigation':
            outcomePhrase = `не находит ничего примечательного среди камней и дорожной пыли.`;
            break;
          case 'flee':
            outcomePhrase = `пытается спастись бегством, но враги мгновенно перекрывают путь к отступлению, загоняя в угол!`;
            break;
          default:
            outcomePhrase = `не успевает завершить задуманное в полной мере, теряя драгоценную инициативу.`;
        }
      }

      partyProseLines.push(`${connector}${item.characterName} ${outcomePhrase}`);
    });

    narrativeParagraphs.push(atmosphereIntro);

    if (context.characterReactions && context.characterReactions.length > 0) {
      const activeReactions = context.characterReactions.filter(r => r.status === 'completed');
      activeReactions.forEach(r => {
        const rollVal = r.reactionRoll?.total || 12;
        const isSuccess = rollVal >= (context.currentDC || 12);
        const toneDesc = r.responseType === 'negative'
          ? 'воспротивился действию соратника и отстранился'
          : r.responseType === 'counter'
          ? 'ловко перехватил инициативу и совершил встречный маневр'
          : 'без колебаний поддержал задумку и прикрыл соратника';

        partyProseLines.push(
          `В этот же момент ${r.targetCharacterName} ${toneDesc}: «${r.reactionText}» (реакция d20: ${rollVal} — ${isSuccess ? 'успешно' : 'с трудом'}).`
        );
      });
    }

    if (partyProseLines.length > 0) {
      narrativeParagraphs.push(partyProseLines.join(' '));
    }

    // 4. Enemy counterattack or peaceful NPC interaction
    const critFails = analyzedActions.filter(a => a.isCritFail);
    const failedActions = analyzedActions.filter(a => !a.isSuccess);
    const critSuccesses = analyzedActions.filter(a => a.isCritSuccess);
    const fleeingActions = analyzedActions.filter(a => a.intent === 'flee');

    // D&D 5e: Opportunity attack on flee without Disengage
    if (isCombat && fleeingActions.length > 0) {
      for (const fleeAction of fleeingActions) {
        const fleeChar = characters.find(c => c.id === fleeAction.characterId);
        if (!fleeChar) continue;
        const textLower = fleeAction.actionText.toLowerCase();
        const hasDisengage = /отход|disengage|осторож.*отступ/i.test(textLower);

        if (!hasDisengage) {
          const oppDmg = fleeAction.isCritFail ? 7 : 5;
          playerUpdates.push({
            characterId: fleeChar.id,
            characterName: fleeChar.name,
            hpDelta: -oppDmg,
            note: 'Провоцированная атака (Opportunity Attack) при бегстве без действия «Отход»',
          });
          narrativeParagraphs.push(`⚠️ Провоцированная атака! ${fleeChar.name} пытается бежать, не разорвав дистанцию действием «Отход». Ближайший враг наносит удар в спину на ${oppDmg} урона!`);
        }

        if (!fleeAction.isSuccess) {
          narrativeParagraphs.push(`Попытка побега сорвана: враги смыкают кольцо вокруг ${fleeChar.name}, отрезая путь к отступлению! Бой продолжается.`);
        }
      }
    }

    if (isCombat && failedActions.length > 0) {
      // Don't duplicate damage if targetChar already took opportunity attack damage
      const targetChar = characters.find(c => c.id === failedActions[0].characterId && !playerUpdates.some(u => u.characterId === c.id)) ||
        characters.find(c => c.id === failedActions[0].characterId) || characters[0];
      if (targetChar && !playerUpdates.some(u => u.characterId === targetChar.id)) {
        const dmg = critFails.length > 0 ? 6 : 4;
        playerUpdates.push({
          characterId: targetChar.id,
          characterName: targetChar.name,
          hpDelta: -dmg,
          note: 'Ответный выпад противника',
        });
        narrativeParagraphs.push(`Враги пользуются заминкой и наносят ответный удар: ${targetChar.name} получает ${dmg} урона!`);
      }
    } else if (!isCombat) {
      narrativeParagraphs.push('Встреченные персонажи внимательно выслушивают героев, а обстановка вокруг остаётся мирной и располагающей к продолжению диалога.');
    }

    // 5. Dropped Loot if crit success
    const droppedLoot: AIDMResponse['droppedLoot'] = [];
    if (critSuccesses.length > 0) {
      droppedLoot.push({
        name: 'Флакон целебного эликсира',
        type: 'potion',
        description: 'Стеклянный флакон с рубиновым зельем. Восстанавливает 2d4+2 HP.',
        healAmount: 8,
      });
    }

    // 6. Dynamic Situation & Next Round DC
    let nextRoundDC = 12;
    let nextRoundDCReason = 'Продолжение пути';
    let currentSituation = '';
    let choiceDilemma = '';

    // Process active enemies HP changes
    let activeEnemies = context.activeEnemies && context.activeEnemies.length > 0
      ? context.activeEnemies.map(e => ({ ...e }))
      : [];

    const anyAttackAction = analyzedActions.find(a => ['melee', 'ranged', 'magic'].includes(a.intent));
    if (activeEnemies.length === 0 && anyAttackAction) {
      activeEnemies.push({
        id: crypto.randomUUID(),
        name: 'Враждебный противник',
        type: 'гуманоид',
        hpCurrent: 25,
        hpMax: 25,
        ac: 13,
        status: 'Обнажил оружие и вступил в бой с отрядом',
        isDead: false,
      });
    }

    const successfulAttacks = analyzedActions.filter(a => a.isSuccess && ['melee', 'ranged', 'magic'].includes(a.intent));
    if (activeEnemies.length > 0 && successfulAttacks.length > 0) {
      const targetEnemy = activeEnemies.find(e => !e.isDead && e.hpCurrent > 0);
      if (targetEnemy) {
        const totalDmg = successfulAttacks.reduce((acc, a) => acc + (a.isCritSuccess ? 10 : 5), 0);
        targetEnemy.hpCurrent = Math.max(0, targetEnemy.hpCurrent - totalDmg);
        if (targetEnemy.hpCurrent === 0) {
          targetEnemy.isDead = true;
          targetEnemy.status = 'Пал в бою под натиском отряда';
        } else {
          targetEnemy.status = `Ранен (получил ${totalDmg} урона), держит оборону`;
        }
      }
    }

    const livingCount = activeEnemies.filter(e => !e.isDead && e.hpCurrent > 0).length;

    if (livingCount === 0) {
      if (failedActions.length > 0) {
        nextRoundDC = Math.min(15, currentDC + 1);
        nextRoundDCReason = 'Преодоление недоверия или поиск потерянного следа';
        currentSituation = 'Собеседник осторожничает, а следы на дороге теряются в сумерках.';
        choiceDilemma = 'Попытаться убедить собеседника добрым словом, предложить ценный подарок или отправиться на поиски обходной тропы. Что предпринимает отряд?';
      } else if (critSuccesses.length > 0) {
        nextRoundDC = Math.max(10, currentDC - 1);
        nextRoundDCReason = 'Удачное развитие знакомства или находка тайника';
        currentSituation = 'Встреченный персонаж проникся полным доверием к отряду и готов открыть свои главные тайны.';
        choiceDilemma = 'Расспросить NPC о древнем сокровище, предложить совместное странствие или выменять редкие артефакты. Каково решение героев?';
      } else {
        nextRoundDC = 12;
        nextRoundDCReason = 'Оценка дорожной обстановки и выбор направления';
        currentSituation = 'На развилке дорог воцарилось спокойствие. Персонажи готовы к продолжению беседы или выдвижению в путь.';
        choiceDilemma = 'Осмотреть товары встречного торговца, свериться с картой дорог или двинуться дальше к цели. Как поступает каждый путник?';
      }
    } else if (failedActions.length > 0) {
      nextRoundDC = Math.min(16, currentDC + 1);
      nextRoundDCReason = 'Враги перехватывают инициативу и усиливают натиск';
      currentSituation = 'Противники сомкнули кольцо вокруг раненых героев, тесня отряд к завалу. В воздухе свистят стрелы. Что предпринимает отряд?';
      choiceDilemma = 'Рискнуть пробиться через строй неприятеля или занять круговую оборону у баррикады. Что делает ваш герой?';
    } else if (critSuccesses.length > 0) {
      nextRoundDC = Math.max(10, currentDC - 1);
      nextRoundDCReason = 'Противники дезориентированы и бросаются в бегство';
      currentSituation = 'Остатки вражеского строя в панике пятятся вглубь галереи, бросая оружие. Впереди открывается проход дальше.';
      choiceDilemma = 'Добить отступающих врагов, осмотреть брошенные трофеи или не теряя времени устремиться в открывшийся проход. Что решает отряд?';
    } else {
      nextRoundDC = 13;
      nextRoundDCReason = 'Тактическое маневрирование в изменившейся обстановке';
      const livingEnemies = (context.activeEnemies || []).filter(e => !e.isDead && e.hpCurrent > 0);
      const enemyNames = livingEnemies.map(e => e.name);
      const enemyLabel = enemyNames.length > 0 ? enemyNames.join(', ') : 'противники';
      const turnActor = context.turnPlayerName || (analyzedActions[0]?.characterName) || 'герой';

      currentSituation = `Инициатива переходит к следующему бойцу. ${enemyLabel} перегруппировываются после действий ${turnActor}.`;
      choiceDilemma = `Навязать противнику ближний бой, обстрелять из укрытия или зайти во фланг. Как действует ${turnActor}?`;
    }

    // 8. Lore Milestones
    const newMilestones: string[] = [];
    if (roundNumber === 1) {
      newMilestones.push(`Отряд начал путь в локации "${setting || 'Неизведанные земли'}".`);
    } else if (critSuccesses.length > 0) {
      newMilestones.push(`Раунд ${roundNumber}: Герои добились выдающегося успеха.`);
    }

    // 9. Update scene NPCs with health changes and healing support
    let healedNPCName: string | null = null;
    const updatedSceneNPCs = (context.sceneNPCs || []).map(npc => {
      if (npc.isDead) return npc;
      let hp = npc.hpCurrent;
      let disp = npc.disposition;
      let role = npc.combatRole;
      let status = npc.status;

      const npcNameLower = npc.name.toLowerCase();
      const npcRoleLower = (npc.role || '').toLowerCase();
      const npcWords = `${npcNameLower} ${npcRoleLower}`.replace(/[.,/#!$%^&*;:{}=\-_`~()]/g, ' ').split(/\s+/).filter(w => w.length >= 3);
      const npcStems = npcWords.map(w => w.replace(/(а|я|о|е|у|ю|ы|и|е|ом|ем|ам|ям|ами|ями|ах|ях|ого|его|ому|ему|ым|им|ой|ей|ую|юю|ое|ее|ые|ие|ов|ев)$/g, ''));

      const targetedAction = actions.find(a => {
        const text = a.actionText.toLowerCase();
        const matchesStem = npcStems.some(s => s.length >= 3 && text.includes(s));
        return (
          text.includes(npcNameLower) ||
          (npcRoleLower.length > 3 && text.includes(npcRoleLower)) ||
          matchesStem ||
          ((context.sceneNPCs || []).length === 1 && (text.includes('npc') || text.includes('нпс') || text.includes('союзник') || text.includes('ранен')))
        );
      });

      if (targetedAction) {
        const actText = targetedAction.actionText.toLowerCase();
        const isHealing = /зелье|исцел|леч|попо(ил|ить)|перевяз|помощ|спаст|отдал.*зелье/i.test(actText);
        const isAttacking = /атак|удар|выстрел|рассек|убить|метнул.*в/i.test(actText) && !isHealing;

        if (isHealing) {
          const healAmount = 8;
          hp = Math.min(npc.hpMax, hp + healAmount);
          disp = 'friendly';
          healedNPCName = npc.name;
          status = `Раны затянулись благодаря помощи ${targetedAction.characterName} (+${healAmount} HP). Готов содействовать.`;
        } else if (isAttacking) {
          hp = Math.max(0, hp - 6);
          disp = 'hostile';
          status = `Атакован героем ${targetedAction.characterName}!`;
        }
      }

      if (hp <= 0) {
        return {
          ...npc,
          hpCurrent: 0,
          isDead: true,
          combatRole: 'neutral_observer' as const,
          status: 'Пал в бою / Мёртв',
        };
      }

      if (isCombat) {
        if (disp === 'friendly' && (role === 'ally_combatant' || npc.role.includes('Страж') || npc.role.includes('Следопыт') || npc.role.includes('Воин') || npc.role.includes('Наёмник') || targetedAction?.actionText.toLowerCase().includes('бой') || targetedAction?.actionText.toLowerCase().includes('помощ'))) {
          return {
            ...npc,
            hpCurrent: hp,
            disposition: disp,
            combatRole: 'ally_combatant' as const,
            status: status || 'Сражается плечом к плечу с отрядом, прикрывая фланг',
          };
        } else if (disp === 'friendly') {
          return {
            ...npc,
            hpCurrent: hp,
            disposition: disp,
            combatRole: 'hiding' as const,
            status: status || 'Прячется в укрытии, восстанавливая силы',
          };
        } else if (disp === 'offended' || disp === 'hostile') {
          return {
            ...npc,
            hpCurrent: hp,
            disposition: disp,
            combatRole: 'neutral_observer' as const,
            status: status || 'Настороженно наблюдает за схваткой со стороны, не вмешиваясь',
          };
        } else {
          return {
            ...npc,
            hpCurrent: hp,
            disposition: disp,
            combatRole: 'hiding' as const,
            status: status || 'Прячется в безопасном месте',
          };
        }
      }
      return {
        ...npc,
        hpCurrent: hp,
        disposition: disp,
        combatRole: 'neutral_observer' as const,
        status: status || npc.status || 'Присутствует в сцене',
      };
    });

    if (healedNPCName) {
      narrativeParagraphs.push(`Раненый союзник (${healedNPCName}) с глубокой благодарностью принимает целебную помощь — раны затягиваются, и дыхание выравнивается.`);
    }

    const allyNPC = updatedSceneNPCs.find(n => n.combatRole === 'ally_combatant' && !n.isDead);
    if (isCombat && allyNPC) {
      narrativeParagraphs.push(`Союзник отряда, ${allyNPC.name}, решительно вступает в схватку и метким выпадом отвлекает внимание противников на себя!`);
    }

    const roundQuestUpdates: Array<{
      title: string;
      description?: string;
      category?: 'main' | 'side' | 'task' | 'repair' | 'investigation' | 'social';
      action: 'add' | 'complete' | 'fail';
      resolutionNote?: string;
    }> = [];

    if (context.activeQuests && context.activeQuests.length > 0) {
      for (const q of context.activeQuests) {
        if (isCombat && livingCount === 0 && /(?:бой|сражен|враг|разбойник|засад|отразить)/i.test(q.title)) {
          roundQuestUpdates.push({
            title: q.title,
            action: 'complete',
            resolutionNote: 'Противники повержены, угроза успешно устранена отрядом.',
          });
        } else {
          const qTitleLower = q.title.toLowerCase();
          const matchingSuccess = analyzedActions.find(a =>
            a.isSuccess && (
              (a.intent === 'heal' && /(?:леч|исцел|помощ|ранен|гонц)/i.test(qTitleLower)) ||
              (a.intent === 'athletics' && /(?:почин|ремонт|повозк|колес|ось)/i.test(qTitleLower)) ||
              (a.intent === 'dialogue' && /(?:договор|переговор|страж|мост|купц)/i.test(qTitleLower))
            )
          );
          if (matchingSuccess) {
            roundQuestUpdates.push({
              title: q.title,
              action: 'complete',
              resolutionNote: `Задача успешно решена действиями героя «${matchingSuccess.characterName}».`,
            });
          }
        }
      }
    }

    return {
      narrative: narrativeParagraphs.join('\n\n'),
      playerUpdates,
      currentSituation,
      choiceDilemma,
      enemiesStatus: livingCount === 0 ? 'Врагов нет. Мирная обстановка.' : `В бою: ${livingCount} противников`,
      activeEnemies: activeEnemies.length > 0 ? activeEnemies : [],
      sceneNPCs: updatedSceneNPCs,
      mood: isCombat ? (playerUpdates.length > 0 ? 'combat' : livingCount === 0 ? 'triumph' : 'tension') : 'social',
      nextRoundDC,
      nextRoundDCReason,
      droppedLoot: droppedLoot.length > 0 ? droppedLoot : undefined,
      questUpdates: roundQuestUpdates.length > 0 ? roundQuestUpdates : undefined,
      newMilestones: newMilestones.length > 0 ? newMilestones : undefined,
      xpAwarded: 35 + (critSuccesses.length * 15),
    };
  }

  public async generatePrologue(context: AIDMPrologueContext): Promise<AIDMResponse> {
    const { title, setting, characters, genre = 'fantasy' } = context;

    const heroDescriptions = characters.map(c => {
      const bioSnippet = c.bio ? ` (${c.bio})` : '';
      return `${c.name} — ${c.race} ${c.characterClass}${bioSnippet}`;
    });

    const partyIntro = heroDescriptions.length > 0
      ? `В этот поход выдвигается разношёрстный отряд искателей приключений: ${heroDescriptions.join(', ')}. Каждый из них принёс своё мастерство, тайны и готовность к дорожным испытаниям.`
      : 'Отряд отважных искателей приключений ступает на порог неизведанного.';

    // 4 Dynamic prologue archetypes to avoid endless battles
    const archetypes = ['caravan', 'wounded', 'guard', 'ambush'];
    const chosenArchetype = archetypes[Math.floor(Math.random() * archetypes.length)];

    if (chosenArchetype === 'caravan') {
      const narrative = `Кампания «${title}» берёт своё начало на старом тракте. ${setting}\n\n${partyIntro}\n\nНа широкой развилке дорог под сенью раскидистых вязов отряд замечает походный лагерь. Караван бродячего купца Бальтазара застрял на привале: сломанная ось одной из тяжелых повозок накренила фургон. Возницы хлопочут у костра, а сам купец, завидев вооружённых путников, приветливо машет рукой и приглашает разделить тепло очага, надеясь на помощь и обмен новостями.`;
      return {
        narrative,
        playerUpdates: [],
        currentSituation: 'Караван купца Бальтазара встал на развилке тракта из-за сломанной повозки. Купец рад встрече с отрядом.',
        choiceDilemma: 'Помочь починить повозку проверкой Силы, расспросить купца о слухах и окрестных тайнах или поинтересоваться его товарами. Что делает каждый герой?',
        activeEnemies: [],
        sceneNPCs: [
          {
            id: 'npc_balthazar',
            name: 'Купец Бальтазар',
            role: 'Торговец диковинками',
            hpCurrent: 18,
            hpMax: 18,
            ac: 12,
            disposition: 'friendly',
            combatRole: 'neutral_observer',
            status: 'Радушно приглашает к костру и предлагает осмотреть товары',
            isDead: false,
          }
        ],
        enemiesStatus: 'Врагов поблизости нет. Обстановка мирная и дружелюбная.',
        mood: 'social',
        nextRoundDC: 11,
        nextRoundDCReason: 'Осмотр повозки или дружелюбная беседа с купцом',
        requiredCheckStat: 'cha',
        questUpdates: [
          {
            title: 'Помочь каравану купца',
            description: 'Осмотреть повреждённую повозку и помочь с ремонтом или договориться о пути',
            category: 'repair',
            action: 'add',
          }
        ],
        newMilestones: [`Начало похода «${title}»: отряд встретил караван Бальтазара на тракте.`],
        xpAwarded: 25,
      };
    }

    if (chosenArchetype === 'wounded') {
      const narrative = `Кампания «${title}» начинается с тревожной находки в пути. ${setting}\n\n${partyIntro}\n\nСреди придорожных папоротников и замшелых камней герои замечают человека в изорванном походном плаще. Путник тяжело дышит, прижимая окровавленную ладонь к боку. В его ослабевших пальцах зажат кожаный тубус с нетронутой сургучной печатью. Заслышав шаги отряда, он с мольбой приподнимает голову: «Помогите... за мной следили... спасите письмо...»`;
      return {
        narrative,
        playerUpdates: [],
        currentSituation: 'У обочины обнаружен тяжелораненый гонец с запечатанным посланием. Ему срочно нужна помощь.',
        choiceDilemma: 'Оказать раненому медицинскую помощь (зельем или проверкой Мудрости), расспросить его о нападавших или изучить сургучную печать на тубусе. Что предпринимает отряд?',
        activeEnemies: [],
        sceneNPCs: [
          {
            id: 'npc_liam',
            name: 'Гонец Лиам',
            role: 'Королевский вестник',
            hpCurrent: 7,
            hpMax: 20,
            ac: 13,
            disposition: 'cautious',
            combatRole: 'hiding',
            status: 'Прижимает окровавленную ладонь к боку, моля о помощи',
            isDead: false,
          }
        ],
        enemiesStatus: 'Поблизости врагов не видно, но вокруг витает ощущение скрытой опасности.',
        mood: 'mystery',
        nextRoundDC: 12,
        nextRoundDCReason: 'Первая медицинская помощь или расшифровка печати',
        requiredCheckStat: 'wis',
        questUpdates: [
          {
            title: 'Спасение раненого гонца',
            description: 'Оказать первую медицинскую помощь вестнику и сохранить запечатанное послание',
            category: 'task',
            action: 'add',
          }
        ],
        newMilestones: [`Начало похода «${title}»: отряд спас раненого гонца на дороге.`],
        xpAwarded: 25,
      };
    }

    if (chosenArchetype === 'guard') {
      const narrative = `Кампания «${title}» начинается у рубежей цивилизации. ${setting}\n\n${partyIntro}\n\nПеред отрядом вырастают массивные деревянные ворота укреплённого сторожевого поста на каменном мосту. Завидев приближение путников, сержант местной стражи опускает алебарду и выходит вперёд в сопровождении двух дозорных. «Стой, путник! Дорога на перевал закрыта до рассвета по приказу коменданта. Назовитесь и покажите подорожные грамоты!» — звучит строгий, но спокойный голос командира.`;
      return {
        narrative,
        playerUpdates: [],
        currentSituation: 'Отряд остановлен бдительным патрулем стражи на мостовой заставе для досмотра и проверки документов.',
        choiceDilemma: 'Попытаться убедить сержанта пропустить отряд (Харизма), расспросить о причинах перекрытия тракта или предложить свою помощь страже. Каково решение отряда?',
        activeEnemies: [],
        sceneNPCs: [
          {
            id: 'npc_elrik',
            name: 'Сержант Элрик',
            role: 'Командир заставы',
            hpCurrent: 28,
            hpMax: 28,
            ac: 16,
            disposition: 'neutral',
            combatRole: 'neutral_observer',
            status: 'Держит алебарду на изготовку, ожидая предъявления подорожных грамот',
            isDead: false,
          }
        ],
        enemiesStatus: 'Стражники на заставе не враждебны, но соблюдают бдительность.',
        mood: 'social',
        nextRoundDC: 12,
        nextRoundDCReason: 'Убедительные переговоры со стражей или демонстрация авторитета',
        requiredCheckStat: 'cha',
        questUpdates: [
          {
            title: 'Преодолеть заставу на мосту',
            description: 'Убедить дозорных пропустить отряд через перевал или договориться со стражей',
            category: 'social',
            action: 'add',
          }
        ],
        newMilestones: [`Начало похода «${title}»: отряд прибыл на дозорную заставу у моста.`],
        xpAwarded: 25,
      };
    }

    // Default 4th: Tactical Encounter (Ambush)
    let enemyName = 'Авангард разбойников';
    if (/кибер|cyber/i.test(genre)) enemyName = 'Кибер-наёмники «Синтек»';
    else if (/мафи|mafia/i.test(genre)) enemyName = 'Боевики с автоматами';
    else if (/sci|космос/i.test(genre)) enemyName = 'Охранные дроны';

    const narrative = `Кампания «${title}» сразу испытывает героев на прочность. ${setting}\n\n${partyIntro}\n\nИз клубящегося тумана внезапно доносится скрежет обнажаемой стали. Неприятель перекрывает путь, намереваясь взять отряд врасплох!`;
    return {
      narrative,
      playerUpdates: [],
      currentSituation: `Перед отрядом занимают позиции ${enemyName}, отрезая путь дальше. Что предпринимает отряд?`,
      choiceDilemma: 'Принять бой, попытаться занять укрытия или ошеломить противников внезапным маневром. Как действует каждый герой?',
      activeEnemies: [
        {
          id: 'enemy_1',
          name: enemyName,
          type: 'minion',
          hpCurrent: 14,
          hpMax: 14,
          ac: 12,
          status: 'Ощетинились оружием и готовы к атаке',
          isDead: false,
        }
      ],
      enemiesStatus: 'Противники готовы к схватке',
      mood: 'combat',
      nextRoundDC: 12,
      nextRoundDCReason: 'Оценка угрозы и первый тактический шаг',
      requiredCheckStat: 'dex',
      questUpdates: [
        {
          title: 'Отразить нападение врагов',
          description: 'Занять выгодные позиции и нейтрализовать противников',
          category: 'task',
          action: 'add',
        }
      ],
      newMilestones: [`Начало похода «${title}»: отряд отражает внезапную угрозу.`],
      xpAwarded: 25,
    };
  }
}

export const simulationAIProvider = new SimulationAIProvider();
