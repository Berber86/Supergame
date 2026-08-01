import { assetPath } from './assets'
import type { Choice, CompanionStoryStance, NamedCompanionId } from './types'

export interface CompanionSagaChapter {
  id: string
  encounterId?: string
  chapter: number
  title: string
  hint: string
  status: 'playable' | 'finale'
}

export interface CompanionSaga {
  companionId: NamedCompanionId
  title: string
  premise: string
  chapters: CompanionSagaChapter[]
}

export interface CompanionStoryEpisode extends CompanionSagaChapter {
  encounterId: string
  companionId: NamedCompanionId
  choices: Record<string, { success: CompanionStoryStance; failure: CompanionStoryStance }>
}

export interface ReactiveSagaContext {
  stance: CompanionStoryStance
  label: string
  arrival: string
  hook: string
  choiceTitle: string
  choiceDescription: string
  aftermath: string
  loyalty: number
  respect: number
  fear: number
}

export interface CompanionFinaleDefinition {
  id: string
  companionId: NamedCompanionId
  eyebrow: string
  title: string
  location: string
  scene: string
  description: string
  quote: string
  choices: Choice[]
}

export const companionSagas: CompanionSaga[] = [
  {
    companionId: 'eurylochus',
    title: 'Цена власти',
    premise: 'Еврилох помнит каждого человека, которого приказ оставил за кормой. Он не просит корону — он проверяет, способен ли царь не держать её мёртвой хваткой.',
    chapters: [
      { id: 'eurylochus-broken-oar', encounterId: 'eurylochus-broken-oar', chapter: 1, title: 'Весло, которое не отдали', hint: 'На берегу ждёт семья гребца, оставленного прежним приказом.', status: 'playable' },
      { id: 'eurylochus-council', encounterId: 'eurylochus-council', chapter: 2, title: 'Каменный совет', hint: 'Право возражать царю нужно заслужить не словами.', status: 'playable' },
      { id: 'eurylochus-crownless', encounterId: 'eurylochus-crownless', chapter: 3, title: 'Корона без головы', hint: 'Старый знак командования требует нового владельца.', status: 'playable' },
      { id: 'eurylochus-homecoming', chapter: 4, title: 'Чей приказ слышит Итака', hint: 'Последняя песнь прозвучит только у дома.', status: 'finale' },
    ],
  },
  {
    companionId: 'tiphys',
    title: 'Небо без звёзд',
    premise: 'Тифий умеет читать море, но не простил себе корабль, который однажды повёл по верному курсу — и всё равно не довёл домой.',
    chapters: [
      { id: 'tiphys-drowned-map', encounterId: 'tiphys-drowned-map', chapter: 1, title: 'Карта утонувшего курса', hint: 'На старой карте есть линия, которую кормчий отказывается объяснить.', status: 'playable' },
      { id: 'tiphys-starless', encounterId: 'tiphys-starless', chapter: 2, title: 'Последний курс', hint: 'Доверие к кормчему начинается там, где нельзя проверить расчёт.', status: 'playable' },
      { id: 'tiphys-lantern', encounterId: 'tiphys-lantern', chapter: 3, title: 'Огонь на мёртвом маяке', hint: 'Маяк продолжает звать корабль, которого уже нет.', status: 'playable' },
      { id: 'tiphys-horizon', chapter: 4, title: 'Горизонт, который он выберет', hint: 'Последний курс нельзя подсмотреть на чужой карте.', status: 'finale' },
    ],
  },
  {
    companionId: 'sinon',
    title: 'Голос деревянного коня',
    premise: 'Синон выжил благодаря словам, которые погубили город. Теперь каждая новая ложь проверяет: спасает ли он людей или просто умеет переживать тех, кто ему поверил.',
    chapters: [
      { id: 'sinon-ash-letters', encounterId: 'sinon-ash-letters', chapter: 1, title: 'Письма из пепла', hint: 'На берег выброшены письма, которые Синон никогда не должен был прочесть.', status: 'playable' },
      { id: 'sinon-witnesses', encounterId: 'sinon-witnesses', chapter: 2, title: 'Маски Дардании', hint: 'У лжи есть свидетели, и они пережили Трою.', status: 'playable' },
      { id: 'sinon-empty-court', encounterId: 'sinon-empty-court', chapter: 3, title: 'Суд без судей', hint: 'Пустой троянский суд помнит только голоса обвиняемых.', status: 'playable' },
      { id: 'sinon-name', chapter: 4, title: 'Имя, которое он оставит', hint: 'Итака узнает, кем был человек, вошедший на корабль под чужой историей.', status: 'finale' },
    ],
  },
  {
    companionId: 'idmon',
    title: 'Пророк, который не хочет знать',
    premise: 'Идмон видел слишком много чужих концов. Его дар полезен кораблю, но никто ещё не спросил, хочет ли он сам жить в мире, где будущее всегда говорит первым.',
    chapters: [
      { id: 'idmon-silent-child', encounterId: 'idmon-silent-child', chapter: 1, title: 'Ребёнок без вопроса', hint: 'Есть пророчество, которое нельзя услышать, пока не решишься не спрашивать.', status: 'playable' },
      { id: 'idmon-eclipse', encounterId: 'idmon-eclipse', chapter: 2, title: 'Затмение Идмона', hint: 'Оракул впервые показывает пророку его собственные похороны.', status: 'playable' },
      { id: 'idmon-ash-tablets', encounterId: 'idmon-ash-tablets', chapter: 3, title: 'Таблички несбывшихся смертей', hint: 'В храме лежат судьбы, которые никто не прожил.', status: 'playable' },
      { id: 'idmon-silence', chapter: 4, title: 'Право на молчание', hint: 'Последнее видение принадлежит не богам, а самому Идмону.', status: 'finale' },
    ],
  },
]

export const companionStoryEpisodes: CompanionStoryEpisode[] = companionSagas.flatMap((saga) =>
  saga.chapters
    .filter((chapter): chapter is CompanionSagaChapter & { encounterId: string } => chapter.status === 'playable' && Boolean(chapter.encounterId))
    .map((chapter) => ({
      ...chapter,
      encounterId: chapter.encounterId,
      companionId: saga.companionId,
      choices: {},
    })),
)

const episodeChoiceStances: Record<string, Record<string, { success: CompanionStoryStance; failure: CompanionStoryStance }>> = {
  'eurylochus-broken-oar': {
    'oar-listen': { success: 'trusted', failure: 'resentful' },
    'oar-silver': { success: 'controlled', failure: 'resentful' },
    'oar-order': { success: 'controlled', failure: 'resentful' },
  },
  'eurylochus-council': {
    'eurylochus-command': { success: 'trusted', failure: 'controlled' },
    'eurylochus-overrule': { success: 'controlled', failure: 'resentful' },
    'eurylochus-staged': { success: 'complicit', failure: 'resentful' },
  },
  'eurylochus-crownless': {
    'crown-share': { success: 'forgiven', failure: 'resentful' },
    'crown-bury': { success: 'trusted', failure: 'controlled' },
    'crown-claim': { success: 'controlled', failure: 'resentful' },
  },
  'tiphys-drowned-map': {
    'map-listen': { success: 'trusted', failure: 'resentful' },
    'map-copy': { success: 'complicit', failure: 'resentful' },
    'map-burn': { success: 'controlled', failure: 'resentful' },
  },
  'tiphys-starless': {
    'tiphys-trust': { success: 'trusted', failure: 'resentful' },
    'tiphys-soundings': { success: 'forgiven', failure: 'controlled' },
    'tiphys-automaton': { success: 'controlled', failure: 'resentful' },
  },
  'tiphys-lantern': {
    'lantern-follow': { success: 'trusted', failure: 'resentful' },
    'lantern-share': { success: 'forgiven', failure: 'complicit' },
    'lantern-douse': { success: 'controlled', failure: 'resentful' },
  },
  'sinon-ash-letters': {
    'letters-read': { success: 'forgiven', failure: 'resentful' },
    'letters-forge': { success: 'complicit', failure: 'resentful' },
    'letters-sink': { success: 'controlled', failure: 'resentful' },
  },
  'sinon-witnesses': {
    'sinon-confess': { success: 'forgiven', failure: 'resentful' },
    'sinon-greater-lie': { success: 'complicit', failure: 'resentful' },
    'sinon-surrender': { success: 'controlled', failure: 'resentful' },
  },
  'sinon-empty-court': {
    'court-speak': { success: 'trusted', failure: 'resentful' },
    'court-mask': { success: 'complicit', failure: 'resentful' },
    'court-leave': { success: 'controlled', failure: 'resentful' },
  },
  'idmon-silent-child': {
    'child-ask': { success: 'trusted', failure: 'resentful' },
    'child-protect': { success: 'forgiven', failure: 'controlled' },
    'child-command': { success: 'controlled', failure: 'resentful' },
  },
  'idmon-eclipse': {
    'idmon-read': { success: 'trusted', failure: 'resentful' },
    'idmon-blind-oracle': { success: 'complicit', failure: 'resentful' },
    'idmon-break': { success: 'controlled', failure: 'resentful' },
  },
  'idmon-ash-tablets': {
    'tablets-open': { success: 'trusted', failure: 'resentful' },
    'tablets-alter': { success: 'complicit', failure: 'resentful' },
    'tablets-seal': { success: 'forgiven', failure: 'controlled' },
  },
}

companionStoryEpisodes.forEach((episode) => {
  episode.choices = episodeChoiceStances[episode.id] ?? {}
})

export const companionStoryEpisodeByEncounter = new Map(companionStoryEpisodes.map((episode) => [episode.encounterId, episode]))
export const companionStoryEpisodeById = new Map(companionStoryEpisodes.map((episode) => [episode.id, episode]))

export function storyEpisodeForEncounter(encounterId: string) {
  return companionStoryEpisodeByEncounter.get(encounterId)
}

export function sagaForCompanion(companionId: NamedCompanionId) {
  return companionSagas.find((saga) => saga.companionId === companionId)
}

export function nextStoryEpisode(companionId: NamedCompanionId, knownEpisodeIds: string[]) {
  const saga = sagaForCompanion(companionId)
  if (!saga) return undefined
  return saga.chapters
    .filter((chapter): chapter is CompanionSagaChapter & { encounterId: string } => chapter.status === 'playable' && Boolean(chapter.encounterId))
    .find((chapter) => !knownEpisodeIds.includes(chapter.id))
}

const companionNames: Record<NamedCompanionId, string> = {
  eurylochus: 'Еврилох', tiphys: 'Тифий', sinon: 'Синон', idmon: 'Идмон',
}

const stanceLanguage: Record<CompanionStoryStance, Omit<ReactiveSagaContext, 'stance'>> = {
  trusted: {
    label: 'ДОВЕРИЕ',
    arrival: 'После прежней песни спутник не ждёт приказа в молчании: он первым делится тем, чего боится, и позволяет Одиссею ответить не как царю, а как человеку.',
    hook: 'Прежнее доверие делает этот разговор опаснее: теперь его можно не только потерять, но и оправдать.',
    choiceTitle: 'Разделить решение с ним',
    choiceDescription: 'Не прятать цену за царским приказом и дать спутнику право на собственный голос.',
    aftermath: 'Прежнее доверие не исчезло после опасности: оно стало частью решения, а не наградой за него.',
    loyalty: 3, respect: 2, fear: -2,
  },
  controlled: {
    label: 'КОНТРОЛЬ',
    arrival: 'Спутник выполняет приказ без промедления, но его точность похожа на броню. Он ждёт, в какой миг Одиссей снова решит за него, что ему следует чувствовать.',
    hook: 'Прошлая глава научила его подчиняться; теперь нужно решить, будет ли это послушанием или общей работой.',
    choiceTitle: 'Спросить, а не назначить роль',
    choiceDescription: 'Отдать спутнику часть решения, хотя так труднее сохранить полный контроль над исходом.',
    aftermath: 'Старый контроль не исчез, но получил трещину: спутник заметил, что царь способен спросить, а не только распределять.',
    loyalty: 1, respect: 3, fear: -1,
  },
  complicit: {
    label: 'ОБЩАЯ ТАЙНА',
    arrival: 'Между Одиссеем и спутником уже есть поступок, о котором команда знает не всё. Любое слово здесь может превратить союз в признание или в новую договорённость молчать.',
    hook: 'Тайна даёт им язык без слов, но делает каждого свидетелем чужой вины.',
    choiceTitle: 'Назвать цену общей тайны',
    choiceDescription: 'Не использовать прежнюю уловку автоматически и дать спутнику решить, что команда имеет право знать.',
    aftermath: 'Общая тайна перестала быть просто удобной связью: теперь оба знают, что за неё придётся отвечать позже.',
    loyalty: 2, respect: 1, fear: 1,
  },
  resentful: {
    label: 'ОБИДА',
    arrival: 'Спутник отвечает коротко и смотрит не на Одиссея, а на море. Его прежняя обида не исчезла: она просто стала аккуратнее и теперь слышит каждую неточную клятву.',
    hook: 'Эта встреча не требует немедленного прощения. Она требует не повторить жест, из-за которого обида появилась.',
    choiceTitle: 'Признать право на гнев',
    choiceDescription: 'Не покупать примирение и не требовать верности в обмен на спасение.',
    aftermath: 'Обида осталась, но перестала быть молчаливым оружием: спутник увидел, что царь хотя бы не отрицает её причины.',
    loyalty: 2, respect: 3, fear: -1,
  },
  forgiven: {
    label: 'НЕПРОСТОЕ ПРОЩЕНИЕ',
    arrival: 'Спутник не забыл прежней цены, но больше не заставляет Одиссея платить её в каждом разговоре. Это не мир, а хрупкое право снова работать рядом.',
    hook: 'Прощение не освобождает от ответственности — оно даёт шанс не повторить прежний выбор.',
    choiceTitle: 'Защитить хрупкое примирение',
    choiceDescription: 'Выбрать поступок, который подтвердит прощение делом, а не красивой речью.',
    aftermath: 'Прощение пережило новое испытание и перестало быть жестом, сделанным только ради тишины на палубе.',
    loyalty: 4, respect: 2, fear: -2,
  },
}

export function reactiveSagaContext(stance: CompanionStoryStance): ReactiveSagaContext {
  return { stance, ...stanceLanguage[stance] }
}

const finaleDefinitions: Record<NamedCompanionId, CompanionFinaleDefinition> = {
  eurylochus: {
    id: 'eurylochus-homecoming', companionId: 'eurylochus', eyebrow: 'Последний совет перед домом', title: 'Чей приказ слышит Итака', location: 'Врата Итаки · Ночная палуба',
    scene: assetPath('art/finale-eurylochus-homecoming.jpg'),
    description: 'Огни Итаки видны за штормом. Еврилох просит не обещания, а последний ответ: когда дом окажется рядом, кто будет решать, сколько людей и какой правдой войдут в него?',
    quote: '«Если власть нельзя разделить у дома, значит, в море мы только репетировали послушание.»',
    choices: [
      { id: 'eurylochus-finale-council', title: 'Созвать последний совет команды', description: 'Пусть каждый услышит цену возвращения до того, как берег станет оправданием.', skill: 'will', difficulty: 7, success: { text: 'Еврилох кладёт свой жезл рядом с царским. Никто не получает равную власть, но никто больше не притворяется, что голоса команды ничего не весят.', effects: { morale: 13 } }, failure: { text: 'Совет превращается в перечисление старых мертвецов, и Еврилох понимает, что честность не всегда лечит вовремя.', effects: { morale: -8 } } },
      { id: 'eurylochus-finale-burden', title: 'Взять последний приказ только на себя', description: 'Не просить Еврилоха делить вину за выбор у Итаки.', skill: 'valor', difficulty: 8, success: { text: 'Одиссей оставляет Еврилоху право спорить, но не требует нести последнюю ответственность. Заместитель впервые принимает это как доверие, а не как отстранение.', effects: { morale: 8, health: -2 } }, failure: { text: 'Слова о личной ответственности звучат как новая попытка не дать никому участвовать в решении.', effects: { morale: -11 } } },
      { id: 'eurylochus-finale-mask', title: 'Сохранить единый голос перед Итакой', description: 'Спрятать раскол команды, чтобы дом увидел только непобеждённый корабль.', skill: 'cunning', difficulty: 7, success: { text: 'Еврилох поддерживает единую речь, но оба знают, сколько несказанного останется за её ровным тоном.', effects: { morale: 5 }, coins: 14 }, failure: { text: 'Гребцы слышат репетицию лжи и отказываются повторять её у берега.', effects: { morale: -13 } } },
    ],
  },
  tiphys: {
    id: 'tiphys-horizon', companionId: 'tiphys', eyebrow: 'Берег, который нельзя вычислить', title: 'Горизонт, который он выберет', location: 'Врата Итаки · Последняя вахта',
    scene: assetPath('art/finale-tiphys-horizon.jpg'),
    description: 'Итака видна только между провалами волн. Тифий признаётся: он может взять безопасный канал, но он приведёт корабль к чужой бухте. Прямой путь домой лежит через течение, которого он боялся всю жизнь.',
    quote: '«Кормчий не обязан знать всё море. Но он обязан сказать, когда выбирает веру вместо расчёта.»',
    choices: [
      { id: 'tiphys-finale-trust', title: 'Отдать Тифию последний руль', description: 'Позволить ему выбрать путь домой без нового совета и без страховочной команды.', skill: 'seamanship', difficulty: 8, success: { text: 'Тифий ведёт судно по течению, которое когда-то бросило его одного. На этот раз за кормой не остаётся ни одного огня.', effects: { hull: 8, morale: 10 } }, failure: { text: 'Он слишком долго ждёт идеального знака, и волна разбивает руль о знакомый камень.', effects: { hull: -14, morale: -7 } } },
      { id: 'tiphys-finale-share', title: 'Провести Итаку общими замерами', description: 'Пусть кормчий ведёт, а команда вслух считает глубину и ветер.', skill: 'will', difficulty: 7, success: { text: 'Голоса не спорят, а держат ритм. Тифий входит домой не одиноким мастером, а первым среди людей, умеющих слушать море.', effects: { morale: 14, hull: 3 } }, failure: { text: 'Общий счёт сбивается на последней волне, и Тифий слышит в нём старое недоверие.', effects: { hull: -9, crew: -1 } } },
      { id: 'tiphys-finale-anchor', title: 'Выбрать безопасную чужую бухту', description: 'Спасти корабль наверняка и признать, что до Итаки придётся идти пешком.', skill: 'cunning', difficulty: 6, success: { text: 'Тифий выбирает жизнь вместо красивого возвращения. На берег он сходит последним, но впервые не считает это поражением.', effects: { morale: 6 }, coins: 10 }, failure: { text: 'Чужая бухта оказывается закрыта цепью, и осторожность превращается в новую ловушку.', effects: { morale: -12, water: -4 } } },
    ],
  },
  sinon: {
    id: 'sinon-name', companionId: 'sinon', eyebrow: 'Имя перед домом', title: 'Имя, которое он оставит', location: 'Врата Итаки · Бортовая тень',
    scene: assetPath('art/finale-sinon-name.jpg'),
    description: 'Перед берегом Синон отдаёт Одиссею свиток с тремя именами: тем, под которым он вошёл в Трою, тем, под которым выжил, и тем, которое хочет назвать людям Итаки. Одно из них — ложь, но не обязательно худшая.',
    quote: '«Человек меняет имя не тогда, когда лжёт, а когда решает, кто будет жить с последствиями.»',
    choices: [
      { id: 'sinon-finale-name', title: 'Позволить Синону назвать себя самому', description: 'Не писать ему роль в своей песне и не требовать удобной версии для Итаки.', skill: 'will', difficulty: 8, success: { text: 'Синон называет имя без оправдания. Оно не очищает прошлого, но впервые принадлежит человеку, который готов нести его дальше.', effects: { morale: 10 } }, failure: { text: 'Последнее признание превращается в привычную игру слов, и Синон сам слышит, как теряет собственный голос.', effects: { morale: -10 } } },
      { id: 'sinon-finale-truth', title: 'Вписать полную правду в летопись', description: 'Пусть Итака узнает и заслуги, и вину человека, который плыл рядом.', skill: 'cunning', difficulty: 7, success: { text: 'Одиссей не делает из Синона ни чудовище, ни героя. Свиток остаётся неудобной правдой, которую нельзя выгодно пересказать.', effects: { morale: 8 }, coins: 12 }, failure: { text: 'Слова оказываются слишком точными для милосердия и слишком удобными для новой легенды.', effects: { morale: -11 } } },
      { id: 'sinon-finale-silence', title: 'Сжечь все три имени', description: 'Дать Синону начать у дома без прошлого, которое уже никого не вернёт.', skill: 'valor', difficulty: 7, success: { text: 'Пепел уходит в море. Синон не свободен от памяти, но впервые не обязан превращать её в роль для чужой публики.', effects: { morale: 6, health: -2 } }, failure: { text: 'Ветер несёт обрывки к берегу, и люди Итаки получают только худшие куски истории.', effects: { morale: -13 } } },
    ],
  },
  idmon: {
    id: 'idmon-silence', companionId: 'idmon', eyebrow: 'Последнее видение', title: 'Право на молчание', location: 'Врата Итаки · Чёрная вода',
    scene: assetPath('art/finale-idmon-silence.jpg'),
    description: 'Перед Итакой Идмон видит одно последнее будущее: дом, который примет Одиссея, и дом, который отвернётся. Он может сказать, какое ближе, но просит царя впервые решить, обязан ли пророк быть полезным до конца.',
    quote: '«Молчание пророка — не отсутствие дара. Иногда это единственная свобода, которую дар оставил.»',
    choices: [
      { id: 'idmon-finale-silence', title: 'Запретить последнее пророчество', description: 'Пусть Идмон войдёт в неизвестность вместе со всеми, а не впереди них.', skill: 'will', difficulty: 7, success: { text: 'Идмон бросает чашу в море и смеётся от страха: впервые он не знает, что будет через час.', effects: { morale: 12 } }, failure: { text: 'Видение всё равно прорывается наружу, но Идмон понимает, что царь хотя бы пытался освободить его от службы дару.', effects: { morale: -6 } } },
      { id: 'idmon-finale-share', title: 'Разделить видение со всей командой', description: 'Не заставлять пророка нести последний страх в одиночку.', skill: 'cunning', difficulty: 8, success: { text: 'Люди видят разные версии дома и перестают требовать от Идмона единственно верного ответа.', effects: { morale: 9, health: -2 }, coins: 9 }, failure: { text: 'Каждый цепляется за увиденную версию, и корабль входит к берегу с четырьмя разными будущими.', effects: { morale: -12 } } },
      { id: 'idmon-finale-ask', title: 'Потребовать точный ответ для царя', description: 'Использовать последнее видение, чтобы выбрать безопасный способ вернуться.', skill: 'valor', difficulty: 7, success: { text: 'Идмон называет путь, но перед этим просит запомнить: он сделал это по приказу, а не по собственному желанию.', effects: { hull: 6, morale: 4 } }, failure: { text: 'Пророчество даёт две противоречивые даты, и царь получает знание, которое не умеет применить.', effects: { morale: -14, health: -4 } } },
    ],
  },
}

const finaleChoiceStances: Record<string, { success: CompanionStoryStance; failure: CompanionStoryStance }> = {
  'eurylochus-finale-council': { success: 'forgiven', failure: 'resentful' }, 'eurylochus-finale-burden': { success: 'trusted', failure: 'controlled' }, 'eurylochus-finale-mask': { success: 'complicit', failure: 'resentful' },
  'tiphys-finale-trust': { success: 'trusted', failure: 'resentful' }, 'tiphys-finale-share': { success: 'forgiven', failure: 'controlled' }, 'tiphys-finale-anchor': { success: 'controlled', failure: 'resentful' },
  'sinon-finale-name': { success: 'forgiven', failure: 'resentful' }, 'sinon-finale-truth': { success: 'trusted', failure: 'complicit' }, 'sinon-finale-silence': { success: 'controlled', failure: 'resentful' },
  'idmon-finale-silence': { success: 'forgiven', failure: 'resentful' }, 'idmon-finale-share': { success: 'trusted', failure: 'complicit' }, 'idmon-finale-ask': { success: 'controlled', failure: 'resentful' },
}

export function finaleForCompanion(companionId: NamedCompanionId, priorStance: CompanionStoryStance) {
  const finale = finaleDefinitions[companionId]
  const context = reactiveSagaContext(priorStance)
  return {
    ...finale,
    description: `${finale.description}\n\n${companionNames[companionId]} приходит к этому разговору через состояние «${context.label.toLowerCase()}». ${context.arrival}`,
    choices: finale.choices.map((choice, index) => index === 0 ? {
      ...choice,
      title: context.choiceTitle,
      description: context.choiceDescription,
    } : choice),
  }
}

export function finaleStance(choiceId: string, success: boolean) {
  return finaleChoiceStances[choiceId]?.[success ? 'success' : 'failure'] ?? (success ? 'trusted' : 'resentful')
}
