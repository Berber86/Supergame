/**
 * Лист предметов: рисует выбранные объекты каталога крупно, по сезонам.
 * Инструмент разработки — проверить силуэты без запуска игры.
 *   npx tsx tools/item-sheet.ts [id,id,id]
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
g.window = { devicePixelRatio: 1, innerWidth: 1200, innerHeight: 700 };
g.performance = g.performance ?? { now: () => Date.now() };
g.localStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };

async function main() {
  const { drawObject } = await import('../src/render/sprites');
  const { buildAtmosphere } = await import('../src/world/palette');
  const { computeTime, SEASON_MS } = await import('../src/core/clock');
  const { ITEM_BY_ID } = await import('../src/world/catalog');
  const type = await import('../src/world/types');

  const ids = (process.argv[2] ?? 'wisteria,persimmon,camellia,reed,horsetail,water_stone').split(',');
  const seasons = ['spring', 'summer', 'autumn', 'winter'] as const;

  const cw = 150;
  const ch = 175;
  const W = cw * ids.length + 90;
  const H = ch * seasons.length + 50;
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d') as unknown as CanvasRenderingContext2D;

  ctx.fillStyle = '#efe8da';
  ctx.fillRect(0, 0, W, H);

  const EPOCH = Date.UTC(2024, 2, 20, 0, 0, 0);

  for (let si = 0; si < seasons.length; si++) {
    const d = new Date(EPOCH + si * SEASON_MS + 86400e3 * 1.5);
    d.setHours(13, 0, 0, 0);
    const atm = buildAtmosphere(computeTime(d.getTime()), 0);

    ctx.fillStyle = '#6b4a33';
    ctx.font = '15px serif';
    ctx.fillText(seasons[si], 8, 50 + si * ch + ch * 0.5);

    for (let ii = 0; ii < ids.length; ii++) {
      const id = ids[ii];
      const item = ITEM_BY_ID.get(id);
      const x = 90 + ii * cw + cw * 0.5;
      const y = 40 + si * ch + ch * 0.82;

      // подложка-«земля»
      ctx.fillStyle = 'rgba(150,170,130,0.25)';
      ctx.beginPath();
      ctx.ellipse(x, y, 42, 14, 0, 0, Math.PI * 2);
      ctx.fill();

      const obj: type.PlacedObject = {
        id: -1,
        type: id,
        tx: 0,
        ty: 0,
        planted: Date.now() - 864e5 * 30,
        rot: 0,
        seed: 4242 + ii * 17,
      };
      drawObject({ ctx: ctx as never, x, y, atm, g: 1, obj, time: 3000, wind: 0.5, alpha: 1 });

      if (si === 0) {
        ctx.fillStyle = '#5a4030';
        ctx.font = '13px serif';
        ctx.textAlign = 'center';
        ctx.fillText(item?.name ?? id, x, 30);
        ctx.textAlign = 'left';
      }
    }
  }

  const out = process.env.OUT ?? 'item-sheet.png';
  writeFileSync(out, canvas.toBuffer('image/png'));
  console.log(`${out}  ${ids.length} предметов × ${seasons.length} сезона`);
}

main();
