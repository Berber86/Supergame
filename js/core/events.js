/**
 * events.js — обработчик выборов модальных событий (сессия 8).
 *
 * Расписание и срабатывание живут в core/time.js (час дня назначается наутро,
 * 1 событие/день — выбор человека 2A). Здесь — судьба выбранного варианта.
 * Словарь эффектов — договорённость js/data/events.js ↔ этот файл:
 *
 *  money: ±₽ (в минус — не глубже кармана: нищих не штрафуют дважды)
 *  satiety/warmth/health/energy/cleanliness: ±N (кламп 0..100)
 *  loseRandomItem: true          — отдать случайную находку (стопку — целиком)
 *  loseCategoryItem: 'eda'|...   — отдать ОДНУ вещь категории (стопка −1)
 *  addItem: itemId               — подобрать (если пакет вместит)
 *  timeHours: -N                 — потерять часы (уйдут через advanceHours:
 *                                  может и в полночь упасть — тогда спать)
 *  riskHealth: { chance, amount }— лотерея урона; проиграл и умер — причина
 *                                  кончины честно назовёт событие
 *  flag: 'строка'                — репутационный флаг (белый список живёт)
 *  boostTomorrow: { district }   — «слух»: завтра этот район жирный
 *
 * Порядок внутри выбора: деньги → статы → вещи → риск → флаг/слух →
 * снять pendingEvent → записать rngState → потерянные часы (в конце: могут
 * привести к сну/смерти — и тогда модалка уже закрыта, город всё видел).
 */

import { EVENT_DAY } from '../data/balance.js';
import { EVENTS } from '../data/events.js';
import { DISTRICTS } from '../data/districts.js';
import { findItem } from './lookups.js';
import { addItem } from './inventory.js';
import { clampStats, death, pushLog } from './state.js';
import { advanceHours } from './time.js';
import { makeRoller } from './rng.js';

const STAT_KEYS = ['satiety', 'warmth', 'health', 'energy', 'cleanliness'];
const STAT_EMOJI = {
  satiety: '🍞', warmth: '🔥', health: '❤️', energy: '⚡', cleanliness: '🧼',
};

export const findEvent = (id) => EVENTS.find((e) => e.id === id);

/**
 * Доступность варианта (для UI: серые кнопки) и зеркальный гвард редьюсера.
 * { enabled, reason } — reason короткий, для подсказки на кнопке.
 */
export function choiceAvailability(state, choice) {
  const ef = choice.effects ?? {};
  if (ef.loseRandomItem && state.inventory.length === 0) {
    return { enabled: false, reason: 'пожертвовать нечего — пакет пуст' };
  }
  if (ef.loseCategoryItem) {
    const has = state.inventory.some((e) => findItem(e.itemId)?.category === ef.loseCategoryItem);
    if (!has) return { enabled: false, reason: 'нечем поделиться — нужной категории в ношe нет' };
  }
  if (ef.money != null && ef.money < 0 && state.money <= 0) {
    return { enabled: false, reason: 'карманы пусты — откупиться нечем' };
  }
  return { enabled: true, reason: null };
}

const signed = (n) => (n > 0 ? `+${n}` : `${n}`);

/**
 * Применить выбранный вариант события. Возвращает events[] для тостов.
 * Ответ даётся один раз — модалка снимается, последствия вступают в права.
 */
export function applyEventChoice(state, choiceId, events = []) {
  if (state.status !== 'alive' || !state.pendingEvent) return events;
  const event = findEvent(state.pendingEvent.eventId);
  const choice = event?.choices.find((c) => c.id === choiceId);
  if (!event || !choice) return events;
  if (!choiceAvailability(state, choice).enabled) return events; // UI и так серая кнопка — тут страховка

  const roller = makeRoller(state.rngState);
  const ef = choice.effects ?? {};
  const lines = [];

  // 1. Деньги (минус — не глубже кармана).
  if (ef.money != null) {
    if (ef.money < 0) {
      const pay = Math.min(state.money, -ef.money);
      state.money -= pay;
      lines.push(pay < -ef.money
        ? `${signed(-pay)} ₽ — всё, что было. Приняли и молчание.`
        : `${signed(ef.money)} ₽.`);
    } else {
      state.money += ef.money;
      state.earnedThisLife += ef.money;
      lines.push(`+${ef.money} ₽.`);
    }
  }

  // 2. Статы.
  for (const key of STAT_KEYS) {
    if (ef[key] != null && ef[key] !== 0) {
      state.stats[key] += ef[key];
      lines.push(`${signed(ef[key])} ${STAT_EMOJI[key]}.`);
    }
  }
  clampStats(state);

  // 3. Вещи.
  if (ef.loseRandomItem && state.inventory.length > 0) {
    const idx = roller.int(state.inventory.length);
    const [lost] = state.inventory.splice(idx, 1);
    const name = findItem(lost.itemId)?.name ?? lost.itemId;
    lines.push(`Отдано: ${name}.`);
  }
  if (ef.loseCategoryItem) {
    const idx = state.inventory.findIndex((e) => findItem(e.itemId)?.category === ef.loseCategoryItem);
    if (idx >= 0) {
      const entry = state.inventory[idx];
      const name = findItem(entry.itemId)?.name ?? entry.itemId;
      entry.qty -= 1;
      if (entry.qty <= 0) state.inventory.splice(idx, 1);
      lines.push(`Поделился: ${name}.`);
    }
  }
  if (ef.addItem) {
    const res = addItem(state, ef.addItem);
    const item = findItem(ef.addItem);
    lines.push(res.fit
      ? `Подобрал: ${item.emoji} ${item.name}.`
      : 'Подобрать не вышло — пакет полон. Город оставит это другому.');
  }

  // 4. Риск-лотерея урона (последствия в лицо).
  let died = false;
  if (ef.riskHealth && roller.chance(ef.riskHealth.chance)) {
    state.stats.health += ef.riskHealth.amount;
    clampStats(state);
    lines.push(`Не повезло: ${signed(ef.riskHealth.amount)} ❤️.`);
    if (state.stats.health <= 0) {
      died = true;
    }
  }

  // 5. Флаг репутации и слух о жирном районе.
  if (ef.flag) state.flags[ef.flag] = true;
  if (ef.boostTomorrow) {
    const fat = DISTRICTS.filter((d) => d.binCount > 0);
    const district = ef.boostTomorrow.district === 'random'
      ? roller.pick(fat)
      : DISTRICTS.find((d) => d.id === ef.boostTomorrow.district) ?? roller.pick(fat);
    state.dailyBoost = { day: state.day + 1, districtId: district.id };
    lines.push(`Завтра жирно в районе «${district.name}» (богатство баков ×${EVENT_DAY.rumorRichnessMult}).`);
  }

  // 6. Модалка закрывается что бы ни случилось дальше; RNG зафиксирован.
  state.pendingEvent = null;
  state.rngState = roller.state;

  events.push(`${event.emoji} ${event.title}: ${choice.text}.`);
  for (const l of lines) events.push(l);
  pushLog(state, `Событие «${event.title}»: выбор «${choice.text}». ${lines.join(' ')}`.trim());

  // 7. Смерть от риска — после всех строк, чтобы эпилог знал причину.
  if (died) {
    death(state, `Событие «${event.title}» закончилось плохо: риск не оправдался. Город шумел дальше.`, events);
    return events;
  }

  // 8. Потерянные часы — самым концом (внутри может быть полночь и сон).
  if (ef.timeHours != null && ef.timeHours < 0) {
    events.push(`⏳ Потеряно ${signed(ef.timeHours)} ч.`); // плюс-минус лирика распада — по пути
    advanceHours(state, -ef.timeHours, events);
  } else if (ef.timeHours != null && ef.timeHours > 0) {
    state.hour = Math.max(8, state.hour - ef.timeHours); // «выигрыш времени» — редкость; часы двигаем назад
  }
  return events;
}
