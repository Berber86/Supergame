import Phaser from 'phaser';
import { CONFIG } from '../config';
import {
  ENEMY_LINEUP,
  ROLE_INFO,
  STONE_AGE_UNITS,
  findTemplate,
  type UnitTemplate,
} from '../data/units';
import { TERRAIN_LABEL } from '../data/terrain';
import { buildTerrainMap, terrainSourceFromMap } from '../data/boardLayout';
import type { DeploymentEntry } from '../systems/CombatSystem';
import { HexGrid } from '../systems/HexGrid';
import type { UnitModel } from '../entities/UnitModel';
import { COLORS } from '../ui/theme';
import { createUnitView, setHpRatio } from '../ui/UnitView';
import {
  drawTerrainLayer,
  drawZoneOverlay,
  hexPolygon,
} from '../ui/board';

interface PlacedUnit {
  templateId: string;
  col: number;
  row: number;
  view: ReturnType<typeof createUnitView>;
}

interface Card {
  template: UnitTemplate;
  container: Phaser.GameObjects.Container;
  homeX: number;
  homeY: number;
}

const CARD_W = 350;
const CARD_H = 60;
const GRID_CENTER_X = 430;
const GRID_CENTER_Y = 410;

/** Сцена фазы расстановки: drag-and-drop юнитов на гексы зоны игрока. */
export class DeploymentScene extends Phaser.Scene {
  private grid!: HexGrid;
  private terrainGfx!: Phaser.GameObjects.Graphics;
  private zoneGfx!: Phaser.GameObjects.Graphics;
  private hoverGfx!: Phaser.GameObjects.Graphics;
  private hoverTerrainText!: Phaser.GameObjects.Text;

  private cards = new Map<string, Card>();
  private placed: PlacedUnit[] = [];
  private placedCells = new Set<string>();

  private draggingId: string | null = null;
  private hoverCellKey: string | null = null;

  private startBtn!: Phaser.GameObjects.Container;
  private startLabel!: Phaser.GameObjects.Text;
  private startBg!: Phaser.GameObjects.Rectangle;

  constructor() {
    super('Deployment');
  }

  create(): void {
    this.cameras.main.setBackgroundColor(COLORS.bg);

    const map = buildTerrainMap(
      CONFIG.GRID_COLS,
      CONFIG.GRID_ROWS,
      CONFIG.TERRAIN_SEED,
    );
    const { originX, originY } = computeOrigin(
      CONFIG.GRID_COLS,
      CONFIG.GRID_ROWS,
      CONFIG.HEX_SIZE,
      GRID_CENTER_X,
      GRID_CENTER_Y,
    );
    this.grid = new HexGrid(
      CONFIG.GRID_COLS,
      CONFIG.GRID_ROWS,
      originX,
      originY,
      terrainSourceFromMap(map),
    );

    this.terrainGfx = this.add.graphics().setDepth(0);
    this.zoneGfx = this.add.graphics().setDepth(1);
    this.hoverGfx = this.add.graphics().setDepth(5);
    drawTerrainLayer(this.terrainGfx, this.grid);
    drawZoneOverlay(this.zoneGfx, this.grid);

    this.drawLegend();
    this.drawEnemies();
    this.drawPanel();
    this.drawTitle();

    this.hoverTerrainText = this.add
      .text(16, 16, '', {
        fontFamily: 'Consolas, monospace',
        fontSize: '13px',
        color: '#9aa3b2',
      })
      .setDepth(20);

    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (this.draggingId) return;
      this.updateHover(pointer);
    });
    this.input.on('pointerout', () => this.clearHover());

    this.refreshStartButton();
  }

  // ---------- Заголовок / легенда ----------

  private drawTitle(): void {
    this.add
      .text(GRID_CENTER_X, 34, 'THE LONG LINE — Расстановка', {
        fontFamily: 'Arial, sans-serif',
        fontSize: '26px',
        color: '#e5e7eb',
        fontStyle: 'bold',
      })
      .setOrigin(0.5);

    this.add
      .text(
        GRID_CENTER_X,
        62,
        'Перетащите юнитов на синюю зону (левые 3 колонки). Красная зона — враги.',
        { fontFamily: 'Arial, sans-serif', fontSize: '13px', color: '#9aa3b2' },
      )
      .setOrigin(0.5);

    this.add
      .text(16, this.scale.height - 22, `SEED боя: ${CONFIG.SEED}  •  рельеф: ${CONFIG.TERRAIN_SEED} (детерминированно)`, {
        fontFamily: 'Consolas, monospace',
        fontSize: '12px',
        color: '#6b7280',
      })
      .setDepth(20);
  }

  private drawLegend(): void {
    const items: [string, number][] = [
      [TERRAIN_LABEL.plain, 0x4f6b3a],
      [TERRAIN_LABEL.forest, 0x2f5d34],
      [TERRAIN_LABEL.hill, 0x8a6b3b],
      [TERRAIN_LABEL.rock, 0x55585c],
    ];
    let x = 16;
    const y = 90;
    this.add
      .text(x, y - 18, 'Рельеф:', {
        fontFamily: 'Arial, sans-serif',
        fontSize: '12px',
        color: '#9aa3b2',
      })
      .setDepth(20);
    for (const [label, color] of items) {
      this.add.rectangle(x + 6, y + 4, 14, 14, color).setOrigin(0.5).setDepth(20);
      this.add
        .text(x + 18, y, label, {
          fontFamily: 'Arial, sans-serif',
          fontSize: '12px',
          color: '#cbd5e1',
        })
        .setDepth(20);
      x += 18 + label.length * 7 + 22;
    }
  }

  // ---------- Превью врагов ----------

  private drawEnemies(): void {
    for (const e of ENEMY_LINEUP) {
      const tpl = findTemplate(e.templateId);
      const view = createUnitView(this, {
        name: tpl.name,
        role: tpl.role,
        team: 'enemy',
      });
      const p = this.grid.pixelOf(e.col, e.row);
      view.container.setPosition(p.x, p.y);
      setHpRatio(view, 1);
    }
  }

  // ---------- Панель юнитов ----------

  private drawPanel(): void {
    const panelX = 1078;
    const top = 90;
    const step = 64;

    this.add
      .rectangle(panelX, this.scale.height / 2, 366, this.scale.height - 40, COLORS.panel, 0.6)
      .setStrokeStyle(2, COLORS.panelEdge)
      .setOrigin(0.5)
      .setDepth(2);

    this.add
      .text(panelX, 56, 'Отряд игрока', {
        fontFamily: 'Arial, sans-serif',
        fontSize: '16px',
        color: '#e5e7eb',
        fontStyle: 'bold',
      })
      .setOrigin(0.5)
      .setDepth(3);

    STONE_AGE_UNITS.forEach((tpl, i) => {
      const card = this.makeCard(tpl, panelX, top + i * step);
      this.cards.set(tpl.id, card);
    });

    // Кнопки.
    this.startBtn = this.makeButton(panelX, this.scale.height - 92, '⚔  Начать бой', 0x1f6feb, () => {
      if (this.placed.length === 0) return;
      const entries: DeploymentEntry[] = this.placed.map((p) => ({
        templateId: p.templateId,
        col: p.col,
        row: p.row,
      }));
      this.game.registry.set('playerDeployment', entries);
      this.scene.start('Battle');
    });
    this.startBg = this.startBtn.getByName('bg') as Phaser.GameObjects.Rectangle;
    this.startLabel = this.startBtn.getByName('label') as Phaser.GameObjects.Text;

    this.makeButton(panelX - 96, this.scale.height - 42, '↺  Сброс', 0x334155, () =>
      this.resetDeployment(),
    );
    this.makeButton(panelX + 96, this.scale.height - 42, '🎲  Случайно', 0x334155, () =>
      this.autoDeploy(),
    );
  }

  private makeCard(tpl: UnitTemplate, x: number, y: number): Card {
    const container = this.add.container(x, y, []).setDepth(6);

    const bg = this.add
      .rectangle(0, 0, CARD_W, CARD_H, COLORS.panel, 0.95)
      .setStrokeStyle(2, COLORS.panelEdge);
    bg.setInteractive(
      new Phaser.Geom.Rectangle(-CARD_W / 2, -CARD_H / 2, CARD_W, CARD_H),
      Phaser.Geom.Rectangle.Contains,
    );
    this.input.setDraggable(bg);

    const emblem = this.add.circle(-CARD_W / 2 + 24, 0, 16, ROLE_INFO[tpl.role].color);
    const letter = this.add
      .text(-CARD_W / 2 + 24, 0, ROLE_INFO[tpl.role].letter, {
        fontFamily: 'Arial, sans-serif',
        fontSize: '15px',
        fontStyle: 'bold',
        color: '#0b0e14',
      })
      .setOrigin(0.5);

    const name = this.add
      .text(-CARD_W / 2 + 50, -11, tpl.name, {
        fontFamily: 'Arial, sans-serif',
        fontSize: '13px',
        color: '#e5e7eb',
        fontStyle: 'bold',
      })
      .setOrigin(0, 0.5);

    const stats = this.add
      .text(
        -CARD_W / 2 + 50,
        9,
        `HP ${tpl.hp}  ATK ${tpl.atk}  DEF ${tpl.def}  R ${tpl.range}  SPD ${tpl.move}`,
        { fontFamily: 'Consolas, monospace', fontSize: '11px', color: '#9aa3b2' },
      )
      .setOrigin(0, 0.5);

    container.add([bg, emblem, letter, name, stats]);

    bg.on('pointerover', () => bg.setFillStyle(0x25304a, 0.95));
    bg.on('pointerout', () => bg.setFillStyle(COLORS.panel, 0.95));
    bg.on('dragstart', () => {
      this.draggingId = tpl.id;
      this.children.bringToTop(container);
      container.setScale(1.05);
    });
    bg.on('drag', (_p: Phaser.Input.Pointer, dragX: number, dragY: number) => {
      container.x = dragX;
      container.y = dragY;
      this.updateDragHover(this.input.activePointer);
    });
    bg.on('dragend', () => {
      container.setScale(1);
      this.finishDrop(tpl.id);
      this.draggingId = null;
      this.clearHover();
    });

    return { template: tpl, container, homeX: x, homeY: y };
  }

  private makeButton(
    x: number,
    y: number,
    label: string,
    color: number,
    onClick: () => void,
  ): Phaser.GameObjects.Container {
    const w = 168;
    const h = 38;
    const bg = this.add.rectangle(0, 0, w, h, color).setName('bg').setStrokeStyle(2, COLORS.panelEdge);
    const text = this.add
      .text(0, 0, label, {
        fontFamily: 'Arial, sans-serif',
        fontSize: '14px',
        color: '#ffffff',
        fontStyle: 'bold',
      })
      .setOrigin(0.5)
      .setName('label');
    const container = this.add.container(x, y, [bg, text]).setDepth(15);
    bg.setInteractive(new Phaser.Geom.Rectangle(-w / 2, -h / 2, w, h), Phaser.Geom.Rectangle.Contains);
    bg.on('pointerover', () => bg.setFillStyle(0x34528f));
    bg.on('pointerout', () => bg.setFillStyle(color));
    bg.on('pointerup', onClick);
    return container;
  }

  // ---------- Размещение / снятие ----------

  private playerZoneEnd(): number {
    return CONFIG.PLAYER_ZONE_COLS - 1;
  }

  private canPlace(col: number, row: number): boolean {
    if (col < 0 || col > this.playerZoneEnd()) return false;
    if (row < 0 || row >= this.grid.rows) return false;
    const cell = this.grid.get(col, row);
    if (!cell || cell.blocked) return false;
    return !this.placedCells.has(cellKey(col, row));
  }

  private finishDrop(templateId: string): void {
    const card = this.cards.get(templateId);
    if (!card) return;
    const pointer = this.input.activePointer;
    const cell = this.grid.cellAtPixel(pointer.x, pointer.y);
    if (cell && this.canPlace(cell.col, cell.row)) {
      this.placeUnit(card.template, cell.col, cell.row);
      card.container.setVisible(false);
    } else {
      // Вернуть карту на место.
      this.tweens.add({
        targets: card.container,
        x: card.homeX,
        y: card.homeY,
        duration: 180,
        ease: 'Back.out',
      });
    }
    this.refreshStartButton();
  }

  private placeUnit(tpl: UnitTemplate, col: number, row: number): void {
    const view = createUnitView(this, {
      name: tpl.name,
      role: tpl.role,
      team: 'player',
    });
    const p = this.grid.pixelOf(col, row);
    view.container.setPosition(p.x, p.y);
    setHpRatio(view, 1);
    view.container.setDepth(12);

    // Клик по размещённому юниту — снять его.
    const hit = new Phaser.Geom.Circle(0, 0, view.radius * 1.5);
    view.container.setInteractive(hit, Phaser.Geom.Circle.Contains);
    view.container.on('pointerup', () => {
      if (this.draggingId) return;
      this.removeUnit(templateKey(col, row));
    });

    this.placed.push({ templateId: tpl.id, col, row, view });
    this.placedCells.add(cellKey(col, row));
  }

  private removeUnit(key: string): void {
    const idx = this.placed.findIndex((p) => templateKey(p.col, p.row) === key);
    if (idx < 0) return;
    const removed = this.placed.splice(idx, 1)[0];
    this.placedCells.delete(cellKey(removed.col, removed.row));
    removed.view.container.destroy();
    const card = this.cards.get(removed.templateId);
    if (card) card.container.setVisible(true);
    this.refreshStartButton();
  }

  private resetDeployment(): void {
    for (const p of this.placed) p.view.container.destroy();
    this.placed = [];
    this.placedCells.clear();
    for (const card of this.cards.values()) card.container.setVisible(true);
    this.refreshStartButton();
  }

  /** Автоматически расставить весь отряд (для быстрого старта). */
  private autoDeploy(): void {
    this.resetDeployment();
    const tpls = STONE_AGE_UNITS;
    let i = 0;
    for (let col = 0; col <= this.playerZoneEnd() && i < tpls.length; col++) {
      for (let row = 0; row < this.grid.rows && i < tpls.length; row++) {
        if (this.canPlace(col, row)) {
          this.placeUnit(tpls[i], col, row);
          this.cards.get(tpls[i].id)!.container.setVisible(false);
          i++;
        }
      }
    }
    this.refreshStartButton();
  }

  private refreshStartButton(): void {
    const enabled = this.placed.length > 0;
    this.startBg.setFillStyle(enabled ? 0x1f6feb : 0x334155);
    this.startLabel.setAlpha(enabled ? 1 : 0.5);
    (this.startBg as Phaser.GameObjects.Rectangle).input!.cursor = enabled
      ? 'pointer'
      : 'default';
  }

  // ---------- Подсветка наведения ----------

  private updateHover(pointer: Phaser.Input.Pointer): void {
    const cell = this.grid.cellAtPixel(pointer.x, pointer.y);
    if (!cell) {
      this.clearHover();
      return;
    }
    const key = cellKey(cell.col, cell.row);
    if (key === this.hoverCellKey) return;
    this.hoverCellKey = key;
    this.renderHover(cell);
  }

  private updateDragHover(pointer: Phaser.Input.Pointer): void {
    const cell = this.grid.cellAtPixel(pointer.x, pointer.y);
    this.hoverCellKey = cell ? cellKey(cell.col, cell.row) : null;
    this.renderHover(cell ?? undefined);
  }

  private renderHover(cell?: { col: number; row: number; terrain: string; blocked: boolean }): void {
    this.hoverGfx.clear();
    if (!cell) {
      this.hoverTerrainText.setText('');
      return;
    }
    const p = this.grid.pixelOf(cell.col, cell.row);
    const poly = hexPolygon(p.x, p.y, this.grid.size * 0.96);
    const valid = this.canPlace(cell.col, cell.row);
    const color = this.draggingId
      ? valid
        ? COLORS.valid
        : COLORS.invalid
      : COLORS.hover;
    this.hoverGfx.lineStyle(3, color, 0.95);
    this.hoverGfx.strokePoints(poly.points, true);
    if (this.draggingId && valid) {
      this.hoverGfx.fillStyle(color, 0.18);
      this.hoverGfx.fillPoints(poly.points, true);
    }
    const terrainLabel =
      TERRAIN_LABEL[cell.terrain as keyof typeof TERRAIN_LABEL] ?? cell.terrain;
    const where =
      cell.col <= this.playerZoneEnd()
        ? 'зона игрока'
        : cell.col >= this.grid.cols - CONFIG.ENEMY_ZONE_COLS
        ? 'зона врага'
        : 'центр';
    this.hoverTerrainText.setText(`${terrainLabel} • ${where}`);
  }

  private clearHover(): void {
    this.hoverCellKey = null;
    this.hoverGfx.clear();
    this.hoverTerrainText.setText('');
  }
}

// ---------- утилиты ----------

function cellKey(col: number, row: number): string {
  return col + ',' + row;
}
function templateKey(col: number, row: number): string {
  return 'u_' + col + '_' + row;
}

export function computeOrigin(
  cols: number,
  rows: number,
  size: number,
  desiredCenterX: number,
  desiredCenterY: number,
): { originX: number; originY: number } {
  const w = Math.sqrt(3) * size;
  const minX = 0;
  const maxX = w * (cols - 1) + w / 2;
  const minY = 0;
  const maxY = 1.5 * size * (rows - 1);
  return {
    originX: desiredCenterX - (minX + maxX) / 2,
    originY: desiredCenterY - (minY + maxY) / 2,
  };
}
