import { describe, expect, it } from 'vitest'
import { normalizeMeta } from './campaign'
import { finaleForCompanion } from './companionSagas'
import { encounters } from './data'
import { allCompanionDefinitions } from './progression'
import { storyFlagScenes } from './storyFlags'
import { bossScenes, encounterScenes, endingScenes, preparationScenes, sceneForEncounter, uiScenes } from './visuals'

describe('illustrated narrative scenes', () => {
  it('connects every specific visual scene to an existing encounter', () => {
    const encounterIds = new Set(encounters.map((encounter) => encounter.id))

    Object.keys(encounterScenes).forEach((encounterId) => {
      expect(encounterIds.has(encounterId)).toBe(true)
    })
  })

  it('uses five distinct generated event panoramas', () => {
    const sources = new Set(Object.values(encounterScenes).map((scene) => scene.src))

    expect(sources.size).toBe(5)
    sources.forEach((source) => expect(source).toMatch(/^\/art\/event-.+\.jpg$/))
  })

  it('keeps unique illustrations for both campaign guardians', () => {
    expect(bossScenes.scylla.src).not.toBe(bossScenes['poseidon-avatar'].src)
    expect(Object.values(bossScenes)).toHaveLength(2)
  })

  it('falls back to voyage art for encounters without a dedicated scene', () => {
    const encounter = encounters.find((entry) => entry.id === 'shore-of-ashes')!

    expect(sceneForEncounter(encounter).src).toBe('/art/odyssey-storm.jpg')
  })

  it('provides a unique generated panorama for every ending', () => {
    expect(Object.keys(endingScenes).sort()).toEqual(['divine', 'hero', 'hollow', 'shadow'])
    expect(new Set(Object.values(endingScenes).map((scene) => scene.src)).size).toBe(4)
    Object.values(endingScenes).forEach((scene) => expect(scene.src).toMatch(/^\/art\/ending-.+\.jpg$/))
  })

  it('provides generated guidance and offline scenes for version 0.8', () => {
    expect(Object.keys(uiScenes)).toEqual(['accessibility', 'offline'])
    expect(new Set(Object.values(uiScenes).map((scene) => scene.src)).size).toBe(2)
    Object.values(uiScenes).forEach((scene) => expect(scene.src).toMatch(/\/art\/ui-.+\.jpg$/))
  })

  it('provides three new generated memory scenes plus the existing secret scene', () => {
    expect(Object.keys(storyFlagScenes).sort()).toEqual(['alliance', 'oath', 'secret', 'wrath'])
    expect(storyFlagScenes.oath).toMatch(/\/art\/memory-oath\.jpg$/)
    expect(storyFlagScenes.wrath).toMatch(/\/art\/memory-wrath\.jpg$/)
    expect(storyFlagScenes.alliance).toMatch(/\/art\/memory-alliance\.jpg$/)
  })

  it('provides four generated preparation scenes', () => {
    expect(Object.keys(preparationScenes).sort()).toEqual(['council', 'offering', 'scouting', 'training'])
    expect(new Set(Object.values(preparationScenes).map((scene) => scene.src)).size).toBe(4)
    Object.values(preparationScenes).forEach((scene) => expect(scene.src).toMatch(/\/art\/preparation-.+\.jpg$/))
  })

  it('gives every named companion an original portrait', () => {
    expect(allCompanionDefinitions).toHaveLength(4)
    expect(new Set(allCompanionDefinitions.map((companion) => companion.portrait)).size).toBe(4)
    allCompanionDefinitions.forEach((companion) => expect(companion.portrait).toMatch(/^\/art\/companion-.+\.jpg$/))
  })

  it('gives all four personal finales an original panorama', () => {
    const finales = ['eurylochus', 'tiphys', 'sinon', 'idmon'].map((companionId) => finaleForCompanion(companionId as 'eurylochus' | 'tiphys' | 'sinon' | 'idmon', 'trusted'))
    expect(new Set(finales.map((finale) => finale.scene)).size).toBe(4)
    finales.forEach((finale) => expect(finale.scene).toMatch(/^\/art\/finale-.+\.jpg$/))
  })
})

describe('codex meta migration', () => {
  it('adds an empty codex to saves created before version 0.4', () => {
    const migrated = normalizeMeta({ voyages: 3, kleos: 18 })

    expect(migrated.voyages).toBe(3)
    expect(migrated.kleos).toBe(18)
    expect(migrated.codex).toEqual([])
  })

  it('preserves collected codex entries', () => {
    const migrated = normalizeMeta({ codex: ['circe-loom', 'scylla'] })

    expect(migrated.codex).toEqual(['circe-loom', 'scylla'])
  })
})
