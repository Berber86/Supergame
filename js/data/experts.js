/**
 * experts.js — NPC-эксперты по идентификации (черновик данных).
 *
 * specialties:  какие expertCategory неопознанных предметов опознаёт (items.js → guess.expertCategory)
 * fee:          { type: 'percent', value, min } | { type: 'fixed', value }
 *               percent — доля от оценённой цены (берёт после продажи этой вещи у него же),
 *               fixed — деньги вперёд, «независимо от результата».
 */

export const EXPERTS = [
  {
    id: 'gerych',
    name: 'Герыч с барахолки',
    emoji: '🧔',
    specialties: ['antikvariat'],
    fee: { type: 'percent', value: 0.2, min: 100 },
    quote: '«Это я видел в 89-м у тёти Любы. Тётя Люба — гарантия качества».',
    desc: 'Знает всё старое на Удельной по имени. Берёт процент и берёт это спокойно.',
  },
  {
    id: 'sliva',
    name: 'Технарь Слива',
    emoji: '🧑‍🔧',
    specialties: ['tehnika'],
    fee: { type: 'fixed', value: 150 },
    quote: '«Пейджер-то живой. Печалька, что абонент — нет».',
    desc: 'Мастер на все платы. Опознает любую электронику, пока ты ждёшь, прихлёбывая чай из его чайника.',
  },
  // Пост-MLP кандидат: «Куратор из Эрмитажа» (antikvariat, дорого, ачивка).
];
