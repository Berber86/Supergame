import Phaser from 'phaser';
import { CONFIG } from '../config';
import { ROLE_INFO } from '../data/units';
import { findNode, getEvolutionThreshold } from '../data/evolution-tree';
import { SPECIAL_ABILITY_NAMES } from '../data/special-abilities';
import { TERRAIN_LABEL } from '../data/terrain';
import { generateWave, isEliteWave } from '../data/waves';
import { buildTerrainMap, terrainSeedForWave, terrainSourceFromMap } from '../data/boardLayout';
import {
  Campaign,
  type PlayerDeploymentEntry,
  type UnitBattleReport,
} from '../meta/Campaign';
import { rosterToTemplate } from '../meta/RosterUnit';
import { campaignOf } from '../meta/session';
import { CombatSystem } from '../systems/CombatSystem';
import { abilityColor } from '../systems/SpecialAbilitySystem';
import type { SimEvent } from '../systems/sim-types';
import { HexGrid } from '../systems/HexGrid';
import type { UnitModel } from '../entities/UnitModel';
import type { UnitState } from '../entities/types';
import { COLORS, TEAM_COLORS } from '../ui/theme';
import { createUnitView, setHpRatio, setStateText, type UnitView } from '../ui/UnitView';
import { drawTerrainLayer, drawZoneOverlay, hexPolygon } from '../ui/board';
import { computeOrigin } from './DeploymentScene';
import { makeButton } from '../ui/widgets';

const GRID_CENTER_X = 640;
const GRID_CENTER_Y = 392;

/**
 * Сцена боя: ТОЛЬКО отрисовка/ввод + фиксация исхода для мета-слоя.
 * Логика боя — в CombatSystem; последствия (доход, опыт, HP, волна) пишутся в
 * Campaign после завершения, затем сцена возвращает игрока в хаб (победа) или
 * на повтор выбора состава (поражение).
 */
export class BattleScene extends Phaser.Scene {
  private grid!: HexGrid;
  private combat!: CombatSystem;
  private campaign!: Campaign;

  private views = new Map<number, UnitView>();
  private units = new Map<number, UnitModel>();
  private uidToRoster = new Map<number, string>();
  private moveTweens = new Map<number, Phaser.Tweens.Tween>();

  private hoverGfx!: Phaser.GameObjects.Graphics;
  private hudText!: Phaser.GameObjects.Text;
  private resultShown = false;

  private tooltipBox!: Phaser.GameObjects.Container;
  private tooltipText!: Phaser.GameObjects.Text;

  constructor() {
    super('Battle');
  }

  create(): void {
    this.cameras.main.setBackgroundColor(COLORS.bg);
    this.resultShown = false;
    this.campaign = campaignOf(this.game.registry);

    const { originX, originY } = computeOrigin(
      CONFIG.GRID_COLS,
      CONFIG.GRID_ROWS,
      CONFIG.HEX_SIZE,
      GRID_CENTER_X,
      GRID_CENTER_Y,
    );
    const terrainMap = buildTerrainMap(
      CONFIG.GRID_COLS,
      CONFIG.GRID_ROWS,
      terrainSeedForWave(this.campaign.wave),
    );
    this.grid = new HexGrid(
      CONFIG.GRID_COLS,
      CONFIG.GRID_ROWS,
      originX,
      originY,
      terrainSourceFromMap(terrainMap),
    );

    const terrainGfx = this.add.graphics().setDepth(0);
    const zoneGfx = this.add.graphics().setDepth(1);
    drawTerrainLayer(terrainGfx, this.grid);
    drawZoneOverlay(zoneGfx, this.grid);
    this.hoverGfx = this.add.graphics().setDepth(5);

    // --- Симуляция ---
    this.combat = new CombatSystem(this.grid, CONFIG.SEED);

    const deployment =
      (this.game.registry.get('playerDeployment') as PlayerDeploymentEntry[] | null) ?? [];
    for (const e of deployment) {
      const ru = this.campaign.get(e.rosterId);
      if (!ru || ru.currentHp <= 0) continue;
      const unit = this.combat.addUnit(
        rosterToTemplate(ru),
        'player',
        e.col,
        e.row,
        ru.currentHp,
      );
      this.uidToRoster.set(unit.uid, ru.id);
    }

    for (const we of generateWave(
      this.campaign.worldEpochScore(),
      this.campaign.wave,
      terrainMap,
    )) {
      this.combat.addUnit(we.scaled, 'enemy', we.col, we.row);
    }

    for (const u of this.combat.units) this.spawnView(u);
    this.combat.start();

    // --- HUD ---
    this.add
      .text(
        this.scale.width / 2,
        28,
        `THE LONG LINE — Волна ${this.campaign.wave}${isEliteWave(this.campaign.wave) ? ' • ЭЛИТА' : ''}`,
        {
          fontFamily: 'Arial, sans-serif',
          fontSize: '24px',
          color: '#e5e7eb',
          fontStyle: 'bold',
        },
      )
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

    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => this.updateHover(pointer));
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
    if (!this.resultShown && this.combat.result !== 'ongoing') this.showResult();
  }

  // ---------------- Создание представлений ----------------

  private spawnView(u: UnitModel): void {
    const node = findNode(u.id);
    const view = createUnitView(this, {
      name: u.name,
      role: u.role,
      team: u.team,
      showState: true,
      epochIndex: node ? node.epoch : u.epochIndex,
      line: node ? node.line : u.immobile ? 'Siege' : 'Infantry',
    });
    const p = this.grid.pixelOf(u.col, u.row);
    view.container.setPosition(p.x, p.y);
    setHpRatio(view, u.hp / u.maxHp);
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
      case 'buff':
        this.onBuff(e);
        break;
      case 'ability':
        this.onAbility(e);
        break;
      case 'death':
        this.onDeath(e.uid);
        break;
      case 'state':
        break;
    }
  }

  private onMove(uid: number, col: number, row: number): void {
    const view = this.views.get(uid);
    if (!view) return;
    const prev = this.moveTweens.get(uid);
    if (prev) prev.stop();
    const p = this.grid.pixelOf(col, row);
    this.moveTweens.set(
      uid,
      this.tweens.add({
        targets: view.container,
        x: p.x,
        y: p.y,
        duration: 170,
        ease: 'Quad.easeInOut',
      }),
    );
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

  private onBuff(e: Extract<SimEvent, { type: 'buff' }>): void {
    const target = this.units.get(e.target);
    if (!target) return;
    const pos = this.grid.pixelOf(target.col, target.row);
    this.flash(pos, 0xa3e635);
    this.floatText({ x: pos.x, y: pos.y - 14 }, 'вдохновение', '#bef264', 13);
  }

  private onAbility(e: Extract<SimEvent, { type: 'ability' }>): void {
    if (e.summoned !== undefined) {
      const summoned = this.combat.units.find((unit) => unit.uid === e.summoned);
      if (summoned && !this.units.has(summoned.uid)) this.spawnView(summoned);
    }
    const target = e.targets.length ? this.units.get(e.targets[0]) : null;
    const caster = this.units.get(e.caster);
    const pos = target
      ? this.grid.pixelOf(target.col, target.row)
      : e.col !== undefined && e.row !== undefined
      ? this.grid.pixelOf(e.col, e.row)
      : caster
      ? this.grid.pixelOf(caster.col, caster.row)
      : null;
    if (!pos) return;
    this.flash(pos, abilityColor(e.ability));
    this.floatText(
      { x: pos.x, y: pos.y - 22 },
      SPECIAL_ABILITY_NAMES[e.ability],
      '#fef3c7',
      12,
    );
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
      onComplete: () => view.container.destroy(),
    });
    this.views.delete(uid);
  }

  // ---------------- Визуальные эффекты ----------------

  private spawnProjectile(from: { x: number; y: number }, to: { x: number; y: number }, color: number): void {
    const dot = this.add.circle(from.x, from.y, 5, color).setDepth(25).setStrokeStyle(1, 0xffffff, 0.6);
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
    const ring = this.add.circle(pos.x, pos.y, 18, color, 0.85).setDepth(24);
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

    const driftX = pos.x + Phaser.Math.Between(-18, 18);
    label.setScale(0.5);
    this.tweens.add({
      targets: label,
      x: driftX,
      y: pos.y - 36,
      scaleX: 1.1,
      scaleY: 1.1,
      duration: 180,
      ease: 'Back.easeOut',
      onComplete: () => {
        this.tweens.add({
          targets: label,
          y: pos.y - 54,
          alpha: 0,
          duration: 540,
          ease: 'Linear',
          onComplete: () => label.destroy(),
        });
      }
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
    this.hudText.setText(
      [
        `Волна: ${this.campaign.wave}${isEliteWave(this.campaign.wave) ? ' [ЭЛИТА]' : ''}`,
        `Мировая эпоха: ${this.campaign.worldEpochScore().toFixed(2)}`,
        `Тик: ${this.combat.tickNumber}`,
        `Игрок: ${this.combat.aliveCount('player')}`,
        `Враг:  ${this.combat.aliveCount('enemy')}`,
      ].join('\n'),
    );
  }

  // ---------------- Наведение / тултип ----------------

  private updateHover(pointer: Phaser.Input.Pointer): void {
    const cell = this.grid.cellAtPixel(pointer.x, pointer.y);
    this.hoverGfx.clear();
    if (cell) {
      const p = this.grid.pixelOf(cell.col, cell.row);
      const poly = hexPolygon(p.x, p.y, this.grid.size * 0.96);
      this.hoverGfx.lineStyle(3, 0xffffff, 0.7);
      this.hoverGfx.strokePoints(poly.points, true);
    }

    let hit: UnitModel | null = null;
    let bestD = Infinity;
    for (const u of this.combat.units) {
      if (!u.alive) continue;
      const view = this.views.get(u.uid);
      if (!view) continue;
      const d = Phaser.Math.Distance.Between(pointer.x, pointer.y, view.container.x, view.container.y);
      if (d <= view.radius * 1.6 && d < bestD) {
        bestD = d;
        hit = u;
      }
    }
    if (hit) this.showTooltip(hit, pointer);
    else this.tooltipBox.setVisible(false);
  }

  private buildTooltip(): void {
    const bg = this.add.rectangle(0, 0, 250, 132, 0x0b0e14, 0.92).setStrokeStyle(1, COLORS.panelEdge);
    this.tooltipText = this.add
      .text(-116, -60, '', { fontFamily: 'Consolas, monospace', fontSize: '12px', color: '#e5e7eb' })
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
        u.name,
        `роль: ${role}`,
        `состояние: ${state}`,
        `HP: ${Math.ceil(u.hp)}/${u.maxHp}${u.shieldHp > 0 ? ` +${Math.ceil(u.shieldHp)} щит` : ''}`,
        `рельеф: ${terrain}`,
        `способность: ${u.specialAbility?.name ?? '—'}`,
      ].join('\n'),
    );
    let x = pointer.x + 18;
    let y = pointer.y + 14;
    if (x > this.scale.width - 260) x = pointer.x - 262;
    if (y > this.scale.height - 140) y = pointer.y - 140;
    this.tooltipBox.setPosition(x, y).setVisible(true);
  }

  // ---------------- Исход боя → мета ----------------

  private showResult(): void {
    this.resultShown = true;
    const win = this.combat.result === 'player_win';
    let income = 0;
    const report: UnitBattleReport[] = [];
    const beforeHpMap = new Map<string, number>();
    const beforeXpMap = new Map<string, number>();

    for (const [uid, rosterId] of this.uidToRoster) {
      const ru = this.campaign.get(rosterId);
      if (ru) {
        beforeHpMap.set(rosterId, ru.currentHp);
        beforeXpMap.set(rosterId, ru.battleExperience);
      }
    }

    if (win) {
      for (const [uid, rosterId] of this.uidToRoster) {
        const unit = this.units.get(uid);
        if (!unit) continue;
        report.push({ rosterId, endHp: unit.hp, survived: unit.alive });
      }
      income = this.campaign.applyVictory(report).income;
      this.campaign.save();
    } else {
      this.campaign.applyDefeat();
    }
    this.renderResultOverlay(win, income, beforeHpMap, beforeXpMap, report);
  }

  private renderResultOverlay(
    win: boolean,
    income: number,
    beforeHpMap: Map<string, number>,
    beforeXpMap: Map<string, number>,
    report: UnitBattleReport[]
  ): void {
    const cx = this.scale.width / 2;
    const cy = this.scale.height / 2;
    const overlay = this.add.container(0, 0).setDepth(100).setAlpha(0);

    const dim = this.add.rectangle(0, 0, this.scale.width, this.scale.height, 0x000000, 0.75).setOrigin(0).setInteractive();
    
    const panelW = 680;
    const panelH = 500;
    const panel = this.add.rectangle(cx, cy, panelW, panelH, COLORS.panel).setStrokeStyle(3, COLORS.panelEdge);
    overlay.add([dim, panel]);

    const titleY = cy - panelH / 2 + 50;
    const title = this.add
      .text(cx, titleY, win ? 'ПОБЕДА' : 'ПОРАЖЕНИЕ', {
        fontFamily: 'Arial, sans-serif',
        fontSize: '36px',
        fontStyle: 'bold',
        color: win ? '#22c55e' : '#ef4444',
      })
      .setOrigin(0.5);

    const subY = titleY + 45;
    const sub = this.add
      .text(
        cx,
        subY,
        win ? `Доход за волну: +${income}🪙  |  Волна ${this.campaign.wave - 1} пройдена` : 'Волна не пройдена',
        { fontFamily: 'Arial, sans-serif', fontSize: '15px', color: '#fbbf24', fontStyle: 'bold' }
      )
      .setOrigin(0.5);
      
    overlay.add([title, sub]);

    const listTitle = this.add.text(cx, cy - 110, 'ИТОГИ БОЯ ДЛЯ ЮНИТОВ', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '14px',
      fontStyle: 'bold',
      color: '#9aa3b2',
    }).setOrigin(0.5);
    overlay.add(listTitle);

    const rosterIds = Array.from(this.uidToRoster.values());
    const itemY = cy - 65;
    const colLeftX = cx - 160;
    const colRightX = cx + 160;
    
    rosterIds.forEach((rosterId, idx) => {
      const ru = this.campaign.get(rosterId);
      if (!ru) return;
      
      const colX = idx % 2 === 0 ? colLeftX : colRightX;
      const rowY = itemY + Math.floor(idx / 2) * 64;
      
      const beforeHp = beforeHpMap.get(rosterId) ?? ru.maxHp;
      const endHp = win ? (report.find(r => r.rosterId === rosterId)?.endHp ?? 0) : ru.currentHp;
      const dead = endHp <= 0;
      
      const hpLost = beforeHp - endHp;
      const xpGained = win ? (ru.battleExperience - (beforeXpMap.get(rosterId) ?? 0)) : 0;
      
      const itemBg = this.add.rectangle(colX, rowY, 300, 54, 0x111827).setStrokeStyle(1, 0x334155);
      
      const uName = this.add.text(colX - 138, rowY - 20, ru.name, {
        fontFamily: 'Arial, sans-serif',
        fontSize: '12px',
        fontStyle: 'bold',
        color: '#e5e7eb',
      });
      
      let hpStatusText = '';
      let hpColor = '#34d399';
      if (dead) {
        hpStatusText = win ? 'Сражён ☠ (HP 0)' : 'Сражён ☠ (Восстановлен)';
        hpColor = '#f87171';
      } else if (hpLost > 0) {
        hpStatusText = `Получил урон: -${Math.round(hpLost)} HP (Осталось ${Math.round(endHp)})`;
        hpColor = '#fcd34d';
      } else {
        hpStatusText = `Без повреждений (${Math.round(endHp)} HP)`;
      }
      
      const uHp = this.add.text(colX - 138, rowY - 2, hpStatusText, {
        fontFamily: 'Arial, sans-serif',
        fontSize: '11px',
        color: hpColor,
      });
      
      const threshold = getEvolutionThreshold(ru.epochIndex);
      let xpStatusText = '';
      let xpColor = '#a78bfa';
      
      if (win) {
        if (ru.battleExperience >= threshold) {
          xpStatusText = 'ГОТОВ К ЭВОЛЮЦИИ! ⭐';
          xpColor = '#fbbf24';
        } else {
          xpStatusText = `Опыт: ${ru.battleExperience}/${threshold} (+${xpGained})`;
        }
      } else {
        xpStatusText = `Опыт: ${ru.battleExperience}/${threshold}`;
      }
      
      const uXp = this.add.text(colX - 138, rowY + 11, xpStatusText, {
        fontFamily: 'Consolas, monospace',
        fontSize: '10px',
        color: xpColor,
      });
      
      overlay.add([itemBg, uName, uHp, uXp]);
    });

    const btnY = cy + panelH / 2 - 45;
    if (win) {
      const cont = makeButton(this, cx, btnY, 240, 48, 'Продолжить →', () =>
        this.scene.start('Hub'),
      );
      overlay.add(cont);
    } else {
      const again = makeButton(this, cx - 115, btnY, 200, 48, '↻  Заново', () =>
        this.scene.start('Composition'),
      );
      const hub = makeButton(this, cx + 115, btnY, 200, 48, '←  В хаб', () =>
        this.scene.start('Hub'),
      );
      overlay.add([again, hub]);
    }

    this.tweens.add({ targets: overlay, alpha: 1, duration: 320 });
  }
}

// ---------------- утилиты сцены ----------------

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
    case 'ABILITY':
      return 'способность';
    case 'STUNNED':
      return 'оглушён';
    case 'DEAD':
      return 'пал';
    default:
      return s;
  }
}
