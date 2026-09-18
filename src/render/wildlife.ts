/**
 * Отрисовка диких соседей: светлячок, цапля, олень, ёжик, мышка, сова, белка, черепаха, пчёлы.
 */

import { Atmosphere, RGB, css, mix, shade } from '../world/palette';
import { Bee, Deer, Firefly, Hedgehog, Heron, Mouse, Owl, Squirrel, Turtle, fireflyGlow } from '../world/wildlife';
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
  ctx.save();
  ctx.globalCompositeOperation = 'multiply';
  softShadow(ctx, 0, 0, flying ? 12 : 8, 3, atm.shadowTint, atm.shadowAmount * (flying ? 0.5 : 1.2));
  ctx.restore();

  const lift = flying ? -30 - Math.sin(time * 0.004) * 3 : 0;
  ctx.translate(0, lift);
  ctx.scale(hr.facing * 1.18, 1.18);

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

  washBlob(ctx, 0, -15, 10.5, 5.0, body, 41, { alpha: 0.62, edge: 0.3 });
  ctx.fillStyle = css(deep, 0.4);
  ctx.beginPath();
  ctx.ellipse(-1, -15.6, 6.2, 2.6, -0.08, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = css(pale, 0.5);
  ctx.beginPath();
  ctx.ellipse(1, -13.4, 5.4, 2.6, -0.1, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = css(deep, 0.85);
  ctx.beginPath();
  ctx.moveTo(-8, -16.4);
  ctx.lineTo(-12.5, -14.6);
  ctx.lineTo(-7.6, -13.6);
  ctx.closePath();
  ctx.fill();

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

  washBlob(ctx, 0, -15.5, 10.5, 5.4, body, 57, { alpha: 0.62, edge: 0.3 });
  ctx.fillStyle = css(pale, 0.4);
  ctx.beginPath();
  ctx.ellipse(0, -12.6, 6.5, 2.2, 0, 0, Math.PI * 2);
  ctx.fill();

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

  const nx = graze ? 10 : 9;
  const ny = graze ? -11 : -26 + Math.sin(time * 0.0018 + d.seed) * 0.6;
  ctx.strokeStyle = css(body, 0.96);
  ctx.lineWidth = 3.6;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(7, -18);
  if (graze) {
    // Плавная дуга вниз-вперёд: шея не ломается через грудь, а уходит
    // мягкой S-кривой к земле, голова чуть впереди тела
    ctx.bezierCurveTo(8.5, -13, 9.5, -9, nx, ny);
  } else {
    ctx.bezierCurveTo(nx + 1.5, -24, nx + 0.5, -25, nx, ny);
  }
  ctx.stroke();

  ctx.fillStyle = css(body, 0.98);
  ctx.beginPath();
  ctx.ellipse(nx + 1, ny, 3, 2.1, graze ? 0.5 : 0.1, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = css(deep, 0.9);
  ctx.beginPath();
  ctx.ellipse(nx + 3.4, ny + (graze ? 1.2 : 0.5), 1.7, 1.1, graze ? 0.5 : 0.15, 0, Math.PI * 2);
  ctx.fill();
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
  ctx.fillStyle = css({ r: 38, g: 34, b: 30 }, 0.95);
  ctx.beginPath();
  ctx.arc(nx + 1.6, ny - 0.5, 0.5, 0, Math.PI * 2);
  ctx.fill();

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

// ---------------- Ёжик ----------------

export function drawHedgehog(ctx: Ctx, e: Hedgehog, x: number, y: number, atm: Atmosphere, time: number): void {
  const curl = e.state === 'curl';
  const base = { r: 98, g: 86, b: 72 };
  const body = litc(base, atm);
  const spiky = litc({ r: 84, g: 72, b: 60 }, atm);
  const light = litc({ r: 210, g: 198, b: 182 }, atm);
  const nose = litc({ r: 48, g: 42, b: 38 }, atm);

  ctx.save();
  ctx.translate(x, y);
  ctx.scale(0.95, 0.95);

  ctx.save();
  ctx.globalCompositeOperation = 'multiply';
  softShadow(ctx, 0, 0, curl ? 6 : 9, 2.6, atm.shadowTint, atm.shadowAmount * 1.1);
  ctx.restore();

  ctx.scale(e.facing, 1);

  if (curl) {
    const pulse = 0.9 + Math.sin(time * 0.003 + e.seed) * 0.1;
    washBlob(ctx, 0, -6 * pulse, 8.5, 6.5, spiky, 81, { alpha: 0.7, edge: 0.35 });
    ctx.strokeStyle = css(light, 0.85);
    ctx.lineWidth = 1.1;
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2 + e.seed * 0.1;
      const r0 = 5 + Math.sin(a * 2 + time * 0.001) * 0.5;
      const r1 = 9.5 + Math.cos(a * 3) * 0.8;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * r0, -6 + Math.sin(a) * r0 * 0.6);
      ctx.lineTo(Math.cos(a) * r1, -6 + Math.sin(a) * r1 * 0.6);
      ctx.stroke();
    }
    ctx.fillStyle = css(nose, 0.9);
    ctx.beginPath();
    ctx.ellipse(2, -5, 1.2, 0.9, 0, 0, Math.PI * 2);
    ctx.fill();
  } else {
    const bob = Math.sin(time * 0.004 + e.seed) * 0.6;
    const sniff = e.state === 'sniff' ? Math.sin(time * 0.02) * 1.2 : 0;

    ctx.strokeStyle = css(spiky, 0.9);
    ctx.lineWidth = 1.6;
    const gait = e.state === 'walk' || e.state === 'enter' ? Math.sin(e.phase * Math.PI * 6) : 0;
    ctx.beginPath();
    ctx.moveTo(-4, -3);
    ctx.lineTo(-4 - gait, 0);
    ctx.moveTo(4, -3);
    ctx.lineTo(4 + gait, 0);
    ctx.stroke();

    washBlob(ctx, 0, -6 + bob, 8.2, 4.2, body, 33 + (e.seed % 10), { alpha: 0.68, edge: 0.3 });
    ctx.fillStyle = css(spiky, 0.65);
    ctx.beginPath();
    ctx.ellipse(-0.5, -9 + bob, 6.5, 3.2, -0.1, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = css(light, 0.55);
    for (let i = 0; i < 8; i++) {
      const sx = -5 + ((i * 53 + e.seed) % 11);
      const sy = -10 + ((i * 29 + e.seed) % 5) + bob;
      ctx.beginPath();
      ctx.arc(sx, sy, 0.5, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.fillStyle = css(light, 0.95);
    ctx.beginPath();
    ctx.ellipse(6 + sniff * 0.3, -6 + bob, 3.2, 2.0, 0.15, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = css(nose, 0.95);
    ctx.beginPath();
    ctx.ellipse(8.5 + sniff * 0.4, -6 + bob, 1.1, 0.8, 0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = css({ r: 30, g: 28, b: 26 }, 0.9);
    ctx.beginPath();
    ctx.arc(5.2, -7.5 + bob, 0.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = css(body, 0.9);
    ctx.beginPath();
    ctx.ellipse(2, -8.5 + bob, 1.2, 1.5, -0.2, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

// ---------------- Мышка ----------------

export function drawMouse(ctx: Ctx, m: Mouse, x: number, y: number, atm: Atmosphere, time: number): void {
  const bodyBase = { r: 148, g: 138, b: 128 };
  const body = litc(bodyBase, atm);
  const deep = litc(shade(bodyBase, 0.75), atm);
  const belly = litc({ r: 230, g: 222, b: 210 }, atm);
  const pink = litc({ r: 212, g: 168, b: 168 }, atm);
  const flee = m.state === 'flee';
  const hide = m.state === 'hide';

  ctx.save();
  ctx.translate(x, y);
  ctx.scale(0.72, 0.72);

  ctx.save();
  ctx.globalCompositeOperation = 'multiply';
  softShadow(ctx, 0, 0, flee ? 5 : 7, 2.0, atm.shadowTint, atm.shadowAmount * 0.9);
  ctx.restore();

  ctx.scale(m.facing, 1);

  if (hide) {
    ctx.fillStyle = css(body, 0.9);
    ctx.beginPath();
    ctx.ellipse(0, -2, 3.5, 2.2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = css(pink, 0.85);
    ctx.beginPath();
    ctx.ellipse(-1.2, -4, 1.0, 1.3, -0.2, 0, Math.PI * 2);
    ctx.ellipse(1.2, -4, 1.0, 1.3, 0.2, 0, Math.PI * 2);
    ctx.fill();
  } else {
    const bob = flee ? Math.abs(Math.sin(m.phase * Math.PI * 8)) * 1.5 : Math.sin(time * 0.008 + m.seed) * 0.4;
    const runStretch = flee ? 1.2 : 1;
    const tailWag = flee ? Math.sin(m.phase * Math.PI * 10) * 2 : Math.sin(time * 0.01 + m.seed) * 0.8;
    ctx.strokeStyle = css(deep, 0.85);
    ctx.lineWidth = 0.9;
    ctx.beginPath();
    ctx.moveTo(-4, -3);
    ctx.bezierCurveTo(-8, -4 + tailWag, -12, -2 + tailWag * 0.5, -14, -3);
    ctx.stroke();

    ctx.strokeStyle = css(deep, 0.9);
    ctx.lineWidth = 0.8;
    const gait = flee ? Math.sin(m.phase * Math.PI * 12) : Math.sin(time * 0.02 + m.seed) * 0.5;
    ctx.beginPath();
    ctx.moveTo(-2, -3);
    ctx.lineTo(-2 - gait, 0);
    ctx.moveTo(2, -3);
    ctx.lineTo(2 + gait, 0);
    ctx.stroke();

    ctx.save();
    ctx.scale(runStretch, 1);
    washBlob(ctx, 0, -4 + bob, 4.8, 2.6, body, 19 + (m.seed % 7), { alpha: 0.7, edge: 0.28 });
    ctx.restore();

    ctx.fillStyle = css(belly, 0.6);
    ctx.beginPath();
    ctx.ellipse(0.5, -2.8 + bob, 2.2, 1.2, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = css(body, 0.96);
    ctx.beginPath();
    ctx.ellipse(4.2, -5 + bob, 2.4, 1.8, 0.2, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = css(body, 0.92);
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.ellipse(3.2 + s * 0.3, -7 + bob, 1.8, 2.2, s * 0.3, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = css(pink, 0.9);
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.ellipse(3.2 + s * 0.3, -7 + bob, 0.9, 1.2, s * 0.3, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.fillStyle = css({ r: 48, g: 42, b: 40 }, 0.95);
    ctx.beginPath();
    ctx.arc(6.2, -5 + bob, 0.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = css({ r: 32, g: 30, b: 28 }, 0.9);
    ctx.beginPath();
    ctx.arc(4.6, -6 + bob, 0.45, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

// ---------------- Сова ----------------

export function drawOwl(ctx: Ctx, o: Owl, x: number, y: number, atm: Atmosphere, time: number): void {
  const flying = o.state === 'fly-in' || o.state === 'fly-out' || o.state === 'hunt' || o.state === 'look';
  const bodyBase = { r: 122, g: 108, b: 88 };
  const body = litc(bodyBase, atm);
  const deep = litc(shade(bodyBase, 0.72), atm);
  const pale = litc({ r: 228, g: 218, b: 198 }, atm);
  const eye = litc({ r: 242, g: 200, b: 64 }, atm);

  ctx.save();
  ctx.translate(x, y);
  ctx.scale(1.15, 1.15);

  ctx.save();
  ctx.globalCompositeOperation = 'multiply';
  softShadow(ctx, 0, 0, flying ? 10 : 8, 3.0, atm.shadowTint, atm.shadowAmount * 1.1);
  ctx.restore();

  ctx.scale(o.facing, 1);

  const hoot = o.state === 'hoot' ? Math.sin(time * 0.02) * 0.6 : 0;
  const lift = flying ? -18 - Math.sin(time * 0.004 + o.seed) * 2 : 0;
  ctx.translate(0, lift + hoot * 0.3);

  if (flying) {
    const flap = Math.sin(time * 0.013 + o.seed) * 0.7;
    ctx.fillStyle = css(deep, 0.88);
    ctx.save();
    ctx.translate(0, -12);
    ctx.rotate(-0.4 - flap);
    ctx.beginPath();
    ctx.ellipse(-7, 0, 11, 3.6, 0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    ctx.save();
    ctx.translate(0, -12);
    ctx.rotate(0.4 + flap);
    ctx.beginPath();
    ctx.ellipse(7, 0, 11, 3.6, -0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  washBlob(ctx, 0, -10, 7.5, 6.0, body, 91 + (o.seed % 13), { alpha: 0.72, edge: 0.32 });
  ctx.fillStyle = css(pale, 0.55);
  ctx.beginPath();
  ctx.ellipse(0, -7, 4.5, 3.2, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = css(body, 0.98);
  ctx.beginPath();
  ctx.ellipse(0, -18 + hoot, 5.8, 5.0, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = css(pale, 0.7);
  ctx.beginPath();
  ctx.ellipse(0, -18.5 + hoot, 4.2, 3.6, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = css(deep, 0.9);
  ctx.beginPath();
  ctx.moveTo(-3.5, -22 + hoot);
  ctx.lineTo(-5, -26 + hoot);
  ctx.lineTo(-2, -22.5 + hoot);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(3.5, -22 + hoot);
  ctx.lineTo(5, -26 + hoot);
  ctx.lineTo(2, -22.5 + hoot);
  ctx.closePath();
  ctx.fill();

  for (const sx of [-1.6, 1.6]) {
    ctx.fillStyle = css(eye, 0.96);
    ctx.beginPath();
    ctx.arc(sx, -18.5 + hoot, 1.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = css({ r: 28, g: 24, b: 20 }, 0.95);
    ctx.beginPath();
    ctx.arc(sx, -18.5 + hoot, 0.7, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = css({ r: 255, g: 255, b: 255 }, 0.7);
    ctx.beginPath();
    ctx.arc(sx + 0.3, -19 + hoot, 0.25, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.fillStyle = css({ r: 68, g: 60, b: 52 }, 0.95);
  ctx.beginPath();
  ctx.moveTo(0, -17 + hoot);
  ctx.lineTo(-0.6, -15.2 + hoot);
  ctx.lineTo(0.6, -15.2 + hoot);
  ctx.closePath();
  ctx.fill();

  if (!flying) {
    ctx.strokeStyle = css(deep, 0.85);
    ctx.lineWidth = 1.0;
    ctx.beginPath();
    ctx.moveTo(-2, -4);
    ctx.lineTo(-2, -1);
    ctx.moveTo(2, -4);
    ctx.lineTo(2, -1);
    ctx.stroke();
  }

  ctx.restore();
}

// ---------------- Белка ----------------

export function drawSquirrel(ctx: Ctx, s: Squirrel, x: number, y: number, atm: Atmosphere, time: number): void {
  const base = { r: 168, g: 102, b: 58 };
  const body = litc(base, atm);
  const deep = litc(shade(base, 0.7), atm);
  const pale = litc({ r: 232, g: 210, b: 186 }, atm);
  const tail = litc({ r: 152, g: 92, b: 52 }, atm);

  const jumping = s.state === 'jump' || s.state === 'enter' || s.state === 'flee';

  ctx.save();
  ctx.translate(x, y);
  ctx.scale(0.92, 0.92);

  ctx.save();
  ctx.globalCompositeOperation = 'multiply';
  softShadow(ctx, 0, 0, jumping ? 5 : 8, 2.4, atm.shadowTint, atm.shadowAmount * 1.0);
  ctx.restore();

  ctx.scale(s.facing, 1);

  const bob = jumping ? 0 : Math.sin(time * 0.006 + s.seed) * 0.5;
  const tailWag = Math.sin(time * 0.012 + s.seed) * 0.8;

  ctx.save();
  ctx.translate(-4, -10 + bob);
  ctx.rotate(-0.6 + tailWag * 0.2);
  ctx.fillStyle = css(tail, 0.92);
  ctx.beginPath();
  ctx.ellipse(0, -5, 3.2, 7.5, 0.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = css(pale, 0.35);
  for (let i = 0; i < 4; i++) {
    ctx.beginPath();
    ctx.arc((i - 1.5) * 0.8, -8 + i * 1.2, 0.6, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  ctx.strokeStyle = css(deep, 0.9);
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  const gait = jumping ? Math.sin(s.phase * Math.PI * 4) * 2 : 0;
  ctx.moveTo(-2, -5);
  ctx.lineTo(-3 - gait, 0);
  ctx.moveTo(2, -5);
  ctx.lineTo(3 + gait, 0);
  ctx.stroke();

  washBlob(ctx, 0, -7 + bob, 5.2, 3.2, body, 41 + (s.seed % 11), { alpha: 0.72, edge: 0.3 });
  ctx.fillStyle = css(pale, 0.5);
  ctx.beginPath();
  ctx.ellipse(0.5, -5.5 + bob, 2.6, 1.4, 0, 0, Math.PI * 2);
  ctx.fill();

  if (s.hasNut) {
    ctx.fillStyle = css(deep, 0.9);
    ctx.beginPath();
    ctx.ellipse(3, -7 + bob, 1.2, 1.0, 0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = css(litc({ r: 110, g: 78, b: 52 }, atm), 0.95);
    ctx.beginPath();
    ctx.ellipse(4.2, -8 + bob, 1.1, 1.3, 0.3, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.fillStyle = css(body, 0.97);
  ctx.beginPath();
  ctx.ellipse(4.5, -10 + bob, 2.8, 2.4, 0.2, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = css(body, 0.95);
  ctx.beginPath();
  ctx.ellipse(3.8, -12.5 + bob, 1.0, 1.6, -0.2, 0, Math.PI * 2);
  ctx.ellipse(5.6, -12.2 + bob, 1.0, 1.6, 0.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = css(deep, 0.9);
  ctx.beginPath();
  ctx.moveTo(3.8, -13.8 + bob);
  ctx.lineTo(3.5, -15 + bob);
  ctx.lineTo(4.2, -14 + bob);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(5.6, -13.5 + bob);
  ctx.lineTo(5.9, -14.7 + bob);
  ctx.lineTo(5.2, -13.7 + bob);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = css(pale, 0.9);
  ctx.beginPath();
  ctx.ellipse(6.2, -9.5 + bob, 1.2, 0.9, 0.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = css({ r: 48, g: 40, b: 36 }, 0.95);
  ctx.beginPath();
  ctx.arc(6.8, -9.5 + bob, 0.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = css({ r: 36, g: 32, b: 28 }, 0.9);
  ctx.beginPath();
  ctx.arc(4.8, -10.8 + bob, 0.45, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

// ---------------- Черепаха ----------------

export function drawTurtle(ctx: Ctx, t: Turtle, x: number, y: number, atm: Atmosphere, time: number): void {
  const shellBase = { r: 84, g: 98, b: 72 };
  const shell = litc(shellBase, atm);
  const shellDeep = litc(shade(shellBase, 0.68), atm);
  const skinBase = { r: 112, g: 124, b: 98 };
  const skin = litc(skinBase, atm);
  const belly = litc({ r: 188, g: 180, b: 152 }, atm);

  const hiding = t.state === 'hide';
  const basking = t.state === 'bask';

  ctx.save();
  ctx.translate(x, y);
  ctx.scale(1.05, 1.05);

  ctx.save();
  ctx.globalCompositeOperation = 'multiply';
  softShadow(ctx, 0, 0, 10, 3.2, atm.shadowTint, atm.shadowAmount * 1.2);
  ctx.restore();

  ctx.scale(t.facing, 1);

  const bob = basking ? Math.sin(time * 0.001 + t.seed) * 0.3 : 0;

  ctx.fillStyle = css(skin, 0.9);
  for (const sx of [-3.5, 3.5]) {
    ctx.beginPath();
    ctx.ellipse(sx, -1 + bob, 1.8, 1.2, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  washBlob(ctx, 0, -5 + bob, 7.5, 4.8, shell, 61 + (t.seed % 17), { alpha: 0.72, edge: 0.35 });
  ctx.strokeStyle = css(shellDeep, 0.5);
  ctx.lineWidth = 0.7;
  ctx.beginPath();
  ctx.moveTo(0, -9 + bob);
  ctx.lineTo(0, -2 + bob);
  ctx.moveTo(-3, -8 + bob);
  ctx.lineTo(-2, -3 + bob);
  ctx.moveTo(3, -8 + bob);
  ctx.lineTo(2, -3 + bob);
  ctx.stroke();
  ctx.strokeStyle = css(shellDeep, 0.35);
  ctx.beginPath();
  ctx.ellipse(0, -5.5 + bob, 5.5, 2.8, 0, 0, Math.PI * 2);
  ctx.stroke();

  ctx.fillStyle = css(belly, 0.5);
  ctx.beginPath();
  ctx.ellipse(0, -2.5 + bob, 4.5, 1.2, 0, 0, Math.PI * 2);
  ctx.fill();

  if (!hiding) {
    const headX = 6.5;
    const headY = -6 + bob;
    ctx.fillStyle = css(skin, 0.96);
    ctx.beginPath();
    ctx.ellipse(headX, headY, 2.4, 1.6, 0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = css(skin, 0.85);
    ctx.beginPath();
    ctx.ellipse(3.5, -5 + bob, 2.0, 1.0, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = css({ r: 38, g: 36, b: 32 }, 0.9);
    ctx.beginPath();
    ctx.arc(headX + 0.6, headY - 0.3, 0.35, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = css(shellDeep, 0.7);
    ctx.beginPath();
    ctx.arc(headX + 1.8, headY, 0.2, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

// ---------------- Пчела ----------------

export function drawBee(ctx: Ctx, b: Bee, x: number, y: number, atm: Atmosphere, time: number): void {
  if (b.alpha <= 0.02) return;
  const bodyBase = { r: 68, g: 62, b: 52 };
  const body = litc(bodyBase, atm);
  const yellow = litc({ r: 238, g: 198, b: 62 }, atm);
  const wing = litc({ r: 210, g: 220, b: 228 }, atm);

  ctx.save();
  ctx.translate(x, y - b.alt);
  ctx.scale(0.65, 0.65);

  const flap = Math.sin(time * 0.06 + b.seed) * 0.9;
  const hover = Math.sin(time * 0.004 + b.seed) * 1.2;

  ctx.translate(0, hover);

  ctx.fillStyle = css(wing, 0.45 * b.alpha);
  ctx.save();
  ctx.rotate(flap);
  ctx.beginPath();
  ctx.ellipse(-1.5, -1, 2.8, 1.2, -0.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  ctx.save();
  ctx.rotate(-flap);
  ctx.beginPath();
  ctx.ellipse(1.5, -1, 2.8, 1.2, 0.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  ctx.fillStyle = css(body, 0.95 * b.alpha);
  ctx.beginPath();
  ctx.ellipse(0, 0, 2.2, 1.6, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = css(yellow, 0.95 * b.alpha);
  ctx.fillRect(-1.6, -0.8, 3.2, 0.6);
  ctx.fillRect(-1.4, 0.2, 2.8, 0.5);

  if (b.carrying) {
    ctx.fillStyle = css(litc({ r: 238, g: 198, b: 102 }, atm), 0.8 * b.alpha);
    ctx.beginPath();
    ctx.arc(0, 1.2, 0.9, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}
