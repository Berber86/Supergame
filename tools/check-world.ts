/**
 * Охота на баги: прогон логики мира без браузера.
 *
 *   npx tsx tools/check-world.ts
 *
 * Постановка и повороты у границ, вода и течение, умные тропы, отмена
 * и перенос вместе, смена усадьбы на середине действия, долгая игра
 * живности и сетка выбора объекта. Возвращает ненулевой код при любом
 * расхождении.
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

/** Детерминированный случайный ряд. */
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
  const { computeTime } = await import('../src/core/clock');
  const { World } = await import('../src/world/world');
  const { History } = await import('../src/core/history');
  const { ITEM_BY_ID, footprintCells, footprint } = await import('../src/world/catalog');
  const { findPath, layPath } = await import('../src/world/paths');
  const { WaterFlow } = await import('../src/world/waterFlow');
  const { Life } = await import('../src/world/life');
  type PlacedObject = import('../src/world/types').PlacedObject;
  type SaveData = import('../src/world/types').SaveData;

  const rand = mulberry32(910);

  /** Плоский пустой сад: мох, уровень 0, без воды и предметов. */
  function flatWorld(): World {
    const w = new World();
    for (const t of w.tiles) {
      t.ground = 'moss';
      t.level = 0;
      t.water = false;
      t.indoor = false;
      t.veranda = false;
    }
    w.objects = [];
    w.milestones = new Set();
    w.noteObjectsChanged();
    return w;
  }

  function waterAt(w: World, x0: number, y0: number, x1: number, y1: number, level = 0): void {
    for (let y = y0; y <= y1; y++)
      for (let x = x0; x <= x1; x++) {
        const t = w.at(x, y)!;
        t.ground = 'water';
        t.level = level;
        t.water = true;
      }
  }

  // ---------- Отпечаток с поворотом ----------
  console.log('отпечаток предмета:');
  {
    const bridge = ITEM_BY_ID.get('bridge')!; // 1×3
    const r0 = footprintCells(bridge, 10, 10, 0);
    const r1 = footprintCells(bridge, 10, 10, 1);
    check('мост в положении 0 лежит вдоль оси x',
      r0.x0 === 9 && r0.x1 === 11 && r0.y0 === 11 && r0.y1 === 11, `${JSON.stringify(r0)}`);
    check('мост в положении 1 лежит вдоль оси y',
      r1.x0 === 10 && r1.x1 === 10 && r1.y0 === 10 && r1.y1 === 12, `${JSON.stringify(r1)}`);
    const rock = ITEM_BY_ID.get('rock_big')!; // 2×2
    const rr = footprintCells(rock, 10, 10, 0);
    check('валун 2×2 занимает все четыре клетки', rr.x0 === 10 && rr.x1 === 11 && rr.y0 === 10 && rr.y1 === 11);
    const trio = ITEM_BY_ID.get('rock_trio')!; // 1×3
    const tr = footprint(trio, 3);
    check('отпечаток на нечётном повороте — как в каталоге', tr.w === 1 && tr.h === 3);
  }

  // ---------- Постановка и границы ----------
  console.log('постановка у границ:');
  {
    const w = flatWorld();
    // Мост по вертикали встал бы у края, по горизонтали — висит в пустоте
    check('мост rot1 у правого края — можно', w.canPlace('bridge', 24, 2, 1));
    check('мост rot0 у правой кромки висит за садом — нельзя', !w.canPlace('bridge', 25, 2, 0));
    check('мост rot0 у левой кромки висит за садом — нельзя', !w.canPlace('bridge', 0, 2, 0));
    check('мост rot0 на воле — можно', w.canPlace('bridge', 24, 2, 0));
    check('мост rot1 у нижней кромки — нельзя', !w.canPlace('bridge', 4, 24, 1));
    check('мост rot1 шагом выше — можно', w.canPlace('bridge', 4, 23, 1));
    // Валун в углу
    check('валун 2×2 вписывается в угол', w.canPlace('rock_big', 24, 24, 0));
    check('валун 2×2 за углом — нельзя', !w.canPlace('rock_big', 25, 25, 0));
    // Триада у кромки
    check('триада rot0 в упор к стене — нельзя', !w.canPlace('rock_trio', 0, 5, 0));
    check('триада rot0 с отступом — можно', w.canPlace('rock_trio', 1, 5, 0));
  }
  {
    const w = flatWorld();
    waterAt(w, 8, 8, 11, 11);
    check('беседка не встаёт в воду', !w.canPlace('pavilion', 8, 8, 0) && !w.canPlace('pavilion', 7, 7, 0) && !w.canPlace('pavilion', 10, 10, 2));
    check('беседка стоит рядом с водой', w.canPlace('pavilion', 5, 5, 0));
    check('лотос требует воду', w.canPlace('lotus', 8, 8, 0) && !w.canPlace('lotus', 3, 3, 0));
    check('мост идёт по воде', w.canPlace('bridge', 9, 8, 1));
    check('дерево не встаёт в воду', !w.canPlace('sakura', 8, 8, 0));
  }

  // ---------- Перенос ----------
  console.log('перенос:');
  {
    const w = flatWorld();
    const tree = w.place('sakura', 10, 10, 0, 1000)!;
    const id = tree.id;
    const seed = tree.seed;
    check('перенос в дозволенное место', w.moveObject(tree, 12, 12) && tree.tx === 12);
    check('перенос за край отклонён, место не сбилось', !w.moveObject(tree, GRID - 0.1, 12) === true && tree.tx === 12 && tree.ty === 12);
    const bridge = w.place('bridge', 10, 4, 1)!;
    check('мост нельзя повернуть переносом в стену', !w.moveObject(bridge, 25, 4, 0) && bridge.tx === 10 && bridge.rot === 1);
    check('мост можно повернуть переносом на воле', w.moveObject(bridge, 24, 4, 0) && bridge.rot === 0 && bridge.tx === 24);
    check('возраст и сид пережили переезды', tree.id === id && tree.seed === seed && tree.planted === 1000);

    // Смена усадьбы на середине переноса: чужой объект обратно не возвращается
    const other = flatWorld();
    const snapshot = other.toJSON();
    const orphan = tree;
    w.applySave(snapshot);
    check('мигрировавший мир изменился', !w.objects.includes(orphan));
    check('осиротевший объект не воскресает переносом', !w.moveObject(orphan, 5, 5) && !w.objects.includes(orphan));
  }

  // ---------- Отмена вместе с переносом ----------
  console.log('отмена и перенос вместе:');
  {
    const w = flatWorld();
    const h = new History(w);
    const tree = w.place('sakura', 10, 10, 0, 777)!;
    const planted = tree.planted;
    const seed = tree.seed;

    h.begin('перенос');
    w.moveObject(tree, 14, 14);
    h.commit();
    h.undo();
    check('отмена вернула дерево', tree.tx === 10 && tree.ty === 10);
    h.redo();
    check('повтор перенёс снова', tree.tx === 14 && tree.ty === 14);

    // Перенести ещё раз — возраст и посадка не должны потеряться
    h.begin('перенос');
    w.moveObject(tree, 18, 6, 2);
    h.commit();
    check('после второго переезда возраст и сид целы', tree.planted === planted && tree.seed === seed && tree.rot === 2);
    h.undo();
    check('отмена второго переезда вернула и поворот', tree.tx === 14 && tree.rot === 0);

    // Снос и возврат тем же предметом
    h.begin('снос');
    w.removeObject(tree);
    h.commit();
    check('снос убрал предмет', !w.objects.includes(tree));
    h.undo();
    const back = w.objects.find((o) => o.planted === planted);
    check('отмена сноса вернула его же', !!back && back.seed === seed && back.id === tree.id);
  }

  // ---------- Тропы ----------
  console.log('тропы:');
  {
    const w = new World(); // стартовая усадьба: пруд, беседка, валуны
    const from = { x: 4, y: 16 };
    const to = { x: 23, y: 16 };
    const path = findPath(w, from, to)!;
    check('дорога через сад находится', !!path && path.length > 8);
    if (path) {
      const crossesWater = path.some((c) => w.at(c.x, c.y)!.water);
      check('тропа не идёт по воде', !crossesWater, crossesWater ? JSON.stringify(path.filter((c) => w.at(c.x, c.y)!.water)) : '');
      // Беседка 2×2 закрывает все свои клетки, а не якорную
      const pavilion = w.objects.find((o) => o.type === 'pavilion')!;
      const r = footprintCells(ITEM_BY_ID.get('pavilion')!, pavilion.tx, pavilion.ty, pavilion.rot);
      const inside = (c: { x: number; y: number }) => c.x >= r.x0 && c.x <= r.x1 && c.y >= r.y0 && c.y <= r.y1;
      check('тропа не режет беседку насквозь', !path.some(inside), JSON.stringify(path.filter(inside)));
    }

    // Непроходимое кольцо воды
    const w2 = flatWorld();
    waterAt(w2, 10, 10, 16, 16);
    // осушим центр и наружу, оставив кольцо
    for (let y = 12; y <= 14; y++)
      for (let x = 12; x <= 14; x++) {
        const t = w2.at(x, y)!;
        t.ground = 'moss';
        t.water = false;
      }
    check('в кольце воды дороги нет', findPath(w2, { x: 3, y: 3 }, { x: 13, y: 13 }) === null);

    // Прокладка и отмена
    const w3 = flatWorld();
    const h3 = new History(w3);
    const cells = findPath(w3, { x: 2, y: 2 }, { x: 12, y: 8 })!;
    h3.begin('тропа');
    const laid = layPath(w3, cells);
    h3.commit();
    check('тропа легла камнем', laid > 5 && cells.every((c) => w3.at(c.x, c.y)!.ground === 'stone'));
    h3.undo();
    check('отмена вернула мох', cells.every((c) => w3.at(c.x, c.y)!.ground === 'moss'));
  }

  // ---------- Вода ----------
  console.log('вода:');
  {
    const w = flatWorld();
    waterAt(w, 10, 10, 13, 13, -1);
    const dry = w.at(9, 9)!;
    dry;
    const flow = new WaterFlow();
    flow.ensure(w);
    check('стоячий пруд не течёт', !flow.hasCurrent && flow.falls.length === 0);

    // Исток на плато повыше, канал пониже, пруд в конце. Плато по бокам —
    // чтобы слив был только в одну сторону, как в настоящем пруду.
    const w2 = flatWorld();
    for (let y = 3; y <= 8; y++)
      for (let x = 3; x <= 6; x++) w2.at(x, y)!.level = 1; // плато
    waterAt(w2, 5, 5, 6, 6, 1);   // верхний бассейн
    waterAt(w2, 7, 5, 10, 6, 0);  // канал
    waterAt(w2, 11, 4, 14, 7, 0); // пруд
    const flow2 = new WaterFlow();
    flow2.ensure(w2);
    check('перепад даёт водопад', flow2.falls.length === 2, `уступов ${flow2.falls.length}`);
    check('соседние уступы слиты в занавес', flow2.curtains.length === 1 && flow2.curtains[0].tiles.length === 2,
      `занавесов ${flow2.curtains.length}`);
    const mid = flow2.at(8, 5);
    check('перепад делает воду живой', flow2.hasCurrent, mid ? `speed ${mid.speed.toFixed(3)}` : 'пусто');
    // Верхний бассейн тянет к своему уступу: вода ускоряется перед падением
    const top = flow2.at(5, 5);
    const lip = flow2.at(6, 5);
    check('верхняя вода течёт к уступу', !!top && top.fx > 0.2 && !!lip && lip.fx > 0.5,
      top && lip ? `f5 ${top.fx.toFixed(2)} f6 ${lip.fx.toFixed(2)}` : 'пусто');
    flow2.markDirty();
    // Выровняем воду — водопад исчезает
    for (let y = 5; y <= 6; y++) for (let x = 5; x <= 10; x++) w2.at(x, y)!.level = 0;
    flow2.ensure(w2);
    check('после выравнивания водопад исчез', flow2.falls.length === 0);
  }

  // ---------- Заливка и её отмена ----------
  console.log('заливка:');
  {
    const w = flatWorld();
    const h = new History(w);
    h.begin('заливка');
    const ok = w.floodFill(13, 13, 'gravel');
    h.commit();
    const gravel = w.tiles.filter((t) => t.ground === 'gravel').length;
    check('заливка красит область и держит предел', ok && gravel > 200 && gravel <= 420, `${gravel} клеток`);
    h.undo();
    check('отмена заливки вернула мох', w.tiles.every((t) => t.ground === 'moss'));
    w.floodFill(1, 1, 'moss');
    check('заливка тем же материалом — не действие', !w.floodFill(1, 1, 'moss'));
  }

  // ---------- Смена усадьбы на середине действия ----------
  console.log('смена усадьбы на середине действия:');
  {
    const w = flatWorld();
    const h = new History(w);
    h.begin('мазок', 'brush:g_sand');
    w.tiles[0].ground = 'sand';
    // Мир подменили, пока мазок не закончен — как при переключении усадьбы
    const snap: SaveData = new World().toJSON();
    w.applySave(snap);
    h.clear();
    check('половинчатое действие не пишется в историю', !h.commit() && !h.canUndo);
    check('новый сад не испорчен недописанным мазком', w.tiles[0].ground !== 'sand');
    // Теперь действия идут уже по новому саду
    h.begin('мазок', 'brush:g_sand');
    w.tiles[0].ground = 'sand';
    check('после смены усадьбы история работает снова', h.commit());
    h.undo();
    check('и отменяется', w.tiles[0].ground !== 'sand');
  }

  // ---------- Живность: долгая игра ----------
  console.log('долгая игра (сутки ускоренного времени):');
  {
    const w = new World(); // стартовый сад с деревьями, прудом, котом, карпами
    const life = new Life();
    const start = Date.now();
    let maxBirds = 0;
    let maxFlutters = 0;
    let maxGusts = 0;
    let maxEmitted = 0;
    for (let k = 0; k < 86400; k++) {
      // сцена «не рисуется»: очередь опадающего никто не забирает
      life.update(w, computeTime(start + k * 1000), 1000, start + k * 1000);
      if (life.birds.length > maxBirds) maxBirds = life.birds.length;
      if (life.flutters.length > maxFlutters) maxFlutters = life.flutters.length;
      if (life.gusts.length > maxGusts) maxGusts = life.gusts.length;
      if (life.emitted.length > maxEmitted) maxEmitted = life.emitted.length;
    }
    const cats = w.objects.filter((o) => o.type === 'cat').length;
    const koi = w.objects.filter((o) => o.type === 'koi').length;
    check('птицы не копятся', maxBirds <= 5, `максимум ${maxBirds}`);
    check('бабочки и стрекозы не копятся', maxFlutters <= 9, `максимум ${maxFlutters}`);
    check('порывы ветра не копятся', maxGusts <= 6, `максимум ${maxGusts}`);
    check('лепестки под неработающей сценой ограничены', maxEmitted <= 64, `максимум ${maxEmitted}`);
    check('коты соответствуют предметам', life.cats.length === cats, `${life.cats.length} из ${cats}`);
    check('рыбы соответствуют карпам', life.fish.length === koi * 2, `${life.fish.length} из ${koi * 2}`);
    check('позиции агентов не развалились в NaN', life.cats.every((c) => Number.isFinite(c.tx) && Number.isFinite(c.ty)) && life.fish.every((f) => Number.isFinite(f.tx)));
  }
  {
    // Равный состав, но другие предметы: агенты должны переселиться
    const w = flatWorld();
    const life = new Life();
    waterAt(w, 2, 2, 5, 5);
    waterAt(w, 18, 18, 21, 21);
    const a = w.place('koi', 3, 3)!;
    life.update(w, computeTime(Date.now()), 16, Date.now());
    const homeBefore = life.fish[0].homeX;
    w.removeObject(a);
    w.place('koi', 19, 19);
    life.update(w, computeTime(Date.now()), 16, Date.now());
    check('карпы переселились при замене предмета тем же числом',
      life.fish.length === 2 && life.fish.every((f) => f.homeX === 19.5) && homeBefore === 3.5,
      `дом ${life.fish[0]?.homeX}`);

    const b = w.place('cat', 10, 10)!;
    life.update(w, computeTime(Date.now()), 16, Date.now());
    const catSeed = life.cats[0].seed;
    w.removeObject(b);
    w.place('cat', 12, 12);
    life.update(w, computeTime(Date.now()), 16, Date.now());
    check('кот переселился при замене предмета', life.cats.length === 1 && life.cats[0].seed !== catSeed && life.cats[0].tx === 12.5);
  }

  // ---------- Сетка выбора объекта ----------
  console.log('выбор объекта (сетка):');
  {
    const w = flatWorld();
    const types = [...ITEM_BY_ID.keys()];
    for (let k = 0; k < 554; k++) {
      w.objects.push({
        id: k + 1,
        type: types[Math.floor(rand() * types.length)],
        tx: Math.floor(rand() * GRID * 4) / 4,
        ty: Math.floor(rand() * GRID * 4) / 4,
        planted: 1000,
        rot: Math.floor(rand() * 4),
        seed: k,
      });
    }
    w.nextId = 555;
    w.noteObjectsChanged();

    // Эталонный полный перебор — тот же алгоритм без сетки
    const pickRef = (tx: number, ty: number): PlacedObject | null => {
      let best: PlacedObject | null = null;
      let bestScore = Infinity;
      for (const o of w.objects) {
        const item = ITEM_BY_ID.get(o.type)!;
        const cx = o.tx + item.w / 2;
        const cy = o.ty + item.h / 2;
        const reach = Math.max(item.w, item.h) * 0.5 + 0.3;
        const d = Math.hypot(cx - tx, cy - ty);
        if (d > reach) continue;
        const score = d / reach - o.id * 1e-7;
        if (score < bestScore) {
          bestScore = score;
          best = o;
        }
      }
      return best;
    };

    let mismatch = 0;
    const pts: [number, number][] = [];
    for (let k = 0; k < 3000; k++) {
      const tx = rand() * (GRID + 4) - 2;
      const ty = rand() * (GRID + 4) - 2;
      pts.push([tx, ty]);
      const a = w.pickObject(tx, ty);
      const b = pickRef(tx, ty);
      if (a !== b) mismatch++;
    }
    check('сетка выдаёт те же ответы, что и перебор (3000 точек)', mismatch === 0, `расхождений ${mismatch}`);

    const t0 = performance.now();
    for (const [tx, ty] of pts.slice(0, 2000)) pickRef(tx, ty);
    const linearMs = performance.now() - t0;
    const t1 = performance.now();
    for (const [tx, ty] of pts.slice(0, 2000)) w.pickObject(tx, ty);
    const gridMs = performance.now() - t1;
    console.log(`  pickObject ×2000 по 554 объектам: перебор ${linearMs.toFixed(1)} мс → сетка ${gridMs.toFixed(1)} мс`);
    check('сетка быстрее перебора', gridMs < linearMs && gridMs < 15, `${gridMs.toFixed(1)} мс`);

    // Мутации держат сетку актуальной. Расчищаем два угла от случайных
    // предметов, чтобы у выбора не было соперников.
    w.objects = w.objects.filter(
      (o) => !(Math.hypot(o.tx - 1.5, o.ty - 1.5) < 3.5 || Math.hypot(o.tx - 24.5, o.ty - 24.5) < 3.5),
    );
    w.noteObjectsChanged();
    check('угол опустел', pickRef(1.5, 1.5) === null && pickRef(24.5, 24.5) === null);

    const added = w.place('sakura', 1, 1)!;
    check('после постановки новое находится', w.pickObject(1.6, 1.6) === added);
    w.removeObject(added);
    check('после сноса не находится', w.pickObject(1.6, 1.6) !== added);
    const h = new History(w);
    const any = w.place('sakura', 1, 1)!;
    h.begin('перенос');
    w.moveObject(any, 24, 24);
    h.commit();
    check('после переноса находится на новом месте', w.pickObject(24.6, 24.6) === any);
    h.undo();
    check('после отмены находится на старом месте', w.pickObject(1.6, 1.6) === any);
  }

  // ---------- Вехи ----------
  console.log('вехи:');
  {
    const w = flatWorld();
    const h = new History(w);
    w.checkMilestone('first_pond');
    check('веха засчиталась и встала в очередь', w.milestones.has('first_pond') && w.pendingMilestones[0] === 'first_pond');
    w.checkMilestone('first_pond');
    check('повторно веха не дублируется', w.pendingMilestones.length === 1);
    h.begin('действие');
    w.tiles[0].ground = 'sand';
    h.commit();
    h.undo();
    // Контур зафиксирован из прошлых решений: вехи не отбираются при отмене
    check('однажды понятое не отбирается отменой', w.milestones.has('first_pond'));
  }

  // ---------- Итог ----------
  console.log('');
  if (failed) {
    console.log(`ПАДЕНИЕ: ${failed} проверок не прошло`);
    process.exitCode = 1;
  } else {
    console.log('все проверки логики мира зелёные');
  }
}

void main();
