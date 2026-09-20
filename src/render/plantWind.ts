/** Rigid lower bole, flexible crown. Two copies of the SAME cached pixels, not rebaked wind frames. */
import { hash2 } from '../core/rng';
import type { WindVector } from '../world/wind';
import type { Ctx } from './paint';
export interface PlantPose {
  slope: number;
  hinge: number;
}
interface Response {
  height: number;
  hinge: number;
  flex: number;
  lag: number;
  frequency: number;
}
const RESPONSES: Record<string, Response> = {
  maple: { height: 150, hinge: 46, flex: 0.065, lag: 650, frequency: 0.0021 },
  sakura: { height: 156, hinge: 50, flex: 0.048, lag: 850, frequency: 0.0019 },
  ginkgo: { height: 158, hinge: 60, flex: 0.038, lag: 1000, frequency: 0.0017 },
  willow: { height: 140, hinge: 45, flex: 0.085, lag: 480, frequency: 0.0031 },
  pine: { height: 175, hinge: 66, flex: 0.024, lag: 1200, frequency: 0.0015 },
  bamboo: { height: 135, hinge: 8, flex: 0.065, lag: 240, frequency: 0.006 },
  persimmon: { height: 108, hinge: 38, flex: 0.042, lag: 700, frequency: 0.002 },
  ume: { height: 115, hinge: 35, flex: 0.038, lag: 720, frequency: 0.002 },
  nashi: { height: 132, hinge: 48, flex: 0.038, lag: 800, frequency: 0.0019 },
  peach: { height: 132, hinge: 38, flex: 0.058, lag: 480, frequency: 0.0028 },
  yuzu: { height: 112, hinge: 25, flex: 0.028, lag: 760, frequency: 0.002 },
  hedge: { height: 38, hinge: 5, flex: 0.06, lag: 300, frequency: 0.004 },
  azalea: { height: 40, hinge: 5, flex: 0.06, lag: 280, frequency: 0.004 },
  camellia: { height: 42, hinge: 7, flex: 0.038, lag: 430, frequency: 0.003 },
};
const HERBS = new Set(['grass_tuft', 'fern', 'reed', 'horsetail', 'lily', 'iris', 'lotus', 'lilypad']);
const herb: Response = { height: 28, hinge: 0, flex: 0.14, lag: 70, frequency: 0.008 };
export function windLag(type: string): number {
  return (
    RESPONSES[type]?.lag ?? (HERBS.has(type) ? 70 : type === 'wind_chime' ? 120 : type === 'lantern_paper' ? 380 : 0)
  );
}
export function plantPose(
  type: string,
  seed: number,
  g: number,
  time: number,
  wind: WindVector,
  simple = false,
): PlantPose | undefined {
  const r = RESPONSES[type] ?? (HERBS.has(type) ? herb : undefined);
  // Pergola posts, rocks and architecture are deliberately excluded.
  if (!r) return undefined;
  const scale = 0.18 + 0.82 * Math.pow(Math.max(0, Math.min(1, g)), 0.72);
  const spring = 1 + Math.sin(time * r.frequency + seed) * (type === 'bamboo' ? 0.19 : 0.08);
  const slope = wind.screenX * r.flex * (0.88 + hash2(seed, 1, 2237) * 0.24) * spring;
  return { slope: simple ? (slope * (r.height - r.hinge)) / r.height : slope, hinge: simple ? 0 : r.hinge * scale };
}
export function windOffset(pose: PlantPose | undefined, height: number): number {
  return pose ? Math.max(0, height - pose.hinge) * pose.slope : 0;
}
export function pendantSwing(wind: WindVector, seed: number, time: number, size: number): number {
  return wind.screenX * size * (0.85 + 0.15 * Math.sin(time * 0.005 + seed));
}
export function drawWindImage(
  ctx: Ctx,
  image: CanvasImageSource,
  x: number,
  y: number,
  ax: number,
  ay: number,
  w: number,
  h: number,
  pose: PlantPose,
): void {
  if (pose.hinge === 0) {
    ctx.save();
    ctx.translate(x, y);
    ctx.transform(1, 0, -pose.slope, 1, 0, 0);
    ctx.drawImage(image, 0, 0, w, h, -ax, -ay, w, h);
    ctx.restore();
    return;
  }
  const cut = Math.max(0, Math.min(h, ay - pose.hinge));
  if (cut > 0) {
    ctx.save();
    ctx.translate(x, y);
    ctx.transform(1, 0, -pose.slope, 1, -pose.slope * pose.hinge, 0);
    ctx.drawImage(image, 0, 0, w, cut, -ax, -ay, w, cut);
    ctx.restore();
  }
  if (cut < h) ctx.drawImage(image, 0, cut, w, h - cut, x - ax, y - ay + cut, w, h - cut);
}
/** The uncached diagnostic path uses the same hinge and slope as the cached image. */
export function drawWindDirect(ctx: Ctx, x: number, y: number, pose: PlantPose, draw: () => void): void {
  if (pose.hinge === 0) {
    ctx.save();
    ctx.transform(1, 0, -pose.slope, 1, pose.slope * y, 0);
    try {
      draw();
    } finally {
      ctx.restore();
    }
    return;
  }
  const cut = y - pose.hinge;
  ctx.save();
  ctx.beginPath();
  ctx.rect(x - 2048, cut, 4096, 4096);
  ctx.clip();
  draw();
  ctx.restore();
  ctx.save();
  ctx.beginPath();
  ctx.rect(x - 2048, cut - 4096, 4096, 4096);
  ctx.clip();
  ctx.transform(1, 0, -pose.slope, 1, pose.slope * cut, 0);
  draw();
  ctx.restore();
}
