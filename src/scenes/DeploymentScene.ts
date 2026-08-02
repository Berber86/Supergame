import Phaser from 'phaser';
import { CONFIG } from '../config';
import { TERRAIN_LABEL } from '../data/terrain';
import { generateWave } from '../data/waves';
import { ROLE_INFO } from '../data/units';
import { Campaign, type PlayerDeploymentEntry } from '../meta/Campaign';
import { isDeployable, type RosterUnit } from '../meta/RosterUnit';
import { campaignOf } from '../meta/session';
import { HexGrid } from '../systems/HexGrid';
import { buildTerrainMap, terrainSourceFromMap } from '../data/boardLayout';
import { COLORS } from '../ui/theme';
import { createUnitView, setHpRatio } from '../ui/UnitView';
import { drawTerrainLayer, drawZoneOverlay, hexPolygon } from '../ui/board';
import { makeButton, setButtonEnabled, setButtonLabel } from '../ui/widgets';

interface PlacedUnit {
  rosterId: string;
  col: number;
  row: number;
  view: ReturnType<typeof createUnitView>;
}

interface Card {
  ru: RosterUnit;
  container: Phaser.GameObjects.Container;
  homeX: number;
  homeY: number;
}

const CARD_W = 350;
const CARD_H = 60;
const GRID_CENTER_X = 430;
const GRID_CENTER_Y = 410;
const PANEL_X = 1078;

/** Сцена расстановки выбранных юнитов на гексах зоны игрока. */
export class DeploymentScene extends Phaser.Scene {
  private grid!: HexGrid;
  private campaign!: Campaign;
  private terrainGfx!: Phaser.GameObjects.Graphics;
  private zoneGfx!: Phaser.GameObjects.Graphics;
  private hoverGfx!: Phaser.GameObjects.Graphics;
  private hoverText!: Phaser.GameObjects.Text;

  private cards = new Map<string, Card>();
  private placed: PlacedUnit[] = [];
  private placedCells = new Set<string>();

  private draggingId: string | null = null;
  private hoverCellKey: string | null = null;

  private startBtn!: Phaser.GameObjects.Container;
  private countText!: Phaser.GameObjects.Text;

  constructor() {
    super('Deployment');
  }

  create(): void {
    this.cameras.main.setBackgroundColor(COLORS.bg);
    this.campaign = campaignOf(this.game.registry);

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
      terrainSourceFromMap(buildTerrainMap(CONFIG.GRID_COLS, CONFIG.GRID_ROWS, CONFIG.TERRAIN_SEED)),
    );

    this.terrainGfx = this.add.graphics().setDepth(0);
    this.zoneGfx = this.add.graphics().setDepth(1);
    this.hoverGfx = this.add.graphics().setDepth(5);
    drawTerrainLayer(this.terrainGfx, this.grid);
    drawZoneOverlay(this.zoneGfx, this.grid);

    this.drawEnemies();

    this.add
      .text(GRID_CENTER_X, 30, `Расстановка — Волна ${this.campaign.wave}`, {
        fontFamily: 'Arial, sans-serif',
        fontSize: '24px',
        fontStyle: 'bold',
        color: '#e5e7eb',
      })
      .setOrigin(0.5);
    this.add
      .text(GRID_CENTER_X, 58, 'Перетащите юнитов на синюю зону (левые 3 колонки).', {
        fontFamily: 'Arial, sans-serif',
        fontSize: '13px',
        color: '#9aa3b2',
      })
      .setOrigin(0.5);

    this.hoverText = this.add
      .text(16, 16, '', { fontFamily: 'Consolas, monospace', fontSize: '13px', color: '#9aa3b2' })
      .setDepth(20);

    this.drawPanel();

    makeButton(this, 90, 34, 150, 34, '←  К составу', () => this.scene.start('Composition'), {
      color: 0x334155,
      fontSize: 13,
    });

    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (this.draggingId) return;
      this.updateHover(p);
    });
    this.input.on('pointerout', () => this.clearHover());

    this.refreshStart();
  }

  // ---------- Враги (превью) ----------

  private drawEnemies(): void {
    for (const we of generateWave(this.campaign.wave)) {
      const view = createUnitView(this, { name: we.scaled.name, role: we.scaled.role, team: 'enemy' });
      const p = this.grid.pixelOf(we.col, we.row);
      view.container.setPosition(p.x, p.y);
      setHpRatio(view, 1);
    }
  }

  // ---------- Панель выбранных юнитов ----------

  private drawPanel(): void {
    this.add
      .rectangle(PANEL_X, this.scale.height / 2, 366, this.scale.height - 40, COLORS.panel, 0.6)
      .setStrokeStyle(2, COLORS.panelEdge)
      .setOrigin(0.5)
      .setDepth(2);
    this.add
      .text(PANEL_X, 56, 'Ваш отряд', {
        fontFamily: 'Arial, sans-serif',
        fontSize: '16px',
        fontStyle: 'bold',
        color: '#e5e7eb',
      })
      .setOrigin(0.5)
      .setDepth(3);

    this.countText = this.add
      .text(PANEL_X, 80, '', { fontFamily: 'Consolas, monospace', fontSize: '12px', color: '#9aa3b2' })
      .setOrigin(0.5)
      .setDepth(3);

    const selected = this.campaign.selectedIds
      .map((id) => this.campaign.get(id))
      .filter((ru): ru is RosterUnit => !!ru && isDeployable(ru));

    selected.forEach((ru, i) => {
      const card = this.makeCard(ru, PANEL_X, 116 + i * 64);
      this.cards.set(ru.id, card);
    });

    this.startBtn = makeButton(
      this,
      PANEL_X,
      700,
      350,
      50,
      '⚔  Начать бой',
      () => this.startBattle(),
      { color: 0x1f6feb, fontSize: 17 },
    );
    makeButton(this, PANEL_X - 92, 754, 170, 34, 'Авто', () => this.autoDeploy(), {
      color: 0x334155,
      fontSize: 13,
    });
    makeButton(this, PANEL_X + 92, 754, 170, 34, 'Сброс', () => this.resetDeployment(), {
      color: 0x334155,
      fontSize: 13,
    });

    this.countText.setText(`Размещено ${this.placed.length} из ${selected.length}`);
  }

  private makeCard(ru: RosterUnit, x: number, y: number): Card {
    const container = this.add.container(x, y, []).setDepth(6);
    const bg = this.add
      .rectangle(0, 0, CARD_W, CARD_H, COLORS.panel, 0.95)
      .setStrokeStyle(2, COLORS.panelEdge);
    bg.setInteractive(
      new Phaser.Geom.Rectangle(-CARD_W / 2, -CARD_H / 2, CARD_W, CARD_H),
      Phaser.Geom.Rectangle.Contains,
    );
    this.input.setDraggable(bg);

    const role = ROLE_INFO[ru.role];
    const emblem = this.add.circle(-CARD_W / 2 + 24, 0, 16, role.color);
    const letter = this.add
      .text(-CARD_W / 2 + 24, 0, role.letter, {
        fontFamily: 'Arial, sans-serif',
        fontSize: '15px',
        fontStyle: 'bold',
        color: '#0b0e14',
      })
      .setOrigin(0.5);
    const name = this.add
      .text(-CARD_W / 2 + 50, -11, ru.name, {
        fontFamily: 'Arial, sans-serif',
        fontSize: '13px',
        fontStyle: 'bold',
        color: '#e5e7eb',
      })
      .setOrigin(0, 0.5);
    const stats = this.add
      .text(
        -CARD_W / 2 + 50,
        9,
        `HP ${Math.ceil(ru.currentHp)}/${ru.maxHp}  ATK ${ru.atk}  DEF ${ru.def}  RNG ${ru.range}`,
        { fontFamily: 'Consolas, monospace', fontSize: '11px', color: '#9aa3b2' },
      )
      .setOrigin(0, 0.5);
    container.add([bg, emblem, letter, name, stats]);

    bg.on('pointerover', () => bg.setFillStyle(0x25304a, 0.95));
    bg.on('pointerout', () => bg.setFillStyle(COLORS.panel, 0.95));
    bg.on('dragstart', () => {
      this.draggingId = ru.id;
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
      this.finishDrop(ru.id);
      this.draggingId = null;
      this.clearHover();
    });

    return { ru, container, homeX: x, homeY: y };
  }

  // ---------- Размещение ----------

  private playerZoneEnd(): number {
    return CONFIG.PLAYER_ZONE_COLS - 1;
  }

  private canPlace(col: number, row: number): boolean {
    if (col < 0 || col > this.playerZoneEnd()) return false;
    if (row < 0 || row >= this.grid.rows) return false;
    const cell = this.grid.get(col, row);
    if (!cell || cell.blocked) return false;
    return !this.placedCells.has(col + ',' + row);
  }

  private finishDrop(rosterId: string): void {
    const card = this.cards.get(rosterId);
    if (!card) return;
    const pointer = this.input.activePointer;
    const cell = this.grid.cellAtPixel(pointer.x, pointer.y);
    if (cell && this.canPlace(cell.col, cell.row)) {
      this.placeUnit(card.ru, cell.col, cell.row);
      card.container.setVisible(false);
    } else {
      this.tweens.add({
        targets: card.container,
        x: card.homeX,
        y: card.homeY,
        duration: 180,
        ease: 'Back.out',
      });
    }
    this.refreshStart();
  }

  private placeUnit(ru: RosterUnit, col: number, row: number): void {
    const view = createUnitView(this, { name: ru.name, role: ru.role, team: 'player' });
    const p = this.grid.pixelOf(col, row);
    view.container.setPosition(p.x, p.y);
    setHpRatio(view, ru.currentHp / ru.maxHp);
    view.container.setDepth(12);
    view.container.setInteractive(
      new Phaser.Geom.Circle(0, 0, view.radius * 1.5),
      Phaser.Geom.Circle.Contains,
    );
    view.container.on('pointerup', () => {
      if (this.draggingId) return;
      this.removeUnit(ru.id);
    });
    this.placed.push({ rosterId: ru.id, col, row, view });
    this.placedCells.add(col + ',' + row);
    this.countText.setText(`Размещено ${this.placed.length} из ${this.cards.size}`);
  }

  private removeUnit(rosterId: string): void {
    const idx = this.placed.findIndex((p) => p.rosterId === rosterId);
    if (idx < 0) return;
    const removed = this.placed.splice(idx, 1)[0];
    this.placedCells.delete(removed.col + ',' + removed.row);
    removed.view.container.destroy();
    const card = this.cards.get(rosterId);
    if (card) card.container.setVisible(true);
    this.refreshStart();
  }

  private resetDeployment(): void {
    for (const p of this.placed) p.view.container.destroy();
    this.placed = [];
    this.placedCells.clear();
    for (const card of this.cards.values()) card.container.setVisible(true);
    this.refreshStart();
  }

  private autoDeploy(): void {
    this.resetDeployment();
    const list = [...this.cards.values()];
    let i = 0;
    for (let col = 0; col <= this.playerZoneEnd() && i < list.length; col++) {
      for (let row = 0; row < this.grid.rows && i < list.length; row++) {
        if (this.canPlace(col, row)) {
          this.placeUnit(list[i].ru, col, row);
          list[i].container.setVisible(false);
          i++;
        }
      }
    }
    this.refreshStart();
  }

  private refreshStart(): void {
    const n = this.placed.length;
    this.countText.setText(`Размещено ${n} из ${this.cards.size}`);
    setButtonEnabled(this.startBtn, n >= 1);
    setButtonLabel(this.startBtn, n >= 1 ? '⚔  Начать бой' : 'Разместите ≥1 юнита');
  }

  private startBattle(): void {
    if (this.placed.length === 0) return;
    const entries: PlayerDeploymentEntry[] = this.placed.map((p) => ({
      rosterId: p.rosterId,
      col: p.col,
      row: p.row,
    }));
    this.game.registry.set('playerDeployment', entries);
    this.scene.start('Battle');
  }

  // ---------- Наведение ----------

  private updateHover(pointer: Phaser.Input.Pointer): void {
    const cell = this.grid.cellAtPixel(pointer.x, pointer.y);
    if (!cell) {
      this.clearHover();
      return;
    }
    const key = cell.col + ',' + cell.row;
    if (key === this.hoverCellKey) return;
    this.hoverCellKey = key;
    this.renderHover(cell);
  }

  private updateDragHover(pointer: Phaser.Input.Pointer): void {
    const cell = this.grid.cellAtPixel(pointer.x, pointer.y);
    this.hoverCellKey = cell ? cell.col + ',' + cell.row : null;
    this.renderHover(cell ?? undefined);
  }

  private renderHover(cell?: { col: number; row: number; terrain: string; blocked: boolean }): void {
    this.hoverGfx.clear();
    if (!cell) {
      this.hoverText.setText('');
      return;
    }
    const p = this.grid.pixelOf(cell.col, cell.row);
    const poly = hexPolygon(p.x, p.y, this.grid.size * 0.96);
    const valid = this.canPlace(cell.col, cell.row);
    const color = this.draggingId ? (valid ? COLORS.valid : COLORS.invalid) : COLORS.hover;
    this.hoverGfx.lineStyle(3, color, 0.95);
    this.hoverGfx.strokePoints(poly.points, true);
    if (this.draggingId && valid) {
      this.hoverGfx.fillStyle(color, 0.18);
      this.hoverGfx.fillPoints(poly.points, true);
    }
    const terrainLabel = TERRAIN_LABEL[cell.terrain as keyof typeof TERRAIN_LABEL] ?? cell.terrain;
    const where =
      cell.col <= this.playerZoneEnd()
        ? 'зона игрока'
        : cell.col >= this.grid.cols - CONFIG.ENEMY_ZONE_COLS
        ? 'зона врага'
        : 'центр';
    this.hoverText.setText(`${terrainLabel} • ${where}`);
  }

  private clearHover(): void {
    this.hoverCellKey = null;
    this.hoverGfx.clear();
    this.hoverText.setText('');
  }
}

/** Центрирование сетки (используется и в BattleScene). */
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
