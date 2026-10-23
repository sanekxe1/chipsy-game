'use strict';
// Уровни собираются из сегментов-карт высотой 11 клеток (16px). Легенда:
//   G земля   B кирпич (ломается головой)   ? блок с чипсами   ! блок с бустером   # коробка
//   = полка (можно запрыгнуть снизу)   ~ ездит влево-вправо   ^ лифт вверх-вниз   T батут
//   c чипсы/корм   b бустер   1-6 враги (по списку мира)   C чекпоинт   F финиш   P старт

const SEGMENTS = {
  start: [
    '..............',
    '..............',
    '..............',
    '..............',
    '..............',
    '..............',
    '..............',
    '..............',
    '......P.ccc...',
    'GGGGGGGGGGGGGG',
    'GGGGGGGGGGGGGG',
  ],
  flat: [
    '................',
    '................',
    '................',
    '................',
    '.......c........',
    '................',
    '.....B?B........',
    '................',
    '...cc......1....',
    'GGGGGGGGGGGGGGGG',
    'GGGGGGGGGGGGGGGG',
  ],
  gap1: [
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '......ccc.......',
    '................',
    'GGGGGG...GGGGGGG',
    'GGGGGG...GGGGGGG',
  ],
  gap2: [
    '................',
    '................',
    '................',
    '................',
    '................',
    '.....c.....c....',
    '................',
    '................',
    '..............2.',
    'GGG...GGG...GGGG',
    'GGG...GGG...GGGG',
  ],
  boxes: [
    '................',
    '................',
    '................',
    '................',
    '................',
    '...........c....',
    '..........##....',
    '.......c.###....',
    '......#####...2.',
    'GGGGGGGGGGGGGGGG',
    'GGGGGGGGGGGGGGGG',
  ],
  plat: [
    '..................',
    '..................',
    '..................',
    '..................',
    '..........ccc.....',
    '..................',
    '....B?B?B..===....',
    '..................',
    '.....3.......1....',
    'GGGGGGGGGGGGGGGGGG',
    'GGGGGGGGGGGGGGGGGG',
  ],
  boost: [
    '............',
    '............',
    '............',
    '............',
    '............',
    '............',
    '....B!B.....',
    '............',
    '............',
    'GGGGGGGGGGGG',
    'GGGGGGGGGGGG',
  ],
  mover: [
    '..................',
    '..................',
    '..................',
    '..................',
    '..................',
    '.......ccc........',
    '..................',
    '..................',
    '.......~~~........',
    'GGGG..........GGGG',
    'GGGG..........GGGG',
  ],
  spring: [
    '................',
    '................',
    '..........cc....',
    '................',
    '..........##....',
    '..........##....',
    '..........##....',
    '..........##....',
    '.......T..##..1.',
    'GGGGGGGGGGGGGGGG',
    'GGGGGGGGGGGGGGGG',
  ],
  bricks: [
    '..................',
    '..................',
    '..................',
    '..................',
    '..................',
    '......cccc........',
    '.....BBBBBB.......',
    '..................',
    '........4....1....',
    'GGGGGGGGGGGGGGGGGG',
    'GGGGGGGGGGGGGGGGGG',
  ],
  lift: [
    '................',
    '................',
    '................',
    '...........cc...',
    '................',
    '..........GGGGGG',
    '..........GGGGGG',
    '.....^^...GGGGGG',
    '..........GGGGGG',
    'GGGGG.....GGGGGG',
    'GGGGG.....GGGGGG',
  ],
  high: [
    '................',
    '..............c.',
    '...........====.',
    '................',
    '.......====.....',
    '........c.......',
    '...====.........',
    '................',
    '............5...',
    'GGGGGGGGGGGGGGGG',
    'GGGGGGGGGGGGGGGG',
  ],
  enemies: [
    '..................',
    '..................',
    '..................',
    '..................',
    '..................',
    '..................',
    '..................',
    '........ccc.......',
    '..#....1..2....#..',
    'GGGGGGGGGGGGGGGGGG',
    'GGGGGGGGGGGGGGGGGG',
  ],
  flyers: [
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '......3.....5...',
    '................',
    '.......cc.......',
    'GGGGGG....GGGGGG',
    'GGGGGG....GGGGGG',
  ],
  hazard: [
    '................',
    '................',
    '................',
    '................',
    '................',
    '......c...c.....',
    '................',
    '................',
    '......6...6...1.',
    'GGGGGGGGGGGGGGGG',
    'GGGGGGGGGGGGGGGG',
  ],
  check: [
    '........',
    '........',
    '........',
    '........',
    '........',
    '........',
    '........',
    '........',
    '...C....',
    'GGGGGGGG',
    'GGGGGGGG',
  ],
  finish: [
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '.......F........',
    'GGGGGGGGGGGGGGGG',
    'GGGGGGGGGGGGGGGG',
  ],
};

// Враги по номерам 1-6 для каждого набора
const LEVEL_ENEMIES = {
  work: ['work', 'deadline', 'email', 'alarm', 'bill', 'dishes'],
  cat: ['vacuum', 'dog', 'clipper', 'pill', 'blower', 'fountain'],
};

const LEVELS = {
  sasha: [
    { name: 'Набережная', segs: ['start', 'flat', 'gap1', 'boxes', 'boost', 'plat', 'check', 'enemies', 'gap2', 'high', 'finish'] },
    { name: 'Пляж', segs: ['start', 'plat', 'mover', 'flat', 'check', 'bricks', 'spring', 'boost', 'gap2', 'enemies', 'finish'] },
    { name: 'Жигули', segs: ['start', 'boxes', 'lift', 'flyers', 'check', 'bricks', 'mover', 'spring', 'boost', 'enemies', 'high', 'hazard', 'finish'] },
    { name: 'Побег от дедлайнов', escape: true, segs: ['start', 'flat', 'gap1', 'boxes', 'enemies', 'boost', 'gap2', 'plat', 'bricks', 'flat', 'flyers', 'hazard', 'finish'] },
  ],
  sonya: [
    { name: 'Кофейня', segs: ['start', 'flat', 'boxes', 'gap1', 'boost', 'enemies', 'check', 'plat', 'gap2', 'high', 'finish'] },
    { name: 'Набережная', segs: ['start', 'bricks', 'mover', 'flat', 'check', 'flyers', 'spring', 'boost', 'enemies', 'gap2', 'finish'] },
    { name: 'Порт', segs: ['start', 'plat', 'lift', 'hazard', 'check', 'mover', 'bricks', 'spring', 'boost', 'flyers', 'enemies', 'high', 'finish'] },
    { name: 'Побег от работы', escape: true, segs: ['start', 'gap1', 'flat', 'enemies', 'boxes', 'boost', 'plat', 'gap2', 'hazard', 'bricks', 'flyers', 'flat', 'finish'] },
  ],
  chips: [
    { name: 'Гостиная', segs: ['start', 'flat', 'high', 'boxes', 'boost', 'gap1', 'check', 'enemies', 'high', 'gap2', 'finish'] },
    { name: 'Кухня', segs: ['start', 'hazard', 'plat', 'mover', 'check', 'high', 'bricks', 'boost', 'spring', 'enemies', 'finish'] },
    { name: 'Ванная', segs: ['start', 'hazard', 'lift', 'flyers', 'check', 'high', 'mover', 'hazard', 'boost', 'spring', 'enemies', 'high', 'finish'] },
    { name: 'Побег от купания', escape: true, segs: ['start', 'flat', 'hazard', 'gap1', 'high', 'boost', 'enemies', 'gap2', 'plat', 'flyers', 'hazard', 'flat', 'finish'] },
  ],
};

// Склеивает сегменты уровня в одну карту
function buildLevelMap(level) {
  const rows = Array.from({ length: 11 }, () => '');
  for (const name of level.segs) {
    const seg = SEGMENTS[name];
    const w = Math.max(...seg.map(r => r.length));
    for (let r = 0; r < 11; r++) rows[r] += (seg[r] || '').padEnd(w, '.');
  }
  return rows;
}

const Progress = {
  get(hero) {
    try {
      const v = JSON.parse(localStorage.getItem('chips_lvl_' + hero));
      if (v && Array.isArray(v.stars)) return v;
    } catch (e) { /* нет данных */ }
    return { stars: LEVELS[hero].map(() => 0) };
  },
  save(hero, idx, stars) {
    const p = this.get(hero);
    p.stars[idx] = Math.max(p.stars[idx] || 0, stars);
    try { localStorage.setItem('chips_lvl_' + hero, JSON.stringify(p)); } catch (e) { /* нет доступа */ }
  },
  unlocked(hero, idx) { return idx === 0 || this.get(hero).stars[idx - 1] > 0; },
  total(hero) { return this.get(hero).stars.reduce((a, b) => a + b, 0); },
};
