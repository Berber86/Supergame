import { flowerYear, litterYear, winterYear } from '../world/annualEnvironment';
import { crownCacheKey, crownCacheTime } from '../world/phenology';
/** Sparse, persistent-looking ground ecology. Decoration only: never places objects or changes saves. */
import { isoToScreen, tileDiamond } from '../core/iso';
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
}
interface HabitatObject {
  x: number;
  y: number;
  level: number;
  type: string;
  seed: number;
  radius: number;
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
      };
      // Litter belongs to a nearby tree; broad patches of empty ground remain between communities.
      if (nearest && nearestD < 1.35 && roll > 0.22) {
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
  fields.set(world, field);
  return field;
}
/** Fine heads/leaves fade first; coarse grass lasts longer. No full-resolution overlay buffers. */
export function groundDetailAlpha(kind: GroundLifeKind, zoom: number): number {
  if (['flowers', 'mushrooms', 'leaves', 'needles'].includes(kind)) return clamp01((zoom - 0.58) / 0.24);
  if (kind === 'grass') return clamp01((zoom - 0.36) / 0.24);
  return clamp01((zoom - 0.23) / 0.2);
}
function litterColor(p: GroundPatch, atm: Atmosphere): RGB {
  if (p.treeType === 'pine') return { r: 131, g: 111, b: 65 };
  const year = litterYear(p.treeType ?? 'maple', p.treeSeed ?? p.seed, atm.time.now);
  const fresh =
    p.treeType === 'ginkgo'
      ? { r: 214, g: 177, b: 66 }
      : p.treeType === 'maple'
        ? { r: 180, g: 96, b: 59 }
        : { r: 171, g: 139, b: 72 };
  return mix(mix({ r: 133, g: 120, b: 76 }, fresh, year.fresh), { r: 224, g: 186, b: 183 }, year.petals);
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
  const lit = (c: RGB) => shade(mix(c, atm.lightTint, atm.lightAmount), atm.exposure);
  const grass = lit(atm.palette.grassDeep),
    earth = lit(atm.palette.soil),
    litter = lit(litterColor(p, atm));
  // Low-contrast humus under a tree reads as one organic area even when individual leaves are hidden.
  if (['leaves', 'needles', 'roots', 'soil', 'moss', 'grass'].includes(p.kind)) {
    const col =
      p.kind === 'moss'
        ? lit(atm.palette.moss)
        : p.kind === 'grass'
          ? grass
          : p.kind === 'leaves' || p.kind === 'needles'
            ? litter
            : earth;
    const a = groundDetailAlpha('soil', zoom) * (p.kind === 'roots' ? 0.22 : p.kind === 'soil' ? 0.21 : 0.11);
    ctx.fillStyle = css(col, a * (p.kind === 'leaves' ? litterState.amount : 1));
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
  const count =
    p.kind === 'mushrooms' ? 3 : p.kind === 'flowers' ? 5 : p.kind === 'leaves' ? 13 : p.kind === 'needles' ? 10 : 7;
  for (let i = 0; i < count; i++) {
    const x = q.x + (hash2(i, p.seed, 17) - 0.5) * 34,
      y = q.y + (hash2(i, p.seed, 23) - 0.5) * 14;
    const r = hash2(i, p.seed, 47);
    if (p.kind === 'leaves' || p.kind === 'needles') {
      ctx.save();
      if (p.kind === 'leaves') ctx.globalAlpha *= smoothstep(r * 0.72, r * 0.72 + 0.28, litterState.amount);
      ctx.translate(x, y);
      ctx.rotate(r * 6.28);
      ctx.fillStyle = css(litter, 0.68);
      ctx.strokeStyle = css(litter, 0.65);
      ctx.lineWidth = 0.8;
      if (p.kind === 'needles') {
        ctx.beginPath();
        ctx.moveTo(-3, 0);
        ctx.lineTo(3, 0);
        ctx.moveTo(-2, 1);
        ctx.lineTo(3, 0);
        ctx.stroke();
      } else {
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
        } else
          ctx.ellipse(0, 0, p.treeType === 'bamboo' ? 4 : 3, p.treeType === 'bamboo' ? 0.8 : 1.4, 0, 0, Math.PI * 2);
        ctx.closePath();
        ctx.fill();
      }
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
      paintPatch(c, p, atm, detailZoom);
      stamp = { canvas, x: ax, y: ay };
      field.paint!.images.set(p, stamp);
    }
    ctx.drawImage(stamp.canvas, stamp.x, stamp.y);
  }
  return visible.length;
}
