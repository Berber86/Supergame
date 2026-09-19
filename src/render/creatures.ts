/** Shared garden/encyclopedia entry points. */
import type { Fish } from '../world/life';
import type { World } from '../world/world';
import type { Atmosphere } from '../world/palette';
import type { Ctx } from './paint';
import { isoToScreen } from '../core/iso';
import { waterSurfaces, waterSurfacePath } from './waterSurface';
import { drawFishAt } from './pondAnimals';
export { drawCat } from './cats';
export { drawBird } from './smallBirds';
export { drawButterfly } from './insects';
export { drawFishAt } from './pondAnimals';
export { lerp } from '../core/rng';

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
  const depth = fish.state === 'feed' ? 0.3 : fish.state === 'hide' ? 1 : 0.72;
  ctx.globalAlpha *= 0.9 - depth * 0.16;
  drawFishAt(ctx, fish, p.x + Math.sin(time * 0.0018 + fish.seed) * depth * 0.65, p.y + depth * 2.2, atm, time, depth);
  ctx.restore();
}
