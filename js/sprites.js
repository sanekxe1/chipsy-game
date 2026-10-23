'use strict';
// Пиксель-арт задаётся строками: каждая буква — цвет из палитры, '.' — прозрачный пиксель.
// Все спрайты рисуются кодом при загрузке, внешних картинок нет.

const PAL = {
  k: '#1b1626', x: '#2a2a33', w: '#ffffff', m: '#c9ced6', M: '#8b93a1',
  s: '#f6c7a1', S: '#dc9c78', e: '#1b1626',
  r: '#e33b2e', R: '#a5231b', y: '#ffd23f', Y: '#e09a12', l: '#fff0b0',
  g: '#9aa3ad', G: '#626b78', n: '#5cc93a', N: '#2f8a2a',
  b: '#3d7be0', B: '#264f9e', c: '#4cc3f0', p: '#f49cb3',
  o: '#a0602c', O: '#6b3a17', v: '#8a5cf0', t: '#d9a35b', T: '#a8743a',
};

function hexToRgb(h) {
  const n = parseInt(h.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function makeSprite(rows, pal, opts) {
  opts = opts || {};
  const P = Object.assign({}, PAL, pal || {});
  const h = rows.length;
  const w = Math.max(...rows.map(r => r.length));
  const o = opts.outline === false ? 0 : 1;
  const cv = document.createElement('canvas');
  cv.width = w + o * 2;
  cv.height = h + o * 2;
  const c = cv.getContext('2d');
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const ch = rows[y][x];
      if (!ch || ch === '.' || !P[ch]) continue;
      c.fillStyle = P[ch];
      c.fillRect((opts.flip ? w - 1 - x : x) + o, y + o, 1, 1);
    }
  }
  if (o) {
    const img = c.getImageData(0, 0, cv.width, cv.height);
    const d = img.data, CW = cv.width, CH = cv.height;
    const a = (x, y) => (x < 0 || y < 0 || x >= CW || y >= CH) ? 0 : d[(y * CW + x) * 4 + 3];
    const rgb = hexToRgb(opts.outlineColor || PAL.k);
    const out = [];
    for (let y = 0; y < CH; y++) {
      for (let x = 0; x < CW; x++) {
        if (!a(x, y) && (a(x - 1, y) || a(x + 1, y) || a(x, y - 1) || a(x, y + 1))) out.push((y * CW + x) * 4);
      }
    }
    for (const i of out) { d[i] = rgb[0]; d[i + 1] = rgb[1]; d[i + 2] = rgb[2]; d[i + 3] = 255; }
    c.putImageData(img, 0, 0);
  }
  return cv;
}

// Округлые формы (облака, кусты): объединение кругов, прямоугольников и «столбиков» со скруглённым верхом.
function blobSprite(w, h, shapes, fill, edge) {
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  const c = cv.getContext('2d');
  const inside = (x, y) => {
    if (x < 0 || y < 0 || x >= w || y >= h) return false;
    const px = x + 0.5, py = y + 0.5;
    for (const s of shapes) {
      if (s.c && (px - s.x) ** 2 + (py - s.y) ** 2 <= s.c * s.c) return true;
      if (s.r && px >= s.x && px < s.x + s.w && py >= s.y && py < s.y + s.h) return true;
      if (s.p) {
        const r = s.w / 2, cx = s.x + r;
        if (px >= s.x && px < s.x + s.w && py >= s.y + r && py < h) return true;
        if ((px - cx) ** 2 + (py - (s.y + r)) ** 2 <= r * r) return true;
      }
    }
    return false;
  };
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!inside(x, y)) continue;
      const border = !inside(x - 1, y) || !inside(x + 1, y) || !inside(x, y - 1) || (y < h - 1 && !inside(x, y + 1));
      c.fillStyle = border ? edge : fill;
      c.fillRect(x, y, 1, 1);
    }
  }
  return cv;
}

const SPR = {};

function buildSprites() {
  // ---------- Люди (12x20, смотрят вправо) ----------
  // Саша: растрёпанные каштановые волосы, белая футболка, тёмно-синяя рубашка нараспашку, камуфляжные штаны
  const SASHA_HEAD = [
    '....hh.h....',
    '..hhhhhhhh..',
    '.hhhhhhhhhh.',
    '.hhhhhhhhhh.',
    '.hhhshhsshh.',
    '.hhsssssess.',
    '.hSssssssss.',
    '..sssssss...',
  ];
  // Соня: горчичная кепка козырьком вперёд, длинные тёмные волосы
  const SONYA_HEAD = [
    '...qqqqqq...',
    '..qqqqqqqq..',
    '.qqqqqqqqQQQ',
    '.hhhhsssss..',
    '.hhhssssess.',
    '.hhhsssssss.',
    '.hhhhssssr..',
    '.hhh.ssss...',
  ];
  const SASHA_BODY = {
    a: [
      '...jjccj....',
      '..jjjcccj...',
      '.jjjjcccjj..',
      '.jj.jcccjj..',
      '.s..jcccjs..',
      '...pPpPpP...',
      '..pPp..PpP..',
      '..Pp....pP..',
      '.pP......Pp.',
      '.Pp......pP.',
      'xxx.....xxx.',
      '............',
    ],
    b: [
      '...jjccj....',
      '..jjjcccj...',
      '..jjjcccj...',
      '..jjjjccj...',
      '...jsjccj...',
      '...pPpPpP...',
      '....PpPp....',
      '....pPpP....',
      '....PpP.....',
      '....pPp.....',
      '....xxxx....',
      '............',
    ],
    j: [
      '...jjccj.js.',
      '..jjjcccjj..',
      '.jjjjcccj...',
      '.jj.jcccj...',
      '.s..jcccj...',
      '...pPpPpP...',
      '..pPp.PpP...',
      '.pPp...pPp..',
      '.Pp.....Pp..',
      'xx.......xx.',
      '............',
      '............',
    ],
  };
  // У Сони длинное чёрное пальто поверх белой футболки, широкие джинсы, бежевые ботинки
  const SONYA_BODY = {
    a: [
      '...jjccj....',
      '..jjjcccj...',
      '.jjjjcccjj..',
      '.jj.jcccjj..',
      '.s.jjcccjs..',
      '..jjppppj...',
      '.jjppp.ppj..',
      '.jpp....pp..',
      '.pp......pp.',
      '.pp......pp.',
      'ooo.....ooo.',
      '............',
    ],
    b: [
      '...jjccj....',
      '..jjjcccj...',
      '..jjjcccj...',
      '..jjjjccj...',
      '..jjsjccj...',
      '..jjppppj...',
      '..jjpppp....',
      '...jpppp....',
      '....ppp.....',
      '....ppp.....',
      '....oooo....',
      '............',
    ],
    j: [
      '...jjccj.js.',
      '..jjjcccjj..',
      '.jjjjcccj...',
      '.jj.jcccj...',
      '.s.jjcccj...',
      '.jjjpppp....',
      'jj.ppp.pp...',
      '.ppp...ppp..',
      '.pp.....pp..',
      'oo.......oo.',
      '............',
      '............',
    ],
  };
  const longHair = rows => rows.map((r, i) => (i < 5 ? '.hh' + r.slice(3) : r));
  const sashaPal = { h: '#6b4428', c: '#ffffff', j: '#22284a', p: '#7d6b3c', P: '#4d4426', x: '#2a2a33' };
  const sonyaPal = { h: '#2a1f22', q: '#c9a03a', Q: '#946f1c', c: '#ffffff', j: '#1f1f2b', p: '#7b8496', o: '#c9a26b', r: '#c0606a' };

  // Саша на кроссовом мотоцикле (26x22)
  const MOTO = [
    ...SASHA_HEAD.map(r => ('......' + r).padEnd(26, '.')),
    '.......jjccc..............',
    '......jjjcccjjjj..........',
    '......jjjccc.....jss.kk...',
    '......jjjcccc........k....',
    '......pPpPpPpP......k.....',
    '.....pPpPpPpPpPx...k......',
    '..xxxxxxxqqqqqqqqqqq.k....',
    '...qqqqqqqqqqqqqqqqq.kyy..',
    '..xxxx.QQQQQQQQQQQ.xxxx...',
    '.xx..xx..mmm......xx..xx..',
    '.x.mm.x...........x.mm.x..',
    '.x.mm.x...........x.mm.x..',
    '.xx..xx...........xx..xx..',
    '..xxxx.............xxxx...',
  ];
  const motoPal = Object.assign({}, sashaPal, { q: '#ff7b1c', Q: '#b84d0a' });
  const motoRows2 = MOTO.map((r, i) => (i >= 17 ? r.replace(/m/g, 'M') : r));

  const mk = (rows, pal, opts) => makeSprite(rows, pal, opts);
  SPR.sasha = {
    run: [mk(SASHA_HEAD.concat(SASHA_BODY.a), sashaPal), mk(SASHA_HEAD.concat(SASHA_BODY.b), sashaPal)],
    jump: mk(SASHA_HEAD.concat(SASHA_BODY.j), sashaPal),
    moto: [mk(MOTO, motoPal), mk(motoRows2, motoPal)],
  };
  SPR.sonya = {
    run: [mk(SONYA_HEAD.concat(longHair(SONYA_BODY.a)), sonyaPal), mk(SONYA_HEAD.concat(longHair(SONYA_BODY.b)), sonyaPal)],
    jump: mk(SONYA_HEAD.concat(longHair(SONYA_BODY.j)), sonyaPal),
  };

  // ---------- Кот Чипс (16x12): полосатый табби с белым, зелёные глаза, рыжее пятнышко у носа ----------
  const CAT_TOP = [
    '........gg...gg.',
    '........gpg.gpg.',
    'g.......gGgGgGg.',
    'g.......gGwwwgg.',
    'Gg......gewwweg.',
    '.g......wwopwww.',
    '.gGgGgGgwwwwww..',
    '..gGgGgGwwwww...',
    '..ggggwwwwwww...',
    '..wwwwwwwwwww...',
  ];
  const catPal = { g: '#8f8273', G: '#4a4038', e: '#b5d14a', p: '#f4a3b4', o: '#d08a4a' };
  SPR.chips = {
    run: [
      mk(CAT_TOP.concat(['..ww.ww...ww.ww.', '.ww...ww.ww...ww']), catPal),
      mk(CAT_TOP.concat(['...ww.ww.ww.ww..', '...ww.ww.ww.ww..']), catPal),
    ],
    jump: mk(CAT_TOP.concat(['.www.......www..', 'ww...........ww.']), catPal),
  };

  // ---------- Предметы ----------
  SPR.chipsPack = mk([
    '.yyyyyyyy.',
    'yyyyyyyyyy',
    'rrrrrrrrrr',
    'rwwrwrwwrr',
    'yyyyyyyyyy',
    'yyyoooyyyy',
    'yyooOoooyy',
    'yyoooooOyy',
    'yyyoooooyy',
    'yyyyyyyyyy',
    'rrrrrrrrrr',
    '.yyyyyyyy.',
  ], { o: '#f5b041', O: '#c47c1a' });
  SPR.kibble = mk([
    '..oo..',
    '.oOoo.',
    'ooooOo',
    '.oOoo.',
    '..oo..',
  ], { o: '#b5651d', O: '#7a3e12' });
  SPR.energy = mk([
    '.mmmm.',
    'xxxxxx',
    'xrrrrx',
    'xryyrx',
    'xrryrx',
    'xryyrx',
    'xrryrx',
    'xryrrx',
    'xrrrrx',
    'xxxxxx',
    '.mmmm.',
  ], { x: '#1f1f2b', r: '#ff5a1f' });
  SPR.motoIcon = mk(MOTO.slice(10).map(r => r.replace(/[hcspoeS]/g, '.')), motoPal);
  SPR.feather = mk([
    'o.........',
    '.o........',
    '..o.......',
    '...o......',
    '....o.....',
    '.....k....',
    '.....k....',
    '....vpv...',
    '...vppv...',
    '...vpv....',
    '...pv.....',
    '...v......',
  ], { o: '#d9a35b', v: '#8a5cf0', p: '#ff8fd1' });
  SPR.heart = mk(['.rr.rr.', 'rrrrrrr', 'rwrrrrr', '.rrrrr.', '..rrr..', '...r...']);
  SPR.heartEmpty = mk(['.mm.mm.', 'mmmmmmm', 'mmmmmmm', '.mmmmm.', '..mmm..', '...m...'], { m: '#5b5466' });

  // ---------- Враги: Саша и Соня ----------
  const en = SPR.en = {};
  const legsA = ['....k.....k.....', '...kk....kk.....'];
  const legsB = ['.....k.....k....', '....kk.....kk...'];
  const LAPTOP = [
    '..xxxxxxxxxxxx..',
    '..xccccccccccx..',
    '..xckkccccckkx..',
    '..xccwkcccwkcx..',
    '..xccccccccccx..',
    '..xcckrrrrkccx..',
    '..xxxxxxxxxxxx..',
    '.mmmmmmmmmmmmmm.',
    'mmMmMmMmMmMmMmmm',
    'mmmmmmmmmmmmmmmm',
  ];
  en.work = [mk(LAPTOP.concat(legsA)), mk(LAPTOP.concat(legsB))];
  const CAL = [
    '..k...k...k...',
    'rrrrrrrrrrrrrr',
    'rrrrrrrrrrrrrr',
    'wwwwwwwwwwwwww',
    'wkkwwwwwwwkkww',
    'wwkkwwwwwkkwww',
    'wwwwwwwwwwwwww',
    'wwwwrrrrrrwwww',
    'wwwrwwwwwwrwww',
    'wwwwwwwwwwwwww',
    'wGwGwGwGwGwGww',
    'wwwwwwwwwwwwww',
  ];
  en.deadline = [mk(CAL.concat(['...k.....k....', '..kk....kk....'])), mk(CAL.concat(['....k.....k...', '...kk....kk...']))];
  const ENV = [
    'wwwwwwwwwwwwww',
    'wkwwwwwwwwwwkw',
    'wwkwwwwwwwwkww',
    'wwwkwwwwwwkwww',
    'wwwwkwwrrkwwww',
    'wwwwwkrrkwwwww',
    'wwwwwwkkwwwwww',
    'wwwwwwwwwwwwww',
  ];
  en.email = [mk(['m............m', 'mm..........mm'].concat(ENV)), mk(['..............', 'mmm........mmm'].concat(ENV))];
  en.alarm = [mk([
    '.yy........yy.',
    'yyyy.rrrr.yyyy',
    '..rrrrrrrrrr..',
    '.rrwwwwwwwwrr.',
    '.rwwwwkwwwwwr.',
    'rrwwwwkwwwwwrr',
    'rrwwwwkkkkwwrr',
    'rrwwwwwwwwwwrr',
    '.rwwwwwwwwwwr.',
    '.rrwwwwwwwwrr.',
    '..rrrrrrrrrr..',
    '..k........k..',
  ])];
  en.alarm.push(mk([
    'yy..........yy',
    'yyy..rrrr..yyy',
    '..rrrrrrrrrr..',
    '.rrwwwwwwwwrr.',
    '.rwwwwkwwwwwr.',
    'rrwwwwkwwwwwrr',
    'rrwwwwkkkkwwrr',
    'rrwwwwwwwwwwrr',
    '.rwwwwwwwwwwr.',
    '.rrwwwwwwwwrr.',
    '..rrrrrrrrrr..',
    '..k........k..',
  ]));
  const BILL = [
    'wwwwwwwwwwww',
    'wkkkkkkkwwww',
    'wwwwwwwwwwww',
    'wkkkkkwwkkww',
    'wwwwwwwwwwww',
    'wkkkwkkkkkww',
    'wwwwwwwwwwww',
    'wwwwwwwrrrrw',
    'wwwwwwwrrrrw',
    'wwwwwwwwwwww',
  ];
  en.bill = [mk(BILL.concat(['w.ww.ww.ww.w'])), mk(BILL.concat(['.ww.ww.ww.ww']))];
  en.dishes = [mk([
    '......o.........',
    '.....mmm........',
    '..wwwwwwwwww....',
    '.wcccccccccw....',
    '..wwwwwwwwww....',
    '....wwwwwwwwwww.',
    '...wccccccoccw..',
    '....wwwwwwwwww..',
    '.wwwwwwwwwww....',
    'wcccoccccccw....',
    '.wwwwwwwwwww....',
    '...wwwwwwwwwwww.',
    '..wcccccccocccw.',
    '...wwwwwwwwwww..',
  ], { o: '#8a6d3b' })];

  // ---------- Враги: Чипс ----------
  const VAC = [
    '..........kkkk....',
    '.........k....k...',
    '..rrrrrrrr.....k..',
    '.rrrrrrrrrr.....k.',
    'rrwkrrrwkrrr....k.',
    'rrrrrrrrrrrr....k.',
    'rrrkkkkkkrrr....k.',
    'RRRRRRRRRRRR...kkk',
  ];
  en.vacuum = [
    mk(VAC.concat(['.xx.......xx..kkkk', '.xx.......xx......']), {}, { flip: true }),
    mk(VAC.concat(['.xx.......xx..kkkk', '..xx.......xx.....']), {}, { flip: true }),
  ];
  en.hose = [mk([
    '.......mm.......',
    '.......mm.......',
    '.......nn.......',
    '......nnnn......',
    '..nnnnnNNnnnn...',
    '.nNNNNNNNNNNNn..',
    'nNnnnnnnnnnnnNn.',
    'nNnNNNNNNNNNnNn.',
    '.nNnnnnnnnnnNn..',
    '..nnnnnnnnnnn...',
  ])];
  en.cucumber = [mk([
    '..nnnnnnnnnnnnn...',
    '.nNnnNnnnNnnnNnn..',
    'nnnnnnnnnnnnnnnnn.',
    'nnNnnnnNnnnnnNnnnn',
    '.nnnnnnnnnnnnnnnn.',
    '..nnnnnnnnnnnnnn..',
  ], { n: '#4fae3a', N: '#2e7a24' })];
  en.clipper = [
    mk([
      'mm..........mm',
      '.mm........mm.',
      '..mm......mm..',
      '...mm....mm...',
      '....mmmmmm....',
      '...rr.mm.rr...',
      '..rrrr..rrrr..',
      '..rr.r..r.rr..',
      '..rrrr..rrrr..',
    ]),
    mk([
      '..............',
      '..............',
      '.mmmmmmmmmmm..',
      '..mmmmmmmmmm..',
      '....mmmmmm....',
      '...rr.mm.rr...',
      '..rrrr..rrrr..',
      '..rr.r..r.rr..',
      '..rrrr..rrrr..',
    ]),
  ];
  en.spray = [mk([
    '.kkkkkkk.',
    'kkkkkkkkk',
    '...kk.k..',
    '...mm....',
    '..cccc...',
    '.cwcccc..',
    '.cwcccc..',
    '.ccccccc.',
    '.cwcccc..',
    '.ccccccc.',
    '.cccccc..',
    '.cccccc..',
    '..cccc...',
  ], { c: '#59b8f5' }, { flip: true })];
  en.carrier = [
    mk([
      '......xxxxxx......',
      '.....x......x.....',
      'oooooooooooooooooo',
      'oOOOOOOOOOOOOOOOOo',
      'oOxxxxxooooooooOOo',
      'oOx.x.xooooooooOOo',
      'oOxxxxxooooooooOOo',
      'oOx.x.xooooooooOOo',
      'oOxxxxxooooooooOOo',
      'oOOOOOOOOOOOOOOOOo',
      'oooooooooooooooooo',
      '..kk..........kk..',
    ], { o: '#7d8bd6', O: '#5563a8' }),
  ];
  en.carrier.push(en.carrier[0]);

  // ---------- Тайлы ----------
  const tilePal = { a: '#8be45f', n: '#4cbf34', N: '#2f8a2a', o: '#b0603a', O: '#7d3b1f', l: '#c97a4f' };
  const dirt = [
    'oooooooooooooooo', 'ooOooooooooOoooo', 'oooooooOoooooooo', 'oooooooooooooooo',
    'oOoooooooooooOoo', 'ooooolooooOooooo', 'oooooooooooooooo', 'oooOooooooooOooo',
  ];
  SPR.ground = mk([
    'aaaaaaaaaaaaaaaa',
    'aannaaannnaaanna',
    'nnnnnnnnnnnnnnnn',
    'nNnnnNnnnnNnnnNn',
    'NNnNNNNnNNNNnNNN',
    'oNoooNoooNooooNo',
  ].concat(dirt, dirt, ['oooOoooooooooOoo', 'oooooooooooooooo']), tilePal, { outline: false });
  SPR.brick = mk([
    'lllllllllllllllO',
    'OoooooooOooooooo',
    'OoooooooOooooooo',
    'OOOOOOOOOOOOOOOO',
    'llllOlllllllOlll',
    'ooooOoooooooOooo',
    'ooooOoooooooOooo',
    'OOOOOOOOOOOOOOOO',
    'OlllllllOlllllll',
    'OoooooooOooooooo',
    'OoooooooOooooooo',
    'OOOOOOOOOOOOOOOO',
    'llllOlllllllOlll',
    'ooooOoooooooOooo',
    'ooooOoooooooOooo',
    'OOOOOOOOOOOOOOOO',
  ], { o: '#d2663f', O: '#7a2e14', l: '#f39a72' }, { outline: false });
  const qRows = glyph => [
    'kkkkkkkkkkkkkkkk',
    'klllllllllllllYk',
    'klkyyyyyyyyyykYk',
    'klyyy' + glyph[0] + 'yyyyYk',
    'klyyy' + glyph[1] + 'yyyyYk',
    'klyyy' + glyph[2] + 'yyyyYk',
    'klyyy' + glyph[3] + 'yyyyYk',
    'klyyy' + glyph[4] + 'yyyyYk',
    'klyyy' + glyph[5] + 'yyyyYk',
    'klyyy' + glyph[6] + 'yyyyYk',
    'klyyyyyyyyyyyyYk',
    'klyyyyyyyyyyyyYk',
    'klyyyyyyyyyyyyYk',
    'klkyyyyyyyyyykYk',
    'kYYYYYYYYYYYYYYk',
    'kkkkkkkkkkkkkkkk',
  ];
  const G1 = ['yOOOy', 'OOyOO', 'yyyOO', 'yyOOy', 'yyOOy', 'yyyyy', 'yyOOy'];
  const qPal = { y: '#f8b800', Y: '#b86a00', l: '#ffe08a', O: '#7a3e00' };
  SPR.q = [
    mk(qRows(G1), qPal, { outline: false }),
    mk(qRows(G1), Object.assign({}, qPal, { O: '#c25d00' }), { outline: false }),
  ];
  SPR.qUsed = mk(qRows(G1.map(() => 'yyyyy')), { y: '#a8743a', Y: '#6b4420', l: '#c99a5b' }, { outline: false });
  SPR.box = mk([
    'kkkkkkkkkkkkkkkk',
    'klllllllwwllllTk',
    'klttttttwwtttttk',
    'klttttttwwtttttk',
    'klttttttwwtttttk',
    'klttttttwwtttttk',
    'kltkkttttttttttk',
    'kltktttttttttttk',
    'kltttttttttttttk',
    'klttttttttttTTtk',
    'klttttttttttTktk',
    'klttttttttttTTtk',
    'kltttttttttttttk',
    'kltttttttttttttk',
    'kTTTTTTTTTTTTTTk',
    'kkkkkkkkkkkkkkkk',
  ], { w: '#f3dca8' }, { outline: false });

  // ---------- Фон ----------
  SPR.clouds = [
    blobSprite(44, 18, [{ c: 6, x: 9, y: 11 }, { c: 8, x: 18, y: 9 }, { c: 7, x: 28, y: 8 }, { c: 6, x: 36, y: 11 }, { r: 1, x: 6, y: 11, w: 34, h: 6 }], '#ffffff', '#a6dcf2'),
    blobSprite(30, 14, [{ c: 5, x: 8, y: 8 }, { c: 6, x: 15, y: 7 }, { c: 5, x: 22, y: 8 }, { r: 1, x: 4, y: 8, w: 22, h: 5 }], '#ffffff', '#a6dcf2'),
  ];
  const bushG = '#5cc93a', bushE = '#1f6b1c';
  SPR.bushes = [
    blobSprite(46, 34, [{ p: 1, x: 2, y: 10, w: 16 }, { p: 1, x: 15, y: 2, w: 16 }, { p: 1, x: 29, y: 14, w: 16 }], bushG, bushE),
    blobSprite(30, 22, [{ p: 1, x: 1, y: 4, w: 14 }, { p: 1, x: 13, y: 8, w: 15 }], bushG, bushE),
  ];
  SPR.hills = [
    blobSprite(90, 46, [{ c: 30, x: 45, y: 46 }, { c: 18, x: 22, y: 46 }, { c: 16, x: 70, y: 46 }], '#9be37a', '#6fc14e'),
    blobSprite(70, 34, [{ c: 26, x: 35, y: 40 }, { c: 14, x: 16, y: 40 }], '#9be37a', '#6fc14e'),
  ];
}

buildSprites();
