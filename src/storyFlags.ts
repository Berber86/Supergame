import { assetPath } from './assets'
import type { Effects, Skill, StoryFlag, StoryFlagTone } from './types'

interface StoryFlagDefinition {
  id: string
  title: string
  description: string
  echo: string
  tone: StoryFlagTone
  chance?: Partial<Record<Skill, number>>
  bossChance?: number
  scyllaChance?: number
  stormModifier?: number
  travelEffects?: Effects
  crisisChance?: number
}

interface StoryFlagRule {
  encounterId: string
  choiceId: string
  success: boolean
  flagId: string
}

export const storyFlagDefinitions: Record<string, StoryFlagDefinition> = {
  'black-shore-caution': {
    id: 'black-shore-caution', title: 'Урок чёрного берега', tone: 'secret',
    description: 'Одиссей научился видеть ловушку в слишком щедром даре.',
    echo: 'Брошенные припасы напоминают о воде, выставленной людоедами как приманка.',
    chance: { cunning: 0.02 },
  },
  'siren-truth': {
    id: 'siren-truth', title: 'Песня без славы', tone: 'alliance',
    description: 'Команда слышала, как Одиссей назвал потери Трои без героической лжи.',
    echo: 'Перед трудным выбором кто-то из гребцов тихо повторяет песню о Трое без победителей.',
    chance: { will: 0.025 }, travelEffects: { morale: 1 },
  },
  'cyclops-misdirected': {
    id: 'cyclops-misdirected', title: 'Новая ложь циклопам', tone: 'secret',
    description: 'Сын Полифема ушёл искать месть под чужим именем.',
    echo: 'На горизонте иногда виден дым: возможно, молодой циклоп всё ещё следует за ложным врагом.',
    chance: { cunning: 0.025 },
  },
  'tiresias-route': {
    id: 'tiresias-route', title: 'Пепельная карта Тиресия', tone: 'oath',
    description: 'Одиссей помнит течение, которого нет ни на одной карте живых.',
    echo: 'Пепельные линии Тиресия проступают на карте рядом с опасной водой.',
    stormModifier: -0.045, chance: { seamanship: 0.02 },
  },
  'dreamers-abandoned': {
    id: 'dreamers-abandoned', title: 'Оставленные в лотосах', tone: 'wrath',
    description: 'Несколько людей спят на Нисее, потому что царь выбрал большинство.',
    echo: 'Сладкий запах цветов заставляет команду вспоминать тех, кого оставили во сне.',
    travelEffects: { morale: -1 }, crisisChance: -0.03,
  },
  'talos-fallen': {
    id: 'talos-fallen', title: 'Падение бронзового стража', tone: 'alliance',
    description: 'Смертные доказали, что даже божественный механизм способен устать и ошибиться.',
    echo: 'Бронзовый скрип снастей напоминает команде о падении Талоса.',
    chance: { valor: 0.02 }, bossChance: 0.02,
  },
  'aeolus-westwind': {
    id: 'aeolus-westwind', title: 'Честный ветер Эола', tone: 'oath',
    description: 'Повелитель ветров услышал правду о Трое и подарил западный поток.',
    echo: 'В парусах на мгновение слышится голос Эола, требующий не приукрашивать старую войну.',
    stormModifier: -0.06, travelEffects: { morale: 1 },
  },
  'aeolus-theft': {
    id: 'aeolus-theft', title: 'Украденный ветер', tone: 'wrath',
    description: 'Один из ветров Эола находится на корабле без согласия хозяина.',
    echo: 'Узел на сосуде ветра стучит сам по себе, будто Эол тянет его с другой стороны моря.',
    stormModifier: 0.055, chance: { cunning: 0.02 },
  },
  'phineus-chart': {
    id: 'phineus-chart', title: 'Карта слепого Финея', tone: 'alliance',
    description: 'Спасённый прорицатель продиктовал путь среди течений и камней.',
    echo: 'На карте Финея проступает новая пометка возле следующей опасности.',
    stormModifier: -0.04, chance: { seamanship: 0.025 },
  },
  'underworld-riddle': {
    id: 'underworld-riddle', title: 'Вопрос, занявший мёртвых', tone: 'secret',
    description: 'Рынок теней всё ещё спорит над загадкой Одиссея.',
    echo: 'Мёртвый шёпот повторяет вопрос, который позволил Одиссею уйти без полной платы.',
    chance: { cunning: 0.02, will: 0.015 },
  },
  'circe-counsel': {
    id: 'circe-counsel', title: 'Предупреждение Кирки', tone: 'oath',
    description: 'Кирка рассказала, как нимфа Скилла стала чудовищем и чего боятся её головы.',
    echo: 'Перед скалистым проливом Одиссей вспоминает голос Кирки и смертное имя Скиллы.',
    scyllaChance: 0.09, chance: { will: 0.015 },
  },
  'helios-oath-kept': {
    id: 'helios-oath-kept', title: 'Нетронутое стадо', tone: 'oath',
    description: 'Команда ушла с Тринакрии, не нарушив запрет Гелиоса.',
    echo: 'Золотой луч ложится на мачту, не обжигая её: Гелиос пока не отвернулся от корабля.',
    chance: { will: 0.03 }, travelEffects: { morale: 1 },
  },
  'helios-angered': {
    id: 'helios-angered', title: 'Кровь солнечного быка', tone: 'wrath',
    description: 'Священное животное Гелиоса было убито, и его шкура пошла вслед за кораблём.',
    echo: 'Даже ночью палуба становится горячей, а мясо в трюме шепчет имя Гелиоса.',
    stormModifier: 0.075, travelEffects: { morale: -2, water: -1 },
  },
  'calypso-promise': {
    id: 'calypso-promise', title: 'Место Калипсо в песне', tone: 'secret',
    description: 'Одиссей обещал нимфе бессмертие в будущих рассказах.',
    echo: 'При всяком новом рассказе о пути люди спрашивают, какую версию Калипсо потребует для себя.',
    chance: { cunning: 0.02 },
  },
  'poseidon-defied': {
    id: 'poseidon-defied', title: 'Вызов земледержцу', tone: 'wrath',
    description: 'Одиссей публично расколол знак Посейдона и назвал море своим врагом.',
    echo: 'Волна ударяет в борт ровно трижды, словно Посейдон повторяет услышанный вызов.',
    chance: { valor: 0.03 }, bossChance: 0.025, stormModifier: 0.07,
  },
  'chosen-sacrifice': {
    id: 'chosen-sacrifice', title: 'Назначенная жертва Скилле', tone: 'wrath',
    description: 'Одиссей заранее выбрал людей, которых чудовище получит у левого борта.',
    echo: 'Перед опасным приказом моряки смотрят на своё место, вспоминая список жертв Скилле.',
    travelEffects: { morale: -1 }, crisisChance: -0.04,
  },
  'symplegades-opened': {
    id: 'symplegades-opened', title: 'Открытый пролом', tone: 'alliance',
    description: 'Троянская бронза навсегда удерживает Симплегады от полного столкновения.',
    echo: 'Рыбацкие суда рассказывают о проходе, который появился после чёрного корабля Одиссея.',
    chance: { seamanship: 0.025 },
  },
  'divine-fire': {
    id: 'divine-fire', title: 'Огонь Гефеста', tone: 'secret',
    description: 'На корабле хранится пламя, способное размягчать бронзу и не гаснущее в море.',
    echo: 'Холодное пламя Гефеста принимает форму хромого мастера и указывает на повреждённый металл.',
    bossChance: 0.04, travelEffects: { hull: 1 },
  },
  'hephaestus-mark': {
    id: 'hephaestus-mark', title: 'Клеймо отвергнутого вора', tone: 'wrath',
    description: 'Божественный огонь узнал чужую руку и оставил на Одиссее знак.',
    echo: 'Бронзовые вещи нагреваются, когда Одиссей касается их обожжённой рукой.',
    chance: { valor: -0.02 },
  },
  'delos-night': {
    id: 'delos-night', title: 'Возвращённая ночь Делоса', tone: 'alliance',
    description: 'Одиссей разрушил оракул и позволил времени снова двигаться на священном острове.',
    echo: 'В ночном небе появляется звезда, которую жители Делоса увидели впервые после освобождения.',
    chance: { will: 0.025 },
  },
  'amazon-alliance': {
    id: 'amazon-alliance', title: 'Стол Антиопы', tone: 'alliance',
    description: 'Греки и амазонки разделили истории войны без требования прощения.',
    echo: 'Красный ремень амазонки на руле напоминает, что не каждый берег нужно завоёвывать.',
    crisisChance: 0.06, chance: { will: 0.015 },
  },
  'victory-surrendered': {
    id: 'victory-surrendered', title: 'Отданная гордость Трои', tone: 'oath',
    description: 'Одиссей помнит победу, но больше не способен чувствовать её сладость.',
    echo: 'Рассказывая о Трое, царь теперь замечает потери раньше собственных подвигов.',
    chance: { will: 0.025 }, crisisChance: 0.03,
  },
  'ghost-fleet-freed': {
    id: 'ghost-fleet-freed', title: 'Распущенный строй мёртвых', tone: 'alliance',
    description: 'Погибшие ахейские корабли получили последний приказ выйти из строя.',
    echo: 'В тумане на миг появляется флагман и салютует живому кораблю холодным синим огнём.',
    chance: { will: 0.025 }, stormModifier: -0.025,
  },
  'labyrinth-sky-map': {
    id: 'labyrinth-sky-map', title: 'Карта промежутков неба', tone: 'secret',
    description: 'Тифий сохранил путь через меняющийся лабиринт по расположению звёзд.',
    echo: 'Перед сложным курсом кормчий разворачивает карту не стен, а кусочков неба.',
    chance: { seamanship: 0.035 },
  },
  'telepylos-pursuit': {
    id: 'telepylos-pursuit', title: 'Списки Телепила', tone: 'wrath',
    description: 'Лестригоны получили сведения о маршруте и могут ждать корабль в будущих портах.',
    echo: 'На далёкой скале появляется слишком большой сигнальный огонь: портовые счётчики ещё ищут беглецов.',
    stormModifier: 0.025, travelEffects: { morale: -1 },
  },
  'scouts-rescued': {
    id: 'scouts-rescued', title: 'Возвращение за разведчиками', tone: 'alliance',
    description: 'Одиссей рискнул кораблём и вернулся за людьми, которых Телепил уже считал грузом.',
    echo: 'Перед новой высадкой разведчики помнят, что корабль однажды вернулся за ними.',
    crisisChance: 0.05, travelEffects: { morale: 1 },
  },
}

const rules: StoryFlagRule[] = [
  { encounterId: 'shore-of-ashes', choiceId: 'inspect-tracks', success: true, flagId: 'black-shore-caution' },
  { encounterId: 'bronze-singer', choiceId: 'answer-song', success: true, flagId: 'siren-truth' },
  { encounterId: 'cyclops-heir', choiceId: 'false-oath', success: true, flagId: 'cyclops-misdirected' },
  { encounterId: 'temple-hecate', choiceId: 'black-door', success: true, flagId: 'tiresias-route' },
  { encounterId: 'lotus-plague', choiceId: 'abandon-sleepers', success: true, flagId: 'dreamers-abandoned' },
  { encounterId: 'talos-island', choiceId: 'talos-mirror', success: true, flagId: 'talos-fallen' },
  { encounterId: 'talos-island', choiceId: 'talos-run', success: true, flagId: 'talos-fallen' },
  { encounterId: 'aeolus-vault', choiceId: 'aeolus-truth', success: true, flagId: 'aeolus-westwind' },
  { encounterId: 'aeolus-vault', choiceId: 'aeolus-steal', success: true, flagId: 'aeolus-theft' },
  { encounterId: 'harpy-feast', choiceId: 'harpy-nets', success: true, flagId: 'phineus-chart' },
  { encounterId: 'harpy-feast', choiceId: 'harpy-arrows', success: true, flagId: 'phineus-chart' },
  { encounterId: 'harpy-feast', choiceId: 'harpy-prayer', success: true, flagId: 'phineus-chart' },
  { encounterId: 'dead-oracle', choiceId: 'dead-riddle', success: true, flagId: 'underworld-riddle' },
  { encounterId: 'circe-loom', choiceId: 'circe-moly', success: true, flagId: 'circe-counsel' },
  { encounterId: 'circe-loom', choiceId: 'circe-mirror', success: true, flagId: 'circe-counsel' },
  { encounterId: 'circe-loom', choiceId: 'circe-sword', success: true, flagId: 'circe-counsel' },
  { encounterId: 'helios-cattle', choiceId: 'helios-guard', success: true, flagId: 'helios-oath-kept' },
  { encounterId: 'helios-cattle', choiceId: 'helios-raft', success: true, flagId: 'helios-oath-kept' },
  { encounterId: 'helios-cattle', choiceId: 'helios-guard', success: false, flagId: 'helios-angered' },
  { encounterId: 'calypso-offer', choiceId: 'calypso-bargain', success: true, flagId: 'calypso-promise' },
  { encounterId: 'storm-altar', choiceId: 'defy-sea', success: true, flagId: 'poseidon-defied' },
  { encounterId: 'charybdis-mouth', choiceId: 'scylla-side', success: true, flagId: 'chosen-sacrifice' },
  { encounterId: 'clashing-rocks', choiceId: 'rocks-wedge', success: true, flagId: 'symplegades-opened' },
  { encounterId: 'hephaestus-forge', choiceId: 'forge-fire', success: true, flagId: 'divine-fire' },
  { encounterId: 'hephaestus-forge', choiceId: 'forge-fire', success: false, flagId: 'hephaestus-mark' },
  { encounterId: 'delos-oracle', choiceId: 'delos-break', success: true, flagId: 'delos-night' },
  { encounterId: 'amazon-trial', choiceId: 'amazon-treaty', success: true, flagId: 'amazon-alliance' },
  { encounterId: 'memory-well', choiceId: 'memory-offer', success: true, flagId: 'victory-surrendered' },
  { encounterId: 'ghost-fleet', choiceId: 'ghost-signal', success: true, flagId: 'ghost-fleet-freed' },
  { encounterId: 'ghost-fleet', choiceId: 'ghost-board', success: true, flagId: 'ghost-fleet-freed' },
  { encounterId: 'labyrinth-tide', choiceId: 'labyrinth-stars', success: true, flagId: 'labyrinth-sky-map' },
  { encounterId: 'laestrygon-harbor', choiceId: 'laestrygon-rescue', success: true, flagId: 'scouts-rescued' },
  { encounterId: 'laestrygon-harbor', choiceId: 'laestrygon-rescue', success: false, flagId: 'telepylos-pursuit' },
]

export function flagsForOutcome(
  encounterId: string,
  choiceId: string,
  success: boolean,
  day: number,
  existingFlags: StoryFlag[],
) {
  const existingIds = new Set(existingFlags.map((flag) => flag.id))
  return rules
    .filter((rule) => rule.encounterId === encounterId && rule.choiceId === choiceId && rule.success === success && !existingIds.has(rule.flagId))
    .map((rule): StoryFlag => {
      const definition = storyFlagDefinitions[rule.flagId]
      return {
        id: definition.id,
        title: definition.title,
        description: definition.description,
        echo: definition.echo,
        tone: definition.tone,
        sourceEncounterId: encounterId,
        sourceChoiceId: choiceId,
        day,
      }
    })
}

export function storyFlagModifiers(flags: StoryFlag[]) {
  const chance: Partial<Record<Skill, number>> = {}
  let bossChance = 0
  let scyllaChance = 0
  let stormModifier = 0
  let crisisChance = 0
  const travelEffects: Effects = {}
  flags.forEach((flag) => {
    const definition = storyFlagDefinitions[flag.id]
    if (!definition) return
    Object.entries(definition.chance ?? {}).forEach(([skill, value]) => {
      chance[skill as Skill] = (chance[skill as Skill] ?? 0) + value
    })
    bossChance += definition.bossChance ?? 0
    scyllaChance += definition.scyllaChance ?? 0
    stormModifier += definition.stormModifier ?? 0
    crisisChance += definition.crisisChance ?? 0
    Object.entries(definition.travelEffects ?? {}).forEach(([key, value]) => {
      const resource = key as keyof Effects
      travelEffects[resource] = (travelEffects[resource] ?? 0) + value
    })
  })
  return {
    chance,
    bossChance: Math.max(-0.12, Math.min(0.12, bossChance)),
    scyllaChance: Math.max(0, Math.min(0.12, scyllaChance)),
    stormModifier: Math.max(-0.16, Math.min(0.16, stormModifier)),
    crisisChance: Math.max(-0.12, Math.min(0.12, crisisChance)),
    travelEffects,
  }
}

export const storyFlagScenes: Record<StoryFlagTone, string> = {
  oath: assetPath('art/memory-oath.jpg'),
  wrath: assetPath('art/memory-wrath.jpg'),
  alliance: assetPath('art/memory-alliance.jpg'),
  secret: assetPath('art/event-underworld.jpg'),
}
