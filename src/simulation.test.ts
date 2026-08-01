import { describe, expect, it } from 'vitest'
import { simulateBalance, simulateVoyage } from './simulation'

describe('automated balance simulation', () => {
  it('never stalls the game loop across all difficulty modes', () => {
    const report = simulateBalance(40)

    report.forEach((difficulty) => {
      expect(difficulty.stalled).toBe(0)
      expect(difficulty.averageProgress).toBeGreaterThan(1)
    })
  })

  it('keeps the narrative mode at least as survivable as wrath', () => {
    const report = simulateBalance(60)
    const tale = report.find((entry) => entry.difficulty === 'tale')!
    const wrath = report.find((entry) => entry.difficulty === 'wrath')!

    expect(tale.averageProgress).toBeGreaterThanOrEqual(wrath.averageProgress)
    expect(tale.completionRate).toBeGreaterThanOrEqual(wrath.completionRate)
  })

  it('is deterministic for the same seed and mode', () => {
    expect(simulateVoyage(9917, 'odyssey')).toEqual(simulateVoyage(9917, 'odyssey'))
  })
})
