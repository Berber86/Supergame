/**
 * rng.js — детерминированный генератор случайности (mulberry32).
 *
 * Главное требование архитектуры: рандом с СИДОМ и СЕРИАЛИЗУЕМЫМ состоянием.
 * Состояние — одно 32-битное целое (rngState), живёт внутри GameState,
 * поэтому сохранение/загрузка не ломает предсказуемость: сериализовал —
 * восстановил — получил ту же последовательность.
 */

/**
 * Один шаг mulberry32: из rngState → { value ∈ [0,1), state: следующее rngState }.
 * Чистая функция — именно она даёт сериализуемость.
 */
export function nextRandom(rngState) {
  const newState = (rngState + 0x6D2B79F5) | 0;
  let t = newState;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  const value = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  return { value, state: newState };
}

/**
 * Удобный «роллер» поверх чистого шага: редьюсеры берут один роллер
 * на всё действие, тянут из него числа, а в конце пишут roller.state
 * обратно в GameState. Порядок вызовов внутри действия = порядок чисел,
 * поэтому редьюсеры обязаны быть детерминированными сами.
 */
export function makeRoller(seed) {
  let current = seed | 0;

  return {
    get state() {
      return current;
    },

    /** [0, 1) */
    roll() {
      const r = nextRandom(current);
      current = r.state;
      return r.value;
    },

    /** Целое 0..n-1 */
    int(n) {
      return Math.floor(this.roll() * n);
    },

    /** true с вероятностью p */
    chance(p) {
      return this.roll() < p;
    },

    /** Случайный элемент массива */
    pick(arr) {
      return arr[this.int(arr.length)];
    },

    /** Взвешенный выбор: entries = [{..., weight}] → элемент. */
    weighted(entries) {
      let total = 0;
      for (const e of entries) total += e.weight;
      let r = this.roll() * total;
      for (const e of entries) {
        r -= e.weight;
        if (r < 0) return e;
      }
      return entries[entries.length - 1];
    },
  };
}
