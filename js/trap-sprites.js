'use strict';
// «Трэп хата»: жильцы и гости — маленькие фигурки «лицом к нам» (9x13), нарисованы по фото.
// Строки собираются из причёски, лица и одежды; '.' — прозрачно, контур дорисовывается автоматически.

const TRSPR = {};

(() => {
  // причёски: 4 верхние строки
  const HAIR = {
    curly: ['.h.h.h.h.', 'hhhhhhhhh', 'hhhhhhhhh', 'hhssssshh'],   // кудри (Рома)
    messy: ['..hhhhh..', '.hhhhhhhh', 'hhhhhhhhh', 'hhhhhhhsh'],   // густая чёлка на глаза (Серёжа)
    bowl: ['..hhhhh..', '.hhhhhhh.', 'hhhhhhhhh', 'hhhssshhh'],    // шапка волос с чёлкой (Дамир)
    long: ['..hhhhh..', '.hhhhhhh.', 'hhhhhhhhh', 'hhssssshh'],    // волосы до плеч
    bun: ['...hhh...', '..hhhhh..', '.hhhhhhh.', '.hsssssh.'],     // пучок (Полина)
    cap: ['..qqqqq..', '.qqqqqqqQ', '.hqqqqqqQ', '.hsssssh.'],     // кепка (Соня)
    short: ['..hhhhh..', '.hhhhhhh.', '.hhhhhhh.', '.hsssssh.'],   // короткая стрижка (Саша)
  };
  // лицо: 3 строки (глаза, нос/щёки, подбородок)
  const FACE = {
    plain: ['.ssesess.', '.sssssss.', '..sssss..'],
    glasses: ['.kekskek.', '.sssmsss.', '..sssss..'],   // очки и септум (Рома)
    ring: ['.ssesess.', '.sssmsss.', '..sssss..'],      // септум (Дамир)
    phones: ['WssesessW', 'WsssssssW', '..sssss..'],    // наушники (Серёжа)
    aviators: ['.kkkskkk.', '.sssssss.', '..sssss..'], // авиаторы (Савелий)
  };
  // одежда: 6 строк (плечи, руки, пояс, ноги, обувь)
  const BODY = {
    tee: ['.ccccccc.', 'scccccccs', 'scccccccs', '.ppppppp.', '.pp...pp.', '.oo...oo.'],
    teePrint: ['.ccccccc.', 'scrnrnccs', 'scnrnrccs', '.ppppppp.', '.pp...pp.', '.oo...oo.'],
    shorts: ['.ccccccc.', 'scccccccs', 'scccccccs', '.ppppppp.', '.ww...ww.', '.oo...oo.'],
    hoodie: ['.ccccccc.', 'cccrrcccc', 'scccccccs', '.pwpppwp.', '.ww...ww.', '.oo...oo.'],
    skirt: ['.ccccccc.', 'ccccccccc', 'scccccccs', '.kkkkkkk.', '.kkkkkkk.', '..oo.oo..'],
    longsleeve: ['.ccccccc.', 'ccccccccc', 'scccccccs', '.ppppppp.', '.ss...ss.', '.oo...oo.'],
    // клетчатая рубашка нараспашку поверх тёмно-синей футболки с красным логотипом (Савелий)
    flannel: ['.cwnnnwc.', 'cwcnrncwc', 'scwnnnwcs', '.ppppppp.', '.pp...pp.', '.oo...oo.'],
    choker: ['.kkkkkkk.', 'ccckccccc', 'scccccccs', '.ppppppp.', '.pp...pp.', '.oo...oo.'],
  };
  // длинные волосы спадают по бокам лица
  const sideHair = r => 'h' + r.slice(1, 8) + 'h';

  function make(hair, face, body, pal, long) {
    const rows = HAIR[hair].concat(FACE[face].map((r, i) => (long && i < 2 ? sideHair(r) : r)), BODY[body]);
    // кадр шага: ноги вместе
    const walk = rows.slice(0, 11).concat(['..pp.pp..', '..oo.oo..']);
    const p = Object.assign({ k: '#1b1626', e: '#1b1626', s: '#f2c8a8', m: '#c9ced6', W: '#e8ecef', o: '#2a2a33', w: '#ffffff' }, pal);
    const stand = makeSprite(rows, p);
    return { stand, walk: makeSprite(walk, p), dead: gray(stand) };
  }

  // бледная серая копия — для тела умершего (ctx.filter не работает в Safari/Telegram на iPhone)
  function gray(src) {
    const cv = document.createElement('canvas');
    cv.width = src.width; cv.height = src.height;
    const c = cv.getContext('2d');
    c.drawImage(src, 0, 0);
    const img = c.getImageData(0, 0, cv.width, cv.height), d = img.data;
    for (let i = 0; i < d.length; i += 4) {
      const v = Math.round((d[i] * 0.3 + d[i + 1] * 0.59 + d[i + 2] * 0.11) * 0.8 + 30);
      d[i] = d[i + 1] = d[i + 2] = v;
    }
    c.putImageData(img, 0, 0);
    return cv;
  }

  // жильцы
  TRSPR.roma = make('curly', 'glasses', 'teePrint', { h: '#9a6a3e', c: '#d8c49a', r: '#e33b2e', n: '#3f9e4a', p: '#3a3d4a' });
  TRSPR.serezha = make('messy', 'phones', 'shorts', { h: '#3a2618', c: '#4a4e58', p: '#1d1f24', o: '#e8ecef' });
  TRSPR.damir = make('bowl', 'ring', 'hoodie', { h: '#8a4a2a', c: '#a9adb5', r: '#e33b2e', p: '#1d1f24', o: '#c9ced6' });
  // гости
  TRSPR.vika = make('long', 'plain', 'skirt', { h: '#d9b07a', c: '#f2ead8', o: '#1d1f24' }, true);
  TRSPR.polina = make('bun', 'plain', 'longsleeve', { h: '#3a2a22', c: '#f4f1ea', p: '#9aa3ad', o: '#e8ecef' });
  TRSPR.anya = make('long', 'plain', 'choker', { h: '#d9a066', c: '#1d1f24', p: '#2a2a33', s: '#f6d2bc' }, true);
  TRSPR.sasha = make('short', 'plain', 'tee', { h: '#6b4428', c: '#22284a', p: '#7d6b3c' });
  TRSPR.sonya = make('cap', 'plain', 'longsleeve', { h: '#2a1f22', q: '#c9a03a', Q: '#946f1c', c: '#e33b2e', p: '#7b8496', o: '#c9a26b' });
  // Савелий из «Тольяттинской суеты»: красная кепка, авиаторы, клетчатая рубашка, голубые джинсы, чёрно-зелёные кеды
  TRSPR.savely = make('cap', 'aviators', 'flannel', { h: '#2a1f1a', q: '#d8322a', Q: '#8a1c16', c: '#1b1626', w: '#e8ecef', n: '#22284a', r: '#e33b2e', p: '#8ab8e6', o: '#2f5a3a' });
  TRSPR.gf = make('long', 'plain', 'tee', { h: '#e36b9a', c: '#8a5cf0', p: '#2a2a33' }, true); // девушка Серёжи — пока без фото
  // кот из подъезда (рыжий, сбоку)
  TRSPR.cat = makeSprite(['.o...o...', '.oo.oo...', '.okook...', 'ooooooooo', '.oooooooo', '.o.o..o.o'], { o: '#ff9a3c', k: '#1b1626' });
})();
