/** Continuous pose channels: independent of route progress and render frame rate. */
import { lerp } from '../core/rng';
import type { Deer, Turtle } from './wildlife';

export function easePose(value: number, target: number, dt: number, duration: number): number {
  return lerp(value, target, 1 - Math.exp(-Math.max(0, dt) / duration));
}

/** Constant world speed, distance-driven feet and screen-space facing. */
export function advanceAnimal(a: Deer | Turtle, dt: number, speed: number, stride: number): void {
  if (!a.target) return;
  a.from ??= { x: a.tx, y: a.ty };
  const distance = Math.hypot(a.target.x - a.from.x, a.target.y - a.from.y);
  const phase = Math.min(1, a.phase + (dt * speed) / Math.max(0.001, distance));
  a.gait = (a.gait ?? 0) + ((phase - a.phase) * distance * Math.PI * 2) / stride;
  const screenDx = a.target.x - a.from.x - (a.target.y - a.from.y);
  if (Math.abs(screenDx) > 0.01) a.facing = screenDx > 0 ? 1 : -1;
  a.phase = phase;
  a.tx = lerp(a.from.x, a.target.x, phase);
  a.ty = lerp(a.from.y, a.target.y, phase);
}
