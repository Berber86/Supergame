/**
 * Офлайн-кадры сада в разные часы — чтобы глазами увидеть тени и закат.
 *   npx tsx tools/shot-times.ts /tmp/out.png 12 19.3 0.4
 */
import { createCanvas } from '@napi-rs/canvas';
import { writeFileSync } from 'node:fs';

const g = globalThis as Record<string, unknown>;
g.document = {
  createElement(tag: string) {
    if (tag === 'canvas') return createCanvas(8, 8);
    return {};
  },
};
g.window = { devicePixelRatio: 1, innerWidth: 1600, innerHeight: 900 };
let simNow = 10_000;
g.performance = { now: () => simNow };

async function pinRandom() {
  const { makeRng } = await import('../src/core/rng');
  const rng = makeRng(20260617);
  Math.random = rng;
}

const W = 900;
const H = 560;

async function renderOne(hour: number, out: string, seasonIdx = 0, zoom = 0.62): Promise<void> {
  const { Scene } = await import('../src/render/scene');
  const { World } = await import('../src/world/world');
  const { buildAtmosphere } = await import('../src/world/palette');
  const { computeTime, midSeasonMs } = await import('../src/core/clock');
  const { Life } = await import('../src/world/life');
  const { WeatherSystem } = await import('../src/world/weatherState');
  const { GRID } = await import('../src/core/iso');

  const canvas = createCanvas(W, H) as unknown as HTMLCanvasElement;
  (canvas as unknown as Record<string, unknown>).clientWidth = W;
  (canvas as unknown as Record<string, unknown>).clientHeight = H;

  const world = new World();
  const scene = new Scene(canvas);
  scene.resize();
  // Вид игрока: «сад целиком», как на старте — с полосой неба и горами.
  scene.fitToView();
  if (Math.abs(scene.camera.zoom - 0.62) < 0.01) scene.camera.zoom = 0.62;
  scene.particles = true;

  const d = new Date(midSeasonMs(seasonIdx));
  d.setHours(Math.floor(hour), Math.round((hour % 1) * 60), 0, 0);
  const t = computeTime(d.getTime());

  const ws = new WeatherSystem();
  ws.force('clear');
  for (let i = 0; i < 60; i++) ws.update(60, t);
  const atm = buildAtmosphere(t, ws.state.overcast);

  const life = new Life();
  for (let i = 0; i < 40; i++) life.update(world, t, 2000, 1000 + i * 2000, ws.state);
  for (let i = 0; i < 120; i++) {
    const ms = 130_000 + i * 16;
    simNow = ms;
    life.update(world, t, 16, ms, ws.state);
    ws.update(16, t);
    scene.render(world, atm, ms, 16, life, ws.state);
  }

  const buf = (canvas as unknown as { toBuffer(mime: string): Buffer }).toBuffer('image/png');
  writeFileSync(out, buf);
  console.log(
    `${out}  (${String(Math.floor(hour)).padStart(2, '0')}:${String(Math.round((hour % 1) * 60)).padStart(2, '0')}, daylight=${t.daylight.toFixed(2)}, golden=${t.golden.toFixed(2)}, shadowAmount=${atm.shadowAmount.toFixed(3)}, sunElev=${atm.sunElev.toFixed(2)})`,
  );
}

async function main() {
  await pinRandom();
  const outDir = process.argv[2] ?? '/tmp/shots';
  const hours = (process.argv[3] ?? '6.2,9,12.5,15,17.5,19.2,20,21.5,0.5').split(',').map(Number);
  for (const h of hours) {
    await renderOne(h, `${outDir}/h${String(h).replace('.', '_')}.png`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
