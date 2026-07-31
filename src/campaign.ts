import type {
  BossAction,
  Effects,
  EndingSummary,
  GodId,
  MetaState,
  ProphecyState,
} from './types'

export interface BossIntent {
  id: string
  title: string
  description: string
  effects: Effects
}

export interface BossDefinition {
  id: string
  name: string
  epithet: string
  description: string
  quote: string
  maxHealth: number
  rewardXp: number
  rewardCoins: number
  god: GodId
  intents: BossIntent[]
  actions: BossAction[]
}

export interface LegacyBoon {
  id: string
  name: string
  description: string
  cost: number
  category: 'Одиссей' | 'Корабль' | 'Команда' | 'Судьба'
}

export const acts = [
  {
    number: 1 as const,
    name: 'Пепел за кормой',
    short: 'Пепел Трои',
    description: 'Люди ещё верят, что война закончилась. Море знает лучше.',
  },
  {
    number: 2 as const,
    name: 'Война с морем',
    short: 'Гнев богов',
    description: 'Каждый новый берег требует жертву, а Посейдон перестаёт скрывать лицо.',
  },
  {
    number: 3 as const,
    name: 'Царь без дома',
    short: 'Тень Итаки',
    description: 'Дом уже близко. Теперь нужно решить, какой человек имеет право вернуться.',
  },
]

export const godInfo: Record<GodId, { name: string; symbol: string; title: string }> = {
  athena: { name: 'Афина', symbol: 'Α', title: 'Владычица мудрости' },
  poseidon: { name: 'Посейдон', symbol: 'Ψ', title: 'Земледержец' },
  hermes: { name: 'Гермес', symbol: 'Η', title: 'Проводник путников' },
  hades: { name: 'Аид', symbol: 'Η', title: 'Хозяин теней' },
}

export const prophecies: ProphecyState[] = [
  {
    id: 'many-oars',
    title: 'Пророчество многих вёсел',
    text: '«Дом увидит царь, за чьей спиной останется не меньше четырнадцати живых теней.»',
    hint: 'Вернитесь на Итаку с командой из 14 или более человек.',
    fulfilled: false,
  },
  {
    id: 'nobody-thrice',
    title: 'Три имени Никто',
    text: '«Трижды ложь станет щитом, и сова назовёт лжеца мудрецом.»',
    hint: 'Добейтесь как минимум трёх успехов с помощью хитрости.',
    fulfilled: false,
  },
  {
    id: 'unbroken-keel',
    title: 'Киль против бога',
    text: '«Разящий море вернётся на целом корабле, и трезубец треснет от стыда.»',
    hint: 'Одолейте обоих стражей и сохраните не менее 65 прочности корпуса.',
    fulfilled: false,
  },
  {
    id: 'empty-crown',
    title: 'Пустая корона',
    text: '«Царь отдаст золото морю и станет богаче всех живых.»',
    hint: 'Доберитесь домой, потратив почти все драхмы, но сохранив высокий дух команды.',
    fulfilled: false,
  },
]

export const bosses: BossDefinition[] = [
  {
    id: 'scylla',
    name: 'Скилла',
    epithet: 'Шесть голодных пастей',
    description:
      'Скала раскрывает глаза. Шесть длинных шей поднимаются из пещер, пока щупальца обвивают чёрный корабль. Харибда уже начинает первый вдох.',
    quote: '«Можно спасти корабль. Нельзя спасти каждого.»',
    maxHealth: 92,
    rewardXp: 95,
    rewardCoins: 28,
    god: 'poseidon',
    intents: [
      { id: 'snatch', title: 'Голодная голова', description: 'Скилла целится в гребцов левого борта.', effects: { crew: -2, morale: -5 } },
      { id: 'crush', title: 'Каменные щупальца', description: 'Чудовище собирается сдавить корпус о скалу.', effects: { hull: -15 } },
      { id: 'shriek', title: 'Шесть голосов', description: 'Крик должен сломить волю всей команды.', effects: { morale: -12, health: -4 } },
    ],
    actions: [
      {
        id: 'scylla-blade',
        title: 'Взобраться на шею с клинком',
        description: 'Опасный прямой удар. Наносит большой урон, но плохо защищает корабль.',
        skill: 'valor',
        difficulty: 6,
        damage: 31,
        cost: { health: -4 },
        mitigation: 0.18,
      },
      {
        id: 'scylla-decoy',
        title: 'Поднять ложную добычу',
        description: 'Направить головы друг против друга с помощью парусов и козьей крови.',
        skill: 'cunning',
        difficulty: 5,
        damage: 22,
        cost: { food: -3 },
        mitigation: 0.66,
      },
      {
        id: 'scylla-current',
        title: 'Оседлать отлив Харибды',
        description: 'Ударить бортом в скалу и использовать волну как оружие.',
        skill: 'seamanship',
        difficulty: 6,
        damage: 27,
        cost: { hull: -3 },
        mitigation: 0.52,
      },
      {
        id: 'scylla-name',
        title: 'Назвать её смертное имя',
        description: 'Вспомнить урок Кирки и заставить нимфу внутри чудовища услышать себя.',
        skill: 'will',
        difficulty: 7,
        damage: 38,
        cost: { morale: -4 },
        mitigation: 0.35,
      },
    ],
  },
  {
    id: 'poseidon-avatar',
    name: 'Энкелад Морской',
    epithet: 'Десница Посейдона',
    description:
      'Из моря поднимается воин величиной с башню. В его пустом шлеме вращается шторм, а трезубец пронзает воду до самого Тартара. Итака видна между его ног.',
    quote: '«Ты ослепил сына моря. Теперь море ослепит твой дом.»',
    maxHealth: 148,
    rewardXp: 160,
    rewardCoins: 45,
    god: 'poseidon',
    intents: [
      { id: 'trident', title: 'Падение трезубца', description: 'Удар расколет палубу и всё под ней.', effects: { hull: -18, health: -5 } },
      { id: 'drowning', title: 'Вода в лёгких', description: 'Бог заставит людей вспомнить собственную смерть.', effects: { morale: -14 } },
      { id: 'undertow', title: 'Обратное течение', description: 'Волна метит корму и слабых гребцов.', effects: { crew: -2, hull: -9 } },
      { id: 'blind-sea', title: 'Слепой горизонт', description: 'Шторм скроет звёзды и голос кормчего.', effects: { water: -5, morale: -7 } },
    ],
    actions: [
      {
        id: 'avatar-ram',
        title: 'Таранить колено исполина',
        description: 'Собрать всех гребцов в один удар бронзовым носом.',
        skill: 'seamanship',
        difficulty: 7,
        damage: 36,
        cost: { hull: -5 },
        mitigation: 0.46,
      },
      {
        id: 'avatar-eye',
        title: 'Метнуть копьё в пустой шлем',
        description: 'Повторить удар, который начал гнев Посейдона.',
        skill: 'valor',
        difficulty: 8,
        damage: 43,
        cost: { health: -5 },
        mitigation: 0.2,
      },
      {
        id: 'avatar-oath',
        title: 'Предложить невозможную клятву',
        description: 'Заставить божественную десницу остановиться и выслушать ложь царя.',
        skill: 'cunning',
        difficulty: 7,
        damage: 30,
        cost: { morale: -4 },
        mitigation: 0.72,
      },
      {
        id: 'avatar-defy',
        title: 'Отречься от страха перед богами',
        description: 'Превратить веру команды в оружие против воплощённого шторма.',
        skill: 'will',
        difficulty: 8,
        damage: 48,
        cost: { morale: -7 },
        mitigation: 0.35,
      },
    ],
  },
]

export const legacyBoons: LegacyBoon[] = [
  {
    id: 'owl-memory',
    name: 'Память серой совы',
    description: 'Каждый новый Одиссей начинает путь с +1 к хитрости.',
    cost: 20,
    category: 'Одиссей',
  },
  {
    id: 'scarred-king',
    name: 'Шрамы десяти лет',
    description: 'Начальное здоровье увеличено на 12.',
    cost: 24,
    category: 'Одиссей',
  },
  {
    id: 'hardened-keel',
    name: 'Киль из памяти',
    description: 'Корабль начинает экспедицию с полной прочностью.',
    cost: 28,
    category: 'Корабль',
  },
  {
    id: 'sacred-casks',
    name: 'Священные амфоры',
    description: 'В начале пути на 10 больше пищи и воды.',
    cost: 30,
    category: 'Корабль',
  },
  {
    id: 'veteran-oars',
    name: 'Вёсла ветеранов',
    description: 'Два опытных гребца и +8 боевого духа в каждом походе.',
    cost: 34,
    category: 'Команда',
  },
  {
    id: 'hermes-purse',
    name: 'Кошель Гермеса',
    description: 'Начальный запас драхм увеличен на 18.',
    cost: 36,
    category: 'Судьба',
  },
  {
    id: 'thread-of-moira',
    name: 'Нить младшей мойры',
    description: 'Все проверки получают постоянные +4% к шансу успеха.',
    cost: 45,
    category: 'Судьба',
  },
  {
    id: 'black-sail-legend',
    name: 'Легенда чёрного паруса',
    description: 'Успешные решения приносят на 20% больше опыта.',
    cost: 50,
    category: 'Судьба',
  },
]

export const endings: Record<string, EndingSummary> = {
  divine: {
    id: 'divine',
    title: 'Царь под крылом совы',
    subtitle: 'Божественная концовка',
    text: 'Афина снимает морок с Итаки. Одиссей входит во дворец не завоевателем, а судьёй, и даже Посейдон вынужден признать завершённую песнь.',
    rank: 'божественный',
  },
  hero: {
    id: 'hero',
    title: 'Все вёсла возвращаются домой',
    subtitle: 'Героическая концовка',
    text: 'Чёрный корабль входит в гавань под голос множества гребцов. Итака видит царя, который сохранил людей, а не только собственное имя.',
    rank: 'героический',
  },
  shadow: {
    id: 'shadow',
    title: 'Царь по имени Никто',
    subtitle: 'Тайная концовка',
    text: 'Одиссей возвращается ночью и побеждает ещё до того, как женихи понимают, кто вошёл во дворец. Итакой правит не герой, а совершенная ложь.',
    rank: 'тайный',
  },
  hollow: {
    id: 'hollow',
    title: 'Пустая корона',
    subtitle: 'Мрачная концовка',
    text: 'Берег достигнут, но никто не поёт. Царь вернулся с короной, кораблём и тишиной тех, кого оставил морю.',
    rank: 'мрачный',
  },
}

export function normalizeMeta(value: Partial<MetaState> | null | undefined): MetaState {
  return {
    voyages: value?.voyages ?? 0,
    bestDistance: value?.bestDistance ?? 0,
    kleos: value?.kleos ?? 0,
    legacy: value?.legacy ?? [],
    endings: value?.endings ?? [],
    prophecies: value?.prophecies ?? [],
    codex: value?.codex ?? [],
    history: value?.history ?? [],
    achievements: value?.achievements ?? [],
  }
}
