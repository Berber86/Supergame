import {
  makeLizard,
  LIZARD_COATS,
  LIZARD_STRIDE,
  LIZARD_STRIKE_MS,
  LIZARD_EMERGE_MS,
  lizardSpeed,
  type Lizard,
  type LizardState,
} from '../world/lizards';
import { drawLizard } from '../render/lizard';
import { CAT_STRIDE, mouseSpeed, MOUSE_STRIDE } from '../world/creatureMotion';
import { HERON_STRIKE_MS } from '../world/wildlifeMotion';
/** The field guide uses isolated specimens, never live agents or the player's save. */
import type { Cat, Bird, BirdSpecies, Fish, Flutter } from '../world/life';
import type { Frog, PondDragonfly } from '../world/residents';
import type { Deer, Turtle, Heron, Hedgehog, Mouse, Owl, Squirrel, Bee, Firefly, Moth } from '../world/wildlife';
import type { Atmosphere } from '../world/palette';
import type { Ctx } from '../render/paint';
import { drawCat, drawBird, drawButterfly, drawFishAt } from '../render/creatures';
import { drawFrog, drawDragonfly } from '../render/residents';
import {
  drawDeer,
  drawTurtle,
  drawHeron,
  drawHedgehog,
  drawMouse,
  drawOwl,
  drawSquirrel,
  drawBee,
  drawFirefly,
  drawMoth,
} from '../render/wildlife';

export interface GuideAnimation {
  id: string;
  name: string;
  duration: number;
}
export interface GuideObservation {
  event: string;
  cue: string;
  alt: string;
}
export interface GuideAnimal {
  id: string;
  name: string;
  latin: string;
  group: 'Пресмыкающиеся' | 'Звери' | 'Птицы' | 'У воды' | 'Насекомые';
  description: string;
  habitat: string;
  scale: number;
  baseline: number;
  /** Recenter asymmetric silhouettes (a long tail) without moving the garden's anchor. */
  offsetX?: number;
  facts?: { label: string; value: string }[];
  observations?: GuideObservation[];
  /** Камера отъезжает, чтобы распахнутые крылья помещались на странице. */
  flightScale?: number;
  water?: boolean;
  night?: boolean;
  variants?: string[];
  animations: GuideAnimation[];
  draw(ctx: Ctx, atm: Atmosphere, state: string, time: number, variant: number): void;
}

type Meta = Omit<GuideAnimal, 'draw' | 'animations'>;
const base = {
  tx: 0,
  ty: 0,
  facing: 1 as const,
  seed: 42,
  phase: 0,
  timer: 4000,
  from: null,
  target: null,
  born: 0,
  stay: 100000,
};
const durations: Record<string, number> = {
  hop: 1400,
  jump: 1800,
  strike: HERON_STRIKE_MS,
  cache: 3200,
  dive: 2200,
  emerge: 2200,
  stretch: 3500,
};
export function animationDuration(state: string): number {
  return durations[state] ?? 5000;
}
function phase(time: number, state: string): number {
  return (time % animationDuration(state)) / animationDuration(state);
}
const wave = (t: number, rate = 0.003) => (Math.sin(t * rate) + 1) / 2;

/** Record<T['state'], ...> forces every simulation state to have a page control. */
function animal<T extends { state: string }>(
  meta: Meta,
  states: Record<T['state'], string>,
  specimen: (state: T['state'], time: number, variant: number) => T,
  render: (ctx: Ctx, a: T, x: number, y: number, atm: Atmosphere, time: number) => void,
  duration: (state: T['state']) => number = animationDuration,
): GuideAnimal {
  return {
    ...meta,
    animations: Object.entries<string>(states).map(([id, name]) => ({ id, name, duration: duration(id) })),
    draw(ctx, atm, state, time, variant) {
      if (!Object.prototype.hasOwnProperty.call(states, state)) return;
      const p = (time % duration(state)) / duration(state);
      // Small local trajectories keep flight, approach and retreat visible on the page.
      const travel = ['enter', 'leave', 'arrive', 'fly-in', 'fly-out', 'approach', 'return'].includes(state);
      const offset = travel ? Math.sin((p - 0.5) * Math.PI) * 9 : 0;
      const zoom =
        state === 'fly-in' || state === 'fly-out' || (meta.id === 'owl' && (state === 'look' || state === 'hunt'))
          ? (meta.flightScale ?? 1)
          : 1;
      ctx.save();
      ctx.scale(zoom, zoom);
      render(ctx, specimen(state as T['state'], time, variant), offset + (meta.offsetX ?? 0), 0, atm, time);
      ctx.restore();
    },
  };
}

const cat = animal<Cat>(
  {
    id: 'cat',
    name: 'Кот',
    latin: 'Felis catus',
    group: 'Звери',
    scale: 4.2,
    baseline: 0.74,
    description: 'Хранитель тёплой веранды. Спит, умывается, потягивается и неторопливо обходит сад.',
    habitat: 'Подушка и миска делают усадьбу уютнее для котов. Гость может остаться жить в саду.',
    facts: [
      {
        label: 'Тихая компания',
        value:
          'Два спокойных кота иногда сближаются, обнюхиваются и отдыхают рядом. Это случается и с гостем, и с домашними соседями; во время дождя знакомство откладывается.',
      },
    ],
    variants: ['Кремовый', 'Серый', 'Чёрный', 'Черепаховый'],
  },
  { sit: 'Сидит', sleep: 'Спит', loaf: 'Поджимает лапы', wash: 'Умывается', stretch: 'Потягивается', walk: 'Идёт' },
  (state, time, variant) => ({
    ...base,
    state,
    id: 1,
    phase: phase(time, state),
    speed: 1,
    gait: ((time * 0.0013) / CAT_STRIDE) * Math.PI * 2,
    actionTime: time % animationDuration(state),
    actionDuration: animationDuration(state),
    home: null,
    guest: false,
    coat: (['cream', 'grey', 'black', 'tortoise'] as const)[variant % 4],
    greet: 0,
    leaveAt: 0,
    stayAt: 0,
  }),
  drawCat,
);

const birdStates: Record<Bird['state'], string> = {
  perch: 'На насесте',
  'fly-in': 'Прилетает',
  hop: 'Прыгает',
  peck: 'Клюёт',
  feed: 'У кормушки',
  drink: 'Пьёт',
  bathe: 'Купается',
  'fly-out': 'Улетает',
};
const birds = (['sparrow', 'tit', 'finch', 'wagtail', 'bullfinch'] as BirdSpecies[]).map((species, i) =>
  animal<Bird>(
    {
      id: species,
      name: ['Воробей', 'Синица', 'Зяблик', 'Трясогузка', 'Снегирь'][i],
      latin: ['Passer', 'Parus', 'Fringilla', 'Motacilla', 'Pyrrhula'][i],
      group: 'Птицы',
      scale: 9,
      baseline: 0.72,
      description: [
        'Маленький сосед с землистой спинкой. Передвигается короткими прыжками и охотно прилетает к кормушке.',
        'Жёлтое брюшко и тёмная шапочка заметны даже среди густых ветвей.',
        'Нарядная птица сада: отдыхает на насесте, ищет зёрна и купается в поилке.',
        'Длинный хвост мерно покачивается, пока птица осматривает берег.',
        'Красная грудка оживляет зимний сад. У кормушки снегирь особенно заметен.',
      ][i],
      habitat: 'Поставьте кормушку и поилку, оставьте деревья для отдыха. Состав стаи зависит от сезона.',
      facts: [
        {
          label: 'Место у воды',
          value:
            'Тёплым днём птицы купаются по очереди: одна ждёт на кромке, пока другая в чаше. Выкупавшись, птица уступает воду и встряхивает крылья. Приближение кота прерывает купание.',
        },
      ],
    },
    birdStates,
    (state, time) => ({
      ...base,
      state,
      species,
      alt: state.startsWith('fly') ? 5 : 0,
      hop: time * 0.007,
      scale: 1,
      place: state === 'feed' ? 'feeder' : 'ground',
      slot: 0,
    }),
    drawBird,
  ),
);

const deer = animal<Deer>(
  {
    id: 'deer',
    name: 'Олень',
    latin: 'Cervus nippon',
    group: 'Звери',
    scale: 3.9,
    baseline: 0.84,
    description:
      'Тихий гость рощи. Стройные ноги несут его мягким шагом; чуткие уши ловят шорохи, а голова плавно склоняется к траве.',
    habitat: 'Любит поляны у деревьев. Чаще выходит на рассвете и в сумерках; близость кота заставляет его уйти.',
    facts: [
      {
        label: 'Приветствие в роще',
        value:
          'В большой роще иногда встречаются два оленя. На свободной поляне они могут подойти друг к другу и ненадолго коснуться носами. Испуг или конец визита важнее этой встречи.',
      },
    ],
    variants: ['Летний · с рогами', 'Пятнистый · без рогов', 'Осенний', 'Зимний'],
  },
  { look: 'Прислушивается', enter: 'Выходит из рощи', walk: 'Идёт', graze: 'Пасётся', leave: 'Убегает' },
  (state, time, variant) => ({
    ...base,
    state,
    phase: phase(time, state),
    gait: time * (state === 'leave' ? 0.0079 : 0.0037),
    headLower: state === 'graze' ? Math.min(1, time / 1300) : 0,
    coat: { spots: variant < 2, antlers: variant === 0 || variant === 2, winter: variant === 3 },
  }),
  drawDeer,
);

const lizardDuration = (state: LizardState): number =>
  state === 'strike' ? LIZARD_STRIKE_MS : state === 'emerge' ? LIZARD_EMERGE_MS : animationDuration(state);

const lizard = animal<Lizard>(
  {
    id: 'lizard',
    name: 'Ящерица',
    latin: 'Plestiodon · японский сцинк',
    group: 'Пресмыкающиеся',
    scale: 8,
    baseline: 0.58,
    offsetX: 9,
    description:
      'Маленький хранитель тёплых камней. По гладкой чешуе бегут золотистые линии; длинный хвост мягко повторяет каждый шаг. Взрослые носят цвета земли, а молодую ящерицу выдаёт яркий синий хвост.',
    habitat:
      'Оставьте камень на солнце и укрытие рядом: щель, куст или пучок травы. Пруд не нужен. В полуденную жару сцинк ищет тень; ночью, зимой и под дождём прячется. Уступает занятый камень черепахе и соседям.',
    facts: [
      { label: 'Сезон', value: 'Поздняя весна — ранняя осень' },
      { label: 'Время', value: '08–18 ч · сухая погода' },
      { label: 'Пища', value: 'Мелкие насекомые' },
    ],
    observations: [
      {
        event: 'meet_lizard',
        cue: 'Первая встреча в сухом уголке сада. Солнечные камни и соседние укрытия приглашают гостью.',
        alt: 'Молодой полосатый сцинк с длинным синим хвостом на светлом садовом камне.',
      },
      {
        event: 'lizard_bask',
        cue: 'Дайте ящерице спокойно прогреться на открытом солнцу камне. Бока тихо дышат, лапы расслаблены.',
        alt: 'Бронзовая взрослая ящерица отдыхает на камне в полосе золотистого солнечного света.',
      },
      {
        event: 'lizard_hunt',
        cue: 'После осторожного сближения — короткий бросок. Ловит мелкую добычу в траве, иногда присевшую бабочку; улетевшую не преследует.',
        alt: 'Синехвостый сцинк бросается к маленькому насекомому среди низкой травы.',
      },
      {
        event: 'cat_lizard',
        cue: 'Кот замечает гостью и подкрадывается. Ящерица настораживается; впереди всегда должно быть укрытие.',
        alt: 'Любопытный полосатый кот осторожно подходит к ящерице на камне.',
      },
      {
        event: 'lizard_escape',
        cue: 'При близкой опасности ящерица удирает в щель. Веха появляется, только когда она добралась до укрытия — не за обычный уход на ночь.',
        alt: 'Ящерица скрывается в щели между камнями; снаружи ещё виден изогнутый синий хвост.',
      },
    ],
    variants: LIZARD_COATS,
  },
  {
    bask: 'Греется и дышит',
    emerge: 'Выходит из укрытия',
    look: 'Оглядывается',
    walk: 'Перебегает',
    hunt: 'Подкрадывается',
    strike: 'Ловит насекомое',
    flee: 'Удирает',
    hide: 'Прячется',
    leave: 'Уходит на покой',
  },
  (state, time, variant) => {
    const duration = lizardDuration(state),
      p = (time % duration) / duration,
      a = makeLizard(40 + variant, { x: 0, y: 0 });
    return {
      ...a,
      state,
      alpha:
        state === 'hide'
          ? Math.max(0.03, 1 - p)
          : state === 'emerge'
            ? Math.min(1, p * 3)
            : state === 'leave'
              ? 1 - p * 0.85
              : 1,
      gait: ((time * lizardSpeed(state)) / LIZARD_STRIDE) * Math.PI * 2,
      motion: lizardSpeed(state) ? 1 : 0,
      timer: (1 - p) * duration,
      duration,
    };
  },
  drawLizard,
  lizardDuration,
);

const turtle = animal<Turtle>(
  {
    id: 'turtle',
    name: 'Черепаха',
    latin: 'Testudines',
    group: 'У воды',
    scale: 9,
    baseline: 0.64,
    description:
      'Никуда не спешит. Четыре лапы по очереди подхватывают тяжёлый панцирь, а в воде превращают шаг в плавный гребок.',
    habitat: 'Камни у пруда — любимое место для отдыха. При приближении кота втягивает голову и лапы под панцирь.',
  },
  {
    bask: 'Греется',
    enter: 'Приходит',
    walk: 'Идёт',
    swim: 'Плывёт',
    hide: 'Прячется и выглядывает',
    look: 'Осматривается',
    leave: 'Уходит',
  },
  (state, time) => ({
    ...base,
    state,
    phase: phase(time, state),
    hide: state === 'hide' ? 4000 : 0,
    gait: time * (state === 'swim' ? 0.0039 : 0.0034),
    retract: state === 'hide' ? Math.min(1, Math.max(0, Math.sin(phase(time, state) * Math.PI) * 1.6)) : 0,
  }),
  drawTurtle,
);

const heron = animal<Heron>(
  {
    id: 'heron',
    name: 'Цапля',
    latin: 'Ardea',
    group: 'Птицы',
    scale: 4.1,
    baseline: 0.85,
    flightScale: 0.6,
    description:
      'Поднимает длинные ноги над водой и замирает перед броском. S-образная шея распрямляется к добыче, а в полёте складывается между широкими перьевыми крыльями.',
    habitat: 'Выбирает большой пруд с тихим берегом.',
  },
  {
    stand: 'Стоит',
    'fly-in': 'Прилетает',
    stalk: 'Крадётся',
    strike: 'Ловит рыбу',
    preen: 'Чистит перья',
    'fly-out': 'Улетает',
  },
  (state, time) => ({
    ...base,
    state,
    phase: phase(time, state),
    timer: state === 'strike' ? HERON_STRIKE_MS * (1 - phase(time, state)) : 4000,
    fish: state === 'strike' && phase(time, state) > 0.45 ? 1 : 0,
    struck: false,
  }),
  drawHeron,
);

const hedgehog = animal<Hedgehog>(
  {
    id: 'hedgehog',
    name: 'Ёжик',
    latin: 'Erinaceus',
    group: 'Звери',
    scale: 9,
    baseline: 0.66,
    description:
      'Тихо семенит на коротких лапах, шевелит носом и разгребает листву. При опасности прячет мордочку и лапы в плотную шубку из коротких иголок.',
    habitat: 'Кусты и тихие места, преимущественно ночью.',
  },
  {
    sniff: 'Принюхивается',
    enter: 'Приходит',
    walk: 'Идёт',
    forage: 'Ищет корм',
    curl: 'Сворачивается и раскрывается',
    leave: 'Уходит',
  },
  (state, time) => ({
    ...base,
    state,
    phase: phase(time, state),
    curl: state === 'curl' ? 4000 : 0,
    roll: state === 'curl' ? Math.min(1, Math.max(0, Math.sin(phase(time, state) * Math.PI) * 1.6)) : 0,
  }),
  drawHedgehog,
);

const mouse = animal<Mouse>(
  {
    id: 'mouse',
    name: 'Мышка',
    latin: 'Muridae',
    group: 'Звери',
    scale: 10,
    baseline: 0.62,
    description:
      'Быстрый носик, круглые ушки и длинный хвост. Между поиском зёрен и бегством всегда остаётся мгновение тишины.',
    habitat: 'Кормушки, камни и укрытия у дома. Опасается котов и сов.',
  },
  { forage: 'Ищет зёрна', enter: 'Приходит', walk: 'Бежит', hide: 'Прячется', flee: 'Спасается', leave: 'Уходит' },
  (state, time) => ({
    ...base,
    state,
    phase: phase(time, state),
    gait: ((time * mouseSpeed(state)) / MOUSE_STRIDE) * Math.PI * 2,
    cover: state === 'hide' ? 1 : 0,
    panicX: 0,
    panicY: 0,
    panic: state === 'flee' ? 1 : 0,
  }),
  drawMouse,
);

const owl = animal<Owl>(
  {
    id: 'owl',
    name: 'Сова',
    latin: 'Strigiformes',
    group: 'Птицы',
    scale: 3.8,
    baseline: 0.91,
    flightScale: 0.8,
    description: 'Ночной дозорный. Поворачивает голову на насесте, ухает и бесшумно срывается на охоту.',
    habitat: 'Высокие деревья и насесты; активна по ночам.',
  },
  {
    perch: 'На насесте',
    'fly-in': 'Прилетает',
    hoot: 'Ухает',
    look: 'Перелетает',
    hunt: 'Охотится',
    'fly-out': 'Улетает',
  },
  (state, time) => ({
    ...base,
    state,
    phase: phase(time, state),
    huntX: 0,
    huntY: 0,
    hoot: state === 'hoot' ? 1000 : 0,
  }),
  drawOwl,
);

const squirrel = animal<Squirrel>(
  {
    id: 'squirrel',
    name: 'Белка',
    latin: 'Sciurus',
    group: 'Звери',
    scale: 6.3,
    baseline: 0.8,
    description:
      'Пышный хвост выгибается следом за прыжком. На земле белка встаёт столбиком, держит орешек в передних лапах или закапывает его быстрыми движениями.',
    habitat: 'Деревья и бельчатники; чаще приходит днём.',
  },
  {
    look: 'Осматривается',
    enter: 'Приходит',
    jump: 'Прыгает',
    forage: 'Ищет орехи',
    cache: 'Прячет орех',
    flee: 'Спасается',
    leave: 'Уходит',
  },
  (state, time) => ({
    ...base,
    state,
    phase: phase(time, state),
    hasNut: state === 'cache' || state === 'forage',
    actionTime: time % animationDuration(state),
    actionDuration: animationDuration(state),
    panic: state === 'flee' ? 1 : 0,
  }),
  drawSquirrel,
);

const frogs = (['green', 'brown'] as const).map((species, i) =>
  animal<Frog>(
    {
      id: `frog-${species}`,
      name: i ? 'Бурая лягушка' : 'Зелёная лягушка',
      latin: 'Anura',
      group: 'У воды',
      scale: 10,
      baseline: 0.66,
      description: 'Сидит у самой кромки воды. При пении раздувает горло, прыгает с берега и исчезает под водой.',
      habitat: 'Пруд и растения у берега. Любит влажную погоду.',
    },
    { sit: 'Сидит', emerge: 'Всплывает', call: 'Поёт', hop: 'Прыгает', dive: 'Ныряет' },
    (state, time) => ({
      ...base,
      state,
      id: 1,
      species,
      phase: phase(time, state),
      pond: 0,
      size: 1,
      throat: state === 'call' ? wave(time, 0.01) : 0,
      hidden: 0,
      gone: false,
      answer: 0,
    }),
    drawFrog,
  ),
);

const dragonflies = (['hawker', 'damselfly'] as const).map((kind, i) =>
  animal<PondDragonfly>(
    {
      id: kind,
      name: i ? 'Стрекоза-стрелка' : 'Стрекоза-коромысло',
      latin: i ? 'Zygoptera' : 'Aeshnidae',
      group: 'Насекомые',
      scale: 9,
      baseline: 0.6,
      description: i
        ? 'Тонкая зелёная стрекоза. На отдыхе складывает крылья вдоль тела.'
        : 'Голубой дозорный пруда. Зависает над водой, а на отдыхе оставляет крылья раскрытыми.',
      habitat: 'Пруды, камыши, кувшинки и камни у воды.',
    },
    {
      hover: 'Зависает',
      arrive: 'Прилетает',
      patrol: 'Патрулирует',
      perch: 'На стебле',
      chase: 'Догоняет',
      leave: 'Улетает',
    },
    (state, time) => ({
      ...base,
      state,
      kind,
      id: 1,
      phase: phase(time, state),
      alt: state === 'perch' ? 0 : 2 + wave(time),
      vx: 0.1,
      vy: 0,
      pond: 0,
      perch: null,
    }),
    drawDragonfly,
  ),
);

const koi = animal<Fish>(
  {
    id: 'koi',
    name: 'Карп кои',
    latin: 'Cyprinus rubrofuscus',
    group: 'У воды',
    scale: 8,
    baseline: 0.51,
    water: true,
    description:
      'Пятнистая чешуя и полупрозрачные плавники скользят под водой. Карп запоминает место кормления и постепенно становится смелее.',
    habitat: 'Вода пруда. Кормление привлекает карпов к поверхности.',
    variants: ['Красный', 'Белый с пятнами', 'Золотой'],
  },
  { wander: 'Плавает', approach: 'Подплывает', feed: 'Ест у поверхности', hide: 'Уходит в глубину' },
  (state, time, variant) => ({
    ...base,
    state,
    seed: 42 + variant,
    id: 1,
    dir: -Math.PI / 4 + Math.sin(time * 0.001) * 0.25,
    speed: 1,
    homeX: 0,
    homeY: 0,
    turn: 0,
    panic: state === 'hide' ? 1 : 0,
    px: 0,
    py: 0,
    feedMemory: null,
    feedTimer: 0,
    boldness: 0.7,
    lastFed: 0,
    memoryStrength: 0.5,
  }),
  drawFishAt,
);

const butterfly: GuideAnimal = {
  id: 'butterfly',
  name: 'Бабочка',
  latin: 'Lepidoptera',
  group: 'Насекомые',
  scale: 12,
  baseline: 0.6,
  description:
    'Узорчатые крылья с тонкими жилками порхают над цветами. На отдыхе бабочка складывает их, оставляя видны усики и тонкие лапки.',
  habitat: 'Цветущий сад в тёплое время года.',
  animations: [
    { id: 'fly', name: 'Летает', duration: 5000 },
    { id: 'rest', name: 'На цветке', duration: 5000 },
  ],
  draw(ctx, atm, state, time) {
    const f: Flutter = {
      ...base,
      alt: state === 'rest' ? 0 : 2 + wave(time),
      vx: 0,
      vy: 0,
      valt: 0,
      resting: state === 'rest' ? 1 : 0,
    };
    drawButterfly(ctx, f, 0, 0, atm, time);
  },
};
const firefly = animal<Firefly>(
  {
    id: 'firefly',
    name: 'Светлячок',
    latin: 'Lampyridae',
    group: 'Насекомые',
    scale: 10,
    baseline: 0.78,
    night: true,
    description: 'Крошечный фонарик. Его свет нарастает и гаснет, оставляя ночному саду тишину между вспышками.',
    habitat: 'Тёплые тихие ночи, пруды и поляны.',
  },
  { fly: 'Летает и светится', rest: 'Отдыхает' },
  (state) => ({ ...base, state, ax: 0, ay: 0, dir: 0, period: 2600, phase: 0, alpha: 1 }),
  drawFirefly,
);
const moth = animal<Moth>(
  {
    id: 'moth',
    name: 'Мотылёк',
    latin: 'Lepidoptera',
    group: 'Насекомые',
    scale: 12,
    baseline: 0.84,
    night: true,
    description:
      'Пушистое тельце, перистые усики и бледные узорчатые крылья. На отдыхе мотылёк складывает крылья крышей.',
    habitat: 'Тёплые сумерки и ночной сад.',
  },
  { fly: 'Порхает', rest: 'Отдыхает' },
  (state) => ({ ...base, state, ax: 0, ay: 0, dir: 0, flutter: 0, alpha: 1 }),
  drawMoth,
);
const bee = animal<Bee>(
  {
    id: 'bee',
    name: 'Пчела',
    latin: 'Apis',
    group: 'Насекомые',
    scale: 20,
    baseline: 0.63,
    description: 'Полосатая труженица задерживается у цветов и возвращается с золотой пыльцой.',
    habitat: 'Цветы и улей в тёплое дневное время.',
  },
  { fly: 'Летает', gather: 'Собирает пыльцу', return: 'Возвращается с пыльцой' },
  (state, time) => ({
    ...base,
    state,
    phase: phase(time, state),
    ax: 0,
    ay: 0,
    alt: 0,
    dir: 0,
    vx: 0,
    vy: 0,
    carrying: state === 'return',
    alpha: 1,
  }),
  drawBee,
);

export const GUIDE_ANIMALS: GuideAnimal[] = [
  lizard,
  deer,
  turtle,
  cat,
  hedgehog,
  squirrel,
  mouse,
  ...birds,
  heron,
  owl,
  koi,
  ...frogs,
  butterfly,
  ...dragonflies,
  bee,
  firefly,
  moth,
];
