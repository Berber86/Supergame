/**
 * Рост всех деревьев: каждое новое дерево сажается саженцем и взрослеет
 * за три игровых дня; кроны лиственных и плодовых, бамбук и глициния
 * набираются по ступеням, а старые деревья остаются взрослыми.
 *
 *   npx tsx tools/check-tree-growth.ts
 */

import assert from 'node:assert/strict';
import { createCanvas } from '@napi-rs/canvas';

const g = globalThis as Record<string, unknown>;
g.document = { createElement: () => createCanvas(8, 8) };
g.localStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };

const HOUR = 3600_000;

const { DAY_MS } = await import('../src/core/clock');
const { GROW_DAY_MS } = await import('../src/core/growClock');
const { TREE_GROW_DAYS, TREE_GROW_MS_FREE, TREE_GROW_MS_GROWING, treeGrowthAt, TREE_GROW_STAGES, treeStageOf } =
  await import('../src/world/treeGrowth');
const { World } = await import('../src/world/world');
const { serializeSave } = await import('../src/world/saveFormat');
const { scanHabitat } = await import('../src/world/habitat');
const { treeProfile } = await import('../src/world/treeHabits');
const { treeGeometry } = await import('../src/render/treeGeometry');
const { orchardGeometry } = await import('../src/render/sprites/orchard');

assert.equal(TREE_GROW_DAYS, 3);
assert.equal(TREE_GROW_MS_FREE, 72 * HOUR, 'вольный сад: три игровых дня — 72 часа');
assert.equal(TREE_GROW_MS_GROWING, 15 * HOUR, 'растущий сад: игровой день короче — 15 часов');
assert.equal(GROW_DAY_MS * 3, TREE_GROW_MS_GROWING);
assert.equal(DAY_MS * 3, TREE_GROW_MS_FREE);

// Ступени покрывают весь рост без дыр и перекрытий.
assert.equal(TREE_GROW_STAGES.length, 5);
assert.equal(TREE_GROW_STAGES[0].from, 0);
assert.equal(TREE_GROW_STAGES[TREE_GROW_STAGES.length - 1].to, 1);
for (let i = 1; i < TREE_GROW_STAGES.length; i++) assert.equal(TREE_GROW_STAGES[i].from, TREE_GROW_STAGES[i - 1].to);
assert.equal(treeStageOf(0).id, 'sprout');
assert.equal(treeStageOf(0.5).id, 'young-tree');
assert.equal(treeStageOf(1).id, 'mature');

// Часы роста единые для всех деревьев.
const now = Date.now();
assert.equal(treeGrowthAt(now, now, false), 0);
assert.equal(treeGrowthAt(now - 36 * HOUR, now, false), 0.5);
assert.equal(treeGrowthAt(now - 72 * HOUR, now, false), 1);
assert.equal(treeGrowthAt(now - 7.5 * HOUR, now, true), 0.5);
assert.equal(treeGrowthAt(now - 15 * HOUR, now, true), 1);

const TREES = [
  'pine',
  'sakura',
  'maple',
  'bamboo',
  'willow',
  'ginkgo',
  'wisteria',
  'persimmon',
  'ume',
  'nashi',
  'peach',
  'yuzu',
];

// Мир: каждое новое дерево — саженец; старые и кусты — сразу взрослые.
const world = new World();
world.objects = [];
world.milestones = new Set();
world.noteObjectsChanged();
const fresh = new Map<string, ReturnType<World['place']>>();
TREES.forEach((type, i) => {
  const obj = world.place(type, 4 + i * 3, 12, 0, now - 16 * HOUR);
  assert.ok(obj, `${type} сажается`);
  assert.equal(obj!.young, 1, `${type} помечен саженцем`);
  fresh.set(type, obj);
});
for (const type of TREES) {
  const growth = world.growth(fresh.get(type)!, now);
  assert.ok(Math.abs(growth - 16 / 72) < 1e-9, `${type}: 16 часов из 72 — ещё растёт`);
}
// Рост пересчитывается не чаще раза в час: внутри часа стадия прежняя,
// после часа — честно продолжается.
const snap = world.growth(fresh.get('sakura')!, now);
assert.equal(world.growth(fresh.get('sakura')!, now + 59 * 60_000), snap, 'внутри часа рост не пересчитывается');
assert.ok(world.growth(fresh.get('sakura')!, now + 61 * 60_000) > snap, 'спустя час рост продолжается');
// Без флага «саженец» дерево навсегда взрослое — так выглядят старые сохранения.
for (const type of TREES) fresh.get(type)!.young = undefined;
for (const type of TREES) assert.equal(world.growth(fresh.get(type)!, now), 1, `${type}: старое дерево взрослое`);
// Кусты саженцами не сажаются.
const shrub = world.place('azalea', 4, 16)!;
assert.equal(shrub.young, undefined);
assert.equal(world.growth(shrub, now), 1);

// Растущий сад: те же посадки взрослеют за 15 часов.
world.grow = {
  rect: { x: 0, y: 0, w: 40, h: 40 },
  seed: 7,
  bank: 3,
  tick: now,
  progress: 0,
  stage: 0,
  choosing: false,
};
for (const type of ['sakura', 'ume', 'bamboo'])
  assert.equal(world.growth(fresh.get(type)!, now), 1, `${type}: в растущем саду 16 часов — уже взрослое`);
world.grow = null;

// Веха «Старое дерево» не даётся за саженца, но приходит, когда тот вырос.
const solo = new World();
solo.objects = [];
solo.milestones = new Set();
solo.noteObjectsChanged();
const baby = solo.place('sakura', 12, 12, 0, now - HOUR)!;
solo.observe(now, 'summer', false, false);
assert.ok(!solo.milestones.has('old_tree'), 'саженец — ещё не старое дерево');
solo.observe(now + 73 * HOUR, 'summer', false, false);
assert.ok(solo.milestones.has('old_tree'), 'выросшая сакура приносит веху');
assert.equal(baby.type, 'sakura');

// Гости: саженец клёна ещё не зовёт белку, взрослый клён — да.
const habitatWorld = new World();
habitatWorld.objects = [];
habitatWorld.noteObjectsChanged();
habitatWorld.place('maple', 12, 12, 0, now - HOUR);
assert.equal(scanHabitat(habitatWorld).squirrelSpots.length, 0, 'саженец ещё не дом для белки');
habitatWorld.objects = [];
habitatWorld.noteObjectsChanged();
habitatWorld.place('maple', 12, 12, 0, now - 30 * DAY_MS);
habitatWorld.objects[0].young = undefined; // дерево из прежнего сохранения
assert.ok(scanHabitat(habitatWorld).squirrelSpots.length >= 1, 'взрослый клён зовёт белку');

// Кроны набираются по ступеням и детерминированы; взрослый силуэт неизменен.
const mapleProfile = treeProfile('maple', 5)!;
const counts: number[] = [];
for (const growth of [0.05, 0.2, 0.4, 0.6, 0.8, 1]) {
  const geom = treeGeometry(mapleProfile, 5, growth);
  counts.push(geom.sites.length);
  const full = (mapleProfile.layers + 2) * 3;
  assert.ok(geom.sites.length >= 0 && geom.sites.length <= full);
}
assert.equal(counts[0], 0, 'совсем свежий саженец — голый стебель без кроны');
assert.ok(counts[1] > 0, 'первый пучок листвы появляется на макушке');
for (let i = 1; i < counts.length; i++) assert.ok(counts[i] >= counts[i - 1], 'площадки кроны только прибывают');
assert.equal(counts[counts.length - 1], (mapleProfile.layers + 2) * 3, 'взрослая крона полная');
assert.deepEqual(treeGeometry(mapleProfile, 5, 1), treeGeometry(mapleProfile, 5, 1), 'взрослый силуэт детерминирован');
assert.deepEqual(
  treeGeometry(mapleProfile, 5, 0.4),
  treeGeometry(mapleProfile, 5, 0.4),
  'промежуточный силуэт детерминирован',
);

// Плодовые: та же лестница роста.
const umeFull = orchardGeometry('ume', 9, 1).sites.length;
const umeYoung = orchardGeometry('ume', 9, 0.12).sites.length;
assert.ok(umeYoung >= 3 && umeYoung < umeFull, 'молодая умэ с макушкой, но без всей кроны');
assert.deepEqual(orchardGeometry('ume', 9, 1), orchardGeometry('ume', 9, 1), 'взрослая умэ детерминирована');

// Сохранение: восьмой знак у саженца любой породы.
const saveWorld = new World();
saveWorld.objects = [];
saveWorld.noteObjectsChanged();
saveWorld.place('sakura', 8, 8, 0, now - 2 * HOUR);
const packed = serializeSave(saveWorld.toJSON());
const rows = (JSON.parse(packed) as { o: unknown[] }).o as number[][];
assert.equal(rows.length, 1);
assert.equal(rows[0].length, 8, 'саженец упакован восьмым знаком');
const back = new World();
assert.ok(back.fromJSON(JSON.parse(packed)));
assert.equal(back.objects[0].young, 1, 'саженец остаётся саженцем после загрузки');
assert.equal(back.objects[0].type, 'sakura');

console.log('ок: все двенадцать деревьев растут саженцами три игровых дня, кроны по ступеням, старые — взрослые');
