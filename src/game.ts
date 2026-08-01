import { bosses, endings, legacyBoons, prophecies } from './campaign'
import { regionNames } from './data'
import { encounters } from './encounterCatalog'
import { difficultyDefinition } from './difficulty'
import { authoredIslandByEncounter, authoredIslands, islandOutcomeNarrative } from './islands'
import { flagsForOutcome, storyFlagModifiers } from './storyFlags'
import {
  equipment,
  recruitableCompanions,
  shipUpgrades,
  startingCompanion,
} from './progression'
import type {
  Biome,
  BossAction,
  BossState,
  Choice,
  Companion,
  CrewCrisisApproach,
  CrewReaction,
  DeferredDebt,
  DifficultyId,
  Effects,
  EquipmentSlot,
  GodId,
  MetaState,
  Outcome,
  Progression,
  ResourceKey,
  Resources,
  RationMode,
  RouteNode,
  RunState,
  Skill,
  TravelStance,
  WatchMode,
  WorldLocation,
} from './types'

export const WORLD_SIZE = 187

export const RESOURCE_MAX: Resources = {
  health: 100,
  food: 60,
  water: 60,
  morale: 100,
  crew: 24,
  hull: 100,
}

export const DEFAULT_META: MetaState = {
  voyages: 0,
  bestDistance: 0,
  kleos: 0,
  legacy: [],
  endings: [],
  prophecies: [],
  codex: [],
  history: [],
  achievements: [],
}

export interface PortService {
  id: string
  name: string
  description: string
  cost: number
  effects: Effects
}

export const portServices: PortService[] = [
  { id: 'food', name: 'Копчёное мясо и зерно', description: '+18 пищи', cost: 10, effects: { food: 18 } },
  { id: 'water', name: 'Пресная вода', description: '+20 воды', cost: 9, effects: { water: 20 } },
  { id: 'healing', name: 'Помощь храмового врача', description: '+22 здоровья', cost: 13, effects: { health: 22 } },
  { id: 'repair', name: 'Смола и новый лес', description: '+22 прочности корпуса', cost: 14, effects: { hull: 22 } },
  { id: 'crew', name: 'Нанять гребцов', description: '+2 человека, +4 духа', cost: 17, effects: { crew: 2, morale: 4 } },
]

const RESOURCE_LABELS: Record<ResourceKey, string> = {
  health: 'здоровье',
  food: 'пища',
  water: 'вода',
  morale: 'дух команды',
  crew: 'люди',
  hull: 'корпус',
}

const biomes: Biome[] = [
  'open-sea',
  'storm',
  'ashen',
  'sacred',
  'verdant',
  'abyssal',
  'volcanic',
  'civilized',
]

const worldRoots = [
  'Астер', 'Калид', 'Мелан', 'Орт', 'Псир', 'Фер', 'Ким', 'Талас', 'Эреб', 'Нис',
  'Лик', 'Дор', 'Кер', 'Арг', 'Сфен', 'Эол', 'Лестриг',
]

const worldEndings = [
  'ия', 'ос', 'ея', 'ион', 'ида', 'ора', 'ант', 'ира', 'есс', 'ара', 'омена', 'ит', 'ионта',
]

export function seededRandom(seed: number) {
  let state = seed >>> 0
  return () => {
    state += 0x6d2b79f5
    let value = state
    value = Math.imul(value ^ (value >>> 15), value | 1)
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61)
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296
  }
}

function shuffle<T>(items: T[], random: () => number) {
  const result = [...items]
  for (let index = result.length - 1; index > 0; index -= 1) {
    const target = Math.floor(random() * (index + 1))
    ;[result[index], result[target]] = [result[target], result[index]]
  }
  return result
}

function locationName(index: number, random: () => number) {
  const root = worldRoots[index % worldRoots.length]
  const ending = worldEndings[Math.floor(index / worldRoots.length) % worldEndings.length]
  const epithet = random() > 0.84 ? ` ${['Тихая', 'Чёрная', 'Малая', 'Верхняя'][index % 4]}` : ''
  return `${root}${ending}${epithet}`
}

export function generateWorld(seed: number, size = WORLD_SIZE): WorldLocation[] {
  const random = seededRandom(seed ^ 0x5f3759df)
  return Array.from({ length: size }, (_, index) => {
    const x = 3 + random() * 94
    const y = 6 + random() * 78
    const regionIndex = Math.min(regionNames.length - 1, Math.floor((x / 100) * regionNames.length))
    const biome = biomes[Math.floor(random() * biomes.length)]
    return {
      id: `world-${seed}-${index}`,
      name: locationName(index, random),
      region: regionNames[regionIndex],
      biome,
      danger: 1 + Math.floor(random() * 5),
      x: Number(x.toFixed(2)),
      y: Number(y.toFixed(2)),
    }
  })
}

function createRoute(seed: number): RouteNode[] {
  const random = seededRandom(seed)
  const islandOrder = shuffle(authoredIslands, random)
  const positions = [
    [7, 79], [15, 65], [25, 74], [33, 56], [42, 64], [50, 45],
    [59, 54], [67, 35], [76, 43], [84, 24], [91, 31],
  ]
  let encounterIndex = 0

  const route: RouteNode[] = positions.map(([x, y], index) => {
    const isPort = index === 3 || index === 7
    const bossId = index === 5 ? 'scylla' : index === 10 ? 'poseidon-avatar' : undefined
    const isBoss = Boolean(bossId)
    const island = !isPort && !isBoss ? islandOrder[encounterIndex] : undefined
    const name = isPort
      ? index === 3 ? 'Навпакт' : 'Гавань Алкиноя'
      : bossId === 'scylla'
        ? 'Пролив шести пастей'
        : bossId === 'poseidon-avatar'
          ? 'Врата Итаки'
          : island?.name ?? 'Безымянный берег'
    const node: RouteNode = {
      id: `route-${seed}-${index}`,
      name,
      region: isPort ? 'Земли свободных полисов' : isBoss ? 'Владения Посейдона' : island?.region ?? 'Безымянные воды',
      encounterId: island?.encounterId ?? '',
      islandId: island?.id,
      bossId,
      distance: index === 0 ? 0 : 70 + Math.floor(random() * 115),
      x,
      y,
      kind: isPort ? 'port' : isBoss ? 'boss' : (island?.danger ?? 1) >= 5 ? 'danger' : index === 0 ? 'origin' : 'island',
      biome: isPort ? 'civilized' : isBoss ? 'storm' : island?.biome ?? 'open-sea',
      danger: isPort ? 1 : isBoss ? 5 : island?.danger ?? 1,
    }
    if (island) encounterIndex += 1
    return node
  })

  route.push({
    id: `ithaca-${seed}`,
    name: 'Итака',
    region: 'Дом, если боги позволят',
    encounterId: '',
    distance: 180,
    x: 96,
    y: 12,
    kind: 'destination',
    biome: 'civilized',
    danger: 1,
  })

  return route
}

export function createRun(seed = Date.now(), legacy: string[] = [], difficulty: DifficultyId = 'odyssey'): RunState {
  const world = generateWorld(seed)
  const hasBoon = (id: string) => legacy.includes(id)
  const difficultyConfig = difficultyDefinition(difficulty)
  const baseResources: Resources = {
    health: hasBoon('scarred-king') ? 100 : 88,
    food: hasBoon('sacred-casks') ? 48 : 38,
    water: hasBoon('sacred-casks') ? 54 : 44,
    morale: hasBoon('veteran-oars') ? 80 : 72,
    crew: hasBoon('veteran-oars') ? 20 : 18,
    hull: hasBoon('hardened-keel') ? 100 : 92,
  }
  const resources = (Object.keys(baseResources) as ResourceKey[]).reduce<Resources>((scaled, key) => {
    scaled[key] = Math.max(1, Math.min(RESOURCE_MAX[key], Math.round(baseResources[key] * difficultyConfig.resourceMultiplier)))
    return scaled
  }, { ...baseResources })
  const prophecy = { ...prophecies[Math.floor(seededRandom(seed + 404)() * prophecies.length)] }
  return {
    version: 8,
    seed,
    difficulty,
    divineRescueUsed: false,
    day: 1,
    nodeIndex: 0,
    world,
    route: createRoute(seed),
    resources,
    skills: {
      cunning: hasBoon('owl-memory') ? 6 : 5,
      valor: 4,
      seamanship: 5,
      will: 3,
    },
    progression: {
      level: 5,
      xp: 0,
      nextLevelXp: 80,
      skillPoints: 0,
      coins: hasBoon('hermes-purse') ? 44 : 26,
      equipment: {},
      inventory: [],
    },
    ship: {
      name: 'Чёрная ласточка',
      upgrades: [],
      companions: [{ ...startingCompanion, memories: [] }],
      departedCompanions: [],
      cohesion: 72,
      mutinyRisk: 8,
      lastCrisisDay: -10,
    },
    preparation: {
      preparedSkill: null,
      assignedCompanionId: null,
      watch: 'balanced',
      rations: 'normal',
      activeBoons: [],
      usedCompanionAbilities: [],
      restedNodeIndexes: [],
      trainedNodeIndexes: [],
      offeredNodeIndexes: [],
      scoutReport: null,
    },
    campaign: {
      act: 1,
      gods: { athena: 5, poseidon: -25, hermes: 0, hades: 0 },
      doom: 0,
      decisions: [],
      storyFlags: [],
      prophecy,
      bossesDefeated: [],
      ending: null,
    },
    boss: null,
    crewCrisis: null,
    debts: [],
    legacyBoons: [...legacy],
    log: [
      {
        id: `log-${seed}-0`,
        day: 1,
        title: 'Троя осталась за кормой',
        text: `${resources.crew} людей присягнули пройти с вами весь путь до Итаки. Песнь начата в режиме «${difficultyConfig.name}». Тиресий оставил пророчество: «${prophecy.title}».`,
        tone: 'neutral',
      },
    ],
    phase: 'encounter',
    resolution: null,
    portNotice: null,
    kleosEarned: 0,
  }
}

export function currentEncounter(run: RunState) {
  const encounterId = run.route[run.nodeIndex]?.encounterId
  return encounters.find((encounter) => encounter.id === encounterId) ?? encounters[0]
}

export function currentIsland(run: RunState) {
  const encounterId = run.route[run.nodeIndex]?.encounterId
  return authoredIslandByEncounter.get(encounterId)
}

export function orderedEncounterChoices(run: RunState) {
  const encounter = currentEncounter(run)
  let encounterHash = 0
  for (let index = 0; index < encounter.id.length; index += 1) {
    encounterHash = (encounterHash * 31 + encounter.id.charCodeAt(index)) | 0
  }
  return shuffle(encounter.choices, seededRandom(run.seed + run.nodeIndex * 2029 + encounterHash))
}

export function effectiveSkill(run: RunState, skill: Skill) {
  const equipmentBonus = Object.values(run.progression.equipment).reduce((bonus, itemId) => {
    const item = equipment.find((entry) => entry.id === itemId)
    return bonus + (item?.skill === skill ? item.bonus : 0)
  }, 0)
  const companionBonus = run.ship.companions.reduce(
    (bonus, companion) => bonus + (companion.skill === skill ? companion.bonus : 0),
    0,
  )
  const assignedCompanion = run.ship.companions.find((companion) => companion.id === run.preparation.assignedCompanionId)
  const assignmentBonus = assignedCompanion?.skill === skill ? 1 : 0
  return run.skills[skill] + equipmentBonus + companionBonus + assignmentBonus
}

function divineSkillModifier(run: RunState, skill: Skill) {
  if (skill === 'cunning') return (run.campaign.gods.athena + run.campaign.gods.hermes) / 1100
  if (skill === 'seamanship') return run.campaign.gods.poseidon / 650
  if (skill === 'will') return (run.campaign.gods.athena + run.campaign.gods.hades) / 1250
  return run.campaign.gods.athena / 1500
}

export function choiceChance(run: RunState, choice: Choice) {
  const skill = effectiveSkill(run, choice.skill)
  const moraleModifier = (run.resources.morale - 50) / 500
  const healthModifier = run.resources.health < 35 ? -0.08 : 0
  const legacyModifier = run.legacyBoons.includes('thread-of-moira') ? 0.04 : 0
  const difficultyModifier = difficultyDefinition(run.difficulty).chanceModifier
  const flagModifier = storyFlagModifiers(run.campaign.storyFlags).chance[choice.skill] ?? 0
  const preparedModifier = run.preparation.preparedSkill === choice.skill ? 0.07 : 0
  const companionBoonModifier = run.preparation.activeBoons.includes('sinon-scheme') && choice.skill === 'cunning' ? 0.06 : 0
  const chance = 0.46 + skill * 0.075 - choice.difficulty * 0.08 + moraleModifier + healthModifier + divineSkillModifier(run, choice.skill) + legacyModifier + difficultyModifier + flagModifier + preparedModifier + companionBoonModifier
  return Math.max(0.08, Math.min(0.94, chance))
}

export function canAfford(resources: Resources, effects?: Effects) {
  if (!effects) return true
  return (Object.entries(effects) as [ResourceKey, number][]).every(([key, value]) => {
    if (value >= 0) return true
    return resources[key] + value > 0
  })
}

export function applyEffects(resources: Resources, effects: Effects) {
  const next = { ...resources }
  ;(Object.entries(effects) as [ResourceKey, number][]).forEach(([key, value]) => {
    next[key] = Math.max(0, Math.min(RESOURCE_MAX[key], next[key] + value))
  })
  return next
}

function mergeEffects(...groups: (Effects | undefined)[]) {
  return groups.reduce<Effects>((merged, group) => {
    if (!group) return merged
    ;(Object.entries(group) as [ResourceKey, number][]).forEach(([key, value]) => {
      merged[key] = (merged[key] ?? 0) + value
    })
    return merged
  }, {})
}

export function formatEffects(effects?: Effects) {
  if (!effects) return []
  return (Object.entries(effects) as [ResourceKey, number][])
    .filter(([, value]) => value !== 0)
    .map(([key, value]) => ({ key, value, label: RESOURCE_LABELS[key] }))
}

function deterministicRoll(run: RunState, choice: Choice) {
  let choiceHash = 0
  for (let index = 0; index < choice.id.length; index += 1) {
    choiceHash = (choiceHash * 31 + choice.id.charCodeAt(index)) | 0
  }
  return seededRandom(run.seed + run.nodeIndex * 997 + choiceHash)()
}

function gainExperience(progression: Progression, xp: number, coins: number) {
  const next = { ...progression, xp: progression.xp + xp, coins: progression.coins + coins }
  let levelUp = false
  while (next.xp >= next.nextLevelXp) {
    next.xp -= next.nextLevelXp
    next.level += 1
    next.skillPoints += 1
    next.nextLevelXp = 80 + (next.level - 4) * 25
    levelUp = true
  }
  return { progression: next, levelUp }
}

function divineChangesForChoice(choice: Choice, success: boolean): Partial<Record<GodId, number>> {
  const direction = success ? 1 : -1
  if (choice.skill === 'cunning') return { athena: 4 * direction, hermes: 3 * direction }
  if (choice.skill === 'seamanship') return { poseidon: 3 * direction, hermes: success ? 1 : 0 }
  if (choice.skill === 'will') return { athena: 3 * direction, hades: success ? 2 : 1 }
  return { athena: success ? 2 : -1, poseidon: success ? -2 : -4 }
}

function applyDivineChanges(
  gods: Record<GodId, number>,
  changes: Partial<Record<GodId, number>>,
): Record<GodId, number> {
  const next = { ...gods }
  ;(Object.entries(changes) as [GodId, number][]).forEach(([god, value]) => {
    next[god] = Math.max(-100, Math.min(100, next[god] + value))
  })
  return next
}

function deathReason(resources: Resources) {
  if (resources.health <= 0) return 'Ваши раны оказались сильнее царской воли.'
  if (resources.crew <= 0) return 'На корабле не осталось людей, способных поднять вёсла.'
  if (resources.hull <= 0) return 'Чёрный корабль раскололся и исчез под волнами.'
  if (resources.water <= 0) return 'Последняя амфора опустела. Море окружало вас, но ни капли нельзя было выпить.'
  if (resources.food <= 0) return 'Голод сломил команду прежде, чем на горизонте показалась земля.'
  if (resources.morale <= 0) return 'Люди перестали верить в Итаку и отказались повиноваться.'
  return null
}

function withDeathCheck(run: RunState): RunState {
  const reason = deathReason(run.resources)
  if (!reason) return run
  const difficulty = difficultyDefinition(run.difficulty)
  if (difficulty.divineRescue && !run.divineRescueUsed) {
    const rescuedResources: Resources = {
      health: Math.max(18, run.resources.health),
      food: Math.max(5, run.resources.food),
      water: Math.max(7, run.resources.water),
      morale: Math.max(18, run.resources.morale),
      crew: Math.max(2, run.resources.crew),
      hull: Math.max(18, run.resources.hull),
    }
    return {
      ...run,
      divineRescueUsed: true,
      resources: rescuedResources,
      resolution: run.phase === 'resolution' ? {
        ...(run.resolution ?? { effects: {} }),
        success: false,
        title: 'Сова пролетела над мачтой',
        text: `${reason} Но Афина один раз переплела оборванную нить и вернула корабль из-за края гибели.`,
        omen: 'Следующего спасения не будет.',
      } : run.resolution,
      log: [
        { id: `rescue-${run.seed}-${run.day}`, day: run.day, title: 'Вмешательство Афины', text: 'Гибель отступила, но божественная милость исчерпана.', tone: 'good' as const },
        ...run.log,
      ].slice(0, 32),
    }
  }
  const earned = Math.round(Math.max(3, run.nodeIndex * 4 + 3) * difficulty.kleosMultiplier)
  return {
    ...run,
    phase: 'dead',
    kleosEarned: earned,
    resolution: {
      success: false,
      title: 'Море забрало ещё одно имя',
      text: reason,
      omen: 'Но песни помнят поражение так же долго, как победу.',
      effects: {},
    },
  }
}

function createDeferredDebt(run: RunState, source: string, cost: Effects): DeferredDebt {
  const effects: Effects = { ...cost }
  effects.morale = (effects.morale ?? 0) - 3
  const largestCost = (Object.entries(cost) as [ResourceKey, number][])
    .filter(([, value]) => value < 0)
    .sort((left, right) => left[1] - right[1])[0]?.[0]
  const titles: Partial<Record<ResourceKey, string>> = {
    health: 'Кровная цена',
    food: 'Заём из общего котла',
    water: 'Долг хранителю амфор',
    morale: 'Нарушенная клятва',
    crew: 'Обещание новых гребцов',
    hull: 'Долг корабельщикам',
  }
  return {
    id: `debt-${run.seed}-${run.day}-${run.nodeIndex}-${run.debts.length}`,
    title: titles[largestCost ?? 'morale'] ?? 'Отложенная цена',
    description: `Цена решения «${source}» будет взыскана через два дня пути вместе с потерей доверия команды.`,
    source,
    createdDay: run.day,
    dueDay: run.day + 2,
    effects,
    status: 'pending',
  }
}

function companionReactionText(
  companion: Companion,
  choice: Choice,
  success: boolean,
  crewLoss: number,
  debtCreated: boolean,
  loyaltyDelta: number,
) {
  if (crewLoss < 0) return `${companion.name} не забудет людей, заплативших за решение «${choice.title}».`
  if (debtCreated) {
    if (companion.temperament === 'trickster') return `${companion.name} признаёт ловкость хода, но уже прикидывает цену обещания.`
    return `${companion.name} запоминает долг, который Одиссей переложил на команду.`
  }
  if (choice.skill === companion.skill && success) return `${companion.name} открыто поддерживает выбранный способ действий.`
  if (!success) return `${companion.name} видит ошибку царя и становится осторожнее в своей верности.`
  if (loyaltyDelta > 0) return `${companion.name} считает исход доказательством права Одиссея командовать.`
  return `${companion.name} принимает исход, но не разделяет уверенности царя.`
}

function rememberChoice(
  run: RunState,
  choice: Choice,
  outcome: Outcome,
  success: boolean,
  debtCreated: boolean,
) {
  const crewLoss = Math.min(0, outcome.effects.crew ?? 0)
  const hullLoss = Math.min(0, outcome.effects.hull ?? 0)
  const reactions: CrewReaction[] = []
  const companions = run.ship.companions.map((companion) => {
    let loyaltyDelta = success ? 1 : -2
    if (choice.skill === companion.skill) loyaltyDelta += success ? 4 : -1
    if (crewLoss < 0) loyaltyDelta -= Math.abs(crewLoss) * 3
    if (hullLoss < 0 && companion.temperament === 'seafarer') loyaltyDelta -= 4
    if (debtCreated) loyaltyDelta += companion.temperament === 'trickster' ? 1 : -5
    if (choice.skill === 'valor' && companion.temperament === 'cautious') loyaltyDelta -= 2
    if (choice.skill === 'cunning' && companion.temperament === 'trickster') loyaltyDelta += 2
    loyaltyDelta = Math.max(-12, Math.min(8, loyaltyDelta))

    const fearDelta = (success ? -1 : 3) + Math.abs(crewLoss) * 2 + (debtCreated ? 2 : 0)
    const respectDelta = (success ? 2 : -1) + (choice.skill === companion.skill ? 2 : 0)
    const reaction: CrewReaction['reaction'] = crewLoss < 0 || loyaltyDelta <= -5
      ? 'fear'
      : loyaltyDelta >= 4
        ? 'admire'
        : loyaltyDelta > 0
          ? 'approve'
          : 'disapprove'
    const text = companionReactionText(companion, choice, success, crewLoss, debtCreated, loyaltyDelta)
    reactions.push({ companionId: companion.id, name: companion.name, text, loyaltyDelta, reaction })
    return {
      ...companion,
      loyalty: Math.max(0, Math.min(100, companion.loyalty + loyaltyDelta)),
      fear: Math.max(0, Math.min(100, companion.fear + fearDelta)),
      respect: Math.max(0, Math.min(100, companion.respect + respectDelta)),
      memories: [
        {
          id: `memory-${run.seed}-${run.day}-${choice.id}-${companion.id}`,
          day: run.day,
          choiceId: choice.id,
          title: choice.title,
          reaction,
          text,
          loyaltyDelta,
        },
        ...companion.memories,
      ].slice(0, 8),
    }
  })
  const riskDelta = (success ? -2 : 5) + Math.abs(crewLoss) * 7 + (debtCreated ? 10 : 0)
  const cohesionDelta = (success ? 2 : -4) + crewLoss * 4 + (debtCreated ? -6 : 0)
  return { companions, reactions, riskDelta, cohesionDelta }
}

export function resolveChoice(run: RunState, choice: Choice, forceDeferredCost = false): RunState {
  if (run.phase !== 'encounter') return run
  const affordable = canAfford(run.resources, choice.cost)
  const hasAffordableChoice = currentEncounter(run).choices.some((entry) => canAfford(run.resources, entry.cost))
  if (!affordable && hasAffordableChoice && !forceDeferredCost) return run
  const debtCreated = !affordable && (!hasAffordableChoice || forceDeferredCost) && choice.cost
    ? createDeferredDebt(run, choice.title, choice.cost)
    : undefined
  const chargedCost = affordable ? choice.cost : undefined

  const paidResources = applyEffects(run.resources, chargedCost ?? {})
  const success = deterministicRoll(run, choice) <= choiceChance(run, choice)
  const outcome = success ? choice.success : choice.failure
  const encounter = currentEncounter(run)
  const authoredNarrative = islandOutcomeNarrative(encounter.id, choice.id, success)
  const resources = applyEffects(paidResources, outcome.effects)
  const baseXp = outcome.xp ?? (success ? 22 + choice.difficulty * 4 : 11 + choice.difficulty * 2)
  const xp = Math.round(baseXp * (run.legacyBoons.includes('black-sail-legend') && success ? 1.2 : 1))
  // Drachmas now come only from authored loot, rewards and trade—not from every roll.
  const coins = outcome.coins ?? 0
  const gained = gainExperience(run.progression, xp, coins)
  const divineChange = divineChangesForChoice(choice, success)
  const crewLoss = Math.min(0, outcome.effects.crew ?? 0)
  const remembered = rememberChoice(run, choice, outcome, success, Boolean(debtCreated))
  const companionImpacts = authoredNarrative?.companionImpacts ?? []
  const departedFromOutcome = remembered.companions.filter((companion) =>
    companionImpacts.some((impact) => impact.companionId === companion.id && impact.depart),
  )
  const impactedCompanions = remembered.companions
    .map((companion) => {
      const impact = companionImpacts.find((entry) => entry.companionId === companion.id)
      if (!impact) return companion
      const reaction = impact.loyalty >= 4 ? 'admire' as const : impact.loyalty < 0 ? 'disapprove' as const : 'approve' as const
      return {
        ...companion,
        loyalty: Math.max(0, Math.min(100, companion.loyalty + impact.loyalty)),
        respect: Math.max(0, Math.min(100, companion.respect + impact.respect)),
        fear: Math.max(0, Math.min(100, companion.fear + impact.fear)),
        memories: [{
          id: `authored-memory-${run.seed}-${run.day}-${choice.id}-${companion.id}`,
          day: run.day,
          choiceId: choice.id,
          title: choice.title,
          reaction,
          text: impact.memory,
          loyaltyDelta: impact.loyalty,
        }, ...companion.memories.filter((memory) => memory.choiceId !== choice.id)].slice(0, 8),
      }
    })
    .filter((companion) => !companionImpacts.some((impact) => impact.companionId === companion.id && impact.depart))
  const combinedReactions = remembered.reactions.map((reaction) => {
    const impact = companionImpacts.find((entry) => entry.companionId === reaction.companionId)
    if (!impact) return reaction
    const loyaltyDelta = reaction.loyaltyDelta + impact.loyalty
    return {
      ...reaction,
      loyaltyDelta,
      reaction: loyaltyDelta >= 4 ? 'admire' as const : loyaltyDelta < 0 ? 'disapprove' as const : 'approve' as const,
      text: impact.memory,
    }
  })
  companionImpacts.filter((impact) => !remembered.reactions.some((reaction) => reaction.companionId === impact.companionId)).forEach((impact) => {
    const companion = run.ship.companions.find((entry) => entry.id === impact.companionId)
    if (companion) combinedReactions.push({ companionId: impact.companionId, name: companion.name, text: impact.memory, loyaltyDelta: impact.loyalty, reaction: impact.loyalty >= 4 ? 'admire' : impact.loyalty < 0 ? 'disapprove' : 'approve' })
  })
  const storyFlagsGained = flagsForOutcome(encounter.id, choice.id, success, run.day, run.campaign.storyFlags)
  const campaign = {
    ...run.campaign,
    gods: applyDivineChanges(run.campaign.gods, divineChange),
    storyFlags: [...run.campaign.storyFlags, ...storyFlagsGained],
    doom: Math.min(100, run.campaign.doom + (success ? 0 : 3) + Math.abs(crewLoss)),
    decisions: [
      ...run.campaign.decisions,
      {
        id: `decision-${run.seed}-${run.nodeIndex}-${choice.id}`,
        day: run.day,
        encounterId: encounter.id,
        choiceId: choice.id,
        title: choice.title,
        skill: choice.skill,
        success,
      },
    ],
  }
  const resolution = {
    success,
    title: gained.levelUp ? 'Имя становится легендой' : success ? 'Мойры благосклонны' : 'Цена ошибки',
    text: outcome.text,
    omen: outcome.omen,
    effects: mergeEffects(chargedCost, outcome.effects),
    xp,
    coins: coins > 0 ? coins : undefined,
    levelUp: gained.levelUp,
    divineChange,
    crewReactions: combinedReactions,
    debtCreated,
    aftermath: authoredNarrative?.aftermath,
    crewVoice: authoredNarrative?.crewVoice,
    consequence: authoredNarrative?.consequence,
    storyFlagsGained,
  }
  const next: RunState = {
    ...run,
    resources,
    progression: gained.progression,
    campaign,
    ship: {
      ...run.ship,
      companions: impactedCompanions,
      departedCompanions: [...run.ship.departedCompanions, ...departedFromOutcome],
      cohesion: Math.max(0, Math.min(100, run.ship.cohesion + remembered.cohesionDelta + (authoredNarrative?.cohesion ?? 0))),
      mutinyRisk: Math.max(0, Math.min(100, run.ship.mutinyRisk + remembered.riskDelta + (authoredNarrative?.mutinyRisk ?? 0))),
    },
    preparation: {
      ...run.preparation,
      preparedSkill: null,
      activeBoons: run.preparation.activeBoons.filter((boon) => boon !== 'sinon-scheme' && boon !== 'idmon-vision'),
    },
    debts: debtCreated ? [debtCreated, ...run.debts].slice(0, 16) : run.debts,
    phase: 'resolution',
    resolution,
    portNotice: null,
    log: [
      {
        id: `log-${run.seed}-${run.day}-${choice.id}`,
        day: run.day,
        title: encounter.title,
        text: coins > 0 ? `${outcome.text} Добыто ${coins} ${coins === 1 ? 'драхма' : 'драхм'}.` : outcome.text,
        tone: success ? ('good' as const) : ('bad' as const),
      },
      ...run.log,
    ].slice(0, 32),
  }
  return withDeathCheck(next)
}

export function upgradeSkill(run: RunState, skill: Skill): RunState {
  if (run.progression.skillPoints <= 0 || run.skills[skill] >= 9 || run.phase === 'dead') return run
  return {
    ...run,
    skills: { ...run.skills, [skill]: run.skills[skill] + 1 },
    progression: { ...run.progression, skillPoints: run.progression.skillPoints - 1 },
    log: [
      {
        id: `skill-${run.seed}-${run.day}-${skill}-${run.progression.skillPoints}`,
        day: run.day,
        title: 'Опыт превращается в мастерство',
        text: `${skill === 'cunning' ? 'Хитрость' : skill === 'valor' ? 'Доблесть' : skill === 'seamanship' ? 'Мореходство' : 'Воля'} Одиссея возросла.`,
        tone: 'good' as const,
      },
      ...run.log,
    ].slice(0, 24),
  }
}

function canPrepare(run: RunState) {
  return run.phase === 'encounter' || run.phase === 'port' || run.phase === 'resolution'
}

export function restHero(run: RunState): RunState {
  if (!canPrepare(run) || run.preparation.restedNodeIndexes.includes(run.nodeIndex)) return run
  const cost: Effects = { food: -3, water: -3 }
  if (!canAfford(run.resources, cost)) return { ...run, portNotice: 'Для отдыха нужны 3 пищи и 3 воды.' }
  return {
    ...run,
    day: run.day + 1,
    resources: applyEffects(applyEffects(run.resources, cost), { health: 20, morale: 6 }),
    preparation: {
      ...run.preparation,
      restedNodeIndexes: [...run.preparation.restedNodeIndexes, run.nodeIndex],
    },
    portNotice: 'Одиссей отдохнул. Здоровье и боевой дух восстановлены.',
    log: [
      { id: `rest-${run.seed}-${run.nodeIndex}`, day: run.day + 1, title: 'День отдыха', text: 'Одиссей передал вахту спутникам и позволил ранам затянуться.', tone: 'good' as const },
      ...run.log,
    ].slice(0, 32),
  }
}

export function trainSkill(run: RunState, skill: Skill): RunState {
  if (!canPrepare(run) || run.preparation.trainedNodeIndexes.includes(run.nodeIndex)) return run
  const cost: Effects = { food: -2, water: -1 }
  if (!canAfford(run.resources, cost)) return { ...run, portNotice: 'Для тренировки нужны 2 пищи и 1 вода.' }
  return {
    ...run,
    day: run.day + 1,
    resources: applyEffects(run.resources, cost),
    preparation: {
      ...run.preparation,
      preparedSkill: skill,
      trainedNodeIndexes: [...run.preparation.trainedNodeIndexes, run.nodeIndex],
    },
    portNotice: `Подготовлено: ${skill === 'cunning' ? 'хитрость' : skill === 'valor' ? 'доблесть' : skill === 'seamanship' ? 'мореходство' : 'воля'}. Следующая подходящая проверка получит +7%.`,
  }
}

export function assignCompanion(run: RunState, companionId: string | null): RunState {
  if (companionId && !run.ship.companions.some((companion) => companion.id === companionId)) return run
  return {
    ...run,
    preparation: { ...run.preparation, assignedCompanionId: companionId },
    portNotice: companionId
      ? `${run.ship.companions.find((companion) => companion.id === companionId)?.name} назначен помогать в пути.`
      : 'Спутник на переход не назначен.',
  }
}

export function setWatchMode(run: RunState, watch: WatchMode): RunState {
  return { ...run, preparation: { ...run.preparation, watch }, portNotice: 'Порядок вахт изменён.' }
}

export function setRationMode(run: RunState, rations: RationMode): RunState {
  return { ...run, preparation: { ...run.preparation, rations }, portNotice: 'Норма выдачи припасов изменена.' }
}

export function activateCompanionAbility(run: RunState, companionId: string): RunState {
  if (!canPrepare(run)) return run
  const companion = run.ship.companions.find((entry) => entry.id === companionId)
  const useKey = `${run.campaign.act}:${companionId}`
  if (!companion || run.preparation.usedCompanionAbilities.includes(useKey)) return run
  let resources = run.resources
  let ship = run.ship
  let campaign = run.campaign
  const activeBoons = [...run.preparation.activeBoons]
  let text: string
  if (companionId === 'eurylochus') {
    resources = applyEffects(resources, { morale: -2 })
    ship = { ...ship, cohesion: Math.min(100, ship.cohesion + 12), mutinyRisk: Math.max(0, ship.mutinyRisk - 15) }
    text = 'Еврилох провёл общий совет: сплочённость выросла, риск мятежа снизился.'
  } else if (companionId === 'tiphys') {
    if (!activeBoons.includes('tiphys-guidance')) activeBoons.push('tiphys-guidance')
    text = 'Тифий прочитал течение: риск следующего шторма значительно снижен.'
  } else if (companionId === 'sinon') {
    if (!activeBoons.includes('sinon-market')) activeBoons.push('sinon-market')
    text = 'Синон подготовил ложный манифест: следующая покупка в порту дешевле на 25%.'
  } else {
    resources = applyEffects(resources, { health: -3 })
    campaign = { ...campaign, doom: Math.max(0, campaign.doom - 10) }
    if (!activeBoons.includes('idmon-vision')) activeBoons.push('idmon-vision')
    text = 'Идмон принял дурной сон на себя: рок снизился, следующая проверка воли усилена.'
  }
  return {
    ...run,
    resources,
    ship,
    campaign,
    preparation: {
      ...run.preparation,
      activeBoons,
      usedCompanionAbilities: [...run.preparation.usedCompanionAbilities, useKey],
    },
    portNotice: text,
    log: [
      { id: `ability-${run.seed}-${useKey}`, day: run.day, title: `Способность: ${companion.name}`, text, tone: 'good' as const },
      ...run.log,
    ].slice(0, 32),
  }
}

export function makeOffering(run: RunState, god: GodId): RunState {
  if (!canPrepare(run) || run.preparation.offeredNodeIndexes.includes(run.nodeIndex)) return run
  const coinCosts: Record<GodId, number> = { athena: 8, poseidon: 10, hermes: 8, hades: 6 }
  const resourceCosts: Record<GodId, Effects> = {
    athena: { morale: -2 },
    poseidon: { food: -4 },
    hermes: { food: -2, water: -2 },
    hades: { health: -6 },
  }
  const coinCost = coinCosts[god]
  if (run.progression.coins < coinCost || !canAfford(run.resources, resourceCosts[god])) {
    return { ...run, portNotice: 'Недостаточно ресурсов для этого подношения.' }
  }
  const gods = applyDivineChanges(run.campaign.gods, { [god]: god === 'poseidon' ? 18 : 15 })
  const activeBoons = [...run.preparation.activeBoons]
  if (god === 'poseidon' && !activeBoons.includes('poseidon-calm')) activeBoons.push('poseidon-calm')
  if (god === 'hermes' && !activeBoons.includes('hermes-speed')) activeBoons.push('hermes-speed')
  return {
    ...run,
    progression: { ...run.progression, coins: run.progression.coins - coinCost },
    resources: applyEffects(run.resources, resourceCosts[god]),
    campaign: { ...run.campaign, gods, doom: god === 'hades' ? Math.max(0, run.campaign.doom - 5) : run.campaign.doom },
    preparation: {
      ...run.preparation,
      activeBoons,
      offeredNodeIndexes: [...run.preparation.offeredNodeIndexes, run.nodeIndex],
    },
    portNotice: `Подношение принято: ${god === 'athena' ? 'Афина' : god === 'poseidon' ? 'Посейдон' : god === 'hermes' ? 'Гермес' : 'Аид'} стал благосклоннее.`,
  }
}

export function scoutNextRoute(run: RunState): RunState {
  if (!canPrepare(run)) return run
  const nextIndex = run.nodeIndex + 1
  const nextNode = run.route[nextIndex]
  if (!nextNode || run.preparation.scoutReport?.nodeIndex === nextIndex) return run
  const cost: Effects = { food: -1, water: -2 }
  if (!canAfford(run.resources, cost)) return { ...run, portNotice: 'Разведке нужны 1 пища и 2 воды.' }
  const hasUpgrade = (id: string) => run.ship.upgrades.includes(id)
  const baseDays = Math.max(1, Math.ceil(nextNode.distance / 95)) - (hasUpgrade('broad-sail') ? 1 : 0)
  const flagModifiers = storyFlagModifiers(run.campaign.storyFlags)
  const assignedCompanion = run.ship.companions.find((companion) => companion.id === run.preparation.assignedCompanionId)
  const baseStorm = nextNode.biome === 'storm' ? 0.68 : nextNode.biome === 'civilized' ? 0.14 : 0.36
  const preparationStorm = (run.preparation.watch === 'storm' ? -0.1 : run.preparation.watch === 'forage' ? 0.05 : 0)
    + (assignedCompanion?.temperament === 'seafarer' ? -0.05 : 0)
    + (run.preparation.activeBoons.includes('tiphys-guidance') ? -0.12 : 0)
    + (run.preparation.activeBoons.includes('poseidon-calm') ? -0.1 : 0)
  const stormRisk = Math.max(0.03, Math.min(0.94, baseStorm + difficultyDefinition(run.difficulty).stormModifier + flagModifiers.stormModifier + preparationStorm))
  const normalDays = Math.max(1, baseDays)
  return {
    ...run,
    day: run.day + 1,
    resources: applyEffects(run.resources, cost),
    preparation: {
      ...run.preparation,
      scoutReport: {
        nodeIndex: nextIndex,
        destination: nextNode.name,
        biome: nextNode.biome,
        danger: nextNode.danger,
        boldDays: Math.max(1, baseDays - 1 - (run.preparation.activeBoons.includes('hermes-speed') ? 1 : 0)),
        cautiousDays: Math.max(1, baseDays + 1 - (run.preparation.activeBoons.includes('hermes-speed') ? 1 : 0)),
        foodCost: normalDays * (nextNode.biome === 'verdant' ? 1 : 2),
        waterCost: normalDays * ((hasUpgrade('deep-cisterns') ? 2 : 3) + (nextNode.biome === 'volcanic' ? 1 : 0)),
        stormRisk: Math.round(stormRisk * 100),
      },
    },
    portNotice: `Разведка завершена: ${nextNode.name}. Отчёт доступен на карте.`,
  }
}

export function portOfferCost(run: RunState, baseCost: number) {
  return run.preparation.activeBoons.includes('sinon-market') ? Math.max(1, Math.ceil(baseCost * 0.75)) : baseCost
}

function consumeMarketBoon(run: RunState) {
  return {
    ...run.preparation,
    activeBoons: run.preparation.activeBoons.filter((boon) => boon !== 'sinon-market'),
  }
}

export function getPortStock(run: RunState) {
  const random = seededRandom(run.seed + run.nodeIndex * 7919)
  return {
    equipment: shuffle(equipment, random).slice(0, 3),
    upgrades: shuffle(shipUpgrades, random).slice(0, 2),
    companion: shuffle(recruitableCompanions, random)[0],
  }
}

function addPortLog(run: RunState, title: string, text: string): RunState {
  return {
    ...run,
    portNotice: text,
    log: [
      { id: `port-${run.seed}-${run.day}-${title}-${run.log.length}`, day: run.day, title, text, tone: 'good' as const },
      ...run.log,
    ].slice(0, 24),
  }
}

export function buyPortOffer(run: RunState, offerId: string): RunState {
  if (run.phase !== 'port') return run
  const service = portServices.find((entry) => entry.id === offerId)
  if (service) {
    const cost = portOfferCost(run, service.cost)
    if (run.progression.coins < cost) return { ...run, portNotice: 'Не хватает драхм.' }
    const resources = applyEffects(run.resources, service.effects)
    if ((Object.keys(service.effects) as ResourceKey[]).every((key) => resources[key] === run.resources[key])) {
      return { ...run, portNotice: 'Запасы этого типа уже полны.' }
    }
    const purchased = {
      ...run,
      resources,
      progression: { ...run.progression, coins: run.progression.coins - cost },
      preparation: consumeMarketBoon(run),
    }
    return addPortLog(purchased, 'Сделка в порту', `${service.name}: ${service.description}.`)
  }

  const item = equipment.find((entry) => entry.id === offerId)
  if (item) {
    if (run.progression.inventory.includes(item.id)) return equipItem(run, item.id)
    const cost = portOfferCost(run, item.cost)
    if (run.progression.coins < cost) return { ...run, portNotice: 'Торговец качает головой: не хватает драхм.' }
    const purchased = {
      ...run,
      progression: {
        ...run.progression,
        coins: run.progression.coins - cost,
        inventory: [...run.progression.inventory, item.id],
        equipment: { ...run.progression.equipment, [item.slot]: item.id },
      },
      preparation: consumeMarketBoon(run),
    }
    return addPortLog(purchased, 'Новое снаряжение', `${item.name} теперь принадлежит Одиссею и сразу экипирован.`)
  }

  const upgrade = shipUpgrades.find((entry) => entry.id === offerId)
  if (upgrade) {
    if (run.ship.upgrades.includes(upgrade.id)) return { ...run, portNotice: 'Это улучшение уже установлено.' }
    const cost = portOfferCost(run, upgrade.cost)
    if (run.progression.coins < cost) return { ...run, portNotice: 'Корабельщики требуют больше драхм.' }
    const purchased = {
      ...run,
      progression: { ...run.progression, coins: run.progression.coins - cost },
      ship: { ...run.ship, upgrades: [...run.ship.upgrades, upgrade.id] },
      preparation: consumeMarketBoon(run),
    }
    return addPortLog(purchased, 'Корабль укреплён', `${upgrade.name}: ${upgrade.description}`)
  }

  const companion = recruitableCompanions.find((entry) => entry.id === offerId)
  if (companion) {
    const cost = portOfferCost(run, 28)
    if (run.ship.companions.some((entry) => entry.id === companion.id)) return { ...run, portNotice: 'Этот спутник уже на борту.' }
    if (run.progression.coins < cost) return { ...run, portNotice: 'Не хватает драхм, чтобы оплатить долю спутника.' }
    const purchased = {
      ...run,
      progression: { ...run.progression, coins: run.progression.coins - cost },
      ship: {
        ...run.ship,
        companions: [...run.ship.companions, { ...companion, memories: [] }],
        cohesion: Math.min(100, run.ship.cohesion + 5),
      },
      preparation: consumeMarketBoon(run),
    }
    return addPortLog(purchased, 'Новый спутник', `${companion.name}, ${companion.role.toLowerCase()}, присоединяется к походу.`)
  }

  return run
}

export function equipItem(run: RunState, itemId: string): RunState {
  if (!run.progression.inventory.includes(itemId)) return run
  const item = equipment.find((entry) => entry.id === itemId)
  if (!item) return run
  return {
    ...run,
    progression: {
      ...run.progression,
      equipment: { ...run.progression.equipment, [item.slot]: item.id },
    },
    portNotice: `${item.name} экипирован.`,
  }
}

export function settleDebt(run: RunState, debtId: string): RunState {
  const debt = run.debts.find((entry) => entry.id === debtId && entry.status === 'pending')
  if (!debt) return run
  if (!canAfford(run.resources, debt.effects)) {
    return { ...run, portNotice: 'Сейчас выплата этого долга погубит экспедицию. Нужны дополнительные ресурсы.' }
  }
  return {
    ...run,
    resources: applyEffects(run.resources, debt.effects),
    debts: run.debts.map((entry) => entry.id === debt.id ? { ...entry, status: 'paid' as const } : entry),
    ship: {
      ...run.ship,
      cohesion: Math.min(100, run.ship.cohesion + 4),
      mutinyRisk: Math.max(0, run.ship.mutinyRisk - 6),
    },
    portNotice: `Долг «${debt.title}» выплачен до срока.`,
    log: [
      { id: `debt-paid-${debt.id}`, day: run.day, title: 'Долг выплачен', text: debt.description, tone: 'good' as const },
      ...run.log,
    ].slice(0, 32),
  }
}

export function purchaseLegacy(meta: MetaState, boonId: string): MetaState {
  const boon = legacyBoons.find((entry) => entry.id === boonId)
  if (!boon || meta.legacy.includes(boon.id) || meta.kleos < boon.cost) return meta
  return {
    ...meta,
    kleos: meta.kleos - boon.cost,
    legacy: [...meta.legacy, boon.id],
  }
}

export function currentBossDefinition(run: RunState) {
  const bossId = run.boss?.id ?? run.route[run.nodeIndex]?.bossId
  return bosses.find((entry) => entry.id === bossId) ?? bosses[0]
}

export function bossActionChance(run: RunState, action: BossAction) {
  const skill = effectiveSkill(run, action.skill)
  const stagePenalty = (run.boss?.stage ?? 1) * 0.025
  const healthPenalty = run.resources.health < 30 ? 0.08 : 0
  const legacyModifier = run.legacyBoons.includes('thread-of-moira') ? 0.04 : 0
  const difficultyModifier = difficultyDefinition(run.difficulty).chanceModifier
  const flagModifiers = storyFlagModifiers(run.campaign.storyFlags)
  const storyModifier = flagModifiers.bossChance + (currentBossDefinition(run).id === 'scylla' ? flagModifiers.scyllaChance : 0)
  const preparedModifier = run.preparation.preparedSkill === action.skill ? 0.07 : 0
  const companionBoonModifier = run.preparation.activeBoons.includes('idmon-vision') && action.skill === 'will'
    ? 0.08
    : run.preparation.activeBoons.includes('sinon-scheme') && action.skill === 'cunning' ? 0.06 : 0
  const chance = 0.48 + skill * 0.065 - action.difficulty * 0.065 - stagePenalty - healthPenalty + divineSkillModifier(run, action.skill) + legacyModifier + difficultyModifier + storyModifier + preparedModifier + companionBoonModifier
  return Math.max(0.1, Math.min(0.9, chance))
}

function scaledEffects(effects: Effects, multiplier: number) {
  return (Object.entries(effects) as [ResourceKey, number][]).reduce<Effects>((result, [key, value]) => {
    result[key] = value < 0 ? Math.min(-1, Math.round(value * multiplier)) : Math.round(value * multiplier)
    return result
  }, {})
}

function bossRoll(run: RunState, action: BossAction) {
  let hash = 0
  for (let index = 0; index < action.id.length; index += 1) hash = (hash * 33 + action.id.charCodeAt(index)) | 0
  return seededRandom(run.seed + run.nodeIndex * 4099 + (run.boss?.turn ?? 0) * 769 + hash)()
}

export function resolveBossAction(run: RunState, action: BossAction): RunState {
  if (run.phase !== 'boss' || !run.boss) return run
  const definition = currentBossDefinition(run)
  const affordable = canAfford(run.resources, action.cost)
  const hasAffordableAction = definition.actions.some((entry) => canAfford(run.resources, entry.cost))
  if (!affordable && hasAffordableAction) return run
  const debtCreated = !affordable && !hasAffordableAction && action.cost
    ? createDeferredDebt(run, action.title, action.cost)
    : undefined
  const chargedCost = affordable ? action.cost : undefined
  const intent = definition.intents[run.boss.intentIndex % definition.intents.length]
  const success = bossRoll(run, action) <= bossActionChance(run, action)
  const paidResources = applyEffects(run.resources, chargedCost ?? {})
  const damage = success
    ? action.damage + Math.max(0, effectiveSkill(run, action.skill) - 4) * 2
    : Math.max(3, Math.round(action.damage * 0.16))
  const remainingHealth = Math.max(0, run.boss.health - damage)
  const retaliation = scaledEffects(intent.effects, success ? 1 - action.mitigation : 1.22)
  const resources = applyEffects(paidResources, retaliation)
  const healthRatio = remainingHealth / run.boss.maxHealth
  const stage: 1 | 2 | 3 = healthRatio <= 0.34 ? 3 : healthRatio <= 0.68 ? 2 : 1
  const resultText = success
    ? `${action.title}: замысел удался. ${definition.name} теряет ${damage} стойкости, а удар «${intent.title}» ослаблен.`
    : `${action.title}: мойры отвернулись. Нанесено лишь ${damage} урона; ${intent.title.toLowerCase()} обрушивается в полную силу.`
  const combatChoice: Choice = {
    id: action.id,
    title: action.title,
    description: action.description,
    skill: action.skill,
    difficulty: action.difficulty,
    cost: action.cost,
    success: { text: resultText, effects: retaliation },
    failure: { text: resultText, effects: retaliation },
  }
  const remembered = rememberChoice(run, combatChoice, { text: resultText, effects: retaliation }, success, Boolean(debtCreated))
  const shipAfterRound = {
    ...run.ship,
    companions: remembered.companions,
    cohesion: Math.max(0, Math.min(100, run.ship.cohesion + remembered.cohesionDelta)),
    mutinyRisk: Math.max(0, Math.min(100, run.ship.mutinyRisk + remembered.riskDelta)),
  }
  const debtsAfterRound = debtCreated ? [debtCreated, ...run.debts].slice(0, 16) : run.debts

  if (remainingHealth <= 0) {
    const xp = Math.round(definition.rewardXp * (run.legacyBoons.includes('black-sail-legend') ? 1.2 : 1))
    const gained = gainExperience(run.progression, xp, definition.rewardCoins)
    const divineChange: Partial<Record<GodId, number>> = { [definition.god]: -12, athena: 8 }
    const victorious: RunState = {
      ...run,
      resources,
      progression: gained.progression,
      ship: shipAfterRound,
      debts: debtsAfterRound,
      preparation: {
        ...run.preparation,
        preparedSkill: null,
        activeBoons: run.preparation.activeBoons.filter((boon) => boon !== 'sinon-scheme' && boon !== 'idmon-vision'),
      },
      campaign: {
        ...run.campaign,
        gods: applyDivineChanges(run.campaign.gods, divineChange),
        doom: Math.min(100, run.campaign.doom + 5),
        bossesDefeated: [...run.campaign.bossesDefeated, definition.id],
      },
      boss: { ...run.boss, health: 0, turn: run.boss.turn + 1, stage: 3, lastResult: resultText },
      phase: 'resolution',
      resolution: {
        success: true,
        title: `${definition.name} повержена`,
        text: `${resultText} Путь через владения чудовища открыт.`,
        omen: `Победа услышана на Олимпе. ${definition.god === 'poseidon' ? 'Посейдон запомнил вызов.' : 'Боги запомнили имя.'}`,
        effects: mergeEffects(chargedCost, retaliation),
        xp,
        coins: definition.rewardCoins,
        levelUp: gained.levelUp,
        divineChange,
        crewReactions: remembered.reactions,
        debtCreated,
      },
      log: [
        { id: `boss-win-${run.seed}-${definition.id}`, day: run.day, title: `${definition.name} повержена`, text: resultText, tone: 'good' as const },
        ...run.log,
      ].slice(0, 32),
    }
    return withDeathCheck(victorious)
  }

  const fighting: RunState = {
    ...run,
    resources,
    ship: shipAfterRound,
    debts: debtsAfterRound,
    preparation: {
      ...run.preparation,
      preparedSkill: null,
      activeBoons: run.preparation.activeBoons.filter((boon) => boon !== 'sinon-scheme' && boon !== 'idmon-vision'),
    },
    boss: {
      ...run.boss,
      health: remainingHealth,
      turn: run.boss.turn + 1,
      stage,
      intentIndex: (run.boss.intentIndex + 1) % definition.intents.length,
      lastResult: resultText,
    },
    log: [
      { id: `boss-${run.seed}-${definition.id}-${run.boss.turn}`, day: run.day, title: `Бой: ${definition.name}`, text: resultText, tone: success ? ('good' as const) : ('bad' as const) },
      ...run.log,
    ].slice(0, 32),
  }
  return withDeathCheck(fighting)
}

function actForNode(nodeIndex: number): 1 | 2 | 3 {
  if (nodeIndex <= 3) return 1
  if (nodeIndex <= 7) return 2
  return 3
}

function prophecyFulfilled(run: RunState) {
  const prophecyId = run.campaign.prophecy.id
  if (prophecyId === 'many-oars') return run.resources.crew >= 14
  if (prophecyId === 'nobody-thrice') return run.campaign.decisions.filter((decision) => decision.skill === 'cunning' && decision.success).length >= 3
  if (prophecyId === 'unbroken-keel') return run.campaign.bossesDefeated.length >= 2 && run.resources.hull >= 65
  return run.progression.coins <= 8 && run.resources.morale >= 60
}

function chooseEnding(run: RunState, fulfilled: boolean) {
  const cunningWins = run.campaign.decisions.filter((decision) => decision.skill === 'cunning' && decision.success).length
  if (run.campaign.gods.athena >= 32 && run.campaign.bossesDefeated.length >= 2 && fulfilled) return endings.divine
  if (run.resources.crew >= 14 && run.resources.morale >= 50) return endings.hero
  if (cunningWins >= 3) return endings.shadow
  return endings.hollow
}

const crisisApproaches: Record<CrewCrisisApproach, { skill: Skill; difficulty: number; title: string }> = {
  council: { skill: 'will', difficulty: 5, title: 'Созвать совет у мачты' },
  bribe: { skill: 'cunning', difficulty: 4, title: 'Купить верность долями добычи' },
  punish: { skill: 'valor', difficulty: 5, title: 'Показательно наказать зачинщиков' },
}

export function crewCrisisChance(run: RunState, approach: CrewCrisisApproach) {
  const definition = crisisApproaches[approach]
  const chance = 0.44
    + effectiveSkill(run, definition.skill) * 0.07
    - definition.difficulty * 0.07
    + (run.ship.cohesion - 50) / 500
    + difficultyDefinition(run.difficulty).chanceModifier
    + storyFlagModifiers(run.campaign.storyFlags).crisisChance
  return Math.max(0.12, Math.min(0.9, chance))
}

export function resolveCrewCrisis(run: RunState, approach: CrewCrisisApproach): RunState {
  if (run.phase !== 'crew-crisis' || !run.crewCrisis) return run
  if (approach === 'bribe' && run.progression.coins < 15) return run
  if (approach === 'punish' && run.resources.crew <= 2) return run
  const definition = crisisApproaches[approach]
  const roll = seededRandom(run.seed + run.day * 1877 + approach.length * 97)()
  const success = roll <= crewCrisisChance(run, approach)
  const leaderId = run.crewCrisis.leaderId
  const leader = run.ship.companions.find((companion) => companion.id === leaderId) ?? run.ship.companions[0]
  const coins = run.progression.coins - (approach === 'bribe' ? 15 : 0)
  const baseEffects: Effects = approach === 'punish' ? { crew: -1, morale: -4 } : {}
  const failureEffects: Effects = success ? {} : approach === 'punish' ? { crew: -1, morale: -10 } : { morale: -9 }
  const effects = mergeEffects(baseEffects, failureEffects)
  const resources = applyEffects(run.resources, effects)
  const loyaltyDelta = success
    ? approach === 'council' ? 12 : approach === 'bribe' ? 7 : -4
    : approach === 'punish' ? -14 : -9
  const reaction: CrewReaction = {
    companionId: leader.id,
    name: leader.name,
    loyaltyDelta,
    reaction: success && approach !== 'punish' ? 'approve' : approach === 'punish' ? 'fear' : 'disapprove',
    text: success
      ? approach === 'council'
        ? `${leader.name} получает право высказать претензии и признаёт ответ царя.`
        : approach === 'bribe'
          ? `${leader.name} принимает новую долю добычи, хотя доверие остаётся купленным.`
          : `${leader.name} отступает перед силой, но запоминает унижение.`
      : `${leader.name} считает ответ Одиссея новым доказательством того, что царю нельзя доверять.`,
  }
  let companions = run.ship.companions.map((companion) => companion.id === leader.id ? {
    ...companion,
    loyalty: Math.max(0, Math.min(100, companion.loyalty + loyaltyDelta)),
    fear: Math.max(0, Math.min(100, companion.fear + (approach === 'punish' ? 15 : success ? -2 : 6))),
    respect: Math.max(0, Math.min(100, companion.respect + (success ? 5 : -5))),
    memories: [{
      id: `crisis-memory-${run.seed}-${run.day}-${companion.id}`,
      day: run.day,
      choiceId: `crisis-${approach}`,
      title: definition.title,
      reaction: reaction.reaction,
      text: reaction.text,
      loyaltyDelta,
    }, ...companion.memories].slice(0, 8),
  } : companion)
  const departing = !success && (leader.loyalty + loyaltyDelta <= 20)
  const departedCompanions = departing
    ? [...run.ship.departedCompanions, ...companions.filter((companion) => companion.id === leader.id)]
    : run.ship.departedCompanions
  if (departing) companions = companions.filter((companion) => companion.id !== leader.id)
  const riskChange = success ? approach === 'council' ? -45 : -32 : 18
  const cohesionChange = success ? approach === 'council' ? 18 : approach === 'bribe' ? 8 : -5 : -14
  const text = success
    ? `${definition.title}: кризис на время улажен.${departing ? ` ${leader.name} всё равно покидает команду.` : ''}`
    : `${definition.title}: зачинщики не приняли ответ.${departing ? ` ${leader.name} отказывается дальше служить Одиссею.` : ''}`
  const next: RunState = {
    ...run,
    resources,
    progression: { ...run.progression, coins },
    ship: {
      ...run.ship,
      companions,
      departedCompanions,
      cohesion: Math.max(0, Math.min(100, run.ship.cohesion + cohesionChange)),
      mutinyRisk: Math.max(0, Math.min(100, run.ship.mutinyRisk + riskChange)),
      lastCrisisDay: run.day,
    },
    crewCrisis: null,
    phase: 'resolution',
    resolution: {
      success,
      title: success ? 'Команда снова берётся за вёсла' : 'Раскол на нижней палубе',
      text,
      effects,
      coins: approach === 'bribe' ? -15 : undefined,
      crewReactions: [reaction],
    },
    log: [
      { id: `crisis-${run.seed}-${run.day}`, day: run.day, title: 'Кризис команды', text, tone: success ? 'good' as const : 'bad' as const },
      ...run.log,
    ].slice(0, 32),
  }
  return withDeathCheck(next)
}

function collectDueDebts(run: RunState, day: number, resources: Resources) {
  const due = run.debts.filter((debt) => debt.status === 'pending' && debt.dueDay <= day)
  if (!due.length) return { resources, debts: run.debts, collected: [] as DeferredDebt[] }
  let nextResources = resources
  due.forEach((debt) => { nextResources = applyEffects(nextResources, debt.effects) })
  const dueIds = new Set(due.map((debt) => debt.id))
  return {
    resources: nextResources,
    debts: run.debts.map((debt) => dueIds.has(debt.id) ? { ...debt, status: 'collected' as const } : debt),
    collected: due,
  }
}

export function continueVoyage(run: RunState, stance: TravelStance = 'bold'): RunState {
  if (run.phase !== 'resolution' && run.phase !== 'port') return run
  if (
    run.phase === 'resolution'
    && run.ship.mutinyRisk >= 65
    && run.day - run.ship.lastCrisisDay >= 3
    && run.ship.companions.length > 0
  ) {
    const leader = [...run.ship.companions].sort((left, right) => left.loyalty - right.loyalty)[0]
    return {
      ...run,
      phase: 'crew-crisis',
      crewCrisis: {
        leaderId: leader.id,
        title: `${leader.name} требует ответа`,
        description: `Верность команды истощена. ${leader.name} собрал недовольных у мачты и требует изменить путь или власть на корабле.`,
      },
      resolution: null,
    }
  }
  const nextIndex = run.nodeIndex + 1
  if (nextIndex >= run.route.length - 1) {
    const homeDay = run.day + 2
    const debtCollection = collectDueDebts(run, homeDay, run.resources)
    const beforeHome: RunState = {
      ...run,
      day: homeDay,
      resources: debtCollection.resources,
      debts: debtCollection.debts,
      ship: {
        ...run.ship,
        cohesion: Math.max(0, run.ship.cohesion - debtCollection.collected.length * 6),
        mutinyRisk: Math.min(100, run.ship.mutinyRisk + debtCollection.collected.length * 11),
      },
      campaign: {
        ...run.campaign,
        doom: Math.min(100, run.campaign.doom + debtCollection.collected.length * 4),
      },
    }
    if (deathReason(beforeHome.resources)) return withDeathCheck(beforeHome)
    const fulfilled = prophecyFulfilled(beforeHome)
    const ending = chooseEnding(beforeHome, fulfilled)
    const rankReward = ending.rank === 'божественный' ? 25 : ending.rank === 'героический' ? 16 : ending.rank === 'тайный' ? 12 : 5
    const kleosEarned = Math.round((45 + beforeHome.campaign.bossesDefeated.length * 8 + (fulfilled ? 20 : 0) + rankReward) * difficultyDefinition(beforeHome.difficulty).kleosMultiplier)
    return {
      ...beforeHome,
      nodeIndex: beforeHome.route.length - 1,
      phase: 'home',
      boss: null,
      kleosEarned,
      campaign: {
        ...beforeHome.campaign,
        act: 3,
        prophecy: { ...beforeHome.campaign.prophecy, fulfilled },
        ending,
      },
      resolution: {
        success: true,
        title: ending.title,
        text: ending.text,
        omen: fulfilled ? `Пророчество «${beforeHome.campaign.prophecy.title}» исполнено.` : 'Пророчество осталось незавершённым и последует за следующей песнью.',
        effects: {},
      },
    }
  }

  const nextNode = run.route[nextIndex]
  const hasUpgrade = (id: string) => run.ship.upgrades.includes(id)
  const baseDays = Math.max(1, Math.ceil(nextNode.distance / 95))
  const stanceDays = stance === 'bold' ? -1 : 1
  const travelDays = Math.max(1, baseDays - (hasUpgrade('broad-sail') ? 1 : 0) + stanceDays - (run.preparation.activeBoons.includes('hermes-speed') ? 1 : 0))
  const random = seededRandom(run.seed + nextIndex * 1301 + (stance === 'bold' ? 17 : 41))
  const difficultyConfig = difficultyDefinition(run.difficulty)
  const flagModifiers = storyFlagModifiers(run.campaign.storyFlags)
  const rationMultiplier = run.preparation.rations === 'strict' ? 0.75 : run.preparation.rations === 'generous' ? 1.25 : 1
  const watchMultiplier = run.preparation.watch === 'forage' ? 0.85 : 1
  const foodRate = nextNode.biome === 'verdant' ? 1 : 2
  const waterRate = (hasUpgrade('deep-cisterns') ? 2 : 3) + (nextNode.biome === 'volcanic' ? 1 : 0)
  const attrition: Effects = {
    food: -Math.max(1, Math.round(travelDays * foodRate * difficultyConfig.travelMultiplier * rationMultiplier * watchMultiplier)),
    water: -Math.max(1, Math.round(travelDays * waterRate * difficultyConfig.travelMultiplier * rationMultiplier * watchMultiplier)),
    morale: (stance === 'bold' ? 2 : 0)
      + (run.preparation.rations === 'strict' ? -4 : run.preparation.rations === 'generous' ? 4 : 0)
      + (run.preparation.watch === 'storm' ? -1 : 0),
  }
  ;(Object.entries(flagModifiers.travelEffects) as [ResourceKey, number][]).forEach(([key, value]) => {
    attrition[key] = (attrition[key] ?? 0) + value
  })
  let travelText = stance === 'bold'
    ? `Вы выбрали прямой курс: ${travelDays} ${travelDays === 1 ? 'день' : 'дня'} под полным парусом.`
    : `Осторожный обход занял ${travelDays} дня, но кормчий держался вдали от худших течений.`
  const latestStoryFlag = run.campaign.storyFlags.at(-1)
  if (latestStoryFlag && (flagModifiers.stormModifier !== 0 || Object.keys(flagModifiers.travelEffects).length > 0)) {
    travelText += ` Мир помнит: ${latestStoryFlag.echo}`
  }
  const baseStormChance = nextNode.biome === 'storm' ? 0.68 : nextNode.biome === 'civilized' ? 0.14 : 0.36
  const assignedCompanion = run.ship.companions.find((companion) => companion.id === run.preparation.assignedCompanionId)
  const preparationStormModifier = (run.preparation.watch === 'storm' ? -0.1 : run.preparation.watch === 'forage' ? 0.05 : 0)
    + (assignedCompanion?.temperament === 'seafarer' ? -0.05 : 0)
    + (run.preparation.activeBoons.includes('tiphys-guidance') ? -0.12 : 0)
    + (run.preparation.activeBoons.includes('poseidon-calm') ? -0.1 : 0)
  const stormChance = Math.max(0.03, Math.min(0.94, baseStormChance + (stance === 'bold' ? 0.16 : -0.2) + difficultyConfig.stormModifier + flagModifiers.stormModifier + preparationStormModifier))
  const roll = random()
  if (roll < stormChance) {
    const rawDamage = (5 + Math.floor(random() * 9)) * (stance === 'bold' ? 1.2 : 0.72)
    const stormDamage = Math.max(1, Math.round(rawDamage) - (hasUpgrade('reinforced-hull') ? 4 : 0))
    attrition.hull = -stormDamage
    attrition.morale = (attrition.morale ?? 0) - 3
    travelText += ` Ночной шквал отнял ${stormDamage} прочности корпуса.`
  } else if (roll > 0.8) {
    attrition.morale = (attrition.morale ?? 0) + (hasUpgrade('gorgon-prow') ? 7 : 4)
    travelText += ' Попутный ветер поднял дух гребцов.'
  }
  if (nextNode.biome === 'abyssal') attrition.morale = (attrition.morale ?? 0) - 3
  if (nextNode.biome === 'sacred') attrition.morale = (attrition.morale ?? 0) + 2
  if (run.resources.crew < 10) attrition.morale = (attrition.morale ?? 0) - 3

  const arrivalDay = run.day + travelDays
  let resources = applyEffects(run.resources, attrition)
  const debtCollection = collectDueDebts(run, arrivalDay, resources)
  resources = debtCollection.resources
  const assignmentCohesion = assignedCompanion?.temperament === 'cautious' ? 3 : 0
  const assignmentRisk = assignedCompanion?.temperament === 'cautious' ? -4 : 0
  let ship = {
    ...run.ship,
    cohesion: Math.max(0, Math.min(100, run.ship.cohesion - debtCollection.collected.length * 6 + assignmentCohesion)),
    mutinyRisk: Math.max(0, Math.min(100, run.ship.mutinyRisk + debtCollection.collected.length * 11 + assignmentRisk)),
  }
  let progression = run.progression
  if (debtCollection.collected.length) {
    travelText += ` Настал срок ${debtCollection.collected.length} ${debtCollection.collected.length === 1 ? 'долга' : 'долгов'}; команда взыскала обещанную цену.`
  }
  if (nextNode.kind === 'port') {
    const leaving = ship.companions.filter((companion) => companion.loyalty <= 18)
    if (leaving.length) {
      const leavingIds = new Set(leaving.map((companion) => companion.id))
      ship = {
        ...ship,
        companions: ship.companions.filter((companion) => !leavingIds.has(companion.id)),
        departedCompanions: [...ship.departedCompanions, ...leaving],
        cohesion: Math.max(0, ship.cohesion - leaving.length * 8),
      }
      const sinonLeaves = leaving.some((companion) => companion.id === 'sinon')
      progression = sinonLeaves
        ? { ...progression, coins: Math.max(0, progression.coins - 12) }
        : progression
      resources = applyEffects(resources, { morale: -leaving.length * 5 })
      travelText += ` ${leaving.map((companion) => companion.name).join(', ')} ${leaving.length === 1 ? 'покидает' : 'покидают'} корабль в гавани.${sinonLeaves ? ' Вместе с Синоном исчезает часть драхм.' : ''}`
    }
  }
  const nextAct = actForNode(nextIndex)
  const actChanged = nextAct !== run.campaign.act
  const nextBossDefinition = nextNode.bossId ? bosses.find((boss) => boss.id === nextNode.bossId) : undefined
  const bossMaxHealth = nextBossDefinition
    ? Math.round(nextBossDefinition.maxHealth * difficultyDefinition(run.difficulty).bossHealthMultiplier)
    : 0
  const boss: BossState | null = nextBossDefinition ? {
    id: nextBossDefinition.id,
    health: bossMaxHealth,
    maxHealth: bossMaxHealth,
    turn: 1,
    stage: 1,
    intentIndex: 0,
    lastResult: null,
  } : null
  const phase: RunState['phase'] = nextNode.kind === 'port' ? 'port' : nextNode.kind === 'boss' ? 'boss' : 'encounter'
  const next: RunState = {
    ...run,
    nodeIndex: nextIndex,
    day: arrivalDay,
    resources,
    progression,
    ship,
    debts: debtCollection.debts,
    campaign: {
      ...run.campaign,
      act: nextAct,
      doom: Math.max(0, Math.min(100, run.campaign.doom + debtCollection.collected.length * 4 - (assignedCompanion?.temperament === 'prophet' ? 1 : 0))),
    },
    preparation: {
      ...run.preparation,
      activeBoons: run.preparation.activeBoons.filter((boon) => boon !== 'tiphys-guidance' && boon !== 'poseidon-calm' && boon !== 'hermes-speed'),
      scoutReport: null,
    },
    boss,
    phase,
    resolution: null,
    portNotice: nextNode.kind === 'port' ? 'Корабль вошёл в гавань. Торговцы уже поднимаются на борт.' : null,
    log: [
      ...(actChanged ? [{
        id: `act-${run.seed}-${nextAct}`,
        day: run.day + travelDays,
        title: `Начинается акт ${nextAct}`,
        text: nextAct === 2 ? 'Пепел Трои исчез за горизонтом. Теперь путь проходит через открытую войну с морем.' : 'Итака близко, но домой должен вернуться уже другой человек.',
        tone: 'neutral' as const,
      }] : []),
      {
        id: `travel-${run.seed}-${nextIndex}`,
        day: run.day + travelDays,
        title: `Курс: ${nextNode.name}`,
        text: travelText,
        tone: attrition.hull ? ('bad' as const) : ('neutral' as const),
      },
      ...run.log,
    ].slice(0, 32),
  }
  return withDeathCheck(next)
}

export function routeDistance(run: RunState) {
  return run.route.slice(run.nodeIndex + 1).reduce((total, node) => total + node.distance, 0)
}

export function completedDistance(run: RunState) {
  return run.route.slice(0, run.nodeIndex + 1).reduce((total, node) => total + node.distance, 0)
}

export function equippedItem(run: RunState, slot: EquipmentSlot) {
  const id = run.progression.equipment[slot]
  return equipment.find((item) => item.id === id)
}
