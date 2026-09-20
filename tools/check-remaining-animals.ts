/** Остальные 18 страниц: все состояния/окрасы, живые часы и переходы. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createCanvas } from '@napi-rs/canvas';
import { GUIDE_ANIMALS } from '../src/ui/animalGuideData';
import { Life, type Cat } from '../src/world/life';
import { Wildlife, type Mouse, type Owl, type Bee } from '../src/world/wildlife';
import { World } from '../src/world/world';
import { computeTime } from '../src/core/clock';
import { buildAtmosphere, type Atmosphere } from '../src/world/palette';
import { scanHabitat, invitations } from '../src/world/habitat';
import { advanceAnimal } from '../src/world/animalMotion';
import {
  catPosture,
  catMotion,
  updateCatPosture,
  CAT_STRIDE,
  MOUSE_STRIDE,
  mouseSpeed,
} from '../src/world/creatureMotion';
import { drawCat } from '../src/render/creatures';
import { drawMouse, drawOwl, drawBee } from '../src/render/wildlife';

const time = computeTime(new Date(2026, 5, 15, 13).getTime());
const world = new World();
const habitat = scanHabitat(world);
const inv = invitations(habitat, time, null);
const base = {
  tx: 12,
  ty: 12,
  target: null,
  from: null,
  phase: 0,
  timer: 20000,
  seed: 42,
  facing: 1 as const,
  born: 0,
  stay: 1e9,
};
const cat = (): Cat => ({
  ...base,
  id: 1,
  state: 'sit',
  speed: 0,
  home: null,
  guest: false,
  coat: 'cream',
  greet: 0,
  leaveAt: 0,
  stayAt: 0,
});
const mouse = (): Mouse => ({ ...base, state: 'walk', panicX: 0, panicY: 0, panic: 0 });
const owl = (): Owl => ({ ...base, state: 'perch', huntX: 0, huntY: 0, hoot: 0 });
const bee = (): Bee => ({
  ...base,
  state: 'gather',
  ax: 12,
  ay: 12,
  alt: 2,
  dir: 0,
  vx: 0,
  vy: 0,
  carrying: false,
  alpha: 1,
});

// Сумма весов не распадается, смена позы не заменяет силуэт мгновенно.
const a = cat(),
  b = cat();
a.posture = catPosture('sleep');
b.posture = catPosture('sleep');
a.state = b.state = 'wash';
updateCatPosture(a, 640);
for (let i = 0; i < 40; i++) updateCatPosture(b, 16);
for (const state of Object.keys(a.posture) as (keyof typeof a.posture)[])
  assert.ok(Math.abs(a.posture[state] - b.posture[state]) < 1e-10);
assert.ok(Math.abs(Object.values(a.posture).reduce((x, y) => x + y, 0) - 1) < 1e-10);
const stretching = { ...cat(), state: 'stretch' as const, actionTime: 0, actionDuration: 2400 };
assert.equal(catMotion(stretching, 100).stretch, 0);
stretching.actionTime = 1200;
assert.equal(catMotion(stretching, 100).stretch, 1);
stretching.actionTime = 2400;
assert.ok(catMotion(stretching, 100).stretch < 1e-10);

// Изолируем именно кошачью симуляцию: без случайных визитов и хищников.
const life = new Life();
const c = cat();
c.state = 'walk';
c.target = { x: 12, y: 16 };
for (let y = 11; y <= 17; y++) world.at(12, y)!.water = false;
life.cats.push(c);
const catStep = (dt: number) => life['updateCats'](world, time, dt);
catStep(16);
assert.equal(c.facing, -1);
assert.ok(c.gait! > 0);
assert.ok(Math.abs(c.gait! - (Math.hypot(c.tx - 12, c.ty - 12) / CAT_STRIDE) * Math.PI * 2) < 1e-10);
const stoppedGait = c.gait;
c.state = 'sleep';
c.timer = 10000;
c.target = null;
catStep(16);
assert.equal(c.gait, stoppedGait);
assert.ok(c.posture!.walk > 0.8 && c.posture!.sleep > 0);
c.state = 'walk';
c.timer = 10000;
c.target = { x: c.tx, y: c.ty + 3 };
world.at(12, 12)!.water = true;
const blocked = { x: c.tx, y: c.ty, gait: c.gait };
catStep(16);
assert.ok(Math.abs(c.tx - blocked.x) < 1e-10 && Math.abs(c.ty - blocked.y) < 1e-10);
assert.equal(c.gait, blocked.gait, 'кот не шагает при откате от воды');
console.log('ок: кошачьи позы, часы потягивания, шаг от расстояния и остановка у воды');

for (const state of ['walk', 'flee', 'enter', 'leave'] as const) {
  const a = { ...mouse(), state, target: { x: 12, y: 20 } };
  const b = structuredClone(a);
  advanceAnimal(a, 800, mouseSpeed(state), MOUSE_STRIDE);
  for (let i = 0; i < 50; i++) advanceAnimal(b, 16, mouseSpeed(state), MOUSE_STRIDE);
  assert.ok(Math.abs(a.ty - b.ty) < 1e-10 && Math.abs(a.gait! - b.gait!) < 1e-10);
  assert.equal(a.facing, -1);
  const farther = { ...mouse(), state, target: { x: 12, y: 40 } };
  advanceAnimal(farther, 800, mouseSpeed(state), MOUSE_STRIDE);
  assert.ok(Math.abs(a.ty - farther.ty) < 1e-10);
}
const wildlife = new Wildlife();
const entrant = { ...mouse(), tx: -3, state: 'enter' as const, target: { x: 10, y: 12 } };
wildlife.mice.push(entrant);
wildlife.update(habitat, inv, time, null, 16, 16, []);
assert.ok(entrant.tx > -3 && entrant.tx < -2.9, 'вход не телепортирует мышь к границе');
const hunter = {
  ...owl(),
  state: 'hunt' as const,
  phase: 0.995,
  altitude: 1,
  wingOpen: 1,
  from: { x: 12, y: 12 },
  target: { x: 13, y: 12 },
};
wildlife.owls.push(hunter);
wildlife.update(habitat, inv, time, null, 16, 32, []);
assert.equal(hunter.state, 'look');
assert.ok(hunter.altitude < 5, 'после охоты сова поднимается, а не телепортируется на насест');
for (let i = 0; i < 250; i++) wildlife.update(habitat, inv, time, null, 16, 100, []);
assert.equal(hunter.state, 'perch');
assert.ok(Math.abs(hunter.altitude - 36) < 0.3 && hunter.wingOpen < 0.01);
console.log('ок: постоянная скорость мышей при разном FPS, вход с края и возвращение совы на насест');

const pollen = bee();
pollen.timer = 300;
pollen.target = { x: 12, y: 12 };
const bees = new Wildlife();
bees.bees.push(pollen);
const beeHabitat = { ...habitat, beeSpots: [{ x: 12, y: 12 }], beehives: [{ x: 14, y: 12 }] };
const beeInv = { ...inv, bees: 1 };
bees.update(beeHabitat, beeInv, time, null, 100, 100, []);
assert.equal(pollen.state, 'gather');
assert.equal(pollen.tx, 12);
assert.equal(pollen.ty, 12);
bees.update(beeHabitat, beeInv, time, null, 220, 320, []);
assert.equal(pollen.state, 'return');
assert.ok(pollen.carrying && pollen.tx > 12);
for (let i = 0; i < 100 && pollen.carrying; i++) bees.update(beeHabitat, beeInv, time, null, 16, 500, []);
assert.equal(pollen.carrying, false);
console.log('ок: сбор пыльцы без скольжения, возвращение к улью и разгрузка');

// A compact canvas bounds native pixel-buffer memory during thousands of frames.
const W = 360,
  H = 200;
const canvas = createCanvas(W, H);
const ctx = canvas.getContext('2d');
const context = ctx as unknown as CanvasRenderingContext2D;
const digest = () =>
  createHash('sha256')
    .update(ctx.getImageData(0, 0, W, H).data)
    .digest('hex');
function pure<T>(
  agent: T,
  draw: (ctx: CanvasRenderingContext2D, a: T, x: number, y: number, atm: Atmosphere, time: number) => void,
): void {
  const snapshot = structuredClone(agent);
  const atm = buildAtmosphere(time);
  ctx.clearRect(0, 0, W, H);
  draw(context, agent, 100, 100, atm, 760);
  const hash = digest();
  ctx.clearRect(0, 0, W, H);
  draw(context, agent, 100, 100, atm, 760);
  assert.equal(digest(), hash);
  assert.deepEqual(agent, snapshot);
}
pure(cat(), drawCat);
pure(mouse(), drawMouse);
pure(owl(), drawOwl);
pure(bee(), drawBee);

const animals = GUIDE_ANIMALS.filter((a) => !['deer', 'turtle', 'heron', 'hedgehog', 'squirrel'].includes(a.id));
assert.equal(animals.length, 18);
assert.equal(
  animals.reduce((n, a) => n + a.animations.length, 0),
  102,
);
let frames = 0;
for (const hour of [13, 23]) {
  const atm = buildAtmosphere(computeTime(new Date(2026, 5, 15, hour).getTime()));
  for (const animal of animals)
    for (let variant = 0; variant < (animal.variants?.length ?? 1); variant++) {
      for (const state of animal.animations)
        for (const direction of [-1, 1]) {
          const hashes = new Set<string>();
          for (let i = 0; i < 8; i++) {
            ctx.resetTransform();
            ctx.clearRect(0, 0, W, H);
            ctx.save();
            ctx.translate(W / 2, H * animal.baseline);
            ctx.scale(((animal.scale * W) / 580) * direction, (animal.scale * W) / 580);
            const transform = ctx.getTransform();
            animal.draw(context, atm, state.id, ((animal.id === 'firefly' ? 2600 : state.duration) * i) / 8, variant);
            assert.deepEqual(ctx.getTransform(), transform);
            assert.equal(ctx.globalAlpha, 1);
            ctx.restore();
            const pixels = ctx.getImageData(0, 0, W, H).data;
            const label = `${animal.id}/${state.id}/${variant}`;
            for (let x = 0; x < W; x++)
              assert.ok(
                pixels[x * 4 + 3] < 20 && pixels[((H - 1) * W + x) * 4 + 3] < 20,
                `${label}: vertical clipping`,
              );
            for (let y = 0; y < H; y++)
              assert.ok(
                pixels[y * W * 4 + 3] < 20 && pixels[(y * W + W - 1) * 4 + 3] < 20,
                `${label}: horizontal clipping`,
              );
            hashes.add(createHash('sha256').update(pixels).digest('hex'));
            frames++;
          }
          assert.ok(hashes.size >= 4, `${animal.id}/${state.id}: animation must move, not just mirror`);
        }
    }
}
console.log(`ок: ${frames} кадров, 18 страниц / 102 состояния, все окрасы, день/ночь и оба направления`);
