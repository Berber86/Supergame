/** Деревья и кусты: стволы, ветви, кроны — стартовый сад почти весь отсюда. */

import { DrawCtx, Drawer, WHITE, litc, shadowUnder } from './common';
import { hash2, lerp } from '../../core/rng';
import { Atmosphere, RGB, css, mix, shade } from '../../world/palette';
import { blobPath, granulate, taperStroke, washBlob } from '../paint';

// ---------------- Деревья ----------------

interface TreeStyle {
  trunk: RGB;
  crownSpring: RGB;
  crownSummer: RGB;
  crownAutumn: RGB;
  crownWinter: RGB | null;
  blossom?: RGB;
  height: number;
  crownW: number;
  crownH: number;
  layers: number;
  droop?: number;
}

function crownColor(style: TreeStyle, atm: Atmosphere): { main: RGB; bare: boolean } {
  const s = atm.season;
  if (s === 'winter') {
    if (!style.crownWinter) return { main: style.crownAutumn, bare: true };
    return { main: style.crownWinter, bare: false };
  }
  const main = s === 'spring' ? style.crownSpring : s === 'summer' ? style.crownSummer : style.crownAutumn;
  return { main, bare: false };
}

function drawTrunk(d: DrawCtx, h: number, w: number, col: RGB, bend: number): { tx: number; ty: number } {
  const { ctx } = d;
  const topX = d.x + bend;
  const topY = d.y - h;
  taperStroke(ctx, d.x, d.y, topX, topY, w, w * 0.34, col, 0.94, bend * 0.6);
  // фактура коры
  ctx.strokeStyle = css(shade(col, 0.72), 0.3);
  ctx.lineWidth = 1;
  for (let i = 0; i < 3; i++) {
    const t0 = 0.1 + i * 0.25;
    ctx.beginPath();
    ctx.moveTo(lerp(d.x, topX, t0) - w * 0.3, lerp(d.y, topY, t0));
    ctx.quadraticCurveTo(
      lerp(d.x, topX, t0 + 0.1),
      lerp(d.y, topY, t0 + 0.1),
      lerp(d.x, topX, t0 + 0.2) + w * 0.2,
      lerp(d.y, topY, t0 + 0.2),
    );
    ctx.stroke();
  }
  return { tx: topX, ty: topY };
}

function drawBranches(d: DrawCtx, tx: number, ty: number, n: number, len: number, col: RGB, spread = 1): void {
  const { ctx, obj } = d;
  for (let i = 0; i < n; i++) {
    const r = hash2(i, obj.seed, 3);
    const side = i % 2 === 0 ? -1 : 1;
    const ang = side * (0.55 + r * 0.55) * spread;
    const l = len * (0.6 + r * 0.6);
    const ex = tx + Math.sin(ang) * l;
    const ey = ty - Math.cos(ang * 0.6) * l * 0.55 + (i / n) * len * 0.3;
    taperStroke(ctx, tx + side * 2, ty + i * 3, ex, ey, 3.2, 1.1, col, 0.8, side * 6);
  }
}

/** Голая зимняя крона: рекурсивное ветвление — читается как настоящее дерево. */
/**
 * Голая крона зимой.
 *
 * Раньше все породы ветвились одинаково, и зимой сакура, клён, ива и гинкго
 * становились неотличимы — в каталоге стояли четыре одинаковые картинки.
 * Теперь силуэт берётся из тех же пропорций кроны, что и летом: широкая
 * и низкая у ивы, узкая и высокая у гинкго.
 */

function drawBareCrown(
  d: DrawCtx,
  tx: number,
  ty: number,
  h: number,
  cw: number,
  ch: number,
  col: RGB,
  sway: number,
  droop = 0,
): void {
  const { ctx, obj } = d;
  // Во что вытянута крона: >1 — вширь (ива), <1 — вверх (гинкго)
  const spreadK = cw / Math.max(1, ch);
  const branch = (x: number, y: number, ang: number, len: number, w: number, depth: number, seed: number) => {
    if (depth > 3 || len < 4) return;
    // Поникающие ветви ивы клонятся вниз тем сильнее, чем дальше от ствола
    const sag = droop > 0 ? (droop / 100) * depth * 0.5 : 0;
    const ex = x + Math.sin(ang) * len + sway * 0.15 * depth;
    const ey = y - Math.cos(ang) * len + sag * len * 0.35;
    taperStroke(ctx, x, y, ex, ey, w, w * 0.55, col, 0.88, Math.sin(ang) * len * 0.1);
    const n = depth < 2 ? 3 : 2;
    for (let i = 0; i < n; i++) {
      const r = hash2(seed * 7 + i, obj.seed + depth, 53);
      const spread = (0.34 + r * 0.46) * (i % 2 === 0 ? 1 : -1) * spreadK;
      branch(ex, ey, ang + spread, len * (0.58 + r * 0.22), w * 0.6, depth + 1, seed * 3 + i + 1);
    }
  };
  // Широкая крона — больше скелетных ветвей и шире их веер
  const main = spreadK > 1.5 ? 5 : spreadK < 1.1 ? 3 : 4;
  const fan = 0.5 + spreadK * 0.55;
  for (let i = 0; i < main; i++) {
    const r = hash2(i, obj.seed, 71);
    const ang = -fan + (i / Math.max(1, main - 1)) * fan * 2 + (r - 0.5) * 0.28;
    // Длина ветвей — от высоты кроны: у гинкго они тянутся вверх сильнее
    const reach = h * 0.34 * (0.8 + r * 0.4) * (0.75 + (ch / Math.max(1, cw)) * 0.5);
    branch(tx, ty + 4, ang, reach, 3.4, 0, i + 1);
  }
}

function makeTree(style: TreeStyle): Drawer {
  return (d) => {
    const { ctx, atm, g, obj } = d;
    const scale = lerp(0.18, 1, Math.pow(g, 0.72));
    const h = style.height * scale;
    // Деревья одной породы не близнецы: пропорции кроны и её посадка
    // дрожат по сиду. Кэш ключуется сидом, так что дрожь стабильна.
    const shapeJ = hash2(obj.seed, 5, 7);
    const shapeJ2 = hash2(obj.seed, 6, 9);
    const shapeJ3 = hash2(obj.seed, 7, 11);
    const cw = style.crownW * scale * (0.92 + shapeJ * 0.16);
    const ch = style.crownH * scale * (0.92 + shapeJ2 * 0.16);
    const crownDx = (shapeJ - 0.5) * cw * 0.12;
    const sway = Math.sin(d.time * 0.0004 + obj.seed) * 3 * d.wind * scale;
    // Дополнительная детерминированная вариация по сиду:
    // - наклон ствола (lean) -0.12..0.12
    // - асимметрия кроны (больше влево/вправо)
    // - плотность листвы (layers jitter)
    const leanJ = (shapeJ3 - 0.5) * 0.24;
    const asymJ = (hash2(obj.seed, 8, 13) - 0.5) * 0.18;

    shadowUnder(d, cw * 0.62, cw * 0.26, 0.9);

    const trunkCol = litc(style.trunk, atm);
    // leanJ — детерминированный наклон по сиду, не меняется при входе
    const lean = sway * 0.35 + leanJ * h * 0.12;
    const { tx, ty } = drawTrunk(d, h, Math.max(2.2, 7 * scale), trunkCol, lean);

    const { main, bare } = crownColor(style, atm);
    const branchCol = shade(trunkCol, 0.92);

    if (bare) {
      // зимний силуэт: ветвистая крона + шапки снега
      drawBareCrown(d, tx, ty, h, cw, ch, branchCol, sway, style.droop ?? 0);
      const snow = litc({ r: 247, g: 249, b: 252 }, atm);
      // Снег лежит по куполу кроны: выше — купол уже, шапки мельче и
      // площе. Горизонтальной полосой они читались как прилепленные диски.
      for (let i = 0; i < 7; i++) {
        const r = hash2(i, obj.seed, 9);
        const r2 = hash2(i, obj.seed, 4);
        const up = 0.18 + r2 * 0.62; // 0 — низ кроны, 0.8 — верх
        const domeK = 1.05 - up * 0.75;
        washBlob(
          ctx,
          tx + (r - 0.5) * cw * domeK + sway,
          ty - ch * up,
          cw * (0.09 + r * 0.13) * (1 - up * 0.35),
          ch * (0.035 + r2 * 0.04),
          snow,
          obj.seed + i,
          { layers: 2, alpha: 0.6, edge: 0.08, wobble: 0.3 },
        );
      }
      return;
    }

    drawBranches(d, tx, ty, 5, h * 0.35, branchCol, 1);

    const cxx = tx + crownDx + asymJ * cw * 0.35;
    const crownMain = litc(main, atm);
    const crownDeep = litc(shade(mix(main, atm.palette.foliageDeep, 0.55), 0.92), atm);
    const crownLight = litc(mix(main, WHITE, 0.3), atm, 0.05);
    const crownShade = litc(shade(mix(main, atm.palette.foliageDeep, 0.6), 0.8), atm);

    // Крона — стопка акварельных клякс
    const layers = style.layers;
    for (let i = 0; i < layers; i++) {
      const r1 = hash2(i, obj.seed, 11);
      const r2 = hash2(i, obj.seed, 19);
      const spread = 1 - i / (layers + 1);
      const lx = cxx + (r1 - 0.5) * cw * 1.05 + sway * (1 + i * 0.15);
      const ly = ty - ch * 0.15 + (r2 - 0.5) * ch * 0.75 - i * ch * 0.06;
      const rx = cw * (0.42 + r1 * 0.3) * (0.7 + spread * 0.5);
      const ry = ch * (0.3 + r2 * 0.22);
      // тёмный низ
      washBlob(ctx, lx, ly + ry * 0.3, rx, ry, crownDeep, obj.seed + i * 7, {
        layers: 2,
        alpha: 0.4,
        edge: 0.16,
        wobble: 0.28,
      });
      // основной тон
      washBlob(ctx, lx, ly, rx * 0.96, ry * 0.94, crownMain, obj.seed + i * 13, {
        layers: 3,
        alpha: 0.4,
        edge: 0.19,
        wobble: 0.28,
      });
    }

    // Сторона, отвернувшаяся от солнца: собирает глубокий тон. Ночью
    // почти не читается — и не нужна, туда её и прячем.
    const shadeA = 0.34 * (0.35 + 0.65 * atm.time.daylight);
    if (shadeA > 0.05) {
      washBlob(
        ctx,
        cxx + atm.sunDir.x * cw * 0.3 + sway,
        ty - ch * 0.02,
        cw * 0.42,
        ch * 0.32,
        crownShade,
        obj.seed + 47,
        { layers: 2, alpha: shadeA, edge: 0.1, wobble: 0.3 },
      );
    }

    // Солнечный верх
    const sunX = cxx - atm.sunDir.x * cw * 0.32 + sway;
    washBlob(ctx, sunX, ty - ch * 0.42, cw * 0.44, ch * 0.24, crownLight, obj.seed + 91, {
      layers: 2,
      alpha: 0.4,
      edge: 0,
      wobble: 0.28,
    });

    // Золотой час: тёплый кант по световой кромке кроны
    if (atm.golden > 0.08) {
      const rim = litc(mix({ r: 255, g: 190, b: 110 }, WHITE, 0.25), atm, 0.06);
      washBlob(ctx, sunX - atm.sunDir.x * cw * 0.1, ty - ch * 0.46, cw * 0.4, ch * 0.1, rim, obj.seed + 97, {
        layers: 2,
        alpha: 0.5 * atm.golden,
        edge: 0,
        wobble: 0.5,
      });
    }

    // Кромка кроны — не гладкий овал, а лопасти: кольцо мелких клякс
    // по периметру ломает силуэт, и дерево перестаёт быть «наклейкой».
    const rimN = Math.round(7 * scale) + 3;
    for (let i = 0; i < rimN; i++) {
      const a = (i / rimN) * Math.PI * 2 + hash2(i, obj.seed, 51) * 0.8;
      const rw = 0.88 + hash2(i, obj.seed, 57) * 0.3;
      const ex = cxx + Math.cos(a) * cw * 0.56 * rw + sway;
      const ey = ty - ch * 0.12 + Math.sin(a) * ch * 0.42 * rw;
      const top = Math.sin(a) < -0.35;
      const col = top ? mix(crownMain, crownLight, 0.45) : mix(crownMain, crownDeep, 0.4);
      washBlob(ctx, ex, ey, cw * 0.15, ch * 0.1, col, obj.seed + 61 + i * 3, {
        layers: 2,
        alpha: 0.42,
        edge: 0.16,
        wobble: 0.34,
      });
    }

    granulate(
      ctx,
      cxx + sway,
      ty - ch * 0.15,
      cw * 0.5,
      ch * 0.4,
      crownDeep,
      obj.seed,
      Math.round(16 * scale) + 4,
      0.14,
    );

    // Ветви проступают сквозь листву: крона — не облако на палке,
    // а листва на скелете дерева.
    if (scale > 0.45) {
      const nb = 3;
      for (let i = 0; i < nb; i++) {
        const r = hash2(i, obj.seed, 67);
        const r2 = hash2(i, obj.seed, 71);
        const bx = tx + (r - 0.5) * cw * 0.3 + sway * 0.5;
        const ex = cxx + (r2 - 0.5) * cw * 0.85 + sway * 0.8;
        const ey = ty - ch * (0.28 + r * 0.3);
        taperStroke(ctx, bx, ty + 6, ex, ey, 1.8 * scale, 0.7 * scale, branchCol, 0.3, (r - 0.5) * cw * 0.2);
      }
    }

    // Цветение (сакура, азалия)
    if (style.blossom && (atm.season === 'spring' || (atm.season === 'summer' && style.blossom))) {
      const strength = atm.season === 'spring' ? 1 : 0.25;
      const bl = litc(style.blossom, atm, 0.05);
      const n = Math.round(10 * scale * strength) + 3;
      for (let i = 0; i < n; i++) {
        const r1 = hash2(i, obj.seed, 23);
        const r2 = hash2(i, obj.seed, 29);
        const px = cxx + (r1 - 0.5) * cw * 1.15 + sway;
        const py = ty - ch * 0.2 + (r2 - 0.5) * ch * 0.95;
        ctx.fillStyle = css(bl, 0.55 + r1 * 0.3);
        blobPath(ctx, px, py, cw * 0.1 * (0.6 + r2 * 0.7), ch * 0.07 * (0.6 + r1 * 0.7), obj.seed + i, 0.35, 7);
        ctx.fill();
      }
    }

    // Ива: свисающие пряди
    if (style.droop) {
      const dropCol = litc(shade(main, 0.95), atm);
      for (let i = 0; i < Math.round(9 * scale) + 3; i++) {
        const r = hash2(i, obj.seed, 37);
        const sx = cxx + (r - 0.5) * cw * 1.1 + sway;
        const sy = ty - ch * 0.1 + (hash2(i, obj.seed, 41) - 0.5) * ch * 0.4;
        const len = style.droop * scale * (0.6 + r * 0.8);
        const wob = Math.sin(d.time * 0.0007 + i) * 5 * d.wind;
        ctx.strokeStyle = css(dropCol, 0.5);
        ctx.lineWidth = 2.4;
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.quadraticCurveTo(sx + wob, sy + len * 0.6, sx + wob * 1.5 - 2, sy + len);
        ctx.stroke();
      }
    }
  };
}

export const drawSakura = makeTree({
  trunk: { r: 122, g: 94, b: 82 },
  crownSpring: { r: 244, g: 196, b: 210 },
  crownSummer: { r: 138, g: 172, b: 116 },
  crownAutumn: { r: 206, g: 150, b: 104 },
  crownWinter: null,
  blossom: { r: 252, g: 226, b: 234 },
  height: 96,
  crownW: 98,
  crownH: 74,
  layers: 5,
});

export const drawMaple = makeTree({
  trunk: { r: 108, g: 84, b: 74 },
  crownSpring: { r: 150, g: 186, b: 116 },
  crownSummer: { r: 110, g: 158, b: 96 },
  crownAutumn: { r: 208, g: 104, b: 66 },
  crownWinter: null,
  height: 92,
  crownW: 96,
  crownH: 72,
  layers: 5,
});

export const drawGinkgo = makeTree({
  trunk: { r: 128, g: 106, b: 86 },
  crownSpring: { r: 164, g: 196, b: 122 },
  crownSummer: { r: 128, g: 172, b: 102 },
  crownAutumn: { r: 234, g: 194, b: 88 },
  crownWinter: null,
  height: 98,
  crownW: 82,
  crownH: 78,
  layers: 4,
});

export const drawWillow = makeTree({
  trunk: { r: 116, g: 100, b: 80 },
  crownSpring: { r: 172, g: 200, b: 130 },
  crownSummer: { r: 140, g: 178, b: 110 },
  crownAutumn: { r: 198, g: 186, b: 116 },
  crownWinter: null,
  height: 94,
  crownW: 104,
  crownH: 58,
  layers: 4,
  droop: 46,
});

export const drawPine: Drawer = (d) => {
  const { ctx, atm, g, obj } = d;
  const scale = lerp(0.2, 1, Math.pow(g, 0.7));
  const h = 106 * scale;
  const sway = Math.sin(d.time * 0.0003 + obj.seed) * 2 * d.wind * scale;
  shadowUnder(d, 40 * scale, 17 * scale, 0.9);

  const trunkCol = litc({ r: 108, g: 82, b: 66 }, atm);
  const leanJ = (hash2(obj.seed, 7, 11) - 0.5) * 0.18;
  const { tx, ty } = drawTrunk(d, h, Math.max(2.4, 8 * scale), trunkCol, sway * 0.3 + leanJ * h * 0.08);

  const needle = atm.season === 'winter' ? { r: 96, g: 124, b: 116 } : { r: 84, g: 130, b: 92 };
  const main = litc(needle, atm);
  const deep = litc(shade(needle, 0.78), atm);
  const light = litc(mix(needle, { r: 200, g: 226, b: 170 }, 0.3), atm, 0.03);

  // Ярусы «облаков» хвои — характерная японская сосна
  // Вариация по сиду: 3..5 ярусов, не всегда 4
  const tiers = 3 + Math.floor(hash2(obj.seed, 13, 17) * 3);
  for (let i = 0; i < tiers; i++) {
    const t = i / (tiers - 1);
    const side = i % 2 === 0 ? -1 : 1;
    const cx = tx + side * (16 + 14 * (1 - t)) * scale + sway * (1 + t);
    const cy = ty + t * h * 0.62;
    const rx = (44 - t * 8) * scale;
    const ry = (17 + t * 4) * scale;
    // ветка к ярусу
    taperStroke(ctx, tx, cy + 4, cx, cy + 2, 3 * scale, 1.4 * scale, shade(trunkCol, 0.92), 0.8);
    washBlob(ctx, cx, cy + ry * 0.35, rx, ry, deep, obj.seed + i * 5, {
      layers: 2,
      alpha: 0.42,
      edge: 0.14,
      wobble: 0.3,
    });
    washBlob(ctx, cx, cy, rx * 0.95, ry * 0.9, main, obj.seed + i * 9, {
      layers: 3,
      alpha: 0.4,
      edge: 0.16,
      wobble: 0.28,
    });
    washBlob(ctx, cx - atm.sunDir.x * rx * 0.2, cy - ry * 0.4, rx * 0.5, ry * 0.4, light, obj.seed + i * 3, {
      layers: 1,
      alpha: 0.28,
      edge: 0,
    });
    if (atm.season === 'winter') {
      washBlob(ctx, cx, cy - ry * 0.5, rx * 0.7, ry * 0.3, litc({ r: 246, g: 247, b: 250 }, atm), obj.seed + i, {
        layers: 2,
        alpha: 0.45,
        edge: 0.08,
      });
    }
  }
  // верхушка
  washBlob(ctx, tx + sway, ty - 6 * scale, 22 * scale, 11 * scale, main, obj.seed + 77, {
    layers: 3,
    alpha: 0.42,
    edge: 0.16,
  });
};

export const drawBamboo: Drawer = (d) => {
  const { ctx, atm, g, obj } = d;
  const scale = lerp(0.3, 1, Math.pow(g, 0.6));
  const stalks = 2 + Math.floor(hash2(obj.seed, 21, 29) * 3); // 2..4 стебля
  shadowUnder(d, 16 * scale, 7 * scale, 0.6);
  const stalkCol = litc(atm.season === 'winter' ? { r: 168, g: 176, b: 150 } : { r: 158, g: 186, b: 116 }, atm);
  const leafCol = litc(atm.season === 'winter' ? { r: 150, g: 164, b: 148 } : { r: 122, g: 164, b: 100 }, atm);
  for (let s = 0; s < stalks; s++) {
    const r = hash2(s, obj.seed, 13);
    const h = (82 + r * 54) * scale;
    const ox = (s - 1) * 7 * scale + (r - 0.5) * 5;
    const sway = Math.sin(d.time * 0.0008 + obj.seed + s * 1.7) * 5 * d.wind * scale;
    const x0 = d.x + ox;
    const x1 = x0 + sway;
    const y1 = d.y - h;
    taperStroke(ctx, x0, d.y, x1, y1, 3 * scale, 1.8 * scale, stalkCol, 0.95, sway * 0.5);
    // коленца
    ctx.strokeStyle = css(shade(stalkCol, 0.78), 0.5);
    ctx.lineWidth = 1.2;
    const segs = 5;
    for (let i = 1; i < segs; i++) {
      const t = i / segs;
      const px = lerp(x0, x1, t);
      const py = lerp(d.y, y1, t);
      ctx.beginPath();
      ctx.moveTo(px - 3.2 * scale, py);
      ctx.lineTo(px + 3.2 * scale, py);
      ctx.stroke();
    }
    // листья
    for (let i = 0; i < 5; i++) {
      const rr = hash2(i, obj.seed + s, 21);
      const t = 0.45 + (i / 5) * 0.55;
      const px = lerp(x0, x1, t);
      const py = lerp(d.y, y1, t);
      const dir = i % 2 === 0 ? 1 : -1;
      const ll = (14 + rr * 12) * scale;
      const lw = Math.sin(d.time * 0.001 + i) * 2 * d.wind;
      ctx.fillStyle = css(leafCol, 0.8);
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.quadraticCurveTo(px + dir * ll * 0.5, py - ll * 0.42 + lw, px + dir * ll, py - ll * 0.2 + lw);
      ctx.quadraticCurveTo(px + dir * ll * 0.5, py - ll * 0.1 + lw, px, py + 1.5);
      ctx.closePath();
      ctx.fill();
    }
  }
};

export const drawShrub: Drawer = (d) => {
  const { ctx, atm, g, obj } = d;
  const scale = lerp(0.3, 1, Math.pow(g, 0.7));
  const isAzalea = d.obj.type === 'azalea';
  const rx = 33 * scale;
  const ry = 21 * scale;
  shadowUnder(d, rx * 0.9, ry * 0.5, 0.8);
  const base =
    atm.season === 'winter'
      ? { r: 168, g: 178, b: 172 }
      : atm.season === 'autumn'
        ? { r: 176, g: 156, b: 104 }
        : { r: 116, g: 160, b: 100 };
  const main = litc(base, atm);
  const deep = litc(shade(base, 0.8), atm);
  const sway = Math.sin(d.time * 0.0006 + obj.seed) * 2 * d.wind;
  washBlob(ctx, d.x + sway, d.y - ry * 0.55, rx, ry, deep, obj.seed, {
    layers: 2,
    alpha: 0.42,
    edge: 0.15,
    wobble: 0.22,
  });
  washBlob(ctx, d.x + sway, d.y - ry * 0.75, rx * 0.92, ry * 0.9, main, obj.seed + 7, {
    layers: 3,
    alpha: 0.4,
    edge: 0.16,
    wobble: 0.2,
  });
  washBlob(
    ctx,
    d.x - atm.sunDir.x * rx * 0.3 + sway,
    d.y - ry * 1.05,
    rx * 0.5,
    ry * 0.4,
    litc(mix(base, WHITE, 0.25), atm, 0.03),
    obj.seed + 3,
    {
      layers: 1,
      alpha: 0.3,
      edge: 0,
    },
  );
  granulate(ctx, d.x, d.y - ry * 0.7, rx * 0.8, ry * 0.7, deep, obj.seed, 12, 0.1);
  if (isAzalea && (atm.season === 'spring' || atm.season === 'summer')) {
    const fl = litc(atm.season === 'spring' ? { r: 236, g: 138, b: 162 } : { r: 240, g: 196, b: 206 }, atm, 0.04);
    for (let i = 0; i < Math.round(11 * scale) + 2; i++) {
      const r1 = hash2(i, obj.seed, 31);
      const r2 = hash2(i, obj.seed, 43);
      ctx.fillStyle = css(fl, 0.75);
      const px = d.x + (r1 - 0.5) * rx * 1.7 + sway;
      const py = d.y - ry * 0.75 + (r2 - 0.5) * ry * 1.5;
      blobPath(ctx, px, py, 3.2 * scale + r1 * 2, 2.4 * scale + r2 * 1.6, obj.seed + i, 0.3, 6);
      ctx.fill();
    }
  }
};

export const drawWisteria: Drawer = (d) => {
  const { ctx, atm, g, obj } = d;
  const scale = lerp(0.35, 1, Math.pow(g, 0.7));
  const w = 42 * scale;
  const h = 62 * scale;
  shadowUnder(d, w * 0.8, 8 * scale, 0.9);

  // Опоры перголы
  const post = litc({ r: 122, g: 96, b: 70 }, atm);
  for (const sx of [-1, 1]) {
    taperStroke(ctx, d.x + sx * w * 0.8, d.y, d.x + sx * w * 0.8, d.y - h, 3.4 * scale, 2.6 * scale, post, 0.95, 0);
  }
  // Перекладина
  ctx.strokeStyle = css(post, 0.95);
  ctx.lineWidth = 3.2 * scale;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(d.x - w * 0.92, d.y - h);
  ctx.lineTo(d.x + w * 0.92, d.y - h + 1);
  ctx.stroke();

  const bare = atm.season === 'winter';
  const leafBase = atm.season === 'autumn' ? { r: 186, g: 168, b: 96 } : { r: 104, g: 146, b: 92 };
  const leaf = litc(leafBase, atm);

  // Листва по перекладине: несколько пятен вместо одной плиты —
  // сплошной прямоугольник читался как навес, а не как растение
  if (!bare) {
    const puffs = 4;
    for (let i = 0; i < puffs; i++) {
      const r1 = hash2(i, obj.seed, 13);
      const px = d.x + (i / (puffs - 1) - 0.5) * w * 1.7;
      washBlob(
        ctx,
        px,
        d.y - h + (2 + r1 * 5) * scale,
        w * (0.36 + r1 * 0.2),
        (9 + r1 * 5) * scale,
        i % 2 ? leaf : litc(shade(leafBase, 0.86), atm),
        obj.seed + i * 5,
        { layers: 2, alpha: 0.46, edge: 0.14, wobble: 0.3 },
      );
    }
  }

  // Свисающие грозди
  const bunches = Math.round(6 + scale * 4);
  const bloom = atm.season === 'spring';
  const cluster = litc({ r: 158, g: 130, b: 202 }, atm, 0.04);
  for (let i = 0; i < bunches; i++) {
    const r1 = hash2(i, obj.seed, 19);
    const px = d.x + (i / (bunches - 1) - 0.5) * w * 1.6 + (r1 - 0.5) * 5;
    // Весной грозди длинные — это главный силуэт глицинии
    const len = (bloom ? 40 : 13) * scale * (0.65 + r1 * 0.7);
    const sway = Math.sin(d.time * 0.0011 + i * 0.9 + obj.seed) * 2.4 * d.wind;

    if (bare) {
      // зимой только плети
      ctx.strokeStyle = css(litc({ r: 116, g: 98, b: 84 }, atm), 0.7);
      ctx.lineWidth = 1.1;
      ctx.beginPath();
      ctx.moveTo(px, d.y - h + 4 * scale);
      ctx.quadraticCurveTo(px + sway, d.y - h + len * 0.6, px + sway * 1.6, d.y - h + len);
      ctx.stroke();
      continue;
    }

    if (bloom) {
      // Гроздь сужается книзу — вытянутая капля из мелких цветков
      const steps = Math.max(3, Math.round(len / 4));
      for (let k = 0; k < steps; k++) {
        const tt = k / steps;
        const yy = d.y - h + 6 * scale + tt * len;
        const xx = px + sway * tt * 1.4;
        const rr = (4 - tt * 2.5) * scale;
        ctx.fillStyle = css(mix(cluster, WHITE, tt * 0.35), 0.72 - tt * 0.18);
        blobPath(ctx, xx, yy, rr, rr * 0.82, obj.seed + i * 7 + k, 0.34, 6);
        ctx.fill();
      }
    } else {
      ctx.fillStyle = css(leaf, 0.5);
      blobPath(ctx, px + sway, d.y - h + 8 * scale + len * 0.4, 5 * scale, len * 0.42, obj.seed + i, 0.3, 7);
      ctx.fill();
    }
  }
  ctx.lineCap = 'butt';
};

/** Хурма: осенью на голых ветках висят оранжевые фонарики. */

export const drawPersimmon: Drawer = (d) => {
  const { ctx, atm, g, obj } = d;
  const scale = lerp(0.3, 1, Math.pow(g, 0.72));
  const h = 74 * scale;
  const rx = 30 * scale;
  const ry = 24 * scale;
  shadowUnder(d, rx * 0.95, ry * 0.42, 0.9);

  const bend = Math.sin(d.time * 0.0005 + obj.seed) * 3 * d.wind;
  const top = drawTrunk(d, h, 5.4 * scale, litc({ r: 112, g: 92, b: 76 }, atm), bend);

  const autumn = atm.season === 'autumn';
  const winter = atm.season === 'winter';
  const leafBase = autumn ? { r: 208, g: 138, b: 72 } : { r: 96, g: 138, b: 88 };

  if (!winter) {
    const main = litc(leafBase, atm);
    washBlob(ctx, top.tx, top.ty, rx, ry, litc(shade(leafBase, 0.82), atm), obj.seed, {
      layers: 2,
      alpha: 0.44,
      edge: 0.16,
      wobble: 0.24,
    });
    washBlob(ctx, top.tx, top.ty - ry * 0.2, rx * 0.86, ry * 0.86, main, obj.seed + 5, {
      layers: 3,
      alpha: 0.4,
      edge: 0.15,
      wobble: 0.22,
    });
  }

  // Зимой — голые ветки, и плоды вешаем на их концы
  const tips: { x: number; y: number }[] = [];
  if (winter) {
    const br = litc({ r: 104, g: 88, b: 76 }, atm);
    for (let i = 0; i < 5; i++) {
      const a = -Math.PI * 0.82 + (i / 4) * Math.PI * 0.64 + (hash2(i, obj.seed, 11) - 0.5) * 0.3;
      const len = rx * (0.7 + hash2(i, obj.seed, 23) * 0.5);
      const ex = top.tx + Math.cos(a) * len;
      const ey = top.ty + Math.sin(a) * len;
      taperStroke(ctx, top.tx, top.ty + ry * 0.2, ex, ey, 2.4 * scale, 0.8, br, 0.8, 0);
      tips.push({ x: ex, y: ey });
    }
  }

  // Плоды: осенью много в кроне, зимой несколько забытых на концах веток —
  // именно этим хурма и красива в снегу
  if (autumn || winter) {
    const count = autumn ? Math.round(7 + scale * 4) : 3;
    const fruit = litc({ r: 234, g: 122, b: 44 }, atm, 0.06);
    for (let i = 0; i < count; i++) {
      const r1 = hash2(i, obj.seed, 37);
      const r2 = hash2(i, obj.seed, 53);
      let px: number;
      let py: number;
      if (winter) {
        // на конец ветки, чуть ниже — плод оттягивает её вниз
        const tip = tips[(i * 2 + 1) % tips.length];
        px = tip.x + (r1 - 0.5) * 3;
        py = tip.y + 3 + r2 * 2;
      } else {
        px = top.tx + (r1 - 0.5) * rx * 1.5;
        py = top.ty + (r2 - 0.4) * ry * 1.1;
      }
      const rr = (winter ? 4.4 : 3.6) * scale;
      ctx.fillStyle = css(fruit, 0.92);
      ctx.beginPath();
      ctx.ellipse(px, py, rr, rr * 0.88, 0, 0, Math.PI * 2);
      ctx.fill();
      // блик и чашелистик
      ctx.fillStyle = css(mix(fruit, WHITE, 0.45), 0.5);
      ctx.beginPath();
      ctx.ellipse(px - rr * 0.3, py - rr * 0.3, rr * 0.3, rr * 0.24, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = css(litc({ r: 96, g: 112, b: 72 }, atm), 0.8);
      ctx.beginPath();
      ctx.ellipse(px, py - rr * 0.85, rr * 0.5, rr * 0.24, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }
};

/** Камелия: плотный тёмный куст, цветёт зимой и ранней весной. */

export const drawCamellia: Drawer = (d) => {
  const { ctx, atm, g, obj } = d;
  const scale = lerp(0.32, 1, Math.pow(g, 0.7));
  const rx = 28 * scale;
  const ry = 22 * scale;
  shadowUnder(d, rx * 0.9, ry * 0.42, 0.85);

  // Листва тёмная и глянцевая круглый год — этим камелия и ценна
  const base = { r: 62, g: 104, b: 74 };
  const main = litc(base, atm);
  const sway = Math.sin(d.time * 0.0006 + obj.seed) * 1.8 * d.wind;
  washBlob(ctx, d.x + sway, d.y - ry * 0.7, rx, ry, litc(shade(base, 0.78), atm), obj.seed, {
    layers: 2,
    alpha: 0.46,
    edge: 0.14,
    wobble: 0.2,
  });
  washBlob(ctx, d.x + sway, d.y - ry * 0.92, rx * 0.88, ry * 0.86, main, obj.seed + 9, {
    layers: 3,
    alpha: 0.42,
    edge: 0.14,
    wobble: 0.18,
  });
  // глянец
  ctx.fillStyle = css(litc(mix(base, WHITE, 0.4), atm, 0.05), 0.24);
  blobPath(ctx, d.x - atm.sunDir.x * rx * 0.32 + sway, d.y - ry * 1.2, rx * 0.44, ry * 0.3, obj.seed + 3, 0.26, 7);
  ctx.fill();

  // Цветы — зимой и ранней весной
  const blooms = atm.season === 'winter' || atm.season === 'spring';
  if (blooms) {
    const count = Math.round(5 + scale * 4);
    const petal = litc({ r: 224, g: 78, b: 100 }, atm, 0.06);
    for (let i = 0; i < count; i++) {
      const r1 = hash2(i, obj.seed, 29);
      const r2 = hash2(i, obj.seed, 41);
      const px = d.x + (r1 - 0.5) * rx * 1.5 + sway;
      const py = d.y - ry * 0.9 + (r2 - 0.5) * ry * 1.2;
      const rr = 5.6 * scale;
      // пять лепестков вокруг жёлтой сердцевины
      for (let k = 0; k < 5; k++) {
        const a = (k / 5) * Math.PI * 2 + r1 * 2;
        ctx.fillStyle = css(petal, 0.92);
        ctx.beginPath();
        ctx.ellipse(px + Math.cos(a) * rr * 0.5, py + Math.sin(a) * rr * 0.4, rr * 0.52, rr * 0.42, a, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = css(litc({ r: 248, g: 218, b: 118 }, atm, 0.08), 0.96);
      ctx.beginPath();
      ctx.arc(px, py, rr * 0.28, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Зимой на кусте лежит снег
  if (atm.season === 'winter') {
    ctx.fillStyle = css(litc({ r: 248, g: 250, b: 255 }, atm, 0.05), 0.6);
    blobPath(ctx, d.x + sway, d.y - ry * 1.3, rx * 0.68, ry * 0.3, obj.seed + 17, 0.3, 8);
    ctx.fill();
  }
};

// ---------------- Интерьер усадьбы ----------------

/** Изометрическая «стенка»: плоскость, стоящая вдоль одной из осей. */
