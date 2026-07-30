/**
 * equipment.js — снаряжение (сессия 9). ТОЛЬКО ДАННЫЕ; логика — js/core/equipment.js.
 * Источник снаряжения — выбор человека 1B: и приспособление из находок, и покупка.
 *
 * slots:        слоты персонажа (ключи = state.equipment)
 * effect:       числовой эффект (интерпретация — ядро; точки применения см. ниже)
 * fromItems:    предметы из items.js, которые можно «приспособить» в слот
 * shop:         что продаёт Теща Петровна под этот слот (цена фиксированная)
 *
 * Точки применения эффектов (в js/core):
 *  gloves.digRiskMult      — actions.digRiskChance
 *  jacket.warmthDecayMult  — time.advanceHours (распад тепла)
 *  cart.carryBonusKg       — inventory.capacityKg
 */
export const EQUIPMENT_SLOTS = {
  gloves: {
    emoji: '🧤',
    name: 'Перчатки',
    effect: { digRiskMult: 0.75 },
    effectDesc: 'риск обыска ×0.75 — осколок в пакете уже не команда «стоп»',
    fromItems: ['perchatki_rabochie'],
    shop: {
      id: 'perchatki_veterok',
      name: 'Перчатки «Ветерок»',
      price: 100,
      desc: 'Пупырышки свежие, левая и правая почти совпадают. Промышленная роскошь.',
    },
  },
  jacket: {
    emoji: '🧥',
    name: 'Тёплое верхнее',
    effect: { warmthDecayMult: 0.75 },
    effectDesc: 'тепло тает на четверть медленнее — Нева дует, а ты думаешь',
    fromItems: ['kurtka_rybaka'],
    shop: {
      id: 'telogreika',
      name: 'Телогрейка б/у',
      price: 300,
      desc: 'Пахнет чужими зимами, зато держит свои. Ветер обижен и подан в суд.',
    },
  },
  cart: {
    emoji: '🛒',
    name: 'Транспорт',
    effect: { carryBonusKg: 15 },
    effectDesc: '+15 кг к ноше — упаковка решает больше, чем энтузиазм',
    fromItems: [], // тележку из бака не достанешь: только у Петровны
    shop: {
      id: 'telezhka_ashan',
      name: 'Тележка «гипер»',
      price: 500,
      desc: 'Одно колесо живёт своей жизнью, но честной. Держава на четырёх ногах.',
    },
  },
};

/** Точка покупки снаряжения (живёт во вкладке «Сбыт» — там же, где деньги). */
export const EQUIPMENT_SHOP = {
  id: 'tesha_petrovna',
  emoji: '🧰',
  name: 'Теща Петровна (хозтовары)',
  desc: 'Бывший завскладом. Продаёт то, что «списали», но что работает лучше нового. Сторговаться с ней может только совесть.',
};
