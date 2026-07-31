import { describe, expect, it } from 'vitest'
import { encounters } from './encounterCatalog'
import { createRun } from './game'
import { authoredIslandByEncounter, authoredIslands } from './islands'

describe('authored random-island pool', () => {
  it('contains exactly twenty-two unique authored islands', () => {
    expect(authoredIslands).toHaveLength(22)
    expect(new Set(authoredIslands.map((island) => island.id)).size).toBe(22)
    expect(new Set(authoredIslands.map((island) => island.encounterId)).size).toBe(22)
  })

  it('fully covers every choice and all six possible outcomes', () => {
    for (const island of authoredIslands) {
      const encounter = encounters.find((entry) => entry.id === island.encounterId)
      expect(encounter).toBeDefined()
      expect(encounter!.choices).toHaveLength(3)
      expect(island.introduction.length).toBeGreaterThan(350)
      expect(island.atmosphere.length).toBeGreaterThan(60)

      for (const choice of encounter!.choices) {
        const narrative = island.outcomes[choice.id]
        expect(narrative).toBeDefined()
        expect(narrative.success.aftermath.length).toBeGreaterThan(180)
        expect(narrative.failure.aftermath.length).toBeGreaterThan(180)
        expect(narrative.success.crewVoice.length).toBeGreaterThan(60)
        expect(narrative.failure.crewVoice.length).toBeGreaterThan(60)
        expect(narrative.success.consequence.length).toBeGreaterThan(50)
        expect(narrative.failure.consequence.length).toBeGreaterThan(50)
      }
    }
  })

  it('assigns original panoramic art to eleven of the twenty-two islands', () => {
    const illustrated = authoredIslands.filter((island) => island.scene)
    expect(illustrated).toHaveLength(11)
    expect(new Set(illustrated.map((island) => island.scene)).size).toBe(11)
    illustrated.forEach((island) => expect(island.scene).toMatch(/\/art\/island-.+\.jpg$/))
  })

  it('builds each voyage from seven non-repeating islands in this pool', () => {
    for (let seed = 0; seed < 50; seed += 1) {
      const route = createRun(seed).route
      const islandNodes = route.filter((node) => node.encounterId)
      expect(islandNodes).toHaveLength(7)
      expect(new Set(islandNodes.map((node) => node.islandId)).size).toBe(7)
      for (const node of islandNodes) {
        const island = authoredIslandByEncounter.get(node.encounterId)
        expect(island).toBeDefined()
        expect(node.name).toBe(island!.name)
        expect(node.region).toBe(island!.region)
        expect(node.biome).toBe(island!.biome)
      }
    }
  })

  it('varies the selected subset and order between seeds', () => {
    const first = createRun(91).route.filter((node) => node.encounterId).map((node) => node.encounterId)
    const second = createRun(92).route.filter((node) => node.encounterId).map((node) => node.encounterId)
    expect(first).not.toEqual(second)
  })
})
