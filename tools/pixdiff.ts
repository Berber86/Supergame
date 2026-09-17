/**
 * Сравнение двух кадров: средняя разница канала и доля пикселей,
 * где расхождение заметно на глаз.
 *
 *   npx tsx tools/pixdiff.ts a.png b.png [порог]
 *
 * Оффлайн-рендер сада недетерминирован: кот и птицы бродят по
 * Math.random, поэтому побайтовое сравнение ничего не доказывает.
 * Доказательство «картина не изменилась» — это малая средняя разница
 * против разницы двух прогонов одного и того же кода (шум живности).
 * Код выхода nonzero, если средняя разница выше порога (по умолчанию 2).
 */

import { createCanvas, loadImage } from '@napi-rs/canvas';

async function main(): Promise<void> {
  const [aPath, bPath, thrArg] = process.argv.slice(2, 5);
  if (!aPath || !bPath) {
    console.error('нужны два файла: npx tsx tools/pixdiff.ts a.png b.png [порог]');
    process.exit(2);
  }
  const threshold = Number(thrArg ?? 2);
  const [ia, ib] = [await loadImage(aPath), await loadImage(bPath)];
  if (ia.width !== ib.width || ia.height !== ib.height) {
    console.error(`разные размеры: ${ia.width}x${ia.height} и ${ib.width}x${ib.height}`);
    process.exit(2);
  }
  const ca = createCanvas(ia.width, ia.height);
  const cb = createCanvas(ib.width, ib.height);
  const ga = ca.getContext('2d');
  const gb = cb.getContext('2d');
  ga.drawImage(ia, 0, 0);
  gb.drawImage(ib, 0, 0);
  const da = ga.getImageData(0, 0, ia.width, ia.height).data;
  const db = gb.getImageData(0, 0, ib.width, ib.height).data;
  let sum = 0;
  let over = 0;
  const n = da.length / 4;
  for (let i = 0; i < da.length; i += 4) {
    const d = (Math.abs(da[i] - db[i]) + Math.abs(da[i + 1] - db[i + 1]) + Math.abs(da[i + 2] - db[i + 2])) / 3;
    sum += d;
    if (d > 8) over += 1;
  }
  const mean = sum / n;
  console.log(
    `${aPath} ↔ ${bPath}: средняя разница ${mean.toFixed(3)}/255 · пикселей >8: ${((100 * over) / n).toFixed(2)}%`,
  );
  process.exit(mean > threshold ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
