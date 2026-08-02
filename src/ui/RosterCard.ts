import Phaser from 'phaser';
import { ROLE_INFO } from '../data/units';
import { getEvolutionThreshold } from '../data/evolution-tree';
import type { RosterUnit } from '../meta/RosterUnit';
import { COLORS, TEAM_COLORS } from './theme';
import { createSilhouetteGraphics } from './UnitView';

export interface CardStyle {
  w?: number;
  h?: number;
  selected?: boolean;
}

const EPOCH_COLORS: Record<number, number> = {
  1: 0x475569, // Stone Age: Slate
  2: 0xb45309, // Bronze Age: Bronze/Amber
  3: 0x64748b, // Iron Age: Steel/Slate
  4: 0x10b981, // Epoch 4: Emerald
  5: 0x06b6d4, // Epoch 5: Cyan
  6: 0x3b82f6, // Epoch 6: Blue
  7: 0x8b5cf6, // Epoch 7: Purple
  8: 0xf59e0b, // Epoch 8: Gold
};

const EPOCH_HEX_COLORS: Record<number, string> = {
  1: '#94a3b8',
  2: '#f59e0b',
  3: '#cbd5e1',
  4: '#10b981',
  5: '#06b6d4',
  6: '#3b82f6',
  7: '#a855f7',
  8: '#f59e0b',
};

const ROMAN_NUMERALS = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'];

/**
 * Карточка ростер-юнита: фигура (цвет команды + эмблема роли), имя/роль,
 * статы, полоска и значение HP, опыт, статус (ранен/сражён).
 * Возвращает контейнер (позиция — левый-верхний угол) + ссылки для тонов.
 */
export function drawRosterCard(
  scene: Phaser.Scene,
  ru: RosterUnit,
  x: number,
  y: number,
  style: CardStyle = {},
): { container: Phaser.GameObjects.Container; bg: Phaser.GameObjects.Rectangle; hpFill: Phaser.GameObjects.Rectangle } {
  const w = style.w ?? 300;
  const h = style.h ?? 150;
  const ratio = Phaser.Math.Clamp(ru.currentHp / ru.maxHp, 0, 1);
  const downed = ru.currentHp <= 0;
  const wounded = ru.currentHp < ru.maxHp && !downed;
  const team = TEAM_COLORS.player;

  const container = scene.add.container(x, y, []).setDepth(5);

  const bgFill = downed ? 0x2a1f24 : wounded ? 0x2a2a1f : COLORS.panel;
  
  const frameColor = style.selected ? COLORS.accent : (EPOCH_COLORS[ru.epochIndex] ?? COLORS.panelEdge);
  const frameThickness = style.selected ? 4 : (ru.epochIndex > 1 ? 3 : 2);
  
  const bg = scene.add.rectangle(w / 2, h / 2, w, h, bgFill, 0.96).setStrokeStyle(
    frameThickness,
    frameColor,
  );

  // Фигура.
  const fx = 46;
  const fy = h / 2 - 4;
  const r = 22;
  const body = scene.add.circle(fx, fy, r, team.body).setAlpha(downed ? 0.5 : 1);
  body.setStrokeStyle(2, team.edge);
  const role = ROLE_INFO[ru.role];
  const emblem = scene.add.circle(fx, fy, r * 0.62, role.color, 0.92);
  const letter = createSilhouetteGraphics(scene, ru.role, r);
  letter.setPosition(fx, fy);

  // Тексты.
  const tx = 86;
  const name = scene.add
    .text(tx, 12, ru.name, {
      fontFamily: 'Arial, sans-serif',
      fontSize: '15px',
      fontStyle: 'bold',
      color: '#e5e7eb',
    })
    .setOrigin(0, 0);
  const roleLine = scene.add
    .text(tx, 33, role.label, {
      fontFamily: 'Arial, sans-serif',
      fontSize: '12px',
      color: '#9aa3b2',
    })
    .setOrigin(0, 0);
  const stats = scene.add
    .text(tx, 52, `ATK ${ru.atk}   DEF ${ru.def}   RNG ${ru.range}   SPD ${ru.move}`, {
      fontFamily: 'Consolas, monospace',
      fontSize: '11px',
      color: '#cbd5e1',
    })
    .setOrigin(0, 0);

  // Полоска HP.
  const barW = w - tx - 14;
  const barX = tx;
  const barY = 78;
  const hpBg = scene.add.rectangle(barX + barW / 2, barY, barW, 8, 0x000000, 0.5).setOrigin(0.5);
  const hpColor = downed ? 0x6b7280 : ratio > 0.5 ? COLORS.hpHigh : ratio > 0.25 ? COLORS.hpMid : COLORS.hpLow;
  const hpFill = scene.add.rectangle(barX, barY, barW * ratio, 6, hpColor).setOrigin(0, 0.5);
  const hpText = scene.add
    .text(tx, 86, `HP ${Math.max(0, Math.ceil(ru.currentHp))}/${ru.maxHp}`, {
      fontFamily: 'Consolas, monospace',
      fontSize: '11px',
      color: '#cbd5e1',
    })
    .setOrigin(0, 0);

  // Опыт и прогресс-бар эволюции.
  const threshold = getEvolutionThreshold(ru.epochIndex);
  const xpRatio = Phaser.Math.Clamp(ru.battleExperience / threshold, 0, 1);
  const xpText = scene.add
    .text(tx, 104, `Опыт: ${ru.battleExperience}/${threshold}`, {
      fontFamily: 'Consolas, monospace',
      fontSize: '11px',
      color: '#9aa3b2',
    })
    .setOrigin(0, 0);

  const xpBg = scene.add.rectangle(tx + barW / 2, 122, barW, 6, 0x000000, 0.5).setOrigin(0.5);
  const xpColor = xpRatio >= 1 ? 0xf59e0b : 0x8b5cf6; // Gold if ready, purple otherwise
  const xpFill = scene.add.rectangle(tx, 122, barW * xpRatio, 4, xpColor).setOrigin(0, 0.5);

  // Бейдж Эпохи.
  const roman = ROMAN_NUMERALS[ru.epochIndex] ?? ru.epochIndex.toString();
  const epochColorHex = EPOCH_HEX_COLORS[ru.epochIndex] ?? '#94a3b8';
  const epochBadge = scene.add
    .text(w - 10, 33, `⭐ Эра ${roman}`, {
      fontFamily: 'Arial, sans-serif',
      fontSize: '11px',
      fontStyle: 'bold',
      color: epochColorHex,
    })
    .setOrigin(1, 0);

  // Статус-бейдж.
  let badge: Phaser.GameObjects.Text | null = null;
  if (downed) {
    badge = scene.add
      .text(w - 10, 12, 'СРАЖЁН', {
        fontFamily: 'Arial, sans-serif',
        fontSize: '11px',
        fontStyle: 'bold',
        color: '#fca5a5',
      })
      .setOrigin(1, 0);
  } else if (wounded) {
    badge = scene.add
      .text(w - 10, 12, 'РАНЕН', {
        fontFamily: 'Arial, sans-serif',
        fontSize: '11px',
        fontStyle: 'bold',
        color: '#fde047',
      })
      .setOrigin(1, 0);
  }

  container.add([bg, body, emblem, letter, name, roleLine, stats, hpBg, hpFill, hpText, xpText, xpBg, xpFill, epochBadge]);
  if (badge) container.add(badge);

  return { container, bg, hpFill };
}
