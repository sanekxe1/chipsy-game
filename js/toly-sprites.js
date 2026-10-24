'use strict';
// «Тольяттинская суета»: Савелий, его Гранта и трафик. Машины нарисованы сверху,
// капотом вверх; встречные — те же спрайты, перевёрнутые вверх ногами.
// Машины симметричны: рисуем левую половину, правая получается зеркалом.

const TSPR = {};

(() => {
  const mirror = half => half.map(r => r + r.split('').reverse().join(''));
  const flipV = rows => rows.slice().reverse();
  const carPal = (body, extra) => Object.assign({
    b: body.b, B: body.B,
    g: '#2c3646', G: '#6b7f99', y: '#fff3b0', r: '#e33b2e', x: '#1b1626', m: '#c9ced6', k: '#1b1626',
  }, extra || {});
  // пара спрайтов: [едет от нас (видна корма), едет навстречу (видна морда)]
  const pair = (rows, pal) => [makeSprite(rows, pal), makeSprite(flipV(rows), pal)];

  // ---------- Седан (Приора) ----------
  const SEDAN = [
    '...bbbbb', '..bbyybb', '.bbbbbbb', '.bbbbbbb', 'xbbbbbbb', 'xbbBBBBB', 'xbBggggg',
    'xbBgGggg', '.bBggggg', '.bBggggg', '.bBBBBBB', '.bbbbbbb', '.bbbbbbb', '.bbbbbbb',
    '.bbbbbbb', '.bBBBBBB', '.bBggggg', '.bBgGggg', '.bBggggg', 'xbBBBBBB', 'xbbbbbbb',
    'xbbbbbbb', 'xbbbbbbb', '.bbbbbbb', '.rrrbbbb', '..bbbbbb',
  ];
  // BMW M5: тот же седан, но с «ноздрями» решётки и полосой на крыше
  const M5 = SEDAN.map((r, i) => (i === 0 ? '...bbbbk' : i === 1 ? '..byybbk' : i >= 11 && i <= 15 ? r.slice(0, 7) + 'B' : r));
  // Porsche 911: короче, круглые фары, сплошной фонарь сзади
  const PORSCHE = [
    '....bbbb', '..yybbbb', '.yybbbbb', '.bbbbbbb', 'xbbbbbbb', 'xbbBBBBB', 'xbBggggg',
    '.bBgGggg', '.bBggggg', '.bBBBBBB', '.bbbbbbb', '.bbbbbbb', '.bBggggg', '.bBggggg',
    'xbbBBBBB', 'xbbbbbbb', 'xbbbbbbb', 'xbbbbbbb', '.bbbbbbb', '.BBBBBBB', '.rrrrrrr', '..bbbbbb',
  ];
  // Mercedes GLE: широкий и длинный кроссовер с рейлингами
  const GLE = [
    '..bbbbbbb', '.bbyyybbb', '.bbbbbbbb', 'xbbbbbbbb', 'xbbbbbbbb', 'xbbBBBBBB', 'xbBgggggg',
    '.bBgGgggg', '.bBgggggg', '.bBBBBBBB', '.bmbbbbbb', '.bmbbbbbb', '.bmbbbbbb', '.bmbbbbbb',
    '.bmbbbbbb', '.bmbbbbbb', '.bBBBBBBB', '.bBgggggg', '.bBgggggg', 'xbBBBBBBB', 'xbbbbbbbb',
    'xbbbbbbbb', 'xbbbbbbbb', '.bbbbbbbb', '.rrrrbbbb', '.bbbbbbbb', '..bbbbbbb',
  ];
  // КАМАЗ: кабина и длинный тентованный прицеп
  const KAMAZ = [
    '.bbbbbbbbb', 'bbyybbbbbb', 'bbbbbbbbbb', 'bBgggggggg', 'bBgGgggggg', 'bBgggggggg',
    'bbbbbbbbbb', 'bbbbbbbbbb', 'bbbbbbbbbb', 'xbbbbbbbbb', 'xbbbbbbbbb', '.bbbbbbbbb', '..mmmmmmmm',
  ];
  for (let i = 0; i < 36; i++) {
    const wheel = (i >= 26 && i <= 33) || (i >= 4 && i <= 8);
    KAMAZ.push((wheel ? 'x' : '.') + (i % 5 === 0 ? 'TTTTTTTTT' : 'ttttttttt'));
  }
  KAMAZ.push('.rrttttttt', '..ttttttttt'.slice(0, 10));
  // мотоцикл с мотоциклистом
  const MOTO = ['..x', '..x', '.mm', '.bb', 'bbh', 'bhh', '.hh', '.bb', '.bb', '..x', '..x', '..x', '..r'];

  const COLORS = {
    priora: [['#c9ced6', '#9aa3ad'], ['#4a2a45', '#2e1a2c'], ['#e8ecef', '#b9c0c7'], ['#2a2a33', '#16161c']],
    m5: [['#2b4fa8', '#1c346f'], ['#1d1f24', '#0e0f12'], ['#7a8794', '#566270']],
    porsche: [['#ffd23f', '#d99a12'], ['#e33b2e', '#a5231b'], ['#3d7be0', '#264f9e']],
    gle: [['#1d1f24', '#0e0f12'], ['#e8ecef', '#b9c0c7'], ['#5f6670', '#3f454d']],
    kamaz: [['#ff7b1c', '#b84d0a'], ['#3d7be0', '#264f9e']],
    moto: [['#e33b2e', '#a5231b'], ['#2a2a33', '#16161c'], ['#5cc93a', '#2f8a2a']],
  };
  const SHAPES = { priora: SEDAN, m5: M5, porsche: PORSCHE, gle: GLE, kamaz: KAMAZ, moto: MOTO };
  TSPR.cars = {};
  for (const kind of Object.keys(SHAPES)) {
    const rows = mirror(SHAPES[kind]);
    TSPR.cars[kind] = COLORS[kind].map(([b, B]) => pair(rows, carPal({ b, B }, kind === 'kamaz' ? { t: '#3f6b3a', T: '#2a4a26' } : kind === 'moto' ? { h: '#ffd23f' } : null)));
  }

  // ---------- Гранта Савелия (сверху-сзади) с рукой в окне ----------
  const granta = mirror([
    '...bbbbb', '..byybbb', '.bbbbbbk', '.bbbbbbb', 'xbbbbbbb', 'xbbBBBBB', 'xbBggggg',
    'xbBgGggg', '.bBggggg', '.bBggggg', '.bBBBBBB', '.bbbbbbb', '.bbbbbbb', '.bbbbbbb',
    '.bbbbbbb', '.bBBBBBB', '.bBggggg', '.bBgGggg', '.bBggggg', 'xbBBBBBB', 'xbbbbbbb',
    'xbbbbbbb', 'xbbbbbbb', '.bbbbbbb', '.rrrrbbb', '..bbbbbb',
  ]).map((r, i) => (i === 10 ? 'j' + r.slice(1) : i === 11 ? 'J' + r.slice(1) : i === 12 ? 's' + r.slice(1) : r));
  TSPR.granta = makeSprite(granta, carPal({ b: '#eef1f3', B: '#b9c0c7' }, { j: '#1d1f24', J: '#e6e6e6', s: '#e8b48c' }));
  TSPR.grantaHit = makeSprite(granta, carPal({ b: '#ffb3a8', B: '#e36b5c' }, { j: '#1d1f24', J: '#e6e6e6', s: '#e8b48c' }));

  // ---------- Савелий: красная кепка, авиаторы, клетчатая рубашка, джинсы, кеды ----------
  TSPR.savely = makeSprite([
    '..qqqqqqq...',
    '.qqwqwqwqq..',
    '.qqqqqqqqQQQ',
    '.hhhhsssss..',
    '.hhgggsggg..',
    '.hhsssssss..',
    '..hssssss...',
    '...sssss....',
    '..jJjccJj...',
    '.jJjJcrcJj..',
    '.JjJjcccjJ..',
    '.jJ.Jcccjj..',
    '.s..jcccJs..',
    '...pppppp...',
    '..ppp..ppp..',
    '..pp....pp..',
    '.pp......pp.',
    '.pp......pp.',
    'ooO.....ooO.',
  ], { q: '#e33b2e', Q: '#a5231b', w: '#ffffff', h: '#2a1f22', s: '#e8b48c', g: '#3a2f45', j: '#1d1f24', J: '#e6e6e6', c: '#27304f', r: '#e33b2e', p: '#8fb3d9', o: '#1d1f24', O: '#5cc93a' });

  // монетка (два кадра — вращается)
  TSPR.coin = [
    makeSprite(['..yyyy..', '.yllyyy.', 'ylyyyyYy', 'yyyYYyYy', 'yyyYYyYy', 'yyyyyyYy', '.yyyyYy.', '..yyyy..'], { y: '#ffd23f', Y: '#d99a12', l: '#fff3b0' }),
    makeSprite(['..yy..', '.ylyy.', '.yyYy.', '.yyYy.', '.yyYy.', '.yyYy.', '.yyYy.', '..yy..'], { y: '#ffd23f', Y: '#d99a12', l: '#fff3b0' }),
  ];

  // обочина сверху: кроны деревьев, берёзы, кусты
  TSPR.trees = [
    blobSprite(18, 18, [{ c: 8, x: 9, y: 9 }, { c: 5, x: 5, y: 6 }, { c: 5, x: 13, y: 12 }], '#3f9e4a', '#24642b'),
    blobSprite(16, 16, [{ c: 7, x: 8, y: 8 }, { c: 4, x: 12, y: 5 }], '#7cc85a', '#4c8f36'),
    blobSprite(12, 10, [{ c: 5, x: 6, y: 5 }, { c: 3, x: 9, y: 6 }], '#4cbf34', '#2f8a2a'),
  ];
})();
