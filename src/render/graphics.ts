/** Presentation only. Never changes simulation, clocks, species or the saved garden. */
export type GraphicsQuality = 'low' | 'balanced' | 'high';
export const GRAPHICS = {
  low: {
    name: 'Лёгкая',
    description: 'Экономнее: 30 кадров/с, простые блики и меньше частиц.',
    dpr: 1,
    fps: 30,
    reflectionStep: 18,
    waterDetail: 0.45,
    particles: 0.35,
    groundDetail: 1,
    paper: false,
    shafts: false,
    mist: false,
    objectLight: false,
  },
  balanced: {
    name: 'Баланс',
    description: 'До 60 кадров/с, мягкая вода и свет, умеренная детализация.',
    dpr: 1.5,
    fps: 60,
    reflectionStep: 10,
    waterDetail: 0.75,
    particles: 0.65,
    groundDetail: 2,
    paper: false,
    shafts: false,
    mist: true,
    objectLight: true,
  },
  high: {
    name: 'Максимум',
    description: 'До 60 кадров/с: чёткая акварель, тонкие отражения и все эффекты.',
    dpr: 2,
    fps: 60,
    reflectionStep: 5,
    waterDetail: 1,
    particles: 1,
    groundDetail: 2,
    paper: true,
    shafts: true,
    mist: true,
    objectLight: true,
  },
} as const;
export const isGraphicsQuality = (value: unknown): value is GraphicsQuality =>
  value === 'low' || value === 'balanced' || value === 'high';
/** Explicit deadlines avoid 30 -> 24 fps on 120/144 Hz displays and do not accumulate catch-up work. */
export class FrameGate {
  private next: number | undefined;
  private previous = 0;
  private rate = 0;
  reset(): void {
    this.next = undefined;
  }
  due(now: number, fps: number): boolean {
    if (!Number.isFinite(now)) return false;
    if (this.next === undefined || now < this.previous || fps !== this.rate) this.next = now;
    this.rate = fps;
    this.previous = now;
    if (now + 0.01 < this.next) return false;
    const interval = 1000 / fps;
    this.next += Math.max(1, Math.floor((now - this.next + 0.01) / interval) + 1) * interval;
    return true;
  }
}
