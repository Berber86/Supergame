import { ECONOMY, STARTER_TEMPLATE_IDS } from '../data/economy';
import { STONE_AGE_UNITS, findTemplate } from '../data/units';
import { findNode, getEvolutionThreshold } from '../data/evolution-tree';
import {
  createRosterUnitFromTemplate,
  isDeployable,
  type RosterUnit,
} from './RosterUnit';

/** Расстановка игрока в конкретной волне: ростер-id + позиция на гекс-сетке. */
export interface PlayerDeploymentEntry {
  rosterId: string;
  col: number;
  row: number;
}

/** Отчёт по одному юниту после боя (для начисления последствий). */
export interface UnitBattleReport {
  rosterId: string;
  endHp: number;
  survived: boolean;
}

export interface VictoryOutcome {
  income: number;
}

/**
 * Кампания: долгоживущее мета-состояние (ростер, валюта, волна) + операции
 * найма/лечения/начисления дохода + сохранение в LocalStorage.
 *
 * Не зависит от Phaser — чистая логика. Сцены читают/меняют её и вызывают save().
 */
export class Campaign {
  roster: RosterUnit[] = [];
  currency = 0;
  wave = 1;
  /** Идентификаторы ростер-юнитов, выбранных для текущей волны. */
  selectedIds: string[] = [];
  nextId = 1;

  // ---------- Создание ----------

  static newGame(): Campaign {
    const c = new Campaign();
    c.currency = ECONOMY.STARTING_CURRENCY;
    c.wave = 1;
    for (const tplId of STARTER_TEMPLATE_IDS) c.roster.push(c.inst(tplId));
    return c;
  }

  private inst(tplId: string): RosterUnit {
    return createRosterUnitFromTemplate(findTemplate(tplId), this.newId());
  }

  private newId(): string {
    return 'ru' + this.nextId++;
  }

  // ---------- Доступ ----------

  get(id: string): RosterUnit | undefined {
    return this.roster.find((u) => u.id === id);
  }

  deployable(): RosterUnit[] {
    return this.roster.filter(isDeployable);
  }

  freeSlots(): number {
    return ECONOMY.ROSTER_LIMIT - this.roster.length;
  }

  worldEpochScore(): number {
    if (this.roster.length === 0) return 1.0;
    const sum = this.roster.reduce((acc, ru) => acc + ru.epochIndex, 0);
    return Math.max(1, Math.min(8, sum / this.roster.length));
  }

  // ---------- Найм ----------

  canHire(): { ok: boolean; reason?: string } {
    if (this.freeSlots() <= 0) return { ok: false, reason: 'Нет свободных слотов' };
    if (this.currency < ECONOMY.HIRE_COST)
      return { ok: false, reason: 'Недостаточно валюты' };
    return { ok: true };
  }

  hire(templateId: string): { ok: boolean; reason?: string } {
    const check = this.canHire();
    if (!check.ok) return check;
    if (!STONE_AGE_UNITS.some((u) => u.id === templateId))
      return { ok: false, reason: 'Неизвестный юнит' };
    this.currency -= ECONOMY.HIRE_COST;
    this.roster.push(createRosterUnitFromTemplate(findTemplate(templateId), this.newId()));
    return { ok: true };
  }

  // ---------- Лечение ----------

  healCost(ru: RosterUnit): number {
    const missing = ru.maxHp - ru.currentHp;
    if (missing <= 0) return 0;
    return Math.max(ECONOMY.HEAL_MIN_COST, Math.round(missing * ECONOMY.HEAL_COST_PER_HP));
  }

  heal(id: string): { ok: boolean; reason?: string; cost?: number } {
    const ru = this.get(id);
    if (!ru) return { ok: false, reason: 'Нет юнита' };
    const cost = this.healCost(ru);
    if (cost <= 0) return { ok: false, reason: 'Не нуждается в лечении' };
    if (this.currency < cost) return { ok: false, reason: 'Недостаточно валюты' };
    this.currency -= cost;
    ru.currentHp = ru.maxHp;
    return { ok: true, cost };
  }

  healAllCost(): number {
    let sum = 0;
    for (const ru of this.roster) sum += this.healCost(ru);
    return sum;
  }

  // ---------- Исход волны ----------

  /**
   * Победа: начисляем доход, фиксируем текущий HP из боя, даём опыт, волна +1.
   * Возвращает итоговый доход для отображения.
   */
  applyVictory(report: UnitBattleReport[]): VictoryOutcome {
    const income = ECONOMY.incomeBase(this.wave) + ECONOMY.victoryBonus(this.wave);
    for (const r of report) {
      const ru = this.get(r.rosterId);
      if (!ru) continue;
      ru.currentHp = Math.max(0, Math.min(ru.maxHp, Math.round(r.endHp)));
      ru.battleExperience += ECONOMY.XP_PARTICIPATION;
      if (r.survived) ru.battleExperience += ECONOMY.XP_SURVIVAL;
    }
    this.currency += income;
    this.wave += 1;
    return { income };
  }

  evolveUnit(rosterId: string, targetTemplateId: string): { ok: boolean; reason?: string } {
    const ru = this.get(rosterId);
    if (!ru) return { ok: false, reason: 'Юнит не найден' };

    const node = findNode(ru.templateId);
    if (!node) return { ok: false, reason: 'Дерево эволюции не найдено для этого юнита' };

    const threshold = getEvolutionThreshold(ru.epochIndex);
    if (ru.battleExperience < threshold) {
      return { ok: false, reason: 'Недостаточно опыта для эволюции' };
    }

    if (!node.nextNodes.includes(targetTemplateId)) {
      return { ok: false, reason: 'Недопустимая ветка эволюции' };
    }

    const targetNode = findNode(targetTemplateId);
    if (!targetNode) return { ok: false, reason: 'Шаблон цели эволюции не найден' };

    const cost = targetNode.evolutionCost;
    if (this.currency < cost) {
      return { ok: false, reason: 'Недостаточно валюты' };
    }

    // Тратим валюту
    this.currency -= cost;

    // Меняем статы и данные юнита
    ru.templateId = targetNode.id;
    ru.name = targetNode.name;
    ru.role = targetNode.role;
    ru.combatRole = targetNode.combatRole;
    ru.maxHp = targetNode.hp;
    ru.atk = targetNode.atk;
    ru.def = targetNode.def;
    ru.atkSpeed = targetNode.atkSpeed;
    ru.range = targetNode.range;
    ru.move = targetNode.move;
    ru.description = targetNode.description;
    ru.specialAbility = targetNode.special_ability;

    // Эволюция исцеляет и сбрасывает опыт
    ru.currentHp = targetNode.hp;
    ru.battleExperience = 0;
    ru.epochIndex = targetNode.epoch;

    if (!ru.evolutionHistory) {
      const prevTemplate = findTemplate(ru.templateId);
      ru.evolutionHistory = prevTemplate ? [prevTemplate.name] : [ru.name];
    }
    if (!ru.evolutionHistory.includes(targetNode.name)) {
      ru.evolutionHistory.push(targetNode.name);
    }

    return { ok: true };
  }

  /**
   * Поражение: без потери валюты и юнитов — состав/позиции можно пробовать заново.
   * HP ростера НЕ меняем (боевой урон не «прилипает» при поражении).
   */
  applyDefeat(): void {
    // Намеренно ничего не меняем.
  }

  // ---------- Персистентность ----------

  save(): void {
    try {
      const data = {
        version: 2,
        currency: this.currency,
        wave: this.wave,
        nextId: this.nextId,
        roster: this.roster,
        selectedIds: this.selectedIds,
      };
      globalThis.localStorage.setItem(ECONOMY.SAVE_KEY, JSON.stringify(data));
    } catch {
      // LocalStorage может быть недоступен (приватный режим / квота) — игра
      // продолжается в памяти, просто без сохранения.
    }
  }

  static load(): Campaign {
    try {
      const raw = globalThis.localStorage.getItem(ECONOMY.SAVE_KEY);
      if (!raw) return Campaign.newGame();
      const data = JSON.parse(raw);
      if (!data || ![1, 2].includes(data.version) || !Array.isArray(data.roster)) {
        return Campaign.newGame();
      }
      const c = new Campaign();
      c.currency = Number(data.currency) || 0;
      c.wave = Number(data.wave) || 1;
      c.nextId = Number(data.nextId) || 1;
      c.roster = data.roster as RosterUnit[];
      c.selectedIds = Array.isArray(data.selectedIds) ? data.selectedIds : [];
      // Санитизация и миграция сейвов Этапа 3: подтягиваем рассчитанные статы,
      // новую классификацию и способность, сохраняя долю текущего здоровья.
      for (const ru of c.roster) {
        if (typeof ru.currentHp !== 'number') ru.currentHp = ru.maxHp;
        if (typeof ru.battleExperience !== 'number') ru.battleExperience = 0;
        try {
          const tpl = findTemplate(ru.templateId);
          const hpRatio = ru.maxHp > 0 ? Math.max(0, Math.min(1, ru.currentHp / ru.maxHp)) : 1;
          if (data.version === 1) {
            ru.name = tpl.name;
            ru.role = tpl.role;
            ru.maxHp = tpl.hp;
            ru.atk = tpl.atk;
            ru.def = tpl.def;
            ru.atkSpeed = tpl.atkSpeed;
            ru.range = tpl.range;
            ru.move = tpl.move;
            ru.currentHp = Math.round(tpl.hp * hpRatio);
          }
          ru.epochIndex = tpl.epochIndex ?? ru.epochIndex ?? 1;
          ru.combatRole = tpl.combatRole ?? ru.combatRole;
          ru.description = tpl.description;
          ru.specialAbility = tpl.specialAbility;
          if (!ru.evolutionHistory) {
            ru.evolutionHistory = [ru.name];
          }
        } catch {
          ru.epochIndex = typeof ru.epochIndex === 'number' ? ru.epochIndex : 1;
        }
      }
      c.nextId = Math.max(c.nextId, c.roster.length + 1);
      return c;
    } catch {
      return Campaign.newGame();
    }
  }

  static clearSave(): void {
    try {
      globalThis.localStorage.removeItem(ECONOMY.SAVE_KEY);
    } catch {
      // игнорируем
    }
  }
}
