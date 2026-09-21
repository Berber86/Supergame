/**
 * Лист роста всех деревьев: формы и семенные облики × ступени саженца.
 * Инструмент разработки — увидеть стадии роста без запуска игры.
 *   npx tsx tools/tmp-tree-sheet.ts [out.png]
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
  const { treeProfile } = await import('../src/world/treeHabits');

  const rows: { type: string; label: string; seed: number }[] = [
    { type: 'sakura', label: 'Сакура · раскидистая', seed: 0 },
    { type: 'maple', label: 'Клён · колонновидный', seed: 0 },
    { type: 'ginkgo', label: 'Гинкго · раскидистое', seed: 0 },
    { type: 'willow', label: 'Ива', seed: 0 },
    { type: 'persimmon', label: 'Хурма', seed: 0 },
    { type: 'ume', label: 'Умэ', seed: 7 },
    { type: 'nashi', label: 'Груша-наси', seed: 7 },
    { type: 'peach', label: 'Персик', seed: 7 },
    { type: 'yuzu', label: 'Юдзу', seed: 7 },
    { type: 'bamboo', label: 'Бамбук', seed: 3 },
    { type: 'wisteria', label: 'Глициния', seed: 5 },
  ];
  const wantedForm: Record<string, string> = { sakura: 'spreading', maple: 'upright', ginkgo: 'spreading' };
  for (const row of rows) {
    const form = wantedForm[row.type];
    if (!form) continue;
    row.seed = 0;
    while (treeProfile(row.type, row.seed)?.form !== form) row.seed++;
  }

  const stages = [0.04, 0.15, 0.3, 0.5, 0.7, 0.88, 1];
  const cw = 230;
  const ch = 250;
  const left = 190;
  const scale = 0.72;
  const W = left + cw * stages.length + 20;
  const H = 70 + ch * rows.length + 20;
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d') as unknown as CanvasRenderingContext2D;
  ctx.fillStyle = '#ece7d6';
  ctx.fillRect(0, 0, W, H);
  const atm = buildAtmosphere(computeTime(new Date(2026, 5, 15, 13).getTime()), 0);

  stages.forEach((stage, i) => {
    ctx.fillStyle = '#6b4a33';
    ctx.font = '16px serif';
    ctx.fillText(`g = ${stage.toFixed(2)}`, left + i * cw + cw * 0.32, 34);
  });

  rows.forEach((row, r) => {
    const y0 = 70 + r * ch;
    ctx.fillStyle = '#6b4a33';
    ctx.font = '16px serif';
    ctx.fillText(row.label, 12, y0 + ch * 0.5);
    stages.forEach((stage, i) => {
      const x = left + i * cw + cw * 0.5;
      const y = y0 + ch * 0.9;
      ctx.fillStyle = 'rgba(150,170,130,0.25)';
      ctx.beginPath();
      ctx.ellipse(x, y, 55 * scale, 13 * scale, 0, 0, Math.PI * 2);
      ctx.fill();
      setSkipShadows(true);
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(scale, scale);
      try {
        drawObject({
          ctx: ctx as never,
          x: 0,
          y: 0,
          atm,
          g: stage,
          obj: { id: 1, type: row.type, seed: row.seed, rot: 0, tx: 0, ty: 0, planted: 0 },
          time: 0,
          wind: 0,
          alpha: 1,
        });
      } finally {
        ctx.restore();
        setSkipShadows(false);
      }
    });
  });

  writeFileSync(process.argv[2] ?? 'preview-tree-growth.png', canvas.toBuffer('image/png'));
  console.log('лист роста сохранён');
}

main();
