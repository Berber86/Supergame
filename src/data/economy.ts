/**
 * Экономика кампании. Вынесена отдельно — чтобы на Этапе 5 тюнить баланс
 * в одном месте, не трогая боевую логику.
 */
export const ECONOMY = {
  ROSTER_LIMIT: 12,
  STARTING_CURRENCY: 130,

  HIRE_COST: 55,
  HEAL_COST_PER_HP: 1.0, // валюты за 1 недостающей HP
  HEAL_MIN_COST: 5,

  COMPOSE_MIN: 4,
  COMPOSE_MAX: 8,

  SAVE_KEY: 'tll_save_v1',

  // Доход за волну (тюнится здесь).
  incomeBase: (wave: number): number => 30 + (wave - 1) * 12,
  victoryBonus: (wave: number): number => 20 + (wave - 1) * 10,

  // Награда опыта (просто счётчик battle_experience на будущее).
  XP_PARTICIPATION: 1,
  XP_SURVIVAL: 1,
};

/** Стартовый ростер новой кампании (3-4 базовых юнита эпохи 1). */
export const STARTER_TEMPLATE_IDS = ['guardian', 'spearhunter', 'sling', 'shaman'];
