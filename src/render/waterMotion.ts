import type { WindSampler } from '../world/wind';
/** Shared, stateless surface displacement for scenery and animated reflections. */
import { isoToScreen, screenToIso } from '../core/iso';
import { clamp, clamp01 } from '../core/rng';
import type { World } from '../world/world';
import type { WaterFlow } from '../world/waterFlow';
import { waterDepth } from './waterDepth';
export interface WaterRing {
  tx: number;
  ty: number;
  age: number;
  life: number;
  max: number;
  start?: number;
  strength?: number;
}
export interface WaterDisplacement {
  dx: number;
  dy: number;
  alpha: number;
}
export type ReflectionWarp = (x: number, y: number) => WaterDisplacement;
export type WaterMotion = (x: number, y: number, level: number) => WaterDisplacement;
const currentCache = new WeakMap<WaterFlow, { falls: WaterFlow['falls']; world: World; cells: Uint8Array }>();
/** Carry an upstream cascade's movement through its connected narrow channel. */
function flowingWater(world: World, flow: WaterFlow): Uint8Array {
  const hit = currentCache.get(flow);
  if (hit?.falls === flow.falls && hit.world === world) return hit.cells;
  const cells = new Uint8Array(world.size * world.size),
    queue: number[] = [];
  for (const f of flow.falls) {
    const i = f.y * world.size + f.x;
    if (!cells[i]) {
      cells[i] = 1;
      queue.push(i);
    }
  }
  for (let k = 0; k < queue.length; k++) {
    const i = queue[k],
      x = i % world.size,
      y = Math.floor(i / world.size);
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const nx = x + dx,
        ny = y + dy,
        j = ny * world.size + nx;
      if (world.at(nx, ny)?.water && !cells[j]) {
        cells[j] = 1;
        queue.push(j);
      }
    }
  }
  currentCache.set(flow, { falls: flow.falls, world, cells });
  return cells;
}

export function makeWaterMotion(
  world: World,
  flow: WaterFlow,
  time: number,
  wind: number,
  rings: readonly WaterRing[] = [],
  windField?: WindSampler,
): WaterMotion {
  const breeze = clamp01(Math.abs(wind));
  const active = flowingWater(world, flow);
  const waves = rings.slice(-64).flatMap((r) => {
    const t = world.at(Math.floor(r.tx), Math.floor(r.ty));
    if (!t?.water || r.age < 0 || r.life <= 0 || r.age >= r.life) return [];
    const k = r.age / r.life,
      p = isoToScreen(r.tx, r.ty, t.level - 0.26);
    return [{ x: p.x, y: p.y, level: t.level, radius: (r.start ?? 0) + r.max * k, power: (1 - k) * (r.strength ?? 1) }];
  });
  return (x, y, level) => {
    const tile = screenToIso(x, y, level - 0.26);
    const air = windField?.(tile.x, tile.y, 120);
    const localBreeze = air?.strength ?? breeze;
    const tx = Math.floor(tile.x),
      ty = Math.floor(tile.y);
    const carried =
      world.at(tx, ty)?.water && active[ty * world.size + tx]
        ? 0.42 * Math.pow(1 - waterDepth(world, tile.x, tile.y), 2)
        : 0;
    const speed = Math.max(flow.at(tx, ty)?.speed ?? 0, carried);
    const phase = time * (0.0009 + speed * 0.0018) + y * 0.13 + x * 0.016;
    let dx = Math.sin(time * 0.0006 + y * 0.035) * (0.12 + localBreeze * 0.28) + Math.sin(phase) * speed * 2.8;
    dx += (air?.screenX ?? 0) * 0.55;
    let dy = Math.cos(phase * 0.83) * speed * 0.65 + (air?.screenY ?? 0) * 0.25;
    let disturbance = 0;
    for (const wave of waves) {
      if (wave.level !== level || Math.abs(x - wave.x) > wave.radius + 9 || Math.abs(y - wave.y) * 2 > wave.radius + 9)
        continue;
      const xx = x - wave.x,
        yy = (y - wave.y) * 2,
        dist = Math.hypot(xx, yy),
        edge = dist - wave.radius;
      if (Math.abs(edge) > 9) continue;
      const pulse = Math.sin(edge * 0.55) * Math.exp((-edge * edge) / 32) * wave.power * 2.6;
      dx += (pulse * xx) / Math.max(1, dist);
      dy += ((pulse * yy) / Math.max(1, dist)) * 0.5;
      disturbance += Math.abs(pulse) * 0.12;
    }
    return { dx: clamp(dx, -5, 5), dy: clamp(dy, -2.5, 2.5), alpha: clamp(1 - speed * 0.16 - disturbance, 0.5, 1) };
  };
}
