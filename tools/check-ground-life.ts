/** Ecological decoration, universal night buds, cache correctness and real raster work. */
import assert from 'node:assert/strict';
import { createCanvas } from '@napi-rs/canvas';
import { writeFileSync } from 'node:fs';
import { World } from '../src/world/world';
import { History } from '../src/core/history';
import { makeRng } from '../src/core/rng';
import { computeTime } from '../src/core/clock';
import { buildAtmosphere } from '../src/world/palette';
import { isoToScreen, tileDiamond } from '../src/core/iso';
import { groundLifeField, groundDetailAlpha, groundEligible, drawGroundLife } from '../src/render/groundLife';
import { FLOWERING_TYPES, flowerOpenness, flowerCycleKey } from '../src/render/flowerCycle';
import { drawObject } from '../src/render/sprites';
import { clearSprites, drawCached, spriteStats, paintObjectLight } from '../src/render/spriteCache';
import { buildLocalLights, sampleLocalLight } from '../src/render/localLight';
import { waterSurfaces, waterSurfacePath } from '../src/render/waterSurface';
import { Scene } from '../src/render/scene';
Object.assign(globalThis, {
  document: { createElement: () => createCanvas(8, 8) },
  window: { devicePixelRatio: 1, innerWidth: 1200, innerHeight: 850 },
});
Math.random = makeRng(3281);
const day = buildAtmosphere(computeTime(new Date(2026, 3, 19, 12).getTime()));
const night = buildAtmosphere(computeTime(new Date(2026, 3, 19, 23).getTime()));
const autumn = buildAtmosphere(computeTime(new Date(2026, 10, 12, 12).getTime()));
const winter = buildAtmosphere(computeTime(new Date(2026, 0, 15, 12).getTime()));
const w = new World();
w.objects = [];
for (const t of w.tiles) Object.assign(t, { ground: 'moss', water: false, indoor: false, veranda: false, level: 0 });
for (let y = 8; y <= 12; y++) for (let x = 9; x <= 12; x++) w.at(x, y)!.water = true;
for (let x = 3; x < 20; x++) w.at(x, 5)!.ground = 'gravel';
for (let y = 3; y < 5; y++)
  for (let x = 14; x < 17; x++) Object.assign(w.at(x, y)!, { ground: 'tatami', indoor: true, level: 1 });
w.place('maple', 5.5, 7, 0);
w.place('pine', 7.5, 9, 0);
w.place('ginkgo', 13, 11, 0);
w.place('sakura', 13, 7, 0);
const planted = w.place('iris', 6, 12, 0)!;
const signature = () => JSON.stringify(groundLifeField(w).patches);
const initial = signature(),
  field = groundLifeField(w);
assert.equal(groundLifeField(w), field, 'unchanged world reuses its geometry, not a growing cache');
assert.ok(field.patches.length < worldArea(w) * 0.6, 'most ground is intentionally empty');
function worldArea(w: World) {
  return w.size * w.size;
}
const kinds = new Set(field.patches.map((p) => p.kind));
for (const type of ['needles', 'leaves', 'roots', 'flowers', 'mushrooms', 'grass', 'soil'])
  assert.ok(kinds.has(type as never), `${type} habitat fixture`);
for (const p of field.patches) {
  assert.ok(groundEligible(w.at(Math.floor(p.x), Math.floor(p.y))));
  if (p.kind === 'needles') assert.equal(p.treeType, 'pine');
  if (p.kind === 'leaves') assert.notEqual(p.treeType, 'pine');
  if (p.kind === 'mushrooms') assert.ok(p.shade > 0.28 && p.damp > 0.6);
  if (p.kind === 'flowers') assert.ok(p.shade < 0.22);
  assert.ok(Math.hypot(p.x - planted.tx - 0.5, p.y - planted.ty - 0.5) >= 0.6, 'player flowers keep breathing room');
}
const lamp = w.place('lantern_paper', 6, 12, 0)!;
assert.equal(signature(), initial, 'lamps cannot seed wild flowers');
w.removeObject(lamp);
assert.equal(signature(), initial);
const h = new History(w);
h.begin('tree move');
const tree = w.objects.find((o) => o.type === 'maple')!;
assert.ok(w.moveObject(tree, 20, 20, 0));
h.commit();
assert.notEqual(signature(), initial);
h.undo();
assert.equal(signature(), initial);
h.redo();
assert.notEqual(signature(), initial);
h.undo();
const reload = new World();
assert.ok(reload.fromJSON(structuredClone(w.toJSON())));
assert.deepEqual(groundLifeField(reload).patches, groundLifeField(w).patches);
const first = groundLifeField(w).patches[0],
  tile = w.at(Math.floor(first.x), Math.floor(first.y))!;
const old = { ...tile };
Object.assign(tile, { ground: 'deck', veranda: true });
assert.ok(
  !groundLifeField(w).patches.some(
    (p) => Math.floor(p.x) === Math.floor(first.x) && Math.floor(p.y) === Math.floor(first.y),
  ),
);
Object.assign(tile, old);
assert.equal(signature(), initial);
assert.equal(flowerOpenness(day), 1);
assert.equal(flowerOpenness(night), 0);
assert.equal(flowerOpenness({ ...night, exposure: 1.2, lampGlow: 1 }), 0);
assert.ok(
  flowerOpenness({ ...day, time: { ...day.time, daylight: 0.5 } }) > 0.1 &&
    flowerOpenness({ ...day, time: { ...day.time, daylight: 0.5 } }) < 0.9,
);
assert.equal(groundDetailAlpha('flowers', 0.55), 0);
assert.equal(groundDetailAlpha('mushrooms', 0.55), 0);
assert.ok(groundDetailAlpha('grass', 0.55) > 0);
assert.equal(groundDetailAlpha('grass', 0.3), 0);
const snapshot = JSON.stringify(w.toJSON());
const c = createCanvas(1200, 850),
  ctx = c.getContext('2d'),
  dc = ctx as unknown as CanvasRenderingContext2D;
const pixels = () => ctx.getImageData(0, 0, 1200, 850).data;
const reset = () => {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, 1200, 850);
};
// Keep the palette fixed, changing only the clock: this proves buds really fold, not merely darken.
const brightNight = { ...day, time: night.time };
for (const type of FLOWERING_TYPES) {
  clearSprites();
  reset();
  const obj = { id: 1, type, tx: 0, ty: 0, rot: 0, seed: 441, planted: 0 };
  const bloomDay = type === 'lotus' ? buildAtmosphere(computeTime(new Date(2026, 6, 15, 12).getTime())) : day;
  const bloomNight = { ...bloomDay, time: computeTime(new Date(new Date(bloomDay.time.now).setHours(23)).getTime()) };
  const d = { ctx: dc, x: 600, y: 420, atm: bloomDay, g: 1, obj, time: 1000, wind: 0, alpha: 1 };
  assert.notEqual(flowerCycleKey(type, day), flowerCycleKey(type, brightNight));
  drawCached(d);
  const opened = Buffer.from(pixels());
  reset();
  drawCached({ ...d, atm: bloomNight });
  assert.notDeepEqual(Buffer.from(pixels()), opened, `${type} folds with the same colours and exposure`);
  const n = spriteStats().size;
  reset();
  drawCached(d);
  assert.ok(Buffer.from(pixels()).equals(opened), `${type} reopens after a cached night`);
  assert.equal(spriteStats().size, n);
}
// Raster clipping against dry surfaces and the *curved* water contour (not only wet tiles).
reset();
ctx.translate(600, -110);
const view = { x: 0, y: 535, width: 1200, height: 850, zoom: 1 };
const matrix = ctx.getTransform(),
  alpha = ctx.globalAlpha;
drawGroundLife(dc, w, autumn, view);
assert.deepEqual(ctx.getTransform(), matrix);
assert.equal(ctx.globalAlpha, alpha);
const ground = Buffer.from(pixels());
reset();
ctx.translate(600, -110);
drawGroundLife(dc, w, day, view);
const wildOpen = Buffer.from(pixels());
reset();
ctx.translate(600, -110);
drawGroundLife(dc, w, brightNight, view);
assert.notDeepEqual(Buffer.from(pixels()), wildOpen, 'wild flower heads also close when only the clock changes');
assert.equal(signature(), initial, 'dusk does not respawn the ground communities');
reset();
ctx.translate(600, -110);
drawGroundLife(dc, w, autumn, view);

const mask = createCanvas(1200, 850),
  mc = mask.getContext('2d');
mc.translate(600, -110);
mc.beginPath();
for (let y = 0; y < w.size; y++)
  for (let x = 0; x < w.size; x++)
    if (groundEligible(w.at(x, y))) {
      const p = tileDiamond(x, y, w.at(x, y)!.level);
      p.forEach((q, i) => (i ? mc.lineTo(q.x, q.y) : mc.moveTo(q.x, q.y)));
      mc.closePath();
    }
mc.fill();
mc.globalCompositeOperation = 'destination-out';
for (const s of waterSurfaces(w)) {
  waterSurfacePath(mc as never, s);
  mc.fill('evenodd');
}
const allowed = mc.getImageData(0, 0, 1200, 850).data;
let painted = 0,
  leaks = 0;
for (let i = 3; i < ground.length; i += 4)
  if (ground[i] > 8) {
    painted++;
    if (allowed[i] < 4) leaks++;
  }
assert.ok(painted > 500);
assert.equal(leaks, 0, 'no detail on paths, floors, water, or outside the island');
reset();
assert.equal(drawGroundLife(dc, w, winter, view), 0);
assert.ok(!pixels().some(Boolean), 'winter snow remains undisturbed');
assert.equal(JSON.stringify(w.toJSON()), snapshot, 'rendering and the daily cycle never alter player plantings');
// Re-lit geometry obeys the same clock, even next to a bright lantern.
w.place('lantern_paper', 6, 12, 0);
const f = buildLocalLights(w, night, 1000),
  o = w.objects.find((o) => o.type === 'iris')!;
const xy = isoToScreen(o.tx + 0.5, o.ty + 0.5),
  d = { ctx: dc, x: xy.x, y: xy.y, atm: night, g: 1, obj: o, time: 1000, wind: 0, alpha: 1 };
reset();
ctx.translate(700, -200);
drawCached(d);
paintObjectLight(d, sampleLocalLight(f, o.tx + 0.5, o.ty + 0.5, 0, o.id));
const closedLit = Buffer.from(pixels());
reset();
ctx.translate(700, -200);
const awake = { ...night, time: day.time };
drawCached({ ...d, atm: awake });
paintObjectLight({ ...d, atm: awake }, sampleLocalLight(f, o.tx + 0.5, o.ty + 0.5, 0, o.id));
assert.notDeepEqual(Buffer.from(pixels()), closedLit);
if (process.argv.includes('--preview')) {
  // Seeded ecological garden, with the same planting in day/night/phone previews.
  for (const [name, atm, zoom, width, height] of [
    ['autumn', autumn, 1.35, 1200, 850],
    ['spring', day, 1.35, 1200, 850],
    ['night', night, 1.35, 1200, 850],
    ['phone', autumn, 0.46, 430, 800],
  ] as const) {
    const cv = createCanvas(width, height);
    Object.assign(cv, { clientWidth: width, clientHeight: height });
    const scene = new Scene(cv as never);
    scene.camera.zoom = zoom;
    scene.centerOn(10, 9);
    scene.particles = false;
    scene.render(w, atm, 1000, 16);
    writeFileSync(`preview-ground-${name}.png`, cv.toBuffer('image/png'));
  }
  // Identical daylight palette makes closed/open corollas readable at a glance.
  const cv = createCanvas(1200, 580),
    cx = cv.getContext('2d');
  cx.fillStyle = '#eee9da';
  cx.fillRect(0, 0, 1200, 580);
  cx.fillStyle = '#504f43';
  cx.font = '19px sans-serif';
  cx.fillText('День: раскрытые цветы', 24, 30);
  cx.fillText('Ночь: бутоны — цвет оставлен дневным для сравнения формы', 24, 325);
  const names = ['Ландыши', 'Ирисы', 'Лотос', 'Сакура', 'Азалия', 'Глициния', 'Камелия'];
  [...FLOWERING_TYPES].forEach((type, i) => {
    for (const [row, atm] of [day, brightNight].entries())
      drawObject({
        ctx: cx as never,
        x: 80 + i * 171,
        y: 245 + row * 285,
        atm,
        g: 1,
        obj: { id: i, type, tx: 0, ty: 0, rot: 0, seed: 441, planted: 0 },
        time: 1000,
        wind: 0,
        alpha: 1,
      });
    cx.fillStyle = '#504f43';
    cx.font = '15px sans-serif';
    cx.fillText(names[i], 35 + i * 171, 273);
  });
  writeFileSync('preview-ground-flower-cycle.png', cv.toBuffer('image/png'));
}
// Flush the actual pixels each frame; command-recording time alone hides expensive clip work.
for (const zoom of [1, 0.4]) {
  const start = performance.now();
  for (let i = 0; i < 20; i++) {
    reset();
    ctx.translate(600, 425);
    ctx.scale(zoom, zoom);
    ctx.translate(0, -700);
    drawGroundLife(dc, w, autumn, { x: 0, y: 700, width: 1200, height: 850, zoom });
    ctx.getImageData(0, 0, 1, 1);
  }
  const ms = (performance.now() - start) / 20;
  assert.ok(ms < 15, `ground raster budget ${zoom}: ${ms.toFixed(2)}ms`);
  console.log(`Ground layer at zoom ${zoom}: ${ms.toFixed(2)}ms native, including raster flush.`);
}
console.log(
  'ок: habitat placement, species litter, sparse density, player-plant exclusion, edits/undo/reload, day/night buds for all flowering types, lamp independence, cache reopening, surface clipping, LOD, winter and purity',
);

const dense = new World();
dense.objects = [];
for (const t of dense.tiles)
  Object.assign(t, { ground: 'moss', water: false, indoor: false, veranda: false, level: 0 });
for (let y = 1; y < 25; y++) for (let x = 1; x < 25; x++) dense.place('pine', x, y, 0);
const crowded = groundLifeField(dense);
assert.equal(crowded.patches.length, 400);
assert.ok(
  crowded.patches.some((p) => p.y < 4) && crowded.patches.some((p) => p.y > 22),
  'bounded detail remains distributed over the whole garden',
);
reset();
ctx.translate(600, 425);
ctx.scale(0.4, 0.4);
ctx.translate(0, -700);
drawGroundLife(dc, dense, autumn, { x: 0, y: 700, width: 1200, height: 850, zoom: 0.4 });
ctx.getImageData(0, 0, 1, 1);
assert.ok(crowded.paint!.images.size <= 400, 'stamp cache is bounded even in a fully planted forest');
console.log('ок: dense forest retains spatial coverage with at most 400 cached stamps');
