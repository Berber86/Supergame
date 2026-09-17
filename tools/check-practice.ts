/**
 * Проверка логики Школы тишины без браузера.
 *
 *   npx tsx tools/check-practice.ts
 *
 * Сеанс и память практики не знают про DOM, поэтому их можно прогнать
 * напрямую: досрочный выход обязан считаться сеансом, счёт обязан
 * оборачиваться на десяти, хан обязан приходить на своих минутах, битый
 * ключ памяти обязан начинаться с чистого листа, а не ронять игру.
 * Возвращает ненулевой код при любом расхождении.
 */

const store = new Map<string, string>();
const g = globalThis as Record<string, unknown>;
g.localStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
};

let failed = 0;
function check(name: string, cond: boolean, extra = ''): void {
  if (cond) {
    console.log(`  ок   ${name}`);
  } else {
    failed += 1;
    console.log(`  ПАД  ${name}${extra ? ` — ${extra}` : ''}`);
  }
}

async function main(): Promise<void> {
  const { Session } = await import('../src/zen/session');
  const { PRACTICE_BY_ID, LESSONS, PRACTICES } = await import('../src/zen/content');
  const { loadProgress, noteSession, markCareSeen } = await import('../src/zen/progress');

  console.log('сеансы:');
  for (const p of PRACTICES) {
    for (const m of p.minutes) {
      const s = new Session(p, m);
      let t = 0;
      let sawStart = false;
      let sawClose = false;
      let breaths = 0;
      while (t < m * 60000 + 4000) {
        for (const e of s.update(500)) {
          if (e.type === 'start') sawStart = true;
          if (e.type === 'close') sawClose = true;
          if (e.type === 'breath') breaths += 1;
        }
        t += 500;
        if (s.done) break;
      }
      check(
        `${p.id} ${m} мин закрывается по времени`,
        sawStart && sawClose && s.done && Math.abs(s.view.elapsed - m * 60000) < 1000,
        `elapsed=${s.view.elapsed}`,
      );
      if (p.breath) check(`${p.id} дышит (${breaths} фаз)`, breaths > 4, `breaths=${breaths}`);
    }
  }

  console.log('счёт:');
  {
    const s = new Session(PRACTICE_BY_ID.get('count')!, 3);
    const counts: number[] = [];
    let t = 0;
    while (!s.done && t < 200000) {
      for (const e of s.update(250)) if (e.type === 'count') counts.push(e.n);
      t += 250;
    }
    const wrapped = counts.length > 10 && counts[10] === 1;
    const inRange = counts.every((n) => n >= 1 && n <= 10);
    check('счёт идёт 1..10 и оборачивается', wrapped && inRange, counts.slice(0, 12).join(','));
  }

  console.log('хан:');
  {
    const s = new Session(PRACTICE_BY_ID.get('sit')!, 20);
    let hans = 0;
    let t = 0;
    while (!s.done && t < 21 * 60000) {
      for (const e of s.update(1000)) if (e.type === 'han') hans += 1;
      t += 1000;
    }
    check('за 20 минут хан бьёт три раза (5, 10, 15)', hans === 3, `hans=${hans}`);

    const short = new Session(PRACTICE_BY_ID.get('count')!, 3);
    let hans2 = 0;
    let t2 = 0;
    while (!short.done && t2 < 4 * 60000) {
      for (const e of short.update(1000)) if (e.type === 'han') hans2 += 1;
      t2 += 1000;
    }
    check('в трёх минутах хана нет (отмечен пятая)', hans2 === 0, `hans=${hans2}`);
  }

  console.log('досрочный выход:');
  {
    const s = new Session(PRACTICE_BY_ID.get('sit')!, 20);
    for (let t = 0; t < 4 * 60000; t += 500) s.update(500);
    s.finishEarly();
    check('четыре минуты из двадцати — это сеанс на 4 минуты', s.minutesSat() === 4, `${s.minutesSat()}`);
    check('после выхода события не идут', s.update(500).length === 0);

    const blink = new Session(PRACTICE_BY_ID.get('three')!, 1);
    blink.update(900);
    blink.finishEarly();
    check('девять секунд тоже не ноль: минимум одна минута', blink.minutesSat() === 1, `${blink.minutesSat()}`);
  }

  console.log('память:');
  {
    store.clear();
    const p0 = loadProgress();
    check('пустой ключ — чистый лист', p0.minutes === 0 && p0.lessons.length === 0);
    noteSession('sit', 4, 'l1');
    const p1 = loadProgress();
    check('сеанс записан', p1.sessions.sit === 1 && p1.minutes === 4 && p1.lessons.includes('l1'));
    noteSession('sit', 6);
    check('второй сеанс прибавился', loadProgress().minutes === 10 && loadProgress().sessions.sit === 2);
    markCareSeen();
    check('осторожная строка помечена', loadProgress().careSeen === true);

    // битый ключ не роняет игру
    store.set('usadba.practice.v1', '{"minutes":"ой","lessons":7,');
    const p2 = loadProgress();
    check('битый JSON читается как чистый лист', p2.minutes === 0 && Array.isArray(p2.lessons));
  }

  console.log('содержание:');
  {
    check('десять уроков', LESSONS.length === 10, `${LESSONS.length}`);
    check(
      'номера уроков по порядку',
      LESSONS.every((l, i) => l.n === i + 1),
    );
    check(
      'каждый урок ссылается на существующую практику',
      LESSONS.every((l) => PRACTICE_BY_ID.has(l.practice)),
    );
    check(
      'у каждой практики есть строки и длительности',
      PRACTICES.every((p) => p.lines.length > 0 && p.minutes.length > 0),
    );
    check(
      'тексты не пусты и не кричат: без восклицаний',
      LESSONS.every((l) => l.text.every((t) => t.length > 20 && !t.includes('!'))),
    );
  }

  console.log(failed ? `\nПРОВАЛЕНО проверок: ${failed}` : '\nвсе проверки прошли');
  process.exit(failed ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
