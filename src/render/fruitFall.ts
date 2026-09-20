import { windOffset } from './plantWind';
/** Live orchard accent, deliberately outside the sprite cache. One possible drop per visible tree. */
import { isFruitTree, fruitDropFrame } from '../world/orchard';
import { orchardGeometry } from './sprites/orchard';
import { paintOrchardFruit } from './orchardFruit';
import { mirrorOf, scaleJitterOf, type DrawCtx } from './sprites/common';
import { hash2, smoothstep } from '../core/rng';
import { screenToIso } from '../core/iso';
import type { World } from '../world/world';
export function drawFruitFall(d: DrawCtx, world: World): void {
  const type = d.obj.type;
  if (!isFruitTree(type)) return;
  const frame = fruitDropFrame(type, d.obj.seed, d.atm.time.now, d.time);
  if (!frame) return;
  const geom = orchardGeometry(type, d.obj.seed, d.g),
    s = geom.sites[frame.index * 2];
  const sc = 0.92 + (scaleJitterOf(d.obj.seed) - 0.88) * 0.5,
    mirror = mirrorOf(d.obj.seed);
  const topX = type === 'ume' ? 9 * geom.scale : type === 'peach' ? 0 : -3 * geom.scale;
  const fromY = (-geom.height + s.y + 7 * geom.scale) * sc,
    fromX = (topX + s.x) * sc * mirror + windOffset(d.plantPose, -fromY);
  const toX = fromX * 0.55,
    toY = (hash2(frame.index, d.obj.seed, 1951) - 0.5) * 19;
  const level = world.at(Math.floor(d.obj.tx + 0.5), Math.floor(d.obj.ty + 0.5))?.level ?? 0;
  const land = screenToIso(d.x + toX, d.y + toY, level);
  const tile = world.at(Math.floor(land.x), Math.floor(land.y)),
    r = world.grow?.rect;
  if (
    !tile ||
    tile.water ||
    tile.level !== level ||
    tile.indoor ||
    tile.veranda ||
    !['grass', 'moss', 'soil'].includes(tile.ground)
  )
    return;
  if (r && (land.x < r.x || land.y < r.y || land.x >= r.x + r.w || land.y >= r.y + r.h)) return;
  // Curved shores can intrude into a dry tile; leave this vignette to safely inland trees.
  for (let y = -1; y <= 1; y++)
    for (let x = -1; x <= 1; x++) if (world.at(Math.floor(land.x) + x, Math.floor(land.y) + y)?.water) return;
  const p = frame.progress,
    flight = Math.min(1, p / 0.77),
    gravity = flight * flight;
  const x = d.x + fromX + (toX - fromX) * flight;
  const y = d.y + fromY + (toY - fromY) * gravity - (p > 0.77 ? Math.sin(((p - 0.77) / 0.23) * Math.PI) * 4 : 0);
  d.ctx.save();
  d.ctx.globalAlpha *= 1 - smoothstep(0.91, 1, p);
  paintOrchardFruit(
    d.ctx,
    type,
    x,
    y,
    (type === 'ume' ? 3.5 : 5.3) * geom.scale * sc,
    frame.ripe,
    0,
    d.atm,
    d.obj.seed + frame.index,
  );
  d.ctx.restore();
}
