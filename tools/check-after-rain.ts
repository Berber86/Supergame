/** Weather history, ecological drying, dry/wet caches, puddle masks and bounded raster work. */
import assert from 'node:assert/strict';
import { createCanvas } from '@napi-rs/canvas';
import { writeFileSync } from 'node:fs';
import { World } from '../src/world/world';
import { History } from '../src/core/history';
import { WeatherSystem, type WeatherState } from '../src/world/weatherState';
import { computeTime } from '../src/core/clock';
import { makeRng } from '../src/core/rng';
import { buildAtmosphere } from '../src/world/palette';
import { isoToScreen, tileDiamond } from '../src/core/iso';
import {
  rainField,
  residualWetness,
  wetnessAt,
  rainMaterial,
  drawRainGround,
  drawHouseDrips,
  drawSmallHouseDrips,
} from '../src/render/afterRain';
import { drawCached, clearSprites, spriteStats } from '../src/render/spriteCache';
import { drawWaterAnimation } from '../src/render/waterSurface';
import { Scene } from '../src/render/scene';
import { flowerOpenness } from '../src/render/flowerCycle';
Object.assign(globalThis, {
  document: { createElement: () => createCanvas(8, 8) },
  window: { devicePixelRatio: 1, innerWidth: 1200, innerHeight: 850 },
});
Math.random = makeRng(9102);
const dayTime = computeTime(new Date(2026, 5, 19, 13).getTime()),
  nightTime = computeTime(new Date(2026, 5, 19, 23).getTime()),
  winterTime = computeTime(new Date(2026, 11, 19, 13).getTime());
const day = buildAtmosphere(dayTime),
  night = buildAtmosphere(nightTime),
  winter = buildAtmosphere(winterTime);
const ws = new WeatherSystem();
ws.force('clear');
for (let i = 0; i < 30; i++) ws.update(1000, dayTime);
assert.equal(ws.state.wetness, 0);
ws.force('rain');
for (let i = 0; i < 20; i++) ws.update(1000, dayTime);
assert.equal(ws.state.wetness, 1);
assert.equal(ws.state.roofWetness, 1);
ws.force('clear');
for (let i = 0; i < 12; i++) ws.update(1000, dayTime);
assert.equal(ws.state.rain, 0);
assert.ok(ws.state.wetness > 0.8);
assert.ok(ws.state.roofWetness! > 0 && ws.state.roofWetness! < ws.state.wetness);
const wet: WeatherState = structuredClone(ws.state);
const duskDryer = new WeatherSystem();
duskDryer.force('clear');
duskDryer.state = { ...wet };
for (let i = 0; i < 40; i++) {
  ws.update(1000, dayTime);
  duskDryer.update(1000, nightTime);
}
assert.ok(duskDryer.state.wetness > ws.state.wetness, 'night dries more slowly');
assert.equal(ws.state.roofWetness, 0);
for (let i = 0; i < 240; i++) ws.update(1000, dayTime);
assert.equal(ws.state.wetness, 0);
ws.state = { ...wet };
ws.update(1000, winterTime);
assert.equal(ws.state.wetness, 0);
assert.equal(ws.state.roofWetness, 0);
const old = JSON.stringify(ws.state);
ws.update(Number.NaN, winterTime);
assert.equal(JSON.stringify(ws.state), old);
ws.update(-10, winterTime);
assert.equal(JSON.stringify(ws.state), old);
assert.ok(residualWetness(0.5, 0.9) > residualWetness(0.5, 0));
assert.equal(residualWetness(0.8, 0.6, true), 0);
const w = new World();
w.objects = [];
for (const t of w.tiles) Object.assign(t, { ground: 'soil', level: 0, water: false, indoor: false, veranda: false });
for (let y = 8; y < 14; y++) for (let x = 8; x < 14; x++) w.at(x, y)!.level = -1;
for (let y = 2; y < 6; y++)
  for (let x = 3; x < 8; x++) Object.assign(w.at(x, y)!, { ground: 'tatami', indoor: true, level: 1 });
for (let y = 17; y < 21; y++) for (let x = 15; x < 20; x++) w.at(x, y)!.water = true;
for (let y = 6; y < 12; y++) for (let x = 17; x < 21; x++) w.at(x, y)!.ground = 'deck';
const tree = w.place('pine', 10, 10, 0)!,
  rock = w.place('rock_mid', 11, 10, 0)!;
const field = rainField(w);
assert.equal(rainField(w), field);
assert.ok(field.puddles.length > 0 && field.puddles.length <= 24);
assert.equal(wetnessAt(field, wet, 5, 4, dayTime.now), 0, 'floors stay dry even in cutaway view');
assert.ok(wetnessAt(field, wet, 18, 7, dayTime.now) > 0, 'exposed boards get wet');
assert.equal(wetnessAt(field, wet, -1, 4, dayTime.now), 0);
for (const p of field.puddles) {
  const t = w.at(p.x, p.y)!;
  assert.ok(!t.water && !t.indoor && !t.veranda && t.ground !== 'deck');
  for (const [dx, dy] of [
    [-1, 0],
    [1, 0],
    [0, -1],
    [0, 1],
  ])
    assert.ok(w.at(p.x + dx, p.y + dy)!.level >= p.level, 'puddles cannot collect on a draining ledge');
}
const h = new History(w);
h.begin('move tree');
w.moveObject(tree, 20, 20, 0);
h.commit();
assert.notEqual(rainField(w), field);
h.undo();
assert.deepEqual(rainField(w).puddles, field.puddles);
const loaded = new World();
assert.ok(loaded.fromJSON(structuredClone(w.toJSON())));
assert.deepEqual(rainField(loaded).puddles, rainField(w).puddles);
const site = rainField(w).puddles[0],
  tile = w.at(site.x, site.y)!,
  oldTile = { ...tile };
tile.water = true;
assert.ok(!rainField(w).puddles.some((p) => p.x === site.x && p.y === site.y));
Object.assign(tile, oldTile);
const cv = createCanvas(1200, 850),
  ctx = cv.getContext('2d'),
  dc = ctx as unknown as CanvasRenderingContext2D;
const reset = () => {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, 1200, 850);
};
const data = () => Buffer.from(ctx.getImageData(0, 0, 1200, 850).data);
const view = { x: 0, y: 700, width: 1200, height: 850, zoom: 1 };
const snapshot = JSON.stringify(w.toJSON());
reset();
ctx.translate(600, -275);
const mat = ctx.getTransform();
ctx.globalAlpha = 0.8;
assert.ok(drawRainGround(dc, w, day, wet, 3000, view) > 0);
assert.deepEqual(ctx.getTransform(), mat);
assert.ok(Math.abs(ctx.globalAlpha - 0.8) < 0.01);
ctx.globalAlpha = 1;
const mask = createCanvas(1200, 850),
  mc = mask.getContext('2d');
mc.translate(600, -275);
mc.beginPath();
for (const c of rainField(w).cells)
  if (!c.sheltered && !c.water) {
    const p = tileDiamond(c.x, c.y, c.level);
    p.forEach((p, i) => (i ? mc.lineTo(p.x, p.y) : mc.moveTo(p.x, p.y)));
    mc.closePath();
  }
mc.fill();
const pixels = data(),
  allowed = mc.getImageData(0, 0, 1200, 850).data;
let painted = 0,
  leak = 0;
for (let i = 3; i < pixels.length; i += 4)
  if (pixels[i] > 12) {
    painted++;
    if (allowed[i] < 3) leak++;
  }
assert.ok(painted > 1000);
assert.equal(leak, 0, 'no puddles/wet stamps on roofs, indoor floors, water or cliff faces');
reset();
assert.equal(drawRainGround(dc, w, day, { ...wet, wetness: 0 }, 3000, view), 0);
assert.ok(!data().some(Boolean));
assert.equal(drawRainGround(dc, w, winter, wet, 3000, view), 0);
clearSprites();
reset();
const d = { ctx: dc, x: 600, y: 400, atm: day, g: 1, obj: rock, time: 1000, wind: 0, alpha: 1 };
drawCached(d);
const dry = data();
const soaked = rainMaterial(day, rainField(w), wet, rock.type, rock.tx + 0.5, rock.ty + 0.5);
assert.ok(soaked.materialWetness! > 0);
reset();
drawCached({ ...d, atm: soaked });
const glossy = data();
assert.notDeepEqual(glossy, dry);
let drySum = 0,
  wetSum = 0;
for (let i = 0; i < dry.length; i += 4)
  if (dry[i + 3] > 100) {
    drySum += dry[i] + dry[i + 1] + dry[i + 2];
    wetSum += glossy[i] + glossy[i + 1] + glossy[i + 2];
  }
assert.ok(wetSum < drySum, 'stone darkens, rather than just glowing white');
reset();
drawCached(d);
assert.deepEqual(data(), dry, 'dry sprite survives wet cache variants');
const cacheSize = spriteStats().size;
for (let i = 0; i < 10; i++) drawCached({ ...d, atm: soaked, time: i * 16 });
assert.equal(spriteStats().size, cacheSize);
assert.equal(rainMaterial(day, rainField(w), wet, 'iris', 11, 10), day);
assert.equal(flowerOpenness(rainMaterial(night, rainField(w), wet, 'iris', 11, 10)), 0);
reset();
ctx.translate(600, -60);
drawHouseDrips(dc, w, day, wet, 3000, 0);
assert.ok(!data().some(Boolean), 'hidden roof cannot leave suspended drips');
let dripFrames = 0;
for (let i = 0; i < 36; i++) {
  reset();
  ctx.translate(600, -60);
  drawHouseDrips(dc, w, day, { ...wet, roofWetness: 1 }, i * 200, 1);
  if (data().some(Boolean)) dripFrames++;
}
assert.ok(dripFrames > 4);
reset();
drawHouseDrips(dc, w, day, { ...wet, roofWetness: 0 }, 1000, 1);
assert.ok(!data().some(Boolean));
for (const type of ['tiny_house', 'tea_house', 'shed', 'pavilion'])
  for (let rot = 0; rot < 4; rot++) {
    let n = 0;
    for (let i = 0; i < 20; i++) {
      reset();
      drawSmallHouseDrips(
        { ...d, x: 600, y: 400, obj: { ...rock, type, rot }, time: i * 400 },
        { ...wet, roofWetness: 1 },
      );
      if (data().some(Boolean)) n++;
    }
    assert.ok(n > 0, `${type}/${rot}: drips follow a visible eave`);
  }
assert.equal(JSON.stringify(w.toJSON()), snapshot, 'weather visuals do not touch saves');
const pond = new World();
assert.ok(pond.fromJSON(structuredClone(w.toJSON())));
pond.place('bridge', 15, 18, 0);
let bridgeWet = false;
reset();
ctx.translate(600, -550);
drawWaterAnimation(dc, pond, day, 1000, 0.2);
const dryReflection = data();
reset();
ctx.translate(600, -550);
drawWaterAnimation(dc, pond, day, 1000, 0.2, undefined, (type, x, y) => {
  const material = rainMaterial(day, rainField(pond), wet, type, x, y);
  if (type === 'bridge') bridgeWet = (material.materialWetness ?? 0) > 0;
  return material;
});
assert.ok(bridgeWet);
assert.notDeepEqual(data(), dryReflection, 'bridge reflection uses the same damp boards, not a dry substitute');
assert.equal(rainMaterial(day, rainField(w), wet, 'table', 5, 4), day, 'indoor furniture does not get wet');
for (let rot = 0; rot < 4; rot++) {
  const house = pond.place('tea_house', 21, 9, rot)!;
  const item = (await import('../src/world/catalog')).ITEM_BY_ID.get('tea_house')!;
  assert.equal(
    wetnessAt(rainField(pond), wet, house.tx + item.w / 2, house.ty + item.h / 2, dayTime.now),
    0,
    'miniature roof shelters its interior in every rotation',
  );
  pond.removeObject(house);
}

if (process.argv.includes('--preview')) {
  const garden = new World();
  for (const [name, atm, weather, width, height, zoom] of [
    ['dry', day, { ...wet, wetness: 0, roofWetness: 0 }, 1200, 850, 1.02],
    ['fresh', day, wet, 1200, 850, 1.02],
    ['drying', day, { ...wet, wetness: 0.35, roofWetness: 0 }, 1200, 850, 1.02],
    ['night', night, wet, 1200, 850, 1.02],
    ['phone', day, wet, 430, 800, 0.46],
  ] as const) {
    const c = createCanvas(width, height);
    Object.assign(c, { clientWidth: width, clientHeight: height });
    const s = new Scene(c as never);
    s.camera.zoom = zoom;
    s.centerOn(11.5, 12);
    s.particles = true;
    s.render(garden, atm, 3000, 16, undefined, weather);
    writeFileSync(`preview-after-rain-${name}.png`, c.toBuffer('image/png'));
  }
}
// Real raster flush, not merely the time it takes to record canvas commands.
for (const zoom of [1, 0.4]) {
  const start = performance.now();
  for (let i = 0; i < 25; i++) {
    reset();
    ctx.translate(600, 425);
    ctx.scale(zoom, zoom);
    ctx.translate(0, -700);
    drawRainGround(dc, w, day, wet, i * 16, { ...view, zoom });
    ctx.getImageData(0, 0, 1, 1);
  }
  const ms = (performance.now() - start) / 25;
  assert.ok(ms < 12, `wet ground budget: ${ms.toFixed(2)}ms`);
  console.log(`After-rain ground zoom ${zoom}: ${ms.toFixed(2)}ms native including raster.`);
}
console.log(
  'ок: rain→clear→dry, sun/shade/night evaporation, shelter, low spots/drainage, edit/undo/reload, clipping, material/cache recovery, flower independence, eave rotations, roof visibility, winter, purity',
);
