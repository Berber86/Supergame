/** Stateless stone anatomy and material response. No erosion timers or new save fields. */
import { clamp01, hash1, hash2 } from '../core/rng';
export const STONE_TYPES = new Set(['rock_big', 'rock_mid', 'rock_trio', 'step_stone', 'water_stone']);
export interface StonePoint {
  x: number;
  y: number;
}
export interface StoneShape {
  base: StonePoint[];
  cap: StonePoint[];
  height: number;
  width: number;
  family: number;
}
/** Compact, angular or bedded; the same seed keeps its mineral identity when rotated. */
export function stoneShape(seed: number, scale = 1, rot = 0, flat = false): StoneShape {
  const family = Math.floor(hash2(seed, 3, 2501) * 3);
  const width = (22 + hash2(seed, 5, 2503) * 6) * scale;
  const height = (flat ? 3.2 : (23 + hash2(seed, 7, 2509) * 7) * (family === 2 ? 0.82 : 1)) * scale;
  const base: StonePoint[] = [],
    cap: StonePoint[] = [];
  const angle = (((rot % 4) + 4) % 4) * Math.PI * 0.5;
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2;
    const radius = 0.85 + hash2(seed, i, 2511) * 0.15;
    const u = Math.cos(a) * width * radius,
      v = Math.sin(a) * width * radius * (0.73 + hash2(seed, 9, 2517) * 0.23);
    const x = u * Math.cos(angle) - v * Math.sin(angle),
      y = (u * Math.sin(angle) + v * Math.cos(angle)) * 0.48;
    base.push({ x, y });
    const taper = flat ? 0.96 : 0.64 + hash2(seed, i, 2521) * 0.28;
    cap.push({
      x: x * taper + (flat ? 0 : (hash2(seed, 11, 2527) - 0.5) * width * 0.25 * Math.cos(angle)),
      y:
        y * taper +
        (flat ? 0 : (hash2(seed, 11, 2527) - 0.5) * width * 0.25 * Math.sin(angle) * 0.48) -
        height * (flat ? 1 : 0.58 - Math.sin(a) * 0.22 + (hash2(seed, i, 2531) - 0.5) * 0.28),
    });
  }
  return { base, cap, height, width, family };
}
export function stoneResponse(seed: number, wetness: number, habitat = 0.35) {
  const porosity = 0.25 + hash2(seed, 13, 2539) * 0.6;
  const wet = clamp01(wetness),
    h = clamp01(habitat);
  return {
    top: Math.pow(wet, 1.5 + porosity),
    crevice: Math.pow(wet, 0.42 + porosity * 0.25),
    foot: Math.max(Math.pow(wet, 0.65), h * 0.18),
    moss: (0.035 + h * 0.42) * (0.65 + hash2(seed, 17, 2543) * 0.35),
    porosity,
  };
}
/** Seed-scaled cap height, shared with basking animals instead of an unrelated height table. */
export function stonePerchHeight(type: string, seed: number, rot = 0): number {
  const scale = type === 'rock_big' ? 1.55 : type === 'rock_mid' ? 0.95 : type === 'rock_trio' ? 0.85 : 0.6;
  const shape = stoneShape(seed, scale, rot, type === 'step_stone');
  // Intersect the actual upper plane at the centre of the footprint. Rotating a sloped
  // cap changes its screen height; a fixed lift leaves animals floating or buried.
  const ys: number[] = [];
  for (let i = 0; i < shape.cap.length; i++) {
    const a = shape.cap[i],
      b = shape.cap[(i + 1) % shape.cap.length];
    if ((a.x <= 0 && b.x >= 0) || (b.x <= 0 && a.x >= 0)) {
      const t = Math.abs(b.x - a.x) < 1e-8 ? 0.5 : -a.x / (b.x - a.x);
      ys.push(a.y + (b.y - a.y) * t);
    }
  }
  const height = ys.length ? -(Math.min(...ys) * 0.65 + Math.max(...ys) * 0.35) : shape.height * 0.6;
  const jitter = 0.88 + hash1(seed, 29) * 0.24;
  return height * (type === 'step_stone' ? 0.92 + (jitter - 0.88) * 0.5 : jitter);
}
