/** Continuous pond silhouettes. Geometry is rebuilt with terrain, not every frame. */
import { LEVEL_H, TILE_H, isoToScreen, type Pt } from '../core/iso';
import { clamp01, hash2 } from '../core/rng';
import { ITEM_BY_ID } from '../world/catalog';
import { css, mix, shade, type Atmosphere } from '../world/palette';
import type { World } from '../world/world';
import type { Ctx } from './paint';

export interface WaterCell {
  x: number;
  y: number;
  seed: number;
  shore: boolean;
}
export interface WaterSurface {
  level: number;
  loops: Pt[][];
  cells: WaterCell[];
}
interface Edge {
  a: Pt;
  b: Pt;
  dir: number;
  used: boolean;
}
const surfaces = new WeakMap<World, WaterSurface[]>();
const key = (p: Pt) => `${p.x},${p.y}`;

/** Clockwise exposed edges, with right turns at diagonal contacts to keep islands separate. */
export function prepareWaterSurface(world: World): WaterSurface[] {
  const levels = new Map<number, WaterCell[]>();
  for (let y = 0; y < world.size; y++)
    for (let x = 0; x < world.size; x++) {
      const tile = world.at(x, y)!;
      if (!tile.water) continue;
      const cells = levels.get(tile.level) ?? [];
      if (!levels.has(tile.level)) levels.set(tile.level, cells);
      cells.push({ x, y, seed: hash2(x, y, 181), shore: false });
    }
  const result: WaterSurface[] = [];
  for (const [level, cells] of [...levels].sort((a, b) => a[0] - b[0])) {
    const edges: Edge[] = [];
    const starts = new Map<string, Edge[]>();
    const same = (x: number, y: number) => {
      const t = world.at(x, y);
      return !!t?.water && t.level === level;
    };
    const add = (a: Pt, b: Pt, dir: number) => {
      const edge = { a, b, dir, used: false };
      edges.push(edge);
      const list = starts.get(key(a)) ?? [];
      list.push(edge);
      starts.set(key(a), list);
    };
    for (const c of cells) {
      const { x, y } = c;
      const before = edges.length;
      if (!same(x, y - 1)) add({ x, y }, { x: x + 1, y }, 0);
      if (!same(x + 1, y)) add({ x: x + 1, y }, { x: x + 1, y: y + 1 }, 1);
      if (!same(x, y + 1)) add({ x: x + 1, y: y + 1 }, { x, y: y + 1 }, 2);
      if (!same(x - 1, y)) add({ x, y: y + 1 }, { x, y }, 3);
      c.shore = before !== edges.length;
    }
    const loops: Pt[][] = [];
    for (const first of edges) {
      if (first.used) continue;
      const loop: Pt[] = [];
      let edge: Edge | undefined = first;
      while (edge && !edge.used) {
        edge.used = true;
        // Stable sub-tile irregularity breaks long ruler-straight banks.
        const jx = (hash2(edge.a.x, edge.a.y, 887) - 0.5) * 0.34;
        const jy = (hash2(edge.a.x, edge.a.y, 889) - 0.5) * 0.34;
        loop.push(isoToScreen(edge.a.x + jx, edge.a.y + jy, level - 0.26));
        if (key(edge.b) === key(first.a)) break;
        const dir: number = edge.dir;
        const candidates: Edge[] = (starts.get(key(edge.b)) ?? []).filter((e) => !e.used);
        const priority = (e: Edge) => [1, 0, 3, 2].indexOf((e.dir - dir + 4) % 4);
        edge = candidates.sort((a, b) => priority(a) - priority(b))[0];
      }
      if (loop.length >= 4) loops.push(loop);
    }
    result.push({ level, loops, cells });
  }
  surfaces.set(world, result);
  return result;
}
export function waterSurfaces(world: World): WaterSurface[] {
  return surfaces.get(world) ?? prepareWaterSurface(world);
}

/** A single rounded shoreline, including dry islands (even-odd winding). */
export function waterSurfacePath(ctx: Ctx, surface: WaterSurface): void {
  ctx.beginPath();
  for (const points of surface.loops) {
    const last = points[points.length - 1],
      first = points[0];
    ctx.moveTo((last.x + first.x) / 2, (last.y + first.y) / 2);
    for (let i = 0; i < points.length; i++) {
      const p = points[i],
        next = points[(i + 1) % points.length];
      ctx.quadraticCurveTo(p.x, p.y, (p.x + next.x) / 2, (p.y + next.y) / 2);
    }
    ctx.closePath();
  }
}

/** Cached colour/depth, drawn once per level instead of opaque overlapping tile blobs. */
export function drawWaterSurface(ctx: Ctx, world: World, atm: Atmosphere): void {
  const light = Math.max(0.46, atm.exposure);
  const deep = shade(mix(atm.palette.waterDeep, { r: 51, g: 119, b: 129 }, 0.22), light);
  const body = shade(mix(atm.palette.water, { r: 102, g: 179, b: 178 }, 0.24), light);
  const shallows = shade(mix(atm.palette.water, { r: 192, g: 212, b: 177 }, 0.46), light);
  const sky = mix(body, atm.skyBottom, 0.2);
  const wet = shade(mix(atm.palette.soil, atm.palette.waterDeep, 0.6), light * 0.75);
  ctx.save();
  ctx.lineJoin = 'round';
  for (const surface of waterSurfaces(world)) {
    waterSurfacePath(ctx, surface);
    // Narrow damp soil, not giant multiply-blobs over half the bank.
    ctx.strokeStyle = css(wet, 0.16);
    ctx.lineWidth = 4;
    ctx.stroke();
    // Fixed world-space coordinates: a local edit must not recolour an entire pond.
    const y0 = -surface.level * LEVEL_H;
    const gradient = ctx.createLinearGradient(0, y0, 150, y0 + world.size * TILE_H);
    gradient.addColorStop(0, css(deep));
    gradient.addColorStop(0.35, css(mix(body, deep, 0.42)));
    gradient.addColorStop(0.68, css(mix(body, deep, 0.46)));
    gradient.addColorStop(1, css(sky));
    ctx.fillStyle = gradient;
    ctx.fill('evenodd');
    ctx.save();
    ctx.clip('evenodd');
    // Nested low-opacity washes give the shallow shelf a soft, continuous falloff.
    for (const [width, alpha] of [
      [58, 0.04],
      [44, 0.05],
      [32, 0.07],
      [22, 0.08],
      [14, 0.09],
      [7, 0.07],
    ]) {
      waterSurfacePath(ctx, surface);
      ctx.strokeStyle = css(shallows, alpha);
      ctx.lineWidth = width;
      ctx.stroke();
    }
    // Broad translucent pools of depth, feathered to zero rather than tiled blobs.
    // Radius is local (< 3 tiles), so terrain's dirty-rectangle margin still covers it.
    for (const cell of surface.cells) {
      if (cell.x % 3 !== 1 || cell.y % 3 !== 1) continue;
      const p = isoToScreen(cell.x + 0.5, cell.y + 0.5, surface.level - 0.26);
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.scale(1, 0.5);
      const depth = ctx.createRadialGradient(0, 0, 8, 0, 0, 140);
      depth.addColorStop(0, css(deep, 0.22));
      depth.addColorStop(0.45, css(deep, 0.12));
      depth.addColorStop(1, css(deep, 0));
      ctx.fillStyle = depth;
      ctx.fillRect(-140, -140, 280, 280);
      ctx.restore();
    }
    // A little submerged gravel at the shore; no grid of repeated bottom patches.
    for (const cell of surface.cells) {
      if (!cell.shore || cell.seed < 0.63) continue;
      const p = isoToScreen(cell.x + 0.5, cell.y + 0.5, surface.level - 0.26);
      for (let i = 0; i < 3; i++) {
        const s = hash2(cell.x * 3 + i, cell.y, 719);
        ctx.fillStyle = css(mix(shallows, deep, s), 0.16);
        ctx.beginPath();
        ctx.ellipse(p.x + (s - 0.5) * 22, p.y + i * 2 - 3, 1.6 + s * 2, 0.8 + s, s, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
    waterSurfacePath(ctx, surface);
    ctx.strokeStyle = css(shallows, 0.13);
    ctx.lineWidth = 0.7;
    ctx.stroke();
    // A few wet pebbles break the clean contour without rebuilding a dark outline.
    for (const loop of surface.loops)
      for (let i = 0; i < loop.length; i++) {
        const p = loop[i],
          prev = loop[(i + loop.length - 1) % loop.length],
          next = loop[(i + 1) % loop.length];
        const seed = hash2(Math.round(p.x), Math.round(p.y), 1021);
        if (seed < 0.78) continue;
        const x = (prev.x + p.x * 6 + next.x) / 8,
          y = (prev.y + p.y * 6 + next.y) / 8;
        ctx.fillStyle = css(shade(mix(atm.palette.stone, atm.palette.soil, 0.2), light * 0.85), 0.65);
        ctx.beginPath();
        ctx.ellipse(x, y, 3 + seed * 3, 1.5 + seed, -0.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = css(shallows, 0.42);
        ctx.beginPath();
        ctx.ellipse(x - 0.6, y - 0.9, 2 + seed * 2, 0.65, -0.2, 0, Math.PI * 2);
        ctx.fill();
      }
  }
  ctx.restore();
}

/** Reflections belong to real nearby trees, broken into gently moving horizontal strips. */
function drawReflections(
  ctx: Ctx,
  world: World,
  surface: WaterSurface,
  atm: Atmosphere,
  time: number,
  wind: number,
): void {
  const foliage = shade(mix(atm.palette.foliageDeep, atm.palette.waterDeep, 0.5), atm.exposure * 0.86);
  ctx.lineCap = 'round';
  for (const o of world.objects) {
    const item = ITEM_BY_ID.get(o.type);
    if (item?.kind !== 'tree') continue;
    const cx = o.tx + item.w / 2,
      cy = o.ty + item.h / 2;
    // A vertical reflected trunk travels down-screen, i.e. +x,+y in tile coordinates.
    let near = false;
    for (const off of [0.3, 0.8, 1.3]) {
      for (const side of [-0.3, 0, 0.3]) {
        const t = world.at(Math.floor(cx + off + side), Math.floor(cy + off - side));
        if (t?.water && t.level === surface.level) {
          near = true;
          break;
        }
      }
      if (near) break;
    }
    if (!near) continue;
    const p = isoToScreen(cx, cy, surface.level - 0.26);
    const conifer = o.type === 'pine' || o.type === 'bamboo';
    const height = conifer ? 74 : 62;
    ctx.strokeStyle = css(foliage, 0.23);
    for (let i = 0; i < 11; i++) {
      const yy = (i * height) / 11;
      const sway = Math.sin(time * 0.0009 + yy * 0.15 + o.seed) * (1.1 + wind * 1.6);
      const breadth = i < 3 ? 1.2 : conifer ? (11 - i) * 3.4 : Math.sin(((i - 2) / 10) * Math.PI) * 28;
      ctx.lineWidth = i < 3 ? 2 : 3.0 + hash2(i, o.seed, 919) * 2;
      ctx.beginPath();
      ctx.moveTo(p.x - breadth + sway, p.y + yy);
      ctx.quadraticCurveTo(p.x + sway, p.y + yy + 0.8, p.x + breadth + sway, p.y + yy);
      ctx.stroke();
    }
  }
}

/** Quiet surface: drifting sky streaks, fine wind-ripples and sparse sun/moon glints. */
export function drawWaterAnimation(ctx: Ctx, world: World, atm: Atmosphere, time: number, wind = 0.5): void {
  const breeze = clamp01(Math.abs(wind));
  const sun = (0.3 + atm.time.daylight * 0.65 + atm.golden * 0.4) * (1 - atm.overcast * 0.85);
  const hi = shade(
    mix(atm.palette.water, mix({ r: 240, g: 249, b: 233 }, { r: 255, g: 217, b: 151 }, atm.golden * 0.75), 0.77),
    Math.max(atm.exposure, 0.55),
  );
  const sky = mix(atm.skyBottom, atm.palette.water, 0.45);
  ctx.save();
  ctx.lineCap = 'round';
  for (const surface of waterSurfaces(world)) {
    ctx.save();
    waterSurfacePath(ctx, surface);
    ctx.clip('evenodd');
    drawReflections(ctx, world, surface, atm, time, breeze);
    for (const cell of surface.cells) {
      const { x, y, seed } = cell;
      const p = isoToScreen(x + 0.24 + hash2(x, y, 187) * 0.5, y + 0.24 + hash2(x, y, 191) * 0.5, surface.level - 0.26);
      const phase = time * (0.00045 + breeze * 0.0003) + seed * 24;
      const drift = Math.sin(phase) * (4 + breeze * 3);
      // Long translucent reflections of the sky; deliberately sparse, never discs.
      if (seed > 0.56) {
        ctx.strokeStyle = css(sky, 0.1 + atm.time.daylight * 0.045);
        ctx.lineWidth = 3 + seed * 2;
        ctx.beginPath();
        ctx.moveTo(p.x - 35 + drift, p.y - 5);
        ctx.bezierCurveTo(p.x - 13 + drift, p.y - 7, p.x + 14 + drift, p.y - 2, p.x + 40 + drift, p.y - 5);
        ctx.stroke();
      }
      for (let i = 0; i < 2; i++) {
        const pulse = (Math.sin(phase + i * 2.5) + 1) * 0.5;
        const len = 9 + hash2(x + i, y, 211) * 19;
        const yy = p.y + i * 9 + Math.sin(phase * 0.8 + i) * 1.4;
        ctx.strokeStyle = css(hi, (0.045 + pulse * 0.09) * (0.6 + sun));
        ctx.lineWidth = i ? 0.6 : 0.85;
        ctx.beginPath();
        ctx.moveTo(p.x - len + drift, yy);
        ctx.quadraticCurveTo(p.x + drift, yy + 1.5, p.x + len + drift, yy - 0.5);
        ctx.stroke();
      }
      // Shifting, open caustic arcs in the shallows, not round opaque tile stamps.
      if (cell.shore && seed > 0.58) {
        const ripple = (((time / 6500 + seed * 3) % 1) + 1) % 1;
        ctx.strokeStyle = css(hi, Math.sin(ripple * Math.PI) * 0.1 * (0.4 + sun));
        ctx.lineWidth = 0.7;
        ctx.beginPath();
        ctx.ellipse(p.x, p.y, 4 + ripple * 15, 1.3 + ripple * 4, 0, 0.2, Math.PI * 1.3);
        ctx.stroke();
      }
      if (seed > 0.72) {
        const sparkle = Math.pow(Math.max(0, Math.sin(time * 0.0012 + seed * 65)), 10) * sun;
        if (sparkle > 0.015) {
          ctx.strokeStyle = css(hi, sparkle * 0.72);
          ctx.lineWidth = 1.05;
          const gx = p.x + drift + 6,
            gy = p.y - 1;
          ctx.beginPath();
          ctx.moveTo(gx - 2.8, gy);
          ctx.lineTo(gx + 2.8, gy);
          ctx.moveTo(gx, gy - 1.3);
          ctx.lineTo(gx, gy + 1.3);
          ctx.stroke();
        }
      }
    }
    ctx.restore();
  }
  ctx.restore();
}
