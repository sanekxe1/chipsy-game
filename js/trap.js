'use strict';
// «Трэп хата»: выживание Серёжи, Дамира и Ромы в квартире (вид сверху, план по схеме автора).
// Каждое утро игрок раздаёт запасы и задания, днём жильцы живут сами, игрок отвечает на события.
// Жильцы пока — цветные метки; спрайты нарисуем по фото.
// Координаты — в логических пикселях плана (0,0 — левый верхний угол балкона Дамира).

const Trap = (() => {
  const H = 180;
  const PLAN_W = 196, PLAN_H = 166;

  // комнаты: прямоугольник, тип пола, подпись
  const ROOMS = [
    { id: 'damir', x: 0, y: 10, w: 56, h: 72, floor: 'wood', label: 'ДАМИР' },
    { id: 'balconyD', x: 12, y: 0, w: 32, h: 10, floor: 'concrete', label: 'БАЛКОН' },
    { id: 'serezha', x: 56, y: 8, w: 60, h: 74, floor: 'wood2', label: 'СЕРЁЖА' },
    { id: 'roma', x: 116, y: 10, w: 52, h: 72, floor: 'wood', label: 'РОМА' },
    { id: 'balconyR', x: 124, y: 2, w: 28, h: 8, floor: 'concrete', label: 'БАЛКОН' },
    { id: 'hall', x: 0, y: 82, w: 168, h: 38, floor: 'lino', label: '' },
    { id: 'entrance', x: 0, y: 120, w: 20, h: 18, floor: 'lino', label: '' },
    { id: 'bath', x: 52, y: 120, w: 38, h: 16, floor: 'tile', label: '' },
    { id: 'kitchen', x: 106, y: 120, w: 62, h: 44, floor: 'checker', label: 'КУХНЯ' },
    { id: 'laundry', x: 168, y: 86, w: 26, h: 28, floor: 'tile', label: '' },
  ];
  // двери: проём в стене (x, y, длина, 'h' — в горизонтальной стене / 'v' — в вертикальной)
  const DOORS = [
    { x: 21, y: 82, len: 12, dir: 'h' },      // Дамир
    { x: 79, y: 82, len: 17, dir: 'h' },      // Серёжа (двустворчатая)
    { x: 129, y: 82, len: 12, dir: 'h' },     // Рома
    { x: 66, y: 120, len: 10, dir: 'h' },     // санузел
    { x: 124, y: 120, len: 11, dir: 'h' },    // кухня
    { x: 168, y: 96, len: 11, dir: 'v' },     // прачечная
    { x: 6, y: 138, len: 9, dir: 'h', out: true }, // вход
    { x: 18, y: 10, len: 18, dir: 'h' },      // балкон Дамира
    { x: 132, y: 10, len: 12, dir: 'h' },     // балкон Ромы
  ];

  const C = {
    ink: '#1b1626', wall: '#2b2533', wallTop: '#5a5068',
    wood: '#c98f55', woodD: '#b07a45', wood2: '#b88356', wood2D: '#9c6a42',
    lino: '#b9a98c', linoD: '#a69675', tile: '#d6ecf3', tileD: '#a9cfdc',
    chk1: '#ece6d8', chk2: '#cfc6b3', concrete: '#a39d91', concreteD: '#8c867b',
    outside: '#3b3448', outsideD: '#342e40',
  };

  let canvas, ctx, stage, W = 360, S = 2, running = false, raf = 0, t = 0, last = 0, ox = 0, oy = 0;

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const R = (x, y, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(ox + x, oy + y, w, h); };

  function init(cv, st) { canvas = cv; stage = st; ctx = canvas.getContext('2d'); }

  function layout() {
    const r = stage.getBoundingClientRect();
    if (!r.width || !r.height) return;
    W = clamp(Math.round(H * r.width / r.height), 240, 420);
    const sc = Math.min(r.width / W, r.height / H);
    canvas.style.width = Math.floor(W * sc) + 'px';
    canvas.style.height = Math.floor(H * sc) + 'px';
    S = clamp(Math.round(sc * (window.devicePixelRatio || 1)), 1, 5);
    canvas.width = W * S;
    canvas.height = H * S;
    ox = Math.round((W - PLAN_W) / 2);
    oy = Math.round((H - PLAN_H) / 2) + 2;
  }

  // ---------------- Полы ----------------
  function floor(rm) {
    const { x, y, w, h } = rm;
    switch (rm.floor) {
      case 'wood':
      case 'wood2': {
        const base = rm.floor === 'wood' ? C.wood : C.wood2, dark = rm.floor === 'wood' ? C.woodD : C.wood2D;
        R(x, y, w, h, base);
        for (let yy = 0; yy < h; yy += 4) {
          R(x, y + yy + 3, w, 1, dark);
          for (let xx = (yy / 4) % 2 ? 6 : 14; xx < w; xx += 18) R(x + xx, y + yy, 1, 3, dark);
        }
        break;
      }
      case 'lino':
        R(x, y, w, h, C.lino);
        for (let yy = 0; yy < h; yy += 8) for (let xx = (yy / 8) % 2 ? 0 : 4; xx < w; xx += 8) R(x + xx, y + yy, 4, 4, C.linoD);
        break;
      case 'tile':
        R(x, y, w, h, C.tile);
        for (let yy = 0; yy < h; yy += 5) R(x, y + yy, w, 1, C.tileD);
        for (let xx = 0; xx < w; xx += 5) R(x + xx, y, 1, h, C.tileD);
        break;
      case 'checker':
        for (let yy = 0; yy < h; yy += 4) for (let xx = 0; xx < w; xx += 4) R(x + xx, y + yy, Math.min(4, w - xx), Math.min(4, h - yy), ((xx + yy) / 4) % 2 ? C.chk2 : C.chk1);
        break;
      case 'concrete':
        R(x, y, w, h, C.concrete);
        for (let xx = 4; xx < w; xx += 8) R(x + xx, y + 1, 1, h - 2, C.concreteD);
        break;
    }
  }

  // ---------------- Стены и двери ----------------
  function walls() {
    for (const rm of ROOMS) {
      const { x, y, w, h } = rm;
      R(x - 1, y - 1, w + 2, 2, C.wall); R(x - 1, y + h - 1, w + 2, 2, C.wall);
      R(x - 1, y - 1, 2, h + 2, C.wall); R(x + w - 1, y - 1, 2, h + 2, C.wall);
    }
    // стеллаж в комнате Дамира стоит у стены как на схеме
  }

  function doors() {
    // проход из коридора в прихожую — без стены
    R(1, 119, 18, 2, C.lino);
    for (const d of DOORS) {
      // порог и приоткрытая створка (короткая диагональ от петли)
      const leaf = Math.round(d.len * 0.6);
      ctx.fillStyle = '#5a3a1c';
      if (d.dir === 'h') {
        R(d.x, d.y - 1, d.len, 2, '#a07a4a');
        const s = d.out ? -1 : 1;
        for (let i = 0; i < leaf; i++) ctx.fillRect(ox + d.x + Math.round(i * 0.5), oy + d.y + s * (1 + i), 2, 1);
      } else {
        R(d.x - 1, d.y, 2, d.len, '#a07a4a');
        for (let i = 0; i < leaf; i++) ctx.fillRect(ox + d.x - 2 - i, oy + d.y + Math.round(i * 0.5), 1, 2);
      }
    }
  }

  // ---------------- Мебель ----------------
  function box(x, y, w, h, fill, edge) {
    R(x - 1, y - 1, w + 2, h + 2, C.ink);
    R(x, y, w, h, fill);
    if (edge) { R(x, y + h - 1, w, 1, edge); R(x + w - 1, y, 1, h, edge); }
  }

  function bed(x, y, w, h, blanket, pillowsRight) {
    box(x, y, w, h, '#6b4a2e');
    R(x + 1, y + 1, w - 2, h - 2, '#f4f1ea');
    const pw = 5;
    const px = pillowsRight ? x + w - pw - 1 : x + 1;
    R(px, y + 2, pw, Math.floor(h / 2) - 3, '#ffffff'); R(px, y + Math.floor(h / 2), pw, Math.floor(h / 2) - 2, '#ffffff');
    R(px, y + Math.floor(h / 2) - 1, pw, 1, '#d8d4cc');
    const bx = pillowsRight ? x + 1 : x + pw + 2;
    R(bx, y + 1, w - pw - 3, h - 2, blanket);
    R(bx, y + 1, 2, h - 2, '#ffffff');
    for (let i = 3; i < w - pw - 4; i += 4) R(bx + i, y + 2, 1, h - 4, 'rgba(0,0,0,0.12)');
  }

  function chair(x, y) {
    R(x, y + 1, 6, 4, C.ink); R(x + 1, y, 4, 6, C.ink);
    R(x + 1, y + 1, 4, 4, '#e33b2e'); R(x + 1, y + 1, 4, 1, '#ff6a5a');
  }

  function desk(x, y, w, h, vertical) {
    box(x, y, w, h, '#6b4a2e', '#4e3420');
    for (let i = 2; i < (vertical ? h : w); i += 5) vertical ? R(x + 1, y + i, w - 2, 1, '#5e3f26') : R(x + i, y + 1, 1, h - 2, '#5e3f26');
    if (vertical) {
      R(x + w - 3, y + 3, 2, h - 6, '#1b1626');            // монитор у стены
      R(x + w - 2, y + 4, 1, h - 8, glow());
      R(x + 1, y + 4, 3, h - 8, '#d8dde3');                // клавиатура
      R(x + 2, y + h - 3, 2, 2, '#c9ced6');                // мышь
    } else {
      R(x + 3, y + h - 3, w - 6, 2, '#1b1626');
      R(x + 4, y + h - 2, w - 8, 1, glow());
      R(x + 5, y + 2, w - 10, 3, '#d8dde3');
      R(x + w - 4, y + 3, 2, 2, '#c9ced6');
    }
  }

  // мониторы и телевизор слегка мерцают
  function glow() { return ['#4cc3f0', '#5fd0ff', '#3fb2e0'][Math.floor(t * 3) % 3]; }

  function sofa(x, y, w, h) {
    box(x, y, w, h, '#c9b89a', '#a99878');
    R(x, y, 3, h, '#b3a283');                // спинка у стены
    R(x + 3, y, w - 3, 3, '#b3a283'); R(x + 3, y + h - 3, w - 3, 3, '#b3a283'); // подлокотники
    for (let i = 1; i < 3; i++) R(x + 4, y + Math.round(h * i / 3), w - 5, 1, '#a99878');
  }

  function rug(x, y, w, h) {
    box(x, y, w, h, '#7a3e1e');
    R(x + 1, y + 1, w - 2, h - 2, '#e4cfa0');
    R(x + 3, y + 3, w - 6, h - 6, '#2f6b5a');
    for (let yy = 4; yy < h - 4; yy += 4) for (let xx = 4 + ((yy / 4) % 2) * 2; xx < w - 4; xx += 4) R(x + xx, y + yy, 1, 1, '#4f8f78');
    const cx = x + Math.floor(w / 2), cy = y + Math.floor(h / 2);
    R(cx - 4, cy - 1, 8, 2, '#e4cfa0'); R(cx - 1, cy - 5, 2, 10, '#e4cfa0'); R(cx - 2, cy - 2, 4, 4, '#b5652d');
    for (let i = 2; i < w - 2; i += 3) { R(x + i, y + 1, 1, 1, '#b5652d'); R(x + i, y + h - 2, 1, 1, '#b5652d'); }
  }

  function tv(x, y, w, h) {
    box(x, y, w, h, '#d9a35b', '#a8743a');
    R(x + 1, y + 3, 2, h - 6, '#1b1626');                       // экран боком к нам
    R(x + 1, y + 4, 1, h - 8, Math.floor(t * 2) % 4 ? '#3d7be0' : '#ffd23f');
    R(x + 3, y + Math.floor(h / 2) - 2, 1, 4, '#2a2a33');       // подставка
  }

  function shelf(x, y, w, h) {
    box(x, y, w, h, '#8a5a2c');
    const cols = ['#e33b2e', '#3d7be0', '#ffd23f', '#5cc93a', '#8a5cf0', '#ffffff', '#ff7b1c'];
    for (let i = 1; i < w - 1; i += 2) R(x + i, y + 1, 1, h - 2, cols[(i * 3) % cols.length]);
    R(x, y + Math.floor(h / 2), w, 1, '#6b4420');
  }

  function wardrobe(x, y, w, h, vertical) {
    box(x, y, w, h, '#d9a76e', '#a8743a');
    if (vertical) { R(x, y + Math.floor(h / 2), w, 1, '#a8743a'); R(x + 1, y + Math.floor(h / 2) - 2, 1, 1, '#6b4420'); R(x + 1, y + Math.floor(h / 2) + 2, 1, 1, '#6b4420'); }
    else { R(x + Math.floor(w / 2), y, 1, h, '#a8743a'); R(x + Math.floor(w / 2) - 2, y + h - 2, 1, 1, '#6b4420'); R(x + Math.floor(w / 2) + 2, y + h - 2, 1, 1, '#6b4420'); }
  }

  function fridge(x, y, w, h) {
    box(x, y, w, h, '#d8dde3', '#9aa3ad');
    R(x, y + 6, w, 1, '#9aa3ad');
    R(x + w - 3, y + 2, 1, 3, '#626b78'); R(x + w - 3, y + 8, 1, 5, '#626b78');
    R(x + 2, y + 9, 3, 3, '#7fc8ff');
  }

  function table(x, y, w, h) {
    // стулья вокруг
    for (let i = 0; i < 3; i++) { R(x + w, y + 2 + i * 6, 3, 4, C.ink); R(x + w, y + 3 + i * 6, 2, 2, '#4e3420'); }
    R(x + 2, y - 3, 4, 3, C.ink); R(x + 3, y - 2, 2, 2, '#4e3420');
    box(x, y, w, h, '#8a5a2c', '#6b4420');
    for (let i = 2; i < h; i += 4) R(x + 1, y + i, w - 2, 1, '#7a4e26');
  }

  function counter(x, y, w, h) {
    box(x, y, w, h, '#e0d8c8', '#bdb4a2');
    // плита
    R(x + 2, y + 1, 12, h - 2, '#3a3d44');
    for (const [dx, dy] of [[3, 2], [9, 2], [3, h - 5], [9, h - 5]]) { R(x + dx, y + dy, 3, 3, '#1b1626'); R(x + dx + 1, y + dy + 1, 1, 1, '#e33b2e'); }
    // мойка
    R(x + 18, y + 1, 10, h - 2, '#9aa3ad'); R(x + 19, y + 2, 8, h - 4, '#c9ced6'); R(x + 23, y + 1, 1, 2, '#626b78');
  }

  function toilet(x, y) {
    R(x - 1, y - 1, 7, 10, C.ink);
    R(x, y, 5, 3, '#e8ecef');                 // бачок
    R(x, y + 3, 5, 5, '#ffffff'); R(x + 1, y + 4, 3, 3, '#cfe6ef');
  }

  function bathtub(x, y, w, h) {
    box(x, y, w, h, '#ffffff', '#c9ced6');
    R(x + 2, y + 2, w - 4, h - 4, '#7fc8ff'); R(x + 3, y + 3, w - 8, 1, '#bfe6ff');
    R(x + w - 3, y + Math.floor(h / 2) - 1, 1, 2, '#626b78');
  }

  function sinkSmall(x, y) {
    box(x, y, 7, 5, '#ffffff', '#c9ced6');
    R(x + 1, y + 1, 5, 3, '#cfe6ef'); R(x + 3, y, 1, 1, '#626b78');
  }

  function washer(x, y) {
    box(x, y, 10, 10, '#f4f6f8', '#c9ced6');
    R(x + 2, y + 2, 6, 6, '#626b78'); R(x + 3, y + 3, 4, 4, '#7fc8ff');
    if (Math.floor(t * 4) % 2) R(x + 4, y + 4, 1, 1, '#ffffff'); else R(x + 5, y + 5, 1, 1, '#ffffff');
  }

  function plant(x, y) {
    R(x, y + 3, 4, 3, '#b5652d');
    R(x - 1, y, 6, 4, '#3f9e4a'); R(x, y - 1, 4, 1, '#5cc93a'); R(x + 1, y + 1, 1, 1, '#2f7a38');
  }

  function ashtray(x, y) {
    R(x, y, 4, 4, '#626b78'); R(x + 1, y + 1, 2, 2, '#2a2a33');
    R(x + 3, y + 1, 2, 1, '#ffffff'); R(x + 5, y + 1, 1, 1, '#ff7b1c');
    // дымок
    const k = Math.floor(t * 3) % 3;
    ctx.fillStyle = 'rgba(220,220,230,0.6)';
    ctx.fillRect(ox + x + 5 + (k === 1 ? 1 : 0), oy + y - 2 - k, 1, 1);
  }

  // спортуголок Ромы: коврик, скамья со штангой, гантели
  function sportMat(x, y, w, h) {
    box(x, y, w, h, '#8a5cf0', '#6a3fcf');
    for (let i = 3; i < w - 2; i += 4) R(x + i, y + 1, 1, h - 2, '#7a4fe0');
  }

  function benchPress(x, y) {
    R(x - 1, y - 1, 16, 7, C.ink);
    R(x, y, 14, 5, '#2a2a33'); R(x + 1, y + 1, 12, 3, '#3d4049');   // скамья
    R(x + 2, y - 5, 1, 15, '#c9ced6');                               // гриф
    R(x + 1, y - 6, 3, 2, '#1b1626'); R(x + 1, y + 9, 3, 2, '#1b1626'); // блины
    R(x + 1, y - 4, 3, 1, '#4a4a52'); R(x + 1, y + 8, 3, 1, '#4a4a52');
  }

  function dumbbell(x, y) {
    R(x, y, 2, 3, C.ink); R(x + 5, y, 2, 3, C.ink);
    R(x + 2, y + 1, 3, 1, '#c9ced6');
  }

  function rack(x, y, w, h) {
    // вешалка в прихожей: деревянная панель и куртки
    box(x, y, w, h, '#e0b07a', '#c08a52');
    const cols = ['#3d7be0', '#2a2a33', '#e33b2e'];
    for (let i = 0; i < 3; i++) R(x + w, y + 4 + i * 9, 2, 6, cols[i]);
  }

  function furniture() {
    // Дамир: кровать справа вверху, стеллаж поперёк комнаты, стол с креслом внизу справа
    bed(31, 23, 23, 18, '#5b7fc7', true);
    shelf(28, 45, 27, 8);
    desk(47, 63, 7, 17, true);
    chair(40, 68);
    plant(3, 13);
    // Серёжа: стол с креслом вверху, диван слева, ковёр в центре, ТВ справа
    desk(61, 19, 24, 9, false);
    chair(70, 12);
    sofa(59, 38, 10, 24);
    rug(74, 35, 24, 32);
    tv(107, 34, 6, 32);
    plant(110, 72);
    // Рома: над кроватью — спортуголок, кровать справа, шкаф внизу справа, комод слева
    sportMat(146, 13, 20, 7);
    benchPress(149, 26);
    dumbbell(137, 24);
    dumbbell(137, 29);
    bed(143, 36, 23, 17, '#e36b5c', true);
    wardrobe(146, 71, 21, 9, false);
    wardrobe(118, 47, 5, 33, true);
    // прихожая
    rack(1, 89, 4, 30);
    // санузел
    toilet(55, 125);
    bathtub(69, 122, 19, 12);
    sinkSmall(62, 122);
    // кухня
    table(108, 124, 12, 17);
    fridge(108, 145, 11, 17);
    counter(132, 154, 30, 8);
    // прачечная
    washer(176, 101);
    washer(181, 89);
    // балконы: пепельницы — сюда ребята ходят курить
    ashtray(30, 3);
    plant(15, 3);
    ashtray(140, 4);
  }

  function labels() {
    ctx.font = '4px "Press Start 2P", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    for (const rm of ROOMS) {
      if (!rm.label) continue;
      // во время игры подписи комнат мешают именам жильцов — оставляем только кухню
      if (game && rm.id !== 'kitchen') continue;
      const lx = ox + rm.x + rm.w / 2, ly = oy + rm.y + (rm.id === 'kitchen' ? 22 : rm.h - 8);
      if (rm.id.startsWith('balcony')) continue;
      ctx.fillStyle = 'rgba(27,22,38,0.55)';
      ctx.fillText(rm.label, lx + 0.5, ly + 0.5);
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.fillText(rm.label, lx, ly);
    }
  }

  // =====================================================================
  //                       ЖИЗНЬ В КВАРТИРЕ (симуляция)
  // =====================================================================
  const DAY = 75;                  // секунд реального времени на день
  const $ = id => document.getElementById(id);
  const rnd = (a, b) => a + Math.random() * (b - a);
  const pick = arr => arr[Math.floor(Math.random() * arr.length)];
  const cl = v => Math.max(0, Math.min(100, v));

  // точки квартиры, куда ходят жильцы: координаты плана, комната, проход через балконную дверь
  const POI = {
    bedS: { x: 64, y: 50, room: 'serezha' }, pcS: { x: 73, y: 17, room: 'serezha' }, tv: { x: 86, y: 52, room: 'serezha' },
    bedD: { x: 40, y: 32, room: 'damir' }, pcD: { x: 43, y: 71, room: 'damir' }, balcD: { x: 27, y: 5, room: 'damir', via: [27, 16] },
    bedR: { x: 152, y: 44, room: 'roma' }, sport: { x: 156, y: 26, room: 'roma' }, balcR: { x: 138, y: 5, room: 'roma', via: [138, 16] },
    table: { x: 124, y: 132, room: 'kitchen' }, stove: { x: 146, y: 150, room: 'kitchen' }, fridge: { x: 124, y: 152, room: 'kitchen' },
    bath: { x: 60, y: 129, room: 'bath' }, laundry: { x: 177, y: 101, room: 'laundry' },
    door: { x: 10, y: 133, room: 'hall' }, hallMid: { x: 60, y: 101, room: 'hall' }, hallEnd: { x: 150, y: 104, room: 'hall' },
  };
  const ROOM_DOOR = {
    damir: { in: [27, 76], out: [27, 92] }, serezha: { in: [87, 76], out: [87, 92] }, roma: { in: [135, 76], out: [135, 92] },
    bath: { in: [71, 126], out: [71, 112] }, kitchen: { in: [130, 126], out: [130, 112] }, laundry: { in: [174, 101], out: [160, 101] },
  };
  const HALL_Y = 101;

  // жильцы: цвет метки (до фото), где спят/работают/курят, как быстро растёт желание курить (в день)
  const RESIDENTS = [
    { id: 'serezha', name: 'Серёжа', color: '#3d7be0', bed: 'bedS', pc: 'pcS', smoke: 'balcD', craveRate: 46, pay: 150 },
    { id: 'damir', name: 'Дамир', color: '#5cc93a', bed: 'bedD', pc: 'pcD', smoke: 'balcD', craveRate: 18, pay: 450 },
    { id: 'roma', name: 'Рома', color: '#e33b2e', bed: 'bedR', pc: 'bedR', smoke: 'balcR', craveRate: 30, pay: 450 },
  ];
  const TASKS = {
    work: 'МОНТАЖ', shop: 'МАГАЗИН', cook: 'ГОТОВИТЬ', rest: 'ОТДЫХ', sport: 'СПОРТ',
  };
  const SHOP = [
    { id: 'food', name: 'ЕДА', price: 150 },
    { id: 'cigs', name: 'СИГАРЕТЫ', price: 220 },
    { id: 'beer', name: 'ПИВО', price: 120 },
    { id: 'energy', name: 'ЭНЕРГЕТИК', price: 110 },
  ];
  // друзья, которые стучат в дверь
  const FRIENDS = {
    anya: { name: 'Аня', color: '#ffd23f', text: 'Аня (фотограф) заглянула с заказом на съёмку' },
    sashasonya: { name: 'Саша и Соня', color: '#ff8fb8', text: 'Саша и Соня пришли с чипсами' },
    polina: { name: 'Полина', color: '#c9a0ff', text: 'Пришла Полина, девушка Ромы' },
    vika: { name: 'Вика', color: '#ff9a3c', text: 'Пришла Вика, девушка Дамира — обещает приготовить ужин' },
    gf: { name: 'Девушка Серёжи', color: '#9fd0f0', text: 'Пришла девушка Серёжи' },
  };
  const GF_DAY = 10;               // на 10-й день у Серёжи появляется девушка

  let game = null;                 // текущая партия
  let speed = 1, simPaused = false, inUI = false;
  const Best = {
    get() { try { return parseInt(localStorage.getItem('trap_best'), 10) || 0; } catch (e) { return 0; } },
    set(v) { try { localStorage.setItem('trap_best', String(v)); } catch (e) { /* нет доступа */ } },
  };

  function newGame() {
    game = {
      day: 0, dayT: 0, phase: 'morning',
      res: { food: 6, cigs: 6, money: 1200, beer: 1, energy: 1 },
      people: RESIDENTS.map(r => ({
        ...r, hunger: 20, health: 100, happy: 70, crave: 20, alive: true, away: 0, skill: 0,
        x: POI[r.bed].x, y: POI[r.bed].y, room: POI[r.bed].room, path: [], act: 'спит', task: 'work',
        plan: { food: true, cigs: true, beer: false, energy: false }, sched: [], hidden: false, flags: {},
      })),
      guests: [], cat: null, poops: [], texts: [], log: [], flags: {}, flagsToday: {}, gf: false, shopCart: null, knock: null,
    };
    simPaused = false;
    morning();
  }

  const present = () => game.people.filter(p => p.alive && !p.away);
  const byId = id => game.people.find(p => p.id === id);
  const say = (p, text) => game.texts.push({ x: p.x, y: p.y - 10, text, life: 1.4 });
  function log(s) { game.log.push(s); }

  // ---------------- Маршруты по квартире ----------------
  function route(p, poi) {
    const to = POI[poi];
    const pts = [];
    const fromRoom = p.room;
    if (p.y < 12 && ROOM_DOOR[fromRoom]) pts.push(fromRoom === 'damir' ? [27, 16] : [138, 16]); // уходим с балкона
    if (fromRoom !== to.room) {
      if (ROOM_DOOR[fromRoom]) { pts.push(ROOM_DOOR[fromRoom].in, ROOM_DOOR[fromRoom].out); }
      const fx = ROOM_DOOR[fromRoom] ? ROOM_DOOR[fromRoom].out[0] : p.x;
      pts.push([fx, HALL_Y]);
      if (ROOM_DOOR[to.room]) {
        pts.push([ROOM_DOOR[to.room].out[0], HALL_Y], ROOM_DOOR[to.room].out, ROOM_DOOR[to.room].in);
      } else pts.push([to.x, HALL_Y]);
    }
    if (to.via) pts.push(to.via);
    pts.push([to.x, to.y]);
    p.path = pts.map(([x, y]) => ({ x, y }));
    p.dest = poi;
  }

  function walk(o, dt) {
    if (!o.path || !o.path.length) return true;
    const tgt = o.path[0], dx = tgt.x - o.x, dy = tgt.y - o.y, d = Math.hypot(dx, dy), step = 30 * dt;
    if (d <= step) { o.x = tgt.x; o.y = tgt.y; o.path.shift(); if (!o.path.length && o.dest) o.room = POI[o.dest].room; return !o.path.length; }
    o.x += dx / d * step; o.y += dy / d * step;
    return false;
  }

  // ---------------- Утро ----------------
  function morning() {
    game.day++;
    game.dayT = 0;
    game.phase = 'morning';
    // кто вернулся от родителей
    for (const p of game.people) {
      if (p.away > 0) {
        p.away--;
        if (!p.away && p.alive) { game.res.food += 3; log(p.name + ' вернулся от родителей и привёз еды (+3 еды)'); }
      }
      if (p.alive && !p.away) { p.x = POI[p.bed].x; p.y = POI[p.bed].y; p.room = POI[p.bed].room; p.path = []; p.hidden = false; }
      p.flags = {};
    }
    game.event = game.day > 1 ? rollEvent() : null;
    openMorning();
  }

  // утреннее событие: либо сразу случается, либо требует выбора
  function rollEvent() {
    const g = game, S = byId('serezha'), D = byId('damir'), Rm = byId('roma');
    if (g.day >= GF_DAY && !g.gf && S.alive) {
      g.gf = true; S.happy = cl(S.happy + 40);
      return { title: 'Серёжа влюбился!', text: 'Серёжа познакомился с девушкой. Теперь она иногда заходит в гости — Серёже от этого очень хорошо.' };
    }
    if (Math.random() < 0.4) return null;
    const pool = [];
    if (Rm.alive && !Rm.away) pool.push('phone');
    if (S.alive && !S.away) pool.push('oversleep');
    if (D.alive && !D.away && g.day > 2) pool.push('trip');
    pool.push('lights', 'pizza');
    const k = pick(pool);
    if (k === 'phone') return {
      title: 'Рома потерял телефон', text: 'Опять. Где-то в квартире… или нет.',
      choices: [
        { label: 'ИСКАТЬ ВЕСЬ ДЕНЬ', fn: () => { Rm.flags.search = true; } },
        { label: 'КУПИТЬ НОВЫЙ −800₽', ok: () => g.res.money >= 800, fn: () => { g.res.money -= 800; } },
        { label: 'ЗАБИТЬ', fn: () => { Rm.happy = cl(Rm.happy - 20); } },
      ],
    };
    if (k === 'oversleep') { S.flags.slept = true; S.happy = cl(S.happy + 5); return { title: 'Серёжа проспал', text: 'Серёжа проспал полдня. Сегодня он сделает вдвое меньше.' }; }
    if (k === 'trip') { D.away = 2; return { title: 'Дамир уехал', text: 'Дамир уехал к родителям на 2 дня. Вернётся с едой.' }; }
    if (k === 'lights') { g.flags = { noPower: true }; return { title: 'Отключили свет', text: 'Компьютеры не работают — сегодня монтировать не получится.' }; }
    g.res.food += 2;
    return { title: 'Сосед угостил', text: 'Сосед снизу занёс две пиццы. +2 еды.' };
  }

  // ---------------- Начало дня ----------------
  function beginDay(cart) {
    const g = game;
    g.phase = 'day';
    g.flagsToday = g.flags || {};
    g.flags = {};
    g.shopCart = cart;
    const cooks = present().filter(p => p.task === 'cook');
    const cookBonus = cooks.length ? 15 + (cooks.some(p => p.id === 'roma') ? 5 : 0) : 0;
    for (const p of present()) {
      if (p.plan.food && g.res.food > 0) { g.res.food--; p.hunger = cl(p.hunger - 45 - cookBonus); p.flags.ate = true; }
      if (p.plan.cigs && g.res.cigs > 0) { g.res.cigs--; p.crave = cl(p.crave - 65); p.flags.smoked = true; }
      if (p.plan.beer && g.res.beer > 0) { g.res.beer--; p.happy = cl(p.happy + 20); p.health = cl(p.health - 3); say(p, 'ПИВО!'); }
      if (p.plan.energy && g.res.energy > 0) { g.res.energy--; p.flags.energy = true; p.health = cl(p.health - 3); p.hunger = cl(p.hunger + 8); }
      if (cooks.length) p.happy = cl(p.happy + 6);
      buildSchedule(p);
    }
    // гости и кот на сегодня
    g.knockAt = Math.random() < 0.5 ? rnd(0.22, 0.6) : null;
    g.catAt = Math.random() < 0.22 ? rnd(0.25, 0.55) : null;
    g.shopperBack = false;
    Sound.startMusic('trap');
  }

  function buildSchedule(p) {
    const s = [];
    if (p.flags.ate) s.push({ at: 0.03, poi: 'table', act: 'ест' });
    if (p.flags.smoked) s.push({ at: 0.11, poi: p.smoke, act: 'курит' });
    const main = p.flags.search ? 'search' : p.task;
    if (main === 'work') s.push({ at: 0.18, poi: p.pc, act: 'монтаж' });
    else if (main === 'cook') { s.push({ at: 0.16, poi: 'stove', act: 'готовит' }); s.push({ at: 0.45, poi: 'table', act: 'ест' }); }
    else if (main === 'rest') s.push({ at: 0.18, poi: p.id === 'serezha' ? 'pcS' : 'tv', act: p.id === 'serezha' ? 'дота' : 'отдыхает' });
    else if (main === 'sport') s.push({ at: 0.18, poi: 'sport', act: 'качается' });
    else if (main === 'shop') s.push({ at: 0.14, poi: 'door', act: 'в магазин', shop: true });
    else if (main === 'search') for (let a = 0.16; a < 0.7; a += 0.09) s.push({ at: a, poi: pick(['hallMid', 'table', 'tv', 'bath', 'laundry', p.bed]), act: 'ищет телефон' });
    s.push({ at: 0.74, poi: pick(['tv', 'table', 'hallEnd']), act: 'болтает' });
    s.push({ at: 0.86, poi: p.bed, act: 'спит' });
    p.sched = s;
    p.act = 'встаёт';
  }

  // ---------------- Ход дня ----------------
  function updateDay(dt) {
    const g = game;
    const prev = g.dayT / DAY;
    g.dayT += dt;
    const ph = Math.min(1, g.dayT / DAY), dd = dt / DAY;

    // стук в дверь и кот
    if (g.knockAt && prev < g.knockAt && ph >= g.knockAt) knock();
    if (g.catAt && prev < g.catAt && ph >= g.catAt) catComes();

    for (const p of present()) {
      // расписание
      while (p.sched.length && ph >= p.sched[0].at) {
        const it = p.sched.shift();
        if (p.hidden) continue;
        route(p, it.poi);
        p.act = it.act;
        p.goingShop = !!it.shop;
      }
      if (!p.hidden && walk(p, dt) && p.goingShop) { p.hidden = true; p.goingShop = false; p.backAt = 0.55; log(p.name + ' ушёл в магазин'); }
      if (p.hidden && ph >= p.backAt) {
        p.hidden = false; p.x = POI.door.x; p.y = POI.door.y; p.room = 'hall';
        route(p, 'fridge'); p.act = 'разбирает пакеты';
        if (g.shopCart) { for (const k in g.shopCart) g.res[k] += g.shopCart[k]; g.shopCart = null; say(p, 'ПОКУПКИ!'); Sound.play('coin'); }
      }

      // параметры
      const asleep = ph >= 0.9;
      p.hunger = cl(p.hunger + 30 * dd);
      p.crave = cl(p.crave + p.craveRate * dd);
      p.happy = cl(p.happy - 9 * dd - g.poops.length * 12 * dd);
      if (p.hunger >= 100) p.health = cl(p.health - 30 * dd);
      if (p.crave >= 100) { p.happy = cl(p.happy - 20 * dd); p.health = cl(p.health - 4 * dd); }
      if (p.happy <= 0) p.health = cl(p.health - 10 * dd);
      if (asleep && p.hunger < 80) p.health = cl(p.health + 25 * dd);
      const at = p.path.length === 0 && !p.hidden;
      if (at && p.act === 'отдыхает') p.happy = cl(p.happy + 30 * dd);
      if (at && p.act === 'дота') p.happy = cl(p.happy + 40 * dd);
      if (at && p.act === 'качается') { p.health = cl(p.health + 18 * dd); p.hunger = cl(p.hunger + 12 * dd); p.happy = cl(p.happy + 8 * dd); }
      if (at && p.act === 'монтаж') p.happy = cl(p.happy - 5 * dd);
      // Серёжа спасается вейпом и снюсом, если сигарет не дали
      if (p.id === 'serezha' && !p.flags.vape && p.crave > 75) { p.flags.vape = true; p.crave = cl(p.crave - 30); say(p, 'ВЕЙП'); }
      if (p.health <= 0) die(p);
    }

    // гости, кот
    for (const gu of g.guests) {
      walk(gu, dt);
      if (!gu.leaving && ph >= gu.until) { gu.leaving = true; gu.path = [{ x: POI.hallMid.x, y: HALL_Y }, { x: POI.door.x, y: HALL_Y }, { x: POI.door.x, y: POI.door.y }]; }
      if (gu.leaving && !gu.path.length) gu.gone = true;
    }
    g.guests = g.guests.filter(gu => !gu.gone);
    if (g.cat) {
      if (walk(g.cat, dt)) {
        if (g.cat.steps-- > 0) {
          const spot = pick([POI.hallMid, POI.hallEnd, POI.table, { x: 30, y: 104 }, { x: 100, y: 98 }]);
          g.cat.path = [{ x: spot.x + rnd(-6, 6), y: spot.y + rnd(-3, 3) }];
          if (Math.random() < 0.3 && !g.cat.pooped) { g.cat.pooped = true; g.poops.push({ x: g.cat.x, y: g.cat.y + 3 }); log('Кот нагадил на пол! Нажми на кучку, чтобы убрать'); }
        } else g.cat = null;
      }
    }

    for (const tx of g.texts) { tx.y -= 8 * dt; tx.life -= dt; }
    g.texts = g.texts.filter(tx => tx.life > 0);

    if (!present().length && !game.people.some(p => p.alive)) { gameOver(); return; }
    if (ph >= 1) endDay();
  }

  function die(p) {
    p.alive = false;
    p.act = 'мёртв';
    p.path = [];
    log('☠ ' + p.name + ' умер');
    Sound.play('crash');
    for (const o of present()) o.happy = cl(o.happy - 25);
  }

  // вечер: деньги за монтаж
  function endDay() {
    const g = game;
    let earned = 0;
    for (const p of present()) {
      if (p.task !== 'work' || p.flags.search) continue;
      if (g.flagsToday.noPower) continue;
      let pay = p.id === 'serezha' ? 150 + 60 * p.skill : p.pay;
      if (p.happy <= 5) { log(p.name + ' не смог работать — совсем нет настроения'); continue; }
      if (p.flags.energy) pay *= 2;
      if (p.flags.slept) pay = Math.round(pay / 2);
      if (p.id === 'roma' && Math.random() < 0.2) { pay = Math.round(pay / 2); log('Рома опоздал на съёмку и потерял флешку — заплатили половину'); }
      if (p.id === 'serezha') {
        if (Math.random() < 0.2) { log('Серёжа залип в доту и ничего не смонтировал'); p.happy = cl(p.happy + 10); continue; }
        p.skill = Math.min(5, p.skill + 1);
      }
      earned += pay;
    }
    if (earned) { g.res.money += earned; log('За монтаж заработали ' + earned + '₽'); }
    if (g.flagsToday.noPower) log('Без света никто не смог монтировать');
    Sound.stopMusic();
    if (!game.people.some(p => p.alive)) { gameOver(); return; }
    morning();
  }

  // ---------------- Гости и кот ----------------
  function knock() {
    const g = game, D = byId('damir'), Rm = byId('roma'), S = byId('serezha');
    const who = ['anya', 'sashasonya'];
    if (Rm.alive) who.push('polina');
    if (D.alive && !D.away) who.push('vika');
    if (g.gf && S.alive) who.push('gf', 'gf');
    g.knock = pick(who);
    Sound.play('bump');
    setTimeout(() => Sound.play('bump'), 180);
    showKnock(g.knock);
  }

  function letIn(id) {
    const g = game, f = FRIENDS[id];
    g.guests.push({ id, name: f.name, color: f.color, x: POI.door.x, y: POI.door.y, path: [{ x: POI.door.x, y: HALL_Y }, { x: 86, y: HALL_Y }, { x: 87, y: 92 }, { x: 87, y: 76 }, { x: 80 + rnd(-4, 8), y: 58 + rnd(-6, 6) }], until: Math.min(0.85, g.dayT / DAY + 0.2) });
    const all = present();
    if (id === 'anya') { g.res.money += 500; if (g.res.food > 0) g.res.food--; log('Аня принесла заказ на съёмку: +500₽ (и съела порцию)'); }
    if (id === 'sashasonya') { g.res.food += 2; all.forEach(p => { p.happy = cl(p.happy + 12); }); log('Саша и Соня принесли чипсы: +2 еды, всем веселее'); }
    if (id === 'polina') { const r = byId('roma'); r.happy = cl(r.happy + 30); if (g.res.food > 0) g.res.food--; if (g.res.cigs > 0) g.res.cigs--; log('Полина зашла к Роме: Роме сильно лучше (съела еду, стрельнула сигарету)'); }
    if (id === 'vika') { const d = byId('damir'); d.happy = cl(d.happy + 30); g.res.food += 2; all.forEach(p => { p.hunger = cl(p.hunger - 15); }); log('Вика приготовила ужин на всех: +2 еды, все сыты'); }
    if (id === 'gf') { const s = byId('serezha'); s.happy = cl(s.happy + 30); if (g.res.food > 0) g.res.food--; log('Девушка Серёжи зашла в гости: Серёже хорошо'); }
    Sound.play('checkpoint');
  }

  function catComes() {
    game.cat = { x: POI.door.x, y: POI.door.y, path: [{ x: POI.door.x, y: HALL_Y }], steps: 5, pooped: false };
    log('Кот из подъезда пробрался в квартиру');
    Sound.play('meow');
  }

  function clickAt(lx, ly) {
    if (!game || game.phase !== 'day') return;
    const px = lx - ox, py = ly - oy;
    const i = game.poops.findIndex(pp => Math.abs(pp.x - px) < 6 && Math.abs(pp.y - py) < 6);
    if (i >= 0) { game.poops.splice(i, 1); game.texts.push({ x: px, y: py - 6, text: 'УБРАНО', life: 1 }); Sound.play('click'); }
  }

  function gameOver() {
    game.phase = 'over';
    Sound.stopMusic();
    Sound.play('over');
    const days = game.day;
    const best = Best.get();
    if (days > best) Best.set(days);
    showOver(days, Math.max(days, best), days > best);
  }

  // =====================================================================
  //                               ОТРИСОВКА
  // =====================================================================
  function token(x, y, color, label, opts) {
    const X = Math.round(ox + x), Y = Math.round(oy + y);
    opts = opts || {};
    if (opts.dead) {
      ctx.fillStyle = C.ink; ctx.fillRect(X - 5, Y - 2, 10, 5);
      ctx.fillStyle = '#9aa3ad'; ctx.fillRect(X - 4, Y - 1, 8, 3);
      ctx.fillStyle = C.ink; ctx.fillRect(X + 1, Y - 1, 1, 1); ctx.fillRect(X + 3, Y - 1, 1, 1);
      return;
    }
    const r = opts.small ? 2 : 3;
    ctx.fillStyle = C.ink; ctx.fillRect(X - r - 1, Y - r, (r + 1) * 2, r * 2); ctx.fillRect(X - r, Y - r - 1, r * 2, (r + 1) * 2);
    ctx.fillStyle = color; ctx.fillRect(X - r, Y - r, r * 2, r * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.fillRect(X - r, Y - r, r, 1);
    if (label) {
      ctx.font = '4px "Press Start 2P", monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
      ctx.fillStyle = C.ink; ctx.fillText(label, X + 0.5, Y - r - 1.5);
      ctx.fillStyle = '#ffffff'; ctx.fillText(label, X, Y - r - 2);
    }
  }

  function drawLife() {
    const g = game;
    for (const pp of g.poops) { R(pp.x - 2, pp.y - 2, 5, 4, C.ink); R(pp.x - 1, pp.y - 1, 3, 2, '#6b3a17'); R(pp.x, pp.y - 3, 1, 1, '#6b3a17'); }
    for (const p of g.people) {
      if (p.away || p.hidden) continue;
      if (!p.alive) { token(p.x, p.y, p.color, null, { dead: true }); continue; }
      const sleeping = p.act === 'спит' && !p.path.length;
      token(p.x, p.y, p.color, p.name.toUpperCase());
      if (sleeping) { ctx.font = '4px "Press Start 2P", monospace'; ctx.fillStyle = '#ffffff'; ctx.fillText('Z', ox + p.x + 5, oy + p.y - 3 - Math.floor(t * 2) % 3); }
      else if (!p.path.length && p.act) {
        ctx.font = '4px "Press Start 2P", monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
        ctx.fillStyle = C.ink; ctx.fillText(p.act, ox + p.x + 0.5, oy + p.y + 4.5);
        ctx.fillStyle = '#ffe08a'; ctx.fillText(p.act, ox + p.x, oy + p.y + 4);
      }
    }
    for (const gu of g.guests) token(gu.x, gu.y, gu.color, gu.name.toUpperCase(), { small: true });
    if (g.cat) {
      const X = Math.round(ox + g.cat.x), Y = Math.round(oy + g.cat.y);
      ctx.fillStyle = C.ink; ctx.fillRect(X - 3, Y - 2, 7, 4);
      ctx.fillStyle = '#ff9a3c'; ctx.fillRect(X - 2, Y - 1, 5, 2); ctx.fillRect(X + 2, Y - 3, 1, 1); ctx.fillRect(X + 3, Y - 3, 1, 1);
    }
    ctx.font = '4px "Press Start 2P", monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
    for (const tx of g.texts) {
      ctx.globalAlpha = Math.min(1, tx.life * 2);
      ctx.fillStyle = C.ink; ctx.fillText(tx.text, ox + tx.x + 0.5, oy + tx.y + 0.5);
      ctx.fillStyle = '#ffd23f'; ctx.fillText(tx.text, ox + tx.x, oy + tx.y);
      ctx.globalAlpha = 1;
    }
  }

  // карточка жильца: четыре полоски (полная — хорошо)
  function card(x, y, p) {
    const w = 84;
    ctx.fillStyle = 'rgba(27,22,38,0.75)'; ctx.fillRect(x, y, w, 46);
    ctx.fillStyle = p.color; ctx.fillRect(x, y, 3, 46);
    txt(p.name.toUpperCase(), x + 6, y + 3, 5, '#ffffff');
    if (!p.alive) { txt('УМЕР', x + 6, y + 14, 5, '#e33b2e'); return; }
    if (p.away) { txt('У РОДИТЕЛЕЙ', x + 6, y + 14, 4, '#9fd0f0'); txt(p.away + ' ДН.', x + 6, y + 21, 4, '#9fd0f0'); return; }
    const bars = [['СЫТ', 100 - p.hunger, '#ff9a3c'], ['ЗДОР', p.health, '#e33b2e'], ['НАСТР', p.happy, '#ffd23f'], ['КУРЕВО', 100 - p.crave, '#9fd0f0']];
    bars.forEach(([lb, v, col], i) => {
      const by = y + 11 + i * 8;
      txt(lb, x + 6, by, 4, '#c9ced6');
      ctx.fillStyle = '#1b1626'; ctx.fillRect(x + 36, by, 44, 5);
      ctx.fillStyle = v < 25 && Math.floor(t * 3) % 2 ? '#ffffff' : col; ctx.fillRect(x + 37, by + 1, Math.round(42 * v / 100), 3);
    });
  }

  function txt(s, x, y, size, color, align) {
    ctx.font = size + 'px "Press Start 2P", monospace';
    ctx.textAlign = align || 'left'; ctx.textBaseline = 'top';
    ctx.fillStyle = C.ink; ctx.fillText(s, x + 0.5, y + 0.5);
    ctx.fillStyle = color; ctx.fillText(s, x, y);
  }

  function drawHUD() {
    const g = game;
    const side = Math.max(4, ox - 92);
    const ps = g.people;
    card(side, 30, ps[0]);
    card(side, 82, ps[1]);
    card(W - side - 84, 30, ps[2]);
    // ресурсы
    const rx = W - side - 84, ry = 82;
    ctx.fillStyle = 'rgba(27,22,38,0.75)'; ctx.fillRect(rx, ry, 84, 46);
    txt('ЗАПАСЫ', rx + 6, ry + 3, 5, '#ffffff');
    const r = g.res;
    [['ЕДА', r.food], ['СИГАРЕТЫ', r.cigs], ['ДЕНЬГИ', r.money + '₽'], ['ПИВО / ЭНЕРГ', r.beer + ' / ' + r.energy]].forEach(([lb, v], i) => {
      txt(lb, rx + 6, ry + 12 + i * 8, 4, '#c9ced6');
      txt(String(v), rx + 80, ry + 12 + i * 8, 4, '#ffd23f', 'right');
    });
    // день и время
    const ph = g.phase === 'day' ? g.dayT / DAY : 0;
    txt('ДЕНЬ ' + g.day, W / 2, 2, 6, '#ffffff', 'center');
    ctx.fillStyle = '#1b1626'; ctx.fillRect(W / 2 - 30, 10, 60, 3);
    ctx.fillStyle = ph > 0.85 ? '#8a5cf0' : '#ffd23f'; ctx.fillRect(W / 2 - 29, 11, Math.round(58 * ph), 1);
  }

  function render() {
    ctx.setTransform(S, 0, 0, S, 0, 0);
    ctx.imageSmoothingEnabled = false;
    // за окнами — вечерний город
    ctx.fillStyle = C.outside; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = C.outsideD;
    for (let y = 0; y < H; y += 6) for (let x = (y / 6) % 2 ? 0 : 3; x < W; x += 6) ctx.fillRect(x, y, 2, 2);
    for (const rm of ROOMS) floor(rm);
    furniture();
    walls();
    doors();
    labels();
    if (game) {
      drawLife();
      // вечер и ночь
      const ph = game.phase === 'day' ? game.dayT / DAY : 0;
      const dark = ph > 0.78 ? Math.min(0.5, (ph - 0.78) * 3) : 0;
      if (dark > 0) { ctx.fillStyle = 'rgba(10,12,40,' + dark.toFixed(2) + ')'; ctx.fillRect(0, 0, W, H); }
      drawHUD();
    }
  }

  function frame(ts) {
    if (!running) return;
    const dt = Math.min(0.05, (ts - last) / 1000 || 0);
    last = ts;
    t += dt;
    if (game && game.phase === 'day' && !simPaused && !inUI) updateDay(dt * speed);
    render();
    raf = requestAnimationFrame(frame);
  }

  // =====================================================================
  //                         ОКНА: утро, магазин, гости
  // =====================================================================
  function overlay(id, on) { $(id).classList.toggle('show', on); inUI = !!document.querySelector('#scr-trap .overlay.show'); }

  function openMorning() {
    const g = game;
    $('tr-day').textContent = 'ДЕНЬ ' + g.day;
    $('tr-log').innerHTML = g.log.length ? g.log.map(s => '<div>• ' + s + '</div>').join('') : '<div>Ребята проснулись в своей трэп хате.</div>';
    g.log = [];
    const ev = g.event, box = $('tr-event');
    box.innerHTML = '';
    if (ev) {
      box.innerHTML = '<b>' + ev.title + '</b><p>' + ev.text + '</p>';
      if (ev.choices) {
        const row = document.createElement('div'); row.className = 'btn-row';
        for (const c of ev.choices) {
          const b = document.createElement('button'); b.className = 'btn small'; b.textContent = c.label;
          if (c.ok && !c.ok()) b.disabled = true;
          b.onclick = () => { c.fn(); Sound.play('click'); ev.choices = null; box.querySelector('.btn-row').remove(); box.insertAdjacentHTML('beforeend', '<p class="done">Решено: ' + c.label.toLowerCase() + '</p>'); renderPlan(); };
          row.appendChild(b);
        }
        box.appendChild(row);
      }
    }
    renderPlan();
    overlay('tr-morning', true);
  }

  // распределение запасов и задания на день
  function renderPlan() {
    const g = game, wrap = $('tr-people');
    const waiting = g.event && g.event.choices;
    wrap.classList.toggle('blocked', !!waiting);
    // сколько уже раздали
    const used = k => present().filter(p => p.plan[k]).length;
    for (const k of ['food', 'cigs', 'beer', 'energy']) {
      for (const p of present()) if (p.plan[k] && used(k) > g.res[k]) p.plan[k] = false;
    }
    wrap.innerHTML = '';
    for (const p of g.people) {
      const c = document.createElement('div');
      c.className = 'tr-card' + (!p.alive ? ' dead' : p.away ? ' away' : '');
      c.style.borderColor = p.color;
      let html = '<div class="tr-name" style="color:' + p.color + '">' + p.name.toUpperCase() + '</div>';
      if (!p.alive) { c.innerHTML = html + '<div class="tr-note">☠ УМЕР</div>'; wrap.appendChild(c); continue; }
      if (p.away) { c.innerHTML = html + '<div class="tr-note">У РОДИТЕЛЕЙ ЕЩЁ ' + p.away + ' ДН.</div>'; wrap.appendChild(c); continue; }
      html += '<div class="tr-bars">' + [['сытость', 100 - p.hunger, '#ff9a3c'], ['здоровье', p.health, '#e33b2e'], ['настроение', p.happy, '#ffd23f'], ['курево', 100 - p.crave, '#9fd0f0']]
        .map(([n, v, col]) => '<div class="tr-bar"><span>' + n + '</span><i><b style="width:' + Math.round(v) + '%;background:' + col + '"></b></i></div>').join('') + '</div>';
      html += '<div class="tr-items">' + [['food', '🍗'], ['cigs', '🚬'], ['beer', '🍺'], ['energy', '⚡']].map(([k, ic]) => {
        const can = p.plan[k] || used(k) < g.res[k];
        return '<button data-k="' + k + '" class="tr-it' + (p.plan[k] ? ' on' : '') + '"' + (can ? '' : ' disabled') + '>' + ic + '</button>';
      }).join('') + '</div>';
      const tasks = ['work', 'shop', 'cook', 'rest'].concat(p.id === 'roma' ? ['sport'] : []);
      html += '<div class="tr-tasks">' + tasks.map(k => '<button data-t="' + k + '" class="tr-task' + (p.task === k ? ' on' : '') + '">' + (k === 'rest' && p.id === 'serezha' ? 'ДОТА' : TASKS[k]) + '</button>').join('') + '</div>';
      c.innerHTML = html;
      c.querySelectorAll('[data-k]').forEach(b => b.onclick = () => { p.plan[b.dataset.k] = !p.plan[b.dataset.k]; Sound.play('click'); renderPlan(); });
      c.querySelectorAll('[data-t]').forEach(b => b.onclick = () => { p.task = b.dataset.t; Sound.play('click'); renderPlan(); });
      wrap.appendChild(c);
    }
    const r = g.res;
    $('tr-stock').textContent = 'Запасы: еда ' + r.food + ' · сигареты ' + r.cigs + ' · ' + r.money + '₽ · пиво ' + r.beer + ' · энергетики ' + r.energy;
    $('tr-go').disabled = !!waiting;
  }

  function startDayClicked() {
    Sound.init();
    overlay('tr-morning', false);
    if (present().some(p => p.task === 'shop')) openShop();
    else beginDay(null);
  }

  // магазин: выбор покупок для того, кто идёт
  let cart = {};
  function openShop() {
    cart = { food: 0, cigs: 0, beer: 0, energy: 0 };
    renderShop();
    overlay('tr-shop', true);
  }
  function renderShop() {
    const money = game.res.money, spent = SHOP.reduce((a, it) => a + cart[it.id] * it.price, 0);
    $('tr-shop-list').innerHTML = SHOP.map(it =>
      '<div class="tr-shop-row"><span>' + it.name + ' · ' + it.price + '₽</span><span><button data-m="' + it.id + '">−</button><b>' + cart[it.id] + '</b><button data-p="' + it.id + '"' + (spent + it.price > money ? ' disabled' : '') + '>+</button></span></div>').join('');
    $('tr-shop-total').textContent = 'Итого: ' + spent + '₽ из ' + money + '₽';
    $('tr-shop-list').querySelectorAll('[data-p]').forEach(b => b.onclick = () => { cart[b.dataset.p]++; Sound.play('click'); renderShop(); });
    $('tr-shop-list').querySelectorAll('[data-m]').forEach(b => b.onclick = () => { cart[b.dataset.m] = Math.max(0, cart[b.dataset.m] - 1); Sound.play('click'); renderShop(); });
  }
  function buy() {
    const spent = SHOP.reduce((a, it) => a + cart[it.id] * it.price, 0);
    game.res.money -= spent;
    overlay('tr-shop', false);
    beginDay(Object.assign({}, cart));
  }

  function showKnock(id) {
    const f = FRIENDS[id];
    $('tr-knock-text').textContent = 'Тук-тук! ' + f.text + '.';
    overlay('tr-knock', true);
  }
  function answerKnock(open) {
    overlay('tr-knock', false);
    if (open) letIn(game.knock);
    else log(FRIENDS[game.knock].name + ' постучали, но никто не открыл');
    game.knock = null;
  }

  function showOver(days, best, isNew) {
    $('tr-over-days').textContent = days;
    $('tr-over-best').textContent = best;
    $('tr-over-new').classList.toggle('show', isNew);
    overlay('tr-over', true);
  }

  function showIntro() {
    $('tr-intro-best').textContent = Best.get();
    overlay('tr-intro', true);
  }

  // =====================================================================
  //                            Управление экраном
  // =====================================================================
  function start() {
    layout();
    running = true;
    last = performance.now();
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(frame);
    if (!game || game.phase === 'over') showIntro();
  }

  function stop() { running = false; cancelAnimationFrame(raf); Sound.stopMusic(); simPaused = false; }

  function bindUI() {
    $('tr-new').onclick = () => { Sound.init(); overlay('tr-intro', false); overlay('tr-over', false); newGame(); };
    $('tr-again').onclick = () => { overlay('tr-over', false); newGame(); };
    $('tr-go').onclick = startDayClicked;
    $('tr-buy').onclick = buy;
    $('tr-knock-yes').onclick = () => answerKnock(true);
    $('tr-knock-no').onclick = () => answerKnock(false);
    $('tr-speed').onclick = () => { speed = speed === 1 ? 2 : speed === 2 ? 3 : 1; $('tr-speed').textContent = '×' + speed; Sound.play('click'); };
    $('tr-pause').onclick = () => { simPaused = !simPaused; $('tr-pause').textContent = simPaused ? '▶' : 'II'; if (simPaused) Sound.stopMusic(); else if (game && game.phase === 'day') Sound.startMusic('trap'); };
    canvas.addEventListener('pointerdown', e => {
      const r = canvas.getBoundingClientRect();
      clickAt((e.clientX - r.left) / r.width * W, (e.clientY - r.top) / r.height * H);
    });
  }

  const origInit = init;
  function initAll(cv, st) {
    origInit(cv, st);
    bindUI();
  }

  return {
    init: initAll, start, stop, layout,
    get running() { return running; },
    // для отладки из консоли: Trap.debug.skip() — промотать день, Trap.debug.state()
    debug: {
      skip: () => { if (game && game.phase === 'day') game.dayT = DAY - 0.1; },
      state: () => game && { day: game.day, phase: game.phase, res: game.res, people: game.people.map(p => ({ id: p.id, h: Math.round(p.hunger), hp: Math.round(p.health), hap: Math.round(p.happy), cr: Math.round(p.crave), alive: p.alive, away: p.away, act: p.act })) },
      knock: () => knock(),
      cat: () => catComes(),
      starve: () => { for (const p of game.people) { p.hunger = 100; p.health = 5; } },
    },
  };
})();
