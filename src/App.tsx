import { useEffect, useState } from 'react'
import {
  Anchor,
  ArrowLeft,
  BookOpen,
  Brain,
  Check,
  ChevronRight,
  CircleHelp,
  Coins,
  Compass,
  Crown,
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
  Shield,
  Ship,
  ShoppingBag,
  Skull,
  Sparkles,
  Star,
  Swords,
  Trophy,
  UserPlus,
  Users,
  Waves,
  Wheat,
  Wind,
  X,
  Zap,
} from 'lucide-react'
import { acts, godInfo, legacyBoons, normalizeMeta } from './campaign'
import { skillLabels } from './data'
import {
  DEFAULT_META,
  RESOURCE_MAX,
  bossActionChance,
  buyPortOffer,
  canAfford,
  choiceChance,
  completedDistance,
  continueVoyage,
  createRun,
  currentBossDefinition,
  currentEncounter,
  effectiveSkill,
  equipItem,
  equippedItem,
  formatEffects,
  getPortStock,
  portServices,
  purchaseLegacy,
  resolveBossAction,
  resolveChoice,
  routeDistance,
  upgradeSkill,
} from './game'
import {
  biomeInfo,
  equipment,
  equipmentSlotLabels,
  shipUpgrades,
} from './progression'
import type {
  BossAction,
  Choice,
  EquipmentSlot,
  GodId,
  MetaState,
  ResourceKey,
  RunState,
  Skill,
  TravelStance,
} from './types'

const SAVE_KEY = 'odyssey-shadow-save-v3'
const LEGACY_SAVE_KEY = 'odyssey-shadow-save-v2'
const FIRST_SAVE_KEY = 'odyssey-shadow-save-v1'
const META_KEY = 'odyssey-shadow-meta-v1'

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

function loadSavedRun() {
  const current = readStorage<RunState | null>(SAVE_KEY, null)
  if (current?.version === 3) return current

  const legacy = readStorage<RunState | null>(LEGACY_SAVE_KEY, null)
    ?? readStorage<RunState | null>(FIRST_SAVE_KEY, null)
  if (!legacy) return null
  const migrated = createRun(legacy.seed)
  return {
    ...migrated,
    day: legacy.day,
    resources: legacy.resources,
    skills: legacy.skills,
    log: legacy.log,
    progression: legacy.progression ?? {
      ...migrated.progression,
      coins: migrated.progression.coins + legacy.nodeIndex * 4,
    },
    ship: legacy.ship ?? migrated.ship,
    portNotice: 'Путь из прошлой версии перенесён в трёхактную кампанию.',
  }
}

function App() {
  const [run, setRun] = useState<RunState | null>(loadSavedRun)
  const [meta, setMeta] = useState<MetaState>(() => normalizeMeta(readStorage<Partial<MetaState>>(META_KEY, DEFAULT_META)))
  const [screen, setScreen] = useState<'menu' | 'game'>('menu')
  const [confirmNew, setConfirmNew] = useState(false)
  const [showRules, setShowRules] = useState(false)
  const [showLegacy, setShowLegacy] = useState(false)

  useEffect(() => {
    localStorage.setItem(META_KEY, JSON.stringify(meta))
  }, [meta])

  useEffect(() => {
    if (run) localStorage.setItem(SAVE_KEY, JSON.stringify(run))
  }, [run])

  const startNewRun = () => {
    const nextRun = createRun(Date.now(), meta.legacy)
    setRun(nextRun)
    setMeta((current) => ({ ...current, voyages: current.voyages + 1 }))
    setConfirmNew(false)
    setScreen('game')
  }

  const requestNewRun = () => {
    if (run && run.phase !== 'dead' && run.phase !== 'home') setConfirmNew(true)
    else startNewRun()
  }

  const commitRun = (next: RunState) => {
    if (!run) return
    const endedNow =
      (next.phase === 'dead' || next.phase === 'home') &&
      run.phase !== 'dead' &&
      run.phase !== 'home'
    if (endedNow) {
      setMeta((current) => ({
        ...current,
        kleos: current.kleos + next.kleosEarned,
        bestDistance: Math.max(current.bestDistance, next.nodeIndex),
        endings: next.campaign.ending && !current.endings.includes(next.campaign.ending.id)
          ? [...current.endings, next.campaign.ending.id]
          : current.endings,
        prophecies: next.campaign.prophecy.fulfilled && !current.prophecies.includes(next.campaign.prophecy.id)
          ? [...current.prophecies, next.campaign.prophecy.id]
          : current.prophecies,
      }))
    }
    setRun(next)
  }

  if (screen === 'menu') {
    return (
      <>
        <TitleScreen
          savedRun={run}
          meta={meta}
          onContinue={() => setScreen('game')}
          onNew={requestNewRun}
          onRules={() => setShowRules(true)}
          onLegacy={() => setShowLegacy(true)}
        />
        {confirmNew && (
          <ConfirmModal
            onCancel={() => setConfirmNew(false)}
            onConfirm={startNewRun}
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
      </>
    )
  }

  if (!run) return null

  return (
    <div className="game-app">
      <GameHeader
        run={run}
        saving={false}
        onMenu={() => setScreen('menu')}
        onRules={() => setShowRules(true)}
        onRestart={requestNewRun}
      />
      <main className="game-grid">
        <HeroPanel
          run={run}
          onUpgrade={(skill) => commitRun(upgradeSkill(run, skill))}
        />
        {run.phase === 'boss' ? (
          <BossPanel
            run={run}
            onAction={(action) => commitRun(resolveBossAction(run, action))}
          />
        ) : run.phase === 'port' ? (
          <PortPanel
            run={run}
            onBuy={(offerId) => commitRun(buyPortOffer(run, offerId))}
            onDepart={(stance) => commitRun(continueVoyage(run, stance))}
          />
        ) : (
          <EncounterPanel
            run={run}
            onChoose={(choice) => commitRun(resolveChoice(run, choice))}
            onContinue={(stance) => commitRun(continueVoyage(run, stance))}
          />
        )}
        <WorldPanel
          run={run}
          onEquip={(itemId) => commitRun(equipItem(run, itemId))}
        />
      </main>
      <div className="mobile-status">
        <span><Wheat size={14} /> {run.resources.food}</span>
        <span><Droplets size={14} /> {run.resources.water}</span>
        <span><Users size={14} /> {run.resources.crew}</span>
        <span><Shield size={14} /> {run.resources.hull}%</span>
      </div>
      {(run.phase === 'dead' || run.phase === 'home') && (
        <EndingOverlay
          run={run}
          meta={meta}
          onNew={startNewRun}
          onMenu={() => setScreen('menu')}
        />
      )}
      {confirmNew && (
        <ConfirmModal onCancel={() => setConfirmNew(false)} onConfirm={startNewRun} />
      )}
      {showRules && <RulesModal onClose={() => setShowRules(false)} />}
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
}

function TitleScreen({ savedRun, meta, onContinue, onNew, onRules, onLegacy }: TitleScreenProps) {
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
          <button className="ghost-button" onClick={onRules}>
            <CircleHelp size={17} /> Как играть
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
          <div><Map size={17} /><span><b>187 островов</b>Процедурный архипелаг</span></div>
          <div><Skull size={17} /><span><b>Одна жизнь</b>Решения имеют цену</span></div>
          <div><Sparkles size={17} /><span><b>{meta.endings.length} из 4 финалов</b>{meta.legacy.length} даров наследия</span></div>
        </div>
      </section>

      <div className="title-quote">
        <span>IX</span>
        «Назови мне, Муза, того многоопытного мужа…»
      </div>
      <div className="title-footer">
        <span>Кампания · Три акта · Четыре финала</span>
        <span className="title-seed">ПОХОДОВ: {String(meta.voyages).padStart(2, '0')}</span>
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
  onRestart: () => void
}

function GameHeader({ run, saving, onMenu, onRules, onRestart }: HeaderProps) {
  const act = acts[run.campaign.act - 1]
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
      <div className="header-journey">
        <div><Wind size={16} /><span>ДЕНЬ <b>{run.day}</b></span></div>
        <div><Compass size={16} /><span>ДО ИТАКИ <b>{routeDistance(run)} стадиев</b></span></div>
        <div className="header-coins"><Coins size={16} /><span>ДРАХМЫ <b>{run.progression.coins}</b></span></div>
      </div>
      <div className={`save-state ${saving ? 'active' : ''}`}>
        {saving ? <Check size={15} /> : <Save size={15} />}
        {saving ? 'Сохранено' : 'Автосохранение'}
      </div>
      <button className="icon-button" onClick={onRules} aria-label="Правила">
        <BookOpen size={18} />
      </button>
      <button className="icon-button restart-button" onClick={onRestart} aria-label="Начать заново">
        <RotateCcw size={18} />
      </button>
    </header>
  )
}

function HeroPanel({ run, onUpgrade }: { run: RunState; onUpgrade: (skill: Skill) => void }) {
  const xpPercent = (run.progression.xp / run.progression.nextLevelXp) * 100
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
  onContinue: (stance: TravelStance) => void
}

function EncounterPanel({ run, onChoose, onContinue }: EncounterPanelProps) {
  const encounter = currentEncounter(run)
  const isResolution = run.phase === 'resolution'
  return (
    <section className={`encounter-panel panel accent-${encounter.accent}`}>
      <div className="encounter-art">
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
        <span className="eyebrow">{encounter.eyebrow} · {biomeInfo[run.route[run.nodeIndex].biome].name}</span>
        <h1>{encounter.title}</h1>
        <div className="ornament"><span /><i>◆</i><span /></div>
        <p>{encounter.description}</p>
        {encounter.quote && <blockquote>{encounter.quote}</blockquote>}
      </div>

      {isResolution && run.resolution ? (
        <ResolutionCard run={run} onContinue={onContinue} />
      ) : (
        <div className="choices-area">
          <div className="choices-heading">
            <span>ВАШЕ РЕШЕНИЕ</span>
            <small>Выбор нельзя отменить</small>
          </div>
          <div className="choices-list">
            {encounter.choices.map((choice, index) => (
              <ChoiceButton
                key={choice.id}
                index={index}
                choice={choice}
                run={run}
                onClick={() => onChoose(choice)}
              />
            ))}
          </div>
        </div>
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
  const { Icon } = skillConfig[choice.skill]
  const chanceTone = chance >= 65 ? 'good' : chance >= 42 ? 'risky' : 'danger'
  const costs = formatEffects(choice.cost).filter((effect) => effect.value < 0)

  return (
    <button className="choice-button" onClick={onClick} disabled={!affordable}>
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
          {!affordable && <em>Недостаточно ресурсов</em>}
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

function ResolutionCard({ run, onContinue }: { run: RunState; onContinue: (stance: TravelStance) => void }) {
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
        <p>{resolution.text}</p>
        {resolution.omen && <blockquote>{resolution.omen}</blockquote>}
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
          {resolution.coins !== undefined && <span className="positive"><Coins size={13} /> +{resolution.coins}</span>}
          {resolution.divineChange && (Object.entries(resolution.divineChange) as [GodId, number][]).map(([god, value]) => (
            <span className={value > 0 ? 'divine-positive' : 'divine-negative'} key={god}>{godInfo[god].symbol} {value > 0 ? '+' : ''}{value}</span>
          ))}
          {resolution.levelUp && <span className="level-up-chip"><Sparkles size={13} /> Новый уровень</span>}
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

function BossPanel({ run, onAction }: { run: RunState; onAction: (action: BossAction) => void }) {
  const definition = currentBossDefinition(run)
  const boss = run.boss!
  const intent = definition.intents[boss.intentIndex % definition.intents.length]
  const healthPercent = (boss.health / boss.maxHealth) * 100
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
            const SkillIcon = skillConfig[action.skill].Icon
            return (
              <button key={action.id} className="boss-action" onClick={() => onAction(action)} disabled={!affordable}>
                <span className="boss-action-icon"><SkillIcon size={18} /></span>
                <span className="boss-action-copy"><b>{action.title}</b><small>{action.description}</small><em>{skillLabels[action.skill]} {effectiveSkill(run, action.skill)} · урон {action.damage} · защита {Math.round(action.mitigation * 100)}%</em></span>
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
}: {
  run: RunState
  onBuy: (offerId: string) => void
  onDepart: (stance: TravelStance) => void
}) {
  const stock = getPortStock(run)
  const current = run.route[run.nodeIndex]
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

      <div className="port-content">
        <section className="market-section services-market">
          <div className="market-heading">
            <div><span className="eyebrow">ПРИЧАЛ И АГОРА</span><h3>Припасы и услуги</h3></div>
            <Package size={19} />
          </div>
          <div className="service-grid">
            {portServices.map((service) => (
              <button
                className="market-offer compact"
                key={service.id}
                onClick={() => onBuy(service.id)}
                disabled={run.progression.coins < service.cost}
              >
                <span className="offer-symbol"><Package size={15} /></span>
                <span><b>{service.name}</b><small>{service.description}</small></span>
                <em><Coins size={11} /> {service.cost}</em>
              </button>
            ))}
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
              return (
                <button
                  className={`market-offer ${equipped ? 'owned' : ''}`}
                  key={item.id}
                  onClick={() => onBuy(item.id)}
                  disabled={!owned && run.progression.coins < item.cost}
                >
                  <span className="offer-symbol"><Swords size={17} /></span>
                  <span>
                    <small>{equipmentSlotLabels[item.slot]} · {item.rarity}</small>
                    <b>{item.name}</b>
                    <p>{item.description}</p>
                  </span>
                  <em>{equipped ? 'Экипировано' : owned ? 'Надеть' : <><Coins size={11} /> {item.cost}</>}</em>
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
              return (
                <button className={`market-offer compact ${owned ? 'owned' : ''}`} key={upgrade.id} onClick={() => onBuy(upgrade.id)} disabled={owned || run.progression.coins < upgrade.cost}>
                  <span><b>{upgrade.name}</b><small>{upgrade.description}</small></span>
                  <em>{owned ? 'Готово' : <><Coins size={11} /> {upgrade.cost}</>}</em>
                </button>
              )
            })}
          </section>
          <section className="market-section companion-offer">
            <div className="market-heading small"><div><span className="eyebrow">ТРАКТИР</span><h3>Именованный спутник</h3></div><UserPlus size={18} /></div>
            <div className="companion-card">
              <div className="companion-avatar">{stock.companion.name[0]}</div>
              <div><b>{stock.companion.name}</b><small>{stock.companion.role}</small><p>{stock.companion.trait}. +{stock.companion.bonus} к {skillLabels[stock.companion.skill].toLowerCase()}.</p></div>
              <button onClick={() => onBuy(stock.companion.id)} disabled={run.ship.companions.some((entry) => entry.id === stock.companion.id) || run.progression.coins < 28}>
                {run.ship.companions.some((entry) => entry.id === stock.companion.id) ? 'В команде' : <><Coins size={11} /> 28</>}
              </button>
            </div>
          </section>
        </div>
      </div>

      <div className="port-departure">
        <div><Wind size={17} /><span><small>ВЕТЕР: ЗАПАДНЫЙ</small><b>Следующий курс — {run.route[run.nodeIndex + 1]?.name}</b></span></div>
        <div className="port-route-buttons">
          <button className="secondary-button" onClick={() => onDepart('cautious')}><Shield size={14} /> Осторожно</button>
          <button className="primary-button" onClick={() => onDepart('bold')}>Прямой курс <Wind size={15} /></button>
        </div>
      </div>
    </section>
  )
}

function WorldPanel({ run, onEquip }: { run: RunState; onEquip: (itemId: string) => void }) {
  const [tab, setTab] = useState<'map' | 'ship' | 'fate' | 'log'>('map')
  return (
    <aside className="world-panel panel">
      <div className="world-tabs four-tabs">
        <button className={tab === 'map' ? 'active' : ''} onClick={() => setTab('map')}>
          <Map size={13} /> Карта
        </button>
        <button className={tab === 'ship' ? 'active' : ''} onClick={() => setTab('ship')}>
          <Ship size={13} /> Судно
        </button>
        <button className={tab === 'fate' ? 'active' : ''} onClick={() => setTab('fate')}>
          <Eye size={13} /> Судьба
        </button>
        <button className={tab === 'log' ? 'active' : ''} onClick={() => setTab('log')}>
          <History size={13} /> Журнал
        </button>
      </div>
      {tab === 'map' && <RouteMap run={run} />}
      {tab === 'ship' && <ShipPanel run={run} onEquip={onEquip} />}
      {tab === 'fate' && <FatePanel run={run} />}
      {tab === 'log' && <VoyageLog run={run} />}
    </aside>
  )
}

function FatePanel({ run }: { run: RunState }) {
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

function ShipPanel({ run, onEquip }: { run: RunState; onEquip: (itemId: string) => void }) {
  const slots: EquipmentSlot[] = ['weapon', 'armor', 'talisman']
  return (
    <div className="ship-content">
      <div className="ship-heading">
        <div className="ship-emblem"><Ship size={24} /></div>
        <div><span className="eyebrow">АХЕЙСКАЯ ПЕНТЕКОНТЕРА</span><h3>{run.ship.name}</h3><p>{run.resources.crew} гребцов · {run.ship.upgrades.length} улучшений</p></div>
      </div>

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

      <section className="companions-section">
        <div className="section-heading"><span>СПУТНИКИ</span><small>{run.ship.companions.length} НА БОРТУ</small></div>
        <div className="companions-list">
          {run.ship.companions.map((companion) => (
            <div className="crew-companion" key={companion.id}>
              <div className="companion-avatar small">{companion.name[0]}</div>
              <span><b>{companion.name}</b><small>{companion.role}</small></span>
              <em>{companion.bonus > 0 ? `+${companion.bonus} ${skillLabels[companion.skill].toLowerCase()}` : `${companion.loyalty}% верности`}</em>
            </div>
          ))}
        </div>
      </section>
      <p className="ship-hint"><ShoppingBag size={13} /> Снаряжение, спутников и улучшения можно найти в двух портах текущего маршрута.</p>
    </div>
  )
}

function RouteMap({ run }: { run: RunState }) {
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
        <div className="world-count"><b>{run.world.length}</b><small>ОСТРОВОВ В МИРЕ</small></div>
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
  return (
    <div className="ending-overlay">
      <div className="ending-card">
        <div className={`ending-emblem ${victory ? 'victory' : ''}`}>
          {victory ? <Crown size={32} /> : <Skull size={32} />}
        </div>
        <span className="eyebrow">{victory ? run.campaign.ending?.subtitle ?? 'ПЕСНЬ ЗАВЕРШЕНА' : 'ПОХОД ОКОНЧЕН'}</span>
        <h2>{victory ? run.campaign.ending?.title ?? 'Итака на рассвете' : 'Море не знает могил'}</h2>
        {victory && run.campaign.ending && <div className={`ending-rank rank-${run.campaign.ending.rank}`}>{run.campaign.ending.rank} финал</div>}
        <p>{run.resolution?.text}</p>
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
      </div>
    </div>
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
  return (
    <div className="modal-backdrop">
      <div className="modal-card legacy-modal">
        <button className="modal-close" onClick={onClose}><X size={18} /></button>
        <div className="legacy-modal-heading">
          <div className="legacy-emblem"><Trophy size={25} /></div>
          <span className="eyebrow">МЕЖДУ ПЕСНЯМИ</span>
          <h2>Наследие Одиссея</h2>
          <p>Слава переживает гибель. Купленные дары навсегда изменяют начало каждой новой экспедиции.</p>
          <div className="kleos-purse"><Sparkles size={15} /><span><small>ДОСТУПНО</small><b>{meta.kleos} κλέος</b></span></div>
        </div>
        <div className="legacy-progress">
          <div><small>ДАРЫ</small><b>{meta.legacy.length} / {legacyBoons.length}</b></div>
          <div><small>ФИНАЛЫ</small><b>{meta.endings.length} / 4</b></div>
          <div><small>ПРОРОЧЕСТВА</small><b>{meta.prophecies.length} / 4</b></div>
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
      </div>
    </div>
  )
}

function ConfirmModal({ onCancel, onConfirm }: { onCancel: () => void; onConfirm: () => void }) {
  return (
    <div className="modal-backdrop">
      <div className="modal-card confirm-card">
        <button className="modal-close" onClick={onCancel}><X size={18} /></button>
        <Skull className="modal-symbol" size={29} />
        <span className="eyebrow">ПРЕРВАТЬ ПУТЬ</span>
        <h2>Начать новую песнь?</h2>
        <p>Текущий поход и все принятые решения будут потеряны. Слава за незавершённый путь не сохранится.</p>
        <div className="modal-actions">
          <button className="secondary-button" onClick={onCancel}>Остаться в море</button>
          <button className="danger-button" onClick={onConfirm}>Начать заново</button>
        </div>
      </div>
    </div>
  )
}

function RulesModal({ onClose }: { onClose: () => void }) {
  const rules = [
    { Icon: Compass, title: 'Выбирайте путь', text: 'Каждое решение проверяет одну из четырёх характеристик Одиссея.' },
    { Icon: Wheat, title: 'Берегите запасы', text: 'Переходы расходуют пищу и воду. Нулевой запас означает гибель похода.' },
    { Icon: Skull, title: 'Читайте намерения', text: 'Стражи показывают следующую атаку. Подбирайте ответ с подходящей защитой.' },
    { Icon: Eye, title: 'Спорьте с судьбой', text: 'Решения меняют отношение богов, рок, личное пророчество и доступный финал.' },
    { Icon: Wind, title: 'Выбирайте курс', text: 'Прямой путь экономит дни, осторожный снижает вероятность и силу штормов.' },
    { Icon: Sparkles, title: 'Оставляйте наследие', text: 'κλέος после экспедиции покупает постоянные дары для следующих попыток.' },
  ]
  return (
    <div className="modal-backdrop">
      <div className="modal-card rules-card">
        <button className="modal-close" onClick={onClose}><X size={18} /></button>
        <span className="eyebrow">КАК ИГРАТЬ</span>
        <h2>Законы чёрного моря</h2>
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
      </div>
    </div>
  )
}

export default App
