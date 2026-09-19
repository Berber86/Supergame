/**
 * Оригинальные стартовые усадьбы — маленькие, с идеей.
 *
 * Классический сад остаётся прежним (seedStarterGarden), а новые
 * предлагают компактный дом и сильную композицию: исток, островок,
 * мшистый угол, тропа. Все строятся поверх уже сброшенного мира.
 */

import { GRID } from '../core/iso';
import { hash2 } from '../core/rng';
import { World } from './world';
import { DAY_MS } from '../core/clock';
import { findPath } from './paths';

type Builder = (world: World) => void;

export interface Preset {
  id: string;
  name: string;
  hint: string;
  build: Builder;
}

const old = Date.now() - DAY_MS * 9;

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
  // татами
  for (let y = y0; y < y0 + h; y++) {
    for (let x = x0; x < x0 + w; x++) {
      const t = world.at(x, y);
      if (!t) continue;
      t.ground = 'tatami';
      t.indoor = true;
      t.level = 1;
    }
  }
  // энгава — тонкая веранда вокруг
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

function pond(world: World, x0: number, y0: number, w: number, h: number): void {
  world.applyWaterBlock(x0, y0, w, h);
}

function scatterGround(world: World, x0: number, y0: number, w: number, h: number, g: any): void {
  for (let y = y0; y < y0 + h; y++) {
    for (let x = x0; x < x0 + w; x++) {
      const t = world.at(x, y);
      if (t && !t.water && !t.indoor && !t.veranda) t.ground = g;
    }
  }
}

/** Чайный дворик — домик 3×3, пруд 4×3, гравий, два фонаря */
const tea: Preset = {
  id: 'tea',
  name: 'Чайный дворик',
  hint: 'Домик 3×3, пруд-чаша и гравий. Для неспешного чая.',
  build: (world) => {
    clearToMoss(world);
    house(world, 4, 4, 3, 3);
    scatterGround(world, 3, 8, 5, 4, 'gravel');
    pond(world, 11, 9, 4, 3);
    // дорожка камнем
    for (const [x, y] of [
      [7, 7],
      [8, 8],
      [9, 9],
      [10, 9],
    ] as [number, number][]) {
      const t = world.at(x, y);
      if (t) t.ground = 'stone';
    }
    world.place('table', 5, 5, 0, old);
    world.place('cushion', 4.5, 5.5, 0, old);
    world.place('cushion', 5.5, 5.5, 0, old);
    world.place('lantern_stone', 7.5, 8.5, 0, old);
    world.place('maple', 13.5, 6.5, 0, old);
    world.place('pine', 5.5, 12.5, 0, old);
    world.place('azalea', 6.5, 9.5, 0, old);
    world.place('azalea', 9.5, 7.5, 0, old);
    world.place('rock_mid', 11.5, 8.5, 1, old);
    world.place('moss_clump', 6, 11, 0, old);
    world.place('moss_clump', 8, 10.5, 0, old);
    world.place('cat', 5.5, 6.5, 0, old);
    world.place('bowl', 6.5, 6, 0, old);
    world.place('wind_chime', 6.5, 3.5, 0, old);
    world.place('tsukubai', 7.5, 6.5, 0, old);
    world.place('lotus', 12, 10, 0, old);
    world.place('lilypad', 12.5, 11, 0, old);
  },
};

/** Горный исток — каскад прямо от границы карты, длинный ручей, озеро внизу */
const spring: Preset = {
  id: 'spring',
  name: 'Горный исток',
  hint: 'Каскад от самого края карты, ручей-река и озеро. Дом 4×3 сбоку.',
  build: (world) => {
    clearToMoss(world);
    house(world, 2, 2, 4, 3);
    // A single authored watercourse, not disjoint soft pond brushes. All of the
    // lowland water has the same elevation; terraces join through cardinal cells.
    // Small overlapping ridges instead of the brush's broad rectangular platform.
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
      // Dry landing/bank elevation agrees with the adjacent water, so bridges
      // don't perch on a raised ledge on one end and plunge into a hole on the other.
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
    // Sparse rock banks, no solid rectangular stone dams across the channel.
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
    // Deck centres (13,10.5) and (12,13.5); both span X. Their ends sit on
    // dry, level banks at 11.5/14.5 and 10.5/13.5, with water under the arch.
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
    // лес у истока
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
    world.place('table', 3.5, 2.5, 0, old);
    world.place('lotus', 10, 15, 0, old);
    world.place('lilypad', 11, 16, 0, old);
    world.place('lilypad', 13, 18, 0, old);
    // A walking loop: veranda → west banks → bridges → east-bank overlook.
    // A* uses the actual water/obstacle mask, never paints a dam over the river.
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
    // Sparse shore planting, deliberately leaving bridge entries unobstructed.
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
  },
};

/** Островок — дом 3×3 посреди воды, мостик */
const islet: Preset = {
  id: 'islet',
  name: 'Островок',
  hint: 'Домик-остров 3×3 на воде, два мостика, ивы.',
  build: (world) => {
    clearToMoss(world);
    // большое озеро
    pond(world, 6, 6, 14, 12);
    // остров под дом
    for (let y = 11; y <= 14; y++) {
      for (let x = 11; x <= 14; x++) {
        const t = world.at(x, y);
        if (!t) continue;
        t.water = false;
        t.ground = 'moss';
        t.level = 0;
      }
    }
    house(world, 11, 11, 3, 3);
    // перешейки-мостики
    world.place('bridge', 9, 11, 0, old);
    world.place('bridge', 14, 12, 1, old);
    // берега
    world.place('willow', 10.5, 9.5, 0, old);
    world.place('willow', 15.5, 14.5, 0, old);
    world.place('maple', 18.5, 8.5, 0, old);
    world.place('pine', 5.5, 7.5, 0, old);
    world.place('rock_trio', 8.5, 14.5, 0, old);
    world.place('rock_mid', 17.5, 13.5, 0, old);
    world.place('lantern_stone', 10.5, 10.5, 0, old);
    world.place('lantern_stone', 14.5, 14.5, 0, old);
    world.place('lotus', 9.5, 12.5, 0, old);
    world.place('lotus', 15.5, 10.5, 0, old);
    world.place('lilypad', 8.5, 11.5, 0, old);
    world.place('lilypad', 16.5, 12.5, 0, old);
    world.place('koi', 9, 10, 0, old);
    world.place('koi', 16, 9, 0, old);
    world.place('cat', 12, 12, 0, old);
    world.place('bowl', 12.5, 12.5, 0, old);
    world.place('moss_clump', 12.5, 10.5, 0, old);
  },
};

/** Мшистый угол — без дома, только камни и мох, для творчества */
const moss: Preset = {
  id: 'moss',
  name: 'Мшистый угол',
  hint: 'Без дома. Камни, мох, папоротник — чистый лист.',
  build: (world) => {
    clearToMoss(world);
    // немного гравия
    scatterGround(world, 8, 8, 10, 8, 'gravel');
    scatterGround(world, 10, 10, 6, 4, 'moss');
    // валуны
    world.place('rock_big', 10, 10, 0, old);
    world.place('rock_mid', 12.5, 11.5, 1, old);
    world.place('rock_mid', 9.5, 13.5, 2, old);
    world.place('rock_trio', 14.5, 9.5, 0, old);
    world.place('rock_trio', 11.5, 14.5, 1, old);
    // растения
    for (let i = 0; i < 30; i++) {
      const tx = Math.round((8 + hash2(i, 3, 77) * 10) * 4) / 4;
      const ty = Math.round((8 + hash2(i, 9, 91) * 10) * 4) / 4;
      const t = world.at(Math.floor(tx), Math.floor(ty));
      if (!t || t.water || t.indoor) continue;
      const kind = hash2(i, 7, 13) > 0.6 ? 'moss_clump' : hash2(i, 11, 17) > 0.5 ? 'fern' : 'grass_tuft';
      world.place(kind, tx, ty, 0, old);
    }
    world.place('maple', 16.5, 9.5, 0, old);
    world.place('pine', 7.5, 12.5, 0, old);
    world.place('azalea', 13.5, 8.5, 0, old);
    world.place('lantern_stone', 9.5, 9.5, 0, old);
    // маленький пруд-лужица
    pond(world, 15, 14, 3, 2);
    world.place('iris', 15.5, 13.5, 0, old);
  },
};

/** Заброшенная тропа — дом 3×4, длинная тропа к тории */
const path: Preset = {
  id: 'path',
  name: 'Заброшенная тропа',
  hint: 'Домик 3×4 и тропа через весь сад к тории.',
  build: (world) => {
    clearToMoss(world);
    house(world, 2, 2, 3, 4);
    // тропа камнем зигзагом
    const steps: [number, number][] = [
      [5, 6],
      [6, 7],
      [7, 8],
      [8, 9],
      [9, 10],
      [10, 11],
      [11, 12],
      [12, 13],
      [13, 14],
      [14, 15],
      [15, 16],
      [16, 16],
      [17, 17],
      [18, 18],
      [19, 19],
      [20, 20],
      [21, 21],
    ];
    for (const [x, y] of steps) {
      const t = world.at(x, y);
      if (t && !t.water) t.ground = 'stone';
    }
    // обочина — мох и цветы
    for (let i = 0; i < steps.length; i++) {
      if (i % 3 !== 0) continue;
      const [x, y] = steps[i];
      world.place(i % 2 === 0 ? 'moss_clump' : 'grass_tuft', x + 0.5, y + 0.5, 0, old);
    }
    world.place('torii', 22, 21, 0, old);
    world.place('pavilion', 18, 18, 0, old);
    world.place('lantern_path', 6.5, 7.5, 0, old);
    world.place('lantern_path', 10.5, 11.5, 0, old);
    world.place('lantern_path', 14.5, 15.5, 0, old);
    world.place('lantern_stone', 18.5, 17.5, 0, old);
    world.place('bamboo', 3.5, 7.5, 0, old);
    world.place('bamboo', 4, 8, 0, old);
    world.place('bamboo', 22, 19, 0, old);
    world.place('maple', 12.5, 10.5, 0, old);
    world.place('maple', 16.5, 14.5, 0, old);
    world.place('sakura', 8.5, 9.5, 0, old);
    world.place('hedge', 5.5, 10.5, 0, old);
    world.place('hedge', 15.5, 12.5, 0, old);
    world.place('azalea', 9.5, 12.5, 0, old);
    world.place('cat', 3, 4, 0, old);
    world.place('table', 3.5, 3, 0, old);
    pond(world, 14, 6, 4, 3);
    world.place('rock_mid', 15, 5, 0, old);
  },
};

/** Маленькая деревня — три малых дома, улей и пчёлы */
const village: Preset = {
  id: 'village',
  name: 'Маленькая деревня',
  hint: 'Чайный домик, сарай, маленький дом и улей. Сад как деревенька.',
  build: (world) => {
    clearToMoss(world);
    // центральная лужайка
    scatterGround(world, 6, 6, 14, 12, 'grass');
    scatterGround(world, 8, 8, 10, 8, 'moss');
    // дорожка
    for (const [x, y] of [
      [10, 14],
      [11, 14],
      [12, 14],
      [13, 14],
      [14, 14],
      [15, 13],
      [16, 12],
    ] as [number, number][]) {
      const t = world.at(x, y);
      if (t) t.ground = 'stone';
    }
    // малые дома
    world.place('tea_house', 8, 8, 0, old);
    world.place('tiny_house', 14, 7, 1, old);
    world.place('shed', 12, 15, 0, old);
    world.place('pavilion', 18, 15, 0, old);
    // улей — сердце
    world.place('beehive', 11.5, 11.5, 0, old);
    world.place('feeder', 9.5, 13.5, 0, old);
    world.place('birdbath', 16.5, 9.5, 0, old);
    // цветы для пчёл
    world.place('azalea', 10.5, 10.5, 0, old);
    world.place('azalea', 12.5, 10.5, 0, old);
    world.place('camellia', 9.5, 11.5, 0, old);
    world.place('lily', 13.5, 12.5, 0, old);
    world.place('lily', 14.5, 11.5, 0, old);
    world.place('iris', 10.5, 12.5, 0, old);
    world.place('grass_tuft', 11, 13, 0, old);
    world.place('moss_clump', 15, 14, 0, old);
    // деревья
    world.place('sakura', 6.5, 9.5, 0, old);
    world.place('maple', 19.5, 8.5, 0, old);
    world.place('pine', 7.5, 16.5, 0, old);
    world.place('ginkgo', 17.5, 16.5, 0, old);
    world.place('bamboo', 5.5, 14.5, 0, old);
    // свет
    world.place('lantern_stone', 10.5, 8.5, 0, old);
    world.place('lantern_path', 12.5, 14.5, 0, old);
    world.place('lantern_path', 15.5, 13.5, 0, old);
    // кот и мелочи
    world.place('cat', 9, 9, 0, old);
    world.place('cushion', 9.5, 9.5, 0, old);
    world.place('bowl', 10, 9, 0, old);
    world.place('table', 8.5, 8.5, 0, old);
    // маленький пруд
    pond(world, 17, 11, 3, 3);
    world.place('lotus', 18, 12, 0, old);
    world.place('rock_mid', 16, 11, 0, old);
  },
};

export const PRESETS: Preset[] = [tea, spring, islet, moss, path, village];

export const PRESET_BY_ID = new Map<string, Preset>(PRESETS.map((p) => [p.id, p]));

export function applyPreset(world: World, id: string): boolean {
  const p = PRESET_BY_ID.get(id);
  if (!p) return false;
  // сброс уже сделан вызывающим, но на всякий — чистим
  p.build(world);
  // вехи как у стартового сада, но без наград
  world.milestones = new Set();
  world.seenTabs = new Set(['ground', 'water', 'relief', 'trees', 'stones', 'micro']);
  world.pendingMilestones = [];
  world.pendingNotes = [];
  world.chronicle = [];
  world.born = Date.now();
  world.noteObjectsChanged();
  world.observe(Date.now(), 'spring', false, false);
  world.pendingMilestones.length = 0;
  world.initUnlocks(true);
  return true;
}
