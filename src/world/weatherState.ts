/**
 * Погода как состояние мира: ясно, дождь, гроза, туман, снегопад.
 * Меняется сама, редко и плавно — резкие перемены разрушили бы покой.
 */

import { clamp01, lerp, makeRng } from '../core/rng';
import { SeasonId, TimeState } from '../core/clock';

export type WeatherKind = 'auto' | 'clear' | 'rain' | 'storm' | 'fog' | 'snow';

export const WEATHER_NAMES: Record<WeatherKind, string> = {
  auto: 'Сама',
  clear: 'Ясно',
  rain: 'Дождь',
  storm: 'Гроза',
  fog: 'Туман',
  snow: 'Снегопад',
};

export type ActiveWeather = Exclude<WeatherKind, 'auto'>;

export interface WeatherState {
  kind: ActiveWeather;
  /** 0..1 — насколько погода «набрала силу». Переходы плавные. */
  intensity: number;
  /** Сила дождя 0..1 — для частиц и звука. */
  rain: number;
  /** Плотность тумана 0..1. */
  fog: number;
  /** Плотность снегопада 0..1. */
  snow: number;
  /** Затянутость неба тучами 0..1 — гасит солнце. */
  overcast: number;
  /** Вспышка молнии 0..1, гаснет за доли секунды. */
  flash: number;
  /** Мокрые поверхности 0..1 — блеск остаётся после дождя. */
  wetness: number;
}

const rnd = makeRng(777);

export class WeatherSystem {
  /** Что выбрано в панели: 'auto' — погода живёт сама. */
  forced: WeatherKind = 'auto';
  /** Текущая реальная погода. */
  current: ActiveWeather = 'clear';
  private target: ActiveWeather = 'clear';
  private timer = 240_000;
  private flashTimer = 0;
  private thunderPending = 0;

  state: WeatherState = {
    kind: 'clear',
    intensity: 0,
    rain: 0,
    fog: 0,
    snow: 0,
    overcast: 0,
    flash: 0,
    wetness: 0,
  };

  /** Обратный вызов для грома — звук ставится позже вспышки. */
  onThunder: ((distance: number) => void) | null = null;
  onLightning: (() => void) | null = null;

  force(kind: WeatherKind): void {
    this.forced = kind;
    if (kind !== 'auto') {
      this.target = kind;
      this.timer = Number.POSITIVE_INFINITY;
    } else {
      this.timer = 20_000;
    }
  }

  /** Какая погода уместна в этом сезоне. */
  private roll(season: SeasonId): ActiveWeather {
    // Непогода — редкий гость: чем реже, тем ценнее
    const r = rnd();
    if (season === 'winter') {
      if (r < 0.8) return 'clear';
      if (r < 0.94) return 'snow';
      return 'fog';
    }
    if (season === 'summer') {
      if (r < 0.82) return 'clear';
      if (r < 0.93) return 'rain';
      if (r < 0.97) return 'storm';
      return 'fog';
    }
    if (season === 'autumn') {
      if (r < 0.8) return 'clear';
      if (r < 0.92) return 'rain';
      if (r < 0.98) return 'fog';
      return 'storm';
    }
    // весна
    if (r < 0.82) return 'clear';
    if (r < 0.94) return 'rain';
    return 'fog';
  }

  update(dt: number, t: TimeState): void {
    // --- Выбор новой погоды ---
    if (this.forced === 'auto') {
      this.timer -= dt;
      if (this.timer <= 0) {
        // Ясная погода держится дольше — сад по умолчанию спокоен
        this.target = this.roll(t.season);
        // Ясень держится подолгу, непогода приходит ненадолго и памятью
        this.timer = this.target === 'clear' ? 480_000 + rnd() * 480_000 : 40_000 + rnd() * 50_000;
      }
    }

    // --- Плавный переход к цели ---
    const s = this.state;
    const speed = dt / 9000; // ~9 секунд на полную смену
    const towards = (v: number, to: number) => clamp01(v + Math.sign(to - v) * Math.min(Math.abs(to - v), speed));

    const wantRain = this.target === 'rain' ? 0.72 : this.target === 'storm' ? 1 : 0;
    const wantSnow = this.target === 'snow' ? 1 : 0;
    const wantFog = this.target === 'fog' ? 1 : this.target === 'rain' ? 0.22 : this.target === 'storm' ? 0.3 : 0;
    const wantOvercast =
      this.target === 'storm'
        ? 1
        : this.target === 'rain'
          ? 0.75
          : this.target === 'snow'
            ? 0.6
            : this.target === 'fog'
              ? 0.35
              : 0;

    s.rain = towards(s.rain, wantRain);
    s.snow = towards(s.snow, wantSnow);
    s.fog = towards(s.fog, wantFog);
    s.overcast = towards(s.overcast, wantOvercast);

    // Мокрые поверхности: быстро намокают, медленно сохнут
    if (s.rain > 0.05) s.wetness = clamp01(s.wetness + dt / 6000);
    else s.wetness = clamp01(s.wetness - dt / 40000);

    s.intensity = Math.max(s.rain, s.snow, s.fog);
    this.current = this.target;
    s.kind = this.target;

    // --- Молнии в грозу ---
    s.flash = Math.max(0, s.flash - dt / 170);
    if (this.target === 'storm' && s.rain > 0.5) {
      this.flashTimer -= dt;
      if (this.flashTimer <= 0) {
        this.flashTimer = 5000 + rnd() * 14000;
        s.flash = 1;
        const distance = 0.2 + rnd() * 0.8;
        this.thunderPending = distance * 4200; // звук отстаёт от света
        this.onLightning?.();
      }
    }
    if (this.thunderPending > 0) {
      this.thunderPending -= dt;
      if (this.thunderPending <= 0) {
        this.onThunder?.(clamp01(rnd()));
        this.thunderPending = 0;
      }
    }
  }

  /** Насколько погода глушит солнечный свет. */
  lightDamp(): number {
    return lerp(1, 0.52, this.state.overcast);
  }
}

export { clamp01 };
