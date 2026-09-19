/** A garden-wide daily rhythm, independent of lamps, exposure, weather tint or placement. */
import { smoothstep } from '../core/rng';
import type { Atmosphere } from '../world/palette';
import { blobPath, type Ctx } from './paint';

export const FLOWERING_TYPES = new Set(['lily', 'iris', 'lotus', 'sakura', 'azalea', 'wisteria', 'camellia']);
/** Closed throughout astronomical garden night; a soft transition at dawn and dusk. */
export function flowerOpenness(atm: Atmosphere): number {
  return smoothstep(0.22, 0.78, atm.time.daylight);
}
/** Geometry changes independently of colour, including in locally re-lit sprites and reflections. */
export function flowerCycleKey(type: string, atm: Atmosphere): string {
  return FLOWERING_TYPES.has(type) ? String(Math.round(flowerOpenness(atm) * 16)) : '';
}
/** At night the corolla folds into an upright bud rather than merely getting smaller/darker. */
export function flowerHeadPath(
  ctx: Ctx,
  x: number,
  y: number,
  rx: number,
  ry: number,
  seed: number,
  open: number,
): void {
  if (open >= 0.999) {
    blobPath(ctx, x, y, rx, ry, seed, 0.3, 6);
    return;
  }
  const w = rx * (0.25 + open * 0.75),
    h = ry * (1.18 - open * 0.18);
  ctx.beginPath();
  ctx.moveTo(x, y + h * 0.7);
  ctx.bezierCurveTo(x - w * 1.35, y + h * 0.2, x - w, y - h * 0.8, x, y - h);
  ctx.bezierCurveTo(x + w, y - h * 0.8, x + w * 1.35, y + h * 0.2, x, y + h * 0.7);
  ctx.closePath();
}
