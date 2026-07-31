/**
 * Покупки: найм слуг и покупка/улучшение зданий (S4: полная idle-петля).
 * Цены растут по формуле base * 1.15^owned (стандарт idle, баланс под ≤1000).
 * Все покупки — чистые по эффекту, но мутируют state как в остальном коде.
 */

import type { BuildingDef, GameState, ServantDef } from '../core/types';

/** Текущая стоимость следующего слуги (округляем вниз). */
export function getServantCost(def: ServantDef, ownedCount: number): number {
  const factor = Math.pow(1.15, ownedCount);
  return Math.floor(def.cost * factor);
}

/** Текущая стоимость следующего уровня здания. */
export function getBuildingCost(def: BuildingDef, ownedLevel: number): number {
  const factor = Math.pow(1.15, ownedLevel);
  return Math.floor(def.cost * factor);
}

/** Найти количество слуг по id в состоянии. */
function getOwnedServantCount(state: GameState, id: string): number {
  const owned = state.servants.find((s) => s.id === id);
  return owned ? owned.count : 0;
}

/** Найти уровень здания по id. */
function getOwnedBuildingLevel(state: GameState, id: string): number {
  const owned = state.buildings.find((b) => b.id === id);
  return owned ? owned.level : 0;
}

/** Купить/нанять слугу. Возвращает true если успешно. */
export function buyServant(
  state: GameState,
  servantId: string,
  servantsDef: ServantDef[],
): boolean {
  const def = servantsDef.find((d) => d.id === servantId);
  if (!def) return false;

  const currentCount = getOwnedServantCount(state, servantId);
  const cost = getServantCost(def, currentCount);

  if (state.gold < cost) return false;

  state.gold = state.gold - cost;

  const existing = state.servants.find((s) => s.id === servantId);
  if (existing) {
    existing.count += 1;
  } else {
    state.servants.push({ id: servantId, count: 1 });
  }

  state.journal.unshift(`Нанял ${def.name} за ${cost} золота.`);
  state.journal = state.journal.slice(0, 20);
  return true;
}

/** Купить/улучшить здание. Возвращает true если успешно. */
export function buyBuilding(
  state: GameState,
  buildingId: string,
  buildingsDef: BuildingDef[],
): boolean {
  const def = buildingsDef.find((d) => d.id === buildingId);
  if (!def) return false;

  const currentLevel = getOwnedBuildingLevel(state, buildingId);
  const cost = getBuildingCost(def, currentLevel);

  if (state.gold < cost) return false;

  state.gold = state.gold - cost;

  const existing = state.buildings.find((b) => b.id === buildingId);
  if (existing) {
    existing.level += 1;
  } else {
    state.buildings.push({ id: buildingId, level: 1 });
  }

  state.journal.unshift(`${def.name} улучшена до уровня ${currentLevel + 1} за ${cost} золота.`);
  state.journal = state.journal.slice(0, 20);
  return true;
}
