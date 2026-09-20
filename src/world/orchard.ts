/** Continuous orchard phenology. A small fixed fruit budget, no stored harvests or per-year history. */
import { annualPhase } from '../core/clock';
import { hash2, smoothstep } from '../core/rng';
export const FRUIT_TREE_TYPES = ['ume', 'nashi', 'peach', 'yuzu'] as const;
export type FruitTree = (typeof FRUIT_TREE_TYPES)[number];
export const isFruitTree = (type: string): type is FruitTree => (FRUIT_TREE_TYPES as readonly string[]).includes(type);
export const ORCHARD_SHAPES = {
  ume: { crownW: 82, crownH: 54, layers: 4, height: 69 },
  nashi: { crownW: 106, crownH: 58, layers: 5, height: 84 },
  peach: { crownW: 80, crownH: 72, layers: 4, height: 78 },
  yuzu: { crownW: 86, crownH: 65, layers: 5, height: 44 },
};
interface Cycle {
  flower: [number, number, number, number];
  grow: [number, number];
  ripe: [number, number];
  drop: [number, number];
  clear: number;
}
/** Phase zero is January 15, matching the garden's four continuous annual anchors. */
const CYCLES: Record<FruitTree, Cycle> = {
  ume: {
    flower: [0.045, 0.105, 0.155, 0.215],
    grow: [0.22, 0.385],
    ripe: [0.35, 0.415],
    drop: [0.405, 0.465],
    clear: 0.55,
  },
  peach: {
    flower: [0.14, 0.205, 0.24, 0.3],
    grow: [0.3, 0.515],
    ripe: [0.475, 0.58],
    drop: [0.55, 0.645],
    clear: 0.72,
  },
  nashi: {
    flower: [0.205, 0.255, 0.28, 0.335],
    grow: [0.325, 0.63],
    ripe: [0.6, 0.735],
    drop: [0.7, 0.795],
    clear: 0.87,
  },
  // This crop crosses New Year: autumn yellow, fruit still hanging among dark leaves in January.
  yuzu: {
    flower: [0.285, 0.335, 0.36, 0.415],
    grow: [0.415, 0.75],
    ripe: [0.69, 0.86],
    drop: [0.99, 1.205],
    clear: 1.29,
  },
};
function phase(seed: number, now: number): number {
  return (annualPhase(now) - ((hash2(seed, 71, 1301) - 0.5) * 12) / 365 + 1) % 1;
}
export function orchardBloom(type: FruitTree, seed: number, now: number): number {
  const p = phase(seed, now),
    [a, b, c, d] = CYCLES[type].flower;
  return smoothstep(a, b, p) * (1 - smoothstep(c, d, p));
}
/** Blossom residue follows each tree's actual bloom, independent of the previous autumn's leaves. */
export function orchardPetals(type: FruitTree, seed: number, now: number): number {
  const p = phase(seed, now),
    [, , c, d] = CYCLES[type].flower;
  return smoothstep(c - 0.015, d + 0.015, p) * (1 - smoothstep(d + 0.025, d + 0.105, p));
}
export function orchardFlowerTint(type: FruitTree, seed: number) {
  return type === 'ume'
    ? hash2(seed, 2, 1901) > 0.5
      ? { r: 239, g: 159, b: 174 }
      : { r: 246, g: 223, b: 212 }
    : type === 'peach'
      ? { r: 240, g: 151, b: 188 }
      : { r: 246, g: 241, b: 217 };
}
export function fruitYear(type: FruitTree, seed: number, now: number, index = 0) {
  const c = CYCLES[type],
    p = phase(seed, now);
  const q = type === 'yuzu' && p < c.grow[0] ? p + 1 : p;
  const stagger = (hash2(index, seed, 1801) - 0.5) * 0.032;
  const size = smoothstep(c.grow[0], c.grow[1], q);
  const ripe = smoothstep(c.ripe[0] + stagger, c.ripe[1] + stagger, q);
  const dropped = smoothstep(c.drop[0] + stagger, c.drop[1] + stagger, q);
  const age = smoothstep(c.drop[0] + 0.025, c.clear, q);
  const gone = smoothstep(c.drop[1] + 0.015, c.clear, q);
  return {
    size,
    ripe,
    retained: size * (1 - dropped),
    falling: 4 * dropped * (1 - dropped),
    ground: dropped * (1 - gone),
    age,
  };
}
/** One occasional live fall per tree, evaluated from animation time, never stored particles.
 * The annual model supplies the season; milliseconds supply normal-speed gravity in both clock modes.
 */
export function fruitDropFrame(type: FruitTree, seed: number, now: number, time: number) {
  const period = type === 'yuzu' ? 32000 : 18000;
  const cursor = (time + hash2(seed, 9, 1823) * period) / period;
  const cycle = Math.floor(cursor),
    elapsed = (cursor - cycle) * period;
  const index = Math.floor(hash2(cycle, seed, 1831) * 9);
  const fruit = fruitYear(type, seed, now, index);
  if (elapsed > 1500 || fruit.falling < 0.08 || hash2(cycle, seed, 1837) > fruit.falling * 0.8) return null;
  return { index, progress: elapsed / 1500, ripe: fruit.ripe };
}
