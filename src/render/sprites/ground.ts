/** Камни и мелочь земли: валуны, шаговые камни, мох, цветы и папоротники. */

import { flowerOpenness, flowerHeadPath } from '../flowerCycle';
import { Drawer, WHITE, litc, shadowUnder } from './common';
import { hash2, lerp } from '../../core/rng';
import { RGB, css, mix, shade } from '../../world/palette';
import { blobPath, granulate, softShadow, washBlob } from '../paint';

// ---------------- Камни ----------------

export function makeRock(sizeScale: number, count: number): Drawer {
  return (d) => {
    const { ctx, atm, obj } = d;
    shadowUnder(d, 22 * sizeScale, 10 * sizeScale, 1);
    const stone = atm.palette.stone;
    // Детерминированная вариация: количество трещин, положение мха, форма
    const crackExtra = hash2(obj.seed, 97, 3) > 0.6 ? 1 : 0;
    const mossSide = hash2(obj.seed, 33, 7) > 0.5 ? 1 : -1;
    const shapeVar = hash2(obj.seed, 11, 19);
    for (let i = 0; i < count; i++) {
      const r1 = hash2(i, obj.seed, 5);
      const r2 = hash2(i, obj.seed, 15);
      const ox = count === 1 ? 0 : (i - (count - 1) / 2) * 20 * sizeScale + (r1 - 0.5) * 8;
      const oy = count === 1 ? 0 : (r2 - 0.5) * 9 * sizeScale;
      // форма чуть вытянутее по сиду
      const rx = (16 + r1 * 10) * sizeScale * (count > 1 ? 0.72 : 1) * (0.9 + shapeVar * 0.22);
      const ry = (11 + r2 * 7) * sizeScale * (count > 1 ? 0.72 : 1) * (0.9 + (1 - shapeVar) * 0.22);
      const cx = d.x + ox;
      const cy = d.y + oy - ry * 0.6;

      const body = litc(mix(stone, { r: 150, g: 146, b: 140 }, r1 * 0.4), atm);
      const dark = litc(shade(stone, 0.62), atm);
      const light = litc(mix(stone, WHITE, 0.4), atm, 0.05);

      // тёмная нижняя часть
      washBlob(ctx, cx, cy + ry * 0.35, rx, ry * 0.9, dark, obj.seed + i * 3, {
        layers: 2,
        alpha: 0.5,
        edge: 0.2,
        wobble: 0.16,
      });
      // основной объём
      washBlob(ctx, cx, cy, rx * 0.97, ry, body, obj.seed + i * 11, {
        layers: 3,
        alpha: 0.5,
        edge: 0.24,
        wobble: 0.18,
      });
      // освещённая грань
      ctx.save();
      blobPath(ctx, cx, cy, rx * 0.95, ry * 0.98, obj.seed + i * 11, 0.18);
      ctx.clip();
      ctx.fillStyle = css(light, 0.42);
      blobPath(ctx, cx - atm.sunDir.x * rx * 0.35, cy - ry * 0.45, rx * 0.62, ry * 0.5, obj.seed + i + 2, 0.24);
      ctx.fill();
      // трещины — количество зависит от сида
      ctx.strokeStyle = css(dark, 0.3);
      ctx.lineWidth = 1.1;
      for (let k = 0; k < 2 + crackExtra; k++) {
        const t = hash2(k, obj.seed + i, 61);
        ctx.beginPath();
        ctx.moveTo(cx - rx * 0.5 + t * rx, cy - ry * 0.6);
        ctx.quadraticCurveTo(cx + (t - 0.5) * rx, cy, cx - rx * 0.3 + t * rx * 1.2, cy + ry * 0.7);
        ctx.stroke();
      }
      ctx.restore();
      granulate(ctx, cx, cy, rx * 0.8, ry * 0.8, dark, obj.seed + i, 10, 0.12);

      // Северный мох — растёт на северной (верхней) стороне камня, с лёгким разбросом по сиду
      const northBias = 0.55 + hash2(obj.seed, 37, 11) * 0.3; // 0.55..0.85 севернее
      if (atm.season !== 'winter') {
        // основной мох — север
        ctx.fillStyle = css(litc(atm.palette.moss, atm), 0.38);
        blobPath(
          ctx,
          cx + rx * 0.18 * mossSide,
          cy - ry * northBias + ry * 0.15,
          rx * 0.38,
          ry * 0.28,
          obj.seed + i * 5,
          0.35,
          7,
        );
        ctx.fill();
        // лишайник — светлый, тоже на севере, но пятнами
        if (hash2(obj.seed + i, 47, 13) > 0.55) {
          ctx.fillStyle = css(litc({ r: 168, g: 186, b: 148 }, atm), 0.32);
          blobPath(
            ctx,
            cx - rx * 0.22 * mossSide,
            cy - ry * 0.35,
            rx * 0.22,
            ry * 0.18,
            obj.seed + i * 7 + 11,
            0.32,
            6,
          );
          ctx.fill();
        }
      } else {
        ctx.fillStyle = css(litc({ r: 246, g: 248, b: 250 }, atm), 0.6);
        blobPath(ctx, cx, cy - ry * 0.55, rx * 0.8, ry * 0.3, obj.seed + i * 5, 0.3, 8);
        ctx.fill();
      }
    }
  };
}

export const drawStepStone: Drawer = (d) => {
  const { ctx, atm, obj } = d;
  // вариация размера по сиду
  const szJ = 0.85 + hash2(obj.seed, 3, 5) * 0.3;
  const rx = 13 * szJ;
  const ry = 7 * szJ;
  softShadow(ctx, d.x + 1, d.y + 1, rx, ry * 0.8, atm.shadowTint, atm.shadowAmount * 1.1);
  const body = litc(mix(atm.palette.stone, { r: 160, g: 158, b: 152 }, 0.3), atm);
  washBlob(ctx, d.x, d.y, rx, ry, body, obj.seed, { layers: 2, alpha: 0.6, edge: 0.25, wobble: 0.16 });
  ctx.fillStyle = css(litc(mix(atm.palette.stone, WHITE, 0.3), atm), 0.3);
  blobPath(ctx, d.x - 2, d.y - 1.5, rx * 0.6, ry * 0.5, obj.seed + 2, 0.2, 7);
  ctx.fill();
};

// ---------------- Мелочи ----------------

export const drawMossClump: Drawer = (d) => {
  const { ctx, atm, obj } = d;
  const szJ = 0.75 + hash2(obj.seed, 5, 7) * 0.5;
  const c = litc(atm.season === 'winter' ? { r: 196, g: 204, b: 198 } : atm.palette.moss, atm);
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
  const base =
    atm.season === 'winter'
      ? { r: 196, g: 200, b: 198 }
      : atm.season === 'autumn'
        ? { r: 188, g: 172, b: 112 }
        : atm.palette.grassDeep;
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
    const winter = atm.season === 'winter';
    const scale = lerp(0.4, 1, g) * (winter ? 0.7 : 1);
    const lc = litc(winter ? { r: 176, g: 186, b: 180 } : leaf, atm);
    const pc = litc(winter ? { r: 226, g: 230, b: 234 } : petal, atm, 0.04);
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
      if (!winter || !tall) {
        ctx.fillStyle = css(pc, 0.85);
        flowerHeadPath(
          ctx,
          d.x + ox + sway,
          d.y - h - 1.5,
          3 * scale + r,
          2.4 * scale + r * 0.8,
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
  const base =
    atm.season === 'winter'
      ? { r: 168, g: 176, b: 168 }
      : atm.season === 'autumn'
        ? { r: 170, g: 152, b: 96 }
        : { r: 104, g: 146, b: 92 };
  const c = litc(base, atm);
  const count = 5 + Math.floor(hash2(obj.seed, 43, 11) * 5);
  for (let i = 0; i < count; i++) {
    const r = hash2(i, obj.seed, 23);
    const ang = (i / count) * Math.PI - Math.PI / 2 + (r - 0.5) * 0.3;
    const len = 16 + r * 10;
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
