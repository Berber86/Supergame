import type { MetaState, RunState, UiPreferences, VoyageRecord } from './types'

export interface BackupPayload {
  schema: 'odyssey-shadow-backup'
  version: 1
  exportedAt?: string
  run?: RunState | null
  meta: Partial<MetaState>
  preferences?: Partial<UiPreferences>
}

export type BackupParseResult =
  | { ok: true; payload: BackupPayload }
  | { ok: false; message: string }

export function parseBackup(text: string): BackupParseResult {
  try {
    const value = JSON.parse(text) as unknown
    if (!value || typeof value !== 'object') return { ok: false, message: 'Корневой объект резервной копии повреждён.' }
    const candidate = value as Record<string, unknown>
    if (candidate.schema !== 'odyssey-shadow-backup' || candidate.version !== 1) {
      return { ok: false, message: 'Файл не является резервной копией «Пути теней».' }
    }
    if (!candidate.meta || typeof candidate.meta !== 'object' || Array.isArray(candidate.meta)) {
      return { ok: false, message: 'В резервной копии отсутствует метапрогрессия.' }
    }
    const meta = candidate.meta as Record<string, unknown>
    const arrayFields = ['legacy', 'endings', 'prophecies', 'codex', 'history', 'achievements']
    if (arrayFields.some((field) => meta[field] !== undefined && !Array.isArray(meta[field]))) {
      return { ok: false, message: 'Коллекции резервной копии имеют неверный формат.' }
    }
    if (candidate.run !== undefined && candidate.run !== null) {
      if (typeof candidate.run !== 'object' || Array.isArray(candidate.run) || (candidate.run as Record<string, unknown>).version !== 4) {
        return { ok: false, message: 'Экспедиция создана несовместимой версией игры.' }
      }
    }
    return { ok: true, payload: candidate as unknown as BackupPayload }
  } catch {
    return { ok: false, message: 'Не удалось прочитать JSON-файл резервной копии.' }
  }
}

export interface AchievementDefinition {
  id: string
  title: string
  description: string
  symbol: string
  hidden?: boolean
  test: (meta: MetaState) => boolean
}

export const achievements: AchievementDefinition[] = [
  {
    id: 'first-song',
    title: 'Первая песнь',
    description: 'Завершить первую экспедицию — победой или гибелью.',
    symbol: 'Ⅰ',
    test: (meta) => meta.history.length >= 1,
  },
  {
    id: 'homecoming',
    title: 'Дым Итаки',
    description: 'Впервые вернуться домой.',
    symbol: '⌂',
    test: (meta) => meta.history.some((voyage) => voyage.outcome === 'home'),
  },
  {
    id: 'godslayer',
    title: 'Смертный против мифа',
    description: 'Одолеть обоих стражей в одной экспедиции.',
    symbol: 'Ψ',
    test: (meta) => meta.history.some((voyage) => voyage.bossesDefeated >= 2),
  },
  {
    id: 'many-oars-home',
    title: 'Все вёсла дома',
    description: 'Вернуться на Итаку с четырнадцатью членами команды.',
    symbol: '≋',
    test: (meta) => meta.history.some((voyage) => voyage.outcome === 'home' && voyage.crew >= 14),
  },
  {
    id: 'prophecy-kept',
    title: 'Слово Тиресия',
    description: 'Исполнить личное пророчество.',
    symbol: '◉',
    test: (meta) => meta.prophecies.length >= 1,
  },
  {
    id: 'archivist',
    title: 'Память моря',
    description: 'Открыть двенадцать записей кодекса.',
    symbol: 'Ξ',
    test: (meta) => meta.codex.length >= 12,
  },
  {
    id: 'wrath-home',
    title: 'Сломанный трезубец',
    description: 'Вернуться домой в режиме «Гнев богов».',
    symbol: '⚡',
    test: (meta) => meta.history.some((voyage) => voyage.outcome === 'home' && voyage.difficulty === 'wrath'),
  },
  {
    id: 'four-fates',
    title: 'Четыре лица царя',
    description: 'Открыть все четыре концовки.',
    symbol: 'Ⅳ',
    hidden: true,
    test: (meta) => meta.endings.length >= 4,
  },
  {
    id: 'legend-complete',
    title: 'Наследие без конца',
    description: 'Открыть все постоянные дары.',
    symbol: 'Ω',
    hidden: true,
    test: (meta) => meta.legacy.length >= 8,
  },
]

export function voyageRecord(run: RunState, finishedAt = new Date().toISOString()): VoyageRecord {
  return {
    id: `${run.seed}-${run.phase}`,
    finishedAt,
    outcome: run.phase === 'home' ? 'home' : 'dead',
    endingId: run.campaign.ending?.id ?? null,
    difficulty: run.difficulty,
    day: run.day,
    nodeIndex: run.nodeIndex,
    bossesDefeated: run.campaign.bossesDefeated.length,
    prophecyFulfilled: run.campaign.prophecy.fulfilled,
    crew: run.resources.crew,
    kleosEarned: run.kleosEarned,
  }
}

export function unlockAchievements(meta: MetaState) {
  const unlocked = achievements.filter((achievement) => achievement.test(meta)).map((achievement) => achievement.id)
  return [...new Set([...meta.achievements, ...unlocked])]
}

export function chronicleStats(meta: MetaState) {
  const finished = meta.history.length
  const homecomings = meta.history.filter((voyage) => voyage.outcome === 'home').length
  const deaths = finished - homecomings
  const totalDays = meta.history.reduce((sum, voyage) => sum + voyage.day, 0)
  const totalKleos = meta.history.reduce((sum, voyage) => sum + voyage.kleosEarned, 0)
  const difficultyCounts = meta.history.reduce<Record<string, number>>((counts, voyage) => {
    counts[voyage.difficulty] = (counts[voyage.difficulty] ?? 0) + 1
    return counts
  }, {})
  const favoriteDifficulty = Object.entries(difficultyCounts).sort((left, right) => right[1] - left[1])[0]?.[0] ?? 'odyssey'
  return {
    finished,
    homecomings,
    deaths,
    completionRate: finished ? homecomings / finished : 0,
    averageDays: finished ? totalDays / finished : 0,
    totalKleos,
    favoriteDifficulty,
  }
}
