import { CharacterEntity } from '../../db';

export interface TalentNode {
  id: string;
  name: string;
  description: string;
  tier: 1 | 2 | 3;
  cost: number;
  branch: 'class' | 'race' | 'quenta';
  icon?: string;
  effects: {
    hpBonus?: number;
    acBonus?: number;
    statBonus?: {
      stat: 'str' | 'dex' | 'con' | 'int' | 'wis' | 'cha';
      amount: number;
    };
    newAbility?: {
      name: string;
      type: 'action' | 'spell' | 'bonus' | 'passive';
      description: string;
    };
  };
}

export interface CharacterTalentTree {
  classBranch: { name: string; talents: TalentNode[] };
  raceBranch: { name: string; talents: TalentNode[] };
  quentaBranch: { name: string; talents: TalentNode[] };
}

export class TalentTreeGenerator {
  public generateTree(character: CharacterEntity): CharacterTalentTree {
    const classBranch = this.generateClassBranch(character);
    const raceBranch = this.generateRaceBranch(character);
    const quentaBranch = this.generateQuentaBranch(character);

    return {
      classBranch,
      raceBranch,
      quentaBranch,
    };
  }

  private generateClassBranch(character: CharacterEntity): { name: string; talents: TalentNode[] } {
    const cClass = character.characterClass.toLowerCase();

    if (cClass.includes('варвар')) {
      return {
        name: 'Путь Первобытной Ярости',
        talents: [
          {
            id: 'barb_1',
            name: 'Неукротимый напор',
            description: '+6 к максимальному здоровью и стойкость к ошеломлению.',
            tier: 1 as const,
            cost: 1,
            branch: 'class' as const,
            effects: { hpBonus: 6 },
          },
          {
            id: 'barb_2',
            name: 'Сокрушительный взмах',
            description: 'Новая атака: наносит сокрушительный свирепый удар по площади.',
            tier: 2 as const,
            cost: 1,
            branch: 'class' as const,
            effects: {
              newAbility: {
                name: 'Сокрушительный размах',
                type: 'action',
                description: 'Атака широким взмахом, наносящая урон нескольким врагам рядом.',
              },
            },
          },
          {
            id: 'barb_3',
            name: 'Аватара Берсерка',
            description: '+2 к Силе, криты на 19-20 в ярости.',
            tier: 3 as const,
            cost: 1,
            branch: 'class' as const,
            effects: { statBonus: { stat: 'str', amount: 2 }, hpBonus: 8 },
          },
        ],
      };
    }

    if (cClass.includes('плут') || cClass.includes('вор')) {
      return {
        name: 'Искусство Теней и Клинка',
        talents: [
          {
            id: 'rogue_1',
            name: 'Быстрые пальцы',
            description: '+1 к Ловкости и мгновенный уход в укрытие.',
            tier: 1 as const,
            cost: 1,
            branch: 'class' as const,
            effects: { statBonus: { stat: 'dex', amount: 1 } },
          },
          {
            id: 'rogue_2',
            name: 'Коварный удар из тени',
            description: 'Новое действие: критический удар в спину дезориентирует врага.',
            tier: 2 as const,
            cost: 1,
            branch: 'class' as const,
            effects: {
              newAbility: {
                name: 'Удар исподтишка',
                type: 'action',
                description: 'Скрытная атака уязвимых мест с шансом оглушить врага.',
              },
            },
          },
          {
            id: 'rogue_3',
            name: 'Призрачный шаг',
            description: '+2 к КБ при перемещении и уклонение от урона по площади.',
            tier: 3 as const,
            cost: 1,
            branch: 'class' as const,
            effects: { acBonus: 2 },
          },
        ],
      };
    }

    if (cClass.includes('волшеб') || cClass.includes('чародей') || cClass.includes('колдун')) {
      return {
        name: 'Тайная Аркана',
        talents: [
          {
            id: 'mage_1',
            name: 'Энергетический щит',
            description: '+2 к КБ и поглощение магических снарядов.',
            tier: 1 as const,
            cost: 1,
            branch: 'class' as const,
            effects: { acBonus: 2 },
          },
          {
            id: 'mage_2',
            name: 'Цепная молния',
            description: 'Новое заклинание: дуга электричества перескакивает между врагами.',
            tier: 2 as const,
            cost: 1,
            branch: 'class' as const,
            effects: {
              newAbility: {
                name: 'Громовой разряд',
                type: 'spell',
                description: 'Вспышка молнии, наносящая урон током и отбрасывающая врага.',
              },
            },
          },
          {
            id: 'mage_3',
            name: 'Перегрузка разума',
            description: '+2 к Интеллекту и усиление урона всех заклинаний.',
            tier: 3 as const,
            cost: 1,
            branch: 'class' as const,
            effects: { statBonus: { stat: 'int', amount: 2 }, hpBonus: 4 },
          },
        ],
      };
    }

    // Default Martial/General Path
    return {
      name: 'Мастерство Оружия и Защиты',
      talents: [
        {
          id: 'gen_class_1',
          name: 'Закалка воина',
          description: '+5 к максимальному HP и уверенность в строю.',
          tier: 1 as const,
          cost: 1,
          branch: 'class' as const,
          effects: { hpBonus: 5 },
        },
        {
          id: 'gen_class_2',
          name: 'Оборонительная стойка',
          description: '+1 к КБ и парирование атак.',
          tier: 2 as const,
          cost: 1,
          branch: 'class' as const,
          effects: { acBonus: 1 },
        },
        {
          id: 'gen_class_3',
          name: 'Героический натиск',
          description: '+2 к профильной характеристике и воодушевление.',
          tier: 3 as const,
          cost: 1,
          branch: 'class' as const,
          effects: { hpBonus: 6, acBonus: 1 },
        },
      ],
    };
  }

  private generateRaceBranch(character: CharacterEntity): { name: string; talents: TalentNode[] } {
    const race = character.race.toLowerCase();

    if (race.includes('дворф') || race.includes('гном')) {
      return {
        name: 'Наследие Подгорного Королевства',
        talents: [
          {
            id: 'dwarf_1',
            name: 'Каменная стойкость',
            description: '+5 к HP и сопротивление ядам подземелий.',
            tier: 1 as const,
            cost: 1,
            branch: 'race' as const,
            effects: { hpBonus: 5 },
          },
          {
            id: 'dwarf_2',
            name: 'Кузнечное чутье',
            description: '+1 к КБ благодаря пониманию уязвимостей доспехов.',
            tier: 2 as const,
            cost: 1,
            branch: 'race' as const,
            effects: { acBonus: 1 },
          },
          {
            id: 'dwarf_3',
            name: 'Незыблемая скала',
            description: '+2 к Телосложению, невозможно сбить с ног.',
            tier: 3 as const,
            cost: 1,
            branch: 'race' as const,
            effects: { statBonus: { stat: 'con', amount: 2 }, hpBonus: 6 },
          },
        ],
      };
    }

    if (race.includes('эльф')) {
      return {
        name: 'Грация Древнего Леса',
        talents: [
          {
            id: 'elf_1',
            name: 'Обостренные чувства',
            description: '+1 к Ловкости и обнаружение засад.',
            tier: 1 as const,
            cost: 1,
            branch: 'race' as const,
            effects: { statBonus: { stat: 'dex', amount: 1 } },
          },
          {
            id: 'elf_2',
            name: 'Шаг ветра',
            description: '+1 к КБ и бесшумное перемещение.',
            tier: 2 as const,
            cost: 1,
            branch: 'race' as const,
            effects: { acBonus: 1 },
          },
          {
            id: 'elf_3',
            name: 'Медитация предков',
            description: '+2 к Мудрости или Интеллекту и иммунитет ко сну.',
            tier: 3 as const,
            cost: 1,
            branch: 'race' as const,
            effects: { statBonus: { stat: 'wis', amount: 2 } },
          },
        ],
      };
    }

    // Default Race
    return {
      name: 'Адаптивность Первопроходцев',
      talents: [
        {
          id: 'human_1',
          name: 'Воля к жизни',
          description: '+4 к максимальному HP и упорство.',
          tier: 1 as const,
          cost: 1,
          branch: 'race' as const,
          effects: { hpBonus: 4 },
        },
        {
          id: 'human_2',
          name: 'Универсальное чутье',
          description: '+1 к любой проверке навыков.',
          tier: 2 as const,
          cost: 1,
          branch: 'race' as const,
          effects: { hpBonus: 4, acBonus: 1 },
        },
        {
          id: 'human_3',
          name: 'Несгибаемый дух',
          description: '+2 к характеристике и бонус к спасброскам.',
          tier: 3 as const,
          cost: 1,
          branch: 'race' as const,
          effects: { hpBonus: 6 },
        },
      ],
    };
  }

  private generateQuentaBranch(character: CharacterEntity): { name: string; talents: TalentNode[] } {
    const bio = (character.bio || '').toLowerCase();

    // 1. Theme: Deception / Bluff / Roguish Past
    if (bio.includes('обман') || bio.includes('ложь') || bio.includes('блеф') || bio.includes('вор') || bio.includes('хитр')) {
      return {
        name: 'Путь Отчаянного Блефа',
        talents: [
          {
            id: 'quenta_bluff_1',
            name: 'Язык змеи',
            description: 'Умение заговаривать зубы врагам: проверка обмана дезориентирует цель.',
            tier: 1 as const,
            cost: 1,
            branch: 'quenta' as const,
            effects: {
              newAbility: {
                name: 'Зубозаговаривание',
                type: 'bonus',
                description: 'Отвлекает внимание противника перед атакой, давая преимущество.',
              },
            },
          },
          {
            id: 'quenta_bluff_2',
            name: 'Ложный выпад',
            description: '+1 к КБ при насмешке и финтах.',
            tier: 2 as const,
            cost: 1,
            branch: 'quenta' as const,
            effects: { acBonus: 1 },
          },
          {
            id: 'quenta_bluff_3',
            name: 'Король провокаций',
            description: '+2 к Харизме, враги при промахе открываются для удара всего отряда.',
            tier: 3 as const,
            cost: 1,
            branch: 'quenta' as const,
            effects: { statBonus: { stat: 'cha', amount: 2 }, hpBonus: 5 },
          },
        ],
      };
    }

    // 2. Theme: Trauma / Fear / Vengeance
    if (bio.includes('страх') || bio.includes('месть') || bio.includes('травм') || bio.includes('шрам') || bio.includes('потер')) {
      return {
        name: 'Закалка Страданий и Мести',
        talents: [
          {
            id: 'quenta_revenge_1',
            name: 'Шрамы выжившего',
            description: '+6 к HP. При низком здоровье наносит дополнительный урон от ярости.',
            tier: 1 as const,
            cost: 1,
            branch: 'quenta' as const,
            effects: { hpBonus: 6 },
          },
          {
            id: 'quenta_revenge_2',
            name: 'Ответная ярость',
            description: 'Новая реакция: при получении урона мгновенно наносит встречный удар.',
            tier: 2 as const,
            cost: 1,
            branch: 'quenta' as const,
            effects: {
              newAbility: {
                name: 'Встречное возмездие',
                type: 'bonus',
                description: 'Ответный выпад по врагу, только что ранившему персонажа.',
              },
            },
          },
          {
            id: 'quenta_revenge_3',
            name: 'Презрение к смерти',
            description: '+2 к Телосложению. Спасброски от смерти совершаются с преимуществом.',
            tier: 3 as const,
            cost: 1,
            branch: 'quenta' as const,
            effects: { statBonus: { stat: 'con', amount: 2 }, hpBonus: 8 },
          },
        ],
      };
    }

    // Default Quenta Branch (Adventures & Wanderer)
    return {
      name: 'Уроки Скитаний и Опыта',
      talents: [
        {
          id: 'quenta_wander_1',
          name: 'Чутье на опасность',
          description: '+4 к HP и бонус к спасброскам против ловушек.',
          tier: 1 as const,
          cost: 1,
          branch: 'quenta' as const,
          effects: { hpBonus: 4 },
        },
        {
          id: 'quenta_wander_2',
          name: 'Второе дыхание',
          description: 'Новая способность: восстанавливает 1d8 HP один раз за бой.',
          tier: 2 as const,
          cost: 1,
          branch: 'quenta' as const,
          effects: {
            newAbility: {
              name: 'Второе дыхание',
              type: 'bonus',
              description: 'Преодоление усталости, мгновенно исцеляющее раны.',
            },
          },
        },
        {
          id: 'quenta_wander_3',
          name: 'Легенда трактов',
          description: '+1 к КБ и +6 к максимальному HP.',
          tier: 3 as const,
          cost: 1,
          branch: 'quenta' as const,
          effects: { acBonus: 1, hpBonus: 6 },
        },
      ],
    };
  }
}

export const talentTreeGenerator = new TalentTreeGenerator();
