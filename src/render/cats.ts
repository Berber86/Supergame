import { companyBend } from '../world/animalCompany';
/** Коты: один сочленённый силуэт, шесть поз и четыре устойчивых окраса. */
import type { Cat, CatCoat } from '../world/life';
import type { Atmosphere, RGB } from '../world/palette';
import { catMotion } from '../world/creatureMotion';
import { catTorso, traceCatTorso, catCoatPoint, catTabbyStripes } from './catCoat';
import { Ctx, softShadow } from './paint';
import { oval, shape, stroke, limb, pigment } from './animalBrush';

const COATS: Record<CatCoat, { fur: RGB; shade: RGB; pale: RGB; mark: RGB }> = {
  cream: {
    fur: { r: 219, g: 176, b: 112 },
    shade: { r: 164, g: 112, b: 63 },
    pale: { r: 246, g: 229, b: 194 },
    mark: { r: 177, g: 121, b: 62 },
  },
  grey: {
    fur: { r: 151, g: 165, b: 158 },
    shade: { r: 92, g: 113, b: 115 },
    pale: { r: 233, g: 234, b: 215 },
    mark: { r: 87, g: 105, b: 108 },
  },
  black: {
    fur: { r: 66, g: 75, b: 79 },
    shade: { r: 40, g: 46, b: 51 },
    pale: { r: 147, g: 155, b: 147 },
    mark: { r: 88, g: 98, b: 100 },
  },
  tortoise: {
    fur: { r: 81, g: 65, b: 56 },
    shade: { r: 54, g: 47, b: 44 },
    pale: { r: 235, g: 212, b: 171 },
    mark: { r: 199, g: 128, b: 67 },
  },
};

export function drawCat(ctx: Ctx, c: Cat, x: number, y: number, atm: Atmosphere, time: number): void {
  const colors = COATS[c.coat ?? 'cream'];
  const fur = pigment(colors.fur, atm),
    dark = pigment(colors.shade, atm);
  const pale = pigment(colors.pale, atm),
    mark = pigment(colors.mark, atm);
  const ink = pigment({ r: 36, g: 40, b: 37 }, atm);
  const pink = pigment({ r: 188, g: 128, b: 113 }, atm);
  const p = catMotion(c, time);
  const low = p.sleep + p.loaf;
  const tailLow = low + p.sit * 0.82;
  const backX = -5 - p.stretch * 3 - p.sit;
  const backY = -10 + low * 4 + p.sit * 4 - p.stretch * 3;
  const chestX = 4 - p.sit * 3 + p.stretch * 5;
  const chestY = -10 - p.sit * 7 + low * 3.5 + p.stretch * 5;
  const greeting = companyBend(c.company);
  const hx = 10 - p.sit * 7 - p.sleep * 1.5 + p.stretch * 4 + greeting * 4.5;
  const hy = -15 - p.sit * 10 + p.sleep * 9.5 + p.stretch * 8 + greeting * 1.7;
  const bob = Math.cos(p.gait * 2) * p.walk * 0.23;
  ctx.save();
  ctx.translate(x, y);
  softShadow(ctx, 0, 0, 15 + p.stretch * 4, 3.6, atm.shadowTint, atm.shadowAmount * 1.15);
  ctx.scale(c.facing, 1);

  // Хвост меняет изгиб вместе с позой: поднят на шагу, обёрнут вокруг спящего кота.
  stroke(ctx, dark, 2.6, () => {
    ctx.moveTo(backX - 6, backY + 2);
    ctx.bezierCurveTo(
      -22,
      -6 - p.walk * 8,
      -23 + p.sleep * 32,
      -20 + tailLow * 19,
      -20 + p.sleep * 32 + Math.sin(time * 0.002) * (1 - p.sleep),
      -23 + tailLow * 22,
    );
  });
  stroke(ctx, fur, 1.7, () => {
    ctx.moveTo(backX - 6, backY + 1.7);
    ctx.bezierCurveTo(
      -21.7,
      -6.4 - p.walk * 8,
      -22.7 + p.sleep * 32,
      -20.3 + tailLow * 19,
      -20 + p.sleep * 32 + Math.sin(time * 0.002) * (1 - p.sleep),
      -23.3 + tailLow * 22,
    );
  });

  const leg = (front: boolean, far: boolean) => {
    const phase = p.gait + (front !== far ? Math.PI : 0);
    const swing = Math.cos(phase) * 3.3 * p.walk;
    const lift = Math.max(0, Math.sin(phase)) * 1.7 * p.walk;
    const rootX = front ? chestX + (far ? -1.6 : 1) : backX - (far ? 0 : 2);
    const footX = rootX + swing + (front ? p.stretch * 6 : -p.stretch * 0.6);
    const footY = -0.7 - lift - low * 4;
    const rootY = front ? chestY : backY;
    limb(ctx, far ? dark : fur, front ? 2.2 : 2.6, [
      [rootX, rootY],
      [rootX + swing * 0.4 - (front ? 0.5 : -1.2), (rootY + footY) * 0.5],
      [footX, footY],
    ]);
    oval(ctx, footX + 0.7, footY, 2.1, 1, far ? dark : pale);
    if (!far && low < 0.5)
      for (let i = 0; i < 2; i++)
        limb(ctx, dark, 0.25, [
          [footX + i * 0.65 + 0.6, footY - 0.1],
          [footX + i * 0.65 + 0.7, footY + 0.5],
        ]);
  };
  leg(false, true);
  leg(true, true);

  const torso = catTorso(backX, backY, chestX, chestY);
  const outline = () => traceCatTorso(ctx, torso);
  ctx.save();
  ctx.translate(0, bob);
  ctx.scale(1, 1 + p.breath * 0.009);
  shape(ctx, fur, outline);
  ctx.save();
  ctx.beginPath();
  outline();
  ctx.clip();
  // A subtle back glint follows the skin too; it must not slash across the tabby bands.
  stroke(ctx, pigment(colors.pale, atm, 0.28), 0.5, () => {
    for (let i = 0; i <= 12; i++) {
      const point = catCoatPoint(torso, 0.16 + i * 0.055, 0.095);
      if (i === 0) ctx.moveTo(point.x, point.y);
      else ctx.lineTo(point.x, point.y);
    }
  });
  if (c.coat === 'tortoise') {
    oval(ctx, backX - 2, backY - 3, 4.2, 4.8, mark, -0.4);
    oval(ctx, chestX - 1.1, chestY - 3, 3.0, 3.6, mark, 0.5);
    oval(ctx, backX - 6.4, backY + 3, 2.5, 2.9, pale);
  } else {
    for (const stripe of catTabbyStripes(torso, c.seed))
      shape(ctx, mark, () => {
        stripe.forEach((point, i) => (i ? ctx.lineTo(point.x, point.y) : ctx.moveTo(point.x, point.y)));
      });
  }
  // The white bib is unmarked fur, not a pale undercoat crossed by dark stripes.
  oval(ctx, chestX + 3, chestY + 3.4, 4.8, 6.4, pale, 0.15);
  ctx.restore();
  ctx.restore();
  if (p.sleep < 0.6) leg(false, false);
  if (p.wash < 0.5 && low < 0.6) leg(true, false);
  if (p.loaf > 0.1) {
    ctx.save();
    ctx.globalAlpha *= p.loaf;
    stroke(ctx, dark, 0.45, () => {
      ctx.moveTo(2, -2);
      ctx.quadraticCurveTo(4, -3.1, 5.5, -2);
    });
    ctx.restore();
  }

  // Голова: скулы, отдельные уши, миндалевидные глаза и белые подусники.
  ctx.save();
  ctx.translate(hx, hy + bob);
  ctx.rotate(greeting * 0.12 + p.sleep * 0.42 + p.stretch * 0.15 + p.wash * (0.18 + Math.sin(time * 0.006) * 0.06));
  for (const side of [-1, 1]) {
    const ear = Math.sin(time * 0.0018 + side * 2 + c.seed) * 0.1;
    shape(ctx, fur, () => {
      ctx.moveTo(side * 2.2, -3);
      ctx.lineTo(side * (5.1 + ear), -8 + p.sleep * 1.5);
      ctx.quadraticCurveTo(side * 6.0, -4.8, side * 5, -0.8);
    });
    shape(ctx, pink, () => {
      ctx.moveTo(side * 3.3, -3.6);
      ctx.lineTo(side * (4.7 + ear), -6.8 + p.sleep);
      ctx.lineTo(side * 4.9, -2.5);
    });
  }
  shape(ctx, fur, () => {
    ctx.moveTo(-5, -3);
    ctx.bezierCurveTo(-2.8, -6.1, 4.6, -5.9, 5.7, -1.9);
    ctx.quadraticCurveTo(7.5, 3, 1.2, 4.7);
    ctx.quadraticCurveTo(-4.2, 4.8, -5.4, 1);
  });
  if (c.coat === 'tortoise') oval(ctx, -2.5, -1.3, 2.6, 3.2, mark, -0.25);
  else
    for (const side of [-1, 1])
      limb(ctx, mark, 0.6, [
        [side * 1, -4.2],
        [side * 1.5, -2.2],
      ]);
  const closed = p.sleep > 0.5 || p.wash > 0.3 || Math.sin(time * 0.0009 + c.seed) > 0.988;
  for (const side of [-1, 1]) {
    const ex = side * 2.2;
    if (closed)
      stroke(ctx, c.coat === 'black' ? pale : ink, 0.4, () => {
        ctx.moveTo(ex - 1, -0.3);
        ctx.quadraticCurveTo(ex, 0.5, ex + 1, -0.4);
      });
    else {
      oval(ctx, ex, -0.5, 1.1, 0.8, ink, side * 0.12);
      oval(ctx, ex + 0.1, -0.55, 0.83, 0.62, pigment({ r: 169, g: 188, b: 99 }, atm));
      oval(ctx, ex + 0.2, -0.55, 0.21, 0.62, ink);
      oval(ctx, ex + 0.44, -0.81, 0.18, 0.16, '#fff7df');
    }
  }
  oval(ctx, -0.5, 2, 1.8, 1.3, pale);
  oval(ctx, 1.8, 2, 1.8, 1.3, pale);
  shape(ctx, pink, () => {
    ctx.moveTo(-0.1, 1);
    ctx.lineTo(1.4, 1);
    ctx.lineTo(0.7, 1.8);
  });
  limb(ctx, dark, 0.25, [
    [0.7, 1.8],
    [0.7, 2.6],
    [0, 2.9],
  ]);
  for (const side of [-1, 1])
    for (let i = -1; i <= 1; i++)
      stroke(ctx, pigment(colors.pale, atm, 0.85), 0.22, () => {
        ctx.moveTo(0.7 + side * 2.5, 2 + i * 0.4);
        ctx.quadraticCurveTo(side * 5.6, 1.8 + i * 1.1, side * 8.5, 2.2 + i * 1.3);
      });
  if (p.wash > 0.01) {
    ctx.save();
    ctx.globalAlpha *= p.wash;
    const lick = (Math.sin(time * 0.009) + 1) * 0.5;
    oval(ctx, 1, 3 + lick * 0.7, 0.45, 0.7, pink);
    limb(ctx, fur, 2.5, [
      [-4, 7],
      [-3.8, 4],
      [-2.8 + lick * 1.9, 1.8 - lick * 1.6],
    ]);
    oval(ctx, -2.8 + lick * 1.9, 1.8 - lick * 1.6, 1.7, 1.3, pale);
    ctx.restore();
  }
  ctx.restore();
  if (p.sleep > 0.01) {
    ctx.save();
    ctx.globalAlpha *= p.sleep;
    stroke(ctx, fur, 2.6, () => {
      ctx.moveTo(-12, -4);
      ctx.bezierCurveTo(-6, 1.5, 10, 1.8, 12.6, -3.4);
    });
    stroke(ctx, mark, 0.65, () => {
      ctx.moveTo(-5, -0.4);
      ctx.lineTo(-4, 1);
      ctx.moveTo(-1, 0.4);
      ctx.lineTo(-0.5, 1.7);
    });
    ctx.restore();
  }
  ctx.restore();
}
