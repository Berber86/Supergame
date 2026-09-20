/** The garden's front door. Only metadata and decorative paper are alive until a garden is chosen. */
import { SCROLL_TEXT, StartArt, type StartFrame } from './startArt';
import { APP_VERSION } from '../version';
import type { GardenMeta, GardenCreateOptions } from '../world/gardens';
import { PRESETS } from '../world/presets';

export type StartGardenOptions = Pick<GardenCreateOptions, 'mode' | 'preset'>;
export interface StartScreenOptions {
  /** Wall-clock light, independent of any unopened garden's clock. */
  hour: () => number;
  gardens: readonly GardenMeta[];
  activeId: string;
  /** False keeps the chooser open; no fall-through to a different garden. */
  onOpen: (id: string) => boolean;
  onCreate: (name: string, options: StartGardenOptions) => boolean;
  /** Called once, only after the selected garden is ready. Unlocks the app and audio. */
  onEnter: () => void;
  motion: boolean;
}

const CHOICES: { id: string; name: string; hint: string; options: StartGardenOptions }[] = [
  {
    id: 'classic',
    name: 'Вольный сад',
    hint: 'Усадьба, пруд и холм. Стройте свободно, без ожидания действий.',
    options: { mode: 'free' },
  },
  {
    id: 'grow',
    name: 'Растущий сад',
    hint: 'Начните с клочка земли 2×2. Новое действие — раз в 10 минут; сад постепенно выходит из тумана.',
    options: { mode: 'grow' },
  },
  ...PRESETS.map((p) => ({ id: `preset:${p.id}`, name: p.name, hint: p.hint, options: { preset: p.id } })),
];
const ENTER_MS = 2100;
const LEAVE_MS = 1400;

export class StartScreen {
  readonly el: HTMLDivElement;
  private brand: HTMLElement;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private art = new StartArt();
  private raf = 0;
  private born = performance.now();
  private lastArtFrame = -Infinity;
  private needSize = true;
  private opened = false;
  private reduced: boolean;

  constructor(private opts: StartScreenOptions) {
    this.reduced = !opts.motion || matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.el = document.createElement('div');
    this.el.className = 'splash';
    this.el.setAttribute('role', 'main');
    this.el.setAttribute('aria-label', 'Вход в усадьбу');
    this.el.innerHTML = `
      <div class="splash-brand">
        <canvas class="splash-canvas" aria-hidden="true"></canvas>
        <div class="splash-scroll">
          <h1 class="splash-title">Усадьба Безмятежности</h1>
          <p class="splash-caption">У каждого сада — свой ритм</p>
        </div>
      </div>
      <div class="splash-door">
        <header class="splash-mobile-heading"><span aria-hidden="true" class="splash-small-enso"></span><h1>Усадьба<br>Безмятежности</h1></header>
        <section class="splash-chooser paper" aria-labelledby="splash-heading">
          <p class="splash-eyebrow">ПОРОГ УСАДЬБЫ</p>
          <h2 id="splash-heading">Выберите сад</h2>
          <p class="splash-intro">Вернитесь в свою усадьбу или начните новую.</p>
          <p class="splash-error" role="alert" hidden></p>
          <div class="splash-existing">
            <div class="splash-gardens" role="list" aria-label="Сохранённые сады"></div>
            <p class="splash-empty" hidden>Здесь пока нет садов. Создайте первый — он останется ждать вас в этом браузере.</p>
            <button class="splash-new" type="button"><span aria-hidden="true">+</span> Создать сад</button>
          </div>
          <form class="splash-create" hidden>
            <button type="button" class="splash-back">← К списку садов</button>
            <label>Название сада <span class="splash-optional">необязательно</span>
              <input class="splash-name" name="name" maxlength="40" autocomplete="off" placeholder="Название подберём сами">
            </label>
            <label>С чего начать
              <select class="splash-template" name="template" aria-describedby="splash-template-hint"></select>
            </label>
            <p id="splash-template-hint" class="splash-template-hint"></p>
            <button class="splash-create-submit" type="submit">Создать и войти <span aria-hidden="true">→</span></button>
          </form>
          <footer class="splash-note"><span class="splash-idle-dot" aria-hidden="true"></span>Симуляция начнётся после входа.<br>Сады хранятся в этом браузере.</footer>
        </section>
      </div>`;
    this.brand = this.el.querySelector('.splash-brand')!;
    this.canvas = this.el.querySelector('.splash-canvas')!;
    this.ctx = this.canvas.getContext('2d')!;

    const list = this.el.querySelector('.splash-gardens')!;
    const gardens = [...opts.gardens].sort(
      (a, b) => Number(b.id === opts.activeId) - Number(a.id === opts.activeId) || b.saved - a.saved,
    );
    for (const garden of gardens) {
      const row = document.createElement('div');
      row.setAttribute('role', 'listitem');
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `splash-garden${garden.id === opts.activeId ? ' recent' : ''}`;
      button.dataset.garden = garden.id;
      button.innerHTML = `<span class="sg-info"><span class="sg-name"></span><span class="sg-meta"></span></span><span class="sg-open" aria-hidden="true">Войти →</span>`;
      button.querySelector('.sg-name')!.textContent = garden.name;
      const date = new Date(garden.saved).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
      button.querySelector('.sg-meta')!.textContent =
        `${garden.id === opts.activeId ? 'Последний вход · ' : ''}${date} · ${garden.objects} предметов`;
      button.addEventListener('click', () =>
        this.enter(
          () => opts.onOpen(garden.id),
          'Не удалось открыть этот сад. Данные не перезаписаны; попробуйте выбрать другой сад.',
        ),
      );
      row.appendChild(button);
      list.appendChild(row);
    }
    this.el.querySelector<HTMLElement>('.splash-empty')!.hidden = gardens.length > 0;
    this.el.querySelector('.splash-new')!.addEventListener('click', () => this.showCreate(true));
    this.el.querySelector('.splash-back')!.addEventListener('click', () => this.showCreate(false));
    const select = this.el.querySelector<HTMLSelectElement>('.splash-template')!;
    for (const choice of CHOICES) {
      const option = document.createElement('option');
      option.value = choice.id;
      option.textContent = choice.name;
      select.appendChild(option);
    }
    const describe = () => {
      this.el.querySelector('#splash-template-hint')!.textContent = CHOICES.find((c) => c.id === select.value)!.hint;
    };
    select.addEventListener('change', describe);
    describe();
    this.el.querySelector('form')!.addEventListener('submit', (e) => {
      e.preventDefault();
      const choice = CHOICES.find((c) => c.id === select.value);
      if (!choice) return;
      const name = this.el.querySelector<HTMLInputElement>('.splash-name')!.value.trim().slice(0, 40);
      this.enter(() => opts.onCreate(name, choice.options), 'Не удалось создать сад. Попробуйте ещё раз.');
    });
    // Native buttons/inputs handle Enter and Space themselves. Neither the backdrop nor Escape enters a garden.
    this.el.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !this.el.querySelector<HTMLFormElement>('form')!.hidden) {
        e.preventDefault();
        this.showCreate(false);
      }
      e.stopPropagation();
    });
    if (APP_VERSION) {
      const mark = document.createElement('div');
      mark.className = 'splash-mark';
      mark.textContent = `v${APP_VERSION}`;
      this.el.appendChild(mark);
    }
    window.addEventListener('resize', this.onResize);
    window.addEventListener('orientationchange', this.onResize);
    window.visualViewport?.addEventListener('resize', this.onResize);
    document.addEventListener('visibilitychange', this.onVisibility);
    const fonts = document.fonts;
    if (fonts?.load) {
      Promise.all([fonts.load('300 48px "Noto Serif JP"', '静かな庭'), fonts.load('600 32px "Noto Serif JP"', '静')])
        .then(() => fonts.ready)
        .then(() => {
          this.art.reloadFonts();
          this.requestFrame();
        })
        .catch(() => {
          /* system serif fallback */
        });
    }
  }

  mount(parent: HTMLElement): void {
    parent.appendChild(this.el);
    this.born = performance.now();
    this.requestFrame();
    this.el.querySelector<HTMLButtonElement>('.splash-garden, .splash-new')?.focus({ preventScroll: true });
  }
  private showCreate(show: boolean): void {
    if (this.opened) return;
    this.el.querySelector<HTMLElement>('.splash-existing')!.hidden = show;
    this.el.querySelector<HTMLFormElement>('form')!.hidden = !show;
    this.el.querySelector('#splash-heading')!.textContent = show ? 'Новая усадьба' : 'Выберите сад';
    this.el.querySelector('.splash-intro')!.textContent = show
      ? 'Выберите, с чего начнётся ваш новый сад.'
      : 'Вернитесь в свою усадьбу или начните новую.';
    this.el.querySelector<HTMLElement>('.splash-error')!.hidden = true;
    const focus = this.el.querySelector<HTMLElement>(show ? '.splash-name' : '.splash-new');
    focus?.focus({ preventScroll: true });
  }
  private requestFrame(): void {
    if (!this.raf && !this.opened && !document.hidden) this.raf = requestAnimationFrame(this.frame);
  }
  private onResize = (): void => {
    this.needSize = true;
    this.requestFrame();
  };
  private onVisibility = (): void => {
    if (document.hidden) {
      cancelAnimationFrame(this.raf);
      this.raf = 0;
    } else this.requestFrame();
  };
  private applySize(): void {
    const w = Math.max(1, this.brand.clientWidth || window.innerWidth * 0.48);
    const h = Math.max(1, this.brand.clientHeight || window.innerHeight * 0.88);
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.art.resize(w, h, dpr);
    this.canvas.width = Math.round(w * dpr);
    this.canvas.height = Math.round(h * dpr);
    const lay = this.art.layout,
      style = this.brand.style;
    style.setProperty('--sx', `${lay.x}px`);
    style.setProperty('--sy', `${lay.y}px`);
    style.setProperty('--sw', `${lay.w}px`);
    style.setProperty('--sh', `${lay.h}px`);
    style.setProperty('--title', String(SCROLL_TEXT.title));
    style.setProperty('--enter', String(SCROLL_TEXT.enter));
  }
  private frame = (now: number): void => {
    this.raf = 0;
    if (this.opened || document.hidden) return;
    // The compact chooser has no hidden animated canvas. Desktop artwork is decorative, never a garden.
    if (window.innerWidth < 900 || window.innerHeight < 540) return;
    const resize = this.needSize;
    if (resize) {
      this.needSize = false;
      this.applySize();
    }
    if (resize || now - this.lastArtFrame >= 1000 / 30 || this.reduced) {
      this.lastArtFrame = now;
      const frame: StartFrame = {
        time: now,
        ink: this.reduced ? 1 : Math.min(1, Math.max(0, (now - this.born) / ENTER_MS)),
        hour: this.opts.hour(),
        motes: !this.reduced,
        motion: !this.reduced,
      };
      this.art.render(this.ctx, frame);
    }
    if (!this.reduced) this.requestFrame();
  };
  private enter(prepare: () => boolean, failure: string): void {
    if (this.opened) return;
    let ready = false;
    try {
      ready = prepare();
    } catch {
      /* keep the chooser and its form available */
    }
    if (!ready) {
      const error = this.el.querySelector<HTMLElement>('.splash-error')!;
      error.textContent = failure;
      error.hidden = false;
      return;
    }
    this.opened = true;
    cancelAnimationFrame(this.raf);
    this.raf = 0;
    window.removeEventListener('resize', this.onResize);
    window.removeEventListener('orientationchange', this.onResize);
    window.visualViewport?.removeEventListener('resize', this.onResize);
    document.removeEventListener('visibilitychange', this.onVisibility);
    this.el.classList.add('hide');
    this.el.inert = true;
    this.el.setAttribute('aria-hidden', 'true');
    this.opts.onEnter();
    setTimeout(() => this.el.remove(), this.reduced ? 0 : LEAVE_MS);
  }
}
