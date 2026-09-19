/** Human-scale furniture. Dimensions are tile fractions; height is screen Z, never screen rotation. */
import { isoToScreen, type Pt } from '../../core/iso';
import { hash2 } from '../../core/rng';
import { css, mix, shade, type RGB } from '../../world/palette';
import { type DrawCtx, type Drawer, litc, shadowUnder } from './common';
import { shape, stroke, oval } from '../animalBrush';
import { glow, washBlob } from '../paint';

export function furniturePoint(rot: number, u: number, v: number, z = 0): Pt {
  const q = ((rot % 4) + 4) % 4;
  const p =
    q === 0 ? isoToScreen(u, v) : q === 1 ? isoToScreen(-v, u) : q === 2 ? isoToScreen(-u, -v) : isoToScreen(v, -u);
  return { x: p.x, y: p.y - z };
}
export function workshop(d: DrawCtx, paint: (s: ReturnType<typeof brushes>) => void) {
  d.ctx.save();
  d.ctx.translate(d.x, d.y);
  paint(brushes(d));
  d.ctx.restore();
}
function brushes(d: DrawCtx) {
  const { ctx, atm, obj } = d;
  const p = (u: number, v: number, z = 0) => furniturePoint(obj.rot, u, v, z);
  const path = (pts: Pt[]) => pts.forEach((q, i) => (i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y)));
  const face = (pts: Pt[], col: RGB, a = 1) => shape(ctx, css(col, a), () => path(pts));
  const line = (pts: Pt[], col: RGB, width = 1, a = 1) => stroke(ctx, css(col, a), width, () => path(pts));
  const rect = (u: number, v: number, w: number, h: number, z: number, col: RGB) =>
    face(
      [p(u - w / 2, v - h / 2, z), p(u + w / 2, v - h / 2, z), p(u + w / 2, v + h / 2, z), p(u - w / 2, v + h / 2, z)],
      col,
    );
  const box = (u: number, v: number, w: number, h: number, z0: number, z1: number, col: RGB) => {
    const corners = [
      [-w / 2, -h / 2],
      [w / 2, -h / 2],
      [w / 2, h / 2],
      [-w / 2, h / 2],
    ];
    const sides = corners.map((a, i) => ({
      a,
      b: corners[(i + 1) % 4],
      depth: p(u + a[0], v + a[1]).y + p(u + corners[(i + 1) % 4][0], v + corners[(i + 1) % 4][1]).y,
    }));
    sides.sort((a, b) => a.depth - b.depth);
    for (const { a, b } of sides)
      face(
        [p(u + a[0], v + a[1], z0), p(u + b[0], v + b[1], z0), p(u + b[0], v + b[1], z1), p(u + a[0], v + a[1], z1)],
        shade(col, 0.68 + (a[0] === b[0] ? 0.05 : 0.14)),
      );
    rect(u, v, w, h, z1, col);
  };
  const wood = litc({ r: 158, g: 107, b: 69 }, atm),
    dark = litc({ r: 77, g: 55, b: 41 }, atm),
    light = litc({ r: 209, g: 169, b: 114 }, atm);
  const paper = litc({ r: 239, g: 229, b: 204 }, atm),
    ink = litc({ r: 66, g: 77, b: 67 }, atm);
  const grain = (u: number, v: number, w: number, h: number, z: number) => {
    for (let i = 1; i < 6; i++) {
      const vv = v - h / 2 + (h * i) / 6;
      line([p(u - w * 0.46, vv, z + 0.1), p(u + w * 0.42, vv + 0.008 * Math.sin(i), z + 0.1)], dark, 0.55, 0.22);
    }
  };
  return { ctx, p, path, face, line, rect, box, wood, dark, light, paper, ink, grain };
}

export const drawTable: Drawer = (d) => {
  shadowUnder(d, 41, 17, 0.85);
  workshop(d, ({ ctx, p, box, rect, wood, dark, light, paper, grain, line }) => {
    for (const u of [-0.35, 0.35]) for (const v of [-0.27, 0.27]) box(u, v, 0.075, 0.075, 0, 18, dark);
    box(0, 0, 0.92, 0.76, 15, 20, wood);
    grain(0, 0, 0.9, 0.73, 20);
    line([p(-0.46, 0.38, 20.5), p(0.46, 0.38, 20.5)], light, 0.9, 0.8);
    // Lacquer tray, two cups and a small pot: readable even at phone zoom.
    rect(0.03, 0, 0.46, 0.3, 20.5, shade(dark, 1.1));
    for (const u of [-0.1, 0.17]) {
      const q = p(u, 0.055, 22);
      oval(ctx, q.x, q.y, 4.1, 2.8, css(paper));
      oval(ctx, q.x, q.y - 1.2, 3.1, 1.4, css(dark));
    }
    const q = p(0.035, -0.09, 25);
    oval(ctx, q.x, q.y, 5.3, 4.1, css(litc({ r: 111, g: 142, b: 138 }, d.atm)));
    oval(ctx, q.x, q.y - 3, 4, 1.4, css(paper, 0.65));
    stroke(ctx, css(paper, 0.16), 1, () => {
      ctx.moveTo(q.x, q.y - 5);
      ctx.bezierCurveTo(q.x + Math.sin(d.time * 0.002) * 3, q.y - 10, q.x - 3, q.y - 14, q.x + 1, q.y - 18);
    });
  });
};
export const drawCushion: Drawer = (d) => {
  shadowUnder(d, 30, 13, 0.65);
  workshop(d, ({ ctx, p, line }) => {
    const r = hash2(d.obj.seed, 1, 3),
      cloth = litc(
        r > 0.6 ? { r: 161, g: 80, b: 72 } : r > 0.3 ? { r: 82, g: 112, b: 139 } : { r: 157, g: 142, b: 103 },
        d.atm,
      );
    const corners = [p(-0.31, -0.31, 3), p(0.31, -0.31, 3), p(0.31, 0.31, 3), p(-0.31, 0.31, 3)];
    const outline = (dy: number) => {
      ctx.moveTo((corners[3].x + corners[0].x) / 2, (corners[3].y + corners[0].y) / 2 + dy);
      corners.forEach((q, i) => {
        const n = corners[(i + 1) % 4];
        ctx.quadraticCurveTo(q.x * 1.08, q.y - 2 + dy, (q.x + n.x) / 2, (q.y + n.y) / 2 + dy);
      });
    };
    shape(ctx, css(shade(cloth, 0.76)), () => outline(3));
    shape(ctx, css(cloth), () => outline(0));
    line([p(-0.23, -0.23, 4), p(0.23, -0.23, 4), p(0.23, 0.23, 4)], shade(cloth, 1.3), 0.8, 0.55);
    line([p(-0.23, -0.23, 4), p(-0.23, 0.23, 4), p(0.23, 0.23, 4)], shade(cloth, 0.75), 0.7, 0.45);
    for (const u of [-1, 1])
      for (const v of [-1, 1]) line([p(u * 0.24, v * 0.24, 4), p(u * 0.13, v * 0.13, 5)], shade(cloth, 0.8), 0.7, 0.65);
    const c = p(0, 0, 4);
    oval(ctx, c.x, c.y, 1.7, 0.9, css(shade(cloth, 0.75), 0.6));
  });
};
export const drawFuton: Drawer = (d) => {
  shadowUnder(d, 43, 17, 0.55);
  workshop(d, ({ ctx, p, box, line, paper }) => {
    const cloth = litc({ r: 156, g: 96, b: 96 }, d.atm);
    box(0, 0, 0.94, 0.7, 0, 5, shade(paper, 0.94));
    box(0.11, 0, 0.68, 0.68, 5, 8, cloth);
    box(-0.3, 0, 0.19, 0.52, 5, 11, paper);
    line([p(-0.22, -0.33, 9), p(-0.18, 0, 9), p(-0.22, 0.33, 9)], mix(cloth, paper, 0.55), 3);
    for (const v of [-0.18, 0, 0.18]) line([p(-0.06, v, 8.4), p(0.36, v, 8.4)], mix(cloth, paper, 0.15), 0.7, 0.55);
    const q = p(-0.3, 0, 11);
    oval(ctx, q.x, q.y, 3, 1, css(shade(paper, 0.8), 0.18));
  });
};
export const drawIrori: Drawer = (d) => {
  shadowUnder(d, 40, 16, 0.7);
  workshop(d, ({ ctx, p, box, rect, wood, dark, line }) => {
    box(0, 0, 0.86, 0.86, 0, 4, dark);
    rect(0, 0, 0.74, 0.74, 4.3, wood);
    rect(0, 0, 0.62, 0.62, 4.5, litc({ r: 83, g: 81, b: 77 }, d.atm));
    for (let i = 0; i < 9; i++) {
      const q = p((hash2(i, d.obj.seed, 11) - 0.5) * 0.49, (hash2(i, d.obj.seed, 17) - 0.5) * 0.49, 5);
      oval(ctx, q.x, q.y, 3, 1.5, css({ r: 226, g: 124, b: 55 }, 0.65));
    }
    const heat = 0.6 + 0.15 * Math.sin(d.time * 0.007 + d.obj.seed);
    glow(ctx, 0, -5, 42, { r: 249, g: 161, b: 67 }, heat * (0.1 + d.atm.lampGlow * 0.16));
    for (let i = 0; i < 3; i++) {
      const q = p((i - 1) * 0.1, 0, 6),
        h = 8 + Math.sin(d.time * 0.009 + i) * 3;
      shape(ctx, css({ r: 249, g: 184, b: 77 }, 0.65), () => {
        ctx.moveTo(q.x - 2, q.y);
        ctx.quadraticCurveTo(q.x + 3, q.y - h, q.x + 2, q.y);
      });
    }
    const iron = litc({ r: 59, g: 61, b: 60 }, d.atm);
    // A visible support and hook, not an unexplained thread hanging in mid-air.
    line([p(-0.3, -0.25, 4), p(-0.3, -0.25, 54), p(0, 0, 54), p(0, 0, 29)], iron, 2.3);
    const q = p(0, 0, 23);
    oval(ctx, q.x, q.y, 10, 7, css(iron));
    oval(ctx, q.x, q.y - 5, 8, 3, css(shade(iron, 1.4)));
    stroke(ctx, css(iron), 1.8, () => ctx.arc(q.x, q.y - 7, 7, Math.PI, Math.PI * 2));
    stroke(ctx, css({ r: 247, g: 239, b: 219 }, 0.2), 1.2, () => {
      ctx.moveTo(q.x, q.y - 10);
      ctx.bezierCurveTo(q.x + 3, q.y - 16, q.x - 4, q.y - 21, q.x + Math.sin(d.time * 0.002) * 3, q.y - 27);
    });
  });
};

function panel(d: DrawCtx, kind: 'shoji' | 'fusuma' | 'byobu' | 'tokonoma') {
  shadowUnder(d, 34, 10, 0.6);
  workshop(d, ({ ctx, p, face, line, box, wood, dark, paper, ink, grain }) => {
    const height = kind === 'byobu' ? 61 : 70,
      count = kind === 'byobu' ? 3 : kind === 'tokonoma' ? 1 : 2;
    if (kind === 'tokonoma') {
      box(0, 0.02, 0.98, 0.5, 0, 7, wood);
      grain(0, 0.02, 0.95, 0.48, 7);
    }
    for (let i = 0; i < count; i++) {
      const u0 = -0.5 + i / count,
        u1 = -0.5 + (i + 1) / count;
      const v0 = kind === 'byobu' ? (i % 2 ? -0.08 : 0.08) : -0.1;
      const v1 = kind === 'byobu' ? (i % 2 ? 0.08 : -0.08) : -0.1;
      const a = p(u0, v0, 3),
        b = p(u1, v1, 3),
        at = p(u0, v0, height),
        bt = p(u1, v1, height);
      const pts = [a, b, bt, at];
      face(pts, shade(paper, kind === 'byobu' && i % 2 ? 0.93 : 1));
      ctx.save();
      ctx.beginPath();
      pts.forEach((q, j) => (j ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y)));
      ctx.closePath();
      ctx.clip();
      if (kind === 'shoji') {
        for (let k = 1; k <= 3; k++) {
          const u = u0 + ((u1 - u0) * k) / 4;
          line([p(u, v0, 4), p(u, v1, height)], wood, 0.8, 0.65);
        }
        for (let z = 14; z < height; z += 13) line([p(u0, v0, z), p(u1, v1, z)], wood, 0.85, 0.7);
      } else if (kind !== 'tokonoma') {
        const col = litc({ r: 127, g: 143, b: 119 }, d.atm);
        face([p(u0, v0, 6), p(u0, v0, 26), p((u0 + u1) / 2, v0, 40 + i * 5), p(u1, v1, 19), p(u1, v1, 6)], col, 0.35);
        line([p(u0 + 0.06, v0, 8), p(u0 + 0.12, v0, 26), p(u0 + 0.08, v0, 42)], ink, 1, 0.55);
        const q = p(u0 + 0.11, v0, 37);
        oval(ctx, q.x, q.y, 8, 3, css(col, 0.5));
      }
      ctx.restore();
      line([...pts, a], dark, 2.5);
      if (kind === 'fusuma') {
        const q = p(i === 0 ? u1 - 0.09 : u0 + 0.09, -0.1, 31);
        oval(ctx, q.x, q.y, 2.5, 3.3, css(dark));
      }
    }
    if (kind === 'tokonoma') {
      face(
        [p(-0.15, -0.095, 21), p(0.15, -0.095, 21), p(0.15, -0.095, 63), p(-0.15, -0.095, 63)],
        litc({ r: 218, g: 213, b: 191 }, d.atm),
      );
      for (const z of [21, 63]) line([p(-0.18, -0.095, z), p(0.18, -0.095, z)], dark, 2.4);
      line([p(-0.08, -0.09, 33), p(0.02, -0.09, 49), p(0.09, -0.09, 39)], ink, 2, 0.65);
      const q = p(0.29, 0.1, 15);
      oval(ctx, q.x, q.y, 5.5, 8, css(litc({ r: 113, g: 145, b: 149 }, d.atm)));
      line([p(0.29, 0.1, 22), p(0.26, 0.1, 37), p(0.37, 0.1, 43)], ink, 1.2);
      const f = p(0.37, 0.1, 43);
      oval(ctx, f.x, f.y, 4, 2, css(litc({ r: 199, g: 123, b: 119 }, d.atm)));
    }
  });
}
export const drawByobu: Drawer = (d) => panel(d, 'byobu');
export const drawFusuma: Drawer = (d) => panel(d, 'fusuma');
export const drawShoji: Drawer = (d) => panel(d, 'shoji');
export const drawTokonoma: Drawer = (d) => panel(d, 'tokonoma');
export const drawTansu: Drawer = (d) => {
  shadowUnder(d, 38, 14, 0.7);
  workshop(d, ({ p, box, line, wood, dark, paper, grain }) => {
    for (const u of [-0.37, 0.37]) box(u, 0, 0.08, 0.34, 0, 3, dark);
    box(0, 0, 0.92, 0.48, 2, 33, wood);
    grain(0, 0, 0.9, 0.47, 33);
    // Only draw the front's handles when that face is visible after rotation.
    if (p(0, 1).y > 0)
      for (const z of [11, 23]) {
        line([p(-0.42, 0.244, z - 6), p(0.42, 0.244, z - 6)], dark, 0.9, 0.65);
        line([p(-0.08, 0.25, z), p(0.08, 0.25, z)], dark, 2.3);
        for (const u of [-0.1, 0.1]) line([p(u, 0.25, z - 1.5), p(u, 0.25, z + 1.5)], dark, 1.5);
      }
    box(-0.18, 0, 0.24, 0.28, 33, 36, paper);
    box(-0.16, -0.015, 0.26, 0.27, 36, 38, litc({ r: 115, g: 133, b: 143 }, d.atm));
  });
};
export const drawIndoorPlant: Drawer = (d) => {
  shadowUnder(d, 17, 8, 0.55);
  workshop(d, ({ ctx, p, line, dark }) => {
    const ceramic = litc({ r: 125, g: 151, b: 147 }, d.atm),
      leaf = litc({ r: 87, g: 125, b: 85 }, d.atm);
    const q = p(0, 0, 7);
    shape(ctx, css(ceramic), () => {
      ctx.moveTo(-12, q.y - 7);
      ctx.lineTo(12, q.y - 7);
      ctx.lineTo(8, q.y + 7);
      ctx.lineTo(-8, q.y + 7);
    });
    oval(ctx, 0, q.y - 7, 12, 5, css(shade(ceramic, 1.18)));
    oval(ctx, 0, q.y - 7, 9, 3, css(dark));
    for (let i = 0; i < 7; i++) {
      const a = i * 2.4,
        x = Math.cos(a) * (12 + hash2(i, d.obj.seed, 7) * 10),
        y = -27 - hash2(i, d.obj.seed, 9) * 21;
      line(
        [
          { x: 0, y: -13 },
          { x: x * 0.4, y: y + 8 },
          { x, y },
        ],
        leaf,
        1.2,
      );
      oval(ctx, x, y, 7, 3, css(shade(leaf, 0.9 + hash2(i, 2, 3) * 0.3)), a * 0.4);
    }
  });
};
export const drawBonsai: Drawer = (d) => {
  shadowUnder(d, 24, 10, 0.65);
  workshop(d, ({ ctx, box, line, wood }) => {
    box(0, 0, 0.4, 0.29, 0, 8, litc({ r: 108, g: 86, b: 66 }, d.atm));
    const growth = 0.45 + Math.max(0, Math.min(1, d.g)) * 0.55;
    ctx.translate(0, -8);
    ctx.scale(growth, growth);
    ctx.translate(0, 8);
    line(
      [
        { x: 0, y: -8 },
        { x: -6, y: -23 },
        { x: 5, y: -37 },
      ],
      wood,
      4,
    );
    const leaf = litc(d.atm.season === 'autumn' ? { r: 175, g: 130, b: 68 } : { r: 76, g: 126, b: 81 }, d.atm);
    for (const [x, y, r] of [
      [5, -37, 16],
      [-10, -29, 12],
      [15, -28, 10],
    ])
      washBlob(ctx, x, y, r, r * 0.5, leaf, d.obj.seed + x, { layers: 2, alpha: 0.55, edge: 0.12 });
  });
};

/** Quilted cover drapes from the tabletop down to the floor, without enlarging the placement tile. */
export const drawKotatsu: Drawer = (d) => {
  shadowUnder(d, 44, 18, 0.7);
  workshop(d, ({ ctx, p, face, line, box, wood, paper, grain }) => {
    const cloth = litc({ r: 91, g: 119, b: 143 }, d.atm),
      seam = mix(cloth, paper, 0.38);
    const corners = [
      [-1, -1],
      [1, -1],
      [1, 1],
      [-1, 1],
    ];
    const sides = corners
      .map((a, i) => ({
        a,
        b: corners[(i + 1) % 4],
        depth: p(a[0] + corners[(i + 1) % 4][0], a[1] + corners[(i + 1) % 4][1]).y,
      }))
      .sort((a, b) => a.depth - b.depth);
    for (const { a, b } of sides) {
      const pts = [
        p(a[0] * 0.46, a[1] * 0.46, 2),
        p(b[0] * 0.46, b[1] * 0.46, 2),
        p(b[0] * 0.31, b[1] * 0.31, 20),
        p(a[0] * 0.31, a[1] * 0.31, 20),
      ];
      face(pts, shade(cloth, a[0] === b[0] ? 0.86 : 1));
      for (const t of [0.2, 0.4, 0.6, 0.8]) {
        const u = a[0] + (b[0] - a[0]) * t,
          v = a[1] + (b[1] - a[1]) * t;
        line([p(u * 0.32, v * 0.32, 18), p(u * 0.38, v * 0.38, 11), p(u * 0.445, v * 0.445, 3)], seam, 0.8, 0.6);
      }
      line([p(a[0] * 0.44, a[1] * 0.44, 3), p(b[0] * 0.44, b[1] * 0.44, 3)], seam, 1.4, 0.8);
    }
    box(0, 0, 0.73, 0.73, 20, 24, wood);
    grain(0, 0, 0.7, 0.7, 24);
    const q = p(0.14, -0.08, 27);
    oval(ctx, q.x, q.y, 4, 3, css(paper));
    oval(ctx, q.x, q.y - 1, 3, 1.5, css(litc({ r: 85, g: 99, b: 70 }, d.atm)));
    box(-0.13, 0.05, 0.22, 0.26, 24, 26, litc({ r: 159, g: 89, b: 72 }, d.atm));
  });
};
export const drawBookshelf: Drawer = (d) => {
  shadowUnder(d, 33, 12, 0.65);
  workshop(d, ({ ctx, p, box, face, line, wood, dark, paper, grain }) => {
    box(0, 0, 0.88, 0.36, 0, 60, wood);
    grain(0, 0, 0.85, 0.34, 60);
    if (p(0, 1).y <= 0) return;
    face([p(-0.38, 0.182, 5), p(0.38, 0.182, 5), p(0.38, 0.182, 55), p(-0.38, 0.182, 55)], shade(dark, 0.9));
    const colors = [
      { r: 144, g: 84, b: 70 },
      { r: 100, g: 126, b: 137 },
      { r: 169, g: 145, b: 91 },
      { r: 148, g: 146, b: 119 },
    ];
    for (const z of [6, 30]) {
      for (let i = 0; i < 6; i++) {
        const u = -0.28 + i * 0.085,
          height = 14 + hash2(i, z, d.obj.seed) * 7;
        box(u, 0.085, 0.069, 0.16, z, z + height, litc(colors[(i + (z === 6 ? 0 : 2)) % 4], d.atm));
        line([p(u - 0.027, 0.168, z + height - 4), p(u + 0.027, 0.168, z + height - 4)], paper, 0.7, 0.6);
      }
      const q = p(0.285, 0.1, z + 7);
      oval(ctx, q.x, q.y, 4, 6, css(litc({ r: 143, g: 166, b: 157 }, d.atm)));
      box(0, 0, 0.8, 0.36, z - 2, z, wood);
    }
    // Front stiles mask the interior edges; no books can bleed through the cabinet sides.
    for (const u of [-0.41, 0.41]) line([p(u, 0.185, 2), p(u, 0.185, 58)], wood, 3);
  });
};
export const drawEngawaBench: Drawer = (d) => {
  shadowUnder(d, 35, 13, 0.7);
  workshop(d, ({ ctx, p, box, line, wood, dark, paper, grain }) => {
    for (const u of [-0.36, 0.36]) for (const v of [-0.13, 0.13]) box(u, v, 0.075, 0.075, 0, 17, dark);
    box(0, 0, 0.95, 0.41, 15, 19, wood);
    grain(0, 0, 0.91, 0.38, 19);
    box(-0.18, 0, 0.43, 0.34, 19, 22, litc({ r: 132, g: 149, b: 120 }, d.atm));
    line([p(-0.36, -0.13, 22.4), p(0.01, -0.13, 22.4)], paper, 0.65, 0.6);
    const q = p(0.3, 0.01, 21);
    oval(ctx, q.x, q.y, 3.5, 2.5, css(paper));
    oval(ctx, q.x, q.y - 1, 2.7, 1.3, css(dark));
  });
};
