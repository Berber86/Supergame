/**
 * Проверка частичной перерисовки земли.
 * Обновление участка обязано совпасть с полной перерисовкой пиксель в пиксель.
 *   npx tsx tools/check-dirty.ts
 */
import { createCanvas } from '@napi-rs/canvas';

const g = globalThis as Record<string, unknown>;
g.document = { createElement: (tag: string) => (tag === 'canvas' ? createCanvas(8, 8) : {}) };
g.window = { devicePixelRatio: 1, innerWidth: 1600, innerHeight: 900 };
g.localStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };

async function main() {
  const { World } = await import('../src/world/world');
  const { buildAtmosphere } = await import('../src/world/palette');
  const { computeTime } = await import('../src/core/clock');
  const { renderTerrain } = await import('../src/render/terrain');
  const { BRUSH_BY_ID } = await import('../src/world/catalog');

  const cases: {
    name: string;
    hour: number;
    setup?: (w: InstanceType<typeof World>) => void;
    act: (w: InstanceType<typeof World>) => void;
  }[] = [
    { name: 'кисть мха 1×1', hour: 13, act: (w) => w.applyBrush(BRUSH_BY_ID.get('g_moss')!, 8, 20) },
    {
      name: 'кисть гравия 5×5',
      hour: 13,
      act: (w) => {
        w.brushSize = 5;
        w.applyBrush(BRUSH_BY_ID.get('g_gravel')!, 8, 20);
      },
    },
    { name: 'каскад с каменными берегами', hour: 13, act: (w) => w.applyBrush(BRUSH_BY_ID.get('w_cascade')!, 9, 17) },
    {
      name: 'правка существующего каскада',
      hour: 13,
      setup: (w) => w.applyBrush(BRUSH_BY_ID.get('w_cascade')!, 9, 17),
      act: (w) => w.applyBrush(BRUSH_BY_ID.get('h_low')!, 10, 18),
    },
    { name: 'пруд 4×4', hour: 9, act: (w) => w.applyBrush(BRUSH_BY_ID.get('w_pond4')!, 6, 21) },
    { name: 'холм 3×3 (меняет высоту)', hour: 17, act: (w) => w.applyBrush(BRUSH_BY_ID.get('h_hill3')!, 5, 19) },
    { name: 'ложбина 3×3', hour: 17, act: (w) => w.applyBrush(BRUSH_BY_ID.get('h_low')!, 20, 8) },
    { name: 'заливка области', hour: 13, act: (w) => w.floodFill(2, 24, 'sand') },
    { name: 'край сада', hour: 13, act: (w) => w.applyBrush(BRUSH_BY_ID.get('g_stone')!, 0, 25) },
    { name: 'зима, снег', hour: 16, act: (w) => w.applyBrush(BRUSH_BY_ID.get('g_soil')!, 9, 18) },
  ];

  // Порог заметности — на канал, а не на сумму каналов.
  //
  // Раньше складывались все четыре канала и сравнивались с тем же числом:
  // расхождение 3/255 на каждом канале давало сумму 9 и «проваливало»
  // проверку, хотя глазом такое не различить. Меряем максимум по каналу —
  // так порог означает ровно то, что написано.
  const EPS = 4;
  let worst = 0;
  let worstD = 0;
  for (const c of cases) {
    const w = new World();
    const d = new Date();
    d.setHours(c.hour, 0, 0, 0);
    // последний случай проверяем зимой
    const ms = c.name.includes('зима') ? d.getTime() + 9 * 86400e3 : d.getTime();
    const t = computeTime(ms);
    const atm = buildAtmosphere(t, 0);

    c.setup?.(w);
    const layer = renderTerrain(w, atm, 1);
    w.clearTouched();
    c.act(w);
    const r = w.lastTouched;
    if (!r) {
      console.log(`${c.name}: земля не тронута — пропуск`);
      continue;
    }

    const partial = renderTerrain(w, atm, 1, layer, r);
    const full = renderTerrain(w, atm, 1);
    const a = (partial.canvas as never as HTMLCanvasElement)
      .getContext('2d')!
      .getImageData(0, 0, partial.canvas.width, partial.canvas.height).data;
    const b = (full.canvas as never as HTMLCanvasElement)
      .getContext('2d')!
      .getImageData(0, 0, full.canvas.width, full.canvas.height).data;

    let diff = 0;
    let maxd = 0;
    for (let i = 0; i < a.length; i += 4) {
      const dr = Math.max(
        Math.abs(a[i] - b[i]),
        Math.abs(a[i + 1] - b[i + 1]),
        Math.abs(a[i + 2] - b[i + 2]),
        Math.abs(a[i + 3] - b[i + 3]),
      );
      if (dr > EPS) {
        diff++;
        maxd = Math.max(maxd, dr);
      }
    }
    worst = Math.max(worst, diff);
    worstD = Math.max(worstD, maxd);
    const total = a.length / 4;
    console.log(
      `${diff === 0 ? '✔' : '✘'} ${c.name}: участок ${r.x0},${r.y0}–${r.x1},${r.y1} · расхождений ${diff} из ${total}${maxd ? `, макс ${maxd}` : ''}`,
    );
  }
  console.log(
    worst === 0
      ? '\nЧастичная перерисовка совпадает с полной.'
      : `\nЕСТЬ РАСХОЖДЕНИЯ (худшее: ${worst} пикселей, дельта ${worstD})`,
  );
  process.exit(worst === 0 ? 0 : 1);
}
main();
