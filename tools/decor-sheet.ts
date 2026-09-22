/**
 * Лист декора: рисует каждый предмет крупно на чистом фоне, чтобы
 * видеть качество формы отдельно от сцены. Только для разработки.
 *
 *   npx tsx tools/decor-sheet.ts [outdir]
 *   DECOR=well,garden_bench,hammock  — только эти предметы
 *   ROT=0,1                          — повороты для листа
 *   SCALE=3                          — масштаб
 */

import { createCanvas } from '@napi-rs/canvas';
import { mkdirSync, writeFileSync } from 'node:fs';

const g = globalThis as Record<string, unknown>;
g.document = { createElement: (t: string) => (t === 'canvas' ? createCanvas(8, 8) : {}) };
g.window = { devicePixelRatio: 1, innerWidth: 1600, innerHeight: 900 };

const LIST: { id: string; rotatable: boolean }[] = [
  { id: 'moss_log', rotatable: true },
  { id: 'stump', rotatable: false },
  { id: 'mushrooms', rotatable: false },
  { id: 'fence_wood', rotatable: true },
  { id: 'fence_stone', rotatable: true },
  { id: 'jizo', rotatable: false },
  { id: 'well', rotatable: false },
  { id: 'garden_bench', rotatable: true },
  { id: 'woodpile', rotatable: true },
  { id: 'nestbox', rotatable: false },
  { id: 'hammock', rotatable: true },
  { id: 'matatabi', rotatable: false },
];

// Эталоны, которые считаются хорошими, — для сравнения в том же масштабе.
const REFERENCE: { id: string; rotatable: boolean }[] = [
  { id: 'feeder', rotatable: false },
  { id: 'birdbath', rotatable: false },
  { id: 'beehive', rotatable: false },
];

async function main() {
  const outDir = process.argv[2] ?? 'shots/decor';
  mkdirSync(outDir, { recursive: true });
  const only = (process.env.DECOR ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const rots = (process.env.ROT ?? '0,1')
    .split(',')
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isFinite(n));
  const scale = Number(process.env.SCALE ?? 3);

  const {
    drawMossLog,
    drawStump,
    drawMushrooms,
    drawFenceWood,
    drawFenceStone,
    drawJizo,
    drawWell,
    drawGardenBench,
    drawWoodpile,
    drawNestbox,
    drawHammock,
    drawMatatabi,
  } = await import('../src/render/sprites/decor');
  const { drawFeeder, drawBirdbath, drawBeehive } = await import('../src/render/sprites/buildings');
  const { buildAtmosphere } = await import('../src/world/palette');
  const { computeTime, midSeasonMs } = await import('../src/core/clock');
  const { seasonNoon } = await import('../src/core/clock').catch(() => ({ seasonNoon: undefined }));

  const drawers: Record<string, (d: unknown) => void> = {
    moss_log: drawMossLog,
    stump: drawStump,
    mushrooms: drawMushrooms,
    fence_wood: drawFenceWood,
    fence_stone: drawFenceStone,
    jizo: drawJizo,
    well: drawWell,
    garden_bench: drawGardenBench,
    woodpile: drawWoodpile,
    nestbox: drawNestbox,
    hammock: drawHammock,
    matatabi: drawMatatabi,
    feeder: drawFeeder,
    birdbath: drawBirdbath,
    beehive: drawBeehive,
  };

  // Полдень нужного сезона
  const d = new Date(midSeasonMs(1)); // summer
  d.setHours(12, 0, 0, 0);
  void seasonNoon;
  const t = computeTime(d.getTime());
  const atm = buildAtmosphere(t, 0);

  const W = Math.round(220 * scale);
  const H = Math.round(200 * scale);
  const items = [...LIST, ...REFERENCE].filter((it) => !only.length || only.includes(it.id));
  const canvas = createCanvas(W, H);

  function renderOne(id: string, rot: number, season: 'spring' | 'summer' | 'autumn' | 'winter', name: string) {
    const dd = new Date(midSeasonMs(['spring', 'summer', 'autumn', 'winter'].indexOf(season)));
    dd.setHours(12, 0, 0, 0);
    const tt = computeTime(dd.getTime());
    const aa = buildAtmosphere(tt, 0);
    const ctx = canvas.getContext('2d') as unknown as CanvasRenderingContext2D;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, W, H);
    // лёгкая земля, чтобы тень читалась
    ctx.fillStyle = 'rgba(224, 232, 216, 1)';
    ctx.fillRect(0, 0, W, H);
    ctx.translate(W / 2, H * 0.72);
    ctx.scale(scale, scale);
    const obj = { id: 1, type: id, tx: 0, ty: 0, planted: 0, rot, seed: 4242 };
    const dc = { ctx, x: 0, y: 0, atm: aa, g: 1, obj, time: 1000 * 60 * 60 * 10, wind: 0, alpha: 1 };
    drawers[id](dc as never);
    const out = `${outDir}/${name}.png`;
    writeFileSync(out, (canvas as unknown as { toBuffer(m: string): Buffer }).toBuffer('image/png'));
    console.log(out);
  }

  for (const it of items) {
    for (const rot of rots) {
      if (rot !== 0 && !it.rotatable) continue;
      renderOne(it.id, rot, 'summer', `${it.id}-r${rot}`);
      if (
        it.id === 'well' ||
        it.id === 'hammock' ||
        it.id === 'garden_bench' ||
        it.id === 'moss_log' ||
        it.id === 'woodpile' ||
        it.id === 'nestbox' ||
        it.id === 'fence_wood' ||
        it.id === 'fence_stone'
      ) {
        renderOne(it.id, rot, 'winter', `${it.id}-r${rot}-winter`);
      }
    }
  }
  console.log('готово');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
