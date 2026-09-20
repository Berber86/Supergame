import { GRAPHICS, isGraphicsQuality, type GraphicsQuality } from '../render/graphics';
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
  quality: GraphicsQuality;
  /** Необязательное поле порывов с инерцией крон; без него — лёгкий простой ветер. */
  smartWind: boolean;
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
  quality: 'balanced',
  smartWind: false,
  particles: true,
  motion: true,
  contrast: false,
  uiScale: 1,
};

export function loadView(): ViewSettings {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULTS };
    const v: unknown = JSON.parse(raw);
    if (!v || typeof v !== 'object' || Array.isArray(v)) return { ...DEFAULTS };
    const obj = v as Record<string, unknown>;
    return {
      quality: isGraphicsQuality(obj.quality) ? obj.quality : DEFAULTS.quality,
      smartWind: typeof obj.smartWind === 'boolean' ? obj.smartWind : DEFAULTS.smartWind,
      particles: typeof obj.particles === 'boolean' ? obj.particles : DEFAULTS.particles,
      motion: typeof obj.motion === 'boolean' ? obj.motion : DEFAULTS.motion,
      contrast: typeof obj.contrast === 'boolean' ? obj.contrast : DEFAULTS.contrast,
      uiScale: typeof obj.uiScale === 'number' && SCALES.includes(obj.uiScale) ? obj.uiScale : DEFAULTS.uiScale,
    };
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
      <div class="sp-graphics">
        <div class="sp-label" id="graphics-label">Графика</div>
        <div class="sp-quality" role="group" aria-labelledby="graphics-label">
          ${Object.entries(GRAPHICS)
            .map(
              ([key, p]) =>
                `<button type="button" data-quality="${key}" aria-pressed="${v.quality === key}" class="${v.quality === key ? 'on' : ''}">${p.name}</button>`,
            )
            .join('')}
        </div>
        <div class="sp-quality-hint">${GRAPHICS[v.quality].description} Все деревья, животные и сезоны остаются.</div>
      </div>
      <div class="sp-row" data-act="particles">
        <div class="sp-label">Лепестки и светлячки<em>частицы в воздухе</em></div>
        <div class="sp-switch ${v.particles ? 'on' : ''}"><i></i></div>
      </div>
      <div class="sp-row" data-act="motion">
        <div class="sp-label">Плавные движения<em>покачивание, наплывы камеры</em></div>
        <div class="sp-switch ${v.motion ? 'on' : ''}"><i></i></div>
      </div>
      <button type="button" class="sp-row sp-toggle" data-act="smartWind" role="switch"
        aria-label="Умный ветер" aria-checked="${v.smartWind}">
        <span class="sp-label">Умный ветер<em>волны порывов и изгибы крон</em></span>
        <span class="sp-switch ${v.smartWind ? 'on' : ''}" aria-hidden="true"><i></i></span>
      </button>
      <div class="sp-wind-hint">Без умного ветра остаётся лёгкое покачивание. По умолчанию выключен.</div>
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

    this.root.querySelectorAll<HTMLButtonElement>('[data-quality]').forEach((button) =>
      button.addEventListener('click', () => {
        const quality = button.dataset.quality;
        if (!isGraphicsQuality(quality)) return;
        this.set('quality', quality);
        this.root.querySelector<HTMLButtonElement>(`[data-quality="${quality}"]`)?.focus();
      }),
    );
    this.root.querySelectorAll<HTMLElement>('.sp-row').forEach((row) => {
      const act = row.dataset.act;
      if (act === 'scale') return;
      row.addEventListener('click', () => {
        if (act === 'particles') this.set('particles', !v.particles);
        else if (act === 'motion') this.set('motion', !v.motion);
        else if (act === 'smartWind') {
          this.set('smartWind', !v.smartWind);
          this.root.querySelector<HTMLButtonElement>('[data-act="smartWind"]')?.focus();
        } else if (act === 'contrast') this.set('contrast', !v.contrast);
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
