import './animalGuide.css';
import { GUIDE_ANIMALS, GuideAnimal } from './animalGuideData';
import { buildAtmosphere } from '../world/palette';
import { computeTime } from '../core/clock';
import { svgIcon } from './icons';

/** A modal, independent animation viewer: no writes to the world or localStorage. */
export class AnimalGuide {
  private root = document.createElement('dialog');
  private animal = GUIDE_ANIMALS[0];
  private state = this.animal.animations[0];
  private elapsed = 0;
  private playing = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  private speed = 1;
  private facing = 1;
  private variant = 0;
  private sequence = false;
  private frame = 0;
  private last = 0;
  private opener: HTMLElement | null = null;
  private canvas: HTMLCanvasElement;
  private search: HTMLInputElement;
  private list: HTMLElement;
  private day = buildAtmosphere(computeTime(new Date(2026, 5, 15, 13).getTime()));
  private night = buildAtmosphere(computeTime(new Date(2026, 5, 15, 23).getTime()));

  constructor(parent: HTMLElement) {
    this.root.className = 'animal-guide';
    this.root.setAttribute('aria-labelledby', 'guide-title');
    this.root.innerHTML = `
      <header class="ag-header"><div class="ag-seal" aria-hidden="true">${svgIcon('book', 26)}</div><div><span class="ag-eyebrow">ПОЛЕВОЙ ДНЕВНИК УСАДЬБЫ</span><h1 id="guide-title">Энциклопедия животных</h1></div>
        <button class="ag-close" aria-label="Закрыть энциклопедию" title="Закрыть · Esc">${svgIcon('close', 20)}</button></header>
      <div class="ag-book">
        <aside class="ag-index"><label class="ag-search"><span>Найти жителя</span><input type="search" placeholder="Имя или вид…" aria-label="Поиск животного"></label><nav class="ag-list" aria-label="Страницы животных"></nav><div class="ag-index-note">Все жители открыты с первой страницы.<br>Для встречи не нужно ждать сезона.</div></aside>
        <article class="ag-page">
          <div class="ag-page-heading"><div><div class="ag-kicker"></div><h2></h2><div class="ag-latin" lang="la"></div></div><div class="ag-pagination"><button data-page="-1" aria-label="Предыдущее животное">←</button><span></span><button data-page="1" aria-label="Следующее животное">→</button></div></div>
          <div class="ag-stage"><span class="ag-stage-note">ЖИВАЯ ЗАРИСОВКА</span><canvas role="img"></canvas><span class="ag-stage-caption"></span><button class="ag-flip" aria-label="Повернуть животное" title="Повернуть животное">↔</button></div>
          <div class="ag-variants"><label>Облик <select aria-label="Вариант внешности"></select></label></div>
          <div class="ag-description"></div><div class="ag-habitat"><span>ГДЕ ВСТРЕТИТЬ</span><p></p></div>
          <section class="ag-motion" aria-label="Анимации животного"><div class="ag-motion-title"><h3>Движения и повадки</h3><span></span></div><div class="ag-animations"></div>
            <div class="ag-player"><button class="ag-play"></button><label class="ag-speed">Скорость <select aria-label="Скорость анимации"><option value="0.25">¼×</option><option value="0.5">½×</option><option value="1" selected>1×</option><option value="2">2×</option></select></label><label class="ag-sequence"><input type="checkbox"> Все подряд</label><button class="ag-restart" title="С начала" aria-label="Начать анимацию заново">↺</button></div>
            <input class="ag-timeline" type="range" min="0" max="1000" value="0" aria-label="Кадр анимации">
          </section>
          <footer class="ag-footnote">Те же модели и движения, что в саду · Масштаб увеличен для наблюдения</footer>
        </article>
      </div>`;
    parent.append(this.root);
    this.canvas = this.root.querySelector('canvas')!;
    this.search = this.root.querySelector('input[type="search"]')!;
    this.list = this.root.querySelector('.ag-list')!;
    this.root.querySelector('.ag-close')!.addEventListener('click', () => this.setOpen(false));
    this.root.addEventListener('cancel', (event) => {
      event.preventDefault();
      this.setOpen(false);
    });
    this.root.addEventListener('click', (event) => {
      if (event.target === this.root) this.setOpen(false);
    });
    // Native dialog handles focus trapping; prevent game shortcuts even while searching.
    this.root.addEventListener('keydown', (event) => {
      event.stopPropagation();
      if (event.key === 'Escape') {
        event.preventDefault();
        this.setOpen(false);
      }
    });
    this.search.addEventListener('input', () => this.renderIndex());
    this.root.querySelectorAll<HTMLButtonElement>('[data-page]').forEach((button) =>
      button.addEventListener('click', () => {
        const i = GUIDE_ANIMALS.indexOf(this.animal);
        this.selectAnimal(
          GUIDE_ANIMALS[(i + Number(button.dataset.page) + GUIDE_ANIMALS.length) % GUIDE_ANIMALS.length],
        );
      }),
    );
    this.root.querySelector('.ag-play')!.addEventListener('click', () => {
      this.playing = !this.playing;
      this.updatePlay();
    });
    this.root.querySelector('.ag-flip')!.addEventListener('click', () => {
      this.facing *= -1;
      this.draw();
    });
    this.root.querySelector('.ag-restart')!.addEventListener('click', () => {
      this.elapsed = 0;
      this.draw();
    });
    this.root.querySelector<HTMLSelectElement>('.ag-speed select')!.addEventListener('change', (e) => {
      this.speed = Number((e.target as HTMLSelectElement).value);
    });
    this.root.querySelector<HTMLInputElement>('.ag-sequence input')!.addEventListener('change', (e) => {
      this.sequence = (e.target as HTMLInputElement).checked;
    });
    this.root.querySelector<HTMLSelectElement>('.ag-variants select')!.addEventListener('change', (e) => {
      this.variant = Number((e.target as HTMLSelectElement).value);
      this.draw();
    });
    this.root.querySelector<HTMLInputElement>('.ag-timeline')!.addEventListener('input', (e) => {
      this.playing = false;
      this.elapsed = (Number((e.target as HTMLInputElement).value) / 1000) * (this.state.duration - 1);
      this.updatePlay();
      this.draw();
    });
    if (typeof ResizeObserver !== 'undefined') {
      new ResizeObserver(() => {
        if (this.isOpen) this.draw();
      }).observe(this.canvas);
    } else {
      window.addEventListener('resize', () => {
        if (this.isOpen) this.draw();
      });
    }
    this.renderPage();
  }

  get isOpen(): boolean {
    return this.root.open;
  }
  toggle(): void {
    this.setOpen(!this.isOpen);
  }
  setOpen(open: boolean): void {
    if (open === this.isOpen) return;
    if (open) {
      this.opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      this.root.showModal();
      this.root.querySelector<HTMLButtonElement>('.ag-close')!.focus();
      this.draw();
      this.last = performance.now();
      this.frame = requestAnimationFrame(this.tick);
    } else {
      cancelAnimationFrame(this.frame);
      this.frame = 0;
      this.root.close();
      this.opener?.focus();
    }
  }

  private tick = (now: number): void => {
    if (!this.isOpen) return;
    const dt = Math.min(Math.max(0, now - this.last), 80);
    this.last = now;
    if (!document.hidden && this.playing) {
      const previousCycle = Math.floor(this.elapsed / this.state.duration);
      this.elapsed += dt * this.speed;
      if (this.sequence && Math.floor(this.elapsed / this.state.duration) > previousCycle) {
        this.state =
          this.animal.animations[(this.animal.animations.indexOf(this.state) + 1) % this.animal.animations.length];
        this.elapsed = 0;
        this.updateAnimations();
      }
      this.draw();
    }
    this.frame = requestAnimationFrame(this.tick);
  };

  private selectAnimal(animal: GuideAnimal): void {
    this.animal = animal;
    this.state = animal.animations[0];
    this.elapsed = 0;
    this.variant = 0;
    this.renderPage();
    this.root.querySelector('.ag-page')!.scrollTop = 0;
  }

  private renderIndex(): void {
    const query = this.search.value.toLocaleLowerCase('ru').trim();
    const matches = GUIDE_ANIMALS.filter((a) =>
      `${a.name} ${a.latin} ${a.group}`.toLocaleLowerCase('ru').includes(query),
    );
    this.list.replaceChildren();
    for (const group of ['Звери', 'Птицы', 'У воды', 'Насекомые']) {
      const animals = matches.filter((a) => a.group === group);
      if (!animals.length) continue;
      const heading = document.createElement('h3');
      heading.textContent = group;
      this.list.append(heading);
      for (const animal of animals) {
        const button = document.createElement('button');
        button.textContent = animal.name;
        button.classList.toggle('active', animal === this.animal);
        if (animal === this.animal) button.setAttribute('aria-current', 'page');
        button.addEventListener('click', () => this.selectAnimal(animal));
        this.list.append(button);
      }
    }
    if (!matches.length) {
      const note = document.createElement('p');
      note.className = 'ag-empty';
      note.textContent = 'Такого жителя пока нет. Попробуйте другое имя.';
      this.list.append(note);
    }
  }

  private renderPage(): void {
    const a = this.animal;
    this.root.querySelector('h2')!.textContent = a.name;
    this.root.querySelector('.ag-kicker')!.textContent = a.group;
    this.root.querySelector('.ag-latin')!.textContent = a.latin;
    this.root.querySelector('.ag-pagination span')!.textContent =
      `${String(GUIDE_ANIMALS.indexOf(a) + 1).padStart(2, '0')} / ${GUIDE_ANIMALS.length}`;
    this.root.querySelector('.ag-description')!.textContent = a.description;
    this.root.querySelector('.ag-habitat p')!.textContent = a.habitat;
    this.root.querySelector('.ag-motion-title span')!.textContent = `${a.animations.length} анимаций`;
    const variants = this.root.querySelector<HTMLElement>('.ag-variants')!;
    variants.hidden = !a.variants;
    const select = variants.querySelector('select')!;
    select.replaceChildren(
      ...(a.variants ?? []).map((name, i) => {
        const option = document.createElement('option');
        option.textContent = name;
        option.value = String(i);
        return option;
      }),
    );
    const animations = this.root.querySelector('.ag-animations')!;
    animations.replaceChildren();
    a.animations.forEach((state) => {
      const button = document.createElement('button');
      button.textContent = state.name;
      button.dataset.state = state.id;
      button.addEventListener('click', () => {
        this.state = state;
        this.elapsed = 0;
        this.updateAnimations();
        this.draw();
      });
      animations.append(button);
    });
    this.renderIndex();
    this.updateAnimations();
    this.updatePlay();
    if (this.isOpen) this.draw();
  }

  private updateAnimations(): void {
    this.root.querySelectorAll<HTMLButtonElement>('[data-state]').forEach((b) => {
      const active = b.dataset.state === this.state.id;
      b.classList.toggle('active', active);
      b.setAttribute('aria-pressed', String(active));
    });
    this.root.querySelector('.ag-stage-caption')!.textContent = this.state.name;
    this.canvas.setAttribute('aria-label', `${this.animal.name}: ${this.state.name}`);
  }
  private updatePlay(): void {
    const button = this.root.querySelector<HTMLButtonElement>('.ag-play')!;
    button.textContent = this.playing ? 'Ⅱ Пауза' : '▷ Смотреть';
    button.setAttribute('aria-label', this.playing ? 'Приостановить анимацию' : 'Воспроизвести анимацию');
  }

  private draw(): void {
    const width = this.canvas.clientWidth;
    const height = this.canvas.clientHeight;
    if (!width || !height) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    if (this.canvas.width !== Math.round(width * dpr) || this.canvas.height !== Math.round(height * dpr)) {
      this.canvas.width = Math.round(width * dpr);
      this.canvas.height = Math.round(height * dpr);
    }
    const ctx = this.canvas.getContext('2d')!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);
    const a = this.animal;
    const water = a.water || this.state.id === 'swim';
    this.root.querySelector('.ag-stage')!.classList.toggle('night', !!a.night);
    const ground = ctx.createRadialGradient(width / 2, height * 0.76, 2, width / 2, height * 0.76, width * 0.43);
    ground.addColorStop(0, a.night ? '#99bc8020' : water ? '#91b9b64a' : '#9da77430');
    ground.addColorStop(1, '#c0c9a000');
    ctx.fillStyle = ground;
    ctx.fillRect(0, 0, width, height);
    ctx.strokeStyle = a.night ? '#a4bc8640' : water ? '#739b9640' : '#92977140';
    ctx.lineWidth = 0.8;
    const baseline = height * a.baseline;
    ctx.beginPath();
    ctx.ellipse(width / 2, baseline + 5, width * 0.27, water ? 15 : 4, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.save();
    ctx.translate(width / 2, baseline);
    const scale = a.scale * Math.min(width / 580, height / 300);
    ctx.scale(scale * this.facing, scale);
    // The simulation's hide state is mostly positional; illustrate the deeper water.
    if (a.id === 'koi' && this.state.id === 'hide') ctx.globalAlpha = 0.4 + Math.cos(this.elapsed * 0.001) * 0.15;
    a.draw(ctx, a.night ? this.night : this.day, this.state.id, this.elapsed, this.variant);
    ctx.restore();
    this.root.querySelector<HTMLInputElement>('.ag-timeline')!.value = String(
      ((this.elapsed % this.state.duration) / this.state.duration) * 1000,
    );
  }
}
