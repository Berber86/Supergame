/**
 * Время синхронизировано с часами игрока.
 * Сезон длится 3 реальных дня, полный год — 12 дней.
 */

import { clamp01, lerp, smoothstep } from './rng';

export type SeasonId = 'spring' | 'summer' | 'autumn' | 'winter';

export const SEASONS: SeasonId[] = ['spring', 'summer', 'autumn', 'winter'];

export const SEASON_NAMES: Record<SeasonId, string> = {
  spring: 'Весна',
  summer: 'Лето',
  autumn: 'Осень',
  winter: 'Зима',
};

export const SEASON_POEM: Record<SeasonId, string> = {
  spring: 'лепестки на воде',
  summer: 'звон цикад в тени',
  autumn: 'багряный клён',
  winter: 'тишина под снегом',
};

export const DAY_MS = 24 * 60 * 60 * 1000;
export const SEASON_DAYS = 3;
export const SEASON_MS = SEASON_DAYS * DAY_MS;
export const YEAR_MS = SEASON_MS * 4;

export interface TimeState {
  /** Абсолютное время мира в мс (обычно Date.now(), но может быть смещено «созерцанием»). */
  now: number;
  /** 0..1 внутри суток, 0 = полночь. */
  dayT: number;
  hours: number;
  minutes: number;
  season: SeasonId;
  seasonIndex: number;
  /** 0..1 прогресс внутри сезона. */
  seasonT: number;
  /** Год усадьбы, с 1. */
  year: number;
  /** 0 = глубокая ночь, 1 = яркий полдень. */
  daylight: number;
  /** Сила «золотого часа» (рассвет/закат). */
  golden: number;
  isNight: boolean;
  label: string;
}

/** Опорная точка отсчёта: начало времён усадьбы. */
const EPOCH = Date.UTC(2024, 2, 20, 0, 0, 0); // весеннее равноденствие

export function computeTime(now: number): TimeState {
  const local = new Date(now);
  const dayT =
    (local.getHours() * 3600 + local.getMinutes() * 60 + local.getSeconds() + local.getMilliseconds() / 1000) / 86400;

  const elapsed = now - EPOCH;
  const yearProgress = ((elapsed % YEAR_MS) + YEAR_MS) % YEAR_MS;
  const seasonIndex = Math.floor(yearProgress / SEASON_MS) % 4;
  const seasonT = (yearProgress % SEASON_MS) / SEASON_MS;
  const year = Math.floor(elapsed / YEAR_MS) + 1;

  // Кривая света: восход ~5:30, закат ~19:30 (мягко плавает по сезонам).
  const season = SEASONS[seasonIndex];
  const seasonShift = season === 'winter' ? 1.1 : season === 'summer' ? -0.9 : 0;
  const sunrise = (5.6 + seasonShift) / 24;
  const sunset = (19.4 - seasonShift) / 24;

  const rise = smoothstep(sunrise - 0.035, sunrise + 0.05, dayT);
  const set = 1 - smoothstep(sunset - 0.05, sunset + 0.035, dayT);
  const daylight = clamp01(Math.min(rise, set));

  const goldenRise = Math.exp(-Math.pow((dayT - (sunrise + 0.022)) / 0.035, 2));
  const goldenSet = Math.exp(-Math.pow((dayT - (sunset - 0.03)) / 0.045, 2));
  const golden = clamp01(Math.max(goldenRise, goldenSet));

  const hours = Math.floor(dayT * 24);
  const minutes = Math.floor((dayT * 24 - hours) * 60);

  return {
    now,
    dayT,
    hours,
    minutes,
    season,
    seasonIndex,
    seasonT,
    year,
    daylight,
    golden,
    isNight: daylight < 0.22,
    label: `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`,
  };
}

export function partOfDay(t: TimeState): string {
  const h = t.hours;
  if (h < 4) return 'глубокая ночь';
  if (h < 7) return 'рассвет';
  if (h < 11) return 'утро';
  if (h < 15) return 'полдень';
  if (h < 18) return 'день';
  if (h < 21) return 'закат';
  return 'ночь';
}

/** Плавное смешение сезонов на границе — деревья перекрашиваются не мгновенно. */
export function seasonBlend(t: TimeState): { from: SeasonId; to: SeasonId; k: number } {
  const edge = 0.14; // последние 14% сезона — переход
  if (t.seasonT > 1 - edge) {
    const k = (t.seasonT - (1 - edge)) / edge;
    return { from: t.season, to: SEASONS[(t.seasonIndex + 1) % 4], k: k * k * (3 - 2 * k) };
  }
  return { from: t.season, to: t.season, k: 0 };
}

export { lerp };
