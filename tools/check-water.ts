/** Connected ponds, islands, cascades, clipping, deterministic motion and a mobile-sized frame budget. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createCanvas } from '@napi-rs/canvas';
Object.assign(globalThis, { document: { createElement: () => createCanvas(8, 8) } });
import { World } from '../src/world/world';
import { History } from '../src/core/history';
import { BRUSH_BY_ID } from '../src/world/catalog';
import { WaterFlow } from '../src/world/waterFlow';
import { computeTime } from '../src/core/clock';
import { Life } from '../src/world/life';
import { drawFish, drawFishAt } from '../src/render/creatures';
import { isoToScreen } from '../src/core/iso';
import { buildAtmosphere } from '../src/world/palette';
import {
  prepareWaterSurface,
  waterSurfaces,
  waterSurfacePath,
  drawWaterSurface,
  drawWaterAnimation,
} from '../src/render/waterSurface';
import { drawCurrent, drawFalls, drawShoreRipple } from '../src/render/water';

const W = 460,
  H = 300,
  ZOOM = 0.145;
const canvas = createCanvas(W, H),
  mask = createCanvas(W, H);
const ctx = canvas.getContext('2d'),
  mctx = mask.getContext('2d');
const dc = ctx as unknown as CanvasRenderingContext2D;
const mc = mctx as unknown as CanvasRenderingContext2D;
const day = buildAtmosphere(computeTime(new Date(2026, 8, 19, 13).getTime()));
const night = buildAtmosphere(computeTime(new Date(2026, 8, 19, 23).getTime()));
const overcast = buildAtmosphere(day.time, 1);
const digest = () =>
  createHash('sha256')
    .update(ctx.getImageData(0, 0, W, H).data)
    .digest('hex');
const reset = (c: typeof ctx) => {
  c.resetTransform();
  c.clearRect(0, 0, W, H);
  c.translate(W / 2, 36);
  c.scale(ZOOM, ZOOM);
};
const world = new World();
world.objects = [];
const empty = () => {
  for (const t of world.tiles) {
    t.water = false;
    t.ground = 'moss';
    t.level = 0;
    t.indoor = false;
    t.veranda = false;
  }
};
const water = (x: number, y: number, level = 0) => {
  const t = world.at(x, y)!;
  t.water = true;
  t.ground = 'water';
  t.level = level;
};
const rect = (x0: number, y0: number, w: number, h: number, level = 0) => {
  for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) water(x, y, level);
};
const cases = [
  { name: 'empty', loops: 0, setup: () => {} },
  { name: 'single tile', loops: 1, setup: () => water(12, 12) },
  { name: 'pond', loops: 1, setup: () => rect(8, 8, 10, 8) },
  {
    name: 'dry island',
    loops: 2,
    setup: () => {
      rect(7, 7, 12, 12);
      for (let y = 11; y < 15; y++) for (let x = 11; x < 15; x++) world.at(x, y)!.water = false;
    },
  },
  {
    name: 'diagonal contact',
    loops: 2,
    setup: () => {
      water(12, 12);
      water(13, 13);
    },
  },
  {
    name: 'separate ponds',
    loops: 2,
    setup: () => {
      rect(3, 3, 3, 3);
      rect(18, 18, 3, 3);
    },
  },
  {
    name: 'one-tile stream',
    loops: 1,
    setup: () => {
      rect(3, 8, 16, 1);
      rect(18, 9, 1, 9);
    },
  },
  {
    name: 'cascade',
    loops: 2,
    setup: () => {
      rect(6, 8, 5, 5, 2);
      rect(11, 8, 7, 5, 0);
    },
  },
  { name: 'full garden / borders', loops: 1, setup: () => rect(0, 0, world.size, world.size) },
];
let frames = 0;
for (const c of cases) {
  empty();
  c.setup();
  const surfaces = prepareWaterSurface(world);
  assert.equal(
    surfaces.reduce((n, s) => n + s.loops.length, 0),
    c.loops,
    c.name,
  );
  assert.equal(
    surfaces.reduce((n, s) => n + s.cells.length, 0),
    world.tiles.filter((t) => t.water).length,
  );
  assert.equal(waterSurfaces(world), surfaces, 'geometry is reused between frames');
  assert.deepEqual(prepareWaterSurface(world), surfaces, 'geometry is deterministic');
  const snapshot = JSON.stringify({ tiles: world.tiles, objects: world.objects, surfaces });
  const flow = new WaterFlow();
  flow.ensure(world);
  if (c.name === 'cascade') assert.ok(flow.curtains.length > 0 && flow.hasCurrent);
  reset(mctx);
  mctx.fillStyle = '#fff';
  for (const s of surfaces) {
    waterSurfacePath(mc, s);
    mctx.fill('evenodd');
  }
  const maskPixels = mctx.getImageData(0, 0, W, H).data;
  for (const s of surfaces)
    for (const t of s.cells) {
      const p = isoToScreen(t.x + 0.5, t.y + 0.5, s.level - 0.26);
      const x = Math.round(W / 2 + p.x * ZOOM),
        y = Math.round(36 + p.y * ZOOM);
      assert.ok(maskPixels[(y * W + x) * 4 + 3] > 250, `${c.name}: cell centre inside water`);
    }
  if (c.name === 'dry island') {
    const p = isoToScreen(13, 13, -0.26);
    assert.equal(
      maskPixels[(Math.round(36 + p.y * ZOOM) * W + Math.round(W / 2 + p.x * ZOOM)) * 4 + 3],
      0,
      'island remains dry',
    );
  }
  for (const atm of [day, night, overcast]) {
    reset(ctx);
    drawWaterSurface(dc, world, atm);
    const still = digest();
    reset(ctx);
    drawWaterSurface(dc, world, atm);
    assert.equal(digest(), still);
    const hashes = new Set<string>();
    for (const ms of [0, 900, 2500, 5500]) {
      reset(ctx);
      ctx.globalAlpha = 0.73;
      const before = ctx.getTransform();
      const alpha = ctx.globalAlpha;
      drawWaterAnimation(dc, world, atm, ms, 0.4);
      drawCurrent(dc, world, flow, atm, ms);
      drawShoreRipple(dc, world, flow, atm, ms);
      assert.equal(ctx.globalAlpha, alpha);
      assert.deepEqual(ctx.getTransform(), before);
      assert.equal(ctx.globalCompositeOperation, 'source-over');
      ctx.globalAlpha = 1;
      const pixels = ctx.getImageData(0, 0, W, H).data;
      for (let i = 3; i < pixels.length; i += 4)
        if (maskPixels[i] === 0) assert.ok(pixels[i] <= 2, `${c.name}: ripple leaked onto dry land`);
      hashes.add(digest());
      frames++;
    }
    if (surfaces.length) assert.ok(hashes.size > 1, `${c.name}: water must animate`);
    reset(ctx);
    drawWaterAnimation(dc, world, atm, 2500, 0.4);
    const a = digest();
    reset(ctx);
    drawWaterAnimation(dc, world, atm, 2500, 0.4);
    assert.equal(digest(), a, 'paused frame is deterministic');
    reset(ctx);
    drawFalls(dc, world, flow, atm, 2500);
  }
  assert.equal(
    JSON.stringify({ tiles: world.tiles, objects: world.objects, surfaces }),
    snapshot,
    'render must not mutate world/geometry',
  );
  console.log(`ок: ${c.name}`);
}
// Geometry changes only when explicitly rebuilt alongside terrain (paint, erase, undo/load).
const old = waterSurfaces(world);
empty();
water(4, 4, -1);
const rebuilt = prepareWaterSurface(world);
assert.notEqual(rebuilt, old);
assert.equal(rebuilt[0].level, -1);
assert.equal(rebuilt[0].cells.length, 1);
empty();
assert.deepEqual(prepareWaterSurface(world), []);

// Real editing/history/load paths; rendering rebuilds the same geometry after each.
const history = new History(world);
history.begin('pond');
world.applyBrush(BRUSH_BY_ID.get('w_pond4')!, 12, 12);
history.commit();
const painted = prepareWaterSurface(world);
assert.ok(painted.length > 0);
const save = structuredClone(world.toJSON());
history.undo();
assert.deepEqual(prepareWaterSurface(world), []);
history.redo();
assert.deepEqual(prepareWaterSurface(world), painted);
empty();
prepareWaterSurface(world);
world.applySave(save);
assert.deepEqual(prepareWaterSurface(world), painted);
console.log('ок: water brush, undo, redo and save restoration rebuild the contour');

// Reflections follow live objects, not a stale terrain snapshot.
empty();
rect(8, 8, 9, 9);
prepareWaterSurface(world);
reset(ctx);
drawWaterAnimation(dc, world, day, 1800, 0.4);
const withoutTree = digest();
world.objects = [{ id: 1, type: 'willow', tx: 7, ty: 10, rot: 0, planted: 0, seed: 42 }];
reset(ctx);
drawWaterAnimation(dc, world, day, 1800, 0.4);
assert.notEqual(digest(), withoutTree, 'nearby trees reflect in the pond');
world.objects = [];
reset(ctx);
drawWaterAnimation(dc, world, day, 1800, 0.4);
assert.equal(digest(), withoutTree, 'removing a tree removes its reflection without a terrain rebuild');
reset(ctx);
drawWaterAnimation(dc, world, night, 1800, 0.4);
assert.notEqual(digest(), withoutTree, 'night lighting differs from daylight');
reset(ctx);
drawWaterAnimation(dc, world, day, 1800, 1);
assert.notEqual(digest(), withoutTree, 'wind affects the ripples');
console.log('ок: live tree reflections, time of day and wind');

// Stress a completely flooded garden, with geometry already cached.
rect(0, 0, world.size, world.size);
prepareWaterSurface(world);
for (let i = 0; i < 10; i++) {
  reset(ctx);
  drawWaterAnimation(dc, world, day, i * 16);
}
const started = performance.now();
for (let i = 0; i < 60; i++) {
  reset(ctx);
  drawWaterAnimation(dc, world, day, i * 16);
}
const avg = (performance.now() - started) / 60;
assert.ok(avg < 16, `water-only render budget exceeded: ${avg.toFixed(1)}ms`);
console.log(
  `ок: ${frames} frames; full flooded garden: ${avg.toFixed(2)} ms/frame (native canvas, not a phone benchmark)`,
);

// Fish are clipped to the curved shoreline and receive depth colour only in the garden.
const specimenWorld = new World();
const life = new Life();
life.sync(specimenWorld);
const fish = { ...life.fish[0], tx: 12.5, ty: 12.5, state: 'wander' as const };
assert.ok(life.fish.length > 0);
empty();
rect(10, 10, 6, 6);
prepareWaterSurface(world);
const point = isoToScreen(fish.tx, fish.ty, -0.26);
const fishFrame = () => {
  ctx.resetTransform();
  ctx.clearRect(0, 0, W, H);
  ctx.translate(W / 2 - point.x, H / 2 - point.y);
};
fishFrame();
drawFishAt(dc, fish, point.x, point.y, day, 1200);
const bookFish = digest();
fishFrame();
drawFish(dc, fish, world, day, 1200);
const submergedFish = digest();
assert.notEqual(submergedFish, bookFish, 'garden fish are depth tinted; guide retains the original coat');
assert.ok(ctx.getImageData(0, 0, W, H).data.some((v, i) => i % 4 === 3 && v > 0));
const serializedFish = JSON.stringify(fish);
fishFrame();
drawFish(dc, fish, world, day, 1200);
assert.equal(digest(), submergedFish);
assert.equal(JSON.stringify(fish), serializedFish);
empty();
prepareWaterSurface(world);
fishFrame();
drawFish(dc, fish, world, day, 1200);
assert.ok(
  ctx.getImageData(0, 0, W, H).data.every((v, i) => i % 4 !== 3 || v === 0),
  'no koi on dry land',
);
console.log('ок: underwater koi tint, pure rendering and dry land rejection');
