import { STONE_TYPES } from '../world/stone';
import { liquidExposure } from '../world/ecology';
/** Residual rain: receiver-aware drying, small temporary puddles and bounded roof drips. No save mutations. */
import { isoToScreen, tileDiamond, type Pt } from '../core/iso';
import { clamp01, hash2, lerp } from '../core/rng';
import { cachedCanopyDensity } from '../world/canopy';
import { ANNUAL_CROWN_TYPES, crownCacheKey } from '../world/phenology';
import { ITEM_BY_ID, SMALL_HOUSE_IDS } from '../world/catalog';
import { css, mix, shade, type Atmosphere } from '../world/palette';
import type { WeatherState } from '../world/weatherState';
import type { World } from '../world/world';
import type { DrawCtx } from './sprites/common';
import { wetRoadPath, stoneFlags } from './terrain';
import { blobPath, type Ctx } from './paint';
import { findHouse, houseRoofGeometry } from './building';
import { smallHouseSize } from './sprites/smallHouses';
import { furniturePoint } from './sprites/furniture';

interface RainCell {
  x: number;
  y: number;
  level: number;
  /** Permanent building shade; vegetation is evaluated separately for the chosen date. */
  shade: number;
  crowns: { index: number; weight: number }[];
  sheltered: boolean;
  water: boolean;
  hard: boolean;
  moisture: number;
  deck: boolean;
}
export interface PuddleSite extends RainCell {
  seed: number;
  rx: number;
  ry: number;
}
export interface RainField {
  key: string;
  size: number;
  cells: RainCell[];
  puddles: PuddleSite[];
  plants: { type: string; seed: number }[];
  annual?: { key: string; now: number; shade: Float32Array };
}
const fields = new WeakMap<World, RainField>();
/** One geometric state per world; edits, moves, undo and imported gardens invalidate it. */
export function rainField(world: World): RainField {
  const objects = world.objects.filter((o) => {
    const i = ITEM_BY_ID.get(o.type);
    return i?.kind === 'tree' || i?.kind === 'shrub' || SMALL_HOUSE_IDS.has(o.type);
  });
  const key =
    world.tiles.map((t) => `${t.ground}:${t.level}:${+t.water}${+t.indoor}${+t.veranda}`).join('|') +
    ';' +
    objects.map((o) => `${o.type}:${o.tx}:${o.ty}:${o.rot}:${o.seed}`).join('|');
  const old = fields.get(world);
  if (old?.key === key) return old;
  const house = findHouse(world);
  const obstacles = objects.map((o, index) => {
    const i = ITEM_BY_ID.get(o.type)!,
      roof = SMALL_HOUSE_IDS.has(o.type),
      s = roof ? smallHouseSize(o.type) : { u: 0, v: 0 };
    return {
      index,
      level: world.at(Math.floor(o.tx + i.w / 2), Math.floor(o.ty + i.h / 2))?.level ?? 0,
      x: o.tx + i.w / 2,
      y: o.ty + i.h / 2,
      roof,
      u: (o.rot % 2 ? s.v : s.u) / 2,
      v: (o.rot % 2 ? s.u : s.v) / 2,
      r: i.kind === 'tree' ? 1.8 : 1,
    };
  });
  const f: RainField = {
    key,
    size: world.size,
    cells: [],
    puddles: [],
    plants: objects.map((o) => ({ type: o.type, seed: o.seed })),
  };
  for (let y = 0; y < world.size; y++)
    for (let x = 0; x < world.size; x++) {
      const t = world.at(x, y)!,
        px = x + 0.5,
        py = y + 0.5;
      let sheltered =
          t.indoor ||
          !!(house && px > house.x0 - 0.85 && px < house.x1 + 1.85 && py > house.y0 - 0.85 && py < house.y1 + 1.85),
        cover = 0;
      const crowns: RainCell['crowns'] = [];
      for (const o of obstacles) {
        if (o.roof) {
          if (Math.abs(px - o.x) < o.u && Math.abs(py - o.y) < o.v) sheltered = true;
          cover = Math.max(
            cover,
            clamp01(1 - Math.hypot(Math.max(0, Math.abs(px - o.x) - o.u), Math.max(0, Math.abs(py - o.y) - o.v)) / 0.9),
          );
        } else if (Math.abs(t.level - o.level) <= 1) {
          const weight = clamp01(1 - Math.hypot(px - o.x, py - o.y) / o.r);
          if (weight > 0) crowns.push({ index: o.index, weight });
        }
      }
      if (house) {
        const dx = Math.max(house.x0 - px, 0, px - house.x1 - 1),
          dy = Math.max(house.y0 - py, 0, py - house.y1 - 1);
        cover = Math.max(cover, clamp01(1 - Math.hypot(dx, dy) / 1.8));
      }
      const c: RainCell = {
        x,
        y,
        level: t.level,
        shade: cover,
        crowns,
        sheltered,
        water: t.water,
        hard: ['stone', 'gravel', 'deck'].includes(t.ground),
        moisture: Math.min(
          1,
          (t.ground === 'moss' ? 0.45 : t.ground === 'grass' ? 0.22 : 0.06) +
            ([-1, 0, 1].some((dy) =>
              [-1, 0, 1].some((dx) => {
                const n = world.at(x + dx, y + dy);
                return n?.water && Math.abs(n.level - t.level) <= 1;
              }),
            )
              ? 0.5
              : 0),
        ),
        deck: t.ground === 'deck',
      };
      f.cells.push(c);
      if (c.sheltered || c.water || t.veranda || !['moss', 'grass', 'soil', 'gravel'].includes(t.ground)) continue;
      let drains = false,
        higher = 0,
        nearWater = false;
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          const n = world.at(x + dx, y + dy);
          if (!n) {
            drains = true;
            continue;
          }
          nearWater ||= n.water;
          if (Math.abs(dx) + Math.abs(dy) === 1) {
            if (n.level < t.level - 0.05) drains = true;
            if (n.level > t.level + 0.05) higher++;
          }
        }
      if (drains || nearWater) continue;
      // Real depressions first; a few sub-tile hollows on flat soil, not a pond on every square.
      const chance = higher > 0 || t.level < 0 ? 0.3 : 0.025;
      if (hash2(x, y, 715) > chance) continue;
      f.puddles.push({ ...c, seed: x * 173 + y * 977, rx: 15 + hash2(x, y, 719) * 12, ry: 5 + hash2(y, x, 727) * 5 });
    }
  f.puddles.sort((a, b) => hash2(a.x, a.y, 739) - hash2(b.x, b.y, 739));
  f.puddles.length = Math.min(24, f.puddles.length);
  fields.set(world, f);
  return f;
}
/** One current scalar field, not a bitmap or an archive of past dates. Geometry survives scrubbing. */
export function rainShade(field: RainField, now: number): Float32Array {
  if (field.annual && field.annual.now === now) return field.annual.shade;
  const key = field.plants.map((p) => crownCacheKey(p.type, p.seed, now)).join('|');
  if (field.annual?.key === key) {
    field.annual.now = now;
    return field.annual.shade;
  }
  const densities = field.plants.map((p) =>
    ANNUAL_CROWN_TYPES.has(p.type) ? 0.08 + 0.92 * cachedCanopyDensity(p.type, p.seed, now) : 0,
  );
  const shade = Float32Array.from(field.cells, (c) => {
    let cover = c.shade;
    for (const crown of c.crowns) cover = Math.max(cover, crown.weight * densities[crown.index]);
    return cover;
  });
  field.annual = { key, now, shade };
  return shade;
}

/** Same recent rain, different evaporation: exposed areas lose their visible water first. */
export function residualWetness(wetness: number, cover: number, sheltered = false): number {
  return sheltered ? 0 : Math.pow(clamp01(wetness), lerp(1.8, 0.55, clamp01(cover)));
}
export function wetnessAt(
  field: RainField,
  weather: WeatherState | undefined,
  x: number,
  y: number,
  now: number,
): number {
  const c = field.cells[Math.floor(y) * field.size + Math.floor(x)];
  return !weather || x < 0 || y < 0 || x >= field.size || y >= field.size || !c
    ? 0
    : residualWetness(weather.wetness, rainShade(field, now)[Math.floor(y) * field.size + Math.floor(x)], c.sheltered);
}
const WET_MATERIALS = new Set([
  'rock_big',
  'rock_mid',
  'rock_trio',
  'water_stone',
  'step_stone',
  'bridge',
  'plank_bridge',
  'lantern_stone',
  'tsukubai',
  'shishi',
  'table',
  'engawa_bench',
  'torii',
]);
export function rainMaterial(
  atm: Atmosphere,
  field: RainField | undefined,
  weather: WeatherState | undefined,
  type: string,
  x: number,
  y: number,
): Atmosphere {
  if (!field || !WET_MATERIALS.has(type)) return atm;
  const wet = wetnessAt(field, weather, x, y, atm.time.now) * liquidExposure(atm.time.now);
  const q = Math.round(wet * 12) / 12;
  if (STONE_TYPES.has(type)) {
    const index = Math.floor(y) * field.size + Math.floor(x),
      cell = field.cells[index];
    const habitat = cell ? Math.min(1, cell.moisture * 0.6 + rainShade(field, atm.time.now)[index] * 0.6) : 0.25;
    return { ...atm, materialWetness: q, stoneHabitat: Math.round(habitat * 6) / 6 };
  }
  return q > 0 ? { ...atm, materialWetness: q } : atm;
}
interface RainView {
  x: number;
  y: number;
  width: number;
  height: number;
  zoom: number;
}
export function drawRainGround(
  ctx: Ctx,
  world: World,
  atm: Atmosphere,
  weather: WeatherState | undefined,
  time: number,
  view: RainView,
): number {
  if (!weather || weather.wetness < 0.015) return 0;
  const exposed = liquidExposure(atm.time.now);
  if (exposed <= 0.001) return 0;
  weather = { ...weather, wetness: weather.wetness * exposed };
  const f = rainField(world),
    annualShade = rainShade(f, atm.time.now),
    sky = mix(mix(atm.skyTop, atm.skyBottom, 0.65), atm.palette.water, 0.28);
  const visible = (p: Pt) =>
    Math.abs(p.x - view.x) < view.width / (2 * view.zoom) + 65 &&
    Math.abs(p.y - view.y) < view.height / (2 * view.zoom) + 40;
  ctx.save();
  ctx.globalCompositeOperation = 'multiply';
  // Batch equal moisture/material into at most 24 paths. No per-tile bitmap blits or island-sized buffer.
  const groups = new Map<number, RainCell[]>();
  const visibleHard: { c: RainCell; p: Pt; wet: number }[] = [];
  for (const c of f.cells) {
    if (c.sheltered || c.water) continue;
    const p = isoToScreen(c.x + 0.5, c.y + 0.5, c.level);
    if (!visible(p)) continue;
    const q = Math.round(residualWetness(weather.wetness, annualShade[c.y * f.size + c.x]) * 12);
    if (!q) continue;
    const key = q + (c.hard ? 16 : 0),
      list = groups.get(key) ?? [];
    list.push(c);
    groups.set(key, list);
    if (c.hard && (c.x + c.y) % 3 === 0) visibleHard.push({ c, p, wet: q / 12 });
  }
  for (const [key, cells] of groups) {
    const hard = key > 16,
      q = hard ? key - 16 : key;
    ctx.fillStyle = css({ r: 95, g: 102, b: 108 }, (q / 12) * 0.1);
    ctx.beginPath();
    for (const c of cells) {
      const pts = tileDiamond(c.x, c.y, c.level);
      pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
      ctx.closePath();
    }
    ctx.fill();
  }
  // Extra darkening follows the real path ribbon, never a dark square around a narrow footpath.
  ctx.save();
  const roadCells = [...groups]
    .filter(([key]) => key > 16)
    .flatMap(([, cells]) => cells)
    .filter((c) => !c.deck);
  if (roadCells.length) {
    const mask = new Set<RainCell>();
    for (const c of roadCells)
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          const x = c.x + dx,
            y = c.y + dy;
          if (x < 0 || y < 0 || x >= f.size || y >= f.size) continue;
          const n = f.cells[y * f.size + x];
          if (!n.sheltered && !n.water && n.level === c.level) mask.add(n);
        }
    // Include deck faces too when a frame mixes wooden floors and narrow paths.
    for (const [key, cells] of groups) if (key > 16) for (const c of cells) if (c.deck) mask.add(c);
    ctx.beginPath();
    for (const c of mask) {
      const p = tileDiamond(c.x, c.y, c.level);
      p.forEach((q, i) => (i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y)));
      ctx.closePath();
    }
    ctx.clip();
  }
  for (const [key, cells] of groups) {
    if (key <= 16) continue;
    const amount = (key - 16) / 12;
    for (const stone of [false, true]) {
      ctx.beginPath();
      let count = 0;
      for (const c of cells) {
        const t = world.at(c.x, c.y)!;
        if ((t.ground === 'stone') !== stone) continue;
        wetRoadPath(ctx, world, c.x, c.y, t);
        count++;
      }
      if (!count) continue;
      ctx.fillStyle = css({ r: 83, g: 93, b: 102 }, (stone ? Math.pow(amount, 1.8) : amount) * 0.26);
      ctx.fill();
      if (stone) {
        ctx.strokeStyle = css({ r: 74, g: 86, b: 80 }, Math.pow(amount, 0.55) * 0.22);
        ctx.lineWidth = 1.6;
        ctx.stroke();
      }
    }
  }
  ctx.restore();
  ctx.globalCompositeOperation = 'source-over';
  for (const { c, p, wet } of visibleHard) {
    ctx.strokeStyle = css(mix(sky, { r: 225, g: 231, b: 229 }, 0.35), wet * 0.22 * Math.min(1, atm.exposure));
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    const tile = world.at(c.x, c.y)!;
    if (tile.ground === 'stone') {
      const points = stoneFlags(world, c.x, c.y, tile)[0],
        a = points[0],
        b = points[1];
      ctx.strokeStyle = css(
        mix(sky, { r: 225, g: 231, b: 229 }, 0.35),
        Math.pow(wet, 1.8) * 0.26 * Math.min(1, atm.exposure),
      );
      const cx = points.reduce((s, p) => s + p.x, 0) / points.length,
        cy = points.reduce((s, p) => s + p.y, 0) / points.length;
      ctx.moveTo(lerp(lerp(a.x, b.x, 0.36), cx, 0.04), lerp(lerp(a.y, b.y, 0.36), cy, 0.04));
      ctx.lineTo(lerp(lerp(a.x, b.x, 0.64), cx, 0.04), lerp(lerp(a.y, b.y, 0.64), cy, 0.04));
    } else {
      ctx.moveTo(p.x - 15, p.y - 5);
      ctx.lineTo(p.x + 8, p.y + (c.deck ? 6 : -5));
    }
    ctx.stroke();
  }
  ctx.globalCompositeOperation = 'source-over';
  let count = 0;
  for (const s of f.puddles) {
    const wet = residualWetness(weather.wetness, annualShade[s.y * f.size + s.x]),
      amount = clamp01((wet - 0.2) / 0.8);
    if (amount <= 0.015) continue;
    const p = isoToScreen(s.x + 0.5, s.y + 0.5, s.level);
    if (!visible(p)) continue;
    const size = Math.sqrt(amount),
      rx = s.rx * size,
      ry = s.ry * size;
    ctx.save();
    const pts = tileDiamond(s.x, s.y, s.level);
    ctx.beginPath();
    pts.forEach((q, i) => (i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y)));
    ctx.closePath();
    ctx.clip();
    blobPath(ctx, p.x, p.y, rx, ry, s.seed, 0.3, 11);
    ctx.strokeStyle = css(shade(atm.palette.soil, atm.exposure * 0.65), amount * 0.23);
    ctx.lineWidth = 0.8;
    ctx.stroke();
    ctx.clip();
    const g = ctx.createLinearGradient(p.x, p.y - ry, p.x, p.y + ry);
    g.addColorStop(0, css(shade(sky, atm.exposure * 0.7), amount * 0.48));
    g.addColorStop(0.55, css(shade(sky, atm.exposure), amount * 0.38));
    g.addColorStop(1, css(mix(sky, atm.palette.soil, 0.3), amount * 0.12));
    ctx.fillStyle = g;
    ctx.fillRect(p.x - rx * 1.4, p.y - ry * 1.4, rx * 2.8, ry * 2.8);
    ctx.strokeStyle = css(mix(sky, { r: 238, g: 240, b: 224 }, 0.35), amount * 0.3 * Math.min(1, atm.exposure));
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(p.x - rx * 0.6, p.y - ry * 0.3);
    ctx.quadraticCurveTo(p.x, p.y - ry * 0.1, p.x + rx * 0.55, p.y - ry * 0.25);
    ctx.stroke();
    // Restrained rain impacts; after the rain only an occasional settling ring, never a boiling puddle.
    if (view.zoom > 0.55) {
      const phase = (((time * 0.00032 + hash2(s.seed, 1, 751)) % 1) + 1) % 1;
      if (phase < 0.28 && (weather.rain > 0.1 || hash2(s.seed, Math.floor(time / 3125), 757) > 0.87)) {
        ctx.strokeStyle = css(sky, (1 - phase / 0.28) * amount * 0.25);
        ctx.beginPath();
        ctx.ellipse(p.x, p.y, 2 + phase * rx, 1 + phase * ry, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
    ctx.restore();
    count++;
  }
  ctx.restore();
  return count;
}
function drip(ctx: Ctx, p: Pt, height: number, atm: Atmosphere, time: number, wet: number, seed: number): void {
  if (wet < 0.04 || height < 5) return;
  const period = 1500 + hash2(seed, 2, 811) * 2300,
    clock = time + hash2(seed, 3, 821) * period,
    cycle = Math.floor(clock / period),
    phase = ((clock / period - cycle) * period) / 700;
  if (phase > 1 || hash2(seed, cycle, 827) > wet) return;
  ctx.strokeStyle = css(
    mix(atm.skyBottom, { r: 231, g: 240, b: 243 }, 0.45),
    Math.min(0.7, wet * 0.7) * Math.min(1, atm.exposure + 0.2),
  );
  ctx.lineWidth = 1;
  ctx.beginPath();
  if (phase < 0.78) {
    const dy = height * Math.pow(phase / 0.78, 2);
    ctx.moveTo(p.x, p.y + dy);
    ctx.lineTo(p.x, p.y + Math.max(0, dy - 3));
  } else {
    const a = (phase - 0.78) / 0.22;
    ctx.globalAlpha *= 1 - a;
    ctx.ellipse(p.x, p.y + height, 1 + a * 4, 0.5 + a * 1.5, 0, 0, Math.PI * 2);
  }
  ctx.stroke();
}
export function drawHouseDrips(
  ctx: Ctx,
  world: World,
  atm: Atmosphere,
  weather: WeatherState | undefined,
  time: number,
  roofAlpha: number,
): void {
  const wet = (weather?.roofWetness ?? 0) * liquidExposure(atm.time.now);
  if (wet < 0.04 || roofAlpha < 0.004) return;
  const h = findHouse(world);
  if (!h) return;
  const g = houseRoofGeometry(h);
  for (const side of [1, 2])
    for (let i = 0; i < 5; i++) {
      const u = (i + 0.4) / 5,
        f = g.faces[side],
        x = side === 1 ? g.x1 : lerp(g.x1, g.x0, u),
        y = side === 1 ? lerp(g.y0, g.y1, u) : g.y1;
      const t = world.at(Math.floor(x), Math.floor(y));
      if (!t) continue;
      const p = { x: lerp(f.e0.x, f.e1.x, u), y: lerp(f.e0.y, f.e1.y, u) + Math.sin(Math.PI * u) * 3.5 + 5 };
      const bottom = isoToScreen(x, y, t.level - (t.water ? 0.26 : 0));
      ctx.save();
      ctx.globalAlpha *= roofAlpha;
      drip(ctx, p, bottom.y - p.y, atm, time, wet, side * 101 + i * 17);
      ctx.restore();
    }
}
/** Called in object depth order; hidden/back eaves cannot drip through the front wall. */
export function drawSmallHouseDrips(d: DrawCtx, weather: WeatherState | undefined): void {
  const wet = (weather?.roofWetness ?? 0) * liquidExposure(d.atm.time.now);
  if (!SMALL_HOUSE_IDS.has(d.obj.type) || wet < 0.04) return;
  const { u, v } = smallHouseSize(d.obj.type),
    height = d.obj.type === 'shed' ? 52 : d.obj.type === 'tea_house' ? 64 : 71;
  const corners = [
    [-u / 2, -v / 2],
    [u / 2, -v / 2],
    [u / 2, v / 2],
    [-u / 2, v / 2],
  ].map(([x, y]) => furniturePoint(d.obj.rot, x, y));
  for (let i = 0; i < 4; i++) {
    const a = corners[i],
      b = corners[(i + 1) % 4];
    if (a.y + b.y <= 0) continue;
    const p = {
      x: d.x + lerp(a.x, b.x, 0.58),
      y: d.y + lerp(a.y, b.y, 0.58) - height + Math.sin(Math.PI * 0.58) * 2 + 5,
    };
    d.ctx.save();
    d.ctx.globalAlpha *= d.alpha;
    drip(d.ctx, p, height - 7, d.atm, d.time, wet, d.obj.seed + i * 37);
    d.ctx.restore();
  }
}
