import { CONFIG } from '../config';
import type { Terrain } from './terrain';
import { RNG } from '../systems/RNG';

/**
 * Детерминированная генерация рельефа центральной зоны.
 * Одинаковый seed => одинаковое поле в сцене расстановки и в сцене боя.
 *
 * - Левые PLAYER_ZONE_COLS колонок — зона игрока (равнина).
 * - Правые ENEMY_ZONE_COLS колонок — зона врага (равнина).
 * - Центр — смесь: Равнина / Лес / Холм / Скала (непроходима).
 */
export function buildTerrainMap(
  cols: number,
  rows: number,
  seed: number,
): Terrain[][] {
  const rng = new RNG(seed);
  const centerStart = CONFIG.PLAYER_ZONE_COLS; // 3
  const centerEnd = cols - CONFIG.ENEMY_ZONE_COLS - 1; // 7 при 11 колонках

  const map: Terrain[][] = [];
  for (let row = 0; row < rows; row++) {
    const r: Terrain[] = [];
    for (let col = 0; col < cols; col++) {
      let t: Terrain = 'plain';
      if (col >= centerStart && col <= centerEnd) {
        const x = rng.next();
        if (x < 0.1) t = 'rock';
        else if (x < 0.3) t = 'forest';
        else if (x < 0.45) t = 'hill';
      }
      r.push(t);
    }
    map.push(r);
  }
  return map;
}

/** Источник рельефа для HexGrid на основе готовой карты. */
export function terrainSourceFromMap(map: Terrain[][]) {
  return {
    terrainAt: (col: number, row: number): Terrain => map[row]?.[col] ?? 'plain',
    blockedAt: (col: number, row: number): boolean =>
      (map[row]?.[col] ?? 'plain') === 'rock',
  };
}
