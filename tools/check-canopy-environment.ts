/** Stage three: shared annual shade/drying, actual reflected anatomy and bounded hot paths. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { setImmediate as yieldNative } from 'node:timers/promises';
import { createCanvas } from '@napi-rs/canvas';
import { computeTime, DAY_MS } from '../src/core/clock';
import { makeRng } from '../src/core/rng';
import { canopyDensity, canopyCover, cachedCanopyDensity } from '../src/world/canopy';
import { ANNUAL_CROWN_TYPES, crownCacheTime } from '../src/world/phenology';
import { World } from '../src/world/world';
import { buildAtmosphere } from '../src/world/palette';
import { rainField, rainShade, wetnessAt, rainMaterial } from '../src/render/afterRain';
import { groundLifeField, groundPatchClimate } from '../src/render/groundLife';
import { drawObjectShadow } from '../src/render/sprites';
import { clearSprites, drawCachedReflection, spriteSway, spriteStats } from '../src/render/spriteCache';
import { WeatherSystem } from '../src/world/weatherState';
import { Scene } from '../src/render/scene';

Object.assign(globalThis, {
  document: { createElement: () => createCanvas(8, 8) },
  window: { devicePixelRatio: 1, innerWidth: 1200, innerHeight: 850 },
});
Math.random = makeRng(1911);
const date = (month: number, day = 15, year = 2026) => new Date(year, month, day, 13).getTime();
const fixed = buildAtmosphere(computeTime(date(6)));
const atmosphere = (now: number) => ({ ...fixed, time: computeTime(now) });
for (const type of ANNUAL_CROWN_TYPES) {
  for (const seed of [17, 441]) {
    let previous = canopyDensity(type, seed, date(0, 1));
    for (let now = date(0, 1); now < date(0, 1, 2027); now += DAY_MS / 4) {
      const value = canopyDensity(type, seed, now);
      assert.ok(value >= 0 && value <= 1);
      assert.ok(Math.abs(value - previous) < 0.04, `${type}: continuous optical area`);
      assert.equal(cachedCanopyDensity(type, seed, now), canopyDensity(type, seed, crownCacheTime(type, seed, now)));
      previous = value;
    }
  }
}
assert.equal(canopyDensity('maple', 441, date(0)), 0);
assert.equal(canopyDensity('maple', 441, date(6)), 1);
assert.ok(canopyDensity('sakura', 441, date(3)) > 0.5, 'flowers cast shade before green leaves');
assert.equal(canopyCover('pine', 441, date(0)), canopyCover('pine', 441, date(6)));
assert.equal(canopyCover('bookshelf', 441, date(6)), 0);

const world = new World();
world.objects = [];
for (const tile of world.tiles)
  Object.assign(tile, { ground: 'soil', level: 0, water: false, indoor: false, veranda: false });
const maple = world.place('maple', 8, 8, 0)!;
const pine = world.place('pine', 17, 8, 0)!;
maple.seed = 441;
const field = rainField(world),
  summer = rainShade(field, date(6));
const winter = rainShade(field, date(0));
const mapleCell = field.cells.reduce((a, b) =>
  summer[b.y * field.size + b.x] > summer[a.y * field.size + a.x] && b.x < 14 ? b : a,
);
const index = mapleCell.y * field.size + mapleCell.x;
assert.ok(summer[index] > winter[index] * 5, 'bare branches let light reach the soil');
const pineCell = field.cells.findIndex((c) => c.x === Math.floor(pine.tx + 1) && c.y === Math.floor(pine.ty + 1));
assert.equal(summer[pineCell], winter[pineCell]);
assert.equal(rainField(world), field, 'calendar changes reuse spatial geometry');
assert.equal(rainShade(field, date(0) + 1), winter, 'no per-frame field rebuild within annual revisions');
assert.deepEqual(rainShade(field, date(6)), summer, 'reverse scrubbing is deterministic');
const weather = new WeatherSystem();
weather.state.wetness = 0.5;
const wet = weather.state;
assert.ok(
  wetnessAt(field, wet, mapleCell.x, mapleCell.y, date(6)) > wetnessAt(field, wet, mapleCell.x, mapleCell.y, date(0)),
);
assert.equal(
  wetnessAt(field, { ...wet, wetness: 0 }, mapleCell.x, mapleCell.y, date(6)),
  0,
  'shade never creates water',
);
assert.equal(
  wetnessAt(field, wet, 0, 0, date(6)),
  wetnessAt(field, wet, 0, 0, date(0)),
  'open ground unaffected by remote trees',
);
const patch = groundLifeField(world).patches.find((p) => p.treeSeed === maple.seed)!;
assert.ok(groundPatchClimate(patch, summer[index]).damp > groundPatchClimate(patch, winter[index]).damp);
const saved = JSON.stringify(world.toJSON());
for (let month = 0; month < 12; month++) {
  const now = date(month),
    atm = atmosphere(now);
  const normal = rainMaterial(atm, field, wet, 'rock_mid', mapleCell.x, mapleCell.y);
  const lamp = rainMaterial({ ...atm, lampGlow: 1, exposure: 2 }, field, wet, 'rock_mid', mapleCell.x, mapleCell.y);
  assert.equal(normal.materialWetness, lamp.materialWetness, 'lamp does not dry soil or act as a summer canopy');
}
const loaded = new World();
loaded.applySave(world.toJSON());
assert.deepEqual(rainShade(rainField(loaded), date(6)), summer);
maple.tx += 5;
assert.notEqual(rainField(world), field, 'moving a tree invalidates cover');
maple.tx -= 5;
assert.deepEqual(rainShade(rainField(world), date(6)), summer, 'undo restores cover');
maple.seed++;
assert.notEqual(rainField(world).key, field.key, 'seed changes invalidate annual individuality');
maple.seed--;
assert.equal(JSON.stringify(world.toJSON()), saved, 'no seasonal state written to saves');

const canvas = createCanvas(420, 400),
  ctx = canvas.getContext('2d');
const hash = () =>
  createHash('sha256')
    .update(ctx.getImageData(0, 0, 420, 400).data)
    .digest('hex');
const alphaMass = () => {
  const pixels = ctx.getImageData(0, 0, 420, 400).data;
  let sum = 0;
  for (let i = 3; i < pixels.length; i += 4) sum += pixels[i];
  return sum;
};
function drawShadow(type: string, now: number) {
  canvas.width = 420;
  drawObjectShadow({
    ctx: ctx as never,
    x: 210,
    y: 210,
    obj: { ...maple, type },
    atm: atmosphere(now),
    g: 1,
    time: 0,
    wind: 0,
    alpha: 1,
  });
  return { hash: hash(), mass: alphaMass() };
}
for (const type of ['maple', 'sakura', 'ginkgo', 'willow', 'persimmon', 'wisteria']) {
  const bare = drawShadow(type, date(0)),
    leafy = drawShadow(type, date(6));
  assert.ok(leafy.mass > bare.mass * 2, `${type}: no summer shadow under bare branches`);
  assert.deepEqual(drawShadow(type, date(0)), bare, 'warm probe cache does not retain summer opacity');
}
assert.deepEqual(drawShadow('pine', date(0)), drawShadow('pine', date(6)));
assert.deepEqual(drawShadow('rock_mid', date(0)), drawShadow('rock_mid', date(6)), 'inanimate shadows unchanged');
function reflection(now: number, wind = 0, x = 210) {
  canvas.width = 420;
  drawCachedReflection(
    {
      ctx: ctx as never,
      x,
      y: 90,
      obj: maple,
      atm: atmosphere(now),
      g: 1,
      time: 3100,
      wind,
      alpha: 0.6,
      reflectionWarp: () => ({ dx: 0, dy: 0, alpha: 1 }),
    },
    1,
  );
  return { hash: hash(), mass: alphaMass() };
}
clearSprites();
const bare = reflection(date(0)),
  leafy = reflection(date(6));
assert.ok(bare.mass > 1000, 'bare trunk and branches still reflect');
assert.ok(leafy.mass > bare.mass * 1.5, 'reflected leaf area follows actual annual sprite');
assert.deepEqual(reflection(date(0)), bare, 'backward calendar visits recover exact reflection');
clearSprites();
assert.deepEqual(reflection(date(0)), bare, 'cold and warm reflection caches agree');
const sway = spriteSway(maple.type, maple.seed, 1, 3100, 0.8);
assert.deepEqual(reflection(date(6), 0.8), reflection(date(6), 0, 210 + sway), 'same live pose as the shore sprite');
assert.equal(spriteSway('rock_mid', maple.seed, 1, 3100, 1), 0);
for (let month = 0; month < 12; month++) {
  reflection(date(month));
  await yieldNative();
}
assert.ok(spriteStats().size <= 420 && spriteStats().boxes <= 600);
assert.equal(JSON.stringify(world.toJSON()), saved);
console.log(
  'ок: continuous canopy area, blossom/evergreen cover, annual shadows, drying and ground moisture, shared reflection pose/anatomy, cache history, move/undo/reload/seed, lamp independence and save purity',
);
if (process.argv.includes('--preview')) {
  clearSprites();
  const garden = new World(),
    cv = createCanvas(1200, 850);
  Object.assign(cv, { clientWidth: 1200, clientHeight: 850 });
  const scene = new Scene(cv as never);
  scene.camera.zoom = 1.02;
  scene.centerOn(11.5, 12);
  scene.particles = false;
  for (const [name, month, day] of [
    ['buds', 2, 24],
    ['blossom', 3, 15],
    ['summer', 6, 15],
    ['leaf-fall', 10, 15],
  ] as const) {
    scene.render(garden, buildAtmosphere(computeTime(date(month, day))), 3100, 16);
    writeFileSync(`preview-annual-stage3-${name}.png`, cv.toBuffer('image/png'));
    await yieldNative();
  }
}
