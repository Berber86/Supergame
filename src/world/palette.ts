import { crownAnchorBlend } from './phenology';
/** Акварельная палитра: цвет мира зависит от сезона и от времени суток. */

import { SeasonId, TimeState, seasonBlend } from '../core/clock';
import { clamp01, lerp } from '../core/rng';

export interface RGB {
  r: number;
  g: number;
  b: number;
}

export function rgb(r: number, g: number, b: number): RGB {
  return { r, g, b };
}

export function css(c: RGB, a = 1): string {
  return `rgba(${Math.round(clamp01(c.r / 255) * 255)},${Math.round(clamp01(c.g / 255) * 255)},${Math.round(
    clamp01(c.b / 255) * 255,
  )},${a})`;
}

export function mix(a: RGB, b: RGB, t: number): RGB {
  return { r: lerp(a.r, b.r, t), g: lerp(a.g, b.g, t), b: lerp(a.b, b.b, t) };
}

export function shade(c: RGB, k: number): RGB {
  return { r: c.r * k, g: c.g * k, b: c.b * k };
}

export function tint(c: RGB, to: RGB, t: number): RGB {
  return mix(c, to, t);
}

export interface SeasonPalette {
  grass: RGB;
  grassDeep: RGB;
  moss: RGB;
  foliage: RGB;
  foliageDeep: RGB;
  blossom: RGB;
  water: RGB;
  waterDeep: RGB;
  soil: RGB;
  stone: RGB;
  sky: [RGB, RGB];
  accent: RGB;
}

export const SEASON_PALETTES: Record<SeasonId, SeasonPalette> = {
  spring: {
    grass: rgb(163, 196, 126),
    grassDeep: rgb(122, 162, 96),
    moss: rgb(126, 168, 104),
    foliage: rgb(134, 178, 108),
    foliageDeep: rgb(96, 140, 88),
    blossom: rgb(247, 205, 216),
    water: rgb(150, 197, 205),
    waterDeep: rgb(96, 148, 166),
    soil: rgb(176, 148, 116),
    stone: rgb(186, 184, 176),
    sky: [rgb(205, 226, 226), rgb(238, 233, 214)],
    accent: rgb(238, 166, 184),
  },
  summer: {
    grass: rgb(139, 180, 106),
    grassDeep: rgb(96, 142, 86),
    moss: rgb(106, 152, 92),
    foliage: rgb(104, 154, 94),
    foliageDeep: rgb(66, 112, 76),
    blossom: rgb(233, 238, 206),
    water: rgb(128, 184, 194),
    waterDeep: rgb(70, 130, 152),
    soil: rgb(168, 140, 108),
    stone: rgb(178, 176, 168),
    sky: [rgb(178, 214, 224), rgb(232, 234, 206)],
    accent: rgb(232, 214, 130),
  },
  autumn: {
    grass: rgb(186, 176, 116),
    grassDeep: rgb(150, 138, 92),
    moss: rgb(140, 148, 96),
    foliage: rgb(212, 142, 78),
    foliageDeep: rgb(172, 94, 62),
    blossom: rgb(226, 154, 104),
    water: rgb(142, 174, 180),
    waterDeep: rgb(92, 130, 146),
    soil: rgb(160, 128, 98),
    stone: rgb(182, 174, 162),
    sky: [rgb(216, 210, 196), rgb(240, 222, 190)],
    accent: rgb(214, 118, 74),
  },
  winter: {
    grass: rgb(174, 178, 154),
    grassDeep: rgb(139, 151, 134),
    moss: rgb(168, 182, 172),
    foliage: rgb(160, 170, 168),
    foliageDeep: rgb(122, 136, 140),
    blossom: rgb(246, 246, 248),
    water: rgb(176, 198, 208),
    waterDeep: rgb(118, 148, 168),
    soil: rgb(164, 150, 140),
    stone: rgb(196, 196, 196),
    sky: [rgb(214, 222, 230), rgb(236, 234, 232)],
    accent: rgb(198, 214, 226),
  },
};

function mixPalette(a: SeasonPalette, b: SeasonPalette, t: number): SeasonPalette {
  return {
    grass: mix(a.grass, b.grass, t),
    grassDeep: mix(a.grassDeep, b.grassDeep, t),
    moss: mix(a.moss, b.moss, t),
    foliage: mix(a.foliage, b.foliage, t),
    foliageDeep: mix(a.foliageDeep, b.foliageDeep, t),
    blossom: mix(a.blossom, b.blossom, t),
    water: mix(a.water, b.water, t),
    waterDeep: mix(a.waterDeep, b.waterDeep, t),
    soil: mix(a.soil, b.soil, t),
    stone: mix(a.stone, b.stone, t),
    sky: [mix(a.sky[0], b.sky[0], t), mix(a.sky[1], b.sky[1], t)],
    accent: mix(a.accent, b.accent, t),
  };
}

/** Освещение: ночь — холодный индиго, золотой час — тёплая охра, полдень — мягкий свет. */
export interface Atmosphere {
  /** Receiver-local material moisture, never changes the flower clock or global lighting. */
  materialWetness?: number;
  palette: SeasonPalette;
  /** Цвет, которым тонируется всё под светом. */
  lightTint: RGB;
  lightAmount: number;
  /** Цвет теней. */
  shadowTint: RGB;
  shadowAmount: number;
  /** Общая яркость сцены. */
  exposure: number;
  /** Цвет неба/фона. */
  skyTop: RGB;
  skyBottom: RGB;
  /** Насколько видны фонари/светлячки. */
  lampGlow: number;
  fireflies: number;
  /** Направление и мягкость теней. */
  sunDir: { x: number; y: number };
  /** Высота солнца над горизонтом 0..1: 0 на рассвете/закате, 1 в полдень.
   *  От неё зависят длина и плотность теней — низкое солнце тянет длинные
   *  мягкие, полуденное даёт короткие и плотные. */
  sunElev: number;
  season: SeasonId;
  /** Затянутость неба 0..1. */
  overcast: number;
  /** Сила золотого часа (дубль из TimeState — удобно для рендера). */
  golden: number;
  time: TimeState;
}

const NIGHT_TINT = rgb(74, 92, 148);
const DUSK_TINT = rgb(238, 172, 116);
const DAY_TINT = rgb(255, 250, 232);

const NIGHT_SKY: [RGB, RGB] = [rgb(30, 42, 74), rgb(58, 74, 108)];
const DUSK_SKY: [RGB, RGB] = [rgb(146, 132, 168), rgb(244, 178, 128)];

export function buildAtmosphere(t: TimeState, overcast = 0): Atmosphere {
  const blend = seasonBlend(t);
  const annual = crownAnchorBlend(t.now),
    anchors: SeasonId[] = ['winter', 'spring', 'summer', 'autumn'];
  const palette = mixPalette(SEASON_PALETTES[anchors[annual.from]], SEASON_PALETTES[anchors[annual.to]], annual.amount);

  const d = t.daylight;
  // Тучи глушат золотой час и приглушают дневной свет
  const g = t.golden * (1 - overcast * 0.85);

  // Тон света
  let lightTint = mix(NIGHT_TINT, DAY_TINT, clamp01(d * 1.15));
  lightTint = mix(lightTint, DUSK_TINT, g * 0.75);
  lightTint = mix(lightTint, rgb(178, 190, 204), overcast * 0.55);

  // Небо на закате: тёплый градиент от охры у горизонта до сиреневого
  // зенита. Слабое подмешивание (0.6) не пробивалось через дневную палитру —
  // золотой час не читался в небе, хотя тон света уже был тёплым.
  let skyTop = mix(mix(NIGHT_SKY[0], palette.sky[0], clamp01(d * 1.2)), DUSK_SKY[0], g * 0.85);
  let skyBottom = mix(mix(NIGHT_SKY[1], palette.sky[1], clamp01(d * 1.2)), DUSK_SKY[1], g * 0.95);
  // Самая кромка горизонта в золотой час вспыхивает янтарным.
  skyBottom = mix(skyBottom, { r: 248, g: 166, b: 108 }, g * 0.4);
  if (overcast > 0) {
    // грозовое небо: свинцовые, слегка сизые тона
    const stormTop = mix(rgb(96, 104, 116), rgb(48, 54, 66), 1 - clamp01(d * 1.3));
    const stormBot = mix(rgb(138, 144, 152), rgb(62, 68, 80), 1 - clamp01(d * 1.3));
    skyTop = mix(skyTop, stormTop, overcast);
    skyBottom = mix(skyBottom, stormBot, overcast);
  }

  let exposure = lerp(0.42, 1.0, clamp01(d * 1.05)) + g * 0.05;
  exposure *= lerp(1, 0.62, overcast);

  // Тень чуть глубже и холоднее днём: светлый синеватый тон давал
  // «дыхание», а не тень — на залитой светом траве её не было видно.
  const shadowTint = mix(rgb(52, 62, 104), rgb(90, 98, 136), d);
  // Плотность тени растёт к полудню: низкое солнце рассеивается по небу
  // и тени светлее (но длиннее — длина считается в shadowUnder), а в
  // полдень короткая тень лежит плотным пятном — это «вес» объектов.
  // Диапазон поднят: прежний максимум (≈0.32) на залитой светом траве
  // читался лёгким серым дыханием, а не тенью — объекты «летали».
  const sunT = clamp01((t.dayT - 0.22) / 0.58);
  const densK = lerp(0.78, 1.3, Math.sin(sunT * Math.PI));
  const shadowAmount = (lerp(0.15, 0.42, d) + g * 0.07) * lerp(1, 0.36, overcast) * densK;

  // Солнце ходит по небу: диск на экране движется слева направо
  // (scene-steps.sunScreenPos), а тени бегут в противоположную сторону —
  // утром вправо, к полудню собираются под объект, к закату влево.
  // Раньше азимут шёл по косинусу от dayT, и утром тень едва отклонялась,
  // а в полдень заметно кренилась влево, против собственного солнца.
  const sunDir = { x: 1 - 2 * sunT, y: 0.3 + (1 - Math.sin(sunT * Math.PI)) * 0.25 };
  // Высота солнца: та же дуга, что у диска на небе (scene-steps.drawSky).
  const sunElev = Math.sin(sunT * Math.PI);

  return {
    palette,
    lightTint,
    lightAmount: lerp(0.28, 0.065, d) + g * 0.2,
    shadowTint,
    shadowAmount,
    exposure,
    skyTop,
    skyBottom,
    lampGlow: clamp01(Math.max(1 - d * 1.35, overcast * 0.55 * (1 - d * 0.5))),
    fireflies: clamp01(1 - d * 1.5) * (blend.from === 'summer' || blend.from === 'spring' ? 1 : 0.25),
    sunDir,
    sunElev,
    season: blend.from,
    overcast,
    golden: g,
    time: t,
  };
}

/** Применить освещение к «локальному» цвету материала. */
export function lit(c: RGB, atm: Atmosphere, extra = 0): RGB {
  let out = mix(c, atm.lightTint, atm.lightAmount);
  out = shade(out, atm.exposure + extra);
  return out;
}
