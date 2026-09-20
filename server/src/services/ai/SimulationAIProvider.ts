import { IAIProvider } from './IAIProvider';
import { AIDMContext, AIDMResponse, PlayerHpUpdate } from '../../domain/types';

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
  intent: 'melee' | 'ranged' | 'magic' | 'heal' | 'stealth' | 'defense' | 'athletics' | 'investigation' | 'dialogue' | 'general';
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
      } else if (/прыж|толкн|сбит|слома|выбит|пнут|рывок|бег/.test(textLower)) {
        intent = 'athletics';
      } else if (/осмотр|изуч|найт|замок|ловушк|взлом|разгляд|поиск/.test(textLower)) {
        intent = 'investigation';
      } else if (/крич|закрич|запуг|сказа|приказ|переговор|насмешк|призыв/.test(textLower)) {
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

    // 2. Setting theme & Atmosphere opener
    const isDarkDungeon = /подземел|катакомб|склеп|гробниц|пещер|шахт/i.test(setting);
    const isForest = /лес|чащ|болот|пущ|дерев/i.test(setting);
    const isRuins = /руин|замок|крепост|храм|башн/i.test(setting);

    let atmosphereIntro = '';
    if (roundNumber === 1) {
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
      if (isDarkDungeon) {
        atmosphereIntro = 'Эхо битвы гулко разносится под сводами каменного зала. В воздухе витает едкий дым и запах горячего железа, а вражеский натиск обретает новую ярость.';
      } else if (isForest) {
        atmosphereIntro = 'Туман вокруг поляны густеет, окрашиваясь тревожными багровыми отблесками. Чудовища перегруппировываются, оскалив клыки в жажде расправы.';
      } else {
        atmosphereIntro = 'Схватка переходит в критическую фазу. Напряжение в рядах отряда достигает предела, каждый шаг и каждое движение решают исход противостояния.';
      }
    }

    // 3. Compose the syncretic party onslaught (Paragraph 1 & 2)
    const partyProseLines: string[] = [];

    analyzedActions.forEach((item, index) => {
      let connector = '';
      if (index === 0) {
        connector = analyzedActions.length === 1 ? 'В эпицентре происходящего ' : 'Во главе наступления ';
      } else if (index === 1) {
        connector = 'Одновременно с этим, подхватив боевой темп, ';
      } else if (index === 2) {
        connector = 'С противоположного фланга в схватку вступает ';
      } else if (index === 3) {
        connector = 'Тем временем, зорко оценивая расстановку сил, ';
      } else {
        connector = 'Не теряя ни секунды драгоценного времени, ';
      }

      let outcomePhrase = '';
      if (item.isCritSuccess) {
        switch (item.intent) {
          case 'melee':
            outcomePhrase = `совершает сокрушительный, эталонный выпад — оружие с глухим хрустом рассекает вражескую броню, выбивая сноп ярких искр и отбрасывая ошеломлённого противника на каменный пол!`;
            break;
          case 'ranged':
            outcomePhrase = `пускает оперённую стрелу со сверхъестественной точностью: свистящий снаряд насквозь пробивает щит вражеского застрельщика, заставляя того взвыть от боли!`;
            break;
          case 'magic':
            outcomePhrase = `высвобождает сокрушительный вихрь чародейской энергии — ослепительная вспышка сотрясает всё помещение, испепеляя защиту неприятеля и обращая строй врагов в панику!`;
            break;
          case 'heal':
            outcomePhrase = `направляет волну живительного сияния точно в центр отряда, исцеляя кровоточащие раны союзников и наполняя их мышцы несокрушимым приливом сил!`;
            break;
          case 'stealth':
            outcomePhrase = `буквально растворяется в клубящихся тенях и бесшумно возникает за спиной врага, нанося хирургически точный удар в самое уязвимое сочленение защиты!`;
            break;
          case 'defense':
            outcomePhrase = `встречает ярость врагов монолитным блоком — сокрушительный отпор гасит удар чудовищ, ошеломляя их и выбивая оружие из когтистых лап!`;
            break;
          case 'athletics':
            outcomePhrase = `совершает безупречный атлетический рывок — сокрушительным тараном сбивает вражеский заслон, внося неразбериху в ряды неприятеля!`;
            break;
          case 'dialogue':
            outcomePhrase = `издаёт столь свирепый и громогласный клич, что враги цепенеют от первобытного ужаса, опуская щиты!`;
            break;
          case 'investigation':
            outcomePhrase = `мгновенно подмечает скрытую слабость в позиции чудовищ, безукоризненно направляя удар точно в брешь!`;
            break;
          default:
            outcomePhrase = `демонстрирует феноменальное мастерство: всё задуманное исполняется с безукоризненной лёгкостью, сокрушая любые расчёты противников!`;
        }
      } else if (item.isSuccess) {
        switch (item.intent) {
          case 'melee':
            outcomePhrase = `уверенным рубящим ударом продавливает оборону врага, оставляя глубокую кровавую борозду на доспехах неприятеля и оттесняя его назад.`;
            break;
          case 'ranged':
            outcomePhrase = `находит открытую брешь во вражеском строю — меткий выстрел намертво пригвождает противника к преграде, сковывая его манёвр.`;
            break;
          case 'magic':
            outcomePhrase = `сплетает боевое заклятие, направляя потоки стихийной мощи точно во вражеские ряды и сея дезориентацию среди нападающих.`;
            break;
          case 'heal':
            outcomePhrase = `быстро и своевременно оказывает помощь, облегчая боль соратников и возвращая отряду утраченное тактическое равновесие.`;
            break;
          case 'stealth':
            outcomePhrase = `ловко выскальзывает из поля зрения чудовищ, занимая доминирующую позицию для внезапной атаки.`;
            break;
          case 'defense':
            outcomePhrase = `хладнокровно принимает удар на щит, гася импульс вражеской атаки и прикрывая соратников.`;
            break;
          case 'athletics':
            outcomePhrase = `мощным силовым движением опрокидывает преграду и оттесняет противников на невыгодную позицию.`;
            break;
          case 'dialogue':
            outcomePhrase = `хлёстким окриком и властным приказом перехватывает внимание врагов, выигрывая время для отряда.`;
            break;
          case 'investigation':
            outcomePhrase = `быстро вычисляет слабое место вражеской обороны, давая ценное тактическое преимущество.`;
            break;
          default:
            outcomePhrase = `действует хладнокровно и решительно, добиваясь поставленной цели и склоняя чашу весов в пользу героев.`;
        }
      } else if (item.isSevereFail) {
        switch (item.intent) {
          case 'melee':
            outcomePhrase = `совершает мощный замах, но нога предательски соскальзывает на мокрых плитах: удар рассекает лишь воздух, открывая опаснейшую брешь для контратаки!`;
            break;
          case 'ranged':
            outcomePhrase = `спускает тетиву, но суматоха рукопашной сбивает прицел — стрела с визгом рикошетит от камней, а стрелок оказывается под угрозой ответного удара!`;
            break;
          case 'magic':
            outcomePhrase = `пытается обуздать магические потоки, однако яростный вой врагов сбивает концентрацию — заклятие гаснет ядовитым дымом, обжигая пальцы!`;
            break;
          case 'defense':
            outcomePhrase = `пытается закрыться блоком, однако свирепый таран врага проламывает заслон, сбивая дыхание бойца!`;
            break;
          case 'stealth':
            outcomePhrase = `совершает неловкое движение — хруст под сапогом мгновенно выдаёт позицию и навлекает ярость врагов!`;
            break;
          default:
            outcomePhrase = `сталкивается с непредвиденным сопротивлением: манёвр срывается в самый неподходящий миг, грозя обернуться тяжёлыми последствиями!`;
        }
      } else {
        // Glancing blow / minor failure
        switch (item.intent) {
          case 'melee':
            outcomePhrase = `наносит резкий выпад, однако острие со звоном соскальзывает по закалённому наплечнику неприятеля, не нанеся глубокого вреда.`;
            break;
          case 'ranged':
            outcomePhrase = `выпускает снаряд, но цель в последний момент успевает укрыться за толстым щитом.`;
            break;
          case 'magic':
            outcomePhrase = `направляет волну энергии, но плотный строй противников гасит основную часть магического удара.`;
            break;
          case 'defense':
            outcomePhrase = `едва успевает подставить защиту — удар приходится на излёте, но сильно утомляет руку.`;
            break;
          default:
            outcomePhrase = `старается продавить ситуацию, однако оборона противников оказывается плотнее, чем казалось изначально.`;
        }
      }

      partyProseLines.push(`${connector}${item.characterName} ${outcomePhrase}`);
    });

    narrativeParagraphs.push(atmosphereIntro);
    narrativeParagraphs.push(partyProseLines.join(' '));

    // 4. Enemy Retaliation & Battlefield Evolution (Paragraph 3)
    const failedActions = analyzedActions.filter(a => !a.isSuccess);
    const critSuccesses = analyzedActions.filter(a => a.isCritSuccess);

    let enemyResponseProse = '';
    if (failedActions.length > 0) {
      // Pick characters who failed to take damage
      const targetVictims = failedActions.slice(0, 2);
      const victimNames: string[] = [];

      targetVictims.forEach(victim => {
        const damage = victim.isCritFail ? -5 : victim.isSevereFail ? -4 : -2;
        playerUpdates.push({
          characterId: victim.characterId,
          characterName: victim.characterName,
          hpDelta: damage,
          note: victim.isCritFail ? 'Критическая контратака врагов' : 'Ответный выпад противника',
        });
        victimNames.push(victim.characterName);
      });

      if (victimNames.length === 1) {
        enemyResponseProse = `Почувствовав заминку, разъярённый противник мгновенно переходит в яростный контрнатиск. Ощерив зазубренное железо, враги набрасываются на ${victimNames[0]}, нанося хлёсткий рассекающий удар и вынуждая героя пошатнуться под шквалом стали.`;
      } else {
        enemyResponseProse = `Воспользовавшись образовавшимися разрывами в строю, чудовища свирепо огрызаются. Их вожак оглашает своды хриплым боевым кличем, и контрудар настигает ${victimNames.join(' и ')}, заставляя бойцов дорого заплатить за секундную оплошность.`;
      }
    } else if (critSuccesses.length > 0 || analyzedActions.length >= 2) {
      enemyResponseProse = 'Слаженный и свирепый натиск отряда производит ошеломляющий эффект. Вражеский авангард смят и разорван: несколько противников валятся на камни, захлёбываясь хрипом, а уцелевшие твари в панике пятятся назад, оглашая своды испуганными криками.';
    } else {
      enemyResponseProse = 'Противники ошеломлены твёрдостью духа искателей приключений. Они перегруппировываются на ходу, тяжело дыша и выискивая глазами бреши в монолитной стойке отряда.';
    }

    narrativeParagraphs.push(enemyResponseProse);

    // 5. Dynamic Tactical Conclusion & Environment Aftermath (Paragraph 4)
    let climaxProse = '';
    if (failedActions.length === 0) {
      climaxProse = 'Воздух наполнен запахом триумфа и озона. Пыль битвы медленно оседает, открывая взору разбитую вражескую позицию и путь вперёд.';
    } else {
      climaxProse = 'Капли крови окропляют холодный камень. Противники всё ещё опасны и стягивают последние резервы для решающего удара.';
    }
    narrativeParagraphs.push(climaxProse);

    // 6. Dynamic Loot drops (every 2 rounds, or on crit successes)
    const droppedLoot: AIDMResponse['droppedLoot'] = [];
    if (critSuccesses.length > 0 || (roundNumber % 2 === 0 && failedActions.length === 0)) {
      const lootTable: Array<{ name: string; type: 'weapon' | 'armor' | 'potion' | 'misc'; description: string; healAmount?: number; damage?: string; ac_bonus?: number }> = [
        {
          name: 'Флакон эльфийского исцеления',
          type: 'potion',
          description: 'Мерцающая рубиновая жидкость, восстанавливающая силы и залечивающая глубокие раны.',
          healAmount: 8,
        },
        {
          name: 'Зазубренный клевец дозорного',
          type: 'weapon',
          description: 'Тяжёлое боевое оружие с гравировкой на чёрном железе. Легко пробивает кольчугу.',
          damage: '1d8+2',
        },
        {
          name: 'Свиток ледяного шипа',
          type: 'misc',
          description: 'Пергамент с древними письменами, излучающий колющий арктический холод.',
        },
        {
          name: 'Чешуйчатый щит стража глубин',
          type: 'armor',
          description: 'Кованый щит, укреплённый чешуей подземного ящера.',
          ac_bonus: 2,
        },
      ];

      const chosenLoot = lootTable[(roundNumber + analyzedActions.length) % lootTable.length];
      droppedLoot.push(chosenLoot);
    }

    // 7. Dynamic Situation & Next Round DC
    let nextRoundDC = 12;
    let nextRoundDCReason = 'Преодоление рубежа обороны';
    let currentSituation = '';

    if (failedActions.length > 0) {
      nextRoundDC = Math.min(16, currentDC + 1);
      nextRoundDCReason = 'Враги закрепились на рубеже и усиливают натиск';
      currentSituation = 'Потрепанные, но свирепые противники сплотились вокруг своего командира, перекрывая проход за упавшей решеткой, пока из темноты нарастает топот подкрепления. Что предпринимает отряд?';
    } else if (critSuccesses.length > 0) {
      nextRoundDC = Math.max(10, currentDC - 1);
      nextRoundDCReason = 'Противники дезориентированы и бросаются в бегство';
      currentSituation = 'Остатки врагов в панике отступают вглубь коридоров. На полу видны брошенные припасы, а впереди мерцает приоткрытая кованая дверь тайника. Что делает отряд?';
    } else {
      nextRoundDC = 13;
      nextRoundDCReason = 'Тактическое маневрирование в изменившейся обстановке';
      currentSituation = 'Линия соприкосновения разорвана. Враги оценивают силы героев, держа дистанцию и готовясь к новому залпу. Что предпринимает ваш герой?';
    }

    // 8. Lore Milestones
    const newMilestones: string[] = [];
    if (roundNumber === 1) {
      newMilestones.push(`Отряд вступил в бой в локации "${setting || 'Неизведанные земли'}" и принял первое боевое крещение.`);
    } else if (critSuccesses.length > 0) {
      newMilestones.push(`Раунд ${roundNumber}: Герои совершили сокрушительный прорыв, сломив хребет вражескому сопротивлению.`);
    }

    return {
      narrative: narrativeParagraphs.join('\n\n'),
      playerUpdates,
      currentSituation,
      enemiesStatus: failedActions.length === 0 ? 'Враги сломлены и отступают' : 'Враги ожесточенно контратакуют',
      mood: playerUpdates.length > 0 ? 'combat' : critSuccesses.length > 0 ? 'triumph' : 'tension',
      nextRoundDC,
      nextRoundDCReason,
      droppedLoot: droppedLoot.length > 0 ? droppedLoot : undefined,
      newMilestones: newMilestones.length > 0 ? newMilestones : undefined,
      xpAwarded: 35 + (critSuccesses.length * 15),
    };
  }
}

export const simulationAIProvider = new SimulationAIProvider();
