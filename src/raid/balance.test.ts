/**
 * Балансные тесты рейдов (S6, критерий ROADMAP: контракт ≤ 1000 и пейсинг).
 * Проверяем, что кривая сложности читается: первое королевство берётся
 * ранней пещерой, третье — только прокачанной пещерой + синергиями.
 */

import { describe, expect, it } from 'vitest';
import { computeLoot, computeRaidPower, getCavePower } from './raid';
import { KINGDOMS } from '../content/kingdoms';
import { RELICS } from '../content/relics';
import { GOLD_CAP } from '../economy/pacing';
import { createInitialState } from '../core/save';
import type { GameState } from '../core/types';

/** Пещера ранней стадии: пара гномов. */
function earlyCave(): GameState {
  const s = createInitialState();
  s.servants = [{ id: 'gnome-prospector', count: 4 }];
  return s;
}

/** Пещера поздней стадии (близко к потолку прогрессии). */
function lateCave(): GameState {
  const s = createInitialState();
  s.servants = [
    { id: 'gnome-prospector', count: 20 },
    { id: 'kobold-accountant', count: 10 },
    { id: 'harpy-courier', count: 5 },
  ];
  s.buildings = [
    { id: 'forge', level: 5 },
    { id: 'treasury', level: 4 },
  ];
  return s;
}

function withRelics(state: GameState, kingdomId: string, relics: string[]): GameState {
  state.raid = { kingdomId, stage: 1, relics, offer: [], atBoss: true };
  return state;
}

describe('баланс рейдов', () => {
  it('первое королевство берётся ранней пещерой с 3 огненными реликвиями', () => {
    const state = withRelics(earlyCave(), 'duchy-of-donuts', ['lava-lamp', 'fireworks', 'dragon-tea']);
    expect(computeRaidPower(state).damage).toBeGreaterThanOrEqual(KINGDOMS[0].bossHp);
  });

  it('пустая ранняя пещера без реликвий первого босса не проходит', () => {
    const state = withRelics(earlyCave(), 'duchy-of-donuts', []);
    expect(computeRaidPower(state).damage).toBeLessThan(KINGDOMS[0].bossHp);
  });

  it('третье королевство недоступно ранней пещере даже с реликвиями', () => {
    const state = withRelics(earlyCave(), 'county-of-kettles', ['lava-lamp', 'fireworks', 'dragon-tea', 'megaphone']);
    expect(computeRaidPower(state).damage).toBeLessThan(KINGDOMS[2].bossHp);
  });

  it('прокачанная пещера с синергиями берёт третье королевство', () => {
    const state = withRelics(lateCave(), 'county-of-kettles', [
      'lava-lamp', 'fireworks', 'dragon-tea', 'charcoal-socks', 'megaphone',
    ]);
    const power = computeRaidPower(state);
    expect(power.multiplier).toBeGreaterThan(1.5); // сработала «Огненная буря» + пары
    expect(power.damage).toBeGreaterThanOrEqual(KINGDOMS[2].bossHp);
  });

  it('даже полный сет реликвий не ломает шкалу: множитель ≤ 3.5×', () => {
    const state = withRelics(lateCave(), 'county-of-kettles', RELICS.map((r) => r.id));
    const power = computeRaidPower(state);
    expect(power.multiplier).toBeGreaterThan(2); // все три «великих» комбо + пары
    expect(power.multiplier).toBeLessThanOrEqual(3.5);
  });

  it('урон и добыча остаются в контракте «малых чисел» (≤ 1000)', () => {
    const state = withRelics(lateCave(), 'county-of-kettles', RELICS.map((r) => r.id));
    expect(computeRaidPower(state).damage).toBeLessThanOrEqual(GOLD_CAP);
    for (const kingdom of KINGDOMS) {
      expect(computeLoot(state, kingdom)).toBeLessThanOrEqual(GOLD_CAP);
    }
  });

  it('цена вылета всегда меньше добычи — рейд окупается', () => {
    for (const kingdom of KINGDOMS) {
      expect(kingdom.cost).toBeLessThan(kingdom.loot);
    }
  });

  it('сложность королевств монотонно растёт', () => {
    for (let i = 1; i < KINGDOMS.length; i += 1) {
      expect(KINGDOMS[i].bossHp).toBeGreaterThan(KINGDOMS[i - 1].bossHp);
      expect(KINGDOMS[i].loot).toBeGreaterThan(KINGDOMS[i - 1].loot);
      expect(KINGDOMS[i].stages).toBeGreaterThanOrEqual(KINGDOMS[i - 1].stages);
    }
  });

  it('сила пещеры считается из слуг, зданий и уровня дракона', () => {
    const s = createInitialState();
    s.servants = [{ id: 'gnome-prospector', count: 3 }];
    s.buildings = [{ id: 'forge', level: 1 }];
    s.dragonLevel = 2;
    expect(getCavePower(s)).toBe(3 + 2 + 2);
  });
});
