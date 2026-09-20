/** Regressions from phone screenshots: starter pine, shelf, dormant plants, shoreline ice and icicles. */
import assert from 'node:assert/strict';
import { createCanvas } from '@napi-rs/canvas';
import { writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { World } from '../src/world/world';
import { buildAtmosphere } from '../src/world/palette';
import { computeTime, DAY_MS } from '../src/core/clock';
import { prepareWaterSurface, waterSurfacePath } from '../src/render/waterSurface';
import { drawWinterIce, pondIceState, iceEligible } from '../src/render/winterIce';
import { WaterFlow } from '../src/world/waterFlow';
import { roofSnow, iciclesPresent, paintIcicles } from '../src/render/roofSnow';
import { drawObject } from '../src/render/sprites';
import { drawCached, clearSprites } from '../src/render/spriteCache';
import { setSkipShadows } from '../src/render/sprites/common';
import { Scene } from '../src/render/scene';
import { makeRng } from '../src/core/rng';
Object.assign(globalThis, {
  document: { createElement: () => createCanvas(8, 8) },
  window: { devicePixelRatio: 1, innerWidth: 1200, innerHeight: 850 },
});
Math.random = makeRng(534);
const winter = buildAtmosphere(computeTime(new Date(2026, 11, 19, 13).getTime()));
const summer = buildAtmosphere(computeTime(new Date(2026, 5, 19, 13).getTime()));
const w = new World(),
  pine = w.objects.find((o) => o.type === 'pine' && o.tx === 1 && o.ty === 8.5)!;
assert.ok(pine);
assert.ok(w.canPlace('pine', 1, 8.5));
assert.ok(!w.canPlace('pine', 4, 4));
assert.ok(!w.canPlace('pine', 10, 5));
assert.ok(w.canPlace('bonsai', 4, 4));
const save = structuredClone(w.toJSON()),
  oldPine = save.objects.find((o) => o.id === pine.id)!;
oldPine.tx = 3.5;
const legacy = new World();
assert.ok(legacy.fromJSON(save));
const repaired = legacy.objects.find((o) => o.id === pine.id)!;
assert.deepEqual(repaired, { ...oldPine, tx: 1 }, 'only known starter pine is moved; id/age/seed/rotation survive');
save.objects = save.objects.filter((o) => o.type !== 'torii');
const custom = new World();
custom.fromJSON(save);
assert.equal(custom.objects.find((o) => o.id === pine.id)!.tx, 3.5, 'do not silently move arbitrary user plantings');
const cv = createCanvas(900, 650),
  ctx = cv.getContext('2d'),
  dc = ctx as unknown as CanvasRenderingContext2D;
const digest = () =>
  createHash('sha256')
    .update(ctx.getImageData(0, 0, 900, 650).data)
    .digest('hex');
for (const type of ['lotus', 'lilypad']) {
  const d = {
    ctx: dc,
    x: 450,
    y: 320,
    atm: winter,
    g: 1,
    obj: { id: 1, type, seed: 17, rot: 0, tx: 0, ty: 0, planted: 0 },
    time: 1000,
    wind: 0,
    alpha: 1,
  };
  ctx.clearRect(0, 0, 900, 650);
  drawObject(d);
  const dormant = digest();
  ctx.clearRect(0, 0, 900, 650);
  drawObject({ ...d, atm: summer });
  assert.notEqual(digest(), dormant);
  ctx.clearRect(0, 0, 900, 650);
  drawCached({ ...d, atm: summer });
  ctx.clearRect(0, 0, 900, 650);
  drawCached(d);
  const hot = digest();
  clearSprites();
  ctx.clearRect(0, 0, 900, 650);
  drawCached(d);
  assert.equal(digest(), hot, 'winter cache cannot retain summer flowers');
}
const flow = new WaterFlow();
flow.ensure(w);
const surfaces = prepareWaterSurface(w),
  surface = surfaces.find((s) => s.cells.length > 10)!;
assert.ok(iceEligible(w, flow, surface));
const variants = Array.from({ length: 45 }, (_, i) => ({
  ...winter,
  time: { ...winter.time, now: winter.time.now + i * 3 * DAY_MS },
}));
const iceAt = variants.find((a) => pondIceState(a, surface).amount > 0.7)!,
  clearAt = variants.find((a) => pondIceState(a, surface).amount === 0)!;
assert.ok(iceAt && clearAt);
const iceNext = pondIceState({ ...iceAt, time: { ...iceAt.time, now: iceAt.time.now + 1000 } }, surface);
assert.equal(iceNext.seed, pondIceState(iceAt, surface).seed);
assert.ok(Math.abs(iceNext.amount - pondIceState(iceAt, surface).amount) < 1e-5);
ctx.clearRect(0, 0, 900, 650);
ctx.save();
ctx.translate(360, -470);
drawWinterIce(dc, w, iceAt, flow);
ctx.restore();
const iced = digest();
const pixels = ctx.getImageData(0, 0, 900, 650).data;
const mask = createCanvas(900, 650),
  mc = mask.getContext('2d');
mc.translate(360, -470);
for (const s of surfaces) {
  waterSurfacePath(mc as never, s);
  mc.fill();
}
const alpha = mc.getImageData(0, 0, 900, 650).data;
let ink = 0;
for (let i = 3; i < pixels.length; i += 4)
  if (pixels[i] > 8) {
    ink++;
    assert.ok(alpha[i] > 0, 'ice is clipped to water, not square tiles or land');
  }
assert.ok(ink > 100, 'selected winter pond has visible shore ice');
ctx.clearRect(0, 0, 900, 650);
ctx.save();
ctx.translate(360, -470);
drawWinterIce(dc, w, iceAt, flow);
ctx.restore();
assert.equal(digest(), iced, 'ice is still, not random per frame');
for (const a of [summer, clearAt]) {
  ctx.clearRect(0, 0, 900, 650);
  ctx.save();
  ctx.translate(360, -470);
  drawWinterIce(dc, w, a, flow);
  ctx.restore();
  assert.equal(
    ctx.getImageData(0, 0, 900, 650).data.some((v) => v !== 0),
    false,
  );
}
flow.cells[w.idx(surface.cells[0].x, surface.cells[0].y)]!.speed = 0.5;
assert.ok(!iceEligible(w, flow, surface), 'flowing reaches never freeze over');
flow.cells[w.idx(surface.cells[0].x, surface.cells[0].y)]!.speed = 0;
const snowStates = Array.from({ length: 80 }, (_, seed) => roofSnow(winter, seed));
assert.ok(snowStates.some(iciclesPresent) && snowStates.some((s) => s.amount && !iciclesPresent(s)));
const snow = snowStates.find(iciclesPresent)!;
ctx.clearRect(0, 0, 900, 650);
paintIcicles(dc, summer, snow, [
  { x: 20, y: 20 },
  { x: 40, y: 20 },
  { x: 60, y: 20 },
]);
assert.equal(
  ctx.getImageData(0, 0, 900, 650).data.some((v) => v !== 0),
  false,
);
console.log(
  'ок: narrow legacy pine repair, tree placement, dormant lotus/lilypad caches, rare clipped still-water ice, seasonal icicles',
);
if (process.argv.includes('--preview')) {
  for (const [name, a, width, height, zoom, x, y, roof] of [
    ['pond', iceAt, 1200, 850, 1.55, 16, 14, false],
    ['phone', iceAt, 430, 800, 0.48, 13, 11, true],
    ['interior', summer, 1200, 850, 1.15, 6.4, 5.5, false],
    ['night', buildAtmosphere(computeTime(iceAt.time.now + 10 * 3600000)), 1200, 850, 1.05, 6.4, 5.5, true],
  ] as const) {
    const c = createCanvas(width, height);
    Object.assign(c, { clientWidth: width, clientHeight: height });
    const scene = new Scene(c as never);
    scene.camera.zoom = zoom;
    scene.centerOn(x, y);
    scene.roofVisible = roof;
    scene.snapRoof();
    scene.particles = false;
    scene.render(w, a, 1000, 16);
    writeFileSync(`preview-fixes-${name}.png`, c.toBuffer('image/png'));
  }
  const c = createCanvas(980, 460),
    cx = c.getContext('2d');
  cx.fillStyle = '#e8e3d5';
  cx.fillRect(0, 0, 980, 460);
  setSkipShadows(true);
  for (let rot = 0; rot < 4; rot++) {
    cx.save();
    cx.translate(120 + rot * 245, 330);
    cx.scale(2.5, 2.5);
    drawObject({
      ctx: cx as never,
      x: 0,
      y: 0,
      atm: summer,
      g: 1,
      obj: { id: 1, type: 'bookshelf', seed: 17, rot, tx: 0, ty: 0, planted: 0 },
      time: 0,
      wind: 0,
      alpha: 1,
    });
    cx.restore();
  }
  setSkipShadows(false);
  writeFileSync('preview-fixes-bookshelf.png', c.toBuffer('image/png'));
}
