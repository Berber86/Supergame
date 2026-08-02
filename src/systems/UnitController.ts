import { CONFIG } from '../config';
import { TERRAIN_MODIFIERS, type Terrain } from '../data/terrain';
import type { UnitModel } from '../entities/UnitModel';
import type { Role } from '../entities/types';
import type { HexCell } from './HexGrid';
import { findPath } from './Pathfinding';
import type { ControllerContext } from './sim-types';

/** Роли, которые отступают при низком HP (тяжёлые/танки/кавалерия бьются до конца). */
const RETREAT_ROLES: ReadonlySet<Role> = new Set<Role>(['ranged', 'melee']);

/**
 * ИИ-контроллер одного юнита: конечный автомат поведения.
 * IDLE → ENGAGE → ATTACK → CHASE/REPOSITION → RETREAT (+ DEAD).
 *
 * Чистая логика: не знает о Phaser, общается с миром через ControllerContext
 * и сообщает о действиях через ctx.emit(...).
 *
 * Ролевое поведение:
 *  - melee/tank/heavy/cavalry — идут к цели и бьют в ближнем бою;
 *  - ranged — держат дистанцию, кайтят, если враг подошёл вплотную;
 *  - support — держится позади, лечит ближайшего раненого союзника по кулдауну;
 *  - раненые ranged/melee отступают к своему краю.
 */
export class UnitController {
  constructor(readonly unit: UnitModel) {}

  update(dt: number, ctx: ControllerContext): void {
    const u = this.unit;

    // Тик кулдаунов.
    u.attackCooldown = Math.max(0, u.attackCooldown - dt);
    u.moveCooldown = Math.max(0, u.moveCooldown - dt);
    u.healCooldown = Math.max(0, u.healCooldown - dt);

    if (u.role === 'support') {
      this.updateSupport(ctx);
    } else {
      this.updateCombat(ctx);
    }
  }

  // ---------------- Боевые роли ----------------

  private updateCombat(ctx: ControllerContext): void {
    const u = this.unit;
    const target = this.nearest(ctx.enemiesOf(u), u, ctx);
    u.targetId = target ? target.uid : null;
    if (!target) {
      this.setState(u, 'IDLE', ctx);
      return;
    }

    const dist = ctx.grid.distance(u.col, u.row, target.col, target.row);
    const effRange = this.effectiveRange(u, ctx);

    // 1) Отступление тяжело раненных (где уместно).
    if (
      RETREAT_ROLES.has(u.role) &&
      u.hp / u.maxHp <= CONFIG.RETREAT_HP_RATIO
    ) {
      this.setState(u, 'RETREAT', ctx);
      if (this.moveAway(u, target, ctx)) return;
      // Отступать некуда — драться.
    }

    // 2) В пределах дальности атаки.
    if (dist <= effRange) {
      // Ranged кайтит, когда враг вплотную.
      if (CONFIG.RANGED_KITE_ADJACENT && u.role === 'ranged' && dist <= 1) {
        this.setState(u, 'REPOSITION', ctx);
        if (this.moveAway(u, target, ctx)) return; // убежали — в этот тик не стреляем
        // Прижали к стене — стреляем в упор.
      }
      this.setState(u, 'ATTACK', ctx);
      this.tryAttack(u, target, ctx);
      return;
    }

    // 3) Цель далеко — идём к ней.
    this.setState(u, u.role === 'cavalry' ? 'CHASE' : 'ENGAGE', ctx);
    this.moveToward(u, target, ctx);
  }

  private updateSupport(ctx: ControllerContext): void {
    const u = this.unit;
    const enemies = ctx.enemiesOf(u);
    const nearestEnemy = enemies.length ? this.nearest(enemies, u, ctx) : null;
    const enemyDist = nearestEnemy
      ? ctx.grid.distance(u.col, u.row, nearestEnemy.col, nearestEnemy.row)
      : Infinity;

    // Держим дистанцию: если враг близко — отходим.
    if (nearestEnemy && enemyDist <= CONFIG.SUPPORT_SAFE_DISTANCE) {
      this.setState(u, 'REPOSITION', ctx);
      u.targetId = nearestEnemy.uid;
      this.moveAway(u, nearestEnemy, ctx);
      return;
    }

    // Лечим ближайшего раненого союзника.
    const wounded = ctx.alliesOf(u).filter((a) => a.hp < a.maxHp);
    if (wounded.length) {
      const patient = this.nearest(wounded, u, ctx);
      if (patient) {
        u.targetId = patient.uid;
        this.setState(u, 'IDLE', ctx);
        if (u.healCooldown <= 0) {
          u.healCooldown = CONFIG.HEAL_INTERVAL;
          const before = patient.hp;
          patient.hp = Math.min(patient.maxHp, patient.hp + CONFIG.HEAL_AMOUNT);
          ctx.emit({
            type: 'heal',
            healer: u.uid,
            target: patient.uid,
            amount: patient.hp - before,
          });
        }
        return;
      }
    }

    u.targetId = null;
    this.setState(u, 'IDLE', ctx);
  }

  // ---------------- Атака ----------------

  private tryAttack(
    u: UnitModel,
    target: UnitModel,
    ctx: ControllerContext,
  ): void {
    if (u.attackCooldown > 0) return;
    u.attackCooldown = 1 / u.baseAtkSpeed;

    const rng = ctx.rng;
    const ranged = u.baseRange > 1;

    // Промах.
    if (!rng.chance(CONFIG.HIT_CHANCE)) {
      ctx.emit({
        type: 'attack',
        attacker: u.uid,
        target: target.uid,
        ranged,
        damage: 0,
        crit: false,
        miss: true,
      });
      return;
    }

    const crit = rng.chance(CONFIG.CRIT_CHANCE);
    const def = this.effectiveDef(target, ctx);
    let dmg = Math.max(1, u.baseAtk - def);

    // Стрелок на холме получает бонус урона.
    if (ranged) {
      const mod = TERRAIN_MODIFIERS[this.terrainAt(u, ctx)];
      dmg *= mod.rangedDamageMultiplier;
    }
    if (crit) dmg *= CONFIG.CRIT_MULT;
    dmg = Math.max(1, Math.round(dmg));

    target.hp -= dmg;
    ctx.emit({
      type: 'attack',
      attacker: u.uid,
      target: target.uid,
      ranged,
      damage: dmg,
      crit,
      miss: false,
    });

    if (target.hp <= 0) {
      target.hp = 0;
      this.kill(target, ctx);
    }
  }

  private kill(u: UnitModel, ctx: ControllerContext): void {
    u.alive = false;
    u.state = 'DEAD';
    const cell = ctx.grid.get(u.col, u.row);
    if (cell && cell.unit === u) cell.unit = null;
    ctx.emit({ type: 'death', uid: u.uid });
  }

  // ---------------- Движение ----------------

  /** Шаг к цели по A* (fallback — жадный выбор соседа). */
  private moveToward(u: UnitModel, target: UnitModel, ctx: ControllerContext): void {
    if (u.moveCooldown > 0) return;
    const path = findPath(ctx.grid, u.col, u.row, target.col, target.row);
    if (path && path.length >= 2) {
      const next = path[1];
      const isTargetCell = next.col === target.col && next.row === target.row;
      if (this.isFree(next, ctx) && !isTargetCell) {
        this.stepTo(u, next.col, next.row, ctx);
        return;
      }
    }
    const nb = this.bestNeighborToward(u, target, ctx);
    if (nb) this.stepTo(u, nb.col, nb.row, ctx);
  }

  /** Шаг прочь от опорной точки (кайт/отступление/безопасность support-а). */
  private moveAway(u: UnitModel, ref: UnitModel, ctx: ControllerContext): boolean {
    if (u.moveCooldown > 0) return false;
    const candidates = ctx.grid.neighbors(u.col, u.row).filter((c) =>
      this.isFree(c, ctx),
    );
    if (!candidates.length) return false;

    // Игрок отступает влево, враг — вправо (к своему краю).
    const ownSideScore = (c: HexCell) =>
      u.team === 'player' ? -c.col : c.col;

    let best: HexCell | null = null;
    let bestScore = -Infinity;
    for (const c of candidates) {
      const d = ctx.grid.distance(c.col, c.row, ref.col, ref.row);
      const score = d + ownSideScore(c) * 0.4;
      if (score > bestScore) {
        bestScore = score;
        best = c;
      }
    }
    if (best) {
      this.stepTo(u, best.col, best.row, ctx);
      return true;
    }
    return false;
  }

  private bestNeighborToward(
    u: UnitModel,
    target: UnitModel,
    ctx: ControllerContext,
  ): HexCell | null {
    const nbs = ctx.grid.neighbors(u.col, u.row).filter(
      (c) =>
        this.isFree(c, ctx) &&
        !(c.col === target.col && c.row === target.row),
    );
    let best: HexCell | null = null;
    let bestD = Infinity;
    for (const c of nbs) {
      const d = ctx.grid.distance(c.col, c.row, target.col, target.row);
      if (d < bestD) {
        bestD = d;
        best = c;
      }
    }
    return best;
  }

  private stepTo(
    u: UnitModel,
    col: number,
    row: number,
    ctx: ControllerContext,
  ): void {
    const fromCol = u.col;
    const fromRow = u.row;
    const oldCell = ctx.grid.get(fromCol, fromRow);
    if (oldCell) oldCell.unit = null;
    u.col = col;
    u.row = row;
    const newCell = ctx.grid.get(col, row);
    if (newCell) newCell.unit = u;
    u.moveCooldown = this.moveInterval(u, ctx);
    ctx.emit({
      type: 'move',
      uid: u.uid,
      fromCol,
      fromRow,
      toCol: col,
      toRow: row,
    });
  }

  // ---------------- Утилиты/модификаторы ----------------

  private nearest(
    list: UnitModel[],
    origin: UnitModel,
    ctx: ControllerContext,
  ): UnitModel | null {
    let best: UnitModel | null = null;
    let bestD = Infinity;
    for (const c of list) {
      const d = ctx.grid.distance(origin.col, origin.row, c.col, c.row);
      if (d < bestD || (d === bestD && best && c.uid < best.uid)) {
        bestD = d;
        best = c;
      }
    }
    return best;
  }

  private setState(
    u: UnitModel,
    s: UnitModel['state'],
    ctx: ControllerContext,
  ): void {
    if (u.state !== s) {
      u.state = s;
      ctx.emit({ type: 'state', uid: u.uid, state: s });
    }
  }

  private isFree(cell: HexCell, _ctx: ControllerContext): boolean {
    return !cell.blocked && !cell.unit;
  }

  private terrainAt(u: UnitModel, ctx: ControllerContext): Terrain {
    return ctx.grid.get(u.col, u.row)?.terrain ?? 'plain';
  }

  private effectiveRange(u: UnitModel, ctx: ControllerContext): number {
    if (u.baseRange <= 1) return u.baseRange;
    const mod = TERRAIN_MODIFIERS[this.terrainAt(u, ctx)];
    return u.baseRange + mod.rangedRangeBonus;
  }

  private effectiveDef(u: UnitModel, ctx: ControllerContext): number {
    const mod = TERRAIN_MODIFIERS[this.terrainAt(u, ctx)];
    return u.baseDef + mod.defenseBonus;
  }

  private moveInterval(u: UnitModel, ctx: ControllerContext): number {
    const mod = TERRAIN_MODIFIERS[this.terrainAt(u, ctx)];
    const speed = Math.max(0.1, u.baseMove * mod.moveMultiplier);
    return 1 / speed; // секунд на гекс
  }
}
