import { makeLizard } from '../src/world/lizards';
/** Accelerated sampling of 120 real-clock hours, not a claim of a 120-hour browser run. */
import assert from 'node:assert/strict';
import { createCanvas } from '@napi-rs/canvas';
import { setImmediate as yieldNative } from 'node:timers/promises';
import { growTime, GROW_MONTH_MS as H } from '../src/core/growClock';
import { computeTime } from '../src/core/clock';
import { World } from '../src/world/world';
import { Life } from '../src/world/life';
import { scanHabitat } from '../src/world/habitat';
import { ecologyYear } from '../src/world/ecology';
import { WeatherSystem } from '../src/world/weatherState';
import { buildAtmosphere } from '../src/world/palette';
import { drawCached, clearSprites, spriteFrame, spriteStats } from '../src/render/spriteCache';
import { setSkipShadows } from '../src/render/sprites';
Object.assign(globalThis, {
  document: { createElement: () => createCanvas(8, 8) },
  window: { devicePixelRatio: 1, innerWidth: 800, innerHeight: 600 },
});
const world = new World(),
  life = new Life(),
  habitat = scanHabitat(world);
const weather = new WeatherSystem();
weather.force('clear');
const summer = computeTime(new Date(2026, 6, 15, 13).getTime());
for (let i = 0; i < 320; i++) life.update(world, summer, 250, i * 250, weather.state);
assert.ok(life.flutters.length && life.wildlife.bees.length, 'live summer fixture');
const groups = () => ({
  butterflies: life.flutters,
  frogs: life.residents.frogs,
  dragonflies: life.residents.dragonflies,
  bees: life.wildlife.bees,
  fireflies: life.wildlife.fireflies,
  moths: life.wildlife.moths,
  turtle: life.wildlife.turtles,
  hedgehog: life.wildlife.hedgehogs,
  lizard: life.lizards.agents,
});
// Exercise the long-stay cases, not only fast insects which already flew away correctly.
for (const type of ['turtle', 'hedgehog', 'fireflies'] as const) life.wildlife.force(type, habitat, summer);
assert.ok(life.wildlife.turtles.length && life.wildlife.hedgehogs.length && life.wildlife.fireflies.length);
Object.assign(life.wildlife.turtles[0], { state: 'hide', timer: 1e7, hide: 1, retract: 1 });
Object.assign(life.wildlife.hedgehogs[0], { state: 'curl', timer: 1e7, curl: 1, roll: 1 });
life.residents.frogs.push({
  id: 999,
  tx: 12,
  ty: 12,
  facing: 1,
  seed: 17,
  state: 'sit',
  timer: 1e7,
  phase: 0,
  from: null,
  target: null,
  pond: 0,
  species: 'green',
  size: 1,
  throat: 0,
  hidden: 1e7,
  gone: false,
  answer: 0,
});
life.residents.dragonflies.push({
  id: 999,
  kind: 'hawker',
  tx: 12,
  ty: 12,
  alt: 10,
  vx: 0,
  vy: 0,
  facing: 1,
  seed: 17,
  state: 'perch',
  timer: 1e7,
  phase: 0,
  pond: 0,
  target: null,
  perch: null,
});
life.wildlife.moths.push({
  tx: 12,
  ty: 12,
  ax: 12,
  ay: 12,
  dir: 0,
  seed: 17,
  phase: 0,
  timer: 1e7,
  alpha: 1,
  state: 'rest',
  flutter: 0,
});
assert.ok(habitat.lizardShelters.length);
life.lizards.agents = [{ ...makeLizard(43, habitat.lizardShelters[0]), state: 'hide', timer: 1e7 }];
for (const [key, agents] of Object.entries(groups())) assert.ok(agents.length, `populated ${key}`);
const winterBird = {
  tx: 20,
  ty: 20,
  facing: 1,
  seed: 555,
  state: 'perch' as const,
  timer: 1e7,
  target: null,
  alt: 26,
  hop: 0,
  scale: 1,
  species: 'tit' as const,
  place: 'feeder' as const,
  slot: 0,
};
life.birds.push(winterBird);
const cats = life.cats.map((c) => c.id),
  fish = life.fish.map((f) => f.id);
assert.ok(cats.length && fish.length, 'year-round residents present');
const winter = computeTime(new Date(2027, 0, 15, 13).getTime());
for (let i = 0; i < 100; i++) life.update(world, winter, 50, 80000 + i * 50, weather.state);
for (const [key, agents] of Object.entries(groups()))
  assert.equal(agents.length, 0, `${key} physically retired within five seconds, not merely invisible`);
assert.deepEqual(
  life.cats.map((c) => c.id),
  cats,
);
assert.deepEqual(
  life.fish.map((f) => f.id),
  fish,
);
assert.ok(life.birds.includes(winterBird), 'winter birds are not seasonally purged');

const canvas = createCanvas(400, 340),
  ctx = canvas.getContext('2d');
const clock = { epoch: 0, month: 2026 * 12, solar: 0.25 };
const types = ['maple', 'sakura', 'willow'];
clearSprites();
let peakPixels = 0,
  peakAgents = 0;
for (let sample = 0; sample <= 720; sample++) {
  const time = growTime(clock, (sample * H) / 6),
    atm = buildAtmosphere(time);
  // Six simulated seconds at each ten-minute calendar sample: enough to finish departures.
  for (let frame = 0; frame < 24; frame++)
    life.update(world, time, 250, 90000 + sample * 6000 + frame * 250, weather.state);
  const year = ecologyYear(time.now);
  for (const [key, agents] of Object.entries(groups())) {
    if (year[key as keyof typeof year] <= 0.001)
      assert.equal(agents.length, 0, `${key} survived dormant sample ${sample}`);
  }
  const population = Object.values(groups()).reduce((sum, a) => sum + a.length, 0);
  peakAgents = Math.max(peakAgents, population);
  assert.ok(population < 100, 'no accumulating generations of hidden agents');
  assert.ok(life.takeEmitted().length <= 64);
  canvas.width = 400; // release native draw recordings instead of retaining the whole test history
  spriteFrame();
  setSkipShadows(true);
  try {
    for (const type of types)
      drawCached({
        ctx: ctx as never,
        x: 200,
        y: 260,
        atm,
        g: 1,
        obj: { id: 1, type, seed: 441, rot: 0, tx: 0, ty: 0, planted: 0 },
        time: sample * 1000,
        wind: 0.4,
        alpha: 1,
      });
  } finally {
    setSkipShadows(false);
  }
  const stats = spriteStats();
  assert.ok(stats.size <= 420 && stats.boxes <= 600);
  peakPixels = Math.max(peakPixels, stats.pixels);
  assert.ok(stats.pixels * 4 < 96 * 1024 * 1024, 'representative sprite backing pixels stay below 96 MiB');
  if (sample % 20 === 0) await yieldNative();
}
assert.ok(spriteStats().misses > 1000, 'the soak really cycled through and evicted old revisions');
const baked = spriteStats().misses;
// Previously the null/empty measurement branch bypassed the 600-entry bound.
clearSprites();
const atm = buildAtmosphere(summer);
for (let seed = 0; seed < 650; seed++) {
  drawCached({
    ctx: ctx as never,
    x: 0,
    y: 0,
    atm,
    g: 1,
    obj: { id: 1, type: 'unsupported-empty', seed, rot: 0, tx: 0, ty: 0, planted: 0 },
    time: 0,
    wind: 0,
    alpha: 1,
  });
  if (seed % 25 === 0) await yieldNative();
}
assert.equal(spriteStats().boxes, 600, 'empty measurements are bounded too');
assert.equal(spriteStats().size, 0);
clearSprites();
assert.equal(spriteStats().pixels, 0);
canvas.width = canvas.height = 1;
console.log(
  `ок: 120h sampled (10 seasonal years / 24 solar days), all nine dormant populations retire; year-round residents retained; ${baked} sprite bakes, peak ${((peakPixels * 4) / 1024 / 1024).toFixed(1)} MiB backing pixels, peak ${peakAgents} warm agents; empty cache capped at 600`,
);
