/**
 * events.js — случайные события (черновик данных, ≥8 для MLP).
 *
 * contexts:  dig — при обыске бака | travel — в переходе | street — просто на улице |
 *            night — ночью (если ночлег: лавка) | rumor — «слух» (положительное)
 * weight:    относительная частота внутри контекста
 * choices:   варианты реакции; effects — ДЕКЛАРАТИВНЫЙ словарь для js/core
 *            (интерпретация ключей — сессия 8; ключи ниже — договорённость API)
 *
 * СЛОВАРЬ ЭФФЕКТОВ (договорённость с будущей логикой):
 *  money: ±₽ | satiety/warmth/health/energy/cleanliness: ±N |
 *  loseRandomItem: true | loseCategoryItem: category | addItem: itemId |
 *  timeHours: ±N | riskHealth: { chance, amount } | flag: 'строка-флаг' |
 *  boostTomorrow: { district: id|'random' } — подсказка, где завтра жирно
 */

export const EVENTS = [
  {
    id: 'patrul',
    emoji: '👮',
    title: 'Патруль',
    text: 'Наряд полиции интересуется, не промышляете ли вы здесь сбором. Правильный ответ им нужен сейчас.',
    contexts: ['dig', 'street'],
    weight: 3,
    choices: [
      { id: 'otdat',  text: 'Пожертвовать находку «для протокола»', effects: { loseRandomItem: true, flag: 'police_respect' } },
      { id: 'shtraf', text: 'Заплатить штраф 100 ₽',                 effects: { money: -100 } },
      { id: 'bezhat', text: 'Сделать вид, что ты мимо шёл',          effects: { energy: -10, riskHealth: { chance: 0.3, amount: -10 }, timeHours: -1 } },
    ],
  },
  {
    id: 'sobaka',
    emoji: '🐕',
    title: 'Дворовый пёс',
    text: 'Пёс из-под будки смотрит так, будто бак — его личный фонд занятости.',
    contexts: ['dig'],
    weight: 3,
    choices: [
      { id: 'tiho',  text: 'Отступить по-английски',        effects: { timeHours: -1, cleanliness: 0 } },
      { id: 'korm',  text: 'Поделиться едой (если есть)',   effects: { loseCategoryItem: 'eda', flag: 'dog_friend' } },
      { id: 'risk',  text: 'Рыться дальше под лай',         effects: { riskHealth: { chance: 0.4, amount: -15 } } },
    ],
  },
  {
    id: 'babushka',
    emoji: '🧓',
    title: 'Бабушка с термосом',
    text: '«Смотри какой худой». Бабушка наливает суп и рассказывает про 52-й год. Суп — объеденье.',
    contexts: ['street', 'travel'],
    weight: 2,
    choices: [
      { id: 'sup',    text: 'Принять суп и выслушать', effects: { satiety: +20, warmth: +10, timeHours: -1, flag: 'grandma_smile' } },
      { id: 'otkaz',  text: 'Вежливо отказаться',       effects: { cleanliness: +5 } },
    ],
  },
  {
    id: 'konkurent',
    emoji: '🥷',
    title: 'Коллега по цеху',
    text: 'Другой бродяга косится на твой бак с экспертизой профессионала. Территория делится, но неохотно.',
    contexts: ['dig'],
    weight: 2,
    choices: [
      { id: 'delit',  text: 'Поделить бак пополам',       effects: { flag: 'rival_friend', timeHours: -1 } },
      { id: 'gnat',   text: 'Погнать (сила решает)',      effects: { riskHealth: { chance: 0.35, amount: -12 }, flag: 'rival_enemy' } },
      { id: 'ustupit',text: 'Уступить и отвалить',        effects: { timeHours: -1 } },
    ],
  },
  {
    id: 'liven',
    emoji: '🌊',
    title: 'Внезапный ливень',
    text: 'Небо открыло Неву наоборот. Захлёбывается весь район вместе с тобой.',
    contexts: ['street', 'travel'],
    weight: 2,
    choices: [
      { id: 'ukrytie', text: 'Ждать под аркой',          effects: { timeHours: -2 } },
      { id: 'prov',    text: 'Мокнуть, но идти дальше',   effects: { warmth: -20, cleanliness: -10 } },
    ],
  },
  {
    id: 'mchs',
    emoji: '📢',
    title: 'Предупреждение МЧС',
    text: 'Громкоговоритель у метро обещает на завтра −15° и «соблюдать осторожность». Спасибо, МЧС, мы в курсе жизни.',
    contexts: ['street'],
    weight: 1,
    choices: [
      { id: 'ponyal', text: 'Принять к сведению (завтра мороз — готовься)', effects: { flag: 'frost_tomorrow_hint' } },
    ],
  },
  {
    id: 'kopeyka',
    emoji: '🍀',
    title: 'Счастливая копейка',
    text: 'У бака блестит монетка. Не сметана — копейка. Но настроение + и счёт на «везёт».',
    contexts: ['dig', 'street'],
    weight: 2,
    choices: [
      { id: 'vzyat', text: 'Поднять (а вдруг это к богатству)', effects: { money: +1, flag: 'lucky_coin' } },
    ],
  },
  {
    id: 'feldsher',
    emoji: '🏥',
    title: 'Фельдшер из приюта',
    text: 'Медик из соцпатруля осматривает руки и молча достаёт бинты. Профессионализм без осуждения.',
    contexts: ['street'],
    weight: 1,
    choices: [
      { id: 'osmotr', text: 'Дать себя осмотреть', effects: { health: +15, timeHours: -1 } },
    ],
  },
  {
    id: 'sluh',
    emoji: '🗺️',
    title: 'Слух на ночлежке',
    text: 'Кто-то шепчется: в одном районе «выкинули целую квартиру». По шёпоту — там завтра жирно.',
    contexts: ['night', 'street'],
    weight: 2,
    choices: [
      { id: 'zapomnit', text: 'Запомнить направление', effects: { boostTomorrow: { district: 'random' }, flag: 'heard_rumor' } },
    ],
  },
  {
    id: 'kontrolery',
    emoji: '🚇',
    title: 'Контролёры в подземке',
    text: 'В метро тепло, но контролёры считают ни тепло, ни тебя в число пассажиров.',
    contexts: ['travel', 'night'],
    weight: 1,
    choices: [
      { id: 'ottolknut', text: 'Отбыть обратно на мороз', effects: { warmth: -10, timeHours: -1 } },
      { id: 'shtrafm',   text: 'Откупиться 150 ₽ за «безбилетный отдых»', effects: { money: -150, warmth: +15 } },
    ],
  },
];
