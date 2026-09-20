import { createHash } from 'node:crypto';
import { setImmediate as yieldNative } from 'node:timers/promises';
import { stoneShape, stoneResponse, STONE_TYPES, stonePerchHeight } from '../src/world/stone';
import { drawCached, drawCachedReflection, clearSprites, spriteStats } from '../src/render/spriteCache';
import { rainField, rainMaterial, wetnessAt } from '../src/render/afterRain';
import { stoneFlags } from '../src/render/terrain';
import { WeatherSystem } from '../src/world/weatherState';
import assert from 'node:assert/strict';
import { createCanvas, loadImage } from '@napi-rs/canvas';
import { writeFileSync, existsSync } from 'node:fs';
import { World } from '../src/world/world';
import { drawObjectShadow } from '../src/render/sprites';
import { Scene } from '../src/render/scene';
import { computeTime } from '../src/core/clock';
import { buildAtmosphere } from '../src/world/palette';
import { makeRng } from '../src/core/rng';
Object.assign(globalThis, {
  document: { createElement: () => createCanvas(8, 8) },
  window: { devicePixelRatio: 1, innerWidth: 1120, innerHeight: 760 },
});
Math.random = makeRng(1909);
export const garden = new World();
garden.objects = [];
for (const t of garden.tiles)
  Object.assign(t, { ground: 'moss', water: false, level: 0, indoor: false, veranda: false });
for (let x = 8; x <= 16; x++) garden.at(x, 12)!.ground = 'stone';
for (let y = 8; y < 12; y++) garden.at(13, y)!.ground = 'stone';
for (let y = 13; y <= 15; y++) garden.at(14, y)!.ground = 'stone';
for (let x = 8; x < 12; x++) for (let y = 8; y < 12; y++) garden.at(x, y)!.ground = 'gravel';
for (let x = 14; x <= 16; x++) for (let y = 8; y <= 10; y++) garden.at(x, y)!.ground = 'stone';
for (let x = 14; x < 19; x++)
  for (let y = 14; y < 19; y++) if ((x - 16) ** 2 + (y - 16) ** 2 < 7) garden.at(x, y)!.water = true;
for (const [type, x, y, seed] of [
  ['rock_big', 10, 9, 87],
  ['rock_big', 11, 14, 324],
  ['rock_mid', 12, 10, 311],
  ['rock_trio', 9, 13, 499],
  ['step_stone', 12, 13, 654],
  ['maple', 8, 11, 420],
  ['fern', 10, 13, 276],
] as const) {
  const o = garden.place(type, x, y);
  assert.ok(o);
  o.seed = seed;
}
const atm = buildAtmosphere(computeTime(new Date(2026, 8, 20, 11).getTime()));
const canvas = createCanvas(1120, 760);
Object.assign(canvas, { clientWidth: 1120, clientHeight: 760 });
const scene = new Scene(canvas as never);
scene.setQuality('balanced');
scene.camera.zoom = 1.65;
scene.centerOn(12.5, 12);
scene.camera.y -= 18;
scene.particles = false;
const save = JSON.stringify(garden.toJSON());
scene.render(garden, atm, 0, 0);
assert.equal(JSON.stringify(garden.toJSON()), save);
if (process.argv.includes('--preview'))
  writeFileSync(
    process.argv.includes('--before') ? 'preview-stone-before.png' : 'preview-stone.png',
    canvas.toBuffer('image/png'),
  );
// Stable geology, real rotation, distinct moisture time responses.
for (let seed = 0; seed < 40; seed++) {
  assert.deepEqual(stoneShape(seed), stoneShape(seed, 1, 4));
  assert.notDeepEqual(stoneShape(seed), stoneShape(seed, 1, 1));
  assert.equal(stoneShape(seed).family, stoneShape(seed, 1, 3).family);
  const r = stoneResponse(seed, 0.4, 0.8);
  assert.ok(r.crevice > r.top && r.foot > r.top);
  assert.ok(r.moss > stoneResponse(seed, 0.4, 0).moss);
  assert.equal(stoneResponse(seed, 0).top, 0);
  assert.ok(stonePerchHeight('rock_big', seed) > stonePerchHeight('step_stone', seed));
}
const cv = createCanvas(300, 210),
  c = cv.getContext('2d');
const hash = () =>
  createHash('sha256')
    .update(c.getImageData(0, 0, 300, 210).data)
    .digest('hex');
const sample = {
  ctx: c as never,
  x: 150,
  y: 160,
  atm,
  g: 1,
  time: 0,
  wind: 0,
  alpha: 1,
  obj: { id: 999, type: 'rock_big', tx: 10, ty: 10, seed: 87, rot: 0, planted: 0 },
};
function sprite(type: string, wet = 0, rot = 0, clock = 0, date = atm.time.now, habitat = 0.5) {
  cv.width = 300;
  const d = {
    ...sample,
    obj: { ...sample.obj, type, rot },
    atm: { ...atm, time: { ...atm.time, now: date }, materialWetness: wet, stoneHabitat: habitat },
    time: clock,
    wind: clock * 0.001,
  };
  assert.ok(drawCached(d), `${type} retains a cached body`);
  return hash();
}
clearSprites();
for (const type of STONE_TYPES) {
  const dry = sprite(type);
  if (type !== 'step_stone') assert.equal(c.getImageData(150, 155, 1, 1).data[3], 255, 'solid rock is opaque');
  assert.notEqual(sprite(type, 1), dry, 'rain changes the actual material');
  assert.equal(sprite(type), dry, 'drying restores the exact original anatomy');
  assert.notEqual(sprite(type, 0, 1), dry, 'rotation is not a no-op');
  assert.notEqual(
    sprite(type, 0, 0, 0, atm.time.now, 1),
    sprite(type, 0, 0, 0, atm.time.now, 0),
    'local habitat changes colonies',
  );
  assert.equal(sprite(type, 0, 0, 22000), dry, 'wind/animation never wiggles a stone');
}
for (const type of ['rock_big', 'rock_mid', 'rock_trio', 'step_stone'])
  for (let seed = 0; seed < 12; seed++)
    for (let rot = 0; rot < 4; rot++) {
      cv.width = 300;
      drawCached({ ...sample, obj: { ...sample.obj, type, seed, rot } });
      const y = Math.round(160 - stonePerchHeight(type, seed, rot));
      assert.ok(
        c.getImageData(150, y, 1, 1).data[3] > 100,
        `${type} seed ${seed} rotation ${rot}: basking feet touch the upper surface`,
      );
    }
for (const type of STONE_TYPES) sprite(type);
const before = spriteStats().misses;
for (let i = 0; i < 100; i++) {
  sprite('water_stone', 0, 0, i * 130);
  if (i % 20 === 0) await yieldNative();
}
assert.equal(spriteStats().misses, before, 'water ripples do not rebake the mineral body');
cv.width = 300;
drawCachedReflection({
  ...sample,
  y: 30,
  obj: { ...sample.obj, type: 'water_stone' },
  reflectionWarp: () => ({ dx: 0, dy: 0, alpha: 1 }),
});
assert.ok(
  c.getImageData(0, 0, 300, 210).data.some((v, i) => i % 4 === 3 && v > 10),
  'water stones now have actual reflections',
);
const seasonal = sprite('rock_big', 0, 0, 0, new Date(2026, 11, 1, 13).getTime());
assert.notEqual(
  sprite('rock_big', 0, 0, 0, new Date(2026, 11, 24, 13).getTime()),
  seasonal,
  'snow does not freeze at first winter cache entry',
);
for (let i = 0; i < 160; i++) {
  sprite(
    'rock_big',
    (i % 13) / 12,
    i % 4,
    0,
    new Date(2026 + Math.floor(i / 12), i % 12, 15, 13).getTime(),
    (i % 7) / 6,
  );
  if (i % 20 === 0) await yieldNative();
}
assert.ok(spriteStats().size <= 420 && spriteStats().boxes <= 600);
// Local dampness/shade and shelter; save/reload retains joints and weathering sites.
const w = new World();
w.objects = [];
for (const t of w.tiles) Object.assign(t, { ground: 'grass', water: false, level: 0, indoor: false, veranda: false });
w.at(11, 10)!.water = true;
const wx = new WeatherSystem().state;
wx.wetness = 0.5;
let field = rainField(w);
const bank = rainMaterial(atm, field, wx, 'rock_mid', 10.5, 10.5);
const exposed = rainMaterial(atm, field, wx, 'rock_mid', 5.5, 5.5);
assert.ok(bank.stoneHabitat! > exposed.stoneHabitat!);
w.place('pine', 10, 10);
field = rainField(w);
assert.ok(
  wetnessAt(field, wx, 10.5, 10.5, atm.time.now) > wetnessAt(field, wx, 5.5, 5.5, atm.time.now),
  'shaded rock dries more slowly',
);
w.at(5, 5)!.indoor = true;
assert.equal(rainMaterial(atm, rainField(w), wx, 'rock_mid', 5.5, 5.5).materialWetness, 0);
for (const [x, y] of [
  [7, 7],
  [8, 7],
  [9, 7],
  [8, 6],
])
  w.at(x, y)!.ground = 'stone';
assert.equal(stoneFlags(w, 8, 7, w.at(8, 7)!).length, 4, 'T-junction is a centre plus three arms, not a solid diamond');
assert.equal(stoneFlags(w, 7, 7, w.at(7, 7)!).length, 2);
w.at(8, 7)!.level = 1;
assert.equal(stoneFlags(w, 7, 7, w.at(7, 7)!).length, 1, 'no horizontal path bridging different elevations');
w.at(8, 7)!.level = 0;
const layout = stoneFlags(w, 8, 7, w.at(8, 7)!);
function separate(a: { x: number; y: number }[], b: { x: number; y: number }[]) {
  return [a, b].some((poly) =>
    poly.some((p, i) => {
      const q = poly[(i + 1) % poly.length],
        nx = q.y - p.y,
        ny = p.x - q.x;
      const aa = a.map((v) => v.x * nx + v.y * ny),
        bb = b.map((v) => v.x * nx + v.y * ny);
      return Math.max(...aa) <= Math.min(...bb) || Math.max(...bb) <= Math.min(...aa);
    }),
  );
}
for (let y = 0; y < garden.size; y++)
  for (let x = 0; x < garden.size; x++) {
    const t = garden.at(x, y)!;
    if (t.ground !== 'stone') continue;
    const flags = stoneFlags(garden, x, y, t);
    for (let i = 0; i < flags.length; i++)
      for (let j = i + 1; j < flags.length; j++)
        assert.ok(separate(flags[i], flags[j]), `non-overlapping paving at ${x},${y}`);
  }
// A path is not a row of identical tokens: most treads cross the walk in the
// ground plane, with a real spread of widths/aspects and more than one outline.
const widths: number[] = [],
  aspects: number[] = [],
  vertices = new Set<number>();
for (let x = 2; x <= 20; x++) w.at(x, 20)!.ground = 'stone';
for (let x = 3; x < 20; x++)
  for (const poly of stoneFlags(w, x, 20, w.at(x, 20)!)) {
    assert.ok(poly.length >= 3 && poly.every((p) => Number.isFinite(p.x) && Number.isFinite(p.y)));
    const across = poly.map((p) => (p.x - p.y * 2) * Math.SQRT1_2),
      along = poly.map((p) => (p.x + p.y * 2) * Math.SQRT1_2);
    const width = Math.max(...across) - Math.min(...across),
      depth = Math.max(...along) - Math.min(...along);
    widths.push(width);
    aspects.push(width / depth);
    vertices.add(poly.length);
  }
assert.ok(
  aspects.filter((r) => r > 1.5).length > aspects.length * 0.6,
  'most long axes cross the walk, not the screen',
);
assert.ok(Math.max(...widths) / Math.min(...widths) > 1.7, 'substantial size variety, not tiny jitter on one stamp');
assert.ok(Math.min(...aspects) < 1.5 && Math.max(...aspects) > 3, 'rounded stones interrupt elongated treads');
assert.ok(vertices.size >= 3, 'different broken/worn outlines');
const loaded = new World();
assert.ok(loaded.fromJSON(structuredClone(w.toJSON())));
assert.deepEqual(stoneFlags(loaded, 8, 7, loaded.at(8, 7)!), layout);
assert.equal(JSON.stringify(garden.toJSON()), save);
console.log(
  'ок: seeded/rotated geology, opaque mass, wet cap/crevices/foot, habitat/shelter, dry recovery, water-stone reflections without animated rebakes, snow progression, bounded 13-year samples, T-junction/elevation and reload stability',
);

if (process.argv.includes('--preview') && existsSync('preview-stone-before.png')) {
  const sheet = createCanvas(1600, 1040),
    sc = sheet.getContext('2d');
  sc.fillStyle = '#ede7d6';
  sc.fillRect(0, 0, 1600, 1040);
  sc.fillStyle = '#3f493d';
  sc.font = '34px serif';
  sc.fillText('Камень: масса, поверхность, вода', 36, 48);
  sc.font = '18px sans-serif';
  sc.fillText('ДО', 36, 83);
  sc.fillText('ПОСЛЕ', 836, 83);
  sc.drawImage(await loadImage('preview-stone-before.png'), 0, 100, 800, 543);
  sc.drawImage(canvas, 800, 100, 800, 543);
  sc.font = '27px serif';
  sc.fillStyle = '#3f493d';
  sc.fillText('Поверхность крупным планом — дождь, высыхание и снег', 36, 692);
  const states = [
    { label: 'Сухой', wet: 0, habitat: 0.5, now: atm.time.now, type: 'rock_big' },
    { label: 'После дождя', wet: 1, habitat: 0.5, now: atm.time.now, type: 'rock_big' },
    { label: 'Щели ещё влажные', wet: 0.35, habitat: 0.5, now: atm.time.now, type: 'rock_big' },
    { label: 'Снежная шапка', wet: 0, habitat: 0.5, now: new Date(2026, 0, 15, 13).getTime(), type: 'rock_big' },
    { label: 'Сырость и тень', wet: 0.25, habitat: 1, now: atm.time.now, type: 'rock_big' },
    { label: 'Камень в воде', wet: 0, habitat: 0.8, now: atm.time.now, type: 'water_stone' },
  ];
  for (let i = 0; i < states.length; i++) {
    const state = states[i],
      x = 134 + i * 266;
    sc.save();
    sc.translate(x, 905);
    sc.scale(2.35, 2.35);
    if (state.type === 'water_stone') {
      sc.fillStyle = '#9faeb0';
      sc.beginPath();
      sc.ellipse(0, 5, 38, 15, 0, 0, Math.PI * 2);
      sc.fill();
    }
    const d = {
      ...sample,
      ctx: sc as never,
      x: 0,
      y: 0,
      obj: { ...sample.obj, type: state.type },
      atm: { ...atm, time: { ...atm.time, now: state.now }, materialWetness: state.wet, stoneHabitat: state.habitat },
    };
    if (state.type !== 'water_stone') drawObjectShadow(d);
    drawCached(d);
    sc.restore();
    sc.fillStyle = '#3f493d';
    sc.font = '18px sans-serif';
    sc.textAlign = 'center';
    sc.fillText(state.label, x, 967);
    sc.textAlign = 'left';
  }
  sc.font = '16px sans-serif';
  sc.fillStyle = '#737363';
  sc.fillText('Настоящий рендер игры · сравнение при одной камере и освещении · фактура сохраняется в кэше', 36, 1015);
  writeFileSync('preview-stone-comparison.png', sheet.toBuffer('image/png'));
}

if (process.argv.includes('--preview') && existsSync('preview-path-regular.png')) {
  const sheet = createCanvas(1440, 558),
    sc = sheet.getContext('2d');
  sc.fillStyle = '#ede7d6';
  sc.fillRect(0, 0, 1440, 558);
  sc.fillStyle = '#414c3c';
  sc.font = '23px serif';
  sc.fillText('Было: одинаковый шаг и форма', 24, 35);
  sc.fillText('Теперь: неровная каменная «лестница»', 744, 35);
  sc.drawImage(await loadImage('preview-path-regular.png'), 0, 54, 720, 489);
  sc.drawImage(canvas, 720, 54, 720, 489);
  writeFileSync('preview-path.png', sheet.toBuffer('image/png'));
}
