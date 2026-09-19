/** Shared garden/encyclopedia entry points. */
import type { Fish } from '../world/life';
import type { World } from '../world/world';
import type { Atmosphere } from '../world/palette';
import type { Ctx } from './paint';
import { isoToScreen } from '../core/iso';
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
  drawFishAt(ctx, fish, p.x, p.y, atm, time);
}
