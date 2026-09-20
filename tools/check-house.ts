/** Furniture scale, roof topology, save compatibility and reproducible native-canvas previews. */
import assert from 'node:assert/strict';
import { createCanvas } from '@napi-rs/canvas';
import { createHash } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { World } from '../src/world/world';
import { History } from '../src/core/history';
import { FURNITURE_IDS, ITEM_BY_ID } from '../src/world/catalog';
import { applyPreset } from '../src/world/presets';
import { isoToScreen } from '../src/core/iso';
import { computeTime } from '../src/core/clock';
import { makeRng } from '../src/core/rng';
import { buildAtmosphere } from '../src/world/palette';
import { findHouse, houseRoofGeometry, drawHouseWalls, drawHouseRoof, drawHouseShade } from '../src/render/building';
import { drawObject, drawCost } from '../src/render/sprites';
import * as furniture from '../src/render/sprites/furniture';
import { cacheable, drawCached, spriteFrame, clearSprites } from '../src/render/spriteCache';
import { setSkipShadows } from '../src/render/sprites/common';
import { Scene } from '../src/render/scene';
import { Life } from '../src/world/life';
Object.assign(globalThis, {
  document: { createElement: () => createCanvas(8, 8) },
  window: { devicePixelRatio: 1, innerWidth: 1200, innerHeight: 850 },
});
Math.random = makeRng(733);
const day = buildAtmosphere(computeTime(new Date(2026, 8, 19, 13).getTime()));
const night = buildAtmosphere(computeTime(new Date(2026, 8, 19, 23).getTime()));
const cv = createCanvas(500, 400),
  ctx = cv.getContext('2d'),
  dc = ctx as unknown as CanvasRenderingContext2D;
const digest = () =>
  createHash('sha256')
    .update(ctx.getImageData(0, 0, 500, 400).data)
    .digest('hex');
const drawers = [
  furniture.drawTable,
  furniture.drawCushion,
  furniture.drawIrori,
  furniture.drawFuton,
  furniture.drawByobu,
  furniture.drawFusuma,
  furniture.drawShoji,
  furniture.drawTokonoma,
  furniture.drawBonsai,
  furniture.drawTansu,
  furniture.drawIndoorPlant,
  furniture.drawKotatsu,
  furniture.drawBookshelf,
  furniture.drawEngawaBench,
];
function bounds() {
  const data = ctx.getImageData(0, 0, 500, 400).data;
  let x0 = 500,
    x1 = 0,
    y0 = 400,
    y1 = 0;
  for (let y = 0; y < 400; y++)
    for (let x = 0; x < 500; x++)
      if (data[(y * 500 + x) * 4 + 3] > 8) {
        x0 = Math.min(x, x0);
        x1 = Math.max(x, x1);
        y0 = Math.min(y, y0);
        y1 = Math.max(y, y1);
      }
  return { x0, x1, y0, y1 };
}
setSkipShadows(true);
for (const [i, type] of [...FURNITURE_IDS].entries())
  for (let rot = 0; rot < 4; rot++)
    for (const seed of [1, 17, 42]) {
      setSkipShadows(true);
      const obj = { id: 1, type, tx: 0, ty: 0, rot, seed, planted: 0 };
      const d = { ctx: dc, x: 250, y: 220, atm: day, g: 1, obj, time: 1200, wind: 0.3, alpha: 1 };
      ctx.clearRect(0, 0, 500, 400);
      drawers[i](d);
      const direct = digest();
      ctx.clearRect(0, 0, 500, 400);
      drawObject(d);
      assert.equal(digest(), direct, `${type} must not randomly mirror/resize`);
      const b = bounds();
      assert.ok(b.x0 > 150 && b.x1 < 350 && b.y0 > 105 && b.y1 < 275, `${type} bounded at every rotation`);
      if (type === 'table') assert.ok(b.x1 - b.x0 >= 88, 'tea table fills most of its tile');
      if (type === 'cushion') assert.ok(b.x1 - b.x0 >= 55, 'cushion has a legible square footprint');
      const before = ctx.getTransform();
      drawObject({ ...d, alpha: 0.45 });
      assert.deepEqual(ctx.getTransform(), before, 'drawing preserves transform');
      assert.equal(ctx.globalAlpha, 1);
      if (cacheable(type, drawCost(type))) {
        ctx.clearRect(0, 0, 500, 400);
        spriteFrame();
        assert.ok(drawCached(d));
        const cached = bounds();
        assert.ok(
          Math.abs(cached.x0 - b.x0) < 3 && Math.abs(cached.x1 - b.x1) < 3 && Math.abs(cached.y0 - b.y0) < 3,
          `${type} cache does not crop furniture`,
        );
      }
    }
setSkipShadows(false);
clearSprites();
for (let rot = 0; rot < 4; rot++) {
  const a = furniture.furniturePoint(rot, 0, 0),
    b = furniture.furniturePoint(rot, 1, 0);
  const axis =
    rot === 0 ? isoToScreen(1, 0) : rot === 1 ? isoToScreen(0, 1) : rot === 2 ? isoToScreen(-1, 0) : isoToScreen(0, -1);
  assert.deepEqual({ x: b.x - a.x, y: b.y - a.y }, axis);
  const top = furniture.furniturePoint(rot, 0.3, 0.2, 55),
    base = furniture.furniturePoint(rot, 0.3, 0.2);
  assert.equal(top.x, base.x);
  assert.equal(base.y - top.y, 55, 'height is never rotated into the floor');
}
console.log('ок: 14 furnishings × 4 rotations × 3 seeds; footprint, height, alpha, transform and cache bounds');
for (const [w, h] of [
  [1, 1],
  [3, 3],
  [7, 6],
  [4, 9],
  [26, 26],
]) {
  const g = houseRoofGeometry({ x0: 0, y0: 0, x1: w - 1, y1: h - 1, level: 1 });
  assert.equal(g.faces.length, 4);
  // Every hip connects the same eave corner and ridge endpoint on its two adjoining slopes.
  for (let i = 0; i < 4; i++) {
    assert.deepEqual(g.faces[i].r1, g.faces[(i + 1) % 4].r0);
    assert.deepEqual(g.faces[i].e1, g.faces[(i + 1) % 4].e0);
  }
  assert.ok([g.a, g.b, ...g.corners].every((p) => Number.isFinite(p.x) && Number.isFinite(p.y)));
  assert.ok(Math.abs(g.b.x - g.a.x) > 0, 'ridge is not a collapsed screen-vertical diagonal');
}
const world = new World();
for (const type of ['tansu', 'indoor_plant', 'tokonoma', 'irori', 'byobu', 'futon']) {
  assert.ok(
    world.objects.some((o) => o.type === type),
    `${type} furnished in new starter`,
  );
  assert.ok(world.unlocked.has(type));
}
const legacy = world.toJSON();
legacy.objects = legacy.objects.filter((o) => ['table', 'cushion', 'cat'].includes(o.type));
legacy.unlocked = ['table'];
const loaded = new World();
assert.ok(loaded.fromJSON(legacy));
assert.deepEqual(loaded.objects, legacy.objects, 'existing sparse rooms are NEVER refurnished');
assert.deepEqual(loaded.tiles, legacy.tiles);
assert.ok(loaded.unlocked.has('tansu') && loaded.unlocked.has('byobu'));
for (const id of ['tea', 'spring', 'path']) {
  const w = new World();
  applyPreset(w, id);
  for (const o of w.objects.filter((o) => FURNITURE_IDS.has(o.type)))
    assert.ok(w.canPlace(o.type, o.tx, o.ty, o.rot), `${id}/${o.type} legal placement`);
}
const history = new History(loaded);
history.begin('new cabinet');
const cabinet = loaded.place('tansu', 7, 3, 1)!;
history.commit();
history.undo();
assert.ok(!loaded.objects.some((o) => o.id === cabinet.id));
history.redo();
assert.ok(loaded.objects.some((o) => o.id === cabinet.id));
const saved = loaded.toJSON(),
  roundtrip = new World();
assert.ok(roundtrip.fromJSON(saved));
assert.deepEqual(roundtrip.objects, saved.objects);
for (const type of FURNITURE_IDS) {
  assert.ok(ITEM_BY_ID.has(type));
  for (let rot = 0; rot < 4; rot++) {
    assert.ok(world.canPlace(type, 4, 4, rot));
    assert.ok(!world.canPlace(type, 26, 26, rot));
  }
}
const state = JSON.stringify(world.toJSON());
for (const lighting of [day, night])
  for (const fn of [drawHouseWalls, drawHouseRoof, drawHouseShade]) {
    ctx.clearRect(0, 0, 500, 400);
    ctx.save();
    ctx.translate(100, -100);
    ctx.globalAlpha = 0.65;
    const alpha = ctx.globalAlpha,
      transform = ctx.getTransform();
    fn(dc, world, lighting, 1);
    assert.equal(ctx.globalAlpha, alpha);
    assert.deepEqual(ctx.getTransform(), transform);
    ctx.restore();
  }
assert.equal(JSON.stringify(world.toJSON()), state, 'renderer is pure');
// Cache must be invalidated when a floor/veranda is edited, then return to the identical roof on undo.
ctx.clearRect(0, 0, 500, 400);
drawHouseRoof(dc, world, day, 1000);
const first = digest();
world.setGround(10, 8, 'tatami');
ctx.clearRect(0, 0, 500, 400);
drawHouseRoof(dc, world, day, 1000);
assert.notEqual(digest(), first);
world.fromJSON(JSON.parse(state));
ctx.clearRect(0, 0, 500, 400);
drawHouseRoof(dc, world, day, 1000);
assert.equal(digest(), first);
ctx.clearRect(0, 0, 500, 400);
drawHouseShade(dc, world, day, 0);
assert.equal(bounds().x0, 500, 'cutaway removes the roof shade entirely');
const floor = isoToScreen(6.5, 5.5, world.at(6, 5)!.level);
drawHouseShade(dc, world, day, 1);
assert.ok(ctx.getImageData(floor.x, floor.y, 1, 1).data[3] > 0, 'covered floor receives shade');
world.setGround(6, 5, 'moss');
ctx.clearRect(0, 0, 500, 400);
drawHouseShade(dc, world, day, 1);
assert.equal(ctx.getImageData(floor.x, floor.y, 1, 1).data[3], 0, 'shade does not fill an edited hole in the floor');
world.fromJSON(JSON.parse(state));
console.log(
  'ок: coherent roof topology; legal placement, undo/redo, old saves, render purity, shade clipping and cache invalidation',
);
if (process.argv.includes('--preview')) {
  const life = new Life();
  life.sync(world);
  for (const [name, width, height, zoom, roof, lighting] of [
    ['interior-day', 1200, 850, 1.15, false, day],
    ['roof-day', 1200, 850, 1.05, true, day],
    ['interior-night', 1200, 850, 1.15, false, night],
    ['roof-night', 1200, 850, 1.05, true, night],
    ['interior-phone', 430, 800, 0.46, false, day],
    ['roof-phone', 430, 800, 0.46, true, day],
  ] as const) {
    const c = createCanvas(width, height);
    Object.assign(c, { clientWidth: width, clientHeight: height });
    const scene = new Scene(c as unknown as HTMLCanvasElement);
    scene.camera.zoom = zoom;
    scene.centerOn(6.4, 5.5);
    scene.roofVisible = roof;
    scene.snapRoof();
    scene.particles = false;
    scene.render(world, lighting, 1400, 16, life);
    writeFileSync(`preview-house-${name}.png`, c.toBuffer('image/png'));
  }
  // Individual rotatable furniture remains visible independent of scene occlusion.
  const c = createCanvas(1200, Math.ceil(FURNITURE_IDS.size / 6) * 320 + 60),
    cx = c.getContext('2d');
  cx.fillStyle = '#ede7d6';
  cx.fillRect(0, 0, c.width, c.height);
  [...FURNITURE_IDS].forEach((type, i) => {
    const x = 105 + (i % 6) * 195,
      y = 200 + Math.floor(i / 6) * 320;
    cx.save();
    cx.translate(x, y);
    cx.scale(1.8, 1.8);
    drawObject({
      ctx: cx as never,
      x: 0,
      y: 0,
      atm: day,
      g: 1,
      obj: { id: i, type, seed: 17, rot: 0, tx: 0, ty: 0, planted: 0 },
      time: 1000,
      wind: 0,
      alpha: 1,
    });
    cx.restore();
    cx.fillStyle = '#534538';
    cx.font = '16px sans-serif';
    cx.fillText(ITEM_BY_ID.get(type)!.name, x - 68, y + 80);
  });
  writeFileSync('preview-house-furniture.png', c.toBuffer('image/png'));
}
const h = findHouse(world);
assert.ok(h);
const start = performance.now();
for (let i = 0; i < 120; i++) drawHouseRoof(dc, world, day, i * 16);
console.log(`Roof hot-cache native mean: ${((performance.now() - start) / 120).toFixed(2)} ms`);
