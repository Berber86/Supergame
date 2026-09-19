/** Bridges use one projected deck curve for boards, beams, railings and posts. */
import { type Drawer, litc, shadowUnder } from './common';
import { isoToScreen, type Pt } from '../../core/iso';
import { hash2 } from '../../core/rng';
import { css, shade, mix } from '../../world/palette';
import { shape, stroke, limb, oval } from '../animalBrush';

/** rot=0 spans world X (catalogue footprint 3×1), rot=1 spans Y. */
export function bridgePoint(rot: number, t: number, side: number, rail = 0, plank = false, reflection = false): Pt {
  const along = (t - 0.5) * (plank ? 2 : 3);
  const across = side * (plank ? 0.32 : 0.37);
  const p = rot % 2 === 0 ? isoToScreen(along, across) : isoToScreen(across, along);
  return { x: p.x, y: p.y + (reflection ? 1 : -1) * (7 + 4 * (plank ? 2 : 20) * t * (1 - t) + rail) };
}

function bridge(d: Parameters<Drawer>[0], plank: boolean): void {
  const { ctx, atm, obj } = d;
  const z = d.reflection ? -1 : 1;
  const wood = litc({ r: 166, g: 117, b: 76 }, atm);
  const dark = litc({ r: 93, g: 66, b: 49 }, atm);
  const light = litc({ r: 213, g: 169, b: 111 }, atm);
  const railColor = litc({ r: 128, g: 79, b: 54 }, atm);
  const stone = litc(mix(atm.palette.stone, { r: 136, g: 135, b: 119 }, 0.45), atm);
  const at = (t: number, side: number, height = 0) => {
    const p = bridgePoint(obj.rot, t, side, height, plank, d.reflection);
    if (d.reflection && d.reflectionWarp) {
      const wave = d.reflectionWarp(d.x + p.x, d.y + p.y);
      p.x += wave.dx;
      p.y += wave.dy;
    }
    return p;
  };
  if (!d.reflection) shadowUnder(d, plank ? 49 : 72, plank ? 12 : 18, 0.38);
  ctx.save();
  ctx.translate(d.x, d.y);
  const outline = (t0: number, t1: number, s0: number, s1: number, lower = 0) => {
    const a = at(t0, s0),
      b = at(t1, s0),
      c = at(t1, s1),
      e = at(t0, s1);
    ctx.moveTo(a.x, a.y + lower * z);
    ctx.lineTo(b.x, b.y + lower * z);
    ctx.lineTo(c.x, c.y + lower * z);
    ctx.lineTo(e.x, e.y + lower * z);
  };
  const curve = (side: number, height: number) => {
    for (let i = 0; i <= 32; i++) {
      const p = at(i / 32, side, height);
      if (i) ctx.lineTo(p.x, p.y);
      else ctx.moveTo(p.x, p.y);
    }
  };
  // Stone abutments have a top and a shaded front, not two floating oval stickers.
  for (const t of [0, 1]) {
    shape(ctx, css(shade(stone, 0.68)), () => outline(t - 0.07, t + 0.07, -1.22, 1.22, 10));
    for (const side of [-1, 1]) {
      const p = at(t, side * 0.82);
      limb(ctx, css(dark), 3.1, [
        [p.x, p.y + 9 * z],
        [p.x, p.y - z],
      ]);
    }
    shape(ctx, css(stone), () => outline(t - 0.07, t + 0.07, -1.22, 1.22, 5));
    const a = at(t - 0.07, 1.22),
      b = at(t + 0.07, 1.22);
    limb(ctx, css(shade(stone, 1.16), 0.7), 0.8, [
      [a.x, a.y + 5 * z],
      [b.x, b.y + 5 * z],
    ]);
  }
  const railing = (side: number) => {
    for (let i = 0; i <= 5; i++) {
      const t = i / 5,
        p = at(t, side),
        top = at(t, side, 19);
      limb(ctx, css(dark), 3, [
        [p.x, p.y + z],
        [top.x, top.y - z],
      ]);
      limb(ctx, css(railColor), 1.8, [
        [p.x - 0.5, p.y],
        [top.x - 0.5, top.y - z],
      ]);
      oval(ctx, top.x, top.y - 1.5 * z, 2.2, 1.0, css(light));
    }
    stroke(ctx, css(railColor), 2, () => curve(side, 8.5));
    stroke(ctx, css(dark), 3.3, () => curve(side, 19));
    stroke(ctx, css(railColor), 2.2, () => curve(side, 19.5));
    stroke(ctx, css(light, 0.65), 0.65, () => curve(side, 20.1));
  };
  if (!plank) railing(-1);
  // A real arched girder under the near deck edge; same lift as every board.
  shape(ctx, css(dark), () => {
    curve(1, 0);
    for (let i = 32; i >= 0; i--) {
      const p = at(i / 32, 1);
      ctx.lineTo(p.x, p.y + 5.5 * z);
    }
  });
  shape(ctx, css(wood), () => {
    curve(-1, 0);
    for (let i = 32; i >= 0; i--) {
      const p = at(i / 32, 1);
      ctx.lineTo(p.x, p.y);
    }
  });
  const count = plank ? 13 : 21;
  for (let i = 0; i < count; i++) {
    const t0 = i / count,
      t1 = (i + 0.96) / count;
    shape(ctx, css(shade(wood, 0.91 + hash2(i, obj.seed, 53) * 0.16)), () => outline(t0, t1, -1, 1));
    const a = at(t0, -1),
      b = at(t0, 1);
    limb(ctx, css(dark, 0.5), 0.55, [
      [a.x, a.y],
      [b.x, b.y],
    ]);
    const g0 = at((t0 + t1) / 2, -0.65),
      g1 = at((t0 + t1) / 2, 0.7);
    limb(ctx, css(light, 0.3), 0.5, [
      [g0.x, g0.y],
      [g1.x, g1.y],
    ]);
    if ((atm.materialWetness ?? 0) > 0 && i % 3 !== 0) {
      const a = at((t0 + t1) / 2, -0.6),
        b = at((t0 + t1) / 2, 0.25);
      limb(ctx, css(mix(atm.skyBottom, { r: 231, g: 235, b: 219 }, 0.3), (atm.materialWetness ?? 0) * 0.33), 0.7, [
        [a.x, a.y],
        [b.x, b.y],
      ]);
    }
    if (i % 3 === 1)
      for (const side of [-0.8, 0.8]) {
        const p = at((t0 + t1) / 2, side);
        oval(ctx, p.x, p.y, 0.55, 0.38, css(dark, 0.7));
      }
  }
  stroke(ctx, css(light, 0.7), 0.85, () => curve(1, 0.3));
  if (!plank) railing(1);
  ctx.restore();
}
export const drawBridge: Drawer = (d) => bridge(d, false);
export const drawPlankBridge: Drawer = (d) => bridge(d, true);
