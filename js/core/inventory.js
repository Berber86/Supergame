/**
 * inventory.js — ноша игрока: вес, ёмкость, стопки, скрытая цена неопознанного.
 *
 * Формат записи ноши (GameState.inventory):
 *   { itemId, qty }                          — очевидное/еда (стакается по itemId)
 *   { itemId, qty: 1, trueValue, identified }— неопознанное (каждая находка — своя
 *                                             лотерея, поэтому НЕ стакается)
 * trueValue бросается ПРИ НАХОДКЕ (тир → равномерно внутри тира, GDD §8) —
 * иначе игрок мог бы «переобследовать реальность» сейв/лоадом.
 */

import { CARRY } from '../data/balance.js';
import { findItem } from './lookups.js';
import { carryBonusEquipKg } from './equipment.js';

/** Вес одной записи ноши (кг). Неопознанному — условный вес из CARRY. */
export function entryWeightKg(entry) {
  const item = findItem(entry.itemId);
  return (item?.weight ?? CARRY.unidentifiedKg) * entry.qty;
}

/** Сколько сейчас весит вся ноша (кг). */
export function inventoryUsedKg(state) {
  return state.inventory.reduce((sum, e) => sum + entryWeightKg(e), 0);
}

/** Ёмкость ноши (кг): база + бонус за уровни 💪Выносливости + тележка 🛒. */
export function capacityKg(state) {
  return CARRY.baseKg + CARRY.staminaBonusKg * state.skills.stamina.level + carryBonusEquipKg(state);
}

/**
 * Бросить тайную цену неопознанного предмета: взвешенный выбор тира
 * по guess.tiers, затем равномерная цена внутри тира (округление до целых ₽).
 * Чистая по роллеру функция — детерминизм гарантирует вызывающий.
 */
export function rollTrueValue(item, roller) {
  const tiers = item.guess.tiers;
  let r = roller.roll();
  let tier = tiers[tiers.length - 1];
  for (const t of tiers) {
    r -= t.chance;
    if (r < 0) { tier = t; break; }
  }
  return Math.round(tier.min + roller.roll() * (tier.max - tier.min));
}

/**
 * Положить предмет в ношу с проверкой ёмкости.
 * trueValue задаётся для неопознанных находок (см. rollTrueValue).
 * Возвращает { added, fit, entry }: fit=false — пакет не вместил, ничего не лежало.
 * Заодно обновляет «лучшую находку жизни» (для эпилога ⚰️).
 */
export function addItem(state, itemId, { qty = 1, trueValue = null } = {}) {
  const item = findItem(itemId);
  if (!item || qty <= 0) return { added: 0, fit: false, entry: null };

  const prospective = inventoryUsedKg(state) + entryWeightKg({ itemId, qty });
  if (prospective > capacityKg(state) + 1e-9) return { added: 0, fit: false, entry: null };

  // Стакаются только «простые» предметы без индивидуальной цены.
  let entry = null;
  if (trueValue == null) {
    entry = state.inventory.find((e) => e.itemId === itemId && e.trueValue == null) ?? null;
  }
  if (entry) {
    entry.qty += qty;
  } else {
    entry = { itemId, qty };
    if (trueValue != null) {
      entry.trueValue = trueValue;
      entry.identified = false; // опознание — сессия 6
    }
    state.inventory.push(entry);
  }

  // Лучший улов жизни (имя видно сразу, цену неопознанного не разглашаем).
  const worth = trueValue ?? item.value ?? 0;
  if (worth > (state.bestItemWorth ?? 0)) {
    state.bestItemWorth = worth;
    state.bestItemLabel = `${item.emoji} ${item.name}`;
  }

  return { added: qty, fit: true, entry };
}
