import type {
  Biome,
  Companion,
  EquipmentDefinition,
  ShipUpgradeDefinition,
} from './types'

export const biomeInfo: Record<Biome, { name: string; description: string; color: string }> = {
  'open-sea': {
    name: 'Открытое море',
    description: 'Нейтральные воды. Опасность приходит без предупреждения.',
    color: '#66818b',
  },
  storm: {
    name: 'Штормовой пояс',
    description: 'Шквалы чаще повреждают корпус и ломают дух команды.',
    color: '#64738f',
  },
  ashen: {
    name: 'Пепельные острова',
    description: 'Мёртвые берега, где трудно пополнить запасы.',
    color: '#8b8275',
  },
  sacred: {
    name: 'Священные воды',
    description: 'Боги здесь ближе, а пророчества опаснее меча.',
    color: '#a58b58',
  },
  verdant: {
    name: 'Зелёный архипелаг',
    description: 'Плодородные острова снижают расход пищи в пути.',
    color: '#60856e',
  },
  abyssal: {
    name: 'Бездна Нерея',
    description: 'Чёрная вода каждый день подтачивает боевой дух.',
    color: '#526f80',
  },
  volcanic: {
    name: 'Огненная гряда',
    description: 'Жара удваивает жажду и скрывает морские течения.',
    color: '#a2624d',
  },
  civilized: {
    name: 'Земли полисов',
    description: 'Порты, торговцы и слухи со всего Средиземноморья.',
    color: '#a69169',
  },
}

export const equipment: EquipmentDefinition[] = [
  {
    id: 'xiphos-agamemnon',
    name: 'Ксифос Агамемнона',
    description: 'Троянская сталь всё ещё помнит руку царя. +1 к доблести.',
    slot: 'weapon',
    skill: 'valor',
    bonus: 1,
    cost: 32,
    rarity: 'редкий',
  },
  {
    id: 'bow-eurytus',
    name: 'Лук Эврита',
    description: 'Оружие для того, кто побеждает прежде первого удара. +1 к хитрости.',
    slot: 'weapon',
    skill: 'cunning',
    bonus: 1,
    cost: 29,
    rarity: 'редкий',
  },
  {
    id: 'spear-ash',
    name: 'Ясеневое копьё',
    description: 'Простое и надёжное оружие ахейского строя. +1 к доблести.',
    slot: 'weapon',
    skill: 'valor',
    bonus: 1,
    cost: 20,
    rarity: 'обычный',
  },
  {
    id: 'armor-troy',
    name: 'Панцирь из Трои',
    description: 'Потемневшая бронза помогает выдержать взгляд чудовища. +1 к воле.',
    slot: 'armor',
    skill: 'will',
    bonus: 1,
    cost: 26,
    rarity: 'редкий',
  },
  {
    id: 'cloak-pilot',
    name: 'Плащ кормчего',
    description: 'В его подкладку вшиты карты финикийцев. +1 к мореходству.',
    slot: 'armor',
    skill: 'seamanship',
    bonus: 1,
    cost: 24,
    rarity: 'обычный',
  },
  {
    id: 'owl-seal',
    name: 'Печать совы',
    description: 'Серебряный знак безымянной покровительницы. +1 к хитрости.',
    slot: 'talisman',
    skill: 'cunning',
    bonus: 1,
    cost: 28,
    rarity: 'редкий',
  },
  {
    id: 'aeolus-knot',
    name: 'Узел Эола',
    description: 'Ветер шепчет внутри спутанной нити. +1 к мореходству.',
    slot: 'talisman',
    skill: 'seamanship',
    bonus: 1,
    cost: 31,
    rarity: 'легендарный',
  },
  {
    id: 'coin-charon',
    name: 'Обол Харона',
    description: 'Холодная монета укрепляет разум перед лицом смерти. +1 к воле.',
    slot: 'talisman',
    skill: 'will',
    bonus: 1,
    cost: 23,
    rarity: 'редкий',
  },
]

export const shipUpgrades: ShipUpgradeDefinition[] = [
  {
    id: 'reinforced-hull',
    name: 'Бронзовые рёбра',
    description: 'Каждый шторм наносит на 4 единицы меньше урона корпусу.',
    cost: 38,
  },
  {
    id: 'deep-cisterns',
    name: 'Глубокие цистерны',
    description: 'Расход воды во всех морских переходах снижен на 1 в день.',
    cost: 34,
  },
  {
    id: 'broad-sail',
    name: 'Широкий парус',
    description: 'Дальние переходы занимают на один день меньше.',
    cost: 36,
  },
  {
    id: 'gorgon-prow',
    name: 'Нос с Горгоной',
    description: 'Удачный выход из шторма восстанавливает больше морали.',
    cost: 30,
  },
]

export const recruitableCompanions: Companion[] = [
  {
    id: 'tiphys',
    name: 'Тифий',
    role: 'Кормчий аргонавтов',
    trait: 'Читает течения по цвету пены',
    loyalty: 62,
    skill: 'seamanship',
    bonus: 1,
  },
  {
    id: 'sinon',
    name: 'Синон',
    role: 'Лжец из Трои',
    trait: 'Узнаёт ложь, потому что сам живёт ею',
    loyalty: 41,
    skill: 'cunning',
    bonus: 1,
  },
  {
    id: 'idmon',
    name: 'Идмон',
    role: 'Слепой прорицатель',
    trait: 'Слышит мойр во сне',
    loyalty: 55,
    skill: 'will',
    bonus: 1,
  },
]

export const startingCompanion: Companion = {
  id: 'eurylochus',
  name: 'Еврилох',
  role: 'Заместитель царя',
  trait: 'Сдерживает панику среди гребцов',
  loyalty: 68,
  skill: 'valor',
  bonus: 0,
}

export const equipmentSlotLabels = {
  weapon: 'Оружие',
  armor: 'Доспех',
  talisman: 'Талисман',
} as const
