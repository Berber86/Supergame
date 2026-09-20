/** Opaque mineral planes with watercolour texture, not translucent balloon-shaped washes. */
import { hash2 } from '../core/rng';
import { stoneResponse, stoneShape, type StonePoint } from '../world/stone';
import { winterYear } from '../world/annualEnvironment';
import { css, mix, shade, type Atmosphere, type RGB } from '../world/palette';
import { washBlob, type Ctx } from './paint';
const MINERALS: RGB[] = [
  { r: 137, g: 139, b: 131 },
  { r: 146, g: 135, b: 119 },
  { r: 109, g: 123, b: 128 },
];
/** Tiny bevels soften corners while retaining actual facets. */
export function stonePath(ctx: Ctx, p: readonly StonePoint[], round = 0.055, append = false): void {
  if (!append) ctx.beginPath();
  const n = p.length;
  for (let i = 0; i < n; i++) {
    const a = p[(i + n - 1) % n],
      b = p[i],
      c = p[(i + 1) % n];
    const x = b.x + (a.x - b.x) * round,
      y = b.y + (a.y - b.y) * round;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
    ctx.quadraticCurveTo(b.x, b.y, b.x + (c.x - b.x) * round, b.y + (c.y - b.y) * round);
  }
  ctx.closePath();
}
export function paintStone(
  ctx: Ctx,
  x: number,
  y: number,
  seed: number,
  scale: number,
  rot: number,
  atm: Atmosphere,
  flat = false,
  immersed = false,
): void {
  const shape = stoneShape(seed, scale, rot, flat),
    { base, cap, height, width, family } = shape;
  const wet = stoneResponse(seed, atm.materialWetness ?? 0, atm.stoneHabitat ?? 0.25);
  if (immersed) wet.foot = Math.max(0.85, wet.foot);
  const color = shade(
    mix(mix(MINERALS[family], atm.palette.stone, 0.19), atm.lightTint, atm.lightAmount),
    atm.exposure,
  );
  const dark = shade(color, 0.55),
    snow = winterYear(atm.time.now).snow;
  ctx.save();
  ctx.translate(x, y);
  // Embedded foot. This belongs to the stone itself; the long cast shadow is separate.
  ctx.save();
  ctx.translate(0, width * 0.1);
  ctx.scale(1, 0.43);
  const contact = ctx.createRadialGradient(0, 0, width * 0.5, 0, 0, width * 1.06);
  contact.addColorStop(0, css(dark, 0.32));
  contact.addColorStop(1, css(dark, 0));
  ctx.fillStyle = contact;
  ctx.beginPath();
  ctx.arc(0, 0, width * 1.06, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  // Opaque backing prevents antialias cracks between adjacent mineral planes.
  const hull = [...base, ...cap].sort((a, b) => a.x - b.x || a.y - b.y);
  const cross = (a: StonePoint, b: StonePoint, c: StonePoint) => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
  const lower: StonePoint[] = [],
    upper: StonePoint[] = [];
  for (const p of hull) {
    while (lower.length > 1 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop();
    lower.push(p);
  }
  for (const p of hull.slice().reverse()) {
    while (upper.length > 1 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop();
    upper.push(p);
  }
  stonePath(ctx, [...lower.slice(0, -1), ...upper.slice(0, -1)]);
  ctx.fillStyle = css(shade(color, 0.87 * (1 - wet.foot * 0.2)));
  ctx.fill();
  const faces = base
    .map((p, i) => ({ i, depth: (p.y + base[(i + 1) % 7].y) / 2 }))
    .filter((f) => f.depth > -0.1)
    .sort((a, b) => a.depth - b.depth);
  for (const { i } of faces) {
    const j = (i + 1) % 7,
      dx = base[j].x - base[i].x,
      dy = base[j].y - base[i].y;
    const normal = dy / Math.max(1, Math.hypot(dx, dy));
    const light = 0.94 - normal * atm.sunDir.x * 0.18;
    const g = ctx.createLinearGradient(0, -height, 0, width * 0.3);
    g.addColorStop(0, css(shade(color, light * (1 - wet.top * 0.17))));
    g.addColorStop(1, css(shade(color, light * 0.87 * (1 - wet.foot * 0.26))));
    stonePath(ctx, [cap[i], cap[j], base[j], base[i]]);
    ctx.fillStyle = g;
    ctx.fill();
    ctx.save();
    ctx.clip();
    for (let k = 0; k < (flat ? 3 : 34); k++) {
      const u = hash2(seed + i, k, 2677),
        v = hash2(seed + i, k, 2683);
      ctx.fillStyle = css(k % 3 ? dark : shade(color, 1.45), k % 3 ? 0.12 : 0.17);
      ctx.fillRect(-width + u * width * 2, -height + v * (height + width * 0.5), 0.6 * scale, (0.5 + v) * scale);
    }
    if (!flat) {
      washBlob(
        ctx,
        (cap[i].x + base[j].x) * 0.5,
        (cap[i].y + base[j].y) * 0.5,
        width * 0.34,
        height * 0.22,
        mix(color, { r: 165, g: 149, b: 116 }, 0.3),
        seed + i * 7,
        { layers: 2, alpha: 0.08, edge: 0, wobble: 0.34 },
      );
      const mossColor = shade(mix(atm.palette.moss, { r: 94, g: 105, b: 76 }, 0.5), atm.exposure);
      washBlob(
        ctx,
        base[j].x * 0.6,
        base[j].y * 0.56,
        width * wet.moss * 1.7,
        height * wet.moss * 0.8,
        mossColor,
        seed + i * 13,
        { layers: 2, alpha: (0.2 + wet.crevice * 0.14) * (1 - snow), edge: 0, wobble: 0.48 },
      );
    }
    if (!flat) {
      ctx.strokeStyle = css(dark, 0.19 + wet.crevice * 0.24);
      ctx.lineWidth = 0.65 * scale;
      ctx.beginPath();
      ctx.moveTo(cap[i].x, cap[i].y);
      ctx.lineTo(cap[i].x * 0.6 + base[j].x * 0.4, cap[i].y * 0.5 + base[j].y * 0.5);
      ctx.lineTo(base[j].x * 0.7, base[j].y * 0.74);
      ctx.stroke();
    }
    ctx.restore();
    // Bedding follows the plane, rather than vertical curved "football seams".
    if (family === 2 && !flat) {
      ctx.save();
      stonePath(ctx, [cap[i], cap[j], base[j], base[i]]);
      ctx.clip();
      ctx.strokeStyle = css(shade(color, 1.27), 0.24);
      ctx.lineWidth = 0.55;
      for (let k = 1; k <= 3; k++) {
        const t = k / 5;
        ctx.beginPath();
        ctx.moveTo(cap[i].x + (base[i].x - cap[i].x) * t, cap[i].y + (base[i].y - cap[i].y) * t);
        ctx.lineTo(cap[j].x + (base[j].x - cap[j].x) * t, cap[j].y + (base[j].y - cap[j].y) * t);
        ctx.stroke();
      }
      ctx.restore();
    }
  }
  // The broad upper plane carries most diffuse sky light; no cartoon black contour.
  stonePath(ctx, cap);
  const top = ctx.createLinearGradient(-width, -height - width * 0.5, width, -height + width * 0.3);
  top.addColorStop(0, css(shade(color, 1.23 * (1 - wet.top * 0.23))));
  top.addColorStop(1, css(shade(color, 0.98 * (1 - wet.top * 0.23))));
  ctx.fillStyle = top;
  ctx.fill();
  ctx.save();
  ctx.clip();
  // Broad irregular crown facets converge off centre: a boulder, not a sawn-off column.
  if (!flat) {
    const ridge = { x: width * (hash2(seed, 11, 2687) - 0.5) * 0.48, y: -height * 0.89 };
    for (let i = 0; i < 7; i++) {
      stonePath(ctx, [cap[i], cap[(i + 1) % 7], ridge], 0);
      const facing = (cap[i].x + cap[(i + 1) % 7].x) / Math.max(1, width * 2);
      ctx.fillStyle = css(shade(color, (1.12 - facing * atm.sunDir.x * 0.16) * (1 - wet.top * 0.23)), 0.72);
      ctx.fill();
    }
  }
  const capMin = Math.min(...cap.map((p) => p.y)),
    capMax = Math.max(...cap.map((p) => p.y));
  if (!flat)
    for (let i = 0; i < 4; i++)
      washBlob(
        ctx,
        (hash2(seed, i, 2693) - 0.5) * width,
        capMin + (capMax - capMin) * hash2(seed, i, 2699),
        width * 0.27,
        width * 0.16,
        i % 2 ? shade(color, 0.77) : shade(color, 1.3),
        seed + i * 31,
        { layers: 2, alpha: 0.08, edge: 0, wobble: 0.38 },
      );
  const flecks = flat ? 9 : 85;
  for (let i = 0; i < flecks; i++) {
    const px = (hash2(seed, i, 2551) - 0.5) * width * 2,
      py = capMin + hash2(seed, i, 2557) * (capMax - capMin);
    ctx.fillStyle = css(i % 3 ? dark : shade(color, 1.65), i % 3 ? 0.21 : 0.33);
    ctx.fillRect(px, py, (0.45 + hash2(seed, i, 2559) * 1.25) * scale, 0.55 * scale);
  }
  // Fine branching fracture; the recess keeps water after the exposed cap dries.
  if (!flat || hash2(seed, 23, 2561) > 0.6) {
    const p = cap[2],
      q = { x: width * (hash2(seed, 31, 2563) - 0.5) * 0.65, y: -height + width * 0.12 };
    ctx.strokeStyle = css(dark, 0.34 + wet.crevice * 0.28);
    ctx.lineWidth = (flat ? 0.55 : 0.8) * scale;
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(p.x * 0.35 + q.x * 0.65, -height * 0.99);
    ctx.lineTo(q.x, q.y);
    ctx.lineTo(q.x + width * 0.16, q.y + width * 0.13);
    ctx.stroke();
  }
  // Sparse irregular colonies, not a compulsory green cap on every boulder.
  const moss = mix(atm.palette.moss, { r: 98, g: 110, b: 80 }, 0.48);
  for (let i = 0; i < (flat ? 7 : 23); i++) {
    const u = hash2(seed, i, 2579),
      v = hash2(seed, i, 2581);
    if (u > wet.moss * 1.8) continue;
    ctx.fillStyle = css(shade(mix(color, moss, 0.65 + wet.crevice * 0.2), atm.exposure), 0.52 * (1 - snow));
    ctx.beginPath();
    ctx.ellipse(
      -width * 0.48 + v * width * 0.38,
      -height + (hash2(seed, i, 2591) - 0.5) * width * 0.5,
      (1.2 + u * 4) * scale,
      (0.7 + v) * scale,
      0,
      0,
      Math.PI * 2,
    );
    ctx.fill();
  }
  if (wet.top > 0.02) {
    ctx.strokeStyle = css(mix(atm.skyBottom, { r: 233, g: 238, b: 228 }, 0.45), wet.top * 0.38);
    ctx.lineWidth = 0.7 * scale;
    ctx.beginPath();
    ctx.moveTo(cap[3].x, cap[3].y + 1);
    ctx.lineTo(cap[4].x * 0.82, cap[4].y + 1);
    ctx.stroke();
  }
  if (snow > 0.001) {
    ctx.globalAlpha *= snow;
    ctx.fillStyle = css(shade({ r: 237, g: 241, b: 238 }, atm.exposure));
    stonePath(
      ctx,
      cap.map((p) => ({ x: p.x * 0.96, y: p.y - 1.2 * scale })),
    );
    ctx.fill();
  }
  ctx.restore();
  // Broken bevel on the forward cap edge makes slab thickness legible at phone size.
  ctx.strokeStyle = css(shade(color, 1.4), 0.36 * (1 - wet.top * 0.5));
  ctx.lineWidth = 0.7 * scale;
  ctx.beginPath();
  ctx.moveTo(cap[0].x, cap[0].y);
  ctx.lineTo(cap[1].x, cap[1].y);
  ctx.lineTo(cap[2].x, cap[2].y);
  ctx.stroke();
  ctx.restore();
}
/** Fitted paving: planar irregular polygon with a shallow, chipped front lip. */
export function paintFlag(ctx: Ctx, points: StonePoint[], col: RGB, seed: number, depth = 2): void {
  const k = 0.91 + hash2(seed, 1, 2609) * 0.17;
  stonePath(
    ctx,
    points.map((p) => ({ x: p.x, y: p.y + depth })),
    0.06,
  );
  ctx.fillStyle = css(shade(col, 0.71), 0.95);
  ctx.fill();
  stonePath(ctx, points, 0.06);
  ctx.fillStyle = css(shade(col, k));
  ctx.fill();
  ctx.save();
  ctx.clip();
  const minX = Math.min(...points.map((p) => p.x)),
    maxX = Math.max(...points.map((p) => p.x)),
    minY = Math.min(...points.map((p) => p.y)),
    maxY = Math.max(...points.map((p) => p.y));
  ctx.fillStyle = css(shade(col, 1.12), 0.14);
  stonePath(ctx, [points[0], points[1], { x: (minX + maxX) / 2, y: (minY + maxY) / 2 }]);
  ctx.fill();
  ctx.strokeStyle = css(shade(col, 0.48), 0.32);
  ctx.lineWidth = 0.65;
  if (hash2(seed, 7, 2617) > 0.48) {
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    ctx.lineTo(minX + (maxX - minX) * 0.53, minY + (maxY - minY) * 0.44);
    ctx.lineTo(minX + (maxX - minX) * 0.7, minY + (maxY - minY) * 0.49);
    ctx.stroke();
  }
  for (let i = 0; i < 7; i++) {
    ctx.fillStyle = css(shade(col, i % 2 ? 0.57 : 1.4), 0.22);
    ctx.fillRect(minX + hash2(seed, i, 2621) * (maxX - minX), minY + hash2(seed, i, 2633) * (maxY - minY), 0.9, 0.6);
  }
  ctx.restore();
  ctx.strokeStyle = css(shade(col, 1.35), 0.34);
  ctx.lineWidth = 0.65;
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  ctx.lineTo(points[1].x, points[1].y);
  ctx.stroke();
}
