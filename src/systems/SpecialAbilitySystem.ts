import { CONFIG } from '../config';
import type { SpecialAbilityDefinition, SpecialAbilityType } from '../data/special-abilities';
import type { UnitTemplate } from '../data/units';
import type { UnitModel } from '../entities/UnitModel';
import { findPath } from './Pathfinding';
import type { ControllerContext } from './sim-types';

interface TrapRecord {
  ownerUid: number;
  team: UnitModel['team'];
  col: number;
  row: number;
  damage: number;
  remaining: number;
}

export interface DamageResult {
  total: number;
  hp: number;
  shield: number;
}

/**
 * Общая подключаемая система восьми эффектов. UnitController лишь спрашивает,
 * можно ли перейти в состояние ABILITY, и вызывает хуки атаки/движения.
 */
export class SpecialAbilitySystem {
  private traps: TrapRecord[] = [];

  beginTick(dt: number): void {
    for (const trap of this.traps) trap.remaining -= dt;
    this.traps = this.traps.filter((trap) => trap.remaining > 0);
  }

  /** Тикает кулдауны/статусы; false означает, что временный призыв исчез. */
  tickUnit(unit: UnitModel, dt: number, ctx: ControllerContext): boolean {
    unit.abilityCooldown = Math.max(0, unit.abilityCooldown - dt);
    unit.stunnedFor = Math.max(0, unit.stunnedFor - dt);

    unit.suppressedFor = Math.max(0, unit.suppressedFor - dt);
    if (unit.suppressedFor <= 0) unit.suppressionMultiplier = 1;

    unit.inspiredFor = Math.max(0, unit.inspiredFor - dt);
    if (unit.inspiredFor <= 0) unit.inspiredMultiplier = 1;

    unit.shieldFor = Math.max(0, unit.shieldFor - dt);
    if (unit.shieldFor <= 0) unit.shieldHp = 0;

    if (unit.summonLifetime > 0) {
      unit.summonLifetime = Math.max(0, unit.summonLifetime - dt);
      if (unit.summonLifetime <= 0) {
        this.defeat(unit, ctx);
        return false;
      }
    }
    return unit.alive;
  }

  tryActivate(unit: UnitModel, ctx: ControllerContext): boolean {
    const ability = unit.specialAbility;
    if (!ability || unit.abilityCooldown > 0 || unit.stunnedFor > 0) return false;

    switch (ability.type) {
      case 'AreaHeal': return this.areaHeal(unit, ability, ctx);
      case 'Stun': return this.stun(unit, ability, ctx);
      case 'BonusVsTank': return false; // реактивно срабатывает из обычной атаки
      case 'Trap': return this.placeTrap(unit, ability, ctx);
      case 'Charge': return this.charge(unit, ability, ctx);
      case 'Suppress': return this.suppress(unit, ability, ctx);
      case 'Shield': return this.shield(unit, ability, ctx);
      case 'SummonTurret': return this.summonTurret(unit, ability, ctx);
    }
  }

  /** Хук обычной атаки для бронебойного выстрела. */
  modifyBasicDamage(
    attacker: UnitModel,
    target: UnitModel,
    damage: number,
    ctx: ControllerContext,
  ): number {
    const ability = attacker.specialAbility;
    if (
      ability?.type !== 'BonusVsTank' ||
      attacker.abilityCooldown > 0 ||
      (target.combatRole !== 'tank' && target.combatRole !== 'aoe-breaker')
    ) return damage;

    attacker.abilityCooldown = ability.cooldown;
    const boosted = Math.max(1, Math.round(damage * ability.multiplier));
    ctx.emit({
      type: 'ability',
      caster: attacker.uid,
      ability: ability.type,
      targets: [target.uid],
      amount: boosted - damage,
    });
    return boosted;
  }

  /** Щит поглощает урон до HP; метод одинаков для атак, ловушек и AoE. */
  applyDamage(
    source: UnitModel | null,
    target: UnitModel,
    amount: number,
    ctx: ControllerContext,
  ): DamageResult {
    if (!target.alive || amount <= 0) return { total: 0, hp: 0, shield: 0 };
    let remaining = Math.max(0, Math.round(amount));
    const shield = Math.min(target.shieldHp, remaining);
    if (shield > 0) {
      target.shieldHp -= shield;
      remaining -= shield;
    }
    const hp = Math.min(target.hp, remaining);
    target.hp -= remaining;
    if (target.hp <= 0) {
      target.hp = 0;
      this.defeat(target, ctx);
    }
    return { total: shield + hp, hp, shield };
  }

  onUnitMoved(unit: UnitModel, ctx: ControllerContext): void {
    const index = this.traps.findIndex(
      (trap) => trap.team !== unit.team && trap.col === unit.col && trap.row === unit.row,
    );
    if (index < 0) return;
    const trap = this.traps.splice(index, 1)[0];
    const result = this.applyDamage(ctx.unitById(trap.ownerUid), unit, trap.damage, ctx);
    if (unit.alive) unit.stunnedFor = Math.max(unit.stunnedFor, 0.8);
    ctx.emit({
      type: 'ability',
      caster: trap.ownerUid,
      ability: 'Trap',
      targets: [unit.uid],
      amount: result.total,
      col: trap.col,
      row: trap.row,
    });
  }

  defeat(unit: UnitModel, ctx: ControllerContext): void {
    if (!unit.alive) return;
    unit.alive = false;
    unit.state = 'DEAD';
    const cell = ctx.grid.get(unit.col, unit.row);
    if (cell?.unit === unit) cell.unit = null;
    ctx.emit({ type: 'death', uid: unit.uid });
  }

  activeTrapCount(): number {
    return this.traps.length;
  }

  private areaHeal(
    caster: UnitModel,
    ability: SpecialAbilityDefinition,
    ctx: ControllerContext,
  ): boolean {
    const candidates = [caster, ...ctx.alliesOf(caster)].filter(
      (ally) => ally.hp < ally.maxHp &&
        ctx.grid.distance(caster.col, caster.row, ally.col, ally.row) <= ability.radius,
    );
    if (!candidates.length) return false;

    const targets: number[] = [];
    let total = 0;
    const healFatigue = Math.max(
      CONFIG.OVERTIME_HEAL_MIN_MULT,
      1 - Math.max(0, (ctx.elapsedSeconds ?? 0) - CONFIG.OVERTIME_START_SECONDS) /
        CONFIG.OVERTIME_HEAL_DECAY_SECONDS,
    );
    const healPower = Math.max(1, Math.round(ability.power * healFatigue));
    for (const ally of candidates) {
      const before = ally.hp;
      ally.hp = Math.min(ally.maxHp, ally.hp + healPower);
      const amount = ally.hp - before;
      if (amount <= 0) continue;
      targets.push(ally.uid);
      total += amount;
      ctx.emit({ type: 'heal', healer: caster.uid, target: ally.uid, amount });
    }
    if (!targets.length) return false;
    this.consume(caster, ability);
    ctx.emit({ type: 'ability', caster: caster.uid, ability: ability.type, targets, amount: total });
    return true;
  }

  private stun(
    caster: UnitModel,
    ability: SpecialAbilityDefinition,
    ctx: ControllerContext,
  ): boolean {
    const target = this.nearestInRange(caster, ctx.enemiesOf(caster), ability.range, ctx);
    if (!target) return false;
    const result = this.applyDamage(caster, target, ability.power, ctx);
    if (target.alive) target.stunnedFor = Math.max(target.stunnedFor, ability.duration);
    this.consume(caster, ability);
    ctx.emit({
      type: 'ability', caster: caster.uid, ability: ability.type,
      targets: [target.uid], amount: result.total,
    });
    return true;
  }

  private placeTrap(
    caster: UnitModel,
    ability: SpecialAbilityDefinition,
    ctx: ControllerContext,
  ): boolean {
    if (this.traps.some((trap) => trap.ownerUid === caster.uid)) return false;
    const target = this.nearest(caster, ctx.enemiesOf(caster), ctx);
    if (!target) return false;

    const path = findPath(ctx.grid, caster.col, caster.row, target.col, target.row);
    let cell = path && path.length > 2 ? path[1] : null;
    if (!cell || cell.blocked || cell.unit) {
      cell = ctx.grid.neighbors(caster.col, caster.row)
        .filter((candidate) => !candidate.blocked && !candidate.unit)
        .sort((a, b) => {
          const da = ctx.grid.distance(a.col, a.row, target.col, target.row);
          const db = ctx.grid.distance(b.col, b.row, target.col, target.row);
          return da - db || a.col - b.col || a.row - b.row;
        })[0] ?? null;
    }
    if (!cell) return false;

    this.traps.push({
      ownerUid: caster.uid,
      team: caster.team,
      col: cell.col,
      row: cell.row,
      damage: ability.power,
      remaining: ability.duration,
    });
    this.consume(caster, ability);
    ctx.emit({
      type: 'ability', caster: caster.uid, ability: ability.type,
      targets: [], amount: ability.power, col: cell.col, row: cell.row,
    });
    return true;
  }

  private charge(
    caster: UnitModel,
    ability: SpecialAbilityDefinition,
    ctx: ControllerContext,
  ): boolean {
    const enemies = ctx.enemiesOf(caster).filter((enemy) => {
      const d = ctx.grid.distance(caster.col, caster.row, enemy.col, enemy.row);
      return d > 1 && d <= ability.range + 1;
    });
    const target = this.nearest(caster, enemies, ctx);
    if (!target) return false;
    const path = findPath(ctx.grid, caster.col, caster.row, target.col, target.row);
    if (!path || path.length < 3) return false;
    const destinationIndex = Math.min(path.length - 2, Math.max(1, ability.range));
    const destination = path[destinationIndex];
    if (destination.blocked || destination.unit) return false;

    this.moveInstant(caster, destination.col, destination.row, ctx);
    if (!caster.alive) {
      this.consume(caster, ability);
      return true;
    }
    const raw = Math.max(1, Math.round(caster.baseAtk * ability.multiplier - target.baseDef));
    const result = this.applyDamage(caster, target, raw, ctx);
    this.consume(caster, ability);
    ctx.emit({
      type: 'ability', caster: caster.uid, ability: ability.type,
      targets: [target.uid], amount: result.total,
    });
    return true;
  }

  private suppress(
    caster: UnitModel,
    ability: SpecialAbilityDefinition,
    ctx: ControllerContext,
  ): boolean {
    const target = this.nearestInRange(caster, ctx.enemiesOf(caster), ability.range, ctx);
    if (!target) return false;
    const result = this.applyDamage(caster, target, ability.power, ctx);
    if (target.alive) {
      target.suppressedFor = Math.max(target.suppressedFor, ability.duration);
      target.suppressionMultiplier = Math.min(target.suppressionMultiplier, ability.multiplier);
    }
    this.consume(caster, ability);
    ctx.emit({
      type: 'ability', caster: caster.uid, ability: ability.type,
      targets: [target.uid], amount: result.total,
    });
    return true;
  }

  private shield(
    caster: UnitModel,
    ability: SpecialAbilityDefinition,
    ctx: ControllerContext,
  ): boolean {
    if (!ctx.enemiesOf(caster).length) return false;
    const candidates = [caster, ...ctx.alliesOf(caster)]
      .filter((ally) =>
        ctx.grid.distance(caster.col, caster.row, ally.col, ally.row) <= ability.range &&
        ally.shieldHp < ability.power * 0.25,
      )
      .sort((a, b) => {
        const tankA = a.combatRole === 'tank' ? 0 : 1;
        const tankB = b.combatRole === 'tank' ? 0 : 1;
        return tankA - tankB || a.hp / a.maxHp - b.hp / b.maxHp || a.uid - b.uid;
      });
    const target = candidates[0];
    if (!target) return false;
    target.shieldHp = Math.max(target.shieldHp, ability.power);
    target.shieldFor = Math.max(target.shieldFor, ability.duration);
    this.consume(caster, ability);
    ctx.emit({
      type: 'ability', caster: caster.uid, ability: ability.type,
      targets: [target.uid], amount: ability.power,
    });
    return true;
  }

  private summonTurret(
    caster: UnitModel,
    ability: SpecialAbilityDefinition,
    ctx: ControllerContext,
  ): boolean {
    if (ctx.alliesOf(caster).some((ally) => ally.summonerId === caster.uid)) return false;
    const cells = ctx.grid.neighbors(caster.col, caster.row)
      .filter((cell) => !cell.blocked && !cell.unit)
      .sort((a, b) => {
        const ownA = caster.team === 'player' ? a.col : -a.col;
        const ownB = caster.team === 'player' ? b.col : -b.col;
        const hillA = a.terrain === 'hill' ? 0 : 1;
        const hillB = b.terrain === 'hill' ? 0 : 1;
        return hillA - hillB || ownA - ownB || a.row - b.row;
      });
    const cell = cells[0];
    if (!cell) return false;

    const factor = ability.multiplier;
    const template: UnitTemplate = {
      id: `turret_${caster.id}`,
      name: `Турель: ${caster.name}`,
      role: 'ranged',
      combatRole: 'ranged-dps',
      hp: Math.max(20, Math.round(caster.maxHp * factor)),
      atk: Math.max(6, Math.round(caster.baseAtk * factor)),
      def: Math.max(1, Math.round(caster.baseDef * 0.55)),
      atkSpeed: Math.max(0.7, caster.baseAtkSpeed * 0.85),
      range: Math.max(3, caster.baseRange),
      move: 0,
      epochIndex: caster.epochIndex,
      immobile: true,
      summonLifetime: ability.duration,
      summonerId: caster.uid,
    };
    if (!ctx.spawnSummon) return false;
    const summoned = ctx.spawnSummon(template, caster.team, cell.col, cell.row);
    if (!summoned) return false;
    this.consume(caster, ability);
    ctx.emit({
      type: 'ability', caster: caster.uid, ability: ability.type,
      targets: [], amount: 0, col: cell.col, row: cell.row, summoned: summoned.uid,
    });
    return true;
  }

  private consume(caster: UnitModel, ability: SpecialAbilityDefinition): void {
    caster.abilityCooldown = ability.cooldown;
  }

  private nearestInRange(
    origin: UnitModel,
    list: UnitModel[],
    range: number,
    ctx: ControllerContext,
  ): UnitModel | null {
    return this.nearest(
      origin,
      list.filter((unit) => ctx.grid.distance(origin.col, origin.row, unit.col, unit.row) <= range),
      ctx,
    );
  }

  private nearest(
    origin: UnitModel,
    list: UnitModel[],
    ctx: ControllerContext,
  ): UnitModel | null {
    let best: UnitModel | null = null;
    let bestDistance = Infinity;
    for (const candidate of list) {
      const distance = ctx.grid.distance(origin.col, origin.row, candidate.col, candidate.row);
      if (distance < bestDistance || (distance === bestDistance && (!best || candidate.uid < best.uid))) {
        best = candidate;
        bestDistance = distance;
      }
    }
    return best;
  }

  private moveInstant(
    unit: UnitModel,
    col: number,
    row: number,
    ctx: ControllerContext,
  ): void {
    const fromCol = unit.col;
    const fromRow = unit.row;
    const oldCell = ctx.grid.get(fromCol, fromRow);
    if (oldCell?.unit === unit) oldCell.unit = null;
    unit.col = col;
    unit.row = row;
    const newCell = ctx.grid.get(col, row);
    if (newCell) newCell.unit = unit;
    unit.moveCooldown = Math.max(unit.moveCooldown, 0.35);
    ctx.emit({ type: 'move', uid: unit.uid, fromCol, fromRow, toCol: col, toRow: row });
    this.onUnitMoved(unit, ctx);
  }
}

export function abilityColor(type: SpecialAbilityType): number {
  switch (type) {
    case 'AreaHeal': return 0x22c55e;
    case 'Stun': return 0xfacc15;
    case 'BonusVsTank': return 0xfb923c;
    case 'Trap': return 0xa16207;
    case 'Charge': return 0xf97316;
    case 'Suppress': return 0x7c3aed;
    case 'Shield': return 0x38bdf8;
    case 'SummonTurret': return 0x94a3b8;
  }
}
