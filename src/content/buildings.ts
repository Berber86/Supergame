/**
 * Статичный контент: здания пещеры (GDD §4, MLP: 2 здания).
 * Усиливают доход всех слуг множителем за уровень.
 */

import type { BuildingDef } from '../core/types';

export const BUILDINGS: BuildingDef[] = [
  {
    id: 'forge',
    name: 'Кузница',
    desc: 'Куёт лопаты гномам и медали «Лучший слуга месяца».',
    multiplier: 0.5,
    cost: 150,
  },
  {
    id: 'treasury',
    name: 'Казначейство',
    desc: 'Золото, лежащее аккуратно, растёт быстрее. Наука!',
    multiplier: 1.0,
    cost: 400,
  },
];
