/** Second annual stage: independent flowering, litter, snow and freeze/thaw curves.
 * Calendar-derived, not saved simulation state: scrubbing time never changes a garden save.
 */
import { annualPhase } from '../core/clock';
import { hash2, smoothstep } from '../core/rng';
import { plantYear } from './phenology';

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
  iris: [0.17, 0.27, 0.38, 0.51],
  lily: [0.19, 0.29, 0.37, 0.47],
  lotus: [0.32, 0.44, 0.6, 0.72],
  azalea: [0.15, 0.24, 0.34, 0.45],
  wildflowers: [0.12, 0.23, 0.6, 0.77],
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
      : pulse(p, water ? 0.16 : 0.08, water ? 0.36 : 0.27, 0.74, water ? 0.92 : 0.95);
  return { bloom, foliage };
}
export function litterYear(type: string, seed: number, now: number): { amount: number; fresh: number; petals: number } {
  const plant = plantYear(type, seed, now),
    q = plant.phase < 0.5 ? plant.phase + 1 : plant.phase;
  const fall = plant.phase < 0.5 ? 1 : plant.leafFall;
  const petals = type === 'sakura' ? pulse(plant.phase, 0.25, 0.32, 0.345, 0.435) : 0;
  const old = 1 - smoothstep(1.01, 1.4, q);
  return {
    amount: plant.evergreen ? 0.38 : Math.max(petals, fall * old),
    fresh: plant.evergreen ? 0.25 : 1 - smoothstep(0.88, 1.16, q),
    petals,
  };
}
