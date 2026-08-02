import type { UnitTemplate } from '../data/units';
import type { Role } from '../entities/types';

/**
 * Персистентный юнит ростера. Хранит ПОЛНЫЕ статы (самодостаточен, не зависит
 * от шаблонов в будущем), текущий HP (между волнами) и счётчик опыта.
 * Это «долгоживущее» состояние; в бой из него создаётся краткоживущая
 * UnitModel (боевая) с hp = currentHp.
 */
export interface RosterUnit {
  id: string; // уникальный id экземпляра ('ruNN')
  templateId: string;
  name: string;
  role: Role;
  maxHp: number;
  atk: number;
  def: number;
  atkSpeed: number;
  range: number;
  move: number;
  currentHp: number;
  battleExperience: number;
  epochIndex: number;
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
    maxHp: tpl.hp,
    atk: tpl.atk,
    def: tpl.def,
    atkSpeed: tpl.atkSpeed,
    range: tpl.range,
    move: tpl.move,
    currentHp: tpl.hp,
    battleExperience: 0,
    epochIndex: tpl.epochIndex ?? 1,
  };
}

/** Преобразовать ростер-юнита в боевой шаблон (для CombatSystem.addUnit). */
export function rosterToTemplate(ru: RosterUnit): UnitTemplate {
  return {
    id: ru.templateId,
    name: ru.name,
    role: ru.role,
    hp: ru.maxHp,
    atk: ru.atk,
    def: ru.def,
    atkSpeed: ru.atkSpeed,
    range: ru.range,
    move: ru.move,
    epochIndex: ru.epochIndex,
  };
}

export function isWounded(ru: RosterUnit): boolean {
  return ru.currentHp < ru.maxHp;
}

export function isDowned(ru: RosterUnit): boolean {
  return ru.currentHp <= 0;
}

/** Готов к бою: не «сражён» (currentHp > 0). */
export function isDeployable(ru: RosterUnit): boolean {
  return ru.currentHp > 0;
}
