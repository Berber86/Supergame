import assert from 'node:assert/strict';
import { createCanvas, loadImage } from '@napi-rs/canvas';
import { writeFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { drawObject, setSkipShadows } from '../src/render/sprites';
import { drawCached, clearSprites, spriteStats } from '../src/render/spriteCache';
import { computeTime } from '../src/core/clock';
import { buildAtmosphere } from '../src/world/palette';
Object.assign(globalThis, { document: { createElement: () => createCanvas(8, 8) } });
const cv = createCanvas(1120, 470),
  ctx = cv.getContext('2d');
const atm = buildAtmosphere(computeTime(new Date(2026, 8, 20, 8, 13).getTime()));
ctx.fillStyle = '#e2e5cf';
ctx.fillRect(0, 0, 1120, 470);
for (const [i, seed] of [17, 441, 2891, 9406].entries()) {
  ctx.save();
  ctx.translate(140 + i * 280, 418);
  ctx.scale(1.7, 1.7);
  drawObject({
    ctx: ctx as never,
    x: 0,
    y: 0,
    atm,
    g: 1,
    obj: { id: i, type: 'pine', seed, rot: 0, tx: 0, ty: 0, planted: 0 },
    time: 0,
    wind: 0,
    alpha: 1,
  });
  ctx.restore();
}
if (process.argv.includes('--before')) {
  writeFileSync('preview-pine-before.png', cv.toBuffer('image/png'));
  process.exit(0);
}
const probe = createCanvas(450, 390),
  pc = probe.getContext('2d');
function render(seed: number, g: number, month: number, cached: boolean) {
  probe.width = 450;
  const d = {
    ctx: pc as never,
    x: 220,
    y: 320,
    atm: buildAtmosphere(computeTime(new Date(2026, month, 15, 12).getTime())),
    g,
    obj: { id: 1, type: 'pine', seed, rot: 0, tx: 0, ty: 0, planted: 0 },
    time: 0,
    wind: 0,
    alpha: 1,
  };
  setSkipShadows(true);
  try {
    if (cached) assert.ok(drawCached(d));
    else drawObject(d);
  } finally {
    setSkipShadows(false);
  }
  return pc.getImageData(0, 0, 450, 390).data;
}
const digest = (p: Uint8ClampedArray) => createHash('sha256').update(p).digest('hex');
const variants = new Set<string>();
for (const seed of [17, 441, 2891, 9406])
  for (const g of [0.2, 1])
    for (const month of [0, 3, 8]) {
      const raw = render(seed, g, month, false),
        cached = render(seed, g, month, true);
      let total = 0,
        lost = 0;
      for (let i = 3; i < raw.length; i += 4)
        if (raw[i] > 30) {
          total++;
          if (cached[i] < 2) lost++;
        }
      assert.ok(total > 100 && lost / total < 0.009, 'needle fringe and branch tips fit the cached sprite');
      const warm = digest(cached);
      clearSprites();
      assert.equal(digest(render(seed, g, month, true)), warm);
      variants.add(warm);
    }
assert.ok(variants.size >= 16);
assert.ok(spriteStats().size <= 420 && spriteStats().boxes <= 600);
console.log('ок: pine variants, seed/growth/seasons, uncached/cached bounds and cold/warm cache parity');
if (process.argv.includes('--preview')) {
  writeFileSync('preview-pine.png', cv.toBuffer('image/png'));
  if (existsSync('preview-pine-before.png')) {
    const out = createCanvas(1120, 1030),
      c = out.getContext('2d');
    c.fillStyle = '#eee9dc';
    c.fillRect(0, 0, 1120, 1030);
    c.fillStyle = '#414d3d';
    c.font = '25px sans-serif';
    c.fillText('Было: округлые облака листвы', 24, 35);
    c.drawImage(await loadImage('preview-pine-before.png'), 0, 50);
    c.fillStyle = '#414d3d';
    c.fillText('Теперь: открытые ветви, ярусы хвои и игольчатый край', 24, 552);
    c.drawImage(cv, 0, 565);
    writeFileSync('preview-pine-comparison.png', out.toBuffer('image/png'));
  }
}
