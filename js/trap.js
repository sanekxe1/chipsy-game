'use strict';
// «Трэп хата»: выживание Серёжи, Дамира и Ромы в квартире (вид сверху, план по схеме автора).
// Каждое утро игрок раздаёт запасы и задания, днём жильцы живут сами, игрок отвечает на события.
// Жильцы и гости нарисованы по фото (js/trap-sprites.js).
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
      if (game) continue;
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

  // жильцы: цвет полоски в карточке, где спят/работают/курят, как быстро растёт желание курить (в день)
  const RESIDENTS = [
    { id: 'serezha', name: 'Серёжа', color: '#3d7be0', bed: 'bedS', pc: 'pcS', smoke: 'balcD', craveRate: 46, pay: 150 },
    { id: 'damir', name: 'Дамир', color: '#5cc93a', bed: 'bedD', pc: 'pcD', smoke: 'balcD', craveRate: 18, pay: 450 },
    { id: 'roma', name: 'Рома', color: '#e33b2e', bed: 'bedR', pc: 'bedR', smoke: 'balcR', craveRate: 30, pay: 450 },
  ];
  const TASKS = {
    work: 'МОНТАЖ', shop: 'МАГАЗИН', cook: 'ГОТОВИТЬ', rest: 'ОТДЫХ', sport: 'СПОРТ', rap: 'РЕП',
  };
  // болезни: сколько дней, сколько здоровья в день отнимают, какая доля оплаты за монтаж остаётся, шанс заразить соседа за утро
  const ILLS = {
    cold: { name: 'ПРОСТУДА', days: 3, drain: 8, pay: 0.5, spread: 0.12 },
    poison: { name: 'ОТРАВЛЕНИЕ', days: 2, drain: 15, pay: 0.5, spread: 0 },
    flu: { name: 'ГРИПП', days: 4, drain: 12, pay: 0, spread: 0.3 },
  };
  const SHOP = [
    { id: 'food', name: 'ЕДА', price: 150 },
    { id: 'cigs', name: 'СИГАРЕТЫ', price: 220 },
    { id: 'beer', name: 'ПИВО', price: 120 },
    { id: 'energy', name: 'ЭНЕРГЕТИК', price: 110 },
    { id: 'meds', name: 'ЛЕКАРСТВА', price: 230 },
  ];
  // друзья, которые стучат в дверь
  const FRIENDS = {
    anya: { name: 'Аня', color: '#ffd23f', text: 'Аня (фотограф) заглянула с заказом на съёмку' },
    sashasonya: { name: 'Саша и Соня', color: '#ff8fb8', text: 'Саша и Соня пришли с чипсами' },
    polina: { name: 'Полина', color: '#c9a0ff', text: 'Пришла Полина, девушка Ромы' },
    vika: { name: 'Вика', color: '#ff9a3c', text: 'Пришла Вика, девушка Дамира — обещает приготовить ужин' },
    gf: { name: 'Альтушка Серёжи', color: '#9fd0f0', text: 'Пришла альтушка Серёжи' },
    doctor: { name: 'Врач', color: '#ffffff', text: '' },
    savely: { name: 'Савелий', color: '#d8322a', text: 'Савелий из Тольятти заехал на своей Гранте' },
  };
  const DOCTOR_FREE_EVERY = 10;    // по ОМС — бесплатно раз в 10 дней
  const DOCTOR_PRICE = 500;        // чаще — платно
  const DOCTOR_HEAL = 30;          // сколько здоровья даёт врач каждому, кто дома
  const GF_DAY = 10;               // на 10-й день у Серёжи появляется девушка
  const PARTY_DAY = 10;            // тусовку предлагают не раньше 10-го дня…
  const PARTY_GAP = 5;             // …и не чаще, чем раз в 5 дней
  const FUN_GAP = 4;               // между тусовкой и «Репом над Волгой» — минимум 4 дня, чтобы не шли подряд

  // ---------------- Сложность растёт с каждым днём ----------------
  // всё считается от номера дня, поэтому старые сохранения подхватывают её сами
  // баланс подобран ботом (tools/trap_bot.js, по 120 партий): новичок живёт ~34 дня, обычный игрок ~40,
  // внимательный (энергетики под монтаж, не перекармливает) ~48, лучшие партии — 60–90 дней
  const BAL = {
    infl: 0.01, inflMax: 1,        // цены +1% в день, максимум ×2
    wage: 0.005, wageMax: 0.4,     // оплата монтажа +0,5% в день, максимум +40% — медленнее цен
    wear: 120, wearMax: 0.5,       // голод/курево/скука быстрее: +50% за 120 дней
    sleep: 25,                     // сколько здоровья восстанавливает ночь (за день, в фазе сна)
  };
  const dayN = () => game ? game.day : 1;
  const inflation = () => 1 + Math.min(BAL.inflMax, (dayN() - 1) * BAL.infl);
  const wageK = () => 1 + Math.min(BAL.wageMax, (dayN() - 1) * BAL.wage);
  const priceOf = base => Math.round(base * inflation() / 10) * 10;
  const RENT_EVERY = 7;
  // аренда раз в неделю: 750₽ в первую неделю, +150₽ за каждую следующую, максимум 2250₽
  const rentAt = day => Math.min(2250, 750 + 150 * (Math.floor(day / RENT_EVERY) - 1));
  const rentAmount = () => rentAt(dayN());
  const RAP_PRICE = 300, RAP_GAP = 6;  // «Реп над Волгой»: билет с каждого, не чаще раза в 6 дней
  const RAP_FREE = 0.35;               // иногда друзья-организаторы зовут всех бесплатно
  // цена билета на утреннем экране (флаги дня ещё в g.flags)
  const rapPrice = () => (game.flags.rapFree ? 0 : RAP_PRICE);
  const wear = () => 1 + Math.min(BAL.wearMax, (dayN() - 1) / BAL.wear);
  const moodBar = () => Math.min(60, 10 + dayN() * 0.75);                 // ниже этого настроения заказчик платит меньше
  const calmChance = () => 0.4 - Math.min(0.25, dayN() * 0.004);           // шанс спокойного утра падает с 40% до 15%
  const illBonus = () => Math.min(0.07, dayN() * 0.001);                   // болеют чаще
  // к кому гость приходит и рядом с кем держится
  const HOSTS = { polina: 'roma', vika: 'damir', gf: 'serezha' };
  // места на диване и ковре у телевизора Серёжи, где все собираются
  const TV_SPOTS = [[63, 42], [63, 49], [63, 56], [77, 44], [77, 54], [86, 40], [86, 60], [95, 46], [95, 56], [86, 50]];

  let game = null;                 // текущая партия
  let forceEvent = null;           // для отладки: какое событие выпадет следующим утром
  let speed = 1, simPaused = false, inUI = false;
  // ---------------- Сохранение: телефон + облако Telegram ----------------
  // Облако (CloudStorage, Bot API 6.9+) привязано к аккаунту игрока: можно продолжить на другом устройстве.
  // Каждая запись помечена временем ts — при загрузке берём более свежую из двух копий.
  // Конец партии записывается «надгробием» {over: true}, чтобы старая копия не воскресла.
  const SAVE_KEY = 'trap_save', BEST_KEY = 'trap_best';
  const cloud = (() => {
    const tg = window.Telegram && window.Telegram.WebApp;
    return tg && tg.CloudStorage && tg.isVersionAtLeast && tg.isVersionAtLeast('6.9') ? tg.CloudStorage : null;
  })();
  const parse = v => { try { return v ? JSON.parse(v) : null; } catch (e) { return null; } };
  const Store = {
    put(key, value) {
      try { localStorage.setItem(key, value); } catch (e) { /* нет доступа */ }
      if (cloud) try { cloud.setItem(key, value, () => {}); } catch (e) { /* облако недоступно */ }
    },
    local(key) { try { return localStorage.getItem(key); } catch (e) { return null; } },
    // ответ облака приходит асинхронно; без облака — сразу null
    cloud(key, cb) {
      if (!cloud) { cb(null); return; }
      try { cloud.getItem(key, (err, v) => cb(err ? null : v)); } catch (e) { cb(null); }
    },
  };
  const newest = (a, b) => (!a ? b : !b ? a : (b.ts || 0) > (a.ts || 0) ? b : a);

  const Best = {
    get() { return parseInt(Store.local(BEST_KEY), 10) || 0; },
    set(v) { Store.put(BEST_KEY, String(v)); },
    // рекорд из облака, если там больше (например, ставили на другом устройстве)
    sync(cb) {
      Store.cloud(BEST_KEY, v => {
        const c = parseInt(v, 10) || 0;
        if (c > Best.get()) { try { localStorage.setItem(BEST_KEY, String(c)); } catch (e) { /* нет доступа */ } }
        cb(Best.get());
      });
    },
  };

  // снимок партии на утро: только то, что нужно, чтобы продолжить с этого же утра
  function snapshot() {
    const g = game;
    return {
      v: 1, ts: Date.now(), day: g.day, res: g.res, gf: g.gf, lastParty: g.lastParty || 0, lastRap: g.lastRap || 0, lastDoctor: g.lastDoctor || 0, flood: !!g.flood, poops: g.poops, log: g.log,
      people: g.people.map(p => ({
        id: p.id, hunger: p.hunger, health: p.health, happy: p.happy, crave: p.crave, alive: p.alive, away: p.away,
        skill: p.skill, task: p.task === 'rap' ? (p.taskBefore || 'work') : p.task, plan: p.plan, x: p.x, y: p.y, ill: p.ill, broken: p.broken || 0,
      })),
    };
  }
  function saveGame() { Store.put(SAVE_KEY, JSON.stringify(snapshot())); }
  function eraseSave() { Store.put(SAVE_KEY, JSON.stringify({ v: 1, ts: Date.now(), over: true })); }
  // свежее сохранение (телефон или облако); null — если нет или партия закончена
  function loadSave(cb) {
    const loc = parse(Store.local(SAVE_KEY));
    Store.cloud(SAVE_KEY, v => {
      const best = newest(loc, parse(v));
      cb(best && !best.over && best.day ? best : null);
    });
  }

  function createGame() {
    game = {
      day: 0, dayT: 0, phase: 'morning',
      res: { food: 6, cigs: 6, money: 1200, beer: 1, energy: 1, meds: 1 },
      people: RESIDENTS.map(r => ({
        ...r, hunger: 20, health: 100, happy: 70, crave: 20, alive: true, away: 0, skill: 0,
        x: POI[r.bed].x, y: POI[r.bed].y, path: [], act: 'спит', task: 'work',
        plan: { food: true, cigs: true, beer: false, energy: false, meds: false }, ill: null, sched: [], hidden: false, flags: {},
      })),
      guests: [], cat: null, poops: [], texts: [], log: [], flags: {}, flagsToday: {}, gf: false, shopCart: null, knock: null, lastParty: 0, lastRap: 0, lastDoctor: 0, flood: false, doctorToday: false,
    };
    simPaused = false;
  }

  function newGame() {
    createGame();
    morning();
  }

  // продолжить с утра сохранённого дня
  function continueGame(d) {
    createGame();
    const g = game;
    g.day = d.day; g.res = Object.assign({ meds: 0 }, d.res); g.gf = !!d.gf; g.flood = !!d.flood;
    // старые сохранения: была одна тусовка на 15-й день
    g.lastParty = d.lastParty || (d.partyOffered ? d.day : 0);
    g.lastRap = d.lastRap || 0;
    g.lastDoctor = d.lastDoctor || 0; g.poops = d.poops || []; g.log = d.log || [];
    for (const sp of d.people) {
      const p = byId(sp.id);
      if (p) Object.assign(p, sp);
    }
    g.phase = 'morning';
    g.event = g.day > 1 ? rollEvent() : null;
    openMorning();
  }

  const present = () => game.people.filter(p => p.alive && !p.away);
  const byId = id => game.people.find(p => p.id === id);
  // весь день занят поиском телефона или ремонтом — других заданий нет
  const busy = p => p.flags.search || p.flags.repair;
  const say = (p, text) => game.texts.push({ x: p.x, y: p.y - 10, text, life: 1.4 });
  function log(s) { game.log.push(s); }

  // ---------------- Маршруты по квартире ----------------
  // В какой комнате точка — по плану (балкон считается частью своей комнаты, прихожая — коридором).
  // Комнату определяем по координатам, а не запоминаем: иначе, сменив цель на полпути, жилец срезал бы сквозь стену.
  const ROOM_OF = { balconyD: 'damir', balconyR: 'roma', entrance: 'hall' };
  function roomAt(x, y) {
    for (const rm of ROOMS) {
      if (x >= rm.x && x <= rm.x + rm.w && y >= rm.y && y <= rm.y + rm.h) return ROOM_OF[rm.id] || rm.id;
    }
    return 'hall';
  }
  const BALCONY_DOOR = { damir: [27, 16], roma: [138, 16] };

  // маршрут до точки {x, y}: из своей комнаты через её дверь в коридор, по коридору к нужной двери, внутрь
  function routeTo(o, to) {
    const pts = [];
    const from = roomAt(o.x, o.y), dest = roomAt(to.x, to.y);
    const onBalcony = o.y < 12 && BALCONY_DOOR[from];
    const toBalcony = to.y < 12 && BALCONY_DOOR[dest];
    if (onBalcony && !(toBalcony && from === dest)) pts.push(BALCONY_DOOR[from]);
    if (from !== dest) {
      if (ROOM_DOOR[from]) pts.push(ROOM_DOOR[from].in, ROOM_DOOR[from].out);
      pts.push([ROOM_DOOR[from] ? ROOM_DOOR[from].out[0] : o.x, HALL_Y]);
      if (ROOM_DOOR[dest]) pts.push([ROOM_DOOR[dest].out[0], HALL_Y], ROOM_DOOR[dest].out, ROOM_DOOR[dest].in);
      else pts.push([to.x, HALL_Y]);
    } else if (from === 'hall' && Math.abs(to.x - o.x) > 8) {
      // коридор Г-образный (с прихожей) — идём по его середине, чтобы не срезать угол санузла
      pts.push([o.x, HALL_Y], [to.x, HALL_Y]);
    }
    if (toBalcony && !(onBalcony && from === dest)) pts.push(BALCONY_DOOR[dest]);
    pts.push([to.x, to.y]);
    o.path = pts.map(([x, y]) => ({ x, y }));
  }
  function route(o, poi) { routeTo(o, POI[poi]); o.dest = poi; }

  function walk(o, dt) {
    if (!o.path || !o.path.length) return true;
    const tgt = o.path[0], dx = tgt.x - o.x, dy = tgt.y - o.y, d = Math.hypot(dx, dy), step = 30 * dt;
    if (d <= step) { o.x = tgt.x; o.y = tgt.y; o.path.shift(); return !o.path.length; }
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
      if (p.alive && !p.away) { p.x = POI[p.bed].x; p.y = POI[p.bed].y; p.path = []; p.hidden = false; }
      p.flags = {};
      if (p.broken > 0) p.broken--;
      if (p.task === 'rap') p.task = p.taskBefore || 'work';
    }
    payRent();
    illnessMorning();
    // автосохранение: если закрыть игру днём, она продолжится с этого утра
    saveGame();
    // в рейтинг идёт и незаконченная партия: дожил до этого утра — уже результат
    if (typeof Rating !== 'undefined' && game.day > 1) Rating.submit('trap', game.day);
    game.event = game.day > 1 ? rollEvent() : null;
    openMorning();
  }

  // раз в неделю хозяин квартиры забирает аренду; не хватает денег — забирает всё и ругается
  function payRent() {
    const g = game;
    if (g.day < RENT_EVERY || g.day % RENT_EVERY) return;
    const rent = rentAmount();
    if (g.res.money >= rent) { g.res.money -= rent; log('🏠 Хозяин забрал аренду: −' + rent + '₽'); return; }
    log('🏠 Аренда ' + rent + '₽, а было только ' + g.res.money + '₽ — хозяин забрал всё и наорал. Всем −25 настроения');
    g.res.money = 0;
    for (const p of present()) p.happy = cl(p.happy - 25);
  }

  // кто будет чинить потоп: лучше Дамир, иначе любой, кто дома
  const fixer = () => { const D = byId('damir'); return D.alive && !D.away ? D : present()[0]; };
  function floodEvent(first) {
    const g = game, master = priceOf(500), parts = priceOf(130), f = fixer();
    return {
      title: first ? '💧 ПОТОП!' : '💧 В квартире всё ещё потоп',
      text: (first ? 'Прорвало трубу в ванной — вода по всей квартире.<br>' : 'Пол мокрый, пахнет сыростью.<br>') +
        'Пока не починить — <span class="ev-dn">всем −настроение каждый день</span> <span class="ev-dn">чаще болеют</span>.',
      choices: [
        { label: 'ВЫЗВАТЬ МАСТЕРА −' + master + '₽', ok: () => g.res.money >= master, fn: () => { g.res.money -= master; g.flood = false; log('Мастер починил трубу'); } },
        ...(f ? [{ label: f.name.toUpperCase() + ' ЧИНИТ ВЕСЬ ДЕНЬ −' + parts + '₽', ok: () => g.res.money >= parts, fn: () => { g.res.money -= parts; f.flags.repair = true; } }] : []),
        { label: 'ПОТОМ', fn: () => {} },
      ],
    };
  }

  // утреннее событие: либо сразу случается, либо требует выбора
  function rollEvent() {
    const g = game, S = byId('serezha'), D = byId('damir'), Rm = byId('roma');
    // пока не починили потоп — каждое утро напоминание (важнее тусовки и случайных событий)
    if (g.flood && !forceEvent) return floodEvent(false);
    // «Реп над Волгой»: не чаще раза в 6 дней; кто пойдёт — выбирается заданием «РЕП»
    const funReady = g.day - Math.max(g.lastRap || 0, g.lastParty || 0) >= FUN_GAP;
    const rapReady = funReady && g.day >= 4 && g.day - (g.lastRap || 0) >= RAP_GAP;
    if (forceEvent === 'rap' || (!forceEvent && rapReady && Math.random() < 0.3)) {
      forceEvent = null;
      g.lastRap = g.day;
      const free = Math.random() < RAP_FREE;
      g.flags = { rap: true, rapFree: free };
      return {
        title: '🎤 РЕП НАД ВОЛГОЙ' + (free ? ' — БЕСПЛАТНО!' : ''),
        text: (free
          ? 'Друзья организуют концерт на набережной и зовут всю хату <b>бесплатно</b>! Кто пойдёт — поставь ему задание <b>«РЕП»</b>.<br>'
          : 'Сегодня концерт на набережной! Билет — ' + RAP_PRICE + '₽ с каждого. Кто пойдёт — поставь ему задание <b>«РЕП»</b>, можно не всем.<br>') +
          'Весь день на концерте: <span class="ev-up">+30 сытости</span> <span class="ev-up">+50 курева</span> <span class="ev-up">настроение на максимум</span>',
      };
    }
    // тусовка: не раньше 10-го дня и не чаще раза в 5 дней, раньше прочих событий
    const partyReady = funReady && g.day >= PARTY_DAY && g.day - (g.lastParty || 0) >= PARTY_GAP;
    if (forceEvent === 'party' || (!forceEvent && partyReady && Math.random() < 0.35)) {
      forceEvent = null;
      g.lastParty = g.day;
      return {
        title: '🎉 ТУСОВКА?',
        text: 'Можно устроить тусовку! Придут сразу все друзья.<br>' +
          '<span class="ev-up">+ курево у всех на максимум</span> <span class="ev-up">+ настроение у всех на максимум</span><br>' +
          '<span class="ev-dn">− 30% здоровья у каждого</span> <span class="ev-dn">− 30% общего бюджета</span><br>Следующий шанс — не раньше чем через ' + PARTY_GAP + ' дней.',
        choices: [
          { label: 'УСТРОИТЬ ТУСОВКУ', fn: () => { g.partyToday = true; } },
          { label: 'НЕ СЕГОДНЯ', fn: () => {} },
        ],
      };
    }
    if (g.day >= GF_DAY && !g.gf && S.alive) {
      g.gf = true; S.happy = cl(S.happy + 40);
      return { title: 'Серёжа влюбился!', text: 'Серёжа познакомился с альтушкой. Теперь она иногда заходит в гости — Серёже от этого очень хорошо.' };
    }
    if (!forceEvent && Math.random() < calmChance()) return null;
    const pool = [];
    if (Rm.alive && !Rm.away) pool.push('phone');
    if (S.alive && !S.away) pool.push('oversleep');
    if (D.alive && !D.away && g.day > 2) pool.push('trip');
    pool.push('lights', 'pizza');
    // хорошие новости тоже бывают
    if (g.day >= 3) pool.push('gig', 'gig');
    if (g.day >= 25) pool.push('gig');
    // со временем добавляются новые неприятности, и их становится больше
    if (g.day >= 6) pool.push('flood');
    if (g.day >= 8) pool.push('laptop');
    if (g.day >= 10) pool.push('latepay');
    if (g.day >= 12) pool.push('police');
    if (g.day >= 25) pool.push('flood', 'laptop', 'police');
    if (g.day >= 45) pool.push('lights', 'latepay', 'police');
    const k = forceEvent || pick(pool);
    forceEvent = null;
    if (k === 'phone') {
      const cost = priceOf(800);
      return {
        title: 'Рома потерял телефон',
        text: 'Опять. Где-то в квартире… или нет.<br>Искать весь день — Рома ничего не сделает и не заработает. Купить новый — −' + cost + '₽. Забить — −40 настроения Роме.',
        choices: [
          { label: 'ИСКАТЬ ВЕСЬ ДЕНЬ', fn: () => { Rm.flags.search = true; } },
          { label: 'КУПИТЬ НОВЫЙ −' + cost + '₽', ok: () => g.res.money >= cost, fn: () => { g.res.money -= cost; } },
          { label: 'ЗАБИТЬ · −40 НАСТРОЕНИЯ', fn: () => { Rm.happy = cl(Rm.happy - 40); } },
        ],
      };
    }
    if (k === 'flood') { g.flood = true; return floodEvent(true); }
    if (k === 'gig') {
      const p = pick(present().filter(x => !x.broken && !x.ill));
      if (!p) return null;
      p.flags.gig = true;
      const who = p.id === 'serezha' ? 'Серёже' : p.id === 'damir' ? 'Дамиру' : 'Роме';
      return { title: '💰 Халтурка!', text: who + ' предложили лёгкий монтаж с хорошей оплатой — сегодня заплатят <b>вдвое больше</b>, и работа не портит настроение.<br>Не забудь поставить ему задание <b>«МОНТАЖ»</b>.' };
    }
    if (k === 'laptop') {
      const p = pick(present().filter(x => !x.broken)) || present()[0], cost = priceOf(1200);
      if (!p) return null;
      return {
        title: '💻 Сломался компьютер',
        text: 'У ' + (p.id === 'serezha' ? 'Серёжи' : p.id === 'damir' ? 'Дамира' : 'Ромы') + ' сдох компьютер. Без него монтировать нельзя.',
        choices: [
          { label: 'ПОЧИНИТЬ −' + cost + '₽', ok: () => g.res.money >= cost, fn: () => { g.res.money -= cost; } },
          { label: 'БЕЗ КОМПЬЮТЕРА 3 ДНЯ', fn: () => { p.broken = 3; } },
        ],
      };
    }
    if (k === 'police') {
      const fine = priceOf(230);
      return {
        title: '🚓 Соседи вызвали полицию',
        text: 'Ночью было слишком шумно. Участковый грозит штрафом.',
        choices: [
          { label: 'ЗАПЛАТИТЬ ШТРАФ −' + fine + '₽', ok: () => g.res.money >= fine, fn: () => { g.res.money -= fine; } },
          { label: 'ДОГОВОРИТЬСЯ · ВСЕМ −15 НАСТРОЕНИЯ', fn: () => { present().forEach(p => { p.happy = cl(p.happy - 15); }); } },
        ],
      };
    }
    if (k === 'latepay') { g.flags = { latePay: true }; return { title: 'Заказчик тянет с оплатой', text: 'Сегодня за монтаж заплатят только половину.' }; }
    if (k === 'oversleep') { S.flags.slept = true; S.happy = cl(S.happy + 5); return { title: 'Серёжа проспал', text: 'Серёжа проспал полдня. Сегодня он сделает вдвое меньше.' }; }
    if (k === 'trip') { D.away = 2; return { title: 'Дамир уехал', text: 'Дамир уехал к родителям на 2 дня. Вернётся с едой.' }; }
    if (k === 'lights') { g.flags = { noPower: true }; return { title: 'Отключили свет', text: 'Компьютеры не работают — сегодня монтировать не получится.' }; }
    g.res.food += 2;
    return { title: 'Сосед угостил', text: 'Сосед снизу занёс две пиццы. +2 еды.' };
  }

  // ---------------- Болезни ----------------
  // каждое утро: болезнь идёт на убыль, грипп и простуда могут перекинуться на соседей, здоровые могут заболеть
  function illnessMorning() {
    const g = game, home = present();
    if (g.day <= 1) return;
    const sick = home.filter(p => p.ill);
    for (const p of sick) {
      p.ill.days--;
      if (p.ill.days <= 0) { log(p.name + ' выздоровел'); p.ill = null; }
    }
    for (const src of sick.filter(p => p.ill)) {
      for (const o of home) {
        if (!o.ill && Math.random() < ILLS[src.ill.type].spread) { infect(o, src.ill.type); log(o.name + ' заразился от ' + (src.id === 'serezha' ? 'Серёжи' : src.id === 'damir' ? 'Дамира' : 'Ромы')); }
      }
    }
    for (const p of home) {
      if (p.ill) continue;
      const chance = 0.05 + illBonus() + (g.flood ? 0.04 : 0) + (p.health < 50 ? 0.06 : 0) + (p.hunger > 80 ? 0.04 : 0);
      if (Math.random() < chance) {
        const r = Math.random(), type = r < 0.5 ? 'cold' : r < 0.75 ? 'poison' : 'flu';
        infect(p, type);
        log('🤒 ' + p.name + ' заболел: ' + ILLS[type].name.toLowerCase() + ' на ' + ILLS[type].days + ' дн.');
      }
    }
  }
  function infect(p, type) { p.ill = { type, days: ILLS[type].days }; }

  // ---------------- Начало дня ----------------
  function beginDay(cart) {
    const g = game;
    g.phase = 'day';
    g.flagsToday = g.flags || {};
    g.flags = {};
    g.shopCart = cart;
    // врач: бесплатно по ОМС, если с прошлого бесплатного вызова прошло 10 дней, иначе платно
    g.doctorAt = null;
    if (g.doctorToday) {
      g.doctorToday = false;
      if (doctorFree()) { g.lastDoctor = g.day; g.doctorAt = 0.2; log('Вызвали врача по ОМС — бесплатно'); }
      else if (g.res.money >= DOCTOR_PRICE) { g.res.money -= DOCTOR_PRICE; g.doctorAt = 0.2; log('Вызвали платного врача: −' + DOCTOR_PRICE + '₽'); }
    }
    const rappers = g.flagsToday.rap ? present().filter(p => p.task === 'rap' && !busy(p)) : [];
    const ticket = g.flagsToday.rapFree ? 0 : RAP_PRICE;
    if (rappers.length && ticket) { g.res.money -= ticket * rappers.length; log('Билеты на «Реп над Волгой»: −' + ticket * rappers.length + '₽'); }
    else if (rappers.length) log('На «Реп над Волгой» пустили бесплатно — по знакомству');
    const cooks = present().filter(p => p.task === 'cook' && !busy(p));
    const cookBonus = cooks.length ? 15 + (cooks.some(p => p.id === 'roma') ? 5 : 0) : 0;
    for (const p of present()) {
      if (p.plan.food && g.res.food > 0) { g.res.food--; p.hunger = cl(p.hunger - 45 - cookBonus); p.flags.ate = true; }
      if (p.plan.cigs && g.res.cigs > 0) { g.res.cigs--; p.crave = cl(p.crave - 65); p.flags.smoked = true; }
      if (p.plan.beer && g.res.beer > 0) { g.res.beer--; p.happy = cl(p.happy + 20); p.health = cl(p.health - 3); say(p, 'ПИВО!'); }
      if (p.plan.energy && g.res.energy > 0) { g.res.energy--; p.flags.energy = true; p.health = cl(p.health - 3); p.hunger = cl(p.hunger + 8); }
      // лекарства: болезнь короче на 2 дня и немного здоровья
      if (p.plan.meds && p.ill && g.res.meds > 0) {
        g.res.meds--; p.plan.meds = false;
        p.health = cl(p.health + 10); p.ill.days -= 2;
        say(p, 'ТАБЛЕТКИ');
        if (p.ill.days <= 0) { p.ill = null; log(p.name + ' выпил лекарства и сразу выздоровел'); }
      }
      if (cooks.length) p.happy = cl(p.happy + 6);
      buildSchedule(p);
    }
    // гости и кот на сегодня
    g.knockAt = Math.random() < 0.5 ? rnd(0.22, 0.6) : null;
    g.catAt = Math.random() < 0.22 ? rnd(0.25, 0.55) : null;
    // иногда вечером все собираются у Серёжи смотреть телевизор
    g.gatherAt = Math.random() < 0.35 ? rnd(0.6, 0.7) : null;
    g.partyAt = null;
    // кто готовит — к середине дня общий ужин (запасы еды не тратит)
    g.dinnerAt = cooks.length ? 0.45 : null;
    g.dinnerBy = cooks.map(p => p.name);
    g.dinnerFull = cooks.some(p => p.id === 'roma') ? 35 : 25;
    if (g.partyToday) { g.partyToday = false; g.partyAt = 0.22; g.gatherAt = 0.3; g.knockAt = null; }
    g.shopperBack = false;
    Sound.startMusic('trap');
  }

  function buildSchedule(p) {
    const s = [];
    if (p.flags.ate) s.push({ at: 0.03, poi: 'table', act: 'ест' });
    if (p.flags.smoked) s.push({ at: 0.11, poi: p.smoke, act: 'курит' });
    const main = p.flags.search ? 'search' : p.flags.repair ? 'repair' : p.task;
    if (main === 'work') s.push({ at: 0.18, poi: p.pc, act: 'монтаж' });
    else if (main === 'cook') { s.push({ at: 0.16, poi: 'stove', act: 'готовит' }); s.push({ at: 0.45, poi: 'table', act: 'ест' }); }
    else if (main === 'rest') s.push({ at: 0.18, poi: p.id === 'serezha' ? 'pcS' : 'tv', act: p.id === 'serezha' ? 'дота' : 'отдыхает' });
    else if (main === 'sport') s.push({ at: 0.18, poi: 'sport', act: 'качается' });
    else if (main === 'shop') s.push({ at: 0.14, poi: 'door', act: 'в магазин', leave: 'shop' });
    else if (main === 'rap' && game.flagsToday.rap) s.push({ at: 0.1, poi: 'door', act: 'на рэп', leave: 'rap' });
    else if (main === 'search') for (let a = 0.16; a < 0.7; a += 0.09) s.push({ at: a, poi: pick(['hallMid', 'table', 'tv', 'bath', 'laundry', p.bed]), act: 'ищет телефон' });
    else if (main === 'repair') for (let a = 0.16; a < 0.7; a += 0.12) s.push({ at: a, poi: pick(['bath', 'bath', 'hallMid', 'laundry']), act: 'чинит трубу' });
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
    if (g.partyAt && prev < g.partyAt && ph >= g.partyAt) startParty();
    if (g.gatherAt && prev < g.gatherAt && ph >= g.gatherAt) gather();
    if (g.dinnerAt && prev < g.dinnerAt && ph >= g.dinnerAt) dinner();
    if (g.doctorAt && prev < g.doctorAt && ph >= g.doctorAt) doctorComes();

    for (const p of present()) {
      // расписание
      while (p.sched.length && ph >= p.sched[0].at) {
        const it = p.sched.shift();
        if (p.hidden) continue;
        route(p, it.poi);
        p.act = it.act;
        p.going = it.leave || null;
      }
      if (!p.hidden && walk(p, dt) && p.going) {
        p.hidden = p.going; p.going = null;
        p.backAt = p.hidden === 'rap' ? 0.82 : 0.55;
        log(p.name + (p.hidden === 'rap' ? ' уехал на «Реп над Волгой»' : ' ушёл в магазин'));
      }
      if (p.hidden && ph >= p.backAt) {
        const was = p.hidden;
        p.hidden = false; p.x = POI.door.x; p.y = POI.door.y;
        if (was === 'rap') {
          p.hunger = cl(p.hunger - 30); p.crave = cl(p.crave - 50); p.happy = 100;
          route(p, p.bed); p.act = 'под впечатлением'; say(p, 'КАЙФ!');
          log(p.name + ' вернулся с концерта: сытый, накуренный, счастливый');
        } else {
          route(p, 'fridge'); p.act = 'разбирает пакеты';
          if (g.shopCart) { for (const k in g.shopCart) g.res[k] += g.shopCart[k]; g.shopCart = null; say(p, 'ПОКУПКИ!'); Sound.play('coin'); }
          // повезло: нашёл деньги по дороге
          if (Math.random() < 0.15) { g.res.money += 500; say(p, '+500₽!'); log('💵 ' + p.name + ' нашёл на улице 500₽'); }
        }
      }

      // параметры
      const asleep = ph >= 0.9;
      const k = wear();
      p.hunger = cl(p.hunger + 30 * k * dd);
      p.crave = cl(p.crave + p.craveRate * k * dd);
      p.happy = cl(p.happy - 9 * k * dd - g.poops.length * 12 * dd - (g.flood ? 10 * dd : 0));
      if (p.hunger >= 100) p.health = cl(p.health - 30 * dd);
      if (p.crave >= 100) { p.happy = cl(p.happy - 20 * dd); p.health = cl(p.health - 4 * dd); }
      if (p.happy <= 0) p.health = cl(p.health - 10 * dd);
      if (asleep && p.hunger < 80) p.health = cl(p.health + BAL.sleep * dd);
      const at = p.path.length === 0 && !p.hidden;
      if (at && p.act === 'отдыхает') p.happy = cl(p.happy + 70 * dd);
      if (at && p.act === 'смотрит ТВ') p.happy = cl(p.happy + 25 * dd);
      if (at && p.act === 'дота') p.happy = cl(p.happy + 90 * dd);
      if (at && p.act === 'качается') { p.health = cl(p.health + 36 * dd); p.hunger = cl(p.hunger + 12 * dd); p.happy = cl(p.happy + 8 * dd); }
      if (at && p.act === 'монтаж' && !p.flags.gig) p.happy = cl(p.happy - 5 * dd);
      // Серёжа спасается вейпом и снюсом, если сигарет не дали
      if (p.id === 'serezha' && !p.flags.vape && p.crave > 75) { p.flags.vape = true; p.crave = cl(p.crave - 30); say(p, 'ВЕЙП'); }
      if (p.ill) {
        p.health = cl(p.health - ILLS[p.ill.type].drain * dd);
        p.happy = cl(p.happy - 5 * dd);
        p.coughT = (p.coughT || 0) - dt;
        if (p.coughT <= 0 && !p.hidden) { p.coughT = rnd(2.5, 5); say(p, p.ill.type === 'poison' ? 'УХ…' : 'КХЕ-КХЕ'); }
      }
      if (p.health <= 0) die(p);
    }

    // гости, кот
    for (const gu of g.guests) {
      walk(gu, dt);
      if (!gu.leaving && ph >= gu.until) { gu.leaving = true; routeTo(gu, POI.door); }
      if (gu.leaving) { if (!gu.path.length) gu.gone = true; continue; }
      // девушки держатся рядом со своими парнями; остальные — у телевизора (или все вместе на диване)
      if (gu.cookUntil && ph >= gu.cookUntil) vikaDinner(gu);
      gu.reT -= dt;
      if (gu.reT <= 0 && !gu.watching) {
        gu.reT = 1.5;
        const host = HOSTS[gu.id] && byId(HOSTS[gu.id]);
        const spot = gu.cookUntil ? POI.stove : host && host.alive && !host.away && !host.hidden ? { x: host.x + 7, y: host.y + 1 } : gu.spot;
        if (Math.hypot(spot.x - gu.x, spot.y - gu.y) > 10 && !gu.path.length) routeTo(gu, spot);
      }
    }
    g.guests = g.guests.filter(gu => !gu.gone);
    if (g.cat) {
      if (walk(g.cat, dt)) {
        if (g.cat.steps-- > 0) {
          const spot = pick([POI.hallMid, POI.hallEnd, POI.table, { x: 30, y: 104 }, { x: 100, y: 98 }]);
          routeTo(g.cat, { x: spot.x + rnd(-6, 6), y: spot.y + rnd(-3, 3) });
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
    // кто болел и отдыхал — поправляется на день быстрее
    for (const p of present()) {
      if (p.ill && p.task === 'rest' && !busy(p)) { p.ill.days--; if (p.ill.days <= 0) { p.ill = null; log(p.name + ' отлежался и выздоровел'); } }
    }
    if (g.flood && present().some(p => p.flags.repair)) { g.flood = false; log('🔧 Трубу починили — потопа больше нет'); }
    for (const p of present()) {
      if (p.task !== 'work' || busy(p)) continue;
      if (p.broken) { log(p.name + ' без компьютера — монтировать не на чем'); continue; }
      if (p.ill && ILLS[p.ill.type].pay === 0) { log(p.name + ' болеет гриппом и не смог работать'); continue; }
      if (g.flagsToday.noPower) continue;
      let pay = Math.round((p.id === 'serezha' ? 150 + 60 * p.skill : p.pay) * wageK());
      if (p.happy <= 5) { log(p.name + ' не смог работать — совсем нет настроения'); continue; }
      if (p.flags.energy) pay *= 2;
      if (p.flags.slept) pay = Math.round(pay / 2);
      if (p.flags.gig) { pay *= 2; log('💰 ' + p.name + ' сделал халтурку — оплата ×2' + (p.flags.energy ? ', с энергетиком ×4' : '')); }
      if (p.happy < moodBar()) { pay = Math.round(pay * 0.6); log('Заказчику не понравился монтаж ' + (p.id === 'serezha' ? 'Серёжи' : p.id === 'damir' ? 'Дамира' : 'Ромы') + ' — без настроения работа хуже (−40%)'); }
      if (g.flagsToday.latePay) pay = Math.round(pay / 2);
      if (p.ill) { pay = Math.round(pay * ILLS[p.ill.type].pay); log(p.name + ' работал больным — заплатили меньше'); }
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
  function knock(force) {
    const g = game, D = byId('damir'), Rm = byId('roma'), S = byId('serezha');
    const who = ['anya', 'sashasonya'];
    if (Rm.alive) who.push('polina');
    if (D.alive && !D.away) who.push('vika');
    if (g.gf && S.alive) who.push('gf', 'gf');
    if (g.day >= 4) who.push('savely');
    // кто уже в гостях, второй раз не стучит
    const free = who.filter(id => !g.guests.some(gu => gu.id === id));
    if (!force && !free.length) return;
    g.knock = force || pick(free);
    Sound.play('bump');
    setTimeout(() => Sound.play('bump'), 180);
    showKnock(g.knock);
  }

  // гость входит в квартиру; spot — где он сидит, если рядом нет «его» жильца
  function addGuest(id, until) {
    const g = game, f = FRIENDS[id];
    const gu = { id, name: f.name, color: f.color, x: POI.door.x, y: POI.door.y, path: [], until, reT: 1.5, spot: { x: 80 + rnd(-4, 10), y: 50 + rnd(-8, 10) } };
    // девушки сразу идут к своему парню, остальные — к телевизору
    const host = HOSTS[id] && byId(HOSTS[id]);
    routeTo(gu, host && host.alive && !host.away && !host.hidden ? { x: host.x + 7, y: host.y + 1 } : gu.spot);
    g.guests.push(gu);
    return gu;
  }

  function letIn(id) {
    const g = game;
    addGuest(id, Math.min(0.85, g.dayT / DAY + 0.2));
    const all = present();
    if (id === 'anya') { g.res.money += 500; if (g.res.food > 0) g.res.food--; log('Аня принесла заказ на съёмку: +500₽ (и съела порцию)'); }
    if (id === 'sashasonya') { g.res.food += 2; all.forEach(p => { p.happy = cl(p.happy + 12); }); log('Саша и Соня принесли чипсы: +2 еды, всем веселее'); }
    if (id === 'polina') {
      const r = byId('roma'); r.happy = cl(r.happy + 30);
      // чаще объедает, но иногда приходит с пакетом
      if (Math.random() < 0.3) { g.res.food++; g.res.cigs++; log('Полина зашла к Роме с пакетом: +1 еда, +1 сигареты, Роме сильно лучше'); }
      else { if (g.res.food > 0) g.res.food--; if (g.res.cigs > 0) g.res.cigs--; log('Полина зашла к Роме: Роме сильно лучше (съела еду, стрельнула сигарету)'); }
    }
    if (id === 'savely') {
      const parts = [];
      if (Math.random() < 0.5) { g.res.energy += 2; parts.push('привёз 2 энергетика'); }
      else if (g.res.energy > 0) { g.res.energy--; parts.push('выпил энергетик'); }
      if (Math.random() < 0.5 && g.res.cigs > 0) { g.res.cigs--; parts.push('стрельнул сигарету'); }
      else parts.push('курил свои');
      log('Савелий заехал: ' + parts.join(', '));
    }
    if (id === 'vika') {
      const d = byId('damir'); d.happy = cl(d.happy + 30);
      // сначала идёт к плите, ужин — через часть дня (но до отбоя)
      const gu = g.guests[g.guests.length - 1];
      gu.cookUntil = Math.min(0.8, g.dayT / DAY + 0.12);
      gu.until = Math.max(gu.until, gu.cookUntil + 0.05);
      routeTo(gu, POI.stove);
      say(gu, 'ГОТОВЛЮ!');
      log('Вика пришла к Дамиру и встала к плите');
    }
    if (id === 'gf') { const s = byId('serezha'); s.happy = cl(s.happy + 30); if (g.res.food > 0) g.res.food--; log('Альтушка Серёжи зашла в гости: Серёже хорошо'); }
    Sound.play('checkpoint');
  }

  // ужин от повара: всем, кто дома, −25 голода (у Ромы сытнее — −35)
  function dinner() {
    const g = game;
    serveDinner(g.dinnerFull, g.dinnerBy.join(' и ') + ' ' + (g.dinnerBy.length > 1 ? 'приготовили' : 'приготовил') + ' ужин');
  }
  function serveDinner(full, who) {
    const eaters = present().filter(p => !p.hidden);
    for (const p of eaters) { p.hunger = cl(p.hunger - full); say(p, 'УЖИН!'); }
    if (eaters.length) log('🍲 ' + who + ': всем −' + full + ' голода');
    Sound.play('coin');
  }
  const doctorFree = () => !game.lastDoctor || game.day - game.lastDoctor >= DOCTOR_FREE_EVERY;
  // врач приходит, осматривает всех, кто дома: здоровье, а больным — болезнь на день короче
  function doctorComes() {
    const g = game;
    const gu = addGuest('doctor', Math.min(0.85, g.dayT / DAY + 0.12));
    say(gu, 'ОТКРЫВАЙТЕ!');
    for (const p of present()) {
      p.health = cl(p.health + DOCTOR_HEAL);
      say(p, '+ЗДОРОВЬЕ');
      if (p.ill) { p.ill.days--; if (p.ill.days <= 0) { p.ill = null; log(p.name + ' вылечился у врача'); } }
    }
    log('🩺 Врач осмотрел всех: +' + DOCTOR_HEAL + ' здоровья, болезни короче');
    Sound.play('checkpoint');
  }

  // Вика готовит у плиты, а через часть дня зовёт всех ужинать и оставляет порцию в холодильнике
  function vikaDinner(gu) {
    gu.cookUntil = 0;
    serveDinner(30, 'Вика приготовила ужин на всех');
    game.res.food++;
    log('Вика оставила порцию в холодильнике: +1 еда');
  }

  // все, кто дома, и гости собираются на диване и ковре у телевизора Серёжи
  function gather() {
    const g = game, ph = g.dayT / DAY;
    let i = 0;
    for (const p of present()) {
      if (p.hidden) continue;
      p.sched = p.sched.filter(it => it.at >= 0.86);
      const [x, y] = TV_SPOTS[i++ % TV_SPOTS.length];
      routeTo(p, { x, y });
      p.act = 'смотрит ТВ';
    }
    for (const gu of g.guests) {
      if (gu.leaving) continue;
      const [x, y] = TV_SPOTS[i++ % TV_SPOTS.length];
      gu.watching = true;
      gu.until = Math.max(gu.until, Math.min(0.86, ph + 0.15));
      routeTo(gu, { x, y });
    }
    log('Все собрались у Серёжи смотреть телевизор');
  }

  // тусовка: приходят все друзья
  function startParty() {
    const g = game;
    const ids = ['anya', 'sashasonya', 'polina', 'vika', 'savely'].concat(g.gf ? ['gf'] : []);
    ids.forEach((id, k) => { const gu = addGuest(id, 0.86); gu.x += k * 3; });
    for (const p of present()) {
      p.crave = 0;
      p.happy = 100;
      p.health = cl(p.health * 0.7);
      say(p, 'ТУСОВКА!');
    }
    g.res.money = Math.floor(g.res.money * 0.7);
    log('Тусовка! Пришли все друзья: курево и настроение на максимуме, здоровье и бюджет −30%');
    Sound.play('win');
  }

  function catComes() {
    game.cat = { x: POI.door.x, y: POI.door.y, path: [], steps: 5, pooped: false };
    routeTo(game.cat, POI.hallMid);
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
    if (typeof Rating !== 'undefined') Rating.submit('trap', days);
    const best = Best.get();
    if (days > best) Best.set(days);
    eraseSave();
    showOver(days, Math.max(days, best), days > best);
  }

  // =====================================================================
  //                               ОТРИСОВКА
  // =====================================================================
  // фигурка по фото: стоит ногами в точке (x, y); при ходьбе переступает и покачивается
  function figure(sp, x, y, walking, label) {
    const img = walking && Math.floor(t * 6) % 2 ? sp.walk : sp.stand;
    const X = Math.round(ox + x - img.width / 2), Y = Math.round(oy + y + 3 - img.height - (walking && Math.floor(t * 6) % 2 ? 1 : 0));
    ctx.drawImage(img, X, Y);
    if (label) {
      ctx.font = '4px "Press Start 2P", monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
      ctx.fillStyle = C.ink; ctx.fillText(label, ox + x + 0.5, Y - 0.5);
      ctx.fillStyle = '#ffffff'; ctx.fillText(label, ox + x, Y - 1);
    }
  }

  // тело умершего: фигурка лежит на боку, бледная
  function body(sp, x, y) {
    const img = sp.dead;
    ctx.save();
    ctx.translate(Math.round(ox + x), Math.round(oy + y));
    ctx.rotate(-Math.PI / 2);
    ctx.drawImage(img, -img.width / 2, -img.height / 2);
    ctx.restore();
  }

  // лужи на полу во время потопа: ванная, коридор, прихожая
  const FLOOD = [[50, 122, 22, 14], [40, 97, 40, 9], [96, 99, 44, 8], [6, 126, 16, 12], [146, 98, 24, 8]];
  function drawLife() {
    const g = game;
    if (g.flood) for (const [x, y, w, h] of FLOOD) { R(x, y, w, h, 'rgba(70,150,230,0.45)'); R(x + 2, y + 1, Math.max(2, w - 8), 1, 'rgba(220,240,255,0.6)'); }
    for (const pp of g.poops) { R(pp.x - 2, pp.y - 2, 5, 4, C.ink); R(pp.x - 1, pp.y - 1, 3, 2, '#6b3a17'); R(pp.x, pp.y - 3, 1, 1, '#6b3a17'); }
    for (const p of g.people) {
      if (p.away || p.hidden) continue;
      if (!p.alive) { body(TRSPR[p.id], p.x, p.y); continue; }
      const sleeping = p.act === 'спит' && !p.path.length;
      figure(TRSPR[p.id], p.x, p.y, p.path.length > 0, p.name.toUpperCase());
      if (sleeping) { ctx.font = '4px "Press Start 2P", monospace'; ctx.fillStyle = '#ffffff'; ctx.fillText('Z', ox + p.x + 5, oy + p.y - 3 - Math.floor(t * 2) % 3); }
      else if (!p.path.length && p.act && p.act !== 'смотрит ТВ') {
        ctx.font = '4px "Press Start 2P", monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
        ctx.fillStyle = C.ink; ctx.fillText(p.act, ox + p.x + 0.5, oy + p.y + 4.5);
        ctx.fillStyle = '#ffe08a'; ctx.fillText(p.act, ox + p.x, oy + p.y + 4);
      }
    }
    for (const gu of g.guests) {
      const moving = gu.path.length > 0;
      if (gu.id === 'sashasonya') { figure(TRSPR.sasha, gu.x - 5, gu.y, moving, 'САША'); figure(TRSPR.sonya, gu.x + 5, gu.y, moving, 'СОНЯ'); }
      else figure(TRSPR[gu.id], gu.x, gu.y, moving, gu.name.toUpperCase());
    }
    if (g.cat) {
      const img = TRSPR.cat, flip = g.cat.path.length && g.cat.path[0].x < g.cat.x;
      const X = Math.round(ox + g.cat.x), Y = Math.round(oy + g.cat.y - img.height / 2);
      ctx.save(); ctx.translate(X, Y); if (flip) ctx.scale(-1, 1);
      ctx.drawImage(img, -img.width / 2, 0); ctx.restore();
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
    const hgt = p.ill && p.alive && !p.away ? 49 : 46;
    ctx.fillStyle = 'rgba(27,22,38,0.75)'; ctx.fillRect(x, y, w, hgt);
    ctx.fillStyle = p.color; ctx.fillRect(x, y, 3, hgt);
    ctx.drawImage(TRSPR[p.id].stand, x + w - 14, y + 1);
    txt(p.name.toUpperCase(), x + 6, y + 3, 5, '#ffffff');
    if (!p.alive) { txt('УМЕР', x + 6, y + 14, 5, '#e33b2e'); return; }
    if (p.away) { txt('У РОДИТЕЛЕЙ', x + 6, y + 14, 4, '#9fd0f0'); txt(p.away + ' ДН.', x + 6, y + 21, 4, '#9fd0f0'); return; }
    if (p.ill) txt(ILLS[p.ill.type].name + ' ' + p.ill.days + 'Д', x + 6, y + 41, 4, '#7dff8a');
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
    [['ЕДА', r.food], ['СИГАРЕТЫ', r.cigs], ['ДЕНЬГИ', r.money + '₽'], ['ПИВО/ЭН/ЛЕК', r.beer + '/' + r.energy + '/' + r.meds]].forEach(([lb, v], i) => {
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

  // портрет для HTML-карточек — тот же пиксельный спрайт
  const portraits = {};
  function portrait(id) { return portraits[id] || (portraits[id] = TRSPR[id].stand.toDataURL()); }

  // распределение запасов и задания на день
  function renderPlan() {
    const g = game, wrap = $('tr-people');
    const waiting = g.event && g.event.choices;
    wrap.classList.toggle('blocked', !!waiting);
    // сколько уже раздали
    const used = k => present().filter(p => p.plan[k]).length;
    for (const p of present()) if (!p.ill) p.plan.meds = false;
    for (const k of ['food', 'cigs', 'beer', 'energy', 'meds']) {
      for (const p of present()) if (p.plan[k] && used(k) > g.res[k]) p.plan[k] = false;
    }
    wrap.innerHTML = '';
    for (const p of g.people) {
      const c = document.createElement('div');
      c.className = 'tr-card' + (!p.alive ? ' dead' : p.away ? ' away' : '');
      c.style.borderColor = p.color;
      let html = '<div class="tr-name" style="color:' + p.color + '"><img class="tr-face" src="' + portrait(p.id) + '" alt="">' + p.name.toUpperCase() + '</div>';
      if (!p.alive) { c.innerHTML = html + '<div class="tr-note">☠ УМЕР</div>'; wrap.appendChild(c); continue; }
      if (p.away) { c.innerHTML = html + '<div class="tr-note">У РОДИТЕЛЕЙ ЕЩЁ ' + p.away + ' ДН.</div>'; wrap.appendChild(c); continue; }
      html += '<div class="tr-bars">' + [['сытость', 100 - p.hunger, '#ff9a3c'], ['здоровье', p.health, '#e33b2e'], ['настроение', p.happy, '#ffd23f'], ['курево', 100 - p.crave, '#9fd0f0']]
        .map(([n, v, col]) => '<div class="tr-bar"><span>' + n + '</span><i><b style="width:' + Math.round(v) + '%;background:' + col + '"></b></i></div>').join('') + '</div>';
      if (p.ill) html += '<div class="tr-ill">🤒 ' + ILLS[p.ill.type].name + ' — ещё ' + p.ill.days + ' дн.</div>';
      html += '<div class="tr-items">' + [['food', '🍗'], ['cigs', '🚬'], ['beer', '🍺'], ['energy', '⚡'], ['meds', '💊']].map(([k, ic]) => {
        const can = p.plan[k] || (used(k) < g.res[k] && (k !== 'meds' || p.ill));
        return '<button data-k="' + k + '" class="tr-it' + (p.plan[k] ? ' on' : '') + '"' + (can ? '' : ' disabled') + '>' + ic + '</button>';
      }).join('') + '</div>';
      const tasks = ['work', 'shop', 'cook', 'rest'].concat(p.id === 'roma' ? ['sport'] : [], g.flags.rap ? ['rap'] : []);
      // билеты: хватит ли денег ещё на одного
      const rapFull = rapPrice() && present().filter(x => x.task === 'rap').length * rapPrice() + rapPrice() > g.res.money;
      if (p.flags.gig) html += '<div class="tr-ill">💰 ХАЛТУРКА — монтаж сегодня ×2</div>';
      if (p.broken) html += '<div class="tr-ill">💻 БЕЗ КОМПЬЮТЕРА ЕЩЁ ' + p.broken + ' ДН. — монтаж не принесёт денег</div>';
      if (p.flags.search) html += '<div class="tr-ill">🔍 ИЩЕТ ТЕЛЕФОН ВЕСЬ ДЕНЬ — других заданий нет</div>';
      else if (p.flags.repair) html += '<div class="tr-ill">🔧 ЧИНИТ ТРУБУ ВЕСЬ ДЕНЬ — других заданий нет</div>';
      else html += '<div class="tr-tasks">' + tasks.map(k => '<button data-t="' + k + '" class="tr-task' + (p.task === k ? ' on' : '') + '"' + (k === 'rap' && p.task !== 'rap' && rapFull ? ' disabled' : '') + '>' + (k === 'rest' && p.id === 'serezha' ? 'ДОТА' : k === 'rap' ? 'РЕП ' + (rapPrice() ? rapPrice() + '₽' : 'БЕСПЛАТНО') : TASKS[k]) + '</button>').join('') + '</div>';
      c.innerHTML = html;
      c.querySelectorAll('[data-k]').forEach(b => b.onclick = () => { p.plan[b.dataset.k] = !p.plan[b.dataset.k]; Sound.play('click'); renderPlan(); });
      c.querySelectorAll('[data-t]').forEach(b => b.onclick = () => {
        if (b.dataset.t === 'rap' && p.task !== 'rap') p.taskBefore = p.task;
        p.task = b.dataset.t; Sound.play('click'); renderPlan();
      });
      wrap.appendChild(c);
    }
    const r = g.res;
    const docBtn = $('tr-doctor'), free = doctorFree(), left = DOCTOR_FREE_EVERY - (g.day - g.lastDoctor);
    docBtn.classList.toggle('on', !!g.doctorToday);
    docBtn.disabled = !g.doctorToday && !free && g.res.money < DOCTOR_PRICE;
    docBtn.innerHTML = (g.doctorToday ? '✔ ' : '') + '🩺 ВРАЧ НА ДОМ · ' + (free ? 'БЕСПЛАТНО ПО ОМС' : DOCTOR_PRICE + '₽ <small>(по ОМС через ' + left + ' дн.)</small>');
    const toRent = RENT_EVERY - g.day % RENT_EVERY;
    $('tr-stock').textContent = 'Запасы: еда ' + r.food + ' · сигареты ' + r.cigs + ' · ' + r.money + '₽ · пиво ' + r.beer + ' · энергетики ' + r.energy + ' · лекарства ' + r.meds +
      ' · аренда ' + (toRent === RENT_EVERY ? 'через неделю' : 'через ' + toRent + ' дн.') + ' (' + rentAt(g.day + toRent) + '₽)';
    $('tr-go').disabled = !!waiting;
  }

  function startDayClicked() {
    Sound.init();
    overlay('tr-morning', false);
    // кто ищет телефон, в магазин не пойдёт — если других покупателей нет, экран магазина не нужен
    if (present().some(p => p.task === 'shop' && !busy(p))) openShop();
    else beginDay(null);
  }

  // магазин: выбор покупок для того, кто идёт
  let cart = {};
  function openShop() {
    cart = { food: 0, cigs: 0, beer: 0, energy: 0, meds: 0 };
    renderShop();
    overlay('tr-shop', true);
  }
  function renderShop() {
    const money = game.res.money - rapCost(), spent = SHOP.reduce((a, it) => a + cart[it.id] * priceOf(it.price), 0);
    $('tr-shop-list').innerHTML = SHOP.map(it =>
      '<div class="tr-shop-row"><span>' + it.name + ' · ' + priceOf(it.price) + '₽</span><span><button data-m="' + it.id + '">−</button><b>' + cart[it.id] + '</b><button data-p="' + it.id + '"' + (spent + priceOf(it.price) > money ? ' disabled' : '') + '>+</button></span></div>').join('');
    $('tr-shop-total').textContent = 'Итого: ' + spent + '₽ из ' + money + '₽';
    $('tr-shop-list').querySelectorAll('[data-p]').forEach(b => b.onclick = () => { cart[b.dataset.p]++; Sound.play('click'); renderShop(); });
    $('tr-shop-list').querySelectorAll('[data-m]').forEach(b => b.onclick = () => { cart[b.dataset.m] = Math.max(0, cart[b.dataset.m] - 1); Sound.play('click'); renderShop(); });
  }
  // билеты на концерт оплачиваются в начале дня — в магазине на них уже не тратим
  function rapCost() {
    return (game.flags.rap ? present().filter(p => p.task === 'rap').length * rapPrice() : 0) + (game.doctorToday && !doctorFree() ? DOCTOR_PRICE : 0);
  }
  function buy() {
    const spent = SHOP.reduce((a, it) => a + cart[it.id] * priceOf(it.price), 0);
    game.res.money -= spent;
    overlay('tr-shop', false);
    beginDay(Object.assign({}, cart));
  }

  function showKnock(id) {
    const f = FRIENDS[id];
    $('tr-knock-text').textContent = 'Тук-тук! ' + f.text + '.';
    $('tr-knock-face').innerHTML = (id === 'sashasonya' ? ['sasha', 'sonya'] : [id]).map(k => '<img src="' + portrait(k) + '" alt="">').join('');
    overlay('tr-knock', true);
  }
  function answerKnock(open) {
    overlay('tr-knock', false);
    if (open) letIn(game.knock);
    else log(FRIENDS[game.knock].name + (game.knock === 'sashasonya' ? ' постучали' : ' постучал' + (['anya', 'polina', 'vika', 'gf'].includes(game.knock) ? 'а' : '')) + ', но никто не открыл');
    game.knock = null;
  }

  function showOver(days, best, isNew) {
    $('tr-over-days').textContent = days;
    $('tr-over-best').textContent = best;
    $('tr-over-new').classList.toggle('show', isNew);
    overlay('tr-over', true);
  }

  // ---------------- Обучение ----------------
  // эффекты в таблицах — по коду выше (beginDay, updateDay, letIn): при изменении баланса править и здесь
  // «++» — сильный эффект, «+» — обычный
  const up = (n, big) => '<i class="up">' + (big ? '++ ' : '+ ') + n + '</i>';
  const dn = (n, big) => '<i class="dn">' + (big ? '−− ' : '− ') + n + '</i>';
  const row = (what, eff) => '<tr><td>' + what + '</td><td>' + eff + '</td></tr>';
  const face = id => '<img class="tr-face" src="' + portrait(id) + '" alt="">';
  const TUTORIAL = [
    {
      title: 'КАК ИГРАТЬ',
      html: () => '<div class="tut-faces">' + face('serezha') + face('damir') + face('roma') + '</div>' +
        '<p>Серёжа, Дамир и Рома живут в одной хате. Твоя задача — чтобы они прожили <b>как можно больше дней</b>.</p>' +
        '<p><b>Утром</b> раздаёшь запасы и задания. <b>Днём</b> ребята живут сами, а ты отвечаешь на события. <b>Ночью</b> все спят.</p>' +
        '<p>Если здоровье жильца падает до нуля — он умирает. Умерли все трое — конец игры. Рекорд — число прожитых дней.</p>',
    },
    {
      title: 'ПОКАЗАТЕЛИ',
      html: () => '<p>У каждого жильца четыре полоски. <b>Полная — хорошо</b>, мигает — пора спасать.</p><table>' +
        row('<b class="c1">СЫТОСТЬ</b>', 'падает каждый день. На нуле быстро отнимает здоровье') +
        row('<b class="c2">ЗДОРОВЬЕ</b>', 'на нуле жилец умирает. Восстанавливается ночью во сне, если жилец не голоден') +
        row('<b class="c3">НАСТРОЕНИЕ</b>', 'понемногу падает. На нуле жилец не работает и начинает болеть') +
        row('<b class="c4">КУРЕВО</b>', 'падает, когда хочется курить. На нуле портит настроение и чуть-чуть здоровье') + '</table>',
    },
    {
      title: 'ЗАПАСЫ — РАЗДАЁШЬ УТРОМ',
      html: () => '<table>' +
        row('🍗 ЕДА', up('сытость', 1)) +
        row('🚬 СИГАРЕТЫ', up('курево', 1)) +
        row('🍺 ПИВО', up('настроение', 1) + ' ' + dn('здоровье')) +
        row('⚡ ЭНЕРГЕТИК', up('деньги за монтаж ×2') + ' ' + dn('здоровье') + ' ' + dn('сытость')) +
        row('💊 ЛЕКАРСТВА', 'только больному: болезнь короче на 2 дня, ' + up('здоровье')) + '</table>' +
        '<p>Запасы <b>общие</b>. Не хватает на всех — выбирай, кому нужнее. Пополнять — заданием «Магазин».</p>',
    },
    {
      title: 'ЗАДАНИЯ НА ДЕНЬ',
      html: () => '<table>' +
        row('МОНТАЖ', up('деньги вечером') + ' ' + dn('настроение') + '<br><small>Дамир и Рома — 450₽, Серёжа — от 150₽ и растёт с каждым днём</small>') +
        row('МАГАЗИН', 'покупаешь еду, сигареты, пиво, энергетики. Жилец уходит на полдня и не работает') +
        row('ГОТОВИТЬ', up('ужин всем — сытость', 1) + ' без трат еды ' + up('утренняя порция сытнее') + ' ' + up('настроение всем') + '<br><small>повар в этот день не монтирует; у Ромы ужин сытнее</small>') +
        row('ОТДЫХ / ДОТА', up('настроение', 1) + '<br><small>Серёже дота поднимает настроение сильнее</small>') +
        row('РЕП', 'только в день концерта «Реп над Волгой» (300₽, а иногда друзья зовут бесплатно): жилец уезжает на весь день и не работает. ' + up('сытость') + ' ' + up('курево', 1) + ' ' + up('настроение на максимум', 1)) +
        row('СПОРТ (Рома)', up('здоровье', 1) + ' ' + up('настроение') + ' ' + dn('сытость')) + '</table>' +
        '<p><b>🩺 Врач на дом</b> — кнопка в утреннем окне: по ОМС бесплатно раз в 10 дней, чаще — 500₽. Всем, кто дома, ' + up('здоровье', 1) + ', больным болезнь короче.</p>',
    },
    {
      title: 'ГОСТИ И КОТ',
      html: () => '<p>Днём стучат в дверь. Можно впустить или ответить «нас нет дома». Полина держится рядом с Ромой, Вика — с Дамиром.</p><table>' +
        row(face('anya') + 'АНЯ', up('500₽ — заказ на съёмку') + ' ' + dn('1 еда')) +
        row(face('sasha') + face('sonya') + 'САША И СОНЯ', up('2 еды — чипсы') + ' ' + up('настроение всем')) +
        row(face('polina') + 'ПОЛИНА', up('настроение Роме', 1) + ' ' + dn('1 еда') + ' ' + dn('1 сигарета') + '<br><small>иногда наоборот приносит еду и сигареты</small>') +
        row(face('vika') + 'ВИКА', 'встаёт к плите и готовит ужин: ' + up('сытость всем', 1) + ' ' + up('1 еда') + ' ' + up('настроение Дамиру', 1)) +
        row(face('savely') + 'САВЕЛИЙ', 'то привезёт ' + up('2 энергетика') + ', то выпьет ' + dn('1 энергетик') + '<br><small>сигарету иногда стреляет, иногда курит свои</small>') +
        row(face('gf') + 'АЛЬТУШКА СЕРЁЖИ', up('настроение Серёже', 1) + ' ' + dn('1 еда') + '<br><small>появится, если продержитесь до 10-го дня</small>') +
        row('🐈 КОТ ИЗ ПОДЪЕЗДА', 'может нагадить. Каждая кучка ' + dn('настроение всем') + '. <b>Нажми на кучку</b>, чтобы убрать') +
        row('📺 ВЕЧЕР У ТЕЛЕКА', 'иногда все собираются на диване у Серёжи: ' + up('настроение всем')) + '</table>',
    },
    {
      title: 'БОЛЕЗНИ',
      html: () => '<p>Иногда жильцы заболевают — чаще, если здоровье уже низкое или они голодны. Больной кашляет, у него в карточке видна болезнь и сколько дней осталось.</p><table>' +
        row('ПРОСТУДА · 3 ДН.', dn('здоровье каждый день') + ' ' + dn('половина денег за монтаж') + '<br><small>может заразить соседей</small>') +
        row('ОТРАВЛЕНИЕ · 2 ДН.', dn('здоровье каждый день', 1) + ' ' + dn('половина денег за монтаж')) +
        row('ГРИПП · 4 ДН.', dn('здоровье каждый день') + ' ' + dn('не может работать', 1) + '<br><small>заразный — легко передаётся тем, кто дома</small>') + '</table>' +
        '<p><b>Как лечить:</b> 💊 лекарства (в магазине) сокращают болезнь на 2 дня. Задание <b>«Отдых»</b> больному — выздоровление на день быстрее. 🩺 <b>Врач на дом</b> лечит всех сразу.</p>',
    },
    {
      title: 'ЧЕМ ДАЛЬШЕ — ТЕМ ТРУДНЕЕ',
      html: () => '<table>' +
        row('💸 ЦЕНЫ', 'в магазине дорожают на 1% в день (до ×2). За монтаж тоже платят больше, но медленнее') +
        row('🏠 АРЕНДА', 'каждые 7 дней хозяин забирает аренду — от 750₽, с каждой неделей больше. Не хватит денег — заберёт всё и всем ' + dn('настроение')) +
        row('😩 УСТАЛОСТЬ', 'голод, желание курить и скука со временем растут быстрее') +
        row('🎬 ЗАКАЗЧИКИ', 'если у жильца плохое настроение, за монтаж платят меньше — и требования растут') +
        row('⚠ НЕПРИЯТНОСТИ', 'спокойных дней всё меньше: потоп, сломанный компьютер, полиция, задержка оплаты. Чаще болеют') + '</table>' +
        '<p><b>Потоп</b> не пройдёт сам: вызови мастера или отправь кого-то чинить трубу на весь день.</p>',
    },
    {
      title: 'ХАРАКТЕРЫ',
      html: () => '<table>' +
        row(face('serezha') + 'СЕРЁЖА', 'курить хочет сильнее всех, но сам выручает себя вейпом. Иногда залипает в доту или просыпает') +
        row(face('damir') + 'ДАМИР', 'курит реже всех. Иногда уезжает к родителям и возвращается с едой') +
        row(face('roma') + 'РОМА', 'готовит лучше всех, но теряет телефон и опаздывает на съёмки') + '</table>' +
        '<p>Смерть друга сильно бьёт по настроению остальных.</p>' +
        '<p>Кнопки вверху: <b>×1 ×2 ×3</b> — скорость, <b>II</b> — пауза, <b>?</b> — это обучение.</p>',
    },
  ];
  let tutPage = 0, tutThenPlay = false;
  const tutDone = {
    get() { try { return localStorage.getItem('trap_tut_done') === '1'; } catch (e) { return true; } },
    set() { try { localStorage.setItem('trap_tut_done', '1'); } catch (e) { /* нет доступа */ } },
  };

  function openTutorial(thenPlay) {
    tutPage = 0;
    tutThenPlay = !!thenPlay;
    renderTut();
    overlay('tr-tut', true);
  }

  function renderTut() {
    const pg = TUTORIAL[tutPage], last = tutPage === TUTORIAL.length - 1;
    $('tr-tut-title').textContent = pg.title;
    $('tr-tut-body').innerHTML = pg.html();
    $('tr-tut-dots').innerHTML = TUTORIAL.map((_, i) => '<i class="' + (i === tutPage ? 'on' : '') + '"></i>').join('');
    $('tr-tut-prev').style.visibility = tutPage ? 'visible' : 'hidden';
    $('tr-tut-next').textContent = last ? (tutThenPlay ? 'ИГРАТЬ!' : 'ПОНЯТНО') : 'ДАЛЕЕ';
    $('tr-tut-skip').style.display = last ? 'none' : '';
  }

  function closeTutorial() {
    tutDone.set();
    overlay('tr-tut', false);
    if (tutThenPlay) { tutThenPlay = false; newGame(); }
  }

  // стартовый экран: «продолжить», если есть сохранение (ответ облака может прийти чуть позже)
  let pendingSave = null;
  function showIntro() {
    pendingSave = null;
    renderIntro();
    overlay('tr-intro', true);
    Best.sync(() => renderIntro());
    loadSave(d => { pendingSave = d; renderIntro(); });
  }
  function renderIntro() {
    $('tr-intro-best').textContent = Best.get();
    const has = !!pendingSave;
    $('tr-continue').style.display = has ? '' : 'none';
    if (has) $('tr-continue').textContent = 'ПРОДОЛЖИТЬ · ДЕНЬ ' + pendingSave.day;
    $('tr-new').textContent = has ? 'НОВАЯ ИГРА' : 'ЗАСЕЛИТЬСЯ';
    $('tr-new').classList.toggle('red', !has);
    $('tr-intro-warn').style.display = has ? '' : 'none';
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
    // при первом заселении сначала показываем обучение (его можно пропустить)
    $('tr-new').onclick = () => {
      Sound.init(); overlay('tr-intro', false); overlay('tr-over', false);
      if (tutDone.get()) newGame(); else openTutorial(true);
    };
    $('tr-continue').onclick = () => {
      if (!pendingSave) return;
      Sound.init(); Sound.play('click'); overlay('tr-intro', false);
      continueGame(pendingSave);
    };
    $('tr-help').onclick = () => { Sound.play('click'); openTutorial(false); };
    // обучение можно открыть и утром, пока планируешь день — окно планирования остаётся под ним
    $('tr-morning-help').onclick = () => { Sound.play('click'); openTutorial(false); };
    $('tr-intro-help').onclick = () => { Sound.play('click'); openTutorial(false); };
    $('tr-tut-next').onclick = () => { Sound.play('click'); if (tutPage < TUTORIAL.length - 1) { tutPage++; renderTut(); } else closeTutorial(); };
    $('tr-tut-prev').onclick = () => { Sound.play('click'); if (tutPage) { tutPage--; renderTut(); } };
    $('tr-tut-skip').onclick = () => { Sound.play('click'); closeTutorial(); };
    $('tr-again').onclick = () => { overlay('tr-over', false); newGame(); };
    $('tr-go').onclick = startDayClicked;
    $('tr-doctor').onclick = () => { game.doctorToday = !game.doctorToday; Sound.play('click'); renderPlan(); };
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
      guests: () => game.guests.map(g => ({ id: g.id, x: Math.round(g.x), y: Math.round(g.y), path: g.path.map(p => [Math.round(p.x), Math.round(p.y)]), reT: +g.reT.toFixed(1) })),
      state: () => game && { day: game.day, phase: game.phase, res: game.res, people: game.people.map(p => ({ id: p.id, h: Math.round(p.hunger), hp: Math.round(p.health), hap: Math.round(p.happy), cr: Math.round(p.crave), alive: p.alive, away: p.away, act: p.act })) },
      knock: id => knock(id),
      cat: () => catComes(),
      starve: () => { for (const p of game.people) { p.hunger = 100; p.health = 5; } },
      // проверка маршрутов: путь из (x, y) в (tx, ty), план комнат и дверей
      route: (x, y, tx, ty) => { const o = { x, y, path: [] }; routeTo(o, { x: tx, y: ty }); return o.path; },
      plan: () => ({ ROOMS, DOORS, roomAt }),
      party: () => { game.partyToday = true; },
      sick: (id, type) => { infect(byId(id), type || 'flu'); },
      nextEvent: k => { forceEvent = k; },
      gather: () => gather(),
      day: d => { game.day = d; },
      // для симуляции баланса ботом (scratchpad): прямой доступ к партии, без экранов
      raw: () => game,
      bal: BAL,
      price: base => priceOf(base),
      begin: c => { overlay('tr-morning', false); if (c) game.res.money -= SHOP.reduce((a, it) => a + (c[it.id] || 0) * priceOf(it.price), 0); beginDay(c); },
      answer: open => answerKnock(open),
      step: dt => updateDay(dt),
      // промотать игровое время на sec секунд (для проверок)
      tick: sec => { for (let i = 0; i < sec * 30 && game.phase === 'day' && !inUI; i++) updateDay(1 / 30); },
    },
  };
})();
