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
    title: 'Свинец под короной',
    premise: 'Еврилох помнит лица всех, кого царский приказ превратил в пену за кормой. Ему не нужен трон Итаки — он лишь хочет знать, способен ли Одиссей разжать пальцы, когда власть требует принести в жертву человечность.',
    chapters: [
      { id: 'eurylochus-broken-oar', encounterId: 'eurylochus-broken-oar', chapter: 1, title: 'Мёртвое дерево', hint: 'У воды ждёт семья того, кого когда-то перечеркнул короткий приказ.', status: 'playable' },
      { id: 'eurylochus-council', encounterId: 'eurylochus-council', chapter: 2, title: 'Суд холодных камней', hint: 'На этом острове преданность доказывают не поклоном, а обнажённым клинком правды.', status: 'playable' },
      { id: 'eurylochus-crownless', encounterId: 'eurylochus-crownless', chapter: 3, title: 'Венец для палача', hint: 'Бронза, покрытая патиной старых предательств, ждёт нового хозяина.', status: 'playable' },
      { id: 'eurylochus-homecoming', chapter: 4, title: 'Шепот перед Итакой', hint: 'Последний приговор произносится там, где бьются волны родного берега.', status: 'finale' },
    ],
  },
  {
    companionId: 'tiphys',
    title: 'Соль на старых ранах',
    premise: 'Тифий читает море так же легко, как другие — лица старых друзей. Но он до сих пор не простил себе тот единственный корабль, который пошёл за ним по верному курсу — и опустился на дно. Теперь каждый удар волны о киль звучит для него как обвинение.',
    chapters: [
      { id: 'tiphys-drowned-map', encounterId: 'tiphys-drowned-map', chapter: 1, title: 'Карта с запахом тины', hint: 'На размытой глине проступает маршрут, который кормчий отказывается вспоминать.', status: 'playable' },
      { id: 'tiphys-starless', encounterId: 'tiphys-starless', chapter: 2, title: 'Океан без горизонта', hint: 'Абсолютное доверие к рулевому рождается там, где глаза слепнут.', status: 'playable' },
      { id: 'tiphys-lantern', encounterId: 'tiphys-lantern', chapter: 3, title: 'Свет погасшего маяка', hint: 'Луч в ночи упрямо зовёт судно, чьи доски давно сгнили на рифах.', status: 'playable' },
      { id: 'tiphys-horizon', chapter: 4, title: 'Курс на последний берег', hint: 'Путь домой не проложишь по чужим чертежам.', status: 'finale' },
    ],
  },
  {
    companionId: 'sinon',
    title: 'Эхо Деревянного Коня',
    premise: 'Синон выжил благодаря единственной лжи, которая сожгла величайший из городов. Теперь, переступая через пепел своего прошлого, он не знает: спасает ли его дар жизни товарищей, или он просто научился мастерски переживать тех, кто имел глупость ему поверить.',
    chapters: [
      { id: 'sinon-ash-letters', encounterId: 'sinon-ash-letters', chapter: 1, title: 'Пепел в глиняных тубусах', hint: 'Волны принесли послания от тех, чью кровь он пролил своими словами.', status: 'playable' },
      { id: 'sinon-witnesses', encounterId: 'sinon-witnesses', chapter: 2, title: 'Бронзовые лики Дардании', hint: 'У каждой лжи есть выжившие свидетели. И они помнят твоё лицо.', status: 'playable' },
      { id: 'sinon-empty-court', encounterId: 'sinon-empty-court', chapter: 3, title: 'Приговор камней', hint: 'Разрушенные своды суда жаждут услышать последнюю исповедь.', status: 'playable' },
      { id: 'sinon-name', chapter: 4, title: 'Имя для могилы', hint: 'Итака должна узнать истинное имя того, кто прятался в тени чужих смертей.', status: 'finale' },
    ],
  },
  {
    companionId: 'idmon',
    title: 'Пытка открытых глаз',
    premise: 'Идмон видел слишком много чужих смертей, чтобы ценить жизнь. Его проклятие стало щитом для корабля, но никто ещё не спросил пророка: каково это — дышать в мире, где завтрашний день всегда наступает раньше сегодняшнего?',
    chapters: [
      { id: 'idmon-silent-child', encounterId: 'idmon-silent-child', chapter: 1, title: 'Эхо несказанных слов', hint: 'Самое страшное пророчество — то, которое ты решаешь не будить.', status: 'playable' },
      { id: 'idmon-eclipse', encounterId: 'idmon-eclipse', chapter: 2, title: 'Чёрное солнце Феспротии', hint: 'Оракул впервые разворачивает зеркало судьбы к тому, кто привык стоять за его спиной.', status: 'playable' },
      { id: 'idmon-ash-tablets', encounterId: 'idmon-ash-tablets', chapter: 3, title: 'Архив несгоревшего пепла', hint: 'В мёртвом храме хранятся судьбы, от которых сумели уклониться.', status: 'playable' },
      { id: 'idmon-silence', chapter: 4, title: 'Последняя тайна Идмона', hint: 'Самое важное видение принадлежит не Одиссею, а тому, кто его принёс.', status: 'finale' },
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

const eurylochusStanceLanguage: Record<CompanionStoryStance, Omit<ReactiveSagaContext, 'stance'>> = {
  trusted: {
    label: 'ГОРЬКОЕ ДОВЕРИЕ',
    arrival: 'Еврилох идёт рядом, и в его шаге нет ни тени прежней покорности. Он говорит прямо, без «царь» через слово, — как с равным, которого уважает и которому не простит лжи.',
    hook: 'Доверие солдата — не подарок. Это оружие, которое он сам вложил тебе в руку; оберни его против него — и второй раз не даст.',
    choiceTitle: 'Взвалить груз на двоих',
    choiceDescription: 'Не укрываться за царским щитом. Дать Еврилоху право ударить словом, чтобы выстоять вместе.',
    aftermath: 'Еврилох кивает, принимая решение как приказ, но в глазах — не подчинение, а согласие. Для него это разные вещи, и он рад, что ты это понял.',
    loyalty: 3, respect: 2, fear: -2,
  },
  controlled: {
    label: 'ХОЛОДНЫЙ КОНТРОЛЬ',
    arrival: 'Еврилох отвечает коротко и ровно, как на смотре: «Есть, царь». В каждом «есть» — отдача по уставу, но не по духу. Он выполняет приказы точно, и эта точность страшнее любого крика.',
    hook: 'Он сомкнул строй вокруг себя. Пробить эту стену можно одним — на минуту перестать отдавать приказы.',
    choiceTitle: 'Разомкнуть железную хватку',
    choiceDescription: 'Рискнуть потерей абсолютного контроля, чтобы показать: на этом корабле ещё остались живые люди.',
    aftermath: 'Лёд тронулся: Еврилох позволил себе вопрос, которого не задал бы подчинённый. Царь впервые за много дней услышал не «есть», а «почему».',
    loyalty: 1, respect: 3, fear: -1,
  },
  complicit: {
    label: 'СВЯЗАННЫЕ ГРЕХОМ',
    arrival: 'Еврилох смотрит на тебя слишком понимающе. Между вами лежит приказ, о котором команда не знает, и эта общая тьма сроднила вас крепче верности.',
    hook: 'Общий грех — тот же строй: пока держите ряд, вы сильны. Дрогнет один — и строй разомкнётся на виду у всех.',
    choiceTitle: 'Выставить счёт за молчание',
    choiceDescription: 'Отказаться от привычного обмана. Бросить вызов Еврилоху: пусть сам решит, что из их тьмы увидит свет.',
    aftermath: 'Тайна осталась тайной, но Еврилох больше не смотрит на неё как на цепь. Она стала общим грузом, который легче нести вдвоём, — и оба это знают.',
    loyalty: 2, respect: 1, fear: 1,
  },
  resentful: {
    label: 'ТЛЕЮЩАЯ ОБИДА',
    arrival: 'Еврилох молчит. Не из осторожности — из упрямства человека, который выучил, что слова царя стоят ровно столько, сколько весили обещания, данные под Троей.',
    hook: 'Он не станет кричать и не поднимет оружия. Он просто перестанет верить — а войско без веры держится только на страхе.',
    choiceTitle: 'Принять его ненависть как право',
    choiceDescription: 'Не требовать фальшивых улыбок. Позволить ему ненавидеть решения царя, пока он выполняет их.',
    aftermath: 'Обида не ушла, но Еврилох увидел главное: ты не стал от неё отмахиваться. Солдату этого часто довольно, чтобы ждать, а не стрелять.',
    loyalty: 2, respect: 3, fear: -1,
  },
  forgiven: {
    label: 'ПЕПЕЛ ПРОЩЕНИЯ',
    arrival: 'Еврилох уже не цедит слова сквозь зубы. Он говорит с тобой, как со старым раненым товарищем: бережно, но без скидок.',
    hook: 'Перемирие — как походный костёр: пока в него подбрасывают дрова, он греет. Оставь без присмотра — и ветер раздует из него новый пожар.',
    choiceTitle: 'Доказать право на это прощение',
    choiceDescription: 'Действовать так, чтобы Еврилох не пожалел о том дне, когда решил опустить меч.',
    aftermath: 'Он снова называет тебя «царь», но теперь в этом слове нет ни страха, ни насмешки. Есть то, что было до Трои: уважение, завоёванное делом.',
    loyalty: 4, respect: 2, fear: -2,
  },
}

const idmonStanceLanguage: Record<CompanionStoryStance, Omit<ReactiveSagaContext, 'stance'>> = {
  trusted: {
    label: 'ГОРЬКОЕ ДОВЕРИЕ',
    arrival: 'Идмон говорит первым — для человека, привыкшего отвечать только на вопросы, это знак, равный исповеди. Он делится не пророчеством, а страхом: пророк впервые боится не за других.',
    hook: 'Доверие провидца — как зажжённая нить: он показывает тебе её начало, зная, что конец уже предрешён. Не оборви её — и увидишь больше, чем хотел.',
    choiceTitle: 'Взвалить тяжесть рока на двоих',
    choiceDescription: 'Не укрываться за царской властью. Позволить Идмону решить, стоит ли эта жертва их общей цели.',
    aftermath: 'Идмон не назвал будущего — он показал тебе его тень, и ты не отвёл глаз. Для него это больше, чем вера: доказательство, что царь способен смотреть.',
    loyalty: 3, respect: 2, fear: -2,
  },
  controlled: {
    label: 'ПУСТОТА ПОВИНОВЕНИЯ',
    arrival: 'Идмон стоит, опустив глаза, и перечисляет видения ровным голосом, как писец — чужие долги. Он стал твоим инструментом и сам это понял; в его покорности нет жизни.',
    hook: 'Слепое орудие видит больше зрячего: оно не выбирает, куда смотреть. Разбуди в нём выбор — или не спрашивай потом, почему он выбрал против тебя.',
    choiceTitle: 'Разорвать нити кукловода',
    choiceDescription: 'Остановить механизм приказов. Заставить его вспомнить, что у него всё ещё есть право выбора.',
    aftermath: 'Ты не стал тянуть из него видение силой — и Идмон впервые за долгие годы моргнул, как живой. Нить, на которой он висел, ослабла на один узел.',
    loyalty: 1, respect: 3, fear: -1,
  },
  complicit: {
    label: 'СВЯЗАННЫЕ ТАЙНОЙ',
    arrival: 'Между вами стоит пророчество, сказанное шёпотом и скрытое от команды. Идмон носит его, как носят чужой грех, — и вы оба знаете, что тени таких тайн не прощают.',
    hook: 'Общая тайна — как две нити, связанные одним узлом: пока узел держит, вы неразделимы. Развяжешь — и каждая пойдёт своей дорогой в темноту.',
    choiceTitle: 'Вытащить правду на свет',
    choiceDescription: 'Отказаться от привычного обмана. Дать команде увидеть истинную цену, которую платит пророк.',
    aftermath: 'Тайна перестала быть цепью: Идмон увидел, что ты несёшь её рядом, а не за его спиной. Узел не развязался, но стал мягче.',
    loyalty: 2, respect: 1, fear: 1,
  },
  resentful: {
    label: 'ТЛЕЮЩАЯ НЕНАВИСТЬ',
    arrival: 'Идмон отвечает так, будто говорит с пустотой: глаза не на тебе, голос без красок. Он видел твою смерть — или ту, что ты заслужил, — и не считает нужным скрывать, что знает больше.',
    hook: 'Обиженный провидец — это приговор, который ещё не вынесен. Он ждёт, когда ты сам наступишь на линию, которую видит заранее.',
    choiceTitle: 'Принять его ненависть как щит',
    choiceDescription: 'Не пытаться купить прощение. Позволить ему ненавидеть решения царя, но выжить благодаря им.',
    aftermath: 'Ты не стал вымаливать прощение — и Идмон принял это как данность. С пророком нельзя торговаться: можно только не лгать, и ты не солгал.',
    loyalty: 2, respect: 3, fear: -1,
  },
  forgiven: {
    label: 'ШРАМЫ ПЕРЕМИРИЯ',
    arrival: 'Идмон снова смотрит на тебя — не сквозь, а на. Для человека, видевшего слишком много смертей, это значит: он решил, что твоя — не обязательна.',
    hook: 'Прощение пророка — как свет в конце видения: он есть, пока ты идёшь к нему. Остановишься — и тьма сомкнётся быстрее, чем ты моргнёшь.',
    choiceTitle: 'Оправдать подаренный шанс',
    choiceDescription: 'Сделать выбор, который докажет: прошлые жертвы чему-то научили владыку Итаки.',
    aftermath: 'Идмон не сказал, что ждёт тебя впереди, — он сказал, что пойдёт рядом. Для пророка, который всегда шёл один, это сильнее любого пророчества.',
    loyalty: 4, respect: 2, fear: -2,
  },
}

const sinonStanceLanguage: Record<CompanionStoryStance, Omit<ReactiveSagaContext, 'stance'>> = {
  trusted: { label: 'ГОРЬКОЕ ДОВЕРИЕ', arrival: 'Синон снимает маску сам, без твоей просьбы, — и под ней оказывается лицо усталого человека, а не очередная роль. Для лжеца, который двадцать лет не выходил из образа, это спектакль в один акт, без зрителей.', hook: 'Доверие Синона — самая дорогая вещь на корабле: оно куплено ценой его лучшей лжи. Потеряешь — и он больше никогда не сыграет для тебя честно.', choiceTitle: 'Встать с ним плечом к плечу', choiceDescription: 'Не укрываться за царским авторитетом. Позволить Синону самому выбрать свою судьбу в этом испытании.', aftermath: 'Синон не аплодирует и не кланяется: он просто остался рядом, когда можно было уйти в тень. Для него это самая честная сцена за всю войну.', loyalty: 3, respect: 2, fear: -2 },
  controlled: { label: 'СЛОМЛЕННЫЙ ИНСТРУМЕНТ', arrival: 'Синон исполняет всё, что ты велишь, — и в каждом жесте сквозит отрепетированная покорность. Это худшая из его ролей: раб, который помнит, как играл царей.', hook: 'Кукла на нитях опасна тем, что нити однажды оказываются в её руках. Дай ему свободу сейчас — или готовься к финалу, в котором автор он.', choiceTitle: 'Разорвать поводок', choiceDescription: 'Остановить поток приказов. Дать Синону свободу решить, что делать со своей виной.', aftermath: 'Ты отпустил поводок на ладонь — и Синон, привыкший к клетке, растерялся. Впервые его следующая роль выбиралась не по указке, и он не знал, как её играть.', loyalty: 1, respect: 3, fear: -1 },
  complicit: { label: 'АРХИТЕКТОРЫ ЛЖИ', arrival: 'Вы обмениваетесь взглядами, понятными только вам двоим, — как актёры, знающие чужой текст лучше своего. Между вами ложь, скормленная команде, и она идёт вам обоим на руку.', hook: 'Общая тайна — это спектакль, в котором вы оба заняты без дублёров. Сорвёшь реплику — и зал узнает, что весь пролог был обманом.', choiceTitle: 'Вывести правду на свет', choiceDescription: 'Отказаться от привычной игры в напёрстки. Заставить Синона посмотреть в глаза своим демонам.', aftermath: 'Союз заговорщиков стал чем-то большим: Синон понял, что с тобой можно не доигрывать сцену до конца. Он оставил маску на столе — впервые не по приказу, а по желанию.', loyalty: 2, respect: 1, fear: 1 },
  resentful: { label: 'ЛЕДЯНАЯ НЕНАВИСТЬ', arrival: 'Синон улыбается — и от этой улыбки холодок по спине. Он вежлив, точен и ядовит, как человек, который помнит каждое твоё слово и ждёт, когда ты повторишь ошибку.', hook: 'Обиженный лжец опаснее врага: враг атакует, а Синон будет ждать за кулисами, пока твоя сцена сама не рассыплется.', choiceTitle: 'Признать его право на гнев', choiceDescription: 'Не требовать фальшивой верности и не играть в милосердие. Принять его ненависть как факт.', aftermath: 'Ты не стал играть с ним в благородство — и Синон это оценил. С ним работает только правда: он слишком хорошо знает цену фальши.', loyalty: 2, respect: 3, fear: -1 },
  forgiven: { label: 'ХРУПКИЙ МИР', arrival: 'Синон заговаривает с тобой без обычной иронии — ровно, по-человечески, и это так непривычно, что команда оборачивается. Мир между вами хрупок, как кулисы из папируса.', hook: 'Прощение Синона — это не антракт, а новый акт. Один неверный жест — и занавес упадёт, оставив на сцене только пепел.', choiceTitle: 'Оправдать дарованное прощение', choiceDescription: 'Доказать делами, что вы извлекли урок из прошлых ошибок и готовы защищать его право на искренность.', aftermath: 'Он снова надел маску — но теперь по своей воле, для чужих, а не для тебя. С тобой Синон остался без грима, и это его собственный выбор.', loyalty: 4, respect: 2, fear: -2 },
}

const tiphysStanceLanguage: Record<CompanionStoryStance, Omit<ReactiveSagaContext, 'stance'>> = {
  trusted: { label: 'ГОРЬКОЕ ДОВЕРИЕ', arrival: 'Тифий подходит сам — для кормчего, который десять лет никому не доверял руль, это больше, чем клятва. Он говорит о воде как о живом существе и не прячет, что боится её.', hook: 'Доверие кормчего — это карта, которую он рисует для одного тебя. Используй её неверно — и следующую ночь он проведёт у чужого штурвала.', choiceTitle: 'Встать с ним у штурвала', choiceDescription: 'Не укрываться за царским приказом. Разделить с ним груз невозможного выбора в этой темноте.', aftermath: 'Тифий впервые за долгие годы вёл корабль не один: ты стоял рядом, и руль слушался двоих. Такое не забывается — такое записывают в судовой журнал.', loyalty: 3, respect: 2, fear: -2 },
  controlled: { label: 'МЁРТВЫЙ КОМПАС', arrival: 'Тифий держит руль так, будто это его единственное живое место: спина прямая, глаза пустые. Он ведёт судно безупречно и молча — как ведут к месту казни.', hook: 'Идеальный кормчий — тот, кто не спрашивает. Но именно идеальный кормчий однажды уводит корабль туда, где его молчание дороже всех карт.', choiceTitle: 'Освободить живой разум', choiceDescription: 'Отказаться от привычки указывать. Задать вопрос и позволить механизму снова стать человеком.', aftermath: 'Тифий выполнил приказ точно, но когда ты на минуту отвёл его от руля, он вздрогнул — как человек, которого разбудили. Механизм дал трещину.', loyalty: 1, respect: 3, fear: -1 },
  complicit: { label: 'КРОВАВЫЙ КИЛЬВАТЕР', arrival: 'Между вами — курс, проложенный в обход команды, и Тифий ведёт по нему, не поднимая глаз от воды. Вы оба знаете: в море такие карты рано или поздно всплывают.', hook: 'Общая тайна — как трюмная вода: пока её откачивают вдвоём, судно держится. Остановится один — и она поднимется к палубе.', choiceTitle: 'Вывести правду из мрака', choiceDescription: 'Прекратить шептаться за спинами экипажа. Сделать выбор открыто, разделяя ответственность со всеми.', aftermath: 'Секретный курс остался за кормой, но Тифий понял: ты не стал бы держать его в тайне, если бы не доверял. Из цепи это доверие превратилось в якорь.', loyalty: 2, respect: 1, fear: 1 },
  resentful: { label: 'СОЛЁНАЯ НЕНАВИСТЬ', arrival: 'Тифий отвечает односложно и смотрит на горизонт, будто разговаривает с ветром, а не с тобой. Он не забыл, как ты правил его прошлым, — он просто ждёт удобной волны.', hook: 'Обида кормчего опасна вдвойне: он знает каждую отмель на твоём пути. Не примиришься — и самая безопасная вода станет ловушкой.', choiceTitle: 'Признать его право на ненависть', choiceDescription: 'Не пытаться купить дешёвое примирение. Сказать прямо: вы здесь не ради дружбы, а ради выживания.', aftermath: 'Тифий не простил, но твоя прямота оказалась ему по нраву: ложь он ненавидит сильнее, чем правду, какой бы горькой она ни была.', loyalty: 2, respect: 3, fear: -1 },
  forgiven: { label: 'ХРУПКИЙ ШТИЛЬ', arrival: 'Тифий снова зовёт тебя на мостик, когда на горизонте сгущается туча. Для человека, привыкшего всё решать сам, это значит одно: он снова готов разделить курс.', hook: 'Прощение кормчего — как хороший якорь: держит только там, где его однажды бросили. Сменишь стоянку — проверяй дно заново.', choiceTitle: 'Сдержать клятву доверия', choiceDescription: 'Показать делом, что прошлые уроки усвоены. Поставить жизнь экипажа выше своей власти.', aftermath: 'Тифий кивнул, принимая твоё слово, и это был кивок не подчинённого, а равного. Шторм позади, и оба знают: следующий общий курс они пройдут лучше.', loyalty: 4, respect: 2, fear: -2 },
}

export function reactiveSagaContext(companionId: NamedCompanionId, stance: CompanionStoryStance): ReactiveSagaContext {
  const language = companionId === 'eurylochus'
    ? eurylochusStanceLanguage
    : companionId === 'idmon'
      ? idmonStanceLanguage
      : companionId === 'sinon'
        ? sinonStanceLanguage
        : companionId === 'tiphys'
          ? tiphysStanceLanguage
          : stanceLanguage
  return { stance, ...language[stance] }
}

const finaleDefinitions: Record<NamedCompanionId, CompanionFinaleDefinition> = {
  eurylochus: {
    id: 'eurylochus-homecoming', companionId: 'eurylochus', eyebrow: 'Берег в огне', title: 'Суд перед родным порогом', location: 'Врата Итаки · Ночная палуба',
    scene: assetPath('art/finale-eurylochus-homecoming.jpg'),
    description: 'Сквозь рваные тучи пробиваются огни Итаки. Ветер доносит запах родного дыма, но на палубе царит ледяное напряжение. Еврилох стоит у борта, его пальцы вцепились в изъеденное солью дерево. Он не просит клятв — он требует ответа. Когда киль коснётся песка Итаки, кто будет решать, сколько мертвецов они притащат за собой, и какими словами будут оправдывать их смерти?',
    quote: '«Мы везём домой слишком много призраков. Вопрос в том, кто из нас будет смотреть в глаза их вдовам.»',
    choices: [
      { id: 'eurylochus-finale-council', title: 'Разделить с ним власть и вину', description: 'Положить свой жезл рядом с его. Доказать, что Итака встретит двух мужей, а не тирана и его тень.', skill: 'will', difficulty: 7, success: { text: 'Еврилох тяжело выдыхает, словно сбросив невидимую цепь. Два жезла ложатся на палубу. Они не равны в коронах, но отныне равны в ответственности перед своим народом.', effects: { morale: 13 } }, failure: { text: 'Попытка разделить вину оборачивается перебрасыванием упрёков. Вместо единства команда слышит, как два командира судорожно пытаются отмыть руки перед возвращением.', effects: { morale: -8 } } },
      { id: 'eurylochus-finale-burden', title: 'Взять всё бремя крови только на себя', description: 'Сказать Еврилоху, что он свободен от прошлых приказов. Вся тяжесть решений ложится на царские плечи.', skill: 'valor', difficulty: 8, success: { text: 'Одиссей принимает на себя каждый грех этого плавания. Еврилох отступает в тень, впервые чувствуя не унижение, а мрачную благодарность. Он понимает, каково это — быть щитом.', effects: { morale: 8, health: -2 } }, failure: { text: 'Голос Одиссея срывается, слова звучат фальшиво. Еврилох кривится — он видит не благородную жертву, а жалкую попытку узурпировать даже право на покаяние.', effects: { morale: -11 } } },
      { id: 'eurylochus-finale-mask', title: 'Надеть маску монолитного единства', description: 'Скрыть все расколы и сомнения. Убедить Еврилоха сыграть роль идеального соратника перед Итакой.', skill: 'cunning', difficulty: 7, success: { text: 'Еврилох молча кивает. Они сойдут на берег как непобедимые герои. Оба знают, что это ложь, но ради Итаки они готовы нести эту маску до конца своих дней.', effects: { morale: 5 }, coins: 14 }, failure: { text: 'Матросы, слушающие этот сговор, начинают плеваться за борт. Никто не хочет возвращаться домой, неся на плечах фальшивого царя и его купленного пса.', effects: { morale: -13 } } },
    ],
  },
  tiphys: {
    id: 'tiphys-horizon', companionId: 'tiphys', eyebrow: 'Берег, бросающий вызов', title: 'Горизонт, который он выберет', location: 'Врата Итаки · Последняя вахта',
    scene: assetPath('art/finale-tiphys-horizon.jpg'),
    description: 'Скалистые очертания Итаки появляются лишь в провалах между гигантскими волнами. Шторм у врат дома свиреп. Тифий тяжело опирается на штурвал и поворачивается к Одиссею: он может увести корабль в безопасную чужую гавань, но чтобы войти домой, им придётся прорваться сквозь «пасть сирены» — течение, подобное тому, из-за которого он когда-то погубил свою первую эскадру.',
    quote: '«Кормчий не обязан знать каждую каплю моря. Но он обязан сказать, когда выбирает слепую веру вместо холодного расчёта.»',
    choices: [
      { id: 'tiphys-finale-trust', title: 'Доверить ему прямой путь в пасть бури', description: 'Принять риск. Пусть он проведёт корабль тем самым течением, которое когда-то его сломало.', skill: 'seamanship', difficulty: 8, success: { text: 'Тифий ведёт судно по течению, которое когда-то бросило его одного. На этот раз за кормой не остаётся ни одного огня.', effects: { hull: 8, morale: 10 } }, failure: { text: 'Он слишком долго ждёт идеального знака, и волна разбивает руль о знакомый камень.', effects: { hull: -14, morale: -7 } } },
      { id: 'tiphys-finale-share', title: 'Провести Итаку общими замерами', description: 'Не оставлять его один на один с бурей. Пусть каждая вахта кричит глубину и ветер.', skill: 'will', difficulty: 7, success: { text: 'Голоса не спорят, а держат ритм. Тифий входит домой не одиноким мастером, а первым среди людей, умеющих слушать море.', effects: { morale: 14, hull: 3 } }, failure: { text: 'Общий счёт сбивается на последней волне, и Тифий слышит в нём старое недоверие.', effects: { hull: -9, crew: -1 } } },
      { id: 'tiphys-finale-anchor', title: 'Выбрать безопасную чужую бухту', description: 'Подавить гордость. Бросить якорь на чужом берегу и дойти до Итаки пешком.', skill: 'cunning', difficulty: 6, success: { text: 'Тифий выбирает жизнь вместо красивого возвращения. На берег он сходит последним, но впервые не считает это поражением.', effects: { morale: 6 }, coins: 10 }, failure: { text: 'Чужая бухта оказывается закрыта цепью, и осторожность превращается в новую ловушку.', effects: { morale: -12, water: -4 } } },
    ],
  },
  sinon: {
    id: 'sinon-name', companionId: 'sinon', eyebrow: 'Выбор у родного порога', title: 'Имя, которое он оставит', location: 'Врата Итаки · Бортовая тень',
    scene: assetPath('art/finale-sinon-name.jpg'),
    description: 'Сквозь утренний туман вырисовываются скалы Итаки. Синон отзывает Одиссея в тень паруса и молча протягивает ему небольшой пергамент. Там выведено три имени: то, под которым он втирался в доверие троянцам; то, под которым его знали на корабле; и третье — то, кем он хочет стать на этой земле. Одно из них — ложь, но сейчас ложь может оказаться спасительней правды.',
    quote: '«Имя меняют не для того, чтобы спрятать ложь. Его меняют, чтобы выбрать, кому нести её тяжесть.»',
    choices: [
      { id: 'sinon-finale-name', title: 'Дать Синону право назвать себя самому', description: 'Не диктовать ему роль. Пусть он сам выберет, кем сойдёт на берег Итаки, не прячась за авторитет царя.', skill: 'will', difficulty: 8, success: { text: 'Синон называет имя без оправдания. Оно не очищает прошлого, но впервые принадлежит человеку, который готов нести его дальше.', effects: { morale: 10 } }, failure: { text: 'Последнее признание превращается в привычную игру слов, и Синон сам слышит, как теряет собственный голос.', effects: { morale: -10 } } },
      { id: 'sinon-finale-truth', title: 'Вписать его правдивую историю в летопись', description: 'Сохранить для Итаки суровую правду. Никаких прикрас: он был орудием убийства и гением обмана.', skill: 'cunning', difficulty: 7, success: { text: 'Одиссей не делает из Синона ни чудовище, ни героя. Свиток остаётся неудобной правдой, которую нельзя выгодно пересказать.', effects: { morale: 8 }, coins: 12 }, failure: { text: 'Слова оказываются слишком точными для милосердия и слишком удобными для новой легенды.', effects: { morale: -11 } } },
      { id: 'sinon-finale-silence', title: 'Сжечь пергамент со всеми тремя именами', description: 'Освободить его от прошлого. Пусть он ступит на берег без имени и без теней сгоревшего города.', skill: 'valor', difficulty: 7, success: { text: 'Пепел уходит в море. Синон не свободен от памяти, но впервые не обязан превращать её в роль для чужой публики.', effects: { morale: 6, health: -2 } }, failure: { text: 'Ветер несёт обрывки к берегу, и люди Итаки получают только худшие куски истории.', effects: { morale: -13 } } },
    ],
  },
  idmon: {
    id: 'idmon-silence', companionId: 'idmon', eyebrow: 'На пороге рока', title: 'Право на слепоту', location: 'Врата Итаки · Чёрная вода',
    scene: assetPath('art/finale-idmon-silence.jpg'),
    description: 'Сквозь туман уже проступают знакомые очертания скал Итаки. У Идмона в руках ритуальная чаша. По её тёмной поверхности бежит рябь последнего великого видения: он видит дом, который встретит Одиссея как владыку, и дом, который отвергнет его, захлебнувшись в крови. Пророк дрожит. Он готов назвать ту судьбу, что ближе, но впервые смотрит на царя не как слуга. Он просит дозволения не изрекать пророчество.',
    quote: '«Я был твоим компасом в аду. Но сейчас, перед домом, позволь мне просто быть слепым путником.»',
    choices: [
      { id: 'idmon-finale-silence', title: 'Даровать ему абсолютную тишину', description: 'Отказаться от спасительного знания. Принять Итаку такой, какая она есть, не требуя от пророка гарантий.', skill: 'will', difficulty: 7, success: { text: 'Идмон с криком, в котором смешались слёзы и смех, швыряет чашу за борт. Оковы рухнули. Впервые он шагает в будущее вместе со всеми.', effects: { morale: 12 } }, failure: { text: 'Чаша падает, но видение вспыхивает в его мозгу яркой вспышкой боли. Он всё равно узнаёт финал, но благодарит вас за попытку дать ему выбор.', effects: { morale: -6 } } },
      { id: 'idmon-finale-share', title: 'Разбить видение на всех', description: 'Пусть вся команда заглянет в чашу. Освободить Идмона от ноши единственного толкователя.', skill: 'cunning', difficulty: 8, success: { text: 'Люди видят разные версии дома и перестают требовать от Идмона единственно верного ответа.', effects: { morale: 9, health: -2 }, coins: 9 }, failure: { text: 'Каждый цепляется за увиденную версию, и корабль входит к берегу с четырьмя разными будущими.', effects: { morale: -12 } } },
      { id: 'idmon-finale-ask', title: 'Вырвать ответ железной хваткой', description: 'Риск слишком велик. Заставить Идмона вглядеться в чашу и назвать точный путь к победе.', skill: 'valor', difficulty: 7, success: { text: 'Идмон называет путь, но перед этим просит запомнить: он сделал это по приказу, а не по собственному желанию.', effects: { hull: 6, morale: 4 } }, failure: { text: 'Пророчество даёт две противоречивые даты, и царь получает знание, которое не умеет применить.', effects: { morale: -14, health: -4 } } },
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
  const context = reactiveSagaContext(companionId, priorStance)
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
