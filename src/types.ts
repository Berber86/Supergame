export type Skill = 'cunning' | 'valor' | 'seamanship' | 'will'

export type ResourceKey = 'health' | 'food' | 'water' | 'morale' | 'crew' | 'hull'

export type GodId = 'athena' | 'poseidon' | 'hermes' | 'hades'

export type TravelPackage = 'cautious' | 'standard' | 'hasty'

export type DifficultyId = 'tale' | 'odyssey' | 'wrath'

export interface UiPreferences {
  textScale: 'normal' | 'large' | 'xlarge'
  highContrast: boolean
  reduceMotion: boolean
}

export type Biome =
  | 'open-sea'
  | 'storm'
  | 'ashen'
  | 'sacred'
  | 'verdant'
  | 'abyssal'
  | 'volcanic'
  | 'civilized'

export type EquipmentSlot = 'weapon' | 'armor' | 'talisman'

export interface Resources {
  health: number
  food: number
  water: number
  morale: number
  crew: number
  hull: number
}

export interface Skills {
  cunning: number
  valor: number
  seamanship: number
  will: number
}

export type Effects = Partial<Record<ResourceKey, number>>

export type CompanionTemperament = 'cautious' | 'seafarer' | 'trickster' | 'prophet'

export type NamedCompanionId = 'eurylochus' | 'tiphys' | 'sinon' | 'idmon'

export type CompanionStoryStance = 'trusted' | 'controlled' | 'complicit' | 'resentful' | 'forgiven'

export interface CompanionStoryMark {
  companionId: NamedCompanionId
  episodeId: string
  encounterId: string
  chapter: number
  title: string
  stance: CompanionStoryStance
  choiceId: string
  success: boolean
  day: number
}

export interface CompanionChronicle {
  companionId: NamedCompanionId
  episodes: CompanionStoryMark[]
}

export interface CompanionMemory {
  id: string
  day: number
  choiceId: string
  title: string
  reaction: 'approve' | 'disapprove' | 'fear' | 'admire'
  text: string
  loyaltyDelta: number
}

export interface CrewReaction {
  companionId: string
  name: string
  text: string
  loyaltyDelta: number
  reaction: CompanionMemory['reaction']
}

export interface DeferredDebt {
  id: string
  title: string
  description: string
  source: string
  createdDay: number
  dueDay: number
  effects: Effects
  status: 'pending' | 'paid' | 'collected'
}

export interface CrewCrisisState {
  leaderId: string
  title: string
  description: string
}

export type CrewCrisisApproach = 'council' | 'bribe' | 'punish'

export interface Outcome {
  text: string
  effects: Effects
  omen?: string
  coins?: number
  xp?: number
}

export interface Choice {
  id: string
  title: string
  description: string
  skill: Skill
  difficulty: number
  cost?: Effects
  success: Outcome
  failure: Outcome
}

export interface Encounter {
  id: string
  eyebrow: string
  title: string
  location: string
  description: string
  quote?: string
  threat: 'Низкая угроза' | 'Опасность' | 'Смертельная угроза'
  accent: 'sea' | 'blood' | 'gold' | 'violet'
  choices: Choice[]
}

export interface WorldLocation {
  id: string
  name: string
  region: string
  biome: Biome
  danger: number
  x: number
  y: number
}

export interface RouteNode {
  id: string
  name: string
  region: string
  encounterId: string
  islandId?: string
  bossId?: string
  distance: number
  x: number
  y: number
  kind: 'origin' | 'island' | 'danger' | 'port' | 'boss' | 'destination'
  biome: Biome
  danger: number
}

export interface LogEntry {
  id: string
  day: number
  title: string
  text: string
  tone: 'neutral' | 'good' | 'bad'
}

export interface Resolution {
  success: boolean
  title: string
  text: string
  omen?: string
  effects: Effects
  xp?: number
  coins?: number
  levelUp?: boolean
  divineChange?: Partial<Record<GodId, number>>
  crewReactions?: CrewReaction[]
  debtCreated?: DeferredDebt
  aftermath?: string
  crewVoice?: string
  consequence?: string
  storyFlagsGained?: StoryFlag[]
  companionStoryMark?: CompanionStoryMark
}

export interface EquipmentDefinition {
  id: string
  name: string
  description: string
  slot: EquipmentSlot
  skill: Skill
  bonus: number
  cost: number
  rarity: 'обычный' | 'редкий' | 'легендарный'
}

export interface ShipUpgradeDefinition {
  id: string
  name: string
  description: string
  cost: number
}

export interface Companion {
  id: string
  name: string
  role: string
  trait: string
  loyalty: number
  fear: number
  respect: number
  temperament: CompanionTemperament
  portrait: string
  memories: CompanionMemory[]
  skill: Skill
  bonus: number
}

export interface Progression {
  level: number
  xp: number
  nextLevelXp: number
  skillPoints: number
  coins: number
  equipment: Partial<Record<EquipmentSlot, string>>
  inventory: string[]
}

export interface ShipState {
  name: string
  upgrades: string[]
  companions: Companion[]
  departedCompanions: Companion[]
  cohesion: number
  mutinyRisk: number
  lastCrisisDay: number
}

export type WatchMode = 'balanced' | 'storm' | 'forage'
export type RationMode = 'normal' | 'strict' | 'generous'

export interface PreparationState {
  /** Как готовимся к следующему переходу: один выбор вместо отдельных действий. */
  travelMode: TravelPackage
  assignedCompanionId: string | null
  watch: WatchMode
  rations: RationMode
  activeBoons: string[]
  usedCompanionAbilities: string[]
  offeredNodeIndexes: number[]
}

export interface DecisionRecord {
  id: string
  day: number
  encounterId: string
  choiceId: string
  title: string
  skill: Skill
  success: boolean
}

export interface ProphecyState {
  id: string
  title: string
  text: string
  hint: string
  fulfilled: boolean
}

export interface EndingSummary {
  id: string
  title: string
  subtitle: string
  text: string
  rank: 'мрачный' | 'героический' | 'тайный' | 'божественный'
}

export type StoryFlagTone = 'oath' | 'wrath' | 'alliance' | 'secret'

export interface StoryFlag {
  id: string
  title: string
  description: string
  echo: string
  sourceEncounterId: string
  sourceChoiceId: string
  day: number
  tone: StoryFlagTone
}

export interface CampaignState {
  act: 1 | 2 | 3
  gods: Record<GodId, number>
  doom: number
  decisions: DecisionRecord[]
  storyFlags: StoryFlag[]
  /** Episodes and their consequences heard in earlier voyages. */
  knownCompanionEpisodes: string[]
  knownCompanionStoryMarks: CompanionStoryMark[]
  /** The personal consequences created during this voyage. */
  companionStoryMarks: CompanionStoryMark[]
  /** Final personal songs completed at the threshold of Ithaca. */
  completedCompanionFinales: string[]
  /** A port decision can ask the route director to favour one companion's next chapter. */
  storyFocus: NamedCompanionId | null
  prophecy: ProphecyState
  bossesDefeated: string[]
  ending: EndingSummary | null
}

export interface BossState {
  id: string
  health: number
  maxHealth: number
  turn: number
  stage: 1 | 2 | 3
  intentIndex: number
  lastResult: string | null
}

export interface BossAction {
  id: string
  title: string
  description: string
  skill: Skill
  difficulty: number
  damage: number
  cost?: Effects
  mitigation: number
}

export interface CompanionFinaleState {
  eligibleCompanionIds: NamedCompanionId[]
  selectedCompanionId: NamedCompanionId | null
}

export interface TravelPreview {
  travelMode: TravelPackage
  days: number
  foodCost: number
  waterCost: number
  moraleChange: number
  stormChance: number
  stormDamageRange: [number, number]
  dueDebts: number
  /** Влияние пакета на проверки: Осторожно +5%, Спешно −5%. */
  checkBonus: number
  /** Осторожно включает отдых при отплытии. */
  rest: boolean
}

export interface RunState {
  version: number
  seed: number
  difficulty: DifficultyId
  divineRescueUsed: boolean
  /** Пролог по паре стартовых спутников ещё не сыгран. */
  prologuePending: boolean
  /** Сцена глашатая Посейдона при входе во второй акт ещё не сыграна. */
  heraldPending: boolean
  /** Сцена перед Итакой (после последнего стража) ещё не сыграна. */
  thresholdPending: boolean
  /** Сцена перед Итакой уже сыграна в этом походе. */
  thresholdDone: boolean
  day: number
  nodeIndex: number
  world: WorldLocation[]
  route: RouteNode[]
  resources: Resources
  skills: Skills
  progression: Progression
  ship: ShipState
  preparation: PreparationState
  campaign: CampaignState
  boss: BossState | null
  companionFinale: CompanionFinaleState | null
  crewCrisis: CrewCrisisState | null
  debts: DeferredDebt[]
  legacyBoons: string[]
  log: LogEntry[]
  phase: 'encounter' | 'resolution' | 'port' | 'boss' | 'companion-finale' | 'crew-crisis' | 'dead' | 'home'
  resolution: Resolution | null
  portNotice: string | null
  kleosEarned: number
}

export interface VoyageRecord {
  id: string
  finishedAt: string
  outcome: 'home' | 'dead'
  endingId: string | null
  difficulty: DifficultyId
  day: number
  nodeIndex: number
  bossesDefeated: number
  prophecyFulfilled: boolean
  crew: number
  kleosEarned: number
}

export interface MetaState {
  voyages: number
  bestDistance: number
  kleos: number
  legacy: string[]
  endings: string[]
  prophecies: string[]
  codex: string[]
  /** Personal songs collected across alternate voyages. It carries knowledge, never stat bonuses. */
  companionChronicles: CompanionChronicle[]
  history: VoyageRecord[]
  achievements: string[]
}
