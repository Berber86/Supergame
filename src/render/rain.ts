/** Визуал погоды: дождь, круги на воде, туман, вспышки молний, мокрый блеск. */

import { GRID, isoToScreen } from '../core/iso';
import { clamp01, hash2, makeRng } from '../core/rng';
import { Atmosphere, RGB, css, mix, shade } from '../world/palette';
import { WeatherState } from '../world/weatherState';
import { World } from '../world/world';
import { Ctx } from './paint';

interface Drop {
  x: number;
  y: number;
  len: number;
  speed: number;
  z: number;
}

interface Ripple {
  /** Координаты тайла. */
  tx: number;
  ty: number;
  age: number;
  life: number;
  max: number;
}

const rnd = makeRng(31337);

export class RainRenderer {
  private drops: Drop[] = [];
  private ripples: Ripple[] = [];
  private splashes: { x: number; y: number; age: number }[] = [];
  private w = 0;
  private h = 0;
  private rippleTimer = 0;

  /** The same impacts drive drawn rings and distortion, not unrelated noise. */
  get waterRipples(): readonly Ripple[] { return this.ripples; }

  resize(w: number, h: number): void {
    this.w = w;
    this.h = h;
  }

  update(dt: number, weather: WeatherState, world: World): void {
    const safeDt = Number.isFinite(dt) && dt > 0 ? Math.min(dt, 100) : 16;
    const rainSafe = Number.isFinite(weather.rain) ? clamp01(weather.rain) : 0;
    const target = Math.round(rainSafe * 320);
    while (this.drops.length < target) {
      this.drops.push({
        x: rnd() * (this.w + 340) - 170,
        y: rnd() * this.h - this.h,
        len: 9 + rnd() * 22,
        speed: 1.5 + rnd() * 1.3,
        z: 0.4 + rnd() * 0.6,
      });
    }
    while (this.drops.length > target + 30) this.drops.pop();

    const slant = 0.24;
    for (const d of this.drops) {
      d.y += d.speed * d.z * safeDt * 0.62;
      d.x += d.speed * d.z * safeDt * 0.62 * slant;
      if (d.y > this.h + 30) {
        d.y = -30 - rnd() * 120;
        d.x = rnd() * (this.w + 340) - 170;
      }
      if (d.x > this.w + 170) d.x -= this.w + 340;
    }

    // Круги на воде под дождём
    if (rainSafe > 0.08) {
      this.rippleTimer -= safeDt;
      if (this.rippleTimer <= 0) {
        this.rippleTimer = 40 / (rainSafe + 0.1);
        for (let i = 0; i < 24; i++) {
          const tx = rnd() * GRID;
          const ty = rnd() * GRID;
          const t = world.at(Math.floor(tx), Math.floor(ty));
          if (t?.water) {
            this.ripples.push({ tx, ty, age: 0, life: 900 + rnd() * 500, max: 9 + rnd() * 11 });
            break;
          }
        }
        // брызги на суше
        const sx = rnd() * GRID;
        const sy = rnd() * GRID;
        const st = world.at(Math.floor(sx), Math.floor(sy));
        if (st && !st.water) {
          const p = isoToScreen(sx, sy, st.level);
          this.splashes.push({ x: p.x, y: p.y, age: 0 });
        }
      }
    }
    for (let i = this.ripples.length - 1; i >= 0; i--) {
      this.ripples[i].age += safeDt;
      if (this.ripples[i].age > this.ripples[i].life) this.ripples.splice(i, 1);
    }
    for (let i = this.splashes.length - 1; i >= 0; i--) {
      this.splashes[i].age += safeDt;
      if (this.splashes[i].age > 320) this.splashes.splice(i, 1);
    }
  }

  /** Круги и брызги рисуются в мировых координатах — до пост-обработки. */
  drawWorldLayer(ctx: Ctx, world: World, atm: Atmosphere, weather: WeatherState): void {
    if (weather.rain < 0.03) return;
    const ring = mix(atm.palette.water, { r: 255, g: 255, b: 255 }, 0.7);
    for (const r of this.ripples) {
      const t = world.at(Math.floor(r.tx), Math.floor(r.ty));
      if (!t?.water) continue;
      // Возраст может уйти в минус при кривой метке кадра — радиус
      // ellipse() обязан быть неотрицательным, иначе IndexSizeError.
      if (r.age <= 0) continue;
      const k = Math.min(1, r.age / r.life);
      const p = isoToScreen(r.tx, r.ty, t.level - 0.26);
      ctx.strokeStyle = css(ring, 0.3 * (1 - k));
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.ellipse(p.x, p.y, r.max * k, r.max * k * 0.5, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    const spl = mix(atm.palette.water, { r: 255, g: 255, b: 255 }, 0.55);
    for (const s of this.splashes) {
      const k = clamp01(s.age / 320);
      ctx.strokeStyle = css(spl, 0.32 * (1 - k));
      ctx.lineWidth = 1;
      const r = 2 + k * 7;
      ctx.beginPath();
      ctx.ellipse(s.x, s.y, r, r * 0.45, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  /** Полосы дождя — экранный слой поверх сцены. */
  drawScreenLayer(ctx: Ctx, atm: Atmosphere, weather: WeatherState): void {
    if (weather.rain < 0.02) return;
    const col = mix({ r: 208, g: 226, b: 238 }, atm.lightTint, 0.4);
    ctx.save();
    ctx.lineCap = 'round';
    for (const d of this.drops) {
      ctx.strokeStyle = css(col, (0.12 + d.z * 0.26) * clamp01(weather.rain * 1.4));
      ctx.lineWidth = 0.7 + d.z * 1.0;
      ctx.beginPath();
      ctx.moveTo(d.x, d.y);
      ctx.lineTo(d.x - d.len * 0.24, d.y - d.len);
      ctx.stroke();
    }
    ctx.restore();
  }
}

/** Плотный туман: несколько ползущих слоёв. */
export function drawFog(ctx: Ctx, w: number, h: number, atm: Atmosphere, weather: WeatherState, time: number): void {
  if (weather.fog < 0.02) return;
  const col = mix({ r: 238, g: 240, b: 240 }, atm.lightTint, 0.45);
  ctx.save();
  for (let i = 0; i < 5; i++) {
    const seed = hash2(i, 3, 11);
    const y = h * (0.3 + i * 0.16) + Math.sin(time * 0.00014 + i * 1.7) * 26;
    const drift = ((time * (0.004 + seed * 0.006)) % (w + 700)) - 350;
    const g = ctx.createLinearGradient(0, y - 130, 0, y + 130);
    // полосы гуще вверху кадра — там даль
    const depth = 1 - (y / h) * 0.72;
    const a = 0.15 * weather.fog * (0.6 + seed * 0.7) * depth;
    g.addColorStop(0, css(col, 0));
    g.addColorStop(0.5, css(col, a));
    g.addColorStop(1, css(col, 0));
    ctx.fillStyle = g;
    ctx.save();
    ctx.translate(drift * 0.1, 0);
    ctx.fillRect(-100, y - 130, w + 200, 260);
    ctx.restore();
  }
  // Общая дымка градиентом по глубине: в изометрии верх кадра — даль,
  // низ — то, что у ног. Плоская заливка убивала рисунок, поэтому передний
  // план оставляем почти чистым.
  const haze = ctx.createLinearGradient(0, 0, 0, h);
  haze.addColorStop(0, css(col, 0.3 * weather.fog));
  haze.addColorStop(0.42, css(col, 0.15 * weather.fog));
  haze.addColorStop(1, css(col, 0.035 * weather.fog));
  ctx.fillStyle = haze;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
}

/** Вспышка молнии — засвет всего кадра. */
export function drawLightning(ctx: Ctx, w: number, h: number, weather: WeatherState): void {
  if (weather.flash < 0.01) return;
  const k = weather.flash;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = css({ r: 200, g: 216, b: 255 }, k * 0.42);
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
}

export { shade };
export type { RGB };
