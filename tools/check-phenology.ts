/** Continuous annual crown regression: deterministic anatomy, dates, caches, bounds and save purity. */
import assert from 'node:assert/strict';
import { createCanvas } from '@napi-rs/canvas';
import { writeFileSync } from 'node:fs';
import { setImmediate as yieldNative } from 'node:timers/promises';
import { createHash } from 'node:crypto';
import { annualPhase, computeTime, DAY_MS } from '../src/core/clock';
import { plantYear, leafGroup, crownCacheKey, ANNUAL_CROWN_TYPES } from '../src/world/phenology';
import { crownSites } from '../src/render/crownGeometry';
import { buildAtmosphere } from '../src/world/palette';
import { drawObject, setSkipShadows } from '../src/render/sprites';
import { drawCached, clearSprites, spriteStats, spriteFrame } from '../src/render/spriteCache';
import { World } from '../src/world/world';
import { Scene } from '../src/render/scene';
import { makeRng } from '../src/core/rng';
Object.assign(globalThis, {
  document: { createElement: () => createCanvas(8, 8) },
  window: { devicePixelRatio: 1, innerWidth: 1200, innerHeight: 850 },
});
Math.random = makeRng(891);
const at = (m: number, d = 15, y = 2026, h = 12) => new Date(y, m, d, h).getTime();
for (const year of [2024, 2025, 2026, 2028]) {
  for (const [month, phase] of [
    [0, 0],
    [3, 0.25],
    [6, 0.5],
    [9, 0.75],
  ])
    assert.equal(annualPhase(at(month, 15, year, 0)), phase);
  let prev = annualPhase(at(0, 16, year, 0));
  for (let t = at(0, 16, year, 0) + DAY_MS; t < at(0, 15, year + 1, 0); t += DAY_MS) {
    const q = annualPhase(t);
    assert.ok(q > prev, 'year advances across leap days, DST and January 1');
    prev = q;
  }
  for (let month = 0; month < 12; month++) {
    const midnight = at(month, 1, year, 0),
      before = annualPhase(midnight - 1),
      after = annualPhase(midnight);
    assert.ok(Math.abs(after - before) < 1e-8, 'no month/year jumps');
  }
}
for (const type of ANNUAL_CROWN_TYPES) {
  for (const seed of [1, 17, 441, 891]) {
    const geometries = crownSites(seed, 100, 74, 5);
    assert.deepEqual(crownSites(seed, 100, 74, 5), geometries);
    let previous: { foliage: number; bud: number; bloom: number; winterTone: number } | undefined;
    for (let t = at(0, 1); t < at(0, 1, 2027); t += DAY_MS / 4) {
      const p = plantYear(type, seed, t);
      assert.deepEqual(plantYear(type, seed, t), p, 'date visits never depend on playback direction/history');
      for (const value of Object.values(p))
        if (typeof value === 'number') assert.ok(Number.isFinite(value) && value >= 0 && value <= 1);
      if (previous)
        for (const key of ['foliage', 'bud', 'bloom', 'winterTone'] as const)
          assert.ok(Math.abs(p[key] - previous[key]) < 0.04, `${type} continuous ${key}`);
      previous = p;
      if (p.evergreen) assert.equal(p.foliage, 1);
    }
    const jan = plantYear(type, seed, at(0)),
      july = plantYear(type, seed, at(6));
    if (!jan.evergreen) {
      assert.equal(jan.foliage, 0);
      assert.equal(july.foliage, 1);
    }
  }
}
assert.notEqual(
  plantYear('maple', 17, at(2, 20)).foliage,
  plantYear('maple', 441, at(2, 20)).foliage,
  'stable seed timings',
);
assert.ok(
  plantYear('willow', 441, at(2, 20)).foliage > plantYear('ginkgo', 441, at(2, 20)).foliage,
  'species calendars',
);
const sakura = plantYear('sakura', 441, at(3));
assert.ok(sakura.bloom > 0.9 && sakura.foliage < 0.15, 'sakura flowers before its green crown');
const fall = plantYear('maple', 441, at(8, 25));
assert.ok(
  new Set(Array.from({ length: 21 }, (_, i) => leafGroup(fall, 441, i).color.toFixed(2))).size > 5,
  'patchy autumn, not one global tint',
);
const thinning = plantYear('maple', 441, at(10, 8));
const groups = Array.from({ length: 21 }, (_, i) => leafGroup(thinning, 441, i));
assert.ok(
  groups.some((g) => g.retained < 0.2) && groups.some((g) => g.retained > 0.5),
  'different branches lose leaves at different times',
);
assert.equal(crownCacheKey('rock_mid', 17, at(2)), '');
assert.equal(crownCacheKey('house', 17, at(2)), '');
assert.equal(crownCacheKey('maple', 17, at(3)), crownCacheKey('maple', 17, at(3) + 16), 'no frame-driven rebaking');
const c = createCanvas(400, 340),
  ctx = c.getContext('2d');
const fixed = buildAtmosphere(computeTime(at(6)));
function draw(type: string, now: number, cached = true, seed = 441) {
  // Release native scratch recordings, not only cover thousands of previous test drawings.
  c.width = 400;
  // Fixed light and no winter snow: isolate annual canopy, not stage-two snow or seasonal background.
  const atm = { ...fixed, time: computeTime(now) };
  const d = {
    ctx: ctx as never,
    x: 200,
    y: 250,
    atm,
    g: 1,
    obj: { id: 1, type, seed, rot: 0, tx: 0, ty: 0, planted: 0 },
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
  return Buffer.from(ctx.getImageData(0, 0, 400, 340).data);
}
const digest = (p: Buffer) => createHash('sha256').update(p).digest('hex');
const world = new World(),
  save = JSON.stringify(world.toJSON());
for (const type of ['maple', 'sakura', 'ginkgo', 'willow', 'persimmon', 'wisteria']) {
  clearSprites();
  const hashes = new Set<string>();
  for (let day = 0; day < 365; day += 3) {
    spriteFrame();
    hashes.add(digest(draw(type, at(0, 1) + day * DAY_MS)));
    if (day % 24 === 0) await yieldNative();
  }
  assert.ok(hashes.size > 48, `${type} really evolves throughout a year, not twelve images`);
  // Autumn -> buds -> winter -> summer -> autumn, without clearing: both colour and bounds caches must track the date.
  for (const date of [at(9, 7), at(2, 18), at(0), at(6), at(10, 8)]) {
    const hot = draw(type, date);
    clearSprites();
    const cold = draw(type, date);
    assert.equal(digest(hot), digest(cold), `${type} cache history must not leave an old crown/bounding box`);
    const direct = draw(type, date, false);
    // Integer-position copies should not remove branch tips, blossoms or the expanded summer canopy.
    let clipped = 0,
      total = 0;
    for (let i = 3; i < direct.length; i += 4)
      if (direct[i] > 30) {
        total++;
        if (cold[i] < 2) clipped++;
      }
    assert.ok(clipped / Math.max(1, total) < 0.006, `${type}: sprite clipping ${clipped}/${total}`);
  }
  // Every month boundary at fixed noon illumination; no seasonal reset hidden by palette changes.
  for (let month = 1; month <= 12; month++) {
    const date = at(month, 1, 2026, 0),
      before = draw(type, date - 1, false),
      after = draw(type, date, false);
    let delta = 0;
    for (let i = 0; i < before.length; i++) delta += Math.abs(after[i] - before[i]);
    assert.ok(delta < 150, `${type}: month ${month + 1} abrupt crown change (${delta})`);
  }
}
// A bucket's pixels must not depend on arrival time (including DST's extra/missing hour).
for (const type of ['sakura', 'maple', 'ginkgo', 'pine', 'bamboo']) {
  let date = at(3, 15);
  while (crownCacheKey(type, 441, date) !== crownCacheKey(type, 441, date + 3600000)) date += DAY_MS;
  clearSprites();
  draw(type, date);
  const warm = digest(draw(type, date + 3600000));
  clearSprites();
  assert.equal(digest(draw(type, date + 3600000)), warm, `${type}: canonical annual cache date`);
}
clearSprites();
for (let day = 0; day < 365; day += 2)
  for (const type of ['maple', 'sakura', 'ginkgo', 'willow']) {
    spriteFrame();
    draw(type, at(0, 1) + day * DAY_MS);
    assert.ok(spriteStats().size <= 420);
    assert.ok(spriteStats().boxes <= 600);
    if (day % 24 === 0) await yieldNative();
  }
for (const seed of [1, 5, 17, 42, 187, 891, 9021, 15377])
  for (const type of ['maple', 'ginkgo', 'willow']) {
    clearSprites();
    const cached = draw(type, at(6), true, seed),
      direct = draw(type, at(6), false, seed);
    let lost = 0,
      count = 0;
    for (let i = 3; i < direct.length; i += 4)
      if (direct[i] > 30) {
        count++;
        if (cached[i] < 2) lost++;
      }
    assert.ok(lost / Math.max(1, count) < 0.006, `${type} seed ${seed} summer bounds`);
  }
assert.equal(JSON.stringify(world.toJSON()), save, 'render-only calendar does not mutate ages, placements or saves');
console.log(
  'ок: annual anchors, leap years/month/year boundaries, deterministic species/seed rhythms, patchy colour and shedding, evergreen retention, >48 annual appearances/species, cache history/bounds and bounded 420-sprite cache',
);
// Human-readable crown study. Dates are samples of a continuous model, not render presets.
const types = ['sakura', 'maple', 'ginkgo', 'willow', 'persimmon', 'wisteria'];
const dates = [
  [2, 5, '5 марта'],
  [3, 15, '15 апреля'],
  [6, 15, '15 июля'],
  [8, 20, '20 сентября'],
  [9, 20, '20 октября'],
  [10, 12, '12 ноября'],
  [0, 15, '15 января'],
] as const;
const sheet = createCanvas(1510, dates.length * 205 + 90),
  sc = sheet.getContext('2d');
sc.fillStyle = '#f3efdf';
sc.fillRect(0, 0, sheet.width, sheet.height);
sc.fillStyle = '#34473d';
sc.font = '22px sans-serif';
sc.fillText('Непрерывный год · те же ветви и точки листвы', 24, 31);
sc.font = '17px sans-serif';
['Сакура', 'Клён', 'Гинкго', 'Ива', 'Хурма', 'Глициния'].forEach((name, i) => sc.fillText(name, 155 + i * 235, 66));
for (let row = 0; row < dates.length; row++) {
  const [m, day, label] = dates[row];
  sc.fillStyle = '#777969';
  sc.font = '15px sans-serif';
  sc.fillText(label, 15, 180 + row * 205);
  for (let col = 0; col < types.length; col++) {
    const now = at(m, day),
      atm = buildAtmosphere(computeTime(now));
    drawObject({
      ctx: sc as never,
      x: 215 + col * 235,
      y: 260 + row * 205,
      atm,
      g: 1,
      obj: { id: 1, type: types[col], seed: 441, rot: 0, tx: 0, ty: 0, planted: 0 },
      time: 0,
      wind: 0,
      alpha: 1,
    });
  }
}
writeFileSync('preview-annual-crowns.png', sheet.toBuffer('image/png'));

await yieldNative();
clearSprites();
await yieldNative();
if (process.argv.includes('--preview')) {
  const garden = new World();
  await yieldNative();
  for (const [name, m, day, width, height, zoom] of [
    ['spring', 3, 15, 1200, 850, 1.02],
    ['summer', 6, 15, 1200, 850, 1.02],
    ['turning', 8, 28, 1200, 850, 1.02],
    ['thinning', 10, 15, 1200, 850, 1.02],
    ['phone', 8, 28, 430, 800, 0.46],
  ] as const) {
    const canvas = createCanvas(width, height);
    Object.assign(canvas, { clientWidth: width, clientHeight: height });
    const scene = new Scene(canvas as never);
    scene.camera.zoom = zoom;
    scene.centerOn(11.5, 12);
    scene.render(garden, buildAtmosphere(computeTime(at(m, day))), 3000, 16);
    writeFileSync(`preview-annual-${name}.png`, canvas.toBuffer('image/png'));
    console.log(`preview-annual-${name}.png`);
    await yieldNative();
  }
}
