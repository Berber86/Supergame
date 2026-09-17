/** Типы данных усадьбы. */

export type GroundId =
  | 'moss'
  | 'grass'
  | 'gravel'
  | 'sand'
  | 'stone'
  | 'soil'
  | 'water'
  | 'tatami'
  | 'deck';

export interface Tile {
  ground: GroundId;
  /** Уровень рельефа: 0 — земля, 1..2 — холмы, -1 — выемка под воду. */
  level: number;
  /** Вода поверх тайла (пруд/ручей). */
  water: boolean;
  /** Внутреннее пространство дома (татами + крыша). */
  indoor: boolean;
  /** Веранда энгава. */
  veranda: boolean;
}

export type ObjKind =
  | 'tree'
  | 'shrub'
  | 'flower'
  | 'rock'
  | 'lantern'
  | 'bridge'
  | 'pavilion'
  | 'deco'
  | 'micro'
  | 'creature';

export interface PlacedObject {
  id: number;
  type: string;
  /** Позиция в тайлах, может быть кратна 0.25 для микро-декора. */
  tx: number;
  ty: number;
  /** Время посадки (мс) — для роста. */
  planted: number;
  /** Поворот 0..3. */
  rot: number;
  /** Индивидуальный сид для вариации формы. */
  seed: number;
}

export interface SaveData {
  version: number;
  tiles: Tile[];
  objects: PlacedObject[];
  nextId: number;
  milestones: string[];
  /** Сезоны, которые игрок застал: для вехи «Круг года». */
  seasons?: string[];
  seen: string[];
}
