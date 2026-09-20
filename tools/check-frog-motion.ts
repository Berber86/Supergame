/** Actual shore-hop selection and real-time trajectories: no pond-wide bullets, pauses and fear retained. */
import assert from 'node:assert/strict';
import { makeRng } from '../src/core/rng';
import { computeTime } from '../src/core/clock';
import { isoToScreen } from '../src/core/iso';
import { World } from '../src/world/world';
import { Life } from '../src/world/life';
import { Residents, FROG_HOP_DISTANCE, frogHopDuration, type Frog } from '../src/world/residents';
import { scanHabitat, invitations, type Vec, type Habitat } from '../src/world/habitat';

Math.random = makeRng(841);
const world = new World();
world.objects = [];
for (const tile of world.tiles)
  Object.assign(tile, { ground: 'moss', level: 0, water: false, indoor: false, veranda: false });
for (let y = 8; y <= 15; y++) for (let x = 8; x <= 15; x++) world.at(x, y)!.water = true;
world.noteObjectsChanged();
const h = scanHabitat(world),
  t = computeTime(new Date(2026, 6, 15, 19).getTime());
const inv = { ...invitations(h, t, null), frogs: 1, chorus: 0, dragonflies: 0 };
const origin = h.frogSpots.find((p) => p.x === 7.5 && p.y === 11.5)!;
assert.ok(origin, 'a real shore spot, far from the centre of a large pond');
const pond = h.ponds.find((p) => p.shores.some((s) => s.x === origin.x && s.y === origin.y))!;
const makeFrog = (p = origin): Frog => ({
  id: 1,
  tx: p.x,
  ty: p.y,
  facing: 1,
  seed: 441,
  state: 'sit',
  timer: 0,
  phase: 0,
  from: null,
  target: null,
  pond: pond.id,
  species: 'green',
  size: 1,
  throat: 0,
  hidden: 0,
  gone: false,
  answer: 0,
});
const r = new Residents();
let trials = 0;
function choices(habitat: Habitat, base = makeFrog(), n = 800) {
  const chosen: Vec[] = [];
  for (let i = 0; i < n; i++) {
    const frog = { ...base };
    r.frogs = [frog];
    r.update(world, habitat, inv, null, 1000 / 60, (++trials * 1000) / 60, []);
    if (frog.state === 'hop') {
      assert.ok(frog.from && frog.target);
      assert.ok(frog.timer >= 1400);
      assert.ok(Math.hypot(frog.target.x - frog.from.x, frog.target.y - frog.from.y) <= FROG_HOP_DISTANCE + 1e-9);
      chosen.push(frog.target);
    }
  }
  return chosen;
}
const adjacent = choices(h);
assert.ok(adjacent.length > 100, 'quiet frogs still hop; distance limiting must not freeze them');
assert.ok(adjacent.every((s) => Math.hypot(s.x - origin.x, s.y - origin.y) > 0.2));
assert.ok(adjacent.every((s) => pond.shores.some((p) => p.x === s.x && p.y === s.y)));
const far = pond.shores.find((s) => Math.hypot(s.x - origin.x, s.y - origin.y) > 7)!;
assert.ok(far);
assert.equal(
  choices({ ...h, frogSpots: [origin, far] }).length,
  0,
  'no jump to the far shore when no nearby landing exists',
);
const foreign = { x: origin.x - 0.4, y: origin.y + 0.3 };
assert.equal(choices({ ...h, frogSpots: [origin, foreign] }).length, 0, 'spots from a different pond are not borrowed');
const target = adjacent[0];
const tile = world.at(Math.floor(target.x), Math.floor(target.y))!;
for (const blocked of [{ level: 1 }, { indoor: true }, { veranda: true }, { water: true }]) {
  const before = { ...tile };
  Object.assign(tile, blocked);
  assert.equal(choices({ ...h, frogSpots: [origin, target] }).length, 0, 'no jump onto a cliff/house/water');
  Object.assign(tile, before);
}
const bath = { x: 3, y: 3 };
assert.equal(
  choices({ ...h, baths: [bath, { x: 20, y: 20 }] }, { ...makeFrog({ x: 3.6, y: 3.4 }), pond: -2 }).length,
  0,
  'no teleport between distant birdbaths',
);
// Same-height endpoints can straddle a raised intermediate corner; sample the whole trajectory.
{
  const a = { x: 5.95, y: 6.7 },
    b = { x: 6.15, y: 7.4 };
  const habitat = { ...h, frogSpots: [a, b], ponds: [{ ...pond, shores: [a, b] }] };
  assert.ok(choices(habitat, makeFrog(a)).length > 100);
  world.at(6, 6)!.level = 1;
  assert.equal(choices(habitat, makeFrog(a)).length, 0, 'no vertical render snap at an intermediate tile');
  world.at(6, 6)!.level = 0;
}

const duration = frogHopDuration(origin, target);
assert.ok(
  duration >= 1600 && duration < 1900,
  'a one-cell hop takes about 1.7 real seconds, not 1.1s for any distance',
);
assert.ok(
  frogHopDuration(origin, far) > duration * 5,
  'duration itself also guards against accidentally long scripted spans',
);
const times = [0, 350, 800, 1400, 2000];
let reference: { x: number; y: number; phase: number; state: string }[] | undefined;
for (const fps of [30, 60, 144]) {
  const frog = { ...makeFrog(), state: 'hop' as const, from: origin, target, phase: 0, timer: duration } as Frog;
  const residents = new Residents();
  residents.frogs = [frog];
  let now = 0,
    maxSpeed = 0,
    maxScreenSpeed = 0;
  const samples: NonNullable<typeof reference> = [];
  for (const time of times) {
    while (now < time - 1e-8) {
      const dt = Math.min(1000 / fps, time - now),
        x = frog.tx,
        y = frog.ty,
        p = isoToScreen(x, y);
      residents.update(world, h, inv, null, dt, now + dt, []);
      now += dt;
      const speed = Math.hypot(frog.tx - x, frog.ty - y) / dt;
      const q = isoToScreen(frog.tx, frog.ty);
      maxSpeed = Math.max(maxSpeed, speed);
      maxScreenSpeed = Math.max(maxScreenSpeed, (Math.hypot(q.x - p.x, q.y - p.y) / dt) * 1000);
      assert.ok(speed <= 0.0012 + 1e-9, `${fps}Hz: bounded actual velocity`);
    }
    samples.push({ x: frog.tx, y: frog.ty, phase: frog.phase, state: frog.state });
  }
  assert.equal(frog.state, 'sit');
  assert.equal(frog.target, null);
  assert.ok(frog.timer > 3000, 'a real rest follows landing');
  assert.ok(maxSpeed > 0.0008, 'positive motion control');
  assert.ok(maxScreenSpeed < 100, 'no frame-to-frame bullet in isometric projection at zoom 1');
  if (reference)
    samples.forEach((s, i) => {
      assert.ok(Math.hypot(s.x - reference![i].x, s.y - reference![i].y) < 1e-9);
      assert.ok(Math.abs(s.phase - reference![i].phase) < 1e-9);
      assert.equal(s.state, reference![i].state);
    });
  else reference = samples;
}
// Fear is still responsive and finishes with a real splash and a hidden frog.
{
  const residents = new Residents(),
    frog = { ...makeFrog(), timer: 10000 };
  residents.frogs = [frog];
  for (let i = 0; i < 60; i++) residents.update(world, h, inv, null, 20, i * 20, [{ x: origin.x, y: origin.y, r: 2 }]);
  assert.ok(frog.hidden > 0);
  assert.ok(residents.ripples.some((p) => p.big));
}
// The production Life path (weather, invitations and ordinary neighbours) obeys the same bound.
{
  const life = new Life();
  let sawHop = false;
  for (let i = 0; i < 3000; i++) {
    life.update(world, t, 60, i * 60);
    for (const f of life.residents.frogs)
      if (f.state === 'hop') {
        sawHop = true;
        assert.ok(f.from && f.target);
        assert.ok(Math.hypot(f.target.x - f.from.x, f.target.y - f.from.y) <= FROG_HOP_DISTANCE + 1e-9);
      }
  }
  assert.ok(sawHop, 'natural Life still produces short hops');
}
console.log(
  `ок: ${trials} real target selections, local same-pond shore/bath hops, obstacle corridor, 30/60/144Hz trajectories and velocity, landing pauses, cat fear and actual Life`,
);
