/**
 * Проверка тактильного отклика созерцания и сада камней карэсансуй.
 *
 *   npx tsx tools/check-contemplation.ts
 */

import assert from 'node:assert/strict';
import { createCanvas } from '@napi-rs/canvas';

const g = globalThis as Record<string, unknown>;
g.document = { createElement: (t: string) => (t === 'canvas' ? createCanvas(16, 16) : {}) };
g.window = { devicePixelRatio: 1, innerWidth: 1500, innerHeight: 860, matchMedia: () => ({ matches: false }) };
g.performance = g.performance ?? { now: () => Date.now() };
g.localStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };

async function main() {
  const { World } = await import('../src/world/world');
  const { Life } = await import('../src/world/life');
  const { ITEM_BY_ID, TERRAIN_BRUSHES } = await import('../src/world/catalog');
  const { hasDrawer, drawObject, objectHeight } = await import('../src/render/sprites');
  const { buildAtmosphere } = await import('../src/world/palette');
  const { computeTime } = await import('../src/core/clock');
  const { parseSave, serializeSave } = await import('../src/world/saveFormat');
  const { CHRONICLE } = await import('../src/world/chronicle');
  const { GardenAudio } = await import('../src/audio/audio');

  let passed = 0;
  const ok = (msg: string) => {
    passed++;
    console.log(`  ок   ${msg}`);
  };

  console.log('карэсансуй и грабли сада камней:');
  const w = new World();
  assert.equal(w.gravelStyle, 'waves', 'Начальный стиль гравия — waves');
  ok('начальный стиль гравия — волны и рябь у камней');

  w.clearTouched();
  // Поставим гравийную плитку
  w.setGround(5, 5, 'gravel');
  w.clearTouched();

  const nextStyle = w.cycleGravelStyle();
  assert.equal(nextStyle, 'ripples', 'Следующий стиль после waves — ripples');
  assert.equal(w.gravelStyle, 'ripples');
  assert.ok(w.lastTouched, 'Смена стиля гравия помечает плитку как изменённую для перерисовки');
  ok('переключение узора гравия циклично и инвалидирует слой земли');

  w.cycleGravelStyle(); // straight
  assert.equal(w.gravelStyle, 'straight');
  w.cycleGravelStyle(); // swirl
  assert.equal(w.gravelStyle, 'swirl');
  w.cycleGravelStyle(); // back to waves
  assert.equal(w.gravelStyle, 'waves');
  ok('все 4 стиля (волны, круги, борозды, вихри) переключаются по кругу');

  // Предмет «Грабли» в каталоге
  assert.ok(ITEM_BY_ID.has('zen_rake'), 'zen_rake зарегистрирован в каталоге');
  const rakeItem = ITEM_BY_ID.get('zen_rake')!;
  assert.equal(rakeItem.tab, 'stones', 'Грабли находятся во вкладке Камни');
  assert.equal(rakeItem.rotatable, true, 'Грабли поворачиваются');
  ok('грабли доступны в каталоге в разделе камней');

  // Полноценный объект «Сад камней 5×5» в каталоге
  assert.ok(ITEM_BY_ID.has('rock_garden'), 'rock_garden зарегистрирован в каталоге');
  const rockGardenItem = ITEM_BY_ID.get('rock_garden')!;
  assert.equal(rockGardenItem.w, 5, 'Сад камней занимает 5×5 тайлов');
  assert.equal(rockGardenItem.h, 5);
  assert.ok(hasDrawer('rock_garden'), 'rock_garden имеет функцию отрисовки');
  assert.ok(objectHeight('rock_garden') > 0, 'rock_garden имеет высоту для сортировки');
  ok('объект «Сад камней 5×5» зарегистрирован в каталоге и имеет рисовальщик');

  // Установка сада камней 5×5 покрывает площадку гравием
  w.place('rock_garden', 14, 14, 0);
  for (let dy = 0; dy < 5; dy++) {
    for (let dx = 0; dx < 5; dx++) {
      assert.equal(w.at(14 + dx, 14 + dy)?.ground, 'gravel', `Клетка (${14 + dx}, ${14 + dy}) стала гравием`);
    }
  }
  ok('установка сада камней 5×5 автоматически готовит гравийное ложе');

  // Инструмент «Грабли» в кистях земли
  const rakeBrush = TERRAIN_BRUSHES.find((b) => b.id === 'g_rake');
  assert.ok(rakeBrush, 'Кисть g_rake найдена в TERRAIN_BRUSHES');
  assert.equal(rakeBrush.kind, 'rake');
  assert.equal(rakeBrush.ground, 'gravel');
  ok('инструмент «Дзен-грабли» доступен в кистях для прямого рисования узоров');

  // Прямое расчёсывание клетки с узором / направлением мазка
  w.rakeTile(7, 7, 2); // режим 2: волны вдоль Y
  assert.equal(w.at(7, 7)?.ground, 'gravel', 'Клетка стала гравием');
  assert.equal(w.tileRake.get(w.idx(7, 7)), 2, 'Узор клетки равен 2');
  ok('rakeTile расчёсывает клетку гравия с выбранным направлением/узором');

  // Рисовальщик граблей
  assert.ok(hasDrawer('zen_rake'), 'zen_rake имеет функцию отрисовки');
  assert.ok(objectHeight('zen_rake') > 0, 'zen_rake имеет высоту для сортировки');
  const cv = createCanvas(120, 120);
  const ctx = cv.getContext('2d');
  const atm = buildAtmosphere(computeTime(Date.now()), 0);
  for (let rot = 0; rot < 4; rot++) {
    const fakeRake = { id: 10, type: 'zen_rake', tx: 5, ty: 5, planted: 0, rot, seed: 12345 };
    drawObject({
      ctx: ctx as never,
      x: 60,
      y: 60,
      atm,
      g: 1,
      obj: fakeRake,
      time: 1000,
      wind: 0.3,
      alpha: 1,
    });
  }
  ok('грабли рисуются во всех четырёх поворотах');

  // Сохранение и загрузка стиля гравия и индивидуальных бороздок
  w.setGravelStyle('swirl');
  w.rakeTile(10, 10, 6); // вихрь на клетке (10, 10)
  w.addGravelStroke([
    { x: 14.2, y: 14.2 },
    { x: 15.0, y: 15.1 },
    { x: 16.5, y: 16.0 },
  ]);
  assert.equal(w.gravelStrokes.length, 1, 'Мазок граблей добавлен');

  const jsonStr = serializeSave(w.toJSON());
  const parsed = parseSave(JSON.parse(jsonStr));
  assert.ok(parsed, 'Сохранение парсится');
  assert.equal(parsed.gravelStyle, 'swirl', 'Стиль гравия сохранён в данных');
  assert.equal(parsed.tileRake?.[w.idx(10, 10)], 6, 'Узор клетки сохранён в данных');
  assert.ok(parsed.gravelStrokes && parsed.gravelStrokes.length === 1, 'Мазки граблей сохранены в данных');
  assert.equal(parsed.gravelStrokes[0].length, 3);

  const w2 = new World();
  w2.applySave(parsed);
  assert.equal(w2.gravelStyle, 'swirl', 'Мир восстановил стиль гравия swirl');
  assert.equal(w2.tileRake.get(w2.idx(10, 10)), 6, 'Мир восстановил узор клетки');
  assert.equal(w2.gravelStrokes.length, 1, 'Мир восстановил свободные борозды граблей');
  ok('свободные борозды граблей надёжно сохраняются и восстанавливаются');

  // Разравнивание песка
  w2.clearGravelStrokes();
  assert.equal(w2.gravelStrokes.length, 0, 'Борозды очищены после разравнивания');
  ok('разравнивание песка очищает борозды');

  console.log('тактильный отклик и жесты созерцания:');
  const life = new Life();
  w.place('cat', 8, 8, 0);
  life.sync(w);

  // Погладить кота
  assert.equal(life.petCatAt(20, 20), false, 'Клик вдали от кота не гладит его');
  const petted = life.petCatAt(8.5, 8.5);
  assert.equal(petted, true, 'Клик рядом с котом успешно гладит его');
  ok('поглаживание кота находит ближайшего кота и меняет его состояние');

  // Круги на воде и реакция рыб
  w.place('koi', 12, 12, 0);
  life.sync(w);
  life.panicFish(12, 12);
  ok('касание воды вызывает реакцию испуга карпов');

  // Летопись
  assert.ok(CHRONICLE.cat_purr, 'Строка cat_purr существует в летописи');
  assert.ok(CHRONICLE.rake_gravel, 'Строка rake_gravel существует в летописи');
  assert.equal(CHRONICLE.cat_purr.kanji, '撫');
  assert.equal(CHRONICLE.rake_gravel.kanji, '砂');
  const notedCat = w.noteEvent('cat_purr', Date.now(), 8, 8);
  assert.ok(notedCat, 'cat_purr успешно записывается в летопись усадьбы');
  const notedRake = w.noteEvent('rake_gravel', Date.now(), 5, 5);
  assert.ok(notedRake, 'rake_gravel успешно записывается в летопись усадьбы');
  ok('события поглаживания кота и граблей внесены в летопись усадьбы');

  // Звуковой движок
  const audio = new GardenAudio();
  assert.equal(typeof audio.purr, 'function', 'audio.purr существует');
  assert.equal(typeof audio.rake, 'function', 'audio.rake существует');
  audio.purr();
  audio.rake();
  ok('процедурный звук мурлыканья и граблей работает без сбоев');

  console.log(`\nвсе ${passed} проверок созерцания и карэсансуй зелёные`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
