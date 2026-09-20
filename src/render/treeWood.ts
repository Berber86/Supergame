/** Seeded connected wood, independent of calendar/foliage. Radii follow the local curve normal. */
import { hash2, lerp } from '../core/rng';
import { css, shade, type RGB } from '../world/palette';
import type { Ctx } from './paint';
import type { CrownSite } from './crownGeometry';
export interface WoodPoint {
  x: number;
  y: number;
}
export interface WoodCurve {
  a: WoodPoint;
  b: WoodPoint;
  c: WoodPoint;
  d: WoodPoint;
  r0: number;
  r1: number;
  flare?: number;
}
export function woodPoint(w: WoodCurve, t: number): WoodPoint {
  const u = 1 - t;
  return {
    x: u * u * u * w.a.x + 3 * u * u * t * w.b.x + 3 * u * t * t * w.c.x + t * t * t * w.d.x,
    y: u * u * u * w.a.y + 3 * u * u * t * w.b.y + 3 * u * t * t * w.c.y + t * t * t * w.d.y,
  };
}
export function woodFrame(w: WoodCurve, t: number) {
  const u = 1 - t,
    dx = 3 * u * u * (w.b.x - w.a.x) + 6 * u * t * (w.c.x - w.b.x) + 3 * t * t * (w.d.x - w.c.x),
    dy = 3 * u * u * (w.b.y - w.a.y) + 6 * u * t * (w.c.y - w.b.y) + 3 * t * t * (w.d.y - w.c.y),
    len = Math.hypot(dx, dy) || 1;
  return {
    ...woodPoint(w, t),
    nx: -dy / len,
    ny: dx / len,
    r: lerp(w.r0, w.r1, t) + (w.flare ?? 0) * Math.exp(-t * 18),
  };
}
export function woodCurve(a: WoodPoint, d: WoodPoint, r0: number, r1: number, bend = 0, lift = 0): WoodCurve {
  return {
    a,
    b: { x: lerp(a.x, d.x, 0.32) + bend, y: lerp(a.y, d.y, 0.32) + lift },
    c: { x: lerp(a.x, d.x, 0.74) + bend * 0.35, y: lerp(a.y, d.y, 0.74) + lift * 0.45 },
    d,
    r0,
    r1,
  };
}
export function trunkCurve(
  type: string,
  seed: number,
  x: number,
  y: number,
  h: number,
  w: number,
  bend: number,
): WoodCurve {
  const character: Record<string, number> = {
    sakura: 1.2,
    maple: -1.35,
    ginkgo: 0.25,
    willow: 1.8,
    persimmon: -0.7,
    pine: 1.15,
  };
  const bow = (character[type] ?? 0.4) * h * (0.065 + hash2(seed, 21, 2003) * 0.055);
  return {
    a: { x, y },
    b: { x: x + bow, y: y - h * 0.3 },
    c: { x: x - bow * 0.65 + bend * 0.6, y: y - h * 0.74 },
    d: { x: x + bend, y: y - h },
    r0: w * 0.84,
    r1: w * (type === 'ginkgo' ? 0.19 : 0.13),
    flare: w * 0.37,
  };
}
/** Closed tapered silhouette (not a bent rectangle), with subtle in-silhouette bark. */
export function paintWood(ctx: Ctx, w: WoodCurve, color: RGB, seed: number, texture = false): void {
  const samples = texture ? 22 : 12;
  const edge = (side: number) => {
    for (let i = 0; i <= samples; i++) {
      const t = side === 1 ? i / samples : 1 - i / samples,
        f = woodFrame(w, t);
      const x = f.x + f.nx * f.r * side,
        y = f.y + f.ny * f.r * side;
      if (side === 1 && i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
  };
  ctx.save();
  ctx.beginPath();
  edge(1);
  edge(-1);
  ctx.closePath();
  ctx.fillStyle = css(color, 0.97);
  ctx.fill();
  if (texture) {
    ctx.clip();
    for (let k = 0; k < 5; k++) {
      const side = -0.8 + k * 0.36;
      ctx.strokeStyle = css(shade(color, k % 2 === 0 ? 0.66 : 1.22), k % 2 === 0 ? 0.27 : 0.25);
      ctx.lineWidth = k % 2 === 0 ? 0.65 : 1.1;
      ctx.beginPath();
      for (let i = 0; i <= 18; i++) {
        const t = 0.025 + i * 0.052,
          f = woodFrame(w, t),
          offset = side * f.r + Math.sin(t * 13 + k + seed) * f.r * 0.08;
        const x = f.x + f.nx * offset,
          y = f.y + f.ny * offset;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    for (let k = 0; k < 7; k++) {
      const t = 0.1 + hash2(k, seed, 2011) * 0.78,
        f = woodFrame(w, t),
        o = (hash2(k, seed, 2017) - 0.5) * f.r;
      ctx.strokeStyle = css(shade(color, 0.6), 0.23);
      ctx.lineWidth = 0.55;
      ctx.beginPath();
      ctx.ellipse(
        f.x + f.nx * o,
        f.y + f.ny * o,
        f.r * 0.4,
        Math.max(0.5, f.r * 0.17),
        Math.atan2(f.ny, f.nx),
        0,
        Math.PI,
      );
      ctx.stroke();
    }
  }
  ctx.restore();
}
/** Each cluster has one bough attached to an actual point on the bole, plus three terminal branches. */
export function branchSkeleton(
  type: string,
  seed: number,
  trunk: WoodCurve,
  sites: CrownSite[],
  scale: number,
  sway = 0,
) {
  const groups = sites.filter((s) => s.index % 3 === 0);
  const ranked = [...groups].sort((a, b) => a.parentY - b.parentY);
  const branches = groups.map((s) => {
    const rank = ranked.indexOf(s) / (groups.length - 1 || 1);
    const height =
      type === 'ginkgo'
        ? 0.91 - rank * 0.39
        : type === 'willow'
          ? 0.77 - rank * 0.37
          : type === 'sakura'
            ? 0.82 - rank * 0.4
            : 0.85 - rank * 0.39;
    const attachment = height + (hash2(s.index, seed, 2063) - 0.5) * 0.03;
    const a = woodPoint(trunk, attachment),
      d = { x: trunk.d.x + s.parentX + sway, y: trunk.d.y + s.parentY };
    const radius = Math.min(woodFrame(trunk, attachment).r * 0.88, (type === 'willow' ? 3.3 : 2.9) * scale);
    const sign = Math.sign(d.x - a.x) || 1;
    return woodCurve(
      a,
      d,
      radius,
      0.95 * scale,
      sign * (type === 'sakura' ? 9 : type === 'willow' ? 12 : 5) * scale,
      (type === 'ginkgo' ? -8 : type === 'willow' ? -12 : -4) * scale,
    );
  });
  const twigs = sites.map((s) => {
    const a = branches[Math.floor(s.index / 3)].d,
      d = { x: trunk.d.x + s.x + sway, y: trunk.d.y + s.y };
    return woodCurve(a, d, 0.97 * scale, 0.3 * scale, (d.x - a.x) * 0.09, -2 * scale);
  });
  return { branches, twigs };
}
