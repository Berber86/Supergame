/**
 * events.test.js — точечные модальные события дня (сессия 8).
 * Расписание (≤1/день, ~80% дней — ответ человека 2A), срабатывание по часу,
 * весь словарь эффектов из js/data/events.js, доступность вариантов, смерть
 * от риска, перенос рабочего состояния модалки через сейв.
 * Сиды для исходов riskHealth ищем циклом — как в dig/trade тестах.
 */

import { describe, it, expect } from 'vitest';
import { createGame } from '../js/core/state.js';
import { addItem } from '../js/core/inventory.js';
import { advanceHours, sleep } from '../js/core/time.js';
import { binRichness } from '../js/core/actions.js';
import { applyEventChoice, choiceAvailability, findEvent } from '../js/core/events.js';
import { serialize, deserialize } from '../js/core/persist.js';
import { findDistrict, findWeather } from '../js/core/lookups.js';
import { EVENT_DAY, DECAY } from '../js/data/balance.js';

/** Игра с навязанным событием в модалке. */
function withEvent(eventId, seed = 21) {
  const s = createGame(seed);
  s.pendingEvent = { eventId };
  return s;
}

describe('📅 расписание: не чаще раза в день, точечно', () => {
  it('утром день получает час события в [10..21] или тишину', () => {
    const s = createGame(31);
    sleep(s, 'lavka');
    if (s.eventAtHour != null) {
      expect(s.eventAtHour).toBeGreaterThanOrEqual(EVENT_DAY.earliestHour);
      expect(s.eventAtHour).toBeLessThanOrEqual(EVENT_DAY.latestHour);
    }
  });

  it('вероятность события ≈ 80% (статистика на 150 сидах)', () => {
    let withEvent = 0;
    for (let seed = 1; seed <= 150; seed += 1) {
      const s = createGame(seed);
      sleep(s, 'lavka');
      if (s.eventAtHour != null) withEvent += 1;
    }
    const rate = withEvent / 150;
    expect(rate).toBeGreaterThan(0.65);
    expect(rate).toBeLessThan(0.92);
  });

  it('час наступил — событие постучалось ровно один раз', () => {
    const s = createGame(31);
    s.eventAtHour = 12;
    advanceHours(s, 4); // 8 → 12: стук
    expect(s.pendingEvent).not.toBeNull();
    expect(findEvent(s.pendingEvent.eventId)).toBeTruthy();
    expect(s.eventAtHour).toBeNull(); // расход расписания
    const firedId = s.pendingEvent.eventId;
    advanceHours(s, 3);               // дальше — тишина
    expect(s.pendingEvent.eventId).toBe(firedId);
  });
});

describe('🃏 выборы и их последствия', () => {
  it('🍀 копейка: +1 ₽ и флаг, модалка закрыта', () => {
    const s = withEvent('kopeyka');
    const events = applyEventChoice(s, 'vzyat');
    expect(s.money).toBe(61);
    expect(s.flags.lucky_coin).toBe(true);
    expect(s.pendingEvent).toBeNull();
    expect(events.join(' ')).toContain('копейка');
  });

  it('👮 штраф: −100 ₽, но не глубже кармана (нищих не штрафуют дважды)', () => {
    const rich = withEvent('patrul');
    rich.money = 500;
    applyEventChoice(rich, 'shtraf');
    expect(rich.money).toBe(400);

    const poor = withEvent('patrul');
    poor.money = 40;
    applyEventChoice(poor, 'shtraf');
    expect(poor.money).toBe(0); // отдал всё, зато жив
    expect(poor.pendingEvent).toBeNull();
  });

  it('👮 жертва находкой: предмет ушёл, флаг уважения остался; пустому — нельзя', () => {
    const s = withEvent('patrul');
    addItem(s, 'sviter_vyazanyy');
    const choice = findEvent('patrul').choices.find((c) => c.id === 'otdat');
    expect(choiceAvailability(s, choice).enabled).toBe(true);
    applyEventChoice(s, 'otdat');
    expect(s.inventory).toHaveLength(0);
    expect(s.flags.police_respect).toBe(true);

    const empty = withEvent('patrul');
    expect(choiceAvailability(empty, choice).enabled).toBe(false);
    applyEventChoice(empty, 'otdat');
    expect(empty.pendingEvent).not.toBeNull(); // редьюсер не дал ответить без вещи
  });

  it('👮 бегство: −10⚡ и час минус; лотерея увечья — по сидам обе ветки', () => {
    let hit = null;
    let dodge = null;
    for (let seed = 1; seed <= 400 && (!hit || !dodge); seed += 1) {
      const s = withEvent('patrul', seed);
      const bossHealth = s.stats.health;
      applyEventChoice(s, 'bezhat');
      if (s.stats.health < bossHealth) hit = s;
      else dodge = s;
    }
    expect(hit).not.toBeNull();
    expect(dodge).not.toBeNull();
    expect(hit.stats.health).toBeCloseTo(100 - 10, 5);
    for (const s of [hit, dodge]) {
      expect(s.hour).toBe(9); // потерянный час догоняет всех
      expect(s.pendingEvent).toBeNull();
    }
  });

  it('👮 риск бывает конечной остановкой: смерть от побоев, причина честная', () => {
    let corpse = null;
    for (let seed = 1; seed <= 400 && !corpse; seed += 1) {
      const s = withEvent('patrul', seed);
      s.stats.health = 5;
      applyEventChoice(s, 'bezhat');
      if (s.status === 'dead') corpse = s;
    }
    expect(corpse).not.toBeNull();
    expect(corpse.deathCause).toContain('Патруль');
    expect(corpse.pendingEvent).toBeNull(); // модалка не висит над трупом
  });

  it('🧓 суп бабушки: +20 🍞 +10 🔥 и час жизни прошёл', () => {
    const s = withEvent('babushka');
    s.stats.satiety = 40;
    applyEventChoice(s, 'sup');
    expect(s.stats.satiety).toBeCloseTo(40 + 20 - 2.5, 5); // еда минус распад часа
    // тепло: +10 супа минус часовой распад (DECAY.warmthPerHour × погода)
    const w = findWeather(s.weatherId);
    expect(s.stats.warmth).toBeCloseTo(80 + 10 + DECAY.warmthPerHour * w.warmthMult, 5);
    expect(s.hour).toBe(9);
    expect(s.flags.grandma_smile).toBe(true);
  });

  it('🧓 вежливый отказ: только умывальные дивиденды', () => {
    const s = withEvent('babushka');
    applyEventChoice(s, 'otkaz');
    expect(s.stats.cleanliness).toBe(55);
    expect(s.hour).toBe(8); // выбор без потери времени — модалка мгновенна
  });

  it('🐕 угостить пса: одна единица еды ушла, друг остался', () => {
    const s = withEvent('sobaka');
    addItem(s, 'tushenka_bez_etiketki', { qty: 2 });
    const choice = findEvent('sobaka').choices.find((c) => c.id === 'korm');
    expect(choiceAvailability(s, choice).enabled).toBe(true);
    applyEventChoice(s, 'korm');
    expect(s.inventory[0].qty).toBe(1); // минус ОДНА штука, не вся стопка
    expect(s.flags.dog_friend).toBe(true);

    const hungry = withEvent('sobaka');
    expect(choiceAvailability(hungry, choice).enabled).toBe(false);
  });

  it('🥷 территория: поделил — час и друг; погнал — враг и риск', () => {
    const delil = withEvent('konkurent');
    applyEventChoice(delil, 'delit');
    expect(delil.flags.rival_friend).toBe(true);
    expect(delil.hour).toBe(9);

    const gnal = withEvent('konkurent', 77);
    applyEventChoice(gnal, 'gnat');
    expect(gnal.flags.rival_enemy).toBe(true);
  });

  it('🌊 ливень: арка — 2 часа; промокнуть — мокрый, но при деле', () => {
    const arka = withEvent('liven');
    applyEventChoice(arka, 'ukrytie');
    expect(arka.hour).toBe(10);

    const mokry = withEvent('liven');
    applyEventChoice(mokry, 'prov');
    expect(mokry.stats.warmth).toBe(60);
    expect(mokry.stats.cleanliness).toBe(40);
    expect(mokry.hour).toBe(8);
  });

  it('📢 МЧС: флаг-подсказка на завтра, и только', () => {
    const s = withEvent('mchs');
    applyEventChoice(s, 'ponyal');
    expect(s.flags.frost_tomorrow_hint).toBe(true);
    expect(s.pendingEvent).toBeNull();
  });

  it('🏥 фельдшер: чинит, но время — деньги', () => {
    const s = withEvent('feldsher');
    s.stats.health = 70;
    applyEventChoice(s, 'osmotr');
    expect(s.stats.health).toBe(85);
    expect(s.hour).toBe(9);
  });

  it('🗺️ слух: завтра жирный район ×1.5, флаг ушедшего слушателя', () => {
    const s = withEvent('sluh');
    applyEventChoice(s, 'zapomnit');
    expect(s.flags.heard_rumor).toBe(true);
    expect(s.dailyBoost).not.toBeNull();
    expect(s.dailyBoost.day).toBe(s.day + 1);
    const district = findDistrict(s.dailyBoost.districtId);
    expect(district.binCount).toBeGreaterThan(0);
    // завтра действительно жирно
    s.day += 1;
    expect(binRichness(s, district, 0)).toBe(EVENT_DAY.rumorRichnessMult);
  });

  it('🚇 контролёры: откупились — тепло, но дорого', () => {
    const s = withEvent('kontrolery');
    s.money = 500;
    applyEventChoice(s, 'shtrafm');
    expect(s.money).toBe(350);
    expect(s.stats.warmth).toBe(95);
  });

  it('⏳ потерянные часы умеют приводить к полуночи (сон из модалки — законно)', () => {
    const s = withEvent('liven');
    s.hour = 22;
    applyEventChoice(s, 'ukrytie'); // −2 ч: 22 → 24 → полночь → сон
    expect(s.day).toBe(2);
    expect(s.hour).toBe(8);
  });
});

describe('💾 модалка переживает перезагрузку страницы', () => {
  it('pendingEvent в сейве — round-trip без потерь', () => {
    const s = withEvent('patrul', 41);
    const restored = deserialize(serialize(s));
    expect(restored.pendingEvent).toEqual({ eventId: 'patrul' });
    // и после рестарта можно ответить как ни в чём не бывало
    applyEventChoice(restored, 'shtraf');
    expect(restored.pendingEvent).toBeNull();
    expect(restored.money).toBe(0); // было 60, штраф собрал что было
  });

  it('сейв с событием-привидением (ренейм данных) — лечится, не падает', () => {
    const s = withEvent('patrul', 41);
    s.pendingEvent = { eventId: 'sushestvuyushchey_net' };
    const restored = deserialize(serialize(s));
    expect(restored.pendingEvent).toBeNull();
  });

  it('расписание вчерашнего дня в сейве не воскресает', () => {
    const s = createGame(41);
    s.eventRolledForDay = 1;
    s.eventAtHour = 15;
    s.day = 2; // «открыл игру наутро»
    const restored = deserialize(serialize(s));
    expect(restored.eventAtHour).toBeNull();
  });
});
