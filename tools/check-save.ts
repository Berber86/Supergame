/**
 * Проверка прочности сохранений без браузера.
 *
 *   npx tsx tools/check-save.ts
 *
 * Цикл «сохранил → загрузил → сравнил» на десятке разных садов, старый
 * формат v3, который обязан открываться, порченые файлы, которые обязаны
 * отвергаться, переполнение хранилища, откат на резервную копию и
 * потолок памяти истории. Возвращает ненулевой код при любом расхождении.
 */

const backing = new Map<string, string>();
let quotaMode = false;
const g = globalThis as Record<string, unknown>;
g.localStorage = {
  getItem: (k: string) => backing.get(k) ?? null,
  setItem: (k: string, v: string) => {
    if (quotaMode) {
      const e = new Error('the storage is full');
      e.name = 'QuotaExceededError';
      throw e;
    }
    backing.set(k, v);
  },
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

function clearStore(): void {
  backing.clear();
  quotaMode = false;
}

/** Детерминированный случайный ряд — чтобы сады были те же от прогона к прогону. */
function mulberry32(a: number): () => number {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

async function main(): Promise<void> {
  const { GRID } = await import('../src/core/iso');
  const { World } = await import('../src/world/world');
  const { GardenStore } = await import('../src/world/gardens');
  const { History, TILE_BUDGET } = await import('../src/core/history');
  const { ITEM_BY_ID } = await import('../src/world/catalog');
  const { GROUND_IDS, parseSave, serializeSave } = await import('../src/world/saveFormat');
  type SaveData = import('../src/world/types').SaveData;
  type PlacedObject = import('../src/world/types').PlacedObject;
  type Tile = import('../src/world/types').Tile;

  const LEGACY_KEY = 'usadba.save.v3';
  const SLOT_PREFIX = 'usadba.garden.';

  /** Сохранение в виде v3 — так файл выглядел до четвёртой версии. */
  function legacyJson(d: SaveData): string {
    return JSON.stringify({
      version: 3,
      tiles: d.tiles,
      objects: d.objects,
      nextId: d.nextId,
      milestones: d.milestones,
      seasons: d.seasons,
      seen: d.seen,
    });
  }

  /** Каноническая строка для сравнения двух состояний «до и после». */
  function canon(d: SaveData): string {
    return JSON.stringify({
      t: d.tiles.map((t) => [t.ground, t.level, t.water, t.indoor, t.veranda].join(',')),
      o: d.objects.map((o) => [o.id, o.type, o.tx, o.ty, o.planted, o.rot, o.seed]),
      n: d.nextId,
      m: [...d.milestones].sort(),
      s: [...(d.seasons ?? [])].sort(),
      e: [...d.seen].sort(),
      c: (d.chronicle ?? []).map((e) => [e.id, e.at]),
    });
  }

  function variedWorld(seed: number, objectCount: number): World {
    const rand = mulberry32(seed);
    const w = new World();
    const types = [...ITEM_BY_ID.keys()];
    for (let i = 0; i < w.tiles.length; i++) {
      w.tiles[i] = {
        ground: GROUND_IDS[Math.floor(rand() * GROUND_IDS.length)],
        level: -1 + Math.floor(rand() * 4),
        water: rand() < 0.2,
        indoor: rand() < 0.1,
        veranda: rand() < 0.05,
      };
    }
    w.objects = [];
    for (let k = 0; k < objectCount; k++) {
      w.objects.push({
        id: k + 1,
        type: types[Math.floor(rand() * types.length)],
        tx: Math.floor(rand() * GRID * 4) / 4,
        ty: Math.floor(rand() * GRID * 4) / 4,
        planted: Math.floor(rand() * 1.8e12),
        rot: Math.floor(rand() * 4),
        seed: Math.floor(rand() * 0xffffffff),
      });
    }
    w.nextId = objectCount + 1;
    w.milestones = new Set(['first_pond', 'stone_garden']);
    w.seasonsSeen = new Set(['spring', 'winter']);
    w.seenTabs = new Set(['ground', 'trees']);
    return w;
  }

  // ---------- Цикл «сохранил → загрузил → сравнил» ----------
  console.log('круговорот сохранения:');
  const gardens: [string, World][] = [
    ['стартовый сад', new World()],
    [
      'пустая земля',
      (() => {
        const w = new World();
        w.objects = [];
        w.milestones = new Set();
        return w;
      })(),
    ],
    ['разнобой c1', variedWorld(11, 250)],
    ['разнобой c2', variedWorld(23, 90)],
    ['разнобой c3', variedWorld(47, 400)],
    [
      'сплошной дом',
      (() => {
        const w = new World();
        for (const t of w.tiles) {
          t.ground = 'tatami';
          t.indoor = true;
        }
        return w;
      })(),
    ],
    [
      'моно-мох',
      (() => {
        const w = new World();
        for (const t of w.tiles) {
          t.ground = 'moss';
          t.level = 0;
          t.water = t.indoor = t.veranda = false;
        }
        w.seasonsSeen = new Set(['spring', 'summer', 'autumn', 'winter']);
        return w;
      })(),
    ],
    [
      'вода и веранды',
      (() => {
        const w = new World();
        for (let i = 0; i < w.tiles.length; i++) {
          w.tiles[i].ground = 'water';
          w.tiles[i].level = -1;
          w.tiles[i].water = i % 2 === 0;
          w.tiles[i].veranda = i % 3 === 0;
        }
        return w;
      })(),
    ],
    [
      'все уровни',
      (() => {
        const w = new World();
        w.tiles.forEach((t, i) => {
          t.level = (i % 4) - 1;
        });
        return w;
      })(),
    ],
    [
      'длинные списки',
      (() => {
        const w = variedWorld(99, 300);
        w.milestones = new Set(Array.from({ length: 50 }, (_, i) => `m${i}`));
        w.seenTabs = new Set(Array.from({ length: 30 }, (_, i) => `tab${i}`));
        return w;
      })(),
    ],
  ];

  let roundtripV4 = 0;
  let roundtripV3 = 0;
  for (const [name, w] of gardens) {
    const before = canon(w.toJSON());
    // v4: упаковал → разобрал → применил
    const packed = serializeSave(w.toJSON());
    const back = new World();
    const ok4 = back.fromJSON(JSON.parse(packed));
    if (ok4 && canon(back.toJSON()) === before) roundtripV4++;
    else check(`v4 ${name}`, false, ok4 ? 'содержимое поплыло' : 'не принят');
    // v3: старый вид обязан открываться
    const legacy = JSON.parse(legacyJson(w.toJSON()));
    const back3 = new World();
    const ok3 = back3.fromJSON(legacy);
    if (ok3 && canon(back3.toJSON()) === before) roundtripV3++;
    else check(`v3 ${name}`, false, ok3 ? 'содержимое поплыло' : 'не принят');
  }
  check(
    `все ${gardens.length} садов пережили круг v4`,
    roundtripV4 === gardens.length,
    `${roundtripV4}/${gardens.length}`,
  );
  check(
    `все ${gardens.length} садов открылись из v3`,
    roundtripV3 === gardens.length,
    `${roundtripV3}/${gardens.length}`,
  );

  // ---------- Компактность ----------
  console.log('компактность:');
  const starter = new World().toJSON();
  const starterV3 = legacyJson(starter).length;
  const starterV4 = serializeSave(starter).length;
  console.log(
    `  стартовый сад: v3 ${(starterV3 / 1024).toFixed(1)} КБ → v4 ${(starterV4 / 1024).toFixed(1)} КБ (×${(starterV3 / starterV4).toFixed(1)})`,
  );
  const big = variedWorld(47, 400).toJSON();
  const bigV3 = legacyJson(big).length;
  const bigV4 = serializeSave(big).length;
  console.log(
    `  сад из 400 предметов: v3 ${(bigV3 / 1024).toFixed(1)} КБ → v4 ${(bigV4 / 1024).toFixed(1)} КБ (×${(bigV3 / bigV4).toFixed(1)})`,
  );
  check('стартовый сад ужался минимум втрое', starterV4 * 3 < starterV3, `×${(starterV3 / starterV4).toFixed(2)}`);
  check('сад из 400 предметов ужался минимум втрое', bigV4 * 3 < bigV3, `×${(bigV3 / bigV4).toFixed(2)}`);

  // ---------- Порченые файлы ----------
  console.log('порченые файлы:');
  {
    const sample = variedWorld(5, 40).toJSON();
    const good = () => JSON.parse(legacyJson(sample)) as Record<string, unknown>;
    const packedGood = () => JSON.parse(serializeSave(sample)) as Record<string, unknown>;
    const tiles = () => good().tiles as Tile[];
    const objects = () => good().objects as PlacedObject[];

    const cases: [string, () => unknown][] = [
      [
        'версия из будущего',
        () => {
          const d = good();
          d.version = 99;
          return d;
        },
      ],
      [
        'не хватает тайлов',
        () => {
          const d = good();
          (d.tiles as Tile[]).length = 675;
          return d;
        },
      ],
      [
        'неизвестная земля',
        () => {
          const d = good();
          (d.tiles as Tile[])[10].ground = 'песочек' as Tile['ground'];
          return d;
        },
      ],
      [
        'уровень строкой',
        () => {
          const d = good();
          (d.tiles as Tile[])[10].level = 'ой' as unknown as number;
          return d;
        },
      ],
      [
        'уровень дробный',
        () => {
          const d = good();
          (d.tiles as Tile[])[10].level = 2.5;
          return d;
        },
      ],
      [
        'уровень за пределом',
        () => {
          const d = good();
          (d.tiles as Tile[])[10].level = 30;
          return d;
        },
      ],
      [
        'вода строкой',
        () => {
          const d = good();
          (d.tiles as Tile[])[10].water = 'да' as unknown as boolean;
          return d;
        },
      ],
      [
        'предмет-дракон',
        () => {
          const d = good();
          (d.objects as PlacedObject[])[0].type = 'дракон';
          return d;
        },
      ],
      [
        'id строкой',
        () => {
          const d = good();
          (d.objects as PlacedObject[])[0].id = 'дом' as unknown as number;
          return d;
        },
      ],
      [
        'tx — не число',
        () => {
          const d = good();
          (d.objects as PlacedObject[])[0].tx = NaN;
          return d;
        },
      ],
      [
        'предмет за садом',
        () => {
          const d = good();
          (d.objects as PlacedObject[])[0].tx = 999;
          return d;
        },
      ],
      [
        'поворот 9 из 3',
        () => {
          const d = good();
          (d.objects as PlacedObject[])[0].rot = 9;
          return d;
        },
      ],
      [
        'посадка в минусе',
        () => {
          const d = good();
          (d.objects as PlacedObject[])[0].planted = -5;
          return d;
        },
      ],
      [
        'два предмета с одним id',
        () => {
          const d = good();
          (d.objects as PlacedObject[])[1].id = (d.objects as PlacedObject[])[0].id;
          return d;
        },
      ],
      [
        'вехи не строки',
        () => {
          const d = good();
          d.milestones = [1, 2];
          return d;
        },
      ],
      [
        'вехи не список',
        () => {
          const d = good();
          d.milestones = 'boom';
          return d;
        },
      ],
      [
        'v4 короче нормы',
        () => {
          const d = packedGood();
          d.t = (d.t as string).slice(0, -3);
          return d;
        },
      ],
      [
        'v4 с чужим знаком',
        () => {
          const d = packedGood();
          d.t = (d.t as string).slice(0, 5) + '!' + (d.t as string).slice(6);
          return d;
        },
      ],
      [
        'v4 предмет не ряд',
        () => {
          const d = packedGood();
          (d.o as unknown[])[0] = { id: 1 };
          return d;
        },
      ],
      ['просто строка', () => 'это не сохранение'],
      ['просто число', () => 42],
      ['null', () => null],
    ];
    let rejected = 0;
    for (const [name, make] of cases) {
      const w = variedWorld(77, 10);
      const before = canon(w.toJSON());
      const ok = w.fromJSON(make());
      if (!ok && canon(w.toJSON()) === before) rejected++;
      else check(`отклонён: ${name}`, false, ok ? 'принят' : 'мир тронут');
    }
    check(
      `все ${cases.length} битых варианта отклонены, мир не тронут`,
      rejected === cases.length,
      `${rejected}/${cases.length}`,
    );
    // контроль: рядом лежачие целые файлы обязаны открываться
    const w = new World();
    check('целый v3 рядом открывается', w.fromJSON(good()) && canon(w.toJSON()) === canon(sample));
    check('целый v4 рядом открывается', w.fromJSON(packedGood()) && canon(w.toJSON()) === canon(sample));
    check('parseSave возвращает null для мусора', parseSave(good().tiles) === null && parseSave({}) === null);
  }

  // ---------- Слоты: миграция и старое одиночное сохранение ----------
  console.log('миграции:');
  {
    clearStore();
    const sample = new World();
    const sampleCanon = canon(sample.toJSON());
    const store = new GardenStore();
    const id = store.list[0].id;
    // В слоте лежит старый формат v3 — как после прежней версии игры
    backing.set(SLOT_PREFIX + id, legacyJson(sample.toJSON()));
    const w = variedWorld(3, 30); // явно другой мир, чтобы чтение было видно
    check('слот с v3 открывается', store.load(w) && canon(w.toJSON()) === sampleCanon);
    check(
      'после записи слот становится v4 и читается',
      (() => {
        const res = store.save(w);
        if (!res.ok) return false;
        const back = new World();
        return back.fromJSON(JSON.parse(backing.get(SLOT_PREFIX + id)!)) && canon(back.toJSON()) === canon(w.toJSON());
      })(),
    );
    check('отказа при перезаписи не было', store.lastLoadFailed === false);
  }
  {
    clearStore();
    const sample = new World(); // стартовый сад «из давней версии»
    backing.set(LEGACY_KEY, legacyJson(sample.toJSON()));
    const store = new GardenStore(); // bootstrap подбирает его в первый слот
    const w = variedWorld(8, 8);
    check(
      'старое одиночное сохранение переехало в первый слот',
      store.list.length === 1 && store.load(w) && canon(w.toJSON()) === canon(sample.toJSON()),
      store.list.length ? `слотов ${store.list.length}` : 'список пуст',
    );
  }

  // ---------- Запись, отказ хранилища, откат на копию ----------
  console.log('хранилище:');
  {
    clearStore();
    const store = new GardenStore();
    const id = store.list[0].id;
    const key = SLOT_PREFIX + id;
    const w = variedWorld(17, 60);
    quotaMode = true;
    const res = store.save(w);
    check('переполнение возвращается, а не молчит', !res.ok && res.reason === 'quota');
    check('после отказа нет полузаписанного', !backing.has(key) && !backing.has(key + '.tmp'));
    quotaMode = false;
    check(
      'после отказа запись оживает',
      (() => {
        const r = store.save(w);
        return r.ok;
      })(),
    );
  }
  {
    clearStore();
    const store = new GardenStore();
    const id = store.list[0].id;
    const key = SLOT_PREFIX + id;
    const first = variedWorld(31, 40);
    const second = variedWorld(32, 55);
    store.save(first);
    const firstCanon = canon(first.toJSON());
    store.save(second); // теперь в копии — первое состояние
    const secondCanon = canon(second.toJSON());

    // Побилась основа — читаем копию и чиним основу
    backing.set(key, '{битые данные');
    const w = new World();
    check('побитая основа читается из копии', store.load(w) && canon(w.toJSON()) === firstCanon);
    check(
      'основа починена копией',
      (() => {
        try {
          return !!parseSave(JSON.parse(backing.get(key)!));
        } catch {
          return false;
        }
      })(),
    );

    // Побились основа и копия, но жива временная запись
    backing.set(key, 'мусор');
    backing.set(key + '.bak', 'мусор');
    backing.set(key + '.tmp', serializeSave(second.toJSON()));
    const w2 = new World();
    check('временная запись спасает, когда побито всё', store.load(w2) && canon(w2.toJSON()) === secondCanon);

    // Побито всё: честный отказ, мир не тронут, данные в карантине
    backing.set(key, 'мусор1');
    backing.set(key + '.bak', 'мусор2');
    backing.set(key + '.tmp', 'мусор3');
    const w3 = variedWorld(33, 12);
    const w3Canon = canon(w3.toJSON());
    const ok = store.load(w3);
    check('совсем битый слот не открывается и не портит мир', !ok && canon(w3.toJSON()) === w3Canon);
    check('признак повреждения поднят', store.lastLoadFailed === true);
    check('остатки отложены карантином, не удалены', (backing.get(key + '.broken') ?? '').includes('мусор1'));
    check(
      'место слота расчищено для новой записи',
      !backing.has(key) && !backing.has(key + '.bak') && !backing.has(key + '.tmp'),
    );
    check(
      'на месте битого слота можно начать заново',
      (() => {
        const r = store.save(w3);
        return r.ok && !!parseSave(JSON.parse(backing.get(key)!));
      })(),
    );
  }
  {
    clearStore();
    const store = new GardenStore();
    const w = variedWorld(41, 70);
    store.save(w);
    const aId = store.activeId;
    const aCanon = canon(w.toJSON());
    // Второй сад живёт в том же мире: create пересаживает w на чистую землю
    const b = store.create(w, 'Второй');
    check('вернулись в первый', store.switchTo(w, aId) && canon(w.toJSON()) === aCanon);
    const key = SLOT_PREFIX + b.id;
    backing.set(key, 'мусор');
    backing.set(key + '.bak', 'мусор');
    const ok = store.switchTo(w, b.id);
    check(
      'битая усадьба не открывается и не затирает текущую',
      !ok && store.activeId === aId && canon(w.toJSON()) === aCanon,
    );
    check('битая усадьба тоже карантинится', (backing.get(key + '.broken') ?? '').length > 0);
    store.remove(w, b.id);
    check('удаление убирает и карантин', !backing.has(key + '.broken') && !backing.has(key));
  }

  // ---------- Файл на диск и обратно ----------
  console.log('файл усадьбы:');
  {
    clearStore();
    const store = new GardenStore();
    const current = new World();
    store.save(current);
    const sample = variedWorld(63, 45);
    const sampleCanon = canon(sample.toJSON());
    const fakeFile = (json: string, name = 'принятый.сад.json') =>
      ({ name, text: async () => json }) as unknown as File;

    const okBare = await store.importFile(current, fakeFile(legacyJson(sample.toJSON())));
    check(
      'принят старый файл без обёртки',
      okBare !== null && canon(current.toJSON()) === sampleCanon && store.active?.objects === 45,
    );

    const packed = JSON.parse(serializeSave(variedWorld(64, 20).toJSON())) as unknown;
    const sample2 = parseSave(packed)!;
    const okWrap = await store.importFile(
      current,
      fakeFile(JSON.stringify({ kind: 'usadba-garden', name: 'Дальний двор', data: packed })),
    );
    check('принят новый файл в обёртке', okWrap === 'Дальний двор' && canon(current.toJSON()) === canon(sample2));

    const before = store.list.length;
    const worldBefore = canon(current.toJSON());
    check(
      'мусор из файла не создаёт усадьбу',
      (await store.importFile(current, fakeFile('это вам не сад'))) === null && store.list.length === before,
    );
    check(
      'битый файл не трогает мир',
      (await store.importFile(current, fakeFile(JSON.stringify({ data: { v: 4, t: 'о' } })))) === null &&
        canon(current.toJSON()) === worldBefore,
    );
  }

  // ---------- История: упаковка и потолок ----------
  console.log('история:');
  {
    const w = new World();
    const h = new History(w);
    // 150 сплошных перекрашиваний всего поля — больше любой реальной сессии
    for (let k = 0; k < 150; k++) {
      h.begin('заливка');
      for (const t of w.tiles) {
        t.ground = k % 2 ? 'sand' : 'gravel';
        t.level = k % 3;
      }
      h.commit();
    }
    const retained = (h as unknown as { past: { tiles: number[] }[] }).past.reduce((n, e) => n + e.tiles.length / 3, 0);
    check(
      'правки тайлов упакованы и умещаются в потолок',
      retained <= TILE_BUDGET && retained >= TILE_BUDGET - 676 * 2,
      `хранится ${retained} из ${TILE_BUDGET}`,
    );
    check('после вытеснения отмена всё ещё работает', h.canUndo);
    h.undo();
    check(
      'одна отмена возвращает прошлое состояние',
      w.tiles[0].ground === 'gravel' && w.tiles[0].level === 1,
      `${w.tiles[0].ground}/${w.tiles[0].level}`,
    );
    h.undo();
    check(
      'вторая отмена идёт дальше',
      w.tiles[0].ground === 'sand' && w.tiles[0].level === 0,
      `${w.tiles[0].ground}/${w.tiles[0].level}`,
    );
    h.redo();
    check('повтор возвращается вперёд', w.tiles[0].ground === 'gravel' && w.tiles[0].level === 1);
  }
  {
    const w = new World();
    const h = new History(w);
    h.begin('мазок', 'stroke');
    w.tiles[0].ground = 'gravel';
    h.commit();
    h.begin('мазок', 'stroke');
    w.tiles[1].ground = 'gravel';
    h.commit();
    const edits = (h as unknown as { past: { tiles: number[] }[] }).past;
    check(
      'ведение кистью сливается в один шаг',
      edits.length === 1 && edits[0].tiles.length === 6,
      `шагов ${edits.length}`,
    );
    h.undo();
    check('слитный мазок отменяется целиком', w.tiles[0].ground !== 'gravel' && w.tiles[1].ground !== 'gravel');
  }
  {
    const w = new World();
    const h = new History(w);
    const o = w.objects[0];
    const oldTx = o.tx;
    h.begin('перенос');
    o.tx += 1;
    w.checkMilestone('in_the_rain');
    h.commit();
    h.undo();
    check('перенос отменяется, веха не отбирается', o.tx === oldTx && w.milestones.has('in_the_rain'));
    h.redo();
    check('перенос повторяется', o.tx === oldTx + 1);
  }

  // ---------- Итог ----------
  console.log('');
  if (failed) {
    console.log(`ПАДЕНИЕ: ${failed} проверок не прошло`);
    process.exitCode = 1;
  } else {
    console.log('все проверки сохранения зелёные');
  }
}

void main();
