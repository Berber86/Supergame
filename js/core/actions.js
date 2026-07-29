/**
 * actions.js — действия игрока (редьюсеры): переходы, попрошайничество,
 * ОБЫСК БАКОВ (сессия 5), еда из находок (сессия 5, минимум для выживания).
 * Каждое действие: применяет свои стоимости → двигает время → пишет журнал.
 * Возвращают events[] (строки для UI-тостов). Рандом — только через роллер
 * из state.rngState, состояние которого пишется обратно в конце действия.
 */

import { ACTIONS, BEGGING, BINS, DIG, DIG_MODES, DIG_TROUBLES, EAT } from '../data/balance.js';
import { findDistrict, findItem, findWeather } from './lookups.js';
import { clampStats, death, pushLog } from './state.js';
import { advanceHours } from './time.js';
import { addItem, rollTrueValue } from './inventory.js';
import { addSkillXp } from './skills.js';
import { makeRoller } from './rng.js';

/** ---- Переходы ---- */

/**
 * Перейти в другой район (часы — из матрицы districts.js).
 * Район меняется ПО ПРИБЫТИИ: дорога проходит «между» точками.
 * По дороге иногда валяется мелочь (BINS.streetFindChance — выбор человека).
 */
export function travelTo(state, toDistrictId, events = []) {
  if (state.status !== 'alive') return events;

  const from = findDistrict(state.districtId);
  const to = findDistrict(toDistrictId);
  if (!to) return events;
  if (to.id === from.id) return events;

  const hours = from.travelHours[to.id] ?? 1;
  state.stats.energy += ACTIONS.travelHour.energy * hours;

  advanceHours(state, hours, events);

  if (state.status === 'alive') {
    state.districtId = to.id;
    const line = `🚶 ${from.name} → ${to.name} (${hours} ч пути)`;
    events.push(line);
    pushLog(state, line);

    // Уличная мелочь (10%): город иногда подбрасывает прямо под ноги.
    const roller = makeRoller(state.rngState);
    if (roller.chance(BINS.streetFindChance)) {
      const pick = roller.weighted(BINS.streetLoot);
      const item = findItem(pick.itemId);
      const res = addItem(state, pick.itemId);
      if (res.fit) {
        events.push(`✨ По дороге: ${item.emoji} ${item.name} — буквально под ногами.`);
        pushLog(state, `Уличная находка: ${item.name}.`);
      } else {
        events.push('🎒 По дороге что-то блеснуло, но пакет уже не вместит.');
      }
    }
    state.rngState = roller.state;
  }
  return events;
}

/** ---- Попрошайничество ---- */

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

/** ---- Обыск баков (сессия 5) ---- */

export const DIG_MODE_IDS = ['careful', 'normal', 'bold'];

/**
 * Режимы обыска и их доступность (выбор человека, сессия 4):
 * «аккуратнее» и «обычно» — с рождения, «смелее» — с 🔍Поиска-3.
 */
export function availableDigModes(state) {
  return DIG_MODE_IDS.map((id) => ({
    id,
    unlocked: id !== 'bold' || state.skills.search.level >= DIG_MODES.bold.unlockLevel,
  }));
}

/** Текущий режим с множителями (невалидный/запертый сбрасывается в «обычно»). */
export function digModeDef(state) {
  if (state.digMode === 'careful') return { id: 'careful', ...DIG_MODES.careful };
  if (state.digMode === 'bold' && state.skills.search.level >= DIG_MODES.bold.unlockLevel) {
    return { id: 'bold', ...DIG_MODES.bold };
  }
  return { id: 'normal', label: 'обычно', lootMult: 1, riskMult: 1 };
}

/** Переключить режим обыска (предпочтение, живёт в state.digMode). */
export function setDigMode(state, mode, events = []) {
  const avail = availableDigModes(state).find((m) => m.id === mode);
  if (!avail || !avail.unlocked) return events;
  state.digMode = mode;
  return events;
}

/**
 * «Богатство» бака сегодня: ОБЕДНЕНИЕ ×0.5 за каждый прошлый обыск
 * (выбор человека, сессия 4), утром бак восполняется (BINS.refillDaily).
 * Богатство текущего обыска = depletionPerDig ^ (сколько раз его уже рыли сегодня).
 */
export function binRichness(state, district, binIndex) {
  const rec = getBinsRecord(state, district.id);
  if (!rec) return 0;
  return Math.pow(BINS.depletionPerDig, rec.digs[binIndex] ?? 0);
}

/**
 * Запись о рытье баков района за СЕГОДНЯ { day, digs: number[] }.
 * Ленивая: чужой день → город «выбросил новое», счётчики обнуляются.
 * Вызывается из ядра и из UI (город показывает обеднение до обыска).
 */
export function getBinsRecord(state, districtId) {
  const district = findDistrict(districtId);
  if (!district || district.binCount === 0) return null;
  const rec = state.bins[districtId];
  if (!rec || rec.day !== state.day || !Array.isArray(rec.digs) || rec.digs.length !== district.binCount) {
    state.bins[districtId] = { day: state.day, digs: Array(district.binCount).fill(0) };
  }
  return state.bins[districtId];
}

/** Вероятность неприятности за обыск: риск района × погода × режим × навык. */
export function digRiskChance(state, district, mode) {
  const weather = findWeather(state.weatherId);
  const searchLevel = state.skills.search.level;
  const p = district.digRisk
    * weather.digRiskMult
    * mode.riskMult
    * Math.pow(DIG.searchRiskMultPerLevel, searchLevel);
  return Math.min(DIG.riskCap, p);
}

/**
 * Обыскать бак №binIndex в текущем районе.
 * Стоимость — ACTIONS.dig; находки — по лут-таблице района с учётом
 * обеднения бака, режима и 🔍Поиска. Неприятности — ЗАГЛУШКА DIG_TROUBLES
 * (настоящие события с выборами — сессия 8; заглушки здоровья ниже 1 не роняют).
 */
export function dig(state, binIndex, events = []) {
  if (state.status !== 'alive') return events;
  const district = findDistrict(state.districtId);
  if (!district || district.binCount === 0) return events;
  if (!Number.isInteger(binIndex) || binIndex < 0 || binIndex >= district.binCount) return events;

  // Стоимость (энергия и грязь — сразу, часы — через advanceHours).
  state.stats.energy += ACTIONS.dig.energy;
  state.stats.cleanliness += ACTIONS.dig.cleanliness;
  clampStats(state);
  advanceHours(state, ACTIONS.dig.hours, events);
  if (state.status !== 'alive') return events; // рытьё закончилось плохо (полночь/отруб)

  const roller = makeRoller(state.rngState);
  const mode = digModeDef(state);
  const searchLevel = state.skills.search.level;

  // Находки: N попыток, каждая — шанс × богатство бака. Не влезло — стоп.
  const richness = binRichness(state, district, binIndex);
  const findChance = Math.min(
    DIG.findChanceCap,
    DIG.baseFindChance * richness * mode.lootMult + DIG.searchChanceBonusPerLevel * searchLevel,
  );
  const found = [];
  let packFull = false;
  for (let i = 0; i < DIG.attemptsPerDig && !packFull; i += 1) {
    if (!roller.chance(findChance)) continue;
    const pick = roller.weighted(district.loot);
    const item = findItem(pick.itemId);
    const trueValue = item.kind === 'unidentified' ? rollTrueValue(item, roller) : null;
    const res = addItem(state, item.id, { qty: 1, trueValue });
    if (!res.fit) {
      packFull = true;
      break;
    }
    found.push(item);
  }

  // Риск обыска (заглушка): тексты-без-выбора, эффекты малы и не летальны.
  let troubleLine = null;
  if (roller.chance(digRiskChance(state, district, mode))) {
    const t = roller.pick(DIG_TROUBLES);
    for (const [key, delta] of Object.entries(t.effects)) state.stats[key] += delta;
    clampStats(state);
    if (state.stats.health < 1) state.stats.health = 1; // заглушки не убивают (сессия 8 — может быть)
    troubleLine = `${t.emoji} ${t.line}`;
  }

  // Учёт обыска ПОСЛЕ времени: если по дороге была полночь, день уже новый —
  // значит, и бак утром «выбросил» свежее, обыск идёт в зачёт нового дня.
  getBinsRecord(state, district.id).digs[binIndex] += 1;

  const foundLine = found.length > 0
    ? found.map((i) => `${i.emoji} ${i.name}`).join(' + ')
    : 'пусто — бак разводит руками';
  const line = `🗑️ Бак №${binIndex + 1} (${mode.label}): ${foundLine}.`;
  events.push(line);
  if (packFull) events.push('🎒 Пакет полон — остальное пришлось оставить. Баку предложить не смог.');
  if (troubleLine) events.push(troubleLine);

  // Навык Поиска растёт от практики (раскачка — сессия 9, зерно сеем уже).
  if (addSkillXp(state, 'search')) {
    const lvl = state.skills.search.level;
    events.push(`⬆️ 🔍 Поиск вырос до уровня ${lvl}!`);
    if (lvl === DIG_MODES.bold.unlockLevel) events.push('😤 Открылся режим «смелее» — баки вздрогнули.');
  }

  pushLog(state, `Обыск бака №${binIndex + 1} в районе «${district.name}»: ${foundLine}.`);

  state.rngState = roller.state;
  return events;
}

/** ---- Еда из находок (минимум для выживания, сессия 5) ---- */

/**
 * Съесть еду из ноши. Покупная еда и столовая — сессия 8; без этого
 * редьюсера находки-еда были бы балластом, а голод — приговором.
 * healthRisk предмета (тушёнка, шаверма) — лотерея: проиграл → −EAT.riskyFindDamage ❤️.
 * Отравление МОЖЕТ быть последним обедом (честная игра: риск написан на банке… мысленно).
 */
export function eat(state, itemId, events = []) {
  if (state.status !== 'alive') return events;
  const item = findItem(itemId);
  if (!item || item.kind !== 'food') return events;
  const idx = state.inventory.findIndex((e) => e.itemId === itemId);
  if (idx === -1) return events;

  const roller = makeRoller(state.rngState);

  const entry = state.inventory[idx];
  entry.qty -= 1;
  if (entry.qty <= 0) state.inventory.splice(idx, 1);

  state.stats.satiety += item.satiety;
  let line = `🍽️ ${item.emoji} ${item.name}: +${item.satiety} 🍞.`;
  if (item.healthRisk && roller.chance(item.healthRisk)) {
    state.stats.health -= EAT.riskyFindDamage;
    line += ` Желудок подал протест: −${EAT.riskyFindDamage} ❤️.`;
  }
  clampStats(state);
  state.rngState = roller.state;

  if (state.stats.health <= 0) {
    pushLog(state, `Отравился: ${item.name}.`);
    death(state, `Отравился: ${item.name}. Причина кончины — обед.`, events);
    return events;
  }

  events.push(line);
  pushLog(state, line);
  return events;
}
