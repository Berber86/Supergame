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
  /** Имя босса (тон — мультяшный юмор). */
  boss: string;
  /** Базовая добыча золота за победу. */
  loot: number;
  /** Стоимость снаряжения рейда (золото тратится при вылете). */
  cost: number;
}

/** Определение реликвии (статичный контент). */
export interface RelicDef {
  id: string;
  name: string;
  family: RelicFamily;
  /** Человекочитаемое описание эффекта. */
  effect: string;
  /** Прибавка к урону в рейде (S6: числовой эффект вместо парсинга текста). */
  damage: number;
  /** Прибавка к добыче золота за победу, в процентах (0.1 = +10%). */
  lootPct: number;
}

/** Активная синергия (комбо семейства или именованная пара). */
export interface ActiveSynergy {
  id: string;
  name: string;
  desc: string;
  /** Прибавка к множителю урона (0.25 = +25%). */
  damageMult: number;
  /** Прибавка к множителю добычи (0.25 = +25%). */
  lootMult: number;
}

/** Итог расчёта силы рейда (S6). */
export interface RaidPower {
  /** Базовый урон от пещеры (доход, уровень дракона). */
  base: number;
  /** Сумма урона реликвий. */
  fromRelics: number;
  /** Итоговый множитель от синергий. */
  multiplier: number;
  /** Итоговый урон. */
  damage: number;
  /** Активные синергии. */
  synergies: ActiveSynergy[];
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
  /** Реликвии, предложенные на текущем этапе (фиксируются, чтобы не «рероллить» перерисовкой). */
  offer: string[];
  /** Этапы пройдены — пора драться с боссом. */
  atBoss: boolean;
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
