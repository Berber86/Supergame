/** Шесть семейств насекомых: жилки, сегменты, разные посадки и фазы взмаха. */
import type { Flutter } from '../world/life';
import type { PondDragonfly } from '../world/residents';
import { fireflyGlow, type Bee, type Firefly, type Moth } from '../world/wildlife';
import type { Atmosphere } from '../world/palette';
import { hash1 } from '../core/rng';
import { Ctx, softShadow, glow } from './paint';
import { oval, shape, stroke, limb, pigment } from './animalBrush';

export function drawButterfly(ctx: Ctx, f: Flutter, x: number, y: number, atm: Atmosphere, time: number): void {
  const hue = hash1(Math.floor(f.seed), 41);
  const base =
    hue < 0.34 ? { r: 220, g: 155, b: 105 } : hue < 0.67 ? { r: 151, g: 179, b: 196 } : { r: 220, g: 164, b: 167 };
  const wing = pigment(base, atm),
    cream = pigment({ r: 249, g: 232, b: 177 }, atm);
  const edge = pigment({ r: 93, g: 83, b: 77 }, atm),
    body = pigment({ r: 63, g: 68, b: 59 }, atm);
  const resting = f.resting > 0;
  const open = resting
    ? 0.19 + Math.sin(time * 0.0014) * 0.055
    : 0.15 + Math.abs(Math.sin(time * 0.012 + f.seed)) * 0.85;
  ctx.save();
  ctx.translate(x, y);
  softShadow(ctx, 0, 0, 3.6, 1.3, atm.shadowTint, atm.shadowAmount * 0.55);
  ctx.translate(0, -f.alt);
  ctx.rotate(resting ? -0.18 : Math.sin(time * 0.003 + f.seed) * 0.13);
  for (const side of [-1, 1]) {
    ctx.save();
    ctx.scale(side * open, 1);
    const outline = () => {
      ctx.moveTo(0.2, -0.3);
      ctx.bezierCurveTo(3, -5, 7.4, -9.5, 9, -6.8);
      ctx.bezierCurveTo(11.3, -3.5, 7.4, 0, 5.3, 0.9);
      ctx.bezierCurveTo(10, 4, 6.3, 8.4, 4.7, 5.9);
      ctx.quadraticCurveTo(1.5, 6.7, 0.2, 1);
    };
    shape(ctx, edge, outline);
    ctx.save();
    ctx.scale(0.88, 0.87);
    shape(ctx, wing, outline);
    ctx.restore();
    shape(ctx, cream, () => {
      ctx.moveTo(0.8, -0.5);
      ctx.quadraticCurveTo(4.2, -5.9, 7.8, -6.6);
      ctx.quadraticCurveTo(6, -2.7, 3.4, -0.9);
    });
    for (let i = 0; i < 4; i++)
      stroke(ctx, pigment({ r: 89, g: 80, b: 74 }, atm, 0.55), 0.22, () => {
        ctx.moveTo(0.6, 0);
        ctx.quadraticCurveTo(3, -0.5 - i, 7.7 - i * 1.4, -2.8 - i * 1.25);
      });
    for (let i = 0; i < 5; i++) oval(ctx, 7.4 + Math.sin(i * 0.6) * 1.6, -5.8 + i * 1.15, 0.34, 0.42, cream, 0.3);
    oval(ctx, 4.9, 3.8, 1.4, 1.15, edge, -0.3);
    oval(ctx, 4.9, 3.8, 0.8, 0.65, cream, -0.3);
    oval(ctx, 5.0, 3.75, 0.35, 0.32, wing);
    limb(ctx, edge, 0.35, [
      [3.9, 5.1],
      [3.4, 7.4],
    ]);
    ctx.restore();
  }
  oval(ctx, 0, 0.6, 0.58, 3.0, body);
  oval(ctx, 0, -2, 0.8, 0.8, body);
  for (const side of [-1, 1]) {
    stroke(ctx, body, 0.2, () => {
      ctx.moveTo(side * 0.25, -2.5);
      ctx.quadraticCurveTo(side * 1.1, -4.1, side * 1.6, -4.8);
    });
    oval(ctx, side * 1.6, -4.8, 0.25, 0.34, body);
    for (let i = 0; i < 3; i++)
      limb(ctx, body, 0.18, [
        [0, -0.8 + i * 0.8],
        [side * 1.2, i * 0.8],
        [side * 1.6, 1.3 + i * 0.7],
      ]);
  }
  ctx.restore();
}

export function drawMoth(ctx: Ctx, m: Moth, x: number, y: number, atm: Atmosphere, time: number): void {
  if (m.alpha <= 0) return;
  const wing = pigment({ r: 218, g: 213, b: 181 }, atm),
    dark = pigment({ r: 138, g: 131, b: 102 }, atm);
  const pale = pigment({ r: 246, g: 235, b: 201 }, atm),
    body = pigment({ r: 118, g: 112, b: 85 }, atm);
  const rest = m.state === 'rest';
  const open = rest ? 0.44 + Math.sin(time * 0.002) * 0.015 : 0.2 + Math.abs(Math.sin(time * 0.017 + m.flutter)) * 0.8;
  ctx.save();
  ctx.globalAlpha *= m.alpha;
  ctx.translate(x, y - (rest ? 3 : 10 + Math.sin(time * 0.0023 + m.seed) * 1.2));
  ctx.scale(0.78, 0.78);
  for (const side of [-1, 1]) {
    ctx.save();
    ctx.scale(side * open, 1);
    ctx.rotate(rest ? -0.25 : 0);
    shape(ctx, wing, () => {
      ctx.moveTo(0, -1.4);
      ctx.bezierCurveTo(3, -5.2, 8.6, -5.2, 9, -2);
      ctx.lineTo(7.7, 1);
      ctx.lineTo(6.4, 0.8);
      ctx.quadraticCurveTo(7.9, 4.8, 3.2, 5.2);
      ctx.lineTo(0.4, 1.4);
    });
    for (let i = 0; i < 2; i++)
      stroke(ctx, dark, 0.45, () => {
        ctx.moveTo(3 + i * 2, -3.8);
        ctx.quadraticCurveTo(3.4 + i * 2.1, -0.4, 6.7 + i, 0.4);
      });
    oval(ctx, 5.5, -1.8, 1.1, 0.75, dark, 0.3);
    oval(ctx, 5.5, -1.8, 0.55, 0.39, pale, 0.3);
    stroke(ctx, dark, 0.3, () => {
      ctx.moveTo(2.1, 2.7);
      ctx.quadraticCurveTo(4.2, 2.1, 6.2, 3.4);
    });
    for (let i = 0; i < 5; i++)
      limb(ctx, pale, 0.22, [
        [3 + i, 4.1],
        [3.3 + i, 4.7 - i * 0.2],
      ]);
    ctx.restore();
  }
  oval(ctx, 0, 0.9, 0.85, 2.9, body);
  oval(ctx, 0, -1.5, 1.25, 1.4, pale);
  oval(ctx, 0, -2.6, 0.66, 0.6, dark);
  for (const side of [-1, 1]) {
    limb(ctx, dark, 0.22, [
      [0, -2.9],
      [side * 1.2, -4.2],
      [side * 2, -4.6],
    ]);
    for (let i = 0; i < 4; i++)
      limb(ctx, dark, 0.15, [
        [side * (0.5 + i * 0.35), -3.5 - i * 0.28],
        [side * (0.8 + i * 0.45), -4.2 - i * 0.24],
      ]);
    for (let i = 0; i < 3; i++)
      limb(ctx, dark, 0.19, [
        [0, -1 + i * 0.9],
        [side * 1.2, i * 0.6],
        [side * 1.8, i * 0.9 + 1],
      ]);
  }
  ctx.restore();
}

export function drawDragonfly(ctx: Ctx, d: PondDragonfly, x: number, y: number, atm: Atmosphere, time: number): void {
  const hawker = d.kind === 'hawker',
    rest = d.state === 'perch';
  const shell = pigment(hawker ? { r: 87, g: 153, b: 177 } : { r: 131, g: 176, b: 104 }, atm);
  const deep = pigment({ r: 46, g: 85, b: 83 }, atm),
    pale = pigment({ r: 187, g: 219, b: 172 }, atm);
  const wing = pigment({ r: 221, g: 238, b: 222 }, atm, 0.48),
    vein = pigment({ r: 133, g: 168, b: 162 }, atm, 0.55);
  const len = hawker ? 11.8 : 14.0;
  const speed = d.state === 'chase' ? 0.073 : d.state === 'hover' ? 0.05 : 0.058;
  ctx.save();
  ctx.translate(x, y);
  softShadow(ctx, 0, 0, 4.5, 1.3, atm.shadowTint, atm.shadowAmount * 0.5);
  ctx.translate(0, -d.alt - (rest ? 0 : Math.sin(time * 0.003 + d.seed) * 0.35));
  if (rest) ctx.scale(d.facing < 0 ? -1 : 1, 1);
  else if (Math.hypot(d.vx, d.vy) > 0.000001) ctx.rotate(Math.atan2((d.vx + d.vy) * 0.5, d.vx - d.vy));
  ctx.scale(0.8, 0.8);
  for (const side of [-1, 1])
    for (let pair = 0; pair < 2; pair++) {
      ctx.save();
      ctx.translate(1 - pair * 2.2, side * 0.3);
      const flap = rest ? 1 : 0.3 + Math.abs(Math.sin(time * speed + pair * 1.8 + d.seed)) * 0.7;
      ctx.rotate(rest && !hawker ? side * 1.27 : side * (0.1 + pair * 0.17));
      ctx.scale(1, side * (rest && !hawker ? 0.82 : flap));
      shape(ctx, wing, () => {
        ctx.moveTo(0, 0);
        ctx.bezierCurveTo(2.7, 2.6, 3.2, 8.4, 1.0, 10.1 - pair);
        ctx.bezierCurveTo(-1, 10, -3.1, 5, -1.7, 0);
      });
      stroke(ctx, vein, 0.22, () => {
        ctx.moveTo(0, 0);
        ctx.quadraticCurveTo(1.3, 5.5, 1, 9.5 - pair);
      });
      for (let i = 0; i < 5; i++)
        limb(ctx, vein, 0.12, [
          [0.5, 2 + i * 1.4],
          [-1.2, 2.8 + i * 1.1],
        ]);
      limb(ctx, deep, 0.38, [
        [0.9, 8.2 - pair],
        [1.8, 8.0 - pair],
      ]);
      ctx.restore();
    }
  for (let i = 0; i < 9; i++) {
    const xx = -1.4 - (i * len) / 10;
    oval(
      ctx,
      xx,
      Math.sin(time * 0.002 + i * 0.15) * 0.08,
      len / 15,
      (hawker ? 0.95 : 0.58) * (1 - i * 0.055),
      i % 2 ? deep : shell,
    );
  }
  oval(ctx, 1.4, 0, 2.1, 1.35, deep);
  oval(ctx, 1.5, -0.35, 1.5, 0.75, shell);
  for (const side of [-1, 1]) {
    for (let i = 0; i < 3; i++)
      limb(ctx, deep, 0.2, [
        [1.8 - i * 0.8, side * 0.5],
        [2.5 - i, side * 1.7],
        [1.8 - i * 1.3, side * 2.3],
      ]);
    oval(ctx, 3.8, side * (hawker ? 0.6 : 0.95), hawker ? 1.3 : 0.85, 0.85, shell);
    oval(ctx, 4.15, side * (hawker ? 0.6 : 0.95) - 0.2, 0.4, 0.27, pale);
  }
  ctx.restore();
}

export function drawBee(ctx: Ctx, b: Bee, x: number, y: number, atm: Atmosphere, time: number): void {
  if (b.alpha <= 0) return;
  const gold = pigment({ r: 224, g: 174, b: 64 }, atm),
    light = pigment({ r: 246, g: 216, b: 125 }, atm);
  const ink = pigment({ r: 64, g: 59, b: 42 }, atm),
    hair = pigment({ r: 185, g: 151, b: 89 }, atm);
  const gather = b.state === 'gather';
  const hover = gather ? 0 : Math.sin(time * 0.005 + b.seed) * 0.55;
  ctx.save();
  ctx.globalAlpha *= b.alpha;
  ctx.translate(x, y - b.alt + hover);
  ctx.scale(0.76, 0.76);
  const facing = b.vx - b.vy < -0.00001 ? -1 : 1;
  ctx.scale(facing, 1);
  ctx.rotate(gather ? 0.27 : b.state === 'return' ? -0.12 : 0);
  for (const side of [-1, 1]) {
    ctx.save();
    ctx.translate(-0.2, -1.2);
    ctx.rotate(side * (gather ? 0.2 : Math.sin(time * 0.08 + side) * 0.65));
    oval(
      ctx,
      -1,
      side * 1.4 - 2.4,
      3.5,
      gather ? 0.7 : 1.3,
      pigment({ r: 218, g: 236, b: 224 }, atm, 0.45),
      -side * 0.28,
    );
    limb(ctx, pigment({ r: 150, g: 179, b: 162 }, atm, 0.48), 0.18, [
      [0, 0],
      [-3.2, side * 1.4 - 2.4],
    ]);
    ctx.restore();
  }
  for (let i = 0; i < 3; i++)
    for (const side of [-1, 1]) {
      const brush = gather ? Math.sin(time * 0.012 + i) * 0.4 : 0;
      limb(ctx, ink, 0.25, [
        [-2 + i * 1.5, 0.6],
        [-2.3 + i * 1.4, 2 + side * 0.3],
        [-1.6 + i * 1.6 + brush, 2.6 + side * 0.4],
      ]);
      if (b.carrying && i === 0) oval(ctx, -1.7, 2.5 + side * 0.4, 0.7, 0.8, light);
    }
  oval(ctx, -2.1, 0, 3.1, 1.8, gold);
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(-2.1, 0, 3.1, 1.8, 0, 0, Math.PI * 2);
  ctx.clip();
  for (let i = 0; i < 3; i++)
    stroke(ctx, ink, 0.7, () => {
      ctx.moveTo(-4.1 + i * 1.65, -2.3);
      ctx.quadraticCurveTo(-3.4 + i * 1.65, 0, -4.1 + i * 1.65, 2.3);
    });
  ctx.restore();
  oval(ctx, 0.4, -0.15, 1.8, 1.8, hair);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    limb(ctx, light, 0.18, [
      [0.4 + Math.cos(a) * 1.2, Math.sin(a) * 1.2 - 0.15],
      [0.4 + Math.cos(a) * 1.8, Math.sin(a) * 1.8 - 0.15],
    ]);
  }
  oval(ctx, 2.4, -0.2, 1.2, 1.3, ink);
  oval(ctx, 2.8, -0.6, 0.5, 0.7, pigment({ r: 34, g: 43, b: 35 }, atm));
  oval(ctx, 3, -0.9, 0.15, 0.14, light);
  for (const side of [-1, 1])
    limb(ctx, ink, 0.2, [
      [2.7, -1],
      [3.3 + side * 0.4, -2.3],
      [3.7 + side * 0.4, -2.1],
    ]);
  if (gather)
    limb(ctx, ink, 0.23, [
      [3.1, 0.6],
      [3.9, 2.4 + Math.sin(time * 0.007) * 0.3],
    ]);
  ctx.restore();
}

export function drawFirefly(ctx: Ctx, f: Firefly, x: number, y: number, atm: Atmosphere, time: number): void {
  if (f.alpha <= 0) return;
  const rest = f.state === 'rest';
  const strength = fireflyGlow(f, time) * (rest ? 0.55 : 1);
  const py = y - (rest ? 2 : 7 + Math.sin(time * 0.0021 + f.seed) * 1.4);
  const dark = pigment({ r: 58, g: 74, b: 47 }, atm),
    red = pigment({ r: 186, g: 125, b: 77 }, atm);
  ctx.save();
  ctx.globalAlpha *= f.alpha;
  ctx.translate(x, py);
  if (strength > 0.01) glow(ctx, -0.8, 0.4, 4 + strength * 4, { r: 207, g: 235, b: 122 }, strength * 0.48);
  ctx.rotate(rest ? -0.5 : Math.sin(f.dir) * 0.22);
  if (!rest)
    for (const side of [-1, 1]) {
      oval(
        ctx,
        -0.2,
        side * (1.2 + Math.abs(Math.sin(time * 0.06)) * 0.8),
        2.5,
        0.7,
        pigment({ r: 197, g: 218, b: 170 }, atm, 0.38),
        side * 0.35,
      );
    }
  oval(ctx, -0.3, 0, 2.1, 1.0, dark);
  oval(ctx, -1.4, 0, 0.8, 0.85, `rgba(215,239,129,${0.3 + strength * 0.7})`);
  limb(ctx, pigment({ r: 179, g: 187, b: 122 }, atm), 0.22, [
    [-1, 0],
    [0.9, 0],
  ]);
  oval(ctx, 1.1, 0, 0.75, 0.95, red);
  oval(ctx, 1.9, 0, 0.55, 0.55, dark);
  for (const side of [-1, 1]) {
    limb(ctx, dark, 0.18, [
      [2, side * 0.2],
      [2.9, side * 0.7],
    ]);
    for (let i = 0; i < 3; i++)
      limb(ctx, dark, 0.2, [
        [0.8 - i * 0.8, side * 0.5],
        [1 - i * 0.9, side * 1.4],
      ]);
  }
  ctx.restore();
}
