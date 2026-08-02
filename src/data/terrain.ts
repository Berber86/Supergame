/** Типы и модификаторы рельефа центральной зоны. */

export type Terrain = 'plain' | 'forest' | 'hill' | 'rock';

export const TERRAIN_LABEL: Record<Terrain, string> = {
  plain: 'Равнина',
  forest: 'Лес',
  hill: 'Холм',
  rock: 'Скала',
};

export const TERRAIN_COLORS: Record<Terrain, number> = {
  plain: 0x4f6b3a,
  forest: 0x2f5d34,
  hill: 0x8a6b3b,
  rock: 0x55585c,
};

/** Модификаторы рельефа к статам юнита, стоящего на клетке. */
export interface TerrainModifiers {
  /** Множитель скорости движения (1 = без изменений). */
  moveMultiplier: number;
  /** Плоский бонус к защите. */
  defenseBonus: number;
  /** Бонус к дальности (только ranged). */
  rangedRangeBonus: number;
  /** Множитель урона (только ranged). */
  rangedDamageMultiplier: number;
}

export const TERRAIN_MODIFIERS: Record<Terrain, TerrainModifiers> = {
  // Равнина — нейтральна.
  plain: {
    moveMultiplier: 1.0,
    defenseBonus: 0,
    rangedRangeBonus: 0,
    rangedDamageMultiplier: 1.0,
  },
  // Лес — медленнее идти, но больше защиты (укрытие).
  forest: {
    moveMultiplier: 0.6,
    defenseBonus: 3,
    rangedRangeBonus: 0,
    rangedDamageMultiplier: 1.0,
  },
  // Холм — выгодная позиция для стрелков.
  hill: {
    moveMultiplier: 0.9,
    defenseBonus: 1,
    rangedRangeBonus: 1,
    rangedDamageMultiplier: 1.25,
  },
  // Скала — непроходима.
  rock: {
    moveMultiplier: 0,
    defenseBonus: 0,
    rangedRangeBonus: 0,
    rangedDamageMultiplier: 1.0,
  },
};
