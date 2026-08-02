import Phaser from 'phaser';
import { CONFIG } from './config';
import { HubScene } from './scenes/HubScene';
import { CompositionScene } from './scenes/CompositionScene';
import { DeploymentScene } from './scenes/DeploymentScene';
import { BattleScene } from './scenes/BattleScene';

/**
 * Точка входа "The Long Line".
 * Мета-цикл: Хаб → Выбор состава → Расстановка → Бой → Хаб (волна за волной).
 * Phaser занимается только отрисовкой/вводом; бой — в /systems, мета — в /meta.
 */
const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: 'game',
  width: CONFIG.GAME_WIDTH,
  height: CONFIG.GAME_HEIGHT,
  backgroundColor: '#10131a',
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  render: {
    antialias: true,
  },
  scene: [HubScene, CompositionScene, DeploymentScene, BattleScene],
};

new Phaser.Game(config);
