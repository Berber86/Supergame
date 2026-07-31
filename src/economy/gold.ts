/**
 * Экономика золота: клик и пассивный доход (GDD §3.2, петля пещеры).
 * Все числа ≤ 1000 — см. pacing.ts (контракт «Малые числа», карточка №1).
 */

import type { BuildingDef, GameState, IncomeRates, ServantDef } from '../core/types';

/**
 * Посчитать доходы из состояния.
 * perSecond = сумма(базовый доход слуг × количество) × множитель зданий.
 * perClick = 1 золото за клик + бонус от уровня дракона (S7 — пересчитать).
 */
export function computeIncome(
  state: GameState,
  servantsDef: ServantDef[],
  buildingsDef: BuildingDef[],
): IncomeRates {
  let base = 0;
  for (const owned of state.servants) {
    const def = servantsDef.find((d) => d.id === owned.id);
    if (def) base += def.baseIncome * owned.count;
  }

  let multiplier = 1;
  for (const owned of state.buildings) {
    const def = buildingsDef.find((d) => d.id === owned.id);
    if (def) multiplier *= 1 + def.multiplier * owned.level;
  }

  const perClick = 1 + (state.dragonLevel - 1) * 0.5;
  return { perClick, perSecond: base * multiplier };
}

/** Клик по золоту: добавляет perClick золота. Возвращает новое значение. */
export function applyClick(state: GameState, rates: IncomeRates): number {
  return state.gold + rates.perClick;
}

/** Добавить пассивный доход за прошедшее время (секунды). */
export function applyPassive(state: GameState, rates: IncomeRates, seconds: number): number {
  return state.gold + rates.perSecond * seconds;
}
