/** Stripes follow the exact torso curves through sitting, washing and blended postures. */
import assert from 'node:assert/strict';
import { createCanvas } from '@napi-rs/canvas';
import { writeFileSync } from 'node:fs';
import { catTorso, traceCatTorso, catTabbyStripes } from '../src/render/catCoat';
import { catMotion, catPosture, CAT_STATES } from '../src/world/creatureMotion';
import { drawCat } from '../src/render/cats';
import { pigment } from '../src/render/animalBrush';
import type { Cat, CatState } from '../src/world/life';
import { buildAtmosphere } from '../src/world/palette';
import { computeTime } from '../src/core/clock';

const canvas = createCanvas(480, 320),
  ctx = canvas.getContext('2d');
const atm = buildAtmosphere(computeTime(new Date(2026, 8, 20, 14).getTime()));
function cat(state: CatState): Cat {
  return {
    id: 1,
    seed: 42,
    tx: 0,
    ty: 0,
    facing: 1,
    state,
    timer: 3000,
    target: null,
    phase: 0,
    speed: 0,
    home: null,
    guest: false,
    coat: 'grey',
    greet: 0,
    leaveAt: 0,
    stayAt: 0,
  };
}
function body(a: Cat, time = 760) {
  const p = catMotion(a, time),
    low = p.sleep + p.loaf;
  return catTorso(
    -5 - p.stretch * 3 - p.sit,
    -10 + low * 4 + p.sit * 4 - p.stretch * 3,
    4 - p.sit * 3 + p.stretch * 5,
    -10 - p.sit * 7 + low * 3.5 + p.stretch * 5,
  );
}
let skins = 0;
for (const from of CAT_STATES)
  for (const to of CAT_STATES)
    for (const mix of [0, 0.25, 0.5, 0.75, 1]) {
      const a = cat(to);
      const first = catPosture(from),
        second = catPosture(to);
      a.posture = Object.fromEntries(
        CAT_STATES.map((s) => [s, first[s] * (1 - mix) + second[s] * mix]),
      ) as typeof first;
      const torso = body(a),
        stripes = catTabbyStripes(torso, a.seed);
      assert.equal(stripes.length, 5);
      assert.deepEqual(stripes, catTabbyStripes(torso, a.seed));
      ctx.resetTransform();
      ctx.beginPath();
      traceCatTorso(ctx as never, torso);
      ctx.closePath();
      for (const stripe of stripes) {
        assert.equal(stripe.length, 26);
        for (const point of stripe) {
          assert.ok(Number.isFinite(point.x) && Number.isFinite(point.y));
          assert.ok(ctx.isPointInPath(point.x, point.y), `${from} → ${to}/${mix}: stripe stays on the torso`);
        }
      }
      skins++;
    }
const sit = body(cat('sit'));
const stripes = catTabbyStripes(sit, 42);
assert.ok(stripes[4][0].y < stripes[0][0].y - 6, 'markings climb the sitting spine instead of sharing one flat y');
assert.notDeepEqual(catTabbyStripes(body(cat('walk')), 42), stripes);
assert.deepEqual(catTabbyStripes(body(cat('wash')), 42), stripes, 'washing uses the same sitting skin');
// The two edges meet in a fine point; the midsection is broader, not a constant-width bar.
assert.ok(Math.hypot(stripes[0][0].x - stripes[0][25].x, stripes[0][0].y - stripes[0][25].y) < 1e-8);
assert.ok(Math.hypot(stripes[0][6].x - stripes[0][19].x, stripes[0][6].y - stripes[0][19].y) > 0.35);
console.log(`ок: ${skins} переходов поз, полосы внутри настоящего контура, наклон спины и сужающиеся концы`);

for (const coat of ['cream', 'grey', 'black', 'tortoise'] as const)
  for (const state of CAT_STATES)
    for (const facing of [-1, 1] as const) {
      const a = { ...cat(state), coat, facing },
        snapshot = structuredClone(a);
      canvas.width = 480;
      ctx.translate(240, 275);
      ctx.scale(7, 7);
      const before = ctx.getTransform(),
        alpha = ctx.globalAlpha;
      drawCat(ctx as never, a, 0, 0, atm, 760);
      assert.deepEqual(ctx.getTransform(), before);
      assert.equal(ctx.globalAlpha, alpha);
      assert.deepEqual(a, snapshot, 'painting does not change the living cat');
      const pixels = ctx.getImageData(0, 0, 480, 320).data;
      assert.ok(pixels.some((v, i) => i % 4 === 3 && v > 0));
      for (let x = 0; x < 480; x++) assert.ok(pixels[x * 4 + 3] === 0 && pixels[(319 * 480 + x) * 4 + 3] === 0);
    }
console.log('ок: 4 окраса × 6 состояний × 2 направления; сохранены позы, границы и чистота рендера');
// Test the real renderer as well: unused helper geometry would not fix the visible cat.
const detail = createCanvas(800, 900),
  dc = detail.getContext('2d');
const seated = cat('sit'),
  breath = 1 + catMotion(seated, 760).breath * 0.009;
dc.translate(480, 820);
dc.scale(20, 20);
drawCat(dc as never, seated, 0, 0, atm, 760);
dc.resetTransform();
function inkAt(x: number, y: number) {
  return [...dc.getImageData(Math.round(480 + x * 20), Math.round(820 + y * breath * 20), 1, 1).data];
}
function swatch(rgb: { r: number; g: number; b: number }) {
  dc.fillStyle = pigment(rgb, atm);
  dc.fillRect(0, 0, 2, 2);
  return [...dc.getImageData(0, 0, 1, 1).data];
}
const mark = swatch({ r: 87, g: 105, b: 108 });
for (const ribbon of stripes) {
  const middle = { x: (ribbon[6].x + ribbon[19].x) / 2, y: (ribbon[6].y + ribbon[19].y) / 2 };
  assert.deepEqual(inkAt(middle.x, middle.y), mark, 'the actual sitting cat paints each curved band');
}
assert.deepEqual(inkAt(4, -13.6), swatch({ r: 233, g: 234, b: 215 }), 'white bib stays unmarked');
console.log('ок: пиксели настоящего сидящего кота — все пять полос на местах, светлая грудка чистая');

if (process.argv.includes('--preview')) {
  const out = createCanvas(1200, 420),
    c = out.getContext('2d');
  c.fillStyle = '#f5efdf';
  c.fillRect(0, 0, 1200, 420);
  const examples = [
    { state: 'sit', coat: 'grey', label: 'Серый · сидит' },
    { state: 'sit', coat: 'cream', label: 'Кремовый · сидит' },
    { state: 'wash', coat: 'grey', label: 'Умывается' },
    { state: 'walk', coat: 'grey', label: 'Идёт' },
  ] as const;
  for (const [i, example] of examples.entries()) {
    c.save();
    c.translate(160 + i * 300, 325);
    c.scale(6.5, 6.5);
    drawCat(c as never, { ...cat(example.state), coat: example.coat }, 0, 0, atm, 760);
    c.restore();
    c.fillStyle = '#665c49';
    c.font = '20px sans-serif';
    c.fillText(example.label, 24 + i * 300, 380);
  }
  writeFileSync('preview-cat-stripes.png', out.toBuffer('image/png'));
}
