/**
 * icons.js — словари «иконок»-эмодзи для UI.
 * Графики в проекте нет, есть эмодзи и слёзы. (Трагикомедия, сессия 1.)
 */

/** Категории предметов (js/data/items.js → category) → эмодзи + подпись. */
export const CATEGORY_ICONS = {
  steklotara:  { emoji: '🍾', label: 'Стекло/банки' },
  metall:      { emoji: '🔩', label: 'Металл' },
  bumaga:      { emoji: '📰', label: 'Бумага' },
  eda:         { emoji: '🍖', label: 'Еда' },
  odezhda:     { emoji: '🧥', label: 'Одежда' },
  obuv:        { emoji: '🥾', label: 'Обувь' },
  byt:         { emoji: '🔌', label: 'Бытовуха' },
  instrument:  { emoji: '🔨', label: 'Инструменты' },
  tehnika:     { emoji: '📻', label: 'Техника' },
  antikvariat: { emoji: '🏺', label: 'Антиквариат' },
  raznoe:      { emoji: '📦', label: 'Разное' },
};

/** Специальности экспертов (js/data/experts.js → specialties). */
export const EXPERT_CATEGORY_ICONS = {
  antikvariat: { emoji: '🏺', label: 'Антиквариат' },
  tehnika:     { emoji: '📻', label: 'Техника' },
};

/** Статы панели (ключи совпадают с js/data/balance.js → START). */
export const STAT_META = [
  { key: 'money',       emoji: '💰', label: 'Деньги',      kind: 'money' },
  { key: 'satiety',     emoji: '🍞', label: 'Сытость' },
  { key: 'warmth',      emoji: '🔥', label: 'Тепло' },
  { key: 'health',      emoji: '❤️', label: 'Здоровье' },
  { key: 'energy',      emoji: '⚡', label: 'Энергия' },
  { key: 'cleanliness', emoji: '🧼', label: 'Опрятность' },
];
