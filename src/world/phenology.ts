/** Annual plant development. Pure, continuous curves; no saved growth state, no month sprites. */
import { isFruitTree, orchardBloom } from './orchard';
import { annualPhase } from '../core/clock';
import { clamp01, hash2, smoothstep } from '../core/rng';

export interface PlantYear {
  phase: number;
  bud: number;
  leafOut: number;
  maturity: number;
  autumn: number;
  leafFall: number;
  foliage: number;
  bloom: number;
  winterTone: number;
  evergreen: boolean;
}
interface Profile {
  bud: [number, number];
  out: [number, number];
  mature: [number, number];
  color: [number, number];
  fall: [number, number];
}
const PROFILES: Record<string, Profile> = {
  ume: { bud: [0.025, 0.09], out: [0.185, 0.29], mature: [0.25, 0.4], color: [0.63, 0.78], fall: [0.745, 0.89] },
  nashi: { bud: [0.12, 0.21], out: [0.21, 0.32], mature: [0.28, 0.45], color: [0.66, 0.8], fall: [0.78, 0.915] },
  peach: { bud: [0.095, 0.17], out: [0.19, 0.31], mature: [0.26, 0.43], color: [0.62, 0.78], fall: [0.75, 0.89] },
  maple: { bud: [0.075, 0.185], out: [0.12, 0.275], mature: [0.2, 0.44], color: [0.6, 0.78], fall: [0.745, 0.88] },
  sakura: { bud: [0.08, 0.21], out: [0.235, 0.365], mature: [0.28, 0.46], color: [0.6, 0.795], fall: [0.74, 0.885] },
  ginkgo: { bud: [0.115, 0.225], out: [0.15, 0.305], mature: [0.235, 0.46], color: [0.675, 0.79], fall: [0.77, 0.875] },
  willow: { bud: [0.055, 0.16], out: [0.085, 0.25], mature: [0.18, 0.405], color: [0.66, 0.845], fall: [0.78, 0.935] },
  persimmon: { bud: [0.12, 0.23], out: [0.17, 0.32], mature: [0.25, 0.46], color: [0.625, 0.8], fall: [0.765, 0.915] },
  wisteria: { bud: [0.09, 0.205], out: [0.155, 0.3], mature: [0.25, 0.45], color: [0.655, 0.81], fall: [0.76, 0.89] },
};
const EVERGREEN = new Set(['pine', 'bamboo', 'hedge', 'azalea', 'camellia', 'yuzu']);
export const ANNUAL_CROWN_TYPES = new Set([...Object.keys(PROFILES), ...EVERGREEN]);
export function plantYear(type: string, seed: number, now: number): PlantYear {
  const offset = ((hash2(seed, 71, 1301) - 0.5) * 12) / 365; // fixed ±six-day individuality, not random every spring
  const phase = (annualPhase(now) - offset + 1) % 1;
  const winterTone = 1 - smoothstep(0, 0.25, Math.min(phase, 1 - phase));
  const evergreen = EVERGREEN.has(type);
  const p = PROFILES[type] ?? PROFILES.maple;
  const leafOut = evergreen ? 1 : smoothstep(...p.out, phase);
  const leafFall = evergreen ? 0 : smoothstep(...p.fall, phase);
  const maturity = evergreen ? 1 : smoothstep(...p.mature, phase);
  const bud = smoothstep(...p.bud, phase) * (1 - smoothstep(p.out[0], p.out[1] + 0.025, phase));
  const bloom = isFruitTree(type)
    ? orchardBloom(type, seed, now)
    : type === 'sakura'
      ? smoothstep(0.19, 0.245, phase) * (1 - smoothstep(0.265, 0.36, phase))
      : type === 'wisteria'
        ? smoothstep(0.17, 0.265, phase) * (1 - smoothstep(0.31, 0.43, phase))
        : 0;
  return {
    phase,
    bud,
    leafOut,
    maturity,
    autumn: evergreen ? 0 : smoothstep(...p.color, phase),
    leafFall,
    foliage: leafOut * (1 - leafFall),
    bloom,
    winterTone,
    evergreen,
  };
}
/** A stable leaf group opens, colours and sheds on its own schedule, on the same twig every year. */
export function leafGroup(
  state: PlantYear,
  seed: number,
  index: number,
): { growth: number; retained: number; size: number; color: number } {
  const r = hash2(index, seed, 1327),
    c = hash2(index, seed, 1361);
  const growth = state.evergreen ? 1 : smoothstep(r * 0.28, 0.52 + r * 0.43, state.leafOut);
  const retained = state.evergreen ? 1 : 1 - smoothstep(0.04 + r * 0.48, 0.45 + r * 0.5, state.leafFall);
  return {
    growth,
    retained,
    size: Math.sqrt(growth) * (0.16 + 0.84 * Math.sqrt(state.maturity)) * (0.25 + 0.75 * Math.sqrt(retained)),
    color: smoothstep(0.04 + c * 0.68, 0.25 + c * 0.72, state.autumn),
  };
}
/** Roughly 17-hour render revisions, staggered by seed. The model itself is not quantised.
 * Existing bounded sprite/measurement caches hold only recent revisions, never a year's worth of images.
 */
// Annual revisions now also cover seasonal flowers and surfaces that collect snow.
const ANNUAL_SPRITE_TYPES = new Set([
  ...ANNUAL_CROWN_TYPES,
  'iris',
  'lily',
  'lotus',
  'lilypad',
  'rock_mid',
  'rock_big',
  'rock_trio',
  'moss_clump',
  'grass_tuft',
  'fern',
  'reed',
  'horsetail',
  'feeder',
  'beehive',
  'tea_house',
  'tiny_house',
  'shed',
  'pavilion',
  '__surface',
]);
export function crownCacheKey(type: string, seed: number, now: number): string {
  return ANNUAL_SPRITE_TYPES.has(type) ? String(Math.floor(annualPhase(now) * 512 + hash2(seed, 7, 1381)) % 512) : '';
}
/** Canonical date for a cached revision, independent of which instant first filled that bucket.
 * Only annual development uses this date: callers keep actual daylight/daily flower opening.
 */
export function crownCacheTime(type: string, seed: number, now: number): number {
  if (!ANNUAL_SPRITE_TYPES.has(type)) return now;
  const stagger = hash2(seed, 7, 1381),
    phase = (Math.floor(annualPhase(now) * 512 + stagger) - stagger + 0.5) / 512;
  const year = new Date(now).getFullYear(),
    cycleYear = now < new Date(year, 0, 15).getTime() ? year - 1 : year;
  const quarter = Math.floor(phase * 4),
    start = new Date(cycleYear, quarter * 3, 15).getTime(),
    end = new Date(cycleYear, quarter * 3 + 3, 15).getTime();
  return start + (phase * 4 - quarter) * (end - start);
}
/** Four anchor colours, blended over entire quarters rather than switched at month boundaries. */
export function crownAnchorBlend(now: number): { from: number; to: number; amount: number } {
  const p = annualPhase(now) * 4,
    from = Math.floor(p);
  return { from, to: (from + 1) % 4, amount: smoothstep(0, 1, clamp01(p - from)) };
}
