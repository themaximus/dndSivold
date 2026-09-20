export interface DndClassConfig {
  name: string;
  nameRu: string;
  hitDie: number; // 6, 8, 10, 12
  primaryStat: 'str' | 'dex' | 'con' | 'int' | 'wis' | 'cha';
  savingThrows: string[];
  startingAbilities: {
    id: string;
    name: string;
    type: 'action' | 'spell' | 'bonus' | 'passive';
    description: string;
    damage?: string;
    range?: string;
  }[];
  startingInventory: {
    id: string;
    name: string;
    type: 'weapon' | 'armor' | 'potion' | 'misc';
    description: string;
    quantity: number;
    damage?: string;
    ac_bonus?: number;
  }[];
}

export const DND_CLASSES: Record<string, DndClassConfig> = {
  fighter: {
    name: 'Fighter',
    nameRu: 'Воин',
    hitDie: 10,
    primaryStat: 'str',
    savingThrows: ['Сила', 'Телосложение'],
    startingAbilities: [
      {
        id: 'second_wind',
        name: 'Второе дыхание',
        type: 'bonus',
        description: 'Восстанавливает 1d10 + уровень HP один раз за бой.',
      },
      {
        id: 'action_surge',
        name: 'Всплеск действий',
        type: 'passive',
        description: 'Позволяет совершить одно дополнительное действие в свой ход.',
      },
      {
        id: 'heavy_strike',
        name: 'Мощный рубящий удар',
        type: 'action',
        description: 'Атака двуручным мечом с максимальной силой.',
        damage: '2d6 + СИЛ',
        range: 'Ближний бой',
      }
    ],
    startingInventory: [
      { id: 'greatsword', name: 'Двуручный меч', type: 'weapon', description: 'Тяжелый стальной меч', quantity: 1, damage: '2d6' },
      { id: 'chainmail', name: 'Кольчуга', type: 'armor', description: 'Крепкая тяжелая броня (КБ 16)', quantity: 1, ac_bonus: 6 },
      { id: 'potion_heal', name: 'Зелье лечения', type: 'potion', description: 'Восстанавливает 2d4+2 HP', quantity: 2 },
    ]
  },
  wizard: {
    name: 'Wizard',
    nameRu: 'Волшебник',
    hitDie: 6,
    primaryStat: 'int',
    savingThrows: ['Интеллект', 'Мудрость'],
    startingAbilities: [
      {
        id: 'magic_missile',
        name: 'Волшебная стрела',
        type: 'spell',
        description: 'Три светящихся дротика без промаха наносят урон силовым полем.',
        damage: '3d4 + 3',
        range: '36 метров',
      },
      {
        id: 'shield_spell',
        name: 'Щит',
        type: 'spell',
        description: 'Реакция: создает барьер, дающий +5 к КБ до начала следующего хода.',
      },
      {
        id: 'fire_bolt',
        name: 'Огненный снаряд (Заговор)',
        type: 'spell',
        description: 'Сгусток пламени устремляется во врага.',
        damage: '1d10',
        range: '36 метров',
      }
    ],
    startingInventory: [
      { id: 'arcane_staff', name: 'Магический посох', type: 'weapon', description: 'Фокусировка заклинаний и оружие', quantity: 1, damage: '1d6' },
      { id: 'spellbook', name: 'Книга заклинаний', type: 'misc', description: 'Содержит формулы тайной магии', quantity: 1 },
      { id: 'potion_heal', name: 'Зелье лечения', type: 'potion', description: 'Восстанавливает 2d4+2 HP', quantity: 1 },
    ]
  },
  rogue: {
    name: 'Rogue',
    nameRu: 'Плут',
    hitDie: 8,
    primaryStat: 'dex',
    savingThrows: ['Ловкость', 'Интеллект'],
    startingAbilities: [
      {
        id: 'sneak_attack',
        name: 'Скрытая атака',
        type: 'passive',
        description: 'Добавляет 1d6 дополнительного урона при преимуществе или атаке союзника.',
        damage: '+1d6',
      },
      {
        id: 'cunning_action',
        name: 'Хитрое действие',
        type: 'bonus',
        description: 'Бонусным действием можно совершить Рывок, Отход или Засаду.',
      },
      {
        id: 'dagger_thrust',
        name: 'Точный укол кинжалом',
        type: 'action',
        description: 'Быстрый удар в уязвимое место врага.',
        damage: '1d4 + ЛОВ',
        range: 'Ближний бой',
      }
    ],
    startingInventory: [
      { id: 'rapier', name: 'Рапира', type: 'weapon', description: 'Фехтовальное колющее оружие', quantity: 1, damage: '1d8' },
      { id: 'leather_armor', name: 'Кожаный доспех', type: 'armor', description: 'Легкая броня (КБ 11 + ЛОВ)', quantity: 1, ac_bonus: 1 },
      { id: 'thieves_tools', name: 'Воровские инструменты', type: 'misc', description: 'Отмычки и щупы', quantity: 1 },
      { id: 'daggers', name: 'Метательные кинжалы', type: 'weapon', description: 'Пара острых кинжалов', quantity: 2, damage: '1d4' },
    ]
  },
  cleric: {
    name: 'Cleric',
    nameRu: 'Жрец',
    hitDie: 8,
    primaryStat: 'wis',
    savingThrows: ['Мудрость', 'Харизма'],
    startingAbilities: [
      {
        id: 'cure_wounds',
        name: 'Лечение ран',
        type: 'spell',
        description: 'Касание божественной благодати исцеляет цель на 1d8 + МУД.',
        damage: '1d8 + МУД (Исцеление)',
        range: 'Касание',
      },
      {
        id: 'sacred_flame',
        name: 'Священное пламя (Заговор)',
        type: 'spell',
        description: 'Светящееся сияние с небес опаляет врага уроном излучением.',
        damage: '1d8 излучение',
        range: '18 метров',
      },
      {
        id: 'bless',
        name: 'Благословение',
        type: 'spell',
        description: 'Благословляет до 3 союзников, добавляя 1d4 ко всем броскам атаки и спасброскам.',
      }
    ],
    startingInventory: [
      { id: 'mace', name: 'Окованая булава', type: 'weapon', description: 'Тяжелое дробящее оружие', quantity: 1, damage: '1d6' },
      { id: 'scale_mail', name: 'Чешуйчатый доспех', type: 'armor', description: 'Средний доспех (КБ 14 + ЛОВ макс 2)', quantity: 1, ac_bonus: 4 },
      { id: 'shield', name: 'Щит со святым символом', type: 'armor', description: '+2 к Классу Брони', quantity: 1, ac_bonus: 2 },
      { id: 'holy_symbol', name: 'Священный амулет', type: 'misc', description: 'Фокусировка веры', quantity: 1 },
    ]
  },
  barbarian: {
    name: 'Barbarian',
    nameRu: 'Варвар',
    hitDie: 12,
    primaryStat: 'str',
    savingThrows: ['Сила', 'Телосложение'],
    startingAbilities: [
      {
        id: 'rage',
        name: 'Ярость',
        type: 'bonus',
        description: 'Преимущество на проверки Силы, сопротивление дробящему/колющему/рубящему урону, +2 к урону в ближнем бою.',
      },
      {
        id: 'reckless_attack',
        name: 'Безрассудная атака',
        type: 'action',
        description: 'Атака с преимуществом, но враги также получают преимущество на атаки по вам.',
        damage: '1d12 + СИЛ',
        range: 'Ближний бой',
      }
    ],
    startingInventory: [
      { id: 'greataxe', name: 'Секира предков', type: 'weapon', description: 'Громадный топор разрушительной силы', quantity: 1, damage: '1d12' },
      { id: 'handaxe', name: 'Ручной топор', type: 'weapon', description: 'Топор для рубки или метания', quantity: 2, damage: '1d6' },
      { id: 'potion_heal', name: 'Зелье лечения', type: 'potion', description: 'Восстанавливает 2d4+2 HP', quantity: 1 },
    ]
  },
  ranger: {
    name: 'Ranger',
    nameRu: 'Следопыт',
    hitDie: 10,
    primaryStat: 'dex',
    savingThrows: ['Сила', 'Ловкость'],
    startingAbilities: [
      {
        id: 'hunters_mark',
        name: 'Метка охотника',
        type: 'spell',
        description: 'Помечает цель, нанося ей дополнительно 1d6 урона оружием при каждом попадании.',
        damage: '+1d6',
      },
      {
        id: 'aimed_shot',
        name: 'Прицельный выстрел из лука',
        type: 'action',
        description: 'Стрела пущенная точно в цель.',
        damage: '1d8 + ЛОВ',
        range: '45/180 метров',
      }
    ],
    startingInventory: [
      { id: 'longbow', name: 'Длинный лук со стрелами', type: 'weapon', description: 'Дальнобойное смертоносное оружие', quantity: 1, damage: '1d8' },
      { id: 'shortswords', name: 'Пара коротких мечей', type: 'weapon', description: 'Для боя на ближней дистанции', quantity: 2, damage: '1d6' },
      { id: 'leather_armor', name: 'Кожаный доспех', type: 'armor', description: 'Легкая броня следопыта', quantity: 1, ac_bonus: 1 },
    ]
  }
};

export const DND_RACES = [
  { id: 'human', name: 'Человек', bonus: '+1 ко всем характеристикам', desc: 'Адаптивные и решительные.' },
  { id: 'elf', name: 'Эльф', bonus: '+2 Ловкость, Темное зрение', desc: 'Грациозные долгожители с магическим наследием.' },
  { id: 'dwarf', name: 'Дворф', bonus: '+2 Телосложение, Стойкость к ядам', desc: 'Крепкие подземные воины и кузнецы.' },
  { id: 'half_orc', name: 'Полуорк', bonus: '+2 Сила, +1 Телосложение, Яростная стойкость', desc: 'Грозные бойцы, не сдающиеся даже при смертельном ударе.' },
  { id: 'tiefling', name: 'Тифлинг', bonus: '+2 Харизма, +1 Интеллект, Огонь ада', desc: 'Несущие в себе частицу адского наследия.' },
];

export function calculateModifier(score: number): number {
  return Math.floor((score - 10) / 2);
}

export function formatModifier(mod: number): string {
  return mod >= 0 ? `+${mod}` : `${mod}`;
}

export function calculateBaseHP(characterClass: string, conScore: number): number {
  const cfg = DND_CLASSES[characterClass.toLowerCase()] || DND_CLASSES.fighter;
  const conMod = calculateModifier(conScore);
  return Math.max(1, cfg.hitDie + conMod);
}

export function calculateBaseAC(characterClass: string, dexScore: number, equippedArmorBonus: number = 0): number {
  const dexMod = calculateModifier(dexScore);
  const classKey = characterClass.toLowerCase();

  if (classKey === 'barbarian') {
    // Unarmored defense: 10 + DEX + CON (or base 10 + dex)
    return 10 + dexMod + equippedArmorBonus;
  }
  if (classKey === 'fighter' || classKey === 'paladin') {
    // Chainmail base is 16
    return 16 + equippedArmorBonus;
  }
  return 10 + dexMod + equippedArmorBonus;
}
