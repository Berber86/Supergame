import { describe, expect, it } from 'vitest'
import { encounters } from './encounterCatalog'
import { createRun } from './game'
import { authoredIslandByEncounter, authoredIslands } from './islands'

describe('authored random-island pool', () => {
  it('contains exactly twenty-seven unique authored islands', () => {
    expect(authoredIslands).toHaveLength(27)
    expect(new Set(authoredIslands.map((island) => island.id)).size).toBe(27)
    expect(new Set(authoredIslands.map((island) => island.encounterId)).size).toBe(27)
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

  it('gives the final ten islands a second narrative layer at least as dense as the first twelve', () => {
    const firstTwelve = authoredIslands.slice(0, 12)
    const finalTen = authoredIslands.slice(12, 22)
    const average = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / values.length
    const aftermathLengths = (islands: typeof authoredIslands) => islands.flatMap((island) =>
      Object.values(island.outcomes).flatMap((outcome) => [outcome.success.aftermath.length, outcome.failure.aftermath.length]),
    )

    expect(finalTen.every((island) => island.introduction.length > 700)).toBe(true)
    expect(finalTen.every((island) => Object.values(island.outcomes).every((outcome) =>
      outcome.success.aftermath.length > 400 && outcome.failure.aftermath.length > 400,
    ))).toBe(true)
    expect(average(finalTen.map((island) => island.introduction.length))).toBeGreaterThanOrEqual(
      average(firstTwelve.map((island) => island.introduction.length)),
    )
    expect(average(aftermathLengths(finalTen))).toBeGreaterThanOrEqual(average(aftermathLengths(firstTwelve)))
  })

  it('assigns original panoramic art to twenty-six of the twenty-seven islands', () => {
    const illustrated = authoredIslands.filter((island) => island.scene)
    expect(illustrated).toHaveLength(26)
    expect(new Set(illustrated.map((island) => island.scene)).size).toBe(26)
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
