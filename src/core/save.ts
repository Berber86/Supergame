/**
 * Сейв/лоад игры и офлайн-доход (GDD §3.5).
 * Статический сайт без бэкенда: состояние — в localStorage,
 * офлайн-накопление рассчитывается при загрузке по реальному времени
 * с капом 8 часов (защита потолка «все числа ≤ 1000» и анти-читерство).
 */

import type { GameState } from './types';
import { SAVE_KEY } from './types';

/** Кап офлайн-дохода, часы (GDD §3.5). */
export const OFFLINE_CAP_HOURS = 8;
export const OFFLINE_CAP_MS = OFFLINE_CAP_HOURS * 60 * 60 * 1000;

export function createInitialState(now: number = Date.now()): GameState {
  return {
    gold: 0,
    servants: [],
    buildings: [],
    relics: [],
    kingdomProgress: {},
    dragonLevel: 1,
    prestige: 0,
    achievements: [],
    journal: [],
    raid: { kingdomId: null, stage: 0, relics: [], offer: [], atBoss: false },
    lastSavedAt: now,
  };
}

/** Сохранить состояние. */
export function saveState(state: GameState, storage: Storage = localStorage): void {
  const snapshot: GameState = { ...state, lastSavedAt: Date.now() };
  storage.setItem(SAVE_KEY, JSON.stringify(snapshot));
}

/** Загрузить состояние; при повреждённых данных — вернуть null (начнём заново). */
export function loadState(storage: Storage = localStorage): GameState | null {
  const raw = storage.getItem(SAVE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as GameState;
    if (!isValidState(parsed)) return null;
    return migrateState(parsed);
  } catch {
    return null;
  }
}

/** Очистить сейв (кнопка «начать заново»). */
export function clearState(storage: Storage = localStorage): void {
  storage.removeItem(SAVE_KEY);
}

/**
 * Время офлайн-накопления с капом.
 * Чистая функция — легко тестировать «подделку времени».
 */
export function computeOfflineMs(lastSavedAt: number, now: number): number {
  if (now <= lastSavedAt) return 0;
  return Math.min(now - lastSavedAt, OFFLINE_CAP_MS);
}

/**
 * Мягкая миграция старых сейвов (S6: у рейда появились поля `offer` и `atBoss`).
 * Ключ сейва не меняем — старый прогресс игрока не теряется.
 */
export function migrateState(state: GameState): GameState {
  const raid = state.raid ?? { kingdomId: null, stage: 0, relics: [] };
  return {
    ...state,
    relics: Array.isArray(state.relics) ? state.relics : [],
    raid: {
      kingdomId: raid.kingdomId ?? null,
      stage: typeof raid.stage === 'number' ? raid.stage : 0,
      relics: Array.isArray(raid.relics) ? raid.relics : [],
      offer: Array.isArray(raid.offer) ? raid.offer : [],
      atBoss: raid.atBoss === true,
    },
  };
}

/** Минимальная проверка структуры сейва. */
export function isValidState(state: unknown): state is GameState {
  if (typeof state !== 'object' || state === null) return false;
  const s = state as Record<string, unknown>;
  return (
    typeof s.gold === 'number' &&
    Array.isArray(s.servants) &&
    Array.isArray(s.buildings) &&
    Array.isArray(s.relics) &&
    typeof s.kingdomProgress === 'object' &&
    s.kingdomProgress !== null &&
    typeof s.dragonLevel === 'number' &&
    typeof s.prestige === 'number' &&
    Array.isArray(s.achievements) &&
    Array.isArray(s.journal) &&
    typeof s.raid === 'object' &&
    s.raid !== null &&
    typeof s.lastSavedAt === 'number'
  );
}
