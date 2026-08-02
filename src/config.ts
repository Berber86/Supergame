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
  TERRAIN_SEED: 7331, // базовый seed; terrainSeedForWave добавляет номер волны

  // --- Симуляция ---
  TICK_HZ: 10, // ~10 логических тиков/сек
  MAX_TICKS_PER_FRAME: 12, // защита от "шпагата" при лагах

  // --- Бой ---
  HIT_CHANCE: 0.9,
  CRIT_CHANCE: 0.15,
  CRIT_MULT: 1.6,
  HEAVY_SPLASH_RATIO: 0.3, // AoE-breaker наносит часть урона соседям цели
  OVERTIME_START_SECONDS: 90, // после этого базовый урон растёт против тупиков
  OVERTIME_DAMAGE_PER_30_SECONDS: 0.75,
  OVERTIME_DAMAGE_MAX_MULT: 4,
  OVERTIME_HEAL_DECAY_SECONDS: 60,
  OVERTIME_HEAL_MIN_MULT: 0.15,

  // --- Формула роста контента по эпохам ---
  // Базовые профили задаются один раз в evolution-tree.ts, а каждый стат
  // вычисляется как base * growth^(epoch - 1) * variant. Это не позволяет
  // отдельным веткам случайно получить несопоставимый ручной скачок статов.
  UNIT_STAT_SCALING: {
    HP_PER_EPOCH: 1.34,
    ATK_PER_EPOCH: 1.31,
    DEF_PER_EPOCH: 1.29,
    ATK_SPEED_PER_EPOCH: 1.025,
    ABILITY_POWER_PER_EPOCH: 1.32,
  },

  // --- Процедурные волны ---
  WAVES: {
    MIN_UNITS: 4,
    MAX_UNITS: 8,
    WAVES_PER_EXTRA_UNIT: 3,
    ELITE_EVERY: 5,
    // Небольшая компенсация игроку за персистентный урон и то, что ИИ получает
    // идеальную процедурную расстановку. Элитная волна почти снимает фору.
    BASE_STAT_MULT: 0.90,
    ELITE_STAT_MULT: 1.18,
    // Разброс растёт, но не перескакивает через несколько экспоненциально
    // более сильных эпох: непредсказуемость не должна превращаться в лотерею.
    EPOCH_SPREAD_BASE: 0.35,
    EPOCH_SPREAD_PER_WAVE: 0.045,
    EPOCH_SPREAD_MAX: 1.35,
    // Небольшое давление внутри одной эпохи; основная адаптация идёт через
    // world_epoch_score, а не бесконечное линейное раздувание статов.
    PRESSURE_PER_WAVE: 0.003,
    PRESSURE_MAX: 1.05,
  },

  // --- Поведение ---
  RETREAT_HP_RATIO: 0.3, // юнит отступает при HP <= 30% (где уместно)
  SUPPORT_SAFE_DISTANCE: 3, // support держит дистанцию до врага
  HEAL_INTERVAL: 1.8, // сек между лечениями/баффами базовой поддержки
  HEAL_AMOUNT: 18,
  SUPPORT_HEAL_HP_RATIO: 0.1,
  SUPPORT_BUFF_DURATION: 4.5,
  SUPPORT_BUFF_MULT: 1.16,
  RANGED_KITE_ADJACENT: true, // ranged кайтит, если враг вплотную
} as const;
