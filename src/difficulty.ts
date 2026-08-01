import { assetPath } from './assets'
import type { DifficultyId } from './types'

export interface DifficultyDefinition {
  id: DifficultyId
  name: string
  subtitle: string
  description: string
  art: string
  /** Сколько авторских островов в маршруте: Сказание — 7, полный путь — 10. */
  voyageIslands: 7 | 10
  chanceModifier: number
  resourceMultiplier: number
  travelMultiplier: number
  stormModifier: number
  bossHealthMultiplier: number
  kleosMultiplier: number
  divineRescue: boolean
  /** «Гнев богов»: наём гребцов дороже — потеря людей почти необратима. */
  crewCostMultiplier: number
  /** «Гнев богов»: шанс гнева богов во время перехода. */
  divineInterference: number
  tags: string[]
}

export const difficulties: DifficultyDefinition[] = [
  {
    id: 'tale',
    name: 'Сказание',
    subtitle: 'История прежде наказания',
    description: 'Короткий путь — семь островов. Больше припасов, мягче проверки и одно вмешательство Афины, способное спасти погибающий поход.',
    art: assetPath('art/difficulty-tale.jpg'),
    voyageIslands: 7,
    chanceModifier: 0.1,
    resourceMultiplier: 1.2,
    travelMultiplier: 0.92,
    stormModifier: -0.06,
    bossHealthMultiplier: 0.72,
    kleosMultiplier: 0.72,
    divineRescue: true,
    crewCostMultiplier: 1,
    divineInterference: 0,
    tags: ['Короткий путь · 7 островов', '+10% к проверкам', '1 спасение'],
  },
  {
    id: 'odyssey',
    name: 'Одиссея',
    subtitle: 'Каноническое испытание',
    description: 'Полный путь — десять островов через оба порта и обоих стражей. Канонические проверки и честная цена каждого решения.',
    art: assetPath('art/difficulty-odyssey.jpg'),
    voyageIslands: 10,
    chanceModifier: 0.095,
    resourceMultiplier: 1.15,
    travelMultiplier: 0.62,
    stormModifier: -0.12,
    bossHealthMultiplier: 0.76,
    kleosMultiplier: 1,
    divineRescue: false,
    crewCostMultiplier: 1,
    divineInterference: 0,
    tags: ['Полный путь · 10 островов', 'Канонические проверки', '100% κλέος'],
  },
  {
    id: 'wrath',
    name: 'Гнев богов',
    subtitle: 'Для тех, кто бросает вызов морю',
    description: 'Тот же полный путь, но потеря людей почти необратима: наём гребцов вдвое дороже, а боги то и дело вмешиваются в переходы. Слава за риск значительно выше.',
    art: assetPath('art/difficulty-wrath.jpg'),
    voyageIslands: 10,
    chanceModifier: 0.07,
    resourceMultiplier: 1.08,
    travelMultiplier: 0.8,
    stormModifier: -0.07,
    bossHealthMultiplier: 0.82,
    kleosMultiplier: 1.45,
    divineRescue: false,
    crewCostMultiplier: 2,
    divineInterference: 0.12,
    tags: ['Полный путь · 10 островов', 'Наём ×2 · гнев богов', '145% κλέος'],
  },
]

export function difficultyDefinition(id: DifficultyId) {
  return difficulties.find((difficulty) => difficulty.id === id) ?? difficulties[1]
}
