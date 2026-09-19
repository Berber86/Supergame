/** Мышь и сова: быстрые лапки внизу, широкие бесшумные крылья наверху. */
import type { Mouse, Owl } from '../world/wildlife';
import type { Atmosphere } from '../world/palette';
import { clamp01 } from '../core/rng';
import { mouseSpeed, MOUSE_STRIDE, owlAltitude, owlFlight } from '../world/creatureMotion';
import { Ctx, softShadow } from './paint';
import { oval, shape, stroke, limb, pigment } from './animalBrush';

export function drawMouse(ctx: Ctx, m: Mouse, x: number, y: number, atm: Atmosphere, time: number): void {
  const fur = pigment({ r: 148, g: 133, b: 107 }, atm),
    back = pigment({ r: 105, g: 97, b: 81 }, atm);
  const belly = pigment({ r: 227, g: 211, b: 178 }, atm),
    pink = pigment({ r: 194, g: 146, b: 132 }, atm);
  const ink = pigment({ r: 41, g: 37, b: 31 }, atm);
  const tucked = clamp01(m.cover ?? +(m.state === 'hide'));
  const moving = mouseSpeed(m.state) > 0;
  const gait = m.gait ?? ((time * mouseSpeed(m.state)) / MOUSE_STRIDE) * Math.PI * 2;
  const dart = m.state === 'flee';
  const lift = moving ? Math.max(0, Math.sin(gait)) * (dart ? 1.2 : 0.35) : 0;
  const forage = m.state === 'forage';
  const sniff = Math.sin(time * 0.015) * (forage ? 0.17 : 0.04);
  ctx.save();
  ctx.translate(x, y);
  softShadow(ctx, 0, 0, 6.7, 1.7, atm.shadowTint, atm.shadowAmount * (1 - lift * 0.2));
  ctx.scale(m.facing, 1);
  ctx.translate(0, -lift);
  ctx.scale(1 - tucked * 0.15, 1 - tucked * 0.4);
  stroke(ctx, back, 0.75, () => {
    ctx.moveTo(-4.7, -3.8);
    ctx.bezierCurveTo(-9, -0.2, -14.5, -4 + Math.sin(gait - 0.8) * 0.8, -15.8, -1.6 + Math.sin(time * 0.004) * 0.5);
  });
  stroke(ctx, pink, 0.45, () => {
    ctx.moveTo(-5, -3.4);
    ctx.bezierCurveTo(-9, 0, -14.5, -3.7 + Math.sin(gait - 0.8) * 0.8, -15.8, -1.6 + Math.sin(time * 0.004) * 0.5);
  });
  for (let i = 0; i < 4; i++) {
    const front = i % 2 > 0,
      far = i < 2;
    const phase = gait + (front !== far ? Math.PI : 0);
    const footX = (front ? 3.3 : -3.7) + (moving ? Math.cos(phase) * 1.5 : 0);
    const footY = -0.2 - Math.max(0, Math.sin(phase)) * (moving ? 0.7 : 0);
    limb(ctx, far ? back : pink, 0.55, [
      [front ? 3 : -3, -3.5],
      [footX - 0.5, -1.3],
      [footX + 0.7, footY],
    ]);
    for (let toe = 0; toe < 3; toe++)
      limb(ctx, pink, 0.17, [
        [footX, footY],
        [footX + 1.2, footY + (toe - 1) * 0.25],
      ]);
  }
  oval(ctx, -1.2, -4.2, 5.5, 3.6, back, -0.08);
  oval(ctx, -0.2, -3.7, 4.7, 2.8, fur);
  oval(ctx, 0.7, -2.3, 3.7, 1.1, belly);
  for (let i = 0; i < 8; i++)
    limb(ctx, pigment({ r: 217, g: 195, b: 155 }, atm, 0.48), 0.22, [
      [-4 + i * 0.8, -5.8 + (i % 2) * 0.45],
      [-3.4 + i * 0.8, -5.1 + (i % 2) * 0.45],
    ]);
  ctx.save();
  ctx.translate(3.2 - tucked * 0.6, -4.6);
  ctx.rotate(forage ? sniff : -+dart * 0.08);
  oval(ctx, 1.2, -2.5, 1.6, 2.0, back, 0.15);
  shape(ctx, fur, () => {
    ctx.moveTo(-2.1, -2.2);
    ctx.quadraticCurveTo(0.8, -3.1, 3, -0.8);
    ctx.lineTo(5.4, 0.7);
    ctx.quadraticCurveTo(2.2, 2.6, -1.5, 1.2);
  });
  oval(ctx, -0.6, -2.8, 2.0, 2.25, fur, -0.15);
  oval(ctx, -0.45, -2.85, 1.35, 1.65, pink, -0.15);
  oval(ctx, -0.7, -2.5, 0.6, 1.0, pigment({ r: 233, g: 183, b: 155 }, atm), -0.2);
  const closed = tucked > 0.8 || Math.sin(time * 0.0013 + m.seed) > 0.992;
  oval(ctx, 1.9, -0.8, 0.66, closed ? 0.12 : 0.64, ink);
  if (!closed) oval(ctx, 2.1, -1.05, 0.2, 0.19, '#fff4dc');
  oval(ctx, 5.1 + sniff, 0.65, 0.52, 0.4, pink);
  for (let i = -1; i <= 1; i++)
    limb(ctx, pigment({ r: 102, g: 95, b: 80 }, atm, 0.75), 0.16, [
      [3.9, 0.9],
      [6.9, 0.8 + i * 0.8],
    ]);
  if (forage) {
    const chew = Math.sin(time * 0.026) * 0.12;
    oval(ctx, 3.6, 2.1 + chew, 0.7, 1, pigment({ r: 197, g: 163, b: 96 }, atm), -0.3);
    limb(ctx, pink, 0.45, [
      [1.4, 2],
      [2.8, 2.7],
      [3.4, 2.3],
    ]);
  }
  ctx.restore();
  ctx.restore();
}

export function drawOwl(ctx: Ctx, o: Owl, x: number, y: number, atm: Atmosphere, time: number): void {
  const fur = pigment({ r: 143, g: 115, b: 77 }, atm),
    deep = pigment({ r: 87, g: 76, b: 61 }, atm);
  const light = pigment({ r: 193, g: 166, b: 114 }, atm),
    cream = pigment({ r: 232, g: 214, b: 170 }, atm);
  const ink = pigment({ r: 42, g: 44, b: 40 }, atm),
    gold = pigment({ r: 231, g: 181, b: 68 }, atm);
  const flight = o.wingOpen ?? +owlFlight(o);
  const hunt = o.state === 'hunt';
  const elevation = o.altitude ?? owlAltitude(o);
  const hoot = o.state === 'hoot' ? Math.pow((Math.sin(time * 0.012) + 1) * 0.5, 2) : 0;
  const flap = Math.sin(time * (hunt ? 0.004 : 0.007) + o.seed);
  ctx.save();
  ctx.translate(x, y);
  softShadow(ctx, 0, 0, 9, 2.8, atm.shadowTint, atm.shadowAmount * 0.45);
  ctx.translate(0, -elevation);
  ctx.scale(o.facing, 1);
  // Длинные округлые крылья с отдельными маховыми перьями и поперечными полосами.
  for (const side of [-1, 1]) {
    ctx.save();
    ctx.translate(side * 3, -13);
    ctx.rotate(side * (0.18 + flap * 0.48) * flight);
    ctx.scale(side * (0.18 + flight * 0.82), 0.85 + flight * 0.15);
    shape(ctx, deep, () => {
      ctx.moveTo(0, -2);
      ctx.bezierCurveTo(9, -12, 19, -8, 26, -3);
      ctx.quadraticCurveTo(22, 3, 14, 5);
      ctx.quadraticCurveTo(5, 7, 0, 1);
    });
    for (let i = 0; i < 8; i++) {
      const xx = 4 + i * 2.5;
      oval(ctx, xx, 1 + Math.sin(i * 0.5) * 2.1, 2.0, 5.5 - i * 0.27, i % 2 ? fur : light, -0.65 + i * 0.055);
      for (let band = 0; band < 2; band++)
        limb(ctx, deep, 0.65, [
          [xx - 0.6, band * 2.0 - 0.2],
          [xx + 1.4, band * 2.0 + 0.7],
        ]);
    }
    shape(ctx, fur, () => {
      ctx.moveTo(0, -2);
      ctx.quadraticCurveTo(10, -11, 24, -3.5);
      ctx.quadraticCurveTo(14, 0, 1, 1);
    });
    stroke(ctx, light, 0.65, () => {
      ctx.moveTo(2, -3);
      ctx.quadraticCurveTo(12, -8, 21, -4);
    });
    ctx.restore();
  }
  for (let i = -1; i <= 1; i++) oval(ctx, i * 1.9, -1.8, 1.5, 4.2, deep, i * -0.1);
  oval(ctx, 0, -10.7, 6.6, 9.7, fur, 0);
  oval(ctx, 0, -9.4, 4.6, 7.7, cream);
  for (let row = 0; row < 5; row++)
    for (let col = -1; col <= 1; col++) {
      const xx = col * 2.3 + (row % 2) * 0.5;
      limb(ctx, row % 2 ? fur : deep, 0.42, [
        [xx - 0.55, -13 + row * 2],
        [xx, -11.5 + row * 2],
        [xx + 0.55, -13 + row * 2],
      ]);
    }
  for (const side of [-1, 1]) {
    const toeY = hunt ? 3 : 0;
    limb(ctx, light, 1.1, [
      [side * 2, -3.3],
      [side * 2.3, toeY],
    ]);
    for (let i = -1; i <= 1; i++)
      limb(ctx, ink, 0.4, [
        [side * 2.3, toeY],
        [side * 2.3 + i * 1, toeY + 1],
        [side * 2.3 + i * 1.2, toeY + 0.4],
      ]);
  }
  ctx.save();
  ctx.translate(Math.sin(time * 0.0011 + o.seed) * (1 - flight) * 1.2, -20 + hoot * 0.3);
  ctx.rotate(Math.sin(time * 0.0014) * (1 - flight) * 0.08 + (hunt ? 0.08 : 0));
  for (const side of [-1, 1])
    shape(ctx, deep, () => {
      ctx.moveTo(side * 2.2, -4);
      ctx.lineTo(side * 6.2, -9);
      ctx.lineTo(side * 6.5, -1.5);
    });
  oval(ctx, 0, 0, 7.7, 6.6, deep);
  // Лицевые диски, а не два одинаковых круга поверх тела.
  for (const side of [-1, 1]) {
    oval(ctx, side * 3.1, 0.25, 3.8, 4.8, light, side * 0.2);
    oval(ctx, side * 2.9, 0.4, 2.9, 3.8, cream, side * 0.15);
    const blink = Math.sin(time * 0.0008 + side * 0.12 + o.seed) > 0.99;
    oval(ctx, side * 3, -0.3, 2.2, blink ? 0.2 : 2.3, ink);
    if (!blink) {
      oval(ctx, side * 3, -0.3, 1.65, 1.75, gold);
      oval(ctx, side * 3 + 0.2, -0.3, 0.85, 1.2, ink);
      oval(ctx, side * 3 + 0.55, -0.95, 0.38, 0.36, '#fff5d5');
    }
    limb(ctx, deep, 0.85, [
      [side * 0.5, -3],
      [side * 3, -3.9],
      [side * 5.6, -2.9],
    ]);
  }
  shape(ctx, gold, () => {
    ctx.moveTo(-0.9, 1);
    ctx.lineTo(1, 1);
    ctx.quadraticCurveTo(1, 3.6 + hoot, 0, 3.9 + hoot);
    ctx.quadraticCurveTo(-0.8, 2.7, -0.9, 1);
  });
  if (hoot > 0.1) oval(ctx, 0, 3.4, 0.6, hoot * 0.75, ink);
  ctx.restore();
  ctx.restore();
}
