/**
 * Лист поз: рисует кота во всех состояниях, птицу, бабочку и стрекозу крупно.
 * Инструмент разработки — проверить силуэты без запуска игры.
 *   npx tsx tools/creature-sheet.ts
 */

import { createCanvas } from '@napi-rs/canvas';
import { writeFileSync } from 'node:fs';

const g = globalThis as Record<string, unknown>;
g.document = {
  createElement(tag: string) {
    if (tag === 'canvas') return createCanvas(8, 8);
    return {};
  },
};
g.window = { devicePixelRatio: 1, innerWidth: 1200, innerHeight: 700 };
g.performance = g.performance ?? { now: () => Date.now() };

async function main() {
  const { drawCat, drawBird, drawFlutter } = await import('../src/render/creatures');
  const { buildAtmosphere } = await import('../src/world/palette');
  const { computeTime } = await import('../src/core/clock');
  const type = await import('../src/world/life');

  const d = new Date();
  d.setHours(13, 0, 0, 0);
  const atm = buildAtmosphere(computeTime(d.getTime()));

  const states: type.CatState[] = ['sleep', 'loaf', 'sit', 'wash', 'stretch', 'walk'];
  const cols = 4;
  const cell = 150;
  const rows = Math.ceil((states.length * 2 + 6) / cols);
  const W = cols * cell;
  const H = rows * cell;
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d') as unknown as CanvasRenderingContext2D;

  ctx.fillStyle = '#cfe0c8';
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = 'rgba(0,0,0,.12)';
  for (let i = 1; i < cols; i++) {
    ctx.beginPath();
    ctx.moveTo(i * cell, 0);
    ctx.lineTo(i * cell, H);
    ctx.stroke();
  }
  for (let i = 1; i < rows; i++) {
    ctx.beginPath();
    ctx.moveTo(0, i * cell);
    ctx.lineTo(W, i * cell);
    ctx.stroke();
  }

  let idx = 0;
  const place = () => {
    const cx = (idx % cols) * cell + cell / 2;
    const cy = Math.floor(idx / cols) * cell + cell * 0.66;
    idx++;
    return { cx, cy };
  };
  const label = (text: string, cx: number, cy: number) => {
    ctx.fillStyle = 'rgba(40,32,24,.75)';
    ctx.font = '13px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(text, cx, cy + 34);
    ctx.textAlign = 'left';
  };

  // Кот: каждое состояние в обе стороны
  for (const st of states) {
    for (const facing of [1, -1]) {
      const { cx, cy } = place();
      const cat: type.Cat = {
        id: 1,
        tx: 0,
        ty: 0,
        facing,
        seed: 42,
        state: st,
        timer: 1000,
        target: null,
        phase: 0.5,
        speed: 1,
        home: null,
      };
      ctx.save();
      ctx.translate(cx, cy);
      ctx.scale(1.5, 1.5);
      drawCat(ctx, cat, 0, 0, atm, 2500);
      ctx.restore();
      label(`${st} ${facing > 0 ? '→' : '←'}`, cx, cy);
    }
  }

  // Птица: на земле и в полёте
  for (const st of ['hop', 'peck', 'fly-in'] as type.BirdState[]) {
    const { cx, cy } = place();
    const bird: type.Bird = {
      tx: 0,
      ty: 0,
      facing: 1,
      seed: 7,
      state: st,
      timer: 0,
      target: null,
      alt: st === 'fly-in' ? 26 : 0,
      hop: 0.6,
      scale: 1,
    };
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(2.2, 2.2);
    drawBird(ctx, bird, 0, 0, atm, 2500);
    ctx.restore();
    label(`птица ${st}`, cx, cy);
  }

  // Бабочка и стрекоза
  for (const kind of ['butterfly', 'butterfly', 'dragonfly'] as const) {
    const { cx, cy } = place();
    const openWings = kind === 'butterfly' && idx % 2 === 0;
    const f: type.Flutter = {
      kind,
      tx: 0,
      ty: 0,
      alt: 18,
      vx: 0.001,
      vy: 0.0003,
      valt: 0,
      target: null,
      timer: 0,
      seed: 120,
      phase: 0,
      resting: openWings ? 2000 : 0,
    };
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(3.4, 3.4);
    drawFlutter(ctx, f, 0, 6, atm, 2500);
    ctx.restore();
    label(openWings ? kind + " раскрыта" : kind, cx, cy);
  }

  const out = process.argv[2] ?? 'creature-sheet.png';
  writeFileSync(out, (canvas as unknown as { toBuffer(m: string): Buffer }).toBuffer('image/png'));
  console.log(out);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
