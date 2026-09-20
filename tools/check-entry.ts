/** Garden chooser: explicit entry, creation, safe deferred loading and no placeholder writes. */
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { createCanvas } from '@napi-rs/canvas';
import { GardenStore } from '../src/world/gardens';
import { World } from '../src/world/world';
import { serializeSave } from '../src/world/saveFormat';
import { GardensPanel } from '../src/ui/gardensPanel';
import { PRESETS } from '../src/world/presets';
import { StartScreen, type StartGardenOptions, type StartScreenOptions } from '../src/ui/startScreen';

const dom = new JSDOM('<!doctype html><body></body>', { url: 'https://garden.test', pretendToBeVisual: true });
const win = dom.window;
let frameId = 0;
const frames = new Map<number, FrameRequestCallback>();
Object.assign(globalThis, {
  window: win,
  document: win.document,
  localStorage: win.localStorage,
  matchMedia: () => ({ matches: false }),
  requestAnimationFrame: (f: FrameRequestCallback) => {
    frames.set(++frameId, f);
    return frameId;
  },
  cancelAnimationFrame: (id: number) => frames.delete(id),
});
win.HTMLCanvasElement.prototype.getContext = (() => createCanvas(8, 8).getContext('2d')) as never;
const allStorage = () =>
  Object.fromEntries(
    Array.from({ length: localStorage.length }, (_, i) => {
      const k = localStorage.key(i)!;
      return [k, localStorage.getItem(k)];
    }).sort((a, b) => a[0]!.localeCompare(b[0]!)),
  );
const slot = (id: string) => `usadba.garden.${id}`;

// Fresh visits neither manufacture a phantom slot nor save an unchosen garden.
const store = new GardenStore({ deferEmpty: true });
assert.deepEqual(store.list, []);
assert.equal(localStorage.length, 0);
const world = new World();
const first = store.create(world, undefined, { saveCurrent: false });
assert.equal(first.name, 'Усадьба');
world.place('rock_mid', 3, 11)!.seed = 919;
store.save(world);
const firstSave = localStorage.getItem(slot(first.id));
// This world is deliberately not the active slot. It must never overwrite it while creating/opening.
const placeholder = new World();
placeholder.objects = [];
const second = store.create(placeholder, 'Камышовая заводь', { mode: 'grow', saveCurrent: false, seed: 123 });
const secondSave = localStorage.getItem(slot(second.id));
assert.equal(localStorage.getItem(slot(first.id)), firstSave);
assert.ok(placeholder.grow);
const beforeMetadata = allStorage(),
  chooserStore = new GardenStore({ deferEmpty: true });
assert.deepEqual(allStorage(), beforeMetadata, 'reading the index does not load/save a garden');
assert.ok(chooserStore.open(placeholder, first.id));
assert.equal(localStorage.getItem(slot(second.id)), secondSave, 'entering another slot never saves the placeholder');
assert.equal(serializeSave(placeholder.toJSON()), firstSave);
placeholder.objects = [];
assert.ok(chooserStore.open(placeholder, first.id), 'the last active slot can be explicitly reopened');
assert.equal(serializeSave(placeholder.toJSON()), firstSave);
assert.ok(
  chooserStore.open(placeholder, second.id),
  'renamed growing gardens are selected by ID, not a name heuristic',
);
assert.ok(placeholder.grow);
assert.equal(chooserStore.active?.name, 'Камышовая заводь');

for (const p of PRESETS) {
  const previous = chooserStore.activeId,
    previousSave = localStorage.getItem(slot(previous));
  placeholder.objects = [];
  const garden = chooserStore.create(placeholder, p.name, { preset: p.id, saveCurrent: false });
  assert.equal(localStorage.getItem(slot(previous)), previousSave);
  assert.equal(garden.name, p.name);
  assert.equal(placeholder.grow, null);
  const reopened = new World();
  assert.ok(chooserStore.open(reopened, garden.id));
  assert.equal(serializeSave(reopened.toJSON()), serializeSave(placeholder.toJSON()));
}
// The new explicit-open path retains the existing backup recovery.
localStorage.setItem(slot(first.id), '{broken');
localStorage.setItem(slot(first.id) + '.bak', firstSave!);
assert.ok(chooserStore.open(placeholder, first.id));
assert.equal(localStorage.getItem(slot(first.id)), firstSave);
// A failed selection stays at the door, preserves the world and quarantines rather than overwrites bad data.
const active = chooserStore.activeId,
  original = serializeSave(placeholder.toJSON());
localStorage.setItem(slot(second.id), '{broken');
localStorage.removeItem(slot(second.id) + '.bak');
assert.equal(chooserStore.open(placeholder, second.id), false);
assert.equal(chooserStore.activeId, active);
assert.equal(serializeSave(placeholder.toJSON()), original);
assert.ok(localStorage.getItem(slot(second.id) + '.broken')?.includes('{broken'));
assert.equal(chooserStore.open(placeholder, 'missing'), false);
assert.equal(localStorage.getItem(slot(first.id)), firstSave);

// Migration is still available from the front door, without deleting the original single save.
localStorage.clear();
localStorage.setItem('usadba.save.v3', firstSave!);
const migrated = new GardenStore({ deferEmpty: true });
assert.equal(migrated.list.length, 1);
assert.ok(migrated.open(placeholder, migrated.activeId));
assert.equal(serializeSave(placeholder.toJSON()), firstSave);
assert.equal(localStorage.getItem('usadba.save.v3'), firstSave);

function screen(extra: Partial<StartScreenOptions> = {}) {
  const s = new StartScreen({
    hour: () => 12,
    motion: false,
    gardens: [],
    activeId: '',
    onOpen: () => false,
    onCreate: () => false,
    onEnter: () => {},
    ...extra,
  });
  s.mount(document.body);
  return s;
}
const query = <T extends HTMLElement>(s: StartScreen, selector: string) => s.el.querySelector<T>(selector)!;
let entered = 0;
const opened: string[] = [];
const malicious = '<img src=x onerror=alert(1)>',
  meta = [
    { id: 'healthy', name: malicious, saved: 5, objects: 42 },
    { id: 'bad', name: 'Прошлая усадьба', saved: 1, objects: 20 },
  ];
migrated.rename(migrated.activeId, malicious);
const panel = new GardensPanel(document.body, placeholder, migrated, { onSwitch: () => {}, toast: () => {} });
panel.setOpen(true);
assert.equal(document.querySelector('.gp-name')!.textContent, malicious);
assert.equal(document.querySelector('.gardens-panel img'), null, 'the in-garden list also treats names as text');
panel.setOpen(false);
const list = screen({
  gardens: meta,
  activeId: 'bad',
  onOpen: (id) => {
    opened.push(id);
    return id === 'healthy';
  },
  onEnter: () => entered++,
});
assert.equal(query(list, '.splash-garden').dataset.garden, 'bad', 'last active garden is first');
assert.equal(meta[0].id, 'healthy', 'sorting is not a write to store metadata');
assert.equal(list.el.querySelector('img'), null, 'garden names are text, never markup');
assert.ok(list.el.textContent?.includes(malicious));
list.el.click();
for (const key of ['Enter', ' ', 'Escape'])
  list.el.dispatchEvent(new win.KeyboardEvent('keydown', { key, bubbles: true }));
assert.deepEqual(opened, [], 'backdrop and unscoped keys cannot enter');
query<HTMLButtonElement>(list, '[data-garden="bad"]').click();
assert.equal(entered, 0);
assert.equal(query(list, '.splash-error').hidden, false);
assert.equal(list.el.classList.contains('hide'), false);
query<HTMLButtonElement>(list, '[data-garden="healthy"]').click();
query<HTMLButtonElement>(list, '[data-garden="healthy"]').click();
assert.deepEqual(opened, ['bad', 'healthy']);
assert.equal(entered, 1, 'entry is single-shot');

const created: { name: string; options: StartGardenOptions }[] = [];
let allowCreation = false;
const fresh = screen({
  onCreate: (name, options) => {
    created.push({ name, options });
    return allowCreation;
  },
  onEnter: () => entered++,
});
query<HTMLButtonElement>(fresh, '.splash-new').click();
assert.equal(query<HTMLFormElement>(fresh, 'form').hidden, false);
assert.equal(document.activeElement, query(fresh, '.splash-name'));
query<HTMLInputElement>(fresh, '.splash-name').value = '  Тихий берег  ';
fresh.el.dispatchEvent(new win.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
assert.equal(query<HTMLFormElement>(fresh, 'form').hidden, true);
assert.equal(created.length, 0, 'cancel does not create an empty slot');
query<HTMLButtonElement>(fresh, '.splash-new').click();
const select = query<HTMLSelectElement>(fresh, '.splash-template');
assert.equal(select.options.length, PRESETS.length + 2);
for (const choice of [...select.options]) {
  select.value = choice.value;
  select.dispatchEvent(new win.Event('change'));
  assert.ok(query(fresh, '.splash-template-hint').textContent!.length > 20);
  query<HTMLFormElement>(fresh, 'form').dispatchEvent(new win.Event('submit', { bubbles: true, cancelable: true }));
  assert.equal(query<HTMLFormElement>(fresh, 'form').hidden, false, 'failed creation retains the form');
}
assert.deepEqual(
  created.map((c) => c.options),
  [{ mode: 'free' }, { mode: 'grow' }, ...PRESETS.map((p) => ({ preset: p.id }))],
);
assert.ok(created.every((c) => c.name === 'Тихий берег'));
allowCreation = true;
query<HTMLFormElement>(fresh, 'form').dispatchEvent(new win.Event('submit', { bubbles: true, cancelable: true }));
query<HTMLFormElement>(fresh, 'form').dispatchEvent(new win.Event('submit', { bubbles: true, cancelable: true }));
assert.equal(created.length, PRESETS.length + 3);
assert.equal(entered, 2);
assert.equal(frames.size, 0, 'both closed menus cancel their artwork frames');
dom.window.close();
console.log(
  'ок: явный выбор сада, имена как текст, клавиши/отмена/ошибки, 8 вариантов создания, переименованный растущий сад, старые сохранения и отсутствие перезаписи фонового мира',
);
