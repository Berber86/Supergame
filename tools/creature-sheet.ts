/**
 * Лист поз: коты во всех состояниях и шубах, птицы по видам и позам,
 * бабочка, лягушки и стрекозы крупно. Инструмент разработки — проверить
 * силуэты без запуска игры.
 *   npx tsx tools/creature-sheet.ts [файл]
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
  const { drawCat, drawBird, drawButterfly } = await import('../src/render/creatures');
  const { drawFrog, drawDragonfly } = await import('../src/render/residents');
  const { drawDeer, drawFirefly, drawHeron } = await import('../src/render/wildlife');
  const wtype = await import('../src/world/wildlife');
  const { buildAtmosphere } = await import('../src/world/palette');
  const { computeTime } = await import('../src/core/clock');
  const type = await import('../src/world/life');
  const rtype = await import('../src/world/residents');

  const d = new Date();
  d.setHours(13, 0, 0, 0);
  const atm = buildAtmosphere(computeTime(d.getTime()));

  const catStates: type.CatState[] = ['sleep', 'loaf', 'sit', 'wash', 'stretch', 'walk'];
  const coats: type.CatCoat[] = ['cream', 'grey', 'black', 'tortoise'];
  const species: type.BirdSpecies[] = ['sparrow', 'tit', 'finch', 'wagtail', 'bullfinch'];
  const cells: { label: string; draw: (cx: number, cy: number) => void }[] = [];

  // Кот: каждое состояние в обе стороны
  for (const st of catStates) {
    for (const facing of [1, -1]) {
      cells.push({
        label: `${st} ${facing > 0 ? '→' : '←'}`,
        draw: (cx, cy) => {
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
            guest: false,
            coat: 'cream',
            greet: 0,
            leaveAt: 0,
            stayAt: 0,
          };
          drawCat(ctx, cat, cx, cy, atm, 2500);
        },
      });
    }
  }
  // Шубы: сидят столбиком
  for (const coat of coats) {
    cells.push({
      label: `кот ${coat}`,
      draw: (cx, cy) => {
        const cat: type.Cat = {
          id: 2,
          tx: 0,
          ty: 0,
          facing: 1,
          seed: 7,
          state: 'sit',
          timer: 1000,
          target: null,
          phase: 0.5,
          speed: 0,
          home: null,
          guest: coat !== 'cream',
          coat,
          greet: 0,
          leaveAt: 0,
          stayAt: 0,
        };
        drawCat(ctx, cat, cx, cy, atm, 2500);
      },
    });
  }
  // Птицы: виды на земле, на кормушке и в полёте
  for (const sp of species) {
    cells.push({
      label: `${sp} земля`,
      draw: (cx, cy) => {
        const bird: type.Bird = {
          tx: 0,
          ty: 0,
          facing: 1,
          seed: 7,
          state: 'hop',
          timer: 0,
          target: null,
          alt: 0,
          hop: 0.6,
          scale: 1,
          species: sp,
          place: 'ground',
          slot: 0,
        };
        drawBird(ctx, bird, cx, cy, atm, 2500);
      },
    });
    cells.push({
      label: `${sp} кормушка`,
      draw: (cx, cy) => {
        const bird: type.Bird = {
          tx: 0,
          ty: 0,
          facing: 1,
          seed: 11,
          state: 'feed',
          timer: 0,
          target: null,
          alt: 26,
          hop: 0,
          scale: 1,
          species: sp,
          place: 'feeder',
          slot: 0,
        };
        drawBird(ctx, bird, cx, cy, atm, 2500);
      },
    });
  }
  cells.push({
    label: 'птица полёт',
    draw: (cx, cy) => {
      const bird: type.Bird = {
        tx: 0,
        ty: 0,
        facing: 1,
        seed: 7,
        state: 'fly-in',
        timer: 0,
        target: null,
        alt: 26,
        hop: 0.6,
        scale: 1,
        species: 'tit',
        place: 'ground',
        slot: 0,
      };
      drawBird(ctx, bird, cx, cy, atm, 2500);
    },
  });
  cells.push({
    label: 'птица купается',
    draw: (cx, cy) => {
      const bird: type.Bird = {
        tx: 0,
        ty: 0,
        facing: 1,
        seed: 5,
        state: 'bathe',
        timer: 0,
        target: null,
        alt: 7,
        hop: 0,
        scale: 1,
        species: 'sparrow',
        place: 'bath',
        slot: 0,
      };
      drawBird(ctx, bird, cx, cy, atm, 2500);
    },
  });

  // Бабочка
  cells.push({
    label: 'бабочка',
    draw: (cx, cy) => {
      const f: type.Flutter = {
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
        resting: 0,
      };
      drawButterfly(ctx, f, cx, cy - 12, atm, 2500);
    },
  });

  // Лягушки: сидит, поёт, прыгает; две шубы
  const frogStates: { st: rtype.FrogState; species: 'green' | 'brown'; label: string }[] = [
    { st: 'sit', species: 'green', label: 'лягушка сидит' },
    { st: 'call', species: 'green', label: 'лягушка поёт' },
    { st: 'hop', species: 'brown', label: 'лягушка прыжок' },
    { st: 'sit', species: 'brown', label: 'лягушка бурая' },
  ];
  for (const fs of frogStates) {
    cells.push({
      label: fs.label,
      draw: (cx, cy) => {
        const frog: rtype.Frog = {
          id: 1,
          tx: 0,
          ty: 0,
          facing: 1,
          seed: 33,
          state: fs.st,
          timer: 500,
          phase: fs.st === 'hop' ? 0.5 : fs.st === 'call' ? 0.35 : 0,
          from: { x: -1, y: 0 },
          target: { x: 1, y: 0 },
          pond: 0,
          species: fs.species,
          size: 1.5,
          throat: fs.st === 'call' ? 0.9 : 0,
          hidden: 0,
          gone: false,
          answer: 0,
        };
        drawFrog(ctx, frog, cx, cy, atm, 2500);
      },
    });
  }

  // Стрекозы: коромысло и стрелка в полёте и на насесте
  const flyCases: { kind: 'hawker' | 'damselfly'; state: rtype.FlyState; label: string }[] = [
    { kind: 'hawker', state: 'patrol', label: 'коромысло летит' },
    { kind: 'hawker', state: 'perch', label: 'коромысло сидит' },
    { kind: 'damselfly', state: 'hover', label: 'стрелка зависла' },
    { kind: 'damselfly', state: 'perch', label: 'стрелка сидит' },
  ];
  for (const fc of flyCases) {
    cells.push({
      label: fc.label,
      draw: (cx, cy) => {
        const df: rtype.PondDragonfly = {
          id: 1,
          kind: fc.kind,
          tx: 0,
          ty: 0,
          alt: fc.state === 'perch' ? 9 : 24,
          vx: 0.002,
          vy: 0.0004,
          facing: 1,
          seed: 88,
          state: fc.state,
          timer: 500,
          phase: 0,
          pond: 0,
          target: null,
          perch: null,
        };
        drawDragonfly(ctx, df, cx, cy - 6, atm, 2500);
      },
    });
  }

  // Цапля: основные позы
  const heronCases: { st: wtype.HeronState; label: string; timer?: number; fish?: number }[] = [
    { st: 'stand', label: 'цапля стоит' },
    { st: 'stalk', label: 'цапля крадётся' },
    { st: 'strike', timer: 480, label: 'цапля бьёт' },
    { st: 'preen', label: 'цапля чистится' },
    { st: 'fly-in', label: 'цапля летит', fish: 0 },
  ];
  for (const hc of heronCases) {
    cells.push({
      label: hc.label,
      draw: (cx, cy) => {
        const hr: wtype.Heron = {
          tx: 0,
          ty: 0,
          from: { x: -4, y: 0 },
          target: { x: 2, y: 0 },
          state: hc.st,
          timer: hc.timer ?? 5000,
          facing: 1,
          phase: hc.st === 'fly-in' ? 0.5 : 0.6,
          fish: hc.fish ?? 0,
          struck: false,
          born: 0,
          stay: 1e9,
        };
        drawHeron(ctx, hr, cx, cy + 26, atm, 2500);
      },
    });
  }
  // Цапля с рыбой в клюве
  cells.push({
    label: 'цапля с рыбой',
    draw: (cx, cy) => {
      const hr: wtype.Heron = {
        tx: 0,
        ty: 0,
        from: null,
        target: null,
        state: 'stand',
        timer: 5000,
        facing: 1,
        phase: 1,
        fish: 2,
        struck: false,
        born: 0,
        stay: 1e9,
      };
      drawHeron(ctx, hr, cx, cy + 26, atm, 2500);
    },
  });

  // Олень: сезоны шкуры и позы
  const deerCases: { coat: wtype.DeerCoat; st: wtype.DeerState; label: string }[] = [
    { coat: { spots: false, antlers: true, winter: false }, st: 'look', label: 'олень осенью' },
    { coat: { spots: true, antlers: true, winter: false }, st: 'graze', label: 'олень летом щиплет' },
    { coat: { spots: true, antlers: false, winter: false }, st: 'walk', label: 'олень весной идёт' },
    { coat: { spots: false, antlers: false, winter: true }, st: 'look', label: 'олень зимой' },
  ];
  for (const dc of deerCases) {
    cells.push({
      label: dc.label,
      draw: (cx, cy) => {
        const d: wtype.Deer = {
          tx: 0,
          ty: 0,
          from: { x: -3, y: 0 },
          target: { x: 3, y: 0 },
          state: dc.st,
          timer: 5000,
          facing: 1,
          phase: dc.st === 'walk' ? 0.5 : 0,
          seed: 12,
          coat: dc.coat,
          born: 0,
          stay: 1e9,
        };
        drawDeer(ctx, d, cx, cy + 30, atm, 2500);
      },
    });
  }

  // Светлячок: вспышка и покой
  cells.push({
    label: 'светлячок вспышка',
    draw: (cx, cy) => {
      const f: wtype.Firefly = {
        tx: 0,
        ty: 0,
        ax: 0,
        ay: 0,
        dir: 0,
        seed: 5,
        period: 2000,
        phase: 0,
        state: 'fly',
        timer: 5000,
        alpha: 1,
      };
      // тёмный фон: огонёк виден только на ночной подложке
      ctx.fillStyle = 'rgba(24,30,26,0.9)';
      ctx.fillRect(cx - 70, cy - 60, 140, 110);
      drawFirefly(ctx, f, cx, cy, atm, 420);
    },
  });
  cells.push({
    label: 'светлячок паута',
    draw: (cx, cy) => {
      const f: wtype.Firefly = {
        tx: 0,
        ty: 0,
        ax: 0,
        ay: 0,
        dir: 0,
        seed: 6,
        period: 2000,
        phase: 0.7,
        state: 'rest',
        timer: 5000,
        alpha: 1,
      };
      ctx.fillStyle = 'rgba(24,30,26,0.9)';
      ctx.fillRect(cx - 70, cy - 60, 140, 110);
      drawFirefly(ctx, f, cx, cy, atm, 420);
    },
  });

  const cols = 4;
  const cell = 150;
  const rows = Math.ceil(cells.length / cols);
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

  cells.forEach((c, idx) => {
    const cx = (idx % cols) * cell + cell / 2;
    const cy = Math.floor(idx / cols) * cell + cell * 0.66;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(1.6, 1.6);
    c.draw(0, 0);
    ctx.restore();
    ctx.fillStyle = 'rgba(40,32,24,.75)';
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(c.label, cx, cy + 40);
    ctx.textAlign = 'left';
  });

  const out = process.argv[2] ?? 'creature-sheet.png';
  writeFileSync(out, (canvas as unknown as { toBuffer(m: string): Buffer }).toBuffer('image/png'));
  console.log(out);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
