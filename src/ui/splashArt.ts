/**
 * Живая акварель заставки.
 *
 * Заставка — первый кадр игры, и он обязан быть нарисован тем же языком, что
 * и сад: мягкие кляксы, подсохшая кромка, зерно пигмента, рисовая бумага.
 * Никакой растровой графики: всё считается кодом из сезона, настоящего часа
 * и настоящей погоды мира.
 *
 * Класс не привязан к холсту: `render` рисует в переданный контекст, поэтому
 * один и тот же код кормит и браузер, и оффлайн-проверку `tools/splash.ts`.
 *
 * Кадр собирается из двух частей:
 *  — статичный слой (бумага, небо, горы, дальний лес, вода, ветвь),
 *    пересоздаётся только при смене размера или заметной смене света;
 *  — то, что дышит: мазок энсо, прорисовывающийся до progress=1 и затем
 *    впекаемый в статичный слой, туман, птицы и редкие лепестки.
 */

import { SeasonId, TimeState, seasonBlend } from '../core/clock';
import { clamp01, fbm, hash2, lerp, makeRng } from '../core/rng';
import { Atmosphere, RGB, SEASON_PALETTES, css, mix, shade } from '../world/palette';
import { Ctx, getPaperTile, glow, makeCanvas, taperStroke, vignette, washBlob } from '../render/paint';

export interface SplashOptions {
  /** Лепестки, снег и светлячки в воздухе (настройка «частицы»). */
  particles: boolean;
  /** Движение вообще: прорисовка энсо, дыхание тумана, птицы. */
  motion: boolean;
}

interface Petal {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  spin: number;
  phase: number;
}

interface Bird {
  x: number;
  y: number;
  v: number;
  flap: number;
  s: number;
}

/** Точка мазка энсо: положение и толщина кисти. */
interface EnsoPoint {
  x: number;
  y: number;
  w: number;
}

const ENSO_SEGMENTS = 150;
/** Энсо не замыкается: разрыв — часть образа. */
const ENSO_SWEEP = Math.PI * 2 * 0.9;

export class SplashArt {
  private opts: SplashOptions;
  private still: HTMLCanvasElement | null = null;
  private stillKey = '';
  private ensoBakedKey = '';
  private enso: EnsoPoint[] = [];
  private ensoInk: RGB = { r: 46, g: 40, b: 36 };
  private petals: Petal[] = [];
  private birds: Bird[] = [];
  private petalKey = '';
  private w = 0;
  private h = 0;
  private now = 0;

  constructor(opts: SplashOptions) {
    this.opts = opts;
  }

  /** Один кадр листа. W и H — в пикселях устройства (без dpr-масштаба сверху). */
  render(ctx: Ctx, W: number, H: number, t: TimeState, atm: Atmosphere, progress: number, dtMs: number): void {
    if (W < 2 || H < 2) return;
    this.w = W;
    this.h = H;
    this.now += this.opts.motion ? dtMs : 0;
    const now = this.now;

    const key = this.stillCacheKey(W, H, atm);
    if (key !== this.stillKey) {
      this.buildStill(W, H, t, atm);
      this.buildEnso(W, H, t);
      this.stillKey = key;
      this.ensoBakedKey = '';
    }
    const pkey = `${W}x${H}|${seasonBlend(t).from}|${this.opts.particles ? 1 : 0}`;
    if (pkey !== this.petalKey) {
      this.buildPetals(W, H, t);
      this.buildBirds(W, H, t);
      this.petalKey = pkey;
    }

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (this.still) ctx.drawImage(this.still, 0, 0);

    // туман дышит: полоса медленно меняет силу
    if (this.opts.motion) {
      const breath = 0.5 + 0.5 * Math.sin(now / 4200);
      const mc = mix(atm.skyBottom, { r: 255, g: 252, b: 244 }, 0.6);
      const mist = ctx.createLinearGradient(0, H * 0.52, 0, H * 0.86);
      mist.addColorStop(0, css(mc, 0));
      mist.addColorStop(0.5, css(mc, 0.05 + breath * 0.07));
      mist.addColorStop(1, css(mc, 0));
      ctx.fillStyle = mist;
      ctx.fillRect(0, H * 0.52, W, H * 0.34);
    }

    if (progress >= 1) {
      if (this.ensoBakedKey !== this.stillKey) {
        // мазок доведён: впекаем в статичный слой, дальше он бесплатен
        this.strokeEnso(this.still!.getContext('2d')!, 1);
        this.ensoBakedKey = this.stillKey;
      }
    } else {
      this.strokeEnso(ctx, progress);
    }

    this.drawBirds(ctx, t, dtMs);
    if (t.isNight && this.opts.particles) this.drawFireflies(ctx, now);
    this.drawPetals(ctx, t, dtMs);
  }

  /** Ключ кэша: слой пересоздаём только когда заметно изменились свет или размер. */
  private stillCacheKey(W: number, H: number, atm: Atmosphere): string {
    const b = seasonBlend(atm.time);
    return [
      W,
      H,
      b.from,
      b.to,
      Math.round(b.k * 20),
      Math.round(atm.time.daylight * 30),
      Math.round(atm.time.golden * 12),
      Math.round(atm.overcast * 10),
    ].join('|');
  }

  // ---------------- Статичный слой ----------------

  private buildStill(W: number, H: number, t: TimeState, atm: Atmosphere): void {
    const c = makeCanvas(W, H);
    const g = c.getContext('2d')!;
    const pal = atm.palette;

    // --- Бумага, тонированная часом: ночь холоднее, закат теплее ---
    const paperWarm = mix({ r: 243, g: 234, b: 214 }, atm.lightTint, 0.32);
    const paper = shade(paperWarm, lerp(0.66, 1, clamp01(atm.time.daylight * 1.1 + 0.15)));
    g.fillStyle = css(paper, 1);
    g.fillRect(0, 0, W, H);

    // --- Небо: мягкий размыв сверху ---
    const sky = g.createLinearGradient(0, 0, 0, H * 0.72);
    sky.addColorStop(0, css(mix(atm.skyTop, paper, 0.26), 0.9));
    sky.addColorStop(1, css(mix(atm.skyBottom, paper, 0.46), 0.6));
    g.fillStyle = sky;
    g.fillRect(0, 0, W, H * 0.72);
    // золотой час кладёт охру поверх всего листа, как в сцене
    if (atm.golden > 0.05) {
      g.save();
      g.globalCompositeOperation = 'soft-light';
      g.fillStyle = css({ r: 255, g: 186, b: 116 }, atm.golden * 0.3);
      g.fillRect(0, 0, W, H);
      g.restore();
    }
    if (atm.time.daylight < 0.5) {
      g.save();
      g.globalCompositeOperation = 'soft-light';
      g.fillStyle = css({ r: 70, g: 96, b: 176 }, (1 - atm.time.daylight * 2) * 0.3);
      g.fillRect(0, 0, W, H);
      g.restore();
    }

    this.drawMoonOrSun(g, W, H, t);
    this.drawRidges(g, W, H, pal.foliageDeep, atm);
    this.drawFarForest(g, W, H, atm);
    this.drawWater(g, W, H, pal, atm);
    this.drawBranch(g, W, H, t);

    // --- Зерно бумаги и виньетка, как в сцене ---
    const pat = g.createPattern(getPaperTile(), 'repeat');
    if (pat) {
      g.save();
      g.globalCompositeOperation = 'overlay';
      g.globalAlpha = 0.16;
      g.fillStyle = pat;
      g.fillRect(0, 0, W, H);
      g.restore();
      g.save();
      g.globalCompositeOperation = 'soft-light';
      g.globalAlpha = 0.12;
      g.fillStyle = pat;
      g.fillRect(0, 0, W, H);
      g.restore();
    }
    vignette(g, W, H, shade(paper, 0.42), 0.4);
    this.still = c;
  }

  /** Луна ночью, низкое солнце в золотой час. Днём — только свет. */
  private drawMoonOrSun(g: Ctx, W: number, H: number, t: TimeState): void {
    const cx = W * 0.78;
    const cy = H * 0.18;
    const r = Math.min(W, H) * 0.045;
    if (t.isNight) {
      glow(g, cx, cy, Math.min(W, H) * 0.2, { r: 226, g: 232, b: 238 }, 0.5);
      g.save();
      g.fillStyle = css({ r: 240, g: 240, b: 232 }, 0.85);
      g.beginPath();
      g.arc(cx, cy, r, 0, Math.PI * 2);
      g.fill();
      // серп: луна не бывает ровным диском
      g.globalCompositeOperation = 'destination-out';
      g.globalAlpha = 0.35;
      g.beginPath();
      g.arc(cx - r * 0.36, cy - r * 0.18, r * 0.92, 0, Math.PI * 2);
      g.fill();
      g.restore();
    } else if (t.golden > 0.2) {
      glow(g, cx, cy + H * 0.06, Math.min(W, H) * 0.3, { r: 250, g: 196, b: 130 }, 0.55 * t.golden);
    } else {
      glow(g, W * 0.6, H * 0.12, Math.min(W, H) * 0.34, { r: 255, g: 246, b: 220 }, 0.22 * t.daylight);
    }
  }

  /** Дальние горы: три размыва, чем дальше — тем бледнее и холоднее. */
  private drawRidges(g: Ctx, W: number, H: number, ink: RGB, atm: Atmosphere): void {
    for (let k = 0; k < 3; k++) {
      const base = H * (0.44 + k * 0.085);
      const amp = H * (0.1 - k * 0.024);
      const col = mix(ink, atm.skyBottom, 0.42 + k * 0.17);
      g.save();
      g.globalAlpha = 0.44 - k * 0.1;
      g.beginPath();
      g.moveTo(0, H);
      const stepX = Math.max(6, W / 140);
      for (let x = 0; x <= W + stepX; x += stepX) {
        const n = fbm(x / (W * 0.42) + k * 7.3, k * 3.1, 3, 40 + k);
        g.lineTo(x, base - n * amp * 2 + amp * 0.4);
      }
      g.lineTo(W, H);
      g.closePath();
      g.fillStyle = css(col, 1);
      g.fill();
      g.restore();
    }
    // полоса тумана у подножия: граница земли и неба растворяется
    const pale = mix(atm.skyBottom, { r: 255, g: 252, b: 244 }, 0.6);
    const mist = g.createLinearGradient(0, H * 0.5, 0, H * 0.78);
    mist.addColorStop(0, css(pale, 0));
    mist.addColorStop(0.55, css(pale, 0.5));
    mist.addColorStop(1, css(pale, 0));
    g.fillStyle = mist;
    g.fillRect(0, H * 0.5, W, H * 0.28);
  }

  /** Дальний лес по берегу: зубчатая кромка и её отражение в воде. */
  private drawFarForest(g: Ctx, W: number, H: number, atm: Atmosphere): void {
    const base = H * 0.725;
    const col = mix(atm.palette.foliageDeep, atm.skyBottom, 0.5);
    const rnd = makeRng(777);
    g.save();
    g.globalAlpha = 0.38;
    g.fillStyle = css(col, 1);
    g.beginPath();
    g.moveTo(0, base + H * 0.02);
    const step = Math.max(8, W / 90);
    for (let x = 0; x <= W + step; x += step) {
      const n = fbm(x / (W * 0.16), 4.2, 3, 91);
      const tree = 0.55 + 0.45 * Math.abs(Math.sin(x * 0.11 + rnd() * 0.4));
      g.lineTo(x, base - (n * 0.6 + tree * 0.4) * H * 0.042);
    }
    g.lineTo(W, base + H * 0.02);
    g.closePath();
    g.fill();
    g.restore();
    // отражение: та же кромка, перевёрнутая и растертая водой
    g.save();
    g.globalAlpha = 0.09;
    g.translate(0, base * 2 + H * 0.03);
    g.scale(1, -0.5);
    g.fillStyle = css(col, 1);
    g.beginPath();
    g.moveTo(0, base + H * 0.02);
    for (let x = 0; x <= W + step2(W); x += step2(W)) {
      const n = fbm(x / (W * 0.16), 4.2, 3, 91);
      g.lineTo(x, base - n * H * 0.05);
    }
    g.lineTo(W, base + H * 0.02);
    g.closePath();
    g.fill();
    g.restore();
  }

  /** Тихая вода внизу: размыв и несколько светлых штрихов-отражений. */
  private drawWater(g: Ctx, W: number, H: number, pal: { water: RGB; waterDeep: RGB }, atm: Atmosphere): void {
    const top = H * 0.755;
    // кромка воды растворяется в тумане, а не режет лист
    const grd = g.createLinearGradient(0, top, 0, H);
    grd.addColorStop(0, css(mix(pal.water, atm.skyBottom, 0.85), 0));
    grd.addColorStop(0.3, css(mix(pal.water, { r: 250, g: 246, b: 234 }, 0.5), 0.45));
    grd.addColorStop(1, css(mix(pal.waterDeep, { r: 240, g: 236, b: 224 }, 0.34), 0.72));
    g.fillStyle = grd;
    g.fillRect(0, top, W, H - top);
    const rnd = makeRng(9001);
    for (let i = 0; i < 14; i++) {
      const y = top + rnd() * (H - top) * 0.85;
      const x = rnd() * W;
      const len = W * (0.05 + rnd() * 0.14);
      g.strokeStyle = css({ r: 252, g: 250, b: 242 }, 0.14 + rnd() * 0.16);
      g.lineWidth = Math.max(1, H * 0.002) * (1 + rnd() * 1.2);
      g.beginPath();
      g.moveTo(x, y);
      g.quadraticCurveTo(x + len * 0.5, y + 1.5, x + len, y);
      g.stroke();
    }
  }

  /** Ветвь сезона: цветёт, зеленеет, горит или стоит голой под снегом. */
  private drawBranch(g: Ctx, W: number, H: number, t: TimeState): void {
    const season = seasonBlend(t).from;
    const atmInk = mix({ r: 92, g: 66, b: 48 }, { r: 60, g: 66, b: 96 }, 1 - clamp01(t.daylight * 1.4));
    const ink = atmInk;
    const x0 = W * 1.02;
    const y0 = H * 0.12;
    const x1 = W * 0.58;
    const y1 = H * 0.31;
    const bw = Math.max(5, W * 0.0075);
    taperStroke(g, x0, y0, x1, y1, bw, Math.max(1.6, W * 0.002), shade(ink, 0.85), 0.92, -H * 0.055);
    taperStroke(g, lerp(x0, x1, 0.4), lerp(y0, y1, 0.4) - H * 0.02, W * 0.76, H * 0.11, bw * 0.42, 1.1, ink, 0.85, -10);
    taperStroke(g, lerp(x0, x1, 0.66), lerp(y0, y1, 0.66), W * 0.68, H * 0.42, bw * 0.36, 0.9, ink, 0.85, 12);
    taperStroke(g, lerp(x0, x1, 0.86), lerp(y0, y1, 0.86), W * 0.55, H * 0.22, bw * 0.3, 0.8, ink, 0.8, -6);

    // грозди сидят на самой ветви, а не рядом с ней
    const spots: [number, number, number][] = [
      [0.58, 0.31, 1],
      [0.66, 0.27, 0.8],
      [0.76, 0.11, 0.74],
      [0.68, 0.42, 0.62],
      [0.84, 0.17, 0.66],
      [0.92, 0.14, 0.5],
      [0.55, 0.22, 0.5],
    ];
    if (season === 'winter') {
      // голое дерево: снег лежит на ветках шапками
      for (const [fx, fy, s] of spots) {
        washBlob(g, W * fx, H * fy - 3, W * 0.028 * s, H * 0.01 * s, { r: 248, g: 249, b: 250 }, 30 + fx * 90, {
          layers: 2,
          alpha: 0.8,
          edge: 0.06,
        });
      }
      return;
    }
    const pal2 = SEASON_COLORS[season];
    const rnd = makeRng(season.length * 77 + 5);
    for (const [fx, fy, s] of spots) {
      const r = Math.min(W, H) * (0.04 + rnd() * 0.018) * s;
      washBlob(g, W * fx, H * fy, r, r * 0.78, pal2, 11 + fx * 130, { layers: 3, alpha: 0.52, edge: 0.14 });
      washBlob(g, W * fx + r * 0.7, H * fy + r * 0.3, r * 0.6, r * 0.5, shade(pal2, 1.06), 40 + fx * 90, {
        layers: 2,
        alpha: 0.4,
        edge: 0.1,
      });
      granulateLight(g, W * fx, H * fy, r * 0.8, shade(pal2, 0.86), 90 + fy * 400);
    }
  }

  // ---------------- Энсо ----------------

  private buildEnso(W: number, H: number, t: TimeState): void {
    const R = Math.min(W, H) * 0.27;
    const cx = W * 0.5;
    const cy = H * 0.47;
    const rnd = makeRng(20260917);
    const pts: EnsoPoint[] = [];
    const a0 = -Math.PI * 0.62;
    for (let i = 0; i <= ENSO_SEGMENTS; i++) {
      const k = i / ENSO_SEGMENTS;
      const a = a0 + k * ENSO_SWEEP;
      // кисть дрожит: радиус дышит, центр чуть уводит
      const wob = 1 + Math.sin(k * 9.1 + 1.2) * 0.016 + (rnd() - 0.5) * 0.012;
      const drift = k * k * R * 0.05;
      pts.push({
        x: cx + Math.cos(a) * R * wob + drift * 0.4,
        y: cy + Math.sin(a) * R * wob * 0.96 + drift * 0.25,
        // нажим: вход кистью, середина полно, конец сухо
        w: R * (0.034 + 0.062 * Math.sin(Math.PI * Math.min(1, k * 1.06)) ** 0.7) * (1 - k * 0.42),
      });
    }
    this.enso = pts;
    // тушь берёт час: ночь пишет индиго, закат — тёплой сажей
    const night = 1 - clamp01(t.daylight * 1.4);
    // днём тушь сажевая, к ночи становится серебряной: тёмное по тёмному не читается
    this.ensoInk = mix(mix({ r: 36, g: 32, b: 29 }, { r: 84, g: 54, b: 38 }, t.golden * 0.5), {
      r: 206,
      g: 214,
      b: 228,
    }, night * 0.72);
  }

  private strokeEnso(g: Ctx, progress: number): void {
    const pts = this.enso;
    const n = Math.max(2, Math.floor(pts.length * clamp01(progress)));
    g.save();
    g.lineCap = 'round';
    g.lineJoin = 'round';
    // растёк: широкая бледная тень под мазком — тушь ушла в бумагу
    for (let i = 1; i < n; i++) {
      const a = pts[i - 1];
      const b = pts[i];
      g.strokeStyle = css(this.ensoInk, 0.07);
      g.lineWidth = b.w * 1.8;
      g.beginPath();
      g.moveTo(a.x, a.y);
      g.lineTo(b.x, b.y);
      g.stroke();
    }
    for (let i = 1; i < n; i++) {
      const k = i / pts.length;
      const a = pts[i - 1];
      const b = pts[i];
      // сухой конец: тушь кончается, остаются прожилины
      const dry = k > 0.72 ? (k - 0.72) / 0.28 : 0;
      g.strokeStyle = css(this.ensoInk, lerp(0.82, 0.4, dry));
      g.lineWidth = Math.max(1, b.w);
      g.beginPath();
      g.moveTo(a.x, a.y);
      g.lineTo(b.x, b.y);
      g.stroke();
      if (dry > 0.25 && i % 3 === 0) {
        g.strokeStyle = css(this.ensoInk, 0.16);
        g.lineWidth = Math.max(0.6, b.w * 0.3);
        g.beginPath();
        g.moveTo(a.x + b.w * 0.32, a.y - b.w * 0.2);
        g.lineTo(b.x + b.w * 0.32, b.y - b.w * 0.2);
        g.stroke();
      }
    }
    g.restore();
  }

  // ---------------- Воздух ----------------

  private buildPetals(W: number, H: number, t: TimeState): void {
    this.petals = [];
    if (!this.opts.particles) return;
    const season = seasonBlend(t).from;
    const count = season === 'summer' ? 8 : 22;
    const rnd = makeRng(4242);
    const s = Math.min(W, H) / 860;
    for (let i = 0; i < count; i++) {
      this.petals.push({
        x: rnd() * W,
        y: rnd() * H,
        vx: (8 + rnd() * 16) * s,
        vy: (12 + rnd() * 20) * s,
        r: (2 + rnd() * 2.6) * Math.max(1, s),
        spin: rnd() * Math.PI,
        phase: rnd() * Math.PI * 2,
      });
    }
  }

  private buildBirds(W: number, H: number, t: TimeState): void {
    this.birds = [];
    if (!this.opts.motion || t.isNight) return;
    const rnd = makeRng(31);
    for (let i = 0; i < 2; i++) {
      this.birds.push({
        x: rnd() * W,
        y: H * (0.2 + rnd() * 0.14),
        v: (10 + rnd() * 8) * (Math.min(W, H) / 860),
        flap: rnd() * Math.PI * 2,
        s: 0.7 + rnd() * 0.6,
      });
    }
  }

  private petalColor(t: TimeState): RGB {
    const season = seasonBlend(t).from;
    if (season === 'winter') return { r: 250, g: 251, b: 252 };
    const c = SEASON_COLORS[season];
    if (season === 'autumn') return mix(c, { r: 240, g: 220, b: 190 }, 0.25);
    if (season === 'summer') return mix(c, { r: 250, g: 248, b: 220 }, 0.5);
    return c;
  }

  private drawPetals(g: Ctx, t: TimeState, dtMs: number): void {
    if (!this.opts.particles || !this.petals.length) return;
    const dt = Math.min(0.05, dtMs / 1000);
    const col = this.petalColor(t);
    const season = seasonBlend(t).from;
    const now = this.now;
    for (const p of this.petals) {
      p.x += (p.vx + Math.sin(now / 900 + p.phase) * 9) * dt;
      p.y += p.vy * dt * (season === 'winter' ? 0.7 : 1);
      if (p.y > this.h + 8) {
        p.y = -8;
        p.x = hash2(Math.round(p.x), Math.round(p.y), 7) * this.w;
      }
      if (p.x > this.w + 8) p.x = -8;
      g.save();
      g.translate(p.x, p.y);
      g.rotate(p.spin + now / 1400 + p.phase);
      g.fillStyle = css(col, season === 'winter' ? 0.75 : 0.6);
      g.beginPath();
      g.ellipse(0, 0, p.r, p.r * 0.62, 0, 0, Math.PI * 2);
      g.fill();
      g.restore();
    }
  }

  private drawBirds(g: Ctx, t: TimeState, dtMs: number): void {
    if (!this.birds.length) return;
    const dt = Math.min(0.05, dtMs / 1000);
    const ink = mix({ r: 70, g: 64, b: 58 }, { r: 230, g: 232, b: 236 }, 1 - clamp01(t.daylight * 1.6));
    for (const b of this.birds) {
      b.x += b.v * dt;
      if (b.x > this.w + 30) {
        b.x = -30;
        b.y = this.h * (0.18 + hash2(Math.round(b.y), 3, 5) * 0.16);
      }
      const flap = Math.sin(this.now / 260 + b.flap) * 0.5 + 0.5;
      const s = 11 * b.s * (Math.min(this.w, this.h) / 860);
      g.save();
      g.translate(b.x, b.y + Math.sin(this.now / 1700 + b.flap) * 4);
      g.strokeStyle = css(ink, 0.42);
      g.lineWidth = Math.max(1, s * 0.16);
      g.lineCap = 'round';
      g.beginPath();
      g.moveTo(-s, 0);
      g.quadraticCurveTo(-s * 0.4, -s * (0.35 + flap * 0.5), 0, 0);
      g.quadraticCurveTo(s * 0.4, -s * (0.35 + flap * 0.5), s, 0);
      g.stroke();
      g.restore();
    }
  }

  private drawFireflies(g: Ctx, now: number): void {
    for (let i = 0; i < 3; i++) {
      const fx = this.w * (0.2 + 0.24 * i) + Math.sin(now / 2600 + i * 2.1) * this.w * 0.05;
      const fy = this.h * (0.72 + 0.05 * Math.sin(now / 3100 + i));
      const tw = 0.35 + 0.65 * Math.abs(Math.sin(now / 1500 + i * 1.7));
      glow(g, fx, fy, 16 * (Math.min(this.w, this.h) / 860), { r: 244, g: 226, b: 150 }, 0.5 * tw);
    }
  }
}

/** Кроны ветви берут сезонный цвет из общей палитры мира. */
const SEASON_COLORS: Record<SeasonId, RGB> = {
  spring: SEASON_PALETTES.spring.blossom,
  summer: mix(SEASON_PALETTES.summer.foliage, SEASON_PALETTES.summer.foliageDeep, 0.4),
  autumn: SEASON_PALETTES.autumn.accent,
  winter: SEASON_PALETTES.winter.blossom,
};

function step2(W: number): number {
  return Math.max(8, W / 90);
}

/** Лёгкая зернистость внутри кроны — пигмент оседает неравномерно. */
function granulateLight(g: Ctx, cx: number, cy: number, r: number, color: RGB, seed: number): void {
  const rnd = makeRng(seed | 0 || 1);
  g.fillStyle = css(color, 0.22);
  for (let i = 0; i < 10; i++) {
    const a = rnd() * Math.PI * 2;
    const rr = Math.sqrt(rnd()) * r;
    g.beginPath();
    g.arc(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr * 0.8, 0.8 + rnd() * 1.4, 0, Math.PI * 2);
    g.fill();
  }
}
