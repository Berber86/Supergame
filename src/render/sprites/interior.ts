/** Интерьер и обитатели: мебель, цубукубай, сисиодоси, кот. */

import { Drawer, WHITE, litc, shadowUnder } from './common';
import { lerp } from '../../core/rng';
import { css, mix, shade } from '../../world/palette';
import { softShadow, washBlob } from '../paint';

export { drawTable, drawCushion, drawIrori, drawFuton, drawByobu, drawBonsai } from './furniture';

export const drawTsukubai: Drawer = (d) => {
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

export const drawShishi: Drawer = (d) => {
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

export const drawWindChime: Drawer = (d) => {
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

export const drawBowl: Drawer = (d) => {
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

export const drawCat: Drawer = (d) => {
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
