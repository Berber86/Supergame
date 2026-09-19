/** Пять разных силуэтов певчих птиц и общий сочленённый полёт. */
import type { Bird, BirdSpecies } from '../world/life';
import type { Atmosphere, RGB } from '../world/palette';
import { Ctx, softShadow } from './paint';
import { oval, shape, stroke, limb, pigment, TAU } from './animalBrush';

const SPECIES: Record<
  BirdSpecies,
  { back: RGB; breast: RGB; cap: RGB; cheek: RGB; wing: RGB; tail: number; beak: number; round: number }
> = {
  sparrow: {
    back: { r: 148, g: 115, b: 80 },
    breast: { r: 214, g: 199, b: 171 },
    cap: { r: 128, g: 90, b: 60 },
    cheek: { r: 233, g: 220, b: 191 },
    wing: { r: 86, g: 68, b: 51 },
    tail: 8,
    beak: 2.4,
    round: 1,
  },
  tit: {
    back: { r: 123, g: 142, b: 97 },
    breast: { r: 227, g: 205, b: 83 },
    cap: { r: 42, g: 61, b: 62 },
    cheek: { r: 247, g: 238, b: 205 },
    wing: { r: 87, g: 112, b: 123 },
    tail: 9,
    beak: 2.0,
    round: 0.94,
  },
  finch: {
    back: { r: 151, g: 126, b: 94 },
    breast: { r: 210, g: 153, b: 124 },
    cap: { r: 116, g: 144, b: 152 },
    cheek: { r: 218, g: 164, b: 132 },
    wing: { r: 67, g: 83, b: 83 },
    tail: 9,
    beak: 2.8,
    round: 1.04,
  },
  wagtail: {
    back: { r: 140, g: 154, b: 154 },
    breast: { r: 239, g: 234, b: 211 },
    cap: { r: 49, g: 65, b: 70 },
    cheek: { r: 248, g: 241, b: 218 },
    wing: { r: 68, g: 87, b: 95 },
    tail: 16,
    beak: 3.3,
    round: 0.81,
  },
  bullfinch: {
    back: { r: 147, g: 162, b: 166 },
    breast: { r: 209, g: 113, b: 101 },
    cap: { r: 46, g: 60, b: 68 },
    cheek: { r: 209, g: 113, b: 101 },
    wing: { r: 60, g: 75, b: 87 },
    tail: 7,
    beak: 2.2,
    round: 1.18,
  },
};

export function drawBird(ctx: Ctx, b: Bird, x: number, y: number, atm: Atmosphere, time: number): void {
  const sp = SPECIES[b.species];
  const back = pigment(sp.back, atm),
    breast = pigment(sp.breast, atm),
    cap = pigment(sp.cap, atm);
  const cheek = pigment(sp.cheek, atm),
    wingColor = pigment(sp.wing, atm);
  const ivory = pigment({ r: 244, g: 232, b: 198 }, atm),
    ink = pigment({ r: 35, g: 41, b: 38 }, atm);
  const foot = pigment({ r: 148, g: 120, b: 91 }, atm);
  const flying = b.state === 'fly-in' || b.state === 'fly-out';
  const bathing = b.state === 'bathe';
  const peck = b.state === 'peck' || b.state === 'feed' || b.state === 'drink';
  const dip = peck ? Math.pow((Math.sin(time * (b.state === 'drink' ? 0.003 : 0.008) + b.seed) + 1) * 0.5, 3) : 0;
  const hop = b.state === 'hop' ? Math.max(0, Math.sin(b.hop)) : 0;
  const scale = b.scale * 0.72;
  ctx.save();
  ctx.translate(x, y);
  softShadow(
    ctx,
    0,
    0,
    5 * scale,
    1.8 * scale,
    atm.shadowTint,
    atm.shadowAmount * Math.max(0.15, 1 - b.alt / 45) * (1 - hop * 0.4),
  );
  ctx.translate(0, -b.alt - hop * 3);
  ctx.scale(b.facing * scale, scale);
  ctx.rotate(bathing ? Math.sin(time * 0.022) * 0.12 : dip * 0.5);

  ctx.save();
  ctx.translate(-4.8, -5.2);
  ctx.rotate(b.species === 'wagtail' ? Math.sin(time * 0.006) * 0.16 : flying ? -0.12 : 0.1);
  shape(ctx, wingColor, () => {
    ctx.moveTo(0, -1);
    ctx.lineTo(-sp.tail, -3.5);
    ctx.lineTo(-sp.tail + 1, -1.3);
    ctx.lineTo(-sp.tail, 0.4);
    ctx.lineTo(0, 1.7);
  });
  limb(ctx, ivory, 0.45, [
    [-2, -0.1],
    [-sp.tail + 1.1, -1.7],
  ]);
  ctx.restore();

  const drawWing = (far: boolean) => {
    ctx.save();
    ctx.translate(-1, -7.6);
    const flap = Math.sin(time * (bathing ? 0.025 : 0.018) + b.seed + (far ? -0.3 : 0));
    ctx.rotate((far ? 0.15 : -0.15) + flap * 0.75);
    ctx.scale(far ? 0.78 : 1, bathing ? 0.6 : 1);
    shape(ctx, far ? cap : back, () => {
      ctx.moveTo(2, 1);
      ctx.quadraticCurveTo(-3, -10, -11, -11.6);
      ctx.lineTo(-13, -9);
      ctx.quadraticCurveTo(-8, 0.5, 2, 1);
    });
    for (let i = 0; i < 6; i++) {
      const xx = -3 - i * 1.5;
      shape(ctx, wingColor, () => {
        ctx.moveTo(xx, -4 - i);
        ctx.lineTo(xx - 4, 0.8 - i * 0.65);
        ctx.quadraticCurveTo(xx - 5.3, 1 - i * 0.65, xx - 5.1, -0.3 - i * 0.65);
        ctx.lineTo(xx - 1, -6 - i);
      });
    }
    stroke(ctx, ivory, 0.65, () => {
      ctx.moveTo(-2, -3.4);
      ctx.quadraticCurveTo(-7, -7, -11.2, -8.5);
    });
    ctx.restore();
  };
  if (flying || bathing) drawWing(true);
  const footY = hop ? -1.4 : 0;
  for (const side of [-1, 1]) {
    const fx = side * 1.65;
    const fy = flying ? -3.9 : footY;
    limb(ctx, foot, 0.6, [
      [fx, -4.5],
      [fx + 0.4, fy],
      [fx + 2, fy + 0.2],
    ]);
    if (!flying)
      limb(ctx, foot, 0.35, [
        [fx - 1, fy + 0.3],
        [fx + 0.4, fy],
        [fx + 1.6, fy - 0.5],
      ]);
  }
  ctx.translate(0, Math.sin(time * 0.002 + b.seed) * 0.08);
  oval(ctx, 0, -6.6, 5.7, 3.9 * sp.round, back, -0.26);
  oval(ctx, 1.2, -5.6, 4.2, 2.9 * sp.round, breast, -0.24);
  if (b.species === 'tit')
    stroke(ctx, cap, 0.8, () => {
      ctx.moveTo(3.6, -7.3);
      ctx.quadraticCurveTo(3, -4.7, 0.3, -3);
    });
  if (flying || bathing) drawWing(false);
  else {
    oval(ctx, -1.9, -7.3, 4.5, 2.1, wingColor, -0.17);
    for (let i = 0; i < 4; i++)
      limb(ctx, back, 0.45, [
        [0.4 - i, -8.5],
        [-4.7 + i * 0.2, -6.8 + i * 0.48],
      ]);
    if (b.species !== 'sparrow') {
      limb(ctx, ivory, 0.75, [
        [-0.8, -8.6],
        [-2.2, -6.3],
      ]);
      limb(ctx, ivory, 0.5, [
        [-2.5, -8.8],
        [-3.5, -6.6],
      ]);
    } else for (let i = 0; i < 4; i++) oval(ctx, -3.9 + i * 1.3, -7.7 + (i % 2) * 0.5, 0.7, 0.3, ivory, -0.5);
  }

  ctx.save();
  ctx.translate(3.9, -9.3);
  ctx.rotate(dip * (b.state === 'drink' ? 1.35 : 1.12));
  oval(ctx, 0.1, -1.4, 3, 2.7, cheek, 0.12);
  shape(ctx, cap, () => {
    ctx.moveTo(-2.7, -0.8);
    ctx.bezierCurveTo(-3.3, -5.5, 3.6, -5.3, 3.1, -1.2);
    ctx.quadraticCurveTo(0.7, -2.7, -2.7, -0.8);
  });
  if (b.species === 'sparrow' || b.species === 'tit' || b.species === 'wagtail') oval(ctx, 1.0, 0, 1.6, 1.1, cap, -0.3);
  oval(ctx, 0.1, -0.8, b.species === 'bullfinch' ? 1.0 : 1.5, 1.0, cheek);
  const beak = b.species === 'finch' || b.species === 'sparrow' ? foot : ink;
  shape(ctx, beak, () => {
    ctx.moveTo(2.4, -2);
    ctx.lineTo(3.2 + sp.beak, -1);
    ctx.lineTo(2.5, -0.35);
  });
  const blink = !flying && Math.sin(time * 0.0012 + b.seed) > 0.993;
  oval(ctx, 1.2, -1.8, 0.53, blink ? 0.12 : 0.52, ink);
  if (!blink) oval(ctx, 1.36, -2.01, 0.15, 0.15, '#fff8de');
  if (b.state === 'feed' && dip < 0.3) oval(ctx, 4.2, -0.7, 0.5, 0.35, ivory);
  ctx.restore();

  if (bathing || b.state === 'drink') {
    for (let i = 0; i < (bathing ? 5 : 1); i++) {
      const p = (time / 650 + i * 0.19) % 1;
      oval(
        ctx,
        bathing ? (i - 2) * (1 + p * 3) : 6,
        -1 - Math.sin(p * Math.PI) * (bathing ? 7 : 2),
        0.25,
        0.4,
        pigment({ r: 171, g: 208, b: 210 }, atm, 1 - p),
      );
    }
    stroke(ctx, pigment({ r: 139, g: 177, b: 182 }, atm, 0.4), 0.45, () => ctx.ellipse(0, 0.7, 6, 1.4, 0, 0, TAU));
  }
  ctx.restore();
}
