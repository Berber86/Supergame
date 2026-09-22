/**
 * Лист роста сосны: пять форм × ступени от саженца до взрослого дерева.
 * Инструмент разработки — увидеть стадии роста без запуска игры.
 *   npx tsx tools/pine-growth-sheet.ts [out.png]
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
  const { drawObject, setSkipShadows } = await import('../src/render/sprites');
  const { buildAtmosphere } = await import('../src/world/palette');
  const { computeTime } = await import('../src/core/clock');
  const { PINE_FORMS, PINE_FORM_NAMES, pineProfile } = await import('../src/world/pine');
  const { PINE_STAGES } = await import('../src/world/pine');

  const seeds = Array.from({ length: 512 }, (_, i) => i);
  const examples = PINE_FORMS.map((form) => seeds.find((seed) => pineProfile(seed).form === form)!);

  const stages = [0.02, ...PINE_STAGES.map((s) => Math.min(1, (s.from + s.to) / 2)), 1];
  const cw = 240;
  const ch = 300;
  const left = 170;
  const W = left + cw * stages.length + 20;
  const H = 70 + ch * examples.length + 20;
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d') as unknown as CanvasRenderingContext2D;

  ctx.fillStyle = '#ece7d6';
  ctx.fillRect(0, 0, W, H);

  const atm = buildAtmosphere(computeTime(new Date(2026, 8, 20, 13).getTime()), 0);

  stages.forEach((stage, i) => {
    ctx.fillStyle = '#6b4a33';
    ctx.font = '16px serif';
    ctx.fillText(`g = ${stage.toFixed(2)}`, left + i * cw + cw * 0.32, 34);
  });

  examples.forEach((seed, row) => {
    const y0 = 70 + row * ch;
    ctx.fillStyle = '#6b4a33';
    ctx.font = '17px serif';
    ctx.fillText(PINE_FORM_NAMES[pineProfile(seed).form], 14, y0 + ch * 0.5);
    stages.forEach((stage, i) => {
      const x = left + i * cw + cw * 0.5;
      const y = y0 + ch * 0.88;
      ctx.fillStyle = 'rgba(150,170,130,0.25)';
      ctx.beginPath();
      ctx.ellipse(x, y, 60, 15, 0, 0, Math.PI * 2);
      ctx.fill();
      setSkipShadows(true);
      try {
        drawObject({
          ctx: ctx as never,
          x,
          y,
          atm,
          g: stage,
          obj: { id: 1, type: 'pine', seed, rot: 0, tx: 0, ty: 0, planted: 0 },
          time: 0,
          wind: 0,
          alpha: 1,
        });
      } finally {
        setSkipShadows(false);
      }
    });
  });

  writeFileSync(process.argv[2] ?? 'preview-pine-growth.png', canvas.toBuffer('image/png'));
  console.log('лист роста сохранён');
}

main();
