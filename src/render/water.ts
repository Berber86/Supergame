/**
 * Живая вода: течение, водопады, пена под ними.
 *
 * Рисуется каждый кадр поверх кэшированного ландшафта — здесь всё движется.
 */

import { LEVEL_H, TILE_H, TILE_W, isoToScreen } from '../core/iso';
import { clamp01, hash2 } from '../core/rng';
import { Atmosphere, RGB, css, mix, shade } from '../world/palette';
import { Curtain, WaterFlow } from '../world/waterFlow';
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

/**
 * Водопад: сплошной занавес воды на вертикальной грани уступа.
 *
 * Рисуется по занавесам, а не по отдельным клеткам: соседние уступы уже
 * слиты в один, иначе стена воды распадается на отдельные сосульки.
 */
export function drawFalls(ctx: Ctx, world: World, flow: WaterFlow, atm: Atmosphere, time: number): void {
  if (!flow.curtains.length) return;
  const water = shade(mix(atm.palette.water, atm.lightTint, atm.lightAmount * 0.3), Math.max(atm.exposure, 0.75));
  const foam = shade(mix(atm.palette.water, { r: 255, g: 255, b: 255 }, 0.86), Math.max(atm.exposure, 0.78));
  // Раньше было слишком темно на рассвете — каскад выглядел кубично-чёрным.
  // Делаем дно светлее и ближе к воде, чтобы занавес читался даже в 05:03.
  const deep = shade(mix(atm.palette.waterDeep, atm.palette.water, 0.55), Math.max(atm.exposure, 0.72) * 0.86);

  for (const c of flow.curtains) {
    // Рисуем только те грани, что обращены к зрителю. В этой изометрии
    // видны южная (y+1) и восточная (x+1) стороны — ровно те же, для которых
    // ландшафт рисует боковые стенки. Занавес на дальней грани оказался бы
    // поверх собственной верхушки тайла, и уступ выглядел бы стеклянным ящиком.
    if (c.dx !== 1 && c.dy !== 1) continue;
    const first = c.tiles[0];
    const last = c.tiles[c.tiles.length - 1];
    const t0 = world.at(first.x, first.y);
    if (!t0) continue;
    const nb = world.at(first.x + c.dx, first.y + c.dy);
    const topLvl = t0.level - 0.26;
    const botLvl = nb ? (nb.water ? nb.level - 0.26 : nb.level) : t0.level - c.drop;
    const h = (topLvl - botLvl) * LEVEL_H;
    if (h <= 2) continue;

    // Кромка занавеса: от начала первой клетки до конца последней
    const [a0] = edgeCorners(first.x, first.y, c.dx, c.dy, topLvl);
    const [, a1] = edgeCorners(last.x, last.y, c.dx, c.dy, topLvl);

    // Тень на воде под водопадом — поток заслоняет свет
    if (nb?.water) {
      ctx.save();
      ctx.globalCompositeOperation = 'multiply';
      ctx.fillStyle = css(mix({ r: 255, g: 255, b: 255 }, deep, 0.32), 1);
      ctx.beginPath();
      ctx.ellipse(
        (a0.x + a1.x) / 2,
        (a0.y + a1.y) / 2 + h,
        Math.hypot(a1.x - a0.x, a1.y - a0.y) * 0.5 + 14,
        14,
        0,
        0,
        Math.PI * 2,
      );
      ctx.fill();
      ctx.restore();
    }

    drawSheet(ctx, a0, a1, h, water, deep, foam, c.seed, time);
    drawJets(ctx, a0, a1, h, foam, c.seed, c.width, time);
    drawSplash(ctx, a0, a1, h, foam, c, time, atm);
  }
}

function edgeCorners(
  x: number,
  y: number,
  dx: number,
  dy: number,
  lvl: number,
): [{ x: number; y: number }, { x: number; y: number }] {
  if (dx === 1) return [isoToScreen(x + 1, y, lvl), isoToScreen(x + 1, y + 1, lvl)];
  if (dx === -1) return [isoToScreen(x, y, lvl), isoToScreen(x, y + 1, lvl)];
  if (dy === 1) return [isoToScreen(x, y + 1, lvl), isoToScreen(x + 1, y + 1, lvl)];
  return [isoToScreen(x, y, lvl), isoToScreen(x + 1, y, lvl)];
}

/** Полотно воды на грани: ломанные края, чтобы каскад не выглядел линейкой. */
function drawSheet(
  ctx: Ctx,
  c0: { x: number; y: number },
  c1: { x: number; y: number },
  h: number,
  water: RGB,
  deep: RGB,
  foam: RGB,
  seed: number,
  time: number,
): void {
  const span = Math.hypot(c1.x - c0.x, c1.y - c0.y);
  const segs = Math.max(3, Math.round(span / 18));
  const wobBase = Math.sin(time * 0.0028 + seed * 0.001) * 1.2;

  ctx.save();
  ctx.beginPath();
  // верхняя кромка — ломаная с шумом
  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    const x = c0.x + (c1.x - c0.x) * t + (hash2(i * 7, seed, 11) - 0.5) * 3.5;
    const y = c0.y + (c1.y - c0.y) * t + (hash2(i * 13, seed + 5, 19) - 0.5) * 2.2;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  // правая боковина вниз — с изломом
  for (let i = 1; i <= 3; i++) {
    const t = i / 3;
    const x = c1.x + wobBase + (hash2(99 + i, seed, 23) - 0.5) * 4;
    const y = c1.y + h * t + (hash2(101 + i, seed + 2, 29) - 0.5) * 3;
    ctx.lineTo(x, y);
  }
  // нижняя кромка — тоже ломаная, в обратную сторону
  for (let i = segs; i >= 0; i--) {
    const t = i / segs;
    const x = c0.x + (c1.x - c0.x) * t + wobBase + (hash2(i * 11 + 50, seed + 3, 31) - 0.5) * 4.5;
    const y = c0.y + (c1.y - c0.y) * t + h + (hash2(i * 17 + 60, seed + 7, 37) - 0.5) * 3.5;
    ctx.lineTo(x, y);
  }
  ctx.closePath();

  const top = Math.min(c0.y, c1.y);
  const g = ctx.createLinearGradient(0, top, 0, Math.max(c0.y, c1.y) + h);
  g.addColorStop(0, css(shade(deep, 0.58), 1));
  g.addColorStop(0.28, css(mix(deep, water, 0.48), 1));
  g.addColorStop(0.68, css(mix(water, foam, 0.45), 1));
  g.addColorStop(1, css(mix(water, foam, 0.88), 1));
  ctx.fillStyle = g;
  ctx.fill();
  // тонкая рваная кромка сверху — блик перелома
  ctx.strokeStyle = css(foam, 0.18);
  ctx.lineWidth = 1.2;
  ctx.stroke();
  ctx.restore();
}

/** Струи внутри занавеса — вертикальные пряди разной яркости. */
function drawJets(
  ctx: Ctx,
  c0: { x: number; y: number },
  c1: { x: number; y: number },
  h: number,
  foam: RGB,
  seed: number,
  width: number,
  time: number,
): void {
  const span = Math.hypot(c1.x - c0.x, c1.y - c0.y);
  // Прядей немного: частый белый гребень делает воду похожей на рифлёное стекло
  const count = Math.max(2, Math.round(span / 22));
  ctx.save();
  ctx.lineCap = 'round';
  for (let i = 0; i < count; i++) {
    const sd = hash2(i, seed & 1023, 17);
    const tt = (i + 0.7) / (count + 0.4) + (sd - 0.5) * 0.08;
    const x0 = c0.x + (c1.x - c0.x) * tt;
    const y0 = c0.y + (c1.y - c0.y) * tt;

    // Прядь начинается не от самого перелома: сверху вода ещё цельная
    // и лишь ниже расходится на струи.
    const start = h * (0.2 + sd * 0.15);
    ctx.strokeStyle = css(foam, 0.16 + sd * 0.16);
    ctx.lineWidth = 1.4 + sd * 2.2;
    ctx.beginPath();
    ctx.moveTo(x0, y0 + start);
    ctx.quadraticCurveTo(x0 + (sd - 0.5) * 2.5, y0 + h * 0.7, x0 + Math.sin(time * 0.003 + i) * 1.2, y0 + h);
    ctx.stroke();

    // Бегущий сгусток — по нему глаз и читает движение
    const speed = 0.0016 + sd * 0.0012;
    const ph = (((time * speed + sd) % 1) + 1) % 1;
    const yTop = y0 + ph * ph * h;
    if (yTop > y0 + h) continue;
    ctx.strokeStyle = css(foam, (0.22 + sd * 0.22) * width);
    ctx.lineWidth = 1.6 + sd * 2;
    ctx.beginPath();
    ctx.moveTo(x0, yTop);
    ctx.lineTo(x0, Math.min(y0 + h, yTop + h * (0.12 + sd * 0.14)));
    ctx.stroke();
  }
  ctx.restore();
}

/** Пена и брызги там, где поток бьёт в нижнюю воду. */
function drawSplash(
  ctx: Ctx,
  c0: { x: number; y: number },
  c1: { x: number; y: number },
  h: number,
  foam: RGB,
  c: Curtain,
  time: number,
  atm: Atmosphere,
): void {
  const span = Math.hypot(c1.x - c0.x, c1.y - c0.y);
  const steps = Math.max(2, Math.round(span / 26));
  const puff = 0.5 + Math.sin(time * 0.004 + c.seed * 0.0007) * 0.12;

  ctx.save();
  for (let k = 0; k <= steps; k++) {
    const tt = k / steps;
    const mx = c0.x + (c1.x - c0.x) * tt;
    const my = c0.y + (c1.y - c0.y) * tt + h;

    ctx.fillStyle = css(foam, 0.42 * puff);
    ctx.beginPath();
    ctx.ellipse(mx, my, TILE_W * 0.2, TILE_H * 0.26, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = css(foam, 0.24 * puff);
    ctx.beginPath();
    ctx.ellipse(mx, my - 3, TILE_W * 0.3, TILE_H * 0.34, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // Брызги вверх по всей ширине
  const drops = Math.max(5, Math.round(span / 12));
  for (let i = 0; i < drops; i++) {
    const sd = hash2(i, (c.seed >> 3) & 1023, 41);
    const tt = (i + 0.5) / drops;
    const mx = c0.x + (c1.x - c0.x) * tt;
    const my = c0.y + (c1.y - c0.y) * tt + h;
    const ph = (((time * (0.0022 + sd * 0.0016) + sd) % 1) + 1) % 1;
    const up = Math.sin(ph * Math.PI) * (7 + sd * 10);
    ctx.fillStyle = css(foam, 0.34 * (1 - ph) * puff * 2);
    ctx.beginPath();
    ctx.arc(mx + (sd - 0.5) * 14, my - up, 0.9 + sd * 1.3, 0, Math.PI * 2);
    ctx.fill();
  }

  // Мокрый блеск под струёй
  ctx.fillStyle = css(mix(foam, atm.lightTint, 0.3), 0.09 * puff);
  ctx.beginPath();
  ctx.ellipse(
    (c0.x + c1.x) / 2,
    (c0.y + c1.y) / 2 + h + 2,
    span * 0.5 + TILE_W * 0.2,
    TILE_H * 0.22,
    0,
    0,
    Math.PI * 2,
  );
  ctx.fill();
  ctx.restore();
}

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
