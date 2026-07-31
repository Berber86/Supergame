/**
 * Тесты контракта «Малые числа» (карточка №1): потолок ≤ 1000
 * и контракт пейсинга (GDD §3.4).
 */

import { describe, expect, it } from 'vitest';
import {
  clampGold,
  GOLD_CAP,
  isWithinPacing,
  TARGET_CAP_MINUTES,
  TARGET_RATE,
} from './pacing';

describe('контракт «Малые числа»', () => {
  it('потолок равен 1000', () => {
    expect(GOLD_CAP).toBe(1000);
  });

  it('clampGold не даёт превысить потолок', () => {
    expect(clampGold(1500)).toBe(1000);
    expect(clampGold(999.5)).toBeCloseTo(999.5);
    expect(clampGold(-5)).toBe(0);
  });

  it('clampGold отбрасывает NaN и бесконечность', () => {
    expect(clampGold(Number.NaN)).toBe(0);
    expect(clampGold(Number.POSITIVE_INFINITY)).toBe(1000);
  });

  it('целевая ставка выводит на потолок за ~20 минут', () => {
    // 1000 / (20 мин * 60 с) ≈ 0.833 золота/сек
    expect(TARGET_RATE).toBeCloseTo(GOLD_CAP / (TARGET_CAP_MINUTES * 60));
    expect(TARGET_RATE).toBeCloseTo(0.833, 2);
  });

  it('isWithinPacing пропускает ставки в пределах допуска', () => {
    expect(isWithinPacing(TARGET_RATE)).toBe(true);
    expect(isWithinPacing(0)).toBe(true);
    // Сильно завышенная ставка (потолок за ~2 минуты) — нарушение пейсинга.
    expect(isWithinPacing(TARGET_RATE * 10)).toBe(false);
    expect(isWithinPacing(-1)).toBe(false);
  });
});
