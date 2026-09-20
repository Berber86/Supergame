/** Orchard catalogue, continuous phenology, winter citrus, windfall/foraging and render/cache contracts. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { setImmediate as yieldNative } from 'node:timers/promises';
import { createCanvas } from '@napi-rs/canvas';
import { FRUIT_TREE_TYPES, fruitYear, orchardBloom, fruitDropFrame } from '../src/world/orchard';
import { plantYear, crownCacheTime } from '../src/world/phenology';
import { canopyCover } from '../src/world/canopy';
import { computeTime, DAY_MS } from '../src/core/clock';
import { buildAtmosphere } from '../src/world/palette';
import { World } from '../src/world/world';
import { newGrowState } from '../src/world/grow';
import { ITEM_BY_ID } from '../src/world/catalog';
import { parseSave, serializeSave } from '../src/world/saveFormat';
import { scanHabitat, floweringHabitat, invitations } from '../src/world/habitat';
import { drawObject, setSkipShadows } from '../src/render/sprites';
import { drawCached, clearSprites, spriteFrame, spriteStats } from '../src/render/spriteCache';
import { drawFruitFall } from '../src/render/fruitFall';
import { drawGroundLife, groundLifeField } from '../src/render/groundLife';
import { itemIcon, clearIconCache } from '../src/ui/icons';
import { Scene } from '../src/render/scene';
Object.assign(globalThis, {
  document: { createElement: () => createCanvas(8, 8) },
  window: { devicePixelRatio: 1, innerWidth: 1200, innerHeight: 850 },
});
const date = (m: number, d = 15, y = 2026) => new Date(y, m, d, 13).getTime();
const peaks = { ume: date(1, 25), peach: date(3, 1), nashi: date(3, 20), yuzu: date(4, 25) };
const harvest = { ume: date(5, 12), peach: date(7, 15), nashi: date(8, 28), yuzu: date(11, 20) };
const floor = { ume: date(5, 30), peach: date(7, 30), nashi: date(9, 28), yuzu: date(1, 20) };
const fixed = buildAtmosphere(computeTime(date(6)));
for (const type of FRUIT_TREE_TYPES) {
  assert.ok(ITEM_BY_ID.has(type));
  for (const seed of [17, 441]) {
    let previous = fruitYear(type, seed, date(0, 1)),
      bloom = orchardBloom(type, seed, date(0, 1));
    for (let now = date(0, 1); now < date(0, 1, 2027); now += DAY_MS / 4) {
      const next = fruitYear(type, seed, now),
        flower = orchardBloom(type, seed, now);
      for (const key of ['retained', 'ripe', 'size', 'ground', 'age', 'falling'] as const)
        assert.ok(next[key] >= 0 && next[key] <= 1);
      for (const key of ['retained', 'ground', 'falling'] as const)
        assert.ok(Math.abs(next[key] - previous[key]) < 0.07, `${type} continuous ${key}`);
      assert.ok(Math.abs(flower - bloom) < 0.04);
      previous = next;
      bloom = flower;
    }
  }
  assert.ok(orchardBloom(type, 441, peaks[type]) > 0.7, `${type} distinct flowering season`);
  assert.ok(fruitYear(type, 441, harvest[type]).retained > 0.4);
  assert.ok(fruitYear(type, 441, floor[type]).ground > 0.2, `${type} windfalls`);
}
assert.ok(plantYear('ume', 441, peaks.ume).foliage < 0.05, 'ume flowers on bare branches');
assert.ok(plantYear('yuzu', 441, date(0)).evergreen && plantYear('yuzu', 441, date(0)).foliage === 1);
assert.ok(
  fruitYear('yuzu', 441, date(0)).retained > 0.85 && fruitYear('yuzu', 441, date(0)).ripe === 1,
  'yellow crop survives New Year',
);
assert.ok(canopyCover('yuzu', 441, date(0)) > 0.95, 'winter citrus remains a real canopy');
assert.equal(fruitYear('peach', 441, date(0)).retained, 0);
assert.equal(fruitYear('nashi', 441, date(2)).ground, 0);
assert.equal(fruitYear('ume', 441, date(8)).ground, 0);

const world = new World();
world.objects = [];
for (const tile of world.tiles)
  Object.assign(tile, { ground: 'soil', water: false, indoor: false, veranda: false, level: 0 });
for (const [i, type] of FRUIT_TREE_TYPES.entries()) {
  const o = world.place(type, 7 + i * 3, 10)!;
  assert.ok(o);
  o.seed = 441;
  assert.ok(world.unlocked.has(type));
}
const save = world.toJSON(),
  parsed = parseSave(JSON.parse(serializeSave(save)))!;
assert.deepEqual(
  parsed.objects.map((o) => o.type),
  [...FRUIT_TREE_TYPES],
);
const restored = new World();
restored.applySave(parsed);
assert.deepEqual(restored.objects, world.objects);
const old = { ...save, unlocked: ['maple'] };
restored.applySave(old);
for (const type of FRUIT_TREE_TYPES)
  assert.ok(restored.unlocked.has(type), 'old free gardens expose new orchard trees');
restored.applySave({ ...old, grow: newGrowState(17, Date.now()) });
for (const type of FRUIT_TREE_TYPES)
  assert.ok(!restored.unlocked.has(type), 'growing garden keeps its discovery progression');
const habitat = scanHabitat(world);
assert.equal(habitat.fruitSpots.length, 4);
assert.ok(floweringHabitat(habitat, floor.peach).fruitSpots.some((p) => p.type === 'peach'));
assert.ok(floweringHabitat(habitat, floor.nashi).fruitSpots.some((p) => p.type === 'nashi'));
assert.equal(floweringHabitat(habitat, date(2)).fruitSpots.length, 0, 'no fake winter fruit food');
assert.ok(floweringHabitat(habitat, peaks.yuzu).beeSpots.some((p) => p.type === 'yuzu'));
assert.equal(
  invitations(habitat, computeTime(peaks.ume), null).bees,
  0,
  'early flowers do not override cold-season insects',
);

const cv = createCanvas(440, 360),
  ctx = cv.getContext('2d');
const digest = () =>
  createHash('sha256')
    .update(ctx.getImageData(0, 0, 440, 360).data)
    .digest('hex');
const blank = () => !ctx.getImageData(0, 0, 440, 360).data.some((v, i) => i % 4 === 3 && v > 0);
function render(type: string, now: number, cached = true, night = false) {
  cv.width = 440;
  const atm = { ...fixed, time: { ...computeTime(now), daylight: night ? 0 : 1 } };
  const d = {
    ctx: ctx as never,
    x: 220,
    y: 280,
    atm,
    g: 1,
    obj: { id: 1, type, seed: 441, rot: 0, tx: 12, ty: 12, planted: 0 },
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
  return digest();
}
const winterHashes = new Set<string>();
for (const type of FRUIT_TREE_TYPES) {
  const forms = new Set<string>();
  for (let day = 0; day < 365; day += 5) {
    spriteFrame();
    forms.add(render(type, date(0, 1) + day * DAY_MS));
    if (day % 25 === 0) await yieldNative();
  }
  assert.ok(forms.size > 45, `${type}: not four or twelve fixed sprites`);
  assert.notEqual(
    render(type, peaks[type], true),
    render(type, peaks[type], true, true),
    'flowers close at night under identical light',
  );
  for (const now of [date(0), peaks[type], harvest[type], floor[type]]) {
    const hot = render(type, now);
    clearSprites();
    assert.equal(render(type, now), hot, 'cache independent of prior seasons');
    const canonical = crownCacheTime(type, 441, now);
    render(type, canonical, false);
    const direct = Buffer.from(ctx.getImageData(0, 0, 440, 360).data);
    render(type, canonical, true);
    const cached = ctx.getImageData(0, 0, 440, 360).data;
    let clipped = 0,
      total = 0;
    for (let i = 3; i < direct.length; i += 4)
      if (direct[i] > 30) {
        total++;
        if (cached[i] < 2) clipped++;
      }
    assert.ok(clipped / total < 0.008, `${type}: expanded crown, flowers or fruits clipped`);
  }
  winterHashes.add(render(type, date(0)));
  clearIconCache();
  const icon = itemIcon(type, buildAtmosphere(computeTime(harvest[type])));
  assert.ok(icon.startsWith('data:image/'));
}
assert.equal(winterHashes.size, 4, 'different winter silhouettes, including evergreen yuzu');
// Actual live fall, separate from static sprite caching, and no fall over water/indoor floors.
const type = 'peach',
  now = floor.peach;
let moment = 0;
for (let time = 0; time < 180000; time += 100) {
  const frame = fruitDropFrame(type, 441, now, time);
  if (frame && frame.progress > 0.3 && frame.progress < 0.6) {
    moment = time;
    break;
  }
}
assert.ok(moment > 0, 'fixture actually reaches a falling-fruit interval');
const atm = { ...fixed, time: computeTime(now) },
  obj = { id: 1, type, seed: 441, rot: 0, tx: 12, ty: 12, planted: 0 };
function falling(time: number) {
  cv.width = 440;
  ctx.translate(220, -420);
  drawFruitFall({ ctx: ctx as never, x: 0, y: 700, atm, g: 1, obj, time, wind: 0, alpha: 1 }, world);
  return digest();
}
const fallFrame = falling(moment);
assert.ok(!blank());
assert.notEqual(falling(moment + 200), fallFrame);
for (const tile of world.tiles) tile.water = true;
falling(moment);
assert.ok(blank());
for (const tile of world.tiles) {
  tile.water = false;
  tile.indoor = true;
}
falling(moment);
assert.ok(blank());
for (const tile of world.tiles) tile.indoor = false;
// Ground windfall uses one stamp per parent, not accumulating world objects.
const field = groundLifeField(world);
field.patches = field.patches.filter((p) => p.kind === 'fruits');
assert.equal(field.patches.length, 4);
const before = JSON.stringify(world.toJSON());
for (let year = 2026; year < 2032; year++)
  for (let m = 0; m < 12; m++) {
    cv.width = 440;
    ctx.translate(220, -420);
    drawGroundLife(
      ctx as never,
      world,
      { ...fixed, time: computeTime(date(m, 15, year)) },
      { x: 0, y: 650, width: 440, height: 360, zoom: 1 },
    );
    assert.ok((field.paint?.images.size ?? 0) <= 4);
    if (m === 0) await yieldNative();
  }
assert.equal(JSON.stringify(world.toJSON()), before);
assert.ok(spriteStats().size <= 420 && spriteStats().boxes <= 600);
console.log(
  'ок: four orchard species, continuous bloom/growth/ripening/drop/decay, winter yuzu, night buds, catalogue/migration/save, nectar/fruit food, 45+ yearly appearances, cache bounds/clipping, animated safe windfalls and six-year ground reuse',
);
if (process.argv.includes('--preview')) {
  const out = createCanvas(1440, 850),
    c = out.getContext('2d');
  c.fillStyle = '#eee9da';
  c.fillRect(0, 0, 1440, 850);
  c.fillStyle = '#514b40';
  c.font = '25px sans-serif';
  c.fillText('Плодовый сад · цветение, урожай и зимний юдзу', 24, 34);
  const dates = [peaks.ume, harvest.nashi, harvest.peach, date(0, 12)];
  const titles = [
    'Умэ · цветение в конце зимы',
    'Наши · золотые груши',
    'Персик · летний урожай',
    'Юдзу · плоды среди снега',
  ];
  for (const [i, type] of FRUIT_TREE_TYPES.entries()) {
    const panel = createCanvas(350, 350);
    Object.assign(panel, { clientWidth: 350, clientHeight: 350 });
    const w = new World();
    w.objects = [];
    for (const tile of w.tiles)
      Object.assign(tile, { ground: 'grass', water: false, indoor: false, veranda: false, level: 0 });
    const o = w.place(type, 12, 12)!;
    o.seed = 441;
    const scene = new Scene(panel as never);
    scene.camera.zoom = 1.5;
    scene.centerOn(12.5, 12.5);
    scene.camera.y -= 59;
    scene.particles = false;
    scene.render(w, buildAtmosphere(computeTime(dates[i])), 1000, 16);
    c.drawImage(panel, 5 + i * 360, 55);
    c.fillStyle = '#514b40';
    c.font = '16px sans-serif';
    c.fillText(titles[i], 12 + i * 360, 427);
    scene.render(w, buildAtmosphere(computeTime(type === 'yuzu' ? date(10, 25) : floor[type])), 1000, 16);
    c.drawImage(panel, 5 + i * 360, 450);
    c.fillStyle = '#514b40';
    c.fillText(type === 'yuzu' ? 'Осень · вечнозелёная крона' : 'После созревания · падалица', 12 + i * 360, 827);
    panel.width = panel.height = 1;
    await yieldNative();
  }
  writeFileSync('preview-orchard.png', out.toBuffer('image/png'));
}
