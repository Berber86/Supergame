import { ecologyYear, wildlifeActivity, treeFallActivity } from './ecology';
/**
 * Живность сада: коты, птицы, бабочки, карпы — и приглашённые жители воды.
 * Агенты со своими намерениями — сад должен жить сам по себе, без участия игрока.
 *
 * Жители открываются постройками: кормушка зовёт птиц, пруд — лягушек
 * и стрекоз (они живут в residents.ts), а второго кота приводят подушка,
 * миска и первый кот. Поведение наблюдаемое, но лёгкое: никаких нужд,
 * голода и наказаний, только места, сезон, погода и друг друг.
 */

import { CAT_STRIDE, catPosture, updateCatPosture, type CatPosture } from './creatureMotion';
import { easePose } from './animalMotion';
import { GRID } from '../core/iso';
import { clamp, hash1, hash2, lerp, makeRng } from '../core/rng';
import { ITEM_BY_ID } from './catalog';
import { TimeState } from '../core/clock';
import { Habitat, Invitation, invitations, scanHabitat, floweringHabitat } from './habitat';
import { Residents, Threat } from './residents';
import { Wildlife } from './wildlife';
import { WeatherState } from './weatherState';
import { ChronicleToastNote, World } from './world';
import { inGrowRect } from './grow';

export type CatState = 'sleep' | 'sit' | 'walk' | 'wash' | 'stretch' | 'loaf';
export type BirdState = 'fly-in' | 'hop' | 'peck' | 'perch' | 'feed' | 'drink' | 'bathe' | 'fly-out';
export type BirdSpecies = 'sparrow' | 'tit' | 'finch' | 'wagtail' | 'bullfinch';
export type CatCoat = 'cream' | 'grey' | 'black' | 'tortoise';

const CAT_COATS: CatCoat[] = ['cream', 'grey', 'black', 'tortoise'];

/** Окрас кота выводится из сида предмета: сохранённый кот не перекрашивается. */
export function coatOfSeed(seed: number): CatCoat {
  return CAT_COATS[Math.floor(hash1(seed, 71) * CAT_COATS.length) % CAT_COATS.length];
}

/** Сид того же разряда, что даёт нужный окрас: гость, оставшись, сохраняет шубу. */
export function seedForCoat(coat: CatCoat, roll: () => number): number {
  for (let i = 0; i < 64; i++) {
    const s = Math.floor(roll() * 100000);
    if (coatOfSeed(s) === coat) return s;
  }
  return 0;
}

export interface Vec {
  x: number;
  y: number;
}

/** Общий предок: всё живое знает, где оно и куда смотрит. */
interface Agent {
  tx: number;
  ty: number;
  /** Направление взгляда: -1 влево, 1 вправо. */
  facing: number;
  seed: number;
}

export interface Cat extends Agent {
  posture?: CatPosture;
  gait?: number;
  actionTime?: number;
  actionDuration?: number;
  actionState?: CatState;
  id: number;
  state: CatState;
  /** Сколько мс осталось в текущем состоянии. */
  timer: number;
  target: Vec | null;
  /** 0..1 — прогресс анимации внутри состояния. */
  phase: number;
  /** Насколько кот «разогнался» — для плавного шага. */
  speed: number;
  /** Домашняя подушка, если найдена. */
  home: Vec | null;
  /** Гость ещё не предмет сада: он может остаться, а может уйти. */
  guest: boolean;
  coat: CatCoat;
  /** Знакомство с другим котом: сидят друг напротив друга. */
  greet: number;
  /** Когда гостю пора уходить и когда он готов остаться. */
  leaveAt: number;
  stayAt: number;
}

export interface Bird extends Agent {
  state: BirdState;
  timer: number;
  target: Vec | null;
  /** Высота над землёй в пикселях. */
  alt: number;
  hop: number;
  scale: number;
  species: BirdSpecies;
  /** Куда птица пришла: земля, кормушка или поилка. */
  place: 'ground' | 'feeder' | 'bath';
  /** Номер места на кормушке, чтобы не сидеть в одной точке. */
  slot: number;
}

export interface Flutter {
  tx: number;
  ty: number;
  alt: number;
  vx: number;
  vy: number;
  valt: number;
  target: Vec | null;
  timer: number;
  seed: number;
  phase: number;
  /** Сидит на цветке. */
  resting: number;
}

export interface Fish {
  id: number;
  tx: number;
  ty: number;
  dir: number;
  speed: number;
  seed: number;
  homeX: number;
  homeY: number;
  turn: number;
  panic: number;
  px: number;
  py: number;
  state: 'wander' | 'approach' | 'feed' | 'hide';
  feedMemory: Vec | null;
  feedTimer: number;
  boldness: number;
  lastFed: number;
  memoryStrength: number;
}

/** Порыв ветра — волна, проходящая через сад. */
export interface Gust {
  /** Позиция фронта вдоль оси распространения, в тайлах. */
  pos: number;
  strength: number;
  /** Направление распространения. */
  dx: number;
  dy: number;
  width: number;
}

const rnd = makeRng(20240320);

function tileWalkable(world: World, tx: number, ty: number): boolean {
  const t = world.at(Math.floor(tx), Math.floor(ty));
  if (!t) return false;
  return !t.water;
}

function randomWalkable(world: World, near?: Vec, radius = 6): Vec | null {
  const bounds = world.grow?.rect ?? null;
  for (let i = 0; i < 40; i++) {
    let x: number;
    let y: number;
    if (near) {
      x = near.x + (rnd() - 0.5) * radius * 2;
      y = near.y + (rnd() - 0.5) * radius * 2;
    } else {
      x = rnd() * GRID;
      y = rnd() * GRID;
    }
    if (x < 1 || y < 1 || x > GRID - 1 || y > GRID - 1) continue;
    // В растущем саду гулять можно лишь по открытой земле
    if (bounds && (x < bounds.x || x >= bounds.x + bounds.w || y < bounds.y || y >= bounds.y + bounds.h)) continue;
    if (tileWalkable(world, x, y)) return { x, y };
  }
  return null;
}

/** Ищет объекты заданного типа — коту нужны подушки, птицам земля, бабочкам цветы. */
function findObjects(world: World, types: string[]): Vec[] {
  const bounds = world.grow?.rect ?? null;
  const out: Vec[] = [];
  for (const o of world.objects) {
    if (!types.includes(o.type)) continue;
    const item = ITEM_BY_ID.get(o.type);
    if (!item) continue;
    // Цветок за туманом растущего сада бабочек не зовёт
    if (bounds && (o.tx < bounds.x || o.tx >= bounds.x + bounds.w || o.ty < bounds.y || o.ty >= bounds.y + bounds.h))
      continue;
    out.push({ x: o.tx + item.w / 2, y: o.ty + item.h / 2 });
  }
  return out;
}

/** Кто прилетает к столу в этот сезон: состав стаи меняется с годом. */
function seasonSpecies(season: string, atFeeder: boolean): BirdSpecies {
  const r = rnd();
  if (season === 'winter') {
    // зимой у кормушки синицы и снегири, воробьи держатся своей компанией
    if (atFeeder) return r < 0.45 ? 'tit' : r < 0.75 ? 'bullfinch' : 'sparrow';
    return r < 0.6 ? 'sparrow' : r < 0.85 ? 'bullfinch' : 'wagtail';
  }
  if (season === 'summer') {
    if (atFeeder) return r < 0.4 ? 'tit' : r < 0.7 ? 'finch' : 'sparrow';
    return r < 0.45 ? 'wagtail' : r < 0.75 ? 'sparrow' : 'finch';
  }
  if (season === 'spring') {
    if (atFeeder) return r < 0.4 ? 'finch' : r < 0.7 ? 'tit' : 'sparrow';
    return r < 0.5 ? 'wagtail' : r < 0.8 ? 'sparrow' : 'finch';
  }
  if (atFeeder) return r < 0.4 ? 'tit' : r < 0.7 ? 'sparrow' : 'finch';
  return r < 0.55 ? 'sparrow' : r < 0.8 ? 'wagtail' : 'finch';
}

export class Life {
  cats: Cat[] = [];
  /** Коты-гости: ещё не предметы сада, но уже его жители. */
  guests: Cat[] = [];
  birds: Bird[] = [];
  flutters: Flutter[] = [];
  fish: Fish[] = [];
  gusts: Gust[] = [];
  /** Жители воды: лягушки и стрекозы, приглашённые прудом. */
  residents = new Residents();
  /** Дикие соседи: светлячки, цапля и олень приходят по своим причинам. */
  wildlife = new Wildlife();
  /** Что сад готов принять в этот час; пересчитывается редко. */
  habitat: Habitat | null = null;
  invitation: Invitation = {
    frogs: 0,
    dragonflies: 0,
    feederBirds: 0,
    guestCat: false,
    chorus: 0,
    fireflies: 0,
    heron: false,
    deer: 0,
    hedgehog: 0,
    mice: 0,
    owl: 0,
    squirrel: 0,
    turtle: 0,
    bees: 0,
    moths: 0,
  };
  /** Заметки в летопись: игровой цикл забирает их каждый кадр. */
  pendingNotes: ChronicleToastNote[] = [];
  /** Общая фаза ветра 0..1 — плавный фон поверх порывов. */
  windBase = 0.45;
  private gustTimer = 4000;
  private birdTimer = 6000;
  private habitatTimer = 0;
  private guestTimer = 45_000;
  /** Лепестки, сорванные с деревьев: сцена забирает их каждый кадр. */
  emitted: { x: number; y: number; kind: 'petal' | 'leaf'; seed: number }[] = [];
  /** Сид состава кои — чтобы рыбы переселялись за своими предметами. */
  private koiKey = '';
  private dormantSince = new WeakMap<object, number>();
  /**
   * Потолок очереди опадающего. Когда сцена не рисуется (дзен-лист),
   * лепестки некому забирать — очередь не должна расти без предела.
   */
  private static EMITTED_CAP = 64;

  /** Забыть всю живность — при переходе в другую усадьбу. */
  reset(): void {
    this.cats = [];
    this.guests = [];
    this.birds = [];
    this.flutters = [];
    this.fish = [];
    this.gusts = [];
    this.emitted = [];
    this.koiKey = '';
    this.dormantSince = new WeakMap();
    this.habitat = null;
    this.habitatTimer = 0;
    this.guestTimer = 45_000;
    this.pendingNotes = [];
    this.residents.reset();
    this.wildlife.reset();
  }

  /** Пересобирает агентов под текущий состав сада. */
  sync(world: World): void {
    // --- Коты: по объекту «кот» в саду ---
    //
    // Сверяемся по id предметов, а не по числу: если одного кота убрали,
    // а другого завели между двумя кадрами, количество не изменилось,
    // но это уже другой кот.
    const catObjs = world.objects.filter((o) => o.type === 'cat');
    const sameCats = catObjs.length === this.cats.length && catObjs.every((o, i) => this.cats[i].id === o.id);
    if (!sameCats) {
      this.cats = catObjs.map((o) => {
        const prev = this.cats.find((c) => c.id === o.id);
        if (prev) return prev;
        return this.makeCat(o.id, o.tx + 0.5, o.ty + 0.5, o.seed, false);
      });
    }

    // --- Карпы: по объекту «кои» ---
    //
    // Та же история: снесли кои из одного пруда и посадили в другой
    // тем же числом — рыбы обязаны переселиться за своим предметом,
    // а не кружить над опустевшим местом.
    const koiObjs = world.objects.filter((o) => o.type === 'koi');
    const koiKey = koiObjs.map((o) => o.id).join(',');
    if (koiKey !== this.koiKey) {
      this.koiKey = koiKey;
      this.fish = [];
      for (const o of koiObjs) {
        for (let k = 0; k < 2; k++) {
          this.fish.push({
            id: o.id * 10 + k,
            tx: o.tx + 0.5 + (rnd() - 0.5) * 0.6,
            ty: o.ty + 0.5 + (rnd() - 0.5) * 0.6,
            dir: rnd() * Math.PI * 2,
            speed: 0.00022 + rnd() * 0.00016,
            seed: o.seed + k * 37,
            homeX: o.tx + 0.5,
            homeY: o.ty + 0.5,
            turn: 0,
            panic: 0,
            px: 0,
            py: 0,
            state: 'wander',
            feedMemory: null,
            feedTimer: 0,
            boldness: 0.35 + hash2(o.seed + k, 11, 13) * 0.5,
            lastFed: 0,
            memoryStrength: 0,
          });
        }
      }
    }
  }

  private makeCat(id: number, tx: number, ty: number, seed: number, guest: boolean): Cat {
    return {
      id,
      tx,
      ty,
      facing: 1,
      seed,
      state: 'sleep',
      timer: 4000 + rnd() * 6000,
      target: null,
      phase: 0,
      speed: 0,
      home: null,
      guest,
      coat: guest ? CAT_COATS[1 + Math.floor(rnd() * (CAT_COATS.length - 1))] : coatOfSeed(seed),
      greet: 0,
      leaveAt: 0,
      stayAt: 0,
    };
  }

  update(world: World, t: TimeState, dt: number, now: number, wx?: WeatherState | null): void {
    this.sync(world);
    this.updateWind(dt, t);

    // Среда обитания пересчитывается редко: постройки не двигаются сами,
    // а обход сада каждый кадр был бы чистой тратой.
    this.habitatTimer -= dt;
    if (!this.habitat || this.habitatTimer <= 0) {
      this.habitatTimer = 2000;
      this.habitat = scanHabitat(world, world.grow?.rect ?? null);
    }
    const h = floweringHabitat(this.habitat, t.now);
    const inv = invitations(h, t, wx ?? null, this.windBase);
    this.invitation = inv;

    // От кого прятаться лягушкам: коты подходят вплотную, птицы клюют рядом
    const threats: Threat[] = [];
    for (const c of this.cats) threats.push({ x: c.tx, y: c.ty, r: 2.1 });
    for (const c of this.guests) threats.push({ x: c.tx, y: c.ty, r: 2.1 });
    for (const b of this.birds) if (b.alt < 8) threats.push({ x: b.tx, y: b.ty, r: 1.0 });

    this.residents.update(world, h, inv, wx ?? null, dt, now, threats);
    for (const note of this.residents.takeNotes()) this.note(world, note.id, note.x, note.y);

    // Удар цапли по воде: круги и разлетающиеся карпы видны со стороны
    this.wildlife.onStrike = (x, y) => {
      this.residents.ripple(x, y, true);
      this.scareFish(x, y);
    };
    this.wildlife.update(h, inv, t, wx ?? null, dt, now, threats, world);
    for (const note of this.wildlife.takeNotes()) this.note(world, note.id, note.x, note.y);

    this.updateCats(world, t, dt);
    this.updateGuest(world, h, inv, t, dt, now);
    this.updateBirds(world, t, dt, h, inv, wx ?? null);
    this.updateFlutters(world, t, dt, now, wx);
    this.updateFish(world, dt);
    this.updateFalling(world, t, dt);
    const year = ecologyYear(t.now);
    this.retireDormant(this.flutters, year.butterflies, dt);
    this.retireDormant(this.residents.frogs, year.frogs, dt);
    this.retireDormant(this.residents.dragonflies, year.dragonflies, dt);
    this.retireDormant(this.wildlife.bees, year.bees, dt);
    this.retireDormant(this.wildlife.fireflies, year.fireflies, dt);
    this.retireDormant(this.wildlife.moths, year.moths, dt);
    this.retireDormant(this.wildlife.turtles, year.turtle, dt);
    this.retireDormant(this.wildlife.hedgehogs, year.hedgehog, dt);
  }

  /** Invisible out-of-season agents must not stay curled/hidden forever in simulation arrays.
   * Normal behaviours get five seconds to depart; this is a bounded hibernation fallback.
   * Year-round cats, fish and birds are deliberately not cleared.
   */
  private retireDormant<T extends object>(agents: T[], activity: number, dt: number): void {
    for (let i = agents.length - 1; i >= 0; i--) {
      const agent = agents[i];
      if (activity > 0.001) {
        this.dormantSince.delete(agent);
        continue;
      }
      const elapsed = (this.dormantSince.get(agent) ?? 0) + dt;
      if (elapsed >= 5000) {
        agents.splice(i, 1);
        this.dormantSince.delete(agent);
      } else this.dormantSince.set(agent, elapsed);
    }
  }

  /**
   * Заметка в летопись: дублеты гасит сам мир, здесь только передача.
   * Метка времени — настоящая дата: летопись живёт по календарю, а не
   * по счётчику кадров. В растущем саду за туманом — тишина.
   */
  private note(world: World, id: string, x?: number, y?: number): void {
    if (world.grow && x != null && y != null) {
      if (!inGrowRect(world.grow.rect, Math.floor(x), Math.floor(y))) return;
    }
    world.noteEvent(id, Date.now(), x, y);
  }

  // ---------------- Ветер ----------------

  private updateWind(dt: number, t: TimeState): void {
    const now = performance.now();
    // ровное «дыхание» + сезонная поправка: осенью и зимой ветрено
    const seasonK = 1 + 0.2 * (1 - ecologyYear(t.now).green);
    this.windBase = (0.34 + Math.sin(now * 0.00011) * 0.16 + Math.sin(now * 0.00037) * 0.1) * seasonK;

    this.gustTimer -= dt;
    if (this.gustTimer <= 0) {
      this.gustTimer = 5000 + rnd() * 11000;
      const ang = rnd() * Math.PI * 2;
      this.gusts.push({
        pos: -8,
        strength: 0.5 + rnd() * 0.9,
        dx: Math.cos(ang),
        dy: Math.sin(ang),
        width: 6 + rnd() * 7,
      });
    }
    for (let i = this.gusts.length - 1; i >= 0; i--) {
      const g = this.gusts[i];
      g.pos += dt * 0.0075 * (0.7 + g.strength * 0.5);
      if (g.pos > GRID * 1.6 + g.width) this.gusts.splice(i, 1);
    }
  }

  /** Сила ветра в конкретной точке сада — деревья качаются волной, а не разом. */
  windAt(tx: number, ty: number): number {
    let w = this.windBase;
    for (const g of this.gusts) {
      // проекция точки на ось распространения порыва
      const proj = tx * g.dx + ty * g.dy;
      const d = Math.abs(proj - g.pos);
      if (d < g.width) {
        const k = Math.cos((d / g.width) * Math.PI * 0.5);
        w += g.strength * k * k;
      }
    }
    return clamp(w, 0, 2.4);
  }

  // ---------------- Коты ----------------

  private updateCats(world: World, t: TimeState, dt: number): void {
    const cushions = findObjects(world, ['cushion']);
    const all = this.cats.concat(this.guests);
    for (const c of all) {
      c.posture ??= catPosture(c.state);
      if (c.actionState !== c.state) {
        c.actionState = c.state;
        c.actionTime = 0;
        c.actionDuration = Math.max(1, c.timer);
      }
      c.actionTime = (c.actionTime ?? 0) + dt;
      const oldX = c.tx;
      const oldY = c.ty;
      c.timer -= dt;
      c.phase += dt * 0.001;
      if (c.greet > 0) c.greet -= dt;
      if (!c.home && cushions.length) c.home = cushions[Math.floor(hash2(c.seed, 1, 3) * cushions.length)];

      if (c.state === 'walk' && c.target) {
        const dx = c.target.x - c.tx;
        const dy = c.target.y - c.ty;
        const dist = Math.hypot(dx, dy);
        if (dist < 0.12) {
          c.target = null;
          this.pickCatState(c, t);
        } else {
          c.speed = easePose(c.speed, 1, dt, 400);
          const v = Math.min(dist, 0.0013 * dt * c.speed);
          c.tx += (dx / dist) * v;
          c.ty += (dy / dist) * v;
          if (Math.abs(dx - dy) > 0.02) c.facing = dx - dy > 0 ? 1 : -1;
          // не заходим в воду
          if (!tileWalkable(world, c.tx, c.ty)) {
            c.tx -= (dx / dist) * v;
            c.ty -= (dy / dist) * v;
            c.target = null;
            this.pickCatState(c, t);
          }
        }
      } else {
        c.speed = easePose(c.speed, 0, dt, 200);
      }

      c.gait = (c.gait ?? 0) + (Math.hypot(c.tx - oldX, c.ty - oldY) / CAT_STRIDE) * Math.PI * 2;
      if (c.timer <= 0) this.pickCatState(c, t, world);

      // Кот наблюдает за птицей: это заметно со стороны и ни к чему не обязывает
      if ((c.state === 'sit' || c.state === 'loaf') && c.greet <= 0) {
        const bird = this.nearestGroundBird(c, 4.5);
        if (bird) {
          c.facing = bird.tx > c.tx ? 1 : -1;
          c.timer = Math.max(c.timer, 1600);
        }
      }
      // Кошки и мышки: кот видит мышку — караулит, потом бросается
      if ((c.state === 'sit' || c.state === 'loaf' || c.state === 'walk') && c.greet <= 0) {
        const mouse = this.nearestMouse(c, 4.5);
        if (mouse) {
          const md = Math.hypot(mouse.tx - c.tx, mouse.ty - c.ty);
          c.facing = mouse.tx > c.tx ? 1 : -1;
          if (md < 1.2 && rnd() < 0.15) {
            this.note(world, 'cat_mouse', c.tx, c.ty);
          }
          if (c.state !== 'walk' && md > 1.8 && rnd() < 0.35) {
            c.state = 'walk';
            c.target = { x: mouse.tx, y: mouse.ty };
            c.timer = 6000 + rnd() * 4000;
          } else {
            c.timer = Math.max(c.timer, 1200);
          }
        }
      }
      // Ёжик: кот подходит, принюхивается, но иголки останавливают
      if ((c.state === 'sit' || c.state === 'loaf' || c.state === 'walk') && c.greet <= 0) {
        const hog = this.nearestHedgehog(c, 3.5);
        if (hog && hog.state !== 'curl') {
          c.facing = hog.tx > c.tx ? 1 : -1;
          if (Math.hypot(hog.tx - c.tx, hog.ty - c.ty) < 1.6) {
            c.state = 'sit';
            c.timer = 3000 + rnd() * 2000;
            c.target = null;
          }
        }
      }
      // Белка: кот видит — замирает, потом бросается
      if ((c.state === 'sit' || c.state === 'loaf' || c.state === 'walk') && c.greet <= 0) {
        const sq = this.nearestSquirrel(c, 4.8);
        if (sq) {
          const md = Math.hypot(sq.tx - c.tx, sq.ty - c.ty);
          c.facing = sq.tx > c.tx ? 1 : -1;
          if (md < 1.5 && rnd() < 0.12) this.note(world, 'cat_squirrel', c.tx, c.ty);
          if (c.state !== 'walk' && md > 2.0 && rnd() < 0.32) {
            c.state = 'walk';
            c.target = { x: sq.tx, y: sq.ty };
            c.timer = 5000 + rnd() * 3000;
          } else {
            c.timer = Math.max(c.timer, 1000);
          }
        }
      }
      // Сова: кот смотрит вверх, но не лезет
      if ((c.state === 'sit' || c.state === 'loaf') && c.greet <= 0) {
        const owl = this.nearestOwl(c, 5.0);
        if (owl) {
          c.facing = owl.tx > c.tx ? 1 : -1;
          c.timer = Math.max(c.timer, 1800);
        }
      }
      // Черепаха: кот подходит, трогает лапой
      if ((c.state === 'sit' || c.state === 'loaf' || c.state === 'walk') && c.greet <= 0) {
        const tu = this.nearestTurtle(c, 3.0);
        if (tu && tu.state !== 'hide') {
          c.facing = tu.tx > c.tx ? 1 : -1;
          if (Math.hypot(tu.tx - c.tx, tu.ty - c.ty) < 1.2) {
            c.state = 'sit';
            c.timer = 2500 + rnd() * 2000;
            c.target = null;
          }
        }
      }
      // Пчёлы: кот следит, но держит дистанцию
      if ((c.state === 'sit' || c.state === 'loaf') && c.greet <= 0) {
        const bee = this.nearestBee(c, 3.0);
        if (bee) {
          c.facing = bee.tx > c.tx ? 1 : -1;
          c.timer = Math.max(c.timer, 1000);
        }
      }
    }

    for (const c of all) updateCatPosture(c, dt);

    // Знакомство котов: сошлись близко — сели друг напротив друга
    for (const g of this.guests) {
      for (const c of this.cats) {
        const d = Math.hypot(g.tx - c.tx, g.ty - c.ty);
        if (d > 2.6 || d < 0.001) continue;
        if (g.state === 'walk' || c.state === 'walk') continue;
        g.facing = c.tx > g.tx ? 1 : -1;
        c.facing = g.tx > c.tx ? 1 : -1;
        if (g.state !== 'sit') {
          g.state = 'sit';
          g.timer = 4000;
        }
        if (c.state !== 'sit') {
          c.state = 'sit';
          c.timer = 4000;
        }
        if (g.greet <= 0) {
          g.greet = 9000;
          c.greet = 9000;
          this.note(world, 'cats_greet', (g.tx + c.tx) / 2, (g.ty + c.ty) / 2);
        }
      }
    }
  }

  private nearestGroundBird(c: Cat, r: number): Bird | null {
    let best: Bird | null = null;
    let bd = r;
    for (const b of this.birds) {
      if (b.state === 'fly-in' || b.state === 'fly-out' || b.alt > 8) continue;
      const d = Math.hypot(b.tx - c.tx, b.ty - c.ty);
      if (d < bd) {
        bd = d;
        best = b;
      }
    }
    return best;
  }

  private nearestMouse(c: Cat, r: number): import('./wildlife').Mouse | null {
    let best: import('./wildlife').Mouse | null = null;
    let bd = r;
    for (const m of this.wildlife.mice) {
      if (m.state === 'hide' || m.state === 'leave') continue;
      const d = Math.hypot(m.tx - c.tx, m.ty - c.ty);
      if (d < bd) {
        bd = d;
        best = m;
      }
    }
    return best;
  }

  private nearestHedgehog(c: Cat, r: number): import('./wildlife').Hedgehog | null {
    let best: import('./wildlife').Hedgehog | null = null;
    let bd = r;
    for (const e of this.wildlife.hedgehogs) {
      if (e.state === 'leave') continue;
      const d = Math.hypot(e.tx - c.tx, e.ty - c.ty);
      if (d < bd) {
        bd = d;
        best = e;
      }
    }
    return best;
  }

  private nearestSquirrel(c: Cat, r: number): import('./wildlife').Squirrel | null {
    let best: import('./wildlife').Squirrel | null = null;
    let bd = r;
    for (const s of this.wildlife.squirrels) {
      if (s.state === 'leave') continue;
      const d = Math.hypot(s.tx - c.tx, s.ty - c.ty);
      if (d < bd) {
        bd = d;
        best = s;
      }
    }
    return best;
  }

  private nearestOwl(c: Cat, r: number): import('./wildlife').Owl | null {
    let best: import('./wildlife').Owl | null = null;
    let bd = r;
    for (const o of this.wildlife.owls) {
      if (o.state === 'fly-out' || o.state === 'fly-in') continue;
      const d = Math.hypot(o.tx - c.tx, o.ty - c.ty);
      if (d < bd) {
        bd = d;
        best = o;
      }
    }
    return best;
  }

  private nearestTurtle(c: Cat, r: number): import('./wildlife').Turtle | null {
    let best: import('./wildlife').Turtle | null = null;
    let bd = r;
    for (const t of this.wildlife.turtles) {
      if (t.state === 'leave') continue;
      const d = Math.hypot(t.tx - c.tx, t.ty - c.ty);
      if (d < bd) {
        bd = d;
        best = t;
      }
    }
    return best;
  }

  private nearestBee(c: Cat, r: number): import('./wildlife').Bee | null {
    let best: import('./wildlife').Bee | null = null;
    let bd = r;
    for (const b of this.wildlife.bees) {
      const d = Math.hypot(b.tx - c.tx, b.ty - c.ty);
      if (d < bd) {
        bd = d;
        best = b;
      }
    }
    return best;
  }

  private pickCatState(c: Cat, t: TimeState, world?: World): void {
    const night = t.daylight < 0.3;
    const r = rnd();
    // Расписание своё у каждого: гость гуляет на рассвете и в сумерках,
    // чёрный кот ночью бодрее светлого, дома все спят в полдень.
    let lazy: number;
    if (c.guest) {
      lazy = night ? 0.4 : t.hours >= 12 && t.hours <= 15 ? 0.66 : 0.28;
    } else if (c.coat === 'black') {
      lazy = night ? 0.45 : t.hours >= 12 && t.hours <= 15 ? 0.62 : 0.36;
    } else {
      lazy = night ? 0.72 : t.hours >= 12 && t.hours <= 15 ? 0.6 : 0.34;
    }

    if (r < lazy) {
      c.state = r < lazy * 0.55 ? 'sleep' : 'loaf';
      c.timer = 9000 + rnd() * 22000;
    } else if (r < lazy + 0.18) {
      c.state = 'sit';
      c.timer = 5000 + rnd() * 9000;
    } else if (r < lazy + 0.28) {
      c.state = 'wash';
      c.timer = 3500 + rnd() * 5000;
    } else if (r < lazy + 0.34) {
      c.state = 'stretch';
      c.timer = 1800 + rnd() * 1400;
    } else if (world) {
      // идём куда-нибудь: иногда к своей подушке, иногда просто бродить
      const toHome = c.home && rnd() < 0.35 ? c.home : null;
      const dest = toHome ?? randomWalkable(world, { x: c.tx, y: c.ty }, 7);
      if (dest) {
        c.state = 'walk';
        c.target = dest;
        c.timer = 14000;
      } else {
        c.state = 'sit';
        c.timer = 4000;
      }
    } else {
      c.state = 'sit';
      c.timer = 4000;
    }
    c.phase = 0;
    c.actionTime = 0;
    c.actionDuration = Math.max(1, c.timer);
    c.actionState = c.state;
  }

  // ---------------- Второй кот ----------------

  /**
   * Гость приходит сам, когда первому коту есть что предложить: подушка,
   * миска и компания. Весной и осенью шансов больше, зимой почти нет,
   * летом он выходит в сумерках. Останется ли он навсегда — решит то,
   * найдётся ли ему свободная подушка.
   */
  private updateGuest(world: World, h: Habitat, inv: Invitation, t: TimeState, dt: number, now: number): void {
    const guest = this.guests[0];
    if (!guest) {
      this.guestTimer -= dt;
      if (this.guestTimer > 0) return;
      this.guestTimer = 90_000 + rnd() * 150_000;
      if (!inv.guestCat || this.cats.length === 0) return;
      const season = t.season;
      const chance = season === 'winter' ? 0.06 : season === 'summer' ? (t.daylight < 0.35 ? 0.45 : 0.2) : 0.5;
      if (rnd() < chance) this.spawnGuest(world, h, now);
      return;
    }

    // Пора уходить: гость прощается и уходит за край сада
    if (now > guest.leaveAt && guest.state !== 'walk') {
      guest.state = 'walk';
      guest.target = this.exitPoint(guest);
      guest.timer = 30_000;
    }
    if (guest.state === 'walk' && now > guest.leaveAt) {
      const b = world.grow?.rect;
      const gone = b
        ? guest.tx < b.x - 0.5 || guest.tx > b.x + b.w - 0.5 || guest.ty < b.y - 0.5 || guest.ty > b.y + b.h - 0.5
        : guest.tx < 1.2 || guest.tx > GRID - 1.2 || guest.ty < 1.2 || guest.ty > GRID - 1.2;
      if (gone) {
        this.guests = [];
        return;
      }
    }

    // Свободная подушка и долгий визит: гость остаётся навсегда
    if (now > guest.stayAt && now < guest.leaveAt && h.cushions.length > this.cats.length) {
      const seed = seedForCoat(guest.coat, rnd);
      const placed = world.place('cat', Math.round(guest.tx * 2) / 2, Math.round(guest.ty * 2) / 2, 0);
      if (placed) {
        placed.seed = seed;
        world.noteObjectsChanged();
        this.guests = [];
        this.note(world, 'guest_stayed', guest.tx, guest.ty);
        world.checkMilestone('second_cat');
      }
    }
  }

  private spawnGuest(world: World, h: Habitat, now: number): void {
    // Входим с кромки сада, поближе к дому или веранде;
    // в растущем саду кромка — граница открытой земли, из тумана
    const anchor = h.shelters.length ? h.shelters[Math.floor(rnd() * h.shelters.length)] : { x: GRID / 2, y: GRID / 2 };
    const b = world.grow?.rect;
    const L = b ? b.x : 1;
    const R = b ? b.x + b.w - 1 : GRID - 1;
    const T = b ? b.y : 1;
    const B = b ? b.y + b.h - 1 : GRID - 1;
    const side = Math.floor(rnd() * 4);
    const start: Vec =
      side === 0
        ? { x: L, y: clamp(anchor.y, T + 1, B - 1) }
        : side === 1
          ? { x: R, y: clamp(anchor.y, T + 1, B - 1) }
          : side === 2
            ? { x: clamp(anchor.x, L + 1, R - 1), y: T }
            : { x: clamp(anchor.x, L + 1, R - 1), y: B };
    if (!tileWalkable(world, start.x, start.y)) {
      const fallback = randomWalkable(world, anchor, 8);
      if (!fallback) return;
      start.x = fallback.x;
      start.y = fallback.y;
    }
    const g = this.makeCat(-1, start.x, start.y, Math.floor(rnd() * 100000), true);
    g.state = 'walk';
    g.target = h.cushions.length ? h.cushions[Math.floor(rnd() * h.cushions.length)] : anchor;
    g.timer = 30_000;
    const stay = 150_000 + rnd() * 180_000;
    g.stayAt = now + stay * 0.5;
    g.leaveAt = now + stay;
    this.guests = [g];
    this.note(world, 'meet_guest', g.tx, g.ty);
  }

  private exitPoint(c: Cat): Vec {
    const side = Math.floor(rnd() * 4);
    return side === 0
      ? { x: 0.6, y: c.ty }
      : side === 1
        ? { x: GRID - 0.6, y: c.ty }
        : side === 2
          ? { x: c.tx, y: 0.6 }
          : { x: c.tx, y: GRID - 0.6 };
  }

  // ---------------- Птицы ----------------

  private updateBirds(
    world: World,
    t: TimeState,
    dt: number,
    h: Habitat,
    inv: Invitation,
    wx: WeatherState | null,
  ): void {
    // Птицы прилетают днём, и только если есть где сесть
    const daytime = t.daylight > 0.35;
    const rain = wx ? wx.rain : 0;
    this.birdTimer -= dt;
    const feederBirds = this.birds.filter((b) => b.place !== 'ground' && b.state !== 'fly-out').length;
    const groundBirds = this.birds.filter((b) => b.place === 'ground' && b.state !== 'fly-out').length;

    if (daytime && this.birdTimer <= 0 && this.birds.length < 6) {
      this.birdTimer = 7000 + rnd() * 16000;
      // Кормушка зовёт своих: зимой у неё людно, летом — пара завсегдатаев
      const wantFeeder = h.feeders.length > 0 && feederBirds < inv.feederBirds;
      const wantBath = h.baths.length > 0 && t.season === 'summer' && rnd() < 0.3 && rain < 0.2;
      if (wantFeeder || wantBath) {
        const feeder = wantFeeder ? h.feeders[Math.floor(rnd() * h.feeders.length)] : null;
        const bath = !feeder && wantBath ? h.baths[Math.floor(rnd() * h.baths.length)] : null;
        const at = feeder ?? bath!;
        const fromLeft = rnd() > 0.5;
        // места на лотке и кромке поилки: птицы не сидят в одной точке
        const slot = Math.floor(rnd() * 4);
        const off = [
          [0.34, 0],
          [-0.34, 0],
          [0, 0.3],
          [0, -0.3],
        ][slot];
        this.birds.push({
          tx: fromLeft ? -2 : GRID + 2,
          ty: clamp(at.y + (rnd() - 0.5) * 3, 1, GRID - 1),
          facing: fromLeft ? 1 : -1,
          seed: Math.floor(rnd() * 10000),
          state: 'fly-in',
          timer: 0,
          target: { x: at.x + off[0], y: at.y + off[1] },
          alt: 80 + rnd() * 40,
          hop: 0,
          scale: 0.85 + rnd() * 0.3,
          species: seasonSpecies(t.season, !!feeder),
          place: feeder ? 'feeder' : 'bath',
          slot,
        });
      } else if (groundBirds < 4) {
        const spot = randomWalkable(world);
        if (spot) {
          const fromLeft = rnd() > 0.5;
          this.birds.push({
            tx: fromLeft ? -2 : GRID + 2,
            ty: spot.y + (rnd() - 0.5) * 4,
            facing: fromLeft ? 1 : -1,
            seed: Math.floor(rnd() * 10000),
            state: 'fly-in',
            timer: 0,
            target: spot,
            alt: 90 + rnd() * 50,
            hop: 0,
            scale: 0.85 + rnd() * 0.35,
            species: seasonSpecies(t.season, false),
            place: 'ground',
            slot: 0,
          });
        }
      }
    }
    if (!daytime) {
      // на закате разлетаются
      for (const b of this.birds) if (b.state !== 'fly-out') this.birdLeave(b);
    }

    // Кот подобрался к птицам — кормушка пустеет на глазах
    for (const b of this.birds) {
      if (b.state === 'fly-out') continue;
      let scared = false;
      for (const c of this.cats.concat(this.guests)) {
        if (Math.hypot(c.tx - b.tx, c.ty - b.ty) < 3) {
          scared = true;
          break;
        }
      }
      if (scared) {
        for (const o of this.birds) {
          if (o.state !== 'fly-out' && Math.hypot(o.tx - b.tx, o.ty - b.ty) < 6) this.birdLeave(o);
        }
        this.note(world, 'birds_fled', b.tx, b.ty);
        break;
      }
    }

    // Компания у кормушки — событие, которое замечают
    const atFeeder = this.birds.filter((b) => b.place === 'feeder' && b.state !== 'fly-out').length;
    if (atFeeder >= 3) {
      const fb = this.birds.find((bb) => bb.place === 'feeder');
      this.note(world, 'flock', fb?.tx, fb?.ty);
    }
    if (t.season === 'winter' && atFeeder >= 2) {
      world.checkMilestone('winter_feeder');
      this.note(
        world,
        'winter_table',
        this.birds.find((bb) => bb.place === 'feeder')?.tx,
        this.birds.find((bb) => bb.place === 'feeder')?.ty,
      );
    }

    for (let i = this.birds.length - 1; i >= 0; i--) {
      const b = this.birds[i];
      b.timer -= dt;

      if (b.state === 'fly-in' && b.target) {
        const dx = b.target.x - b.tx;
        const dy = b.target.y - b.ty;
        const d = Math.hypot(dx, dy);
        const v = 0.0028 * dt;
        const perchAlt = b.place === 'feeder' ? 26 : b.place === 'bath' ? 7 : 0;
        if (d < 0.25 && Math.abs(b.alt - perchAlt) < 3) {
          b.alt = perchAlt;
          if (perchAlt <= 7 && world.at(Math.floor(b.tx), Math.floor(b.ty))?.water)
            this.residents.ripple(b.tx, b.ty, false);
          if (b.place === 'feeder') {
            b.state = 'perch';
            b.timer = 1600 + rnd() * 2600;
            world.checkMilestone('bird_guest');
            this.note(world, 'meet_feeder', b.tx, b.ty);
          } else if (b.place === 'bath') {
            b.state = rnd() < 0.5 ? 'drink' : 'bathe';
            b.timer = 1800 + rnd() * 2600;
            world.checkMilestone('bird_guest');
          } else {
            b.state = 'hop';
            b.alt = 0;
            b.timer = 900 + rnd() * 1600;
            world.checkMilestone('bird_guest');
          }
        } else {
          // Шаг не длиннее расстояния: иначе на редких кадрах птица
          // проскакивает цель и навечно пляшет вокруг кормушки
          const step = Math.min(v, d);
          b.tx += (dx / (d || 1)) * step;
          b.ty += (dy / (d || 1)) * step;
          // Снижение не зависит от частоты кадров
          const k = 1 - Math.pow(1 - 0.035, dt / 16);
          b.alt = lerp(b.alt, perchAlt, k);
          if (Math.abs(dx) > 0.02) b.facing = dx > 0 ? 1 : -1;
        }
      } else if (b.state === 'perch') {
        // на кормушке: клюнуть, оглядеться, уступить место
        if (b.timer <= 0) {
          b.state = 'feed';
          b.timer = 900 + rnd() * 1800;
        }
      } else if (b.state === 'feed') {
        if (b.timer <= 0) {
          const r = rnd();
          if (r < 0.22) this.birdLeave(b);
          else if (r < 0.5) {
            b.state = 'perch';
            b.timer = 1200 + rnd() * 2200;
            b.slot = (b.slot + 1) % 4;
          } else {
            b.state = 'feed';
            b.timer = 800 + rnd() * 1400;
          }
        }
      } else if (b.state === 'drink' || b.state === 'bathe') {
        if (b.timer <= 0) {
          if (b.state === 'bathe') {
            this.note(world, 'bath_splash', b.tx, b.ty);
            this.residents.ripple(b.tx, b.ty, false);
          }
          if (rnd() < 0.4) this.birdLeave(b);
          else {
            b.state = b.state === 'bathe' ? 'drink' : 'bathe';
            b.timer = 1400 + rnd() * 2000;
          }
        }
      } else if (b.state === 'hop') {
        b.hop += dt * 0.006;
        if (b.timer <= 0) {
          b.state = rnd() < 0.6 ? 'peck' : 'hop';
          b.timer = 700 + rnd() * 1500;
          // прыжок в сторону
          const nx = b.tx + (rnd() - 0.5) * 1.6;
          const ny = b.ty + (rnd() - 0.5) * 1.6;
          if (tileWalkable(world, nx, ny)) {
            b.facing = nx > b.tx ? 1 : -1;
            b.tx = nx;
            b.ty = ny;
          }
          if (rnd() < 0.16) this.birdLeave(b);
        }
      } else if (b.state === 'peck') {
        if (b.timer <= 0) {
          b.state = 'hop';
          b.timer = 600 + rnd() * 1400;
          if (rnd() < 0.2) this.birdLeave(b);
        }
      } else if (b.state === 'fly-out') {
        b.alt = lerp(b.alt, 150, 0.026);
        b.tx += b.facing * 0.0032 * dt;
        b.ty -= 0.0009 * dt;
        if (b.tx < -4 || b.tx > GRID + 4 || b.alt > 130) this.birds.splice(i, 1);
      }
    }
  }

  private birdLeave(b: Bird): void {
    b.state = 'fly-out';
    b.timer = 4000;
  }

  // ---------------- Бабочки ----------------

  private updateFlutters(world: World, t: TimeState, dt: number, now: number, wx?: WeatherState | null): void {
    const active = wildlifeActivity(t, wx, this.windBase).butterflies;
    const flowers = floweringHabitat(this.habitat!, t.now).beeSpots;
    const wantButterflies = Math.floor(5 * active * (flowers.length ? 1 : 0.35));

    while (this.flutters.length < wantButterflies) {
      const spot = flowers.length ? flowers[Math.floor(rnd() * flowers.length)] : randomWalkable(world);
      if (!spot) break;
      this.flutters.push({
        tx: spot.x + (rnd() - 0.5) * 3,
        ty: spot.y + (rnd() - 0.5) * 3,
        alt: 18 + rnd() * 26,
        vx: 0,
        vy: 0,
        valt: 0,
        target: spot,
        timer: 2000 + rnd() * 3000,
        seed: rnd() * 1000,
        phase: rnd() * 10,
        resting: 0,
      });
    }
    // лишних убираем плавно
    while (this.flutters.length > wantButterflies) {
      this.flutters.splice(0, 1);
    }

    for (const f of this.flutters) {
      f.timer -= dt;
      f.phase += dt * 0.004;

      if (f.resting > 0) {
        f.resting -= dt;
        f.alt = lerp(f.alt, 6, 0.06);
        continue;
      }

      if (f.timer <= 0 || !f.target) {
        f.timer = 1600 + rnd() * 3200;
        const spot =
          flowers.length && rnd() < 0.7
            ? flowers[Math.floor(rnd() * flowers.length)]
            : randomWalkable(world, { x: f.tx, y: f.ty }, 5);
        f.target = spot;
        // иногда присаживается на цветок
        if (spot && rnd() < 0.3) f.resting = 1800 + rnd() * 3000;
      }

      if (f.target) {
        const dx = f.target.x - f.tx;
        const dy = f.target.y - f.ty;
        const d = Math.hypot(dx, dy) || 1;
        // бабочка порхает рывками под взмах крыла
        const flap = Math.sin(now * 0.02 + f.seed) * 0.5 + 0.5;
        f.vx = lerp(f.vx, (dx / d) * 0.0011 * (0.5 + flap), 0.05);
        f.vy = lerp(f.vy, (dy / d) * 0.0011 * (0.5 + flap), 0.05);
        f.valt = lerp(f.valt, Math.sin(now * 0.005 + f.seed) * 0.06, 0.06);
        f.tx += f.vx * dt;
        f.ty += f.vy * dt;
        f.alt = clamp(f.alt + f.valt * dt, 6, 58);
        if (Math.hypot(dx, dy) < 0.35) f.target = null;
      }
      f.tx = clamp(f.tx, 0.5, GRID - 0.5);
      f.ty = clamp(f.ty, 0.5, GRID - 0.5);
    }
  }

  // ---------------- Карпы ----------------

  /** Цапля ударила по воде: карпы на миг разлетаются веером. */
  private scareFish(x: number, y: number): void {
    for (const f of this.fish) {
      if (Math.hypot(f.tx - x, f.ty - y) < 5) {
        f.panic = 2600;
        f.px = x;
        f.py = y;
      }
    }
  }

  private updateFish(world: World, dt: number): void {
    const feedSpots: Vec[] = [];
    for (const o of world.objects) {
      if (o.type === 'feeder' || o.type === 'bowl') {
        const item = ITEM_BY_ID.get(o.type);
        if (!item) continue;
        const c = { x: o.tx + item.w / 2, y: o.ty + item.h / 2 };
        for (let dy = -3; dy <= 3; dy++)
          for (let dx = -3; dx <= 3; dx++) {
            const t = world.at(Math.floor(c.x + dx), Math.floor(c.y + dy));
            if (t?.water) {
              feedSpots.push({ x: c.x + dx * 0.3, y: c.y + dy * 0.3 });
              break;
            }
          }
      }
    }
    for (const f of this.fish) {
      f.feedTimer -= dt;
      if (f.memoryStrength > 0) f.memoryStrength = Math.max(0, f.memoryStrength - dt * 0.00005);
      const wander = (hash2(Math.floor(performance.now() * 0.0007), f.seed, 3) - 0.5) * 0.9;
      f.turn = lerp(f.turn, wander, 0.02);
      let panicK = 1;
      if (f.panic > 0) {
        f.panic -= dt;
        panicK = 3.2;
        f.state = 'hide';
        f.feedTimer = 4000 + rnd() * 4000;
        const away = Math.atan2(f.ty - f.py, f.tx - f.px);
        let diff = away - f.dir;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        f.dir += clamp(diff, -0.3, 0.3) * (dt * 0.05);
      }
      if (f.state === 'hide' && f.panic <= 0 && f.feedTimer <= 0) f.state = 'wander';
      if (f.state !== 'hide' && f.feedMemory && f.memoryStrength > 0.15 && f.boldness > 0.45) {
        const dx = f.feedMemory.x - f.tx;
        const dy = f.feedMemory.y - f.ty;
        const d = Math.hypot(dx, dy);
        if (d < 0.5) {
          f.state = 'feed';
          f.feedTimer = 2000 + rnd() * 3000;
          f.lastFed = performance.now();
          f.memoryStrength = Math.min(1, f.memoryStrength + 0.25);
        } else if (d < 6 && f.state !== 'feed') {
          f.state = 'approach';
          const targetAng = Math.atan2(dy, dx);
          let diff = targetAng - f.dir;
          while (diff > Math.PI) diff -= Math.PI * 2;
          while (diff < -Math.PI) diff += Math.PI * 2;
          f.dir += clamp(diff, -0.08, 0.08) * (dt * 0.07) * f.boldness;
        }
      }
      if (f.state === 'feed' && f.feedTimer <= 0) {
        f.state = 'wander';
        f.speed = 0.00022 + rnd() * 0.00016;
      } else if (f.state === 'feed') f.speed = 0.00008;
      if (feedSpots.length && f.state !== 'hide') {
        let nearest: Vec | null = null;
        let nd = Infinity;
        for (const sp of feedSpots) {
          const d = Math.hypot(sp.x - f.tx, sp.y - f.ty);
          if (d < nd) {
            nd = d;
            nearest = sp;
          }
        }
        if (nearest && nd < 2.5) {
          if (!f.feedMemory || nd < Math.hypot(f.feedMemory.x - f.tx, f.feedMemory.y - f.ty)) {
            f.feedMemory = { x: nearest.x, y: nearest.y };
            f.memoryStrength = Math.min(1, f.memoryStrength + 0.12);
            f.boldness = Math.min(1, f.boldness + 0.02);
          }
          if (nd < 0.8 && rnd() < 0.02) {
            f.state = 'feed';
            f.feedTimer = 1800 + rnd() * 2500;
            f.lastFed = performance.now();
          }
        }
      }
      const aheadX = f.tx + Math.cos(f.dir) * 0.7;
      const aheadY = f.ty + Math.sin(f.dir) * 0.7;
      const ahead = world.at(Math.floor(aheadX), Math.floor(aheadY));
      if (!ahead?.water) {
        const toHome = Math.atan2(f.homeY - f.ty, f.homeX - f.tx);
        let diff = toHome - f.dir;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        f.dir += clamp(diff, -0.06, 0.06) * (dt * 0.06);
      } else if (f.state !== 'approach' || f.panic > 0) f.dir += f.turn * dt * 0.0012;
      const v = f.speed * dt * panicK * (f.state === 'approach' ? 1.6 : 1);
      const nx = f.tx + Math.cos(f.dir) * v;
      const ny = f.ty + Math.sin(f.dir) * v;
      const nt = world.at(Math.floor(nx), Math.floor(ny));
      if (nt?.water) {
        f.tx = nx;
        f.ty = ny;
      } else f.dir += 0.9;
    }
  }

  // ---------------- Опадание с деревьев ----------------

  private updateFalling(world: World, t: TimeState, dt: number): void {
    const wind = this.windBase + this.gusts.reduce((a, g) => a + g.strength, 0) * 0.4;
    // First sample a real tree, then its shedding rate; dormant trees cannot emit petals.
    if (rnd() > 0.004 * wind * dt) return;
    const trees = world.objects.filter((o) => ITEM_BY_ID.get(o.type)?.kind === 'tree');
    if (!trees.length) return;
    const tree = trees[Math.floor(rnd() * trees.length)];
    const fall = treeFallActivity(tree.type, tree.seed, t.now);
    const isPetal = fall.petals > 0;
    if (rnd() > (isPetal ? fall.petals : fall.leaves)) return;
    const item = ITEM_BY_ID.get(tree.type)!;
    if (this.emitted.length < Life.EMITTED_CAP) {
      this.emitted.push({
        x: tree.tx + item.w / 2 + (rnd() - 0.5) * 1.4,
        y: tree.ty + item.h / 2 + (rnd() - 0.5) * 1.4,
        kind: isPetal ? 'petal' : 'leaf',
        seed: Math.floor(rnd() * 10000),
      });
    }
  }

  takeEmitted(): { x: number; y: number; kind: 'petal' | 'leaf'; seed: number }[] {
    const out = this.emitted;
    this.emitted = [];
    return out;
  }
}
