/** Общая утварь рисовальщиков: контекст, освещение, тени. */

import { clamp01, hash1, lerp } from '../../core/rng';
import { Atmosphere, RGB, mix, shade } from '../../world/palette';
import { PlacedObject } from '../../world/types';
import { Ctx, softShadow } from '../paint';
import type { ReflectionWarp } from '../waterMotion';

export interface DrawCtx {
  ctx: Ctx;
  /** Экранная позиция «якоря» объекта (центр основания). */
  x: number;
  y: number;
  atm: Atmosphere;
  /** 0..1 стадия роста. */
  g: number;
  obj: PlacedObject;
  time: number;
  /** Ветер 0..1 — общая фаза покачивания. */
  wind: number;
  /** Прозрачность (для призрака при размещении). */
  alpha: number;
  /** Bridge-only world-height reflection; never a flipped screen-space bitmap. */
  reflection?: boolean;
  reflectionWarp?: ReflectionWarp;
}

export type Drawer = (d: DrawCtx) => void;

export const WHITE: RGB = { r: 255, g: 255, b: 255 };

export function litc(c: RGB, atm: Atmosphere, boost = 0): RGB {
  return shade(mix(c, atm.lightTint, atm.lightAmount), atm.exposure + boost);
}

/**
 * Детерминированное разнообразие по сиду — не меняется при входе в усадьбу.
 * Всё берётся из хешей сида, без Math.random.
 */

/** Зеркало: -1 или 1, по сиду — половина деревьев/камней смотрит в другую сторону. */
export function mirrorOf(seed: number): number {
  return hash1(seed, 13) > 0.5 ? -1 : 1;
}

/** Масштаб 0.88..1.12 — чуть крупнее/мельче, тоже по сиду. */
export function scaleJitterOf(seed: number): number {
  return 0.88 + hash1(seed, 29) * 0.24;
}

/** Поворот для камней/пней: -0.18..0.18 рад. */
export function rotJitterOf(seed: number): number {
  return (hash1(seed, 47) - 0.5) * 0.36;
}

/** Сдвиг оттенка кроны/камня: -1..1, для лёгкой тонировки. */
export function tintJitterOf(seed: number): number {
  return hash1(seed, 71) * 2 - 1;
}

/** Вариант формы 0..1 — для выбора ветвления, числа камней и т.д. */
export function variantOf(seed: number, salt = 0): number {
  return hash1(seed + salt * 997, 101);
}

/**
 * Когда включён кэш спрайтов, тень рисуется отдельно прямо на сцене.
 *
 * Тень кладётся режимом multiply — она умножается на землю под собой.
 * На прозрачном холсте кэша умножать не на что, и тень выходит иной,
 * чем при обычной отрисовке. Поэтому кэшируется только сам объект,
 * а тень остаётся на сцене, где под ней есть земля.
 */

let skipShadows = false;
/** Куда записать параметры тени вместо рисования — для режима «только тень». */

let shadowProbe: { rx: number; ry: number; strength: number } | null = null;

export function setSkipShadows(v: boolean): void {
  skipShadows = v;
}

export function shadowUnder(d: DrawCtx, rx: number, ry: number, strength = 1): void {
  // В режиме замера просто запоминаем размеры: их назначает сам
  // рисовальщик, и угадывать их таблицей снаружи — значит рисовать
  // другую тень, чем была.
  if (shadowProbe) {
    shadowProbe = { rx, ry, strength };
    return;
  }
  if (skipShadows) return;
  const { ctx, atm } = d;
  ctx.save();
  ctx.globalCompositeOperation = 'multiply';
  // Отбрасываемая тень: длина зависит от высоты солнца. На рассвете и
  // закате она тянется далеко в сторону от света, к полудню собирается
  // в короткое плотное пятно под объектом. Длинная тень рисуется не
  // одним расплывчатым эллипсом, а цепочкой пятен вдоль луча: так краска
  // не размазывается в дым и направление читается.
  const elev = clamp01(atm.sunElev);
  const lenK = 0.55 + (1 - elev) * 1.75;
  const dirX = atm.sunDir.x;
  const base = atm.shadowAmount * strength;
  if (elev < 0.6 && Math.abs(dirX) > 0.12) {
    const len = rx * lenK * 1.5;
    for (let i = 0; i < 3; i++) {
      const t = (i + 1) / 3;
      softShadow(
        ctx,
        d.x + dirX * len * t,
        d.y + ry * 0.2 + (1 - elev) * ry * 0.5 * t,
        rx * (0.85 - t * 0.35) * 1.35,
        ry * (0.95 - t * 0.3),
        atm.shadowTint,
        base * lerp(2.7, 1.85, elev) * (1 - t * 0.55),
      );
    }
  } else {
    softShadow(ctx, d.x + dirX * rx * lenK * 0.5, d.y + ry * 0.2, rx * 1.2, ry * 0.95, atm.shadowTint, base * 1.95);
  }
  // плотное контактное пятно — объект «врастает» в землю
  softShadow(ctx, d.x, d.y, rx * 0.5, ry * 0.42, atm.shadowTint, Math.min(atm.shadowAmount * 2.6, 1.2) * strength);
  ctx.restore();
}

/** Начало замера тени: следующий shadowUnder запишет размеры сюда, а не на холст. */
export function probeShadowBegin(): void {
  shadowProbe = { rx: 0, ry: 0, strength: 0 };
}

/** Конец замера тени: отдаёт размеры, если рисовальщик их назначил. */
export function probeShadowEnd(): { rx: number; ry: number; strength: number } | null {
  const s = shadowProbe && shadowProbe.rx > 0 ? shadowProbe : null;
  shadowProbe = null;
  return s;
}
