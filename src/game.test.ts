import { describe, expect, it } from 'vitest'
import {
  DEFAULT_META,
  RESOURCE_MAX,
  applyEffects,
  bossActionChance,
  buyPortOffer,
  canAfford,
  continueVoyage,
  createRun,
  currentBossDefinition,
  currentEncounter,
  effectiveSkill,
  generateWorld,
  getPortStock,
  purchaseLegacy,
  resolveBossAction,
  resolveChoice,
  resolveCrewCrisis,
  upgradeSkill,
} from './game'

describe('procedural world and voyage', () => {
  it('builds the same large world and route from the same seed', () => {
    const first = createRun(20260731)
    const second = createRun(20260731)

    expect(first.world).toEqual(second.world)
    expect(first.route).toEqual(second.route)
    expect(first.world).toHaveLength(187)
    expect(first.route).toHaveLength(12)
    expect(first.route.at(-1)?.name).toBe('Итака')
    expect(first.route.filter((node) => node.kind === 'port')).toHaveLength(2)
    expect(new Set(first.route.filter((node) => node.encounterId).map((node) => node.encounterId)).size).toBe(7)
    expect(first.route.filter((node) => node.kind === 'boss').map((node) => node.bossId)).toEqual(['scylla', 'poseidon-avatar'])
  })

  it('changes world and route details when the seed changes', () => {
    const first = createRun(41)
    const second = createRun(42)

    expect(first.world.slice(0, 5)).not.toEqual(second.world.slice(0, 5))
    expect(first.route.map((node) => node.encounterId)).not.toEqual(
      second.route.map((node) => node.encounterId),
    )
  })

  it('can generate a smaller deterministic world for previews', () => {
    expect(generateWorld(55, 12)).toHaveLength(12)
    expect(generateWorld(55, 12)).toEqual(generateWorld(55, 12))
  })

  it('supports a complete route through encounters and both ports', () => {
    let run = createRun(8128)
    let sawPort = false
    let turns = 0

    while (run.phase !== 'home' && turns < 80) {
      run = { ...run, resources: { ...RESOURCE_MAX } }
      if (run.phase === 'encounter') {
        const choice = currentEncounter(run).choices.find((entry) => canAfford(run.resources, entry.cost))!
        run = resolveChoice(run, choice)
      } else if (run.phase === 'boss') {
        const definition = currentBossDefinition(run)
        const action = [...definition.actions]
          .filter((entry) => canAfford(run.resources, entry.cost))
          .sort((left, right) => bossActionChance(run, right) - bossActionChance(run, left))[0]
        run = resolveBossAction(run, action)
      } else if (run.phase === 'crew-crisis') {
        run = resolveCrewCrisis(run, 'council')
      } else if (run.phase === 'resolution' || run.phase === 'port') {
        if (run.phase === 'port') sawPort = true
        run = continueVoyage(run, turns % 2 === 0 ? 'bold' : 'cautious')
      } else {
        throw new Error(`Unexpected terminal phase: ${run.phase}`)
      }
      turns += 1
    }

    expect(sawPort).toBe(true)
    expect(run.phase).toBe('home')
    expect(run.nodeIndex).toBe(run.route.length - 1)
    expect(run.campaign.bossesDefeated).toHaveLength(2)
    expect(run.campaign.ending).not.toBeNull()
    expect(run.kleosEarned).toBeGreaterThan(50)
  })
})

describe('resources and choices', () => {
  it('clamps resource effects to their limits', () => {
    const resources = createRun(1).resources
    const result = applyEffects(resources, { health: 50, food: -999, morale: 100 })

    expect(result.health).toBe(RESOURCE_MAX.health)
    expect(result.food).toBe(0)
    expect(result.morale).toBe(RESOURCE_MAX.morale)
  })

  it('does not allow a cost that would consume the last resource', () => {
    const resources = { ...createRun(1).resources, water: 4 }

    expect(canAfford(resources, { water: -4 })).toBe(false)
    expect(canAfford(resources, { water: -3 })).toBe(true)
  })

  it('resolves the same choice deterministically and grants progression', () => {
    const firstRun = createRun(7331)
    const secondRun = createRun(7331)
    const firstChoice = currentEncounter(firstRun).choices[0]
    const secondChoice = currentEncounter(secondRun).choices[0]
    const firstResult = resolveChoice(firstRun, firstChoice)

    expect(firstResult).toEqual(resolveChoice(secondRun, secondChoice))
    expect(firstResult.progression.xp).toBeGreaterThan(0)
    expect(firstResult.progression.coins).toBe(firstRun.progression.coins + (firstResult.resolution?.coins ?? 0))
  })

  it('advances to the next encounter and applies biome travel attrition', () => {
    const run = createRun(9182)
    const resolved = resolveChoice(run, currentEncounter(run).choices[0])
    expect(resolved.phase).toBe('resolution')

    const next = continueVoyage(resolved)
    expect(next.nodeIndex).toBe(1)
    expect(next.day).toBeGreaterThan(run.day)
    expect(next.resources.food).toBeLessThanOrEqual(resolved.resources.food)
    expect(next.resources.water).toBeLessThan(resolved.resources.water)
  })
})

describe('hero and port progression', () => {
  it('spends a skill point and raises a base skill', () => {
    const run = createRun(101)
    const skilledRun = {
      ...run,
      progression: { ...run.progression, skillPoints: 1 },
    }
    const upgraded = upgradeSkill(skilledRun, 'will')

    expect(upgraded.skills.will).toBe(run.skills.will + 1)
    expect(upgraded.progression.skillPoints).toBe(0)
  })

  it('buys port services and equipment with drachmas', () => {
    const base = createRun(202)
    const portRun = {
      ...base,
      nodeIndex: 3,
      phase: 'port' as const,
      resources: { ...base.resources, food: 10 },
      progression: { ...base.progression, coins: 100 },
    }
    const supplied = buyPortOffer(portRun, 'food')
    expect(supplied.resources.food).toBeGreaterThan(portRun.resources.food)
    expect(supplied.progression.coins).toBe(90)

    const item = getPortStock(supplied).equipment[0]
    const skillBefore = effectiveSkill(supplied, item.skill)
    const equipped = buyPortOffer(supplied, item.id)
    expect(equipped.progression.inventory).toContain(item.id)
    expect(equipped.progression.equipment[item.slot]).toBe(item.id)
    expect(effectiveSkill(equipped, item.skill)).toBe(skillBefore + item.bonus)
  })

  it('applies installed ship upgrades to future state', () => {
    const base = createRun(303)
    const portRun = {
      ...base,
      nodeIndex: 3,
      phase: 'port' as const,
      progression: { ...base.progression, coins: 100 },
    }
    const upgrade = getPortStock(portRun).upgrades[0]
    const purchased = buyPortOffer(portRun, upgrade.id)

    expect(purchased.ship.upgrades).toContain(upgrade.id)
    expect(purchased.progression.coins).toBe(100 - upgrade.cost)
  })
})

describe('campaign, bosses and roguelite legacy', () => {
  it('records choices and changes divine relationships', () => {
    const run = createRun(404)
    const choice = currentEncounter(run).choices[0]
    const result = resolveChoice(run, choice)

    expect(result.campaign.decisions).toHaveLength(1)
    expect(result.campaign.decisions[0].choiceId).toBe(choice.id)
    expect(result.campaign.gods).not.toEqual(run.campaign.gods)
  })

  it('makes the cautious route slower than the bold route', () => {
    const run = createRun(505)
    const resolved = resolveChoice(run, currentEncounter(run).choices[0])
    const bold = continueVoyage(resolved, 'bold')
    const cautious = continueVoyage(resolved, 'cautious')

    expect(cautious.day).toBeGreaterThan(bold.day)
    expect(cautious.nodeIndex).toBe(bold.nodeIndex)
  })

  it('runs a multi-round boss state with readable intent', () => {
    const base = createRun(606)
    const definition = currentBossDefinition({ ...base, nodeIndex: 5 })
    const bossRun = {
      ...base,
      nodeIndex: 5,
      phase: 'boss' as const,
      resources: { ...RESOURCE_MAX },
      boss: {
        id: definition.id,
        health: definition.maxHealth,
        maxHealth: definition.maxHealth,
        turn: 1,
        stage: 1 as const,
        intentIndex: 0,
        lastResult: null,
      },
    }
    const action = definition.actions[0]
    const result = resolveBossAction(bossRun, action)

    expect(result.boss?.health).toBeLessThan(definition.maxHealth)
    expect(result.boss?.turn).toBe(2)
    expect(result.boss?.lastResult).toContain(action.title)
  })

  it('spends kleos on permanent boons that alter a new voyage', () => {
    const meta = { ...DEFAULT_META, kleos: 100 }
    const inherited = purchaseLegacy(meta, 'owl-memory')
    const run = createRun(707, inherited.legacy)

    expect(inherited.kleos).toBe(80)
    expect(inherited.legacy).toContain('owl-memory')
    expect(run.skills.cunning).toBe(6)
    expect(run.legacyBoons).toContain('owl-memory')
  })

  it('assigns a deterministic personal prophecy to each seeded song', () => {
    expect(createRun(808).campaign.prophecy).toEqual(createRun(808).campaign.prophecy)
    expect(createRun(808).campaign.prophecy.id).toBeTruthy()
  })
})
