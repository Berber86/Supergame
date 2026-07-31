import { describe, expect, it } from 'vitest'
import { encounters } from './encounterCatalog'
import { createRun, orderedEncounterChoices, resolveChoice } from './game'

describe('two visible choices and one blind path', () => {
  it('orders all three choices deterministically without repetition', () => {
    const run = createRun(9001)
    const first = orderedEncounterChoices(run)
    const second = orderedEncounterChoices(run)

    expect(first).toEqual(second)
    expect(first).toHaveLength(3)
    expect(new Set(first.map((choice) => choice.id)).size).toBe(3)
  })

  it('varies which action stays hidden for the same encounter', () => {
    const shore = encounters.find((encounter) => encounter.id === 'shore-of-ashes')!
    const hiddenIds = new Set<string>()
    for (let seed = 0; seed < 30; seed += 1) {
      const base = createRun(seed)
      const run = { ...base, route: base.route.map((node, index) => index === 0 ? { ...node, encounterId: shore.id } : node) }
      hiddenIds.add(orderedEncounterChoices(run)[2].id)
    }
    expect(hiddenIds.size).toBeGreaterThan(1)
  })

  it('commits the blind choice and creates debt when its hidden cost is unaffordable', () => {
    const base = createRun(9002, [], 'odyssey')
    const shore = encounters.find((encounter) => encounter.id === 'shore-of-ashes')!
    const run = {
      ...base,
      route: base.route.map((node, index) => index === 0 ? { ...node, encounterId: shore.id, islandId: 'erebria' } : node),
      resources: { ...base.resources, food: 1, morale: 1 },
    }
    const costlyChoice = shore.choices.find((choice) => choice.id === 'inspect-tracks')!
    const normalAttempt = resolveChoice(run, costlyChoice)
    const blindAttempt = resolveChoice(run, costlyChoice, true)

    expect(normalAttempt).toEqual(run)
    expect(blindAttempt.phase).toBe('resolution')
    expect(blindAttempt.debts).toHaveLength(1)
    expect(blindAttempt.resolution?.debtCreated?.source).toBe(costlyChoice.title)
  })
})
