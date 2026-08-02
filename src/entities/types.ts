/** Примитивные типы сущностей — без зависимостей, используются и в логике, и в UI. */

/** Визуально-поведенческая роль, сохранённая для совместимости этапов 1–3. */
export type Role = 'tank' | 'melee' | 'ranged' | 'support' | 'cavalry' | 'heavy';

/** Общий баланс-каркас, в который укладываются обычные 2/3 ростера. */
export type CombatRole =
  | 'tank'
  | 'melee-dps'
  | 'ranged-dps'
  | 'support-heal'
  | 'support-buff'
  | 'aoe-breaker';

/** Совместимый fallback для старых сейвов и пользовательских шаблонов. */
export function combatRoleForRole(role: Role): CombatRole {
  switch (role) {
    case 'tank': return 'tank';
    case 'ranged': return 'ranged-dps';
    case 'support': return 'support-heal';
    case 'heavy': return 'aoe-breaker';
    default: return 'melee-dps';
  }
}

/** Команда. */
export type Team = 'player' | 'enemy';

/**
 * Состояния конечного автомата юнита (чисто логические).
 * IDLE → ENGAGE → ATTACK → CHASE/REPOSITION → RETREAT → (DEAD)
 */
export type UnitState =
  | 'IDLE'
  | 'ENGAGE'
  | 'ATTACK'
  | 'CHASE'
  | 'REPOSITION'
  | 'RETREAT'
  | 'ABILITY'
  | 'STUNNED'
  | 'DEAD';
