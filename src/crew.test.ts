import { describe, expect, it } from 'vitest'
import { encounters } from './data'
import {
  RESOURCE_MAX,
  continueVoyage,
  createRun,
  currentEncounter,
  resolveChoice,
  resolveCrewCrisis,
  settleDebt,
} from './game'

describe('companion memory', () => {
  it('records a personal reaction to every encounter decision', () => {
    const run = createRun(7101)
    const choice = currentEncounter(run).choices[0]
    const result = resolveChoice(run, choice)

    expect(result.resolution?.crewReactions).toHaveLength(run.ship.companions.length)
    expect(result.ship.companions[0].memories).toHaveLength(1)
    expect(result.ship.companions[0].memories[0].choiceId).toBe(choice.id)
  })

  it('changes cohesion and mutiny risk after costly failures', () => {
    const run = createRun(7102)
    const cyclops = encounters.find((encounter) => encounter.id === 'cyclops-heir')!
    const prepared = {
      ...run,
      route: run.route.map((node, index) => index === 0 ? { ...node, encounterId: cyclops.id } : node),
      resources: { ...run.resources, morale: 10 },
    }
    const result = resolveChoice(prepared, cyclops.choices[0])

    expect(result.ship.mutinyRisk).not.toBe(run.ship.mutinyRisk)
    expect(result.ship.companions[0].loyalty).not.toBe(run.ship.companions[0].loyalty)
  })
})

describe('deferred prices', () => {
  function createDesperateResult() {
    const run = createRun(7201, [], 'tale')
    const cyclops = encounters.find((encounter) => encounter.id === 'cyclops-heir')!
    const desperate = {
      ...run,
      route: run.route.map((node, index) => index === 0 ? { ...node, encounterId: cyclops.id } : node),
      resources: { health: 1, food: 1, water: 1, morale: 1, crew: 1, hull: 1 },
    }
    return resolveChoice(desperate, cyclops.choices[0])
  }

  it('creates a real debt instead of cancelling an unaffordable cost', () => {
    const result = createDesperateResult()

    expect(result.debts).toHaveLength(1)
    expect(result.debts[0].status).toBe('pending')
    expect(result.resolution?.debtCreated?.dueDay).toBeGreaterThan(result.day)
    expect(result.ship.mutinyRisk).toBeGreaterThan(8)
  })

  it('allows a debt to be paid early', () => {
    const result = createDesperateResult()
    const debt = result.debts[0]
    const solvent = { ...result, resources: { ...RESOURCE_MAX } }
    const paid = settleDebt(solvent, debt.id)

    expect(paid.debts[0].status).toBe('paid')
    expect(paid.ship.mutinyRisk).toBeLessThan(solvent.ship.mutinyRisk)
  })

  it('collects an unpaid debt when its due day is reached', () => {
    const result = createDesperateResult()
    const sailing = { ...result, phase: 'resolution' as const, resources: { ...RESOURCE_MAX } }
    const arrived = continueVoyage(sailing, 'cautious')

    expect(arrived.day).toBeGreaterThanOrEqual(result.debts[0].dueDay)
    expect(arrived.debts[0].status).toBe('collected')
    expect(arrived.campaign.doom).toBeGreaterThan(result.campaign.doom)
  })
})

describe('crew crises and departures', () => {
  it('interrupts departure when mutiny risk becomes critical', () => {
    const run = createRun(7301)
    const unstable = {
      ...run,
      phase: 'resolution' as const,
      ship: { ...run.ship, mutinyRisk: 80, lastCrisisDay: -10 },
    }
    const crisis = continueVoyage(unstable)

    expect(crisis.phase).toBe('crew-crisis')
    expect(crisis.crewCrisis?.leaderId).toBe(run.ship.companions[0].id)

    const resolved = resolveCrewCrisis(crisis, 'council')
    expect(resolved.phase).toBe('resolution')
    expect(resolved.ship.lastCrisisDay).toBe(run.day)
  })

  it('lets an alienated companion leave at the next port', () => {
    const run = createRun(7302)
    const alienated = {
      ...run,
      nodeIndex: 2,
      phase: 'resolution' as const,
      resources: { ...RESOURCE_MAX },
      ship: {
        ...run.ship,
        companions: run.ship.companions.map((companion) => ({ ...companion, loyalty: 10 })),
      },
    }
    const port = continueVoyage(alienated, 'cautious')

    expect(port.phase).toBe('port')
    expect(port.ship.companions).toHaveLength(0)
    expect(port.ship.departedCompanions).toHaveLength(1)
  })
})
