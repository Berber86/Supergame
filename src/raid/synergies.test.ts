/**
 * Тесты синергий реликвий (S6).
 */

import { describe, expect, it } from 'vitest';
import {
  countFamilies,
  getActiveSynergies,
  getDamageMultiplier,
  getLootMultiplier,
  listAllSynergyNames,
} from './synergies';

describe('синергии реликвий', () => {
  it('без реликвий синергий нет, множители равны 1', () => {
    const synergies = getActiveSynergies([]);
    expect(synergies).toEqual([]);
    expect(getDamageMultiplier(synergies)).toBe(1);
    expect(getLootMultiplier(synergies)).toBe(1);
  });

  it('одна реликвия семейства не активирует комбо', () => {
    expect(getActiveSynergies(['ember'])).toEqual([]);
  });

  it('две реликвии огня дают «Пылающий след»', () => {
    const synergies = getActiveSynergies(['ember', 'lava-lamp']);
    expect(synergies.map((s) => s.id)).toEqual(['fire-combo']);
    expect(getDamageMultiplier(synergies)).toBeCloseTo(1.25);
    expect(getLootMultiplier(synergies)).toBe(1);
  });

  it('четыре реликвии огня заменяют комбо на усиленное (без дублей)', () => {
    const synergies = getActiveSynergies(['ember', 'lava-lamp', 'fireworks', 'dragon-tea']);
    expect(synergies.map((s) => s.id)).toEqual(['fire-great']);
    expect(getDamageMultiplier(synergies)).toBeCloseTo(1.6);
  });

  it('жадность работает на добычу, а не на урон', () => {
    const synergies = getActiveSynergies(['golden-tooth', 'magnet']);
    expect(synergies.map((s) => s.id)).toEqual(['greed-combo']);
    expect(getDamageMultiplier(synergies)).toBe(1);
    expect(getLootMultiplier(synergies)).toBeCloseTo(1.3);
  });

  it('пара из разных семейств даёт именованную синергию', () => {
    const synergies = getActiveSynergies(['ember', 'golden-tooth']);
    expect(synergies.map((s) => s.id)).toEqual(['hot-coin']);
    expect(getDamageMultiplier(synergies)).toBeCloseTo(1.15);
    expect(getLootMultiplier(synergies)).toBeCloseTo(1.15);
  });

  it('три семейства сразу активируют все три пары', () => {
    const ids = getActiveSynergies(['ember', 'golden-tooth', 'tent']).map((s) => s.id);
    expect(ids).toContain('hot-coin');
    expect(ids).toContain('mercenary-contract');
    expect(ids).toContain('torch-brigade');
  });

  it('countFamilies считает по семействам и игнорирует мусор', () => {
    expect(countFamilies(['ember', 'lava-lamp', 'golden-tooth', 'no-such-relic'])).toEqual({
      fire: 2,
      greed: 1,
      ally: 0,
    });
  });

  it('в игре есть 9 именованных синергий (6 семейных + 3 парных)', () => {
    expect(listAllSynergyNames()).toHaveLength(9);
    expect(new Set(listAllSynergyNames()).size).toBe(9);
  });
});
