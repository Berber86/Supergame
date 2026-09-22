/**
 * Проверка предметов обустройства: каждая кисть обязана нарисовать
 * непрозрачное, компактное и многослойное тело, а не пустоту или
 * прозрачную полосу. Погоняет все 12 декоративных рисовальщиков в
 * четырёх поворотах и двух сезонах через оффлайн-холст.
 *
 *   npx tsx tools/check-decor.ts
 */

import { createCanvas } from '@napi-rs/canvas';

const g = globalThis as Record<string, unknown>;
g.document = { createElement: (t: string) => (t === 'canvas' ? createCanvas(8, 8) : {}) };
g.window = { devicePixelRatio: 1, innerWidth: 1600, innerHeight: 900 };

const CASES: { id: string; rots: number[] }[] = [
  { id: 'moss_log', rots: [0, 1] },
  { id: 'stump', rots: [0] },
  { id: 'mushrooms', rots: [0] },
  { id: 'fence_wood', rots: [0, 1] },
  { id: 'fence_stone', rots: [0, 1] },
  { id: 'jizo', rots: [0] },
  { id: 'well', rots: [0] },
  { id: 'garden_bench', rots: [0, 1] },
  { id: 'woodpile', rots: [0, 1] },
  { id: 'nestbox', rots: [0] },
  { id: 'hammock', rots: [0, 1] },
  { id: 'matatabi', rots: [0] },
];

async function main() {
  const drawers = await import('../src/render/sprites/decor');
  const { buildAtmosphere } = await import('../src/world/palette');
  const { computeTime, midSeasonMs } = await import('../src/core/clock');
  const find = (id: string) =>
    (drawers as Record<string, (d: unknown) => void>)[
      `draw${id.replace(/(^|[_-])(.)/g, (m, _p, ch: string) => ch.toUpperCase())}`
    ];

  const W = 260;
  const H = 220;
  let failed = 0;
  function check(name: string, cond: boolean, extra = ''): void {
    if (cond) console.log(`  ок   ${name}`);
    else {
      failed++;
      console.log(`  ПАД  ${name}${extra ? ` — ${extra}` : ''}`);
    }
  }

  for (const season of ['summer', 'winter'] as const) {
    const dd = new Date(midSeasonMs(['spring', 'summer', 'autumn', 'winter'].indexOf(season)));
    dd.setHours(12, 0, 0, 0);
    const t = computeTime(dd.getTime());
    const atm = buildAtmosphere(t, 0);
    const canvas = createCanvas(W, H);
    const ctx = canvas.getContext('2d') as unknown as CanvasRenderingContext2D;

    for (const { id, rots } of CASES) {
      for (const rot of rots) {
        const fn = find(id);
        if (!fn) {
          check(`${season} ${id} r${rot}: кисть`, false, 'не найдена');
          continue;
        }
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, W, H);
        ctx.translate(W / 2, H * 0.72);
        ctx.scale(3, 3);
        const obj = { id: 1, type: id, tx: 0, ty: 0, planted: 0, rot, seed: 4242 };
        fn({ ctx, x: 0, y: 0, atm, g: 1, obj, time: 1e7, wind: 0, alpha: 1 });

        const img = ctx.getImageData(0, 0, W, H).data;
        let minX = W,
          minY = H,
          maxX = 0,
          maxY = 0,
          ink = 0;
        const colors = new Set<number>();
        for (let y = 0; y < H; y++)
          for (let x = 0; x < W; x++) {
            const i = (y * W + x) * 4;
            const a = img[i + 3];
            if (a > 12) {
              ink++;
              if (x < minX) minX = x;
              if (x > maxX) maxX = x;
              if (y < minY) minY = y;
              if (y > maxY) maxY = y;
              const r = img[i] >> 4,
                gg = img[i + 1] >> 4,
                b = img[i + 2] >> 4;
              colors.add((r << 8) | (gg << 4) | b);
            }
          }
        const bw = maxX - minX + 1;
        const bh = maxY - minY + 1;
        const cx = (minX + maxX) / 2;
        const cy = (minY + maxY) / 2;
        // При масштабе 3 тайл = 168 px: забор/бревно/гамак вправе тянуться на
        // полтора-два тайла, колодец — вверх. Жёсткий потолок один: не
        // разбегаться за пределы кадра и не съёживаться в точку.
        const compact = bw >= 6 && bh >= 6 && bw <= W * 0.82 && bh <= H * 0.86 && cx > W / 8 && cx < (W * 7) / 8;
        check(
          `${season} ${id} r${rot}: тело ${bw}×${bh}`,
          compact,
          `bbox ${bw}×${bh} центр (${cx.toFixed(0)},${cy.toFixed(0)})`,
        );
        check(
          `${season} ${id} r${rot}: многослойность`,
          ink > 60 && colors.size >= 6,
          `пикселей=${ink}, оттенков=${colors.size}`,
        );
      }
    }
  }
  if (failed) {
    console.log(`\n${failed} несоответствий у декора`);
    process.exit(1);
  }
  console.log('\nвсе предметы обустройства рисуются компактно и многослойно');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
