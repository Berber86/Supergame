/** Серая цапля: ноги с цевкой, складная шея и веер маховых перьев. */
import { lerp } from '../core/rng';
import type { Heron } from '../world/wildlife';
import type { Atmosphere } from '../world/palette';
import { HERON_STRIDE, HERON_WADE_SPEED, heronFlight, heronStrike } from '../world/wildlifeMotion';
import { Ctx, softShadow } from './paint';
import { limb, oval, pigment, shape, stroke } from './animalBrush';

export function drawHeron(ctx: Ctx, h: Heron, x: number, y: number, atm: Atmosphere, time: number): void {
  const gray = pigment({ r: 145, g: 163, b: 165 }, atm);
  const light = pigment({ r: 192, g: 206, b: 201 }, atm);
  const deep = pigment({ r: 81, g: 105, b: 116 }, atm);
  const white = pigment({ r: 243, g: 237, b: 216 }, atm);
  const neckShade = pigment({ r: 194, g: 196, b: 179 }, atm);
  const ink = pigment({ r: 43, g: 59, b: 66 }, atm);
  const gold = pigment({ r: 208, g: 165, b: 73 }, atm);
  const billShade = pigment({ r: 157, g: 123, b: 66 }, atm);
  const leg = pigment({ r: 122, g: 127, b: 95 }, atm);
  const flight = h.flightPose ?? heronFlight(h);
  const preen = h.preenPose ?? (h.state === 'preen' ? 1 : 0);
  const stalk = h.stalkPose ?? (h.state === 'stalk' ? 1 : 0);
  const strike = h.state === 'strike' ? heronStrike(h.timer) : 0;
  const gait = h.gait ?? ((time * HERON_WADE_SPEED) / HERON_STRIDE) * Math.PI * 2;
  const flap = Math.sin(time * 0.0065 + h.seed * 0.13);
  const breath = Math.sin(time * 0.0014 + h.seed) * 0.16;

  ctx.save();
  ctx.translate(x, y);
  ctx.scale(1.1, 1.1);
  softShadow(ctx, 0, 0, 9 + flight * 4, 2.7, atm.shadowTint, atm.shadowAmount * (1.15 - flight * 0.65));
  ctx.scale(h.facing, 1);
  ctx.translate(0, -flight * 24 + breath * (1 - flight) + flap * flight * 0.6);

  // В полёте ноги вытягиваются назад, при посадке опускаются раньше корпуса.
  const drawLeg = (far: boolean) => {
    const phase = gait + (far ? Math.PI : 0);
    const swing = Math.cos(phase) * stalk * 3.5 * (1 - flight);
    const lift = Math.max(0, Math.sin(phase)) * stalk * 3.3 * (1 - flight);
    const hipX = far ? -2 : 1.2;
    const kneeX = lerp(hipX - 2 + swing * 0.4, -10, flight);
    const kneeY = lerp(-10.4 - lift * 0.25, -19.8, flight);
    const footX = lerp(hipX + swing, far ? -24 : -21, flight);
    const footY = lerp(-0.3 - lift, far ? -16.8 : -15.4, flight);
    limb(ctx, far ? deep : leg, far ? 0.95 : 1.15, [
      [hipX, -22.2],
      [kneeX, kneeY],
      [footX, footY],
    ]);
    oval(ctx, kneeX, kneeY, 0.72, 0.72, far ? deep : leg);
    for (let toe = -1; toe <= 1; toe++) {
      const dx = lerp(toe === -1 ? -1.8 : 2.8, -3, flight);
      const dy = lerp(toe * 0.48, toe * 0.45 + 0.4, flight);
      limb(ctx, far ? deep : leg, 0.44, [
        [footX, footY],
        [footX + dx, footY + dy],
      ]);
    }
  };
  drawLeg(true);

  const flying = h.state === 'fly-in' || h.state === 'fly-out' || flight > 0.015;
  const wing = (far: boolean) => {
    ctx.save();
    ctx.translate(-1.8, -24.8);
    // Полный мах идёт в плечевом суставе; дальнее крыло немного запаздывает.
    const beat = far ? Math.sin(time * 0.0065 + h.seed * 0.13 - 0.22) : flap;
    const spread = 0.12 + flight * 0.88;
    ctx.rotate((far ? -0.12 : 0.16) + beat * 0.7 * spread);
    ctx.scale((far ? 0.8 : 1) * spread, (far ? 0.65 : 1) * spread);
    shape(ctx, far ? deep : gray, () => {
      ctx.moveTo(3, 1);
      ctx.bezierCurveTo(-1, -8, -11, -16, -19, -17);
      ctx.quadraticCurveTo(-26, -18, -30, -15);
      ctx.quadraticCurveTo(-26, -8, -18, -2);
      ctx.quadraticCurveTo(-7, 4, 3, 1);
    });
    // Маховые перья — перекрывающиеся вытянутые лопасти, не круглые лепестки.
    for (let i = 0; i < 8; i++) {
      const rootX = -7 - i * 2.5;
      const rootY = -2.1 - i * 1.3;
      const tipX = rootX - 5.8 - i * 0.48;
      const tipY = rootY + 6.1 - i * 0.32;
      shape(ctx, far ? ink : deep, () => {
        ctx.moveTo(rootX + 1.4, rootY - 1.8);
        ctx.quadraticCurveTo(rootX - 2, rootY + 2, tipX, tipY);
        ctx.quadraticCurveTo(tipX - 1.2, tipY + 0.5, tipX - 0.3, tipY - 1.5);
        ctx.lineTo(rootX - 1.6, rootY - 3);
      });
      if (!far)
        limb(ctx, pigment({ r: 189, g: 203, b: 202 }, atm, 0.45), 0.3, [
          [rootX - 0.3, rootY - 1.4],
          [tipX + 1, tipY - 0.5],
        ]);
    }
    stroke(ctx, far ? gray : light, 1.1, () => {
      ctx.moveTo(0, -2);
      ctx.quadraticCurveTo(-10, -14, -23, -15.6);
    });
    ctx.restore();
  };
  if (flying) wing(true);
  // Заострённый хвост и горизонтальный корпус серой цапли.
  shape(ctx, deep, () => {
    ctx.moveTo(-7, -26);
    ctx.lineTo(-15, -22.6);
    ctx.lineTo(-8, -20.8);
  });
  oval(ctx, -2, -24, 9.8, 4.5, gray, -0.14 + flight * 0.16);
  oval(ctx, 4, -24.3, 4.2, 4.9, white, -0.3);
  shape(ctx, light, () => {
    ctx.moveTo(-10, -25.5);
    ctx.quadraticCurveTo(-3, -30.6, 5.2, -27.8);
    ctx.quadraticCurveTo(-1.8, -27.9, -10, -25.5);
  });

  if (flying) wing(false);
  // Кроющие перья остаются видны и при сложенном крыле.
  ctx.save();
  ctx.globalAlpha *= 1 - flight * 0.9;
  oval(ctx, -3.2, -24.6, 7.4, 3.1, deep, -0.15);
  for (let i = 0; i < 6; i++)
    stroke(ctx, i < 3 ? light : gray, 0.6, () => {
      ctx.moveTo(1.5 - i * 0.9, -27.1 + i * 0.45);
      ctx.quadraticCurveTo(-3.2, -24.2 + i * 0.5, -9.5 + i * 0.4, -22.1 + i * 0.22);
    });
  ctx.restore();
  drawLeg(false);

  // S-образная шея: изгиб распрямляется при ударе, складывается в полёте.
  let hx = lerp(7.6 + stalk * 3.8, 9.7, flight);
  let hy = lerp(-40 + stalk * 5.3, -29, flight);
  hx = lerp(hx, 0.8, preen);
  hy = lerp(hy, -30, preen);
  hx = lerp(hx, 16.2, strike);
  hy = lerp(hy, -9.9, strike);
  const nib = Math.sin(time * 0.012) * preen * 0.7;
  hx += nib;
  const bendX = lerp(12 + stalk * 1.2, 14, strike);
  const bendY = lerp(-30.5, -20, strike);
  const neck = () => {
    ctx.moveTo(5.1, -23.8);
    ctx.bezierCurveTo(bendX, bendY, hx - 6.3 * (1 - strike), hy + 5.7, hx, hy);
  };
  stroke(ctx, neckShade, 3.6, neck);
  stroke(ctx, white, 2.8, () => {
    ctx.moveTo(5.8, -24.2);
    ctx.bezierCurveTo(bendX + 0.35, bendY, hx - 5.6 * (1 - strike), hy + 5.3, hx, hy);
  });
  for (let i = 0; i < 4; i++)
    limb(ctx, ink, 0.5, [
      [5.1 + i * 0.38, -26 + i * 1.3],
      [5.2 + i * 0.4, -24.1 + i * 1.1],
    ]);
  // Тонкие нагрудные перья, свободно лежащие поверх груди.
  for (let i = 0; i < 3; i++)
    stroke(ctx, white, 0.55, () => {
      ctx.moveTo(4.8, -22.5);
      ctx.quadraticCurveTo(5.8 + i * 0.5, -19.5, 3.6 + i, -17.8 + i * 0.3);
    });

  ctx.save();
  ctx.translate(hx, hy);
  ctx.rotate(lerp(0.07 + stalk * 0.08, 2.55 + Math.sin(time * 0.012) * 0.08, preen) + strike * 0.98);
  oval(ctx, 0, 0, 3.5, 1.65, white, -0.08);
  // Чёрная бровь и две длинные затылочные косицы.
  shape(ctx, ink, () => {
    ctx.moveTo(0.8, -0.8);
    ctx.quadraticCurveTo(-1.4, -2.1, -3.2, -1.0);
    ctx.lineTo(-2.8, 0);
    ctx.quadraticCurveTo(-0.7, -0.7, 0.8, -0.8);
  });
  for (let i = 0; i < 2; i++)
    stroke(ctx, ink, 0.55 - i * 0.12, () => {
      ctx.moveTo(-2.4, -0.85 + i * 0.5);
      ctx.quadraticCurveTo(-5.8, 0.1, -7.4 - i * 0.6, 0.1 + Math.sin(time * 0.002 + i) * 0.32);
    });
  shape(ctx, gold, () => {
    ctx.moveTo(2.4, -0.8);
    ctx.lineTo(12, 0.1);
    ctx.lineTo(2.6, 0.95);
  });
  shape(ctx, billShade, () => {
    ctx.moveTo(2.6, 0.45);
    ctx.lineTo(12, 0.1);
    ctx.lineTo(2.6, 0.95);
  });
  limb(ctx, billShade, 0.25, [
    [3.2, -0.02],
    [11.8, 0.1],
  ]);
  oval(ctx, 1.2, -0.45, 0.69, 0.62, gold);
  oval(ctx, 1.4, -0.45, 0.29, 0.36, ink);
  oval(ctx, 1.52, -0.61, 0.11, 0.1, '#fff8de');
  oval(ctx, 4, -0.23, 0.42, 0.15, billShade);
  if (h.fish > 0) {
    ctx.save();
    ctx.translate(8.3, 0.6);
    ctx.rotate(1.4 + Math.sin(time * 0.018) * 0.2);
    oval(ctx, 0, 0, 2.7, 0.85, light);
    shape(ctx, gray, () => {
      ctx.moveTo(-2.2, 0);
      ctx.lineTo(-4.2, -1.2);
      ctx.lineTo(-3.5, 0);
      ctx.lineTo(-4.2, 1.2);
    });
    oval(ctx, 1.6, -0.15, 0.18, 0.2, ink);
    ctx.restore();
  }
  ctx.restore();
  ctx.restore();
}
