/**
 * Среда обитания: что именно в саду приглашает жителей.
 *
 * Жители открываются через постройки, а не через задания: пруд зовёт
 * лягушек и стрекоз, кормушка — птиц, а второму коту нужны подушка, миска
 * и первый кот. Здесь это сведено в одни чистые правила: сканируем сад
 * и отвечаем, сколько кого сад готов принять в этот час, сезон и погоду.
 *
 * Модуль без DOM и без случайности — его решения проверяются тестами,
 * а не глазами. Случайность живёт выше, в life.ts и residents.ts.
 */

import { GRID, inBounds } from '../core/iso';
import { TimeState } from '../core/clock';
import { ITEM_BY_ID } from './catalog';
import { WeatherState } from './weatherState';
import { World } from './world';

export interface Vec {
  x: number;
  y: number;
}

/** Связный водоём: пруд, заводь или длинная лента ручья. */
export interface Pond {
  id: number;
  cx: number;
  cy: number;
  /** Площадь в тайлах. */
  area: number;
  /** Сухие клетки у кромки — оттуда выходят лягушки. */
  shores: Vec[];
}

export interface Habitat {
  ponds: Pond[];
  /** Всего водных тайлов. */
  water: number;
  /** Кормушки: сюда прилетают птицы. */
  feeders: Vec[];
  /** Поилки: птицы пьют и купаются, стрекозы садятся на край. */
  baths: Vec[];
  /** насесты стрекоз: камыш, хвощ, кувшинки, лотос, камень в воде. */
  perches: Vec[];
  /** Тенистые берега, где лягушке хорошо сидеть. */
  frogSpots: Vec[];
  /** Укрытия от дождя: беседка, тории, веранда дома. */
  shelters: Vec[];
  cushions: Vec[];
  bowls: Vec[];
  /** Деревья: роща зовёт оленя, а летом под ней темнее для светлячков. */
  trees: Vec[];
  /** Тихие травяные поляны у деревьев — туда выходит олень. */
  glades: Vec[];
  /** Сколько в саду кошек-резидентов (предметов «кот»). */
  cats: number;
  /** Клеток веранды — второе место для кошачьего знакомства. */
  veranda: number;
}

/** Растения у воды, на которых сидят стрекозы и прячутся лягушки. */
const PERCH_TYPES = ['reed', 'horsetail', 'water_stone', 'lotus', 'lilypad'];
/** Растительность берега, делающая место пригодным для лягушки. */
const SHORE_PLANTS = ['reed', 'horsetail', 'iris', 'fern', 'lily', 'lotus', 'lilypad', 'moss_clump', 'grass_tuft'];

/**
 * Осмотр сада. Вызывается редко (раз в пару секунд): обход 676 клеток
 * и списка предметов слишком дёшев, чтобы жалеть его, но и гонять его
 * каждый кадр незачем — постройки не двигаются сами.
 */
export function scanHabitat(world: World, bounds?: { x: number; y: number; w: number; h: number } | null): Habitat {
  const inside = (x: number, y: number): boolean =>
    !bounds || (x >= bounds.x && x < bounds.x + bounds.w && y >= bounds.y && y < bounds.y + bounds.h);
  const h: Habitat = {
    ponds: [],
    water: 0,
    feeders: [],
    baths: [],
    perches: [],
    frogSpots: [],
    trees: [],
    glades: [],
    shelters: [],
    cushions: [],
    bowls: [],
    cats: 0,
    veranda: 0,
  };

  // --- Водоёмы: обход в ширину по водным тайлам ---
  const seen = new Uint8Array(GRID * GRID);
  let pondId = 0;
  for (let y = 0; y < GRID; y++) {
    for (let x = 0; x < GRID; x++) {
      const i = y * GRID + x;
      if (seen[i] || !world.tiles[i].water) continue;
      const pond: Pond = { id: pondId++, cx: 0, cy: 0, area: 0, shores: [] };
      const queue: number[] = [i];
      seen[i] = 1;
      const shoreSet = new Set<number>();
      while (queue.length) {
        const k = queue.pop()!;
        const kx = k % GRID;
        const ky = (k / GRID) | 0;
        pond.cx += kx + 0.5;
        pond.cy += ky + 0.5;
        pond.area++;
        for (const [dx, dy] of [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ]) {
          const nx = kx + dx;
          const ny = ky + dy;
          if (!inBounds(nx, ny)) continue;
          const j = ny * GRID + nx;
          if (world.tiles[j].water) {
            if (!seen[j]) {
              seen[j] = 1;
              queue.push(j);
            }
          } else if (!shoreSet.has(j)) {
            shoreSet.add(j);
          }
        }
      }
      pond.cx /= pond.area;
      pond.cy /= pond.area;
      for (const j of shoreSet) pond.shores.push({ x: (j % GRID) + 0.5, y: ((j / GRID) | 0) + 0.5 });
      h.ponds.push(pond);
      h.water += pond.area;
    }
  }

  // --- Предметы: насесты, укрытия, кормушки, кошачье хозяйство ---
  for (const o of world.objects) {
    const item = ITEM_BY_ID.get(o.type);
    if (!item) continue;
    const c: Vec = { x: o.tx + item.w / 2, y: o.ty + item.h / 2 };
    // За границей растущего сада жизнь не считается: там туман
    if (!inside(Math.floor(c.x), Math.floor(c.y))) continue;
    switch (o.type) {
      case 'feeder':
        h.feeders.push(c);
        break;
      case 'birdbath':
        h.baths.push(c);
        break;
      case 'cushion':
        h.cushions.push(c);
        break;
      case 'bowl':
        h.bowls.push(c);
        break;
      case 'cat':
        h.cats++;
        break;
      case 'pavilion':
      case 'torii':
        h.shelters.push(c);
        break;
      default:
        break;
    }
    if (PERCH_TYPES.includes(o.type)) h.perches.push(c);
    if (item.kind === 'tree') h.trees.push(c);
  }

  // --- Берега, где лягушке хорошо: суша у воды с растительностью или тенью ---
  for (const pond of h.ponds) {
    for (const s of pond.shores) {
      const sx = Math.floor(s.x);
      const sy = Math.floor(s.y);
      const t = world.at(sx, sy);
      if (!t || t.indoor || t.veranda) continue;
      let green = false;
      for (const o of world.objects) {
        if (!SHORE_PLANTS.includes(o.type)) continue;
        if (Math.abs(o.tx + 0.5 - s.x) < 1.6 && Math.abs(o.ty + 0.5 - s.y) < 1.6) {
          green = true;
          break;
        }
      }
      // Тенистый мох подходит и без кустика: лягушке нужен прохладный угол
      if (!green && t.ground === 'moss') green = true;
      if (green) h.frogSpots.push(s);
    }
  }
  // Поилка — тоже вода, хоть и маленькая: у неё свои лягушки и стрекозы
  for (const b of h.baths) {
    h.frogSpots.push({ x: b.x + 0.6, y: b.y + 0.4 });
    h.perches.push({ x: b.x - 0.5, y: b.y + 0.3 });
  }

  // --- Поляны: тихая трава недалеко от деревьев, куда выйдет олень ---
  // Шаг 2: сплошной обход нам не нужен, полян и так хватит с запасом.
  for (let y = 1; y < GRID - 1 && h.glades.length < 48; y += 2) {
    for (let x = 1; x < GRID - 1 && h.glades.length < 48; x += 2) {
      if (!inside(x, y)) continue;
      const t = world.tiles[y * GRID + x];
      if (t.water || t.indoor || t.veranda) continue;
      if (t.ground !== 'moss' && t.ground !== 'grass') continue;
      if (world.objects.some((o) => Math.abs(o.tx - x) < 1 && Math.abs(o.ty - y) < 1)) continue;
      const nearTree = h.trees.some((tr) => Math.hypot(tr.x - x, tr.y - y) < 5);
      if (!nearTree) continue;
      h.glades.push({ x: x + 0.5, y: y + 0.5 });
    }
  }

  // --- Веранда: место кошачьих встреч и птижьих укоров ---
  for (let y = 0; y < GRID; y++)
    for (let x = 0; x < GRID; x++) {
      if (!inside(x, y)) continue;
      if (world.tiles[y * GRID + x].veranda) h.veranda++;
    }
  if (h.veranda > 0) {
    // центр веранды берём усреднением по кромке дома
    let vx = 0;
    let vy = 0;
    let n = 0;
    for (let y = 0; y < GRID; y++)
      for (let x = 0; x < GRID; x++) {
        if (!world.tiles[y * GRID + x].veranda) continue;
        vx += x + 0.5;
        vy += y + 0.5;
        n++;
      }
    if (n) h.shelters.push({ x: vx / n, y: vy / n });
  }

  return h;
}

/** Сколько кого сад готов принять прямо сейчас. */
export interface Invitation {
  frogs: number;
  dragonflies: number;
  feederBirds: number;
  /** Условия для второго кота выполнены; придёт ли он и когда — решает случай. */
  guestCat: boolean;
  /** Сколько лягушек готово петь: хор слышно в дождь и под вечер. */
  chorus: number;
  /** Светлячки: тёплая тихая ночь над травой и водой. */
  fireflies: number;
  /** Есть ли повод прийти цапле: большая вода и не гроза. */
  heron: boolean;
  /** Сколько оленей может выйти к роще: один-два, по размеру рощи. */
  deer: number;
}

/**
 * Правила приглашения. Числа подобраны так, чтобы жителей было заметно,
 * но немного: это дзен-песочница, а не ферма. Сезон и погода важнее
 * статистики — состав меняется сам, без единого счётчика у игрока.
 */
export function invitations(h: Habitat, t: TimeState, wx: WeatherState | null, wind = 0.5): Invitation {
  const season = t.season;
  const rain = wx ? Math.max(wx.rain, wx.snow * 0.6) : 0;
  const wet = wx ? wx.wetness : 0;
  const stormy = wx ? wx.kind === 'storm' : false;

  // ---- Лягушки: зимой спят в иле, в дождь выходят и заметнее всего ----
  let frogs = 0;
  if (season !== 'winter') {
    for (const p of h.ponds) {
      if (p.area < 3) continue;
      frogs += p.area >= 12 ? 2 : 1;
    }
    frogs += Math.min(2, h.baths.length);
    // Яркий сухой полдень: лягушки сидят в тени, их не видно
    const brightNoon = t.hours >= 11 && t.hours <= 15 && rain < 0.15 && wet < 0.3;
    if (brightNoon) frogs -= 1;
    // Дождь и мокрая земля вымывают их на открытые места
    if (rain > 0.25 || wet > 0.35) frogs += 2;
    if (h.frogSpots.length === 0) frogs = Math.min(frogs, 1);
    frogs = Math.max(0, Math.min(5, frogs));
  }

  // ---- Стрекозы: лето — их время, зимой их нет, в ливень прячутся ----
  let dragonflies = 0;
  const base = season === 'summer' ? 5 : season === 'autumn' ? 3 : season === 'spring' ? 2 : 0;
  if (base > 0 && h.water >= 4 && !stormy && rain < 0.2 && t.daylight > 0.35) {
    dragonflies = base;
    if (h.perches.length === 0) dragonflies -= 2; // сесть некуда — патруль без отдыха
    if (wind > 1.4) dragonflies -= 2; // в сильный ветер не до полётов
    dragonflies = Math.max(0, Math.min(6, dragonflies));
  }

  // ---- Птицы у кормушки: зимой стол важнее всего, ночью птиц нет ----
  let feederBirds = 0;
  if (h.feeders.length > 0 && t.daylight > 0.25) {
    const per = season === 'winter' ? 3 : season === 'summer' ? 2 : 3;
    feederBirds = per * h.feeders.length;
    // Летом у поилки ещё и купальня
    if (season === 'summer') feederBirds += Math.min(2, h.baths.length);
    else feederBirds += Math.min(1, h.baths.length);
    // Под ливнем сидят по укрытиям, у кормушки дежурит один смельчак
    if (rain > 0.3) feederBirds = Math.min(feederBirds, 1);
    feederBirds = Math.max(0, Math.min(6, feederBirds));
  }

  // ---- Второй кот: первому нужны компания, подушка и миска ----
  const guestCat = h.cats >= 1 && h.cushions.length >= 1 && h.bowls.length >= 1;

  // ---- Светлячки: гаснут днём, в дождь и зимой; любят воду и тень рощи ----
  let fireflies = 0;
  if (season === 'summer' && t.daylight < 0.18 && rain < 0.15 && !stormy) {
    fireflies = 3 + Math.min(6, Math.floor(h.trees.length / 3));
    if (h.water > 0) fireflies += 3;
    fireflies = Math.max(0, Math.min(12, fireflies));
  }

  // ---- Цапля: большая птица приходит к большой воде, днём и на заре ----
  const heron = h.water >= 10 && t.daylight > 0.15 && !stormy;

  // ---- Олень: роща и тихий час, рассвет или сумерки ----
  let deer = 0;
  const deerHours = (t.hours >= 5 && t.hours <= 9) || (t.hours >= 17 && t.hours <= 21);
  if (h.trees.length >= 8 && h.glades.length > 0 && deerHours && rain < 0.3 && !stormy) {
    deer = h.trees.length >= 16 ? 2 : 1;
  }

  // ---- Хор: поют вместе, когда сыро и не полдень ----
  const choral = rain > 0.2 || wet > 0.4 || t.hours >= 18 || t.hours < 6;
  const chorus = frogs >= 2 && choral && season !== 'winter' ? frogs : 0;

  return { frogs, dragonflies, feederBirds, guestCat, chorus, fireflies, heron, deer };
}
