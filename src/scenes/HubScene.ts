import Phaser from 'phaser';
import { CONFIG } from '../config';
import { ECONOMY } from '../data/economy';
import { ROLE_INFO, STONE_AGE_UNITS } from '../data/units';
import { Campaign } from '../meta/Campaign';
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

  private rosterLayer!: Phaser.GameObjects.Container;
  private buttonsLayer!: Phaser.GameObjects.Container;
  private toBattleBtn!: Phaser.GameObjects.Container;
  private healAllBtn!: Phaser.GameObjects.Container;
  private msgText!: Phaser.GameObjects.Text;

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

    this.refresh();
  }

  // ---------- Перерисовка состояния ----------

  private refresh(): void {
    this.waveText.setText(`Волна ${this.campaign.wave}`);
    this.currencyText.setText(`🪙 ${this.campaign.currency}`);
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
    const { container } = drawRosterCard(this, ru, x, y, { w: CARD_W, h: CARD_H });
    this.rosterLayer.add(container);

    if (isWounded(ru) || isDowned(ru)) {
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
    }
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
      bg.setInteractive(new Phaser.Geom.Rectangle(-115, -46, 230, 92), Phaser.Geom.Rectangle.Contains);
      bg.on('pointerover', () => bg.setFillStyle(0x25304a));
      bg.on('pointerout', () => bg.setFillStyle(0x1b212f));
      bg.on('pointerup', () => {
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

    makeButton(
      this,
      this.scale.width / 2,
      this.scale.height / 2 + 200,
      160,
      40,
      '✕  Закрыть',
      () => overlay.destroy(),
      { color: 0x334155 },
    );
    overlay.list[overlay.list.length - 1]; // no-op для линтера
    overlay.add(this.add.existing(this.children.getByName('__noop__') as unknown as Phaser.GameObjects.GameObject));
    // (makeButton уже добавил себя в сцену; переносим в overlay для совместного удаления)
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
