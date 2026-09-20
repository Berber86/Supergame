/** Safe, deterministic, one-pass load-time thinning, including storage failures and backup access. */
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { GRID } from '../src/core/iso';
import { ITEMS } from '../src/world/catalog';
import { World } from '../src/world/world';
import { GardenStore } from '../src/world/gardens';
import { parseSave, serializeSave } from '../src/world/saveFormat';
import { newGrowState } from '../src/world/grow';
import { PRESETS, applyPreset } from '../src/world/presets';
import { landscapeGroup, thinLandscape, LANDSCAPE_LIMITS, DUPLICATE_RADIUS } from '../src/world/landscapeDensity';
import type { LandscapeGroup } from '../src/world/landscapeDensity';
import type { SaveData, PlacedObject } from '../src/world/types';
import { GardensPanel } from '../src/ui/gardensPanel';
import { LandscapeNotice } from '../src/ui/landscapeNotice';

const backing = new Map<string, string>();
const reads: string[] = [];
const writes: string[] = [];
let failWrite: (key: string) => boolean = () => false;
Object.assign(globalThis, {
  localStorage: {
    getItem: (key: string) => {
      reads.push(key);
      return backing.get(key) ?? null;
    },
    setItem: (key: string, value: string) => {
      if (failWrite(key)) {
        const error = new Error('full');
        error.name = 'QuotaExceededError';
        throw error;
      }
      writes.push(key);
      backing.set(key, value);
    },
    removeItem: (key: string) => backing.delete(key),
  },
});
const slot = (id: string) => `usadba.garden.${id}`;
const backup = (id: string) => slot(id) + '.before-thinning';
const resetStorage = () => {
  backing.clear();
  reads.length = writes.length = 0;
  failWrite = () => false;
};

function empty(): SaveData {
  const w = new World();
  w.objects = [];
  for (const tile of w.tiles)
    Object.assign(tile, { ground: 'grass', level: 0, water: false, indoor: false, veranda: false });
  w.nextId = 1;
  return w.toJSON();
}
function add(data: SaveData, type: string, n: number, tx = 12, ty = 18): PlacedObject[] {
  const objects: PlacedObject[] = [];
  for (let i = 0; i < n; i++) {
    const id = data.nextId++;
    const o = { id, type, tx, ty, planted: 1000 + id, rot: 0, seed: id * 37 };
    objects.push(o);
    data.objects.push(o);
  }
  return objects;
}
// Spread wider than DUPLICATE_RADIUS: a filler grove must never look like duplicates itself.
const SPARSE_STEP = DUPLICATE_RADIUS + 0.5;
function scatteredTrees(data: SaveData, n = 80): void {
  for (let i = 0; i < n; i++) add(data, 'pine', 1, 1 + SPARSE_STEP * (i % 10), 1 + SPARSE_STEP * Math.floor(i / 10));
}
const representatives: Record<LandscapeGroup, string> = {
  trees: 'maple',
  shrubs: 'azalea',
  plants: 'grass_tuft',
  habitat: 'feeder',
  rocks: 'rock_mid',
  lights: 'lantern_stone',
};

// Budgets are per group, not a blanket cap counting houses/furniture as vegetation.
for (const [group, type] of Object.entries(representatives) as [LandscapeGroup, string][]) {
  const d = empty(),
    limit = LANDSCAPE_LIMITS[group];
  add(d, type, limit);
  assert.equal(thinLandscape(d).objects, d.objects, `${group}: at the limit is a no-op`);
  const original = add(d, type, 1);
  const plan = thinLandscape(d);
  assert.equal(plan.removed, Math.ceil((limit * 2) / 3));
  assert.equal(plan.objects.length, d.objects.length - plan.removed);
  assert.equal(plan.objects[0], d.objects[0], 'keep the oldest original');
  assert.ok(!plan.objects.includes(original[0]), 'newest repetitions go first');
  assert.deepEqual(plan.groups, [
    { group, before: limit + 1, after: limit + 1 - plan.removed, removed: plan.removed, limit },
  ]);
}
for (const item of ITEMS) {
  if (item.tab === 'house' || item.tab === 'cat' || ['bridge', 'pavilion', 'creature'].includes(item.kind))
    assert.equal(landscapeGroup(item.id), null, item.id);
}
assert.equal(landscapeGroup('step_stone'), null, 'paths are construction, not clutter');
assert.equal(landscapeGroup('unknown_future_item'), null);
for (const id of ['feeder', 'birdbath', 'beehive', 'squirrel_feeder', 'turtle_log', 'shishi'])
  assert.equal(landscapeGroup(id), 'habitat');
for (const id of ['moss_clump', 'grass_tuft', 'lily', 'iris', 'fern', 'lotus', 'lilypad', 'reed', 'horsetail'])
  assert.equal(landscapeGroup(id), 'plants');
{
  const d = empty();
  add(d, 'table', 1000);
  add(d, 'cushion', 100);
  add(d, 'cat', 100);
  add(d, 'maple', 20);
  assert.equal(thinLandscape(d).objects, d.objects, 'protected items never push plants over their threshold');
}
{
  const d = empty();
  add(d, 'maple', 81);
  const plants = add(d, 'lily', 30),
    feeders = add(d, 'feeder', 20);
  const result = thinLandscape(d);
  assert.equal(result.removed, Math.ceil((80 * 2) / 3));
  assert.ok(
    [...plants, ...feeders].every((o) => result.objects.includes(o)),
    'only the over-budget group is thinned',
  );
}
// All same-type counts are shared, but different species never merge into a duplicate cluster.
{
  const d = empty();
  add(d, 'maple', 40);
  add(d, 'sakura', 41);
  const result = thinLandscape(d);
  assert.equal(result.objects.filter((o) => o.type === 'maple').length, 40 - Math.ceil((39 * 2) / 3));
  assert.equal(result.objects.filter((o) => o.type === 'sakura').length, 41 - Math.ceil((40 * 2) / 3));
}
// Across spatial bucket boundaries, true Euclidean distances, no accidental whole-bed chain merges.
for (const [x1, y1, x2, y2, expected] of [
  [12.49, 18, 12.51, 18, 1],
  [12, 18, 12 + DUPLICATE_RADIUS, 18, 1],
  [12, 18, 12 + DUPLICATE_RADIUS + 0.0001, 18, 0],
  [12, 18, 12 + DUPLICATE_RADIUS * 0.6, 18 + DUPLICATE_RADIUS * 0.6, 1],
  [12, 18, 12 + DUPLICATE_RADIUS * 0.8, 18 + DUPLICATE_RADIUS * 0.8, 0],
  [-0.05, 18, 0.05, 18, 0],
]) {
  const d = empty();
  scatteredTrees(d);
  add(d, 'maple', 1, x1, y1);
  add(d, 'maple', 1, x2, y2);
  assert.equal(thinLandscape(d).removed, expected, `distance ${x1},${y1} to ${x2},${y2}`);
}
{
  const d = empty();
  scatteredTrees(d);
  const a = add(d, 'maple', 1, 12, 18)[0],
    b = add(d, 'maple', 1, 12 + DUPLICATE_RADIUS * 0.8, 18)[0],
    c = add(d, 'maple', 1, 12 + DUPLICATE_RADIUS * 1.6, 18)[0];
  const result = thinLandscape(d);
  assert.ok(result.objects.includes(a) && !result.objects.includes(b) && result.objects.includes(c));
  assert.equal(result.removed, 1, 'a nearby chain is not one huge duplicate cluster');
}
for (const change of [{ level: 1 }, { water: true }, { indoor: true }, { veranda: true }]) {
  const d = empty();
  scatteredTrees(d);
  add(d, 'maple', 1, 12.9, 18.2);
  add(d, 'maple', 1, 13.1, 18.2);
  Object.assign(d.tiles[18 * GRID + 13], change);
  assert.equal(thinLandscape(d).removed, 0, 'opposite sides of a cliff/waterline/floor are separate plantings');
}
{
  const d = empty();
  for (let i = 0; i < 100; i++) add(d, 'pebbles', 1, SPARSE_STEP * (i % 10), SPARSE_STEP * Math.floor(i / 10));
  add(d, 'rock_trio', 1);
  add(d, 'rock_trio', 1)[0].rot = 1;
  assert.equal(thinLandscape(d).removed, 0, 'rotated stones keep their deliberate orientation');
}
// Two thirds of the extra copies, rounded up, without ever deleting the last object at a location.
for (const n of [2, 3, 4, 5, 21, 400]) {
  const d = empty();
  scatteredTrees(d);
  const same = add(d, 'maple', n);
  const result = thinLandscape(d);
  assert.equal(result.removed, Math.ceil(((n - 1) * 2) / 3));
  assert.ok(result.objects.includes(same[0]));
}
{
  const d = empty();
  add(d, 'maple', 2000);
  const original = d.objects.map((o) => ({ ...o }));
  d.objects[1999].planted = 0;
  const older = d.objects[1999];
  original[1999].planted = 0;
  const before = JSON.stringify(d);
  for (const o of d.objects) Object.freeze(o);
  Object.freeze(d.objects);
  const result = thinLandscape(d);
  assert.equal(JSON.stringify(d), before, 'plan does not mutate any save fields');
  assert.equal(
    result.objects.length,
    2000 - Math.ceil((1999 * 2) / 3),
    'exactly one pass, not a loop until below budget',
  );
  assert.ok(result.objects.includes(older), 'age takes precedence over ID');
  assert.deepEqual(
    result.objects,
    original.filter((o) => result.objects.some((r) => r.id === o.id)),
    'preserve fields and input order',
  );
  const reversed = thinLandscape({ ...d, objects: [...d.objects].reverse() });
  assert.deepEqual(
    result.objects.map((o) => o.id).sort((a, b) => a - b),
    reversed.objects.map((o) => o.id).sort((a, b) => a - b),
    'deterministic regardless of file order',
  );
}
{
  const d = empty();
  for (let i = 0; i < 100; i++) add(d, 'maple', 2, 1 + SPARSE_STEP * (i % 10), 1 + SPARSE_STEP * Math.floor(i / 10));
  const first = thinLandscape(d);
  assert.equal(first.objects.length, 100);
  assert.equal(
    thinLandscape({ ...d, objects: first.objects }).removed,
    0,
    'over-budget but distinct plantings are never deleted',
  );
}
// Starter, all presets and low-count gardens are byte-for-byte untouched by the new feature.
for (const preset of [null, ...PRESETS]) {
  const w = new World();
  if (preset) applyPreset(w, preset.id);
  const d = w.toJSON();
  assert.equal(thinLandscape(d).objects, d.objects, preset?.id ?? 'starter');
}
// Dense worst case: instrument Map lookups rather than relying on a flaky wall-clock FPS assertion.
{
  const d = empty();
  add(d, 'grass_tuft', 50_000);
  let lookups = 0;
  const get = Map.prototype.get;
  Map.prototype.get = function (k) {
    lookups++;
    return get.call(this, k);
  };
  const start = performance.now();
  let removed: number;
  try {
    removed = thinLandscape(d).removed;
  } finally {
    Map.prototype.get = get;
  }
  assert.equal(removed, Math.ceil((49_999 * 2) / 3));
  assert.ok(lookups < 50 * d.objects.length, `bounded bucket work: ${lookups}`);
  console.log(
    `  ок: 50 000 совпадающих растений → ${50_000 - removed}, ${Math.round(performance.now() - start)} мс, ${lookups} обращений к индексу`,
  );
}

function stored(data: SaveData) {
  resetStorage();
  const store = new GardenStore({ deferEmpty: true }),
    world = new World();
  const id = store.create(world, 'Зелёный угол', { saveCurrent: false }).id;
  world.applySave(data);
  assert.ok(store.save(world).ok);
  return { store, world, id, raw: backing.get(slot(id))! };
}
function overloaded(): SaveData {
  const d = empty();
  add(d, 'maple', 81);
  add(d, 'grass_tuft', 201);
  add(d, 'feeder', 25);
  for (const item of ITEMS) if (landscapeGroup(item.id) === null) add(d, item.id, 2, 3, 3);
  d.nextId = 10_000;
  d.milestones = ['grove', 'hundred'];
  d.chronicle = [{ id: 'meet_frog', at: 1_700_000_000_000 }];
  d.grow = newGrowState(101, 1_700_000_000_000);
  d.grow.rect = { x: 0, y: 0, w: 26, h: 26 };
  d.grow.bank = 1;
  d.grow.progress = 3;
  d.tiles[0].water = true;
  return d;
}
{
  const { store, world, id, raw } = stored(overloaded());
  const source = parseSave(JSON.parse(raw))!,
    planned = thinLandscape(source);
  const other = store.create(world, 'Другой сад').id,
    otherRaw = backing.get(slot(other));
  world.objects = []; // Deliberately NOT a loaded active world. Startup must not save this placeholder.
  writes.length = reads.length = 0;
  const reloaded = new GardenStore({ deferEmpty: true });
  assert.ok(
    reads.every((k) => k === 'usadba.gardens.v1'),
    'metadata-only constructor never cleans/reads slot bodies',
  );
  let delivered = 0;
  const apply = world.applySave.bind(world);
  world.applySave = (d) => {
    delivered = d.objects.length;
    apply(d);
  };
  assert.ok(reloaded.open(world, id));
  assert.equal(delivered, source.objects.length - planned.removed, 'the model never receives the excess objects');
  assert.equal(backing.get(slot(other)), otherRaw, 'unselected garden is untouched');
  assert.equal(backing.get(backup(id)), raw, 'backup is the exact original save');
  assert.equal(reloaded.lastThinning?.kind, 'thinned');
  assert.equal(reloaded.active?.objects, planned.objects.length);
  assert.equal(
    JSON.parse(backing.get('usadba.gardens.v1')!).list.find((m: any) => m.id === id).objects,
    planned.objects.length,
  );
  assert.deepEqual(parseSave(JSON.parse(serializeSave(world.toJSON()))), { ...source, objects: planned.objects });
  assert.ok(writes.indexOf(backup(id)) < writes.indexOf(slot(id)), 'backup commits before filtered save');
  assert.ok(parseSave(JSON.parse(backing.get(slot(id))!)));
  world.seenTabs.add('guests');
  for (let i = 0; i < 4; i++) assert.ok(reloaded.save(world).ok);
  assert.equal(backing.get(backup(id)), raw, 'autosaves never rotate away the thinning backup');
  assert.ok(reloaded.open(world, id));
  assert.equal(reloaded.lastThinning, null, 'under-budget reload does not thin a second time');
  assert.equal(backing.get(backup(id)), raw);
  assert.equal(world.nextId, 10_000, 'deleted IDs are never reused');
}
// Ordinary in-game switches, as well as the start chooser, run the same preparation.
{
  const { store, world, id } = stored(overloaded());
  store.create(world, 'Второй');
  assert.ok(store.switchTo(world, id));
  assert.equal(store.lastThinning?.kind, 'thinned');
}
{
  const d = empty();
  add(d, 'maple', 400);
  const { store, world, id } = stored(d);
  let before = 400;
  while (before > LANDSCAPE_LIMITS.trees) {
    const after = before - Math.ceil(((before - 1) * 2) / 3);
    assert.ok(store.open(world, id));
    assert.equal(world.objects.length, after);
    assert.equal(
      parseSave(JSON.parse(backing.get(backup(id))!))!.objects.length,
      before,
      'copy is from the last pass, not an autosave',
    );
    before = after;
  }
  assert.ok(store.open(world, id));
  assert.equal(world.objects.length, before);
  assert.equal(store.lastThinning, null);
  const lastBackup = backing.get(backup(id));
  store.create(world, 'Без очистки');
  assert.equal(store.lastThinning, null);
  assert.ok(store.remove(world, id));
  assert.equal(backing.get(backup(id)), undefined);
  assert.ok(lastBackup);
}
// Primary/backup/temp/pre-thinning recovery use the validated original, never a corrupt primary as backup.
for (const suffix of ['.bak', '.tmp', '.before-thinning']) {
  const { store, world, id, raw } = stored(overloaded());
  backing.set(slot(id), '{bad');
  backing.delete(slot(id) + '.bak');
  backing.set(slot(id) + suffix, raw);
  assert.ok(store.open(world, id));
  assert.equal(store.lastThinning?.kind, 'thinned');
  assert.equal(backing.get(backup(id)), raw);
  assert.equal(backing.get(slot(id) + '.bak'), raw);
  assert.ok(parseSave(JSON.parse(backing.get(slot(id))!)));
}
// On either backup or transaction failure, no deletion in memory and no partial filtered save.
for (const suffix of ['.before-thinning', '.tmp', '']) {
  const { store, world, id, raw } = stored(overloaded());
  const source = parseSave(JSON.parse(raw))!;
  failWrite = (k) => k === slot(id) + suffix;
  assert.ok(store.open(world, id));
  assert.equal(store.lastThinning?.kind, 'skipped');
  assert.deepEqual(world.objects, source.objects);
  assert.equal(backing.get(slot(id)), raw);
  assert.equal(backing.get(slot(id) + '.tmp'), undefined);
  failWrite = () => false;
  assert.ok(store.open(world, id));
  assert.equal(store.lastThinning?.kind, 'thinned');
}
{
  const { store, world, id, raw } = stored(overloaded());
  // Only TMP is healthy; a failed cleanup write must not lose that original across a restart.
  backing.set(slot(id), '{bad');
  backing.delete(slot(id) + '.bak');
  backing.set(slot(id) + '.tmp', raw);
  failWrite = (k) => k === slot(id);
  assert.ok(store.open(world, id));
  assert.equal(store.lastThinning?.kind, 'skipped');
  assert.equal(backing.get(backup(id)), raw);
  failWrite = () => false;
  const retry = new GardenStore({ deferEmpty: true });
  assert.ok(retry.open(world, id));
  assert.equal(retry.lastThinning?.kind, 'thinned');
}
// Invalid saves are still rejected, not silently "fixed" by throwing away problematic objects.
{
  const { store, world, id } = stored(overloaded());
  const invalid = JSON.parse(backing.get(slot(id))!);
  invalid.o[1][0] = invalid.o[0][0];
  backing.set(slot(id), JSON.stringify(invalid));
  backing.delete(slot(id) + '.bak');
  const before = serializeSave(world.toJSON());
  assert.equal(store.open(world, id), false);
  assert.equal(store.lastThinning, null);
  assert.equal(serializeSave(world.toJSON()), before);
  assert.ok(backing.get(slot(id) + '.broken'));
}
// Legacy single saves and imported files are covered too. Parsing/ordinary raw World copies remain lossless.
{
  resetStorage();
  const d = overloaded();
  backing.set(
    'usadba.save.v3',
    JSON.stringify({
      version: 3,
      tiles: d.tiles,
      objects: d.objects,
      nextId: d.nextId,
      milestones: d.milestones,
      seasons: d.seasons,
      seen: d.seen,
    }),
  );
  const store = new GardenStore({ deferEmpty: true }),
    world = new World();
  assert.equal(backing.get(backup(store.activeId)), undefined, 'migration does not thin until entry');
  assert.ok(store.open(world, store.activeId));
  assert.equal(store.lastThinning?.kind, 'thinned');
  assert.ok(backing.get('usadba.save.v3'));
}
for (const wrapped of [false, true]) {
  const { store, world, id, raw } = stored(empty());
  const original = serializeSave(overloaded());
  const file = wrapped
    ? JSON.stringify({ kind: 'usadba-garden', name: 'Из файла', data: JSON.parse(original) })
    : original;
  const imported = await store.importFile(world, { name: 'Сад.json', text: async () => file } as File);
  assert.ok(imported);
  assert.notEqual(store.activeId, id);
  assert.equal(store.lastThinning?.kind, 'thinned');
  assert.equal(backing.get(slot(id)), raw);
  assert.equal(backing.get(backup(store.activeId)), original);
}

// Notification and a real downloadable backup, including the gardens panel after notice dismissal.
{
  const { store, world, id, raw } = stored(overloaded());
  assert.ok(store.open(world, id));
  const dom = new JSDOM('<!doctype html><div id="app"><canvas id="garden" tabindex="-1"></canvas></div>', {
    url: 'https://garden.test',
  });
  Object.assign(globalThis, { window: dom.window, document: dom.window.document });
  let downloaded: Blob | undefined;
  URL.createObjectURL = (blob: Blob) => {
    downloaded = blob;
    return 'blob:backup';
  };
  URL.revokeObjectURL = () => {};
  dom.window.HTMLAnchorElement.prototype.click = function () {};
  const parent = document.getElementById('app')!;
  const notice = new LandscapeNotice(parent, store, world);
  notice.show(store.lastThinning);
  assert.equal(notice.el.hidden, false);
  assert.ok(notice.el.textContent?.includes(String(thinLandscape(parseSave(JSON.parse(raw))!).removed)));
  notice.el.querySelector<HTMLButtonElement>('.ln-backup')!.click();
  assert.ok(downloaded);
  const exported = JSON.parse(await downloaded!.text());
  assert.equal(exported.kind, 'usadba-garden');
  assert.deepEqual(exported.data, JSON.parse(raw));
  notice.el.querySelector<HTMLButtonElement>('.ln-close')!.click();
  assert.equal(notice.el.hidden, true);
  assert.equal(document.activeElement?.id, 'garden');
  reads.length = 0;
  const panel = new GardensPanel(parent, world, store, { onSwitch: () => {}, toast: () => {} });
  assert.equal(reads.length, 0, 'hidden panel only reads index metadata');
  assert.equal(document.querySelector<HTMLButtonElement>('.gp-backup')!.hidden, true);
  panel.setOpen(true);
  assert.equal(document.querySelector<HTMLButtonElement>('.gp-backup')!.hidden, false);
  panel.setOpen(false);
  assert.equal(document.querySelector<HTMLButtonElement>('.gp-backup')!.hidden, true);
  notice.show({ kind: 'skipped', gardenId: id, candidates: 20, reason: 'quota' });
  assert.ok(notice.el.textContent?.includes('Ничего не удалено'));
  notice.show(null);
  assert.equal(notice.el.hidden, true);
  dom.window.close();
}
console.log(
  'ок: пороги 6 групп, две трети дублей, границы/расстояния/виды/повороты, старейшие посадки, защищённые дома/мебель/животные, один проход, 50k объектов; загрузка/переключение/импорт/старые сады, резервная копия и её выгрузка, отказы хранилища без потерь',
);
