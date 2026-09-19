/** Позы остальных жителей. Чистые функции общие для сада и книги. */
import { clamp01, smoothstep } from '../core/rng';
import type { Cat, CatState } from './life';
import type { Mouse, Owl } from './wildlife';
import { easePose } from './animalMotion';

export const CAT_STATES: CatState[] = ['sleep', 'sit', 'walk', 'wash', 'stretch', 'loaf'];
export type CatPosture = Record<CatState, number>;
export const CAT_STRIDE = 0.95;
export function catPosture(state: CatState): CatPosture {
  return {
    sleep: +(state === 'sleep'),
    sit: +(state === 'sit'),
    walk: +(state === 'walk'),
    wash: +(state === 'wash'),
    stretch: +(state === 'stretch'),
    loaf: +(state === 'loaf'),
  };
}
export function updateCatPosture(c: Cat, dt: number): void {
  c.posture ??= catPosture(c.state);
  for (const state of CAT_STATES) c.posture[state] = easePose(c.posture[state], +(c.state === state), dt, 230);
}
export function catMotion(c: Cat, time: number) {
  const weights = c.posture ?? catPosture(c.state);
  const progress = clamp01((c.actionTime ?? time % 2800) / Math.max(1, c.actionDuration ?? 2800));
  return {
    ...weights,
    sit: weights.sit + weights.wash,
    stretch: weights.stretch * Math.sin(Math.PI * progress),
    gait: c.gait ?? ((time * 0.0013) / CAT_STRIDE) * Math.PI * 2,
    breath: Math.sin(time * 0.0016 + c.seed),
  };
}
export const MOUSE_STRIDE = 0.25;
export function mouseSpeed(state: Mouse['state']): number {
  return state === 'flee' ? 0.0017 : state === 'enter' || state === 'leave' ? 0.0009 : state === 'walk' ? 0.00055 : 0;
}
export function owlFlight(o: Owl): boolean {
  return o.state === 'fly-in' || o.state === 'fly-out' || o.state === 'look' || o.state === 'hunt';
}
export function owlAltitude(o: Owl): number {
  if (o.state === 'hunt') return 36 * (1 - smoothstep(0.08, 0.82, o.phase));
  if (o.state === 'fly-out') return 36 + smoothstep(0, 1, o.phase) * 14;
  if (o.state === 'fly-in' || o.state === 'look') return 36 + Math.sin(clamp01(o.phase) * Math.PI) * 8;
  return 36;
}
