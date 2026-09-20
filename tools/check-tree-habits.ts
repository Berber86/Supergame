/** Stable same-species variety, connected bare wood, seasonal cache bounds and shared ecological dimensions. */
import assert from 'node:assert/strict';
import { createCanvas } from '@napi-rs/canvas';
import { writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { LEAFY_TREES, TREE_FORMS, treeProfile } from '../src/world/treeHabits';
import { treeGeometry } from '../src/render/treeGeometry';
import { woodPoint, woodFrame } from '../src/render/treeWood';
import { crownDimensions, canopyLeafDensity } from '../src/world/canopy';
import { leafGroup, plantYear, crownCacheTime } from '../src/world/phenology';
import { drawObject, setSkipShadows } from '../src/render/sprites';
import { drawCached, clearSprites, spriteStats } from '../src/render/spriteCache';
import { plantPose } from '../src/render/plantWind';
import { buildAtmosphere } from '../src/world/palette';
import { computeTime } from '../src/core/clock';
import { World } from '../src/world/world';
import { serializeSave } from '../src/world/saveFormat';
Object.assign(globalThis, { document: { createElement: () => createCanvas(8, 8) } });
const date = (m: number) => new Date(2026, m, 15, 12).getTime();
const seeds = Array.from({ length: 192 }, (_, i) => i);
const forms = LEAFY_TREES.map((type) =>
  TREE_FORMS.map((form) => seeds.find((s) => treeProfile(type, s)!.form === form)!),
);
const canvas = createCanvas(480, 410),
  ctx = canvas.getContext('2d');
const hash = (data: Uint8ClampedArray) => createHash('sha256').update(data).digest('hex');
let frames = 0;
for (const [row, type] of LEAFY_TREES.entries()) {
  const heights: number[] = [];
  for (const seed of [...seeds, -2147483648, 2147483647]) {
    const p = treeProfile(type, seed)!;
    assert.deepEqual(treeProfile(type, seed), p);
    assert.deepEqual(crownDimensions(type, seed), p);
    heights.push(p.height);
    const geometry = treeGeometry(p, seed, 1);
    assert.equal(geometry.sites.length, (p.layers + 2) * 3);
    assert.ok(geometry.sites.length <= 27);
    for (const branch of geometry.skeleton.branches) {
      let distance = Infinity;
      for (let j = 0; j <= 1000; j++) {
        const q = woodPoint(geometry.trunk, j / 1000);
        distance = Math.min(distance, Math.hypot(q.x - branch.a.x, q.y - branch.a.y));
      }
      assert.ok(distance < 0.22, 'branches attach to the actual curved trunk');
    }
    for (const curve of [geometry.trunk, ...geometry.skeleton.branches, ...geometry.skeleton.twigs]) {
      let radius = Infinity;
      for (let j = 0; j <= 12; j++) {
        const f = woodFrame(curve, j / 12);
        assert.ok(Object.values(f).every(Number.isFinite));
        assert.ok(f.r > 0 && f.r <= radius + 1e-9);
        radius = f.r;
      }
    }
    const young = treeGeometry(p, seed, 0.2);
    assert.ok(young.h < geometry.h);
    assert.equal(young.sites.length, geometry.sites.length);
    const state = plantYear(type, seed, date(9));
    const area =
      geometry.sites.reduce((sum, site) => {
        const l = leafGroup(state, seed, site.index);
        return sum + l.growth * l.retained * l.size ** 2;
      }, 0) / geometry.sites.length;
    assert.ok(Math.abs(area - canopyLeafDensity(type, seed, date(9))) < 1e-12);
    const pose = plantPose(type, seed, 1, 1000, { x: 1, y: 0, screenX: 1, screenY: 0, strength: 1 })!;
    assert.ok(pose.hinge > p.height * 0.2 && pose.hinge < p.height * 0.65);
  }
  assert.ok(Math.max(...heights) / Math.min(...heights) > 2.4, `${type}: not just small scale jitter`);
  for (const form of TREE_FORMS) {
    const group = seeds.map((s) => treeProfile(type, s)!).filter((p) => p.form === form);
    assert.ok(group.length > 25);
    assert.ok(new Set(group.map((p) => p.height)).size > 25);
    assert.ok(new Set(group.map((p) => p.layers)).size === 2, 'branch count varies within the habit');
  }
  const extremal = seeds.reduce((a, b) =>
    treeProfile(type, a)!.height + treeProfile(type, a)!.crownH >
    treeProfile(type, b)!.height + treeProfile(type, b)!.crownH
      ? a
      : b,
  );
  for (const seed of new Set([...forms[row], extremal, 441]))
    for (const month of [0, 3, 6, 9])
      for (const g of [0.2, 1]) {
        const atm = buildAtmosphere(computeTime(crownCacheTime(type, seed, date(month))));
        const d = {
          ctx: ctx as never,
          x: 240,
          y: 330,
          atm,
          g,
          obj: { id: 1, type, seed, rot: 0, tx: 0, ty: 0, planted: 0 },
          time: 0,
          wind: 0,
          alpha: 1,
        };
        setSkipShadows(true);
        canvas.width = 480;
        drawObject(d);
        const raw = ctx.getImageData(0, 0, 480, 410).data;
        canvas.width = 480;
        assert.ok(drawCached(d));
        const cached = ctx.getImageData(0, 0, 480, 410).data;
        setSkipShadows(false);
        let opaque = 0,
          lost = 0;
        for (let i = 3; i < raw.length; i += 4)
          if (raw[i] > 30) {
            opaque++;
            if (cached[i] < 2) lost++;
          }
        assert.ok(
          opaque > 100 && lost / opaque < 0.009,
          `${type}/${seed}/${month}/${g}: uncropped canopy and hanging shoots`,
        );
        for (let x = 0; x < 480; x++) assert.equal(raw[x * 4 + 3] + raw[(409 * 480 + x) * 4 + 3], 0);
        const warm = hash(cached);
        clearSprites();
        canvas.width = 480;
        setSkipShadows(true);
        drawCached(d);
        setSkipShadows(false);
        assert.equal(hash(ctx.getImageData(0, 0, 480, 410).data), warm);
        frames++;
      }
}
const world = new World(),
  before = serializeSave(world.toJSON()),
  loaded = new World();
assert.ok(loaded.fromJSON(JSON.parse(before)));
assert.deepEqual(
  loaded.objects.map((o) => treeProfile(o.type, o.seed)),
  world.objects.map((o) => treeProfile(o.type, o.seed)),
);
assert.equal(serializeSave(world.toJSON()), before);
assert.ok(spriteStats().size <= 420 && spriteStats().boxes <= 600);
console.log(`ок: пять пород × четыре формы, 970 сидов, ${frames} кадров, ветви/листопад/ветер/кэш/сохранения`);
if (process.argv.includes('--preview')) {
  const cv = createCanvas(1520, 1675),
    c = cv.getContext('2d');
  const labels = ['Клён', 'Сакура', 'Гинкго', 'Ива', 'Хурма'],
    names = ['Раскидистая', 'Стройная', 'Низкая', 'Наклонённая'];
  c.fillStyle = '#ede9db';
  c.fillRect(0, 0, 1520, 1675);
  for (const [row, type] of LEAFY_TREES.entries())
    for (const [col, seed] of forms[row].entries()) {
      c.fillStyle = '#e4e8d5';
      c.fillRect(col * 380 + 5, row * 335 + 5, 370, 325);
      c.save();
      c.translate(col * 380 + 190, row * 335 + 282);
      c.scale(1.14, 1.14);
      drawObject({
        ctx: c as never,
        x: 0,
        y: 0,
        atm: buildAtmosphere(computeTime(date([9, 3, 9, 6, 9][row]))),
        g: 1,
        obj: { id: 1, type, seed, rot: 0, tx: 0, ty: 0, planted: 0 },
        time: 0,
        wind: 0,
        alpha: 1,
      });
      c.restore();
      c.fillStyle = '#524c3d';
      c.font = '19px sans-serif';
      c.fillText(`${labels[row]} · ${names[col]}`, col * 380 + 22, row * 335 + 310);
    }
  writeFileSync('preview-tree-habits.png', cv.toBuffer('image/png'));
}
