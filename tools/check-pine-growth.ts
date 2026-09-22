/**
 * Модель роста сосны: три игровых дня, саженец против старых деревьев,
 * формат сохранения с восьмым знаком и прежние сохранения без него.
 *
 *   npx tsx tools/check-pine-growth.ts
 */

import assert from 'node:assert/strict';
import { createCanvas } from '@napi-rs/canvas';

const g = globalThis as Record<string, unknown>;
g.document = { createElement: () => createCanvas(8, 8) };
g.localStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };

const HOUR = 3600_000;

const { DAY_MS } = await import('../src/core/clock');
const { GROW_DAY_MS } = await import('../src/core/growClock');
const { PINE_GROW_DAYS, PINE_GROW_MS_FREE, PINE_GROW_MS_GROWING, pineGrowthAt, PINE_STAGES, pineStageOf } =
  await import('../src/world/pine');
const { World } = await import('../src/world/world');
const { parseSave, serializeSave, SAVE_VERSION } = await import('../src/world/saveFormat');
const { scanHabitat } = await import('../src/world/habitat');

assert.equal(PINE_GROW_DAYS, 3);
assert.equal(PINE_GROW_MS_FREE, 72 * HOUR, 'вольный сад: три игровых дня — 72 часа');
assert.equal(PINE_GROW_MS_GROWING, 15 * HOUR, 'растущий сад: игровой день короче — 15 часов');
assert.equal(GROW_DAY_MS * 3, PINE_GROW_MS_GROWING);
assert.equal(DAY_MS * 3, PINE_GROW_MS_FREE);

// Стадии покрывают весь рост без дыр и перекрытий.
assert.equal(PINE_STAGES[0].from, 0);
assert.equal(PINE_STAGES[PINE_STAGES.length - 1].to, 1);
for (let i = 1; i < PINE_STAGES.length; i++) assert.equal(PINE_STAGES[i].from, PINE_STAGES[i - 1].to);
assert.equal(pineStageOf(0).id, 'sprout');
assert.equal(pineStageOf(1).id, 'mature');
assert.equal(pineStageOf(0.5).id, 'young-pine');

// Часы роста: ноль на посадке, единица на третьем игровом дне, и не больше.
const now = Date.now();
assert.equal(pineGrowthAt(now, now, false), 0);
assert.equal(pineGrowthAt(now - 36 * HOUR, now, false), 0.5);
assert.equal(pineGrowthAt(now - 72 * HOUR, now, false), 1);
assert.equal(pineGrowthAt(now - 700 * HOUR, now, false), 1);
assert.equal(pineGrowthAt(now - 7.5 * HOUR, now, true), 0.5);
assert.equal(pineGrowthAt(now - 15 * HOUR, now, true), 1);
assert.equal(pineGrowthAt(NaN, now, false), 1, 'битые метки не ломают рост');

// Мир: новая сосна растёт, старые деревья и кусты — сразу взрослые.
const world = new World();
world.objects = [];
world.milestones = new Set();
world.noteObjectsChanged();
const fresh = world.place('pine', 12, 12, 0, now - 16 * HOUR)!;
assert.equal(fresh.young, 1, 'новая сосна помечена саженцем');
assert.ok(world.growth(fresh, now) < 1, 'саженец ещё не взрослый');
assert.ok(Math.abs(world.growth(fresh, now) - 16 / 72) < 1e-9, 'вольный сад считает от посадки');
const old = world.place('pine', 14, 12, 0, now - 30 * DAY_MS)!;
old.young = undefined; // так выглядит сосна из прежнего сохранения
assert.equal(world.growth(old, now), 1, 'старая сосна навсегда в своём выросшем виде');
const azalea = world.place('azalea', 16, 12)!;
assert.equal(azalea.young, undefined);
assert.equal(world.growth(azalea, now), 1, 'кусты саженцами не сажаются');

// Растущий сад: те же посадки взрослеют за 15 часов.
world.grow = {
  rect: { x: 0, y: 0, w: 26, h: 26 },
  seed: 7,
  bank: 3,
  tick: now,
  progress: 0,
  stage: 0,
  choosing: false,
};
assert.equal(world.growth(fresh, now), 1, 'в растущем саду 16 часов — уже взрослая (порог 15)');
world.grow = null;

// Веха «Старое дерево» не даётся за саженца, но приходит, когда тот вырос.
const solo = new World();
solo.objects = [];
solo.milestones = new Set();
solo.noteObjectsChanged();
const baby = solo.place('pine', 12, 12, 0, now - HOUR)!;
solo.observe(now, 'summer', false, false);
assert.ok(!solo.milestones.has('old_tree'), 'саженец — ещё не старое дерево');
solo.observe(now + 73 * HOUR, 'summer', false, false);
assert.ok(solo.milestones.has('old_tree'), 'выросшая сосна приносит веху');
assert.equal(baby.type, 'pine');

// Гости: к саженцу белка не селится, к взрослой сосне — да.
const habitatWorld = new World();
habitatWorld.objects = [];
habitatWorld.noteObjectsChanged();
habitatWorld.place('pine', 12, 12, 0, now - HOUR);
assert.equal(scanHabitat(habitatWorld).squirrelSpots.length, 0, 'саженец ещё не дом для белки');
habitatWorld.objects = [];
habitatWorld.noteObjectsChanged();
habitatWorld.place('pine', 12, 12, 0, now - 30 * DAY_MS);
const grown = habitatWorld.objects[0];
grown.young = undefined; // сосна из прежнего сохранения
assert.ok(scanHabitat(habitatWorld).squirrelSpots.length >= 1, 'взрослая сосна зовёт белку');

// Сохранение: восьмой знак переживает круг, прежние семизнаковые — взрослые.
const saveWorld = new World();
saveWorld.objects = [];
saveWorld.noteObjectsChanged();
saveWorld.place('pine', 8, 8, 0, now - 2 * HOUR);
const packed = serializeSave(saveWorld.toJSON());
assert.equal(SAVE_VERSION, 8);
const rows = (JSON.parse(packed) as { o: unknown[] }).o as number[][];
assert.equal(rows.length, 1);
assert.equal(rows[0].length, 8, 'саженец упакован восьмым знаком');
const back = new World();
assert.ok(back.fromJSON(JSON.parse(packed)));
assert.equal(back.objects[0].young, 1, 'саженец остаётся саженцем после загрузки');
assert.equal(back.objects[0].planted, saveWorld.objects[0].planted);
const [id, type, tx, ty, planted, rot, seed] = rows[0];
const legacy = {
  v: 7,
  t: (JSON.parse(packed) as { t: string }).t,
  o: [[id, type, tx, ty, planted, rot, seed]],
  n: 2,
  m: [],
  s: [],
  e: [],
};
const parsed = parseSave(legacy);
assert.ok(parsed, 'сохранение без восьмого знака открывается');
assert.equal(parsed!.objects[0].young, undefined, 'старая сосна читается взрослой');

console.log('ок: три игровых дня, саженец и старые деревья, веха, белка и прочные сохранения');
