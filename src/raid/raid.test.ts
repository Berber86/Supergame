/**
 * Тесты рейд-петли (S5 v1 + S6: синергии, стоимость вылета, добыча, победа).
 */

import { describe, expect, it, beforeEach } from 'vitest';
import {
  BASE_DAMAGE,
  canAffordRaid,
  canStartRaid,
  chooseRelic,
  computeLoot,
  computeRaidPower,
  endRaid,
  getCavePower,
  getCurrentKingdom,
  getStageRelicChoices,
  getTotalStages,
  isVictory,
  resolveBoss,
  retreat,
  startRaid,
} from './raid';
import type { GameState } from '../core/types';
import { createInitialState } from '../core/save';
import { KINGDOMS } from '../content/kingdoms';

function freshState(gold = 500): GameState {
  const state = createInitialState();
  state.gold = gold;
  return state;
}

describe('рейд-петля', () => {
  let state: GameState;

  beforeEach(() => {
    state = freshState();
  });

  it('начать рейд можно только когда нет активного', () => {
    expect(canStartRaid(state)).toBe(true);
    startRaid(state, KINGDOMS[0].id);
    expect(canStartRaid(state)).toBe(false);
  });

  it('вылет стоит золота и без золота невозможен', () => {
    const poor = freshState(0);
    expect(canAffordRaid(poor, 'duchy-of-donuts')).toBe(false);
    expect(startRaid(poor, 'duchy-of-donuts')).toBe(false);
    expect(poor.raid.kingdomId).toBeNull();

    const cost = KINGDOMS[0].cost;
    expect(startRaid(state, 'duchy-of-donuts')).toBe(true);
    expect(state.gold).toBe(500 - cost);
  });

  it('startRaid готовит этап 1 и предложение реликвий', () => {
    startRaid(state, 'duchy-of-donuts');
    expect(state.raid.stage).toBe(1);
    expect(state.raid.atBoss).toBe(false);
    expect(state.raid.offer.length).toBe(3);
    expect(getStageRelicChoices(state)).toHaveLength(3);
    expect(state.journal[0]).toContain('вылетел');
  });

  it('нельзя взять реликвию не из предложения', () => {
    startRaid(state, 'duchy-of-donuts');
    const notOffered = ['ember', 'magnet', 'tent', 'megaphone', 'purse'].find(
      (id) => !state.raid.offer.includes(id),
    )!;
    expect(chooseRelic(state, notOffered)).toBe(false);
  });

  it('выбор реликвии продвигает этап, пополняет коллекцию и обновляет предложение', () => {
    startRaid(state, 'kingdom-of-moles');
    const first = state.raid.offer[0];

    expect(chooseRelic(state, first)).toBe(true);
    expect(state.raid.relics).toContain(first);
    expect(state.relics).toContain(first); // коллекция навсегда
    expect(state.raid.stage).toBe(2);
    expect(state.raid.offer).not.toContain(first);
  });

  it('после последнего этапа рейд переходит к боссу', () => {
    startRaid(state, 'duchy-of-donuts'); // 3 этапа
    for (let i = 0; i < getTotalStages(state); i += 1) {
      chooseRelic(state, state.raid.offer[0]);
    }
    expect(state.raid.atBoss).toBe(true);
    expect(state.raid.offer).toEqual([]);
    expect(chooseRelic(state, 'ember')).toBe(false);
  });

  it('сила пещеры входит в урон рейда', () => {
    startRaid(state, 'duchy-of-donuts');
    const bare = computeRaidPower(state).damage;

    state.servants = [{ id: 'gnome-prospector', count: 5 }];
    state.buildings = [{ id: 'forge', level: 2 }];
    expect(getCavePower(state)).toBe(5 + 4);
    expect(computeRaidPower(state).damage).toBeGreaterThan(bare);
    expect(computeRaidPower(state).base).toBe(BASE_DAMAGE + 9);
  });

  it('синергии умножают урон', () => {
    startRaid(state, 'duchy-of-donuts');
    state.raid.relics = ['ember', 'lava-lamp']; // 🔥×2 → +25%
    const power = computeRaidPower(state);
    expect(power.multiplier).toBeCloseTo(1.25);
    expect(power.damage).toBe(Math.floor((power.base + power.fromRelics) * 1.25));
    expect(power.synergies.map((s) => s.id)).toContain('fire-combo');
  });

  it('добыча растёт от реликвий жадности и их комбо', () => {
    const kingdom = KINGDOMS[0];
    startRaid(state, kingdom.id);
    expect(computeLoot(state, kingdom)).toBe(kingdom.loot);

    state.raid.relics = ['royal-tax', 'magnet']; // +40% реликвии, +30% комбо
    expect(computeLoot(state, kingdom)).toBe(Math.floor(kingdom.loot * 1.4 * 1.3));
  });

  it('победа над боссом захватывает королевство и даёт добычу', () => {
    state.servants = [{ id: 'gnome-prospector', count: 12 }];
    state.buildings = [{ id: 'forge', level: 3 }];
    startRaid(state, 'duchy-of-donuts');
    state.raid.relics = ['lava-lamp', 'fireworks', 'dragon-tea'];
    state.raid.atBoss = true;
    const goldBefore = state.gold;

    const result = resolveBoss(state);
    expect(result.win).toBe(true);
    expect(result.loot).toBeGreaterThan(0);
    expect(state.gold).toBe(goldBefore + result.loot);
    expect(state.kingdomProgress['duchy-of-donuts']).toBe(true);
    expect(state.raid.kingdomId).toBeNull();
    expect(state.journal[0]).toContain('Победа');
  });

  it('поражение отнимает 15% золота и завершает рейд', () => {
    const weak = freshState(200);
    startRaid(weak, 'county-of-kettles'); // босс 90 HP, пещера пустая
    weak.raid.atBoss = true;
    const goldBefore = weak.gold;

    const result = resolveBoss(weak);
    expect(result.win).toBe(false);
    expect(result.remainingHp).toBeGreaterThan(0);
    expect(weak.gold).toBe(goldBefore - Math.floor(goldBefore * 0.15));
    expect(weak.raid.kingdomId).toBeNull();
    expect(weak.journal[0]).toContain('устоял');
  });

  it('победа во всех королевствах = победа в игре', () => {
    expect(isVictory(state)).toBe(false);
    for (const k of KINGDOMS) state.kingdomProgress[k.id] = true;
    expect(isVictory(state)).toBe(true);
  });

  it('отступление завершает рейд, но реликвии остаются в коллекции', () => {
    startRaid(state, 'kingdom-of-moles');
    const taken = state.raid.offer[0];
    chooseRelic(state, taken);
    retreat(state);
    expect(state.raid.kingdomId).toBeNull();
    expect(state.relics).toContain(taken);
  });

  it('getCurrentKingdom, getTotalStages и endRaid работают', () => {
    startRaid(state, 'kingdom-of-moles');
    expect(getCurrentKingdom(state)?.id).toBe('kingdom-of-moles');
    expect(getTotalStages(state)).toBe(4);
    endRaid(state);
    expect(getCurrentKingdom(state)).toBeNull();
  });
});
