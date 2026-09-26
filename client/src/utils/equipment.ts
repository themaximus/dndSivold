import { InventoryItem, EquipmentSubtype, Character } from '../types';

export interface EquipmentSlotInfo {
  subtype: EquipmentSubtype;
  label: string;
  shortLabel: string;
  microBadge: string;
  slotType: 'weapon' | 'shield' | 'armor' | 'accessory';
  badgeColor: string;
  iconName: 'crosshair' | 'swords' | 'sword' | 'shield' | 'armor' | 'sparkles';
}

const RANGED_REGEX = /(?:лук|арбалет|мушкет|пистоль|пращ|ружь|самострел|дротик|bow|crossbow|musket|sling|dart)/i;
const TWO_HANDED_REGEX = /(?:двуручн|двуручный|клеймор|эспадон|цвайхендер|великая\s+секир|тяжелый\s+молот|секир[аы]\s+предков|алебард|глеф|пик[ае]|полэкс|копье|greatsword|greataxe|halberd|glaive|pike|two[- ]handed)/i;
const SHIELD_REGEX = /(?:щит|баклер|тарч|павез|shield|buckler)/i;
const ARMOR_REGEX = /(?:доспех|латы|кольчуг|кирас|нагрудник|кожанк|куртк|панцир|бригантин|роба|манти|пластинчат.*доспех|armor|cuirass|chainmail|plate)/i;
const ONE_HANDED_REGEX = /(?:меч|клинок|кинжал|рапир|топор|булав|палаш|нож|сабл|шашк|шест|буздыхан|коротк.*меч|палиц|молот|шпаг|моргенштерн|пернач|sword|dagger|rapier|mace|axe|blade)/i;
const ACCESSORY_REGEX = /(?:кольцо|амулет|талисман|ожерелье|пояс|плащ|серьг|ring|amulet|talisman|necklace|cloak)/i;

export function getEquipmentSubtype(
  item: InventoryItem | { name: string; type?: string; subtype?: string; description?: string }
): EquipmentSubtype {
  if (item.subtype && isValidSubtype(item.subtype)) {
    return item.subtype as EquipmentSubtype;
  }

  const name = (item.name || '').toLowerCase().trim();
  const desc = (item.description || '').toLowerCase();
  const type = (item.type || '').toLowerCase();

  // 1. Shield check
  if (SHIELD_REGEX.test(name) || (type === 'armor' && name.includes('щит'))) {
    return 'shield';
  }

  // 2. Armor check
  if (type === 'armor' || ARMOR_REGEX.test(name)) {
    return 'armor';
  }

  // 3. Ranged weapon check
  if (RANGED_REGEX.test(name) || desc.includes('дальнобойн') || desc.includes('дистанци')) {
    return 'ranged';
  }

  // 4. Two-handed weapon check
  if (TWO_HANDED_REGEX.test(name) || desc.includes('двуручн')) {
    return 'two_handed';
  }

  // 5. One-handed weapon / general weapon check
  if (type === 'weapon' || ONE_HANDED_REGEX.test(name)) {
    return 'one_handed';
  }

  // 6. Accessories
  if (ACCESSORY_REGEX.test(name)) {
    return 'accessory';
  }

  // Fallback
  return type === 'armor' ? 'armor' : 'one_handed';
}

function isValidSubtype(val: any): val is EquipmentSubtype {
  return ['ranged', 'two_handed', 'one_handed', 'shield', 'armor', 'accessory'].includes(val);
}

export function getEquipmentInfo(item: InventoryItem): EquipmentSlotInfo {
  const subtype = getEquipmentSubtype(item);

  switch (subtype) {
    case 'ranged':
      return {
        subtype,
        label: 'Дальнобойное оружие',
        shortLabel: 'Дальнобой',
        microBadge: 'ДЛ',
        slotType: 'weapon',
        badgeColor: 'border-sky-500/60 bg-sky-950/60 text-sky-300 hover:border-sky-400',
        iconName: 'crosshair',
      };
    case 'two_handed':
      return {
        subtype,
        label: 'Двуручный меч / оружие',
        shortLabel: 'Двуручн.',
        microBadge: '2Р',
        slotType: 'weapon',
        badgeColor: 'border-orange-500/60 bg-orange-950/60 text-orange-300 hover:border-orange-400',
        iconName: 'swords',
      };
    case 'one_handed':
      return {
        subtype,
        label: 'Одноручный меч / оружие',
        shortLabel: 'Одноручн.',
        microBadge: '1Р',
        slotType: 'weapon',
        badgeColor: 'border-amber-500/60 bg-amber-950/60 text-amber-300 hover:border-amber-400',
        iconName: 'sword',
      };
    case 'shield':
      return {
        subtype,
        label: 'Щит',
        shortLabel: 'Щит',
        microBadge: 'ЩТ',
        slotType: 'shield',
        badgeColor: 'border-blue-500/60 bg-blue-950/60 text-blue-300 hover:border-blue-400',
        iconName: 'shield',
      };
    case 'armor':
      return {
        subtype,
        label: 'Доспех / Броня',
        shortLabel: 'Доспех',
        microBadge: 'БР',
        slotType: 'armor',
        badgeColor: 'border-emerald-500/60 bg-emerald-950/60 text-emerald-300 hover:border-emerald-400',
        iconName: 'armor',
      };
    case 'accessory':
      return {
        subtype,
        label: 'Аксессуар',
        shortLabel: 'Аксессуар',
        microBadge: 'АК',
        slotType: 'accessory',
        badgeColor: 'border-purple-500/60 bg-purple-950/60 text-purple-300 hover:border-purple-400',
        iconName: 'sparkles',
      };
  }
}

export interface EquippedItemEntry {
  slot: 'weapon' | 'shield' | 'armor';
  item: InventoryItem;
  info: EquipmentSlotInfo;
}

export function getCharacterEquippedItems(character?: Character | null): EquippedItemEntry[] {
  if (!character || !Array.isArray(character.inventory)) return [];

  const equipped: EquippedItemEntry[] = [];

  // Active Weapon
  if (character.activeWeaponId) {
    const item = character.inventory.find(i => i.id === character.activeWeaponId);
    if (item) {
      equipped.push({
        slot: 'weapon',
        item,
        info: getEquipmentInfo(item),
      });
    }
  }

  // Active Shield
  if (character.activeShieldId) {
    const item = character.inventory.find(i => i.id === character.activeShieldId);
    if (item) {
      equipped.push({
        slot: 'shield',
        item,
        info: getEquipmentInfo(item),
      });
    }
  }

  // Active Armor
  if (character.activeArmorId) {
    const item = character.inventory.find(i => i.id === character.activeArmorId);
    if (item) {
      equipped.push({
        slot: 'armor',
        item,
        info: getEquipmentInfo(item),
      });
    }
  }

  return equipped;
}
