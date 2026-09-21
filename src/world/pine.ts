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

/** Длительность роста сосны в обычном саду: 3 игровых дня = 72 часа реального времени. */
export const PINE_GROW_NORMAL_MS = 72 * 60 * 60 * 1000;
/** Длительность роста сосны в растущем саду: 3 игровых дня = 15 часов реального времени (день = 5 ч). */
export const PINE_GROW_GARDEN_MS = 15 * 60 * 60 * 1000;

export type PineStageId = 'sapling' | 'young' | 'maturing' | 'adult';

export interface PineStageInfo {
  id: PineStageId;
  name: string;
  dayLabel: string;
  description: string;
  minG: number;
  maxG: number;
}

export const PINE_STAGES: readonly PineStageInfo[] = [
  {
    id: 'sapling',
    name: 'Саженец',
    dayLabel: 'День 1',
    description:
      'Нежный зелёный росток с верхушечной свечкой и первой мутовкой мягкой хвои. Стволик гладкий, корневая шейка только закрепляется в грунте.',
    minG: 0,
    maxG: 0.33,
  },
  {
    id: 'young',
    name: 'Молодое деревце',
    dayLabel: 'День 2',
    description:
      'Ствол набирает силу и начинает деревенеть. Появляется первый ярус боковых ветвей, начинает проступать будущий силуэт.',
    minG: 0.33,
    maxG: 0.67,
  },
  {
    id: 'maturing',
    name: 'Формирование кроны',
    dayLabel: 'День 3',
    description:
      'Ветви ярусами раскрываются в стороны. Кора покрывается характерными чешуйками, крона обретает выразительную природную форму.',
    minG: 0.67,
    maxG: 0.99,
  },
  {
    id: 'adult',
    name: 'Взрослая сосна',
    dayLabel: 'Зрелость',
    description:
      'Могучее вечнозелёное дерево с глубоко растрескавшейся охристой корой, густыми хвойными лапами и смолистыми шишками.',
    minG: 1,
    maxG: 1,
  },
] as const;

export function pineStage(g: number): PineStageInfo {
  const clamped = clamp01(g);
  if (clamped >= 1) return PINE_STAGES[3];
  if (clamped >= 0.67) return PINE_STAGES[2];
  if (clamped >= 0.33) return PINE_STAGES[1];
  return PINE_STAGES[0];
}

/**
 * Вычисляет стадию роста сосны 0..1 по времени посадки и текущему моменту.
 * В обычных садах сосна вырастает за 72 часа (3 игровых дня),
 * в растущем саду — за 15 часов (3 игровых дня по 5 часов).
 * Старые деревья (старые сохранения, пресеты или время вышло) возвращают 1.
 */
export function calculatePineGrowth(planted: number, now: number, isGrowingGarden: boolean): number {
  if (!Number.isFinite(planted) || planted <= 0) return 1;
  const duration = isGrowingGarden ? PINE_GROW_GARDEN_MS : PINE_GROW_NORMAL_MS;
  const elapsed = now - planted;
  if (elapsed >= duration) return 1;
  if (elapsed <= 0) return 0;
  return clamp01(elapsed / duration);
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
