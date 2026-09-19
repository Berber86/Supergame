/** Small buildings use the same joinery/isometric coordinates as the main house and furniture. */
import type { Pt } from '../../core/iso';
import { ITEM_BY_ID } from '../../world/catalog';
import { css, mix, shade } from '../../world/palette';
import { hash2 } from '../../core/rng';
import { type Drawer, type DrawCtx, litc, shadowUnder } from './common';
import { workshop } from './furniture';
import { paintRoofSnow, paintSnowRidge, paintIcicles, roofSnow } from '../roofSnow';

/** Catalogue dimensions are deliberately swapped at rotation 0 (legacy placement convention). */
export function smallHouseSize(type: string) {
  const item = ITEM_BY_ID.get(type)!;
  return { u: item.h * 0.94, v: item.w * 0.94 };
}
function drawHouse(d: DrawCtx) {
  const kind = d.obj.type,
    shed = kind === 'shed',
    open = kind === 'pavilion',
    tea = kind === 'tea_house';
  const { u, v } = smallHouseSize(kind),
    wallH = shed ? 49 : tea ? 61 : 68;
  shadowUnder(d, (u + v) * 23, (u + v) * 10, 1.25);
  workshop(d, ({ ctx, p, face, line, box, wood, dark, paper, light, grain }) => {
    box(0, 0, u, v, 0, 5, wood);
    grain(0, 0, u * 0.98, v * 0.98, 5);
    const bu = u * 0.78,
      bv = v * 0.72;
    const corners = [
      [-bu / 2, -bv / 2],
      [bu / 2, -bv / 2],
      [bu / 2, bv / 2],
      [-bu / 2, bv / 2],
    ];
    if (!open) {
      box(0, 0, bu, bv, 5, wallH, shed ? wood : shade(paper, 0.9));
      // Front-facing walls only; detail remains attached to its wall in all four rotations.
      for (let side = 0; side < 4; side++) {
        const a = corners[side],
          b = corners[(side + 1) % 4];
        if (p((a[0] + b[0]) / 2, (a[1] + b[1]) / 2).y <= 0) continue;
        const at = (t: number, z: number) => p(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, z);
        face([at(0, 5), at(1, 5), at(1, 18), at(0, 18)], shade(wood, 0.84));
        for (let i = 1; i < 9; i++) line([at(i / 9, 6), at(i / 9, shed ? wallH - 1 : 17)], dark, 0.65, 0.4);
        line([at(0, 18), at(1, 18)], dark, 1.5, 0.65);
        if (side === 2) {
          face([at(0.28, 6), at(0.72, 6), at(0.72, wallH - 8), at(0.28, wallH - 8)], dark);
          if (!shed) {
            face(
              [at(0.32, 10), at(0.68, 10), at(0.68, wallH - 12), at(0.32, wallH - 12)],
              mix(paper, litc({ r: 247, g: 190, b: 113 }, d.atm), d.atm.lampGlow * 0.5),
            );
            for (let j = 1; j < 4; j++) line([at(0.32 + j * 0.09, 10), at(0.32 + j * 0.09, wallH - 12)], wood, 0.8);
            for (let z = 20; z < wallH - 12; z += 10) line([at(0.32, z), at(0.68, z)], wood, 0.8);
            if (tea)
              for (let k = 0; k < 3; k++) {
                const a = 0.24 + k * 0.175,
                  b = a + 0.16;
                face(
                  [at(a, wallH - 22), at(b, wallH - 22), at(b, wallH - 7), at(a, wallH - 7)],
                  litc({ r: 156, g: 77, b: 66 }, d.atm),
                );
                line([at((a + b) / 2, wallH - 18), at((a + b) / 2, wallH - 12)], paper, 1, 0.65);
              }
          } else {
            line([at(0.43, 9), at(0.46, wallH - 14)], light, 1.7);
            line([at(0.37, wallH - 13), at(0.56, wallH - 13)], light, 1.7);
            for (let i = 0; i < 5; i++)
              line([at(0.38 + i * 0.042, wallH - 13), at(0.38 + i * 0.042, wallH - 9)], light, 1);
            line([at(0.63, 9), at(0.59, wallH - 18)], light, 1.5);
          }
          line([at(0.24, 6), at(0.76, 6)], light, 3);
        } else if (!shed) {
          face([at(0.18, 25), at(0.82, 25), at(0.82, wallH - 11), at(0.18, wallH - 11)], paper);
          for (let j = 0; j <= 4; j++)
            line([at(0.18 + j * 0.16, 25), at(0.18 + j * 0.16, wallH - 11)], wood, j % 4 ? 1 : 2);
          for (const z of [25, wallH - 23, wallH - 11]) line([at(0.18, z), at(0.82, z)], wood, 1.4);
        }
        line([at(0, wallH - 2), at(1, wallH - 2)], dark, 4);
      }
    } else {
      // A bench inside the open pavilion, behind the front columns.
      for (const x of [-bu * 0.3, bu * 0.3]) box(x, -bv * 0.3, 0.1, 0.16, 5, 19, dark);
      box(0, -bv * 0.3, bu * 0.8, 0.24, 18, 22, wood);
    }
    for (const [x, y] of corners) {
      box(x, y, 0.06, 0.06, 5, wallH, dark);
      line([p(x - 0.015, y, 8), p(x - 0.015, y, wallH - 3)], light, 0.8, 0.7);
    }
    // Small hip roof with coherent eaves and ridge; all pieces use rotated ground coordinates.
    const eaves = [
      p(-u / 2, -v / 2, wallH + 3),
      p(u / 2, -v / 2, wallH + 3),
      p(u / 2, v / 2, wallH + 3),
      p(-u / 2, v / 2, wallH + 3),
    ];
    const rise = 20 + Math.min(u, v) * 12;
    const a = u >= v ? p(-u * 0.24, 0, wallH + rise) : p(0, -v * 0.24, wallH + rise);
    const b = u >= v ? p(u * 0.24, 0, wallH + rise) : p(0, v * 0.24, wallH + rise);
    const ends =
      u >= v
        ? [
            [a, b],
            [b, b],
            [b, a],
            [a, a],
          ]
        : [
            [a, a],
            [a, b],
            [b, b],
            [b, a],
          ];
    const snow = roofSnow(d.atm, d.obj.seed),
      roof = litc(shed ? { r: 168, g: 143, b: 92 } : { r: 100, g: 111, b: 121 }, d.atm);
    const slopes = eaves.map((e, i) => ({ i, e, f: eaves[(i + 1) % 4], r: ends[i][0], s: ends[i][1] }));
    slopes.sort((a, b) => a.e.y + a.f.y - (b.e.y + b.f.y));
    for (const { i, e, f, r, s } of slopes) {
      const point = (u: number, v: number): Pt => ({
        x: (r.x + (s.x - r.x) * u) * (1 - v) + (e.x + (f.x - e.x) * u) * v,
        y: (r.y + (s.y - r.y) * u) * (1 - v) + (e.y + (f.y - e.y) * u) * v + Math.sin(u * Math.PI) * 2 * v * v,
      });
      const edge = Array.from({ length: 17 }, (_, k) => point(k / 16, 1)),
        outline = [r, s, ...edge.slice().reverse()];
      // Fascia hangs beneath each eave. Rear edges are later occluded by the nearer roof slopes.
      face(
        [
          ...edge,
          ...edge
            .slice()
            .reverse()
            .map((q) => ({ x: q.x, y: q.y + 5 })),
        ],
        dark,
      );
      face(outline, shade(roof, 0.86 + (i % 2) * 0.12));
      ctx.save();
      ctx.beginPath();
      outline.forEach((q, j) => (j ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y)));
      ctx.closePath();
      ctx.clip();
      const tiles = Math.ceil((i % 2 ? v : u) * 8);
      for (let k = 1; k < tiles; k++) {
        const t = k / tiles,
          top = point(0.5, 0),
          low = point(0.5, 1),
          dx = (t - 0.5) * (f.x - e.x),
          dy = (t - 0.5) * (f.y - e.y);
        line(
          [
            { x: top.x + dx, y: top.y + dy },
            { x: low.x + dx, y: low.y + dy },
          ],
          shade(roof, 0.66),
          shed ? 1.2 : 0.7,
          0.4,
        );
        if (shed && hash2(k, i, d.obj.seed) > 0.6) line([point(t, 0.65), point(t, 1)], light, 0.8, 0.5);
      }
      if (!shed)
        for (let row = 1; row < 6; row++)
          line(
            Array.from({ length: 17 }, (_, k) => point(k / 16, row / 6)),
            shade(roof, 0.62),
            0.8,
            0.45,
          );
      paintRoofSnow(ctx, d.atm, snow, outline, point, i);
      ctx.restore();
      line(edge, dark, 1.7, 0.9);
      if ((e.y + f.y) / 2 > p(0, 0, wallH + 3).y) paintIcicles(ctx, d.atm, snow, edge, i);
      for (let k = 1; k < tiles; k += 3) {
        const q = point(k / tiles, 1);
        line(
          [
            { x: q.x, y: q.y + 2 },
            { x: q.x, y: q.y + 4 },
          ],
          light,
          1.5,
          0.75,
        );
      }
    }
    for (let i = 0; i < 4; i++) line([eaves[i], ends[i][0]], shade(roof, 0.62), 2);
    line([a, b], dark, 5);
    line(
      [
        { x: a.x, y: a.y - 1.5 },
        { x: b.x, y: b.y - 1.5 },
      ],
      shade(roof, 1.35),
      2,
    );
    paintSnowRidge(ctx, d.atm, snow, a, b);
    if (snow.amount > 0.7)
      for (let i = 0; i < 4; i++) {
        const q = ends[i][0];
        line(
          [
            { x: q.x, y: q.y - 1.5 },
            { x: q.x + (eaves[i].x - q.x) * 0.75, y: q.y + (eaves[i].y - q.y) * 0.75 - 1.5 },
          ],
          shade(mix(paper, { r: 219, g: 231, b: 242 }, 0.3), 1.03),
          1.4,
          0.7,
        );
      }
    // No screen-space doors/windows or random silhouette mirroring.
    ctx.fillStyle = css(wood);
  });
}
export const drawTeaHouse: Drawer = drawHouse;
export const drawShed: Drawer = drawHouse;
export const drawTinyHouse: Drawer = drawHouse;
export const drawPavilion: Drawer = drawHouse;
