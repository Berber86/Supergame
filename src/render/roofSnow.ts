/** Settled roof snow, not falling particles. Stable for three world days and across save/load. */
import { DAY_MS } from '../core/clock';
import { hash2 } from '../core/rng';
import type { Pt } from '../core/iso';
import { css, mix, shade, type Atmosphere } from '../world/palette';
import { type Ctx, washBlob } from './paint';

export interface RoofSnow {
  amount: number;
  seed: number;
}
export function roofSnow(atm: Atmosphere, seed: number): RoofSnow {
  if (atm.season !== 'winter') return { amount: 0, seed: 0 };
  const period = Math.floor(atm.time.now / (3 * DAY_MS));
  const roll = hash2(seed, period, 571);
  return { amount: roll < 0.32 ? 0 : roll < 0.66 ? 0.48 : 0.9, seed: Math.floor(hash2(seed, period, 827) * 1000000) };
}
export function roofSnowKey(atm: Atmosphere, seed: number): string {
  const s = roofSnow(atm, seed);
  return s.amount ? `${s.amount}:${s.seed}` : 'dry';
}
export function snowColor(atm: Atmosphere) {
  return shade(mix({ r: 240, g: 244, b: 244 }, atm.lightTint, atm.lightAmount * 0.45), atm.exposure);
}
/** point uses v=0 at the ridge and v=1 at the eave. All pigment is clipped to its actual slope. */
export function paintRoofSnow(
  ctx: Ctx,
  atm: Atmosphere,
  snow: RoofSnow,
  outline: Pt[],
  point: (u: number, v: number) => Pt,
  side = 0,
): void {
  if (!snow.amount) return;
  ctx.save();
  ctx.beginPath();
  outline.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
  ctx.closePath();
  ctx.clip();
  const white = shade(snowColor(atm), side % 2 ? 0.93 : 1),
    blue = shade(mix(white, shade({ r: 116, g: 147, b: 177 }, atm.exposure), 0.25), 0.94);
  const spans =
    snow.amount > 0.7
      ? [[0, 1]]
      : [
          [0.02, 0.31],
          [0.36, 0.68],
          [0.73, 0.98],
        ];
  for (const [a, b] of spans) {
    const edge: Pt[] = [];
    for (let k = 0; k <= 96; k++) {
      const u = a + ((b - a) * k) / 96;
      const ripple = 0.045 * Math.sin(u * 25 + side) + 0.025 * Math.sin(u * 57 + snow.seed);
      const length = snow.amount > 0.7 ? 0.84 : 0.25 + hash2(side, Math.round(a * 100), snow.seed) * 0.28;
      edge.push(point(u, Math.min(0.98, length + 0.09 * Math.sin(((u - a) / (b - a)) * Math.PI) + ripple)));
    }
    const top = Array.from({ length: 25 }, (_, k) => point(a + ((b - a) * k) / 24, 0.005));
    const smoothEdge = (points: Pt[], move: boolean) => {
      const first = points[0];
      if (move) ctx.moveTo(first.x, first.y);
      else ctx.lineTo(first.x, first.y);
      for (let i = 1; i < points.length - 1; i++) {
        const q = points[i],
          n = points[i + 1];
        ctx.quadraticCurveTo(q.x, q.y, (q.x + n.x) / 2, (q.y + n.y) / 2);
      }
      const last = points[points.length - 1];
      ctx.lineTo(last.x, last.y);
    };
    ctx.beginPath();
    top.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
    smoothEdge(edge.slice().reverse(), false);
    ctx.closePath();
    ctx.fillStyle = css(white, 0.97);
    ctx.fill();
    ctx.save();
    ctx.clip();
    const center = point((a + b) / 2, snow.amount * 0.4);
    const left = point(a, snow.amount * 0.4),
      right = point(b, snow.amount * 0.4);
    washBlob(
      ctx,
      center.x,
      center.y,
      Math.max(8, Math.abs(right.x - left.x) * 0.45),
      18 + snow.amount * 18,
      blue,
      snow.seed + side,
      { layers: 2, alpha: 0.1, edge: 0, wobble: 0.25 },
    );
    ctx.restore();
    ctx.beginPath();
    smoothEdge(edge, true);
    ctx.strokeStyle = css(blue, 0.6);
    ctx.lineWidth = 2.5;
    ctx.stroke();
    // Wind-combed translucent marks, rather than a flat white replacement material.
    for (let i = 0; i < 12; i++) {
      const u = a + (b - a) * hash2(i, side, snow.seed),
        v = 0.08 + hash2(i, 91, snow.seed) * snow.amount * 0.5;
      const p = point(u, v),
        q = point(Math.min(b, u + 0.07), v + 0.03);
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(q.x, q.y);
      ctx.strokeStyle = css(blue, 0.2);
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }
  ctx.restore();
}
export function paintSnowRidge(ctx: Ctx, atm: Atmosphere, snow: RoofSnow, a: Pt, b: Pt): void {
  if (!snow.amount) return;
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(a.x, a.y - 2.5);
  ctx.lineTo(b.x, b.y - 2.5);
  ctx.strokeStyle = css(snowColor(atm), 0.95);
  ctx.lineCap = 'round';
  ctx.lineWidth = snow.amount > 0.7 ? 6 : 3;
  ctx.stroke();
  ctx.restore();
}

/** Sparse refrozen meltwater, selected once per snowy period rather than per animation frame. */
export function iciclesPresent(snow: RoofSnow): boolean {
  return snow.amount > 0 && hash2(snow.seed, 23, 941) > 0.46;
}
export function paintIcicles(ctx: Ctx, atm: Atmosphere, snow: RoofSnow, edge: Pt[], side = 0): void {
  if (atm.season !== 'winter' || !iciclesPresent(snow)) return;
  ctx.save();
  const ice = shade(mix({ r: 185, g: 219, b: 235 }, atm.lightTint, atm.lightAmount * 0.35), atm.exposure);
  const white = snowColor(atm);
  for (let i = 1; i < edge.length - 1; i++) {
    const r = hash2(i, side, snow.seed);
    if (r < 0.67) continue;
    const p = edge[i],
      length = 4 + hash2(i, 71, snow.seed) * 11,
      width = 1 + hash2(i, 73, snow.seed) * 1.8;
    ctx.beginPath();
    ctx.moveTo(p.x - width, p.y + 2);
    ctx.quadraticCurveTo(p.x - 0.7, p.y + length * 0.7, p.x + 0.4, p.y + length + 2);
    ctx.lineTo(p.x + width, p.y + 2);
    ctx.closePath();
    ctx.fillStyle = css(ice, 0.85);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(p.x - 0.5, p.y + 3);
    ctx.lineTo(p.x + 0.2, p.y + length);
    ctx.strokeStyle = css(white, 0.8);
    ctx.lineWidth = 0.65;
    ctx.stroke();
  }
  ctx.restore();
}
