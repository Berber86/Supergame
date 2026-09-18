/**
 * Отрисовка диких соседей: светлячок, цапля, олень.
 *
 * Та же акварельная кисть, что и весь сад: пятна с мягкой кромкой,
 * свет — радиальным свечением, ни одного растрового ассета.
 * Силуэты читаются с общего плана: цапля — вертикаль над водой,
 * олень — рыжее пятно у рощи, светлячок — тёплая точка в темноте.
 */

import { Atmosphere, RGB, css, mix, shade } from '../world/palette';
import { Deer, Firefly, Heron, fireflyGlow } from '../world/wildlife';
import { Ctx, glow, softShadow, washBlob } from './paint';

function litc(c: RGB, atm: Atmosphere, boost = 0): RGB {
  return shade(mix(c, atm.lightTint, atm.lightAmount), atm.exposure + boost);
}

// ---------------- Светлячок ----------------

export function drawFirefly(ctx: Ctx, f: Firefly, x: number, y: number, atm: Atmosphere, time: number): void {
  if (f.alpha <= 0.02) return;
  const g = fireflyGlow(f, time) * (f.state === 'rest' ? 0.3 : 1) * f.alpha;
  const hover = Math.sin(time * 0.0021 + f.seed) * 2.2;
  const py = y - 7 - hover;

  if (g > 0.03) {
    // Тёплый огонёк: свечение шире ядра, как у фонарика в тумане
    glow(ctx, x, py, 6 + 6 * g, { r: 214, g: 244, b: 138 }, 0.55 * g * f.alpha);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = css({ r: 255, g: 252, b: 200 }, 0.75 * g);
    ctx.beginPath();
    ctx.arc(x, py, 1.15, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  } else if (f.state === 'rest') {
    // На траве без вспышки — едва заметная соринка
    ctx.fillStyle = css(litc({ r: 96, g: 104, b: 66 }, atm), 0.35 * f.alpha);
    ctx.beginPath();
    ctx.arc(x, py, 0.9, 0, Math.PI * 2);
    ctx.fill();
  }
}

// ---------------- Цапля ----------------

export function drawHeron(ctx: Ctx, hr: Heron, x: number, y: number, atm: Atmosphere, time: number): void {
  const flying = hr.state === 'fly-in' || hr.state === 'fly-out';
  const body = litc({ r: 148, g: 160, b: 170 }, atm);
  const deep = litc({ r: 108, g: 122, b: 134 }, atm);
  const pale = litc({ r: 226, g: 232, b: 234 }, atm);
  const beak = litc({ r: 198, g: 156, b: 84 }, atm);
  const leg = litc({ r: 96, g: 88, b: 74 }, atm);

  ctx.save();
  ctx.translate(x, y);

  // тень на воде или берегу
  ctx.save();
  ctx.globalCompositeOperation = 'multiply';
  softShadow(ctx, 0, 0, flying ? 12 : 8, 3, atm.shadowTint, atm.shadowAmount * (flying ? 0.5 : 1.2));
  ctx.restore();

  const lift = flying ? -30 - Math.sin(time * 0.004) * 3 : 0;
  ctx.translate(0, lift);
  ctx.scale(hr.facing * 1.18, 1.18);

  // ноги: у стоящей — две тонкие опоры, в полёте — тянутся назад
  ctx.strokeStyle = css(leg, 0.9);
  ctx.lineWidth = 1.4;
  if (flying) {
    ctx.beginPath();
    ctx.moveTo(-4, -2);
    ctx.lineTo(-13, 1.5);
    ctx.moveTo(-5, -1.5);
    ctx.lineTo(-14, 2.5);
    ctx.stroke();
  } else {
    const step = hr.state === 'stalk' ? Math.sin(hr.phase * Math.PI * 3) * 2.4 : 0;
    ctx.beginPath();
    ctx.moveTo(-1, -12);
    ctx.lineTo(-1 - step * 0.4, 0);
    ctx.moveTo(2, -12);
    ctx.lineTo(2 + step, hr.state === 'stalk' ? -Math.abs(step) * 0.7 : 0);
    ctx.stroke();
  }

  // тело: капля с тёмной спиной и светлым брюхом
  washBlob(ctx, 0, -15, 10.5, 5.0, body, 41, { alpha: 0.62, edge: 0.3 });
  // сложенное крыло — тёмное пятно по боку
  ctx.fillStyle = css(deep, 0.4);
  ctx.beginPath();
  ctx.ellipse(-1, -15.6, 6.2, 2.6, -0.08, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = css(pale, 0.5);
  ctx.beginPath();
  ctx.ellipse(1, -13.4, 5.4, 2.6, -0.1, 0, Math.PI * 2);
  ctx.fill();
  // хвостик
  ctx.fillStyle = css(deep, 0.85);
  ctx.beginPath();
  ctx.moveTo(-8, -16.4);
  ctx.lineTo(-12.5, -14.6);
  ctx.lineTo(-7.6, -13.6);
  ctx.closePath();
  ctx.fill();

  // крылья в полёте: медленные широкие взмахи
  if (flying) {
    const flap = Math.sin(time * 0.011) * 0.9;
    ctx.fillStyle = css(deep, 0.9);
    ctx.save();
    ctx.translate(-1, -17);
    ctx.rotate(-0.5 - flap);
    ctx.beginPath();
    ctx.ellipse(-6, 0, 10.5, 3.4, 0.15, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // шея и голова: поза решает силуэт
  // stand: вертикаль с изгибом; stalk: вынос вперёд; strike: бросок к воде;
  // preen: шея свёрнута к спине; полёт: шея сложена S-образно
  let hx = 7;
  let hy = -34;
  if (hr.state === 'stand') {
    hy = -37 + Math.sin(time * 0.0016) * 0.7;
  } else if (hr.state === 'stalk') {
    hx = 12;
    hy = -22;
  } else if (hr.state === 'strike') {
    const k = Math.sin(Math.min(1, (900 - hr.timer) / 500) * Math.PI);
    hx = 10 + k * 3;
    hy = -30 + k * 27;
  } else if (hr.state === 'preen') {
    hx = -2;
    hy = -19;
  } else if (flying) {
    hx = 6.5;
    hy = -20;
  }
  ctx.strokeStyle = css(body, 0.96);
  ctx.lineWidth = 2.9;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(5, -17);
  if (flying || hr.state === 'preen') {
    ctx.bezierCurveTo(9, -22, 2, -26, hx, hy);
  } else if (hr.state === 'strike') {
    ctx.bezierCurveTo(9, -26, hx - 2, hy - 8, hx, hy);
  } else {
    ctx.bezierCurveTo(9.5, -24, 4.5, -30, hx, hy);
  }
  ctx.stroke();

  // голова и клюв
  ctx.fillStyle = css(pale, 0.95);
  ctx.beginPath();
  ctx.ellipse(hx, hy, 2.6, 2.1, -0.15, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = css(beak, 0.95);
  ctx.beginPath();
  const bdir = hr.state === 'strike' ? 0.9 : hr.state === 'stalk' ? 0.35 : 0.12;
  ctx.moveTo(hx + 1.6, hy - 0.9);
  ctx.lineTo(hx + 10.5, hy + bdir * 8);
  ctx.lineTo(hx + 1.6, hy + 1.1);
  ctx.closePath();
  ctx.fill();
  // тёмная «бровь» и глаз
  ctx.strokeStyle = css(deep, 0.8);
  ctx.lineWidth = 0.9;
  ctx.beginPath();
  ctx.moveTo(hx - 2.2, hy - 1.2);
  ctx.lineTo(hx + 1.4, hy - 1.1);
  ctx.stroke();
  ctx.fillStyle = css({ r: 40, g: 38, b: 34 }, 0.95);
  ctx.beginPath();
  ctx.arc(hx + 0.4, hy - 0.4, 0.55, 0, Math.PI * 2);
  ctx.fill();

  // рыба в клюве: серебряная полоска, пока не проглочена
  if (hr.fish > 0) {
    const fx = hx + 6;
    const fy = hy + bdir * 5 + 1.5;
    ctx.fillStyle = css(litc({ r: 210, g: 214, b: 210 }, atm, 0.1), 0.9);
    ctx.save();
    ctx.translate(fx, fy);
    ctx.rotate(0.5 + Math.sin(time * 0.02) * 0.15);
    ctx.beginPath();
    ctx.ellipse(0, 0, 3.4, 1.2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  ctx.restore();
}

// ---------------- Олень ----------------

export function drawDeer(ctx: Ctx, d: Deer, x: number, y: number, atm: Atmosphere, time: number): void {
  const coatBase = d.coat.winter
    ? { r: 150, g: 128, b: 98 }
    : d.coat.spots
      ? { r: 168, g: 126, b: 80 }
      : { r: 138, g: 100, b: 62 };
  const body = litc(coatBase, atm);
  const deep = litc(shade(coatBase, 0.82), atm);
  const pale = litc({ r: 232, g: 224, b: 204 }, atm);
  const leg = litc(shade(coatBase, 0.7), atm);

  const moving = d.state === 'enter' || d.state === 'walk' || d.state === 'leave';
  const trot = d.state === 'leave' ? Math.abs(Math.sin(d.phase * Math.PI * 5)) * 2.2 : 0;
  const graze = d.state === 'graze';

  ctx.save();
  ctx.translate(x, y - trot);
  ctx.scale(1.32, 1.32);

  ctx.save();
  ctx.globalCompositeOperation = 'multiply';
  softShadow(ctx, 0, trot / 1.32, 12, 3.4, atm.shadowTint, atm.shadowAmount * 1.15);
  ctx.restore();

  ctx.scale(d.facing, 1);

  // ноги: четыре тонкие опоры, на шаге — противофазные
  const gait = moving ? Math.sin(d.phase * Math.PI * 6) : 0;
  ctx.strokeStyle = css(leg, 0.92);
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(-7, -12);
  ctx.lineTo(-7 - gait * 2.2, 0);
  ctx.moveTo(-4.5, -12);
  ctx.lineTo(-4.5 + gait * 2.2, 0);
  ctx.moveTo(5, -12);
  ctx.lineTo(5 + gait * 2.2, 0);
  ctx.moveTo(7.5, -12);
  ctx.lineTo(7.5 - gait * 2.2, 0);
  ctx.stroke();

  // корпус: капля с мягкой кромкой
  washBlob(ctx, 0, -15.5, 10.5, 5.4, body, 57, { alpha: 0.62, edge: 0.3 });
  // светлое брюхо и подхвостие
  ctx.fillStyle = css(pale, 0.4);
  ctx.beginPath();
  ctx.ellipse(0, -12.6, 6.5, 2.2, 0, 0, Math.PI * 2);
  ctx.fill();

  // пятна: летняя шкура в белых отметинах
  if (d.coat.spots) {
    ctx.fillStyle = css(pale, 0.75);
    for (let i = 0; i < 6; i++) {
      const sx = -6 + ((i * 37 + d.seed) % 13);
      const sy = -18 + ((i * 23 + d.seed) % 5);
      ctx.beginPath();
      ctx.arc(sx, sy, 0.8, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // хвостик: на тревоге поднят белой стороной
  const tailUp = d.state === 'look' || d.state === 'leave' ? 1 : 0;
  ctx.fillStyle = css(deep, 0.9);
  ctx.beginPath();
  ctx.moveTo(-9.5, -17.5);
  ctx.lineTo(-12, -16.5 - tailUp * 2.5);
  ctx.lineTo(-9.2, -15);
  ctx.closePath();
  ctx.fill();
  if (tailUp) {
    ctx.fillStyle = css(pale, 0.85);
    ctx.beginPath();
    ctx.ellipse(-10.6, -17.6, 1.5, 2.1, 0.4, 0, Math.PI * 2);
    ctx.fill();
  }

  // шея и голова: щиплет траву или смотрит поверх
  const nx = 9;
  const ny = graze ? -4 : -26 + Math.sin(time * 0.0018 + d.seed) * 0.6;
  ctx.strokeStyle = css(body, 0.96);
  ctx.lineWidth = 3.6;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(7, -18);
  ctx.bezierCurveTo(nx + 1.5, graze ? -14 : -24, nx + 0.5, graze ? -8 : -25, nx, ny);
  ctx.stroke();

  // голова
  ctx.fillStyle = css(body, 0.98);
  ctx.beginPath();
  ctx.ellipse(nx + 1, ny, 3, 2.1, graze ? 0.5 : 0.1, 0, Math.PI * 2);
  ctx.fill();
  // морда
  ctx.fillStyle = css(deep, 0.9);
  ctx.beginPath();
  ctx.ellipse(nx + 3.4, ny + (graze ? 1.2 : 0.5), 1.7, 1.1, graze ? 0.5 : 0.15, 0, Math.PI * 2);
  ctx.fill();
  // уши: два листика, настороженно развёрнуты
  const ear = d.state === 'look' ? 0.5 : 0.15;
  ctx.fillStyle = css(body, 0.95);
  for (const s of [-1, 1]) {
    ctx.save();
    ctx.translate(nx - 0.5, ny - 1.6);
    ctx.rotate(s * (0.7 + ear));
    ctx.beginPath();
    ctx.ellipse(0, -2.2, 1.1, 2.6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  // глаз
  ctx.fillStyle = css({ r: 38, g: 34, b: 30 }, 0.95);
  ctx.beginPath();
  ctx.arc(nx + 1.6, ny - 0.5, 0.5, 0, Math.PI * 2);
  ctx.fill();

  // рога: осенняя корона, летом — молодые панты
  if (d.coat.antlers) {
    const velvet = d.coat.spots;
    ctx.strokeStyle = css(velvet ? litc({ r: 148, g: 116, b: 88 }, atm) : litc({ r: 118, g: 96, b: 72 }, atm), 0.95);
    ctx.lineWidth = velvet ? 1.5 : 1.2;
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(nx - 0.5 + s * 0.8, ny - 2.4);
      ctx.lineTo(nx - 1.5 + s * 2.2, ny - 6.5);
      ctx.lineTo(nx - 0.5 + s * 1.6, ny - 8.5);
      ctx.moveTo(nx - 1.5 + s * 2.2, ny - 6.5);
      ctx.lineTo(nx - 3 + s * 3.4, ny - 8);
      if (!velvet) {
        ctx.moveTo(nx - 1 + s * 1.9, ny - 7.6);
        ctx.lineTo(nx + 0.5 + s * 2.6, ny - 9.6);
      }
      ctx.stroke();
    }
  }

  ctx.restore();
}
