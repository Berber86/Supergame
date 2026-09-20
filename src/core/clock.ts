/**
 * Для вольного сада время синхронизировано с часами и календарём игрока.
 * Растущий сад передаёт свой календарный момент и независимую солнечную фазу.
 * Сезоны — настоящие, как за окном: март — весна, июнь — лето,
 * сентябрь — осень, декабрь — зима. (Раньше сезон крутился за 3 реальных
 * дня, и сад мог встретить гостя снегом в сентябре.)
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

/** Месяцы (0-based), с которых начинается каждый сезон: март, июнь, сентябрь, декабрь. */
const SEASON_START_MONTH = [2, 5, 8, 11];

/** Названия календарных пресетов; сами растения развиваются непрерывно между ними. */
export const MONTH_NAMES = [
  'Январь',
  'Февраль',
  'Март',
  'Апрель',
  'Май',
  'Июнь',
  'Июль',
  'Август',
  'Сентябрь',
  'Октябрь',
  'Ноябрь',
  'Декабрь',
] as const;

/** Год, с которого усадьба считает свои годы: её первая весна. */
const EPOCH_YEAR = 2024;

export interface TimeState {
  /** Календарное время; в растущем саду солнечная фаза dayT независима. Абсолютное время мира в мс (обычно Date.now(), но может быть смещено «созерцанием»). */
  now: number;
  /** 0..1 внутри суток, 0 = полночь. */
  dayT: number;
  hours: number;
  minutes: number;
  season: SeasonId;
  seasonIndex: number;
  /** 0..1 прогресс внутри сезона. */
  seasonT: number;
  /** Год усадьбы, с 1. Новый год начинается с весны. */
  year: number;
  /** 0 = глубокая ночь, 1 = яркий полдень. */
  daylight: number;
  /** Сила «золотого часа» (рассвет/закат). */
  golden: number;
  isNight: boolean;
  label: string;
}

export function computeTime(now: number, solarPhase?: number): TimeState {
  const local = new Date(now);
  const dayT =
    solarPhase !== undefined && Number.isFinite(solarPhase)
      ? ((solarPhase % 1) + 1) % 1
      : (local.getHours() * 3600 + local.getMinutes() * 60 + local.getSeconds() + local.getMilliseconds() / 1000) /
        86400;

  // Сезон по календарному месяцу: мар–май весна, июн–авг лето, сен–ноя осень, дек–фев зима.
  const m = local.getMonth();
  const seasonIndex = Math.floor(((m - 2 + 12) % 12) / 3);
  const season = SEASONS[seasonIndex];

  // Прогресс сезона — от 1-го числа первого месяца до 1-го числа следующего сезона.
  const startMonth = SEASON_START_MONTH[seasonIndex];
  let startYear = local.getFullYear();
  if (startMonth === 11 && m <= 1) startYear -= 1; // январь/февраль — хвост декабрьской зимы
  const startMs = new Date(startYear, startMonth, 1).getTime();
  const endYear = startMonth + 3 >= 12 ? startYear + 1 : startYear;
  const endMs = new Date(endYear, (startMonth + 3) % 12, 1).getTime();
  const seasonT = clamp01((now - startMs) / (endMs - startMs));

  // Год усадьбы начинается весной: всё, что до марта, — хвост уходящего года.
  const year = Math.max(1, local.getFullYear() - EPOCH_YEAR + (m >= 2 ? 1 : 0));

  // Кривая света: восход ~5:30, закат ~19:30 (мягко плавает по сезонам).
  const seasonShift = 0.1 + Math.cos(annualPhase(now) * Math.PI * 2);
  const sunrise = (5.6 + seasonShift) / 24;
  const sunset = (19.4 - seasonShift) / 24;

  const rise = smoothstep(sunrise - 0.035, sunrise + 0.05, dayT);
  const set = 1 - smoothstep(sunset - 0.05, sunset + 0.035, dayT);
  const daylight = clamp01(Math.min(rise, set));

  const goldenRise = Math.exp(-Math.pow((dayT - (sunrise + 0.022)) / 0.035, 2));
  const goldenSet = Math.exp(-Math.pow((dayT - (sunset - 0.03)) / 0.045, 2));
  const golden = clamp01(Math.max(goldenRise, goldenSet));

  const totalMinutes = Math.floor(dayT * 1440 + 1e-7) % 1440;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

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

/**
 * Момент в середине указанного сезона, ближайший к refMs.
 * Нужен инструментам и панели времени, чтобы собирать картинку сезона,
 * не убегая далеко от настоящей даты (посадки предметов меряются от now).
 */
export function midSeasonMs(seasonIndex: number, refMs = Date.now()): number {
  const start = SEASON_START_MONTH[((seasonIndex % 4) + 4) % 4];
  return midMonthMs((start + 1) % 12, refMs);
}

/** 15-е число выбранного месяца, ближайшее к опорной дате, в местном часовом поясе. */
export function midMonthMs(monthIndex: number, refMs = Date.now()): number {
  const ref = new Date(refMs);
  const sm = ((Math.trunc(monthIndex) % 12) + 12) % 12;
  let best = Infinity;
  let bestMs = 0;
  for (let y = ref.getFullYear() - 1; y <= ref.getFullYear() + 1; y++) {
    const cand = new Date(y, sm, 15).getTime();
    const d = Math.abs(cand - refMs);
    if (d < best) {
      best = d;
      bestMs = cand;
    }
  }
  return bestMs;
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

/** Continuous civil-year coordinate: Jan 15 = 0, Apr 15 = .25, Jul 15 = .5, Oct 15 = .75.
 * Uses actual dated anchors, including leap days and timezone/DST offsets. No reset on January 1.
 * The wrap at January 15 lies in dormancy; consumers must use periodic curves there.
 */
export function annualPhase(now: number): number {
  if (!Number.isFinite(now)) return 0;
  const year = new Date(now).getFullYear();
  const anchors = [
    new Date(year - 1, 9, 15).getTime(),
    new Date(year, 0, 15).getTime(),
    new Date(year, 3, 15).getTime(),
    new Date(year, 6, 15).getTime(),
    new Date(year, 9, 15).getTime(),
    new Date(year + 1, 0, 15).getTime(),
  ];
  for (let i = 0; i < anchors.length - 1; i++) {
    if (now < anchors[i + 1]) {
      const phase = (i - 1) * 0.25 + ((now - anchors[i]) / (anchors[i + 1] - anchors[i])) * 0.25;
      return (phase + 1) % 1;
    }
  }
  return 0;
}
