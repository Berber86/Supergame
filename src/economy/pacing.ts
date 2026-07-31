/**
 * Контракт «Малые числа» (карточка хаоса №1, GDD §3.4).
 * Все отображаемые ресурсы и ставки ≤ 1000; потолок достигается
 * примерно за 15–20 минут активной игры; перерождение возвращает
 * к малым числам. Прогресс после потолка — контентный (королевства,
 * реликвии, достижения), а не числовой.
 */

/** Потолок всех отображаемых ресурсов и ставок. */
export const GOLD_CAP = 1000;

/** Целевое время выхода на потолок, минуты (GDD: 15–20). */
export const TARGET_CAP_MINUTES = 20;

/** Целевая ставка дохода золота/сек, при которой потолок достигается вовремя. */
export const TARGET_RATE = GOLD_CAP / (TARGET_CAP_MINUTES * 60);

/** Допуск на балансные колебания (вверх) при проверке пейсинга. */
export const PACING_TOLERANCE = 1.5;

/**
 * Не дать ресурсу превысить потолок.
 * NaN и отрицательные значения → 0; бесконечность → потолок.
 */
export function clampGold(value: number, cap: number = GOLD_CAP): number {
  if (Number.isNaN(value) || value < 0) return 0;
  return Math.min(value, cap);
}

/**
 * Проверка пейсинга: ставка не должна сильно превышать целевую,
 * иначе потолок достигается слишком быстро (прогрессия плоская).
 */
export function isWithinPacing(ratePerSecond: number): boolean {
  return ratePerSecond >= 0 && ratePerSecond <= TARGET_RATE * PACING_TOLERANCE;
}
