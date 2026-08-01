import { useEffect, useState } from 'react'
import {
  Anchor,
  ArrowLeft,
  Award,
  BarChart3,
  BookOpen,
  Brain,
  Check,
  ChevronRight,
  CircleHelp,
  Coins,
  Compass,
  Contrast,
  Crown,
  Database,
  Download,
  Droplets,
  Eye,
  Flame,
  Heart,
  History,
  Map,
  Menu,
  Navigation,
  Package,
  Plus,
  RotateCcw,
  Save,
  ScrollText,
  Settings,
  Shield,
  Ship,
  ShoppingBag,
  Skull,
  Sparkles,
  Star,
  Swords,
  Trophy,
  Type,
  Upload,
  UserPlus,
  Users,
  Waves,
  Wheat,
  Wind,
  X,
  Zap,
} from 'lucide-react'
import { assetPath } from './assets'
import { acts, bosses, endings as endingDefinitions, godInfo, legacyBoons, normalizeMeta } from './campaign'
import { companionSagas } from './companionSagas'
import { Dialog } from './components/Dialog'
import { TabPanel, Tabs, type TabOption } from './components/Tabs'
import { Toggle } from './components/Toggle'
import { skillLabels } from './data'
import { encounters } from './encounterCatalog'
import { difficulties, difficultyDefinition } from './difficulty'
import { authoredIslands } from './islands'
import {
  DEFAULT_META,
  RESOURCE_MAX,
  assignCompanion,
  bossActionChance,
  buyPortOffer,
  crewCrisisChance,
  canAfford,
  choiceChance,
  completedDistance,
  continueVoyage,
  createRun,
  currentBossDefinition,
  currentEncounter,
  currentIsland,
  effectiveSkill,
  equipItem,
  equippedItem,
  formatEffects,
  getPortStock,
  orderedEncounterChoices,
  portOfferCost,
  portServices,
  purchaseLegacy,
  resolveBossAction,
  resolveChoice,
  resolveCrewCrisis,
  restHero,
  routeDistance,
  scoutNextRoute,
  seekCompanionStory,
  setRationMode,
  setWatchMode,
  settleDebt,
  trainSkill,
  upgradeSkill,
  activateCompanionAbility,
  makeOffering,
} from './game'
import {
  biomeInfo,
  companionDefinition,
  equipment,
  equipmentSlotLabels,
  shipUpgrades,
} from './progression'
import { achievements, chronicleStats, parseBackup, unlockAchievements, voyageRecord } from './release'
import { storyFlagScenes } from './storyFlags'
import type {
  BossAction,
  Choice,
  CrewCrisisApproach,
  DifficultyId,
  EquipmentSlot,
  GodId,
  MetaState,
  RationMode,
  ResourceKey,
  RunState,
  Skill,
  TravelStance,
  UiPreferences,
  WatchMode,
} from './types'
import { bossScenes, defaultScene, endingScenes, preparationScenes, sceneForEncounter, uiScenes } from './visuals'

const SAVE_KEY = 'odyssey-shadow-save-v9'
const EIGHTH_SAVE_KEY = 'odyssey-shadow-save-v8'
const LEGACY_SAVE_KEY = 'odyssey-shadow-save-v7'
const SIXTH_SAVE_KEY = 'odyssey-shadow-save-v6'
const FIFTH_SAVE_KEY = 'odyssey-shadow-save-v5'
const FOURTH_SAVE_KEY = 'odyssey-shadow-save-v4'
const THIRD_SAVE_KEY = 'odyssey-shadow-save-v3'
const SECOND_SAVE_KEY = 'odyssey-shadow-save-v2'
const FIRST_SAVE_KEY = 'odyssey-shadow-save-v1'
const META_KEY = 'odyssey-shadow-meta-v1'
const PREFERENCES_KEY = 'odyssey-ui-preferences-v1'

const DEFAULT_PREFERENCES: UiPreferences = {
  textScale: 'normal',
  highContrast: false,
  reduceMotion: false,
}

const resourceConfig: Record<
  ResourceKey,
  { label: string; Icon: typeof Heart; tone: string }
> = {
  health: { label: 'Здоровье', Icon: Heart, tone: 'red' },
  food: { label: 'Пища', Icon: Wheat, tone: 'amber' },
  water: { label: 'Вода', Icon: Droplets, tone: 'blue' },
  morale: { label: 'Боевой дух', Icon: Flame, tone: 'gold' },
  crew: { label: 'Команда', Icon: Users, tone: 'steel' },
  hull: { label: 'Корпус', Icon: Shield, tone: 'teal' },
}

type WorldTab = 'map' | 'ship' | 'songs' | 'fate' | 'codex' | 'log'

const skillConfig: Record<Skill, { Icon: typeof Brain; short: string }> = {
  cunning: { Icon: Brain, short: 'Хитрость' },
  valor: { Icon: Swords, short: 'Доблесть' },
  seamanship: { Icon: Navigation, short: 'Мореходство' },
  will: { Icon: Flame, short: 'Воля' },
}

function readStorage<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

function migrateSavedRun(legacy: RunState, meta: MetaState = DEFAULT_META) {
  const migrated = createRun(legacy.seed, legacy.legacyBoons ?? [], legacy.difficulty ?? 'odyssey', meta)
  const legacyShip = legacy.ship
  const normalizeCompanion = (companion: RunState['ship']['companions'][number]) => {
    const definition = companionDefinition(companion.id)
    return {
      ...(definition ?? migrated.ship.companions[0]),
      ...companion,
      fear: companion.fear ?? definition?.fear ?? 20,
      respect: companion.respect ?? definition?.respect ?? 50,
      temperament: companion.temperament ?? definition?.temperament ?? 'cautious' as const,
      portrait: companion.portrait ?? definition?.portrait ?? assetPath('art/companion-eurylochus.jpg'),
      memories: companion.memories ?? [],
    }
  }
  return {
    ...migrated,
    divineRescueUsed: legacy.divineRescueUsed ?? false,
    day: legacy.day,
    nodeIndex: Math.max(0, Math.min(legacy.nodeIndex ?? 0, migrated.route.length - 1)),
    resources: legacy.resources,
    skills: legacy.skills,
    log: legacy.log,
    progression: legacy.progression ?? {
      ...migrated.progression,
      coins: migrated.progression.coins + legacy.nodeIndex * 4,
    },
    ship: legacyShip ? {
      ...migrated.ship,
      ...legacyShip,
      companions: (legacyShip.companions ?? []).map(normalizeCompanion),
      departedCompanions: (legacyShip.departedCompanions ?? []).map(normalizeCompanion),
      cohesion: legacyShip.cohesion ?? 72,
      mutinyRisk: legacyShip.mutinyRisk ?? 8,
      lastCrisisDay: legacyShip.lastCrisisDay ?? -10,
    } : migrated.ship,
    campaign: {
      ...migrated.campaign,
      ...legacy.campaign,
      knownCompanionEpisodes: legacy.campaign?.knownCompanionEpisodes ?? migrated.campaign.knownCompanionEpisodes,
      companionStoryMarks: legacy.campaign?.companionStoryMarks ?? [],
      storyFocus: legacy.campaign?.storyFocus ?? null,
    },
    preparation: {
      ...migrated.preparation,
      ...legacy.preparation,
      activeBoons: legacy.preparation?.activeBoons ?? [],
      usedCompanionAbilities: legacy.preparation?.usedCompanionAbilities ?? [],
      restedNodeIndexes: legacy.preparation?.restedNodeIndexes ?? [],
      trainedNodeIndexes: legacy.preparation?.trainedNodeIndexes ?? [],
      offeredNodeIndexes: legacy.preparation?.offeredNodeIndexes ?? [],
      scoutReport: legacy.preparation?.scoutReport ?? null,
    },
    debts: legacy.debts ?? [],
    boss: legacy.boss ?? null,
    crewCrisis: legacy.crewCrisis ?? null,
    phase: legacy.phase ?? 'encounter',
    resolution: legacy.resolution ?? null,
    portNotice: 'Старая песнь перенесена на маршрут, который теперь помнит спутников.',
    kleosEarned: legacy.kleosEarned ?? 0,
  }
}

function loadSavedRun() {
  const current = readStorage<RunState | null>(SAVE_KEY, null)
  if (current?.version === 9) return current
  const legacy = readStorage<RunState | null>(EIGHTH_SAVE_KEY, null)
    ?? readStorage<RunState | null>(LEGACY_SAVE_KEY, null)
    ?? readStorage<RunState | null>(SIXTH_SAVE_KEY, null)
    ?? readStorage<RunState | null>(FIFTH_SAVE_KEY, null)
    ?? readStorage<RunState | null>(FOURTH_SAVE_KEY, null)
    ?? readStorage<RunState | null>(THIRD_SAVE_KEY, null)
    ?? readStorage<RunState | null>(SECOND_SAVE_KEY, null)
    ?? readStorage<RunState | null>(FIRST_SAVE_KEY, null)
  return legacy ? migrateSavedRun(legacy) : null
}

function App() {
  const [run, setRun] = useState<RunState | null>(loadSavedRun)
  const [meta, setMeta] = useState<MetaState>(() => normalizeMeta(readStorage<Partial<MetaState>>(META_KEY, DEFAULT_META)))
  const [screen, setScreen] = useState<'menu' | 'game'>('menu')
  const [confirmNew, setConfirmNew] = useState(false)
  const [showRules, setShowRules] = useState(false)
  const [showLegacy, setShowLegacy] = useState(false)
  const [showDifficulty, setShowDifficulty] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [showArchive, setShowArchive] = useState(false)
  const [mobileView, setMobileView] = useState<'story' | 'hero' | 'world'>('story')
  const [worldTab, setWorldTab] = useState<WorldTab>('map')
  const [preferences, setPreferences] = useState<UiPreferences>(() => readStorage(PREFERENCES_KEY, DEFAULT_PREFERENCES))

  useEffect(() => {
    localStorage.setItem(META_KEY, JSON.stringify(meta))
  }, [meta])

  useEffect(() => {
    if (run) localStorage.setItem(SAVE_KEY, JSON.stringify(run))
  }, [run])

  useEffect(() => {
    localStorage.setItem(PREFERENCES_KEY, JSON.stringify(preferences))
  }, [preferences])

  const startNewRun = (difficulty: DifficultyId) => {
    const nextRun = createRun(Date.now(), meta.legacy, difficulty, meta)
    setRun(nextRun)
    setMeta((current) => ({ ...current, voyages: current.voyages + 1 }))
    setConfirmNew(false)
    setShowDifficulty(false)
    setMobileView('story')
    setScreen('game')
  }

  const requestNewRun = () => {
    if (run && run.phase !== 'dead' && run.phase !== 'home') setConfirmNew(true)
    else setShowDifficulty(true)
  }

  const preferenceClasses = `ui-text-${preferences.textScale} ${preferences.highContrast ? 'ui-high-contrast' : ''} ${preferences.reduceMotion ? 'ui-reduce-motion' : ''}`

  const exportBackup = () => {
    const payload = {
      schema: 'odyssey-shadow-backup',
      version: 1,
      exportedAt: new Date().toISOString(),
      run,
      meta,
      preferences,
    }
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `odyssey-shadow-${new Date().toISOString().slice(0, 10)}.json`
    anchor.click()
    URL.revokeObjectURL(url)
  }

  const importBackup = async (file: File) => {
    const parsed = parseBackup(await file.text())
    if (!parsed.ok) return parsed.message
    const restoredMeta = normalizeMeta(parsed.payload.meta)
    const restoredPreferences: UiPreferences = {
      ...DEFAULT_PREFERENCES,
      ...parsed.payload.preferences,
    }
    const restoredRun = parsed.payload.run
      ? parsed.payload.run.version === 9 ? parsed.payload.run : migrateSavedRun(parsed.payload.run, restoredMeta)
      : null
    setMeta(restoredMeta)
    setRun(restoredRun)
    setPreferences(restoredPreferences)
    setMobileView('story')
    if (!restoredRun) setScreen('menu')
    return `Восстановлено походов: ${restoredMeta.voyages}; записей кодекса: ${restoredMeta.codex.length}.`
  }

  const commitRun = (next: RunState) => {
    if (!run) return
    const endedNow =
      (next.phase === 'dead' || next.phase === 'home') &&
      run.phase !== 'dead' &&
      run.phase !== 'home'
    const discoveries = [
      ...next.campaign.decisions.map((decision) => decision.encounterId),
      ...next.campaign.bossesDefeated,
      ...(next.phase === 'boss' && next.boss ? [next.boss.id] : []),
    ]
    setMeta((current) => {
      const codex = [...new Set([...current.codex, ...discoveries])]
      const chronicles = new globalThis.Map(current.companionChronicles.map((chronicle) => [chronicle.companionId, {
        ...chronicle,
        episodes: [...chronicle.episodes],
      }]))
      next.campaign.companionStoryMarks.forEach((mark) => {
        const chronicle = chronicles.get(mark.companionId) ?? { companionId: mark.companionId, episodes: [] }
        if (!chronicle.episodes.some((episode) => episode.episodeId === mark.episodeId)) {
          chronicle.episodes.push(mark)
          chronicles.set(mark.companionId, chronicle)
        }
      })
      const companionChronicles = [...chronicles.values()]
      const chroniclesChanged = companionChronicles.some((chronicle) => {
        const before = current.companionChronicles.find((entry) => entry.companionId === chronicle.companionId)
        return !before || before.episodes.length !== chronicle.episodes.length
      })
      let updated: MetaState = codex.length === current.codex.length && !chroniclesChanged
        ? current
        : { ...current, codex, companionChronicles }
      if (endedNow) {
        const record = voyageRecord(next)
        const history = current.history.some((voyage) => voyage.id === record.id)
          ? current.history
          : [record, ...current.history].slice(0, 50)
        updated = {
          ...updated,
          history,
          kleos: current.kleos + next.kleosEarned,
          bestDistance: Math.max(current.bestDistance, next.nodeIndex),
          endings: next.campaign.ending && !current.endings.includes(next.campaign.ending.id)
            ? [...current.endings, next.campaign.ending.id]
            : current.endings,
          prophecies: next.campaign.prophecy.fulfilled && !current.prophecies.includes(next.campaign.prophecy.id)
            ? [...current.prophecies, next.campaign.prophecy.id]
            : current.prophecies,
        }
      }
      const unlocked = unlockAchievements(updated)
      return unlocked.length === updated.achievements.length ? updated : { ...updated, achievements: unlocked }
    })
    setRun(next)
  }

  const openStory = () => setMobileView('story')
  const openHero = () => setMobileView('hero')
  const openWorld = (tab: WorldTab) => {
    setWorldTab(tab)
    setMobileView('world')
  }

  if (screen === 'menu') {
    return (
      <div className={preferenceClasses}>
        <TitleScreen
          savedRun={run}
          meta={meta}
          onContinue={() => setScreen('game')}
          onNew={requestNewRun}
          onRules={() => setShowRules(true)}
          onLegacy={() => setShowLegacy(true)}
          onArchive={() => setShowArchive(true)}
          onSettings={() => setShowSettings(true)}
        />
        {confirmNew && (
          <ConfirmModal
            onCancel={() => setConfirmNew(false)}
            onConfirm={() => {
              setConfirmNew(false)
              setShowDifficulty(true)
            }}
          />
        )}
        {showRules && <RulesModal onClose={() => setShowRules(false)} />}
        {showLegacy && (
          <LegacyModal
            meta={meta}
            onBuy={(boonId) => setMeta((current) => purchaseLegacy(current, boonId))}
            onClose={() => setShowLegacy(false)}
          />
        )}
        {showDifficulty && <DifficultyModal onStart={startNewRun} onClose={() => setShowDifficulty(false)} />}
        {showSettings && (
          <AccessibilityModal
            preferences={preferences}
            onChange={setPreferences}
            onClose={() => setShowSettings(false)}
          />
        )}
        {showArchive && (
          <ChronicleModal
            meta={meta}
            onExport={exportBackup}
            onImport={importBackup}
            onClose={() => setShowArchive(false)}
          />
        )}
      </div>
    )
  }

  if (!run) return null

  return (
    <div className={`game-app ${preferenceClasses}`}>
      <GameHeader
        run={run}
        saving={false}
        onMenu={() => setScreen('menu')}
        onRules={() => setShowRules(true)}
        onArchive={() => setShowArchive(true)}
        onSettings={() => setShowSettings(true)}
        onRestart={requestNewRun}
      />
      <CommandBar
        run={run}
        activeView={mobileView}
        worldTab={worldTab}
        onStory={openStory}
        onHero={openHero}
        onWorld={openWorld}
        onArchive={() => setShowArchive(true)}
      />
      {run.portNotice && <div className="game-notice" role="status"><Check size={14} /><span>{run.portNotice}</span><button onClick={() => setRun({ ...run, portNotice: null })} aria-label="Скрыть уведомление"><X size={13} /></button></div>}
      <main className={`game-grid mobile-view-${mobileView}`}>
        <HeroPanel
          run={run}
          onUpgrade={(skill) => commitRun(upgradeSkill(run, skill))}
          onRest={() => commitRun(restHero(run))}
          onTrain={(skill) => commitRun(trainSkill(run, skill))}
        />
        {run.phase === 'crew-crisis' ? (
          <CrewCrisisPanel
            run={run}
            onResolve={(approach) => commitRun(resolveCrewCrisis(run, approach))}
          />
        ) : run.phase === 'boss' ? (
          <BossPanel
            run={run}
            onAction={(action) => commitRun(resolveBossAction(run, action))}
          />
        ) : run.phase === 'port' ? (
          <PortPanel
            run={run}
            onBuy={(offerId) => commitRun(buyPortOffer(run, offerId))}
            onDepart={(stance) => commitRun(continueVoyage(run, stance))}
            onSeekStory={(companionId) => commitRun(seekCompanionStory(run, companionId))}
            onOpenHero={openHero}
            onOpenShip={() => openWorld('ship')}
          />
        ) : (
          <EncounterPanel
            run={run}
            onChoose={(choice) => commitRun(resolveChoice(run, choice))}
            onBlindChoose={(choice) => commitRun(resolveChoice(run, choice, true))}
            onContinue={(stance) => commitRun(continueVoyage(run, stance))}
            onOpenHero={openHero}
            onOpenShip={() => openWorld('ship')}
            onOpenFate={() => openWorld('fate')}
            onOpenSongs={() => openWorld('songs')}
          />
        )}
        <WorldPanel
          run={run}
          meta={meta}
          tab={worldTab}
          onTabChange={setWorldTab}
          onEquip={(itemId) => commitRun(equipItem(run, itemId))}
          onPayDebt={(debtId) => commitRun(settleDebt(run, debtId))}
          onAssignCompanion={(companionId) => commitRun(assignCompanion(run, companionId))}
          onSetWatch={(watch) => commitRun(setWatchMode(run, watch))}
          onSetRations={(rations) => commitRun(setRationMode(run, rations))}
          onUseAbility={(companionId) => commitRun(activateCompanionAbility(run, companionId))}
          onOffering={(god) => commitRun(makeOffering(run, god))}
          onScout={() => commitRun(scoutNextRoute(run))}
        />
      </main>
      <nav className="mobile-dock" aria-label="Разделы игры">
        <div className="mobile-resources">
          <span><Wheat size={11} /> {run.resources.food}</span>
          <span><Droplets size={11} /> {run.resources.water}</span>
          <span><Users size={11} /> {run.resources.crew}</span>
          <span><Shield size={11} /> {run.resources.hull}%</span>
        </div>
        <div className="mobile-tabs">
          <button aria-pressed={mobileView === 'story'} className={mobileView === 'story' ? 'active' : ''} onClick={openStory}><ScrollText size={17} aria-hidden="true" /><span>Сюжет</span></button>
          <button aria-pressed={mobileView === 'hero'} className={mobileView === 'hero' ? 'active' : ''} onClick={openHero}><Crown size={17} aria-hidden="true" /><span>Герой</span>{run.progression.skillPoints > 0 && <b className="nav-badge">{run.progression.skillPoints}</b>}</button>
          <button aria-pressed={mobileView === 'world'} className={mobileView === 'world' ? 'active' : ''} onClick={() => openWorld(worldTab)}><Map size={17} aria-hidden="true" /><span>Мир</span>{run.debts.some((debt) => debt.status === 'pending') && <b className="nav-badge danger">{run.debts.filter((debt) => debt.status === 'pending').length}</b>}</button>
        </div>
      </nav>
      {(run.phase === 'dead' || run.phase === 'home') && !showDifficulty && (
        <EndingOverlay
          run={run}
          meta={meta}
          onNew={() => setShowDifficulty(true)}
          onMenu={() => setScreen('menu')}
        />
      )}
      {confirmNew && (
        <ConfirmModal
          onCancel={() => setConfirmNew(false)}
          onConfirm={() => {
            setConfirmNew(false)
            setShowDifficulty(true)
          }}
        />
      )}
      {showRules && <RulesModal onClose={() => setShowRules(false)} />}
      {showDifficulty && <DifficultyModal onStart={startNewRun} onClose={() => setShowDifficulty(false)} />}
      {showSettings && (
        <AccessibilityModal
          preferences={preferences}
          onChange={setPreferences}
          onClose={() => setShowSettings(false)}
        />
      )}
      {showArchive && (
        <ChronicleModal
          meta={meta}
          onExport={exportBackup}
          onImport={importBackup}
          onClose={() => setShowArchive(false)}
        />
      )}
    </div>
  )
}

interface TitleScreenProps {
  savedRun: RunState | null
  meta: MetaState
  onContinue: () => void
  onNew: () => void
  onRules: () => void
  onLegacy: () => void
  onArchive: () => void
  onSettings: () => void
}

function TitleScreen({ savedRun, meta, onContinue, onNew, onRules, onLegacy, onArchive, onSettings }: TitleScreenProps) {
  return (
    <div className="title-screen">
      <div className="title-art" />
      <div className="title-vignette" />
      <header className="title-header">
        <Brand compact />
        <div className="title-header-actions">
          <button className="ghost-button legacy-button" onClick={onLegacy}>
            <Trophy size={17} /> Наследие <b>{meta.kleos} κ</b>
          </button>
          <button className="ghost-button archive-title-button" onClick={onArchive}>
            <BarChart3 size={17} /> Летопись
          </button>
          <button className="ghost-button" onClick={onRules}>
            <CircleHelp size={17} /> Как играть
          </button>
          <button className="ghost-button settings-title-button" onClick={onSettings} aria-label="Настройки интерфейса">
            <Settings size={17} />
          </button>
        </div>
      </header>

      <section className="title-content">
        <div className="title-kicker"><span /> Мрачная текстовая RPG <span /></div>
        <h1>ОДИССЕЙ</h1>
        <h2>Путь теней</h2>
        <p className="title-lead">
          Троя пала. Итака ждёт. Но между вами и домом — море, которое помнит каждую ложь.
        </p>
        <div className="title-actions">
          {savedRun && (
            <button className="primary-button large" onClick={onContinue}>
              <span>
                <small>{savedRun.phase === 'dead' || savedRun.phase === 'home' ? 'Последнее путешествие' : 'День ' + savedRun.day}</small>
                {savedRun.phase === 'dead' || savedRun.phase === 'home' ? 'Посмотреть итоги' : 'Продолжить путь'}
              </span>
              <ChevronRight size={21} />
            </button>
          )}
          <button className={savedRun ? 'secondary-button large' : 'primary-button large'} onClick={onNew}>
            <span>
              <small>Новая песнь</small>
              Начать путешествие
            </span>
            <Compass size={20} />
          </button>
        </div>
        <div className="title-features">
          <div><Map size={17} /><span><b>35 авторских островов</b>7 в каждом походе</span></div>
          <div><Skull size={17} /><span><b>Одна жизнь</b>Решения имеют цену</span></div>
          <div><Sparkles size={17} /><span><b>{meta.endings.length} из 4 финалов</b>{meta.codex.length} записей кодекса</span></div>
        </div>
      </section>

      <div className="title-quote">
        <span>IX</span>
        «Назови мне, Муза, того многоопытного мужа…»
      </div>
      <div className="title-footer">
        <span>Кампания · Три акта · Четыре финала</span>
        <span className="title-seed">ВЕРСИЯ 1.4.0 · ПОХОДОВ: {String(meta.voyages).padStart(2, '0')}</span>
      </div>
    </div>
  )
}

function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`brand ${compact ? 'compact' : ''}`}>
      <div className="brand-mark"><span>Ω</span></div>
      <div>
        <strong>ОДИССЕЙ</strong>
        <small>ПУТЬ ТЕНЕЙ</small>
      </div>
    </div>
  )
}

interface HeaderProps {
  run: RunState
  saving: boolean
  onMenu: () => void
  onRules: () => void
  onArchive: () => void
  onSettings: () => void
  onRestart: () => void
}

function GameHeader({ run, saving, onMenu, onRules, onArchive, onSettings, onRestart }: HeaderProps) {
  const act = acts[run.campaign.act - 1]
  const difficulty = difficultyDefinition(run.difficulty)
  return (
    <header className="game-header">
      <button className="icon-button menu-button" onClick={onMenu} aria-label="Главное меню">
        <Menu size={20} />
      </button>
      <Brand />
      <div className="header-divider" />
      <div className="chapter-name">
        <span>АКТ {run.campaign.act} · КАМПАНИЯ</span>
        <strong>{act.name}</strong>
      </div>
      <div className={`difficulty-pill difficulty-${run.difficulty}`}>{difficulty.name}</div>
      <div className="header-journey">
        <div><Wind size={16} /><span>ДЕНЬ <b>{run.day}</b></span></div>
        <div><Compass size={16} /><span>ДО ИТАКИ <b>{routeDistance(run)} стадиев</b></span></div>
        <div className="header-coins"><Coins size={16} /><span>ДРАХМЫ <b>{run.progression.coins}</b></span></div>
      </div>
      <div className={`save-state ${saving ? 'active' : ''}`}>
        {saving ? <Check size={15} /> : <Save size={15} />}
        {saving ? 'Сохранено' : 'Автосохранение'}
      </div>
      <button className="icon-button archive-button" onClick={onArchive} aria-label="Летопись и данные">
        <BarChart3 size={18} />
      </button>
      <button className="icon-button settings-button" onClick={onSettings} aria-label="Настройки интерфейса">
        <Settings size={18} />
      </button>
      <button className="icon-button" onClick={onRules} aria-label="Правила">
        <BookOpen size={18} />
      </button>
      <button className="icon-button restart-button" onClick={onRestart} aria-label="Начать заново">
        <RotateCcw size={18} />
      </button>
    </header>
  )
}

function CommandBar({
  run,
  activeView,
  worldTab,
  onStory,
  onHero,
  onWorld,
  onArchive,
}: {
  run: RunState
  activeView: 'story' | 'hero' | 'world'
  worldTab: WorldTab
  onStory: () => void
  onHero: () => void
  onWorld: (tab: WorldTab) => void
  onArchive: () => void
}) {
  const pendingDebts = run.debts.filter((debt) => debt.status === 'pending').length
  const items = [
    { id: 'story', label: 'Событие', Icon: ScrollText, active: activeView === 'story', action: onStory, badge: 0 },
    { id: 'hero', label: 'Герой', Icon: Crown, active: activeView === 'hero', action: onHero, badge: run.progression.skillPoints },
    { id: 'ship', label: 'Корабль', Icon: Ship, active: activeView === 'world' && worldTab === 'ship', action: () => onWorld('ship'), badge: pendingDebts || (run.ship.mutinyRisk >= 65 ? 1 : 0) },
    { id: 'fate', label: 'Судьба', Icon: Eye, active: activeView === 'world' && worldTab === 'fate', action: () => onWorld('fate'), badge: run.campaign.storyFlags.length || (run.campaign.doom >= 60 ? 1 : 0) },
    { id: 'map', label: 'Карта', Icon: Map, active: activeView === 'world' && worldTab === 'map', action: () => onWorld('map'), badge: 0 },
    { id: 'codex', label: 'Кодекс', Icon: BookOpen, active: activeView === 'world' && worldTab === 'codex', action: () => onWorld('codex'), badge: 0 },
  ]
  return (
    <nav className="game-command-bar" aria-label="Основные разделы игры">
      <span className="command-label">КОРАБЕЛЬНЫЙ СОВЕТ</span>
      {items.map(({ id, label, Icon, active, action, badge }) => (
        <button key={id} className={active ? 'active' : ''} aria-pressed={active} onClick={action}>
          <Icon size={14} aria-hidden="true" /><span>{label}</span>{badge > 0 && <b className={`nav-badge ${id === 'ship' ? 'danger' : ''}`}>{badge}</b>}
        </button>
      ))}
      <button onClick={onArchive}><BarChart3 size={14} aria-hidden="true" /><span>Летопись</span></button>
    </nav>
  )
}

function HeroPanel({
  run,
  onUpgrade,
  onRest,
  onTrain,
}: {
  run: RunState
  onUpgrade: (skill: Skill) => void
  onRest: () => void
  onTrain: (skill: Skill) => void
}) {
  const xpPercent = (run.progression.xp / run.progression.nextLevelXp) * 100
  const preparationAllowed = run.phase === 'encounter' || run.phase === 'port' || run.phase === 'resolution'
  const restedHere = run.preparation.restedNodeIndexes.includes(run.nodeIndex)
  const trainedHere = run.preparation.trainedNodeIndexes.includes(run.nodeIndex)
  return (
    <aside className="hero-panel panel">
      <section className="hero-identity">
        <div className="hero-portrait">
          <div className="portrait-ring">Ο</div>
          <span className="level-medal">{run.progression.level}</span>
        </div>
        <div>
          <span className="eyebrow">ЦАРЬ ИТАКИ</span>
          <h3>Одиссей</h3>
          <p>Многоопытный</p>
        </div>
        <div className="coin-purse" title="Драхмы"><Coins size={13} /> {run.progression.coins}</div>
      </section>

      <Meter
        icon={<Heart size={15} />}
        label="Здоровье"
        value={run.resources.health}
        max={RESOURCE_MAX.health}
        tone="health"
        prominent
      />

      <div className="xp-strip">
        <div><span>ОПЫТ</span><b>{run.progression.xp} / {run.progression.nextLevelXp}</b></div>
        <div className="xp-track"><i style={{ width: `${xpPercent}%` }} /></div>
        {run.progression.skillPoints > 0 && (
          <small><Star size={10} /> Доступно очков: {run.progression.skillPoints}</small>
        )}
      </div>

      <section className="hero-preparation-section">
        <div className="preparation-mini-art" style={{ backgroundImage: `url(${preparationScenes.training.src})` }}><span>{preparationScenes.training.caption}</span></div>
        <div className="section-heading"><span>ПОДГОТОВКА ОДИССЕЯ</span><small>{run.preparation.preparedSkill ? `ГОТОВО: ${skillLabels[run.preparation.preparedSkill]}` : 'НЕ ВЫБРАНА'}</small></div>
        <button className="rest-action" onClick={onRest} disabled={!preparationAllowed || restedHere}><Heart size={13} /><span><b>{restedHere ? 'Отдых уже использован' : 'Отдохнуть один день'}</b><small>−3 пищи, −3 воды · +20 здоровья, +6 духа</small></span></button>
        <div className="training-actions">
          {(Object.keys(run.skills) as Skill[]).map((skill) => {
            const Icon = skillConfig[skill].Icon
            return <button className={run.preparation.preparedSkill === skill ? 'active' : ''} key={skill} onClick={() => onTrain(skill)} disabled={!preparationAllowed || trainedHere}><Icon size={12} /><span>{skillLabels[skill]}</span></button>
          })}
        </div>
        <p>Тренировка занимает день, стоит 2 пищи и 1 воду и даёт +7% к следующей подходящей проверке.</p>
      </section>

      <section className="panel-section skills-section">
        <div className="section-heading">
          <span>ХАРАКТЕРИСТИКИ</span>
          <small>УРОВЕНЬ {run.progression.level}</small>
        </div>
        <div className="skills-list">
          {(Object.entries(run.skills) as [Skill, number][]).map(([key, value]) => {
            const { Icon, short } = skillConfig[key]
            const total = effectiveSkill(run, key)
            const bonus = total - value
            return (
              <div className="skill-row" key={key}>
                <Icon size={15} />
                <span>{short}</span>
                <div className="skill-pips">
                  {Array.from({ length: 9 }).map((_, index) => (
                    <i key={index} className={index < total ? index >= value ? 'filled bonus' : 'filled' : ''} />
                  ))}
                </div>
                <b>{total}{bonus > 0 && <small>+{bonus}</small>}</b>
                {run.progression.skillPoints > 0 && value < 9 && (
                  <button className="skill-plus" onClick={() => onUpgrade(key)} title={`Повысить: ${short}`}>
                    <Plus size={11} />
                  </button>
                )}
              </div>
            )
          })}
        </div>
      </section>

      <section className="panel-section supplies-section">
        <div className="section-heading"><span>ЗАПАСЫ</span><small>МАКС. 60</small></div>
        <div className="supplies-grid">
          <ResourceTile resourceKey="food" value={run.resources.food} />
          <ResourceTile resourceKey="water" value={run.resources.water} />
        </div>
      </section>

      <section className="panel-section ship-section">
        <div className="section-heading"><span>{run.ship.name.toUpperCase()}</span><Anchor size={13} /></div>
        <Meter
          icon={<Users size={14} />}
          label="Команда"
          value={run.resources.crew}
          max={RESOURCE_MAX.crew}
          tone="crew"
          suffix="чел."
        />
        <Meter
          icon={<Shield size={14} />}
          label="Корпус"
          value={run.resources.hull}
          max={RESOURCE_MAX.hull}
          tone="hull"
          suffix="%"
        />
        <Meter
          icon={<Flame size={14} />}
          label="Боевой дух"
          value={run.resources.morale}
          max={RESOURCE_MAX.morale}
          tone="morale"
          suffix="%"
        />
      </section>

      <div className="condition-note">
        <Waves size={15} />
        <span><b>{biomeInfo[run.route[run.nodeIndex].biome].name}</b>{biomeInfo[run.route[run.nodeIndex].biome].description}</span>
      </div>
    </aside>
  )
}

interface MeterProps {
  icon: React.ReactNode
  label: string
  value: number
  max: number
  tone: string
  prominent?: boolean
  suffix?: string
}

function Meter({ icon, label, value, max, tone, prominent, suffix }: MeterProps) {
  const percent = Math.max(0, Math.min(100, (value / max) * 100))
  return (
    <div className={`meter ${prominent ? 'prominent' : ''}`}>
      <div className="meter-label">
        <span className={`meter-icon ${tone}`}>{icon}</span>
        <span>{label}</span>
        <b>{value}<small>{suffix ? ` ${suffix}` : ` / ${max}`}</small></b>
      </div>
      <div className="meter-track">
        <div className={`meter-fill ${tone}`} style={{ width: `${percent}%` }} />
        {prominent && <i style={{ left: '35%' }} />}
      </div>
    </div>
  )
}

function ResourceTile({ resourceKey, value }: { resourceKey: 'food' | 'water'; value: number }) {
  const config = resourceConfig[resourceKey]
  const Icon = config.Icon
  const low = value < 12
  return (
    <div className={`resource-tile ${config.tone} ${low ? 'low' : ''}`}>
      <Icon size={18} />
      <span>{config.label}</span>
      <b>{value}<small> / 60</small></b>
    </div>
  )
}

interface EncounterPanelProps {
  run: RunState
  onChoose: (choice: Choice) => void
  onBlindChoose: (choice: Choice) => void
  onContinue: (stance: TravelStance) => void
  onOpenHero: () => void
  onOpenShip: () => void
  onOpenFate: () => void
  onOpenSongs: () => void
}

function EncounterPanel({ run, onChoose, onBlindChoose, onContinue, onOpenHero, onOpenShip, onOpenFate, onOpenSongs }: EncounterPanelProps) {
  const encounter = currentEncounter(run)
  const island = currentIsland(run)
  const encounterScene = sceneForEncounter(encounter)
  const scene = island?.scene
    ? { ...encounterScene, src: island.scene, caption: `${island.name} · ${island.subtitle}` }
    : encounterScene
  const isResolution = run.phase === 'resolution'
  const orderedChoices = orderedEncounterChoices(run)
  const visibleChoices = orderedChoices.slice(0, 2)
  const hiddenChoice = orderedChoices[2]
  const latestStoryFlag = run.campaign.storyFlags.at(-1)
  const focusCompanion = island?.focusCompanionId ? run.ship.companions.find((companion) => companion.id === island.focusCompanionId) : undefined
  const companionHook = focusCompanion ? island?.companionHook : island?.absentHook
  const [showScene, setShowScene] = useState(false)
  return (
    <section className={`encounter-panel panel accent-${encounter.accent}`}>
      <div className="encounter-art illustrated-scene" style={{ backgroundImage: `url(${scene.src})` }}>
        <button className="scene-expand" onClick={() => setShowScene(true)}><Eye size={13} /> Рассмотреть сцену</button>
        <div className="encounter-art-overlay" />
        <div className="encounter-location">
          <span><Map size={13} /> {run.route[run.nodeIndex].name} · {run.route[run.nodeIndex].region}</span>
          <span className={`threat ${encounter.threat === 'Смертельная угроза' ? 'deadly' : ''}`}>
            <Zap size={12} /> {encounter.threat}
          </span>
        </div>
        <div className="encounter-number">{String(run.nodeIndex + 1).padStart(2, '0')}</div>
      </div>

      <div className="encounter-copy">
        <span className="eyebrow">{island?.subtitle ?? encounter.eyebrow} · {biomeInfo[run.route[run.nodeIndex].biome].name}</span>
        <h1>{encounter.title}</h1>
        <div className="ornament"><span /><i>◆</i><span /></div>
        <p>{island?.introduction ?? encounter.description}</p>
        {island?.atmosphere && <div className="island-atmosphere"><Waves size={14} /><span>{island.atmosphere}</span></div>}
        {companionHook && <div className="companion-story-hook">{focusCompanion ? <div style={{ backgroundImage: `url(${focusCompanion.portrait})` }} /> : <Users size={22} />}<span><small>{focusCompanion ? `ЛИЧНОЕ ИСПЫТАНИЕ · ${focusCompanion.name.toUpperCase()}` : 'ОТСУТСТВУЮЩИЙ ГОЛОС'}</small><p>{companionHook}</p></span></div>}
        {latestStoryFlag && <div className={`world-echo tone-${latestStoryFlag.tone}`}><History size={13} /><span><small>ОТГОЛОСОК ПРОШЛОГО</small><b>{latestStoryFlag.title}</b><p>{latestStoryFlag.echo}</p></span></div>}
        {encounter.quote && <blockquote>{encounter.quote}</blockquote>}
      </div>

      {isResolution && run.resolution ? (
        <ResolutionCard run={run} onContinue={onContinue} onOpenHero={onOpenHero} onOpenShip={onOpenShip} onOpenFate={onOpenFate} onOpenSongs={onOpenSongs} />
      ) : (
        <div className="choices-area">
          <div className="choices-heading">
            <span>ДВА ОТКРЫТЫХ РЕШЕНИЯ</span>
            <small>Третий путь останется неизвестным до выбора</small>
          </div>
          <div className="choices-list">
            {visibleChoices.map((choice, index) => (
              <ChoiceButton
                key={choice.id}
                index={index}
                choice={choice}
                run={run}
                onClick={() => onChoose(choice)}
              />
            ))}
            {hiddenChoice && (
              <button className="blind-choice-button" onClick={() => onBlindChoose(hiddenChoice)}>
                <span className="choice-index">III</span>
                <span><strong>Первые два решения мне не подходят</strong><small>Отвергнуть оба и немедленно выбрать неизвестный третий путь. Его шанс, цена и последствия откроются только после решения.</small></span>
                <span className="blind-choice-mark">?</span>
                <ChevronRight size={18} />
              </button>
            )}
          </div>
        </div>
      )}
      {showScene && (
        <Dialog
          className="scene-lightbox-card"
          backdropClassName="scene-lightbox"
          titleId={`scene-title-${encounter.id}`}
          descriptionId={`scene-caption-${encounter.id}`}
          closeLabel="Закрыть иллюстрацию"
          onClose={() => setShowScene(false)}
        >
          <img src={scene.src} alt={`${encounter.title}: ${scene.caption}`} />
          <div><span className="eyebrow">ОТКРЫТО В КОДЕКСЕ</span><h2 id={`scene-title-${encounter.id}`}>{encounter.title}</h2><p id={`scene-caption-${encounter.id}`}>{scene.caption}</p></div>
        </Dialog>
      )}
    </section>
  )
}

function ChoiceButton({
  choice,
  index,
  run,
  onClick,
}: {
  choice: Choice
  index: number
  run: RunState
  onClick: () => void
}) {
  const chance = Math.round(choiceChance(run, choice) * 100)
  const affordable = canAfford(run.resources, choice.cost)
  const hasAffordableChoice = currentEncounter(run).choices.some((entry) => canAfford(run.resources, entry.cost))
  const desperate = !affordable && !hasAffordableChoice
  const { Icon } = skillConfig[choice.skill]
  const chanceTone = chance >= 65 ? 'good' : chance >= 42 ? 'risky' : 'danger'
  const costs = formatEffects(choice.cost).filter((effect) => effect.value < 0)

  return (
    <button className={`choice-button ${desperate ? 'desperate' : ''}`} onClick={onClick} disabled={!affordable && hasAffordableChoice}>
      <span className="choice-index">{['I', 'II', 'III'][index]}</span>
      <span className="choice-main">
        <strong>{choice.title}</strong>
        <small>{choice.description}</small>
        <span className="choice-meta">
          <span><Icon size={13} /> {skillLabels[choice.skill]} {effectiveSkill(run, choice.skill)}</span>
          {costs.map((cost) => {
            const CostIcon = resourceConfig[cost.key].Icon
            return <span className="choice-cost" key={cost.key}><CostIcon size={12} /> {cost.value}</span>
          })}
          {desperate && <em>Последний выход · цена записана в долг</em>}
          {!affordable && hasAffordableChoice && <em>Недостаточно ресурсов</em>}
        </span>
      </span>
      <span className={`chance ${chanceTone}`}>
        <small>ШАНС</small>
        <b>{chance}%</b>
      </span>
      <ChevronRight className="choice-arrow" size={19} />
    </button>
  )
}

function ResolutionCard({
  run,
  onContinue,
  onOpenHero,
  onOpenShip,
  onOpenFate,
  onOpenSongs,
}: {
  run: RunState
  onContinue: (stance: TravelStance) => void
  onOpenHero: () => void
  onOpenShip: () => void
  onOpenFate: () => void
  onOpenSongs: () => void
}) {
  const resolution = run.resolution!
  const nextNode = run.route[run.nodeIndex + 1]
  return (
    <div className={`resolution-card ${resolution.success ? 'success' : 'failure'}`}>
      <div className="resolution-icon">
        {resolution.success ? <Crown size={24} /> : <Skull size={24} />}
      </div>
      <div className="resolution-body">
        <span>{resolution.success ? 'ИСХОД · УСПЕХ' : 'ИСХОД · НЕУДАЧА'}</span>
        <h3>{resolution.title}</h3>
        <p className="resolution-immediate">{resolution.text}</p>
        {resolution.aftermath && (
          <section className="aftermath-reading">
            <span>ПОСЛЕДСТВИЯ РЕШЕНИЯ</span>
            <p>{resolution.aftermath}</p>
            {resolution.crewVoice && <blockquote>{resolution.crewVoice}</blockquote>}
            {resolution.consequence && <div><History size={12} /><b>{resolution.consequence}</b></div>}
          </section>
        )}
        {resolution.omen && <blockquote className="resolution-omen">{resolution.omen}</blockquote>}
        <div className="effect-row">
          {formatEffects(resolution.effects).map(({ key, value }) => {
            const Icon = resourceConfig[key].Icon
            return (
              <span className={value > 0 ? 'positive' : 'negative'} key={key}>
                <Icon size={13} /> {value > 0 ? '+' : ''}{value}
              </span>
            )
          })}
          {resolution.xp !== undefined && <span className="positive"><Star size={13} /> +{resolution.xp} опыта</span>}
          {resolution.coins !== undefined && <span className="coin-reward"><Coins size={13} /> {resolution.coins >= 0 ? `Добыто +${resolution.coins}` : `Потрачено ${Math.abs(resolution.coins)}`} драхм</span>}
          {resolution.divineChange && (Object.entries(resolution.divineChange) as [GodId, number][]).map(([god, value]) => (
            <span className={value > 0 ? 'divine-positive' : 'divine-negative'} key={god}>{godInfo[god].symbol} {value > 0 ? '+' : ''}{value}</span>
          ))}
          {resolution.levelUp && <span className="level-up-chip"><Sparkles size={13} /> Новый уровень</span>}
        </div>
        {resolution.debtCreated && (
          <div className="resolution-debt"><History size={13} /><span><small>ЦЕНА ОТЛОЖЕНА ДО ДНЯ {resolution.debtCreated.dueDay}</small><b>{resolution.debtCreated.title}</b></span></div>
        )}
        {resolution.storyFlagsGained?.map((flag) => (
          <div className={`story-flag-gained tone-${flag.tone}`} key={flag.id}><Sparkles size={14} /><span><small>МИР ЗАПОМНИЛ</small><b>{flag.title}</b><p>{flag.description}</p></span></div>
        ))}
        {resolution.crewReactions && resolution.crewReactions.length > 0 && (
          <div className="resolution-reactions">
            <small>КОМАНДА ЗАПОМНИТ</small>
            {resolution.crewReactions.slice(0, 2).map((reaction) => (
              <p className={reaction.loyaltyDelta >= 0 ? 'positive' : 'negative'} key={reaction.companionId}><Users size={11} /><span><b>{reaction.name} {reaction.loyaltyDelta >= 0 ? '+' : ''}{reaction.loyaltyDelta}</b>{reaction.text}</span></p>
            ))}
          </div>
        )}
        <div className="contextual-links">
          <small>РАЗОБРАТЬ ПОСЛЕДСТВИЯ</small>
          {(resolution.crewReactions?.length || resolution.debtCreated) && <button onClick={onOpenShip}><Ship size={12} /><span>{resolution.debtCreated ? 'Открыть долги и команду' : 'Посмотреть память спутников'}</span><ChevronRight size={12} /></button>}
          {resolution.companionStoryMark && <button onClick={onOpenSongs}><ScrollText size={12} /><span>Открыть песнь экипажа</span><ChevronRight size={12} /></button>}
          {(resolution.levelUp || run.progression.skillPoints > 0) && <button onClick={onOpenHero}><Crown size={12} /><span>Распределить очко героя</span><ChevronRight size={12} /></button>}
          {resolution.divineChange && <button onClick={onOpenFate}><Eye size={12} /><span>Посмотреть реакцию богов</span><ChevronRight size={12} /></button>}
        </div>
      </div>
      <div className="travel-options">
        <small>КУРС: {nextNode?.name ?? 'Итака'}</small>
        <button className="continue-button bold" onClick={() => onContinue('bold')}>
          <span><b>Прямой путь</b><em>Быстрее · шторм опаснее</em></span>
          <Wind size={17} />
        </button>
        <button className="continue-button cautious" onClick={() => onContinue('cautious')}>
          <span><b>Осторожный обход</b><em>Дольше · меньше риск</em></span>
          <Shield size={16} />
        </button>
      </div>
    </div>
  )
}

function CrewCrisisPanel({
  run,
  onResolve,
}: {
  run: RunState
  onResolve: (approach: CrewCrisisApproach) => void
}) {
  const crisis = run.crewCrisis!
  const leader = run.ship.companions.find((companion) => companion.id === crisis.leaderId) ?? run.ship.companions[0]
  const approaches: Array<{ id: CrewCrisisApproach; title: string; description: string; Icon: typeof Brain; disabled: boolean; cost: string }> = [
    { id: 'council', title: 'Созвать совет у мачты', description: 'Выслушать претензии и ответить без царских угроз.', Icon: Brain, disabled: false, cost: 'Воля · без цены' },
    { id: 'bribe', title: 'Купить верность добычей', description: 'Увеличить доли зачинщиков и отложить настоящий спор.', Icon: Coins, disabled: run.progression.coins < 15, cost: '15 драхм' },
    { id: 'punish', title: 'Наказать зачинщиков', description: 'Сохранить власть страхом и потерять ещё одного гребца.', Icon: Swords, disabled: run.resources.crew <= 2, cost: '1 человек · мораль' },
  ]
  return (
    <section className="crew-crisis-panel panel">
      <div className="crisis-hero" style={{ backgroundImage: `url(${leader.portrait})` }}>
        <div className="crisis-vignette" />
        <div><span className="eyebrow">КРИЗИС НА ЧЁРНОМ КОРАБЛЕ</span><h1>{crisis.title}</h1><p>{leader.role}</p></div>
        <div className="crisis-risk"><small>РИСК МЯТЕЖА</small><b>{run.ship.mutinyRisk}%</b></div>
      </div>
      <div className="crisis-body">
        <p>{crisis.description}</p>
        <div className="crisis-leader-state">
          <span>Верность <b>{leader.loyalty}%</b></span><span>Уважение <b>{leader.respect}%</b></span><span>Страх <b>{leader.fear}%</b></span><span>Сплочённость <b>{run.ship.cohesion}%</b></span>
        </div>
        {leader.memories[0] && <blockquote>«{leader.memories[0].text}»</blockquote>}
        <div className="crisis-actions-heading"><span>ОТВЕТ ОДИССЕЯ</span><small>Неудача может привести к уходу спутника</small></div>
        <div className="crisis-actions">
          {approaches.map(({ id, title, description, Icon, disabled, cost }) => {
            const chance = Math.round(crewCrisisChance(run, id) * 100)
            return (
              <button key={id} onClick={() => onResolve(id)} disabled={disabled}>
                <span className="crisis-action-icon"><Icon size={19} /></span>
                <span><b>{title}</b><small>{description}</small><em>{cost}</em></span>
                <span className={`chance ${chance >= 60 ? 'good' : chance >= 40 ? 'risky' : 'danger'}`}><small>ШАНС</small><b>{chance}%</b></span>
              </button>
            )
          })}
        </div>
      </div>
    </section>
  )
}

function BossPanel({ run, onAction }: { run: RunState; onAction: (action: BossAction) => void }) {
  const definition = currentBossDefinition(run)
  const boss = run.boss!
  const intent = definition.intents[boss.intentIndex % definition.intents.length]
  const healthPercent = (boss.health / boss.maxHealth) * 100
  const hasAffordableAction = definition.actions.some((action) => canAfford(run.resources, action.cost))
  return (
    <section className={`boss-panel panel boss-${definition.id} boss-stage-${boss.stage}`}>
      <div className="boss-hero">
        <div className="boss-vignette" />
        <div className="boss-title">
          <span className="eyebrow">СТРАЖ АКТА {run.campaign.act} · РАУНД {boss.turn}</span>
          <h1>{definition.name}</h1>
          <h2>{definition.epithet}</h2>
        </div>
        <div className="boss-stage-mark"><span>ФАЗА</span><b>{boss.stage}</b><small>ИЗ III</small></div>
      </div>

      <div className="boss-body">
        <p className="boss-description">{definition.description}</p>
        <blockquote>{definition.quote}</blockquote>

        <div className="boss-health">
          <div><span><Skull size={14} /> СТОЙКОСТЬ ЧУДОВИЩА</span><b>{boss.health} / {boss.maxHealth}</b></div>
          <div className="boss-health-track"><i style={{ width: `${healthPercent}%` }} /></div>
        </div>

        {boss.lastResult && <div className="boss-last-result"><ScrollText size={14} /> {boss.lastResult}</div>}

        <div className="boss-intent">
          <div className="intent-icon"><Eye size={22} /></div>
          <div><span>СЛЕДУЮЩЕЕ НАМЕРЕНИЕ</span><h3>{intent.title}</h3><p>{intent.description}</p></div>
          <div className="intent-effects">
            {formatEffects(intent.effects).map(({ key, value }) => {
              const Icon = resourceConfig[key].Icon
              return <span key={key}><Icon size={12} /> {value}</span>
            })}
          </div>
        </div>

        <div className="boss-actions-heading"><span>ВАШ ОТВЕТ</span><small>Успех ослабляет намерение; неудача усиливает удар</small></div>
        <div className="boss-actions">
          {definition.actions.map((action) => {
            const chance = Math.round(bossActionChance(run, action) * 100)
            const affordable = canAfford(run.resources, action.cost)
            const desperate = !affordable && !hasAffordableAction
            const SkillIcon = skillConfig[action.skill].Icon
            return (
              <button key={action.id} className={`boss-action ${desperate ? 'desperate' : ''}`} onClick={() => onAction(action)} disabled={!affordable && hasAffordableAction}>
                <span className="boss-action-icon"><SkillIcon size={18} /></span>
                <span className="boss-action-copy"><b>{action.title}</b><small>{action.description}</small><em>{skillLabels[action.skill]} {effectiveSkill(run, action.skill)} · урон {action.damage} · защита {Math.round(action.mitigation * 100)}%{desperate ? ' · цена станет долгом' : ''}</em></span>
                <span className={`chance ${chance >= 60 ? 'good' : chance >= 40 ? 'risky' : 'danger'}`}><small>ШАНС</small><b>{chance}%</b></span>
                {action.cost && <span className="boss-action-cost">{formatEffects(action.cost).map(({ key, value }) => { const Icon = resourceConfig[key].Icon; return <i key={key}><Icon size={11} />{value}</i> })}</span>}
              </button>
            )
          })}
        </div>
      </div>
    </section>
  )
}

function PortPanel({
  run,
  onBuy,
  onDepart,
  onSeekStory,
  onOpenHero,
  onOpenShip,
}: {
  run: RunState
  onBuy: (offerId: string) => void
  onDepart: (stance: TravelStance) => void
  onSeekStory: (companionId: 'eurylochus' | 'tiphys' | 'sinon' | 'idmon') => void
  onOpenHero: () => void
  onOpenShip: () => void
}) {
  const stock = getPortStock(run)
  const current = run.route[run.nodeIndex]
  const companionCost = portOfferCost(run, 28)
  const storyCompanions = run.ship.companions.filter((companion) => ['eurylochus', 'tiphys', 'sinon', 'idmon'].includes(companion.id)) as Array<typeof run.ship.companions[number] & { id: 'eurylochus' | 'tiphys' | 'sinon' | 'idmon' }>
  return (
    <section className="port-panel panel">
      <div className="port-hero">
        <div className="port-hero-overlay" />
        <div className="port-title">
          <span className="eyebrow">БЕЗОПАСНАЯ ГАВАНЬ · {current.region}</span>
          <h1>{current.name}</h1>
          <p>Здесь у каждой вещи есть цена, а у каждой новости — скрытый хозяин.</p>
        </div>
        <div className="port-purse"><Coins size={17} /><span><small>В КОШЕЛЕ</small><b>{run.progression.coins} драхм</b></span></div>
      </div>

      {run.portNotice && <div className="port-notice"><Check size={14} /> {run.portNotice}</div>}

      <div className="port-sail-banner">
        <div><Anchor size={18} /><span><small>КОРАБЛЬ ГОТОВ К ОТПЛЫТИЮ</small><b>Следующий курс — {run.route[run.nodeIndex + 1]?.name ?? 'Итака'}</b></span></div>
        <div>
          <button className="secondary-button" onClick={() => onDepart('cautious')}><Shield size={14} /> Уплыть осторожно</button>
          <button className="primary-button" onClick={() => onDepart('bold')}>Уплыть прямым курсом <Wind size={15} /></button>
        </div>
      </div>

      <div className="port-preparation-links">
        <span>ПЕРЕД ОТПЛЫТИЕМ</span>
        <button onClick={onOpenShip}><Ship size={12} /> Проверить корабль, спутников и долги{run.debts.some((debt) => debt.status === 'pending') && <b>{run.debts.filter((debt) => debt.status === 'pending').length}</b>}</button>
        <button onClick={onOpenHero}><Crown size={12} /> Проверить развитие Одиссея{run.progression.skillPoints > 0 && <b>{run.progression.skillPoints}</b>}</button>
      </div>

      <div className="port-content">
        {storyCompanions.length > 0 && (
          <section className="story-seek-section">
            <div><span className="eyebrow">ПЕСНИ ЭКИПАЖА</span><h3>Чей след искать дальше?</h3><p>В гавани можно заменить одну будущую личную встречу главой выбранного спутника. За поход путь удержит не больше двух таких песен.</p></div>
            <div className="story-seek-actions">
              {storyCompanions.map((companion) => (
                <button key={companion.id} className={run.campaign.storyFocus === companion.id ? 'active' : ''} onClick={() => onSeekStory(companion.id)}>
                  <span className="story-seek-portrait" style={{ backgroundImage: `url(${companion.portrait})` }} />
                  <span><small>{run.campaign.storyFocus === companion.id ? 'СЛЕД ВЫБРАН' : 'ИСКАТЬ СЛЕД'}</small><b>{companion.name}</b></span>
                </button>
              ))}
            </div>
          </section>
        )}
        <section className="market-section services-market">
          <div className="market-heading">
            <div><span className="eyebrow">ПРИЧАЛ И АГОРА</span><h3>Припасы и услуги</h3></div>
            <Package size={19} />
          </div>
          <div className="service-grid">
            {portServices.map((service) => {
              const cost = portOfferCost(run, service.cost)
              return <button
                className="market-offer compact"
                key={service.id}
                onClick={() => onBuy(service.id)}
                disabled={run.progression.coins < cost}
              >
                <span className="offer-symbol"><Package size={15} /></span>
                <span><b>{service.name}</b><small>{service.description}</small></span>
                <em><Coins size={11} /> {cost}</em>
              </button>
            })}
          </div>
        </section>

        <section className="market-section">
          <div className="market-heading">
            <div><span className="eyebrow">РЕДКИЕ ТОВАРЫ</span><h3>Снаряжение героя</h3></div>
            <ShoppingBag size={19} />
          </div>
          <div className="equipment-market">
            {stock.equipment.map((item) => {
              const owned = run.progression.inventory.includes(item.id)
              const equipped = run.progression.equipment[item.slot] === item.id
              const cost = portOfferCost(run, item.cost)
              return (
                <button
                  className={`market-offer ${equipped ? 'owned' : ''}`}
                  key={item.id}
                  onClick={() => onBuy(item.id)}
                  disabled={!owned && run.progression.coins < cost}
                >
                  <span className="offer-symbol"><Swords size={17} /></span>
                  <span>
                    <small>{equipmentSlotLabels[item.slot]} · {item.rarity}</small>
                    <b>{item.name}</b>
                    <p>{item.description}</p>
                  </span>
                  <em>{equipped ? 'Экипировано' : owned ? 'Надеть' : <><Coins size={11} /> {cost}</>}</em>
                </button>
              )
            })}
          </div>
        </section>

        <div className="port-lower-grid">
          <section className="market-section">
            <div className="market-heading small"><div><span className="eyebrow">ВЕРФЬ</span><h3>Улучшения корабля</h3></div><Ship size={18} /></div>
            {stock.upgrades.map((upgrade) => {
              const owned = run.ship.upgrades.includes(upgrade.id)
              const cost = portOfferCost(run, upgrade.cost)
              return (
                <button className={`market-offer compact ${owned ? 'owned' : ''}`} key={upgrade.id} onClick={() => onBuy(upgrade.id)} disabled={owned || run.progression.coins < cost}>
                  <span><b>{upgrade.name}</b><small>{upgrade.description}</small></span>
                  <em>{owned ? 'Готово' : <><Coins size={11} /> {cost}</>}</em>
                </button>
              )
            })}
          </section>
          <section className="market-section companion-offer">
            <div className="market-heading small"><div><span className="eyebrow">ТРАКТИР</span><h3>Именованный спутник</h3></div><UserPlus size={18} /></div>
            <div className="companion-card">
              <div className="companion-avatar portrait" style={{ backgroundImage: `url(${stock.companion.portrait})` }} />
              <div><b>{stock.companion.name}</b><small>{stock.companion.role}</small><p>{stock.companion.trait}. +{stock.companion.bonus} к {skillLabels[stock.companion.skill].toLowerCase()}.</p></div>
              <button onClick={() => onBuy(stock.companion.id)} disabled={run.ship.companions.some((entry) => entry.id === stock.companion.id) || run.progression.coins < companionCost}>
                {run.ship.companions.some((entry) => entry.id === stock.companion.id) ? 'В команде' : <><Coins size={11} /> {companionCost}</>}
              </button>
            </div>
          </section>
        </div>
      </div>

      <div className="port-departure">
        <div><Wind size={17} /><span><small>ВЕТЕР: ЗАПАДНЫЙ</small><b>Следующий курс — {run.route[run.nodeIndex + 1]?.name}</b></span></div>
        <div className="port-route-buttons">
          <button className="secondary-button" onClick={() => onDepart('cautious')}><Shield size={14} /> Уплыть осторожно</button>
          <button className="primary-button" onClick={() => onDepart('bold')}>Уплыть прямым курсом <Wind size={15} /></button>
        </div>
      </div>
    </section>
  )
}

function WorldPanel({
  run,
  meta,
  tab,
  onTabChange,
  onEquip,
  onPayDebt,
  onAssignCompanion,
  onSetWatch,
  onSetRations,
  onUseAbility,
  onOffering,
  onScout,
}: {
  run: RunState
  meta: MetaState
  tab: WorldTab
  onTabChange: (tab: WorldTab) => void
  onEquip: (itemId: string) => void
  onPayDebt: (debtId: string) => void
  onAssignCompanion: (companionId: string | null) => void
  onSetWatch: (watch: WatchMode) => void
  onSetRations: (rations: RationMode) => void
  onUseAbility: (companionId: string) => void
  onOffering: (god: GodId) => void
  onScout: () => void
}) {
  const tabOptions: TabOption<typeof tab>[] = [
    { id: 'map', label: 'Карта', icon: <Map size={13} aria-hidden="true" /> },
    { id: 'ship', label: 'Судно', icon: <Ship size={13} aria-hidden="true" /> },
    { id: 'songs', label: 'Песни', icon: <ScrollText size={13} aria-hidden="true" /> },
    { id: 'fate', label: 'Судьба', icon: <Eye size={13} aria-hidden="true" /> },
    { id: 'codex', label: 'Кодекс', icon: <BookOpen size={13} aria-hidden="true" /> },
    { id: 'log', label: 'Журнал', icon: <History size={13} aria-hidden="true" /> },
  ]
  return (
    <aside className="world-panel panel">
      <Tabs
        idBase="world"
        className="world-tabs six-tabs"
        value={tab}
        options={tabOptions}
        onChange={onTabChange}
        ariaLabel="Разделы мира"
      />
      <TabPanel idBase="world" tabId={tab} className="world-tab-panel">
        {tab === 'map' && <RouteMap run={run} onScout={onScout} />}
        {tab === 'ship' && <ShipPanel run={run} onEquip={onEquip} onPayDebt={onPayDebt} onAssignCompanion={onAssignCompanion} onSetWatch={onSetWatch} onSetRations={onSetRations} onUseAbility={onUseAbility} />}
        {tab === 'songs' && <CompanionSongsPanel run={run} meta={meta} />}
        {tab === 'fate' && <FatePanel run={run} onOffering={onOffering} />}
        {tab === 'codex' && <CodexPanel run={run} meta={meta} />}
        {tab === 'log' && <VoyageLog run={run} />}
      </TabPanel>
    </aside>
  )
}

function CompanionSongsPanel({ run, meta }: { run: RunState; meta: MetaState }) {
  const heard = new Set([
    ...meta.companionChronicles.flatMap((chronicle) => chronicle.episodes.map((episode) => episode.episodeId)),
    ...run.campaign.companionStoryMarks.map((mark) => mark.episodeId),
  ])
  return (
    <div className="companion-songs-content">
      <div className="songs-heading">
        <span className="eyebrow">АРХИВ СПУТНИКОВ</span>
        <h3>Песни экипажа</h3>
        <p>Каждый поход открывает только несколько глав. Память песен сохраняется между возвращениями, но не даёт боевых преимуществ.</p>
      </div>
      <div className="saga-list">
        {companionSagas.map((saga) => {
          const companion = run.ship.companions.find((entry) => entry.id === saga.companionId)
            ?? run.ship.departedCompanions.find((entry) => entry.id === saga.companionId)
            ?? companionDefinition(saga.companionId)
          const heardCount = saga.chapters.filter((chapter) => heard.has(chapter.id)).length
          const nextChapter = saga.chapters.find((chapter) => !heard.has(chapter.id))
          const currentMark = run.campaign.companionStoryMarks.filter((mark) => mark.companionId === saga.companionId).at(-1)
          return (
            <article className={`saga-card ${companion ? 'met' : 'unmet'} ${run.campaign.storyFocus === saga.companionId ? 'focused' : ''}`} key={saga.companionId}>
              <header>
                {companion && <div className="saga-portrait" style={{ backgroundImage: `url(${companion.portrait})` }} />}
                <div><span className="eyebrow">{companion?.role ?? 'НЕВСТРЕЧЕННЫЙ ГОЛОС'}</span><h4>{saga.title}</h4><p>{saga.premise}</p></div>
                <b className="saga-count">{heardCount} / {saga.chapters.length}</b>
              </header>
              <div className="saga-progress"><i style={{ width: `${(heardCount / saga.chapters.length) * 100}%` }} /></div>
              <ol>
                {saga.chapters.map((chapter) => {
                  const unlocked = heard.has(chapter.id)
                  return <li className={unlocked ? 'heard' : ''} key={chapter.id}>
                    <span>{unlocked ? <Check size={12} /> : chapter.chapter}</span>
                    <div><small>{unlocked ? 'УСЛЫШАННАЯ ГЛАВА' : chapter.status === 'future' ? 'ПОСЛЕДНЯЯ ПЕСНЬ' : 'ЗАКРЫТАЯ ГЛАВА'}</small><b>{unlocked ? chapter.title : 'Неизвестная песнь'}</b><p>{unlocked ? chapter.hint : chapter.hint}</p></div>
                  </li>
                })}
              </ol>
              <footer>
                {currentMark ? <span>Последний след: <b>{currentMark.stance === 'trusted' ? 'доверие' : currentMark.stance === 'controlled' ? 'контроль' : currentMark.stance === 'complicit' ? 'общая тайна' : currentMark.stance === 'forgiven' ? 'непростое прощение' : 'обида'}</b></span> : <span>{nextChapter ? `Следующая нить: ${nextChapter.hint}` : 'Эта песнь пока не получила новой главы.'}</span>}
              </footer>
            </article>
          )
        })}
      </div>
    </div>
  )
}

function CodexPanel({ run, meta }: { run: RunState; meta: MetaState }) {
  const currentId = run.phase === 'boss' ? run.boss?.id : run.route[run.nodeIndex]?.encounterId
  const discovered = new Set([...meta.codex, ...(currentId ? [currentId] : [])])
  const entries = [
    ...authoredIslands.map((island) => {
      const encounter = encounters.find((entry) => entry.id === island.encounterId)!
      const baseScene = sceneForEncounter(encounter)
      return {
        id: encounter.id,
        kind: 'myth' as const,
        title: island.name,
        subtitle: island.subtitle,
        description: island.introduction,
        scene: island.scene ? { ...baseScene, src: island.scene, caption: `${island.name} · ${island.subtitle}` } : baseScene,
        tag: encounter.threat,
      }
    }),
    ...bosses.map((boss) => ({
      id: boss.id,
      kind: 'guardian' as const,
      title: boss.name,
      subtitle: boss.epithet,
      description: boss.description,
      scene: bossScenes[boss.id],
      tag: 'Страж пути',
    })),
  ]
  const firstDiscovered = entries.find((entry) => discovered.has(entry.id))
  const [category, setCategory] = useState<'all' | 'myth' | 'guardian'>('all')
  const [selectedId, setSelectedId] = useState(currentId ?? firstDiscovered?.id ?? entries[0].id)
  const selected = entries.find((entry) => entry.id === selectedId && discovered.has(entry.id)) ?? firstDiscovered
  const visibleEntries = category === 'all' ? entries : entries.filter((entry) => entry.kind === category)
  const illustratedCount = entries.filter((entry) => discovered.has(entry.id) && entry.scene.src !== defaultScene.src).length
  const collectedCount = entries.filter((entry) => meta.codex.includes(entry.id)).length

  return (
    <div className="codex-content">
      <div className="codex-heading">
        <span className="eyebrow">ПАМЯТЬ СТРАНСТВИЙ</span>
        <h3>Кодекс мифов</h3>
        <p>Записи и образы сохраняются между экспедициями, даже когда море забирает героя.</p>
        <div className="codex-progress"><i style={{ width: `${(collectedCount / entries.length) * 100}%` }} /><span>{collectedCount} / {entries.length}</span></div>
      </div>

      {selected ? (
        <article className={`codex-feature palette-${selected.scene.palette}`}>
          <div className="codex-feature-art" style={{ backgroundImage: `url(${selected.scene.src})` }}>
            <span>{selected.tag}</span>
          </div>
          <div><small>{selected.subtitle}</small><h4>{selected.title}</h4><p>{selected.description}</p><em><Eye size={11} /> {selected.scene.caption}</em></div>
        </article>
      ) : (
        <div className="codex-empty"><BookOpen size={25} /><span><b>Кодекс пока пуст</b><small>Примите первое решение, чтобы сохранить миф.</small></span></div>
      )}

      <div className="codex-filters">
        <button className={category === 'all' ? 'active' : ''} onClick={() => setCategory('all')}>Все</button>
        <button className={category === 'myth' ? 'active' : ''} onClick={() => setCategory('myth')}>Мифы</button>
        <button className={category === 'guardian' ? 'active' : ''} onClick={() => setCategory('guardian')}>Стражи</button>
      </div>

      <div className="codex-grid">
        {visibleEntries.map((entry) => {
          const unlocked = discovered.has(entry.id)
          return (
            <button className={`${unlocked ? 'unlocked' : 'locked'} ${selected?.id === entry.id ? 'active' : ''}`} key={entry.id} onClick={() => unlocked && setSelectedId(entry.id)} disabled={!unlocked}>
              <span className="codex-thumb" style={unlocked ? { backgroundImage: `url(${entry.scene.src})` } : undefined}>{!unlocked && '?'}</span>
              <span><small>{entry.kind === 'guardian' ? 'СТРАЖ' : 'МИФ'}</small><b>{unlocked ? entry.title : 'Неизвестная песнь'}</b></span>
            </button>
          )
        })}
      </div>
      <div className="codex-visual-count"><Sparkles size={12} /> Иллюстрированных записей открыто: <b>{illustratedCount}</b></div>
    </div>
  )
}

function FatePanel({ run, onOffering }: { run: RunState; onOffering: (god: GodId) => void }) {
  const latestFlag = run.campaign.storyFlags.at(-1)
  return (
    <div className="fate-content">
      <div className="fate-heading">
        <span className="eyebrow">НИТЬ МОЙР</span>
        <h3>Судьба Одиссея</h3>
        <p>Решения меняют не только запасы — они определяют, кто встретит вас на последнем берегу.</p>
      </div>

      <div className="acts-track">
        {acts.map((act) => (
          <div className={`${act.number < run.campaign.act ? 'complete' : ''} ${act.number === run.campaign.act ? 'active' : ''}`} key={act.number}>
            <span>{act.number < run.campaign.act ? <Check size={11} /> : act.number}</span>
            <div><small>АКТ {act.number}</small><b>{act.short}</b></div>
          </div>
        ))}
      </div>

      <section className={`prophecy-card ${run.campaign.prophecy.fulfilled ? 'fulfilled' : ''}`}>
        <div className="prophecy-symbol"><Eye size={20} /></div>
        <span><small>ЛИЧНОЕ ПРОРОЧЕСТВО</small><b>{run.campaign.prophecy.title}</b><blockquote>{run.campaign.prophecy.text}</blockquote><p>{run.campaign.prophecy.hint}</p></span>
      </section>

      <section className="offering-section">
        <div className="preparation-mini-art" style={{ backgroundImage: `url(${preparationScenes.offering.src})` }}><span>{preparationScenes.offering.caption}</span></div>
        <div className="section-heading"><span>ПОДНОШЕНИЕ БОГАМ</span><small>{run.preparation.offeredNodeIndexes.includes(run.nodeIndex) ? 'УЖЕ СОВЕРШЕНО' : 'ОДНО НА ОСТРОВЕ'}</small></div>
        <div className="offering-actions">
          {(Object.keys(godInfo) as GodId[]).map((god) => {
            const costs: Record<GodId, string> = { athena: '8₯ · 2 духа', poseidon: '10₯ · 4 пищи', hermes: '8₯ · 2 пищи/воды', hades: '6₯ · 6 здоровья' }
            return <button key={god} onClick={() => onOffering(god)} disabled={run.preparation.offeredNodeIndexes.includes(run.nodeIndex)}><span>{godInfo[god].symbol}</span><b>{godInfo[god].name}</b><small>{costs[god]}</small></button>
          })}
        </div>
      </section>

      <section className="world-memory-section">
        <div className="section-heading"><span>ПАМЯТЬ МИРА</span><small>{run.campaign.storyFlags.length} ОТГОЛОСКОВ</small></div>
        {latestFlag ? (
          <>
            <div className={`world-memory-hero tone-${latestFlag.tone}`} style={{ backgroundImage: `url(${storyFlagScenes[latestFlag.tone]})` }}>
              <span><small>ПОСЛЕДНИЙ ОТГОЛОСОК</small><b>{latestFlag.title}</b><p>{latestFlag.echo}</p></span>
            </div>
            <div className="world-memory-list">
              {run.campaign.storyFlags.slice().reverse().map((flag) => (
                <article className={`tone-${flag.tone}`} key={flag.id}><i /><span><small>ДЕНЬ {flag.day}</small><b>{flag.title}</b><p>{flag.description}</p></span></article>
              ))}
            </div>
          </>
        ) : <p className="empty-state">Мир ещё не успел запомнить поступки этой экспедиции.</p>}
      </section>

      <section className="divine-relations">
        <div className="section-heading"><span>ОТНОШЕНИЕ БОГОВ</span><small>−100 · +100</small></div>
        {(Object.entries(run.campaign.gods) as [GodId, number][]).map(([god, value]) => (
          <div className="divine-row" key={god}>
            <div className={`god-symbol ${value < -20 ? 'hostile' : value > 20 ? 'favored' : ''}`}>{godInfo[god].symbol}</div>
            <span><b>{godInfo[god].name}</b><small>{value <= -40 ? 'Враждебен' : value < 0 ? 'Недоволен' : value >= 40 ? 'Покровительствует' : value > 0 ? 'Благосклонен' : 'Безразличен'}</small></span>
            <div className="divine-meter"><i className={value < 0 ? 'negative' : 'positive'} style={{ width: `${Math.abs(value) / 2}%`, left: value < 0 ? `${50 - Math.abs(value) / 2}%` : '50%' }} /></div>
            <em>{value > 0 ? '+' : ''}{value}</em>
          </div>
        ))}
      </section>

      <section className="fate-decisions">
        <div className="section-heading"><span>ЛЕТОПИСЬ РЕШЕНИЙ</span><small>РОК {run.campaign.doom}%</small></div>
        {run.campaign.decisions.length === 0 ? <p className="empty-state">Первое решение ещё не принято.</p> : run.campaign.decisions.slice(-5).reverse().map((decision) => (
          <div className={decision.success ? 'good' : 'bad'} key={decision.id}>
            <span>{decision.success ? <Check size={11} /> : <X size={11} />}</span>
            <p><small>ДЕНЬ {decision.day} · {skillLabels[decision.skill].toUpperCase()}</small><b>{decision.title}</b></p>
          </div>
        ))}
      </section>

      <div className="boss-trophies"><Trophy size={14} /><span><b>{run.campaign.bossesDefeated.length} / 2 стражей повержено</b><small>Победы над стражами открывают редкие финалы.</small></span></div>
    </div>
  )
}

function ShipPanel({
  run,
  onEquip,
  onPayDebt,
  onAssignCompanion,
  onSetWatch,
  onSetRations,
  onUseAbility,
}: {
  run: RunState
  onEquip: (itemId: string) => void
  onPayDebt: (debtId: string) => void
  onAssignCompanion: (companionId: string | null) => void
  onSetWatch: (watch: WatchMode) => void
  onSetRations: (rations: RationMode) => void
  onUseAbility: (companionId: string) => void
}) {
  const slots: EquipmentSlot[] = ['weapon', 'armor', 'talisman']
  return (
    <div className="ship-content">
      <div className="ship-heading">
        <div className="ship-emblem"><Ship size={24} /></div>
        <div><span className="eyebrow">АХЕЙСКАЯ ПЕНТЕКОНТЕРА</span><h3>{run.ship.name}</h3><p>{run.resources.crew} гребцов · сплочённость {run.ship.cohesion}% · риск мятежа {run.ship.mutinyRisk}%</p></div>
      </div>

      <section className="voyage-preparation-section">
        <div className="preparation-mini-art" style={{ backgroundImage: `url(${preparationScenes.council.src})` }}><span>{preparationScenes.council.caption}</span></div>
        <div className="section-heading"><span>СОВЕТ ПЕРЕД ПЕРЕХОДОМ</span><small>{run.preparation.assignedCompanionId ? 'СПУТНИК НАЗНАЧЕН' : 'БЕЗ СПУТНИКА'}</small></div>
        <div className="assignment-actions">
          <button className={!run.preparation.assignedCompanionId ? 'active' : ''} onClick={() => onAssignCompanion(null)}>Без спутника</button>
          {run.ship.companions.map((companion) => <button className={run.preparation.assignedCompanionId === companion.id ? 'active' : ''} key={companion.id} onClick={() => onAssignCompanion(companion.id)}>{companion.name}<small>+1 {skillLabels[companion.skill].toLowerCase()}</small></button>)}
        </div>
        <div className="watch-ration-grid">
          <div><small>ВАХТА</small>{(['balanced', 'storm', 'forage'] as WatchMode[]).map((watch) => <button className={run.preparation.watch === watch ? 'active' : ''} key={watch} onClick={() => onSetWatch(watch)}>{watch === 'balanced' ? 'Обычная' : watch === 'storm' ? 'Штормовая' : 'Сбор припасов'}</button>)}</div>
          <div><small>ПАЙКИ</small>{(['normal', 'strict', 'generous'] as RationMode[]).map((ration) => <button className={run.preparation.rations === ration ? 'active' : ''} key={ration} onClick={() => onSetRations(ration)}>{ration === 'normal' ? 'Обычные' : ration === 'strict' ? 'Строгие' : 'Щедрые'}</button>)}</div>
        </div>
        {run.preparation.activeBoons.length > 0 && <div className="active-preparation-boons">{run.preparation.activeBoons.map((boon) => <span key={boon}>{boon === 'tiphys-guidance' ? 'Течение Тифия' : boon === 'sinon-market' ? 'Манифест Синона' : boon === 'idmon-vision' ? 'Видение Идмона' : boon === 'poseidon-calm' ? 'Тишина Посейдона' : boon === 'hermes-speed' ? 'Шаг Гермеса' : boon}</span>)}</div>}
      </section>

      <section className="loadout-section">
        <div className="section-heading"><span>СНАРЯЖЕНИЕ ОДИССЕЯ</span><small>{run.progression.inventory.length} ПРЕДМЕТОВ</small></div>
        <div className="loadout-slots">
          {slots.map((slot) => {
            const item = equippedItem(run, slot)
            return (
              <div className={`loadout-slot ${item ? 'filled' : ''}`} key={slot}>
                <div className="slot-icon">{slot === 'weapon' ? <Swords size={16} /> : slot === 'armor' ? <Shield size={16} /> : <Sparkles size={16} />}</div>
                <span><small>{equipmentSlotLabels[slot]}</small><b>{item?.name ?? 'Пусто'}</b>{item && <em>+{item.bonus} {skillLabels[item.skill].toLowerCase()}</em>}</span>
              </div>
            )
          })}
        </div>
        {run.progression.inventory.length > 0 && (
          <div className="inventory-list">
            {run.progression.inventory.map((itemId) => {
              const item = equipment.find((entry) => entry.id === itemId)
              if (!item) return null
              const active = run.progression.equipment[item.slot] === item.id
              return <button key={item.id} className={active ? 'active' : ''} onClick={() => onEquip(item.id)} disabled={active}>{item.name}<small>{active ? 'Надето' : 'Надеть'}</small></button>
            })}
          </div>
        )}
      </section>

      <section className="ship-upgrades-section">
        <div className="section-heading"><span>ОСНАЩЕНИЕ КОРАБЛЯ</span><small>{run.ship.upgrades.length} / {shipUpgrades.length}</small></div>
        <div className="installed-upgrades">
          {run.ship.upgrades.length === 0 ? (
            <p className="empty-state">Верфи в крупных портах могут усилить корабль.</p>
          ) : run.ship.upgrades.map((upgradeId) => {
            const upgrade = shipUpgrades.find((entry) => entry.id === upgradeId)
            return upgrade ? <div key={upgrade.id}><Check size={13} /><span><b>{upgrade.name}</b><small>{upgrade.description}</small></span></div> : null
          })}
        </div>
      </section>

      <section className="crew-state-section">
        <div className="section-heading"><span>СОСТОЯНИЕ КОМАНДЫ</span><small>{run.ship.mutinyRisk >= 65 ? 'КРИЗИС БЛИЗКО' : 'ПОД КОНТРОЛЕМ'}</small></div>
        <div className="crew-state-bars">
          <div><span>Сплочённость <b>{run.ship.cohesion}%</b></span><i><em style={{ width: `${run.ship.cohesion}%` }} /></i></div>
          <div className={run.ship.mutinyRisk >= 65 ? 'danger' : ''}><span>Риск мятежа <b>{run.ship.mutinyRisk}%</b></span><i><em style={{ width: `${run.ship.mutinyRisk}%` }} /></i></div>
        </div>
      </section>

      <section className="companions-section">
        <div className="section-heading"><span>СПУТНИКИ И ИХ ПАМЯТЬ</span><small>{run.ship.companions.length} НА БОРТУ</small></div>
        <div className="companions-list memory-list">
          {run.ship.companions.map((companion) => {
            const memory = companion.memories[0]
            const abilityUsed = run.preparation.usedCompanionAbilities.includes(`${run.campaign.act}:${companion.id}`)
            const abilityName = companion.id === 'eurylochus' ? 'Созвать общий совет' : companion.id === 'tiphys' ? 'Прочитать течение' : companion.id === 'sinon' ? 'Подготовить манифест' : 'Принять дурной сон'
            return (
              <details className={`crew-companion-card loyalty-${companion.loyalty <= 25 ? 'low' : companion.loyalty >= 70 ? 'high' : 'mid'}`} key={companion.id}>
                <summary>
                  <div className="companion-portrait" style={{ backgroundImage: `url(${companion.portrait})` }} />
                  <span><small>{companion.role}</small><b>{companion.name}</b><em>{companion.trait}</em></span>
                  <div className="companion-numbers"><i>В {companion.loyalty}</i><i>У {companion.respect}</i><i>С {companion.fear}</i></div>
                </summary>
                <div className="companion-memory-body">
                  <div className="memory-stats"><span>Верность <b>{companion.loyalty}%</b></span><span>Уважение <b>{companion.respect}%</b></span><span>Страх <b>{companion.fear}%</b></span></div>
                  {memory ? <blockquote><small>ДЕНЬ {memory.day} · {memory.reaction.toUpperCase()}</small>{memory.text}</blockquote> : <p>Пока не успел составить суждение о решениях Одиссея.</p>}
                  {companion.memories.length > 1 && <small className="memory-count">Запомнено решений: {companion.memories.length}</small>}
                  <button className="companion-ability-button" onClick={() => onUseAbility(companion.id)} disabled={abilityUsed}>{abilityUsed ? 'Способность использована в этом акте' : abilityName}</button>
                </div>
              </details>
            )
          })}
        </div>
        {run.ship.departedCompanions.length > 0 && <p className="departed-note"><Users size={12} /> Покинули песнь: {run.ship.departedCompanions.map((companion) => companion.name).join(', ')}</p>}
      </section>

      <section className="debts-section">
        <div className="section-heading"><span>ОТЛОЖЕННЫЕ ЦЕНЫ</span><small>{run.debts.filter((debt) => debt.status === 'pending').length} АКТИВНО</small></div>
        <div className="debts-list">
          {run.debts.filter((debt) => debt.status === 'pending').length === 0 ? (
            <p className="empty-state">Команда не держит неоплаченных обещаний.</p>
          ) : run.debts.filter((debt) => debt.status === 'pending').map((debt) => (
            <article key={debt.id}>
              <div><small>СРОК: ДЕНЬ {debt.dueDay}</small><b>{debt.title}</b><p>{debt.description}</p></div>
              <div className="debt-effects">{formatEffects(debt.effects).map(({ key, value }) => { const Icon = resourceConfig[key].Icon; return <span key={key}><Icon size={10} />{value}</span> })}</div>
              <button onClick={() => onPayDebt(debt.id)}>Выплатить сейчас</button>
            </article>
          ))}
        </div>
      </section>
      <p className="ship-hint"><ShoppingBag size={13} /> Поступки меняют верность спутников. Невыплаченные цены взыскиваются в день срока.</p>
    </div>
  )
}

function RouteMap({ run, onScout }: { run: RunState; onScout: () => void }) {
  const routePath = run.route.map((node) => `${node.x},${node.y}`).join(' ')
  const completedPath = run.route.slice(0, run.nodeIndex + 1).map((node) => `${node.x},${node.y}`).join(' ')
  const current = run.route[run.nodeIndex]
  return (
    <div className="route-content">
      <div className="route-heading">
        <div>
          <span className="eyebrow">ПУТЬ ЧЕРЕЗ АРХИПЕЛАГ</span>
          <h3>Курс на Итаку</h3>
        </div>
        <div className="world-count"><b>{authoredIslands.length}</b><small>АВТОРСКИХ ОСТРОВОВ</small></div>
      </div>
      <div className="map-wrap">
        <svg className="route-map" viewBox="0 0 100 90" role="img" aria-label="Карта пути до Итаки">
          <defs>
            <filter id="mapGlow"><feGaussianBlur stdDeviation="1.4" result="blur" /><feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
            <pattern id="wavesPattern" width="12" height="8" patternUnits="userSpaceOnUse">
              <path d="M0 5 Q3 2 6 5 T12 5" fill="none" stroke="currentColor" strokeWidth=".22" opacity=".22" />
            </pattern>
          </defs>
          <rect width="100" height="90" fill="url(#wavesPattern)" />
          <g className="world-locations">
            {run.world.map((location) => (
              <circle
                key={location.id}
                cx={location.x}
                cy={location.y}
                r={location.danger === 5 ? 0.55 : 0.32}
                fill={biomeInfo[location.biome].color}
                opacity={location.danger === 5 ? 0.5 : 0.22}
              />
            ))}
          </g>
          <path className="map-contour one" d="M-5,18 C14,8 22,15 33,7 C47,-3 61,6 71,0" />
          <path className="map-contour two" d="M74,88 C74,74 91,73 105,67" />
          <polyline className="route-line shadow" points={routePath} />
          <polyline className="route-line" points={routePath} />
          {completedPath && <polyline className="route-line completed" points={completedPath} />}
          {run.route.map((node, index) => {
            const complete = index < run.nodeIndex
            const active = index === run.nodeIndex
            const future = index > run.nodeIndex
            return (
              <g className={`map-node ${node.kind} ${complete ? 'complete' : ''} ${active ? 'active' : ''} ${future ? 'future' : ''}`} key={node.id}>
                {active && <circle className="node-pulse" cx={node.x} cy={node.y} r="5" />}
                <circle className="node-outer" cx={node.x} cy={node.y} r={node.kind === 'destination' ? 2.6 : 2.2} />
                <circle className="node-inner" cx={node.x} cy={node.y} r=".8" />
                {complete && <path d={`M${node.x - 1.1} ${node.y} l.7 .8 1.5 -1.8`} className="node-check" />}
                {(active || node.kind === 'port' || node.kind === 'destination' || index % 3 === 0) && (
                  <text x={node.x} y={node.y + (index % 2 === 0 ? 7 : -5)} textAnchor="middle" className="node-label">
                    {node.name}
                  </text>
                )}
              </g>
            )
          })}
          <g className="ship-marker" transform={`translate(${current.x - 1.3} ${current.y - 8})`}>
            <path d="M0 5.4h5.2L4.4 7H.8zM2.5 0v5.2M2.7.5l2 3.3h-2z" />
          </g>
          <g className="compass-rose" transform="translate(87 77)">
            <circle r="6" /><path d="M0-5V5M-5 0H5M0-5l1.1 4L0 0l-1.1-1z" /><text y="-7">N</text>
          </g>
        </svg>
        <div className="map-region-label">МОРЕ<br />ТЕНЕЙ</div>
      </div>
      <div className="current-course">
        <div className="course-icon"><Navigation size={18} /></div>
        <div><small>ТЕКУЩЕЕ МЕСТО</small><b>{current.name}</b><span>{current.region} · {biomeInfo[current.biome].name}</span></div>
        <div className="course-distance"><small>ПРОЙДЕНО</small><b>{completedDistance(run)}</b><span>стадиев</span></div>
      </div>
      <section className="scouting-section">
        <div className="preparation-mini-art" style={{ backgroundImage: `url(${preparationScenes.scouting.src})` }}><span>{preparationScenes.scouting.caption}</span></div>
        <div className="section-heading"><span>РАЗВЕДКА ПУТИ</span><small>{run.preparation.scoutReport ? 'ОТЧЁТ ГОТОВ' : '1 ПИЩА · 2 ВОДЫ'}</small></div>
        {run.preparation.scoutReport ? (
          <div className="scout-report">
            <b>{run.preparation.scoutReport.destination}</b><span>{biomeInfo[run.preparation.scoutReport.biome].name} · опасность {run.preparation.scoutReport.danger}/5</span>
            <div><i>Прямой: {run.preparation.scoutReport.boldDays} дн.</i><i>Обход: {run.preparation.scoutReport.cautiousDays} дн.</i><i>Шторм: {run.preparation.scoutReport.stormRisk}%</i><i>≈ {run.preparation.scoutReport.foodCost} пищи / {run.preparation.scoutReport.waterCost} воды</i></div>
          </div>
        ) : <button className="scout-button" onClick={onScout}><Compass size={13} /> Отправить разведчиков на один день</button>}
      </section>
      <div className="gods-panel">
        <div className="section-heading"><span>ВЗОР БОГОВ</span><small>2 ЗНАМЕНИЯ</small></div>
        <div className={`god-row ${run.campaign.gods.poseidon < 0 ? 'hostile' : 'silent'}`}>
          <div className="god-symbol">Ψ</div>
          <span><b>Посейдон</b><small>{run.campaign.gods.poseidon < -35 ? 'Враждебен' : 'Наблюдает'}</small></span>
          <div className="god-value">{run.campaign.gods.poseidon > 0 ? '+' : ''}{run.campaign.gods.poseidon}</div>
        </div>
        <div className="god-row silent">
          <div className="god-symbol">Α</div>
          <span><b>Афина</b><small>{run.campaign.gods.athena > 25 ? 'Благосклонна' : 'Наблюдает'}</small></span>
          <div className="god-value">{run.campaign.gods.athena > 0 ? '+' : ''}{run.campaign.gods.athena}</div>
        </div>
      </div>
      <p className="map-hint"><Compass size={13} /> Каждый новый поход меняет острова, встречи и морские пути.</p>
    </div>
  )
}

function VoyageLog({ run }: { run: RunState }) {
  return (
    <div className="log-content">
      <div className="log-heading">
        <span className="eyebrow">СВИДЕТЕЛЬСТВО ПУТИ</span>
        <h3>Судовой журнал</h3>
        <p>Чернила сохраняют то, что люди предпочли бы забыть.</p>
      </div>
      <div className="timeline">
        {run.log.map((entry, index) => (
          <article className={`log-entry ${entry.tone}`} key={entry.id}>
            <div className="timeline-mark">{index === 0 ? <Anchor size={12} /> : null}</div>
            <small>ДЕНЬ {entry.day}</small>
            <h4>{entry.title}</h4>
            <p>{entry.text}</p>
          </article>
        ))}
      </div>
    </div>
  )
}

function EndingOverlay({
  run,
  meta,
  onNew,
  onMenu,
}: {
  run: RunState
  meta: MetaState
  onNew: () => void
  onMenu: () => void
}) {
  const victory = run.phase === 'home'
  const endingScene = victory && run.campaign.ending ? endingScenes[run.campaign.ending.id] : null
  return (
    <Dialog
      className="ending-card"
      backdropClassName="ending-overlay"
      titleId="ending-title"
      descriptionId="ending-description"
      onClose={onMenu}
      showClose={false}
    >
        {endingScene && (
          <div className="ending-visual" style={{ backgroundImage: `url(${endingScene.src})` }}>
            <span><Eye size={12} /> {endingScene.caption}</span>
          </div>
        )}
        <div className={`ending-emblem ${victory ? 'victory' : ''}`}>
          {victory ? <Crown size={32} /> : <Skull size={32} />}
        </div>
        <span className="eyebrow">{victory ? run.campaign.ending?.subtitle ?? 'ПЕСНЬ ЗАВЕРШЕНА' : 'ПОХОД ОКОНЧЕН'}</span>
        <h2 id="ending-title">{victory ? run.campaign.ending?.title ?? 'Итака на рассвете' : 'Море не знает могил'}</h2>
        {victory && run.campaign.ending && <div className={`ending-rank rank-${run.campaign.ending.rank}`}>{run.campaign.ending.rank} финал</div>}
        <p id="ending-description">{run.resolution?.text}</p>
        {run.resolution?.omen && <blockquote>{run.resolution.omen}</blockquote>}
        <div className="ending-stats">
          <div><small>ДНЕЙ В МОРЕ</small><b>{run.day}</b></div>
          <div><small>СТРАЖЕЙ ПОВЕРЖЕНО</small><b>{run.campaign.bossesDefeated.length} / 2</b></div>
          <div><small>ПОЛУЧЕНО СЛАВЫ</small><b>+{run.kleosEarned} κ</b></div>
        </div>
        {victory && (
          <div className={`ending-prophecy ${run.campaign.prophecy.fulfilled ? 'fulfilled' : ''}`}>
            <Eye size={15} /><span><small>{run.campaign.prophecy.fulfilled ? 'ПРОРОЧЕСТВО ИСПОЛНЕНО' : 'ПРОРОЧЕСТВО НЕ ИСПОЛНЕНО'}</small><b>{run.campaign.prophecy.title}</b></span>
          </div>
        )}
        <div className="legacy-line"><Sparkles size={15} /> Всего славы прошлых песен: <b>{meta.kleos}</b></div>
        <button className="primary-button large" onClick={onNew}>
          <span><small>МИР ИЗМЕНИТСЯ</small>Начать новую песнь</span><RotateCcw size={19} />
        </button>
      <button className="text-button" onClick={onMenu}><ArrowLeft size={15} /> Вернуться в главное меню</button>
    </Dialog>
  )
}

function ChronicleModal({
  meta,
  onExport,
  onImport,
  onClose,
}: {
  meta: MetaState
  onExport: () => void
  onImport: (file: File) => Promise<string>
  onClose: () => void
}) {
  const [tab, setTab] = useState<'overview' | 'achievements' | 'history' | 'data'>('overview')
  const [importMessage, setImportMessage] = useState('')
  const stats = chronicleStats(meta)
  const favoriteDifficulty = difficultyDefinition(stats.favoriteDifficulty as DifficultyId)
  const activeCodexIds = new Set([...authoredIslands.map((island) => island.encounterId), ...bosses.map((boss) => boss.id)])
  const activeCodexCount = meta.codex.filter((id) => activeCodexIds.has(id)).length
  const tabOptions: TabOption<typeof tab>[] = [
    { id: 'overview', label: 'Обзор', icon: <BarChart3 size={14} aria-hidden="true" /> },
    { id: 'achievements', label: 'Достижения', icon: <Award size={14} aria-hidden="true" /> },
    { id: 'history', label: 'Походы', icon: <ScrollText size={14} aria-hidden="true" /> },
    { id: 'data', label: 'Данные', icon: <Database size={14} aria-hidden="true" /> },
  ]

  const handleImport = async (file?: File) => {
    if (!file) return
    setImportMessage(await onImport(file))
  }

  return (
    <Dialog
      className="chronicle-modal"
      titleId="chronicle-title"
      descriptionId="chronicle-description"
      onClose={onClose}
    >
      <div className="chronicle-heading">
        <div className="chronicle-emblem"><BarChart3 size={24} aria-hidden="true" /></div>
        <span className="eyebrow">ПЕСНИ, КОТОРЫЕ ПОМНИТ МОРЕ</span>
        <h2 id="chronicle-title">Летопись Одиссея</h2>
        <p id="chronicle-description">Все завершённые экспедиции, открытые судьбы и достижения хранятся между попытками.</p>
      </div>
      <Tabs
        idBase="chronicle"
        className="chronicle-tabs"
        value={tab}
        options={tabOptions}
        onChange={setTab}
        ariaLabel="Разделы летописи"
      />

      <TabPanel idBase="chronicle" tabId={tab} className="chronicle-body">
          {tab === 'overview' && (
            <>
              <div className="chronicle-stats">
                <div><small>ЗАВЕРШЕНО</small><b>{stats.finished}</b><span>экспедиций</span></div>
                <div><small>ВОЗВРАЩЕНИЯ</small><b>{stats.homecomings}</b><span>{Math.round(stats.completionRate * 100)}% успеха</span></div>
                <div><small>СРЕДНИЙ ПУТЬ</small><b>{stats.averageDays.toFixed(1)}</b><span>дней</span></div>
                <div><small>ЛЮБИМЫЙ РЕЖИМ</small><b>{favoriteDifficulty.name}</b><span>{stats.totalKleos} κ заработано</span></div>
              </div>
              <section className="ending-gallery">
                <div className="section-heading"><span>СУДЬБЫ ЦАРЯ</span><small>{meta.endings.length} / 4</small></div>
                <div>
                  {Object.entries(endingScenes).map(([id, scene]) => {
                    const unlocked = meta.endings.includes(id)
                    const ending = endingDefinitions[id]
                    return (
                      <article className={unlocked ? 'unlocked' : 'locked'} key={id}>
                        <div style={unlocked ? { backgroundImage: `url(${scene.src})` } : undefined}>{!unlocked && <span>?</span>}</div>
                        <small>{unlocked ? ending.subtitle : 'СУДЬБА СКРЫТА'}</small>
                        <b>{unlocked ? ending.title : 'Неизвестный финал'}</b>
                      </article>
                    )
                  })}
                </div>
              </section>
              <div className="collection-summary"><BookOpen size={16} /><span><b>{activeCodexCount} / {authoredIslands.length + bosses.length} записей кодекса</b><small>{meta.prophecies.length} пророчеств · {meta.legacy.length} даров наследия</small></span></div>
            </>
          )}

          {tab === 'achievements' && (
            <div className="achievement-grid">
              {achievements.map((achievement) => {
                const unlocked = meta.achievements.includes(achievement.id)
                return (
                  <article className={unlocked ? 'unlocked' : 'locked'} key={achievement.id}>
                    <div className="achievement-symbol">{unlocked ? achievement.symbol : '?'}</div>
                    <span><small>{unlocked ? 'ОТКРЫТО' : achievement.hidden ? 'ТАЙНОЕ' : 'НЕ ВЫПОЛНЕНО'}</small><b>{unlocked || !achievement.hidden ? achievement.title : 'Скрытое достижение'}</b><p>{unlocked || !achievement.hidden ? achievement.description : 'Условие откроется вместе с наградой.'}</p></span>
                  </article>
                )
              })}
            </div>
          )}

          {tab === 'history' && (
            <div className="voyage-history">
              {meta.history.length === 0 ? (
                <div className="chronicle-empty"><ScrollText size={28} /><b>Первая песнь ещё не завершена</b><p>Гибель или возвращение на Итаку появятся здесь.</p></div>
              ) : meta.history.map((voyage) => {
                const difficulty = difficultyDefinition(voyage.difficulty)
                const date = voyage.finishedAt.slice(0, 10).split('-').reverse().join('.')
                return (
                  <article className={voyage.outcome} key={voyage.id}>
                    <div className="voyage-outcome">{voyage.outcome === 'home' ? <Crown size={18} /> : <Skull size={18} />}</div>
                    <span><small>{date} · {difficulty.name.toUpperCase()}</small><b>{voyage.outcome === 'home' ? endingDefinitions[voyage.endingId ?? 'hero']?.title ?? 'Возвращение на Итаку' : 'Море не знает могил'}</b><p>День {voyage.day} · узел {voyage.nodeIndex + 1} · стражей {voyage.bossesDefeated}/2 · команда {voyage.crew}</p></span>
                    <em>+{voyage.kleosEarned} κ</em>
                  </article>
                )
              })}
            </div>
          )}

          {tab === 'data' && (
            <div className="data-management">
              <div className="offline-visual" style={{ backgroundImage: `url(${uiScenes.offline.src})` }}><span>{uiScenes.offline.caption}</span></div>
              <div className="data-card">
                <div><Download size={22} /></div>
                <span><b>Экспортировать летопись</b><p>Сохранить текущую экспедицию, наследие, кодекс, историю и настройки в один JSON-файл.</p></span>
                <button className="secondary-button" onClick={onExport}>Скачать</button>
              </div>
              <div className="data-card">
                <div><Upload size={22} /></div>
                <span><b>Восстановить из файла</b><p>Текущие локальные данные будут заменены содержимым выбранной резервной копии.</p></span>
                <label className="secondary-button">Выбрать<input type="file" accept="application/json,.json" onChange={(event) => handleImport(event.target.files?.[0])} /></label>
              </div>
              {importMessage && <div className="import-message"><Database size={14} /> {importMessage}</div>}
              <div className="offline-note"><Check size={15} /><span><b>Офлайн-режим включён</b><small>После первого открытия приложение и загруженные иллюстрации доступны без сети.</small></span></div>
            </div>
          )}
      </TabPanel>
    </Dialog>
  )
}

function DifficultyModal({
  onStart,
  onClose,
}: {
  onStart: (difficulty: DifficultyId) => void
  onClose: () => void
}) {
  const [selected, setSelected] = useState<DifficultyId>('odyssey')
  const active = difficultyDefinition(selected)
  return (
    <Dialog
      className="difficulty-modal"
      titleId="difficulty-title"
      descriptionId="difficulty-description"
      onClose={onClose}
    >
      <span className="eyebrow">НОВАЯ ПЕСНЬ</span>
      <h2 id="difficulty-title">Как мойры сплетут ваш путь?</h2>
      <p id="difficulty-description">Режим нельзя изменить во время экспедиции. Он влияет на припасы, проверки, штормы, стражей и получаемую славу.</p>
        <div className="difficulty-cards">
          {difficulties.map((difficulty) => (
            <button
              className={`difficulty-card difficulty-${difficulty.id} ${selected === difficulty.id ? 'active' : ''}`}
              key={difficulty.id}
              onClick={() => setSelected(difficulty.id)}
              aria-pressed={selected === difficulty.id}
            >
              <span className="difficulty-art" style={{ backgroundImage: `url(${difficulty.art})` }}><i>{selected === difficulty.id && <Check size={14} />}</i></span>
              <span className="difficulty-copy"><small>{difficulty.subtitle}</small><b>{difficulty.name}</b><p>{difficulty.description}</p></span>
              <span className="difficulty-tags">{difficulty.tags.map((tag) => <em key={tag}>{tag}</em>)}</span>
            </button>
          ))}
        </div>
      <div className="difficulty-confirm">
        <div><small>ВЫБРАНО</small><b>{active.name}</b><span>Множитель славы: ×{active.kleosMultiplier}</span></div>
        <button className="primary-button" onClick={() => onStart(selected)}>Начать путешествие <ChevronRight size={16} /></button>
      </div>
    </Dialog>
  )
}

function AccessibilityModal({
  preferences,
  onChange,
  onClose,
}: {
  preferences: UiPreferences
  onChange: (preferences: UiPreferences) => void
  onClose: () => void
}) {
  return (
    <Dialog
      className="accessibility-modal"
      titleId="accessibility-title"
      descriptionId="accessibility-description"
      onClose={onClose}
    >
      <div className="accessibility-visual" style={{ backgroundImage: `url(${uiScenes.accessibility.src})` }}><span>{uiScenes.accessibility.caption}</span></div>
      <span className="eyebrow">ИНТЕРФЕЙС И ДОСТУПНОСТЬ</span>
      <h2 id="accessibility-title">Настройки чтения</h2>
      <p id="accessibility-description">Параметры применяются сразу и сохраняются отдельно от игрового прогресса.</p>
        <section className="accessibility-setting">
          <div className="setting-icon"><Type size={20} /></div>
          <div><b>Размер текста</b><small>Увеличивает основной текст событий, решений и кодекса.</small></div>
          <div className="segmented-control" role="group" aria-label="Размер текста">
            {(['normal', 'large', 'xlarge'] as const).map((scale, index) => (
              <button key={scale} aria-pressed={preferences.textScale === scale} aria-label={['Обычный текст', 'Крупный текст', 'Максимальный текст'][index]} className={preferences.textScale === scale ? 'active' : ''} onClick={() => onChange({ ...preferences, textScale: scale })}>{['A', 'A+', 'A++'][index]}</button>
            ))}
          </div>
        </section>
        <section className="accessibility-setting">
          <div className="setting-icon"><Contrast size={20} /></div>
          <div><b>Высокий контраст</b><small>Усиливает границы, текст и различия состояний.</small></div>
          <Toggle checked={preferences.highContrast} onChange={(checked) => onChange({ ...preferences, highContrast: checked })} label="Высокий контраст" />
        </section>
        <section className="accessibility-setting">
          <div className="setting-icon"><Wind size={20} /></div>
          <div><b>Уменьшить движение</b><small>Отключает пульсацию, панорамирование и переходы.</small></div>
          <Toggle checked={preferences.reduceMotion} onChange={(checked) => onChange({ ...preferences, reduceMotion: checked })} label="Уменьшить движение" />
        </section>
      <div className="accessibility-preview"><span className="eyebrow">ПРИМЕР</span><p>Море помнит каждую клятву, но теперь эту строку легче прочитать.</p></div>
      <button className="primary-button" onClick={onClose}>Сохранить настройки</button>
    </Dialog>
  )
}

function LegacyModal({
  meta,
  onBuy,
  onClose,
}: {
  meta: MetaState
  onBuy: (boonId: string) => void
  onClose: () => void
}) {
  const activeCodexIds = new Set([...authoredIslands.map((island) => island.encounterId), ...bosses.map((boss) => boss.id)])
  const activeCodexCount = meta.codex.filter((id) => activeCodexIds.has(id)).length
  return (
    <Dialog
      className="legacy-modal"
      titleId="legacy-title"
      descriptionId="legacy-description"
      onClose={onClose}
    >
      <div className="legacy-modal-heading">
          <div className="legacy-emblem"><Trophy size={25} /></div>
          <span className="eyebrow">МЕЖДУ ПЕСНЯМИ</span>
          <h2 id="legacy-title">Наследие Одиссея</h2>
          <p id="legacy-description">Слава переживает гибель. Купленные дары навсегда изменяют начало каждой новой экспедиции.</p>
          <div className="kleos-purse"><Sparkles size={15} /><span><small>ДОСТУПНО</small><b>{meta.kleos} κλέος</b></span></div>
        </div>
        <div className="legacy-progress">
          <div><small>ДАРЫ</small><b>{meta.legacy.length} / {legacyBoons.length}</b></div>
          <div><small>ФИНАЛЫ</small><b>{meta.endings.length} / 4</b></div>
          <div><small>ПРОРОЧЕСТВА</small><b>{meta.prophecies.length} / 4</b></div>
          <div><small>КОДЕКС</small><b>{activeCodexCount} / {authoredIslands.length + bosses.length}</b></div>
        </div>
        <div className="legacy-grid">
          {legacyBoons.map((boon) => {
            const owned = meta.legacy.includes(boon.id)
            const affordable = meta.kleos >= boon.cost
            return (
              <button className={`legacy-boon ${owned ? 'owned' : ''}`} key={boon.id} onClick={() => onBuy(boon.id)} disabled={owned || !affordable}>
                <span className="boon-icon">{owned ? <Check size={17} /> : <Star size={17} />}</span>
                <span><small>{boon.category}</small><b>{boon.name}</b><p>{boon.description}</p></span>
                <em>{owned ? 'Открыто' : <><Sparkles size={11} /> {boon.cost} κ</>}</em>
              </button>
            )
          })}
        </div>
      <button className="primary-button" onClick={onClose}>Вернуться к песням</button>
    </Dialog>
  )
}

function ConfirmModal({ onCancel, onConfirm }: { onCancel: () => void; onConfirm: () => void }) {
  return (
    <Dialog
      className="confirm-card"
      titleId="confirm-title"
      descriptionId="confirm-description"
      onClose={onCancel}
    >
      <Skull className="modal-symbol" size={29} aria-hidden="true" />
      <span className="eyebrow">ПРЕРВАТЬ ПУТЬ</span>
      <h2 id="confirm-title">Начать новую песнь?</h2>
      <p id="confirm-description">Текущий поход и все принятые решения будут потеряны. Слава за незавершённый путь не сохранится.</p>
      <div className="modal-actions">
        <button className="secondary-button" onClick={onCancel}>Остаться в море</button>
        <button className="danger-button" onClick={onConfirm}>Начать заново</button>
      </div>
    </Dialog>
  )
}

function RulesModal({ onClose }: { onClose: () => void }) {
  const rules = [
    { Icon: Compass, title: 'Выбирайте путь', text: 'Каждое решение проверяет одну из четырёх характеристик Одиссея.' },
    { Icon: Wheat, title: 'Берегите запасы', text: 'Переходы расходуют пищу и воду. Нулевой запас означает гибель похода.' },
    { Icon: Skull, title: 'Читайте намерения', text: 'Стражи показывают следующую атаку. Подбирайте ответ с подходящей защитой.' },
    { Icon: Eye, title: 'Спорьте с судьбой', text: 'Решения меняют отношение богов, рок, личное пророчество и доступный финал.' },
    { Icon: Wind, title: 'Выбирайте курс', text: 'Прямой путь экономит дни, осторожный снижает вероятность и силу штормов.' },
    { Icon: BookOpen, title: 'Собирайте кодекс', text: 'Пережитые мифы и их иллюстрации навсегда сохраняются между песнями.' },
    { Icon: Coins, title: 'Добывайте драхмы', text: 'Деньги дают только сокровища, награды, торговля и побеждённые стражи. Обычная неудача монет не приносит.' },
    { Icon: Sparkles, title: 'Оставляйте наследие', text: 'κλέος после экспедиции покупает постоянные дары для следующих попыток.' },
  ]
  return (
    <Dialog className="rules-card" titleId="rules-title" onClose={onClose}>
      <span className="eyebrow">КАК ИГРАТЬ</span>
      <h2 id="rules-title">Законы чёрного моря</h2>
        <div className="rules-list">
          {rules.map(({ Icon, title, text }) => (
            <div key={title}><span><Icon size={19} /></span><div><h4>{title}</h4><p>{text}</p></div></div>
          ))}
        </div>
        <div className="formula-note">
          <Brain size={17} />
          <span><b>Шанс проверки</b> зависит от навыка, сложности выбора, здоровья и духа команды.</span>
        </div>
      <button className="primary-button" onClick={onClose}>Понятно</button>
    </Dialog>
  )
}

export default App
