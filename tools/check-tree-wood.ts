/** All pre-orchard trees: connected tapered wood, seasonal cache parity and render bounds. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { createCanvas } from '@napi-rs/canvas';
import { setImmediate as yieldNative } from 'node:timers/promises';
import { trunkCurve, woodFrame, woodPoint, branchSkeleton } from '../src/render/treeWood';
import { crownSites } from '../src/render/crownGeometry';
import { TREE_CROWNS, crownWidth } from '../src/world/canopy';
import { computeTime } from '../src/core/clock';
import { buildAtmosphere } from '../src/world/palette';
import { drawObject, setSkipShadows } from '../src/render/sprites';
import { drawCached, clearSprites, spriteStats } from '../src/render/spriteCache';
import { crownCacheTime } from '../src/world/phenology';
import { ITEMS } from '../src/world/catalog';
import { isFruitTree } from '../src/world/orchard';
import { World } from '../src/world/world';
Object.assign(globalThis, { document: { createElement: () => createCanvas(8, 8) } });
const types = ['sakura', 'maple', 'ginkgo', 'willow', 'persimmon', 'pine', 'bamboo', 'wisteria'];
assert.deepEqual(
  ITEMS.filter((i) => i.kind === 'tree' && !isFruitTree(i.id))
    .map((i) => i.id)
    .sort(),
  [...types].sort(),
);
const heights: Record<string, number> = { sakura: 96, maple: 92, ginkgo: 98, willow: 94, persimmon: 74 };
for (const type of Object.keys(heights))
  for (const seed of [17, 441, 2891, 9406])
    for (const scale of [0.18, 0.55, 1]) {
      const shape = TREE_CROWNS[type],
        sites = crownSites(seed, crownWidth(shape.crownW, seed) * scale, shape.crownH * scale, shape.layers);
      const trunk = trunkCurve(type, seed, 0, 0, heights[type] * scale, 7 * scale, 2 * scale);
      const wood = branchSkeleton(type, seed, trunk, sites, scale);
      assert.deepEqual(wood, branchSkeleton(type, seed, trunk, sites, scale), 'fixed anatomy, no RNG state');
      assert.equal(wood.branches.length, sites.length / 3);
      assert.equal(wood.twigs.length, sites.length);
      assert.ok(
        new Set(wood.branches.map((b) => b.a.y.toFixed(3))).size === wood.branches.length,
        'not one common broom junction',
      );
      for (const branch of wood.branches) {
        let distance = Infinity;
        for (let i = 0; i <= 1000; i++) {
          const p = woodPoint(trunk, i / 1000);
          distance = Math.min(distance, Math.hypot(p.x - branch.a.x, p.y - branch.a.y));
        }
        assert.ok(distance < 0.12 * scale, 'bough actually rooted on curved trunk');
      }
      for (const [i, twig] of wood.twigs.entries()) assert.deepEqual(twig.a, wood.branches[Math.floor(i / 3)].d);
      for (const curve of [trunk, ...wood.branches, ...wood.twigs]) {
        let radius = Infinity;
        for (let i = 0; i <= 24; i++) {
          const f = woodFrame(curve, i / 24);
          assert.ok(Object.values(f).every(Number.isFinite));
          assert.ok(f.r > 0 && f.r <= radius + 1e-10, 'positive taper, no swollen twig tips');
          radius = f.r;
          assert.ok(Math.abs(Math.hypot(f.nx, f.ny) - 1) < 1e-8);
        }
      }
    }
const canvas = createCanvas(480, 380),
  ctx = canvas.getContext('2d');
const date = (m: number) => new Date(2026, m, 15, 12).getTime();
const fixed = buildAtmosphere(computeTime(date(6)));
const world = new World(),
  saved = JSON.stringify(world.toJSON());
const hash = (data: Uint8ClampedArray) => createHash('sha256').update(data).digest('hex');
function render(type: string, month: number, seed: number, g: number, cached: boolean) {
  canvas.width = 480;
  const atm = { ...fixed, time: computeTime(crownCacheTime(type, seed, date(month))) };
  const d = {
    ctx: ctx as never,
    x: 240,
    y: 300,
    atm,
    g,
    obj: { id: 1, type, seed, rot: 0, tx: 0, ty: 0, planted: 0 },
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
  return ctx.getImageData(0, 0, 480, 380).data;
}
for (const type of types) {
  const variants = new Set<string>();
  for (const seed of [17, 441, 2891])
    for (const month of [0, 3, 6, 10])
      for (const g of [0.2, 1]) {
        const direct = render(type, month, seed, g, false),
          cached = render(type, month, seed, g, true);
        let total = 0,
          lost = 0;
        for (let i = 3; i < direct.length; i += 4)
          if (direct[i] > 30) {
            total++;
            if (cached[i] < 2) lost++;
          }
        assert.ok(
          total > 100 && lost / total < 0.009,
          `${type}/${seed}/${g}: no clipped roots or branch tips (${lost}/${total})`,
        );
        const hot = hash(cached);
        clearSprites();
        assert.equal(hash(render(type, month, seed, g, true)), hot);
        variants.add(hash(direct));
      }
  assert.ok(variants.size >= 12, `${type} retains seasonal/seed individuality`);
  await yieldNative();
}
assert.equal(JSON.stringify(world.toJSON()), saved);
assert.ok(spriteStats().size <= 420 && spriteStats().boxes <= 600);
console.log(
  'ок: all eight non-orchard trees, seeded curved trunks, distributed connected forks, positive tapered radii/local normals, 3 seeds × 4 seasons × 2 sizes, cache history/clipping, bounded caches and unchanged saves',
);
if (process.argv.includes('--preview')) {
  const out = createCanvas(1920, 730),
    c = out.getContext('2d');
  c.fillStyle = '#eee9db';
  c.fillRect(0, 0, 1920, 730);
  c.fillStyle = '#554b40';
  c.font = '26px sans-serif';
  c.fillText('Стволы и ветви · зимний силуэт и летняя крона', 24, 35);
  for (const [row, month] of [0, 6].entries()) {
    for (const [i, type] of types.entries()) {
      const x = i * 240,
        y = 55 + row * 330;
      c.fillStyle = row === 0 ? '#f6f3e9' : '#e8ecdc';
      c.fillRect(x + 5, y, 230, 320);
      c.save();
      c.translate(x + 120, y + 276);
      c.scale(1.2, 1.2);
      drawObject({
        ctx: c as never,
        x: 0,
        y: 0,
        atm: buildAtmosphere(computeTime(date(month))),
        g: 1,
        obj: { id: 1, type, seed: 441, rot: 0, tx: 0, ty: 0, planted: 0 },
        time: 0,
        wind: 0,
        alpha: 1,
      });
      c.restore();
      c.fillStyle = '#554b40';
      c.font = '17px sans-serif';
      c.fillText(ITEMS.find((i) => i.id === type)!.name, x + 16, y + 306);
    }
  }
  writeFileSync('preview-tree-wood.png', out.toBuffer('image/png'));
}
