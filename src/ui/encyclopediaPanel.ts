/**
 * Полевой справочник живых соседей.
 *
 * Это не статичная галерея: в каждой карточке используется тот же рендерер,
 * что и в саду. Страницы сами перелистывают состояния поведения, а список
 * состояний остаётся видимым — так игрок понимает, что именно умеет животное.
 */

import './encyclopedia.css';
import { computeTime } from '../core/clock';
import { buildAtmosphere, Atmosphere } from '../world/palette';
import { Bird, BirdSpecies, Cat, CatState, Flutter } from '../world/life';
import { Frog, FrogState, PondDragonfly, FlyState } from '../world/residents';
import {
  Bee,
  Deer,
  DeerState,
  Firefly,
  Hedgehog,
  HedgehogState,
  Heron,
  HeronState,
  Moth,
  Mouse,
  MouseState,
  Owl,
  OwlState,
  Squirrel,
  SquirrelState,
  Turtle,
  TurtleState,
} from '../world/wildlife';
import { drawBird, drawButterfly, drawCat } from '../render/creatures';
import {
  drawBee,
  drawDeer,
  drawFirefly,
  drawHedgehog,
  drawHeron,
  drawMoth,
  drawMouse,
  drawOwl,
  drawSquirrel,
  drawTurtle,
} from '../render/wildlife';
import { drawDragonfly, drawFrog } from '../render/residents';
import { Ctx } from '../render/paint';
import { svgIcon } from './icons';

interface AnimationStep {
  id: string;
  label: string;
  note: string;
}

interface AnimalPage {
  id: string;
  name: string;
  group: string;
  mark: string;
  description: string;
  detail: string;
  steps: AnimationStep[];
  render: (ctx: Ctx, state: string, atm: Atmosphere, time: number) => void;
}

const catSteps: AnimationStep[] = [
  { id: 'sleep', label: 'сон', note: 'сворачивается клубком и дышит' },
  { id: 'loaf', label: 'булочка', note: 'прячет лапы и слушает сад' },
  { id: 'sit', label: 'сидит', note: 'следит за движением травы' },
  { id: 'walk', label: 'идёт', note: 'мягко переставляет лапы' },
  { id: 'wash', label: 'умывается', note: 'подносит лапу к мордочке' },
  { id: 'stretch', label: 'потягивается', note: 'выгибает спину после сна' },
];

const birdSteps: AnimationStep[] = [
  { id: 'fly-in', label: 'прилетает', note: 'опускается к саду' },
  { id: 'hop', label: 'прыгает', note: 'скачет по траве' },
  { id: 'peck', label: 'клюёт', note: 'ищет зёрнышко в земле' },
  { id: 'perch', label: 'сидит', note: 'замирает на насесте' },
  { id: 'feed', label: 'кормится', note: 'склоняется к кормушке' },
  { id: 'drink', label: 'пьёт', note: 'наклоняется к воде' },
  { id: 'bathe', label: 'купается', note: 'встряхивает крылья и брызги' },
  { id: 'fly-out', label: 'улетает', note: 'подхватывается ветром' },
];

const frogSteps: AnimationStep[] = [
  { id: 'emerge', label: 'выходит', note: 'появляется из воды' },
  { id: 'sit', label: 'сидит', note: 'греется на берегу' },
  { id: 'call', label: 'квакает', note: 'раздувает горло' },
  { id: 'hop', label: 'прыгает', note: 'перелетает кувшинку' },
  { id: 'dive', label: 'ныряет', note: 'оставляет круги на воде' },
];

const pages: AnimalPage[] = [];

function addPage(page: AnimalPage): void {
  pages.push(page);
}

function simplePage(
  id: string,
  name: string,
  group: string,
  mark: string,
  description: string,
  detail: string,
  steps: AnimationStep[],
  render: AnimalPage['render'],
): void {
  addPage({ id, name, group, mark, description, detail, steps, render });
}

function fakeCat(state: string, atm: Atmosphere, time: number, coat: Cat['coat'] = 'cream'): void {
  const cat: Cat = {
    id: -1,
    tx: 0,
    ty: 0,
    facing: 1,
    seed: 18,
    state: state as CatState,
    timer: 4000,
    target: null,
    phase: 0.55,
    speed: 0.7,
    home: null,
    guest: false,
    coat,
    greet: 0,
    leaveAt: 0,
    stayAt: 0,
  };
  drawCat(atm.ctx!, cat, 0, 0, atm, time);
}

// The render context is attached only during a frame; keeping it on the
// atmosphere avoids widening every small preview callback with another arg.
declare module '../world/palette' {
  interface Atmosphere {
    ctx?: Ctx;
  }
}

function fakeBird(state: string, species: BirdSpecies, atm: Atmosphere, time: number): void {
  const bird: Bird = {
    tx: 0,
    ty: 0,
    facing: 1,
    seed: 31,
    state: state as Bird['state'],
    timer: 3000,
    target: null,
    alt: state === 'fly-in' || state === 'fly-out' ? 18 : 0,
    hop: time * 0.01,
    scale: 2.25,
    species,
    place: state === 'feed' ? 'feeder' : state === 'drink' || state === 'bathe' ? 'bath' : 'ground',
    slot: 0,
  };
  drawBird(atm.ctx!, bird, 0, 0, atm, time);
}

function fakeFrog(state: string, atm: Atmosphere, time: number): void {
  const frog: Frog = {
    id: -1,
    tx: 0,
    ty: 0,
    facing: 1,
    seed: 41,
    state: state as FrogState,
    timer: 2000,
    phase: (time % 1800) / 1800,
    from: null,
    target: null,
    pond: 0,
    species: 'green',
    size: 1.45,
    throat: state === 'call' ? 0.8 : 0.1,
    hidden: 0,
    gone: false,
    answer: 0,
  };
  drawFrog(atm.ctx!, frog, 0, 0, atm, time);
}

function fakeDragonfly(state: string, atm: Atmosphere, time: number): void {
  const fly: PondDragonfly = {
    id: -1,
    kind: 'hawker',
    tx: 0,
    ty: 0,
    alt: state === 'perch' ? 2 : 10,
    vx: Math.cos(time * 0.002),
    vy: Math.sin(time * 0.002),
    facing: 1,
    seed: 44,
    state: state as FlyState,
    timer: 2000,
    phase: 0.5,
    pond: 0,
    target: null,
    perch: null,
  };
  drawDragonfly(atm.ctx!, fly, 0, 0, atm, time);
}

function fakeFish(ctx: Ctx, state: string, atm: Atmosphere, time: number): void {
  void atm;
  // Карп в справочнике остаётся векторным, но чуть крупнее садового: так
  // читаются хвост, чешуя и четыре состояния даже на телефоне.
  const t = state === 'hide' ? 0.6 : 1;
  const bob = state === 'feed' ? Math.sin(time * 0.008) * 1.4 : Math.sin(time * 0.002) * 0.4;
  const wag = Math.sin(time * 0.007) * 0.7;
  const body = { r: 226, g: 132, b: 80 };
  const pale = { r: 248, g: 224, b: 174 };
  ctx.save();
  ctx.globalAlpha = t;
  ctx.translate(-4, -8 + bob);
  ctx.scale(1.8, 1.8);
  ctx.fillStyle = 'rgba(86, 107, 118, .22)';
  ctx.beginPath();
  ctx.ellipse(0, 7, 20, 5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = `rgb(${body.r},${body.g},${body.b})`;
  ctx.beginPath();
  ctx.moveTo(-10, 0);
  ctx.quadraticCurveTo(-16, -4 + wag * 2, -19, -7 + wag * 3);
  ctx.quadraticCurveTo(-16, 0, -19, 7 + wag * 3);
  ctx.quadraticCurveTo(-15, 4 + wag * 2, -10, 0);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(0, 0, 13, 5.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = `rgb(${pale.r},${pale.g},${pale.b})`;
  ctx.beginPath();
  ctx.ellipse(3, -0.6, 5, 3.1, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(117, 68, 54, .42)';
  ctx.lineWidth = 0.8;
  for (let x = -6; x <= 7; x += 3) {
    ctx.beginPath();
    ctx.arc(x, 0, 2.1, 0.2, Math.PI - 0.2);
    ctx.stroke();
  }
  ctx.fillStyle = '#342b28';
  ctx.beginPath();
  ctx.arc(10, -1.6, 0.9, 0, Math.PI * 2);
  ctx.fill();
  if (state === 'feed') {
    ctx.fillStyle = 'rgba(245,245,220,.7)';
    ctx.beginPath();
    ctx.arc(7, -8 - Math.sin(time * 0.01) * 2, 1.3, 0, Math.PI * 2);
    ctx.arc(10, -11 - Math.sin(time * 0.008) * 2, 0.8, 0, Math.PI * 2);
    ctx.fill();
  }
  if (state === 'approach') {
    ctx.strokeStyle = 'rgba(223,245,235,.48)';
    ctx.beginPath();
    ctx.arc(8, 0, 7 + Math.sin(time * 0.003) * 2, -0.6, 0.6);
    ctx.stroke();
  }
  ctx.restore();
}

function fakeButterfly(state: string, atm: Atmosphere, time: number): void {
  const b: Flutter = {
    tx: 0,
    ty: 0,
    alt: state === 'rest' ? 6 : 16,
    vx: 1,
    vy: 0,
    valt: 0,
    target: null,
    timer: 2000,
    seed: 9,
    phase: 0,
    resting: state === 'rest' ? 1 : 0,
  };
  drawButterfly(atm.ctx!, b, 0, 0, atm, time);
}

function fakeFirefly(state: string, atm: Atmosphere, time: number): void {
  const f: Firefly = {
    tx: 0,
    ty: 0,
    ax: 0,
    ay: 0,
    dir: 0,
    seed: 5,
    period: 1200,
    phase: 0.08,
    state: state as Firefly['state'],
    timer: 1000,
    alpha: 1,
  };
  drawFirefly(atm.ctx!, f, 0, 0, atm, time);
}

function fakeMoth(state: string, atm: Atmosphere, time: number): void {
  const m: Moth = {
    tx: 0,
    ty: 0,
    ax: 0,
    ay: 0,
    dir: 0,
    seed: 6,
    phase: 0,
    timer: 1000,
    alpha: 1,
    state: state as Moth['state'],
    flutter: Math.sin(time * 0.01),
  };
  drawMoth(atm.ctx!, m, 0, 0, atm, time);
}

function fakeHeron(state: string, atm: Atmosphere, time: number): void {
  const h: Heron = {
    tx: 0,
    ty: 0,
    from: null,
    target: null,
    state: state as HeronState,
    timer: state === 'strike' ? 500 : 900,
    facing: 1,
    phase: 0.5,
    fish: state === 'strike' ? 1 : 0,
    struck: false,
    born: 0,
    stay: 0,
    seed: 17,
  };
  drawHeron(atm.ctx!, h, 0, 0, atm, time);
}

function fakeDeer(state: string, atm: Atmosphere, time: number): void {
  const d: Deer = {
    tx: 0,
    ty: 0,
    from: null,
    target: null,
    state: state as DeerState,
    timer: 1200,
    facing: 1,
    phase: (time % 1600) / 1600,
    gait: time * 0.008,
    seed: 27,
    coat: { spots: true, antlers: true, winter: false },
    born: 0,
    stay: 0,
  };
  drawDeer(atm.ctx!, d, 0, 0, atm, time);
}

function fakeHedgehog(state: string, atm: Atmosphere, time: number): void {
  const e: Hedgehog = {
    tx: 0,
    ty: 0,
    from: null,
    target: null,
    state: state as HedgehogState,
    timer: 1200,
    facing: 1,
    phase: 0.5,
    seed: 33,
    born: 0,
    stay: 0,
    curl: state === 'curl' ? 1 : 0,
  };
  drawHedgehog(atm.ctx!, e, 0, 0, atm, time);
}

function fakeMouse(state: string, atm: Atmosphere, time: number): void {
  const m: Mouse = {
    tx: 0,
    ty: 0,
    from: null,
    target: null,
    state: state as MouseState,
    timer: 1200,
    facing: 1,
    phase: (time % 1400) / 1400,
    seed: 35,
    born: 0,
    stay: 0,
    panicX: 0,
    panicY: 0,
    panic: state === 'flee' ? 1 : 0,
  };
  drawMouse(atm.ctx!, m, 0, 0, atm, time);
}

function fakeOwl(state: string, atm: Atmosphere, time: number): void {
  const o: Owl = {
    tx: 0,
    ty: 0,
    from: null,
    target: null,
    state: state as OwlState,
    timer: 900,
    facing: 1,
    phase: 0.5,
    seed: 38,
    born: 0,
    stay: 0,
    huntX: 0,
    huntY: 0,
    hoot: state === 'hoot' ? 1 : 0,
  };
  drawOwl(atm.ctx!, o, 0, 0, atm, time);
}

function fakeSquirrel(state: string, atm: Atmosphere, time: number): void {
  const s: Squirrel = {
    tx: 0,
    ty: 0,
    from: null,
    target: null,
    state: state as SquirrelState,
    timer: 1200,
    facing: 1,
    phase: (time % 1300) / 1300,
    seed: 42,
    born: 0,
    stay: 0,
    hasNut: state === 'cache' || state === 'forage',
    panic: state === 'flee' ? 1 : 0,
  };
  drawSquirrel(atm.ctx!, s, 0, 0, atm, time);
}

function fakeTurtle(state: string, atm: Atmosphere, time: number): void {
  const t: Turtle = {
    tx: 0,
    ty: 0,
    from: null,
    target: null,
    state: state as TurtleState,
    timer: 1000,
    facing: 1,
    phase: (time % 2200) / 2200,
    seed: 48,
    born: 0,
    stay: 0,
    hide: state === 'hide' ? 1 : 0,
  };
  drawTurtle(atm.ctx!, t, 0, 0, atm, time);
}

function fakeBee(state: string, atm: Atmosphere, time: number): void {
  const b: Bee = {
    tx: 0,
    ty: 0,
    ax: 0,
    ay: 0,
    alt: 10,
    dir: 0,
    vx: 0,
    vy: 0,
    seed: 52,
    timer: 900,
    phase: 0.4,
    state: state as Bee['state'],
    target: null,
    carrying: state === 'return',
    alpha: 1,
  };
  drawBee(atm.ctx!, b, 0, 0, atm, time);
}

function commonSteps(items: Array<[string, string, string]>): AnimationStep[] {
  return items.map(([id, label, note]) => ({ id, label, note }));
}

simplePage(
  'cat',
  'Кот',
  'домашние',
  '猫',
  'Тёплый житель усадьбы. Коты не торопятся: спят, прислушиваются, умываются и выбирают свой маршрут.',
  'Коты приходят к подушкам и тихим углам. У каждого — собственная шуба и привычка к саду.',
  catSteps,
  (ctx, state, atm, time) => {
    atm.ctx = ctx;
    fakeCat(state, atm, time);
  },
);

for (const [id, name, species] of [
  ['sparrow', 'Воробей', 'sparrow'],
  ['tit', 'Синица', 'tit'],
  ['finch', 'Зяблик', 'finch'],
  ['wagtail', 'Трясогузка', 'wagtail'],
  ['bullfinch', 'Снегирь', 'bullfinch'],
] as const) {
  simplePage(
    `bird-${id}`,
    name,
    'птицы',
    '鳥',
    'Небольшой гость сада: прилетает, прыгает по траве и выбирает, где остановиться.',
    'Кормушка, поилка и открытая земля меняют его маршрут. У каждой птицы свой силуэт и окраска.',
    birdSteps,
    (ctx, state, atm, time) => {
      atm.ctx = ctx;
      fakeBird(state, species, atm, time);
    },
  );
}

simplePage(
  'frog',
  'Лягушка',
  'у воды',
  '蛙',
  'Береговой певец: выходит из пруда, отвечает соседкам и исчезает под водой при опасности.',
  'В дождь хор становится смелее. Прыжок и нырок оставляют на воде короткие круги.',
  frogSteps,
  (ctx, state, atm, time) => {
    atm.ctx = ctx;
    fakeFrog(state, atm, time);
  },
);

simplePage(
  'koi',
  'Карп кои',
  'у воды',
  '鯉',
  'Тихий цветной житель пруда: подходит к поверхности, узнаёт знакомое место и прячется в глубине.',
  'Кои различают корм и со временем становятся смелее. Пузырьки — знак кормления.',
  commonSteps([
    ['wander', 'плывёт', 'держит спокойный круг'],
    ['approach', 'подплывает', 'идёт к знакомому месту'],
    ['feed', 'кормится', 'поднимает пузырьки'],
    ['hide', 'прячется', 'уходит в тень воды'],
  ]),
  (ctx, state, atm, time) => fakeFish(ctx, state, atm, time),
);

simplePage(
  'butterfly',
  'Бабочка',
  'летучие',
  '蝶',
  'Лёгкая цветная тень над клумбой. Крылья раскрываются несимметрично, поэтому бабочка не выглядит значком.',
  'Цветы удерживают её в саду, а ветер меняет направление порхания.',
  commonSteps([
    ['fly', 'порхает', 'держит ритм крыльев'],
    ['rest', 'на цветке', 'складывает крылья'],
  ]),
  (ctx, state, atm, time) => {
    atm.ctx = ctx;
    fakeButterfly(state, atm, time);
  },
);

simplePage(
  'dragonfly',
  'Стрекоза',
  'у воды',
  '蜻',
  'Стремительный патруль пруда: зависает, разворачивается и садится на камыш.',
  'Стрекоза не летает в сильный дождь. Две соседки иногда устраивают короткую погоню.',
  commonSteps([
    ['arrive', 'прилетает', 'входит в воздушный круг'],
    ['patrol', 'патрулирует', 'летит над водой'],
    ['hover', 'зависает', 'держится на одном месте'],
    ['perch', 'садится', 'складывает крылья'],
    ['chase', 'преследует', 'резко меняет курс'],
    ['leave', 'улетает', 'растворяется над прудом'],
  ]),
  (ctx, state, atm, time) => {
    atm.ctx = ctx;
    fakeDragonfly(state, atm, time);
  },
);

simplePage(
  'firefly',
  'Светлячок',
  'сумерки',
  '蛍',
  'Ночная искра среди травы. Его свет не постоянен — он вспыхивает коротким мягким импульсом.',
  'Тёплая тихая ночь собирает больше светлячков. Днём они почти невидимы.',
  commonSteps([
    ['fly', 'летит', 'пульсирует в воздухе'],
    ['rest', 'отдыхает', 'гаснет на листе'],
  ]),
  (ctx, state, atm, time) => {
    atm.ctx = ctx;
    fakeFirefly(state, atm, time);
  },
);

simplePage(
  'moth',
  'Мотылёк',
  'сумерки',
  '蛾',
  'Спутник светлячка: серо-кремовая пыльца вьётся вокруг фонаря и цветов.',
  'В покое крылья складываются. На лету они раскрываются с лёгким дрожанием.',
  commonSteps([
    ['fly', 'порхает', 'дрожит у света'],
    ['rest', 'сидит', 'складывает крылья'],
  ]),
  (ctx, state, atm, time) => {
    atm.ctx = ctx;
    fakeMoth(state, atm, time);
  },
);

simplePage(
  'heron',
  'Цапля',
  'у воды',
  '鷺',
  'Высокий терпеливый гость большого пруда: шагает по мелководью и ждёт правильного мгновения.',
  'Взмах крыльев длинный, шаг осторожный, а удар клюва — внезапный. После рыбалки цапля прихорашивается.',
  commonSteps([
    ['fly-in', 'прилетает', 'складывает длинные крылья'],
    ['stand', 'стоит', 'ждёт у берега'],
    ['stalk', 'крадётся', 'переносит вес с ноги на ногу'],
    ['strike', 'ловит', 'вытягивает шею к воде'],
    ['preen', 'чистит перья', 'возвращает спокойный ритм'],
    ['fly-out', 'улетает', 'уходит в высокий круг'],
  ]),
  (ctx, state, atm, time) => {
    atm.ctx = ctx;
    fakeHeron(state, atm, time);
  },
);

simplePage(
  'deer',
  'Олень',
  'лесная опушка',
  '鹿',
  'Новый силуэт оленя — лёгкий, собранный и внимательный. Он не просто скользит по поляне: у него есть вес шага, дыхание и настороженное ухо.',
  'Выходит на рассвете и в сумерках. Пятнистая летняя шуба и ветвистые рога меняются вместе с сезоном.',
  commonSteps([
    ['enter', 'выходит', 'мягко входит из-за деревьев'],
    ['walk', 'идёт', 'перекатывает шаг по траве'],
    ['graze', 'пасётся', 'опускает шею к траве'],
    ['look', 'слушает', 'поднимает голову и хвост'],
    ['leave', 'уходит', 'собирается в быстрый аллюр'],
  ]),
  (ctx, state, atm, time) => {
    atm.ctx = ctx;
    fakeDeer(state, atm, time);
  },
);

simplePage(
  'hedgehog',
  'Ёжик',
  'тихие углы',
  '針',
  'Ночной собиратель листьев и запахов. При встрече с котом превращает мягкое тело в колючий шар.',
  'Кусты и камни для него важнее открытой поляны. После тревоги он долго снова принюхивается.',
  commonSteps([
    ['enter', 'выходит', 'появляется из травы'],
    ['walk', 'идёт', 'перебирает короткими лапками'],
    ['forage', 'ищет', 'шуршит в листьях'],
    ['sniff', 'нюхает', 'поднимает нос к ветру'],
    ['curl', 'сворачивается', 'ставит иголки дыбом'],
    ['leave', 'уходит', 'прячется под кустом'],
  ]),
  (ctx, state, atm, time) => {
    atm.ctx = ctx;
    fakeHedgehog(state, atm, time);
  },
);

simplePage(
  'mouse',
  'Мышь',
  'тихие углы',
  '鼠',
  'Маленький быстрый сосед у камней и кормушек. Движется рывками и замирает, если рядом кошка.',
  'У мыши выразительный хвост и короткие паузы между перебежками — её удобно наблюдать вблизи.',
  commonSteps([
    ['enter', 'выходит', 'крадётся из укрытия'],
    ['forage', 'ищет зёрна', 'останавливается у запаха'],
    ['walk', 'бежит', 'переставляет лапки'],
    ['hide', 'прячется', 'прижимается к земле'],
    ['flee', 'убегает', 'делает резкий рывок'],
    ['leave', 'уходит', 'скрывается за камнем'],
  ]),
  (ctx, state, atm, time) => {
    atm.ctx = ctx;
    fakeMouse(state, atm, time);
  },
);

simplePage(
  'owl',
  'Сова',
  'ночной дозор',
  '梟',
  'Ночной дозорный. Ветка, круглая маска и большие глаза делают её неподвижность отдельной анимацией.',
  'Сова охотится на мышей, но не преследует их бесконечно: сад остаётся тихим, даже когда начинается охота.',
  commonSteps([
    ['fly-in', 'прилетает', 'садится бесшумно'],
    ['perch', 'сидит', 'растворяется в ветке'],
    ['hoot', 'ухает', 'открывает клюв'],
    ['look', 'осматривается', 'поворачивает голову'],
    ['hunt', 'охотится', 'срывается вниз'],
    ['fly-out', 'улетает', 'возвращается в ночь'],
  ]),
  (ctx, state, atm, time) => {
    atm.ctx = ctx;
    fakeOwl(state, atm, time);
  },
);

simplePage(
  'squirrel',
  'Белка',
  'лесная опушка',
  '栗',
  'Дневная прыгунья с большим хвостом. Она носит орешек, замирает на ветке и возвращается к тайнику.',
  'Сосны и кормушка для белок делают её маршрут заметнее. При опасности хвост первым выдаёт тревогу.',
  commonSteps([
    ['enter', 'выходит', 'спускается к саду'],
    ['jump', 'прыгает', 'перелетает между точками'],
    ['forage', 'ищет орех', 'держит его перед собой'],
    ['cache', 'прячет', 'запоминает место'],
    ['look', 'смотрит', 'замирает столбиком'],
    ['flee', 'убегает', 'взлетает на дерево'],
    ['leave', 'уходит', 'исчезает в роще'],
  ]),
  (ctx, state, atm, time) => {
    atm.ctx = ctx;
    fakeSquirrel(state, atm, time);
  },
);

simplePage(
  'turtle',
  'Черепаха',
  'у воды',
  '亀',
  'Полностью обновлённая черепаха: тяжёлый панцирь получает объём, голова живо тянется к солнцу, а каждая лапа по очереди находит опору.',
  'Она выбирает камни у воды. Медленное движение теперь читается через перенос веса, а не только через смену позиции.',
  commonSteps([
    ['enter', 'приходит', 'показывается у пруда'],
    ['bask', 'греется', 'поднимает голову к свету'],
    ['walk', 'идёт', 'переносит вес между лапами'],
    ['swim', 'плывёт', 'скользит под поверхностью'],
    ['look', 'смотрит', 'вытягивает шею'],
    ['hide', 'прячется', 'убирает голову в панцирь'],
    ['leave', 'уходит', 'медленно возвращается к воде'],
  ]),
  (ctx, state, atm, time) => {
    atm.ctx = ctx;
    fakeTurtle(state, atm, time);
  },
);

simplePage(
  'bee',
  'Пчела',
  'цветы',
  '蜂',
  'Деловитая точка в воздухе: собирает пыльцу, возвращается к улью и снова уходит за цветами.',
  'Тёплый полдень наполняет цветники гулом. Пыльца видна маленьким золотым шариком.',
  commonSteps([
    ['fly', 'летит', 'держит высоту над цветами'],
    ['gather', 'собирает', 'садится к цветку'],
    ['return', 'возвращается', 'несёт пыльцу в улей'],
  ]),
  (ctx, state, atm, time) => {
    atm.ctx = ctx;
    fakeBee(state, atm, time);
  },
);

export class EncyclopediaPanel {
  private root: HTMLElement;
  private index: HTMLElement;
  private canvas: HTMLCanvasElement;
  private canvasCtx: Ctx;
  private animationLine: HTMLElement;
  private animationList: HTMLElement;
  private playButton: HTMLElement;
  private pageTitle: HTMLElement;
  private pageGroup: HTMLElement;
  private pageDescription: HTMLElement;
  private pageDetail: HTMLElement;
  private current = 'deer';
  private step = 0;
  private playing = true;
  private open = false;
  private raf = 0;

  constructor(parent: HTMLElement) {
    this.root = document.createElement('section');
    this.root.className = 'encyclopedia paper';
    this.root.innerHTML = `
      <div class="ency-header">
        <div class="ency-kicker">ПОЛЕВОЙ СПРАВОЧНИК · ЖИВАЯ УСАДЬБА</div>
        <h2>Энциклопедия соседей</h2>
        <p>Откройте страницу — и посмотрите весь характер животного. Движения проигрываются по кругу тем же рисунком, что живёт в саду.</p>
        <button class="ency-close" aria-label="Закрыть энциклопедию">${svgIcon('close', 20)}</button>
      </div>
      <div class="ency-layout">
        <nav class="ency-index" aria-label="Животные"></nav>
        <article class="ency-page">
          <div class="ency-page-head">
            <div class="ency-mark"></div>
            <div><div class="ency-group"></div><h3 class="ency-title"></h3></div>
          </div>
          <div class="ency-stage">
            <canvas width="640" height="300"></canvas>
            <div class="ency-stage-caption"><span class="ency-animation-line"></span><button class="ency-play"></button></div>
          </div>
          <div class="ency-copy"><p class="ency-description"></p><p class="ency-detail"></p></div>
          <div class="ency-motions-head"><span>Все анимации</span><small>Нажмите на движение, чтобы рассмотреть его</small></div>
          <div class="ency-animations"></div>
        </article>
      </div>`;
    parent.appendChild(this.root);
    this.index = this.root.querySelector('.ency-index')!;
    this.canvas = this.root.querySelector('canvas')!;
    this.canvasCtx = this.canvas.getContext('2d')!;
    this.animationLine = this.root.querySelector('.ency-animation-line')!;
    this.animationList = this.root.querySelector('.ency-animations')!;
    this.playButton = this.root.querySelector('.ency-play')!;
    this.pageTitle = this.root.querySelector('.ency-title')!;
    this.pageGroup = this.root.querySelector('.ency-group')!;
    this.pageDescription = this.root.querySelector('.ency-description')!;
    this.pageDetail = this.root.querySelector('.ency-detail')!;

    this.renderIndex();
    this.root.querySelector('.ency-close')!.addEventListener('click', () => this.setOpen(false));
    this.playButton.addEventListener('click', () => {
      this.playing = !this.playing;
      this.syncPlayButton();
    });
  }

  get isOpen(): boolean {
    return this.open;
  }

  setOpen(on: boolean): void {
    this.open = on;
    this.root.classList.toggle('show', on);
    if (on) {
      this.renderPage();
      cancelAnimationFrame(this.raf);
      this.raf = requestAnimationFrame((t) => this.draw(t));
    } else {
      cancelAnimationFrame(this.raf);
    }
  }

  toggle(): void {
    this.setOpen(!this.open);
  }

  private renderIndex(): void {
    this.index.innerHTML = '';
    let previous = '';
    for (const animal of pages) {
      if (animal.group !== previous) {
        const group = document.createElement('div');
        group.className = 'ency-index-group';
        group.textContent = animal.group;
        this.index.appendChild(group);
        previous = animal.group;
      }
      const b = document.createElement('button');
      b.className = 'ency-index-item';
      b.dataset.id = animal.id;
      b.innerHTML = `<span class="ency-item-mark">${animal.mark}</span><span>${animal.name}</span>`;
      b.addEventListener('click', () => {
        this.current = animal.id;
        this.step = 0;
        this.playing = true;
        this.renderPage();
      });
      this.index.appendChild(b);
    }
  }

  private get animal(): AnimalPage {
    return pages.find((item) => item.id === this.current) ?? pages[0];
  }

  private renderPage(): void {
    const animal = this.animal;
    this.pageTitle.textContent = animal.name;
    this.pageGroup.textContent = animal.group;
    this.pageDescription.textContent = animal.description;
    this.pageDetail.textContent = animal.detail;
    this.root.querySelector('.ency-mark')!.textContent = animal.mark;
    this.animationList.innerHTML = '';
    animal.steps.forEach((motion, index) => {
      const b = document.createElement('button');
      b.className = 'ency-motion';
      b.dataset.index = String(index);
      b.innerHTML = `<span class="ency-motion-dot"></span><span><strong>${motion.label}</strong><small>${motion.note}</small></span>`;
      b.addEventListener('click', () => {
        this.step = index;
        this.playing = false;
        this.syncPlayButton();
        this.syncMotionList();
      });
      this.animationList.appendChild(b);
    });
    this.syncMotionList();
    this.syncPlayButton();
  }

  private syncMotionList(): void {
    const animal = this.animal;
    const motion = animal.steps[this.step % animal.steps.length];
    this.animationLine.textContent = `${motion.label} · ${motion.note}`;
    this.animationList.querySelectorAll<HTMLElement>('.ency-motion').forEach((b) => {
      b.classList.toggle('active', Number(b.dataset.index) === this.step);
    });
    this.index.querySelectorAll<HTMLElement>('.ency-index-item').forEach((b) => {
      b.classList.toggle('active', b.dataset.id === animal.id);
    });
  }

  private syncPlayButton(): void {
    this.playButton.textContent = this.playing ? 'Ⅱ  по кругу' : '▶  показать всё';
    this.playButton.classList.toggle('paused', !this.playing);
  }

  private draw(now: number): void {
    if (!this.open) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const width = 640;
    const height = 300;
    if (this.canvas.width !== width * dpr) {
      this.canvas.width = width * dpr;
      this.canvas.height = height * dpr;
    }
    const ctx = this.canvasCtx;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const t = computeTime(Date.now());
    const atm = buildAtmosphere(t);
    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, 'rgba(219, 232, 226, .92)');
    gradient.addColorStop(1, 'rgba(190, 207, 181, .72)');
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = 'rgba(243, 234, 214, .35)';
    ctx.beginPath();
    ctx.ellipse(width * 0.5, height * 0.79, 195, 28, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.save();
    ctx.translate(width / 2, height * 0.78);
    atm.ctx = ctx;
    this.animal.render(ctx, this.animal.steps[this.step].id, atm, now);
    ctx.restore();
    ctx.fillStyle = 'rgba(72, 95, 80, .18)';
    ctx.font = '12px Cormorant Garamond, Georgia, serif';
    ctx.fillText('живой рисунок сада', 20, height - 18);

    if (this.playing) {
      const next = Math.floor(now / 1900) % this.animal.steps.length;
      if (next !== this.step) {
        this.step = next;
        this.syncMotionList();
      }
    }
    this.raf = requestAnimationFrame((t2) => this.draw(t2));
  }
}
