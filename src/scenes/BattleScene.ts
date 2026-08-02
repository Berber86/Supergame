import Phaser from 'phaser';
import { CONFIG } from '../config';
import { ENEMY_LINEUP, ROLE_INFO, STONE_AGE_UNITS, type UnitTemplate } from '../data/units';
import { TERRAIN_LABEL } from '../data/terrain';
import { buildTerrainMap, terrainSourceFromMap } from '../data/boardLayout';
import { CombatSystem, type DeploymentEntry } from '../systems/CombatSystem';
import type { SimEvent } from '../systems/sim-types';
import { HexGrid } from '../systems/HexGrid';
import type { UnitModel } from '../entities/UnitModel';
import type { UnitState } from '../entities/types';
import { COLORS, TEAM_COLORS } from '../ui/theme';
import { createUnitView, setHpRatio, setStateText, type UnitView } from '../ui/UnitView';
import { drawTerrainLayer, drawZoneOverlay, hexPolygon } from '../ui/board';
import { computeOrigin } from './DeploymentScene';

const GRID_CENTER_X = 640;
const GRID_CENTER_Y = 392;

/**
 * Сцена боя: ТОЛЬКО отрисовка и ввод.
 * Вся боевая логика живёт в CombatSystem; сцена проигрывает sim-events как
 * анимации и читает модель для полосок HP/состояний. Тайминги логики (10 Гц)
 * и анимаций (60 Гц) полностью развязаны через очередь событий.
 */
export class BattleScene extends Phaser.Scene {
  private grid!: HexGrid;
  private combat!: CombatSystem;

  private views = new Map<number, UnitView>();
  private units = new Map<number, UnitModel>();
  private moveTweens = new Map<number, Phaser.Tweens.Tween>();

  private hoverGfx!: Phaser.GameObjects.Graphics;
  private hudText!: Phaser.GameObjects.Text;
  private resultOverlay!: Phaser.GameObjects.Container;
  private resultShown = false;

  private tooltipBox!: Phaser.GameObjects.Container;
  private tooltipText!: Phaser.GameObjects.Text;

  constructor() {
    super('Battle');
  }

  create(): void {
    this.cameras.main.setBackgroundColor(COLORS.bg);
    this.resultShown = false;

    const map = buildTerrainMap(CONFIG.GRID_COLS, CONFIG.GRID_ROWS, CONFIG.TERRAIN_SEED);
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

    const terrainGfx = this.add.graphics().setDepth(0);
    const zoneGfx = this.add.graphics().setDepth(1);
    drawTerrainLayer(terrainGfx, this.grid);
    drawZoneOverlay(zoneGfx, this.grid);
    this.hoverGfx = this.add.graphics().setDepth(5);

    // --- Симуляция ---
    this.combat = new CombatSystem(this.grid, CONFIG.SEED);
    const templates = buildTemplateIndex();

    const playerEntries = (this.game.registry.get('playerDeployment') as DeploymentEntry[]) ?? [];
    const enemyEntries: DeploymentEntry[] = ENEMY_LINEUP.map((e) => ({
      templateId: e.templateId,
      col: e.col,
      row: e.row,
    }));
    this.combat.addUnits(playerEntries, templates, 'player');
    this.combat.addUnits(enemyEntries, templates, 'enemy');

    for (const u of this.combat.units) this.spawnView(u);

    this.combat.start();

    // --- HUD ---
    this.add
      .text(this.scale.width / 2, 28, 'THE LONG LINE — Бой', {
        fontFamily: 'Arial, sans-serif',
        fontSize: '24px',
        color: '#e5e7eb',
        fontStyle: 'bold',
      })
      .setOrigin(0.5)
      .setDepth(30);
    this.hudText = this.add
      .text(16, 16, '', {
        fontFamily: 'Consolas, monospace',
        fontSize: '14px',
        color: '#cbd5e1',
      })
      .setDepth(30);

    this.buildTooltip();
    this.buildResultOverlay();

    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      this.updateHover(pointer);
    });
    this.input.on('pointerout', () => {
      this.hoverGfx.clear();
      this.tooltipBox.setVisible(false);
    });
  }

  // ---------------- Жизненный цикл ----------------

  update(_time: number, delta: number): void {
    const dt = Phaser.Math.Clamp(delta / 1000, 0, 0.25);
    this.combat.update(dt);
    this.processEvents();
    this.syncVisuals();
    this.updateHud();

    if (!this.resultShown && this.combat.result !== 'ongoing') {
      this.showResult();
    }
  }

  // ---------------- Создание представлений ----------------

  private spawnView(u: UnitModel): void {
    const tpl = STONE_AGE_UNITS.find((t) => t.id === u.id)!;
    const view = createUnitView(this, {
      name: tpl.name,
      role: u.role,
      team: u.team,
      showState: true,
    });
    const p = this.grid.pixelOf(u.col, u.row);
    view.container.setPosition(p.x, p.y);
    setHpRatio(view, 1);
    setStateText(view, u.state);
    this.views.set(u.uid, view);
    this.units.set(u.uid, u);
  }

  // ---------------- Обработка событий -> анимации ----------------

  private processEvents(): void {
    for (const e of this.combat.events) this.handleEvent(e);
    this.combat.events.length = 0;
  }

  private handleEvent(e: SimEvent): void {
    switch (e.type) {
      case 'move':
        this.onMove(e.uid, e.toCol, e.toRow);
        break;
      case 'attack':
        this.onAttack(e);
        break;
      case 'heal':
        this.onHeal(e);
        break;
      case 'death':
        this.onDeath(e.uid);
        break;
      case 'state':
        // Состояния обновляются по модели каждый кадр — здесь не дублируем.
        break;
    }
  }

  private onMove(uid: number, col: number, row: number): void {
    const view = this.views.get(uid);
    if (!view) return;
    const prev = this.moveTweens.get(uid);
    if (prev) prev.stop();
    const p = this.grid.pixelOf(col, row);
    const tw = this.tweens.add({
      targets: view.container,
      x: p.x,
      y: p.y,
      duration: 170,
      ease: 'Quad.easeInOut',
    });
    this.moveTweens.set(uid, tw);
  }

  private onAttack(e: Extract<SimEvent, { type: 'attack' }>): void {
    const attacker = this.units.get(e.attacker);
    const target = this.units.get(e.target);
    const targetView = this.views.get(e.target);
    if (!attacker || !target || !targetView) return;

    const from = this.grid.pixelOf(attacker.col, attacker.row);
    const to = this.grid.pixelOf(target.col, target.row);

    if (e.ranged) this.spawnProjectile(from, to, TEAM_COLORS[attacker.team].glow);
    else this.lunge(attacker.uid, from, to);

    if (e.miss) {
      this.floatText(to, 'промах', '#9ca3af', 14);
      return;
    }
    this.flash(to, e.crit ? 0xfde047 : 0xffffff);
    this.floatText(
      { x: to.x, y: to.y - 14 },
      `-${e.damage}${e.crit ? '!' : ''}`,
      e.crit ? '#fde047' : '#ffffff',
      e.crit ? 20 : 15,
    );
  }

  private onHeal(e: Extract<SimEvent, { type: 'heal' }>): void {
    const target = this.units.get(e.target);
    if (!target) return;
    const pos = this.grid.pixelOf(target.col, target.row);
    this.flash(pos, 0x22c55e);
    this.floatText({ x: pos.x, y: pos.y - 14 }, `+${e.amount}`, '#86efac', 16);
  }

  private onDeath(uid: number): void {
    const view = this.views.get(uid);
    const tw = this.moveTweens.get(uid);
    if (tw) tw.stop();
    this.moveTweens.delete(uid);
    if (!view) return;
    this.tweens.add({
      targets: view.container,
      alpha: 0,
      scaleX: 0.2,
      scaleY: 0.2,
      angle: 90,
      duration: 280,
      ease: 'Quad.easeIn',
      onComplete: () => {
        view.container.destroy();
      },
    });
    this.views.delete(uid);
  }

  // ---------------- Визуальные эффекты ----------------

  private spawnProjectile(
    from: { x: number; y: number },
    to: { x: number; y: number },
    color: number,
  ): void {
    const dot = this.add
      .circle(from.x, from.y, 5, color)
      .setDepth(25)
      .setStrokeStyle(1, 0xffffff, 0.6);
    this.tweens.add({
      targets: dot,
      x: to.x,
      y: to.y,
      duration: 130,
      ease: 'Quad.easeIn',
      onComplete: () => dot.destroy(),
    });
  }

  private lunge(uid: number, from: { x: number; y: number }, to: { x: number; y: number }): void {
    const view = this.views.get(uid);
    if (!view) return;
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const len = Math.hypot(dx, dy) || 1;
    const k = 14 / len;
    const tw = this.moveTweens.get(uid);
    if (tw) tw.stop();
    this.tweens.add({
      targets: view.container,
      x: from.x + dx * k,
      y: from.y + dy * k,
      duration: 70,
      yoyo: true,
      ease: 'Quad.easeOut',
    });
  }

  private flash(pos: { x: number; y: number }, color: number): void {
    const ring = this.add
      .circle(pos.x, pos.y, 18, color, 0.85)
      .setDepth(24);
    this.tweens.add({
      targets: ring,
      alpha: 0,
      scale: 1.7,
      duration: 220,
      ease: 'Quad.easeOut',
      onComplete: () => ring.destroy(),
    });
  }

  private floatText(pos: { x: number; y: number }, text: string, color: string, size: number): void {
    const label = this.add
      .text(pos.x, pos.y, text, {
        fontFamily: 'Arial, sans-serif',
        fontSize: `${size}px`,
        color,
        fontStyle: 'bold',
        stroke: '#000000',
        strokeThickness: 3,
      })
      .setOrigin(0.5)
      .setDepth(40);
    this.tweens.add({
      targets: label,
      y: pos.y - 26,
      alpha: 0,
      duration: 720,
      ease: 'Quad.easeOut',
      onComplete: () => label.destroy(),
    });
  }

  // ---------------- Синхронизация с моделью ----------------

  private syncVisuals(): void {
    for (const u of this.combat.units) {
      const view = this.views.get(u.uid);
      if (!view) continue;
      setHpRatio(view, u.hp / u.maxHp);
      setStateText(view, u.state);
    }
  }

  private updateHud(): void {
    const player = this.combat.aliveCount('player');
    const enemy = this.combat.aliveCount('enemy');
    this.hudText.setText(
      [
        `Тик: ${this.combat.tickNumber}`,
        `Синие (игрок): ${player}`,
        `Красные (враг):  ${enemy}`,
      ].join('\n'),
    );
  }

  // ---------------- Наведение / тултип ----------------

  private updateHover(pointer: Phaser.Input.Pointer): void {
    // Подсветка гекса.
    const cell = this.grid.cellAtPixel(pointer.x, pointer.y);
    this.hoverGfx.clear();
    if (cell) {
      const p = this.grid.pixelOf(cell.col, cell.row);
      const poly = hexPolygon(p.x, p.y, this.grid.size * 0.96);
      this.hoverGfx.lineStyle(3, 0xffffff, 0.7);
      this.hoverGfx.strokePoints(poly.points, true);
    }

    // Тултип по наведению на юнита.
    let hit: UnitModel | null = null;
    let bestD = Infinity;
    for (const u of this.combat.units) {
      if (!u.alive) continue;
      const view = this.views.get(u.uid);
      if (!view) continue;
      const d = Phaser.Math.Distance.Between(
        pointer.x,
        pointer.y,
        view.container.x,
        view.container.y,
      );
      if (d <= view.radius * 1.6 && d < bestD) {
        bestD = d;
        hit = u;
      }
    }
    if (hit) this.showTooltip(hit, pointer);
    else this.tooltipBox.setVisible(false);
  }

  private buildTooltip(): void {
    const bg = this.add.rectangle(0, 0, 210, 92, 0x0b0e14, 0.92).setStrokeStyle(1, COLORS.panelEdge);
    this.tooltipText = this.add
      .text(-96, -40, '', {
        fontFamily: 'Consolas, monospace',
        fontSize: '12px',
        color: '#e5e7eb',
      })
      .setLineSpacing(3);
    this.tooltipBox = this.add.container(0, 0, [bg, this.tooltipText]).setDepth(60).setVisible(false);
  }

  private showTooltip(u: UnitModel, pointer: Phaser.Input.Pointer): void {
    const role = ROLE_INFO[u.role].label;
    const state = stateRu(u.state);
    const cell = this.grid.get(u.col, u.row);
    const terrain = cell ? TERRAIN_LABEL[cell.terrain] : '?';
    this.tooltipText.setText(
      [
        `${u.name}`,
        `роль: ${role}`,
        `состояние: ${state}`,
        `HP: ${Math.ceil(u.hp)}/${u.maxHp}`,
        `рельеф: ${terrain}`,
      ].join('\n'),
    );
    let x = pointer.x + 18;
    let y = pointer.y + 14;
    if (x > this.scale.width - 220) x = pointer.x - 222;
    if (y > this.scale.height - 100) y = pointer.y - 100;
    this.tooltipBox.setPosition(x, y).setVisible(true);
  }

  // ---------------- Экран результата ----------------

  private buildResultOverlay(): void {
    const bg = this.add
      .rectangle(0, 0, this.scale.width, this.scale.height, 0x000000, 0.65)
      .setOrigin(0)
      .setInteractive();

    const panel = this.add
      .rectangle(0, 0, 460, 240, COLORS.panel, 1)
      .setStrokeStyle(3, COLORS.panelEdge);

    const title = this.add
      .text(0, -60, '', { fontFamily: 'Arial, sans-serif', fontSize: '44px', fontStyle: 'bold' })
      .setOrigin(0.5)
      .setName('title');

    const sub = this.add
      .text(0, -10, 'Бой завершён', {
        fontFamily: 'Arial, sans-serif',
        fontSize: '16px',
        color: '#9aa3b2',
      })
      .setOrigin(0.5);

    const btn = this.makeRestartButton();

    this.resultOverlay = this.add
      .container(0, 0, [bg, panel, title, sub, btn])
      .setDepth(100)
      .setVisible(false)
      .setPosition(this.scale.width / 2, this.scale.height / 2);
  }

  private makeRestartButton(): Phaser.GameObjects.Container {
    const w = 220;
    const h = 50;
    const bg = this.add.rectangle(0, 60, w, h, 0x1f6feb).setStrokeStyle(2, COLORS.panelEdge);
    const label = this.add
      .text(0, 60, '↻  Заново', {
        fontFamily: 'Arial, sans-serif',
        fontSize: '18px',
        color: '#ffffff',
        fontStyle: 'bold',
      })
      .setOrigin(0.5);
    bg.setInteractive(new Phaser.Geom.Rectangle(-w / 2, 60 - h / 2, w, h), Phaser.Geom.Rectangle.Contains);
    bg.on('pointerover', () => bg.setFillStyle(0x34528f));
    bg.on('pointerout', () => bg.setFillStyle(0x1f6feb));
    bg.on('pointerup', () => this.scene.start('Deployment'));
    return this.add.container(0, 0, [bg, label]);
  }

  private showResult(): void {
    this.resultShown = true;
    const win = this.combat.result === 'player_win';
    const title = this.resultOverlay.getByName('title') as Phaser.GameObjects.Text;
    title.setText(win ? 'ПОБЕДА' : 'ПОРАЖЕНИЕ');
    title.setColor(win ? '#22c55e' : '#ef4444');
    this.tweens.add({
      targets: this.resultOverlay,
      alpha: { from: 0, to: 1 },
      duration: 350,
      onStart: () => this.resultOverlay.setVisible(true),
    });
  }
}

// ---------------- утилиты ----------------

function buildTemplateIndex(): Record<string, UnitTemplate> {
  const idx: Record<string, UnitTemplate> = {};
  for (const u of STONE_AGE_UNITS) idx[u.id] = u;
  return idx;
}

function stateRu(s: UnitState): string {
  switch (s) {
    case 'IDLE':
      return 'ожидание';
    case 'ENGAGE':
      return 'сближение';
    case 'ATTACK':
      return 'атака';
    case 'CHASE':
      return 'погоня';
    case 'REPOSITION':
      return 'перепозиция';
    case 'RETREAT':
      return 'отступление';
    case 'DEAD':
      return 'пал';
    default:
      return s;
  }
}
