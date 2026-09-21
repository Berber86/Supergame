/** Four distinct orchard silhouettes: crooked ume, horizontal nashi, vase-shaped peach and dense citrus. */
import { ORCHARD_SHAPES, fruitYear, orchardFlowerTint, type FruitTree } from '../../world/orchard';
import { plantYear, leafGroup } from '../../world/phenology';
import { winterYear } from '../../world/annualEnvironment';
import { crownWidth } from '../../world/canopy';
import { clamp01, hash2, lerp } from '../../core/rng';
import { css, mix, shade, type RGB } from '../../world/palette';
import { washBlob, taperStroke } from '../paint';
import { crownSites } from '../crownGeometry';
import { flowerHeadPath, flowerOpenness } from '../flowerCycle';
import { paintOrchardFruit } from '../orchardFruit';
import { litc, shadowUnder, type Drawer } from './common';
const GREEN: Record<FruitTree, RGB> = {
  ume: { r: 116, g: 155, b: 95 },
  nashi: { r: 109, g: 150, b: 85 },
  peach: { r: 129, g: 163, b: 98 },
  yuzu: { r: 53, g: 106, b: 65 },
};
const AUTUMN: Record<FruitTree, RGB> = {
  ume: { r: 179, g: 149, b: 72 },
  nashi: { r: 203, g: 143, b: 64 },
  peach: { r: 208, g: 162, b: 73 },
  yuzu: GREEN.yuzu,
};
export function orchardGeometry(type: FruitTree, seed: number, g = 1) {
  const shape = ORCHARD_SHAPES[type],
    scale = lerp(0.18, 1, Math.pow(g, 0.72));
  const mature = clamp01(g) >= 1;
  const width = crownWidth(shape.crownW, seed) * scale;
  const groups = shape.layers + 2;
  const all = crownSites(seed, width, shape.crownH * scale, shape.layers);
  const sites: typeof all = [];
  for (let i = 0; i < groups; i++) {
    // Саженец: крона растёт сверху вниз — сперва пучок на макушке,
    // нижние ветви присоединяются позже. Взрослому дереву видно всё сразу.
    const topness = i / (groups - 1);
    const age = mature ? 1 : clamp01((g - (0.08 + 0.5 * topness)) / 0.3);
    if (age <= 0) continue;
    const reachK = mature ? 1 : 0.35 + 0.65 * age,
      leafK = mature ? 1 : 0.3 + 0.7 * age;
    for (let k = 0; k < 3; k++) {
      const s = all[i * 3 + k];
      const x = s.x * (type === 'nashi' ? 1.12 : 1) * reachK,
        y = s.y * (type === 'nashi' ? 0.76 : 1) * reachK;
      sites.push({
        ...s,
        index: i * 3 + k,
        x,
        y,
        parentX: (type === 'peach' ? Math.sign(x) * width * 0.24 : s.parentX) * reachK,
        parentY: (type === 'peach' ? -18 * scale : s.parentY) * reachK,
        rx: s.rx * leafK,
        ry: s.ry * leafK,
      });
    }
  }
  // Ветви и листва строятся только по живым площадкам; нумеруем их заново.
  sites.forEach((s, j) => {
    s.index = j;
  });
  return { scale, width, height: shape.height * scale, sites };
}
export const drawOrchard: Drawer = (d) => {
  const { ctx, atm, obj } = d,
    type = obj.type as FruitTree,
    seed = obj.seed;
  const { scale, width, height, sites } = orchardGeometry(type, seed, d.g),
    state = plantYear(type, seed, atm.time.now);
  const sway = Math.sin(d.time * 0.0004 + seed) * 3 * d.wind * scale;
  const bark = litc(type === 'ume' ? { r: 103, g: 80, b: 72 } : { r: 123, g: 104, b: 77 }, atm);
  const bloomColor = orchardFlowerTint(type, seed);
  const topX = type === 'ume' ? 9 * scale : type === 'peach' ? 0 : -3 * scale;
  shadowUnder(d, width * 0.69, width * 0.26, 0.9);
  ctx.save();
  ctx.translate(d.x, d.y);
  if (type === 'ume') {
    taperStroke(ctx, 0, 0, -8 * scale, -height * 0.38, 8 * scale, 5 * scale, bark, 0.98, 10 * scale);
    taperStroke(ctx, -8 * scale, -height * 0.38, topX, -height, 5 * scale, 2.8 * scale, bark, 0.97, -10 * scale);
    ctx.strokeStyle = css(shade(bark, 0.67), 0.65);
    ctx.lineWidth = 0.8 * scale;
    ctx.beginPath();
    ctx.moveTo(-1, 0);
    ctx.bezierCurveTo(-11, -height * 0.4, 13, -height * 0.5, 8, -height * 0.9);
    ctx.stroke();
    for (let k = 0; k < 3; k++) {
      ctx.fillStyle = css(shade(bark, 0.7), 0.65);
      ctx.beginPath();
      ctx.ellipse(-4 * scale, -height * (0.25 + k * 0.19), 2.2 * scale, 1.2 * scale, -0.7, 0, Math.PI * 2);
      ctx.fill();
    }
  } else {
    taperStroke(ctx, 0, 0, topX, -height * 0.76, 7 * scale, 3 * scale, bark, 0.96, 3 * scale);
    if (type === 'peach')
      for (const side of [-1, 1])
        taperStroke(ctx, 0, -height * 0.38, side * width * 0.3, -height, 4 * scale, 1.4 * scale, bark, 0.92, side * 4);
    else taperStroke(ctx, topX, -height * 0.7, topX, -height, 3.2 * scale, 1.3 * scale, bark, 0.92, 0);
  }
  const point = (s: { x: number; y: number }) => ({ x: topX + s.x + sway, y: -height + s.y });
  for (const s of sites) {
    const p = point(s),
      parent = point({ x: s.parentX, y: s.parentY });
    if (s.index % 3 === 0)
      taperStroke(ctx, topX, -height * 0.8, parent.x, parent.y, 2.6 * scale, 1.1 * scale, bark, 0.88, s.x * 0.14);
    taperStroke(
      ctx,
      parent.x,
      parent.y,
      p.x,
      p.y,
      1.4 * scale,
      0.5 * scale,
      bark,
      0.88,
      (type === 'ume' ? -1 : 1) * s.x * 0.07,
    );
    for (let k = 0; k < 2; k++) {
      ctx.strokeStyle = css(bark, 0.72);
      ctx.lineWidth = 0.6 * scale;
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.quadraticCurveTo(p.x + (k ? 1 : -1) * 8, p.y - 3, p.x + (k ? 1 : -1) * 13 * scale, p.y - 9 * scale);
      ctx.stroke();
    }
  }
  for (const s of sites) {
    const p = point(s),
      leaf = leafGroup(state, seed, s.index),
      opacity = leaf.growth * leaf.retained;
    const color = mix(mix({ r: 173, g: 190, b: 112 }, GREEN[type], state.maturity), AUTUMN[type], leaf.color);
    if (opacity > 0.003) {
      const rx = s.rx * leaf.size * (type === 'peach' ? 0.62 : type === 'yuzu' ? 0.82 : 0.88),
        ry = s.ry * leaf.size * (type === 'peach' ? 0.58 : 0.91);
      washBlob(ctx, p.x, p.y, rx, ry, litc(shade(color, 0.75), atm), seed + s.index * 31, {
        layers: 2,
        alpha: (type === 'yuzu' ? 0.46 : 0.24) * opacity,
        edge: 0.09 * opacity,
        wobble: 0.3,
      });
      washBlob(ctx, p.x - rx * 0.17, p.y - ry * 0.25, rx * 0.85, ry * 0.76, litc(color, atm), seed + s.index * 31 + 2, {
        layers: 2,
        alpha: 0.36 * opacity,
        edge: 0.045 * opacity,
        wobble: 0.24,
      });
      // Persistent actual leaf blades make the peach feathery and the yuzu leathery/glossy.
      const count = type === 'peach' ? 9 : type === 'yuzu' ? 7 : 4;
      for (let k = 0; k < count; k++) {
        const a = hash2(k, seed + s.index, 1907) * Math.PI * 2,
          x = p.x + Math.cos(a) * rx * 0.65,
          y = p.y + Math.sin(a) * ry * 0.65;
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(type === 'peach' ? a * 0.65 : a);
        ctx.fillStyle = css(litc(shade(color, 0.83 + hash2(k, s.index + seed, 1913) * 0.3), atm), 0.8 * opacity);
        const len = (type === 'peach' ? 9.8 : type === 'yuzu' ? 6.7 : 5) * scale * leaf.size,
          w = (type === 'peach' ? 1.7 : 2.8) * scale * leaf.size;
        ctx.beginPath();
        ctx.moveTo(-len, 0);
        ctx.quadraticCurveTo(0, -w * 2, len, 0);
        ctx.quadraticCurveTo(0, w * 2, -len, 0);
        ctx.fill();
        ctx.strokeStyle = css(litc(mix(color, { r: 220, g: 224, b: 146 }, 0.5), atm), 0.43 * opacity);
        ctx.lineWidth = 0.48 * scale;
        ctx.beginPath();
        ctx.moveTo(-len * 0.7, 0);
        ctx.lineTo(len * 0.75, 0);
        ctx.stroke();
        if (type === 'yuzu') {
          ctx.fillStyle = css(litc(color, atm), opacity);
          ctx.beginPath();
          ctx.ellipse(-len - 1, 0, 2 * scale, 1.2 * scale, 0, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }
    }
    if (state.bud > 0.02 && d.g >= 0.6) {
      ctx.fillStyle = css(litc(mix(bloomColor, bark, 0.3), atm), state.bud);
      ctx.beginPath();
      ctx.ellipse(p.x, p.y, 1.5 * scale, 2.2 * scale, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    if (state.bloom > 0.003 && d.g >= 0.6) {
      const open = flowerOpenness(atm),
        r = (type === 'yuzu' ? 2.7 : 3.7) * scale * Math.sqrt(state.bloom);
      for (let k = 0; k < (type === 'yuzu' ? 2 : 4); k++) {
        const x = p.x + (hash2(k, seed + s.index, 1919) - 0.5) * s.rx * 0.88,
          y = p.y + (hash2(k, seed + s.index, 1921) - 0.5) * s.ry * 0.8;
        ctx.save();
        ctx.globalAlpha *= state.bloom;
        ctx.fillStyle = css(litc(bloomColor, atm, 0.03));
        if (open > 0.97) {
          for (let petal = 0; petal < 5; petal++) {
            const a = (petal * Math.PI * 2) / 5;
            ctx.beginPath();
            ctx.ellipse(x + Math.cos(a) * r * 0.6, y + Math.sin(a) * r * 0.6, r * 0.6, r * 0.42, a, 0, Math.PI * 2);
            ctx.fill();
          }
          ctx.fillStyle = css(litc({ r: 205, g: 157, b: 62 }, atm));
          ctx.beginPath();
          ctx.arc(x, y, r * 0.26, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = css(litc({ r: 221, g: 183, b: 98 }, atm), 0.8);
          ctx.lineWidth = 0.35;
          for (let j = 0; j < 5; j++) {
            const a = (j * Math.PI * 2) / 5;
            ctx.beginPath();
            ctx.moveTo(x, y);
            ctx.lineTo(x + Math.cos(a) * r * 0.6, y + Math.sin(a) * r * 0.6);
            ctx.stroke();
          }
        } else {
          flowerHeadPath(ctx, x, y, r, r * 0.85, seed + k, open);
          ctx.fill();
        }
        ctx.restore();
      }
    }
  }
  // Snow sits above leaves/wood; fruit is painted afterwards on its hanging stems, not erased by a white blob.
  const snow = winterYear(atm.time.now).snow;
  if (snow > 0.001)
    for (const s of sites.filter((p) => p.index % 3 === 0)) {
      const p = point(s);
      washBlob(
        ctx,
        p.x,
        p.y - (type === 'yuzu' ? s.ry * 0.55 : 2),
        s.rx * (type === 'yuzu' ? 0.62 : 0.32) * Math.sqrt(snow),
        s.ry * (type === 'yuzu' ? 0.19 : 0.12) * Math.sqrt(snow),
        litc({ r: 246, g: 247, b: 241 }, atm),
        seed + s.index,
        { layers: 2, alpha: snow * 0.73, edge: 0.045, wobble: 0.46 },
      );
    }
  // Урожай набирает вес лишь у почти взрослого дерева; молодые площадки могут ещё отсутствовать.
  const fruitG = clamp01((d.g - 0.85) / 0.15);
  for (let i = 0; i < 9; i++) {
    const s = sites[i * 2];
    if (!s || fruitG <= 0) continue;
    const p = point(s),
      fruit = fruitYear(type, seed, atm.time.now, i);
    if (fruit.retained < 0.003) continue;
    const r =
      (type === 'ume' ? 3.5 : type === 'nashi' ? 5.3 : type === 'peach' ? 5.5 : 5) *
      scale *
      (0.22 + 0.78 * Math.sqrt(fruit.size)) *
      fruitG;
    const y = p.y + (type === 'nashi' ? 8 : 7) * scale;
    ctx.save();
    ctx.globalAlpha *= Math.min(1, fruit.retained * 1.5);
    ctx.strokeStyle = css(bark, 0.9);
    ctx.lineWidth = 0.65 * scale;
    ctx.beginPath();
    ctx.moveTo(p.x, p.y - 1);
    ctx.lineTo(p.x, y - r * 0.8);
    ctx.stroke();
    paintOrchardFruit(ctx, type, p.x, y, r, fruit.ripe, 0, atm, seed + i);
    if (type === 'yuzu' && snow > 0.35) {
      ctx.fillStyle = css(litc({ r: 251, g: 249, b: 225 }, atm), snow * 0.6);
      ctx.beginPath();
      ctx.ellipse(p.x - r * 0.2, y - r * 0.7, r * 0.5, r * 0.13, -0.1, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
  ctx.restore();
};
