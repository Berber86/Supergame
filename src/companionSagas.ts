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
    arrival: 'Еврилох шагает рядом с царём, а не позади него. После недавних испытаний он не тратит время на колкости — он сразу говорит о том, что грызёт его изнутри, веря, что Одиссей не отмахнётся.',
    hook: 'Доверие — хрупкий клинок. Одно неосторожное движение власти, и он сломается навсегда.',
    choiceTitle: 'Взвалить груз на двоих',
    choiceDescription: 'Не укрываться за царским щитом. Дать Еврилоху право ударить словом, чтобы выстоять вместе.',
    aftermath: 'Связь между ними стала крепче, потому что была проверена огнём, а не слащавыми клятвами.',
    loyalty: 3, respect: 2, fear: -2,
  },
  controlled: {
    label: 'ХОЛОДНЫЙ КОНТРОЛЬ',
    arrival: 'Еврилох действует с точностью механизма. Каждое «да, мой царь» звучит как удар молота по наковальне. Он сдался приказам, но душа его закована в лёд.',
    hook: 'Он ждёт, когда Одиссей оступится. Любая слабость будет воспринята не как человечность, а как ошибка командира.',
    choiceTitle: 'Разомкнуть железную хватку',
    choiceDescription: 'Рискнуть потерей абсолютного контроля, чтобы показать: на этом корабле ещё остались живые люди.',
    aftermath: 'Лёд треснул. Еврилох увидел, что царь способен разжать пальцы, не теряя при этом короны.',
    loyalty: 1, respect: 3, fear: -1,
  },
  complicit: {
    label: 'СВЯЗАННЫЕ ГРЕХОМ',
    arrival: 'Они смотрят друг на друга, и каждый видит в глазах другого их общую грязную тайну. Это союз, скреплённый не верностью, а страхом разоблачения перед командой.',
    hook: 'Общая тайна превратила их в заговорщиков, но любой неверный шаг на этом совете может стать детонатором.',
    choiceTitle: 'Выставить счёт за молчание',
    choiceDescription: 'Отказаться от привычного обмана. Бросить вызов Еврилоху: пусть сам решит, что из их тьмы увидит свет.',
    aftermath: 'Кровь на их руках не исчезла, но они больше не пытаются спрятать её друг от друга.',
    loyalty: 2, respect: 1, fear: 1,
  },
  resentful: {
    label: 'ТЛЕЮЩАЯ ОБИДА',
    arrival: 'Еврилох смотрит куда угодно, только не на Одиссея. Его движения резки, слова процежены сквозь зубы. Прошлая обида гниёт в нём, отравляя воздух вокруг.',
    hook: 'Здесь нет места примирению. Главное — не бросить факел в пороховую бочку его ненависти.',
    choiceTitle: 'Принять его ненависть как право',
    choiceDescription: 'Не требовать фальшивых улыбок. Позволить ему ненавидеть решения царя, пока он выполняет их.',
    aftermath: 'Обида никуда не ушла, но Еврилох, по крайней мере, увидел, что его ярость не игнорируют.',
    loyalty: 2, respect: 3, fear: -1,
  },
  forgiven: {
    label: 'ПЕПЕЛ ПРОЩЕНИЯ',
    arrival: 'Еврилох больше не бросается на ножи из-за старых ран, но шрамы ноют к плохой погоде. Это не мир — это вооружённое перемирие ради выживания.',
    hook: 'Каждое слово сейчас — это проверка: стоило ли прощать Одиссея в прошлый раз?',
    choiceTitle: 'Доказать право на это прощение',
    choiceDescription: 'Действовать так, чтобы Еврилох не пожалел о том дне, когда решил опустить меч.',
    aftermath: 'Перемирие выдержало шторм. Оно перестало быть просто отсрочкой новой войны.',
    loyalty: 4, respect: 2, fear: -2,
  },
}

const idmonStanceLanguage: Record<CompanionStoryStance, Omit<ReactiveSagaContext, 'stance'>> = {
  trusted: {
    label: 'ГОРЬКОЕ ДОВЕРИЕ',
    arrival: 'Идмон идёт рядом с царём, а не прячется за спинами матросов. Он не ждёт, пока из него вытянут пророчество клещами. Он делится своим страхом прямо, зная, что Одиссей услышит в нём человека, а не оракула.',
    hook: 'Это доверие выковано из боли. Если сейчас Одиссей использует его уязвимость как оружие, пророк сломается навсегда.',
    choiceTitle: 'Взвалить тяжесть рока на двоих',
    choiceDescription: 'Не укрываться за царской властью. Позволить Идмону решить, стоит ли эта жертва их общей цели.',
    aftermath: 'Выдержав этот удар вместе, они доказали, что их связь крепче любой нити мойр.',
    loyalty: 3, respect: 2, fear: -2,
  },
  controlled: {
    label: 'ПУСТОТА ПОВИНОВЕНИЯ',
    arrival: 'Движения Идмона скупы, лицо похоже на посмертную маску. Он — идеальный инструмент. Он шагает к алтарю так, будто его уже ведут на плаху, ожидая от царя лишь короткого кивка.',
    hook: 'Его воля подавлена. Если приказать ему сейчас, он выполнит всё, но внутри него окончательно умрёт живое.',
    choiceTitle: 'Разорвать нити кукловода',
    choiceDescription: 'Остановить механизм приказов. Заставить его вспомнить, что у него всё ещё есть право выбора.',
    aftermath: 'Ледяная броня дала трещину. Идмон с удивлением понял, что царь не всегда хочет быть его хозяином.',
    loyalty: 1, respect: 3, fear: -1,
  },
  complicit: {
    label: 'СВЯЗАННЫЕ ТАЙНОЙ',
    arrival: 'Они обмениваются короткими, знающими взглядами. Между ними уже есть ложь, скормленная команде, и Идмон готов сплести новую, если Одиссей даст знак.',
    hook: 'Их тайны связывают их, как цепь каторжников. Одно неверное решение здесь, и эта цепь утянет обоих на дно.',
    choiceTitle: 'Вытащить правду на свет',
    choiceDescription: 'Отказаться от привычного обмана. Дать команде увидеть истинную цену, которую платит пророк.',
    aftermath: 'Тьма между ними рассеялась. Они перестали быть заговорщиками и попытались стать соратниками.',
    loyalty: 2, respect: 1, fear: 1,
  },
  resentful: {
    label: 'ТЛЕЮЩАЯ НЕНАВИСТЬ',
    arrival: 'Каждое слово Идмона пропитано ядом. Он смотрит на алтарь, а затем на Одиссея с жестокой усмешкой, словно желая, чтобы судьба ударила царя побольнее.',
    hook: 'Он ждёт предательства и готов к нему. Попытка сыграть в благородство вызовет лишь презрение.',
    choiceTitle: 'Принять его ненависть как щит',
    choiceDescription: 'Не пытаться купить прощение. Позволить ему ненавидеть решения царя, но выжить благодаря им.',
    aftermath: 'Ненависть не исчезла, но она обрела холодное уважение. Одиссей доказал, что его прагматизм честнее лживой жалости.',
    loyalty: 2, respect: 3, fear: -1,
  },
  forgiven: {
    label: 'ШРАМЫ ПЕРЕМИРИЯ',
    arrival: 'Старые обиды не забыты, но загнаны глубоко. Идмон даёт царю шанс не повторять ошибок прошлого. Его взгляд полон хрупкой, почти отчаянной надежды.',
    hook: 'Прощение — не индульгенция. Если Одиссей снова оступится, этот шрам разорвётся, залив кровью весь корабль.',
    choiceTitle: 'Оправдать подаренный шанс',
    choiceDescription: 'Сделать выбор, который докажет: прошлые жертвы чему-то научили владыку Итаки.',
    aftermath: 'Тонкий лёд перемирия выдержал. Идмон убедился, что его прощение не было ошибкой слабого.',
    loyalty: 4, respect: 2, fear: -2,
  },
}

const sinonStanceLanguage: Record<CompanionStoryStance, Omit<ReactiveSagaContext, 'stance'>> = {
  trusted: { label: 'ГОРЬКОЕ ДОВЕРИЕ', arrival: 'Синон стоит рядом с вами, опустив вечные щиты сарказма. Между вами больше нет дешёвых уловок — он доверяет царю свою разорванную душу, веря, что Одиссей видит в нём человека.', hook: 'Это доверие висит на волоске. Если вы сейчас отнесётесь к нему как к инструменту, он больше никогда не откроет лицо.', choiceTitle: 'Встать с ним плечом к плечу', choiceDescription: 'Не укрываться за царским авторитетом. Позволить Синону самому выбрать свою судьбу в этом испытании.', aftermath: 'Доверие прошло закалку огнём. Синон понял, что вы готовы рисковать вместе с ним, а не просто использовать его.', loyalty: 3, respect: 2, fear: -2 },
  controlled: { label: 'СЛОМЛЕННЫЙ ИНСТРУМЕНТ', arrival: 'Синон шагает механически, как выдрессированный пёс. Вы выбили из него человечность, превратив в идеального лжеца, ждущего лишь команды «фас».', hook: 'Он подавлен. Но любая машина ломается, если слишком сильно натянуть пружину. Сможете ли вы ослабить хватку?', choiceTitle: 'Разорвать поводок', choiceDescription: 'Остановить поток приказов. Дать Синону свободу решить, что делать со своей виной.', aftermath: 'Контроль дал трещину. Синон с удивлением осознал, что в глазах царя он ещё может быть живым человеком.', loyalty: 1, respect: 3, fear: -1 },
  complicit: { label: 'АРХИТЕКТОРЫ ЛЖИ', arrival: 'Вы обмениваетесь короткими взглядами. Вы оба по локоть в грязи общих секретов от команды. Эта круговая порука делает вас сообщниками, а не соратниками.', hook: 'Тайны тянут на дно. Очередная общая ложь может стать камнем, который утопит вас обоих.', choiceTitle: 'Вывести правду на свет', choiceDescription: 'Отказаться от привычной игры в напёрстки. Заставить Синона посмотреть в глаза своим демонам.', aftermath: 'Мрак между вами рассеялся. Вы больше не заговорщики, прячущиеся по углам, а люди, готовые нести ответ.', loyalty: 2, respect: 1, fear: 1 },
  resentful: { label: 'ЛЕДЯНАЯ НЕНАВИСТЬ', arrival: 'Каждое движение Синона пропитано желчью. Он ожидает от вас удара в спину и готов ударить в ответ. Ваша связь отравлена старыми предательствами.', hook: 'Попытки изобразить сострадание вызовут лишь ядовитый смех. Здесь работает только суровый прагматизм.', choiceTitle: 'Признать его право на гнев', choiceDescription: 'Не требовать фальшивой верности и не играть в милосердие. Принять его ненависть как факт.', aftermath: 'Обида не испарилась, но Синон оценил вашу честность. Вы доказали, что хотя бы не притворяетесь святым.', loyalty: 2, respect: 3, fear: -1 },
  forgiven: { label: 'ХРУПКИЙ МИР', arrival: 'Старые счёты оплачены, но шрамы ещё болят к плохой погоде. Синон дал вам шанс, но его глаза цепко следят за каждым вашим жестом, ожидая подвоха.', hook: 'Прощение — не рабский ошейник. Если вы вновь используете его как пешку, этот мир рухнет с оглушительным грохотом.', choiceTitle: 'Оправдать дарованное прощение', choiceDescription: 'Доказать делами, что вы извлекли урок из прошлых ошибок и готовы защищать его право на искренность.', aftermath: 'Перемирие выдержало шторм. Синон убедился, что не ошибся, позволив себе вновь вам поверить.', loyalty: 4, respect: 2, fear: -2 },
}

export function reactiveSagaContext(companionId: NamedCompanionId, stance: CompanionStoryStance): ReactiveSagaContext {
  const language = companionId === 'eurylochus'
    ? eurylochusStanceLanguage
    : companionId === 'idmon'
      ? idmonStanceLanguage
      : companionId === 'sinon'
        ? sinonStanceLanguage
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
