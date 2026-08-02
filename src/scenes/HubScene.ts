import Phaser from 'phaser';
import { CONFIG } from '../config';
import { ECONOMY } from '../data/economy';
import { ROLE_INFO, STONE_AGE_UNITS } from '../data/units';
import { findNode, getEvolutionThreshold } from '../data/evolution-tree';
import { Campaign } from '../meta/Campaign';
import type { Role } from '../entities/types';
import { isDeployable, isDowned, isWounded, type RosterUnit } from '../meta/RosterUnit';
import { campaignOf } from '../meta/session';
import { COLORS } from '../ui/theme';
import { drawRosterCard } from '../ui/RosterCard';
import { makeButton, setButtonEnabled, setButtonLabel } from '../ui/widgets';

const CARD_W = 288;
const CARD_H = 150;
const GRID_X = 56;
const GRID_Y = 96;
const COLS = 4;

/** Сцена Хаба: ростер, найм, лечение, переход к выбору состава. */
export class HubScene extends Phaser.Scene {
  private campaign!: Campaign;
  private currencyText!: Phaser.GameObjects.Text;
  private waveText!: Phaser.GameObjects.Text;
  private slotsText!: Phaser.GameObjects.Text;
  private worldEpochText!: Phaser.GameObjects.Text;
  private worldEpochBg!: Phaser.GameObjects.Rectangle;
  private worldEpochBar!: Phaser.GameObjects.Rectangle;

  private rosterLayer!: Phaser.GameObjects.Container;
  private buttonsLayer!: Phaser.GameObjects.Container;
  private toBattleBtn!: Phaser.GameObjects.Container;
  private healAllBtn!: Phaser.GameObjects.Container;
  private msgText!: Phaser.GameObjects.Text;

  private tooltipBox!: Phaser.GameObjects.Container;
  private tooltipText!: Phaser.GameObjects.Text;

  constructor() {
    super('Hub');
  }

  create(): void {
    this.cameras.main.setBackgroundColor(COLORS.bg);
    this.campaign = campaignOf(this.game.registry);

    this.add
      .text(20, 22, 'THE LONG LINE — Хаб', {
        fontFamily: 'Arial, sans-serif',
        fontSize: '24px',
        fontStyle: 'bold',
        color: '#e5e7eb',
      })
      .setDepth(20);

    this.worldEpochText = this.add
      .text(20, 55, '', {
        fontFamily: 'Arial, sans-serif',
        fontSize: '14px',
        fontStyle: 'bold',
        color: '#94a3b8',
      })
      .setDepth(20);

    this.worldEpochBg = this.add
      .rectangle(20, 78, 240, 8, 0x1e293b)
      .setOrigin(0, 0.5)
      .setDepth(20);
    this.worldEpochBar = this.add
      .rectangle(20, 78, 0, 8, 0x8b5cf6)
      .setOrigin(0, 0.5)
      .setDepth(20);

    this.waveText = this.add
      .text(this.scale.width / 2, 30, '', {
        fontFamily: 'Arial, sans-serif',
        fontSize: '20px',
        fontStyle: 'bold',
        color: '#fbbf24',
      })
      .setOrigin(0.5)
      .setDepth(20);

    this.currencyText = this.add
      .text(this.scale.width - 20, 22, '', {
        fontFamily: 'Arial, sans-serif',
        fontSize: '20px',
        fontStyle: 'bold',
        color: '#86efac',
      })
      .setOrigin(1, 0)
      .setDepth(20);

    this.slotsText = this.add
      .text(this.scale.width - 20, 50, '', {
        fontFamily: 'Consolas, monospace',
        fontSize: '12px',
        color: '#9aa3b2',
      })
      .setOrigin(1, 0)
      .setDepth(20);

    this.msgText = this.add
      .text(this.scale.width / 2, 70, '', {
        fontFamily: 'Arial, sans-serif',
        fontSize: '14px',
        color: '#fca5a5',
      })
      .setOrigin(0.5)
      .setDepth(30)
      .setAlpha(0);

    this.rosterLayer = this.add.container(0, 0).setDepth(5);
    this.buttonsLayer = this.add.container(0, 0).setDepth(10);

    // Нижние кнопки.
    this.toBattleBtn = makeButton(
      this,
      this.scale.width / 2,
      706,
      240,
      56,
      '⚔  В бой',
      () => this.goToBattle(),
      { color: 0x1f6feb, fontSize: 18 },
    );
    this.buttonsLayer.add(this.toBattleBtn);

    makeButton(
      this,
      250,
      706,
      210,
      46,
      `＋  Нанять (${ECONOMY.HIRE_COST})`,
      () => this.openHireModal(),
      { color: 0x334155 },
    );

    this.healAllBtn = makeButton(
      this,
      this.scale.width - 250,
      706,
      210,
      46,
      '✚  Лечить всех',
      () => this.healAll(),
      { color: 0x334155 },
    );

    makeButton(
      this,
      this.scale.width - 70,
      760,
      120,
      30,
      '↺ Новый старт',
      () => this.confirmReset(),
      { color: 0x7f1d1d, fontSize: 12 },
    );

    this.buildRosterTooltip();
    this.refresh();
  }

  // ---------- Перерисовка состояния ----------

  private refresh(): void {
    this.waveText.setText(`Волна ${this.campaign.wave}`);
    this.currencyText.setText(`🪙 ${this.campaign.currency}`);
    
    const worldScore = this.campaign.worldEpochScore();
    this.worldEpochText.setText(`Мировая Эра: ${worldScore.toFixed(2)} ⭐`);
    const pct = Phaser.Math.Clamp((worldScore - 1) / 7, 0, 1);
    this.worldEpochBar.width = Math.round(240 * pct);

    this.slotsText.setText(
      `Ростер: ${this.campaign.roster.length}/${ECONOMY.ROSTER_LIMIT}  •  боеспособных: ${this.campaign.deployable().length}`,
    );
    this.renderRoster();

    const canBattle = this.campaign.deployable().length >= ECONOMY.COMPOSE_MIN;
    setButtonEnabled(this.toBattleBtn, canBattle);

    const healAllCost = this.campaign.healAllCost();
    const lbl = this.healAllBtn.getByName('label') as Phaser.GameObjects.Text;
    lbl.setText(healAllCost > 0 ? `✚  Лечить всех (${healAllCost})` : '✚  Все здоровы');
    setButtonEnabled(this.healAllBtn, healAllCost > 0 && this.campaign.currency >= healAllCost);
  }

  private renderRoster(): void {
    this.rosterLayer.removeAll(true);
    const limit = ECONOMY.ROSTER_LIMIT;
    for (let i = 0; i < limit; i++) {
      const col = i % COLS;
      const row = Math.floor(i / COLS);
      const x = GRID_X + col * (CARD_W + 12);
      const y = GRID_Y + row * (CARD_H + 18);
      const ru = this.campaign.roster[i];
      if (ru) this.drawRosterSlot(ru, x, y);
      else this.drawEmptySlot(x, y);
    }
  }

  private drawRosterSlot(ru: RosterUnit, x: number, y: number): void {
    const { container, bg } = drawRosterCard(this, ru, x, y, { w: CARD_W, h: CARD_H });
    this.rosterLayer.add(container);

    bg.setInteractive({ useHandCursor: true });
    bg.on('pointerover', (pointer: Phaser.Input.Pointer) => {
      this.showRosterTooltip(ru, pointer);
    });
    bg.on('pointerout', () => {
      this.hideRosterTooltip();
    });
    bg.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      this.moveRosterTooltip(pointer);
    });

    const node = findNode(ru.templateId);
    const threshold = getEvolutionThreshold(ru.epochIndex);
    const canEvolve = ru.battleExperience >= threshold && node !== undefined && node.nextNodes.length > 0;
    const needsHeal = isWounded(ru) || isDowned(ru);

    if (needsHeal && canEvolve) {
      // Кнопки рядом друг с другом
      const btnW = (CARD_W - 32) / 2;
      
      const cost = this.campaign.healCost(ru);
      const canHeal = this.campaign.currency >= cost;
      const healBtn = makeButton(
        this,
        x + 8 + btnW / 2,
        y + CARD_H - 16,
        btnW,
        26,
        `✚ Лечить (${cost})`,
        () => this.healOne(ru.id),
        { color: canHeal ? 0x15803d : 0x334155, fontSize: 10 },
      );
      this.rosterLayer.add(healBtn);
      if (!canHeal) setButtonEnabled(healBtn, false);

      const nextNodeId = node!.nextNodes[0];
      const nextNode = findNode(nextNodeId);
      const evoCost = nextNode ? nextNode.evolutionCost : 0;
      const canAfford = this.campaign.currency >= evoCost;
      const evolveBtn = makeButton(
        this,
        x + CARD_W - 8 - btnW / 2,
        y + CARD_H - 16,
        btnW,
        26,
        `⭐ Эра+ (${evoCost})`,
        () => this.evolveOne(ru, node),
        { color: canAfford ? 0x8b5cf6 : 0x334155, fontSize: 10 },
      );
      this.rosterLayer.add(evolveBtn);
      if (!canAfford) setButtonEnabled(evolveBtn, false);

    } else if (needsHeal) {
      // Широкая кнопка лечения
      const cost = this.campaign.healCost(ru);
      const canHeal = this.campaign.currency >= cost;
      const btn = makeButton(
        this,
        x + CARD_W / 2,
        y + CARD_H - 16,
        CARD_W - 24,
        26,
        `✚ Лечить (${cost})`,
        () => this.healOne(ru.id),
        { color: canHeal ? 0x15803d : 0x334155, fontSize: 12 },
      );
      this.rosterLayer.add(btn);
      if (!canHeal) setButtonEnabled(btn, false);

    } else if (canEvolve) {
      // Широкая кнопка эволюции
      const nextNodeId = node!.nextNodes[0];
      const nextNode = findNode(nextNodeId);
      const evoCost = nextNode ? nextNode.evolutionCost : 0;
      const canAfford = this.campaign.currency >= evoCost;
      const btn = makeButton(
        this,
        x + CARD_W / 2,
        y + CARD_H - 16,
        CARD_W - 24,
        26,
        `⭐ Эволюционировать (${evoCost})`,
        () => this.evolveOne(ru, node),
        { color: canAfford ? 0x8b5cf6 : 0x334155, fontSize: 12 },
      );
      this.rosterLayer.add(btn);
      if (!canAfford) setButtonEnabled(btn, false);
    }
  }

  private evolveOne(ru: RosterUnit, node: any): void {
    if (node.nextNodes.length === 1) {
      const nextId = node.nextNodes[0];
      const nextNode = findNode(nextId);
      const cost = nextNode ? nextNode.evolutionCost : 0;
      if (this.campaign.currency < cost) {
        this.showMsg('Недостаточно валюты', '#fca5a5');
        return;
      }
      const res = this.campaign.evolveUnit(ru.id, nextId);
      if (res.ok) {
        this.campaign.save();
        this.refresh();
        this.showMsg(`${ru.name} эволюционировал в ${nextNode?.name}!`, '#86efac');
      } else {
        this.showMsg(res.reason ?? 'Ошибка эволюции', '#fca5a5');
      }
    } else if (node.nextNodes.length === 2) {
      this.openEvolveModal(ru, node);
    }
  }

  private openEvolveModal(ru: RosterUnit, node: any): void {
    const overlay = this.add.container(0, 0).setDepth(60);
    const dim = this.add
      .rectangle(0, 0, this.scale.width, this.scale.height, 0x000000, 0.75)
      .setOrigin(0)
      .setInteractive();
    
    const panelW = 640;
    const panelH = 440;
    const panel = this.add
      .rectangle(this.scale.width / 2, this.scale.height / 2, panelW, panelH, COLORS.panel)
      .setStrokeStyle(3, COLORS.panelEdge);

    const title = this.add
      .text(this.scale.width / 2, this.scale.height / 2 - 180, `Эволюция: Выберите специализацию`, {
        fontFamily: 'Arial, sans-serif',
        fontSize: '22px',
        fontStyle: 'bold',
        color: '#fbbf24',
      })
      .setOrigin(0.5);

    const sub = this.add
      .text(this.scale.width / 2, this.scale.height / 2 - 150, `Превращение ${ru.name} воина следующей эпохи`, {
        fontFamily: 'Arial, sans-serif',
        fontSize: '14px',
        color: '#9aa3b2',
      })
      .setOrigin(0.5);

    overlay.add([dim, panel, title, sub]);

    const optIds = node.nextNodes;
    const options = optIds.map((id: string) => findNode(id)).filter((o: any) => o !== undefined);

    options.forEach((opt: any, idx: number) => {
      const isLeft = idx === 0;
      const cardX = this.scale.width / 2 + (isLeft ? -150 : 150);
      const cardY = this.scale.height / 2 + 10;
      const cardW = 260;
      const cardH = 240;

      const cardContainer = this.add.container(cardX, cardY);
      const cardBg = this.add.rectangle(0, 0, cardW, cardH, 0x1b212f).setStrokeStyle(2, COLORS.panelEdge);
      
      const emblem = this.add.circle(-100, -85, 18, ROLE_INFO[opt.role as Role].color);
      const letter = this.add
        .text(-100, -85, ROLE_INFO[opt.role as Role].letter, {
          fontFamily: 'Arial, sans-serif',
          fontSize: '14px',
          fontStyle: 'bold',
          color: '#0b0e14',
        })
        .setOrigin(0.5);

      const nameText = this.add
        .text(-74, -95, opt.name, {
          fontFamily: 'Arial, sans-serif',
          fontSize: '15px',
          fontStyle: 'bold',
          color: '#e5e7eb',
        })
        .setOrigin(0, 0);

      const roleText = this.add
        .text(-74, -77, `${ROLE_INFO[opt.role as Role].label} Эры ${opt.epoch}`, {
          fontFamily: 'Arial, sans-serif',
          fontSize: '11px',
          color: '#9aa3b2',
        })
        .setOrigin(0, 0);

      const statsX = -100;
      const statsY = -40;
      const hpDiff = opt.hp - ru.maxHp;
      const atkDiff = opt.atk - ru.atk;
      const defDiff = opt.def - ru.def;

      const statLine1 = this.add.text(statsX, statsY,      `HP:  ${ru.maxHp} ➜ ${opt.hp} (${hpDiff >= 0 ? '+' : ''}${hpDiff})`, { fontFamily: 'Consolas, monospace', fontSize: '11px', color: '#86efac' });
      const statLine2 = this.add.text(statsX, statsY + 16, `ATK: ${ru.atk} ➜ ${opt.atk} (${atkDiff >= 0 ? '+' : ''}${atkDiff})`, { fontFamily: 'Consolas, monospace', fontSize: '11px', color: '#cbd5e1' });
      const statLine3 = this.add.text(statsX, statsY + 32, `DEF: ${ru.def} ➜ ${opt.def} (${defDiff >= 0 ? '+' : ''}${defDiff})`, { fontFamily: 'Consolas, monospace', fontSize: '11px', color: '#cbd5e1' });
      const statLine4 = this.add.text(statsX, statsY + 48, `RNG: ${ru.range} ➜ ${opt.range}  •  SPD: ${ru.move} ➜ ${opt.move}`, { fontFamily: 'Consolas, monospace', fontSize: '11px', color: '#9aa3b2' });

      const abilityLine = opt.special_ability
        ? `\n⚡ ${opt.special_ability.name} • CD ${opt.special_ability.cooldown}с`
        : '';
      const descText = this.add.text(-100, statsY + 70, `${opt.description}${abilityLine}`, {
        fontFamily: 'Arial, sans-serif',
        fontSize: '11px',
        color: '#9aa3b2',
        align: 'left',
        wordWrap: { width: cardW - 40 }
      }).setOrigin(0, 0);

      const canAfford = this.campaign.currency >= opt.evolutionCost;
      const chooseBtn = makeButton(
        this,
        0,
        cardH / 2 - 25,
        cardW - 40,
        28,
        `Выбрать (${opt.evolutionCost}🪙)`,
        () => {
          const res = this.campaign.evolveUnit(ru.id, opt.id);
          if (res.ok) {
            this.campaign.save();
            overlay.destroy();
            this.refresh();
            this.showMsg(`${ru.name} эволюционировал в ${opt.name}!`, '#86efac');
          } else {
            this.showMsg(res.reason ?? 'Ошибка эволюции', '#fca5a5');
          }
        },
        { color: canAfford ? 0x8b5cf6 : 0x334155, fontSize: 12 }
      );
      if (!canAfford) setButtonEnabled(chooseBtn, false);

      cardContainer.add([cardBg, emblem, letter, nameText, roleText, statLine1, statLine2, statLine3, statLine4, descText, chooseBtn]);
      overlay.add(cardContainer);
    });

    const closeBtn = makeButton(
      this,
      this.scale.width / 2,
      this.scale.height / 2 + panelH / 2 + 35,
      140,
      32,
      '✕  Отмена',
      () => overlay.destroy(),
      { color: 0x334155, fontSize: 13 }
    );
    overlay.add(closeBtn);
  }

  private drawEmptySlot(x: number, y: number): void {
    const rect = this.add
      .rectangle(x + CARD_W / 2, y + CARD_H / 2, CARD_W, CARD_H, 0x000000, 0.0)
      .setStrokeStyle(2, COLORS.panelEdge, 0.5);
    const t = this.add
      .text(x + CARD_W / 2, y + CARD_H / 2, 'пусто', {
        fontFamily: 'Arial, sans-serif',
        fontSize: '13px',
        color: '#475569',
      })
      .setOrigin(0.5);
    this.rosterLayer.add([rect, t]);
  }

  // ---------- Действия ----------

  private healOne(id: string): void {
    const res = this.campaign.heal(id);
    if (res.ok) {
      this.campaign.save();
      this.refresh();
      this.showMsg('Юнит вылечен', '#86efac');
    } else {
      this.showMsg(res.reason ?? 'Нельзя лечить', '#fca5a5');
    }
  }

  private healAll(): void {
    const cost = this.campaign.healAllCost();
    if (cost <= 0) return;
    if (this.campaign.currency < cost) {
      this.showMsg('Недостаточно валюты', '#fca5a5');
      return;
    }
    for (const ru of this.campaign.roster) {
      if (isWounded(ru) || isDowned(ru)) this.campaign.heal(ru.id);
    }
    this.campaign.save();
    this.refresh();
    this.showMsg(`Все излечены за ${cost}🪙`, '#86efac');
  }

  private goToBattle(): void {
    if (this.campaign.deployable().length < ECONOMY.COMPOSE_MIN) {
      this.showMsg(`Нужно минимум ${ECONOMY.COMPOSE_MIN} боеспособных юнитов`, '#fca5a5');
      return;
    }
    this.scene.start('Composition');
  }

  // ---------- Модалка найма ----------

  private openHireModal(): void {
    const overlay = this.add.container(0, 0).setDepth(60);
    const dim = this.add
      .rectangle(0, 0, this.scale.width, this.scale.height, 0x000000, 0.7)
      .setOrigin(0)
      .setInteractive();
    const panel = this.add
      .rectangle(this.scale.width / 2, this.scale.height / 2, 760, 480, COLORS.panel)
      .setStrokeStyle(3, COLORS.panelEdge);
    const title = this.add
      .text(this.scale.width / 2, this.scale.height / 2 - 210, `Нанять юнита  —  ${ECONOMY.HIRE_COST}🪙`, {
        fontFamily: 'Arial, sans-serif',
        fontSize: '22px',
        fontStyle: 'bold',
        color: '#e5e7eb',
      })
      .setOrigin(0.5);
    const sub = this.add
      .text(this.scale.width / 2, this.scale.height / 2 - 180, '', {
        fontFamily: 'Arial, sans-serif',
        fontSize: '13px',
        color: '#fca5a5',
      })
      .setOrigin(0.5)
      .setName('sub');

    overlay.add([dim, panel, title, sub]);

    STONE_AGE_UNITS.forEach((tpl, i) => {
      const col = i % 3;
      const row = Math.floor(i / 3);
      const bx = this.scale.width / 2 - 250 + col * 250;
      const by = this.scale.height / 2 - 120 + row * 110;
      const card = this.add.container(bx, by, []);
      const bg = this.add.rectangle(0, 0, 230, 92, 0x1b212f).setStrokeStyle(2, COLORS.panelEdge);
      const emblem = this.add.circle(-86, 0, 22, ROLE_INFO[tpl.role].color);
      const letter = this.add
        .text(-86, 0, ROLE_INFO[tpl.role].letter, {
          fontFamily: 'Arial, sans-serif',
          fontSize: '18px',
          fontStyle: 'bold',
          color: '#0b0e14',
        })
        .setOrigin(0.5);
      const name = this.add
        .text(-54, -26, tpl.name, {
          fontFamily: 'Arial, sans-serif',
          fontSize: '14px',
          fontStyle: 'bold',
          color: '#e5e7eb',
        })
        .setOrigin(0, 0.5);
      const stats = this.add
        .text(-54, -4, `HP ${tpl.hp} ATK ${tpl.atk} DEF ${tpl.def}`, {
          fontFamily: 'Consolas, monospace',
          fontSize: '11px',
          color: '#9aa3b2',
        })
        .setOrigin(0, 0.5);
      const role = this.add
        .text(-54, 16, `${ROLE_INFO[tpl.role].label} • RNG ${tpl.range} • SPD ${tpl.move}`, {
          fontFamily: 'Consolas, monospace',
          fontSize: '11px',
          color: '#9aa3b2',
        })
        .setOrigin(0, 0.5);
      card.add([bg, emblem, letter, name, stats, role]);
      // Авто-hit-area Phaser использует реальные 230×92, а не смещённую
      // отрицательную область, которая раньше принимала лишь часть кликов.
      bg.setInteractive({ useHandCursor: true });
      let pressed = false;
      bg.on('pointerover', () => {
        bg.setFillStyle(0x33415c);
        bg.setStrokeStyle(3, 0x64748b);
      });
      bg.on('pointerout', () => {
        pressed = false;
        bg.setFillStyle(0x1b212f);
        bg.setStrokeStyle(2, COLORS.panelEdge);
      });
      bg.on('pointerdown', () => {
        pressed = true;
        bg.setFillStyle(0x111827);
      });
      bg.on('pointerup', () => {
        const shouldHire = pressed;
        pressed = false;
        bg.setFillStyle(0x33415c);
        if (!shouldHire) return;
        const res = this.campaign.hire(tpl.id);
        if (res.ok) {
          this.campaign.save();
          overlay.destroy();
          this.refresh();
          this.showMsg('Юнит нанят', '#86efac');
        } else {
          (overlay.getByName('sub') as Phaser.GameObjects.Text).setText(res.reason ?? 'Невозможно');
        }
      });
      overlay.add(card);
    });

    const close = makeButton(
      this,
      this.scale.width / 2,
      this.scale.height / 2 + 200,
      160,
      40,
      '✕  Закрыть',
      () => overlay.destroy(),
      { color: 0x334155 },
    );
    // makeButton добавляет объект в сцену; включаем его в overlay для общего destroy().
    overlay.add(close);
  }

  // ---------- Сброс кампании ----------

  private confirmReset(): void {
    const overlay = this.add.container(0, 0).setDepth(70);
    const dim = this.add
      .rectangle(0, 0, this.scale.width, this.scale.height, 0x000000, 0.75)
      .setOrigin(0)
      .setInteractive();
    const panel = this.add.rectangle(this.scale.width / 2, this.scale.height / 2, 520, 220, COLORS.panel).setStrokeStyle(3, COLORS.panelEdge);
    const q = this.add
      .text(this.scale.width / 2, this.scale.height / 2 - 40, 'Начать кампанию заново?\nПрогресс будет потерян.', {
        fontFamily: 'Arial, sans-serif',
        fontSize: '16px',
        color: '#e5e7eb',
        align: 'center',
      })
      .setOrigin(0.5);
    overlay.add([dim, panel, q]);
    const yes = makeButton(this, this.scale.width / 2 - 90, this.scale.height / 2 + 50, 150, 42, 'Да, сбросить', () => {
      Campaign.clearSave();
      this.game.registry.set('campaign', Campaign.newGame());
      overlay.destroy();
      this.scene.restart();
    }, { color: 0x7f1d1d });
    const no = makeButton(this, this.scale.width / 2 + 90, this.scale.height / 2 + 50, 150, 42, 'Отмена', () => overlay.destroy(), { color: 0x334155 });
    overlay.add([yes, no]);
  }

  // ---------- Тултипы ----------

  private buildRosterTooltip(): void {
    const bg = this.add.rectangle(0, 0, 340, 200, 0x0b0e14, 0.95).setStrokeStyle(2, COLORS.panelEdge);
    this.tooltipText = this.add
      .text(-156, -86, '', {
        fontFamily: 'Arial, sans-serif',
        fontSize: '12px',
        color: '#e5e7eb',
      })
      .setLineSpacing(4);
    this.tooltipBox = this.add.container(0, 0, [bg, this.tooltipText]).setDepth(100).setVisible(false);
  }

  private showRosterTooltip(ru: RosterUnit, pointer: Phaser.Input.Pointer): void {
    const roleLabel = ROLE_INFO[ru.role].label;
    const history = ru.evolutionHistory && ru.evolutionHistory.length > 0
      ? ru.evolutionHistory.join(' ➜ ')
      : ru.name;

    const abilityDesc = ru.specialAbility
      ? `\n  Способность: ${ru.specialAbility.name} (CD ${ru.specialAbility.cooldown}s)`
      : '';

    const lines = [
      `  ${ru.name.toUpperCase()}`,
      `  Класс: ${roleLabel} (Эра ${ru.epochIndex})`,
      `  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      `  HP:  ${ru.currentHp}/${ru.maxHp}   |  ATK: ${ru.atk}`,
      `  DEF: ${ru.def}         |  RNG: ${ru.range}`,
      `  SPD: ${ru.move}         |  SPD атаки: ${ru.atkSpeed}`,
      `  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      `  История: ${history}`,
      abilityDesc
    ];

    this.tooltipText.setText(lines.join('\n'));
    this.moveRosterTooltip(pointer);
    this.tooltipBox.setVisible(true);
  }

  private moveRosterTooltip(pointer: Phaser.Input.Pointer): void {
    let x = pointer.x + 20;
    let y = pointer.y + 20;
    if (x > this.scale.width - 360) {
      x = pointer.x - 360;
    }
    if (y > this.scale.height - 220) {
      y = pointer.y - 220;
    }
    this.tooltipBox.setPosition(x + 170, y + 100);
  }

  private hideRosterTooltip(): void {
    this.tooltipBox.setVisible(false);
  }

  // ---------- Прочее ----------

  private showMsg(text: string, color: string): void {
    this.msgText.setText(text).setColor(color).setAlpha(1);
    this.tweens.add({
      targets: this.msgText,
      alpha: 0,
      delay: 1400,
      duration: 600,
    });
  }
}
