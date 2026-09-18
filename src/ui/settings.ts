/**
 * Настройки вида.
 *
 * Сад должен быть доступен и тому, кого укачивает от частиц, и тому, кому
 * нужен крупный шрифт или больше контраста. Всё здесь — про то, как игрок
 * смотрит, а не про содержимое сада, поэтому хранится отдельным ключом
 * и общее для всех усадеб.
 */

const KEY = 'usadba.view.v1';

export interface ViewSettings {
  /** Лепестки, светлячки, бабочки, дождь. */
  particles: boolean;
  /** Плавные движения камеры и покачивания. */
  motion: boolean;
  /** Усиленный контраст интерфейса поверх сада. */
  contrast: boolean;
  /** Масштаб интерфейса: 0.85 · 1 · 1.2 · 1.4. */
  uiScale: number;
}

const DEFAULTS: ViewSettings = {
  particles: true,
  motion: true,
  contrast: false,
  uiScale: 1,
};

export function loadView(): ViewSettings {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULTS };
    return { ...DEFAULTS, ...(JSON.parse(raw) as Partial<ViewSettings>) };
  } catch {
    return { ...DEFAULTS };
  }
}

export function saveView(v: ViewSettings): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(v));
  } catch {
    /* приватный режим — переживём */
  }
}

/** Применяет настройки к странице: масштаб и контраст живут в CSS. */
export function applyView(v: ViewSettings): void {
  const root = document.documentElement;
  root.style.setProperty('--ui-scale', String(v.uiScale));
  root.classList.toggle('high-contrast', v.contrast);
  root.classList.toggle('no-motion', !v.motion);
}

const SCALES = [0.85, 1, 1.2, 1.4];
const SCALE_NAMES = ['мелкий', 'обычный', 'крупный', 'очень крупный'];

export class SettingsPanel {
  private root: HTMLElement;
  private open = false;

  constructor(
    parent: HTMLElement,
    private view: ViewSettings,
    private onChange: (v: ViewSettings) => void,
    private sound?: { get(): boolean; toggle(): void },
  ) {
    this.root = document.createElement('div');
    this.root.className = 'settings-panel wood';
    this.root.style.display = 'none';
    parent.appendChild(this.root);
    this.render();
  }

  get isOpen(): boolean {
    return this.open;
  }

  setOpen(v: boolean): void {
    this.open = v;
    this.root.style.display = v ? 'block' : 'none';
    if (v) this.render();
  }

  toggle(): void {
    this.setOpen(!this.open);
  }

  /** Перерисовать, пока панель открыта: звук переключили извне. */
  sync(): void {
    if (this.open) this.render();
  }

  private set<K extends keyof ViewSettings>(key: K, value: ViewSettings[K]): void {
    this.view[key] = value;
    saveView(this.view);
    applyView(this.view);
    this.onChange(this.view);
    this.render();
  }

  private render(): void {
    const v = this.view;
    const si = SCALES.indexOf(v.uiScale) < 0 ? 1 : SCALES.indexOf(v.uiScale);
    this.root.innerHTML = `
      <div class="sp-head">Как смотреть</div>
      <div class="sp-row" data-act="particles">
        <div class="sp-label">Лепестки и светлячки<em>частицы в воздухе</em></div>
        <div class="sp-switch ${v.particles ? 'on' : ''}"><i></i></div>
      </div>
      <div class="sp-row" data-act="motion">
        <div class="sp-label">Плавные движения<em>покачивание, наплывы камеры</em></div>
        <div class="sp-switch ${v.motion ? 'on' : ''}"><i></i></div>
      </div>
      <div class="sp-row" data-act="contrast">
        <div class="sp-label">Чёткий интерфейс<em>плотнее фон под надписями</em></div>
        <div class="sp-switch ${v.contrast ? 'on' : ''}"><i></i></div>
      </div>
      ${
        this.sound
          ? `<div class="sp-row" data-act="sound">
        <div class="sp-label">Звук сада<em>вода, птицы, ветер, колокольцы</em></div>
        <div class="sp-switch ${this.sound.get() ? 'on' : ''}"><i></i></div>
      </div>`
          : ''
      }
      <div class="sp-row" data-act="scale">
        <div class="sp-label">Размер интерфейса<em>${SCALE_NAMES[si]}</em></div>
        <div class="sp-steps">${SCALES.map(
          (_, i) => `<span class="sp-step ${i === si ? 'on' : ''}" data-i="${i}">${['S', 'M', 'L', 'XL'][i]}</span>`,
        ).join('')}</div>
      </div>
      <div class="sp-note">Настройки общие для всех усадеб.</div>
    `;

    this.root.querySelectorAll<HTMLElement>('.sp-row').forEach((row) => {
      const act = row.dataset.act;
      if (act === 'scale') return;
      row.addEventListener('click', () => {
        if (act === 'particles') this.set('particles', !v.particles);
        else if (act === 'motion') this.set('motion', !v.motion);
        else if (act === 'contrast') this.set('contrast', !v.contrast);
        else if (act === 'sound') {
          this.sound?.toggle();
          this.render();
        }
      });
    });
    this.root.querySelectorAll<HTMLElement>('.sp-step').forEach((step) => {
      step.addEventListener('click', (e) => {
        e.stopPropagation();
        this.set('uiScale', SCALES[Number(step.dataset.i)]);
      });
    });
  }
}
