import Phaser from 'phaser';
import { CONFIG } from '../config';
import { TERRAIN_LABEL } from '../data/terrain';
import { generateWave, isEliteWave } from '../data/waves';
import { ROLE_INFO } from '../data/units';
import { findNode } from '../data/evolution-tree';
import { Campaign, type PlayerDeploymentEntry } from '../meta/Campaign';
import { isDeployable, type RosterUnit } from '../meta/RosterUnit';
import { campaignOf } from '../meta/session';
import { HexGrid } from '../systems/HexGrid';
import { buildTerrainMap, terrainSeedForWave, terrainSourceFromMap } from '../data/boardLayout';
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
      terrainSourceFromMap(buildTerrainMap(
        CONFIG.GRID_COLS,
        CONFIG.GRID_ROWS,
        terrainSeedForWave(this.campaign.wave),
      )),
    );

    this.terrainGfx = this.add.graphics().setDepth(0);
    this.zoneGfx = this.add.graphics().setDepth(1);
    this.hoverGfx = this.add.graphics().setDepth(5);
    drawTerrainLayer(this.terrainGfx, this.grid);
    drawZoneOverlay(this.zoneGfx, this.grid);

    this.drawEnemies();

    this.add
      .text(
        GRID_CENTER_X,
        30,
        `Расстановка — Волна ${this.campaign.wave}${isEliteWave(this.campaign.wave) ? ' • ЭЛИТА' : ''}`,
        {
          fontFamily: 'Arial, sans-serif',
          fontSize: '24px',
          fontStyle: 'bold',
          color: '#e5e7eb',
        },
      )
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
    const terrain = buildTerrainMap(
      CONFIG.GRID_COLS,
      CONFIG.GRID_ROWS,
      terrainSeedForWave(this.campaign.wave),
    );
    for (const we of generateWave(
      this.campaign.worldEpochScore(),
      this.campaign.wave,
      terrain,
    )) {
      const node = findNode(we.scaled.id);
      const view = createUnitView(this, {
        name: we.scaled.name,
        role: we.scaled.role,
        team: 'enemy',
        epochIndex: node ? node.epoch : 1,
        line: node ? node.line : 'Infantry',
      });
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
      hitPadding: 4,
      minHitHeight: 44,
    });
    makeButton(this, PANEL_X + 92, 754, 170, 34, 'Сброс', () => this.resetDeployment(), {
      color: 0x334155,
      fontSize: 13,
      hitPadding: 4,
      minHitHeight: 44,
    });

    this.countText.setText(`Размещено ${this.placed.length} из ${selected.length}`);
  }

  private makeCard(ru: RosterUnit, x: number, y: number): Card {
    const container = this.add.container(x, y, []).setDepth(6);
    const bg = this.add
      .rectangle(0, 0, CARD_W, CARD_H, COLORS.panel, 0.95)
      .setStrokeStyle(2, COLORS.panelEdge);
    // Автоматический hit-area Rectangle покрывает всю карточку. Ручная область
    // с отрицательными координатами покрывала только её четверть.
    bg.setInteractive({ useHandCursor: true });
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
    const node = findNode(ru.templateId);
    const view = createUnitView(this, {
      name: ru.name,
      role: ru.role,
      team: 'player',
      epochIndex: ru.epochIndex,
      line: node ? node.line : 'Infantry',
    });
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
    const priority = (ru: RosterUnit): number => {
      if (ru.combatRole === 'ranged-dps') return 0;
      if (ru.combatRole === 'aoe-breaker') return 1;
      if (ru.combatRole === 'support-heal' || ru.combatRole === 'support-buff') return 2;
      if (ru.combatRole === 'tank') return 3;
      return 4;
    };
    const list = [...this.cards.values()].sort(
      (a, b) => priority(a.ru) - priority(b.ru) || a.ru.id.localeCompare(b.ru.id),
    );
    const cells = this.grid.cells.flat().filter(
      (cell) => cell.col <= this.playerZoneEnd() && this.canPlace(cell.col, cell.row),
    );

    for (const card of list) {
      let bestIndex = 0;
      let bestScore = -Infinity;
      for (let i = 0; i < cells.length; i++) {
        const cell = cells[i];
        const role = card.ru.combatRole;
        let score = 0;
        if (role === 'ranged-dps') score = (cell.terrain === 'hill' ? 100 : 0) - cell.col * 4;
        else if (role === 'aoe-breaker') {
          score = (cell.terrain === 'hill' ? 50 : 0) - cell.col * 2;
        } else if (role === 'support-heal' || role === 'support-buff') {
          score = (cell.terrain === 'forest' ? 24 : 0) - cell.col * 3;
        } else if (role === 'tank') score = cell.col * 5 + (cell.terrain === 'forest' ? 10 : 0);
        else score = cell.col * 4 + (cell.terrain === 'plain' ? 4 : 0);
        // Стабильный tie-break сверху вниз.
        score -= cell.row * 0.001;
        if (score > bestScore) {
          bestScore = score;
          bestIndex = i;
        }
      }
      const cell = cells.splice(bestIndex, 1)[0];
      if (!cell) break;
      this.placeUnit(card.ru, cell.col, cell.row);
      card.container.setVisible(false);
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
