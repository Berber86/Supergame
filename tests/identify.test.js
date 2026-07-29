/**
 * identify.test.js — тесты сессии 6: самооценка 👁️ (диапазоны, сохранение
 * estimate, XP), эксперты (гонорары, специальности, нехватка денег),
 * продажа вслепую Тени (честность ≈65%, кидок, наследие репутации).
 */

import { describe, it, expect } from 'vitest';
import { createGame } from '../js/core/state.js';
import { assessSpread, estimateFor, assessSelf, expertAssess, blindSell } from '../js/core/identify.js';
import { addItem } from '../js/core/inventory.js';
import { addSkillXp } from '../js/core/skills.js';
import { serialize, deserialize } from '../js/core/persist.js';
import { findExpert, findItem } from '../js/core/lookups.js';
import { makeRoller } from '../js/core/rng.js';
import { ACTIONS, ASSESS, DECAY, SCAM, START, TIME } from '../js/data/balance.js';

function newGame(seed = 42) {
  const s = createGame(seed);
  s.weatherId = 'cloud';
  return s;
}

/** Положить в ношу неопознанный «антиквариат» с заданной скрытой ценой. */
function addUnidentified(state, trueValue, itemId = 'u_kartina_ramka') {
  addItem(state, itemId, { trueValue });
  return state.inventory.length - 1; // индекс добавленной записи
}

describe('assess — формула глазомера', () => {
  it('spread: lvl 0 → 1, lvl 4 → 0.5, lvl 8+ → 0', () => {
    expect(assessSpread(0)).toBe(1);
    expect(assessSpread(4)).toBeCloseTo(0.5, 10);
    expect(assessSpread(8)).toBe(0);
    expect(assessSpread(10)).toBe(0);
  });

  it('lvl 8+ — точная цена (low == high == v)', () => {
    const roller = makeRoller(1);
    for (let i = 0; i < 100; i += 1) {
      const est = estimateFor(500, 8 + (i % 3), roller);
      expect(est).toEqual({ low: 500, high: 500, exact: true });
    }
  });

  it('низкий уровень: диапазоны широкие и зашумлённые, low ≤ high, детерминизм', () => {
    const a = makeRoller(7);
    const b = makeRoller(7);
    const estA = estimateFor(1000, 1, a);
    const estB = estimateFor(1000, 1, b);
    expect(estA).toEqual(estB); // один сид — одна оценка
    expect(estA.low).toBeLessThanOrEqual(estA.high);

    const roller = makeRoller(3);
    for (let i = 0; i < 2000; i += 1) {
      const est = estimateFor(1000, 1, roller);
      expect(est.low).toBeLessThanOrEqual(est.high);
      expect(est.low).toBeGreaterThanOrEqual(0);
      // шум относительный: не выйдет за ±50% даже при spread 0.875
      expect(est.high).toBeLessThan(1000 * 2.3);
    }
  });

  it('в среднем диапазон сужается с уровнем (600 оценок)', () => {
    const widthAt = (level) => {
      const roller = makeRoller(11);
      let sum = 0;
      for (let i = 0; i < 600; i += 1) {
        const est = estimateFor(1000, level, roller);
        sum += est.high - est.low;
      }
      return sum / 600;
    };
    expect(widthAt(6)).toBeLessThan(widthAt(2) * 0.4);
  });
});

describe('assessSelf — оценить самому (час ритуала)', () => {
  it('тратит час, пишет estimate с уровнем, даёт XP 👁️', () => {
    const s = newGame(8);
    const idx = addUnidentified(s, 500);
    const events = assessSelf(s, idx, []);
    expect(s.hour).toBe(TIME.START_HOUR + ACTIONS.assessSelf.hours);
    const est = s.inventory[idx].estimate;
    expect(est).toBeDefined();
    expect(est.level).toBe(0);
    expect(est.low).toBeLessThanOrEqual(est.high);
    expect(events.some((e) => e.includes('👁️'))).toBe(true);
    expect(s.skills.assess.xp).toBe(1);
  });

  it('на границе уровня — анонс роста; на lvl 8 сразу точная цена', () => {
    const s = newGame(9);
    s.skills.assess.xp = 9; // порог lvl 1
    const idx = addUnidentified(s, 500);
    const events = assessSelf(s, idx, []);
    expect(events.some((e) => e.includes('Оценка выросла'))).toBe(true);

    s.skills.assess.level = 8;
    const idx2 = addUnidentified(s, 777, 'u_skripka_futlyar');
    assessSelf(s, idx2, []);
    expect(s.inventory[idx2].estimate.exact).toBe(true);
    expect(s.inventory[idx2].estimate.high).toBe(777);
  });

  it('переоценка перезаписывает estimate (новый уровень глазомера)', () => {
    const s = newGame(10);
    const idx = addUnidentified(s, 500);
    assessSelf(s, idx, []);
    s.skills.assess.level = 3;
    assessSelf(s, idx, []);
    expect(s.inventory[idx].estimate.level).toBe(3);
  });

  it('гварды: мёртвым, очевидное, еду, уже опознанное — нельзя', () => {
    const s = newGame(11);
    addItem(s, 'butylka_steklo');
    addItem(s, 'baton_zasohshiy');
    const idx = addUnidentified(s, 500);
    s.inventory[idx].identified = true;
    assessSelf(s, 0, []);
    assessSelf(s, 1, []);
    assessSelf(s, idx, []); // опознанное
    assessSelf(s, 99, []);  // мимо индекса
    expect(s.hour).toBe(TIME.START_HOUR); // ни одного часа
    s.status = 'dead';
    s.inventory[idx].identified = false;
    assessSelf(s, idx, []);
    expect(s.hour).toBe(TIME.START_HOUR);
  });
});

describe('expertAssess — Герыч и Слива', () => {
  it('Герыч: гонорар 20% с полом 100 ₽; точная цена + identified', () => {
    const s = newGame(12);
    s.money = 1000;
    const cheap = addUnidentified(s, 100);   // 20% = 20 → пол 100
    expertAssess(s, cheap, 'gerych', []);
    expect(s.money).toBe(900);
    expect(s.inventory[cheap].identified).toBe(true);
    expect(s.inventory[cheap].estimate.high).toBe(100);

    const dear = addUnidentified(s, 2000, 'u_skripka_futlyar'); // 20% = 400
    expertAssess(s, dear, 'gerych', []);
    expect(s.money).toBe(500);
    expect(s.inventory[dear].estimate.high).toBe(2000);
  });

  it('Слива: фикс 150 ₽, берёт только технику', () => {
    const s = newGame(13);
    s.money = 500;
    const idxPhone = addUnidentified(s, 800, 'u_petzher_motorola'); // tehnika
    expertAssess(s, idxPhone, 'sliva', []);
    expect(s.money).toBe(350);
    expect(s.inventory[idxPhone].identified).toBe(true);

    const idxPic = addUnidentified(s, 500, 'u_kartina_ramka'); // antikvariat — не его
    const events = expertAssess(s, idxPic, 'sliva', []);
    expect(events.length).toBe(0);           // молча отказал, час не потрачен
    expect(s.hour).toBe(TIME.START_HOUR + 1); // только первый визит отнял час
    expect(s.money).toBe(350);
    expect(s.inventory[idxPic].identified).toBe(false);
  });

  it('не по карману: час убит, деньги целы, опознания нет', () => {
    const s = newGame(14);
    s.money = 60; // Герыч минимум 100
    const idx = addUnidentified(s, 500);
    const events = expertAssess(s, idx, 'gerych', []);
    expect(s.hour).toBe(TIME.START_HOUR + ACTIONS.expertVisit.hours);
    expect(s.money).toBe(60);
    expect(s.inventory[idx].identified).toBe(false);
    expect(events.some((e) => e.includes('не по карману') || e.includes('разошлись'))).toBe(true);
  });

  it('визит к эксперту учит глаз (+XP 👁️)', () => {
    const s = newGame(15);
    s.money = 1000;
    const idx = addUnidentified(s, 500);
    expertAssess(s, idx, 'gerych', []);
    expect(s.skills.assess.xp).toBeGreaterThanOrEqual(1);
  });
});

describe('blindSell — продажа вслепую Тени', () => {
  /** Прогнать сиды, вернуть первый, давший честную сделку, и первый кидок. */
  function findOutcomes() {
    let honest = null;
    let scam = null;
    for (let seed = 1; seed < 500 && (!honest || !scam); seed += 1) {
      const s = newGame(seed * 17 + 5);
      const idx = addUnidentified(s, 1000);
      const before = s.money;
      blindSell(s, idx, []);
      const gained = s.money - before;
      // исход строго бинарный: либо монета звенит, либо Скандал с заглавной
      if (gained === 0 && !scam) scam = { s, gained };
      if (gained > 0 && !honest) honest = { s, gained };
    }
    return { honest, scam };
  }

  it('честная сделка: предмет ушёл, деньги пришли (110–130% цены)', () => {
    const { honest } = findOutcomes();
    expect(honest).not.toBeNull();
    expect(honest.gained).toBeGreaterThanOrEqual(1000 * 1.1);
    expect(honest.gained).toBeLessThanOrEqual(Math.ceil(1000 * 1.3));
    expect(honest.s.inventory.length).toBe(0);
    expect(honest.s.earnedThisLife).toBe(honest.gained);
  });

  it('кидок: 0 ₽, предмет испарился, опрятность поплатилась за скандал', () => {
    const { scam } = findOutcomes();
    expect(scam).not.toBeNull();
    expect(scam.gained).toBe(0);
    expect(scam.s.inventory.length).toBe(0);
    expect(scam.s.stats.cleanliness).toBeCloseTo(START.cleanliness + SCAM.scandalCleanliness + DECAY.cleanlinessPerHour, 5); // минус час распада
  });

  it('честность Тени ≈ 65% при 🤝-0 (400 сидов)', () => {
    let honest = 0;
    const N = 400;
    for (let seed = 1; seed <= N; seed += 1) {
      const s = newGame(seed * 31 + 7);
      const idx = addUnidentified(s, 500);
      const before = s.money;
      blindSell(s, idx, []);
      if (s.money > before) honest += 1;
    }
    expect(honest / N).toBeGreaterThan(SCAM.baseHonestChance - 0.06);
    expect(honest / N).toBeLessThan(SCAM.baseHonestChance + 0.06);
  });

  it('наследие репутации умножает выкуп (при живых сделках)', () => {
    // ищем сид, где и без, и с наследием сделка честная (rng путь одинаков)
    for (let seed = 1; seed < 300; seed += 1) {
      const a = newGame(seed * 13 + 3);
      const b = newGame(seed * 13 + 3);
      const ia = addUnidentified(a, 1000);
      const ib = addUnidentified(b, 1000);
      b.legacyBonus = 0.1;
      blindSell(a, ia, []);
      blindSell(b, ib, []);
      const gainA = a.money - START.money;
      const gainB = b.money - START.money;
      if (gainA > 0 && gainB > 0) {
        // gainA округлён — множитель проверяем с допуском в 1 ₽, без двойного округления
        expect(Math.abs(gainB - gainA * 1.1)).toBeLessThanOrEqual(1);
        return;
      }
    }
    throw new Error('не нашли пару честных сидов для проверки наследия');
  });

  it('опознанное вслепую не продать (туда — к скупщикам, сессия 7)', () => {
    const s = newGame(16);
    const idx = addUnidentified(s, 500);
    s.inventory[idx].identified = true;
    blindSell(s, idx, []);
    expect(s.inventory.length).toBe(1);
    expect(s.hour).toBe(TIME.START_HOUR);
  });
});

describe('persist — estimate переживает сейв', () => {
  it('round-trip с оценённым и опознанным предметами', () => {
    const s = newGame(17);
    const idx = addUnidentified(s, 500);
    assessSelf(s, idx, []);
    s.money = 500;
    const idx2 = addUnidentified(s, 900, 'u_petzher_motorola');
    expertAssess(s, idx2, 'sliva', []);
    const restored = deserialize(serialize(s));
    expect(restored).toEqual(s);
    expect(restored.inventory[idx].estimate.level).toBe(0);
    expect(restored.inventory[idx2].identified).toBe(true);
  });

  it('справочники не сломались: эксперт находится по id', () => {
    expect(findExpert('gerych')).toBeDefined();
    expect(findExpert(findItem('u_kartina_ramka').guess.expertCategory === 'antikvariat' ? 'gerych' : 'sliva')).toBeDefined();
  });
});
