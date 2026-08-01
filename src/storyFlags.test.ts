import { describe, expect, it } from 'vitest'
import { encounters } from './encounterCatalog'
import { createRun, resolveChoice } from './game'
import { flagsForOutcome, storyFlagDefinitions, storyFlagModifiers } from './storyFlags'

describe('persistent story flags', () => {
  it('creates authored flags for significant outcomes and never duplicates them', () => {
    const first = flagsForOutcome('circe-loom', 'circe-moly', true, 8, [])
    expect(first).toHaveLength(1)
    expect(first[0].id).toBe('circe-counsel')
    expect(first[0].echo.length).toBeGreaterThan(40)

    const duplicate = flagsForOutcome('circe-loom', 'circe-mirror', true, 10, first)
    expect(duplicate).toEqual([])
  })

  it('stores a newly earned flag in campaign state and resolution', () => {
    const circe = encounters.find((encounter) => encounter.id === 'circe-loom')!
    const choice = circe.choices.find((entry) => entry.id === 'circe-moly')!
    let successfulResult: ReturnType<typeof resolveChoice> | null = null
    for (let seed = 0; seed < 100 && !successfulResult; seed += 1) {
      const base = createRun(seed)
      const run = { ...base, route: base.route.map((node, index) => index === 0 ? { ...node, encounterId: circe.id } : node) }
      const result = resolveChoice(run, choice)
      if (result.resolution?.success) successfulResult = result
    }
    expect(successfulResult).not.toBeNull()
    expect(successfulResult!.campaign.storyFlags.some((flag) => flag.id === 'circe-counsel')).toBe(true)
    expect(successfulResult!.resolution?.storyFlagsGained?.[0].id).toBe('circe-counsel')
  })

  it('turns remembered choices into bounded mechanical modifiers', () => {
    const flags = [
      ...flagsForOutcome('harpy-feast', 'harpy-nets', true, 4, []),
      ...flagsForOutcome('helios-cattle', 'helios-guard', false, 8, []),
      ...flagsForOutcome('amazon-trial', 'amazon-treaty', true, 11, []),
    ]
    const modifiers = storyFlagModifiers(flags)

    expect(modifiers.stormModifier).not.toBe(0)
    expect(modifiers.crisisChance).toBeGreaterThan(0)
    expect(modifiers.travelEffects.morale).toBeDefined()
    expect(Math.abs(modifiers.stormModifier)).toBeLessThanOrEqual(0.16)
  })

  it('provides descriptive content for every defined flag', () => {
    Object.values(storyFlagDefinitions).forEach((flag) => {
      expect(flag.title.length).toBeGreaterThan(5)
      expect(flag.description.length).toBeGreaterThan(30)
      expect(flag.echo.length).toBeGreaterThan(35)
    })
  })
})

describe('logical drachma economy', () => {
  it('does not reward failed outcomes with automatic money', () => {
    encounters.forEach((encounter) => encounter.choices.forEach((choice) => {
      expect(choice.failure.coins ?? 0).toBe(0)
    }))
  })

  it('keeps money unchanged when an authored outcome contains no loot', () => {
    const base = createRun(11001)
    const shore = encounters.find((encounter) => encounter.id === 'shore-of-ashes')!
    const run = {
      ...base,
      route: base.route.map((node, index) => index === 0 ? { ...node, encounterId: shore.id } : node),
    }
    const result = resolveChoice(run, shore.choices.find((choice) => choice.id === 'leave-shore')!)

    expect(result.progression.coins).toBe(run.progression.coins)
    expect(result.resolution?.coins).toBeUndefined()
  })

  it('still includes authored treasure and boss rewards', () => {
    const authoredCoinOutcomes = encounters.flatMap((encounter) => encounter.choices)
      .filter((choice) => (choice.success.coins ?? 0) > 0)
    expect(authoredCoinOutcomes.length).toBeGreaterThan(20)
  })
})
