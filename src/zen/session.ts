/**
 * Сеанс практики: конечный автомат без DOM и без звука.
 *
 * Панель лишь читает `view` и раздаёт события: чаша на входе, строки по ходу,
 * фазы дыхания, хан на кругах, чаши в конце. Вся «игровая механика» здесь —
 * это время и порядок фаз, поэтому её можно прогнать проверкой без браузера.
 *
 * Мягкий таймер (решено с игроком): отсчёт есть, провала нет. Встать можно
 * в любую секунду, и досрочный выход записывается как состоявшийся сеанс —
 * четыре минуты сидения это четыре минуты сидения.
 */

import { Practice } from './content';

export type SessionEvent =
  /** Первая чаша: сеанс начался. */
  | { type: 'start' }
  /** Тихая строка на бумаге. */
  | { type: 'line'; text: string }
  /** Фаза дыхания (или шага): панель ведёт круг и звук. */
  | { type: 'breath'; phase: 'in' | 'out'; seconds: number }
  /** Очередное число счёта, 1..10. */
  | { type: 'count'; n: number }
  /** Деревянный удар между кругами сидения. */
  | { type: 'han' }
  /** Время вышло: панель ставит чаши конца и показывает итог. */
  | { type: 'close' };

export interface SessionView {
  phase: 'settle' | 'flow' | 'close';
  elapsed: number;
  total: number;
  breathPhase: 'in' | 'out';
  /** 0..1 внутри текущей фазы дыхания. */
  breathT: number;
  /** Текущее число счёта (практики со счётом). */
  count: number;
  /** Сколько вдохов прожито (для «трёх вдохов» и шагов). */
  cycles: number;
  line: string;
}

const SETTLE_MS = 6000;
const LINE_EVERY_MS = 22000;

export class Session {
  readonly practice: Practice;
  readonly total: number;
  readonly view: SessionView;
  private elapsed = 0;
  private breathLeft = 0;
  private breathPhase: 'in' | 'out' = 'in';
  private lineIdx = -1;
  private lineAt = 0;
  private hanIdx = 0;
  private count = 0;
  private cycles = 0;
  private closed = false;

  constructor(practice: Practice, minutes: number) {
    this.practice = practice;
    this.total = Math.max(1, minutes) * 60000;
    this.view = {
      phase: 'settle',
      elapsed: 0,
      total: this.total,
      breathPhase: 'in',
      breathT: 0,
      count: 0,
      cycles: 0,
      line: settleLine(practice.id),
    };
  }

  get done(): boolean {
    return this.closed;
  }

  /** Один шаг времени. Возвращает события, случившиеся за него. */
  update(dtMs: number): SessionEvent[] {
    if (this.closed) return [];
    const ev: SessionEvent[] = [];
    const first = this.elapsed === 0;
    this.elapsed += dtMs;
    const v = this.view;
    v.elapsed = this.elapsed;

    if (first) {
      ev.push({ type: 'start' });
      v.phase = 'settle';
    }

    const breathing = !!this.practice.breath;
    const settleDone = this.elapsed >= SETTLE_MS;
    if (settleDone && v.phase === 'settle') v.phase = 'flow';

    // --- дыхание / шаг ---
    if (breathing && settleDone && !this.closed) {
      if (this.breathLeft <= 0) {
        this.breathPhase = this.breathPhase === 'in' ? 'out' : 'in';
        const secs = this.breathPhase === 'in' ? this.practice.breath!.inhale : this.practice.breath!.exhale;
        this.breathLeft = secs * 1000;
        ev.push({ type: 'breath', phase: this.breathPhase, seconds: secs });
        if (this.breathPhase === 'in') {
          // вдох начал новый круг
          this.cycles += 1;
          v.cycles = this.cycles;
          if (this.practice.mode === 'count' || this.practice.mode === 'three') {
            this.count = this.count >= 10 ? 1 : this.count + 1;
            v.count = this.count;
            ev.push({ type: 'count', n: this.count });
          }
        }
      }
      this.breathLeft -= dtMs;
      const secs = this.breathPhase === 'in' ? this.practice.breath!.inhale : this.practice.breath!.exhale;
      v.breathPhase = this.breathPhase;
      v.breathT = 1 - Math.max(0, this.breathLeft) / (secs * 1000);
    }

    // --- тихие строки ---
    if (this.elapsed >= this.lineAt + LINE_EVERY_MS || (settleDone && this.lineIdx < 0)) {
      this.lineIdx += 1;
      this.lineAt = this.elapsed;
      const lines = this.practice.lines;
      v.line = lines[this.lineIdx % lines.length];
      ev.push({ type: 'line', text: v.line });
    }

    // --- хан между кругами длинных сидений ---
    const marks = this.practice.hanAt ?? [];
    while (this.hanIdx < marks.length && this.elapsed >= marks[this.hanIdx] * 60000) {
      this.hanIdx += 1;
      ev.push({ type: 'han' });
    }

    // --- конец по времени ---
    if (this.elapsed >= this.total) {
      v.phase = 'close';
      this.closed = true;
      ev.push({ type: 'close' });
    }
    return ev;
  }

  /** Встали сами: сеанс всё равно состоялся. */
  finishEarly(): SessionEvent[] {
    if (this.closed) return [];
    this.closed = true;
    this.view.phase = 'close';
    return [];
  }

  /** Сколько минут записать в память: не меньше одной, без дробей. */
  minutesSat(): number {
    return Math.max(1, Math.round(this.elapsed / 60000));
  }
}

function settleLine(id: string): string {
  switch (id) {
    case 'walk':
      return 'встаньте. руки сложены перед собой, взгляд на полшага впереди';
    case 'listen':
      return 'сядьте и отдайте внимание уху';
    case 'koan':
      return 'сядьте с вопросом. отвечать не нужно';
    default:
      return 'сядьте. спина держится сама, не мышцами';
  }
}
