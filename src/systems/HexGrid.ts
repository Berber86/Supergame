import { CONFIG } from '../config';
import type { Terrain } from '../data/terrain';
import type { UnitModel } from '../entities/UnitModel';
import { hexDistance, neighborOffsets, offsetToPixel } from './Hex';

/** Клетка гекс-сетки (данные + занятость). */
export interface HexCell {
  col: number;
  row: number;
  terrain: Terrain;
  unit: UnitModel | null; // живой юнит, стоящий на клетке
  blocked: boolean; // непроходимый рельеф (скала)
}

/** Источник рельефа для построения сетки. */
export interface TerrainSource {
  terrainAt(col: number, row: number): Terrain;
  blockedAt(col: number, row: number): boolean;
}

/**
 * Гекс-сетка (pointy-top, odd-r). Чистая структура данных, без Phaser.
 * Хранит рельеф, занятость и предоставляет геометрию/соседей/пиксели.
 */
export class HexGrid {
  readonly cols: number;
  readonly rows: number;
  readonly size: number;
  readonly originX: number;
  readonly originY: number;
  readonly cells: HexCell[][] = [];

  constructor(
    cols: number,
    rows: number,
    originX: number,
    originY: number,
    source: TerrainSource,
    size: number = CONFIG.HEX_SIZE,
  ) {
    this.cols = cols;
    this.rows = rows;
    this.size = size;
    this.originX = originX;
    this.originY = originY;

    for (let row = 0; row < rows; row++) {
      const r: HexCell[] = [];
      for (let col = 0; col < cols; col++) {
        r.push({
          col,
          row,
          terrain: source.terrainAt(col, row),
          unit: null,
          blocked: source.blockedAt(col, row),
        });
      }
      this.cells.push(r);
    }
  }

  inBounds(col: number, row: number): boolean {
    return col >= 0 && col < this.cols && row >= 0 && row < this.rows;
  }

  get(col: number, row: number): HexCell | undefined {
    return this.inBounds(col, row) ? this.cells[row][col] : undefined;
  }

  /** Пиксельные координаты центра гекса в системе координат сцены. */
  pixelOf(col: number, row: number): { x: number; y: number } {
    const p = offsetToPixel(col, row, this.size);
    return { x: this.originX + p.x, y: this.originY + p.y };
  }

  neighbors(col: number, row: number): HexCell[] {
    const out: HexCell[] = [];
    for (const [dc, dr] of neighborOffsets(row)) {
      const c = this.get(col + dc, row + dr);
      if (c) out.push(c);
    }
    return out;
  }

  distance(
    colA: number,
    rowA: number,
    colB: number,
    rowB: number,
  ): number {
    return hexDistance(colA, rowA, colB, rowB);
  }

  /** Клетка под пикселем (для hit-теста мышью). null, если мимо. */
  cellAtPixel(x: number, y: number): HexCell | null {
    let best: HexCell | null = null;
    let bestD = Infinity;
    for (let row = 0; row < this.rows; row++) {
      for (let col = 0; col < this.cols; col++) {
        const p = this.pixelOf(col, row);
        const d = (p.x - x) * (p.x - x) + (p.y - y) * (p.y - y);
        if (d < bestD) {
          bestD = d;
          best = this.cells[row][col];
        }
      }
    }
    return bestD <= this.size * this.size ? best : null;
  }
}
