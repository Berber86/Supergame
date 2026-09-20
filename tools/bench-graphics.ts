/** Full-scene native benchmark, including raster flush. Not a browser/phone FPS estimate. */
import { createCanvas } from '@napi-rs/canvas';
import { writeFileSync } from 'node:fs';
import { setImmediate as yieldNative } from 'node:timers/promises';
import { World } from '../src/world/world';
import { Scene } from '../src/render/scene';
import { computeTime } from '../src/core/clock';
import { buildAtmosphere } from '../src/world/palette';
import { makeRng } from '../src/core/rng';
import { WeatherSystem } from '../src/world/weatherState';
import { clearSprites, spriteStats } from '../src/render/spriteCache';
Object.assign(globalThis, {
  document: { createElement: () => createCanvas(8, 8) },
  window: { devicePixelRatio: 2, innerWidth: 960, innerHeight: 640 },
});
const results: Record<string, unknown>[] = [];
for (const scenario of ['garden', 'dense-night', 'rain']) {
  for (const quality of process.argv.includes('--all') ? ['high', 'balanced', 'low'] : ['high']) {
    Math.random = makeRng(841);
    clearSprites();
    const world = new World();
    if (scenario === 'dense-night')
      for (let y = 2; y < 24; y += 2)
        for (let x = 2; x < 24; x += 2) world.place(['maple', 'yuzu', 'pine'][(x + y) % 3], x, y);
    const cv = createCanvas(960, 640);
    Object.assign(cv, { clientWidth: 960, clientHeight: 640 });
    const scene = new Scene(cv as never);
    if ('setQuality' in scene) (scene as unknown as { setQuality(q: string): void }).setQuality(quality);
    scene.camera.zoom = 0.85;
    scene.centerOn(12.5, 14);
    const t = computeTime(new Date(2026, 6, 15, scenario === 'dense-night' ? 22 : 13).getTime());
    const weather = new WeatherSystem();
    if (scenario === 'rain') Object.assign(weather.state, { rain: 0.95, wetness: 1, overcast: 0.8, fog: 0.4 });
    const atm = buildAtmosphere(t, weather.state.overcast);
    const times: number[] = [];
    const backingWidth = cv.width;
    for (let i = 0; i < 16; i++) {
      cv.width = backingWidth;
      const start = performance.now();
      scene.render(world, atm, 10000 + i * 16, 16, undefined, weather.state);
      cv.getContext('2d').getImageData(0, 0, 1, 1);
      const ms = performance.now() - start;
      if (i >= 6) times.push(ms);
      await yieldNative();
    }
    times.sort((a, b) => a - b);
    const result = {
      scenario,
      quality,
      medianMs: +times[Math.floor(times.length / 2)].toFixed(2),
      p90Ms: +times[Math.floor(times.length * 0.9)].toFixed(2),
      pixels: cv.width * cv.height,
      spriteMiB: +((spriteStats().pixels * 4) / 1048576).toFixed(2),
    };
    console.log(JSON.stringify(result));
    results.push(result);
    cv.width = cv.height = 1;
    await yieldNative();
  }
}
const at = process.argv.indexOf('--output');
if (at >= 0) writeFileSync(process.argv[at + 1], JSON.stringify(results, null, 2));
