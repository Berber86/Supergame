/**
 * Новая жизнь: уточки, падающая звезда, следы в снегу.
 *
 *   npx tsx tools/check-new-life.ts
 *
 * Утки: пара приходит в тихий день, прячется в дождь, вздрагивает
 * только от кормящейся или паникующей кои и успокаивается на время.
 * Звезда: детерминированные ночи, трасса в видимой полосе неба на
 * любых пропорциях экрана, кот поднимает голову, строка в летописи.
 * Следы: цепочка лапок в снегу, уходят вместе со снегом, живут 3 часа,
 * не выше 140 штук.
 * Возвращает ненулевой код при любом расхождении.
 */

import { makeRng } from '../src/core/rng';
Math.random = makeRng(Number(process.env.CHECK_SEED ?? 4242));

const backing = new Map<string, string>();
const g = globalThis as Record<string, unknown>;
g.localStorage = {
  getItem: (k: string) => backing.get(k) ?? null,
  setItem: (k: string, v: string) => void backing.set(k, v),
  removeItem: (k: string) => void backing.delete(k),
};

let failed = 0;
function check(name: string, cond: boolean, extra = ''): void {
  if (cond) {
    console.log(`  ок   ${name}`);
  } else {
    failed += 1;
    console.log(`  ПАД  ${name}${extra ? ` — ${extra}` : ''}`);
  }
}

async function main(): Promise<void> {
  const { World } = await import('../src/world/world');
  const { Life } = await import('../src/world/life');
  const { computeTime, DAY_MS } = await import('../src/core/clock');
  const { WeatherSystem } = await import('../src/world/weatherState');
  const { shootingStar, starApproaching, starMoment, STAR_MS } = await import('../src/world/shootingStar');
  const { hash2 } = await import('../src/core/rng');
  const { winterYear } = await import('../src/world/annualEnvironment');
  type TimeState = import('../src/core/clock').TimeState;
  type WeatherState = import('../src/world/weatherState').WeatherState;
  type Cat = import('../src/world/life').Cat;

  const at = (ms: number): TimeState => ({ now: ms }) as unknown as TimeState;

  function clearWeather(t: TimeState): WeatherState {
    const ws = new WeatherSystem();
    ws.force('clear');
    for (let i = 0; i < 200; i++) ws.update(60, t);
    return ws.state;
  }

  function rainyWeather(t: TimeState): WeatherState {
    const ws = new WeatherSystem();
    ws.force('rain');
    for (let i = 0; i < 300; i++) ws.update(60, t);
    return ws.state;
  }

  // ============ Падающая звезда ============
  console.log('Падающая звезда');

  const baseDay = Math.floor(Date.UTC(2026, 0, 15) / DAY_MS);
  let starDay = -1;
  for (let d = 0; d < 60 && starDay < 0; d++) {
    const day = baseDay + d;
    if (hash2(day, 71, 5) > 0.38) continue;
    const hour = (19 + 8 * hash2(day, 71, 9)) % 24;
    if (hour >= 21 || hour < 1) starDay = day; // глубокая ночь — тёмное небо
  }
  check('В течение 60 дней есть ночь со звездой в глубокой ночи', starDay >= 0);
  const moment = starMoment(starDay);
  const hourOfDay = (moment % DAY_MS) / 3600_000;
  check('Полёт между 19:00 и 03:00', hourOfDay >= 19 || hourOfDay < 3, `час ${hourOfDay.toFixed(1)}`);

  const mid = shootingStar(at(moment + Math.floor(STAR_MS / 2)));
  const midAgain = shootingStar(at(moment + Math.floor(STAR_MS / 2)));
  check('Детерминирована: тот же момент — та же звезда', JSON.stringify(mid) === JSON.stringify(midAgain));
  check('Середина полёта: звезда активна', mid !== null && mid.p > 0.45 && mid.p < 0.55);
  check('До полёта звезды нет', shootingStar(at(moment - 2000)) === null);
  check('После полёта звезды нет', shootingStar(at(moment + STAR_MS + 3000)) === null);
  check('Звезда «подлетает» за секунду до начала', starApproaching(at(moment - 1000)));
  check('За 3 секунды до начала — ещё нет', !starApproaching(at(moment - 3000)));

  if (mid) {
    check('Старт высоко в небе', mid.y0 >= 0.02 && mid.y0 <= 0.06, `y0 ${mid.y0.toFixed(3)}`);
    for (const [ratio, label] of [
      [0.42, 'ультраширокий'],
      [0.56, '16:9'],
      [1.78, 'портрет'],
      [2.16, 'телефон'],
    ] as const) {
      const yEnd = mid.y0 + Math.sin(mid.ang) * mid.len;
      const xEnd = mid.x0 + Math.cos(mid.ang) * mid.len * (1 / ratio);
      check(
        `Финал в небе (${label}): y=${yEnd.toFixed(3)} x=${xEnd.toFixed(3)}`,
        yEnd <= 0.17 && xEnd >= 0 && xEnd <= 1,
      );
    }
  }

  {
    const world = new World();
    const t = computeTime(moment + Math.floor(STAR_MS * 0.4));
    check('Небо тёмное в момент полёта', t.daylight < 0.4, `daylight ${t.daylight.toFixed(2)}`);
    const wx = clearWeather(t);
    const life = new Life();
    for (let i = 0; i < 60; i++) life.update(world, t, 1000, world.now(), wx);
    let cat = life.cats[0];
    if (!cat) {
      const c = world.at(13, 13);
      cat = {
        id: 999,
        tx: c ? 13.5 : 13.5,
        ty: c ? 13.5 : 13.5,
        facing: 1,
        seed: 7,
        state: 'sit',
        timer: 60_000,
        target: null,
        phase: 0,
        speed: 0,
        home: null,
        guest: false,
        coat: 'cream',
        greet: 0,
        leaveAt: Number.MAX_SAFE_INTEGER,
        stayAt: Number.MAX_SAFE_INTEGER,
      } as unknown as Cat;
      life.cats.push(cat);
    }
    cat.state = 'sit';
    cat.timer = 60_000;
    cat.target = null;
    cat.company = undefined;
    cat.greet = 0;
    for (let i = 0; i < 12; i++) life.update(world, t, 200, world.now(), wx);
    check('Сидящий кот поднял голову к звезде', (cat.starGaze ?? 0) > 0.5, `gaze ${(cat.starGaze ?? 0).toFixed(2)}`);
    check(
      'Звезда попала в летопись',
      world.pendingNotes.some((n) => n.id === 'star_fall'),
    );
  }

  // ============ Уточки ============
  console.log('Уточки');

  {
    const world = new World();
    const t = computeTime(new Date(2026, 6, 10, 14, 0, 0).getTime());
    check('Летний тихий день', t.dayT > 0.26 && t.dayT < 0.82);
    const wx = clearWeather(t);
    const life = new Life();
    let n = 0;
    for (let i = 0; i < 120 && n < 2; i++) {
      life.update(world, t, 1000, world.now(), wx);
      n = life.ducks.filter((d) => d.mirage === undefined).length;
    }
    check('Пара уток приходит в тихий день', n === 2, `уток ${n}`);
    const kinds = life.ducks.map((d) => d.kind).sort();
    check('Состав пары: самец и самка', kinds[0] === 'drake' && kinds[1] === 'hen');
    const pond = life.habitat?.ponds[0];
    check('Пруд в обитаниях есть', !!pond);
    if (pond) {
      for (const d of life.ducks) {
        if (d.mirage !== undefined) continue;
        check(
          `Утка у пруда (${d.kind})`,
          Math.hypot(d.tx - pond.cx, d.ty - pond.cy) < 4,
          `d ${Math.hypot(d.tx - pond.cx, d.ty - pond.cy).toFixed(1)}`,
        );
      }
    }
    check(
      'Утки в летописи',
      world.pendingNotes.some((x) => x.id === 'meet_duck'),
    );

    for (let i = 0; i < 30; i++) life.update(world, t, 1000, world.now(), wx);
    for (const d of life.ducks) {
      check(`Состояние валидно (${d.kind})`, ['swim', 'rest', 'dip', 'startle', 'leave'].includes(d.state), d.state);
      check(`Голова в пределах (${d.kind})`, d.headUp >= -1.05 && d.headUp <= 1.05, `headUp ${d.headUp.toFixed(2)}`);
    }

    const rainy = rainyWeather(t);
    check('Дождь установился', rainy.rain >= 0.4, `rain ${rainy.rain.toFixed(2)}`);
    for (let i = 0; i < 25 && life.ducks.length; i++) life.update(world, t, 1000, world.now(), rainy);
    check('В дождь пара уходит', life.ducks.length === 0, `уток ${life.ducks.length}`);

    // мираж: зеркальная пара у пруда
    const ok = life.spawnMirage('duck', 13, 13);
    check('Мираж-уток спавнится', ok);
    check(
      'Мираж — зеркальная пара',
      life.ducks.filter((d) => d.mirage !== undefined).length === 2,
      `мираж-уток ${life.ducks.filter((d) => d.mirage !== undefined).length}`,
    );
  }

  {
    // вздрагивание: только от кормящейся/паникующей кои + кулдаун
    const world = new World();
    const t = computeTime(new Date(2026, 6, 11, 14, 0, 0).getTime());
    const wx = clearWeather(t);
    const life = new Life();
    for (let i = 0; i < 120 && life.ducks.length < 2; i++) {
      life.update(world, t, 1000, world.now(), wx);
    }
    const d = life.ducks.find((x) => x.mirage === undefined);
    check('Утка есть для теста вздрагивания', !!d);
    if (!d) return;
    for (let i = 0; i < 40 && d.state !== 'swim'; i++) {
      life.update(world, t, 500, world.now(), wx);
    }
    const f = life.fish[0];
    check('Кои в пруду есть', !!f);
    if (!f) return;
    const alertKoi = () => {
      f.state = 'feed';
      f.feedTimer = 5000;
      f.panic = 0;
      f.tx = d.tx;
      f.ty = d.ty;
    };
    alertKoi();
    life.update(world, t, 100, world.now(), wx);
    check('Кормящаяся кои рядом — утка вздрагивает', d.state === 'startle', d.state);
    check('После вздрагивания — время успокоиться', d.calmT > 0, `calmT ${d.calmT.toFixed(0)}`);
    f.state = 'wander';
    f.feedTimer = 0;
    for (let i = 0; i < 10 && d.state === 'startle'; i++) {
      life.update(world, t, 500, world.now(), wx);
    }
    check('Утка снова плывёт', d.state !== 'startle', d.state);
    alertKoi();
    life.update(world, t, 100, world.now(), wx);
    check('Во время спокойствия не вздрагивает повторно', d.state !== 'startle', d.state);
  }

  {
    // без кои — уток не будет
    const world = new World();
    world.objects = world.objects.filter((o) => o.type !== 'koi');
    const t = computeTime(new Date(2026, 6, 12, 14, 0, 0).getTime());
    const wx = clearWeather(t);
    const life = new Life();
    for (let i = 0; i < 120; i++) life.update(world, t, 1000, world.now(), wx);
    check('Без кои уток нет', life.ducks.length === 0, `уток ${life.ducks.length}`);
  }

  // ============ Следы в снегу ============
  console.log('Следы в снегу');

  {
    const world = new World();
    const t = computeTime(new Date(2026, 0, 22, 12, 0, 0).getTime());
    const snow = winterYear(t.now).snow;
    check('Зима со снегом', snow >= 0.5, `snow ${snow.toFixed(2)}`);
    const wx = clearWeather(t);
    const life = new Life();
    for (let i = 0; i < 60 && !life.cats.length; i++) {
      life.update(world, t, 1000, world.now(), wx);
    }
    let cat = life.cats[0];
    if (!cat) {
      cat = {
        id: 998,
        tx: 13.5,
        ty: 13.5,
        facing: 1,
        seed: 11,
        state: 'sit',
        timer: 60_000,
        target: null,
        phase: 0,
        speed: 0,
        home: null,
        guest: false,
        coat: 'grey',
        greet: 0,
        leaveAt: Number.MAX_SAFE_INTEGER,
        stayAt: Number.MAX_SAFE_INTEGER,
      } as unknown as Cat;
      life.cats.push(cat);
    }
    // сухой путь: на запад, пока не встретится вода
    const sx = Math.floor(cat.tx);
    const sy = Math.floor(cat.ty);
    let west = true;
    for (let i = 1; i <= 4 && west; i++) {
      const tile = world.at(sx - i, sy);
      if (tile && tile.water) west = false;
    }
    if (!west) {
      for (let i = 1; i <= 4; i++) {
        const tile = world.at(sx + i, sy);
        if (tile && tile.water) {
          west = true;
          break;
        }
      }
    }
    cat.tx = sx + 0.5;
    cat.ty = sy + 0.5;
    cat.state = 'walk';
    cat.timer = 60_000;
    cat.target = { x: sx + 0.5 + (west ? -4 : 4), y: sy + 0.5 };
    for (let i = 0; i < 50; i++) {
      cat.company = undefined;
      life.update(world, t, 1000, world.now(), wx);
    }
    check('В снегу остаётся цепочка следов', life.footprints.length > 0, `следов ${life.footprints.length}`);
    for (const fp of life.footprints.slice(0, 3)) {
      check(
        `След валиден (в ${fp.x.toFixed(1)},${fp.y.toFixed(1)})`,
        Number.isFinite(fp.dir) && fp.born === t.now && fp.x >= 0 && fp.x <= 26 && fp.y >= 0 && fp.y <= 26,
      );
    }

    const summer = computeTime(new Date(2026, 5, 10, 12, 0, 0).getTime());
    life.update(world, summer, 1000, world.now(), wx);
    check('Снег сошёл — следы ушли', life.footprints.length === 0, `следов ${life.footprints.length}`);

    life.footprints.push({ x: cat.tx, y: cat.ty, dir: 0, born: t.now - 4 * 3600_000, seed: 1 });
    life.footprints.push({ x: cat.tx, y: cat.ty, dir: 0, born: t.now - 1000, seed: 2 });
    for (let i = 0; i < 30; i++) {
      life.footprints.push({ x: cat.tx, y: cat.ty, dir: 0, born: t.now, seed: 3 + i });
    }
    life.update(world, t, 1000, world.now(), wx);
    check(
      'Часовые следы стерлись',
      life.footprints.every((fp) => t.now - fp.born <= 3 * 3600_000),
    );
    check('Следов не более 140', life.footprints.length <= 140, `следов ${life.footprints.length}`);
  }

  console.log(failed ? `ПРОВАЛ: ${failed}` : 'Всё хорошо');
  process.exit(failed ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
