/**
 * identify.js — идентификация неопознанных находок (сессия 6).
 *
 * Три пути узнать цену ❓-предмета (GDD §3.3):
 *  1. 👁️ Самостоятельная оценка — час ритуала, результат СОХРАНЯЕТСЯ на
 *     предмете (estimate {low, high, level}); диапазон сужается с навыком,
 *     с lvl 8 — точная цена. Формат — усмотрение агента (выбор человека 2D).
 *  2. Эксперты-NPC — Герыч (антиквариат, 20% мин 100 ₽), Слива (техника,
 *     150 ₽): точная цена + флаг identified, гонорар деньгами.
 *  3. Продажа вслепую Тени — неопознанное за 110–130% истинной цены…
 *     если не кинет (P(честно) = 0.65 + 0.03×🤝, кап 0.9). Кидок = 0 ₽ + скандал.
 *     Формула честности живёт в core/trade.js (сессия 7) — азарт един и для
 *     вслепую, и для опознанного.
 */

import { ACTIONS, ASSESS, SCAM } from '../data/balance.js';
import { findBuyer, findExpert, findItem } from './lookups.js';
import { clampStats, pushLog } from './state.js';
import { advanceHours } from './time.js';
import { addSkillXp } from './skills.js';
import { makeRoller } from './rng.js';
import { perekupHonestChance } from './trade.js';

/** Ширина глазомера: lvl 0 → 1 (широчайший), lvl 8+ → 0 (точная цена). */
export function assessSpread(level) {
  return Math.max(0, 1 - level * ASSESS.spreadPerLevel);
}

/**
 * Чистая формула оценки: из СКРЫТОЙ цены и уровня навыка → { low, high, exact }.
 * Центр диапазона зашумлён (роллер): низкий уровень не взламывается делением
 * границ друг на друга. Округление: low в пол, high в потолок (журналист ₽).
 */
export function estimateFor(trueValue, level, roller) {
  const spread = assessSpread(level);
  if (spread <= 0) return { low: trueValue, high: trueValue, exact: true };
  const noise = 1 + (roller.roll() - 0.5) * ASSESS.centerNoisePerSpread * spread;
  const center = trueValue * noise;
  return {
    low: Math.max(0, Math.floor(center * (1 - spread))),
    high: Math.max(0, Math.ceil(center * (1 + spread))),
    exact: false,
  };
}

/** Достать запись ноши по индексу: только неопознанное с известной (нам) тайной ценой. */
function unidentifiedEntry(state, entryIndex) {
  if (!Number.isInteger(entryIndex)) return null;
  const entry = state.inventory[entryIndex];
  if (!entry || entry.trueValue == null) return null;
  const item = findItem(entry.itemId);
  if (!item || item.kind !== 'unidentified') return null;
  return { entry, item };
}

/**
 * 👁️ Оценить самому: час пристального разглядывания.
 * Результат перезаписывает прежний estimate (глазомер стареет, растёшь — переоценивай).
 */
export function assessSelf(state, entryIndex, events = []) {
  if (state.status !== 'alive') return events;
  const found = unidentifiedEntry(state, entryIndex);
  if (!found) return events;
  const { entry, item } = found;
  if (entry.identified) return events; // уже знаешь — к экспертам поздно

  advanceHours(state, ACTIONS.assessSelf.hours, events);
  if (state.status !== 'alive') return events;

  const roller = makeRoller(state.rngState);
  const level = state.skills.assess.level;
  entry.estimate = { ...estimateFor(entry.trueValue, level, roller), level };

  const line = entry.estimate.exact
    ? `👁️ Кропотливый час: «${item.name}» — без сомнений ${entry.estimate.high} ₽.`
    : `👁️ Час разглядывания: «${item.name}» — похоже на ${entry.estimate.low}–${entry.estimate.high} ₽ (глазомер-${level}).`;
  events.push(line);
  pushLog(state, `Самооценка: ${item.name} ≈ ${entry.estimate.low}–${entry.estimate.high} ₽.`);

  if (addSkillXp(state, 'assess')) {
    events.push(`⬆️ 👁️ Оценка выросла до уровня ${state.skills.assess.level}!`);
  }

  state.rngState = roller.state;
  return events;
}

/**
 * К эксперту: точная цена + флаг identified, гонорар деньгами.
 * percent-гонорар (Герыч) зависит от СКРЫТОЙ цены — «от 100 ₽, дальше по цене»,
 * игрок платит за сюрприз сполна. Не по карману — час всё равно потерян
 * (сходил, выслушал расклад, ушёл ни с чем).
 */
export function expertAssess(state, entryIndex, expertId, events = []) {
  if (state.status !== 'alive') return events;
  const found = unidentifiedEntry(state, entryIndex);
  if (!found) return events;
  const { entry, item } = found;
  if (entry.identified) return events;

  const expert = findExpert(expertId);
  if (!expert || !expert.specialties.includes(item.guess.expertCategory)) return events;

  const fee = expert.fee.type === 'percent'
    ? Math.max(expert.fee.min, Math.round(entry.trueValue * expert.fee.value))
    : expert.fee.value;

  advanceHours(state, ACTIONS.expertVisit.hours, events);
  if (state.status !== 'alive') return events;

  if (state.money < fee) {
    events.push(`💸 ${expert.name}: гонорар ${fee} ₽ при твоих ${Math.round(state.money)} ₽ — разошлись миром.`);
    pushLog(state, `К ${expert.name} с «${item.name}» — не по карману (${fee} ₽).`);
    return events;
  }

  state.money -= fee;
  entry.identified = true;
  entry.estimate = { low: entry.trueValue, high: entry.trueValue, exact: true, expert: expert.id };

  const line = `${expert.emoji} ${expert.name}: «${item.name}» — ${entry.trueValue} ₽, точняк. Гонорар ${fee} ₽.`;
  events.push(line);
  pushLog(state, `Эксперт ${expert.name}: ${item.name} → ${entry.trueValue} ₽ (гонорар ${fee} ₽).`);

  if (addSkillXp(state, 'assess')) {
    events.push(`⬆️ 👁️ Оценка выросла до уровня ${state.skills.assess.level}!`);
  }

  return events;
}

/**
 * Продать неопознанное вслепую 🕶️ Тени. Он-то цену знает всегда.
 * Честно: 110–130% от истинной × наследие репутации. Кинул: 0 ₽ + скандал.
 * Опознанное — не сюда: с известной ценой иди к скупщикам (сессия 7).
 */
export function blindSell(state, entryIndex, events = []) {
  if (state.status !== 'alive') return events;
  const found = unidentifiedEntry(state, entryIndex);
  if (!found) return events;
  const { entry, item } = found;
  if (entry.identified) return events;

  const perekup = findBuyer('perekup');

  advanceHours(state, ACTIONS.saleInstant.hours, events);
  if (state.status !== 'alive') return events;

  const roller = makeRoller(state.rngState);
  const honestChance = perekupHonestChance(state);

  state.inventory.splice(entryIndex, 1); // предмет ушёл к Тени в любом исходе

  if (roller.chance(honestChance)) {
    const multRaw = perekup.priceMult.min
      + roller.roll() * (perekup.priceMult.max - perekup.priceMult.min);
    const price = Math.round(entry.trueValue * multRaw * (1 + state.legacyBonus));
    state.money += price;
    state.earnedThisLife += price;
    const line = `🕶️ Тень пересчитала купюры, не глядя в пакет: +${price} ₽ за «${item.name}». Не спрашивай, откуда она знала.`;
    events.push(line);
    pushLog(state, `Тень выкупила вслепую: ${item.name} → ${price} ₽.`);
  } else {
    state.stats.cleanliness += SCAM.scandalCleanliness;
    clampStats(state);
    const line = `🕶️ Тень кивнула, взяла «${item.name}»… и растворилась с ним в сумерках. Скандал у гаражей: 0 ₽ и лишние взгляды (${SCAM.scandalCleanliness} 🧼).`;
    events.push(line);
    pushLog(state, `Тень кинула на «${item.name}»: 0 ₽ и скандал.`);
  }

  state.rngState = roller.state;
  return events;
}
