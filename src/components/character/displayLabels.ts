export type AbilityKey = 'str' | 'dex' | 'con' | 'int' | 'wis' | 'cha';

export const ABILITY_LABELS: Record<AbilityKey, string> = {
  str: 'Сила',
  dex: 'Ловкость',
  con: 'Телосложение',
  int: 'Интеллект',
  wis: 'Мудрость',
  cha: 'Харизма',
};

export const ABILITY_SHORT_LABELS: Record<AbilityKey, string> = {
  str: 'СИЛ',
  dex: 'ЛОВ',
  con: 'ТЕЛ',
  int: 'ИНТ',
  wis: 'МДР',
  cha: 'ХАР',
};

const ABILITY_ALIASES: Record<string, AbilityKey> = {
  str: 'str',
  strength: 'str',
  dex: 'dex',
  dexterity: 'dex',
  con: 'con',
  constitution: 'con',
  int: 'int',
  intelligence: 'int',
  wis: 'wis',
  wisdom: 'wis',
  cha: 'cha',
  charisma: 'cha',
};

const RACE_LABELS: Record<string, string> = {
  human: 'Человек',
  elf: 'Эльф',
  dwarf: 'Дварф',
  halfling: 'Халфлинг',
  dragonborn: 'Драконорожденный',
  gnome: 'Гном',
  halfelf: 'Полуэльф',
  halforc: 'Полуорк',
  tiefling: 'Тифлинг',
  hobbit: 'Хоббит',
  goliath: 'Голиаф',
  aasimar: 'Аасимар',
  tabaxi: 'Табакси',
  kenku: 'Кенку',
  other: 'Другая',
};

const CLASS_LABELS: Record<string, string> = {
  fighter: 'Воин',
  wizard: 'Волшебник',
  rogue: 'Плут',
  cleric: 'Жрец',
  ranger: 'Следопыт',
  paladin: 'Паладин',
  barbarian: 'Варвар',
  druid: 'Друид',
  bard: 'Бард',
  monk: 'Монах',
  sorcerer: 'Чародей',
  warlock: 'Колдун',
  artificer: 'Изобретатель',
  other: 'Другой',
};

const TRAIT_LABELS: Record<string, string> = {
  versatile: 'Универсальность',
  extralanguage: 'Дополнительный язык',
  extraskill: 'Дополнительный навык',
  darkvision: 'Темное зрение',
  feyancestry: 'Фейское происхождение',
  trance: 'Транс',
  dwarvenresilience: 'Дварфская стойкость',
  stonecunning: 'Знание камня',
  lucky: 'Удачливость',
  brave: 'Храбрость',
  nimbleness: 'Проворство',
  breathweapon: 'Дыхательное оружие',
  damageresistance: 'Сопротивление урону',
  gnomecunning: 'Гномья хитрость',
  skillversatility: 'Универсальность навыков',
  relentlessendurance: 'Неумолимая стойкость',
  savageattacks: 'Свирепые атаки',
  hellishresistance: 'Инфернальная стойкость',
  infernallegacy: 'Инфернальное наследие',
  halflingnimbleness: 'Проворство халфлинга',
  secondbreakfast: 'Второй завтрак',
};

const CONDITION_LABELS: Record<string, string> = {
  blinded: 'Ослеплен',
  charmed: 'Очарован',
  deafened: 'Оглох',
  frightened: 'Испуган',
  grappled: 'Схвачен',
  incapacitated: 'Недееспособен',
  invisible: 'Невидим',
  paralyzed: 'Парализован',
  petrified: 'Окаменел',
  poisoned: 'Отравлен',
  prone: 'Сбит с ног',
  restrained: 'Опутан',
  stunned: 'Ошеломлен',
  unconscious: 'Без сознания',
  exhaustion: 'Истощение',
  blessed: 'Благословлен',
  hasted: 'Ускорен',
  concentrating: 'Концентрация',
  flying: 'Полет',
  hidden: 'Скрыт',
};

const normalizeDisplayKey = (value: string) => value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '');

export const getRaceLabel = (race: string | null | undefined): string => {
  if (!race) return '';
  return RACE_LABELS[normalizeDisplayKey(race)] ?? race;
};

export const getClassLabel = (characterClass: string | null | undefined): string => {
  if (!characterClass) return '';
  return CLASS_LABELS[normalizeDisplayKey(characterClass)] ?? characterClass;
};

export const getTraitLabel = (trait: string | null | undefined): string => {
  if (!trait) return '';
  return TRAIT_LABELS[normalizeDisplayKey(trait)] ?? trait;
};

export const getConditionLabel = (condition: string | null | undefined): string => {
  if (!condition) return '';
  return CONDITION_LABELS[normalizeDisplayKey(condition)] ?? condition;
};

export const getAbilityLabel = (ability: string | null | undefined): string => {
  if (!ability) return '';
  const key = ABILITY_ALIASES[normalizeDisplayKey(ability)];
  return key ? ABILITY_LABELS[key] : ability;
};

export const getAbilityShortLabel = (ability: string | null | undefined): string => {
  if (!ability) return '';
  const key = ABILITY_ALIASES[normalizeDisplayKey(ability)];
  return key ? ABILITY_SHORT_LABELS[key] : ability;
};

export { getItemLabel } from '../../utils/itemDisplayLabels';
