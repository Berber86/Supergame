/** Чистые позы: одинаковые часы и фазы для сада, энциклопедии и тестов. */
import { clamp01, lerp, smoothstep } from '../core/rng';
import type { Hedgehog, Heron, Squirrel } from './wildlife';

export const HERON_STRIKE_MS = 900;
export const HERON_WADE_SPEED = 0.00022;
export const HERON_STRIDE = 0.7;
export const HEDGEHOG_STRIDE = 0.28;
export function hedgehogSpeed(state: Hedgehog['state']): number {
  return state === 'enter' ? 0.00038 : state === 'leave' ? 0.00042 : state === 'walk' ? 0.00025 : 0;
}
export function squirrelSpeed(state: Squirrel['state']): number {
  return state === 'enter'
    ? 0.00115
    : state === 'jump'
      ? 0.0013
      : state === 'flee'
        ? 0.002
        : state === 'leave'
          ? 0.0014
          : 0;
}
export function squirrelStride(state: Squirrel['state']): number {
  return state === 'flee' ? 0.85 : 0.78;
}

export function heronStrike(timer: number): number {
  const p = clamp01(1 - timer / HERON_STRIKE_MS);
  return smoothstep(0.14, 0.44, p) * (1 - smoothstep(0.52, 1, p));
}

export function heronFlight(h: Heron): number {
  if (h.state === 'fly-in') return 1 - smoothstep(0.48, 1, h.phase);
  if (h.state === 'fly-out') return smoothstep(0, 0.28, h.phase);
  return 0;
}

export function hedgehogPose(h: Hedgehog, time: number) {
  const roll = clamp01(h.roll ?? (h.state === 'curl' ? 1 : 0));
  const moving = h.state === 'enter' || h.state === 'walk' || h.state === 'leave';
  const gait = h.gait ?? ((time * hedgehogSpeed(h.state)) / HEDGEHOG_STRIDE) * Math.PI * 2;
  const motion = h.motion ?? (moving ? 1 : 0);
  return {
    roll,
    gait,
    motion: motion * (1 - roll),
    rx: lerp(8.4, 6.6, roll),
    ry: lerp(5.4, 6.3, roll),
    cy: lerp(-6.4, -6.9, roll),
    dip:
      h.state === 'forage'
        ? 0.22 + Math.sin(time * 0.006) * 0.12
        : h.state === 'sniff'
          ? -0.16 + Math.sin(time * 0.009) * 0.06
          : 0,
  };
}

export function squirrelUpright(s: Squirrel): number {
  return s.state === 'look' ? 1 : s.state === 'forage' ? (s.hasNut ? 0.85 : 0.2) : s.state === 'cache' ? 0.12 : 0;
}

export function squirrelPose(s: Squirrel, time: number) {
  const moving = ['enter', 'jump', 'flee', 'leave'].includes(s.state);
  const motion = s.motion ?? (moving ? 1 : 0);
  const gait = s.gait ?? ((time * squirrelSpeed(s.state)) / squirrelStride(s.state)) * Math.PI * 2;
  const arc = Math.max(0, Math.sin(gait));
  const land = Math.max(0, -Math.sin(gait));
  const cache = s.state === 'cache' ? clamp01((s.actionTime ?? time) / Math.max(1, s.actionDuration ?? 3000)) : 0;
  return {
    gait,
    motion,
    upright: clamp01(s.upright ?? squirrelUpright(s)),
    lift: arc * motion * (s.state === 'flee' ? 5.5 : 3.8),
    stretch: motion * (arc * 0.13 - land * 0.09),
    cache,
    // Наклон, укладка ореха, засыпание лапами, возвращение в исходную позу.
    dig: smoothstep(0.08, 0.3, cache) * (1 - smoothstep(0.84, 1, cache)),
  };
}
