/** Monthly date presets, legacy settings, continuous playback and real panel clicks. */
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { DAY_MS, MONTH_NAMES, midMonthMs, midSeasonMs } from '../src/core/clock';
import { TimeControl } from '../src/core/timeControl';
import { DevPanel } from '../src/ui/devPanel';
import { WeatherSystem } from '../src/world/weatherState';

const dom = new JSDOM('<main id="app"></main>', { url: 'https://garden.example/' });
Object.assign(globalThis, { window: dom.window, document: dom.window.document, localStorage: dom.window.localStorage });
const key = 'usadba.timectl.v1';
const originalNow = Date.now;
const real = new Date(2026, 8, 20, 13, 20).getTime();
Date.now = () => real;
try {
  for (const year of [2024, 2026, 2028]) {
    const reference = new Date(year, 6, 1, 12).getTime();
    for (let month = 0; month < 12; month++) {
      const date = new Date(midMonthMs(month, reference));
      assert.equal(date.getMonth(), month);
      assert.equal(date.getDate(), 15);
      assert.equal(date.getHours(), 0);
      assert.ok(Math.abs(date.getTime() - reference) < DAY_MS * 184, 'nearest occurrence, including leap years');
    }
    for (let season = 0; season < 4; season++) {
      assert.equal(new Date(midSeasonMs(season, reference)).getMonth(), [3, 6, 9, 0][season]);
    }
  }
  for (let season = 0; season < 4; season++) {
    localStorage.setItem(key, JSON.stringify({ active: true, hour: 18.5, seasonIndex: season, speed: 0 }));
    const legacy = new TimeControl();
    assert.equal(legacy.state.monthIndex, [3, 6, 9, 0][season]);
    assert.equal(legacy.state.speed, 0, 'stopped playback survives legacy load');
    assert.equal(legacy.compute().hours, 18);
    assert.equal(legacy.compute().minutes, 30);
  }
  localStorage.clear();
  const tc = new TimeControl();
  assert.equal(tc.now(), real);
  tc.enable();
  assert.equal(tc.state.monthIndex, 8, 'enter manual mode in current calendar month');
  tc.setHour(13.5);
  for (let month = 0; month < 12; month++) {
    tc.setMonth(month);
    const date = new Date(tc.now());
    assert.equal(date.getMonth(), month);
    assert.equal(date.getDate(), 15);
    assert.equal(date.getHours(), 13);
    assert.equal(date.getMinutes(), 30);
    assert.equal(tc.compute().seasonIndex, tc.state.seasonIndex);
    const restored = new TimeControl();
    assert.deepEqual(restored.state, tc.state);
    assert.equal(restored.now(), tc.now());
  }
  tc.setSpeed(1);
  const start = tc.now();
  tc.tick(1500);
  assert.equal(tc.now(), start + 1500, 'x1 actually advances');
  tc.setSpeed(0);
  tc.tick(DAY_MS);
  assert.equal(tc.now(), start + 1500);
  assert.equal(new TimeControl().state.speed, 0);
  tc.setSpeed(3000);
  tc.tick((DAY_MS * 80) / 3000);
  assert.equal(tc.now(), start + 1500 + DAY_MS * 80, 'no former 40-day rewind');
  tc.tick((DAY_MS * 365) / 3000);
  assert.equal(tc.now(), start + 1500 + DAY_MS * 445, 'can run across an entire year');
  tc.disable();
  assert.equal(tc.now(), real);
  tc.tick(DAY_MS);
  assert.equal(tc.now(), real);
  const before = JSON.stringify(tc.state);
  tc.setMonth(NaN);
  tc.setSeason(Infinity);
  tc.setHour(NaN);
  tc.setSpeed(-1);
  assert.equal(JSON.stringify(tc.state), before);
  tc.setMonth(-1);
  assert.equal(tc.state.monthIndex, 11);
  tc.setMonth(12);
  assert.equal(tc.state.monthIndex, 0);

  let changes = 0;
  const weather = new WeatherSystem();
  const panel = new DevPanel(document.querySelector('#app')!, tc, weather, {
    onChange() {
      changes++;
    },
  });
  const buttons = [...document.querySelectorAll<HTMLButtonElement>('.dev-chip.month')];
  assert.deepEqual(
    buttons.map((b) => b.textContent),
    [...MONTH_NAMES],
  );
  for (let month = 0; month < 12; month++) {
    const hour = tc.state.hour;
    buttons[month].click();
    assert.ok(tc.state.active);
    assert.equal(tc.state.monthIndex, month);
    assert.equal(tc.state.hour, hour, 'month selection preserves chosen time of day');
    assert.equal(buttons[month].getAttribute('aria-pressed'), 'true');
    assert.equal(document.querySelectorAll('.dev-chip.month.on').length, 1);
    assert.ok(document.querySelector('.dev-date-val')!.textContent!.includes('15'));
    assert.equal(weather.forced, 'auto', 'month button does not force weather');
  }
  assert.equal(changes, 12, 'each click invalidates the scene');
  const seasons = [...document.querySelectorAll<HTMLButtonElement>('.dev-chip.season')];
  seasons.forEach((button, season) => {
    button.click();
    assert.equal(tc.state.monthIndex, [3, 6, 9, 0][season]);
    assert.equal(buttons[tc.state.monthIndex].getAttribute('aria-pressed'), 'true');
  });
  tc.setMonth(11);
  tc.setSpeed(3000);
  tc.tick((22 * DAY_MS) / 3000);
  panel.setOpen(true);
  panel.tick();
  assert.equal(buttons[0].getAttribute('aria-pressed'), 'true', 'highlight follows displayed month during playback');
  tc.disable();
  panel.refresh();
  assert.equal(buttons[8].getAttribute('aria-pressed'), 'true', 'real time restores current month');
  console.log(
    'ок: 12 month buttons, 15th/local hour, season shortcuts, legacy/reload/stop, x1 and continuous year, rollover highlighting, real clock, invalid input and scene refresh',
  );
} finally {
  Date.now = originalNow;
  dom.window.close();
}
