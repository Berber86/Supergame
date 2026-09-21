/** Деревья в полевом дневнике: те же отрисовщики, что в саду, без записи в мир. */
import { drawObject, setSkipShadows } from '../render/sprites';
import type { Ctx } from '../render/paint';
import type { Atmosphere } from '../world/palette';
import { PINE_FORMS, PINE_FORM_NAMES, PINE_STAGES, pineProfile } from '../world/pine';
import { TREE_FORMS, TREE_FORM_NAMES, treeProfile, type TreeForm } from '../world/treeHabits';
import { TREE_GROW_STAGES } from '../world/treeGrowth';

export interface GuideStage {
  id: string;
  name: string;
  from: number;
  to: number;
}

export interface GuidePlant {
  id: string;
  name: string;
  latin: string;
  group: 'Деревья';
  description: string;
  habitat: string;
  scale: number;
  baseline: number;
  facts?: { label: string; value: string }[];
  variants?: string[];
  /** Ступени роста — кнопки вместо анимаций. */
  stages: GuideStage[];
  draw(ctx: Ctx, atm: Atmosphere, growth: number, variant: number, time: number): void;
}

/** По сидy на каждую из пяти форм — страница показывает всё разнообразие сосен. */
function formSeed(form: (typeof PINE_FORMS)[number]): number {
  for (let seed = 0; ; seed++) if (pineProfile(seed).form === form) return seed;
}
const PINE_FORM_SEEDS = PINE_FORMS.map(formSeed);

/** Общий срок взросления: три игровых дня от саженца. */
const GROWTH_FACT = {
  label: 'Рост',
  value: 'Три игровых дня: 72 часа в вольном саду, 15 часов в растущем',
};
/** Пока дерево мало, звери к нему не приходят. */
const SAPLING_HABITAT =
  'Растёт на любой сухой земле. Пока деревце мало, оно не дом для белки и не насест для совы — гости приходят к взрослым деревьям.';
/** Ступени роста лиственных деревьев — те же, что в модели роста. */
const LEAFY_STAGES: GuideStage[] = TREE_GROW_STAGES.map((stage) => ({
  id: stage.id,
  name: stage.name,
  from: stage.from,
  to: stage.to,
}));

/** Отрисовщик страницы: тот же спрайт, что в саду, без теней и без мира. */
function treeDrawer(type: string, seeds: number[]) {
  return (ctx: Ctx, atm: Atmosphere, growth: number, variant: number, time: number) => {
    const seed = seeds[variant % seeds.length];
    setSkipShadows(true);
    try {
      drawObject({
        ctx: ctx as never,
        x: 0,
        y: 0,
        atm,
        g: growth,
        obj: { id: 1, type, seed, rot: 0, tx: 0, ty: 0, planted: 0 },
        time,
        wind: 0.6,
        alpha: 1,
      });
    } finally {
      setSkipShadows(false);
    }
  };
}

/** Сид для нужной формы лиственного дерева — страница показывает все четыре облика. */
function leafyFormSeed(type: string, form: TreeForm): number {
  for (let seed = 0; seed < 100000; seed++) if (treeProfile(type, seed)?.form === form) return seed;
  return 0;
}

/** Страница лиственного дерева: четыре формы, общий путь саженца. */
function leafyTree(
  id: string,
  name: string,
  latin: string,
  description: string,
  facts: { label: string; value: string }[],
): GuidePlant {
  const seeds = TREE_FORMS.map((form) => leafyFormSeed(id, form));
  return {
    id,
    name,
    latin,
    group: 'Деревья',
    scale: 1,
    baseline: 0.88,
    description,
    habitat: SAPLING_HABITAT,
    facts: [GROWTH_FACT, ...facts],
    variants: TREE_FORMS.map((form) => TREE_FORM_NAMES[form]),
    stages: LEAFY_STAGES,
    draw: treeDrawer(id, seeds),
  };
}

/** Страница дерева с семенными обликами: три варианта, общий путь саженца. */
function seededTree(
  id: string,
  name: string,
  latin: string,
  description: string,
  facts: { label: string; value: string }[],
): GuidePlant {
  return {
    id,
    name,
    latin,
    group: 'Деревья',
    scale: 1,
    baseline: 0.88,
    description,
    habitat: SAPLING_HABITAT,
    facts: [GROWTH_FACT, ...facts],
    variants: ['Облик 1', 'Облик 2', 'Облик 3'],
    stages: LEAFY_STAGES,
    draw: treeDrawer(id, [7, 42, 91]),
  };
}

export const GUIDE_TREES: GuidePlant[] = [
  {
    id: 'pine',
    name: 'Сосна',
    latin: 'Pinus',
    group: 'Деревья',
    scale: 1,
    baseline: 0.88,
    description:
      'Вечнозелёная хранительница сада. Новая сосна приходит тонким саженцем с пучками мягких иголок и за три игровых дня вырастает до своего силуэта: сперва нижние ярусы ветвей, потом верхушка, и лишь в конце — развилки и широкие лапы хвои. Старые деревья остаются в своём выросшем виде: саженцами сажаются только новые.',
    habitat:
      'Растёт на любой сухой земле. Пока сосна мала, она не дом для белки и не насест для совы — гости приходят к взрослым деревьям.',
    facts: [
      GROWTH_FACT,
      {
        label: 'Формы',
        value: 'Пять силуэтов — приземистая, стройная, склонённая ветром, зонтичная, раздвоенная',
      },
      { label: 'Хвоя', value: 'Зеленеет во все сезоны; шишки появляются у почти взрослых деревьев' },
    ],
    variants: PINE_FORMS.map((form) => PINE_FORM_NAMES[form]),
    stages: PINE_STAGES.map((stage) => ({ id: stage.id, name: stage.name, from: stage.from, to: stage.to })),
    draw: treeDrawer('pine', PINE_FORM_SEEDS),
  },
  leafyTree(
    'sakura',
    'Сакура',
    'Prunus serrulata',
    'Весна в саду начинается с неё. Саженец сакуры сперва растит тонкий стволик и пучок листьев на макушке; крона раскрывается сверху вниз, и к третьему игровому дню дерево стоит в полный рост. Зацветает сакура уже взрослой — розовое облако приходит по сезонам, а не по возрасту.',
    [
      { label: 'Формы', value: 'Четыре облика — раскидистое, колонновидное, низкое, наклонное' },
      { label: 'Цветение', value: 'Розовые цветы по всей кроне; у молодых деревцев цветения ещё нет' },
    ],
  ),
  leafyTree(
    'maple',
    'Клён',
    'Acer',
    'Главный цвет осени. Кленовый саженец поднимается тонкой веточкой, листва набирается ярус за ярусом, и за три игровых дня деревце выходит на свой силуэт. В дуплах старых клёнов гнездятся птицы, но дупло появляется лишь у почти взрослого дерева.',
    [
      { label: 'Формы', value: 'Четыре облика — раскидистое, колонновидное, низкое, наклонное' },
      { label: 'Осень', value: 'Крона вспыхивает красным; в дупле взрослого клёна живёт гнездо' },
    ],
  ),
  leafyTree(
    'ginkgo',
    'Гинкго',
    'Ginkgo biloba',
    'Живое ископаемое с веерными листьями. Саженец гинкго вытягивается ровным прутиком, и крона нарастает сверху вниз узкими ярусами; взрослое дерево держит стройный колонновидный или раскидистый силуэт. Осенью веера становятся золотыми и осыпаются почти разом.',
    [
      { label: 'Формы', value: 'Четыре облика — раскидистое, колонновидное, низкое, наклонное' },
      { label: 'Лист', value: 'Веерный; осенью золотеет и падает быстро, почти за одну ночь' },
    ],
  ),
  leafyTree(
    'willow',
    'Ива',
    'Salix',
    'Дерево у воды с длинными свисающими серёжками. Ива-саженец сперва кажется обычной тонкой веткой; потом крона раскрывается, и с ветвей вниз спускаются живые пряди — чем взрослее дерево, тем длиннее занавес. Ветви ивы гнутся под ветром сильнее всех в саду.',
    [
      { label: 'Формы', value: 'Четыре облика — раскидистое, колонновидное, низкое, наклонное' },
      { label: 'Серёжки', value: 'Свисающие пряди растут вместе с кроной; ветер колышет их даже в тихий день' },
    ],
  ),
  leafyTree(
    'persimmon',
    'Хурма',
    'Diospyros kaki',
    'Осенью, когда листва облетает, на голых ветках загораются оранжевые фонарики. Саженец хурмы растёт как все: тонкий стволик, крона сверху вниз, три игровых дня до полного роста. Плоды завязываются только у почти взрослого дерева.',
    [
      { label: 'Формы', value: 'Четыре облика — раскидистое, колонновидное, низкое, наклонное' },
      { label: 'Плоды', value: 'Оранжевые, держатся на голых ветках до глубокой осени' },
    ],
  ),
  seededTree(
    'ume',
    'Умэ',
    'Prunus mume',
    'Японская слива зацветает раньше всех — ещё по холоду, когда сад только просыпается. Саженец умэ поднимается кривым стволиком и за три игровых дня выходит на свой корявый взрослый силуэт. Цветы и плоды приходят по сезону к взрослым деревьям; летом в кроне поспевают круглые сливы.',
    [
      { label: 'Цветение', value: 'Самое раннее в саду, белые и розовые цветы по голым ветвям' },
      { label: 'Плоды', value: 'Круглые сливы на длинных черешках; падают, когда поспеют' },
    ],
  ),
  seededTree(
    'nashi',
    'Груша-наси',
    'Pyrus pyrifolia',
    'Японская груша с широкой низкой кроной, будто распластанной над землёй. Саженец наси растёт быстро и за три игровых дня раскрывает свою горизонтальную крону. Осенью на ветвях висят круглые румяные груши — спелые срываются и падают в траву.',
    [
      { label: 'Крона', value: 'Широкая и низкая, ветви почти параллельны земле' },
      { label: 'Плоды', value: 'Круглые груши; спелые падают сами' },
    ],
  ),
  seededTree(
    'peach',
    'Персик',
    'Prunus persica',
    'Персик цветёт до листьев — розовым по голым веткам, а потом крона одевается узкой перистой листвой. Саженец растит сперва стволик и верхушку, за три игровых дня выходя на свой вазообразный силуэт. Плоды зреют к лету у взрослых деревьев.',
    [
      { label: 'Крона', value: 'Вазообразная, из двух расходящихся от ствола ветвей' },
      { label: 'Плоды', value: 'Румяные персики; дерево цветёт до распускания листьев' },
    ],
  ),
  seededTree(
    'yuzu',
    'Юдзу',
    'Citrus junos',
    'Вечнозелёный цитрус с тёмной глянцевой листвой. Саженец юдзу — плотный кустик, который за три игровых дня вырастает в деревце с округлой кроной. К зиме на ветвях остаются жёлтые плоды; они держатся даже под снегом.',
    [
      { label: 'Листва', value: 'Вечнозелёная, не меняется по сезонам' },
      { label: 'Плоды', value: 'Жёлтые цитрусы; держатся на ветвях до зимы' },
    ],
  ),
  seededTree(
    'bamboo',
    'Бамбук',
    'Phyllostachys',
    'Стройные стебли с кольцами и тонкой листвой на отводках. Молодой бамбук выходит из земли одним стеблем и по мере роста добавляет новые — у взрослого их от двух до четырёх, и каждый сперва вытягивается на треть высоты. Качается на ветру сильнее всех деревьев сада.',
    [
      { label: 'Стебли', value: 'От двух до четырёх у взрослого; новые добавляются по мере роста' },
      { label: 'Ветер', value: 'Гнётся и шелестит даже в лёгкий бриз' },
    ],
  ),
  seededTree(
    'wisteria',
    'Глициния',
    'Wisteria floribunda',
    'Лиана на перголе. Молодая глициния сперва взбирается по опорам, дотягивается до перекладины — и только потом распускает листовые подушки и вешает длинные фиолетовые кисти. Кисти приходят во второй половине роста; взрослая глициния цветёт по сезону.',
    [
      { label: 'Лоза', value: 'Сперва взбирается по опорам, затем крона и кисти' },
      { label: 'Кисти', value: 'Длинные фиолетовые соцветия свисают с перекладины' },
    ],
  ),
];
