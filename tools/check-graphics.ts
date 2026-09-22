/** Graphics modes, real loop cadence, malformed preferences, culling and decorative-state regressions. */
import assert from 'node:assert/strict';
import { createCanvas } from '@napi-rs/canvas';
import { JSDOM } from 'jsdom';
import { createHash } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { FrameGate, GRAPHICS, type GraphicsQuality } from '../src/render/graphics';
import { Scene } from '../src/render/scene';
import { World } from '../src/world/world';
import { buildAtmosphere } from '../src/world/palette';
import { computeTime, annualPhase } from '../src/core/clock';
import { isoToScreen } from '../src/core/iso';
import { WeatherSystem } from '../src/world/weatherState';
import { drawObjects, drawPaperGrain } from '../src/render/scene-steps';
import { getPaperTile } from '../src/render/paint';
import { drawCached } from '../src/render/spriteCache';
import { TREE_FORMS, treeProfile } from '../src/world/treeHabits';
import { drawWaterAnimation, prepareWaterSurface, waterSurfaceBounds } from '../src/render/waterSurface';
import { canvasCrop } from '../src/render/canvasCrop';
import { startLoop } from '../src/app/gameLoop';
import { loadView, saveView, SettingsPanel } from '../src/ui/settings';
Object.assign(globalThis, {
  document: { hidden: false, createElement: () => createCanvas(8, 8) },
  window: { devicePixelRatio: 3, innerWidth: 640, innerHeight: 400 },
});
const qualities: GraphicsQuality[] = ['low', 'balanced', 'high'];
for (const hz of [60, 90, 120, 144])
  for (const fps of [30, 60]) {
    const gate = new FrameGate();
    let count = 0;
    for (let i = 0; i < hz * 10; i++) if (gate.due((i * 1000) / hz, fps)) count++;
    assert.ok(Math.abs(count - fps * 10) <= 1, `${hz}Hz/${fps}fps: ${count}`);
    assert.equal(gate.due(NaN, fps), false);
    assert.ok(gate.due(0, fps), 'reset after backwards timestamp');
  }
// The faster annual coordinate must remain bit-for-bit equal to the six-anchor reference.
for (const invalid of [NaN, Infinity, -Infinity, Number.MAX_VALUE]) assert.equal(annualPhase(invalid), 0);
const hotGate = new FrameGate();
assert.ok(hotGate.due(0, 2));
assert.ok(hotGate.due(10, 60), 'entering the garden does not wait for the splash deadline');
const originalZone = process.env.TZ;
try {
  for (const zone of ['Europe/Amsterdam', 'Asia/Tokyo', 'America/New_York']) {
    process.env.TZ = zone;
    for (const year of [2024, 2026, 2027])
      for (let now = new Date(year, 0, 1).getTime(); now < new Date(year + 1, 0, 18).getTime(); now += 7 * 3600000) {
        const y = new Date(now).getFullYear(),
          anchors = [
            new Date(y - 1, 9, 15),
            new Date(y, 0, 15),
            new Date(y, 3, 15),
            new Date(y, 6, 15),
            new Date(y, 9, 15),
            new Date(y + 1, 0, 15),
          ].map((d) => d.getTime());
        let reference = 0;
        for (let i = 0; i < anchors.length - 1; i++)
          if (now < anchors[i + 1]) {
            reference = ((i - 1) * 0.25 + ((now - anchors[i]) / (anchors[i + 1] - anchors[i])) * 0.25 + 1) % 1;
            break;
          }
        assert.equal(annualPhase(now), reference, `${zone} civil annual phase`);
      }
  }
} finally {
  if (originalZone === undefined) delete process.env.TZ;
  else process.env.TZ = originalZone;
}
const t = computeTime(new Date(2026, 6, 15, 13).getTime()),
  atm = buildAtmosphere(t);
// Exercise the actual loop, not only the scheduler helper. Quality never changes simulation elapsed time.
const simulations: string[] = [];
for (const quality of qualities) {
  let callback: FrameRequestCallback = () => {},
    renders = 0,
    simTime = 0,
    ticks = 0,
    snaps = 0,
    otherWork = 0;
  let splash = false;
  Object.assign(globalThis, {
    requestAnimationFrame: (cb: FrameRequestCallback) => {
      callback = cb;
      return 1;
    },
  });
  const noop = () => {};
  const work = () => otherWork++;
  const deps = {
    world: { objects: [], at: () => null, observe: work, noteEvening: work },
    scene: {
      viewW: 640,
      viewH: 400,
      graphicsProfile: GRAPHICS[quality],
      camera: { x: 0, y: 0, zoom: 1 },
      flow: { cells: [], falls: [] },
      render: () => renders++,
    },
    life: { update: () => ticks++, windBase: 0.3, windAt: () => 0.3, gusts: [], cats: [], residents: { frogs: [] } },
    weatherSys: { update: work, state: { overcast: 0 } },
    audio: { update: work },
    timeCtl: {
      tick: (dt: number) => (simTime += dt),
      compute: () => {
        work();
        return t;
      },
    },
    ui: { buildOpen: true, tick: work },
    devPanel: { tick: work },
    idleMs: 30000,
    isPracticeActive: () => false,
    isStartOpen: () => splash,
    isZenMode: () => false,
    igniteZen: noop,
    lastInteractionMs: () => 0,
    getEntryZoom: () => 0,
    setEntryZoom: noop,
    flushMilestones: work,
    flushChronicle: work,
    flushChronicleSnaps: () => snaps++,
    growFrame: work,
  };
  // Same monotonic origin for all runs, independent of time consumed by the test itself.
  const original = performance.now;
  Object.defineProperty(performance, 'now', { value: () => 1000, configurable: true });
  startLoop(deps as never);
  Object.defineProperty(performance, 'now', { value: original, configurable: true });
  for (let i = 0; i < 1440; i++) callback(1000 + (i * 1000) / 144);
  assert.ok(Math.abs(renders - GRAPHICS[quality].fps * 10) <= 1);
  assert.equal(snaps, renders);
  simulations.push(JSON.stringify({ ticks, simTime }));
  Object.assign(document, { hidden: true });
  callback(12000);
  const n = renders;
  callback(13000);
  assert.equal(renders, n);
  Object.assign(document, { hidden: false });
  callback(13010);
  assert.equal(renders, n + 1);
  splash = true;
  const beforeChoice = { renders, ticks, simTime, snaps, otherWork };
  for (let i = 0; i < 144; i++) callback(13100 + (i * 1000) / 144);
  assert.deepEqual(
    { renders, ticks, simTime, snaps, otherWork },
    beforeChoice,
    'no hidden simulation, clock, warm-up render or photo before the choice',
  );
  callback(100_000); // A long wait must not be replayed as simulation steps on entry.
  splash = false;
  const entered = renders,
    beforeTicks = ticks,
    beforeTime = simTime;
  callback(100_017);
  assert.equal(renders, entered + 1);
  assert.equal(ticks - beforeTicks, 1);
  assert.ok(simTime - beforeTime <= 17, 'no pre-choice time catch-up');
}
assert.equal(new Set(simulations).size, 1, 'same world simulation in all modes');
for (const ratio of [1, 1.5, 2]) {
  const crop = canvasCrop(100, 100, 200, ratio, 400 * ratio, 300 * ratio, 160)!;
  assert.equal(crop.sx, 0);
  assert.equal(crop.sw, 200 * ratio);
  assert.equal(crop.dw, 160);
  const edge = canvasCrop(0, 0, 200, ratio, 400 * ratio, 300 * ratio, 160)!;
  assert.equal(edge.dx, 80);
  assert.equal(edge.dy, 80);
  assert.equal(edge.dw, 80);
  assert.equal(edge.dh, 80);
}
assert.equal(canvasCrop(-500, 0, 200, 1, 400, 300, 160), null);
const world = new World(),
  cv = createCanvas(640, 400);
Object.assign(cv, { clientWidth: 640, clientHeight: 400 });
const scene = new Scene(cv as never);
scene.centerOn(12.5, 14);
scene.camera.zoom = 0.9;
const camera = { ...scene.camera },
  point = scene.worldToScreen(0, 500),
  saved = JSON.stringify(world.toJSON());
const storm = new WeatherSystem();
Object.assign(storm.state, { rain: 1, overcast: 0.8, wetness: 1 });
const frames: ReturnType<typeof createCanvas>[] = [];
for (const quality of qualities) {
  scene.setQuality(quality);
  assert.equal(scene.pixelRatio, GRAPHICS[quality].dpr);
  assert.equal(scene.viewW, 640);
  assert.equal(scene.viewH, 400);
  assert.deepEqual(scene.camera, camera);
  assert.deepEqual(scene.worldToScreen(0, 500), point);
  scene.render(world, atm, 1000, 16, undefined, storm.state);
  assert.equal((scene.rain as any).drops.length, Math.round(320 * GRAPHICS[quality].particles));
  const frame = createCanvas(640, 400);
  frame.getContext('2d').drawImage(cv, 0, 0, 640, 400);
  frames.push(frame);
}
scene.particles = false;
(scene as any).weather.emitAt(10, 10, 'leaf', 13);
scene.render(world, atm, 1200, 16, undefined, storm.state);
assert.equal((scene.rain as any).drops.length, 0);
assert.equal(scene.rain.waterRipples.length, 0);
assert.equal((scene as any).weather.particles.length, 0, 'disabled litter does not freeze/resurface later');
scene.rain.update(0, storm.state, world);
const drop = JSON.stringify((scene.rain as any).drops);
scene.rain.update(0, storm.state, world);
assert.equal(JSON.stringify((scene.rain as any).drops), drop, 'zero dt does not invent time');
scene.rain.update(16, { ...storm.state, rain: 0 }, world);
assert.equal((scene.rain as any).drops.length, 0, 'no 30 hidden residual drops');
assert.equal(JSON.stringify(world.toJSON()), saved);
// A magnified tree's foot is outside the old fixed screen margin, but its crown is visible.
const w = new World();
w.objects = [];
for (const tile of w.tiles)
  Object.assign(tile, { water: false, level: 0, ground: 'soil', indoor: false, veranda: false });
const tree = w.place('maple', 12, 12)!;
// Старое дерево из прежнего сохранения — сразу взрослое, рост здесь не при чём.
tree.young = undefined;
// The old hard-coded camera assumed seed 441 was broad. Derive the crop from real foliage
// for every form: the root stays 300 screen pixels off-screen, beyond the old fixed margin.
for (const form of TREE_FORMS) {
  tree.seed = 0;
  while (treeProfile('maple', tree.seed)!.form !== form) tree.seed++;
  const probe = createCanvas(400, 380),
    pc = probe.getContext('2d');
  drawCached({ ctx: pc as never, obj: tree, atm, x: 180, y: 320, g: 1, alpha: 1, time: 0, wind: 0 });
  const pixels = pc.getImageData(0, 0, 400, 380).data;
  let edgeX = 0,
    edgeY = 0;
  edge: for (let x = 399; x > 180; x--)
    for (let y = 0; y < 300; y++)
      if (pixels[(y * 400 + x) * 4 + 3] > 100) {
        edgeX = x - 180;
        edgeY = y - 320;
        break edge;
      }
  assert.ok(edgeX > 0, `${form}: nonempty crown reference`);
  const p = isoToScreen(12.5, 12.5),
    zoom = 340 / edgeX,
    camX = p.x + 500 / zoom,
    camY = p.y + edgeY;
  const clipped = createCanvas(400, 300),
    cc = clipped.getContext('2d');
  cc.translate(200, 150);
  cc.scale(zoom, zoom);
  cc.translate(-camX, -camY);
  drawObjects(cc as never, w, atm, 0, {
    life: null,
    wind: 0,
    zoom,
    camX,
    camY,
    viewW: 400,
    viewH: 300,
    movingId: -1,
    highlightId: -1,
    useSpriteCache: true,
    particles: false,
  });
  assert.ok(
    cc.getImageData(0, 0, 400, 300).data.some((v, i) => i % 4 === 3 && v > 30),
    `${form}: zoomed crown does not pop out at screen edge`,
  );
}
// Culling does not change any visible water pixels.
const surface = prepareWaterSurface(world).reduce((a, b) => (a.cells.length >= b.cells.length ? a : b)),
  bounds = waterSurfaceBounds(surface);
const waterX = (bounds.minX + bounds.maxX) / 2,
  waterY = (bounds.minY + bounds.maxY) / 2;
const water = createCanvas(360, 240),
  wc = water.getContext('2d');
const digest = () =>
  createHash('sha256')
    .update(wc.getImageData(0, 0, 360, 240).data)
    .digest('hex');
function waterFrame(view?: { minX: number; maxX: number; minY: number; maxY: number }) {
  water.width = 360;
  wc.translate(180 - waterX, 120 - waterY);
  drawWaterAnimation(wc as never, world, atm, 1000, 0.4, undefined, undefined, { view });
  return digest();
}
const full = waterFrame();
assert.ok(wc.getImageData(0, 0, 360, 240).data.some((v, i) => i % 4 === 3 && v > 0));
assert.equal(waterFrame({ minX: waterX - 188, maxX: waterX + 188, minY: waterY - 128, maxY: waterY + 128 }), full);
// One-pass paper retains the original two-pass material to within tiny colour-channel differences.
const swatches = createCanvas(512, 256),
  sc = swatches.getContext('2d'),
  reference = createCanvas(512, 256),
  rc = reference.getContext('2d');
for (const c of [sc, rc])
  for (let i = 0; i < 8; i++) {
    c.fillStyle = `rgb(${i * 32},${255 - i * 32},${i * 27})`;
    c.fillRect(i * 64, 0, 64, 256);
  }
const pattern = rc.createPattern(getPaperTile() as never, 'repeat')!;
for (const [mode, alpha] of [
  ['overlay', 0.14],
  ['soft-light', 0.1],
] as const) {
  rc.globalCompositeOperation = mode;
  rc.globalAlpha = alpha;
  rc.fillStyle = pattern;
  rc.fillRect(0, 0, 512, 256);
}
drawPaperGrain(sc as never, 512, 256, null);
const a = sc.getImageData(0, 0, 512, 256).data,
  b = rc.getImageData(0, 0, 512, 256).data;
let error = 0,
  max = 0;
for (let i = 0; i < a.length; i++)
  if (i % 4 !== 3) {
    const e = Math.abs(a[i] - b[i]);
    error += e;
    max = Math.max(max, e);
  }
assert.ok(error / (512 * 256 * 3) < 1 && max <= 3, `paper error ${error / (512 * 256 * 3)}, max ${max}`);
// Preference validation, legacy migration and accessible live switching.
const dom = new JSDOM('<!doctype html><div id="app"></div>', { url: 'https://garden.test' });
Object.assign(globalThis, { document: dom.window.document, window: dom.window, localStorage: dom.window.localStorage });
for (const bad of ['null', '42', '[]', '{', '{"uiScale":"huge","particles":0,"motion":null,"quality":"ultra"}']) {
  localStorage.setItem('usadba.view.v1', bad);
  assert.equal(loadView().uiScale, 1);
  assert.equal(loadView().quality, 'balanced');
  assert.equal(loadView().particles, true);
  assert.equal(loadView().smartWind, false);
}
for (const bad of ['false', 'true', 0, 1, null, []]) {
  localStorage.setItem('usadba.view.v1', JSON.stringify({ smartWind: bad }));
  assert.equal(loadView().smartWind, false, 'only an explicit boolean opts in');
}
localStorage.setItem(
  'usadba.view.v1',
  JSON.stringify({ particles: false, motion: false, uiScale: 1.2, contrast: true }),
);
const view = loadView();
let calls = 0;
const panel = new SettingsPanel(document.getElementById('app')!, view, () => calls++);
panel.setOpen(true);
for (const quality of qualities) {
  document.querySelector<HTMLButtonElement>(`[data-quality="${quality}"]`)!.click();
  assert.equal(view.quality, quality);
  assert.equal(loadView().quality, quality);
  assert.equal(document.activeElement?.getAttribute('data-quality'), quality);
  assert.equal(document.querySelector(`[data-quality="${quality}"]`)?.getAttribute('aria-pressed'), 'true');
  assert.equal(view.particles, false);
  assert.equal(view.motion, false);
  assert.equal(view.uiScale, 1.2);
}
assert.equal(calls, 3);
assert.equal(view.smartWind, false, 'legacy preferences opt out of smart wind');
for (const expected of [true, false, true]) {
  document.querySelector<HTMLButtonElement>('[data-act="smartWind"]')!.click();
  assert.equal(view.smartWind, expected);
  assert.equal(loadView().smartWind, expected);
  assert.equal(document.activeElement?.getAttribute('aria-checked'), String(expected));
  assert.equal(document.activeElement?.getAttribute('role'), 'switch');
  assert.equal(view.motion, false, 'wind is independent of reduced motion');
}
assert.equal(calls, 6);
saveView(view);
assert.deepEqual(loadView(), view);
dom.window.close();
console.log(
  'ок: three profiles, 60/90/120/144Hz cadence, actual loop simulation parity/hidden pause, DPR/picking/crop, zoom-edge crown, water culling parity, disabled/zero-dt weather, paper colour accuracy, legacy/corrupt settings, buttons/focus/persistence, unchanged saves',
);
if (process.argv.includes('--preview')) {
  const out = createCanvas(1920, 445),
    c = out.getContext('2d');
  c.fillStyle = '#eee9dc';
  c.fillRect(0, 0, 1920, 445);
  qualities.forEach((q, i) => {
    c.drawImage(frames[i], i * 640, 45);
    c.fillStyle = '#514b3f';
    c.font = '22px sans-serif';
    c.fillText(GRAPHICS[q].name + ' · до ' + GRAPHICS[q].fps + ' кадров/с · DPR ' + GRAPHICS[q].dpr, i * 640 + 18, 30);
  });
  writeFileSync('preview-graphics.png', out.toBuffer('image/png'));
}
