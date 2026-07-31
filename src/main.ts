/**
 * Точка входа приложения.
 * Сессия 3: инфраструктурный каркас — загрузка сейва, игровой тик,
 * минимальный UI (заголовок, золото, кнопка клика, слуги).
 * Полные петли (рейды, синергии, мета) — в сессиях 4–9.
 */

import './style.css';

import { EventBus, GameEvents } from './core/events';
import { computeOfflineMs, createInitialState, loadState, saveState } from './core/save';
import { clampGold } from './economy/pacing';
import { applyClick, computeIncome } from './economy/gold';
import { BUILDINGS } from './content/buildings';
import { SERVANTS } from './content/servants';
import { KINGDOMS } from './content/kingdoms';
import type { GameState } from './core/types';

const bus = new EventBus();
let state: GameState = loadState() ?? createInitialState();
let tickTimer = 0;

/** Основной игровой цикл: пассивный доход раз в секунду + автосейв. */
function startTicking(): void {
  window.clearInterval(tickTimer);
  tickTimer = window.setInterval(() => {
    const rates = computeIncome(state, SERVANTS, BUILDINGS);
    state.gold = clampGold(state.gold + rates.perSecond);
    render();
    saveState(state);
  }, 1000);
}

/** Обработка офлайн-дохода при старте (GDD §3.5: кап 8 часов). */
function applyOfflineIncome(): void {
  const rates = computeIncome(state, SERVANTS, BUILDINGS);
  const offlineMs = computeOfflineMs(state.lastSavedAt, Date.now());
  if (offlineMs > 0) {
    const gained = Math.floor(rates.perSecond * (offlineMs / 1000));
    if (gained > 0) {
      state.gold = clampGold(state.gold + gained);
      state.journal.unshift(
        `Пока ты был в отлучке, слуги накопали ${gained} золота (лимит: 8 часов).`,
      );
      state.journal = state.journal.slice(0, 20);
      bus.emit(GameEvents.journalAdded, state.journal);
    }
  }
}

function onGoldClick(): void {
  const rates = computeIncome(state, SERVANTS, BUILDINGS);
  state.gold = clampGold(applyClick(state, rates));
  bus.emit(GameEvents.goldChanged, state.gold);
  render();
}

// ----- Рендер (временный каркас; полноценный UI — сессии 4+) -----

function render(): void {
  const goldEl = document.getElementById('gold');
  if (goldEl) goldEl.textContent = String(Math.floor(state.gold));

  const incomeEl = document.getElementById('income');
  if (incomeEl) {
    const rates = computeIncome(state, SERVANTS, BUILDINGS);
    incomeEl.textContent = `${rates.perSecond.toFixed(2)} золота/сек`;
  }

  const journalEl = document.getElementById('journal');
  if (journalEl) {
    journalEl.innerHTML = state.journal
      .slice(0, 5)
      .map((entry) => `<li>${escapeHtml(entry)}</li>`)
      .join('');
  }
}

function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function mount(): void {
  const app = document.getElementById('app');
  if (!app) return;

  const kingdomsDone = KINGDOMS.filter((k) => state.kingdomProgress[k.id]).length;

  app.innerHTML = `
    <main class="shell">
      <header class="hero">
        <h1>🐉 Драконьи рейды</h1>
        <p class="subtitle">Королевства завоеваний — королевства, где завоёвывают королевства.</p>
      </header>

      <section class="panel cave-panel">
        <h2>🕳️ Пещера</h2>
        <p>Золото: <strong id="gold">0</strong> <span id="income" class="muted"></span></p>
        <button id="click-gold" class="big-btn">💰 Схватить золото!</button>
        <p class="hint">Захвачено королевств: ${kingdomsDone} из ${KINGDOMS.length}</p>
      </section>

      <section class="panel">
        <h2>👥 Слуги</h2>
        <ul class="list">
          ${SERVANTS.map((s) => `<li>${s.name} — ${s.desc}</li>`).join('')}
        </ul>
      </section>

      <section class="panel">
        <h2>📜 Дневник дракона</h2>
        <ul id="journal" class="list"></ul>
      </section>
    </main>
  `;

  document.getElementById('click-gold')?.addEventListener('click', onGoldClick);
  render();
}

// ----- Инициализация -----

mount();
applyOfflineIncome();
render();
saveState(state);
startTicking();

// Пассивное сохранение при уходе со страницы.
window.addEventListener('beforeunload', () => saveState(state));
