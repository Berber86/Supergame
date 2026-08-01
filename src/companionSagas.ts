import type { CompanionStoryStance, NamedCompanionId } from './types'

export interface CompanionSagaChapter {
  id: string
  encounterId?: string
  chapter: number
  title: string
  hint: string
  status: 'playable' | 'future'
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

export const companionSagas: CompanionSaga[] = [
  {
    companionId: 'eurylochus',
    title: 'Цена власти',
    premise: 'Еврилох помнит каждого человека, которого приказ оставил за кормой. Он не просит корону — он проверяет, способен ли царь не держать её мёртвой хваткой.',
    chapters: [
      { id: 'eurylochus-broken-oar', encounterId: 'eurylochus-broken-oar', chapter: 1, title: 'Весло, которое не отдали', hint: 'На берегу ждёт семья гребца, оставленного прежним приказом.', status: 'playable' },
      { id: 'eurylochus-council', encounterId: 'eurylochus-council', chapter: 2, title: 'Каменный совет', hint: 'Право возражать царю нужно заслужить не словами.', status: 'playable' },
      { id: 'eurylochus-crownless', encounterId: 'eurylochus-crownless', chapter: 3, title: 'Корона без головы', hint: 'Старый знак командования требует нового владельца.', status: 'playable' },
      { id: 'eurylochus-homecoming', chapter: 4, title: 'Чей приказ слышит Итака', hint: 'Последняя песнь прозвучит только у дома.', status: 'future' },
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
      { id: 'tiphys-horizon', chapter: 4, title: 'Горизонт, который он выберет', hint: 'Последний курс нельзя подсмотреть на чужой карте.', status: 'future' },
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
      { id: 'sinon-name', chapter: 4, title: 'Имя, которое он оставит', hint: 'Итака узнает, кем был человек, вошедший на корабль под чужой историей.', status: 'future' },
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
      { id: 'idmon-silence', chapter: 4, title: 'Право на молчание', hint: 'Последнее видение принадлежит не богам, а самому Идмону.', status: 'future' },
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
