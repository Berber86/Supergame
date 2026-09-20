/**
 * Охота на баги: настоящий старт игры под jsdom, как в браузере игрока.
 *
 *   npx tsx tools/check-startup.ts
 *
 * Проверяет, что заставка дышит, вход в сад и растущий сад не роняют
 * игровой цикл — днём и ночью, на десктопе и на телефоне, с сохранением
 * и без. Холсту включена строгость настоящего браузера: отрицательный
 * радиус в arc/ellipse/createRadialGradient бросает IndexSizeError, как
 * в Chrome (napi-rs терпит его молча — так однажды ушло в релиз зависание:
 * кадр падал с исключением, цикл rAF умирал навсегда, игра «висла»).
 * Любая неотловленная ошибка кадра или остановка кадров — провал.
 */
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';

const SELF = 'tools/check-startup.ts';
const DUMP = `${tmpdir()}/usadba-check-ls.json`;

const SCENARIOS = [
  'dump',
  'desktop-day-enter',
  'touch-night-enter',
  'touch-night-grow',
  'touch-night-seeded',
  'desktop-renamed-grow',
  'desktop-day-preset',
  'touch-night-overloaded',
];

// ---------------- драйвер ----------------

if (!process.env.SCENARIO) {
  let failed = 0;
  for (const s of SCENARIOS) {
    const t0 = Date.now();
    const r = spawnSync('npx', ['--no-install', 'tsx', SELF], {
      stdio: 'pipe',
      encoding: 'utf8',
      env: { ...process.env, SCENARIO: s },
      timeout: 90_000,
    });
    const dt = ((Date.now() - t0) / 1000).toFixed(1);
    if (r.status === 0) {
      console.log(`  ок   сценарий ${s}  (${dt} с)`);
    } else {
      failed++;
      console.log(`  ПАД  сценарий ${s}  (${dt} с)`);
      for (const line of (r.stdout + r.stderr).trim().split('\n').slice(-10)) console.log(`       ${line}`);
    }
  }
  if (failed) process.exit(1);
  rmSync(DUMP, { force: true });
  process.exit(0);
}

// ---------------- сам сценарий ----------------

const { JSDOM, VirtualConsole } = await import('jsdom');
const { createCanvas } = await import('@napi-rs/canvas');
const { register } = await import('node:module');

// CSS-импорты гасим пустыми модулями (иначе tsx не даст их загрузить).
register(new URL('./_startup-css-hook.mjs', import.meta.url));

const scenario = process.env.SCENARIO;
const touch = scenario.startsWith('touch');
const night = scenario.includes('night');

let badError = '';
const vc = new VirtualConsole();
vc.on('jsdomError', (e: Error) => {
  if (!badError) badError = `uncaught: ${e.message}`;
});
vc.on('error', (...a: unknown[]) => {
  const text = a.map(String).join(' ');
  if (!badError && text.includes('Кадр сброшен')) badError = text;
});

const dom = new JSDOM(`<!doctype html><html><body><div id="app"></div></body></html>`, {
  url: 'http://localhost:5173/',
  pretendToBeVisual: true,
  virtualConsole: vc,
});
const win = dom.window as unknown as Record<string, any>;

// toDataURL у jsdom не реализован — отдаём настоящий холст.
win.HTMLCanvasElement.prototype.toDataURL = function (this: any, ...a: unknown[]) {
  return this._real ? this._real.toDataURL(...a) : '';
};

// Холст: 2d-контекст отдаёт @napi-rs/canvas, размеры — как у jsdom-элемента.
win.HTMLCanvasElement.prototype.getContext = function (this: any, type: string) {
  if (type !== '2d') return null;
  const w = Math.max(1, this.width || 300);
  const h = Math.max(1, this.height || 150);
  if (!this._real || this._real.width !== w || this._real.height !== h) {
    this._real = createCanvas(w, h);
    this._realCtx = this._real.getContext('2d');
  }
  return this._realCtx;
};

// jsdom-обёртка холста разворачивается к настоящему холсту, как в браузере;
// а радиусы судим по спеке: Chrome бросает IndexSizeError на отрицательных.
{
  const proto = Object.getPrototypeOf(createCanvas(2, 2).getContext('2d'));
  const unwrap = (v: any) => (v && v._real ? v._real : v);
  const origDraw = proto.drawImage;
  proto.drawImage = function (...args: any[]) {
    args[0] = unwrap(args[0]);
    return origDraw.apply(this, args);
  };
  const origPattern = proto.createPattern;
  proto.createPattern = function (img: any, rep: string) {
    return origPattern.call(this, unwrap(img), rep);
  };
  const bad = (what: string) => {
    if (!badError) badError = `IndexSizeError: ${what}`;
    const e = new Error(`IndexSizeError: ${what}`);
    e.name = 'IndexSizeError';
    return e;
  };
  const origArc = proto.arc;
  proto.arc = function (x: number, y: number, r: number, ...rest: any[]) {
    if (!(r >= 0)) throw bad(`arc radius=${r}`);
    return origArc.call(this, x, y, r, ...rest);
  };
  const origEllipse = proto.ellipse;
  proto.ellipse = function (x: number, y: number, rx: number, ry: number, ...rest: any[]) {
    if (!(rx >= 0) || !(ry >= 0)) throw bad(`ellipse rx=${rx} ry=${ry}`);
    return origEllipse.call(this, x, y, rx, ry, ...rest);
  };
  const origRadial = proto.createRadialGradient;
  proto.createRadialGradient = function (x0: number, y0: number, r0: number, x1: number, y1: number, r1: number) {
    if (!(r0 >= 0) || !(r1 >= 0)) throw bad(`createRadialGradient r0=${r0} r1=${r1}`);
    return origRadial.call(this, x0, y0, r0, x1, y1, r1);
  };
}

// Браузерные глобалы, которые читают модули игры.
const g: any = globalThis as any;
for (const k of [
  'document',
  'navigator',
  'localStorage',
  'sessionStorage',
  'HTMLElement',
  'HTMLCanvasElement',
  'HTMLImageElement',
  'Element',
  'Node',
  'CustomEvent',
  'Event',
  'KeyboardEvent',
  'MouseEvent',
  'PointerEvent',
  'TouchEvent',
  'getComputedStyle',
  'matchMedia',
  'location',
  'history',
  'visualViewport',
  'Image',
  'MutationObserver',
  'ResizeObserver',
  'IntersectionObserver',
  'DOMParser',
  'Blob',
  'URL',
]) {
  try {
    if (win[k] !== undefined) g[k] = win[k];
  } catch {
    /* не страшно */
  }
}
g.window = win;

if (touch) {
  win.ontouchstart = null; // признак касаний для isTouchDevice
  Object.defineProperty(win, 'innerWidth', { value: 390, configurable: true });
  Object.defineProperty(win, 'innerHeight', { value: 844, configurable: true });
}
win.matchMedia = (q: string) =>
  ({
    matches: touch && q.includes('pointer: coarse'),
    media: q,
    addEventListener() {},
    removeEventListener() {},
    addListener() {},
    removeListener() {},
  }) as any;
g.matchMedia = win.matchMedia;

// Ночь: сдвигаем часы на +2 часа, как у игрока, заставшего зависание.
if (night) {
  const off = 2 * 3_600_000;
  const RealDate = Date;
  class Shim extends RealDate {
    constructor(...args: any[]) {
      if (args.length === 0) super(RealDate.now() + off);
      else super(...(args as []));
    }
    static now(): number {
      return RealDate.now() + off;
    }
  }
  g.Date = Shim;
}

// Прожитое сохранение из сценария dump — второй запуск, как у игрока.
if (scenario === 'touch-night-seeded' && existsSync(DUMP)) {
  const dump = JSON.parse(readFileSync(DUMP, 'utf8')) as Record<string, string>;
  for (const [k, v] of Object.entries(dump)) win.localStorage.setItem(k, v);
}

// Считаем кадры обоих циклов (игра и заставка): по счёту видно зависание.
let frames = 0;
const origRAF = win.requestAnimationFrame.bind(win);
win.requestAnimationFrame = (cb: FrameRequestCallback) =>
  origRAF((t: number) => {
    frames++;
    cb(t);
  });
g.requestAnimationFrame = win.requestAnimationFrame;
g.cancelAnimationFrame = win.cancelAnimationFrame.bind(win);

const { World } = await import('../src/world/world');
const { GardenStore } = await import('../src/world/gardens');
const { Life } = await import('../src/world/life');
const { Scene } = await import('../src/render/scene');
const { WeatherSystem } = await import('../src/world/weatherState');
const { TimeControl } = await import('../src/core/timeControl');
let chosenId = '';
if (scenario === 'desktop-renamed-grow') {
  const fixtures = new GardenStore(),
    fixture = new World();
  fixtures.save(fixture);
  const originalId = fixtures.activeId;
  chosenId = fixtures.create(fixture, 'Камышовая заводь', { mode: 'grow' }).id;
  assert.ok(fixtures.switchTo(fixture, originalId));
}
let denseOriginal = '',
  denseAfter = 0;
if (scenario === 'touch-night-overloaded') {
  const store = new GardenStore(),
    fixture = new World();
  fixture.objects = fixture.objects.filter((o) => ['table', 'cat', 'cushion'].includes(o.type));
  for (const [type, n, x, y] of [
    ['maple', 81, 12, 18],
    ['grass_tuft', 201, 15, 19],
    ['feeder', 25, 18, 6],
  ] as const)
    for (let i = 0; i < n; i++) fixture.place(type, x, y, 0, Date.now() + i);
  store.save(fixture);
  chosenId = store.activeId;
  denseOriginal = win.localStorage.getItem(`usadba.garden.${chosenId}`);
  denseAfter = fixture.objects.length - 54 - 134 - 16;
}
const counts: Record<string, number> = {};
let runningWorld: InstanceType<typeof World> | undefined;
function spy(proto: any, key: string, label = key) {
  const original = proto[key];
  proto[key] = function (...args: any[]) {
    counts[label] = (counts[label] ?? 0) + 1;
    if (label === 'life') runningWorld = args[0];
    return original.apply(this, args);
  };
}
spy(Life.prototype, 'update', 'life');
spy(Scene.prototype, 'render', 'render');
spy(WeatherSystem.prototype, 'update', 'weather');
spy(TimeControl.prototype, 'tick', 'clock');
spy(GardenStore.prototype, 'save', 'save');
spy(World.prototype, 'observe', 'observe');
const storage = () =>
  Object.fromEntries(
    Array.from({ length: win.localStorage.length }, (_, i) => {
      const k = win.localStorage.key(i);
      return [k, win.localStorage.getItem(k)];
    }),
  );
await import('../src/main');
const waitingCounts = { ...counts },
  waitingStorage = storage();
assert.equal(win.document.getElementById('app').inert, true);
assert.equal(counts.life ?? 0, 0);
assert.equal(counts.render ?? 0, 0);
assert.equal(counts.save ?? 0, 0);

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
let lastFrames = -1;
function alive(label: string): string {
  if (badError) return `${label}: ${badError}`;
  if (frames === lastFrames) return `${label}: кадры встали на ${frames}`;
  lastFrames = frames;
  return '';
}

await sleep(2500);
let problem = alive('выбор сада');
win.dispatchEvent(new win.Event('beforeunload'));
assert.deepEqual(
  counts,
  waitingCounts,
  'no simulation, weather, clock, observation, rendering or autosave while choosing',
);
assert.deepEqual(storage(), waitingStorage, 'unopened saves are byte-for-byte unchanged');
win.document.querySelector('.splash').click();
win.dispatchEvent(new win.KeyboardEvent('keydown', { key: 'Escape' }));
assert.equal(win.document.getElementById('app').inert, true, 'backdrop/Escape does not pick a garden');

if (!problem) {
  const existing = chosenId
    ? win.document.querySelector(`[data-garden="${chosenId}"]`)
    : win.document.querySelector('.splash-garden');
  if (existing && scenario !== 'touch-night-grow' && scenario !== 'desktop-day-preset') existing.click();
  else {
    win.document.querySelector('.splash-new').click();
    const mode = win.document.querySelector('.splash-template');
    mode.value =
      scenario === 'touch-night-grow' ? 'grow' : scenario === 'desktop-day-preset' ? 'preset:moss' : 'classic';
    mode.dispatchEvent(new win.Event('change'));
    assert.deepEqual(counts, waitingCounts, 'editing the creation form does not wake the garden');
    win.document
      .querySelector('.splash-create')
      .dispatchEvent(new win.Event('submit', { bubbles: true, cancelable: true }));
  }
  assert.equal(win.document.getElementById('app').inert, false);
  await sleep(2500);
  problem = alive('вход');
  assert.ok(
    (counts.life ?? 0) > 0 && (counts.render ?? 0) > 0 && (counts.weather ?? 0) > 0 && (counts.clock ?? 0) > 0,
    'the chosen garden starts normally',
  );
  if (scenario === 'touch-night-grow' || scenario === 'desktop-renamed-grow') assert.ok(runningWorld?.grow);
  if (scenario === 'desktop-renamed-grow') {
    const store = new GardenStore();
    assert.equal(store.activeId, chosenId);
    assert.equal(store.active?.name, 'Камышовая заводь');
  }
  if (scenario === 'desktop-day-preset')
    assert.ok(!runningWorld?.tiles.some((t) => t.indoor), 'moss preset, not the starter house');
  if (scenario === 'touch-night-overloaded') {
    assert.equal(runningWorld?.objects.length, denseAfter);
    assert.equal(win.localStorage.getItem(`usadba.garden.${chosenId}.before-thinning`), denseOriginal);
    assert.equal(win.document.querySelector('.landscape-notice').hidden, false);
    assert.ok(win.document.querySelector('.landscape-notice').textContent.includes('204'));
    win.document.querySelector('.ln-close').click();
    assert.equal(win.document.querySelector('.landscape-notice').hidden, true);
  }
  for (let i = 0; i < 2 && !problem && scenario !== 'dump'; i++) {
    await sleep(2000);
    problem = alive(`работа сада #${i}`);
  }
}
if (!problem && scenario === 'dump') {
  win.dispatchEvent(new win.Event('beforeunload'));
  writeFileSync(DUMP, JSON.stringify(storage()));
}

if (problem) {
  console.error(problem);
  process.exit(1);
}
process.exit(0);
