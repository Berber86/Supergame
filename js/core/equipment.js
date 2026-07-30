/**
 * equipment.js — снаряжение (сессия 9, источник — выбор человека 1B):
 *  - «приспособить» подходящую находку (перчатки/куртка из лута — бесплатно,
 *    предмет покидает ношу) — equipFromInventory;
 *  - покупка у Тещи Петровны (час, фикс-цена, заменяет слот) — buyEquipment.
 *
 * Правило экипировки (выбор агента, зафиксировано в SESSION_LOG):
 *  надел — НАВСЕГДА (до смерти или замены). Приспособленное/купленное обратно
 *  в товар не превращается: замена слота УНИЧТОЖАЕТ старую вещь («ушла на
 *  тряпки — она и была тряпками»). Так проданное обратно не продаётся и
 *  нет злоупотребления «надеть перед баком — сдать после».
 * Смерть сбрасывает слоты (newLife): снаряжение — про эту жизнь (rebirth.lose).
 *
 * Эффекты читаются точечно из данных (см. equipment.js → «точки применения»),
 * хелперы ниже — чтобы ядро не повторяло развилки «есть ли перчатки».
 */

import { EQUIPMENT_SLOTS } from '../data/equipment.js';
import { ACTIONS } from '../data/balance.js';
import { findItem } from './lookups.js';
import { pushLog } from './state.js';
import { advanceHours } from './time.js';

/** Какая находка к какому слоту прилипает. null — не приспособить. */
export function slotForItem(itemId) {
  for (const [slot, def] of Object.entries(EQUIPMENT_SLOTS)) {
    if (def.fromItems.includes(itemId)) return slot;
  }
  return null;
}

/** Источник снаряжения в слоте: id находки из items.js или id из слот-магазина. */
export function equipmentSourceLabel(slot, sourceId) {
  if (!sourceId) return 'пусто';
  const fromCatalog = findItem(sourceId);
  if (fromCatalog) return `${fromCatalog.emoji} ${fromCatalog.name}`;
  const shopItem = EQUIPMENT_SLOTS[slot]?.shop;
  if (shopItem?.id === sourceId) return `${EQUIPMENT_SLOTS[slot].emoji} ${shopItem.name}`;
  return sourceId;
}

/** Множитель риска обыска от перчаток (1 — руки голые). */
export function digRiskEquipMult(state) {
  return state.equipment.gloves ? EQUIPMENT_SLOTS.gloves.effect.digRiskMult : 1;
}

/** Множитель таяния тепла от куртки (1 — ветер везде). */
export function warmthDecayEquipMult(state) {
  return state.equipment.jacket ? EQUIPMENT_SLOTS.jacket.effect.warmthDecayMult : 1;
}

/** Бонус грузоподъёмности от тележки (кг). */
export function carryBonusEquipKg(state) {
  return state.equipment.cart ? EQUIPMENT_SLOTS.cart.effect.carryBonusKg : 0;
}

/**
 * Приспособить находку из ноши в слот (бесплатно, без времени — это решение,
 * а не действие). Предмет уходит из ноше (из стопки — ОДНА штука).
 * Старое в слоте — на тряпки (сгорает): приспособленное обратно не разбирается.
 */
export function equipFromInventory(state, entryIndex, events = []) {
  if (state.status !== 'alive') return events;
  if (!Number.isInteger(entryIndex)) return events;
  const entry = state.inventory[entryIndex];
  if (!entry) return events;

  const slot = slotForItem(entry.itemId);
  if (!slot) return events;
  const item = findItem(entry.itemId);
  const def = EQUIPMENT_SLOTS[slot];

  entry.qty -= 1;
  if (entry.qty <= 0) state.inventory.splice(entryIndex, 1);

  const replaced = state.equipment[slot];
  state.equipment[slot] = item.id;

  let line = `${def.emoji} Приспособил: «${item.name}» теперь работает (${def.effectDesc}).`;
  if (replaced) line += ` Прежнее — на тряпки: оно им и было.`;
  events.push(line);
  pushLog(state, `Экипировка [${slot}]: ${item.name}${replaced ? ` (заменено: ${replaced})` : ''}.`);
  return events;
}

/**
 * Купить снаряжение у Тещи Петровны: фикс-цена, час на примерку, слот занят.
 * Не по карману — обошлось вздохом, времени нет. Старое — на тряпки.
 */
export function buyEquipment(state, slotKey, events = []) {
  if (state.status !== 'alive') return events;
  const def = EQUIPMENT_SLOTS[slotKey];
  if (!def) return events;
  if (state.equipment[slotKey]) return events; // слот занят — второй такой же не нужен

  const { price } = def.shop;
  if (state.money < price) {
    const line = `💸 «${def.shop.name}» — ${price} ₽ при твоих ${Math.round(state.money)} ₽. Петровна посмотрела сквозь тебя, как сквозь отчётность.`;
    events.push(line);
    pushLog(state, `Не по карману: ${def.shop.name} (${price} ₽).`);
    return events;
  }

  advanceHours(state, ACTIONS.saleInstant.hours, events);
  if (state.status !== 'alive') return events;

  state.money -= price;
  state.equipment[slotKey] = def.shop.id;

  const line = `${def.emoji} Теща Петровна выдала «${def.shop.name}» (−${price} ₽). ${def.effectDesc}.`;
  events.push(line);
  pushLog(state, `Куплено снаряжение [${slotKey}]: ${def.shop.name} за ${price} ₽.`);
  return events;
}
