import type { CombatRole, Role } from '../entities/types';
import type { SpecialAbilityDefinition } from './special-abilities';
import { EVOLUTION_TREE_NODES, nodeToTemplate } from './evolution-tree';

/** Универсальный боевой шаблон для игрока, врага и временного призыва. */
export interface UnitTemplate {
  id: string;
  name: string;
  role: Role;
  combatRole?: CombatRole;
  hp: number;
  atk: number;
  def: number;
  atkSpeed: number;
  range: number;
  move: number;
  description?: string;
  epochIndex?: number;
  specialAbility?: SpecialAbilityDefinition;
  isBranchPoint?: boolean;
  elite?: boolean;
  immobile?: boolean;
  summonLifetime?: number;
  summonerId?: number;
}

/** Все 72 рассчитанных шаблона; дерево является единственным источником статов. */
export const ALL_UNIT_TEMPLATES: UnitTemplate[] = EVOLUTION_TREE_NODES.map(nodeToTemplate);

/** Девять доступных для найма стартовых форм эпохи I. */
export const STONE_AGE_UNITS: UnitTemplate[] = ALL_UNIT_TEMPLATES.filter(
  (unit) => unit.epochIndex === 1,
);

/** Визуальная информация по поведенческим ролям (используется UI). */
export const ROLE_INFO: Record<Role, { label: string; color: number; letter: string }> = {
  tank: { label: 'Танк', color: 0xfbbf24, letter: 'Т' },
  melee: { label: 'Боец', color: 0xf97316, letter: 'Б' },
  ranged: { label: 'Стрелок', color: 0x22d3ee, letter: 'С' },
  support: { label: 'Поддержка', color: 0xa3e635, letter: 'П' },
  cavalry: { label: 'Кавалерия', color: 0xe879f9, letter: 'К' },
  heavy: { label: 'Разрушитель', color: 0xd1d5db, letter: 'Р' },
};

/** Старая фиксированная расстановка оставлена только для smoke-теста Этапа 1. */
export const ENEMY_LINEUP: ReadonlyArray<{ templateId: string; col: number; row: number }> = [
  { templateId: 'guardian', col: 10, row: 1 },
  { templateId: 'boneshield', col: 10, row: 4 },
  { templateId: 'spearhunter', col: 9, row: 0 },
  { templateId: 'flintaxe', col: 9, row: 6 },
  { templateId: 'sling', col: 8, row: 2 },
  { templateId: 'wolfrider', col: 9, row: 3 },
];

const TEMPLATE_BY_ID = new Map(ALL_UNIT_TEMPLATES.map((template) => [template.id, template]));

export function findTemplate(id: string): UnitTemplate {
  const template = TEMPLATE_BY_ID.get(id);
  if (!template) throw new Error(`Unknown unit template: ${id}`);
  return template;
}
