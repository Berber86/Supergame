/** Glossy garden skink in side view: banded flanks, ocellated sides, five-toed sprawling legs and a long tapering tail. */
import type { Lizard } from '../world/lizards';
import { lizardCoat, lizardPose } from '../world/lizards';
import { hash2 } from '../core/rng';
import type { Atmosphere, RGB } from '../world/palette';
import { shade } from '../world/palette';
import { pigment, oval, shape, stroke, limb } from './animalBrush';
import { softShadow, type Ctx } from './paint';
interface Coat {
  flank: RGB;
  back: RGB;
  belly: RGB;
  stripe: RGB;
  tail: RGB;
  tailTip: RGB;
  crown: RGB;
}
const COATS: Coat[] = [
  {
    flank: { r: 146, g: 112, b: 68 },
    back: { r: 102, g: 74, b: 42 },
    belly: { r: 214, g: 190, b: 142 },
    stripe: { r: 226, g: 200, b: 130 },
    tail: { r: 128, g: 98, b: 60 },
    tailTip: { r: 150, g: 120, b: 75 },
    crown: { r: 122, g: 90, b: 52 },
  },
  {
    flank: { r: 178, g: 150, b: 104 },
    back: { r: 148, g: 118, b: 80 },
    belly: { r: 232, g: 214, b: 176 },
    stripe: { r: 235, g: 214, b: 168 },
    tail: { r: 154, g: 129, b: 89 },
    tailTip: { r: 172, g: 148, b: 102 },
    crown: { r: 158, g: 128, b: 86 },
  },
  {
    flank: { r: 117, g: 126, b: 81 },
    back: { r: 86, g: 92, b: 56 },
    belly: { r: 208, g: 200, b: 150 },
    stripe: { r: 200, g: 190, b: 128 },
    tail: { r: 100, g: 110, b: 73 },
    tailTip: { r: 122, g: 130, b: 90 },
    crown: { r: 138, g: 108, b: 68 },
  },
  {
    flank: { r: 52, g: 48, b: 40 },
    back: { r: 34, g: 31, b: 26 },
    belly: { r: 158, g: 148, b: 122 },
    stripe: { r: 233, g: 199, b: 110 },
    tail: { r: 63, g: 143, b: 196 },
    tailTip: { r: 122, g: 201, b: 236 },
    crown: { r: 96, g: 72, b: 50 },
  },
];
export function drawLizard(ctx: Ctx, a: Lizard, x: number, y: number, atm: Atmosphere, time: number): void {
  if (a.alpha <= 0.005) return;
  const coatIndex = lizardCoat(a.seed),
    coat = COATS[coatIndex],
    pose = lizardPose(a, time),
    juvenile = coatIndex === 3;
  const flank = pigment(coat.flank, atm),
    back = pigment(coat.back, atm),
    belly = pigment(coat.belly, atm),
    stripe = pigment(coat.stripe, atm, juvenile ? 0.95 : 0.6),
    stripeSoft = pigment(coat.stripe, atm, juvenile ? 0.9 : 0.35),
    tail = pigment(coat.tail, atm),
    tailTip = pigment(coat.tailTip, atm),
    crown = pigment(coat.crown, atm),
    dark = pigment(shade(coat.flank, 0.55), atm),
    far = pigment(shade(coat.flank, 0.62), atm),
    ink = pigment({ r: 35, g: 31, b: 26 }, atm),
    cream = pigment({ r: 238, g: 230, b: 200 }, atm),
    iris = pigment({ r: 198, g: 142, b: 62 }, atm),
    tongue = pigment({ r: 178, g: 100, b: 105 }, atm);
  // Chest, mid-body and hips counter-sway so the spine bends into an S while walking.
  const chestY = pose.sway * 0.55 - pose.display * 1.0 + pose.crouch * 0.5;
  const midY = -pose.swayMid * 0.85 + pose.crouch * 0.5;
  const hipsY = pose.sway * 0.45 + pose.crouch * 0.5;
  ctx.save();
  ctx.globalAlpha *= a.alpha;
  ctx.translate(x, y);
  softShadow(ctx, 0, 0.5, 15, 3.2, atm.shadowTint, atm.shadowAmount * 0.7);
  ctx.scale(a.facing, 1);
  ctx.translate(pose.strike * 3, -2.6 - pose.breath - (1 - pose.crouch) * 0.6);
  const segY = (cx: number) => (cx > 1.5 ? chestY : cx < -2.6 ? hipsY : midY);
  const leg = (front: boolean, near: boolean) => {
    const hipX = front ? 4.4 : -4.6,
      hipY = (front ? chestY : hipsY) + 1.1;
    const phase = pose.gait + (front === near ? Math.PI : 0);
    const reach = Math.cos(phase) * 2.4 * pose.motion,
      lift = Math.max(0, Math.sin(phase)) * 1.6 * pose.motion;
    const sprawl = 1 + pose.crouch * 0.25;
    const kneeX = hipX + (front ? -2.3 : 2.3) * sprawl + reach * 0.35,
      kneeY = hipY + (near ? 2.4 : 1.9) * sprawl - lift * 0.3;
    const stance = 1 - pose.motion;
    const ankX = hipX + (front ? 1.4 - stance * 0.6 : -1.6 + stance * 0.7) + reach * 0.8,
      ankY = (near ? 5.3 : 4.3) - lift;
    const color = near ? flank : far;
    limb(ctx, color, 1.5, [
      [hipX, hipY],
      [kneeX, kneeY],
    ]);
    limb(ctx, color, 1.05, [
      [kneeX, kneeY],
      [ankX, ankY],
    ]);
    // Five splayed toes; the far foot is half-hidden and clawless to limit noise.
    const toes = near ? 5 : 4;
    for (let t = 0; t < toes; t++) {
      const spread = (t / (toes - 1) - 0.5) * 1.8,
        len = (near ? 1.9 : 1.3) * (1 - Math.abs(spread) * 0.18);
      const tipX = ankX + Math.cos(spread) * len + 0.4,
        tipY = ankY + 0.5 + Math.sin(spread) * len * 0.45;
      limb(ctx, color, 0.45, [
        [ankX, ankY],
        [tipX, tipY],
      ]);
      if (near) oval(ctx, tipX, tipY, 0.2, 0.2, ink);
    }
  };
  // Far legs first: the torso covers their upper half like a true side view.
  leg(false, false);
  leg(true, false);
  // Tail is curved geometry with a rounded tip, not a rigid stick pivoting at its root.
  const tipX = -25.5,
    tipY = hipsY + 1.6 + pose.tail + (a.state === 'flee' ? -4.5 : 0) + pose.strike * 1.5;
  shape(ctx, tail, () => {
    ctx.moveTo(-5.5, hipsY - 1.2);
    ctx.bezierCurveTo(-11, hipsY - 1.7, -17.5, tipY - 2.2, tipX, tipY - 0.35);
    ctx.bezierCurveTo(-17.5, tipY + 0.6, -11, hipsY + 2.0, -5.5, hipsY + 1.5);
  });
  oval(ctx, tipX + 0.5, tipY, 1.2, 0.38, tailTip);
  stroke(ctx, stripeSoft, juvenile ? 0.6 : 0.45, () => {
    ctx.moveTo(-6, hipsY - 0.7);
    ctx.bezierCurveTo(-11, hipsY - 1.0, -17.5, tipY - 1.3, tipX + 0.5, tipY - 0.25);
  });
  // Torso in three overlapping segments: pale belly, flank, dark dorsal band.
  const segs: [number, number, number][] = [
    [3.4, 4.3, 2.7],
    [-0.6, 4.7, 3.0],
    [-4.6, 3.7, 2.5],
  ];
  for (const [cx, rx, ry] of segs) oval(ctx, cx, segY(cx) + 1.0, rx * 0.92, ry * 0.72, belly);
  for (const [cx, rx, ry] of segs) oval(ctx, cx, segY(cx), rx, ry, flank);
  for (const [cx, rx, ry] of segs) oval(ctx, cx - 0.3, segY(cx) - 1.15, rx * 0.88, ry * 0.62, back);
  for (const [cx, rx] of segs) oval(ctx, cx, segY(cx) - 1.9, rx * 0.7, 0.3, stripeSoft);
  // Dorsal speckles follow the back curve; juveniles trade them for crisp stripes.
  const speckles = juvenile ? 5 : 11;
  for (let i = 0; i < speckles; i++) {
    const sx = -6 + hash2(i, a.seed, 811) * 12.5;
    oval(
      ctx,
      sx,
      segY(sx) - 1.25 - hash2(i, a.seed, 821) * 0.9,
      0.3 + hash2(i, a.seed, 831) * 0.14,
      0.22,
      pigment(shade(coat.back, 0.7), atm, juvenile ? 0.4 : 0.55),
    );
  }
  if (!juvenile)
    for (let i = 0; i < 4; i++) {
      const ox = -5.2 + i * 2.7;
      oval(ctx, ox, segY(ox) + 0.9, 0.55, 0.42, pigment(shade(coat.flank, 0.7), atm, 0.6));
      oval(ctx, ox, segY(ox) + 0.9, 0.3, 0.22, stripeSoft);
    }
  // Lateral stripes bend with the spine instead of cutting across it.
  const stripeXs = [6.6, 3.4, -0.6, -4.6, -6.8];
  for (const off of juvenile ? [-2.0, -0.8, 0.5, 1.5] : [-0.7, 1.3])
    limb(
      ctx,
      stripe,
      juvenile ? 0.7 : 0.5,
      stripeXs.map((sx) => [sx, segY(sx) + off]),
    );
  leg(false, true);
  leg(true, true);
  // Head: brow, lidded amber eye, ear opening, jaw line and a pulsing throat.
  ctx.save();
  ctx.translate(7.2, chestY - 0.6);
  ctx.rotate(pose.head + pose.strike * 0.15 + (a.state === 'hunt' ? 0.08 : a.state === 'bask' ? -0.05 : 0));
  shape(ctx, flank, () => {
    ctx.moveTo(-2.6, -1.7);
    ctx.quadraticCurveTo(0.5, -2.5, 3.5, -1.9);
    ctx.quadraticCurveTo(5.2, -1.4, 6.3, -0.4);
    ctx.quadraticCurveTo(5.9, 0.9, 4.2, 1.4);
    ctx.lineTo(1.5, 1.7);
    ctx.lineTo(-2.2, 1.9);
    ctx.quadraticCurveTo(-2.9, 0, -2.6, -1.7);
  });
  oval(ctx, 1.5, -1.8, 2.6, 0.85, crown);
  oval(ctx, 2.8, 1.7, 2.3, 0.6 + pose.display * 0.6 + pose.breath * 1.5, belly);
  stroke(ctx, dark, 0.5, () => {
    ctx.moveTo(0.8, 1.35);
    ctx.lineTo(5.6, 0.75 + pose.strike * 1.1);
  });
  stroke(ctx, dark, 0.5, () => {
    ctx.moveTo(0.9, -1.9);
    ctx.lineTo(3.1, -1.7);
  });
  oval(ctx, -0.7, 0.15, 0.42, 0.5, ink);
  oval(ctx, 2.0, -1.15, 0.85, 0.85, iris);
  oval(ctx, 2.0, -1.15, 0.3, 0.45, ink);
  if (!pose.blink) oval(ctx, 2.25, -1.4, 0.2, 0.2, cream);
  // A heavy upper lid gives the half-lidded reptile gaze; on blink it shuts fully.
  oval(ctx, 2.0, pose.blink ? -1.1 : -1.85, 0.95, pose.blink ? 0.95 : 0.5, flank);
  if (pose.blink)
    stroke(ctx, dark, 0.4, () => {
      ctx.moveTo(1.2, -1.15);
      ctx.lineTo(2.8, -1.15);
    });
  oval(ctx, 5.3, -0.45, 0.22, 0.22, ink);
  if (pose.tongue || pose.strike > 0.5) {
    const len = 2.8 + pose.strike * 2.5,
      droop = 0.2 + pose.strike * 1.0;
    stroke(ctx, tongue, 0.45, () => {
      ctx.moveTo(6.0, 0.55);
      ctx.lineTo(6.0 + len, 0.55 + droop);
      ctx.lineTo(6.0 + len + 0.8, 0.1 + droop);
      ctx.moveTo(6.0 + len, 0.55 + droop);
      ctx.lineTo(6.0 + len + 0.8, 1.0 + droop);
    });
  }
  ctx.restore();
  ctx.restore();
}
