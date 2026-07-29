/**
 * Дымовой тест скелета проекта (сессия 1).
 * Проверяет, что модульная структура импортируется, а константы валидны.
 * Игровые тесты появятся вместе с игровой логикой (сессии 4+).
 */

import { describe, it, expect } from 'vitest';
import { GAME_TITLE, GAME_VERSION, SESSION_NUMBER } from '../js/core/config.js';

describe('конфигурация проекта', () => {
  it('есть непустое название игры', () => {
    expect(typeof GAME_TITLE).toBe('string');
    expect(GAME_TITLE.length).toBeGreaterThan(0);
  });

  it('версия соответствует semver', () => {
    expect(GAME_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it('номер сессии — положительное целое', () => {
    expect(Number.isInteger(SESSION_NUMBER)).toBe(true);
    expect(SESSION_NUMBER).toBeGreaterThan(0);
  });
});
