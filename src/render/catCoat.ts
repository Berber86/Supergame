/** Coat coordinates belong to the curved torso, not to a fixed rectangle at the hips. */
import { hash2, lerp } from '../core/rng';
import type { Ctx } from './paint';

interface Point {
  x: number;
  y: number;
}
type Curve = [Point, Point, Point, Point];
export interface CatTorso {
  back: Curve;
  chest: Curve;
  belly: Curve;
}

export function catTorso(backX: number, backY: number, chestX: number, chestY: number): CatTorso {
  const rear = { x: backX - 9, y: backY + 1 };
  const shoulder = { x: chestX, y: chestY - 5.7 };
  const breast = { x: chestX + 1, y: chestY + 5.2 };
  return {
    back: [rear, { x: backX - 10, y: backY - 8 }, { x: backX + 3, y: backY - 8 }, shoulder],
    chest: [shoulder, { x: chestX + 6, y: chestY - 4 }, { x: chestX + 6.5, y: chestY + 4.3 }, breast],
    // Both skin boundaries run from the rump towards the shoulder.
    belly: [rear, { x: backX - 7, y: backY + 7 }, { x: backX + 2, y: backY + 5.7 }, breast],
  };
}

export function traceCatTorso(ctx: Ctx, body: CatTorso): void {
  const [a, b, c, d] = body.back;
  ctx.moveTo(a.x, a.y);
  ctx.bezierCurveTo(b.x, b.y, c.x, c.y, d.x, d.y);
  const [, e, f, g] = body.chest;
  ctx.bezierCurveTo(e.x, e.y, f.x, f.y, g.x, g.y);
  const [h, i, j] = body.belly;
  ctx.bezierCurveTo(j.x, j.y, i.x, i.y, h.x, h.y);
}

function curvePoint([a, b, c, d]: Curve, t: number): Point {
  const u = 1 - t;
  return {
    x: u ** 3 * a.x + 3 * u * u * t * b.x + 3 * u * t * t * c.x + t ** 3 * d.x,
    y: u ** 3 * a.y + 3 * u * u * t * b.y + 3 * u * t * t * c.y + t ** 3 * d.y,
  };
}

/** u follows the spine; v wraps down the flank. The same map survives blended poses. */
export function catCoatPoint(body: CatTorso, u: number, v: number): Point {
  const top = curvePoint(body.back, u),
    bottom = curvePoint(body.belly, u);
  return { x: lerp(top.x, bottom.x, v), y: lerp(top.y, bottom.y, v) };
}

/** Five tapered, slightly unequal markings; the seed never depends on animation time. */
export function catTabbyStripes(body: CatTorso, seed: number): Point[][] {
  return Array.from({ length: 5 }, (_, i) => {
    const u = 0.25 + i * 0.125 + (hash2(seed, i, 3217) - 0.5) * 0.016;
    const end = 0.57 + hash2(seed, i, 3221) * 0.18 - (i === 4 ? 0.12 : 0);
    const width = 0.018 + hash2(seed, i, 3229) * 0.005;
    const points: Point[] = [];
    // A closed ribbon has fine ends, unlike five constant-width parallel pen strokes.
    for (const side of [-1, 1])
      for (let n = 0; n <= 12; n++) {
        const t = side < 0 ? n / 12 : 1 - n / 12;
        const bend = -0.045 * Math.sin(t * Math.PI) + 0.018 * t;
        const halfWidth = width * Math.sin(t * Math.PI) ** 0.65;
        points.push(catCoatPoint(body, u + bend + side * halfWidth, lerp(0.025, end, t)));
      }
    return points;
  });
}
