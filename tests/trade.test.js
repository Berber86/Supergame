/**
 * trade.test.js — сбыт и экономика (сессия 7).
 * Коэффициенты GDD §8, 🤝 Торг (цена и защита от кидка), наследие репутации,
 * фейс-контроль барахолки, «кот в мешке» по своей оценке, азарт Тени.
 * Рандомные матч-апы — поиском сида (как в dig/identify тестах), статистика —
 * на 300–400 сидах. Ожидаемые цены считаем той же цепочкой операций, что и
 * реализация, чтобы не плясать с дрейфом округления.
 */

import { describe, it, expect } from 'vitest';
import { createGame } from '../js/core/state.js';
import { addItem } from '../js/core/inventory.js';
import {
  saleOffer, sellableEntries, sellEntry, passesGate, perekupHonestChance,
} from '../js/core/trade.js';
import { findBuyer } from '../js/core/lookups.js';
import { SCAM } from '../js/data/balance.js';

/** Положить предмет в ношу и вернуть ИНДЕКС записи (падаем, если не влезло). */
function give(state, itemId, opts = {}) {
  const res = addItem(state, itemId, opts);
  if (!res.fit) throw new Error(`ноша не вместила ${itemId}`);
  return state.inventory.indexOf(res.entry);
}

/** Сделать ношу с опознанным ❓ по заданной тайной цене. */
function giveIdentified(state, itemId, trueValue) {
  const idx = give(state, itemId, { trueValue });
  state.inventory[idx].identified = true;
  state.inventory[idx].estimate = { low: trueValue, high: trueValue, exact: true, level: 8 };
  return idx;
}

describe('♻️ пункт приёма: честные весы', () => {
  it('цена = номинал × штуки; торг и наследие НЕ действуют', () => {
    const s = createGame(1);
    s.skills.trade.level = 10;
    s.legacyBonus = 0.25;
    const idx = give(s, 'butylka_steklo', { qty: 6 });
    const offer = saleOffer(s, s.inventory[idx], findBuyer('punkt_priema'));
    expect(offer.price).toBe(5 * 6);
  });

  it('продажа стопки: деньги точно, час прошёл, 🤝-опыта нет (весы не договоришься)', () => {
    const s = createGame(1);
    const idx = give(s, 'butylka_steklo', { qty: 6 });
    const events = sellEntry(s, idx, 'punkt_priema');
    expect(s.money).toBe(60 + 30);
    expect(s.inventory).toHaveLength(0);
    expect(s.hour).toBe(9);
    expect(s.skills.trade.xp).toBe(0);
    expect(events.join(' ')).toContain('ВторСырьё');
  });

  it('не берёт категории вне сырья (антиквариат — мимо)', () => {
    const s = createGame(1);
    const idx = give(s, 'moneta_yubileynaya');
    expect(saleOffer(s, s.inventory[idx], findBuyer('punkt_priema'))).toBeNull();
    const moneyBefore = s.money;
    sellEntry(s, idx, 'punkt_priema');
    expect(s.money).toBe(moneyBefore);
    expect(s.inventory).toHaveLength(1);
  });
});

describe('🏪 ломбард: 60% + торг + наследие', () => {
  it('базовый коэффициент 0.6', () => {
    const s = createGame(2);
    const idx = give(s, 'utyug_sssr');
    const offer = saleOffer(s, s.inventory[idx], findBuyer('lombard'));
    expect(offer.price).toBe(Math.round(80 * 0.6));
  });

  it('🤝 Торг-10: +15% к выкупу', () => {
    const s = createGame(2);
    s.skills.trade.level = 10;
    const idx = give(s, 'utyug_sssr');
    const offer = saleOffer(s, s.inventory[idx], findBuyer('lombard'));
    expect(offer.price).toBe(Math.round(80 * 0.6 * (1 + (10 * 0.15) / 10)));
  });

  it('наследие репутации действует на ломбард', () => {
    const s = createGame(2);
    s.skills.trade.level = 10;
    s.legacyBonus = 0.25;
    const idx = give(s, 'utyug_sssr');
    const offer = saleOffer(s, s.inventory[idx], findBuyer('lombard'));
    expect(offer.price).toBe(Math.round(80 * 0.6 * 1.15 * 1.25));
  });

  it('продажа: деньги, час, +1 🤝 XP', () => {
    const s = createGame(2);
    const idx = give(s, 'utyug_sssr');
    sellEntry(s, idx, 'lombard');
    expect(s.money).toBe(60 + Math.round(80 * 0.6));
    expect(s.hour).toBe(9);
    expect(s.skills.trade.xp).toBe(1);
  });

  it('не берёт ❓: «я не лотерея»', () => {
    const s = createGame(2);
    const idx = give(s, 'u_korobka_berzhnaya', { trueValue: 500 });
    expect(saleOffer(s, s.inventory[idx], findBuyer('lombard'))).toBeNull();
  });
});

describe('🧺 барахолка: честная цена честным днём', () => {
  it('100% цены, Торг-10 → 120%', () => {
    const s = createGame(3);
    s.skills.trade.level = 10;
    const idx = give(s, 'sviter_vyazanyy');
    const offer = saleOffer(s, s.inventory[idx], findBuyer('baraholka'));
    expect(offer.price).toBe(Math.round(70 * 1 * 1.2));
  });

  it('сделка съедает 4 часа и 15⚡, даёт +1 🤝 XP', () => {
    const s = createGame(3);
    const energyBefore = s.stats.energy;
    const idx = give(s, 'sviter_vyazanyy');
    sellEntry(s, idx, 'baraholka');
    expect(s.money).toBe(60 + 70);
    expect(s.hour).toBe(12);
    // энергия = −15 за прилавок и −0.8/ч пассивного распада за 4 часа
    expect(s.stats.energy).toBeCloseTo(energyBefore - 15 - 0.8 * 4, 5);
    expect(s.skills.trade.xp).toBe(1);
  });

  it('фейс-контроль: 🧼 < 40 — отшили ДО потери времени', () => {
    const s = createGame(3);
    s.stats.cleanliness = 39;
    const idx = give(s, 'sviter_vyazanyy');
    expect(passesGate(s, findBuyer('baraholka'))).toBe(false);
    const events = sellEntry(s, idx, 'baraholka');
    expect(s.money).toBe(60);
    expect(s.hour).toBe(8);          // время не потрачено
    expect(s.inventory).toHaveLength(1); // товар при тебе
    expect(events.join(' ')).toContain('умойся');
  });

  it('«кот в мешке»: ❓ по центру ТВОЕЙ оценки; без оценки — не берёт', () => {
    const s = createGame(3);
    const idx = give(s, 'u_korobka_berzhnaya', { trueValue: 550 });
    expect(saleOffer(s, s.inventory[idx], findBuyer('baraholka'))).toBeNull();

    s.inventory[idx].estimate = { low: 400, high: 600, exact: false, level: 3 };
    const offer = saleOffer(s, s.inventory[idx], findBuyer('baraholka'));
    expect(offer.story).toBe('fleaMystery');
    expect(offer.price).toBe(500); // центр самооценки — твоя же цена
  });

  it('продажа «кота в мешке»: деньги = центр оценки, 4 часа', () => {
    const s = createGame(3);
    const idx = give(s, 'u_korobka_berzhnaya', { trueValue: 550 });
    s.inventory[idx].estimate = { low: 400, high: 600, exact: false, level: 3 };
    sellEntry(s, idx, 'baraholka');
    expect(s.money).toBe(60 + 500);
    expect(s.hour).toBe(12);
  });
});

describe('🕶️ Тень: 110–130% или кидок (единый азарт)', () => {
  it('вилка честной сделки: 1.1–1.3 × наследие; шанс кидка виден', () => {
    const s = createGame(4);
    s.legacyBonus = 0.2;
    const idx = giveIdentified(s, 'u_lupa_latunnaya', 1000);
    const offer = saleOffer(s, s.inventory[idx], findBuyer('perekup'));
    expect(offer.min).toBe(Math.round(1000 * 1.1 * 1.2));
    expect(offer.max).toBe(Math.round(1000 * 1.3 * 1.2));
    expect(offer.scamChance).toBeCloseTo(0.35, 5);
  });

  it('берёт вообще всё (даже тушёнку без этикетки)', () => {
    const s = createGame(4);
    const idx = give(s, 'tushenka_bez_etiketki');
    const offer = saleOffer(s, s.inventory[idx], findBuyer('perekup'));
    expect(offer.min).toBe(Math.round(10 * 1.1));
    expect(offer.max).toBe(Math.round(10 * 1.3));
  });

  it('неопознанное ❓ — не сюда: вслепую из инвентаря (identify.blindSell)', () => {
    const s = createGame(4);
    const idx = give(s, 'u_korobka_berzhnaya', { trueValue: 500 });
    expect(saleOffer(s, s.inventory[idx], findBuyer('perekup'))).toBeNull();
  });

  it('честная сделка: цена строго в вилке, товар ушёл, +1 🤝 XP', () => {
    const run = (seed) => {
      const s = createGame(seed);
      const idx = giveIdentified(s, 'u_lupa_latunnaya', 1000);
      sellEntry(s, idx, 'perekup');
      return s;
    };
    let honest = null;
    for (let seed = 1; seed <= 400 && !honest; seed += 1) {
      const s = run(seed);
      if (s.money > 60) honest = s;
    }
    expect(honest).not.toBeNull();
    const price = honest.money - 60;
    expect(price).toBeGreaterThanOrEqual(1100);
    expect(price).toBeLessThanOrEqual(1300);
    expect(honest.inventory).toHaveLength(0);
    expect(honest.skills.trade.xp).toBe(1);
  });

  it('кидок: 0 ₽, скандал −10 🧼, товар ушёл, опыт — всё равно опыт', () => {
    let s = null;
    for (let seed = 1; seed <= 400 && !s; seed += 1) {
      const cand = createGame(seed);
      const idx = giveIdentified(cand, 'u_lupa_latunnaya', 1000);
      sellEntry(cand, idx, 'perekup');
      if (cand.money === 60) s = cand;
    }
    expect(s).not.toBeNull();
    expect(s.inventory).toHaveLength(0);
    // скандал −10 🧼 + часовой распад −0.6 (сделка идёт 1 час)
    expect(s.stats.cleanliness).toBeCloseTo(50 + SCAM.scandalCleanliness - 0.6, 5);
    expect(s.skills.trade.xp).toBe(1); // горький, но опыт
  });

  it('статистика честности: 🤝-0 ≈ 35% кидка, 🤝-10 ≈ 10% (кап честности 0.9)', () => {
    const scamRate = (tradeLevel, seeds) => {
      let scams = 0;
      for (let seed = 1; seed <= seeds; seed += 1) {
        const s = createGame(seed);
        s.skills.trade.level = tradeLevel;
        const idx = giveIdentified(s, 'u_lupa_latunnaya', 1000);
        sellEntry(s, idx, 'perekup');
        if (s.money === 60) scams += 1;
      }
      return scams / seeds;
    };
    expect(scamRate(0, 400)).toBeGreaterThan(0.35 - 0.07);
    expect(scamRate(0, 400)).toBeLessThan(0.35 + 0.07);
    expect(scamRate(10, 400)).toBeGreaterThan(0.03);
    expect(scamRate(10, 400)).toBeLessThan(0.17);
    // и сама формула тоже под замком
    const s0 = createGame(1);
    expect(perekupHonestChance(s0)).toBeCloseTo(0.65, 5);
    s0.skills.trade.level = 10;
    expect(perekupHonestChance(s0)).toBeCloseTo(0.9, 5);
  });
});

describe('прочие правила сбыта', () => {
  it('категорийный фильтр: металлолом не продаётся в ломбард', () => {
    const s = createGame(5);
    const idx = give(s, 'metall_lom');
    expect(saleOffer(s, s.inventory[idx], findBuyer('lombard'))).toBeNull();
    sellEntry(s, idx, 'lombard');
    expect(s.money).toBe(60);
    expect(s.hour).toBe(8);
    expect(s.inventory).toHaveLength(1);
  });

  it('sellableEntries: у каждой точки свой срез ноши', () => {
    const s = createGame(5);
    give(s, 'butylka_steklo', { qty: 3 });                    // только ♻️ (+🕶️)
    give(s, 'sviter_vyazanyy');                               // 🏪🧺🕶️
    give(s, 'tushenka_bez_etiketki');                         // только 🕶️
    giveIdentified(s, 'u_lupa_latunnaya', 800);               // 🏪🧺🕶️
    const myst = give(s, 'u_matreshka_praga', { trueValue: 200 }); // 🧺 после 👁️
    give(s, 'u_videokasseta', { trueValue: 100 });            // только ❓ вслепую
    expect(sellableEntries(s, 'punkt_priema')).toHaveLength(1);
    expect(sellableEntries(s, 'lombard')).toHaveLength(2);
    expect(sellableEntries(s, 'baraholka')).toHaveLength(2); // +1 после оценки
    expect(sellableEntries(s, 'perekup')).toHaveLength(4);   // бутылки+свитер+тушёнка+опознанная лупа
    s.inventory[myst].estimate = { low: 150, high: 350, exact: false, level: 2 };
    expect(sellableEntries(s, 'baraholka')).toHaveLength(3);
  });

  it('детерминизм: один сид — один исход сделки', () => {
    const play = () => {
      const s = createGame(77);
      const idx = giveIdentified(s, 'u_lupa_latunnaya', 900);
      const events = sellEntry(s, idx, 'perekup');
      return { money: s.money, cleanliness: s.stats.cleanliness, events };
    };
    expect(play()).toEqual(play());
  });

  it('мёртвые не торгуют (редьюсер безопасен)', () => {
    const s = createGame(6);
    const idx = give(s, 'sviter_vyazanyy');
    s.status = 'dead';
    const events = sellEntry(s, idx, 'lombard');
    expect(events).toHaveLength(0);
    expect(s.money).toBe(60);
    expect(s.inventory).toHaveLength(1);
  });

  it('хлам за 0 ₽ никто не унесёт (опознанная пустышка)', () => {
    const s = createGame(6);
    const idx = giveIdentified(s, 'u_korobka_berzhnaya', 0);
    for (const b of ['punkt_priema', 'lombard', 'baraholka', 'perekup']) {
      expect(saleOffer(s, s.inventory[idx], findBuyer(b)), b).toBeNull();
    }
  });
});
