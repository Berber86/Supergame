/**
 * Заставка: первый кадр и единственный жест, открывающий звук.
 *
 * Здесь нет меню и нет выбора: одна картина, одно имя, одна дверь.
 * Картина рисуется кодом (splashArt.ts) из настоящих часов и настоящей
 * погоды мира — заставка встречает игрока тем же временем, что и сад.
 * Надписи и кнопка — обычный DOM поверх холста: текст остаётся текстом
 * (доступность, масштаб интерфейса, выбор шрифта системой).
 */

import './splash.css';
import { SEASON_NAMES, SEASON_POEM, TimeState, partOfDay } from '../core/clock';
import { Atmosphere } from '../world/palette';
import { ViewSettings } from './settings';
import { SplashArt } from './splashArt';

export interface SplashHooks {
  onEnter(): void;
}

export interface SplashMoment {
  time: TimeState;
  atm: Atmosphere;
}

export class Splash {
  private root: HTMLElement;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private art: SplashArt;
  private raf = 0;
  private openedAt = 0;
  private lastNow = 0;
  private hiding = false;
  private dpr = 1;

  constructor(
    parent: HTMLElement,
    view: ViewSettings,
    private provide: () => SplashMoment,
    private hooks: SplashHooks,
  ) {
    const root = document.createElement('div');
    root.className = 'splash';
    root.innerHTML = `
      <canvas class="splash-art" aria-hidden="true"></canvas>
      <div class="splash-titles">
        <h1 lang="ja">静かな庭</h1>
        <div class="splash-sub">Усадьба Безмятежности</div>
        <div class="splash-season"></div>
      </div>
      <div class="splash-enter" role="button" tabindex="0">войти в сад</div>`;
    parent.appendChild(root);
    this.root = root;
    this.canvas = root.querySelector('canvas')!;
    this.ctx = this.canvas.getContext('2d')!;

    // Время сада равно времени игрока: заставка называет час и сезон словами.
    const m = provide();
    // Ночью лист тёмный: надписи и дверь меняют тон вместе с тушью.
    root.classList.toggle('night', m.time.daylight < 0.45);
    root.querySelector('.splash-season')!.textContent =
      `${SEASON_NAMES[m.time.season].toLowerCase()} · ${partOfDay(m.time)} · ${SEASON_POEM[m.time.season]}`;

    this.art = new SplashArt({ particles: view.particles, motion: view.motion });
    this.resize();
    this.openedAt = performance.now();
    this.lastNow = this.openedAt;
    this.raf = requestAnimationFrame(this.step);

    const enter = root.querySelector<HTMLElement>('.splash-enter')!;
    const go = (): void => {
      if (this.hiding) return;
      this.hide();
      this.hooks.onEnter();
    };
    enter.addEventListener('click', go);
    enter.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        go();
      }
    });
    window.addEventListener('resize', () => this.resize());
  }

  get isOpen(): boolean {
    return this.root.isConnected && !this.hiding;
  }

  private resize(): void {
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = this.canvas.clientWidth || window.innerWidth;
    const h = this.canvas.clientHeight || window.innerHeight;
    this.canvas.width = Math.max(2, Math.round(w * this.dpr));
    this.canvas.height = Math.max(2, Math.round(h * this.dpr));
  }

  private step = (now: number): void => {
    if (this.hiding) return;
    const dtMs = Math.min(64, now - this.lastNow);
    this.lastNow = now;
    const intro = Math.min(1, (now - this.openedAt) / 1900);
    // кривая «кисть ведёт рука»: разгон в начале, доводка в конце
    const p = 1 - Math.pow(1 - intro, 2.2);
    const m = this.provide();
    this.art.render(this.ctx, this.canvas.width, this.canvas.height, m.time, m.atm, p, dtMs);
    this.raf = requestAnimationFrame(this.step);
  };

  /** Растворить бумагу и уйти. Картина гаснет медленнее, чем появляется. */
  hide(): void {
    if (this.hiding) return;
    this.hiding = true;
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.root.classList.add('hide');
    const ms = document.documentElement.classList.contains('no-motion') ? 60 : 1400;
    window.setTimeout(() => this.root.remove(), ms);
  }
}
