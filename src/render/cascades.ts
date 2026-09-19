/** Uneven rock ledges, separate ribbons of falling water and small broken foam trails. */
import type { World } from '../world/world';
import type { WaterFlow } from '../world/waterFlow';
import { css, mix, shade, type Atmosphere } from '../world/palette';
import { hash2 } from '../core/rng';
import type { Ctx } from './paint';
import { shape, stroke, oval } from './animalBrush';
import { cascadeRims, rimPoint } from './cascadeRims';
import { cascadeStone } from './cascadeStone';

export function drawFalls(ctx: Ctx, world: World, flow: WaterFlow, atm: Atmosphere, time: number): void {
  const rock = shade(mix(atm.palette.stone, { r: 101, g: 111, b: 102 }, 0.45), atm.exposure);
  const rockDark = shade(rock, 0.86),
    rockLight = shade(rock, 1.18);
  const moss = shade(mix(atm.palette.moss, rock, 0.55), atm.exposure);
  const light = Math.max(atm.exposure, 0.46);
  const deep = shade(mix(atm.palette.waterDeep, { r: 51, g: 119, b: 129 }, 0.22), light);
  const body = shade(mix(atm.palette.water, { r: 102, g: 179, b: 178 }, 0.24), light);
  const shallows = shade(mix({ r: 193, g: 190, b: 143 }, atm.palette.water, 0.28), light);
  const water = mix(mix(body, deep, 0.44), shallows, 0.28);
  const foam = shade(mix(atm.palette.water, { r: 241, g: 246, b: 226 }, 0.82), Math.max(atm.exposure, 0.52));
  ctx.save();
  ctx.lineCap = 'round';
  for (const rim of cascadeRims(world, flow)) {
    const { height: h, seed, span } = rim;
    const top = (from: number, to: number, offset = 0) => {
      for (let i = 0; i <= 24; i++) {
        const p = rimPoint(rim, from + ((to - from) * i) / 24);
        if (i) ctx.lineTo(p.x, p.y + offset);
        else ctx.moveTo(p.x, p.y + offset);
      }
    };
    shape(ctx, css(mix(rockDark, water, 0.28), 0.85), () => {
      top(0, 1, -1);
      for (let i = 24; i >= 0; i--) {
        const p = rimPoint(rim, i / 24);
        ctx.lineTo(p.x, p.y + h + Math.sin(p.x * 0.13) * 2);
      }
    });
    // Uneven overlapping boulders; neither a row of blocks nor a scalloped trim.
    const facets = Math.max(2, Math.ceil(span / 18));
    for (let i = 0; i < facets; i++) {
      const s = hash2(i, seed, 281),
        q = hash2(i, seed, 283);
      const p = rimPoint(rim, (i + 0.2 + s * 0.6) / facets);
      cascadeStone(
        ctx,
        p.x,
        p.y + h * (0.15 + q * 0.44),
        7 + s * 10,
        5 + q * 8,
        mix(rock, rockLight, s * 0.3),
        moss,
        seed + i * 17,
      );
    }
    for (const t of [0, 0.99]) {
      const p = rimPoint(rim, t),
        s = hash2(seed, t, 289);
      cascadeStone(ctx, p.x, p.y + 4, 9 + s * 8, 6 + s * 6, rock, moss, seed + Math.floor(t * 100));
    }
    const streams = Math.max(1, Math.ceil(span / 105));
    for (let i = 0; i < streams; i++) {
      const s = hash2(i, seed, 293),
        center = (i + 0.32 + s * 0.36) / streams;
      const half = (0.15 + s * 0.31) / streams;
      const lo = Math.max(0, center - half),
        hi = Math.min(1, center + half);
      const left = rimPoint(rim, lo),
        right = rimPoint(rim, hi),
        mid = rimPoint(rim, center);
      const drift = Math.sin(time * 0.0018 + s * 9) * 1.0;
      const gradient = ctx.createLinearGradient(mid.x, mid.y - 2, mid.x, mid.y + h + 3);
      gradient.addColorStop(0, css(water, 0.82));
      gradient.addColorStop(0.38, css(mix(water, foam, 0.2), 0.66));
      gradient.addColorStop(1, css(mix(water, foam, 0.48), 0.7));
      ctx.fillStyle = gradient;
      ctx.beginPath();
      top(lo, hi, -1);
      ctx.bezierCurveTo(
        right.x - 2,
        right.y + h * 0.4,
        right.x + drift + 2,
        right.y + h * 0.8,
        right.x + drift + 4,
        right.y + h,
      );
      ctx.quadraticCurveTo(mid.x, mid.y + h + 3, left.x - 2 + drift, left.y + h);
      ctx.bezierCurveTo(left.x + 3, left.y + h * 0.65, left.x + 1, left.y + h * 0.25, left.x, left.y - 1);
      ctx.closePath();
      ctx.fill();
      const strands = 3 + Math.floor(s * 3);
      for (let j = 0; j < strands; j++) {
        const r = hash2(j, seed + i, 307),
          p = rimPoint(rim, lo + ((hi - lo) * (j + 0.25 + r * 0.5)) / strands);
        stroke(ctx, css(foam, 0.1 + r * 0.16), 0.65 + r * 0.9, () => {
          const begin = 0.05 + r * 0.3,
            end = Math.min(0.98, begin + 0.3 + r * 0.35);
          ctx.moveTo(p.x, p.y + h * begin);
          ctx.quadraticCurveTo(p.x - 1 + drift, p.y + (h * (begin + end)) / 2, p.x + drift, p.y + h * end);
        });
        const phase = (((time * (0.0009 + r * 0.0008) + r) % 1) + 1) % 1;
        const yy = p.y + phase * phase * h;
        stroke(ctx, css(foam, Math.sin(phase * Math.PI) * 0.36), 0.9, () => {
          ctx.moveTo(p.x + drift, yy);
          ctx.lineTo(p.x + drift, Math.min(p.y + h, yy + 3 + r * 3));
        });
      }
      // No opaque circles along the step: scattered tiny bubbles and open eddies.
      for (let j = 0; j < 7; j++) {
        const r = hash2(j, seed + i, 311),
          q = hash2(j, seed + i, 313);
        const p = rimPoint(rim, lo + (hi - lo) * r);
        const phase = (((time * 0.0006 + q) % 1) + 1) % 1;
        oval(
          ctx,
          p.x + Math.sin(phase * 6 + q) * 3,
          p.y + h + 1 + phase * 6,
          0.65 + q * 1.4,
          0.4 + q * 0.55,
          css(foam, (1 - phase) * 0.42),
        );
      }
      const phase = (((time * 0.00038 + s) % 1) + 1) % 1;
      stroke(ctx, css(foam, (1 - phase) * 0.2), 0.7, () =>
        ctx.ellipse(mid.x + drift, mid.y + h + 3, 5 + phase * 14, 1.5 + phase * 4, 0, 0.2, Math.PI * 1.3),
      );
      for (let j = 0; j < 3; j++) {
        const q = hash2(j, seed + i, 317),
          ph = (((time * 0.0013 + q) % 1) + 1) % 1;
        oval(
          ctx,
          mid.x + (q - 0.5) * 14 + ph * 3,
          mid.y + h - Math.sin(ph * Math.PI) * (3 + q * 6),
          0.5 + q * 0.5,
          0.8,
          css(foam, (1 - ph) * 0.3),
        );
      }
    }
  }
  ctx.restore();
}
