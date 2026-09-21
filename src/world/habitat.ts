import { stonePerchHeight, STONE_TYPES } from './stone';
import { isFruitTree, fruitYear } from './orchard';
import { ecologyYear, wildlifeActivity, nectarBloom } from './ecology';
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
  /** Кусты и изгороди — укрытие ёжика и мыши. */
  shrubs: Vec[];
  /** Тихие травяные поляны у деревьев — туда выходит олень. */
  glades: Vec[];
  /** Тенистые уголки под кустами — туда выходит ёжик. */
  hedgehogSpots: Vec[];
  /** Укромные места у дома и кормушек — туда выходит мышка. */
  mouseSpots: Vec[];
  /** Высокие насесты — беседка, тории, старые деревья — туда садится сова. */
  owlSpots: Vec[];
  /** Деревья и бельчатники — туда приходит белка. */
  squirrelSpots: Vec[];
  /** Камни у воды, где греется черепаха. */
  turtleSpots: Vec[];
  /** Dry warm stones / crevices: lizards never need a pond to visit. */
  lizardSpots: (Vec & { lift: number })[];
  lizardShelters: Vec[];
  /** Цветы и ульи — туда летят пчёлы. */
  beeSpots: (Vec & { type?: string; seed?: number })[];
  /** Ульи — зовут пчёл. */
  beehives: Vec[];
  fruitSpots: (Vec & { type: string; seed: number })[];
  /** Бельчатники — зовут белок. */
  squirrelFeeders: Vec[];
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
    shrubs: [],
    glades: [],
    hedgehogSpots: [],
    mouseSpots: [],
    owlSpots: [],
    squirrelSpots: [],
    turtleSpots: [],
    lizardSpots: [],
    lizardShelters: [],
    beeSpots: [],
    beehives: [],
    fruitSpots: [],
    squirrelFeeders: [],
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
      // За туманом растущего сада вода жизни не даёт
      if (!inside(x, y)) {
        seen[i] = 1;
        continue;
      }
      const pond: Pond = { id: pondId++, cx: 0, cy: 0, area: 0, shores: [] };
      const queue: number[] = [i];
      seen[i] = 1;
      const shoreSet = new Set<number>();
      while (queue.length) {
        const k = queue.pop()!;
        const kx = k % GRID;
        const ky = (k / GRID) | 0;
        if (inside(kx, ky)) {
          pond.cx += kx + 0.5;
          pond.cy += ky + 0.5;
          pond.area++;
        }
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
          } else if (!shoreSet.has(j) && inside(nx, ny)) {
            shoreSet.add(j);
          }
        }
      }
      pond.cx /= pond.area;
      pond.cy /= pond.area;
      for (const j of shoreSet) pond.shores.push({ x: (j % GRID) + 0.5, y: ((j / GRID) | 0) + 0.5 });
      if (pond.area > 0) {
        h.ponds.push(pond);
        h.water += pond.area;
      }
    }
  }

  // --- Предметы: насесты, укрытия, кормушки, кошачье хозяйство ---
  const grownTrees: Vec[] = [];
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
      // Гамак и мататаби — кошачьи магниты: коты дремлют и трутся.
      case 'cushion':
      case 'hammock':
      case 'matatabi':
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
        h.owlSpots.push({ x: c.x, y: c.y - 0.3 });
        break;
      case 'beehive':
        h.beehives.push(c);
        break;
      case 'squirrel_feeder':
        h.squirrelFeeders.push(c);
        h.squirrelSpots.push(c);
        break;
      default:
        break;
    }
    const dry = world.at(Math.floor(c.x), Math.floor(c.y));
    if (dry && !dry.water && !dry.indoor && !dry.veranda) {
      if (STONE_TYPES.has(o.type) && o.type !== 'water_stone') {
        h.lizardSpots.push({ ...c, lift: stonePerchHeight(o.type, o.seed, o.rot) });
        h.lizardShelters.push({ ...c });
      }
      // Замшелое бревно — тёплый насест ящерице и укрытие в жару.
      if (o.type === 'moss_log') {
        h.lizardSpots.push({ ...c, lift: 6 });
        h.lizardShelters.push({ ...c });
      }
      // Пень и поленница — тихие укрытия мышам и ежам.
      if (o.type === 'stump' || o.type === 'woodpile') h.shelters.push(c);
      if (item.kind === 'shrub' || o.type === 'fern' || o.type === 'grass_tuft') h.lizardShelters.push(c);
    }
    if (PERCH_TYPES.includes(o.type)) h.perches.push(c);
    if (item.kind === 'tree') {
      h.trees.push(c);
      // Старые высокие деревья — насест для совы и дом для белки.
      // Саженец сосны ещё не дом: сперва дорастёт (три игровых дня).
      if (world.growth(o, world.now()) >= 1) {
        grownTrees.push(c);
        h.owlSpots.push({ x: c.x, y: c.y });
        if (isFruitTree(o.type) || ['pine', 'maple', 'ginkgo', 'persimmon', 'sakura', 'willow'].includes(o.type)) {
          h.squirrelSpots.push(c);
        }
      }
    }
    if (item.kind === 'shrub' || o.type === 'hedge') h.shrubs.push(c);
    if (isFruitTree(o.type)) {
      const tile = world.at(Math.floor(c.x), Math.floor(c.y));
      if (tile && !tile.water && !tile.indoor && !tile.veranda) h.fruitSpots.push({ ...c, type: o.type, seed: o.seed });
    }
    if (isFruitTree(o.type) || ['lily', 'iris', 'azalea', 'lotus', 'wisteria', 'camellia'].includes(o.type)) {
      h.beeSpots.push({ ...c, type: o.type, seed: o.seed });
    }
    if (['rock_mid', 'rock_big', 'water_stone'].includes(o.type)) {
      // Камень у воды — место для черепахи
      const nearWater = h.ponds.length === 0 || world.objects.some(() => true); // проверим позже через близость к воде в turtleSpots сборке
      void nearWater;
      h.turtleSpots.push(c);
    }
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

  // --- Уголки ёжика: под кустами, у изгороди, в тени деревьев на мху ---
  // Ёжик любит кусты, опавшую листву и тихие кромки
  for (const s of h.shrubs) h.hedgehogSpots.push({ x: s.x + 0.2, y: s.y + 0.2 });
  for (const g of h.glades) if (h.hedgehogSpots.length < 32) h.hedgehogSpots.push(g);
  for (let y = 1; y < GRID - 1 && h.hedgehogSpots.length < 32; y += 3) {
    for (let x = 1; x < GRID - 1 && h.hedgehogSpots.length < 32; x += 3) {
      if (!inside(x, y)) continue;
      const t = world.tiles[y * GRID + x];
      if (t.water || t.indoor) continue;
      if (t.ground !== 'moss' && t.ground !== 'grass' && t.ground !== 'gravel') continue;
      if (world.objects.some((o) => Math.abs(o.tx + 0.5 - (x + 0.5)) < 0.8 && Math.abs(o.ty + 0.5 - (y + 0.5)) < 0.8))
        continue;
      const nearShrub = h.shrubs.some((tr) => Math.hypot(tr.x - (x + 0.5), tr.y - (y + 0.5)) < 4);
      const nearTree = h.trees.some((tr) => Math.hypot(tr.x - (x + 0.5), tr.y - (y + 0.5)) < 4);
      if (!nearShrub && !nearTree) continue;
      h.hedgehogSpots.push({ x: x + 0.5, y: y + 0.5 });
    }
  }

  // --- Укромные места мышки: у кормушек, мисок, веранды, камней, в доме ---
  for (const f of h.feeders) h.mouseSpots.push(f);
  for (const b of h.bowls) h.mouseSpots.push(b);
  for (const s of h.shelters) if (h.mouseSpots.length < 24) h.mouseSpots.push(s);
  // Камни и бревна — тоже укрытия. Мышка прячется у подножия с юга
  // («под камнем»), а не в центре отпечатка: там она оказывалась
  // погребена внутри валуна.
  for (const o of world.objects) {
    if (h.mouseSpots.length >= 24) break;
    if (!['rock_mid', 'rock_big', 'rock_trio', 'pebbles'].includes(o.type)) continue;
    const item = ITEM_BY_ID.get(o.type);
    if (!item) continue;
    const cx = o.tx + item.w / 2;
    const front = world.at(Math.floor(cx), Math.floor(o.ty + item.h + 0.2));
    const c: Vec =
      front && !front.water && !front.indoor && !front.veranda
        ? { x: cx, y: o.ty + item.h + 0.2 }
        : { x: cx, y: o.ty + item.h / 2 };
    if (!inside(Math.floor(c.x), Math.floor(c.y))) continue;
    // Камень на воде укрытием не бывает: мышь не должна идти вброд
    const ct = world.at(Math.floor(c.x), Math.floor(c.y));
    if (!ct || ct.water || ct.indoor) continue;
    h.mouseSpots.push(c);
  }
  // Мышь не идёт в воду: камыши и отмели на водяных клетках отсеиваем,
  // иначе зверёк «бегает по воде» в попытке спрятаться в укрытии.
  h.mouseSpots = h.mouseSpots.filter((s) => {
    const t = world.at(Math.floor(s.x), Math.floor(s.y));
    return !!t && !t.water && !t.indoor;
  });
  // Если совсем пусто — хоть где-то у края мха
  if (h.mouseSpots.length === 0) {
    for (let y = 1; y < GRID - 1 && h.mouseSpots.length < 6; y += 4) {
      for (let x = 1; x < GRID - 1 && h.mouseSpots.length < 6; x += 4) {
        if (!inside(x, y)) continue;
        const t = world.tiles[y * GRID + x];
        if (t.water || t.indoor) continue;
        h.mouseSpots.push({ x: x + 0.5, y: y + 0.5 });
      }
    }
  }

  // --- Совы: высокие точки — беседка, тории, старые деревья ---
  // Уже наполнены в обходе предметов; запасные поляны — лишь когда деревьев нет вовсе.
  if (h.owlSpots.length === 0 && h.trees.length === 0) {
    for (const g of h.glades) if (h.owlSpots.length < 8) h.owlSpots.push(g);
  }

  // --- Белки: взрослые деревья + бельчатники ---
  if (h.squirrelSpots.length === 0 && h.trees.length === 0) {
    for (const tr of h.trees) h.squirrelSpots.push(tr);
  }
  // Добавим ещё немного точек у деревьев для прыжков — когда есть взрослое дерево
  if (grownTrees.length)
    for (const g of h.glades)
      if (h.squirrelSpots.length < 24) h.squirrelSpots.push({ x: g.x + (Math.random() - 0.5), y: g.y });

  // --- Черепахи: камни у воды ---
  // Фильтруем камни, оставляем только те, что в 2.5 тайла от воды
  {
    const nearWater: Vec[] = [];
    for (const s of h.turtleSpots) {
      let ok = false;
      for (const p of h.ponds) {
        for (const shore of p.shores) {
          if (Math.hypot(shore.x - s.x, shore.y - s.y) < 3.2) {
            ok = true;
            break;
          }
        }
        if (ok) break;
      }
      // Если прудов нет, считаем что камень у воды, если рядом есть влажный тайл
      if (!ok && h.ponds.length === 0) ok = true;
      if (ok) nearWater.push(s);
    }
    // Если камней у воды нет — берём берега прудов
    if (nearWater.length === 0) {
      for (const p of h.ponds) for (const sh of p.shores) if (nearWater.length < 12) nearWater.push(sh);
    }
    h.turtleSpots = nearWater;
  }

  // --- Пчёлы: цветы + ульи ---
  if (h.beeSpots.length === 0) {
    for (const g of h.glades) if (h.beeSpots.length < 12) h.beeSpots.push(g);
  }
  // A hive is a home, not a source of nectar.

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

/** Deep canopy isn't a basking platform; use light openings rather than every rock. */
export function sunnyLizardSpots(h: Habitat): Habitat['lizardSpots'] {
  return h.lizardSpots.filter((p) => !h.trees.some((t) => Math.hypot(t.x - p.x, t.y - p.y) < 1));
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
  /** Ёжик: преимущественно ночной, любит кусты и тихие уголки. */
  hedgehog: number;
  /** Мышки: у кормушек, мисок, камней — кошки их гоняют. */
  mice: number;
  /** Сова: ночной охотник, любит высокие насесты, охотится на мышей. */
  owl: number;
  /** Белка: дневная, любит хвойные и широколиственные, бельчатники. */
  squirrel: number;
  /** Черепаха: греется на камне у воды днём. */
  turtle: number;
  lizard: number;
  /** Пчёлы: цветы и ульи, тёплый день. */
  bees: number;
  /** Мотыльки: тёплая ночь у света и цветов, спутники светлячков. */
  moths: number;
}

const nectarCache = new WeakMap<Habitat, { key: number; habitat: Habitat }>();
/** Filter existing sites by their actual bloom; no re-scan of the world per insect/frame. */
export function floweringHabitat(h: Habitat, now: number): Habitat {
  const key = Math.floor(now / 21_600_000),
    old = nectarCache.get(h);
  if (old?.key === key) return old.habitat;
  const time = (key + 0.5) * 21_600_000;
  const habitat = {
    ...h,
    fruitSpots: h.fruitSpots.filter(
      (p) => (p.type === 'peach' || p.type === 'nashi') && fruitYear(p.type, p.seed, time).ground > 0.2,
    ),
    beeSpots: h.beeSpots.filter((p) => nectarBloom(p.type ?? 'wildflowers', p.seed ?? 17, time) > 0.12),
  };
  nectarCache.set(h, { key, habitat });
  return habitat;
}

/**
 * Правила приглашения. Числа подобраны так, чтобы жителей было заметно,
 * но немного: это дзен-песочница, а не ферма. Сезон и погода важнее
 * статистики — состав меняется сам, без единого счётчика у игрока.
 */
export function invitations(h: Habitat, t: TimeState, wx: WeatherState | null, wind = 0.5): Invitation {
  h = floweringHabitat(h, t.now);
  const activity = wildlifeActivity(t, wx, wind),
    year = ecologyYear(t.now);
  const season = t.season;
  const rain = wx ? Math.max(wx.rain, wx.snow * 0.6) : 0;
  const wet = wx ? wx.wetness : 0;
  const stormy = wx ? wx.kind === 'storm' : false;

  // ---- Лягушки: зимой спят в иле, в дождь выходят и заметнее всего ----
  let frogs = 0;
  if (activity.frogs > 0) {
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
  const base = 5;
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
  if (activity.fireflies > 0 && t.daylight < 0.18 && rain < 0.15 && !stormy) {
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

  // ---- Ёжик: преимущественно ночной, любит кусты и тихие уголки, зимой спит ----
  let hedgehog = 0;
  if (activity.hedgehog > 0 && h.hedgehogSpots.length > 0 && t.daylight < 0.32 && !stormy) {
    // Чем больше кустов и полян, тем вероятнее
    const cover = h.shrubs.length + h.trees.length * 0.3;
    if (cover >= 2) {
      // Ночью почти всегда, в сумерках реже
      const nightK = t.daylight < 0.18 ? 1 : t.daylight < 0.32 ? 0.6 : 0.15;
      if (rain < 0.45) hedgehog = Math.min(2, Math.floor(cover / 4) + 1) * (nightK > 0.5 ? 1 : 0);
      // Если кустов много — может выйти и один
      if (hedgehog === 0 && nightK > 0.5 && cover >= 3 && h.hedgehogSpots.length >= 3) hedgehog = 1;
      // Днём ёжик не выходит, кроме сильной облачности / дождя
      if (t.daylight >= 0.32 && rain < 0.2) hedgehog = 0;
    }
  }

  // ---- Мышки: у кормушек, мисок, камней — активны в сумерках и ночью, но могут и днём ----
  let mice = 0;
  if (h.mouseSpots.length > 0 && !stormy) {
    const base = h.feeders.length * 2 + h.bowls.length + (h.veranda > 0 ? 1 : 0) + Math.min(2, h.shrubs.length * 0.5);
    if (base >= 1) {
      // Ночью и в сумерках мышей больше, днём одна-две
      const nightBias = t.daylight < 0.35 ? 1 : 0.45;
      mice = Math.max(1, Math.min(4, Math.floor(base * nightBias + 0.5)));
      if (season === 'winter') mice = Math.min(mice, 2); // зимой меньше
      if (rain > 0.6) mice = Math.max(1, mice - 1);
    }
  }

  // ---- Сова: ночной охотник, любит высокие насесты, тишину ----
  let owl = 0;
  if (h.owlSpots.length > 0 && t.daylight < 0.28 && !stormy && rain < 0.4) {
    // Осенью и зимой совы чаще, летом тоже бывают
    const seasonK = season === 'autumn' || season === 'winter' ? 1 : 0.7;
    if (h.trees.length >= 4 || h.shelters.length > 0) owl = seasonK > 0.8 ? 1 : Math.random() < 0.6 ? 1 : 0;
    // Если есть мыши — сова приходит охотнее
    if (h.mouseSpots.length > 0 && owl === 0 && t.daylight < 0.18) owl = 1;
  }

  // ---- Белка: дневная, любит хвойные и широколиственные, бельчатники ----
  let squirrel = 0;
  if (h.squirrelSpots.length > 0 && t.daylight > 0.35 && !stormy && rain < 0.5) {
    const base = h.squirrelFeeders.length * 2 + Math.floor(h.trees.length / 3);
    if (base >= 1 || h.trees.length >= 6) {
      squirrel = Math.min(2, Math.max(1, Math.floor(base / 2) + 1));
      if (season === 'winter') squirrel = Math.min(squirrel, 1);
    }
  }

  // ---- Черепаха: греется на камне у воды днём, любит тепло ----
  let turtle = 0;
  if (h.turtleSpots.length > 0 && h.water >= 4 && t.daylight > 0.4 && !stormy) {
    turtle = h.water >= 8 ? 2 : 1;
    if (rain > 0.35) turtle = 0;
  }

  // ---- Пчёлы: цветы и ульи, тёплый день, не дождь ----
  let bees = 0;
  if (h.beeSpots.length > 0 && t.daylight > 0.45 && !stormy && rain < 0.2) {
    const flowerK = h.beeSpots.length;
    const hiveK = h.beehives.length * 4;
    bees = Math.min(8, Math.floor((flowerK + hiveK) / 2) + 1);
  }

  // ---- Хор: поют вместе, когда сыро и не полдень ----
  let moths = 0;
  if (activity.moths > 0 && t.daylight < 0.3 && rain < 0.35 && !stormy) {
    // Мотыльки приходят к свету и цветам тёплой ночью, вместе со светлячками
    const lightK = h.shelters.length + h.baths.length;
    moths = 2 + Math.min(6, Math.floor((h.beeSpots.length + lightK) / 2));
    if (h.beeSpots.length === 0) moths = Math.max(0, moths - 2);
    moths += Math.round(2 * year.warmth);
    moths = Math.max(0, Math.min(8, moths));
  }

  // Population counts are discrete; seeded silhouettes fade with the same continuous activity in rendering.
  frogs = Math.floor(frogs * activity.frogs + 0.01);
  dragonflies = Math.floor(dragonflies * activity.dragonflies + 0.01);
  fireflies = Math.floor(fireflies * activity.fireflies + 0.01);
  hedgehog = Math.floor(hedgehog * activity.hedgehog + 0.01);
  turtle = Math.floor(turtle * activity.turtle + 0.01);
  bees = Math.floor(bees * activity.bees + 0.01);
  moths = Math.floor(moths * activity.moths + 0.01);
  const choral = rain > 0.2 || wet > 0.4 || t.hours >= 18 || t.hours < 6;
  const chorus = frogs >= 2 && choral ? frogs : 0;

  return {
    frogs,
    dragonflies,
    feederBirds,
    guestCat,
    chorus,
    fireflies,
    heron,
    deer,
    hedgehog,
    mice,
    owl,
    squirrel,
    turtle,
    lizard:
      sunnyLizardSpots(h).length && h.lizardShelters.length && activity.lizard > 0.15
        ? Math.min(3, Math.max(1, Math.floor(h.lizardSpots.length * activity.lizard)))
        : 0,
    bees,
    moths,
  };
}
