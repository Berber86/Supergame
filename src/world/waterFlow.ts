/**
 * Течение воды.
 *
 * Вода в саду не стоит: она сползает по уклону, обтекает камни и падает
 * с уступов. Всё это выводится из рельефа, а не задаётся руками —
 * игрок просто копает, а ручей сам находит дорогу вниз.
 *
 * Считается редко (только когда земля изменилась) и кэшируется:
 * каждый кадр здесь делать нечего.
 */

import { GRID, inBounds } from '../core/iso';
import { World } from './world';

/** Куда и насколько быстро течёт вода в клетке. */
export interface FlowCell {
  /** Единичный вектор направления (0,0 — стоячая вода). */
  fx: number;
  fy: number;
  /** Скорость 0..1: перепад высот и близость водопада. */
  speed: number;
  /** Расстояние до ближайшего края воды в клетках — глубина у берега. */
  edge: number;
}

/** Сплошная стена воды: несколько соседних уступов, слитых в один занавес. */
export interface Curtain {
  /** Клетки уступа по порядку вдоль кромки. */
  tiles: { x: number; y: number }[];
  dx: number;
  dy: number;
  drop: number;
  width: number;
  seed: number;
}

/** Уступ, с которого вода падает вниз. */
export interface Fall {
  x: number;
  y: number;
  /** Направление падения: одна из четырёх сторон. */
  dx: number;
  dy: number;
  /** Высота падения в уровнях. */
  drop: number;
  /** Ширина потока 0..1 — насколько «полноводен» уступ. */
  width: number;
  /** Устойчивый сид для формы струй. */
  seed: number;
}

/** Соседние уступы одного направления и высоты — это один водопад. */
function mergeFalls(falls: Fall[]): Curtain[] {
  const key = (f: Fall) => `${f.dx},${f.dy},${f.drop}`;
  const groups = new Map<string, Fall[]>();
  for (const f of falls) {
    const k = key(f);
    const g = groups.get(k);
    if (g) g.push(f);
    else groups.set(k, [f]);
  }

  const out: Curtain[] = [];
  for (const [, group] of groups) {
    // Вдоль кромки идём поперёк направления падения
    const along = group[0].dx !== 0 ? 'y' : 'x';
    group.sort((a, b) => (along === 'y' ? a.y - b.y || a.x - b.x : a.x - b.x || a.y - b.y));

    let run: Fall[] = [];
    const flush = () => {
      if (!run.length) return;
      const first = run[0];
      out.push({
        tiles: run.map((f) => ({ x: f.x, y: f.y })),
        dx: first.dx,
        dy: first.dy,
        drop: first.drop,
        // широкий занавес полноводнее узкой струйки
        width: Math.min(1, 0.5 + run.length * 0.2),
        seed: first.seed,
      });
      run = [];
    };
    for (const f of group) {
      if (!run.length) {
        run.push(f);
        continue;
      }
      const prev = run[run.length - 1];
      const adjacent = along === 'y' ? f.x === prev.x && f.y === prev.y + 1 : f.y === prev.y && f.x === prev.x + 1;
      if (adjacent) run.push(f);
      else {
        flush();
        run.push(f);
      }
    }
    flush();
  }
  return out;
}

const DIRS: [number, number][] = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

export class WaterFlow {
  cells: (FlowCell | null)[] = [];
  falls: Fall[] = [];
  /** Уступы, слитые в сплошные занавесы — так водопад выглядит цельным. */
  curtains: Curtain[] = [];
  /** Есть ли в саду вообще движущаяся вода — чтобы не гонять отрисовку зря. */
  hasCurrent = false;

  private dirty = true;

  markDirty(): void {
    this.dirty = true;
  }

  ensure(world: World): void {
    if (!this.dirty) return;
    this.dirty = false;
    this.compute(world);
  }

  at(x: number, y: number): FlowCell | null {
    if (!inBounds(x, y)) return null;
    return this.cells[y * GRID + x] ?? null;
  }

  private compute(world: World): void {
    this.cells = new Array(GRID * GRID).fill(null);
    this.falls = [];
    this.curtains = [];
    this.hasCurrent = false;

    // 1) Глубина: расстояние от берега внутрь воды. Волной наружу внутрь,
    //    так у кромки получается мелко, а в середине пруда глубоко.
    const edge = new Float32Array(GRID * GRID).fill(-1);
    const queue: number[] = [];
    for (let y = 0; y < GRID; y++) {
      for (let x = 0; x < GRID; x++) {
        const i = y * GRID + x;
        const t = world.tiles[i];
        if (!t.water) continue;
        let border = false;
        for (const [dx, dy] of DIRS) {
          const nb = world.at(x + dx, y + dy);
          if (!nb || !nb.water) {
            border = true;
            break;
          }
        }
        if (border) {
          edge[i] = 0;
          queue.push(i);
        }
      }
    }
    for (let qi = 0; qi < queue.length; qi++) {
      const i = queue[qi];
      const x = i % GRID;
      const y = (i / GRID) | 0;
      for (const [dx, dy] of DIRS) {
        const nx = x + dx;
        const ny = y + dy;
        if (!inBounds(nx, ny)) continue;
        const j = ny * GRID + nx;
        if (!world.tiles[j].water || edge[j] >= 0) continue;
        edge[j] = edge[i] + 1;
        queue.push(j);
      }
    }

    // 2) Водоёмы и их сливы.
    //
    // Через край льётся не по всему периметру, а только в самом низком
    // месте кромки — как в настоящем пруду. Если давать течь каждой грани,
    // приподнятый пруд превращается в стеклянный аквариум, из которого
    // хлещет во все стороны сразу.
    const fallPull = new Float32Array(GRID * GRID);
    const body = new Int32Array(GRID * GRID).fill(-1);
    const bodies: number[][] = [];
    for (let y = 0; y < GRID; y++) {
      for (let x = 0; x < GRID; x++) {
        const i = y * GRID + x;
        if (!world.tiles[i].water || body[i] >= 0) continue;
        // разливаемся по связной воде одного уровня
        const id = bodies.length;
        const cells: number[] = [];
        const stack = [i];
        body[i] = id;
        while (stack.length) {
          const k = stack.pop()!;
          cells.push(k);
          const kx = k % GRID;
          const ky = (k / GRID) | 0;
          for (const [dx, dy] of DIRS) {
            const nx = kx + dx;
            const ny = ky + dy;
            if (!inBounds(nx, ny)) continue;
            const j = ny * GRID + nx;
            if (body[j] >= 0 || !world.tiles[j].water) continue;
            // вода одного зеркала: разные уровни — разные водоёмы
            if (world.tiles[j].level !== world.tiles[k].level) continue;
            body[j] = id;
            stack.push(j);
          }
        }
        bodies.push(cells);
      }
    }

    for (const cells of bodies) {
      // Ищем самую низкую точку кромки этого водоёма
      let lowest = Infinity;
      const edges: { i: number; x: number; y: number; dx: number; dy: number; drop: number; toWater: boolean }[] = [];
      for (const i of cells) {
        const x = i % GRID;
        const y = (i / GRID) | 0;
        const t = world.tiles[i];
        for (const [dx, dy] of DIRS) {
          const nb = world.at(x + dx, y + dy);
          if (!nb) continue;
          if (nb.water && nb.level === t.level) continue;
          const drop = t.level - nb.level;
          if (drop <= 0) continue;
          lowest = Math.min(lowest, nb.level);
          edges.push({ i, x, y, dx, dy, drop, toWater: nb.water });
        }
      }
      if (!edges.length) continue;

      for (const e of edges) {
        // Льётся только там, где кромка ниже всего: это и есть слив
        if (e.toWater === false && e.drop < 1) continue;
        const nb = world.at(e.x + e.dx, e.y + e.dy)!;
        if (nb.level > lowest) continue;

        let neighbours = 0;
        for (const [ax, ay] of DIRS) {
          const a = world.at(e.x + ax, e.y + ay);
          if (a?.water) neighbours++;
        }
        this.falls.push({
          x: e.x,
          y: e.y,
          dx: e.dx,
          dy: e.dy,
          drop: e.drop,
          width: Math.min(1, (e.toWater ? 0.6 : 0.42) + neighbours * 0.15),
          seed: (e.x * 73856093) ^ (e.y * 19349663) ^ ((e.dx + 2) * 83492791) ^ ((e.dy + 2) * 2654435761),
        });
        fallPull[e.i] = Math.max(fallPull[e.i], e.drop);
      }
    }

    // 2.5) Склеиваем соседние уступы одного направления в занавесы.
    //      Иначе каждая клетка рисует свою струю, и водопад выглядит
    //      набором отдельных сосулек вместо стены воды.
    this.curtains = mergeFalls(this.falls);

    // 3) Течение: тянет вниз по уклону и в сторону ближайшего уступа.
    //    Притяжение уступа расходится на пару клеток — перед водопадом
    //    вода заметно ускоряется, как в жизни.
    const pull = new Float32Array(fallPull);
    for (let pass = 0; pass < 3; pass++) {
      const prev = Float32Array.from(pull);
      for (let y = 0; y < GRID; y++) {
        for (let x = 0; x < GRID; x++) {
          const i = y * GRID + x;
          if (!world.tiles[i].water) continue;
          let best = prev[i];
          for (const [dx, dy] of DIRS) {
            const nx = x + dx;
            const ny = y + dy;
            if (!inBounds(nx, ny)) continue;
            const j = ny * GRID + nx;
            if (!world.tiles[j].water) continue;
            best = Math.max(best, prev[j] * 0.55);
          }
          pull[i] = best;
        }
      }
    }

    for (let y = 0; y < GRID; y++) {
      for (let x = 0; x < GRID; x++) {
        const i = y * GRID + x;
        const t = world.tiles[i];
        if (!t.water) continue;

        let fx = 0;
        let fy = 0;
        for (const [dx, dy] of DIRS) {
          const nx = x + dx;
          const ny = y + dy;
          const nb = world.at(nx, ny);
          if (!nb) continue;
          const j = ny * GRID + nx;
          // уклон дна: вода идёт туда, где ниже
          const dh = t.level - nb.level;
          if (nb.water && dh > 0) {
            fx += dx * dh;
            fy += dy * dh;
          }
          // и туда, где ближе обрыв
          const dp = pull[j] - pull[i];
          if (nb.water && dp > 0) {
            fx += dx * dp * 0.9;
            fy += dy * dp * 0.9;
          }
          // прямо к своему уступу
          if (!nb.water && dh > 0) {
            fx += dx * dh * 1.4;
            fy += dy * dh * 1.4;
          }
        }

        const len = Math.hypot(fx, fy);
        const speed = Math.min(1, len * 0.5);
        if (speed > 0.02) this.hasCurrent = true;
        this.cells[i] = {
          fx: len > 1e-4 ? fx / len : 0,
          fy: len > 1e-4 ? fy / len : 0,
          speed,
          edge: edge[i] < 0 ? 0 : edge[i],
        };
      }
    }
  }
}
