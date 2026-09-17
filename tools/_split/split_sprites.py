import re, os

SRC = 'src/render/sprites.ts'
lines = open(SRC).read().split('\n')

# (стартовая строка 1-based, имя-декларации, модуль, экспортировать ли)
BLOCKS = [
    (10,  'interface DrawCtx', 'common', True),
    (28,  'const WHITE', 'common', True),
    (30,  'function litc', 'common', True),
    (42,  'let skipShadows', 'common', False),
    (44,  'let shadowProbe', 'common', False),
    (46,  'function setSkipShadows', 'common', True),
    (50,  'function shadowUnder', 'common', True),
    (72,  'interface TreeStyle', 'trees', False),
    (86,  'function crownColor', 'trees', False),
    (96,  'function drawTrunk', 'trees', False),
    (114, 'function drawBranches', 'trees', False),
    (136, 'function drawBareCrown', 'trees', False),
    (176, 'function makeTree', 'trees', False),
    (281, 'const drawSakura', 'trees', True),
    (294, 'const drawMaple', 'trees', True),
    (306, 'const drawGinkgo', 'trees', True),
    (318, 'const drawWillow', 'trees', True),
    (331, 'const drawPine', 'trees', True),
    (376, 'const drawBamboo', 'trees', True),
    (425, 'const drawShrub', 'trees', True),
    (465, 'function makeRock', 'ground', True),
    (522, 'const drawStepStone', 'ground', True),
    (536, 'const drawMossClump', 'ground', True),
    (545, 'const drawPebbles', 'ground', True),
    (563, 'const drawGrassTuft', 'ground', True),
    (582, 'function makeFlower', 'ground', True),
    (610, 'const drawFern', 'ground', True),
    (642, 'const drawLilypad', 'water', True),
    (674, 'const drawLotus', 'water', True),
    (719, 'const drawKoi', 'water', True),
    (771, 'const drawBridge', 'bridges', True),
    (905, 'function lanternLight', 'light', False),
    (915, 'const drawStoneLantern', 'light', True),
    (975, 'const drawPaperLantern', 'light', True),
    (1008, 'const drawPathLight', 'light', True),
    (1030, 'const drawBrazier', 'light', True),
    (1069, 'const drawPavilion', 'buildings', True),
    (1135, 'const drawTorii', 'buildings', True),
    (1160, 'const drawShoji', 'buildings', True),
    (1201, 'const drawTable', 'interior', True),
    (1234, 'const drawCushion', 'interior', True),
    (1252, 'const drawTsukubai', 'interior', True),
    (1291, 'const drawShishi', 'interior', True),
    (1335, 'const drawWindChime', 'interior', True),
    (1366, 'const drawBowl', 'interior', True),
    (1380, 'const drawCat', 'interior', True),
    (1484, 'const drawWisteria', 'trees', True),
    (1573, 'const drawPersimmon', 'trees', True),
    (1656, 'const drawCamellia', 'trees', True),
    (1722, 'function panelQuad', 'buildings', False),
    (1740, 'const drawFusuma', 'buildings', True),
    (1814, 'const drawTokonoma', 'buildings', True),
    (1891, 'const drawIrori', 'interior', True),
    (1967, 'const drawFuton', 'interior', True),
    (2032, 'const drawByobu', 'interior', True),
    (2076, 'const drawBonsai', 'interior', True),
    (2116, 'const drawReed', 'water', True),
    (2150, 'const drawHorsetail', 'water', True),
    (2185, 'const drawWaterStone', 'water', True),
    (2219, 'const drawPlankBridge', 'bridges', True),
]
END = 2288  # строка перед const DRAWERS

# проверка меток
for start, name, *_ in BLOCKS:
    line = lines[start - 1]
    assert re.search(re.escape(name), line), f'метка не совпала: строка {start} «{line}» ≠ «{name}»'

# режем на блоки [start,end), конец — перед следующим start
ranges = []
for i, (start, name, mod, exp) in enumerate(BLOCKS):
    end = BLOCKS[i + 1][0] - 1 if i + 1 < len(BLOCKS) else END
    block = lines[start - 1:end]
    # «плавающий хвост»: пустые строки и комментарии с 0-й колонки в конце
    # блока принадлежат следующей декларации — переносим
    trailer = []
    while block and (block[-1].strip() == '' or (block[-1].startswith('//') )):
        trailer.insert(0, block.pop())
    if exp and not block[0].startswith('export '):
        block[0] = 'export ' + block[0]
    ranges.append([name, mod, exp, block, trailer])

# приклеиваем хвосты к началу следующего блока (хвост первого блока при litc...)
for i in range(len(ranges) - 1):
    tr = ranges[i][4]
    if tr:
        ranges[i + 1][3] = tr + ranges[i + 1][3]

# собираем модули
mods = {}
for name, mod, exp, block, _ in ranges:
    mods.setdefault(mod, []).append(block)

BASE_IMPORTS = [
    ("import { LEVEL_H, TILE_H, TILE_W } from '../../core/iso';", ['LEVEL_H', 'TILE_H', 'TILE_W']),
    ("import { clamp01, hash2, lerp, makeRng } from '../../core/rng';", ['clamp01', 'hash2', 'lerp', 'makeRng']),
    ("import { Atmosphere, RGB, css, mix, shade } from '../../world/palette';", ['Atmosphere', 'RGB', 'css', 'mix', 'shade']),
    ("import { PlacedObject } from '../../world/types';", ['PlacedObject']),
    ("import { ITEM_BY_ID } from '../../world/catalog';", ['ITEM_BY_ID']),
    ("import { Ctx, blobPath, glow, granulate, softShadow, taperStroke, washBlob } from '../paint';",
     ['Ctx', 'blobPath', 'glow', 'granulate', 'softShadow', 'taperStroke', 'washBlob']),
]
COMMON_SYMS = ['DrawCtx', 'Drawer', 'WHITE', 'litc', 'setSkipShadows', 'shadowUnder']

def pick_imports(body, mod):
    out = []
    for imp, names in BASE_IMPORTS:
        used = [n for n in names if re.search(r'\b' + n + r'\b', body)]
        if used:
            tail = imp[imp.index(' from'):]
            out.append('import { ' + ', '.join(used) + ' }' + tail + ';')
    if mod != 'common':
        used = [n for n in COMMON_SYMS if re.search(r'\b' + n + r'\b', body)]
        if used:
            out = ["import { " + ', '.join(used) + " } from './common';"] + out
    return out

HEADERS = {
    'common': '/** Общая утварь рисовальщиков: контекст, освещение, тени. */',
    'trees': '/** Деревья и кусты: стволы, ветви, кроны — стартовый сад почти весь отсюда. */',
    'ground': '/** Камни и мелочь земли: валуны, шаговые камни, мох, цветы и папоротники. */',
    'water': '/** Жители пруда и водяные растения. */',
    'bridges': '/** Мост и мостки: дуга ведёт от берега к берегу, к устоям код относится бережно. */',
    'light': '/** Свет сада: фонари бумажные и каменные, жаровня. */',
    'buildings': '/** Постройки: беседка, тории, раздвижные панели дома. */',
    'interior': '/** Интерьер и обитатели: мебель, цубукубай, сисиодоси, кот. */',
}

os.makedirs('src/render/sprites', exist_ok=True)
for mod, blocks in mods.items():
    body = '\n\n'.join('\n'.join(b).rstrip() + '\n' for b in blocks)
    imps = '\n'.join(pick_imports(body, mod))
    content = HEADERS[mod] + '\n\n' + (imps + '\n\n' if imps else '') + body
    open(f'src/render/sprites/{mod}.ts', 'w').write(content)
    print(mod, len(blocks), 'блоков,', len(content.split()), 'слов')

