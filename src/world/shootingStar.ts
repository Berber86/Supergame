/**
 * Падающая звезда: редкое ночное событие.
 *
 * Чистая функция реального времени — каждая календарная ночь либо не
 * знает звезды вовсе, либо знает свою, в один и тот же момент: не нужно
 * хранить состояние, а сад, открытый ночью, увидит её обязательно один
 * раз. День считается по календарю, звезда падает между 19:00 и 03:00.
 *
 * Трасса держится в видимой полосе неба: остров закрывает середину
 * высот, открыты только верхние углы — звезда летит высоко и не лезет
 * за остров.
 */

import { DAY_MS, type TimeState } from '../core/clock';
import { hash2 } from '../core/rng';

/** Сколько мг длится сам полёт: медленно, торжественно, не огненная шрапнель. */
export const STAR_MS = 6500;

/** Доля ночей, на которых звезда есть. */
const STAR_NIGHTS = 0.38;

export interface StarView {
  /** 0..1 — где звезда сейчас на своём пути. */
  p: number;
  /** Начало трассы в долях экрана. */
  x0: number;
  y0: number;
  /** Наклон (рад) и длина в долях H: конец = (x0 + cos·len·H/W, y0 + sin·len). */
  ang: number;
  len: number;
}

/** Момент падения звезды в ночь дня `day` (эпоха, мс). */
export function starMoment(day: number): number {
  // 19:00 + до 8 часов вперёд, т.е. глубокая ночь
  return day * DAY_MS + (19 + 8 * hash2(day, 71, 9)) * 3600_000;
}

/** Есть ли сейчас падающая звезда и где её голова. Ночи без звезды — null. */
export function shootingStar(t: TimeState): StarView | null {
  const day = Math.floor(t.now / DAY_MS);
  for (const d of [day, day - 1]) {
    if (hash2(d, 71, 5) > STAR_NIGHTS) continue;
    const p = (t.now - starMoment(d)) / STAR_MS;
    if (p < 0 || p > 1) continue;
    // Только верхний конус над островом: левый или правый от центра.
    // Икс держится у края экрана: верхняя грань острова — диагональ с
    // наклоном 0.5, и к центру она поднимается к самому верху кадра.
    const side = hash2(d, 71, 31) < 0.5 ? 1 : -1;
    const x0 = side === 1 ? 0.04 + 0.14 * hash2(d, 71, 13) : 0.82 + 0.14 * hash2(d, 71, 13);
    const y0 = 0.02 + 0.04 * hash2(d, 71, 17);
    const angBase = 0.6 + 0.35 * hash2(d, 71, 23); // 34..54 градуса вниз
    const ang = side === 1 ? angBase : Math.PI - angBase; // к центру, не за него
    // Длина так, чтобы хвост не ушёл за остров: опуск <= 0.10H
    const allowed = 0.1 / Math.sin(angBase);
    const len = Math.min(allowed, 0.13) * (0.8 + 0.2 * hash2(d, 71, 29));
    return { p, x0, y0, ang, len };
  }
  return null;
}

/** Звезда падает или упадёт в течение пары секунд: кот успевает поднять голову. */
export function starApproaching(t: TimeState): boolean {
  const day = Math.floor(t.now / DAY_MS);
  for (const d of [day, day - 1]) {
    if (hash2(d, 71, 5) > STAR_NIGHTS) continue;
    const p = (t.now - starMoment(d)) / STAR_MS;
    if (p >= -0.22 && p <= 1) return true;
  }
  return false;
}
