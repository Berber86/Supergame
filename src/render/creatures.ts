/** Shared garden/encyclopedia entry points. */
import type { Fish } from '../world/life';
import type { World } from '../world/world';
import type { Atmosphere } from '../world/palette';
import type { Ctx } from './paint';
import { isoToScreen } from '../core/iso';
import { waterSurfaces, waterSurfacePath } from './waterSurface';
import { drawFishAt } from './pondAnimals';
import { waterDepth } from './waterDepth';
export { drawCat } from './cats';
export { drawBird } from './smallBirds';
export { drawButterfly } from './insects';
export { drawFishAt } from './pondAnimals';
export { lerp } from '../core/rng';

/** Feeding rises to the surface; calm deep-water swimming periodically dives. */
export function fishSubmersion(fish: Fish, world: World, time: number): number {
  if (fish.state === 'feed') return 0.18;
  if (fish.state === 'hide') return 1;
  const bed = waterDepth(world, fish.tx, fish.ty);
  const dive = Math.pow((Math.sin(time * 0.00042 + fish.seed) + 1) * 0.5, 3);
  return Math.min(1, 0.3 + bed * (0.32 + dive * 0.38));
}

export function drawFish(ctx: Ctx, fish: Fish, world: World, atm: Atmosphere, time: number): void {
  const t = world.at(Math.floor(fish.tx), Math.floor(fish.ty));
  if (!t?.water) return;
  const p = isoToScreen(fish.tx, fish.ty, t.level - 0.26);
  const surface = waterSurfaces(world).find(
    (s) => s.level === t.level && s.cells.some((c) => c.x === Math.floor(fish.tx) && c.y === Math.floor(fish.ty)),
  );
  if (!surface) return;
  ctx.save();
  waterSurfacePath(ctx, surface);
  ctx.clip('evenodd');
  const depth = fishSubmersion(fish, world, time);
  ctx.globalAlpha *= 0.94 - depth * 0.46;
  drawFishAt(ctx, fish, p.x + Math.sin(time * 0.0018 + fish.seed) * depth * 0.65, p.y + depth * 2.2, atm, time, depth);
  ctx.restore();
}
