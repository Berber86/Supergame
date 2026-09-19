/**
 * Живая вода: течение, водопады, пена под ними.
 *
 * Рисуется каждый кадр поверх кэшированного ландшафта — здесь всё движется.
 */

import { TILE_H, TILE_W, isoToScreen } from '../core/iso';
import { clamp01, hash2 } from '../core/rng';
import { Atmosphere, css, mix, shade } from '../world/palette';
import { WaterFlow } from '../world/waterFlow';
import { World } from '../world/world';
import { Ctx } from './paint';
import { waterSurfaces, waterSurfacePath } from './waterSurface';

/** Полосы, бегущие по течению — главный признак того, что вода живая. */
export function drawCurrent(ctx: Ctx, world: World, flow: WaterFlow, atm: Atmosphere, time: number): void {
  if (!flow.hasCurrent) return;
  const hi = shade(mix(atm.palette.water, { r: 255, g: 255, b: 250 }, 0.72), atm.exposure);

  ctx.save();
  ctx.lineCap = 'round';
  for (const surface of waterSurfaces(world)) {
    ctx.save();
    waterSurfacePath(ctx, surface);
    ctx.clip('evenodd');
    for (const { x, y } of surface.cells) {
      const t = world.at(x, y)!;
      if (!t.water) continue;
      const f = flow.at(x, y);
      if (!f || f.speed < 0.06) continue;

      // Три стрежня на клетку, разнесённые по фазе
      for (let i = 0; i < 3; i++) {
        const seed = hash2(x * 7 + i, y * 11 + i * 3, 29);
        // Полоса ползёт по клетке и уходит за край, потом появляется снова
        const phase = (((time * 0.00016 * (0.5 + f.speed) + seed) % 1) + 1) % 1;
        // поперечное смещение, чтобы стрежни не шли по одной линии
        const off = (seed - 0.5) * 0.62;
        const px = -f.fy * off;
        const py = f.fx * off;
        const cx = x + 0.5 + px + (phase - 0.5) * f.fx * 1.15;
        const cy = y + 0.5 + py + (phase - 0.5) * f.fy * 1.15;

        const c = isoToScreen(cx, cy, t.level - 0.26);
        // длина по направлению течения
        const len = 0.2 + f.speed * 0.3;
        const a = isoToScreen(cx - f.fx * len, cy - f.fy * len, t.level - 0.26);
        const b = isoToScreen(cx + f.fx * len, cy + f.fy * len, t.level - 0.26);

        // гаснет у краёв клетки — стык клеток не должен быть виден
        const fade = Math.sin(phase * Math.PI);
        ctx.strokeStyle = css(hi, (0.03 + f.speed * 0.14) * fade);
        ctx.lineWidth = 0.7 + f.speed * 0.9;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.quadraticCurveTo(c.x, c.y + 1.5, b.x, b.y);
        ctx.stroke();
      }
    }
    ctx.restore();
  }
  ctx.restore();
}

export { drawFalls } from './cascades';

/** Рябь от течения у берега — вода трётся о камни. */
export function drawShoreRipple(ctx: Ctx, world: World, flow: WaterFlow, atm: Atmosphere, time: number): void {
  if (!flow.hasCurrent) return;
  const foam = shade(mix(atm.palette.water, { r: 255, g: 255, b: 255 }, 0.7), atm.exposure);
  ctx.save();
  ctx.lineCap = 'round';
  for (const surface of waterSurfaces(world)) {
    ctx.save();
    waterSurfacePath(ctx, surface);
    ctx.clip('evenodd');
    for (const { x, y } of surface.cells) {
      const t = world.at(x, y)!;
      if (!t.water) continue;
      const f = flow.at(x, y);
      if (!f || f.speed < 0.18 || f.edge > 0.5) continue;
      const s = hash2(x, y, 53);
      const wob = Math.sin(time * 0.0035 + s * 6.3);
      const c = isoToScreen(x + 0.5, y + 0.5, t.level - 0.26);
      ctx.strokeStyle = css(foam, (0.08 + f.speed * 0.14) * (0.6 + wob * 0.4));
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.ellipse(c.x, c.y, TILE_W * 0.16, TILE_H * 0.1, 0, 0.2, Math.PI * 1.45);
      ctx.stroke();
    }
    ctx.restore();
  }
  ctx.restore();
}

/** Сколько «шума воды» слышно — для звукового слоя. */
export function waterLoudness(flow: WaterFlow): { stream: number; fall: number } {
  let stream = 0;
  for (const c of flow.cells) if (c) stream += c.speed;
  let fall = 0;
  for (const f of flow.falls) fall += f.drop * f.width;
  return { stream: clamp01(stream * 0.02), fall: clamp01(fall * 0.12) };
}
