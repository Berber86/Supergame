/** Event-backed lizard milestones: real outcomes, old saves, quiet deduplication and shipped art. */
import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';
import { register } from 'node:module';
import { JSDOM } from 'jsdom';
import { History } from '../src/core/history';
import { loadImage } from '@napi-rs/canvas';
import { computeTime } from '../src/core/clock';
import { World } from '../src/world/world';
import { newGrowState } from '../src/world/grow';
import { scanHabitat, invitations, type Habitat } from '../src/world/habitat';
import { Lizards, makeLizard, LIZARD_BASK_MS, LIZARD_STRIKE_MS } from '../src/world/lizards';
import type { Threat } from '../src/world/residents';
import type { Flutter } from '../src/world/life';
import { CHRONICLE } from '../src/world/chronicle';
import { MILESTONES } from '../src/world/catalog';
import { serializeSave } from '../src/world/saveFormat';
import { GUIDE_ANIMALS } from '../src/ui/animalGuideData';
import { CHRONICLE_IMAGES } from '../src/ui/chronicleArt';

const summer = computeTime(new Date(2026, 6, 15, 10).getTime());
function fixture() {
  const world = new World();
  world.objects = [];
  for (const tile of world.tiles)
    Object.assign(tile, { water: false, indoor: false, veranda: false, ground: 'soil', level: 0 });
  world.place('rock_mid', 9, 9);
  world.place('rock_mid', 11, 9);
  world.place('fern', 11, 11);
  world.chronicle = [];
  world.milestones.clear();
  world.pendingMilestones = [];
  world.pendingNotes = [];
  const h = scanHabitat(world),
    inv = { ...invitations(h, summer, null), lizard: 1 },
    stone = h.lizardSpots[0],
    a = makeLizard(43, stone),
    pop = new Lizards();
  Object.assign(a, {
    state: 'bask',
    alpha: 1,
    timer: 20000,
    duration: 20000,
    hunger: 1e6,
    lift: stone.lift,
    perchLift: stone.lift,
  });
  pop.agents = [a];
  const bugs: Flutter[] = [];
  function step(ms = 100, threats: Threat[] = [], habitat: Habitat = h, want = 1) {
    pop.update(world, habitat, { ...inv, lizard: want }, summer, ms, threats, bugs, []);
  }
  function run(ms: number, threats: Threat[] = [], habitat: Habitat = h, want = 1) {
    for (let elapsed = 0; elapsed < ms; elapsed += 100) step(Math.min(100, ms - elapsed), threats, habitat, want);
  }
  return { world, h, inv, stone, a, pop, bugs, step, run };
}

// Bask only after a continuous, visible rest on an actual sunny support surface.
const bask = fixture();
bask.run(LIZARD_BASK_MS - 100);
assert.equal(bask.world.hasEvent('lizard_bask'), false);
bask.step();
assert.ok(bask.world.hasEvent('lizard_bask') && bask.world.milestones.has('lizard_bask'));
bask.run(2000);
assert.equal(bask.world.chronicle.filter((e) => e.id === 'lizard_bask').length, 1);
for (const mode of ['ground', 'shade', 'removed', 'climbing', 'retiring'] as const) {
  const f = fixture();
  let h = f.h;
  if (mode === 'ground') f.a.lift = f.a.perchLift = 0;
  if (mode === 'shade') h = { ...h, trees: h.lizardSpots };
  if (mode === 'removed') h = { ...h, lizardSpots: [] };
  if (mode === 'climbing') f.a.lift = 0;
  f.run(mode === 'climbing' ? LIZARD_BASK_MS : 3000, [], h, mode === 'retiring' ? 0 : 1);
  assert.equal(f.world.hasEvent('lizard_bask'), false, `no bask award while ${mode}`);
}
const interrupted = fixture();
interrupted.run(1500);
interrupted.step(100, [], { ...interrupted.h, trees: interrupted.h.lizardSpots });
assert.equal(interrupted.a.basking, 0);
interrupted.run(1500);
assert.equal(interrupted.world.hasEvent('lizard_bask'), false, 'two short rests are not one continuous rest');
console.log('ок: солнечный камень, высота, непрерывный отдых; нет вех на земле, в тени и при уходе');

// The flee transition alone is insufficient: the lizard has to reach a real shelter.
const escape = fixture();
Object.assign(escape.a, { tx: 8, ty: 9.5, lift: 0, perchLift: 0 });
const threat = [{ x: 7.5, y: 9.5, r: 2.1 }];
escape.step(100, threat);
assert.equal(escape.a.state, 'flee');
assert.equal(escape.world.hasEvent('lizard_escape'), false);
for (let i = 0; i < 35 && escape.a.state !== 'hide'; i++) escape.step(100, threat);
assert.equal(escape.a.state, 'hide');
assert.ok(escape.world.hasEvent('lizard_escape') && escape.world.milestones.has('lizard_escape'));
assert.ok(escape.h.lizardShelters.some((p) => Math.hypot(p.x - escape.a.tx, p.y - escape.a.ty) < 0.16));
assert.deepEqual(
  escape.world.pendingNotes.find((e) => e.id === 'lizard_escape'),
  { id: 'lizard_escape', at: escape.world.chronicle[0].at, x: escape.a.tx, y: escape.a.ty },
);
const exposed = fixture();
exposed.run(2000, [{ x: exposed.a.tx, y: exposed.a.ty, r: 2 }], { ...exposed.h, lizardShelters: [] });
assert.equal(exposed.world.hasEvent('lizard_escape'), false, 'fading in place without shelter is not an escape');
const dusk = fixture();
dusk.run(5000, [], dusk.h, 0);
assert.equal(dusk.world.hasEvent('lizard_escape'), false, 'ordinary night/weather retirement is not an escape');
assert.equal(dusk.pop.agents.length, 0);
for (const mode of ['timeout', 'blocked'] as const) {
  const f = fixture();
  Object.assign(f.a, {
    state: 'flee',
    target: { x: 11.5, y: 9.5 },
    timer: mode === 'timeout' ? 1 : 2200,
    lift: 0,
    perchLift: 0,
  });
  if (mode === 'blocked') f.world.at(10, 9)!.water = true;
  for (let i = 0; i < 20 && f.a.state === 'flee'; i++) f.step();
  assert.equal(f.world.hasEvent('lizard_escape'), false, `no escape award for ${mode}`);
}
console.log('ок: побег засчитывается у настоящего укрытия, но не при угрозе, тайм-ауте или заблокированном пути');

function butterfly(f: ReturnType<typeof fixture>): Flutter {
  return {
    tx: f.a.tx + 0.2,
    ty: f.a.ty,
    alt: 0,
    vx: 0,
    vy: 0,
    valt: 0,
    target: null,
    timer: 5000,
    seed: 7,
    phase: 0,
    resting: 5000,
  };
}
for (const mode of ['caught', 'flies-away', 'escapes-strike', 'removed'] as const) {
  const f = fixture();
  const prey = butterfly(f);
  f.bugs.push(prey);
  Object.assign(f.a, { timer: 0, hunger: 0 });
  f.step();
  assert.equal(f.a.state, 'hunt');
  assert.equal(f.world.hasEvent('lizard_hunt'), false, 'stalking is not a catch');
  if (mode === 'flies-away') prey.resting = 0;
  else {
    for (let i = 0; i < 20 && f.a.state !== 'strike'; i++) f.step();
    assert.equal(f.a.state, 'strike');
    assert.equal(f.a.duration, LIZARD_STRIKE_MS);
    assert.equal(f.world.hasEvent('lizard_hunt'), false, 'the strike has to finish');
    if (mode === 'escapes-strike') prey.resting = 0;
    if (mode === 'removed') f.bugs.length = 0;
  }
  f.run(600);
  assert.equal(f.world.hasEvent('lizard_hunt'), mode === 'caught', mode);
  assert.equal(f.world.milestones.has('lizard_hunter'), mode === 'caught', mode);
  assert.equal(f.a.catches, mode === 'caught' ? 1 : 0, mode);
}
const groundHunt = fixture();
Object.assign(groundHunt.a, {
  state: 'hunt',
  target: { x: groundHunt.a.tx + 0.2, y: groundHunt.a.ty },
  timer: 1600,
  duration: 1600,
});
groundHunt.run(1000);
assert.ok(groundHunt.world.hasEvent('lizard_hunt'), 'completed ground-prey vignette also counts');
assert.equal(groundHunt.a.catches, 0, 'the two-butterfly limit is independent of local micro-prey');
const lostHunt = fixture();
Object.assign(lostHunt.a, { state: 'hunt', target: { x: 12, y: 9.5 }, timer: 1 });
lostHunt.run(600);
assert.equal(lostHunt.world.hasEvent('lizard_hunt'), false, 'timed-out approach is not an instant strike');
console.log('ок: охота на мелкую добычу и бабочку; нет награды за улетевшую добычу или незавершённый бросок');

const events = ['meet_lizard', 'lizard_bask', 'lizard_hunt', 'cat_lizard', 'lizard_escape'];
const recorded = fixture().world;
const epoch = Date.now();
for (const [i, event] of events.entries()) {
  const milestone = CHRONICLE[event].milestone!;
  assert.ok(MILESTONES[milestone]);
  assert.ok(recorded.noteEvent(event, epoch + i, 9.5, 9.5));
  assert.ok(recorded.milestones.has(milestone));
  assert.equal(recorded.noteEvent(event, epoch + 100 + i, 12, 12), false);
}
assert.equal(recorded.chronicle.length, 5);
assert.equal(recorded.pendingNotes.length, 5);
assert.equal(recorded.pendingMilestones.length, 5);
const history = new History(recorded);
history.begin('move a sunny stone');
const movedStone = recorded.objects[0];
assert.ok(recorded.moveObjectFree(movedStone, 10, 8));
assert.ok(history.commit());
assert.ok(history.undo());
for (const event of events) assert.ok(recorded.milestones.has(CHRONICLE[event].milestone!));
const saved = JSON.parse(serializeSave(recorded.toJSON()));
const restored = new World();
assert.ok(restored.fromJSON(saved));
assert.deepEqual([...restored.milestones], [...recorded.milestones]);
assert.deepEqual(
  restored.chronicle.map((e) => [e.id, e.at]),
  recorded.chronicle.map((e) => [e.id, e.at]),
);
assert.equal(restored.pendingNotes.length + restored.pendingMilestones.length, 0);
// Before the redesign only these three notes could exist, with just the guest milestone.
const legacy = {
  ...saved,
  m: [],
  c: saved.c.filter(([id]: [string, number]) => ['meet_lizard', 'cat_lizard', 'lizard_hunt'].includes(id)),
};
assert.ok(restored.fromJSON(legacy));
assert.deepEqual([...restored.milestones].sort(), ['lizard_guest', 'lizard_hunter', 'lizard_watch']);
assert.equal(restored.pendingNotes.length + restored.pendingMilestones.length, 0);
assert.ok(restored.fromJSON({ ...legacy, c: [] }));
assert.equal(restored.milestones.size, 0, 'no retrospective rewards without recorded events');
assert.ok(restored.fromJSON({ ...saved, c: undefined }));
assert.equal(restored.milestones.size, 5, 'earned milestones survive absent/trimmed chronicle notes');
const fog = fixture().world;
fog.grow = newGrowState(17, epoch);
fog.grow.rect = { x: 9, y: 9, w: 2, h: 2 };
for (const event of events) assert.equal(fog.noteEvent(event, epoch, 1, 1), false);
assert.equal(fog.chronicle.length + fog.milestones.size + fog.pendingNotes.length, 0);
console.log('ок: пять вех, дедупликация, сохранение, тихая миграция старых встреч и запрет событий из тумана');

// No external URLs or missing images: all five are distinct, small, decodable shipped assets.
const guide = GUIDE_ANIMALS.find((a) => a.id === 'lizard')!;
assert.deepEqual(
  guide.observations?.map((o) => o.event),
  events,
);
assert.equal(guide.animations.find((a) => a.id === 'strike')!.duration, LIZARD_STRIKE_MS);
assert.equal(new Set(events.map((id) => CHRONICLE_IMAGES[id])).size, 5);
let bytes = 0;
for (const id of events) {
  const path = CHRONICLE_IMAGES[id];
  assert.ok(path.startsWith('./images/chronicle/'));
  const publicPath = `public/${path.slice(2)}`;
  const data = readFileSync(publicPath);
  assert.equal(data.subarray(0, 4).toString(), 'RIFF');
  assert.equal(data.subarray(8, 12).toString(), 'WEBP');
  assert.deepEqual(data, readFileSync(path), `${id}: source and public copies must agree`);
  const image = await loadImage(data);
  assert.ok(image.width >= 600 && image.width <= 900 && image.height <= 600);
  assert.ok(statSync(publicPath).size < 150000, `${id}: optimized web asset, not a raw generated PNG`);
  bytes += data.length;
}
assert.ok(bytes < 500000);
console.log(`ок: 5 акварелей в энциклопедии и летописи, ${(bytes / 1024).toFixed(0)} КиБ суммарно`);

// The actual book and notification use these illustrations, not a disconnected asset list.
register(new URL('./_startup-css-hook.mjs', import.meta.url));
const dom = new JSDOM('<main></main>', { url: 'https://garden.example/', pretendToBeVisual: true });
Object.assign(globalThis, {
  window: dom.window,
  document: dom.window.document,
  requestAnimationFrame: (callback: FrameRequestCallback) => {
    callback(0);
    return 1;
  },
});
const { ChroniclePanel } = await import('../src/ui/chroniclePanel');
const { ChronicleToast } = await import('../src/ui/chronicleToast');
const parent = document.querySelector('main')!;
const panel = new ChroniclePanel(parent, recorded);
const beforeView = serializeSave(recorded.toJSON());
panel.setOpen(true);
assert.equal(parent.querySelectorAll('.ch-img').length, 5);
assert.equal(parent.querySelectorAll('.ch-mile').length, 5);
for (const id of events) {
  window.sessionStorage.clear();
  const toast = new ChronicleToast(parent, () => {});
  toast.push({ id, at: epoch, x: 9.5, y: 9.5 });
  assert.equal(parent.querySelector('.ct-img')?.getAttribute('src'), CHRONICLE_IMAGES[id]);
  toast.dispose();
}
assert.equal(serializeSave(recorded.toJSON()), beforeView, 'looking at illustrations never awards milestones');
dom.window.close();
console.log('ок: реальные картинки и вехи в DOM летописи и уведомлениях; просмотр не меняет сохранение');
