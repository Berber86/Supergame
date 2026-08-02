import { CONFIG } from '../config';
import { TERRAIN_MODIFIERS, type Terrain } from '../data/terrain';
import type { UnitModel } from '../entities/UnitModel';
import type { Role } from '../entities/types';
import type { HexCell } from './HexGrid';
import { findPath } from './Pathfinding';
import type { ControllerContext } from './sim-types';
import { SpecialAbilitySystem } from './SpecialAbilitySystem';

const RETREAT_ROLES: ReadonlySet<Role> = new Set<Role>(['ranged', 'melee']);

/** FSM одного юнита, расширенный подключаемым состоянием ABILITY/STUNNED. */
export class UnitController {
  constructor(
    readonly unit: UnitModel,
    private readonly abilities: SpecialAbilitySystem = new SpecialAbilitySystem(),
  ) {}

  update(dt: number, ctx: ControllerContext): void {
    const unit = this.unit;
    if (!this.abilities.tickUnit(unit, dt, ctx)) return;

    unit.attackCooldown = Math.max(0, unit.attackCooldown - dt);
    unit.moveCooldown = Math.max(0, unit.moveCooldown - dt);
    unit.healCooldown = Math.max(0, unit.healCooldown - dt);

    if (unit.stunnedFor > 0) {
      this.setState(unit, 'STUNNED', ctx);
      return;
    }

    if (this.abilities.tryActivate(unit, ctx)) {
      if (unit.alive) this.setState(unit, 'ABILITY', ctx);
      return;
    }

    if (unit.role === 'support') this.updateSupport(ctx);
    else this.updateCombat(ctx);
  }

  private updateCombat(ctx: ControllerContext): void {
    const unit = this.unit;
    const target = this.nearest(ctx.enemiesOf(unit), unit, ctx);
    unit.targetId = target?.uid ?? null;
    if (!target) {
      this.setState(unit, 'IDLE', ctx);
      return;
    }

    const distance = ctx.grid.distance(unit.col, unit.row, target.col, target.row);
    const range = this.effectiveRange(unit, ctx);

    if (
      RETREAT_ROLES.has(unit.role) &&
      (ctx.elapsedSeconds ?? 0) < CONFIG.OVERTIME_START_SECONDS &&
      unit.hp / unit.maxHp <= CONFIG.RETREAT_HP_RATIO
    ) {
      this.setState(unit, 'RETREAT', ctx);
      if (this.moveAway(unit, target, ctx)) return;
    }

    if (distance <= range) {
      if (
        CONFIG.RANGED_KITE_ADJACENT &&
        (ctx.elapsedSeconds ?? 0) < CONFIG.OVERTIME_START_SECONDS &&
        unit.role === 'ranged' &&
        !unit.immobile &&
        distance <= 1
      ) {
        this.setState(unit, 'REPOSITION', ctx);
        if (this.moveAway(unit, target, ctx)) return;
      }
      this.setState(unit, 'ATTACK', ctx);
      this.tryAttack(unit, target, ctx);
      return;
    }

    if (unit.immobile) {
      this.setState(unit, 'IDLE', ctx);
      return;
    }
    this.setState(unit, unit.role === 'cavalry' ? 'CHASE' : 'ENGAGE', ctx);
    this.moveToward(unit, target, ctx);
  }

  private updateSupport(ctx: ControllerContext): void {
    const unit = this.unit;
    const enemies = ctx.enemiesOf(unit);
    const nearestEnemy = enemies.length ? this.nearest(enemies, unit, ctx) : null;
    const enemyDistance = nearestEnemy
      ? ctx.grid.distance(unit.col, unit.row, nearestEnemy.col, nearestEnemy.row)
      : Infinity;

    if (
      nearestEnemy &&
      (ctx.elapsedSeconds ?? 0) < CONFIG.OVERTIME_START_SECONDS &&
      enemyDistance <= CONFIG.SUPPORT_SAFE_DISTANCE
    ) {
      this.setState(unit, 'REPOSITION', ctx);
      unit.targetId = nearestEnemy.uid;
      if (this.moveAway(unit, nearestEnemy, ctx)) return;
    }

    const combatAllies = ctx.alliesOf(unit).filter(
      (ally) => ally.combatRole !== 'support-heal' && ally.combatRole !== 'support-buff',
    );

    if (unit.combatRole === 'support-buff') {
      const candidate = combatAllies
        .filter((ally) => ally.inspiredFor <= 0.25)
        .sort((a, b) => {
          const da = ctx.grid.distance(unit.col, unit.row, a.col, a.row);
          const db = ctx.grid.distance(unit.col, unit.row, b.col, b.row);
          return da - db || a.uid - b.uid;
        })[0];
      if (candidate) {
        unit.targetId = candidate.uid;
        this.setState(unit, 'IDLE', ctx);
        if (unit.healCooldown <= 0) {
          unit.healCooldown = CONFIG.HEAL_INTERVAL;
          candidate.inspiredFor = CONFIG.SUPPORT_BUFF_DURATION;
          candidate.inspiredMultiplier = Math.max(
            candidate.inspiredMultiplier,
            CONFIG.SUPPORT_BUFF_MULT,
          );
          ctx.emit({
            type: 'buff',
            source: unit.uid,
            target: candidate.uid,
            multiplier: CONFIG.SUPPORT_BUFF_MULT,
          });
        }
        return;
      }
    } else {
      const wounded = combatAllies.filter((ally) => ally.hp < ally.maxHp);
      const patient = wounded.length ? this.nearest(wounded, unit, ctx) : null;
      if (patient) {
        unit.targetId = patient.uid;
        this.setState(unit, 'IDLE', ctx);
        if (unit.healCooldown <= 0) {
          unit.healCooldown = CONFIG.HEAL_INTERVAL;
          const before = patient.hp;
          const baseHeal = Math.max(
            CONFIG.HEAL_AMOUNT,
            Math.round(patient.maxHp * CONFIG.SUPPORT_HEAL_HP_RATIO),
          );
          const healFatigue = Math.max(
            CONFIG.OVERTIME_HEAL_MIN_MULT,
            1 - Math.max(0, (ctx.elapsedSeconds ?? 0) - CONFIG.OVERTIME_START_SECONDS) /
              CONFIG.OVERTIME_HEAL_DECAY_SECONDS,
          );
          const heal = Math.max(1, Math.round(baseHeal * healFatigue));
          patient.hp = Math.min(patient.maxHp, patient.hp + heal);
          ctx.emit({
            type: 'heal',
            healer: unit.uid,
            target: patient.uid,
            amount: patient.hp - before,
          });
        }
        return;
      }
    }

    // Если прикрывать/лечить уже некого, support обязан вступить в бой — это
    // исключает бесконечный финал «лекарь против лекаря».
    if (enemies.length) {
      this.updateCombat(ctx);
      return;
    }
    unit.targetId = null;
    this.setState(unit, 'IDLE', ctx);
  }

  private tryAttack(unit: UnitModel, target: UnitModel, ctx: ControllerContext): void {
    if (unit.attackCooldown > 0 || !target.alive) return;
    const attackSpeed = Math.max(
      0.1,
      unit.baseAtkSpeed * unit.suppressionMultiplier * unit.inspiredMultiplier,
    );
    unit.attackCooldown = 1 / attackSpeed;
    const ranged = unit.baseRange > 1;

    if (!ctx.rng.chance(CONFIG.HIT_CHANCE)) {
      ctx.emit({
        type: 'attack', attacker: unit.uid, target: target.uid,
        ranged, damage: 0, crit: false, miss: true,
      });
      return;
    }

    const crit = ctx.rng.chance(CONFIG.CRIT_CHANCE);
    const defense = this.effectiveDef(target, ctx);
    let damage = Math.max(1, unit.baseAtk * unit.inspiredMultiplier - defense);
    if (ranged) {
      damage *= TERRAIN_MODIFIERS[this.terrainAt(unit, ctx)].rangedDamageMultiplier;
    }
    if (crit) damage *= CONFIG.CRIT_MULT;
    const overtimeSteps = Math.max(
      0,
      ((ctx.elapsedSeconds ?? 0) - CONFIG.OVERTIME_START_SECONDS) / 30,
    );
    const overtimeMultiplier = Math.min(
      CONFIG.OVERTIME_DAMAGE_MAX_MULT,
      1 + overtimeSteps * CONFIG.OVERTIME_DAMAGE_PER_30_SECONDS,
    );
    damage *= overtimeMultiplier;
    damage = Math.max(1, Math.round(damage));
    damage = this.abilities.modifyBasicDamage(unit, target, damage, ctx);

    const dealt = this.abilities.applyDamage(unit, target, damage, ctx);
    ctx.emit({
      type: 'attack', attacker: unit.uid, target: target.uid,
      ranged, damage: dealt.total, crit, miss: false,
    });

    if (unit.combatRole === 'aoe-breaker' && dealt.total > 0) {
      this.splash(unit, target, dealt.total, ctx);
    }
  }

  private splash(
    attacker: UnitModel,
    primary: UnitModel,
    primaryDamage: number,
    ctx: ControllerContext,
  ): void {
    const splashDamage = Math.max(1, Math.round(primaryDamage * CONFIG.HEAVY_SPLASH_RATIO));
    const secondary = ctx.enemiesOf(attacker)
      .filter((enemy) =>
        enemy.uid !== primary.uid &&
        ctx.grid.distance(primary.col, primary.row, enemy.col, enemy.row) <= 1,
      )
      .sort((a, b) => a.uid - b.uid);
    for (const target of secondary) {
      const dealt = this.abilities.applyDamage(attacker, target, splashDamage, ctx);
      ctx.emit({
        type: 'attack', attacker: attacker.uid, target: target.uid,
        ranged: attacker.baseRange > 1, damage: dealt.total,
        crit: false, miss: false, splash: true,
      });
    }
  }

  private moveToward(unit: UnitModel, target: UnitModel, ctx: ControllerContext): void {
    if (unit.moveCooldown > 0 || unit.immobile) return;
    const path = findPath(ctx.grid, unit.col, unit.row, target.col, target.row);
    if (path && path.length >= 2) {
      const next = path[1];
      const targetCell = next.col === target.col && next.row === target.row;
      if (this.isFree(next) && !targetCell) {
        this.stepTo(unit, next.col, next.row, ctx);
        return;
      }
    }
    const neighbor = this.bestNeighborToward(unit, target, ctx);
    if (neighbor) this.stepTo(unit, neighbor.col, neighbor.row, ctx);
  }

  private moveAway(unit: UnitModel, reference: UnitModel, ctx: ControllerContext): boolean {
    if (unit.moveCooldown > 0 || unit.immobile) return false;
    const candidates = ctx.grid.neighbors(unit.col, unit.row).filter((cell) => this.isFree(cell));
    if (!candidates.length) return false;

    const ownSideScore = (cell: HexCell) => unit.team === 'player' ? -cell.col : cell.col;
    let best: HexCell | null = null;
    let bestScore = -Infinity;
    for (const cell of candidates) {
      const distance = ctx.grid.distance(cell.col, cell.row, reference.col, reference.row);
      const terrain = cell.terrain === 'hill' && unit.role === 'ranged' ? 0.5 : 0;
      const score = distance + ownSideScore(cell) * 0.4 + terrain;
      if (score > bestScore) {
        bestScore = score;
        best = cell;
      }
    }
    if (!best) return false;
    this.stepTo(unit, best.col, best.row, ctx);
    return true;
  }

  private bestNeighborToward(
    unit: UnitModel,
    target: UnitModel,
    ctx: ControllerContext,
  ): HexCell | null {
    const candidates = ctx.grid.neighbors(unit.col, unit.row).filter(
      (cell) => this.isFree(cell) && !(cell.col === target.col && cell.row === target.row),
    );
    let best: HexCell | null = null;
    let bestDistance = Infinity;
    for (const cell of candidates) {
      const distance = ctx.grid.distance(cell.col, cell.row, target.col, target.row);
      if (distance < bestDistance) {
        bestDistance = distance;
        best = cell;
      }
    }
    return best;
  }

  private stepTo(unit: UnitModel, col: number, row: number, ctx: ControllerContext): void {
    const fromCol = unit.col;
    const fromRow = unit.row;
    const oldCell = ctx.grid.get(fromCol, fromRow);
    if (oldCell?.unit === unit) oldCell.unit = null;
    unit.col = col;
    unit.row = row;
    const newCell = ctx.grid.get(col, row);
    if (newCell) newCell.unit = unit;
    unit.moveCooldown = this.moveInterval(unit, ctx);
    ctx.emit({ type: 'move', uid: unit.uid, fromCol, fromRow, toCol: col, toRow: row });
    this.abilities.onUnitMoved(unit, ctx);
  }

  private nearest(
    list: UnitModel[],
    origin: UnitModel,
    ctx: ControllerContext,
  ): UnitModel | null {
    let best: UnitModel | null = null;
    let bestDistance = Infinity;
    for (const candidate of list) {
      const distance = ctx.grid.distance(origin.col, origin.row, candidate.col, candidate.row);
      if (distance < bestDistance || (distance === bestDistance && (!best || candidate.uid < best.uid))) {
        bestDistance = distance;
        best = candidate;
      }
    }
    return best;
  }

  private setState(unit: UnitModel, state: UnitModel['state'], ctx: ControllerContext): void {
    if (unit.state === state) return;
    unit.state = state;
    ctx.emit({ type: 'state', uid: unit.uid, state });
  }

  private isFree(cell: HexCell): boolean {
    return !cell.blocked && !cell.unit;
  }

  private terrainAt(unit: UnitModel, ctx: ControllerContext): Terrain {
    return ctx.grid.get(unit.col, unit.row)?.terrain ?? 'plain';
  }

  private effectiveRange(unit: UnitModel, ctx: ControllerContext): number {
    if (unit.baseRange <= 1) return unit.baseRange;
    return unit.baseRange + TERRAIN_MODIFIERS[this.terrainAt(unit, ctx)].rangedRangeBonus;
  }

  private effectiveDef(unit: UnitModel, ctx: ControllerContext): number {
    return unit.baseDef + TERRAIN_MODIFIERS[this.terrainAt(unit, ctx)].defenseBonus;
  }

  private moveInterval(unit: UnitModel, ctx: ControllerContext): number {
    const modifier = TERRAIN_MODIFIERS[this.terrainAt(unit, ctx)];
    const speed = Math.max(0.1, unit.baseMove * modifier.moveMultiplier);
    return 1 / speed;
  }
}
