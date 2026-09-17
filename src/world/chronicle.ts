/**
 * Летопись усадьбы: тихая память о первых встречах и редких событиях.
 *
 * Не статистика и не журнал достижений: строки, которые сад записывает
 * сам, когда в нём что-то случилось впервые. Чисел здесь нет намеренно —
 * только «весна · год второй · сумерки» и одна фраза.
 *
 * Хранится вместе с садом (каждая усадьба помнит своё), в сохранении —
 * парой [событие, метка времени]; сезон и час выводятся из метки при
 * показе, чтобы не дублировать их в файле.
 */

import { SEASON_NAMES, computeTime, partOfDay } from '../core/clock';

export interface ChronicleEntry {
  /** Идентификатор события из CHRONICLE. */
  id: string;
  /** Метка времени (мс): когда случилось. */
  at: number;
}

export interface ChronicleText {
  /** Строка летописи. */
  text: string;
  /** Иероглиф-печать у строки. */
  kanji: string;
}

export const CHRONICLE: Record<string, ChronicleText> = {
  meet_frog: { kanji: '蛙', text: 'У воды поселилась лягушка. Сидит неподвижно, как камень с глазами.' },
  meet_dragonfly: { kanji: '蜻', text: 'Над прудом застыла стрекоза: крылья держат её на одном месте.' },
  meet_feeder: { kanji: '鳥', text: 'К кормушке пришла первая птица. Огляделась и клюнула раз-другой.' },
  meet_guest: { kanji: '猫', text: 'В сад обошёл второй кот. Пока только смотрит из-за дерева.' },
  guest_stayed: { kanji: '猫', text: 'Гость остался навсегда: у него теперь своя подушка.' },
  chorus: { kanji: '声', text: 'После дождя лягушки пели хором, перебивая друг друга.' },
  flock: { kanji: '群', text: 'Кормушка не пустует: птицы пришли компанией и не ссорились.' },
  cats_greet: { kanji: '礼', text: 'Два кота сели друг напротив друга и молча посмотрели. Никто не уступил.' },
  birds_fled: { kanji: '風', text: 'Кот подобрался к птицам — и кормушка на миг опустела.' },
  bath_splash: { kanji: '湯', text: 'Птица выкупалась в поилке, оставив круги и много шума.' },
  winter_table: { kanji: '雪', text: 'Зимой у кормушки особенно людно: сад кормит своих.' },
  dragonfly_pair: { kanji: '双', text: 'Над прудом сошлись две стрекозы: круг, ещё круг — и снова тишина.' },
  meet_firefly: { kanji: '蛍', text: 'Над травой зажглся первый светлячок: сад светится изнутри.' },
  firefly_dance: { kanji: '灯', text: 'Тёплой ночью после дождя светлячки мигали разом, как один фонарь.' },
  meet_heron: { kanji: '鷺', text: 'К пруду пришла цапля. Стоит, не шелохнувшись: терпенью у неё учиться.' },
  heron_strike: { kanji: '魚', text: 'Цапля ударила по воде и осталась с рыбой. Карпы ушли в глубину.' },
  meet_deer: { kanji: '鹿', text: 'На рассвете к роще вышел олень. Посмотрел на дом — и не испугался.' },
  deer_pair: { kanji: '双', text: 'Олени пришли вдвоём: роща у дома стала почти лесом.' },
};

/** Потолок строк: летопись не должна превращаться в лог. */
export const CHRONICLE_CAP = 80;

export function chronicleText(id: string): ChronicleText | null {
  return CHRONICLE[id] ?? null;
}

/** Дата строки человеческими словами: «весна · год 2 · сумерки». */
export function chronicleDate(at: number): string {
  const t = computeTime(at);
  return `${SEASON_NAMES[t.season].toLowerCase()} · год ${t.year} · ${partOfDay(t)}`;
}

/**
 * Принять событие. Первые встречи не повторяются: строка ложится один
 * раз и остаётся навсегда. Возвращает true, если строка добавилась.
 */
export function noteChronicle(list: ChronicleEntry[], id: string, at: number): boolean {
  if (!CHRONICLE[id]) return false;
  if (list.some((e) => e.id === id)) return false;
  list.push({ id, at });
  if (list.length > CHRONICLE_CAP) list.splice(0, list.length - CHRONICLE_CAP);
  return true;
}
