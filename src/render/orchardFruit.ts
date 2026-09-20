/** One fruit painter for branches, falling fruit and weathered windfalls. */
import { type FruitTree } from '../world/orchard';
import { hash2 } from '../core/rng';
import { css, mix, shade, type RGB, type Atmosphere } from '../world/palette';
import { blobPath, type Ctx } from './paint';
const RIPE: Record<FruitTree, RGB> = {
  ume: { r: 211, g: 187, b: 81 },
  nashi: { r: 209, g: 165, b: 80 },
  peach: { r: 237, g: 150, b: 119 },
  yuzu: { r: 244, g: 199, b: 41 },
};
export function paintOrchardFruit(
  ctx: Ctx,
  type: FruitTree,
  x: number,
  y: number,
  r: number,
  ripe: number,
  age: number,
  atm: Atmosphere,
  seed: number,
): void {
  const lit = (c: RGB) => shade(mix(c, atm.lightTint, atm.lightAmount), atm.exposure);
  const base = mix(mix({ r: 122, g: 153, b: 73 }, RIPE[type], ripe), { r: 110, g: 80, b: 54 }, age * 0.8);
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(1 - age * 0.25, 1 - age * 0.42);
  ctx.fillStyle = css(lit(shade(base, 0.69)), 0.3);
  ctx.beginPath();
  ctx.ellipse(0.7, r * 0.7, r * 0.85, r * 0.32, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = css(lit(base));
  ctx.beginPath();
  if (type === 'peach') {
    ctx.moveTo(0, -r * 0.67);
    ctx.bezierCurveTo(-r * 0.9, -r * 1.18, -r * 1.35, r * 0.2, 0, r);
    ctx.bezierCurveTo(r * 1.35, r * 0.2, r * 0.9, -r * 1.18, 0, -r * 0.67);
  } else if (type === 'yuzu') blobPath(ctx, 0, 0, r, r * 0.9, seed, 0.095, 11);
  else ctx.ellipse(0, 0, r, r * (type === 'nashi' ? 0.92 : 0.95), 0, 0, Math.PI * 2);
  ctx.fill();
  if (type === 'peach') {
    ctx.fillStyle = css(lit({ r: 206, g: 77, b: 100 }), ripe * 0.32 * (1 - age));
    ctx.beginPath();
    ctx.ellipse(r * 0.35, 0, r * 0.5, r * 0.62, -0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = css(lit({ r: 162, g: 86, b: 76 }), 0.5);
    ctx.lineWidth = 0.55;
    ctx.beginPath();
    ctx.moveTo(0, -r * 0.62);
    ctx.quadraticCurveTo(-r * 0.24, r * 0.1, 0, r * 0.78);
    ctx.stroke();
  }
  ctx.fillStyle = css(lit(mix(base, { r: 255, g: 248, b: 187 }, 0.55)), 0.7 * (1 - age));
  ctx.beginPath();
  ctx.ellipse(-r * 0.27, -r * 0.29, r * 0.3, r * 0.17, -0.5, 0, Math.PI * 2);
  ctx.fill();
  if (type === 'nashi' || type === 'yuzu') {
    ctx.fillStyle = css(lit(shade(base, 0.65)), 0.6);
    for (let i = 0; i < 9; i++) {
      const a = hash2(i, seed, 1931) * Math.PI * 2,
        rr = Math.sqrt(hash2(i, seed, 1933)) * r * 0.78;
      ctx.beginPath();
      ctx.ellipse(Math.cos(a) * rr, Math.sin(a) * rr, 0.32, 0.23, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.strokeStyle = css(lit({ r: 102, g: 101, b: 53 }));
  ctx.lineWidth = 0.75;
  ctx.beginPath();
  ctx.moveTo(0, -r * 0.83);
  ctx.lineTo(0.6, -r - 1.3);
  ctx.stroke();
  if (type === 'yuzu') {
    ctx.fillStyle = css(lit({ r: 82, g: 111, b: 48 }));
    ctx.beginPath();
    ctx.ellipse(0, -r * 0.85, 1.6, 0.6, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}
