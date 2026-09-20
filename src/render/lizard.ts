/** A long tapering tail, four splayed articulated legs and a low glossy skink body. */
import type { Lizard } from '../world/lizards';
import { lizardCoat, lizardPose } from '../world/lizards';
import { hash2 } from '../core/rng';
import type { Atmosphere, RGB } from '../world/palette';
import { shade } from '../world/palette';
import { pigment, oval, shape, stroke, limb } from './animalBrush';
import { softShadow, type Ctx } from './paint';
const COATS: { body: RGB; tail: RGB; stripe: RGB }[] = [
  { body: { r: 145, g: 111, b: 69 }, tail: { r: 123, g: 96, b: 62 }, stripe: { r: 209, g: 180, b: 115 } },
  { body: { r: 178, g: 150, b: 104 }, tail: { r: 154, g: 129, b: 89 }, stripe: { r: 228, g: 205, b: 154 } },
  { body: { r: 117, g: 126, b: 81 }, tail: { r: 100, g: 110, b: 73 }, stripe: { r: 195, g: 185, b: 123 } },
  { body: { r: 66, g: 60, b: 48 }, tail: { r: 59, g: 133, b: 184 }, stripe: { r: 229, g: 196, b: 96 } },
];
export function drawLizard(ctx: Ctx, a: Lizard, x: number, y: number, atm: Atmosphere, time: number): void {
  if (a.alpha <= 0.005) return;
  const coat = COATS[lizardCoat(a.seed)],
    pose = lizardPose(a, time),
    body = pigment(coat.body, atm),
    dark = pigment(shade(coat.body, 0.63), atm),
    cream = pigment(coat.stripe, atm),
    ink = pigment({ r: 39, g: 35, b: 29 }, atm);
  ctx.save();
  ctx.globalAlpha *= a.alpha;
  ctx.translate(x, y);
  softShadow(ctx, 0, 0, 14, 3, atm.shadowTint, atm.shadowAmount * 0.7);
  ctx.scale(a.facing, 1);
  ctx.translate(pose.strike * 2.5, -2.6 - pose.breath);
  // Tail is curved geometry, not a rigid stick pivoting at its root.
  shape(ctx, pigment(coat.tail, atm), () => {
    ctx.moveTo(-6, -1.8);
    ctx.bezierCurveTo(-13, -2.3, -19, pose.tail - 2, -29, pose.tail + 2.5);
    ctx.bezierCurveTo(-20, pose.tail - 0.2, -14, pose.tail + 3.4, -6, 2.2);
  });
  stroke(ctx, pigment(coat.stripe, atm, 0.5), 0.5, () => {
    ctx.moveTo(-7, -0.5);
    ctx.bezierCurveTo(-14, -1, -21, pose.tail, -27, pose.tail + 2);
  });
  const leg = (front: boolean, far: boolean) => {
    const hip = front ? 4.8 : -5.2,
      side = far ? -1 : 1;
    const phase = pose.gait + (front !== far ? Math.PI : 0);
    const reach = Math.cos(phase) * 2.6 * pose.motion,
      lift = Math.max(0, Math.sin(phase)) * 1.5 * pose.motion;
    const kneeX = hip + (front ? -2.5 : 2.5) + reach * 0.4,
      kneeY = side * 4;
    const footX = hip + (front ? 2 : -2.5) + reach,
      footY = side * (5.5 - lift);
    limb(ctx, far ? dark : body, 1.35, [
      [hip, side * 1.3],
      [kneeX, kneeY],
      [footX, footY],
    ]);
    for (let toe = 0; toe < 3; toe++)
      limb(ctx, far ? dark : body, 0.5, [
        [footX, footY],
        [footX + 1.7 + toe * 0.25, footY + (toe - 1) * 0.8],
      ]);
  };
  leg(false, true);
  leg(true, true);
  oval(ctx, 0, 0, 8.7, 3.1 + pose.breath, body);
  oval(ctx, 1, -0.9, 6.5, 1.35, pigment(shade(coat.body, 1.2), atm, 0.45));
  // Two flank lines plus the dorsal glint suggest the five-lined juvenile without noisy scales.
  for (const side of [-1, 1])
    stroke(ctx, cream, lizardCoat(a.seed) === 3 ? 0.7 : 0.5, () => {
      ctx.moveTo(-7, side * 1.65);
      ctx.quadraticCurveTo(0, side * 2.1, 7, side * 1.25);
    });
  stroke(ctx, pigment(coat.stripe, atm, 0.7), 0.45, () => {
    ctx.moveTo(-6, -0.2);
    ctx.lineTo(7, -0.4);
  });
  for (let i = 0; i < 9; i++)
    oval(ctx, -5 + hash2(i, a.seed, 811) * 11, (hash2(i, a.seed, 821) - 0.5) * 3, 0.38, 0.2, dark);
  leg(false, false);
  leg(true, false);
  ctx.save();
  ctx.translate(7.5, -0.45);
  ctx.rotate(pose.head);
  shape(ctx, body, () => {
    ctx.moveTo(-2, -2.2);
    ctx.quadraticCurveTo(2, -3, 5.8, -0.5);
    ctx.quadraticCurveTo(5.8, 1.2, 1, 2);
    ctx.lineTo(-2, 1.5);
  });
  stroke(ctx, dark, 0.45, () => {
    ctx.moveTo(1, 1.2);
    ctx.lineTo(5.1, 0.7 + pose.strike * 0.8);
  });
  oval(ctx, 2, -1.4, 0.8, pose.blink ? 0.15 : 0.65, ink);
  if (!pose.blink) oval(ctx, 2.2, -1.6, 0.2, 0.2, pigment({ r: 240, g: 233, b: 202 }, atm));
  oval(ctx, 4.8, -0.1, 0.21, 0.21, ink);
  if (pose.tongue || pose.strike > 0.7)
    stroke(ctx, pigment({ r: 171, g: 108, b: 112 }, atm), 0.45, () => {
      ctx.moveTo(5.5, 0.3);
      ctx.lineTo(8.4, 0.5);
      ctx.lineTo(9, 0.1);
      ctx.moveTo(8.4, 0.5);
      ctx.lineTo(9, 0.9);
    });
  ctx.restore();
  ctx.restore();
}
