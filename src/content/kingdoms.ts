/**
 * Статичный контент: королевства — цели рейдов (GDD §3.2, MLP: 3 шт.).
 * Захват всех трёх = победа в MLP («Повелитель Области»).
 */

import type { KingdomDef } from '../core/types';

export const KINGDOMS: KingdomDef[] = [
  {
    id: 'duchy-of-donuts',
    name: 'Герцогство Вялых Пончиков',
    desc: 'Пончики здесь такие вялые, что даже дракону их жалко. Почти.',
    stages: 3,
    bossHp: 50,
  },
  {
    id: 'kingdom-of-moles',
    name: 'Королевство Трёх Кротов',
    desc: 'Правит триумвират кротов. Территория — сплошные норы и кротовины.',
    stages: 4,
    bossHp: 80,
  },
  {
    id: 'county-of-kettles',
    name: 'Графство Поющих Чайников',
    desc: 'Каждый чайник поёт по нотам. Хор слышно за три королевства.',
    stages: 5,
    bossHp: 120,
  },
];
