/**
 * persist.js — сохранение/загрузка GameState в localStorage.
 *
 * Принцип архитектуры: state сериализуется в JSON без потерь (проверяется
 * unit-тестами через serialize/deserialize — чистые функции, без браузера).
 * Работа с самим localStorage обёрнута и тихо отключается вне браузера
 * (тесты гоняются в node).
 */

import { SAVE_VERSION } from './state.js';

const STORAGE_KEY = 'na-dne-nevy-save-v1';

/** localStorage доступен? (в браузере — да, в тестах под node — нет) */
function storageAvailable() {
  try {
    return typeof localStorage !== 'undefined';
  } catch {
    return false;
  }
}

/** Чистая сериализация (тестируется). */
export function serialize(state) {
  return JSON.stringify(state);
}

/** Чистая десериализация с проверкой формы (тестируется). */
export function deserialize(json) {
  let state;
  try {
    state = JSON.parse(json);
  } catch {
    return null;
  }
  return isValidStateShape(state) ? normalizeState(state) : null;
}

/**
 * Нормализация старого сейва: добить поля, появившиеся в новых версиях,
 * не теряя прогресс человека. Дешевле формальных миграций версий — пока
 * изменения только «добавочные», SAVE_VERSION не трогаем.
 * (Сессия 5: + bins / digMode для сейвов сессии 4.)
 */
export function normalizeState(state) {
  if (!state.bins || typeof state.bins !== 'object') state.bins = {};
  if (typeof state.digMode !== 'string') state.digMode = 'normal';
  return state;
}

/** Минимальная проверка, что это наш сейв, а не чужой JSON из localStorage. */
export function isValidStateShape(state) {
  if (!state || typeof state !== 'object') return false;
  if (state.saveVersion !== SAVE_VERSION) return false;
  if (typeof state.day !== 'number' || typeof state.hour !== 'number') return false;
  if (!state.stats || typeof state.stats.health !== 'number') return false;
  if (!state.skills || !Array.isArray(state.inventory)) return false;
  if (!['alive', 'dead'].includes(state.status)) return false;
  return true;
}

/** Сохранить состояние (вне браузера — тихий no-op). */
export function saveGame(state) {
  if (!storageAvailable()) return false;
  try {
    localStorage.setItem(STORAGE_KEY, serialize(state));
    return true;
  } catch {
    return false; // переполнение квоты и т.п. — игру не роняем
  }
}

/** Загрузить состояние или null (нет сейва / битый / чужой формат). */
export function loadGame() {
  if (!storageAvailable()) return null;
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  return deserialize(raw);
}

/** Удалить сейв (на будущее: кнопка «начать с нуля»). */
export function clearSave() {
  if (!storageAvailable()) return;
  localStorage.removeItem(STORAGE_KEY);
}
