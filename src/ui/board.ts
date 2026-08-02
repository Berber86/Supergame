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

      // 3D Bevel/Shadow Hex
      g.fillStyle(0x0a0c10, 0.55);
      g.fillPoints(poly.points, true);

      const bevelPoly = hexPolygon(p.x, p.y, grid.size * 0.93);
      g.fillStyle(0x1e293b, 0.9);
      g.fillPoints(bevelPoly.points, true);

      const insetPoly = hexPolygon(p.x, p.y, grid.size * 0.86);
      g.fillStyle(TERRAIN_COLORS[cell.terrain], 1);
      g.fillPoints(insetPoly.points, true);

      // Inner border lines
      g.lineStyle(1.5, 0x000000, 0.25);
      g.strokePoints(insetPoly.points, true);

      g.lineStyle(1, 0xffffff, 0.09);
      g.strokePoints(bevelPoly.points, true);

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
  if (cell.terrain === 'plain') {
    // Grass tufts
    g.lineStyle(1.5, 0x3d542d, 0.6);
    // Left tuft
    g.beginPath();
    g.moveTo(cx - 10, cy + 4); g.lineTo(cx - 12, cy - 4);
    g.moveTo(cx - 10, cy + 4); g.lineTo(cx - 10, cy - 6);
    g.moveTo(cx - 10, cy + 4); g.lineTo(cx - 7, cy - 3);
    g.strokePath();

    // Right tuft
    g.beginPath();
    g.moveTo(cx + 12, cy - 2); g.lineTo(cx + 9, cy - 9);
    g.moveTo(cx + 12, cy - 2); g.lineTo(cx + 12, cy - 11);
    g.moveTo(cx + 12, cy - 2); g.lineTo(cx + 15, cy - 8);
    g.strokePath();
  } else if (cell.terrain === 'forest') {
    // Pine Trees
    const drawPine = (tx: number, ty: number, h: number) => {
      g.fillStyle(0x19321c, 1);
      g.fillRect(tx - 2, ty + h * 0.1, 4, h * 0.4); // stem
      g.fillStyle(0x35633b, 1);
      g.fillTriangle(
        tx, ty - h * 0.5,
        tx - h * 0.4, ty,
        tx + h * 0.4, ty
      );
      g.fillTriangle(
        tx, ty - h * 0.2,
        tx - h * 0.3, ty + h * 0.2,
        tx + h * 0.3, ty + h * 0.2
      );
      g.lineStyle(1, 0x142616, 0.8);
      g.strokeTriangle(
        tx, ty - h * 0.5,
        tx - h * 0.4, ty,
        tx + h * 0.4, ty
      );
    };
    drawPine(cx - size * 0.25, cy + size * 0.1, size * 0.45);
    drawPine(cx + size * 0.25, cy + size * 0.1, size * 0.45);
    drawPine(cx, cy - size * 0.15, size * 0.55);
  } else if (cell.terrain === 'hill') {
    // Multi-layered beautiful hills
    g.lineStyle(2, 0xbf9c56, 1);
    g.fillStyle(0x735a2e, 1);
    
    // Front hill
    g.beginPath();
    g.moveTo(cx - size * 0.45, cy + size * 0.35);
    g.lineTo(cx - size * 0.1, cy - size * 0.15);
    g.lineTo(cx + size * 0.25, cy + size * 0.35);
    g.closePath();
    g.fillPath();
    g.strokePath();
    
    // Back hill
    g.beginPath();
    g.moveTo(cx - size * 0.15, cy + size * 0.35);
    g.lineTo(cx + size * 0.15, cy - size * 0.22);
    g.lineTo(cx + size * 0.45, cy + size * 0.35);
    g.closePath();
    g.fillPath();
    g.strokePath();
  } else if (cell.terrain === 'rock') {
    // Sharp faceted boulder
    g.fillStyle(0x3e4145, 1);
    g.lineStyle(2, 0x1a1c1e, 1);
    
    // Main boulder polygon
    g.beginPath();
    g.moveTo(cx - size * 0.4, cy + size * 0.3);
    g.lineTo(cx - size * 0.45, cy - size * 0.1);
    g.lineTo(cx - size * 0.1, cy - size * 0.45);
    g.lineTo(cx + size * 0.3, cy - size * 0.4);
    g.lineTo(cx + size * 0.45, cy - size * 0.05);
    g.lineTo(cx + size * 0.35, cy + size * 0.35);
    g.closePath();
    g.fillPath();
    g.strokePath();
    
    // Facet lines for 3D look
    g.lineStyle(1.5, 0x6e7278, 0.75);
    g.beginPath();
    g.moveTo(cx - size * 0.1, cy - size * 0.45);
    g.lineTo(cx, cy + size * 0.1);
    g.lineTo(cx - size * 0.4, cy + size * 0.3);
    
    g.moveTo(cx, cy + size * 0.1);
    g.lineTo(cx + size * 0.45, cy - size * 0.05);
    g.strokePath();
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
