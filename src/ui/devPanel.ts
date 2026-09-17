/**
 * Панель разработчика: переключение времени суток, сезона и погоды.
 * Нужна на время создания игры — открывается клавишей T.
 */

import { SEASON_NAMES, SEASONS } from '../core/clock';
import { TimeControl } from '../core/timeControl';
import { WeatherKind, WeatherSystem, WEATHER_NAMES } from '../world/weatherState';
import { svgIcon } from './icons';

export interface DevHooks {
  onChange(): void;
}

const HOUR_PRESETS: [string, number][] = [
  ['Рассвет', 5.8],
  ['Утро', 9],
  ['Полдень', 13],
  ['Закат', 19.2],
  ['Ночь', 23],
];

export class DevPanel {
  private root: HTMLElement;
  private tc: TimeControl;
  private weather: WeatherSystem;
  private hooks: DevHooks;
  private els: Record<string, HTMLElement> = {};
  open = false;

  constructor(parent: HTMLElement, tc: TimeControl, weather: WeatherSystem, hooks: DevHooks) {
    this.tc = tc;
    this.weather = weather;
    this.hooks = hooks;
    this.root = document.createElement('div');
    this.root.className = 'dev-panel paper';
    parent.appendChild(this.root);
    this.build();
    this.setOpen(tc.state.active);
  }

  private build(): void {
    this.root.innerHTML = `
      <div class="dev-head">
        <span class="dev-title">Мастерская времени</span>
        <span class="dev-close">${svgIcon('close', 15)}</span>
      </div>

      <label class="dev-toggle">
        <input type="checkbox" class="dev-active" />
        <span>Взять время под контроль</span>
      </label>

      <div class="dev-body">
        <div class="dev-row">
          <span class="dev-label">Час</span>
          <span class="dev-value dev-hour-val">11:00</span>
        </div>
        <input type="range" class="dev-hour" min="0" max="23.983" step="0.0167" value="11" />
        <div class="dev-presets"></div>

        <div class="dev-row" style="margin-top:14px">
          <span class="dev-label">Сезон</span>
          <span class="dev-value dev-season-val">Весна</span>
        </div>
        <div class="dev-seasons"></div>

        <div class="dev-row" style="margin-top:14px">
          <span class="dev-label">Погода</span>
          <span class="dev-value dev-weather-val">Ясно</span>
        </div>
        <div class="dev-weather"></div>

        <div class="dev-row" style="margin-top:14px">
          <span class="dev-label">Ход времени</span>
          <span class="dev-value dev-speed-val">реальный</span>
        </div>
        <div class="dev-speeds"></div>

        <div class="dev-hint">T — скрыть · стрелки ←→ час · Shift+←→ сезон</div>
      </div>`;

    this.els.active = this.root.querySelector('.dev-active')!;
    this.els.hour = this.root.querySelector('.dev-hour')!;
    this.els.hourVal = this.root.querySelector('.dev-hour-val')!;
    this.els.seasonVal = this.root.querySelector('.dev-season-val')!;
    this.els.weatherVal = this.root.querySelector('.dev-weather-val')!;
    this.els.speedVal = this.root.querySelector('.dev-speed-val')!;
    this.els.body = this.root.querySelector('.dev-body')!;

    this.root.querySelector('.dev-close')!.addEventListener('click', () => this.setOpen(false));

    (this.els.active as HTMLInputElement).addEventListener('change', (e) => {
      const on = (e.target as HTMLInputElement).checked;
      if (on) this.tc.enable();
      else this.tc.disable();
      this.refresh();
      this.hooks.onChange();
    });

    this.els.hour.addEventListener('input', (e) => {
      const v = Number((e.target as HTMLInputElement).value);
      if (!this.tc.state.active) this.tc.enable(false);
      this.tc.setHour(v);
      this.refresh();
      this.hooks.onChange();
    });

    // Пресеты часа
    const presets = this.root.querySelector('.dev-presets')!;
    for (const [name, h] of HOUR_PRESETS) {
      const b = document.createElement('button');
      b.className = 'dev-chip';
      b.textContent = name;
      b.addEventListener('click', () => {
        if (!this.tc.state.active) this.tc.enable(false);
        this.tc.setHour(h);
        this.refresh();
        this.hooks.onChange();
      });
      presets.appendChild(b);
    }

    // Сезоны
    const seasons = this.root.querySelector('.dev-seasons')!;
    SEASONS.forEach((s, i) => {
      const b = document.createElement('button');
      b.className = 'dev-chip season';
      b.dataset.season = s;
      b.textContent = SEASON_NAMES[s];
      b.addEventListener('click', () => {
        if (!this.tc.state.active) this.tc.enable(false);
        this.tc.setSeason(i);
        this.refresh();
        this.hooks.onChange();
      });
      seasons.appendChild(b);
    });

    // Погода
    const weather = this.root.querySelector('.dev-weather')!;
    const kinds: WeatherKind[] = ['auto', 'clear', 'rain', 'storm', 'fog', 'snow'];
    for (const k of kinds) {
      const b = document.createElement('button');
      b.className = 'dev-chip weather';
      b.dataset.weather = k;
      b.textContent = WEATHER_NAMES[k];
      b.addEventListener('click', () => {
        this.weather.force(k);
        this.refresh();
        this.hooks.onChange();
      });
      weather.appendChild(b);
    }

    // Скорость
    const speeds = this.root.querySelector('.dev-speeds')!;
    const opts: [string, number][] = [
      ['стоп', 0],
      ['×1', 1],
      ['×60', 60],
      ['×600', 600],
      ['×3000', 3000],
    ];
    for (const [name, mult] of opts) {
      const b = document.createElement('button');
      b.className = 'dev-chip speed';
      b.dataset.speed = String(mult);
      b.textContent = name;
      b.addEventListener('click', () => {
        if (!this.tc.state.active) this.tc.enable();
        this.tc.setSpeed(mult);
        this.refresh();
        this.hooks.onChange();
      });
      speeds.appendChild(b);
    }

    this.refresh();
  }

  setOpen(v: boolean): void {
    this.open = v;
    this.root.classList.toggle('show', v);
  }

  toggle(): void {
    this.setOpen(!this.open);
  }

  /** Обновляет подписи и подсветку активных кнопок. */
  refresh(): void {
    const st = this.tc.state;
    (this.els.active as HTMLInputElement).checked = st.active;
    this.els.body.classList.toggle('disabled', !st.active);

    const h = st.active ? this.tc.displayHour : new Date().getHours() + new Date().getMinutes() / 60;
    (this.els.hour as HTMLInputElement).value = String(h);
    const hh = Math.floor(h);
    const mm = Math.floor((h - hh) * 60);
    this.els.hourVal.textContent = `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;

    const season = st.active ? SEASONS[st.seasonIndex] : this.tc.compute().season;
    this.els.seasonVal.textContent = SEASON_NAMES[season];
    this.root.querySelectorAll<HTMLElement>('.dev-chip.season').forEach((b) => {
      b.classList.toggle('on', b.dataset.season === season);
    });

    const wk = this.weather.forced;
    this.els.weatherVal.textContent =
      WEATHER_NAMES[wk] + (wk === 'auto' ? ` · ${WEATHER_NAMES[this.weather.current]}` : '');
    this.root.querySelectorAll<HTMLElement>('.dev-chip.weather').forEach((b) => {
      b.classList.toggle('on', b.dataset.weather === wk);
    });

    this.els.speedVal.textContent =
      st.speed === 0 ? 'остановлен' : st.speed === 1 ? 'реальный' : `ускорен ×${st.speed}`;
    this.root.querySelectorAll<HTMLElement>('.dev-chip.speed').forEach((b) => {
      b.classList.toggle('on', Number(b.dataset.speed) === st.speed);
    });
  }

  /** Раз в кадр — чтобы ползунок ехал при ускоренном времени. */
  tick(): void {
    if (!this.open) return;
    if (this.tc.state.active && this.tc.state.speed !== 1) this.refresh();
  }
}
