/**
 * Статичный контент: слуги пещеры (GDD §4, MLP: 3 слуги).
 * Тон — яркий мультяшный, юмористические описания.
 */

import type { ServantDef } from '../core/types';

export const SERVANTS: ServantDef[] = [
  {
    id: 'gnome-prospector',
    name: 'Гном-золотоискатель',
    desc: 'Роет, копает и иногда находит золото. Живёт на минералке и руде.',
    baseIncome: 0.05,
    cost: 15,
  },
  {
    id: 'kobold-accountant',
    name: 'Кобольд-счетовод',
    desc: 'Считает монеты трижды: для себя, для дракона и для налоговой.',
    baseIncome: 0.2,
    cost: 60,
  },
  {
    id: 'harpy-courier',
    name: 'Гарпия-курьер',
    desc: 'Разносит золото по сундукам и сплетни по пещере. Доставка молниеносная.',
    baseIncome: 0.6,
    cost: 200,
  },
];
