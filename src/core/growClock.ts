/** Independent calendar and sun for a growing garden. Stateless wall-clock evaluation:
 * reloads, low FPS and offline gaps don't reset the phases or require replaying past days.
 */
import { computeTime, type TimeState } from './clock';

export const GROW_MONTH_MS = 60 * 60 * 1000;
export const GROW_YEAR_MS = 12 * GROW_MONTH_MS;
export const GROW_DAY_MS = 5 * GROW_MONTH_MS;
export interface GrowClockState {
  /** Real-world anchor, fixed at creation/migration, never incremented per frame. */
  epoch: number;
  /** Absolute local calendar month + fraction (each whole month takes one real hour). */
  month: number;
  /** Independent solar phase at the anchor. */
  solar: number;
}
export function newGrowClock(now: number): GrowClockState {
  const d = new Date(now),
    y = d.getFullYear(),
    m = d.getMonth();
  const start = new Date(y, m, 1).getTime(),
    end = new Date(y, m + 1, 1).getTime();
  return { epoch: now, month: y * 12 + m + (now - start) / (end - start), solar: computeTime(now).dayT };
}

export function growTime(clock: GrowClockState, realNow: number): TimeState {
  const elapsed = Number.isFinite(realNow) ? Math.max(0, realNow - clock.epoch) : 0;
  const cursor = Math.min(1_200_000, clock.month + elapsed / GROW_MONTH_MS);
  const whole = Math.floor(cursor),
    year = Math.floor(whole / 12),
    month = whole % 12;
  const start = new Date(year, month, 1).getTime(),
    end = new Date(year, month + 1, 1).getTime();
  return computeTime(
    start + (cursor - whole) * (end - start),
    (clock.solar + (elapsed % GROW_DAY_MS) / GROW_DAY_MS) % 1,
  );
}
