import type { Role, Team, UnitState } from './types';
import type { UnitTemplate } from '../data/units';

/**
 * Модель юнита — чистое состояние (данные). Не содержит логики поведения и
 * ничего не знает о Phaser. Поведение задаёт UnitController, оркестрацию —
 * CombatSystem, отрисовку — Phaser-сцены.
 */
export class UnitModel {
  readonly uid: number; // уникальный id экземпляра
  readonly id: string; // id шаблона
  name: string;
  role: Role;
  team: Team;

  // Базовые статы (не меняются в бою).
  readonly maxHp: number;
  readonly baseAtk: number;
  readonly baseDef: number;
  readonly baseAtkSpeed: number;
  readonly baseRange: number;
  readonly baseMove: number;

  // Рантайм-состояние.
  hp: number;
  col: number;
  row: number;
  state: UnitState = 'IDLE';
  targetId: number | null = null;

  // Кулдауны в секундах.
  attackCooldown = 0;
  moveCooldown = 0;
  healCooldown = 0;

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
    this.team = team;
    this.maxHp = template.hp;
    this.baseAtk = template.atk;
    this.baseDef = template.def;
    this.baseAtkSpeed = template.atkSpeed;
    this.baseRange = template.range;
    this.baseMove = template.move;
    this.hp = template.hp;
    this.col = col;
    this.row = row;
  }
}
