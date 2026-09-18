/**
 * Туман неоткрытой земли растущего сада.
 *
 * За границей открытого прямоугольника лист ещё не родился для игрока:
 * его укрывает бумажная дымка в цвет бумаги, на которой живёт сад.
 * Когда сад предлагает вырасти, дымка приподнимается над зонами-
 * кандидатами — игрок видит, что берёт: заводь, гриву, рощу.
 */

import { GRID, isoToScreen } from '../core/iso';
import { growOfferReady, growZones, type GrowRect } from '../world/grow';
import { World } from '../world/world';
import { Ctx } from './paint';

const FOG = '236,230,216';

function poly(ctx: Ctx, pts: { x: number; y: number }[]): void {
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
  ctx.closePath();
}

function rectPts(r: GrowRect): { x: number; y: number }[] {
  return [
    isoToScreen(r.x, r.y, 0),
    isoToScreen(r.x + r.w, r.y, 0),
    isoToScreen(r.x + r.w, r.y + r.h, 0),
    isoToScreen(r.x, r.y + r.h, 0),
  ];
}

export function drawGrowFog(ctx: Ctx, world: World, time: number, zoom: number): void {
  const g = world.grow;
  if (!g) return;

  // Внешний контур: с запасом покрывает весь лист в координатах сцены
  const outer = [
    isoToScreen(-40, -40, 0),
    isoToScreen(GRID + 40, -40, 0),
    isoToScreen(GRID + 40, GRID + 40, 0),
    isoToScreen(-40, GRID + 40, 0),
  ];
  const garden = rectPts(g.rect);
  const zones = g.choosing && growOfferReady(g) ? growZones(g.rect) : [];

  ctx.save();
  ctx.beginPath();
  poly(ctx, outer);
  // Внутренние контуры обходим против часовой: дыра остаётся дырой
  // и при чётно-нечётном правиле, и при правиле ненулевого обхода
  poly(ctx, [...garden].reverse());
  for (const z of zones) poly(ctx, rectPts(z).reverse());
  ctx.fillStyle = `rgba(${FOG},0.94)`;
  ctx.fill('evenodd');

  // Мягкая кромка дымки внутрь сада: три штриха всё тоньше и плотнее
  for (const [w, al] of [
    [30, 0.22],
    [16, 0.3],
    [7, 0.38],
  ] as const) {
    ctx.beginPath();
    poly(ctx, garden);
    ctx.strokeStyle = `rgba(${FOG},${al})`;
    ctx.lineWidth = w;
    ctx.stroke();
  }

  // Зоны-кандидаты: чернильный пунктир и тёплая подсветка выбора
  if (zones.length) {
    const pulse = 0.45 + Math.sin(time * 0.0022) * 0.12;
    for (const z of zones) {
      const pz = rectPts(z);
      ctx.beginPath();
      poly(ctx, pz);
      ctx.fillStyle = 'rgba(255,250,232,0.10)';
      ctx.fill();
      ctx.beginPath();
      poly(ctx, pz);
      ctx.setLineDash([9 / zoom, 7 / zoom]);
      ctx.strokeStyle = `rgba(72,52,34,${pulse})`;
      ctx.lineWidth = 1.8 / zoom;
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }
  ctx.restore();
}
