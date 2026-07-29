/**
 * format.js — чистые функции форматирования для UI (без DOM, без логики игры).
 * Именно этот модуль покрывается unit-тестами presentation-слоя.
 */

/** Русский плюрализатор: plural(5, 'час', 'часа', 'часов') → 'часов'. */
export function plural(n, one, few, many) {
  const mod10 = Math.abs(n) % 10;
  const mod100 = Math.abs(n) % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return few;
  return many;
}

/** 2 → '2 часа', 1.5 → '1.5 часа' (дробь красуем запятой? нет — точкой, как в данных). */
export function hoursLabel(n) {
  const rounded = Math.round(n * 10) / 10;
  return `${rounded} ${plural(Math.floor(rounded), 'час', 'часа', 'часов')}`;
}

/** (8, 5) → '08:05' */
export function formatClock(hour, minute = 0) {
  const pad = (x) => String(x).padStart(2, '0');
  return `${pad(hour)}:${pad(minute)}`;
}

/** 0.6 → '60%' */
export function percentLabel(x) {
  return `${Math.round(x * 100)}%`;
}

/** 250 → '250 ₽' (округление до целых — цены в игре целочисленные) */
export function rublesLabel(n) {
  return `${Math.round(n)} ₽`;
}

/** 2.5 → '2.5 кг' */
export function kgLabel(n) {
  const rounded = Math.round(n * 10) / 10;
  return `${rounded} кг`;
}

/** Словесная оценка риска обыска: душем отображается человеку понятное слово. */
export function riskLabel(p) {
  if (p < 0.1) return 'низкий';
  if (p < 0.2) return 'умеренный';
  if (p < 0.35) return 'высокий';
  return 'очень высокий';
}
