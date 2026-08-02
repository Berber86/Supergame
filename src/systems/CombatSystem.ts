import { CONFIG } from '../config';
import type { UnitTemplate } from '../data/units';
import { UnitModel } from '../entities/UnitModel';
import type { Team } from '../entities/types';
import type { HexGrid } from './HexGrid';
import { RNG } from './RNG';
import type { ControllerContext, SimEvent } from './sim-types';
import { UnitController } from './UnitController';

export type SimResult = 'ongoing' | 'player_win' | 'enemy_win';

/** Развёрнутая расстановка юнита. */
export interface DeploymentEntry {
  templateId: string;
  col: number;
  row: number;
}

/**
 * Сердце боевой системы: тиковая симуляция, детерминированный ГСЧ, проверка
 * победы и протокол событий для рендера. Полностью отделена от Phaser.
 *
 * Сценарий использования:
 *   const sim = new CombatSystem(grid, SEED);
 *   sim.addUnit(template, 'player', col, row); // расстановка
 *   sim.start();
 *   // каждый кадр: sim.update(dt); визуализировать sim.events;
 */
export class CombatSystem {
  readonly grid: HexGrid;
  readonly units: UnitModel[] = [];
  readonly rng: RNG;
  readonly seed: number;
  readonly tickInterval: number;

  tickNumber = 0;
  result: SimResult = 'ongoing';
  /** События, накопленные с последнего update() — рендер их "вычитывает". */
  events: SimEvent[] = [];
  running = false;

  private readonly controllers: UnitController[] = [];
  private accumulator = 0;
  private uidCounter = 1;

  constructor(grid: HexGrid, seed: number = CONFIG.SEED) {
    this.grid = grid;
    this.seed = seed;
    this.rng = new RNG(seed);
    this.tickInterval = 1 / CONFIG.TICK_HZ;
  }

  addUnit(
    template: UnitTemplate,
    team: Team,
    col: number,
    row: number,
    initialHp?: number,
  ): UnitModel {
    const unit = new UnitModel(this.uidCounter++, template, team, col, row);
    if (typeof initialHp === 'number') {
      unit.hp = Math.max(1, Math.min(unit.maxHp, Math.round(initialHp)));
    }
    const cell = this.grid.get(col, row);
    if (cell) cell.unit = unit;
    this.units.push(unit);
    this.controllers.push(new UnitController(unit));
    return unit;
  }

  /** Пакетное добавление (для врагов и стартовой расстановки). */
  addUnits(
    entries: ReadonlyArray<DeploymentEntry>,
    templates: Record<string, UnitTemplate>,
    team: Team,
  ): void {
    for (const e of entries) {
      const tpl = templates[e.templateId] ?? null;
      if (!tpl) continue;
      this.addUnit(tpl, team, e.col, e.row);
    }
  }

  start(): void {
    this.running = true;
  }

  /** Продвинуть симуляцию на dt секунд (фиксированный шаг). */
  update(dt: number): void {
    if (!this.running || this.result !== 'ongoing') return;
    this.events.length = 0;
    this.accumulator += dt;
    let guard = 0;
    while (
      this.accumulator >= this.tickInterval &&
      guard++ < CONFIG.MAX_TICKS_PER_FRAME
    ) {
      this.accumulator -= this.tickInterval;
      this.tick();
      if (this.result !== 'ongoing') break;
    }
  }

  aliveCount(team: Team): number {
    let n = 0;
    for (const u of this.units) if (u.alive && u.team === team) n++;
    return n;
  }

  // --- внутреннее ---

  private makeContext(): ControllerContext {
    const units = this.units;
    return {
      grid: this.grid,
      rng: this.rng,
      alliesOf: (u) =>
        units.filter((x) => x.alive && x.team === u.team && x !== u),
      enemiesOf: (u) => units.filter((x) => x.alive && x.team !== u.team),
      unitById: (uid) => units.find((x) => x.uid === uid) ?? null,
      emit: (event) => {
        this.events.push(event);
      },
    };
  }

  private tick(): void {
    this.tickNumber++;
    const ctx = this.makeContext();
    // Детерминированный порядок обработки => детерминированный расход ГСЧ.
    for (const c of this.controllers) {
      if (c.unit.alive) c.update(this.tickInterval, ctx);
    }
    this.checkVictory();
  }

  private checkVictory(): void {
    let playerAlive = false;
    let enemyAlive = false;
    for (const u of this.units) {
      if (!u.alive) continue;
      if (u.team === 'player') playerAlive = true;
      else enemyAlive = true;
    }
    if (!enemyAlive) this.result = 'player_win';
    else if (!playerAlive) this.result = 'enemy_win';
  }
}
