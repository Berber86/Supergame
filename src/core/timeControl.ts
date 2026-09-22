import { growTime, newGrowClock } from './growClock';
import type { GrowState } from '../world/grow';
/**
 * Управление временем для разработки и проверки.
 * По умолчанию вольный сад живёт по часам игрока, растущий — по своему ритму.
 * Здесь можно взять время под контроль:
 * выбрать час, месяц, сезон или запустить ускоренное течение суток.
 *
 * Это инструмент периода создания игры — в готовой версии панель просто скрыта.
 */

import { DAY_MS, SEASONS, SeasonId, computeTime, midMonthMs, TimeState } from './clock';

const STORE_KEY = 'usadba.timectl.v1';

export interface TimeOverride {
  /** Включено ли ручное управление. */
  active: boolean;
  /** Час суток 0..24 (дробный). */
  hour: number;
  /** Индекс сезона 0..3. */
  seasonIndex: number;
  /** Календарный месяц 0..11; пресет выбирает его 15-е число. */
  monthIndex: number;
  /** Множитель ускорения хода времени: 0 = стоп, 1 = реальное, 600 = сутки за ~2.5 мин. */
  speed: number;
}

export class TimeControl {
  state: TimeOverride = { active: false, hour: 11, seasonIndex: 0, monthIndex: 3, speed: 1 };
  /** Накопленное «искусственное» время, когда включено ускорение. */
  private simMs = 0;

  private seenGrow: GrowState | null | undefined;
  constructor(
    private readonly growSource?: () => GrowState | null,
    private readonly onGrowMigration?: () => void,
    /** Календарный сдвиг открытой территории: пресеты стартуют в своём месяце. */
    private readonly shiftSource?: () => number,
  ) {
    this.load();
    this.syncGrow();
  }

  private syncGrow(): GrowState | null {
    const grow = this.growSource?.() ?? null;
    if (grow !== this.seenGrow) {
      // Opening a growing garden always starts its own rhythm, not a saved developer speed.
      if (grow) {
        this.state.active = false;
        this.simMs = 0;
      }
      this.seenGrow = grow;
    }
    if (grow && !grow.clock) {
      grow.clock = newGrowClock(Date.now());
      this.onGrowMigration?.();
    }
    return grow;
  }
  get growAutomatic(): boolean {
    return !!this.syncGrow() && !this.state.active;
  }

  /** Вычисляет момент времени: либо настоящий, либо сконструированный. */
  now(): number {
    const grow = this.syncGrow();
    if (!this.state.active)
      return grow ? growTime(grow.clock!, Date.now()).now : Date.now() + (this.shiftSource?.() ?? 0);

    const d = new Date(midMonthMs(this.state.monthIndex));
    // Задаём именно местный час, а не число миллисекунд после полуночи.
    const seconds = Math.round(this.state.hour * 3600);
    d.setHours(Math.floor(seconds / 3600), Math.floor(seconds / 60) % 60, seconds % 60, 0);
    return d.getTime() + this.simMs;
  }

  compute(): TimeState {
    const grow = this.syncGrow();
    return grow && !this.state.active ? growTime(grow.clock!, Date.now()) : computeTime(this.now());
  }

  /** Ход ускоренного времени. dt — реальные миллисекунды кадра. */
  tick(dt: number): void {
    this.syncGrow();
    if (!this.state.active || !Number.isFinite(dt) || dt <= 0) return;
    // Без прежнего скачка назад через 40 дней: можно непрерывно пройти весь год.
    this.simMs += dt * this.state.speed;
  }

  enable(fromReal = true): void {
    if (fromReal && !this.state.active) {
      const t = this.compute();
      this.state.hour = t.dayT * 24;
      this.state.seasonIndex = t.seasonIndex;
      this.state.monthIndex = new Date(t.now).getMonth();
    }
    this.state.active = true;
    this.simMs = 0;
    this.save();
  }

  disable(): void {
    this.state.active = false;
    this.simMs = 0;
    this.save();
  }

  toggle(): void {
    if (this.state.active) this.disable();
    else this.enable();
  }

  setHour(h: number): void {
    if (!Number.isFinite(h)) return;
    this.state.hour = ((h % 24) + 24) % 24;
    this.simMs = 0;
    this.save();
  }

  setSeason(i: number): void {
    if (!Number.isFinite(i)) return;
    const seasonIndex = ((Math.trunc(i) % 4) + 4) % 4;
    this.setMonth([3, 6, 9, 0][seasonIndex]);
  }

  setMonth(i: number): void {
    if (!Number.isFinite(i)) return;
    this.state.monthIndex = ((Math.trunc(i) % 12) + 12) % 12;
    this.state.seasonIndex = Math.floor(((this.state.monthIndex + 10) % 12) / 3);
    this.simMs = 0;
    this.save();
  }

  nextSeason(dir = 1): void {
    if (!this.state.active) this.enable();
    this.setSeason(this.compute().seasonIndex + dir);
  }

  nudgeHour(delta: number): void {
    if (!this.state.active) this.enable();
    this.setHour(this.state.hour + delta);
  }

  setSpeed(mult: number): void {
    if (!Number.isFinite(mult) || mult < 0) return;
    this.state.speed = mult;
    this.save();
  }

  get season(): SeasonId {
    return this.compute().season;
  }

  /** Текущий отображаемый час с учётом ускорения. */
  get displayHour(): number {
    const t = this.compute();
    return t.dayT * 24;
  }

  private save(): void {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(this.state));
    } catch {
      /* тишина */
    }
  }

  private load(): void {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (!raw) return;
      const d = JSON.parse(raw) as Partial<TimeOverride> | null;
      if (d && typeof d.hour === 'number' && Number.isFinite(d.hour)) {
        const seasonIndex = Number.isInteger(d.seasonIndex) ? ((d.seasonIndex! % 4) + 4) % 4 : 0;
        // Совместимость с настройками, в которых были только четыре сезона.
        const monthIndex = Number.isInteger(d.monthIndex)
          ? ((d.monthIndex! % 12) + 12) % 12
          : [3, 6, 9, 0][seasonIndex];
        this.state = {
          active: !!d.active,
          hour: ((d.hour % 24) + 24) % 24,
          monthIndex,
          seasonIndex: Math.floor(((monthIndex + 10) % 12) / 3),
          speed: typeof d.speed === 'number' && Number.isFinite(d.speed) && d.speed >= 0 ? d.speed : 1,
        };
      }
    } catch {
      /* тишина */
    }
  }
}

export { DAY_MS, SEASONS };
