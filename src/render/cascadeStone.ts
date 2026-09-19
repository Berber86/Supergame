/** Rounded, weathered stone with watercolor grain (not a masonry block). */
import { blobPath, granulate, type Ctx } from './paint';
import { css, mix, shade, type RGB } from '../world/palette';
import { hash2 } from '../core/rng';
export function cascadeStone(
  ctx: Ctx,
  x: number,
  y: number,
  rx: number,
  ry: number,
  color: RGB,
  moss: RGB,
  seed: number,
): void {
  const wash = ctx.createLinearGradient(x, y - ry, x + rx * 0.4, y + ry);
  wash.addColorStop(0, css(shade(color, 1.13)));
  wash.addColorStop(0.55, css(color));
  wash.addColorStop(1, css(shade(color, 0.77)));
  ctx.fillStyle = wash;
  blobPath(ctx, x, y, rx, ry, seed, 0.28, 8);
  ctx.fill();
  ctx.strokeStyle = css(shade(color, 1.28), 0.3);
  ctx.lineWidth = 0.7;
  ctx.beginPath();
  ctx.moveTo(x - rx * 0.68, y - ry * 0.1);
  ctx.quadraticCurveTo(x - rx * 0.4, y - ry * 0.75, x + rx * 0.38, y - ry * 0.54);
  ctx.stroke();
  if (hash2(seed, 7, 337) > 0.4) {
    ctx.fillStyle = css(mix(moss, color, 0.35), 0.6);
    blobPath(ctx, x - rx * 0.28, y - ry * 0.48, rx * 0.6, ry * 0.27, seed + 3, 0.4, 7);
    ctx.fill();
  }
  granulate(ctx, x, y, rx * 0.75, ry * 0.7, shade(color, 0.62), seed, 7, 0.1);
}
