/** All encyclopedia pages/poses, shared renderers and distance-based animation. */
import assert from 'node:assert/strict';
import { createCanvas } from '@napi-rs/canvas';
import { writeFileSync } from 'node:fs';
import { register } from 'node:module';
import { JSDOM } from 'jsdom';
import { GUIDE_ANIMALS } from '../src/ui/animalGuideData';
import { buildAtmosphere } from '../src/world/palette';
import { computeTime } from '../src/core/clock';
import { advanceAnimal, easePose } from '../src/world/animalMotion';
import { World } from '../src/world/world';
import { Wildlife } from '../src/world/wildlife';
import { scanHabitat, invitations } from '../src/world/habitat';
import type { Turtle } from '../src/world/wildlife';
import type { Deer } from '../src/world/wildlife';

const day = buildAtmosphere(computeTime(new Date(2026, 5, 15, 13).getTime()));
assert.equal(GUIDE_ANIMALS.length, 23);
assert.equal(new Set(GUIDE_ANIMALS.map((a) => a.id)).size, GUIDE_ANIMALS.length);
const expected: Record<string, string[]> = {
  lizard: ['emerge', 'bask', 'look', 'walk', 'hunt', 'strike', 'flee', 'hide', 'leave'],
  deer: ['enter', 'walk', 'graze', 'look', 'leave'],
  turtle: ['enter', 'bask', 'walk', 'swim', 'hide', 'look', 'leave'],
  cat: ['sleep', 'sit', 'walk', 'wash', 'stretch', 'loaf'],
  hedgehog: ['enter', 'walk', 'forage', 'sniff', 'curl', 'leave'],
  squirrel: ['enter', 'jump', 'forage', 'cache', 'look', 'flee', 'leave'],
  heron: ['fly-in', 'stand', 'stalk', 'strike', 'preen', 'fly-out'],
};
for (const [id, states] of Object.entries(expected)) {
  assert.deepEqual(
    GUIDE_ANIMALS.find((a) => a.id === id)!
      .animations.map((a) => a.id)
      .sort(),
    states.sort(),
  );
}

const canvas = createCanvas(580, 300);
const ctx = canvas.getContext('2d');
let poses = 0;
for (const animal of GUIDE_ANIMALS) {
  assert.ok(animal.description && animal.habitat && animal.animations.length);
  for (const animation of animal.animations) {
    let visible = false;
    for (const fraction of [0.1, 0.45, 0.8])
      for (const direction of [1, -1]) {
        ctx.resetTransform();
        ctx.clearRect(0, 0, 580, 300);
        ctx.save();
        ctx.translate(290, animal.baseline * 300);
        ctx.scale(animal.scale * direction, animal.scale);
        const before = ctx.getTransform();
        animal.draw(ctx as unknown as CanvasRenderingContext2D, day, animation.id, animation.duration * fraction, 0);
        assert.deepEqual(ctx.getTransform(), before, `${animal.id}/${animation.id}: leaked canvas transform`);
        ctx.restore();
        const pixels = ctx.getImageData(0, 0, 580, 300).data;
        visible ||= pixels.some((v, i) => i % 4 === 3 && v > 0);
        for (let x = 0; x < 580; x++) {
          assert.ok(
            pixels[x * 4 + 3] < 20 && pixels[(299 * 580 + x) * 4 + 3] < 20,
            `${animal.id}/${animation.id}: clipped vertically`,
          );
        }
        poses++;
      }
    assert.ok(visible, `${animal.id}/${animation.id}: empty animation`);
  }
}
console.log(`ок: ${GUIDE_ANIMALS.length} страниц, ${poses} кадров без ошибок, холст сбалансирован`);

const makeDeer = (): Deer => ({
  tx: 0,
  ty: 0,
  facing: 1,
  seed: 42,
  state: 'walk',
  from: null,
  target: { x: 6, y: 0 },
  timer: 0,
  phase: 0,
  born: 0,
  stay: 100000,
  coat: { spots: true, winter: false, antlers: true },
});
const a = makeDeer();
const b = makeDeer();
advanceAnimal(a, 1000, 0.001, 0.85);
for (let i = 0; i < 100; i++) advanceAnimal(b, 10, 0.001, 0.85);
assert.ok(Math.abs(a.tx - b.tx) < 1e-10 && Math.abs(a.gait! - b.gait!) < 1e-10);
assert.ok(Math.abs(a.tx - 1) < 1e-10);
const longer = makeDeer();
longer.target = { x: 12, y: 0 };
advanceAnimal(longer, 1000, 0.001, 0.85);
assert.equal(longer.tx, a.tx, 'speed must not depend on route length');
const vertical = makeDeer();
vertical.target = { x: 0, y: 6 };
advanceAnimal(vertical, 1000, 0.001, 0.85);
assert.equal(vertical.facing, -1, 'facing follows isometric screen direction');
let smallSteps = 0;
for (let i = 0; i < 100; i++) smallSteps = easePose(smallSteps, 1, 10, 520);
assert.ok(Math.abs(easePose(0, 1, 1000, 520) - smallSteps) < 1e-10);
assert.ok(easePose(0, 1, 16, 520) > 0 && easePose(0, 1, 16, 520) < 0.1);
console.log('ок: постоянная скорость, непрерывный шаг, плавные позы и направление в изометрии');

// A formerly unreachable swim state now makes a short trip to actual water and back.
const pondWorld = new World();
for (const tile of pondWorld.tiles) {
  tile.water = false;
  tile.ground = 'moss';
}
pondWorld.objects = [];
pondWorld.at(6, 5)!.water = true;
const habitat = scanHabitat(pondWorld);
const noon = computeTime(new Date(2026, 5, 15, 13).getTime());
const invitation = invitations(habitat, noon, null);
const wildlife = new Wildlife();
const turtle: Turtle = {
  tx: 5.5,
  ty: 5.5,
  facing: 1,
  seed: 42,
  state: 'bask',
  timer: 0,
  phase: 0,
  from: null,
  target: null,
  born: 0,
  stay: 1e9,
  hide: 0,
};
wildlife.turtles.push(turtle);
for (let i = 0; i < 200 && turtle.state !== 'swim'; i++) {
  turtle.state = 'bask';
  turtle.timer = 0;
  wildlife.update(habitat, invitation, noon, null, 16, 100, [], pondWorld);
}
assert.equal(turtle.state, 'swim');
assert.deepEqual(turtle.target, { x: 6.5, y: 5.5 });
let reachedWater = false;
for (let i = 0; i < 400; i++) {
  wildlife.update(habitat, invitation, noon, null, 16, 100, [], pondWorld);
  reachedWater ||= turtle.tx > 6.4;
}
assert.ok(reachedWater);
assert.equal(turtle.state, 'bask');
assert.equal(turtle.tx, 5.5);
assert.equal(turtle.ty, 5.5);
wildlife.update(habitat, invitation, noon, null, 16, 100, [{ x: 5.5, y: 5.5, r: 2 }], pondWorld);
assert.equal(turtle.state, 'hide');
assert.ok(turtle.retract! > 0 && turtle.retract! < 1);
turtle.hide = 0;
for (let i = 0; i < 300; i++) wildlife.update(habitat, invitation, noon, null, 16, 100, [], pondWorld);
assert.equal(turtle.state, 'bask');
assert.ok(turtle.retract! < 0.01);
console.log('ок: заплыв только в настоящую воду, возвращение на берег и плавное укрытие от кота');

// Optional visual proof sheet; never part of the saved game or repository assets.
const sheetAt = process.argv.indexOf('--sheet');
if (sheetAt >= 0) {
  const names = process.argv
    .find((arg) => arg.startsWith('--animals='))
    ?.slice(10)
    .split(',') ?? ['deer', 'turtle'];
  const cells = GUIDE_ANIMALS.filter((a) => names.includes(a.id)).flatMap((animal) =>
    animal.animations.map((animation) => ({ animal, animation })),
  );
  const sheet = createCanvas(1200, Math.ceil(cells.length / 3) * 330);
  const c = sheet.getContext('2d');
  c.fillStyle = '#f5efdf';
  c.fillRect(0, 0, sheet.width, sheet.height);
  cells.forEach(({ animal, animation }, i) => {
    const x = (i % 3) * 400;
    const y = Math.floor(i / 3) * 330;
    c.fillStyle = '#71664f';
    c.font = '18px serif';
    c.fillText(`${animal.name} · ${animation.name}`, x + 20, y + 30);
    c.save();
    c.translate(x + 200, y + 270);
    c.scale(animal.scale * 0.9, animal.scale * 0.9);
    animal.draw(c as unknown as CanvasRenderingContext2D, day, animation.id, animation.duration * 0.45, 0);
    c.restore();
  });
  writeFileSync(process.argv[sheetAt + 1], sheet.toBuffer('image/png'));
}

// Interaction/lifecycle tests with a native-dialog shim (jsdom does not implement showModal).
register(new URL('./_startup-css-hook.mjs', import.meta.url));
const dom = new JSDOM('<!doctype html><html><body><button id="opener">Open</button><main></main></body></html>', {
  pretendToBeVisual: true,
  url: 'https://garden.example/',
});
const w = dom.window;
Object.assign(globalThis, { window: w, document: w.document, HTMLElement: w.HTMLElement });
w.matchMedia = () => ({ matches: false }) as unknown as MediaQueryList;
let nextFrame = 1;
const frames = new Map<number, FrameRequestCallback>();
Object.assign(globalThis, {
  requestAnimationFrame: (callback: FrameRequestCallback) => {
    const id = nextFrame++;
    frames.set(id, callback);
    return id;
  },
  cancelAnimationFrame: (id: number) => frames.delete(id),
});
w.HTMLDialogElement.prototype.showModal = function () {
  this.open = true;
};
w.HTMLDialogElement.prototype.close = function () {
  this.open = false;
};
const { AnimalGuide } = await import('../src/ui/animalGuide');
const guide = new AnimalGuide(w.document.querySelector('main')!);
const opener = w.document.querySelector<HTMLButtonElement>('#opener')!;
opener.focus();
guide.setOpen(true);
assert.ok(guide.isOpen);
assert.equal(frames.size, 1);
assert.equal(w.document.querySelectorAll('.ag-list button').length, GUIDE_ANIMALS.length);
const search = w.document.querySelector<HTMLInputElement>('input[type=search]')!;
search.value = 'череп';
search.dispatchEvent(new w.Event('input'));
assert.equal(w.document.querySelectorAll('.ag-list button').length, 1);
(w.document.querySelector('.ag-list button') as HTMLButtonElement).click();
assert.equal(w.document.querySelector('.ag-page h2')!.textContent, 'Черепаха');
assert.equal(w.document.querySelectorAll('[data-state]').length, 7);
(w.document.querySelector('[data-state=swim]') as HTMLButtonElement).click();
assert.equal(w.document.querySelector('[data-state=swim]')!.getAttribute('aria-pressed'), 'true');
search.value = 'ящер';
search.dispatchEvent(new w.Event('input'));
assert.equal(w.document.querySelectorAll('.ag-list button').length, 1);
(w.document.querySelector('.ag-list button') as HTMLButtonElement).click();
assert.equal(w.document.querySelector('.ag-page h2')!.textContent, 'Ящерица');
assert.equal(w.document.querySelectorAll('[data-state]').length, 9);
assert.equal(w.document.querySelectorAll('.ag-variants option').length, 4);
assert.equal(w.document.querySelectorAll('.ag-facts dt').length, 3);
assert.equal(w.document.querySelectorAll('.ag-observation img').length, 5);
assert.ok(!w.document.querySelector<HTMLElement>('.ag-observations')!.hidden);
for (const img of w.document.querySelectorAll<HTMLImageElement>('.ag-observation img')) {
  assert.ok(img.alt.length > 20);
  assert.equal(img.loading, 'lazy');
  assert.ok(img.src.endsWith('.webp'));
}
const guideSave = JSON.stringify(pondWorld.toJSON());
w.localStorage.setItem('save-sentinel', guideSave);
const variant = w.document.querySelector<HTMLSelectElement>('.ag-variants select')!;
variant.value = '3';
variant.dispatchEvent(new w.Event('change'));
assert.equal(variant.value, '3');
assert.equal(w.document.querySelector('[data-state=bask]')!.getAttribute('aria-pressed'), 'true');
(w.document.querySelector('[data-state=flee]') as HTMLButtonElement).click();
assert.equal(w.document.querySelector('[data-state=flee]')!.getAttribute('aria-pressed'), 'true');
assert.equal(w.localStorage.getItem('save-sentinel'), guideSave);
assert.equal(JSON.stringify(pondWorld.toJSON()), guideSave, 'the guide never changes the saved world');
search.value = 'череп';
search.dispatchEvent(new w.Event('input'));
(w.document.querySelector('.ag-list button') as HTMLButtonElement).click();
assert.ok(w.document.querySelector<HTMLElement>('.ag-observations')!.hidden);
assert.ok(w.document.querySelector<HTMLElement>('.ag-facts')!.hidden);
assert.equal(w.document.querySelectorAll('.ag-observation img').length, 0, 'no stale lizard cards on other pages');
search.value = 'сцинк';
search.dispatchEvent(new w.Event('input'));
assert.equal(w.document.querySelectorAll('.ag-list button').length, 1);
(w.document.querySelector('.ag-list button') as HTMLButtonElement).click();
assert.equal(w.document.querySelectorAll('.ag-observation img').length, 5);
search.value = 'несуществующий';
search.dispatchEvent(new w.Event('input'));
assert.ok(w.document.querySelector('.ag-empty'));
search.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
assert.ok(!guide.isOpen);
assert.equal(frames.size, 0, 'closed guide must cancel animation frame');
assert.equal(w.document.activeElement, opener);
guide.setOpen(true);
guide.setOpen(true);
assert.equal(frames.size, 1, 'reopen must not duplicate frame loops');
guide.setOpen(false);
w.matchMedia = () => ({ matches: true }) as unknown as MediaQueryList;
const reduced = new AnimalGuide(w.document.querySelector('main')!);
reduced.setOpen(true);
assert.equal(
  w.document.querySelector('.animal-guide[open] .ag-play')!.getAttribute('aria-label'),
  'Воспроизвести анимацию',
);
assert.equal(w.document.querySelector('.animal-guide[open] [data-state=bask]')!.getAttribute('aria-pressed'), 'true');
reduced.setOpen(false);
assert.equal(frames.size, 0);
w.close();
console.log('ок: поиск, страницы, переключение анимаций, Escape из поиска, возврат фокуса и остановка rAF');
