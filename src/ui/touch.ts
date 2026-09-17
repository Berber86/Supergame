/**
 * Жесты для телефона.
 *
 * На мыши есть правая кнопка, колесо и наведение — на пальце ничего этого нет.
 * Поэтому здесь отдельный разбор касаний, а не «эмуляция мыши»:
 *
 *   касание коротко   — поставить / выбрать
 *   касание и держать — убрать предмет (замена правой кнопке)
 *   палец ведёт       — рисовать кистью или тащить камеру
 *   два пальца        — масштаб и перенос вида одновременно
 *
 * Главное правило: палец толще курсора и всегда немного едет. Поэтому
 * «нажатие» и «ведение» различаются порогом в пикселях, а не фактом движения.
 */

/** За сколько пикселей движение перестаёт считаться нажатием. */
const TAP_SLOP = 12;
/** Сколько держать палец, чтобы сработало «убрать». */
const HOLD_MS = 420;

export interface TouchHandlers {
  /** Короткое касание: поставить, выбрать, отметить точку тропы. */
  onTap(x: number, y: number): void;
  /** Долгое нажатие: убрать то, что под пальцем. */
  onHold(x: number, y: number): void;
  /** Начало ведения пальцем (после превышения порога). */
  onDragStart(x: number, y: number): void;
  /** Ведение: dx/dy — сдвиг с прошлого кадра. */
  onDragMove(x: number, y: number, dx: number, dy: number): void;
  /** Ведение закончилось. */
  onDragEnd(): void;
  /** Два пальца: масштаб вокруг точки и сдвиг вида. */
  onPinch(scale: number, cx: number, cy: number, dx: number, dy: number): void;
  /** Два пальца отпущены. */
  onPinchEnd(): void;
  /** Можно ли сейчас рисовать пальцем (выбран инструмент). */
  isPainting(): boolean;
}

interface Pt {
  id: number;
  x: number;
  y: number;
}

export class TouchInput {
  private pts: Pt[] = [];
  private startX = 0;
  private startY = 0;
  private lastX = 0;
  private lastY = 0;
  private holdTimer: number | null = null;
  private moved = false;
  private dragging = false;
  private pinching = false;
  private pinchDist = 0;
  private pinchX = 0;
  private pinchY = 0;
  /** Гасим «хвост» после жеста двумя пальцами, пока не отпущены все. */
  private suppress = false;

  constructor(
    private el: HTMLElement,
    private h: TouchHandlers,
  ) {
    el.addEventListener('touchstart', this.onStart, { passive: false });
    el.addEventListener('touchmove', this.onMove, { passive: false });
    el.addEventListener('touchend', this.onEnd, { passive: false });
    el.addEventListener('touchcancel', this.onEnd, { passive: false });
  }

  destroy(): void {
    this.el.removeEventListener('touchstart', this.onStart);
    this.el.removeEventListener('touchmove', this.onMove);
    this.el.removeEventListener('touchend', this.onEnd);
    this.el.removeEventListener('touchcancel', this.onEnd);
  }

  private clearHold(): void {
    if (this.holdTimer !== null) {
      clearTimeout(this.holdTimer);
      this.holdTimer = null;
    }
  }

  private sync(e: TouchEvent): void {
    this.pts = Array.from(e.touches).map((t) => ({ id: t.identifier, x: t.clientX, y: t.clientY }));
  }

  private onStart = (e: TouchEvent): void => {
    e.preventDefault();
    this.sync(e);

    if (this.pts.length >= 2) {
      // Перешли на два пальца: всё, что начиналось одним, отменяем.
      this.clearHold();
      if (this.dragging) {
        this.dragging = false;
        this.h.onDragEnd();
      }
      this.pinching = true;
      this.suppress = true;
      const [a, b] = this.pts;
      this.pinchDist = Math.hypot(a.x - b.x, a.y - b.y);
      this.pinchX = (a.x + b.x) / 2;
      this.pinchY = (a.y + b.y) / 2;
      return;
    }

    const p = this.pts[0];
    this.startX = p.x;
    this.startY = p.y;
    this.lastX = p.x;
    this.lastY = p.y;
    this.moved = false;
    this.dragging = false;
    this.suppress = false;

    // Долгое нажатие вместо правой кнопки мыши
    this.holdTimer = window.setTimeout(() => {
      this.holdTimer = null;
      if (this.moved) return;
      this.moved = true; // чтобы отпускание не сработало ещё и как касание
      this.h.onHold(this.startX, this.startY);
    }, HOLD_MS);
  };

  private onMove = (e: TouchEvent): void => {
    e.preventDefault();
    this.sync(e);

    if (this.pinching && this.pts.length >= 2) {
      const [a, b] = this.pts;
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      const cx = (a.x + b.x) / 2;
      const cy = (a.y + b.y) / 2;
      if (this.pinchDist > 0) {
        // Масштаб и сдвиг разом: иначе при щипке картинка уезжает из-под пальцев
        this.h.onPinch(d / this.pinchDist, cx, cy, cx - this.pinchX, cy - this.pinchY);
      }
      this.pinchDist = d;
      this.pinchX = cx;
      this.pinchY = cy;
      return;
    }

    if (this.suppress || !this.pts.length) return;

    const p = this.pts[0];
    if (!this.moved && Math.hypot(p.x - this.startX, p.y - this.startY) > TAP_SLOP) {
      this.moved = true;
      this.clearHold();
      this.dragging = true;
      // Ведение начинаем от точки касания, а не от текущей: так мазок кистью
      // не теряет начало, а камера не прыгает на величину порога.
      this.h.onDragStart(this.startX, this.startY);
    }

    if (this.dragging) {
      this.h.onDragMove(p.x, p.y, p.x - this.lastX, p.y - this.lastY);
    }
    this.lastX = p.x;
    this.lastY = p.y;
  };

  private onEnd = (e: TouchEvent): void => {
    this.sync(e);

    if (this.pinching) {
      if (this.pts.length < 2) {
        this.pinching = false;
        this.pinchDist = 0;
        this.h.onPinchEnd();
      }
      // Пока не отпущены все пальцы, одиночные касания не засчитываем
      if (this.pts.length > 0) return;
      this.suppress = false;
      return;
    }

    if (this.pts.length > 0) return;

    this.clearHold();
    if (this.dragging) {
      this.dragging = false;
      this.h.onDragEnd();
    } else if (!this.moved && !this.suppress) {
      this.h.onTap(this.startX, this.startY);
    }
    this.moved = false;
    this.suppress = false;
  };
}

/** Телефон или планшет: есть касания и нет точного указателя. */
export function isTouchDevice(): boolean {
  return typeof window !== 'undefined' && 'ontouchstart' in window && window.matchMedia('(pointer: coarse)').matches;
}
