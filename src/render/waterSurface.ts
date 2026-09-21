import { liquidExposure } from '../world/ecology';
import { CALM, type WindSampler } from '../world/wind';
import { plantPose, windLag } from './plantWind';
/** Continuous pond silhouettes. Geometry is rebuilt with terrain, not every frame. */
import { LEVEL_H, TILE_H, isoToScreen, type Pt } from '../core/iso';
import { clamp01, hash2 } from '../core/rng';
import { ITEM_BY_ID } from '../world/catalog';
import { css, mix, shade, type Atmosphere } from '../world/palette';
import type { World } from '../world/world';
import type { Ctx } from './paint';
import { WaterFlow } from '../world/waterFlow';
import { cascadeRims, meetCascadeRims } from './cascadeRims';
import { drawCachedReflection, cachedGrowth } from './spriteCache';
import { drawBridge, drawPlankBridge } from './sprites/bridges';
import { prepareWaterDepth, waterDepth } from './waterDepth';
import type { WaterMotion } from './waterMotion';

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
  prepareWaterDepth(world);
  const levels = new Map<number, WaterCell[]>();
  for (let y = 0; y < world.size; y++)
    for (let x = 0; x < world.size; x++) {
      const tile = world.at(x, y)!;
      if (!tile.water) continue;
      const cells = levels.get(tile.level) ?? [];
      if (!levels.has(tile.level)) levels.set(tile.level, cells);
      cells.push({ x, y, seed: hash2(x, y, 181), shore: false });
    }
  const flow = new WaterFlow();
  flow.ensure(world);
  const rims = cascadeRims(world, flow);
  const result: WaterSurface[] = [];
  for (const [level, allCells] of [...levels].sort((a, b) => a[0] - b[0])) {
    // Separate disconnected ponds even at the same elevation. Their clip masks
    // must not change (including edge rasterisation) when a distant pond is edited.
    const remaining = new Map(allCells.map((c) => [key(c), c]));
    const components: WaterCell[][] = [];
    while (remaining.size) {
      const first = remaining.values().next().value!;
      const cells = [first];
      remaining.delete(key(first));
      for (let i = 0; i < cells.length; i++) {
        const c = cells[i];
        for (const [dx, dy] of [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ]) {
          const id = `${c.x + dx},${c.y + dy}`,
            next = remaining.get(id);
          if (next) {
            remaining.delete(id);
            cells.push(next);
          }
        }
      }
      cells.sort((a, b) => a.y - b.y || a.x - b.x);
      components.push(cells);
    }
    for (const cells of components) {
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
          loop.push({ ...edge.a });
          if (key(edge.b) === key(first.a)) break;
          const dir: number = edge.dir;
          const candidates: Edge[] = (starts.get(key(edge.b)) ?? []).filter((e) => !e.used);
          const priority = (e: Edge) => [1, 0, 3, 2].indexOf((e.dir - dir + 4) % 4);
          edge = candidates.sort((a, b) => priority(a) - priority(b))[0];
        }
        if (loop.length >= 4) loops.push(meetCascadeRims(organicShore(loop, level), level, rims));
      }
      result.push({ level, loops, cells });
    }
  }
  surfaces.set(world, result);
  return result;
}
/** Sub-tile coves and headlands, followed by corner cutting, NOT a jittered tile polygon.
 * The displacement is in tile space so both isometric axes get the same curvature.
 * It is local and bounded: thin streams and dry islands retain their centres. */
export function organicShore(vertices: Pt[], level: number): Pt[] {
  let points: Pt[] = [];
  for (let i = 0; i < vertices.length; i++) {
    const a = vertices[i],
      b = vertices[(i + 1) % vertices.length];
    const dx = b.x - a.x,
      dy = b.y - a.y;
    for (const t of [0, 0.5]) {
      const x = a.x + dx * t,
        y = a.y + dy * t;
      const bend = Math.sin(x * 1.87 + y * 1.31 + 0.7) * 0.24 + Math.sin(x * 3.1 - y * 2.2) * 0.075;
      points.push({ x: x - dy * bend, y: y + dx * bend });
    }
  }
  // Two local Chaikin passes round both the broad bays and the small scallops.
  for (let pass = 0; pass < 2; pass++) {
    const smooth: Pt[] = [];
    for (let i = 0; i < points.length; i++) {
      const a = points[i],
        b = points[(i + 1) % points.length];
      smooth.push({ x: a.x * 0.75 + b.x * 0.25, y: a.y * 0.75 + b.y * 0.25 });
      smooth.push({ x: a.x * 0.25 + b.x * 0.75, y: a.y * 0.25 + b.y * 0.75 });
    }
    points = smooth;
  }
  return points.map((p) => isoToScreen(p.x, p.y, level - 0.26));
}

export function waterSurfaces(world: World): WaterSurface[] {
  return surfaces.get(world) ?? prepareWaterSurface(world);
}

const boundsCache = new WeakMap<WaterSurface, { minX: number; minY: number; maxX: number; maxY: number }>();
export function waterSurfaceBounds(surface: WaterSurface) {
  let bounds = boundsCache.get(surface);
  if (!bounds) {
    bounds = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
    for (const loop of surface.loops)
      for (const p of loop) {
        bounds.minX = Math.min(bounds.minX, p.x);
        bounds.maxX = Math.max(bounds.maxX, p.x);
        bounds.minY = Math.min(bounds.minY, p.y);
        bounds.maxY = Math.max(bounds.maxY, p.y);
      }
    boundsCache.set(surface, bounds);
  }
  return bounds;
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
  const shallows = shade(mix({ r: 193, g: 190, b: 143 }, atm.palette.water, 0.28), light);
  const sky = mix(body, atm.skyBottom, 0.1);
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
    // Feathered sand shelves of varying width, not nested contour-line strokes.
    // The clipped radial washes expose a warm bed through the shallow water.
    for (const loop of surface.loops)
      for (let i = 0; i < loop.length; i += 8) {
        const p = loop[i];
        const radius = 62 + hash2(Math.round(p.x), Math.round(p.y), 733) * 36;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.scale(1, 0.68);
        const shelf = ctx.createRadialGradient(0, 0, 0, 0, 0, radius);
        shelf.addColorStop(0, css(shallows, 0.62));
        shelf.addColorStop(0.25, css(shallows, 0.38));
        shelf.addColorStop(0.7, css(shallows, 0.08));
        shelf.addColorStop(1, css(shallows, 0));
        ctx.fillStyle = shelf;
        ctx.fillRect(-radius, -radius, radius * 2, radius * 2);
        ctx.restore();
      }
    // Broad translucent pools of depth, feathered to zero rather than tiled blobs.
    // Radius is local (< 3 tiles), so terrain's dirty-rectangle margin still covers it.
    for (const cell of surface.cells) {
      if (cell.x % 2 !== 1 || cell.y % 2 !== 1) continue;
      const bed = waterDepth(world, cell.x + 0.5, cell.y + 0.5);
      if (bed < 0.35) continue;
      const p = isoToScreen(cell.x + 0.5, cell.y + 0.5, surface.level - 0.26);
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.scale(1, 0.5);
      const depth = ctx.createRadialGradient(0, 0, 6, 0, 0, 112);
      depth.addColorStop(0, css(shade(deep, 0.83), (bed - 0.25) * 0.64));
      depth.addColorStop(0.45, css(deep, (bed - 0.25) * 0.32));
      depth.addColorStop(1, css(deep, 0));
      ctx.fillStyle = depth;
      ctx.fillRect(-112, -112, 224, 224);
      ctx.restore();
    }
    // Visible lake bed: groups of mineral stones and a few submerged stems,
    // located by the curved bank rather than at repeating tile centres.
    for (const loop of surface.loops)
      for (let i = 0; i < loop.length; i += 8) {
        const p = loop[i],
          a = loop[(i + loop.length - 3) % loop.length],
          b = loop[(i + 3) % loop.length];
        const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
        const nx = -(b.y - a.y) / len,
          ny = (b.x - a.x) / len;
        const seed = hash2(Math.round(p.x), Math.round(p.y), 751);
        if (seed < 0.35) continue;
        const x = p.x + nx * (9 + seed * 18),
          y = p.y + ny * (9 + seed * 18);
        for (let k = 0; k < 3; k++) {
          const size = 2.2 + hash2(k, Math.round(x), 753) * 4.8;
          const px = x + k * 5 - 4,
            py = y + Math.sin(k * 2 + seed) * 4;
          ctx.fillStyle = css(shade(mix(shallows, deep, 0.45), 0.78), 0.3);
          ctx.beginPath();
          ctx.ellipse(px, py, size, size * 0.47, -0.2, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = css(shallows, 0.4);
          ctx.beginPath();
          ctx.ellipse(px - 0.6, py - 0.8, size * 0.76, size * 0.26, -0.2, 0, Math.PI * 2);
          ctx.fill();
        }
        if (seed > 0.85) {
          ctx.strokeStyle = css(shade(mix(atm.palette.moss, deep, 0.45), light * 0.8), 0.24);
          ctx.lineWidth = 1.2;
          for (let k = 0; k < 3; k++) {
            ctx.beginPath();
            ctx.moveTo(x, y + 4);
            ctx.quadraticCurveTo(x + (k - 1) * 9, y - 3, x + (k - 1) * 5, y - 10 - k * 2);
            ctx.stroke();
          }
        }
      }
    ctx.restore();
    waterSurfacePath(ctx, surface);
    ctx.strokeStyle = css(shallows, 0.13);
    ctx.lineWidth = 0.7;
    ctx.stroke();
    // A few wet pebbles break the clean contour without rebuilding a dark outline.
    for (const loop of surface.loops)
      for (let i = 0; i < loop.length; i += 8) {
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

export interface WaterRenderOptions {
  view?: { minX: number; minY: number; maxX: number; maxY: number };
  detail?: number;
  reflectionStep?: number;
  objectWind?: number;
  windField?: WindSampler;
  plantMotion?: boolean;
  simpleWind?: boolean;
}
function outside(bounds: { minX: number; minY: number; maxX: number; maxY: number }, view: WaterRenderOptions['view']) {
  return (
    !!view && (bounds.maxX < view.minX || bounds.minX > view.maxX || bounds.maxY < view.minY || bounds.minY > view.maxY)
  );
}
/** Nearby objects reflect at the water plane; bridges retain their isometric ground axis. */
function drawReflections(
  ctx: Ctx,
  world: World,
  surface: WaterSurface,
  atm: Atmosphere,
  time: number,
  wind: number,
  motion?: WaterMotion,
  material?: (type: string, x: number, y: number) => Atmosphere,
  options: WaterRenderOptions = {},
): void {
  const reflectionWarp = motion ? (x: number, y: number) => motion(x, y, surface.level) : undefined;
  for (const o of world.objects) {
    const item = ITEM_BY_ID.get(o.type);
    if (!item || item.kind === 'creature') continue;
    const cx = o.tx + item.w / 2,
      cy = o.ty + item.h / 2;
    let near = false;
    // Test the crown's reflected footprint, not just a short line under the trunk.
    for (const off of [0, 0.7, 1.5, 2.3, 3]) {
      for (const side of [-0.8, 0, 0.8]) {
        const tile = world.at(Math.floor(cx + off + side), Math.floor(cy + off - side));
        if (tile?.water && tile.level === surface.level) {
          near = true;
          break;
        }
      }
      if (near) break;
    }
    if (!near) continue;
    const base = world.at(Math.floor(cx), Math.floor(cy));
    const baseLevel = base?.level ?? surface.level;
    if (Math.abs(baseLevel - surface.level) > 1.2) continue;
    const plane = isoToScreen(cx, cy, surface.level - 0.26);
    const objectLevel = base ? (base.water ? base.level - 0.28 : base.level) : 0;
    const objectAnchor = isoToScreen(cx, cy, objectLevel);
    const p = { x: plane.x, y: 2 * plane.y - objectAnchor.y };
    if (outside({ minX: p.x - 230, maxX: p.x + 230, minY: p.y - 25, maxY: p.y + 320 }, options.view)) continue;
    const materialAtm = material?.(o.type, cx, cy) ?? atm;
    if (item.kind === 'bridge') {
      ctx.save();
      ctx.globalAlpha *= 0.26;
      const draw = o.type === 'plank_bridge' ? drawPlankBridge : drawBridge;
      draw({
        ctx,
        x: p.x,
        y: p.y,
        obj: o,
        atm: materialAtm,
        g: 1,
        time,
        wind: 0,
        alpha: 1,
        reflection: true,
        reflectionWarp,
      });
      ctx.restore();
      continue;
    }
    // Mirror the same annual sprite and live sway, not a separate seasonal silhouette.
    // Leaf area/opacity already encodes density. Do not multiply the whole reflection
    // by canopy cover: that would double-fade foliage and erase the bare trunk too.
    const air = options.windField?.(cx, cy, windLag(o.type));
    const vector = options.plantMotion === false ? CALM : air;
    const objGrowth = world.growth(o, Date.now());
    const pose = vector
      ? plantPose(o.type, o.seed, cachedGrowth(objGrowth), time, vector, options.simpleWind)
      : undefined;
    drawCachedReflection(
      {
        ctx,
        x: p.x,
        y: p.y,
        atm: materialAtm,
        obj: o,
        g: objGrowth,
        time,
        wind,
        plantPose: pose,
        windVector: vector,
        alpha: item.kind === 'tree' ? 0.61 : 0.4,
        reflectionWarp,
      },
      1,
      options.reflectionStep,
    );
  }
}

/** Quiet surface: drifting sky streaks, fine wind-ripples and sparse sun/moon glints. */
export function drawWaterAnimation(
  ctx: Ctx,
  world: World,
  atm: Atmosphere,
  time: number,
  wind = 0.5,
  motion?: WaterMotion,
  material?: (type: string, x: number, y: number) => Atmosphere,
  options: WaterRenderOptions = {},
): void {
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
    if (outside(waterSurfaceBounds(surface), options.view)) continue;
    ctx.save();
    waterSurfacePath(ctx, surface);
    ctx.clip('evenodd');
    ctx.fillStyle = css(mix(atm.palette.water, atm.skyBottom, 0.28), 0.09);
    ctx.fill('evenodd');
    drawReflections(ctx, world, surface, atm, time, options.objectWind ?? breeze, motion, material, options);
    // Moving water stays outside the cached mineral body, clipped to the actual pond.
    const liquid = liquidExposure(atm.time.now);
    if (liquid > 0.01)
      for (const o of world.objects) {
        if (o.type !== 'water_stone') continue;
        const tx = o.tx + 0.5,
          ty = o.ty + 0.5,
          tile = world.at(Math.floor(tx), Math.floor(ty));
        if (
          !tile?.water ||
          tile.level !== surface.level ||
          !surface.cells.some((c) => c.x === Math.floor(tx) && c.y === Math.floor(ty))
        )
          continue;
        const p = isoToScreen(tx, ty, surface.level - 0.26);
        if (outside({ minX: p.x - 32, maxX: p.x + 32, minY: p.y - 14, maxY: p.y + 14 }, options.view)) continue;
        const air = options.windField?.(tx, ty, 120);
        for (let i = 0; i < 2; i++) {
          const phase = (((time * 0.00028 + i * 0.5 + o.seed * 0.01) % 1) + 1) % 1;
          ctx.strokeStyle = css(hi, liquid * (1 - phase) * 0.23);
          ctx.lineWidth = 0.8;
          ctx.beginPath();
          ctx.ellipse(
            p.x + (air?.screenX ?? 0) * phase * 3,
            p.y + 2,
            15 + phase * 12,
            5 + phase * 6,
            0,
            0.12,
            Math.PI * 1.91,
          );
          ctx.stroke();
        }
      }
    for (const cell of surface.cells) {
      const { x, y, seed } = cell;
      const p = isoToScreen(x + 0.24 + hash2(x, y, 187) * 0.5, y + 0.24 + hash2(x, y, 191) * 0.5, surface.level - 0.26);
      if (outside({ minX: p.x - 80, maxX: p.x + 80, minY: p.y - 25, maxY: p.y + 25 }, options.view)) continue;
      if (seed > (options.detail ?? 1)) continue;
      const air = options.windField?.(x + 0.5, y + 0.5, 120),
        force = air?.strength ?? breeze;
      const along = air ? x * air.x + y * air.y : seed * 24;
      const phase = time * 0.00065 + along * 0.65;
      const drift = Math.sin(phase) * (1 + force * 3) + (air?.screenX ?? 0) * 3;
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
        ctx.strokeStyle = css(hi, (0.035 + pulse * 0.09) * (0.35 + Math.min(1, force)) * (0.6 + sun));
        ctx.lineWidth = i ? 0.6 : 0.85;
        ctx.beginPath();
        ctx.moveTo(p.x - len + drift, yy);
        ctx.quadraticCurveTo(p.x + drift, yy + 1.5, p.x + len + drift, yy - 0.5);
        ctx.stroke();
      }
      // Shifting, open caustic arcs in the shallows, not round opaque tile stamps.
      if (cell.shore && seed > 0.44) {
        const shimmer = (Math.sin(phase * 1.7) + 1) * 0.5;
        ctx.strokeStyle = css(hi, (0.06 + shimmer * 0.12) * sun);
        ctx.lineWidth = 1.2;
        for (let k = 0; k < 2; k++) {
          const yy = p.y + k * 8;
          ctx.beginPath();
          ctx.moveTo(p.x - 17 + drift, yy + 1);
          ctx.bezierCurveTo(p.x - 7 + drift, yy - 5 - shimmer * 2, p.x + 3 + drift, yy + 7, p.x + 16 + drift, yy - 2);
          ctx.stroke();
        }
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
