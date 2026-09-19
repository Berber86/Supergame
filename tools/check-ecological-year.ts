import { GardenAudio } from '../src/audio/audio';
import { Wildlife } from '../src/world/wildlife';
/** Reproduce the March report across model, live agents, render/reflections, particles and catalogue. */
import assert from 'node:assert/strict';
import { createCanvas } from '@napi-rs/canvas';
import { writeFileSync } from 'node:fs';
import { setImmediate as yieldNative } from 'node:timers/promises';
import { computeTime, DAY_MS } from '../src/core/clock';
import { makeRng } from '../src/core/rng';
import {
  ecologyYear,
  wildlifeActivity,
  treeFallActivity,
  ecologyDescription,
  liquidExposure,
} from '../src/world/ecology';
import { flowerYear } from '../src/world/annualEnvironment';
import { plantYear } from '../src/world/phenology';
import { buildAtmosphere } from '../src/world/palette';
import { World } from '../src/world/world';
import { Life } from '../src/world/life';
import { scanHabitat, floweringHabitat, invitations } from '../src/world/habitat';
import { WeatherSystem } from '../src/world/weatherState';
import { Weather } from '../src/render/weather';
import { drawObjects, drawAnimalReflections, type ObjectsOpts } from '../src/render/scene-steps';
import { itemIcon, clearIconCache } from '../src/ui/icons';
import { Scene } from '../src/render/scene';

Object.assign(globalThis, {
  document: { createElement: () => createCanvas(8, 8) },
  window: { devicePixelRatio: 1, innerWidth: 1200, innerHeight: 850 },
});
Math.random = makeRng(3015);
const date = (m: number, d = 15, h = 13, y = 2026) => new Date(y, m, d, h).getTime();
const time = (m: number, d = 15, h = 13) => computeTime(date(m, d, h));
const weather = new WeatherSystem();
weather.force('clear');
const clear = weather.state;
let previous = ecologyYear(date(0, 1));
for (let now = date(0, 1); now < date(0, 1, 13, 2027); now += DAY_MS / 4) {
  const year = ecologyYear(now);
  for (const key of Object.keys(year) as (keyof typeof year)[]) {
    assert.ok(year[key] >= 0 && year[key] <= 1);
    assert.ok(Math.abs(year[key] - previous[key]) < 0.025, `${key}: continuous across calendar boundaries`);
  }
  previous = year;
}
const garden = new World(),
  habitat = scanHabitat(garden);
for (const day of [1, 15, 31]) {
  for (const hour of [11, 23]) {
    const t = time(2, day, hour),
      active = wildlifeActivity(t, clear);
    for (const key of [
      'butterflies',
      'bees',
      'dragonflies',
      'fireflies',
      'moths',
      'frogs',
      'turtle',
      'hedgehog',
    ] as const)
      assert.equal(active[key], 0, `March ${day}: no ${key}`);
    const inv = invitations(habitat, t, clear);
    for (const key of ['bees', 'dragonflies', 'fireflies', 'moths', 'frogs', 'turtle', 'hedgehog', 'chorus'] as const)
      assert.equal(inv[key], 0);
    assert.equal(buildAtmosphere(t).fireflies, 0);
    assert.ok(!ecologyDescription(t.now).includes('лепестки'));
  }
  assert.ok(ecologyYear(date(2, day)).green < 0.3);
}
const march = buildAtmosphere(time(2)),
  april = buildAtmosphere(time(3));
assert.ok(march.palette.grass.g < march.palette.grass.r, 'March grass is last-year straw, not a green lawn');
assert.ok(march.palette.moss.g - march.palette.moss.r < 5, 'background moss is subdued olive, not a spring lawn');
assert.ok(april.palette.grass.g > april.palette.grass.r, 'mid-April retains its fresh anchor');
for (const type of ['lily', 'iris', 'azalea', 'lotus', 'wildflowers'])
  assert.equal(flowerYear(type, 17, date(2)).bloom, 0);
assert.equal(flowerYear('lotus', 17, date(2)).foliage, 0);
assert.equal(plantYear('sakura', 17, date(2)).bloom, 0);
assert.ok(plantYear('sakura', 17, date(3)).bloom > 0.9);
assert.ok(flowerYear('camellia', 17, date(0)).bloom > 0.5, 'winter-flowering species not globally disabled');
for (const type of ['sakura', 'maple', 'ginkgo', 'willow'])
  assert.deepEqual(treeFallActivity(type, 17, date(2)), { petals: 0, leaves: 0 });
assert.ok(treeFallActivity('sakura', 17, date(4, 1)).petals > 0);
const summer = wildlifeActivity(time(6), clear);
assert.equal(summer.bees, 1);
assert.equal(summer.butterflies, 1);
for (const wx of [
  { ...clear, rain: 1, kind: 'storm' as const },
  { ...clear, snow: 1 },
]) {
  const active = wildlifeActivity(time(6), wx);
  assert.equal(active.bees, 0);
  assert.equal(active.butterflies, 0);
  assert.equal(active.dragonflies, 0);
}
assert.equal(wildlifeActivity(time(6), clear, 2).bees, 0);
assert.equal(wildlifeActivity(time(6, 15, 23), clear).bees, 0);
assert.ok(wildlifeActivity(time(6, 15, 23), clear).fireflies > 0.9);
assert.equal(wildlifeActivity(time(10), clear).butterflies, 0);

const planted = new World();
planted.objects = [];
for (const tile of planted.tiles)
  Object.assign(tile, { ground: 'soil', level: 0, water: false, indoor: false, veranda: false });
assert.ok(planted.place('beehive', 8, 8, 0));
assert.ok(planted.place('fern', 10, 10, 0));
assert.equal(invitations(scanHabitat(planted), time(6), clear).bees, 0, 'a hive or fern is not nectar');
assert.ok(planted.place('iris', 12, 12, 0));
const sites = scanHabitat(planted);
assert.equal(floweringHabitat(sites, date(2)).beeSpots.length, 0);
assert.equal(floweringHabitat(sites, date(4)).beeSpots.length, 1);
assert.equal(floweringHabitat(sites, date(6)).beeSpots.length, 0, 'finished flowers no longer feed bees');
assert.equal(invitations(sites, time(6), clear).bees, 0);
assert.ok(invitations(sites, time(4), clear).bees > 0);
assert.equal(floweringHabitat(sites, date(4)), floweringHabitat(sites, date(4) + 10), 'bounded habitat cache');

// Populate a real summer scene, then jump directly to March, including render BEFORE the next agent tick.
const life = new Life();
for (let i = 0; i < 320; i++) life.update(garden, time(6), 250, i * 250, clear);
assert.ok(life.flutters.length > 0 && life.wildlife.bees.length > 0, 'fixture genuinely has summer insects');
const bugs = new Life();
bugs.flutters = [{ ...life.flutters[0], tx: 12, ty: 12, alt: 12 }];
bugs.wildlife.bees = [{ ...life.wildlife.bees[0], tx: 12, ty: 12, alt: 12, alpha: 1 }];
const pond = new World();
pond.objects = [];
for (const tile of pond.tiles)
  Object.assign(tile, { ground: 'moss', level: 0, water: true, indoor: false, veranda: false });
const cv = createCanvas(420, 360),
  ctx = cv.getContext('2d');
const opts: ObjectsOpts = {
  life: bugs,
  wind: 0,
  zoom: 1,
  camX: 0,
  camY: 680,
  viewW: 420,
  viewH: 360,
  movingId: -1,
  highlightId: -1,
  useSpriteCache: true,
  particles: true,
  rainWeather: clear,
};
const mass = () => {
  const pixels = ctx.getImageData(0, 0, 420, 360).data;
  let sum = 0;
  for (let i = 3; i < pixels.length; i += 4) sum += pixels[i];
  return sum;
};
for (const draw of [drawObjects, drawAnimalReflections]) {
  cv.width = 420;
  ctx.translate(210, -500);
  draw(ctx as never, pond, buildAtmosphere(time(6)), 2000, opts);
  assert.ok(mass() > 0, 'summer body/reflection is actually painted');
  cv.width = 420;
  ctx.translate(210, -500);
  draw(ctx as never, pond, march, 2000, opts);
  assert.equal(mass(), 0, 'summer insects and their reflections do not survive a March jump');
}
for (let i = 0; i < 20; i++) life.update(garden, time(2), 250, 80000 + i * 250, clear);
assert.equal(life.flutters.length, 0);
assert.equal(life.wildlife.bees.length, 0);
assert.equal(life.takeEmitted().filter((e) => e.kind === 'petal').length, 0);

// The whole Scene must forward weather to BOTH passes, not only to visible bodies.
cv.width = 420;
Object.assign(cv, { clientWidth: 420, clientHeight: 360 });
const stormScene = new Scene(cv as never);
stormScene.centerOn(12, 12);
stormScene.camera.zoom = 1;
stormScene.weatherState = { ...clear, rain: 1, kind: 'storm', overcast: 1 };
// Freeze independent raindrop motion, not the weather input or animal rendering.
(stormScene as unknown as { rain: { update: () => void } }).rain.update = () => {};
stormScene.life = bugs;
stormScene.render(pond, buildAtmosphere(time(6), 1), 2000, 0);
stormScene.render(pond, buildAtmosphere(time(6), 1), 2000, 0);
const withBugs = Buffer.from(ctx.getImageData(0, 0, 420, 360).data);
stormScene.life = null;
stormScene.render(pond, buildAtmosphere(time(6), 1), 2000, 0);
assert.ok(
  withBugs.equals(Buffer.from(ctx.getImageData(0, 0, 420, 360).data)),
  'no ghost insect reflections in a storm',
);
const dwindling = new Wildlife();
dwindling.bees = Array.from({ length: 4 }, (_, i) => ({ ...bugs.wildlife.bees[0], seed: i }));
const inv = { ...invitations(habitat, time(6), clear), bees: 1 };
for (let i = 0; i < 14; i++) dwindling.update(habitat, inv, time(6), clear, 250, i * 250, []);
assert.equal(dwindling.bees.length, 1, 'surplus bees retire without waiting for zero population');

// Observe audio gain requests, without a sound device or synthetic recordings.
const audio = new GardenAudio();
let buzz = -1,
  rustle = -1;
Object.assign(audio, {
  ctx: {},
  enabled: true,
  insectTimer: 1e9,
  birdTimer: 1e9,
  frogTimer: 1e9,
  insectSlider: {
    to: (value: number) => {
      buzz = value;
    },
  },
  leaves: {
    slider: {
      to: (value: number) => {
        rustle = value;
      },
    },
    filter: { frequency: { value: 0 } },
  },
});
const sound = { wind: 0.5, trees: 10, waterNearby: 0, hasChime: false, hasShishi: false, catNear: false, foliage: 0.2 };
audio.update(400, time(2), clear, sound);
assert.equal(buzz, 0);
const bareRustle = rustle;
audio.update(400, time(6), clear, { ...sound, foliage: 1 });
assert.ok(buzz > 0 && rustle > bareRustle);
audio.update(400, time(2, 15, 23), clear, sound);
assert.equal(buzz, 0);
audio.update(400, time(6), { ...clear, snow: 1 }, sound);
assert.equal(buzz, 0);

const particles = new Weather();
particles.resize(420, 360);
cv.width = 420;
particles.update(1000, buildAtmosphere(time(0)));
particles.draw(ctx as never, buildAtmosphere(time(0)));
assert.equal(mass(), 0, 'snow cover does not generate snowfall in clear weather');
particles.emitAt(200, 100, 'petal', 17);
particles.update(16, april); // calendar jump flushes stale particles
particles.emitAt(200, 100, 'petal', 17);
cv.width = 420;
particles.draw(ctx as never, april);
assert.ok(mass() > 0);
particles.update(16, march);
cv.width = 420;
particles.draw(ctx as never, march);
assert.equal(mass(), 0, 'old petals cleared on scrubbing');
assert.ok(liquidExposure(date(11, 1)) > 0, 'wet surfaces not disabled by December label');
assert.equal(liquidExposure(date(0)), 0);
const wx = new WeatherSystem();
wx.force('rain');
for (let i = 0; i < 20; i++) wx.update(1000, time(11, 1));
assert.ok(wx.state.wetness > 0, 'early winter rain is not discarded');
wx.update(1000, time(0));
assert.equal(wx.state.wetness, 0);
wx.force('snow');
for (let i = 0; i < 20; i++) wx.update(1000, time(6));
assert.equal(wx.state.snow, 1, 'explicit weather remains available');
wx.force('auto');
wx.update(10000, time(6));
assert.equal(wx.state.snow, 0, 'AUTO does not retain July snow after a date change');

clearIconCache();
const early = itemIcon('sakura', march),
  bloom = itemIcon('sakura', april);
assert.notEqual(early, bloom, 'catalogue updates within one calendar season');
assert.equal(itemIcon('sakura', march), early, 'icon cache history is deterministic');
clearIconCache();
assert.equal(itemIcon('sakura', march), early);
console.log(
  'ок: March/April contrast, continuous year, nectar not hives, warm/cold/night/rain/wind wildlife, live summer→March cleanup, body/reflection parity, particles, freeze/thaw, icons and weather overrides',
);
if (process.argv.includes('--preview')) {
  const canvas = createCanvas(1200, 850);
  Object.assign(canvas, { clientWidth: 1200, clientHeight: 850 });
  const scene = new Scene(canvas as never);
  scene.camera.zoom = 1.02;
  scene.centerOn(11.5, 12);
  scene.particles = true;
  const previewSave = new World().toJSON();
  for (const [name, month, day] of [
    ['march-early', 2, 1],
    ['march', 2, 15],
    ['march-late', 2, 31],
    ['april', 3, 15],
    ['may', 4, 15],
    ['summer', 6, 15],
    ['november', 10, 15],
  ] as const) {
    const w = new World(),
      actors = new Life(),
      t = time(month, day);
    w.applySave(previewSave);
    for (let i = 0; i < 160; i++) actors.update(w, t, 250, i * 250, clear);
    scene.life = actors;
    const saved = JSON.stringify(w.toJSON());
    scene.render(w, buildAtmosphere(t), 40000, 16);
    assert.equal(JSON.stringify(w.toJSON()), saved);
    writeFileSync(`preview-ecology-${name}.png`, canvas.toBuffer('image/png'));
    await yieldNative();
  }
}
