/** Предметы индивидуализации: брёвна, пни, заборчики, колодец и прочие милости.
 *
 * Всё построено в локальных изометрических координатах: along/across — в тайлах
 * от центра отпечатка, h — в пикселях над землёй. Так предметы держат масштаб
 * сетки при любом повороте, а объём (крышки, торцы, гряды) читается по-настоящему.
 */

import { type Drawer, type DrawCtx, litc, shadowUnder } from './common';
import { css, mix, shade } from '../../world/palette';
import { winterYear } from '../../world/annualEnvironment';
import { hash1 } from '../../core/rng';
import { isoToScreen } from '../../core/iso';
import { Ctx, washBlob, taperStroke, granulate } from '../paint';
import { shape, limb, oval } from '../animalBrush';

type P = { x: number; y: number };

const BARK = { r: 128, g: 102, b: 74 };
const BARK_DARK = { r: 92, g: 72, b: 52 };
const MOSS = { r: 104, g: 130, b: 86 };
const SNOW = { r: 238, g: 243, b: 248 };

/** Точка объекта: along/across в тайлах, h в пикселях. rot 1/3 меняет оси местами. */
function at(d: DrawCtx, a: number, b: number, h = 0): P {
  const p = d.obj.rot % 2 === 0 ? isoToScreen(a, b) : isoToScreen(b, a);
  return { x: d.x + p.x, y: d.y + p.y - h };
}

/** Полоса-линия по точкам (снежные шапки, блики, волокно). */
function lineAt(ctx: Ctx, pts: P[], color: string, w: number): void {
  ctx.strokeStyle = color;
  ctx.lineWidth = w;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
  ctx.stroke();
}

/** Куб в изометрии: крышка и два грани, видимые камере (a=a1 и b=b1). */
function isoBox(
  ctx: Ctx,
  d: DrawCtx,
  a0: number,
  b0: number,
  a1: number,
  b1: number,
  h0: number,
  h1: number,
  top: string,
  faceA: string,
  faceB: string,
): void {
  const A = at(d, a0, b0, h1),
    B = at(d, a1, b0, h1),
    C = at(d, a1, b1, h1),
    D = at(d, a0, b1, h1);
  const B0 = at(d, a1, b0, h0),
    C0 = at(d, a1, b1, h0),
    D0 = at(d, a0, b1, h0);
  shape(ctx, faceA, () => {
    ctx.moveTo(B0.x, B0.y);
    ctx.lineTo(C0.x, C0.y);
    ctx.lineTo(C.x, C.y);
    ctx.lineTo(B.x, B.y);
  });
  shape(ctx, faceB, () => {
    ctx.moveTo(D0.x, D0.y);
    ctx.lineTo(C0.x, C0.y);
    ctx.lineTo(C.x, C.y);
    ctx.lineTo(D.x, D.y);
  });
  shape(ctx, top, () => {
    ctx.moveTo(A.x, A.y);
    ctx.lineTo(B.x, B.y);
    ctx.lineTo(C.x, C.y);
    ctx.lineTo(D.x, D.y);
  });
}

/** Цилиндр по экранным координатам: пояс и крышка-эллипс (2:1). */
function isoCyl(ctx: Ctx, cx: number, cy: number, r: number, h: number, side: string, top: string): void {
  ctx.fillStyle = side;
  ctx.beginPath();
  ctx.moveTo(cx - r, cy - h);
  ctx.lineTo(cx - r, cy);
  ctx.ellipse(cx, cy, r, r * 0.5, 0, Math.PI, 0, true);
  ctx.lineTo(cx + r, cy - h);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = top;
  ctx.beginPath();
  ctx.ellipse(cx, cy - h, r, r * 0.5, 0, 0, Math.PI * 2);
  ctx.fill();
}

/** Торец бревна/полена: годовые кольца и трещина. */
function cutFace(ctx: Ctx, x: number, y: number, r: number, seed: number, face: string, ring: string): void {
  ctx.fillStyle = face;
  ctx.beginPath();
  ctx.ellipse(x, y, r, r * 0.55, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = ring;
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.ellipse(x, y, r * 0.62, r * 0.34, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(x, y, r * 0.28, r * 0.16, 0, 0, Math.PI * 2);
  ctx.stroke();
  const a = hash1(seed, 77) * Math.PI * 2;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + Math.cos(a) * r * 0.9, y + Math.sin(a) * r * 0.5 * 0.9);
  ctx.stroke();
}

/**
 * Замшелое повалённое бревно — ящерицы греются на тёплой коре.
 * Толстое тело вдоль изометрии, торец с кольцами, мох шапками.
 */
export const drawMossLog: Drawer = (d) => {
  const { ctx, atm, obj } = d;
  shadowUnder(d, 40, 12, 1);
  const L = 0.72;
  const R = 5.4;
  const bark = litc(BARK, atm);
  const barkDark = litc(BARK_DARK, atm);
  const barkTop = litc({ r: 158, g: 130, b: 98 }, atm);
  const cut = litc({ r: 198, g: 172, b: 132 }, atm);
  const moss = litc(MOSS, atm);
  const snow = winterYear(atm.time.now).snow;

  const farC = at(d, -L, 0, 5.4),
    nearC = at(d, L, 0, 5.4);
  // тело — капсула: круглые торцы держат силуэт цилиндра
  ctx.strokeStyle = css(bark, 0.96);
  ctx.lineWidth = R * 2;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(farC.x, farC.y);
  ctx.lineTo(nearC.x, nearC.y);
  ctx.stroke();
  // нижняя полутень
  ctx.strokeStyle = css(barkDark, 0.4);
  ctx.lineWidth = 2.6;
  ctx.beginPath();
  ctx.moveTo(farC.x + 2, farC.y + R * 0.55);
  ctx.lineTo(nearC.x - 2, nearC.y + R * 0.55);
  ctx.stroke();
  // светлая верхняя грань
  ctx.strokeStyle = css(barkTop, 0.7);
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(farC.x + 2, farC.y - R * 0.5);
  ctx.lineTo(nearC.x - 2, nearC.y - R * 0.5);
  ctx.stroke();
  // прожилки коры
  ctx.strokeStyle = css(barkDark, 0.45);
  ctx.lineWidth = 0.8;
  for (let i = 0; i < 3; i++) {
    const t0 = -0.62 + hash1(obj.seed, 13 + i) * 0.85;
    const t1 = t0 + 0.35 + hash1(obj.seed, 23 + i) * 0.3;
    const p0 = at(d, Math.max(-L + 0.08, t0), 0, 6.4 + i * 1.1);
    const p1 = at(d, Math.min(L - 0.06, t1), 0, 6.4 + i * 1.1);
    ctx.beginPath();
    ctx.moveTo(p0.x, p0.y);
    ctx.lineTo(p1.x, p1.y);
    ctx.stroke();
  }
  // ответвление-шестерка
  const bx = at(d, -0.15 + hash1(obj.seed, 5) * 0.45, 0, 8.6);
  taperStroke(ctx, bx.x, bx.y, bx.x + 5, bx.y - 5.4, 2.3, 0.7, bark, 0.92);
  oval(ctx, bx.x + 5, bx.y - 5.8, 1.2, 1.2, css(barkDark, 0.9));
  // ближний торец с кольцами
  cutFace(ctx, nearC.x, nearC.y, R - 0.2, obj.seed, css(cut, 0.97), css(bark, 0.65));
  // мох шапками по верху
  for (let i = 0; i < 3; i++) {
    const t = -0.55 + i * 0.5 + hash1(obj.seed, 11 + i) * 0.2;
    const p = at(d, t, 0, 9);
    washBlob(ctx, p.x, p.y, 6.5 + hash1(obj.seed, 31 + i) * 2.5, 2.7, moss, obj.seed + i * 7, {
      layers: 2,
      alpha: 0.5,
      edge: 0.18,
      wobble: 0.3,
    });
  }
  // мох на торце
  ctx.fillStyle = css(moss, 0.6);
  ctx.beginPath();
  ctx.ellipse(nearC.x - 1.4, nearC.y + 1.8, 2.6, 1.5, 0.4, 0, Math.PI * 2);
  ctx.fill();
  if (snow > 0.05) {
    lineAt(
      ctx,
      [
        { x: farC.x + 3, y: farC.y - R - 0.6 },
        { x: nearC.x - 3, y: nearC.y - R - 0.6 },
      ],
      css(SNOW, 0.85 * snow),
      3.4,
    );
  }
};

/** Старый пень — пристанище ежей и мышей. */
export const drawStump: Drawer = (d) => {
  const { ctx, atm, obj } = d;
  shadowUnder(d, 11, 5, 1);
  const bark = litc(BARK, atm);
  const barkDark = litc(BARK_DARK, atm);
  const barkTop = litc({ r: 158, g: 130, b: 98 }, atm);
  const cut = litc({ r: 202, g: 176, b: 138 }, atm);
  const moss = litc(MOSS, atm);
  const snow = winterYear(atm.time.now).snow;
  const h = 12 + hash1(obj.seed, 5) * 3.5;

  // корни-лапы
  for (let i = 0; i < 4; i++) {
    const s = [-1.4, -0.5, 0.5, 1.4][i];
    taperStroke(ctx, d.x + s * 4.5, d.y - 1.5, d.x + s * 8.5, d.y + 1.5 - Math.abs(s) * 0.6, 2.6, 0.8, barkDark, 0.9);
  }
  // тело
  isoCyl(ctx, d.x, d.y - 0.5, 8, h, css(bark, 0.96), css(cut, 0.97));
  // вертикальные трещины коры
  ctx.strokeStyle = css(barkDark, 0.55);
  ctx.lineWidth = 1;
  for (let i = -2; i <= 2; i++) {
    const x = d.x + i * 3;
    if (Math.abs(i) === 2 && hash1(obj.seed, 9 + i + 2) < 0.4) continue;
    ctx.beginPath();
    ctx.moveTo(x + 0.6, d.y - 2.4);
    ctx.quadraticCurveTo(x, d.y - h * 0.55, x - 0.4, d.y - h + 1);
    ctx.stroke();
  }
  ctx.strokeStyle = css(barkTop, 0.5);
  ctx.lineWidth = 0.9;
  ctx.beginPath();
  ctx.moveTo(d.x - 5.4, d.y - 2.2);
  ctx.quadraticCurveTo(d.x - 6.4, d.y - h * 0.6, d.x - 5.8, d.y - h + 1.4);
  ctx.stroke();
  // годовой ободок на торце + трещина
  ctx.strokeStyle = css(bark, 0.7);
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.ellipse(d.x, d.y - h - 0.5, 5, 2.5, 0, 0, Math.PI * 2);
  ctx.stroke();
  const ca = hash1(obj.seed, 31) * Math.PI * 2;
  ctx.beginPath();
  ctx.moveTo(d.x, d.y - h - 0.5);
  ctx.lineTo(d.x + Math.cos(ca) * 6.8, d.y - h - 0.5 + Math.sin(ca) * 3.3);
  ctx.stroke();
  // мох по кромке торца и на боку
  const ma = hash1(obj.seed, 41) * Math.PI * 2;
  ctx.fillStyle = css(moss, 0.62);
  ctx.beginPath();
  ctx.ellipse(d.x + Math.cos(ma) * 5.6, d.y - h - 0.5 + Math.sin(ma) * 2.7, 3.2, 1.5, ma, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = css(moss, 0.4);
  ctx.beginPath();
  ctx.ellipse(d.x + 6.4, d.y - h * 0.4, 2.4, 3.4, 0.5, 0, Math.PI * 2);
  ctx.fill();
  // на боку — пара опят
  if (hash1(obj.seed, 55) > 0.45) {
    const cap = litc({ r: 186, g: 138, b: 92 }, atm);
    for (let s = -1; s <= 1; s += 2) {
      const mx = d.x + s * 7.6,
        my = d.y - 3.4 - hash1(obj.seed, 61 + (s > 0 ? 1 : 0)) * 2;
      ctx.strokeStyle = css({ r: 226, g: 214, b: 188 }, 0.9);
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(mx, my + 1.6);
      ctx.lineTo(mx - s * 0.8, my);
      ctx.stroke();
      ctx.fillStyle = css(cap, 0.92);
      ctx.beginPath();
      ctx.ellipse(mx - s * 0.8, my, 2.6, 1.7, s * 0.5, Math.PI, 0);
      ctx.closePath();
      ctx.fill();
    }
  }
  if (snow > 0.05) {
    ctx.fillStyle = css(SNOW, 0.9 * snow);
    ctx.beginPath();
    ctx.ellipse(d.x, d.y - h - 0.9, 7.4, 3.3, 0, 0, Math.PI * 2);
    ctx.fill();
  }
};

/** Семья опят — выглядывают после дождя. */
export const drawMushrooms: Drawer = (d) => {
  const { ctx, atm, obj } = d;
  shadowUnder(d, 10, 4.5, 0.7);
  const stem = litc({ r: 228, g: 216, b: 190 }, atm);
  const capA = litc({ r: 172, g: 122, b: 78 }, atm);
  const capB = litc({ r: 194, g: 104, b: 80 }, atm);
  const capEdge = litc({ r: 128, g: 84, b: 56 }, atm);
  const moss = litc(MOSS, atm);

  // почвенное пятно-гнездо
  washBlob(ctx, d.x, d.y - 1, 12, 4.4, moss, obj.seed, { layers: 2, alpha: 0.4, edge: 0.14, wobble: 0.3 });

  const n = 4 + Math.floor(hash1(obj.seed, 7) * 3);
  const caps: { x: number; y: number; h: number; r: number; k: number; i: number }[] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + hash1(obj.seed, i) * 0.9;
    const rr = 3 + hash1(obj.seed, 17 + i) * 7;
    caps.push({
      x: d.x + Math.cos(a) * rr,
      y: d.y + Math.sin(a) * rr * 0.42,
      h: 5.5 + hash1(obj.seed, 13 + i) * 5.5,
      r: 2.8 + hash1(obj.seed, 29 + i) * 2.6,
      k: i % 2,
      i,
    });
  }
  // дальние первые — ближние перекрывают
  caps.sort((p, q) => p.y - q.y);
  for (const c of caps) {
    const lean = (hash1(obj.seed, 71 + c.i) - 0.5) * 2.4;
    const tx = c.x + lean,
      ty = c.y - c.h;
    // ножка с лёгким изгибом
    ctx.strokeStyle = css(stem, 0.95);
    ctx.lineWidth = 1.9;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(c.x, c.y);
    ctx.quadraticCurveTo(c.x + lean * 0.4, c.y - c.h * 0.6, tx, ty + c.r * 0.5);
    ctx.stroke();
    // шляпка-колокольчик
    ctx.fillStyle = css(c.k === 0 ? capA : capB, 0.95);
    ctx.beginPath();
    ctx.moveTo(tx - c.r, ty + c.r * 0.55);
    ctx.quadraticCurveTo(tx - c.r * 0.55, ty - c.r * 0.9, tx, ty - c.r * 1.15);
    ctx.quadraticCurveTo(tx + c.r * 0.55, ty - c.r * 0.9, tx + c.r, ty + c.r * 0.55);
    ctx.quadraticCurveTo(tx, ty + c.r * 0.95, tx - c.r, ty + c.r * 0.55);
    ctx.closePath();
    ctx.fill();
    // тёмная кромка и светлая окантовка низа
    ctx.strokeStyle = css(capEdge, 0.5);
    ctx.lineWidth = 0.7;
    ctx.beginPath();
    ctx.moveTo(tx - c.r, ty + c.r * 0.55);
    ctx.quadraticCurveTo(tx - c.r * 0.55, ty - c.r * 0.9, tx, ty - c.r * 1.15);
    ctx.stroke();
    ctx.strokeStyle = css(stem, 0.55);
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(tx - c.r * 0.85, ty + c.r * 0.5);
    ctx.quadraticCurveTo(tx, ty + c.r * 0.8, tx + c.r * 0.85, ty + c.r * 0.5);
    ctx.stroke();
  }
  // споры-крапинки
  ctx.fillStyle = css(stem, 0.35);
  for (let i = 0; i < 4; i++) {
    const a = hash1(obj.seed, 83 + i) * Math.PI * 2;
    ctx.beginPath();
    ctx.ellipse(d.x + Math.cos(a) * 10, d.y + Math.sin(a) * 4, 0.7, 0.5, 0, 0, Math.PI * 2);
    ctx.fill();
  }
};

/** Низкий деревянный заборчик: стойки-шесты со скошенным верхом и две перекладины. */
export const drawFenceWood: Drawer = (d) => {
  const { ctx, atm, obj } = d;
  shadowUnder(d, 46, 11, 0.9);
  const wood = litc({ r: 162, g: 124, b: 86 }, atm);
  const woodDark = litc({ r: 116, g: 88, b: 60 }, atm);
  const woodDeep = litc({ r: 84, g: 62, b: 44 }, atm);
  const woodLight = litc({ r: 200, g: 164, b: 122 }, atm);
  const snow = winterYear(atm.time.now).snow;
  const L = 0.95;

  // перекладины — тонкие брусья с гранями
  for (const [h0, h1] of [
    [7.5, 11],
    [15.5, 19],
  ] as const) {
    isoBox(
      ctx,
      d,
      -L - 0.04,
      -0.035,
      L + 0.04,
      0.035,
      h0,
      h1,
      css(woodLight, 0.95),
      css(woodDark, 0.95),
      css(wood, 0.95),
    );
  }
  // стойки — шесты со скошенным верхом
  const posts = [-0.9, -0.3, 0.3, 0.9];
  for (let i = 0; i < posts.length; i++) {
    const t = posts[i];
    const ph = 23 + hash1(obj.seed, 40 + i) * 2.5;
    isoBox(
      ctx,
      d,
      t - 0.045,
      -0.045,
      t + 0.045,
      0.045,
      0,
      ph,
      css(woodLight, 0.97),
      css(woodDark, 0.97),
      css(wood, 0.97),
    );
    // скошенная шапка
    const c1 = at(d, t - 0.045, -0.045, ph),
      c2 = at(d, t + 0.045, -0.045, ph),
      c3 = at(d, t + 0.045, 0.045, ph),
      c4 = at(d, t - 0.045, 0.045, ph),
      tip = at(d, t, 0, ph + 3.4);
    shape(ctx, css(wood, 0.97), () => {
      ctx.moveTo(c1.x, c1.y);
      ctx.lineTo(c2.x, c2.y);
      ctx.lineTo(tip.x, tip.y);
    });
    shape(ctx, css(woodDark, 0.97), () => {
      ctx.moveTo(c4.x, c4.y);
      ctx.lineTo(c3.x, c3.y);
      ctx.lineTo(tip.x, tip.y);
    });
    // посадка в землю
    ctx.fillStyle = css(woodDeep, 0.35);
    ctx.beginPath();
    ctx.ellipse(at(d, t, 0.02, 0).x, at(d, t, 0.02, 0).y - 0.4, 5.4, 2.4, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  // снег: бровка на верхней перекладине и шапки на стойках
  if (snow > 0.05) {
    lineAt(ctx, [at(d, -L - 0.02, 0, 19.6), at(d, L + 0.02, 0, 19.6)], css(SNOW, 0.85 * snow), 2.6);
    ctx.fillStyle = css(SNOW, 0.9 * snow);
    for (let i = 0; i < posts.length; i++) {
      const p = at(d, posts[i], 0, 24.2 + hash1(obj.seed, 40 + i) * 2.5);
      ctx.beginPath();
      ctx.ellipse(p.x, p.y, 3, 1.6, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }
};

/** Каменная ограда — сухая кладка из плоских плит, со мхом в швах. */
export const drawFenceStone: Drawer = (d) => {
  const { ctx, atm, obj } = d;
  shadowUnder(d, 46, 11, 0.95);
  const grey = litc({ r: 150, g: 147, b: 139 }, atm);
  const greyDark = litc({ r: 112, g: 109, b: 103 }, atm);
  const greyLight = litc({ r: 182, g: 179, b: 171 }, atm);
  const moss = litc(MOSS, atm);
  const snow = winterYear(atm.time.now).snow;
  const L = 0.95;

  // ряды плит вразбежку; верхний ряд местами укорочен — живой гребень
  const rows: { h0: number; h1: number; off: number; n: number }[] = [
    { h0: 0, h1: 5.6, off: 0, n: 4 },
    { h0: 4.8, h1: 10.2, off: 0.16, n: 4 },
    { h0: 9.4, h1: 14.4, off: 0.05, n: 3 },
  ];
  for (let row = 0; row < rows.length; row++) {
    const r = rows[row];
    for (let i = 0; i < r.n; i++) {
      let len = 0.42 + hash1(obj.seed, row * 7 + i) * 0.12;
      if (row === 2 && hash1(obj.seed, 90 + i) > 0.65) len *= 0.6;
      const a0 = -L + (i * (2 * L)) / r.n + r.off + hash1(obj.seed, 30 + row * 3 + i) * 0.03;
      const a1 = Math.min(a0 + len, L + 0.02);
      const c = hash1(obj.seed, 50 + row * 5 + i) > 0.5 ? grey : greyDark;
      isoBox(ctx, d, a0, -0.1, a1, 0.1, r.h0, r.h1, css(greyLight, 0.92), css(shade(c, 0.82), 0.95), css(c, 0.95));
      // тёмная кромка сверху — плита отсвечивает
      const e0 = at(d, a0, 0.1, r.h1),
        e1 = at(d, a1, 0.1, r.h1);
      lineAt(ctx, [e0, e1], css(greyDark, 0.4), 0.7);
    }
  }
  // мох в швах и на плитах
  for (let i = 0; i < 4; i++) {
    const a = -L + 0.25 + i * 0.5 + hash1(obj.seed, 70 + i) * 0.2;
    const p = at(d, a, 0.06, 5.2 + hash1(obj.seed, 80 + i) * 8);
    ctx.fillStyle = css(moss, 0.5);
    ctx.beginPath();
    ctx.ellipse(p.x, p.y, 2.6, 1.1, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  // галька у подножия
  ctx.fillStyle = css(greyDark, 0.6);
  for (let i = 0; i < 3; i++) {
    const a = -L * 0.7 + i * L * 0.55;
    const p = at(d, a, 0.12, 0.4);
    ctx.beginPath();
    ctx.ellipse(p.x, p.y, 2.2, 1.1, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  if (snow > 0.05) {
    const pts: P[] = [];
    for (let i = 0; i <= 8; i++) pts.push(at(d, -L * 0.9 + (i / 8) * L * 1.8, 0.06, 14.9));
    lineAt(ctx, pts, css(SNOW, 0.85 * snow), 2.2);
  }
};

/** Дзидзо — каменный страж в красном нагруднике и шапочке. */
export const drawJizo: Drawer = (d) => {
  const { ctx, atm } = d;
  shadowUnder(d, 9, 5, 1);
  const stone = litc({ r: 158, g: 155, b: 149 }, atm);
  const stoneDark = litc({ r: 116, g: 114, b: 108 }, atm);
  const stoneLight = litc({ r: 186, g: 184, b: 178 }, atm);
  const red = litc({ r: 186, g: 78, b: 66 }, atm);
  const redDark = litc({ r: 148, g: 54, b: 48 }, atm);
  const moss = litc(MOSS, atm);
  const snow = winterYear(atm.time.now).snow;

  // постамента
  isoBox(
    ctx,
    d,
    -0.17,
    -0.13,
    0.17,
    0.13,
    0,
    3.6,
    css(stoneLight, 0.96),
    css(shade(stone, 0.8), 0.96),
    css(stone, 0.96),
  );
  const y0 = d.y - 3.6;

  // тело — колокол
  shape(ctx, css(stone, 0.97), () => {
    ctx.moveTo(d.x - 7.2, y0);
    ctx.bezierCurveTo(d.x - 7.6, y0 - 8, d.x - 6.4, y0 - 13, d.x - 4.2, y0 - 15.4);
    ctx.quadraticCurveTo(d.x, y0 - 17.4, d.x + 4.2, y0 - 15.4);
    ctx.bezierCurveTo(d.x + 6.4, y0 - 13, d.x + 7.6, y0 - 8, d.x + 7.2, y0);
    ctx.closePath();
  });
  // боковая полутень и блик
  ctx.fillStyle = css(stoneDark, 0.32);
  ctx.beginPath();
  ctx.ellipse(d.x + 3.4, y0 - 7.5, 2.8, 8.4, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = css(stoneLight, 0.4);
  ctx.beginPath();
  ctx.ellipse(d.x - 3.6, y0 - 8.5, 1.8, 5.4, 0.15, 0, Math.PI * 2);
  ctx.fill();

  // голова
  ctx.fillStyle = css(stone, 0.97);
  ctx.beginPath();
  ctx.arc(d.x, y0 - 20.6, 5.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = css(stoneLight, 0.4);
  ctx.beginPath();
  ctx.ellipse(d.x - 1.8, y0 - 22.2, 2, 2.4, 0, 0, Math.PI * 2);
  ctx.fill();

  // руки, сложены перед грудью
  limb(ctx, css(stoneDark, 0.55), 2.2, [
    [d.x - 5.6, y0 - 11],
    [d.x - 2, y0 - 7.6],
    [d.x + 1.4, y0 - 8.2],
  ]);
  limb(ctx, css(stoneDark, 0.55), 2.2, [
    [d.x + 5.6, y0 - 11],
    [d.x + 2, y0 - 8.4],
    [d.x - 1.4, y0 - 8.8],
  ]);

  // нагрудник (хаппи) с подгибом
  ctx.fillStyle = css(red, 0.94);
  ctx.beginPath();
  ctx.moveTo(d.x - 4.6, y0 - 13.4);
  ctx.quadraticCurveTo(d.x, y0 - 11.6, d.x + 4.6, y0 - 13.4);
  ctx.lineTo(d.x + 5.4, y0 - 6);
  ctx.quadraticCurveTo(d.x, y0 - 4.2, d.x - 5.4, y0 - 6);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = css(redDark, 0.6);
  ctx.lineWidth = 0.9;
  ctx.beginPath();
  ctx.moveTo(d.x - 5.1, y0 - 6.6);
  ctx.quadraticCurveTo(d.x, y0 - 5, d.x + 5.1, y0 - 6.6);
  ctx.stroke();

  // шапочка
  ctx.fillStyle = css(red, 0.96);
  ctx.beginPath();
  ctx.arc(d.x, y0 - 21.4, 5.3, Math.PI, 0);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = css(redDark, 0.55);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(d.x - 5.3, y0 - 21.4);
  ctx.lineTo(d.x + 5.3, y0 - 21.4);
  ctx.stroke();

  // лицо: две точки и тихая улыбка
  ctx.fillStyle = css(stoneDark, 0.85);
  ctx.beginPath();
  ctx.arc(d.x - 1.7, y0 - 19.6, 0.55, 0, Math.PI * 2);
  ctx.arc(d.x + 1.7, y0 - 19.6, 0.55, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = css(stoneDark, 0.75);
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.arc(d.x, y0 - 18.6, 1.7, 0.3, Math.PI - 0.3);
  ctx.stroke();

  // лишайник и мох у подножия
  ctx.fillStyle = css(moss, 0.55);
  ctx.beginPath();
  ctx.ellipse(d.x - 4, y0 - 2, 3.4, 1.7, 0.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = css(stoneDark, 0.3);
  for (const [ox, oy] of [
    [-3, -12],
    [4, -9],
    [2, -5],
  ]) {
    ctx.beginPath();
    ctx.ellipse(d.x + ox, y0 + oy, 1.4, 0.9, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  if (snow > 0.05) {
    ctx.fillStyle = css(SNOW, 0.9 * snow);
    ctx.beginPath();
    ctx.ellipse(d.x, y0 - 24.6, 4.6, 1.9, 0, 0, Math.PI * 2);
    ctx.fill();
    const p0 = at(d, -0.16, 0.1, 3.7),
      p1 = at(d, 0.16, 0.1, 3.7);
    shape(ctx, css(SNOW, 0.85 * snow), () => {
      ctx.moveTo(p0.x, p0.y);
      ctx.lineTo(p1.x, p1.y);
      ctx.lineTo(p1.x, p1.y + 1.3);
      ctx.lineTo(p0.x, p0.y + 1.3);
    });
  }
};

/** Старый колодец: каменное кольцо, ворот с черпаком и двускатная крыша. */
export const drawWell: Drawer = (d) => {
  const { ctx, atm, obj } = d;
  shadowUnder(d, 32, 14, 1);
  const stone = litc({ r: 142, g: 139, b: 131 }, atm);
  const stoneDark = litc({ r: 102, g: 100, b: 94 }, atm);
  const stoneLight = litc({ r: 172, g: 169, b: 161 }, atm);
  const wood = litc({ r: 140, g: 108, b: 76 }, atm);
  const woodDark = litc({ r: 98, g: 74, b: 52 }, atm);
  const roof = litc({ r: 96, g: 101, b: 110 }, atm);
  const roofDark = litc({ r: 70, g: 75, b: 84 }, atm);
  const water = litc(atm.palette.water, atm, 0.02);
  const moss = litc(MOSS, atm);
  const snow = winterYear(atm.time.now).snow;

  const y0 = d.y;
  // дальняя стойка — за кольцом
  isoBox(
    ctx,
    d,
    -0.38 - 0.03,
    -0.03,
    -0.38 + 0.03,
    0.03,
    1,
    39,
    css(wood, 0.97),
    css(woodDark, 0.97),
    css(woodDark, 0.97),
  );
  // стена кольца
  isoCyl(ctx, d.x, y0, 26, 13, css(stone, 0.96), css(stoneLight, 0.96));
  // кладка: швы на видимой (передней) половине и средний ряд
  ctx.strokeStyle = css(stoneDark, 0.5);
  ctx.lineWidth = 0.8;
  for (let i = 0; i < 6; i++) {
    const a = Math.PI * (0.16 + i * 0.144);
    const sx = Math.cos(a),
      sy = Math.sin(a);
    ctx.beginPath();
    ctx.moveTo(d.x + sx * 24.8, y0 + sy * 12.4);
    ctx.lineTo(d.x + sx * 24.8, y0 - 13 + sy * 12.4);
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.ellipse(d.x, y0 - 6.4, 26, 13, 0, 0.25, Math.PI - 0.25);
  ctx.stroke();
  // чаша и вода
  ctx.fillStyle = css({ r: 26, g: 30, b: 38 }, 0.96);
  ctx.beginPath();
  ctx.ellipse(d.x, y0 - 13, 15.5, 7.4, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = css(water, 0.9);
  ctx.beginPath();
  ctx.ellipse(d.x, y0 - 12.6, 13, 6, 0, 0, Math.PI * 2);
  ctx.fill();
  // периодическая рябь и блик
  const rip = (d.time * 0.0004 + hash1(obj.seed, 91) * 1000) % 1;
  ctx.strokeStyle = css({ r: 210, g: 226, b: 228 }, 0.3 * (1 - rip));
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.ellipse(d.x, y0 - 12.6, 2 + rip * 9, 0.9 + rip * 4, 0, 0, Math.PI * 2);
  ctx.stroke();
  if (atm.time.daylight > 0.45) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = css({ r: 240, g: 250, b: 250 }, 0.14);
    ctx.beginPath();
    ctx.ellipse(d.x - 4, y0 - 13.4, 3.6, 1.3, -0.25, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  // обод: светлая кромка
  ctx.strokeStyle = css(stoneLight, 0.9);
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.ellipse(d.x, y0 - 13, 26, 13, 0, 0, Math.PI * 2);
  ctx.stroke();
  // мох у подножия
  for (const s of [-1, 1]) {
    ctx.fillStyle = css(moss, 0.55);
    ctx.beginPath();
    ctx.ellipse(d.x + s * 17, y0 - 1.4, 4.6, 2, s * 0.4, 0, Math.PI * 2);
    ctx.fill();
  }

  // ближняя стойка — перед кольцом
  isoBox(
    ctx,
    d,
    0.38 - 0.03,
    -0.03,
    0.38 + 0.03,
    0.03,
    1,
    39,
    css(wood, 0.97),
    css(woodDark, 0.97),
    css(woodDark, 0.97),
  );
  // перекладина-ворот
  isoBox(ctx, d, -0.4, -0.024, 0.4, 0.024, 33.5, 36.5, css(wood, 0.97), css(woodDark, 0.97), css(woodDark, 0.97));
  // барабан ворот и вертел
  ctx.fillStyle = css(woodDark, 0.95);
  ctx.beginPath();
  ctx.ellipse(d.x, y0 - 35, 3, 3.6, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = css(wood, 0.8);
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(d.x, y0 - 38.4);
  ctx.lineTo(d.x + 3.4, y0 - 33.4);
  ctx.stroke();
  // верёвка и черпак
  const bx = d.x + (hash1(obj.seed, 61) - 0.5) * 9;
  ctx.strokeStyle = css(stoneDark, 0.75);
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.moveTo(d.x, y0 - 35);
  ctx.quadraticCurveTo((d.x + bx) / 2, y0 - 26, bx, y0 - 19.5);
  ctx.stroke();
  ctx.fillStyle = css(wood, 0.96);
  ctx.beginPath();
  ctx.moveTo(bx - 2.6, y0 - 19.5);
  ctx.lineTo(bx + 2.6, y0 - 19.5);
  ctx.lineTo(bx + 1.9, y0 - 14.6);
  ctx.lineTo(bx - 1.9, y0 - 14.6);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = css(woodDark, 0.7);
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.ellipse(bx, y0 - 19.5, 2.6, 1.2, 0, 0, Math.PI * 2);
  ctx.stroke();

  // крыша: конёк вдоль b, два ската по сторонам a
  const eaveH = 36.5,
    ridgeH = 62,
    eave = 0.5,
    end = 0.38;
  // дальний скат (сторона -a)
  {
    const f0 = at(d, -eave, -end, eaveH),
      f1 = at(d, -eave, end, eaveH),
      f2 = at(d, 0, end, ridgeH),
      f3 = at(d, 0, -end, ridgeH);
    shape(ctx, css(roofDark, 0.96), () => {
      ctx.moveTo(f0.x, f0.y);
      ctx.lineTo(f1.x, f1.y);
      ctx.lineTo(f2.x, f2.y);
      ctx.lineTo(f3.x, f3.y);
    });
  }
  // ближний скат (сторона +a)
  {
    const n0 = at(d, eave, -end, eaveH),
      n1 = at(d, eave, end, eaveH),
      n2 = at(d, 0, end, ridgeH),
      n3 = at(d, 0, -end, ridgeH);
    shape(ctx, css(roof, 0.97), () => {
      ctx.moveTo(n0.x, n0.y);
      ctx.lineTo(n1.x, n1.y);
      ctx.lineTo(n2.x, n2.y);
      ctx.lineTo(n3.x, n3.y);
    });
    // черепица — ряды, параллельные карнизу
    ctx.strokeStyle = css(roofDark, 0.4);
    ctx.lineWidth = 0.8;
    for (const t of [0.35, 0.65]) {
      const a_t = eave * (1 - t),
        h_t = eaveH + (ridgeH - eaveH) * t;
      const p0 = at(d, a_t, -end, h_t),
        p1 = at(d, a_t, end, h_t);
      ctx.beginPath();
      ctx.moveTo(p0.x, p0.y);
      ctx.lineTo(p1.x, p1.y);
      ctx.stroke();
    }
  }
  // ближний фронтон (b=+end)
  {
    const g0 = at(d, -eave, end, eaveH),
      g1 = at(d, eave, end, eaveH),
      g2 = at(d, 0, end, ridgeH);
    shape(ctx, css(shade(roof, 0.72), 0.96), () => {
      ctx.moveTo(g0.x, g0.y);
      ctx.lineTo(g1.x, g1.y);
      ctx.lineTo(g2.x, g2.y);
    });
  }
  // конёк и передние карнизы
  lineAt(ctx, [at(d, 0, end, ridgeH), at(d, 0, -end, ridgeH)], css(roofDark, 0.95), 3);
  lineAt(ctx, [at(d, -eave, end, eaveH), at(d, eave, end, eaveH)], css(roofDark, 0.8), 2.2);
  lineAt(ctx, [at(d, eave, -end, eaveH), at(d, eave, end, eaveH)], css(roofDark, 0.8), 2.2);
  if (snow > 0.05) {
    lineAt(ctx, [at(d, 0, end, ridgeH), at(d, 0, -end, ridgeH)], css(SNOW, 0.9 * snow), 3.4);
    // снежная лопата на ближнем скате
    ctx.fillStyle = css(SNOW, 0.75 * snow);
    const s0 = at(d, 0.48, -0.38, eaveH + 2.4),
      s1 = at(d, 0.48, 0.38, eaveH + 2.4),
      s2 = at(d, 0.22, 0.3, eaveH + 10.5),
      s3 = at(d, 0.22, -0.3, eaveH + 10.5);
    ctx.beginPath();
    ctx.moveTo(s0.x, s0.y);
    ctx.lineTo(s1.x, s1.y);
    ctx.lineTo(s2.x, s2.y);
    ctx.lineTo(s3.x, s3.y);
    ctx.closePath();
    ctx.fill();
  }
};

/** Садовая скамья — присесть и слушать воду. */
export const drawGardenBench: Drawer = (d) => {
  const { ctx, atm, obj } = d;
  shadowUnder(d, 44, 12, 0.9);
  const wood = litc({ r: 158, g: 120, b: 84 }, atm);
  const woodDark = litc({ r: 112, g: 84, b: 58 }, atm);
  const woodDeep = litc({ r: 84, g: 62, b: 44 }, atm);
  const woodLight = litc({ r: 198, g: 162, b: 120 }, atm);
  const cloth = litc({ r: 176, g: 98, b: 82 }, atm);
  const snow = winterYear(atm.time.now).snow;

  // царга между настилами
  isoBox(ctx, d, -0.62, -0.022, 0.62, 0.022, 3.6, 5.6, css(woodDark, 0.95), css(woodDeep, 0.95), css(woodDeep, 0.95));
  // настилы-ножки: плоские пластины под краями сиденья
  for (const s of [-0.72, 0.72]) {
    isoBox(
      ctx,
      d,
      s - 0.055,
      -0.16,
      s + 0.055,
      0.16,
      0,
      13,
      css(woodLight, 0.95),
      css(woodDark, 0.95),
      css(wood, 0.95),
    );
  }
  // сиденье из пяти досок вдоль скамьи
  const planks = 5,
    pw = 0.3,
    gap = 0.028;
  const aStart = -((planks * pw + (planks - 1) * gap) / 2);
  for (let i = 0; i < planks; i++) {
    const a0 = aStart + i * (pw + gap),
      a1 = a0 + pw;
    const hTop = 16 + hash1(obj.seed, 11 + i) * 0.8;
    isoBox(ctx, d, a0, -0.15, a1, 0.15, hTop - 3.4, hTop, css(wood, 0.97), css(woodDeep, 0.97), css(woodDark, 0.97));
    // волокно вдоль доски
    const g0 = at(d, a0 + 0.045, -0.07, hTop),
      g1 = at(d, a1 - 0.045, 0.07, hTop);
    lineAt(ctx, [g0, g1], css(woodDark, 0.4), 0.7);
  }
  // скатка на сиденье — место, где тепло
  if (hash1(obj.seed, 71) > 0.35) {
    const ca0 = 0.14 + hash1(obj.seed, 81) * 0.1;
    isoBox(
      ctx,
      d,
      ca0,
      -0.1,
      ca0 + 0.34,
      0.1,
      16.6,
      19.4,
      css(cloth, 0.95),
      css(shade(cloth, 0.75), 0.95),
      css(shade(cloth, 0.88), 0.95),
    );
    const k0 = at(d, ca0 + 0.1, -0.09, 19.5),
      k1 = at(d, ca0 + 0.24, 0.09, 19.5);
    lineAt(ctx, [k0, k1], css(shade(cloth, 0.7), 0.7), 1);
  }
  if (snow > 0.05) {
    lineAt(ctx, [at(d, -0.8, 0, 17.4), at(d, 0.8, 0, 17.4)], css(SNOW, 0.85 * snow), 2.4);
  }
};

/** Поленница — аккуратный запас на зиму. */
export const drawWoodpile: Drawer = (d) => {
  const { ctx, atm, obj } = d;
  shadowUnder(d, 22, 10, 1);
  const bark = litc(BARK, atm);
  const barkDark = litc(BARK_DARK, atm);
  const cut = litc({ r: 216, g: 192, b: 152 }, atm);
  const cutDark = litc({ r: 182, g: 156, b: 118 }, atm);
  const wood = litc({ r: 142, g: 108, b: 76 }, atm);
  const woodLight = litc({ r: 198, g: 162, b: 120 }, atm);
  const woodDark = litc({ r: 100, g: 76, b: 54 }, atm);
  const snow = winterYear(atm.time.now).snow;
  const R = 4.4;

  // колыбели-подпорки на концах
  for (const s of [-0.24, 0.3]) {
    const baseL = at(d, s, -0.15, 0),
      baseR = at(d, s, 0.15, 0),
      apexL = at(d, s + 0.05, -0.07, 12),
      apexR = at(d, s - 0.05, 0.07, 12);
    taperStroke(ctx, baseL.x, baseL.y, apexL.x, apexL.y, 2.6, 1.6, barkDark, 0.95);
    taperStroke(ctx, baseR.x, baseR.y, apexR.x, apexR.y, 2.6, 1.6, barkDark, 0.95);
  }
  // дальняя стена штабеля — тёмная масса (верх — пустота между поленьями)
  isoBox(
    ctx,
    d,
    -0.3,
    -0.13,
    0.32,
    0.13,
    1.6,
    15.4,
    css(shade(bark, 0.58), 0.95),
    css(shade(bark, 0.82), 0.95),
    css(bark, 0.95),
  );
  // ряды торцов: три — два — одно
  const rows: { h: number; bs: number[] }[] = [
    { h: 1.6 + R, bs: [-0.088, 0, 0.088] },
    { h: 1.6 + R + R * 1.73, bs: [-0.044, 0.044] },
    { h: 1.6 + R + R * 3.46, bs: [0] },
  ];
  let n = 0;
  for (const row of rows)
    for (const b of row.bs) {
      const p = at(d, 0.33, b, row.h);
      // тёмный зазор за поленим — отделяет торцы друг от друга
      ctx.fillStyle = css({ r: 34, g: 25, b: 18 }, 0.55);
      ctx.beginPath();
      ctx.ellipse(p.x - 1.4, p.y - 1, R * 1.12, R * 0.8, -0.3, 0, Math.PI * 2);
      ctx.fill();
      cutFace(
        ctx,
        p.x,
        p.y,
        R,
        obj.seed + n * 13,
        n % 2 === 0 ? css(cut, 0.97) : css(cutDark, 0.97),
        css(barkDark, 0.8),
      );
      n++;
    }
  // швы между поленьями на боковой грани
  ctx.strokeStyle = css(barkDark, 0.55);
  ctx.lineWidth = 0.9;
  for (const h of [1.6 + R + R * 0.87, 1.6 + R * 2.6]) {
    const p0 = at(d, -0.24, 0.13, h),
      p1 = at(d, 0.28, 0.13, h);
    ctx.beginPath();
    ctx.moveTo(p0.x, p0.y);
    ctx.lineTo(p1.x, p1.y);
    ctx.stroke();
  }
  // крыша-доска
  isoBox(ctx, d, -0.36, -0.16, 0.38, 0.16, 25.2, 27, css(wood, 0.96), css(woodDark, 0.96), css(woodDark, 0.96));
  lineAt(ctx, [at(d, -0.3, -0.15, 27.2), at(d, 0.32, 0.14, 27.2)], css(woodLight, 0.5), 0.8);
  // щепка у основания
  const sh = at(d, 0.44, 0.1, 0.6);
  ctx.strokeStyle = css(cutDark, 0.7);
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(sh.x, sh.y);
  ctx.lineTo(sh.x + 4, sh.y - 1.2);
  ctx.stroke();
  if (snow > 0.05) {
    lineAt(ctx, [at(d, -0.32, -0.12, 27.4), at(d, 0.34, 0.12, 27.4)], css(SNOW, 0.85 * snow), 2.2);
  }
};

/** Скворечник на столбике; весной синицы таскают туда подстилку. */
export const drawNestbox: Drawer = (d) => {
  const { ctx, atm, obj } = d;
  shadowUnder(d, 7, 4, 1);
  const wood = litc({ r: 152, g: 118, b: 84 }, atm);
  const woodDark = litc(BARK_DARK, atm);
  const woodLight = litc({ r: 196, g: 162, b: 122 }, atm);
  const roof = litc({ r: 104, g: 96, b: 86 }, atm);
  const roofDark = litc({ r: 72, g: 66, b: 58 }, atm);
  const snow = winterYear(atm.time.now).snow;

  // столбик с прижимной галькой
  ctx.fillStyle = css(woodDark, 0.55);
  ctx.beginPath();
  ctx.ellipse(d.x, d.y - 0.5, 4.4, 2, 0, 0, Math.PI * 2);
  ctx.fill();
  taperStroke(ctx, d.x, d.y - 0.5, d.x, d.y - 38, 3.2, 2.4, woodDark, 0.95);

  // домик: объёмный бокс
  isoBox(ctx, d, -0.13, -0.115, 0.13, 0.115, 36, 50, css(woodLight, 0.9), css(woodDark, 0.97), css(wood, 0.97));
  // доски на передней стенке — от верха до низа грани
  const wall0 = at(d, -0.13, 0.115, 36),
    wall1 = at(d, 0.13, 0.115, 36);
  ctx.strokeStyle = css(woodDark, 0.4);
  ctx.lineWidth = 0.6;
  for (let i = 1; i < 3; i++) {
    const t = i / 3;
    const x = wall0.x + (wall1.x - wall0.x) * t,
      yb = wall0.y + (wall1.y - wall0.y) * t;
    ctx.beginPath();
    ctx.moveTo(x, yb);
    ctx.lineTo(x, yb - 14);
    ctx.stroke();
  }
  // леток и шесток
  const hole = at(d, 0, 0.12, 45);
  ctx.fillStyle = css({ r: 34, g: 28, b: 24 }, 0.95);
  ctx.beginPath();
  ctx.arc(hole.x, hole.y, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = css(woodLight, 0.8);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(hole.x, hole.y, 3, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = css(woodDark, 0.9);
  ctx.lineWidth = 1.4;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(hole.x, hole.y + 3.4);
  ctx.lineTo(hole.x, hole.y + 5.6);
  ctx.stroke();

  // крыша-двускат с карнизом
  const e0 = at(d, -0.155, -0.14, 50),
    e1 = at(d, 0.155, -0.14, 50),
    e2 = at(d, 0.155, 0.14, 50),
    e3 = at(d, -0.155, 0.14, 50);
  const r0 = at(d, 0.155, 0, 57.5),
    r1 = at(d, -0.155, 0, 57.5);
  shape(ctx, css(roofDark, 0.96), () => {
    ctx.moveTo(e0.x, e0.y);
    ctx.lineTo(e1.x, e1.y);
    ctx.lineTo(r0.x, r0.y);
  });
  shape(ctx, css(roof, 0.97), () => {
    ctx.moveTo(e2.x, e2.y);
    ctx.lineTo(e3.x, e3.y);
    ctx.lineTo(r1.x, r1.y);
    ctx.lineTo(r0.x, r0.y);
  });
  lineAt(ctx, [r0, r1], css(roofDark, 0.95), 2.2);
  lineAt(ctx, [e2, e3], css(roofDark, 0.8), 1.6);
  if (snow > 0.05) {
    lineAt(ctx, [r0, r1], css(SNOW, 0.9 * snow), 2.6);
    ctx.fillStyle = css(SNOW, 0.8 * snow);
    const s0 = at(d, 0.11, 0.12, 51),
      s1 = at(d, -0.11, 0.12, 51),
      s2 = at(d, -0.02, 0.02, 56.4);
    ctx.beginPath();
    ctx.moveTo(s0.x, s0.y);
    ctx.lineTo(s1.x, s1.y);
    ctx.lineTo(s2.x, s2.y);
    ctx.closePath();
    ctx.fill();
  }

  // синица у летка: приходит волнами
  const season = atm.season;
  const visit = (season === 'spring' || season === 'summer') && Math.floor((d.time + obj.seed * 977) / 9000) % 3 === 0;
  if (visit) {
    const bx = hole.x + 1.2,
      by = hole.y + 5.4;
    // хвост
    limb(ctx, css(litc({ r: 70, g: 76, b: 84 }, atm), 0.9), 1.6, [
      [bx + 1.6, by + 0.6],
      [bx + 4.6, by + 2.4],
    ]);
    // тело
    ctx.fillStyle = css(litc({ r: 214, g: 218, b: 190 }, atm), 0.97);
    ctx.beginPath();
    ctx.ellipse(bx, by, 2.7, 2.1, -0.3, 0, Math.PI * 2);
    ctx.fill();
    // жёлтое горлышко
    ctx.fillStyle = css(litc({ r: 232, g: 208, b: 128 }, atm), 0.95);
    ctx.beginPath();
    ctx.ellipse(bx - 0.8, by + 0.7, 1.7, 1.3, -0.3, 0, Math.PI * 2);
    ctx.fill();
    // голова с чёрным «платком» и белым пятачком
    ctx.fillStyle = css(litc({ r: 62, g: 68, b: 76 }, atm), 0.97);
    ctx.beginPath();
    ctx.arc(bx - 2.2, by - 1.5, 1.7, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = css({ r: 240, g: 238, b: 230 }, 0.95);
    ctx.beginPath();
    ctx.arc(bx - 2.5, by - 1.2, 0.7, 0, Math.PI * 2);
    ctx.fill();
    // клюв
    limb(ctx, css(litc({ r: 210, g: 190, b: 120 }, atm), 0.95), 0.8, [
      [bx - 3.7, by - 1.7],
      [bx - 5.2, by - 2.1],
    ]);
  }
};

/** Гамак на стойках-рогатинах — коты уже знают, чей он. */
export const drawHammock: Drawer = (d) => {
  const { ctx, atm, obj } = d;
  shadowUnder(d, 42, 12, 0.9);
  const woodDark = litc(BARK_DARK, atm);
  const woodDeep = litc({ r: 66, g: 50, b: 36 }, atm);
  const cloth = litc({ r: 232, g: 222, b: 200 }, atm);
  const clothDark = litc({ r: 196, g: 182, b: 156 }, atm);
  const stripe = litc({ r: 178, g: 98, b: 84 }, atm);
  const snow = winterYear(atm.time.now).snow;

  const sway = Math.sin(d.time * 0.0011 + obj.seed) * 1.6 * Math.min(1, Math.abs(d.wind) + 0.25);
  const attachH = 20;
  const sagTop = 7,
    clothW = 10;

  // стойки-рогатины
  for (const s of [-0.78, 0.78]) {
    const apex = at(d, s, 0, 27.5);
    const bl = at(d, s - 0.02, -0.16, 0);
    const br = at(d, s + 0.02, 0.16, 0);
    taperStroke(ctx, bl.x, bl.y, apex.x - 1, apex.y, 3.8, 2.4, woodDark, 0.96);
    taperStroke(ctx, br.x, br.y, apex.x + 1, apex.y, 3.8, 2.4, woodDark, 0.96);
    // перекладинка
    const c0 = at(d, s - 0.02, -0.09, 9),
      c1 = at(d, s + 0.02, 0.09, 9);
    lineAt(ctx, [c0, c1], css(woodDeep, 0.8), 2);
    // суковатая головка
    oval(ctx, apex.x, apex.y - 1, 2.6, 2.2, css(woodDark, 0.96));
    ctx.strokeStyle = css(woodDeep, 0.6);
    ctx.lineWidth = 0.9;
    ctx.beginPath();
    ctx.moveTo(apex.x, apex.y - 2);
    ctx.lineTo(apex.x + 2.4, apex.y - 4.6);
    ctx.stroke();
  }

  // точки крепления; середина провисает вдвое ниже управляющей точки
  const Lp = at(d, -0.58, 0, attachH),
    Rp = at(d, 0.58, 0, attachH);
  const ctrlTop = at(d, 0, 0, attachH - 2 * sagTop + 2 * sway);
  const ctrlBot = { x: d.x, y: ctrlTop.y + clothW };

  // верёвки от головок к краям
  ctx.strokeStyle = css(woodDeep, 0.75);
  ctx.lineWidth = 1;
  for (const s of [-1, 1]) {
    const ax = s < 0 ? Lp : Rp;
    const apex = at(d, s * 0.78, 0, 27);
    ctx.beginPath();
    ctx.moveTo(ax.x, ax.y - 1);
    ctx.quadraticCurveTo((ax.x + apex.x) / 2, (ax.y + apex.y) / 2 - 2, apex.x, apex.y);
    ctx.stroke();
    ctx.lineWidth = 0.7;
    ctx.beginPath();
    ctx.moveTo(ax.x + s * 1.4, ax.y + 0.8);
    ctx.lineTo(apex.x, apex.y + 1.5);
    ctx.stroke();
    ctx.lineWidth = 1;
  }

  // полотнище: верхний и нижний края с провисом
  shape(ctx, css(cloth, 0.96), () => {
    ctx.moveTo(Lp.x, Lp.y);
    ctx.quadraticCurveTo(ctrlTop.x, ctrlTop.y, Rp.x, Rp.y);
    ctx.lineTo(Rp.x, Rp.y + clothW);
    ctx.quadraticCurveTo(ctrlBot.x, ctrlBot.y, Lp.x, Lp.y + clothW);
    ctx.closePath();
  });
  // полосы вдоль полотна
  for (const [off, wdt, col] of [
    [clothW * 0.34, 2, css(stripe, 0.9)],
    [clothW * 0.68, 1.4, css(stripe, 0.7)],
    [1.2, 1.1, css(clothDark, 0.75)],
  ] as const) {
    ctx.strokeStyle = col;
    ctx.lineWidth = wdt;
    ctx.beginPath();
    ctx.moveTo(Lp.x + 1.5, Lp.y + off);
    ctx.quadraticCurveTo(ctrlTop.x, ctrlTop.y + off, Rp.x - 1.5, Rp.y + off);
    ctx.stroke();
  }
  // блик по верхнему краю
  ctx.strokeStyle = css({ r: 250, g: 246, b: 234 }, 0.75);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(Lp.x + 1, Lp.y + 0.5);
  ctx.quadraticCurveTo(ctrlTop.x, ctrlTop.y + 0.5, Rp.x - 1, Rp.y + 0.5);
  ctx.stroke();
  // завернутые края
  oval(ctx, Lp.x, Lp.y + clothW / 2, 2.4, clothW * 0.68, css(clothDark, 0.95));
  oval(ctx, Rp.x, Rp.y + clothW / 2, 2.4, clothW * 0.68, css(clothDark, 0.95));
  if (snow > 0.05) {
    ctx.strokeStyle = css(SNOW, 0.7 * snow);
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(Lp.x + 2, Lp.y - 0.6);
    ctx.quadraticCurveTo(ctrlTop.x, ctrlTop.y - 0.6, Rp.x - 2, Rp.y - 0.6);
    ctx.stroke();
  }
};

/** Мататаби — кошачья радость; весной и в начале лета в белых звёздочках. */
export const drawMatatabi: Drawer = (d) => {
  const { ctx, atm, g, obj } = d;
  const scale = 0.4 + 0.6 * Math.pow(g, 0.7);
  shadowUnder(d, 12 * scale, 5.5 * scale, 0.8);
  const autumn = atm.season === 'autumn';
  const leafBase = litc({ r: 118, g: 152, b: 96 }, atm);
  const leaf = autumn ? mix(leafBase, { r: 176, g: 142, b: 78 }, 0.35) : leafBase;
  const leafDeep = autumn
    ? mix(litc({ r: 92, g: 124, b: 78 }, atm), { r: 150, g: 112, b: 62 }, 0.3)
    : litc({ r: 92, g: 124, b: 78 }, atm);
  const twig = litc(BARK_DARK, atm);
  const snow = winterYear(atm.time.now).snow;

  if (snow > 0.5) {
    // зимой — голые прутья под снегом
    for (let i = -2; i <= 2; i++) {
      taperStroke(
        ctx,
        d.x + i * 2.2 * scale,
        d.y,
        d.x + i * 4.6 * scale,
        d.y - (9 + (2 - Math.abs(i)) * 2.4) * scale,
        1.4,
        0.5,
        twig,
        0.9,
      );
    }
    lineAt(
      ctx,
      [
        { x: d.x - 8 * scale, y: d.y - 10 * scale },
        { x: d.x, y: d.y - 13.5 * scale },
        { x: d.x + 8 * scale, y: d.y - 10 * scale },
      ],
      css(SNOW, 0.75 * snow),
      1.6,
    );
    return;
  }

  // ветви-каркас
  ctx.strokeStyle = css(twig, 0.8);
  ctx.lineWidth = 1.1;
  for (let i = -1; i <= 1; i++) {
    ctx.beginPath();
    ctx.moveTo(d.x + i * 2 * scale, d.y);
    ctx.quadraticCurveTo(d.x + i * 3 * scale, d.y - 6 * scale, d.x + i * 4 * scale, d.y - 10 * scale);
    ctx.stroke();
  }
  // крона тремя мазками с мягкой кромкой
  washBlob(ctx, d.x - 3.4 * scale, d.y - 7.5 * scale, 7.5 * scale, 5.6 * scale, leafDeep, obj.seed, {
    layers: 2,
    alpha: 0.6,
    edge: 0.14,
    wobble: 0.24,
  });
  washBlob(ctx, d.x + 3 * scale, d.y - 9.5 * scale, 8.2 * scale, 6.2 * scale, leaf, obj.seed + 3, {
    layers: 3,
    alpha: 0.6,
    edge: 0.18,
    wobble: 0.22,
  });
  washBlob(ctx, d.x, d.y - 12.5 * scale, 6.4 * scale, 4.4 * scale, leaf, obj.seed + 6, {
    layers: 2,
    alpha: 0.5,
    edge: 0.12,
    wobble: 0.26,
  });
  // тёмные точки листвы
  granulate(ctx, d.x, d.y - 10 * scale, 9 * scale, 6.5 * scale, leafDeep, obj.seed + 11, 14, 0.18);
  // белые звёздочки — весна и начало лета
  if (atm.season === 'spring' || atm.season === 'summer') {
    for (let i = 0; i < 7; i++) {
      const a = hash1(obj.seed, i) * Math.PI * 2;
      const rr = (4 + hash1(obj.seed, 10 + i) * 5.5) * scale;
      const x = d.x + Math.cos(a) * rr,
        y = d.y - (9 + hash1(obj.seed, 20 + i) * 5) * scale + Math.sin(a) * rr * 0.45;
      for (let p = 0; p < 5; p++) {
        const pa = (p / 5) * Math.PI * 2 + a;
        ctx.fillStyle = css({ r: 250, g: 250, b: 240 }, 0.92);
        ctx.beginPath();
        ctx.ellipse(x + Math.cos(pa) * 1.3, y + Math.sin(pa) * 1.3, 1.05, 0.6, pa, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = css({ r: 226, g: 206, b: 130 }, 0.9);
      ctx.beginPath();
      ctx.arc(x, y, 0.55, 0, Math.PI * 2);
      ctx.fill();
    }
  }
};

/** Дзен-грабли: деревянные грабли для сада камней. */
export const drawZenRake: Drawer = (d) => {
  const { ctx, atm } = d;
  shadowUnder(d, 10, 4.5, 0.85);
  const wood = litc({ r: 188, g: 148, b: 104 }, atm);
  const woodDark = litc({ r: 132, g: 98, b: 64 }, atm);
  const woodLight = litc({ r: 218, g: 184, b: 142 }, atm);
  const snow = winterYear(atm.time.now).snow;

  // Рукоять: наклонена вдоль изометрической диагонали
  const top = at(d, -0.22, -0.24, 28);
  const head = at(d, 0.16, 0.14, 3);

  // Тень от рукояти
  const shadowHead = at(d, 0.16, 0.14, 0);
  const shadowTop = at(d, -0.22 + (atm.sunDir?.x ?? 0) * 0.12, -0.24 + (atm.sunDir?.y ?? 1) * 0.12, 0);
  lineAt(ctx, [shadowHead, shadowTop], css(atm.shadowTint, 0.18 * atm.shadowAmount), 1.8);

  // Поперечный брусок (гребёнка)
  const bar0 = at(d, 0.32, -0.04, 3.5);
  const bar1 = at(d, 0.0, 0.32, 2.5);

  // Зубья гребёнки (5 деревянных зубьев в сторону земли)
  ctx.strokeStyle = css(woodDark, 0.95);
  ctx.lineWidth = 1.2;
  ctx.lineCap = 'round';
  for (let i = 0; i < 5; i++) {
    const t = i / 4;
    const bt = at(d, 0.32 * (1 - t), 0.32 * t + 0.02 * (1 - t) - 0.04 * (1 - t), 3);
    const tip = at(d, 0.32 * (1 - t) + 0.03, 0.32 * t + 0.03, 0);
    ctx.beginPath();
    ctx.moveTo(bt.x, bt.y);
    ctx.lineTo(tip.x, tip.y);
    ctx.stroke();
  }

  // Сам поперечный брусок
  lineAt(ctx, [bar0, bar1], css(woodDark, 0.95), 3.2);
  lineAt(ctx, [bar0, bar1], css(woodLight, 0.75), 1.4);

  // Длинная рукоять грабель
  lineAt(ctx, [head, top], css(woodDark, 0.95), 2.8);
  lineAt(ctx, [head, top], css(wood, 0.9), 2.0);
  lineAt(ctx, [head, top], css(woodLight, 0.65), 0.8);

  // Место крепления (шпагат)
  ctx.fillStyle = css(woodDark, 0.95);
  ctx.beginPath();
  ctx.ellipse(head.x, head.y, 2.2, 1.8, 0, 0, Math.PI * 2);
  ctx.fill();

  // Снежная полоска зимой
  if (snow > 0.08) {
    lineAt(ctx, [bar0, bar1], css(SNOW, 0.85 * snow), 2.0);
    lineAt(ctx, [head, top], css(SNOW, 0.7 * snow), 1.2);
  }
};

/**
 * Полноценный сад камней 5×5 (Карэсансуй):
 * деревянный бордюр (кадоми), гравийное ложе с камнями и стоящие у края грабли.
 */
export const drawRockGarden: Drawer = (d) => {
  const { ctx, atm } = d;
  const wood = litc({ r: 168, g: 124, b: 84 }, atm);
  const woodDark = litc({ r: 92, g: 64, b: 40 }, atm);
  const woodLight = litc({ r: 205, g: 168, b: 122 }, atm);
  const stone = litc({ r: 140, g: 144, b: 140 }, atm);
  const stoneDark = litc({ r: 85, g: 88, b: 85 }, atm);
  const moss = litc(atm.palette.moss ?? { r: 120, g: 140, b: 90 }, atm);
  const snow = winterYear(atm.time.now).snow;

  // 1. Деревянный бордюр (кадоми) по периметру 5×5
  const c00 = at(d, 0, 0, 0);
  const c50 = at(d, 5, 0, 0);
  const c55 = at(d, 5, 5, 0);
  const c05 = at(d, 0, 5, 0);

  // 0. Внутреннее ложе сада: ровный мелкий гравий и песок
  const gravelBase = litc({ r: 218, g: 212, b: 200 }, atm);
  const gravelShade = litc({ r: 188, g: 180, b: 168 }, atm);
  ctx.fillStyle = css(gravelBase, 1.0);
  ctx.beginPath();
  ctx.moveTo(c00.x, c00.y);
  ctx.lineTo(c50.x, c50.y);
  ctx.lineTo(c55.x, c55.y);
  ctx.lineTo(c05.x, c05.y);
  ctx.closePath();
  ctx.fill();

  // Нежная текстура гравийных борозд внутри ложа
  ctx.strokeStyle = css(gravelShade, 0.45);
  ctx.lineWidth = 1.1;
  for (let i = 1; i <= 8; i++) {
    const t = i / 9;
    const p1 = { x: c00.x + (c05.x - c00.x) * t, y: c00.y + (c05.y - c00.y) * t };
    const p2 = { x: c50.x + (c55.x - c50.x) * t, y: c50.y + (c55.y - c50.y) * t };
    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.stroke();
  }

  // Тень под бордюром
  ctx.strokeStyle = css(atm.shadowTint, 0.22 * atm.shadowAmount);
  ctx.lineWidth = 6;
  ctx.lineJoin = 'miter';
  ctx.beginPath();
  ctx.moveTo(c00.x, c00.y + 2);
  ctx.lineTo(c50.x, c50.y + 2);
  ctx.lineTo(c55.x, c55.y + 2);
  ctx.lineTo(c05.x, c05.y + 2);
  ctx.closePath();
  ctx.stroke();

  // Основа деревянного бруса бордюра
  ctx.strokeStyle = css(woodDark, 0.96);
  ctx.lineWidth = 5.5;
  ctx.beginPath();
  ctx.moveTo(c00.x, c00.y);
  ctx.lineTo(c50.x, c50.y);
  ctx.lineTo(c55.x, c55.y);
  ctx.lineTo(c05.x, c05.y);
  ctx.closePath();
  ctx.stroke();

  // Светлое волокно дерева
  ctx.strokeStyle = css(wood, 0.85);
  ctx.lineWidth = 3.2;
  ctx.stroke();

  ctx.strokeStyle = css(woodLight, 0.5);
  ctx.lineWidth = 1.2;
  ctx.stroke();

  // Металлические угловые скобы на стыках бруса
  for (const corner of [c00, c50, c55, c05]) {
    ctx.fillStyle = css(woodDark, 0.98);
    ctx.beginPath();
    ctx.arc(corner.x, corner.y, 3.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = css(woodLight, 0.7);
    ctx.beginPath();
    ctx.arc(corner.x, corner.y, 1.2, 0, Math.PI * 2);
    ctx.fill();
  }

  // 2. Острова камней с мхом
  // Главный вертикальный камень
  const s1 = at(d, 2.2, 2.0, 0);
  shadowUnder({ ...d, x: s1.x, y: s1.y }, 16, 7, 0.75);

  // Каменное тело
  ctx.fillStyle = css(stoneDark, 0.95);
  ctx.beginPath();
  ctx.moveTo(s1.x - 12, s1.y);
  ctx.lineTo(s1.x - 6, s1.y - 22);
  ctx.lineTo(s1.x + 3, s1.y - 25);
  ctx.lineTo(s1.x + 11, s1.y - 6);
  ctx.lineTo(s1.x + 8, s1.y + 3);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = css(stone, 0.88);
  ctx.beginPath();
  ctx.moveTo(s1.x - 6, s1.y - 22);
  ctx.lineTo(s1.x + 3, s1.y - 25);
  ctx.lineTo(s1.x + 9, s1.y - 8);
  ctx.lineTo(s1.x - 2, s1.y - 2);
  ctx.closePath();
  ctx.fill();

  // Моховая шапка у основания
  ctx.fillStyle = css(moss, 0.85);
  ctx.beginPath();
  ctx.ellipse(s1.x - 4, s1.y - 2, 7, 3.5, -0.2, 0, Math.PI * 2);
  ctx.fill();

  // Второй плоский камень-спутник
  const s2 = at(d, 3.2, 2.8, 0);
  shadowUnder({ ...d, x: s2.x, y: s2.y }, 12, 5, 0.7);
  ctx.fillStyle = css(stoneDark, 0.95);
  ctx.beginPath();
  ctx.ellipse(s2.x, s2.y - 4, 9, 5, 0.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = css(stone, 0.85);
  ctx.beginPath();
  ctx.ellipse(s2.x - 1, s2.y - 5, 7, 3.8, 0.2, 0, Math.PI * 2);
  ctx.fill();

  // 3. Стоящие у кромки сада деревянные грабли (готовые к рисованию)
  const rBase = at(d, 4.3, 0.8, 0);
  const rTop = at(d, 3.9, 0.3, 30);
  const rHeadL = at(d, 4.5, 0.6, 2);
  const rHeadR = at(d, 4.1, 1.0, 2);

  // Тень от граблей на песке
  lineAt(
    ctx,
    [rBase, { x: rBase.x + (atm.sunDir?.x ?? 0.5) * 12, y: rBase.y + (atm.sunDir?.y ?? 1) * 8 }],
    css(atm.shadowTint, 0.22 * atm.shadowAmount),
    2.0,
  );

  // Бамбуковая рукоять
  lineAt(ctx, [rBase, rTop], css(woodDark, 0.95), 2.8);
  lineAt(ctx, [rBase, rTop], css(litc({ r: 218, g: 184, b: 122 }, atm), 0.95), 1.8);
  // Кольца на бамбуке
  for (const t of [0.35, 0.65]) {
    const p = { x: rBase.x + (rTop.x - rBase.x) * t, y: rBase.y + (rTop.y - rBase.y) * t };
    ctx.fillStyle = css(woodDark, 0.95);
    ctx.beginPath();
    ctx.arc(p.x, p.y, 1.6, 0, Math.PI * 2);
    ctx.fill();
  }

  // Колодка граблей с зубьями
  lineAt(ctx, [rHeadL, rHeadR], css(woodDark, 0.96), 3.4);
  lineAt(ctx, [rHeadL, rHeadR], css(woodLight, 0.75), 1.4);
  // 5 маленьких зубьев, касающихся гравия
  ctx.strokeStyle = css(woodDark, 0.95);
  ctx.lineWidth = 1.2;
  for (let i = 0; i < 5; i++) {
    const t = i / 4;
    const px = rHeadL.x + (rHeadR.x - rHeadL.x) * t;
    const py = rHeadL.y + (rHeadR.y - rHeadL.y) * t;
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.lineTo(px + 0.5, py + 3);
    ctx.stroke();
  }

  // Зимний снег
  if (snow > 0.08) {
    lineAt(ctx, [c00, c50], css(SNOW, 0.85 * snow), 2.2);
    lineAt(ctx, [c00, c05], css(SNOW, 0.85 * snow), 2.2);
    ctx.fillStyle = css(SNOW, 0.9 * snow);
    ctx.beginPath();
    ctx.ellipse(s1.x - 2, s1.y - 25, 6, 2.5, 0, 0, Math.PI * 2);
    ctx.fill();
    lineAt(ctx, [rHeadL, rHeadR], css(SNOW, 0.8 * snow), 1.6);
  }
};
