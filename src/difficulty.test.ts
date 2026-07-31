import { describe, expect, it } from 'vitest'
import { encounters } from './data'
import { difficulties } from './difficulty'
import {
  RESOURCE_MAX,
  bossActionChance,
  choiceChance,
  continueVoyage,
  createRun,
  currentBossDefinition,
  currentEncounter,
  resolveBossAction,
  resolveChoice,
} from './game'

describe('difficulty modes', () => {
  it('provide three distinct generated visual identities', () => {
    expect(difficulties.map((difficulty) => difficulty.id)).toEqual(['tale', 'odyssey', 'wrath'])
    expect(new Set(difficulties.map((difficulty) => difficulty.art)).size).toBe(3)
    difficulties.forEach((difficulty) => expect(difficulty.art).toMatch(/^\/art\/difficulty-.+\.jpg$/))
  })

  it('scale starting survival resources in the expected order', () => {
    const tale = createRun(1001, [], 'tale')
    const odyssey = createRun(1001, [], 'odyssey')
    const wrath = createRun(1001, [], 'wrath')

    expect(tale.resources.food).toBeGreaterThan(odyssey.resources.food)
    expect(odyssey.resources.food).toBeGreaterThan(wrath.resources.food)
    expect(tale.resources.crew).toBeGreaterThan(wrath.resources.crew)
  })

  it('changes the chance of the same decision', () => {
    const tale = createRun(1002, [], 'tale')
    const odyssey = createRun(1002, [], 'odyssey')
    const wrath = createRun(1002, [], 'wrath')
    const choice = currentEncounter(odyssey).choices[0]

    expect(choiceChance(tale, choice)).toBeGreaterThan(choiceChance(odyssey, choice))
    expect(choiceChance(odyssey, choice)).toBeGreaterThan(choiceChance(wrath, choice))
  })

  it('scales guardian health and action chances', () => {
    const enterBoss = (mode: 'tale' | 'odyssey' | 'wrath') => {
      const run = createRun(1003, [], mode)
      return continueVoyage({ ...run, nodeIndex: 4, phase: 'resolution', resources: { ...RESOURCE_MAX } }, 'cautious')
    }
    const tale = enterBoss('tale')
    const odyssey = enterBoss('odyssey')
    const wrath = enterBoss('wrath')
    const action = currentBossDefinition(odyssey).actions[0]

    expect(tale.boss!.maxHealth).toBeLessThan(odyssey.boss!.maxHealth)
    expect(odyssey.boss!.maxHealth).toBeLessThan(wrath.boss!.maxHealth)
    expect(bossActionChance(tale, action)).toBeGreaterThan(bossActionChance(wrath, action))
  })

  it('allows Athena to rescue a tale voyage exactly once', () => {
    const tale = createRun(1004, [], 'tale')
    const starving = {
      ...tale,
      phase: 'resolution' as const,
      resources: { health: 20, food: 1, water: 1, morale: 20, crew: 2, hull: 20 },
    }
    const rescued = continueVoyage(starving, 'cautious')

    expect(rescued.phase).not.toBe('dead')
    expect(rescued.divineRescueUsed).toBe(true)
    expect(rescued.resources.food).toBeGreaterThan(0)

    const doomedAgain = continueVoyage({ ...rescued, phase: 'resolution', resources: { ...rescued.resources, food: 1, water: 1 } }, 'cautious')
    expect(doomedAgain.phase).toBe('dead')
  })
})

describe('anti-softlock guarantees', () => {
  it('places a port before each guardian on many generated routes', () => {
    for (let seed = 0; seed < 100; seed += 1) {
      const route = createRun(seed).route
      const ports = route.map((node, index) => node.kind === 'port' ? index : -1).filter((index) => index >= 0)
      const guardians = route.map((node, index) => node.kind === 'boss' ? index : -1).filter((index) => index >= 0)

      expect(ports).toHaveLength(2)
      expect(guardians).toHaveLength(2)
      expect(ports[0]).toBeLessThan(guardians[0])
      expect(ports[1]).toBeLessThan(guardians[1])
    }
  })

  it('permits a desperate encounter choice when every price is unaffordable', () => {
    const run = createRun(2001, [], 'tale')
    const cyclops = encounters.find((encounter) => encounter.id === 'cyclops-heir')!
    const desperateRun = {
      ...run,
      route: run.route.map((node, index) => index === 0 ? { ...node, encounterId: cyclops.id } : node),
      resources: { health: 1, food: 1, water: 1, morale: 1, crew: 1, hull: 1 },
    }
    const result = resolveChoice(desperateRun, cyclops.choices[0])

    expect(result).not.toEqual(desperateRun)
    expect(result.phase).not.toBe('encounter')
  })

  it('permits a desperate boss action when every action price is unaffordable', () => {
    const base = createRun(2002, [], 'tale')
    const definition = currentBossDefinition({ ...base, nodeIndex: 5 })
    const bossRun = {
      ...base,
      nodeIndex: 5,
      phase: 'boss' as const,
      resources: { health: 1, food: 1, water: 1, morale: 1, crew: 1, hull: 1 },
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
    const result = resolveBossAction(bossRun, definition.actions[0])

    expect(result.boss?.turn).toBe(2)
    expect(result.divineRescueUsed).toBe(true)
  })
})
