import { assetPath } from './assets'
import type { Encounter } from './types'

export interface VisualScene {
  src: string
  caption: string
  palette: 'sea' | 'violet' | 'gold' | 'blood'
}

export const defaultScene: VisualScene = {
  src: assetPath('art/odyssey-storm.jpg'),
  caption: 'Чёрное море не оставляет путь неизменным',
  palette: 'sea',
}

export const encounterScenes: Record<string, VisualScene> = {
  'circe-loom': {
    src: assetPath('art/event-circe.jpg'),
    caption: 'Ээя · Ткацкий станок Кирки',
    palette: 'violet',
  },
  'helios-cattle': {
    src: assetPath('art/event-helios.jpg'),
    caption: 'Тринакрия · Священное стадо Гелиоса',
    palette: 'gold',
  },
  'dead-oracle': {
    src: assetPath('art/event-underworld.jpg'),
    caption: 'Киммерийский берег · Рынок мёртвых',
    palette: 'violet',
  },
  'temple-hecate': {
    src: assetPath('art/event-underworld.jpg'),
    caption: 'Остров Псирия · Три двери Гекаты',
    palette: 'violet',
  },
  'aeolus-vault': {
    src: assetPath('art/event-aeolus.jpg'),
    caption: 'Эолийская дуга · Плавучая крепость ветров',
    palette: 'sea',
  },
  'calypso-offer': {
    src: assetPath('art/event-calypso.jpg'),
    caption: 'Огигия · Вечный берег Калипсо',
    palette: 'sea',
  },
}

export const bossScenes: Record<string, VisualScene> = {
  scylla: {
    src: assetPath('art/boss-scylla.jpg'),
    caption: 'Пролив шести пастей · Скилла',
    palette: 'blood',
  },
  'poseidon-avatar': {
    src: assetPath('art/boss-poseidon.jpg'),
    caption: 'Врата Итаки · Десница Посейдона',
    palette: 'sea',
  },
}

export const endingScenes: Record<string, VisualScene> = {
  hollow: {
    src: assetPath('art/ending-hollow.jpg'),
    caption: 'Победа, в которой некому петь',
    palette: 'blood',
  },
  hero: {
    src: assetPath('art/ending-hero.jpg'),
    caption: 'Все вёсла возвращаются домой',
    palette: 'gold',
  },
  shadow: {
    src: assetPath('art/ending-shadow.jpg'),
    caption: 'Никто входит во дворец первым',
    palette: 'violet',
  },
  divine: {
    src: assetPath('art/ending-divine.jpg'),
    caption: 'Сова расправляет крылья над Итакой',
    palette: 'gold',
  },
}

export const uiScenes = {
  accessibility: {
    src: assetPath('art/ui-hermes-guide.jpg'),
    caption: 'Гермес указывает путь каждому мореходу',
    palette: 'gold' as const,
  },
  offline: {
    src: assetPath('art/ui-offline-ithaca.jpg'),
    caption: 'Итака остаётся доступной без сети',
    palette: 'sea' as const,
  },
}

export const worldScenes = {
  port: {
    src: assetPath('art/greek-port.jpg'),
    caption: 'Гавани свободных полисов',
    palette: 'gold' as const,
  },
  voyage: defaultScene,
}

export function sceneForEncounter(encounter: Encounter) {
  return encounterScenes[encounter.id] ?? defaultScene
}
