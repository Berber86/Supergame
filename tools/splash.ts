/**
 * Оффлайн-заставка: рендерит лист через @napi-rs/canvas в PNG.
 * Нужно для разработки — посмотреть композицию без браузера.
 *
 *   npx tsx tools/splash.ts [часы] [сезон] [файл]
 *
 * Переменные окружения:
 *   W, H        размер листа (по умолчанию 1500×860)
 *   OVERCAST    затянутость неба 0..1
 *   NOPARTICLES убрать лепестки и снег
 *   NOMOTION    статичный кадр (как с выключенной анимацией)
 *   PROGRESS    0..1 — насколько прорисован мазок энсо
 *   TEXT        1 — наложить названия поверх, чтобы сверить посадку текста
 */

import { createCanvas } from '@napi-rs/canvas';
import { writeFileSync } from 'node:fs';

// --- Полифиллы браузерных API для модулей рендера ---
const g = globalThis as Record<string, unknown>;
g.document = {
  createElement(tag: string) {
    if (tag === 'canvas') return createCanvas(8, 8);
    return {};
  },
};
g.window = { devicePixelRatio: 1, innerWidth: 1600, innerHeight: 900 };
g.performance = g.performance ?? { now: () => Date.now() };

async function main() {
  const { SplashArt } = await import('../src/ui/splashArt');
  const { computeTime, SEASON_MS, DAY_MS, SEASON_NAMES, SEASON_POEM, partOfDay } = await import('../src/core/clock');
  const { buildAtmosphere } = await import('../src/world/palette');

  const W = Number(process.env.W ?? 1500);
  const H = Number(process.env.H ?? 860);
  const hour = Number(process.argv[2] ?? 6.2);
  const seasonArg = process.argv[3] ?? 'spring';
  const out = process.argv[4] ?? `splash-${seasonArg}-${hour}.png`;

  const seasons = ['spring', 'summer', 'autumn', 'winter'];
  const si = Math.max(0, seasons.indexOf(seasonArg));
  const EPOCH = Date.UTC(2024, 2, 20, 0, 0, 0);
  const base = EPOCH + si * SEASON_MS + DAY_MS * 1.5;
  const d = new Date(base);
  d.setHours(Math.floor(hour), Math.round((hour % 1) * 60), 0, 0);

  const t = computeTime(d.getTime());
  const overcast = Number(process.env.OVERCAST ?? 0);
  const atm = buildAtmosphere(t, overcast);

  const art = new SplashArt({
    motion: !process.env.NOMOTION,
    particles: !process.env.NOPARTICLES,
  });

  const canvas = createCanvas(W, H) as unknown as HTMLCanvasElement;
  const ctx = canvas.getContext('2d') as unknown as CanvasRenderingContext2D;
  const progress = Number(process.env.PROGRESS ?? 1);

  // Лепестки должны успеть лечь в кадр, а не висеть на самом верху
  const warm = process.env.NOMOTION ? 1 : 220;
  for (let i = 0; i < warm; i++) art.render(ctx, W, H, t, atm, progress, 16);

  if (process.env.TEXT) {
    const night = 1 - Math.min(1, t.daylight * 1.35);
    ctx.textAlign = 'center';
    ctx.fillStyle = night > 0.5 ? 'rgba(242,236,217,0.95)' : 'rgba(59,48,40,0.95)';
    ctx.font = `300 ${Math.round(Math.min(W, H) * 0.072)}px serif`;
    ctx.fillText('静かな庭', W * 0.5, H * 0.385);
    ctx.font = `italic 400 ${Math.round(Math.min(W, H) * 0.026)}px serif`;
    ctx.fillStyle = night > 0.5 ? 'rgba(242,236,217,0.7)' : 'rgba(109,93,76,0.9)';
    ctx.fillText('Усадьба Безмятежности', W * 0.5, H * 0.385 + Math.min(W, H) * 0.062);
    ctx.font = `400 ${Math.round(Math.min(W, H) * 0.019)}px serif`;
    ctx.fillText(
      `${SEASON_NAMES[t.season].toLowerCase()} · ${partOfDay(t)} · ${SEASON_POEM[t.season]}`,
      W * 0.5,
      H * 0.385 + Math.min(W, H) * 0.11,
    );
    ctx.strokeStyle = night > 0.5 ? 'rgba(242,236,217,0.45)' : 'rgba(59,48,40,0.45)';
    ctx.lineWidth = 1.5;
    const bw = Math.min(W, H) * 0.24;
    const bh = Math.min(W, H) * 0.055;
    ctx.strokeRect(W * 0.5 - bw / 2, H - Math.max(H * 0.09, 42) - bh / 2, bw, bh);
    ctx.fillText('войти в сад', W * 0.5, H - Math.max(H * 0.09, 42) + bh * 0.16);
  }

  const buf = (canvas as unknown as { toBuffer(mime: string): Buffer }).toBuffer('image/png');
  writeFileSync(out, buf);
  console.log(
    `${out}  ${t.label} ${t.season}  daylight=${t.daylight.toFixed(2)} golden=${t.golden.toFixed(2)} тучи=${overcast}`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
