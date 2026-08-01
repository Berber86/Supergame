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
  restHero,
  scoutNextRoute,
  setRationMode,
  setWatchMode,
  trainSkill,
  activateCompanionAbility,
} from './game'
import { recruitableCompanions } from './progression'

describe('hero preparation', () => {
  it('rests once per node and pays real supplies', () => {
    const run = { ...createRun(12001), resources: { ...createRun(12001).resources, health: 40 } }
    const rested = restHero(run)
    const repeated = restHero(rested)

    expect(rested.day).toBe(run.day + 1)
    expect(rested.resources.health).toBeGreaterThan(run.resources.health)
    expect(rested.resources.food).toBe(run.resources.food - 3)
    expect(repeated).toEqual(rested)
  })

  it('prepares one skill and improves the matching check', () => {
    const run = createRun(12002)
    const choice = currentEncounter(run).choices[0]
    const trained = trainSkill(run, choice.skill)

    expect(choiceChance(trained, choice) - choiceChance(run, choice)).toBeCloseTo(0.07, 5)
    expect(trained.preparation.preparedSkill).toBe(choice.skill)
    expect(trained.resources.food).toBe(run.resources.food - 2)
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
    const strict = continueVoyage(setRationMode(base, 'strict'), 'cautious')
    const generous = continueVoyage(setRationMode(base, 'generous'), 'cautious')

    expect(strict.resources.food).toBeGreaterThan(generous.resources.food)
    expect(generous.resources.morale).toBeGreaterThan(strict.resources.morale)
  })

  it('uses a companion ability only once per act', () => {
    const run = createRun(12103)
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
    const baseline = scoutNextRoute(base)
    const prepared = setWatchMode(activateCompanionAbility(withTiphys, 'tiphys'), 'storm')
    const scouted = scoutNextRoute(prepared)

    expect(scouted.preparation.scoutReport!.stormRisk).toBeLessThan(baseline.preparation.scoutReport!.stormRisk)
  })
})

describe('offerings, scouting and trade preparation', () => {
  it('pays for one offering and changes divine favor', () => {
    const run = createRun(12201)
    const offered = makeOffering(run, 'poseidon')
    const repeated = makeOffering(offered, 'athena')

    expect(offered.progression.coins).toBe(run.progression.coins - 10)
    expect(offered.campaign.gods.poseidon).toBeGreaterThan(run.campaign.gods.poseidon)
    expect(offered.preparation.activeBoons).toContain('poseidon-calm')
    expect(repeated).toEqual(offered)
  })

  it('creates a useful scout report at a real resource cost', () => {
    const run = createRun(12202)
    const scouted = scoutNextRoute(run)

    expect(scouted.day).toBe(run.day + 1)
    expect(scouted.resources.food).toBe(run.resources.food - 1)
    expect(scouted.preparation.scoutReport?.destination).toBe(run.route[1].name)
    expect(scouted.preparation.scoutReport?.stormRisk).toBeGreaterThan(0)
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
