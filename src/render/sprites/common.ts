/** Общая утварь рисовальщиков: контекст, освещение, тени. */

import { Atmosphere, RGB, mix, shade } from '../../world/palette';
import { PlacedObject } from '../../world/types';
import { Ctx, softShadow } from '../paint';

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
}

export type Drawer = (d: DrawCtx) => void;

export const WHITE: RGB = { r: 255, g: 255, b: 255 };

export function litc(c: RGB, atm: Atmosphere, boost = 0): RGB {
  return shade(mix(c, atm.lightTint, atm.lightAmount), atm.exposure + boost);
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
  // длинная тень по солнцу
  const off = atm.sunDir.x * rx * 0.55;
  softShadow(ctx, d.x + off, d.y + ry * 0.2, rx * 1.15, ry * 0.95, atm.shadowTint, atm.shadowAmount * 1.4 * strength);
  // плотное контактное пятно — объект «врастает» в землю
  softShadow(ctx, d.x, d.y, rx * 0.5, ry * 0.42, atm.shadowTint, atm.shadowAmount * 2.1 * strength);
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
