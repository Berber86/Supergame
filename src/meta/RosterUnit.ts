import type { UnitTemplate } from '../data/units';
import type { SpecialAbilityDefinition } from '../data/special-abilities';
import {
  combatRoleForRole,
  type CombatRole,
  type Role,
} from '../entities/types';

/** Долгоживущее состояние индивидуально эволюционирующего юнита. */
export interface RosterUnit {
  id: string;
  templateId: string;
  name: string;
  role: Role;
  combatRole?: CombatRole;
  maxHp: number;
  atk: number;
  def: number;
  atkSpeed: number;
  range: number;
  move: number;
  currentHp: number;
  battleExperience: number;
  epochIndex: number;
  description?: string;
  specialAbility?: SpecialAbilityDefinition;
  evolutionHistory?: string[];
}

export function createRosterUnitFromTemplate(
  tpl: UnitTemplate,
  id: string,
): RosterUnit {
  return {
    id,
    templateId: tpl.id,
    name: tpl.name,
    role: tpl.role,
    combatRole: tpl.combatRole ?? combatRoleForRole(tpl.role),
    maxHp: tpl.hp,
    atk: tpl.atk,
    def: tpl.def,
    atkSpeed: tpl.atkSpeed,
    range: tpl.range,
    move: tpl.move,
    currentHp: tpl.hp,
    battleExperience: 0,
    epochIndex: tpl.epochIndex ?? 1,
    description: tpl.description,
    specialAbility: tpl.specialAbility,
    evolutionHistory: [tpl.name],
  };
}

/** Преобразовать ростер-юнита в краткоживущий боевой шаблон. */
export function rosterToTemplate(ru: RosterUnit): UnitTemplate {
  return {
    id: ru.templateId,
    name: ru.name,
    role: ru.role,
    combatRole: ru.combatRole ?? combatRoleForRole(ru.role),
    hp: ru.maxHp,
    atk: ru.atk,
    def: ru.def,
    atkSpeed: ru.atkSpeed,
    range: ru.range,
    move: ru.move,
    epochIndex: ru.epochIndex,
    description: ru.description,
    specialAbility: ru.specialAbility,
  };
}

export function isWounded(ru: RosterUnit): boolean {
  return ru.currentHp < ru.maxHp;
}

export function isDowned(ru: RosterUnit): boolean {
  return ru.currentHp <= 0;
}

export function isDeployable(ru: RosterUnit): boolean {
  return ru.currentHp > 0;
}
