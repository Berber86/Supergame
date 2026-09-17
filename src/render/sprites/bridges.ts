/** Мост и мостки: дуга ведёт от берега к берегу, к устоям код относится бережно. */

import { Drawer, WHITE, litc } from './common';
import { TILE_H, TILE_W } from '../../core/iso';
import { hash2, lerp } from '../../core/rng';
import { css, mix, shade } from '../../world/palette';

// ---------------- Постройки ----------------

export const drawBridge: Drawer = (d) => {
  const { ctx, atm, obj } = d;
  const wood = litc({ r: 164, g: 106, b: 76 }, atm);
  const woodDark = litc({ r: 118, g: 74, b: 56 }, atm);
  const rot = obj.rot % 2;
  const dx = rot === 0 ? TILE_W / 2 : -TILE_W / 2;
  const dy = TILE_H / 2;

  ctx.save();
  ctx.translate(d.x, d.y);
  const ax = -dx * 1.5;
  const ay = -dy * 1.5;
  const bx = dx * 1.5;
  const by = dy * 1.5;
  const arch = -26;
  const w = 13; // полуширина настила

  // тень на воде
  ctx.fillStyle = css(atm.shadowTint, atm.shadowAmount * 0.9);
  ctx.beginPath();
  ctx.moveTo(ax, ay + 6);
  ctx.quadraticCurveTo(0, arch * 0.4 + 10, bx, by + 6);
  ctx.lineTo(bx, by + 14);
  ctx.quadraticCurveTo(0, arch * 0.4 + 20, ax, ay + 14);
  ctx.closePath();
  ctx.fill();

  // Устои: каменные опоры по обоим концам — без них дуга «висела в воздухе»,
  // а ночью и зимой концы растворялись в тёмной воде.
  const stBase = litc(mix(atm.palette.stone, { r: 168, g: 164, b: 154 }, 0.35), atm);
  const stDark = litc(shade(atm.palette.stone, 0.62), atm);
  const L = Math.hypot(bx - ax, by - ay);
  const ux = (bx - ax) / L;
  const uy = (by - ay) / L;
  for (const [px, py, ox, oy] of [
    [ax, ay, -ux, -uy],
    [bx, by, ux, uy],
  ]) {
    const j = hash2(Math.round(px), Math.round(py), obj.seed) * 2 - 1;
    ctx.fillStyle = css(stDark, 0.95);
    ctx.beginPath();
    ctx.ellipse(px + ox * 5, py + oy * 5 + 6, 13, 6.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = css(stBase, 0.97);
    ctx.beginPath();
    ctx.ellipse(px + ox * 4, py + oy * 4 + 3, 11 + j, 5.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(px - ox * 3, py - oy * 3 + 1.5, 7.5, 4, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // Короткие пандусы на устои и опорные сваи под концами настила
  for (const [px, py, ox, oy] of [
    [ax, ay, -ux, -uy],
    [bx, by, ux, uy],
  ]) {
    ctx.fillStyle = css(shade(wood, 0.92), 0.96);
    ctx.beginPath();
    ctx.moveTo(px + ox * 16 - w * 0.38, py + oy * 16 - w * 0.38 + 2);
    ctx.lineTo(px - w * 0.38 + ox * 1, py - w * 0.38 + oy * 1);
    ctx.lineTo(px + w * 0.38 + ox * 1, py + w * 0.38 + oy * 1);
    ctx.lineTo(px + ox * 16 + w * 0.38, py + oy * 16 + w * 0.38 + 2);
    ctx.closePath();
    ctx.fill();
  }
  ctx.strokeStyle = css(woodDark, 0.8);
  ctx.lineWidth = 1.8;
  for (const t of [0.075, 0.925]) {
    const px = lerp(ax, bx, t);
    const py = lerp(ay, by, t) + Math.sin(t * Math.PI) * arch;
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(px + s * w * 0.32, py);
      ctx.lineTo(px + s * w * 0.32, py + 13 - s * 1.5);
      ctx.stroke();
    }
  }

  // настил
  ctx.beginPath();
  ctx.moveTo(ax - w * 0.4, ay - w * 0.4);
  ctx.quadraticCurveTo(0, arch - w * 0.4, bx - w * 0.4, by - w * 0.4);
  ctx.lineTo(bx + w * 0.4, by + w * 0.4);
  ctx.quadraticCurveTo(0, arch + w * 0.4, ax + w * 0.4, ay + w * 0.4);
  ctx.closePath();
  ctx.fillStyle = css(wood, 0.96);
  ctx.fill();
  ctx.strokeStyle = css(woodDark, 0.5);
  ctx.lineWidth = 1.4;
  ctx.stroke();

  // Светлая кромка сверху — ночью и зимой дуга читается на тёмной воде
  ctx.strokeStyle = css(litc(mix(wood, WHITE, 0.5), atm), 0.42);
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(ax - w * 0.4, ay - w * 0.4);
  ctx.quadraticCurveTo(0, arch - w * 0.4, bx - w * 0.4, by - w * 0.4);
  ctx.stroke();

  // доски
  for (let i = 1; i < 12; i++) {
    const t = i / 12;
    const px = lerp(ax, bx, t);
    const py = lerp(ay, by, t) + Math.sin(t * Math.PI) * arch;
    ctx.strokeStyle = css(shade(wood, 0.82 + hash2(i, obj.seed, 3) * 0.25), 0.5);
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(px - w * 0.4, py - w * 0.4);
    ctx.lineTo(px + w * 0.4, py + w * 0.4);
    ctx.stroke();
  }

  // перила
  for (const side of [-1, 1]) {
    ctx.strokeStyle = css(woodDark, 0.85);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(ax + side * w * 0.45, ay + side * w * 0.45 - 12);
    ctx.quadraticCurveTo(side * 2, arch - 12, bx + side * w * 0.45, by + side * w * 0.45 - 12);
    ctx.stroke();
    for (let i = 0; i <= 3; i++) {
      const t = i / 3;
      const px = lerp(ax, bx, t) + side * w * 0.45;
      const py = lerp(ay, by, t) + side * w * 0.45 + Math.sin(t * Math.PI) * arch;
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(px, py - 12);
      ctx.stroke();
    }
  }
  ctx.restore();
};

export const drawPlankBridge: Drawer = (d) => {
  const { ctx, atm, obj } = d;
  const len = TILE_H * 2;
  const wood = litc({ r: 158, g: 118, b: 82 }, atm);
  const dark = litc({ r: 112, g: 84, b: 60 }, atm);
  const horiz = obj.rot % 2 === 0;

  ctx.save();
  ctx.translate(d.x, d.y - 6);
  if (!horiz) ctx.scale(-1, 1);

  // Опоры на обоих берегах — мостки не висят в воздухе
  ctx.strokeStyle = css(dark, 0.85);
  ctx.lineWidth = 1.7;
  for (const tt of [-0.42, 0.42]) {
    const cx = tt * len;
    const cy = tt * TILE_H * 0.5;
    for (const off of [-5, 5]) {
      ctx.beginPath();
      ctx.moveTo(cx, cy + off - 4);
      ctx.lineTo(cx, cy + off + 10);
      ctx.stroke();
    }
  }
  // Камешки под опорами
  ctx.fillStyle = css(litc(mix(atm.palette.stone, WHITE, 0.1), atm), 0.9);
  for (const tt of [-0.42, 0.42]) {
    const cx = tt * len;
    const cy = tt * TILE_H * 0.5;
    ctx.beginPath();
    ctx.ellipse(cx + 2, cy + 11, 6, 3, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // Отражение в воде под мостками
  ctx.save();
  ctx.globalCompositeOperation = 'multiply';
  ctx.fillStyle = css(mix(WHITE, atm.palette.waterDeep, 0.28), 1);
  ctx.beginPath();
  ctx.ellipse(0, 10, len * 0.5, 7, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Настил: несколько досок поперёк
  const boards = 5;
  for (let i = 0; i < boards; i++) {
    const tt = (i + 0.5) / boards - 0.5;
    const cx = tt * len;
    const cy = tt * TILE_H * 0.5;
    ctx.fillStyle = css(i % 2 === 0 ? wood : shade(wood, 0.93), 0.97);
    ctx.beginPath();
    ctx.moveTo(cx - 3, cy - 7);
    ctx.lineTo(cx + 3, cy - 5.6);
    ctx.lineTo(cx + 3, cy + 5.6);
    ctx.lineTo(cx - 3, cy + 4.2);
    ctx.closePath();
    ctx.fill();
  }
  // Продольные лаги
  ctx.strokeStyle = css(dark, 0.7);
  ctx.lineWidth = 1.4;
  for (const off of [-5, 5]) {
    ctx.beginPath();
    ctx.moveTo(-len * 0.5, -TILE_H * 0.25 + off);
    ctx.lineTo(len * 0.5, TILE_H * 0.25 + off);
    ctx.stroke();
  }
  ctx.restore();
};
