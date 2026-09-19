import { ecologyYear } from '../world/ecology';
/** Windborne litter from actual trees. Rain/snow belong to RainRenderer;
 * fireflies belong to habitat-driven wildlife, not a second screen-space population. */
import { DAY_MS } from '../core/clock';
import { clamp01, hash2, makeRng } from '../core/rng';
import { Atmosphere, RGB, css, mix } from '../world/palette';
import { Ctx } from './paint';

interface Particle {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  rot: number;
  vr: number;
  age: number;
  seed: number;
  kind: 'petal' | 'leaf';
}
export class Weather {
  private particles: Particle[] = [];
  rnd = makeRng(4242);
  private w = 0;
  private h = 0;
  private calendar: number | undefined;
  resize(w: number, h: number): void {
    this.w = w;
    this.h = h;
  }
  /** The source tree has already checked its own seeded flowering/shedding phase. */
  emitAt(x: number, y: number, kind: 'petal' | 'leaf', seed: number): void {
    if (this.particles.length >= 96) this.particles.shift();
    const r = this.rnd;
    this.particles.push({
      x,
      y,
      kind,
      seed,
      z: 0.55 + r() * 0.45,
      vx: 0.1 + r() * 0.3,
      vy: 0.12 + r() * 0.16,
      rot: r() * Math.PI * 2,
      vr: (r() - 0.5) * 0.05,
      age: 0,
    });
  }
  update(dt: number, atm: Atmosphere): void {
    if (this.calendar !== undefined && Math.abs(atm.time.now - this.calendar) > DAY_MS) this.particles = [];
    this.calendar = atm.time.now;
    const step = Number.isFinite(dt) ? Math.max(0, dt) : 0;
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.age += step;
      const drift = Math.sin(performance.now() * 0.0008 + p.seed) * 0.34;
      p.x += (p.vx + drift) * step * 0.09 * p.z;
      p.y += p.vy * step * 0.09 * p.z;
      p.rot += p.vr * step * 0.06;
      if (p.age > 40000 || p.y > this.h + 40 || p.x > this.w + 120 || p.x < -120) this.particles.splice(i, 1);
    }
  }
  draw(ctx: Ctx, atm: Atmosphere): void {
    for (const p of this.particles) {
      const warm = hash2(p.seed | 0, 1, 3);
      const base: RGB =
        p.kind === 'petal'
          ? { r: 250, g: 214, b: 226 }
          : warm > 0.6
            ? { r: 214, g: 110, b: 68 }
            : warm > 0.3
              ? { r: 226, g: 168, b: 76 }
              : { r: 186, g: 96, b: 62 };
      const color = mix(base, atm.lightTint, atm.lightAmount * 0.6);
      const size = (2.2 + p.z * 3.4) * (p.kind === 'leaf' ? 1.35 : 1);
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillStyle = css(color, 0.75 * clamp01((40000 - p.age) / 5000));
      ctx.beginPath();
      ctx.moveTo(0, -size);
      ctx.bezierCurveTo(size * 0.9, -size * 0.5, size * 0.8, size * 0.6, 0, size);
      ctx.bezierCurveTo(-size * 0.8, size * 0.6, -size * 0.9, -size * 0.5, 0, -size);
      ctx.fill();
      ctx.restore();
    }
  }
}

/** Утренняя дымка над водой и низинами. */
export function drawMist(ctx: Ctx, w: number, h: number, atm: Atmosphere, time: number): void {
  const t = atm.time;
  // дымка на рассвете и в холодные сезоны
  let strength = 0;
  if (t.dayT > 0.18 && t.dayT < 0.32) strength = 0.55;
  const year = ecologyYear(t.now);
  strength = Math.max(strength, 0.25 * year.cold + 0.1 * (1 - year.green) * (1 - year.cold));
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
  // Сила — только золотой час, днём почти не видно. Раньше добавляли daylight*0.08
  // и даже в полдень были полосы, а они должны быть только на рассвете/закате.
  const strength = atm.golden * 0.32 + atm.time.daylight * 0.02;
  if (strength < 0.03) return;
  // Лучи тёплые и узкие: широкие полосы читались как блики на стекле,
  // а не как свет низкого солнца сквозь пыль и листву. Исправлено направление:
  // тень = +sunDir.x (вправо утром), и лучи должны идти туда же — от солнца,
  // а не к солнцу. Было x - dirX*…, стало x + dirX*….
  const warm = mix({ r: 255, g: 208, b: 128 }, { r: 255, g: 176, b: 96 }, atm.golden);
  const dirX = atm.sunDir.x;
  ctx.save();
  ctx.globalCompositeOperation = 'soft-light';
  for (let i = 0; i < 5; i++) {
    const seed = hash2(i, 11, 3);
    // Привязываем к стороне солнца: утром лучи начинаются левее, вечером правее
    const sunBias = dirX * 0.18;
    const x = w * (0.15 + seed * 0.7 + sunBias * 0.2) + Math.sin(time * 0.00012 + i) * 24;
    const wdt = 18 + seed * 38;
    const g = ctx.createLinearGradient(x, 0, x + dirX * 220, h);
    g.addColorStop(0, css(warm, 0.09 * strength));
    g.addColorStop(0.5, css(warm, 0.035 * strength));
    g.addColorStop(1, css(warm, 0));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(x - wdt / 2, -20);
    ctx.lineTo(x + wdt / 2, -20);
    ctx.lineTo(x + wdt * 0.7 + dirX * 240, h + 20);
    ctx.lineTo(x - wdt * 0.7 + dirX * 240, h + 20);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}
