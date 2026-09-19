/** Лягушки и кои: работа суставов и плавников вместо движения цельного овала. */
import type { Frog } from '../world/residents';
import type { Fish } from '../world/life';
import type { Atmosphere } from '../world/palette';
import { clamp01, smoothstep } from '../core/rng';
import { Ctx, softShadow } from './paint';
import { oval, shape, stroke, limb, pigment, TAU } from './animalBrush';

export function drawFrog(ctx: Ctx, f: Frog, x: number, y: number, atm: Atmosphere, time: number): void {
  if (f.hidden > 0) return;
  const green = f.species === 'green';
  const back = pigment(green ? { r: 112, g: 149, b: 77 } : { r: 150, g: 120, b: 82 }, atm);
  const dark = pigment(green ? { r: 62, g: 103, b: 66 } : { r: 91, g: 73, b: 52 }, atm);
  const light = pigment(green ? { r: 180, g: 199, b: 113 } : { r: 212, g: 179, b: 119 }, atm);
  const cream = pigment({ r: 235, g: 232, b: 186 }, atm),
    gold = pigment({ r: 206, g: 170, b: 70 }, atm);
  const ink = pigment({ r: 39, g: 49, b: 36 }, atm);
  const phase = clamp01(f.phase);
  const hopping = f.state === 'hop';
  const jump = hopping ? Math.sin(phase * Math.PI) : 0;
  const extension = hopping ? smoothstep(0.02, 0.3, phase) * (1 - smoothstep(0.6, 1, phase)) : 0;
  const diving = f.state === 'dive';
  const emerge = f.state === 'emerge';
  const submerged = diving ? smoothstep(0.3, 1, phase) : emerge ? 1 - phase : 0;
  const throat = clamp01(f.throat);
  const breath = Math.sin(time * 0.002 + f.seed) * 0.09;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(f.facing * f.size, f.size);
  softShadow(ctx, 0, 0, 7 - jump * 2, 2, atm.shadowTint, atm.shadowAmount * (1 - jump * 0.6) * (1 - submerged));
  ctx.globalAlpha *= 1 - submerged;
  ctx.translate(0, -jump * 9 + submerged * 4);
  ctx.rotate(diving ? phase * 0.65 : -jump * 0.12);
  // Бёдра складываются вдоль туловища, голени распрямляются позади в толчке.
  for (const side of [-1, 1]) {
    const far = side === -1;
    const kneeX = -4.4 - extension * 3.8;
    const kneeY = -2.3 + side * 0.7;
    const footX = -2.3 - extension * 10;
    const footY = -0.1 + extension * 2.2 + side * 0.35;
    oval(ctx, -3.4, -3.3, 3.5, 2.6, far ? dark : back, -0.38);
    limb(ctx, far ? dark : light, 1.2, [
      [-3.5, -3],
      [kneeX, kneeY],
      [footX, footY],
    ]);
    for (let toe = -1; toe <= 1; toe++) {
      shape(ctx, far ? dark : back, () => {
        ctx.moveTo(footX, footY - 0.2);
        ctx.lineTo(footX - 1.7 - extension, footY + toe * 0.7);
        ctx.lineTo(footX + 0.6, footY + 0.35);
      });
    }
  }
  oval(ctx, -0.2, -4.3 + breath, 5.9 + extension, 3.1 - extension * 0.35, back, -0.09);
  oval(ctx, 0.6, -2.7, 4.4, 1.4, cream);
  stroke(ctx, light, 0.65, () => {
    ctx.moveTo(-4.6, -5.7);
    ctx.quadraticCurveTo(-0.8, -8, 4.6, -5.3);
  });
  for (let i = 0; i < 7; i++) oval(ctx, -3.9 + i * 0.95, -5.4 + (i % 2) * 1.4, 0.6, 0.37, dark, i * 0.7);
  // Передние лапы вытягиваются на приземлении, пальцы расходятся веером.
  for (const side of [-1, 1]) {
    const fx = 3.6 + extension * 3.4 + side * 0.4;
    const fy = -0.2 - jump * 0.8;
    limb(ctx, side === -1 ? dark : back, 0.85, [
      [2.6, -3.3],
      [2.7 + extension * 2, -1.1],
      [fx, fy],
    ]);
    for (let i = -1; i <= 1; i++)
      limb(ctx, light, 0.32, [
        [fx, fy],
        [fx + 1.2, fy + i * 0.5],
      ]);
  }
  if (throat > 0) {
    oval(ctx, 4.3, -2 + throat * 0.9, 1.6 + throat * 1.6, 1.2 + throat * 1.35, cream);
    stroke(ctx, pigment({ r: 160, g: 174, b: 108 }, atm, 0.6), 0.28, () => {
      ctx.moveTo(3.1, -1.2);
      ctx.quadraticCurveTo(4.8, throat * 2.6, 6, -0.7);
    });
  }
  oval(ctx, 3.7, -4.7, 3.9, 2.2, back);
  stroke(ctx, cream, 0.55, () => {
    ctx.moveTo(2, -3.4);
    ctx.quadraticCurveTo(5, -2.8, 7, -4);
  });
  for (const [ex, ey] of [
    [2.6, -6.3],
    [5.5, -6.0],
  ]) {
    oval(ctx, ex, ey, 1.65, 1.7, back);
    const blink = Math.sin(time * 0.0009 + f.seed) > 0.986 || (diving && phase > 0.4);
    oval(ctx, ex + 0.15, ey - 0.25, 1.1, blink ? 0.15 : 1.05, gold);
    if (!blink) {
      oval(ctx, ex + 0.25, ey - 0.2, 0.87, 0.3, ink);
      oval(ctx, ex + 0.6, ey - 0.5, 0.2, 0.18, '#fff8db');
    }
  }
  oval(ctx, 6.8, -4.8, 0.19, 0.16, ink);
  ctx.restore();
  if (diving || emerge) {
    ctx.save();
    stroke(ctx, pigment({ r: 176, g: 201, b: 186 }, atm, (1 - phase) * 0.6), 0.6, () =>
      ctx.ellipse(x, y, 4 + phase * 10, 1.5 + phase * 3.5, 0, 0, TAU),
    );
    ctx.restore();
  }
}

export function drawFishAt(ctx: Ctx, f: Fish, x: number, y: number, atm: Atmosphere, time: number): void {
  const kind = ((Math.floor(f.seed) % 3) + 3) % 3;
  const bases = [
    { r: 221, g: 115, b: 67 },
    { r: 242, g: 236, b: 211 },
    { r: 226, g: 188, b: 90 },
  ];
  const body = pigment(bases[kind], atm),
    white = pigment({ r: 253, g: 239, b: 205 }, atm);
  const red = pigment({ r: 195, g: 82, b: 59 }, atm),
    dark = pigment({ r: 86, g: 100, b: 82 }, atm);
  const ink = pigment({ r: 51, g: 66, b: 58 }, atm);
  const feeding = f.state === 'feed',
    hiding = f.state === 'hide';
  const rate = hiding ? 0.014 : f.state === 'approach' ? 0.009 : feeding ? 0.004 : 0.006;
  const wave = Math.sin(time * rate + f.seed);
  const bend = wave * (hiding ? 1.4 : 0.7);
  const sx = Math.cos(f.dir),
    sy = Math.sin(f.dir);
  const angle = Math.atan2((sx + sy) * 0.5, sx - sy);
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.globalAlpha *= hiding ? 0.34 : 0.86;
  oval(ctx, 0, 2.1, 9.2, 2.9, pigment({ r: 67, g: 111, b: 107 }, atm, 0.18));
  // Хвостовой стебель сгибается отдельно; две лопасти веером подхватывают воду.
  ctx.save();
  ctx.translate(-7, bend * 0.8);
  ctx.rotate(bend * 0.24);
  shape(ctx, pigment(bases[kind], atm, 0.66), () => {
    ctx.moveTo(1, -1);
    ctx.quadraticCurveTo(-3, -1.3, -8.7, -5.5);
    ctx.quadraticCurveTo(-8.4, -0.6, -5.7, 0);
    ctx.quadraticCurveTo(-8.5, 2.2, -8.7, 5.5);
    ctx.quadraticCurveTo(-3, 1, 1, 1);
  });
  for (const side of [-1, 1])
    for (let i = 0; i < 3; i++)
      limb(ctx, pigment({ r: 251, g: 236, b: 198 }, atm, 0.55), 0.25, [
        [-0.4, side * 0.5],
        [-7.3, side * (1.4 + i * 1.35)],
      ]);
  ctx.restore();
  for (const side of [-1, 1]) {
    ctx.save();
    ctx.translate(2.1, side * 2.1);
    ctx.rotate(side * (0.15 + wave * 0.3));
    shape(ctx, pigment(bases[kind], atm, 0.55), () => {
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(-1, side * 5, -5, side * 3.2);
      ctx.lineTo(-3.2, 0);
    });
    for (let i = 0; i < 3; i++)
      limb(ctx, white, 0.18, [
        [-0.7, 0],
        [-3.5 + i * 0.8, side * (2 + i * 0.3)],
      ]);
    ctx.restore();
  }
  const outline = () => {
    ctx.moveTo(8.7, 0);
    ctx.bezierCurveTo(8.4, -4.4, 0.3, -4.7, -7.7, -1.4 + bend * 0.7);
    ctx.lineTo(-8.5, bend * 0.9);
    ctx.lineTo(-7.7, 1.4 + bend * 0.7);
    ctx.bezierCurveTo(-0.3, 4.6, 8.4, 4.1, 8.7, 0);
  };
  shape(ctx, body, outline);
  ctx.save();
  ctx.beginPath();
  outline();
  ctx.clip();
  oval(ctx, 0.4, 2.1, 7.9, 1.7, pigment({ r: 249, g: 229, b: 185 }, atm, 0.5));
  for (const [px, py, rx, ry] of [
    [3.6, -0.2, 2.6, 2.8],
    [-1.8, 0.3, 2.1, 2.0],
    [-5, -0.9, 1.4, 1.2],
  ]) {
    oval(ctx, px, py, rx, ry, kind === 1 ? red : white, 0.35);
  }
  for (let row = -1; row <= 1; row++)
    for (let col = 0; col < 6; col++)
      stroke(ctx, pigment({ r: 125, g: 105, b: 74 }, atm, 0.18), 0.18, () => {
        const xx = -4 + col * 1.6 + (row ? 0.4 : 0);
        ctx.moveTo(xx, row * 1.5 - 0.5);
        ctx.quadraticCurveTo(xx - 0.75, row * 1.5, xx, row * 1.5 + 0.5);
      });
  stroke(ctx, pigment({ r: 255, g: 252, b: 229 }, atm, 0.6), 0.5, () => {
    ctx.moveTo(-4, -1.6);
    ctx.quadraticCurveTo(1.3, -3.6, 5.9, -1.9);
  });
  ctx.restore();
  shape(ctx, pigment(bases[kind], atm, 0.65), () => {
    ctx.moveTo(1, -1.8);
    ctx.lineTo(-1.5, -3.6 - Math.abs(wave) * 0.4);
    ctx.lineTo(-4.1, -1.5);
  });
  stroke(ctx, dark, 0.35, () => {
    ctx.moveTo(5.5, -2.5);
    ctx.quadraticCurveTo(4.6, 0, 5.5, 2.4);
  });
  for (const side of [-1, 1]) {
    oval(ctx, 7, side * 1.8, 0.46, 0.5, ink);
    oval(ctx, 7.13, side * 1.8 - 0.15, 0.14, 0.13, white);
    stroke(ctx, white, 0.22, () => {
      ctx.moveTo(8.2, side * 0.8);
      ctx.quadraticCurveTo(10, side * 1.2, 10.3, side * 0.45);
    });
  }
  const mouth = feeding ? 0.3 + (Math.sin(time * 0.009) + 1) * 0.28 : 0.22;
  oval(ctx, 8.4, 0, mouth * 0.5, mouth, dark);
  if (feeding)
    for (let i = 0; i < 3; i++) {
      const p = (time / 1700 + i / 3) % 1;
      stroke(ctx, pigment({ r: 230, g: 244, b: 216 }, atm, (1 - p) * 0.7), 0.27, () =>
        ctx.ellipse(9 + i * 0.5, -p * 4 - i * 0.6, 0.4 + p * 0.65, 0.4 + p * 0.65, 0, 0, TAU),
      );
    }
  ctx.restore();
}
