import { difficulties } from './difficulty'
import {
  bossActionChance,
  buyPortOffer,
  canAfford,
  choiceChance,
  continueVoyage,
  createRun,
  currentBossDefinition,
  currentEncounter,
  resolveBossAction,
  resolveChoice,
  resolveCrewCrisis,
} from './game'
import type { DifficultyId, RunState } from './types'

export interface SimulationResult {
  seed: number
  difficulty: DifficultyId
  outcome: 'home' | 'dead' | 'stalled'
  turns: number
  day: number
  nodeIndex: number
}

function servicePort(run: RunState) {
  let serviced = run
  const priorities = [
    { id: 'water', needed: () => serviced.resources.water < 36 },
    { id: 'food', needed: () => serviced.resources.food < 30 },
    { id: 'repair', needed: () => serviced.resources.hull < 58 },
    { id: 'healing', needed: () => serviced.resources.health < 52 },
    { id: 'crew', needed: () => serviced.resources.crew < 11 },
  ]
  priorities.forEach(({ id, needed }) => {
    if (!needed()) return
    const next = buyPortOffer(serviced, id)
    if (next !== serviced) serviced = next
  })
  return serviced
}

export function simulateVoyage(seed: number, difficulty: DifficultyId): SimulationResult {
  let run = createRun(seed, [], difficulty)
  let turns = 0

  while (run.phase !== 'home' && run.phase !== 'dead' && turns < 120) {
    if (run.phase === 'encounter') {
      const encounter = currentEncounter(run)
      const choice = [...encounter.choices]
        .filter((entry) => canAfford(run.resources, entry.cost) || !encounter.choices.some((option) => canAfford(run.resources, option.cost)))
        .sort((left, right) => choiceChance(run, right) - choiceChance(run, left))[0]
      run = resolveChoice(run, choice)
    } else if (run.phase === 'boss') {
      const boss = currentBossDefinition(run)
      const anyAffordable = boss.actions.some((action) => canAfford(run.resources, action.cost))
      const action = [...boss.actions]
        .filter((entry) => canAfford(run.resources, entry.cost) || !anyAffordable)
        .sort((left, right) => {
          const rightValue = bossActionChance(run, right) * right.damage + right.mitigation * 10
          const leftValue = bossActionChance(run, left) * left.damage + left.mitigation * 10
          return rightValue - leftValue
        })[0]
      run = resolveBossAction(run, action)
    } else if (run.phase === 'crew-crisis') {
      const approach = run.progression.coins >= 15 ? 'bribe' : 'council'
      run = resolveCrewCrisis(run, approach)
    } else if (run.phase === 'port') {
      run = continueVoyage(servicePort(run), difficulty === 'wrath' ? 'cautious' : 'bold')
    } else if (run.phase === 'resolution') {
      run = continueVoyage(run, difficulty === 'wrath' ? 'cautious' : 'bold')
    }
    turns += 1
  }

  return {
    seed,
    difficulty,
    outcome: run.phase === 'home' ? 'home' : run.phase === 'dead' ? 'dead' : 'stalled',
    turns,
    day: run.day,
    nodeIndex: run.nodeIndex,
  }
}

export function simulateBalance(seedCount = 50) {
  return difficulties.map((difficulty) => {
    const results = Array.from({ length: seedCount }, (_, seed) => simulateVoyage(seed, difficulty.id))
    const completed = results.filter((result) => result.outcome === 'home').length
    const stalled = results.filter((result) => result.outcome === 'stalled').length
    const averageProgress = results.reduce((sum, result) => sum + result.nodeIndex, 0) / seedCount
    return {
      difficulty: difficulty.id,
      completed,
      completionRate: completed / seedCount,
      stalled,
      averageProgress,
    }
  })
}
