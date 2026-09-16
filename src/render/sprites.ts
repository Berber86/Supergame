/** Рисованные «акварельные» объекты сада. Всё генерируется кодом, без ассетов. */

import { LEVEL_H, TILE_H, TILE_W } from '../core/iso';
import { clamp01, hash2, lerp, makeRng } from '../core/rng';
import { Atmosphere, RGB, css, mix, shade } from '../world/palette';
import { PlacedObject } from '../world/types';
import { Ctx, blobPath, glow, granulate, softShadow, taperStroke, washBlob } from './paint';

export interface DrawCtx {
  ctx: Ctx;
  /** Экранная позиция «якоря» объекта (центр основания). */
  x: number;
  y: number;
  atm: Atmosphere;
  /** 0..1 стадия роста. */
  g: number;
  obj: PlacedObject;
  time: number;
  /** Ветер 0..1 — общая фаза покачивания. */
  wind: number;
  /** Прозрачность (для призрака при размещении). */
  alpha: number;
}

type Drawer = (d: DrawCtx) => void;

const WHITE: RGB = { r: 255, g: 255, b: 255 };

function litc(c: RGB, atm: Atmosphere, boost = 0): RGB {
  return shade(mix(c, atm.lightTint, atm.lightAmount), atm.exposure + boost);
}

function shadowUnder(d: DrawCtx, rx: number, ry: number, strength = 1): void {
  const { ctx, atm } = d;
  ctx.save();
  ctx.globalCompositeOperation = 'multiply';
  // длинная тень по солнцу
  const off = atm.sunDir.x * rx * 0.55;
  softShadow(ctx, d.x + off, d.y + ry * 0.2, rx * 1.15, ry * 0.95, atm.shadowTint, atm.shadowAmount * 1.4 * strength);
  // плотное контактное пятно — объект «врастает» в землю
  softShadow(ctx, d.x, d.y, rx * 0.5, ry * 0.42, atm.shadowTint, atm.shadowAmount * 2.1 * strength);
  ctx.restore();
}

// ---------------- Деревья ----------------

interface TreeStyle {
  trunk: RGB;
  crownSpring: RGB;
  crownSummer: RGB;
  crownAutumn: RGB;
  crownWinter: RGB | null;
  blossom?: RGB;
  height: number;
  crownW: number;
  crownH: number;
  layers: number;
  droop?: number;
}

function crownColor(style: TreeStyle, atm: Atmosphere): { main: RGB; bare: boolean } {
  const s = atm.season;
  if (s === 'winter') {
    if (!style.crownWinter) return { main: style.crownAutumn, bare: true };
    return { main: style.crownWinter, bare: false };
  }
  const main = s === 'spring' ? style.crownSpring : s === 'summer' ? style.crownSummer : style.crownAutumn;
  return { main, bare: false };
}

function drawTrunk(d: DrawCtx, h: number, w: number, col: RGB, bend: number): { tx: number; ty: number } {
  const { ctx } = d;
  const topX = d.x + bend;
  const topY = d.y - h;
  taperStroke(ctx, d.x, d.y, topX, topY, w, w * 0.34, col, 0.94, bend * 0.6);
  // фактура коры
  ctx.strokeStyle = css(shade(col, 0.72), 0.3);
  ctx.lineWidth = 1;
  for (let i = 0; i < 3; i++) {
    const t0 = 0.1 + i * 0.25;
    ctx.beginPath();
    ctx.moveTo(lerp(d.x, topX, t0) - w * 0.3, lerp(d.y, topY, t0));
    ctx.quadraticCurveTo(lerp(d.x, topX, t0 + 0.1), lerp(d.y, topY, t0 + 0.1), lerp(d.x, topX, t0 + 0.2) + w * 0.2, lerp(d.y, topY, t0 + 0.2));
    ctx.stroke();
  }
  return { tx: topX, ty: topY };
}

function drawBranches(d: DrawCtx, tx: number, ty: number, n: number, len: number, col: RGB, spread = 1): void {
  const { ctx, obj } = d;
  for (let i = 0; i < n; i++) {
    const r = hash2(i, obj.seed, 3);
    const side = i % 2 === 0 ? -1 : 1;
    const ang = side * (0.55 + r * 0.55) * spread;
    const l = len * (0.6 + r * 0.6);
    const ex = tx + Math.sin(ang) * l;
    const ey = ty - Math.cos(ang * 0.6) * l * 0.55 + (i / n) * len * 0.3;
    taperStroke(ctx, tx + side * 2, ty + i * 3, ex, ey, 3.2, 1.1, col, 0.8, side * 6);
  }
}

/** Голая зимняя крона: рекурсивное ветвление — читается как настоящее дерево. */
function drawBareCrown(
  d: DrawCtx,
  tx: number,
  ty: number,
  h: number,
  cw: number,
  ch: number,
  col: RGB,
  sway: number,
): void {
  const { ctx, obj } = d;
  const branch = (x: number, y: number, ang: number, len: number, w: number, depth: number, seed: number) => {
    if (depth > 3 || len < 4) return;
    const ex = x + Math.sin(ang) * len + sway * 0.15 * depth;
    const ey = y - Math.cos(ang) * len;
    taperStroke(ctx, x, y, ex, ey, w, w * 0.55, col, 0.88, Math.sin(ang) * len * 0.1);
    const n = depth < 2 ? 3 : 2;
    for (let i = 0; i < n; i++) {
      const r = hash2(seed * 7 + i, obj.seed + depth, 53);
      const spread = (0.34 + r * 0.46) * (i % 2 === 0 ? 1 : -1);
      branch(ex, ey, ang + spread, len * (0.58 + r * 0.22), w * 0.6, depth + 1, seed * 3 + i + 1);
    }
  };
  const main = 4;
  for (let i = 0; i < main; i++) {
    const r = hash2(i, obj.seed, 71);
    const ang = -0.62 + (i / (main - 1)) * 1.24 + (r - 0.5) * 0.28;
    branch(tx, ty + 4, ang, h * 0.34 * (0.8 + r * 0.4), 3.4, 0, i + 1);
  }
  void cw;
  void ch;
}

function makeTree(style: TreeStyle): Drawer {
  return (d) => {
    const { ctx, atm, g, obj } = d;
    const scale = lerp(0.18, 1, Math.pow(g, 0.72));
    const h = style.height * scale;
    const cw = style.crownW * scale;
    const ch = style.crownH * scale;
    const sway = Math.sin(d.time * 0.0004 + obj.seed) * 3 * d.wind * scale;

    shadowUnder(d, cw * 0.62, cw * 0.26, 0.9);

    const trunkCol = litc(style.trunk, atm);
    const { tx, ty } = drawTrunk(d, h, Math.max(2.2, 7 * scale), trunkCol, sway * 0.35);

    const { main, bare } = crownColor(style, atm);
    const branchCol = shade(trunkCol, 0.92);

    if (bare) {
      // зимний силуэт: ветвистая крона + шапки снега
      drawBareCrown(d, tx, ty, h, cw, ch, branchCol, sway);
      const snow = litc({ r: 247, g: 249, b: 252 }, atm);
      for (let i = 0; i < 7; i++) {
        const r = hash2(i, obj.seed, 9);
        const r2 = hash2(i, obj.seed, 4);
        washBlob(
          ctx,
          tx + (r - 0.5) * cw * 1.05 + sway,
          ty - ch * 0.28 + (r2 - 0.5) * ch * 0.55,
          cw * (0.1 + r * 0.14),
          ch * (0.04 + r2 * 0.05),
          snow,
          obj.seed + i,
          { layers: 2, alpha: 0.6, edge: 0.08, wobble: 0.3 },
        );
      }
      return;
    }

    drawBranches(d, tx, ty, 5, h * 0.35, branchCol, 1);

    const crownMain = litc(main, atm);
    const crownDeep = litc(shade(mix(main, atm.palette.foliageDeep, 0.55), 0.92), atm);
    const crownLight = litc(mix(main, WHITE, 0.22), atm, 0.04);

    // Крона — стопка акварельных клякс
    const layers = style.layers;
    for (let i = 0; i < layers; i++) {
      const r1 = hash2(i, obj.seed, 11);
      const r2 = hash2(i, obj.seed, 19);
      const spread = 1 - i / (layers + 1);
      const lx = tx + (r1 - 0.5) * cw * 1.05 + sway * (1 + i * 0.15);
      const ly = ty - ch * 0.15 + (r2 - 0.5) * ch * 0.75 - i * ch * 0.06;
      const rx = cw * (0.42 + r1 * 0.3) * (0.7 + spread * 0.5);
      const ry = ch * (0.3 + r2 * 0.22);
      // тёмный низ
      washBlob(ctx, lx, ly + ry * 0.3, rx, ry, crownDeep, obj.seed + i * 7, { layers: 2, alpha: 0.4, edge: 0.14, wobble: 0.26 });
      // основной тон
      washBlob(ctx, lx, ly, rx * 0.96, ry * 0.94, crownMain, obj.seed + i * 13, { layers: 3, alpha: 0.4, edge: 0.16, wobble: 0.24 });
    }
    // Солнечный верх
    const sunX = tx - atm.sunDir.x * cw * 0.25 + sway;
    washBlob(ctx, sunX, ty - ch * 0.42, cw * 0.44, ch * 0.24, crownLight, obj.seed + 91, {
      layers: 2,
      alpha: 0.3,
      edge: 0,
      wobble: 0.28,
    });
    granulate(ctx, tx + sway, ty - ch * 0.15, cw * 0.5, ch * 0.4, crownDeep, obj.seed, Math.round(16 * scale) + 4, 0.1);

    // Цветение (сакура, азалия)
    if (style.blossom && (atm.season === 'spring' || (atm.season === 'summer' && style.blossom))) {
      const strength = atm.season === 'spring' ? 1 : 0.25;
      const bl = litc(style.blossom, atm, 0.05);
      const n = Math.round(10 * scale * strength) + 3;
      for (let i = 0; i < n; i++) {
        const r1 = hash2(i, obj.seed, 23);
        const r2 = hash2(i, obj.seed, 29);
        const px = tx + (r1 - 0.5) * cw * 1.15 + sway;
        const py = ty - ch * 0.2 + (r2 - 0.5) * ch * 0.95;
        ctx.fillStyle = css(bl, 0.55 + r1 * 0.3);
        blobPath(ctx, px, py, cw * 0.1 * (0.6 + r2 * 0.7), ch * 0.07 * (0.6 + r1 * 0.7), obj.seed + i, 0.35, 7);
        ctx.fill();
      }
    }

    // Ива: свисающие пряди
    if (style.droop) {
      const dropCol = litc(shade(main, 0.95), atm);
      for (let i = 0; i < Math.round(9 * scale) + 3; i++) {
        const r = hash2(i, obj.seed, 37);
        const sx = tx + (r - 0.5) * cw * 1.1 + sway;
        const sy = ty - ch * 0.1 + (hash2(i, obj.seed, 41) - 0.5) * ch * 0.4;
        const len = style.droop * scale * (0.6 + r * 0.8);
        const wob = Math.sin(d.time * 0.0007 + i) * 5 * d.wind;
        ctx.strokeStyle = css(dropCol, 0.5);
        ctx.lineWidth = 2.4;
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.quadraticCurveTo(sx + wob, sy + len * 0.6, sx + wob * 1.5 - 2, sy + len);
        ctx.stroke();
      }
    }
  };
}

const drawSakura = makeTree({
  trunk: { r: 122, g: 94, b: 82 },
  crownSpring: { r: 244, g: 196, b: 210 },
  crownSummer: { r: 138, g: 172, b: 116 },
  crownAutumn: { r: 206, g: 150, b: 104 },
  crownWinter: null,
  blossom: { r: 252, g: 226, b: 234 },
  height: 96,
  crownW: 98,
  crownH: 74,
  layers: 5,
});

const drawMaple = makeTree({
  trunk: { r: 108, g: 84, b: 74 },
  crownSpring: { r: 150, g: 186, b: 116 },
  crownSummer: { r: 110, g: 158, b: 96 },
  crownAutumn: { r: 208, g: 104, b: 66 },
  crownWinter: null,
  height: 92,
  crownW: 96,
  crownH: 72,
  layers: 5,
});

const drawGinkgo = makeTree({
  trunk: { r: 128, g: 106, b: 86 },
  crownSpring: { r: 164, g: 196, b: 122 },
  crownSummer: { r: 128, g: 172, b: 102 },
  crownAutumn: { r: 234, g: 194, b: 88 },
  crownWinter: null,
  height: 98,
  crownW: 82,
  crownH: 78,
  layers: 4,
});

const drawWillow = makeTree({
  trunk: { r: 116, g: 100, b: 80 },
  crownSpring: { r: 172, g: 200, b: 130 },
  crownSummer: { r: 140, g: 178, b: 110 },
  crownAutumn: { r: 198, g: 186, b: 116 },
  crownWinter: null,
  height: 94,
  crownW: 104,
  crownH: 58,
  layers: 4,
  droop: 46,
});

const drawPine: Drawer = (d) => {
  const { ctx, atm, g, obj } = d;
  const scale = lerp(0.2, 1, Math.pow(g, 0.7));
  const h = 106 * scale;
  const sway = Math.sin(d.time * 0.0003 + obj.seed) * 2 * d.wind * scale;
  shadowUnder(d, 40 * scale, 17 * scale, 0.9);

  const trunkCol = litc({ r: 108, g: 82, b: 66 }, atm);
  const { tx, ty } = drawTrunk(d, h, Math.max(2.4, 8 * scale), trunkCol, sway * 0.3);

  const needle = atm.season === 'winter' ? { r: 96, g: 124, b: 116 } : { r: 84, g: 130, b: 92 };
  const main = litc(needle, atm);
  const deep = litc(shade(needle, 0.78), atm);
  const light = litc(mix(needle, { r: 200, g: 226, b: 170 }, 0.3), atm, 0.03);

  // Ярусы «облаков» хвои — характерная японская сосна
  const tiers = 4;
  for (let i = 0; i < tiers; i++) {
    const t = i / (tiers - 1);
    const side = i % 2 === 0 ? -1 : 1;
    const cx = tx + side * (16 + 14 * (1 - t)) * scale + sway * (1 + t);
    const cy = ty + t * h * 0.62;
    const rx = (44 - t * 8) * scale;
    const ry = (17 + t * 4) * scale;
    // ветка к ярусу
    taperStroke(ctx, tx, cy + 4, cx, cy + 2, 3 * scale, 1.4 * scale, shade(trunkCol, 0.92), 0.8);
    washBlob(ctx, cx, cy + ry * 0.35, rx, ry, deep, obj.seed + i * 5, { layers: 2, alpha: 0.42, edge: 0.14, wobble: 0.3 });
    washBlob(ctx, cx, cy, rx * 0.95, ry * 0.9, main, obj.seed + i * 9, { layers: 3, alpha: 0.4, edge: 0.16, wobble: 0.28 });
    washBlob(ctx, cx - atm.sunDir.x * rx * 0.2, cy - ry * 0.4, rx * 0.5, ry * 0.4, light, obj.seed + i * 3, {
      layers: 1,
      alpha: 0.28,
      edge: 0,
    });
    if (atm.season === 'winter') {
      washBlob(ctx, cx, cy - ry * 0.5, rx * 0.7, ry * 0.3, litc({ r: 246, g: 247, b: 250 }, atm), obj.seed + i, {
        layers: 2,
        alpha: 0.45,
        edge: 0.08,
      });
    }
  }
  // верхушка
  washBlob(ctx, tx + sway, ty - 6 * scale, 22 * scale, 11 * scale, main, obj.seed + 77, { layers: 3, alpha: 0.42, edge: 0.16 });
};

const drawBamboo: Drawer = (d) => {
  const { ctx, atm, g, obj } = d;
  const scale = lerp(0.3, 1, Math.pow(g, 0.6));
  const stalks = 3;
  shadowUnder(d, 16 * scale, 7 * scale, 0.6);
  const stalkCol = litc(atm.season === 'winter' ? { r: 168, g: 176, b: 150 } : { r: 158, g: 186, b: 116 }, atm);
  const leafCol = litc(atm.season === 'winter' ? { r: 150, g: 164, b: 148 } : { r: 122, g: 164, b: 100 }, atm);
  for (let s = 0; s < stalks; s++) {
    const r = hash2(s, obj.seed, 13);
    const h = (82 + r * 54) * scale;
    const ox = (s - 1) * 7 * scale + (r - 0.5) * 5;
    const sway = Math.sin(d.time * 0.0008 + obj.seed + s * 1.7) * 5 * d.wind * scale;
    const x0 = d.x + ox;
    const x1 = x0 + sway;
    const y1 = d.y - h;
    taperStroke(ctx, x0, d.y, x1, y1, 3 * scale, 1.8 * scale, stalkCol, 0.95, sway * 0.5);
    // коленца
    ctx.strokeStyle = css(shade(stalkCol, 0.78), 0.5);
    ctx.lineWidth = 1.2;
    const segs = 5;
    for (let i = 1; i < segs; i++) {
      const t = i / segs;
      const px = lerp(x0, x1, t);
      const py = lerp(d.y, y1, t);
      ctx.beginPath();
      ctx.moveTo(px - 3.2 * scale, py);
      ctx.lineTo(px + 3.2 * scale, py);
      ctx.stroke();
    }
    // листья
    for (let i = 0; i < 5; i++) {
      const rr = hash2(i, obj.seed + s, 21);
      const t = 0.45 + (i / 5) * 0.55;
      const px = lerp(x0, x1, t);
      const py = lerp(d.y, y1, t);
      const dir = i % 2 === 0 ? 1 : -1;
      const ll = (14 + rr * 12) * scale;
      const lw = Math.sin(d.time * 0.001 + i) * 2 * d.wind;
      ctx.fillStyle = css(leafCol, 0.8);
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.quadraticCurveTo(px + dir * ll * 0.5, py - ll * 0.42 + lw, px + dir * ll, py - ll * 0.2 + lw);
      ctx.quadraticCurveTo(px + dir * ll * 0.5, py - ll * 0.1 + lw, px, py + 1.5);
      ctx.closePath();
      ctx.fill();
    }
  }
};

const drawShrub: Drawer = (d) => {
  const { ctx, atm, g, obj } = d;
  const scale = lerp(0.3, 1, Math.pow(g, 0.7));
  const isAzalea = d.obj.type === 'azalea';
  const rx = 33 * scale;
  const ry = 21 * scale;
  shadowUnder(d, rx * 0.9, ry * 0.5, 0.8);
  const base =
    atm.season === 'winter'
      ? { r: 168, g: 178, b: 172 }
      : atm.season === 'autumn'
        ? { r: 176, g: 156, b: 104 }
        : { r: 116, g: 160, b: 100 };
  const main = litc(base, atm);
  const deep = litc(shade(base, 0.8), atm);
  const sway = Math.sin(d.time * 0.0006 + obj.seed) * 2 * d.wind;
  washBlob(ctx, d.x + sway, d.y - ry * 0.55, rx, ry, deep, obj.seed, { layers: 2, alpha: 0.42, edge: 0.15, wobble: 0.22 });
  washBlob(ctx, d.x + sway, d.y - ry * 0.75, rx * 0.92, ry * 0.9, main, obj.seed + 7, { layers: 3, alpha: 0.4, edge: 0.16, wobble: 0.2 });
  washBlob(ctx, d.x - atm.sunDir.x * rx * 0.3 + sway, d.y - ry * 1.05, rx * 0.5, ry * 0.4, litc(mix(base, WHITE, 0.25), atm, 0.03), obj.seed + 3, {
    layers: 1,
    alpha: 0.3,
    edge: 0,
  });
  granulate(ctx, d.x, d.y - ry * 0.7, rx * 0.8, ry * 0.7, deep, obj.seed, 12, 0.1);
  if (isAzalea && (atm.season === 'spring' || atm.season === 'summer')) {
    const fl = litc(atm.season === 'spring' ? { r: 236, g: 138, b: 162 } : { r: 240, g: 196, b: 206 }, atm, 0.04);
    for (let i = 0; i < Math.round(11 * scale) + 2; i++) {
      const r1 = hash2(i, obj.seed, 31);
      const r2 = hash2(i, obj.seed, 43);
      ctx.fillStyle = css(fl, 0.75);
      const px = d.x + (r1 - 0.5) * rx * 1.7 + sway;
      const py = d.y - ry * 0.75 + (r2 - 0.5) * ry * 1.5;
      blobPath(ctx, px, py, 3.2 * scale + r1 * 2, 2.4 * scale + r2 * 1.6, obj.seed + i, 0.3, 6);
      ctx.fill();
    }
  }
};

// ---------------- Камни ----------------

function makeRock(sizeScale: number, count: number): Drawer {
  return (d) => {
    const { ctx, atm, obj } = d;
    shadowUnder(d, 22 * sizeScale, 10 * sizeScale, 1);
    const stone = atm.palette.stone;
    for (let i = 0; i < count; i++) {
      const r1 = hash2(i, obj.seed, 5);
      const r2 = hash2(i, obj.seed, 15);
      const ox = count === 1 ? 0 : (i - (count - 1) / 2) * 20 * sizeScale + (r1 - 0.5) * 8;
      const oy = count === 1 ? 0 : (r2 - 0.5) * 9 * sizeScale;
      const rx = (16 + r1 * 10) * sizeScale * (count > 1 ? 0.72 : 1);
      const ry = (11 + r2 * 7) * sizeScale * (count > 1 ? 0.72 : 1);
      const cx = d.x + ox;
      const cy = d.y + oy - ry * 0.6;

      const body = litc(mix(stone, { r: 150, g: 146, b: 140 }, r1 * 0.4), atm);
      const dark = litc(shade(stone, 0.62), atm);
      const light = litc(mix(stone, WHITE, 0.4), atm, 0.05);

      // тёмная нижняя часть
      washBlob(ctx, cx, cy + ry * 0.35, rx, ry * 0.9, dark, obj.seed + i * 3, { layers: 2, alpha: 0.5, edge: 0.2, wobble: 0.16 });
      // основной объём
      washBlob(ctx, cx, cy, rx * 0.97, ry, body, obj.seed + i * 11, { layers: 3, alpha: 0.5, edge: 0.24, wobble: 0.18 });
      // освещённая грань
      ctx.save();
      blobPath(ctx, cx, cy, rx * 0.95, ry * 0.98, obj.seed + i * 11, 0.18);
      ctx.clip();
      ctx.fillStyle = css(light, 0.42);
      blobPath(ctx, cx - atm.sunDir.x * rx * 0.35, cy - ry * 0.45, rx * 0.62, ry * 0.5, obj.seed + i + 2, 0.24);
      ctx.fill();
      // трещины
      ctx.strokeStyle = css(dark, 0.3);
      ctx.lineWidth = 1.1;
      for (let k = 0; k < 2; k++) {
        const t = hash2(k, obj.seed + i, 61);
        ctx.beginPath();
        ctx.moveTo(cx - rx * 0.5 + t * rx, cy - ry * 0.6);
        ctx.quadraticCurveTo(cx + (t - 0.5) * rx, cy, cx - rx * 0.3 + t * rx * 1.2, cy + ry * 0.7);
        ctx.stroke();
      }
      ctx.restore();
      granulate(ctx, cx, cy, rx * 0.8, ry * 0.8, dark, obj.seed + i, 10, 0.12);

      // мох на камне
      if (atm.season !== 'winter') {
        ctx.fillStyle = css(litc(atm.palette.moss, atm), 0.35);
        blobPath(ctx, cx + rx * 0.25, cy + ry * 0.35, rx * 0.34, ry * 0.26, obj.seed + i * 5, 0.35, 7);
        ctx.fill();
      } else {
        ctx.fillStyle = css(litc({ r: 246, g: 248, b: 250 }, atm), 0.6);
        blobPath(ctx, cx, cy - ry * 0.55, rx * 0.8, ry * 0.3, obj.seed + i * 5, 0.3, 8);
        ctx.fill();
      }
    }
  };
}

const drawStepStone: Drawer = (d) => {
  const { ctx, atm, obj } = d;
  const rx = 13;
  const ry = 7;
  softShadow(ctx, d.x + 1, d.y + 1, rx, ry * 0.8, atm.shadowTint, atm.shadowAmount * 1.1);
  const body = litc(mix(atm.palette.stone, { r: 160, g: 158, b: 152 }, 0.3), atm);
  washBlob(ctx, d.x, d.y, rx, ry, body, obj.seed, { layers: 2, alpha: 0.6, edge: 0.25, wobble: 0.16 });
  ctx.fillStyle = css(litc(mix(atm.palette.stone, WHITE, 0.3), atm), 0.3);
  blobPath(ctx, d.x - 2, d.y - 1.5, rx * 0.6, ry * 0.5, obj.seed + 2, 0.2, 7);
  ctx.fill();
};

// ---------------- Мелочи ----------------

const drawMossClump: Drawer = (d) => {
  const { ctx, atm, obj } = d;
  const c = litc(atm.season === 'winter' ? { r: 196, g: 204, b: 198 } : atm.palette.moss, atm);
  const deep = litc(shade(atm.palette.moss, 0.78), atm);
  washBlob(ctx, d.x, d.y, 15, 7.5, deep, obj.seed, { layers: 1, alpha: 0.4, edge: 0.1, wobble: 0.3 });
  washBlob(ctx, d.x, d.y - 1.5, 13, 6.5, c, obj.seed + 3, { layers: 2, alpha: 0.45, edge: 0.12, wobble: 0.32 });
  granulate(ctx, d.x, d.y - 1, 11, 5, deep, obj.seed, 10, 0.16);
};

const drawPebbles: Drawer = (d) => {
  const { ctx, atm, obj } = d;
  for (let i = 0; i < 6; i++) {
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

const drawGrassTuft: Drawer = (d) => {
  const { ctx, atm, obj } = d;
  const base =
    atm.season === 'winter' ? { r: 196, g: 200, b: 198 } : atm.season === 'autumn' ? { r: 188, g: 172, b: 112 } : atm.palette.grassDeep;
  const c = litc(base, atm);
  for (let i = 0; i < 9; i++) {
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

function makeFlower(petal: RGB, leaf: RGB, tall: boolean): Drawer {
  return (d) => {
    const { ctx, atm, obj, g } = d;
    const winter = atm.season === 'winter';
    const scale = lerp(0.4, 1, g) * (winter ? 0.7 : 1);
    const lc = litc(winter ? { r: 176, g: 186, b: 180 } : leaf, atm);
    const pc = litc(winter ? { r: 226, g: 230, b: 234 } : petal, atm, 0.04);
    const n = tall ? 5 : 7;
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
        blobPath(ctx, d.x + ox + sway, d.y - h - 1.5, 3 * scale + r, 2.4 * scale + r * 0.8, obj.seed + i, 0.3, 6);
        ctx.fill();
      }
    }
  };
}

const drawFern: Drawer = (d) => {
  const { ctx, atm, obj } = d;
  const base = atm.season === 'winter' ? { r: 168, g: 176, b: 168 } : atm.season === 'autumn' ? { r: 170, g: 152, b: 96 } : { r: 104, g: 146, b: 92 };
  const c = litc(base, atm);
  for (let i = 0; i < 7; i++) {
    const r = hash2(i, obj.seed, 23);
    const ang = (i / 7) * Math.PI - Math.PI / 2 + (r - 0.5) * 0.3;
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

// ---------------- Вода ----------------

const drawLilypad: Drawer = (d) => {
  const { ctx, atm, obj } = d;
  const bob = Math.sin(d.time * 0.0008 + obj.seed) * 1.5;
  for (let i = 0; i < 3; i++) {
    const r1 = hash2(i, obj.seed, 9);
    const r2 = hash2(i, obj.seed, 19);
    const px = d.x + (r1 - 0.5) * 22;
    const py = d.y + (r2 - 0.5) * 11 + bob;
    const rx = 8 + r1 * 5;
    const c = litc(mix({ r: 116, g: 156, b: 104 }, atm.palette.foliage, 0.4), atm);
    ctx.fillStyle = css(shade(c, 0.7), 0.3);
    ctx.beginPath();
    ctx.ellipse(px, py + 2, rx, rx * 0.55, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = css(c, 0.9);
    ctx.beginPath();
    ctx.ellipse(px, py, rx, rx * 0.55, 0, 0.35, Math.PI * 2 - 0.35);
    ctx.lineTo(px, py);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = css(shade(c, 0.78), 0.4);
    ctx.lineWidth = 0.8;
    for (let k = 0; k < 4; k++) {
      const a = 0.6 + k * 1.2;
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(px + Math.cos(a) * rx * 0.9, py + Math.sin(a) * rx * 0.5);
      ctx.stroke();
    }
  }
};

const drawLotus: Drawer = (d) => {
  const { ctx, atm, obj, g } = d;
  const bob = Math.sin(d.time * 0.0007 + obj.seed) * 1.5;
  const open = clamp01(atm.time.daylight * 1.4);
  const scale = lerp(0.5, 1, g);
  const px = d.x;
  const py = d.y + bob;
  // лист
  const leaf = litc({ r: 108, g: 148, b: 100 }, atm);
  ctx.fillStyle = css(leaf, 0.85);
  ctx.beginPath();
  ctx.ellipse(px - 10, py + 3, 10 * scale, 5.5 * scale, 0, 0, Math.PI * 2);
  ctx.fill();
  // стебель
  ctx.strokeStyle = css(litc({ r: 120, g: 154, b: 104 }, atm), 0.8);
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(px, py + 2);
  ctx.lineTo(px + 1, py - 12 * scale);
  ctx.stroke();
  // цветок
  const petal = litc({ r: 248, g: 204, b: 216 }, atm, 0.05);
  const petalDeep = litc({ r: 236, g: 166, b: 190 }, atm);
  const cy = py - 13 * scale;
  const n = 7;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const spread = lerp(0.3, 1.1, open);
    const ex = px + Math.cos(a) * 6 * scale * spread;
    const ey = cy + Math.sin(a) * 3.4 * scale * spread - 2;
    ctx.fillStyle = css(i % 2 === 0 ? petal : petalDeep, 0.9);
    ctx.save();
    ctx.translate(ex, ey);
    ctx.rotate(a);
    ctx.beginPath();
    ctx.ellipse(0, 0, 5.5 * scale, 2.6 * scale, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  ctx.fillStyle = css(litc({ r: 246, g: 226, b: 160 }, atm), 0.95);
  ctx.beginPath();
  ctx.arc(px, cy - 2, 2.4 * scale, 0, Math.PI * 2);
  ctx.fill();
};

const drawKoi: Drawer = (d) => {
  const { ctx, atm, obj } = d;
  const t = d.time * 0.00035 + obj.seed;
  for (let i = 0; i < 2; i++) {
    const ph = t + i * Math.PI;
    const rx = 26;
    const ry = 13;
    const px = d.x + Math.cos(ph) * rx;
    const py = d.y + Math.sin(ph) * ry;
    const ang = Math.atan2(Math.cos(ph) * ry, -Math.sin(ph) * rx);
    const body = i === 0 ? { r: 240, g: 136, b: 86 } : { r: 248, g: 244, b: 238 };
    const c = litc(body, atm);
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(ang);
    // тень в глубине
    ctx.fillStyle = css(shade(atm.palette.waterDeep, 0.8), 0.25);
    ctx.beginPath();
    ctx.ellipse(1, 2, 9, 3.6, 0, 0, Math.PI * 2);
    ctx.fill();
    // тело
    ctx.fillStyle = css(c, 0.8);
    ctx.beginPath();
    ctx.ellipse(0, 0, 8.5, 3.4, 0, 0, Math.PI * 2);
    ctx.fill();
    // хвост
    const wag = Math.sin(d.time * 0.006 + i) * 0.5;
    ctx.beginPath();
    ctx.moveTo(-7, 0);
    ctx.quadraticCurveTo(-11, -3 + wag * 2, -14, -4 + wag * 3);
    ctx.quadraticCurveTo(-11, 0, -14, 4 + wag * 3);
    ctx.quadraticCurveTo(-11, 3 + wag * 2, -7, 0);
    ctx.fillStyle = css(c, 0.5);
    ctx.fill();
    // пятно
    if (i === 0) {
      ctx.fillStyle = css(litc({ r: 250, g: 250, b: 246 }, atm), 0.7);
      ctx.beginPath();
      ctx.ellipse(2, -0.5, 3, 1.6, 0, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillStyle = css(litc({ r: 234, g: 120, b: 90 }, atm), 0.65);
      ctx.beginPath();
      ctx.ellipse(1.5, 0, 2.6, 1.5, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
};

// ---------------- Постройки ----------------

const drawBridge: Drawer = (d) => {
  const { ctx, atm, obj } = d;
  const wood = litc({ r: 164, g: 106, b: 76 }, atm);
  const woodDark = litc({ r: 118, g: 74, b: 56 }, atm);
  const rot = obj.rot % 2;
  const dx = rot === 0 ? TILE_W / 2 : -TILE_W / 2;
  const dy = TILE_H / 2;

  ctx.save();
  ctx.translate(d.x, d.y);
  const ax = -dx * 1.5;
  const ay = -dy * 1.5;
  const bx = dx * 1.5;
  const by = dy * 1.5;
  const arch = -26;

  // тень на воде
  ctx.fillStyle = css(atm.shadowTint, atm.shadowAmount * 0.9);
  ctx.beginPath();
  ctx.moveTo(ax, ay + 6);
  ctx.quadraticCurveTo(0, arch * 0.4 + 10, bx, by + 6);
  ctx.lineTo(bx, by + 14);
  ctx.quadraticCurveTo(0, arch * 0.4 + 20, ax, ay + 14);
  ctx.closePath();
  ctx.fill();

  // настил
  const w = 13;
  ctx.beginPath();
  ctx.moveTo(ax - w * 0.4, ay - w * 0.4);
  ctx.quadraticCurveTo(0, arch - w * 0.4, bx - w * 0.4, by - w * 0.4);
  ctx.lineTo(bx + w * 0.4, by + w * 0.4);
  ctx.quadraticCurveTo(0, arch + w * 0.4, ax + w * 0.4, ay + w * 0.4);
  ctx.closePath();
  ctx.fillStyle = css(wood, 0.96);
  ctx.fill();
  ctx.strokeStyle = css(woodDark, 0.5);
  ctx.lineWidth = 1.4;
  ctx.stroke();

  // доски
  for (let i = 1; i < 12; i++) {
    const t = i / 12;
    const px = lerp(ax, bx, t);
    const py = lerp(ay, by, t) + Math.sin(t * Math.PI) * arch;
    ctx.strokeStyle = css(shade(wood, 0.82 + hash2(i, obj.seed, 3) * 0.25), 0.5);
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(px - w * 0.4, py - w * 0.4);
    ctx.lineTo(px + w * 0.4, py + w * 0.4);
    ctx.stroke();
  }

  // перила
  for (const side of [-1, 1]) {
    ctx.strokeStyle = css(woodDark, 0.85);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(ax + side * w * 0.45, ay + side * w * 0.45 - 12);
    ctx.quadraticCurveTo(side * 2, arch - 12, bx + side * w * 0.45, by + side * w * 0.45 - 12);
    ctx.stroke();
    for (let i = 0; i <= 3; i++) {
      const t = i / 3;
      const px = lerp(ax, bx, t) + side * w * 0.45;
      const py = lerp(ay, by, t) + side * w * 0.45 + Math.sin(t * Math.PI) * arch;
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(px, py - 12);
      ctx.stroke();
    }
  }
  ctx.restore();
};

function lanternLight(d: DrawCtx, x: number, y: number, radius: number, warm: RGB): void {
  const strength = d.atm.lampGlow;
  if (strength < 0.02) return;
  const flicker = 0.9 + Math.sin(d.time * 0.004 + d.obj.seed) * 0.06 + Math.sin(d.time * 0.011 + d.obj.seed * 2) * 0.04;
  d.ctx.save();
  d.ctx.globalCompositeOperation = 'lighter';
  glow(d.ctx, x, y, radius * flicker, warm, strength * 0.85);
  d.ctx.restore();
}

const drawStoneLantern: Drawer = (d) => {
  const { ctx, atm, obj } = d;
  shadowUnder(d, 15, 7, 1);
  const st = litc(mix(atm.palette.stone, { r: 168, g: 164, b: 154 }, 0.4), atm);
  const dk = litc(shade(atm.palette.stone, 0.6), atm);
  const x = d.x;
  let y = d.y;
  // основание
  ctx.fillStyle = css(dk, 0.9);
  ctx.beginPath();
  ctx.ellipse(x, y - 2, 13, 5.5, 0, 0, Math.PI * 2);
  ctx.fill();
  // ножка
  y -= 4;
  ctx.fillStyle = css(st, 0.95);
  ctx.fillRect(x - 4.5, y - 16, 9, 16);
  // чаша
  y -= 16;
  ctx.beginPath();
  ctx.ellipse(x, y, 11, 4.5, 0, 0, Math.PI * 2);
  ctx.fill();
  // корпус с окошком
  y -= 3;
  ctx.fillStyle = css(st, 0.96);
  ctx.beginPath();
  ctx.moveTo(x - 8, y);
  ctx.lineTo(x + 8, y);
  ctx.lineTo(x + 6.5, y - 14);
  ctx.lineTo(x - 6.5, y - 14);
  ctx.closePath();
  ctx.fill();
  // огонь
  const lightY = y - 7;
  const warm: RGB = { r: 255, g: 206, b: 130 };
  ctx.fillStyle = css(atm.lampGlow > 0.05 ? mix({ r: 255, g: 228, b: 168 }, warm, 0.4) : shade(st, 0.7), 0.95);
  ctx.beginPath();
  ctx.ellipse(x, lightY, 3.6, 5, 0, 0, Math.PI * 2);
  ctx.fill();
  // крыша
  y -= 14;
  ctx.fillStyle = css(shade(st, 0.88), 0.96);
  ctx.beginPath();
  ctx.moveTo(x - 13, y + 1);
  ctx.quadraticCurveTo(x - 8, y - 7, x, y - 9);
  ctx.quadraticCurveTo(x + 8, y - 7, x + 13, y + 1);
  ctx.quadraticCurveTo(x, y + 5, x - 13, y + 1);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = css(dk, 0.35);
  ctx.lineWidth = 1;
  ctx.stroke();
  // навершие
  ctx.fillStyle = css(st, 0.95);
  ctx.beginPath();
  ctx.arc(x, y - 11, 2.6, 0, Math.PI * 2);
  ctx.fill();
  granulate(ctx, x, d.y - 26, 10, 18, dk, obj.seed, 10, 0.08);
  lanternLight(d, x, lightY, 78, warm);
};

const drawPaperLantern: Drawer = (d) => {
  const { ctx, atm, obj } = d;
  const swing = Math.sin(d.time * 0.0012 + obj.seed) * 4 * (0.4 + d.wind * 0.6);
  const topY = d.y - 62;
  const x = d.x + swing;
  const y = d.y - 34;
  // шнур
  ctx.strokeStyle = css(litc({ r: 110, g: 84, b: 68 }, atm), 0.8);
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(d.x, topY);
  ctx.quadraticCurveTo(d.x + swing * 0.5, (topY + y) / 2, x, y - 13);
  ctx.stroke();
  // корпус
  const on = atm.lampGlow;
  const paper = litc(mix({ r: 246, g: 228, b: 196 }, { r: 255, g: 212, b: 150 }, on * 0.6), atm, on * 0.25);
  ctx.fillStyle = css(paper, 0.95);
  ctx.beginPath();
  ctx.ellipse(x, y, 11, 14, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = css(litc({ r: 180, g: 100, b: 78 }, atm), 0.45);
  ctx.lineWidth = 0.9;
  for (let i = -2; i <= 2; i++) {
    ctx.beginPath();
    ctx.ellipse(x, y + i * 4.4, 11 * Math.sqrt(1 - Math.pow((i * 4.4) / 14, 2)), 1.6, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.fillStyle = css(litc({ r: 120, g: 84, b: 70 }, atm), 0.85);
  ctx.fillRect(x - 3.5, y - 15, 7, 2.6);
  ctx.fillRect(x - 3, y + 13, 6, 2.4);
  lanternLight(d, x, y, 64, { r: 255, g: 194, b: 136 });
};

const drawPathLight: Drawer = (d) => {
  const { ctx, atm } = d;
  const x = d.x;
  const y = d.y;
  softShadow(ctx, x, y + 1, 7, 3, atm.shadowTint, atm.shadowAmount);
  const st = litc(atm.palette.stone, atm);
  ctx.fillStyle = css(st, 0.95);
  ctx.beginPath();
  ctx.moveTo(x - 4, y);
  ctx.lineTo(x + 4, y);
  ctx.lineTo(x + 3, y - 9);
  ctx.lineTo(x - 3, y - 9);
  ctx.closePath();
  ctx.fill();
  const warm: RGB = { r: 255, g: 208, b: 140 };
  ctx.fillStyle = css(atm.lampGlow > 0.05 ? warm : shade(st, 0.8), 0.95);
  ctx.beginPath();
  ctx.ellipse(x, y - 11, 4.5, 3, 0, 0, Math.PI * 2);
  ctx.fill();
  lanternLight(d, x, y - 11, 46, warm);
};

const drawBrazier: Drawer = (d) => {
  const { ctx, atm, obj } = d;
  shadowUnder(d, 13, 6, 1);
  const iron = litc({ r: 82, g: 72, b: 66 }, atm);
  ctx.fillStyle = css(iron, 0.95);
  ctx.beginPath();
  ctx.moveTo(d.x - 11, d.y - 14);
  ctx.lineTo(d.x + 11, d.y - 14);
  ctx.lineTo(d.x + 7, d.y - 2);
  ctx.lineTo(d.x - 7, d.y - 2);
  ctx.closePath();
  ctx.fill();
  for (const s of [-1, 1]) {
    ctx.strokeStyle = css(iron, 0.9);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(d.x + s * 7, d.y - 3);
    ctx.lineTo(d.x + s * 9, d.y);
    ctx.stroke();
  }
  // пламя
  const fl = 0.7 + Math.sin(d.time * 0.008 + obj.seed) * 0.2 + Math.sin(d.time * 0.019) * 0.1;
  const hot: RGB = { r: 255, g: 186, b: 92 };
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 3; i++) {
    const h = (12 + i * 5) * fl;
    ctx.fillStyle = css(i === 0 ? { r: 255, g: 236, b: 190 } : hot, 0.55 - i * 0.14);
    ctx.beginPath();
    ctx.moveTo(d.x - 5 + i, d.y - 14);
    ctx.quadraticCurveTo(d.x - 2, d.y - 14 - h * 0.7, d.x + Math.sin(d.time * 0.005 + i) * 3, d.y - 14 - h);
    ctx.quadraticCurveTo(d.x + 3, d.y - 14 - h * 0.6, d.x + 5 - i, d.y - 14);
    ctx.closePath();
    ctx.fill();
  }
  glow(ctx, d.x, d.y - 20, 86, hot, 0.35 + atm.lampGlow * 0.6);
  ctx.restore();
};

const drawPavilion: Drawer = (d) => {
  const { ctx, atm, obj } = d;
  const w = TILE_W * 0.95;
  const postH = 46;
  const wood = litc({ r: 148, g: 98, b: 70 }, atm);
  const woodDark = litc({ r: 104, g: 66, b: 50 }, atm);
  const roof = litc({ r: 92, g: 84, b: 88 }, atm);
  const roofLight = litc(mix({ r: 128, g: 120, b: 124 }, WHITE, 0.15), atm);

  softShadow(ctx, d.x + 8, d.y + 4, w * 0.62, w * 0.28, atm.shadowTint, atm.shadowAmount * 1.7);

  // платформа
  ctx.fillStyle = css(litc({ r: 172, g: 132, b: 92 }, atm), 0.95);
  ctx.beginPath();
  ctx.moveTo(d.x, d.y - TILE_H * 0.5);
  ctx.lineTo(d.x + w * 0.5, d.y);
  ctx.lineTo(d.x, d.y + TILE_H * 0.5);
  ctx.lineTo(d.x - w * 0.5, d.y);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = css(woodDark, 0.4);
  ctx.lineWidth = 1.4;
  ctx.stroke();

  // столбы
  const posts: [number, number][] = [
    [-w * 0.42, 0],
    [w * 0.42, 0],
    [0, -TILE_H * 0.42],
    [0, TILE_H * 0.42],
  ];
  for (const [ox, oy] of posts) {
    ctx.fillStyle = css(oy > 0 ? wood : shade(wood, 0.9), 0.96);
    ctx.fillRect(d.x + ox - 3, d.y + oy - postH, 6, postH);
  }

  // крыша
  const ry = d.y - postH - 4;
  ctx.fillStyle = css(roof, 0.96);
  ctx.beginPath();
  ctx.moveTo(d.x, ry - 26);
  ctx.quadraticCurveTo(d.x + w * 0.42, ry - 14, d.x + w * 0.72, ry + 4);
  ctx.quadraticCurveTo(d.x + w * 0.3, ry + 16, d.x, ry + 20);
  ctx.quadraticCurveTo(d.x - w * 0.3, ry + 16, d.x - w * 0.72, ry + 4);
  ctx.quadraticCurveTo(d.x - w * 0.42, ry - 14, d.x, ry - 26);
  ctx.closePath();
  ctx.fill();
  // блик на скате
  ctx.fillStyle = css(roofLight, 0.3);
  ctx.beginPath();
  ctx.moveTo(d.x, ry - 24);
  ctx.quadraticCurveTo(d.x - w * 0.36, ry - 12, d.x - w * 0.66, ry + 3);
  ctx.quadraticCurveTo(d.x - w * 0.3, ry + 4, d.x, ry - 4);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = css(shade(roof, 0.7), 0.5);
  ctx.lineWidth = 1.6;
  ctx.stroke();
  // конёк
  ctx.fillStyle = css(shade(roof, 0.8), 0.9);
  ctx.beginPath();
  ctx.ellipse(d.x, ry - 26, 5, 3.5, 0, 0, Math.PI * 2);
  ctx.fill();
  granulate(ctx, d.x, ry, w * 0.5, 18, shade(roof, 0.7), obj.seed, 16, 0.08);
};

const drawTorii: Drawer = (d) => {
  const { ctx, atm } = d;
  shadowUnder(d, 22, 8, 1);
  const red = litc({ r: 196, g: 84, b: 68 }, atm);
  const redDark = litc({ r: 150, g: 60, b: 52 }, atm);
  const h = 54;
  const w = 20;
  ctx.fillStyle = css(red, 0.96);
  ctx.fillRect(d.x - w - 2, d.y - h, 5.5, h);
  ctx.fillRect(d.x + w - 3, d.y - h, 5.5, h);
  // нижняя перекладина
  ctx.fillStyle = css(redDark, 0.95);
  ctx.fillRect(d.x - w - 5, d.y - h * 0.76, (w + 5) * 2, 4);
  // верхняя дуга
  ctx.fillStyle = css(red, 0.97);
  ctx.beginPath();
  ctx.moveTo(d.x - w - 11, d.y - h + 2);
  ctx.quadraticCurveTo(d.x, d.y - h - 9, d.x + w + 11, d.y - h + 2);
  ctx.quadraticCurveTo(d.x, d.y - h - 1, d.x - w - 11, d.y - h + 2);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = css(redDark, 0.95);
  ctx.fillRect(d.x - w - 6, d.y - h + 3, (w + 6) * 2, 3.5);
};

const drawShoji: Drawer = (d) => {
  const { ctx, atm, obj } = d;
  const horiz = obj.rot % 2 === 0;
  const w = horiz ? TILE_W * 0.5 : TILE_W * 0.5;
  const h = 44;
  const frame = litc({ r: 118, g: 86, b: 66 }, atm);
  const paper = litc(mix({ r: 246, g: 240, b: 224 }, { r: 255, g: 220, b: 168 }, atm.lampGlow * 0.5), atm, atm.lampGlow * 0.15);
  const dx = horiz ? w * 0.5 : -w * 0.5;
  const dy = TILE_H * 0.25;
  ctx.save();
  ctx.translate(d.x, d.y);
  ctx.beginPath();
  ctx.moveTo(-dx, -dy);
  ctx.lineTo(dx, dy);
  ctx.lineTo(dx, dy - h);
  ctx.lineTo(-dx, -dy - h);
  ctx.closePath();
  ctx.fillStyle = css(paper, 0.94);
  ctx.fill();
  ctx.strokeStyle = css(frame, 0.85);
  ctx.lineWidth = 2.4;
  ctx.stroke();
  ctx.lineWidth = 1;
  ctx.strokeStyle = css(frame, 0.55);
  for (let i = 1; i < 3; i++) {
    const t = i / 3;
    ctx.beginPath();
    ctx.moveTo(lerp(-dx, dx, t), lerp(-dy, dy, t));
    ctx.lineTo(lerp(-dx, dx, t), lerp(-dy, dy, t) - h);
    ctx.stroke();
  }
  for (let i = 1; i < 3; i++) {
    const yy = -h * (i / 3);
    ctx.beginPath();
    ctx.moveTo(-dx, -dy + yy);
    ctx.lineTo(dx, dy + yy);
    ctx.stroke();
  }
  ctx.restore();
};

const drawTable: Drawer = (d) => {
  const { ctx, atm } = d;
  shadowUnder(d, 17, 7, 0.9);
  const wood = litc({ r: 140, g: 96, b: 68 }, atm);
  const top = litc({ r: 166, g: 118, b: 84 }, atm);
  ctx.fillStyle = css(wood, 0.95);
  for (const ox of [-11, 11]) ctx.fillRect(d.x + ox - 1.5, d.y - 11, 3, 11);
  ctx.fillStyle = css(top, 0.96);
  ctx.beginPath();
  ctx.moveTo(d.x, d.y - 18);
  ctx.lineTo(d.x + 18, d.y - 11);
  ctx.lineTo(d.x, d.y - 4);
  ctx.lineTo(d.x - 18, d.y - 11);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = css(shade(wood, 0.8), 0.5);
  ctx.lineWidth = 1.2;
  ctx.stroke();
  // чашка
  ctx.fillStyle = css(litc({ r: 244, g: 240, b: 230 }, atm), 0.96);
  ctx.beginPath();
  ctx.ellipse(d.x + 3, d.y - 12, 3.4, 2.2, 0, 0, Math.PI * 2);
  ctx.fill();
  // пар
  const steam = clamp01(0.4 + Math.sin(d.time * 0.002) * 0.3);
  ctx.strokeStyle = css({ r: 255, g: 255, b: 255 }, 0.18 * steam);
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(d.x + 3, d.y - 15);
  ctx.quadraticCurveTo(d.x + 6, d.y - 21, d.x + 3, d.y - 26);
  ctx.stroke();
};

const drawCushion: Drawer = (d) => {
  const { ctx, atm, obj } = d;
  softShadow(ctx, d.x, d.y + 1, 15, 6, atm.shadowTint, atm.shadowAmount);
  const hue = hash2(obj.seed, 1, 3);
  const col = litc(hue > 0.6 ? { r: 176, g: 96, b: 96 } : hue > 0.3 ? { r: 96, g: 114, b: 146 } : { r: 156, g: 140, b: 108 }, atm);
  ctx.fillStyle = css(col, 0.95);
  ctx.beginPath();
  ctx.ellipse(d.x, d.y - 3, 15, 7.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = css(shade(col, 0.75), 0.5);
  ctx.lineWidth = 1.2;
  ctx.stroke();
  ctx.fillStyle = css(mix(col, WHITE, 0.25), 0.4);
  ctx.beginPath();
  ctx.ellipse(d.x - 3, d.y - 5, 8, 3.4, 0, 0, Math.PI * 2);
  ctx.fill();
};

const drawTsukubai: Drawer = (d) => {
  const { ctx, atm, obj } = d;
  shadowUnder(d, 14, 6, 1);
  const st = litc(mix(atm.palette.stone, { r: 150, g: 148, b: 142 }, 0.4), atm);
  washBlob(ctx, d.x, d.y - 7, 14, 9, st, obj.seed, { layers: 3, alpha: 0.55, edge: 0.25, wobble: 0.16 });
  // вода в чаше
  const w = litc(atm.palette.water, atm, 0.05);
  ctx.fillStyle = css(w, 0.9);
  ctx.beginPath();
  ctx.ellipse(d.x, d.y - 11, 7.5, 3.6, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = css(mix(w, WHITE, 0.6), 0.5);
  ctx.lineWidth = 1;
  const rip = (Math.sin(d.time * 0.0015 + obj.seed) * 0.5 + 0.5) * 6;
  ctx.beginPath();
  ctx.ellipse(d.x, d.y - 11, 2 + rip, 1 + rip * 0.45, 0, 0, Math.PI * 2);
  ctx.stroke();
  // бамбуковая трубка
  const bam = litc({ r: 168, g: 176, b: 122 }, atm);
  ctx.strokeStyle = css(bam, 0.95);
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(d.x - 16, d.y - 30);
  ctx.lineTo(d.x - 16, d.y - 16);
  ctx.stroke();
  ctx.lineWidth = 3.4;
  ctx.beginPath();
  ctx.moveTo(d.x - 16, d.y - 30);
  ctx.lineTo(d.x - 6, d.y - 30);
  ctx.stroke();
  // струйка
  ctx.strokeStyle = css(mix(w, WHITE, 0.5), 0.45);
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(d.x - 6, d.y - 29);
  ctx.quadraticCurveTo(d.x - 4, d.y - 20, d.x - 2, d.y - 13);
  ctx.stroke();
};

const drawShishi: Drawer = (d) => {
  const { ctx, atm, obj } = d;
  shadowUnder(d, 13, 6, 0.9);
  const bam = litc({ r: 172, g: 178, b: 124 }, atm);
  const bamDark = litc({ r: 126, g: 134, b: 90 }, atm);
  // стойка
  ctx.strokeStyle = css(bamDark, 0.95);
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(d.x + 6, d.y);
  ctx.lineTo(d.x + 6, d.y - 26);
  ctx.stroke();
  // коромысло — качается
  const cycle = (d.time * 0.00035 + obj.seed) % 1;
  const tip = cycle < 0.75 ? lerp(-0.25, 0.25, cycle / 0.75) : lerp(0.25, -0.25, (cycle - 0.75) / 0.25);
  ctx.save();
  ctx.translate(d.x + 6, d.y - 26);
  ctx.rotate(tip);
  ctx.strokeStyle = css(bam, 0.96);
  ctx.lineWidth = 6;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-16, 2);
  ctx.lineTo(10, -2);
  ctx.stroke();
  ctx.strokeStyle = css(bamDark, 0.5);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(-4, 1);
  ctx.lineTo(-4, -3);
  ctx.stroke();
  ctx.restore();
  ctx.lineCap = 'butt';
  // вода
  if (tip > 0.1) {
    ctx.strokeStyle = css(mix(litc(atm.palette.water, atm), WHITE, 0.5), 0.4);
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(d.x - 10, d.y - 28);
    ctx.quadraticCurveTo(d.x - 9, d.y - 18, d.x - 8, d.y - 6);
    ctx.stroke();
  }
};

const drawWindChime: Drawer = (d) => {
  const { ctx, atm, obj } = d;
  const swing = Math.sin(d.time * 0.0016 + obj.seed) * 5 * (0.3 + d.wind * 0.7);
  const x = d.x + swing;
  const y = d.y - 30;
  ctx.strokeStyle = css(litc({ r: 120, g: 96, b: 74 }, atm), 0.7);
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(d.x, d.y - 52);
  ctx.quadraticCurveTo(d.x + swing * 0.5, y - 10, x, y - 6);
  ctx.stroke();
  const glass = litc({ r: 226, g: 240, b: 242 }, atm, 0.08);
  ctx.fillStyle = css(glass, 0.8);
  ctx.beginPath();
  ctx.arc(x, y, 7, Math.PI, Math.PI * 2);
  ctx.ellipse(x, y, 7, 5, 0, 0, Math.PI);
  ctx.fill();
  ctx.strokeStyle = css(litc({ r: 140, g: 170, b: 190 }, atm), 0.5);
  ctx.lineWidth = 1;
  ctx.stroke();
  // бумажка-язычок
  ctx.fillStyle = css(litc({ r: 248, g: 244, b: 230 }, atm), 0.9);
  ctx.beginPath();
  ctx.moveTo(x - 2.5, y + 6);
  ctx.lineTo(x + 2.5, y + 6);
  ctx.lineTo(x + 2 + swing * 0.3, y + 18);
  ctx.lineTo(x - 2 + swing * 0.3, y + 18);
  ctx.closePath();
  ctx.fill();
};

const drawBowl: Drawer = (d) => {
  const { ctx, atm } = d;
  softShadow(ctx, d.x, d.y, 8, 3.5, atm.shadowTint, atm.shadowAmount);
  const c = litc({ r: 206, g: 180, b: 150 }, atm);
  ctx.fillStyle = css(c, 0.95);
  ctx.beginPath();
  ctx.ellipse(d.x, d.y - 2, 7.5, 4, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = css(shade(c, 0.7), 0.6);
  ctx.beginPath();
  ctx.ellipse(d.x, d.y - 3, 5.4, 2.6, 0, 0, Math.PI * 2);
  ctx.fill();
};

const drawCat: Drawer = (d) => {
  const { ctx, atm, obj } = d;
  // Кот дремлет, дышит и изредка водит хвостом.
  const breathe = Math.sin(d.time * 0.0014 + obj.seed) * 0.8;
  const tail = Math.sin(d.time * 0.0009 + obj.seed * 1.7);
  softShadow(ctx, d.x + 2, d.y, 20, 7, atm.shadowTint, atm.shadowAmount * 1.3);
  const fur = litc({ r: 246, g: 238, b: 226 }, atm);
  const furDark = litc({ r: 208, g: 190, b: 172 }, atm);
  const patch = litc({ r: 180, g: 130, b: 92 }, atm);

  // хвост
  ctx.strokeStyle = css(furDark, 0.95);
  ctx.lineWidth = 4.5;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(d.x + 13, d.y - 5);
  ctx.quadraticCurveTo(d.x + 24, d.y - 4 + tail * 3, d.x + 26 + tail * 3, d.y - 12 + tail * 2);
  ctx.stroke();
  ctx.lineCap = 'butt';

  // тело
  ctx.fillStyle = css(fur, 0.97);
  ctx.beginPath();
  ctx.ellipse(d.x + 2, d.y - 8 + breathe * 0.3, 15, 8 + breathe * 0.4, -0.08, 0, Math.PI * 2);
  ctx.fill();
  // пятно
  ctx.fillStyle = css(patch, 0.55);
  ctx.beginPath();
  ctx.ellipse(d.x + 6, d.y - 10, 7, 4, -0.2, 0, Math.PI * 2);
  ctx.fill();
  // голова
  const hx = d.x - 12;
  const hy = d.y - 13;
  ctx.fillStyle = css(fur, 0.98);
  ctx.beginPath();
  ctx.ellipse(hx, hy, 8, 7, 0, 0, Math.PI * 2);
  ctx.fill();
  // уши
  ctx.beginPath();
  ctx.moveTo(hx - 7, hy - 4);
  ctx.lineTo(hx - 4.5, hy - 11);
  ctx.lineTo(hx - 1.5, hy - 5.5);
  ctx.closePath();
  ctx.moveTo(hx + 2, hy - 5.5);
  ctx.lineTo(hx + 5, hy - 11);
  ctx.lineTo(hx + 7, hy - 4);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = css(litc({ r: 234, g: 186, b: 186 }, atm), 0.8);
  ctx.beginPath();
  ctx.moveTo(hx - 5.6, hy - 5);
  ctx.lineTo(hx - 4.4, hy - 9);
  ctx.lineTo(hx - 3, hy - 5.6);
  ctx.closePath();
  ctx.fill();
  // закрытые глаза
  ctx.strokeStyle = css(litc({ r: 110, g: 94, b: 84 }, atm), 0.85);
  ctx.lineWidth = 1.3;
  for (const ox of [-3.6, 2.4]) {
    ctx.beginPath();
    ctx.arc(hx + ox, hy - 0.5, 2, 0.25, Math.PI - 0.25);
    ctx.stroke();
  }
  // носик
  ctx.fillStyle = css(litc({ r: 226, g: 160, b: 160 }, atm), 0.9);
  ctx.beginPath();
  ctx.moveTo(hx - 1.4, hy + 2.6);
  ctx.lineTo(hx + 1.4, hy + 2.6);
  ctx.lineTo(hx, hy + 4.2);
  ctx.closePath();
  ctx.fill();
  // усы
  ctx.strokeStyle = css(litc({ r: 200, g: 190, b: 180 }, atm), 0.5);
  ctx.lineWidth = 0.8;
  for (let i = -1; i <= 1; i++) {
    ctx.beginPath();
    ctx.moveTo(hx - 2, hy + 3);
    ctx.lineTo(hx - 12, hy + 1 + i * 2.6);
    ctx.stroke();
  }
  // лапки
  ctx.fillStyle = css(fur, 0.95);
  ctx.beginPath();
  ctx.ellipse(hx + 6, d.y - 3, 5, 2.6, 0, 0, Math.PI * 2);
  ctx.fill();

  // сон: «zzz» ночью
  if (atm.time.daylight < 0.4) {
    const t = (d.time * 0.0006 + obj.seed) % 1;
    ctx.fillStyle = css(litc({ r: 250, g: 250, b: 246 }, atm), 0.3 * (1 - t));
    ctx.font = 'italic 11px Georgia, serif';
    ctx.fillText('z', hx + 6, hy - 14 - t * 12);
  }
};

// ---------------- Реестр ----------------

const DRAWERS: Record<string, Drawer> = {
  sakura: drawSakura,
  maple: drawMaple,
  pine: drawPine,
  bamboo: drawBamboo,
  willow: drawWillow,
  ginkgo: drawGinkgo,
  azalea: drawShrub,
  hedge: drawShrub,
  rock_big: makeRock(1.55, 1),
  rock_mid: makeRock(0.95, 1),
  rock_trio: makeRock(0.85, 3),
  step_stone: drawStepStone,
  moss_clump: drawMossClump,
  pebbles: drawPebbles,
  grass_tuft: drawGrassTuft,
  lily: makeFlower({ r: 250, g: 250, b: 244 }, { r: 112, g: 152, b: 96 }, false),
  iris: makeFlower({ r: 148, g: 122, b: 196 }, { r: 106, g: 148, b: 96 }, true),
  fern: drawFern,
  lotus: drawLotus,
  lilypad: drawLilypad,
  koi: drawKoi,
  bridge: drawBridge,
  lantern_stone: drawStoneLantern,
  lantern_paper: drawPaperLantern,
  lantern_path: drawPathLight,
  brazier: drawBrazier,
  pavilion: drawPavilion,
  torii: drawTorii,
  shoji: drawShoji,
  table: drawTable,
  tsukubai: drawTsukubai,
  wind_chime: drawWindChime,
  shishi: drawShishi,
  cushion: drawCushion,
  bowl: drawBowl,
  cat: drawCat,
};

export function drawObject(d: DrawCtx): void {
  const fn = DRAWERS[d.obj.type];
  if (!fn) return;
  const { ctx } = d;
  const prev = ctx.globalAlpha;
  ctx.globalAlpha = d.alpha;
  fn(d);
  ctx.globalAlpha = prev;
}

export function hasDrawer(type: string): boolean {
  return !!DRAWERS[type];
}

/** Приблизительная высота объекта — для сортировки и превью. */
export function objectHeight(type: string): number {
  switch (type) {
    case 'sakura':
    case 'maple':
    case 'ginkgo':
    case 'willow':
      return 120;
    case 'pine':
      return 130;
    case 'bamboo':
      return 100;
    case 'pavilion':
      return 96;
    default:
      return 40;
  }
}

export { makeRng, TILE_H, TILE_W, LEVEL_H };
