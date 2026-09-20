/** Real DOM, virtual real-time clock: three minutes between starts, not between game dates. */
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { createServer } from 'vite';
import { World } from '../src/world/world';
const dom = new JSDOM('<main></main>', { url: 'https://garden.example/', pretendToBeVisual: true });
Object.assign(globalThis, { window: dom.window, document: dom.window.document });
const server = await createServer({ server: { middlewareMode: true, hmr: false }, appType: 'custom' });
const realNow = Date.now,
  realPerformance = globalThis.performance;
try {
  const { ChronicleToast, CHRONICLE_TOAST_INTERVAL } = await server.ssrLoadModule('/src/ui/chronicleToast.ts');
  assert.equal(CHRONICLE_TOAST_INTERVAL, 180000);
  let now = 0,
    hidden = false,
    nextId = 0;
  const epoch = realNow();
  const timers = new Map<number, { at: number; fn: () => void }>();
  Object.assign(globalThis, { performance: { now: () => now } });
  Date.now = () => epoch + now;
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => hidden });
  window.setTimeout = ((fn: () => void, delay = 0) => {
    const id = ++nextId;
    timers.set(id, { at: now + delay, fn });
    return id;
  }) as never;
  window.clearTimeout = (id) => {
    timers.delete(id);
  };
  Object.assign(globalThis, { requestAnimationFrame: (fn: () => void) => window.setTimeout(fn, 16) });
  function advance(to: number) {
    assert.ok(to >= now);
    for (;;) {
      const first = [...timers.entries()]
        .filter(([, t]) => t.at <= to)
        .sort((a, b) => a[1].at - b[1].at || a[0] - b[0])[0];
      if (!first) break;
      now = first[1].at;
      timers.delete(first[0]);
      first[1].fn();
    }
    now = to;
  }
  const root = document.querySelector('main')!,
    visits: number[][] = [];
  let toast = new ChronicleToast(root, (x: number, y: number) => visits.push([x, y]));
  const push = (id: string, x = 1, y = 2) => toast.push({ id, x, y, at: 0 });
  const count = () => root.querySelectorAll('.chronicle-toast').length;
  push('not_an_event');
  assert.equal(count(), 0);
  push('meet_frog');
  assert.equal(count(), 1);
  advance(100);
  (root.querySelector('.ct-close') as HTMLElement).click();
  assert.equal(visits.length, 0);
  for (let i = 0; i < 1000; i++) push('flock', i, 5);
  assert.ok(timers.size <= 3, 'burst does not allocate one timer per event');
  advance(179999);
  assert.equal(count(), 0, 'closing early never unlocks another popup');
  advance(180000);
  assert.equal(count(), 1);
  (root.querySelector('.chronicle-toast') as HTMLElement).click();
  (root.querySelector('.chronicle-toast') as HTMLElement).click();
  assert.deepEqual(visits, [[999, 5]], 'only latest pending location, no double teleport while fading');
  push('birds_fled', 3, 4);
  advance(181000);
  hidden = true;
  document.dispatchEvent(new dom.window.Event('visibilitychange'));
  advance(370000);
  assert.equal(count(), 0, 'no background popups spent invisibly');
  hidden = false;
  document.dispatchEvent(new dom.window.Event('visibilitychange'));
  assert.equal(count(), 1);
  push('meet_heron');
  toast.clear();
  assert.equal(count(), 0);
  push('meet_deer', 7, 8);
  advance(549999);
  assert.equal(count(), 0, 'switching gardens keeps the cooldown');
  advance(550000);
  assert.equal(count(), 1);
  (root.querySelector('.chronicle-toast') as HTMLElement).click();
  assert.deepEqual(visits[1], [7, 8]);
  toast.dispose();
  toast = new ChronicleToast(root, (x: number, y: number) => visits.push([x, y]));
  push('meet_owl');
  advance(729999);
  assert.equal(count(), 0, 'session storage preserves the remaining interval on reload');
  advance(730000);
  assert.equal(count(), 1);
  // Recording is independent of popup selection: no lost chronicle entries or pending snapshots.
  const world = new World();
  world.chronicle = [];
  world.pendingNotes = [];
  for (const [i, id] of ['meet_frog', 'meet_heron', 'meet_owl', 'meet_deer'].entries())
    world.noteEvent(id, epoch + i, 5, 5);
  const snapshot = JSON.stringify(world.toJSON());
  for (const note of world.pendingNotes) toast.push(note);
  assert.equal(world.chronicle.length, 4);
  assert.equal(world.pendingNotes.length, 4);
  assert.equal(JSON.stringify(world.toJSON()), snapshot);
  advance(750700);
  assert.equal(count(), 0, '20s visible plus fade, not a three-minute covering card');
  Date.now = () => epoch + 999999999;
  push('chorus');
  advance(909999);
  assert.equal(count(), 0, 'wall/game clock jumps do not advance the in-page cooldown');
  Date.now = () => epoch + now;
  advance(910000);
  assert.equal(count(), 1);
  toast.dispose();
  advance(911000);
  assert.equal(timers.size, 0);
  Object.defineProperty(window, 'sessionStorage', {
    configurable: true,
    get() {
      throw new Error('blocked');
    },
  });
  toast = new ChronicleToast(root, () => {});
  push('meet_frog');
  assert.equal(count(), 1, 'blocked storage is harmless');
  toast.dispose();
  advance(912000);
  assert.equal(timers.size, 0);
  toast = new ChronicleToast(root, (x: number, y: number) => visits.push([x, y]));
  toast.setPaused(true);
  push('meet_frog', 3, 4);
  advance(922000);
  push('meet_deer', 9, 10);
  assert.equal(count(), 0, 'load-time notice does not compete with chronicle popups');
  assert.equal(timers.size, 0, 'paused notifications do not poll or allocate timers');
  toast.setPaused(false);
  assert.equal(count(), 1);
  (root.querySelector('.chronicle-toast') as HTMLElement).click();
  assert.deepEqual(visits.at(-1), [9, 10], 'the latest event appears when the notice is dismissed');
  toast.dispose();
  advance(923000);
  assert.equal(timers.size, 0);
  console.log(
    'ок: 180000ms minimum, early close/click/auto-fade, latest-only burst, bounded timers, hidden tab, garden switch, reload, clock jumps, unavailable storage and unchanged chronicle records',
  );
} finally {
  Date.now = realNow;
  Object.assign(globalThis, { performance: realPerformance });
  await server.close();
  dom.window.close();
}
