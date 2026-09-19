/** Winter roofs: deterministic variation, clipped snow, cache invalidation, rotated small houses and new furniture. */
import assert from 'node:assert/strict';
import { createCanvas } from '@napi-rs/canvas';
import { createHash } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { DAY_MS, computeTime } from '../src/core/clock';
import { buildAtmosphere } from '../src/world/palette';
import { roofSnow, roofSnowKey, paintRoofSnow } from '../src/render/roofSnow';
import { SMALL_HOUSE_IDS, ITEM_BY_ID, footprint } from '../src/world/catalog';
import { furniturePoint } from '../src/render/sprites/furniture';
import { smallHouseSize, drawTeaHouse, drawTinyHouse, drawShed, drawPavilion } from '../src/render/sprites/smallHouses';
import { drawObject } from '../src/render/sprites';
import { setSkipShadows } from '../src/render/sprites/common';
import { clearSprites, drawCached, spriteFrame } from '../src/render/spriteCache';
import { World } from '../src/world/world';
import { applyPreset } from '../src/world/presets';
import { drawHouseRoof, findHouse, mainRoofSnowSeed } from '../src/render/building';
import { Scene } from '../src/render/scene';
import { makeRng } from '../src/core/rng';

Object.assign(globalThis, {
  document: { createElement: () => createCanvas(8, 8) },
  window: { devicePixelRatio: 1, innerWidth: 1200, innerHeight: 850 },
});
Math.random = makeRng(915);
const winter = buildAtmosphere(computeTime(new Date(2026, 11, 19, 13).getTime()));
const summer = buildAtmosphere(computeTime(new Date(2026, 5, 19, 13).getTime()));
const amounts = new Set<number>();
for (let seed = 0; seed < 80; seed++) {
  const state = roofSnow(winter, seed);
  amounts.add(state.amount);
  assert.deepEqual(roofSnow({ ...winter, time: { ...winter.time, now: winter.time.now + 1000 } }, seed), state);
  assert.equal(roofSnow(summer, seed).amount, 0);
}
assert.deepEqual([...amounts].sort(), [0, 0.48, 0.9]);
const periods = new Set(
  Array.from({ length: 20 }, (_, i) =>
    roofSnowKey({ ...winter, time: { ...winter.time, now: winter.time.now + i * 3 * DAY_MS } }, 17),
  ),
);
assert.ok(periods.size > 5, 'winter changes occasionally, not only between different houses');
const canvas = createCanvas(600, 440),
  ctx = canvas.getContext('2d'),
  dc = ctx as unknown as CanvasRenderingContext2D;
const digest = () =>
  createHash('sha256')
    .update(ctx.getImageData(0, 0, 600, 440).data)
    .digest('hex');
const drawers = { tea_house: drawTeaHouse, tiny_house: drawTinyHouse, shed: drawShed, pavilion: drawPavilion };
for (const type of SMALL_HOUSE_IDS)
  for (let rot = 0; rot < 4; rot++) {
    const size = smallHouseSize(type),
      f = footprint(ITEM_BY_ID.get(type)!, rot);
    const corners = [
      [-size.u / 2, -size.v / 2],
      [size.u / 2, -size.v / 2],
      [size.u / 2, size.v / 2],
      [-size.u / 2, size.v / 2],
    ];
    for (const [u, v] of corners) {
      const p = furniturePoint(rot, u, v),
        x = p.y / 56 + p.x / 112,
        y = p.y / 56 - p.x / 112;
      assert.ok(
        Math.abs(x) <= f.w / 2 && Math.abs(y) <= f.h / 2,
        'foundation and roof fit the actual legacy footprint',
      );
    }
    const obj = { id: 1, type, rot, seed: 17, tx: 0, ty: 0, planted: 0 },
      d = { ctx: dc, x: 300, y: 270, atm: winter, g: 1, obj, time: 1000, wind: 0, alpha: 1 };
    setSkipShadows(true);
    ctx.clearRect(0, 0, 600, 440);
    drawers[type as keyof typeof drawers](d);
    const direct = digest();
    ctx.clearRect(0, 0, 600, 440);
    drawObject(d);
    assert.equal(digest(), direct, 'seed must not randomly mirror architecture');
    const alpha = ctx.globalAlpha,
      transform = ctx.getTransform();
    drawObject({ ...d, alpha: 0.4 });
    assert.equal(ctx.globalAlpha, alpha);
    assert.deepEqual(ctx.getTransform(), transform);
    const later = Array.from({ length: 10 }, (_, i) => ({
      ...winter,
      time: { ...winter.time, now: winter.time.now + (i + 1) * 3 * DAY_MS },
    })).find((a) => roofSnow(a, 17).amount !== roofSnow(winter, 17).amount)!;
    ctx.clearRect(0, 0, 600, 440);
    spriteFrame();
    drawCached(d);
    const original = digest();
    ctx.clearRect(0, 0, 600, 440);
    drawCached({ ...d, atm: later });
    const refreshed = digest();
    assert.notEqual(refreshed, original, 'cached roof changes with snow period');
    clearSprites();
    ctx.clearRect(0, 0, 600, 440);
    drawCached({ ...d, atm: later });
    assert.equal(digest(), refreshed, 'warm and cold caches agree after the date changes');
  }
setSkipShadows(false);
// Isolated snow surface, outside alpha must remain zero. Renderer must not change caller state.
ctx.clearRect(0, 0, 600, 440);
ctx.globalAlpha = 0.6;
const alpha = ctx.globalAlpha;
const pts = [
  { x: 100, y: 100 },
  { x: 300, y: 100 },
  { x: 300, y: 260 },
  { x: 100, y: 260 },
];
paintRoofSnow(dc, winter, { amount: 0.9, seed: 17 }, pts, (u, v) => ({ x: 100 + 200 * u, y: 100 + 160 * v }));
assert.equal(ctx.globalAlpha, alpha);
const pixels = ctx.getImageData(0, 0, 600, 440).data;
let ink = 0;
for (let y = 0; y < 440; y++)
  for (let x = 0; x < 600; x++)
    if (pixels[(y * 600 + x) * 4 + 3]) {
      ink++;
      assert.ok(x >= 100 && x < 300 && y >= 100 && y < 260, 'snow cannot paint the sky or walls');
    }
assert.ok(ink > 10000);
ctx.globalAlpha = 1;
const w = new World();
w.born = 17;
const before = JSON.stringify(w.toJSON());
ctx.clearRect(0, 0, 600, 440);
ctx.save();
ctx.translate(230, -120);
drawHouseRoof(dc, w, winter, 1000);
ctx.restore();
const original = digest();
const loaded = new World();
loaded.fromJSON(w.toJSON());
ctx.clearRect(0, 0, 600, 440);
ctx.save();
ctx.translate(230, -120);
drawHouseRoof(dc, loaded, winter, 1000);
ctx.restore();
assert.equal(digest(), original, 'save/load preserves settled snow');
assert.equal(JSON.stringify(w.toJSON()), before);
for (const type of ['kotatsu', 'bookshelf', 'engawa_bench']) {
  assert.ok(w.unlocked.has(type));
  assert.ok(w.objects.some((o) => o.type === type));
  for (let rot = 0; rot < 4; rot++) {
    assert.ok(w.canPlace(type, 4, 4, rot));
    assert.ok(!w.canPlace(type, 26, 26, rot));
  }
}
for (const preset of ['tea', 'spring', 'path', 'village']) {
  const w = new World();
  applyPreset(w, preset);
  for (const type of ['kotatsu', 'bookshelf', 'engawa_bench'])
    assert.ok(
      w.unlocked.has(type) && w.itemAvailable(ITEM_BY_ID.get(type)!),
      `${preset}: new furniture is actually visible in the catalogue`,
    );
}
console.log(
  'ок: clear/patchy/heavy winter, stable frames and reload, four buildings × four rotations, snow clipping and date-aware caches',
);
if (process.argv.includes('--preview')) {
  const c = createCanvas(1250, 820),
    cx = c.getContext('2d');
  cx.fillStyle = '#e7e8e5';
  cx.fillRect(0, 0, c.width, c.height);
  const snowy = Array.from({ length: 80 }, (_, i) => i).find((i) => roofSnow(winter, i).amount === 0.9)!;
  const patchy = Array.from({ length: 80 }, (_, i) => i).find((i) => roofSnow(winter, i).amount === 0.48)!;
  for (const [index, type] of [...SMALL_HOUSE_IDS].entries())
    for (let row = 0; row < 2; row++) {
      const x = 150 + index * 310,
        y = 270 + row * 390;
      cx.save();
      cx.translate(x, y);
      cx.scale(0.95, 0.95);
      drawObject({
        ctx: cx as never,
        x: 0,
        y: 0,
        atm: row ? winter : summer,
        g: 1,
        obj: { id: index, type, rot: 0, seed: row ? (index % 2 ? snowy : patchy) : 17, tx: 0, ty: 0, planted: 0 },
        time: 1000,
        wind: 0,
        alpha: 1,
      });
      cx.restore();
      cx.fillStyle = '#4b5358';
      cx.font = '17px sans-serif';
      cx.fillText(ITEM_BY_ID.get(type)!.name, x - 120, y + 105);
    }
  writeFileSync('preview-winter-buildings.png', c.toBuffer('image/png'));
  for (const mode of ['clear', 'patchy', 'snowy', 'night', 'phone', 'village'] as const) {
    const w = new World();
    w.born =
      mode === 'clear'
        ? Array.from({ length: 80 }, (_, i) => i).find((i) => !roofSnow(winter, i).amount)!
        : mode === 'patchy'
          ? patchy
          : snowy;
    if (mode === 'village') applyPreset(w, 'village');
    const width = mode === 'phone' ? 430 : 1200,
      height = mode === 'phone' ? 800 : 850;
    const c = createCanvas(width, height);
    Object.assign(c, { clientWidth: width, clientHeight: height });
    const scene = new Scene(c as unknown as HTMLCanvasElement);
    scene.camera.zoom = mode === 'phone' ? 0.46 : mode === 'village' ? 1 : 1.05;
    scene.centerOn(mode === 'village' ? 12 : 6.4, mode === 'village' ? 11 : 5.5);
    scene.particles = false;
    const desired = mode === 'clear' ? 0 : mode === 'patchy' ? 0.48 : 0.9;
    const seed = mainRoofSnowSeed(findHouse(w) ?? { x0: 0, y0: 0, x1: 0, y1: 0, level: 0 });
    const snowDate = Array.from({ length: 20 }, (_, i) => ({
      ...winter,
      time: { ...winter.time, now: winter.time.now + i * 3 * DAY_MS },
    })).find((a) => roofSnow(a, seed).amount === desired)!;
    const atm = mode === 'night' ? buildAtmosphere(computeTime(snowDate.time.now + 10 * 3600000)) : snowDate;
    scene.render(w, atm, 1000, 16);
    writeFileSync(`preview-winter-${mode}.png`, c.toBuffer('image/png'));
  }
}
