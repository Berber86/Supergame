import { Atmosphere, RGB, css, mix, shade } from '../world/palette';
import type { Ripple } from '../world/residents';
import type { Ctx } from './paint';
export { drawFrog } from './pondAnimals';
export { drawDragonfly } from './insects';
function litc(c: RGB, atm: Atmosphere, boost = 0): RGB {
  return shade(mix(c, atm.lightTint, atm.lightAmount), atm.exposure + boost);
}

// ---------------- Круги на воде ----------------

/** Всплеск лягушки или след купания: круг расходится и тает. */
export function drawRipple(ctx: Ctx, r: Ripple, x: number, y: number, atm: Atmosphere): void {
  // Отрицательный возраст (кривая метка кадра) дал бы отрицательный радиус,
  // а ellipse() с таким бросает IndexSizeError и кладёт весь кадр.
  if (r.age <= 0) return;
  const k = Math.min(1, r.age / 1600);
  const a = (1 - k) * 0.5;
  if (a <= 0.02) return;
  const rad = (r.big ? 3 : 2) + k * (r.big ? 15 : 8);
  const foam = litc({ r: 240, g: 248, b: 248 }, atm, 0.06);
  ctx.save();
  ctx.strokeStyle = css(foam, a);
  ctx.lineWidth = r.big ? 1.2 : 0.9;
  ctx.beginPath();
  ctx.ellipse(x, y, rad, rad * 0.5, 0, 0, Math.PI * 2);
  ctx.stroke();
  if (r.big) {
    ctx.strokeStyle = css(foam, a * 0.6);
    ctx.beginPath();
    ctx.ellipse(x, y, rad * 0.55, rad * 0.27, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}
