/**
 * Следы котов в снегу: маленькие отпечатки темнее снега, с парой пальцев.
 * Остывают медленно — живут три часа, а со снегом уходят разом.
 */

import type { Footprint } from '../world/life';
import type { World } from '../world/world';
import type { Atmosphere } from '../world/palette';
import { mix, shade, css } from '../world/palette';
import { winterYear } from '../world/annualEnvironment';
import { isoToScreen } from '../core/iso';
import { Ctx } from './paint';
import { TAU } from './animalBrush';

/** Сколько живут отпечатки, мс абсолютного времени. */
export const FOOTPRINT_LIFE = 3 * 3600_000;

export function drawFootprints(ctx: Ctx, world: World, footprints: Footprint[], atm: Atmosphere): void {
  if (!footprints.length) return;
  const snow = winterYear(atm.time.now).snow;
  if (snow < 0.15) return;
  const col = shade(mix({ r: 212, g: 224, b: 238 }, atm.lightTint, atm.lightAmount * 0.55), 0.7);
  ctx.save();
  for (const fp of footprints) {
    const age = atm.time.now - fp.born;
    const a = (1 - age / FOOTPRINT_LIFE) * Math.min(1, snow * 1.4) * 0.5;
    if (a <= 0.01) continue;
    const tile = world.at(Math.floor(fp.x), Math.floor(fp.y));
    const p = isoToScreen(fp.x, fp.y, tile ? tile.level : 0);
    const sx = Math.cos(fp.dir);
    const sy = Math.sin(fp.dir);
    const ang = Math.atan2((sx + sy) * 0.5, sx - sy);
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(ang);
    ctx.scale(1, 0.56);
    ctx.fillStyle = css(col, a);
    ctx.beginPath();
    ctx.ellipse(0, 0, 3, 2, 0, 0, TAU);
    ctx.fill();
    // Пальцы: три коротких штриха вперёд по шагу
    for (let i = -1; i <= 1; i++) {
      ctx.beginPath();
      ctx.ellipse(3.3, i * 1.45, 1.05, 0.75, 0, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }
  ctx.restore();
}
