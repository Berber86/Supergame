/** A small naturalist study: plated head, satin scales, five-toed feet and a supple tapering tail. */
import type { Lizard } from '../world/lizards';
import { lizardCoat, lizardPose } from '../world/lizards';
import { hash2 } from '../core/rng';
import type { Atmosphere, RGB } from '../world/palette';
import { mix, shade } from '../world/palette';
import { pigment, oval, shape, stroke, limb } from './animalBrush';
import { softShadow, type Ctx } from './paint';

const COATS: { body: RGB; tail: RGB; stripe: RGB; belly: RGB }[] = [
  {
    body: { r: 153, g: 111, b: 67 },
    tail: { r: 125, g: 94, b: 64 },
    stripe: { r: 225, g: 193, b: 125 },
    belly: { r: 216, g: 197, b: 150 },
  },
  {
    body: { r: 182, g: 153, b: 108 },
    tail: { r: 155, g: 126, b: 89 },
    stripe: { r: 242, g: 220, b: 165 },
    belly: { r: 233, g: 217, b: 178 },
  },
  {
    body: { r: 115, g: 128, b: 82 },
    tail: { r: 88, g: 108, b: 77 },
    stripe: { r: 205, g: 198, b: 131 },
    belly: { r: 204, g: 205, b: 157 },
  },
  {
    body: { r: 63, g: 66, b: 52 },
    tail: { r: 38, g: 119, b: 166 },
    stripe: { r: 239, g: 207, b: 123 },
    belly: { r: 184, g: 181, b: 141 },
  },
];

export function drawLizard(ctx: Ctx, a: Lizard, x: number, y: number, atm: Atmosphere, time: number): void {
  if (a.alpha <= 0.005) return;
  const variant = lizardCoat(a.seed),
    coat = COATS[variant],
    p = lizardPose(a, time),
    body = pigment(coat.body, atm),
    dark = pigment(shade(coat.body, 0.55), atm),
    lit = pigment(mix(coat.body, coat.stripe, 0.35), atm),
    farLeg = pigment(mix(coat.body, coat.stripe, 0.1), atm),
    cream = pigment(coat.stripe, atm),
    belly = pigment(coat.belly, atm),
    ink = pigment({ r: 31, g: 35, b: 29 }, atm);
  ctx.save();
  ctx.globalAlpha *= a.alpha;
  ctx.translate(x, y);
  softShadow(ctx, -3, 0.7, 15, 2.7, atm.shadowTint, atm.shadowAmount * 0.7);
  ctx.scale(a.facing, 1);
  ctx.translate(p.strike * 3, -3 - p.breath + p.crouch * 0.65);
  ctx.rotate(p.sway);

  // A tapered ribbon around a curved spine, not a triangle pivoting at the hips.
  // Bounded geometry; no offscreen canvases or per-frame texture buffers.
  const tail = (t: number) => {
    const bend = 3.3 + p.tail * 0.45;
    const wave = t * Math.PI * 1.8;
    const dy = Math.cos(wave) * Math.PI * 1.8 * bend + p.tail * 0.4;
    const norm = Math.hypot(27, dy);
    return {
      x: -7 - t * 27,
      y: 0.65 + Math.sin(wave) * bend + t * p.tail * 0.4,
      nx: dy / norm,
      ny: 27 / norm,
      r: 2.15 * (1 - t) ** 1.3 + 0.025,
    };
  };
  const tailOutline = () => {
    for (let side = -1; side <= 1; side += 2)
      for (let n = 0; n <= 24; n++) {
        const q = tail(side < 0 ? n / 24 : 1 - n / 24);
        const px = q.x + q.nx * q.r * side,
          py = q.y + q.ny * q.r * side;
        if (side < 0 && n === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
  };
  ctx.save();
  ctx.beginPath();
  tailOutline();
  ctx.closePath();
  ctx.clip();
  const tailWash = ctx.createLinearGradient(-7, -1, -34, 4);
  tailWash.addColorStop(0, body);
  tailWash.addColorStop(0.3, pigment(coat.tail, atm));
  tailWash.addColorStop(0.65, pigment(mix(coat.tail, { r: 81, g: 173, b: 185 }, variant === 3 ? 0.4 : 0.06), atm));
  tailWash.addColorStop(1, pigment(shade(coat.tail, 0.6), atm));
  ctx.fillStyle = tailWash;
  ctx.fillRect(-36, -10, 31, 23);
  // Dark lower edge and a broken satin glint follow the same spine as the silhouette.
  for (const side of [0.65, -0.4])
    stroke(
      ctx,
      side > 0 ? pigment(shade(coat.tail, 0.55), atm, 0.6) : pigment(mix(coat.tail, coat.stripe, 0.6), atm, 0.8),
      side > 0 ? 0.75 : 0.45,
      () => {
        for (let n = 0; n <= 22; n++) {
          const q = tail(n / 24);
          if (n === 0) ctx.moveTo(q.x + q.nx * q.r * side, q.y + q.ny * q.r * side);
          else ctx.lineTo(q.x + q.nx * q.r * side, q.y + q.ny * q.r * side);
        }
      },
    );
  for (let n = 1; n < 23; n++) {
    const q = tail(n / 24);
    stroke(ctx, pigment(shade(coat.tail, 0.5), atm, 0.32), 0.16, () => {
      ctx.moveTo(q.x - q.nx * q.r, q.y - q.ny * q.r);
      ctx.quadraticCurveTo(q.x - 0.4, q.y, q.x + q.nx * q.r, q.y + q.ny * q.r);
    });
  }
  ctx.restore();

  const leg = (front: boolean, far: boolean) => {
    const side = far ? -1 : 1,
      hip = front ? 4.5 : -5.8,
      phase = p.gait + (front !== far ? Math.PI : 0),
      reach = Math.cos(phase) * (front ? 2.1 : 2.6) * p.motion,
      lift = Math.max(0, Math.sin(phase)) * 1.15 * p.motion,
      rootY = far ? -1.2 : 1.1,
      kneeX = hip - (front ? 1.8 : 2.1) + reach * 0.35 - p.strike * 0.8,
      kneeY = side * (far ? 2.9 : 3.6),
      footX = hip + (front ? 1.5 : 0.1) + reach - p.strike * 1.5,
      footY = side * (far ? 4.3 : 5.4) - lift * side - p.crouch * side * 0.5;
    limb(ctx, far ? farLeg : body, far ? (front ? 0.95 : 1.3) : front ? 1.35 : 2, [
      [hip, rootY],
      [kneeX, kneeY],
    ]);
    oval(ctx, kneeX, kneeY, far ? 0.5 : front ? 0.7 : 0.9, far ? 0.45 : 0.65, far ? farLeg : body);
    limb(ctx, far ? farLeg : lit, far ? 0.65 : 0.95, [
      [kneeX, kneeY],
      [footX, footY],
    ]);
    if (!far)
      limb(ctx, pigment(coat.stripe, atm, 0.55), 0.32, [
        [hip - 0.3, rootY],
        [kneeX - 0.3, kneeY],
        [footX, footY - 0.2],
      ]);
    // Five unequal toes, with a tiny pale claw rather than a single webbed foot.
    for (let toe = 0; toe < 5; toe++) {
      const spread = (toe - 2) * 0.44,
        length = 1.05 + (2 - Math.abs(toe - 2)) * 0.35,
        toeX = footX + length - Math.abs(spread) * 0.4,
        toeY = footY + spread * side;
      limb(ctx, far ? farLeg : body, far ? 0.25 : 0.31, [
        [footX, footY],
        [footX + length * 0.6, toeY],
        [toeX, toeY + side * 0.13],
      ]);
      limb(ctx, pigment(coat.belly, atm, far ? 0.5 : 0.9), 0.16, [
        [toeX, toeY + side * 0.13],
        [toeX + 0.32, toeY],
      ]);
    }
  };
  leg(false, true);
  leg(true, true);

  ctx.save();
  ctx.scale(1, 1 + p.flatten + p.breath * 0.15);
  const torso = () => {
    ctx.moveTo(-8.8, 0.3);
    ctx.bezierCurveTo(-7.6, -2.9, -3.2, -3.5, 1.8, -2.9);
    ctx.bezierCurveTo(5, -2.65, 6.5, -2.7 - p.raise * 0.4, 9.3, -1.8 - p.raise * 0.4);
    ctx.lineTo(10, 0.8);
    ctx.bezierCurveTo(6.4, 1.9, 3.7, 2.6, -0.8, 2.65);
    ctx.bezierCurveTo(-4.7, 2.85, -7.6, 2.2, -8.8, 0.3);
  };
  ctx.save();
  ctx.beginPath();
  torso();
  ctx.closePath();
  ctx.clip();
  const wash = ctx.createLinearGradient(0, -3.3, 0.8, 3.1);
  wash.addColorStop(0, lit);
  wash.addColorStop(0.32, body);
  wash.addColorStop(0.72, dark);
  wash.addColorStop(1, belly);
  ctx.fillStyle = wash;
  ctx.fillRect(-10, -5, 22, 10);
  // A dark lateral band sets off the fine longitudinal stripes; never a flat spotted oval.
  stroke(ctx, dark, variant === 3 ? 1.7 : 1.15, () => {
    ctx.moveTo(-8.2, 0.15);
    ctx.bezierCurveTo(-2, 0.8, 2.5, 0.2, 8.5, -0.65);
  });
  for (const row of [-2.05, -0.7, 1.2])
    stroke(ctx, cream, variant === 3 ? 0.46 : 0.3, () => {
      ctx.moveTo(-8, row * 0.62);
      ctx.bezierCurveTo(-3, row - 0.2, 2.2, row - 0.12, 9.4, row * 0.62 - 0.3);
    });
  // Small interlocking scales: fixed seed, low contrast, and no crawling random texture.
  const scaleInk = pigment(shade(coat.body, 0.5), atm, 0.35);
  const scaleLight = pigment(coat.stripe, atm, 0.24);
  for (let row = 0; row < 6; row++)
    for (let col = 0; col < 15; col++) {
      const sx = -8.1 + col * 1.2 + (row % 2) * 0.6,
        sy = -2.9 + row * 0.92 + hash2(col, row, a.seed) * 0.13;
      stroke(ctx, scaleInk, 0.13, () => {
        ctx.moveTo(sx - 0.4, sy);
        ctx.quadraticCurveTo(sx, sy + 0.67, sx + 0.48, sy);
      });
      if ((col + row) % 3 === 0)
        stroke(ctx, scaleLight, 0.16, () => {
          ctx.moveTo(sx - 0.28, sy - 0.12);
          ctx.lineTo(sx + 0.22, sy - 0.12);
        });
    }
  stroke(ctx, pigment(coat.stripe, atm, 0.32), 0.6, () => {
    ctx.moveTo(-5.8, -2.4);
    ctx.quadraticCurveTo(0, -3, 5.6, -2.25);
  });
  ctx.restore();
  ctx.restore();
  leg(false, false);
  leg(true, false);

  ctx.save();
  ctx.translate(7.2 + p.strike * 0.5, -0.85 - p.raise);
  ctx.rotate(p.head);
  // A separate lower jaw opens only during the short, simulation-timed strike.
  ctx.save();
  ctx.translate(0, 0.85);
  ctx.rotate(p.jaw * 0.2);
  shape(ctx, belly, () => {
    ctx.moveTo(-0.9, -0.5);
    ctx.quadraticCurveTo(2.5, -0.1, 6.6, -0.15);
    ctx.quadraticCurveTo(5, 1.05, 0.2, 1.15);
    ctx.lineTo(-1.4, 0.55);
  });
  stroke(ctx, dark, 0.23, () => {
    ctx.moveTo(0.3, 0.1);
    ctx.lineTo(6.1, -0.02);
  });
  ctx.restore();
  shape(ctx, body, () => {
    ctx.moveTo(-2.1, -1.8);
    ctx.bezierCurveTo(-0.2, -3.1, 2.3, -3.15, 4.4, -1.7);
    ctx.quadraticCurveTo(6.9, -0.95, 6.95, 0.05);
    ctx.quadraticCurveTo(5.5, 0.85, 1.4, 1.02);
    ctx.lineTo(-1.7, 0.7);
  });
  shape(ctx, lit, () => {
    ctx.moveTo(-1.4, -1.85);
    ctx.quadraticCurveTo(1.5, -3.05, 4.8, -1.25);
    ctx.quadraticCurveTo(2.7, -1.7, 0.8, -1.38);
    ctx.lineTo(-1, -0.8);
  });
  stroke(ctx, cream, 0.37, () => {
    ctx.moveTo(-1.8, -0.12);
    ctx.quadraticCurveTo(1.1, 0.62, 6.2, -0.1);
  });
  // Broad head shields, finer lip scales and the recessed ear just behind the eye.
  const plate = pigment(shade(coat.body, 0.6), atm, 0.7);
  stroke(ctx, plate, 0.21, () => {
    ctx.moveTo(-1.4, -1.8);
    ctx.lineTo(0.1, -1.2);
    ctx.lineTo(1.1, -1.9);
    ctx.lineTo(0.2, -2.55);
    ctx.moveTo(1.1, -1.9);
    ctx.lineTo(3, -2.25);
    ctx.lineTo(3.6, -1.5);
    ctx.lineTo(5.1, -1.15);
    ctx.moveTo(3.6, -1.5);
    ctx.lineTo(3.9, -0.7);
    ctx.lineTo(5.9, -0.45);
  });
  for (let i = 0; i < 5; i++)
    stroke(ctx, plate, 0.16, () => {
      ctx.moveTo(1.4 + i * 0.84, 0.35);
      ctx.lineTo(1.65 + i * 0.84, 0.75 - i * 0.1);
    });
  oval(ctx, -0.8, 0.03, 0.34, 0.52, dark, -0.25);
  oval(ctx, 2.1, -1.15, 1.06, 0.86, dark, -0.06);
  oval(ctx, 2.14, -1.2, 0.9, 0.7, cream);
  if (p.blink) {
    stroke(ctx, ink, 0.24, () => {
      ctx.moveTo(1.45, -1.12);
      ctx.quadraticCurveTo(2.15, -0.85, 2.8, -1.23);
    });
  } else {
    oval(ctx, 2.27, -1.19, 0.64, 0.57, ink);
    oval(ctx, 2.44, -1.44, 0.2, 0.18, pigment({ r: 255, g: 248, b: 226 }, atm));
    oval(ctx, 2.06, -0.93, 0.1, 0.07, pigment(coat.stripe, atm, 0.65));
  }
  oval(ctx, 5.9, -0.42, 0.22, 0.17, ink);
  if (p.tongue)
    stroke(ctx, pigment({ r: 154, g: 96, b: 107 }, atm), 0.3, () => {
      ctx.moveTo(6.7, 0.45);
      ctx.lineTo(9.1, 0.65);
      ctx.lineTo(9.8, 0.25);
      ctx.moveTo(9.1, 0.65);
      ctx.lineTo(9.7, 1.02);
    });
  ctx.restore();
  ctx.restore();
}
