/**
 * Контроль кадров: матрица типовых сцен рендерится офлайн, каждый кадр
 * сворачивается в sha256. Рефакторинг не должен сдвинуть ни пикселя —
 * перед правкой снимаем эталон, после правки сверяем.
 *
 *   npx tsx tools/check-frames.ts              — просто прогнать и показать хэши
 *   npx tsx tools/check-frames.ts --save file  — сохранить эталон в file
 *   npx tsx tools/check-frames.ts --check file — сравнить с эталоном (≠0 при расхождении)
 */

import { createCanvas } from '@napi-rs/canvas';
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

// --- Полифиллы браузерных API для модулей рендера ---
const g = globalThis as Record<string, unknown>;
g.document = {
  createElement(tag: string) {
    if (tag === 'canvas') return createCanvas(8, 8);
    return {};
  },
};
g.window = { devicePixelRatio: 1, innerWidth: 1600, innerHeight: 900 };
// Частицы и живность ловят «настоящее» время для дрейфа и мерцания;
// в контрольном кадре время подменено собственным счётчиком.
let simNow = 10_000;
g.performance = { now: () => simNow };

// Сиды предметов стартового сада берутся из Math.random — фиксируем,
// иначе два запуска дадут разные кадры.
async function pinRandom() {
  const { makeRng } = await import('../src/core/rng');
  const rng = makeRng(20260617);
  Math.random = rng;
}

interface FrameCase {
  name: string;
  hour: number;
  season: 'spring' | 'summer' | 'autumn' | 'winter';
  weather: 'clear' | 'rain' | 'storm' | 'fog' | 'snow';
  falls?: boolean;
  paths?: boolean;
  noRoof?: boolean;
  warm?: number;
}

const CASES: FrameCase[] = [
  { name: 'весна-день', hour: 14, season: 'spring', weather: 'clear' },
  { name: 'весна-закат', hour: 19.3, season: 'spring', weather: 'clear' },
  { name: 'весна-ночь', hour: 0.4, season: 'spring', weather: 'clear' },
  { name: 'лето-полдень', hour: 12.5, season: 'summer', weather: 'clear' },
  { name: 'лето-дождь', hour: 17, season: 'summer', weather: 'rain' },
  { name: 'лето-гроза', hour: 21, season: 'summer', weather: 'storm' },
  { name: 'осень-туман', hour: 8, season: 'autumn', weather: 'fog' },
  { name: 'осень-день', hour: 15, season: 'autumn', weather: 'clear' },
  { name: 'зима-сумерки', hour: 16.5, season: 'winter', weather: 'clear' },
  { name: 'зима-снег', hour: 11, season: 'winter', weather: 'snow' },
  { name: 'водопад', hour: 10, season: 'spring', weather: 'clear', falls: true },
  { name: 'тропы', hour: 10, season: 'autumn', weather: 'clear', paths: true },
  { name: 'без-крыши', hour: 13, season: 'summer', weather: 'clear', noRoof: true },
];

const W = 800;
const H = 500;

async function renderCase(c: FrameCase): Promise<string> {
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
  scene.centerOn(GRID / 2, GRID / 2 + 1.5);
  scene.camera.zoom = 0.62;
  scene.particles = true;
  if (c.noRoof) {
    scene.roofVisible = false;
    scene.snapRoof();
  }

  if (c.falls) {
    const { BRUSH_BY_ID } = await import('../src/world/catalog');
    world.applyBrush(BRUSH_BY_ID.get('w_cascade')!, 9, 17);
    world.applyBrush(BRUSH_BY_ID.get('w_spring')!, 5, 14);
    world.applyBrush(BRUSH_BY_ID.get('h_steps')!, 12, 20);
  }
  if (c.paths) {
    const { findPath, layPath } = await import('../src/world/paths');
    for (const [a, b] of [
      [
        [2, 22],
        [23, 19],
      ],
      [
        [20, 2],
        [12, 21],
      ],
    ] as [number, number][][]) {
      const cells = findPath(world, { x: a[0], y: a[1] }, { x: b[0], y: b[1] });
      if (cells) layPath(world, cells);
    }
  }

  const d = new Date(midSeasonMs(['spring', 'summer', 'autumn', 'winter'].indexOf(c.season)));
  d.setHours(Math.floor(c.hour), Math.round((c.hour % 1) * 60), 0, 0);
  const t = computeTime(d.getTime());

  const ws = new WeatherSystem();
  ws.force(c.weather);
  for (let i = 0; i < 300; i++) ws.update(60, t);
  const atm = buildAtmosphere(t, ws.state.overcast);

  const life = new Life();
  // Крупные шаги до съёмки: жители успевают прийти, и кадр показывает
  // сад таким, каким его видит игрок через минуту после открытия крышки.
  for (let i = 0; i < 60; i++) life.update(world, t, 2000, 1000 + i * 2000, ws.state);
  const warm = c.warm ?? 120;
  for (let i = 0; i < warm; i++) {
    const ms = 130_000 + i * 16;
    simNow = ms;
    life.update(world, t, 16, ms, ws.state);
    ws.update(16, t);
    scene.render(world, atm, ms, 16, life, ws.state);
  }

  const buf = (canvas as unknown as { toBuffer(mime: string): Buffer }).toBuffer('image/png');
  return createHash('sha256').update(buf).digest('hex').slice(0, 16);
}

async function main() {
  await pinRandom();
  const saveIdx = process.argv.indexOf('--save');
  const checkIdx = process.argv.indexOf('--check');

  const hashes: Record<string, string> = {};
  for (const c of CASES) {
    hashes[c.name] = await renderCase(c);
    console.log(`${c.name.padEnd(14)} ${hashes[c.name]}`);
  }

  if (saveIdx >= 0) {
    const file = process.argv[saveIdx + 1];
    writeFileSync(file, JSON.stringify(hashes, null, 2) + '\n');
    console.log(`эталон записан в ${file}`);
  }

  if (checkIdx >= 0) {
    const file = process.argv[checkIdx + 1];
    const base = JSON.parse(readFileSync(file, 'utf8')) as Record<string, string>;
    let bad = 0;
    for (const c of CASES) {
      if (base[c.name] !== hashes[c.name]) {
        console.log(`ПАД  ${c.name}: эталон ${base[c.name]}, сейчас ${hashes[c.name]}`);
        bad++;
      }
    }
    if (bad > 0) {
      console.log(`расхождение в ${bad} кадрах — картинка сдвинулась!`);
      process.exit(1);
    }
    console.log('кадры совпали с эталоном');
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
