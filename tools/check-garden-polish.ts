/** Six garden improvements: local terrain, depth, live water, paths and phone framing. */
import assert from 'node:assert/strict';
import { createCanvas } from '@napi-rs/canvas';
import { createHash } from 'node:crypto';
import { World } from '../src/world/world';
import { applyPreset } from '../src/world/presets';
import { WaterFlow } from '../src/world/waterFlow';
import { History } from '../src/core/history';
import { computeTime } from '../src/core/clock';
import { buildAtmosphere } from '../src/world/palette';
import { isoToScreen } from '../src/core/iso';
import { Scene } from '../src/render/scene';
import { prepareWaterSurface, drawWaterAnimation, waterSurfacePath } from '../src/render/waterSurface';
import { waterDepth } from '../src/render/waterDepth';
import { makeWaterMotion } from '../src/render/waterMotion';
import { fishSubmersion } from '../src/render/creatures';
import { Life } from '../src/world/life';
import { RainRenderer } from '../src/render/rain';
import { WeatherSystem } from '../src/world/weatherState';
import { drawMist } from '../src/render/weather';
Object.assign(globalThis, {
  document: { createElement: () => createCanvas(8, 8) },
  window: { devicePixelRatio: 1, innerWidth: 430, innerHeight: 800 },
});
const w = new World();
applyPreset(w, 'klyuch');
const day = buildAtmosphere(computeTime(new Date(2026, 8, 19, 13).getTime()));
let longest = 0;
for (const swap of [false, true])
  for (let a = 0; a < w.size - 1; a++) {
    let run = 0;
    for (let b = 0; b < w.size; b++) {
      const t = w.at(swap ? a : b, swap ? b : a)!,
        n = w.at(swap ? a + 1 : b, swap ? b : a + 1)!;
      run = t.level > 0 && !t.water && !t.indoor && !t.veranda && !n.water && n.level < t.level ? run + 1 : 0;
      longest = Math.max(longest, run);
    }
  }
assert.ok(longest <= 4, `no long rectangular mountain wall: ${longest}`);
assert.ok(w.objects.filter((o) => o.type === 'step_stone').length >= 15);
for (const o of w.objects)
  assert.ok(w.canPlace(o.type, o.tx, o.ty, o.rot), `${o.type}: path/planting remains on legal land`);
prepareWaterSurface(w);
const deep = waterDepth(w, 13, 18),
  stream = waterDepth(w, 12.5, 10.5);
assert.ok(deep > stream + 0.4, 'lake bottom deepens away from the shore and narrow channel');
const life = new Life();
life.sync(w);
assert.equal(w.objects.filter((o) => o.type === 'koi').length, 2);
assert.ok(life.fish.length >= 2);
const fish = { ...life.fish[0], tx: 13, ty: 18, seed: 0, state: 'wander' as const };
const peak = Math.PI / 2 / 0.00042,
  trough = (3 * Math.PI) / 2 / 0.00042;
assert.ok(fishSubmersion(fish, w, peak) > fishSubmersion(fish, w, trough) + 0.25, 'deep-water koi dive');
assert.equal(fishSubmersion({ ...fish, state: 'feed' }, w, peak), 0.18);
assert.equal(fishSubmersion({ ...fish, state: 'hide' }, w, peak), 1);
const history = new History(w),
  before = structuredClone(w.toJSON());
history.begin('shallow');
w.setGround(13, 18, 'moss');
history.commit();
prepareWaterSurface(w);
history.undo();
prepareWaterSurface(w);
assert.ok(Math.abs(waterDepth(w, 13, 18) - deep) < 1e-9);
assert.deepEqual(w.tiles, before.tiles, 'depth calculation never rewrites saved elevations');
const flow = new WaterFlow();
flow.ensure(w);
const lake = isoToScreen(13, 18, -0.26),
  river = isoToScreen(12.5, 10.5, -0.26);
let quiet = 0,
  rapid = 0;
for (let t = 0; t < 6000; t += 120) {
  const sample = makeWaterMotion(w, flow, t, 0);
  quiet += sample(lake.x, lake.y, 0).dx ** 2;
  rapid += sample(river.x, river.y, 0).dx ** 2;
}
assert.ok(rapid > quiet * 2, 'flowing channel is visibly more distorted than the still lake');
const base = makeWaterMotion(w, flow, 1200, 0);
const ring = { tx: 13, ty: 18, age: 500, life: 1000, max: 20 };
const wave = makeWaterMotion(w, flow, 1200, 0, [ring]);
assert.ok(
  Math.abs(wave(lake.x + 8, lake.y, 0).dx - base(lake.x + 8, lake.y, 0).dx) > 0.3,
  'expanding ring bends reflection',
);
assert.deepEqual(wave(lake.x + 100, lake.y, 0), base(lake.x + 100, lake.y, 0), 'ripples stay local');
assert.deepEqual(wave(lake.x + 8, lake.y, 1), base(lake.x + 8, lake.y, 1), 'no ripple leaks onto another terrace');
const faded = makeWaterMotion(w, flow, 1200, 0, [{ ...ring, age: 1001 }]);
assert.deepEqual(faded(lake.x + 8, lake.y, 0), base(lake.x + 8, lake.y, 0), 'settled water clears again');
const rain = new RainRenderer(),
  weather = new WeatherSystem();
rain.resize(430, 800);
weather.state.rain = 1;
for (let i = 0; i < 120; i++) rain.update(16, weather.state, w);
assert.ok(rain.waterRipples.length > 0, 'rain impacts are available to reflection shader');
const impact = rain.waterRipples[0],
  tile = w.at(Math.floor(impact.tx), Math.floor(impact.ty))!;
const rp = isoToScreen(impact.tx, impact.ty, tile.level - 0.26),
  radius = (impact.max * impact.age) / impact.life;
const rainWave = makeWaterMotion(w, flow, 1200, 0, rain.waterRipples);
assert.notDeepEqual(rainWave(rp.x + radius - 2, rp.y, tile.level), base(rp.x + radius - 2, rp.y, tile.level));

const c = createCanvas(640, 400),
  ctx = c.getContext('2d'),
  dc = ctx as unknown as CanvasRenderingContext2D;
function frame(motion: ReturnType<typeof makeWaterMotion>) {
  ctx.resetTransform();
  ctx.clearRect(0, 0, 640, 400);
  ctx.translate(260, -470);
  const before = ctx.getTransform(),
    alpha = ctx.globalAlpha;
  drawWaterAnimation(dc, w, day, 1200, 0, motion);
  assert.deepEqual(ctx.getTransform(), before);
  assert.equal(ctx.globalAlpha, alpha);
  return createHash('sha256')
    .update(ctx.getImageData(0, 0, 640, 400).data)
    .digest('hex');
}
const still = frame(base);
const nearBridge = makeWaterMotion(w, flow, 1200, 0, [{ tx: 13.5, ty: 11, age: 450, life: 1000, max: 24 }]);
assert.notEqual(frame(nearBridge), still, 'real bridge reflection changes, not only decorative rings');
const reflected = ctx.getImageData(0, 0, 640, 400).data;
const mask = createCanvas(640, 400),
  mc = mask.getContext('2d');
mc.translate(260, -470);
for (const s of prepareWaterSurface(w)) {
  waterSurfacePath(mc as unknown as CanvasRenderingContext2D, s);
  mc.fill('evenodd');
}
const clip = mc.getImageData(0, 0, 640, 400).data;
for (let i = 3; i < clip.length; i += 4)
  if (clip[i] === 0) assert.ok(reflected[i] <= 2, 'distortion remains inside water mask');

const phone = createCanvas(430, 800);
Object.assign(phone, { clientWidth: 430, clientHeight: 800 });
const scene = new Scene(phone as unknown as HTMLCanvasElement);
scene.fitToView(w);
assert.ok(scene.camera.zoom >= 0.3 && scene.camera.zoom < 0.5, 'phone starts closer, without extreme crop');
for (const o of w.objects.filter((o) => o.type === 'bridge')) {
  const p = isoToScreen(o.tx + 0.5, o.ty + 1.5),
    x = (p.x - scene.camera.x) * scene.camera.zoom + 215,
    y = (p.y - scene.camera.y) * scene.camera.zoom + 400;
  assert.ok(x > 65 && x < 365 && y > 150 && y < 650, 'both bridges clear the phone UI');
}
function mist(hour: number) {
  const atm = buildAtmosphere(computeTime(new Date(2026, 8, 19, hour).getTime()));
  ctx.resetTransform();
  ctx.clearRect(0, 0, 640, 400);
  drawMist(dc, 640, 400, atm, 0);
  return ctx.getImageData(0, 0, 640, 400).data.reduce((sum, v, i) => sum + (i % 4 === 3 ? v : 0), 0);
}
assert.ok(mist(13) < mist(6) * 0.6, 'clear afternoon is less veiled than dawn');
console.log(
  `ок: irregular ridge (longest ledge ${longest}), paths, two koi, depth/undo, flowing/quiet reflections, impact/rain/fade/clipping, phone framing and light`,
);
