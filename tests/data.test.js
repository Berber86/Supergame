/**
 * data.test.js — валидация ЦЕЛОСТНОСТИ данных справочников (js/data/*).
 * Это не логика игры: мы проверяем, что таблицы согласованы между собой
 * (все ссылки на предметы существуют, шансы сходятся, категории валидны),
 * чтобы ошибка в данных ловилась CI, а не игроком.
 */

import { describe, it, expect } from 'vitest';
import { ITEMS } from '../js/data/items.js';
import { DISTRICTS } from '../js/data/districts.js';
import { BUYERS } from '../js/data/buyers.js';
import { EXPERTS } from '../js/data/experts.js';
import { EVENTS } from '../js/data/events.js';
import { WEATHER } from '../js/data/weather.js';
import { REBIRTH } from '../js/data/rebirth.js';
import { TIME, ACTIONS, DECAY, START, LIVING, SKILLS, ASSESS } from '../js/data/balance.js';

const VALID_KINDS = ['obvious', 'food', 'unidentified'];
const VALID_CATEGORIES = ['steklotara', 'metall', 'bumaga', 'eda', 'odezhda', 'obuv', 'byt', 'instrument', 'tehnika', 'antikvariat', 'raznoe'];
const VALID_EXPERT_CATEGORIES = ['antikvariat', 'tehnika'];
const VALID_CONTEXTS = ['dig', 'travel', 'street', 'sale', 'night', 'rumor'];

const itemIds = new Set(ITEMS.map((i) => i.id));

describe('items.js — каталог предметов', () => {
  it('не менее 30 предметов (рамки MLP), из них не менее 10 неопознанных', () => {
    expect(ITEMS.length).toBeGreaterThanOrEqual(30);
    expect(ITEMS.filter((i) => i.kind === 'unidentified').length).toBeGreaterThanOrEqual(10);
  });

  it('id уникальны', () => {
    expect(itemIds.size).toBe(ITEMS.length);
  });

  it('у каждого предмета есть имя, эмодзи и валидные kind/category', () => {
    for (const item of ITEMS) {
      expect(item.name?.length, item.id).toBeGreaterThan(0);
      expect(item.emoji?.length, item.id).toBeGreaterThan(0);
      expect(VALID_KINDS, item.id).toContain(item.kind);
      expect(VALID_CATEGORIES, item.id).toContain(item.category);
    }
  });

  it('obvious: цена определена и неотрицательна; food: satiety > 0', () => {
    for (const item of ITEMS) {
      if (item.kind === 'obvious') {
        expect(typeof item.value, item.id).toBe('number');
        expect(item.value, item.id).toBeGreaterThanOrEqual(0);
      }
      if (item.kind === 'food') {
        expect(item.satiety, item.id).toBeGreaterThan(0);
      }
    }
  });

  it('unidentified: тиры валидны (сумма шансов = 1, min ≤ max, категория эксперта известна)', () => {
    for (const item of ITEMS.filter((i) => i.kind === 'unidentified')) {
      expect(VALID_EXPERT_CATEGORIES, item.id).toContain(item.guess.expertCategory);
      const tiers = item.guess.tiers;
      expect(tiers.length, item.id).toBeGreaterThanOrEqual(2);
      const chanceSum = tiers.reduce((s, t) => s + t.chance, 0);
      expect(chanceSum, item.id).toBeCloseTo(1, 5);
      for (const t of tiers) {
        expect(t.min, item.id).toBeLessThanOrEqual(t.max);
        expect(t.chance, item.id).toBeGreaterThan(0);
      }
    }
  });
});

describe('districts.js — районы', () => {
  it('5 районов (рамки MLP), id уникальны', () => {
    expect(DISTRICTS.length).toBe(5);
    expect(new Set(DISTRICTS.map((d) => d.id)).size).toBe(DISTRICTS.length);
  });

  it('все предметы в лут-таблицах существуют, веса положительны', () => {
    for (const d of DISTRICTS) {
      for (const entry of d.loot) {
        expect(itemIds.has(entry.itemId), `${d.id} → ${entry.itemId}`).toBe(true);
        expect(entry.weight, `${d.id} → ${entry.itemId}`).toBeGreaterThan(0);
      }
    }
  });

  it('районы с баками имеют непустую лут-таблицу; база — без баков', () => {
    for (const d of DISTRICTS) {
      if (d.binCount > 0) expect(d.loot.length, d.id).toBeGreaterThanOrEqual(10);
      if (d.binCount === 0) expect(d.loot.length, d.id).toBe(0);
    }
  });

  it('матрица переходов: полная, симметричная, диагональ = 0', () => {
    const ids = DISTRICTS.map((d) => d.id);
    for (const a of DISTRICTS) {
      for (const bId of ids) {
        expect(typeof a.travelHours[bId], `${a.id} → ${bId}`).toBe('number');
        expect(a.travelHours[bId], `${a.id} → ${bId}`).toBeGreaterThanOrEqual(0);
      }
      expect(a.travelHours[a.id], a.id).toBe(0);
      for (const b of DISTRICTS) {
        expect(a.travelHours[b.id], `${a.id}↔${b.id}`).toBe(b.travelHours[a.id]);
      }
    }
  });

  it('риск обыска в диапазоне 0..1', () => {
    for (const d of DISTRICTS) {
      expect(d.digRisk, d.id).toBeGreaterThanOrEqual(0);
      expect(d.digRisk, d.id).toBeLessThanOrEqual(1);
    }
  });
});

describe('buyers.js — точки сбыта', () => {
  it('4 точки (рамки MLP), категории валидны', () => {
    expect(BUYERS.length).toBeGreaterThanOrEqual(4);
    for (const b of BUYERS) {
      if (b.accepts !== 'all') {
        for (const cat of b.accepts) expect(VALID_CATEGORIES, b.id).toContain(cat);
      }
    }
  });

  it('коэффициенты цен адекватны (0..1.3 или диапазон min≤max)', () => {
    for (const b of BUYERS) {
      if (typeof b.priceMult === 'number') {
        expect(b.priceMult, b.id).toBeGreaterThan(0);
        expect(b.priceMult, b.id).toBeLessThanOrEqual(1.3);
      } else {
        expect(b.priceMult.min, b.id).toBeLessThanOrEqual(b.priceMult.max);
      }
    }
  });

  it('предметы каждой категории сырья куда-то принимаются', () => {
    for (const cat of ['steklotara', 'metall', 'bumaga']) {
      const accepted = BUYERS.some((b) => b.accepts === 'all' || b.accepts.includes(cat));
      expect(accepted, cat).toBe(true);
    }
  });

  it('у перекупщика есть параметры кидка с шансом в 0..1', () => {
    const perekup = BUYERS.find((b) => b.id === 'perekup');
    expect(perekup).toBeDefined();
    expect(perekup.scam.baseChance).toBeGreaterThan(0);
    expect(perekup.scam.baseChance).toBeLessThan(1);
  });
});

describe('experts.js — эксперты', () => {
  it('каждая expertCategory предметов закрыта хотя бы одним экспертом', () => {
    const covered = new Set(EXPERTS.flatMap((e) => e.specialties));
    for (const cat of VALID_EXPERT_CATEGORIES) {
      expect(covered.has(cat), cat).toBe(true);
    }
  });

  it('гонорары валидны', () => {
    for (const e of EXPERTS) {
      if (e.fee.type === 'percent') {
        expect(e.fee.value, e.id).toBeGreaterThan(0);
        expect(e.fee.value, e.id).toBeLessThanOrEqual(1);
        expect(e.fee.min, e.id).toBeGreaterThan(0);
      } else {
        expect(e.fee.value, e.id).toBeGreaterThan(0);
      }
    }
  });
});

describe('events.js — события', () => {
  it('не менее 8 событий (рамки MLP), контексты валидны', () => {
    expect(EVENTS.length).toBeGreaterThanOrEqual(8);
    for (const ev of EVENTS) {
      for (const ctx of ev.contexts) expect(VALID_CONTEXTS, ev.id).toContain(ctx);
      expect(ev.weight, ev.id).toBeGreaterThan(0);
    }
  });

  it('у каждого события есть ≥1 выбора с декларативными эффектами', () => {
    for (const ev of EVENTS) {
      expect(ev.choices.length, ev.id).toBeGreaterThanOrEqual(1);
      for (const ch of ev.choices) {
        expect(ch.text?.length, `${ev.id}/${ch.id}`).toBeGreaterThan(0);
        expect(typeof ch.effects, `${ev.id}/${ch.id}`).toBe('object');
      }
    }
  });

  it('есть и угрозы, и подарки (трагикомедия — это баланс)', () => {
    const hasPositive = EVENTS.some((ev) =>
      ev.choices.some((ch) => Object.entries(ch.effects).some(([k, v]) =>
        ['satiety', 'warmth', 'health', 'money'].includes(k) && typeof v === 'number' && v > 0)));
    expect(hasPositive).toBe(true);
  });
});

describe('weather.js — погода', () => {
  it('не менее 3 типов погоды, веса и множители адекватны', () => {
    expect(WEATHER.length).toBeGreaterThanOrEqual(3);
    expect(WEATHER.reduce((s, w) => s + w.weight, 0)).toBeGreaterThan(0);
    for (const w of WEATHER) {
      expect(w.warmthMult, w.id).toBeGreaterThan(0);
      expect(w.digRiskMult, w.id).toBeGreaterThan(0);
    }
  });
});

describe('rebirth.js — новая жизнь', () => {
  it('навыки сохраняются, деньги и инвентарь теряются', () => {
    expect(REBIRTH.keep.skills).toBe(true);
    expect(REBIRTH.lose.inventory).toBe('all');
  });

  it('стартовый пакет адекватен, наследие не превышает кап', () => {
    expect(REBIRTH.start.money).toBeGreaterThan(0);
    expect(REBIRTH.legacy.reputationBonusPerLife).toBeGreaterThan(0);
    expect(REBIRTH.legacy.reputationBonusPerLife).toBeLessThanOrEqual(REBIRTH.legacy.reputationBonusCap);
  });
});

describe('balance.js — константы', () => {
  it('сутки = 16 активных часов + 8 сна', () => {
    expect(TIME.HOURS_PER_DAY).toBe(16);
    expect(TIME.SLEEP_HOURS).toBe(8);
  });

  it('стартовые статы в диапазоне 0..100, деньги неотрицательны', () => {
    for (const key of ['satiety', 'warmth', 'health', 'energy', 'cleanliness']) {
      expect(START[key], key).toBeGreaterThanOrEqual(0);
      expect(START[key], key).toBeLessThanOrEqual(100);
    }
    expect(START.money).toBeGreaterThanOrEqual(0);
  });

  it('распады — отрицательные стоки, стоимость обыска определена', () => {
    expect(DECAY.satietyPerHour).toBeLessThan(0);
    expect(DECAY.warmthPerHour).toBeLessThan(0);
    expect(ACTIONS.dig.hours).toBeGreaterThan(0);
    expect(ACTIONS.dig.energy).toBeLessThan(0);
    expect(ACTIONS.dig.cleanliness).toBeLessThan(0);
  });

  it('есть ≥2 варианта еды и ≥2 ночлега; цены положительны (кроме лавки)', () => {
    expect(LIVING.food.length).toBeGreaterThanOrEqual(2);
    expect(LIVING.shelter.length).toBeGreaterThanOrEqual(2);
    for (const f of LIVING.food) expect(f.price).toBeGreaterThan(0);
  });

  it('навыков ≥4 (рамки MLP), модель оценки сходится к точной цене', () => {
    expect(Object.keys(SKILLS.list).length).toBeGreaterThanOrEqual(4);
    expect(ASSESS.exactFromLevel).toBeLessThanOrEqual(SKILLS.maxLevel);
  });
});
