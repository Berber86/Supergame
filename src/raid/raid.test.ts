/**
 * Тесты рейд-петли v1 (S5).
 */

import { describe, expect, it, beforeEach } from 'vitest';
import {
  canStartRaid,
  startRaid,
  getStageRelicChoices,
  chooseRelic,
  resolveBoss,
  endRaid,
  getCurrentKingdom,
  getTotalStages,
} from './raid';
import type { GameState } from '../core/types';
import { createInitialState } from '../core/save';
import { KINGDOMS } from '../content/kingdoms';

function freshState(): GameState {
  return createInitialState();
}

describe('рейд-петля v1', () => {
  let state: GameState;

  beforeEach(() => {
    state = freshState();
  });

  it('можно начать рейд только когда нет активного', () => {
    expect(canStartRaid(state)).toBe(true);
    startRaid(state, KINGDOMS[0].id);
    expect(canStartRaid(state)).toBe(false);
  });

  it('startRaid устанавливает состояние и пишет в журнал', () => {
    const ok = startRaid(state, 'duchy-of-donuts');
    expect(ok).toBe(true);
    expect(state.raid.kingdomId).toBe('duchy-of-donuts');
    expect(state.raid.stage).toBe(1);
    expect(state.raid.relics).toEqual([]);
    expect(state.journal[0]).toContain('вылетел в рейд');
  });

  it('getStageRelicChoices возвращает до 3 реликвий', () => {
    startRaid(state, KINGDOMS[0].id);
    const choices = getStageRelicChoices(state);
    expect(choices.length).toBeGreaterThan(0);
    expect(choices.length).toBeLessThanOrEqual(3);
  });

  it('chooseRelic продвигает этап и сохраняет реликвию', () => {
    startRaid(state, 'kingdom-of-moles');
    const choices = getStageRelicChoices(state);
    const first = choices[0].id;

    const ok = chooseRelic(state, first);
    expect(ok).toBe(true);
    expect(state.raid.relics).toContain(first);
    expect(state.raid.stage).toBe(2); // продвинулись
  });

  it('resolveBoss при победе захватывает королевство', () => {
    startRaid(state, 'duchy-of-donuts');
    // Добавим достаточно реликвий для победы (bossHp=50, base+эффекты)
    state.raid.relics = [
      'ember', 'dragon-tea', 'charcoal-socks', 'fireworks', 'lava-lamp',
      'ember', 'dragon-tea', 'charcoal-socks', 'fireworks', 'lava-lamp',
      'ember', 'dragon-tea'
    ];

    const result = resolveBoss(state);
    expect(result.win).toBe(true);
    expect(state.kingdomProgress['duchy-of-donuts']).toBe(true);
    expect(state.raid.kingdomId).toBeNull(); // рейд завершён
    expect(state.journal[0]).toContain('Победа');
  });

  it('resolveBoss при поражении отнимает золото и завершает рейд', () => {
    state.gold = 100;
    startRaid(state, 'county-of-kettles');
    state.raid.relics = []; // почти нет урона

    const result = resolveBoss(state);
    expect(result.win).toBe(false);
    expect(state.gold).toBeLessThan(100);
    expect(state.raid.kingdomId).toBeNull();
    expect(state.journal[0]).toContain('провалился');
  });

  it('getCurrentKingdom и getTotalStages работают', () => {
    startRaid(state, 'kingdom-of-moles');
    expect(getCurrentKingdom(state)?.id).toBe('kingdom-of-moles');
    expect(getTotalStages(state)).toBe(4);
  });

  it('endRaid сбрасывает рейд', () => {
    startRaid(state, KINGDOMS[0].id);
    endRaid(state);
    expect(state.raid.kingdomId).toBeNull();
  });
});
