import { describe, expect, it } from 'vitest'
import { normalizeMeta } from './campaign'
import { DEFAULT_META, createRun } from './game'
import { achievements, chronicleStats, parseBackup, unlockAchievements, voyageRecord } from './release'

describe('voyage chronicle', () => {
  it('records a completed expedition without storing the full run', () => {
    const run = createRun(6001, [], 'wrath')
    const finished = {
      ...run,
      phase: 'home' as const,
      day: 24,
      kleosEarned: 73,
      campaign: {
        ...run.campaign,
        bossesDefeated: ['scylla', 'poseidon-avatar'],
        prophecy: { ...run.campaign.prophecy, fulfilled: true },
      },
    }
    const record = voyageRecord(finished, '2026-07-31T12:00:00.000Z')

    expect(record.outcome).toBe('home')
    expect(record.difficulty).toBe('wrath')
    expect(record.bossesDefeated).toBe(2)
    expect(record.kleosEarned).toBe(73)
  })

  it('calculates stable aggregate statistics', () => {
    const meta = normalizeMeta({
      history: [
        { id: '1', finishedAt: '2026-01-01', outcome: 'home', endingId: 'hero', difficulty: 'odyssey', day: 20, nodeIndex: 11, bossesDefeated: 2, prophecyFulfilled: true, crew: 15, kleosEarned: 60 },
        { id: '2', finishedAt: '2026-01-02', outcome: 'dead', endingId: null, difficulty: 'wrath', day: 10, nodeIndex: 5, bossesDefeated: 0, prophecyFulfilled: false, crew: 0, kleosEarned: 20 },
      ],
    })
    const stats = chronicleStats(meta)

    expect(stats.finished).toBe(2)
    expect(stats.homecomings).toBe(1)
    expect(stats.deaths).toBe(1)
    expect(stats.completionRate).toBe(0.5)
    expect(stats.averageDays).toBe(15)
    expect(stats.totalKleos).toBe(80)
  })
})

describe('achievements', () => {
  it('defines unique release achievements', () => {
    expect(achievements).toHaveLength(9)
    expect(new Set(achievements.map((achievement) => achievement.id)).size).toBe(9)
  })

  it('unlocks achievements from persistent history and collections', () => {
    const meta = normalizeMeta({
      codex: Array.from({ length: 12 }, (_, index) => `entry-${index}`),
      prophecies: ['many-oars'],
      history: [
        { id: 'victory', finishedAt: '2026-01-01', outcome: 'home', endingId: 'hero', difficulty: 'wrath', day: 22, nodeIndex: 11, bossesDefeated: 2, prophecyFulfilled: true, crew: 16, kleosEarned: 80 },
      ],
    })
    const unlocked = unlockAchievements(meta)

    expect(unlocked).toContain('first-song')
    expect(unlocked).toContain('homecoming')
    expect(unlocked).toContain('godslayer')
    expect(unlocked).toContain('wrath-home')
    expect(unlocked).toContain('archivist')
  })

  it('preserves prior unlocks during evaluation', () => {
    const meta = { ...DEFAULT_META, achievements: ['first-song'] }

    expect(unlockAchievements(meta)).toContain('first-song')
  })
})

describe('safe backup parsing and release migration', () => {
  it('accepts a valid current backup', () => {
    const run = createRun(7001)
    const parsed = parseBackup(JSON.stringify({
      schema: 'odyssey-shadow-backup',
      version: 1,
      run,
      meta: DEFAULT_META,
      preferences: { textScale: 'large' },
    }))

    expect(parsed.ok).toBe(true)
  })

  it('rejects incompatible runs and malformed collections', () => {
    const wrongRun = parseBackup(JSON.stringify({ schema: 'odyssey-shadow-backup', version: 1, run: { version: 2 }, meta: {} }))
    const wrongCollections = parseBackup(JSON.stringify({ schema: 'odyssey-shadow-backup', version: 1, meta: { codex: 'not-an-array' } }))

    expect(wrongRun.ok).toBe(false)
    expect(wrongCollections.ok).toBe(false)
  })

  it('rejects invalid JSON without throwing', () => {
    expect(parseBackup('{broken').ok).toBe(false)
  })

  it('adds history and achievements to older metadata', () => {
    const migrated = normalizeMeta({ voyages: 7, endings: ['hero'] })

    expect(migrated.history).toEqual([])
    expect(migrated.achievements).toEqual([])
    expect(migrated.voyages).toBe(7)
  })
})
