/** Local light locality, material masks, occlusion, edit responsiveness, roof coverage and bounded work. */
import assert from 'node:assert/strict';
import { createCanvas } from '@napi-rs/canvas';
import { writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { World } from '../src/world/world';
import { History } from '../src/core/history';
import { computeTime } from '../src/core/clock';
import { buildAtmosphere } from '../src/world/palette';
import {
  buildLocalLights,
  sampleLocalLight,
  lightVisible,
  drawLocalSurfaceLight,
  drawLocalWallLight,
} from '../src/render/localLight';
import { drawCached, paintObjectLight, clearSprites, spriteStats } from '../src/render/spriteCache';
import { waterSurfaces, waterSurfacePath } from '../src/render/waterSurface';
import { drawObject } from '../src/render/sprites';
import { ITEM_BY_ID } from '../src/world/catalog';
import { Scene } from '../src/render/scene';
import { isoToScreen } from '../src/core/iso';
import { findHouse, houseRoofGeometry } from '../src/render/building';
import { makeRng } from '../src/core/rng';
Object.assign(globalThis, {
  document: { createElement: () => createCanvas(8, 8) },
  window: { devicePixelRatio: 1, innerWidth: 1200, innerHeight: 850 },
});
Math.random = makeRng(786);
const night = buildAtmosphere(computeTime(new Date(2026, 8, 19, 23).getTime()));
const day = buildAtmosphere(computeTime(new Date(2026, 8, 19, 13).getTime()));
const dusk = buildAtmosphere(computeTime(new Date(2026, 8, 19, 19).getTime()));
const w = new World();
w.objects = [];
for (const t of w.tiles) Object.assign(t, { ground: 'moss', water: false, indoor: false, veranda: false, level: 0 });
const lamp = w.place('lantern_paper', 5, 5)!;
let field = buildLocalLights(w, night, 1000);
assert.equal(field.lights.length, 1);
assert.equal(buildLocalLights(w, day, 1000).lights.length, 0);
assert.ok(sampleLocalLight(field, 6, 5.5, 0)[0].strength > sampleLocalLight(field, 7.5, 5.5, 0)[0].strength);
assert.equal(sampleLocalLight(field, 12, 12, 0).length, 0);
assert.equal(sampleLocalLight(field, 6, 5.5, 2).length, 0);
const history = new History(w);
history.begin('move lamp');
w.moveObject(lamp, 10, 10, 0);
history.commit();
field = buildLocalLights(w, night, 1000);
assert.equal(sampleLocalLight(field, 5.5, 5.5, 0).length, 0);
history.undo();
field = buildLocalLights(w, night, 1000);
assert.ok(sampleLocalLight(field, 6, 5.5, 0).length);
assert.equal(
  buildLocalLights(w, night, 1000, undefined, lamp.id).lights.length,
  0,
  'moving ghost leaves no stationary light behind',
);
for (let y = 4; y <= 8; y++) for (let x = 4; x <= 8; x++) w.at(x, y)!.indoor = true;
field = buildLocalLights(w, night, 1000);
const source = field.lights.find((l) => l.id === lamp.id)!;
assert.ok(!lightVisible(field, source, 5.5, 3.5, 0), 'north wall blocks escape');
assert.ok(!lightVisible(field, source, 3.5, 5.5, 0), 'west wall blocks escape');
assert.ok(lightVisible(field, source, 9.5, 5.5, 0), 'open veranda does not act as an opaque wall');
const screen = w.place('byobu', 6, 5, 1)!;
field = buildLocalLights(w, night, 1000);
assert.ok(!lightVisible(field, source, 7.5, 5.5, 0), 'partition blocks light');
w.objects = w.objects.filter((o) => o.id !== screen.id);
for (const t of w.tiles) t.indoor = false;
field = buildLocalLights(w, night, 1000);
const canvas = createCanvas(500, 380),
  ctx = canvas.getContext('2d'),
  dc = ctx as unknown as CanvasRenderingContext2D;
const digest = () =>
  createHash('sha256')
    .update(ctx.getImageData(0, 0, 500, 380).data)
    .digest('hex');
const plant = w.place('indoor_plant', 5.5, 5, 0)!;
const point = isoToScreen(6, 5.5),
  d = { ctx: dc, x: point.x, y: point.y, atm: night, g: 1, obj: plant, time: 1000, wind: 0, alpha: 1 };
// Position the world canvas so the actual world-space light and sprite are in the same coordinate frame.
ctx.translate(220, -100);
drawCached(d);
const before = ctx.getImageData(0, 0, 500, 380).data,
  base = digest();
paintObjectLight(d, sampleLocalLight(field, 6, 5.5, 0, plant.id));
const after = ctx.getImageData(0, 0, 500, 380).data;
let gain = 0;
for (let i = 0; i < before.length; i += 4) {
  if (before[i + 3] === 0) assert.equal(after[i + 3], 0, 'lighting is masked to the painted sprite, not empty air');
  gain += after[i] + after[i + 1] + after[i + 2] - before[i] - before[i + 1] - before[i + 2];
}
assert.ok(gain > 1000, 'nearby foliage actually catches light');
ctx.clearRect(-220, 100, 500, 380);
drawCached(d);
assert.equal(digest(), base, 'warm overlay never pollutes the base cache');
paintObjectLight(d, sampleLocalLight(field, 6, 5.5, 0, plant.id));
const size = spriteStats().size;
for (let i = 0; i < 25; i++) {
  const f = buildLocalLights(w, night, 1000 + i * 16);
  paintObjectLight({ ...d, time: 1000 + i * 16 }, sampleLocalLight(f, 6, 5.5, 0, plant.id));
}
assert.equal(spriteStats().size, size, 'flicker creates no new sprite variants');
const state = JSON.stringify(w.toJSON()),
  matrix = ctx.getTransform();
ctx.globalAlpha = 0.6;
const alpha = ctx.globalAlpha;
drawLocalSurfaceLight(dc, field, 1000);
drawLocalWallLight(dc, field);
assert.equal(ctx.globalAlpha, alpha);
assert.deepEqual(ctx.getTransform(), matrix);
assert.equal(JSON.stringify(w.toJSON()), state);
ctx.globalAlpha = 1;
for (const type of ['ginkgo', 'bookshelf', 'table']) {
  const obj = w.place(type, 5.5, 5, 0)!,
    material = { ...d, obj };
  ctx.clearRect(-220, 100, 500, 380);
  const live = type === 'table';
  if (live) drawObject(material);
  else drawCached(material);
  const pixels = ctx.getImageData(0, 0, 500, 380).data;
  paintObjectLight(material, sampleLocalLight(field, 6, 5.5, 0, obj.id), !live);
  const painted = ctx.getImageData(0, 0, 500, 380).data;
  let changed = 0;
  for (let i = 0; i < pixels.length; i += 4) {
    if (!pixels[i + 3]) assert.equal(painted[i + 3], 0, `${type}: no light outside actual silhouette`);
    if (pixels[i] !== painted[i]) changed++;
  }
  assert.ok(changed > 20, `${type} is visibly re-lit`);
}
const reloaded = new World();
assert.ok(reloaded.fromJSON(structuredClone(w.toJSON())));
const signature = (f: ReturnType<typeof buildLocalLights>) =>
  f.lights.map((l) => [l.id, l.x, l.y, l.level, l.radius, l.power]);
assert.deepEqual(
  signature(buildLocalLights(reloaded, night, 1000)),
  signature(buildLocalLights(w, night, 1000)),
  'save/reload needs no new light state',
);
for (const type of ['lantern_stone', 'lantern_paper', 'lantern_path', 'brazier', 'irori', 'tea_house', 'tiny_house']) {
  for (let rot = 0; rot < 4; rot++) {
    const model = new World();
    model.objects = [];
    for (const t of model.tiles) Object.assign(t, { water: false, indoor: false, level: 0 });
    const o = model.place(type, 10, 10, rot)!,
      f = buildLocalLights(model, night, 1000);
    assert.equal(f.lights.length, type.endsWith('house') ? 2 : 1, `${type}/${rot} emissive faces`);
    const item = ITEM_BY_ID.get(type)!,
      cx = o.tx + item.w / 2,
      cy = o.ty + item.h / 2;
    if (type.endsWith('house'))
      for (const l of f.lights) {
        assert.ok(l.x - cx + l.y - cy > 0, 'window remains on a visible rotated face');
        assert.ok(!lightVisible(f, l, cx, cy, 0), 'window does not spill through its own closed building');
      }
  }
}
// A shoreline next to a raised terrace: only actual water can catch this low light.
const pond = new World();
pond.objects = [];
for (const t of pond.tiles) Object.assign(t, { water: false, indoor: false, veranda: false, ground: 'moss', level: 2 });
for (let y = 4; y <= 9; y++) for (let x = 4; x <= 9; x++) Object.assign(pond.at(x, y)!, { water: true, level: 0 });
pond.place('lantern_stone', 4, 6, 0);
const wc = createCanvas(900, 650),
  cc = wc.getContext('2d'),
  mask = createCanvas(900, 650),
  mc = mask.getContext('2d');
cc.translate(400, -70);
mc.translate(400, -70);
for (const s of waterSurfaces(pond)) {
  waterSurfacePath(mc as never, s);
  mc.fill('evenodd');
}
drawLocalSurfaceLight(cc as never, buildLocalLights(pond, night, 1000), 1000);
const water = mc.getImageData(0, 0, 900, 650).data,
  lit = cc.getImageData(0, 0, 900, 650).data;
let wetPixels = 0;
for (let i = 3; i < lit.length; i += 4)
  if (lit[i]) {
    wetPixels++;
    assert.ok(water[i] > 0, 'pool and shimmer stay inside the organic water contour');
  }
assert.ok(wetPixels > 100, 'the water actually receives light');
const still = wc.toBuffer('image/png');
cc.clearRect(-400, 70, 900, 650);
drawLocalSurfaceLight(cc as never, buildLocalLights(pond, night, 1700), 1700);
assert.notDeepEqual(wc.toBuffer('image/png'), still, 'water shimmer is alive');
w.objects = [];
assert.equal(buildLocalLights(w, night, 1000).lights.length, 0, 'removing source removes all illumination immediately');
for (let i = 0; i < 100; i++) w.place('lantern_path', i % 20, Math.floor(i / 20));
field = buildLocalLights(w, night, 1000);
assert.equal(field.lights.length, 48);
assert.ok(sampleLocalLight(field, 5, 3, 0).length <= 2, 'stacked lights have bounded accumulation');
const garden = new World();
garden.place('lantern_paper', 6.5, 5, 0);
function render(roof: boolean, lit: boolean, atm = night, width = 1200, height = 850, zoom = 1.08, x = 6.4, y = 5.5) {
  const c = createCanvas(width, height);
  Object.assign(c, { clientWidth: width, clientHeight: height });
  const s = new Scene(c as never);
  s.camera.zoom = zoom;
  s.centerOn(x, y);
  s.roofVisible = roof;
  s.snapRoof();
  s.particles = false;
  s.localLighting = lit;
  s.render(garden, atm, 1000, 16);
  return { c, s };
}
const off = render(true, false),
  on = render(true, true);
const g = houseRoofGeometry(findHouse(garden)!);
const f = g.faces[2],
  q = { x: (f.r0.x + f.r1.x + f.e0.x + f.e1.x) / 4, y: (f.r0.y + f.r1.y + f.e0.y + f.e1.y) / 4 };
const sp = on.s.worldToScreen(q.x, q.y);
assert.deepEqual(
  on.c.getContext('2d').getImageData(Math.round(sp.x), Math.round(sp.y), 3, 3).data,
  off.c.getContext('2d').getImageData(Math.round(sp.x), Math.round(sp.y), 3, 3).data,
  'interior light never paints through the opaque roof',
);
if (process.argv.includes('--preview'))
  for (const [name, roof, lit, atm, width, height, zoom, x, y] of [
    ['room-before', false, false, night, 1200, 850, 1.08, 6.4, 5.5],
    ['room', false, true, night, 1200, 850, 1.08, 6.4, 5.5],
    ['roof', true, true, night, 1200, 850, 1.05, 6.4, 5.5],
    ['dusk', false, true, dusk, 1200, 850, 1.08, 6.4, 5.5],
    ['pond', true, true, night, 1200, 850, 1.2, 15, 12],
    ['phone', false, true, night, 430, 800, 0.46, 6.4, 5.5],
  ] as const) {
    const { c } = render(roof, lit, atm, width, height, zoom, x, y);
    writeFileSync(`preview-light-${name}.png`, c.toBuffer('image/png'));
  }
clearSprites();
const start = performance.now();
for (let i = 0; i < 40; i++) {
  const f = buildLocalLights(garden, night, i * 16);
  drawLocalSurfaceLight(dc, f, i * 16);
  drawLocalWallLight(dc, f);
}
const ms = (performance.now() - start) / 40;
assert.ok(ms < 12, `local surface lighting budget: ${ms.toFixed(2)} ms`);
console.log(
  `ок: local falloff, daylight, move/undo/remove, wall/divider/elevation occlusion, masked material relighting, cache stability, roof cover; local surfaces ${ms.toFixed(2)} ms native`,
);

// Paired native benchmark includes object masks, not just the lighting field. Not a phone FPS claim.
const timed = render(false, false);
function bench(lit: boolean) {
  timed.s.localLighting = lit;
  for (let i = 0; i < 4; i++) timed.s.render(garden, night, 1000 + i * 16, 16);
  const start = performance.now();
  for (let i = 0; i < 24; i++) timed.s.render(garden, night, 2000 + i * 16, 16);
  return (performance.now() - start) / 24;
}
const baseline = bench(false),
  illuminated = bench(true);
assert.ok(illuminated - baseline < 12, `full-scene local light overhead ${(illuminated - baseline).toFixed(2)}ms`);
console.log(
  `Native full scene: unlit ${baseline.toFixed(2)}ms → local lighting ${illuminated.toFixed(2)}ms; includes sprites, not physical-device FPS.`,
);
