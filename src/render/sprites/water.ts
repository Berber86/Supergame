import { paintStone } from '../stone';
import { flowerYear, winterYear } from '../../world/annualEnvironment';
/** Жители пруда и водяные растения. */

import { flowerOpenness } from '../flowerCycle';
import { Drawer, litc } from './common';
import { hash2, lerp } from '../../core/rng';
import { css, mix, shade } from '../../world/palette';

// ---------------- Вода ----------------

/** Winter keeps the planted object, but rhizomes rest below the water; only old stems remain. */
function drawDormantWaterPlant(d: Parameters<Drawer>[0], lotus: boolean): void {
  const { ctx, x, y, atm } = d;
  ctx.save();
  const brown = litc({ r: 128, g: 119, b: 91 }, atm);
  if (lotus) {
    ctx.strokeStyle = css(brown, 0.65);
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(x, y + 2);
    ctx.quadraticCurveTo(x + 3, y - 5, x + 1, y - 10);
    ctx.stroke();
    ctx.fillStyle = css(brown, 0.8);
    ctx.beginPath();
    ctx.ellipse(x + 1, y - 10, 3.2, 1.7, -0.25, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.fillStyle = css(brown, 0.2);
    ctx.beginPath();
    ctx.ellipse(x - 3, y + 2, 6, 2.5, -0.15, 0, Math.PI * 1.65);
    ctx.lineTo(x - 3, y + 2);
    ctx.fill();
  }
  ctx.restore();
}

export const drawLilypad: Drawer = (d) => {
  const { ctx, atm, obj } = d;
  const year = flowerYear('lilypad', obj.seed, atm.time.now);
  ctx.save();
  ctx.globalAlpha *= 1 - year.foliage;
  drawDormantWaterPlant(d, false);
  ctx.restore();
  if (year.foliage <= 0.001) return;
  const bob = Math.sin(d.time * 0.0008 + obj.seed) * 1.5;
  for (let i = 0; i < 3; i++) {
    const r1 = hash2(i, obj.seed, 9);
    const r2 = hash2(i, obj.seed, 19);
    const px = d.x + (r1 - 0.5) * 22;
    const py = d.y + (r2 - 0.5) * 11 + bob;
    const rx = (8 + r1 * 5) * Math.sqrt(year.foliage);
    const c = litc(mix({ r: 116, g: 156, b: 104 }, atm.palette.foliage, 0.4), atm);
    ctx.fillStyle = css(shade(c, 0.7), 0.3 * year.foliage);
    ctx.beginPath();
    ctx.ellipse(px, py + 2, rx, rx * 0.55, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = css(c, 0.9 * year.foliage);
    ctx.beginPath();
    ctx.ellipse(px, py, rx, rx * 0.55, 0, 0.35, Math.PI * 2 - 0.35);
    ctx.lineTo(px, py);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = css(shade(c, 0.78), 0.4 * year.foliage);
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

export const drawLotus: Drawer = (d) => {
  const { ctx, atm, obj, g } = d;
  const year = flowerYear('lotus', obj.seed, atm.time.now);
  ctx.save();
  ctx.globalAlpha *= 1 - year.foliage;
  drawDormantWaterPlant(d, true);
  ctx.restore();
  if (year.foliage <= 0.001) return;
  const bob = Math.sin(d.time * 0.0007 + obj.seed) * 1.5;
  const open = flowerOpenness(atm);
  let scale = lerp(0.5, 1, g) * Math.sqrt(year.foliage);
  const px = d.x;
  const py = d.y + bob;
  // лист
  const leaf = litc({ r: 108, g: 148, b: 100 }, atm);
  ctx.fillStyle = css(leaf, 0.85 * year.foliage);
  ctx.beginPath();
  ctx.ellipse(px - 10, py + 3, 10 * scale, 5.5 * scale, 0, 0, Math.PI * 2);
  ctx.fill();
  // стебель
  ctx.strokeStyle = css(litc({ r: 120, g: 154, b: 104 }, atm), 0.8 * year.foliage);
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(px, py + 2);
  ctx.lineTo(px + 1, py - 12 * scale);
  ctx.stroke();
  // Annual presence is independent of the day/night petal pose.
  if (year.bloom <= 0.001) return;
  const cy = py - 13 * scale;
  scale *= Math.sqrt(year.bloom);
  // цветок
  const petal = litc({ r: 248, g: 204, b: 216 }, atm, 0.05);
  const petalDeep = litc({ r: 236, g: 166, b: 190 }, atm);

  const n = 7;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const spread = 1.1 * open;
    const ex = px + Math.cos(a) * 6 * scale * spread;
    const ey = cy + Math.sin(a) * 3.4 * scale * spread - 2 - (1 - open) * 3 * scale;
    ctx.fillStyle = css(i % 2 === 0 ? petal : petalDeep, 0.9 * year.bloom);
    ctx.save();
    ctx.translate(ex, ey);
    ctx.rotate(lerp(-Math.PI / 2, a, open));
    ctx.beginPath();
    ctx.ellipse(0, 0, 5.5 * scale, lerp(1.2, 2.6, open) * scale, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  ctx.fillStyle = css(litc({ r: 246, g: 226, b: 160 }, atm), 0.95 * year.bloom * Math.max(0, (open - 0.4) / 0.6));
  ctx.beginPath();
  ctx.arc(px, cy - 2, 2.4 * scale, 0, Math.PI * 2);
  ctx.fill();
};

export const drawKoi: Drawer = (d) => {
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

export const drawReed: Drawer = (d) => {
  const { ctx, atm, g, obj } = d;
  const scale = lerp(0.45, 1, Math.pow(g, 0.7));
  const stalks = 5 + Math.round(scale * 3);
  const stemCol = litc(
    mix(
      { r: 116, g: 148, b: 92 },
      { r: 176, g: 164, b: 130 },
      1 - flowerYear('lilypad', obj.seed, atm.time.now).foliage,
    ),
    atm,
  );
  const head = litc({ r: 132, g: 96, b: 66 }, atm);

  ctx.lineCap = 'round';
  for (let i = 0; i < stalks; i++) {
    const r1 = hash2(i, obj.seed, 17);
    const r2 = hash2(i, obj.seed, 29);
    const bx = d.x + (r1 - 0.5) * 13;
    const hgt = (20 + r2 * 16) * scale;
    // Камыш гнётся сильнее деревьев — стебель тонкий и длинный
    const sway = Math.sin(d.time * 0.0016 + i * 1.3 + obj.seed) * (3.5 + r1 * 3) * d.wind;
    ctx.strokeStyle = css(stemCol, 0.85);
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    ctx.moveTo(bx, d.y);
    ctx.quadraticCurveTo(bx + sway * 0.4, d.y - hgt * 0.6, bx + sway, d.y - hgt);
    ctx.stroke();

    // початок на части стеблей
    if (r2 > 0.45) {
      ctx.fillStyle = css(head, 0.9);
      ctx.beginPath();
      ctx.ellipse(bx + sway, d.y - hgt - 2, 1.5, 4.4 * scale, sway * 0.02, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.lineCap = 'butt';
};

/** Хвощ: строгие членистые стебли без листьев. */

export const drawHorsetail: Drawer = (d) => {
  const { ctx, atm, g, obj } = d;
  const scale = lerp(0.45, 1, Math.pow(g, 0.7));
  const stalks = 6 + Math.round(scale * 4);
  const col = litc(mix({ r: 96, g: 142, b: 104 }, { r: 150, g: 158, b: 138 }, winterYear(atm.time.now).snow), atm);

  for (let i = 0; i < stalks; i++) {
    const r1 = hash2(i, obj.seed, 23);
    const r2 = hash2(i, obj.seed, 37);
    const bx = d.x + (r1 - 0.5) * 12;
    const hgt = (14 + r2 * 12) * scale;
    const sway = Math.sin(d.time * 0.0012 + i + obj.seed) * 1.6 * d.wind;
    ctx.strokeStyle = css(col, 0.88);
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(bx, d.y);
    ctx.lineTo(bx + sway, d.y - hgt);
    ctx.stroke();
    // членения — то, чем хвощ узнаётся
    ctx.strokeStyle = css(shade(col, 0.72), 0.6);
    ctx.lineWidth = 0.9;
    const joints = Math.max(2, Math.round(hgt / 6));
    for (let k = 1; k < joints; k++) {
      const tt = k / joints;
      const jx = bx + sway * tt;
      const jy = d.y - hgt * tt;
      ctx.beginPath();
      ctx.moveTo(jx - 1.6, jy);
      ctx.lineTo(jx + 1.6, jy);
      ctx.stroke();
    }
  }
};

/** Камень, стоящий в воде: с мокрой полосой и кругами у основания. */

export const drawWaterStone: Drawer = (d) => {
  const { ctx } = d;
  ctx.save();
  ctx.beginPath();
  ctx.rect(d.x - 80, d.y - 100, 160, 102);
  ctx.clip();
  paintStone(
    ctx,
    d.x,
    d.y,
    d.obj.seed,
    0.62,
    d.obj.rot,
    { ...d.atm, stoneHabitat: Math.max(0.7, d.atm.stoneHabitat ?? 0) },
    false,
    true,
  );
  ctx.restore();
};

/** Мостки: простые доски над водой, без изгиба. */
