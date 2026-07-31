import type { DifficultyId } from './types'

export interface DifficultyDefinition {
  id: DifficultyId
  name: string
  subtitle: string
  description: string
  art: string
  chanceModifier: number
  resourceMultiplier: number
  travelMultiplier: number
  stormModifier: number
  bossHealthMultiplier: number
  kleosMultiplier: number
  divineRescue: boolean
  tags: string[]
}

export const difficulties: DifficultyDefinition[] = [
  {
    id: 'tale',
    name: 'Сказание',
    subtitle: 'История прежде наказания',
    description: 'Больше припасов, мягче проверки и одно вмешательство Афины, способное спасти погибающий поход.',
    art: '/art/difficulty-tale.jpg',
    chanceModifier: 0.09,
    resourceMultiplier: 1.18,
    travelMultiplier: 0.78,
    stormModifier: -0.13,
    bossHealthMultiplier: 0.82,
    kleosMultiplier: 0.72,
    divineRescue: true,
    tags: ['+9% к проверкам', 'Легче выживание', '1 спасение'],
  },
  {
    id: 'odyssey',
    name: 'Одиссея',
    subtitle: 'Каноническое испытание',
    description: 'Исходный баланс сурового путешествия. Ресурсы, боги и ошибки одинаково важны.',
    art: '/art/difficulty-odyssey.jpg',
    chanceModifier: 0,
    resourceMultiplier: 1,
    travelMultiplier: 1,
    stormModifier: 0,
    bossHealthMultiplier: 1,
    kleosMultiplier: 1,
    divineRescue: false,
    tags: ['Стандартный баланс', 'Без поблажек', '100% κλέος'],
  },
  {
    id: 'wrath',
    name: 'Гнев богов',
    subtitle: 'Для тех, кто бросает вызов морю',
    description: 'Меньше припасов, сильнее стражи, чаще штормы и более жестокие проверки. Слава за риск значительно выше.',
    art: '/art/difficulty-wrath.jpg',
    chanceModifier: -0.065,
    resourceMultiplier: 0.84,
    travelMultiplier: 1.22,
    stormModifier: 0.14,
    bossHealthMultiplier: 1.24,
    kleosMultiplier: 1.45,
    divineRescue: false,
    tags: ['−6.5% к проверкам', '+24% стойкости боссов', '145% κλέος'],
  },
]

export function difficultyDefinition(id: DifficultyId) {
  return difficulties.find((difficulty) => difficulty.id === id) ?? difficulties[1]
}
