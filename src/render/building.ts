/** Timber, paper and tiled hip roof. Furniture and architecture share the floor's isometry. */
import { GRID, LEVEL_H, TILE_H, TILE_W, isoToScreen, type Pt } from '../core/iso';
import { hash2, lerp } from '../core/rng';
import { Atmosphere, RGB, css, mix, shade } from '../world/palette';
import { World } from '../world/world';
import { Ctx, glow, washBlob } from './paint';
import { roofSnow, roofSnowKey, paintRoofSnow, paintSnowRidge, paintIcicles } from './roofSnow';

export interface HouseBox {
  x0: number;
  y0: number;
  x1: number; // включительно
  y1: number;
  level: number;
}

/** Ищет прямоугольник комнат (татами). */
export function findHouse(world: World): HouseBox | null {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  let level = 0;
  let found = false;
  for (let y = 0; y < GRID; y++) {
    for (let x = 0; x < GRID; x++) {
      const t = world.at(x, y)!;
      if (!t.indoor) continue;
      found = true;
      x0 = Math.min(x0, x);
      y0 = Math.min(y0, y);
      x1 = Math.max(x1, x);
      y1 = Math.max(y1, y);
      level = Math.max(level, t.level);
    }
  }
  return found ? { x0, y0, x1, y1, level } : null;
}

/** Old saves may not have a birth timestamp. Geometry supplies a stable house identity even there. */
export function mainRoofSnowSeed(h: HouseBox): number {
  return Math.floor(hash2(h.x0, h.y0, (h.x1 - h.x0) * 313 + (h.y1 - h.y0) * 977) * 0x7fffffff);
}
export const WALL_H = 76;
const OVERHANG = 0.85;
const EAVE_H = WALL_H + 7;
type RoofFace = { e0: Pt; e1: Pt; r0: Pt; r1: Pt; side: number; tiles: number };
const blend = (a: Pt, b: Pt, t: number): Pt => ({ x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t) });
const down = (p: Pt, z: number): Pt => ({ x: p.x, y: p.y + z });
function trace(ctx: Ctx, pts: Pt[], close = false) {
  ctx.beginPath();
  pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
  if (close) ctx.closePath();
}
function fill(ctx: Ctx, pts: Pt[], c: RGB, a = 1) {
  trace(ctx, pts, true);
  ctx.fillStyle = css(c, a);
  ctx.fill();
}
function line(ctx: Ctx, pts: Pt[], c: RGB, width: number, a = 1) {
  trace(ctx, pts);
  ctx.strokeStyle = css(c, a);
  ctx.lineWidth = width;
  ctx.stroke();
}
function tones(atm: Atmosphere) {
  const lit = (c: RGB) => shade(mix(c, atm.lightTint, atm.lightAmount * 0.8), atm.exposure);
  return {
    wood: lit({ r: 142, g: 99, b: 65 }),
    dark: lit({ r: 77, g: 54, b: 41 }),
    edge: lit({ r: 191, g: 147, b: 97 }),
    paper: shade(
      mix(
        mix({ r: 238, g: 229, b: 206 }, { r: 255, g: 214, b: 156 }, atm.lampGlow * 0.35),
        atm.lightTint,
        atm.lightAmount * 0.4,
      ),
      atm.exposure + atm.lampGlow * 0.13,
    ),
    plaster: lit({ r: 202, g: 191, b: 170 }),
    roof: lit({ r: 122, g: 127, b: 134 }),
    roofDark: lit({ r: 66, g: 73, b: 84 }),
    roofLight: lit({ r: 171, g: 170, b: 166 }),
  };
}

/** Ridge is parallel to the longer WORLD axis, not a diagonal in screen space. */
export function houseRoofGeometry(h: HouseBox) {
  const x0 = h.x0 - OVERHANG,
    y0 = h.y0 - OVERHANG,
    x1 = h.x1 + 1 + OVERHANG,
    y1 = h.y1 + 1 + OVERHANG;
  const w = x1 - x0,
    l = y1 - y0,
    short = Math.min(w, l),
    rise = Math.min(104, Math.max(38, short * 13));
  const point = (x: number, y: number, z = EAVE_H) => down(isoToScreen(x, y, h.level), -z);
  const corners = [point(x0, y0), point(x1, y0), point(x1, y1), point(x0, y1)];
  const inset = short * 0.4;
  const a = w >= l ? point(x0 + inset, (y0 + y1) / 2, EAVE_H + rise) : point((x0 + x1) / 2, y0 + inset, EAVE_H + rise);
  const b = w >= l ? point(x1 - inset, (y0 + y1) / 2, EAVE_H + rise) : point((x0 + x1) / 2, y1 - inset, EAVE_H + rise);
  const ends =
    w >= l
      ? [
          [a, b],
          [b, b],
          [b, a],
          [a, a],
        ]
      : [
          [a, a],
          [a, b],
          [b, b],
          [b, a],
        ];
  const faces: RoofFace[] = corners.map((e0, i) => ({
    e0,
    e1: corners[(i + 1) % 4],
    r0: ends[i][0],
    r1: ends[i][1],
    side: i,
    tiles: Math.ceil((i % 2 ? l : w) * 5),
  }));
  return { corners, a, b, faces, x0, y0, x1, y1 };
}
/** Shared curved surface for silhouette, tile courses and fascia: no floating seams. */
function surface(f: RoofFace, u: number, v: number): Pt {
  const p = blend(blend(f.r0, f.r1, u), blend(f.e0, f.e1, u), v);
  p.y += Math.sin(Math.PI * u) * 3.5 * v * v;
  return p;
}
function course(f: RoofFace, v: number): Pt[] {
  return Array.from({ length: 25 }, (_, i) => surface(f, i / 24, v));
}

/** Tile channels are parallel on the roof plane, not radial rays converging at a hip. */
function tilePoint(f: RoofFace, u: number, v: number): Pt {
  const mid = blend(blend(f.r0, f.r1, 0.5), blend(f.e0, f.e1, 0.5), v);
  return {
    x: mid.x + (u - 0.5) * (f.e1.x - f.e0.x),
    y: mid.y + (u - 0.5) * (f.e1.y - f.e0.y) + Math.sin(Math.PI * u) * 3.5 * v * v,
  };
}

/** Soft contact shade belongs UNDER furniture and fades with the roof, not over the entire scene. */
export function drawHouseShade(ctx: Ctx, world: World, atm: Atmosphere, alpha: number): void {
  if (alpha <= 0.004) return;
  const h = findHouse(world);
  if (!h) return;
  ctx.save();
  ctx.globalAlpha *= alpha;
  // Restrict shade to real floor/deck tiles, including edited holes and uneven veranda edges.
  ctx.beginPath();
  for (let y = h.y0 - 1; y <= h.y1 + 1; y++)
    for (let x = h.x0 - 1; x <= h.x1 + 1; x++) {
      const t = world.at(x, y);
      if (!t || !(t.indoor || t.veranda)) continue;
      const points = [
        isoToScreen(x, y, t.level),
        isoToScreen(x + 1, y, t.level),
        isoToScreen(x + 1, y + 1, t.level),
        isoToScreen(x, y + 1, t.level),
      ];
      points.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
      ctx.closePath();
    }
  ctx.clip();
  const pts = [
    isoToScreen(h.x0, h.y0, h.level),
    isoToScreen(h.x1 + 1, h.y0, h.level),
    isoToScreen(h.x1 + 1, h.y1 + 1, h.level),
    isoToScreen(h.x0, h.y1 + 1, h.level),
  ];
  fill(ctx, pts, atm.shadowTint, atm.shadowAmount * 0.19);
  // Feather the shade across the front veranda, using floor coordinates rather than screen rectangles.
  ctx.transform(TILE_W / 2, TILE_H / 2, -TILE_W / 2, TILE_H / 2, 0, -h.level * LEVEL_H);
  for (const alongX of [true, false]) {
    const edge = alongX ? h.x1 + 1 : h.y1 + 1;
    const grad = ctx.createLinearGradient(
      alongX ? edge : 0,
      alongX ? 0 : edge,
      alongX ? edge + OVERHANG : 0,
      alongX ? 0 : edge + OVERHANG,
    );
    grad.addColorStop(0, css(atm.shadowTint, atm.shadowAmount * 0.22));
    grad.addColorStop(1, css(atm.shadowTint, 0));
    ctx.fillStyle = grad;
    if (alongX) ctx.fillRect(edge, h.y0 - 0.65, OVERHANG, h.y1 - h.y0 + 2.3);
    else ctx.fillRect(h.x0 - 0.65, edge, h.x1 - h.x0 + 2.3, OVERHANG);
  }
  ctx.restore();
}

export function drawHouseWalls(ctx: Ctx, world: World, atm: Atmosphere): void {
  const h = findHouse(world);
  if (!h) return;
  const T = tones(atm);
  ctx.save();
  ctx.lineJoin = 'round';
  for (const [ax, ay, bx, by, side] of [
    [h.x0, h.y0, h.x1 + 1, h.y0, 0],
    [h.x0, h.y0, h.x0, h.y1 + 1, 1],
  ]) {
    const a = isoToScreen(ax, ay, h.level),
      b = isoToScreen(bx, by, h.level),
      length = Math.hypot(bx - ax, by - ay);
    const q = (t: number, z: number) => down(blend(a, b, t), -z);
    fill(ctx, [q(0, 0), q(1, 0), q(1, WALL_H), q(0, WALL_H)], shade(T.plaster, side ? 0.88 : 1));
    fill(ctx, [q(0, 12), q(1, 12), q(1, 65), q(0, 65)], shade(T.paper, side ? 0.92 : 1));
    fill(ctx, [q(0, 1), q(1, 1), q(1, 12), q(0, 12)], T.wood);
    for (let j = 0; j < length; j++) {
      // Wood panels below the translucent paper; fine fibres stay inside each sheet.
      for (let k = 1; k < 4; k++)
        line(ctx, [q((j + k / 4) / length, 12), q((j + k / 4) / length, 65)], T.wood, 0.75, 0.7);
      for (let z = 25; z < 65; z += 13) line(ctx, [q(j / length, z), q((j + 1) / length, z)], T.wood, 0.8, 0.6);
      for (let k = 0; k < 12; k++) {
        const t = (j + 0.08 + hash2(j, k, 119) * 0.82) / length,
          z = 17 + hash2(k, j, 281) * 43;
        line(ctx, [q(t, z), q(Math.min((j + 0.97) / length, t + 0.06 / length), z + 0.25)], T.plaster, 0.5, 0.3);
      }
      for (const z of [4, 8])
        line(ctx, [q((j + 0.06) / length, z), q((j + 0.94) / length, z + 0.4)], T.edge, 0.6, 0.35);
    }
    for (let i = 0; i <= length; i++) {
      line(ctx, [q(i / length, 0), q(i / length, WALL_H)], T.dark, 3.5);
      line(ctx, [down(q(i / length, 2), 0), q(i / length, 73)], T.edge, 0.65, 0.75);
    }
    for (const z of [0, 12, 65, WALL_H]) line(ctx, [q(0, z), q(1, z)], T.dark, z === WALL_H ? 5 : 2.2);
    line(ctx, [q(0, 73), q(1, 73)], T.edge, 1, 0.65);
  }
  ctx.restore();
}

function posts(ctx: Ctx, world: World, h: HouseBox, T: ReturnType<typeof tones>) {
  const x0 = h.x0 - 0.65,
    y0 = h.y0 - 0.65,
    x1 = h.x1 + 1.65,
    y1 = h.y1 + 1.65;
  const used = new Set<string>();
  for (const [ax, ay, bx, by] of [
    [x0, y1, x1, y1],
    [x1, y0, x1, y1],
  ]) {
    const n = Math.ceil(Math.hypot(bx - ax, by - ay) / 2.3);
    const a = isoToScreen(ax, ay, h.level),
      b = isoToScreen(bx, by, h.level);
    fill(ctx, [down(a, -EAVE_H + 7), down(b, -EAVE_H + 7), down(b, -EAVE_H + 13), down(a, -EAVE_H + 13)], T.dark);
    line(ctx, [down(a, -EAVE_H + 8), down(b, -EAVE_H + 8)], T.edge, 1, 0.65);
    for (let i = 0; i <= n; i++) {
      const x = lerp(ax, bx, i / n),
        y = lerp(ay, by, i / n),
        key = `${x.toFixed(3)},${y.toFixed(3)}`;
      if (used.has(key)) continue;
      used.add(key);
      const tile = world.at(Math.floor(x), Math.floor(y));
      if (!tile || !(tile.veranda || tile.indoor)) continue;
      const p = isoToScreen(x, y, tile.level),
        top = isoToScreen(x, y, h.level);
      fill(
        ctx,
        [
          { x: p.x - 3.5, y: p.y },
          { x: p.x + 3.5, y: p.y + 1 },
          { x: top.x + 3.5, y: top.y - EAVE_H + 6 },
          { x: top.x - 3.5, y: top.y - EAVE_H + 6 },
        ],
        T.wood,
      );
      line(
        ctx,
        [
          { x: p.x + 2, y: p.y },
          { x: top.x + 2, y: top.y - EAVE_H + 7 },
        ],
        T.dark,
        2,
      );
      line(
        ctx,
        [
          { x: p.x - 2, y: p.y - 3 },
          { x: top.x - 2, y: top.y - EAVE_H + 12 },
        ],
        T.edge,
        0.7,
        0.55,
      );
      ctx.fillStyle = css(T.dark);
      ctx.fillRect(top.x - 6, top.y - EAVE_H + 9, 12, 4);
      ctx.fillStyle = css(T.edge, 0.7);
      ctx.fillRect(top.x - 5, top.y - EAVE_H + 9, 10, 1);
      // Diagonal knee brace makes the support visibly meet its lintel.
      line(
        ctx,
        [
          { x: top.x, y: top.y - EAVE_H + 26 },
          { x: top.x + 13, y: top.y - EAVE_H + 14 },
        ],
        T.wood,
        3,
      );
    }
  }
}
function roofPaint(ctx: Ctx, world: World, h: HouseBox, atm: Atmosphere): void {
  const snow = roofSnow(atm, mainRoofSnowSeed(h));
  const T = tones(atm),
    g = houseRoofGeometry(h);
  ctx.save();
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  posts(ctx, world, h, T);
  // Far planes first, then the two foreground slopes. All four share the same ridge endpoints.
  for (const i of [0, 3, 1, 2]) {
    const f = g.faces[i],
      col = shade(T.roof, [1.03, 0.81, 0.96, 0.9][i]);
    const edge = course(f, 1),
      outline = [f.r0, f.r1, ...edge.slice().reverse()];
    fill(ctx, outline, col);
    ctx.save();
    trace(ctx, outline, true);
    ctx.clip();
    const top = Math.min(f.r0.y, f.r1.y, f.e0.y, f.e1.y),
      bot = Math.max(f.r0.y, f.r1.y, f.e0.y, f.e1.y) + 8;
    const left = Math.min(f.r0.x, f.r1.x, f.e0.x, f.e1.x),
      right = Math.max(f.r0.x, f.r1.x, f.e0.x, f.e1.x);
    const gr = ctx.createLinearGradient(0, top, 0, bot);
    gr.addColorStop(0, css(T.roofLight, 0.17));
    gr.addColorStop(0.55, css(T.roofLight, 0));
    gr.addColorStop(1, css(T.roofDark, 0.2));
    ctx.fillStyle = gr;
    ctx.fillRect(left, top, right - left, bot - top);
    washBlob(
      ctx,
      (left + right) / 2,
      (top + bot) / 2,
      (right - left) * 0.36,
      (bot - top) * 0.46,
      T.roofLight,
      491 + i,
      { layers: 2, alpha: 0.08, edge: 0, wobble: 0.22 },
    );
    // Restrained tile channels; staggered joins and a few uneven pigments, not a dense black grid.
    for (let k = 1; k < f.tiles; k++) {
      const u = k / f.tiles;
      line(ctx, [tilePoint(f, u, 0), tilePoint(f, u, 1)], T.roofDark, 0.65, 0.23);
      line(ctx, [tilePoint(f, u + 0.005, 0), tilePoint(f, u + 0.005, 1)], T.roofLight, 0.6, 0.17);
    }
    for (let row = 1; row <= 9; row++) {
      const v = row / 10;
      line(ctx, course(f, v), T.roofDark, 0.85, 0.32);
      for (let k = row % 2; k < f.tiles; k += 2) {
        if (hash2(k, row, 61) > 0.72)
          fill(
            ctx,
            [
              tilePoint(f, k / f.tiles, v),
              tilePoint(f, (k + 1) / f.tiles, v),
              tilePoint(f, (k + 1) / f.tiles, v + 0.095),
              tilePoint(f, k / f.tiles, v + 0.095),
            ],
            T.roofDark,
            0.07,
          );
        const p = tilePoint(f, (k + 0.2) / f.tiles, v),
          q = tilePoint(f, (k + 0.8) / f.tiles, v);
        if (hash2(k, row, i) > 0.35) line(ctx, [down(p, -0.8), down(q, -0.8)], T.roofLight, 0.8, 0.22);
      }
    }
    paintRoofSnow(ctx, atm, snow, outline, (u, v) => surface(f, u, v), i);
    ctx.restore();
    line(ctx, edge, T.roofDark, 2, 0.85);
  }
  // A real dark wooden soffit, tile lip and regularly spaced rafter ends beneath the front eaves.
  for (const i of [1, 2]) {
    const f = g.faces[i],
      edge = course(f, 1);
    fill(
      ctx,
      [
        ...edge,
        ...edge
          .slice()
          .reverse()
          .map((p) => down(p, 9)),
      ],
      T.dark,
    );
    line(
      ctx,
      edge.map((p) => down(p, 7)),
      T.wood,
      2,
    );
    for (let j = 1; j < f.tiles; j += 2) {
      const p = surface(f, j / f.tiles, 1);
      line(ctx, [down(p, 3), down(p, 8)], T.edge, 2.4, 0.8);
    }
    line(ctx, edge, T.roofDark, 3);
    line(
      ctx,
      edge.map((p) => down(p, -0.8)),
      T.roofLight,
      1,
      0.65,
    );
  }
  for (const i of [1, 2]) paintIcicles(ctx, atm, snow, course(g.faces[i], 1), i);
  for (const f of g.faces) {
    line(ctx, [f.e0, f.r0], T.roofDark, 4, 0.85);
    line(ctx, [down(f.e0, -1), down(f.r0, -1)], T.roofLight, 1.1, 0.5);
  }
  line(ctx, [g.a, g.b], T.roofDark, 8);
  line(ctx, [down(g.a, -2), down(g.b, -2)], T.roofLight, 3, 0.9);
  const n = Math.max(2, Math.round(Math.hypot(g.b.x - g.a.x, g.b.y - g.a.y) / 12));
  for (let i = 0; i <= n; i++) {
    const p = blend(g.a, g.b, i / n);
    line(
      ctx,
      [
        { x: p.x - 1.5, y: p.y - 4 },
        { x: p.x + 1.5, y: p.y + 2 },
      ],
      T.roofDark,
      1,
      0.7,
    );
  }
  if (snow.amount)
    for (const f of g.faces) paintSnowRidge(ctx, atm, snow, f.r0, blend(f.r0, f.e0, snow.amount > 0.7 ? 0.74 : 0.2));
  paintSnowRidge(ctx, atm, snow, g.a, g.b);
  ctx.restore();
}

// One bounded raster, not one per light sample or house. Fine roof details are not repainted every frame.
let roofCache: {
  world: World;
  key: string;
  canvas: HTMLCanvasElement;
  x: number;
  y: number;
  w: number;
  h: number;
} | null = null;
export function drawHouseRoof(ctx: Ctx, world: World, atm: Atmosphere, time: number): void {
  const h = findHouse(world);
  if (!h) return;
  ctx.save();
  const T = tones(atm),
    g = houseRoofGeometry(h);
  const key = JSON.stringify([
    h,
    roofSnowKey(atm, mainRoofSnowSeed(h)),
    ...Object.values(T).map((c) => [c.r, c.g, c.b].map((v) => Math.round(v / 3))),
    // Support changes can occur without changing the indoor bounding rectangle.
    world.tiles.map((t, i) => (t.veranda || t.indoor ? [i, t.level, t.veranda] : null)).filter(Boolean),
  ]);
  if (typeof document === 'undefined') roofPaint(ctx, world, h, atm);
  else {
    if (roofCache?.world !== world || roofCache.key !== key) {
      const floorMin = Math.min(h.level, ...world.tiles.filter((t) => t.veranda || t.indoor).map((t) => t.level));
      const pts = [
        ...g.corners,
        g.a,
        g.b,
        ...g.corners.map((p) => down(p, EAVE_H + 18 + (h.level - floorMin) * LEVEL_H)),
      ];
      const x = Math.floor(Math.min(...pts.map((p) => p.x)) - 18),
        y = Math.floor(Math.min(...pts.map((p) => p.y)) - 18);
      const w = Math.ceil(Math.max(...pts.map((p) => p.x)) - x + 18),
        height = Math.ceil(Math.max(...pts.map((p) => p.y)) - y + 18);
      const scale = Math.min(1.5, 1280 / w, 900 / height),
        canvas = roofCache?.canvas ?? document.createElement('canvas');
      canvas.width = Math.ceil(w * scale);
      canvas.height = Math.ceil(height * scale);
      const c = canvas.getContext('2d')!;
      c.scale(scale, scale);
      c.translate(-x, -y);
      roofPaint(c, world, h, atm);
      roofCache = { world, key, canvas, x, y, w: canvas.width / scale, h: canvas.height / scale };
    }
    const c = roofCache;
    ctx.drawImage(c.canvas, c.x, c.y, c.w, c.h);
  }
  if (atm.lampGlow > 0.05) {
    const p = down(blend(g.corners[2], g.corners[3], 0.35), 18);
    const swing = Math.sin(time * 0.001) * 1.2;
    line(ctx, [down(p, -10), { x: p.x + swing, y: p.y + 5 }], T.dark, 1.2);
    ctx.fillStyle = css({ r: 255, g: 214, b: 153 }, atm.lampGlow * 0.75);
    ctx.beginPath();
    ctx.ellipse(p.x + swing, p.y + 13, 7, 10, 0, 0, Math.PI * 2);
    ctx.fill();
    for (const z of [7, 12, 17])
      line(
        ctx,
        [
          { x: p.x + swing - 5, y: p.y + z },
          { x: p.x + swing + 5, y: p.y + z },
        ],
        T.wood,
        0.7,
        0.45,
      );
    glow(ctx, p.x + swing, p.y + 13, 60, { r: 255, g: 198, b: 127 }, atm.lampGlow * 0.35);
  }
  ctx.restore();
}
export { LEVEL_H, TILE_H, TILE_W };
