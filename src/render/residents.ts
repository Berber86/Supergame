/**
 * Отрисовка жителей воды: лягушка, стрекоза, круги на воде.
 * Та же акварельная кисть, что и весь сад: пятна с тёмной кромкой,
 * никаких растровых ассетов. Силуэты читаются на общем плане и
 * различимы вблизи — большего от мелочи не нужно.
 */

import { Atmosphere, RGB, css, mix, shade } from '../world/palette';
import { Frog, PondDragonfly, Ripple } from '../world/residents';
import { Ctx, glow, softShadow, washBlob } from './paint';

function litc(c: RGB, atm: Atmosphere, boost = 0): RGB {
  return shade(mix(c, atm.lightTint, atm.lightAmount), atm.exposure + boost);
}

// ---------------- Лягушка ----------------

export function drawFrog(ctx: Ctx, f: Frog, x: number, y: number, atm: Atmosphere, time: number): void {
  const s = f.size;
  // выход из воды и нырок: силуэт проявляется и гаснет
  let alpha = 1;
  let lift = 0;
  if (f.state === 'emerge') {
    alpha = 0.35 + f.phase * 0.65;
    lift = (1 - f.phase) * 3;
  } else if (f.state === 'dive') {
    alpha = 1 - f.phase;
    lift = f.phase * 4;
  }
  if (f.hidden > 0 || alpha <= 0.02) return;

  const green = f.species === 'green';
  const back = litc(green ? { r: 118, g: 152, b: 88 } : { r: 134, g: 116, b: 86 }, atm);
  const backDeep = litc(shade(green ? { r: 92, g: 126, b: 70 } : { r: 106, g: 90, b: 66 }, 1), atm);
  const belly = litc({ r: 226, g: 228, b: 196 }, atm);
  const ink = litc({ r: 64, g: 58, b: 48 }, atm);
  const gold = litc({ r: 214, g: 168, b: 74 }, atm);

  // прыжок: дуга и вытянутый силуэт
  const hop = f.state === 'hop' ? Math.sin(f.phase * Math.PI) : 0;
  const squash = f.state === 'hop' ? 1 + hop * 0.25 : f.state === 'sit' || f.state === 'call' ? 1 : 0.9;

  ctx.save();
  ctx.globalAlpha = alpha;

  // тень на берегу
  ctx.save();
  ctx.globalCompositeOperation = 'multiply';
  softShadow(ctx, x, y, 7 * s, 2.6 * s, atm.shadowTint, atm.shadowAmount * 1.3 * (1 - hop * 0.7));
  ctx.restore();

  ctx.translate(x, y - lift - hop * 7 * s);
  ctx.scale(f.facing * s * (2 - squash) * 0.5 + f.facing * s * 0.5, s * squash);

  // задние лапы — сложенные «бёдра»
  ctx.fillStyle = css(backDeep, 0.9);
  ctx.beginPath();
  ctx.ellipse(-3.4, -3.2, 3.6, 3.1, -0.3, 0, Math.PI * 2);
  ctx.fill();

  // тело
  washBlob(ctx, 0, -3.4, 6.4, 3.6, back, Math.floor(f.seed), { layers: 2, alpha: 0.92, edge: 0.3, wobble: 0.12 });

  // брюшко
  ctx.fillStyle = css(belly, 0.5);
  ctx.beginPath();
  ctx.ellipse(0.6, -1.8, 4.4, 1.7, 0, 0, Math.PI * 2);
  ctx.fill();

  // пятна на спине
  ctx.fillStyle = css(backDeep, 0.5);
  for (const [ox, oy, r] of [
    [-1.6, -4.4, 1.1],
    [1.8, -3.6, 0.9],
    [-3.6, -4.6, 0.8],
  ]) {
    ctx.beginPath();
    ctx.ellipse(ox, oy, r, r * 0.7, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // горло при пении: пузырь дрожит и светлеет
  if (f.throat > 0.02) {
    const th = f.throat;
    ctx.fillStyle = css(mix(belly, { r: 250, g: 250, b: 236 }, 0.4), 0.55 + th * 0.3);
    ctx.beginPath();
    ctx.ellipse(3.4, -1.6 + th * 0.8, 1.6 + th * 2.2, 1.2 + th * 1.8, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // голова и глаза-бусины на макушке
  ctx.fillStyle = css(back, 0.95);
  ctx.beginPath();
  ctx.ellipse(4.2, -4.4, 3.1, 2.5, 0.1, 0, Math.PI * 2);
  ctx.fill();
  for (const [ox, oy] of [
    [3.2, -6.2],
    [5.4, -6.0],
  ]) {
    ctx.fillStyle = css(backDeep, 0.95);
    ctx.beginPath();
    ctx.arc(ox, oy, 1.5, 0, Math.PI * 2);
    ctx.fill();
    // моргает редко и по-лягушачьи быстро
    const blink = Math.sin(time * 0.0007 + f.seed * 3) > 0.985 ? 0.15 : 1;
    ctx.fillStyle = css(gold, 0.95);
    ctx.beginPath();
    ctx.ellipse(ox, oy, 1.05, 1.05 * blink, 0, 0, Math.PI * 2);
    ctx.fill();
    if (blink > 0.5) {
      ctx.fillStyle = css(ink, 0.95);
      ctx.beginPath();
      ctx.ellipse(ox + 0.25, oy, 0.42, 0.72, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // передние лапки
  ctx.strokeStyle = css(backDeep, 0.85);
  ctx.lineWidth = 1.1;
  ctx.lineCap = 'round';
  for (const ox of [3.6, 5.2]) {
    ctx.beginPath();
    ctx.moveTo(ox, -1.6);
    ctx.lineTo(ox + 0.7, 0);
    ctx.stroke();
  }

  ctx.restore();
}

// ---------------- Стрекоза ----------------

export function drawDragonfly(ctx: Ctx, d: PondDragonfly, x: number, y: number, atm: Atmosphere, time: number): void {
  const yy = y - d.alt;
  const perched = d.state === 'perch';
  const hawker = d.kind === 'hawker';

  // тень-точка на воде или земле
  ctx.save();
  ctx.globalCompositeOperation = 'multiply';
  softShadow(ctx, x, y, hawker ? 4.4 : 3.2, 1.6, atm.shadowTint, atm.shadowAmount * 0.7);
  ctx.restore();

  const body = litc(hawker ? { r: 92, g: 148, b: 168 } : { r: 128, g: 164, b: 118 }, atm, 0.04);
  const bodyDeep = litc(shade(hawker ? { r: 58, g: 104, b: 128 } : { r: 88, g: 122, b: 84 }, 1), atm);
  const wing = litc({ r: 238, g: 246, b: 250 }, atm);

  ctx.save();
  ctx.translate(x, yy);

  if (perched) {
    // Сидит: коромысло держит крылья пластом, стрелка складывает их вдоль тела
    const up = hawker ? -0.5 : -1.15;
    ctx.rotate(up * (d.facing >= 0 ? 1 : -1) * 0.6);
    ctx.scale(d.facing, 1);
    if (!hawker) {
      // сложенные крылья — две нити вдоль тела
      ctx.strokeStyle = css(wing, 0.5);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(-2, -1.4);
      ctx.lineTo(-12, -2.6);
      ctx.moveTo(-2, -0.6);
      ctx.lineTo(-11.4, -1.4);
      ctx.stroke();
    } else {
      const blur = 0.4;
      ctx.fillStyle = css(wing, blur * 0.5);
      for (const side of [-1, 1]) {
        ctx.beginPath();
        ctx.ellipse(0, side * 2.4, 7.4, 1.9, side * 0.14, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(-3, side * 2.1, 5.8, 1.5, side * 0.2, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    drawDragonflyBody(ctx, body, bodyDeep, hawker);
    ctx.restore();
    return;
  }

  // Полёт: поворот по скорости, крылья мерцают
  const dir = Math.atan2(d.vy, d.vx);
  ctx.rotate(Math.abs(dir) > Math.PI / 2 ? dir + Math.PI : dir);
  const blur = 0.32 + Math.abs(Math.sin(time * 0.055 + d.seed)) * 0.3;
  ctx.fillStyle = css(wing, blur * 0.55);
  const wl = hawker ? 1 : 0.8;
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(1, side * 2.2 * wl, 7.2 * wl, 1.8, side * 0.16, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(-2.6, side * 2 * wl, 5.6 * wl, 1.5, side * 0.2, 0, Math.PI * 2);
    ctx.fill();
  }
  drawDragonflyBody(ctx, body, bodyDeep, hawker);
  ctx.restore();

  // блик на крыльях в солнце — едва заметный, иначе читается шаром
  if (atm.time.daylight > 0.5 && !perched) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    glow(ctx, x, yy, 8, { r: 220, g: 250, b: 255 }, 0.1);
    ctx.restore();
  }
}

function drawDragonflyBody(ctx: Ctx, body: RGB, bodyDeep: RGB, hawker: boolean): void {
  const len = hawker ? 8 : 9.5;
  const thick = hawker ? 1.25 : 0.8;
  ctx.fillStyle = css(body, 0.92);
  ctx.beginPath();
  ctx.ellipse(-3, 0, len * 0.85, thick, 0, 0, Math.PI * 2);
  ctx.fill();
  // насечки на брюшке
  ctx.strokeStyle = css(bodyDeep, 0.55);
  ctx.lineWidth = 0.6;
  for (let i = 1; i <= 4; i++) {
    const ox = -3 - i * 1.3;
    ctx.beginPath();
    ctx.moveTo(ox, -thick);
    ctx.lineTo(ox, thick);
    ctx.stroke();
  }
  // голова с большими глазами
  ctx.fillStyle = css(body, 0.95);
  ctx.beginPath();
  ctx.arc(4.4, 0, hawker ? 1.9 : 1.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = css(bodyDeep, 0.9);
  ctx.beginPath();
  ctx.arc(4.8, -0.5, hawker ? 1.1 : 0.9, 0, Math.PI * 2);
  ctx.arc(4.8, 0.5, hawker ? 1.1 : 0.9, 0, Math.PI * 2);
  ctx.fill();
}

// ---------------- Круги на воде ----------------

/** Всплеск лягушки или след купания: круг расходится и тает. */
export function drawRipple(ctx: Ctx, r: Ripple, x: number, y: number, atm: Atmosphere): void {
  const k = r.age / 1600;
  const a = (1 - k) * 0.5;
  if (a <= 0.02) return;
  const rad = (r.big ? 3 : 2) + k * (r.big ? 15 : 8);
  const foam = litc({ r: 240, g: 248, b: 248 }, atm, 0.06);
  ctx.save();
  ctx.strokeStyle = css(foam, a);
  ctx.lineWidth = r.big ? 1.2 : 0.9;
  ctx.beginPath();
  ctx.ellipse(x, y, rad, rad * 0.5, 0, 0, Math.PI * 2);
  ctx.stroke();
  if (r.big) {
    ctx.strokeStyle = css(foam, a * 0.6);
    ctx.beginPath();
    ctx.ellipse(x, y, rad * 0.55, rad * 0.27, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}
