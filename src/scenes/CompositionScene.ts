import Phaser from 'phaser';
import { ECONOMY } from '../data/economy';
import { Campaign } from '../meta/Campaign';
import { isDowned, type RosterUnit } from '../meta/RosterUnit';
import { campaignOf } from '../meta/session';
import { COLORS } from '../ui/theme';
import { drawRosterCard } from '../ui/RosterCard';
import { makeButton, setButtonEnabled, setButtonLabel } from '../ui/widgets';

const CARD_W = 288;
const CARD_H = 150;
const GRID_X = 56;
const GRID_Y = 108;
const COLS = 4;

/**
 * Выбор состава: отметить 4-8 боеспособных юнитов ростера для текущей волны.
 * Сражённые (0 HP) выбрать нельзя — их надо лечить в хабе.
 */
export class CompositionScene extends Phaser.Scene {
  private campaign!: Campaign;
  private selected = new Set<string>();
  private rosterLayer!: Phaser.GameObjects.Container;
  private countText!: Phaser.GameObjects.Text;
  private toBattleBtn!: Phaser.GameObjects.Container;

  constructor() {
    super('Composition');
  }

  create(): void {
    this.cameras.main.setBackgroundColor(COLORS.bg);
    this.campaign = campaignOf(this.game.registry);

    this.add
      .text(this.scale.width / 2, 30, `Выбор состава — Волна ${this.campaign.wave}`, {
        fontFamily: 'Arial, sans-serif',
        fontSize: '24px',
        fontStyle: 'bold',
        color: '#e5e7eb',
      })
      .setOrigin(0.5)
      .setDepth(20);

    this.countText = this.add
      .text(this.scale.width / 2, 62, '', {
        fontFamily: 'Arial, sans-serif',
        fontSize: '15px',
        color: '#fbbf24',
      })
      .setOrigin(0.5)
      .setDepth(20);

    this.rosterLayer = this.add.container(0, 0).setDepth(5);

    // Восстановим прошлую выборку (валидную).
    this.selected = new Set(
      this.campaign.selectedIds.filter((id) => {
        const ru = this.campaign.get(id);
        return ru && !isDowned(ru);
      }),
    );

    makeButton(this, 120, 706, 200, 46, '←  В хаб', () => this.scene.start('Hub'), {
      color: 0x334155,
    });
    this.toBattleBtn = makeButton(
      this,
      this.scale.width - 200,
      706,
      280,
      56,
      'Дальше: расстановка →',
      () => this.confirm(),
      { color: 0x1f6feb, fontSize: 17 },
    );

    this.rebuild();
  }

  private rebuild(): void {
    this.rosterLayer.removeAll(true);
    this.campaign.roster.forEach((ru, i) => this.drawCard(ru, i));
    this.updateCount();
  }

  private drawCard(ru: RosterUnit, index: number): void {
    const col = index % COLS;
    const row = Math.floor(index / COLS);
    const x = GRID_X + col * (CARD_W + 12);
    const y = GRID_Y + row * (CARD_H + 18);

    const selected = this.selected.has(ru.id);
    const { container, bg } = drawRosterCard(this, ru, x, y, {
      w: CARD_W,
      h: CARD_H,
      selected,
    });
    this.rosterLayer.add(container);

    // Метка выбора.
    if (selected) {
      const mark = this.add
        .text(x + CARD_W - 12, y + CARD_H - 12, '✓ в бою', {
          fontFamily: 'Arial, sans-serif',
          fontSize: '12px',
          fontStyle: 'bold',
          color: '#38bdf8',
        })
        .setOrigin(1, 1);
      this.rosterLayer.add(mark);
    }

    container.setInteractive({
      hitArea: new Phaser.Geom.Rectangle(0, 0, CARD_W, CARD_H),
      hitAreaCallback: Phaser.Geom.Rectangle.Contains,
      useHandCursor: true,
    });
    const baseFill = bg.fillColor;
    let pressed = false;
    container.on('pointerover', () => {
      bg.setFillStyle(selected ? 0x263b55 : 0x25304a, 0.98);
    });
    container.on('pointerout', () => {
      pressed = false;
      bg.setFillStyle(baseFill, 0.96);
    });
    container.on('pointerdown', () => {
      pressed = true;
      bg.setFillStyle(0x111827, 0.98);
    });
    container.on('pointerup', () => {
      const shouldToggle = pressed;
      pressed = false;
      bg.setFillStyle(selected ? 0x263b55 : 0x25304a, 0.98);
      if (shouldToggle) this.toggle(ru);
    });
  }

  private toggle(ru: RosterUnit): void {
    if (isDowned(ru)) {
      this.flash('Юнит сражён — вылечите его в хабе');
      return;
    }
    if (this.selected.has(ru.id)) {
      this.selected.delete(ru.id);
    } else {
      if (this.selected.size >= ECONOMY.COMPOSE_MAX) {
        this.flash(`Максимум ${ECONOMY.COMPOSE_MAX} юнитов в бою`);
        return;
      }
      this.selected.add(ru.id);
    }
    this.rebuild();
  }

  private updateCount(): void {
    const n = this.selected.size;
    this.countText.setText(
      `Выбрано ${n}  (мин ${ECONOMY.COMPOSE_MIN}, макс ${ECONOMY.COMPOSE_MAX})`,
    );
    const ok = n >= ECONOMY.COMPOSE_MIN && n <= ECONOMY.COMPOSE_MAX;
    setButtonEnabled(this.toBattleBtn, ok);
    setButtonLabel(this.toBattleBtn, ok ? 'Дальше: расстановка →' : `Нужно ≥ ${ECONOMY.COMPOSE_MIN}`);
  }

  private confirm(): void {
    if (this.selected.size < ECONOMY.COMPOSE_MIN) return;
    this.campaign.selectedIds = [...this.selected];
    this.campaign.save();
    this.scene.start('Deployment');
  }

  private flash(msg: string): void {
    const t = this.add
      .text(this.scale.width / 2, 84, msg, {
        fontFamily: 'Arial, sans-serif',
        fontSize: '14px',
        color: '#fca5a5',
      })
      .setOrigin(0.5)
      .setDepth(30);
    this.tweens.add({
      targets: t,
      alpha: 0,
      delay: 1200,
      duration: 500,
      onComplete: () => t.destroy(),
    });
  }
}
