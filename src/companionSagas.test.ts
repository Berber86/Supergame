import { describe, expect, it } from 'vitest'
import { companionStoryEpisodes, finaleForCompanion, storyEpisodeForEncounter } from './companionSagas'
import { encounters } from './encounterCatalog'
import {
  DEFAULT_META,
  companionSagaContext,
  continueVoyage,
  createRun,
  currentEncounter,
  currentIsland,
  resolveChoice,
  resolveCompanionFinale,
  resolveThreshold,
  startingNamedCompanions,
  travelPreview,
  seekCompanionStory,
} from './game'
import { authoredIslands } from './islands'
import { startingCompanion } from './progression'
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

  it('starts with two deterministic but varied named companions and targets their songs', () => {
    const pairs = new Set<string>()
    for (let seed = 1; seed <= 30; seed += 1) {
      const starters = startingNamedCompanions(seed)
      const run = createRun(seed)
      expect(starters).toHaveLength(2)
      expect(new Set(starters.map((companion) => companion.id)).size).toBe(2)
      expect(run.ship.companions.map((companion) => companion.id).sort()).toEqual(starters.map((companion) => companion.id).sort())
      const personalNodes = run.route.filter((node) => storyEpisodeForEncounter(node.encounterId))
      expect(personalNodes).toHaveLength(2)
      personalNodes.forEach((node) => expect(run.ship.companions.some((companion) => companion.id === storyEpisodeForEncounter(node.encounterId)?.companionId)).toBe(true))
      pairs.add(starters.map((companion) => companion.id).sort().join(':'))
    }
    expect(pairs.size).toBeGreaterThan(2)
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
    const companions = base.ship.companions.some((companion) => companion.id === 'eurylochus')
      ? base.ship.companions
      : [...base.ship.companions, { ...startingCompanion, memories: [] }]
    const run = {
      ...base,
      route: base.route.map((node, index) => index === 0 ? { ...node, encounterId: encounter.id } : node),
      ship: { ...base.ship, companions },
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

  it('turns a recorded stance into a different later scene and decision', () => {
    const base = createRun(1200)
    const companions = base.ship.companions.some((companion) => companion.id === 'eurylochus')
      ? base.ship.companions
      : [...base.ship.companions, { ...startingCompanion, memories: [] }]
    const prior: CompanionStoryMark = {
      companionId: 'eurylochus', episodeId: 'eurylochus-broken-oar', encounterId: 'eurylochus-broken-oar',
      chapter: 1, title: 'Весло, которое не отдали', stance: 'resentful', choiceId: 'oar-order', success: false, day: 2,
    }
    const run = {
      ...base,
      ship: { ...base.ship, companions },
      route: base.route.map((node, index) => index === 0 ? { ...node, encounterId: 'eurylochus-council' } : node),
      campaign: { ...base.campaign, knownCompanionStoryMarks: [prior] },
    }

    expect(companionSagaContext(run)?.stance).toBe('resentful')
    expect(currentEncounter(run).choices[0].title).toBe('Принять его ненависть как право')
    expect(currentIsland(run)?.introduction).toContain('упрямства человека')
  })

  it('opens and resolves a real final song before Ithaca after three chapters', () => {
    const base = createRun(1201)
    const companions = base.ship.companions.some((companion) => companion.id === 'eurylochus')
      ? base.ship.companions
      : [...base.ship.companions, { ...startingCompanion, memories: [] }]
    const heard = companionStoryEpisodes.filter((episode) => episode.companionId === 'eurylochus').map((episode, index): CompanionStoryMark => ({
      companionId: 'eurylochus', episodeId: episode.id, encounterId: episode.encounterId,
      chapter: index + 1, title: episode.title, stance: index === 2 ? 'forgiven' : 'trusted', choiceId: episode.choices ? Object.keys(episode.choices)[0] : 'none', success: true, day: index + 1,
    }))
    const atGate = {
      ...base,
      nodeIndex: base.route.length - 2,
      phase: 'resolution' as const,
      ship: { ...base.ship, companions },
      campaign: { ...base.campaign, knownCompanionStoryMarks: heard },
    }
    const threshold = continueVoyage(atGate)
    expect(threshold.thresholdPending).toBe(true)
    const afterThreshold = resolveThreshold(threshold, 'threshold-king')
    const finale = continueVoyage(afterThreshold)
    expect(finale.phase).toBe('companion-finale')
    expect(finale.companionFinale?.selectedCompanionId).toBe('eurylochus')
    const choice = finale.companionFinale?.selectedCompanionId ? currentFinalChoice(finale) : null
    expect(choice).not.toBeNull()
    const resolved = resolveCompanionFinale(finale, choice!)
    expect(resolved.campaign.completedCompanionFinales).toContain('eurylochus-homecoming')
    expect(resolved.campaign.companionStoryMarks.at(-1)).toMatchObject({ chapter: 4, companionId: 'eurylochus' })
  })

  it('exposes the exact trade-off between travel packages', () => {
    const run = createRun(1202)
    const hasty = travelPreview(run, 'hasty')!
    const standard = travelPreview(run, 'standard')!
    const cautious = travelPreview(run, 'cautious')!

    expect(hasty.days).toBeLessThanOrEqual(standard.days)
    expect(standard.days).toBeLessThanOrEqual(cautious.days)
    expect(hasty.foodCost).toBeLessThanOrEqual(standard.foodCost)
    expect(standard.foodCost).toBeLessThanOrEqual(cautious.foodCost)
    expect(hasty.stormChance).toBeGreaterThan(cautious.stormChance)
    expect(hasty.stormDamageRange[1]).toBeGreaterThan(cautious.stormDamageRange[1])
    expect(cautious.checkBonus).toBe(0.05)
    expect(hasty.checkBonus).toBe(-0.05)
  })
})

function currentFinalChoice(run: ReturnType<typeof continueVoyage>) {
  const companionId = run.companionFinale?.selectedCompanionId
  if (!companionId) return null
  return finaleForCompanion(companionId, 'forgiven').choices[0]
}
