/** Travelling wind, anchored wood, material delays, shared reflections, no cache/history accumulation. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { createCanvas } from '@napi-rs/canvas';
import { setImmediate as yieldNative } from 'node:timers/promises';
import { windFronts, makeWindSampler, WIND_PERIOD, CALM } from '../src/world/wind';
import { plantPose, windLag, windOffset, pendantSwing } from '../src/render/plantWind';
import {
  clearSprites,
  drawCached,
  drawCachedReflection,
  spriteStats,
  paintObjectLight,
} from '../src/render/spriteCache';
import { drawObject, setSkipShadows } from '../src/render/sprites';
import { Life } from '../src/world/life';
import { World } from '../src/world/world';
import { buildLocalLights, sampleLocalLight } from '../src/render/localLight';
import { Scene } from '../src/render/scene';
import { drawObjects } from '../src/render/scene-steps';
import { computeTime } from '../src/core/clock';
import { buildAtmosphere } from '../src/world/palette';
import { Weather } from '../src/render/weather';
import { WaterFlow } from '../src/world/waterFlow';
import { makeWaterMotion } from '../src/render/waterMotion';
Object.assign(globalThis, {
  document: { createElement: () => createCanvas(8, 8) },
  window: { devicePixelRatio: 1, innerWidth: 1120, innerHeight: 580 },
});
const time = computeTime(new Date(2026, 6, 15, 13).getTime()),
  atm = buildAtmosphere(time);
// Including fronts approaching from negative coordinate projections (previously missed half the garden).
for (let cycle = 0; cycle < 12; cycle++) {
  const maxima = [0, 0, 0, 0];
  for (let ms = 0; ms < WIND_PERIOD; ms += 200) {
    const sampler = makeWindSampler(cycle * WIND_PERIOD + ms);
    [
      [0, 0],
      [26, 0],
      [0, 26],
      [26, 26],
    ].forEach(([x, y], i) => (maxima[i] = Math.max(maxima[i], sampler(x, y).strength)));
    assert.ok(windFronts(cycle * WIND_PERIOD + ms).length <= 2);
  }
  assert.ok(
    maxima.every((v) => v > 0.6),
    'front traverses all corners regardless of direction',
  );
  assert.equal(makeWindSampler(cycle * WIND_PERIOD + 46000)(13, 13).strength, 0, 'real lull between fronts');
}
const peaks: number[] = [];
for (const [x, y] of [
  [6, 20],
  [10, 16],
  [14, 12],
  [18, 8],
]) {
  let peak = 0,
    best = 0;
  for (let ms = 5000; ms < 35000; ms += 100) {
    const s = makeWindSampler(4 * WIND_PERIOD + ms)(x, y).strength;
    if (s > best) {
      best = s;
      peak = ms;
    }
  }
  peaks.push(peak);
}
assert.ok(
  peaks.every((p, i) => !i || p > peaks[i - 1] + 1000),
  'not a synchronous garden-wide oscillator',
);
assert.deepEqual(
  makeWindSampler(20000)(13, 13, 800),
  makeWindSampler(19200)(13, 13),
  'lag samples the same field at its earlier time',
);
const fpsSamples = [];
for (const fps of [30, 60, 144]) {
  const life = new Life();
  for (let i = 0; i < 20 * fps; i++) (life as any).updateWind(1000 / fps, time);
  fpsSamples.push(life.windVectorAt(13, 13, 650));
  const before = life.windTime;
  (life as any).updateWind(NaN, time);
  assert.equal(life.windTime, before);
}
for (const sample of fpsSamples)
  assert.ok(Math.abs(sample.screenX - fpsSamples[0].screenX) < 1e-8, 'FPS-independent pressure');
const air = { x: 1, y: -1, strength: Math.SQRT2, screenX: 1, screenY: 0 };
assert.ok(windLag('pine') > windLag('bamboo') && windLag('bamboo') > windLag('grass_tuft'));
assert.ok(
  Math.abs(plantPose('pine', 441, 1, 20000, air)!.slope) < Math.abs(plantPose('willow', 441, 1, 20000, air)!.slope),
);
for (const type of ['maple', 'willow', 'pine', 'bamboo', 'yuzu', 'grass_tuft']) {
  assert.equal(windOffset(plantPose(type, 441, 1, 20000, air), 0), 0, 'no translation of roots');
  assert.equal(windOffset(plantPose(type, 441, 1, 20000, CALM), 150), 0);
  assert.equal(plantPose(type, 441, 1, 20000, air, true)!.hinge, 0, 'light mode uses one anchored copy');
}
assert.equal(plantPose('wisteria', 441, 1, 20000, air), undefined, 'pergola timber never bends');
assert.equal(plantPose('rock_mid', 441, 1, 20000, air), undefined);
for (const ms of [0, 800, 12000, 24000])
  assert.equal(pendantSwing(CALM, 441, ms, 4), 0, 'no amplitude floor on calm pendants');
const cv = createCanvas(380, 330),
  ctx = cv.getContext('2d');
const hash = (data: Uint8ClampedArray) => createHash('sha256').update(data).digest('hex');
const d = {
  ctx: ctx as never,
  x: 190,
  y: 270,
  atm,
  g: 1,
  obj: { id: 1, type: 'maple', seed: 441, rot: 0, tx: 12, ty: 12, planted: 0 },
  time: 20000,
  wind: 0,
  windVector: air,
  alpha: 1,
};
function render(force: number, cached = true) {
  cv.width = 380;
  const pose = plantPose('maple', 441, 1, 20000, { ...air, screenX: force })!;
  setSkipShadows(true);
  try {
    if (cached) drawCached({ ...d, plantPose: pose });
    else drawObject({ ...d, plantPose: pose });
  } finally {
    setSkipShadows(false);
  }
  return hash(ctx.getImageData(0, 225, 380, 105).data);
}
clearSprites();
const root = render(0);
const still = hash(ctx.getImageData(0, 0, 380, 330).data);
assert.equal(render(1), root, 'lower trunk pixels are stationary, not merely its anchor');
assert.notEqual(hash(ctx.getImageData(0, 0, 380, 330).data), still, 'crown actually moves');
function zoomedRoot(force: number) {
  cv.width = 380;
  ctx.setTransform(1.1, 0, 0, 1.1, 0.27, 0.83);
  drawCached({ ...d, plantPose: plantPose('maple', 441, 1, 20000, { ...air, screenX: force }) });
  return hash(ctx.getImageData(0, 265, 380, 65).data);
}
assert.equal(zoomedRoot(1), zoomedRoot(0), 'same pixel-snapped root when a gust begins at fractional zoom');
const misses = spriteStats().misses;
for (let i = 0; i < 100; i++) {
  render(Math.sin(i * 0.07));
  if (i % 20 === 0) await yieldNative();
}
assert.equal(spriteStats().misses, misses, 'wind is never baked into the sprite key');
render(1, false);
const directRoot = hash(ctx.getImageData(0, 235, 380, 95).data);
render(0, false);
assert.equal(
  hash(ctx.getImageData(0, 235, 380, 95).data),
  directRoot,
  'uncached basal wood fixed (outside the hinge antialiasing band)',
);
// Shared deformation changes the reflection without drawing a different seasonal tree.
function reflect(force: number) {
  cv.width = 380;
  drawCachedReflection(
    {
      ...d,
      y: 60,
      plantPose: plantPose('maple', 441, 1, 20000, { ...air, screenX: force }),
      reflectionWarp: () => ({ dx: 0, dy: 0, alpha: 1 }),
    },
    1,
  );
  return hash(ctx.getImageData(0, 0, 380, 330).data);
}
assert.notEqual(reflect(1), reflect(0));
assert.equal(spriteStats().misses, misses);
const world = new World(),
  flow = new WaterFlow();
flow.ensure(world);
const calmWater = makeWaterMotion(world, flow, 1000, 0, [], () => CALM),
  windWater = makeWaterMotion(world, flow, 1000, 0, [], () => air);
assert.ok(windWater(0, 600, 0).dx > calmWater(0, 600, 0).dx, 'same direction reaches water/refraction');
const weather = new Weather();
weather.resize(600, 500);
weather.emitAt(300, 100, 'leaf', 441, 96, { x: 13, y: 13 });
const start = (weather as any).particles[0].x;
for (let i = 0; i < 30; i++) weather.update(16, atm, () => ({ ...air, screenX: -1 }));
assert.ok((weather as any).particles[0].x < start, 'leaves follow leftward wind, not a permanent rightward drift');
// The lamp mask must follow the bent crown, including transparent silhouette edges.
world.objects = [];
for (const tile of world.tiles)
  Object.assign(tile, { ground: 'grass', water: false, level: 0, indoor: false, veranda: false });
world.place('lantern_paper', 5, 5);
const tree = world.place('maple', 6, 5)!;
tree.seed = 441;
const night = buildAtmosphere(computeTime(new Date(2026, 6, 15, 23).getTime()));
const lights = buildLocalLights(world, night, 20000),
  hits = sampleLocalLight(lights, 6.5, 5.5, 0, tree.id);
assert.ok(hits.length);
for (const force of [0, 1, -1]) {
  cv.width = 380;
  ctx.translate(134, -66);
  const lit = {
    ...d,
    obj: tree,
    atm: night,
    x: 56,
    y: 336,
    plantPose: plantPose('maple', 441, 1, 20000, { ...air, screenX: force }),
  };
  drawCached(lit);
  const before = ctx.getImageData(0, 0, 380, 330).data;
  paintObjectLight(lit, hits);
  const after = ctx.getImageData(0, 0, 380, 330).data;
  let gain = 0;
  for (let i = 0; i < before.length; i += 4) {
    if (before[i + 3] === 0) assert.equal(after[i + 3], 0, 'no stationary glowing crown outside the bent tree');
    gain += after[i] + after[i + 1] + after[i + 2] - before[i] - before[i + 1] - before[i + 2];
  }
  assert.ok(gain > 1000, 'wind-lit crown positive control');
}
function objectFrame(windy: boolean, motion: boolean, simpleWind: boolean) {
  cv.width = 380;
  ctx.translate(134, -66);
  drawObjects(ctx as never, world, atm, 20000, {
    life: null,
    wind: 0,
    zoom: 1,
    camX: 56,
    camY: 231,
    viewW: 380,
    viewH: 330,
    movingId: -1,
    highlightId: -1,
    useSpriteCache: true,
    particles: false,
    motion,
    simpleWind,
    windField: () => (windy ? air : CALM),
  });
  return hash(ctx.getImageData(0, 0, 380, 330).data);
}
for (const simple of [false, true]) {
  assert.equal(
    objectFrame(true, false, simple),
    objectFrame(false, false, simple),
    'motion setting stops field-driven plants and pendants',
  );
  assert.notEqual(
    objectFrame(true, true, simple),
    objectFrame(false, true, simple),
    'both detailed and light paths genuinely respond to local pressure',
  );
}
const saved = JSON.stringify(world.toJSON()),
  life = new Life();
for (let i = 0; i < 10000; i++) {
  (life as any).updateWind(10000, time);
  assert.ok(life.gusts.length <= 2);
}
assert.equal(JSON.stringify(world.toJSON()), saved);
assert.ok(spriteStats().size <= 420 && spriteStats().boxes <= 600);
console.log(
  'ок: all wind directions/corners, travelling peaks and true lulls, 30/60/144Hz parity, species inertia, rooted cached/direct silhouettes, live reflections/water/leaves, no wind rebakes and bounded 27-hour front evaluation',
);
if (process.argv.includes('--preview')) {
  const garden = new World();
  garden.objects = [];
  for (const tile of garden.tiles)
    Object.assign(tile, { ground: 'grass', water: false, level: 0, indoor: false, veranda: false });
  for (const [type, x, y] of [
    ['bamboo', 10, 16],
    ['willow', 12, 14],
    ['maple', 14, 12],
    ['pine', 16, 10],
  ] as const) {
    const tree = garden.place(type, x, y)!;
    tree.seed = 441;
  }
  for (let x = 6; x < 22; x++) for (let y = 5; y < 23; y++) if (x + y > 27 && x + y < 31) garden.at(x, y)!.water = true;
  for (const [x, y] of [
    [8, 18],
    [12, 14],
    [16, 10],
    [20, 6],
  ])
    garden.place('grass_tuft', x, y);
  garden.place('wind_chime', 12, 14);
  const preview = createCanvas(1120, 580);
  Object.assign(preview, { clientWidth: 1120, clientHeight: 580 });
  const scene = new Scene(preview as never);
  scene.setQuality('balanced');
  scene.camera.zoom = 1.3;
  scene.centerOn(13, 13);
  scene.camera.y -= 20;
  scene.particles = false;
  const directory = '/home/user/.cache/wind-frames';
  mkdirSync(directory, { recursive: true });
  for (let i = 0; i < 72; i++) {
    preview.width = 1120;
    const now = 4 * WIND_PERIOD + 7000 + i * 400;
    scene.render(garden, atm, now, 16);
    const c = preview.getContext('2d');
    c.fillStyle = 'rgba(239,235,218,.94)';
    c.fillRect(0, 0, 1120, 44);
    c.fillStyle = '#514b40';
    c.font = '21px sans-serif';
    c.fillText('Общий ветер · бамбук, ива, клён, сосна · ускоренное превью ×4', 20, 29);
    writeFileSync(`${directory}/${String(i).padStart(3, '0')}.png`, preview.toBuffer('image/png'));
    if (i === 34) writeFileSync('preview-wind.png', preview.toBuffer('image/png'));
    await yieldNative();
  }
}
