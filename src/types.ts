export type Skill = 'cunning' | 'valor' | 'seamanship' | 'will'

export type ResourceKey = 'health' | 'food' | 'water' | 'morale' | 'crew' | 'hull'

export type GodId = 'athena' | 'poseidon' | 'hermes' | 'hades'

export type TravelStance = 'bold' | 'cautious'

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

export interface CampaignState {
  act: 1 | 2 | 3
  gods: Record<GodId, number>
  doom: number
  decisions: DecisionRecord[]
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

export interface RunState {
  version: number
  seed: number
  day: number
  nodeIndex: number
  world: WorldLocation[]
  route: RouteNode[]
  resources: Resources
  skills: Skills
  progression: Progression
  ship: ShipState
  campaign: CampaignState
  boss: BossState | null
  legacyBoons: string[]
  log: LogEntry[]
  phase: 'encounter' | 'resolution' | 'port' | 'boss' | 'dead' | 'home'
  resolution: Resolution | null
  portNotice: string | null
  kleosEarned: number
}

export interface MetaState {
  voyages: number
  bestDistance: number
  kleos: number
  legacy: string[]
  endings: string[]
  prophecies: string[]
}
