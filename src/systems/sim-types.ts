import type { SpecialAbilityType } from '../data/special-abilities';
import type { UnitTemplate } from '../data/units';
import type { UnitModel } from '../entities/UnitModel';
import type { Team, UnitState } from '../entities/types';
import type { HexGrid } from './HexGrid';
import type { RNG } from './RNG';

/** Протокол между чистой симуляцией (10 Гц) и Phaser-рендером. */
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
      splash?: boolean;
    }
  | { type: 'death'; uid: number }
  | { type: 'heal'; healer: number; target: number; amount: number }
  | { type: 'buff'; source: number; target: number; multiplier: number }
  | {
      type: 'ability';
      caster: number;
      ability: SpecialAbilityType;
      targets: number[];
      amount: number;
      col?: number;
      row?: number;
      summoned?: number;
    }
  | { type: 'state'; uid: number; state: UnitState };

export interface ControllerContext {
  grid: HexGrid;
  rng: RNG;
  /** Опционально для совместимости с изолированными тестами контроллера Этапа 1. */
  elapsedSeconds?: number;
  alliesOf(unit: UnitModel): UnitModel[];
  enemiesOf(unit: UnitModel): UnitModel[];
  unitById(uid: number): UnitModel | null;
  spawnSummon?(
    template: UnitTemplate,
    team: Team,
    col: number,
    row: number,
  ): UnitModel | null;
  emit(event: SimEvent): void;
}
