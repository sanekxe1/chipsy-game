"""Рисует аватарку бота: пиксельный портрет Чипса, 640x640 PNG.

Запуск: python3 tools/avatar.py  ->  assets/chips-avatar.png
"""
import os
import struct
import zlib

PAL = {
    'k': (27, 22, 38), 'g': (143, 130, 115), 'G': (74, 64, 56),
    'w': (255, 255, 255), 'p': (244, 163, 180), 'P': (232, 132, 143),
    'e': (181, 209, 74), 'x': (27, 22, 38), 'h': (255, 255, 255),
    'o': (208, 138, 74),
}
BG, CRUMB = (255, 210, 63), (240, 178, 40)

# Левая половина морды, правая получается зеркалом
EYE = ['ggkkkgg', 'gkeeekg', 'kexxhek', 'kexxxek', 'kexxxek', 'gkeeekw', 'ggkkkww']
LEFT = [
    '................',
    '..k.............',
    '..kk............',
    '..kgk...........',
    '..kpgk..........',
    '..kppgk.........',
    '..kpppgk........',
    '..kppppgk.......',
    '.kgppppggkkkkkkk',
    '.kgpppgggggGgggg',
    '.kggppggggGgggGg',
    'kgggggGgggggGgww',
    'kggGgggggggggwww',
    'kgGgg' + EYE[0] + 'gwww',
    'kggGg' + EYE[1] + 'gwww',
    'kgggg' + EYE[2] + 'wwww',
    'kgGgg' + EYE[3] + 'wwww',
    'kgggg' + EYE[4] + 'wwww',
    'kggGg' + EYE[5] + 'wwww',
    'kgggg' + EYE[6] + 'wwww',
    'kgggggwwwwwwwwPP',
    '.kgggwwwwwwwwwPP',
    '.kggwwwwwwwwwwwP',
    '.kgwwwwwwwwwwkwk',
    '..kwwwwwwwwwwwkw',
    '..kwwwwwwwwwwwww',
    '...kkwwwwwwwwwww',
    '..kggkkwwwwwwwww',
    '.kgggGgkwwwwwwww',
    'kggGgggkwwwwwwww',
    'kgggggGgwwwwwwww',
    'kggGggggwwwwwwww',
]
FACE = [list(r + r[::-1]) for r in LEFT]
# рыжее пятнышко слева от носа, как на фото
for y, xs in ((19, (12,)), (20, (11, 12, 13)), (21, (11, 12, 13)), (22, (12,))):
    for x in xs:
        FACE[y][x] = 'o'

N, OX, OY, SCALE = 40, 4, 8, 16
grid = [[BG] * N for _ in range(N)]
for x, y in ((5, 5), (33, 7), (30, 2), (8, 15), (36, 17), (2, 26), (37, 30), (12, 2)):  # крошки чипсов
    grid[y][x] = CRUMB
for y, row in enumerate(FACE):
    for x, ch in enumerate(row):
        if ch != '.':
            grid[OY + y][OX + x] = PAL[ch]

size = N * SCALE
raw = b''.join(
    b'\x00' + b''.join(bytes(grid[y // SCALE][x // SCALE]) for x in range(size))
    for y in range(size)
)


def chunk(tag, data):
    return struct.pack('>I', len(data)) + tag + data + struct.pack('>I', zlib.crc32(tag + data) & 0xffffffff)


png = (b'\x89PNG\r\n\x1a\n'
       + chunk(b'IHDR', struct.pack('>IIBBBBB', size, size, 8, 2, 0, 0, 0))
       + chunk(b'IDAT', zlib.compress(raw, 9))
       + chunk(b'IEND', b''))
out = os.path.join(os.path.dirname(__file__), '..', 'assets', 'chips-avatar.png')
os.makedirs(os.path.dirname(out), exist_ok=True)
with open(out, 'wb') as f:
    f.write(png)
print(os.path.abspath(out))
