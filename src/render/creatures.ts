/** Отрисовка живности: кот в разных позах и шубах, птицы по видам, бабочки, карпы. */

import { isoToScreen } from '../core/iso';
import { clamp01, hash2, lerp } from '../core/rng';
import { Atmosphere, RGB, css, mix, shade } from '../world/palette';
import { Bird, BirdSpecies, Cat, CatCoat, Fish, Flutter } from '../world/life';
import { World } from '../world/world';
import { Ctx, softShadow } from './paint';

function litc(c: RGB, atm: Atmosphere, boost = 0): RGB {
  return shade(mix(c, atm.lightTint, atm.lightAmount), atm.exposure + boost);
}

const WHITE: RGB = { r: 255, g: 255, b: 255 };

// ---------------- Кот ----------------

interface CoatColors {
  fur: RGB;
  furShade: RGB;
  /** Пятно: рыжее у светлого, медальон у чёрного, рыжая подпалина у черепахового. */
  patch: RGB;
  ink: RGB;
}

/**
 * Шубы котов: светлый с рыжим пятном (как прежде), серый, чёрный
 * с белым медальоном и черепаховый. Гость приходит в любой, кроме
 * светлой, — второго кота должно быть видно с первого взгляда.
 */
function coatColors(coat: CatCoat): CoatColors {
  switch (coat) {
    case 'grey':
      return {
        fur: { r: 172, g: 170, b: 168 },
        furShade: { r: 134, g: 132, b: 132 },
        patch: { r: 98, g: 96, b: 98 },
        ink: { r: 72, g: 68, b: 66 },
      };
    case 'black':
      return {
        fur: { r: 66, g: 62, b: 64 },
        furShade: { r: 46, g: 44, b: 48 },
        patch: { r: 238, g: 236, b: 230 },
        ink: { r: 32, g: 30, b: 32 },
      };
    case 'tortoise':
      return {
        fur: { r: 122, g: 90, b: 62 },
        furShade: { r: 90, g: 66, b: 48 },
        patch: { r: 232, g: 168, b: 110 },
        ink: { r: 62, g: 50, b: 42 },
      };
    default:
      return {
        fur: { r: 247, g: 240, b: 229 },
        furShade: { r: 214, g: 198, b: 180 },
        patch: { r: 184, g: 134, b: 96 },
        ink: { r: 108, g: 92, b: 82 },
      };
  }
}

/**
 * Кот рисуется из частей, чтобы позы отличались по силуэту:
 * спит калачиком, сидит столбиком, идёт, умывается, потягивается.
 */
export function drawCat(ctx: Ctx, cat: Cat, x: number, y: number, atm: Atmosphere, time: number): void {
  const coat = coatColors(cat.coat ?? 'cream');
  const fur = litc(coat.fur, atm);
  const furShade = litc(coat.furShade, atm);
  const patch = litc(coat.patch, atm);
  const ink = litc(coat.ink, atm);
  const pink = litc({ r: 232, g: 172, b: 172 }, atm);
  const f = cat.facing;

  ctx.save();
  ctx.translate(x, y);
  ctx.scale(f, 1);

  const breathe = Math.sin(time * 0.0016 + cat.seed) * 0.7;

  switch (cat.state) {
    case 'sleep':
      drawCatSleeping(ctx, atm, fur, furShade, patch, ink, breathe, cat, time);
      break;
    case 'loaf':
      drawCatLoaf(ctx, atm, fur, furShade, patch, ink, pink, breathe);
      break;
    case 'sit':
      drawCatSitting(ctx, atm, fur, furShade, patch, ink, pink, cat, time, false);
      break;
    case 'wash':
      drawCatSitting(ctx, atm, fur, furShade, patch, ink, pink, cat, time, true);
      break;
    case 'stretch':
      drawCatStretch(ctx, atm, fur, furShade, patch, ink, cat);
      break;
    case 'walk':
      drawCatWalking(ctx, atm, fur, furShade, patch, ink, pink, cat, time);
      break;
  }

  ctx.restore();
}

function catShadow(ctx: Ctx, atm: Atmosphere, rx: number, ry: number, ox = 0): void {
  ctx.save();
  ctx.globalCompositeOperation = 'multiply';
  softShadow(ctx, ox, 0, rx, ry, atm.shadowTint, atm.shadowAmount * 1.7);
  ctx.restore();
}

function catHead(
  ctx: Ctx,
  hx: number,
  hy: number,
  r: number,
  fur: RGB,
  ink: RGB,
  pink: RGB,
  eyesOpen: boolean,
  atm: Atmosphere,
): void {
  // уши
  ctx.fillStyle = css(fur, 0.98);
  ctx.beginPath();
  ctx.moveTo(hx - r * 0.85, hy - r * 0.45);
  ctx.lineTo(hx - r * 0.55, hy - r * 1.42);
  ctx.lineTo(hx - r * 0.12, hy - r * 0.7);
  ctx.closePath();
  ctx.moveTo(hx + r * 0.2, hy - r * 0.7);
  ctx.lineTo(hx + r * 0.62, hy - r * 1.42);
  ctx.lineTo(hx + r * 0.88, hy - r * 0.45);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = css(pink, 0.75);
  ctx.beginPath();
  ctx.moveTo(hx - r * 0.68, hy - r * 0.6);
  ctx.lineTo(hx - r * 0.52, hy - r * 1.14);
  ctx.lineTo(hx - r * 0.3, hy - r * 0.68);
  ctx.closePath();
  ctx.fill();

  // голова
  ctx.fillStyle = css(fur, 0.99);
  ctx.beginPath();
  ctx.ellipse(hx, hy, r, r * 0.9, 0, 0, Math.PI * 2);
  ctx.fill();

  // глаза
  ctx.strokeStyle = css(ink, 0.9);
  ctx.lineWidth = Math.max(1, r * 0.16);
  if (eyesOpen) {
    ctx.fillStyle = css(litc({ r: 132, g: 164, b: 120 }, atm), 0.95);
    for (const ox of [-r * 0.42, r * 0.34]) {
      ctx.beginPath();
      ctx.ellipse(hx + ox, hy - r * 0.05, r * 0.19, r * 0.24, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = css(ink, 0.9);
    for (const ox of [-r * 0.42, r * 0.34]) {
      ctx.beginPath();
      ctx.ellipse(hx + ox, hy - r * 0.05, r * 0.07, r * 0.2, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  } else {
    for (const ox of [-r * 0.42, r * 0.34]) {
      ctx.beginPath();
      ctx.arc(hx + ox, hy - r * 0.06, r * 0.24, 0.3, Math.PI - 0.3);
      ctx.stroke();
    }
  }

  // нос и рот
  ctx.fillStyle = css(pink, 0.95);
  ctx.beginPath();
  ctx.moveTo(hx - r * 0.16, hy + r * 0.28);
  ctx.lineTo(hx + r * 0.16, hy + r * 0.28);
  ctx.lineTo(hx, hy + r * 0.48);
  ctx.closePath();
  ctx.fill();

  // усы
  ctx.strokeStyle = css(mix(ink, WHITE, 0.5), 0.5);
  ctx.lineWidth = Math.max(0.6, r * 0.07);
  for (let i = -1; i <= 1; i++) {
    ctx.beginPath();
    ctx.moveTo(hx - r * 0.2, hy + r * 0.3);
    ctx.lineTo(hx - r * 1.5, hy + r * 0.1 + i * r * 0.3);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(hx + r * 0.2, hy + r * 0.3);
    ctx.lineTo(hx + r * 1.5, hy + r * 0.1 + i * r * 0.3);
    ctx.stroke();
  }
}

function drawCatSleeping(
  ctx: Ctx,
  atm: Atmosphere,
  fur: RGB,
  furShade: RGB,
  patch: RGB,
  ink: RGB,
  breathe: number,
  cat: Cat,
  time: number,
): void {
  catShadow(ctx, atm, 21, 8);
  // калачик: круглое тело, хвост обнимает
  ctx.strokeStyle = css(furShade, 0.95);
  ctx.lineWidth = 5.5;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.arc(2, -7, 15, -0.2, 2.5);
  ctx.stroke();
  ctx.lineCap = 'butt';

  ctx.fillStyle = css(fur, 0.98);
  ctx.beginPath();
  ctx.ellipse(0, -8 + breathe * 0.3, 17, 11 + breathe * 0.4, -0.06, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = css(patch, 0.45);
  ctx.beginPath();
  ctx.ellipse(5, -11, 8, 4.6, -0.25, 0, Math.PI * 2);
  ctx.fill();

  // голова уткнулась в бок
  catHead(ctx, -11, -11, 7, fur, ink, litc({ r: 232, g: 172, b: 172 }, atm), false, atm);

  // «z z z»
  const tz = (time * 0.0005 + cat.seed) % 1;
  ctx.fillStyle = css(litc({ r: 252, g: 250, b: 244 }, atm), 0.32 * (1 - tz));
  ctx.font = 'italic 12px Georgia, serif';
  ctx.save();
  ctx.scale(cat.facing, 1);
  ctx.fillText('z', cat.facing * -6 + 8, -26 - tz * 14);
  ctx.restore();
}

function drawCatLoaf(
  ctx: Ctx,
  atm: Atmosphere,
  fur: RGB,
  furShade: RGB,
  patch: RGB,
  ink: RGB,
  pink: RGB,
  breathe: number,
): void {
  catShadow(ctx, atm, 19, 7);
  // «булочка»: лапы подобраны
  ctx.fillStyle = css(furShade, 0.9);
  ctx.beginPath();
  ctx.ellipse(6, -4, 15, 7, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = css(fur, 0.98);
  ctx.beginPath();
  ctx.ellipse(1, -10 + breathe * 0.3, 15, 10 + breathe * 0.4, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = css(patch, 0.4);
  ctx.beginPath();
  ctx.ellipse(6, -12, 7, 4, -0.2, 0, Math.PI * 2);
  ctx.fill();
  catHead(ctx, -11, -16, 7.5, fur, ink, pink, false, atm);
  // сложенные лапки
  ctx.fillStyle = css(fur, 0.96);
  ctx.beginPath();
  ctx.ellipse(-9, -3, 6, 2.8, 0, 0, Math.PI * 2);
  ctx.fill();
}

function drawCatSitting(
  ctx: Ctx,
  atm: Atmosphere,
  fur: RGB,
  furShade: RGB,
  patch: RGB,
  ink: RGB,
  pink: RGB,
  cat: Cat,
  time: number,
  washing: boolean,
): void {
  catShadow(ctx, atm, 15, 6);
  // хвост обвивает лапы
  const tailWag = Math.sin(time * 0.0012 + cat.seed) * 4;
  ctx.strokeStyle = css(furShade, 0.95);
  ctx.lineWidth = 5;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(8, -3);
  ctx.quadraticCurveTo(20, -2 + tailWag * 0.3, 22 + tailWag * 0.4, -12);
  ctx.stroke();
  ctx.lineCap = 'butt';

  // тело столбиком
  ctx.fillStyle = css(fur, 0.98);
  ctx.beginPath();
  ctx.moveTo(-9, 0);
  ctx.quadraticCurveTo(-12, -20, -6, -27);
  ctx.quadraticCurveTo(2, -32, 8, -24);
  ctx.quadraticCurveTo(12, -12, 11, 0);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = css(patch, 0.32);
  ctx.beginPath();
  ctx.ellipse(3, -16, 5.5, 8, 0.2, 0, Math.PI * 2);
  ctx.fill();

  // передние лапы
  ctx.fillStyle = css(fur, 0.97);
  for (const ox of [-5, 2]) {
    ctx.beginPath();
    ctx.ellipse(ox, -1.5, 4, 2.6, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  const headY = -34;
  // шея
  ctx.fillStyle = css(fur, 0.98);
  ctx.beginPath();
  ctx.ellipse(-1, -27, 6.2, 5.4, 0, 0, Math.PI * 2);
  ctx.fill();
  if (washing) {
    // умывается: голова наклонена, лапа поднята
    const lick = Math.sin(time * 0.009 + cat.seed) * 3;
    ctx.save();
    ctx.translate(-2, headY);
    ctx.rotate(0.35);
    catHead(ctx, 0, 0, 8.5, fur, ink, pink, false, atm);
    ctx.restore();
    ctx.fillStyle = css(fur, 0.98);
    ctx.beginPath();
    ctx.ellipse(-8, headY + 8 + lick * 0.4, 4.4, 3, -0.5, 0, Math.PI * 2);
    ctx.fill();
  } else {
    // сидит, изредка моргает и водит ушами
    const blink = Math.sin(time * 0.0007 + cat.seed * 3) > 0.985;
    catHead(ctx, -1, headY, 8.5, fur, ink, pink, !blink, atm);
  }
}

function drawCatStretch(ctx: Ctx, atm: Atmosphere, fur: RGB, furShade: RGB, patch: RGB, ink: RGB, cat: Cat): void {
  catShadow(ctx, atm, 22, 7);
  const k = clamp01(cat.phase * 1.4);
  const arch = Math.sin(k * Math.PI) * 7;
  // хвост трубой
  ctx.strokeStyle = css(furShade, 0.95);
  ctx.lineWidth = 5;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(14, -6);
  ctx.quadraticCurveTo(24, -10, 25, -22 - arch);
  ctx.stroke();
  ctx.lineCap = 'butt';
  // вытянутое тело с прогибом
  ctx.fillStyle = css(fur, 0.98);
  ctx.beginPath();
  ctx.moveTo(-16, -4);
  ctx.quadraticCurveTo(-2, -14 - arch, 14, -6);
  ctx.quadraticCurveTo(2, 0, -16, -4);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = css(patch, 0.35);
  ctx.beginPath();
  ctx.ellipse(3, -8 - arch * 0.5, 6, 3, -0.2, 0, Math.PI * 2);
  ctx.fill();
  // передние лапы вытянуты вперёд
  ctx.strokeStyle = css(fur, 0.96);
  ctx.lineWidth = 4;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-14, -4);
  ctx.lineTo(-24, 0);
  ctx.stroke();
  ctx.lineCap = 'butt';
  ctx.fillStyle = css(fur, 0.97);
  ctx.beginPath();
  ctx.ellipse(-13, -6, 6, 4.2, -0.2, 0, Math.PI * 2);
  ctx.fill();
  catHead(ctx, -20, -8, 7.2, fur, ink, litc({ r: 232, g: 172, b: 172 }, atm), false, atm);
}

function drawCatWalking(
  ctx: Ctx,
  atm: Atmosphere,
  fur: RGB,
  furShade: RGB,
  patch: RGB,
  ink: RGB,
  pink: RGB,
  cat: Cat,
  time: number,
): void {
  catShadow(ctx, atm, 19, 6);
  const gait = time * 0.009 + cat.seed;
  const bob = Math.sin(gait * 2) * 0.9;

  // хвост поднят и покачивается
  const tail = Math.sin(gait * 0.8) * 5;
  ctx.strokeStyle = css(furShade, 0.95);
  ctx.lineWidth = 4.6;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(12, -11);
  ctx.quadraticCurveTo(20, -18, 19 + tail * 0.5, -28 + tail * 0.4);
  ctx.stroke();

  // лапы: две пары в противофазе
  ctx.strokeStyle = css(furShade, 0.92);
  ctx.lineWidth = 3.4;
  for (let i = 0; i < 4; i++) {
    const ph = gait + (i % 2) * Math.PI + (i < 2 ? 0 : 0.7);
    const ox = i < 2 ? -7 + i * 3 : 7 - (i - 2) * 3;
    const swing = Math.sin(ph) * 3.4;
    ctx.beginPath();
    ctx.moveTo(ox, -10 + bob);
    ctx.lineTo(ox + swing, -0.5);
    ctx.stroke();
  }
  ctx.lineCap = 'butt';

  // тело
  ctx.fillStyle = css(fur, 0.98);
  ctx.beginPath();
  ctx.ellipse(2, -13 + bob, 13.5, 7, -0.05, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = css(patch, 0.4);
  ctx.beginPath();
  ctx.ellipse(6, -15 + bob, 6.5, 3.6, -0.15, 0, Math.PI * 2);
  ctx.fill();

  // шея — связывает голову с корпусом
  ctx.fillStyle = css(fur, 0.98);
  ctx.beginPath();
  ctx.ellipse(-9, -17 + bob, 5.5, 4.6, -0.5, 0, Math.PI * 2);
  ctx.fill();

  catHead(ctx, -15, -23 + bob, 7.6, fur, ink, pink, true, atm);
}

// ---------------- Птицы ----------------

/** Окрас и приметы вида: состав стаи меняется с сезоном. */
interface SpeciesLook {
  body: RGB;
  belly: RGB;
  /** Шапочка, щёка и полоса на крыле — то, по чему вид узнаётся издали. */
  cap: RGB | null;
  cheek: RGB | null;
  bar: RGB | null;
  /** Длинный хвост трясогузки качается даже на месте. */
  longTail: boolean;
}

const SPECIES: Record<BirdSpecies, SpeciesLook> = {
  sparrow: {
    body: { r: 122, g: 106, b: 96 },
    belly: { r: 238, g: 232, b: 220 },
    cap: { r: 148, g: 142, b: 132 },
    cheek: null,
    bar: null,
    longTail: false,
  },
  tit: {
    body: { r: 148, g: 156, b: 98 },
    belly: { r: 236, g: 214, b: 120 },
    cap: { r: 42, g: 42, b: 48 },
    cheek: { r: 246, g: 244, b: 238 },
    bar: { r: 240, g: 240, b: 234 },
    longTail: false,
  },
  finch: {
    body: { r: 152, g: 128, b: 96 },
    belly: { r: 240, g: 232, b: 214 },
    cap: { r: 46, g: 42, b: 40 },
    cheek: { r: 198, g: 82, b: 70 },
    bar: { r: 232, g: 204, b: 80 },
    longTail: false,
  },
  wagtail: {
    body: { r: 176, g: 178, b: 180 },
    belly: { r: 246, g: 246, b: 242 },
    cap: { r: 52, g: 52, b: 56 },
    cheek: { r: 246, g: 246, b: 242 },
    bar: { r: 246, g: 246, b: 242 },
    longTail: true,
  },
  bullfinch: {
    body: { r: 150, g: 150, b: 158 },
    belly: { r: 198, g: 88, b: 84 },
    cap: { r: 36, g: 34, b: 38 },
    cheek: null,
    bar: { r: 236, g: 236, b: 240 },
    longTail: false,
  },
};

/**
 * Птица: земляной прыгун, гость кормушки или купальщик поилки.
 * Позы читаются по силуэту: на кормушке сидит столбиком и клюёт в лоток,
 * у поилки тянется к воде и полощется, на земле скачет и клюёт.
 */
export function drawBird(ctx: Ctx, bird: Bird, x: number, y: number, atm: Atmosphere, time: number): void {
  const sp = SPECIES[bird.species] ?? SPECIES.sparrow;
  // Птица — мелочь рядом с вещами сада: футон больше воробья во много раз
  const s = bird.scale * 0.62;
  const body = litc(sp.body, atm);
  const belly = litc(sp.belly, atm);
  const beak = litc({ r: 226, g: 176, b: 96 }, atm);
  const flying = bird.state === 'fly-in' || bird.state === 'fly-out';
  const perched = bird.state === 'perch' || bird.state === 'feed';
  const atWater = bird.state === 'drink' || bird.state === 'bathe';
  const bathing = bird.state === 'bathe';
  const hopBob = bird.state === 'hop' ? Math.abs(Math.sin(bird.hop)) * 4 : 0;
  const dip =
    bird.state === 'peck' || bird.state === 'feed' || bird.state === 'drink'
      ? Math.abs(Math.sin(time * 0.012 + bird.seed)) * 0.55
      : 0;

  // тень — только когда птица у земли или на насесте невысоко
  if (bird.alt < 40) {
    ctx.save();
    ctx.globalCompositeOperation = 'multiply';
    softShadow(ctx, x, y, 9 * s, 3.4 * s, atm.shadowTint, atm.shadowAmount * 1.4 * (1 - bird.alt / 40));
    ctx.restore();
  }

  ctx.save();
  ctx.translate(x, y - bird.alt - hopBob);
  ctx.scale(bird.facing * s, s);
  // на кормушке сидит столбиком, у воды наклоняется
  ctx.rotate(perched ? -0.22 : atWater ? 0.16 : 0);
  ctx.rotate(dip * 0.5);

  // хвост: у трясогузки длинный и качается
  const wag = sp.longTail && !flying ? Math.sin(time * 0.012 + bird.seed) * 0.22 : 0;
  ctx.save();
  ctx.translate(-5, -6);
  ctx.rotate(wag);
  ctx.fillStyle = css(shade(body, 0.85), 0.95);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(-(sp.longTail ? 17 : 8), -2 - (flying ? 2 : 0));
  ctx.lineTo(-(sp.longTail ? 16 : 7), 2);
  ctx.closePath();
  ctx.fill();
  if (sp.longTail) {
    ctx.strokeStyle = css(litc({ r: 246, g: 246, b: 242 }, atm), 0.8);
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(-4, -1.4);
    ctx.lineTo(-16, -1.6);
    ctx.stroke();
  }
  ctx.restore();

  // купание: крылья трепещут и брызги вокруг
  const flap = flying
    ? Math.sin(time * 0.03 + bird.seed) * 0.9
    : bathing
      ? Math.sin(time * 0.05 + bird.seed) * 0.8
      : 0.1;

  // тело
  ctx.fillStyle = css(body, 0.97);
  ctx.beginPath();
  ctx.ellipse(0, -7, 7.5, 5.4, -0.12, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = css(belly, 0.75);
  ctx.beginPath();
  ctx.ellipse(1, -5.4, 5, 3.4, -0.1, 0, Math.PI * 2);
  ctx.fill();

  // крыло с полосой у синицы и щегла
  ctx.save();
  ctx.translate(0, -8);
  ctx.rotate(-flap * 0.8);
  ctx.fillStyle = css(shade(body, 0.9), 0.95);
  ctx.beginPath();
  ctx.ellipse(-1, 0, 6.5, 2.8, 0.2, 0, Math.PI * 2);
  ctx.fill();
  if (sp.bar) {
    ctx.fillStyle = css(litc(sp.bar, atm), 0.85);
    ctx.beginPath();
    ctx.ellipse(-1.4, 0.8, 5.2, 0.9, 0.2, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  // голова с шапочкой и щекой
  ctx.fillStyle = css(body, 0.98);
  ctx.beginPath();
  ctx.arc(6.5, -11, 3.8, 0, Math.PI * 2);
  ctx.fill();
  if (sp.cheek) {
    ctx.fillStyle = css(litc(sp.cheek, atm), 0.9);
    ctx.beginPath();
    ctx.ellipse(6.8, -10.2, 2.1, 1.7, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  if (sp.cap) {
    ctx.fillStyle = css(litc(sp.cap, atm), 0.95);
    ctx.beginPath();
    ctx.ellipse(6.4, -12.6, 3.5, 1.9, -0.12, Math.PI, Math.PI * 2);
    ctx.fill();
    // нагрудный ремешок синицы
    if (bird.species === 'tit') {
      ctx.fillStyle = css(litc(sp.cap, atm), 0.8);
      ctx.beginPath();
      ctx.ellipse(2.6, -5.2, 1.1, 2.6, 0.2, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  // клюв
  ctx.fillStyle = css(beak, 0.97);
  ctx.beginPath();
  ctx.moveTo(9.6, -11.4);
  ctx.lineTo(14, -10.2);
  ctx.lineTo(9.6, -9.4);
  ctx.closePath();
  ctx.fill();
  // глаз
  ctx.fillStyle = css({ r: 30, g: 26, b: 24 }, 0.9);
  ctx.beginPath();
  ctx.arc(7.6, -12, 0.9, 0, Math.PI * 2);
  ctx.fill();

  // лапки: на земле и на насесте
  if (!flying) {
    ctx.strokeStyle = css(beak, 0.85);
    ctx.lineWidth = 1;
    for (const ox of [-1, 2]) {
      ctx.beginPath();
      ctx.moveTo(ox, -2.6);
      ctx.lineTo(ox, perched ? 0.6 : 0);
      ctx.stroke();
    }
  }

  // брызги купания
  if (bathing) {
    ctx.strokeStyle = css(litc({ r: 236, g: 244, b: 246 }, atm), 0.5);
    ctx.lineWidth = 0.8;
    for (let i = 0; i < 3; i++) {
      const a = time * 0.02 + i * 2.1 + bird.seed;
      const dx = Math.cos(a) * 8;
      const dy = -Math.abs(Math.sin(a)) * 5;
      ctx.beginPath();
      ctx.moveTo(dx, -4 + dy);
      ctx.lineTo(dx + 1, -3 + dy);
      ctx.stroke();
    }
  }
  ctx.restore();
}

// ---------------- Бабочки ----------------

/** Бабочка порхает у цветов; стрекозы теперь живут у пруда (render/residents.ts). */
export function drawButterfly(ctx: Ctx, f: Flutter, x: number, y: number, atm: Atmosphere, time: number): void {
  const yy = y - f.alt;
  // тень-точка на земле
  ctx.save();
  ctx.globalCompositeOperation = 'multiply';
  softShadow(ctx, x, y, 4, 1.6, atm.shadowTint, atm.shadowAmount * 0.8);
  ctx.restore();

  const hue = hash2(Math.floor(f.seed), 1, 3);
  const wing = litc(
    hue > 0.66 ? { r: 252, g: 236, b: 186 } : hue > 0.33 ? { r: 246, g: 202, b: 216 } : { r: 206, g: 218, b: 246 },
    atm,
    0.05,
  );
  const wingDeep = litc(
    shade(
      hue > 0.66 ? { r: 236, g: 196, b: 120 } : hue > 0.33 ? { r: 226, g: 158, b: 182 } : { r: 160, g: 180, b: 226 },
      1,
    ),
    atm,
  );
  const ink = litc({ r: 92, g: 74, b: 68 }, atm);

  // Взмах: крылья почти смыкаются, потом раскрываются — видно по ширине
  const flap = f.resting > 0 ? 0.82 : Math.abs(Math.sin(time * 0.016 + f.seed));
  const open = 0.16 + flap * 0.84;
  const dir = Math.atan2(f.vy, f.vx);

  ctx.save();
  ctx.translate(x, yy);
  ctx.rotate(dir * 0.35);

  for (const side of [-1, 1]) {
    ctx.save();
    ctx.scale(side * open, 1);
    // верхнее крыло — каплевидное, с уголком
    ctx.beginPath();
    ctx.moveTo(0, -0.5);
    ctx.bezierCurveTo(2.5, -6.5, 8, -7.5, 8.6, -3.4);
    ctx.bezierCurveTo(9, -0.8, 5, 0.2, 0, 0.6);
    ctx.closePath();
    ctx.fillStyle = css(wing, 0.94);
    ctx.fill();
    ctx.strokeStyle = css(ink, 0.22);
    ctx.lineWidth = 0.5;
    ctx.stroke();
    // нижнее крыло — меньше и округлее
    ctx.beginPath();
    ctx.moveTo(0, 0.4);
    ctx.bezierCurveTo(4, 1.2, 6.6, 3.4, 4.6, 5.2);
    ctx.bezierCurveTo(2.6, 6.6, 0.4, 3.6, 0, 1);
    ctx.closePath();
    ctx.fillStyle = css(wingDeep, 0.9);
    ctx.fill();
    // светлое пятнышко на верхнем крыле
    ctx.fillStyle = css(mix(wing, WHITE, 0.55), 0.6);
    ctx.beginPath();
    ctx.ellipse(5.4, -3.6, 1.5, 1.1, 0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // тельце и усики
  ctx.fillStyle = css(ink, 0.9);
  ctx.beginPath();
  ctx.ellipse(0, 0.6, 0.85, 3.4, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = css(ink, 0.6);
  ctx.lineWidth = 0.45;
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(0, -2.6);
    ctx.quadraticCurveTo(side * 1.6, -4.6, side * 2.6, -5.2);
    ctx.stroke();
  }
  ctx.restore();
}

// ---------------- Карпы ----------------

export function drawFish(ctx: Ctx, fish: Fish, world: World, atm: Atmosphere, time: number): void {
  const t = world.at(Math.floor(fish.tx), Math.floor(fish.ty));
  if (!t?.water) return;
  const p = isoToScreen(fish.tx, fish.ty, t.level - 0.26);
  const kind = fish.seed % 3;
  const smart = fish.memoryStrength > 0.3 || fish.boldness > 0.6;
  const bodyBase =
    smart
      ? kind === 0
        ? { r: 240, g: 152, b: 92 }
        : kind === 1
          ? { r: 252, g: 250, b: 244 }
          : { r: 246, g: 210, b: 110 }
      : kind === 0
        ? { r: 240, g: 132, b: 82 }
        : kind === 1
          ? { r: 248, g: 246, b: 240 }
          : { r: 246, g: 200, b: 96 };
  const body = smart ? { r: bodyBase.r, g: bodyBase.g, b: bodyBase.b } : bodyBase;
  const c = litc(body, atm, smart ? 0.04 : 0);
  // изометрическое направление
  const sx = Math.cos(fish.dir);
  const sy = Math.sin(fish.dir);
  const ang = Math.atan2((sx + sy) * 0.5, (sx - sy) * 1.0);

  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(ang);

  // тень в глубине
  ctx.fillStyle = css(shade(atm.palette.waterDeep, 0.75), 0.22);
  ctx.beginPath();
  ctx.ellipse(1.5, 2.5, 10, 4, 0, 0, Math.PI * 2);
  ctx.fill();

  const wag = Math.sin(time * 0.006 + fish.seed) * 0.55;
  // хвост
  ctx.fillStyle = css(c, 0.48);
  ctx.beginPath();
  ctx.moveTo(-7, 0);
  ctx.quadraticCurveTo(-12, -3 + wag * 3, -15, -4.5 + wag * 4);
  ctx.quadraticCurveTo(-11, 0, -15, 4.5 + wag * 4);
  ctx.quadraticCurveTo(-12, 3 + wag * 3, -7, 0);
  ctx.fill();
  // плавники
  ctx.fillStyle = css(c, 0.4);
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(-1, side * 3, 4, 1.6, side * 0.5 + wag * 0.3, 0, Math.PI * 2);
    ctx.fill();
  }
  // тело
  ctx.fillStyle = css(c, 0.82);
  ctx.beginPath();
  ctx.ellipse(0, 0, 9, 3.6, 0, 0, Math.PI * 2);
  ctx.fill();
  // пятна
  const spot = litc(kind === 1 ? { r: 232, g: 112, b: 86 } : { r: 252, g: 250, b: 246 }, atm);
  ctx.fillStyle = css(spot, 0.7);
  ctx.beginPath();
  ctx.ellipse(2.5, -0.4, 3, 1.7, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(-3, 0.6, 1.8, 1.1, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // умные кои: пузырьки при кормлении, более яркие
  if (fish.state === 'feed') {
    const b = Math.sin(time * 0.008 + fish.seed) * 0.5 + 0.5;
    ctx.fillStyle = css(mix(atm.palette.water, WHITE, 0.7), 0.35 * b);
    ctx.beginPath();
    ctx.arc(p.x + 2, p.y - 2 - b * 3, 1.2 + b, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(p.x - 1, p.y - 1 - b * 2, 0.8 + b * 0.5, 0, Math.PI * 2);
    ctx.fill();
  }

  // круги на воде, когда карп у поверхности
  const near = Math.sin(time * 0.0009 + fish.seed) > 0.75;
  if (near) {
    const k = (Math.sin(time * 0.0009 + fish.seed) - 0.75) / 0.25;
    ctx.strokeStyle = css(mix(atm.palette.water, WHITE, 0.65), 0.22 * (1 - k));
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.ellipse(p.x, p.y, 6 + k * 16, 3 + k * 8, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
}

export { lerp };
