import { describe, expect, it } from 'vitest'
import { companionStoryEpisodes, storyEpisodeForEncounter } from './companionSagas'
import { encounters } from './encounterCatalog'
import { DEFAULT_META, createRun, resolveChoice, seekCompanionStory } from './game'
import { authoredIslands } from './islands'
import type { CompanionStoryMark } from './types'

describe('companion saga director', () => {
  it('adds eight illustrated, consequence-bearing personal saga shores', () => {
    const sagaIslands = authoredIslands.filter((island) => island.id.includes('-') && island.scene?.includes('/art/saga-'))
    expect(sagaIslands).toHaveLength(8)
    expect(new Set(sagaIslands.map((island) => island.scene)).size).toBe(8)
    sagaIslands.forEach((island) => {
      expect(island.focusCompanionId).toBeTruthy()
      expect(island.companionHook?.length).toBeGreaterThan(90)
      expect(island.absentHook?.length).toBeGreaterThan(80)
      Object.values(island.outcomes).forEach((branch) => {
        expect(branch.success.companionImpacts?.[0].companionId).toBe(island.focusCompanionId)
        expect(branch.failure.companionImpacts?.[0].companionId).toBe(island.focusCompanionId)
      })
    })
  })

  it('keeps each fresh voyage to two personal chapters without repeating an island', () => {
    for (let seed = 1; seed <= 30; seed += 1) {
      const run = createRun(seed)
      const personalNodes = run.route.filter((node) => storyEpisodeForEncounter(node.encounterId))
      expect(personalNodes).toHaveLength(2)
      expect(new Set(personalNodes.map((node) => node.encounterId)).size).toBe(2)
    }
  })

  it('moves a companion to the next chapter on a later song', () => {
    const firstChapter = companionStoryEpisodes.find((episode) => episode.id === 'eurylochus-broken-oar')!
    const previousMark: CompanionStoryMark = {
      companionId: 'eurylochus', episodeId: firstChapter.id, encounterId: firstChapter.encounterId,
      chapter: 1, title: firstChapter.title, stance: 'trusted', choiceId: 'oar-listen', success: true, day: 4,
    }
    const meta = { ...DEFAULT_META, companionChronicles: [{ companionId: 'eurylochus' as const, episodes: [previousMark] }] }
    const route = createRun(77, [], 'odyssey', meta).route

    expect(route.some((node) => node.encounterId === 'eurylochus-council')).toBe(true)
    expect(route.some((node) => node.encounterId === 'eurylochus-broken-oar')).toBe(false)
  })

  it('records a relationship stance even when a story roll fails', () => {
    const encounter = encounters.find((entry) => entry.id === 'eurylochus-broken-oar')!
    const base = createRun(900)
    const run = {
      ...base,
      route: base.route.map((node, index) => index === 0 ? { ...node, encounterId: encounter.id } : node),
    }
    const result = resolveChoice(run, encounter.choices[0])

    expect(result.campaign.companionStoryMarks).toHaveLength(1)
    expect(result.campaign.companionStoryMarks[0]).toMatchObject({
      companionId: 'eurylochus',
      episodeId: 'eurylochus-broken-oar',
      choiceId: 'oar-listen',
    })
    expect(result.resolution?.companionStoryMark).toEqual(result.campaign.companionStoryMarks[0])
  })

  it('lets a harbour redirect a future personal shore to a chosen companion', () => {
    const base = createRun(901)
    const chapterOne: CompanionStoryMark = {
      companionId: 'eurylochus', episodeId: 'eurylochus-broken-oar', encounterId: 'eurylochus-broken-oar',
      chapter: 1, title: 'Весло, которое не отдали', stance: 'trusted', choiceId: 'oar-listen', success: true, day: 3,
    }
    const portRun = {
      ...base,
      nodeIndex: 3,
      phase: 'port' as const,
      campaign: { ...base.campaign, companionStoryMarks: [chapterOne] },
    }
    const redirected = seekCompanionStory(portRun, 'eurylochus')

    expect(redirected.campaign.storyFocus).toBe('eurylochus')
    expect(redirected.route.slice(4).some((node) => node.encounterId === 'eurylochus-council')).toBe(true)
    expect(redirected.route.filter((node) => storyEpisodeForEncounter(node.encounterId))).toHaveLength(2)
  })
})
