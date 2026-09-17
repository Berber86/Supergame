/** Интерьер и обитатели: мебель, цубукубай, сисиодоси, кот. */

import { Drawer, WHITE, litc, shadowUnder } from './common';
import { clamp01, hash2, lerp } from '../../core/rng';
import { css, mix, shade } from '../../world/palette';
import { blobPath, glow, softShadow, taperStroke, washBlob } from '../paint';

export const drawTable: Drawer = (d) => {
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

export const drawCushion: Drawer = (d) => {
  const { ctx, atm, obj } = d;
  softShadow(ctx, d.x, d.y + 1, 15, 6, atm.shadowTint, atm.shadowAmount);
  const hue = hash2(obj.seed, 1, 3);
  const col = litc(
    hue > 0.6 ? { r: 176, g: 96, b: 96 } : hue > 0.3 ? { r: 96, g: 114, b: 146 } : { r: 156, g: 140, b: 108 },
    atm,
  );
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

// ---------------- Реестр ----------------

// ---------------- Глициния, хурма, камелия ----------------

/**
 * Глициния: пергола, с которой свисают лиловые грозди.
 * Весной цветёт, летом остаётся зелёной ширмой, зимой — голые плети.
 */

export const drawIrori: Drawer = (d) => {
  const { ctx, atm, obj } = d;
  shadowUnder(d, 18, 8, 0.7);

  // Квадрат очага, утопленный в татами
  const rim = litc({ r: 96, g: 74, b: 56 }, atm);
  const ash = litc({ r: 118, g: 112, b: 106 }, atm);
  const w = 17;
  const hh = 9;
  ctx.beginPath();
  ctx.moveTo(d.x, d.y - hh);
  ctx.lineTo(d.x + w, d.y);
  ctx.lineTo(d.x, d.y + hh);
  ctx.lineTo(d.x - w, d.y);
  ctx.closePath();
  ctx.fillStyle = css(rim, 0.96);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(d.x, d.y - hh * 0.62);
  ctx.lineTo(d.x + w * 0.66, d.y);
  ctx.lineTo(d.x, d.y + hh * 0.62);
  ctx.lineTo(d.x - w * 0.66, d.y);
  ctx.closePath();
  ctx.fillStyle = css(ash, 0.95);
  ctx.fill();

  // Угли и пламя — живые, как в жаровне
  const flick = 0.55 + Math.sin(d.time * 0.007 + obj.seed) * 0.2 + Math.sin(d.time * 0.013) * 0.12;
  const ember = litc({ r: 226, g: 118, b: 52 }, atm, 0.1);
  for (let i = 0; i < 4; i++) {
    const r1 = hash2(i, obj.seed, 13);
    ctx.fillStyle = css(ember, 0.5 + r1 * 0.35);
    ctx.beginPath();
    ctx.ellipse(d.x + (r1 - 0.5) * 12, d.y + (hash2(i, obj.seed, 21) - 0.5) * 5, 2.4, 1.6, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  for (let i = 0; i < 3; i++) {
    const r1 = hash2(i, obj.seed, 31);
    const fh = (7 + r1 * 6) * flick;
    ctx.fillStyle = css(litc({ r: 250, g: 190, b: 96 }, atm, 0.16), 0.5 + r1 * 0.3);
    ctx.beginPath();
    ctx.moveTo(d.x + (r1 - 0.5) * 9 - 2.4, d.y);
    ctx.quadraticCurveTo(d.x + (r1 - 0.5) * 9, d.y - fh, d.x + (r1 - 0.5) * 9 + 2.4, d.y);
    ctx.closePath();
    ctx.fill();
  }
  glow(ctx, d.x, d.y - 4, 34, { r: 252, g: 170, b: 88 }, (0.3 + flick * 0.22) * (0.4 + atm.lampGlow));

  // Крюк дзидзай с котелком
  const iron = litc({ r: 72, g: 68, b: 66 }, atm);
  ctx.strokeStyle = css(iron, 0.9);
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(d.x, d.y - 42);
  ctx.lineTo(d.x, d.y - 20);
  ctx.stroke();
  ctx.fillStyle = css(iron, 0.95);
  ctx.beginPath();
  ctx.ellipse(d.x, d.y - 15, 7, 5.4, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = css(shade(iron, 0.8), 0.9);
  ctx.beginPath();
  ctx.ellipse(d.x, d.y - 18, 6.4, 2.6, 0, 0, Math.PI * 2);
  ctx.fill();

  // Пар
  const steam = clamp01(0.35 + Math.sin(d.time * 0.0018) * 0.3);
  ctx.strokeStyle = css({ r: 255, g: 255, b: 255 }, 0.16 * steam);
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.moveTo(d.x, d.y - 22);
  ctx.quadraticCurveTo(d.x + 5, d.y - 30, d.x + 1, d.y - 38);
  ctx.stroke();
};

/** Футон: свёрнутая или расстеленная постель. */

export const drawFuton: Drawer = (d) => {
  const { ctx, atm, obj } = d;
  shadowUnder(d, 24, 9, 0.8);
  const cloth = litc({ r: 238, g: 230, b: 214 }, atm);
  const band = litc({ r: 152, g: 96, b: 100 }, atm);

  // Матрас: ромб по сетке, с толщиной — плоский лист читался пятном
  const hw = 26;
  const hh = 13;
  const thick = 4;
  // боковина
  ctx.beginPath();
  ctx.moveTo(d.x - hw, d.y);
  ctx.lineTo(d.x, d.y + hh);
  ctx.lineTo(d.x + hw, d.y);
  ctx.lineTo(d.x + hw, d.y + thick);
  ctx.lineTo(d.x, d.y + hh + thick);
  ctx.lineTo(d.x - hw, d.y + thick);
  ctx.closePath();
  ctx.fillStyle = css(shade(cloth, 0.84), 1);
  ctx.fill();
  // верх
  ctx.beginPath();
  ctx.moveTo(d.x, d.y - hh);
  ctx.lineTo(d.x + hw, d.y);
  ctx.lineTo(d.x, d.y + hh);
  ctx.lineTo(d.x - hw, d.y);
  ctx.closePath();
  ctx.fillStyle = css(cloth, 1);
  ctx.fill();
  ctx.strokeStyle = css(shade(cloth, 0.76), 0.6);
  ctx.lineWidth = 1.2;
  ctx.stroke();

  // Одеяло откинуто углом — постель выглядит живой, а не музейной
  ctx.beginPath();
  ctx.moveTo(d.x + 2, d.y - hh * 0.5);
  ctx.lineTo(d.x + hw * 0.84, d.y - 1);
  ctx.lineTo(d.x + 2, d.y + hh * 0.72);
  ctx.lineTo(d.x - hw * 0.4, d.y + 1);
  ctx.closePath();
  ctx.fillStyle = css(band, 0.92);
  ctx.fill();
  // отворот
  ctx.beginPath();
  ctx.moveTo(d.x + 2, d.y - hh * 0.5);
  ctx.lineTo(d.x - hw * 0.4, d.y + 1);
  ctx.lineTo(d.x - hw * 0.24, d.y - 3);
  ctx.lineTo(d.x + 5, d.y - hh * 0.72);
  ctx.closePath();
  ctx.fillStyle = css(mix(band, WHITE, 0.55), 0.9);
  ctx.fill();

  // Подушка в изголовье
  ctx.fillStyle = css(litc({ r: 248, g: 244, b: 234 }, atm), 1);
  ctx.beginPath();
  ctx.ellipse(d.x - hw * 0.56, d.y - 3, 7, 4.2, -0.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = css(shade(cloth, 0.8), 0.5);
  ctx.lineWidth = 1;
  ctx.stroke();
  void obj;
};

/** Бёбу: складная ширма в две-три створки. */

export const drawByobu: Drawer = (d) => {
  const { ctx, atm, obj } = d;
  const h = 34;
  shadowUnder(d, 22, 7, 0.75);
  const paper = litc({ r: 242, g: 232, b: 206 }, atm);
  const gold = litc({ r: 226, g: 196, b: 128 }, atm, 0.04);
  const frame = litc({ r: 92, g: 68, b: 50 }, atm);

  // Три створки зигзагом — ширма стоит, а не лежит плоско
  const panels = 3;
  const step = 13;
  for (let i = 0; i < panels; i++) {
    const zig = i % 2 === 0 ? 0 : 4;
    const px = d.x - step * (panels - 1) * 0.5 + i * step;
    const py = d.y + zig * 0.5;
    ctx.beginPath();
    ctx.moveTo(px - step * 0.5, py - h - zig);
    ctx.lineTo(px + step * 0.5, py - h - zig + 3);
    ctx.lineTo(px + step * 0.5, py + 3);
    ctx.lineTo(px - step * 0.5, py);
    ctx.closePath();
    ctx.fillStyle = css(i % 2 === 0 ? paper : mix(paper, gold, 0.4), 0.96);
    ctx.fill();
    ctx.strokeStyle = css(frame, 0.85);
    ctx.lineWidth = 1.6;
    ctx.stroke();

    // золотое облако и ветка
    ctx.save();
    ctx.clip();
    ctx.fillStyle = css(gold, 0.42);
    blobPath(ctx, px, py - h * 0.62, step * 0.6, 6, obj.seed + i, 0.3, 8);
    ctx.fill();
    ctx.strokeStyle = css(litc({ r: 86, g: 78, b: 70 }, atm), 0.4);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(px - 4, py - 2);
    ctx.quadraticCurveTo(px, py - h * 0.5, px + 4, py - h * 0.72);
    ctx.stroke();
    ctx.restore();
  }
};

/** Дзэн-сад в ящике: маленький суйсэки на подставке. */

export const drawBonsai: Drawer = (d) => {
  const { ctx, atm, g, obj } = d;
  const scale = lerp(0.5, 1, Math.pow(g, 0.6));
  shadowUnder(d, 11, 5, 0.7);
  // Плошка
  const pot = litc({ r: 104, g: 78, b: 66 }, atm);
  ctx.fillStyle = css(pot, 0.96);
  ctx.beginPath();
  ctx.moveTo(d.x - 9, d.y - 7);
  ctx.lineTo(d.x + 9, d.y - 7);
  ctx.lineTo(d.x + 7, d.y - 1);
  ctx.lineTo(d.x - 7, d.y - 1);
  ctx.closePath();
  ctx.fill();
  // Ствол с характерным изгибом
  const bark = litc({ r: 108, g: 88, b: 74 }, atm);
  const sway = Math.sin(d.time * 0.0007 + obj.seed) * 1.2 * d.wind;
  taperStroke(ctx, d.x, d.y - 7, d.x - 5 + sway, d.y - 18 * scale, 3 * scale, 1.4, bark, 0.95, -4);
  taperStroke(ctx, d.x - 5 + sway, d.y - 18 * scale, d.x + 4 + sway, d.y - 24 * scale, 2 * scale, 1, bark, 0.9, 3);
  // Крона подушками
  const leafBase = atm.season === 'autumn' ? { r: 190, g: 140, b: 78 } : { r: 84, g: 126, b: 84 };
  const leaf = litc(leafBase, atm);
  for (const [ox, oy, rr] of [
    [4, -25, 8],
    [-6, -20, 6],
    [9, -20, 5],
  ] as [number, number, number][]) {
    washBlob(ctx, d.x + ox * scale + sway, d.y + oy * scale, rr * scale, rr * 0.6 * scale, leaf, obj.seed + ox, {
      layers: 2,
      alpha: 0.46,
      edge: 0.12,
      wobble: 0.24,
    });
  }
};

// ---------------- Прибрежные растения ----------------

/** Камыш: высокие стебли с бархатными початками. */
