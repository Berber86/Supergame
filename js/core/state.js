/**
 * state.js — GameState: создание игры, журнал, смерть и новая жизнь.
 *
 * Состояние — один plain-объект (см. ARCHITECTURE.md), мутируется только
 * редьюсерами. Сериализуем в JSON без потерь: никаких функций/замыканий —
 * даже RNG хранится как целое rngState (см. rng.js).
 */

import { START, TIME, SKILLS } from '../data/balance.js';
import { WEATHER } from '../data/weather.js';
import { REBIRTH } from '../data/rebirth.js';
import { makeRoller } from './rng.js';

/** Версия формата сейва (миграции — позже, persist.js). */
export const SAVE_VERSION = 1;

/** Кап журнала, чтобы сейв не пух бесконечно. */
const LOG_CAP = 80;

/** Записать строчку в журнал игрока (с днём и часом). */
export function pushLog(state, text) {
  state.log.push({ day: state.day, hour: state.hour, text });
  if (state.log.length > LOG_CAP) state.log.shift();
}

/** Кламп статов 0..100 — послаблений питерское небо не делает. */
export function clampStats(state) {
  for (const key of ['satiety', 'warmth', 'health', 'energy', 'cleanliness']) {
    state.stats[key] = Math.max(0, Math.min(100, state.stats[key]));
  }
}

/** Свежий объект начальных навыков (все 0 lvl / 0 xp). */
function freshSkills() {
  const skills = {};
  for (const key of Object.keys(SKILLS.list)) {
    skills[key] = { level: 0, xp: 0 };
  }
  return skills;
}

/**
 * Создать новую игру (первая жизнь, day 1).
 * seed = undefined → берётся «случайный» от времени (для UI); тесты всегда
 * передают явный сид ради детерминизма.
 */
export function createGame(seed = Date.now() % 100000) {
  const roller = makeRoller(seed);
  const weatherEntry = roller.weighted(WEATHER);

  const state = {
    saveVersion: SAVE_VERSION,
    seed,
    rngState: roller.state,

    day: 1,
    hour: TIME.START_HOUR,
    weatherId: weatherEntry.id,
    districtId: 'nochlezhka',

    money: START.money,
    stats: {
      satiety: START.satiety,
      warmth: START.warmth,
      health: START.health,
      energy: START.energy,
      cleanliness: START.cleanliness,
    },

    skills: freshSkills(),
    inventory: [],                       // [{ itemId, qty, trueValue?, identified? }] — см. core/inventory.js
    equipment: { gloves: null, jacket: null, cart: null },
    bins: {},                            // обеднение баков: { [districtId]: { day, digs[] } } — core/actions.js
    digMode: 'normal',                   // режим обыска: careful | normal | bold (см. DIG_MODES)

    flags: {},                           // репутационные/сюжетные флаги событий
    lives: 1,
    legacyBonus: 0,                      // наследие репутации (rebirth.js)

    status: 'alive',                     // 'alive' | 'dead'
    deathCause: null,
    earnedThisLife: 0,                   // сколько ₽ поднял за эту жизнь (для эпилога)
    bestItemLabel: null,                 // лучшая находка жизни (для эпилога, сессия 5+)

    log: [],
  };

  pushLog(state, `Новая жизнь началась. ${weatherEntry.note}`);
  return state;
}

/** Смерть: фиксируем конец жизни. Новую начнёт newLife() — по правилам мягкого рогалика. */
export function death(state, cause, events = []) {
  if (state.status === 'dead') return;
  state.status = 'dead';
  state.deathCause = cause;
  const line = `💀 ${cause}`;
  pushLog(state, line);
  events.push(line);
}

/**
 * Новая жизнь (выбор человека из сессии 1: МЯГКИЙ РОГАЛИК).
 * Навыки и белый список флагов переживают смерть; деньги и ноша — нет.
 */
export function newLife(state, events = []) {
  const roller = makeRoller(state.rngState);

  // Белый список репутационных флагов (rebirth.js → keep.flags).
  const keptFlags = {};
  for (const f of REBIRTH.keep.flags) {
    if (state.flags[f]) keptFlags[f] = state.flags[f];
  }

  state.lives += 1;
  state.legacyBonus = Math.min(
    REBIRTH.legacy.reputationBonusCap,
    state.legacyBonus + REBIRTH.legacy.reputationBonusPerLife,
  );

  state.flags = keptFlags;
  state.inventory = [];
  state.equipment = { gloves: null, jacket: null, cart: null };
  state.bins = {};
  state.digMode = 'normal';

  state.money = REBIRTH.start.money;
  state.stats = {
    satiety: REBIRTH.start.satiety,
    warmth: REBIRTH.start.warmth,
    health: REBIRTH.start.health,
    energy: REBIRTH.start.energy,
    cleanliness: REBIRTH.start.cleanliness,
  };

  state.day = 1;
  state.hour = TIME.START_HOUR;
  state.districtId = 'nochlezhka';
  state.status = 'alive';
  state.deathCause = null;
  state.earnedThisLife = 0;
  state.bestItemLabel = null;

  const weatherEntry = roller.weighted(WEATHER);
  state.weatherId = weatherEntry.id;
  state.rngState = roller.state;

  const line = `🌅 Жизнь №${state.lives}. Навыки при тебе, репутация помнит тебя (+${Math.round(state.legacyBonus * 100)}% к выкупу).`;
  pushLog(state, line);
  events.push(line);
  return state;
}
