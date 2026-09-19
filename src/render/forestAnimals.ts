/** Ёж и белка: цельные силуэты, сочленённые лапы, живые мордочки. */
import { hash1, lerp } from '../core/rng';
import type { Hedgehog, Squirrel } from '../world/wildlife';
import type { Atmosphere } from '../world/palette';
import { hedgehogPose, squirrelPose } from '../world/wildlifeMotion';
import { Ctx, softShadow } from './paint';
import { limb, oval, pigment, shape, stroke, TAU } from './animalBrush';

export function drawHedgehog(ctx: Ctx, h: Hedgehog, x: number, y: number, atm: Atmosphere, time: number): void {
  const p = hedgehogPose(h, time);
  const fur = pigment({ r: 169, g: 141, b: 107 }, atm);
  const face = pigment({ r: 223, g: 202, b: 165 }, atm);
  const shade = pigment({ r: 102, g: 78, b: 61 }, atm);
  const ink = pigment({ r: 42, g: 35, b: 30 }, atm);
  const quill = pigment({ r: 96, g: 80, b: 61 }, atm);
  const tip = pigment({ r: 212, g: 192, b: 145 }, atm);
  const mid = pigment({ r: 149, g: 124, b: 87 }, atm);
  const pink = pigment({ r: 187, g: 142, b: 119 }, atm);
  const open = 1 - p.roll;
  const bob = (Math.cos(p.gait * 2) * 0.16 * p.motion + Math.sin(time * 0.0018 + h.seed) * 0.075) * open;
  ctx.save();
  ctx.translate(x, y);
  softShadow(ctx, 0, 0, lerp(10, 7.6, p.roll), 2.4, atm.shadowTint, atm.shadowAmount * 1.1);
  ctx.scale(h.facing, 1);
  ctx.translate(0, bob);

  // Лапы и голова уходят ПОД шубку; свернувшийся ёж не меняется на другой спрайт.
  for (let i = 0; i < 4; i++) {
    const far = i < 2;
    const front = i % 2 === 1;
    const phase = p.gait + (front !== far ? Math.PI : 0);
    const rootX = (front ? 4.4 : -5.2) * open;
    const step = Math.cos(phase) * 1.3 * p.motion;
    const lift = Math.max(0, Math.sin(phase)) * 0.75 * p.motion;
    const scratch = h.state === 'forage' && front && !far ? Math.sin(time * 0.012) * 0.7 : 0;
    const footY = -0.35 - lift - p.roll * 5;
    limb(ctx, far ? shade : fur, 1.15, [
      [rootX, -3],
      [rootX - 0.5 + step, -1.6 - lift - p.roll * 3],
      [rootX + step + scratch + 0.8, footY],
    ]);
    if (open > 0.2)
      for (let toe = 0; toe < 3; toe++) {
        limb(ctx, ink, 0.24, [
          [rootX + step + scratch + 0.5 + toe * 0.36, footY],
          [rootX + step + scratch + 0.8 + toe * 0.36, footY + 0.28 * open],
        ]);
      }
  }
  oval(ctx, -0.8 * open, -4.3, 7.5 - p.roll * 2, 3.7, fur);

  ctx.save();
  ctx.translate(5.5 - p.roll * 6.1, -5.4 + p.roll * 0.6);
  ctx.rotate(p.dip * open + p.roll * 0.65);
  ctx.scale(Math.max(0.08, open), Math.max(0.12, open));
  // Пологий лоб переходит в заострённый подвижный нос, а не в круглый клюв.
  shape(ctx, face, () => {
    ctx.moveTo(-2.3, -2.2);
    ctx.bezierCurveTo(0.2, -4.8, 3, -2.8, 4.2, -0.7);
    ctx.quadraticCurveTo(5.1, -0.1, 6.4, 0.5);
    ctx.quadraticCurveTo(3.9, 2.3, 0.4, 2.0);
    ctx.quadraticCurveTo(-2.4, 1.6, -2.3, -2.2);
  });
  stroke(ctx, fur, 0.6, () => {
    ctx.moveTo(0.6, 1.4);
    ctx.quadraticCurveTo(3.2, 1.9, 5.1, 0.9);
  });
  oval(ctx, -0.8, -3, 1.5, 1.8, fur, -0.2);
  oval(ctx, -0.5, -3.1, 0.8, 1.1, pink, -0.2);
  const blink = Math.sin(time * 0.0012 + h.seed) > 0.992;
  oval(ctx, 1.4, -1.65, 0.63, blink ? 0.1 : 0.57, ink);
  if (!blink) oval(ctx, 1.6, -1.9, 0.19, 0.18, '#fff6df');
  const twitch = h.state === 'sniff' ? Math.sin(time * 0.023) * 0.16 : 0;
  oval(ctx, 6.1 + twitch, 0.35, 0.86, 0.62, ink, 0.12);
  oval(ctx, 6.25 + twitch, 0.08, 0.2, 0.13, '#f0dfc9');
  for (let i = -1; i <= 1; i++)
    stroke(ctx, pigment({ r: 100, g: 82, b: 63 }, atm, 0.65), 0.18, () => {
      ctx.moveTo(4, 0.8);
      ctx.quadraticCurveTo(5.5, 1 + i * 0.5, 6.7, 1.2 + i * 0.9);
    });
  ctx.restore();

  // Шубка с короткими кончиками по силуэту и густой направленной штриховкой.
  ctx.save();
  ctx.translate(-1.1 * open, p.cy);
  const outline = () => {
    const count = 58;
    for (let i = 0; i <= count; i++) {
      const angle = (i / count) * TAU;
      const spine = i % 2 ? 0.48 + hash1(i, h.seed) * 0.36 : 0;
      const sx = Math.cos(angle) * (p.rx + spine) - Math.max(0, Math.cos(angle)) * open * 2.8;
      const sy = Math.sin(angle) * (p.ry + spine * 0.65);
      if (!i) ctx.moveTo(sx, sy);
      else ctx.lineTo(sx, sy);
    }
  };
  shape(ctx, quill, outline);
  ctx.save();
  ctx.beginPath();
  outline();
  ctx.closePath();
  ctx.clip();
  const glaze = ctx.createLinearGradient(-5, -7, 4, 6);
  glaze.addColorStop(0, mid);
  glaze.addColorStop(0.55, quill);
  glaze.addColorStop(1, shade);
  ctx.fillStyle = glaze;
  ctx.fillRect(-11, -9, 22, 18);
  // Fixed seed, never time: the quills move with the skin, they do not shimmer.
  for (let row = 0; row < 7; row++)
    for (let col = 0; col < 10; col++) {
      const n = row * 10 + col;
      const qx = -p.rx + col * p.rx * 0.22 + (row % 2) * 0.8;
      const qy = -p.ry + row * p.ry * 0.31 + hash1(n, h.seed) * 0.6;
      const length = 1.1 + hash1(n + 91, h.seed) * 1.2;
      const angle = lerp(-1.9 - qx * 0.04, Math.atan2(qy, qx), p.roll);
      const dx = Math.cos(angle) * length;
      const dy = Math.sin(angle) * length;
      limb(ctx, shade, 0.55, [
        [qx, qy],
        [qx + dx, qy + dy],
      ]);
      limb(ctx, n % 3 === 0 ? tip : mid, 0.35, [
        [qx + dx * 0.25, qy + dy * 0.25],
        [qx + dx, qy + dy],
      ]);
    }
  ctx.restore();
  // Только маленькая складка снизу выдаёт спрятанную мордочку.
  if (p.roll > 0.6) {
    ctx.globalAlpha *= (p.roll - 0.6) / 0.4;
    stroke(ctx, ink, 0.45, () => {
      ctx.moveTo(1, 3.5);
      ctx.quadraticCurveTo(3, 4.4, 4.4, 2.5);
    });
  }
  ctx.restore();
  ctx.restore();
}

export function drawSquirrel(ctx: Ctx, s: Squirrel, x: number, y: number, atm: Atmosphere, time: number): void {
  const p = squirrelPose(s, time);
  const coat = pigment({ r: 181, g: 96, b: 49 }, atm);
  const lit = pigment({ r: 217, g: 140, b: 76 }, atm);
  const dark = pigment({ r: 111, g: 59, b: 37 }, atm);
  const belly = pigment({ r: 242, g: 220, b: 174 }, atm);
  const ink = pigment({ r: 48, g: 34, b: 28 }, atm);
  const tail = pigment({ r: 161, g: 79, b: 43 }, atm);
  const u = p.upright;
  const breath = Math.sin(time * 0.0023 + s.seed) * 0.1;
  ctx.save();
  ctx.translate(x, y);
  softShadow(ctx, 0, 0, 8.5 - p.lift * 0.3, 2.3, atm.shadowTint, atm.shadowAmount * (1 - p.lift * 0.09));
  ctx.scale(s.facing, 1);

  // Орех остаётся на земле, пока белка засыпает его, а не следует за её головой.
  if (s.state === 'cache') {
    oval(ctx, 7.5, -0.05, 2.7, 0.45, pigment({ r: 112, g: 91, b: 62 }, atm, p.dig * 0.35));
    if (s.hasNut && p.cache > 0.48 && p.cache < 0.8) {
      const buried = Math.max(0, (p.cache - 0.63) / 0.17);
      ctx.save();
      ctx.globalAlpha *= 1 - buried;
      oval(ctx, 7.4, -0.75 + buried * 0.8, 1.1, 1.35, dark, 0.25);
      ctx.restore();
    }
    if (p.dig > 0)
      for (let i = 0; i < 4; i++) {
        const f = (time / 380 + i / 4) % 1;
        oval(
          ctx,
          7 - f * 4,
          -0.5 - Math.sin(f * Math.PI) * 1.8,
          0.25,
          0.18,
          pigment({ r: 131, g: 105, b: 66 }, atm, (1 - f) * p.dig * 0.7),
        );
      }
  }

  ctx.translate(0, -p.lift + breath);
  ctx.scale(1 + p.stretch, 1 - p.stretch * 0.5);
  // Пышный S-образный хвост балансирует прыжок с запаздывающим кончиком.
  ctx.save();
  ctx.translate(-4.7, -5.5);
  ctx.rotate(Math.sin(time * 0.0024 + s.seed) * 0.06 + Math.sin(p.gait - 0.6) * 0.2 * p.motion + p.dig * 0.16);
  shape(ctx, tail, () => {
    ctx.moveTo(1.8, 1.9);
    ctx.bezierCurveTo(-7, 2.4, -13.5, -2.8, -13, -11);
    ctx.bezierCurveTo(-13, -21.5, -1, -24, 0.4, -17.7);
    ctx.bezierCurveTo(1.2, -13.8, -4.4, -12.7, -5.9, -15.5);
    ctx.bezierCurveTo(-7.9, -11.1, -4.7, -4.7, 1.8, 1.9);
  });
  shape(ctx, lit, () => {
    ctx.moveTo(-0.4, 0.2);
    ctx.bezierCurveTo(-9.3, -3.4, -10.5, -9.1, -8.8, -14.7);
    ctx.bezierCurveTo(-7.5, -18.6, -2.5, -20.1, -0.1, -17.8);
    ctx.bezierCurveTo(-4.3, -23.2, -12.7, -17.4, -11.5, -10.2);
    ctx.bezierCurveTo(-10.7, -3.8, -6.4, 0.6, -0.4, 0.2);
  });
  for (let i = 0; i < 9; i++) {
    const py = -3 - i * 1.7;
    stroke(ctx, pigment({ r: 232, g: 160, b: 94 }, atm, 0.42), 0.3, () => {
      ctx.moveTo(-6.5 - Math.sin(i * 0.38) * 3, py + 1);
      ctx.quadraticCurveTo(-10.8, py - 0.3, -11 + i * 0.25, py - 2.2);
    });
  }
  for (let i = 0; i < 9; i++) {
    const py = -5 - i * 1.35;
    const px = -12.3 + Math.pow((i - 3.5) / 6, 2) * 1.8;
    limb(ctx, tail, 0.42, [
      [px + 1.1, py + 0.5],
      [px - 0.6, py - 0.8],
      [px + 0.4, py - 0.5],
    ]);
  }
  ctx.restore();

  const leg = (front: boolean, far: boolean) => {
    const rootX = front ? 3.8 : -4.1;
    const cycle = p.gait + (front ? Math.PI * 0.7 : 0) + (far ? 0.35 : 0);
    const reach = Math.cos(cycle) * 2.6 * p.motion;
    const tuck = Math.max(0, Math.sin(p.gait)) * p.motion;
    const footX = rootX + reach + (front ? 0.5 : 1.6);
    const footY = -0.5 - tuck * 1.7;
    const color = far ? dark : coat;
    if (!front) oval(ctx, -3.6, -4.5, 3.1, 3.7, color, -0.28);
    limb(ctx, color, front ? 1.1 : 1.6, [
      [rootX, -5.5],
      [rootX - 1.2 + reach * 0.4, -2.5 - tuck],
      [footX, footY],
    ]);
    oval(ctx, footX + 0.3, footY, front ? 1.2 : 1.65, 0.45, far ? dark : lit);
    if (!far)
      for (let i = 0; i < 3; i++)
        limb(ctx, ink, 0.2, [
          [footX + i * 0.35, footY],
          [footX + i * 0.35 + 0.35, footY + 0.15],
        ]);
  };
  leg(false, true);
  if (u < 0.5) leg(true, true);

  // Поворот грудной клетки: между четвереньками и сидением, без смены высоты мира.
  const chestX = lerp(1.6, 0.2, u);
  const chestY = lerp(-6.5, -9.7, u);
  oval(ctx, -1.8, -5.8, 5.7, 3.3, coat, -0.08);
  oval(ctx, chestX, chestY, lerp(4.7, 3.2, u), lerp(3.2, 5.4, u), coat, -u * 0.1);
  oval(ctx, chestX + 1.0, chestY + 0.9, 1.95, lerp(1.8, 4.2, u), belly, -u * 0.15);
  stroke(ctx, lit, 0.8, () => {
    ctx.moveTo(-5.6, -7.5);
    ctx.quadraticCurveTo(-2.8, -10 - u * 2, 0.6, -10.3 - u * 2);
  });
  leg(false, false);

  const hx = lerp(5.0, 2.5, u) + p.dig * 1.3;
  const hy = lerp(-8.9, -15.1, u) + p.dig * 3.4;
  ctx.save();
  ctx.translate(hx, hy);
  ctx.rotate(p.dig * 0.28 + (s.state === 'look' ? Math.sin(time * 0.0018) * 0.09 : 0));
  for (const far of [true, false]) {
    const ex = far ? 0.4 : -1.3;
    oval(ctx, ex, -2.7, 0.85, 1.9, far ? dark : coat, far ? 0.18 : -0.2);
    if (!far) oval(ctx, ex + 0.05, -2.8, 0.4, 1.05, pigment({ r: 219, g: 156, b: 112 }, atm), -0.2);
    for (let i = 0; i < 3; i++)
      limb(ctx, far ? dark : coat, 0.35, [
        [ex + i * 0.25 - 0.3, -4],
        [ex + i * 0.35 - 0.6, -5.5 + i * 0.28],
      ]);
  }
  oval(ctx, 0, 0, 3, 2.6, coat, -0.16);
  shape(ctx, lit, () => {
    ctx.moveTo(0.7, -1.4);
    ctx.quadraticCurveTo(2.8, -0.8, 4.1, 0.8);
    ctx.quadraticCurveTo(2.6, 2.4, 0.3, 1.4);
  });
  oval(ctx, 2.4, 1.25, 1.5, 0.7, belly, 0.1);
  oval(ctx, 3.65, 0.65, 0.48, 0.37, ink);
  const blink = Math.sin(time * 0.001 + s.seed) > 0.993;
  oval(ctx, 0.95, -0.7, 0.7, blink ? 0.13 : 0.76, ink, -0.1);
  if (!blink) oval(ctx, 1.15, -0.97, 0.22, 0.21, '#fff8e6');
  const nibble = s.state === 'forage' && s.hasNut ? Math.sin(time * 0.022) * 0.14 : 0;
  limb(ctx, dark, 0.25, [
    [2.1, 1.6 + nibble],
    [3.1, 1.45 + nibble],
  ]);
  for (const side of [-1, 1])
    limb(ctx, pigment({ r: 99, g: 65, b: 41 }, atm, 0.6), 0.18, [
      [2.6, 1.1],
      [4.9, 1.4 + side * 0.6],
    ]);
  ctx.restore();

  // Передние лапы держат орех, тянутся к земле или работают попеременно.
  if (u > 0.35 || s.state === 'cache' || s.hasNut) {
    const working = s.state === 'cache';
    const nutX = working ? lerp(5.1, 7.4, Math.min(1, p.cache / 0.5)) : hx + 2.2;
    const nutY = working ? lerp(-5.7, -1, Math.min(1, p.cache / 0.5)) : hy + 3.2;
    for (const side of [-1, 1]) {
      const scrape = working && p.cache > 0.48 ? Math.sin(time * 0.019 + side * Math.PI * 0.5) * p.dig : 0;
      limb(ctx, side === -1 ? dark : coat, 1.1, [
        [chestX + 1.2, chestY],
        [chestX + 2.5, chestY + 2.2],
        [nutX + side * 0.8 + scrape, nutY + 0.5],
      ]);
      oval(ctx, nutX + side * 0.8 + scrape, nutY + 0.5, 0.8, 0.5, lit, -0.5);
    }
    if (s.hasNut && (!working || p.cache < 0.5)) {
      oval(ctx, nutX, nutY, 1.25, 1.6, dark, 0.2);
      oval(ctx, nutX + 0.25, nutY - 0.4, 0.62, 0.9, lit, 0.2);
      limb(ctx, belly, 0.22, [
        [nutX + 0.1, nutY - 1],
        [nutX - 0.3, nutY + 0.9],
      ]);
    }
  } else leg(true, false);
  ctx.restore();
}
