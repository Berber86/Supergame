/**
 * Проверка диких соседей без браузера.
 *
 *   npx tsx tools/check-wildlife.ts
 *
 * Светлячки, цапля и олень: приглашения по сезону и часу, жизненные
 * циклы, реакция на котов, строки летописи и потолки. Никто не живёт
 * в саду постоянно — проверяем и приход, и уход.
 * Возвращает ненулевой код при любом расхождении.
 */

import { makeRng } from '../src/core/rng';
// World seeds and habitat offsets must not make these lifecycle assertions a lottery.
Math.random = makeRng(Number(process.env.CHECK_SEED ?? 841));

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
  const { scanHabitat, invitations } = await import('../src/world/habitat');
  const { computeTime } = await import('../src/core/clock');
  const { WeatherSystem } = await import('../src/world/weatherState');
  const { Wildlife, fireflyGlow } = await import('../src/world/wildlife');
  type TimeState = import('../src/core/clock').TimeState;
  type WeatherState = import('../src/world/weatherState').WeatherState;

  function at(month: number, day: number, hour: number): TimeState {
    return computeTime(new Date(2026, month, day, hour, 0, 0, 0).getTime());
  }
  const summerNight = at(6, 10, 23);
  const summerNoon = at(6, 10, 13);
  const autumnDawn = at(9, 10, 7);
  const winterDawn = at(0, 10, 7);

  function weather(kind: 'clear' | 'rain' | 'storm', t: TimeState): WeatherState {
    const ws = new WeatherSystem();
    ws.force(kind);
    for (let i = 0; i < 300; i++) ws.update(60, t);
    return ws.state;
  }
  const clear = weather('clear', summerNight);
  const rain = weather('rain', summerNight);

  /** Пустой сад с рощей: сколько деревьев посадим, столько и считаем. */
  function groveWorld(trees: number): World {
    const w = new World();
    for (const t of w.tiles) {
      t.ground = 'moss';
      t.level = 0;
      t.water = false;
      t.indoor = false;
      t.veranda = false;
    }
    w.objects = [];
    w.noteObjectsChanged();
    for (let i = 0; i < trees; i++) {
      const x = 2 + (i % 6) * 2;
      const y = 18 + Math.floor(i / 6) * 2;
      w.place('maple', x, y, 0);
    }
    w.noteObjectsChanged();
    return w;
  }

  // ---------- Приглашения ----------
  console.log('кого и когда зовёт сад:');
  {
    const w = groveWorld(18);
    const h = scanHabitat(w);
    check('роща сосчитана', h.trees.length === 18, `${h.trees.length}`);
    check('поляны найдены', h.glades.length > 0, `${h.glades.length}`);

    const night = invitations(h, summerNight, clear);
    check('тёплой ночью светлячки приглашены', night.fireflies >= 6, `${night.fireflies}`);
    const noon = invitations(h, summerNoon, clear);
    check('днём светлячков нет', noon.fireflies === 0, `${noon.fireflies}`);
    const wetNight = invitations(h, summerNight, rain);
    check('в дождь светлячки не летают', wetNight.fireflies === 0, `${wetNight.fireflies}`);
    const winterNight = invitations(h, winterDawn, clear);
    check('зимой светлячков нет', winterNight.fireflies === 0);

    const pondWorld = scanHabitat(new World());
    check('большая вода зовёт цаплю днём', invitations(pondWorld, summerNoon, clear).heron === true);
    check('ночью цапля не охотится', invitations(pondWorld, summerNight, clear).heron === false);
    check(
      'в грозу цапля не приходит',
      invitations(pondWorld, summerNoon, weather('storm', summerNoon)).heron === false,
    );

    check('без пруда цапле негде стоять', invitations(h, summerNoon, clear).heron === false);

    check(
      'на рассвете роща зовёт оленя',
      invitations(h, autumnDawn, clear).deer === 2,
      `${invitations(h, autumnDawn, clear).deer}`,
    );
    check('в полдень олень не выходит', invitations(h, summerNoon, clear).deer === 0);
    const few = scanHabitat(groveWorld(4));
    check('молодая роща оленя не зовёт', invitations(few, autumnDawn, clear).deer === 0);
    const mid = scanHabitat(groveWorld(10));
    check('небольшая роща зовёт одного', invitations(mid, autumnDawn, clear).deer === 1);
  }

  // ---------- Светлячки ----------
  console.log('светлячки приходят ночью и тают к рассвету:');
  {
    const w = groveWorld(12);
    const life = new Life();
    let now = 10_000;
    for (let i = 0; i < 2400; i++) {
      now += 200;
      life.update(w, summerNight, 200, now, clear);
    }
    const ff = life.wildlife.fireflies;
    check('ночью светлячки горят', ff.length >= 4 && ff.length <= 12, `${ff.length}`);
    check(
      'вспышка периодична и гладка',
      (() => {
        const f = ff[0];
        if (!f) return false;
        let prev = -1;
        let peaks = 0;
        for (let t = 0; t < f.period * 2; t += 40) {
          const g = fireflyGlow(f, t);
          if (prev >= 0 && g > prev && prev < 0.01) peaks++;
          prev = g;
        }
        return peaks >= 1;
      })(),
    );
    check('веха «Ночные огни» получена', w.milestones.has('night_lights'));
    check('летопись помнит первого светлячка', w.hasEvent('meet_firefly'));

    for (let i = 0; i < 1500; i++) {
      now += 200;
      life.update(w, summerNoon, 200, now, clear);
    }
    check('к рассвету огни растаяли', life.wildlife.fireflies.length === 0, `${life.wildlife.fireflies.length}`);
  }

  // ---------- Цапля ----------
  console.log('цапля приходит к большой воде и уходит сама:');
  {
    const w = new World();
    const life = new Life();
    const h0 = scanHabitat(w);
    check('стартовый пруд достаточно велик', h0.water >= 10, `${h0.water}`);
    // This is the uninterrupted lifecycle. The next case tests disturbance explicitly:
    // random cats/low-flying birds must not cancel all four visits before the first hunt.
    const updateWildlife = life.wildlife.update.bind(life.wildlife);
    life.wildlife.update = (h, inv, t, wx, dt, now, _threats, world) =>
      updateWildlife(h, inv, t, wx, dt, now, [], world);
    let now = 10_000;
    let struck = false;
    let sawStand = false;
    for (let visit = 0; visit < 4; visit++) {
      life.wildlife.force('heron', h0, autumnDawn);
      for (let i = 0; i < 6000; i++) {
        now += 200;
        life.update(w, autumnDawn, 200, now, clear);
        const hr = life.wildlife.heron;
        if (!hr) break;
        if (hr.state === 'stand') sawStand = true;
        if (hr.state === 'strike') struck = true;
      }
      if (struck) break;
    }
    check('цапля стояла у воды', sawStand);
    check('цапля пробовала бить по воде', struck);
    check(
      'цапля ушла сама или за сроком',
      life.wildlife.heron === null,
      life.wildlife.heron ? life.wildlife.heron.state : '',
    );
    check('летопись помнит цаплю', w.hasEvent('meet_heron'));
    check('веха «Терпеливая гостья» получена', w.milestones.has('heron_guest'));
  }
  {
    // Кот рядом — цапля не спорит
    const w = new World();
    const life = new Life();
    life.wildlife.force('heron', scanHabitat(w), autumnDawn);
    const hr = life.wildlife.heron;
    check('цапля на месте', !!hr);
    if (hr) {
      w.place('cat', Math.round(hr.tx), Math.round(hr.ty), 0);
      let now = 10_000;
      for (let i = 0; i < 5; i++) {
        now += 200;
        life.update(w, autumnDawn, 200, now, clear);
      }
      check('кот подошёл — цапля снимается', life.wildlife.heron?.state === 'fly-out');
    }
  }
  {
    // Isolate the actual strike callback: random visitors may scare the heron away before
    // any strike, and roaming koi need not be within range during five arbitrary visits.
    // Natural stalking/departure and reactions to cats are exercised separately above.
    const w = new World();
    w.objects = w.objects.filter((o) => o.type !== 'cat');
    w.noteObjectsChanged();
    const life = new Life();
    life.sync(w);
    life.wildlife.force('heron', scanHabitat(w), autumnDawn);
    const hr = life.wildlife.heron,
      fish = life.fish[0];
    check('цапля и карп готовы к проверке удара', !!hr && !!fish);
    if (hr && fish) {
      Object.assign(hr, { tx: fish.tx, ty: fish.ty, state: 'strike', timer: 650, struck: false });
      life.update(w, autumnDawn, 100, 10_100, clear);
      check(
        'до удара карпы не испуганы',
        life.fish.every((f) => f.panic === 0),
      );
      life.update(w, autumnDawn, 100, 10_200, clear);
      check('удар цапли разогнал карпов', hr.struck && fish.panic > 0);
      const hitPanic = fish.panic;
      life.update(w, autumnDawn, 100, 10_300, clear);
      check('один удар не сбрасывает испуг каждый кадр', fish.panic < hitPanic);
    }
  }

  // ---------- Олень ----------
  console.log('олень выходит к роще и уступает коту:');
  {
    const w = groveWorld(18);
    const life = new Life();
    let now = 10_000;
    let seen = false;
    for (let i = 0; i < 30_000; i++) {
      now += 400;
      life.update(w, autumnDawn, 400, now, clear);
      if (life.wildlife.deer.length) seen = true;
      if (seen && life.wildlife.deer.length === 0) break;
    }
    check('олень приходил на рассвете', seen);
    check('летопись помнит оленя', w.hasEvent('meet_deer'));
    check('веха «Олень у рощи» получена', w.milestones.has('deer_guest'));
    check('олень не живёт в саду вечно', life.wildlife.deer.length === 0, `${life.wildlife.deer.length}`);
  }
  {
    const w = groveWorld(18);
    const life = new Life();
    life.wildlife.force('deer', scanHabitat(w), autumnDawn);
    const d = life.wildlife.deer[0];
    check('олень на поляне', !!d && d.state === 'graze');
    if (d) {
      check('осенняя шкура: рога есть, пятен нет', d.coat.antlers && !d.coat.spots && !d.coat.winter);
      w.place('cat', Math.round(d.tx), Math.round(d.ty), 0);
      let now = 10_000;
      for (let i = 0; i < 5; i++) {
        now += 200;
        life.update(w, autumnDawn, 200, now, clear);
      }
      check('кот рядом — олень уходит', life.wildlife.deer[0]?.state === 'leave');
    }
    const summer = at(6, 10, 7);
    const w2 = groveWorld(18);
    const life2 = new Life();
    life2.wildlife.force('deer', scanHabitat(w2), summer);
    const d2 = life2.wildlife.deer[0];
    check('летняя шкура: пятна и панты', !!d2 && d2.coat.spots && d2.coat.antlers);
    const winter = at(0, 10, 8);
    const life3 = new Life();
    life3.wildlife.force('deer', scanHabitat(groveWorld(18)), winter);
    const d3 = life3.wildlife.deer[0];
    check('зимняя шкура: без рогов и пятен', !!d3 && d3.coat.winter && !d3.coat.antlers && !d3.coat.spots);
  }

  // ---------- Потолки и долгая игра ----------
  console.log('потолки и сутки дикой жизни:');
  {
    const w = groveWorld(20);
    w.place('feeder', 15, 10, 0);
    const life = new Life();
    let now = 10_000;
    let maxFf = 0;
    let maxDeer = 0;
    let maxHeron = 0;
    const hours: TimeState[] = [summerNight, summerNoon, autumnDawn, at(9, 10, 19), winterDawn];
    for (let i = 0; i < 60_000; i++) {
      now += 1000;
      life.update(w, hours[Math.floor(i / 60) % hours.length], 1000, now, i % 41 === 0 ? rain : clear);
      maxFf = Math.max(maxFf, life.wildlife.fireflies.length);
      maxDeer = Math.max(maxDeer, life.wildlife.deer.length);
      maxHeron = Math.max(maxHeron, life.wildlife.heron ? 1 : 0);
    }
    check('светлячки не копятся', maxFf <= 12, `${maxFf}`);
    check('оленей не больше двух', maxDeer <= 2, `${maxDeer}`);
    check('цапля всегда одна', maxHeron <= 1, `${maxHeron}`);
    check(
      'дикие соседи не выходят за край сада',
      [...life.wildlife.fireflies, ...life.wildlife.deer].every(
        (a) => a.tx > -5 && a.tx < 31 && a.ty > -5 && a.ty < 31,
      ),
    );
    const wl = new Wildlife();
    wl.reset();
    check('сброс очищает диких соседей', wl.fireflies.length === 0 && wl.deer.length === 0 && wl.heron === null);
  }

  if (failed) {
    console.log(`\n${failed} проверок упало`);
    process.exit(1);
  }
  console.log('\nдикие соседи проверены');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
