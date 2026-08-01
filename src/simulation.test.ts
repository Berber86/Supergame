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

  it('hits the designed completion bands for each mode', () => {
    const report = simulateBalance(120)
    const tale = report.find((entry) => entry.difficulty === 'tale')!
    const odyssey = report.find((entry) => entry.difficulty === 'odyssey')!
    const wrath = report.find((entry) => entry.difficulty === 'wrath')!

    // Каждый режим проходим: короткий путь — щадящий, полный путь — суровый, гнев — хардкор.
    expect(tale.completionRate).toBeGreaterThanOrEqual(0.5)
    expect(odyssey.completionRate).toBeGreaterThanOrEqual(0.25)
    expect(wrath.completionRate).toBeGreaterThanOrEqual(0.08)
    // Иерархия сложности сохраняется: Сказание > Одиссея > Гнев богов.
    expect(tale.completionRate).toBeGreaterThan(odyssey.completionRate)
    expect(odyssey.completionRate).toBeGreaterThan(wrath.completionRate)
  })

  it('is deterministic for the same seed and mode', () => {
    expect(simulateVoyage(9917, 'odyssey')).toEqual(simulateVoyage(9917, 'odyssey'))
  })
})
