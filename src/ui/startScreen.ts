/**
 * Стартовая страница: свиток на стене тёмной комнаты.
 *
 * Дверь в сад, а не рекламный щит. На экране ничего не продаётся и ничего
 * не выбирается: лист рисовой бумаги, круг энсо, каллиграфия и одна строка
 * «войти в сад». Свет подчиняется настоящему часу игрока, поэтому сад
 * начинается ещё до входа — свиток висит то в ночной синеве, то в охре
 * заката, и это тот же час, что и в мире за ним.
 *
 * Холст рисует `startArt`, здесь — только DOM: место листа, слова, клавиши
 * и дверная ручка. Разделение позволяет проверить кисть оффлайн
 * (`tools/start-preview.ts`), не поднимая браузер.
 */

import { SCROLL_TEXT, StartArt, StartFrame } from './startArt';
import { APP_VERSION } from '../version';

export interface StartScreenOptions {
  /** Час сада — свет на заставке живёт по тем же часам, что и мир. */
  hour: () => number;
  /** Игрок вошёл: клик одновременно разблокирует звук. */
  onEnter: () => void;
  /** Настройки вида: выключенные плавные движения гасят дыхание и пыль. */
  motion: boolean;
}

/** Сколько идёт вход: тушь ложится, знаки проявляются, лист отходит. */
const ENTER_MS = 2100;
/** Уход заставки — та же длительность, что в CSS у `.splash`. */
const LEAVE_MS = 1400;


export class StartScreen {
  /** Корень заставки: он же место, куда приходят переменные листа. */
  readonly el: HTMLDivElement;
  /** Слой слов поверх холста — название и вход. */
  private scroll: HTMLElement;

  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private art = new StartArt();
  private opts: StartScreenOptions;
  private raf = 0;
  private born = performance.now();
  private needSize = true;
  private opened = false;
  private reduced: boolean;

  constructor(opts: StartScreenOptions) {
    this.opts = opts;
    this.reduced =
      !opts.motion || matchMedia('(prefers-reduced-motion: reduce)').matches;

    this.el = document.createElement('div');
    this.el.className = 'splash';
    this.el.setAttribute('role', 'presentation');

    this.canvas = document.createElement('canvas');
    this.canvas.className = 'splash-canvas';
    this.canvas.setAttribute('aria-hidden', 'true');
    this.el.appendChild(this.canvas);
    this.ctx = this.canvas.getContext('2d')!;

    // Слова живут в отдельном слое над холстом: браузер набирает текст
    // лучше нас, а каллиграфия и печать остаются нарисованными.
    const scroll = document.createElement('div');
    scroll.className = 'splash-scroll';
    scroll.innerHTML = `
      <h1 class="splash-title">Усадьба Безмятежности</h1>
      <button class="splash-enter" type="button">войти в сад</button>`;
    this.el.appendChild(scroll);
    this.scroll = scroll;

    if (APP_VERSION) {
      const mark = document.createElement('div');
      mark.className = 'splash-mark';
      mark.textContent = `v${APP_VERSION}`;
      this.el.appendChild(mark);
    }

    const enter = scroll.querySelector<HTMLButtonElement>('.splash-enter')!;
    enter.addEventListener('click', (e) => {
      e.stopPropagation();
      this.enter();
    });
    this.el.addEventListener('click', () => this.enter());
    window.addEventListener('keydown', this.onKey);
    window.addEventListener('resize', this.onResize);
    window.addEventListener('orientationchange', this.onResize);
    window.visualViewport?.addEventListener('resize', this.onResize);
    document.addEventListener('visibilitychange', this.onVisibility);

    // Каллиграфия ждёт шрифт: пока его нет, знаки писались бы запасными.
    // Сэмплом передаём сами иероглифы — иначе браузер привезёт только
    // латинский подсет шрифта и знаки останутся чужими.
    const fonts = document.fonts;
    if (fonts?.load) {
      Promise.all([
        fonts.load('300 48px "Noto Serif JP"', '静かな庭'),
        fonts.load('600 32px "Noto Serif JP"', '静'),
      ])
        .then(() => fonts.ready)
        .then(() => this.art.reloadFonts())
        .catch(() => {
          /* шрифт не доехал — останутся запасные с засечками */
        });
    }
  }

  /** Поставить заставку на экран и начать дышать. */
  mount(parent: HTMLElement): void {
    parent.appendChild(this.el);
    this.needSize = true;
    this.born = performance.now();
    this.raf = requestAnimationFrame(this.frame);
  }

  private onResize = (): void => {
    this.needSize = true;
  };

  private onVisibility = (): void => {
    if (document.hidden) {
      cancelAnimationFrame(this.raf);
      this.raf = 0;
    } else if (!this.raf && !this.opened) {
      this.raf = requestAnimationFrame(this.frame);
    }
  };

  private onKey = (e: KeyboardEvent): void => {
    if (this.opened) return;
    if (e.key === 'Enter' || e.key === ' ' || e.key === 'Escape') {
      e.preventDefault();
      this.enter();
    }
  };

  private applySize(): void {
    const w = Math.max(1, this.el.clientWidth || window.innerWidth);
    const h = Math.max(1, this.el.clientHeight || window.innerHeight);
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.art.resize(w, h, dpr);
    this.canvas.width = Math.round(w * dpr);
    this.canvas.height = Math.round(h * dpr);

    // Слова встают по тому же месту листа, где лежит мазок: числа берутся
    // из одной формулы с кистью, поэтому надпись не может «съехать».
    const lay = this.art.layout;
    const s = this.el.style;
    s.setProperty('--sx', `${lay.x}px`);
    s.setProperty('--sy', `${lay.y}px`);
    s.setProperty('--sw', `${lay.w}px`);
    s.setProperty('--sh', `${lay.h}px`);
    s.setProperty('--title', String(SCROLL_TEXT.title));
    s.setProperty('--enter', String(SCROLL_TEXT.enter));
  }

  private frame = (now: number): void => {
    this.raf = 0;
    if (this.needSize) {
      this.needSize = false;
      this.applySize();
    }
    if (document.hidden) return;

    // Вход играем один раз: мягко, но не так долго, чтобы ждать.
    const t = (now - this.born) / ENTER_MS;
    const frame: StartFrame = {
      time: now,
      ink: this.reduced ? 1 : Math.min(1, Math.max(0, t)),
      hour: this.opts.hour(),
      motes: !this.reduced,
      motion: !this.reduced,
    };
    this.art.render(this.ctx, frame);

    // Пока лист не отдан саду — продолжаем дышать.
    if (!this.opened) this.raf = requestAnimationFrame(this.frame);
  };

  /** Игрок вошёл в сад. */
  private enter(): void {
    if (this.opened) return;
    this.opened = true;
    this.el.classList.add('hide');
    this.scroll.setAttribute('aria-hidden', 'true');
    window.removeEventListener('keydown', this.onKey);
    window.removeEventListener('resize', this.onResize);
    window.removeEventListener('orientationchange', this.onResize);
    window.visualViewport?.removeEventListener('resize', this.onResize);
    document.removeEventListener('visibilitychange', this.onVisibility);
    // Сад за заставкой живой: пока лист поднимается, камера уже двигается.
    this.opts.onEnter();
    setTimeout(() => {
      cancelAnimationFrame(this.raf);
      this.raf = 0;
      this.el.remove();
    }, LEAVE_MS);
  }
}
