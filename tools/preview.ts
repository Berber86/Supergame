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
  const { WeatherSystem } = await import('../src/world/weatherState');

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
  if (process.env.FIT) scene.fitToView();
  else scene.camera.zoom = Number(process.env.ZOOM ?? 0.85);
  if (process.env.NOROOF) { scene.roofVisible = false; scene.snapRoof(); }
  if (process.env.NOPARTICLES) scene.particles = false;
  if (process.env.NOCACHE) scene.useSpriteCache = false;
  if (process.env.CX) scene.centerOn(Number(process.env.CX), Number(process.env.CY ?? 12));

  // Собираем момент времени: нужный час нужного сезона
  const seasons = ['spring', 'summer', 'autumn', 'winter'];
  const si = Math.max(0, seasons.indexOf(seasonArg));
  const EPOCH = Date.UTC(2024, 2, 20, 0, 0, 0);
  const base = EPOCH + si * SEASON_MS + DAY_MS * 1.5;
  const d = new Date(base);
  d.setHours(Math.floor(hour), Math.round((hour % 1) * 60), 0, 0);

  // Тестовый водопад: приподнятый исток и спуск к пруду
  if (process.env.FALLS) {
    const { BRUSH_BY_ID } = await import('../src/world/catalog');
    world.applyBrush(BRUSH_BY_ID.get('w_cascade')!, 9, 17);
    world.applyBrush(BRUSH_BY_ID.get('w_spring')!, 5, 14);
    world.applyBrush(BRUSH_BY_ID.get('h_steps')!, 12, 20);
  }

  // Тестовая расстановка новых предметов
  if (process.env.ITEMS) {
    const spots: [string, number, number][] = [
      ['wisteria', 7.5, 7.5], ['persimmon', 5.5, 9.5], ['camellia', 8.25, 10.25],
      ['fusuma', 6, 5], ['tokonoma', 8, 4], ['irori', 7.5, 6.5],
      ['futon', 5.5, 6.5], ['byobu', 9.5, 5.5], ['bonsai', 6.25, 4.25],
      ['reed', 13.25, 16.25], ['reed', 13.75, 16.75], ['horsetail', 14.25, 17.25],
      ['water_stone', 16.25, 13.25], ['plank_bridge', 15, 15],
    ];
    for (const [id, x, y] of spots) world.place(id, x, y, 0, Date.now() - 864e5 * 30);
  }

  if (process.env.PATHS) {
    const { findPath, layPath } = await import('../src/world/paths');
    for (const [a, b] of [
      [[2, 22], [23, 19]],
      [[20, 2], [12, 21]],
    ] as [number, number][][]) {
      const cells = findPath(world, { x: a[0], y: a[1] }, { x: b[0], y: b[1] });
      if (cells) layPath(world, cells);
    }
  }

  const t = computeTime(d.getTime());
  const ws = new WeatherSystem();
  const wkind = (process.env.WEATHER ?? 'clear') as 'clear' | 'rain' | 'storm' | 'fog' | 'snow';
  ws.force(wkind);
  // разгоняем погоду до полной силы
  for (let i = 0; i < 300; i++) ws.update(60, t);
  const atm = buildAtmosphere(t, ws.state.overcast);

  // Прогреваем частицы и живность
  const life = new Life();
  const WARM = Number(process.env.WARM ?? 260);
  for (let i = 0; i < WARM; i++) {
    life.update(world, t, 16, 1000 + i * 16);
    ws.update(16, t);
    scene.render(world, atm, 1000 + i * 16, 16, life, ws.state);
  }
  console.log(`погода=${wkind} дождь=${ws.state.rain.toFixed(2)} туман=${ws.state.fog.toFixed(2)} тучи=${ws.state.overcast.toFixed(2)} | кот@${life.cats[0] ? life.cats[0].tx.toFixed(1)+','+life.cats[0].ty.toFixed(1)+' '+life.cats[0].state : '-'} коты=${life.cats.length} птицы=${life.birds.length} порхают=${life.flutters.length} карпы=${life.fish.length} ветер=${life.windBase.toFixed(2)}`);

  const buf = (canvas as unknown as { toBuffer(mime: string): Buffer }).toBuffer('image/png');
  writeFileSync(out, buf);
  console.log(`${out}  ${t.label} ${t.season}  daylight=${t.daylight.toFixed(2)} golden=${t.golden.toFixed(2)}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
