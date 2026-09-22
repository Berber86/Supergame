/** The actual mountain-source preset and live reflections, not an idealised substitute map. */
import assert from 'node:assert/strict';
import { createCanvas } from '@napi-rs/canvas';
import { writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { World } from '../src/world/world';
import { applyPreset } from '../src/world/presets';
import { Life, type Bird, type Flutter } from '../src/world/life';
import type { PondDragonfly } from '../src/world/residents';
import { ITEM_BY_ID } from '../src/world/catalog';
import { WaterFlow } from '../src/world/waterFlow';
import { WeatherSystem } from '../src/world/weatherState';
import { isoToScreen } from '../src/core/iso';
import { makeRng } from '../src/core/rng';
import { computeTime } from '../src/core/clock';
import { buildAtmosphere } from '../src/world/palette';
import { bridgePoint } from '../src/render/sprites/bridges';
import { drawAnimalReflections, type ObjectsOpts } from '../src/render/scene-steps';
import { prepareWaterSurface, waterSurfacePath } from '../src/render/waterSurface';
Object.assign(globalThis, {
  document: { createElement: () => createCanvas(8, 8) },
  window: { devicePixelRatio: 1, innerWidth: 1100, innerHeight: 900 },
});
Math.random = makeRng(477);
const world = new World();
applyPreset(world, 'klyuch');
const water = world.tiles.flatMap((t, i) => (t.water ? [i] : []));
const seen = new Set<number>(),
  queue = [16];
for (let k = 0; k < queue.length; k++) {
  const i = queue[k];
  if (seen.has(i)) continue;
  seen.add(i);
  const x = i % world.size,
    y = Math.floor(i / world.size),
    tile = world.at(x, y)!;
  for (const [dx, dy] of [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ]) {
    const n = world.at(x + dx, y + dy),
      j = (y + dy) * world.size + x + dx;
    if (n?.water && n.level <= tile.level && !seen.has(j)) queue.push(j);
  }
}
assert.equal(seen.size, water.length, 'every wet cell is reachable downhill from the northern source');
assert.ok(world.at(13, 19)!.water, 'source reaches the lower lake');
for (const o of world.objects)
  assert.ok(world.canPlace(o.type, o.tx, o.ty, o.rot), `${o.type} placed on its intended material`);
const bridges = world.objects.filter((o) => o.type === 'bridge');
assert.equal(bridges.length, 2);
for (const b of bridges) {
  const item = ITEM_BY_ID.get(b.type)!,
    cx = b.tx + item.w / 2,
    cy = b.ty + item.h / 2;
  for (const side of [-0.37, 0, 0.37]) {
    for (const end of [-1.5, 1.5]) {
      const t = world.at(Math.floor(cx + end), Math.floor(cy + side))!;
      assert.ok(!t.water && t.level === 0, 'both abutments are on level dry banks');
    }
    for (const along of [-0.9, -0.5, 0, 0.5, 0.9])
      assert.ok(
        world.at(Math.floor(cx + along), Math.floor(cy + side))!.water,
        'water is under the entire central span',
      );
  }
}
for (const plank of [false, true])
  for (let rot = 0; rot < 4; rot++)
    for (const t of [0, 0.2, 0.5, 0.8, 1])
      for (const side of [-1, 1]) {
        const a = bridgePoint(rot, t, side, 19, plank),
          r = bridgePoint(rot, t, side, 19, plank, true);
        const along = (t - 0.5) * (plank ? 2 : 3),
          across = side * (plank ? 0.32 : 0.37);
        const ground = rot % 2 === 0 ? isoToScreen(along, across) : isoToScreen(across, along);
        assert.equal(a.x, r.x);
        assert.ok(
          Math.abs(a.y + r.y - 2 * ground.y) < 1e-9,
          'bridge reflection inverts Z, not projected deck direction',
        );
      }
const flow = new WaterFlow();
flow.ensure(world);
assert.ok(flow.falls.length > 0);
const saved = structuredClone(world.toJSON()),
  restored = new World();
restored.applySave(saved);
assert.deepEqual(restored.tiles, world.tiles);
assert.deepEqual(restored.objects, world.objects);
console.log(
  `ок: mountain source ${water.length} connected downhill cells, two bank-to-bank bridges, all decorations legal, save/load`,
);

const day = buildAtmosphere(computeTime(new Date(2026, 8, 19, 13).getTime()));
const c = createCanvas(420, 360),
  ctx = c.getContext('2d'),
  dc = ctx as unknown as CanvasRenderingContext2D;
const pond = new World();
pond.objects = [];
for (let y = 0; y < pond.size; y++)
  for (let x = 0; x < pond.size; x++)
    Object.assign(pond.at(x, y)!, {
      level: 0,
      water: x >= 8 && x <= 16 && y >= 8 && y <= 16,
      ground: 'moss',
      indoor: false,
      veranda: false,
    });
const surfaces = prepareWaterSurface(pond);
const mask = createCanvas(420, 360),
  mc = mask.getContext('2d');
mc.translate(210, -500);
mc.fillStyle = '#fff';
for (const s of surfaces) {
  waterSurfacePath(mc as unknown as CanvasRenderingContext2D, s);
  mc.fill('evenodd');
}
const pixels = mc.getImageData(0, 0, 420, 360).data;
const life = new Life();
const opts: ObjectsOpts = {
  life,
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
};
const bird: Bird = {
  tx: 12,
  ty: 12,
  alt: 12,
  facing: 1,
  seed: 42,
  state: 'fly-in',
  timer: 1000,
  target: null,
  hop: 0,
  scale: 1,
  species: 'tit',
  place: 'ground',
  slot: 0,
};
const flutter: Flutter = {
  tx: 12,
  ty: 12,
  alt: 12,
  vx: 0,
  vy: 0,
  valt: 0,
  target: null,
  timer: 1000,
  seed: 42,
  phase: 0,
  resting: 0,
};
const dragonfly: PondDragonfly = {
  tx: 12,
  ty: 12,
  alt: 12,
  vx: 0.01,
  vy: 0.001,
  facing: 1,
  seed: 42,
  state: 'hover',
  timer: 1000,
  phase: 0,
  pond: 0,
  target: null,
  perch: null,
  id: 1,
  kind: 'hawker',
};
function frame(time = 900, particles = true, shadow = day.shadowAmount) {
  ctx.resetTransform();
  ctx.clearRect(0, 0, 420, 360);
  ctx.translate(210, -500);
  ctx.globalAlpha = 0.73;
  const alpha = ctx.globalAlpha,
    matrix = ctx.getTransform(),
    state = JSON.stringify(life);
  drawAnimalReflections(dc, pond, { ...day, shadowAmount: shadow }, time, { ...opts, particles });
  assert.equal(ctx.globalAlpha, alpha);
  assert.deepEqual(ctx.getTransform(), matrix);
  assert.equal(JSON.stringify(life), state, 'drawing never advances agents');
  const data = ctx.getImageData(0, 0, 420, 360).data;
  let weight = 0,
    cy = 0;
  for (let i = 3; i < data.length; i += 4) {
    if (!pixels[i]) assert.ok(data[i] <= 1, 'reflection clipped to water');
    weight += data[i];
    cy += Math.floor(i / 4 / 420) * data[i];
  }
  return { weight, cy: cy / weight, hash: createHash('sha256').update(data).digest('hex') };
}
for (const kind of ['bird', 'butterfly', 'dragonfly']) {
  life.birds = [];
  life.flutters = [];
  life.residents.dragonflies = [];
  const a = kind === 'bird' ? bird : kind === 'butterfly' ? flutter : dragonfly;
  a.alt = 12;
  if (kind === 'bird') life.birds = [bird];
  else if (kind === 'butterfly') life.flutters = [flutter];
  else life.residents.dragonflies = [dragonfly];
  const first = frame();
  assert.ok(first.weight > 20, `${kind} has a visible reflection`);
  assert.equal(first.hash, frame().hash);
  assert.equal(first.hash, frame(900, true, 0).hash, 'no mirrored ground shadow');
  a.alt += 20;
  const high = frame();
  assert.ok(Math.abs(high.cy - first.cy - 20) < 0.5, `${kind}: flight height increases reflected depth`);
  assert.notEqual(high.hash, frame(1234).hash, `${kind}: reflected pose animates`);
  if (kind !== 'bird') assert.equal(frame(900, false).weight, 0, 'particle visibility agrees with real animal');
}
life.birds = [];
life.flutters = [];
life.residents.dragonflies = [];
assert.equal(frame().weight, 0, 'no ghost after departure');
// A dry island remains dry, even with an airborne animal above it.
for (let y = 11; y <= 13; y++) for (let x = 11; x <= 13; x++) pond.at(x, y)!.water = false;
prepareWaterSurface(pond);
life.flutters = [{ ...flutter, alt: 5 }];
assert.equal(frame().weight, 0, 'no reflection on a dry island');
console.log(
  'ок: bird, butterfly and dragonfly reflection pixels, animation, altitude, clipping, no shadow, context and visibility',
);

// Repeated animated poses do not allocate per-agent canvases or expand sprite caches.
for (let y = 11; y <= 13; y++) for (let x = 11; x <= 13; x++) pond.at(x, y)!.water = true;
prepareWaterSurface(pond);
life.birds = Array.from({ length: 8 }, (_, i) => ({ ...bird, tx: 10 + i * 0.45, ty: 12, seed: 42 + i }));
life.flutters = Array.from({ length: 8 }, (_, i) => ({ ...flutter, tx: 11 + i * 0.4, ty: 13, seed: 61 + i }));
life.residents.dragonflies = Array.from({ length: 8 }, (_, i) => ({
  ...dragonfly,
  tx: 10 + i * 0.4,
  ty: 14,
  seed: 91 + i,
}));
for (let i = 0; i < 5; i++) drawAnimalReflections(dc, pond, day, i * 16, opts);
const start = performance.now();
for (let i = 0; i < 60; i++) drawAnimalReflections(dc, pond, day, i * 16, opts);
const ms = (performance.now() - start) / 60;
assert.ok(ms < 20, `24 animal reflections exceeded native-canvas budget: ${ms.toFixed(2)} ms`);
console.log(`ок: 24 animated reflections ${ms.toFixed(2)} ms/frame (native canvas, not a phone benchmark)`);

if (process.argv.includes('--preview')) {
  const { Scene } = await import('../src/render/scene');
  const displayLife = new Life();
  displayLife.sync(world);
  displayLife.birds = [{ ...bird, tx: 13, ty: 16, alt: 22 }];
  displayLife.flutters = [{ ...flutter, tx: 11, ty: 17, alt: 15 }];
  displayLife.residents.dragonflies = [{ ...dragonfly, tx: 14, ty: 18, alt: 10 }];
  for (const [name, width, height, zoom, tx, ty] of [
    ['preview-klyuch-map.png', 1200, 900, 0.64, 14, 10],
    ['preview-klyuch-bridges.png', 1000, 760, 1.7, 12.5, 12.5],
    ['preview-klyuch-mobile.png', 430, 800, 0.25, 14, 10],
    ['preview-klyuch-wildlife.png', 1000, 760, 2.2, 12.5, 17],
    ['preview-klyuch-night.png', 1200, 900, 0.64, 14, 10],
    ['preview-klyuch-rain.png', 1200, 900, 0.64, 14, 10],
  ] as const) {
    const canvas = createCanvas(width, height);
    Object.assign(canvas, { clientWidth: width, clientHeight: height });
    const scene = new Scene(canvas as unknown as HTMLCanvasElement);
    scene.camera.zoom = zoom;
    scene.centerOn(tx, ty);
    if (name.includes('mobile')) scene.fitToView(world);
    const ws = new WeatherSystem();
    if (name.includes('rain')) {
      ws.state.rain = 0.85;
      ws.state.overcast = 0.65;
      ws.state.fog = 0.15;
    }
    const lighting = name.includes('night')
      ? buildAtmosphere(computeTime(new Date(2026, 8, 19, 23).getTime()))
      : name.includes('rain')
        ? buildAtmosphere(day.time, 0.65)
        : day;
    for (let frame = 0; frame < (name.includes('rain') ? 40 : 1); frame++)
      scene.render(world, lighting, 1900 + frame * 16, 16, displayLife, ws.state);
    writeFileSync(name, canvas.toBuffer('image/png'));
  }
}
