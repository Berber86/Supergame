/** Shared annual optical cover. Branches survive leaf fall; blossoms also intercept light.
 * Derived from the same seeded leaf groups as the drawing, never from a season label.
 */
import { clamp01, hash2 } from '../core/rng';
import { ANNUAL_CROWN_TYPES, crownCacheKey, crownCacheTime, leafGroup, plantYear, type PlantYear } from './phenology';

/** Shared mature dimensions: the litter footprint must follow the actual tree, not a fixed tile radius. */
export const TREE_CROWNS: Record<string, { crownW: number; crownH: number; layers: number }> = {
  sakura: { crownW: 98, crownH: 74, layers: 5 },
  maple: { crownW: 96, crownH: 72, layers: 5 },
  ginkgo: { crownW: 82, crownH: 78, layers: 4 },
  willow: { crownW: 104, crownH: 58, layers: 4 },
  persimmon: { crownW: 58, crownH: 46, layers: 3 },
};
export function crownWidth(width: number, seed: number): number {
  return width * (0.8 + hash2(seed, 5, 7) * 0.42);
}
function leafArea(type: string, seed: number, state: PlantYear): number {
  if (state.evergreen) return 1;
  const count = TREE_CROWNS[type] ? (TREE_CROWNS[type].layers + 2) * 3 : type === 'wisteria' ? 16 : 21;
  let area = 0;
  for (let i = 0; i < count; i++) {
    const leaf = leafGroup(state, seed, i);
    area += leaf.growth * leaf.retained * leaf.size ** 2;
  }
  return area / count;
}
/** Leaves only: spring blossoms are not last autumn's leaf mass. */
export function canopyLeafDensity(type: string, seed: number, now: number): number {
  return ANNUAL_CROWN_TYPES.has(type) ? leafArea(type, seed, plantYear(type, seed, now)) : 0;
}
export function canopyDensity(type: string, seed: number, now: number): number {
  if (!ANNUAL_CROWN_TYPES.has(type)) return 0;
  const state = plantYear(type, seed, now);
  const leaves = leafArea(type, seed, state);
  const blossoms = state.bloom * (type === 'sakura' ? 0.65 : 0.25);
  return clamp01(leaves + (1 - leaves) * blossoms);
}

/** Sparse wood still shades a little; a bare tree is not an opaque summer umbrella. */
export function canopyCover(type: string, seed: number, now: number): number {
  return ANNUAL_CROWN_TYPES.has(type) ? 0.08 + 0.92 * canopyDensity(type, seed, now) : 0;
}

// One current revision per seed/species, shared by shadows and moisture; no per-frame leaf scans.
const cache = new Map<string, { revision: string; density: number }>();
export function cachedCanopyDensity(type: string, seed: number, now: number): number {
  if (!ANNUAL_CROWN_TYPES.has(type)) return 0;
  const key = `${type}:${seed}`,
    revision = crownCacheKey(type, seed, now);
  const old = cache.get(key);
  if (old?.revision === revision) return old.density;
  const density = canopyDensity(type, seed, crownCacheTime(type, seed, now));
  cache.set(key, { revision, density });
  if (cache.size > 600) cache.delete(cache.keys().next().value!);
  return density;
}
