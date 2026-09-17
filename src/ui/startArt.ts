/**
 * Заставка: свиток на стене тёмной комнаты.
 *
 * Всё, что игрок видит на входе, рисуется той же кистью, что и сад: лист
 * рисовой бумаги с неровным краем, круг энсо, каллиграфия, красная печать
 * и свет, который дышит вместе с реальным часом. Модуль намеренно чистый —
 * ни DOM, ни состояния игры, только холст и числа; поэтому его можно
 * отрисовать оффлайн (`tools/start-preview.ts`) и увидеть до браузера.
 */

import { clamp01, hash2, makeRng, noise2, smoothstep } from '../core/rng';
import { Ctx, blobPath, getPaperTile, makeCanvas, withAlpha } from '../render/paint';
import { RGB, css, mix, shade } from '../world/palette';

/** Чернила — не чёрные: в них есть синева, как в туши на рисовой бумаге. */
const INK: RGB = { r: 26, g: 29, b: 34 };
const PAPER: RGB = { r: 233, g: 223, b: 199 };
const PAPER_DEEP: RGB = { r: 197, g: 183, b: 152 };
const SILK: RGB = { r: 173, g: 80, b: 60 };
const WOOD: RGB = { r: 58, g: 40, b: 29 };

/** Свет: ночью холодный, днём тёплый, на рассвете и закате — золото. */
const LIGHT_NIGHT: RGB = { r: 158, g: 180, b: 208 };
const LIGHT_DAY: RGB = { r: 255, g: 241, b: 216 };
const LIGHT_GOLD: RGB = { r: 255, g: 176, b: 102 };

/** Соотношение сторон листа: высота к ширине. */
export const SCROLL_ASPECT = 1.36;

/** Доли высоты листа: где название и где вход. Одни числа для кисти и для CSS. */
export const SCROLL_TEXT = { title: 0.725, enter: 0.83, mark: 0.955 } as const;

/** Каллиграфия: японское имя игры. */
export const SCROLL_KANJI = '静かな庭';
/** Знак на печати. */
export const SEAL_KANJI = '静';

const FONT_STACK = '"Noto Serif JP", "Hiragino Mincho ProN", "Yu Mincho", "Source Han Serif", serif';

export interface StartLayout {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Сколько шагов у мазка: по ним считаются толщина и зерно. */
const STROKE_STEPS = 132;
/** Разрыв энсо: мазок начинается внизу справа и приходит к правому краю. */
const GAP_START = (70 * Math.PI) / 180;
const SWEEP = ((360 + 12) * Math.PI) / 180;

export function startLayout(vw: number, vh: number): StartLayout {
  const w = Math.min(vw * 0.86, 470, (vh * 0.92) / SCROLL_ASPECT);
  const h = w * SCROLL_ASPECT;
  return { x: Math.round((vw - w) / 2), y: Math.round((vh - h) / 2), w, h };
}

export interface HourLight {
  tint: RGB;
  /** Сила света: ночью почти ничего, в золотой час заметно. */
  strength: number;
}

/** Оттенок света по реальному часу игрока. */
export function lightForHour(hour: number): HourLight {
  const h = ((hour % 24) + 24) % 24;
  const day = clamp01(Math.sin(((h - 5.4) / 13.2) * Math.PI));
  const gold = clamp01(Math.exp(-((h - 6.4) ** 2) / 1.1) + Math.exp(-((h - 19.2) ** 2) / 1.7));
  return {
    tint: mix(mix(LIGHT_NIGHT, LIGHT_DAY, day), LIGHT_GOLD, gold * 0.75),
    strength: 0.04 + day * 0.05 + gold * 0.04,
  };
}

export interface StartFrame {
  /** Время в мс — по нему дышат свет и пылинки. */
  time: number;
  /** Время заставки: 0 — тёмная комната, 1 — свиток написан целиком. */
  ink: number;
  /** Реальный час игрока. */
  hour: number;
  /** Пылинки в луче света. */
  motes: boolean;
  /** Плавные движения: если выключены — свет стоит, пылинок нет. */
  motion: boolean;
}

/** Пылинка, плывущая в луче. */
interface Mote {
  x: number;
  y: number;
  r: number;
  sp: number;
  ph: number;
  a: number;
}

/**
 * Кисть заставки. Холсты-слои собираются один раз на размер окна,
 * а на кадре только складываются и добавляются свет и пыль.
 */
export class StartArt {
  private vw = 0;
  private vh = 0;
  private dpr = 1;
  private lay: StartLayout = { x: 0, y: 0, w: 0, h: 0 };

  private room: HTMLCanvasElement | null = null;
  private paper: HTMLCanvasElement | null = null;
  private frame: HTMLCanvasElement | null = null;
  private kanji: HTMLCanvasElement | null = null;
  private seal: HTMLCanvasElement | null = null;
  private ink: HTMLCanvasElement | null = null;

  /** Мазок во всю длину: по кадру он только приоткрывается. */
  private inkFull: HTMLCanvasElement | null = null;
  private inkFullFor = '';
  /** Сколько шагов мазка уже видно на листе. */
  private drawn = 0;
  private motes: Mote[] = [];

  get layout(): StartLayout {
    return this.lay;
  }

  /** Геометрия энсо в координатах листа — общая для кисти, каллиграфии и печати. */
  static circle(lay: StartLayout): { cx: number; cy: number; r: number; stroke: number } {
    const r = Math.min(lay.w * 0.33, lay.h * 0.27);
    return { cx: lay.w * 0.5, cy: lay.h * 0.35, r, stroke: Math.max(6, r * 0.27) };
  }

  /**
   * Где стоит печать: в разрыве круга, сразу за хвостом мазка.
   * Там её и ставит рука — на конце написанного.
   */
  static sealAt(c: { cx: number; cy: number; r: number }): { x: number; y: number } {
    const a = GAP_START + SWEEP - 0.12;
    return { x: c.cx + Math.cos(a) * c.r * 1.14, y: c.cy + Math.sin(a) * c.r * 1.1 };
  }

  resize(vw: number, vh: number, dpr: number): void {
    const w = Math.max(1, Math.round(vw));
    const h = Math.max(1, Math.round(vh));
    if (w === this.vw && h === this.vh && dpr === this.dpr && this.room) return;
    this.vw = w;
    this.vh = h;
    this.dpr = dpr;
    this.lay = startLayout(w, h);
    this.buildRoom();
    this.buildPaper();
    this.buildFrame();
    this.buildKanji();
    this.buildSeal();
    this.buildMotes();
    // Мазок придётся положить заново — уже на новом листе.
    this.ink = makeCanvas(this.lay.w * dpr, this.lay.h * dpr);
    this.ink.getContext('2d')!.scale(dpr, dpr);
    this.inkFull = null;
    this.inkFullFor = '';
    this.drawn = 0;
  }

  /** Каллиграфия зависит от шрифта: когда он доехал, знаки надо переписать. */
  reloadFonts(): void {
    this.buildKanji();
    this.buildSeal();
  }

  render(ctx: Ctx, s: StartFrame): void {
    const { vw, vh, dpr, lay } = this;
    if (!this.room || !this.paper || !this.ink) return;

    const paperA = smoothstep(0, 0.12, s.ink);
    const stroke = smoothstep(0.1, 0.94, s.ink);
    const textA = smoothstep(0.72, 1, s.ink);
    const sealA = smoothstep(0.86, 1, s.ink);

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, vw, vh);
    ctx.globalAlpha = 1;
    ctx.drawImage(this.room, 0, 0, vw, vh);

    // Лист появляется первым, и уже на нём сохнет тушь.
    ctx.globalAlpha = paperA;
    ctx.drawImage(this.paper, lay.x, lay.y, lay.w, lay.h);

    this.paintStroke(stroke);
    ctx.globalAlpha = paperA;
    ctx.drawImage(this.ink, lay.x, lay.y, lay.w, lay.h);

    if (this.kanji) {
      ctx.globalAlpha = textA;
      ctx.drawImage(this.kanji, lay.x, lay.y, lay.w, lay.h);
    }
    if (this.seal) {
      const c = StartArt.circle(lay);
      const s2 = c.r * 0.30;
      const pad = s2 * 0.5;
      const seal = StartArt.sealAt(c);
      ctx.globalAlpha = sealA;
      ctx.drawImage(this.seal, lay.x + seal.x - pad, lay.y + seal.y - pad, s2 + pad * 2, s2 + pad * 2);
    }
    if (this.frame) {
      ctx.globalAlpha = 1;
      ctx.drawImage(this.frame, 0, 0, vw, vh);
    }

    this.paintLight(ctx, s);
    ctx.globalAlpha = 1;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }

  // ---- Слои ----

  private buildRoom(): void {
    const { vw, vh, dpr, lay } = this;
    const c = makeCanvas(vw * dpr, vh * dpr);
    const g = c.getContext('2d')!;
    g.scale(dpr, dpr);

    const grd = g.createRadialGradient(
      vw * 0.38,
      vh * 0.26,
      Math.min(vw, vh) * 0.04,
      vw * 0.5,
      vh * 0.44,
      Math.max(vw, vh) * 0.82,
    );
    grd.addColorStop(0, '#39413f');
    grd.addColorStop(0.55, '#222b2c');
    grd.addColorStop(1, '#12181b');
    g.fillStyle = grd;
    g.fillRect(0, 0, vw, vh);

    // Свет из окна за спиной смотрящего: комната перестаёт быть плоскостью,
    // но остаётся тёмной — весь свет в кадре держит лист.
    g.save();
    g.globalCompositeOperation = 'lighter';
    g.translate(vw * 0.26, vh * 0.06);
    g.rotate(0.22);
    g.imageSmoothingEnabled = true;
    g.globalAlpha = 0.5;
    g.drawImage(softPatch(), -vw * 0.34, -vh * 0.2, vw * 0.86, vh * 1.5);
    g.restore();

    // Свиток висит на стене — под ним мягкая тень.
    g.save();
    g.shadowColor = 'rgba(0,0,0,0.5)';
    g.shadowBlur = Math.min(64, lay.w * 0.18);
    g.shadowOffsetY = Math.min(24, lay.h * 0.045);
    g.fillStyle = 'rgba(0,0,0,0.45)';
    g.fillRect(lay.x + lay.w * 0.04, lay.y + lay.h * 0.03, lay.w * 0.92, lay.h * 0.96);
    g.restore();

    this.room = c;
  }

  private buildPaper(): void {
    const { dpr, lay } = this;
    const { w, h } = lay;
    const c = makeCanvas(w * dpr, h * dpr);
    const g = c.getContext('2d')!;
    g.scale(dpr, dpr);

    const pad = Math.max(3, w * 0.024);
    const sx = pad;
    const sy = pad;
    const sw = w - pad * 2;
    const sh = h - pad * 2;

    g.save();
    decklePath(g, sx, sy, sw, sh, 71, Math.min(6, w * 0.008));
    g.clip();
    const grd = g.createLinearGradient(0, 0, 0, h);
    grd.addColorStop(0, css(mix(PAPER, { r: 255, g: 252, b: 240 }, 0.5)));
    grd.addColorStop(0.45, css(PAPER));
    grd.addColorStop(1, css(mix(PAPER, PAPER_DEEP, 0.75)));
    g.fillStyle = grd;
    g.fillRect(0, 0, w, h);

    // Волокна рисовой бумаги — тем же тайлом, что и в саду.
    const pat = g.createPattern(getPaperTile(), 'repeat');
    if (pat) {
      g.save();
      g.globalCompositeOperation = 'overlay';
      g.globalAlpha = 0.15;
      g.fillStyle = pat;
      g.fillRect(0, 0, w, h);
      g.globalCompositeOperation = 'soft-light';
      g.globalAlpha = 0.1;
      g.fillStyle = pat;
      g.fillRect(0, 0, w, h);
      g.restore();
    }

    // Лист не бывает ровным: по краям тушь подсохла и ушла в бумагу.
    g.strokeStyle = css(shade(PAPER_DEEP, 0.86), 0.3);
    g.lineWidth = Math.max(1, w * 0.004);
    decklePath(g, sx, sy, sw, sh, 71, Math.min(6, w * 0.008));
    g.stroke();
    g.strokeStyle = css(PAPER_DEEP, 0.18);
    g.lineWidth = Math.max(1, w * 0.012);
    decklePath(g, sx + 1.5, sy + 1.5, sw - 3, sh - 3, 71, Math.min(6, w * 0.008));
    g.stroke();

    this.paper = c;
  }

  /** Шнур, гвоздь и валики свитка: рисуются поверх листа. */
  private buildFrame(): void {
    const { vw, vh, dpr, lay } = this;
    const c = makeCanvas(vw * dpr, vh * dpr);
    const g = c.getContext('2d')!;
    g.scale(dpr, dpr);

    const cx = lay.x + lay.w * 0.5;
    const rodW = lay.w * 1.09;
    const rodY = lay.y + lay.h * 0.012;
    const pegY = Math.max(10, lay.y - lay.h * 0.085);
    const room = lay.y > lay.h * 0.075;

    if (room) {
      // Гвоздь, на котором держится свиток.
      g.fillStyle = css(WOOD, 0.9);
      g.beginPath();
      g.ellipse(cx, pegY, lay.w * 0.016, lay.w * 0.011, 0, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = css(shade(WOOD, 1.5), 0.5);
      g.beginPath();
      g.ellipse(cx - lay.w * 0.004, pegY - lay.w * 0.003, lay.w * 0.006, lay.w * 0.004, 0, 0, Math.PI * 2);
      g.fill();

      // Шнур: две нити от гвоздя к концам валика.
      g.strokeStyle = css(SILK, 0.55);
      g.lineWidth = Math.max(1, lay.w * 0.005);
      for (const side of [-1, 1]) {
        g.beginPath();
        g.moveTo(cx, pegY);
        g.quadraticCurveTo(
          cx + side * lay.w * 0.18,
          pegY + (rodY - pegY) * 0.45,
          cx + side * rodW * 0.42,
          rodY,
        );
        g.stroke();
      }
    }

    // Верхний валик — тёмное дерево с бликом.
    const rodH = Math.max(3, lay.w * 0.022);
    const rodGrd = g.createLinearGradient(0, rodY - rodH / 2, 0, rodY + rodH / 2);
    rodGrd.addColorStop(0, css(shade(WOOD, 1.45)));
    rodGrd.addColorStop(0.4, css(WOOD));
    rodGrd.addColorStop(1, css(shade(WOOD, 0.6)));
    g.fillStyle = rodGrd;
    roundRect(g, cx - rodW / 2, rodY - rodH / 2, rodW, rodH, rodH / 2);
    g.fill();
    // Концы валика — тёмные наконечники.
    for (const side of [-1, 1]) {
      g.fillStyle = css(shade(WOOD, 0.55), 0.95);
      roundRect(g, cx + side * rodW * 0.5 - (side > 0 ? 0 : rodH * 1.2), rodY - rodH * 0.7, rodH * 1.2, rodH * 1.4, rodH * 0.5);
      g.fill();
    }

    // Нижний валик.
    const bY = lay.y + lay.h * SCROLL_TEXT.mark + lay.h * 0.012;
    const bW = lay.w * 1.03;
    const bH = Math.max(3, lay.w * 0.02);
    const bg = g.createLinearGradient(0, bY - bH / 2, 0, bY + bH / 2);
    bg.addColorStop(0, css(shade(WOOD, 1.3)));
    bg.addColorStop(0.5, css(WOOD));
    bg.addColorStop(1, css(shade(WOOD, 0.55)));
    g.fillStyle = bg;
    roundRect(g, cx - bW / 2, bY - bH / 2, bW, bH, bH / 2);
    g.fill();

    this.frame = c;
  }

  private buildKanji(): void {
    const { dpr, lay } = this;
    const { w, h } = lay;
    const c = makeCanvas(w * dpr, h * dpr);
    const g = c.getContext('2d')!;
    g.scale(dpr, dpr);

    const { cx, cy, r } = StartArt.circle(lay);
    const size = r * 0.3;
    const gap = size * 1.16;
    const chars = [...SCROLL_KANJI];
    const top = cy - ((chars.length - 1) * gap) / 2;
    const rnd = makeRng(917);

    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.font = `300 ${Math.round(size)}px ${FONT_STACK}`;

    for (let i = 0; i < chars.length; i++) {
      const x = cx + (rnd() - 0.5) * size * 0.07;
      const y = top + i * gap + (rnd() - 0.5) * size * 0.06;
      g.save();
      g.translate(x, y);
      g.rotate((rnd() - 0.5) * 0.05);
      // Влажный ореол: тушь расплылась по волокнам.
      g.shadowColor = css(INK, 0.3);
      g.shadowBlur = size * 0.14;
      g.fillStyle = css(INK, 0.5);
      g.fillText(chars[i], 0, 0);
      g.shadowBlur = 0;
      // Плотное тело знака.
      g.fillStyle = css(INK, 0.84);
      g.fillText(chars[i], 0, 0);
      // Подтёк по краю — знак перестаёт быть наборным.
      g.fillStyle = css(INK, 0.14);
      g.fillText(chars[i], size * 0.014, size * 0.01);
      g.restore();
    }

    // Сухая кисть: внутри столбца вынимаем зерно и проводим светлые волокна.
    const colX = cx - size * 0.66;
    const colW = size * 1.32;
    const colY = top - size * 0.66;
    const colH = (chars.length - 1) * gap + size * 1.32;
    const grain = g.createPattern(alphaGrain(), 'repeat');
    g.save();
    g.beginPath();
    g.rect(colX, colY, colW, colH);
    g.clip();
    g.globalCompositeOperation = 'destination-out';
    if (grain) {
      g.globalAlpha = 0.11;
      g.fillStyle = grain;
      g.fillRect(colX, colY, colW, colH);
    }
    g.globalAlpha = 0.20;
    g.strokeStyle = '#000';
    g.lineWidth = Math.max(0.6, size * 0.035);
    for (let i = 0; i < 7; i++) {
      const y = colY + (i + 0.5) * (colH / 7) + (rnd() - 0.5) * size * 0.24;
      g.beginPath();
      g.moveTo(colX, y);
      g.lineTo(colX + colW, y + (rnd() - 0.5) * size * 0.12);
      g.stroke();
    }
    g.restore();

    this.kanji = c;
  }

  private buildSeal(): void {
    const { dpr, lay } = this;
    const s = StartArt.circle(lay).r * 0.3;
    const pad = s * 0.5;
    const c = makeCanvas((s + pad * 2) * dpr, (s + pad * 2) * dpr);
    const g = c.getContext('2d')!;
    g.scale(dpr, dpr);
    g.translate(s / 2 + pad, s / 2 + pad);
    g.rotate(-0.05);

    g.fillStyle = css(SILK, 0.88);
    blobPath(g, 0, 0, s * 0.5, s * 0.5, 313, 0.07, 15);
    g.fill();

    // Знак вырезан в печати, а не написан поверх.
    g.globalCompositeOperation = 'destination-out';
    g.font = `600 ${Math.round(s * 0.68)}px ${FONT_STACK}`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(SEAL_KANJI, 0, s * 0.03);

    // Старая печать: краска легла не везде.
    const rnd = makeRng(55);
    g.globalAlpha = 0.55;
    for (let i = 0; i < 16; i++) {
      const a = rnd() * Math.PI * 2;
      const rr = Math.sqrt(rnd()) * s * 0.5;
      g.beginPath();
      g.arc(Math.cos(a) * rr, Math.sin(a) * rr, s * (0.015 + rnd() * 0.05), 0, Math.PI * 2);
      g.fill();
    }

    this.seal = c;
  }

  private buildMotes(): void {
    const rnd = makeRng(4242);
    this.motes = [];
    for (let i = 0; i < 16; i++) {
      this.motes.push({
        x: rnd(),
        y: rnd(),
        r: 0.5 + rnd() * 1.3,
        sp: 0.006 + rnd() * 0.016,
        ph: rnd() * Math.PI * 2,
        a: 0.05 + rnd() * 0.09,
      });
    }
  }

  // ---- Мазок ----

  /**
   * Мазок энсо: одна непрерывная лента, а не цепочка пятен.
   *
   * Круг рисуется не геометрией, а движением кисти — тело мазка гуляет по
   * радиусу, толщина дышит, вход тонкий, хвост сходит в нить. Слоями ложатся
   * вода (края расплылись по волокнам), плотная тушь и сердцевина; потом
   * зерно пигмента вынимает из мазка сухие места, а к хвосту кисть кончается
   * и бумага проступает волокнами.
   */
  private paintStroke(progress: number): void {
    if (!this.ink) return;
    const p = clamp01(progress);
    const target = Math.round(p * STROKE_STEPS);
    if (target === this.drawn) return;
    this.drawn = target;

    const g = this.ink.getContext('2d')!;
    g.clearRect(0, 0, this.lay.w, this.lay.h);
    if (target <= 0) return;

    // Мазок уже лежит на отдельном холсте во всю длину. По кадру его
    // не перерисовываем — открываем клином, как будто кисть идёт по кругу,
    // а на конце мазка ставим мокрый кончик. Рисовать заново 168 точек,
    // сотни сухих пропусков и размытия каждый кадр — слишком дорого
    // для экрана, который и так живёт над работающим садом.
    const wall = this.buildFullStroke();
    if (p < 1) {
      const { cx, cy, r, stroke } = StartArt.circle(this.lay);
      const a0 = GAP_START;
      const a1 = GAP_START + SWEEP * p;
      const far = r * 2.2 + stroke;
      g.save();
      g.beginPath();
      g.moveTo(cx, cy);
      g.arc(cx, cy, far, a0, a1);
      g.closePath();
      g.clip();
      g.drawImage(wall, 0, 0, this.lay.w, this.lay.h);
      g.restore();
      this.wetTip(g, p);
    } else {
      g.drawImage(wall, 0, 0, this.lay.w, this.lay.h);
    }
  }

  /**
   * Мокрый кончик кисти. Он не «кружок у среза», а последние сантиметры
   * мазка, проведённые заново: кисть ещё стоит на бумаге, краска ещё
   * ложится, и ровный срез открытого клина за ним не виден.
   */
  private wetTip(g: Ctx, p: number): void {
    const { cx, cy, r, stroke } = StartArt.circle(this.lay);
    // Мокрый след идёт чуть впереди открытого клина: тушь уже разошлась
    // по бумаге, и ровного среза не видно. Дальше по кругу — к нулю.
    const ahead = 0.022;
    const back = 0.075;
    const a = Math.max(0, p - back);
    const b = Math.min(1, p + ahead);
    const steps = 14;
    const pts: Array<{ x: number; y: number; w: number; nx: number; ny: number }> = [];
    for (let i = 0; i <= steps; i++) {
      const u = i / steps;
      const t = a + (b - a) * u;
      const q = this.strokePoint(t, cx, cy, r, stroke);
      // За концом кисти мазок тает: ширина сходит и краска бледнеет.
      const past = clamp01((t - p) / Math.max(0.0001, b - p));
      const lift = t <= p ? 1 : 1 - smoothstep(0, 1, past) * 0.96;
      pts.push({ ...q, w: q.w * lift });
    }

    const canBlur = supportsBlur(g);
    if (canBlur) g.filter = `blur(${(stroke * 0.04).toFixed(1)}px)`;
    g.beginPath();
    for (let i = 0; i <= steps; i++) {
      const q = pts[i];
      const x = q.x + q.nx * q.w * 0.5;
      const y = q.y + q.ny * q.w * 0.5;
      if (i === 0) g.moveTo(x, y);
      else g.lineTo(x, y);
    }
    for (let i = steps; i >= 0; i--) {
      const q = pts[i];
      g.lineTo(q.x - q.nx * q.w * 0.5, q.y - q.ny * q.w * 0.5);
    }
    g.closePath();
    g.fillStyle = css(INK, 0.9);
    g.fill();
    // В самом конце — капля: кисть оторвалась, краска осталась.
    const last = pts[steps];
    g.fillStyle = css(INK, 0.3);
    g.beginPath();
    g.ellipse(last.x, last.y, last.w * 0.7 + 0.6, last.w * 0.6 + 0.5, Math.atan2(last.ny, last.nx), 0, Math.PI * 2);
    g.fill();
    if (canBlur) g.filter = 'none';
  }

  /** Полный мазок — один раз на размер листа. */
  private buildFullStroke(): HTMLCanvasElement {
    const key = `${this.lay.w}x${this.lay.h}@${this.dpr}`;
    if (this.inkFull && this.inkFullFor === key) return this.inkFull;
    const c = makeCanvas(this.lay.w * this.dpr, this.lay.h * this.dpr);
    const g = c.getContext('2d')!;
    g.scale(this.dpr, this.dpr);
    this.drawFullStroke(g);
    this.inkFull = c;
    this.inkFullFor = key;
    return c;
  }

  private drawFullStroke(g: Ctx): void {
    const { cx, cy, r, stroke } = StartArt.circle(this.lay);
    const N = 168;
    const pts: Array<{ x: number; y: number; w: number; nx: number; ny: number }> = [];
    for (let i = 0; i <= N; i++) pts.push(this.strokePoint(i / N, cx, cy, r, stroke));

    // Два края мазка гуляют независимо: симметричная лента читается трубкой.
    const edgeK = (i: number, side: number): number =>
      1 + (noise2(i * 0.11, side * 7.3, 61) - 0.5) * 0.3 + (noise2(i * 0.42, side * 2.1, 83) - 0.5) * 0.14;

    const band = (k: number): void => {
      g.beginPath();
      for (let i = 0; i <= N; i++) {
        const q = pts[i];
        const kk = k * edgeK(i, 0);
        const x = q.x + q.nx * q.w * 0.5 * kk;
        const y = q.y + q.ny * q.w * 0.5 * kk;
        if (i === 0) g.moveTo(x, y);
        else g.lineTo(x, y);
      }
      for (let i = N; i >= 0; i--) {
        const q = pts[i];
        const kk = k * edgeK(i, 1);
        g.lineTo(q.x - q.nx * q.w * 0.5 * kk, q.y - q.ny * q.w * 0.5 * kk);
      }
      g.closePath();
    };

    const canBlur = supportsBlur(g);
    const blur = (px: number): void => {
      if (canBlur) g.filter = px > 0.05 ? `blur(${px.toFixed(1)}px)` : 'none';
    };

    // Вода: бумага намокла шире, чем лёг пигмент.
    blur(stroke * 0.24);
    g.fillStyle = css(INK, 0.14);
    band(1.14);
    g.fill();
    // Подтёк: размытая тушь вокруг тела — по нему видно, что краски было много.
    blur(stroke * 0.1);
    g.fillStyle = css(INK, 0.24);
    band(1.06);
    g.fill();
    // Тушь: тело мазка. Кисть прижата — краска ложится плотно и черно.
    blur(stroke * 0.05);
    g.fillStyle = css(INK, 0.72);
    band(1);
    g.fill();
    g.fillStyle = css(INK, 0.5);
    band(0.88);
    g.fill();
    // Сердцевина: здесь кисть стояла дольше всего. Край размыт, иначе
    // внутри мазка проступает лишнее кольцо.
    blur(stroke * 0.2);
    g.fillStyle = css(shade(INK, 0.85), 0.34);
    band(0.6);
    g.fill();
    blur(0);

    // Мокрая кромка — не сплошная линия, а след краски, что собралась
    // на краю и подсохла. Идёт обрывками, иначе мазок обведён контуром.
    g.lineWidth = Math.max(0.7, stroke * 0.06);
    g.lineCap = 'round';
    for (let pass = 0; pass < 2; pass++) {
      const rnd = makeRng(700 + pass * 31);
      g.beginPath();
      for (let i = 0; i <= N; i++) {
        if (rnd() > 0.34) continue;
        const q = pts[i];
        const kk = (0.52 + rnd() * 0.12) * edgeK(i, pass);
        const x = q.x + q.nx * q.w * kk;
        const y = q.y + q.ny * q.w * kk;
        const j = Math.min(N, i + 1 + Math.floor(rnd() * 4));
        const q2 = pts[j];
        g.moveTo(x, y);
        g.lineTo(q2.x + q2.nx * q2.w * kk, q2.y + q2.ny * q2.w * kk);
      }
      g.strokeStyle = css(INK, 0.26 - pass * 0.08);
      g.stroke();
    }

    // Сухая кисть. Волокна бумаги вынимают тушь, но не сплошными линиями,
    // а короткими пропусками: длинная ровная полоса читается бликом на
    // трубке, а мазок должен быть живым пятном, а не желобом.
    const rnd = makeRng(313);
    g.save();
    g.beginPath();
    band(1.04);
    g.clip();
    g.globalCompositeOperation = 'destination-out';
    g.lineCap = 'round';
    for (let dab = 0; dab < 130; dab++) {
      // К хвосту кисть всё суше: пропусков больше и они плотнее.
      const t = Math.pow(rnd(), 0.7);
      const k = Math.floor(t * N);
      const q = pts[k];
      const off = (rnd() - 0.5) * q.w * 1.02;
      const alpha = (0.04 + rnd() * 0.13) * clamp01(0.15 + t * 0.55);
      g.strokeStyle = `rgba(0,0,0,${alpha})`;
      g.lineWidth = Math.max(0.5, stroke * (0.015 + rnd() * 0.05));
      // Пропуск идёт вдоль движения кисти и слегка уводит в сторону:
      // волокно бумаги тянет тушь за собой.
      const drift = (rnd() - 0.5) * q.w * 0.3;
      const len = 4 + Math.floor(rnd() * 10);
      g.beginPath();
      for (let j = 0; j <= len; j++) {
        const u = j / len;
        const qq = pts[Math.min(N, k + j)];
        const side = off + drift * u + (rnd() - 0.5) * qq.w * 0.06;
        const x = qq.x + qq.nx * side;
        const y = qq.y + qq.ny * side;
        if (j === 0) g.moveTo(x, y);
        else g.lineTo(x, y);
      }
      g.stroke();
    }
    g.restore();

    // Бледные волокна снаружи мазка: там, где кисть шла суше, тушь ушла
    // по волокнам бумаги серыми прядями. Они и делают край живым.
    for (let i = 0; i < 26; i++) {
      const t = 0.3 + rnd() * 0.7;
      let kk = Math.floor(t * N);
      const side = (rnd() < 0.5 ? -1 : 1) * (0.55 + rnd() * 0.55);
      blur(stroke * 0.16);
      g.strokeStyle = css(INK, 0.1 + rnd() * 0.16);
      g.lineWidth = Math.max(0.6, stroke * (0.02 + rnd() * 0.06));
      g.beginPath();
      for (let j = 0; j <= 6; j++) {
        kk = Math.min(N, kk + 1);
        const qq = pts[kk];
        const off = side + (rnd() - 0.5) * 0.2;
        const x = qq.x + qq.nx * qq.w * off;
        const y = qq.y + qq.ny * qq.w * off;
        if (j === 0) g.moveTo(x, y);
        else g.lineTo(x, y);
      }
      g.stroke();
    }
    blur(0);

    // Где кисть замедлилась, тушь успела расплыться за край мазка.
    for (let i = 0; i < 7; i++) {
      const t = 0.1 + rnd() * 0.75;
      const k = Math.floor(t * N);
      const q = pts[k];
      const side = (rnd() < 0.5 ? -1 : 1) * (0.35 + rnd() * 0.4);
      blur(stroke * 0.5);
      g.fillStyle = css(INK, 0.1 + rnd() * 0.12);
      g.beginPath();
      g.ellipse(
        q.x + q.nx * q.w * side,
        q.y + q.ny * q.w * side,
        q.w * (0.2 + rnd() * 0.4),
        q.w * (0.16 + rnd() * 0.3),
        GAP_START + SWEEP * t,
        0,
        Math.PI * 2,
      );
      g.fill();
    }
    blur(0);

    // Зерно пигмента и сухие пробелы — крупными каплями вдоль мазка.
    const grainA = 0.24 * clamp01((this.strokePoint(0.4, cx, cy, r, stroke).w / Math.max(0.001, stroke) - 0.18) / 0.6);
    if (grainA > 0.02) {
      g.globalCompositeOperation = 'source-over';
      g.fillStyle = css(shade(INK, 0.82), grainA * 0.7);
      for (let i = 0; i < 150; i++) {
        const k = Math.floor(rnd() * N);
        const q = pts[k];
        const off = (rnd() - 0.5) * q.w * 1.0;
        g.beginPath();
        g.ellipse(
          q.x + q.nx * off,
          q.y + q.ny * off,
          0.3 + rnd() * 0.9,
          0.25 + rnd() * 0.5,
          GAP_START + SWEEP * (k / N),
          0,
          Math.PI * 2,
        );
        g.fill();
      }
    }
  }

  /** Точка мазка: положение, толщина и нормаль к линии движения кисти. */
  private strokePoint(
    t: number,
    cx: number,
    cy: number,
    r: number,
    stroke: number,
  ): { x: number; y: number; w: number; nx: number; ny: number } {
    const a = GAP_START + SWEEP * t;
    // Радиус и центр гуляют: круг, обведённый по циркулю, выдаёт машину.
    const rad = r * (1 + noise2(t * 3.4, 2.3, 21) * 0.075 - 0.037);
    const squash = 0.965;
    const drift = r * 0.028;
    const x = cx + Math.cos(a) * rad + noise2(t * 1.7, 5.5, 41) * drift;
    const y = cy + Math.sin(a) * rad * squash + noise2(t * 1.9, 8.1, 43) * drift;
    // Вход: кисть ставится и сразу прижимается. Хвост: коротко сходит в нить.
    const enter = 0.42 + 0.58 * smoothstep(0, 0.07, t);
    const exit = 1 - 0.97 * smoothstep(0.66, 1, t);
    const w = stroke * enter * exit * (0.82 + noise2(t * 5.3, 4.7, 37) * 0.42);
    const nx = Math.cos(a);
    const ny = Math.sin(a) * squash;
    const len = Math.hypot(nx, ny) || 1;
    return { x, y, w, nx: nx / len, ny: ny / len };
  }

  // ---- Свет ----

  private paintLight(ctx: Ctx, s: StartFrame): void {
    const { vw, vh } = this;
    const { tint, strength } = lightForHour(s.hour);
    const breathe = s.motion ? 0.5 - 0.5 * Math.cos((s.time / 12000) * Math.PI * 2) : 0.5;
    const amount = strength * (0.7 + 0.3 * breathe);
    const lx = vw * 0.5;
    const ly = vh * 0.28;
    const lr = Math.max(vw, vh) * 0.62;

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const grd = ctx.createRadialGradient(lx, ly, 0, lx, ly, lr);
    grd.addColorStop(0, css(tint, amount * 1.15));
    grd.addColorStop(0.42, css(tint, amount * 0.42));
    grd.addColorStop(0.75, css(tint, amount * 0.12));
    grd.addColorStop(1, css(tint, 0));
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, vw, vh);
    ctx.restore();

    if (s.motes && s.motion) {
      const t = s.time / 1000;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (const m of this.motes) {
        const y = (((m.y - t * m.sp) % 1) + 1) % 1;
        const x = m.x + Math.sin(m.ph + t * 0.22) * 0.012;
        ctx.fillStyle = css(tint, m.a * (0.5 + 0.5 * breathe));
        ctx.beginPath();
        ctx.arc(x * vw, y * vh, m.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    withAlpha(ctx, 0.5, () => {
      const vg = ctx.createRadialGradient(
        vw * 0.5,
        vh * 0.44,
        Math.min(vw, vh) * 0.34,
        vw * 0.5,
        vh * 0.5,
        Math.max(vw, vh) * 0.78,
      );
      vg.addColorStop(0, 'rgba(6,10,12,0)');
      vg.addColorStop(1, 'rgba(6,10,12,0.85)');
      ctx.fillStyle = vg;
      ctx.fillRect(0, 0, vw, vh);
    });
  }
}

/**
 * Умеет ли холст размытие. Оно нужно только для мягкого края мазка:
 * без него мазок станет суше, но не сломается.
 */
function supportsBlur(ctx: Ctx): boolean {
  try {
    ctx.filter = 'blur(1px)';
    const ok = ctx.filter !== 'none';
    ctx.filter = 'none';
    return ok;
  } catch {
    return false;
  }
}

/** Край листа: ровная бумага выглядела бы вырезанной по линейке. */
function decklePath(ctx: Ctx, x: number, y: number, w: number, h: number, seed: number, amp: number): void {
  const pts: [number, number][] = [];
  const step = Math.max(9, Math.min(w, h) * 0.055);
  const nx = Math.max(4, Math.round(w / step));
  const ny = Math.max(4, Math.round(h / step));
  for (let i = 0; i < nx; i++) pts.push([x + (w * i) / nx, y + (hash2(i, seed, 2) - 0.5) * 2 * amp]);
  for (let i = 0; i < ny; i++) pts.push([x + w + (hash2(i, seed, 5) - 0.5) * 2 * amp, y + (h * i) / ny]);
  for (let i = nx; i > 0; i--) pts.push([x + (w * i) / nx, y + h + (hash2(i, seed, 8) - 0.5) * 2 * amp]);
  for (let i = ny; i > 0; i--) pts.push([x + (hash2(i, seed, 13) - 0.5) * 2 * amp, y + (h * i) / ny]);

  const n = pts.length;
  ctx.beginPath();
  ctx.moveTo((pts[0][0] + pts[n - 1][0]) / 2, (pts[0][1] + pts[n - 1][1]) / 2);
  for (let i = 0; i < n; i++) {
    const cur = pts[i];
    const nxt = pts[(i + 1) % n];
    ctx.quadraticCurveTo(cur[0], cur[1], (cur[0] + nxt[0]) / 2, (cur[1] + nxt[1]) / 2);
  }
  ctx.closePath();
}

/** Скруглённый прямоугольник — валики и наконечники свитка. */
function roundRect(ctx: Ctx, x: number, y: number, w: number, h: number, r: number): void {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.lineTo(x + w - rr, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + rr);
  ctx.lineTo(x + w, y + h - rr);
  ctx.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
  ctx.lineTo(x + rr, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - rr);
  ctx.lineTo(x, y + rr);
  ctx.quadraticCurveTo(x, y, x + rr, y);
  ctx.closePath();
}

/**
 * Полоса света с мягкими краями. Готовится попиксельно маленькой
 * картинкой и растягивается: так край остаётся размытым, а рисовать
 * приходится один раз, а не каждый кадр.
 */
let patchTile: HTMLCanvasElement | null = null;

function softPatch(): HTMLCanvasElement {
  if (patchTile) return patchTile;
  const size = 96;
  const c = makeCanvas(size, size);
  const g = c.getContext('2d')!;
  const img = g.createImageData(size, size);
  const rnd = makeRng(808);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = x / (size - 1);
      const v = y / (size - 1);
      // Мягкий клин: ярче у верхнего левого края, к низу и правому — в тень.
      const along = 1 - smoothstep(0.05, 1, u);
      const across = 1 - smoothstep(0.0, 0.72, v);
      const a = Math.pow(clamp01(along * across), 1.35) * (0.55 + rnd() * 0.12);
      const i = (y * size + x) * 4;
      const cold = 178 + Math.round(rnd() * 8);
      img.data[i] = cold - 26;
      img.data[i + 1] = cold - 8;
      img.data[i + 2] = cold;
      img.data[i + 3] = Math.round(clamp01(a) * 255 * 0.5);
    }
  }
  g.putImageData(img, 0, 0);
  patchTile = c;
  return c;
}

/** Зерно с неровной прозрачностью: им вынимают тушь из мазка. */
let grainTile: HTMLCanvasElement | null = null;

function alphaGrain(): HTMLCanvasElement {
  if (grainTile) return grainTile;
  const size = 96;
  const c = makeCanvas(size, size);
  const g = c.getContext('2d')!;
  const img = g.createImageData(size, size);
  const rnd = makeRng(2026);
  for (let i = 0; i < size * size; i++) {
    const n = rnd();
    img.data[i * 4] = 0;
    img.data[i * 4 + 1] = 0;
    img.data[i * 4 + 2] = 0;
    img.data[i * 4 + 3] = n > 0.72 ? 255 : n > 0.5 ? 128 : 40;
  }
  g.putImageData(img, 0, 0);
  grainTile = c;
  return c;
}
