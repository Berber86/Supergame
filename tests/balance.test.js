/**
 * balance.test.js — якоря баланс-паса сессии 10 (ответ человека 2D).
 *
 * Встроенная «разумная политика» на РЕАЛЬНЫХ редьюсерах проживает жизни и
 * закрепляет выводы прохода: игра остаётся жёсткой (мороз и бедность убивают),
 * но перестаёт быть стеной смерти. Крутишь числа в data/balance.js — эти тесты
 * первыми скажут, сломал ли жанр.
 *
 * Замеры при принятии (60 жизней): медиана 25 дней, 42% доживают до 30,
 * смерти: «морозная лавка» 27% (выбранное жёсткое правило), голод/холод — остальное.
 * Запас в ассертах щедрый, но детерминированный (сиды фиксируют мир).
 */

import { describe, it, expect } from 'vitest';
import { createGame } from '../js/core/state.js';
import { dig, travelTo, beg, eat } from '../js/core/actions.js';
import { sellEntry, sellableEntries } from '../js/core/trade.js';
import { blindSell } from '../js/core/identify.js';
import { buyFood, chooseShelter } from '../js/core/living.js';
import { buyEquipment } from '../js/core/equipment.js';
import { dropEntry, inventoryUsedKg, capacityKg } from '../js/core/inventory.js';
import { findItem } from '../js/core/lookups.js';
import { applyEventChoice, choiceAvailability, findEvent } from '../js/core/events.js';

function answerModal(s) {
  if (!s.pendingEvent) return;
  const ev = findEvent(s.pendingEvent.eventId);
  const ok = ev.choices.find((c) => choiceAvailability(s, c).enabled);
  if (ok) applyEventChoice(s, ok.id, []);
}

function eatIfHungry(s) {
  if (s.stats.warmth < 40 && s.money >= 130) buyFood(s, 'stolovaya', []);
  if (s.stats.satiety > 30) return;
  const food = s.inventory.find((e) => findItem(e.itemId)?.kind === 'food');
  if (food) { eat(s, food.itemId, []); return; }
  if (s.money >= 35) buyFood(s, 'doshik', []);
  else if (s.stats.satiety < 15) beg(s, []);
}

function sellAll(s, pressure = false) {
  let sold = 0;
  for (let i = s.inventory.length - 1; i >= 0; i -= 1) {
    const entry = s.inventory[i];
    if (!entry) continue;
    const item = findItem(entry.itemId);
    if (item.kind === 'food' && !pressure) continue;
    if (item.kind === 'unidentified' && !entry.identified) { blindSell(s, i, []); sold += 1; continue; }
    if (item.kind === 'food') { sellEntry(s, i, 'perekup', []); sold += 1; continue; }
    let best = null;
    for (const bid of ['punkt_priema', 'lombard']) {
      const row = sellableEntries(s, bid).find((r) => r.entryIndex === i);
      if (row && (!best || row.offer.price > best.price)) best = { bid, price: row.offer.price };
    }
    if (best) { sellEntry(s, i, best.bid, []); sold += 1; }
  }
  return sold;
}

/** Одна жизнь простоватого, но разумного бродяги. Исход — полный state. */
function playLife(seed, maxDays = 30) {
  const s = createGame(seed);
  let bin = 0;
  let guard = 10000;
  while (s.status === 'alive' && s.day <= maxDays && guard > 0) {
    guard -= 1;
    chooseShelter(s, s.money >= 160 ? 'nochlezhka' : 'lavka', []);
    answerModal(s);
    eatIfHungry(s);
    if (s.status !== 'alive') break;
    if (s.money >= 500 && !s.equipment.jacket) { buyEquipment(s, 'jacket', []); continue; }
    if (s.districtId !== 'kupchino') {
      if (s.hour <= 16) travelTo(s, 'kupchino', []);
      else sellAll(s, true);
      continue;
    }
    if (inventoryUsedKg(s) > capacityKg(s) * 0.8) { if (sellAll(s, true) === 0) beg(s, []); continue; }
    if (s.hour >= 20) { if (sellAll(s, true) === 0) beg(s, []); continue; }
    dig(s, bin % 7, []);
    bin += 1;
  }
  return s;
}

function cohort(n = 40) {
  const lives = [];
  for (let seed = 1; seed <= n; seed += 1) lives.push(playLife(seed * 101));
  return lives;
}

describe('⚖️ якоря баланса (разумный бот, 40 жизней)', () => {
  const lives = cohort();
  const days = lives.map((s) => s.day).sort((a, b) => a - b);
  const died = lives.filter((s) => s.status === 'dead');

  it('медиана жизни — хотя бы 12 дней (не стена смерти)', () => {
    expect(days[Math.floor(days.length / 2)]).toBeGreaterThanOrEqual(12);
  });

  it('хотя бы 20% доживают до 25-го дня (жанр даёт шанс)', () => {
    const reached = lives.filter((s) => s.day >= 25).length;
    expect(reached / lives.length).toBeGreaterThanOrEqual(0.2);
  });

  it('жёсткость сохранена: кто-то умирает', () => {
    expect(died.length).toBeGreaterThan(0);
  });

  it('холод — не монополист смерти (дожить можно, замёрзнуть можно)', () => {
    const cold = died.filter((s) => (s.deathCause ?? '').includes('Холод')).length;
    expect(cold / lives.length).toBeLessThanOrEqual(0.6);
  });

  it('выжившие зарабатывают: экономика не в минусе при простой игре', () => {
    const alive = lives.filter((s) => s.status === 'alive');
    if (alive.length === 0) return; // жанр решил иначе — остальные ассерты выше скажут
    const earned = alive.reduce((a, s) => a + s.earnedThisLife, 0) / alive.length;
    expect(earned).toBeGreaterThan(500);
  });
});

describe('🗑️ выброс хлама (сессия 10)', () => {
  it('опознанный 0-₽ хлам выбрасывается без времени и денег', () => {
    const s = createGame(7);
    // кладём «пустой» опознанный предмет (такой получается из тира «хлам»)
    s.inventory.push({
      itemId: 'u_korobka_berzhnaya', qty: 1, trueValue: 0, identified: true,
      estimate: { low: 0, high: 0, exact: true, level: 8 },
    });
    const events = dropEntry(s, 0);
    expect(s.inventory).toHaveLength(0);
    expect(s.hour).toBe(8);
    expect(s.money).toBe(60);
    expect(events.join(' ')).toContain('Выбросил');
  });

  it('неверный индекс — тишина', () => {
    const s = createGame(7);
    expect(dropEntry(s, 5)).toHaveLength(0);
    expect(dropEntry(s, -1)).toHaveLength(0);
  });
});
