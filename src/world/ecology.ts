/** A stylised temperate garden, not local weather: shared continuous ecological year.
 * March is thaw/dormancy, April wakes gradually, summer has the busiest wildlife.
 * Calendar labels and artificial lamps never substitute for warmth or real flowers.
 */
import { annualPhase, type TimeState } from '../core/clock';
import { clamp01, smoothstep } from '../core/rng';
import { flowerYear, winterYear } from './annualEnvironment';
import { plantYear } from './phenology';
import type { WeatherState } from './weatherState';

function pulse(p: number, a: number, b: number, c: number, d: number): number {
  return smoothstep(a, b, p) * (1 - smoothstep(c, d, p));
}
export function ecologyYear(now: number) {
  const p = annualPhase(now),
    winter = winterYear(now);
  return {
    green: pulse(p, 0.19, 0.25, 0.74, 0.93),
    warmth: pulse(p, 0.2, 0.42, 0.64, 0.86),
    cold: Math.max(winter.snow, winter.ice),
    butterflies: pulse(p, 0.245, 0.38, 0.68, 0.82),
    bees: pulse(p, 0.22, 0.32, 0.68, 0.82),
    dragonflies: pulse(p, 0.32, 0.45, 0.67, 0.81),
    frogs: pulse(p, 0.215, 0.31, 0.72, 0.86) * (1 - winter.ice),
    fireflies: pulse(p, 0.36, 0.46, 0.62, 0.7),
    moths: pulse(p, 0.27, 0.4, 0.68, 0.82),
    turtle: pulse(p, 0.26, 0.4, 0.66, 0.81) * (1 - winter.ice),
    lizard: pulse(p, 0.235, 0.35, 0.7, 0.84) * (1 - winter.ice),
    hedgehog: pulse(p, 0.23, 0.34, 0.74, 0.87),
  };
}
export function wildlifeActivity(t: TimeState, weather?: WeatherState | null, wind = 0.5) {
  const year = ecologyYear(t.now);
  const rain = weather?.rain ?? 0,
    snow = weather?.snow ?? 0;
  const flying = (1 - smoothstep(0.03, 0.3, rain)) * (1 - snow) * (1 - smoothstep(0.8, 1.8, wind));
  const day = smoothstep(0.35, 0.6, t.daylight),
    night = 1 - smoothstep(0.12, 0.3, t.daylight);
  return {
    butterflies: year.butterflies * flying * day,
    bees: year.bees * flying * day,
    dragonflies: year.dragonflies * flying * day,
    fireflies: year.fireflies * flying * night,
    moths: year.moths * flying * night,
    frogs: year.frogs * (1 - snow),
    lizard:
      year.lizard *
      day *
      smoothstep(7.5, 9.5, t.dayT * 24) *
      (1 - smoothstep(16.5, 18.5, t.dayT * 24)) *
      (1 - smoothstep(0.08, 0.3, rain)) *
      (1 - snow),
    turtle: year.turtle * day * (1 - smoothstep(0.15, 0.4, rain)) * (1 - snow),
    hedgehog: year.hedgehog * night * (1 - snow),
  };
}
export function nectarBloom(type: string, seed: number, now: number): number {
  return type === 'sakura' || type === 'wisteria'
    ? plantYear(type, seed, now).bloom
    : flowerYear(type, seed, now).bloom;
}
export function treeFallActivity(type: string, seed: number, now: number): { petals: number; leaves: number } {
  const state = plantYear(type, seed, now);
  return {
    petals: type === 'sakura' ? state.bloom * smoothstep(0.245, 0.28, state.phase) : 0,
    leaves: state.evergreen ? 0 : 4 * state.leafFall * (1 - state.leafFall),
  };
}
/** Display text follows development, not a promise of petals on every March morning. */
export function ecologyDescription(now: number): string {
  const p = annualPhase(now),
    year = ecologyYear(now);
  if (year.cold > 0.75) return 'сад отдыхает';
  if (year.cold > 0.15) return p < 0.5 ? 'время проталин' : 'первые морозы';
  if (p < 0.23) return 'почки на ветвях';
  if (p < 0.36) return 'сад просыпается';
  if (p < 0.65) return 'густая листва';
  if (p < 0.77) return 'золотится листва';
  return 'редеют кроны';
}
/** Exposed liquid effects fade under snow instead of switching off on December 1. */
export function liquidExposure(now: number): number {
  return clamp01(1 - smoothstep(0.05, 0.65, winterYear(now).snow));
}
