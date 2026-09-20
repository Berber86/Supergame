/** Short, interruptible encounters. Transient actors only: no relationship counters or save fields. */
import { hash2, smoothstep } from '../core/rng';
import { TILE_W } from '../core/iso';
import { ITEM_BY_ID, SMALL_HOUSE_IDS } from './catalog';
import { inGrowRect } from './grow';
import type { World } from './world';

interface Point {
  x: number;
  y: number;
}
export type CompanyPhase = 'approach' | 'greet' | 'settle' | 'rest';
export interface CompanyPose {
  phase: CompanyPhase;
  elapsed: number;
}
export interface CompanyActor {
  tx: number;
  ty: number;
  seed: number;
  facing: number;
  state: string;
  target: Point | null;
  timer: number;
  phase: number;
  gait?: number;
  company?: CompanyPose;
}
export const COMPANY_GREETING_MS = 3200;
export function companyBend(pose?: CompanyPose): number {
  if (pose?.phase !== 'greet') return 0;
  return (
    smoothstep(0, 600, pose.elapsed) *
    (1 - smoothstep(2500, COMPANY_GREETING_MS, pose.elapsed)) *
    (0.9 + Math.sin(pose.elapsed * 0.006) * 0.1)
  );
}
/** These small approaches never cross water, walls, unopened land, large objects or a height step. */
export function companyPath(world: World, from: Point, to: Point, deer = false): boolean {
  const start = world.at(Math.floor(from.x), Math.floor(from.y));
  if (!start) return false;
  const obstacles = world.objects.filter((o) => {
    const item = ITEM_BY_ID.get(o.type);
    return (
      item &&
      (item.kind === 'pavilion' ||
        SMALL_HOUSE_IDS.has(o.type) ||
        o.type === 'shoji' ||
        o.type === 'hedge' ||
        (item.kind === 'rock' && item.w * item.h >= 1))
    );
  });
  const steps = Math.max(1, Math.ceil(Math.hypot(to.x - from.x, to.y - from.y) / 0.1));
  for (let i = 0; i <= steps; i++) {
    const x = from.x + ((to.x - from.x) * i) / steps,
      y = from.y + ((to.y - from.y) * i) / steps;
    const tile = world.at(Math.floor(x), Math.floor(y));
    if (
      !tile ||
      tile.water ||
      tile.indoor ||
      (deer && tile.veranda) ||
      tile.level !== start.level ||
      (world.grow && !inGrowRect(world.grow.rect, Math.floor(x), Math.floor(y)))
    )
      return false;
    for (const o of obstacles) {
      const item = ITEM_BY_ID.get(o.type)!;
      const w = o.rot % 2 ? item.h : item.w,
        h = o.rot % 2 ? item.w : item.h;
      if (x >= o.tx - 0.05 && x < o.tx + w + 0.05 && y >= o.ty - 0.05 && y < o.ty + h + 0.05) return false;
    }
  }
  return true;
}
const at = (a: CompanyActor): Point => ({ x: a.tx, y: a.ty });
interface Pair<A> {
  a: A;
  b: A;
  center: Point;
  phase: CompanyPhase;
  elapsed: number;
  age: number;
  noted: boolean;
}

export class AnimalCompany<A extends CompanyActor> {
  private pair?: Pair<A>;
  private cooldown = new WeakMap<A, number>();
  private clock = 0;
  private scan = 4500;
  constructor(private kind: 'cat' | 'deer') {}
  reset(): void {
    if (this.pair) this.release();
    this.cooldown = new WeakMap();
    this.clock = 0;
    this.scan = 4500;
  }
  private release(): void {
    if (!this.pair) return;
    for (const a of [this.pair.a, this.pair.b]) {
      delete a.company;
      // A departing animal must keep its exit route.
      if (a.state !== 'leave') {
        a.state = this.kind === 'cat' ? 'sit' : 'look';
        a.target = null;
        a.timer = 3500;
      }
      this.cooldown.set(a, this.clock + 90_000 + hash2(a.seed, 5, 3461) * 60_000);
    }
    this.pair = undefined;
  }
  private targets(pair: Pair<A>, resting = false): [Point, Point] {
    // Opposite ends of a horizontal screen-space line: both noses are at the same height.
    const pixels = this.kind === 'cat' ? (resting ? 38 : 28) : 54;
    const offset = pixels / (2 * TILE_W);
    const sign = pair.a.tx - pair.a.ty <= pair.b.tx - pair.b.ty ? -1 : 1;
    return [
      { x: pair.center.x + sign * offset, y: pair.center.y - sign * offset },
      { x: pair.center.x - sign * offset, y: pair.center.y + sign * offset },
    ];
  }
  update(
    world: World | undefined,
    actors: A[],
    dt: number,
    valid: (a: A) => boolean,
    note: (id: string, x: number, y: number) => void,
  ): void {
    dt = Number.isFinite(dt) ? Math.max(0, dt) : 0;
    this.clock += dt;
    this.scan -= dt;
    if (!world) {
      if (this.pair) this.release();
      return;
    }
    if (!this.pair && this.scan <= 0) {
      this.scan = 6500;
      const calm = actors.filter(
        (a) =>
          valid(a) &&
          (this.cooldown.get(a) ?? 0) <= this.clock &&
          (this.kind === 'cat' ? a.state === 'sit' || a.state === 'loaf' : a.state === 'graze' || a.state === 'look'),
      );
      search: for (let i = 0; i < calm.length; i++)
        for (let j = i + 1; j < calm.length; j++) {
          const a = calm[i],
            b = calm[j],
            distance = Math.hypot(a.tx - b.tx, a.ty - b.ty);
          if (distance < 0.12 || distance > (this.kind === 'cat' ? 2.8 : 4)) continue;
          const pair: Pair<A> = {
            a,
            b,
            center: { x: (a.tx + b.tx) / 2, y: (a.ty + b.ty) / 2 },
            phase: 'approach',
            elapsed: 0,
            age: 0,
            noted: false,
          };
          const goals = this.targets(pair),
            rest = this.targets(pair, true);
          if (!companyPath(world, goals[0], goals[1], this.kind === 'deer')) continue;
          if (
            ![a, b].every(
              (v, n) =>
                companyPath(world, at(v), goals[n], this.kind === 'deer') &&
                companyPath(world, goals[n], rest[n], this.kind === 'deer'),
            )
          )
            continue;
          this.pair = pair;
          break search;
        }
    }
    const pair = this.pair;
    if (!pair) return;
    const members = [pair.a, pair.b];
    if (members.some((a) => !actors.includes(a) || !valid(a)) || pair.age > 28_000) {
      this.release();
      return;
    }
    const goals = this.targets(pair, pair.phase === 'settle' || pair.phase === 'rest');
    if (
      !companyPath(world, goals[0], goals[1], this.kind === 'deer') ||
      members.some((a, n) => !companyPath(world, at(a), goals[n], this.kind === 'deer'))
    ) {
      this.release();
      return;
    }
    pair.age += dt;
    pair.elapsed += dt;
    const moving = pair.phase === 'approach' || pair.phase === 'settle';
    if (moving) {
      for (const [n, a] of members.entries()) {
        const goal = goals[n],
          dx = goal.x - a.tx,
          dy = goal.y - a.ty,
          distance = Math.hypot(dx, dy);
        const step = Math.min(distance, dt * (this.kind === 'cat' ? 0.0008 : 0.0005));
        a.tx += (dx / (distance || 1)) * step;
        a.ty += (dy / (distance || 1)) * step;
        a.gait = (a.gait ?? 0) + (step / (this.kind === 'cat' ? 0.95 : 0.85)) * Math.PI * 2;
        if (Math.abs(dx - dy) > 0.001) a.facing = dx > dy ? 1 : -1;
        a.state = 'walk';
        a.target = goal;
      }
      if (members.every((a, n) => Math.hypot(a.tx - goals[n].x, a.ty - goals[n].y) < 0.001)) {
        pair.phase = pair.phase === 'approach' ? 'greet' : 'rest';
        pair.elapsed = 0;
      }
    }
    if (pair.phase === 'greet' || pair.phase === 'rest') {
      pair.a.facing = pair.a.tx - pair.a.ty < pair.b.tx - pair.b.ty ? 1 : -1;
      pair.b.facing = -pair.a.facing;
      for (const a of members) {
        a.target = null;
        a.state = this.kind === 'cat' ? (pair.phase === 'rest' ? 'loaf' : 'sit') : 'look';
      }
      if (pair.phase === 'greet' && pair.elapsed >= COMPANY_GREETING_MS) {
        note(this.kind === 'cat' ? 'cats_greet' : 'deer_nuzzle', pair.center.x, pair.center.y);
        if (this.kind === 'deer') {
          this.release();
          return;
        }
        pair.phase = 'settle';
        pair.elapsed = 0;
      } else if (pair.phase === 'rest') {
        if (!pair.noted && pair.elapsed >= 2500) {
          note('cats_rest', pair.center.x, pair.center.y);
          pair.noted = true;
        }
        if (pair.elapsed >= 12_000) {
          this.release();
          return;
        }
      }
    }
    for (const a of members) {
      a.company = { phase: pair.phase, elapsed: pair.elapsed };
      a.timer = 4000;
    }
  }
}
