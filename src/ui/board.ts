import Phaser from 'phaser';
import { CONFIG } from '../config';
import { TERRAIN_COLORS } from '../data/terrain';
import type { HexCell, HexGrid } from '../systems/HexGrid';

/** Полигон pointy-top гекса (6 вершин) по центру и радиусу. */
export function hexPolygon(
  cx: number,
  cy: number,
  size: number,
): Phaser.Geom.Polygon {
  const pts: number[] = [];
  for (let k = 0; k < 6; k++) {
    const a = (Math.PI / 180) * (60 * k + 30);
    pts.push(cx + size * Math.cos(a), cy + size * Math.sin(a));
  }
  return new Phaser.Geom.Polygon(pts);
}

/** Отрисовка статичного слоя рельефа (один раз при создании сцены). */
export function drawTerrainLayer(
  g: Phaser.GameObjects.Graphics,
  grid: HexGrid,
): void {
  g.clear();
  for (let row = 0; row < grid.rows; row++) {
    for (let col = 0; col < grid.cols; col++) {
      const cell = grid.cells[row][col];
      const p = grid.pixelOf(col, row);
      const poly = hexPolygon(p.x, p.y, grid.size * 0.96);

      g.fillStyle(TERRAIN_COLORS[cell.terrain], 1);
      g.fillPoints(poly.points, true);
      g.lineStyle(2, 0x000000, 0.3);
      g.strokePoints(poly.points, true);

      drawTerrainMarker(g, cell, p.x, p.y, grid.size);
    }
  }
}

/** Лёгкие значки рельефа, чтобы тип клетки читался визуально. */
function drawTerrainMarker(
  g: Phaser.GameObjects.Graphics,
  cell: HexCell,
  cx: number,
  cy: number,
  size: number,
): void {
  const r = size * 0.28;
  switch (cell.terrain) {
    case 'forest':
      g.fillStyle(0x1c3f22, 0.9);
      for (const [dx, dy] of [
        [-r * 0.6, r * 0.2],
        [r * 0.6, r * 0.2],
        [0, -r * 0.6],
      ]) {
        g.fillCircle(cx + dx, cy + dy, r * 0.55);
      }
      break;
    case 'hill':
      g.fillStyle(0xb58a4a, 0.9);
      g.fillTriangle(
        cx - r,
        cy + r * 0.5,
        cx,
        cy - r * 0.7,
        cx + r,
        cy + r * 0.5,
      );
      break;
    case 'rock':
      g.lineStyle(3, 0x2b2e33, 0.9);
      g.strokeCircle(cx, cy, r * 0.9);
      g.beginPath();
      g.moveTo(cx - r * 0.7, cy - r * 0.7);
      g.lineTo(cx + r * 0.7, cy + r * 0.7);
      g.moveTo(cx + r * 0.7, cy - r * 0.7);
      g.lineTo(cx - r * 0.7, cy + r * 0.7);
      g.strokePath();
      break;
    default:
      break;
  }
}

/** Полупрозрачная подсветка зон расстановки (синяя — игрок, красная — враг). */
export function drawZoneOverlay(
  g: Phaser.GameObjects.Graphics,
  grid: HexGrid,
): void {
  g.clear();
  const playerEnd = CONFIG.PLAYER_ZONE_COLS - 1;
  const enemyStart = grid.cols - CONFIG.ENEMY_ZONE_COLS;
  for (let row = 0; row < grid.rows; row++) {
    for (let col = 0; col < grid.cols; col++) {
      let color = 0;
      if (col <= playerEnd) color = 0x3b82f6;
      else if (col >= enemyStart) color = 0xef4444;
      if (!color) continue;
      const p = grid.pixelOf(col, row);
      const poly = hexPolygon(p.x, p.y, grid.size * 0.96);
      g.fillStyle(color, 0.12);
      g.fillPoints(poly.points, true);
    }
  }
}
