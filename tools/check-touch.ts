/**
 * Проверка разбора жестов без браузера.
 *
 * Подсовываем TouchInput поддельные события касания и сверяем, что из них
 * вышло. Главное, что здесь ловится: дрожание пальца не должно превращать
 * касание в ведение, а после щипка не должно оставаться лишнего касания —
 * иначе игрок, отпуская два пальца, случайно ставит предмет.
 *
 *   npx tsx tools/check-touch.ts
 */

type L = (e: unknown) => void;

class FakeEl {
  ls: Record<string, L[]> = {};
  addEventListener(t: string, f: L) {
    (this.ls[t] ??= []).push(f);
  }
  removeEventListener() {}
  fire(t: string, touches: [number, number][]) {
    const e = {
      preventDefault() {},
      touches: touches.map(([x, y], i) => ({ identifier: i, clientX: x, clientY: y })),
    };
    for (const f of this.ls[t] ?? []) f(e);
  }
}

const g = globalThis as Record<string, unknown>;
g.window = { setTimeout, clearTimeout, matchMedia: () => ({ matches: true }) };

async function main() {
  const { TouchInput } = await import('../src/ui/touch');
  const log: string[] = [];
  const el = new FakeEl();
  new TouchInput(el as never, {
    isPainting: () => true,
    onTap: (x, y) => log.push(`tap ${x},${y}`),
    onHold: (x, y) => log.push(`hold ${x},${y}`),
    onDragStart: (x, y) => log.push(`dragStart ${x},${y}`),
    onDragMove: (_x, _y, dx, dy) => log.push(`dragMove ${dx},${dy}`),
    onDragEnd: () => log.push('dragEnd'),
    onPinch: (k) => log.push(`pinch ${k.toFixed(2)}`),
    onPinchEnd: () => log.push('pinchEnd'),
  });

  const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
  let bad = 0;
  const check = (name: string, got: string, want: string) => {
    const ok = got === want;
    if (!ok) bad++;
    console.log(`${ok ? '✔' : '✘'} ${name}: ${got}${ok ? '' : `\n    ожидалось: ${want}`}`);
  };

  el.fire('touchstart', [[100, 100]]);
  el.fire('touchend', []);
  check('короткое касание', log.join(' | '), 'tap 100,100');

  log.length = 0;
  el.fire('touchstart', [[100, 100]]);
  el.fire('touchmove', [[104, 103]]);
  el.fire('touchend', []);
  check('касание с дрожью пальца', log.join(' | '), 'tap 100,100');

  log.length = 0;
  el.fire('touchstart', [[100, 100]]);
  el.fire('touchmove', [[140, 100]]);
  el.fire('touchend', []);
  check('ведение', log.join(' | '), 'dragStart 100,100 | dragMove 40,0 | dragEnd');

  log.length = 0;
  el.fire('touchstart', [[200, 150]]);
  await wait(500);
  el.fire('touchend', []);
  check('долгое нажатие убирает', log.join(' | '), 'hold 200,150');

  log.length = 0;
  el.fire('touchstart', [[100, 100]]);
  el.fire('touchstart', [[100, 100], [200, 100]]);
  el.fire('touchmove', [[80, 100], [220, 100]]);
  el.fire('touchend', [[80, 100]]);
  el.fire('touchend', []);
  check('щипок без лишнего касания', log.join(' | '), 'pinch 1.40 | pinchEnd');

  // Ведение после долгого нажатия не должно ещё раз стрелять касанием
  log.length = 0;
  el.fire('touchstart', [[50, 50]]);
  await wait(500);
  el.fire('touchmove', [[90, 50]]);
  el.fire('touchend', []);
  const taps = log.filter((l) => l.startsWith('tap')).length;
  check('после удержания нет касания', String(taps), '0');

  console.log(bad ? `\nЕСТЬ ОШИБКИ: ${bad}` : '\nЖесты разбираются верно.');
  if (bad) process.exit(1);
}

main();
