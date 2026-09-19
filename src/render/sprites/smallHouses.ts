/** Малые дома — компактные постройки для мини-садов. */

import { Drawer, WHITE, litc, shadowUnder } from './common';
import { TILE_H, TILE_W } from '../../core/iso';
import { css, mix, shade } from '../../world/palette';
import { washBlob, granulate } from '../paint';

export const drawTeaHouse: Drawer = (d) => {
  const { ctx, atm, obj } = d;
  const w = TILE_W * 0.92;
  const h = TILE_H * 0.92;
  const postH = 38;
  const wood = litc({ r: 142, g: 96, b: 68 }, atm);
  const woodDark = litc({ r: 98, g: 64, b: 46 }, atm);
  const paper = litc(
    mix({ r: 244, g: 236, b: 214 }, { r: 255, g: 214, b: 156 }, atm.lampGlow * 0.45),
    atm,
    atm.lampGlow * 0.12,
  );
  const roof = litc({ r: 86, g: 80, b: 82 }, atm);
  const roofLight = litc({ r: 156, g: 148, b: 142 }, atm);

  shadowUnder(d, w * 0.58, h * 0.42, 1.4);

  // основание — татами + веранда
  ctx.fillStyle = css(litc({ r: 188, g: 172, b: 132 }, atm), 0.96);
  ctx.beginPath();
  ctx.moveTo(d.x, d.y - h * 0.5);
  ctx.lineTo(d.x + w * 0.5, d.y);
  ctx.lineTo(d.x, d.y + h * 0.5);
  ctx.lineTo(d.x - w * 0.5, d.y);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = css(woodDark, 0.35);
  ctx.lineWidth = 1.2;
  ctx.stroke();

  // стены — три стороны сёдзи, одна открыта
  const walls: [number, number, number][] = [
    [-w * 0.38, -h * 0.18, 0],
    [w * 0.38, -h * 0.18, 0],
    [0, -h * 0.38, 1],
  ];
  for (const [ox, oy, open] of walls) {
    if (open) continue;
    ctx.fillStyle = css(paper, 0.96);
    ctx.fillRect(d.x + ox - 14, d.y + oy - postH, 28, postH * 0.72);
    ctx.strokeStyle = css(wood, 0.55);
    ctx.lineWidth = 1;
    ctx.strokeRect(d.x + ox - 14, d.y + oy - postH, 28, postH * 0.72);
    // решётка
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(d.x + ox, d.y + oy - postH);
    ctx.lineTo(d.x + ox, d.y + oy - postH * 0.28);
    ctx.moveTo(d.x + ox - 7, d.y + oy - postH * 0.5);
    ctx.lineTo(d.x + ox + 7, d.y + oy - postH * 0.5);
    ctx.stroke();
  }

  // столбы
  const posts: [number, number][] = [
    [-w * 0.42, -h * 0.02],
    [w * 0.42, -h * 0.02],
    [-w * 0.02, -h * 0.42],
    [w * 0.02, h * 0.38],
  ];
  for (const [ox, oy] of posts) {
    ctx.fillStyle = css(wood, 0.96);
    ctx.fillRect(d.x + ox - 2.5, d.y + oy - postH, 5, postH);
    ctx.fillStyle = css(woodDark, 0.85);
    ctx.fillRect(d.x + ox - 3.5, d.y + oy - postH, 7, 3);
  }

  // крыша — четырёхскатная маленькая, вогнутая
  const ry = d.y - postH - 2;
  ctx.fillStyle = css(roof, 0.96);
  ctx.beginPath();
  ctx.moveTo(d.x, ry - 22);
  ctx.quadraticCurveTo(d.x + w * 0.38, ry - 12, d.x + w * 0.66, ry + 2);
  ctx.quadraticCurveTo(d.x + w * 0.22, ry + 10, d.x, ry + 14);
  ctx.quadraticCurveTo(d.x - w * 0.22, ry + 10, d.x - w * 0.66, ry + 2);
  ctx.quadraticCurveTo(d.x - w * 0.38, ry - 12, d.x, ry - 22);
  ctx.closePath();
  ctx.fill();
  // блик
  ctx.fillStyle = css(roofLight, 0.24);
  ctx.beginPath();
  ctx.moveTo(d.x, ry - 20);
  ctx.quadraticCurveTo(d.x - w * 0.3, ry - 10, d.x - w * 0.58, ry + 1);
  ctx.quadraticCurveTo(d.x - w * 0.22, ry + 3, d.x, ry - 2);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = css(shade(roof, 0.7), 0.45);
  ctx.lineWidth = 1.2;
  ctx.stroke();

  // норэн над входом
  ctx.fillStyle = css(litc({ r: 196, g: 84, b: 68 }, atm), 0.82);
  ctx.fillRect(d.x - 10, d.y - postH * 0.32, 20, 7);
  ctx.fillStyle = css(WHITE, 0.85);
  ctx.font = '600 6px \"Noto Serif JP\"';
  ctx.textAlign = 'center';
  ctx.fillText('茶', d.x, d.y - postH * 0.32 + 5.5);

  granulate(ctx, d.x, ry, w * 0.42, 14, shade(roof, 0.7), obj.seed, 14, 0.07);

  // тёплый свет изнутри
  if (atm.lampGlow > 0.08) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = css({ r: 255, g: 196, b: 124 }, atm.lampGlow * 0.18);
    ctx.beginPath();
    ctx.ellipse(d.x, d.y - postH * 0.5, w * 0.22, h * 0.18, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
};

export const drawShed: Drawer = (d) => {
  const { ctx, atm, obj } = d;
  const w = obj.rot % 2 === 0 ? TILE_W * 0.62 : TILE_W * 0.88;
  const h = obj.rot % 2 === 0 ? TILE_H * 0.88 : TILE_H * 0.62;
  const wallH = 28;
  const wood = litc({ r: 138, g: 102, b: 72 }, atm);
  const woodDark = litc({ r: 92, g: 66, b: 48 }, atm);
  const thatch = litc({ r: 188, g: 168, b: 108 }, atm);
  const thatchDark = litc({ r: 148, g: 128, b: 84 }, atm);

  shadowUnder(d, w * 0.5, h * 0.38, 1.2);

  // стены — простые доски
  ctx.fillStyle = css(wood, 0.96);
  ctx.beginPath();
  ctx.moveTo(d.x - w * 0.42, d.y + h * 0.12);
  ctx.lineTo(d.x + w * 0.42, d.y + h * 0.12);
  ctx.lineTo(d.x + w * 0.42, d.y + h * 0.12 - wallH);
  ctx.lineTo(d.x - w * 0.42, d.y + h * 0.12 - wallH);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = css(woodDark, 0.5);
  ctx.lineWidth = 1;
  ctx.stroke();

  // доски — горизонтальные линии
  ctx.strokeStyle = css(woodDark, 0.28);
  ctx.lineWidth = 0.8;
  for (let i = 1; i < 3; i++) {
    const yy = d.y + h * 0.12 - (wallH * i) / 3;
    ctx.beginPath();
    ctx.moveTo(d.x - w * 0.42, yy);
    ctx.lineTo(d.x + w * 0.42, yy);
    ctx.stroke();
  }

  // соломенная крыша — двускатная
  const ry = d.y + h * 0.12 - wallH;
  ctx.fillStyle = css(thatch, 0.97);
  ctx.beginPath();
  ctx.moveTo(d.x - w * 0.52, ry + 2);
  ctx.lineTo(d.x, ry - 18);
  ctx.lineTo(d.x + w * 0.52, ry + 2);
  ctx.lineTo(d.x + w * 0.42, ry + 5);
  ctx.lineTo(d.x, ry - 12);
  ctx.lineTo(d.x - w * 0.42, ry + 5);
  ctx.closePath();
  ctx.fill();
  // тёмный низ соломы
  ctx.fillStyle = css(thatchDark, 0.32);
  ctx.beginPath();
  ctx.moveTo(d.x - w * 0.5, ry + 1);
  ctx.lineTo(d.x + w * 0.5, ry + 1);
  ctx.lineTo(d.x + w * 0.42, ry + 5);
  ctx.lineTo(d.x - w * 0.42, ry + 5);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = css(thatchDark, 0.4);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(d.x - w * 0.52, ry + 2);
  ctx.lineTo(d.x, ry - 18);
  ctx.lineTo(d.x + w * 0.52, ry + 2);
  ctx.stroke();

  // открытый проём с инструментами
  ctx.fillStyle = css({ r: 48, g: 42, b: 36 }, 0.78);
  ctx.fillRect(d.x - 6, d.y + h * 0.12 - wallH * 0.7, 12, wallH * 0.6);
  // грабли внутри
  ctx.strokeStyle = css(woodDark, 0.7);
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(d.x - 3, d.y + h * 0.12 - wallH * 0.65);
  ctx.lineTo(d.x - 3, d.y + h * 0.12 - wallH * 0.15);
  ctx.stroke();

  washBlob(ctx, d.x, ry - 6, w * 0.32, 8, thatchDark, obj.seed, { alpha: 0.18, edge: 0.2, wobble: 0.28 });
};

export const drawTinyHouse: Drawer = (d) => {
  const { ctx, atm, obj } = d;
  const rot = obj.rot % 2;
  const w = rot === 0 ? TILE_W * 0.78 : TILE_W * 1.12;
  const h = rot === 0 ? TILE_H * 1.12 : TILE_H * 0.78;
  const wallH = 36;
  const wood = litc({ r: 146, g: 100, b: 70 }, atm);
  const woodDark = litc({ r: 102, g: 68, b: 48 }, atm);
  const paper = litc({ r: 242, g: 234, b: 210 }, atm);
  const roof = litc({ r: 88, g: 84, b: 86 }, atm);
  const roofLight = litc({ r: 158, g: 150, b: 144 }, atm);

  shadowUnder(d, w * 0.62, h * 0.48, 1.5);

  // платформа
  ctx.fillStyle = css(litc({ r: 176, g: 136, b: 96 }, atm), 0.95);
  ctx.beginPath();
  ctx.moveTo(d.x, d.y - h * 0.48);
  ctx.lineTo(d.x + w * 0.5, d.y - h * 0.08);
  ctx.lineTo(d.x, d.y + h * 0.48);
  ctx.lineTo(d.x - w * 0.5, d.y - h * 0.08);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = css(woodDark, 0.32);
  ctx.lineWidth = 1;
  ctx.stroke();

  // коробка дома — 2 стены видны
  ctx.fillStyle = css(paper, 0.97);
  ctx.beginPath();
  ctx.moveTo(d.x - w * 0.38, d.y - h * 0.02 - wallH);
  ctx.lineTo(d.x + w * 0.22, d.y - h * 0.28 - wallH);
  ctx.lineTo(d.x + w * 0.22, d.y - h * 0.28);
  ctx.lineTo(d.x - w * 0.38, d.y - h * 0.02);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = css(shade(paper, 0.88), 0.97);
  ctx.beginPath();
  ctx.moveTo(d.x + w * 0.22, d.y - h * 0.28 - wallH);
  ctx.lineTo(d.x + w * 0.44, d.y - h * 0.12 - wallH);
  ctx.lineTo(d.x + w * 0.44, d.y - h * 0.12);
  ctx.lineTo(d.x + w * 0.22, d.y - h * 0.28);
  ctx.closePath();
  ctx.fill();

  // каркас
  ctx.strokeStyle = css(wood, 0.7);
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(d.x - w * 0.38, d.y - h * 0.02 - wallH);
  ctx.lineTo(d.x + w * 0.22, d.y - h * 0.28 - wallH);
  ctx.lineTo(d.x + w * 0.44, d.y - h * 0.12 - wallH);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(d.x - w * 0.38, d.y - h * 0.02);
  ctx.lineTo(d.x + w * 0.22, d.y - h * 0.28);
  ctx.lineTo(d.x + w * 0.44, d.y - h * 0.12);
  ctx.stroke();
  for (const [ox, oy] of [
    [-w * 0.38, -h * 0.02],
    [w * 0.22, -h * 0.28],
    [w * 0.44, -h * 0.12],
  ]) {
    ctx.beginPath();
    ctx.moveTo(d.x + ox, d.y + oy - wallH);
    ctx.lineTo(d.x + ox, d.y + oy);
    ctx.stroke();
  }

  // сёдзи решётка на длинной стене
  ctx.strokeStyle = css(wood, 0.35);
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.moveTo(d.x - w * 0.12, d.y - h * 0.12 - wallH * 0.75);
  ctx.lineTo(d.x - w * 0.12, d.y - h * 0.12 - wallH * 0.15);
  ctx.moveTo(d.x + 0.02 * w, d.y - h * 0.18 - wallH * 0.75);
  ctx.lineTo(d.x + 0.02 * w, d.y - h * 0.18 - wallH * 0.15);
  ctx.stroke();

  // крыша
  const ry = d.y - h * 0.12 - wallH;
  ctx.fillStyle = css(roof, 0.97);
  ctx.beginPath();
  ctx.moveTo(d.x - w * 0.52, ry + 4);
  ctx.quadraticCurveTo(d.x + w * 0.05, ry - 22, d.x + w * 0.58, ry - 2);
  ctx.lineTo(d.x + w * 0.46, ry + 3);
  ctx.quadraticCurveTo(d.x + w * 0.05, ry - 12, d.x - w * 0.4, ry + 8);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = css(roofLight, 0.22);
  ctx.beginPath();
  ctx.moveTo(d.x - w * 0.46, ry + 3);
  ctx.quadraticCurveTo(d.x + w * 0.02, ry - 18, d.x + w * 0.52, ry - 1);
  ctx.quadraticCurveTo(d.x + w * 0.08, ry - 2, d.x - w * 0.34, ry + 6);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = css(shade(roof, 0.65), 0.45);
  ctx.lineWidth = 1.1;
  ctx.beginPath();
  ctx.moveTo(d.x - w * 0.52, ry + 4);
  ctx.quadraticCurveTo(d.x + w * 0.05, ry - 22, d.x + w * 0.58, ry - 2);
  ctx.stroke();

  granulate(ctx, d.x, ry - 4, w * 0.5, 12, shade(roof, 0.7), obj.seed + 7, 14, 0.06);

  if (atm.lampGlow > 0.08) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = css({ r: 255, g: 196, b: 124 }, atm.lampGlow * 0.2);
    ctx.beginPath();
    ctx.ellipse(d.x - w * 0.08, d.y - h * 0.14 - wallH * 0.5, w * 0.18, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
};
