/** Низкоуровневая «акварельная» кисть: мягкие пятна, зернистость пигмента, тёмная кромка. */

import { hash2, makeRng } from '../core/rng';
import { RGB, css, mix, shade } from '../world/palette';

export type Ctx = CanvasRenderingContext2D;

export function makeCanvas(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.ceil(w));
  c.height = Math.max(1, Math.ceil(h));
  return c;
}

/** Неровный многоугольник-клякса вокруг центра. */
export function blobPath(
  ctx: Ctx,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  seed: number,
  wobble = 0.22,
  pts = 9,
): void {
  ctx.beginPath();
  const step = (Math.PI * 2) / pts;
  const prev: [number, number][] = [];
  for (let i = 0; i < pts; i++) {
    const a = i * step;
    const w = 1 + (hash2(i, seed, 3) - 0.5) * 2 * wobble;
    prev.push([cx + Math.cos(a) * rx * w, cy + Math.sin(a) * ry * w]);
  }
  ctx.moveTo((prev[0][0] + prev[pts - 1][0]) / 2, (prev[0][1] + prev[pts - 1][1]) / 2);
  for (let i = 0; i < pts; i++) {
    const cur = prev[i];
    const next = prev[(i + 1) % pts];
    ctx.quadraticCurveTo(cur[0], cur[1], (cur[0] + next[0]) / 2, (cur[1] + next[1]) / 2);
  }
  ctx.closePath();
}

/** Акварельное пятно: несколько наложенных слоёв с дрожанием + тёмная кромка. */
export function washBlob(
  ctx: Ctx,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  color: RGB,
  seed: number,
  opts: { layers?: number; alpha?: number; edge?: number; wobble?: number } = {},
): void {
  const layers = opts.layers ?? 3;
  const alpha = opts.alpha ?? 0.42;
  const wobble = opts.wobble ?? 0.2;
  for (let i = 0; i < layers; i++) {
    const k = 1 - i * 0.13;
    const jx = (hash2(i, seed, 17) - 0.5) * rx * 0.12;
    const jy = (hash2(i, seed, 29) - 0.5) * ry * 0.12;
    ctx.fillStyle = css(shade(color, 1 - i * 0.05), alpha);
    blobPath(ctx, cx + jx, cy + jy, rx * k, ry * k, seed + i * 13, wobble);
    ctx.fill();
  }
  const edge = opts.edge ?? 0.22;
  if (edge > 0) {
    ctx.strokeStyle = css(shade(color, 0.72), edge);
    ctx.lineWidth = Math.max(0.6, rx * 0.045);
    blobPath(ctx, cx, cy, rx * 0.99, ry * 0.99, seed + 5, wobble);
    ctx.stroke();
  }
}

/** Мягкое радиальное свечение (фонари, солнце, светлячки). */
export function glow(ctx: Ctx, cx: number, cy: number, r: number, color: RGB, strength: number): void {
  if (strength <= 0.001 || r <= 0) return;
  const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
  g.addColorStop(0, css(color, 0.85 * strength));
  g.addColorStop(0.35, css(color, 0.38 * strength));
  g.addColorStop(0.7, css(color, 0.12 * strength));
  g.addColorStop(1, css(color, 0));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
}

/** Мягкая эллиптическая тень под объектом. */
export function softShadow(
  ctx: Ctx,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  color: RGB,
  strength: number,
): void {
  if (strength <= 0.001) return;
  // Градиент задаётся в локальных координатах, уже после сдвига: координаты
  // градиента трансформируются текущей матрицей в момент отрисовки, и
  // градиент, созданный в (cx, cy) до translate, уезжал в (2cx, 2cy) —
  // за пределы пятна. Тень потому и не была видна вовсе.
  const R = Math.max(rx, ry, 0.001);
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(1, ry / R);
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, R);
  g.addColorStop(0, css(color, 0.55 * strength));
  g.addColorStop(0.55, css(color, 0.3 * strength));
  g.addColorStop(1, css(color, 0));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, R, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** Сужающийся мазок кисти (ствол, ветка, стебель). */
export function taperStroke(
  ctx: Ctx,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  w0: number,
  w1: number,
  color: RGB,
  alpha = 0.9,
  bend = 0,
): void {
  const mx = (x0 + x1) / 2 + bend;
  const my = (y0 + y1) / 2;
  const ang = Math.atan2(y1 - y0, x1 - x0);
  const nx = -Math.sin(ang);
  const ny = Math.cos(ang);
  ctx.beginPath();
  ctx.moveTo(x0 + nx * w0, y0 + ny * w0);
  ctx.quadraticCurveTo(mx + nx * ((w0 + w1) / 2), my + ny * ((w0 + w1) / 2), x1 + nx * w1, y1 + ny * w1);
  ctx.lineTo(x1 - nx * w1, y1 - ny * w1);
  ctx.quadraticCurveTo(mx - nx * ((w0 + w1) / 2), my - ny * ((w0 + w1) / 2), x0 - nx * w0, y0 - ny * w0);
  ctx.closePath();
  ctx.fillStyle = css(color, alpha);
  ctx.fill();
}

/** Зернистость пигмента — крапинки внутри области. */
export function granulate(
  ctx: Ctx,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  color: RGB,
  seed: number,
  count = 18,
  alpha = 0.16,
): void {
  const rnd = makeRng(seed | 0 || 1);
  ctx.fillStyle = css(shade(color, 0.78), alpha);
  for (let i = 0; i < count; i++) {
    const a = rnd() * Math.PI * 2;
    const rr = Math.sqrt(rnd());
    const x = cx + Math.cos(a) * rx * rr;
    const y = cy + Math.sin(a) * ry * rr;
    const s = 0.7 + rnd() * 1.6;
    ctx.beginPath();
    ctx.ellipse(x, y, s, s * 0.75, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

/** Текстура рисовой бумаги — генерируется один раз и тайлится поверх сцены. */
let paperTile: HTMLCanvasElement | null = null;
export function getPaperTile(): HTMLCanvasElement {
  if (paperTile) return paperTile;
  const size = 256;
  const c = makeCanvas(size, size);
  const g = c.getContext('2d')!;
  const img = g.createImageData(size, size);
  const rnd = makeRng(1337);
  for (let i = 0; i < size * size; i++) {
    const x = i % size;
    const y = (i / size) | 0;
    // волокна бумаги
    const fiber = Math.sin(x * 0.7 + Math.sin(y * 0.13) * 4) * 4 + Math.sin(y * 0.9) * 3;
    const n = (rnd() - 0.5) * 26 + fiber;
    const v = 128 + n;
    img.data[i * 4] = v;
    img.data[i * 4 + 1] = v;
    img.data[i * 4 + 2] = v;
    img.data[i * 4 + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  paperTile = c;
  return c;
}

/** Виньетка вокруг кадра — как у листа акварельной бумаги. */
export function vignette(ctx: Ctx, w: number, h: number, color: RGB, strength: number): void {
  const g = ctx.createRadialGradient(w / 2, h * 0.48, Math.min(w, h) * 0.32, w / 2, h * 0.5, Math.max(w, h) * 0.78);
  g.addColorStop(0, css(color, 0));
  g.addColorStop(1, css(color, strength));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}

export function withAlpha(ctx: Ctx, a: number, fn: () => void): void {
  const prev = ctx.globalAlpha;
  ctx.globalAlpha = a;
  fn();
  ctx.globalAlpha = prev;
}

export { mix };
