import { describe, expect, it } from 'vitest'
import {
  assignCompanion,
  choiceChance,
  continueVoyage,
  createRun,
  currentEncounter,
  effectiveSkill,
  makeOffering,
  portOfferCost,
  setRationMode,
  setTravelMode,
  setWatchMode,
  travelPreview,
  activateCompanionAbility,
} from './game'
import { recruitableCompanions, startingCompanion } from './progression'

describe('travel packages', () => {
  it('selects a package and previews its honest costs', () => {
    const run = createRun(12001)
    const cautious = setTravelMode(run, 'cautious')
    const preview = travelPreview(cautious, 'cautious')!

    expect(cautious.preparation.travelMode).toBe('cautious')
    expect(preview.travelMode).toBe('cautious')
    expect(preview.rest).toBe(true)
    expect(preview.checkBonus).toBe(0.05)
    expect(preview.days).toBeGreaterThan(travelPreview(run, 'hasty')!.days)
  })

  it('applies rest with the cautious package and speed with the hasty one', () => {
    const base = { ...createRun(12002), phase: 'resolution' as const, resources: { ...createRun(12002).resources, health: 40 } }
    const hasty = continueVoyage(base, 'hasty')
    const standard = continueVoyage(base, 'standard')
    const cautious = continueVoyage(base, 'cautious')

    expect(hasty.day).toBeLessThanOrEqual(standard.day)
    expect(cautious.day).toBeGreaterThan(standard.day)
    expect(cautious.resources.health).toBeGreaterThan(hasty.resources.health)
    expect(cautious.resources.morale).toBeGreaterThan(hasty.resources.morale)
    expect(cautious.resources.food).toBeLessThan(hasty.resources.food)
  })

  it('shifts check odds by the package without a separate training action', () => {
    const run = createRun(12003)
    const choice = currentEncounter(run).choices[0]
    const cautious = setTravelMode(run, 'cautious')
    const hasty = setTravelMode(run, 'hasty')

    expect(choiceChance(cautious, choice) - choiceChance(run, choice)).toBeCloseTo(0.05, 5)
    expect(choiceChance(hasty, choice) - choiceChance(run, choice)).toBeCloseTo(-0.05, 5)
  })
})

describe('ship council', () => {
  it('adds the assigned companion profile to effective skill', () => {
    const base = createRun(12101)
    const tiphys = recruitableCompanions.find((companion) => companion.id === 'tiphys')!
    const run = { ...base, ship: { ...base.ship, companions: [...base.ship.companions, { ...tiphys, memories: [] }] } }
    const assigned = assignCompanion(run, tiphys.id)

    expect(effectiveSkill(assigned, 'seamanship')).toBe(effectiveSkill(run, 'seamanship') + 1)
  })

  it('makes strict rations consume less than generous rations', () => {
    const base = { ...createRun(12102), phase: 'resolution' as const }
    const strict = continueVoyage(setRationMode(base, 'strict'), 'standard')
    const generous = continueVoyage(setRationMode(base, 'generous'), 'standard')

    expect(strict.resources.food).toBeGreaterThan(generous.resources.food)
    expect(generous.resources.morale).toBeGreaterThan(strict.resources.morale)
  })

  it('uses a companion ability only once per act', () => {
    const base = createRun(12103)
    const run = base.ship.companions.some((companion) => companion.id === 'eurylochus')
      ? base
      : { ...base, ship: { ...base.ship, companions: [...base.ship.companions, { ...startingCompanion, memories: [] }] } }
    const used = activateCompanionAbility(run, 'eurylochus')
    const repeated = activateCompanionAbility(used, 'eurylochus')

    expect(used.ship.mutinyRisk).toBeLessThan(run.ship.mutinyRisk)
    expect(used.preparation.usedCompanionAbilities).toContain('1:eurylochus')
    expect(repeated).toEqual(used)
  })

  it('lets Tiphys and watch mode reduce future storm risk', () => {
    const base = createRun(12104)
    const tiphys = recruitableCompanions.find((companion) => companion.id === 'tiphys')!
    const withTiphys = { ...base, ship: { ...base.ship, companions: [...base.ship.companions, { ...tiphys, memories: [] }] } }
    const baseline = travelPreview(base, 'standard')!
    const prepared = setWatchMode(activateCompanionAbility(withTiphys, 'tiphys'), 'storm')
    const scouted = travelPreview(prepared, 'standard')!

    expect(scouted.stormChance).toBeLessThan(baseline.stormChance)
  })
})

describe('offerings and trade preparation', () => {
  it('pays for one offering and changes divine favor', () => {
    const run = createRun(12201)
    const offered = makeOffering(run, 'poseidon')
    const repeated = makeOffering(offered, 'athena')

    expect(offered.progression.coins).toBe(run.progression.coins - 10)
    expect(offered.campaign.gods.poseidon).toBeGreaterThan(run.campaign.gods.poseidon)
    expect(offered.preparation.activeBoons).toContain('poseidon-calm')
    expect(repeated).toEqual(offered)
  })

  it('shows the travel preview without spending a scouting day', () => {
    const run = createRun(12202)
    const preview = travelPreview(run, 'standard')

    expect(preview?.days).toBeGreaterThan(0)
    expect(preview?.stormChance).toBeGreaterThan(0)
    expect(run.day).toBe(1)
  })

  it('applies Sinons market discount to the displayed and charged price', () => {
    const base = createRun(12203)
    const sinon = recruitableCompanions.find((companion) => companion.id === 'sinon')!
    const run = { ...base, ship: { ...base.ship, companions: [...base.ship.companions, { ...sinon, memories: [] }] } }
    const prepared = activateCompanionAbility(run, 'sinon')

    expect(portOfferCost(prepared, 20)).toBe(15)
    expect(portOfferCost(run, 20)).toBe(20)
  })
})
