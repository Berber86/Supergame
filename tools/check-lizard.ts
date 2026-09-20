/** Real visitors, real routes, four coats and the same animated renderer in the guide and garden. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { createCanvas } from '@napi-rs/canvas';
import { setImmediate as yieldNative } from 'node:timers/promises';
import { computeTime, DAY_MS } from '../src/core/clock';
import { newGrowState } from '../src/world/grow';
import { World } from '../src/world/world';
import { Life, type Flutter } from '../src/world/life';
import { scanHabitat, invitations, sunnyLizardSpots } from '../src/world/habitat';
import { wildlifeActivity, ecologyYear } from '../src/world/ecology';
import { WeatherSystem } from '../src/world/weatherState';
import { Lizards, makeLizard, lizardGround, lizardRoute, lizardCoat, type LizardState } from '../src/world/lizards';
import { buildAtmosphere } from '../src/world/palette';
import { drawLizard } from '../src/render/lizard';
import { drawObjects, drawAnimalReflections, type ObjectsOpts } from '../src/render/scene-steps';
import { Scene } from '../src/render/scene';
import { GUIDE_ANIMALS } from '../src/ui/animalGuideData';
import { parseSave, serializeSave } from '../src/world/saveFormat';
Object.assign(globalThis, {
  document: { createElement: () => createCanvas(8, 8) },
  window: { devicePixelRatio: 1, innerWidth: 900, innerHeight: 650 },
});
const date = (m: number, h = 11, d = 15, y = 2026) => new Date(y, m, d, h).getTime();
const summer = computeTime(date(6)),
  weather = new WeatherSystem();
weather.force('clear');
const clear = weather.state;
const world = new World();
world.objects = [];
for (const t of world.tiles)
  Object.assign(t, { water: false, indoor: false, veranda: false, ground: 'soil', level: 0 });
world.place('rock_mid', 9, 9);
world.place('rock_mid', 11, 9);
world.place('rock_mid', 9, 11);
world.place('azalea', 12, 11);
const h = scanHabitat(world),
  inv = invitations(h, summer, clear);
assert.equal(inv.lizard, 3);
assert.equal(h.lizardSpots.length, 3);
assert.ok(h.lizardShelters.length >= 4);
assert.equal(sunnyLizardSpots({ ...h, trees: [...h.lizardSpots] }).length, 0);
assert.equal(invitations({ ...h, trees: [...h.lizardSpots] }, summer, clear).lizard, 0);
for (const t of [
  computeTime(date(0)),
  computeTime(date(2)),
  computeTime(date(6, 23)),
  computeTime(date(6, 6)),
  computeTime(date(11)),
]) {
  assert.equal(invitations(h, t, clear).lizard, 0);
  assert.equal(wildlifeActivity(t, clear).lizard, 0);
}
for (const wx of [
  { ...clear, rain: 1 },
  { ...clear, snow: 1 },
])
  assert.equal(invitations(h, summer, wx).lizard, 0);
let last = 0;
for (let now = date(0, 12, 1); now < date(0, 12, 1, 2027); now += DAY_MS / 4) {
  const value = ecologyYear(now).lizard;
  assert.ok(Math.abs(value - last) < 0.03);
  last = value;
}
const pop = new Lizards();
for (let i = 0; i < 1200; i++) pop.update(world, h, inv, summer, 100, [], [], []);
assert.ok(pop.agents.length > 0 && pop.agents.length <= 3, 'visitors actually spawn');
assert.ok(world.hasEvent('meet_lizard') && world.milestones.has('lizard_guest'));
assert.ok(parseSave(JSON.parse(serializeSave(world.toJSON())))?.chronicle?.some((e) => e.id === 'meet_lizard'));
for (const a of pop.agents) assert.ok(lizardGround(world, a.tx, a.ty));
const night = computeTime(date(6, 23));
for (let i = 0; i < 50; i++) pop.update(world, h, invitations(h, night, clear), night, 100, [], [], []);
assert.equal(pop.agents.length, 0, 'no permanent invisible animals at night');
pop.reset();
assert.equal(pop.agents.length, 0);
// A stationary arrival on its own stone must continue climbing to the surface, not freeze 1px above ground.
const perched = makeLizard(40, h.lizardSpots[0]);
perched.state = 'walk';
perched.alpha = 1;
perched.target = h.lizardSpots[0];
pop.agents = [perched];
for (let i = 0; i < 25; i++) pop.update(world, h, { ...inv, lizard: 1 }, summer, 100, [], [], []);
assert.ok(
  Math.abs(perched.lift - h.lizardSpots[0].lift!) < 0.8 && perched.lift > 5,
  'climbs to this seeded rock surface, not a universal 18px height',
);
// A live edit changes the support plane; a resting animal follows it instead of hovering.
const supportHeight = h.lizardSpots[0].lift!;
const raised = { ...h, lizardSpots: h.lizardSpots.map((p, i) => (i ? p : { ...p, lift: supportHeight + 6 })) };
perched.timer = 50000;
perched.hunger = 50000;
for (let i = 0; i < 20; i++) pop.update(world, raised, { ...inv, lizard: 1 }, summer, 100, [], [], []);
assert.ok(Math.abs(perched.lift - supportHeight - 6) < 0.8);
const removed = { ...h, lizardSpots: h.lizardSpots.slice(1) };
for (let i = 0; i < 20; i++) pop.update(world, removed, { ...inv, lizard: 1 }, summer, 100, [], [], []);
assert.ok(perched.lift < 0.8, 'removing the support settles the animal onto the ground');
// Cat/ground-bird threat -> flee -> hidden, with a finite retirement in winter even while hidden.
pop.update(world, h, inv, summer, 50, [{ x: perched.tx + 0.1, y: perched.ty, r: 2.1 }], [], []);
assert.ok(['flee', 'hide'].includes(perched.state));
for (let i = 0; i < 100; i++) pop.update(world, h, { ...inv, lizard: 0 }, summer, 50, [], [], []);
assert.equal(pop.agents.length, 0);
// Path safety: no cutting across ponds, rooms, veranda, cliffs or grow fog.
const a = { x: 9.5, y: 9.5 },
  b = { x: 11.5, y: 9.5 },
  tile = world.at(10, 9)!;
assert.ok(lizardRoute(world, a, b));
for (const change of [{ water: true }, { indoor: true }, { veranda: true }, { level: 1 }]) {
  Object.assign(tile, change);
  assert.equal(lizardRoute(world, a, b), false);
  Object.assign(tile, { water: false, indoor: false, veranda: false, level: 0 });
}
world.grow = newGrowState(17, Date.now());
world.grow.rect = { x: 9, y: 9, w: 2, h: 2 };
assert.equal(lizardRoute(world, a, b), false);
assert.equal(scanHabitat(world, world.grow.rect).lizardSpots.length, 1);
world.grow = null;
// Constant speed and distance-driven gait, independent of a 20 vs 100 ms update cadence.
function move(dt: number) {
  const p = new Lizards(),
    l = makeLizard(41, { x: 2, y: 2 });
  Object.assign(l, { state: 'walk', target: { x: 20, y: 2 }, timer: 1e6, duration: 1e6, alpha: 1 });
  p.agents = [l];
  for (let ms = 0; ms < 4000; ms += dt) p.update(world, h, { ...inv, lizard: 1 }, summer, dt, [], [], []);
  return l;
}
const slow = move(100),
  fast = move(20);
assert.ok(Math.abs(slow.tx - fast.tx) < 1e-8 && Math.abs(slow.gait - fast.gait) < 1e-8);
// A resting butterfly can be caught; an escaping butterfly cannot be magically eaten.
function hunt(escapes: boolean) {
  const p = new Lizards(),
    l = makeLizard(42, { x: 9.5, y: 9.5 });
  Object.assign(l, { state: 'bask', timer: 0, hunger: 0, alpha: 1 });
  p.agents = [l];
  const prey: Flutter = {
    tx: 9.7,
    ty: 9.5,
    alt: 2,
    vx: 0,
    vy: 0,
    valt: 0,
    target: null,
    timer: 5000,
    seed: 7,
    phase: 0,
    resting: 5000,
  };
  const bugs = [prey];
  p.update(world, h, { ...inv, lizard: 1 }, summer, 50, [], bugs, []);
  assert.equal(l.state, 'hunt');
  if (escapes) prey.resting = 0;
  for (let i = 0; i < 25; i++) p.update(world, h, { ...inv, lizard: 1 }, summer, 50, [], bugs, []);
  assert.equal(bugs.length, escapes ? 1 : 0);
  assert.equal(l.catches, escapes ? 0 : 1);
}
hunt(false);
hunt(true);
assert.ok(world.hasEvent('lizard_hunt'));
// Occupied sites are avoided at birth, not just when choosing the next warm stone.
const crowded = new Lizards();
for (let i = 0; i < 700; i++) crowded.update(world, h, inv, summer, 100, [], [], h.lizardShelters);
assert.equal(crowded.agents.length, 0);
// Real Life integration: cats notice a skink, and a small garden doesn't accumulate generations.
world.place('cat', 7, 9);
const life = new Life();
life.sync(world);
const cat = life.cats[0];
cat.state = 'sit';
cat.timer = 1e6;
cat.greet = 0;
const skink = makeLizard(43, { x: cat.tx + 2.5, y: cat.ty });
Object.assign(skink, { alpha: 1, state: 'bask', timer: 1e6 });
life.lizards.agents = [skink];
for (let i = 0; i < 150; i++) life.update(world, summer, 100, i * 100, clear);
assert.ok(world.hasEvent('cat_lizard'), 'cat behaviour really responds, not only the guide text');
for (let year = 0; year < 6; year++) {
  for (const month of [4, 6, 8, 10, 0]) {
    const t = computeTime(date(month));
    for (let i = 0; i < 240; i++) life.update(world, t, 100, (year * 1200 + i) * 100, clear);
    assert.ok(life.lizards.agents.length <= 3);
    if (ecologyYear(t.now).lizard === 0) assert.equal(life.lizards.agents.length, 0);
  }
  await yieldNative();
}
life.reset();
assert.equal(life.lizards.agents.length, 0);
// Procedural raster: distinct coats and moving limbs/tail, no offscreen buffers or context leaks.
const canvas = createCanvas(520, 280),
  ctx = canvas.getContext('2d'),
  atm = buildAtmosphere(summer);
const digest = () =>
  createHash('sha256')
    .update(ctx.getImageData(0, 0, 520, 280).data)
    .digest('hex');
function render(seed: number, state: LizardState, time: number) {
  canvas.width = 520;
  ctx.translate(300, 150);
  ctx.scale(7, 7);
  const l = makeLizard(seed, { x: 0, y: 0 });
  Object.assign(l, { state, alpha: 1, motion: state === 'walk' ? 1 : 0, gait: time * 0.02 });
  const matrix = ctx.getTransform(),
    alpha = ctx.globalAlpha;
  drawLizard(ctx as never, l, 0, 0, atm, time);
  assert.deepEqual(ctx.getTransform(), matrix);
  assert.equal(ctx.globalAlpha, alpha);
  return digest();
}
assert.equal(new Set([40, 41, 42, 43].map((seed) => render(seed, 'bask', 1000))).size, 4);
assert.notEqual(render(43, 'walk', 100), render(43, 'walk', 900));
assert.deepEqual([40, 41, 42, 43].map(lizardCoat), [0, 1, 2, 3]);
// Common scene/reflection entry gate: neither winter nor night may leave a ghost silhouette.
const empty = new World();
empty.objects = [];
for (const tile of empty.tiles)
  Object.assign(tile, { ground: 'soil', water: false, indoor: false, veranda: false, level: 0 });
const sceneLife = new Life(),
  agent = makeLizard(43, { x: 12, y: 12 });
agent.alpha = 1;
sceneLife.lizards.agents = [agent];
const opts: ObjectsOpts = {
  life: sceneLife,
  wind: 0,
  zoom: 1,
  camX: 0,
  camY: 672,
  viewW: 520,
  viewH: 280,
  movingId: -1,
  highlightId: -1,
  useSpriteCache: true,
  particles: false,
  rainWeather: clear,
};
const mass = () => ctx.getImageData(0, 0, 520, 280).data.some((v, i) => i % 4 === 3 && v > 0);
canvas.width = 520;
ctx.translate(260, -532);
drawObjects(ctx as never, empty, atm, 1000, opts);
assert.ok(mass());
for (const time of [night, computeTime(date(0))]) {
  canvas.width = 520;
  ctx.translate(260, -532);
  drawObjects(ctx as never, empty, buildAtmosphere(time), 1000, opts);
  assert.equal(mass(), false);
  drawAnimalReflections(ctx as never, empty, buildAtmosphere(time), 1000, opts);
  assert.equal(mass(), false);
}
// Reflection really contains this animal in summer, then vanishes under the same activity gate.
const pond = new World();
pond.objects = [];
for (const tile of pond.tiles)
  Object.assign(tile, { water: true, indoor: false, veranda: false, level: 0, ground: 'soil' });
pond.at(12, 12)!.water = false;
Object.assign(agent, { tx: 12.85, ty: 12.85, lift: 18 });
canvas.width = 520;
ctx.translate(260, -532);
drawAnimalReflections(ctx as never, pond, atm, 1000, opts);
assert.ok(mass(), 'summer skink has a real shore reflection');
for (const time of [night, computeTime(date(0))]) {
  canvas.width = 520;
  ctx.translate(260, -532);
  drawAnimalReflections(ctx as never, pond, buildAtmosphere(time), 1000, opts);
  assert.equal(mass(), false, 'no dormant reflection');
}
console.log(
  'ок: lizard habitat, sun/season/weather, spawn/chronicle/save, rock height, retirement, safe routes/fog, dt gait, hunting/escape, occupied stones, cat interaction, six-year cap, four coats, shared renderer and cold/night gate',
);
if (process.argv.includes('--preview')) {
  const output = createCanvas(1080, 620),
    c = output.getContext('2d');
  c.fillStyle = '#eee9da';
  c.fillRect(0, 0, 1080, 620);
  c.fillStyle = '#514b40';
  c.font = '24px sans-serif';
  c.fillText('Ящерица · четыре окраса и живой сад', 26, 36);
  const guide = GUIDE_ANIMALS.find((a) => a.id === 'lizard')!;
  for (let variant = 0; variant < 4; variant++) {
    c.save();
    c.translate(190 + (variant % 2) * 310, 140 + Math.floor(variant / 2) * 220);
    c.scale(5.5, 5.5);
    guide.draw(c as never, atm, variant === 3 ? 'walk' : 'bask', 900, variant);
    c.restore();
    c.fillStyle = '#514b40';
    c.font = '17px sans-serif';
    c.fillText(guide.variants![variant], 25 + (variant % 2) * 310, 205 + Math.floor(variant / 2) * 220);
  }
  const preview = createCanvas(420, 510);
  Object.assign(preview, { clientWidth: 420, clientHeight: 510 });
  const live = new Life();
  live.lizards.agents = [makeLizard(43, h.lizardSpots[0])];
  Object.assign(live.lizards.agents[0], { state: 'bask', alpha: 1, lift: 18, perchLift: 18 });
  const scene = new Scene(preview as never);
  scene.life = live;
  scene.camera.zoom = 3;
  scene.centerOn(9.5, 9.5);
  scene.camera.y -= 25;
  scene.particles = false;
  scene.render(world, atm, 1000, 16);
  c.drawImage(preview, 650, 65);
  c.fillStyle = '#514b40';
  c.font = '17px sans-serif';
  c.fillText('Греется на камне · кадр игры', 663, 599);
  c.font = '18px sans-serif';
  c.fillText('9 анимаций · дневная активность · зимний покой', 25, 560);
  c.fillText('Камни, кусты, охота и быстрый уход от опасности', 25, 591);
  writeFileSync('preview-lizard.png', output.toBuffer('image/png'));
}
