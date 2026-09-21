import assert from 'node:assert/strict';
import { createCanvas, loadImage } from '@napi-rs/canvas';
import { writeFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { drawObject, setSkipShadows } from '../src/render/sprites';
import { drawCached, clearSprites, spriteStats } from '../src/render/spriteCache';
import { computeTime } from '../src/core/clock';
import { buildAtmosphere } from '../src/world/palette';
import {
  pineProfile,
  pineGrowth,
  PINE_FORMS,
  PINE_FORM_NAMES,
  PINE_STAGES,
  pineStage,
  calculatePineGrowth,
  PINE_GROW_NORMAL_MS,
  PINE_GROW_GARDEN_MS,
} from '../src/world/pine';
import { pineGeometry } from '../src/render/pineGeometry';
import { woodPoint, woodFrame } from '../src/render/treeWood';
import { plantPose, windOffset } from '../src/render/plantWind';
import { World } from '../src/world/world';
import { serializeSave } from '../src/world/saveFormat';
import { scaleJitterOf } from '../src/render/sprites/common';
Object.assign(globalThis, { document: { createElement: () => createCanvas(8, 8) } });
// Every archetype, not just four accidentally similar seeds. The original four remain in regression checks.
const seeds = Array.from({ length: 512 }, (_, i) => i);
const examples = PINE_FORMS.map((form) => seeds.find((seed) => pineProfile(seed).form === form)!);
const heights = seeds.map((seed) => pineProfile(seed).height);
assert.ok(Math.min(...heights) < 98 && Math.max(...heights) > 220);
assert.ok(Math.max(...heights) / Math.min(...heights) > 2.3, 'mature pines have visibly different heights');
for (const form of PINE_FORMS)
  assert.ok(
    seeds.filter((seed) => pineProfile(seed).form === form).length > 50,
    `${form}: a real habit, not a rare accident`,
  );
assert.equal(pineGrowth(0), 0.2);
assert.equal(pineGrowth(1), 1);
for (const seed of seeds) {
  const skeleton = pineGeometry(seed, 1);
  assert.deepEqual(pineGeometry(seed, 1), skeleton, 'no calendar, random generator state, or prior visits');
  assert.ok(skeleton.sprays.length >= 6 && skeleton.sprays.length <= 24);
  assert.equal(skeleton.trunks.length, skeleton.profile.form === 'forked' ? 2 : 1);
  if (skeleton.forkAt) assert.deepEqual(skeleton.trunks[1].a, woodPoint(skeleton.trunks[0], skeleton.forkAt));
  for (const bough of skeleton.boughs) {
    assert.deepEqual(bough.curve.a, woodPoint(skeleton.trunks[bough.parent], bough.at));
    assert.ok(bough.curve.r0 <= woodFrame(skeleton.trunks[bough.parent], bough.at).r);
  }
  for (const curve of [...skeleton.trunks, ...skeleton.boughs.map((b) => b.curve), ...skeleton.twigs]) {
    let radius = Infinity;
    for (let i = 0; i <= 16; i++) {
      const f = woodFrame(curve, i / 16);
      assert.ok(Object.values(f).every(Number.isFinite));
      assert.ok(f.r > 0 && f.r <= radius + 1e-9);
      radius = f.r;
    }
  }
  const young = pineGeometry(seed, 0.2);
  assert.equal(young.profile.form, skeleton.profile.form);
  assert.ok(young.height < skeleton.height && young.sprays.length === skeleton.sprays.length);
  const air = { x: 1, y: -1, strength: Math.SQRT2, screenX: 1, screenY: 0 };
  const pose = plantPose('pine', seed, 1, 1000, air)!;
  assert.equal(windOffset(pose, 0), 0);
  assert.ok(pose.hinge > skeleton.height * 0.3 && pose.hinge < skeleton.height * 0.65);
  assert.equal(plantPose('pine', seed, 1, 1000, air, true)!.hinge, 0);
}
console.log(
  'ок: 512 сидов, 5 силуэтов, высота более чем вдвое, настоящие развилки и крепления ветвей, масштабный ветер',
);

const cv = createCanvas(1600, 470),
  ctx = cv.getContext('2d');
const atm = buildAtmosphere(computeTime(new Date(2026, 8, 20, 8, 13).getTime()));
ctx.fillStyle = '#e2e5cf';
ctx.fillRect(0, 0, 1600, 470);
for (const [i, seed] of examples.entries()) {
  ctx.save();
  ctx.translate(160 + i * 320, 414);
  ctx.scale(1.45, 1.45);
  drawObject({
    ctx: ctx as never,
    x: 0,
    y: 0,
    atm,
    g: 1,
    obj: { id: i, type: 'pine', seed, rot: 0, tx: 0, ty: 0, planted: 0 },
    time: 0,
    wind: 0,
    alpha: 1,
  });
  ctx.restore();
  ctx.fillStyle = '#4b5946';
  ctx.font = '20px sans-serif';
  ctx.fillText(PINE_FORM_NAMES[pineProfile(seed).form], 20 + i * 320, 455);
}
if (process.argv.includes('--before')) {
  writeFileSync('preview-pine-before.png', cv.toBuffer('image/png'));
  process.exit(0);
}
const probe = createCanvas(450, 390),
  pc = probe.getContext('2d');
function render(seed: number, g: number, month: number, cached: boolean) {
  probe.width = 450;
  const d = {
    ctx: pc as never,
    x: 220,
    y: 320,
    atm: buildAtmosphere(computeTime(new Date(2026, month, 15, 12).getTime())),
    g,
    obj: { id: 1, type: 'pine', seed, rot: 0, tx: 0, ty: 0, planted: 0 },
    time: 0,
    wind: 0,
    alpha: 1,
  };
  setSkipShadows(true);
  try {
    if (cached) assert.ok(drawCached(d));
    else drawObject(d);
  } finally {
    setSkipShadows(false);
  }
  return pc.getImageData(0, 0, 450, 390).data;
}
const digest = (p: Uint8ClampedArray) => createHash('sha256').update(p).digest('hex');
const variants = new Set<string>();
const renderedHeights: number[] = [];
// Include the outer object transform when selecting extremal raster tests.
const screenHeight = (seed: number) => (pineProfile(seed).height + 14) * (0.92 + (scaleJitterOf(seed) - 0.88) * 0.5);
const tallest = seeds.reduce((a, b) => (screenHeight(a) > screenHeight(b) ? a : b));
const shortest = seeds.reduce((a, b) => (screenHeight(a) < screenHeight(b) ? a : b));
const widest = seeds.reduce((a, b) => (pineProfile(a).spread > pineProfile(b).spread ? a : b));
const mostLeaning = seeds.reduce((a, b) =>
  pineProfile(a).height * pineProfile(a).lean > pineProfile(b).height * pineProfile(b).lean ? a : b,
);
for (const seed of new Set([...examples, 17, 441, 2891, 9406, tallest, shortest, widest, mostLeaning]))
  for (const g of [0.2, 1])
    for (const month of [0, 3, 8]) {
      const raw = render(seed, g, month, false),
        cached = render(seed, g, month, true);
      let total = 0,
        lost = 0,
        top = Infinity,
        bottom = -Infinity;
      for (let i = 3; i < raw.length; i += 4)
        if (raw[i] > 30) {
          total++;
          const y = Math.floor(i / 4 / 450);
          top = Math.min(top, y);
          bottom = Math.max(bottom, y);
          if (cached[i] < 2) lost++;
        }
      assert.ok(total > 100 && lost / total < 0.009, 'needle fringe and branch tips fit the cached sprite');
      // Independent large-canvas edges also catch a too-small *measurement* canvas.
      for (let x = 0; x < 450; x++) assert.ok(raw[x * 4 + 3] < 2 && raw[(389 * 450 + x) * 4 + 3] < 2);
      for (let y = 0; y < 390; y++) assert.ok(raw[y * 450 * 4 + 3] < 2 && raw[(y * 450 + 449) * 4 + 3] < 2);
      if (g === 1 && month === 8) renderedHeights.push(bottom - top);
      const warm = digest(cached);
      clearSprites();
      assert.equal(digest(render(seed, g, month, true)), warm);
      variants.add(warm);
    }
assert.ok(variants.size >= 16);
assert.ok(
  Math.max(...renderedHeights) / Math.min(...renderedHeights) > 2,
  'height variety reaches the rendered scene, not just metadata',
);
assert.ok(spriteStats().size <= 420 && spriteStats().boxes <= 600);
// Existing planted trees retain identity and positions; no new save field is needed.
const world = new World();
const saved = serializeSave(world.toJSON());
const identities = world.objects
  .filter((o) => o.type === 'pine')
  .map((o) => ({
    id: o.id,
    x: o.tx,
    y: o.ty,
    seed: o.seed,
    geometry: pineGeometry(o.seed, 1),
  }));
assert.ok(identities.length > 0);
const loaded = new World();
assert.ok(loaded.fromJSON(JSON.parse(saved)));
assert.deepEqual(
  loaded.objects
    .filter((o) => o.type === 'pine')
    .map((o) => ({
      id: o.id,
      x: o.tx,
      y: o.ty,
      seed: o.seed,
      geometry: pineGeometry(o.seed, 1),
    })),
  identities,
);
assert.equal(serializeSave(world.toJSON()), saved);

// Growth calculations and stages
const now0 = 100000000;
assert.equal(calculatePineGrowth(0, now0, false), 1, 'legacy / unspecified trees are fully mature');
assert.equal(calculatePineGrowth(-1, now0, false), 1, 'negative timestamps are fully mature');
// Normal garden (72 hours = 3 days)
assert.equal(calculatePineGrowth(now0, now0, false), 0, 'freshly planted pine in normal garden is a sapling');
assert.ok(Math.abs(calculatePineGrowth(now0, now0 + 24 * 3600 * 1000, false) - 1 / 3) < 1e-6, 'day 1 = 1/3 growth');
assert.ok(Math.abs(calculatePineGrowth(now0, now0 + 48 * 3600 * 1000, false) - 2 / 3) < 1e-6, 'day 2 = 2/3 growth');
assert.equal(calculatePineGrowth(now0, now0 + 72 * 3600 * 1000, false), 1, 'day 3 = mature pine');
assert.equal(calculatePineGrowth(now0, now0 + 96 * 3600 * 1000, false), 1, 'older pine remains mature');

// Growing garden (15 hours = 3 days at 5h/day)
assert.equal(calculatePineGrowth(now0, now0, true), 0, 'freshly planted pine in growing garden is a sapling');
assert.ok(
  Math.abs(calculatePineGrowth(now0, now0 + 5 * 3600 * 1000, true) - 1 / 3) < 1e-6,
  '5h in growing garden = 1/3 growth',
);
assert.ok(
  Math.abs(calculatePineGrowth(now0, now0 + 10 * 3600 * 1000, true) - 2 / 3) < 1e-6,
  '10h in growing garden = 2/3 growth',
);
assert.equal(calculatePineGrowth(now0, now0 + 15 * 3600 * 1000, true), 1, '15h in growing garden = mature pine');
assert.equal(calculatePineGrowth(now0, now0 + 20 * 3600 * 1000, true), 1, 'older pine remains mature');

// Stages
assert.equal(pineStage(0).id, 'sapling');
assert.equal(pineStage(0.2).id, 'sapling');
assert.equal(pineStage(0.35).id, 'young');
assert.equal(pineStage(0.5).id, 'young');
assert.equal(pineStage(0.7).id, 'maturing');
assert.equal(pineStage(0.95).id, 'maturing');
assert.equal(pineStage(1.0).id, 'adult');
assert.equal(PINE_STAGES.length, 4);

// World integration
const testWorld = new World();
const oldTree = testWorld.objects.find((o) => o.type === 'pine')!;
assert.equal(testWorld.growth(oldTree, Date.now()), 1, 'existing/preset pine is fully grown');
const maple = testWorld.place('maple', 2, 2, 0, Date.now())!;
assert.equal(testWorld.growth(maple, Date.now()), 1, 'non-pine trees look fully grown');
const newPine = testWorld.place('pine', 3, 3, 0, now0)!;
assert.equal(testWorld.growth(newPine, now0), 0, 'newly planted pine is at growth 0');
assert.ok(Math.abs(testWorld.growth(newPine, now0 + 24 * 3600 * 1000) - 1 / 3) < 1e-6);
assert.equal(testWorld.growth(newPine, now0 + 72 * 3600 * 1000), 1);

console.log('ок: все формы, крайние размеры, рост/сезоны, границы, холодный/прогретый кэш и прежние сохранения');
if (process.argv.includes('--preview')) {
  writeFileSync('preview-pine.png', cv.toBuffer('image/png'));
  if (existsSync('preview-pine-before.png')) {
    const out = createCanvas(1600, 1030),
      c = out.getContext('2d');
    c.fillStyle = '#eee9dc';
    c.fillRect(0, 0, 1600, 1030);
    c.fillStyle = '#414d3d';
    c.font = '25px sans-serif';
    c.fillText('Было: похожие ярусные силуэты', 24, 35);
    c.drawImage(await loadImage('preview-pine-before.png'), 0, 50);
    c.fillStyle = '#414d3d';
    c.fillText('Теперь: пять форм и заметный разброс высоты', 24, 552);
    c.drawImage(cv, 0, 565);
    writeFileSync('preview-pine-comparison.png', out.toBuffer('image/png'));
  }
}
