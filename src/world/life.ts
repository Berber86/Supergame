/**
 * Живность сада: кот, птицы, бабочки, стрекозы, карпы.
 * Агенты со своими намерениями — сад должен жить сам по себе, без участия игрока.
 */

import { GRID } from '../core/iso';
import { clamp, clamp01, hash2, lerp, makeRng } from '../core/rng';
import { ITEM_BY_ID } from './catalog';
import { TimeState } from '../core/clock';
import { World } from './world';

export type CatState = 'sleep' | 'sit' | 'walk' | 'wash' | 'stretch' | 'loaf';
export type BirdState = 'fly-in' | 'hop' | 'peck' | 'fly-out';

export interface Vec {
  x: number;
  y: number;
}

/** Общий предок: всё живое знает, где оно и куда смотрит. */
interface Agent {
  tx: number;
  ty: number;
  /** Направление взгляда: -1 влево, 1 вправо. */
  facing: number;
  seed: number;
}

export interface Cat extends Agent {
  id: number;
  state: CatState;
  /** Сколько мс осталось в текущем состоянии. */
  timer: number;
  target: Vec | null;
  /** 0..1 — прогресс анимации внутри состояния. */
  phase: number;
  /** Насколько кот «разогнался» — для плавного шага. */
  speed: number;
  /** Домашняя подушка, если найдена. */
  home: Vec | null;
}

export interface Bird extends Agent {
  state: BirdState;
  timer: number;
  target: Vec | null;
  /** Высота над землёй в пикселях. */
  alt: number;
  hop: number;
  scale: number;
}

export interface Flutter {
  /** Бабочка или стрекоза. */
  kind: 'butterfly' | 'dragonfly';
  tx: number;
  ty: number;
  alt: number;
  vx: number;
  vy: number;
  valt: number;
  target: Vec | null;
  timer: number;
  seed: number;
  phase: number;
  /** Сидит на цветке. */
  resting: number;
}

export interface Fish {
  id: number;
  tx: number;
  ty: number;
  dir: number;
  speed: number;
  seed: number;
  /** Центр родного пруда и его радиус. */
  homeX: number;
  homeY: number;
  /** Плавный поворот. */
  turn: number;
}

/** Порыв ветра — волна, проходящая через сад. */
export interface Gust {
  /** Позиция фронта вдоль оси распространения, в тайлах. */
  pos: number;
  strength: number;
  /** Направление распространения. */
  dx: number;
  dy: number;
  width: number;
}

const rnd = makeRng(20240320);

function tileWalkable(world: World, tx: number, ty: number): boolean {
  const t = world.at(Math.floor(tx), Math.floor(ty));
  if (!t) return false;
  return !t.water;
}

function randomWalkable(world: World, near?: Vec, radius = 6): Vec | null {
  for (let i = 0; i < 40; i++) {
    let x: number;
    let y: number;
    if (near) {
      x = near.x + (rnd() - 0.5) * radius * 2;
      y = near.y + (rnd() - 0.5) * radius * 2;
    } else {
      x = rnd() * GRID;
      y = rnd() * GRID;
    }
    if (x < 1 || y < 1 || x > GRID - 1 || y > GRID - 1) continue;
    if (tileWalkable(world, x, y)) return { x, y };
  }
  return null;
}

/** Ищет объекты заданного типа — коту нужны подушки, птицам земля, бабочкам цветы. */
function findObjects(world: World, types: string[]): Vec[] {
  const out: Vec[] = [];
  for (const o of world.objects) {
    if (!types.includes(o.type)) continue;
    const item = ITEM_BY_ID.get(o.type);
    if (!item) continue;
    out.push({ x: o.tx + item.w / 2, y: o.ty + item.h / 2 });
  }
  return out;
}

export class Life {
  cats: Cat[] = [];
  birds: Bird[] = [];
  flutters: Flutter[] = [];
  fish: Fish[] = [];
  gusts: Gust[] = [];
  /** Общая фаза ветра 0..1 — плавный фон поверх порывов. */
  windBase = 0.45;
  private gustTimer = 4000;
  private birdTimer = 6000;
  /** Лепестки, сорванные с деревьев: сцена забирает их каждый кадр. */
  emitted: { x: number; y: number; kind: 'petal' | 'leaf'; seed: number }[] = [];
  /** Сид состава кои — чтобы рыбы переселялись за своими предметами. */
  private koiKey = '';
  /**
   * Потолок очереди опадающего. Когда сцена не рисуется (дзен-лист),
   * лепестки некому забирать — очередь не должна расти без предела.
   */
  private static EMITTED_CAP = 64;

  /** Забыть всю живность — при переходе в другую усадьбу. */
  reset(): void {
    this.cats = [];
    this.birds = [];
    this.flutters = [];
    this.fish = [];
    this.gusts = [];
    this.emitted = [];
    this.koiKey = '';
  }

  /** Пересобирает агентов под текущий состав сада. */
  sync(world: World): void {
    // --- Коты: по объекту «кот» в саду ---
    //
    // Сверяемся по id предметов, а не по числу: если одного кота убрали,
    // а другого завели между двумя кадрами, количество не изменилось,
    // но это уже другой кот.
    const catObjs = world.objects.filter((o) => o.type === 'cat');
    const sameCats = catObjs.length === this.cats.length && catObjs.every((o, i) => this.cats[i].id === o.id);
    if (!sameCats) {
      this.cats = catObjs.map((o) => {
        const prev = this.cats.find((c) => c.id === o.id);
        if (prev) return prev;
        return {
          id: o.id,
          tx: o.tx + 0.5,
          ty: o.ty + 0.5,
          facing: 1,
          seed: o.seed,
          state: 'sleep' as CatState,
          timer: 4000 + rnd() * 6000,
          target: null,
          phase: 0,
          speed: 0,
          home: null,
        };
      });
    }

    // --- Карпы: по объекту «кои» ---
    //
    // Та же история: снесли кои из одного пруда и посадили в другой
    // тем же числом — рыбы обязаны переселиться за своим предметом,
    // а не кружить над опустевшим местом.
    const koiObjs = world.objects.filter((o) => o.type === 'koi');
    const koiKey = koiObjs.map((o) => o.id).join(',');
    if (koiKey !== this.koiKey) {
      this.koiKey = koiKey;
      this.fish = [];
      for (const o of koiObjs) {
        for (let k = 0; k < 2; k++) {
          this.fish.push({
            id: o.id * 10 + k,
            tx: o.tx + 0.5 + (rnd() - 0.5) * 0.6,
            ty: o.ty + 0.5 + (rnd() - 0.5) * 0.6,
            dir: rnd() * Math.PI * 2,
            speed: 0.00022 + rnd() * 0.00016,
            seed: o.seed + k * 37,
            homeX: o.tx + 0.5,
            homeY: o.ty + 0.5,
            turn: 0,
          });
        }
      }
    }
  }

  update(world: World, t: TimeState, dt: number, now: number): void {
    this.sync(world);
    this.updateWind(dt, t);
    this.updateCats(world, t, dt);
    this.updateBirds(world, t, dt);
    this.updateFlutters(world, t, dt, now);
    this.updateFish(world, dt);
    this.updateFalling(world, t, dt);
  }

  // ---------------- Ветер ----------------

  private updateWind(dt: number, t: TimeState): void {
    const now = performance.now();
    // ровное «дыхание» + сезонная поправка: осенью и зимой ветрено
    const seasonK = t.season === 'autumn' ? 1.25 : t.season === 'winter' ? 1.15 : 1;
    this.windBase = (0.34 + Math.sin(now * 0.00011) * 0.16 + Math.sin(now * 0.00037) * 0.1) * seasonK;

    this.gustTimer -= dt;
    if (this.gustTimer <= 0) {
      this.gustTimer = 5000 + rnd() * 11000;
      const ang = rnd() * Math.PI * 2;
      this.gusts.push({
        pos: -8,
        strength: 0.5 + rnd() * 0.9,
        dx: Math.cos(ang),
        dy: Math.sin(ang),
        width: 6 + rnd() * 7,
      });
    }
    for (let i = this.gusts.length - 1; i >= 0; i--) {
      const g = this.gusts[i];
      g.pos += dt * 0.0075 * (0.7 + g.strength * 0.5);
      if (g.pos > GRID * 1.6 + g.width) this.gusts.splice(i, 1);
    }
  }

  /** Сила ветра в конкретной точке сада — деревья качаются волной, а не разом. */
  windAt(tx: number, ty: number): number {
    let w = this.windBase;
    for (const g of this.gusts) {
      // проекция точки на ось распространения порыва
      const proj = tx * g.dx + ty * g.dy;
      const d = Math.abs(proj - g.pos);
      if (d < g.width) {
        const k = Math.cos((d / g.width) * Math.PI * 0.5);
        w += g.strength * k * k;
      }
    }
    return clamp(w, 0, 2.4);
  }

  // ---------------- Кот ----------------

  private updateCats(world: World, t: TimeState, dt: number): void {
    const cushions = findObjects(world, ['cushion']);
    for (const c of this.cats) {
      c.timer -= dt;
      c.phase += dt * 0.001;
      if (!c.home && cushions.length) c.home = cushions[Math.floor(hash2(c.seed, 1, 3) * cushions.length)];

      if (c.state === 'walk' && c.target) {
        const dx = c.target.x - c.tx;
        const dy = c.target.y - c.ty;
        const dist = Math.hypot(dx, dy);
        if (dist < 0.12) {
          c.target = null;
          this.pickCatState(c, t);
        } else {
          c.speed = lerp(c.speed, 1, 0.04);
          const v = 0.0013 * dt * c.speed;
          c.tx += (dx / dist) * v;
          c.ty += (dy / dist) * v;
          if (Math.abs(dx) > 0.02) c.facing = dx > 0 ? 1 : -1;
          // не заходим в воду
          if (!tileWalkable(world, c.tx, c.ty)) {
            c.tx -= (dx / dist) * v;
            c.ty -= (dy / dist) * v;
            c.target = null;
            this.pickCatState(c, t);
          }
        }
      } else {
        c.speed = lerp(c.speed, 0, 0.08);
      }

      if (c.timer <= 0) this.pickCatState(c, t, world);
    }
  }

  private pickCatState(c: Cat, t: TimeState, world?: World): void {
    const night = t.daylight < 0.3;
    const r = rnd();
    // ночью и в полдень кот больше спит; утром и вечером — активен
    const lazy = night ? 0.72 : t.hours >= 12 && t.hours <= 15 ? 0.6 : 0.34;

    if (r < lazy) {
      c.state = r < lazy * 0.55 ? 'sleep' : 'loaf';
      c.timer = 9000 + rnd() * 22000;
    } else if (r < lazy + 0.18) {
      c.state = 'sit';
      c.timer = 5000 + rnd() * 9000;
    } else if (r < lazy + 0.28) {
      c.state = 'wash';
      c.timer = 3500 + rnd() * 5000;
    } else if (r < lazy + 0.34) {
      c.state = 'stretch';
      c.timer = 1800 + rnd() * 1400;
    } else if (world) {
      // идём куда-нибудь: иногда к своей подушке, иногда просто бродить
      const toHome = c.home && rnd() < 0.35 ? c.home : null;
      const dest = toHome ?? randomWalkable(world, { x: c.tx, y: c.ty }, 7);
      if (dest) {
        c.state = 'walk';
        c.target = dest;
        c.timer = 14000;
      } else {
        c.state = 'sit';
        c.timer = 4000;
      }
    } else {
      c.state = 'sit';
      c.timer = 4000;
    }
    c.phase = 0;
  }

  // ---------------- Птицы ----------------

  private updateBirds(world: World, t: TimeState, dt: number): void {
    // Птицы прилетают днём, и только если есть где сесть
    const daytime = t.daylight > 0.35;
    this.birdTimer -= dt;
    if (daytime && this.birdTimer <= 0 && this.birds.length < 4) {
      this.birdTimer = 7000 + rnd() * 16000;
      const spot = randomWalkable(world);
      if (spot) {
        const fromLeft = rnd() > 0.5;
        this.birds.push({
          tx: fromLeft ? -2 : GRID + 2,
          ty: spot.y + (rnd() - 0.5) * 4,
          facing: fromLeft ? 1 : -1,
          seed: Math.floor(rnd() * 10000),
          state: 'fly-in',
          timer: 0,
          target: spot,
          alt: 90 + rnd() * 50,
          hop: 0,
          scale: 0.85 + rnd() * 0.35,
        });
      }
    }
    if (!daytime) {
      // на закате разлетаются
      for (const b of this.birds) if (b.state !== 'fly-out') this.birdLeave(b);
    }

    for (let i = this.birds.length - 1; i >= 0; i--) {
      const b = this.birds[i];
      b.timer -= dt;

      if (b.state === 'fly-in' && b.target) {
        const dx = b.target.x - b.tx;
        const dy = b.target.y - b.ty;
        const d = Math.hypot(dx, dy);
        const v = 0.0028 * dt;
        if (d < 0.2 && b.alt < 3) {
          b.state = 'hop';
          b.alt = 0;
          b.timer = 900 + rnd() * 1600;
        } else {
          b.tx += (dx / (d || 1)) * v;
          b.ty += (dy / (d || 1)) * v;
          b.alt = lerp(b.alt, 0, 0.035);
          if (Math.abs(dx) > 0.02) b.facing = dx > 0 ? 1 : -1;
        }
      } else if (b.state === 'hop') {
        b.hop += dt * 0.006;
        if (b.timer <= 0) {
          b.state = rnd() < 0.6 ? 'peck' : 'hop';
          b.timer = 700 + rnd() * 1500;
          // прыжок в сторону
          const nx = b.tx + (rnd() - 0.5) * 1.6;
          const ny = b.ty + (rnd() - 0.5) * 1.6;
          if (tileWalkable(world, nx, ny)) {
            b.facing = nx > b.tx ? 1 : -1;
            b.tx = nx;
            b.ty = ny;
          }
          if (rnd() < 0.16) this.birdLeave(b);
        }
      } else if (b.state === 'peck') {
        if (b.timer <= 0) {
          b.state = 'hop';
          b.timer = 600 + rnd() * 1400;
          if (rnd() < 0.2) this.birdLeave(b);
        }
      } else if (b.state === 'fly-out') {
        b.alt = lerp(b.alt, 150, 0.026);
        b.tx += b.facing * 0.0032 * dt;
        b.ty -= 0.0009 * dt;
        if (b.tx < -4 || b.tx > GRID + 4 || b.alt > 130) this.birds.splice(i, 1);
      }
    }
  }

  private birdLeave(b: Bird): void {
    b.state = 'fly-out';
    b.timer = 4000;
  }

  // ---------------- Бабочки и стрекозы ----------------

  private updateFlutters(world: World, t: TimeState, dt: number, now: number): void {
    const season = t.season;
    const day = t.daylight;
    const wantButterflies = day > 0.4 && (season === 'spring' || season === 'summer') ? 5 : 0;
    const wantDragonflies = day > 0.35 && (season === 'summer' || season === 'autumn') ? 3 : 0;

    const flowers = findObjects(world, ['lily', 'iris', 'azalea', 'lotus', 'lilypad']);
    const count = (k: string) => this.flutters.filter((f) => f.kind === k).length;

    while (count('butterfly') < wantButterflies) {
      const spot = flowers.length ? flowers[Math.floor(rnd() * flowers.length)] : randomWalkable(world);
      if (!spot) break;
      this.flutters.push({
        kind: 'butterfly',
        tx: spot.x + (rnd() - 0.5) * 3,
        ty: spot.y + (rnd() - 0.5) * 3,
        alt: 18 + rnd() * 26,
        vx: 0,
        vy: 0,
        valt: 0,
        target: spot,
        timer: 2000 + rnd() * 3000,
        seed: rnd() * 1000,
        phase: rnd() * 10,
        resting: 0,
      });
    }
    while (count('dragonfly') < wantDragonflies) {
      const spot = this.findWaterSpot(world) ?? randomWalkable(world);
      if (!spot) break;
      this.flutters.push({
        kind: 'dragonfly',
        tx: spot.x,
        ty: spot.y,
        alt: 22 + rnd() * 20,
        vx: 0,
        vy: 0,
        valt: 0,
        target: spot,
        timer: 1200 + rnd() * 1800,
        seed: rnd() * 1000,
        phase: rnd() * 10,
        resting: 0,
      });
    }
    // лишних убираем плавно
    while (count('butterfly') > wantButterflies) {
      const i = this.flutters.findIndex((f) => f.kind === 'butterfly');
      this.flutters.splice(i, 1);
    }
    while (count('dragonfly') > wantDragonflies) {
      const i = this.flutters.findIndex((f) => f.kind === 'dragonfly');
      this.flutters.splice(i, 1);
    }

    for (const f of this.flutters) {
      f.timer -= dt;
      f.phase += dt * 0.004;

      if (f.resting > 0) {
        f.resting -= dt;
        f.alt = lerp(f.alt, 6, 0.06);
        continue;
      }

      if (f.timer <= 0 || !f.target) {
        f.timer = 1600 + rnd() * 3200;
        if (f.kind === 'butterfly') {
          const spot =
            flowers.length && rnd() < 0.7
              ? flowers[Math.floor(rnd() * flowers.length)]
              : randomWalkable(world, { x: f.tx, y: f.ty }, 5);
          f.target = spot;
          // иногда присаживается на цветок
          if (spot && rnd() < 0.3) f.resting = 1800 + rnd() * 3000;
        } else {
          f.target = this.findWaterSpot(world) ?? randomWalkable(world, { x: f.tx, y: f.ty }, 6);
        }
      }

      if (f.target) {
        const dx = f.target.x - f.tx;
        const dy = f.target.y - f.ty;
        const d = Math.hypot(dx, dy) || 1;
        // бабочка порхает рывками, стрекоза — резкие броски и зависания
        if (f.kind === 'butterfly') {
          const flap = Math.sin(now * 0.02 + f.seed) * 0.5 + 0.5;
          f.vx = lerp(f.vx, (dx / d) * 0.0011 * (0.5 + flap), 0.05);
          f.vy = lerp(f.vy, (dy / d) * 0.0011 * (0.5 + flap), 0.05);
          f.valt = lerp(f.valt, Math.sin(now * 0.005 + f.seed) * 0.06, 0.06);
        } else {
          const dart = Math.sin(now * 0.0013 + f.seed) > 0.4 ? 1 : 0.06;
          f.vx = lerp(f.vx, (dx / d) * 0.0026 * dart, 0.12);
          f.vy = lerp(f.vy, (dy / d) * 0.0026 * dart, 0.12);
          f.valt = lerp(f.valt, Math.sin(now * 0.002 + f.seed) * 0.04, 0.1);
        }
        f.tx += f.vx * dt;
        f.ty += f.vy * dt;
        f.alt = clamp(f.alt + f.valt * dt, 6, 58);
        if (Math.hypot(dx, dy) < 0.35) f.target = null;
      }
      f.tx = clamp(f.tx, 0.5, GRID - 0.5);
      f.ty = clamp(f.ty, 0.5, GRID - 0.5);
    }
  }

  private findWaterSpot(world: World): Vec | null {
    for (let i = 0; i < 30; i++) {
      const x = rnd() * GRID;
      const y = rnd() * GRID;
      const t = world.at(Math.floor(x), Math.floor(y));
      if (t?.water) return { x, y };
    }
    return null;
  }

  // ---------------- Карпы ----------------

  private updateFish(world: World, dt: number): void {
    for (const f of this.fish) {
      // Плавный поворот + лёгкое виляние
      const wander = (hash2(Math.floor(performance.now() * 0.0007), f.seed, 3) - 0.5) * 0.9;
      f.turn = lerp(f.turn, wander, 0.02);

      // Если впереди не вода — разворачиваемся к центру пруда
      const aheadX = f.tx + Math.cos(f.dir) * 0.7;
      const aheadY = f.ty + Math.sin(f.dir) * 0.7;
      const ahead = world.at(Math.floor(aheadX), Math.floor(aheadY));
      if (!ahead?.water) {
        const toHome = Math.atan2(f.homeY - f.ty, f.homeX - f.tx);
        // мягко доворачиваем к дому
        let diff = toHome - f.dir;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        f.dir += clamp(diff, -0.06, 0.06) * (dt * 0.06);
      } else {
        f.dir += f.turn * dt * 0.0012;
      }

      const v = f.speed * dt;
      const nx = f.tx + Math.cos(f.dir) * v;
      const ny = f.ty + Math.sin(f.dir) * v;
      const nt = world.at(Math.floor(nx), Math.floor(ny));
      if (nt?.water) {
        f.tx = nx;
        f.ty = ny;
      } else {
        f.dir += 0.9;
      }
    }
  }

  // ---------------- Опадание с деревьев ----------------

  private updateFalling(world: World, t: TimeState, dt: number): void {
    const season = t.season;
    const isPetal = season === 'spring';
    const isLeaf = season === 'autumn';
    if (!isPetal && !isLeaf) return;

    // Чем сильнее ветер, тем чаще срывает
    const wind = this.windBase + this.gusts.reduce((a, g) => a + g.strength, 0) * 0.4;
    const chance = (isPetal ? 0.004 : 0.003) * wind * dt;
    if (rnd() > chance) return;

    const trees = world.objects.filter((o) => {
      const item = ITEM_BY_ID.get(o.type);
      if (!item || item.kind !== 'tree') return false;
      if (isPetal) return o.type === 'sakura';
      return o.type === 'maple' || o.type === 'ginkgo' || o.type === 'sakura';
    });
    if (!trees.length) return;
    const tree = trees[Math.floor(rnd() * trees.length)];
    const item = ITEM_BY_ID.get(tree.type)!;
    if (this.emitted.length < Life.EMITTED_CAP) {
      this.emitted.push({
        x: tree.tx + item.w / 2 + (rnd() - 0.5) * 1.4,
        y: tree.ty + item.h / 2 + (rnd() - 0.5) * 1.4,
        kind: isPetal ? 'petal' : 'leaf',
        seed: Math.floor(rnd() * 10000),
      });
    }
  }

  takeEmitted(): { x: number; y: number; kind: 'petal' | 'leaf'; seed: number }[] {
    const out = this.emitted;
    this.emitted = [];
    return out;
  }
}

export { clamp01 };
