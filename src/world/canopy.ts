/** Shared annual optical cover. Branches survive leaf fall; blossoms also intercept light.
 * Derived from the same seeded leaf groups as the drawing, never from a season label.
 */
import { clamp01 } from '../core/rng';
import { ANNUAL_CROWN_TYPES, crownCacheKey, crownCacheTime, leafGroup, plantYear } from './phenology';

export function canopyDensity(type: string, seed: number, now: number): number {
  if (!ANNUAL_CROWN_TYPES.has(type)) return 0;
  const state = plantYear(type, seed, now);
  if (state.evergreen) return 1;
  const count = type === 'persimmon' ? 15 : type === 'ginkgo' || type === 'willow' ? 18 : type === 'wisteria' ? 16 : 21;
  let area = 0;
  for (let i = 0; i < count; i++) {
    const leaf = leafGroup(state, seed, i);
    area += leaf.growth * leaf.retained * leaf.size ** 2;
  }
  const leaves = area / count;
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
