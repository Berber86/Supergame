/** Bounded local illumination. World-space receivers, not an orange screen-space haze. */
import { isoToScreen, tileDiamond, type Pt, TILE_W, TILE_H, LEVEL_H } from '../core/iso';
import { ITEM_BY_ID, SMALL_HOUSE_IDS } from '../world/catalog';
import { css, type Atmosphere, type RGB } from '../world/palette';
import type { World } from '../world/world';
import type { Ctx } from './paint';
import { findHouse, WALL_H } from './building';
import { smallHouseSize } from './sprites/smallHouses';
import { waterSurfaces, waterSurfacePath } from './waterSurface';

export interface LocalLight {
  id: number;
  x: number;
  y: number;
  level: number;
  height: number;
  radius: number;
  power: number;
  color: RGB;
  screen: Pt;
}
export interface LightSample {
  light: LocalLight;
  strength: number;
}
interface Barrier {
  a: Pt;
  b: Pt;
  level: number;
  owner: number;
}
export interface LocalLightField {
  world: World;
  lights: LocalLight[];
  barriers: Barrier[];
}
const WARM = { r: 255, g: 189, b: 112 };
const SOURCES: Record<string, { height: number; radius: number; power: number }> = {
  lantern_stone: { height: 30, radius: 2.8, power: 0.86 },
  lantern_paper: { height: 34, radius: 2.6, power: 0.82 },
  lantern_path: { height: 11, radius: 1.65, power: 0.58 },
  brazier: { height: 20, radius: 3, power: 0.95 },
  irori: { height: 8, radius: 2.5, power: 0.92 },
};
export function receivesObjectLight(type: string): boolean {
  return !SOURCES[type] && !SMALL_HOUSE_IDS.has(type) && type !== 'koi' && type !== 'cat';
}
function rotated(u: number, v: number, rot: number): Pt {
  return rot % 4 === 0
    ? { x: u, y: v }
    : rot % 4 === 1
      ? { x: -v, y: u }
      : rot % 4 === 2
        ? { x: -u, y: -v }
        : { x: v, y: -u };
}
export function buildLocalLights(
  world: World,
  atm: Atmosphere,
  time: number,
  view?: Pt,
  excludeId = -1,
): LocalLightField {
  const field: LocalLightField = { world, lights: [], barriers: [] };
  if (atm.lampGlow < 0.025) return field;
  const add = (id: number, x: number, y: number, height: number, radius: number, power: number, seed = 0) => {
    const tile = world.at(Math.floor(x), Math.floor(y));
    if (!tile) return;
    const flicker = 0.96 + 0.025 * Math.sin(time * 0.0021 + seed) + 0.015 * Math.sin(time * 0.0053 + seed * 2);
    const p = isoToScreen(x, y, tile.level - (tile.water ? 0.28 : 0));
    field.lights.push({
      id,
      x,
      y,
      level: tile.level,
      height,
      radius,
      power: power * atm.lampGlow * flicker,
      color: WARM,
      screen: { x: p.x, y: p.y - height },
    });
  };
  for (const o of world.objects) {
    if (o.id === excludeId) continue;
    const item = ITEM_BY_ID.get(o.type);
    if (!item) continue;
    const x = o.tx + item.w / 2,
      y = o.ty + item.h / 2;
    const spec = SOURCES[o.type];
    if (spec) add(o.id, x, y, spec.height, spec.radius, spec.power, o.seed);
    if (['shoji', 'fusuma', 'byobu', 'bookshelf', 'tansu'].includes(o.type)) {
      const a = rotated(-0.5, -0.1, o.rot),
        b = rotated(0.5, -0.1, o.rot),
        level = world.at(Math.floor(x), Math.floor(y))?.level ?? 0;
      field.barriers.push({ a: { x: x + a.x, y: y + a.y }, b: { x: x + b.x, y: y + b.y }, level, owner: o.id });
    }
    if (SMALL_HOUSE_IDS.has(o.type) && o.type !== 'pavilion') {
      const { u, v } = smallHouseSize(o.type),
        bu = u * 0.78,
        bv = v * 0.72;
      const corners = [
        [-bu / 2, -bv / 2],
        [bu / 2, -bv / 2],
        [bu / 2, bv / 2],
        [-bu / 2, bv / 2],
      ].map(([u, v]) => rotated(u, v, o.rot));
      for (let i = 0; i < 4; i++) {
        const a = corners[i],
          b = corners[(i + 1) % 4],
          mx = (a.x + b.x) / 2,
          my = (a.y + b.y) / 2;
        field.barriers.push({
          a: { x: x + a.x, y: y + a.y },
          b: { x: x + b.x, y: y + b.y },
          level: world.at(Math.floor(x), Math.floor(y))?.level ?? 0,
          owner: o.id,
        });
        // Exactly the two visible window faces painted by the miniature-house renderer.
        if (o.type !== 'shed' && mx + my > 0) add(o.id, x + mx * 1.03, y + my * 1.03, 34, 2.5, 0.5, o.seed);
      }
    }
  }
  // Use the same rectangular wall topology as drawHouseWalls, including edited/non-rectangular floors.
  const h = findHouse(world);
  if (h) {
    field.barriers.push(
      { a: { x: h.x0, y: h.y0 }, b: { x: h.x1 + 1, y: h.y0 }, level: h.level, owner: -100000 },
      { a: { x: h.x0, y: h.y0 }, b: { x: h.x0, y: h.y1 + 1 }, level: h.level, owner: -100000 },
    );
    for (let x = h.x0; x <= h.x1; x += 2) {
      add(-2000 - x, x + 0.5, h.y0 + 0.08, 42, 2.85, 0.52);
      add(-4000 - x, x + 0.5, h.y1 + 0.88, 30, 2.25, 0.4);
    }
    for (let y = h.y0; y <= h.y1; y += 2) {
      add(-3000 - y, h.x0 + 0.08, y + 0.5, 42, 2.85, 0.42);
      add(-5000 - y, h.x1 + 0.88, y + 0.5, 30, 2.25, 0.4);
    }
  }
  if (field.lights.length > 48) {
    if (view)
      field.lights.sort(
        (a, b) =>
          Math.hypot(a.screen.x - view.x, a.screen.y - view.y) - Math.hypot(b.screen.x - view.x, b.screen.y - view.y),
      );
    field.lights.length = 48;
  }
  return field;
}
function crosses(a: Pt, b: Pt, c: Pt, d: Pt): boolean {
  const cross = (u: Pt, v: Pt, w: Pt) => (v.x - u.x) * (w.y - u.y) - (v.y - u.y) * (w.x - u.x);
  return cross(a, b, c) * cross(a, b, d) < -1e-8 && cross(c, d, a) * cross(c, d, b) < -1e-8;
}
/** North/west exterior walls and opaque room dividers block spill. Height changes cannot leak light. */
export function lightVisible(
  field: LocalLightField,
  l: LocalLight,
  x: number,
  y: number,
  level: number,
  receiverId = -9999,
): boolean {
  if (Math.abs(level - l.level) > 0.3) return false;
  const target = { x, y };
  for (const b of field.barriers)
    if (b.owner !== receiverId && Math.abs(b.level - level) < 0.3 && crosses(l, target, b.a, b.b)) return false;
  const n = Math.max(1, Math.ceil(Math.hypot(x - l.x, y - l.y) * 8));
  for (let i = 1; i <= n; i++) {
    const nx = Math.floor(l.x + ((x - l.x) * i) / n),
      ny = Math.floor(l.y + ((y - l.y) * i) / n),
      t = field.world.at(nx, ny);
    if (!t || Math.abs(t.level - l.level) > 0.3) return false;
  }
  return true;
}
export function sampleLocalLight(
  field: LocalLightField,
  x: number,
  y: number,
  level: number,
  receiverId = -9999,
): LightSample[] {
  const hits: LightSample[] = [];
  for (const l of field.lights) {
    if (l.id === receiverId) continue;
    const q = Math.hypot(x - l.x, y - l.y) / l.radius;
    if (q >= 1 || !lightVisible(field, l, x, y, level, receiverId)) continue;
    const strength = l.power * (1 - q * q) * (1 - q * q);
    if (strength > 0.018) hits.push({ light: l, strength });
  }
  hits.sort((a, b) => b.strength - a.strength);
  return hits.slice(0, 2);
}
function tileMask(ctx: Ctx, tiles: { x: number; y: number; level: number }[]) {
  ctx.beginPath();
  for (const t of tiles) {
    const p = tileDiamond(t.x, t.y, t.level);
    p.forEach((q, i) => (i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y)));
    ctx.closePath();
  }
  ctx.clip();
}
function pool(ctx: Ctx, l: LocalLight, level: number, power: number) {
  ctx.save();
  ctx.transform(TILE_W / 2, TILE_H / 2, -TILE_W / 2, TILE_H / 2, 0, -level * LEVEL_H);
  const g = ctx.createRadialGradient(l.x, l.y, 0, l.x, l.y, l.radius);
  g.addColorStop(0, css(l.color, power));
  g.addColorStop(0.35, css(l.color, power * 0.68));
  g.addColorStop(1, css(l.color, 0));
  ctx.fillStyle = g;
  ctx.fillRect(l.x - l.radius, l.y - l.radius, l.radius * 2, l.radius * 2);
  ctx.restore();
}
/** Painted before sprites/roofs. Exact water contours are respected as well as terrain elevation. */
export function drawLocalSurfaceLight(ctx: Ctx, field: LocalLightField, time: number): void {
  if (!field.lights.length) return;
  const receivers = new Map<
    LocalLight,
    { dry: { x: number; y: number; level: number }[]; wet: { x: number; y: number; level: number }[] }
  >();
  for (let y = 0; y < field.world.size; y++)
    for (let x = 0; x < field.world.size; x++) {
      const t = field.world.at(x, y)!;
      for (const hit of sampleLocalLight(field, x + 0.5, y + 0.5, t.level)) {
        let r = receivers.get(hit.light);
        if (!r) {
          r = { dry: [], wet: [] };
          receivers.set(hit.light, r);
        }
        (t.water ? r.wet : r.dry).push({ x, y, level: t.water ? t.level - 0.26 : t.level });
      }
    }
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  for (const [l, r] of receivers) {
    if (r.dry.length) {
      ctx.save();
      tileMask(ctx, r.dry);
      pool(ctx, l, l.level, l.power * 0.28);
      ctx.restore();
    }
    if (r.wet.length)
      for (const s of waterSurfaces(field.world)) {
        if (Math.abs(s.level - l.level) > 0.3) continue;
        ctx.save();
        waterSurfacePath(ctx, s);
        ctx.clip('evenodd');
        tileMask(ctx, r.wet);
        pool(ctx, l, s.level - 0.26, l.power * 0.12);
        const p = isoToScreen(l.x, l.y, s.level - 0.26);
        for (let i = 0; i < 9; i++) {
          const fade = 1 - i / 10,
            drift = Math.sin(time * 0.0014 + i * 2 + l.id) * 3,
            width = (6 + i * 1.4) * fade;
          const y = p.y + l.height * 0.5 + i * 5;
          ctx.beginPath();
          ctx.moveTo(p.x - width + drift, y);
          ctx.quadraticCurveTo(p.x + drift, y + 1.1, p.x + width + drift, y);
          ctx.strokeStyle = css(l.color, l.power * fade * 0.25);
          ctx.lineWidth = 1.6 * fade;
          ctx.stroke();
        }
        ctx.restore();
      }
  }
  ctx.restore();
}
/** Separate clipped panels, so a warm patch cannot extend into the sky or through a wall. */
export function drawLocalWallLight(ctx: Ctx, field: LocalLightField): void {
  if (!field.lights.length) return;
  const h = findHouse(field.world);
  if (!h) return;
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  for (const north of [true, false]) {
    const start = north ? h.x0 : h.y0,
      end = north ? h.x1 : h.y1;
    for (let j = start; j <= end; j++) {
      const x = north ? j : h.x0,
        y = north ? h.y0 : j;
      const hits = sampleLocalLight(field, x + (north ? 0.5 : 0.03), y + (north ? 0.03 : 0.5), h.level);
      if (!hits.length) continue;
      const a = isoToScreen(x, y, h.level),
        b = isoToScreen(x + (north ? 1 : 0), y + (north ? 0 : 1), h.level);
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.lineTo(b.x, b.y - WALL_H);
      ctx.lineTo(a.x, a.y - WALL_H);
      ctx.closePath();
      ctx.clip();
      for (const { light: l, strength } of hits) {
        const radius = l.radius * 65,
          g = ctx.createRadialGradient(l.screen.x, l.screen.y, 0, l.screen.x, l.screen.y, radius);
        g.addColorStop(0, css(l.color, Math.min(0.36, strength * 0.42)));
        g.addColorStop(1, css(l.color, 0));
        ctx.fillStyle = g;
        ctx.fillRect(l.screen.x - radius, l.screen.y - radius, radius * 2, radius * 2);
      }
      ctx.restore();
    }
  }
  ctx.restore();
}
