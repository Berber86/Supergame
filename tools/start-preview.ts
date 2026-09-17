/**
 * Оффлайн-превью стартовой страницы: свиток на стене рисуется в PNG.
 *
 * Кисть заставки (`src/ui/startArt.ts`) не знает про браузер — ей нужен
 * только холст, поэтому её видно до запуска игры. Это единственный способ
 * посмотреть на свет в разное время суток, не двигая часы в браузере.
 *
 *   npx tsx tools/start-preview.ts [часы] [префикс]
 *   npx tsx tools/start-preview.ts 6,12,18,22 start
 *
 * Переменные окружения:
 *   W, H — размер кадра (по умолчанию 1500×860);
 *   INK  — сколько туши уже легло, 0..1 (1 — свиток написан целиком);
 *   MOTES=1 — добавить пылинки в луче.
 */

import { createCanvas, GlobalFonts } from '@napi-rs/canvas';
import { existsSync, writeFileSync } from 'node:fs';

// --- Полифиллы браузерных API для модулей рисования ---
const g = globalThis as Record<string, unknown>;
g.document = {
  createElement(tag: string) {
    if (tag === 'canvas') return createCanvas(8, 8);
    return {};
  },
};
g.window = { devicePixelRatio: 1, innerWidth: 1600, innerHeight: 900 };

// Каллиграфия: тот же шрифт, что и в браузере. Лежит в node_modules
// (пакет для оффлайн-проверок), в игру не попадает.
const FONTS = [
  'node_modules/@expo-google-fonts/noto-serif-jp/300Light/NotoSerifJP_300Light.ttf',
  'node_modules/@expo-google-fonts/noto-serif-jp/600SemiBold/NotoSerifJP_600SemiBold.ttf',
];

async function main() {
  let haveFont = false;
  for (const f of FONTS) {
    if (existsSync(f)) haveFont = GlobalFonts.registerFromPath(f, 'Noto Serif JP') !== null;
  }
  if (!haveFont) {
    console.log(
      'шрифт каллиграфии не найден — знаки нарисуются запасным.\n' +
        'точный вид: npm i --no-save @expo-google-fonts/noto-serif-jp',
    );
  }

  const { StartArt, SCROLL_TEXT } = await import('../src/ui/startArt');

  /**
   * Надписи на месте DOM-слоя. Браузер набирает их сам, но композицию
   * (ничего не наезжает друг на друга, лист не пустует снизу) надо видеть
   * до запуска. Шрифт здесь другой — это проверка места, а не вида.
   */
  const drawText = (ctx: { [k: string]: unknown }, w: number, h: number): void => {
    const layout = StartArt.prototype ? null : null;
    void layout;
    const g2 = ctx as unknown as CanvasRenderingContext2D;
    const sx = Math.round((w - Math.min(w * 0.86, 470, (h * 0.92) / 1.36)) / 2);
    const sw = Math.min(w * 0.86, 470, (h * 0.92) / 1.36);
    const sh = sw * 1.36;
    const sy = Math.round((h - sh) / 2);

    const spaced = (text: string): string => [...text].join('\u2009');
    g2.textAlign = 'center';
    g2.textBaseline = 'middle';
    g2.fillStyle = 'rgba(45,40,34,0.82)';
    g2.font = `italic 400 ${Math.min(19, Math.max(11, sw * 0.055)).toFixed(1)}px "DejaVu Serif", serif`;
    g2.fillText(spaced('Усадьба Безмятежности'), w / 2, sy + sh * SCROLL_TEXT.title);
    g2.fillStyle = '#2b2621';
    g2.font = `400 ${Math.min(21, Math.max(13, sw * 0.06)).toFixed(1)}px "DejaVu Serif", serif`;
    g2.fillText(spaced('войти в сад'), w / 2, sy + sh * SCROLL_TEXT.enter + 6);
  };

  const W = Number(process.env.W ?? 1500);
  const H = Number(process.env.H ?? 860);
  const ink = Number(process.env.INK ?? 1);
  const motes = process.env.MOTES === '1';

  const hours = (process.argv[2] ?? '14')
    .split(',')
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isFinite(n));
  const prefix = process.argv[3] ?? 'preview-start';

  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');

  // CROP=x,y,w,h и SCALE=2 — посмотреть на мазок вблизи, а не на весь экран.
  const crop = (process.env.CROP ?? '').split(',').map((s) => Number(s.trim()));
  const scale = Number(process.env.SCALE ?? 1);

  const shot = (source: ReturnType<typeof createCanvas>): Buffer => {
    if (crop.length !== 4 || crop.some((n) => !Number.isFinite(n)) || scale === 1) {
      if (crop.length === 4 && scale !== 1) {
        const [x, y, cw, ch] = crop;
        const out = createCanvas(Math.round(cw * scale), Math.round(ch * scale));
        const og = out.getContext('2d');
        og.imageSmoothingQuality = 'high';
        og.drawImage(source, x, y, cw, ch, 0, 0, out.width, out.height);
        return out.toBuffer('image/png');
      }
      return source.toBuffer('image/png');
    }
    const [x, y, cw, ch] = crop;
    const out = createCanvas(Math.round(cw * scale), Math.round(ch * scale));
    const og = out.getContext('2d');
    og.imageSmoothingQuality = 'high';
    og.drawImage(source, x, y, cw, ch, 0, 0, out.width, out.height);
    return out.toBuffer('image/png');
  };

  for (const hour of hours) {
    const art = new StartArt();
    art.resize(W, H, 1);
    art.render(ctx as unknown as CanvasRenderingContext2D, {
      time: 0,
      ink,
      hour,
      motes,
      motion: motes,
    });
    if (process.env.TEXT === '1') drawText(ctx, W, H);
    const out = `${prefix}-${hour}h.png`;
    writeFileSync(out, shot(canvas));
    console.log(`${out}  час=${hour}  тушь=${ink}  ${W}×${H}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
