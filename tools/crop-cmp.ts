/** Склейка двух PNG рядом (одна и та же область) для сравнения рендеров.
 *  npx tsx tools/crop-cmp.ts a.png b.png x y w h out.png
 */
import { createCanvas, loadImage } from '@napi-rs/canvas';
import { writeFileSync } from 'node:fs';

async function main() {
  const [a, b] = await Promise.all([loadImage(process.argv[2]), loadImage(process.argv[3])]);
  const [x, y, w, h] = process.argv.slice(4, 8).map(Number);
  const c = createCanvas(w * 2 + 10, h);
  const ctx = c.getContext('2d');
  ctx.drawImage(a, x, y, w, h, 0, 0, w, h);
  ctx.drawImage(b, x, y, w, h, w + 10, 0, w, h);
  writeFileSync(process.argv[8], c.toBuffer('image/png'));
  console.log(process.argv[8]);
}
main();
