'use strict';
// «Трэп хата»: квартира Серёжи, Дамира и Ромы, вид сверху. Пока только сама квартира (по схеме автора);
// жильцы и механика выживания — следующим шагом.
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
      const lx = ox + rm.x + rm.w / 2, ly = oy + rm.y + (rm.id === 'kitchen' ? 22 : rm.h - 8);
      if (rm.id.startsWith('balcony')) continue;
      ctx.fillStyle = 'rgba(27,22,38,0.55)';
      ctx.fillText(rm.label, lx + 0.5, ly + 0.5);
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.fillText(rm.label, lx, ly);
    }
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
  }

  function frame(ts) {
    if (!running) return;
    t += Math.min(0.05, (ts - last) / 1000 || 0);
    last = ts;
    render();
    raf = requestAnimationFrame(frame);
  }

  function start() {
    layout();
    running = true;
    last = performance.now();
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(frame);
  }

  function stop() { running = false; cancelAnimationFrame(raf); }

  return { init, start, stop, layout, get running() { return running; } };
})();
