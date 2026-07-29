/**
 * living.test.js — быт за деньги (сессия 8): покупная еда, мытьё, ночлег.
 * Пассивный распад в ожиданиях статов НЕ забываем (урок сессии 7):
 * 1 час действия = дельта действия + распад за час (сытость−2.5, опрятность−0.6…).
 */

import { describe, it, expect } from 'vitest';
import { createGame } from '../js/core/state.js';
import { buyFood, wash, chooseShelter } from '../js/core/living.js';
import { advanceHours, sleep } from '../js/core/time.js';

describe('🍜 покупная еда', () => {
  it('дошик: деньги −35, сытость +25, час прошёл', () => {
    const s = createGame(11);
    const satietyBefore = s.stats.satiety;
    buyFood(s, 'doshik');
    expect(s.money).toBe(60 - 35);
    expect(s.hour).toBe(9);
    // +25 за еду и −2.5 распада за час очереди
    expect(s.stats.satiety).toBeCloseTo(satietyBefore + 25 - 2.5, 5);
  });

  it('пир на дне: сытость +80 с клампом 100 и руки в соусе (−5 🧼)', () => {
    const s = createGame(11);
    s.money = 500;
    buyFood(s, 'pir_na_dnu');
    expect(s.money).toBe(500 - 200);
    expect(s.stats.satiety).toBe(100);
    expect(s.stats.cleanliness).toBeCloseTo(50 - 5 - 0.6, 5);
  });

  it('не по карману — ни времени, ни денег, только урок арифметики', () => {
    const s = createGame(11);
    s.money = 20;
    const events = buyFood(s, 'pir_na_dnu');
    expect(s.money).toBe(20);
    expect(s.hour).toBe(8);
    expect(events.join(' ')).toContain('мелочь');
  });

  it('еда дороже выживания не бывает: кламп сытости сверху', () => {
    const s = createGame(11);
    s.money = 500;
    s.stats.satiety = 95;
    buyFood(s, 'stolovaya');
    expect(s.stats.satiety).toBe(100);
    expect(s.money).toBe(500 - 120);
  });
});

describe('🚿 мытьё', () => {
  it('+40 🧼 за час, бесплатно', () => {
    const s = createGame(12);
    const moneyBefore = s.money;
    wash(s);
    expect(s.money).toBe(moneyBefore);
    expect(s.hour).toBe(9);
    expect(s.stats.cleanliness).toBeCloseTo(50 + 40 - 0.6, 5);
  });

  it('чистота не бывает абсолютной: кламп 100', () => {
    const s = createGame(12);
    s.stats.cleanliness = 80;
    wash(s);
    expect(s.stats.cleanliness).toBe(100);
  });
});

describe('🛏️ ночлег', () => {
  it('выбор на сегодня — не действие: без времени и денег', () => {
    const s = createGame(13);
    const events = chooseShelter(s, 'nochlezhka');
    expect(s.shelterTonight).toBe('nochlezhka');
    expect(s.hour).toBe(8);
    expect(s.money).toBe(60);
    expect(events.join(' ')).toContain('при отбое');
  });

  it('повторный выбор того же — тишина', () => {
    const s = createGame(13);
    const events = chooseShelter(s, 'lavka');
    expect(events).toHaveLength(0);
  });

  it('полночь использует выбранный ночлег: −100 ₽, сон 85⚡', () => {
    const s = createGame(13);
    s.money = 200;
    chooseShelter(s, 'nochlezhka');
    s.hour = 23;
    advanceHours(s, 1); // полночь → отбой
    expect(s.day).toBe(2);
    expect(s.money).toBe(100);
    expect(s.stats.energy).toBe(85); // 100 × 0.85 качества
  });

  it('не хватило к отбою — спит на лавке бесплатно, город пожурил', () => {
    const s = createGame(13);
    s.money = 50;
    chooseShelter(s, 'nochlezhka');
    s.hour = 23;
    const events = advanceHours(s, 1);
    expect(s.money).toBe(50); // лавка бесплатна
    expect(events.join(' ')).toContain('не хватило');
  });

  it('угол мечты: −350 ₽ и выспался на 100⚡', () => {
    const s = createGame(13);
    s.money = 400;
    chooseShelter(s, 'ugol');
    s.hour = 23;
    advanceHours(s, 1);
    expect(s.money).toBe(50);
    expect(s.stats.energy).toBe(100); // 100 × 1.1 → кап 100
  });

  it('отруб на улице — без права выбора: лавка', () => {
    const s = createGame(13);
    s.money = 200;
    chooseShelter(s, 'nochlezhka');
    s.stats.energy = 0.3; // ровно на час распада не хватит
    const events = advanceHours(s, 2);
    expect(events.join(' ')).toContain('отключился');
    expect(s.money).toBe(200); // отруб → лавка → бесплатно
  });

  it('сон в выбранной ночлежке — прямой вызов sleep тоже дисциплинирован', () => {
    const s = createGame(14);
    s.money = 150;
    chooseShelter(s, 'nochlezhka');
    sleep(s, s.shelterTonight);
    expect(s.money).toBe(50);
    expect(s.stats.energy).toBe(85);
  });
});
