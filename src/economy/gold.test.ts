/**
 * Тесты экономики золота: клик, пассивный доход слуг, множители зданий.
 */

import { describe, expect, it } from 'vitest';
import { applyClick, applyPassive, computeIncome } from './gold';
import type { GameState } from '../core/types';

const SERVANTS = [
  { id: 'a', name: 'Слуга A', desc: '', baseIncome: 0.1, cost: 10 },
  { id: 'b', name: 'Слуга B', desc: '', baseIncome: 0.5, cost: 50 },
];

const BUILDINGS = [
  { id: 'f', name: 'Кузница', desc: '', multiplier: 0.5, cost: 100 },
];

function stateWith(partial: Partial<GameState> = {}): GameState {
  return {
    gold: 0,
    servants: [],
    buildings: [],
    relics: [],
    kingdomProgress: {},
    dragonLevel: 1,
    prestige: 0,
    achievements: [],
    journal: [],
    raid: { kingdomId: null, stage: 0, relics: [] },
    lastSavedAt: 0,
    ...partial,
  };
}

describe('экономика золота', () => {
  it('клик даёт 1 золото без слуг и зданий', () => {
    const state = stateWith();
    const rates = computeIncome(state, SERVANTS, BUILDINGS);
    expect(rates.perClick).toBe(1);
    expect(applyClick(state, rates)).toBe(1);
  });

  it('пассивный доход суммирует базовый доход слуг', () => {
    const state = stateWith({
      servants: [
        { id: 'a', count: 2 },
        { id: 'b', count: 1 },
      ],
    });
    const rates = computeIncome(state, SERVANTS, BUILDINGS);
    // 0.1*2 + 0.5*1 = 0.7
    expect(rates.perSecond).toBeCloseTo(0.7);
  });

  it('здание умножает доход всех слуг', () => {
    const state = stateWith({
      servants: [{ id: 'b', count: 1 }],
      buildings: [{ id: 'f', level: 2 }],
    });
    const rates = computeIncome(state, SERVANTS, BUILDINGS);
    // 0.5 * (1 + 0.5*2) = 1.0
    expect(rates.perSecond).toBeCloseTo(1.0);
  });

  it('пассивный доход за секунды добавляется пропорционально', () => {
    const state = stateWith({ servants: [{ id: 'b', count: 1 }] });
    const rates = computeIncome(state, SERVANTS, BUILDINGS);
    expect(applyPassive(state, rates, 10)).toBeCloseTo(5);
  });

  it('неизвестный слуг/здание игнорируется', () => {
    const state = stateWith({
      servants: [{ id: 'нет-такого', count: 999 }],
      buildings: [{ id: 'нет-такого', level: 5 }],
    });
    const rates = computeIncome(state, SERVANTS, BUILDINGS);
    expect(rates.perSecond).toBe(0);
  });
});
