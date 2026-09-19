/**
 * Отрисовка диких соседей: светлячок, цапля, олень, ёжик, мышка, сова, белка, черепаха, пчёлы.
 */

import { Atmosphere, RGB, css, mix, shade } from '../world/palette';
import {
  Bee,
  Deer,
  Firefly,
  Hedgehog,
  Heron,
  Moth,
  Mouse,
  Owl,
  Squirrel,
  Turtle,
  fireflyGlow,
} from '../world/wildlife';
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
    glow(ctx, x, py, 6 + 6 * g, { r: 214, g: 244, b: 138 }, 0.55 * g * f.alpha);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = css({ r: 255, g: 252, b: 200 }, 0.75 * g);
    ctx.beginPath();
    ctx.arc(x, py, 1.15, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  } else if (f.state === 'rest') {
    ctx.fillStyle = css(litc({ r: 96, g: 104, b: 66 }, atm), 0.35 * f.alpha);
    ctx.beginPath();
    ctx.arc(x, py, 0.9, 0, Math.PI * 2);
    ctx.fill();
  }
}

export function drawMoth(ctx: Ctx, m: Moth, x: number, y: number, atm: Atmosphere, time: number): void {
  if (m.alpha <= 0.02) return;
  const hover = Math.sin(time * 0.0023 + m.seed) * 1.8;
  const py = y - 10 - hover;
  const flutter = Math.sin(time * 0.022 + m.flutter) * 0.6 + 0.4;
  // Ночью мотылёк должен оставаться светлым пятном, а не серой кляксой
  const wing = litc({ r: 232, g: 224, b: 206 }, atm, atm.lightAmount < 0.35 ? 0.22 : 0);
  const wingEdge = litc({ r: 196, g: 184, b: 164 }, atm, atm.lightAmount < 0.35 ? 0.18 : 0);
  const wingShade = litc({ r: 184, g: 172, b: 152 }, atm, atm.lightAmount < 0.35 ? 0.12 : 0);
  const bodyCol = litc({ r: 92, g: 82, b: 70 }, atm, atm.lightAmount < 0.35 ? 0.1 : 0);

  ctx.save();
  ctx.translate(x, py);
  // Делаем мотылька изящнее и меньше — был 0.85 и выглядел как большой серый овал с щелью
  ctx.scale(0.62, 0.62);

  const open = 0.55 + flutter * 0.55;
  for (const side of [-1, 1]) {
    ctx.save();
    ctx.scale(side * open, 1);
    // нижнее крыло — чуть меньше, даёт форму бабочки, а не овала
    ctx.fillStyle = css(wing, 0.62 * m.alpha);
    ctx.beginPath();
    ctx.moveTo(0.2, -0.2);
    ctx.bezierCurveTo(1.8, -3.8, 5.2, -3.4, 5.0, -0.8);
    ctx.bezierCurveTo(4.8, 0.4, 2.4, 1.2, 0.2, 0.4);
    ctx.closePath();
    ctx.fill();
    // акварельная кромка — дзэн-мазок
    ctx.strokeStyle = css(wingEdge, 0.28 * m.alpha);
    ctx.lineWidth = 0.5;
    ctx.stroke();
    // пятнышко на крыле — характер, а не заливка
    ctx.fillStyle = css(wingShade, 0.32 * m.alpha);
    ctx.beginPath();
    ctx.ellipse(2.6, -1.1, 1.1, 0.55, 0.22, 0, Math.PI * 2);
    ctx.fill();
    // нижнее крылышко — лёгкая тень
    ctx.fillStyle = css(wing, 0.38 * m.alpha);
    ctx.beginPath();
    ctx.moveTo(0.2, 0.3);
    ctx.bezierCurveTo(1.2, 0.1, 3.0, 0.6, 2.6, 1.6);
    ctx.bezierCurveTo(1.8, 2.0, 0.4, 1.4, 0.2, 0.3);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
  // тельце — тоньше, не щель
  ctx.fillStyle = css(bodyCol, 0.88 * m.alpha);
  ctx.beginPath();
  ctx.ellipse(0, 0.15, 0.42, 1.9, 0, 0, Math.PI * 2);
  ctx.fill();
  // усики — две тонкие линии, сразу читается мотылёк
  ctx.strokeStyle = css(bodyCol, 0.55 * m.alpha);
  ctx.lineWidth = 0.35;
  ctx.beginPath();
  ctx.moveTo(-0.1, -1.4);
  ctx.quadraticCurveTo(-0.6, -2.2, -0.9, -2.8);
  ctx.moveTo(0.1, -1.4);
  ctx.quadraticCurveTo(0.6, -2.2, 0.9, -2.8);
  ctx.stroke();

  // лёгкое свечение в темноте — пыльца, чуть заметнее
  if (atm.lightAmount < 0.45) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = css({ r: 255, g: 246, b: 210 }, 0.16 * m.alpha);
    ctx.beginPath();
    ctx.arc(0, 0, 3.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  ctx.restore();
}

// ---------------- Цапля ----------------

export function drawHeron(ctx: Ctx, hr: Heron, x: number, y: number, atm: Atmosphere, time: number): void {
  const flying = hr.state === 'fly-in' || hr.state === 'fly-out';
  const bodyBase = { r: 152, g: 164, b: 174 };
  const body = litc(bodyBase, atm);
  const deep = litc({ r: 108, g: 122, b: 138 }, atm);
  const deep2 = litc({ r: 88, g: 102, b: 118 }, atm);
  const pale = litc({ r: 230, g: 236, b: 238 }, atm);
  const beak = litc({ r: 202, g: 160, b: 88 }, atm);
  const beakDeep = litc({ r: 168, g: 124, b: 62 }, atm);
  const leg = litc({ r: 96, g: 88, b: 74 }, atm);

  ctx.save();
  ctx.translate(x, y);
  ctx.save();
  ctx.globalCompositeOperation = 'multiply';
  softShadow(ctx, 0, 0, flying ? 13 : 9, 3.2, atm.shadowTint, atm.shadowAmount * (flying ? 0.52 : 1.25));
  ctx.restore();

  const lift = flying ? -32 - Math.sin(time * 0.0035) * 3.5 : Math.sin(time * 0.0012 + hr.seed) * 0.4;
  ctx.translate(0, lift);
  ctx.scale(hr.facing * 1.22, 1.22);

  // ноги — длинные, тонкие, элегантные
  ctx.strokeStyle = css(leg, 0.92);
  ctx.lineWidth = 1.35;
  ctx.lineCap = 'round';
  if (flying) {
    ctx.beginPath();
    ctx.moveTo(-4, -2);
    ctx.lineTo(-13.5, 1.8);
    ctx.moveTo(-5, -1.5);
    ctx.lineTo(-14.5, 2.8);
    ctx.stroke();
    // пальцы
    ctx.lineWidth = 0.9;
    ctx.beginPath();
    ctx.moveTo(-13.5, 1.8);
    ctx.lineTo(-15.5, 2.2);
    ctx.moveTo(-14.5, 2.8);
    ctx.lineTo(-16.5, 3.2);
    ctx.stroke();
  } else {
    const step = hr.state === 'stalk' ? Math.sin(hr.phase * Math.PI * 3) * 2.6 : 0;
    ctx.beginPath();
    ctx.moveTo(-1.2, -12.5);
    ctx.lineTo(-1.2 - step * 0.45, 0.2);
    ctx.moveTo(2.0, -12.5);
    ctx.lineTo(2.0 + step, hr.state === 'stalk' ? -Math.abs(step) * 0.75 : 0.2);
    ctx.stroke();
    // колени — лёгкий изгиб
    ctx.strokeStyle = css(leg, 0.62);
    ctx.lineWidth = 0.9;
    ctx.beginPath();
    ctx.moveTo(-1.2, -6);
    ctx.lineTo(-0.8, -5.5);
    ctx.moveTo(2.0, -6);
    ctx.lineTo(2.4, -5.5);
    ctx.stroke();
  }

  // тело — стройное, с перьями
  washBlob(ctx, 0, -15.5, 11.0, 5.2, body, 41 + (hr.seed % 13), { alpha: 0.72, edge: 0.32 });
  // грудка — пушистая
  ctx.fillStyle = css(pale, 0.38);
  ctx.beginPath();
  ctx.ellipse(0, -12.8, 4.5, 3.8, -0.08, 0, Math.PI * 2);
  ctx.fill();
  // крыло — сложенное, с перьями
  ctx.fillStyle = css(deep, 0.52);
  ctx.beginPath();
  ctx.ellipse(-0.8, -16.0, 6.8, 2.8, -0.06, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = css(deep2, 0.22);
  ctx.lineWidth = 0.5;
  for (let i = -2; i <= 2; i++) {
    ctx.beginPath();
    ctx.moveTo(i * 1.4, -17.5);
    ctx.lineTo(i * 1.4 + 0.4, -14.5);
    ctx.stroke();
  }
  // хохолок на затылке
  ctx.fillStyle = css(deep, 0.88);
  ctx.beginPath();
  ctx.moveTo(-8.2, -16.8);
  ctx.lineTo(-13.2, -15.2);
  ctx.lineTo(-8.0, -14.2);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = css(deep2, 0.72);
  ctx.beginPath();
  ctx.moveTo(-9.5, -17.0);
  ctx.lineTo(-14.5, -15.8);
  ctx.lineTo(-9.8, -15.0);
  ctx.closePath();
  ctx.fill();

  if (flying) {
    const flap = Math.sin(time * 0.01) * 1.0;
    ctx.fillStyle = css(deep, 0.9);
    ctx.save();
    ctx.translate(-1, -17.5);
    ctx.rotate(-0.52 - flap);
    ctx.beginPath();
    ctx.ellipse(-6.5, 0, 11.5, 3.6, 0.14, 0, Math.PI * 2);
    ctx.fill();
    // перья
    ctx.strokeStyle = css(deep2, 0.28);
    ctx.lineWidth = 0.6;
    for (let i = 0; i < 4; i++) {
      ctx.beginPath();
      ctx.moveTo(-3 - i * 2.4, -1.2);
      ctx.lineTo(-5 - i * 2.4, 1.2);
      ctx.stroke();
    }
    ctx.restore();
  }

  // шея — длинная, изящная S-образная, как у цапли
  let hx = 7;
  let hy = -35;
  if (hr.state === 'stand') {
    hy = -38 + Math.sin(time * 0.0014) * 0.8;
    hx = 7.5;
  } else if (hr.state === 'stalk') {
    hx = 13;
    hy = -23;
  } else if (hr.state === 'strike') {
    const k = Math.sin(Math.min(1, (900 - hr.timer) / 500) * Math.PI);
    hx = 11 + k * 3.5;
    hy = -31 + k * 28;
  } else if (hr.state === 'preen') {
    hx = -1.5;
    hy = -20;
  } else if (flying) {
    hx = 7.0;
    hy = -21;
  }
  ctx.strokeStyle = css(pale, 0.98);
  ctx.lineWidth = 3.1;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(5.2, -17.5);
  if (flying || hr.state === 'preen') {
    ctx.bezierCurveTo(9.5, -22.5, 2.5, -27, hx, hy);
  } else if (hr.state === 'strike') {
    ctx.bezierCurveTo(9.5, -27, hx - 2, hy - 9, hx, hy);
  } else {
    ctx.bezierCurveTo(10.0, -25, 4.8, -32, hx, hy);
  }
  ctx.stroke();
  // тень на шее
  ctx.strokeStyle = css(deep, 0.14);
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(5.2, -17.5);
  if (flying || hr.state === 'preen') ctx.bezierCurveTo(9.5, -22.5, 2.5, -27, hx, hy);
  else if (hr.state === 'strike') ctx.bezierCurveTo(9.5, -27, hx - 2, hy - 9, hx, hy);
  else ctx.bezierCurveTo(10.0, -25, 4.8, -32, hx, hy);
  ctx.stroke();

  // голова — с хохолком
  ctx.fillStyle = css(pale, 0.97);
  ctx.beginPath();
  ctx.ellipse(hx, hy, 2.8, 2.2, -0.14, 0, Math.PI * 2);
  ctx.fill();
  // чёрная полоса от глаза к затылку — как у серой цапли
  ctx.strokeStyle = css(deep2, 0.72);
  ctx.lineWidth = 0.7;
  ctx.beginPath();
  ctx.moveTo(hx - 1.5, hy - 0.4);
  ctx.lineTo(hx - 6, hy - 0.8);
  ctx.stroke();

  // клюв — длинный, острый, желтоватый
  ctx.fillStyle = css(beak, 0.97);
  ctx.beginPath();
  const bdir = hr.state === 'strike' ? 0.92 : hr.state === 'stalk' ? 0.36 : 0.14;
  ctx.moveTo(hx + 1.7, hy - 1.0);
  ctx.lineTo(hx + 11.2, hy + bdir * 8.5);
  ctx.lineTo(hx + 1.7, hy + 1.2);
  ctx.closePath();
  ctx.fill();
  // кончик клюва темнее
  ctx.fillStyle = css(beakDeep, 0.52);
  ctx.beginPath();
  ctx.moveTo(hx + 9.5, hy + bdir * 7.2 - 0.3);
  ctx.lineTo(hx + 11.2, hy + bdir * 8.5);
  ctx.lineTo(hx + 9.5, hy + bdir * 7.2 + 0.5);
  ctx.closePath();
  ctx.fill();

  // глаз — янтарный, с чёрным зрачком
  ctx.fillStyle = css({ r: 42, g: 38, b: 34 }, 0.96);
  ctx.beginPath();
  ctx.arc(hx + 0.5, hy - 0.4, 0.62, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = css({ r: 232, g: 188, b: 72 }, 0.88);
  ctx.beginPath();
  ctx.arc(hx + 0.5, hy - 0.4, 0.32, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = css({ r: 22, g: 20, b: 18 }, 0.92);
  ctx.beginPath();
  ctx.arc(hx + 0.5, hy - 0.4, 0.16, 0, Math.PI * 2);
  ctx.fill();

  // рыбка в клюве
  if (hr.fish > 0) {
    const fx = hx + 7;
    const fy = hy + bdir * 5.5 + 1.6;
    ctx.fillStyle = css(litc({ r: 214, g: 218, b: 214 }, atm, 0.12), 0.92);
    ctx.save();
    ctx.translate(fx, fy);
    ctx.rotate(0.52 + Math.sin(time * 0.018) * 0.16);
    ctx.beginPath();
    ctx.ellipse(0, 0, 3.6, 1.3, 0, 0, Math.PI * 2);
    ctx.fill();
    // хвостик рыбки
    ctx.beginPath();
    ctx.moveTo(-3.2, 0);
    ctx.lineTo(-4.8, -0.8);
    ctx.lineTo(-4.8, 0.8);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  ctx.restore();
}

// ---------------- Олень ----------------

export function drawDeer(ctx: Ctx, d: Deer, x: number, y: number, atm: Atmosphere, time: number): void {
  // Новый силуэт строится вокруг трёх опор: глубокая грудь, лёгкая поясница
  // и длинная шея. Благодаря этому олень читается как животное, а не как
  // набор линий, даже когда камера отдалилась.
  const coatBase = d.coat.winter
    ? { r: 154, g: 128, b: 94 }
    : d.coat.spots
      ? { r: 182, g: 132, b: 78 }
      : { r: 142, g: 96, b: 58 };
  const boost = atm.lightAmount < 0.5 ? 0.09 : 0;
  const body = litc(coatBase, atm, boost);
  const deep = litc(shade(coatBase, 0.74), atm, boost);
  const deep2 = litc(shade(coatBase, 0.5), atm, boost);
  const pale = litc({ r: 244, g: 232, b: 204 }, atm, boost);
  const chest = litc({ r: 213, g: 173, b: 119 }, atm, boost);
  const leg = litc(shade(coatBase, 0.61), atm, boost);
  const hoof = litc({ r: 62, g: 48, b: 39 }, atm, boost);

  const moving = d.state === 'enter' || d.state === 'walk' || d.state === 'leave';
  const alert = d.state === 'look' || d.state === 'leave';
  const grazing = d.state === 'graze';
  const stride = moving ? Math.sin(d.gait) : 0;
  const strideBack = moving ? Math.sin(d.gait + Math.PI) : 0;
  const breathe = Math.sin(time * 0.00155 + d.seed) * 0.45;
  const trotLift = d.state === 'leave' ? Math.abs(Math.sin(d.gait)) * 1.8 : 0;

  ctx.save();
  ctx.translate(x, y - trotLift);
  ctx.scale(1.42, 1.42);

  ctx.save();
  ctx.globalCompositeOperation = 'multiply';
  softShadow(ctx, 0, trotLift / 1.42, moving ? 14 : 13, 3.9, atm.shadowTint, atm.shadowAmount * (moving ? 1.05 : 1.22));
  ctx.restore();
  ctx.scale(d.facing, 1);

  // Дальние ноги рисуются первыми. Колено и щиколотка дают шагу вес,
  // а не «шарнирную палочку».
  const legs: Array<{ hip: number; phase: number; far: boolean }> = [
    { hip: -7.2, phase: strideBack, far: true },
    { hip: -4.8, phase: stride, far: false },
    { hip: 5.0, phase: stride, far: true },
    { hip: 7.5, phase: strideBack, far: false },
  ];
  for (const legInfo of legs) {
    const lift = moving ? Math.max(0, legInfo.phase) * 2.2 : 0;
    const knee = legInfo.hip + legInfo.phase * 1.25;
    const ankle = legInfo.hip - legInfo.phase * 1.55;
    ctx.strokeStyle = css(legInfo.far ? deep : leg, legInfo.far ? 0.58 : 0.95);
    ctx.lineWidth = legInfo.far ? 1.35 : 1.65;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(legInfo.hip, -13.4);
    ctx.lineTo(knee, -6.8 - lift * 0.45);
    ctx.lineTo(ankle, -0.5 - lift);
    ctx.stroke();
    ctx.fillStyle = css(hoof, legInfo.far ? 0.68 : 0.94);
    ctx.beginPath();
    ctx.ellipse(ankle + 0.25, 0.15 - lift, 1.05, 0.55, legInfo.phase * 0.18, 0, Math.PI * 2);
    ctx.fill();
  }

  // Тело — с отдельным плечом и грудью, чтобы движение могло «перетекать»
  // из корпуса в шею.
  washBlob(ctx, 0, -16.2 + breathe * 0.25, 11.3, 6.0, body, 57 + (d.seed % 13), {
    alpha: 0.78,
    edge: 0.34,
    wobble: 0.16,
  });
  ctx.fillStyle = css(chest, 0.42);
  ctx.beginPath();
  ctx.ellipse(7.0, -14.8 + breathe * 0.25, 4.5, 4.7, -0.16, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = css(pale, 0.36);
  ctx.beginPath();
  ctx.ellipse(0.8, -12.8 + breathe * 0.3, 7.5, 2.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = css(deep2, 0.22);
  ctx.lineWidth = 0.65;
  ctx.beginPath();
  ctx.moveTo(-7.5, -19.4);
  ctx.quadraticCurveTo(-1.2, -21.0, 6.7, -19.2);
  ctx.stroke();

  if (d.coat.spots) {
    ctx.fillStyle = css(pale, 0.8);
    const spots = [
      [-6.5, -18.1, 0.65],
      [-3.8, -16.2, 0.5],
      [-1.2, -19.1, 0.7],
      [1.7, -17.1, 0.55],
      [4.1, -18.7, 0.62],
      [-5.0, -14.0, 0.42],
      [0.0, -14.6, 0.48],
    ];
    for (const [sx, sy, r] of spots) {
      ctx.beginPath();
      ctx.ellipse(sx, sy, r, r * 0.72, -0.2, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Хвост живёт отдельно от корпуса: при тревоге он открывает белое зеркало.
  const tailFlick = alert ? 1 : Math.sin(time * 0.0018 + d.seed) * 0.12;
  ctx.save();
  ctx.translate(-9.6, -18.0);
  ctx.rotate(-0.22 - tailFlick * 0.25);
  ctx.fillStyle = css(deep, 0.94);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(-3.7, -1.4, -4.6, -4.6);
  ctx.quadraticCurveTo(-1.2, -4.0, 1.0, -1.0);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = css(pale, 0.9);
  ctx.beginPath();
  ctx.ellipse(-2.8, -3.0, 1.45, 1.9, -0.35, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Шея: пасть идёт к траве плавной дугой, alert/look вытягивает её вверх.
  const neckX = grazing ? 10.7 : alert ? 9.6 : 9.2;
  const neckY = grazing ? -10.2 + Math.sin(time * 0.004 + d.seed) * 1.25 : -27.2 + breathe;
  ctx.strokeStyle = css(body, 0.98);
  ctx.lineWidth = 4.35;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(6.5, -18.2);
  if (grazing) ctx.bezierCurveTo(8.5, -14.6, 10.2, -11.8, neckX, neckY);
  else ctx.bezierCurveTo(10.6, -23.7, 10.0, -26.0, neckX, neckY);
  ctx.stroke();
  ctx.strokeStyle = css(deep, 0.27);
  ctx.lineWidth = 1.15;
  ctx.beginPath();
  ctx.moveTo(7.0, -18.2);
  if (grazing) ctx.bezierCurveTo(8.8, -14.4, 10.4, -11.8, neckX, neckY);
  else ctx.bezierCurveTo(10.8, -23.7, 10.0, -26.0, neckX, neckY);
  ctx.stroke();

  // Голова с клиновидной мордой — профиль стал яснее, чем у прежнего овала.
  const headX = neckX + 1.15;
  const headY = neckY;
  const headAngle = grazing ? 0.48 : 0.12;
  ctx.save();
  ctx.translate(headX, headY);
  ctx.rotate(headAngle);
  ctx.fillStyle = css(body, 0.99);
  ctx.beginPath();
  ctx.ellipse(0, 0, 3.4, 2.35, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = css(deep2, 0.9);
  ctx.beginPath();
  ctx.ellipse(2.65, 0.55, 1.75, 1.12, 0.08, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = css({ r: 42, g: 35, b: 30 }, 0.78);
  ctx.beginPath();
  ctx.ellipse(3.6, 0.68, 0.3, 0.22, 0, 0, Math.PI * 2);
  ctx.fill();
  // Уши вращаются навстречу звуку: это самая заметная анимация look.
  for (const side of [-1, 1]) {
    ctx.save();
    ctx.translate(-0.8, -1.6);
    ctx.rotate(side * (0.62 + (alert ? 0.28 : 0.04)));
    ctx.fillStyle = css(body, 0.98);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(-1.4, -2.2, 0.1, -4.8);
    ctx.quadraticCurveTo(1.8, -2.8, 1.0, -0.15);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = css(pale, 0.34);
    ctx.beginPath();
    ctx.ellipse(0.1, -2.2, 0.42, 1.35, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  // Глаз смотрит чуть вперёд, а не в центр головы.
  ctx.fillStyle = css({ r: 42, g: 32, b: 26 }, 0.98);
  ctx.beginPath();
  ctx.arc(0.9, -0.55, 0.66, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = css({ r: 255, g: 246, b: 205 }, 0.82);
  ctx.beginPath();
  ctx.arc(1.12, -0.8, 0.22, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Рога — не просто ветки: у основания есть тяжесть, кончики тоньше.
  if (d.coat.antlers) {
    const antler = d.coat.spots ? { r: 158, g: 119, b: 79 } : { r: 118, g: 88, b: 62 };
    const antCol = litc(antler, atm, boost);
    ctx.strokeStyle = css(antCol, 0.97);
    ctx.lineCap = 'round';
    for (const side of [-1, 1]) {
      const rootX = headX - 0.5 + side * 1.05;
      ctx.lineWidth = 1.55;
      ctx.beginPath();
      ctx.moveTo(rootX, headY - 2.3);
      ctx.bezierCurveTo(
        rootX + side * 0.4,
        headY - 5.0,
        rootX + side * 2.2,
        headY - 6.4,
        rootX + side * 1.75,
        headY - 9.0,
      );
      ctx.stroke();
      ctx.lineWidth = 0.95;
      ctx.beginPath();
      ctx.moveTo(rootX + side * 1.0, headY - 5.6);
      ctx.lineTo(rootX + side * 3.1, headY - 7.2);
      ctx.moveTo(rootX + side * 1.65, headY - 7.0);
      ctx.lineTo(rootX + side * 2.5, headY - 9.3);
      ctx.stroke();
    }
  }

  // При пастьбе несколько травинок связывают морду с местом действия.
  if (grazing) {
    ctx.strokeStyle = css(litc({ r: 104, g: 132, b: 73 }, atm), 0.6);
    ctx.lineWidth = 0.65;
    for (let i = -1; i <= 1; i++) {
      ctx.beginPath();
      ctx.moveTo(headX + 3.2 + i * 0.5, headY + 1.8);
      ctx.lineTo(headX + 3.0 + i * 0.7, headY + 4.2);
      ctx.stroke();
    }
  }
  ctx.restore();
}

// ---------------- Ёжик ----------------

export function drawHedgehog(ctx: Ctx, e: Hedgehog, x: number, y: number, atm: Atmosphere, time: number): void {
  const curl = e.state === 'curl';
  const base = { r: 102, g: 88, b: 72 };
  const boost = atm.lightAmount < 0.4 ? 0.12 : 0;
  const body = litc(base, atm, boost);
  const spiky = litc({ r: 78, g: 66, b: 54 }, atm, boost);
  const spikyDeep = litc({ r: 62, g: 52, b: 42 }, atm, boost);
  const light = litc({ r: 222, g: 210, b: 192 }, atm, boost);
  const nose = litc({ r: 42, g: 36, b: 32 }, atm, 0);
  const pink = litc({ r: 196, g: 162, b: 158 }, atm, boost);

  ctx.save();
  ctx.translate(x, y);
  ctx.scale(1.02, 1.02);

  ctx.save();
  ctx.globalCompositeOperation = 'multiply';
  softShadow(ctx, 0, 0, curl ? 7 : 10, curl ? 2.8 : 3.0, atm.shadowTint, atm.shadowAmount * (curl ? 0.9 : 1.15));
  ctx.restore();

  ctx.scale(e.facing, 1);

  if (curl) {
    const pulse = 0.92 + Math.sin(time * 0.0025 + e.seed) * 0.08;
    // шар — акварельный blob
    washBlob(ctx, 0, -5.5 * pulse, 8.8, 6.8, spiky, 81 + (e.seed % 11), { alpha: 0.78, edge: 0.38 });
    // иголки по кругу — короткие штрихи, как у дзэн-ежа
    ctx.strokeStyle = css(light, 0.72);
    ctx.lineWidth = 1.0;
    ctx.lineCap = 'round';
    for (let i = 0; i < 20; i++) {
      const a = (i / 20) * Math.PI * 2 + e.seed * 0.11;
      const r0 = 5.2 + Math.sin(a * 2.3 + time * 0.001) * 0.4;
      const r1 = 10.2 + Math.cos(a * 3.1) * 0.9;
      const x0 = Math.cos(a) * r0;
      const y0 = -5.5 + Math.sin(a) * r0 * 0.58;
      const x1 = Math.cos(a) * r1;
      const y1 = -5.5 + Math.sin(a) * r1 * 0.58;
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.lineTo(x1, y1);
      ctx.stroke();
    }
    // носик выглядывает из клубка
    ctx.fillStyle = css(nose, 0.92);
    ctx.beginPath();
    ctx.ellipse(1.2, -4.2, 1.0, 0.75, 0.15, 0, Math.PI * 2);
    ctx.fill();
    // лапки поджаты — маленькие тени
    ctx.fillStyle = css(spikyDeep, 0.35);
    ctx.beginPath();
    ctx.ellipse(-2, -1, 1.2, 0.6, 0, 0, Math.PI * 2);
    ctx.ellipse(2, -1, 1.2, 0.6, 0, 0, Math.PI * 2);
    ctx.fill();
  } else {
    const bob = Math.sin(time * 0.0035 + e.seed) * 0.55;
    const sniff = e.state === 'sniff' ? Math.sin(time * 0.018) * 1.4 : 0;

    // лапки — короткие, с когтями
    ctx.strokeStyle = css(spikyDeep, 0.88);
    ctx.lineWidth = 1.4;
    ctx.lineCap = 'round';
    const gait = e.state === 'walk' || e.state === 'enter' ? Math.sin(e.phase * Math.PI * 6) : 0;
    ctx.beginPath();
    ctx.moveTo(-4.2, -3.2);
    ctx.lineTo(-4.2 - gait * 0.9, 0.2);
    ctx.moveTo(4.2, -3.2);
    ctx.lineTo(4.2 + gait * 0.9, 0.2);
    ctx.moveTo(-1.2, -2.8);
    ctx.lineTo(-1.2 - gait * 0.5, 0.4);
    ctx.moveTo(1.2, -2.8);
    ctx.lineTo(1.2 + gait * 0.5, 0.4);
    ctx.stroke();

    // тело — пухлый овал
    washBlob(ctx, 0, -5.8 + bob, 8.6, 4.6, body, 33 + (e.seed % 11), { alpha: 0.74, edge: 0.32 });

    // спинка с иголками — тёмная шапка
    ctx.fillStyle = css(spiky, 0.78);
    ctx.beginPath();
    ctx.ellipse(-0.3, -9.2 + bob, 6.8, 3.6, -0.08, 0, Math.PI * 2);
    ctx.fill();
    // иголки — лёгкие светлые точки и штрихи
    ctx.fillStyle = css(light, 0.42);
    for (let i = 0; i < 10; i++) {
      const sx = -5.2 + ((i * 53 + e.seed) % 11);
      const sy = -10.2 + ((i * 29 + e.seed) % 6) + bob;
      ctx.beginPath();
      ctx.arc(sx, sy, 0.45, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.strokeStyle = css(light, 0.28);
    ctx.lineWidth = 0.6;
    for (let i = 0; i < 6; i++) {
      const sx = -4 + i * 1.6;
      ctx.beginPath();
      ctx.moveTo(sx, -11 + bob);
      ctx.lineTo(sx + 0.3, -7.5 + bob);
      ctx.stroke();
    }

    // мордочка — светлая, вытянутая
    ctx.fillStyle = css(light, 0.96);
    ctx.beginPath();
    ctx.ellipse(6.2 + sniff * 0.35, -5.8 + bob, 3.6, 2.2, 0.18, 0, Math.PI * 2);
    ctx.fill();
    // носик — тёмный, блестящий
    ctx.fillStyle = css(nose, 0.96);
    ctx.beginPath();
    ctx.ellipse(8.8 + sniff * 0.45, -5.6 + bob, 1.15, 0.85, 0.22, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = css({ r: 255, g: 255, b: 255 }, 0.42);
    ctx.beginPath();
    ctx.arc(9.1 + sniff * 0.45, -6.0 + bob, 0.22, 0, Math.PI * 2);
    ctx.fill();
    // глаз — маленький, чёрный, с бликом
    ctx.fillStyle = css({ r: 28, g: 24, b: 22 }, 0.92);
    ctx.beginPath();
    ctx.arc(5.4, -7.2 + bob, 0.62, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = css({ r: 255, g: 255, b: 255 }, 0.62);
    ctx.beginPath();
    ctx.arc(5.6, -7.5 + bob, 0.18, 0, Math.PI * 2);
    ctx.fill();
    // ушко — маленькое, розоватое внутри
    ctx.fillStyle = css(body, 0.9);
    ctx.beginPath();
    ctx.ellipse(2.2, -8.2 + bob, 1.1, 1.4, -0.18, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = css(pink, 0.55);
    ctx.beginPath();
    ctx.ellipse(2.2, -8.2 + bob, 0.5, 0.7, -0.18, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

// ---------------- Мышка ----------------

export function drawMouse(ctx: Ctx, m: Mouse, x: number, y: number, atm: Atmosphere, time: number): void {
  const bodyBase = { r: 142, g: 132, b: 122 };
  const boost = atm.lightAmount < 0.4 ? 0.1 : 0;
  const body = litc(bodyBase, atm, boost);
  const deep = litc(shade(bodyBase, 0.72), atm, boost);
  const deep2 = litc(shade(bodyBase, 0.58), atm, boost);
  const belly = litc({ r: 234, g: 226, b: 214 }, atm, boost);
  const pink = litc({ r: 212, g: 168, b: 168 }, atm, boost);
  const pinkDeep = litc({ r: 188, g: 138, b: 138 }, atm, boost);
  const flee = m.state === 'flee';
  const hide = m.state === 'hide';

  ctx.save();
  ctx.translate(x, y);
  ctx.scale(0.78, 0.78);

  ctx.save();
  ctx.globalCompositeOperation = 'multiply';
  softShadow(ctx, 0, 0, flee ? 5 : 8, flee ? 2.0 : 2.4, atm.shadowTint, atm.shadowAmount * 0.92);
  ctx.restore();

  ctx.scale(m.facing, 1);

  if (hide) {
    // прячется — только ушки и спинка
    ctx.fillStyle = css(body, 0.88);
    ctx.beginPath();
    ctx.ellipse(0, -1.8, 3.8, 2.4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = css(pink, 0.88);
    for (const sx of [-1.3, 1.3]) {
      ctx.beginPath();
      ctx.ellipse(sx, -3.8, 1.1, 1.4, sx * 0.18, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = css(body, 0.72);
    ctx.beginPath();
    ctx.ellipse(0, -0.8, 2.0, 0.8, 0, 0, Math.PI * 2);
    ctx.fill();
  } else {
    const bob = flee ? Math.abs(Math.sin(m.phase * Math.PI * 8)) * 1.4 : Math.sin(time * 0.007 + m.seed) * 0.45;
    const runStretch = flee ? 1.22 : 1;
    const tailWag = flee ? Math.sin(m.phase * Math.PI * 10) * 2.2 : Math.sin(time * 0.009 + m.seed) * 1.0;

    // хвост — тонкий, изящный, с изгибом
    ctx.strokeStyle = css(deep, 0.78);
    ctx.lineWidth = 0.85;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-4.2, -3.2);
    ctx.bezierCurveTo(-8.5, -4.2 + tailWag * 0.3, -12.8, -2.0 + tailWag * 0.5, -15.2, -3.0);
    ctx.stroke();
    // кончик хвоста светлее
    ctx.strokeStyle = css(pinkDeep, 0.42);
    ctx.lineWidth = 0.55;
    ctx.beginPath();
    ctx.moveTo(-12.8, -2.2);
    ctx.lineTo(-15.2, -3.0);
    ctx.stroke();

    // лапки
    ctx.strokeStyle = css(deep, 0.88);
    ctx.lineWidth = 0.9;
    const gait = flee ? Math.sin(m.phase * Math.PI * 12) * 1.1 : Math.sin(time * 0.018 + m.seed) * 0.45;
    ctx.beginPath();
    ctx.moveTo(-2.2, -3.0);
    ctx.lineTo(-2.2 - gait, 0.2);
    ctx.moveTo(2.2, -3.0);
    ctx.lineTo(2.2 + gait, 0.2);
    ctx.stroke();

    // тело — акварельный blob, пухлое
    ctx.save();
    ctx.scale(runStretch, 1);
    washBlob(ctx, 0, -4.2 + bob, 5.0, 2.8, body, 19 + (m.seed % 9), { alpha: 0.76, edge: 0.3 });
    ctx.restore();

    // брюшко — светлое
    ctx.fillStyle = css(belly, 0.62);
    ctx.beginPath();
    ctx.ellipse(0.3, -3.0 + bob, 2.4, 1.3, 0, 0, Math.PI * 2);
    ctx.fill();

    // голова — круглая, с большими ушами
    ctx.fillStyle = css(body, 0.97);
    ctx.beginPath();
    ctx.ellipse(4.4, -5.2 + bob, 2.6, 2.0, 0.18, 0, Math.PI * 2);
    ctx.fill();

    // уши — большие, розовые внутри, главный признак мышки
    for (const s of [-1, 1]) {
      ctx.fillStyle = css(body, 0.92);
      ctx.beginPath();
      ctx.ellipse(3.4 + s * 0.35, -7.2 + bob, 2.0, 2.4, s * 0.28, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = css(pink, 0.88);
      ctx.beginPath();
      ctx.ellipse(3.4 + s * 0.35, -7.2 + bob, 1.0, 1.4, s * 0.28, 0, Math.PI * 2);
      ctx.fill();
      // кайма уха
      ctx.strokeStyle = css(pinkDeep, 0.22);
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.ellipse(3.4 + s * 0.35, -7.2 + bob, 2.0, 2.4, s * 0.28, 0, Math.PI * 2);
      ctx.stroke();
    }

    // носик — розовый, с усами
    ctx.fillStyle = css(pinkDeep, 0.9);
    ctx.beginPath();
    ctx.ellipse(6.8, -5.0 + bob, 0.55, 0.45, 0.2, 0, Math.PI * 2);
    ctx.fill();
    // усы — тонкие линии
    ctx.strokeStyle = css(deep2, 0.32);
    ctx.lineWidth = 0.35;
    for (let i = -1; i <= 1; i++) {
      ctx.beginPath();
      ctx.moveTo(6.5, -5.0 + bob + i * 0.35);
      ctx.lineTo(8.0, -5.2 + bob + i * 0.5);
      ctx.stroke();
    }

    // глаза — большие, чёрные, с бликом, как у полёвки
    ctx.fillStyle = css({ r: 36, g: 30, b: 28 }, 0.94);
    ctx.beginPath();
    ctx.arc(5.0, -5.8 + bob, 0.58, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = css({ r: 255, g: 255, b: 255 }, 0.68);
    ctx.beginPath();
    ctx.arc(5.2, -6.1 + bob, 0.18, 0, Math.PI * 2);
    ctx.fill();
    // второй глаз чуть виден
    ctx.fillStyle = css({ r: 36, g: 30, b: 28 }, 0.42);
    ctx.beginPath();
    ctx.arc(3.6, -6.2 + bob, 0.38, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

// ---------------- Сова ----------------

export function drawOwl(ctx: Ctx, o: Owl, x: number, y: number, atm: Atmosphere, time: number): void {
  const flying = o.state === 'fly-in' || o.state === 'fly-out' || o.state === 'hunt' || o.state === 'look';
  const perched = o.state === 'perch' || o.state === 'hoot';
  const bodyBase = { r: 118, g: 104, b: 86 };
  const boost = atm.lightAmount < 0.35 ? 0.2 : 0;
  const body = litc(bodyBase, atm, boost);
  const deep = litc(shade(bodyBase, 0.62), atm, boost);
  const deep2 = litc(shade(bodyBase, 0.52), atm, boost);
  const pale = litc({ r: 232, g: 222, b: 200 }, atm, boost);
  const pale2 = litc({ r: 218, g: 208, b: 186 }, atm, boost);
  const eyeYellow = litc({ r: 244, g: 204, b: 72 }, atm, boost * 0.3);
  const eyeOutline = litc({ r: 62, g: 52, b: 42 }, atm, 0);

  ctx.save();
  ctx.translate(x, y);
  ctx.scale(1.22, 1.22);

  // Тень — мягкая, на земле
  ctx.save();
  ctx.globalCompositeOperation = 'multiply';
  softShadow(
    ctx,
    0,
    0,
    flying ? 10 : perched ? 15 : 9,
    perched ? 4.8 : 3.2,
    atm.shadowTint,
    atm.shadowAmount * (perched ? 0.52 : 1.05),
  );
  ctx.restore();

  ctx.scale(o.facing, 1);

  const hoot = o.state === 'hoot' ? Math.sin(time * 0.018) * 0.7 : 0;
  const lift = flying
    ? -24 - Math.sin(time * 0.004 + o.seed) * 2.8
    : perched
      ? -36 - Math.sin(time * 0.0011 + o.seed) * 0.7
      : -12;
  ctx.translate(0, lift + hoot * 0.35);

  if (flying) {
    const flap = Math.sin(time * 0.013 + o.seed) * 0.75;
    ctx.fillStyle = css(deep, 0.88);
    for (const s of [-1, 1]) {
      ctx.save();
      ctx.translate(s * 1.2, -13);
      ctx.rotate(s * (0.45 + flap));
      ctx.beginPath();
      ctx.ellipse(s * -6.5, 0, 12, 3.8, s * 0.18, 0, Math.PI * 2);
      ctx.fill();
      // маховые перья — лёгкая штриховка
      ctx.strokeStyle = css(deep2, 0.35);
      ctx.lineWidth = 0.6;
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.moveTo(s * (-2 - i * 2.2), -1.2);
        ctx.lineTo(s * (-4 - i * 2.2), 1.4);
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  // ветка — подчёркивает, что сидит НА ветке, а не под деревом
  if (perched) {
    ctx.strokeStyle = css(deep, 0.58);
    ctx.lineWidth = 1.4;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-7.5, -1.2);
    ctx.quadraticCurveTo(0, -3.0, 7.5, -1.2);
    ctx.stroke();
    // мох на ветке — дзэн-деталь
    ctx.fillStyle = css(litc({ r: 96, g: 108, b: 78 }, atm, 0), 0.22);
    ctx.beginPath();
    ctx.ellipse(0, -2.2, 3.2, 0.7, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // --- Тело: пухлый бочонок, как у настоящей совы ---
  // сложенные крылья — тёмные бока
  ctx.fillStyle = css(deep, 0.92);
  ctx.beginPath();
  ctx.ellipse(-4.2, -9.5, 3.6, 6.8, -0.12, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(4.2, -9.5, 3.6, 6.8, 0.12, 0, Math.PI * 2);
  ctx.fill();

  // основное тело — акварельный blob
  washBlob(ctx, 0, -10.5, 8.2, 7.2, body, 91 + (o.seed % 13), { alpha: 0.78, edge: 0.34 });

  // грудка — светлая с пестринами
  ctx.fillStyle = css(pale, 0.68);
  ctx.beginPath();
  ctx.ellipse(0, -7.8, 5.0, 4.6, 0, 0, Math.PI * 2);
  ctx.fill();
  // пестрины — вертикальные штрихи, как у неясыти
  ctx.strokeStyle = css(deep, 0.22);
  ctx.lineWidth = 0.55;
  for (let i = -2; i <= 2; i++) {
    const sx = i * 1.1 + ((o.seed % 5) - 2) * 0.2;
    ctx.beginPath();
    ctx.moveTo(sx, -11);
    ctx.lineTo(sx + 0.2, -5.5);
    ctx.stroke();
  }
  // тёмные пятнышки
  ctx.fillStyle = css(deep2, 0.18);
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    ctx.arc(-2 + i * 2 + Math.sin(o.seed + i) * 0.5, -8 + Math.cos(o.seed + i) * 0.8, 0.45, 0, Math.PI * 2);
    ctx.fill();
  }

  // --- Голова: большая, почти без шеи — главный признак совы ---
  const headY = -19.5 + hoot * 0.6;
  // затылок — тёмный, объём
  ctx.fillStyle = css(body, 0.98);
  ctx.beginPath();
  ctx.ellipse(0, headY, 7.2, 6.2, 0, 0, Math.PI * 2);
  ctx.fill();

  // лицевой диск — светлый круг, как маска
  washBlob(ctx, 0, headY - 0.3, 6.0, 5.0, pale, 12 + (o.seed % 7), { alpha: 0.92, edge: 0.22 });
  // тёмная кайма вокруг диска — подчёркивает круглое лицо
  ctx.strokeStyle = css(deep, 0.18);
  ctx.lineWidth = 0.9;
  ctx.beginPath();
  ctx.ellipse(0, headY, 6.0, 5.0, 0, 0, Math.PI * 2);
  ctx.stroke();

  // ушки-кисточки — более совиные, с тёмными кончиками
  ctx.fillStyle = css(body, 0.96);
  for (const s of [-1, 1]) {
    ctx.save();
    ctx.translate(s * 4.2, headY - 4.8);
    ctx.rotate(s * -0.18);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(s * 0.6, -4.2);
    ctx.lineTo(s * -0.4, -0.2);
    ctx.closePath();
    ctx.fill();
    // тёмный кончик
    ctx.fillStyle = css(deep2, 0.85);
    ctx.beginPath();
    ctx.moveTo(s * 0.2, -2.2);
    ctx.lineTo(s * 0.6, -4.2);
    ctx.lineTo(s * -0.1, -2.8);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = css(body, 0.96);
    ctx.restore();
  }

  // глаза — большие, вперёд, совиные
  for (const sx of [-2.1, 2.1]) {
    const ey = headY - 0.6;
    // тёмная оправа глаза
    ctx.fillStyle = css(eyeOutline, 0.85);
    ctx.beginPath();
    ctx.ellipse(sx, ey, 2.7, 2.9, 0, 0, Math.PI * 2);
    ctx.fill();
    // радужка — крупная, жёлтая
    ctx.fillStyle = css(eyeYellow, 0.98);
    ctx.beginPath();
    ctx.arc(sx, ey, 2.1, 0, Math.PI * 2);
    ctx.fill();
    // зрачок — большой, чёрный, как у ночной совы
    ctx.fillStyle = css({ r: 22, g: 18, b: 14 }, 0.96);
    ctx.beginPath();
    ctx.arc(sx, ey + 0.1, 1.15, 0, Math.PI * 2);
    ctx.fill();
    // блик — живой взгляд
    ctx.fillStyle = css({ r: 255, g: 255, b: 255 }, 0.85);
    ctx.beginPath();
    ctx.arc(sx + 0.5, ey - 0.5, 0.42, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = css({ r: 255, g: 255, b: 255 }, 0.32);
    ctx.beginPath();
    ctx.arc(sx - 0.3, ey + 0.5, 0.18, 0, Math.PI * 2);
    ctx.fill();
    // веко — акварельная тень сверху
    ctx.fillStyle = css(deep, 0.18);
    ctx.beginPath();
    ctx.ellipse(sx, ey - 1.6, 1.9, 0.7, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // клюв — короткий, крючковатый вниз, между глаз
  const beakY = headY + 1.2 + hoot * 0.2;
  ctx.fillStyle = css(litc({ r: 72, g: 66, b: 56 }, atm, boost), 0.96);
  ctx.beginPath();
  ctx.moveTo(0, beakY - 0.8);
  ctx.lineTo(-0.75, beakY + 1.1);
  ctx.lineTo(0.75, beakY + 1.1);
  ctx.closePath();
  ctx.fill();
  // восковица — светлее
  ctx.fillStyle = css(pale2, 0.55);
  ctx.beginPath();
  ctx.ellipse(0, beakY - 0.2, 0.6, 0.35, 0, 0, Math.PI * 2);
  ctx.fill();

  // при уханье клюв приоткрывается
  if (o.state === 'hoot') {
    ctx.fillStyle = css({ r: 48, g: 42, b: 38 }, 0.85);
    ctx.beginPath();
    ctx.ellipse(0, beakY + 1.4, 0.5, 0.35, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // лапы — когти, держат ветку
  ctx.strokeStyle = css(deep2, 0.88);
  ctx.lineWidth = 1.0;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-2.4, -3.2);
  ctx.lineTo(-2.4, -0.6);
  ctx.moveTo(-1.2, -3.4);
  ctx.lineTo(-1.2, -0.8);
  ctx.moveTo(1.2, -3.4);
  ctx.lineTo(1.2, -0.8);
  ctx.moveTo(2.4, -3.2);
  ctx.lineTo(2.4, -0.6);
  ctx.stroke();
  // когти — маленькие крючки
  ctx.fillStyle = css(deep2, 0.92);
  for (const sx of [-2.4, -1.2, 1.2, 2.4]) {
    ctx.beginPath();
    ctx.arc(sx, -0.4, 0.38, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

// ---------------- Белка ----------------

export function drawSquirrel(ctx: Ctx, s: Squirrel, x: number, y: number, atm: Atmosphere, time: number): void {
  const base = { r: 172, g: 108, b: 62 };
  const boost = atm.lightAmount < 0.45 ? 0.08 : 0;
  const body = litc(base, atm, boost);
  const deep = litc(shade(base, 0.68), atm, boost);
  const deep2 = litc(shade(base, 0.52), atm, boost);
  const pale = litc({ r: 234, g: 214, b: 190 }, atm, boost);
  const tailCol = litc({ r: 158, g: 96, b: 56 }, atm, boost);
  const tailLight = litc({ r: 210, g: 186, b: 162 }, atm, boost);

  const jumping = s.state === 'jump' || s.state === 'enter' || s.state === 'flee';
  const perched = s.state === 'forage' || s.state === 'cache' || s.state === 'look';

  ctx.save();
  ctx.translate(x, y);
  ctx.scale(0.98, 0.98);

  ctx.save();
  ctx.globalCompositeOperation = 'multiply';
  softShadow(
    ctx,
    0,
    0,
    jumping ? 5 : perched ? 13 : 9,
    perched ? 3.8 : 2.6,
    atm.shadowTint,
    atm.shadowAmount * (perched ? 0.48 : 1.02),
  );
  ctx.restore();

  ctx.scale(s.facing, 1);

  const lift = perched ? -30 : jumping ? -5 : -7;
  const bob = jumping ? 0 : Math.sin(time * 0.0055 + s.seed) * 0.6;
  ctx.translate(0, lift);
  const tailWag = Math.sin(time * 0.01 + s.seed) * 0.9;

  // хвост — пушистый, главный признак белки, акварельный
  ctx.save();
  ctx.translate(-5.2, -11 + bob);
  ctx.rotate(-0.58 + tailWag * 0.22);
  ctx.fillStyle = css(tailCol, 0.94);
  ctx.beginPath();
  ctx.ellipse(0, -4.5, 3.8, 8.2, 0.28, 0, Math.PI * 2);
  ctx.fill();
  // светлые прядки
  ctx.fillStyle = css(tailLight, 0.32);
  for (let i = 0; i < 5; i++) {
    ctx.beginPath();
    ctx.ellipse((i - 2) * 0.9, -7.5 + i * 1.4, 0.7, 1.8, 0.2, 0, Math.PI * 2);
    ctx.fill();
  }
  // тёмный контур хвоста — акварельная кромка
  ctx.strokeStyle = css(deep, 0.18);
  ctx.lineWidth = 0.7;
  ctx.beginPath();
  ctx.ellipse(0, -4.5, 3.8, 8.2, 0.28, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();

  if (perched) {
    ctx.strokeStyle = css(deep, 0.48);
    ctx.lineWidth = 1.2;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-6, -1.2);
    ctx.quadraticCurveTo(0, -2.6, 6, -1.2);
    ctx.stroke();
  }

  // лапки
  ctx.strokeStyle = css(deep, 0.9);
  ctx.lineWidth = 1.3;
  ctx.lineCap = 'round';
  const gait = jumping ? Math.sin(s.phase * Math.PI * 4) * 2.2 : 0;
  ctx.beginPath();
  ctx.moveTo(-2.4, -5.2);
  ctx.lineTo(-3.4 - gait, -0.2);
  ctx.moveTo(2.2, -5.2);
  ctx.lineTo(3.2 + gait, -0.2);
  ctx.stroke();

  // тело — компактное
  washBlob(ctx, 0, -7.5 + bob, 5.4, 3.4, body, 41 + (s.seed % 13), { alpha: 0.78, edge: 0.32 });
  ctx.fillStyle = css(pale, 0.52);
  ctx.beginPath();
  ctx.ellipse(0.4, -6.0 + bob, 2.8, 1.5, 0, 0, Math.PI * 2);
  ctx.fill();

  // орешек в лапках
  if (s.hasNut) {
    ctx.fillStyle = css(deep, 0.88);
    ctx.beginPath();
    ctx.ellipse(2.8, -7.2 + bob, 1.3, 1.1, 0.18, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = css(litc({ r: 112, g: 80, b: 54 }, atm, boost), 0.96);
    ctx.beginPath();
    ctx.ellipse(4.0, -8.2 + bob, 1.2, 1.4, 0.28, 0, Math.PI * 2);
    ctx.fill();
    // блик на орешке
    ctx.fillStyle = css({ r: 255, g: 255, b: 255 }, 0.28);
    ctx.beginPath();
    ctx.arc(4.2, -8.8 + bob, 0.22, 0, Math.PI * 2);
    ctx.fill();
  }

  // голова — круглая, с большими глазами
  ctx.fillStyle = css(body, 0.98);
  ctx.beginPath();
  ctx.ellipse(4.6, -10.6 + bob, 3.0, 2.6, 0.18, 0, Math.PI * 2);
  ctx.fill();

  // ушки — с кисточками, как у настоящей белки
  ctx.fillStyle = css(body, 0.96);
  for (const sx of [3.6, 5.8]) {
    ctx.beginPath();
    ctx.ellipse(sx, -13.0 + bob, 1.0, 1.8, sx > 4.5 ? 0.18 : -0.18, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = css(deep2, 0.92);
  for (const sx of [3.6, 5.8]) {
    ctx.beginPath();
    ctx.moveTo(sx, -14.2 + bob);
    ctx.lineTo(sx + (sx > 4.5 ? 0.4 : -0.3), -15.8 + bob);
    ctx.lineTo(sx + (sx > 4.5 ? -0.2 : 0.2), -14.0 + bob);
    ctx.closePath();
    ctx.fill();
  }

  // мордочка — светлая
  ctx.fillStyle = css(pale, 0.92);
  ctx.beginPath();
  ctx.ellipse(6.3, -10.0 + bob, 1.3, 1.0, 0.18, 0, Math.PI * 2);
  ctx.fill();
  // носик
  ctx.fillStyle = css({ r: 48, g: 38, b: 34 }, 0.92);
  ctx.beginPath();
  ctx.arc(7.0, -10.0 + bob, 0.42, 0, Math.PI * 2);
  ctx.fill();
  // глаз — большой, чёрный, с бликом
  ctx.fillStyle = css({ r: 38, g: 32, b: 28 }, 0.94);
  ctx.beginPath();
  ctx.arc(5.0, -11.2 + bob, 0.55, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = css({ r: 255, g: 255, b: 255 }, 0.72);
  ctx.beginPath();
  ctx.arc(5.2, -11.5 + bob, 0.18, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

// ---------------- Черепаха ----------------

export function drawTurtle(ctx: Ctx, t: Turtle, x: number, y: number, atm: Atmosphere, time: number): void {
  // Панцирь теперь собран как маленький объёмный дом: нижняя кайма,
  // отдельные щитки и световая полоса делают его узнаваемым даже в тени.
  const shellBase = { r: 82, g: 108, b: 76 };
  const shell = litc(shellBase, atm, atm.lightAmount < 0.5 ? 0.1 : 0);
  const shellDeep = litc(shade(shellBase, 0.55), atm, 0.05);
  const shellLight = litc({ r: 164, g: 172, b: 118 }, atm, 0.08);
  const skin = litc({ r: 124, g: 143, b: 103 }, atm, 0.06);
  const skinDeep = litc({ r: 72, g: 91, b: 66 }, atm, 0.02);
  const belly = litc({ r: 211, g: 199, b: 158 }, atm, 0.03);
  const moving = t.state === 'enter' || t.state === 'walk' || t.state === 'swim' || t.state === 'leave';
  const hiding = t.state === 'hide';
  const swimming = t.state === 'swim';
  const step = moving ? Math.sin(time * (swimming ? 0.008 : 0.005) + t.seed) : 0;
  const breathe = Math.sin(time * 0.0011 + t.seed) * 0.35;

  ctx.save();
  ctx.translate(x, y);
  ctx.scale(1.18, 1.18);
  ctx.save();
  ctx.globalCompositeOperation = 'multiply';
  softShadow(ctx, 0, 0, swimming ? 12 : 13, 3.9, atm.shadowTint, atm.shadowAmount * 1.12);
  ctx.restore();
  ctx.scale(t.facing, 1);

  // Вода отвечает на плавание двумя мягкими следами.
  if (swimming) {
    ctx.strokeStyle = css(litc({ r: 210, g: 234, b: 225 }, atm), 0.42);
    ctx.lineWidth = 0.75;
    for (const oy of [-2.3, 2.3]) {
      ctx.beginPath();
      ctx.ellipse(-3, oy + 2, 14 + Math.abs(step) * 2, 3.2, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  // Четыре лапы: диагональная смена опоры делает медленный шаг заметным.
  const limbs = [-5.3, -2.8, 2.9, 5.4];
  for (let i = 0; i < limbs.length; i++) {
    const sx = limbs[i];
    const swing = moving ? Math.sin(time * 0.005 + t.seed + i * Math.PI) * 0.8 : 0;
    ctx.fillStyle = css(i < 2 ? skinDeep : skin, i < 2 ? 0.7 : 0.92);
    ctx.beginPath();
    ctx.ellipse(
      sx + swing,
      -0.6 + Math.abs(swing) * 0.15,
      swimming ? 2.5 : 2.15,
      swimming ? 1.0 : 1.5,
      swing * 0.12,
      0,
      Math.PI * 2,
    );
    ctx.fill();
    if (!swimming) {
      ctx.strokeStyle = css(skinDeep, 0.6);
      ctx.lineWidth = 0.45;
      for (let c = -1; c <= 1; c++) {
        ctx.beginPath();
        ctx.moveTo(sx + swing + c * 0.55, 0.1);
        ctx.lineTo(sx + swing + c * 0.75, 0.9);
        ctx.stroke();
      }
    }
  }

  // Нижняя часть панциря и купол, слегка дышащий на солнце.
  ctx.fillStyle = css(shellDeep, 0.82);
  ctx.beginPath();
  ctx.ellipse(0, -3.0 + breathe, 9.7, 5.25, 0, 0, Math.PI * 2);
  ctx.fill();
  washBlob(ctx, 0, -6.3 + breathe, 9.1, 6.0, shell, 61 + (t.seed % 19), {
    layers: 3,
    alpha: 0.86,
    edge: 0.44,
    wobble: 0.13,
  });
  // светлая дуга объёма
  ctx.fillStyle = css(shellLight, 0.3);
  ctx.beginPath();
  ctx.ellipse(-1.9, -9.3 + breathe, 4.5, 1.8, -0.15, 0, Math.PI * 2);
  ctx.fill();

  // Щитки — центральный и боковые, с живой неровностью вместо сетки.
  ctx.strokeStyle = css(shellDeep, 0.62);
  ctx.lineWidth = 0.72;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(0, -11.0 + breathe);
  ctx.lineTo(0, -2.4 + breathe);
  ctx.moveTo(-4.3, -9.0 + breathe);
  ctx.quadraticCurveTo(-2.4, -6.5 + breathe, -3.0, -3.0 + breathe);
  ctx.moveTo(4.3, -9.0 + breathe);
  ctx.quadraticCurveTo(2.4, -6.5 + breathe, 3.0, -3.0 + breathe);
  ctx.stroke();
  for (const sy of [-9.0, -6.6, -4.3]) {
    ctx.beginPath();
    ctx.moveTo(-6.5, sy + breathe);
    ctx.quadraticCurveTo(0, sy + 0.55 + breathe, 6.5, sy + breathe);
    ctx.stroke();
  }
  ctx.strokeStyle = css(shellLight, 0.3);
  ctx.lineWidth = 0.55;
  ctx.beginPath();
  ctx.ellipse(0, -6.2 + breathe, 8.05, 5.05, 0, 0, Math.PI * 2);
  ctx.stroke();

  // Брюшко выглядывает только снизу — важная тёплая деталь профиля.
  ctx.fillStyle = css(belly, 0.5);
  ctx.beginPath();
  ctx.ellipse(-0.3, -1.9, 5.8, 1.3, 0, 0, Math.PI * 2);
  ctx.fill();

  if (!hiding) {
    const extend = swimming ? 3.2 : t.state === 'look' || t.state === 'bask' ? 2.2 : 1.2;
    const headX = 7.3 + extend * 0.45;
    const headY = -6.9 + (t.state === 'bask' ? -1.0 : 0) + breathe;
    ctx.fillStyle = css(skin, 0.92);
    ctx.beginPath();
    ctx.ellipse(4.9 + extend * 0.25, -5.6 + breathe, 3.2 + extend * 0.15, 1.35, 0.08, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = css(skinDeep, 0.27);
    ctx.lineWidth = 0.5;
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.moveTo(3.4 + i * 0.9, -6.4 + breathe);
      ctx.quadraticCurveTo(3.7 + i * 0.9, -5.3 + breathe, 4.0 + i * 0.9, -4.8 + breathe);
      ctx.stroke();
    }
    ctx.fillStyle = css(skin, 0.98);
    ctx.beginPath();
    ctx.ellipse(headX, headY, 2.85, 1.95, 0.12, 0, Math.PI * 2);
    ctx.fill();
    // Головка тянется вперёд, взгляд и ноздря не теряются в панцире.
    ctx.fillStyle = css(shellDeep, 0.76);
    ctx.beginPath();
    ctx.moveTo(headX + 2.0, headY - 0.35);
    ctx.lineTo(headX + 3.4, headY + 0.08);
    ctx.lineTo(headX + 2.0, headY + 0.66);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = css({ r: 48, g: 48, b: 39 }, 0.72);
    ctx.beginPath();
    ctx.arc(headX + 2.35, headY - 0.02, 0.18, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = css({ r: 35, g: 38, b: 30 }, 0.94);
    ctx.beginPath();
    ctx.arc(headX + 0.55, headY - 0.55, 0.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = css({ r: 255, g: 255, b: 220 }, 0.66);
    ctx.beginPath();
    ctx.arc(headX + 0.75, headY - 0.76, 0.17, 0, Math.PI * 2);
    ctx.fill();
  } else {
    // В прятках остаётся маленькая тень головы, но панцирь не исчезает.
    ctx.fillStyle = css(skinDeep, 0.68);
    ctx.beginPath();
    ctx.ellipse(6.0, -5.6 + breathe, 1.3, 0.8, 0.12, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

// ---------------- Пчела ----------------

export function drawBee(ctx: Ctx, b: Bee, x: number, y: number, atm: Atmosphere, time: number): void {
  if (b.alpha <= 0.02) return;
  const bodyBase = { r: 72, g: 66, b: 56 };
  const body = litc(bodyBase, atm);
  const bodyDeep = litc(shade(bodyBase, 0.62), atm);
  const yellow = litc({ r: 242, g: 202, b: 68 }, atm);
  const yellowDeep = litc({ r: 210, g: 168, b: 48 }, atm);
  const wing = litc({ r: 214, g: 224, b: 232 }, atm);
  const wingEdge = litc({ r: 184, g: 196, b: 206 }, atm);

  ctx.save();
  ctx.translate(x, y - b.alt);
  ctx.scale(0.72, 0.72);

  const flap = Math.sin(time * 0.058 + b.seed) * 1.1;
  const hover = Math.sin(time * 0.0038 + b.seed) * 1.3;

  ctx.translate(0, hover);

  // крылья — полупрозрачные, с жилками, трепещут
  for (const s of [-1, 1]) {
    ctx.save();
    ctx.scale(s, 1);
    ctx.rotate(s * flap * 0.35);
    ctx.fillStyle = css(wing, 0.38 * b.alpha);
    ctx.beginPath();
    ctx.ellipse(1.6, -1.2, 3.0, 1.35, 0.32, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = css(wingEdge, 0.28 * b.alpha);
    ctx.lineWidth = 0.4;
    ctx.beginPath();
    ctx.ellipse(1.6, -1.2, 3.0, 1.35, 0.32, 0, Math.PI * 2);
    ctx.stroke();
    // жилка
    ctx.beginPath();
    ctx.moveTo(0.2, -0.8);
    ctx.lineTo(3.2, -1.4);
    ctx.stroke();
    ctx.restore();
  }

  // тело — мохнатое, полосатое
  ctx.fillStyle = css(body, 0.96 * b.alpha);
  ctx.beginPath();
  ctx.ellipse(0, 0, 2.4, 1.8, 0, 0, Math.PI * 2);
  ctx.fill();
  // пушок — светлые точки
  ctx.fillStyle = css({ r: 232, g: 220, b: 188 }, 0.18 * b.alpha);
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    ctx.arc(-0.8 + i * 0.8, -0.6 + (i % 2) * 0.4, 0.3, 0, Math.PI * 2);
    ctx.fill();
  }

  // полоски — жёлтые, с тёмной каймой
  ctx.fillStyle = css(yellow, 0.96 * b.alpha);
  ctx.beginPath();
  ctx.ellipse(0, -0.4, 2.0, 0.55, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = css(yellowDeep, 0.92 * b.alpha);
  ctx.beginPath();
  ctx.ellipse(0, 0.5, 1.8, 0.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = css(bodyDeep, 0.32 * b.alpha);
  ctx.lineWidth = 0.35;
  ctx.beginPath();
  ctx.moveTo(-1.9, -0.1);
  ctx.lineTo(1.9, -0.1);
  ctx.moveTo(-1.7, 0.8);
  ctx.lineTo(1.7, 0.8);
  ctx.stroke();

  // голова — маленькая
  ctx.fillStyle = css(bodyDeep, 0.92 * b.alpha);
  ctx.beginPath();
  ctx.arc(1.8, -0.2, 0.9, 0, Math.PI * 2);
  ctx.fill();
  // глаз
  ctx.fillStyle = css({ r: 28, g: 24, b: 20 }, 0.88 * b.alpha);
  ctx.beginPath();
  ctx.arc(2.1, -0.3, 0.35, 0, Math.PI * 2);
  ctx.fill();

  // пыльца
  if (b.carrying) {
    ctx.fillStyle = css(litc({ r: 242, g: 202, b: 108 }, atm, 0.12), 0.88 * b.alpha);
    ctx.beginPath();
    ctx.arc(0, 1.4, 1.0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = css(litc({ r: 255, g: 232, b: 160 }, atm, 0.18), 0.52 * b.alpha);
    ctx.beginPath();
    ctx.arc(0.2, 1.2, 0.4, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}
