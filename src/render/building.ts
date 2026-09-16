/**
 * Усадьба как постройка: дальние стены с сёдзи, столбы и глубокие свесы крыши.
 * Дом и сад едины — интерьер остаётся открытым, кровля только обрамляет его.
 */

import { GRID, LEVEL_H, TILE_H, TILE_W, isoToScreen } from '../core/iso';
import { hash2, lerp } from '../core/rng';
import { Atmosphere, RGB, css, mix, shade } from '../world/palette';
import { World } from '../world/world';
import { Ctx, glow, granulate } from './paint';

export interface HouseBox {
  x0: number;
  y0: number;
  x1: number; // включительно
  y1: number;
  level: number;
}

/** Ищет прямоугольник комнат (татами). */
export function findHouse(world: World): HouseBox | null {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  let level = 0;
  let found = false;
  for (let y = 0; y < GRID; y++) {
    for (let x = 0; x < GRID; x++) {
      const t = world.at(x, y)!;
      if (!t.indoor) continue;
      found = true;
      x0 = Math.min(x0, x);
      y0 = Math.min(y0, y);
      x1 = Math.max(x1, x);
      y1 = Math.max(y1, y);
      level = Math.max(level, t.level);
    }
  }
  return found ? { x0, y0, x1, y1, level } : null;
}

const WALL_H = 52;
const EAVE_DROP = 16;
const OVERHANG = 0.85; // вылет кровли в тайлах

function woodTones(atm: Atmosphere): { post: RGB; postDark: RGB; paper: RGB; roof: RGB; roofLight: RGB; roofDark: RGB } {
  const post = shade(mix({ r: 124, g: 88, b: 64 }, atm.lightTint, atm.lightAmount), atm.exposure);
  const postDark = shade(mix({ r: 82, g: 58, b: 44 }, atm.lightTint, atm.lightAmount * 0.6), atm.exposure);
  const paper = shade(
    mix(mix({ r: 244, g: 236, b: 216 }, { r: 255, g: 214, b: 156 }, atm.lampGlow * 0.55), atm.lightTint, atm.lightAmount * 0.5),
    atm.exposure + atm.lampGlow * 0.16,
  );
  const roof = shade(mix({ r: 124, g: 116, b: 118 }, atm.lightTint, atm.lightAmount), atm.exposure);
  const roofLight = shade(mix({ r: 168, g: 158, b: 154 }, atm.lightTint, atm.lightAmount), atm.exposure);
  const roofDark = shade(mix({ r: 86, g: 80, b: 84 }, atm.lightTint, atm.lightAmount * 0.5), atm.exposure);
  return { post, postDark, paper, roof, roofLight, roofDark };
}

/** Дальние стены (север и запад) — рисуются ДО объектов. */
export function drawHouseWalls(ctx: Ctx, world: World, atm: Atmosphere): void {
  const h = findHouse(world);
  if (!h) return;
  const T = woodTones(atm);
  const lvl = h.level;

  // Северная стена: от (x0, y0) до (x1+1, y0)
  drawWall(ctx, h.x0, h.y0, h.x1 + 1, h.y0, lvl, T, atm, 'north');
  // Западная стена: от (x0, y0) до (x0, y1+1)
  drawWall(ctx, h.x0, h.y0, h.x0, h.y1 + 1, lvl, T, atm, 'west');
  void world;
}

function drawWall(
  ctx: Ctx,
  ax: number,
  ay: number,
  bx: number,
  by: number,
  level: number,
  T: ReturnType<typeof woodTones>,
  atm: Atmosphere,
  side: 'north' | 'west',
): void {
  const p0 = isoToScreen(ax, ay, level);
  const p1 = isoToScreen(bx, by, level);
  const top0 = { x: p0.x, y: p0.y - WALL_H };
  const top1 = { x: p1.x, y: p1.y - WALL_H };

  // полотно стены
  ctx.beginPath();
  ctx.moveTo(p0.x, p0.y);
  ctx.lineTo(p1.x, p1.y);
  ctx.lineTo(top1.x, top1.y);
  ctx.lineTo(top0.x, top0.y);
  ctx.closePath();
  ctx.fillStyle = css(side === 'north' ? T.paper : shade(T.paper, 0.9), 0.97);
  ctx.fill();

  // решётка сёдзи
  const segs = Math.max(2, Math.round(Math.hypot(bx - ax, by - ay) * 1.4));
  ctx.strokeStyle = css(T.post, 0.62);
  ctx.lineWidth = 2;
  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    const bxp = lerp(p0.x, p1.x, t);
    const byp = lerp(p0.y, p1.y, t);
    ctx.beginPath();
    ctx.moveTo(bxp, byp);
    ctx.lineTo(bxp, byp - WALL_H);
    ctx.stroke();
  }
  ctx.lineWidth = 1.2;
  ctx.strokeStyle = css(T.post, 0.4);
  for (let i = 1; i < 4; i++) {
    const yy = -WALL_H * (i / 4);
    ctx.beginPath();
    ctx.moveTo(p0.x, p0.y + yy);
    ctx.lineTo(p1.x, p1.y + yy);
    ctx.stroke();
  }
  // нижняя доска и верхняя балка
  ctx.strokeStyle = css(T.postDark, 0.9);
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(p0.x, p0.y);
  ctx.lineTo(p1.x, p1.y);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(top0.x, top0.y);
  ctx.lineTo(top1.x, top1.y);
  ctx.stroke();

  // тёплый свет изнутри по низу бумаги
  if (atm.lampGlow > 0.05) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createLinearGradient(p0.x, p0.y, p0.x, p0.y - WALL_H);
    g.addColorStop(0, css({ r: 255, g: 196, b: 124 }, 0.22 * atm.lampGlow));
    g.addColorStop(1, css({ r: 255, g: 196, b: 124 }, 0));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(p0.x, p0.y);
    ctx.lineTo(p1.x, p1.y);
    ctx.lineTo(top1.x, top1.y);
    ctx.lineTo(top0.x, top0.y);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
}

/** Столбы и кровля — рисуются ПОСЛЕ объектов, чтобы смыкать картинку. */
/**
 * Прозрачность кровли.
 *
 * Дом и сад — одна сцена, и всё, что игрок поставил в комнатах, должно быть
 * видно. Но и крыша нужна: без неё усадьба перестаёт читаться как дом.
 * Решение — кровля тает, когда под ней есть что разглядывать, и остаётся
 * плотной, пока комнаты пусты.
 */
export function roofOpacity(world: World): number {
  const h = findHouse(world);
  if (!h) return 1;
  let inside = 0;
  for (const o of world.objects) {
    const t = world.at(Math.floor(o.tx), Math.floor(o.ty));
    if (t?.indoor) inside++;
  }
  if (!inside) return 1;
  // Крыша именно тает, а не исчезает: силуэт кровли держит образ усадьбы,
  // без него остаётся парящая площадка татами.
  return lerp(1, 0.55, Math.min(1, inside / 4));
}

export function drawHouseRoof(ctx: Ctx, world: World, atm: Atmosphere, time: number): void {
  const h = findHouse(world);
  if (!h) return;
  // Прозрачностью занимается сцена: она кладёт всю кровлю одним слоем.
  // Гасить здесь каждый скат по отдельности нельзя — они перекрываются,
  // и полупрозрачные слои складываются обратно в плотную крышу.
  ctx.save();
  const T = woodTones(atm);
  const lvl = h.level;

  const X0 = h.x0 - OVERHANG;
  const Y0 = h.y0 - OVERHANG;
  const X1 = h.x1 + 1 + OVERHANG;
  const Y1 = h.y1 + 1 + OVERHANG;

  const eaveY = -WALL_H - 6;
  const ridgeY = eaveY - 46;

  // Углы свеса кровли
  const n = isoToScreen(X0, Y0, lvl); // дальний угол (север)
  const e = isoToScreen(X1, Y0, lvl); // восток
  const s = isoToScreen(X1, Y1, lvl); // ближний угол (юг)
  const w = isoToScreen(X0, Y1, lvl); // запад

  const cx = (n.x + s.x) / 2;
  const ridgeLen = Math.min((X1 - X0), (Y1 - Y0)) * 0.22;
  const ridgeA = isoToScreen(X0 + (X1 - X0) / 2 - ridgeLen, Y0 + (Y1 - Y0) / 2 - ridgeLen, lvl);
  const ridgeB = isoToScreen(X0 + (X1 - X0) / 2 + ridgeLen, Y0 + (Y1 - Y0) / 2 + ridgeLen, lvl);

  // Столбы по периметру веранды
  drawPosts(ctx, world, h, T, atm);

  // --- Кровля: четыре ската ---
  const eaves = {
    n: { x: n.x, y: n.y + eaveY },
    e: { x: e.x, y: e.y + eaveY },
    s: { x: s.x, y: s.y + eaveY },
    w: { x: w.x, y: w.y + eaveY },
  };
  const ridge = {
    a: { x: ridgeA.x, y: ridgeA.y + ridgeY },
    b: { x: ridgeB.x, y: ridgeB.y + ridgeY },
  };

  // Тень кровли на землю/пол
  ctx.save();
  ctx.fillStyle = css(atm.shadowTint, atm.shadowAmount * 0.5);
  ctx.beginPath();
  ctx.moveTo(n.x + 10, n.y + 6);
  ctx.lineTo(e.x + 10, e.y + 6);
  ctx.lineTo(s.x + 10, s.y + 6);
  ctx.lineTo(w.x + 10, w.y + 6);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  const slope = (p0: { x: number; y: number }, p1: { x: number; y: number }, r0: { x: number; y: number }, r1: { x: number; y: number }, col: RGB, curve: number) => {
    ctx.beginPath();
    ctx.moveTo(p0.x, p0.y);
    // вогнутая японская кровля: край слегка задран
    ctx.quadraticCurveTo((p0.x + p1.x) / 2, (p0.y + p1.y) / 2 + curve, p1.x, p1.y);
    ctx.lineTo(r1.x, r1.y);
    ctx.quadraticCurveTo((r0.x + r1.x) / 2, (r0.y + r1.y) / 2 - 3, r0.x, r0.y);
    ctx.closePath();
    ctx.fillStyle = css(col, 0.98);
    ctx.fill();
    ctx.strokeStyle = css(T.roofDark, 0.35);
    ctx.lineWidth = 1.4;
    ctx.stroke();
  };

  // дальние скаты (север-восток, север-запад) — светлее, к солнцу
  slope(eaves.n, eaves.e, ridge.a, ridge.b, T.roofLight, 7);
  slope(eaves.n, eaves.w, ridge.a, ridge.a, mix(T.roofLight, T.roof, 0.5), 7);
  // ближние скаты
  slope(eaves.s, eaves.e, ridge.b, ridge.b, T.roof, 9);
  slope(eaves.s, eaves.w, ridge.b, ridge.a, shade(T.roof, 0.88), 9);

  // черепичные линии
  ctx.save();
  ctx.strokeStyle = css(T.roofDark, 0.22);
  ctx.lineWidth = 1.1;
  for (let i = 1; i < 7; i++) {
    const t = i / 7;
    const a = { x: lerp(ridge.a.x, eaves.n.x, t), y: lerp(ridge.a.y, eaves.n.y, t) };
    const b = { x: lerp(ridge.b.x, eaves.e.x, t), y: lerp(ridge.b.y, eaves.e.y, t) };
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.quadraticCurveTo((a.x + b.x) / 2, (a.y + b.y) / 2 + 4 * t, b.x, b.y);
    ctx.stroke();
    const c = { x: lerp(ridge.b.x, eaves.s.x, t), y: lerp(ridge.b.y, eaves.s.y, t) };
    const d2 = { x: lerp(ridge.a.x, eaves.w.x, t), y: lerp(ridge.a.y, eaves.w.y, t) };
    ctx.beginPath();
    ctx.moveTo(c.x, c.y);
    ctx.quadraticCurveTo((c.x + d2.x) / 2, (c.y + d2.y) / 2 + 4 * t, d2.x, d2.y);
    ctx.stroke();
  }
  ctx.restore();

  // конёк
  ctx.strokeStyle = css(T.roofDark, 0.9);
  ctx.lineWidth = 6;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(ridge.a.x, ridge.a.y);
  ctx.lineTo(ridge.b.x, ridge.b.y);
  ctx.stroke();
  ctx.lineCap = 'butt';

  // толщина карниза по ближним кромкам
  const fascia = (p0: { x: number; y: number }, p1: { x: number; y: number }, curve: number) => {
    ctx.beginPath();
    ctx.moveTo(p0.x, p0.y);
    ctx.quadraticCurveTo((p0.x + p1.x) / 2, (p0.y + p1.y) / 2 + curve, p1.x, p1.y);
    ctx.lineTo(p1.x, p1.y + EAVE_DROP * 0.42);
    ctx.quadraticCurveTo((p0.x + p1.x) / 2, (p0.y + p1.y) / 2 + curve + EAVE_DROP * 0.42, p0.x, p0.y + EAVE_DROP * 0.42);
    ctx.closePath();
    ctx.fillStyle = css(T.roofDark, 0.95);
    ctx.fill();
  };
  fascia(eaves.w, eaves.s, 9);
  fascia(eaves.s, eaves.e, 9);

  granulate(ctx, cx, (ridge.a.y + eaves.s.y) / 2, TILE_W * 2.2, 46, T.roofDark, 991, 40, 0.06);

  // фонарик под свесом
  if (atm.lampGlow > 0.06) {
    const lx = eaves.s.x;
    const ly = eaves.s.y + EAVE_DROP * 0.5;
    const swing = Math.sin(time * 0.0011) * 3;
    ctx.strokeStyle = css(T.postDark, 0.8);
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(lx, ly);
    ctx.lineTo(lx + swing, ly + 16);
    ctx.stroke();
    const warm: RGB = { r: 255, g: 198, b: 130 };
    ctx.fillStyle = css(mix({ r: 250, g: 232, b: 200 }, warm, 0.5), 0.95);
    ctx.beginPath();
    ctx.ellipse(lx + swing, ly + 25, 8, 10, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    glow(ctx, lx + swing, ly + 25, 70, warm, atm.lampGlow * 0.7);
    ctx.restore();
  }
}

function drawPosts(ctx: Ctx, world: World, h: HouseBox, T: ReturnType<typeof woodTones>, atm: Atmosphere): void {
  const lvl = h.level;
  const postTop = -WALL_H - 6;
  const positions: [number, number][] = [];
  // столбы по кромке веранды с шагом 2 тайла
  const X0 = h.x0 - 0.8;
  const Y0 = h.y0 - 0.8;
  const X1 = h.x1 + 1.8;
  const Y1 = h.y1 + 1.8;
  for (let x = X0; x <= X1; x += 2.4) {
    positions.push([x, Y1]);
  }
  for (let y = Y0; y <= Y1; y += 2.4) {
    positions.push([X1, y]);
  }
  positions.push([X0, Y1], [X1, Y0]);

  for (const [px, py] of positions) {
    const t = world.at(Math.floor(px), Math.floor(py));
    if (!t) continue;
    const p = isoToScreen(px, py, lvl);
    const w = 5;
    // тень столба
    ctx.fillStyle = css(atm.shadowTint, atm.shadowAmount * 0.5);
    ctx.beginPath();
    ctx.ellipse(p.x + 3, p.y + 1, 7, 3, 0, 0, Math.PI * 2);
    ctx.fill();
    const grad = ctx.createLinearGradient(p.x - w, 0, p.x + w, 0);
    grad.addColorStop(0, css(shade(T.post, 0.8), 1));
    grad.addColorStop(0.45, css(T.post, 1));
    grad.addColorStop(1, css(shade(T.post, 0.68), 1));
    ctx.fillStyle = grad;
    ctx.fillRect(p.x - w / 2, p.y + postTop, w, -postTop);
    // капитель
    ctx.fillStyle = css(T.postDark, 0.9);
    ctx.fillRect(p.x - w * 0.9, p.y + postTop, w * 1.8, 4);
    void hash2;
  }
  ctx.restore();
}

export { LEVEL_H, TILE_H, TILE_W };
