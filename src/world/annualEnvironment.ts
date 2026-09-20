/** Second annual stage: independent flowering, litter, snow and freeze/thaw curves.
 * Calendar-derived, not saved simulation state: scrubbing time never changes a garden save.
 */
import { annualPhase } from '../core/clock';
import { hash2, smoothstep } from '../core/rng';
import { plantYear } from './phenology';
import { canopyLeafDensity } from './canopy';

function pulse(q: number, a: number, b: number, c: number, d: number): number {
  return smoothstep(a, b, q) * (1 - smoothstep(c, d, q));
}
export function winterYear(now: number): { snow: number; ice: number; icicles: number } {
  const p = annualPhase(now),
    q = p > 0.5 ? p - 1 : p;
  return {
    snow: pulse(q, -0.16, -0.015, 0.025, 0.195),
    ice: pulse(q, -0.105, 0.005, 0.045, 0.205),
    icicles: pulse(q, -0.09, 0.015, 0.04, 0.165),
  };
}
const FLOWER_PROFILES: Record<string, [number, number, number, number]> = {
  iris: [0.225, 0.29, 0.4, 0.52],
  lily: [0.22, 0.29, 0.37, 0.47],
  lotus: [0.32, 0.44, 0.6, 0.72],
  azalea: [0.225, 0.29, 0.37, 0.46],
  wildflowers: [0.235, 0.3, 0.6, 0.77],
};

export function flowerYear(type: string, seed: number, now: number): { bloom: number; foliage: number } {
  const p = (annualPhase(now) - ((hash2(seed, 79, 1501) - 0.5) * 14) / 365 + 1) % 1;
  const profile = FLOWER_PROFILES[type];
  const bloom =
    type === 'camellia' ? pulse(p > 0.5 ? p - 1 : p, -0.17, -0.025, 0.18, 0.32) : profile ? pulse(p, ...profile) : 0;
  const water = type === 'lotus' || type === 'lilypad';
  const foliage =
    type === 'azalea' || type === 'camellia'
      ? 1
      : pulse(p, water ? 0.25 : 0.19, water ? 0.4 : 0.29, 0.74, water ? 0.92 : 0.95);
  return { bloom, foliage };
}
export interface LitterYear {
  /** Combined visual activity, retained for consumers of the whole ground layer. */
  amount: number;
  /** Last autumn's leaves; separate from fresh spring petals. */
  leaves: number;
  fresh: number;
  petals: number;
}
export function litterYear(type: string, seed: number, now: number): LitterYear {
  const plant = plantYear(type, seed, now),
    q = plant.phase < 0.5 ? plant.phase + 1 : plant.phase;
  // In autumn, the missing drawn leaf area becomes litter. In spring it belongs to
  // last year's crown, not the new buds. No integration/history required for offline time.
  const fall = plant.phase < 0.5 ? 1 : 1 - canopyLeafDensity(type, seed, now);
  const petals = type === 'sakura' ? pulse(plant.phase, 0.25, 0.32, 0.345, 0.435) : 0;
  // About half remains in March, a thin residue in April, gone by the end of May
  // even for the latest seeded tree. Snow hides the winter stock; it doesn't erase it.
  const old = 1 - smoothstep(0.97, 1.35, q);
  const leaves = plant.evergreen ? 0.38 : fall * old;
  return {
    amount: Math.max(petals, leaves),
    leaves,
    fresh: plant.evergreen ? 0.25 : 1 - smoothstep(0.86, 1.1, q),
    petals,
  };
}
