import { CONFIG } from '../config';
import { RNG } from '../systems/RNG';
import type { Terrain } from './terrain';

/** Одинаковый seed для превью расстановки, генератора врагов и реального боя. */
export function terrainSeedForWave(wave: number): number {
  return CONFIG.TERRAIN_SEED + Math.max(1, Math.floor(wave)) * 53;
}

/**
 * Детерминированное поле. В зонах расстановки есть леса/холмы, но нет скал,
 * поэтому процедурная расстановка может использовать рельеф и всегда найдёт
 * 8 свободных клеток. В центре остаются непроходимые скалы.
 */
export function buildTerrainMap(
  cols: number,
  rows: number,
  seed: number,
): Terrain[][] {
  const rng = new RNG(seed);
  const centerStart = CONFIG.PLAYER_ZONE_COLS;
  const centerEnd = cols - CONFIG.ENEMY_ZONE_COLS - 1;

  const map: Terrain[][] = [];
  for (let row = 0; row < rows; row++) {
    const line: Terrain[] = [];
    for (let col = 0; col < cols; col++) {
      const roll = rng.next();
      let terrain: Terrain = 'plain';
      if (col >= centerStart && col <= centerEnd) {
        if (roll < 0.1) terrain = 'rock';
        else if (roll < 0.3) terrain = 'forest';
        else if (roll < 0.47) terrain = 'hill';
      } else {
        // Симметричная безопасная смесь в обеих deployment-зонах.
        if (roll < 0.18) terrain = 'hill';
        else if (roll < 0.32) terrain = 'forest';
      }
      line.push(terrain);
    }
    map.push(line);
  }
  return map;
}

export function terrainSourceFromMap(map: ReadonlyArray<ReadonlyArray<Terrain>>) {
  return {
    terrainAt: (col: number, row: number): Terrain => map[row]?.[col] ?? 'plain',
    blockedAt: (col: number, row: number): boolean =>
      (map[row]?.[col] ?? 'plain') === 'rock',
  };
}
