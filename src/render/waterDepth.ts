/** Bounded local bathymetry, rebuilt with terrain; no save-data changes. */
import type { World } from '../world/world';
import { clamp01, lerp } from '../core/rng';
const fields = new WeakMap<World, Float32Array>();
export function prepareWaterDepth(world: World): void {
  const field = new Float32Array(world.size * world.size);
  for (let y = 0; y < world.size; y++)
    for (let x = 0; x < world.size; x++) {
      const tile = world.at(x, y)!;
      if (!tile.water) continue;
      let wet = 0,
        total = 0;
      // Only two neighbouring cells influence depth: dirty rectangles stay local.
      for (let dy = -2; dy <= 2; dy++)
        for (let dx = -2; dx <= 2; dx++) {
          const w = 3 - Math.max(Math.abs(dx), Math.abs(dy));
          const n = world.at(x + dx, y + dy);
          total += w;
          if (n?.water && n.level === tile.level) wet += w;
        }
      field[y * world.size + x] = clamp01((wet / total - 0.3) / 0.7);
    }
  fields.set(world, field);
}
export function waterDepth(world: World, tx: number, ty: number): number {
  if (!fields.has(world)) prepareWaterDepth(world);
  const field = fields.get(world)!;
  const x = tx - 0.5,
    y = ty - 0.5,
    x0 = Math.floor(x),
    y0 = Math.floor(y);
  const at = (cx: number, cy: number) =>
    cx < 0 || cy < 0 || cx >= world.size || cy >= world.size ? 0 : field[cy * world.size + cx];
  return lerp(lerp(at(x0, y0), at(x0 + 1, y0), x - x0), lerp(at(x0, y0 + 1), at(x0 + 1, y0 + 1), x - x0), y - y0);
}
