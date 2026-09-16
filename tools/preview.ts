/**
 * Оффлайн-превью: рендерит сцену через @napi-rs/canvas в PNG.
 * Нужно только для разработки — посмотреть на сад без браузера.
 *   npx tsx tools/preview.ts [часы] [сезон] [файл]
 */

import { createCanvas } from '@napi-rs/canvas';
import { writeFileSync } from 'node:fs';

// --- Полифиллы браузерных API для модулей рендера ---
const g = globalThis as Record<string, unknown>;
g.document = {
  createElement(tag: string) {
    if (tag === 'canvas') return createCanvas(8, 8);
    return {};
  },
};
g.window = { devicePixelRatio: 1, innerWidth: 1600, innerHeight: 900 };
g.performance = g.performance ?? { now: () => Date.now() };

async function main() {
  const { Scene } = await import('../src/render/scene');
  const { World } = await import('../src/world/world');
  const { buildAtmosphere } = await import('../src/world/palette');
  const { computeTime, SEASON_MS, DAY_MS } = await import('../src/core/clock');
  const { GRID } = await import('../src/core/iso');
  const { Life } = await import('../src/world/life');

  const W = Number(process.env.W ?? 1500);
  const H = Number(process.env.H ?? 860);

  const hour = Number(process.argv[2] ?? 11);
  const seasonArg = (process.argv[3] ?? 'spring') as string;
  const out = process.argv[4] ?? `preview-${seasonArg}-${hour}.png`;

  const canvas = createCanvas(W, H) as unknown as HTMLCanvasElement;
  (canvas as unknown as Record<string, unknown>).clientWidth = W;
  (canvas as unknown as Record<string, unknown>).clientHeight = H;

  const world = new World();
  const scene = new Scene(canvas);
  scene.resize();
  scene.centerOn(GRID / 2, GRID / 2 + 1.5);
  scene.camera.zoom = Number(process.env.ZOOM ?? 0.85);
  if (process.env.CX) scene.centerOn(Number(process.env.CX), Number(process.env.CY ?? 12));

  // Собираем момент времени: нужный час нужного сезона
  const seasons = ['spring', 'summer', 'autumn', 'winter'];
  const si = Math.max(0, seasons.indexOf(seasonArg));
  const EPOCH = Date.UTC(2024, 2, 20, 0, 0, 0);
  const base = EPOCH + si * SEASON_MS + DAY_MS * 1.5;
  const d = new Date(base);
  d.setHours(Math.floor(hour), Math.round((hour % 1) * 60), 0, 0);

  const t = computeTime(d.getTime());
  const atm = buildAtmosphere(t);

  // Прогреваем частицы и живность
  const life = new Life();
  const WARM = Number(process.env.WARM ?? 260);
  for (let i = 0; i < WARM; i++) {
    life.update(world, t, 16, 1000 + i * 16);
    scene.render(world, atm, 1000 + i * 16, 16, life);
  }
  console.log(`кот@${life.cats[0] ? life.cats[0].tx.toFixed(1)+','+life.cats[0].ty.toFixed(1)+' '+life.cats[0].state : '-'} коты=${life.cats.length} птицы=${life.birds.length} порхают=${life.flutters.length} карпы=${life.fish.length} ветер=${life.windBase.toFixed(2)}`);

  const buf = (canvas as unknown as { toBuffer(mime: string): Buffer }).toBuffer('image/png');
  writeFileSync(out, buf);
  console.log(`${out}  ${t.label} ${t.season}  daylight=${t.daylight.toFixed(2)} golden=${t.golden.toFixed(2)}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
