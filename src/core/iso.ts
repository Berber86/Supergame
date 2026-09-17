/** Изометрическая математика. Вид «сверху-сбоку», строгая сетка как в The Sims. */

export const TILE_W = 112; // ширина ромба тайла в пикселях (при zoom = 1)
export const TILE_H = 56; // высота ромба
export const LEVEL_H = 26; // высота одного уровня рельефа

export const GRID = 26; // размер усадьбы в тайлах (GRID x GRID)

export interface Pt {
  x: number;
  y: number;
}

/** Тайловые координаты (могут быть дробными — четверть-тайлы) → экранные. */
export function isoToScreen(tx: number, ty: number, level = 0): Pt {
  return {
    x: (tx - ty) * (TILE_W / 2),
    y: (tx + ty) * (TILE_H / 2) - level * LEVEL_H,
  };
}

/** Экранные координаты → тайловые (на уровне 0). */
export function screenToIso(sx: number, sy: number, level = 0): Pt {
  const y0 = sy + level * LEVEL_H;
  return {
    x: (y0 / (TILE_H / 2) + sx / (TILE_W / 2)) / 2,
    y: (y0 / (TILE_H / 2) - sx / (TILE_W / 2)) / 2,
  };
}

export function inBounds(tx: number, ty: number): boolean {
  return tx >= 0 && ty >= 0 && tx < GRID && ty < GRID;
}

/** Путь ромба одного тайла в экранных координатах (центр в 0,0 тайла x,y). */
export function tileDiamond(tx: number, ty: number, level = 0): Pt[] {
  const a = isoToScreen(tx, ty, level);
  const b = isoToScreen(tx + 1, ty, level);
  const c = isoToScreen(tx + 1, ty + 1, level);
  const d = isoToScreen(tx, ty + 1, level);
  return [a, b, c, d];
}

/** Ключ сортировки по глубине. */
export function depthOf(tx: number, ty: number, level = 0, bias = 0): number {
  return (tx + ty) * 1000 + level * 200 + bias;
}

export function snapTo(v: number, step: number): number {
  return Math.round(v / step) * step;
}

export function floorTo(v: number, step: number): number {
  return Math.floor(v / step) * step;
}
