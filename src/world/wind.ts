/** One travelling pressure field. Animation milliseconds, not the accelerated calendar; no saved history. */
import { GRID } from '../core/iso';
import { clamp, hash2 } from '../core/rng';
export interface Gust {
  pos: number;
  strength: number;
  dx: number;
  dy: number;
  width: number;
}
export interface WindVector {
  x: number;
  y: number;
  strength: number;
  screenX: number;
  screenY: number;
}
export type WindSampler = (x: number, y: number, lag?: number) => WindVector;
export const CALM: WindVector = { x: 0, y: 0, strength: 0, screenX: 0, screenY: 0 };
export const WIND_PERIOD = 48000;
/** A front starts beyond the UPWIND edge even when its direction has negative components. */
export function windFronts(time: number, climate = 1): Gust[] {
  if (!Number.isFinite(time) || time < 0) return [];
  const cycle = Math.floor(time / WIND_PERIOD),
    fronts: Gust[] = [];
  for (let k = Math.max(0, cycle - 1); k <= cycle; k++) {
    const age = time - k * WIND_PERIOD - 5000 - hash2(k, 17, 2201) * 4000;
    const duration = 24000 + hash2(k, 17, 2203) * 4000;
    if (age < 0 || age > duration) continue;
    const angle = hash2(k, 17, 2207) * Math.PI * 2,
      dx = Math.cos(angle),
      dy = Math.sin(angle);
    const width = 6 + hash2(k, 17, 2213) * 3;
    const min = GRID * (Math.min(0, dx) + Math.min(0, dy)),
      max = GRID * (Math.max(0, dx) + Math.max(0, dy));
    fronts.push({
      pos: min - width + ((max - min + width * 2) * age) / duration,
      dx,
      dy,
      width,
      strength: (0.85 + hash2(k, 17, 2219) * 0.5) * clamp(climate, 0, 1.7),
    });
  }
  return fronts;
}
export function sampleFronts(fronts: readonly Gust[], x: number, y: number): WindVector {
  let vx = 0,
    vy = 0;
  for (const f of fronts) {
    const d = Math.abs(x * f.dx + y * f.dy - f.pos) / f.width;
    if (d >= 1) continue;
    const pressure = Math.cos(d * Math.PI * 0.5) ** 2 * f.strength;
    vx += f.dx * pressure;
    vy += f.dy * pressure;
  }
  return {
    x: vx,
    y: vy,
    strength: Math.hypot(vx, vy),
    screenX: (vx - vy) * Math.SQRT1_2,
    screenY: (vx + vy) * Math.SQRT1_2 * 0.5,
  };
}
/** Lag samples the same moving front, not a separate random oscillator per species. */
export function makeWindSampler(time: number, climate = 1): WindSampler {
  // Only a handful of material response delays per frame; released with this frame.
  const frames = new Map<number, Gust[]>();
  return (x, y, lag = 0) => {
    const delay = clamp(lag, 0, 1800);
    let fronts = frames.get(delay);
    if (!fronts) {
      fronts = windFronts(Math.max(0, time - delay), climate);
      if (frames.size < 16) frames.set(delay, fronts);
    }
    return sampleFronts(fronts, x, y);
  };
}
