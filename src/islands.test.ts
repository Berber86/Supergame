import { describe, expect, it } from 'vitest'
import { encounters } from './encounterCatalog'
import { createRun } from './game'
import { authoredIslandByEncounter, authoredIslands } from './islands'

describe('authored random-island pool', () => {
  it('contains thirty-five unique authored islands, including eight companion saga shores', () => {
    expect(authoredIslands).toHaveLength(35)
    expect(new Set(authoredIslands.map((island) => island.id)).size).toBe(35)
    expect(new Set(authoredIslands.map((island) => island.encounterId)).size).toBe(35)
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

  it('assigns original panoramic art to thirty-four of the thirty-five islands', () => {
    const illustrated = authoredIslands.filter((island) => island.scene)
    expect(illustrated).toHaveLength(34)
    expect(new Set(illustrated.map((island) => island.scene)).size).toBe(34)
    illustrated.forEach((island) => expect(island.scene).toMatch(/\/art\/(island|saga)-.+\.jpg$/))
  })

  it('builds each voyage from non-repeating islands in this pool', () => {
    for (let seed = 0; seed < 50; seed += 1) {
      // Короткий путь «Сказания» — семь берегов; полный путь — десять.
      const shortRoute = createRun(seed, [], 'tale').route
      const shortIslands = shortRoute.filter((node) => node.encounterId)
      expect(shortIslands).toHaveLength(7)
      expect(new Set(shortIslands.map((node) => node.islandId)).size).toBe(7)

      const fullRoute = createRun(seed, [], 'odyssey').route
      const fullIslands = fullRoute.filter((node) => node.encounterId)
      expect(fullIslands).toHaveLength(10)
      expect(new Set(fullIslands.map((node) => node.islandId)).size).toBe(10)

      for (const node of [...shortIslands, ...fullIslands]) {
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
