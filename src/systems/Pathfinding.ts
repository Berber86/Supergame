import { TERRAIN_MODIFIERS, type Terrain } from '../data/terrain';
import type { HexCell, HexGrid } from './HexGrid';

/**
 * A* по гекс-сетке с учётом стоимости рельефа и занятых/непроходимых клеток.
 * Чистая функция, без Phaser. Возвращает путь от старта до цели включительно
 * (либо null). Клетка цели считается достижимой терминальной точкой, но
 * вызывающий код не должен на неё наступать (она занята целью) — для движения
 * берётся path[1].
 */

function key(col: number, row: number): string {
  return col + ',' + row;
}

function terrainCost(t: Terrain): number {
  // Стоимость прохода влияет лишь на предпочтительный маршрут.
  switch (t) {
    case 'forest':
      return 1.6;
    case 'hill':
      return 1.2;
    case 'rock':
      return 1e9; // фактически непроходим
    default:
      return 1;
  }
}

interface ANode {
  col: number;
  row: number;
  g: number;
  f: number;
  parent: ANode | null;
}

export function findPath(
  grid: HexGrid,
  startCol: number,
  startRow: number,
  goalCol: number,
  goalRow: number,
): HexCell[] | null {
  const goalKey = key(goalCol, goalRow);
  const startKey = key(startCol, startRow);

  const open: ANode[] = [];
  const openMap = new Map<string, ANode>();
  const closed = new Set<string>();

  const startNode: ANode = {
    col: startCol,
    row: startRow,
    g: 0,
    f: grid.distance(startCol, startRow, goalCol, goalRow),
    parent: null,
  };
  open.push(startNode);
  openMap.set(startKey, startNode);

  let guard = 0;
  while (open.length && guard++ < 2000) {
    // Достаём узел с минимальным f (сетка маленькая — линейный поиск).
    let bestIdx = 0;
    for (let i = 1; i < open.length; i++) {
      if (open[i].f < open[bestIdx].f) bestIdx = i;
    }
    const cur = open.splice(bestIdx, 1)[0];
    openMap.delete(key(cur.col, cur.row));

    if (key(cur.col, cur.row) === goalKey) {
      return reconstruct(cur, grid);
    }
    closed.add(key(cur.col, cur.row));

    for (const nb of grid.neighbors(cur.col, cur.row)) {
      const nk = key(nb.col, nb.row);
      if (closed.has(nk)) continue;
      // Проходима: не скала и (свободна от юнитов ИЛИ является клеткой цели).
      const isGoal = nk === goalKey;
      const passable = !nb.blocked && (!nb.unit || isGoal);
      if (!passable) continue;

      const tentG = cur.g + terrainCost(nb.terrain);
      let node = openMap.get(nk);
      if (!node) {
        node = {
          col: nb.col,
          row: nb.row,
          g: tentG,
          f: tentG + grid.distance(nb.col, nb.row, goalCol, goalRow),
          parent: cur,
        };
        open.push(node);
        openMap.set(nk, node);
      } else if (tentG < node.g) {
        node.g = tentG;
        node.f = tentG + grid.distance(nb.col, nb.row, goalCol, goalRow);
        node.parent = cur;
      }
    }
  }
  return null;
}

function reconstruct(end: ANode, grid: HexGrid): HexCell[] {
  const path: HexCell[] = [];
  let n: ANode | null = end;
  while (n) {
    const cell = grid.get(n.col, n.row);
    if (cell) path.push(cell);
    n = n.parent;
  }
  path.reverse();
  return path;
}
