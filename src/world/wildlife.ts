/**
 * Дикие соседи: светлячки, цапля и олень.
 *
 * Третий слой жизни после котов и птиц: никто из них не живёт в саду
 * постоянно. Светлячки приходят тёплой тихой ночью и гаснут к рассвету,
 * цапля выбирает большой пруд и стоит подолгу, олень выходит к роще
 * на рассвете и сумерках. Игрок не зовёт их и не кормит: они приходят
 * сами, когда сад готов, и уходят по своим причинам.
 *
 * Поведение прежнее по духу: пришёл — наблюдает — переместился — ушёл.
 * Никаких нужд и наказаний; только сезон, час, погода и соседи.
 * Социальные реакции видно глазами: цапля бьёт по воде — карпы
 * разлетаются; кот подошёл — олень поднимает голову и уходит.
 */

import { GRID } from '../core/iso';
import { clamp, lerp, makeRng } from '../core/rng';
import { TimeState } from '../core/clock';
import { Habitat, Invitation, Vec } from './habitat';
import { Threat } from './residents';
import { WeatherState } from './weatherState';

const rnd = makeRng(9173);

// ---------------- Светлячки ----------------

export interface Firefly {
  tx: number;
  ty: number;
  /** Точка, вокруг которой светлячок кружит. */
  ax: number;
  ay: number;
  dir: number;
  seed: number;
  /** Период мигания, мс. */
  period: number;
  phase: number;
  state: 'fly' | 'rest';
  timer: number;
  /** Проявление и растворение 0..1. */
  alpha: number;
}

/** Яркость вспышки в момент now: короткая тёплая волна и длинная пауза. */
export function fireflyGlow(f: Firefly, now: number): number {
  const x = (((now / f.period + f.phase) % 1) + 1) % 1;
  if (x > 0.42) return 0;
  const s = Math.sin((Math.PI * x) / 0.42);
  return s * s;
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
  /** Доля пройденного перехода 0..1. */
  phase: number;
  /** Рыба в клюве: секунды до «проглотила». */
  fish: number;
  struck: boolean;
  born: number;
  stay: number;
}

// ---------------- Олень ----------------

export type DeerState = 'enter' | 'walk' | 'graze' | 'look' | 'leave';

export interface DeerCoat {
  /** Летние белые пятна по рыжей шкуре. */
  spots: boolean;
  /** Рога: растут к осени, зимой и весной их нет. */
  antlers: boolean;
  /** Зимняя шерсть: гуще и светлее. */
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

/**
 * Все трое живут одним классом: приходят по приглашению среды обитания,
 * заметки отдают наружу тем же путём, что лягушки и стрекозы.
 */
export class Wildlife {
  fireflies: Firefly[] = [];
  heron: Heron | null = null;
  deer: Deer[] = [];

  /** Удар цапли по воде: жизнь сада раскидывает карпов и круги. */
  onStrike: ((x: number, y: number, caught: boolean) => void) | null = null;

  private notes: string[] = [];
  private ffTimer = 0;
  private heronTimer = 120_000;
  private deerTimer = 90_000;
  private danceTimer = 0;
  private danced = false;

  takeNotes(): string[] {
    const out = this.notes;
    this.notes = [];
    return out;
  }

  reset(): void {
    this.fireflies = [];
    this.heron = null;
    this.deer = [];
    this.notes = [];
    this.ffTimer = 0;
    this.heronTimer = 120_000;
    this.deerTimer = 90_000;
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
    this.updateHeron(h, inv, t, dt, now, threats);
    this.updateDeer(h, inv, t, dt, now, threats);
  }

  // ---------------- Светлячки ----------------

  private updateFireflies(h: Habitat, inv: Invitation, t: TimeState, wx: WeatherState | null, dt: number): void {
    const want = inv.fireflies;

    // Рассвет: огни гаснут не разом, а тают
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
      // Дрейф: блуждание вокруг своей точки, с мягким возвратом
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
      // Дублет первой встречи погасит мир: летопись помнит один раз
      this.notes.push('meet_firefly');
    }

    // Редкое: после дождя тёплой ночью мигают разом, как один фонарь
    const wet = wx ? wx.wetness : 0;
    if (!this.danced && this.fireflies.length >= 8 && wet > 0.35 && t.daylight < 0.18) {
      this.danceTimer += dt;
      if (this.danceTimer > 9000 + 6000 * rnd()) {
        this.danced = true;
        this.danceTimer = 0;
        this.notes.push('firefly_dance');
      }
    } else if (this.fireflies.length < 8 || t.daylight > 0.3) {
      this.danceTimer = 0;
    }
  }

  /** Светлячок живёт между водой, травой и тенью деревьев. */
  private fireflyAnchor(h: Habitat): Vec | null {
    const pool: Vec[] = [];
    for (const p of h.ponds) for (const s of p.shores) pool.push(s);
    for (const g of h.glades) pool.push(g);
    for (const tr of h.trees) pool.push({ x: tr.x + 1, y: tr.y + 1 });
    if (!pool.length) return null;
    return pool[Math.floor(rnd() * pool.length)];
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
      };
      return;
    }

    const hr = this.heron;
    hr.timer -= dt;
    if (hr.fish > 0) {
      hr.fish -= dt / 1000;
      if (hr.fish < 0) hr.fish = 0;
    }

    // Кошка рядом — большая птица не спорит, а просто уходит
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
        // Цапля — грациозная, не спешит: было 0.00022 → стало 0.00014
        hr.phase = Math.min(1, hr.phase + dt * 0.00014);
        hr.tx = lerp(hr.from.x, hr.target.x, hr.phase);
        hr.ty = lerp(hr.from.y, hr.target.y, hr.phase);
        if (hr.phase >= 1) {
          hr.state = 'stand';
          hr.timer = 16_000 + rnd() * 26_000;
          this.notes.push('meet_heron');
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
        // Медленный крадущийся шаг вдоль берега: 0.00028 → 0.00016
        hr.phase = Math.min(1, hr.phase + dt * 0.00016);
        hr.tx = lerp(hr.from.x, hr.target.x, hr.phase);
        hr.ty = lerp(hr.from.y, hr.target.y, hr.phase);
        if (Math.abs(hr.target.x - hr.tx) > 0.05) hr.facing = hr.target.x > hr.tx ? 1 : -1;
        if (hr.phase >= 1) {
          // Дошла до точки: либо удар, снова шаг, либо просто стоять
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
            this.notes.push('heron_strike');
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

  /** Медленный шаг цапли вдоль берега: цель — соседняя мелкая точка. */
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

      // Кот совсем рядом — олень поднимает голову и уходит рысцой
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
          // Олень не должен мчаться: было 0.00042/0.00036 → стало 0.00022/0.00018
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
          // Уход тоже спокойный, не рывок: было 0.00062 → 0.00024
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
    this.notes.push('meet_deer');
    if (this.deer.length >= 2) this.notes.push('deer_pair');
  }

  /** Ближайший край сада: откуда прийти и куда уйти. */
  private exitFrom(x: number, y: number): Vec {
    const cx = GRID / 2;
    const cy = GRID / 2;
    const dx = x - cx;
    const dy = y - cy;
    if (Math.abs(dx) > Math.abs(dy)) return { x: dx > 0 ? GRID + 3 : -3, y: clamp(y, 2, GRID - 2) };
    return { x: clamp(x, 2, GRID - 2), y: dy > 0 ? GRID + 3 : -3 };
  }

  // ---------------- Отладочный крючок для оффлайн-кадров ----------------

  /** Позвать жителей сразу: для превью и листов, без ожидания вероятностей. */
  force(kind: 'fireflies' | 'heron' | 'deer', h: Habitat, t: TimeState): void {
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
      // Прилетает по-настоящему: первая встреча записывается сама
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
      };
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
