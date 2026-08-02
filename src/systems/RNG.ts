/**
 * Детерминированный ГСЧ (mulberry32).
 * Важен для воспроизводимости боя: одинаковый seed + одинаковое стартовое
 * состояние => одинаковые криты/промахи и тот же исход.
 */
export class RNG {
  private state: number;

  constructor(seed: number) {
    this.state = seed >>> 0;
  }

  /** Следующее число с плавающей точкой в [0, 1). */
  next(): number {
    let t = (this.state = (this.state + 0x6d2b79f5) >>> 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Число с плавающей точкой в [min, max). */
  range(min: number, max: number): number {
    return min + (max - min) * this.next();
  }

  /** Целое в [minInclusive, maxInclusive]. */
  int(minInclusive: number, maxInclusive: number): number {
    return Math.floor(this.range(minInclusive, maxInclusive + 1));
  }

  /** true с вероятностью p. */
  chance(p: number): boolean {
    return this.next() < p;
  }
}
