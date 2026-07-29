/**
 * items.js — каталог предметов (черновик данных, логики нет).
 *
 * СХЕМА ПРЕДМЕТА:
 *  id            уникальный строковый id (snake_case)
 *  name          как видит игрок
 *  emoji         один эмодзи-«спрайт»
 *  category      категория для покупателей (см. buyers.js):
 *                steklotara | metall | bumaga | eda | odezhda | obuv |
 *                byt | instrument | tehnika | antikvariat | raznoe
 *  kind          obvious — цена известна сразу;
 *                food — съедобное (поле satiety, иногда риск);
 *                unidentified — ценность скрыта (поле guess)
 *  desc          короткое описание с трагикомедийным привкусом
 *
 * ДЛЯ obvious:        value (₽, это и есть цена пункта приёма), weight (кг)
 * ДЛЯ food:           satiety (+N), опционально healthRisk (0..1), value (₽ если сдать)
 * ДЛЯ unidentified:   guess = { expertCategory, tiers: [{ chance, min, max, label }] }
 *                     chance по тирам в сумме = 1; цена бросается внутри тира (сессия 5)
 */

export const ITEMS = [
  // ===================== ОЧЕВИДНОЕ СЫРЬЁ (пункт приёма) =====================
  { id: 'butylka_steklo', name: 'Стеклянная бутылка', emoji: '🍾', category: 'steklotara', kind: 'obvious', value: 5, weight: 0.5,
    desc: 'Из-под лимонада «Буратино». У элитки — из-под «Перье», цена та же, мир несправедлив.' },
  { id: 'banka_alyuminiy', name: 'Алюминиевая банка', emoji: '🥫', category: 'steklotara', kind: 'obvious', value: 3, weight: 0.2,
    desc: 'Смята об асфальт, но пункт приёма не смотрит на дизайн.' },
  { id: 'pet_butilka', name: 'ПЭТ-бутылка', emoji: '🧴', category: 'steklotara', kind: 'obvious', value: 2, weight: 0.1,
    desc: 'Пластик. Вечен, как обещания коммунальщиков.' },
  { id: 'makulatura', name: 'Пачка макулатуры', emoji: '📰', category: 'bumaga', kind: 'obvious', value: 8, weight: 2,
    desc: 'Вчерашние новости. Кому-то вчера, кому-то двадцатилетней давности.' },
  { id: 'karton_tyuk', name: 'Тюк картона', emoji: '📦', category: 'bumaga', kind: 'obvious', value: 6, weight: 1.5,
    desc: 'Чья-то посылка из маркетплейса стала твоим капиталом.' },
  { id: 'metall_lom', name: 'Лом чёрных металлов', emoji: '🔩', category: 'metall', kind: 'obvious', value: 25, weight: 3,
    desc: 'Тяжёлый, ржавый, честный. Как и ты.' },
  { id: 'med_provod', name: 'Моток медного провода', emoji: '🧵', category: 'metall', kind: 'obvious', value: 180, weight: 1,
    desc: 'Медь — золото помойки. Главное — не объяснять происхождение лишним людям.' },
  { id: 'latun_kran', name: 'Латунный кран', emoji: '🚰', category: 'metall', kind: 'obvious', value: 120, weight: 0.8,
    desc: 'Кто-то делал евроремонт. Кто-то ТЕПЕРЬ делает евроремонт.' },

  // ===================== ЕДА (находки, съедобное) =====================
  { id: 'baton_zasohshiy', name: 'Засохший батон', emoji: '🥖', category: 'eda', kind: 'food', satiety: 15, value: 2, weight: 0.3,
    desc: 'Засох, но не сдался. Как и ты.' },
  { id: 'yabloko_pomyatoe', name: 'Помятое яблоко', emoji: '🍎', category: 'eda', kind: 'food', satiety: 10, value: 1, weight: 0.2,
    desc: 'Ударился об дно сумки с фермерским изюмом.' },
  { id: 'tushenka_bez_etiketki', name: 'Тушёнка без этикетки', emoji: '🍖', category: 'eda', kind: 'food', satiety: 30, healthRisk: 0.15, value: 10, weight: 0.4,
    desc: 'Свиду говядина. По вкусу — лотерея. Срок годности познал только изготовитель.' },
  { id: 'shawerma_nedoedennaya', name: 'Недоеденная шаверма', emoji: '🌯', category: 'eda', kind: 'food', satiety: 25, healthRisk: 0.2, value: 5, weight: 0.3,
    desc: 'Чужой отравы не бывает. Бывает чужой иммунитет.' },

  // ===================== ОДЕЖДА / ОБУВЬ (барахолка, ломбард) =====================
  { id: 'shapka_zasalennaya', name: 'Засаленная шапка', emoji: '🧢', category: 'odezhda', kind: 'obvious', value: 25, weight: 0.2,
    desc: 'Хранила чью-то голову и чужие секреты. Секреты выветрились.' },
  { id: 'sviter_vyazanyy', name: 'Вязаный свитер', emoji: '🐑', category: 'odezhda', kind: 'obvious', value: 70, weight: 0.5,
    desc: 'Бабушкина работа. Не твоя бабушка, но всё равно тепло.' },
  { id: 'kurtka_rybaka', name: 'Куртка рыбака', emoji: '🧥', category: 'odezhda', kind: 'obvious', value: 150, weight: 1.2,
    desc: 'Аляска со следами судака и жизни. Греет лучше, чем выглядит.' },
  { id: 'perchatki_rabochie', name: 'Рабочие перчатки', emoji: '🧤', category: 'odezhda', kind: 'obvious', value: 60, weight: 0.2,
    desc: 'Спиленные пупырышки видали и не такое. Обязательны для серьёзных отношений с баками.' },
  { id: 'botinki_kirzovye', name: 'Кирзовые ботинки', emoji: '🥾', category: 'obuv', kind: 'obvious', value: 90, weight: 1.5,
    desc: 'Пара. Разный размер, но оба левые — надёжный знак честной находки.' },

  // ===================== БЫТОВУХА / ИНСТРУМЕНТЫ =====================
  { id: 'chashka_s_treshchinoy', name: 'Чашка с трещиной', emoji: '☕', category: 'byt', kind: 'obvious', value: 10, weight: 0.3,
    desc: 'Трещина — это ведь тоже узор.' },
  { id: 'utyug_sssr', name: 'Утюг советский', emoji: '♨️', category: 'byt', kind: 'obvious', value: 80, weight: 2.5,
    desc: 'Весит как приговор, гладит как мама. Спрос на Севере стабилен.' },
  { id: 'chainik_electro', name: 'Электрочайник', emoji: '🔌', category: 'byt', kind: 'obvious', value: 70, weight: 1,
    desc: 'Кипятит. Не спрашивай, что. Ржавчина придаёт насыщенность.' },
  { id: 'kniga_tihiy_don', name: '«Тихий Дон», том 2', emoji: '📕', category: 'byt', kind: 'obvious', value: 30, weight: 0.6,
    desc: 'Без первого, третьего и четвёртого. Классика в сокращении читается бодрее.' },
  { id: 'radiola_vega', name: 'Радиола «Вега»', emoji: '📻', category: 'tehnika', kind: 'obvious', value: 200, weight: 4,
    desc: 'Играет только настроение. Настроение — 1984 год.' },
  { id: 'molotok_slesarnyy', name: 'Молоток слесарный', emoji: '🔨', category: 'instrument', kind: 'obvious', value: 70, weight: 0.8,
    desc: 'Универсальный ключ к мирному сосуществованию с баками.' },
  { id: 'otvertka_staloy', name: 'Отвёртка с отбитой ручкой', emoji: '🪛', category: 'instrument', kind: 'obvious', value: 20, weight: 0.2,
    desc: 'Ручка отбита в честном труде. Не твоём, но честном.' },
  { id: 'moneta_yubileynaya', name: 'Юбилейная монета', emoji: '🪙', category: 'antikvariat', kind: 'obvious', value: 100, weight: 0.01,
    desc: '«10 лет чего-то там». Для пункта приёма — металл, для коллекционера — находка.' },

  // ===================== НЕОПОЗНАННОЕ (ядро механики) =====================
  // tiers: шансы в сумме = 1.00; цена бросается случайно внутри тира.
  { id: 'u_korobka_berzhnaya', name: 'Бережно упакованная коробка', emoji: '📦', category: 'raznoe', kind: 'unidentified',
    guess: { expertCategory: 'antikvariat', tiers: [
      { chance: 0.5, min: 0,    max: 60,   label: 'хлам' },
      { chance: 0.3, min: 150,  max: 600,  label: 'обычное' },
      { chance: 0.17,min: 800,  max: 2000, label: 'ценное' },
      { chance: 0.03,min: 2500, max: 4500, label: 'редкое' },
    ] },
    desc: 'Обёрнута в плёнку и чужие надежды. Кто-то очень просил «не выбрасывать». Кто-то выбросил.' },
  { id: 'u_telefon_diskovyy', name: 'Странный телефонный аппарат', emoji: '☎️', category: 'raznoe', kind: 'unidentified',
    guess: { expertCategory: 'antikvariat', tiers: [
      { chance: 0.35, min: 50,   max: 200,  label: 'обычное' },
      { chance: 0.45, min: 400,  max: 1200, label: 'ценное' },
      { chance: 0.2,  min: 1500, max: 3000, label: 'редкое' },
    ] },
    desc: 'Чёрный, тяжёлый, с диском. Диск можно крутить лично — медитативно.' },
  { id: 'u_kartina_ramka', name: 'Потемневшая картина в раме', emoji: '🖼️', category: 'raznoe', kind: 'unidentified',
    guess: { expertCategory: 'antikvariat', tiers: [
      { chance: 0.55, min: 20,   max: 150,  label: 'хлам' },
      { chance: 0.3,  min: 300,  max: 900,  label: 'обычное' },
      { chance: 0.12, min: 1200, max: 2500, label: 'ценное' },
      { chance: 0.03, min: 3000, max: 6000, label: 'ДжЕКПОТ' },
    ] },
    desc: 'Масло, мрак, возможно — Нева. Возможно — просто мрак. Подпись не читается, как и судьба.' },
  { id: 'u_lupa_latunnaya', name: 'Лупа в латунной оправе', emoji: '🔎', category: 'raznoe', kind: 'unidentified',
    guess: { expertCategory: 'antikvariat', tiers: [
      { chance: 0.5, min: 40,   max: 150, label: 'обычное' },
      { chance: 0.4, min: 200,  max: 500, label: 'ценное' },
      { chance: 0.1, min: 700,  max: 1200,label: 'редкое' },
    ] },
    desc: 'Увеличивает втрое. Рассмотрела уже три поколения находок.' },
  { id: 'u_videokasseta', name: 'Видеокассета без надписи', emoji: '📼', category: 'raznoe', kind: 'unidentified',
    guess: { expertCategory: 'tehnika', tiers: [
      { chance: 0.7, min: 0,  max: 20,  label: 'хлам' },
      { chance: 0.3, min: 40, max: 150, label: 'обычное' },
    ] },
    desc: 'Без надписи. Самое страшное сочетание слов в архивном деле.' },
  { id: 'u_matreshka_praga', name: 'Матрёшка с надписью «Прага»', emoji: '🪆', category: 'raznoe', kind: 'unidentified',
    guess: { expertCategory: 'antikvariat', tiers: [
      { chance: 0.5, min: 30,  max: 100, label: 'обычное' },
      { chance: 0.4, min: 150, max: 350, label: 'ценное' },
      { chance: 0.1, min: 500, max: 900, label: 'редкое' },
    ] },
    desc: 'Надпись «Прага», сделано в Китае, куплено в Питере. География таланта.' },
  { id: 'u_chasy_tresnutye', name: 'Часы с треснувшим стеклом', emoji: '⌚', category: 'raznoe', kind: 'unidentified',
    guess: { expertCategory: 'tehnika', tiers: [
      { chance: 0.55, min: 10,   max: 60,   label: 'хлам' },
      { chance: 0.3,  min: 150,  max: 500,  label: 'обычное' },
      { chance: 0.12, min: 700,  max: 1500, label: 'ценное' },
      { chance: 0.03, min: 2000, max: 4000, label: 'редкое' },
    ] },
    desc: 'Не идут. Но два раза в сутки показывают точное время — уже больше, чем ты.' },
  { id: 'u_skripka_futlyar', name: 'Скрипка в потрёпанном футляре', emoji: '🎻', category: 'raznoe', kind: 'unidentified',
    guess: { expertCategory: 'antikvariat', tiers: [
      { chance: 0.5, min: 100,  max: 400,  label: 'обычное' },
      { chance: 0.35,min: 600,  max: 1500, label: 'ценное' },
      { chance: 0.14,min: 1800, max: 3000, label: 'редкое' },
      { chance: 0.01,min: 3500, max: 5000, label: 'ДжЕКПОТ' },
    ] },
    desc: 'Футляр видал лучшие дни. Скрипка — тоже. Она молчит и ждёт того, кто оценит.' },
  { id: 'u_diskety_vyazanka', name: 'Вязанка дискет', emoji: '💾', category: 'raznoe', kind: 'unidentified',
    guess: { expertCategory: 'tehnika', tiers: [
      { chance: 0.85, min: 0,  max: 15, label: 'хлам' },
      { chance: 0.15, min: 30, max: 80, label: 'обычное' },
    ] },
    desc: 'Сорок мегабайт чьих-то надежд. Секретный архив, который не откроет уже никто.' },
  { id: 'u_busu_zelenye', name: 'Бусы с зелёными камнями', emoji: '📿', category: 'raznoe', kind: 'unidentified',
    guess: { expertCategory: 'antikvariat', tiers: [
      { chance: 0.6, min: 10,   max: 60,   label: 'хлам (стекло)' },
      { chance: 0.3, min: 150,  max: 500,  label: 'обычное' },
      { chance: 0.1, min: 700,  max: 1500, label: 'ценное' },
    ] },
    desc: 'Бирюза? Яшма? Пластик из Фаберже своего двора? Третий закон барахолки: не спрашивай.' },
  { id: 'u_kuvshin_zakopcheny', name: 'Закопчённый кувшин', emoji: '🏺', category: 'raznoe', kind: 'unidentified',
    guess: { expertCategory: 'antikvariat', tiers: [
      { chance: 0.55, min: 10,  max: 80,  label: 'хлам' },
      { chance: 0.3,  min: 150, max: 400, label: 'обычное' },
      { chance: 0.15, min: 500, max: 1000,label: 'ценное' },
    ] },
    desc: 'Копоть веков или этого утра — на севере это одно и то же.' },
  { id: 'u_petzher_motorola', name: 'Пейджер Motorola', emoji: '📟', category: 'raznoe', kind: 'unidentified',
    guess: { expertCategory: 'tehnika', tiers: [
      { chance: 0.5, min: 60,  max: 200, label: 'обычное' },
      { chance: 0.4, min: 300, max: 700, label: 'ценное' },
      { chance: 0.1, min: 900, max: 1600,label: 'редкое' },
    ] },
    desc: 'Молчит с 2003-го. Кто-то до сих пор ждёт того абонента.' },
  { id: 'u_klyuchi_svyazka', name: 'Связка старинных ключей', emoji: '🗝️', category: 'raznoe', kind: 'unidentified',
    guess: { expertCategory: 'antikvariat', tiers: [
      { chance: 0.6, min: 20,  max: 100, label: 'хлам' },
      { chance: 0.3, min: 150, max: 400, label: 'обычное' },
      { chance: 0.1, min: 500, max: 900, label: 'ценное' },
    ] },
    desc: 'От чего — неизвестно. Возможно, от чужих баков. Возможно, от твоего прошлого.' },

  // ===================== ИТОГО: 25 очевидные+еда + 13 неопознанных = 38 ======
];
