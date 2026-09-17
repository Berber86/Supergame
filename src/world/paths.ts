/**
 * Умные дорожки.
 *
 * Игрок отмечает начало и конец, а тропа сама находит дорогу: обходит воду
 * и постройки, жмётся к пологому рельефу и предпочитает мягко изгибаться,
 * а не резать сад по линейке. Прямая дорожка в японском саду — редкость;
 * тропа должна вести, а не спешить.
 */

import { GRID, inBounds } from '../core/iso';
import { fbm } from '../core/rng';
import { GroundId } from './types';
import { World } from './world';

const DIRS: [number, number][] = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

/** Во что обходится шаг на клетку. Бесконечность — пройти нельзя. */
function stepCost(world: World, x: number, y: number, fromLevel: number): number {
  const t = world.at(x, y);
  if (!t) return Infinity;
  // Вода и комнаты непроходимы: через пруд кладут мост, а не тропу
  if (t.water) return Infinity;
  if (t.indoor) return Infinity;

  let c = 1;
  // Перепад высот: тропа любит пологое
  const dh = Math.abs(t.level - fromLevel);
  if (dh > 1) return Infinity;
  c += dh * 2.6;

  // По готовому камню идти «дешевле» — тропы охотно сливаются
  if (t.ground === 'stone') c -= 0.55;
  else if (t.ground === 'gravel') c -= 0.2;
  // По веранде тропу не ведут
  if (t.veranda) c += 6;
  // Мягкий мох приятнее топтать, чем песок
  if (t.ground === 'sand') c += 0.3;

  // Шум по местности: одинаковые по цене пути расходятся, и тропа виляет.
  // Берём плавный шум, а не по клетке — иначе дорожка дёргается зигзагом,
  // тогда как в японском саду тропа должна вести мягкой дугой.
  c += fbm(x * 0.23, y * 0.23, 2, 131) * 1.5;
  return c;
}

/** Есть ли на клетке что-то, что тропа должна обойти. */
function blockedByObject(world: World, x: number, y: number): boolean {
  for (const o of world.objects) {
    // микро-декор тропа сминает, крупное — обходит
    const ox = Math.floor(o.tx);
    const oy = Math.floor(o.ty);
    if (ox !== x || oy !== y) continue;
    const t = o.type;
    if (
      t === 'rock_big' ||
      t === 'rock_trio' ||
      t === 'pavilion' ||
      t === 'lantern_stone' ||
      t === 'torii' ||
      t === 'tsukubai' ||
      t === 'shishi'
    ) {
      return true;
    }
  }
  return false;
}

/**
 * Поиск пути A*. Возвращает список клеток от начала до конца
 * или null, если дороги нет.
 */
export function findPath(
  world: World,
  from: { x: number; y: number },
  to: { x: number; y: number },
): { x: number; y: number }[] | null {
  const sx = Math.floor(from.x);
  const sy = Math.floor(from.y);
  const tx = Math.floor(to.x);
  const ty = Math.floor(to.y);
  if (!inBounds(sx, sy) || !inBounds(tx, ty)) return null;
  if (sx === tx && sy === ty) return [{ x: sx, y: sy }];

  const N = GRID * GRID;
  const idx = (x: number, y: number) => y * GRID + x;
  const g = new Float32Array(N).fill(Infinity);
  const f = new Float32Array(N).fill(Infinity);
  const prev = new Int32Array(N).fill(-1);
  const closed = new Uint8Array(N);

  const h = (x: number, y: number) => Math.abs(x - tx) + Math.abs(y - ty);

  const start = idx(sx, sy);
  g[start] = 0;
  f[start] = h(sx, sy);
  // Небольшая открытая очередь: сад 26×26, куча тут излишня
  const open: number[] = [start];

  while (open.length) {
    // достаём узел с наименьшей оценкой
    let bi = 0;
    for (let i = 1; i < open.length; i++) if (f[open[i]] < f[open[bi]]) bi = i;
    const cur = open.splice(bi, 1)[0];
    if (cur === idx(tx, ty)) break;
    closed[cur] = 1;

    const cx = cur % GRID;
    const cy = (cur / GRID) | 0;
    const curLevel = world.tiles[cur].level;

    for (const [dx, dy] of DIRS) {
      const nx = cx + dx;
      const ny = cy + dy;
      if (!inBounds(nx, ny)) continue;
      const ni = idx(nx, ny);
      if (closed[ni]) continue;

      let c = stepCost(world, nx, ny, curLevel);
      if (!isFinite(c)) continue;
      // Крупные предметы обходим, но у самой цели разрешаем подойти вплотную
      if (blockedByObject(world, nx, ny) && ni !== idx(tx, ty)) c += 9;

      // Поворот стоит чуть дороже прямого шага: тропа получается плавной,
      // а не ступенчатой лесенкой.
      const pi = prev[cur];
      if (pi >= 0) {
        const px = pi % GRID;
        const py = (pi / GRID) | 0;
        const turned = px - cx !== dx || py - cy !== dy;
        if (turned) c += 0.2;
      }

      const ng = g[cur] + c;
      if (ng < g[ni]) {
        g[ni] = ng;
        f[ni] = ng + h(nx, ny);
        prev[ni] = cur;
        if (!open.includes(ni)) open.push(ni);
      }
    }
  }

  const goal = idx(tx, ty);
  if (prev[goal] < 0 && goal !== start) return null;

  const out: { x: number; y: number }[] = [];
  let cur = goal;
  let guard = 0;
  while (cur >= 0 && guard++ < N) {
    out.push({ x: cur % GRID, y: (cur / GRID) | 0 });
    if (cur === start) break;
    cur = prev[cur];
  }
  out.reverse();
  return out[0] && out[0].x === sx && out[0].y === sy ? out : null;
}

/**
 * Прокладывает тропу: меняет землю на камень и раскидывает шаговые камни
 * по сторонам, чтобы дорожка не выглядела бордюром.
 */
export function layPath(world: World, cells: { x: number; y: number }[], ground: GroundId = 'stone'): number {
  let laid = 0;
  for (const c of cells) {
    const t = world.at(c.x, c.y);
    if (!t || t.water || t.indoor || t.veranda) continue;
    if (t.ground !== ground) {
      world.setGround(c.x, c.y, ground);
      laid++;
    }
  }
  return laid;
}
