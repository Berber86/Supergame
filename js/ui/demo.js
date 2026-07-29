/**
 * demo.js — СТАТИЧНЫЙ ДЕМО-СНИМОК для каркаса UI (сессия 3).
 *
 * Это НЕ игровое состояние: настоящий GameState появится в сессии 4
 * (js/core). Здесь — замороженный кадр «день 1, утро, Питер», собранный
 * из справочников js/data, чтобы UI было что показать человеку.
 *
 * Плюс мелкие lookup-функции доступа к данным (переедут в js/core позже).
 */

import { START, BEGGING } from '../data/balance.js';
import { DISTRICTS } from '../data/districts.js';
import { ITEMS } from '../data/items.js';
import { WEATHER } from '../data/weather.js';

export const DEMO = {
  day: 1,
  hour: 8,
  minute: 0,
  weatherId: 'rain',        // ну а какой ещё Питер ты знаешь
  districtId: 'petrogradka',

  money: START.money,
  stats: {
    satiety: START.satiety,
    warmth: START.warmth,
    health: START.health,
    energy: START.energy,
    cleanliness: START.cleanliness,
  },

  skills: {
    search:  { level: 1, xp: 0 },
    assess:  { level: 0, xp: 0 },
    trade:   { level: 0, xp: 0 },
    stamina: { level: 0, xp: 0 },
  },

  /** Демо-инвентарь: немного сырья, инструмент и два «кота в мешке». */
  inventory: [
    { itemId: 'butylka_steklo', qty: 4 },
    { itemId: 'banka_alyuminiy', qty: 3 },
    { itemId: 'molotok_slesarnyy', qty: 1 },
    { itemId: 'tushenka_bez_etiketki', qty: 1 },
    { itemId: 'u_korobka_berzhnaya', qty: 1 },
    { itemId: 'u_kartina_ramka', qty: 1 },
  ],
  inventoryMaxKg: 5,        // «пакет-майка» — стартовая ёмкость (снаряжение сессии 9)
  bagName: 'Пакет-майка',

  equipment: { gloves: null, jacket: null, cart: null },
  lives: 1,
  legacyBonus: 0,           // наследие репутации (rebirth.js), пока первая жизнь
};

/** ---- Lookup-доступ к справочникам (переедут в js/core в сессии 4+) ---- */
export const findItem = (id) => ITEMS.find((i) => i.id === id);
export const findDistrict = (id) => DISTRICTS.find((d) => d.id === id);
export const findWeather = (id) => WEATHER.find((w) => w.id === id);

/** Вес демо-стопки предметов (у неопознанного веса нет в данных — считаем 0.5 кг). */
export const DIDDEN_WEIGHT_KG = 0.5;

export function stackWeightKg(entry) {
  const item = findItem(entry.itemId);
  return (item?.weight ?? DIDDEN_WEIGHT_KG) * entry.qty;
}

export function inventoryUsedKg() {
  return DEMO.inventory.reduce((sum, entry) => sum + stackWeightKg(entry), 0);
}

/** Доход с попрошайничества за раз (из баланса, выбор человека — стабильное). */
export const BEGGING_INCOME = BEGGING.income;
