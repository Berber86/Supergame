/**
 * Базовые типы игры «Драконьи рейды: Королевства завоеваний».
 * Имена полей — на английском, комментарии и строки контента — на русском.
 */

/** Семейства реликвий (GDD §3.3): огонь, жадность, союзники. */
export type RelicFamily = 'fire' | 'greed' | 'ally';

/** Определение слуги (статичный контент). */
export interface ServantDef {
  id: string;
  name: string;
  desc: string;
  /** Базовый доход золота в секунду за одного слугу. */
  baseIncome: number;
  /** Стоимость найма первого экземпляра. */
  cost: number;
}

/** Определение здания (статичный контент). */
export interface BuildingDef {
  id: string;
  name: string;
  desc: string;
  /** Множитель дохода всех слуг за уровень здания. */
  multiplier: number;
  cost: number;
}

/** Определение королевства (статичный контент, цель рейда). */
export interface KingdomDef {
  id: string;
  name: string;
  desc: string;
  /** Число этапов рейда (GDD: 3–5). */
  stages: number;
  /** Здоровье босса. */
  bossHp: number;
}

/** Определение реликвии (статичный контент). */
export interface RelicDef {
  id: string;
  name: string;
  family: RelicFamily;
  /** Человекочитаемое описание эффекта. */
  effect: string;
}

/** Принадлежащий игроку слуга. */
export interface ServantOwned {
  id: string;
  count: number;
}

/** Принадлежащее игроку здание. */
export interface BuildingOwned {
  id: string;
  level: number;
}

/** Состояние текущего рейда. */
export interface RaidState {
  /** Текущее королевство или null, если рейда нет. */
  kingdomId: string | null;
  /** Текущий этап (1 — первый). */
  stage: number;
  /** Собранные в этом забеге реликвии. */
  relics: string[];
}

/** Полное состояние игры (сохраняется в localStorage). */
export interface GameState {
  gold: number;
  servants: ServantOwned[];
  buildings: BuildingOwned[];
  /** Все открытые реликвии (коллекция). */
  relics: string[];
  /** Захваченные королевства: id -> захвачено. */
  kingdomProgress: Record<string, boolean>;
  dragonLevel: number;
  /** Число перерождений («Вечное Пламя»). */
  prestige: number;
  achievements: string[];
  /** Дневник дракона — юмористический лог событий. */
  journal: string[];
  raid: RaidState;
  /** Timestamp последнего сохранения (для офлайн-расчёта). */
  lastSavedAt: number;
}

/** Версия формата сейва: при несовместимых изменениях инкрементировать ключ. */
export const SAVE_KEY = 'dragon-raids-save-v1';

/** Доходы, посчитанные из текущего состояния. */
export interface IncomeRates {
  perClick: number;
  perSecond: number;
}
