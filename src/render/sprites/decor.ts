/**
 * Предметы обустройства двора: брёвна, пни, заборчики, колодец, скамья,
 * гамак, скворечник и прочие милости.
 *
 * Перерисовано с нуля. Прежняя версия собирала предметы из «сырых» fillRect
 * и одиночных openBeginPath-дуг: без освещения, без объёма, чужеродные рядом
 * с деревьями и камнями. Теперь всё той же утварью, что и остальной сад:
 *   - брёвна, столбы и стойки — connected wood (`paintWood`) со ствольным ритмом;
 *   - камень — грани `paintStone` и слоистые размывы с зернистостью;
 *   - крыши — двускатные плоскости с рядами «черепицы» и мхом по коньку;
 *   - снег — те же мягкие шапки, что на крышах домов, по `winterYear`.
 */

import type { Pt } from '../../core/iso';
import { hash1 } from '../../core/rng';
import { winterYear } from '../../world/annualEnvironment';
import { type Atmosphere, css, mix, shade, type RGB } from '../../world/palette';
import { oval } from '../animalBrush';
import { blobPath, granulate, washBlob } from '../paint';
import { snowColor } from '../roofSnow';
import { paintStone } from '../stone';
import { paintWood, woodCurve } from '../treeWood';
import { type Drawer, litc, shadowUnder } from './common';

// Базовые пигменты древесины: спил светлее коры, после дождя всё темнее и
// насыщеннее — как у настоящего мокрого дерева.
const WOOD: RGB = { r: 198, g: 160, b: 112 };
const BARK: RGB = { r: 142, g: 110, b: 76 };
const BARK_DARK: RGB = { r: 96, g: 74, b: 52 };
const SPIL: RGB = { r: 232, g: 204, b: 162 };
const MOSS: RGB = { r: 108, g: 136, b: 74 };

function woodOf(atm: Atmosphere, wet = 0): { wood: RGB; woodLight: RGB; woodMid: RGB; woodDark: RGB } {
  const base = mix(WOOD, BARK, 0.26 + wet * 0.4);
  return {
    wood: litc(base, atm),
    woodLight: litc(mix(WOOD, { r: 232, g: 200, b: 152 }, 0.5), atm),
    woodMid: litc(mix(WOOD, BARK, 0.46 + wet * 0.4), atm),
    woodDark: litc(mix(BARK, BARK_DARK, 0.42 + wet * 0.4), atm),
  };
}

/** Длинная ось звена на экране (единичной длины): rot 0/2 — вдоль x, 1/3 — вдоль y. */
function dirOf(rot: number): [number, number] {
  return rot % 2 === 0 ? [0.8944, 0.4472] : [-0.8944, 0.4472];
}

/** Грань по точкам (внутри translate на якорь объекта) с тёмной нижней кромкой. */
function wall(ctx: CanvasRenderingContext2D, color: RGB, alpha: number, pts: Pt[]): void {
  ctx.fillStyle = css(color, alpha);
  ctx.beginPath();
  pts.forEach((q, i) => (i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y)));
  ctx.closePath();
  ctx.fill();
}

/**
 * Двускатная крыша: два ската от конька к дальнему и ближнему карнизам
 * рядами «черепицы». Дальний скат темнее, ближний светлее; ближе к карнизу
 * клетки растут, как в перспективе сверху.
 */
function gableRoof(
  ctx: CanvasRenderingContext2D,
  o: {
    x: number;
    baseY: number;
    halfW: number;
    halfD: number;
    ridge: number;
    rows: number;
    roof: RGB;
    dark: RGB;
    mossy: RGB | null;
    seed: number;
  },
): void {
  const { x, baseY, halfW, halfD, ridge, rows, roof, dark, mossy, seed } = o;
  const backY = baseY - halfD;
  const frontY = baseY + halfD;
  const apexY = baseY - ridge;
  ctx.lineJoin = 'round';
  for (const side of [0, 1] as const) {
    const eaveY = side === 0 ? backY : frontY;
    for (let i = 0; i < rows; i++) {
      const t0 = i / rows;
      const t1 = (i + 1) / rows;
      const topW = halfW * (0.06 + 0.94 * t0);
      const botW = halfW * (0.06 + 0.94 * t1);
      const ty = apexY + (eaveY - apexY) * t0;
      const by = apexY + (eaveY - apexY) * t1;
      const tone = mix(roof, dark, 0.1 + hash1(side * 7 + i * 13 + seed, 3) * 0.22);
      wall(ctx, tone, 0.96, [
        { x: x - topW, y: ty },
        { x: x + topW, y: ty },
        { x: x + botW, y: by },
        { x: x - botW, y: by },
      ]);
      // узкие «каналы» вдоль ската — ритмичная черепица
      ctx.strokeStyle = css(shade(dark, side === 0 ? 0.8 : 1.05), 0.3);
      ctx.lineWidth = 0.6;
      for (let chan = 1; chan < 6; chan++) {
        ctx.beginPath();
        ctx.moveTo(x - topW + (topW * 2 * chan) / 6, ty + 0.5);
        ctx.lineTo(x - botW + (botW * 2 * chan) / 6, by - 0.4);
        ctx.stroke();
      }
    }
  }
  // мох по коньку и на скатах
  if (mossy) {
    ctx.strokeStyle = css(mossy, 0.4);
    ctx.lineWidth = 1.4;
    const rib = (yy: number): void => {
      ctx.beginPath();
      for (let i = 0; i <= 8; i++) {
        const t = -1 + (i / 8) * 2;
        const qx = x + t * halfW * 0.94;
        const qy = yy + Math.abs(t) * 2 + hash1(seed + i, 5) * halfD * 0.28;
        if (i === 0) ctx.moveTo(qx, qy);
        else ctx.lineTo(qx, qy);
      }
      ctx.stroke();
    };
    rib(apexY + 1);
    rib(frontY - halfD * 0.3);
  }
  // светлый конёк
  ctx.strokeStyle = css(shade(roof, 1.22), 0.5);
  ctx.lineWidth = 1.1;
  ctx.beginPath();
  ctx.moveTo(x - halfW * 0.98, apexY - 0.7);
  ctx.lineTo(x + halfW * 0.98, apexY - 0.7);
  ctx.stroke();
}

/** Мокрая/протоптанная земля под предметами: ближе к ножкам плотнее. */
function groundPatina(
  ctx: CanvasRenderingContext2D,
  atm: Atmosphere,
  seed: number,
  x: number,
  y: number,
  rx: number,
  ry: number,
): void {
  const wet = (atm.materialWetness ?? 0) * 0.5 + 0.08;
  granulate(ctx, x, y, rx, ry, shade(atm.palette.soil, 0.9), seed, Math.round(rx * 0.7), 0.12 + wet * 0.3);
}

/** Мягкая снежная шапка вдоль прямой грани (сиденье, забор, короб). */
function snowCap(ctx: CanvasRenderingContext2D, atm: Atmosphere, amount: number, a: Pt, b: Pt, width: number): void {
  if (amount <= 0.06) return;
  ctx.strokeStyle = css(snowColor(atm), 0.55 + 0.45 * Math.min(1, amount));
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  ctx.beginPath();
  const mx = (a.x + b.x) / 2;
  const my = (a.y + b.y) / 2 - width * 0.22;
  ctx.moveTo(a.x, a.y);
  ctx.quadraticCurveTo(mx, my, b.x, b.y);
  ctx.stroke();
}

// ---------------------------------------------------------------------------
//                                        Замшелое бревно
// ---------------------------------------------------------------------------

/** Замшелое поваленное бревно — ящерицы греются на тёплой коре. */
export const drawMossLog: Drawer = (d) => {
  const { ctx, atm, obj } = d;
  const [ux, uy] = dirOf(obj.rot);
  const L = 26 + hash1(obj.seed, 3) * 5;
  const wet = (atm.materialWetness ?? 0) * 0.16;
  const bark = litc(mix(BARK, BARK_DARK, wet), atm);
  const barkTop = litc(mix(BARK, { r: 208, g: 170, b: 120 }, 0.55), atm);
  const cut = litc(mix(SPIL, BARK, 0.18), atm);
  const moss = litc(MOSS, atm);
  const snow = winterYear(atm.time.now).snow;

  shadowUnder(d, L + 4, 12, 1);

  const w = woodCurve({ x: d.x - ux * L, y: d.y - uy * L - 2 }, { x: d.x + ux * L, y: d.y + uy * L - 2 }, 7.5, 7.5);
  paintWood(ctx, w, bark, obj.seed, true);
  // осветлённый верхний кант
  ctx.strokeStyle = css(barkTop, 0.5);
  ctx.lineWidth = 3.4;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(d.x - ux * L * 0.94, d.y - uy * L * 0.94 - 7.5);
  ctx.lineTo(d.x + ux * L * 0.94, d.y + uy * L * 0.94 - 7.5);
  ctx.stroke();

  // торец с годовыми кольцами
  const ex = d.x + ux * L;
  const ey = d.y + uy * L - 2;
  ctx.fillStyle = css(shade(cut, 0.78), 0.96);
  ctx.beginPath();
  ctx.ellipse(ex, ey, 7, 8.2, uy > 0.5 ? 0.55 : -0.55, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = css(cut, 0.96);
  ctx.beginPath();
  ctx.ellipse(ex, ey - 0.8, 6.2, 7.2, uy > 0.5 ? 0.55 : -0.55, 0, Math.PI * 2);
  ctx.fill();
  for (const rr of [4.2, 2.6, 1.4]) {
    ctx.strokeStyle = css(shade(cut, 0.62), 0.5);
    ctx.lineWidth = 0.7;
    ctx.beginPath();
    ctx.ellipse(ex, ey - 0.8, rr, rr * 1.12, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.strokeStyle = css(shade(bark, 0.78), 0.95);
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.ellipse(ex, ey, 7, 8.2, uy > 0.5 ? 0.55 : -0.55, 0, Math.PI * 2);
  ctx.stroke();

  // мох шапками по верху
  for (let i = 0; i < 3; i++) {
    const t = -0.55 + (((i + hash1(obj.seed, 21 + i) * 0.4) / 3) * 2 + 0.18);
    const mx = d.x + ux * L * t;
    const my = d.y + uy * L * t - 8 - hash1(obj.seed, 31 + i) * 1.5;
    washBlob(
      ctx,
      mx,
      my,
      5.5 + hash1(obj.seed, 41 + i) * 2.5,
      2.3 + hash1(obj.seed, 51 + i) * 0.8,
      moss,
      obj.seed + 100 + i,
      {
        layers: 2,
        alpha: 0.5 + hash1(obj.seed, 61 + i) * 0.2,
        edge: 0.14,
        wobble: 0.3,
      },
    );
  }
  // трутовики веером с нижней стороны
  ctx.fillStyle = css(litc({ r: 192, g: 158, b: 118 }, atm), 0.92);
  for (let i = 0; i < 3; i++) {
    const t = 0.1 + i * 0.13;
    const fx = d.x + ux * L * (0.42 + t) - (uy > 0.5 ? 5 : 0);
    const fy = d.y + uy * L * (0.42 + t) + 2 + i;
    ctx.beginPath();
    ctx.ellipse(fx, fy, 3 - i * 0.4, 1.5, uy > 0.5 ? -0.5 : 0.5, Math.PI, 0);
    ctx.fill();
  }

  snowCap(
    ctx,
    atm,
    snow,
    { x: d.x - ux * L * 0.9, y: d.y - uy * L * 0.9 - 9 },
    { x: d.x + ux * L * 0.9, y: d.y + uy * L * 0.9 - 9 },
    2.6,
  );
};

// ---------------------------------------------------------------------------
//                                        Пень и опята
// ---------------------------------------------------------------------------

/** Старый пень — пристанище ежей и мышей. Спил с годовыми кольцами. */
export const drawStump: Drawer = (d) => {
  const { ctx, atm, obj } = d;
  const wet = (atm.materialWetness ?? 0) * 0.16;
  const bark = litc(mix(BARK, BARK_DARK, wet), atm);
  const barkDark = litc(shade(mix(BARK, BARK_DARK, wet), 0.8), atm);
  const cut = litc(mix(SPIL, BARK, 0.14), atm);
  const cutDark = litc(shade(cut, 0.8), atm);
  const moss = litc(MOSS, atm);
  const snow = winterYear(atm.time.now).snow;
  const h = 15 + hash1(obj.seed, 5) * 4;
  const wob = 0.2 + hash1(obj.seed, 9) * 0.18;

  shadowUnder(d, 15, 8, 1);

  // корни-лапы
  ctx.strokeStyle = css(barkDark, 0.85);
  ctx.lineWidth = 3.4;
  ctx.lineCap = 'round';
  for (const s of [-1, 0, 1]) {
    const k = hash1(obj.seed, s + 4);
    ctx.beginPath();
    ctx.moveTo(d.x + s * 4, d.y - 2);
    ctx.quadraticCurveTo(d.x + s * 8, d.y + 1, d.x + s * (9 + k * 3), d.y + 3);
    ctx.stroke();
  }

  // тело пня — изогнутая древесная форма
  ctx.beginPath();
  ctx.moveTo(d.x - 9, d.y + 1);
  ctx.quadraticCurveTo(d.x - (10 + wob * 2), d.y - h * 0.5, d.x - 7, d.y - h);
  ctx.quadraticCurveTo(d.x, d.y - h - 3.4, d.x + 7, d.y - h);
  ctx.quadraticCurveTo(d.x + (10 + wob * 2), d.y - h * 0.5, d.x + 9, d.y + 1);
  ctx.closePath();
  ctx.fillStyle = css(bark, 0.97);
  ctx.fill();

  // кора: изогнутые бороздки внутри силуэта
  ctx.save();
  ctx.clip();
  for (let i = -2; i <= 2; i++) {
    ctx.strokeStyle = css(barkDark, 0.4);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(d.x + i * 3.6, d.y + 1);
    ctx.quadraticCurveTo(d.x + i * 3, d.y - h * 0.55, d.x + i * 2.2, d.y - h + 4);
    ctx.stroke();
  }
  // корневой мох снизу
  washBlob(ctx, d.x - 4, d.y - 1.4, 5.6, 2.4, moss, obj.seed + 9, { layers: 1, alpha: 0.42, edge: 0.1, wobble: 0.3 });
  washBlob(ctx, d.x + 4, d.y, 4.6, 2, moss, obj.seed + 13, { layers: 1, alpha: 0.38, edge: 0.1, wobble: 0.3 });
  ctx.restore();

  // спил с годовыми кольцами
  const cy = d.y - h - 2;
  ctx.fillStyle = css(shade(cut, 0.8), 0.97);
  blobPath(ctx, d.x, cy, 8.4, 3.6, obj.seed + 203, 0.14, 8);
  ctx.fill();
  ctx.fillStyle = css(cut, 0.97);
  blobPath(ctx, d.x, cy - 1.4, 6.9, 2.7, obj.seed + 211, 0.14, 8);
  ctx.fill();
  for (const rr of [5, 3.2, 1.8]) {
    ctx.strokeStyle = css(cutDark, 0.5);
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.ellipse(d.x, cy - 1.6, rr, rr * 0.4, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  // радиальные трещины
  ctx.strokeStyle = css(cutDark, 0.35);
  ctx.lineWidth = 0.7;
  for (let i = 0; i < 3; i++) {
    const a = hash1(obj.seed, 70 + i) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(d.x + Math.cos(a), cy - 1.5);
    ctx.lineTo(d.x + Math.cos(a) * 6.4, cy - 1.5 + Math.sin(a) * 2.2);
    ctx.stroke();
  }
  // мох по кромке спила
  washBlob(ctx, d.x - 5, cy - 1.2, 3.6, 1.4, moss, obj.seed + 33, { layers: 1, alpha: 0.4, edge: 0.12, wobble: 0.3 });
  washBlob(ctx, d.x + 3.4, cy + 0.6, 2.8, 1.1, moss, obj.seed + 41, {
    layers: 1,
    alpha: 0.34,
    edge: 0.12,
    wobble: 0.3,
  });

  snowCap(ctx, atm, snow, { x: d.x - 7, y: cy - 4 }, { x: d.x + 7, y: cy - 4 }, 2.2);
};

/** Семья опят — выглядывают после дождя; шляпки с тёмной кромкой. */
export const drawMushrooms: Drawer = (d) => {
  const { ctx, atm, obj } = d;
  const wet = (atm.materialWetness ?? 0) * 0.2;
  const stem = litc(mix({ r: 246, g: 238, b: 214 }, shade({ r: 190, g: 168, b: 138 }, 1), wet * 0.4), atm);
  const capA = litc(mix({ r: 190, g: 132, b: 86 }, { r: 150, g: 96, b: 58 }, wet * 0.5), atm);
  const capB = litc(mix({ r: 206, g: 108, b: 80 }, { r: 160, g: 70, b: 52 }, wet * 0.5), atm);
  const n = 4 + Math.floor(hash1(obj.seed, 7) * 3); // 4..6
  const snow = winterYear(atm.time.now).snow;

  shadowUnder(d, 9, 4, 0.7);

  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + hash1(obj.seed, i) * 1.2;
    const r = 2 + i * 1.8;
    const x = d.x + Math.cos(a) * r * 1.15;
    const y = d.y + Math.sin(a) * r * 0.5;
    const h = 6 + hash1(obj.seed, 13 + i) * 4;
    const tilt = (hash1(obj.seed, 23 + i) - 0.5) * 0.3;
    // сочная ножка с корневищем
    ctx.strokeStyle = css(stem, 0.95);
    ctx.lineWidth = 2.2;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x, y + 0.6);
    ctx.quadraticCurveTo(x + tilt * 2, y - h * 0.5, x + tilt * 3, y - h + 1.6);
    ctx.stroke();
    // кольцо
    ctx.strokeStyle = css(shade(stem, 0.82), 0.7);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.ellipse(x + tilt * 1.5, y - h * 0.62, 2, 0.9, 0, 0, Math.PI * 2);
    ctx.stroke();
    // шляпка с влажным бликом
    const cap = litc(i % 2 === 0 ? capA : capB, atm);
    const cxx = x + tilt * 3;
    const cyy = y - h + 1;
    ctx.fillStyle = css(shade(cap, 0.72), 0.5);
    ctx.beginPath();
    ctx.ellipse(cxx, cyy + 1.6, 4.8 - i * 0.35, 3 - i * 0.2, 0, Math.PI, 0);
    ctx.fill();
    ctx.fillStyle = css(cap, 0.96);
    ctx.beginPath();
    ctx.ellipse(cxx, cyy, 4.8 - i * 0.35, 3 - i * 0.2, 0, Math.PI, 0);
    ctx.closePath();
    ctx.fill();
    // тёмная подсохшая кромка
    ctx.strokeStyle = css(shade(cap, 0.66), 0.55);
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.ellipse(cxx, cyy, 4.8 - i * 0.35, 3 - i * 0.2, 0, Math.PI, 0);
    ctx.stroke();
    if (hash1(obj.seed, 41 + i) > 0.5) {
      ctx.fillStyle = css(mix(cap, { r: 250, g: 244, b: 232 }, 0.5), 0.35);
      ctx.beginPath();
      ctx.ellipse(cxx - 1.4, cyy - 1.1, 1.2, 0.7, -0.3, 0, Math.PI * 2);
      ctx.fill();
    }
    if (snow > 0.1) {
      ctx.strokeStyle = css(snowColor(atm), 0.5 * snow);
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.ellipse(cxx, cyy - 1, 3.4 - i * 0.25, 1.6 - i * 0.1, 0, Math.PI, 0);
      ctx.stroke();
    }
  }
  groundPatina(ctx, atm, obj.seed, d.x, d.y + 1, 9, 4.4);
};

// ---------------------------------------------------------------------------
//                                             Заборчики
// ---------------------------------------------------------------------------

/** Низкий деревянный заборчик: штакетник с двумя прожилинами. */
export const drawFenceWood: Drawer = (d) => {
  const { ctx, atm, obj } = d;
  const [ux, uy] = dirOf(obj.rot);
  const { wood, woodMid, woodDark } = woodOf(atm, (atm.materialWetness ?? 0) * 0.18);
  const snow = winterYear(atm.time.now).snow;
  const n = 7;
  const L = 25;

  shadowUnder(d, L + 3, 8, 0.85);

  // прожилины (за досками)
  for (const hh of [5, 9]) {
    ctx.strokeStyle = css(woodMid, 0.9);
    ctx.lineWidth = 2.6;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(d.x - ux * L, d.y - uy * L - hh);
    ctx.lineTo(d.x + ux * L, d.y + uy * L - hh);
    ctx.stroke();
    ctx.strokeStyle = css(shade(woodMid, 0.8), 0.55);
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(d.x - ux * L, d.y - uy * L - hh - 1.3);
    ctx.lineTo(d.x + ux * L, d.y + uy * L - hh - 1.3);
    ctx.stroke();
  }
  // штакетник с неравными вершками
  for (let i = 0; i < n; i++) {
    const t = -1 + ((i + 0.5) / n) * 2;
    const x = d.x + ux * L * t;
    const y = d.y + uy * L * t;
    const ph = 9 + hash1(obj.seed, i + 3) * 3.6;
    ctx.strokeStyle = css(i % 2 ? wood : woodMid, 0.93);
    ctx.lineWidth = 3.4;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x, y - ph);
    ctx.stroke();
    // верхний срез доски
    ctx.strokeStyle = css(shade(i % 2 ? wood : woodMid, 1.25), 0.5);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x - 0.6, y - ph + 0.4);
    ctx.lineTo(x + 0.6, y - ph + 0.4);
    ctx.stroke();
  }
  if (snow > 0.05) {
    for (let i = 0; i < n; i++) {
      const t = -1 + ((i + 0.5) / n) * 2;
      const x = d.x + ux * L * t;
      const y = d.y + uy * L * t;
      const ph = 9 + hash1(obj.seed, i + 3) * 3.6;
      snowCap(ctx, atm, snow * 0.8, { x: x - 1.6, y: y - ph + 0.6 }, { x: x + 1.6, y: y - ph + 0.6 }, 1.4);
    }
  }
  void woodDark;
};

/** Каменная ограда — сухая кладка из округлых валунов, а не диски в ряд. */
export const drawFenceStone: Drawer = (d) => {
  const { ctx, atm, obj } = d;
  const [ux, uy] = dirOf(obj.rot);
  const snow = winterYear(atm.time.now).snow;
  const moss = litc(MOSS, atm);
  const L = 25;

  shadowUnder(d, L + 4, 9, 0.9);

  // нижний ряд шире, верхний уже; по два валуна на звено для глубины
  for (let row = 0; row < 2; row++) {
    const n = 4;
    for (let i = 0; i < n; i++) {
      const t = -0.94 + ((i + (row % 2) * 0.5 + hash1(obj.seed, row * 7 + i) * 0.2) / (n - 0.2)) * 1.88;
      const back = row === 1 ? -5 : 0;
      const k = row === 0 ? 0.66 : 0.45;
      const sx = d.x + ux * L * t + (uy > 0.5 ? 4 : 0);
      const sy = d.y + uy * L * t + back;
      const seed = Math.round(obj.seed + row * 271 + i * 37);
      paintStone(ctx, sx, sy, seed, k * (0.86 + hash1(obj.seed, row * 5 + i * 3) * 0.3), 0, atm);
    }
  }
  // мох в швах
  for (let i = 0; i < 4; i++) {
    const t = -0.8 + i * 0.55 + hash1(obj.seed, 61 + i) * 0.2;
    washBlob(ctx, d.x + ux * L * t, d.y + uy * L * t - 2.2, 3.4, 1.4, moss, obj.seed + 81 + i, {
      layers: 1,
      alpha: 0.36,
      edge: 0.1,
      wobble: 0.3,
    });
  }
  if (snow > 0.05) {
    for (let i = 0; i < 4; i++) {
      const t = -0.8 + i * 0.55 + hash1(obj.seed, 91 + i) * 0.2;
      const x = d.x + ux * L * t;
      const y = d.y + uy * L * t - 5.4;
      snowCap(ctx, atm, snow * 0.85, { x: x - 6, y: y }, { x: x + 6, y: y - 0.8 }, 1.9);
    }
  }
};

// ---------------------------------------------------------------------------
//                                Дзидзо — каменный страж
// ---------------------------------------------------------------------------

/** Дзидзо — каменный страж в красном нагруднике и шапочке. */
export const drawJizo: Drawer = (d) => {
  const { ctx, atm, obj } = d;
  const red = litc({ r: 196, g: 84, b: 66 }, atm);
  const redDark = litc(shade({ r: 196, g: 84, b: 66 }, 0.72), atm);
  const moss = litc(MOSS, atm);
  const snow = winterYear(atm.time.now).snow;
  const stone = litc(atm.palette.stone, atm);
  const stoneDark = litc(shade(atm.palette.stone, 0.78), atm);

  shadowUnder(d, 16, 7, 0.8);

  // постамент и тело — каменные размывы с зернистостью
  paintStone(ctx, d.x, d.y + 1, obj.seed, 0.62, obj.rot, atm, true);
  washBlob(ctx, d.x, d.y - 5, 9.5, 8, stoneDark, obj.seed + 5, { layers: 1, alpha: 0.7, edge: 0.16, wobble: 0.2 });
  washBlob(ctx, d.x, d.y - 8, 8.4, 7, stone, obj.seed + 9, { layers: 2, alpha: 0.8, edge: 0.16, wobble: 0.2 });
  // тень сбоку — округлость
  ctx.fillStyle = css(stoneDark, 0.4);
  ctx.beginPath();
  ctx.ellipse(d.x + 2.6, d.y - 9, 3.2, 6.4, 0, 0, Math.PI * 2);
  ctx.fill();
  granulate(ctx, d.x, d.y - 8, 7.4, 6, stoneDark, obj.seed + 3, 10, 0.12);

  // голова
  washBlob(ctx, d.x, d.y - 17, 5.6, 5.8, stoneDark, obj.seed + 17, { layers: 1, alpha: 0.6, edge: 0.16, wobble: 0.2 });
  washBlob(ctx, d.x - 0.4, d.y - 17.8, 5, 5, stone, obj.seed + 21, { layers: 2, alpha: 0.85, edge: 0.16, wobble: 0.2 });

  // нагрудник
  ctx.fillStyle = css(red, 0.92);
  ctx.beginPath();
  ctx.moveTo(d.x - 7.4, d.y - 14.6);
  ctx.quadraticCurveTo(d.x, d.y - 11.6, d.x + 7.4, d.y - 14.6);
  ctx.lineTo(d.x + 5.6, d.y - 9.6);
  ctx.quadraticCurveTo(d.x, d.y - 7, d.x - 5.6, d.y - 9.6);
  ctx.closePath();
  ctx.fill();
  // складки нагрудника
  ctx.strokeStyle = css(redDark, 0.55);
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.moveTo(d.x - 4.4, d.y - 10.4);
  ctx.quadraticCurveTo(d.x, d.y - 12.2, d.x + 4.4, d.y - 10.4);
  ctx.stroke();

  // шапочка
  ctx.fillStyle = css(red, 0.92);
  ctx.beginPath();
  ctx.moveTo(d.x - 5.4, d.y - 18.4);
  ctx.quadraticCurveTo(d.x, d.y - 24.6, d.x + 5.4, d.y - 18.4);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = css(redDark, 0.5);
  ctx.lineWidth = 0.7;
  ctx.stroke();

  // лицо: тихие точки глаз и улыбка
  ctx.strokeStyle = css(stoneDark, 0.85);
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.arc(d.x - 1.6, d.y - 16.6, 0.55, 0, Math.PI * 2);
  ctx.moveTo(d.x + 2.2, d.y - 16.6);
  ctx.arc(d.x + 1.6, d.y - 16.6, 0.55, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(d.x, d.y - 15.2, 2, 0.3, Math.PI - 0.3);
  ctx.stroke();

  // мох у подножия
  washBlob(ctx, d.x - 6, d.y + 2.4, 4.6, 2, moss, obj.seed + 55, { layers: 1, alpha: 0.4, edge: 0.1, wobble: 0.3 });
  washBlob(ctx, d.x + 5, d.y + 2.6, 4, 1.8, moss, obj.seed + 63, { layers: 1, alpha: 0.34, edge: 0.1, wobble: 0.3 });

  if (snow > 0.05) {
    ctx.fillStyle = css(snowColor(atm), 0.6 * snow);
    ctx.beginPath();
    ctx.ellipse(d.x, d.y - 22.6, 4, 1.6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(d.x - 4, d.y + 2, 3, 1.2, 0, 0, Math.PI * 2);
    ctx.fill();
  }
};

// ---------------------------------------------------------------------------
//                                                Колодец
// ---------------------------------------------------------------------------

/** Старый колодец: каменное кольцо, двускатная крыша, ворот и черпак. */
export const drawWell: Drawer = (d) => {
  const { ctx, atm, obj } = d;
  const wet = (atm.materialWetness ?? 0) * 0.15;
  const { wood, woodDark } = woodOf(atm, wet);
  const stone = litc(mix(atm.palette.stone, { r: 150, g: 148, b: 140 }, 0.3), atm);
  const stoneDark = litc(shade(mix(atm.palette.stone, { r: 118, g: 116, b: 110 }, 0.4), 0.72), atm);
  const roof = litc({ r: 96, g: 104, b: 108 }, atm);
  const roofDark = litc({ r: 62, g: 70, b: 76 }, atm);
  const moss = litc(MOSS, atm);
  const snow = winterYear(atm.time.now).snow;

  shadowUnder(d, 30, 14, 1.05);

  // каменное кольцо сруба
  ctx.fillStyle = css(shade(stone, 0.78), 0.9);
  ctx.beginPath();
  ctx.ellipse(d.x, d.y - 9, 17, 8, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = css(stone, 0.95);
  ctx.beginPath();
  ctx.ellipse(d.x, d.y - 11, 15.6, 7.2, 0, 0, Math.PI * 2);
  ctx.fill();
  // внутренняя обечайка
  ctx.fillStyle = css(shade(stone, 1.12), 0.95);
  ctx.beginPath();
  ctx.ellipse(d.x, d.y - 11.6, 12.2, 5, 0, 0, Math.PI * 2);
  ctx.fill();
  // тёмное жерло (с проблеском глубины)
  ctx.fillStyle = css({ r: 26, g: 32, b: 40 }, 0.95);
  ctx.beginPath();
  ctx.ellipse(d.x, d.y - 11.4, 9.6, 3.8, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = css({ r: 46, g: 56, b: 70 }, 0.7);
  ctx.beginPath();
  ctx.ellipse(d.x, d.y - 12, 7, 2.4, 0, 0, Math.PI * 2);
  ctx.fill();
  // швы кладки на обечайке
  ctx.strokeStyle = css(stoneDark, 0.5);
  ctx.lineWidth = 0.9;
  for (let i = 0; i < 6; i++) {
    const a = Math.PI * (0.12 + i * 0.16);
    ctx.beginPath();
    ctx.moveTo(d.x + Math.cos(a) * 15.2, d.y - 11 + Math.sin(a) * 6.8);
    ctx.lineTo(d.x + Math.cos(a) * 11.8, d.y - 11.6 + Math.sin(a) * 4.6);
    ctx.stroke();
  }
  granulate(ctx, d.x, d.y - 10, 15, 7, stoneDark, obj.seed + 5, 12, 0.12);
  // мох по нижнему поясу
  washBlob(ctx, d.x - 11, d.y - 4, 5.6, 2.2, moss, obj.seed + 7, { layers: 1, alpha: 0.4, edge: 0.1, wobble: 0.3 });
  washBlob(ctx, d.x + 10, d.y - 3.6, 4.8, 2, moss, obj.seed + 11, { layers: 1, alpha: 0.36, edge: 0.1, wobble: 0.3 });

  // стойки
  for (const s of [-1, 1]) {
    const sx = d.x + 14 * s;
    const post = woodCurve({ x: sx, y: d.y - 6 }, { x: sx, y: d.y - 38 }, 2.3, 1.7);
    paintWood(ctx, post, woodDark, obj.seed + (s > 0 ? 19 : 31));
  }
  // карниз-брус под крышей
  ctx.strokeStyle = css(woodDark, 0.95);
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(d.x - 20, d.y - 32);
  ctx.lineTo(d.x + 20, d.y - 32);
  ctx.stroke();
  // ворот
  ctx.strokeStyle = css(wood, 0.95);
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  ctx.moveTo(d.x - 14, d.y - 26);
  ctx.lineTo(d.x + 14, d.y - 26);
  ctx.stroke();
  // рукоятка ворота
  ctx.strokeStyle = css(woodDark, 0.92);
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.moveTo(d.x - 13, d.y - 31);
  ctx.lineTo(d.x - 13, d.y - 23);
  ctx.stroke();

  // верёвка к черпаку
  ctx.strokeStyle = css(shade(BARK_DARK, 0.95), 0.8);
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.moveTo(d.x + 4, d.y - 26);
  ctx.lineTo(d.x + 4, d.y - 18);
  ctx.stroke();
  // черпак-ведёрко
  wall(ctx, wood, 0.95, [
    { x: d.x + 1.6, y: d.y - 19 },
    { x: d.x + 6.4, y: d.y - 19 },
    { x: d.x + 6.4, y: d.y - 15.6 },
    { x: d.x + 1.6, y: d.y - 15.6 },
  ]);
  ctx.strokeStyle = css(shade(woodDark, 0.9), 0.8);
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.ellipse(d.x + 4, d.y - 19, 2.6, 1.1, 0, 0, Math.PI * 2);
  ctx.stroke();

  // двускатная крыша
  gableRoof(ctx, {
    x: d.x,
    baseY: d.y - 27,
    halfW: 23,
    halfD: 7,
    ridge: 13,
    rows: 6,
    roof,
    dark: roofDark,
    mossy: moss,
    seed: obj.seed,
  });

  if (snow > 0.05) {
    snowCap(ctx, atm, snow, { x: d.x - 22, y: d.y - 39 }, { x: d.x + 22, y: d.y - 39 }, 3);
  }
  groundPatina(ctx, atm, obj.seed, d.x, d.y + 10, 20, 8);
};

// ---------------------------------------------------------------------------
//                                           Скамья
// ---------------------------------------------------------------------------

/** Садовая скамья: гнутая спинка, доски-сиденье и хвостовики ножек. */
export const drawGardenBench: Drawer = (d) => {
  const { ctx, atm, obj } = d;
  const [ux, uy] = dirOf(obj.rot);
  const { wood, woodLight, woodDark } = woodOf(atm, (atm.materialWetness ?? 0) * 0.18);
  const snow = winterYear(atm.time.now).snow;
  const L = 22;

  shadowUnder(d, L + 7, 12, 0.85);

  // хвостовики ножек — торчат за сиденье
  ctx.lineCap = 'round';
  for (const s of [-1, 1]) {
    const ex = d.x + ux * L * s;
    const ey = d.y + uy * L * s;
    ctx.strokeStyle = css(woodDark, 0.9);
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(ex, ey - 8);
    ctx.lineTo(ex + ux * 4 * s, ey + uy * 4 * s - 7);
    ctx.stroke();
  }
  // гнутая спинка
  ctx.strokeStyle = css(wood, 0.95);
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(d.x - ux * L, d.y - uy * L - 17);
  ctx.quadraticCurveTo(d.x, d.y - 22, d.x + ux * L, d.y + uy * L - 17);
  ctx.stroke();
  // верхняя планка спинки
  ctx.strokeStyle = css(shade(wood, 0.86), 0.95);
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  ctx.moveTo(d.x - ux * L * 1.02, d.y - uy * L * 1.02 - 19.4);
  ctx.quadraticCurveTo(d.x, d.y - 24.4, d.x + ux * L * 1.02, d.y + uy * L * 1.02 - 19.4);
  ctx.stroke();

  // сиденье: три доски
  for (const [off, sw, col] of [
    [-5.6, 3.2, shade(wood, 0.88)],
    [-8, 3.4, wood],
    [-10.4, 3.2, woodLight],
  ] as const) {
    ctx.strokeStyle = css(col, 0.96);
    ctx.lineWidth = sw;
    ctx.beginPath();
    ctx.moveTo(d.x - ux * L, d.y - uy * L + off);
    ctx.lineTo(d.x + ux * L, d.y + uy * L + off);
    ctx.stroke();
  }
  // щели между досками
  ctx.strokeStyle = css(shade(woodDark, 0.9), 0.55);
  ctx.lineWidth = 0.8;
  for (const off of [-6.9, -9.2]) {
    ctx.beginPath();
    ctx.moveTo(d.x - ux * L, d.y - uy * L + off);
    ctx.lineTo(d.x + ux * L, d.y + uy * L + off);
    ctx.stroke();
  }
  // блик передней кромки
  ctx.strokeStyle = css(mix(woodLight, { r: 250, g: 236, b: 206 }, 0.4), 0.3);
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.moveTo(d.x - ux * L, d.y - uy * L - 4);
  ctx.lineTo(d.x + ux * L, d.y + uy * L - 4);
  ctx.stroke();

  // ножки: толстая внешняя, тонкая задняя (видна под сиденьем)
  for (const s of [-1, 1]) {
    const ex = d.x + ux * L * 0.86 * s;
    const ey = d.y + uy * L * 0.86 * s;
    ctx.strokeStyle = css(woodDark, 0.92);
    ctx.lineWidth = 3.6;
    ctx.beginPath();
    ctx.moveTo(ex, ey - 5);
    ctx.lineTo(ex + ux * 2, ey + uy * 2 - 13);
    ctx.stroke();
    ctx.strokeStyle = css(shade(woodDark, 0.9), 0.8);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(ex + ux * 3, ey + uy * 3 - 8);
    ctx.lineTo(ex - ux * 3, ey - uy * 3 - 13);
    ctx.stroke();
  }

  snowCap(
    ctx,
    atm,
    snow,
    { x: d.x - ux * L * 0.94, y: d.y - uy * L * 0.94 - 11.4 },
    { x: d.x + ux * L * 0.94, y: d.y + uy * L * 0.94 - 11.4 },
    1.7,
  );
};

// ---------------------------------------------------------------------------
//                                           Поленница
// ---------------------------------------------------------------------------

/** Поленница — запас на зиму: стойки, доска-крышка и торцы поленьев. */
export const drawWoodpile: Drawer = (d) => {
  const { ctx, atm, obj } = d;
  const [ux, uy] = dirOf(obj.rot);
  const wet = (atm.materialWetness ?? 0) * 0.18;
  const bark = litc(mix(BARK, BARK_DARK, wet * 0.4), atm);
  const cut = litc(mix(SPIL, BARK, 0.14 + wet * 0.3), atm);
  const cutDark = litc(shade(cut, 0.78), atm);
  const woodDark = litc(mix(BARK, BARK_DARK, 0.5 + wet * 0.4), atm);
  const snow = winterYear(atm.time.now).snow;

  shadowUnder(d, 24, 12, 0.95);

  // боковые стойки
  for (const s of [-1, 1]) {
    const ex = d.x + ux * 12 * s;
    const ey = d.y + uy * 12 * s;
    ctx.strokeStyle = css(woodDark, 0.94);
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(ex, ey - 2);
    ctx.lineTo(ex, ey - 17);
    ctx.stroke();
  }

  // слои поленьев (торцы смотрят на зрителя)
  for (let row = 0; row < 3; row++) {
    const n = 4;
    for (let i = 0; i < n; i++) {
      const t = -0.8 + ((i + (row % 2) * 0.5 + hash1(obj.seed, row * 7 + i) * 0.16) / n) * 1.6;
      const x = d.x + ux * 12 * t;
      const y = d.y + uy * 12 * t - 2 - row * 4.8;
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(1, 0.46);
      ctx.fillStyle = css(shade((i + row) % 2 === 0 ? cut : cutDark, 0.8), 0.5);
      ctx.beginPath();
      ctx.arc(0, 1, 3.3, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = css((i + row) % 2 === 0 ? cut : cutDark, 0.96);
      ctx.beginPath();
      ctx.arc(0, 0, 3.3, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = css(bark, 0.85);
      ctx.lineWidth = 1.2;
      ctx.stroke();
      // годовые кольца
      ctx.strokeStyle = css(shade(cut, 0.7), 0.5);
      ctx.lineWidth = 0.7;
      ctx.beginPath();
      ctx.arc(0, 0, 1.8, 0, Math.PI * 2);
      ctx.stroke();
      // радиальная трещина
      const a = hash1(obj.seed, 40 + row * 9 + i) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * 0.3, Math.sin(a) * 0.3);
      ctx.lineTo(Math.cos(a) * 2.6, Math.sin(a) * 2.6);
      ctx.stroke();
      ctx.restore();
    }
  }

  // доска-крышка
  ctx.strokeStyle = css(woodDark, 0.9);
  ctx.lineWidth = 2.8;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(d.x - ux * 13, d.y - uy * 13 - 16.6);
  ctx.lineTo(d.x + ux * 13, d.y + uy * 13 - 16.6);
  ctx.stroke();
  ctx.strokeStyle = css(shade(woodDark, 0.8), 0.4);
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.moveTo(d.x - ux * 13, d.y - uy * 13 - 15.4);
  ctx.lineTo(d.x + ux * 13, d.y + uy * 13 - 15.4);
  ctx.stroke();

  snowCap(
    ctx,
    atm,
    snow,
    { x: d.x - ux * 12, y: d.y - uy * 12 - 17.6 },
    { x: d.x + ux * 12, y: d.y + uy * 12 - 18.4 },
    1.7,
  );
};

// ---------------------------------------------------------------------------
//                                          Скворечник
// ---------------------------------------------------------------------------

/** Скворечник на столбике; весной синицы таскают туда подстилку. */
export const drawNestbox: Drawer = (d) => {
  const { ctx, atm, obj } = d;
  const { wood, woodDark } = woodOf(atm, (atm.materialWetness ?? 0) * 0.18);
  const roof = litc({ r: 104, g: 96, b: 84 }, atm);
  const roofDark = litc({ r: 70, g: 64, b: 58 }, atm);
  const snow = winterYear(atm.time.now).snow;

  shadowUnder(d, 16, 8, 0.9);

  // столбик
  const post = woodCurve({ x: d.x, y: d.y }, { x: d.x, y: d.y - 27 }, 2.1, 1.6);
  paintWood(ctx, post, woodDark, obj.seed + 5);

  // домик-короб
  const roofBase = d.y - 39;
  wall(ctx, wood, 0.96, [
    { x: d.x - 8, y: roofBase },
    { x: d.x + 8, y: roofBase },
    { x: d.x + 8, y: roofBase + 14 },
    { x: d.x - 8, y: roofBase + 14 },
  ]);
  // доски фасада
  ctx.strokeStyle = css(shade(woodDark, 0.92), 0.35);
  ctx.lineWidth = 0.7;
  for (const bx of [-5, 0, 5]) {
    ctx.beginPath();
    ctx.moveTo(d.x + bx, roofBase + 1);
    ctx.lineTo(d.x + bx, roofBase + 13);
    ctx.stroke();
  }
  // леток
  ctx.fillStyle = css({ r: 32, g: 28, b: 26 }, 0.95);
  ctx.beginPath();
  ctx.arc(d.x, roofBase + 6, 3.4, 0, Math.PI * 2);
  ctx.fill();
  // шесток
  ctx.strokeStyle = css(woodDark, 0.9);
  ctx.lineWidth = 1.4;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(d.x, roofBase + 9.6);
  ctx.lineTo(d.x, roofBase + 12);
  ctx.stroke();

  // крыша
  gableRoof(ctx, {
    x: d.x,
    baseY: roofBase - 0.5,
    halfW: 10,
    halfD: 3.2,
    ridge: 6.4,
    rows: 4,
    roof,
    dark: roofDark,
    mossy: null,
    seed: obj.seed,
  });

  if (snow > 0.05) {
    snowCap(ctx, atm, snow, { x: d.x - 8, y: roofBase - 6 }, { x: d.x + 8, y: roofBase - 6 }, 2.2);
  }

  // синица у летка: волнами, весной с травинкой
  const season = atm.season;
  if ((season === 'spring' || season === 'summer') && Math.floor((d.time + obj.seed * 977) / 9000) % 3 === 0) {
    const bx = d.x + 1.6;
    const by = roofBase + 8;
    ctx.fillStyle = css(litc({ r: 186, g: 196, b: 178 }, atm), 0.95);
    ctx.beginPath();
    ctx.ellipse(bx, by, 2.9, 2.2, -0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = css(litc({ r: 70, g: 78, b: 86 }, atm), 0.95);
    ctx.beginPath();
    ctx.arc(bx - 2.2, by - 1.7, 1.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = css(litc({ r: 244, g: 232, b: 198 }, atm), 0.92);
    ctx.beginPath();
    ctx.arc(bx + 1.4, by - 1.2, 1.1, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = css(litc({ r: 210, g: 190, b: 120 }, atm), 0.9);
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(bx - 3.5, by - 2);
    ctx.lineTo(bx - 5.6, by - 2.9);
    ctx.stroke();
  }
};

// ---------------------------------------------------------------------------
//                                                Гамак
// ---------------------------------------------------------------------------

/** Гамак на стойках: провисшее полотнище с каймой — коты дремлют в нём. */
export const drawHammock: Drawer = (d) => {
  const { ctx, atm, obj } = d;
  const [ux, uy] = dirOf(obj.rot);
  const { woodDark } = woodOf(atm, (atm.materialWetness ?? 0) * 0.18);
  const cloth = litc({ r: 232, g: 220, b: 196 }, atm);
  const clothDark = litc(shade({ r: 232, g: 220, b: 196 }, 0.8), atm);
  const stripe = litc({ r: 176, g: 96, b: 84 }, atm);
  const snow = winterYear(atm.time.now).snow;
  const L = 22;

  shadowUnder(d, L + 6, 12, 0.9);

  // стойки-рогатины с развилкой
  for (const s of [-1, 1]) {
    const x = d.x + ux * L * s;
    const y = d.y + uy * L * s;
    const leg = woodCurve({ x: x - ux * 3 * s, y: y - uy * 3 * s + 2 }, { x: x, y: y - 22 }, 2.2, 1.4);
    paintWood(ctx, leg, woodDark, obj.seed + (s > 0 ? 17 : 29), true);
    ctx.strokeStyle = css(shade(woodDark, 0.95), 0.95);
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x, y - 17);
    ctx.lineTo(x + ux * 4 * s, y - 21);
    ctx.stroke();
  }

  // полотнище с провисом
  const ax = d.x - ux * (L - 3);
  const ay = d.y - uy * (L - 3) - 15;
  const bx = d.x + ux * (L - 3);
  const by = d.y + uy * (L - 3) - 15;
  const sag = 7;
  // задняя (провисающая) кромка
  ctx.fillStyle = css(clothDark, 0.8);
  ctx.beginPath();
  ctx.moveTo(ax, ay + 3);
  ctx.quadraticCurveTo(d.x, d.y + sag + 3, bx, by + 3);
  ctx.lineTo(bx, by + 5);
  ctx.quadraticCurveTo(d.x, d.y + sag + 5, ax, ay + 5);
  ctx.closePath();
  ctx.fill();
  // переднее полотнище
  ctx.fillStyle = css(cloth, 0.95);
  ctx.beginPath();
  ctx.moveTo(ax, ay);
  ctx.quadraticCurveTo(d.x, d.y + sag, bx, by);
  ctx.lineTo(bx, by + 4);
  ctx.quadraticCurveTo(d.x, d.y + sag + 4, ax, ay + 4);
  ctx.closePath();
  ctx.fill();
  // поперечные полосы каймы
  ctx.strokeStyle = css(stripe, 0.7);
  ctx.lineWidth = 1.4;
  for (let i = 1; i <= 5; i++) {
    const t = i / 6;
    const x0 = ax + (bx - ax) * t;
    const y0 = ay + (by - ay) * t;
    const dip = sag * 4 * t * (1 - t);
    ctx.beginPath();
    ctx.moveTo(x0, y0 + dip);
    ctx.quadraticCurveTo(x0, y0 + dip + 3, x0 + (d.x - x0) * 0.4, d.y + sag + 4.4 + (i % 2) * 0.6);
    ctx.stroke();
  }
  // продольный блик по передней кромке
  ctx.strokeStyle = css(mix(cloth, { r: 250, g: 244, b: 228 }, 0.5), 0.5);
  ctx.lineWidth = 0.9;
  ctx.beginPath();
  ctx.moveTo(ax + 2, ay + 0.8);
  ctx.quadraticCurveTo(d.x, d.y + sag + 0.8, bx - 2, by + 0.8);
  ctx.stroke();

  // верёвки к стойкам
  ctx.strokeStyle = css(shade(BARK_DARK, 0.95), 0.75);
  ctx.lineWidth = 0.9;
  for (const s of [-1, 1]) {
    const x = d.x + ux * (L - 2) * s;
    const y = d.y + uy * (L - 2) * s - 12;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(d.x + ux * L * s, d.y + uy * L * s - 18);
    ctx.stroke();
  }

  if (snow > 0.05) {
    snowCap(ctx, atm, snow * 0.75, { x: ax + 4, y: ay + 2 }, { x: bx - 4, y: by + 2 }, 1.5);
  }
};

// ---------------------------------------------------------------------------
//                                                Мататаби
// ---------------------------------------------------------------------------

/** Мататаби — кошачья радость; в начале лета в белых звёздочках. */
export const drawMatatabi: Drawer = (d) => {
  const { ctx, atm, g, obj } = d;
  const scale = 0.4 + 0.6 * Math.pow(Math.max(0, Math.min(1, g)), 0.7);
  const bark = litc(BARK, atm);
  const barkDark = litc(BARK_DARK, atm);
  const leaf = litc(mix(atm.palette.foliageDeep, { r: 116, g: 152, b: 92 }, 0.5), atm);
  const leafDeep = litc(shade(mix(atm.palette.foliageDeep, { r: 86, g: 118, b: 76 }, 0.6), 0.78), atm);
  const snow = winterYear(atm.time.now).snow;

  shadowUnder(d, 17 * scale, 9 * scale, 0.8);

  if (snow > 0.45) {
    // зимой — голые прутья под снегом
    ctx.lineCap = 'round';
    for (let i = -2; i <= 2; i++) {
      const x = d.x + i * 2.6 * scale;
      const h = (11 + (i % 2) * 2 + hash1(obj.seed, 101 + i) * 4) * scale;
      ctx.strokeStyle = css(barkDark, 0.85);
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(x, d.y + 1);
      ctx.quadraticCurveTo(x + i * 1.6, d.y - h * 0.5, x + i * 2.4, d.y - h);
      ctx.stroke();
    }
    snowCap(
      ctx,
      atm,
      snow * 0.6,
      { x: d.x - 9 * scale, y: d.y - 11 * scale },
      { x: d.x + 9 * scale, y: d.y - 11 * scale },
      2,
    );
    return;
  }

  // сердцевина листвы и внешние мазки
  washBlob(ctx, d.x - 3 * scale, d.y - 8 * scale, 10 * scale, 8 * scale, leafDeep, obj.seed + 3, {
    layers: 2,
    alpha: 0.75,
    edge: 0.14,
    wobble: 0.3,
  });
  washBlob(ctx, d.x + 3 * scale, d.y - 10 * scale, 11 * scale, 9 * scale, leaf, obj.seed + 9, {
    layers: 2,
    alpha: 0.65,
    edge: 0.14,
    wobble: 0.3,
  });
  // ветви-лапы
  ctx.strokeStyle = css(bark, 0.85);
  ctx.lineWidth = 1.5;
  ctx.lineCap = 'round';
  for (let i = -2; i <= 2; i++) {
    const r = hash1(obj.seed, 121 + i);
    const x = d.x + i * 2.6 * scale;
    const h = (9 + r * 5) * scale;
    ctx.beginPath();
    ctx.moveTo(x, d.y + 1);
    ctx.quadraticCurveTo(x + i * 2, d.y - h * 0.5, x + i * 3.2, d.y - h);
    ctx.stroke();
  }
  granulate(ctx, d.x, d.y - 9 * scale, 11 * scale, 8 * scale, leafDeep, obj.seed + 7, 12, 0.14);

  // белые звёздочки весной и в начале лета
  if (atm.season === 'summer' || atm.season === 'spring') {
    for (let i = 0; i < 6; i++) {
      const a = hash1(obj.seed, i) * Math.PI * 2;
      const r = (3 + hash1(obj.seed, 10 + i) * 6) * scale;
      const x = d.x + Math.cos(a) * r;
      const y = d.y - 9 * scale + Math.sin(a) * r * 0.5;
      for (let pfil = 0; pfil < 5; pfil++) {
        const pa = (pfil / 5) * Math.PI * 2 + a * 0.6;
        oval(ctx, x + Math.cos(pa) * 1.4, y + Math.sin(pa) * 1.4, 1.1, 0.7, css({ r: 250, g: 250, b: 240 }, 0.95), pa);
      }
    }
  }
};
