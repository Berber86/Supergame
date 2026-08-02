/**
 * Гекс-математика (чистые функции).
 * Зафиксированная система координат: pointy-top, смещение odd-r.
 *   col — колонка, row — ряд.
 *   Нечётные ряды сдвинуты вправо на полгекса.
 *
 * Используется ОДНООБРАЗНО во всём проекте (сетка, поиск пути, рендер).
 */

export interface Axial {
  q: number;
  r: number;
}

/** Смещение (odd-r) -> аксиальные координаты. */
export function offsetToAxial(col: number, row: number): Axial {
  const q = col - (row - (row & 1)) / 2;
  return { q, r: row };
}

/** Расстояние между двумя аксиальными гексами. */
export function axialDistance(a: Axial, b: Axial): number {
  return (
    (Math.abs(a.q - b.q) +
      Math.abs(a.q + a.r - b.q - b.r) +
      Math.abs(a.r - b.r)) /
    2
  );
}

/** Расстояние между двумя гексами в смещённых координатах. */
export function hexDistance(
  colA: number,
  rowA: number,
  colB: number,
  rowB: number,
): number {
  return axialDistance(offsetToAxial(colA, rowA), offsetToAxial(colB, rowB));
}

/** Пиксельные координаты центра гекса (pointy-top, odd-r). */
export function offsetToPixel(
  col: number,
  row: number,
  size: number,
): { x: number; y: number } {
  const x = size * Math.sqrt(3) * (col + 0.5 * (row & 1));
  const y = size * 1.5 * row;
  return { x, y };
}

// Соседи для odd-r (зависят от чётности ряда).
const NEIGHBORS_EVEN: ReadonlyArray<readonly [number, number]> = [
  [+1, 0],
  [0, -1],
  [-1, -1],
  [-1, 0],
  [-1, +1],
  [0, +1],
];
const NEIGHBORS_ODD: ReadonlyArray<readonly [number, number]> = [
  [+1, 0],
  [+1, -1],
  [0, -1],
  [-1, 0],
  [0, +1],
  [+1, +1],
];

/** Список смещений соседей для данного ряда. */
export function neighborOffsets(
  row: number,
): ReadonlyArray<readonly [number, number]> {
  return row & 1 ? NEIGHBORS_ODD : NEIGHBORS_EVEN;
}
