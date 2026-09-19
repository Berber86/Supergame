/** Articulated silhouettes shared by the garden and the field guide. */
import { Atmosphere, RGB, css, mix, shade } from '../world/palette';
import type { Deer, Turtle } from '../world/wildlife';
import { Ctx, softShadow, washBlob } from './paint';

const TAU = Math.PI * 2;
function ellipse(ctx: Ctx, x: number, y: number, rx: number, ry: number, color: string, angle = 0): void {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, angle, 0, TAU);
  ctx.fill();
}
function line(ctx: Ctx, points: number[][], color: string, width: number): void {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  points.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.stroke();
}
function lit(color: RGB, atm: Atmosphere): RGB {
  return shade(mix(color, atm.lightTint, atm.lightAmount), atm.exposure);
}

export function drawDeer(ctx: Ctx, d: Deer, x: number, y: number, atm: Atmosphere, time: number): void {
  const base = d.coat.winter ? { r: 143, g: 126, b: 107 } : { r: 177, g: 113, b: 65 };
  const body = lit(base, atm);
  const dark = css(lit(shade(base, 0.64), atm));
  const fur = css(body);
  const cream = css(lit({ r: 240, g: 222, b: 182 }, atm));
  const ink = css(lit({ r: 49, g: 40, b: 34 }, atm));
  const moving = ['enter', 'walk', 'leave'].includes(d.state);
  const running = d.state === 'leave';
  const gait = d.gait ?? time * (running ? 0.009 : 0.004);
  const lower = d.headLower ?? (d.state === 'graze' ? 1 : 0);
  const breath = Math.sin(time * 0.0018 + d.seed);
  const bob = moving ? Math.cos(gait * 2) * (running ? 0.9 : 0.24) : breath * 0.12;

  ctx.save();
  ctx.translate(x, y);
  ctx.scale(1.36, 1.36);
  softShadow(ctx, 0, 0, 13, 3.2, atm.shadowTint, atm.shadowAmount * 1.2);
  ctx.scale(d.facing, 1);

  // Four articulated legs; lifted feet swing forward, planted feet sweep back.
  const leg = (hip: number, offset: number, far: boolean, hind: boolean) => {
    const cycle = gait + offset;
    const swing = moving ? Math.cos(cycle) * (running ? 4.8 : 2.8) : 0;
    const lift = moving ? Math.max(0, Math.sin(cycle)) * (running ? 4.2 : 2.2) : 0;
    const foot = hip + swing;
    const knee = hip + swing * 0.45 + (hind ? 1.8 : -0.8);
    const col = far ? dark : fur;
    line(
      ctx,
      [
        [hip, -15 + bob],
        [knee, -7.6 - lift * 0.35],
        [foot, -0.8 - lift],
      ],
      col,
      far ? 1.5 : 1.9,
    );
    ellipse(ctx, knee, -7.6 - lift * 0.35, 1.05, 1.15, col);
    line(
      ctx,
      [
        [knee, -7.2 - lift * 0.35],
        [foot, -1 - lift],
      ],
      dark,
      0.75,
    );
    ellipse(ctx, foot + 0.3, -0.5 - lift, 1.1, 0.65, ink, -0.1);
  };
  leg(-6.2, Math.PI, true, true);
  leg(6, 0, true, false);

  ctx.save();
  ctx.translate(0, bob);
  // Tapered barrel, raised withers, weight in the haunch rather than a round blob.
  ctx.fillStyle = fur;
  ctx.beginPath();
  ctx.moveTo(-10, -17);
  ctx.bezierCurveTo(-10, -22, -5, -23, 0, -21.5);
  ctx.bezierCurveTo(4, -21.2, 6, -23.2, 8.5, -21);
  ctx.bezierCurveTo(11, -18, 9, -13, 5, -12.8);
  ctx.bezierCurveTo(0, -12, -6, -12.5, -8, -14);
  ctx.closePath();
  ctx.fill();
  washBlob(ctx, -2, -18.4, 7.7, 3.1, body, d.seed, { alpha: 0.23, edge: 0.12, wobble: 0.08 });
  ellipse(ctx, -0.5, -14.3, 6.4, 1.2, cream, -0.02);
  ellipse(ctx, -8, -16.8, 2.1, 3.6, cream, 0.2);
  line(
    ctx,
    [
      [-7.5, -21],
      [-2, -21.6],
      [4, -21],
    ],
    dark,
    0.5,
  );
  if (d.coat.spots) {
    for (let row = 0; row < 2; row++)
      for (let i = 0; i < 6; i++) {
        ellipse(ctx, -6.3 + i * 2 + row * 0.7, -19.8 + row * 2.3 + Math.sin(i) * 0.35, 0.62, 0.39, cream, -0.2);
      }
  }
  ctx.save();
  ctx.translate(-9.2, -18.5);
  ctx.rotate((running ? 0.8 : 0.15) + Math.sin(time * 0.004) * 0.12);
  ellipse(ctx, -1.5, 0, 2.7, 1.0, fur, 0.2);
  ellipse(ctx, -1.7, 0.4, 1.8, 0.5, cream, 0.2);
  ctx.restore();

  // Neck pivots at the shoulder, carrying head, ears and antlers as one skeleton.
  ctx.save();
  ctx.translate(6.3, -19 + lower * 1.8);
  ctx.rotate(0.22 + lower * 2.18 + (d.state === 'look' ? Math.sin(time * 0.0013) * 0.055 : 0));
  ctx.fillStyle = fur;
  ctx.beginPath();
  ctx.moveTo(-2.7, 2);
  ctx.bezierCurveTo(-1.4, -3, 0.7, -8.3, 1.7, -12);
  ctx.lineTo(4.6, -12.2);
  ctx.bezierCurveTo(4.2, -7, 4.7, -1, 2.4, 4);
  ctx.closePath();
  ctx.fill();
  line(
    ctx,
    [
      [4, -10.5],
      [3.6, -5],
      [2.7, 0],
    ],
    cream,
    1.4,
  );
  ctx.translate(3, -12.3);
  ctx.rotate(-0.22 - lower * 0.98 + breath * 0.018);
  // Long wedge-shaped muzzle with a small dark nose, not a circular face.
  ctx.fillStyle = fur;
  ctx.beginPath();
  ctx.moveTo(-2.3, -1.4);
  ctx.quadraticCurveTo(0.2, -3.2, 2.5, -0.7);
  ctx.lineTo(6.4, 1.2);
  ctx.quadraticCurveTo(7, 2.9, 4.3, 2.7);
  ctx.lineTo(-0.7, 1.8);
  ctx.closePath();
  ctx.fill();
  line(
    ctx,
    [
      [1, 1.5],
      [4.7, 2.4],
    ],
    cream,
    1.05,
  );
  ellipse(ctx, 6, 1.55, 0.85, 0.65, ink, 0.3);
  const chewing = lower * Math.sin(time * 0.008) * 0.2;
  line(
    ctx,
    [
      [3.2, 2.4 + chewing],
      [5.1, 2.65 + chewing],
    ],
    dark,
    0.35,
  );
  for (const side of [-1, 1]) {
    ctx.save();
    ctx.translate(-0.9 + side * 0.7, -1.8);
    ctx.rotate(side * (0.85 + Math.sin(time * 0.002 + side * 2) * (d.state === 'look' ? 0.22 : 0.06)));
    ellipse(ctx, 0, -2, 1.25, 3.1, fur);
    ellipse(ctx, 0, -2.2, 0.65, 2.15, cream);
    ctx.restore();
  }
  const blink = Math.sin(time * 0.0011 + d.seed) > 0.994;
  ellipse(ctx, 1, -0.5, 0.62, blink ? 0.12 : 0.46, ink, 0.1);
  if (!blink) ellipse(ctx, 1.18, -0.67, 0.16, 0.15, '#fff6e3');
  if (d.coat.antlers) {
    const horn = css(lit({ r: 116, g: 88, b: 62 }, atm));
    for (const side of [-1, 1]) {
      ctx.save();
      ctx.translate(-1 + side * 0.7, -2);
      ctx.scale(side, 1);
      line(
        ctx,
        [
          [0, 0],
          [1.3, -3],
          [2.6, -5.2],
          [3.2, -8.8],
        ],
        horn,
        1,
      );
      line(
        ctx,
        [
          [1.3, -3],
          [-0.3, -5],
          [-0.7, -6.5],
        ],
        horn,
        0.7,
      );
      line(
        ctx,
        [
          [2.6, -5.2],
          [4.8, -6.1],
          [5.8, -7.7],
        ],
        horn,
        0.65,
      );
      line(
        ctx,
        [
          [3, -7],
          [1.8, -8.8],
        ],
        horn,
        0.55,
      );
      ctx.restore();
    }
  }
  ctx.restore();
  ctx.restore();
  leg(-7.5, running ? 0 : Math.PI * 0.5, false, true);
  leg(6.8, running ? Math.PI : Math.PI * 1.5, false, false);
  ctx.restore();
}

export function drawTurtle(ctx: Ctx, t: Turtle, x: number, y: number, atm: Atmosphere, time: number): void {
  const shell = lit({ r: 105, g: 120, b: 68 }, atm);
  const deep = css(lit({ r: 53, g: 70, b: 47 }, atm));
  const light = css(lit({ r: 171, g: 175, b: 103 }, atm));
  const skin = css(lit({ r: 132, g: 149, b: 92 }, atm));
  const gold = css(lit({ r: 214, g: 197, b: 129 }, atm));
  const swim = t.state === 'swim';
  const moving = ['enter', 'walk', 'leave', 'swim'].includes(t.state);
  const retract = Math.max(0, Math.min(1, t.retract ?? (t.state === 'hide' ? 1 : 0)));
  const extension = 1 - retract;
  const gait = t.gait ?? time * (swim ? 0.004 : 0.0028);
  const bob = moving ? Math.sin(gait * 2) * 0.17 : Math.sin(time * 0.0015) * 0.09;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(1.12, 1.12);
  if (swim) {
    for (let i = 0; i < 3; i++) {
      const p = (time / 1800 + i / 3) % 1;
      ctx.strokeStyle = css(atm.palette.water, (1 - p) * 0.38);
      ctx.lineWidth = 0.55;
      ctx.beginPath();
      ctx.ellipse(-p * 5 * t.facing, -1, 9 + p * 8, 2.4 + p * 2.8, 0, 0, TAU);
      ctx.stroke();
    }
  } else softShadow(ctx, 0, 0, 11, 3, atm.shadowTint, atm.shadowAmount * 1.25);
  ctx.scale(t.facing, 1);
  ctx.translate(0, bob + (swim ? 1 : 0));
  // Tail and all four feet retract behind the carapace, rather than disappearing.
  line(
    ctx,
    [
      [-6, -3],
      [-8 - extension * 3, -2.4],
    ],
    skin,
    1.15,
  );
  const foot = (front: boolean, far: boolean, offset: number) => {
    const a = moving ? Math.sin(gait + offset) : t.state === 'bask' ? 0.4 : 0;
    const rootX = front ? 4.6 : -5;
    const reach = extension * (far ? 2.1 : 3.3);
    const px = rootX + a * extension * (swim ? 2.7 : 1.4);
    const py = -2.6 + reach - (moving && !swim ? Math.max(0, Math.cos(gait + offset)) * 0.8 : 0);
    line(
      ctx,
      [
        [rootX, -3.8],
        [px - 0.6, py - 0.5],
        [px + 0.7, py],
      ],
      far ? deep : skin,
      swim ? 1.8 : 2.1,
    );
    if (!far)
      for (let i = 0; i < 3; i++)
        line(
          ctx,
          [
            [px + i * 0.5, py],
            [px + i * 0.5 + 0.2, py + 0.6 * extension],
          ],
          gold,
          0.27,
        );
  };
  foot(false, true, Math.PI);
  foot(true, true, 0);
  const neckLift = t.state === 'look' ? -0.7 + Math.sin(time * 0.0018) * 0.6 : t.state === 'bask' ? -0.9 : 0;
  const hx = 5.5 + extension * 6;
  const hy = -3.4 + neckLift * extension;
  line(
    ctx,
    [
      [4, -3],
      [hx - 1.3, hy],
    ],
    deep,
    3.1,
  );
  line(
    ctx,
    [
      [4, -3.4],
      [hx - 1, hy - 0.3],
    ],
    skin,
    2.3,
  );
  ellipse(ctx, hx, hy, 2.45, 1.65, skin, -0.12);
  line(
    ctx,
    [
      [hx - 1.1, hy + 0.6],
      [hx + 1.6, hy + 0.4],
    ],
    gold,
    0.48,
  );
  ellipse(ctx, hx + 1.95, hy - 0.1, 0.45, 0.55, gold);
  const sleepy = t.state === 'bask' || retract > 0.8;
  ellipse(ctx, hx + 0.6, hy - 0.65, 0.38, sleepy ? 0.1 : 0.4, deep);
  if (!sleepy) ellipse(ctx, hx + 0.7, hy - 0.78, 0.11, 0.12, '#fff3c9');

  foot(false, false, 0);
  foot(true, false, Math.PI);

  // Solid dome with softly glazed pigment, a golden rim and curved polygon scutes.
  ellipse(ctx, 0, -3.0, 8.6, 2.8, deep);
  ellipse(ctx, 0, -2.5, 8.3, 1.8, gold);
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(-8.7, -3.2);
  ctx.bezierCurveTo(-8.8, -13.3, 7.4, -14, 8.7, -3.2);
  ctx.bezierCurveTo(4.7, -0.5, -4.8, -0.5, -8.7, -3.2);
  ctx.closePath();
  ctx.fillStyle = css(shell);
  ctx.fill();
  ctx.clip();
  const glaze = ctx.createLinearGradient(-4, -11, 4, 0);
  glaze.addColorStop(0, light);
  glaze.addColorStop(0.5, css(shell));
  glaze.addColorStop(1, deep);
  ctx.fillStyle = glaze;
  ctx.fillRect(-10, -14, 20, 16);
  // Three central hexagons; side seams radiate out to the marginal plates.
  for (let i = -1; i <= 1; i++) {
    const cx = i * 4.3;
    const cy = -7.1 + Math.abs(i) * 0.65;
    const poly = [
      [cx - 2.1, cy - 1.1],
      [cx, cy - 2.6],
      [cx + 2.1, cy - 1.1],
      [cx + 2.1, cy + 1.2],
      [cx, cy + 2.5],
      [cx - 2.1, cy + 1.2],
      [cx - 2.1, cy - 1.1],
    ];
    line(ctx, poly, deep, 0.48);
    line(
      ctx,
      [
        [cx - 1.4, cy - 0.8],
        [cx, cy - 1.8],
        [cx + 1.4, cy - 0.8],
      ],
      light,
      0.34,
    );
    line(
      ctx,
      [
        [cx, cy + 2.5],
        [cx * 1.3, -1.6],
      ],
      deep,
      0.45,
    );
    line(
      ctx,
      [
        [cx, cy - 2.6],
        [cx * 1.3, -12],
      ],
      deep,
      0.45,
    );
  }
  for (let i = -7; i <= 7; i += 2)
    line(
      ctx,
      [
        [i, -3.1],
        [i * 1.08, -1.4],
      ],
      deep,
      0.38,
    );
  washBlob(ctx, -2.5, -8.6, 3.5, 1.7, lit({ r: 196, g: 194, b: 126 }, atm), t.seed, { alpha: 0.12, edge: 0 });
  ctx.restore();
  ctx.strokeStyle = deep;
  ctx.lineWidth = 0.55;
  ctx.beginPath();
  ctx.moveTo(-8.4, -3.1);
  ctx.quadraticCurveTo(0, 0, 8.4, -3.1);
  ctx.stroke();
  ctx.restore();
}
