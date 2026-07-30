/**
 * time.js — течение времени: почасовой распад, сон, смена погоды,
 * ночные риски лавки (выбор человека: морозная лавка СМЕРТЕЛЬНА).
 * Все функции — редьюсеры: мутируют state + пушат строки в events[]
 * (events возвращается наружу — UI показывает их тостами).
 */

import { DECAY, EVENT_DAY, LIVING, NIGHT_RISK, TIME } from '../data/balance.js';
import { WEATHER } from '../data/weather.js';
import { EVENTS } from '../data/events.js';
import { findItem, findShelter, findWeather } from './lookups.js';
import { warmthDecayEquipMult } from './equipment.js';
import { clampStats, death, pushLog } from './state.js';
import { makeRoller } from './rng.js';

/**
 * Прошло hours часов активного времени. На каждом часу — распад статов.
 * Полночь → вынужденный сон (куда вечером наметил — туда и идёшь: shelterTonight).
 * Энергия на нуле → отключился прямо на улице (тот же вынужденный сон, но лавка).
 */
export function advanceHours(state, hours, events = []) {
  for (let i = 0; i < hours && state.status === 'alive'; i += 1) {
    if (state.hour >= 23) {
      // Час полуночи «съедается» сном: продолжаем счёт уже утренних часов.
      nightFalls(state, state.shelterTonight ?? 'lavka', events);
      continue;
    }

    state.hour += 1;

    const weather = findWeather(state.weatherId);
    const equipWarmth = warmthDecayEquipMult(state); // 🧥 сессия 9: куртка против Невы
    state.stats.satiety += DECAY.satietyPerHour;
    state.stats.warmth += DECAY.warmthPerHour * weather.warmthMult * equipWarmth;
    state.stats.energy += DECAY.energyPerHour;
    state.stats.cleanliness += DECAY.cleanlinessPerHour;
    clampStats(state);

    // Голод или холод жрут здоровье (GDD §8).
    if (state.stats.satiety <= 0 || state.stats.warmth <= 0) {
      state.stats.health += DECAY.healthPerHourAtZero;
      clampStats(state);
      if (state.stats.health <= 0) {
        const cause = state.stats.satiety <= 0
          ? 'Голод довёл до конца. Петербург накормил других.'
          : 'Холод довёл до конца. Нева приняла без обид.';
        death(state, cause, events);
        break;
      }
    }

    // Отруб от усталости — на улице, значит, без права выбора койки.
    if (state.stats.energy <= 0) {
      events.push('😴 Силы кончились — отключился там, где стоял.');
      pushLog(state, 'Отключился от усталости прямо на улице.');
      nightFalls(state, 'lavka', events);
      continue;
    }

    // Точечное событие дня (сессия 8): час наступил — жизнь постучалась.
    // Модальное окно выбора (UI); редьюсер-обработчик — core/events.js.
    if (!state.pendingEvent && state.eventAtHour != null && state.hour >= state.eventAtHour) {
      fireDailyEvent(state, events);
    }
  }
  return events;
}

/**
 * Событие дня сработало: выбрать из пула (все EVENTS — контексты данные
 * оставлены для будущих привязок; точечность мы получаем ЧАСОМ, а не актом),
 * повесить pendingEvent — игру ждёт модалка. Расписание израсходовано.
 */
function fireDailyEvent(state, events) {
  const roller = makeRoller(state.rngState);
  const event = roller.weighted(EVENTS);
  state.pendingEvent = { eventId: event.id };
  state.eventAtHour = null;
  state.rngState = roller.state;
  events.push(`${event.emoji} ${event.title} — момент выбора.`);
  pushLog(state, `Событие дня: ${event.title}.`);
}

/**
 * Сон до утра (выбор человека — жёсткий режим лавки):
 *  - лавка + ❄️мороз → 20% не проснуться;
 *  - лавка → 15% потерять случайную находку за ночь;
 *  - энергия = 100 × качество ночлега (кап 100);
 *  - здоровье регенерит, если ложился сытым.
 * Платный ночлег списывает деньги; не хватило → лавка.
 */
export function sleep(state, shelterId = 'lavka', events = []) {
  let shelter = findShelter(shelterId);
  if (!shelter) shelter = findShelter('lavka');
  if (shelter.price > state.money) {
    events.push(`💸 На «${shelter.name}» не хватило — ночуешь бесплатно.`);
    shelter = findShelter('lavka');
  }
  state.money -= shelter.price;

  const roller = makeRoller(state.rngState);

  // Ночные риски лавки (NIGHT_RISK — решение человека из сессии 3).
  if (shelter.riskEvents) {
    const sleptInFrost = state.weatherId === 'frost';
    if (sleptInFrost && roller.chance(NIGHT_RISK.lavkaFrostDeathChance)) {
      state.rngState = roller.state;
      death(state, 'Морозная ночь на лавке. Уснул — не проснулся. МЧС предупреждало.', events);
      return events;
    }
    if (roller.chance(NIGHT_RISK.lavkaStealChance) && state.inventory.length > 0) {
      const idx = roller.int(state.inventory.length);
      const stolen = state.inventory.splice(idx, 1)[0];
      const name = findItem(stolen.itemId)?.name ?? stolen.itemId;
      events.push(`🥷 Ночью стащили: ${name}. Лавка — это общая спальня города.`);
      pushLog(state, 'Обокрали во сне на лавке.');
    }
    state.stats.warmth += NIGHT_RISK.lavkaBadSleepWarmth;
  }

  const energyBefore = state.stats.energy;
  state.stats.energy = Math.min(100, LIVING.energyFromSleep * shelter.quality);
  if (shelter.warmthBonus) {
    state.stats.warmth += shelter.warmthBonus; // тёплая койка греет ночью (баланс-пас, сессия 10)
  }
  if (state.stats.satiety > 50) {
    state.stats.health += DECAY.healthRegenAtNight * TIME.SLEEP_HOURS;
  }

  // Утро: новый день, новая погода — и расписание точечного события дня
  // (выбор человека 2A: не чаще раза в день; тихие дни бывают — 1−dailyChance).
  state.day += 1;
  state.hour = TIME.START_HOUR;
  const weather = roller.weighted(WEATHER);
  state.weatherId = weather.id;
  state.eventRolledForDay = state.day;
  state.eventAtHour = roller.chance(EVENT_DAY.dailyChance)
    ? EVENT_DAY.earliestHour + roller.int(EVENT_DAY.latestHour - EVENT_DAY.earliestHour + 1)
    : null;
  state.rngState = roller.state;
  clampStats(state);

  const sleptLine = shelter.quality >= 1
    ? `🛏️ ${shelter.name}: выспался как дома (энергия ${Math.round(energyBefore)} → ${Math.round(state.stats.energy)}).`
    : `🛏️ ${shelter.name}: энергия ${Math.round(energyBefore)} → ${Math.round(state.stats.energy)}.`;
  events.push(sleptLine);
  events.push(`${weather.emoji} День ${state.day}. ${weather.note}`);
  pushLog(state, `Ночь: ${shelter.name}. Утро — ${weather.name}.`);
  return events;
}

/** Полночь наступила сама — игрок не успел лечь. Тот же сон, но без выбора места. */
function nightFalls(state, shelterId, events) {
  events.push('🌙 Полночь. Город выключается раньше тебя.');
  sleep(state, shelterId, events);
}

/** Санity-проверка: сейчас день (8..23) и жив. Хелпер для будущих действий. */
export function isDayHour(hour) {
  return hour >= TIME.START_HOUR && hour <= 23;
}
