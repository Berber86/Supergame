/** Real meetings, not proximity rewards: reservations, completion, interruptions, FPS and save purity. */
import assert from 'node:assert/strict';
import { createCanvas } from '@napi-rs/canvas';
import { writeFileSync } from 'node:fs';
import { AnimalCompany, companyPath } from '../src/world/animalCompany';
import { Life, type Cat, type Bird } from '../src/world/life';
import { Wildlife, type Deer } from '../src/world/wildlife';
import { BirdBaths } from '../src/world/birdBaths';
import { World } from '../src/world/world';
import { scanHabitat, invitations } from '../src/world/habitat';
import { hash1 } from '../src/core/rng';
import { computeTime } from '../src/core/clock';
import { buildAtmosphere } from '../src/world/palette';
import { serializeSave } from '../src/world/saveFormat';
import { isoToScreen, LEVEL_H } from '../src/core/iso';
import { drawCat, drawBird } from '../src/render/creatures';
import { drawDeer } from '../src/render/deerTurtle';
import { drawObject } from '../src/render/sprites';
const time = computeTime(new Date(2026, 5, 15, 14).getTime()),
  atm = buildAtmosphere(time);
function garden() {
  const w = new World();
  w.objects = [];
  w.chronicle = [];
  for (const t of w.tiles) Object.assign(t, { ground: 'grass', level: 0, water: false, indoor: false, veranda: false });
  return w;
}
function cat(id: number, x = 9.5, y = 10.5): Cat {
  return {
    id,
    seed: id * 31,
    tx: x,
    ty: y,
    facing: 1,
    state: 'sit',
    timer: 1e6,
    target: null,
    phase: 0,
    speed: 0,
    home: null,
    guest: false,
    coat: id === 1 ? 'grey' : 'cream',
    greet: 0,
    leaveAt: 0,
    stayAt: 0,
  };
}
function deer(seed: number, x = 9.5, y = 10.5): Deer {
  return {
    seed,
    tx: x,
    ty: y,
    facing: 1,
    state: 'look',
    timer: 1e6,
    target: null,
    from: null,
    phase: 0,
    headLower: 0,
    coat: { spots: true, antlers: seed === 1, winter: false },
    born: 0,
    stay: 1e9,
  };
}
function bird(seed: number, x: number, y: number): Bird {
  return {
    seed,
    tx: x - 1,
    ty: y + 1,
    facing: 1,
    state: 'fly-in',
    timer: 0,
    target: { x, y },
    alt: 50,
    hop: 0,
    scale: 1,
    species: seed % 2 ? 'sparrow' : 'tit',
    place: 'bath',
    slot: 0,
  };
}
let catsGreeting: Cat[] = [],
  catsRest: Cat[] = [],
  deerGreeting: Deer[] = [],
  bathSharing: Bird[] = [];
// Standalone scheduler: one bounded encounter; both walk, stop, greet, settle and leave the reservation.
for (const fps of [30, 60, 144]) {
  const w = garden(),
    a = cat(1),
    b = cat(2, 10.5, 9.5),
    third = cat(3, 11, 10);
  const company = new AnimalCompany<Cat>('cat');
  const notes: string[] = [],
    dt = 1000 / fps;
  let greetingDistance = 0;
  for (let i = 0; i < fps * 35; i++) {
    company.update(
      w,
      [a, b, third],
      dt,
      () => true,
      (id) => notes.push(id),
    );
    assert.ok([a, b, third].filter((c) => c.company).length <= 2);
    if (a.company?.phase === 'greet') {
      const p = isoToScreen(a.tx, a.ty),
        q = isoToScreen(b.tx, b.ty);
      greetingDistance = Math.hypot(p.x - q.x, p.y - q.y);
      assert.ok(Math.abs(p.y - q.y) < 1e-8 && a.facing === -b.facing);
    }
  }
  assert.ok(Math.abs(greetingDistance - 28) < 1e-7);
  assert.deepEqual(notes, ['cats_greet', 'cats_rest']);
  assert.equal(a.company, undefined);
  assert.equal(b.company, undefined);
  assert.ok(a.gait! > 0 && b.gait! > 0, 'feet advance with the approach, not the render clock');
}
// Water, cliffs, walls and unopened land cannot create a social shortcut.
for (const barrier of ['water', 'height', 'house', 'fog', 'object']) {
  const w = garden(),
    a = cat(1, 9.5, 10.5),
    b = cat(2, 11.5, 10.5),
    company = new AnimalCompany<Cat>('cat');
  if (barrier === 'water') for (let y = 0; y < w.size; y++) w.at(10, y)!.water = true;
  if (barrier === 'height') for (let y = 0; y < w.size; y++) w.at(10, y)!.level = 2;
  if (barrier === 'house') for (let y = 0; y < w.size; y++) w.at(10, y)!.indoor = true;
  if (barrier === 'fog')
    w.grow = { rect: { x: 9, y: 10, w: 1, h: 2 }, seed: 1, bank: 0, tick: 0, progress: 0, stage: 0, choosing: false };
  if (barrier === 'object') w.objects.push({ id: 1, type: 'rock_big', tx: 10, ty: 10, rot: 0, seed: 1, planted: 0 });
  assert.equal(companyPath(w, { x: a.tx, y: a.ty }, { x: b.tx, y: b.ty }), false);
  const events: string[] = [];
  for (let i = 0; i < 200; i++)
    company.update(
      w,
      [a, b],
      50,
      () => true,
      (id) => events.push(id),
    );
  assert.equal(a.company, undefined);
  assert.deepEqual(events, []);
}
// Opposite sides of a height seam can each have a dry approach, but cannot touch noses.
{
  const w = garden(),
    a = cat(1, 9.75, 10.25),
    b = cat(2, 10.25, 9.75),
    c = new AnimalCompany<Cat>('cat');
  w.at(10, 9)!.level = 1;
  const before = JSON.stringify([a, b]);
  for (let i = 0; i < 300; i++)
    c.update(
      w,
      [a, b],
      20,
      () => true,
      () => assert.fail('meeting across a cliff'),
    );
  assert.equal(JSON.stringify([a, b]), before);
}
for (const interrupt of ['removed', 'rain', 'terrain']) {
  const w = garden(),
    a = cat(1),
    b = cat(2, 10.5, 9.5),
    c = new AnimalCompany<Cat>('cat'),
    events: string[] = [];
  for (let i = 0; i < 180; i++) {
    c.update(
      w,
      [a, b],
      50,
      () => true,
      (id) => events.push(id),
    );
    if (a.company?.phase === 'greet') break;
  }
  assert.equal(a.company?.phase, 'greet');
  if (interrupt === 'terrain') w.at(Math.floor(a.tx), Math.floor(a.ty))!.water = true;
  c.update(
    w,
    interrupt === 'removed' ? [a] : [a, b],
    50,
    () => interrupt !== 'rain',
    (id) => events.push(id),
  );
  assert.equal(a.company, undefined);
  assert.equal(b.company, undefined);
  assert.deepEqual(events, []);
  c.reset();
}
console.log('ок: 30/60/144 FPS, реальные подходы и паузы, один партнёр, преграды/туман/отмена и конечные встречи');
// Actual Life and Wildlife entry points run the scenes without developer triggers.
{
  const w = garden();
  w.place('cat', 9, 10)!.seed = 31;
  w.place('cat', 10, 9)!.seed = 62;
  const life = new Life();
  life.sync(w);
  for (const c of life.cats) Object.assign(c, { state: 'sit', timer: 1e6, target: null });
  const objects = JSON.stringify(w.objects);
  for (let i = 0; i < 1400; i++) {
    life.update(w, time, 20, i * 20);
    if (!catsGreeting.length && life.cats[0].company?.phase === 'greet' && life.cats[0].company.elapsed > 1400)
      catsGreeting = structuredClone(life.cats);
    if (!catsRest.length && life.cats[0].company?.phase === 'rest' && life.cats[0].company.elapsed > 3500)
      catsRest = structuredClone(life.cats);
  }
  assert.equal(catsGreeting.length, 2);
  assert.equal(catsRest.length, 2);
  assert.ok(w.chronicle.some((e) => e.id === 'cats_greet'));
  assert.ok(w.chronicle.some((e) => e.id === 'cats_rest'));
  assert.equal(JSON.stringify(w.objects), objects);
  life.reset();
  assert.equal(life.cats.length, 0);
  const save = serializeSave(w.toJSON()),
    loaded = new World();
  assert.ok(loaded.fromJSON(JSON.parse(save)));
  assert.equal(JSON.stringify(loaded.chronicle), JSON.stringify(w.chronicle));
}
{
  const w = garden(),
    h = scanHabitat(w),
    inv = invitations(h, time, null),
    wildlife = new Wildlife();
  wildlife.deer = [deer(1), deer(2, 10.5, 9.5)];
  const notes: string[] = [];
  for (let i = 0; i < 800; i++) {
    wildlife.update(h, inv, time, null, 20, i * 20, [], w);
    notes.push(...wildlife.takeNotes().map((n) => n.id));
    if (!deerGreeting.length && wildlife.deer[0].company?.phase === 'greet' && wildlife.deer[0].company.elapsed > 1400)
      deerGreeting = structuredClone(wildlife.deer);
  }
  assert.equal(deerGreeting.length, 2);
  assert.equal(notes.filter((n) => n === 'deer_nuzzle').length, 1);
  wildlife.reset();
  wildlife.deer = [deer(1), deer(2, 10.5, 9.5)];
  for (let i = 0; i < 320; i++) wildlife.update(h, inv, time, null, 20, i * 20, [], w);
  assert.ok(wildlife.deer.some((d) => d.company));
  const a = wildlife.deer[0];
  wildlife.update(h, inv, time, null, 20, 6400, [{ x: a.tx, y: a.ty, r: 2 }], w);
  assert.ok(wildlife.deer.every((d) => d.state === 'leave' && !d.company && d.target));
  assert.ok(!wildlife.takeNotes().some((n) => n.id === 'deer_nuzzle'));
}
// Visitors reserve different rims, take turns inside the *real* bowl and dry before departing.
const bathWorld = garden(),
  bath = bathWorld.place('birdbath', 9, 9)!;
bath.seed = 441;
{
  const life = new Life();
  (life as any).birdTimer = 1e6;
  life.birds = [bird(1, 9.5, 9.5), bird(2, 9.5, 9.5)];
  const observed = new Set<number>(),
    objects = JSON.stringify(bathWorld.objects);
  for (let i = 0; i < 1800; i++) {
    life.update(bathWorld, time, 20, i * 20);
    const bathing = life.birds.filter((b) => b.state === 'bathe' || b.state === 'drink');
    assert.ok(bathing.length <= 1, 'never two bodies occupying the water');
    for (const b of bathing) {
      observed.add(b.seed);
      assert.ok(Math.hypot(b.tx - 9.5, b.ty - 9.5) < 0.01);
      assert.ok(b.alt > 9 && b.alt < 12, 'feet on the bowl, not floating outside');
    }
    if (
      !bathSharing.length &&
      life.birds.some((b) => b.bathDry! > 0.15) &&
      bathing.some((b) => b.seed === 2 && b.state === 'bathe')
    )
      bathSharing = structuredClone(life.birds);
  }
  assert.deepEqual([...observed].sort(), [1, 2]);
  assert.equal(bathSharing.length, 2);
  assert.ok(bathWorld.chronicle.some((e) => e.id === 'birds_share_bath'));
  assert.ok(life.birds.every((b) => b.state === 'fly-out'));
  assert.equal(JSON.stringify(bathWorld.objects), objects);
}
// A fractional placement can overhang a lower cell. Even there, the feet stay on the bowl.
{
  const w = garden(),
    baths = new BirdBaths();
  w.place('birdbath', 9.5, 9.5)!.seed = 441;
  w.at(10, 10)!.level = 1;
  const b = { ...bird(1, 10, 10), state: 'perch' as Bird['state'], tx: 9.9, ty: 10.1 };
  for (let i = 0; i < 180; i++) {
    baths.update(
      [b],
      w,
      20,
      true,
      () => assert.fail('unexpected departure'),
      () => {},
    );
    const groundLevel = w.at(Math.floor(b.tx), Math.floor(b.ty))!.level;
    assert.ok(Math.abs(groundLevel * LEVEL_H + b.alt - (LEVEL_H + 10.6 * (0.88 + hash1(441, 29) * 0.24))) < 1e-7);
  }
}
for (const interrupt of ['removed', 'moved', 'raised', 'water', 'weather']) {
  const w = garden(),
    obj = w.place('birdbath', 9, 9)!;
  const baths = new BirdBaths();
  const b = { ...bird(1, 9.5, 9.5), state: 'perch' as const, tx: 9.4, ty: 9.6, alt: 10 };
  const events: string[] = [];
  const update = (allowed = true) =>
    baths.update(
      [b],
      w,
      50,
      allowed,
      (x) => (x.state = 'fly-out'),
      (id) => events.push(id),
    );
  for (let i = 0; i < 45; i++) update();
  if (interrupt === 'removed') w.removeObject(obj);
  if (interrupt === 'moved') {
    obj.tx += 2;
    w.noteObjectsChanged();
  }
  if (interrupt === 'raised') w.at(9, 9)!.level = 1;
  if (interrupt === 'water') w.at(9, 9)!.water = true;
  update(interrupt !== 'weather');
  assert.equal(b.state, 'fly-out');
  assert.equal(baths.owns(b), false);
  assert.deepEqual(events, []);
  baths.reset();
}
console.log(
  'ок: настоящая симуляция котов/оленей/птиц, очередь поилки, испуг/удаление/погода, события только после завершения и совместимые сохранения',
);

// Social posing is pure and leaves its caller's canvas state intact.
const probe = createCanvas(500, 420),
  pc = probe.getContext('2d');
for (const actors of [catsGreeting, catsRest, deerGreeting, bathSharing])
  for (const actor of actors) {
    probe.width = 500;
    pc.translate(250, 340);
    pc.scale(4, 4);
    const before = structuredClone(actor),
      matrix = pc.getTransform();
    if ('coat' in actor && typeof actor.coat === 'string') drawCat(pc as never, actor as Cat, 0, 0, atm, 760);
    else if ('coat' in actor) drawDeer(pc as never, actor as Deer, 0, 0, atm, 760);
    else drawBird(pc as never, actor as Bird, 0, 0, atm, 760);
    assert.deepEqual(actor, before);
    assert.deepEqual(pc.getTransform(), matrix);
    const pixels = pc.getImageData(0, 0, 500, 420).data;
    assert.ok(pixels.some((v, i) => i % 4 === 3 && v > 0));
    for (let x = 0; x < 500; x++) assert.equal(pixels[x * 4 + 3] + pixels[(419 * 500 + x) * 4 + 3], 0);
  }

if (process.argv.includes('--preview')) {
  const out = createCanvas(1380, 740),
    c = out.getContext('2d');
  c.fillStyle = '#f1ecde';
  c.fillRect(0, 0, 1380, 740);
  function cats(actors: Cat[], ox: number, oy: number) {
    const center = isoToScreen(10, 10);
    for (const a of actors) {
      const p = isoToScreen(a.tx, a.ty);
      drawCat(c as never, a, ox + p.x - center.x, oy + p.y - center.y, atm, 760);
    }
  }
  c.save();
  c.translate(230, 270);
  c.scale(3.5, 3.5);
  cats(catsGreeting, 0, 0);
  c.restore();
  c.save();
  c.translate(230, 610);
  c.scale(3.5, 3.5);
  cats(catsRest, 0, 0);
  c.restore();
  c.save();
  c.translate(710, 440);
  c.scale(3.3, 3.3);
  for (const a of deerGreeting) {
    const p = isoToScreen(a.tx, a.ty),
      center = isoToScreen(10, 10);
    drawDeer(c as never, a, p.x - center.x, p.y - center.y, atm, 760);
  }
  c.restore();
  c.save();
  c.translate(1150, 410);
  c.scale(5, 5);
  drawObject({ ctx: c as never, x: 0, y: 0, atm, g: 1, obj: bath, time: 760, wind: 0, alpha: 1 });
  const center = isoToScreen(9.5, 9.5);
  for (const b of bathSharing) {
    const p = isoToScreen(b.tx, b.ty);
    drawBird(c as never, b, p.x - center.x, p.y - center.y, atm, 760);
  }
  c.restore();
  c.fillStyle = '#5a5141';
  c.font = '22px sans-serif';
  c.fillText('Знакомство котов', 30, 55);
  c.fillText('Отдых рядом', 30, 390);
  c.fillText('Приветствие оленей', 495, 55);
  c.fillText('Купание по очереди', 955, 55);
  writeFileSync('preview-peaceful-scenes.png', out.toBuffer('image/png'));
}
