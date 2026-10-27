'use strict';
// Уровни собираются из сегментов-карт высотой 11 клеток (16px). Легенда:
//   G земля   B кирпич (ломается головой)   ? блок с чипсами   ! блок с бустером   # коробка
//   = полка (можно запрыгнуть снизу)   ~ ездит влево-вправо   ^ лифт вверх-вниз   T батут
//   c чипсы/корм   b бустер   1-6 враги (по списку мира)   C чекпоинт   F финиш   P старт
//   L пиво (двойной прыжок)   V водка (кнопки меняются местами) — только у Саши и Сони
//   R эстафета — здесь ждёт следующий герой (в уровне пишется сегментом 'relay:имя')

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
    '.L............2.',
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
    '..V.....ccc.......',
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
    '.......cc.......',
    '................',
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
  // эстафета: ровная земля, посередине ждёт следующий герой
  relay: [
    '..............',
    '..............',
    '..............',
    '..............',
    '..............',
    '..............',
    '..............',
    '..............',
    '......R.......',
    'GGGGGGGGGGGGGG',
    'GGGGGGGGGGGGGG',
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

// Кампания «Чипсы идут домой»: 3 главы по 4 уровня. Герой каждого уровня задан сюжетом,
// последний уровень главы — побег с эстафетой (пакет чипсов передают следующему герою).
const CHAPTERS = [
  { name: 'ГЛАВА 1 · ВОЛГА', text: 'Саша покупает чипсы на набережной и несёт их через Жигули' },
  { name: 'ГЛАВА 2 · ГОРОД', text: 'Саша передал пакет Соне — она пробирается через город' },
  { name: 'ГЛАВА 3 · КВАРТИРА', text: 'Дома чипсы стащил кот — Чипс удирает с добычей' },
];
const CAMPAIGN = [
  { chapter: 0, hero: 'sasha', name: 'Набережная', segs: ['start', 'flat', 'gap1', 'boxes', 'boost', 'plat', 'check', 'enemies', 'gap2', 'high', 'finish'] },
  { chapter: 0, hero: 'sasha', name: 'Пляж', segs: ['start', 'plat', 'mover', 'flat', 'check', 'bricks', 'spring', 'boost', 'gap2', 'enemies', 'finish'] },
  { chapter: 0, hero: 'sasha', name: 'Жигули', segs: ['start', 'boxes', 'lift', 'flyers', 'check', 'bricks', 'mover', 'spring', 'boost', 'enemies', 'high', 'hazard', 'finish'] },
  { chapter: 0, hero: 'sasha', name: 'Передай Соне', escape: true, segs: ['start', 'flat', 'gap1', 'boxes', 'enemies', 'relay:sonya', 'gap2', 'plat', 'bricks', 'flyers', 'hazard', 'finish'] },
  { chapter: 1, hero: 'sonya', name: 'Кофейня', segs: ['start', 'flat', 'boxes', 'gap1', 'boost', 'enemies', 'check', 'plat', 'gap2', 'high', 'finish'] },
  { chapter: 1, hero: 'sonya', name: 'Огни набережной', segs: ['start', 'bricks', 'mover', 'flat', 'check', 'flyers', 'spring', 'boost', 'enemies', 'gap2', 'finish'] },
  { chapter: 1, hero: 'sonya', name: 'Порт', segs: ['start', 'plat', 'lift', 'hazard', 'check', 'mover', 'bricks', 'spring', 'boost', 'flyers', 'enemies', 'high', 'finish'] },
  { chapter: 1, hero: 'sonya', name: 'Домой к Чипсу', escape: true, segs: ['start', 'gap1', 'flat', 'enemies', 'boxes', 'relay:chips', 'high', 'gap2', 'hazard', 'flyers', 'flat', 'finish'] },
  { chapter: 2, hero: 'chips', name: 'Гостиная', segs: ['start', 'flat', 'high', 'boxes', 'boost', 'gap1', 'check', 'enemies', 'high', 'gap2', 'finish'] },
  { chapter: 2, hero: 'chips', name: 'Кухня', segs: ['start', 'hazard', 'plat', 'mover', 'check', 'high', 'bricks', 'boost', 'spring', 'enemies', 'finish'] },
  { chapter: 2, hero: 'chips', name: 'Ванная', segs: ['start', 'hazard', 'lift', 'flyers', 'check', 'high', 'mover', 'hazard', 'boost', 'spring', 'enemies', 'high', 'finish'] },
  { chapter: 2, hero: 'sasha', name: 'Чипсы моя жизнь', escape: true, final: true, segs: ['start', 'flat', 'gap1', 'enemies', 'relay:sonya', 'plat', 'bricks', 'gap2', 'relay:chips', 'high', 'hazard', 'flyers', 'finish'] },
];

// Склеивает сегменты уровня в одну карту. heroAt[c] — чей это столбец (меняется после эстафеты),
// relayTo[c] — к какому герою переходит эстафета в этом столбце.
function buildLevelMap(level) {
  const rows = Array.from({ length: 11 }, () => '');
  const heroAt = [], relayTo = {};
  let hero = level.hero;
  for (const name of level.segs) {
    const [segName, next] = name.split(':');
    const seg = SEGMENTS[segName];
    const w = Math.max(...seg.map(r => r.length));
    const c0 = rows[0].length;
    for (let r = 0; r < 11; r++) rows[r] += (seg[r] || '').padEnd(w, '.');
    for (let i = 0; i < w; i++) heroAt.push(hero);
    if (next) {
      const rc = seg[8].indexOf('R');
      relayTo[c0 + rc] = next;
      hero = next;
      // мир меняется прямо за эстафетой, а не в конце сегмента
      for (let i = rc + 1; i < w; i++) heroAt[c0 + i] = next;
    }
  }
  return { rows, heroAt, relayTo };
}

// Прогресс кампании: звёзды за каждый из 12 уровней (старый прогресс по героям не переносим)
const Progress = {
  KEY: 'chips_campaign',
  get() {
    try {
      const v = JSON.parse(localStorage.getItem(this.KEY));
      if (v && Array.isArray(v.stars)) return v;
    } catch (e) { /* нет данных */ }
    return { stars: CAMPAIGN.map(() => 0) };
  },
  save(idx, stars) {
    const p = this.get();
    p.stars[idx] = Math.max(p.stars[idx] || 0, stars);
    try { localStorage.setItem(this.KEY, JSON.stringify(p)); } catch (e) { /* нет доступа */ }
  },
  unlocked(idx) { return idx === 0 || this.get().stars[idx - 1] > 0; },
  total() { return this.get().stars.reduce((a, b) => a + b, 0); },
};
