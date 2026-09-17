/**
 * Проверка живой экосистемы без браузера.
 *
 *   npx tsx tools/check-residents.ts
 *
 * Среда обитания и правила приглашения (сезон, погода, постройки),
 * жизненный цикл лягушек и стрекоз, птицы у кормушки и их испуг,
 * второй кот от подушки и миски, летопись и её место в сохранении.
 * Возвращает ненулевой код при любом расхождении.
 */

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
  const { serializeSave, parseSave } = await import('../src/world/saveFormat');
  const { GRID } = await import('../src/core/iso');
  type TimeState = import('../src/core/clock').TimeState;
  type WeatherState = import('../src/world/weatherState').WeatherState;

  /** Момент календаря: сезон и час задаём датой, как их видит игра. */
  function at(month: number, day: number, hour: number): TimeState {
    return computeTime(new Date(2026, month, day, hour, 0, 0, 0).getTime());
  }
  const summerNoon = at(6, 10, 13);
  const summerRainTime = at(6, 10, 13);
  const summerNight = at(6, 10, 23);
  const winterNoon = at(0, 10, 12);
  const springEvening = at(3, 20, 19);

  function weather(kind: 'clear' | 'rain' | 'storm' | 'snow', t: TimeState): WeatherState {
    const ws = new WeatherSystem();
    ws.force(kind);
    for (let i = 0; i < 300; i++) ws.update(60, t);
    return ws.state;
  }

  const clear = weather('clear', summerNoon);
  const rain = weather('rain', summerRainTime);

  // ---------- Среда обитания ----------
  console.log('среда обитания стартового сада:');
  {
    const w = new World();
    const h = scanHabitat(w);
    check('пруда найдены и измерены', h.ponds.length >= 1 && h.water > 15, `вода ${h.water}`);
    check('у пруда есть тенистые берега', h.frogSpots.length > 0, `${h.frogSpots.length}`);
    check('стрекозам есть на что сесть', h.perches.length > 0, `${h.perches.length}`);
    check('кормушек в стартовом саду нет', h.feeders.length === 0);
    check(
      'условия второго кота выполнены',
      h.cats >= 1 && h.cushions.length >= 1 && h.bowls.length >= 1,
      `коты ${h.cats}, подушки ${h.cushions.length}, миски ${h.bowls.length}`,
    );
  }

  // ---------- Правила приглашения ----------
  console.log('сезон и погода важнее статистики:');
  {
    const w = new World();
    const h = scanHabitat(w);
    const winter = invitations(h, winterNoon, clear);
    check('зимой лягушки спят в иле', winter.frogs === 0, `${winter.frogs}`);
    check('зимой стрекоз нет', winter.dragonflies === 0, `${winter.dragonflies}`);

    const noon = invitations(h, summerNoon, clear);
    check('летом в сухой полдень лягушки в тени', noon.frogs >= 1 && noon.frogs <= 3, `${noon.frogs}`);
    check('летом стрекозы над прудом', noon.dragonflies >= 3, `${noon.dragonflies}`);

    const wet = invitations(h, summerRainTime, rain);
    check('в дождь лягушки заметнее', wet.frogs > noon.frogs, `${noon.frogs} → ${wet.frogs}`);
    check('в ливень стрекозы прячутся', wet.dragonflies === 0, `${wet.dragonflies}`);

    const night = invitations(h, summerNight, clear);
    check('ночью стрекозы не летают', night.dragonflies === 0, `${night.dragonflies}`);
    check('ночью лягушки готовы петь хором', night.chorus >= 2, `${night.chorus}`);

    w.place('feeder', 15, 10, 0);
    const h2 = scanHabitat(w);
    check('кормушка видна среде обитания', h2.feeders.length === 1);
    const feederWinter = invitations(h2, winterNoon, clear);
    check('зимой у кормушки людно', feederWinter.feederBirds >= 3, `${feederWinter.feederBirds}`);
    const feederNight = invitations(h2, summerNight, clear);
    check('ночью кормушка пуста', feederNight.feederBirds === 0, `${feederNight.feederBirds}`);
    const feederSummer = invitations(h2, summerNoon, clear);
    check('летом птиц меньше, чем зимой', feederSummer.feederBirds < feederWinter.feederBirds);
  }
  {
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
    const bare = scanHabitat(w);
    check('без кота гостя не зовут', invitations(bare, springEvening, clear).guestCat === false);
    w.place('cat', 5, 5, 0);
    check('одного кота мало', invitations(scanHabitat(w), springEvening, clear).guestCat === false);
    w.place('cushion', 6, 5, 0);
    w.place('bowl', 7, 5, 0);
    check('кот, подушка и миска зовут второго', invitations(scanHabitat(w), springEvening, clear).guestCat === true);
  }

  // ---------- Жизненный цикл жителей ----------
  console.log('жители приходят, живут и уходят:');
  {
    const w = new World();
    const life = new Life();
    let now = 10_000;
    for (let i = 0; i < 3600; i++) {
      now += 200;
      life.update(w, summerNoon, 200, now, clear);
    }
    const frogs = life.residents.frogs.filter((f) => !f.gone);
    const flies = life.residents.dragonflies;
    check('лягушки пришли к пруду', frogs.length >= 1 && frogs.length <= 5, `${frogs.length}`);
    check('стрекозы держат пруд', flies.length >= 1 && flies.length <= 6, `${flies.length}`);
    const h = scanHabitat(w);
    const nearPond = frogs.every((f) => h.ponds.some((p) => Math.hypot(p.cx - f.tx, p.cy - f.ty) < 9) || f.pond === -2);
    check('лягушки не уходят от воды', nearPond);
    check(
      'координаты жителей не развалились',
      [...frogs, ...flies].every((a) => Number.isFinite(a.tx) && Number.isFinite(a.ty)),
    );

    // Зима приходит: лягушки засыпают, стрекозы исчезают
    for (let i = 0; i < 1500; i++) {
      now += 200;
      life.update(w, winterNoon, 200, now, clear);
    }
    check(
      'зимой жители воды уходят',
      life.residents.frogs.filter((f) => !f.gone).length === 0 && life.residents.dragonflies.length === 0,
      `лягушки ${life.residents.frogs.length}, стрекозы ${life.residents.dragonflies.length}`,
    );
  }
  {
    // Кот рядом — лягушка ныряет
    const w = new World();
    const life = new Life();
    let now = 10_000;
    for (let i = 0; i < 2400; i++) {
      now += 200;
      life.update(w, summerNoon, 200, now, clear);
    }
    const frog = life.residents.frogs.find((f) => !f.gone && f.hidden <= 0);
    check('лягушка для опыта найдлась', !!frog);
    if (frog) {
      w.place('cat', Math.round(frog.tx), Math.round(frog.ty), 0);
      for (let i = 0; i < 20; i++) {
        now += 200;
        life.update(w, summerNoon, 200, now, clear);
      }
      const dived = life.residents.frogs.every(
        (f) => f.gone || f.hidden > 0 || f.state === 'dive' || f.state === 'hop',
      );
      check('кот подошёл — лягушка нырнула', dived);
    }
  }
  {
    // Ливень сгоняет стрекоз на насесты
    const w = new World();
    const life = new Life();
    let now = 10_000;
    for (let i = 0; i < 2400; i++) {
      now += 200;
      life.update(w, summerNoon, 200, now, clear);
    }
    check('стрекозы летали до дождя', life.residents.dragonflies.length > 0);
    for (let i = 0; i < 900; i++) {
      now += 200;
      life.update(w, summerRainTime, 200, now, rain);
    }
    const hiding = life.residents.dragonflies.every((d) => d.state === 'perch' || d.state === 'leave');
    check('в ливень стрекозы сидят или уходят', hiding, life.residents.dragonflies.map((d) => d.state).join(','));
  }

  // ---------- Птицы у кормушки ----------
  console.log('кормушка приглашает птиц:');
  {
    // Пустой сад без кота и подушек: гость не должен пугать птиц
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
    w.place('feeder', 15, 10, 0);
    w.place('birdbath', 18, 16, 0);
    const life = new Life();
    let now = 10_000;
    let sawFeeder = false;
    for (let i = 0; i < 4500; i++) {
      now += 200;
      life.update(w, summerNoon, 200, now, clear);
      if (life.birds.some((b) => b.place === 'feeder' && (b.state === 'perch' || b.state === 'feed'))) sawFeeder = true;
    }
    check('птицы сели на кормушку', sawFeeder);
    check('веха «Пернатые» получена', w.milestones.has('bird_guest'));
    check('вкладка «Гости» открыта вехой', w.milestones.has('bird_guest'));
    check('летопись помнит первую птицу у стола', w.hasEvent('meet_feeder'));

    // Кот у кормушки — сидевшие там птицы разлетаются
    // (летящих внутрь не считаем: они ещё не доехали до испуга)
    let sat = life.birds.filter((b) => b.place === 'feeder' && ['perch', 'feed', 'drink', 'bathe'].includes(b.state));
    for (let guard = 0; guard < 1500 && sat.length === 0; guard++) {
      now += 200;
      life.update(w, summerNoon, 200, now, clear);
      sat = life.birds.filter((b) => b.place === 'feeder' && ['perch', 'feed', 'drink', 'bathe'].includes(b.state));
    }
    if (sat.length) {
      const ids = new Set(sat);
      w.place('cat', Math.round(sat[0].tx), Math.round(sat[0].ty), 0);
      for (let i = 0; i < 10; i++) {
        now += 200;
        life.update(w, summerNoon, 200, now, clear);
      }
      const fled = [...ids].every((b) => b.state === 'fly-out' || !life.birds.includes(b));
      check('кот у кормушки — птицы разлетелись', fled);
      check('летопись помнит испуг', w.hasEvent('birds_fled'));
    } else {
      check('кот у кормушки — птицы разлетелись', false, 'к моменту опыта птиц не было');
    }
  }

  // ---------- Второй кот ----------
  console.log('второй кот приходит сам:');
  {
    const w = new World();
    const life = new Life();
    let now = 10_000;
    let guestSeen = false;
    let stayed = false;
    for (let i = 0; i < 20_000; i++) {
      now += 400;
      life.update(w, springEvening, 400, now, clear);
      if (life.guests.length > 0) guestSeen = true;
      if (guestSeen && life.guests.length === 0 && w.objects.filter((o) => o.type === 'cat').length === 2) {
        stayed = true;
        break;
      }
    }
    check('гость обошёл сад', guestSeen);
    check('гость остался: в саду два кота', stayed, `котов ${w.objects.filter((o) => o.type === 'cat').length}`);
    check('веха «Второй кот» получена', w.milestones.has('second_cat'));
    check('летопись помнит гостя и его решение', w.hasEvent('meet_guest') && w.hasEvent('guest_stayed'));
    // следующий кадр подбирает нового кота в агенты
    now += 400;
    life.update(w, springEvening, 400, now, clear);
    check('коты-агенты соответствуют предметам', life.cats.length === w.objects.filter((o) => o.type === 'cat').length);
    check(
      'гость сохранил шубу, став домашним',
      life.cats.some((c) => c.coat !== 'cream'),
      life.cats.map((c) => c.coat).join(','),
    );
  }

  // ---------- Летопись и сохранение ----------
  console.log('летопись живёт в сохранении:');
  {
    const w = new World();
    const t0 = new Date(2026, 5, 10, 8, 0, 0).getTime();
    check('первая встреча записана', w.noteEvent('meet_frog', t0));
    check('повтор не дублирует строку', !w.noteEvent('meet_frog', t0 + 5000));
    check('заметка ушла в очередь', w.pendingNotes.length === 1);
    check('веха поднята строкой', w.milestones.has('first_frog'));
    w.noteEvent('chorus', t0 + 60_000);
    check('хор поднимает свою веху', w.milestones.has('frog_chorus'));
    check('несуществующих строк не бывает', !w.noteEvent('dragon', t0));

    const packed = serializeSave(w.toJSON());
    const back = new World();
    const ok = back.fromJSON(JSON.parse(packed));
    check('летопись пережила сохранение', ok && back.chronicle.length === 2 && back.chronicle[0].id === 'meet_frog');

    // Старое сохранение без летописи обязано открываться
    const legacy = JSON.parse(packed) as Record<string, unknown>;
    delete legacy.c;
    const old = new World();
    check('сад без летописи открывается', old.fromJSON(legacy) && old.chronicle.length === 0);

    // Мусор в летописи отвергается целиком
    const broken = JSON.parse(packed) as Record<string, unknown>;
    broken.c = [['meet_frog', -5]];
    check('битая метка летописи отвергнута', parseSave(broken) === null);
    const broken2 = JSON.parse(packed) as Record<string, unknown>;
    broken2.c = [[42, 1000]];
    check('битое имя события отвергнуто', parseSave(broken2) === null);
  }

  // ---------- Потолки ----------
  console.log('потолки и долгая игра:');
  {
    const w = new World();
    w.place('feeder', 15, 10, 0);
    const life = new Life();
    let now = 10_000;
    let maxFrogs = 0;
    let maxFlies = 0;
    let maxBirds = 0;
    let maxRipples = 0;
    for (let i = 0; i < 86_400; i++) {
      now += 1000;
      const t = i % 2 === 0 ? summerNoon : summerNight;
      life.update(w, t, 1000, now, i % 37 === 0 ? rain : clear);
      maxFrogs = Math.max(maxFrogs, life.residents.frogs.length);
      maxFlies = Math.max(maxFlies, life.residents.dragonflies.length);
      maxBirds = Math.max(maxBirds, life.birds.length);
      maxRipples = Math.max(maxRipples, life.residents.ripples.length);
    }
    check('лягушки не копятся', maxFrogs <= 6, `${maxFrogs}`);
    check('стрекозы не копятся', maxFlies <= 7, `${maxFlies}`);
    check('птицы не копятся', maxBirds <= 7, `${maxBirds}`);
    check('круги на воде ограничены', maxRipples <= 24, `${maxRipples}`);
    check(
      'жители не выходят за край сада',
      [...life.residents.frogs, ...life.residents.dragonflies, ...life.birds].every(
        (a) => a.tx > -4 && a.tx < GRID + 4 && a.ty > -4 && a.ty < GRID + 4,
      ),
    );
  }

  if (failed) {
    console.log(`\n${failed} проверок упало`);
    process.exit(1);
  }
  console.log('\nэкосистема жива и проверена');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
