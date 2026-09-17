import re

SRC = 'src/render/scene.ts'
lines = open(SRC).read().split('\n')
file = '\n'.join(lines)

# (имя метода, старая сигнатура, новая сигнатура)
CUTS = [
    ("drawSky",        "  private drawSky(ctx: Ctx, W: number, H: number, atm: Atmosphere, time: number): void {",
                        "export function drawSky(ctx: Ctx, W: number, H: number, atm: Atmosphere, time: number): void {"),
    ("drawMountains",  "  private drawMountains(ctx: Ctx, W: number, H: number, atm: Atmosphere): void {",
                        "export function drawMountains(ctx: Ctx, W: number, H: number, atm: Atmosphere): void {"),
    ("drawIslandShadow","  private drawIslandShadow(ctx: Ctx, atm: Atmosphere): void {",
                        "export function drawIslandShadow(ctx: Ctx, atm: Atmosphere): void {"),
    ("drawGrid",       "  private drawGrid(ctx: Ctx, world: World, atm: Atmosphere): void {",
                        "export function drawGrid(ctx: Ctx, world: World, atm: Atmosphere, zoom: number): void {"),
    ("drawObjectMarker","  private drawObjectMarker(\n    ctx: Ctx,\n    cx: number,\n    cy: number,\n    lvl: number,\n    strong: boolean,\n    time: number,\n  ): void {",
                        "export function drawObjectMarker(\n  ctx: Ctx,\n  cx: number,\n  cy: number,\n  lvl: number,\n  strong: boolean,\n  time: number,\n  zoom: number,\n): void {"),
    ("drawPathPreview","  private drawPathPreview(ctx: Ctx, world: World, time: number): void {",
                        "export function drawPathPreview(\n  ctx: Ctx,\n  world: World,\n  time: number,\n  pathFrom: { x: number; y: number } | null,\n  pathPreview: { x: number; y: number }[] | null,\n  zoom: number,\n): void {"),
    ("drawGhost",      "  private drawGhost(ctx: Ctx, world: World, atm: Atmosphere, time: number): void {",
                        "export function drawGhost(\n  ctx: Ctx,\n  world: World,\n  atm: Atmosphere,\n  time: number,\n  ghost: GhostPreview,\n  wind: number,\n  zoom: number,\n): void {"),
    ("drawObjects",    "  private drawObjects(ctx: Ctx, world: World, atm: Atmosphere, time: number): void {",
                        "export function drawObjects(\n  ctx: Ctx,\n  world: World,\n  atm: Atmosphere,\n  time: number,\n  opts: ObjectsOpts,\n): void {"),
    ("drawWindowGlow", "  private drawWindowGlow(ctx: Ctx, world: World, atm: Atmosphere): void {",
                        "export function drawWindowGlow(ctx: Ctx, world: World, atm: Atmosphere): void {"),
    ("drawPaperGrain", "  private drawPaperGrain(ctx: Ctx, W: number, H: number): void {",
                        "export function drawPaperGrain(ctx: Ctx, W: number, H: number, paperPattern: CanvasPattern | null): CanvasPattern | null {"),
    ("drawColorGrade", "  private drawColorGrade(ctx: Ctx, W: number, H: number, atm: Atmosphere): void {",
                        "export function drawColorGrade(ctx: Ctx, W: number, H: number, atm: Atmosphere): void {"),
]

bodies = {}
for name, oldsig, newsig in CUTS:
    i = file.index(oldsig)
    # находим конец метода: идём по скобкам
    j = i + len(oldsig)
    depth = 1
    while depth > 0:
        ch = file[j]
        if ch == '{': depth += 1
        elif ch == '}': depth -= 1
        j += 1
    body = file[i:j]
    body = body.replace(oldsig, newsig, 1)
    bodies[name] = body

# точечные подстановки внутри переносимых тел
def sub_all(t, pairs):
    for a, b in pairs:
        a_old, a_new = a, b
        t = t.replace(a_old, a_new)
    return t

common_this = [("this.camera.zoom", "zoom"), ("this/.camera", "zoom")]
bodies["drawGrid"] = sub_all(bodies["drawGrid"], [("this.camera.zoom", "zoom")])
bodies["drawObjectMarker"] = sub_all(bodies["drawObjectMarker"], [("this.camera.zoom", "zoom")])
bodies["drawPathPreview"] = sub_all(bodies["drawPathPreview"], [
    ("this.camera.zoom", "zoom"), ("this.pathFrom", "pathFrom"), ("this.pathPreview", "pathPreview"),
])
bodies["drawGhost"] = sub_all(bodies["drawGhost"], [
    ("this.camera.zoom", "zoom"), ("this.ghost!", "ghost"), ("this.wind", "wind"),
])
bodies["drawObjects"] = sub_all(bodies["drawObjects"], [
    ("this.camera.zoom", "opts.zoom"),
    ("this.viewW", "opts.viewW"),
    ("this.viewH", "opts.viewH"),
    ("this.worldToScreen(p.x, p.y)", "{ x: (p.x - opts.camX) * opts.zoom + opts.viewW / 2, y: (p.y - opts.camY) * opts.zoom + opts.viewH / 2 }"),
    ("this.life", "opts.life"),
    ("this.wind", "opts.wind"),
    ("this.movingId", "opts.movingId"),
    ("this.highlightId", "opts.highlightId"),
    ("this.useSpriteCache", "opts.useSpriteCache"),
    ("this.particles", "opts.particles"),
    ("this.drawObjectMarker(ctx, cx, cy, lvl, isMoving, time)", "drawObjectMarker(ctx, cx, cy, lvl, isMoving, time, opts.zoom)"),
    ("this.drawWindowGlow(", "drawWindowGlow("),
])
bodies["drawSky"] = sub_all(bodies["drawSky"], [("this.drawMountains(", "drawMountains(")])
# drawPaperGrain: паттерн как параметр, возвращаем (возможно новый)
pg = bodies["drawPaperGrain"]
assert "this.paperPattern" in pg
pg = pg.replace("this.paperPattern", "paperPattern")
pg = pg.rstrip().rstrip('}').rstrip() + """
  return paperPattern;
}"""
bodies["drawPaperGrain"] = pg

# сцена: выкидываем перенесённые методы, переделываем вызовы в render()
scene = file
for name, oldsig, _ in CUTS:
    i = scene.index(oldsig)
    j = i + len(oldsig)
    depth = 1
    while depth > 0:
        ch = scene[j]
        if ch == '{': depth += 1
        elif ch == '}': depth -= 1
        j += 1
    # снимаем ведущий пустой ряд после метода
    k = j
    while k < len(scene) and scene[k] == '\n':
        if scene[k + 1] == '\n':
            j = k + 1
            break
        k += 1
    scene = scene[:i].rstrip() + '\n\n' + scene[j:].lstrip('\n')

R = [
    ("this.drawSky(ctx, W, H, atm, time);", "drawSky(ctx, W, H, atm, time);"),
    ("this.drawIslandShadow(ctx, atm);", "drawIslandShadow(ctx, atm);"),
    ("this.drawGrid(ctx, world, atm);", "drawGrid(ctx, world, atm, this.camera.zoom);"),
    ("this.drawPathPreview(ctx, world, time);", "drawPathPreview(ctx, world, time, this.pathFrom, this.pathPreview, this.camera.zoom);"),
    ("this.drawGhost(ctx, world, atm, time);", "drawGhost(ctx, world, atm, time, this.ghost, this.wind, this.camera.zoom);"),
    ("this.drawObjects(ctx, world, atm, time);",
     "drawObjects(ctx, world, atm, time, {\n      life: this.life,\n      wind: this.wind,\n      zoom: this.camera.zoom,\n      camX: this.camera.x,\n      camY: this.camera.y,\n      viewW: this.viewW,\n      viewH: this.viewH,\n      movingId: this.movingId,\n      highlightId: this.highlightId,\n      useSpriteCache: this.useSpriteCache,\n      particles: this.particles,\n    });"),
    ("this.drawPaperGrain(ctx, W, H);", "this.paperPattern = drawPaperGrain(ctx, W, H, this.paperPattern);"),
    ("this.drawColorGrade(ctx, W, H, atm);", "drawColorGrade(ctx, W, H, atm);"),
]
for a, b in R:
    assert a in scene, a
    scene = scene.replace(a, b)

# импорт шагов в scene
anchor = "import { drawCurrent, drawFalls, drawShoreRipple } from './water';"
assert anchor in scene
scene = scene.replace(anchor, anchor + "\nimport {\n  drawSky,\n  drawIslandShadow,\n  drawGrid,\n  drawPathPreview,\n  drawGhost,\n  drawObjects,\n  drawPaperGrain,\n  drawColorGrade,\n} from './scene-steps';")

OPEN_STEPS = """/**
 * Шаги отрисовки сцены — чистые функции над контекстом холста.
 *
 * Порядок и обоснования слоёв остаются в Scene.render; здесь — сами мазки:
 * небо и горы, тень-подложка, строительная сетка, призрак и подсветки,
 * сортированные объекты, свечение окон, зерно бумаги и цветокоррекция.
 */

import { GRID, TILE_H, TILE_W, isoToScreen } from '../../core/iso';
import { ITEM_BY_ID } from '../../world/catalog';
import { Atmosphere, RGB, css, mix } from '../../world/palette';
import { PlacedObject } from '../../world/types';
import { World } from '../../world/world';
import { Ctx, getPaperTile, glow } from '../paint';
import { drawCost, drawObject, drawObjectShadow } from '../sprites';
import { cacheable, cachedGrowth, drawCached } from '../spriteCache';
import { drawBird, drawButterfly, drawCat } from '../creatures';
import type { GhostPreview } from './scene';

/** Наборка состояния сцены, нужная одному кадру сортированных объектов. */
export interface ObjectsOpts {
  life: import('../../world/life').Life | null;
  wind: number;
  zoom: number;
  camX: number;
  camY: number;
  viewW: number;
  viewH: number;
  movingId: number;
  highlightId: number;
  useSpriteCache: boolean;
  particles: boolean;
}

"""
steps = OPEN_STEPS + '\n\n'.join(bodies[n] for n, _, _ in CUTS) + '\n'
open('src/render/scene-steps.ts', 'w').write(steps)
open('src/render/scene.ts', 'w').write(scene)
print('готово')
