import { paintStone } from '../stone';
import { ecologyYear } from '../../world/ecology';
import { crownAnchorBlend } from '../../world/phenology';
import { flowerYear, winterYear } from '../../world/annualEnvironment';
/** Камни и мелочь земли: валуны, шаговые камни, мох, цветы и папоротники. */

import { flowerOpenness, flowerHeadPath } from '../flowerCycle';
import { Drawer, litc, shadowUnder } from './common';
import { hash2, lerp, smoothstep } from '../../core/rng';
import { RGB, css, mix, shade } from '../../world/palette';
import { blobPath, granulate, washBlob } from '../paint';

function annualColor(now: number, colors: RGB[]): RGB {
  const b = crownAnchorBlend(now);
  return mix(colors[b.from], colors[b.to], b.amount);
}

// ---------------- Камни ----------------

export function makeRock(sizeScale: number, count: number): Drawer {
  return (d) => {
    shadowUnder(d, 29 * sizeScale, 16 * sizeScale, 1);
    if (count === 1) paintStone(d.ctx, d.x, d.y, d.obj.seed, sizeScale, d.obj.rot, d.atm);
    else {
      const parts = [
        { x: -22, y: -5, k: 0.67, seed: d.obj.seed + 29 },
        { x: 0, y: 0, k: 1, seed: d.obj.seed },
        { x: 23, y: 7, k: 0.56, seed: d.obj.seed + 58 },
      ];
      const angle = d.obj.rot * Math.PI * 0.5;
      const rotated = parts
        .map((p) => ({
          ...p,
          x: p.x * Math.cos(angle) - p.y * 2 * Math.sin(angle),
          y: (p.x * Math.sin(angle) + p.y * 2 * Math.cos(angle)) * 0.5,
        }))
        .sort((a, b) => a.y - b.y);
      for (const p of rotated)
        paintStone(d.ctx, d.x + p.x * sizeScale, d.y + p.y * sizeScale, p.seed, sizeScale * p.k, d.obj.rot, d.atm);
    }
  };
}
export const drawStepStone: Drawer = (d) => {
  shadowUnder(d, 15, 5, 0.55);
  paintStone(d.ctx, d.x, d.y, d.obj.seed, 0.6, d.obj.rot, d.atm, true);
};

// ---------------- Мелочи ----------------

export const drawMossClump: Drawer = (d) => {
  const { ctx, atm, obj } = d;
  const szJ = 0.75 + hash2(obj.seed, 5, 7) * 0.5;
  const c = litc(mix(atm.palette.moss, { r: 196, g: 204, b: 198 }, winterYear(atm.time.now).snow), atm);
  const deep = litc(shade(atm.palette.moss, 0.78), atm);
  washBlob(ctx, d.x, d.y, 15 * szJ, 7.5 * szJ, deep, obj.seed, { layers: 1, alpha: 0.4, edge: 0.1, wobble: 0.3 });
  washBlob(ctx, d.x, d.y - 1.5, 13 * szJ, 6.5 * szJ, c, obj.seed + 3, {
    layers: 2,
    alpha: 0.45,
    edge: 0.12,
    wobble: 0.32,
  });
  granulate(ctx, d.x, d.y - 1, 11 * szJ, 5 * szJ, deep, obj.seed, 10, 0.16);
};

export const drawPebbles: Drawer = (d) => {
  const { ctx, atm, obj } = d;
  const count = 4 + Math.floor(hash2(obj.seed, 11, 13) * 5); // 4..8
  for (let i = 0; i < count; i++) {
    const r1 = hash2(i, obj.seed, 7);
    const r2 = hash2(i, obj.seed, 17);
    const px = d.x + (r1 - 0.5) * 24;
    const py = d.y + (r2 - 0.5) * 12;
    const c = litc(mix(atm.palette.stone, { r: 190, g: 180, b: 170 }, r1 * 0.5), atm);
    ctx.fillStyle = css(shade(c, 0.7), 0.25);
    ctx.beginPath();
    ctx.ellipse(px + 0.8, py + 1, 3.4 + r1 * 2, 2.2 + r2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = css(c, 0.85);
    blobPath(ctx, px, py, 3.2 + r1 * 2, 2 + r2, obj.seed + i, 0.22, 6);
    ctx.fill();
  }
};

export const drawGrassTuft: Drawer = (d) => {
  const { ctx, atm, obj } = d;
  const base = mix(atm.palette.grassDeep, { r: 196, g: 200, b: 198 }, winterYear(atm.time.now).snow);
  const c = litc(base, atm);
  const count = 6 + Math.floor(hash2(obj.seed, 19, 23) * 7); // 6..12
  for (let i = 0; i < count; i++) {
    const r = hash2(i, obj.seed, 11);
    const dir = (r - 0.5) * 2;
    const h = 9 + r * 11;
    const sway = Math.sin(d.time * 0.0011 + obj.seed + i) * 3 * d.wind;
    ctx.strokeStyle = css(shade(c, 0.85 + r * 0.3), 0.75);
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(d.x + dir * 5, d.y);
    ctx.quadraticCurveTo(d.x + dir * 8 + sway * 0.5, d.y - h * 0.6, d.x + dir * 12 + sway, d.y - h);
    ctx.stroke();
  }
};

export function makeFlower(petal: RGB, leaf: RGB, tall: boolean): Drawer {
  return (d) => {
    const { ctx, atm, obj, g } = d;
    const year = flowerYear(obj.type, obj.seed, atm.time.now);
    const scale = lerp(0.4, 1, g) * (0.35 + 0.65 * year.foliage);
    const lc = litc(mix({ r: 158, g: 148, b: 118 }, leaf, year.foliage), atm);
    const pc = litc(petal, atm, 0.04);
    // вариация количества стеблей по сиду
    const baseN = tall ? 5 : 7;
    const n = baseN + Math.floor(hash2(obj.seed, 31, 7) * 3) - 1;
    for (let i = 0; i < n; i++) {
      const r = hash2(i, obj.seed, 13);
      const ox = (r - 0.5) * 18;
      const h = (tall ? 18 : 11) * scale * (0.7 + r * 0.6);
      const sway = Math.sin(d.time * 0.0009 + obj.seed + i) * 2.5 * d.wind;
      ctx.strokeStyle = css(lc, 0.8);
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(d.x + ox, d.y);
      ctx.quadraticCurveTo(d.x + ox + sway * 0.5, d.y - h * 0.6, d.x + ox + sway, d.y - h);
      ctx.stroke();
      const bloom = smoothstep(r * 0.3, 0.6 + r * 0.4, year.bloom);
      if (bloom > 0.001) {
        ctx.fillStyle = css(pc, 0.85 * bloom);
        flowerHeadPath(
          ctx,
          d.x + ox + sway,
          d.y - h - 1.5,
          (3 * scale + r) * Math.sqrt(bloom),
          (2.4 * scale + r * 0.8) * Math.sqrt(bloom),
          obj.seed + i,
          flowerOpenness(atm),
        );
        ctx.fill();
      }
    }
  };
}

export const drawFern: Drawer = (d) => {
  const { ctx, atm, obj } = d;
  const base = annualColor(atm.time.now, [
    { r: 168, g: 176, b: 168 },
    { r: 104, g: 146, b: 92 },
    { r: 104, g: 146, b: 92 },
    { r: 170, g: 152, b: 96 },
  ]);
  const waking = ecologyYear(atm.time.now).green;
  const c = litc(mix({ r: 155, g: 137, b: 107 }, base, waking), atm);
  const count = 5 + Math.floor(hash2(obj.seed, 43, 11) * 5);
  for (let i = 0; i < count; i++) {
    const r = hash2(i, obj.seed, 23);
    const ang = (i / count) * Math.PI - Math.PI / 2 + (r - 0.5) * 0.3;
    const len = (16 + r * 10) * (0.3 + 0.7 * waking);
    const sway = Math.sin(d.time * 0.0007 + obj.seed + i) * 2 * d.wind;
    const ex = d.x + Math.cos(ang) * len + sway;
    const ey = d.y - Math.abs(Math.sin(ang)) * len * 0.8 - 3;
    ctx.strokeStyle = css(c, 0.75);
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(d.x, d.y);
    ctx.quadraticCurveTo((d.x + ex) / 2, (d.y + ey) / 2 - 4, ex, ey);
    ctx.stroke();
    // перья
    for (let k = 1; k <= 3; k++) {
      const t = k / 4;
      const px = lerp(d.x, ex, t);
      const py = lerp(d.y, ey, t) - 3 * Math.sin(t * Math.PI);
      ctx.fillStyle = css(c, 0.5);
      ctx.beginPath();
      ctx.ellipse(px, py, 3.4, 1.8, ang, 0, Math.PI * 2);
      ctx.fill();
    }
  }
};
