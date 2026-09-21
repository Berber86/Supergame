/** Деревья в полевом дневнике: те же отрисовщики, что в саду, без записи в мир. */
import { drawObject, setSkipShadows } from '../render/sprites';
import type { Ctx } from '../render/paint';
import type { Atmosphere } from '../world/palette';
import { PINE_FORMS, PINE_FORM_NAMES, PINE_STAGES, pineProfile } from '../world/pine';

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
      { label: 'Рост', value: 'Три игровых дня: 72 часа в вольном саду, 15 часов в растущем' },
      {
        label: 'Формы',
        value: 'Пять силуэтов — приземистая, стройная, склонённая ветром, зонтичная, раздвоенная',
      },
      { label: 'Хвоя', value: 'Зеленеет во все сезоны; шишки появляются у почти взрослых деревьев' },
    ],
    variants: PINE_FORMS.map((form) => PINE_FORM_NAMES[form]),
    stages: PINE_STAGES.map((stage) => ({ id: stage.id, name: stage.name, from: stage.from, to: stage.to })),
    draw(ctx, atm, growth, variant, time) {
      const seed = PINE_FORM_SEEDS[variant % PINE_FORM_SEEDS.length];
      setSkipShadows(true);
      try {
        drawObject({
          ctx: ctx as never,
          x: 0,
          y: 0,
          atm,
          g: growth,
          obj: { id: 1, type: 'pine', seed, rot: 0, tx: 0, ty: 0, planted: 0 },
          time,
          wind: 0.6,
          alpha: 1,
        });
      } finally {
        setSkipShadows(false);
      }
    },
  },
];
