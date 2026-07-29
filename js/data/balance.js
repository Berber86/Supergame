/**
 * balance.js — ВСЕ числовые константы баланса в одном месте.
 * Логики здесь нет (только данные): интерпретация — в js/core (сессии 4+).
 * Правило проекта: подкрутил число тут — не трогай логику там.
 */

/** ---- Время ---- */
export const TIME = {
  HOURS_PER_DAY: 16,      // активные часы: 8:00 → 24:00
  SLEEP_HOURS: 8,         // ночь уходит на сон
  START_HOUR: 8,          // подъём в 8:00
};

/** Действия и их стоимость (часы/энергия/опрятность). */
export const ACTIONS = {
  dig:          { hours: 2, energy: -10, cleanliness: -8 },  // обыск одного бака
  travelHour:   { energy: -4 },                              // за каждый час пути (часы — из матрицы районов)
  saleInstant:  { hours: 1 },                                // ломбард/пункт приёма/перекуп
  fleaMarket:   { hours: 4, energy: -15, minCleanliness: 40 }, // сидеть на барахолке
  expertVisit:  { hours: 1 },                                // сходить к эксперту
  wash:         { hours: 1, cleanliness: +40 },              // помыться (где есть вода)
};

/** ---- Распад статов (в час; логика выборки — js/core) ---- */
export const DECAY = {
  satietyPerHour: -2.5,
  warmthPerHour: -1.6,          // множится на погоду (js/data/weather.js)
  energyPerHour: -0.8,          // пассивная усталость, сверху — стоимость действий
  cleanlinessPerHour: -0.6,
  healthPerHourAtZero: -3,      // если сытость=0 ИЛИ тепло=0 — тает здоровье
  healthRegenAtNight: +0.4,     // в час сна, если сытость > 50
};

/** ---- Старт новой жизни / первой игры ---- */
export const START = {
  money: 60,
  satiety: 70,
  warmth: 80,
  health: 100,
  energy: 100,
  cleanliness: 50,
};

/** ---- Быт: еда и ночлег (покупка, не находки) ---- */
export const LIVING = {
  food: [
    { id: 'doshik',    name: 'Доширак у ларька',   emoji: '🍜', price: 35,  satiety: +25 },
    { id: 'stolovaya', name: 'Обед в столовой',    emoji: '🍲', price: 120, satiety: +55 },
    { id: 'pir_na_dnu',name: 'Пир на дне (шаверма)',emoji: '🌯', price: 200, satiety: +80, cleanliness: -5 },
  ],
  shelter: [
    { id: 'lavka',     name: 'Лавка в парке',  emoji: '🥶', price: 0,   quality: 0.5, riskEvents: true },
    { id: 'nochlezhka',name: 'Ночлежка «У Анны»', emoji: '🛏️', price: 100, quality: 0.85, washIncluded: true },
    { id: 'ugol',      name: 'Съёмный угол',   emoji: '🚪', price: 350, quality: 1.1, note: 'пост-MLP цель' },
  ],
  energyFromSleep: 100,    // база восстановления энергии за ночь (× качество ночлега, кап 100)
};

/** ---- Навыки (0..10), растут от применения ---- */
export const SKILLS = {
  maxLevel: 10,
  /** level = floor(sqrt(xp / xpPerLevel)); xpPerLevel=10: ранг 1 после 10 xp, ранг 3 после 90 xp. */
  xpPerLevel: 10,
  list: {
    search:  { name: 'Поиск',  emoji: '🔍', xpPerUse: 1, effect: 'качество/кол-во находок, меньше риска при обыске' },
    assess:  { name: 'Оценка', emoji: '👁️', xpPerUse: 1, effect: 'точнее диапазон цены неопознанного (формула ниже)' },
    trade:   { name: 'Торг',   emoji: '🤝', xpPerUse: 1, effect: 'лучше коэффициенты выкупа, меньше шанс кидка' },
    stamina: { name: 'Выносливость', emoji: '💪', xpPerUse: 1, effect: '+5 к энергии-капу и грузоподъёмности за уровень' },
  },
};

/**
 * Формула «👁️ Оценка»: spread = max(0, 1 - level * 0.125).
 * lvl 0 — «неизвестно»; lvl 1 – [v·0.875, v·1.125]±шум... нет: spread 0.875 → честный широкий диапазон;
 * lvl 8+ — spread 0 → точная цена. Логика округления — js/core, здесь смысл.
 */
export const ASSESS = { spreadPerLevel: 0.125, exactFromLevel: 8 };

/** Перекуп-жулик: база честной сделки (модифицируется Торгом: +0.03/уровень, кап 0.9). */
export const SCAM = { baseHonestChance: 0.65, tradeBonusPerLevel: 0.03, honestChanceCap: 0.9 };

/** Грузоподъёмность ноши (кг). Рюкзак/тележка поднимут — снаряжение, сессия 9. */
export const CARRY = { baseKg: 5, staminaBonusKg: 5 }; // staminaBonusKg — за уровень Выносливости

/**
 * Попрошайничество (выбор человека в сессии 2: СТАБИЛЬНОЕ, без событий).
 * Гарантированный малый доход за час стояния — «подушка» на голодный день,
 * конкуренции с баками не составляет по доходности, зато без риска.
 */
export const BEGGING = { hours: 1, income: 40 }; // ₽ за действие, гарантированно

/**
 * Ночные риски лавки (выбор человека в сессии 3: ЖЁСТКО — мороз может убить).
 * Ночлежка за 100 ₽ в мороз — не роскошь, а страховка. Петербург не прощает
 * экономии на ночлеге. (Интерпретация — логика сна, сессия 8.)
 */
export const NIGHT_RISK = {
  lavkaFrostDeathChance: 0.2,  // шанс не проснуться, если ночуешь на лавке в ❄️мороз
  lavkaStealChance: 0.15,      // шанс потерять случайную находку за ночь (любая погода)
  lavkaBadSleepWarmth: -15,    // утренний холод даже без мороза
};
