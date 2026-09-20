/** Permanent pine habit. Derived only from the existing object seed; nothing new is saved. */
import { clamp01, hash2, lerp } from '../core/rng';

export const PINE_FORMS = ['compact', 'tall', 'windswept', 'umbrella', 'forked'] as const;
export type PineForm = (typeof PINE_FORMS)[number];
export const PINE_FORM_NAMES: Record<PineForm, string> = {
  compact: 'Приземистая',
  tall: 'Стройная',
  windswept: 'Склонённая ветром',
  umbrella: 'Зонтичная',
  forked: 'Раздвоенная',
};
export interface PineProfile {
  form: PineForm;
  height: number;
  spread: number;
  trunkWidth: number;
  lean: number;
  bow: number;
  tiers: number;
  crownStart: number;
  taper: number;
  foliage: number;
}

const FORMS: Record<PineForm, [number, number, number, number, number, number, number]> = {
  // height, bough span, base radius, tier count, clear bole, crown taper, needle-pad size
  compact: [104, 46, 9.8, 3, 0.29, 0.42, 1.06],
  tall: [205, 35, 7.4, 4, 0.39, 0.58, 0.84],
  windswept: [148, 48, 9.5, 3, 0.38, 0.33, 0.97],
  umbrella: [143, 64, 11, 3, 0.61, 0.12, 1.12],
  forked: [179, 40, 10.5, 3, 0.35, 0.4, 0.91],
};

export function pineGrowth(g: number): number {
  return lerp(0.2, 1, Math.pow(clamp01(g), 0.7));
}

export function pineProfile(seed: number): PineProfile {
  const form = PINE_FORMS[Math.floor(hash2(seed, 17, 3109) * PINE_FORMS.length)];
  const [height, spread, trunkWidth, tiers, crownStart, taper, foliage] = FORMS[form];
  return {
    form,
    height: height * (0.91 + hash2(seed, 3, 3119) * 0.18),
    spread: spread * (0.84 + hash2(seed, 5, 3121) * 0.3),
    trunkWidth: trunkWidth * (0.88 + hash2(seed, 7, 3137) * 0.22),
    lean:
      form === 'windswept'
        ? 0.21 + hash2(seed, 9, 3163) * 0.1
        : (hash2(seed, 9, 3163) - 0.5) * (form === 'tall' ? 0.07 : 0.2),
    bow: (hash2(seed, 11, 3167) - 0.3) * (form === 'tall' ? 0.055 : 0.24),
    tiers: tiers + (form === 'tall' && hash2(seed, 13, 3169) > 0.45 ? 1 : 0),
    crownStart: crownStart + (hash2(seed, 15, 3181) - 0.5) * 0.05,
    taper,
    foliage,
  };
}
