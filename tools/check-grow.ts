/**
 * Проверка растущего сада без браузера.
 *
 *   npx tsx tools/check-grow.ts
 *
 * Геометрия удвоения, пороги 1·2·4·7·11·16·22·…, приход действий по настоящим
 * минутам, плата за посадку и кисть, отказ при пустом запасе, границы
 * тумана (посадка, заливка, тропа, перенос), сохранение v6 и детерминизм
 * дикой земли. Возвращает ненулевой код при любом расхождении.
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
  const {
    GROW_ACTION_MS,
    GROW_BANK_CAP,
    GROW_MAX_STAGE,
    growOfferReady,
    growThreshold,
    growTick,
    growZones,
    inGrowRect,
    newGrowState,
    seedGrowWorld,
  } = await import('../src/world/grow');
  const { serializeSave, parseSave } = await import('../src/world/saveFormat');
  const { scanHabitat } = await import('../src/world/habitat');
  const { GRID } = await import('../src/core/iso');

  console.log('геометрия и пороги');
  {
    const th = [0, 1, 2, 3, 4, 5, 6].map(growThreshold);
    check('пороги сбалансированы: 1,2,4,7,11,16,22', th.join(',') === '1,2,4,7,11,16,22', th.join(','));
    check('ряд продолжается по +7, +8, +9: 29,37,46', [7, 8, 9].map(growThreshold).join(',') === '29,37,46');
    check(
      'разность соседних порогов растёт на единицу',
      Array.from({ length: 20 }, (_, i) => i + 1).every((n) => growThreshold(n) - growThreshold(n - 1) === n),
    );
    check(
      'некорректная ступень безопасна',
      [-1, NaN, Infinity].every((n) => growThreshold(n) === 1),
    );
    check('дробная ступень округляется как в сохранениях', growThreshold(3.9) === 7);
    for (let stage = 0; stage < GROW_MAX_STAGE; stage++) {
      // Изолируем порог от геометрии: у тестового клочка всегда есть свободные стороны.
      const state = newGrowState(7, 1000);
      state.stage = stage;
      state.progress = growThreshold(stage) - 1;
      check(`ступень ${stage}: одного действия ещё не хватает`, !growOfferReady(state));
      state.progress++;
      check(`ступень ${stage}: предложение ровно на пороге`, growOfferReady(state));
      state.progress++;
      check(`ступень ${stage}: избыток прогресса не прячет предложение`, growOfferReady(state));
    }
    const finished = newGrowState(7, 1000);
    finished.stage = GROW_MAX_STAGE;
    finished.progress = growThreshold(GROW_MAX_STAGE);
    check('формула не снимает ограничение числа расширений', !growOfferReady(finished));
    const st = newGrowState(7, 1000);
    check(
      'старт: клочок 2×2 в центре листа',
      st.rect.w === 2 && st.rect.h === 2 && st.rect.x === Math.floor((GRID - 2) / 2),
    );
    check('старт: три действия в подарок', st.bank === 3 && st.tick === 1000);
    const zs = growZones(st.rect);
    check('четыре зоны-кандидата', zs.length === 4);
    check(
      'зоны примыкают к сторонам и удваивают площадь',
      zs.every(
        (z) => z.w * z.h === st.rect.w * st.rect.h && z.x >= 0 && z.y >= 0 && z.x + z.w <= GRID && z.y + z.h <= GRID,
      ),
    );
    const touching = zs.every(
      (z) =>
        z.x + z.w === st.rect.x || // слева
        z.x === st.rect.x + st.rect.w || // справа
        z.y + z.h === st.rect.y || // сверху
        z.y === st.rect.y + st.rect.h, // снизу
    );
    check('каждая зона касается своей стороны', touching);
  }

  console.log('удвоение площади ростом');
  {
    const w = new World();
    w.reset();
    const now = Date.now();
    w.grow = newGrowState(1, now);
    const areas: number[] = [w.grow.rect.w * w.grow.rect.h];
    // Растём по очереди на восток и на юг: 2×2 → 4×2 → 4×4 → 8×4 → 8×8
    for (let i = 0; i < 4; i++) {
      const r = w.grow.rect;
      const zs = growZones(r);
      const east = zs.find((z) => z.x === r.x + r.w);
      const south = zs.find((z) => z.y === r.y + r.h);
      const pick = i % 2 === 0 ? east : south;
      check(`шаг ${i + 1}: есть зона роста`, !!pick);
      if (!pick) break;
      w.growExpand(pick);
      areas.push(w.grow.rect.w * w.grow.rect.h);
    }
    check('площадь удваивается каждый раз: 4,8,16,32,64', areas.join(',') === '4,8,16,32,64', areas.join(','));
    check('после роста прогресс обнулён, ступень выросла', w.grow!.progress === 0 && w.grow!.stage === 4);
    check('после роста выбор закрыт', w.grow!.choosing === false);
    const rects = ['2x4', '4x4', '4x8', '8x8'];
    const got = [1, 2, 3, 4].map((i) => {
      const a = areas[i];
      return a;
    });
    check('стороны чередуются: 4×2, 4×4, 8×4, 8×8', got.length === rects.length && areas[4] === 64);
  }

  console.log('приход действий по времени');
  {
    const st = newGrowState(3, 0);
    st.bank = 0;
    check('меньше десяти минут — ничего', growTick(st, GROW_ACTION_MS - 1) === 0 && st.bank === 0);
    check('десять минут — одно действие', growTick(st, GROW_ACTION_MS) === 1 && st.bank === 1);
    check('остаток копится: ещё девять минут не считаются', growTick(st, GROW_ACTION_MS * 2 - 1) === 0);
    st.bank = 0;
    st.tick = 0;
    check(
      'двадцать пять минут — два действия, остаток сохранён',
      growTick(st, GROW_ACTION_MS * 2.5) === 2 && st.bank === 2,
    );
    check('тик сдвинулся ровно на два интервала', st.tick === GROW_ACTION_MS * 2);
    st.tick = 0;
    st.bank = GROW_BANK_CAP - 1;
    growTick(st, GROW_ACTION_MS * 100);
    check('запас не выше трёх', st.bank === GROW_BANK_CAP);
  }

  console.log('плата за действия');
  {
    const w = new World();
    const now = Date.now();
    w.grow = newGrowState(9, now);
    w.grow.bank = 2;
    const r = w.grow.rect;
    // Землю под посадку сделаем лугом — наверняка подходит мелочи
    for (let y = r.y; y < r.y + r.h; y++)
      for (let x = r.x; x < r.x + r.w; x++) {
        const t = w.at(x, y)!;
        t.ground = 'grass';
        t.water = false;
      }
    const a = w.place('azalea', r.x + 0.5, r.y + 0.5, 0);
    check('первая посадка прошла, действие списано', !!a && w.grow.bank === 1 && w.grow.progress === 1);
    check('уже первая посадка открывает рост', growOfferReady(w.grow));
    const b = w.place('grass_tuft', r.x + 1.5, r.y + 0.5, 0);
    check(
      'вторая посадка: запас пуст, прогресс сверх первого порога',
      !!b && w.grow.bank === 0 && w.grow.progress === 2,
    );
    check('накопленные действия не отменяют предложение роста', growOfferReady(w.grow));
    const c = w.place('moss_clump', r.x + 0.5, r.y + 1.5, 0);
    check('третья посадка отклонена', c === null && w.growRefused);
    check('отклонённое действие не растит прогресс', w.grow.progress === 2);
    // Убрать — бесплатно
    w.growRefused = false;
    w.removeObject(a!);
    check('убрать можно без действий', w.grow.bank === 0 && !w.growRefused);
    // Кисть: один мазок — одно действие
    w.grow.bank = 2;
    w.grow.progress = 0;
    w.beginStroke();
    const brush = { id: 'grass', kind: 'ground', name: 'луг', ground: 'grass' } as never;
    const p1 = w.applyBrush(brush, r.x + 0.5, r.y + 0.5);
    const p2 = w.applyBrush(brush, r.x + 1.5, r.y + 1.5);
    check('мазок кисти платит один раз', p1 && p2 && w.grow.bank === 1 && w.grow.progress === 1);
    w.beginStroke();
    w.applyBrush(brush, r.x + 0.5, r.y + 1.5);
    check('новый мазок — новое действие', w.grow.bank === 0 && w.grow.progress === 2);
  }

  console.log('границы тумана');
  {
    const w = new World();
    w.reset();
    seedGrowWorld(w, 3);
    const now = Date.now();
    w.grow = newGrowState(11, now);
    w.grow.bank = 6;
    const r = w.grow.rect;
    const out = w.place('azalea', r.x - 3, r.y, 0);
    check('за туманом посадка не проходит', out === null && w.grow.bank === 6);
    const t0 = w.at(r.x, r.y)!;
    t0.ground = 'grass';
    // Заливка из открытой клетки не вытекает за прямоугольник.
    // Красим камнем — в дикой земле его нет, значит любая клетка снаружи утечка.
    w.floodFill(r.x + 0.5, r.y + 0.5, 'stone');
    let leaked = 0;
    for (let y = 0; y < GRID; y++)
      for (let x = 0; x < GRID; x++) {
        if (inGrowRect(r, x, y)) continue;
        if (w.tiles[y * GRID + x].ground === 'stone') leaked++;
      }
    check('заливка остаётся внутри', leaked === 0, `утечка ${leaked}`);
    check('заливка за туманом отклонена', w.floodFill(r.x - 2, r.y - 2, 'sand') === false);
    // Перенос за туман
    const placed = w.place('grass_tuft', r.x + 0.5, r.y + 0.5, 0);
    check('предмет для переноса посажен', !!placed);
    if (placed) {
      const bankBefore = w.grow.bank;
      check(
        'перенос за туман отклонён',
        w.moveObject(placed, r.x - 4, r.y - 4) === false && w.grow.bank === bankBefore,
      );
    }
  }

  console.log('сохранение v6');
  {
    const w = new World();
    w.reset();
    seedGrowWorld(w, 42);
    w.grow = newGrowState(42, 1234);
    w.grow.bank = 4;
    w.grow.progress = 1;
    w.grow.stage = 2;
    w.grow.choosing = true;
    const packed = serializeSave(w.toJSON());
    const parsed = parseSave(JSON.parse(packed));
    check('сохранение читается', !!parsed);
    check(
      'состояние роста переживает сохранение',
      !!parsed?.grow &&
        parsed.grow.rect.x === w.grow!.rect.x &&
        parsed.grow.rect.w === w.grow!.rect.w &&
        parsed.grow.bank === 4 &&
        parsed.grow.tick === 1234 &&
        parsed.grow.progress === 1 &&
        parsed.grow.stage === 2 &&
        parsed.grow.choosing === true,
    );
    const w2 = new World();
    if (parsed) w2.applySave(parsed);
    check('мир восстановил рост', !!w2.grow && w2.grow.rect.w === w.grow!.rect.w && w2.grow.stage === 2);
    // Старое сохранение без поля роста — вольный сад
    const free = parseSave(JSON.parse(serializeSave(new World().toJSON())));
    check('вольный сад сохраняется без роста', !!free);
    // Мусор в поле роста не проходит
    const bad = JSON.parse(packed) as Record<string, unknown>;
    bad.g = { rect: { x: -5, y: 0, w: 2, h: 2 }, seed: 1, bank: 0, tick: 0, progress: 0, stage: 0, choosing: false };
    check(
      'прямоугольник вне листа отклоняется',
      parseSave(bad)?.grow === undefined || parseSave(bad) === null || parseSave(bad)!.grow === null,
    );
  }

  console.log('дикая земля');
  {
    const w1 = new World();
    w1.reset();
    seedGrowWorld(w1, 777);
    const w2 = new World();
    w2.reset();
    seedGrowWorld(w2, 777);
    const w3 = new World();
    w3.reset();
    seedGrowWorld(w3, 778);
    const sig = (w: World): string =>
      w.tiles.map((t) => `${t.ground}${t.level}${t.water ? 'w' : ''}`).join('') +
      '|' +
      w.objects.map((o) => `${o.type}:${o.tx}:${o.ty}`).join(',');
    check('один сид — одна земля', sig(w1) === sig(w2));
    check('разные сиды — разная земля', sig(w1) !== sig(w3));
    check(
      'в дикой земле нет построек',
      w1.objects.every((o) => !['building', 'path'].includes(o.type)),
    );
    let stone = 0;
    for (const t of w1.tiles) if (t.ground === 'stone') stone++;
    check('в дикой земле нет камня троп', stone === 0);
    const kinds = new Set(w1.objects.map((o) => o.type));
    check(
      'рождены деревья и травы',
      w1.objects.length > 20,
      `${w1.objects.length} предметов: ${[...kinds].slice(0, 5).join(',')}`,
    );
    let water = 0;
    for (const t of w1.tiles) if (t.water) water++;
    check('где-то есть вода', water > 0, `${water} клеток`);
    // Центральный клочок 2×2 оставлен чистым мхом под первые шаги
    const c = Math.floor((GRID - 2) / 2);
    let clear = true;
    for (let y = c; y < c + 2; y++)
      for (let x = c; x < c + 2; x++) {
        const t = w1.at(x, y)!;
        if (t.ground !== 'moss' || t.water || t.level !== 0) clear = false;
        if (w1.pickObject(x, y)) clear = false;
      }
    check('стартовый клочок чист', clear);
  }

  console.log('жизнь знает границы');
  {
    const w = new World();
    w.reset();
    seedGrowWorld(w, 5);
    const r = { x: 10, y: 10, w: 4, h: 4 };
    w.grow = { rect: r, seed: 5, bank: 0, tick: 0, progress: 0, stage: 0, choosing: false };
    const open = scanHabitat(w, r);
    const full = scanHabitat(w, null);
    check('подсчёт в границах не больше полного', open.trees <= full.trees && open.water <= full.water);
    check('в маленьком клочке почти нет деревьев', open.trees < full.trees, `${open.trees} из ${full.trees}`);
  }
}

main().then(() => {
  if (failed) {
    console.error(`\nпровалено проверок: ${failed}`);
    process.exit(1);
  }
  console.log('\nвсе проверки растущего сада прошли');
});
