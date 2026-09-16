/** Частицы: лепестки сакуры, снег, светлячки, листья, дымка. */

import { clamp01, hash2, makeRng } from '../core/rng';
import { Atmosphere, RGB, css, mix } from '../world/palette';
import { Ctx, glow } from './paint';

interface Particle {
  x: number;
  y: number;
  z: number; // глубина 0..1 — влияет на размер и скорость
  vx: number;
  vy: number;
  rot: number;
  vr: number;
  life: number;
  seed: number;
}

export class Weather {
  private petals: Particle[] = [];
  private snow: Particle[] = [];
  private flies: Particle[] = [];
  private leaves: Particle[] = [];
  rnd = makeRng(4242);
  private w = 0;
  private h = 0;

  resize(w: number, h: number): void {
    this.w = w;
    this.h = h;
  }

  private spawn(kind: 'petal' | 'snow' | 'fly' | 'leaf'): Particle {
    const r = this.rnd;
    const z = 0.35 + r() * 0.65;
    if (kind === 'fly') {
      return {
        x: r() * this.w,
        y: this.h * (0.25 + r() * 0.7),
        z,
        vx: (r() - 0.5) * 0.14,
        vy: (r() - 0.5) * 0.1,
        rot: r() * Math.PI * 2,
        vr: (r() - 0.5) * 0.02,
        life: 4 + r() * 14,
        seed: r() * 1000,
      };
    }
    return {
      x: r() * (this.w + 200) - 100,
      y: -30 - r() * this.h * 0.4,
      z,
      vx: kind === 'snow' ? (r() - 0.5) * 0.24 : 0.16 + r() * 0.3,
      vy: kind === 'snow' ? 0.13 + r() * 0.16 : kind === 'leaf' ? 0.2 + r() * 0.2 : 0.16 + r() * 0.22,
      rot: r() * Math.PI * 2,
      vr: (r() - 0.5) * 0.04,
      life: 1,
      seed: r() * 1000,
    };
  }

  /** Лепесток/лист, сорванный с конкретного дерева, — уже в экранных координатах. */
  emitAt(sx: number, sy: number, kind: 'petal' | 'leaf', seed: number): void {
    const r = this.rnd;
    const p: Particle = {
      x: sx,
      y: sy,
      z: 0.55 + r() * 0.45,
      vx: 0.1 + r() * 0.3,
      vy: 0.12 + r() * 0.16,
      rot: r() * Math.PI * 2,
      vr: (r() - 0.5) * 0.05,
      life: 1,
      seed,
    };
    if (kind === 'petal') this.petals.push(p);
    else this.leaves.push(p);
  }

  update(dt: number, atm: Atmosphere): void {
    const season = atm.season;
    const targetPetals = season === 'spring' ? 22 : season === 'summer' ? 4 : 0;
    const targetSnow = season === 'winter' ? 90 : 0;
    const targetLeaves = season === 'autumn' ? 16 : 0;
    const targetFlies = Math.round(34 * atm.fireflies);

    this.fill(this.petals, targetPetals, 'petal');
    this.fill(this.snow, targetSnow, 'snow');
    this.fill(this.leaves, targetLeaves, 'leaf');
    this.fill(this.flies, targetFlies, 'fly');

    const step = (arr: Particle[], kind: 'petal' | 'snow' | 'fly' | 'leaf') => {
      for (let i = arr.length - 1; i >= 0; i--) {
        const p = arr[i];
        if (kind === 'fly') {
          p.vx += (Math.sin(p.seed + performance.now() * 0.0004) * 0.04 - p.vx) * 0.02;
          p.vy += (Math.cos(p.seed * 1.3 + performance.now() * 0.0003) * 0.03 - p.vy) * 0.02;
          p.x += p.vx * dt * 0.6;
          p.y += p.vy * dt * 0.6;
          p.life -= dt * 0.001;
          if (p.life <= 0 || p.x < -50 || p.x > this.w + 50 || p.y < 0 || p.y > this.h) arr.splice(i, 1);
          continue;
        }
        const drift = Math.sin(performance.now() * 0.0008 + p.seed) * (kind === 'snow' ? 0.22 : 0.34);
        p.x += (p.vx + drift) * dt * 0.09 * p.z;
        p.y += p.vy * dt * 0.09 * p.z;
        p.rot += p.vr * dt * 0.06;
        if (p.y > this.h + 40 || p.x > this.w + 120) arr.splice(i, 1);
      }
    };

    step(this.petals, 'petal');
    step(this.snow, 'snow');
    step(this.leaves, 'leaf');
    step(this.flies, 'fly');
  }

  private fill(arr: Particle[], target: number, kind: 'petal' | 'snow' | 'fly' | 'leaf'): void {
    while (arr.length < target) arr.push(this.spawn(kind));
    while (arr.length > target + 40) arr.shift();
  }

  draw(ctx: Ctx, atm: Atmosphere): void {
    // Лепестки
    const petalCol = mix({ r: 250, g: 214, b: 226 }, atm.lightTint, atm.lightAmount * 0.6);
    for (const p of this.petals) this.drawPetal(ctx, p, petalCol, 0.75);

    // Осенние листья
    for (const p of this.leaves) {
      const warm = hash2(p.seed | 0, 1, 3);
      const c = mix(
        warm > 0.6 ? { r: 214, g: 110, b: 68 } : warm > 0.3 ? { r: 226, g: 168, b: 76 } : { r: 186, g: 96, b: 62 },
        atm.lightTint,
        atm.lightAmount * 0.5,
      );
      this.drawPetal(ctx, p, c, 0.8, 1.35);
    }

    // Снег
    const snowCol = mix({ r: 252, g: 252, b: 255 }, atm.lightTint, atm.lightAmount * 0.7);
    for (const p of this.snow) {
      const r = 1.1 + p.z * 2.3;
      ctx.fillStyle = css(snowCol, 0.32 + p.z * 0.5);
      ctx.beginPath();
      ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
      ctx.fill();
    }

    // Светлячки
    if (this.flies.length) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (const p of this.flies) {
        const pulse = clamp01(0.35 + Math.sin(performance.now() * 0.003 + p.seed) * 0.65);
        const fade = clamp01(Math.min(p.life, 1));
        const col: RGB = { r: 210, g: 255, b: 170 };
        glow(ctx, p.x, p.y, 16 + p.z * 12, col, pulse * fade * 0.55 * atm.fireflies);
        ctx.fillStyle = css({ r: 240, g: 255, b: 210 }, pulse * fade * 0.85);
        ctx.beginPath();
        ctx.arc(p.x, p.y, 1.3 + p.z, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
  }

  private drawPetal(ctx: Ctx, p: Particle, col: RGB, alpha: number, sizeK = 1): void {
    const s = (2.2 + p.z * 3.4) * sizeK;
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rot);
    ctx.scale(1, 0.55 + Math.abs(Math.sin(p.rot * 1.4)) * 0.6);
    ctx.fillStyle = css(col, alpha * (0.4 + p.z * 0.6));
    ctx.beginPath();
    ctx.ellipse(0, 0, s, s * 0.62, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

/** Утренняя дымка над водой и низинами. */
export function drawMist(ctx: Ctx, w: number, h: number, atm: Atmosphere, time: number): void {
  const t = atm.time;
  // дымка на рассвете и в холодные сезоны
  let strength = 0;
  if (t.dayT > 0.18 && t.dayT < 0.32) strength = 0.55;
  if (atm.season === 'winter') strength = Math.max(strength, 0.25);
  if (atm.season === 'autumn') strength = Math.max(strength, 0.3);
  if (t.isNight) strength = Math.max(strength, 0.2);
  if (strength < 0.02) return;

  const col = mix({ r: 244, g: 244, b: 240 }, atm.lightTint, 0.35);
  ctx.save();
  for (let i = 0; i < 4; i++) {
    const y = h * (0.42 + i * 0.13) + Math.sin(time * 0.0002 + i) * 14;
    const g = ctx.createLinearGradient(0, y - 90, 0, y + 90);
    g.addColorStop(0, css(col, 0));
    g.addColorStop(0.5, css(col, 0.1 * strength));
    g.addColorStop(1, css(col, 0));
    ctx.fillStyle = g;
    ctx.fillRect(0, y - 90, w, 180);
  }
  ctx.restore();
}

/** Лучи света сквозь листву (god rays) в золотой час. */
export function drawSunShafts(ctx: Ctx, w: number, h: number, atm: Atmosphere, time: number): void {
  const strength = atm.golden * 0.2 + atm.time.daylight * 0.05;
  if (strength < 0.03) return;
  const warm = mix({ r: 255, g: 226, b: 168 }, atm.lightTint, 0.3);
  const dirX = atm.sunDir.x;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 5; i++) {
    const seed = hash2(i, 11, 3);
    const x = w * (0.1 + seed * 0.8) + Math.sin(time * 0.00012 + i) * 40;
    const wdt = 120 + seed * 220;
    const g = ctx.createLinearGradient(x, 0, x - dirX * 260, h);
    g.addColorStop(0, css(warm, 0.13 * strength));
    g.addColorStop(0.55, css(warm, 0.05 * strength));
    g.addColorStop(1, css(warm, 0));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(x - wdt / 2, -20);
    ctx.lineTo(x + wdt / 2, -20);
    ctx.lineTo(x + wdt * 0.9 - dirX * 300, h + 20);
    ctx.lineTo(x - wdt * 0.9 - dirX * 300, h + 20);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}
