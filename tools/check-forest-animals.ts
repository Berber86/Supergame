/** Регрессия редизайна ёжика, белки и цапли: позы + настоящая симуляция. */
import assert from 'node:assert/strict';
import { createCanvas } from '@napi-rs/canvas';
import { createHash } from 'node:crypto';
import { World } from '../src/world/world';
import { Wildlife, type Hedgehog, type Heron, type Squirrel } from '../src/world/wildlife';
import { scanHabitat, invitations } from '../src/world/habitat';
import { computeTime } from '../src/core/clock';
import { buildAtmosphere, type Atmosphere } from '../src/world/palette';
import { advanceAnimal } from '../src/world/animalMotion';
import {
  HEDGEHOG_STRIDE,
  HERON_STRIKE_MS,
  HERON_WADE_SPEED,
  HERON_STRIDE,
  hedgehogPose,
  hedgehogSpeed,
  heronFlight,
  heronStrike,
  squirrelPose,
  squirrelSpeed,
  squirrelStride,
} from '../src/world/wildlifeMotion';
import { GUIDE_ANIMALS } from '../src/ui/animalGuideData';
import { drawHedgehog, drawHeron, drawSquirrel } from '../src/render/wildlife';

const world = new World();
const habitat = scanHabitat(world);
const noon = computeTime(new Date(2026, 5, 15, 13).getTime());
const invitation = invitations(habitat, noon, null);
const base = {
  tx: 12,
  ty: 12,
  facing: 1 as const,
  seed: 42,
  phase: 0,
  timer: 10000,
  from: null,
  target: null,
  born: 0,
  stay: 1e9,
};
const makeHedgehog = (): Hedgehog => ({ ...base, state: 'forage', curl: 0 });
const makeSquirrel = (): Squirrel => ({ ...base, state: 'look', hasNut: false, panic: 0 });
const makeHeron = (): Heron => ({ ...base, state: 'stand', fish: 0, struck: false });

// Ни один таймер не используется как нормализованная поза; ёж ждёт, пока кот уйдёт.
{
  const life = new Wildlife();
  const h = makeHedgehog();
  life.hedgehogs.push(h);
  const threat = [{ x: h.tx, y: h.ty, r: 2 }];
  life.update(habitat, invitation, noon, null, 16, 16, threat);
  assert.equal(h.state, 'curl');
  assert.ok(h.roll! > 0 && h.roll! < 0.12);
  const first = h.roll!;
  for (let i = 0; i < 100; i++) life.update(habitat, invitation, noon, null, 16, 100, threat);
  assert.ok(h.roll! > 0.99 && h.roll! > first);
  assert.equal(h.tx, base.tx);
  assert.equal(h.ty, base.ty);
  h.curl = 0;
  life.update(habitat, invitation, noon, null, 16, 100, threat);
  assert.equal(h.state, 'curl', 'не раскрывается перед котом');
  h.curl = 0;
  life.update(habitat, invitation, noon, null, 16, 100, []);
  assert.equal(h.state, 'forage');
  assert.ok(h.roll! > 0.9, 'раскрытие не переключает спрайт за кадр');
  for (let i = 0; i < 180; i++) life.update(habitat, invitation, noon, null, 16, 100, []);
  assert.ok(h.roll! < 0.02);
  const open = hedgehogPose({ ...h, roll: 0 }, 1000);
  const closed = hedgehogPose({ ...h, roll: 1 }, 1000);
  assert.ok(closed.rx < open.rx && closed.ry > open.ry);
}
console.log('ок: ёж плавно прячет мордочку, не скользит клубком и раскрывается после ухода кота');

// Одинаковое пройденное расстояние даёт одинаковую фазу ног при любом FPS.
for (const animal of [
  { value: { ...makeHedgehog(), state: 'walk' as const }, speed: hedgehogSpeed('walk'), stride: HEDGEHOG_STRIDE },
  {
    value: { ...makeSquirrel(), state: 'jump' as const },
    speed: squirrelSpeed('jump'),
    stride: squirrelStride('jump'),
  },
  { value: { ...makeHeron(), state: 'stalk' as const }, speed: HERON_WADE_SPEED, stride: HERON_STRIDE },
]) {
  const a = { ...animal.value, target: { x: 12, y: 16 } };
  const b = { ...a };
  advanceAnimal(a, 960, animal.speed, animal.stride);
  for (let i = 0; i < 60; i++) advanceAnimal(b, 16, animal.speed, animal.stride);
  assert.ok(Math.abs(a.ty - b.ty) < 1e-9 && Math.abs(a.gait! - b.gait!) < 1e-9);
  assert.equal(a.facing, -1, 'направление определяется проекцией, а не только координатой x');
}
// Вход из-за края больше не телепортирует ёжика и белку на клетку 0.5.
{
  const life = new Wildlife();
  const h: Hedgehog = { ...makeHedgehog(), tx: -3, state: 'enter', target: { x: 8, y: 12 } };
  const s: Squirrel = { ...makeSquirrel(), tx: -3, state: 'enter', target: { x: 8, y: 12 } };
  life.hedgehogs.push(h);
  life.squirrels.push(s);
  life.update(habitat, invitation, noon, null, 16, 16, []);
  assert.ok(h.tx > -3 && h.tx < -2.98);
  assert.ok(s.tx > -3 && s.tx < -2.98);
}
console.log('ок: расстояние управляет шагом, направления правильные, на границе нет телепортации');

{
  const life = new Wildlife();
  const s: Squirrel = {
    ...makeSquirrel(),
    state: 'cache',
    hasNut: true,
    timer: 3200,
    actionDuration: 3200,
    actionTime: 0,
  };
  life.squirrels.push(s);
  const at = (t: number) => squirrelPose({ ...s, actionTime: t }, t);
  assert.equal(at(0).dig, 0);
  assert.ok(at(1500).dig > 0.9 && at(1500).cache < 0.5);
  assert.ok(at(2300).cache > 0.7);
  assert.equal(at(3200).dig, 0);
  for (let i = 0; i < 201; i++) life.update(habitat, invitation, noon, null, 16, 100, []);
  assert.equal(s.state, 'forage');
  assert.equal(s.hasNut, false);
  assert.ok(s.actionTime! < 32);
  // Высота прыжка — часть позы, не подмена мировой координаты ty.
  const jumping: Squirrel = { ...makeSquirrel(), state: 'jump', gait: Math.PI / 2 };
  assert.ok(squirrelPose(jumping, 0).lift > 3.5);
  assert.equal(squirrelPose({ ...jumping, gait: Math.PI * 1.5 }, 0).lift, 0);
  assert.ok(squirrelPose({ ...jumping, state: 'look', motion: 0 }, 0).lift === 0);
}
console.log('ок: белка приседает, прыгает, укладывает орех и засыпает его; стоящие лапы на земле');

{
  const life = new Wildlife();
  const h = { ...makeHeron(), state: 'strike' as const, timer: HERON_STRIKE_MS };
  life.heron = h;
  let strikes = 0;
  life.onStrike = () => {
    strikes++;
    assert.ok(heronStrike(h.timer) > 0.98, 'удар синхронен касанию воды');
  };
  assert.equal(heronStrike(HERON_STRIKE_MS), 0);
  assert.equal(heronStrike(0), 0);
  assert.equal(heronStrike(-100), 0);
  for (let i = 0; i < 60; i++) life.update(habitat, invitation, noon, null, 16, 100, []);
  assert.equal(strikes, 1);
  assert.equal(life.heron!.state, 'stand');
  const arriving: Heron = { ...makeHeron(), state: 'fly-in' };
  assert.equal(heronFlight(arriving), 1);
  assert.equal(heronFlight({ ...arriving, phase: 1 }), 0);
  assert.equal(heronFlight({ ...arriving, state: 'fly-out' }), 0);
  assert.equal(heronFlight({ ...arriving, state: 'fly-out', phase: 1 }), 1);
  life.heron = { ...arriving, from: { x: 11, y: 12 }, target: { x: 12, y: 12 } };
  for (let i = 0; i < 480; i++) life.update(habitat, invitation, noon, null, 16, 100, []);
  assert.equal(life.heron!.state, 'stand');
  assert.ok(life.heron!.flightPose! < 0.005);
}
console.log('ок: один бросок цапли за действие, возврат шеи, взлёт и мягкая посадка');

// Все фазы, включая крайние: без обрезанных крыльев и утечки состояния Canvas.
const canvas = createCanvas(580, 300);
const ctx = canvas.getContext('2d');
const digest = () => createHash('sha256').update(canvas.toBuffer('image/png')).digest('hex');
let frames = 0;
for (const hour of [13, 23]) {
  const atm = buildAtmosphere(computeTime(new Date(2026, 5, 15, hour).getTime()));
  for (const animal of GUIDE_ANIMALS.filter((a) => ['heron', 'hedgehog', 'squirrel'].includes(a.id))) {
    for (const state of animal.animations) {
      const hashes = new Set<string>();
      for (let i = 0; i < 12; i++) {
        ctx.resetTransform();
        ctx.clearRect(0, 0, 580, 300);
        ctx.save();
        ctx.translate(290, 300 * animal.baseline);
        ctx.scale(animal.scale * (i % 2 ? -1 : 1), animal.scale);
        const before = ctx.getTransform();
        animal.draw(ctx as unknown as CanvasRenderingContext2D, atm, state.id, (state.duration * i) / 12, 0);
        assert.deepEqual(ctx.getTransform(), before);
        ctx.restore();
        const pixels = ctx.getImageData(0, 0, 580, 300).data;
        for (let x = 0; x < 580; x++)
          assert.ok(
            pixels[x * 4 + 3] < 20 && pixels[(299 * 580 + x) * 4 + 3] < 20,
            `${animal.id}/${state.id}: vertical clipping`,
          );
        for (let y = 0; y < 300; y++)
          assert.ok(
            pixels[y * 580 * 4 + 3] < 20 && pixels[(y * 580 + 579) * 4 + 3] < 20,
            `${animal.id}/${state.id}: horizontal clipping`,
          );
        hashes.add(digest());
        frames++;
      }
      assert.ok(hashes.size > 4, `${animal.id}/${state.id}: неподвижная анимация`);
    }
  }
}
const atm = buildAtmosphere(noon);
// Рендер не должен менять настоящие агенты, даже при многократном кадре на паузе.
function checkPure<T>(
  animal: T,
  draw: (ctx: CanvasRenderingContext2D, a: T, x: number, y: number, atm: Atmosphere, time: number) => void,
): void {
  const serialized = JSON.stringify(animal);
  ctx.resetTransform();
  ctx.clearRect(0, 0, 580, 300);
  draw(ctx as unknown as CanvasRenderingContext2D, animal, 100, 100, atm, 700);
  const first = digest();
  ctx.clearRect(0, 0, 580, 300);
  draw(ctx as unknown as CanvasRenderingContext2D, animal, 100, 100, atm, 700);
  assert.equal(digest(), first);
  assert.equal(JSON.stringify(animal), serialized);
}
checkPure(makeHedgehog(), drawHedgehog);
checkPure(makeSquirrel(), drawSquirrel);
checkPure(makeHeron(), drawHeron);
console.log(`ок: ${frames} дневных и ночных кадров, все 19 состояний; нет обрезки и мутации агентов`);
