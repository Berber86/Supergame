/**
 * Снимок сада в виде свитка.
 *
 * Обычный скриншот — это просто окно браузера. Свиток же превращает кадр
 * в вещь: поля рисовой бумаги, тонкая рамка, подпись сезона и года.
 * Такой снимок хочется сохранить, а не просто закрыть.
 */

import { SeasonId } from '../core/clock';

export type ShotRatio = 'wide' | 'square' | 'tall';

export interface ShotInfo {
  season: SeasonId;
  /** Номер года в саду. */
  year: number;
  /** Подпись времени, например «17:20». */
  time: string;
  /** Название усадьбы. */
  garden: string;
}

const SEASON_KANJI: Record<SeasonId, string> = {
  spring: '春',
  summer: '夏',
  autumn: '秋',
  winter: '冬',
};

const SEASON_NAME: Record<SeasonId, string> = {
  spring: 'весна',
  summer: 'лето',
  autumn: 'осень',
  winter: 'зима',
};

const RATIOS: Record<ShotRatio, number> = {
  wide: 16 / 9,
  square: 1,
  tall: 3 / 4,
};

/**
 * Собирает свиток: вырезает из кадра нужное соотношение сторон
 * и обрамляет его полями с подписью.
 */
export function composeScroll(source: HTMLCanvasElement, ratio: ShotRatio, info: ShotInfo): HTMLCanvasElement {
  // 1) Кадрируем по центру под нужное соотношение
  const target = RATIOS[ratio];
  const sw = source.width;
  const sh = source.height;
  let cw = sw;
  let ch = Math.round(sw / target);
  if (ch > sh) {
    ch = sh;
    cw = Math.round(sh * target);
  }
  const cx = Math.round((sw - cw) / 2);
  // Кадрируем чуть выше центра: небо ценнее нижней кромки земли
  const cy = Math.round((sh - ch) * 0.42);

  // 2) Поля свитка. Снизу шире — там подпись, как на настоящем свитке.
  const pad = Math.round(Math.min(cw, ch) * 0.055);
  const padBottom = Math.round(pad * 2.6);
  const W = cw + pad * 2;
  const H = ch + pad + padBottom;

  const out = document.createElement('canvas');
  out.width = W;
  out.height = H;
  const ctx = out.getContext('2d')!;

  // 3) Рисовая бумага полей
  ctx.fillStyle = '#efe6d2';
  ctx.fillRect(0, 0, W, H);
  paperGrain(ctx, W, H);

  // 4) Сам кадр
  ctx.drawImage(source, cx, cy, cw, ch, pad, pad, cw, ch);

  // 5) Тонкая рамка вокруг кадра — тушь по краю бумаги
  ctx.strokeStyle = 'rgba(92, 72, 54, 0.55)';
  ctx.lineWidth = Math.max(1, pad * 0.055);
  ctx.strokeRect(pad - 0.5, pad - 0.5, cw + 1, ch + 1);

  // 6) Подпись: иероглиф сезона, название и год
  const base = Math.round(padBottom * 0.42);
  const capY = pad + ch + Math.round(padBottom * 0.52);

  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';

  // Печать с иероглифом сезона — киноварный квадрат, как оттиск ханко.
  // Рисуем именно рамку с глифом: если системе нечем набрать иероглиф,
  // печать всё равно читается как печать, а не как пустой прямоугольник.
  const seal = Math.round(base * 0.86);
  ctx.strokeStyle = 'rgba(158, 62, 48, 0.85)';
  ctx.lineWidth = Math.max(1.5, seal * 0.07);
  roundRect(ctx, pad, capY - seal / 2, seal, seal, seal * 0.12);
  ctx.stroke();
  ctx.fillStyle = 'rgba(158, 62, 48, 0.9)';
  ctx.font = `${Math.round(seal * 0.72)}px serif`;
  ctx.textAlign = 'center';
  ctx.fillText(SEASON_KANJI[info.season], pad + seal / 2, capY + seal * 0.03);
  ctx.textAlign = 'left';

  const kanjiW = seal;

  ctx.fillStyle = 'rgba(78, 62, 48, 0.82)';
  ctx.font = `${Math.round(base * 0.52)}px serif`;
  ctx.fillText(`${SEASON_NAME[info.season]} · год ${info.year} · ${info.time}`, pad + kanjiW + base * 0.4, capY);

  // Название усадьбы справа, как подпись автора
  ctx.textAlign = 'right';
  ctx.fillStyle = 'rgba(78, 62, 48, 0.6)';
  ctx.font = `${Math.round(base * 0.48)}px serif`;
  ctx.fillText(info.garden, W - pad, capY);

  return out;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Лёгкая крупа на полях, чтобы бумага не выглядела пластиком. */
function paperGrain(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  ctx.save();
  ctx.globalAlpha = 0.05;
  for (let i = 0; i < 900; i++) {
    // Детерминированный разброс: снимок одного кадра всегда одинаков
    const s = Math.sin(i * 12.9898) * 43758.5453;
    const r1 = s - Math.floor(s);
    const s2 = Math.sin(i * 78.233) * 12345.6789;
    const r2 = s2 - Math.floor(s2);
    ctx.fillStyle = r1 > 0.5 ? '#8a7a5e' : '#fffaf0';
    ctx.fillRect(r1 * w, r2 * h, 1.4, 1.4);
  }
  ctx.restore();
}
