/** Crown-sized leaf carpets: accumulation, ageing, summer disappearance and bounded stamp reuse. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { setImmediate as yieldNative } from 'node:timers/promises';
import { createCanvas } from '@napi-rs/canvas';
import { computeTime, DAY_MS } from '../src/core/clock';
import { makeRng } from '../src/core/rng';
import { isoToScreen } from '../src/core/iso';
import { litterYear } from '../src/world/annualEnvironment';
import { canopyLeafDensity, TREE_CROWNS } from '../src/world/canopy';
import { buildAtmosphere } from '../src/world/palette';
import { World } from '../src/world/world';
import { groundLifeField, drawGroundLife, litterColor } from '../src/render/groundLife';
import { Scene } from '../src/render/scene';
Object.assign(globalThis, {
  document: { createElement: () => createCanvas(8, 8) },
  window: { devicePixelRatio: 1, innerWidth: 1200, innerHeight: 850 },
});
Math.random = makeRng(3829);
const date = (month: number, day = 15, year = 2026) => new Date(year, month, day, 13).getTime();
for (const type of Object.keys(TREE_CROWNS).filter((type) => type !== 'yuzu')) {
  for (const seed of [17, 441, 9876]) {
    let previous = litterYear(type, seed, date(0, 1));
    for (let now = date(0, 1); now < date(0, 1, 2027); now += DAY_MS / 4) {
      const state = litterYear(type, seed, now);
      for (const key of ['leaves', 'amount', 'petals'] as const) {
        assert.ok(state[key] >= 0 && state[key] <= 1);
        assert.ok(Math.abs(state[key] - previous[key]) < 0.04, `${type}: continuous ${key}`);
      }
      previous = state;
    }
    for (let now = date(8, 1); now <= date(11, 15); now += DAY_MS) {
      assert.ok(
        Math.abs(litterYear(type, seed, now).leaves + canopyLeafDensity(type, seed, now) - 1) < 1e-8,
        `${type}: missing autumn crown area is represented on the ground`,
      );
    }
    const autumn = litterYear(type, seed, date(11, 20));
    const march = litterYear(type, seed, date(2));
    const april = litterYear(type, seed, date(3));
    const may = litterYear(type, seed, date(4));
    assert.ok(autumn.leaves > 0.9 && march.leaves < 0.65);
    assert.ok(march.leaves > april.leaves && april.leaves > may.leaves);
    assert.ok(april.leaves < 0.25 && may.leaves < 0.045);
    assert.equal(march.fresh, 0, 'old spring leaves are weathered, not autumn-bright');
    for (const month of [5, 6, 7]) assert.equal(litterYear(type, seed, date(month, 1)).leaves, 0);
  }
}
assert.ok(litterYear('sakura', 441, date(4, 10)).petals > 0.5);
assert.ok(litterYear('sakura', 441, date(4, 10)).leaves < 0.06, 'new petals do not replenish old leaf litter');
const fresh = litterColor('maple', 1),
  old = litterColor('maple', 0);
assert.ok(Math.max(...Object.values(old)) - Math.min(...Object.values(old)) < 30);
assert.ok(fresh.r - fresh.b > 100 && old.r - old.b < 30, 'spring litter is dull grey-brown');

function garden(type = 'maple') {
  const w = new World();
  w.objects = [];
  for (const tile of w.tiles)
    Object.assign(tile, { ground: 'soil', level: 0, water: false, indoor: false, veranda: false });
  const tree = w.place(type, 12, 12)!;
  tree.seed = 441;
  return w;
}
const world = garden(),
  saved = JSON.stringify(world.toJSON()),
  field = groundLifeField(world);
const litter = field.patches.filter((p) => p.kind === 'leaves');
assert.ok(litter.length >= 5, 'the tree has a broad litter footprint, not a single sparse accent');
const small = groundLifeField(garden('persimmon')).patches.filter((p) => p.kind === 'leaves');
assert.ok(small.length < litter.length, 'small persimmon does not drop a maple-sized carpet');
// Isolate the actual leaf layer, excluding grass, roots, shadows and changing terrain colours.
field.patches = litter;
const canvas = createCanvas(500, 300),
  ctx = canvas.getContext('2d');
const foot = isoToScreen(12.5, 12.5),
  fixed = buildAtmosphere(computeTime(date(6)));
const view = { x: foot.x, y: foot.y, width: 500, height: 300, zoom: 1 };
function render(now: number, zoom = 1) {
  canvas.width = 500;
  ctx.translate(250, 150);
  ctx.scale(zoom, zoom);
  ctx.translate(-foot.x, -foot.y);
  drawGroundLife(ctx as never, world, { ...fixed, time: computeTime(now) }, { ...view, zoom });
  const data = ctx.getImageData(0, 0, 500, 300).data;
  let mass = 0,
    ink = 0;
  for (let i = 3; i < data.length; i += 4) {
    mass += data[i];
    if (data[i] > 25) ink++;
  }
  return { mass, ink, hash: createHash('sha256').update(data).digest('hex') };
}
const autumn = render(date(10, 12)),
  march = render(date(2)),
  april = render(date(3)),
  may = render(date(4)),
  summer = render(date(5, 1));
assert.ok(autumn.ink > 7500, `substantial actual raster coverage, got ${autumn.ink} pixels`);
assert.ok(march.mass < autumn.mass * 0.55 && april.mass < march.mass * 0.6);
assert.ok(may.mass < autumn.mass * 0.05);
assert.equal(summer.mass, 0, 'not even a translucent autumn carpet survives into June');
assert.equal(render(date(10, 12)).hash, autumn.hash, 'backward scrubbing reuses no stale spring image');
assert.ok(render(date(10, 12), 0.4).mass > 25000, 'coarse litter bed remains readable at phone-scale zoom');
assert.equal(render(date(5, 1), 0.4).mass, 0);
render(date(10, 12));
const retired = [...field.paint!.images.values()].map((s) => s.canvas);
render(date(3));
assert.ok(
  retired.every((c) => c.width === 1 && c.height === 1),
  'season revisions release backing pixels',
);
// Several complete years, deterministic sites and only one current paint revision.
for (let year = 2026; year < 2032; year++) {
  for (let month = 0; month < 12; month++) {
    render(date(month, 15, year));
    assert.equal(groundLifeField(world), field);
    assert.ok(field.paint!.images.size <= litter.length);
  }
  await yieldNative();
}
assert.equal(JSON.stringify(world.toJSON()), saved, 'no leaves saved as world objects or growing history');
const oldStamps = [...field.paint!.images.values()].map((s) => s.canvas);
world.objects[0].tx += 4;
assert.notEqual(groundLifeField(world), field);
assert.ok(
  oldStamps.every((c) => c.width === 1 && c.height === 1),
  'moving a tree also releases retired ground stamps',
);
console.log(
  `ок: deciduous species / seeded continuous year, crown-to-ground leaf area, grey-brown spring thinning, zero old leaves by June, smaller tree footprint, ${autumn.ink} autumn ink pixels, LOD, six-year cache reuse and save purity`,
);

if (process.argv.includes('--preview')) {
  const w = garden(),
    panel = createCanvas(360, 360);
  Object.assign(panel, { clientWidth: 360, clientHeight: 360 });
  const scene = new Scene(panel as never);
  scene.camera.zoom = 1.4;
  scene.centerOn(12.5, 12.5);
  scene.camera.y -= 60;
  scene.particles = false;
  const output = createCanvas(1480, 430),
    c = output.getContext('2d');
  c.fillStyle = '#eee9da';
  c.fillRect(0, 0, 1480, 430);
  c.fillStyle = '#514b40';
  c.font = '20px sans-serif';
  c.fillText('Один клён: крона → опад → весеннее разложение', 20, 29);
  for (const [i, [label, month, day]] of (
    [
      ['Ноябрь · плотный опад', 10, 12],
      ['Март · жухлые остатки', 2, 15],
      ['Апрель · редеющий слой', 3, 15],
      ['Июнь · прошлых листьев нет', 5, 1],
    ] as const
  ).entries()) {
    scene.render(w, buildAtmosphere(computeTime(date(month, day))), 1000, 16);
    c.drawImage(panel, 10 + i * 370, 40);
    c.fillStyle = '#514b40';
    c.font = '16px sans-serif';
    c.fillText(label, 18 + i * 370, 417);
    await yieldNative();
  }
  writeFileSync('preview-litter-cycle.png', output.toBuffer('image/png'));
}
