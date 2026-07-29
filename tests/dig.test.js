/**
 * dig.test.js — тесты сессии 5: обыск баков (находки по лут-таблице,
 * обеднение ×0.5, суточное восполнение, режимы, риски-заглушки),
 * ноша/ёмкость, скрытая цена неопознанного, еда из находок, уличная мелочь.
 * Всё на явных сидах; статистические проверки — на больших выборках сидов.
 */

import { describe, it, expect } from 'vitest';
import { createGame } from '../js/core/state.js';
import { sleep } from '../js/core/time.js';
import {
  travelTo, dig, eat,
  setDigMode, availableDigModes,
  getBinsRecord, binRichness, digRiskChance,
} from '../js/core/actions.js';
import { addItem, rollTrueValue, capacityKg, inventoryUsedKg } from '../js/core/inventory.js';
import { addSkillXp } from '../js/core/skills.js';
import { serialize, deserialize } from '../js/core/persist.js';
import { findItem, findDistrict } from '../js/core/lookups.js';
import { makeRoller } from '../js/core/rng.js';
import { ACTIONS, BINS, CARRY, DECAY, DIG, DIG_MODES, DIG_TROUBLES, EAT, START, TIME } from '../js/data/balance.js';

function newGame(seed = 42) {
  const s = createGame(seed);
  s.weatherId = 'cloud';
  return s;
}

/** Игра в Купчино: 7 баков, скромный риск 8% — рабочая лошадка тестов. */
function gameInKupchino(seed = 42) {
  const s = newGame(seed);
  s.districtId = 'kupchino';
  return s;
}

/** Суммарное количество предметов в ноше. */
const totalQty = (s) => s.inventory.reduce((n, e) => n + e.qty, 0);

describe('dig — обыск баков', () => {
  it('детерминизм: один сид → одни и те же находки и rngState', () => {
    const a = gameInKupchino(7);
    dig(a, 0, []);
    const b = gameInKupchino(7);
    dig(b, 0, []);
    expect(a.inventory).toEqual(b.inventory);
    expect(a.rngState).toBe(b.rngState);
  });

  it('обыск стоит время/энергию/опрятность по ACTIONS.dig', () => {
    const s = gameInKupchino(27);
    dig(s, 0, []);
    expect(s.hour).toBe(TIME.START_HOUR + ACTIONS.dig.hours);
    expect(s.stats.energy).toBeCloseTo(START.energy + ACTIONS.dig.energy + DECAY.energyPerHour * ACTIONS.dig.hours, 5);
    expect(s.stats.cleanliness).toBeCloseTo(START.cleanliness + ACTIONS.dig.cleanliness + DECAY.cleanlinessPerHour * ACTIONS.dig.hours, 5);
  });

  it('находки ложатся в ношу; неопознанному цена бросается при находке (внутри тира) и навсегда', () => {
    for (let seed = 1; seed < 400; seed += 1) {
      const s = gameInKupchino(seed);
      dig(s, 0, []);
      dig(s, 1, []);
      const unid = s.inventory.find((e) => e.trueValue != null);
      if (unid) {
        const item = findItem(unid.itemId);
        expect(unid.identified).toBe(false);
        const inTier = item.guess.tiers.some((t) => unid.trueValue >= t.min && unid.trueValue <= t.max);
        expect(inTier).toBe(true);
        return;
      }
    }
    throw new Error('за 400 сидов ни одного неопознанного — лут-таблица Купчино сломана?');
  });

  it('в районе без баков и у мёртвого — рыться нельзя', () => {
    const s = newGame(19); // ночлежка: 0 баков
    dig(s, 0, []);
    expect(s.hour).toBe(TIME.START_HOUR);
    const dead = gameInKupchino(19);
    dead.status = 'dead';
    dig(dead, 0, []);
    expect(getBinsRecord(dead, 'kupchino').digs[0]).toBe(0); // обыск не зачёлся
    expect(dead.hour).toBe(TIME.START_HOUR);
  });
});

describe('dig — обеднение и восполнение (выбор человека: ×0.5 за повтор)', () => {
  it('счётчик растёт, богатство множится на 0.5', () => {
    const s = gameInKupchino(11);
    expect(binRichness(s, findDistrict('kupchino'), 0)).toBe(1);
    dig(s, 0, []);
    dig(s, 0, []);
    const rec = getBinsRecord(s, 'kupchino');
    expect(rec.digs[0]).toBe(2);
    expect(binRichness(s, findDistrict('kupchino'), 0)).toBeCloseTo(0.25, 10);
    // соседний бак не пострадал
    expect(rec.digs[1]).toBe(0);
    expect(binRichness(s, findDistrict('kupchino'), 1)).toBe(1);
  });

  it('средний улов первого обыска заметно богаче четвёртого (150 сидов)', () => {
    let firstSum = 0;
    let fourthSum = 0;
    const N = 150;
    for (let seed = 1; seed <= N; seed += 1) {
      const s = gameInKupchino(seed * 13 + 5);
      const counts = [];
      for (let k = 0; k < 4; k += 1) {
        const before = totalQty(s);
        dig(s, 0, []);
        counts.push(totalQty(s) - before);
      }
      firstSum += counts[0];
      fourthSum += counts[3];
    }
    expect(firstSum / N).toBeGreaterThan(fourthSum / N + 0.3);
  });

  it('утром баки восполняются (BINS.refillDaily)', () => {
    const s = gameInKupchino(23);
    dig(s, 0, []);
    dig(s, 0, []);
    dig(s, 0, []);
    expect(getBinsRecord(s, 'kupchino').digs[0]).toBe(3);
    s.money = 1000;
    sleep(s, 'nochlezhka', []);
    expect(getBinsRecord(s, 'kupchino').digs[0]).toBe(0);
    expect(binRichness(s, findDistrict('kupchino'), 0)).toBe(1);
  });

  it('полночь посреди обыска: находки зачтутся в новый день (бак успел «обновиться»)', () => {
    const s = gameInKupchino(29);
    s.hour = 23;
    dig(s, 0, []);
    expect(s.day).toBe(2);
    const rec = getBinsRecord(s, 'kupchino');
    expect(rec.day).toBe(2);
    expect(rec.digs[0]).toBe(1);
  });
});

describe('dig — режимы (аккуратнее / обычно / смелее)', () => {
  it('«смелее» закрыт до 🔍 Поиска-3, остальные — с рождения', () => {
    const s = newGame(9);
    const modes = availableDigModes(s);
    expect(modes.find((m) => m.id === 'careful').unlocked).toBe(true);
    expect(modes.find((m) => m.id === 'normal').unlocked).toBe(true);
    expect(modes.find((m) => m.id === 'bold').unlocked).toBe(false);

    setDigMode(s, 'bold', []);
    expect(s.digMode).toBe('normal'); // запертый режим не выставляется

    setDigMode(s, 'careful', []);
    expect(s.digMode).toBe('careful');

    addSkillXp(s, 'search', 90); // level 3
    expect(availableDigModes(s).find((m) => m.id === 'bold').unlocked).toBe(true);
    setDigMode(s, 'bold', []);
    expect(s.digMode).toBe('bold');
  });

  it('режимы влияют на средний улов: смелее > обычно > аккуратнее', () => {
    const N = 160;
    const avgFinds = (mode) => {
      let sum = 0;
      for (let seed = 1; seed <= N; seed += 1) {
        const s = gameInKupchino(seed * 31 + 17);
        s.skills.search.level = 3; // открывает «смелее»; одинаков для всех режимов
        s.digMode = mode;
        const before = totalQty(s);
        dig(s, 0, []);
        sum += totalQty(s) - before;
      }
      return sum / N;
    };
    const careful = avgFinds('careful');
    const normal = avgFinds('normal');
    const bold = avgFinds('bold');
    expect(bold).toBeGreaterThan(normal + 0.15);
    expect(normal).toBeGreaterThan(careful + 0.1);
  });

  it('обыск качает 🔍 Поиск; на 3 уровне — анонс режима «смелее»', () => {
    const s = gameInKupchino(25);
    s.skills.search.xp = 89; // порог уровня 3 (90 xp)
    const events = dig(s, 0, []);
    expect(s.skills.search.level).toBe(3);
    expect(events.some((e) => e.includes('Поиск вырос до уровня 3'))).toBe(true);
    expect(events.some((e) => e.includes('смелее'))).toBe(true);
  });
});

describe('dig — риски (digRisk × погода × режим × навык)', () => {
  it('формула риска с потолком DIG.riskCap', () => {
    const s = newGame(31);
    s.weatherId = 'sun'; // digRiskMult ×1.1
    s.skills.search.level = 3;
    const prom = findDistrict('promzona'); // digRisk 0.3
    const p = digRiskChance(s, prom, { riskMult: DIG_MODES.bold.riskMult });
    const expected = Math.min(DIG.riskCap, 0.3 * 1.1 * DIG_MODES.bold.riskMult * Math.pow(DIG.searchRiskMultPerLevel, 3));
    expect(p).toBeCloseTo(expected, 10);
    expect(p).toBeLessThanOrEqual(DIG.riskCap);
  });

  it('частота неприятностей ≈ риск района (Купчино 8%, облачно, «обычно», 400 сидов)', () => {
    let hits = 0;
    const N = 400;
    for (let seed = 1; seed <= N; seed += 1) {
      const s = gameInKupchino(seed * 101 + 3);
      const events = dig(s, 0, []);
      if (DIG_TROUBLES.some((t) => events.some((e) => e.includes(t.emoji)))) hits += 1;
    }
    expect(hits / N).toBeGreaterThan(0.08 - 0.04);
    expect(hits / N).toBeLessThan(0.08 + 0.04);
  });

  it('неприятности-заглушки НЕ убивают (здоровье не ниже 1 — до сессии 8)', () => {
    for (let seed = 1; seed <= 200; seed += 1) {
      const s = gameInKupchino(seed * 7 + 1);
      s.stats.health = 1;
      dig(s, 0, []);
      dig(s, 1, []);
      expect(s.status).toBe('alive');
      expect(s.stats.health).toBeGreaterThanOrEqual(1);
    }
  });
});

describe('inventory — ноша и ёмкость', () => {
  it('ёмкость = база + бонус за 💪; лишнее не влезает', () => {
    const s = newGame(3);
    expect(capacityKg(s)).toBe(CARRY.baseKg);
    expect(addItem(s, 'radiola_vega').fit).toBe(true); // 4 кг — влезает
    expect(addItem(s, 'radiola_vega', { qty: 2 }).fit).toBe(false); // +8 кг — нет
    expect(inventoryUsedKg(s)).toBeCloseTo(4, 5);
    addSkillXp(s, 'stamina', 40); // level 2 → +10 кг
    expect(capacityKg(s)).toBe(CARRY.baseKg + 2 * CARRY.staminaBonusKg);
  });

  it('обычное стакается; неопознанное — каждая находка отдельная лотерея', () => {
    const s = newGame(5);
    addItem(s, 'butylka_steklo');
    addItem(s, 'butylka_steklo');
    expect(s.inventory.length).toBe(1);
    expect(s.inventory[0].qty).toBe(2);
    addItem(s, 'u_videokasseta', { trueValue: 30 });
    addItem(s, 'u_videokasseta', { trueValue: 100 });
    expect(s.inventory.filter((e) => e.itemId === 'u_videokasseta').length).toBe(2);
  });

  it('в полный пакет находка не лезет: обыск честно говорит об этом', () => {
    for (let seed = 1; seed < 200; seed += 1) {
      const s = gameInKupchino(seed);
      addItem(s, 'utyug_sssr', { qty: 2 }); // 5 кг — под завязку
      expect(inventoryUsedKg(s)).toBeGreaterThanOrEqual(CARRY.baseKg);
      const events = dig(s, 0, []);
      if (events.some((e) => e.includes('Пакет полон'))) {
        expect(s.inventory.filter((e) => e.itemId !== 'utyug_sssr').length).toBe(0);
        return;
      }
      // находок не было — пробуем следующий сид
      expect(s.inventory.length).toBe(1);
    }
    throw new Error('за 200 сидов не случилось «находка в полный пакет»');
  });

  it('лучшая находка жизни запоминается для эпилога', () => {
    const s = newGame(33);
    addItem(s, 'butylka_steklo');
    expect(s.bestItemLabel).toContain('бутылк');
    addItem(s, 'med_provod');
    expect(s.bestItemLabel).toContain('медн');
    addItem(s, 'pet_butilka');
    expect(s.bestItemLabel).toContain('медн'); // не переопределяется мелочью
  });
});

describe('rollTrueValue — тайная цена неопознанного', () => {
  it('3000 бросков: значения строго в тирах, крайние тиры выпадают', () => {
    const item = findItem('u_korobka_berzhnaya'); // тиры 0–60 / 150–600 / 800–2000 / 2500–4500
    const roller = makeRoller(1);
    let sawTrash = false;
    let sawRare = false;
    for (let i = 0; i < 3000; i += 1) {
      const v = rollTrueValue(item, roller);
      const inTier = item.guess.tiers.some((t) => v >= t.min && v <= t.max);
      expect(inTier).toBe(true);
      if (v <= 60) sawTrash = true;
      if (v >= 2500) sawRare = true;
    }
    expect(sawTrash).toBe(true);
    expect(sawRare).toBe(true);
  });
});

describe('eat — еда из находок', () => {
  it('кормит по satiety предмета и убывает из ноши', () => {
    const s = newGame(15);
    s.stats.satiety = 40;
    addItem(s, 'baton_zasohshiy', { qty: 2 });
    const events = eat(s, 'baton_zasohshiy', []);
    expect(s.stats.satiety).toBeCloseTo(40 + 15, 5);
    expect(s.inventory[0].qty).toBe(1);
    expect(events.some((e) => e.includes('🍽️'))).toBe(true);
    eat(s, 'baton_zasohshiy', []);
    expect(s.inventory.length).toBe(0);
  });

  it('нельзя съесть утюг или то, чего нет в ношe', () => {
    const s = newGame(17);
    addItem(s, 'utyug_sssr');
    eat(s, 'utyug_sssr', []);
    eat(s, 'baton_zasohshiy', []);
    expect(s.inventory.length).toBe(1);
    expect(s.stats.satiety).toBe(START.satiety);
  });

  it('рискованная тушёнка иногда мстит (−EAT.riskyFindDamage ❤️)', () => {
    for (let seed = 1; seed < 200; seed += 1) {
      const s = newGame(seed);
      addItem(s, 'tushenka_bez_etiketki'); // healthRisk 0.15
      const events = eat(s, 'tushenka_bez_etiketki', []);
      if (events.some((e) => e.includes('протест'))) {
        expect(s.stats.health).toBeCloseTo(START.health - EAT.riskyFindDamage, 5);
        return;
      }
    }
    throw new Error('тушёнка с риском 0.15 ни разу не сработала за 200 сидов?');
  });

  it('мёртвые не едят', () => {
    const s = newGame(35);
    addItem(s, 'baton_zasohshiy');
    s.status = 'dead';
    eat(s, 'baton_zasohshiy', []);
    expect(s.inventory.length).toBe(1);
  });
});

describe('travel — уличная мелочь (усмотрение агента из сессии 4)', () => {
  it('частота находок на дороге ≈ BINS.streetFindChance (400 переходов)', () => {
    let finds = 0;
    const N = 400;
    for (let seed = 1; seed <= N; seed += 1) {
      const s = newGame(seed * 191 + 29);
      const events = travelTo(s, 'nevsky', []);
      if (events.some((e) => e.includes('✨'))) finds += 1;
    }
    expect(finds / N).toBeGreaterThan(BINS.streetFindChance - 0.04);
    expect(finds / N).toBeLessThan(BINS.streetFindChance + 0.04);
  });

  it('уличная находка лежит в ношe и из таблицы streetLoot', () => {
    const valid = new Set(BINS.streetLoot.map((l) => l.itemId));
    for (let seed = 1; seed < 500; seed += 1) {
      const s = newGame(seed * 53 + 1);
      const events = travelTo(s, 'nevsky', []);
      if (events.some((e) => e.includes('✨'))) {
        expect(s.inventory.length).toBe(1);
        expect(valid.has(s.inventory[0].itemId)).toBe(true);
        return;
      }
    }
    throw new Error('ни одной уличной находки — streetLoot сломан?');
  });
});

describe('persist — нормализация старых сейвов', () => {
  it('сейв сессии 4 (без bins/digMode) дочитывается и играбелен', () => {
    const s = newGame(21);
    const legacy = JSON.parse(serialize(s));
    delete legacy.bins;
    delete legacy.digMode;
    const restored = deserialize(JSON.stringify(legacy));
    expect(restored).not.toBeNull();
    expect(restored.bins).toEqual({});
    expect(restored.digMode).toBe('normal');

    restored.districtId = 'kupchino';
    dig(restored, 0, []);
    expect(getBinsRecord(restored, 'kupchino').digs[0]).toBe(1);
  });
});
