/**
 * Точка входа приложения.
 * S4: idle-петля (клик, слуги, здания, сейв/офлайн-доход).
 * S6: рейд-петля в UI — вылет, выбор реликвий, синергии, босс, победа/поражение.
 * Разметка рейда вынесена в `ui/raid-panel.ts`, логика — в `raid/`.
 */

import './style.css';

import { EventBus, GameEvents } from './core/events';
import { computeOfflineMs, createInitialState, loadState, saveState, clearState } from './core/save';
import { clampGold } from './economy/pacing';
import { applyClick, computeIncome } from './economy/gold';
import { buyBuilding, buyServant, getBuildingCost, getServantCost } from './economy/purchases';
import { BUILDINGS } from './content/buildings';
import { SERVANTS } from './content/servants';
import { KINGDOMS } from './content/kingdoms';
import { chooseRelic, isVictory, resolveBoss, retreat, startRaid } from './raid/raid';
import { renderCollection, renderRaidPanel } from './ui/raid-panel';
import { formatSynergyBonus } from './raid/raid-ui';
import type { GameState } from './core/types';

const bus = new EventBus();
let state: GameState = loadState() ?? createInitialState();
let tickTimer = 0;

// ----- Логика -----

function startTicking(): void {
  window.clearInterval(tickTimer);
  tickTimer = window.setInterval(() => {
    const rates = computeIncome(state, SERVANTS, BUILDINGS);
    state.gold = clampGold(state.gold + rates.perSecond);
    render();
    saveState(state);
  }, 1000);
}

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
  saveState(state);
}

function onBuyServant(servantId: string): void {
  const ok = buyServant(state, servantId, SERVANTS);
  if (ok) {
    bus.emit(GameEvents.stateChanged, state);
    render();
    saveState(state);
  }
}

function onBuyBuilding(buildingId: string): void {
  const ok = buyBuilding(state, buildingId, BUILDINGS);
  if (ok) {
    bus.emit(GameEvents.stateChanged, state);
    render();
    saveState(state);
  }
}

function onReset(): void {
  if (!confirm('Начать новую пещеру? Весь прогресс будет потерян.')) return;
  clearState();
  state = createInitialState();
  render();
  saveState(state);
}

function onStartRaid(kingdomId: string): void {
  if (startRaid(state, kingdomId)) commit();
}

function onChooseRelic(relicId: string): void {
  if (chooseRelic(state, relicId)) commit();
}

function onBoss(): void {
  const result = resolveBoss(state);
  commit();

  const synergyText =
    result.synergies.length > 0
      ? `\nСработали синергии: ${result.synergies.map((s) => `${s.name} (${formatSynergyBonus(s)})`).join(', ')}.`
      : '';

  if (result.win) {
    const victory = result.allKingdomsTaken
      ? '\n\n👑 Все три королевства захвачены. Ты — Повелитель Области!'
      : '';
    alert(`Победа! Урон ${result.damageDealt} против ${result.bossHp} HP. Добыча: ${result.loot} золота.${synergyText}${victory}`);
  } else {
    alert(`Поражение. Урон ${result.damageDealt}, у босса осталось ${result.remainingHp} HP. Потеряно ${result.goldLost} золота.${synergyText}\n\nСовет: подкачай пещеру и собирай реликвии одного семейства — синергии решают.`);
  }
}

function onRetreat(): void {
  retreat(state);
  commit();
}

/** Общий пост-экшн: перерисовать и сохранить. */
function commit(): void {
  bus.emit(GameEvents.stateChanged, state);
  render();
  saveState(state);
}

// ----- Рендер -----

function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

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
      .slice(0, 6)
      .map((entry) => `<li>${escapeHtml(entry)}</li>`)
      .join('');
  }

  // Динамические списки слуг
  const servantsListEl = document.getElementById('servants-list');
  if (servantsListEl) {
    servantsListEl.innerHTML = SERVANTS.map((s) => {
      const owned = state.servants.find((o) => o.id === s.id)?.count ?? 0;
      const cost = getServantCost(s, owned);
      const canBuy = state.gold >= cost;
      return `
        <li class="shop-item">
          <div>
            <strong>${s.name}</strong><br>
            <span class="small">${s.desc}</span><br>
            <span class="muted">Владеешь: ${owned} • +${s.baseIncome.toFixed(2)}/с каждый</span>
          </div>
          <div class="shop-actions">
            <button class="buy-btn" data-servant="${s.id}" ${canBuy ? '' : 'disabled'}>
              Нанять за ${cost} 💰
            </button>
          </div>
        </li>
      `;
    }).join('');
  }

  // Динамические здания
  const buildingsListEl = document.getElementById('buildings-list');
  if (buildingsListEl) {
    buildingsListEl.innerHTML = BUILDINGS.map((b) => {
      const ownedLevel = state.buildings.find((o) => o.id === b.id)?.level ?? 0;
      const cost = getBuildingCost(b, ownedLevel);
      const canBuy = state.gold >= cost;
      const mult = (1 + b.multiplier * ownedLevel).toFixed(1);
      return `
        <li class="shop-item">
          <div>
            <strong>${b.name}</strong> (ур. ${ownedLevel})<br>
            <span class="small">${b.desc}</span><br>
            <span class="muted">Множитель дохода: ×${mult}</span>
          </div>
          <div class="shop-actions">
            <button class="buy-btn" data-building="${b.id}" ${canBuy ? '' : 'disabled'}>
              Улучшить за ${cost} 💰
            </button>
          </div>
        </li>
      `;
    }).join('');
  }

  // Панель рейда и коллекция реликвий
  const raidEl = document.getElementById('raid-panel');
  if (raidEl) raidEl.innerHTML = renderRaidPanel(state);

  const collectionEl = document.getElementById('collection');
  if (collectionEl) collectionEl.innerHTML = renderCollection(state);

  // Прогресс королевств (превью)
  const kingdomsEl = document.getElementById('kingdoms-preview');
  if (kingdomsEl) {
    const done = KINGDOMS.filter((k) => state.kingdomProgress[k.id]).length;
    kingdomsEl.textContent = isVictory(state)
      ? `${done} / ${KINGDOMS.length} — победа!`
      : `${done} / ${KINGDOMS.length} захвачено`;
  }
}

function mount(): void {
  const app = document.getElementById('app');
  if (!app) return;

  app.innerHTML = `
    <main class="shell">
      <header class="hero">
        <h1>🐉 Драконьи рейды</h1>
        <p class="subtitle">Королевства завоеваний — копи золото, нанимай слуг, захватывай королевства.</p>
      </header>

      <section class="panel cave-panel">
        <h2>🕳️ Пещера</h2>
        <div class="gold-row">
          <p>Золото: <strong id="gold">0</strong> <span id="income" class="muted"></span></p>
          <button id="click-gold" class="big-btn">💰 Схватить золото!</button>
        </div>
        <p class="hint">Захвачено королевств: <span id="kingdoms-preview">0 / 3</span></p>
        <button id="reset-btn" class="reset-btn">Начать заново</button>
      </section>

      <section class="panel shop-panel">
        <h2>👥 Слуги</h2>
        <ul id="servants-list" class="shop-list"></ul>
      </section>

      <section class="panel shop-panel">
        <h2>🏰 Здания</h2>
        <ul id="buildings-list" class="shop-list"></ul>
      </section>

      <section class="panel raid-panel">
        <h2>🗺️ Рейды</h2>
        <div id="raid-panel"></div>
      </section>

      <section class="panel">
        <h2>🏺 Коллекция реликвий</h2>
        <div id="collection"></div>
      </section>

      <section class="panel">
        <h2>📜 Дневник дракона</h2>
        <ul id="journal" class="list"></ul>
      </section>

      <footer class="footer-hint">
        Перезагрузи страницу — прогресс сохранится. Слуги продолжают работать!
      </footer>
    </main>
  `;

  // Статические слушатели
  document.getElementById('click-gold')?.addEventListener('click', onGoldClick);
  document.getElementById('reset-btn')?.addEventListener('click', onReset);

  // Делегирование для динамических кнопок покупок
  app.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    const servantId = target.getAttribute('data-servant');
    const buildingId = target.getAttribute('data-building');
    const raidId = target.getAttribute('data-raid');
    const relicId = target.getAttribute('data-relic');

    if (servantId) onBuyServant(servantId);
    else if (buildingId) onBuyBuilding(buildingId);
    else if (raidId) onStartRaid(raidId);
    else if (relicId) onChooseRelic(relicId);
    else if (target.id === 'boss-btn') onBoss();
    else if (target.id === 'retreat-btn') onRetreat();
  });

  render();
}

// ----- Инициализация -----

mount();
applyOfflineIncome();
render();
saveState(state);
startTicking();

window.addEventListener('beforeunload', () => saveState(state));

// Подписки на события (для будущего расширения)
bus.on(GameEvents.goldChanged, () => render());
bus.on(GameEvents.journalAdded, () => render());
bus.on(GameEvents.stateChanged, () => render());
