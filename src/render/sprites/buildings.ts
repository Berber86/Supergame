/** Постройки: беседка, тории, раздвижные панели дома. */

import { Drawer, WHITE, litc, shadowUnder } from './common';
import { TILE_H, TILE_W } from '../../core/iso';
import { lerp } from '../../core/rng';
import { css, mix, shade } from '../../world/palette';
import { Ctx, granulate, softShadow, washBlob } from '../paint';

export const drawPavilion: Drawer = (d) => {
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

export const drawTorii: Drawer = (d) => {
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

export const drawShoji: Drawer = (d) => {
  const { ctx, atm, obj } = d;
  const horiz = obj.rot % 2 === 0;
  const w = horiz ? TILE_W * 0.5 : TILE_W * 0.5;
  const h = 44;
  const frame = litc({ r: 118, g: 86, b: 66 }, atm);
  const paper = litc(
    mix({ r: 246, g: 240, b: 224 }, { r: 255, g: 220, b: 168 }, atm.lampGlow * 0.5),
    atm,
    atm.lampGlow * 0.15,
  );
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

function panelQuad(
  ctx: Ctx,
  x: number,
  y: number,
  len: number,
  height: number,
  rot: number,
): { a: { x: number; y: number }; b: { x: number; y: number } } {
  // rot 0/2 — вдоль оси X экрана, 1/3 — вдоль Y
  const along = rot % 2 === 0 ? { x: TILE_W / 2, y: TILE_H / 2 } : { x: -TILE_W / 2, y: TILE_H / 2 };
  const a = { x: x - along.x * len * 0.5, y: y - along.y * len * 0.5 };
  const b = { x: x + along.x * len * 0.5, y: y + along.y * len * 0.5 };
  void height;
  void ctx;
  return { a, b };
}

/** Фусума: раздвижная перегородка с росписью. */

export const drawFusuma: Drawer = (d) => {
  const { ctx, atm, obj } = d;
  const h = 40;
  const { a, b } = panelQuad(ctx, d.x, d.y, 0.94, h, obj.rot);
  shadowUnder(d, 22, 7, 0.7);

  const paper = litc({ r: 226, g: 214, b: 184 }, atm);
  const frame = litc({ r: 92, g: 66, b: 46 }, atm);

  // Полотно
  ctx.beginPath();
  ctx.moveTo(a.x, a.y - h);
  ctx.lineTo(b.x, b.y - h);
  ctx.lineTo(b.x, b.y);
  ctx.lineTo(a.x, a.y);
  ctx.closePath();
  ctx.fillStyle = css(paper, 1);
  ctx.fill();

  // Роспись: гора и пара сосен тушью — то, чем фусума и отличается от сёдзи
  ctx.save();
  ctx.clip();
  const ink = litc({ r: 88, g: 108, b: 110 }, atm);
  ctx.fillStyle = css(ink, 0.45);
  ctx.beginPath();
  const mx = (a.x + b.x) / 2;
  const my = (a.y + b.y) / 2;
  ctx.moveTo(mx - 20, my - 8);
  ctx.lineTo(mx - 6, my - h * 0.62);
  ctx.lineTo(mx + 3, my - h * 0.4);
  ctx.lineTo(mx + 9, my - h * 0.56);
  ctx.lineTo(mx + 22, my - 8);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = css(ink, 0.5);
  ctx.lineWidth = 1.2;
  for (let i = 0; i < 2; i++) {
    const px = mx - 14 + i * 24;
    ctx.beginPath();
    ctx.moveTo(px, my - 6);
    ctx.lineTo(px, my - 16);
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(px, my - 18, 5, 2.6, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();

  // Рама: обводим полотно заново — путь после клипа уже не тот
  ctx.beginPath();
  ctx.moveTo(a.x, a.y - h);
  ctx.lineTo(b.x, b.y - h);
  ctx.lineTo(b.x, b.y);
  ctx.lineTo(a.x, a.y);
  ctx.closePath();
  ctx.strokeStyle = css(frame, 1);
  ctx.lineWidth = 3;
  ctx.stroke();

  // Стойка посередине — фусума всегда двустворчатая
  ctx.beginPath();
  ctx.moveTo((a.x + b.x) / 2, (a.y + b.y) / 2 - h);
  ctx.lineTo((a.x + b.x) / 2, (a.y + b.y) / 2);
  ctx.lineWidth = 2;
  ctx.stroke();

  // Утопленная ручка
  ctx.fillStyle = css(litc({ r: 58, g: 50, b: 44 }, atm), 0.9);
  ctx.beginPath();
  ctx.ellipse((a.x + b.x) / 2 - 8, (a.y + b.y) / 2 - h * 0.45, 2.4, 3.4, 0, 0, Math.PI * 2);
  ctx.fill();
};

/** Токонома: ниша со свитком и одиноким цветком. */

export const drawTokonoma: Drawer = (d) => {
  const { ctx, atm, obj } = d;
  const h = 46;
  const { a, b } = panelQuad(ctx, d.x, d.y, 0.94, h, obj.rot);
  shadowUnder(d, 24, 8, 0.8);

  // Тёмная глубина ниши
  const back = litc({ r: 188, g: 174, b: 150 }, atm);
  ctx.beginPath();
  ctx.moveTo(a.x, a.y - h);
  ctx.lineTo(b.x, b.y - h);
  ctx.lineTo(b.x, b.y);
  ctx.lineTo(a.x, a.y);
  ctx.closePath();
  ctx.fillStyle = css(shade(back, 0.82), 0.97);
  ctx.fill();

  const mx = (a.x + b.x) / 2;
  const my = (a.y + b.y) / 2;

  // Свиток какэмоно
  const scroll = litc({ r: 244, g: 238, b: 222 }, atm);
  ctx.fillStyle = css(scroll, 0.96);
  ctx.fillRect(mx - 7, my - h + 5, 14, h * 0.62);
  ctx.strokeStyle = css(litc({ r: 150, g: 120, b: 92 }, atm), 0.7);
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(mx - 8, my - h + 5);
  ctx.lineTo(mx + 8, my - h + 5);
  ctx.moveTo(mx - 8, my - h + 5 + h * 0.62);
  ctx.lineTo(mx + 8, my - h + 5 + h * 0.62);
  ctx.stroke();
  // иероглиф тушью — пара мазков
  ctx.strokeStyle = css(litc({ r: 60, g: 56, b: 54 }, atm), 0.62);
  ctx.lineWidth = 1.6;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(mx - 3, my - h + 13);
  ctx.lineTo(mx + 3, my - h + 13);
  ctx.moveTo(mx, my - h + 11);
  ctx.lineTo(mx, my - h + 22);
  ctx.moveTo(mx - 4, my - h + 19);
  ctx.lineTo(mx + 4, my - h + 24);
  ctx.stroke();
  ctx.lineCap = 'butt';

  // Ваза с одной веткой
  const vase = litc({ r: 92, g: 96, b: 104 }, atm);
  ctx.fillStyle = css(vase, 0.95);
  ctx.beginPath();
  ctx.ellipse(mx + 1, my - 5, 3.4, 4.6, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = css(litc({ r: 104, g: 88, b: 74 }, atm), 0.8);
  ctx.lineWidth = 1.1;
  ctx.beginPath();
  ctx.moveTo(mx + 1, my - 9);
  ctx.quadraticCurveTo(mx + 5, my - 16, mx + 3, my - 22);
  ctx.stroke();
  const fl = atm.season === 'winter' ? { r: 226, g: 96, b: 112 } : { r: 244, g: 226, b: 236 };
  ctx.fillStyle = css(litc(fl, atm, 0.05), 0.9);
  ctx.beginPath();
  ctx.arc(mx + 3, my - 23, 2.4, 0, Math.PI * 2);
  ctx.fill();

  // Рама ниши
  ctx.strokeStyle = css(litc({ r: 112, g: 84, b: 60 }, atm), 0.95);
  ctx.lineWidth = 2.6;
  ctx.beginPath();
  ctx.moveTo(a.x, a.y - h);
  ctx.lineTo(b.x, b.y - h);
  ctx.lineTo(b.x, b.y);
  ctx.lineTo(a.x, a.y);
  ctx.closePath();
  ctx.stroke();
};

/** Ирори: очаг в полу, живой огонь и котелок. */

// ---------------- Гости: кормушка и поилка ----------------

/**
 * Кормушка: столбик, лоток с зёрнами и четырёхскатная крыша-черепица.
 * Зимой крыша держит шапку снега — стол работает в любую погоду.
 */
export const drawFeeder: Drawer = (d) => {
  const { ctx, atm, obj } = d;
  shadowUnder(d, 12, 5, 1);
  const wood = litc({ r: 146, g: 104, b: 72 }, atm);
  const woodDark = litc({ r: 104, g: 70, b: 50 }, atm);
  const roof = litc({ r: 96, g: 88, b: 92 }, atm);

  // столбик
  ctx.strokeStyle = css(woodDark, 0.95);
  ctx.lineWidth = 3.4;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(d.x, d.y);
  ctx.lineTo(d.x, d.y - 22);
  ctx.stroke();

  // лоток — ромб в перспективе сада
  ctx.fillStyle = css(wood, 0.96);
  ctx.beginPath();
  ctx.moveTo(d.x, d.y - 26);
  ctx.lineTo(d.x + 13, d.y - 22.5);
  ctx.lineTo(d.x, d.y - 19);
  ctx.lineTo(d.x - 13, d.y - 22.5);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = css(woodDark, 0.5);
  ctx.lineWidth = 1;
  ctx.stroke();
  // бортик
  ctx.strokeStyle = css(woodDark, 0.8);
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(d.x - 13, d.y - 22.5);
  ctx.lineTo(d.x, d.y - 19);
  ctx.lineTo(d.x + 13, d.y - 22.5);
  ctx.stroke();

  // зёрна в лотке
  ctx.fillStyle = css(litc({ r: 226, g: 196, b: 138 }, atm), 0.9);
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2 + obj.seed;
    ctx.beginPath();
    ctx.ellipse(d.x + Math.cos(a) * 6, d.y - 22.6 + Math.sin(a) * 2.2, 1.1, 0.7, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // угловые стойки
  ctx.strokeStyle = css(woodDark, 0.9);
  ctx.lineWidth = 1.6;
  for (const [ox, oy] of [
    [-11, -22.6],
    [11, -22.6],
    [0, -19.6],
  ]) {
    ctx.beginPath();
    ctx.moveTo(d.x + ox, d.y + oy);
    ctx.lineTo(d.x + ox * 0.72, d.y - 34);
    ctx.stroke();
  }

  // крыша: два ската с мягким прогибом
  ctx.fillStyle = css(roof, 0.96);
  ctx.beginPath();
  ctx.moveTo(d.x - 15, d.y - 33);
  ctx.quadraticCurveTo(d.x, d.y - 42, d.x + 15, d.y - 33);
  ctx.lineTo(d.x + 9, d.y - 31.4);
  ctx.quadraticCurveTo(d.x, d.y - 37.5, d.x - 9, d.y - 31.4);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = css(shade(roof, 0.75), 0.5);
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.moveTo(d.x - 12, d.y - 32.6);
  ctx.quadraticCurveTo(d.x, d.y - 39.4, d.x + 12, d.y - 32.6);
  ctx.stroke();

  // снежная шапка
  if (atm.season === 'winter') {
    ctx.fillStyle = css(litc({ r: 246, g: 248, b: 252 }, atm), 0.9);
    ctx.beginPath();
    ctx.moveTo(d.x - 13.5, d.y - 33.4);
    ctx.quadraticCurveTo(d.x, d.y - 41.4, d.x + 13.5, d.y - 33.4);
    ctx.quadraticCurveTo(d.x, d.y - 37.6, d.x - 13.5, d.y - 33.4);
    ctx.closePath();
    ctx.fill();
  }
};

/**
 * Поилка: низкая широкая чаша на каменном пеньке. Вода в ней живая —
 * круги держатся и без птиц, а летом чаша блестит на солнце.
 */
export const drawBirdbath: Drawer = (d) => {
  const { ctx, atm, obj } = d;
  shadowUnder(d, 13, 6, 1);
  const stone = litc(mix(atm.palette.stone, { r: 156, g: 152, b: 146 }, 0.45), atm);
  const stoneDark = litc(shade({ r: 128, g: 124, b: 118 }, 1), atm);

  // пенёк
  washBlob(ctx, d.x, d.y - 5, 8.5, 6, stone, obj.seed, { layers: 2, alpha: 0.7, edge: 0.3, wobble: 0.18 });
  ctx.fillStyle = css(stoneDark, 0.5);
  ctx.beginPath();
  ctx.ellipse(d.x, d.y - 2, 7.4, 2.6, 0, 0, Math.PI * 2);
  ctx.fill();

  // чаша
  ctx.fillStyle = css(stone, 0.97);
  ctx.beginPath();
  ctx.ellipse(d.x, d.y - 10, 13, 5.4, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = css(stoneDark, 0.55);
  ctx.lineWidth = 1.1;
  ctx.stroke();

  // вода
  const w = litc(atm.palette.water, atm, 0.06);
  ctx.fillStyle = css(w, 0.92);
  ctx.beginPath();
  ctx.ellipse(d.x, d.y - 10.6, 10.6, 4, 0, 0, Math.PI * 2);
  ctx.fill();
  // круги и блик
  ctx.strokeStyle = css(mix(w, WHITE, 0.6), 0.45);
  ctx.lineWidth = 0.8;
  const rip = (Math.sin(d.time * 0.0016 + obj.seed) * 0.5 + 0.5) * 7;
  ctx.beginPath();
  ctx.ellipse(d.x, d.y - 10.6, 2 + rip, 0.8 + rip * 0.36, 0, 0, Math.PI * 2);
  ctx.stroke();
  if (atm.time.daylight > 0.4) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = css({ r: 240, g: 250, b: 250 }, 0.16);
    ctx.beginPath();
    ctx.ellipse(d.x - 3.4, d.y - 11.4, 3.4, 1.1, -0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // камешки у основания
  ctx.fillStyle = css(stoneDark, 0.6);
  for (const [ox, oy, r] of [
    [-10, -1, 2.2],
    [9, 0, 1.8],
    [4, 1.4, 1.4],
  ]) {
    ctx.beginPath();
    ctx.ellipse(d.x + ox, d.y + oy, r, r * 0.6, 0, 0, Math.PI * 2);
    ctx.fill();
  }
};
