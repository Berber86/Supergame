/**
 * Жители воды: лягушки у берега и стрекозы над прудом.
 *
 * Поведение намеренно простое и наблюдаемое: пришёл — наблюдает —
 * переместился — ушёл. Никаких потребностей, голода и наказаний: жители
 * просто выбирают места по сезону и погоде и реагируют друг на друга так,
 * чтобы это можно было заметить, сидя в созерцании.
 *
 * Лягушка: выходит из воды на тенистый берег, сидит, поёт (горло дрожит),
 * прыгает, а при виде кота или птицы ныряет с всплеском. В дождь и под
 * вечер лягушек больше, и они хором отвечают друг другу.
 *
 * Стрекоза: держится своего пруда, патрулирует и зависает, садится на
 * камыш и кувшинки; в ливень прячется, в сильный ветер не летает. Две
 * одинаковые на одном пруду не уживаются: круг-другой погони — и чужак
 * уступает воду.
 */

import { GRID } from '../core/iso';
import { clamp, lerp, makeRng } from '../core/rng';
import { WeatherState } from './weatherState';
import { Habitat, Invitation, Vec } from './habitat';
import { World } from './world';

const rnd = makeRng(4021);

export type FrogState = 'emerge' | 'sit' | 'call' | 'hop' | 'dive';

export interface Frog {
  id: number;
  tx: number;
  ty: number;
  facing: number;
  seed: number;
  state: FrogState;
  timer: number;
  /** 0..1 прогресс внутри состояния (выход, прыжок, нырок). */
  phase: number;
  /** Откуда и куда прыгает. */
  from: Vec | null;
  target: Vec | null;
  /** Родной водоём; -2 — поилка. */
  pond: number;
  /** Зелёная или бурая: бурую на мху не сразу разглядишь. */
  species: 'green' | 'brown';
  size: number;
  /** Горло при пении 0..1. */
  throat: number;
  /** Спряталась под водой: не рисуется, но помнит, где всплыть. */
  hidden: number;
  /** После нырка уйдёт из сада совсем (популяция лишняя). */
  gone: boolean;
  /** Отложенный ответ соседке: перекличка. */
  answer: number;
}

export type FlyState = 'arrive' | 'patrol' | 'hover' | 'perch' | 'chase' | 'leave';

export interface PondDragonfly {
  id: number;
  kind: 'hawker' | 'damselfly';
  tx: number;
  ty: number;
  alt: number;
  vx: number;
  vy: number;
  facing: number;
  seed: number;
  state: FlyState;
  timer: number;
  phase: number;
  pond: number;
  target: Vec | null;
  perch: Vec | null;
}

/** Круг на воде: всплеск лягушки. */
export interface Ripple {
  x: number;
  y: number;
  age: number;
  seed: number;
  big: boolean;
}

/** От кого прятаться: коты и птицы, подошедшие близко. */
export interface Threat {
  x: number;
  y: number;
  r: number;
}

const MAX_RIPPLES = 24;

import { ChronicleToastNote } from './world';

export class Residents {
  frogs: Frog[] = [];
  dragonflies: PondDragonfly[] = [];
  ripples: Ripple[] = [];
  /** Заметки для летописи: игровой цикл забирает их каждый кадр. */
  private notes: ChronicleToastNote[] = [];
  private nextId = 1;
  private chorusCooldown = 0;
  private pairCooldown = 0;

  reset(): void {
    this.frogs = [];
    this.dragonflies = [];
    this.ripples = [];
    this.notes = [];
    this.chorusCooldown = 0;
    this.pairCooldown = 0;
  }

  takeNotes(): ChronicleToastNote[] {
    const out = this.notes;
    this.notes = [];
    return out;
  }

  private note(id: string, x?: number, y?: number): void {
    if (this.notes.length >= 8) return;
    // За туманом растущего сада летопись молчит — см. world.noteEvent
    // Дублируем проверку здесь, чтобы не копить очередь из невидимого.
    this.notes.push({ id, x: x ?? GRID / 2, y: y ?? GRID / 2 });
  }

  update(
    world: World,
    h: Habitat,
    inv: Invitation,
    wx: WeatherState | null,
    dt: number,
    now: number,
    threats: Threat[],
  ): void {
    if (this.chorusCooldown > 0) this.chorusCooldown -= dt;
    if (this.pairCooldown > 0) this.pairCooldown -= dt;
    this.updateFrogs(world, h, inv, dt, threats);
    this.updateDragonflies(h, inv, wx, dt, now);
    for (let i = this.ripples.length - 1; i >= 0; i--) {
      this.ripples[i].age += dt;
      if (this.ripples[i].age > 1600) this.ripples.splice(i, 1);
    }
  }

  private splash(x: number, y: number, big: boolean): void {
    if (this.ripples.length < MAX_RIPPLES) this.ripples.push({ x, y, age: 0, seed: rnd() * 1000, big });
  }

  /** Круг на воде снаружи: птица выкупалась в поилке. */
  ripple(x: number, y: number, big: boolean): void {
    this.splash(x, y, big);
  }

  // ---------------- Лягушки ----------------

  private updateFrogs(world: World, h: Habitat, inv: Invitation, dt: number, threats: Threat[]): void {
    const want = inv.frogs;
    const alive = this.frogs.filter((f) => !f.gone);

    // Лишние уходят под воду по-тихому
    if (alive.length > want) {
      const extra = alive.find((f) => f.state !== 'dive' && f.hidden <= 0) ?? alive.find((f) => f.state !== 'dive');
      if (extra) {
        extra.state = 'dive';
        extra.gone = true;
        extra.timer = 900;
        extra.phase = 0;
        extra.throat = 0;
      }
    } else if (alive.length < want) {
      this.spawnFrog(world, h);
    }

    // Перекличка: двое поющих разом — это хор, о нём стоит помнить
    const calling = this.frogs.filter((f) => f.state === 'call' && f.hidden <= 0);
    if (calling.length >= 2 && this.chorusCooldown <= 0 && inv.chorus > 0) {
      this.chorusCooldown = 45_000;
      const ax = calling.reduce((s, f) => s + f.tx, 0) / calling.length;
      const ay = calling.reduce((s, f) => s + f.ty, 0) / calling.length;
      this.note('chorus', ax, ay);
    }

    // Отложенные ответы соседок
    for (const f of this.frogs) {
      if (f.answer <= 0) continue;
      f.answer -= dt;
      if (f.answer <= 0 && f.state === 'sit' && f.hidden <= 0) {
        f.state = 'call';
        f.phase = 0;
        f.timer = 900 + rnd() * 700;
        f.answer = 0;
      }
    }

    for (let i = this.frogs.length - 1; i >= 0; i--) {
      const f = this.frogs[i];
      f.timer -= dt;

      if (f.hidden > 0) {
        f.hidden -= dt;
        // Лишнюю лягушку, застигнутую под водой, убираем без всплытия
        if (f.gone) {
          this.frogs.splice(i, 1);
          continue;
        }
        if (f.hidden <= 0) {
          const spot = this.frogSpotNear(h, f.pond);
          if (spot) {
            f.from = this.waterEdgeNear(world, spot) ?? spot;
            f.tx = f.from.x;
            f.ty = f.from.y;
            f.target = spot;
            f.state = 'emerge';
            f.phase = 0;
            f.timer = 800;
          } else {
            f.gone = true;
          }
        }
        continue;
      }

      switch (f.state) {
        case 'emerge': {
          f.phase = Math.min(1, f.phase + dt / 800);
          if (f.target && f.from) {
            f.tx = lerp(f.from.x, f.target.x, f.phase);
            f.ty = lerp(f.from.y, f.target.y, f.phase);
          }
          if (f.phase >= 1) {
            f.state = 'sit';
            f.timer = 4000 + rnd() * 9000;
            this.note('meet_frog', f.tx, f.ty);
          }
          break;
        }
        case 'sit': {
          f.throat = lerp(f.throat, 0, 0.08);
          if (f.timer <= 0) {
            if (inv.chorus > 0 && rnd() < 0.5) {
              f.state = 'call';
              f.timer = 1100 + rnd() * 900;
              f.phase = 0;
              this.scheduleAnswer(f);
            } else if (rnd() < 0.32) {
              // Лёгкие прыжки: реже и медленнее, с паузой до и после
              const spot = this.frogSpotNear(h, f.pond, 2.4);
              if (spot) {
                f.from = { x: f.tx, y: f.ty };
                f.target = spot;
                f.state = 'hop';
                f.phase = 0;
                f.timer = 1100;
                f.facing = spot.x > f.tx ? 1 : -1;
              } else f.timer = 4000 + rnd() * 6000;
            } else {
              f.timer = 5000 + rnd() * 9000;
            }
          }
          if (this.threatNear(f, threats)) this.dive(f, false);
          break;
        }
        case 'call': {
          f.phase += dt / 1100;
          f.throat = Math.max(0, Math.sin(f.phase * Math.PI * 2.2));
          if (f.timer <= 0) {
            f.state = 'sit';
            f.throat = 0;
            f.timer = 2500 + rnd() * 6000;
          }
          if (this.threatNear(f, threats)) this.dive(f, false);
          break;
        }
        case 'hop': {
          // Лёгкий прыжок: медленнее (1100мс) и с дугой — в середине чуть выше
          f.phase = Math.min(1, f.phase + dt / 1100);
          if (f.target && f.from) {
            const t = f.phase;
            // easeInOut для мягкости
            const ease = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
            f.tx = lerp(f.from.x, f.target.x, ease);
            f.ty = lerp(f.from.y, f.target.y, ease);
            // Небольшая дуга вверх в середине прыжка визуально читается как прыжок,
            // но не влияет на логику — только лёгкость движения
          }
          if (f.phase >= 1) {
            f.target = null;
            f.state = 'sit';
            f.timer = 4000 + rnd() * 8000;
          }
          break;
        }
        case 'dive': {
          const prev = f.phase;
          f.phase = Math.min(1, f.phase + dt / 900);
          if (prev < 0.25 && f.phase >= 0.25) this.splash(f.tx, f.ty, true);
          if (f.phase >= 1) {
            if (f.gone) this.frogs.splice(i, 1);
            else {
              f.hidden = 5000 + rnd() * 9000;
              f.state = 'sit';
              f.phase = 0;
            }
          }
          break;
        }
      }
      f.tx = clamp(f.tx, 0.5, GRID - 0.5);
      f.ty = clamp(f.ty, 0.5, GRID - 0.5);
    }
  }

  /** Поющая лягушка будит соседнюю: ответ приходит не сразу, а через паузу. */
  private scheduleAnswer(singer: Frog): void {
    for (const o of this.frogs) {
      if (o === singer || o.hidden > 0 || o.state !== 'sit' || o.answer > 0) continue;
      if (Math.hypot(o.tx - singer.tx, o.ty - singer.ty) > 6) continue;
      o.answer = 600 + rnd() * 1500;
    }
  }

  private dive(f: Frog, gone: boolean): void {
    f.state = 'dive';
    f.gone = gone;
    f.phase = 0;
    f.timer = 900;
    f.throat = 0;
    f.answer = 0;
  }

  private threatNear(f: Frog, threats: Threat[]): boolean {
    for (const th of threats) {
      if (Math.hypot(th.x - f.tx, th.y - f.ty) < th.r) return true;
    }
    return false;
  }

  private spawnFrog(world: World, h: Habitat): void {
    const ponds = h.ponds.filter((p) => p.area >= 3);
    let pond = -1;
    let spot: Vec | null = null;
    if (ponds.length) {
      // пруд, где лягушек ещё мало относительно его размера
      let best = 0;
      let bestScore = Infinity;
      for (let i = 0; i < ponds.length; i++) {
        const count = this.frogs.filter((f) => f.pond === ponds[i].id && !f.gone).length;
        const score = count / Math.max(1, ponds[i].area) + rnd() * 0.2;
        if (score < bestScore) {
          bestScore = score;
          best = i;
        }
      }
      pond = ponds[best].id;
      spot = this.frogSpotNear(h, pond);
    } else if (h.baths.length) {
      const b = h.baths[Math.floor(rnd() * h.baths.length)];
      spot = { x: b.x + 0.55, y: b.y + 0.45 };
      pond = -2;
    }
    if (!spot) return;
    const water = this.waterEdgeNear(world, spot);
    const start = water ?? spot;
    this.frogs.push({
      id: this.nextId++,
      tx: start.x,
      ty: start.y,
      facing: rnd() > 0.5 ? 1 : -1,
      seed: rnd() * 1000,
      state: 'emerge',
      timer: 800,
      phase: 0,
      from: start,
      target: spot,
      pond,
      species: rnd() < 0.62 ? 'green' : 'brown',
      size: 0.85 + rnd() * 0.4,
      throat: 0,
      hidden: 0,
      gone: false,
      answer: 0,
    });
    if (water) this.splash(water.x, water.y, false);
  }

  private frogSpotNear(h: Habitat, pond: number, radius = 7): Vec | null {
    if (pond === -2) {
      const baths = h.frogSpots.slice(-Math.max(1, h.baths.length));
      return baths.length ? baths[Math.floor(rnd() * baths.length)] : null;
    }
    const c = this.pondCenter(h, pond);
    const spots = h.frogSpots.filter((s) => Math.hypot(s.x - c.x, s.y - c.y) < radius + 3);
    if (!spots.length) return null;
    return spots[Math.floor(rnd() * spots.length)];
  }

  private pondCenter(h: Habitat, id: number): Vec {
    const p = h.ponds.find((q) => q.id === id);
    return p ? { x: p.cx, y: p.cy } : { x: GRID / 2, y: GRID / 2 };
  }

  /** Точка в воде рядом с берегом: откуда выходить. */
  private waterEdgeNear(world: World, spot: Vec): Vec | null {
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const x = spot.x + Math.cos(a) * 0.7;
      const y = spot.y + Math.sin(a) * 0.7;
      if (world.at(Math.floor(x), Math.floor(y))?.water) return { x, y };
    }
    return null;
  }

  // ---------------- Стрекозы ----------------

  private updateDragonflies(h: Habitat, inv: Invitation, wx: WeatherState | null, dt: number, now: number): void {
    const want = inv.dragonflies;
    const rain = wx ? Math.max(wx.rain, wx.snow) : 0;

    if (this.dragonflies.length > want) {
      const extra = this.dragonflies.find((d) => d.state !== 'leave');
      if (extra) {
        extra.state = 'leave';
        extra.timer = 2600;
      }
    } else if (this.dragonflies.length < want && h.ponds.length) {
      this.spawnDragonfly(h);
    }

    for (let i = this.dragonflies.length - 1; i >= 0; i--) {
      const d = this.dragonflies[i];
      d.timer -= dt;
      d.phase += dt * 0.004;

      switch (d.state) {
        case 'arrive': {
          if (d.target) this.steer(d, d.target, 0.0026, dt, now);
          d.alt = lerp(d.alt, 26, 0.05);
          if (d.timer <= 0 || (d.target && Math.hypot(d.target.x - d.tx, d.target.y - d.ty) < 0.5)) {
            d.state = 'patrol';
            d.timer = 2200 + rnd() * 3200;
            this.note('meet_dragonfly', d.tx, d.ty);
          }
          break;
        }
        case 'patrol': {
          if (d.timer <= 0 || !d.target) {
            d.target = this.pondPoint(h, d.pond);
            d.timer = 1800 + rnd() * 2600;
            if (rnd() < 0.25) {
              d.state = 'hover';
              d.timer = 700 + rnd() * 1100;
              break;
            }
            if (rnd() < 0.3) {
              const perch = this.perchNear(h, d.pond);
              if (perch) {
                d.perch = perch;
                d.target = perch;
                d.state = 'perch';
                d.timer = 2600 + rnd() * 5200;
                break;
              }
            }
          }
          if (d.target) this.steer(d, d.target, 0.0024, dt, now);
          d.alt = lerp(d.alt, 20 + Math.sin(now * 0.002 + d.seed) * 6, 0.05);
          break;
        }
        case 'hover': {
          d.vx = lerp(d.vx, 0, 0.1);
          d.vy = lerp(d.vy, 0, 0.1);
          d.alt = lerp(d.alt, 24 + Math.sin(now * 0.004 + d.seed) * 2, 0.08);
          if (d.timer <= 0) {
            d.state = 'patrol';
            d.timer = 1600 + rnd() * 2600;
          }
          break;
        }
        case 'perch': {
          if (d.perch) {
            d.tx = lerp(d.tx, d.perch.x, 0.08);
            d.ty = lerp(d.ty, d.perch.y, 0.08);
            d.alt = lerp(d.alt, 9, 0.1);
          }
          if (d.timer <= 0 && rain < 0.2) {
            d.state = 'patrol';
            d.perch = null;
            d.timer = 1600 + rnd() * 2200;
          }
          break;
        }
        case 'chase': {
          if (d.target) this.steer(d, d.target, 0.0042, dt, now);
          if (d.timer <= 0) {
            d.state = 'patrol';
            d.timer = 1800 + rnd() * 2400;
          }
          break;
        }
        case 'leave': {
          d.alt = lerp(d.alt, 90, 0.03);
          d.vx = lerp(d.vx, d.facing * 0.003, 0.05);
          d.vy = lerp(d.vy, -0.0012, 0.05);
          d.tx += d.vx * dt;
          d.ty += d.vy * dt;
          if (d.timer <= 0 || d.alt > 80) this.dragonflies.splice(i, 1);
          break;
        }
      }

      // Территория: двое одинаковых на одном пруду не уживаются
      if (d.state === 'patrol' || d.state === 'hover') {
        for (const o of this.dragonflies) {
          if (o === d || o.kind !== d.kind || o.state === 'leave') continue;
          const dist = Math.hypot(o.tx - d.tx, o.ty - d.ty);
          if (dist > 2.2 || dist < 0.001) continue;
          const c = this.pondCenter(h, d.pond);
          const mine = Math.hypot(d.tx - c.x, d.ty - c.y) <= Math.hypot(o.tx - c.x, o.ty - c.y);
          if (mine) {
            d.state = 'chase';
            d.target = { x: o.tx, y: o.ty };
            d.timer = 1400;
            o.state = 'leave';
            o.timer = 2400;
            if (this.pairCooldown <= 0) {
              this.pairCooldown = 60_000;
              this.note('dragonfly_pair', d.tx, d.ty);
            }
          }
          break;
        }
      }

      // Ливень гонит всех по насестам
      if (rain > 0.25 && (d.state === 'patrol' || d.state === 'hover' || d.state === 'arrive')) {
        const perch = this.perchNear(h, d.pond);
        if (perch) {
          d.perch = perch;
          d.target = perch;
          d.state = 'perch';
          d.timer = 3000 + rnd() * 4000;
        }
      }

      d.tx = clamp(d.tx, 0.5, GRID - 0.5);
      d.ty = clamp(d.ty, 0.5, GRID - 0.5);
    }
  }

  private steer(d: PondDragonfly, target: Vec, power: number, dt: number, now: number): void {
    const dx = target.x - d.tx;
    const dy = target.y - d.ty;
    const dist = Math.hypot(dx, dy) || 1;
    // броски и зависания: скорость дышит, а не держится ровной
    const dart = Math.sin(now * 0.0013 + d.seed) > 0.35 ? 1 : 0.15;
    d.vx = lerp(d.vx, (dx / dist) * power * dart, 0.12);
    d.vy = lerp(d.vy, (dy / dist) * power * dart, 0.12);
    d.tx += d.vx * dt;
    d.ty += d.vy * dt;
    if (Math.abs(dx) > 0.02) d.facing = dx > 0 ? 1 : -1;
  }

  private spawnDragonfly(h: Habitat): void {
    const ponds = h.ponds.filter((p) => p.area >= 4);
    const pool = ponds.length ? ponds : h.ponds;
    if (!pool.length) return;
    const p = pool[Math.floor(rnd() * pool.length)];
    const kind: PondDragonfly['kind'] = rnd() < 0.55 ? 'hawker' : 'damselfly';
    this.dragonflies.push({
      id: this.nextId++,
      kind,
      tx: p.cx + (rnd() - 0.5) * 3,
      ty: p.cy + (rnd() - 0.5) * 3,
      alt: 40,
      vx: 0,
      vy: 0,
      facing: rnd() > 0.5 ? 1 : -1,
      seed: rnd() * 1000,
      state: 'arrive',
      timer: 1600,
      phase: rnd() * 10,
      pond: p.id,
      target: this.pondPoint(h, p.id),
      perch: null,
    });
  }

  private pondPoint(h: Habitat, id: number): Vec {
    const p = h.ponds.find((q) => q.id === id);
    if (!p) return { x: GRID / 2, y: GRID / 2 };
    const r = Math.sqrt(Math.max(1, p.area)) * 0.42;
    const a = rnd() * Math.PI * 2;
    return { x: clamp(p.cx + Math.cos(a) * r, 1, GRID - 1), y: clamp(p.cy + Math.sin(a) * r, 1, GRID - 1) };
  }

  private perchNear(h: Habitat, pond: number): Vec | null {
    const c = this.pondCenter(h, pond);
    const near = h.perches.filter((p) => Math.hypot(p.x - c.x, p.y - c.y) < 6);
    if (!near.length) return null;
    return near[Math.floor(rnd() * near.length)];
  }
}
