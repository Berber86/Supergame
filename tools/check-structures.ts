/** Geometry, legacy saves and native-canvas visual fixtures. --preview writes ignored PNGs. */
import assert from 'node:assert/strict';
import { createCanvas } from '@napi-rs/canvas';
import { writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { World } from '../src/world/world';
import { WaterFlow } from '../src/world/waterFlow';
import { History } from '../src/core/history';
import { isoToScreen } from '../src/core/iso';
import { ITEM_BY_ID, BRUSH_BY_ID, footprint } from '../src/world/catalog';
import { computeTime } from '../src/core/clock';
import { buildAtmosphere } from '../src/world/palette';
import { bridgePoint, drawBridge, drawPlankBridge } from '../src/render/sprites/bridges';
import { drawObject } from '../src/render/sprites';
import { setSkipShadows } from '../src/render/sprites/common';
import { cascadeRims, meetCascadeRims } from '../src/render/cascadeRims';
import { drawFalls } from '../src/render/water';
import { makeRng } from '../src/core/rng';

Object.assign(globalThis, {
  document: { createElement: () => createCanvas(8, 8) },
  window: { devicePixelRatio: 1, innerWidth: 1200, innerHeight: 820 },
});
Math.random = makeRng(419);
const atm = buildAtmosphere(computeTime(new Date(2026, 8, 19, 13).getTime()));
const canvas = createCanvas(500, 360),
  ctx = canvas.getContext('2d');
const dc = ctx as unknown as CanvasRenderingContext2D;
const digest = () =>
  createHash('sha256')
    .update(ctx.getImageData(0, 0, 500, 360).data)
    .digest('hex');
setSkipShadows(true);
for (const type of ['bridge', 'plank_bridge'])
  for (let rot = 0; rot < 4; rot++) {
    const plank = type === 'plank_bridge',
      item = ITEM_BY_ID.get(type)!;
    const f = footprint(item, rot),
      a = bridgePoint(rot, 0, 0, 0, plank),
      b = bridgePoint(rot, 1, 0, 0, plank);
    const axis = rot % 2 === 0 ? isoToScreen(f.w, 0) : isoToScreen(0, f.h);
    assert.deepEqual({ x: b.x - a.x, y: b.y - a.y }, axis, 'deck spans actual rotated footprint');
    for (let i = 0; i <= 20; i++) {
      const base = bridgePoint(rot, i / 20, 1, 0, plank),
        top = bridgePoint(rot, i / 20, 1, 19, plank);
      assert.equal(base.x, top.x);
      assert.ok(Math.abs(base.y - top.y - 19) < 1e-9);
    }
    const near = bridgePoint(rot, 0.5, 1, 0, plank),
      far = bridgePoint(rot, 0.5, -1, 0, plank);
    assert.ok(near.y - far.y > 17, 'deck has projected transverse width, not an edge-on strip');
    for (const seed of [1, 2, 17, 42, 777]) {
      const d = {
        ctx: dc,
        x: 250,
        y: 180,
        atm,
        g: 1,
        obj: { id: 1, type, tx: 0, ty: 0, planted: 0, rot, seed },
        time: 1000,
        wind: 0,
        alpha: 1,
      };
      ctx.clearRect(0, 0, 500, 360);
      (plank ? drawPlankBridge : drawBridge)(d);
      const direct = digest();
      ctx.clearRect(0, 0, 500, 360);
      drawObject(d);
      assert.equal(digest(), direct, 'seed must not mirror or shorten a placed bridge');
    }
  }
setSkipShadows(false);
console.log('ок: both bridge types, four rotations, five seeds, connected rails and full deck width');

function empty() {
  const w = new World();
  w.objects = [];
  for (const t of w.tiles) Object.assign(t, { ground: 'moss', level: 0, water: false, indoor: false, veranda: false });
  return w;
}
function legacyCascade(w: World, x0 = 9, y0 = 10) {
  // Deliberately the OLD diagonal grid layout: renderer must fix saved gardens too.
  for (let y = -1; y <= 3; y++)
    for (let x = -1; x <= 3; x++) {
      const t = w.at(x0 + x, y0 + y)!;
      t.level = 2 - Math.max(0, Math.min(2, Math.floor((x + y) / 2)));
      if (x >= 0 && y >= 0 && x < 3 && y < 3) {
        t.water = true;
        t.ground = 'water';
      } else t.ground = 'stone';
    }
  w.smoothTerrain();
}
const world = empty();
legacyCascade(world);
const flow = new WaterFlow();
flow.ensure(world);
const snapshot = JSON.stringify(world.toJSON());
const rims = cascadeRims(world, flow);
assert.ok(rims.length > 0);
assert.ok(
  rims.length < flow.falls.filter((f) => f.dx === 1 || f.dy === 1).length,
  'join adjacent X/Y faces rather than repeat per-cell curtains',
);
assert.equal(cascadeRims(world, flow), rims, 'reuse static rock geometry between animation frames');
for (const r of rims) {
  assert.ok(r.height > 0 && r.span > 0);
  const upper = meetCascadeRims(r.raw, r.topLevel, [r]);
  const lower = meetCascadeRims(
    r.raw.map((p) => ({ x: p.x, y: p.y + r.height })),
    r.bottomLevel,
    [r],
  );
  upper.forEach((p, i) =>
    assert.ok(Math.abs(lower[i].y - p.y - r.height) < 1e-8, 'upper and receiving pools meet the same rim'),
  );
  for (let i = 1; i < r.raw.length; i++) assert.ok(r.raw[i].x >= r.raw[i - 1].x, 'front edge is monotone in screen X');
  assert.ok(r.lip.length > 8);
  for (const p of r.lip) assert.ok(Number.isFinite(p.x) && Number.isFinite(p.y));
}
const p = isoToScreen(10.5, 11.5);
function renderFall(ms: number) {
  ctx.resetTransform();
  ctx.clearRect(0, 0, 500, 360);
  ctx.translate(250 - p.x, 175 - p.y);
  ctx.globalAlpha = 0.73;
  const alpha = ctx.globalAlpha,
    matrix = ctx.getTransform();
  drawFalls(dc, world, flow, atm, ms);
  assert.equal(ctx.globalAlpha, alpha);
  assert.deepEqual(ctx.getTransform(), matrix);
  return digest();
}
assert.equal(renderFall(900), renderFall(900));
assert.notEqual(renderFall(900), renderFall(2100), 'ribbons, droplets and broken eddies animate');
assert.equal(JSON.stringify(world.toJSON()), snapshot, 'rendering a legacy cascade must not edit the garden');
const loaded = empty();
loaded.applySave(JSON.parse(snapshot));
const loadedFlow = new WaterFlow();
loadedFlow.ensure(loaded);
assert.deepEqual(cascadeRims(loaded, loadedFlow), rims, 'save/load reproduces exact ledge geometry');
for (const t of world.tiles) t.level = 0;
flow.markDirty();
flow.ensure(world);
assert.deepEqual(cascadeRims(world, flow), [], 'flattening the waterfall invalidates the rim cache');
console.log(
  `ок: legacy cascade ${rims.length} connected rocky rims, deterministic animation, context, load and cache invalidation`,
);

for (const [x, y] of [
  [6, 7],
  [10, 10],
  [17, 16],
]) {
  const w = empty(),
    history = new History(w),
    before = JSON.stringify(w.tiles);
  history.begin('cascade');
  w.applyBrush(BRUSH_BY_ID.get('w_cascade')!, x, y);
  history.commit();
  const after = JSON.stringify(w.tiles);
  assert.notEqual(after, before);
  const f = new WaterFlow();
  f.ensure(w);
  assert.ok(f.falls.length > 0);
  assert.ok(w.tiles.filter((t) => t.water).length >= 5, 'connected channel retains navigable water');
  const wet = new Set(w.tiles.flatMap((t, i) => (t.water ? [`${i % w.size},${Math.floor(i / w.size)}`] : [])));
  const queue = [wet.values().next().value!];
  wet.delete(queue[0]);
  for (let i = 0; i < queue.length; i++) {
    const [cx, cy] = queue[i].split(',').map(Number);
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const key = `${cx + dx},${cy + dy}`;
      if (wet.delete(key)) queue.push(key);
    }
  }
  assert.equal(wet.size, 0, 'new cascade channel remains four-connected');

  history.undo();
  assert.equal(JSON.stringify(w.tiles), before);
  history.redo();
  assert.equal(JSON.stringify(w.tiles), after);
}
console.log('ок: new asymmetric cascade brush, undo and redo at three sites');

if (process.argv.includes('--preview')) {
  const { Scene } = await import('../src/render/scene');
  const w = empty();
  legacyCascade(w);
  for (let y = 13; y < 22; y++)
    for (let x = 11; x <= 12; x++) Object.assign(w.at(x, y)!, { water: true, ground: 'water', level: 0 });
  for (let y = 16; y <= 17; y++)
    for (let x = 5; x < 11; x++) Object.assign(w.at(x, y)!, { water: true, ground: 'water', level: 0 });
  w.objects = [
    { id: 1, type: 'bridge', tx: 11.5, ty: 13.5, rot: 0, planted: 0, seed: 42 },
    { id: 2, type: 'bridge', tx: 7.5, ty: 15.5, rot: 1, planted: 0, seed: 17 },
  ];
  for (const [name, width, height, zoom, cx, cy] of [
    ['preview-structures.png', 1200, 820, 1.45, 10.5, 14.3],
    ['preview-structures-mobile.png', 430, 760, 0.78, 10.7, 13.7],
    ['preview-cascade.png', 900, 660, 2.6, 10.5, 11.5],
    ['preview-cascade-new.png', 900, 660, 2.6, 10.5, 11.5],
  ] as const) {
    const c = createCanvas(width, height);
    Object.assign(c, { clientWidth: width, clientHeight: height });
    const scene = new Scene(c as unknown as HTMLCanvasElement);
    scene.camera.zoom = zoom;
    scene.centerOn(cx, cy);
    scene.particles = false;
    const fixture = name.includes('-new') ? empty() : w;
    if (fixture !== w) fixture.applyCascade(9, 10, 3, 3);
    scene.render(fixture, atm, 1800, 16);
    writeFileSync(name, c.toBuffer('image/png'));
  }
  console.log('wrote native Scene previews (legacy cascade + both bridge rotations)');
}
