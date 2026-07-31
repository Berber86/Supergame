/**
 * Интеграционный тест полного цикла (критерий MLP §1):
 * старт → пещера (клик/слуги) → рейды на 3 королевства → победа → новый старт.
 */

import { describe, expect, it } from 'vitest';
import { createInitialState } from '../core/save';
import { computeIncome } from '../economy/gold';
import { buyBuilding, buyServant } from '../economy/purchases';
import { SERVANTS } from '../content/servants';
import { BUILDINGS } from '../content/buildings';
import { KINGDOMS } from '../content/kingdoms';
import { clampGold } from '../economy/pacing';
import { chooseRelic, computeRaidPower, isVictory, resolveBoss, startRaid } from './raid';
import type { GameState } from '../core/types';

/** Прокрутить пещеру: n секунд пассивного дохода. */
function idle(state: GameState, seconds: number): void {
  const rates = computeIncome(state, SERVANTS, BUILDINGS);
  state.gold = clampGold(state.gold + rates.perSecond * seconds);
}

/** Прожать покупки, оставив резерв золота на снаряжение рейда. */
function spendAll(state: GameState, reserve = 0): void {
  let bought = true;
  while (bought) {
    bought = false;
    const gold = state.gold;
    state.gold = Math.max(0, gold - reserve);
    for (const s of SERVANTS) if (buyServant(state, s.id, SERVANTS)) bought = true;
    for (const b of BUILDINGS) if (buyBuilding(state, b.id, BUILDINGS)) bought = true;
    state.gold += Math.min(gold, reserve);
  }
}

/** Пройти рейд: взять реликвию на каждом этапе и подраться с боссом. */
function runRaid(state: GameState, kingdomId: string) {
  expect(startRaid(state, kingdomId)).toBe(true);
  let guard = 0;
  while (!state.raid.atBoss && guard < 10) {
    expect(chooseRelic(state, state.raid.offer[0])).toBe(true);
    guard += 1;
  }
  expect(state.raid.atBoss).toBe(true);
  return resolveBoss(state);
}

describe('полный игровой цикл', () => {
  it('от пустой пещеры до захвата всех королевств и рестарта', () => {
    const state = createInitialState();

    // Стартовые клики: игрок набивает первых слуг вручную.
    state.gold = 20;
    spendAll(state);
    expect(state.servants.length).toBeGreaterThan(0);

    // Королевства берутся по очереди: пещера растёт между забегами,
    // реликвии в забеге случайны — поэтому забег может и провалиться.
    for (const kingdom of KINGDOMS) {
      let attempts = 0;
      let won = false;
      while (!won && attempts < 12) {
        idle(state, 900);
        spendAll(state, kingdom.cost);
        won = runRaid(state, kingdom.id).win;
        attempts += 1;
      }
      expect(won).toBe(true);
    }

    // Победа в игре.
    expect(isVictory(state)).toBe(true);
    expect(state.relics.length).toBeGreaterThan(0);
    expect(state.journal.some((line) => line.includes('Повелитель Области'))).toBe(true);

    // Сыграть заново: новое состояние — снова малые числа.
    const fresh = createInitialState();
    expect(fresh.gold).toBe(0);
    expect(isVictory(fresh)).toBe(false);
    expect(computeRaidPower(fresh).damage).toBeLessThan(KINGDOMS[0].bossHp);
  });
});
