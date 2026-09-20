/** Fixed independent clocks: 1-hour months, 12-hour years, 5-hour solar days. */
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { GROW_MONTH_MS as H, GROW_DAY_MS, GROW_YEAR_MS, growTime, newGrowClock } from '../src/core/growClock';
import { computeTime } from '../src/core/clock';
import { TimeControl } from '../src/core/timeControl';
import { newGrowState, growTick, GROW_ACTION_MS, type GrowState } from '../src/world/grow';
import { World } from '../src/world/world';
import { parseSave, serializeSave } from '../src/world/saveFormat';
import { DevPanel } from '../src/ui/devPanel';
import { WeatherSystem } from '../src/world/weatherState';
const dom = new JSDOM('<main></main>', { url: 'https://garden.example' });
Object.assign(globalThis, { window: dom.window, document: dom.window.document, localStorage: dom.window.localStorage });
const close = (a: number, b: number) => assert.ok(Math.abs(a - b) < 1e-8, `${a} ≠ ${b}`);
const epoch = new Date(2026, 2, 1, 6).getTime();
const clock = { epoch, month: 2026 * 12 + 2, solar: 0.25 };
assert.equal(GROW_DAY_MS, 5 * H);
assert.equal(GROW_YEAR_MS, 12 * H);
for (let hour = 0; hour <= 60; hour++) {
  const t = growTime(clock, epoch + hour * H),
    d = new Date(t.now);
  assert.equal(d.getMonth(), (2 + hour) % 12);
  assert.equal(d.getDate(), 1, 'February and 31-day months each take exactly an hour');
  assert.equal(d.getFullYear(), 2026 + Math.floor((2 + hour) / 12));
  close(t.dayT, (0.25 + (hour % 5) / 5) % 1);
}
assert.deepEqual(
  Array.from({ length: 6 }, (_, year) => growTime(clock, epoch + year * 12 * H).label),
  ['06:00', '15:36', '01:12', '10:48', '20:24', '06:00'],
);
const dark = growTime(clock, epoch + 3.75 * H);
assert.equal(dark.label, '00:00');
assert.equal(dark.daylight, 0, 'calendar mid-day does not override the slow solar night');
// Initial date/hour is retained for migration, including DST and leap years.
for (const date of [
  new Date(2024, 1, 29, 12),
  new Date(2026, 2, 29, 4),
  new Date(2026, 9, 25, 4),
  new Date(2026, 11, 31, 23),
]) {
  const c = newGrowClock(date.getTime()),
    initial = growTime(c, date.getTime());
  assert.ok(Math.abs(initial.now - date.getTime()) < 1, 'no initial calendar jump');
  close(initial.dayT, computeTime(date.getTime()).dayT);
  const next = growTime(c, date.getTime() + H);
  assert.equal(new Date(next.now).getMonth(), (date.getMonth() + 1) % 12);
  close(growTime(c, date.getTime() + 5 * H).dayT, initial.dayT);
}
assert.deepEqual(growTime(clock, epoch - 1000), growTime(clock, epoch));
assert.deepEqual(growTime(clock, NaN), growTime(clock, epoch));
assert.ok(Number.isFinite(growTime(clock, epoch + 100_000 * H).now), 'offline gaps are O(1), not a replay loop');
const original = Date.now;
let real = epoch;
Date.now = () => real;
try {
  localStorage.setItem('usadba.timectl.v1', JSON.stringify({ active: true, hour: 18, monthIndex: 6, speed: 3000 }));
  let grow: GrowState | null = newGrowState(17, epoch);
  grow.clock = { ...clock };
  const tc = new TimeControl(() => grow);
  assert.ok(
    tc.growAutomatic && !tc.state.active,
    'old manual acceleration does not hijack a newly opened growing garden',
  );
  real += H;
  tc.tick(1);
  assert.equal(new Date(tc.compute().now).getMonth(), 3);
  const once = tc.compute();
  for (let i = 0; i < 1000; i++) tc.tick(60);
  assert.deepEqual(tc.compute(), once, 'FPS and repeated ticks do not change a wall-clock-based rhythm');
  real += 59 * H;
  close(tc.compute().dayT, 0.25);
  assert.equal(new Date(tc.compute().now).getMonth(), 2);
  const savedClock = JSON.stringify(grow.clock);
  const w = new World();
  w.grow = grow;
  const parsed = parseSave(JSON.parse(serializeSave(w.toJSON())))!;
  assert.ok(parsed.grow?.clock);
  assert.deepEqual(parsed.grow.clock, grow.clock);
  assert.deepEqual(parseSave(w.toJSON())?.grow?.clock, grow.clock, 'unpacked exports retain the anchor too');
  const restored = new World();
  restored.applySave(parsed);
  const reloaded = new TimeControl(() => restored.grow);
  assert.deepEqual(reloaded.compute(), tc.compute(), 'reload does not restart dawn or the month');
  assert.equal(JSON.stringify(grow.clock), savedClock, 'no per-frame save accumulation');
  const snapshot = w.toJSON();
  snapshot.grow!.clock!.epoch++;
  assert.equal(grow.clock!.epoch, epoch, 'export is not a mutable alias of the live clock');
  for (const bad of [
    { ...clock, solar: 1 },
    { ...clock, solar: -1 },
    { ...clock, month: NaN },
    { ...clock, epoch: Infinity },
    { ...clock, epoch: -1 },
  ]) {
    const data = JSON.parse(serializeSave(w.toJSON()));
    data.g.clock = bad;
    assert.equal(parseSave(data), null, 'corrupt clock is rejected');
  }
  let migrations = 0;
  delete grow.clock;
  const legacy = new TimeControl(
    () => grow,
    () => migrations++,
  );
  legacy.compute();
  legacy.compute();
  assert.equal(migrations, 1);
  close(legacy.compute().dayT, computeTime(real).dayT);
  // Manual workshop remains explicitly available; disabling returns to the garden's independent clocks.
  tc.enable();
  tc.setMonth(6);
  tc.setHour(22);
  tc.setSpeed(0);
  assert.equal(tc.compute().hours, 22);
  real += H;
  assert.equal(tc.compute().hours, 22);
  tc.disable();
  assert.deepEqual(tc.compute(), growTime(grow.clock!, real));
  const panel = new DevPanel(document.querySelector('main')!, tc, new WeatherSystem(), { onChange: () => {} });
  panel.refresh();
  assert.ok(document.querySelector('.dev-speed-val')!.textContent!.includes('сутки — 5 ч'));
  grow.bank = 0;
  grow.tick = real;
  tc.tick(999999);
  assert.equal(grow.bank, 0);
  growTick(grow, real + GROW_ACTION_MS);
  assert.equal(grow.bank, 1, 'actions still arrive every ten REAL minutes');
  grow = null;
  assert.equal(tc.compute().now, real, 'free garden uses the real clock');
  tc.enable();
  tc.setHour(19);
  grow = newGrowState(18, real);
  grow.clock = { epoch: real, month: 2026 * 12, solar: 0.1 };
  close(tc.compute().dayT, 0.1);
  assert.ok(tc.growAutomatic, 'another garden does not inherit the previous override');
  let unexpectedMigrations = 0;
  const migratedReload = new TimeControl(
    () => w.grow,
    () => unexpectedMigrations++,
  );
  assert.deepEqual(migratedReload.compute(), growTime(w.grow!.clock!, real));
  assert.equal(unexpectedMigrations, 0, 'a persisted legacy anchor is not regenerated');
} finally {
  Date.now = original;
}
console.log(
  'ок: exact 1h/12h/5h rhythm, five distinct March sun phases and 60h repeat, DST/leap years, FPS/offline/reload, legacy migration, save validation, manual override, UI and unchanged action timer',
);
