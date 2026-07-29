/**
 * trade.js — сбыт и экономика (сессия 7): продажа находок четырём точкам.
 *
 * Формула выкупа (GDD §8, коэффициенты ФИКСИРОВАННЫЕ — выбор человека 1D→A:
 * дневного спроса нет, экономика читается и изучаема):
 *   цена = база × priceMult × (1 + 🤝Торг × tradeBonus/10) × (1 + наследие*)
 * Базы:  очевидное → item.value · опознанное ❓ → его trueValue ·
 *        ❓+estimate на барахолке → центр ТВОЕГО диапазона («кот в мешке»:
 *        плати́т барахолка ровно за твой рассказ — самообман стал механикой).
 *   *наследие — не для ♻️ пункта приёма (REBIRTH.legacy.appliesTo): весам
 *   на легенды плевать, цена честная и скучная — номинал × штуки.
 *
 * Частные случаи:
 *  🕶️ Тень: вместо прибавки к цене 🤝 Торг снижает шанс КИДКА (кидок =
 *    0 ₽ + скандал, товар теряется всегда). Честная сделка платит
 *    110–130% базы. Опознанное берёт так же, как вслепую (выбор 3D→A) —
 *    азарт един: perekupHonestChance используется и identify.js.
 *  🧺 Барахолка: честные 100%, но 4 ч за столом и −15 ⚡ (ACTIONS.fleaMarket);
 *    фейс-контроль по 🧼 отшивает ДО потери времени (время — не наказание
 *    за заведомо непроходный квест).
 * XP 🤝: +1 за сделку с переговорами (все точки, кроме ♻️ — с весами не
 *   потренируешься). Терпишь кидок — всё равно опыт.
 *
 * saleOffer — чистая (по state) ДЕТЕРМИНИРОВАННАЯ оценка сделки: её зовут
 * и кнопки UI (что вижу), и редьюсер (что получу) — цены в интерфейсе не
 * врут. Роллер нужен только Тени; там честно показываем вилку и шанс кидка.
 */

import { ACTIONS, SCAM } from '../data/balance.js';
import { REBIRTH } from '../data/rebirth.js';
import { findBuyer, findItem } from './lookups.js';
import { clampStats, pushLog } from './state.js';
import { advanceHours } from './time.js';
import { addSkillXp } from './skills.js';
import { makeRoller } from './rng.js';

/** Шанс честной сделки с Тенью: база + 🤝 защита, кап. Единая точка правды. */
export function perekupHonestChance(state) {
  return Math.min(
    SCAM.honestChanceCap,
    SCAM.baseHonestChance + state.skills.trade.level * SCAM.tradeBonusPerLevel,
  );
}

/** Множитель наследия репутации для точки (пункту приёма на легенды плевать). */
export function legacyMult(state, buyer) {
  return 1 + (REBIRTH.legacy.appliesTo.includes(buyer.id) ? state.legacyBonus : 0);
}

/** Множитель 🤝 Торга: +tradeBonus на 10-м уровне, линейно (GDD §8). */
export function tradeMult(state, buyer) {
  return 1 + (buyer.tradeBonus ?? 0) * (state.skills.trade.level / 10);
}

/**
 * На какой базе эта точка готова считать эту запись ноши. null — не берёт.
 * ❓ без опознания: 🧺 барахолка берёт «кота в мешке» по центру ТВОЕЙ оценки
 * (платит за твой же рассказ), 🕶️ Тень — только вслепую (identify.blindSell,
 * отдельная азартная кнопка в инвентаре), остальные лотереи не признают.
 */
export function saleBase(entry, item, buyer) {
  const isMystery = item.kind === 'unidentified';
  if (isMystery && !entry.identified) {
    if (buyer.id === 'baraholka' && entry.estimate) {
      return { base: Math.round((entry.estimate.low + entry.estimate.high) / 2), story: 'fleaMystery' };
    }
    return null;
  }
  const acceptsCategory = buyer.accepts === 'all' || buyer.accepts.includes(item.category);
  if (!acceptsCategory) return null;
  const base = isMystery ? entry.trueValue : item.value;
  if (!base || base <= 0) return null; // «хлам» за 0 ₽ никто не унесёт — ни тебе, ни точке
  return { base, story: null };
}

/**
 * Детерминированное предложение точки по записи ноши (для UI и редьюсера).
 * null — не берёт. Иначе:
 *   { qty, base, story?, price } — честные точки: цена точная;
 *   { qty, base, story?, min, max, scamChance } — 🕶️ Тень: вилка + риск.
 */
export function saleOffer(state, entry, buyer) {
  const item = findItem(entry.itemId);
  if (!item) return null;
  const found = saleBase(entry, item, buyer);
  if (!found) return null;

  if (buyer.scam) {
    const legacy = legacyMult(state, buyer);
    return {
      qty: entry.qty,
      base: found.base,
      story: found.story,
      min: Math.round(found.base * entry.qty * buyer.priceMult.min * legacy),
      max: Math.round(found.base * entry.qty * buyer.priceMult.max * legacy),
      scamChance: 1 - perekupHonestChance(state),
    };
  }

  const priceMult = typeof buyer.priceMult === 'number' ? buyer.priceMult : 1;
  const price = Math.round(found.base * entry.qty * priceMult * tradeMult(state, buyer) * legacyMult(state, buyer));
  return { qty: entry.qty, base: found.base, story: found.story, price };
}

/** Всё, что эта точка сейчас готова взять из ноши: [{ entry, entryIndex, offer }]. */
export function sellableEntries(state, buyerId) {
  const buyer = findBuyer(buyerId);
  if (!buyer) return [];
  return state.inventory
    .map((entry, entryIndex) => ({ entry, entryIndex, offer: saleOffer(state, entry, buyer) }))
    .filter((x) => x.offer != null);
}

/** Проходит ли игрок фейс-контроль точки (🧺 барахолка: 🧼 от minCleanliness). */
export function passesGate(state, buyer) {
  return !buyer.requires?.minCleanliness
    || state.stats.cleanliness >= buyer.requires.minCleanliness;
}

/** Поделиться опытом переговоров: +🤝 XP всем, кроме ♻️ весов. */
function grantTradeXp(state, buyer, events) {
  if (!buyer.scam && !(buyer.tradeBonus > 0)) return; // ♻️ «весы не договоришься»
  if (addSkillXp(state, 'trade')) {
    events.push(`⬆️ 🤝 Торг вырос до уровня ${state.skills.trade.level}!`);
  }
}

/**
 * Сдать запись ноши (стопку — целиком) указанной точке.
 * Порядок: гварды → фейс-контроль ДО времени → часы/усталость → роллер
 * (только 🕶️) → предмет уходит → деньги/скандал → XP → журнал.
 */
export function sellEntry(state, entryIndex, buyerId, events = []) {
  if (state.status !== 'alive') return events;
  if (!Number.isInteger(entryIndex)) return events;
  const entry = state.inventory[entryIndex];
  const buyer = findBuyer(buyerId);
  if (!entry || !buyer) return events;
  const item = findItem(entry.itemId);
  if (!item) return events;

  const offer = saleOffer(state, entry, buyer);
  if (!offer) return events; // эта точка такое не берёт (или 🧺 ждёт твоей оценки)

  // Фейс-контроль — ДО потери времени: смылся, пришёл опрятным — тогда торгуем.
  if (!passesGate(state, buyer)) {
    const need = buyer.requires.minCleanliness;
    const line = `🧺 На Удельной на тебя посмотрели, принюхались и отвели глаза. С опрятностью ниже ${need} туда даже стоять нечего — сначала умойся.`;
    events.push(line);
    pushLog(state, `Барахолка отшила: 🧼${Math.round(state.stats.cleanliness)} < ${need}.`);
    return events;
  }

  // Стоимость сделки: часы (барахолка — ещё и усталость).
  const cost = buyer.instant ? ACTIONS.saleInstant : ACTIONS.fleaMarket;
  if (cost.energy) {
    state.stats.energy += cost.energy;
    clampStats(state);
  }
  advanceHours(state, cost.hours, events);
  if (state.status !== 'alive') return events;

  // Товар уходит из пакета в любом исходе (кидок — это когда и товар, и деньги).
  state.inventory.splice(entryIndex, 1);
  const qtyText = offer.qty > 1 ? ` ×${offer.qty}` : '';
  const legacy = legacyMult(state, buyer);

  if (buyer.scam) {
    const roller = makeRoller(state.rngState);
    if (!roller.chance(perekupHonestChance(state))) {
      state.stats.cleanliness += SCAM.scandalCleanliness;
      clampStats(state);
      state.rngState = roller.state;
      const line = `🕶️ Тень взяла «${item.name}»${qtyText}, кивнула… и растворилась в сумерках вместе с товаром. Скандал у гаражей: 0 ₽ и лишние взгляды (${SCAM.scandalCleanliness} 🧼).`;
      events.push(line);
      pushLog(state, `Тень кинула на «${item.name}»: 0 ₽ и скандал.`);
      grantTradeXp(state, buyer, events);
      return events;
    }
    const multRaw = buyer.priceMult.min + roller.roll() * (buyer.priceMult.max - buyer.priceMult.min);
    const price = Math.round(offer.base * offer.qty * multRaw * legacy);
    state.rngState = roller.state;
    state.money += price;
    state.earnedThisLife += price;
    const line = `🕶️ Тень пробежала пальцами по «${item.name}»${qtyText} и отсчитала, не глядя: +${price} ₽. Честно. Даже подозрительно.`;
    events.push(line);
    pushLog(state, `Тень выкупила «${item.name}»${qtyText} → ${price} ₽.`);
    grantTradeXp(state, buyer, events);
    return events;
  }

  state.money += offer.price;
  state.earnedThisLife += offer.price;

  let line;
  if (buyer.id === 'punkt_priema') {
    line = `♻️ «ВторСырьё» взвесило «${item.name}»${qtyText}: +${offer.price} ₽. Без вопросов и без чудес.`;
  } else if (buyer.id === 'lombard') {
    line = `🏪 Михалыч покрутил «${item.name}»${qtyText} и бросил на конторку: +${offer.price} ₽. Плати за скорость.`;
  } else {
    const hours = ACTIONS.fleaMarket.hours;
    const story = offer.story === 'fleaMystery' ? ' Кот в мешке ушёл по твоему же рассказу.' : '';
    line = `🧺 Честный день на Удельной (${hours} ч): «${item.name}»${qtyText} ушла за ${offer.price} ₽.${story}`;
  }
  events.push(line);
  pushLog(state, `Сбыт (${buyer.name}): ${item.name}${qtyText} → ${offer.price} ₽.`);
  grantTradeXp(state, buyer, events);
  return events;
}
