/**
 * Дикие соседи: светлячки, цапля, олень, ёжик, мышка, сова, белка, черепаха, пчёлы.
 *
 * Третий слой жизни после котов и птиц: никто из них не живёт в саду
 * постоянно. Светлячки приходят тёплой тихой ночью и гаснут к рассвету,
 * цапля выбирает большой пруд и стоит подолгу, олень выходит к роще
 * на рассвете и сумерках. Ёжик — преимущественно ночной, любит кусты
 * и тихие уголки, сворачивается клубком при виде кота. Мышка — у кормушек
 * и камней, кошки её гоняют. Сова — ночной дозор, охотится на мышей
 * с высоких насестов. Белка — дневная прыгунья, прячет орешки в соснах.
 * Черепаха — греется на камне у пруда, никуда не спешит. Пчёлы — гудят
 * над цветами и ульем в тёплый полдень.
 *
 * Поведение прежнее по духу: пришёл — наблюдает — переместился — ушёл.
 * Никаких нужд и наказаний; только сезон, час, погода и соседи.
 */

import { GRID } from '../core/iso';
import { clamp, lerp, makeRng } from '../core/rng';
import { TimeState } from '../core/clock';
import { Habitat, Invitation, Vec } from './habitat';
import { Threat } from './residents';
import { WeatherState } from './weatherState';
import { ChronicleToastNote } from './world';

const rnd = makeRng(9173);

// ---------------- Светлячки ----------------

export interface Firefly {
  tx: number;
  ty: number;
  ax: number;
  ay: number;
  dir: number;
  seed: number;
  period: number;
  phase: number;
  state: 'fly' | 'rest';
  timer: number;
  alpha: number;
}

export function fireflyGlow(f: Firefly, now: number): number {
  const x = (((now / f.period + f.phase) % 1) + 1) % 1;
  if (x > 0.42) return 0;
  const s = Math.sin((Math.PI * x) / 0.42);
  return s * s;
}

// ---------------- Мотыльки (спутники светлячков) ----------------

export interface Moth {
  tx: number;
  ty: number;
  ax: number;
  ay: number;
  dir: number;
  seed: number;
  phase: number;
  timer: number;
  alpha: number;
  state: 'fly' | 'rest';
  flutter: number;
}

// ---------------- Цапля ----------------

export type HeronState = 'fly-in' | 'stand' | 'stalk' | 'strike' | 'preen' | 'fly-out';

export interface Heron {
  tx: number;
  ty: number;
  from: Vec | null;
  target: Vec | null;
  state: HeronState;
  timer: number;
  facing: 1 | -1;
  phase: number;
  fish: number;
  struck: boolean;
  born: number;
  stay: number;
  seed: number;
}

// ---------------- Олень ----------------

export type DeerState = 'enter' | 'walk' | 'graze' | 'look' | 'leave';

export interface DeerCoat {
  spots: boolean;
  antlers: boolean;
  winter: boolean;
}

export interface Deer {
  tx: number;
  ty: number;
  from: Vec | null;
  target: Vec | null;
  state: DeerState;
  timer: number;
  facing: 1 | -1;
  phase: number;
  seed: number;
  coat: DeerCoat;
  born: number;
  stay: number;
}

// ---------------- Ёжик ----------------

export type HedgehogState = 'enter' | 'walk' | 'forage' | 'sniff' | 'curl' | 'leave';

export interface Hedgehog {
  tx: number;
  ty: number;
  from: Vec | null;
  target: Vec | null;
  state: HedgehogState;
  timer: number;
  facing: 1 | -1;
  phase: number;
  seed: number;
  born: number;
  stay: number;
  curl: number;
}

// ---------------- Мышка ----------------

export type MouseState = 'enter' | 'forage' | 'walk' | 'hide' | 'flee' | 'leave';

export interface Mouse {
  tx: number;
  ty: number;
  from: Vec | null;
  target: Vec | null;
  state: MouseState;
  timer: number;
  facing: 1 | -1;
  phase: number;
  seed: number;
  born: number;
  stay: number;
  panicX: number;
  panicY: number;
  panic: number;
}

// ---------------- Сова ----------------

export type OwlState = 'fly-in' | 'perch' | 'hoot' | 'look' | 'hunt' | 'fly-out';

export interface Owl {
  tx: number;
  ty: number;
  from: Vec | null;
  target: Vec | null;
  state: OwlState;
  timer: number;
  facing: 1 | -1;
  phase: number;
  seed: number;
  born: number;
  stay: number;
  huntX: number;
  huntY: number;
  hoot: number;
}

// ---------------- Белка ----------------

export type SquirrelState = 'enter' | 'jump' | 'forage' | 'cache' | 'look' | 'flee' | 'leave';

export interface Squirrel {
  tx: number;
  ty: number;
  from: Vec | null;
  target: Vec | null;
  state: SquirrelState;
  timer: number;
  facing: 1 | -1;
  phase: number;
  seed: number;
  born: number;
  stay: number;
  hasNut: boolean;
  panic: number;
}

// ---------------- Черепаха ----------------

export type TurtleState = 'enter' | 'bask' | 'walk' | 'swim' | 'hide' | 'look' | 'leave';

export interface Turtle {
  tx: number;
  ty: number;
  from: Vec | null;
  target: Vec | null;
  state: TurtleState;
  timer: number;
  facing: 1 | -1;
  phase: number;
  seed: number;
  born: number;
  stay: number;
  hide: number;
}

// ---------------- Пчёлы ----------------

export interface Bee {
  tx: number;
  ty: number;
  ax: number;
  ay: number;
  alt: number;
  dir: number;
  vx: number;
  vy: number;
  seed: number;
  timer: number;
  phase: number;
  state: 'fly' | 'gather' | 'return';
  target: Vec | null;
  carrying: boolean;
  alpha: number;
}

export class Wildlife {
  fireflies: Firefly[] = [];
  moths: Moth[] = [];
  heron: Heron | null = null;
  deer: Deer[] = [];
  hedgehogs: Hedgehog[] = [];
  mice: Mouse[] = [];
  owls: Owl[] = [];
  squirrels: Squirrel[] = [];
  turtles: Turtle[] = [];
  bees: Bee[] = [];

  onStrike: ((x: number, y: number, caught: boolean) => void) | null = null;

  private notes: ChronicleToastNote[] = [];
  private ffTimer = 0;
  private mothTimer = 0;
  private heronTimer = 120_000;
  private deerTimer = 90_000;
  private hedgehogTimer = 70_000;
  private mouseTimer = 45_000;
  private owlTimer = 100_000;
  private squirrelTimer = 80_000;
  private turtleTimer = 110_000;
  private beeTimer = 0;
  private danceTimer = 0;
  private danced = false;

  takeNotes(): ChronicleToastNote[] {
    const out = this.notes;
    this.notes = [];
    return out;
  }

  private pushNote(id: string, x?: number, y?: number): void {
    if (this.notes.length >= 8) return;
    this.notes.push({ id, x: x ?? GRID / 2, y: y ?? GRID / 2 });
  }

  reset(): void {
    this.fireflies = [];
    this.moths = [];
    this.heron = null;
    this.deer = [];
    this.hedgehogs = [];
    this.mice = [];
    this.owls = [];
    this.squirrels = [];
    this.turtles = [];
    this.bees = [];
    this.notes = [];
    this.ffTimer = 0;
    this.mothTimer = 0;
    this.heronTimer = 120_000;
    this.deerTimer = 90_000;
    this.hedgehogTimer = 70_000;
    this.mouseTimer = 45_000;
    this.owlTimer = 100_000;
    this.squirrelTimer = 80_000;
    this.turtleTimer = 110_000;
    this.beeTimer = 0;
    this.danceTimer = 0;
    this.danced = false;
  }

  update(
    h: Habitat,
    inv: Invitation,
    t: TimeState,
    wx: WeatherState | null,
    dt: number,
    now: number,
    threats: Threat[],
  ): void {
    this.updateFireflies(h, inv, t, wx, dt);
    this.updateMoths(h, inv, t, wx, dt);
    this.updateHeron(h, inv, t, dt, now, threats);
    this.updateDeer(h, inv, t, dt, now, threats);
    this.updateHedgehogs(h, inv, t, dt, now, threats);
    this.updateMice(h, inv, t, dt, now, threats);
    this.updateOwls(h, inv, t, dt, now, threats);
    this.updateSquirrels(h, inv, t, dt, now, threats);
    this.updateTurtles(h, inv, t, dt, now, threats);
    this.updateBees(h, inv, t, wx, dt);
  }

  // ---------------- Светлячки ----------------

  private updateFireflies(h: Habitat, inv: Invitation, t: TimeState, wx: WeatherState | null, dt: number): void {
    const want = inv.fireflies;
    if (t.daylight > 0.4) this.danced = false;
    for (let i = this.fireflies.length - 1; i >= 0; i--) {
      const f = this.fireflies[i];
      if (want === 0) {
        f.alpha -= dt / 2600;
        if (f.alpha <= 0) {
          this.fireflies.splice(i, 1);
          continue;
        }
      } else if (f.alpha < 1) {
        f.alpha = Math.min(1, f.alpha + dt / 1800);
      }
      f.timer -= dt;
      if (f.state === 'rest') {
        if (f.timer <= 0) {
          f.state = 'fly';
          f.timer = 4000 + rnd() * 8000;
        }
        continue;
      }
      if (f.timer <= 0 && rnd() < 0.25) {
        f.state = 'rest';
        f.timer = 3000 + rnd() * 6000;
        continue;
      }
      f.dir += (rnd() - 0.5) * 0.006 * dt;
      const v = 0.00055 * dt;
      f.tx += Math.cos(f.dir) * v;
      f.ty += Math.sin(f.dir) * v * 0.6;
      const dx = f.ax - f.tx;
      const dy = f.ay - f.ty;
      const d = Math.hypot(dx, dy);
      if (d > 3) {
        f.tx += (dx / d) * v * 1.4;
        f.ty += (dy / d) * v * 1.4;
      }
      f.tx = clamp(f.tx, 1, GRID - 1);
      f.ty = clamp(f.ty, 1, GRID - 1);
    }
    this.ffTimer -= dt;
    while (this.fireflies.length < want && this.ffTimer <= 0) {
      this.ffTimer = 350 + rnd() * 800;
      const a = this.fireflyAnchor(h);
      if (!a) break;
      this.fireflies.push({
        tx: a.x + (rnd() - 0.5) * 2,
        ty: a.y + (rnd() - 0.5) * 2,
        ax: a.x,
        ay: a.y,
        dir: rnd() * Math.PI * 2,
        seed: Math.floor(rnd() * 10000),
        period: 1700 + rnd() * 1900,
        phase: rnd(),
        state: 'fly',
        timer: 4000 + rnd() * 8000,
        alpha: 0,
      });
      this.pushNote('meet_firefly', a.x, a.y);
    }
    const wet = wx ? wx.wetness : 0;
    if (!this.danced && this.fireflies.length >= 8 && wet > 0.35 && t.daylight < 0.18) {
      this.danceTimer += dt;
      if (this.danceTimer > 9000 + 6000 * rnd()) {
        this.danced = true;
        this.danceTimer = 0;
        this.pushNote('firefly_dance', this.fireflies[0]?.tx, this.fireflies[0]?.ty);
      }
    } else if (this.fireflies.length < 8 || t.daylight > 0.3) {
      this.danceTimer = 0;
    }
  }

  private fireflyAnchor(h: Habitat): Vec | null {
    const pool: Vec[] = [];
    for (const p of h.ponds) for (const s of p.shores) pool.push(s);
    for (const g of h.glades) pool.push(g);
    for (const tr of h.trees) pool.push({ x: tr.x + 1, y: tr.y + 1 });
    if (!pool.length) return null;
    return pool[Math.floor(rnd() * pool.length)];
  }

  private mothAnchor(h: Habitat): Vec | null {
    const pool: Vec[] = [];
    for (const s of h.shelters) pool.push(s);
    for (const b of h.baths) pool.push(b);
    for (const f of h.beeSpots) pool.push(f);
    for (const g of h.glades) pool.push(g);
    if (!pool.length) return null;
    return pool[Math.floor(rnd() * pool.length)];
  }

  private updateMoths(h: Habitat, inv: Invitation, _t: TimeState, _wx: WeatherState | null, dt: number): void {
    const want = inv.moths;
    for (let i = this.moths.length - 1; i >= 0; i--) {
      const m = this.moths[i];
      if (want === 0) {
        m.alpha -= dt / 2600;
        if (m.alpha <= 0) {
          this.moths.splice(i, 1);
          continue;
        }
      } else if (m.alpha < 1) {
        m.alpha = Math.min(1, m.alpha + dt / 1800);
      }
      m.timer -= dt;
      m.phase += dt * 0.005;
      m.flutter += dt * 0.018;
      if (m.state === 'rest') {
        if (m.timer <= 0) {
          m.state = 'fly';
          m.timer = 3000 + rnd() * 6000;
        }
        continue;
      }
      if (m.timer <= 0 && rnd() < 0.28) {
        m.state = 'rest';
        m.timer = 2000 + rnd() * 4000;
        continue;
      }
      // мотылёк летит рывками, тянется к свету (ax,ay)
      m.dir += (rnd() - 0.5) * 0.008 * dt;
      const v = 0.00062 * dt;
      m.tx += Math.cos(m.dir) * v + Math.sin(m.flutter) * 0.00018 * dt;
      m.ty += Math.sin(m.dir) * v * 0.7;
      const dx = m.ax - m.tx;
      const dy = m.ay - m.ty;
      const d = Math.hypot(dx, dy);
      if (d > 2.5) {
        m.tx += (dx / d) * v * 1.2;
        m.ty += (dy / d) * v * 1.2;
      }
      m.tx = clamp(m.tx, 1, GRID - 1);
      m.ty = clamp(m.ty, 1, GRID - 1);
    }
    this.mothTimer -= dt;
    while (this.moths.length < want && this.mothTimer <= 0) {
      this.mothTimer = 400 + rnd() * 900;
      const a = this.mothAnchor(h);
      if (!a) break;
      this.moths.push({
        tx: a.x + (rnd() - 0.5) * 2.5,
        ty: a.y + (rnd() - 0.5) * 2.5,
        ax: a.x,
        ay: a.y,
        dir: rnd() * Math.PI * 2,
        seed: Math.floor(rnd() * 10000),
        phase: rnd() * 10,
        timer: 3000 + rnd() * 6000,
        alpha: 0,
        state: 'fly',
        flutter: rnd() * 10,
      });
      this.pushNote('meet_moth', a.x, a.y);
    }
  }

  // ---------------- Цапля ----------------

  private updateHeron(h: Habitat, inv: Invitation, t: TimeState, dt: number, now: number, threats: Threat[]): void {
    if (!this.heron) {
      if (!inv.heron) return;
      this.heronTimer -= dt;
      if (this.heronTimer > 0) return;
      this.heronTimer = 240_000 + rnd() * 240_000;
      const golden = t.golden > 0.25;
      const chance = golden ? 0.55 : t.daylight > 0.5 ? 0.3 : 0.08;
      const seasonK = t.season === 'winter' ? 0.35 : t.season === 'summer' ? 0.8 : 1;
      if (rnd() > chance * seasonK) return;
      const pond = h.ponds.slice().sort((a, b) => b.area - a.area)[0];
      if (!pond || !pond.shores.length) return;
      const spot = pond.shores[Math.floor(rnd() * pond.shores.length)];
      const fromLeft = rnd() > 0.5;
      this.heron = {
        tx: fromLeft ? -3 : GRID + 3,
        ty: clamp(spot.y + (rnd() - 0.5) * 4, 1, GRID - 1),
        from: null,
        target: { x: spot.x, y: spot.y },
        state: 'fly-in',
        timer: 0,
        facing: fromLeft ? 1 : -1,
        phase: 0,
        fish: 0,
        struck: false,
        born: now,
        stay: 150_000 + rnd() * 180_000,
        seed: Math.floor(rnd() * 10000),
      };
      return;
    }
    const hr = this.heron;
    hr.timer -= dt;
    if (hr.fish > 0) {
      hr.fish -= dt / 1000;
      if (hr.fish < 0) hr.fish = 0;
    }
    const catNear = threats.some((c) => Math.hypot(c.x - hr.tx, c.y - hr.ty) < 4);
    if (catNear && hr.state !== 'fly-out') {
      hr.state = 'fly-out';
      hr.target = this.exitFrom(hr.tx, hr.ty);
      hr.from = { x: hr.tx, y: hr.ty };
      hr.phase = 0;
    }
    if (now - hr.born > hr.stay && hr.state !== 'fly-out' && hr.state !== 'strike') {
      hr.state = 'fly-out';
      hr.target = this.exitFrom(hr.tx, hr.ty);
      hr.from = { x: hr.tx, y: hr.ty };
      hr.phase = 0;
    }
    switch (hr.state) {
      case 'fly-in': {
        if (!hr.target) break;
        hr.from = hr.from ?? { x: hr.tx, y: hr.ty };
        hr.phase = Math.min(1, hr.phase + dt * 0.00014);
        hr.tx = lerp(hr.from.x, hr.target.x, hr.phase);
        hr.ty = lerp(hr.from.y, hr.target.y, hr.phase);
        if (hr.phase >= 1) {
          hr.state = 'stand';
          hr.timer = 16_000 + rnd() * 26_000;
          this.pushNote('meet_heron', hr.tx, hr.ty);
        }
        break;
      }
      case 'stand': {
        if (hr.timer <= 0) {
          const r = rnd();
          if (r < 0.45) this.heronStep(hr, h, 0.5);
          else if (r < 0.65) {
            hr.state = 'preen';
            hr.timer = 6000 + rnd() * 7000;
          } else if (r < 0.85) {
            hr.state = 'stand';
            hr.timer = 10_000 + rnd() * 18_000;
          } else this.heronLeave(hr);
        }
        break;
      }
      case 'stalk': {
        if (!hr.target) break;
        hr.from = hr.from ?? { x: hr.tx, y: hr.ty };
        hr.phase = Math.min(1, hr.phase + dt * 0.00016);
        hr.tx = lerp(hr.from.x, hr.target.x, hr.phase);
        hr.ty = lerp(hr.from.y, hr.target.y, hr.phase);
        if (Math.abs(hr.target.x - hr.tx) > 0.05) hr.facing = hr.target.x > hr.tx ? 1 : -1;
        if (hr.phase >= 1) {
          const r = rnd();
          if (r < 0.5) {
            hr.state = 'strike';
            hr.timer = 900;
            hr.struck = false;
          } else if (r < 0.8) {
            this.heronStep(hr, h, 0.35);
          } else {
            hr.state = 'stand';
            hr.timer = 8000 + rnd() * 14_000;
          }
        }
        break;
      }
      case 'strike': {
        if (!hr.struck && hr.timer < 500) {
          hr.struck = true;
          const caught = rnd() < 0.35;
          if (caught) {
            hr.fish = 3;
            this.pushNote('heron_strike', hr.tx, hr.ty);
          }
          if (this.onStrike) this.onStrike(hr.tx, hr.ty, caught);
        }
        if (hr.timer <= 0) {
          hr.state = 'stand';
          hr.timer = 9000 + rnd() * 16_000;
        }
        break;
      }
      case 'preen': {
        if (hr.timer <= 0) {
          hr.state = 'stand';
          hr.timer = 8000 + rnd() * 14_000;
        }
        break;
      }
      case 'fly-out': {
        if (!hr.target) break;
        hr.from = hr.from ?? { x: hr.tx, y: hr.ty };
        hr.phase = Math.min(1, hr.phase + dt * 0.00012);
        hr.tx = lerp(hr.from.x, hr.target.x, hr.phase);
        hr.ty = lerp(hr.from.y, hr.target.y, hr.phase);
        if (hr.phase >= 1 || hr.tx < -4 || hr.tx > GRID + 4 || hr.ty < -4 || hr.ty > GRID + 4) {
          this.heron = null;
        }
        break;
      }
    }
  }

  private heronStep(hr: Heron, h: Habitat, strikeBias: number): void {
    const pond = h.ponds.slice().sort((a, b) => b.area - a.area)[0];
    if (!pond) {
      hr.state = 'stand';
      hr.timer = 8000;
      return;
    }
    const near = pond.shores.filter((s) => Math.hypot(s.x - hr.tx, s.y - hr.ty) < 3.5);
    const spot = near.length ? near[Math.floor(rnd() * near.length)] : pond.shores[0];
    hr.from = { x: hr.tx, y: hr.ty };
    hr.target = { x: spot.x, y: spot.y };
    hr.phase = 0;
    hr.state = 'stalk';
    void strikeBias;
  }

  private heronLeave(hr: Heron): void {
    hr.state = 'fly-out';
    hr.target = this.exitFrom(hr.tx, hr.ty);
    hr.from = { x: hr.tx, y: hr.ty };
    hr.phase = 0;
  }

  // ---------------- Олень ----------------

  private updateDeer(h: Habitat, inv: Invitation, t: TimeState, dt: number, now: number, threats: Threat[]): void {
    for (let i = this.deer.length - 1; i >= 0; i--) {
      const d = this.deer[i];
      d.timer -= dt;
      const shy = threats.some((c) => Math.hypot(c.x - d.tx, c.y - d.ty) < 2.6);
      if (shy && d.state !== 'leave') {
        d.state = 'leave';
        d.target = this.exitFrom(d.tx, d.ty);
        d.from = { x: d.tx, y: d.ty };
        d.phase = 0;
      }
      if (now - d.born > d.stay && d.state !== 'leave') {
        d.state = 'leave';
        d.target = this.exitFrom(d.tx, d.ty);
        d.from = { x: d.tx, y: d.ty };
        d.phase = 0;
      }
      switch (d.state) {
        case 'enter':
        case 'walk': {
          if (!d.target) break;
          d.from = d.from ?? { x: d.tx, y: d.ty };
          const v = d.state === 'enter' ? 0.00022 : 0.00018;
          d.phase = Math.min(1, d.phase + dt * v);
          d.tx = lerp(d.from.x, d.target.x, d.phase);
          d.ty = lerp(d.from.y, d.target.y, d.phase);
          if (Math.abs(d.target.x - d.tx) > 0.05) d.facing = d.target.x > d.tx ? 1 : -1;
          if (d.phase >= 1) {
            d.state = 'graze';
            d.timer = 8000 + rnd() * 14_000;
          }
          break;
        }
        case 'graze': {
          if (d.timer <= 0) {
            d.state = 'look';
            d.timer = 2600 + rnd() * 3600;
          }
          break;
        }
        case 'look': {
          if (d.timer <= 0) {
            if (rnd() < 0.4 && h.glades.length) {
              const g = h.glades[Math.floor(rnd() * h.glades.length)];
              d.from = { x: d.tx, y: d.ty };
              d.target = { x: g.x, y: g.y };
              d.phase = 0;
              d.state = 'walk';
            } else {
              d.state = 'graze';
              d.timer = 7000 + rnd() * 12_000;
            }
          }
          break;
        }
        case 'leave': {
          if (!d.target) break;
          d.from = d.from ?? { x: d.tx, y: d.ty };
          d.phase = Math.min(1, d.phase + dt * 0.00024);
          d.tx = lerp(d.from.x, d.target.x, d.phase);
          d.ty = lerp(d.from.y, d.target.y, d.phase);
          if (Math.abs(d.target.x - d.tx) > 0.05) d.facing = d.target.x > d.tx ? 1 : -1;
          if (d.phase >= 1 || d.tx < -4 || d.tx > GRID + 4 || d.ty < -4 || d.ty > GRID + 4) {
            this.deer.splice(i, 1);
          }
          break;
        }
      }
    }
    if (this.deer.length >= inv.deer) return;
    this.deerTimer -= dt;
    if (this.deerTimer > 0) return;
    this.deerTimer = 180_000 + rnd() * 240_000;
    const dawn = t.hours >= 5 && t.hours <= 9;
    const dusk = t.hours >= 17 && t.hours <= 21;
    const chance = dawn ? 0.5 : dusk ? 0.45 : t.daylight > 0.4 ? 0.1 : 0.05;
    const seasonK = t.season === 'winter' ? 0.4 : t.season === 'summer' ? 0.8 : 1;
    if (rnd() > chance * seasonK) return;
    const g = h.glades[Math.floor(rnd() * h.glades.length)];
    if (!g) return;
    const edge = this.exitFrom(g.x, g.y);
    this.deer.push({
      tx: edge.x,
      ty: edge.y,
      from: null,
      target: { x: g.x, y: g.y },
      state: 'enter',
      timer: 0,
      facing: edge.x < g.x ? 1 : -1,
      phase: 0,
      seed: Math.floor(rnd() * 10000),
      coat: {
        spots: t.season === 'spring' || t.season === 'summer',
        antlers: t.season === 'autumn' || t.season === 'summer',
        winter: t.season === 'winter',
      },
      born: now,
      stay: 150_000 + rnd() * 250_000,
    });
    this.pushNote('meet_deer', g.x, g.y);
    if (this.deer.length >= 2) this.pushNote('deer_pair', g.x, g.y);
  }

  // ---------------- Ёжик ----------------

  private updateHedgehogs(h: Habitat, inv: Invitation, t: TimeState, dt: number, now: number, threats: Threat[]): void {
    for (let i = this.hedgehogs.length - 1; i >= 0; i--) {
      const e = this.hedgehogs[i];
      e.timer -= dt;
      if (e.curl > 0) e.curl -= dt;
      const catClose = threats.find((c) => Math.hypot(c.x - e.tx, c.y - e.ty) < 2.2);
      if (catClose && e.state !== 'curl' && e.state !== 'leave') {
        e.state = 'curl';
        e.curl = 4000 + rnd() * 6000;
        e.timer = e.curl + 1000;
        if (rnd() < 0.4) this.pushNote('hedgehog_curl', e.tx, e.ty);
      }
      if (now - e.born > e.stay && e.state !== 'leave' && e.state !== 'curl') {
        e.state = 'leave';
        e.target = this.exitFrom(e.tx, e.ty);
        e.from = { x: e.tx, y: e.ty };
        e.phase = 0;
      }
      switch (e.state) {
        case 'enter':
        case 'walk': {
          if (!e.target) break;
          e.from = e.from ?? { x: e.tx, y: e.ty };
          const v = e.state === 'enter' ? 0.00032 : 0.00022;
          e.phase = Math.min(1, e.phase + dt * v);
          e.tx = lerp(e.from.x, e.target.x, e.phase);
          e.ty = lerp(e.from.y, e.target.y, e.phase);
          if (Math.abs(e.target.x - e.tx) > 0.05) e.facing = e.target.x > e.tx ? 1 : -1;
          if (e.phase >= 1) {
            e.state = rnd() < 0.5 ? 'forage' : 'sniff';
            e.timer = 4000 + rnd() * 8000;
          }
          break;
        }
        case 'forage': {
          if (e.timer <= 0) {
            const r = rnd();
            if (r < 0.45 && h.hedgehogSpots.length) {
              const g = h.hedgehogSpots[Math.floor(rnd() * h.hedgehogSpots.length)];
              e.from = { x: e.tx, y: e.ty };
              e.target = { x: g.x, y: g.y };
              e.phase = 0;
              e.state = 'walk';
            } else if (r < 0.7) {
              e.state = 'sniff';
              e.timer = 2000 + rnd() * 3000;
            } else {
              e.state = 'forage';
              e.timer = 3000 + rnd() * 6000;
            }
          }
          break;
        }
        case 'sniff': {
          if (e.timer <= 0) {
            e.state = 'forage';
            e.timer = 3000 + rnd() * 7000;
          }
          break;
        }
        case 'curl': {
          if (e.curl <= 0) {
            const stillClose = threats.some((c) => Math.hypot(c.x - e.tx, c.y - e.ty) < 2.8);
            if (stillClose) {
              e.curl = 2000 + rnd() * 4000;
              e.timer = e.curl + 500;
            } else {
              e.state = 'forage';
              e.timer = 2000 + rnd() * 4000;
            }
          }
          break;
        }
        case 'leave': {
          if (!e.target) break;
          e.from = e.from ?? { x: e.tx, y: e.ty };
          e.phase = Math.min(1, e.phase + dt * 0.00028);
          e.tx = lerp(e.from.x, e.target.x, e.phase);
          e.ty = lerp(e.from.y, e.target.y, e.phase);
          if (Math.abs(e.target.x - e.tx) > 0.05) e.facing = e.target.x > e.tx ? 1 : -1;
          if (e.phase >= 1 || e.tx < -4 || e.tx > GRID + 4 || e.ty < -4 || e.ty > GRID + 4) {
            this.hedgehogs.splice(i, 1);
          }
          break;
        }
      }
      e.tx = clamp(e.tx, 0.5, GRID - 0.5);
      e.ty = clamp(e.ty, 0.5, GRID - 0.5);
    }
    if (this.hedgehogs.length >= inv.hedgehog) return;
    this.hedgehogTimer -= dt;
    if (this.hedgehogTimer > 0) return;
    this.hedgehogTimer = 120_000 + rnd() * 180_000;
    const night = t.daylight < 0.22;
    const dusk = t.hours >= 19 || t.hours <= 5;
    const chance = night ? 0.55 : dusk ? 0.35 : 0.06;
    if (rnd() > chance) return;
    const spot = h.hedgehogSpots[Math.floor(rnd() * h.hedgehogSpots.length)];
    if (!spot) return;
    const edge = this.exitFrom(spot.x, spot.y);
    this.hedgehogs.push({
      tx: edge.x,
      ty: edge.y,
      from: null,
      target: { x: spot.x, y: spot.y },
      state: 'enter',
      timer: 0,
      facing: edge.x < spot.x ? 1 : -1,
      phase: 0,
      seed: Math.floor(rnd() * 10000),
      born: now,
      stay: 120_000 + rnd() * 200_000,
      curl: 0,
    });
    this.pushNote('meet_hedgehog', spot.x, spot.y);
  }

  // ---------------- Мышка ----------------

  private updateMice(h: Habitat, inv: Invitation, _t: TimeState, dt: number, now: number, threats: Threat[]): void {
    for (let i = this.mice.length - 1; i >= 0; i--) {
      const m = this.mice[i];
      m.timer -= dt;
      if (m.panic > 0) m.panic -= dt;
      const cat = threats.find((c) => Math.hypot(c.x - m.tx, c.y - m.ty) < 3.0);
      const owl = this.owls.find((o) => o.state === 'hunt' && Math.hypot(o.huntX - m.tx, o.huntY - m.ty) < 2.2);
      const danger = cat ?? (owl ? { x: owl.huntX, y: owl.huntY, r: 2 } as Threat : null);
      if (danger && m.state !== 'flee' && m.state !== 'hide' && m.state !== 'leave') {
        const shelter = this.nearestMouseSpot(h, m.tx, m.ty);
        if (shelter) {
          m.state = 'flee';
          m.from = { x: m.tx, y: m.ty };
          m.target = shelter;
          m.phase = 0;
          m.panic = 2500;
          m.panicX = danger.x;
          m.panicY = danger.y;
          m.timer = 4000;
          if (rnd() < 0.5) this.pushNote('mouse_fled', m.tx, m.ty);
        }
      }
      if (now - m.born > m.stay && m.state !== 'leave' && m.state !== 'flee') {
        m.state = 'leave';
        m.target = this.exitFrom(m.tx, m.ty);
        m.from = { x: m.tx, y: m.ty };
        m.phase = 0;
      }
      switch (m.state) {
        case 'enter':
        case 'walk': {
          if (!m.target) break;
          m.from = m.from ?? { x: m.tx, y: m.ty };
          const v = m.state === 'enter' ? 0.00055 : 0.00042;
          m.phase = Math.min(1, m.phase + dt * v);
          m.tx = lerp(m.from.x, m.target.x, m.phase);
          m.ty = lerp(m.from.y, m.target.y, m.phase);
          if (Math.abs(m.target.x - m.tx) > 0.05) m.facing = m.target.x > m.tx ? 1 : -1;
          if (m.phase >= 1) {
            m.state = rnd() < 0.6 ? 'forage' : 'hide';
            m.timer = m.state === 'forage' ? 3000 + rnd() * 6000 : 2000 + rnd() * 4000;
          }
          break;
        }
        case 'forage': {
          if (m.timer <= 0) {
            const r = rnd();
            if (r < 0.5 && h.mouseSpots.length) {
              const g = h.mouseSpots[Math.floor(rnd() * h.mouseSpots.length)];
              m.from = { x: m.tx, y: m.ty };
              m.target = { x: g.x, y: g.y };
              m.phase = 0;
              m.state = 'walk';
            } else if (r < 0.75) {
              m.state = 'hide';
              m.timer = 2500 + rnd() * 5000;
            } else {
              m.state = 'forage';
              m.timer = 2000 + rnd() * 4000;
            }
          }
          break;
        }
        case 'hide': {
          if (m.timer <= 0) {
            m.state = 'forage';
            m.timer = 2000 + rnd() * 5000;
          }
          break;
        }
        case 'flee': {
          if (!m.target) break;
          m.from = m.from ?? { x: m.tx, y: m.ty };
          m.phase = Math.min(1, m.phase + dt * 0.0011);
          m.tx = lerp(m.from.x, m.target.x, m.phase);
          m.ty = lerp(m.from.y, m.target.y, m.phase);
          if (Math.abs(m.target.x - m.tx) > 0.05) m.facing = m.target.x > m.tx ? 1 : -1;
          if (m.phase >= 1) {
            m.state = 'hide';
            m.timer = 3000 + rnd() * 7000;
            m.panic = 0;
          }
          break;
        }
        case 'leave': {
          if (!m.target) break;
          m.from = m.from ?? { x: m.tx, y: m.ty };
          m.phase = Math.min(1, m.phase + dt * 0.00052);
          m.tx = lerp(m.from.x, m.target.x, m.phase);
          m.ty = lerp(m.from.y, m.target.y, m.phase);
          if (Math.abs(m.target.x - m.tx) > 0.05) m.facing = m.target.x > m.tx ? 1 : -1;
          if (m.phase >= 1 || m.tx < -4 || m.tx > GRID + 4 || m.ty < -4 || m.ty > GRID + 4) {
            this.mice.splice(i, 1);
          }
          break;
        }
      }
      m.tx = clamp(m.tx, 0.5, GRID - 0.5);
      m.ty = clamp(m.ty, 0.5, GRID - 0.5);
    }
    if (this.mice.length >= inv.mice) return;
    this.mouseTimer -= dt;
    if (this.mouseTimer > 0) return;
    this.mouseTimer = 60_000 + rnd() * 120_000;
    if (rnd() > 0.55) return;
    const spot = h.mouseSpots[Math.floor(rnd() * h.mouseSpots.length)];
    if (!spot) return;
    const edge = this.exitFrom(spot.x, spot.y);
    this.mice.push({
      tx: edge.x,
      ty: edge.y,
      from: null,
      target: { x: spot.x, y: spot.y },
      state: 'enter',
      timer: 0,
      facing: edge.x < spot.x ? 1 : -1,
      phase: 0,
      seed: Math.floor(rnd() * 10000),
      born: now,
      stay: 90_000 + rnd() * 180_000,
      panicX: 0,
      panicY: 0,
      panic: 0,
    });
    this.pushNote('meet_mouse', spot.x, spot.y);
  }

  private nearestMouseSpot(h: Habitat, x: number, y: number): Vec | null {
    let best: Vec | null = null;
    let bd = Infinity;
    for (const s of h.mouseSpots) {
      const d = Math.hypot(s.x - x, s.y - y);
      if (d < bd && d < 6) {
        bd = d;
        best = s;
      }
    }
    return best;
  }

  // ---------------- Сова ----------------

  private updateOwls(h: Habitat, inv: Invitation, _t: TimeState, dt: number, now: number, threats: Threat[]): void {
    for (let i = this.owls.length - 1; i >= 0; i--) {
      const o = this.owls[i];
      o.timer -= dt;
      if (o.hoot > 0) o.hoot -= dt;

      const catNear = threats.some((c) => Math.hypot(c.x - o.tx, c.y - o.ty) < 3.5);
      if (catNear && o.state !== 'fly-out' && o.state !== 'fly-in') {
        o.state = 'fly-out';
        o.target = this.exitFrom(o.tx, o.ty);
        o.from = { x: o.tx, y: o.ty };
        o.phase = 0;
      }
      if (now - o.born > o.stay && o.state !== 'fly-out' && o.state !== 'hunt') {
        o.state = 'fly-out';
        o.target = this.exitFrom(o.tx, o.ty);
        o.from = { x: o.tx, y: o.ty };
        o.phase = 0;
      }

      switch (o.state) {
        case 'fly-in': {
          if (!o.target) break;
          o.from = o.from ?? { x: o.tx, y: o.ty };
          o.phase = Math.min(1, o.phase + dt * 0.00028);
          o.tx = lerp(o.from.x, o.target.x, o.phase);
          o.ty = lerp(o.from.y, o.target.y, o.phase);
          if (o.phase >= 1) {
            o.state = 'perch';
            o.timer = 8000 + rnd() * 12000;
          }
          break;
        }
        case 'perch': {
          if (o.timer <= 0) {
            const r = rnd();
            if (r < 0.3) {
              o.state = 'hoot';
              o.timer = 1800 + rnd() * 1200;
              o.hoot = 1800;
              if (rnd() < 0.5) this.pushNote('owl_hoot', o.tx, o.ty);
            } else if (r < 0.55 && this.mice.length > 0) {
              // Охота на мышку
              const m = this.mice[Math.floor(rnd() * this.mice.length)];
              o.huntX = m.tx;
              o.huntY = m.ty;
              o.from = { x: o.tx, y: o.ty };
              o.target = { x: m.tx, y: m.ty };
              o.phase = 0;
              o.state = 'hunt';
              o.timer = 3000;
            } else if (r < 0.75 && h.owlSpots.length > 1) {
              const g = h.owlSpots[Math.floor(rnd() * h.owlSpots.length)];
              if (Math.hypot(g.x - o.tx, g.y - o.ty) > 1.2) {
                o.from = { x: o.tx, y: o.ty };
                o.target = g;
                o.phase = 0;
                o.state = 'look';
              } else {
                o.state = 'perch';
                o.timer = 5000 + rnd() * 8000;
              }
            } else {
              o.state = 'perch';
              o.timer = 6000 + rnd() * 10000;
            }
          }
          break;
        }
        case 'hoot': {
          if (o.timer <= 0) {
            o.state = 'perch';
            o.timer = 5000 + rnd() * 8000;
          }
          break;
        }
        case 'look': {
          if (!o.target) break;
          o.from = o.from ?? { x: o.tx, y: o.ty };
          o.phase = Math.min(1, o.phase + dt * 0.00042);
          o.tx = lerp(o.from.x, o.target.x, o.phase);
          o.ty = lerp(o.from.y, o.target.y, o.phase);
          if (o.phase >= 1) {
            o.state = 'perch';
            o.timer = 6000 + rnd() * 10000;
          }
          break;
        }
        case 'hunt': {
          if (!o.target) break;
          o.from = o.from ?? { x: o.tx, y: o.ty };
          o.phase = Math.min(1, o.phase + dt * 0.0009);
          o.tx = lerp(o.from.x, o.target.x, o.phase);
          o.ty = lerp(o.from.y, o.target.y, o.phase);
          if (o.phase >= 0.6 && o.phase < 0.7 && rnd() < 0.6) {
            this.pushNote('owl_hunt', o.tx, o.ty);
          }
          if (o.phase >= 1) {
            // Вернуться на насест
            const perch = h.owlSpots[Math.floor(rnd() * h.owlSpots.length)] ?? o.from!;
            o.from = { x: o.tx, y: o.ty };
            o.target = perch;
            o.phase = 0;
            o.state = 'look';
            o.timer = 2000;
          }
          break;
        }
        case 'fly-out': {
          if (!o.target) break;
          o.from = o.from ?? { x: o.tx, y: o.ty };
          o.phase = Math.min(1, o.phase + dt * 0.00032);
          o.tx = lerp(o.from.x, o.target.x, o.phase);
          o.ty = lerp(o.from.y, o.target.y, o.phase);
          if (o.phase >= 1 || o.tx < -4 || o.tx > GRID + 4 || o.ty < -4 || o.ty > GRID + 4) {
            this.owls.splice(i, 1);
          }
          break;
        }
      }
      o.tx = clamp(o.tx, 0.5, GRID - 0.5);
      o.ty = clamp(o.ty, 0.5, GRID - 0.5);
    }

    if (this.owls.length >= inv.owl) return;
    this.owlTimer -= dt;
    if (this.owlTimer > 0) return;
    this.owlTimer = 140_000 + rnd() * 200_000;
    if (rnd() > 0.5) return;
    const spot = h.owlSpots[Math.floor(rnd() * h.owlSpots.length)];
    if (!spot) return;
    const edge = this.exitFrom(spot.x, spot.y);
    this.owls.push({
      tx: edge.x,
      ty: edge.y,
      from: null,
      target: { x: spot.x, y: spot.y },
      state: 'fly-in',
      timer: 0,
      facing: edge.x < spot.x ? 1 : -1,
      phase: 0,
      seed: Math.floor(rnd() * 10000),
      born: now,
      stay: 130_000 + rnd() * 200_000,
      huntX: 0,
      huntY: 0,
      hoot: 0,
    });
    this.pushNote('meet_owl', spot.x, spot.y);
  }

  // ---------------- Белка ----------------

  private updateSquirrels(h: Habitat, inv: Invitation, _t: TimeState, dt: number, now: number, threats: Threat[]): void {
    for (let i = this.squirrels.length - 1; i >= 0; i--) {
      const s = this.squirrels[i];
      s.timer -= dt;
      if (s.panic > 0) s.panic -= dt;

      const cat = threats.find((c) => Math.hypot(c.x - s.tx, c.y - s.ty) < 3.2);
      if (cat && s.state !== 'flee' && s.state !== 'leave') {
        const tree = this.nearestSquirrelSpot(h, s.tx, s.ty);
        if (tree) {
          s.state = 'flee';
          s.from = { x: s.tx, y: s.ty };
          s.target = tree;
          s.phase = 0;
          s.panic = 2500;
          s.timer = 4000;
        }
      }

      if (now - s.born > s.stay && s.state !== 'leave' && s.state !== 'flee') {
        s.state = 'leave';
        s.target = this.exitFrom(s.tx, s.ty);
        s.from = { x: s.tx, y: s.ty };
        s.phase = 0;
      }

      switch (s.state) {
        case 'enter':
        case 'jump': {
          if (!s.target) break;
          s.from = s.from ?? { x: s.tx, y: s.ty };
          const v = s.state === 'enter' ? 0.00055 : 0.00072;
          s.phase = Math.min(1, s.phase + dt * v);
          // Прыжок по дуге
          const t = s.phase;
          const jumpH = Math.sin(t * Math.PI) * 1.2;
          s.tx = lerp(s.from.x, s.target.x, t);
          s.ty = lerp(s.from.y, s.target.y, t) - jumpH * 0.15;
          if (Math.abs(s.target.x - s.tx) > 0.05) s.facing = s.target.x > s.tx ? 1 : -1;
          if (s.phase >= 1) {
            s.state = rnd() < 0.5 ? 'forage' : 'look';
            s.timer = 2000 + rnd() * 4000;
          }
          break;
        }
        case 'forage': {
          if (s.timer <= 0) {
            const r = rnd();
            if (r < 0.45 && h.squirrelSpots.length) {
              const g = h.squirrelSpots[Math.floor(rnd() * h.squirrelSpots.length)];
              if (Math.hypot(g.x - s.tx, g.y - s.ty) > 1.0) {
                s.from = { x: s.tx, y: s.ty };
                s.target = { x: g.x, y: g.y };
                s.phase = 0;
                s.state = 'jump';
              } else {
                s.state = 'cache';
                s.timer = 2200 + rnd() * 2000;
                s.hasNut = true;
              }
            } else if (r < 0.7) {
              s.state = 'cache';
              s.timer = 2000 + rnd() * 2500;
              s.hasNut = rnd() < 0.6;
              if (s.hasNut && rnd() < 0.4) this.pushNote('squirrel_cache', s.tx, s.ty);
            } else {
              s.state = 'look';
              s.timer = 1500 + rnd() * 2500;
            }
          }
          break;
        }
        case 'cache': {
          if (s.timer <= 0) {
            s.hasNut = false;
            s.state = 'forage';
            s.timer = 2000 + rnd() * 4000;
          }
          break;
        }
        case 'look': {
          if (s.timer <= 0) {
            s.state = 'forage';
            s.timer = 2000 + rnd() * 5000;
          }
          break;
        }
        case 'flee': {
          if (!s.target) break;
          s.from = s.from ?? { x: s.tx, y: s.ty };
          s.phase = Math.min(1, s.phase + dt * 0.001);
          s.tx = lerp(s.from.x, s.target.x, s.phase);
          s.ty = lerp(s.from.y, s.target.y, s.phase);
          if (s.phase >= 1) {
            s.state = 'look';
            s.timer = 3000 + rnd() * 5000;
            s.panic = 0;
          }
          break;
        }
        case 'leave': {
          if (!s.target) break;
          s.from = s.from ?? { x: s.tx, y: s.ty };
          s.phase = Math.min(1, s.phase + dt * 0.00055);
          s.tx = lerp(s.from.x, s.target.x, s.phase);
          s.ty = lerp(s.from.y, s.target.y, s.phase);
          if (s.phase >= 1 || s.tx < -4 || s.tx > GRID + 4 || s.ty < -4 || s.ty > GRID + 4) {
            this.squirrels.splice(i, 1);
          }
          break;
        }
      }
      s.tx = clamp(s.tx, 0.5, GRID - 0.5);
      s.ty = clamp(s.ty, 0.5, GRID - 0.5);
    }

    if (this.squirrels.length >= inv.squirrel) return;
    this.squirrelTimer -= dt;
    if (this.squirrelTimer > 0) return;
    this.squirrelTimer = 90_000 + rnd() * 150_000;
    if (rnd() > 0.55) return;
    const spot = h.squirrelSpots[Math.floor(rnd() * h.squirrelSpots.length)];
    if (!spot) return;
    const edge = this.exitFrom(spot.x, spot.y);
    this.squirrels.push({
      tx: edge.x,
      ty: edge.y,
      from: null,
      target: { x: spot.x, y: spot.y },
      state: 'enter',
      timer: 0,
      facing: edge.x < spot.x ? 1 : -1,
      phase: 0,
      seed: Math.floor(rnd() * 10000),
      born: now,
      stay: 120_000 + rnd() * 200_000,
      hasNut: false,
      panic: 0,
    });
    this.pushNote('meet_squirrel', spot.x, spot.y);
  }

  private nearestSquirrelSpot(h: Habitat, x: number, y: number): Vec | null {
    let best: Vec | null = null;
    let bd = Infinity;
    for (const s of h.squirrelSpots) {
      const d = Math.hypot(s.x - x, s.y - y);
      if (d < bd && d < 7) {
        bd = d;
        best = s;
      }
    }
    return best;
  }

  // ---------------- Черепаха ----------------

  private updateTurtles(h: Habitat, inv: Invitation, _t: TimeState, dt: number, now: number, threats: Threat[]): void {
    for (let i = this.turtles.length - 1; i >= 0; i--) {
      const tu = this.turtles[i];
      tu.timer -= dt;
      if (tu.hide > 0) tu.hide -= dt;

      const catClose = threats.find((c) => Math.hypot(c.x - tu.tx, c.y - tu.ty) < 2.0);
      if (catClose && tu.state !== 'hide' && tu.state !== 'leave') {
        tu.state = 'hide';
        tu.hide = 4000 + rnd() * 5000;
        tu.timer = tu.hide + 1000;
      }

      if (now - tu.born > tu.stay && tu.state !== 'leave' && tu.state !== 'hide') {
        tu.state = 'leave';
        tu.target = this.exitFrom(tu.tx, tu.ty);
        tu.from = { x: tu.tx, y: tu.ty };
        tu.phase = 0;
      }

      switch (tu.state) {
        case 'enter':
        case 'walk': {
          if (!tu.target) break;
          tu.from = tu.from ?? { x: tu.tx, y: tu.ty };
          const v = tu.state === 'enter' ? 0.00018 : 0.00014;
          tu.phase = Math.min(1, tu.phase + dt * v);
          tu.tx = lerp(tu.from.x, tu.target.x, tu.phase);
          tu.ty = lerp(tu.from.y, tu.target.y, tu.phase);
          if (tu.phase >= 1) {
            tu.state = 'bask';
            tu.timer = 12000 + rnd() * 20000;
            if (rnd() < 0.3) this.pushNote('turtle_bask', tu.tx, tu.ty);
          }
          break;
        }
        case 'bask': {
          if (tu.timer <= 0) {
            const r = rnd();
            if (r < 0.4 && h.turtleSpots.length > 1) {
              const g = h.turtleSpots[Math.floor(rnd() * h.turtleSpots.length)];
              if (Math.hypot(g.x - tu.tx, g.y - tu.ty) > 1.2) {
                tu.from = { x: tu.tx, y: tu.ty };
                tu.target = g;
                tu.phase = 0;
                tu.state = 'walk';
              } else {
                tu.state = 'look';
                tu.timer = 4000 + rnd() * 6000;
              }
            } else if (r < 0.7) {
              tu.state = 'look';
              tu.timer = 3000 + rnd() * 5000;
            } else {
              tu.state = 'bask';
              tu.timer = 10000 + rnd() * 15000;
            }
          }
          break;
        }
        case 'look': {
          if (tu.timer <= 0) {
            tu.state = 'bask';
            tu.timer = 8000 + rnd() * 15000;
          }
          break;
        }
        case 'hide': {
          if (tu.hide <= 0) {
            const stillClose = threats.some((c) => Math.hypot(c.x - tu.tx, c.y - tu.ty) < 2.5);
            if (stillClose) {
              tu.hide = 2000 + rnd() * 3000;
              tu.timer = tu.hide + 500;
            } else {
              tu.state = 'bask';
              tu.timer = 5000 + rnd() * 8000;
            }
          }
          break;
        }
        case 'swim': {
          // Пока просто как walk, но медленнее
          if (!tu.target) break;
          tu.from = tu.from ?? { x: tu.tx, y: tu.ty };
          tu.phase = Math.min(1, tu.phase + dt * 0.00012);
          tu.tx = lerp(tu.from.x, tu.target.x, tu.phase);
          tu.ty = lerp(tu.from.y, tu.target.y, tu.phase);
          if (tu.phase >= 1) {
            tu.state = 'bask';
            tu.timer = 10000 + rnd() * 15000;
          }
          break;
        }
        case 'leave': {
          if (!tu.target) break;
          tu.from = tu.from ?? { x: tu.tx, y: tu.ty };
          tu.phase = Math.min(1, tu.phase + dt * 0.00018);
          tu.tx = lerp(tu.from.x, tu.target.x, tu.phase);
          tu.ty = lerp(tu.from.y, tu.target.y, tu.phase);
          if (tu.phase >= 1 || tu.tx < -4 || tu.tx > GRID + 4 || tu.ty < -4 || tu.ty > GRID + 4) {
            this.turtles.splice(i, 1);
          }
          break;
        }
      }
      tu.tx = clamp(tu.tx, 0.5, GRID - 0.5);
      tu.ty = clamp(tu.ty, 0.5, GRID - 0.5);
    }

    if (this.turtles.length >= inv.turtle) return;
    this.turtleTimer -= dt;
    if (this.turtleTimer > 0) return;
    this.turtleTimer = 130_000 + rnd() * 200_000;
    if (rnd() > 0.45) return;
    const spot = h.turtleSpots[Math.floor(rnd() * h.turtleSpots.length)];
    if (!spot) return;
    const edge = this.exitFrom(spot.x, spot.y);
    this.turtles.push({
      tx: edge.x,
      ty: edge.y,
      from: null,
      target: { x: spot.x, y: spot.y },
      state: 'enter',
      timer: 0,
      facing: edge.x < spot.x ? 1 : -1,
      phase: 0,
      seed: Math.floor(rnd() * 10000),
      born: now,
      stay: 160_000 + rnd() * 250_000,
      hide: 0,
    });
    this.pushNote('meet_turtle', spot.x, spot.y);
  }

  // ---------------- Пчёлы ----------------

  private updateBees(h: Habitat, inv: Invitation, _t: TimeState, wx: WeatherState | null, dt: number): void {
    const want = inv.bees;
    const wind = 0; // ветер учитывается через life.windAt, здесь не нужен
    void wx;

    for (let i = this.bees.length - 1; i >= 0; i--) {
      const b = this.bees[i];
      if (want === 0) {
        b.alpha -= dt / 2200;
        if (b.alpha <= 0) {
          this.bees.splice(i, 1);
          continue;
        }
      } else if (b.alpha < 1) {
        b.alpha = Math.min(1, b.alpha + dt / 1200);
      }
      b.timer -= dt;
      b.phase += dt * 0.005;

      if (b.timer <= 0 || !b.target) {
        const hive = h.beehives.length && b.carrying ? h.beehives[Math.floor(rnd() * h.beehives.length)] : null;
        const flower = !b.carrying ? h.beeSpots[Math.floor(rnd() * h.beeSpots.length)] : null;
        b.target = hive ?? flower ?? h.beeSpots[Math.floor(rnd() * h.beeSpots.length)] ?? null;
        b.timer = 2000 + rnd() * 4000;
        if (b.target && Math.hypot(b.target.x - b.tx, b.target.y - b.ty) < 0.5) {
          if (b.carrying) {
            b.carrying = false;
            b.state = 'gather';
          } else {
            b.carrying = true;
            b.state = 'return';
          }
          b.timer = 1200 + rnd() * 2000;
        }
      }

      if (b.target) {
        const dx = b.target.x - b.tx;
        const dy = b.target.y - b.ty;
        const d = Math.hypot(dx, dy) || 1;
        const wob = Math.sin(b.phase + b.seed) * 0.4;
        b.vx = (dx / d) * 0.0012 + wob * 0.0002;
        b.vy = (dy / d) * 0.0012;
        // Ветер сносит
        b.tx += (b.vx + wind * 0.0003) * dt;
        b.ty += b.vy * dt;
        b.alt = 6 + Math.sin(b.phase * 2) * 2 + (b.carrying ? 2 : 0);
        b.dir = Math.atan2(dy, dx);
      }
      b.tx = clamp(b.tx, 0.5, GRID - 0.5);
      b.ty = clamp(b.ty, 0.5, GRID - 0.5);
    }

    this.beeTimer -= dt;
    while (this.bees.length < want && this.beeTimer <= 0) {
      this.beeTimer = 180 + rnd() * 350;
      const a = h.beeSpots[Math.floor(rnd() * h.beeSpots.length)] ?? h.glades[Math.floor(rnd() * h.glades.length)];
      if (!a) break;
      this.bees.push({
        tx: a.x + (rnd() - 0.5) * 1.5,
        ty: a.y + (rnd() - 0.5) * 1.5,
        ax: a.x,
        ay: a.y,
        alt: 6 + rnd() * 4,
        dir: rnd() * Math.PI * 2,
        vx: 0,
        vy: 0,
        seed: rnd() * 1000,
        timer: 2000 + rnd() * 4000,
        phase: rnd() * 10,
        state: 'fly',
        target: a,
        carrying: rnd() < 0.5,
        alpha: 0,
      });
      if (this.bees.length === 1) this.pushNote('meet_bee', a.x, a.y);
    }
    if (this.bees.length >= 5 && rnd() < 0.002) this.pushNote('bee_swarm', this.bees[0]?.tx, this.bees[0]?.ty);
  }

  private exitFrom(x: number, y: number): Vec {
    const cx = GRID / 2;
    const cy = GRID / 2;
    const dx = x - cx;
    const dy = y - cy;
    if (Math.abs(dx) > Math.abs(dy)) return { x: dx > 0 ? GRID + 3 : -3, y: clamp(y, 2, GRID - 2) };
    return { x: clamp(x, 2, GRID - 2), y: dy > 0 ? GRID + 3 : -3 };
  }

  force(
    kind: 'fireflies' | 'heron' | 'deer' | 'hedgehog' | 'mouse' | 'owl' | 'squirrel' | 'turtle' | 'bee',
    h: Habitat,
    t: TimeState,
  ): void {
    if (kind === 'fireflies') {
      for (let i = 0; i < 9; i++) {
        const a = this.fireflyAnchor(h);
        if (!a) break;
        this.fireflies.push({
          tx: a.x + (rnd() - 0.5) * 2,
          ty: a.y + (rnd() - 0.5) * 2,
          ax: a.x,
          ay: a.y,
          dir: rnd() * Math.PI * 2,
          seed: 100 + i,
          period: 1700 + rnd() * 1900,
          phase: i / 9,
          state: 'fly',
          timer: 9000,
          alpha: 1,
        });
      }
      return;
    }
    if (kind === 'heron') {
      const pond = h.ponds.slice().sort((a, b) => b.area - a.area)[0];
      if (!pond || !pond.shores.length) return;
      const spot = pond.shores[Math.floor(rnd() * pond.shores.length)];
      const edge = this.exitFrom(spot.x, spot.y);
      this.heron = {
        tx: edge.x,
        ty: edge.y,
        from: null,
        target: { x: spot.x, y: spot.y },
        state: 'fly-in',
        timer: 0,
        facing: edge.x < spot.x ? 1 : -1,
        phase: 0,
        fish: 0,
        struck: false,
        born: 0,
        stay: 10_000_000,
        seed: Math.floor(rnd() * 10000),
      };
      return;
    }
    if (kind === 'hedgehog') {
      const spot = h.hedgehogSpots[Math.floor(rnd() * h.hedgehogSpots.length)] ?? h.glades[0];
      if (!spot) return;
      this.hedgehogs.push({
        tx: spot.x,
        ty: spot.y,
        from: null,
        target: null,
        state: 'forage',
        timer: 20_000,
        facing: 1,
        phase: 1,
        seed: 11,
        born: 0,
        stay: 10_000_000,
        curl: 0,
      });
      return;
    }
    if (kind === 'mouse') {
      const spot = h.mouseSpots[Math.floor(rnd() * h.mouseSpots.length)];
      if (!spot) return;
      this.mice.push({
        tx: spot.x,
        ty: spot.y,
        from: null,
        target: null,
        state: 'forage',
        timer: 20_000,
        facing: 1,
        phase: 1,
        seed: 13,
        born: 0,
        stay: 10_000_000,
        panicX: 0,
        panicY: 0,
        panic: 0,
      });
      return;
    }
    if (kind === 'owl') {
      const spot = h.owlSpots[Math.floor(rnd() * h.owlSpots.length)] ?? h.glades[0];
      if (!spot) return;
      this.owls.push({
        tx: spot.x,
        ty: spot.y,
        from: null,
        target: spot,
        state: 'perch',
        timer: 20_000,
        facing: 1,
        phase: 1,
        seed: 21,
        born: 0,
        stay: 10_000_000,
        huntX: 0,
        huntY: 0,
        hoot: 0,
      });
      return;
    }
    if (kind === 'squirrel') {
      const spot = h.squirrelSpots[Math.floor(rnd() * h.squirrelSpots.length)] ?? h.glades[0];
      if (!spot) return;
      this.squirrels.push({
        tx: spot.x,
        ty: spot.y,
        from: null,
        target: null,
        state: 'forage',
        timer: 20_000,
        facing: 1,
        phase: 1,
        seed: 23,
        born: 0,
        stay: 10_000_000,
        hasNut: true,
        panic: 0,
      });
      return;
    }
    if (kind === 'turtle') {
      const spot = h.turtleSpots[Math.floor(rnd() * h.turtleSpots.length)] ?? h.glades[0];
      if (!spot) return;
      this.turtles.push({
        tx: spot.x,
        ty: spot.y,
        from: null,
        target: null,
        state: 'bask',
        timer: 20_000,
        facing: 1,
        phase: 1,
        seed: 25,
        born: 0,
        stay: 10_000_000,
        hide: 0,
      });
      return;
    }
    if (kind === 'bee') {
      const spot = h.beeSpots[Math.floor(rnd() * h.beeSpots.length)] ?? h.glades[0];
      if (!spot) return;
      for (let i = 0; i < 5; i++) {
        this.bees.push({
          tx: spot.x + (rnd() - 0.5),
          ty: spot.y + (rnd() - 0.5),
          ax: spot.x,
          ay: spot.y,
          alt: 6 + rnd() * 4,
          dir: rnd() * Math.PI * 2,
          vx: 0,
          vy: 0,
          seed: 31 + i,
          timer: 5000,
          phase: rnd() * 10,
          state: 'fly',
          target: spot,
          carrying: rnd() < 0.5,
          alpha: 1,
        });
      }
      return;
    }
    const g = h.glades[Math.floor(rnd() * h.glades.length)];
    if (!g) return;
    this.deer.push({
      tx: g.x,
      ty: g.y,
      from: null,
      target: null,
      state: 'graze',
      timer: 20_000,
      facing: 1,
      phase: 1,
      seed: 7,
      coat: {
        spots: t.season === 'spring' || t.season === 'summer',
        antlers: t.season === 'autumn' || t.season === 'summer',
        winter: t.season === 'winter',
      },
      born: 0,
      stay: 10_000_000,
    });
  }
}
