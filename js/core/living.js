/**
 * living.js — быт за деньги (сессия 8): покупная еда, мытьё, выбор ночлега.
 *
 * Еда покупки = съедение «на месте»: дошик/столовая/шаверма сразу идут в
 * сытость, в ношу не кладутся (ноша про находки, иначе экран «купил-положил-
 * достал-съел» превратится в складскую романтику). Стоимость — деньги и час
 * (очередь в столовой — тоже судьба). Мытьё — час и вода города, бесплатно.
 * Ночлег — НЕМЕДЛЕННОГО сна не даёт: выбирается вперёд, списывается при отбое
 * (полночь тебя найдёт сам; отрубился на улице — лавка, не до кассы).
 */

import { ACTIONS, LIVING } from '../data/balance.js';
import { findShelter } from './lookups.js';
import { clampStats, pushLog } from './state.js';
import { advanceHours } from './time.js';

/**
 * Купить и съесть горячее. Не по карману — обошлось без траты времени:
 * посчитал мелочь у ларька, вздохнул, пошёл дальше.
 */
export function buyFood(state, foodId, events = []) {
  if (state.status !== 'alive') return events;
  const food = LIVING.food.find((f) => f.id === foodId);
  if (!food) return events;

  if (state.money < food.price) {
    const line = `💸 «${food.name}» — ${food.price} ₽ при твоих ${Math.round(state.money)} ₽. Хороший был повод посчитать мелочь.`;
    events.push(line);
    pushLog(state, `Не хватило на еду: ${food.name} (${food.price} ₽).`);
    return events;
  }

  advanceHours(state, ACTIONS.eatOut.hours, events);
  if (state.status !== 'alive') return events;

  state.money -= food.price;
  const satietyBefore = state.stats.satiety;
  state.stats.satiety += food.satiety;
  if (food.cleanliness) state.stats.cleanliness += food.cleanliness;
  clampStats(state);

  const cleanNote = food.cleanliness ? ` (руки в соусе: ${food.cleanliness} 🧼)` : '';
  const line = `${food.emoji} ${food.name} (−${food.price} ₽): 🍞 ${Math.round(satietyBefore)} → ${Math.round(state.stats.satiety)}${cleanNote}. Горячее — это счастье, которое не надо жевать долго.`;
  events.push(line);
  pushLog(state, `Поел: ${food.name} за ${food.price} ₽.`);
  return events;
}

/** Умыться (бесплатно, час на раковину вокзала). Нужно и для фейс-контроля 🧺. */
export function wash(state, events = []) {
  if (state.status !== 'alive') return events;

  advanceHours(state, ACTIONS.wash.hours, events);
  if (state.status !== 'alive') return events;

  const before = state.stats.cleanliness;
  state.stats.cleanliness += ACTIONS.wash.cleanliness;
  clampStats(state);

  const line = `🚿 Умылся где пришлось: 🧼 ${Math.round(before)} → ${Math.round(state.stats.cleanliness)}. Питер выдаёт воду по расписанию, но выдаёт.`;
  events.push(line);
  pushLog(state, 'Умылся (час, бесплатно).');
  return events;
}

/**
 * Выбрать, где спать сегодня. Деньги снимутся при отбое (sleep в core/time.js);
 * не хватит к полуночи — переложит на лавку, там и пожурит. Выбор бесплатен
 * и не занимает время: это решение, а не действие.
 */
export function chooseShelter(state, shelterId, events = []) {
  if (state.status !== 'alive') return events;
  const shelter = findShelter(shelterId);
  if (!shelter) return events;
  if (state.shelterTonight === shelter.id) return events;

  state.shelterTonight = shelter.id;
  const line = shelter.price > 0
    ? `🛏️ Ночуем в «${shelter.name}»: при отбое минус ${shelter.price} ₽, зато сон на ${Math.round(shelter.quality * 100)}%.`
    : `🛏️ Сэкономим: ночь на лавке. Бесплатно, но в мороз — риск, и карманы «дышат» (15% кражи).`;
  events.push(line);
  pushLog(state, `Ночлег на сегодня: ${shelter.name}.`);
  return events;
}
