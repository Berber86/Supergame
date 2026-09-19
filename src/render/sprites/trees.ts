import { plantYear, leafGroup, crownAnchorBlend } from '../../world/phenology';
import { crownSites } from '../crownGeometry';
/** Деревья и кусты: стволы, ветви, кроны — стартовый сад почти весь отсюда. */

import { flowerOpenness, flowerHeadPath } from '../flowerCycle';
import { DrawCtx, Drawer, WHITE, litc, shadowUnder } from './common';
import { hash2, lerp, smoothstep } from '../../core/rng';
import { RGB, css, mix, shade } from '../../world/palette';
import { blobPath, granulate, taperStroke, washBlob } from '../paint';

// ---------------- Деревья ----------------

interface TreeStyle {
  trunk: RGB;
  crownSpring: RGB;
  crownSummer: RGB;
  crownAutumn: RGB;
  blossom?: RGB;
  height: number;
  crownW: number;
  crownH: number;
  layers: number;
  droop?: number;
  fruit?: RGB;
}

function anchorColor(now: number, colors: RGB[]): RGB {
  const b = crownAnchorBlend(now);
  return mix(colors[b.from], colors[b.to], b.amount);
}

function drawTrunk(d: DrawCtx, h: number, w: number, col: RGB, bend: number): { tx: number; ty: number } {
  const { ctx, atm, obj } = d;
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
  // северный мох и лишайник на стволе — детерминирован по seed, больше в тени
  const mossChance = hash2(obj.seed, 101, 7);
  if (mossChance > 0.48 && atm.season !== 'winter') {
    const mh = h * (0.22 + hash2(obj.seed, 107, 3) * 0.18);
    const my = lerp(d.y, topY, 0.18 + hash2(obj.seed, 109, 5) * 0.35);
    const side = hash2(obj.seed, 103, 13) > 0.5 ? 1 : -1;
    const mx = lerp(d.x, topX, 0.3) + side * w * 0.18;
    const mossCol = litc(atm.palette.moss, atm);
    ctx.fillStyle = css(mossCol, 0.28 + mossChance * 0.12);
    blobPath(ctx, mx, my, w * 0.55, mh * 0.22, obj.seed + 101, 0.3, 7);
    ctx.fill();
    if (mossChance > 0.72) {
      ctx.fillStyle = css(litc({ r: 172, g: 188, b: 152 }, atm), 0.26);
      blobPath(ctx, mx - side * w * 0.15, my - mh * 0.2, w * 0.32, mh * 0.14, obj.seed + 113, 0.28, 6);
      ctx.fill();
    }
  }
  return { tx: topX, ty: topY };
}

/** Гнёзда и дупла — детерминированно по seed, сезонно, без кропа. */
function drawTreeCavity(d: DrawCtx, tx: number, ty: number, _h: number, w: number): void {
  const { ctx, atm, obj } = d;
  const cavitySeed = hash2(obj.seed, 151, 7);
  if (cavitySeed < 0.72) return; // ~28% деревьев с фичей
  const typeRoll = hash2(obj.seed, 157, 13);
  const isHollow = typeRoll < 0.5;
  const scale = lerp(0.18, 1, Math.pow(d.g, 0.72));
  const hy = lerp(d.y, ty, 0.28 + hash2(obj.seed, 153, 11) * 0.45);
  const hx = lerp(d.x, tx, 0.32 + hash2(obj.seed, 155, 17) * 0.35) + (hash2(obj.seed, 159, 19) - 0.5) * w * 0.6;
  if (isHollow) {
    // дупло — тёмный овал с бликом коры
    const hrx = (3.2 + hash2(obj.seed, 161, 23) * 1.8) * scale;
    const hry = (5.2 + hash2(obj.seed, 163, 29) * 2.4) * scale;
    ctx.fillStyle = css(litc({ r: 42, g: 32, b: 26 }, atm), 0.88);
    ctx.beginPath();
    ctx.ellipse(hx, hy, hrx, hry, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = css(litc({ r: 28, g: 20, b: 16 }, atm), 0.72);
    ctx.beginPath();
    ctx.ellipse(hx, hy + hry * 0.18, hrx * 0.72, hry * 0.52, 0, 0, Math.PI * 2);
    ctx.fill();
    // яйца / птенец выглядывает только весной
    if (atm.season === 'spring' && hash2(obj.seed, 167, 31) > 0.55) {
      const eggCol = litc({ r: 240, g: 232, b: 210 }, atm);
      ctx.fillStyle = css(eggCol, 0.85);
      ctx.beginPath();
      ctx.ellipse(hx + hrx * 0.1, hy + hry * 0.25, hrx * 0.32, hry * 0.22, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  } else {
    // гнездо на развилке
    const nrx = (7.5 + hash2(obj.seed, 173, 37) * 3.5) * scale;
    const nry = (3.2 + hash2(obj.seed, 179, 41) * 1.6) * scale;
    const twig = litc({ r: 138, g: 118, b: 88 }, atm);
    const twigDark = litc(shade({ r: 138, g: 118, b: 88 }, 0.72), atm);
    // base shadow
    ctx.fillStyle = css(twigDark, 0.32);
    blobPath(ctx, hx, hy + nry * 0.3, nrx * 1.05, nry * 0.9, obj.seed + 181, 0.24, 8);
    ctx.fill();
    ctx.fillStyle = css(twig, 0.88);
    blobPath(ctx, hx, hy, nrx, nry, obj.seed + 183, 0.28, 9);
    ctx.fill();
    // cross-hatch веточки
    ctx.strokeStyle = css(twigDark, 0.42);
    ctx.lineWidth = 0.9;
    for (let k = 0; k < 4; k++) {
      const r = hash2(k, obj.seed, 191);
      ctx.beginPath();
      ctx.moveTo(hx - nrx * 0.7 + r * nrx * 0.3, hy - nry * 0.2 + (r - 0.5) * nry);
      ctx.lineTo(hx + nrx * 0.7 - r * nrx * 0.2, hy + nry * 0.15 + (r - 0.5) * nry * 0.5);
      ctx.stroke();
    }
    // яйца в гнезде — сезонно
    if (atm.season === 'spring' || atm.season === 'summer') {
      const eggCount = 1 + Math.floor(hash2(obj.seed, 193, 43) * 3); // 1..3
      for (let e = 0; e < eggCount; e++) {
        const re = hash2(e, obj.seed, 197);
        const re2 = hash2(e, obj.seed, 199);
        const ex = hx + (re - 0.5) * nrx * 0.7;
        const ey = hy - nry * 0.15 + (re2 - 0.5) * nry * 0.5;
        const speck = re > 0.5;
        const eggC = litc(speck ? { r: 235, g: 226, b: 198 } : { r: 210, g: 228, b: 220 }, atm);
        ctx.fillStyle = css(eggC, 0.92);
        ctx.beginPath();
        ctx.ellipse(ex, ey, 1.8 * scale + re * 0.6, 2.4 * scale + re2 * 0.5, 0, 0, Math.PI * 2);
        ctx.fill();
        if (speck) {
          ctx.fillStyle = css(litc({ r: 120, g: 92, b: 72 }, atm), 0.35);
          for (let s = 0; s < 3; s++) {
            const rs = hash2(s, obj.seed + e, 211);
            ctx.beginPath();
            ctx.arc(ex + (rs - 0.5) * 1.2, ey + (hash2(s, obj.seed + e, 223) - 0.5) * 1.2, 0.4, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }
    }
  }
}

function makeTree(style: TreeStyle): Drawer {
  return (d) => {
    const { ctx, atm, g, obj } = d,
      state = plantYear(obj.type, obj.seed, atm.time.now);
    const scale = lerp(0.18, 1, Math.pow(g, 0.72)),
      h = style.height * scale;
    const cw = style.crownW * scale * (0.8 + hash2(obj.seed, 5, 7) * 0.42);
    const ch = style.crownH * scale * (0.8 + hash2(obj.seed, 6, 9) * 0.42);
    const sway = Math.sin(d.time * 0.0004 + obj.seed) * 3 * d.wind * scale;
    const leanJ = (hash2(obj.seed, 7, 11) - 0.5) * 0.32;
    const trunkCol = litc(style.trunk, atm),
      branchCol = shade(trunkCol, 0.92);
    const trunkW = Math.max(2.2, 7 * scale * (0.9 + hash2(obj.seed, 12, 17) * 0.2));
    // Keep cast-shadow behaviour unchanged until the canopy-aware lighting stage.
    shadowUnder(d, cw * 0.62, cw * 0.26, 0.9);
    const { tx, ty } = drawTrunk(d, h, trunkW, trunkCol, sway * 0.35 + leanJ * h * 0.14);
    drawTreeCavity(d, tx, ty, h, trunkW);
    const sites = crownSites(obj.seed, cw, ch, style.layers);
    const point = (p: { x: number; y: number }) => ({ x: tx + p.x + sway, y: ty + p.y });
    // Identical topology in January and July. Leaves reveal these branches rather than replacing them.
    for (const site of sites) {
      const end = point(site),
        parent = point({ x: site.parentX, y: site.parentY });
      if (site.index % 3 === 0)
        taperStroke(
          ctx,
          tx,
          ty + 9 * scale,
          parent.x,
          parent.y,
          2.8 * scale,
          0.95 * scale,
          branchCol,
          0.78,
          site.x * 0.06,
        );
      taperStroke(ctx, parent.x, parent.y, end.x, end.y, 1.15 * scale, 0.38 * scale, branchCol, 0.78, site.x * 0.025);
      // Fine permanent forks reach into each leaf group, rather than appearing only in winter.
      ctx.strokeStyle = css(branchCol, 0.7);
      ctx.lineWidth = 0.58 * scale;
      ctx.beginPath();
      for (let k = 0; k < 2; k++) {
        const dx = (k === 0 ? -1 : 1) * site.rx * (0.28 + hash2(site.index, obj.seed, 1471 + k) * 0.28);
        const dy = -site.ry * (0.45 + hash2(site.index, obj.seed, 1481 + k) * 0.4);
        ctx.moveTo(end.x, end.y);
        ctx.quadraticCurveTo(end.x + dx * 0.7, end.y + dy * 0.3, end.x + dx, end.y + dy);
      }
      ctx.stroke();
      if (style.droop) {
        ctx.strokeStyle = css(branchCol, 0.42);
        ctx.lineWidth = 0.65 * scale;
        ctx.beginPath();
        ctx.moveTo(end.x, end.y);
        ctx.quadraticCurveTo(
          end.x - 2,
          end.y + style.droop * scale * 0.4,
          end.x - 4,
          end.y + style.droop * scale * 0.75,
        );
        ctx.stroke();
      }
    }
    const fresh = style.blossom ? mix(style.crownSummer, { r: 196, g: 210, b: 137 }, 0.35) : style.crownSpring;
    const green = mix(fresh, style.crownSummer, state.maturity);
    for (const site of sites) {
      const p = point(site),
        leaf = leafGroup(state, obj.seed, site.index);
      const bud = state.bud * (1 - leaf.growth * 0.9);
      if (bud > 0.005) {
        ctx.fillStyle = css(litc(mix(style.trunk, fresh, 0.45), atm), bud * 0.92);
        ctx.beginPath();
        ctx.ellipse(
          p.x,
          p.y,
          1.1 * scale + bud * 1.2 * scale,
          1.5 * scale + bud * 1.7 * scale,
          site.x * 0.02,
          0,
          Math.PI * 2,
        );
        ctx.fill();
      }
      const opacity = leaf.growth * leaf.retained;
      if (opacity > 0.003) {
        const tint = hash2(site.index, obj.seed, 1451);
        const base = mix(
          mix(green, style.crownAutumn, leaf.color),
          { r: 163, g: 112, b: 70 },
          leaf.color * state.leafFall * 0.12,
        );
        const main = litc(shade(base, 0.92 + tint * 0.14), atm),
          deep = litc(shade(base, 0.74), atm);
        const rx = site.rx * leaf.size,
          ry = site.ry * leaf.size;
        washBlob(ctx, p.x, p.y + ry * 0.25, rx, ry, deep, obj.seed + site.index * 17, {
          layers: 1,
          alpha: 0.27 * opacity,
          edge: 0.055 * opacity,
          wobble: 0.3,
        });
        washBlob(ctx, p.x, p.y, rx * 0.96, ry * 0.94, main, obj.seed + site.index * 17 + 3, {
          layers: 2,
          alpha: 0.4 * opacity,
          edge: 0.09 * opacity,
          wobble: 0.32,
        });
        const light = litc(mix(base, WHITE, 0.28), atm, 0.03);
        washBlob(
          ctx,
          p.x - atm.sunDir.x * rx * 0.25,
          p.y - ry * 0.35,
          rx * 0.52,
          ry * 0.33,
          light,
          obj.seed + site.index * 17 + 7,
          { layers: 1, alpha: 0.26 * opacity, edge: 0, wobble: 0.3 },
        );
        if (style.droop) {
          ctx.strokeStyle = css(main, 0.62 * opacity);
          ctx.lineWidth = 1.8 * scale * leaf.size;
          const len = style.droop * scale * leaf.size * (0.55 + tint * 0.5),
            wob = Math.sin(d.time * 0.0007 + site.index) * 4 * d.wind;
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.quadraticCurveTo(p.x + wob, p.y + len * 0.6, p.x + wob - 3, p.y + len);
          ctx.stroke();
        }
      }
      // Sakura's pink crown is part of its canopy: blossom and leaf emergence overlap, not a season switch.
      if (style.blossom && state.bloom > 0.003) {
        const bloom = state.bloom * (0.85 + hash2(site.index, obj.seed, 1459) * 0.15);
        const petal = litc(style.blossom, atm, 0.04);
        washBlob(
          ctx,
          p.x,
          p.y,
          site.rx * lerp(0.34, 0.86, flowerOpenness(atm)) * Math.sqrt(bloom),
          site.ry * lerp(0.2, 0.78, flowerOpenness(atm)) * Math.sqrt(bloom),
          petal,
          obj.seed + site.index * 31,
          { layers: 2, alpha: 0.46 * bloom, edge: 0.1 * bloom, wobble: 0.34 },
        );
        ctx.fillStyle = css(petal, 0.88 * bloom);
        flowerHeadPath(
          ctx,
          p.x,
          p.y,
          4 * scale * Math.sqrt(bloom),
          3 * scale * Math.sqrt(bloom),
          obj.seed + site.index,
          flowerOpenness(atm),
        );
        ctx.fill();
      }
      if (style.fruit && site.index % 2 === 0) {
        // Fruit also stays attached to its twig when the surrounding leaves fall.
        const q = state.phase < 0.3 ? state.phase + 1 : state.phase;
        const autumn = smoothstep(0.6, 0.73, q),
          remain = 1 - smoothstep(site.index % 6 === 0 ? 1.02 : 0.88, site.index % 6 === 0 ? 1.14 : 1.01, q);
        const ripe = autumn * remain;
        if (ripe > 0.003) {
          ctx.fillStyle = css(litc(style.fruit, atm, 0.06), 0.92 * ripe);
          ctx.beginPath();
          ctx.ellipse(p.x, p.y + 5 * scale, 3.6 * scale, 3.2 * scale, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = css(litc({ r: 96, g: 112, b: 72 }, atm), 0.8 * ripe);
          ctx.beginPath();
          ctx.ellipse(p.x, p.y + 2.2 * scale, 1.7 * scale, 0.8 * scale, 0, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
    // Deliberately retain the existing winter-only snow rule; gradual snow belongs to stage two.
    if (atm.season === 'winter' && !style.fruit) {
      const snow = litc({ r: 247, g: 249, b: 252 }, atm);
      for (const site of sites.filter((s) => s.index % 3 === 0)) {
        const p = point(site);
        washBlob(ctx, p.x, p.y - 2, site.rx * 0.75, site.ry * 0.22, snow, obj.seed + site.index, {
          layers: 2,
          alpha: 0.6,
          edge: 0.08,
          wobble: 0.3,
        });
      }
    }
  };
}

export const drawSakura = makeTree({
  trunk: { r: 122, g: 94, b: 82 },
  crownSpring: { r: 244, g: 196, b: 210 },
  crownSummer: { r: 138, g: 172, b: 116 },
  crownAutumn: { r: 206, g: 150, b: 104 },
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
  height: 94,
  crownW: 104,
  crownH: 58,
  layers: 4,
  droop: 46,
});

export const drawPine: Drawer = (d) => {
  const { ctx, atm, g, obj } = d;
  const scale = lerp(0.2, 1, Math.pow(g, 0.7));
  // Ели были низенькие — поднимаем с 106 до 148, плюс джиттер по сиду 0.88..1.15
  const heightJ = 0.88 + hash2(obj.seed, 3, 7) * 0.27;
  const h = 148 * scale * heightJ;
  const sway = Math.sin(d.time * 0.0003 + obj.seed) * 2.2 * d.wind * scale;
  shadowUnder(d, 44 * scale, 19 * scale, 0.9);

  const trunkCol = litc({ r: 108, g: 82, b: 66 }, atm);
  const leanJ = (hash2(obj.seed, 7, 11) - 0.5) * 0.22;
  const { tx, ty } = drawTrunk(
    d,
    h,
    Math.max(2.6, 9.2 * scale * (0.9 + heightJ * 0.12)),
    trunkCol,
    sway * 0.3 + leanJ * h * 0.09,
  );

  const needle = mix(
    { r: 84, g: 130, b: 92 },
    { r: 96, g: 124, b: 116 },
    plantYear(obj.type, obj.seed, atm.time.now).winterTone,
  );
  // Лёгкий оттенок хвои по сиду
  const tintP = hash2(obj.seed, 19, 23);
  const needleTinted = mix(
    needle,
    tintP > 0.66 ? { r: 72, g: 118, b: 88 } : tintP < 0.33 ? { r: 92, g: 136, b: 100 } : needle,
    0.14,
  );
  const main = litc(needleTinted, atm);
  const deep = litc(shade(needleTinted, 0.76), atm);
  const light = litc(mix(needleTinted, { r: 200, g: 226, b: 170 }, 0.3), atm, 0.03);

  // Ярусы — 3..6, высота распределения тоже по сиду
  const tiers = 3 + Math.floor(hash2(obj.seed, 13, 17) * 4); // 3..6
  const spreadJ = 0.85 + hash2(obj.seed, 31, 7) * 0.32;
  const sizeJ = 0.88 + hash2(obj.seed, 33, 11) * 0.26;
  for (let i = 0; i < tiers; i++) {
    const t = tiers === 1 ? 0 : i / (tiers - 1);
    // Чередуем стороны, но иногда два подряд с одной — асимметрия
    const sideBase = i % 2 === 0 ? -1 : 1;
    const sideFlip = hash2(i, obj.seed, 29) > 0.78 ? -sideBase : sideBase;
    const side = sideFlip;
    const tierWob = (hash2(i, obj.seed, 41) - 0.5) * 8 * scale;
    const cx = tx + side * (18 + 16 * (1 - t) * spreadJ) * scale + sway * (1 + t * 0.6) + tierWob;
    const cy = ty + t * h * (0.58 + hash2(obj.seed, 43, 13) * 0.12);
    const rx = (46 - t * 7) * scale * sizeJ * (0.9 + hash2(i, obj.seed, 47) * 0.22);
    const ry = (18 + t * 5) * scale * (0.9 + hash2(i, obj.seed, 53) * 0.2);
    taperStroke(
      ctx,
      tx,
      cy + 4,
      cx,
      cy + 2,
      (3.2 + hash2(i, obj.seed, 59) * 0.8) * scale,
      1.4 * scale,
      shade(trunkCol, 0.92),
      0.8,
    );
    washBlob(ctx, cx, cy + ry * 0.35, rx, ry, deep, obj.seed + i * 5, {
      layers: 2,
      alpha: 0.42,
      edge: 0.14,
      wobble: 0.3 + hash2(i, obj.seed, 61) * 0.12,
    });
    washBlob(ctx, cx, cy, rx * 0.95, ry * 0.9, main, obj.seed + i * 9, {
      layers: 3,
      alpha: 0.4,
      edge: 0.16,
      wobble: 0.28 + hash2(i, obj.seed, 67) * 0.1,
    });
    washBlob(ctx, cx - atm.sunDir.x * rx * 0.2, cy - ry * 0.4, rx * 0.5, ry * 0.4, light, obj.seed + i * 3, {
      layers: 1,
      alpha: 0.28,
      edge: 0,
    });
    // Доп. мелкая клякса для лохматости
    if (hash2(i, obj.seed, 71) > 0.55) {
      washBlob(
        ctx,
        cx + (hash2(i, obj.seed, 73) - 0.5) * rx * 0.6,
        cy + ry * 0.15,
        rx * 0.32,
        ry * 0.55,
        main,
        obj.seed + i * 17,
        {
          layers: 2,
          alpha: 0.32,
          edge: 0.18,
          wobble: 0.35,
        },
      );
    }
    if (atm.season === 'winter') {
      washBlob(ctx, cx, cy - ry * 0.5, rx * 0.7, ry * 0.3, litc({ r: 246, g: 247, b: 250 }, atm), obj.seed + i, {
        layers: 2,
        alpha: 0.45,
        edge: 0.08,
      });
    }
  }
  // Верхушка — тоже с вариацией высоты и размера
  const topJ = 0.85 + hash2(obj.seed, 79, 3) * 0.3;
  washBlob(ctx, tx + sway, ty - 8 * scale * topJ, 24 * scale * topJ, 13 * scale * topJ, main, obj.seed + 77, {
    layers: 3,
    alpha: 0.42,
    edge: 0.16,
  });
  // Иногда второй маленький ярус на самой верхушке — молодая макушка
  if (hash2(obj.seed, 83, 7) > 0.62) {
    washBlob(
      ctx,
      tx + sway + (hash2(obj.seed, 89, 11) - 0.5) * 8,
      ty - 18 * scale * topJ,
      14 * scale,
      7 * scale,
      main,
      obj.seed + 97,
      {
        layers: 2,
        alpha: 0.36,
        edge: 0.14,
      },
    );
  }
};

export const drawBamboo: Drawer = (d) => {
  const { ctx, atm, g, obj } = d;
  const scale = lerp(0.3, 1, Math.pow(g, 0.6));
  const stalks = 2 + Math.floor(hash2(obj.seed, 21, 29) * 3); // 2..4 стебля
  shadowUnder(d, 16 * scale, 7 * scale, 0.6);
  const stalkCol = litc(
    mix({ r: 158, g: 186, b: 116 }, { r: 168, g: 176, b: 150 }, plantYear(obj.type, obj.seed, atm.time.now).winterTone),
    atm,
  );
  const leafCol = litc(
    mix({ r: 122, g: 164, b: 100 }, { r: 150, g: 164, b: 148 }, plantYear(obj.type, obj.seed, atm.time.now).winterTone),
    atm,
  );
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
  const base = anchorColor(atm.time.now, [
    { r: 168, g: 178, b: 172 },
    { r: 116, g: 160, b: 100 },
    { r: 116, g: 160, b: 100 },
    { r: 176, g: 156, b: 104 },
  ]);
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
      flowerHeadPath(ctx, px, py, 3.2 * scale + r1 * 2, 2.4 * scale + r2 * 1.6, obj.seed + i, flowerOpenness(atm));
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

  const state = plantYear(obj.type, obj.seed, atm.time.now);
  const green = mix({ r: 145, g: 177, b: 115 }, { r: 104, g: 146, b: 92 }, state.maturity);
  const leafColor = (index: number) => mix(green, { r: 186, g: 168, b: 96 }, leafGroup(state, obj.seed, index).color);
  const puffs = 6;
  for (let i = 0; i < puffs; i++) {
    const r = hash2(i, obj.seed, 13),
      px = d.x + (i / (puffs - 1) - 0.5) * w * 1.7,
      py = d.y - h + (2 + r * 5) * scale;
    const leaf = leafGroup(state, obj.seed, i);
    // Woody vine and attachment twigs stay in place under the leaves all year.
    taperStroke(ctx, d.x - w * 0.8, d.y - h + 2, px, py, 1.2 * scale, 0.6 * scale, post, 0.65, 3 * scale);
    if (state.bud > 0.003) {
      ctx.fillStyle = css(litc({ r: 135, g: 158, b: 92 }, atm), state.bud);
      ctx.beginPath();
      ctx.ellipse(px, py, 1.6 * scale, 2 * scale, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    if (leaf.growth * leaf.retained > 0.003)
      washBlob(
        ctx,
        px,
        py,
        w * (0.26 + r * 0.16) * leaf.size,
        (9 + r * 5) * scale * leaf.size,
        litc(leafColor(i), atm),
        obj.seed + i * 5,
        { layers: 2, alpha: 0.46 * leaf.growth * leaf.retained, edge: 0.14 * leaf.growth * leaf.retained, wobble: 0.3 },
      );
  }
  const bunches = Math.round(6 + scale * 4),
    cluster = litc({ r: 158, g: 130, b: 202 }, atm, 0.04);
  for (let i = 0; i < bunches; i++) {
    const r = hash2(i, obj.seed, 19),
      px = d.x + (i / (bunches - 1) - 0.5) * w * 1.6 + (r - 0.5) * 5;
    const len = 13 * scale * (0.65 + r * 0.7),
      sway = Math.sin(d.time * 0.0011 + i * 0.9 + obj.seed) * 2.4 * d.wind;
    ctx.strokeStyle = css(litc({ r: 116, g: 98, b: 84 }, atm), 0.7);
    ctx.lineWidth = 1.1 * scale;
    ctx.beginPath();
    ctx.moveTo(px, d.y - h + 4 * scale);
    ctx.quadraticCurveTo(px + sway, d.y - h + len * 0.6, px + sway * 1.6, d.y - h + len);
    ctx.stroke();
    const leaf = leafGroup(state, obj.seed, i + 6);
    if (leaf.growth * leaf.retained > 0.003) {
      ctx.fillStyle = css(litc(leafColor(i + 6), atm), 0.5 * leaf.growth * leaf.retained);
      blobPath(
        ctx,
        px + sway,
        d.y - h + 8 * scale + len * 0.4,
        5 * scale * leaf.size,
        len * 0.42 * leaf.size,
        obj.seed + i,
        0.3,
        7,
      );
      ctx.fill();
    }
    if (state.bloom > 0.003) {
      const flowerLen = 40 * scale * (0.65 + r * 0.7) * Math.sqrt(state.bloom);
      // Fixed flower sites, expanding down the same pendant stem; no changing random sequence.
      const steps = 12;
      for (let k = 0; k < steps; k++) {
        const t = k / steps,
          rr = (4 - t * 2.5) * scale * Math.sqrt(state.bloom);
        ctx.fillStyle = css(mix(cluster, WHITE, t * 0.35), (0.72 - t * 0.18) * state.bloom);
        flowerHeadPath(
          ctx,
          px + sway * t * 1.4,
          d.y - h + 6 * scale + t * flowerLen,
          rr,
          rr * 0.82,
          obj.seed + i * 7 + k,
          flowerOpenness(atm),
        );
        ctx.fill();
      }
    }
  }
  ctx.lineCap = 'butt';
};

/** Хурма: осенью на голых ветках висят оранжевые фонарики. */

export const drawPersimmon = makeTree({
  trunk: { r: 112, g: 92, b: 76 },
  crownSpring: { r: 142, g: 174, b: 105 },
  crownSummer: { r: 96, g: 138, b: 88 },
  crownAutumn: { r: 208, g: 138, b: 72 },
  height: 74,
  crownW: 58,
  crownH: 46,
  layers: 3,
  fruit: { r: 234, g: 122, b: 44 },
});

/** Камелия: плотный тёмный куст, цветёт зимой и ранней весной. */

export const drawCamellia: Drawer = (d) => {
  const { ctx, atm, g, obj } = d;
  const scale = lerp(0.32, 1, Math.pow(g, 0.7));
  const rx = 28 * scale;
  const ry = 22 * scale;
  shadowUnder(d, rx * 0.9, ry * 0.42, 0.85);

  // Листва тёмная и глянцевая круглый год — этим камелия и ценна
  const base = mix(
    { r: 62, g: 104, b: 74 },
    { r: 67, g: 98, b: 80 },
    plantYear(obj.type, obj.seed, atm.time.now).winterTone,
  );
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
      const open = flowerOpenness(atm);
      // пять лепестков вокруг жёлтой сердцевины
      for (let k = 0; k < 5; k++) {
        const a = (k / 5) * Math.PI * 2 + r1 * 2;
        ctx.fillStyle = css(petal, 0.92);
        ctx.beginPath();
        ctx.ellipse(
          px + Math.cos(a) * rr * 0.5 * open,
          py + Math.sin(a) * rr * 0.4 * open - (1 - open) * rr * 0.2,
          rr * 0.52,
          rr * lerp(0.15, 0.42, open),
          lerp(-Math.PI / 2, a, open),
          0,
          Math.PI * 2,
        );
        ctx.fill();
      }
      ctx.fillStyle = css(litc({ r: 248, g: 218, b: 118 }, atm, 0.08), 0.96 * Math.max(0, (open - 0.4) / 0.6));
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
