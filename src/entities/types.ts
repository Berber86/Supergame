/** Примитивные типы сущностей — без зависимостей, используются и в логике, и в UI. */

/** Боевая роль юнита. */
export type Role = 'tank' | 'melee' | 'ranged' | 'support' | 'cavalry' | 'heavy';

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
  | 'DEAD';
