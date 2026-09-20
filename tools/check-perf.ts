/**
 * Бюджет кадра: сколько миллисекунд уходит на отрисовку сада.
 *
 * Скорость утекает незаметно — один лишний мазок в кроне, и через две
 * сессии игра тормозит. Поэтому проверка не просто печатает числа,
 * а падает, когда кадр перестаёт укладываться в бюджет.
 *
 *   npx tsx tools/check-perf.ts
 */

import { createCanvas } from '@napi-rs/canvas';
import { makeRng } from '../src/core/rng';
Math.random = makeRng(841);

const g = globalThis as Record<string, unknown>;
g.document = { createElement: (t: string) => (t === 'canvas' ? createCanvas(16, 16) : {}) };
g.window = { devicePixelRatio: 1, innerWidth: 1500, innerHeight: 860, matchMedia: () => ({ matches: false }) };
g.performance = g.performance ?? { now: () => Date.now() };
g.localStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };

/** Бюджеты в миллисекундах. Замерено на @napi-rs/canvas, не на браузере:
 *  это точка отсчёта для сравнения «до и после», а не абсолют. */
const BUDGET = {
  objectsStarter: 12,
  objectsBig: 26,
};

async function main() {
  const { World } = await import('../src/world/world');
  const { buildAtmosphere } = await import('../src/world/palette');
  const { computeTime } = await import('../src/core/clock');
  const { drawObject, drawCost } = await import('../src/render/sprites');
  const { cacheable, drawCached, spriteFrame, spriteStats, clearSprites } = await import('../src/render/spriteCache');

  const d = new Date(2026, 6, 15);
  d.setHours(13, 0, 0, 0);
  const atm = buildAtmosphere(computeTime(d.getTime()), 0);
  const cv = createCanvas(1500, 860);
  const ctx = cv.getContext('2d');

  const frame = (w: InstanceType<typeof World>, useCache: boolean, t: number) => {
    spriteFrame();
    for (const o of w.objects) {
      if (o.type === 'cat' || o.type === 'koi') continue;
      const cost = drawCost(o.type);
      const dc = {
        ctx: ctx as never,
        x: 700,
        y: 400,
        atm,
        g: 1,
        obj: o,
        time: t,
        wind: 0.4,
        alpha: 1,
      };
      if (useCache && cacheable(o.type, cost)) {
        if (drawCached(dc as never)) continue;
      }
      drawObject(dc as never);
    }
  };

  const bench = (w: InstanceType<typeof World>, useCache: boolean) => {
    clearSprites();
    for (let i = 0; i < 3; i++) frame(w, useCache, 1000 + i * 16);
    const N = 25;
    const t0 = performance.now();
    for (let i = 0; i < N; i++) frame(w, useCache, 2000 + i * 16);
    return (performance.now() - t0) / N;
  };

  let bad = 0;
  const report = (name: string, ms: number, budget: number) => {
    const ok = ms <= budget;
    if (!ok) bad++;
    console.log(`${ok ? '✔' : '✘'} ${name}: ${ms.toFixed(1)} мс (бюджет ${budget}) → ${(1000 / ms).toFixed(0)} к/с`);
  };

  const starter = new World();
  const off = bench(starter, false);
  const on = bench(starter, true);
  console.log(`стартовый сад (${starter.objects.length} объектов):`);
  console.log(`    без кэша ${off.toFixed(1)} мс → с кэшем ${on.toFixed(1)} мс  (×${(off / on).toFixed(1)})`);
  report('  стартовый сад', on, BUDGET.objectsStarter);

  const big = new World();
  for (let i = 0; i < 350; i++) {
    const x = 1 + (i % 23);
    const y = 1 + ((i / 23) | 0);
    big.place(i % 3 === 0 ? 'maple' : i % 3 === 1 ? 'azalea' : 'moss_clump', x + 0.5, y + 0.5, 0);
  }
  const bigOff = bench(big, false);
  const bigOn = bench(big, true);
  console.log(`большой сад (${big.objects.length} объектов):`);
  console.log(
    `    без кэша ${bigOff.toFixed(1)} мс → с кэшем ${bigOn.toFixed(1)} мс  (×${(bigOff / bigOn).toFixed(1)})`,
  );
  report('  большой сад', bigOn, BUDGET.objectsBig);

  const st = spriteStats();
  console.log(`кэш: ${st.size} спрайтов, попаданий ${st.hits}, промахов ${st.misses}`);

  console.log(bad ? `\nБЮДЖЕТ ПРЕВЫШЕН (${bad})` : '\nКадр укладывается в бюджет.');
  if (bad) process.exit(1);
}

main();
