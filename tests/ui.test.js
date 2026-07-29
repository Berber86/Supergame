/**
 * ui.test.js — тесты presentation-слоя (форматтеры, иконки, вкладки)
 * и точки доступа к данным (core/lookups.js).
 * DOM не тестируем (нет браузера), зато гарантируем, что UI собирается
 * из валидных данных и модулей без побочных эффектов при импорте.
 */

import { describe, it, expect } from 'vitest';
import { plural, hoursLabel, formatClock, percentLabel, rublesLabel, kgLabel, riskLabel } from '../js/ui/format.js';
import { CATEGORY_ICONS } from '../js/ui/icons.js';
import { TABS } from '../js/ui/tabs.js';
import { findItem, findDistrict, findWeather, findBuyer, findExpert, findShelter } from '../js/core/lookups.js';
import { ITEMS } from '../js/data/items.js';
import { DISTRICTS } from '../js/data/districts.js';
import { WEATHER } from '../js/data/weather.js';

describe('format.js — русские форматтеры', () => {
  it('plural: 1 час, 2 часа, 5 часов, 21 час, 22 часа', () => {
    expect(plural(1, 'час', 'часа', 'часов')).toBe('час');
    expect(plural(2, 'час', 'часа', 'часов')).toBe('часа');
    expect(plural(5, 'час', 'часа', 'часов')).toBe('часов');
    expect(plural(21, 'час', 'часа', 'часов')).toBe('час');
    expect(plural(22, 'час', 'часа', 'часов')).toBe('часа');
    expect(plural(11, 'час', 'часа', 'часов')).toBe('часов');
  });

  it('hoursLabel склеивает число и слово', () => {
    expect(hoursLabel(1)).toBe('1 час');
    expect(hoursLabel(2)).toBe('2 часа');
    expect(hoursLabel(4)).toBe('4 часа');
    expect(hoursLabel(8)).toBe('8 часов');
  });

  it('formatClock подбивает нули', () => {
    expect(formatClock(8, 0)).toBe('08:00');
    expect(formatClock(8, 5)).toBe('08:05');
    expect(formatClock(23, 59)).toBe('23:59');
  });

  it('percentLabel / rublesLabel / kgLabel', () => {
    expect(percentLabel(0.6)).toBe('60%');
    expect(percentLabel(0.05)).toBe('5%');
    expect(rublesLabel(250)).toBe('250 ₽');
    expect(kgLabel(2.55)).toBe('2.6 кг');
  });

  it('riskLabel: пороги словесной шкалы', () => {
    expect(riskLabel(0.08)).toBe('низкий');
    expect(riskLabel(0.15)).toBe('умеренный');
    expect(riskLabel(0.25)).toBe('высокий');
    expect(riskLabel(0.5)).toBe('очень высокий');
  });
});

describe('core/lookups.js — доступ к справочникам', () => {
  it('все районы, погода и предметы находятся по id', () => {
    for (const d of DISTRICTS) expect(findDistrict(d.id), d.id).toBe(d);
    for (const w of WEATHER) expect(findWeather(w.id), w.id).toBe(w);
    for (const i of ITEMS) expect(findItem(i.id), i.id).toBe(i);
  });

  it('неизвестный id → undefined (а не исключение)', () => {
    expect(findItem('shmot_ne_sushchestvuet')).toBeUndefined();
    expect(findDistrict('vselennaya')).toBeUndefined();
    expect(findBuyer('robin_gud')).toBeUndefined();
    expect(findExpert('nostradamus')).toBeUndefined();
    expect(findShelter('palazzo')).toBeUndefined();
  });
});

describe('tabs.js — структура навигации', () => {
  it('4 вкладки с уникальными id (выбор человека: вкладки)', () => {
    expect(TABS.length).toBe(4);
    expect(new Set(TABS.map((t) => t.id)).size).toBe(4);
  });

  it('у каждой вкладки есть рендер-функция', () => {
    for (const tab of TABS) {
      expect(typeof tab.render, tab.id).toBe('function');
      expect(tab.label.length).toBeGreaterThan(0);
    }
  });
});

describe('icons.js — покрытие категорий', () => {
  it('у каждой категории предметов есть иконка', () => {
    const used = new Set(ITEMS.map((i) => i.category));
    for (const cat of used) {
      expect(CATEGORY_ICONS[cat], cat).toBeDefined();
      expect(CATEGORY_ICONS[cat].emoji.length).toBeGreaterThan(0);
    }
  });
});
