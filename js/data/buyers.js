/**
 * buyers.js — точки сбыта (черновик данных, правила описаны декларативно).
 *
 * accepts:        список категорий предметов (см. items.js) или 'all'
 * acceptsUnidentified: берёт ли неопознанное
 * priceMult:      коэффициент к цене предмета (item.value или истинной цене)
 * tradeBonus:     максимум прибавки за навык Торг (распределяется по уровням)
 * scam:           параметры кидка (только для перекупщика)
 */

export const BUYERS = [
  {
    id: 'punkt_priema',
    name: 'Пункт приёма «ВторСырьё»',
    emoji: '♻️',
    desc: 'Весы, очередь, запах. Цены знает каждый с рождения: платят ровно за сколько взвесили.',
    accepts: ['steklotara', 'metall', 'bumaga'],
    acceptsUnidentified: false,
    priceMult: 1.0,       // цена = item.value, тут без обмана — но и без чудес
    tradeBonus: 0,        // с весами не торгуются
    instant: true,
  },
  {
    id: 'lombard',
    name: 'Ломбард «У Михалыча»',
    emoji: '🏪',
    desc: 'Быстро, мрачно, без лишних вопросов. 60 копеек с рубля — плата за скорость и равнодушие.',
    accepts: ['odezhda', 'obuv', 'byt', 'instrument', 'tehnika', 'antikvariat', 'raznoe'],
    acceptsUnidentified: false,    // неопознанное Михалыч не берёт: «я не лотерея»
    priceMult: 0.6,
    tradeBonus: 0.15,     // c Торгом-10: до 0.75
    instant: true,
  },
  {
    id: 'baraholka',
    name: 'Барахолка на Удельной',
    emoji: '🧺',
    desc: 'Честная цена, честный день. Сидишь — торгуешь. Народ смотрит на тебя, и лучше выглядеть человеком.',
    accepts: ['odezhda', 'obuv', 'byt', 'instrument', 'tehnika', 'antikvariat', 'raznoe'],
    acceptsUnidentified: true,     // можно выставить «кот в мешке», цена — как договоришься
    priceMult: 1.0,
    tradeBonus: 0.2,      // с Торгом-10: до 1.2
    instant: false,       // бархола съедает слот дня (см. balance.js → ACTIONS.fleaMarket)
    requires: { minCleanliness: 40 },
  },
  {
    id: 'perekup',
    name: 'Перекуп «Тень у гаражей»',
    emoji: '🕶️',
    desc: 'Купит всё. Даже то, что ты сам не понял, что нашёл. Вопрос — по какой цене и по чьей совести.',
    accepts: 'all',
    acceptsUnidentified: true,     // он-то цену знает. всегда.
    priceMult: { min: 1.1, max: 1.3 },  // если сделка честная — переплата за риск
    instant: true,
    scam: {
      baseChance: 0.35,            // шанс «не рассчитаться»
      tradeProtectionPerLevel: 0.03, // Торг снижает (кап — в balance.js → SCAM)
      consequence: 'money: 0 + скандал (испуганные прохожие, -опрятность)',
    },
  },
];
