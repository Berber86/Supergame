import { describe, expect, it } from 'vitest'
import { storyEpisodeForEncounter } from './companionSagas'
import {
  DEFAULT_META,
  RESOURCE_MAX,
  applyEffects,
  bossActionChance,
  buyPortOffer,
  canAfford,
  choiceChance,
  chooseEnding,
  continueVoyage,
  createRun,
  currentBossDefinition,
  currentEncounter,
  deathReason,
  effectiveSkill,
  generateWorld,
  getPortStock,
  purchaseLegacy,
  resolveBossAction,
  resolveChoice,
  resolveCrewCrisis,
  resolveHerald,
  resolvePrologue,
  resolveThreshold,
  rosterSafeText,
  travelPreview,
  upgradeSkill,
} from './game'
import { authoredIslandByEncounter } from './islands'
import { prologueFor, prologues } from './prologue'
import { allCompanionDefinitions } from './progression'

describe('procedural world and voyage', () => {
  it('builds the same large world and route from the same seed', () => {
    const first = createRun(20260731)
    const second = createRun(20260731)

    expect(first.world).toEqual(second.world)
    expect(first.route).toEqual(second.route)
    expect(first.world).toHaveLength(187)
    expect(first.route).toHaveLength(15)
    expect(first.route.at(-1)?.name).toBe('Итака')
    expect(first.route.filter((node) => node.kind === 'port')).toHaveLength(2)
    expect(new Set(first.route.filter((node) => node.encounterId).map((node) => node.encounterId)).size).toBe(10)
    expect(first.route.filter((node) => node.kind === 'boss').map((node) => node.bossId)).toEqual(['scylla', 'poseidon-avatar'])
  })

  it('builds a shorter voyage for the tale mode and a full one for wrath', () => {
    const tale = createRun(20260731, [], 'tale')
    const odyssey = createRun(20260731, [], 'odyssey')
    const wrath = createRun(20260731, [], 'wrath')

    expect(tale.route).toHaveLength(12)
    expect(odyssey.route).toHaveLength(15)
    expect(wrath.route).toHaveLength(15)
    expect(tale.route.filter((node) => node.encounterId).length).toBe(7)
    expect(odyssey.route.filter((node) => node.encounterId).length).toBe(10)
    expect(wrath.route.filter((node) => node.encounterId).length).toBe(10)
    expect(tale.route.filter((node) => node.kind === 'boss').map((node) => node.bossId)).toEqual(['scylla', 'poseidon-avatar'])
  })

  it('speaks with one authorial voice: the encounter title is the island name', () => {
    for (let seed = 0; seed < 20; seed += 1) {
      const run = createRun(seed, [], 'odyssey')
      run.route.forEach((node, nodeIndex) => {
        if (!node.encounterId) return
        const island = authoredIslandByEncounter.get(node.encounterId)
        const encounter = currentEncounter({ ...run, nodeIndex })
        if (storyEpisodeForEncounter(node.encounterId)) {
          // Главы спутников сохраняют название песни — это их авторский заголовок.
          expect(encounter.title).not.toBe(island?.name)
        } else {
          expect(encounter.title).toBe(island?.name)
        }
      })
    }
  })

  it('covers all six starting companion pairs with an authored prologue', () => {
    const pairs: string[][] = []
    for (let first = 0; first < allCompanionDefinitions.length; first += 1) {
      for (let second = first + 1; second < allCompanionDefinitions.length; second += 1) {
        pairs.push([allCompanionDefinitions[first].id, allCompanionDefinitions[second].id])
      }
    }
    expect(pairs).toHaveLength(6)

    pairs.forEach(([firstId, secondId]) => {
      const companions = [allCompanionDefinitions.find((entry) => entry.id === firstId)!, allCompanionDefinitions.find((entry) => entry.id === secondId)!]
      const prologue = prologueFor(companions)
      expect(prologue).toBeDefined()
      expect(prologue.text.length).toBeGreaterThan(400)
      expect(prologue.quote.length).toBeGreaterThan(20)
      expect(prologue.options).toHaveLength(3)
      prologue.options.forEach((option) => {
        expect(option.title.length).toBeGreaterThan(5)
        expect(option.description.length).toBeGreaterThan(20)
      })
    })
    // Все шесть пар описаны — ни одна комбинация не выпадает в заглушку.
    expect(Object.keys(prologues)).toHaveLength(6)
  })

  it('resolves the prologue into the first encounter with remembered effects', () => {
    const run = createRun(4242)
    expect(run.prologuePending).toBe(true)
    const resolved = resolvePrologue(run, 'troy-oath')

    expect(resolved.prologuePending).toBe(false)
    expect(resolved.phase).toBe('encounter')
    expect(resolved.resources.morale).toBe(run.resources.morale + 8)
    expect(resolved.campaign.doom).toBe(run.campaign.doom + 6)
    expect(resolved.log[0].title).toContain('Клятва')
    // Повторное разрешение невозможно.
    expect(resolvePrologue(resolved, 'troy-sails')).toEqual(resolved)
    // Неизвестный выбор не меняет состояние.
    expect(resolvePrologue(run, 'unknown')).toEqual(run)
  })

  it('replaces absent companions in authored island lines with crew members', () => {
    const run = createRun(5150)
    // Убираем всех именованных спутников, оставляя только «всегдашних» гребцов.
    const stripped = { ...run, ship: { ...run.ship, companions: [] } }
    const text = '«Ты победил не великанов, царь», — говорит Еврилох. Тифий молчит, Синон улыбается, Идмон смотрит сквозь них.'
    const safe = rosterSafeText(stripped, text)

    expect(safe).not.toContain('Еврилох')
    expect(safe).not.toContain('Тифий')
    expect(safe).not.toContain('Синон')
    expect(safe).not.toContain('Идмон')
    expect(safe).toContain('Еврибат')
    // Если спутник на борту — его имя остаётся.
    const eurylochus = allCompanionDefinitions.find((companion) => companion.name === 'Еврилох')!
    const aboard = { ...run, ship: { ...run.ship, companions: [{ ...eurylochus, memories: [] }] } }
    const kept = rosterSafeText(aboard, '«Слушаю, царь», — говорит Еврилох.')
    expect(kept).toContain('Еврилох')
    expect(rosterSafeText(run, undefined)).toBeUndefined()
  })

  it('raises the Poseidon herald scene when entering the second act', () => {
    const run = { ...createRun(6161), campaign: { ...createRun(6161).campaign, doom: 20 } }
    const atPort = { ...run, nodeIndex: 3, phase: 'port' as const, resolution: null }
    const entered = continueVoyage(atPort, 'standard')

    expect(entered.heraldPending).toBe(true)
    const appeased = resolveHerald(entered, 'herald-appease')
    expect(appeased.heraldPending).toBe(false)
    expect(appeased.campaign.gods.poseidon).toBeGreaterThan(entered.campaign.gods.poseidon)
    expect(appeased.campaign.doom).toBeLessThan(entered.campaign.doom)
    expect(resolveHerald(appeased, 'herald-defy')).toEqual(appeased)
    expect(resolveHerald(entered, 'unknown')).toEqual(entered)
  })

  it('plays the Ithaca threshold scene before the finale and homecoming', () => {
    const base = createRun(7171)
    const atGate = {
      ...base,
      nodeIndex: base.route.length - 2,
      phase: 'resolution' as const,
      campaign: {
        ...base.campaign,
        bossesDefeated: ['scylla', 'poseidon-avatar'],
        decisions: [{ id: 'd1', day: 5, encounterId: 'x', choiceId: 'y', title: 'Назвать её смертное имя', skill: 'will' as const, success: true }],
      },
    }
    const threshold = continueVoyage(atGate, 'standard')
    expect(threshold.thresholdPending).toBe(true)
    const chosen = resolveThreshold(threshold, 'threshold-king')
    expect(chosen.thresholdPending).toBe(false)
    const home = continueVoyage(chosen, 'standard')
    expect(home.phase).toBe('home')
    // Вступление концовки отсылает к прожитой истории.
    expect(home.resolution?.text).toContain('Оба стража пали')
    expect(home.resolution?.text).toContain('Назвать её смертное имя')
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
        run = continueVoyage(run, turns % 2 === 0 ? 'hasty' : 'cautious')
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

  it('makes travel packages change speed, rest and check odds', () => {
    const run = createRun(505)
    const wounded = { ...run, resources: { ...run.resources, health: 40 } }
    const resolved = resolveChoice(wounded, currentEncounter(wounded).choices[0])
    const hasty = continueVoyage(resolved, 'hasty')
    const standard = continueVoyage(resolved, 'standard')
    const cautious = continueVoyage(resolved, 'cautious')

    expect(hasty.day).toBeLessThanOrEqual(standard.day)
    expect(cautious.day).toBeGreaterThan(standard.day)
    expect(cautious.resources.health).toBeGreaterThan(hasty.resources.health)
    expect(cautious.resources.food).toBeLessThan(hasty.resources.food)
    // Пакет влияет на проверки: осторожно +5%, спешно −5%.
    expect(choiceChance({ ...resolved, preparation: { ...resolved.preparation, travelMode: 'cautious' } }, currentEncounter(resolved).choices[0]))
      .toBeGreaterThan(choiceChance(resolved, currentEncounter(resolved).choices[0]))
    expect(choiceChance({ ...resolved, preparation: { ...resolved.preparation, travelMode: 'hasty' } }, currentEncounter(resolved).choices[0]))
      .toBeLessThan(choiceChance(resolved, currentEncounter(resolved).choices[0]))
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

describe('doom as a real mechanic', () => {
  it('raises storm chances as doom grows', () => {
    const resolved = resolveChoice(createRun(12345), currentEncounter(createRun(12345)).choices[0])
    const calm = travelPreview({ ...resolved, campaign: { ...resolved.campaign, doom: 20 } }, 'standard')!
    const doomed = travelPreview({ ...resolved, campaign: { ...resolved.campaign, doom: 85 } }, 'standard')!

    expect(doomed.stormChance).toBeGreaterThan(calm.stormChance)
    expect(doomed.stormChance - calm.stormChance).toBe(12)
  })

  it('scales boss retaliation with doom', () => {
    const base = createRun(606)
    const definition = currentBossDefinition({ ...base, nodeIndex: 5 })
    const makeBossRun = (doom: number) => ({
      ...base,
      nodeIndex: 5,
      phase: 'boss' as const,
      resources: { ...RESOURCE_MAX },
      campaign: { ...base.campaign, doom },
      boss: {
        id: definition.id,
        health: definition.maxHealth,
        maxHealth: definition.maxHealth,
        turn: 1,
        stage: 1 as const,
        intentIndex: 0,
        lastResult: null,
      },
    })
    const calm = resolveBossAction(makeBossRun(20), definition.actions[0])
    const doomed = resolveBossAction(makeBossRun(85), definition.actions[0])

    // The first Scylla intent strikes morale and crew; a doomed voyage must lose more.
    expect(doomed.resources.morale).toBeLessThan(calm.resources.morale)
  })

  it('closes the divine ending when doom reaches 50', () => {
    const base = createRun(1)
    const divineReady = {
      ...base,
      resources: { ...base.resources, crew: 16, morale: 70 },
      campaign: {
        ...base.campaign,
        gods: { ...base.campaign.gods, athena: 40 },
        bossesDefeated: ['scylla', 'poseidon-avatar'],
        doom: 30,
      },
    }

    expect(chooseEnding(divineReady, true).id).toBe('divine')
    expect(chooseEnding({ ...divineReady, campaign: { ...divineReady.campaign, doom: 60 } }, true).id).toBe('hero')
  })

  it('brings doom omens during travel at high doom', () => {
    let triggered = false
    for (let seed = 0; seed < 30 && !triggered; seed += 1) {
      const run = createRun(seed)
      const resolved = resolveChoice(run, currentEncounter(run).choices[0])
      const traveled = continueVoyage({ ...resolved, campaign: { ...resolved.campaign, doom: 95 } })
      triggered = traveled.log.some((entry) => entry.text.includes('Рок настигает'))
    }

    expect(triggered).toBe(true)
  })

  it('names the exhausted resource as the death reason', () => {
    expect(deathReason({ ...RESOURCE_MAX, water: 0 })).toContain('амфора')
    expect(deathReason({ ...RESOURCE_MAX, hull: 0 })).toContain('корабль')
    expect(deathReason({ ...RESOURCE_MAX, crew: 0 })).toContain('людей')
    expect(deathReason({ ...RESOURCE_MAX })).toBeNull()
  })
})
