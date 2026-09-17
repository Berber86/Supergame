/** Свет сада: фонари бумажные и каменные, жаровня. */

import { DrawCtx, Drawer, litc, shadowUnder } from './common';
import { RGB, css, mix, shade } from '../../world/palette';
import { glow, granulate, softShadow } from '../paint';

function lanternLight(d: DrawCtx, x: number, y: number, radius: number, warm: RGB): void {
  const strength = d.atm.lampGlow;
  if (strength < 0.02) return;
  const flicker = 0.9 + Math.sin(d.time * 0.004 + d.obj.seed) * 0.06 + Math.sin(d.time * 0.011 + d.obj.seed * 2) * 0.04;
  d.ctx.save();
  d.ctx.globalCompositeOperation = 'lighter';
  glow(d.ctx, x, y, radius * flicker, warm, strength * 0.85);
  d.ctx.restore();
}

export const drawStoneLantern: Drawer = (d) => {
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

export const drawPaperLantern: Drawer = (d) => {
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

export const drawPathLight: Drawer = (d) => {
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

export const drawBrazier: Drawer = (d) => {
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
