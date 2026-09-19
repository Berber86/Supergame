/**
 * Отрисовка диких соседей: светлячок, цапля, олень, ёжик, мышка, сова, белка, черепаха, пчёлы.
 */

import { Atmosphere, RGB, css, mix, shade } from '../world/palette';
import { Bee, Firefly, Moth, Mouse, Owl, fireflyGlow } from '../world/wildlife';
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

export { drawHeron } from './heron';

// ---------------- Олень ----------------

export { drawDeer } from './deerTurtle';

// ---------------- Ёжик ----------------

export { drawHedgehog } from './forestAnimals';

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
  softShadow(ctx, 0, 0, flying ? 10 : perched ? 15 : 9, perched ? 4.8 : 3.2, atm.shadowTint, atm.shadowAmount * (perched ? 0.52 : 1.05));
  ctx.restore();

  ctx.scale(o.facing, 1);

  const hoot = o.state === 'hoot' ? Math.sin(time * 0.018) * 0.7 : 0;
  let lift = 0;
  if (flying) lift = -24 - Math.sin(time * 0.004 + o.seed) * 2.8;
  else if (perched) lift = -36 - Math.sin(time * 0.0011 + o.seed) * 0.7;
  else lift = -12;
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

export { drawSquirrel } from './forestAnimals';

// ---------------- Черепаха ----------------

export { drawTurtle } from './deerTurtle';

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
