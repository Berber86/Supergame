import type { HexGrid } from './HexGrid';
import type { RNG } from './RNG';
import type { UnitModel } from '../entities/UnitModel';
import type { UnitState } from '../entities/types';

/**
 * События симуляции. Это "протокол" между логикой (10 Гц) и рендером (60 Гц):
 * CombatSystem накапливает их за update(), а Phaser-сцена проигрывает визуально.
 * Так тайминги логики и анимаций полностью развязаны.
 */
export type SimEvent =
  | {
      type: 'move';
      uid: number;
      fromCol: number;
      fromRow: number;
      toCol: number;
      toRow: number;
    }
  | {
      type: 'attack';
      attacker: number;
      target: number;
      ranged: boolean;
      damage: number;
      crit: boolean;
      miss: boolean;
    }
  | { type: 'death'; uid: number }
  | { type: 'heal'; healer: number; target: number; amount: number }
  | { type: 'state'; uid: number; state: UnitState };

/** Контекст, который контроллер юнита получает на каждом тике. */
export interface ControllerContext {
  grid: HexGrid;
  rng: RNG;
  alliesOf(unit: UnitModel): UnitModel[];
  enemiesOf(unit: UnitModel): UnitModel[];
  unitById(uid: number): UnitModel | null;
  emit(event: SimEvent): void;
}
