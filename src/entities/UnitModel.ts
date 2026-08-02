import type { SpecialAbilityDefinition } from '../data/special-abilities';
import type { UnitTemplate } from '../data/units';
import {
  combatRoleForRole,
  type CombatRole,
  type Role,
  type Team,
  type UnitState,
} from './types';

/** Чистое боевое состояние; Phaser и отрисовка сюда не попадают. */
export class UnitModel {
  readonly uid: number;
  readonly id: string;
  name: string;
  role: Role;
  combatRole: CombatRole;
  team: Team;
  readonly epochIndex: number;

  readonly maxHp: number;
  readonly baseAtk: number;
  readonly baseDef: number;
  readonly baseAtkSpeed: number;
  readonly baseRange: number;
  readonly baseMove: number;
  readonly specialAbility?: SpecialAbilityDefinition;
  readonly elite: boolean;
  readonly immobile: boolean;
  readonly summonerId: number | null;

  hp: number;
  col: number;
  row: number;
  state: UnitState = 'IDLE';
  targetId: number | null = null;

  attackCooldown = 0;
  moveCooldown = 0;
  healCooldown = 0;
  abilityCooldown = 0;

  stunnedFor = 0;
  suppressedFor = 0;
  suppressionMultiplier = 1;
  inspiredFor = 0;
  inspiredMultiplier = 1;
  shieldHp = 0;
  shieldFor = 0;
  summonLifetime = 0;

  alive = true;

  constructor(
    uid: number,
    template: UnitTemplate,
    team: Team,
    col: number,
    row: number,
  ) {
    this.uid = uid;
    this.id = template.id;
    this.name = template.name;
    this.role = template.role;
    this.combatRole = template.combatRole ?? combatRoleForRole(template.role);
    this.team = team;
    this.epochIndex = template.epochIndex ?? 1;
    this.maxHp = template.hp;
    this.baseAtk = template.atk;
    this.baseDef = template.def;
    this.baseAtkSpeed = template.atkSpeed;
    this.baseRange = template.range;
    this.baseMove = template.move;
    this.specialAbility = template.specialAbility;
    this.elite = !!template.elite;
    this.immobile = !!template.immobile;
    this.summonLifetime = template.summonLifetime ?? 0;
    this.summonerId = template.summonerId ?? null;
    this.hp = template.hp;
    this.col = col;
    this.row = row;
    // Способности не срабатывают всей армией в нулевой тик.
    this.abilityCooldown = this.specialAbility
      ? Math.min(1.2, this.specialAbility.cooldown * 0.15)
      : 0;
  }
}
