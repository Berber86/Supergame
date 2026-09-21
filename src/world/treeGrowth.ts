/**
 * Общая модель роста деревьев. Каждое новое дерево сажается саженцем и
 * взрослеет за три игровых дня: сутки вольного сада идут в реальном
 * времени (72 часа), а в растущем саду игровой день короче — три дня
 * укладываются в 15 часов. Деревья из старых сохранений и пресетов
 * поля «саженец» не имеют и навсегда остаются в своём выросшем виде.
 */
import { DAY_MS } from '../core/clock';
import { GROW_DAY_MS } from '../core/growClock';
import { clamp01 } from '../core/rng';

/** Игровых дней от саженца до взрослого дерева. */
export const TREE_GROW_DAYS = 3;
/** Срок роста в вольном саду, мс реального времени. */
export const TREE_GROW_MS_FREE = TREE_GROW_DAYS * DAY_MS;
/** Срок роста в растущем саду, мс реального времени. */
export const TREE_GROW_MS_GROWING = TREE_GROW_DAYS * GROW_DAY_MS;

/** Стадия роста 0..1 дерева, посаженного саженцем. Старым деревьям всегда 1. */
export function treeGrowthAt(planted: number, now: number, growingGarden: boolean): number {
  if (!Number.isFinite(planted) || !Number.isFinite(now)) return 1;
  const span = growingGarden ? TREE_GROW_MS_GROWING : TREE_GROW_MS_FREE;
  return clamp01((now - planted) / span);
}

export interface TreeStage {
  id: string;
  name: string;
  /** Границы стадии по росту 0..1. */
  from: number;
  to: number;
  /** Что видно в саду на этой ступени. */
  note: string;
}

/** Пять ступеней от саженца до взрослого лиственного дерева — те же, что в энциклопедии. */
export const TREE_GROW_STAGES: TreeStage[] = [
  {
    id: 'sprout',
    name: 'Саженец',
    from: 0,
    to: 0.2,
    note: 'Тонкий стволик и первый пучок листьев на самой макушке.',
  },
  {
    id: 'first-branches',
    name: 'Первые ветви',
    from: 0.2,
    to: 0.45,
    note: 'Ветви расходятся от ствола, на концах раскрываются первые подушечки листвы.',
  },
  {
    id: 'young-tree',
    name: 'Молодое дерево',
    from: 0.45,
    to: 0.7,
    note: 'Крона густеет ярус за ярусом, листья закрывают почти все ветви.',
  },
  {
    id: 'small-tree',
    name: 'Деревце',
    from: 0.7,
    to: 0.92,
    note: 'Ствол крепнет, ветви вытягиваются — силуэт будущей формы уже угадывается.',
  },
  {
    id: 'mature',
    name: 'Взрослое дерево',
    from: 0.92,
    to: 1,
    note: 'Полный рост и собственный характер кроны — от раскидистой до колонновидной.',
  },
];

/** Ступень роста для стадии 0..1. */
export function treeStageOf(g: number): TreeStage {
  const v = clamp01(g);
  for (const stage of TREE_GROW_STAGES) if (v < stage.to) return stage;
  return TREE_GROW_STAGES[TREE_GROW_STAGES.length - 1];
}
