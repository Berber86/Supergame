/**
 * Управление временем для разработки и проверки.
 * По умолчанию сад живёт по часам игрока; здесь можно взять время под контроль:
 * выбрать час, сезон или запустить ускоренное течение суток.
 *
 * Это инструмент периода создания игры — в готовой версии панель просто скрыта.
 */

import { DAY_MS, SEASONS, SeasonId, computeTime, midSeasonMs, TimeState } from './clock';

const STORE_KEY = 'usadba.timectl.v1';

export interface TimeOverride {
  /** Включено ли ручное управление. */
  active: boolean;
  /** Час суток 0..24 (дробный). */
  hour: number;
  /** Индекс сезона 0..3. */
  seasonIndex: number;
  /** Множитель ускорения хода времени: 0 = стоп, 1 = реальное, 600 = сутки за ~2.5 мин. */
  speed: number;
}

export class TimeControl {
  state: TimeOverride = { active: false, hour: 11, seasonIndex: 0, speed: 1 };
  /** Накопленное «искусственное» время, когда включено ускорение. */
  private simMs = 0;

  constructor() {
    this.load();
  }

  /** Вычисляет момент времени: либо настоящий, либо сконструированный. */
  now(): number {
    if (!this.state.active) return Date.now();

    // Собираем дату: нужный сезон + нужный час.
    // Берём середину выбранного сезона, ближайшую к настоящей дате,
    // чтобы посаженное «давно» не оказывалось в будущем.
    const seasonBase = midSeasonMs(this.state.seasonIndex);
    // Выравниваем на локальную полночь, затем добавляем выбранный час.
    const d = new Date(seasonBase);
    d.setHours(0, 0, 0, 0);
    return d.getTime() + this.state.hour * 3600_000 + this.simMs;
  }

  compute(): TimeState {
    return computeTime(this.now());
  }

  /** Ход ускоренного времени. dt — реальные миллисекунды кадра. */
  tick(dt: number): void {
    if (!this.state.active || this.state.speed === 1) return;
    this.simMs += dt * this.state.speed;
    // Держим накопление в пределах месяца с лишним, чтобы не уплыть в другой сезон
    const span = DAY_MS * 40;
    if (this.simMs > span) this.simMs -= span * 2;
    if (this.simMs < -span) this.simMs += span * 2;
  }

  enable(fromReal = true): void {
    if (fromReal && !this.state.active) {
      const t = computeTime(Date.now());
      this.state.hour = t.dayT * 24;
      this.state.seasonIndex = t.seasonIndex;
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
    this.state.hour = ((h % 24) + 24) % 24;
    this.simMs = 0;
    this.save();
  }

  setSeason(i: number): void {
    this.state.seasonIndex = ((i % 4) + 4) % 4;
    this.simMs = 0;
    this.save();
  }

  nextSeason(dir = 1): void {
    if (!this.state.active) this.enable();
    this.setSeason(this.state.seasonIndex + dir);
  }

  nudgeHour(delta: number): void {
    if (!this.state.active) this.enable();
    this.setHour(this.state.hour + delta);
  }

  setSpeed(mult: number): void {
    this.state.speed = mult;
    this.save();
  }

  get season(): SeasonId {
    return SEASONS[this.state.seasonIndex];
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
      const d = JSON.parse(raw) as TimeOverride;
      if (d && typeof d.hour === 'number') {
        this.state = { active: !!d.active, hour: d.hour, seasonIndex: d.seasonIndex | 0, speed: d.speed || 1 };
      }
    } catch {
      /* тишина */
    }
  }
}

export { DAY_MS, SEASONS };
