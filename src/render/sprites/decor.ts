/** Предметы индивидуализации: брёвна, пни, заборчики, колодец и прочие милости. */

import { Drawer, litc, shadowUnder } from './common';
import { css } from '../../world/palette';
import { winterYear } from '../../world/annualEnvironment';
import { hash1 } from '../../core/rng';

/** Направление «вдоль тайла» на экране: rot 0/2 — ось x, rot 1/3 — ось y. */
function dirOf(rot: number): [number, number] {
  return rot % 2 === 0 ? [0.894, 0.447] : [-0.894, 0.447];
}

const BARK = { r: 128, g: 102, b: 74 };
const BARK_DARK = { r: 92, g: 72, b: 52 };
const MOSS = { r: 104, g: 130, b: 86 };
const SNOW = { r: 236, g: 240, b: 244 };

/** Замшелое поваленное бревно — ящерицы греются на тёплой коре. */
export const drawMossLog: Drawer = (d) => {
  const { ctx, atm, obj } = d;
  shadowUnder(d, 26, 9, 1);
  const [ux, uy] = dirOf(obj.rot);
  const L = 25 + hash1(obj.seed, 3) * 4;
  const bark = litc(BARK, atm);
  const barkTop = litc({ r: 152, g: 126, b: 94 }, atm);
  const cut = litc({ r: 196, g: 172, b: 132 }, atm);
  const moss = litc(MOSS, atm);
  const snow = winterYear(atm.time.now).snow;

  // тело бревна — толстый мазок вдоль изометрии
  ctx.lineCap = 'round';
  ctx.strokeStyle = css(bark, 0.95);
  ctx.lineWidth = 10;
  ctx.beginPath();
  ctx.moveTo(d.x - ux * L, d.y - uy * L - 4);
  ctx.lineTo(d.x + ux * L, d.y + uy * L - 4);
  ctx.stroke();
  // осветлённая верхняя грань
  ctx.strokeStyle = css(barkTop, 0.8);
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(d.x - ux * (L - 2), d.y - uy * (L - 2) - 7);
  ctx.lineTo(d.x + ux * (L - 2), d.y + uy * (L - 2) - 7);
  ctx.stroke();
  // торец с кольцами
  const ex = d.x + ux * L,
    ey = d.y + uy * L - 4;
  ctx.fillStyle = css(cut, 0.95);
  ctx.beginPath();
  ctx.ellipse(ex, ey, 4.6, 5.4, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = css(barkTop, 0.7);
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.ellipse(ex, ey, 2.6, 3.1, 0, 0, Math.PI * 2);
  ctx.stroke();
  // мох шапками по верху
  for (let i = 0; i < 3; i++) {
    const t = -0.6 + i * 0.55 + hash1(obj.seed, 11 + i) * 0.2;
    ctx.fillStyle = css(moss, 0.55 + hash1(obj.seed, 21 + i) * 0.25);
    ctx.beginPath();
    ctx.ellipse(d.x + ux * L * t, d.y + uy * L * t - 8, 6 + hash1(obj.seed, 31 + i) * 3, 2.6, uy * 0.4, 0, Math.PI * 2);
    ctx.fill();
  }
  // трутовики — веером на боку
  const fx = d.x - ux * L * 0.25,
    fy = d.y - uy * L * 0.25 - 2;
  ctx.fillStyle = css(litc({ r: 188, g: 156, b: 116 }, atm), 0.9);
  for (let i = 0; i < 2; i++) {
    ctx.beginPath();
    ctx.ellipse(fx + i * 3, fy + i * 1.5, 3.4 - i, 1.6, 0.5, 0, Math.PI);
    ctx.fill();
  }
  if (snow > 0.05) {
    ctx.strokeStyle = css(SNOW, 0.85 * snow);
    ctx.lineWidth = 3.2;
    ctx.beginPath();
    ctx.moveTo(d.x - ux * (L - 3), d.y - uy * (L - 3) - 8.6);
    ctx.lineTo(d.x + ux * (L - 3), d.y + uy * (L - 3) - 8.6);
    ctx.stroke();
  }
};

/** Старый пень — пристанище ежей и мышей. */
export const drawStump: Drawer = (d) => {
  const { ctx, atm, obj } = d;
  shadowUnder(d, 10, 5, 1);
  const bark = litc(BARK, atm);
  const barkDark = litc(BARK_DARK, atm);
  const cut = litc({ r: 200, g: 176, b: 138 }, atm);
  const moss = litc(MOSS, atm);
  const snow = winterYear(atm.time.now).snow;
  const h = 11 + hash1(obj.seed, 5) * 3;

  // корни-лапы
  ctx.strokeStyle = css(barkDark, 0.9);
  ctx.lineWidth = 3;
  for (const s of [-1, 0, 1]) {
    ctx.beginPath();
    ctx.moveTo(d.x + s * 4, d.y - 3);
    ctx.quadraticCurveTo(d.x + s * 8, d.y - 1, d.x + s * 10, d.y + 1);
    ctx.stroke();
  }
  // тело пня
  ctx.fillStyle = css(bark, 0.96);
  ctx.beginPath();
  ctx.moveTo(d.x - 7, d.y);
  ctx.lineTo(d.x - 6, d.y - h);
  ctx.lineTo(d.x + 6, d.y - h);
  ctx.lineTo(d.x + 7, d.y);
  ctx.closePath();
  ctx.fill();
  // вертикальные трещины коры
  ctx.strokeStyle = css(barkDark, 0.5);
  ctx.lineWidth = 0.9;
  for (let i = -1; i <= 1; i++) {
    ctx.beginPath();
    ctx.moveTo(d.x + i * 3.4, d.y - 1);
    ctx.lineTo(d.x + i * 3, d.y - h + 2);
    ctx.stroke();
  }
  // спил с кольцами
  ctx.fillStyle = css(cut, 0.97);
  ctx.beginPath();
  ctx.ellipse(d.x, d.y - h, 6.4, 3, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = css(bark, 0.6);
  ctx.lineWidth = 0.7;
  ctx.beginPath();
  ctx.ellipse(d.x, d.y - h, 3.8, 1.7, 0, 0, Math.PI * 2);
  ctx.stroke();
  // мох по кромке
  ctx.fillStyle = css(moss, 0.6);
  ctx.beginPath();
  ctx.ellipse(d.x - 4, d.y - h + 2, 3, 1.4, 0.4, 0, Math.PI * 2);
  ctx.fill();
  if (snow > 0.05) {
    ctx.fillStyle = css(SNOW, 0.9 * snow);
    ctx.beginPath();
    ctx.ellipse(d.x, d.y - h - 0.6, 6.2, 2.6, 0, 0, Math.PI * 2);
    ctx.fill();
  }
};

/** Семья опят — выглядывают после дождя. */
export const drawMushrooms: Drawer = (d) => {
  const { ctx, atm, obj } = d;
  shadowUnder(d, 6, 3, 0.6);
  const stem = litc({ r: 226, g: 214, b: 188 }, atm);
  const capA = litc({ r: 178, g: 128, b: 84 }, atm);
  const capB = litc({ r: 196, g: 106, b: 82 }, atm);
  const n = 3 + Math.floor(hash1(obj.seed, 7) * 2);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + hash1(obj.seed, i) * 1.2;
    const r = 2.5 + i * 2;
    const x = d.x + Math.cos(a) * r,
      y = d.y + Math.sin(a) * r * 0.45;
    const h = 7 + hash1(obj.seed, 13 + i) * 4;
    ctx.strokeStyle = css(stem, 0.95);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x, y - h);
    ctx.stroke();
    ctx.fillStyle = css(i % 2 === 0 ? capA : capB, 0.95);
    ctx.beginPath();
    ctx.ellipse(x, y - h, 4.4 - i * 0.4, 2.8 - i * 0.25, 0, Math.PI, 0);
    ctx.closePath();
    ctx.fill();
  }
};

/** Низкий деревянный заборчик: столбики и две перекладины. */
export const drawFenceWood: Drawer = (d) => {
  const { ctx, atm, obj } = d;
  shadowUnder(d, 22, 7, 0.8);
  const [ux, uy] = dirOf(obj.rot);
  const wood = litc({ r: 158, g: 122, b: 84 }, atm);
  const woodDark = litc({ r: 118, g: 90, b: 62 }, atm);
  const snow = winterYear(atm.time.now).snow;
  const L = 26;
  // столбики
  for (const t of [-1, 0, 1]) {
    const x = d.x + ux * L * t * 0.92,
      y = d.y + uy * L * t * 0.92;
    ctx.fillStyle = css(woodDark, 0.95);
    ctx.fillRect(x - 1.6, y - 14 - hash1(obj.seed, t + 2) * 1.5, 3.2, 15);
  }
  // перекладины
  ctx.strokeStyle = css(wood, 0.95);
  ctx.lineWidth = 2.6;
  for (const hh of [7, 12]) {
    ctx.beginPath();
    ctx.moveTo(d.x - ux * L, d.y - uy * L - hh);
    ctx.lineTo(d.x + ux * L, d.y + uy * L - hh);
    ctx.stroke();
  }
  if (snow > 0.05) {
    ctx.strokeStyle = css(SNOW, 0.8 * snow);
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(d.x - ux * L, d.y - uy * L - 13.4);
    ctx.lineTo(d.x + ux * L, d.y + uy * L - 13.4);
    ctx.stroke();
  }
};

/** Каменная ограда — сухая кладка из плоских плит. */
export const drawFenceStone: Drawer = (d) => {
  const { ctx, atm, obj } = d;
  shadowUnder(d, 22, 7, 0.9);
  const [ux, uy] = dirOf(obj.rot);
  const grey = litc({ r: 148, g: 146, b: 138 }, atm);
  const greyDark = litc({ r: 112, g: 110, b: 104 }, atm);
  const moss = litc(MOSS, atm);
  const snow = winterYear(atm.time.now).snow;
  const L = 26;
  // два ряда плит в шахматке
  for (let row = 0; row < 2; row++)
    for (let i = 0; i < 4; i++) {
      const t = -0.82 + i * 0.55 + (row % 2) * 0.24 + hash1(obj.seed, row * 7 + i) * 0.08;
      const x = d.x + ux * L * t,
        y = d.y + uy * L * t - 2.6 - row * 4.4;
      ctx.fillStyle = css(i % 2 === 0 ? grey : greyDark, 0.95);
      ctx.beginPath();
      ctx.ellipse(x, y, 8.4, 3, uy * 0.35, 0, Math.PI * 2);
      ctx.fill();
    }
  // мох в швах
  ctx.fillStyle = css(moss, 0.5);
  for (let i = 0; i < 3; i++) {
    const t = -0.5 + i * 0.5;
    ctx.beginPath();
    ctx.ellipse(d.x + ux * L * t, d.y + uy * L * t - 4.4, 2.4, 1, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  if (snow > 0.05) {
    ctx.strokeStyle = css(SNOW, 0.85 * snow);
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.moveTo(d.x - ux * L * 0.85, d.y - uy * L * 0.85 - 8.6);
    ctx.lineTo(d.x + ux * L * 0.85, d.y + uy * L * 0.85 - 9.8);
    ctx.stroke();
  }
};

/** Дзидзо — каменный страж в красном нагруднике и шапочке. */
export const drawJizo: Drawer = (d) => {
  const { ctx, atm } = d;
  shadowUnder(d, 8, 4, 1);
  const stone = litc({ r: 156, g: 154, b: 148 }, atm);
  const stoneDark = litc({ r: 120, g: 118, b: 112 }, atm);
  const red = litc({ r: 188, g: 82, b: 70 }, atm);
  const moss = litc(MOSS, atm);
  const snow = winterYear(atm.time.now).snow;
  // тело
  ctx.fillStyle = css(stone, 0.96);
  ctx.beginPath();
  ctx.ellipse(d.x, d.y - 8, 6, 9, 0, 0, Math.PI * 2);
  ctx.fill();
  // голова
  ctx.beginPath();
  ctx.arc(d.x, d.y - 19, 4.6, 0, Math.PI * 2);
  ctx.fill();
  // тень сбоку
  ctx.fillStyle = css(stoneDark, 0.4);
  ctx.beginPath();
  ctx.ellipse(d.x + 2.6, d.y - 8, 3, 8.4, 0, 0, Math.PI * 2);
  ctx.fill();
  // нагрудник и шапочка
  ctx.fillStyle = css(red, 0.92);
  ctx.beginPath();
  ctx.moveTo(d.x - 3.6, d.y - 13);
  ctx.quadraticCurveTo(d.x, d.y - 10.6, d.x + 3.6, d.y - 13);
  ctx.lineTo(d.x + 2.6, d.y - 7);
  ctx.quadraticCurveTo(d.x, d.y - 5.6, d.x - 2.6, d.y - 7);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.arc(d.x, d.y - 20.6, 4.4, Math.PI, 0);
  ctx.closePath();
  ctx.fill();
  // лицо: две точки и тихая улыбка
  ctx.strokeStyle = css(stoneDark, 0.8);
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.arc(d.x - 1.5, d.y - 18.6, 0.5, 0, Math.PI * 2);
  ctx.arc(d.x + 1.5, d.y - 18.6, 0.5, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(d.x, d.y - 17.2, 1.6, 0.25, Math.PI - 0.25);
  ctx.stroke();
  // мох у подножия
  ctx.fillStyle = css(moss, 0.6);
  ctx.beginPath();
  ctx.ellipse(d.x - 3, d.y - 1, 3.4, 1.6, 0, 0, Math.PI * 2);
  ctx.fill();
  if (snow > 0.05) {
    ctx.fillStyle = css(SNOW, 0.9 * snow);
    ctx.beginPath();
    ctx.ellipse(d.x, d.y - 23.4, 3.6, 1.5, 0, 0, Math.PI * 2);
    ctx.fill();
  }
};

/** Старый колодец: сруб, ворот и черпак под крышей. */
export const drawWell: Drawer = (d) => {
  const { ctx, atm } = d;
  shadowUnder(d, 20, 10, 1);
  const stone = litc({ r: 140, g: 138, b: 130 }, atm);
  const stoneDark = litc({ r: 104, g: 102, b: 96 }, atm);
  const wood = litc({ r: 138, g: 106, b: 74 }, atm);
  const roof = litc({ r: 96, g: 100, b: 108 }, atm);
  const moss = litc(MOSS, atm);
  const snow = winterYear(atm.time.now).snow;
  // сруб — каменное кольцо
  ctx.fillStyle = css(stone, 0.96);
  ctx.beginPath();
  ctx.ellipse(d.x, d.y - 5, 14, 7, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = css(stoneDark, 0.9);
  ctx.beginPath();
  ctx.ellipse(d.x, d.y - 7, 10, 4.4, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = css({ r: 30, g: 34, b: 40 }, 0.95);
  ctx.beginPath();
  ctx.ellipse(d.x, d.y - 7, 7.6, 3.1, 0, 0, Math.PI * 2);
  ctx.fill();
  // кладка — швы
  ctx.strokeStyle = css(stoneDark, 0.5);
  ctx.lineWidth = 0.8;
  for (let i = 0; i < 5; i++) {
    const a = Math.PI * (0.15 + i * 0.18);
    ctx.beginPath();
    ctx.moveTo(d.x + Math.cos(a) * 13.4, d.y - 5 + Math.sin(a) * 6.6);
    ctx.lineTo(d.x + Math.cos(a) * 10.4, d.y - 6.4 + Math.sin(a) * 4.6);
    ctx.stroke();
  }
  // стойки и ворот
  ctx.fillStyle = css(wood, 0.95);
  ctx.fillRect(d.x - 13, d.y - 26, 2.6, 21);
  ctx.fillRect(d.x + 10.4, d.y - 26, 2.6, 21);
  ctx.strokeStyle = css(wood, 0.95);
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.moveTo(d.x - 12, d.y - 20);
  ctx.lineTo(d.x + 12, d.y - 20);
  ctx.stroke();
  // верёвка с черпаком
  ctx.strokeStyle = css(stoneDark, 0.7);
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.moveTo(d.x + 3, d.y - 20);
  ctx.lineTo(d.x + 3, d.y - 11);
  ctx.stroke();
  ctx.fillStyle = css(wood, 0.95);
  ctx.fillRect(d.x + 1, d.y - 11, 4, 3.4);
  // крыша
  ctx.fillStyle = css(roof, 0.96);
  ctx.beginPath();
  ctx.moveTo(d.x - 18, d.y - 25);
  ctx.lineTo(d.x, d.y - 33);
  ctx.lineTo(d.x + 18, d.y - 25);
  ctx.lineTo(d.x + 14, d.y - 24);
  ctx.lineTo(d.x, d.y - 30);
  ctx.lineTo(d.x - 14, d.y - 24);
  ctx.closePath();
  ctx.fill();
  // мох на срубе
  ctx.fillStyle = css(moss, 0.55);
  ctx.beginPath();
  ctx.ellipse(d.x - 8, d.y - 3, 4, 1.7, 0.3, 0, Math.PI * 2);
  ctx.fill();
  if (snow > 0.05) {
    ctx.strokeStyle = css(SNOW, 0.9 * snow);
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    ctx.moveTo(d.x - 15, d.y - 25.4);
    ctx.lineTo(d.x, d.y - 32.2);
    ctx.lineTo(d.x + 15, d.y - 25.4);
    ctx.stroke();
  }
};

/** Садовая скамья — присесть и слушать воду. */
export const drawGardenBench: Drawer = (d) => {
  const { ctx, atm, obj } = d;
  shadowUnder(d, 20, 7, 0.9);
  const [ux, uy] = dirOf(obj.rot);
  const wood = litc({ r: 150, g: 116, b: 80 }, atm);
  const woodDark = litc({ r: 110, g: 84, b: 58 }, atm);
  const snow = winterYear(atm.time.now).snow;
  const L = 20;
  // ножки
  for (const t of [-0.8, 0.8]) {
    const x = d.x + ux * L * t,
      y = d.y + uy * L * t;
    ctx.fillStyle = css(woodDark, 0.95);
    ctx.fillRect(x - 1.5, y - 8, 3, 8.6);
  }
  // сиденье из двух досок
  ctx.strokeStyle = css(wood, 0.96);
  ctx.lineWidth = 2.8;
  ctx.beginPath();
  ctx.moveTo(d.x - ux * L, d.y - uy * L - 8);
  ctx.lineTo(d.x + ux * L, d.y + uy * L - 8);
  ctx.stroke();
  ctx.strokeStyle = css(woodDark, 0.75);
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.moveTo(d.x - ux * L, d.y - uy * L - 5.6);
  ctx.lineTo(d.x + ux * L, d.y + uy * L - 5.6);
  ctx.stroke();
  if (snow > 0.05) {
    ctx.strokeStyle = css(SNOW, 0.85 * snow);
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(d.x - ux * L * 0.9, d.y - uy * L * 0.9 - 9.4);
    ctx.lineTo(d.x + ux * L * 0.9, d.y + uy * L * 0.9 - 9.4);
    ctx.stroke();
  }
};

/** Поленница — аккуратный запас на зиму. */
export const drawWoodpile: Drawer = (d) => {
  const { ctx, atm, obj } = d;
  shadowUnder(d, 12, 6, 1);
  const [ux, uy] = dirOf(obj.rot);
  const bark = litc(BARK, atm);
  const cut = litc({ r: 202, g: 178, b: 140 }, atm);
  const cutDark = litc({ r: 168, g: 142, b: 106 }, atm);
  const woodDark = litc(BARK_DARK, atm);
  const snow = winterYear(atm.time.now).snow;
  // боковые стойки
  for (const t of [-1, 1]) {
    const x = d.x + ux * 12 * t,
      y = d.y + uy * 12 * t;
    ctx.fillStyle = css(woodDark, 0.95);
    ctx.fillRect(x - 1.4, y - 16, 2.8, 16.6);
  }
  // торцы поленьев — три ряда
  for (let row = 0; row < 3; row++)
    for (let i = 0; i < 4; i++) {
      const t = -0.72 + i * 0.48 + (row % 2) * 0.2;
      const x = d.x + ux * 12 * t,
        y = d.y + uy * 12 * t - 3 - row * 4.6;
      ctx.fillStyle = css((i + row) % 2 === 0 ? cut : cutDark, 0.95);
      ctx.beginPath();
      ctx.arc(x, y, 3.1, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = css(bark, 0.8);
      ctx.lineWidth = 0.8;
      ctx.stroke();
    }
  // верхняя доска
  ctx.strokeStyle = css(woodDark, 0.9);
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(d.x - ux * 13, d.y - uy * 13 - 16.6);
  ctx.lineTo(d.x + ux * 13, d.y + uy * 13 - 16.6);
  ctx.stroke();
  if (snow > 0.05) {
    ctx.strokeStyle = css(SNOW, 0.85 * snow);
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(d.x - ux * 12, d.y - uy * 12 - 15.8);
    ctx.lineTo(d.x + ux * 12, d.y + uy * 12 - 17.8);
    ctx.stroke();
  }
};
