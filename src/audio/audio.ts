/**
 * Звук сада — целиком синтезируется через WebAudio, без единого файла.
 * Слои включаются и глушатся плавно, в зависимости от сезона, часа,
 * погоды и от того, что построено рядом.
 */

import { clamp01, lerp, makeRng } from '../core/rng';
import { TimeState } from '../core/clock';
import { WeatherState } from '../world/weatherState';

const rnd = makeRng(9091);

/** Плавно ведомый параметр — чтобы громкость не щёлкала. */
class Slider {
  value = 0;
  constructor(private node: GainNode, private ctx: AudioContext) {}
  to(v: number, seconds = 0.6): void {
    if (Math.abs(v - this.value) < 0.0015) return;
    this.value = v;
    const p = this.node.gain;
    p.cancelScheduledValues(this.ctx.currentTime);
    p.setTargetAtTime(v, this.ctx.currentTime, Math.max(0.02, seconds / 3));
  }
}

/** Генератор розового шума — основа для листвы, дождя и воды. */
function makeNoiseBuffer(ctx: AudioContext, seconds = 4): AudioBuffer {
  const len = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  let b0 = 0;
  let b1 = 0;
  let b2 = 0;
  let b3 = 0;
  let b4 = 0;
  let b5 = 0;
  let b6 = 0;
  for (let i = 0; i < len; i++) {
    const white = Math.random() * 2 - 1;
    b0 = 0.99886 * b0 + white * 0.0555179;
    b1 = 0.99332 * b1 + white * 0.0750759;
    b2 = 0.969 * b2 + white * 0.153852;
    b3 = 0.8665 * b3 + white * 0.3104856;
    b4 = 0.55 * b4 + white * 0.5329522;
    b5 = -0.7616 * b5 - white * 0.016898;
    d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
    b6 = white * 0.115926;
  }
  return buf;
}

interface NoiseLayer {
  gain: GainNode;
  slider: Slider;
  filter: BiquadFilterNode;
}

export class GardenAudio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private masterSlider: Slider | null = null;
  private noiseBuf: AudioBuffer | null = null;

  private leaves: NoiseLayer | null = null;
  private rain: NoiseLayer | null = null;
  private rainHeavy: NoiseLayer | null = null;
  private stream: NoiseLayer | null = null;
  private wind: NoiseLayer | null = null;

  private insectSlider: Slider | null = null;
  private insectTimer = 0;

  private chimeTimer = 2000;
  private shishiTimer = 9000;
  private birdTimer = 5000;

  enabled = false;
  volume = 0.75;
  private started = false;

  /** Контекст можно создать только после жеста пользователя. */
  async start(): Promise<void> {
    if (this.started) {
      if (this.ctx?.state === 'suspended') await this.ctx.resume();
      return;
    }
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    const ctx = new Ctor();
    this.ctx = ctx;
    this.started = true;

    const master = ctx.createGain();
    master.gain.value = 0;
    master.connect(ctx.destination);
    this.master = master;
    this.masterSlider = new Slider(master, ctx);

    this.noiseBuf = makeNoiseBuffer(ctx);

    // --- Слои шума ---
    this.leaves = this.makeNoiseLayer(ctx, master, 'bandpass', 1900, 0.7);
    this.rain = this.makeNoiseLayer(ctx, master, 'bandpass', 1100, 0.55);
    this.rainHeavy = this.makeNoiseLayer(ctx, master, 'lowpass', 520, 0.9);
    this.stream = this.makeNoiseLayer(ctx, master, 'bandpass', 760, 1.6);
    this.wind = this.makeNoiseLayer(ctx, master, 'lowpass', 340, 0.8);

    // --- Насекомые: узкополосный резонанс, стрекот задаётся амплитудой ---
    const ig = ctx.createGain();
    ig.gain.value = 0;
    ig.connect(master);
    this.insectSlider = new Slider(ig, ctx);

    if (ctx.state === 'suspended') await ctx.resume();
  }

  private makeNoiseLayer(
    ctx: AudioContext,
    dest: AudioNode,
    type: BiquadFilterType,
    freq: number,
    q: number,
  ): NoiseLayer {
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf!;
    src.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.value = freq;
    filter.Q.value = q;
    const gain = ctx.createGain();
    gain.gain.value = 0;
    src.connect(filter).connect(gain).connect(dest);
    src.start();
    return { gain, slider: new Slider(gain, ctx), filter };
  }

  setEnabled(on: boolean): void {
    this.enabled = on;
    this.masterSlider?.to(on ? this.volume : 0, 1.2);
    if (on && this.ctx?.state === 'suspended') void this.ctx.resume();
  }

  setVolume(v: number): void {
    this.volume = clamp01(v);
    if (this.enabled) this.masterSlider?.to(this.volume, 0.4);
  }

  /** Главное обновление: раскладывает сцену на звуковые слои. */
  update(
    dt: number,
    t: TimeState,
    weather: WeatherState,
    ctxInfo: {
      wind: number;
      waterNearby: number;
      hasChime: boolean;
      hasShishi: boolean;
      catNear: boolean;
      trees: number;
      /** Течение: 0 — стоячая вода, 1 — быстрый ручей. */
      current?: number;
      /** Водопады: 0 — нет, 1 — шумный каскад. */
      falling?: number;
    },
  ): void {
    if (!this.ctx || !this.enabled) return;
    const night = t.daylight < 0.28;
    const season = t.season;

    // --- Листва: зависит от ветра и количества деревьев, зимой почти нет ---
    const foliage = season === 'winter' ? 0.18 : 1;
    const leafAmt = clamp01(ctxInfo.wind * 0.42) * clamp01(ctxInfo.trees / 10) * foliage;
    this.leaves?.slider.to(leafAmt * 0.16, 1.4);
    if (this.leaves) this.leaves.filter.frequency.value = lerp(1500, 2700, clamp01(ctxInfo.wind * 0.5));

    // --- Ветер: низкий гул на сильных порывах ---
    this.wind?.slider.to(clamp01((ctxInfo.wind - 0.7) * 0.6) * 0.14, 1.2);

    // --- Вода: стоячая слышна еле-еле, текущая заметно, водопад громче всего ---
    const still = clamp01(ctxInfo.waterNearby) * 0.05;
    const running = clamp01(ctxInfo.current ?? 0) * 0.1;
    const falling = clamp01(ctxInfo.falling ?? 0) * 0.17;
    this.stream?.slider.to(still + running + falling, 1.6);
    if (this.stream) {
      // Водопад шумит выше и шире ручья — сдвигаем полосу вверх
      const bright = lerp(620, 1350, clamp01((ctxInfo.falling ?? 0) * 0.8 + (ctxInfo.current ?? 0) * 0.3));
      this.stream.filter.frequency.value = bright;
      this.stream.filter.Q.value = lerp(1.6, 0.7, clamp01(ctxInfo.falling ?? 0));
    }

    // --- Дождь ---
    this.rain?.slider.to(weather.rain * 0.19, 1.1);
    this.rainHeavy?.slider.to(Math.pow(weather.rain, 1.6) * 0.16, 1.1);

    // --- Насекомые: цикады днём летом, сверчки ночью ---
    let insects = 0;
    if (season === 'summer' && !night && t.daylight > 0.55) insects = 0.5;
    else if ((season === 'summer' || season === 'autumn') && night) insects = 0.34;
    else if (season === 'spring' && night) insects = 0.16;
    insects *= 1 - weather.rain * 0.85; // в дождь замолкают
    this.insectSlider?.to(insects * 0.1, 2.2);

    // Стрекот: короткие всплески поверх ровного фона
    if (insects > 0.02) {
      this.insectTimer -= dt;
      if (this.insectTimer <= 0) {
        this.insectTimer = night ? 240 + rnd() * 500 : 90 + rnd() * 220;
        this.chirp(night ? 'cricket' : 'cicada', insects);
      }
    }

    // --- Фурин: звенит на ветру ---
    if (ctxInfo.hasChime) {
      this.chimeTimer -= dt * (0.4 + ctxInfo.wind);
      if (this.chimeTimer <= 0) {
        this.chimeTimer = 2600 + rnd() * 7000;
        if (ctxInfo.wind > 0.5) this.chime(clamp01(ctxInfo.wind * 0.6));
      }
    }

    // --- Сиси-одоси: стучит бамбуком ---
    if (ctxInfo.hasShishi) {
      this.shishiTimer -= dt;
      if (this.shishiTimer <= 0) {
        this.shishiTimer = 11000 + rnd() * 9000;
        this.knock();
      }
    }

    // --- Птицы: перекликаются днём ---
    if (!night && weather.rain < 0.3) {
      this.birdTimer -= dt;
      if (this.birdTimer <= 0) {
        this.birdTimer = 4000 + rnd() * 13000;
        this.birdCall();
      }
    }
  }

  // ---------------- Отдельные звуки ----------------

  private env(node: AudioNode, peak: number, attack: number, decay: number): GainNode {
    const ctx = this.ctx!;
    const g = ctx.createGain();
    const now = ctx.currentTime;
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), now + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, now + attack + decay);
    node.connect(g).connect(this.master!);
    return g;
  }

  /** Стрекот цикады или сверчка. */
  private chirp(kind: 'cicada' | 'cricket', amount: number): void {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    if (kind === 'cicada') {
      osc.type = 'sawtooth';
      osc.frequency.value = 2400 + rnd() * 900;
      filter.frequency.value = 3200;
      filter.Q.value = 7;
    } else {
      osc.type = 'square';
      osc.frequency.value = 4200 + rnd() * 700;
      filter.frequency.value = 4600;
      filter.Q.value = 14;
    }
    // тремоло — характерная пульсация стрекота
    const trem = ctx.createGain();
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    lfo.frequency.value = kind === 'cicada' ? 42 : 24;
    lfoGain.gain.value = 0.5;
    lfo.connect(lfoGain).connect(trem.gain);
    trem.gain.value = 0.5;

    osc.connect(filter).connect(trem);
    const dur = kind === 'cicada' ? 0.18 + rnd() * 0.22 : 0.06 + rnd() * 0.05;
    const g = this.env(trem, 0.012 * amount, 0.02, dur);
    osc.start();
    lfo.start();
    osc.stop(ctx.currentTime + dur + 0.1);
    lfo.stop(ctx.currentTime + dur + 0.1);
    setTimeout(() => g.disconnect(), (dur + 0.3) * 1000);
  }

  /** Стеклянный фурин: два несозвучных призвука, долгий затухающий звон. */
  chime(amount = 0.6): void {
    if (!this.ctx || !this.enabled) return;
    const ctx = this.ctx;
    const base = 1680 + rnd() * 520;
    for (const [mult, amp] of [
      [1, 1],
      [2.76, 0.42],
      [5.4, 0.18],
    ] as [number, number][]) {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = base * mult;
      const g = this.env(osc, 0.05 * amp * amount, 0.006, 1.6 + rnd() * 1.4);
      osc.start();
      osc.stop(ctx.currentTime + 3.4);
      setTimeout(() => g.disconnect(), 3600);
    }
  }

  /**
   * Поющая чаша (ринсэки): мягкое касание колотушки и долгий звон.
   *
   * Обертоны чаши не кратны основному тону — отсюда тот самый «плывущий»
   * звук, который не надоедает. Два осциллятора в нескольких центах дают
   * биение: чаша звучит живо, а не как органная труба.
   */
  bowl(amount = 1): void {
    if (!this.ctx || !this.enabled) return;
    const ctx = this.ctx;
    const base = 312 + rnd() * 26;

    // касание войлока — короткий шумовой всплеск
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf!;
    src.loop = true;
    const nf = ctx.createBiquadFilter();
    nf.type = 'bandpass';
    nf.frequency.value = base * 3.1;
    nf.Q.value = 3;
    src.connect(nf);
    const ng = this.env(nf, 0.05 * amount, 0.004, 0.07);
    src.start();
    src.stop(ctx.currentTime + 0.2);
    setTimeout(() => ng.disconnect(), 420);

    for (const [mult, amp, decay] of [
      [1, 1, 9.5],
      [2.71, 0.4, 6.4],
      [4.16, 0.2, 4.4],
      [5.43, 0.11, 3.2],
    ] as [number, number, number][]) {
      for (const detune of [-4, 4]) {
        const osc = ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.value = base * mult;
        osc.detune.value = detune;
        const life = decay * (1 - mult * 0.05);
        const g = this.env(osc, 0.05 * amp * amount, 0.014, life);
        osc.start();
        osc.stop(ctx.currentTime + life + 1);
        setTimeout(() => g.disconnect(), (life + 1.4) * 1000);
      }
    }
  }

  /** Сиси-одоси: глухой деревянный стук о камень. */
  knock(): void {
    if (!this.ctx || !this.enabled) return;
    const ctx = this.ctx;
    // тело удара — короткий шумовой всплеск через резонатор
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf!;
    src.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = 220;
    f.Q.value = 9;
    src.connect(f);
    const g = this.env(f, 0.14, 0.004, 0.24);
    src.start();
    src.stop(ctx.currentTime + 0.5);
    setTimeout(() => g.disconnect(), 700);

    // низкий призвук бамбука
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = 174;
    const g2 = this.env(osc, 0.06, 0.005, 0.4);
    osc.start();
    osc.stop(ctx.currentTime + 0.6);
    setTimeout(() => g2.disconnect(), 800);
  }

  /** Короткая птичья трель. */
  private birdCall(): void {
    const ctx = this.ctx!;
    const notes = 2 + Math.floor(rnd() * 3);
    const base = 1900 + rnd() * 1400;
    for (let i = 0; i < notes; i++) {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      const t0 = ctx.currentTime + i * (0.09 + rnd() * 0.07);
      const f0 = base * (0.85 + rnd() * 0.4);
      osc.frequency.setValueAtTime(f0, t0);
      osc.frequency.exponentialRampToValueAtTime(f0 * (1 + (rnd() - 0.4) * 0.5), t0 + 0.07);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(0.02, t0 + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.1);
      osc.connect(g).connect(this.master!);
      osc.start(t0);
      osc.stop(t0 + 0.16);
      setTimeout(() => g.disconnect(), 900);
    }
  }

  /** Раскат грома. distance: 0 — близко и резко, 1 — далеко и глухо. */
  thunder(distance: number): void {
    if (!this.ctx || !this.enabled) return;
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf!;
    src.loop = true;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = lerp(900, 190, distance);
    lp.Q.value = 0.6;
    const g = ctx.createGain();
    const now = ctx.currentTime;
    const peak = lerp(0.34, 0.1, distance);
    const dur = lerp(1.4, 4.2, distance);
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(peak, now + lerp(0.015, 0.22, distance));
    // перекаты
    g.gain.exponentialRampToValueAtTime(peak * 0.4, now + dur * 0.35);
    g.gain.exponentialRampToValueAtTime(peak * 0.55, now + dur * 0.55);
    g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
    src.connect(lp).connect(g).connect(this.master!);
    src.start();
    src.stop(now + dur + 0.2);
    setTimeout(() => g.disconnect(), (dur + 0.5) * 1000);
  }

  /** Мягкий отклик на постановку предмета. */
  place(): void {
    if (!this.ctx || !this.enabled) return;
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = 520 + rnd() * 180;
    const g = this.env(osc, 0.035, 0.005, 0.18);
    osc.start();
    osc.stop(ctx.currentTime + 0.3);
    setTimeout(() => g.disconnect(), 500);
  }

  /** Всплеск воды. */
  splash(): void {
    if (!this.ctx || !this.enabled) return;
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf!;
    src.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.setValueAtTime(900, ctx.currentTime);
    f.frequency.exponentialRampToValueAtTime(2400, ctx.currentTime + 0.18);
    f.Q.value = 2.2;
    src.connect(f);
    const g = this.env(f, 0.07, 0.006, 0.3);
    src.start();
    src.stop(ctx.currentTime + 0.5);
    setTimeout(() => g.disconnect(), 700);
  }
}
