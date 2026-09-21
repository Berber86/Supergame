/**
 * Стартовые усадьбы — каждая со своим размером, характером и календарём.
 *
 * Территории нарочно разные: камерный дворик на четверти карты, широкая
 * вода, горный исток во всю карту, сухой сад камней, незакладываемая
 * пустошь и фруктовый сад с самым большим домом (5×6 — потолок).
 * У каждой территории свой стартовый месяц: открыв её, игрок застаёт
 * свой сезон — у кого-то на дворе май, у кого-то октябрь. Возраст тоже
 * свой: посадки высажены в дату закладки и выросли ко дню старта.
 * Растущий сад — отдельный режим, он сюда не входит.
 */

import { GRID } from '../core/iso';
import { computeTime, DAY_MS, midMonthMs, MONTH_NAMES } from '../core/clock';
import { hash2 } from '../core/rng';
import { World } from './world';
import { findPath } from './paths';

type Builder = (world: World, old: number) => void;

export interface Preset {
  id: string;
  name: string;
  hint: string;
  /** Календарный месяц (0–11), в котором территория встречает игрока. */
  startMonth: number;
  /** Сколько месяцев территории на момент старта. */
  monthsOld: number;
  build: Builder;
}

/** «На календаре май, саду 4 месяца» — старт и возраст в подсказке. */
function startHint(startMonth: number, monthsOld: number): string {
  const month = MONTH_NAMES[startMonth].toLowerCase();
  if (monthsOld <= 0) return `На календаре ${month}: ещё не заложен, саженцы вырастут у вас на глазах.`;
  const years = Math.floor(monthsOld / 12);
  const age = years > 0 ? `${years} ${years === 1 ? 'год' : 'года'} с лишним` : `${monthsOld} месяца`;
  return `На календаре ${month}, саду ${age}.`;
}

/** Сдвиг календаря: 15-е число стартового месяца, час суток — как настоящий. */
function startShift(startMonth: number, real: number): number {
  const dayStart = new Date(real);
  dayStart.setHours(0, 0, 0, 0);
  return midMonthMs(startMonth, real) + (real - dayStart.getTime()) - real;
}

function clearToMoss(world: World): void {
  for (let y = 0; y < GRID; y++) {
    for (let x = 0; x < GRID; x++) {
      const t = world.at(x, y)!;
      t.ground = 'moss';
      t.level = 0;
      t.water = false;
      t.indoor = false;
      t.veranda = false;
    }
  }
  world.objects = [];
  world.nextId = 1;
  world.lastTouched = null;
}

function house(world: World, x0: number, y0: number, w: number, h: number): void {
  for (let y = y0; y < y0 + h; y++) {
    for (let x = x0; x < x0 + w; x++) {
      const t = world.at(x, y);
      if (!t) continue;
      t.ground = 'tatami';
      t.indoor = true;
      t.level = 1;
    }
  }
  for (let x = x0 - 1; x <= x0 + w; x++) {
    for (const yy of [y0 - 1, y0 + h]) {
      const t = world.at(x, yy);
      if (t && !t.indoor) {
        t.ground = 'deck';
        t.veranda = true;
        t.level = 1;
      }
    }
  }
  for (let y = y0 - 1; y <= y0 + h; y++) {
    for (const xx of [x0 - 1, x0 + w]) {
      const t = world.at(xx, y);
      if (t && !t.indoor) {
        t.ground = 'deck';
        t.veranda = true;
        t.level = 1;
      }
    }
  }
}

function furnish(world: World, old: number, entries: [string, number, number, number][]): void {
  for (const [type, x, y, rot] of entries) if (world.canPlace(type, x, y, rot)) world.place(type, x, y, rot, old);
}

function pond(world: World, x0: number, y0: number, w: number, h: number): void {
  world.applyWaterBlock(x0, y0, w, h);
}

function scatterGround(world: World, x0: number, y0: number, w: number, h: number, g: string): void {
  for (let y = y0; y < y0 + h; y++) {
    for (let x = x0; x < x0 + w; x++) {
      const t = world.at(x, y);
      if (t && !t.water && !t.indoor && !t.veranda) t.ground = g as never;
    }
  }
}

function scatter(world: World, old: number, x0: number, y0: number, span: number, count: number, salt: number): void {
  for (let i = 0; i < count; i++) {
    const r1 = hash2(i, salt, 77);
    const r2 = hash2(i, salt + 2, 91);
    const tx = Math.round((x0 + r1 * span) * 4) / 4;
    const ty = Math.round((y0 + r2 * span) * 4) / 4;
    const t = world.at(Math.floor(tx), Math.floor(ty));
    if (!t || t.water || t.indoor || t.veranda) continue;
    const kind = r1 > 0.62 ? 'moss_clump' : r1 > 0.38 ? 'grass_tuft' : r1 > 0.2 ? 'fern' : 'pebbles';
    world.place(kind, tx, ty, 0, old);
  }
}

/** Камерный дворик на северо-западе; юг оставлен мшистой пустошью. */
const dvor: Preset = {
  id: 'dvor',
  name: 'Тихий двор',
  startMonth: 3,
  monthsOld: 4,
  hint: `Дом 4×3, гравийный дворик и пруд-чаша. ${startHint(3, 4)}`,
  build: (world, old) => {
    clearToMoss(world);
    house(world, 3, 3, 4, 3);
    scatterGround(world, 3, 8, 7, 4, 'gravel');
    pond(world, 11, 8, 4, 3);
    for (const [x, y] of [
      [7, 7],
      [8, 8],
      [9, 9],
      [10, 9],
    ] as [number, number][]) {
      const t = world.at(x, y);
      if (t) t.ground = 'stone';
    }
    furnish(world, old, [
      ['table', 4.5, 4.5, 0],
      ['cushion', 3.5, 5, 0],
      ['cushion', 5.5, 5, 0],
      ['tokonoma', 3.5, 3, 0],
      ['tansu', 5, 3, 0],
      ['indoor_plant', 6, 3, 0],
    ]);
    world.place('cat', 4.5, 5.5, 0, old);
    world.place('bowl', 6.5, 6, 0, old);
    world.place('wind_chime', 6.5, 2.5, 0, old);
    world.place('tsukubai', 7.5, 6.5, 0, old);
    world.place('lantern_stone', 8.5, 7.5, 0, old);
    world.place('lantern_path', 10.5, 10.5, 0, old);
    world.place('maple', 13.5, 6.5, 0, old);
    world.place('pine', 4.5, 12.5, 0, old);
    world.place('sakura', 9.5, 12.5, 0, old);
    world.place('azalea', 6.5, 8.5, 0, old);
    world.place('azalea', 9.5, 6.5, 0, old);
    world.place('rock_mid', 11.5, 7.5, 1, old);
    world.place('moss_clump', 6, 11, 0, old);
    world.place('moss_clump', 8, 10.5, 0, old);
    world.place('lotus', 12, 9, 0, old);
    world.place('lilypad', 13, 10, 0, old);
    world.place('koi', 12.5, 9.5, 0, old);
    world.place('fence_stone', 5, 12, 0, old);
    world.place('fence_stone', 7, 12, 0, old);
    world.place('moss_log', 14, 13, 1, old);
    world.place('nestbox', 15, 5, 0, old);
    // южная пустошь — территория вдвое меньше карты
    world.place('pine', 6, 18, 0, old);
    world.place('maple', 12, 20, 0, old);
    world.place('pine', 18, 18, 0, old);
    world.place('sakura', 16, 22, 0, old);
    world.place('rock_trio', 10, 19, 1, old);
    scatter(world, old, 5, 16, 15, 8, 5);
  },
};

/** Широкая вода с ивами и камышами — цаплиный край. */
const zavod: Preset = {
  id: 'zavod',
  name: 'Ивовая заводь',
  startMonth: 6,
  monthsOld: 9,
  hint: `Дом 5×4 у широкой воды: ивы, камыши, цапли по зорям. ${startHint(6, 9)}`,
  build: (world, old) => {
    clearToMoss(world);
    house(world, 2, 3, 5, 4);
    pond(world, 12, 8, 9, 7);
    world.place('willow', 11, 7.5, 0, old);
    world.place('willow', 20.5, 9, 0, old);
    world.place('willow', 19, 15.5, 0, old);
    world.place('willow', 11.5, 14.5, 0, old);
    for (const [x, y] of [
      [12, 15.5],
      [20, 14.5],
      [21, 8],
      [13, 7],
    ] as [number, number][]) {
      if (world.canPlace('reed', x, y)) world.place('reed', x, y, 0, old);
    }
    world.place('iris', 11, 12, 0, old);
    world.place('iris', 21.5, 11, 0, old);
    world.place('lotus', 15, 10, 0, old);
    world.place('lotus', 18, 12, 0, old);
    world.place('lilypad', 14, 12, 0, old);
    world.place('lilypad', 17, 9.5, 0, old);
    world.place('lilypad', 19, 13.5, 0, old);
    world.place('koi', 15, 11.5, 0, old);
    world.place('koi', 17.5, 10.5, 0, old);
    world.place('koi', 16, 13, 0, old);
    world.place('bridge', 15, 7, 0, old);
    world.place('rock_trio', 21, 16, 1, old);
    world.place('rock_mid', 10.5, 9, 0, old);
    world.place('lantern_stone', 10.5, 8.5, 0, old);
    world.place('lantern_stone', 20, 15.5, 0, old);
    world.place('lantern_path', 8, 10, 0, old);
    furnish(world, old, [
      ['tokonoma', 2.5, 3, 0],
      ['tansu', 4.5, 3, 0],
      ['indoor_plant', 6, 3, 0],
      ['table', 4, 5, 0],
      ['cushion', 3, 5.5, 0],
      ['cushion', 5, 5.5, 0],
      ['futon', 2.5, 6, 1],
      ['byobu', 4.5, 6, 1],
      ['irori', 6, 5, 0],
    ]);
    world.place('cat', 5.5, 6.5, 0, old);
    world.place('bowl', 7, 7, 0, old);
    world.place('wind_chime', 6.5, 2.5, 0, old);
    world.place('tsukubai', 8, 7.5, 0, old);
    world.place('maple', 8, 17, 0, old);
    world.place('pine', 4, 12, 0, old);
    world.place('ginkgo', 23, 18, 0, old);
    world.place('sakura', 7, 20, 0, old);
    world.place('bamboo', 2, 9, 0, old);
    world.place('bamboo', 2.5, 10, 0, old);
    world.place('azalea', 9, 8, 0, old);
    world.place('hedge', 6, 14, 0, old);
    world.place('garden_bench', 10, 16, 0, old);
    world.place('jizo', 10, 7, 0, old);
    world.place('hammock', 8, 13, 1, old);
    scatter(world, old, 3, 16, 18, 10, 9);
  },
};

/** Горный исток во всю карту: террасы, ручей от кромки, озеро внизу. */
const klyuch: Preset = {
  id: 'klyuch',
  name: 'Горный ключ',
  startMonth: 9,
  monthsOld: 16,
  hint: `Террасы, ручей от самой кромки и озеро. Самый большой сад. ${startHint(9, 16)}`,
  build: (world, old) => {
    clearToMoss(world);
    house(world, 2, 2, 3, 3);
    for (let y = 0; y < 9; y++)
      for (let x = 11; x < 24; x++) {
        const dx = (x - 17.1) / 4.5,
          dy = (y + 0.2) / 6;
        const ridge = 1 - Math.hypot(dx, dy) + Math.sin(x * 1.4 + y * 0.8) * 0.1;
        const t = world.at(x, y)!;
        t.level = ridge > 0.6 ? 2 : ridge > 0.12 ? 1 : 0;
        if (t.level > 0 && hash2(x, y, 431) > 0.46) t.ground = 'stone';
      }
    const channel: [number, number, number][] = [
      [16, 17, 2],
      [16, 17, 2],
      [15, 17, 2],
      [15, 16, 1],
      [14, 16, 1],
      [14, 15, 1],
      [13, 15, 0],
      [13, 14, 0],
      [12, 14, 0],
      [12, 13, 0],
      [12, 13, 0],
      [11, 13, 0],
      [11, 12, 0],
      [11, 12, 0],
      [10, 13, 0],
    ];
    channel.forEach(([left, right, level], y) => {
      for (let x = left - 1; x <= right + 1; x++) world.at(x, y)!.level = level;
      for (let x = left; x <= right; x++) Object.assign(world.at(x, y)!, { water: true, ground: 'water' });
    });
    for (let y = 14; y <= 21; y++)
      for (let x = 7; x <= 19; x++) {
        const dx = (x + 0.5 - 13) / 5.4,
          dy = (y + 0.5 - 17.7) / 3.9;
        const shore = 1 + Math.sin(y * 1.1 + x * 0.55) * 0.075;
        if (dx * dx + dy * dy <= shore) Object.assign(world.at(x, y)!, { level: 0, water: true, ground: 'water' });
      }
    for (let y = 0; y < 8; y++)
      for (let x = 12; x < 20; x++) {
        const t = world.at(x, y)!;
        if (
          !t.water &&
          hash2(x, y, 421) > 0.55 &&
          [
            [1, 0],
            [-1, 0],
            [0, 1],
            [0, -1],
          ].some(([dx, dy]) => world.at(x + dx, y + dy)?.water)
        )
          t.ground = 'stone';
      }
    world.smoothTerrain();
    world.place('bridge', 12.5, 9, 0, old);
    world.place('bridge', 11.5, 12, 0, old);
    for (const [x, y] of [
      [11, 10],
      [14, 10],
      [10, 13],
      [13, 13],
    ])
      world.at(x, y)!.ground = 'stone';
    world.place('rock_big', 12, 3, 0, old);
    world.place('rock_mid', 15, 8, 1, old);
    world.place('rock_mid', 7, 13, 0, old);
    world.place('rock_trio', 17, 12, 1, old);
    world.place('pine', 18, 0, 0, old);
    world.place('pine', 20, 1, 0, old);
    world.place('pine', 14, 1, 0, old);
    world.place('maple', 8, 8, 0, old);
    world.place('willow', 6.5, 15.5, 0, old);
    world.place('willow', 18.5, 17.5, 0, old);
    world.place('bamboo', 20.5, 0.5, 0, old);
    world.place('bamboo', 21, 1.5, 0, old);
    world.place('bamboo', 19, 2, 0, old);
    world.place('lantern_stone', 10.5, 9.5, 0, old);
    world.place('lantern_path', 14, 12.5, 0, old);
    world.place('fern', 16.5, 6.5, 0, old);
    world.place('iris', 7, 17, 0, old);
    world.place('iris', 17.5, 20.5, 0, old);
    world.place('cat', 3.5, 3.5, 0, old);
    furnish(world, old, [
      ['table', 3.5, 3, 0],
      ['cushion', 3, 3.5, 0],
      ['tansu', 4, 2, 0],
      ['tokonoma', 2, 2, 0],
      ['indoor_plant', 4.5, 4, 0],
    ]);
    world.place('lotus', 10, 15, 0, old);
    world.place('lilypad', 11, 16, 0, old);
    world.place('lilypad', 13, 18, 0, old);
    for (const [a, b] of [
      [
        [6, 6],
        [11, 10],
      ],
      [
        [11, 10],
        [10, 13],
      ],
      [
        [14, 10],
        [13, 13],
      ],
      [
        [13, 13],
        [16, 14],
      ],
    ]) {
      const path = findPath(world, { x: a[0], y: a[1] }, { x: b[0], y: b[1] });
      for (const c of path ?? []) {
        const t = world.at(c.x, c.y)!;
        if (t.indoor || t.veranda || t.water) continue;
        if (world.objects.some((o) => o.type === 'step_stone' && o.tx === c.x && o.ty === c.y)) continue;
        if (world.canPlace('step_stone', c.x, c.y)) world.place('step_stone', c.x, c.y, 0, old);
      }
    }
    for (const [type, x, y] of [
      ['reed', 7, 18],
      ['reed', 17, 20],
      ['horsetail', 18, 16],
      ['iris', 8, 14],
      ['fern', 16, 7],
      ['rock_mid', 18, 19],
    ] as [string, number, number][]) {
      if (world.canPlace(type, x, y)) world.place(type, x, y, 0, old);
    }
    world.place('koi', 12, 17, 0, old);
    world.place('koi', 14, 18, 0, old);
    world.place('garden_bench', 9, 11, 0, old);
    world.place('jizo', 17, 12, 0, old);
    world.place('nestbox', 6, 10, 0, old);
  },
};

/** Сухой сад камней: гравий, валуны, три сосны. Воды нет вовсе. */
const kare: Preset = {
  id: 'kare',
  name: 'Сад камней',
  startMonth: 0,
  monthsOld: 7,
  hint: `Карэсансуй: гравий, острова валунов и три сосны. Без воды. ${startHint(0, 7)}`,
  build: (world, old) => {
    clearToMoss(world);
    house(world, 3, 3, 3, 3);
    scatterGround(world, 3, 8, 15, 8, 'gravel');
    world.place('rock_big', 8, 10, 0, old);
    world.place('rock_trio', 12, 12, 0, old);
    world.place('rock_mid', 15, 9, 1, old);
    world.place('rock_mid', 6, 13, 2, old);
    for (const [x, y] of [
      [7, 10.5],
      [9, 11],
      [11.5, 12.5],
      [13, 11.5],
      [15.5, 10],
      [5.5, 12.5],
    ] as [number, number][]) {
      world.place('moss_clump', x, y, 0, old);
    }
    world.place('pine', 17, 10, 0, old);
    world.place('pine', 4, 14.5, 0, old);
    world.place('pine', 16, 14, 0, old);
    world.place('azalea', 7, 8.5, 0, old);
    world.place('hedge', 18, 12, 0, old);
    world.place('lantern_stone', 5, 8.5, 0, old);
    world.place('lantern_path', 17, 15.5, 0, old);
    furnish(world, old, [
      ['tokonoma', 3.5, 3, 0],
      ['tansu', 4.5, 3, 0],
      ['indoor_plant', 5, 4, 0],
      ['table', 4, 4.5, 0],
      ['cushion', 4.5, 5, 0],
    ]);
    world.place('cat', 5, 5.5, 0, old);
    world.place('bowl', 6.5, 6, 0, old);
    world.place('wind_chime', 5.5, 2.5, 0, old);
    scatter(world, old, 4, 17, 17, 10, 21);
    world.place('maple', 10, 20, 0, old);
    world.place('pine', 20, 20, 0, old);
    world.place('moss_log', 13, 17, 1, old);
    world.place('stump', 7, 17, 0, old);
    world.place('mushrooms', 8, 17.5, 0, old);
    world.place('matatabi', 12, 17, 0, old);
  },
};

/** Лесная пустошь без дома: чистый лист, саженцы растут вживую. */
const wild: Preset = {
  id: 'wild',
  name: 'Лесная пустошь',
  startMonth: 8,
  monthsOld: 0,
  hint: `Без дома: мох, валуны, лужица. ${startHint(8, 0)}`,
  build: (world, old) => {
    clearToMoss(world);
    scatterGround(world, 10, 10, 6, 5, 'grass');
    pond(world, 14, 13, 3, 2);
    world.place('rock_big', 10, 10, 0, old);
    world.place('rock_mid', 12.5, 11.5, 1, old);
    world.place('rock_trio', 9, 13, 0, old);
    world.place('fern', 11, 12, 0, old);
    world.place('fern', 13, 10.5, 0, old);
    world.place('fern', 8.5, 11.5, 0, old);
    world.place('iris', 14.5, 12.5, 0, old);
    world.place('reed', 13.5, 14.5, 0, old);
    world.place('lantern_stone', 11, 12.5, 0, old);
    // старая роща по кромкам — территория давно дикая
    const wildOld = old - DAY_MS * 30;
    world.place('pine', 6, 6, 0, wildOld);
    world.place('pine', 20, 7, 0, wildOld);
    world.place('maple', 18, 17, 0, wildOld);
    world.place('willow', 16, 14.5, 0, wildOld);
    // три саженца, посаженные только что: вырастут за три игровых дня
    world.place('sakura', 12, 9, 0, old);
    world.place('maple', 9, 15, 0, old);
    world.place('ume', 16, 11, 0, old);
    world.place('stump', 7.5, 10, 0, old);
    world.place('moss_log', 17, 8, 0, old);
    world.place('mushrooms', 11.5, 15.5, 0, old);
    world.place('matatabi', 10, 12, 0, old);
    scatter(world, old, 6, 7, 14, 12, 33);
  },
};

/** Фруктовый сад с самым большим домом (5×6): умэ, наси, персик, юдзу. */
const sad: Preset = {
  id: 'sad',
  name: 'Фруктовый сад',
  startMonth: 4,
  monthsOld: 23,
  hint: `Дом 5×6 и фруктовые террасы: умэ, наси, персик, юдзу. ${startHint(4, 23)}`,
  build: (world, old) => {
    clearToMoss(world);
    house(world, 3, 3, 5, 6);
    scatterGround(world, 10, 4, 12, 14, 'grass');
    world.place('ume', 12, 6, 0, old);
    world.place('nashi', 16, 6, 0, old);
    world.place('peach', 20, 6, 0, old);
    world.place('yuzu', 12, 10, 0, old);
    world.place('persimmon', 16, 10, 0, old);
    world.place('peach', 20, 10, 0, old);
    world.place('ume', 13, 15, 0, old);
    world.place('nashi', 17, 15, 0, old);
    pond(world, 21, 13, 3, 3);
    world.place('lotus', 22, 14, 0, old);
    world.place('lilypad', 21.5, 13.5, 0, old);
    world.place('pavilion', 10, 17, 0, old);
    world.place('beehive', 10.5, 12.5, 0, old);
    for (const [type, x, y] of [
      ['lily', 11, 14],
      ['lily', 12, 13.5],
      ['iris', 9.5, 13.5],
      ['azalea', 9.5, 11],
      ['azalea', 11.5, 11.5],
      ['camellia', 10, 15.5],
    ] as [string, number, number][]) {
      world.place(type, x, y, 0, old);
    }
    for (const [x, y] of [
      [9, 6],
      [9, 8],
      [9, 10],
      [10, 12],
      [10, 14],
      [10, 16],
    ] as [number, number][]) {
      const t = world.at(x, y);
      if (t && !t.water) t.ground = 'stone';
    }
    world.place('lantern_path', 9.5, 7, 0, old);
    world.place('lantern_path', 10.5, 13, 0, old);
    world.place('lantern_stone', 11, 16.5, 0, old);
    world.place('lantern_stone', 20.5, 12, 0, old);
    furnish(world, old, [
      ['tokonoma', 3.5, 3, 0],
      ['bookshelf', 4.5, 3, 0],
      ['tansu', 6, 3, 0],
      ['indoor_plant', 7, 3, 0],
      ['bonsai', 7, 4.5, 0],
      ['kotatsu', 3.5, 5, 0],
      ['table', 5.5, 5, 0],
      ['cushion', 4.5, 5.5, 0],
      ['cushion', 6.5, 5.5, 0],
      ['futon', 3.5, 8, 1],
      ['byobu', 5.5, 8, 1],
      ['irori', 7, 7, 0],
    ]);
    world.place('cat', 6.5, 7.5, 0, old);
    world.place('bowl', 8.5, 7.5, 0, old);
    world.place('wind_chime', 7.5, 2.5, 0, old);
    world.place('tsukubai', 9.5, 8.5, 0, old);
    world.place('fence_wood', 11, 6, 1, old);
    world.place('fence_wood', 11, 8, 1, old);
    world.place('well', 14, 18, 0, old);
    world.place('nestbox', 18, 4, 0, old);
    world.place('hammock', 12, 16, 0, old);
    world.place('woodpile', 9, 19, 0, old);
    world.place('pine', 4, 14, 0, old);
    world.place('maple', 6, 20, 0, old);
    world.place('ginkgo', 14, 20, 0, old);
    world.place('sakura', 20, 19, 0, old);
    scatter(world, old, 11, 17, 10, 8, 41);
  },
};

export const PRESETS: Preset[] = [dvor, zavod, klyuch, kare, wild, sad];

export const PRESET_BY_ID = new Map<string, Preset>(PRESETS.map((p) => [p.id, p]));

export function applyPreset(world: World, id: string): boolean {
  const p = PRESET_BY_ID.get(id);
  if (!p) return false;
  // Собственный календарь территории: посадки и летопись живут в нём же.
  world.timeShift = startShift(p.startMonth, Date.now());
  const nowS = world.now();
  const d = new Date(nowS);
  d.setMonth(d.getMonth() - p.monthsOld);
  const foundedAt = d.getTime();
  p.build(world, foundedAt);
  // вехи как у стартового сада, но без наград
  world.milestones = new Set();
  world.seenTabs = new Set(['ground', 'water', 'relief', 'trees', 'stones', 'micro']);
  world.pendingMilestones = [];
  world.pendingNotes = [];
  world.chronicle = [];
  world.born = foundedAt;
  world.noteObjectsChanged();
  world.observe(nowS, computeTime(nowS).season, false, false);
  world.pendingMilestones.length = 0;
  world.initUnlocks(true);
  return true;
}
