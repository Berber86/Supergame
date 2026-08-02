import Phaser from 'phaser';
import { CONFIG } from './config';
import { DeploymentScene } from './scenes/DeploymentScene';
import { BattleScene } from './scenes/BattleScene';

/**
 * Точка входа "The Long Line" — боевой прототип.
 * Phaser занимается только отрисовкой/вводом; вся боевая логика — в /systems.
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
  scene: [DeploymentScene, BattleScene],
};

new Phaser.Game(config);
