/**
 * Тесты покупок: найм слуг, апгрейд зданий, рост цен.
 */

import { describe, expect, it } from 'vitest';
import { buyBuilding, buyServant, getBuildingCost, getServantCost } from './purchases';
import type { GameState } from '../core/types';

const SERVANTS = [
  { id: 'gnome', name: 'Гном', desc: '', baseIncome: 0.1, cost: 15 },
  { id: 'kobold', name: 'Кобольд', desc: '', baseIncome: 0.2, cost: 60 },
];

const BUILDINGS = [
  { id: 'forge', name: 'Кузница', desc: '', multiplier: 0.5, cost: 150 },
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
    lastSavedAt: Date.now(),
    ...partial,
  };
}

describe('покупки', () => {
  it('getServantCost растёт по формуле 1.15^n', () => {
    const def = SERVANTS[0];
    expect(getServantCost(def, 0)).toBe(15);
    expect(getServantCost(def, 1)).toBe(17); // floor(15 * 1.15)
    expect(getServantCost(def, 2)).toBe(19);
  });

  it('getBuildingCost растёт по формуле 1.15^n', () => {
    const def = BUILDINGS[0];
    expect(getBuildingCost(def, 0)).toBe(150);
    expect(getBuildingCost(def, 1)).toBe(172); // floor(150*1.15)
  });

  it('покупка слуги отнимает золото и добавляет count', () => {
    const state = stateWith({ gold: 20 });
    const ok = buyServant(state, 'gnome', SERVANTS);
    expect(ok).toBe(true);
    expect(state.gold).toBe(5);
    expect(state.servants).toEqual([{ id: 'gnome', count: 1 }]);
    expect(state.journal[0]).toContain('Нанял Гном');
  });

  it('покупка слуги не проходит при недостатке золота', () => {
    const state = stateWith({ gold: 10 });
    const ok = buyServant(state, 'gnome', SERVANTS);
    expect(ok).toBe(false);
    expect(state.servants.length).toBe(0);
  });

  it('повторная покупка слуги увеличивает count', () => {
    const state = stateWith({ gold: 50 });
    buyServant(state, 'gnome', SERVANTS);
    buyServant(state, 'gnome', SERVANTS);
    expect(state.servants[0].count).toBe(2);
  });

  it('покупка здания добавляет уровень', () => {
    const state = stateWith({ gold: 200 });
    const ok = buyBuilding(state, 'forge', BUILDINGS);
    expect(ok).toBe(true);
    expect(state.gold).toBe(50);
    expect(state.buildings).toEqual([{ id: 'forge', level: 1 }]);
    expect(state.journal[0]).toContain('Кузница улучшена до уровня 1');
  });

  it('апгрейд здания работает', () => {
    const state = stateWith({
      gold: 400,
      buildings: [{ id: 'forge', level: 1 }],
    });
    buyBuilding(state, 'forge', BUILDINGS);
    expect(state.buildings[0].level).toBe(2);
  });

  it('неизвестный id не покупается', () => {
    const state = stateWith({ gold: 1000 });
    expect(buyServant(state, 'нет-такого', SERVANTS)).toBe(false);
    expect(buyBuilding(state, 'нет-такого', BUILDINGS)).toBe(false);
  });
});
