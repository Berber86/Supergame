/** Постройки: беседка, тории, раздвижные панели дома. */

import { Drawer, WHITE, litc, shadowUnder } from './common';
import { TILE_H, TILE_W } from '../../core/iso';
import { lerp } from '../../core/rng';
import { css, mix, shade } from '../../world/palette';
import { Ctx, granulate, softShadow } from '../paint';

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
