/** Small diurnal garden skinks. Bounded visitors, not saved pets or replayed offline populations. */
import { makeRng, hash2, clamp01 } from '../core/rng';
import type { TimeState } from '../core/clock';
import { sunnyLizardSpots, type Habitat, type Invitation, type Vec } from './habitat';
import type { World } from './world';
import type { Threat } from './residents';
import type { Flutter } from './life';
import { easePose } from './animalMotion';
export type LizardState = 'emerge' | 'bask' | 'look' | 'walk' | 'hunt' | 'strike' | 'flee' | 'hide' | 'leave';
export interface Lizard {
  tx: number;
  ty: number;
  seed: number;
  facing: 1 | -1;
  state: LizardState;
  timer: number;
  duration: number;
  age: number;
  stay: number;
  target: (Vec & { lift?: number }) | null;
  shelter: Vec;
  lift: number;
  perchLift: number;
  gait: number;
  motion: number;
  alpha: number;
  inactive: number;
  hunger: number;
  catches: number;
  prey: Flutter | null;
}
export const LIZARD_COATS = ['Бронзовая', 'Песочно-бурая', 'Оливково-бурая', 'Молодая · синий хвост'];
export const lizardCoat = (seed: number) => ((Math.floor(seed) % 4) + 4) % 4;
export function lizardSpeed(state: LizardState): number {
  return state === 'flee' ? 0.0024 : state === 'walk' || state === 'leave' ? 0.0007 : state === 'hunt' ? 0.00038 : 0;
}
export function lizardPose(a: Lizard, time: number) {
  const p = clamp01(1 - a.timer / Math.max(1, a.duration));
  return {
    gait: a.gait,
    motion: a.motion,
    breath: Math.sin(time * 0.0025 + a.seed) * (a.state === 'bask' ? 0.13 : 0.06),
    tail: Math.sin(a.gait - 0.8) * a.motion * 2.2 + Math.sin(time * 0.0014 + a.seed) * 0.3,
    head: a.state === 'look' ? Math.sin(time * 0.003 + a.seed) * 0.18 : a.state === 'hunt' ? 0.1 : 0,
    strike: a.state === 'strike' ? Math.sin(p * Math.PI) : 0,
    tongue: a.state !== 'hide' && (time + a.seed * 137) % 4100 < 150,
    blink: (time + a.seed * 97) % 5300 < 130,
  };
}
export function makeLizard(seed: number, shelter: Vec): Lizard {
  return {
    tx: shelter.x,
    ty: shelter.y,
    seed,
    facing: 1,
    state: 'emerge',
    timer: 1400,
    duration: 1400,
    age: 0,
    stay: 100000 + hash2(seed, 11, 73) * 80000,
    target: null,
    shelter: { ...shelter },
    lift: 0,
    perchLift: 0,
    gait: 0,
    motion: 0,
    alpha: 0,
    inactive: 0,
    hunger: 9000,
    catches: 0,
    prey: null,
  };
}
/** No swimming, walls, raised-floor shortcuts, fog crossing or jumping cliffs. */
export function lizardGround(world: World, x: number, y: number): boolean {
  const tile = world.at(Math.floor(x), Math.floor(y)),
    r = world.grow?.rect;
  return (
    !!tile &&
    !tile.water &&
    !tile.indoor &&
    !tile.veranda &&
    (!r || (x >= r.x && y >= r.y && x < r.x + r.w && y < r.y + r.h))
  );
}
export function lizardRoute(world: World, from: Vec, to: Vec): boolean {
  const n = Math.max(1, Math.ceil(Math.hypot(to.x - from.x, to.y - from.y) / 0.12));
  const level = world.at(Math.floor(from.x), Math.floor(from.y))?.level;
  for (let i = 0; i <= n; i++) {
    const x = from.x + ((to.x - from.x) * i) / n,
      y = from.y + ((to.y - from.y) * i) / n;
    if (!lizardGround(world, x, y) || world.at(Math.floor(x), Math.floor(y))?.level !== level) return false;
  }
  return true;
}
export class Lizards {
  agents: Lizard[] = [];
  private timer = 8000;
  private rnd = makeRng(72091);
  reset(): void {
    this.agents = [];
    this.timer = 8000;
  }
  private state(a: Lizard, state: LizardState, duration: number): void {
    a.state = state;
    a.timer = a.duration = duration;
    if (state === 'hide') a.perchLift = 0;
    if (state !== 'hunt' && state !== 'strike') a.prey = null;
  }
  private reachable(a: Lizard, sites: Vec[], world: World): Vec[] {
    return sites.filter((p) => Math.hypot(p.x - a.tx, p.y - a.ty) < 4 && lizardRoute(world, { x: a.tx, y: a.ty }, p));
  }
  private shelter(a: Lizard, h: Habitat, world: World, threat?: Threat): Vec {
    const sites = this.reachable(a, h.lizardShelters, world);
    sites.sort((p, q) => {
      const score = (s: Vec) =>
        Math.hypot(s.x - a.tx, s.y - a.ty) - (threat ? Math.hypot(s.x - threat.x, s.y - threat.y) * 1.6 : 0);
      return score(p) - score(q);
    });
    return sites[0] ?? { x: a.tx, y: a.ty };
  }
  update(
    world: World,
    h: Habitat,
    inv: Invitation,
    t: TimeState,
    dt: number,
    threats: Threat[],
    flutters: Flutter[],
    occupied: Vec[],
  ): void {
    if (!Number.isFinite(dt) || dt <= 0) return;
    dt = Math.min(dt, 250);
    this.timer -= dt;
    const want = Math.min(3, Math.max(0, inv.lizard));
    for (let i = this.agents.length - 1; i >= 0; i--) {
      const a = this.agents[i];
      a.age += dt;
      a.timer -= dt;
      a.hunger -= dt;
      if (!lizardGround(world, a.tx, a.ty)) {
        this.agents.splice(i, 1);
        continue;
      }
      // Sunset, winter, rain and surplus population all have a strict retirement bound.
      a.inactive = i >= want || a.age > a.stay ? a.inactive + dt : 0;
      if (a.inactive >= 5000) {
        this.agents.splice(i, 1);
        continue;
      }
      const threat = threats.find((p) => Math.hypot(p.x - a.tx, p.y - a.ty) < p.r);
      const alarm = threats.some((p) => Math.hypot(p.x - a.tx, p.y - a.ty) < p.r * 1.65);
      if (a.inactive > 0 && a.state !== 'leave' && a.state !== 'hide') {
        a.target = this.shelter(a, h, world);
        this.state(a, 'leave', 4500);
      } else if (threat && a.state !== 'hide' && a.state !== 'flee' && a.inactive === 0) {
        a.target = this.shelter(a, h, world, threat);
        this.state(a, 'flee', 2200);
      } else if (alarm && !threat && ['bask', 'hunt'].includes(a.state)) {
        a.target = null;
        this.state(a, 'look', 1600);
      }
      if (a.state === 'hide') {
        a.alpha = easePose(a.alpha, 0, dt, 180);
        if (a.timer <= 0 && !alarm && a.inactive === 0) this.state(a, 'emerge', 1400);
      } else {
        a.alpha = easePose(a.alpha, a.inactive ? 1 - a.inactive / 5000 : 1, dt, 350);
      }
      const speed = lizardSpeed(a.state);
      if (!speed && a.perchLift > 0 && a.state !== 'hide') {
        // A rotated/moved/removed stone must not leave its resident at the old height.
        const support = h.lizardSpots.find((p) => Math.hypot(p.x - a.tx, p.y - a.ty) < 0.16);
        a.perchLift = support?.lift ?? 0;
      }
      if (a.target?.lift !== undefined && !a.prey) {
        const support = h.lizardSpots.find((p) => Math.hypot(p.x - a.target!.x, p.y - a.target!.y) < 0.16);
        a.target = { ...a.target, lift: support?.lift ?? 0 };
      }
      if (!speed || !a.target) a.lift = easePose(a.lift, a.perchLift, dt, 220);
      a.motion = easePose(a.motion, speed && a.target ? 1 : 0, dt, 100);
      if (speed && a.target) {
        // A moving insect can escape; we don't chase it across water or the whole map.
        if (a.prey) {
          if (!flutters.includes(a.prey) || a.prey.resting <= 0 || Math.hypot(a.prey.tx - a.tx, a.prey.ty - a.ty) > 2) {
            a.target = null;
            this.state(a, 'look', 1500);
            continue;
          }
          a.target = { x: a.prey.tx, y: a.prey.ty };
        }
        const dx = a.target.x - a.tx,
          dy = a.target.y - a.ty,
          d = Math.hypot(dx, dy);
        const step = Math.min(d, speed * dt);
        const next = { x: a.tx + (dx / (d || 1)) * step, y: a.ty + (dy / (d || 1)) * step };
        if (!lizardRoute(world, { x: a.tx, y: a.ty }, next)) {
          a.target = null;
          this.state(a, a.inactive ? 'hide' : 'look', 1600);
          continue;
        }
        if (Math.abs(dx - dy) > 0.015) a.facing = dx - dy > 0 ? 1 : -1;
        a.tx = next.x;
        a.ty = next.y;
        a.gait += (step / 0.22) * Math.PI * 2;
        a.lift = easePose(a.lift, d < 0.45 ? (a.target.lift ?? 0) : 0, dt, 220);
        if (d < 0.07 || a.timer <= 0) {
          const state = a.state;
          a.perchLift = a.target.lift ?? 0;
          a.target = null;
          if (state === 'hunt') this.state(a, 'strike', 480);
          else if (state === 'flee' || state === 'leave') this.state(a, 'hide', 4000 + this.rnd() * 4000);
          else this.state(a, 'bask', 6000 + this.rnd() * 9000);
        }
      } else if (a.state === 'strike' && a.timer <= 0) {
        if (a.prey && a.prey.resting > 0 && Math.hypot(a.prey.tx - a.tx, a.prey.ty - a.ty) < 0.35) {
          const index = flutters.indexOf(a.prey);
          if (index >= 0) {
            flutters.splice(index, 1);
            a.catches++;
            world.noteEvent('lizard_hunt', Date.now(), a.tx, a.ty);
          }
        }
        a.hunger = 25000;
        this.state(a, 'look', 2200);
      } else if (a.timer <= 0 && !['hide', 'strike'].includes(a.state)) {
        if (alarm) {
          this.state(a, 'look', 1500);
          continue;
        }
        const peers = this.agents.filter((b) => b !== a && b.alpha > 0.2).map((b) => ({ x: b.tx, y: b.ty }));
        const free = (p: Vec) => ![...occupied, ...peers].some((b) => Math.hypot(b.x - p.x, b.y - p.y) < 0.6);
        const prey =
          a.hunger <= 0 && a.catches < 2
            ? flutters.find(
                (f) =>
                  f.resting > 0 &&
                  Math.hypot(f.tx - a.tx, f.ty - a.ty) < 1.6 &&
                  lizardRoute(world, { x: a.tx, y: a.ty }, { x: f.tx, y: f.ty }),
              )
            : null;
        if (prey) {
          a.prey = prey;
          a.target = { x: prey.tx, y: prey.ty };
          this.state(a, 'hunt', 4500);
          continue;
        }
        const hot = t.hours >= 12 && t.hours < 15 && t.daylight > 0.85;
        const sites = this.reachable(a, hot && h.shrubs.length ? h.shrubs : sunnyLizardSpots(h), world).filter(free);
        if (sites.length && (a.state === 'emerge' || this.rnd() < 0.65)) {
          a.target = sites[Math.floor(this.rnd() * sites.length)];
          this.state(a, 'walk', 6500);
        } else if (a.hunger <= 0) {
          // Ground micro-prey has no accumulating agents; the little stalking/lunge vignette is local.
          const p = { x: a.tx + (this.rnd() - 0.5) * 0.8, y: a.ty + (this.rnd() - 0.5) * 0.8 };
          if (lizardRoute(world, { x: a.tx, y: a.ty }, p)) {
            a.target = p;
            this.state(a, 'hunt', 1600);
          } else this.state(a, 'look', 2500);
        } else this.state(a, this.rnd() < 0.55 ? 'look' : 'bask', 2500 + this.rnd() * 6000);
      }
    }
    if (this.agents.length < want && this.timer <= 0) {
      this.timer = 25000 + this.rnd() * 25000;
      const sites = h.lizardShelters.filter(
        (p) =>
          lizardGround(world, p.x, p.y) &&
          !occupied.some((b) => Math.hypot(b.x - p.x, b.y - p.y) < 0.6) &&
          !threats.some((th) => Math.hypot(th.x - p.x, th.y - p.y) < th.r * 1.5) &&
          !this.agents.some((a) => Math.hypot(a.tx - p.x, a.ty - p.y) < 1),
      );
      if (sites.length) {
        const site = sites[Math.floor(this.rnd() * sites.length)];
        this.agents.push(makeLizard(Math.floor(this.rnd() * 100000), site));
        world.noteEvent('meet_lizard', Date.now(), site.x, site.y);
      }
    }
  }
}
