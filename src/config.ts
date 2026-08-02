/**
 * Глобальные константы прототипа.
 * Логика боя опирается только на эти значения — никакой зависимости от Phaser.
 */
export const CONFIG = {
  // --- Экран ---
  GAME_WIDTH: 1280,
  GAME_HEIGHT: 800,

  // --- Гекс-сетка ---
  GRID_COLS: 11,
  GRID_ROWS: 7,
  HEX_SIZE: 42, // радиус (от центра до вершины), pointy-top
  PLAYER_ZONE_COLS: 3, // колонки 0..2 — зона расстановки игрока
  ENEMY_ZONE_COLS: 3, // колонки 8..10 — зона врага (при 11 колонках)

  // --- Детерминизм ---
  SEED: 12345, // seed боевого ГСЧ (криты/промахи) — воспроизводимо
  TERRAIN_SEED: 7331, // seed генерации рельефа центра поля

  // --- Симуляция ---
  TICK_HZ: 10, // ~10 логических тиков/сек
  MAX_TICKS_PER_FRAME: 12, // защита от "шпагата" при лагах

  // --- Бой ---
  HIT_CHANCE: 0.9,
  CRIT_CHANCE: 0.15,
  CRIT_MULT: 1.6,

  // --- Поведение ---
  RETREAT_HP_RATIO: 0.3, // юнит отступает при HP <= 30% (где уместно)
  SUPPORT_SAFE_DISTANCE: 3, // support держит дистанцию до врага
  HEAL_INTERVAL: 1.8, // сек между лечениями
  HEAL_AMOUNT: 18,
  RANGED_KITE_ADJACENT: true, // ranged кайтит, если враг вплотную
} as const;
