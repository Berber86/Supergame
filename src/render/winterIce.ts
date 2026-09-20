/** Thin, settled shore ice. Never freezes rapids; openings remain for visible moving water. */
import { winterYear } from '../world/annualEnvironment';
import { hash2, smoothstep } from '../core/rng';
import type { Pt } from '../core/iso';
import { css, mix, shade, type Atmosphere } from '../world/palette';
import type { World } from '../world/world';
import type { WaterFlow } from '../world/waterFlow';
import type { Ctx } from './paint';
import { waterSurfaces, waterSurfacePath, type WaterSurface } from './waterSurface';

export function pondIceState(atm: Atmosphere, surface: WaterSurface): { amount: number; seed: number } {
  if (surface.cells.length < 5) return { amount: 0, seed: 0 };
  const cell = surface.cells[0],
    seed = Math.floor(hash2(cell.x, cell.y, 419) * 1000000);
  return { amount: winterYear(atm.time.now).ice, seed };
}
export function iceEligible(world: World, flow: WaterFlow, surface: WaterSurface): boolean {
  // Conservative: a connected flowing reach stays open, including its waterfall lips.
  return surface.cells.every((c) => (flow.cells[world.idx(c.x, c.y)]?.speed ?? 0) <= 0.08);
}
interface Patch {
  outline: Pt[];
  crack: Pt[];
  opacity: number;
}
const cache = new WeakMap<WaterSurface, { key: string; patches: Patch[] }>();
function patches(surface: WaterSurface, amount: number, seed: number): Patch[] {
  amount = Math.round(amount * 128) / 128;
  const key = `${amount}:${seed}`,
    old = cache.get(surface);
  if (old?.key === key) return old.patches;
  const result: Patch[] = [];
  for (const loop of surface.loops) {
    for (let i = 0; i < loop.length; i += 24) {
      const growth = smoothstep(hash2(i, 17, seed) * 0.55, 0.6 + hash2(i, 17, seed) * 0.4, amount);
      if (growth <= 0) continue;
      const outside: Pt[] = [],
        inside: Pt[] = [];
      const count = 15 + Math.floor(hash2(i, 19, seed) * 9);
      for (let j = 0; j <= count; j++) {
        const k = (i + j) % loop.length,
          p = loop[k],
          a = loop[(k + loop.length - 2) % loop.length],
          b = loop[(k + 2) % loop.length];
        const dx = b.x - a.x,
          dy = b.y - a.y,
          len = Math.hypot(dx, dy) || 1;
        const width =
          36 * growth * (0.2 + 0.8 * Math.sin((Math.PI * j) / count)) * (0.85 + 0.15 * Math.sin(j * 0.71 + i));
        outside.push(p);
        inside.push({ x: p.x - (dy / len) * width, y: p.y + (dx / len) * width });
      }
      const m = Math.floor(inside.length / 2),
        a = outside[m],
        b = inside[m];
      result.push({
        opacity: smoothstep(0, 0.12, growth),
        outline: [...outside, ...inside.slice().reverse()],
        crack: [
          { x: a.x + (b.x - a.x) * 0.2, y: a.y + (b.y - a.y) * 0.2 },
          { x: a.x + (b.x - a.x) * 0.6 + 3, y: a.y + (b.y - a.y) * 0.6 },
          b,
        ],
      });
    }
  }
  cache.set(surface, { key, patches: result });
  return result;
}
export function drawWinterIce(ctx: Ctx, world: World, atm: Atmosphere, flow: WaterFlow): void {
  if (winterYear(atm.time.now).ice <= 0) return;
  ctx.save();
  ctx.lineJoin = 'round';
  const ice = shade(mix({ r: 186, g: 218, b: 229 }, atm.lightTint, atm.lightAmount * 0.4), atm.exposure);
  const rim = shade(mix({ r: 235, g: 245, b: 246 }, atm.lightTint, atm.lightAmount * 0.35), atm.exposure);
  for (const surface of waterSurfaces(world)) {
    const state = pondIceState(atm, surface);
    if (!state.amount || !iceEligible(world, flow, surface)) continue;
    ctx.save();
    waterSurfacePath(ctx, surface);
    ctx.clip('evenodd');
    for (const patch of patches(surface, state.amount, state.seed)) {
      ctx.beginPath();
      patch.outline.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
      ctx.closePath();
      ctx.fillStyle = css(ice, 0.68 * patch.opacity);
      ctx.fill();
      ctx.strokeStyle = css(rim, 0.52 * patch.opacity);
      ctx.lineWidth = 1.2;
      ctx.stroke();
      ctx.save();
      ctx.clip();
      ctx.beginPath();
      patch.crack.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
      ctx.strokeStyle = css(rim, 0.72 * patch.opacity);
      ctx.lineWidth = 0.7;
      ctx.stroke();
      ctx.restore();
    }
    ctx.restore();
  }
  ctx.restore();
}
