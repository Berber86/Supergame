/**
 * Лист декора одной картинкой: раскладывает отдельные PNG из decor-sheet
 * в сетку с подписями, чтобы было видно весь перерисованный набор сразу.
 *
 *   npx tsx tools/decor-contact-sheet.mts [outdir] [out.png]
 */

import { createCanvas, loadImage } from '@napi-rs/canvas';
import { readdirSync, writeFileSync } from 'node:fs';

const ROW = [
  ['moss_log', 'Замшелое бревно'],
  ['stump', 'Пень'],
  ['mushrooms', 'Опята'],
  ['fence_wood', 'Заборчик'],
  ['fence_stone', 'Каменная ограда'],
  ['jizo', 'Дзидзо'],
  ['well', 'Колодец'],
  ['garden_bench', 'Скамья'],
  ['woodpile', 'Поленница'],
  ['nestbox', 'Скворечник'],
  ['hammock', 'Гамак'],
  ['matatabi', 'Мататаби'],
] as const;

async function main() {
  const dir = process.argv[2] ?? 'shots/decor';
  const out = process.argv[3] ?? 'decor-sheet.png';
  const COLS = 4;
  const CELL = 220;
  const PAD = 8;
  const LABEL = 22;
  const rows = Math.ceil(ROW.length / COLS);
  const W = PAD + COLS * (CELL + PAD);
  const H = PAD + rows * (CELL + PAD + LABEL);

  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#f4f0e6';
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#4a4438';
  ctx.font = '13px sans-serif';
  ctx.textAlign = 'center';

  for (let i = 0; i < ROW.length; i++) {
    const [id, label] = ROW[i];
    const col = i % COLS;
    const row = Math.floor(i / COLS);
    const x = PAD + col * (CELL + PAD);
    const y = PAD + row * (CELL + PAD + LABEL);
    const file = readdirSync(dir).find((f) => f.startsWith(`${id}-r0`) && f.endsWith('.png') && !f.includes('winter'));
    if (!file) continue;
    const img = await loadImage(`${dir}/${file}`);
    const k = Math.min(CELL / img.width, CELL / img.height);
    const iw = img.width * k;
    const ih = img.height * k;
    ctx.drawImage(img as never, x + (CELL - iw) / 2, y + (CELL - ih) / 2, iw, ih);
    ctx.strokeStyle = 'rgba(120,110,92,0.18)';
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, y + 0.5, CELL, CELL);
    ctx.fillText(label, x + CELL / 2, y + CELL + 16);
  }
  writeFileSync(out, canvas.toBuffer('image/png'));
  console.log(`${out}  ${W}×${H}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
