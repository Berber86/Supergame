import type { GrowClockState } from '../core/growClock';
/** Типы данных усадьбы. */

export type GroundId = 'moss' | 'grass' | 'gravel' | 'sand' | 'stone' | 'soil' | 'water' | 'tatami' | 'deck';

/** Стили расчёсывания гравия в саду камней (карэсансуй). */
export type GravelStyle = 'waves' | 'ripples' | 'straight' | 'swirl';

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
  'tree' | 'shrub' | 'flower' | 'rock' | 'lantern' | 'bridge' | 'pavilion' | 'deco' | 'micro' | 'creature';

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
  /**
   * Посажено саженцем и растёт по часам (появилось в восьмой версии формата).
   * Старые сохранения поля не имеют: их деревья навсегда взрослые.
   */
  young?: 1;
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
  /** Летопись: первые встречи и редкие события сада, с опциональным Polaroid-снимком. */
  chronicle?: { id: string; at: number; snap?: string }[];
  /** Когда сад родился: отсюда считаем годы летописи. */
  born?: number;
  /** Сдвиг календаря территории: пресеты стартуют в своём месяце. */
  timeShift?: number;
  /** Открытия каталога: предметы, доступные игроку. Отсутствие — старое сохранение. */
  unlocked?: string[];
  /** Свежие открытия: золотая точка горит до первой постройки предмета. */
  fresh?: string[];
  /** Узор расчёсывания гравия: волны, круги у камней, прямые борозды или вихри. */
  gravelStyle?: GravelStyle;
  /** Индивидуальные узоры расчёсанных клеток гравия (индекс клетки -> номер узора). */
  tileRake?: Record<number, number>;
  /** Режим растущего сада: null или отсутствие — вольный сад. */
  grow?: {
    clock?: GrowClockState;
    rect: { x: number; y: number; w: number; h: number };
    seed: number;
    bank: number;
    tick: number;
    progress: number;
    stage: number;
    choosing: boolean;
  } | null;
}
