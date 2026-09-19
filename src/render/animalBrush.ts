/** Маленькие кисти для живых силуэтов; не хранят состояния анимации. */
import { Atmosphere, RGB, css, mix, shade } from '../world/palette';
import type { Ctx } from './paint';

export const TAU = Math.PI * 2;
export function pigment(c: RGB, atm: Atmosphere, alpha = 1): string {
  return css(shade(mix(c, atm.lightTint, atm.lightAmount), atm.exposure), alpha);
}
export function oval(ctx: Ctx, x: number, y: number, rx: number, ry: number, color: string, angle = 0): void {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, angle, 0, TAU);
  ctx.fill();
}
export function shape(ctx: Ctx, color: string, path: () => void): void {
  ctx.fillStyle = color;
  ctx.beginPath();
  path();
  ctx.closePath();
  ctx.fill();
}
export function stroke(ctx: Ctx, color: string, width: number, path: () => void): void {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  path();
  ctx.stroke();
}
export function limb(ctx: Ctx, color: string, width: number, points: number[][]): void {
  stroke(ctx, color, width, () => points.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))));
}
