import { describe, expect, it } from 'vitest'
import { encounters } from './encounterCatalog'
import { createRun, resolveChoice } from './game'
import { authoredIslands } from './islands'
import { recruitableCompanions, startingCompanion } from './progression'

describe('companion-focused islands', () => {
  const focusedIds = ['eurylochus-council', 'tiphys-starless', 'sinon-witnesses', 'idmon-eclipse', 'oarsmen-assembly']

  it('adds five complete authored islands with unique scenes', () => {
    const islands = authoredIslands.filter((island) => focusedIds.includes(island.encounterId))
    expect(islands).toHaveLength(5)
    expect(new Set(islands.map((island) => island.scene)).size).toBe(5)
    islands.forEach((island) => {
      expect(island.introduction.length).toBeGreaterThan(350)
      expect(Object.keys(island.outcomes)).toHaveLength(3)
    })
  })

  it('gives all personal outcomes authored companion or crew mechanics', () => {
    const personal = authoredIslands.filter((island) => island.focusCompanionId)
      .filter((island) => focusedIds.includes(island.encounterId))
    personal.forEach((island) => {
      expect(island.companionHook?.length).toBeGreaterThan(80)
      expect(island.absentHook?.length).toBeGreaterThan(60)
      Object.values(island.outcomes).forEach((outcome) => {
        expect(outcome.success.companionImpacts?.some((impact) => impact.companionId === island.focusCompanionId)).toBe(true)
        expect(outcome.failure.companionImpacts?.some((impact) => impact.companionId === island.focusCompanionId)).toBe(true)
      })
    })
  })

  it('writes an authored memory into Eurylochuss state after the council', () => {
    const encounter = encounters.find((entry) => entry.id === 'eurylochus-council')!
    const choice = encounter.choices[0]
    let result: ReturnType<typeof resolveChoice> | null = null
    for (let seed = 0; seed < 100 && !result; seed += 1) {
      const base = createRun(seed)
      const companions = base.ship.companions.some((companion) => companion.id === 'eurylochus')
        ? base.ship.companions
        : [...base.ship.companions, { ...startingCompanion, memories: [] }]
      const run = { ...base, route: base.route.map((node, index) => index === 0 ? { ...node, encounterId: encounter.id } : node), ship: { ...base.ship, companions } }
      const candidate = resolveChoice(run, choice)
      if (candidate.resolution?.success) result = candidate
    }
    expect(result).not.toBeNull()
    const eurylochus = result!.ship.companions.find((companion) => companion.id === 'eurylochus')!
    expect(eurylochus.memories[0].id).toContain('authored-memory')
    expect(eurylochus.loyalty).toBeGreaterThan(68)
  })

  it('can permanently remove Sinon when his surrender succeeds', () => {
    const encounter = encounters.find((entry) => entry.id === 'sinon-witnesses')!
    const choice = encounter.choices.find((entry) => entry.id === 'sinon-surrender')!
    const sinon = recruitableCompanions.find((companion) => companion.id === 'sinon')!
    let result: ReturnType<typeof resolveChoice> | null = null
    for (let seed = 0; seed < 150 && !result; seed += 1) {
      const base = createRun(seed)
      const run = {
        ...base,
        route: base.route.map((node, index) => index === 0 ? { ...node, encounterId: encounter.id } : node),
        ship: { ...base.ship, companions: [...base.ship.companions, { ...sinon, memories: [] }] },
      }
      const candidate = resolveChoice(run, choice)
      if (candidate.resolution?.success) result = candidate
    }
    expect(result).not.toBeNull()
    expect(result!.ship.companions.some((companion) => companion.id === 'sinon')).toBe(false)
    expect(result!.ship.departedCompanions.some((companion) => companion.id === 'sinon')).toBe(true)
  })

  it('lets the full-crew assembly alter cohesion and mutiny risk directly', () => {
    const island = authoredIslands.find((entry) => entry.encounterId === 'oarsmen-assembly')!
    Object.values(island.outcomes).forEach((outcome) => {
      expect(outcome.success.cohesion ?? outcome.success.mutinyRisk).toBeDefined()
      expect(outcome.failure.cohesion ?? outcome.failure.mutinyRisk).toBeDefined()
    })
  })
})
