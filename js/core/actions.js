/**
 * actions.js — действия игрока (редьюсеры первой волны, сессия 4):
 * переход между районами и попрошайничество.
 * Каждое действие: применяет свои стоимости → двигает время → пишет журнал.
 * Возвращают events[] (строки для UI-тостов).
 */

import { BEGGING } from '../data/balance.js';
import { findDistrict } from './lookups.js';
import { pushLog } from './state.js';
import { advanceHours } from './time.js';

const TRAVEL_ENERGY_PER_HOUR = -4; // balance.js → ACTIONS.travelHour.energy

/**
 * Перейти в другой район (часы — из матрицы districts.js).
 * Район меняется ПО ПРИБЫТИИ: дорога проходит «между» точками.
 */
export function travelTo(state, toDistrictId, events = []) {
  if (state.status !== 'alive') return events;

  const from = findDistrict(state.districtId);
  const to = findDistrict(toDistrictId);
  if (!to) return events;
  if (to.id === from.id) return events;

  const hours = from.travelHours[to.id] ?? 1;
  state.stats.energy += TRAVEL_ENERGY_PER_HOUR * hours;

  advanceHours(state, hours, events);

  if (state.status === 'alive') {
    state.districtId = to.id;
    const line = `🚶 ${from.name} → ${to.name} (${hours} ч пути)`;
    events.push(line);
    pushLog(state, line);
  }
  return events;
}

/**
 * Постоять с шапкой: стабильно-скучный доход (выбор человека, сессия 2).
 * Гарантированно, без событий, без риска — подушка на голодный день.
 */
export function beg(state, events = []) {
  if (state.status !== 'alive') return events;

  advanceHours(state, BEGGING.hours, events);

  if (state.status === 'alive') {
    state.money += BEGGING.income;
    state.earnedThisLife += BEGGING.income;
    const line = `🧢 Час с шапкой: +${BEGGING.income} ₽. Скука оплачена.`;
    events.push(line);
    pushLog(state, line);
  }
  return events;
}
