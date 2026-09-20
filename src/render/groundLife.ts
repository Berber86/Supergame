import { rainField, rainShade } from './afterRain';
import { flowerYear, litterYear, winterYear } from '../world/annualEnvironment';
import { crownCacheKey, crownCacheTime } from '../world/phenology';
import { TREE_CROWNS, crownWidth } from '../world/canopy';
import { scaleJitterOf } from './sprites/common';
/** Sparse, persistent-looking ground ecology. Decoration only: never places objects or changes saves. */
import { isoToScreen, tileDiamond, TILE_W } from '../core/iso';
import { fbm, hash2, clamp01, smoothstep } from '../core/rng';
import { ITEM_BY_ID, SMALL_HOUSE_IDS } from '../world/catalog';
import type { World } from '../world/world';
import type { Tile } from '../world/types';
import { css, mix, shade, type Atmosphere, type RGB } from '../world/palette';
import { blobPath, type Ctx } from './paint';
import { flowerHeadPath, flowerOpenness } from './flowerCycle';
import { waterSurfaces, waterSurfacePath } from './waterSurface';

export type GroundLifeKind = 'grass' | 'soil' | 'moss' | 'leaves' | 'needles' | 'roots' | 'flowers' | 'mushrooms';
export interface GroundPatch {
  x: number;
  y: number;
  level: number;
  seed: number;
  kind: GroundLifeKind;
  shade: number;
  damp: number;
  treeType?: string;
  treeSeed?: number;
  /** Stable crown-footprint density; not a seasonal or accumulating particle count. */
  litterDensity?: number;
}
interface HabitatObject {
  x: number;
  y: number;
  level: number;
  type: string;
  seed: number;
  radius: number;
  litterRadius: number;
  tree: boolean;
  plantedFlower: boolean;
}
interface GroundField {
  signature: string;
  patches: GroundPatch[];
  paint?: { key: string; images: Map<GroundPatch, { canvas: HTMLCanvasElement; x: number; y: number }> };
}
const fields = new WeakMap<World, GroundField>();
export function groundEligible(t: Tile | undefined | null): boolean {
  return !!t && !t.water && !t.indoor && !t.veranda && ['moss', 'grass', 'soil'].includes(t.ground);
}
/** Fingerprint includes edits/undo/import, not clock, lamps or camera. One bounded entry per live world. */
export function groundLifeField(world: World): GroundField {
  const relevant = world.objects.filter((o) => {
    const item = ITEM_BY_ID.get(o.type);
    return item?.kind === 'tree' || item?.kind === 'shrub' || item?.kind === 'flower' || SMALL_HOUSE_IDS.has(o.type);
  });
  const signature =
    world.tiles.map((t) => `${t.ground}:${t.level}:${+t.water}${+t.indoor}${+t.veranda}`).join('|') +
    ';' +
    relevant.map((o) => `${o.type}:${o.tx}:${o.ty}:${o.rot}:${o.seed}`).join('|');
  const old = fields.get(world);
  if (old?.signature === signature) return old;
  const habitats: HabitatObject[] = relevant.map((o) => {
    const item = ITEM_BY_ID.get(o.type)!,
      x = o.tx + item.w / 2,
      y = o.ty + item.h / 2;
    return {
      x,
      y,
      level: world.at(Math.floor(x), Math.floor(y))?.level ?? 0,
      type: o.type,
      seed: o.seed,
      litterRadius: TREE_CROWNS[o.type]
        ? 0.28 + (crownWidth(TREE_CROWNS[o.type].crownW, o.seed) * scaleJitterOf(o.seed)) / (TILE_W * 0.7)
        : 1.35,
      tree: item.kind === 'tree',
      plantedFlower: item.kind === 'flower',
      radius:
        item.kind === 'tree'
          ? o.type === 'willow'
            ? 1.85
            : o.type === 'bamboo'
              ? 1.05
              : 1.5
          : item.kind === 'shrub'
            ? 0.8
            : Math.max(item.w, item.h) * 0.65,
    };
  });
  const field: GroundField = { signature, patches: [] };
  const add = (p: GroundPatch) => {
    field.patches.push(p);
  };
  for (let y = 0; y < world.size; y++)
    for (let x = 0; x < world.size; x++) {
      const t = world.at(x, y)!;
      if (!groundEligible(t)) continue;
      const px = x + 0.25 + hash2(x, y, 911) * 0.5,
        py = y + 0.25 + hash2(x, y, 919) * 0.5;
      let cover = 0,
        nearest: HabitatObject | undefined,
        nearestD = Infinity,
        flowerDistance = Infinity;
      for (const h of habitats) {
        if (Math.abs(h.level - t.level) > 1) continue;
        const dist = Math.hypot(px - h.x, py - h.y);
        if (h.plantedFlower) {
          flowerDistance = Math.min(flowerDistance, dist);
          continue;
        }
        cover = Math.max(cover, clamp01(1 - dist / h.radius));
        if (h.tree && dist < nearestD) {
          nearest = h;
          nearestD = dist;
        }
      }
      // Roof eaves give persistent daytime shade too; artificial illumination is irrelevant.
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          const n = world.at(x + dx, y + dy);
          if (n?.indoor || n?.veranda) cover = Math.max(cover, 0.62 * (1 - Math.hypot(dx, dy) / 2));
        }
      // Less clutter around intentional plantings; lamps never enter the habitat calculation.
      if (flowerDistance < 0.72) continue;
      let wet = 0;
      for (let dy = -2; dy <= 2; dy++)
        for (let dx = -2; dx <= 2; dx++) {
          const n = world.at(x + dx, y + dy);
          if (n?.water && Math.abs(n.level - t.level) < 0.6) wet = Math.max(wet, 1 - Math.hypot(dx, dy) / 3.2);
        }
      const damp = clamp01((t.ground === 'moss' ? 0.4 : 0.15) + wet * 0.7 + cover * 0.3);
      const seed = x * 193 + y * 977 + 61,
        roll = hash2(x, y, 937);
      const base = {
        x: px,
        y: py,
        level: t.level,
        seed,
        shade: cover,
        damp,
        treeType: nearest?.type,
        treeSeed: nearest?.seed,
        litterDensity: nearest ? 0.35 + 0.65 * (1 - smoothstep(0.15, 1, nearestD / nearest.litterRadius)) : 0,
      };
      // A fallen broad crown forms a connected skirt, not a few randomly omitted confetti tiles.
      // Open ground beyond the actual parent footprint still stays sparse.
      if (nearest && nearestD < nearest.litterRadius && (TREE_CROWNS[nearest.type] || roll > 0.22)) {
        add({ ...base, kind: nearest.type === 'pine' ? 'needles' : 'leaves' });
        if (damp > 0.6 && cover > 0.28 && hash2(x, y, 941) > 0.56)
          add({ ...base, x: px + 0.12, y: py + 0.05, seed: seed + 9, kind: 'mushrooms' });
      } else if (fbm(px * 0.43, py * 0.43, 3, 853) > 0.53 && roll > 0.42) {
        const kind: GroundLifeKind =
          cover < 0.22 && t.ground !== 'soil' && roll > 0.73
            ? 'flowers'
            : damp > 0.63
              ? 'moss'
              : roll > 0.7
                ? 'soil'
                : 'grass';
        add({ ...base, kind });
      }
    }
  // Small exposed root fans begin at real trunks, never arbitrary spots across the lawn.
  for (const h of habitats) {
    if (!h.tree || h.type === 'bamboo' || !groundEligible(world.at(Math.floor(h.x), Math.floor(h.y)))) continue;
    if (habitats.some((f) => f.plantedFlower && Math.hypot(f.x - h.x, f.y - h.y) < 0.8)) continue;
    add({
      x: h.x,
      y: h.y,
      level: h.level,
      seed: h.seed,
      shade: 1,
      damp: 0.4,
      kind: 'roots',
      treeType: h.type,
      treeSeed: h.seed,
    });
  }
  if (field.patches.length > 400) {
    // Spatially distributed budget, not a scanline cutoff that leaves the garden's south bare.
    const priority = (p: GroundPatch) => hash2(p.x * 64, p.y * 64, p.seed);
    const chosen = new Set([...field.patches].sort((a, b) => priority(a) - priority(b)).slice(0, 400));
    field.patches = field.patches.filter((p) => chosen.has(p));
  }
  for (const stamp of old?.paint?.images.values() ?? []) stamp.canvas.width = stamp.canvas.height = 1;
  fields.set(world, field);
  return field;
}
/** Fine heads/leaves fade first; coarse grass lasts longer. No full-resolution overlay buffers. */
export function groundDetailAlpha(kind: GroundLifeKind, zoom: number): number {
  if (['flowers', 'mushrooms', 'leaves', 'needles'].includes(kind)) return clamp01((zoom - 0.58) / 0.24);
  if (kind === 'grass') return clamp01((zoom - 0.36) / 0.24);
  return clamp01((zoom - 0.23) / 0.2);
}
/** Leaf colours age independently from spring petals: old maple litter must not turn pink. */
export function litterColor(type: string, fresh: number): RGB {
  if (type === 'pine') return { r: 131, g: 111, b: 65 };
  const autumn =
    type === 'ginkgo'
      ? { r: 214, g: 177, b: 66 }
      : type === 'maple'
        ? { r: 180, g: 96, b: 59 }
        : { r: 171, g: 139, b: 72 };
  return mix({ r: 119, g: 111, b: 94 }, autumn, fresh);
}
/** Dense but bounded ground marks, baked into the existing small surface stamps, never particles. */
function paintLeafLitter(
  ctx: Ctx,
  p: GroundPatch,
  zoom: number,
  state: ReturnType<typeof litterYear>,
  lit: (color: RGB) => RGB,
): void {
  if (state.amount <= 0.001) return;
  const q = isoToScreen(p.x, p.y, p.level),
    dense = !!TREE_CROWNS[p.treeType ?? ''],
    density = dense ? (p.litterDensity ?? 1) : 1,
    color = lit(litterColor(p.treeType ?? 'maple', state.fresh)),
    coarse = groundDetailAlpha('soil', zoom);
  // Broad, broken watercolour bed remains readable at phone zoom, beneath the individual leaves.
  if (state.leaves > 0) {
    ctx.fillStyle = css(color, coarse * state.leaves * (dense ? 0.28 : 0.11) * density);
    // Keep the complete irregular edge inside the existing 100×56 stamp.
    blobPath(ctx, q.x, q.y, dense ? 42 : 27, dense ? 18 : 11, p.seed, 0.15, 11);
    ctx.fill();
    if (dense) {
      ctx.fillStyle = css(shade(color, 0.88), coarse * state.leaves * 0.18 * density);
      for (let k = 0; k < 3; k++) {
        const x = q.x + (hash2(k, p.seed, 1601) - 0.5) * 46,
          y = q.y + (hash2(k, p.seed, 1607) - 0.5) * 17;
        blobPath(ctx, x, y, 13 + k * 2, 5 + k, p.seed + k * 31, 0.4, 8);
        ctx.fill();
      }
    }
  }
  const fine = groundDetailAlpha('leaves', zoom);
  if (fine <= 0) return;
  const colors = Array.from({ length: 5 }, (_, i) => css(shade(color, 0.79 + i * 0.09), 0.58 + state.fresh * 0.16));
  const count = dense ? Math.round(84 * density) : 13;
  for (let i = 0; i < count && state.leaves > 0; i++) {
    const r = hash2(i, p.seed, 47),
      present = smoothstep(r * 0.72, r * 0.72 + 0.28, state.leaves);
    if (present <= 0.001) continue;
    const x = q.x + (hash2(i, p.seed, 17) - 0.5) * (dense ? 78 : 34),
      y = q.y + (hash2(i, p.seed, 23) - 0.5) * (dense ? 32 : 14);
    ctx.save();
    ctx.globalAlpha *= fine * present;
    ctx.translate(x, y);
    ctx.rotate(hash2(i, p.seed, 1613) * Math.PI * 2);
    // Weathered leaves shrivel as well as fade, before disappearing completely in late May.
    const size = (0.68 + state.fresh * 0.32) * (0.85 + hash2(i, p.seed, 1619) * 0.35);
    ctx.scale(size, size * (0.72 + state.fresh * 0.18));
    ctx.fillStyle = colors[i % colors.length];
    ctx.beginPath();
    if (p.treeType === 'maple') {
      ctx.moveTo(-3, 0);
      ctx.lineTo(-1, -1);
      ctx.lineTo(-1, -3);
      ctx.lineTo(1, -1);
      ctx.lineTo(3, -2);
      ctx.lineTo(2, 0);
      ctx.lineTo(4, 1);
      ctx.lineTo(0, 2);
    } else if (p.treeType === 'ginkgo') {
      ctx.moveTo(-2, 1);
      ctx.arc(0, 0, 3, -2.5, 0.6);
      ctx.lineTo(-2, 1);
    } else {
      const narrow = p.treeType === 'bamboo' || p.treeType === 'willow';
      ctx.ellipse(0, 0, narrow ? 4 : 3, narrow ? 0.8 : 1.4, 0, 0, Math.PI * 2);
    }
    ctx.closePath();
    ctx.fill();
    if (i % 3 === 0) {
      ctx.strokeStyle = css(shade(color, 0.65), 0.35);
      ctx.lineWidth = 0.45;
      ctx.beginPath();
      ctx.moveTo(-2, 0);
      ctx.lineTo(2, 0);
      ctx.stroke();
    }
    ctx.restore();
  }
  // Fresh blossom fall is a separate sparse layer, never recolouring the old brown leaf carpet.
  if (state.petals > 0) {
    ctx.fillStyle = css(lit({ r: 232, g: 191, b: 196 }), 0.8);
    for (let i = 0; i < 26; i++) {
      const r = hash2(i, p.seed, 1621),
        present = smoothstep(r * 0.7, r * 0.7 + 0.3, state.petals);
      if (present <= 0.001) continue;
      ctx.save();
      ctx.globalAlpha *= fine * present;
      ctx.beginPath();
      ctx.ellipse(
        q.x + (hash2(i, p.seed, 1627) - 0.5) * 70,
        q.y + (hash2(i, p.seed, 1637) - 0.5) * 29,
        2,
        1.1,
        r * 6.28,
        0,
        Math.PI * 2,
      );
      ctx.fill();
      ctx.restore();
    }
  }
}
/** Communities keep their sites; only their appearance follows the current microclimate. */
export function groundPatchClimate(p: GroundPatch, shade: number): { shade: number; damp: number } {
  return { shade, damp: clamp01(p.damp - p.shade * 0.3 + shade * 0.3) };
}
function paintPatch(ctx: Ctx, p: GroundPatch, atm: Atmosphere, zoom: number): void {
  const snow = winterYear(atm.time.now).snow;
  const exposed = 1 - smoothstep(0.12 + hash2(p.seed, 3, 1523) * 0.35, 0.74 + hash2(p.seed, 5, 1523) * 0.24, snow);
  ctx.globalAlpha *= exposed;
  if (exposed <= 0.001) return;
  const litterState = litterYear(p.treeType ?? 'maple', p.treeSeed ?? p.seed, atm.time.now);
  const flowers = flowerYear('wildflowers', p.seed, atm.time.now);
  const q = isoToScreen(p.x, p.y, p.level),
    fine = groundDetailAlpha(p.kind, zoom);
  if (p.kind === 'mushrooms') ctx.globalAlpha *= smoothstep(0.25, 0.65, p.damp);
  if (p.kind === 'moss') ctx.globalAlpha *= 0.55 + 0.45 * p.damp;
  if (p.kind === 'flowers') ctx.globalAlpha *= 1 - 0.35 * p.shade;
  const lit = (c: RGB) => shade(mix(c, atm.lightTint, atm.lightAmount), atm.exposure * (1 - p.shade * 0.06));
  const grass = lit(atm.palette.grassDeep),
    earth = lit(atm.palette.soil),
    litter = lit(litterColor(p.treeType ?? 'maple', litterState.fresh));
  if (p.kind === 'leaves') {
    paintLeafLitter(ctx, p, zoom, litterState, lit);
    return;
  }
  // Low-contrast humus under a tree reads as one organic area even when individual leaves are hidden.
  if (['needles', 'roots', 'soil', 'moss', 'grass'].includes(p.kind)) {
    const col =
      p.kind === 'moss' ? lit(atm.palette.moss) : p.kind === 'grass' ? grass : p.kind === 'needles' ? litter : earth;
    const a = groundDetailAlpha('soil', zoom) * (p.kind === 'roots' ? 0.22 : p.kind === 'soil' ? 0.21 : 0.11);
    ctx.fillStyle = css(col, a);
    blobPath(ctx, q.x, q.y, 20 + hash2(p.seed, 1, 3) * 12, 8 + hash2(p.seed, 2, 3) * 5, p.seed, 0.48, 9);
    ctx.fill();
  }
  if (fine <= 0) return;
  ctx.globalAlpha *= fine;
  if (p.kind === 'roots') {
    ctx.strokeStyle = css(lit(mix(atm.palette.soil, { r: 110, g: 91, b: 69 }, 0.5)), 0.5);
    ctx.lineCap = 'round';
    for (let i = 0; i < 4; i++) {
      const a = hash2(p.seed, i, 31) * Math.PI * 2,
        dx = Math.cos(a) * (13 + hash2(i, p.seed, 7) * 14),
        dy = Math.sin(a) * 8;
      ctx.lineWidth = 1.1 + (i % 2) * 0.6;
      ctx.beginPath();
      ctx.moveTo(q.x, q.y);
      ctx.quadraticCurveTo(q.x + dx * 0.35, q.y + dy * 0.2 - 1, q.x + dx, q.y + dy);
      ctx.stroke();
    }
    return;
  }
  const count = p.kind === 'mushrooms' ? 3 : p.kind === 'flowers' ? 5 : p.kind === 'needles' ? 10 : 7;
  for (let i = 0; i < count; i++) {
    const x = q.x + (hash2(i, p.seed, 17) - 0.5) * 34,
      y = q.y + (hash2(i, p.seed, 23) - 0.5) * 14;
    const r = hash2(i, p.seed, 47);
    if (p.kind === 'needles') {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(r * 6.28);
      ctx.fillStyle = css(litter, 0.68);
      ctx.strokeStyle = css(litter, 0.65);
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.moveTo(-3, 0);
      ctx.lineTo(3, 0);
      ctx.moveTo(-2, 1);
      ctx.lineTo(3, 0);
      ctx.stroke();
      ctx.restore();
    } else if (p.kind === 'mushrooms') {
      ctx.strokeStyle = css(lit({ r: 209, g: 195, b: 159 }), 0.9);
      ctx.lineWidth = 1.3;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x, y - 4);
      ctx.stroke();
      ctx.fillStyle = css(lit({ r: 157, g: 116, b: 78 }), 0.95);
      ctx.beginPath();
      ctx.ellipse(x, y - 4, 3, 1.6, -0.1, Math.PI, 2 * Math.PI);
      ctx.closePath();
      ctx.fill();
    } else if (p.kind === 'flowers') {
      const bloom = smoothstep(r * 0.3, 0.62 + r * 0.38, flowers.bloom);
      if (bloom <= 0.001) continue;
      ctx.save();
      ctx.globalAlpha *= bloom;
      ctx.strokeStyle = css(grass, 0.8);
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + 1, y - 5);
      ctx.stroke();
      ctx.fillStyle = css(lit(i % 3 ? { r: 228, g: 222, b: 181 } : { r: 176, g: 169, b: 191 }), 0.9);
      flowerHeadPath(
        ctx,
        x + 1,
        y - 5,
        2.2 * Math.sqrt(bloom),
        1.6 * Math.sqrt(bloom),
        p.seed + i,
        flowerOpenness(atm),
      );
      ctx.fill();
      ctx.restore();
    } else if (p.kind === 'grass' || p.kind === 'moss') {
      ctx.strokeStyle = css(grass, p.kind === 'grass' ? 0.53 : 0.23);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.quadraticCurveTo(x - 1, y - 3, x + (r - 0.5) * 5, y - (3 + r * 5));
      ctx.stroke();
    }
  }
}
export interface GroundView {
  x: number;
  y: number;
  width: number;
  height: number;
  zoom: number;
}
/** Draw after the terrain but before fish, water animation, lighting and object shadows. */
export function drawGroundLife(ctx: Ctx, world: World, atm: Atmosphere, view: GroundView): number {
  if (winterYear(atm.time.now).snow >= 0.999 || view.zoom <= 0.23) return 0;
  atm = { ...atm, time: { ...atm.time, now: crownCacheTime('__surface', 0, atm.time.now) } };
  const field = groundLifeField(world);
  // One current paint state, at most 400 tiny 100×56 stamps (~8.6 MiB worst case).
  // Local masks are rasterised only on edits/light-state/LOD changes, never once per blade per frame.
  const lod = view.zoom < 0.36 ? 0 : view.zoom < 0.64 ? 1 : 2,
    detailZoom = lod === 0 ? 0.3 : lod === 1 ? 0.55 : 1;
  const key = [
    crownCacheKey('__surface', 0, atm.time.now),
    atm.season,
    Math.round(atm.exposure * 20),
    Math.round(atm.lightAmount * 20),
    Math.round(atm.lightTint.r / 12),
    Math.round(atm.lightTint.g / 12),
    Math.round(atm.lightTint.b / 12),
    Math.round(flowerOpenness(atm) * 16),
    lod,
  ].join('|');
  if (field.paint?.key !== key) {
    for (const stamp of field.paint?.images.values() ?? []) {
      stamp.canvas.width = 1;
      stamp.canvas.height = 1;
    }
    field.paint = { key, images: new Map() };
  }
  const visible = field.patches.filter((p) => {
    if ((p.kind === 'flowers' || p.kind === 'mushrooms') && groundDetailAlpha(p.kind, detailZoom) === 0) return false;
    const q = isoToScreen(p.x, p.y, p.level);
    return (
      Math.abs(q.x - view.x) < view.width / (2 * view.zoom) + 45 &&
      Math.abs(q.y - view.y) < view.height / (2 * view.zoom) + 35
    );
  });
  if (!visible.length) return 0;
  let climate: Float32Array | undefined;
  for (const p of visible) {
    let stamp = field.paint!.images.get(p);
    if (!stamp) {
      const q = isoToScreen(p.x, p.y, p.level),
        ax = Math.floor(q.x) - 50,
        ay = Math.floor(q.y) - 28;
      const canvas = document.createElement('canvas');
      canvas.width = 100;
      canvas.height = 56;
      const c = canvas.getContext('2d')!;
      c.translate(-ax, -ay);
      c.beginPath();
      const x = Math.floor(p.x),
        y = Math.floor(p.y);
      let shore = false;
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          const t = world.at(x + dx, y + dy);
          shore ||= !!t?.water;
          if (!groundEligible(t) || t!.level !== p.level) continue;
          const pts = tileDiamond(x + dx, y + dy, p.level);
          pts.forEach((q, i) => (i ? c.lineTo(q.x, q.y) : c.moveTo(q.x, q.y)));
          c.closePath();
        }
      c.clip();
      if (shore)
        for (const s of waterSurfaces(world)) {
          waterSurfacePath(c, s);
          c.rect(ax, ay, 100, 56);
          c.clip('evenodd');
        }
      climate ??= rainShade(rainField(world), atm.time.now);
      const cover = climate[Math.floor(p.y) * world.size + Math.floor(p.x)] ?? 0;
      paintPatch(c, { ...p, ...groundPatchClimate(p, cover) }, atm, detailZoom);
      stamp = { canvas, x: ax, y: ay };
      field.paint!.images.set(p, stamp);
    }
    ctx.drawImage(stamp.canvas, stamp.x, stamp.y);
  }
  return visible.length;
}
