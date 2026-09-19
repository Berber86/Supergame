/** Stage two: a continuous calendar, stable sites, gradual winter geometry and independent night buds. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { setImmediate as yieldNative } from 'node:timers/promises';
import { createCanvas } from '@napi-rs/canvas';
import { computeTime, DAY_MS } from '../src/core/clock';
import { winterYear, flowerYear, litterYear } from '../src/world/annualEnvironment';
import { plantYear } from '../src/world/phenology';
import { buildAtmosphere } from '../src/world/palette';
import { roofSnow, paintRoofSnow, paintIcicles, iciclesPresent } from '../src/render/roofSnow';
import { World } from '../src/world/world';
import { WaterFlow } from '../src/world/waterFlow';
import { pondIceState, iceEligible } from '../src/render/winterIce';
import { waterSurfaces } from '../src/render/waterSurface';
import { drawObject } from '../src/render/sprites';
import { setSkipShadows } from '../src/render/sprites/common';
import { drawCached, clearSprites, spriteStats, spriteFrame } from '../src/render/spriteCache';
import { Scene } from '../src/render/scene';
import { makeRng } from '../src/core/rng';
Object.assign(globalThis, {
  document: { createElement: () => createCanvas(8, 8) },
  window: { devicePixelRatio: 1, innerWidth: 1200, innerHeight: 850 },
});
Math.random = makeRng(1703);
const date = (m: number, d = 15, h = 12, y = 2026) => new Date(y, m, d, h).getTime();
const atm = (m: number, d = 15, h = 12) => buildAtmosphere(computeTime(date(m, d, h)));
let last = winterYear(date(0, 1));
for (let t = date(0, 1) + DAY_MS / 4; t < date(0, 1, 12, 2027); t += DAY_MS / 4) {
  const next = winterYear(t);
  for (const key of ['snow', 'ice', 'icicles'] as const) {
    assert.ok(next[key] >= 0 && next[key] <= 1);
    assert.ok(Math.abs(next[key] - last[key]) < 0.015, `${key}: no switches`);
  }
  last = next;
}
assert.equal(winterYear(date(0)).snow, 1);
assert.equal(winterYear(date(6)).snow, 0);
assert.ok(winterYear(date(11, 1)).snow < winterYear(date(11, 25)).snow);
assert.ok(winterYear(date(1, 1)).snow > winterYear(date(2, 1)).snow);
assert.ok(winterYear(date(2, 1)).snow > 0, 'snow does not disappear on March 1');
const types = ['iris', 'lily', 'lotus', 'azalea', 'camellia', 'wildflowers'];
for (const type of types) {
  let previous = flowerYear(type, 441, date(0, 1));
  const appearances = new Set<string>();
  for (let t = date(0, 1); t < date(0, 1, 12, 2027); t += DAY_MS / 4) {
    const p = flowerYear(type, 441, t);
    assert.ok(p.bloom >= 0 && p.bloom <= 1 && p.foliage >= 0 && p.foliage <= 1);
    assert.ok(Math.abs(p.bloom - previous.bloom) < 0.025, `${type} no blooming reset`);
    appearances.add(p.bloom.toFixed(3));
    previous = p;
  }
  assert.ok(appearances.size > 90, `${type} evolves between month presets`);
}
assert.ok(flowerYear('iris', 441, date(3)).bloom > flowerYear('lotus', 441, date(3)).bloom);
assert.equal(flowerYear('lotus', 441, date(0)).bloom, 0);
assert.ok(flowerYear('camellia', 441, date(0)).bloom > 0.95);
for (const type of ['maple', 'ginkgo', 'sakura']) {
  const late = litterYear(type, 441, date(10, 25)),
    spring = litterYear(type, 441, date(5));
  assert.ok(late.amount > 0.8 && spring.amount < late.amount, 'litter accumulates and decomposes');
  assert.ok(plantYear(type, 441, date(10, 25)).foliage < 0.2, 'litter follows the parent tree shedding');
}
assert.ok(litterYear('sakura', 441, date(4, 10)).petals > 0);
const world = new World(),
  saved = JSON.stringify(world.toJSON()),
  flow = new WaterFlow();
flow.ensure(world);
const surface = waterSurfaces(world).find((s) => s.cells.length > 10)!;
assert.ok(iceEligible(world, flow, surface));
assert.equal(
  pondIceState(atm(11), surface).seed,
  pondIceState(atm(1), surface).seed,
  'ice sites persist through freeze/thaw',
);
const c = createCanvas(420, 350),
  ctx = c.getContext('2d');
const hash = () =>
  createHash('sha256')
    .update(ctx.getImageData(0, 0, 420, 350).data)
    .digest('hex');
const fixed = atm(6);
function render(type: string, now: number, cached: boolean, daylight = 1) {
  c.width = 420;
  const a = { ...fixed, time: { ...computeTime(now), daylight } };
  const d = {
    ctx: ctx as never,
    x: 210,
    y: 270,
    atm: a,
    g: 1,
    obj: { type, seed: 441, id: 1, tx: 0, ty: 0, rot: 0, planted: 0 },
    time: 0,
    wind: 0,
    alpha: 1,
  };
  setSkipShadows(true);
  try {
    if (cached) drawCached(d);
    else drawObject(d);
  } finally {
    setSkipShadows(false);
  }
  return hash();
}
for (const type of ['iris', 'lily', 'lotus', 'lilypad', 'azalea', 'camellia', 'pine', 'rock_mid', 'tea_house']) {
  clearSprites();
  const hashes = new Set<string>();
  for (let d = 0; d < 366; d += 7) {
    spriteFrame();
    hashes.add(render(type, date(0, 1) + d * DAY_MS, true));
    if (d % 28 === 0) await yieldNative();
  }
  assert.ok(hashes.size > 12, `${type}: multiple shapes during the year`);
  for (const m of [0, 2, 4, 6, 10, 11]) {
    const hot = render(type, date(m), true);
    clearSprites();
    assert.equal(render(type, date(m), true), hot, `${type} stale annual cache`);
  }
  assert.ok(spriteStats().size <= 420 && spriteStats().boxes <= 600);
}
for (const [type, m] of [
  ['iris', 3],
  ['lily', 5],
  ['lotus', 6],
  ['azalea', 3],
  ['camellia', 0],
] as const) {
  const opened = render(type, date(m), false, 1),
    closed = render(type, date(m), false, 0);
  assert.notEqual(opened, closed, `${type}: annual flower still closes at night under unchanged light`);
}
// The real roof painter remains clipped while its patch area grows; no random relocation.
function roofInk(amount: number) {
  c.width = 420;
  paintRoofSnow(
    ctx as never,
    fixed,
    { amount, seed: 531 },
    [
      { x: 60, y: 40 },
      { x: 360, y: 40 },
      { x: 360, y: 230 },
      { x: 60, y: 230 },
    ],
    (u, v) => ({ x: 60 + u * 300, y: 40 + v * 190 }),
  );
  const px = ctx.getImageData(0, 0, 420, 350).data;
  let ink = 0;
  for (let y = 0; y < 350; y++)
    for (let x = 0; x < 420; x++)
      if (px[(y * 420 + x) * 4 + 3] > 10) {
        ink++;
        assert.ok(x >= 59 && x <= 360 && y >= 39 && y <= 230);
      }
  return ink;
}
const ink = [0, 0.15, 0.4, 0.7, 1].map(roofInk);
for (let i = 1; i < ink.length; i++) assert.ok(ink[i] > ink[i - 1], 'snow covers more roof, not a seasonal image fade');
const roofSeeds = Array.from({ length: 80 }, (_, i) => i),
  winter = atm(0);
const seed = roofSeeds.find((s) => iciclesPresent(roofSnow(winter, s)))!;
assert.notEqual(seed, undefined);
const edge = Array.from({ length: 24 }, (_, i) => ({ x: 30 + i * 14, y: 40 }));
c.width = 420;
paintIcicles(ctx as never, winter, roofSnow(winter, seed), edge);
const frozen = hash();
c.width = 420;
paintIcicles(ctx as never, atm(6), roofSnow(winter, seed), edge);
assert.notEqual(hash(), frozen);
assert.equal(JSON.stringify(world.toJSON()), saved, 'calendar rendering does not edit the save');
console.log(
  'ок: continuous freeze/thaw and species bloom, parent-tree litter/decomposition, stable ice sites, annual sprite/bounds history, nightly buds, roof coverage/clipping and save purity',
);
if (process.argv.includes('--preview')) {
  clearSprites();
  await yieldNative();
  const canvas = createCanvas(1200, 850);
  Object.assign(canvas, { clientWidth: 1200, clientHeight: 850 });
  const scene = new Scene(canvas as never);
  scene.camera.zoom = 1.02;
  scene.centerOn(11.5, 12);
  scene.particles = false;
  for (const [name, m, d] of [
    ['first-snow', 11, 12],
    ['winter', 0, 15],
    ['thaw', 2, 1],
    ['spring', 3, 15],
    ['summer', 6, 15],
    ['litter', 10, 12],
  ] as const) {
    scene.render(world, atm(m, d), 3000, 16);
    writeFileSync(`preview-annual-stage2-${name}.png`, canvas.toBuffer('image/png'));
    await yieldNative();
  }
}
