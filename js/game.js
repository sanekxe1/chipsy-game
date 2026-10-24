'use strict';
// «Хочу чипсов»: два режима — уровни (levels.js) и бесконечный забег с лавиной.
// Мир в логических пикселях (высота 180), канвас масштабируется под горизонтальный экран.

const Records = {
  get(id) {
    try { return parseInt(localStorage.getItem('chips_best_' + id), 10) || 0; } catch (e) { return 0; }
  },
  set(id, v) {
    try { localStorage.setItem('chips_best_' + id, String(v)); } catch (e) { /* нет доступа */ }
  },
};

// Копилка: все собранные чипсы и корм копятся между забегами, на них покупается рывок +500
const Bank = {
  START_PRICE: 100,
  get() {
    try {
      const v = JSON.parse(localStorage.getItem('chips_bank'));
      if (v) return { coins: v.coins | 0, starts: v.starts | 0 };
    } catch (e) { /* нет данных */ }
    return { coins: 0, starts: 0 };
  },
  save(b) {
    try { localStorage.setItem('chips_bank', JSON.stringify(b)); } catch (e) { /* нет доступа */ }
  },
  add(n) { const b = this.get(); b.coins += n; this.save(b); return b; },
  buyStart() {
    const b = this.get();
    if (b.coins < this.START_PRICE) return false;
    b.coins -= this.START_PRICE; b.starts++;
    this.save(b);
    return true;
  },
  useStart() {
    const b = this.get();
    if (b.starts < 1) return false;
    b.starts--;
    this.save(b);
    return true;
  },
};

const Game = (() => {
  const GRAV = 900;
  const BOOST_TIME = 6.5;
  const BEER_TIME = 7, VODKA_WARN = 3, VODKA_TIME = 5, HEAD_START = 500;
  const RUN = 105;
  const TILE = 16, ROWS = 11;
  const H = 180, GROUND_Y = H - 32;

  const CHARS = {
    sasha: { name: 'Саша', item: 'chip', boost: 'motoIcon', jump: 330, theme: 'work', world: 'volga', w: 10, h: 18, boostText: 'МОТОЦИКЛ!' },
    sonya: { name: 'Соня', item: 'chip', boost: 'energy', jump: 330, theme: 'work', world: 'city', w: 10, h: 18, boostText: 'АДРЕНАЛИН!' },
    chips: { name: 'Чипс', item: 'kibble', boost: 'feather', jump: 395, theme: 'cat', world: 'flat', w: 14, h: 10, boostText: 'ПЁРЫШКО!' },
  };
  const ITEM_SIZE = { chip: { w: 11, h: 9 }, kibble: { w: 8, h: 7 } };

  // kind: walker — идёт, hopper — прыгает, flyer — летит волной, static — стоит,
  //       sprayer — бьёт струёй воды вверх, blower — фен, сдувает назад
  const ENEMIES = {
    work: { kind: 'walker', speed: 22, w: 14, h: 12, label: 'РАБОТА' },
    deadline: { kind: 'walker', speed: 40, w: 12, h: 14, label: 'ДЕДЛАЙН' },
    email: { kind: 'flyer', speed: 38, w: 14, h: 9, label: 'СРОЧНО!', amp: 10 },
    alarm: { kind: 'hopper', speed: 30, w: 12, h: 11 },
    bill: { kind: 'flyer', speed: 22, w: 10, h: 11, label: 'ЖКХ', amp: 16 },
    dishes: { kind: 'static', w: 14, h: 13 },
    vacuum: { kind: 'walker', speed: 48, w: 16, h: 10 },
    dog: { kind: 'walker', speed: 52, w: 18, h: 11, bark: true },
    clipper: { kind: 'flyer', speed: 34, w: 16, h: 9, amp: 12, label: 'КОГТИ' },
    pill: { kind: 'flyer', speed: 40, w: 14, h: 7, amp: 8, label: 'ТАБЛЕТКА' },
    blower: { kind: 'blower', w: 16, h: 10 },
    fountain: { kind: 'sprayer', w: 14, h: 6 },
  };
  const THEMES = {
    work: { pool: ['work', 'work', 'deadline', 'email', 'alarm', 'bill', 'dishes'], wall: ['deadline', 'work', 'email', 'bill', 'alarm'], color: '#4a3358', color2: '#6b4a7d' },
    cat: { pool: ['vacuum', 'vacuum', 'dog', 'dog', 'clipper', 'pill', 'blower', 'fountain'], color: '#3b8fe0', color2: '#7fc8ff' },
  };

  let canvas, ctx, stage;
  let W = 360, S = 2;
  let safe = { top: 0, left: 0, right: 0 }, safeL = { top: 0, left: 0, right: 0 };
  let running = false, paused = false, raf = 0, last = 0;
  let mode, ch, charId, theme, world, level;
  let t, camX, speed, mult, genX, firstChunk, nextBoostX, avW, hasAvalanche;
  let player, solids, near, enemies, items, parts, texts, flags;
  let lives, collected, kills, boostT, shakeT, banner, dying, deathT, best;
  let won, winT, lvlTime, spawn;
  let nextDrinkX, beerT, airJumps, vodkaWarn, swapT, startOffset;
  const input = { left: false, right: false, jump: false, jumpBuf: 0 };
  let onOver = null, onLevelEnd = null, onSwap = null;

  const rnd = (a, b) => a + Math.random() * (b - a);
  const randi = (a, b) => Math.floor(rnd(a, b + 1));
  const pick = arr => arr[Math.floor(Math.random() * arr.length)];
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const hit = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  const haptic = type => window.haptic && window.haptic(type);
  const rowTop = r => H - (ROWS - r) * TILE;
  // скорость бесконечного забега растёт со временем; distAt — сколько пикселей пройдено к моменту t
  const SPEED0 = 72, SPEED_ADD = 78, RAMP = 40;
  const baseSpeed = t => SPEED0 + SPEED_ADD * (1 - Math.exp(-t / RAMP));
  const distAt = t => (SPEED0 + SPEED_ADD) * t - SPEED_ADD * RAMP * (1 - Math.exp(-t / RAMP));
  // время, к которому игрок без бустов пробежал бы dist пикселей
  function timeForDist(dist) {
    let lo = 0, hi = 600;
    for (let i = 0; i < 40; i++) { const mid = (lo + hi) / 2; if (distAt(mid) < dist) lo = mid; else hi = mid; }
    return lo;
  }

  function init(cv, st) {
    canvas = cv; stage = st;
    ctx = canvas.getContext('2d');
  }

  // Высота мира фиксирована (180), ширина подстраивается под пропорции экрана.
  function layout(recompute) {
    const r = stage.getBoundingClientRect();
    if (!r.width || !r.height) return;
    if (recompute) W = clamp(Math.round(H * r.width / r.height), 240, 420);
    const sc = Math.min(r.width / W, r.height / H);
    canvas.style.width = Math.floor(W * sc) + 'px';
    canvas.style.height = Math.floor(H * sc) + 'px';
    S = clamp(Math.round(sc * (window.devicePixelRatio || 1)), 1, 5);
    canvas.width = W * S;
    canvas.height = H * S;
    safeL = { top: safe.top / sc, left: safe.left / sc, right: safe.right / sc };
  }

  function setSafe(s) { safe = s; if (running) layout(false); }

  function reset(id) {
    charId = id; ch = CHARS[id]; theme = THEMES[ch.theme]; world = ch.world;
    layout(true);
    t = 0; camX = 0; speed = 60; mult = 1; avW = 22;
    solids = []; near = []; enemies = []; items = []; parts = []; texts = []; flags = [];
    lives = 3; collected = 0; kills = 0; boostT = 0; shakeT = 0; dying = false; deathT = 0;
    won = false; winT = 0; lvlTime = 0; level = null;
    beerT = 0; airJumps = 0; vodkaWarn = 0; swapT = 0; startOffset = 0; nextDrinkX = 700;
    setSwap(false);
    player = { x: 0, y: 0, w: ch.w, h: ch.h, vx: 0, vy: 0, onGround: true, coyote: 0, inv: 0, jumping: false, anim: 0, prevBottom: 0, face: 1, ride: null };
    input.left = input.right = input.jump = false; input.jumpBuf = 0;
  }

  function run() {
    running = true; paused = false;
    last = performance.now();
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(frame);
    Sound.play('start');
    Sound.startMusic();
  }

  // headStart — купленный в копилке рывок: забег начинается сразу с 500 очков
  function startEndless(id, headStart) {
    reset(id);
    mode = 'endless';
    hasAvalanche = true;
    startOffset = headStart ? HEAD_START * 16 : 0;
    camX = startOffset;
    // с рывком скорость, лавина и трасса сразу такие, как на 500 очках
    if (headStart) t = timeForDist(startOffset);
    genX = startOffset - 32; firstChunk = true; nextBoostX = startOffset + 900; nextDrinkX = startOffset + 700;
    banner = headStart
      ? { text: 'РЫВОК +500!', sub: 'Стартуешь сразу с 500 очков', t: 2.4 }
      : { text: 'ВПЕРЁД!', sub: id === 'chips' ? 'Собирай корм и беги от потопа!' : 'Собирай чипсы и беги от дедлайнов!', t: 2.4 };
    best = Records.get(id);
    player.x = startOffset + Math.round(W * 0.35); player.y = GROUND_Y - ch.h;
    while (genX < camX + W + 80) genChunk();
    run();
  }

  function startLevel(id, idx) {
    reset(id);
    mode = 'level';
    const def = LEVELS[id][idx];
    loadLevel(def, idx);
    hasAvalanche = level.escape;
    avW = level.escape ? 22 : -40;
    banner = { text: def.name.toUpperCase(), sub: level.escape ? 'Беги! Сзади настигает!' : 'Доберись до финиша', t: 2.2 };
    player.x = spawn.x; player.y = spawn.y;
    camX = level.escape ? 0 : clamp(player.x - W * 0.4, 0, level.w - W);
    run();
  }

  function setSwap(on) { if (onSwap) onSwap(on); }

  function stop() {
    running = false;
    setSwap(false);
    cancelAnimationFrame(raf);
    Sound.stopMusic();
  }

  function pause() {
    if (!running || paused || dying || won) return false;
    paused = true;
    Sound.stopMusic();
    return true;
  }

  function resume() {
    if (!running || !paused) return;
    paused = false;
    last = performance.now();
    input.left = input.right = input.jump = false;
    Sound.startMusic();
  }

  function frame(ts) {
    if (!running) return;
    const dt = Math.min(0.033, Math.max(0, (ts - last) / 1000));
    last = ts;
    if (!paused) update(dt);
    if (running) render();
    raf = requestAnimationFrame(frame);
  }

  const score = () => Math.floor(camX / 16) + collected * 5 + kills * 10;

  // ---------------- Уровни ----------------
  function loadLevel(def, idx) {
    const map = buildLevelMap(def);
    const cols = map[0].length;
    level = { def, idx, map, cols, w: cols * TILE, total: 0, finishX: cols * TILE - 64, finishY: GROUND_Y, escape: !!def.escape };
    level.par = Math.round(cols / 5) + 6;
    spawn = { x: 40, y: GROUND_Y - ch.h };
    const at = (r, c) => (map[r] && map[r][c]) || '.';
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < cols; c++) {
        const cell = at(r, c), x = c * TILE, y = rowTop(r);
        // одинаковые соседние клетки земли, полок и платформ склеиваются в один объект
        if ('G=~^'.includes(cell)) {
          if (at(r, c - 1) === cell) continue;
          let n = 1;
          while (at(r, c + n) === cell) n++;
          if (cell === 'G') solids.push({ x, y, w: n * TILE, h: TILE, type: 'ground' });
          else if (cell === '=') solids.push({ x, y, w: n * TILE, h: 6, type: 'plank', oneway: true });
          else solids.push({ x, y, w: n * TILE, h: 6, type: 'mover', oneway: true, x0: x, y0: y, axis: cell === '~' ? 'x' : 'y', range: cell === '~' ? 40 : 32, phase: c * 0.7, dx: 0, dy: 0 });
          continue;
        }
        switch (cell) {
          case 'B': solids.push({ x, y, w: TILE, h: TILE, type: 'brick', bumpT: 0 }); break;
          case '?': solids.push({ x, y, w: TILE, h: TILE, type: 'q', bumpT: 0 }); level.total++; break;
          case '!': solids.push({ x, y, w: TILE, h: TILE, type: 'q', boost: true, bumpT: 0 }); break;
          case '#': solids.push({ x, y, w: TILE, h: TILE, type: 'box', bumpT: 0 }); break;
          case 'T': solids.push({ x, y: y + 6, w: TILE, h: 10, type: 'spring', bumpT: 0 }); break;
          case 'c': addItem(x + 8, y + 2); level.total++; break;
          case 'b': items.push({ type: 'boost', x: x + 1, y: y + 2, w: 14, h: 12, bob: 0 }); break;
          case 'V': if (ch.theme === 'work') items.push({ type: 'vodka', x: x + 4, y: y + 1, w: 8, h: 14, bob: 0 }); break;
          case 'L': if (ch.theme === 'work') items.push({ type: 'beer', x: x + 4, y: y + 1, w: 8, h: 14, bob: 0 }); break;
          case 'C': flags.push({ x: x + 7, y: y + TILE, on: false }); break;
          case 'F': level.finishX = x; level.finishY = y + TILE; break;
          case 'P': spawn = { x: x + 3, y: y + TILE - ch.h }; break;
          default:
            if (cell >= '1' && cell <= '6') spawnEnemy(x + 8, LEVEL_ENEMIES[ch.theme][+cell - 1], y + TILE);
        }
      }
    }
  }

  function finishLevel(win) {
    stop();
    const stars = !win ? 0 : 1 + (collected >= Math.ceil(level.total * 0.8) ? 1 : 0) + (level.escape ? (lives === 3 ? 1 : 0) : (lvlTime <= level.par ? 1 : 0));
    if (win) Progress.save(charId, level.idx, stars);
    Bank.add(collected);
    if (onLevelEnd) onLevelEnd({ won: win, stars, time: lvlTime, par: level.par, collected, total: level.total, lives, escape: level.escape, hero: charId, idx: level.idx, name: level.def.name });
  }

  // ---------------- Бесконечный режим: генерация ----------------
  function addGround(x, w) {
    const prev = solids.find(s => s.type === 'ground' && s.x + s.w === x);
    if (prev) prev.w += w;
    else solids.push({ x, y: GROUND_Y, w, h: 80, type: 'ground' });
  }

  function addItem(cx, y) {
    const sz = ITEM_SIZE[ch.item];
    items.push({ type: 'item', x: cx - sz.w / 2, y, w: sz.w, h: sz.h, bob: Math.random() * 6 });
  }

  function itemLine(x, y, n) { for (let i = 0; i < n; i++) addItem(x + i * 14, y); }

  function itemArc(cx, topY, n, span) {
    for (let i = 0; i < n; i++) {
      const u = n === 1 ? 0.5 : i / (n - 1);
      addItem(cx - span / 2 + u * span, topY + 4 * (u - 0.5) * (u - 0.5) * 26);
    }
  }

  // bottom — где стоит враг (низ клетки); для летающих — высота полёта
  function spawnEnemy(cx, kind, bottom) {
    kind = kind || pick(theme.pool);
    const d = ENEMIES[kind];
    const e = { kind, d, x: cx - d.w / 2, y: 0, w: d.w, h: d.h, vx: 0, vy: 0, t: 0, phase: Math.random() * 6, dir: -1, dead: false, hopT: rnd(0.4, 1.2), onGround: false, barkT: 0, active: mode === 'endless' };
    if (d.kind === 'flyer') {
      e.baseY = bottom !== undefined ? bottom - d.h - 4 : GROUND_Y - rnd(24, 50) - d.h;
      e.y = e.baseY;
    } else {
      e.y = bottom !== undefined ? bottom - d.h : GROUND_Y - d.h - 30;
    }
    enemies.push(e);
  }

  function genChunk() {
    const d = Math.min(1, camX / 9000);
    if (firstChunk) {
      firstChunk = false;
      const L = Math.ceil((W + 112) / 16) * 16;
      addGround(genX, L);
      itemLine(startOffset + Math.round(W * 0.6), GROUND_Y - 16, 4);
      genX += L;
      return;
    }
    const L = 16 * randi(7, 14);
    const x0 = genX;
    addGround(x0, L);

    const r = Math.random();
    if (r < 0.3) {
      // кирпичная платформа с ?-блоками
      const n = randi(3, Math.min(6, L / 16 - 3));
      const px = x0 + 16 * randi(1, L / 16 - n - 1);
      const y = GROUND_Y - 48;
      const q = new Set([randi(0, n - 1)]);
      if (Math.random() < 0.4) q.add(randi(0, n - 1));
      for (let i = 0; i < n; i++) solids.push({ x: px + i * 16, y, w: 16, h: 16, type: q.has(i) ? 'q' : 'brick', bumpT: 0 });
      if (Math.random() < 0.6) itemLine(px + 8, y - 14, n);
      if (Math.random() < 0.35) itemArc(px + n * 8, y - 52, 3, 30);
    } else if (r < 0.52) {
      // коробки, через которые надо перепрыгнуть
      const hgt = Math.random() < 0.5 ? 1 : 2;
      const bx = x0 + 16 * randi(2, L / 16 - 3);
      for (let j = 0; j < hgt; j++) solids.push({ x: bx, y: GROUND_Y - 16 * (j + 1), w: 16, h: 16, type: 'box', bumpT: 0 });
      if (hgt === 2 && Math.random() < 0.5) solids.push({ x: bx - 16, y: GROUND_Y - 16, w: 16, h: 16, type: 'box', bumpT: 0 });
      itemArc(bx + 8, GROUND_Y - 16 * hgt - 34, 3, 36);
    } else if (r < 0.72) {
      itemLine(x0 + 24, GROUND_Y - 16, randi(3, 5));
    }

    let n = Math.random() < 0.45 + 0.4 * d ? 1 : 0;
    if (Math.random() < d * 0.55) n++;
    for (let i = 0; i < n; i++) spawnEnemy(x0 + 40 + Math.random() * (L - 64));

    if (nextBoostX < x0 + L) {
      const bx = Math.max(nextBoostX, x0 + 24);
      items.push({ type: 'boost', x: bx, y: GROUND_Y - 40, w: 14, h: 12, bob: 0 });
      nextBoostX = bx + 1300 + Math.random() * 1100;
    }

    // водка и пиво — только у Саши и Сони
    if (ch.theme === 'work' && nextDrinkX < x0 + L) {
      const dx = Math.max(nextDrinkX, x0 + 24);
      items.push({ type: Math.random() < 0.55 ? 'beer' : 'vodka', x: dx, y: GROUND_Y - 34, w: 8, h: 14, bob: Math.random() * 6 });
      nextDrinkX = dx + 900 + Math.random() * 900;
    }

    genX = x0 + L;
    if (Math.random() < 0.3 + 0.2 * d) {
      const g = 8 * randi(3, 5 + Math.floor(d * 3));
      if (Math.random() < 0.6) itemArc(genX + g / 2, GROUND_Y - 52, 3, g + 8);
      genX += g;
    }
  }

  // ---------------- Физика ----------------
  function collideX(o, px) {
    for (const s of near) {
      if (s.oneway || s.dead || !hit(o, s)) continue;
      if (px + o.w <= s.x + 0.01) { o.x = s.x - o.w; o.hitWall = 1; }
      else if (px >= s.x + s.w - 0.01) { o.x = s.x + s.w; o.hitWall = -1; }
    }
  }

  function collideY(o, py, isPlayer) {
    let bumped = false;
    for (const s of near) {
      if (s.dead || !hit(o, s)) continue;
      const tol = s.type === 'mover' ? 3 : 0.01;
      if (py + o.h <= s.y + tol && o.vy >= 0) {
        o.y = s.y - o.h; o.vy = 0; o.onGround = true;
        if (s.type === 'mover') o.ride = s;
        if (s.type === 'spring' && isPlayer) {
          o.vy = -500; o.onGround = false; o.jumping = false;
          s.bumpT = 0.25;
          Sound.play('spring');
        }
      } else if (!s.oneway && py >= s.y + s.h - 0.01) {
        o.y = s.y + s.h;
        if (o.vy < 0) {
          o.vy = 0;
          if (isPlayer && !bumped) { bumped = true; bump(s); }
        }
      }
    }
  }

  function bump(s) {
    s.bumpT = 0.18;
    // враг, стоящий на блоке, слетает
    for (const e of enemies) {
      if (!e.dead && Math.abs(e.y + e.h - s.y) < 2 && e.x + e.w > s.x && e.x < s.x + s.w) killEnemy(e, true);
    }
    if (s.type === 'q' && !s.used) {
      s.used = true;
      if (s.boost || (mode === 'endless' && Math.random() < 0.15 && boostT <= 0)) {
        items.push({ type: 'boost', x: s.x + 1, y: s.y - 16, w: 14, h: 12, bob: 0 });
        Sound.play('bump');
      } else {
        const sz = ITEM_SIZE[ch.item];
        items.push({ type: 'pop', x: s.x + 8 - sz.w / 2, y: s.y - sz.h, w: sz.w, h: sz.h, vy: -170, life: 0.45 });
        collect(s.x + 8, s.y - 8);
      }
    } else if (s.type === 'brick') {
      s.dead = true;
      Sound.play('break');
      for (let i = 0; i < 8; i++) parts.push({ x: s.x + rnd(2, 14), y: s.y + rnd(2, 14), vx: rnd(-80, 80), vy: rnd(-200, -60), life: 0.7, color: i % 2 ? '#7a2e14' : '#d2663f', size: 3, grav: 1 });
    } else {
      Sound.play('bump');
    }
  }

  function collect(x, y) {
    collected++;
    texts.push({ x, y, text: '+5', life: 0.8, color: '#ffd23f' });
    Sound.play(ch.item === 'kibble' ? 'kibble' : 'crunch');
    for (let i = 0; i < 6; i++) parts.push({ x, y: y + 4, vx: rnd(-50, 50), vy: rnd(-80, -20), life: 0.4, color: i % 2 ? '#ffd23f' : '#ffffff', size: 1 });
  }

  function killEnemy(e, fling) {
    e.dead = true;
    kills++;
    if (fling) { e.fling = true; e.vy = -220; e.vx = 90; e.deadT = 1.2; }
    else { e.squash = true; e.deadT = 0.35; }
    texts.push({ x: e.x + e.w / 2, y: e.y - 4, text: '+10', life: 0.8, color: '#ffffff' });
    Sound.play('stomp');
    haptic('light');
    for (let i = 0; i < 8; i++) parts.push({ x: e.x + e.w / 2, y: e.y + e.h / 2, vx: rnd(-70, 70), vy: rnd(-90, 10), life: 0.45, color: i % 2 ? '#ffffff' : '#c9ced6', size: 2 });
  }

  function hurt() {
    lives--;
    player.inv = 2;
    shakeT = 0.3;
    Sound.play(charId === 'chips' ? 'meow' : 'hurt');
    haptic('heavy');
    if (lives <= 0) {
      dying = true;
      deathT = 1.6;
      player.vy = -320;
      Sound.stopMusic();
      Sound.play('over');
    }
  }

  // ищет землю под точкой x (верхнюю, если несколько этажей)
  function groundAt(x) {
    let best = null;
    for (const s of solids) {
      if (s.type === 'ground' && x >= s.x && x + player.w <= s.x + s.w && (!best || s.y < best.y)) best = s;
    }
    return best;
  }

  function respawn() {
    const p = player;
    if (mode === 'level' && !level.escape) {
      p.x = spawn.x; p.y = spawn.y;
    } else {
      let x = camX + W * 0.42;
      let g = groundAt(x);
      for (let i = 0; i < 40 && !g; i++) { x += 8; g = groundAt(x); }
      p.x = x;
      p.y = (g ? g.y : GROUND_Y) - p.h - 60;
    }
    p.vx = 0; p.vy = 0; p.ride = null;
    p.inv = Math.max(p.inv, 1.5);
  }

  function startBoost() {
    boostT = BOOST_TIME;
    banner = { text: ch.boostText, t: 1.3 };
    Sound.play('boost');
    haptic('medium');
  }

  function finishEndless() {
    stop();
    const sc = score();
    const isNew = sc > best;
    if (isNew) Records.set(charId, sc);
    Bank.add(collected);
    if (onOver) onOver({ score: sc, best: Math.max(sc, best), isNew, collected, kills, dist: Math.floor(camX / 16), charId });
  }

  // ---------------- Обновление ----------------
  function update(dt) {
    t += dt;
    if (banner) { banner.t -= dt; if (banner.t <= 0) banner = null; }
    shakeT = Math.max(0, shakeT - dt);
    if (!dying && !won) {
      boostT = Math.max(0, boostT - dt);
      beerT = Math.max(0, beerT - dt);
      if (vodkaWarn > 0) {
        const before = Math.ceil(vodkaWarn);
        vodkaWarn -= dt;
        if (vodkaWarn <= 0) { swapT = VODKA_TIME; setSwap(true); Sound.play('swap'); haptic('heavy'); }
        else if (Math.ceil(vodkaWarn) !== before) Sound.play('tick');
      } else if (swapT > 0) {
        swapT -= dt;
        if (swapT <= 0) { swapT = 0; setSwap(false); Sound.play('checkpoint'); }
      }
    }
    if (mode === 'level' && !dying && !won) lvlTime += dt;

    // камера
    if (mode === 'endless') {
      if (!dying) {
        const base = baseSpeed(t);
        mult += ((boostT > 0 ? 1.75 : 1) - mult) * Math.min(1, dt * 3);
        speed = base * mult;
        camX += speed * dt;
      }
      while (genX < camX + W + 80) genChunk();
    } else if (level.escape) {
      if (!dying && !won) {
        mult += ((boostT > 0 ? 1.6 : 1) - mult) * Math.min(1, dt * 3);
        speed = 70 * mult;
        camX = Math.min(camX + speed * dt, level.w - W);
      }
    } else {
      const target = clamp(player.x + player.w / 2 - W * 0.4, 0, level.w - W);
      camX += (target - camX) * Math.min(1, dt * 8);
    }
    if (hasAvalanche) avW += ((boostT > 0 ? 4 : 22) - avW) * Math.min(1, dt * 2);

    // движущиеся платформы
    for (const s of solids) {
      if (s.bumpT > 0) s.bumpT = Math.max(0, s.bumpT - dt);
      if (s.type !== 'mover') continue;
      const ox = s.x, oy = s.y, k = Math.sin(t * 1.4 + s.phase) * s.range;
      if (s.axis === 'x') s.x = s.x0 + k; else s.y = s.y0 + k;
      s.dx = s.x - ox; s.dy = s.y - oy;
    }
    near = solids.filter(s => !s.dead && s.x + s.w > camX - 96 && s.x < camX + W + 96);

    updatePlayer(dt);
    updateEnemies(dt);
    updateItems(dt);
    updateParts(dt);

    if (mode === 'level') {
      for (const f of flags) {
        if (!f.on && player.x >= f.x - 4 && !dying) {
          f.on = true;
          spawn = { x: f.x, y: f.y - ch.h };
          texts.push({ x: f.x, y: f.y - 36, text: 'ЧЕКПОИНТ', life: 1.2, color: '#ffffff' });
          Sound.play('checkpoint');
        }
      }
      if (!won && !dying && player.x + player.w >= level.finishX + 10) {
        won = true;
        winT = 2;
        banner = { text: 'ФИНИШ!', t: 2 };
        player.inv = 5;
        Sound.stopMusic();
        Sound.play('win');
        haptic('heavy');
      }
      if (won) {
        winT -= dt;
        if (Math.random() < dt * 20) parts.push({ x: level.finishX + rnd(-20, 40), y: rnd(20, 80), vx: rnd(-30, 30), vy: rnd(-40, 40), life: 1, color: pick(['#ffd23f', '#e33b2e', '#5cc93a', '#3d7be0', '#ffffff']), size: 2 });
        if (winT <= 0) { finishLevel(true); return; }
      }
    }

    // брызги и бумажки из лавины
    if (hasAvalanche && !dying && Math.random() < dt * 6) {
      const color = ch.theme === 'cat' ? (Math.random() < 0.5 ? '#ffffff' : '#7fc8ff') : (Math.random() < 0.7 ? '#ffffff' : '#e33b2e');
      parts.push({ x: camX + avW, y: rnd(10, GROUND_Y), vx: rnd(20, 60), vy: rnd(-30, 20), life: rnd(0.4, 0.9), color, size: 2 });
    }

    if (mode === 'endless') {
      const cut = camX - 64;
      solids = solids.filter(s => !s.dead && s.x + s.w > cut);
      items = items.filter(i => !i.dead && i.x + i.w > cut);
    } else {
      items = items.filter(i => !i.dead);
    }
  }

  // ветер от фенов: возвращает горизонтальный толчок для игрока
  const windRect = e => ({ x: e.x - 96, y: e.y + e.h - 30, w: 96, h: 30 });
  function windPush(p) {
    let push = 0;
    for (const e of enemies) if (e.blowing && !e.dead && hit(p, windRect(e))) push -= 150;
    return push;
  }

  function updatePlayer(dt) {
    const p = player;
    p.anim += dt;
    if (dying) {
      p.vy += GRAV * dt;
      p.y += p.vy * dt;
      deathT -= dt;
      if (deathT <= 0) { if (mode === 'endless') finishEndless(); else finishLevel(false); }
      return;
    }
    p.inv = Math.max(0, p.inv - dt);
    let dir = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    if (won) dir = winT > 1.2 ? 1 : 0;

    if (mode === 'endless') {
      p.vx = speed + dir * 95;
      p.face = 1;
    } else {
      const target = dir * RUN * (boostT > 0 ? 1.5 : 1);
      const acc = p.onGround ? 900 : 600;
      p.vx = p.vx < target ? Math.min(target, p.vx + acc * dt) : Math.max(target, p.vx - acc * dt);
      if (dir) p.face = dir;
    }

    // едем вместе с платформой
    if (p.ride) { p.x += p.ride.dx; p.y += p.ride.dy; }
    p.ride = null;

    if (input.jumpBuf > 0) input.jumpBuf -= dt;
    if (!won && input.jumpBuf > 0 && (p.onGround || p.coyote > 0)) {
      p.vy = -ch.jump;
      p.onGround = false; p.coyote = 0; p.jumping = true; input.jumpBuf = 0;
      airJumps = beerT > 0 ? 1 : 0;
      Sound.play('jump');
    } else if (!won && input.jumpBuf > 0 && beerT > 0 && airJumps > 0 && !p.onGround) {
      // пиво: второй прыжок в воздухе
      p.vy = -ch.jump * 0.9;
      p.jumping = true; input.jumpBuf = 0; airJumps--;
      Sound.play('jump2');
      for (let i = 0; i < 6; i++) parts.push({ x: p.x + p.w / 2, y: p.y + p.h, vx: rnd(-50, 50), vy: rnd(10, 60), life: 0.35, color: i % 2 ? '#ffd23f' : '#ffffff', size: 2 });
    }
    if (p.jumping && !input.jump && p.vy < -150) p.vy = -150;
    p.vy = Math.min(p.vy + GRAV * dt, 520);

    const px = p.x, py = p.y;
    p.prevBottom = py + p.h;
    p.x += (p.vx + (boostT > 0 ? 0 : windPush(p))) * dt;
    collideX(p, px);
    p.y += p.vy * dt;
    p.onGround = false;
    collideY(p, py, true);
    if (p.onGround) { p.coyote = 0.09; p.jumping = false; } else p.coyote -= dt;

    // границы
    if (mode === 'endless') {
      p.x = Math.min(p.x, camX + W - 60 - p.w);
    } else {
      p.x = clamp(p.x, level.escape ? -999 : 0, level.w - p.w);
      if (level.escape) p.x = Math.min(p.x, camX + W - 60 - p.w);
    }

    const caught = hasAvalanche && p.x < camX + avW - 2;
    if (caught || p.y > H + 24) {
      if (p.inv <= 0) hurt();
      if (!dying) respawn();
    }

    if (boostT > 0 && Math.random() < dt * 40) {
      const c = charId === 'sasha' ? '#c9ced6' : charId === 'sonya' ? (Math.random() < 0.5 ? '#ffd23f' : '#ff5a1f') : '#ff8fd1';
      parts.push({ x: p.face > 0 ? p.x - 2 : p.x + p.w + 2, y: p.y + rnd(0, p.h), vx: -p.face * rnd(20, 60), vy: rnd(-15, 15), life: 0.35, color: c, size: 2 });
    }
  }

  const jetRect = e => ({ x: e.x + e.w / 2 - 3, y: e.y - 46, w: 6, h: 46 });

  function updateEnemies(dt) {
    const p = player;
    for (const e of enemies) {
      if (!e.active) {
        if (e.x < camX + W + 24) e.active = true;
        else continue;
      }
      e.t += dt;
      if (e.dead) {
        e.deadT -= dt;
        if (e.fling) { e.vy += GRAV * dt; e.y += e.vy * dt; e.x += e.vx * dt; }
        continue;
      }
      const d = e.d;
      if (d.kind === 'flyer') {
        e.x -= d.speed * dt;
        e.y = e.baseY + Math.sin(e.t * 2.6 + e.phase) * d.amp;
      } else {
        e.vy = Math.min(e.vy + GRAV * dt, 520);
        if (d.kind === 'walker') e.vx = d.speed * e.dir;
        else if (d.kind === 'hopper') {
          if (e.onGround) {
            e.vx = 0;
            e.hopT -= dt;
            if (e.hopT <= 0) { e.vy = -250; e.vx = -d.speed * 1.4; e.hopT = rnd(0.7, 1.3); }
          }
        } else e.vx = 0;
        const px = e.x, py = e.y;
        e.hitWall = 0;
        e.x += e.vx * dt;
        collideX(e, px);
        if (e.hitWall && d.kind === 'walker') e.dir = -e.dir;
        e.y += e.vy * dt;
        e.onGround = false;
        collideY(e, py, false);
        e.ride = null;
        const ph = (e.t + e.phase) % 2.8;
        if (d.kind === 'sprayer') {
          e.jet = e.onGround && ph < 1.0;
          e.warn = e.onGround && ph > 2.3;
        } else if (d.kind === 'blower') {
          e.blowing = e.onGround && ph < 1.8;
          e.warn = e.onGround && ph > 2.4;
          if (e.blowing && Math.random() < dt * 25) parts.push({ x: e.x - 2, y: e.y + e.h - rnd(2, 28), vx: rnd(-160, -110), vy: rnd(-8, 8), life: 0.6, color: '#ffffff', size: 1, line: 6 });
        }
        if (d.bark) {
          e.barkT -= dt;
          if (e.barkT <= 0 && Math.abs(p.x - e.x) < 90) {
            e.barkT = 1.6;
            Sound.play('bark');
            texts.push({ x: e.x + e.w / 2, y: e.y - 6, text: 'ГАВ!', life: 0.7, color: '#ffffff' });
          }
        }
      }
      if (e.y > H + 40 || e.x + e.w < camX - 96) { e.gone = true; continue; }
      if (dying || won) continue;

      if (hit(p, e)) {
        if (boostT > 0) killEnemy(e, true);
        else if (p.vy > 0 && p.prevBottom <= e.y + 6) {
          killEnemy(e, false);
          p.vy = -240;
          p.jumping = true;
        } else if (p.inv <= 0) hurt();
      }
      if (e.jet && !e.dead && boostT <= 0 && p.inv <= 0 && hit(p, jetRect(e))) hurt();
    }
    enemies = enemies.filter(e => !e.gone && !(e.dead && e.deadT <= 0));
  }

  function updateItems(dt) {
    for (const it of items) {
      if (it.type === 'pop') {
        it.vy += GRAV * 0.7 * dt;
        it.y += it.vy * dt;
        it.life -= dt;
        if (it.life <= 0) it.dead = true;
        continue;
      }
      if (dying || !hit(player, it)) continue;
      it.dead = true;
      if (it.type === 'boost') startBoost();
      else if (it.type === 'beer') {
        beerT = BEER_TIME;
        banner = { text: 'ПИВО!', sub: 'Двойной прыжок на 7 секунд', t: 1.8 };
        Sound.play('boost');
      } else if (it.type === 'vodka') {
        if (vodkaWarn <= 0 && swapT <= 0) { vodkaWarn = VODKA_WARN; Sound.play('tick'); }
        banner = { text: 'ОЙ, ВОДКА!', t: 1.4 };
      } else collect(it.x + it.w / 2, it.y);
    }
  }

  function updateParts(dt) {
    for (const q of parts) { q.x += q.vx * dt; q.y += q.vy * dt; q.vy += (q.grav ? GRAV : q.line ? 0 : 120) * dt; q.life -= dt; }
    parts = parts.filter(q => q.life > 0);
    for (const tx of texts) { tx.y -= 22 * dt; tx.life -= dt; }
    texts = texts.filter(tx => tx.life > 0);
  }

  // ---------------- Отрисовка ----------------
  function spr(img, cx, bottom, flip, sy) {
    const w = img.width, h = img.height;
    const x = Math.round(cx - w / 2);
    if (!flip && !sy) { ctx.drawImage(img, x, Math.round(bottom - h)); return; }
    sy = sy || 1;
    ctx.save();
    ctx.translate(x + (flip ? w : 0), Math.round(bottom - h * sy));
    ctx.scale(flip ? -1 : 1, sy);
    ctx.drawImage(img, 0, 0);
    ctx.restore();
  }

  function text(str, x, y, size, color, align) {
    ctx.font = size + 'px "Press Start 2P", monospace';
    ctx.textAlign = align || 'left';
    ctx.textBaseline = 'top';
    ctx.fillStyle = '#1b1626';
    ctx.fillText(str, x + 1, y + 1);
    ctx.fillStyle = color;
    ctx.fillText(str, x, y);
  }

  function label(str, cx, bottom) {
    ctx.font = '5px "Press Start 2P", monospace';
    const w = Math.ceil(ctx.measureText(str).width);
    const x = Math.round(cx - w / 2 - 2), y = Math.round(bottom - 9);
    ctx.fillStyle = '#1b1626';
    ctx.fillRect(x - 1, y - 1, w + 6, 10);
    ctx.fillStyle = '#e33b2e';
    ctx.fillRect(x, y, w + 4, 8);
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(str, x + 2, y + 2);
  }

  function drawGround() {
    const tiles = SPR.world[world];
    const edge = (x, y, h) => { ctx.fillStyle = '#1b1626'; ctx.fillRect(x, y, 1, h); };
    if (mode === 'endless') {
      for (const s of near) {
        if (s.type !== 'ground') continue;
        const sx = Math.round(s.x);
        for (let x = 0; x < s.w; x += 16) {
          const w = Math.min(16, s.w - x);
          ctx.drawImage(tiles.top, 0, 0, w, 16, sx + x, GROUND_Y, w, 16);
          ctx.drawImage(tiles.fill, 0, 0, w, 16, sx + x, GROUND_Y + 16, w, 16);
        }
        edge(sx - 1, GROUND_Y, H - GROUND_Y);
        edge(sx + s.w, GROUND_Y, H - GROUND_Y);
      }
      return;
    }
    const map = level.map;
    const c0 = Math.max(0, Math.floor(camX / TILE) - 1), c1 = Math.min(level.cols - 1, Math.ceil((camX + W) / TILE) + 1);
    for (let r = 0; r < ROWS; r++) {
      for (let c = c0; c <= c1; c++) {
        if (map[r][c] !== 'G') continue;
        const x = c * TILE, y = rowTop(r);
        ctx.drawImage(r > 0 && map[r - 1][c] === 'G' ? tiles.fill : tiles.top, x, y);
        if (map[r][c - 1] !== 'G') edge(x - 1, y, TILE);
        if (map[r][c + 1] !== 'G') edge(x + TILE, y, TILE);
      }
    }
    if (rowTop(ROWS - 1) + TILE < H) {
      for (let c = c0; c <= c1; c++) if (map[ROWS - 1][c] === 'G') ctx.drawImage(SPR.world[world].fill, c * TILE, rowTop(ROWS - 1) + TILE);
    }
  }

  function drawSolids() {
    const tiles = SPR.world[world];
    for (const s of near) {
      if (s.type === 'ground') continue;
      let y = s.y;
      if (s.bumpT > 0 && s.type !== 'spring') y -= Math.sin((0.18 - s.bumpT) / 0.18 * Math.PI) * 4;
      const x = Math.round(s.x);
      if (s.type === 'plank' || s.type === 'mover') {
        const img = s.type === 'plank' ? SPR.plank : SPR.mover;
        for (let k = 0; k < s.w; k += 16) ctx.drawImage(img, x + k - 1, Math.round(y) - 1);
        continue;
      }
      if (s.type === 'spring') { spr(SPR.spring[s.bumpT > 0 ? 1 : 0], x + 8, s.y + s.h + 1); continue; }
      const img = s.type === 'brick' ? tiles.brick : s.type === 'box' ? SPR.box : s.used ? SPR.qUsed : SPR.q[Math.floor(t * 3) % 2];
      ctx.drawImage(img, x, Math.round(y));
    }
  }

  function drawFlags() {
    for (const f of flags) {
      const x = Math.round(f.x), y = Math.round(f.y);
      ctx.fillStyle = '#1b1626';
      ctx.fillRect(x, y - 30, 2, 30);
      ctx.fillStyle = f.on ? '#ffd23f' : '#9aa3ad';
      const fy = f.on ? y - 30 : y - 12;
      ctx.fillRect(x + 2, fy, 10, 7);
      ctx.fillStyle = f.on ? '#e33b2e' : '#626b78';
      ctx.fillRect(x + 2, fy + 5, 10, 2);
    }
  }

  function drawFinish() {
    const x = Math.round(level.finishX), y = Math.round(level.finishY);
    // флаг финиша
    ctx.fillStyle = '#1b1626';
    ctx.fillRect(x - 2, y - 70, 3, 70);
    for (let i = 0; i < 4; i++) {
      for (let j = 0; j < 3; j++) {
        ctx.fillStyle = (i + j) % 2 ? '#1b1626' : '#ffffff';
        ctx.fillRect(x + 1 + i * 4, y - 70 + j * 4, 4, 4);
      }
    }
    if (ch.theme === 'cat') {
      // миска с кормом
      spr(SPR.bowl, x + 40, y + 1);
      ctx.fillStyle = '#ffffff'; ctx.fillRect(x + 26, y - 34, 30, 12);
      ctx.fillStyle = '#1b1626'; ctx.fillRect(x + 40, y - 22, 2, 14);
      text('ЕДА', x + 41, y - 32, 6, '#e33b2e', 'center');
      return;
    }
    // ларёк с чипсами
    const kx = x + 16;
    ctx.fillStyle = '#1b1626'; ctx.fillRect(kx - 1, y - 47, 50, 47);
    ctx.fillStyle = '#ffd23f'; ctx.fillRect(kx, y - 34, 48, 34);
    ctx.fillStyle = '#9fd0f0'; ctx.fillRect(kx + 6, y - 28, 36, 16);
    ctx.drawImage(SPR.chipsPack, kx + 9, y - 26);
    ctx.drawImage(SPR.chipsPack, kx + 26, y - 26);
    ctx.fillStyle = '#a5231b'; ctx.fillRect(kx, y - 12, 48, 3);
    for (let i = 0; i < 6; i++) { ctx.fillStyle = i % 2 ? '#ffffff' : '#e33b2e'; ctx.fillRect(kx + i * 8, y - 46, 8, 10); }
    text('ЧИПСЫ', kx + 24, y - 58, 6, '#ffd23f', 'center');
  }

  function drawItems() {
    for (const it of items) {
      if (it.x > camX + W + 16 || it.x + it.w < camX - 16) continue;
      if (it.type === 'boost') {
        const b = Math.sin(t * 5) * 2;
        ctx.fillStyle = Math.floor(t * 8) % 2 ? '#ffffff' : '#ffd23f';
        const cx = Math.round(it.x + it.w / 2), cy = Math.round(it.y + it.h / 2 + b);
        ctx.fillRect(cx - 11, cy, 2, 2); ctx.fillRect(cx + 9, cy, 2, 2);
        ctx.fillRect(cx, cy - 11, 2, 2); ctx.fillRect(cx, cy + 9, 2, 2);
        spr(SPR[ch.boost], cx, it.y + it.h + 2 + b);
      } else if (it.type === 'beer' || it.type === 'vodka') {
        const b = Math.sin(t * 4 + it.bob) * 1.5;
        spr(SPR[it.type], it.x + it.w / 2, it.y + it.h + 1 + b);
      } else {
        const b = it.type === 'pop' ? 0 : Math.sin(t * 4 + it.bob) * 1.5;
        spr(SPR[ch.item], it.x + it.w / 2, it.y + it.h + 1 + b);
      }
    }
  }

  function drawEnemies() {
    for (const e of enemies) {
      if (e.x > camX + W + 32 || e.x + e.w < camX - 32) continue;
      const frames = SPR.en[e.kind];
      const img = frames[Math.floor(e.t * 6) % frames.length];
      const cx = e.x + e.w / 2, bottom = e.y + e.h + 1;
      if (e.jet || (e.warn && e.d.kind === 'sprayer')) drawJet(e);
      if (e.warn && e.d.kind === 'blower' && Math.floor(t * 10) % 2) { ctx.fillStyle = '#ffffff'; ctx.fillRect(Math.round(e.x - 4), Math.round(e.y + 3), 2, 2); }
      const shake = e.blowing ? Math.round(Math.sin(t * 60)) : 0;
      if (e.squash) spr(img, cx, bottom, e.dir > 0, 0.35);
      else spr(img, cx + shake, bottom, e.dir > 0);
      if (e.d.label && !e.dead) label(e.d.label, cx, e.y - 2);
    }
  }

  function drawJet(e) {
    const cx = Math.round(e.x + e.w / 2);
    if (!e.jet) {
      ctx.fillStyle = '#7fd3ff';
      if (Math.floor(t * 10) % 2) ctx.fillRect(cx - 1, e.y - 4, 2, 2);
      return;
    }
    for (let k = 0; k < 46; k += 3) {
      ctx.fillStyle = (Math.floor(k / 3 + t * 20) % 2) ? '#7fd3ff' : '#3a9be8';
      ctx.fillRect(cx - 3 + Math.round(Math.sin(k * 0.4 + t * 18)), Math.round(e.y - k - 3), 6, 3);
    }
    ctx.fillStyle = '#ffffff';
    for (let i = 0; i < 4; i++) ctx.fillRect(cx - 6 + i * 4, Math.round(e.y - 48 + Math.sin(t * 12 + i) * 2), 2, 2);
  }

  function drawPlayer() {
    const p = player;
    if (p.inv > 0 && !dying && !won && Math.floor(p.inv * 12) % 2 === 0) return;
    const set = SPR[charId];
    const cx = p.x + p.w / 2, bottom = p.y + p.h + 1;
    const moving = mode === 'endless' || Math.abs(p.vx) > 10;
    let img;
    if (boostT > 0 && charId === 'sasha') img = set.moto[Math.floor(t * 10) % 2];
    else if (!p.onGround || dying) img = set.jump;
    else if (!moving) img = set.run[1];
    else img = set.run[Math.floor(p.anim * (6 + Math.abs(mode === 'endless' ? speed : p.vx) / 18)) % 2];

    if (boostT > 0 && charId === 'sonya') {
      ctx.fillStyle = Math.floor(t * 12) % 2 ? 'rgba(255,210,63,0.55)' : 'rgba(255,90,31,0.45)';
      ctx.fillRect(Math.round(p.x - 3), Math.round(p.y - 4), p.w + 6, p.h + 5);
    }
    spr(img, cx, bottom, p.face < 0, dying ? -1 : 0);
    if (boostT > 0 && charId === 'chips') spr(SPR.feather, cx + 18 * p.face, p.y + 2 + Math.sin(t * 9) * 3, p.face < 0);
  }

  function drawParts() {
    for (const q of parts) {
      ctx.fillStyle = q.color;
      ctx.fillRect(Math.round(q.x), Math.round(q.y), q.line || q.size, q.size);
    }
    for (const tx of texts) {
      ctx.globalAlpha = Math.min(1, tx.life * 2);
      text(tx.text, Math.round(tx.x), Math.round(tx.y), 5, tx.color, 'center');
      ctx.globalAlpha = 1;
    }
  }

  function drawAvalanche() {
    const w = Math.round(avW);
    if (w < -20) return;
    ctx.fillStyle = theme.color;
    for (let y = -4; y < H + 4; y += 4) {
      const ex = w - 4 + Math.sin(y * 0.15 + t * 5) * 3;
      if (ex > 0) ctx.fillRect(-4, y, ex + 4, 4);
    }
    ctx.fillStyle = theme.color2;
    for (let y = 0; y < H; y += 12) {
      const ex = w - 8 + Math.sin(y * 0.3 + t * 7) * 3;
      if (ex > 0) ctx.fillRect(-4, y + ((Math.floor(t * 8) + y) % 6), ex, 2);
    }
    if (ch.theme === 'cat') {
      // пена, пузыри и резиновые уточки
      for (let y = -2; y < H; y += 5) {
        const fx = Math.round(w - 4 + Math.sin(y * 0.2 + t * 6) * 3);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(fx, y, 6 + (y % 3), 5);
        ctx.fillStyle = '#d8f0ff';
        ctx.fillRect(fx - 4, y + 2, 4, 3);
      }
      ctx.fillStyle = '#ffffff';
      for (let i = 0; i < 8; i++) {
        const by = (H + 10) - ((t * 30 + i * 37) % (H + 20));
        ctx.fillRect(Math.round(w - 14 + Math.sin(t * 3 + i) * 4 - (i % 3) * 4), Math.round(by), 2, 2);
      }
      for (let i = 0, y = GROUND_Y - 4; y > 0; y -= 34, i++) {
        spr(SPR.duck, w + 2 + Math.sin(t * 5 + i) * 3, y + Math.sin(t * 6 + i * 2) * 2, false);
      }
    } else {
      let i = 0;
      for (let y = GROUND_Y + 2; y > -16; y -= 13, i++) {
        const frames = SPR.en[theme.wall[i % theme.wall.length]];
        const img = frames[Math.floor(t * 6 + i) % frames.length];
        spr(img, w - 6 + Math.sin(t * 6 + i * 1.7) * 3, y + Math.sin(t * 8 + i) * 1.5);
      }
    }
    if (!dying && player.x - camX < avW + 40 && Math.floor(t * 6) % 2) {
      text('!', w + 10, Math.round(player.y - 14), 8, '#e33b2e', 'left');
    }
  }

  function drawHUD() {
    const top = Math.round(safeL.top) + 6;
    const hx = Math.round(safeL.left) + 8 + (hasAvalanche ? 24 : 0);
    for (let i = 0; i < 3; i++) ctx.drawImage(i < lives ? SPR.heart : SPR.heartEmpty, hx + i * 10, top);
    const icon = SPR[ch.item];
    ctx.drawImage(icon, hx, top + 11);
    text('x' + collected + (mode === 'level' ? '/' + level.total : ''), hx + 2 + icon.width, top + 13, 6, '#ffffff');
    if (mode === 'endless') {
      const sc = score();
      text(String(sc), Math.round(W / 2), top, 8, '#ffffff', 'center');
      text('РЕКОРД ' + Math.max(best, sc), Math.round(W / 2), top + 11, 5, '#ffe08a', 'center');
    } else {
      const s = Math.floor(lvlTime);
      text(Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'), Math.round(W / 2), top, 8, '#ffffff', 'center');
      text(level.def.name.toUpperCase(), Math.round(W / 2), top + 11, 5, '#ffe08a', 'center');
    }
    if (boostT > 0) {
      const bw = 40;
      ctx.fillStyle = '#1b1626';
      ctx.fillRect(hx - 1, top + 27, bw + 2, 5);
      ctx.fillStyle = Math.floor(t * 8) % 2 ? '#ffd23f' : '#ff5a1f';
      ctx.fillRect(hx, top + 28, Math.round(bw * boostT / BOOST_TIME), 3);
    }
    // эффекты от пива и водки: иконка и полоска времени
    let ey = top + (boostT > 0 ? 36 : 28);
    const effect = (img, frac, color) => {
      ctx.drawImage(img, hx, ey);
      ctx.fillStyle = '#1b1626'; ctx.fillRect(hx + 11, ey + 5, 32, 5);
      ctx.fillStyle = color; ctx.fillRect(hx + 12, ey + 6, Math.round(30 * frac), 3);
      ey += 18;
    };
    if (beerT > 0) effect(SPR.beer, beerT / BEER_TIME, '#ffd23f');
    if (swapT > 0) effect(SPR.vodka, swapT / VODKA_TIME, '#e33b2e');
    if (vodkaWarn > 0) {
      text(String(Math.ceil(vodkaWarn)), Math.round(W / 2), Math.round(H * 0.42), 24, '#e33b2e', 'center');
      text('КНОПКИ ПОМЕНЯЮТСЯ!', Math.round(W / 2), Math.round(H * 0.42) + 30, 6, '#ffffff', 'center');
    } else if (swapT > 0 && Math.floor(t * 3) % 2) {
      text('КНОПКИ ПЕРЕПУТАНЫ!', Math.round(W / 2), top + 22, 6, '#e33b2e', 'center');
    }
    if (banner) {
      ctx.globalAlpha = Math.min(1, banner.t * 2);
      const y = Math.round(H * 0.3);
      text(banner.text, Math.round(W / 2), y, 12, '#ffd23f', 'center');
      if (banner.sub) text(banner.sub, Math.round(W / 2), y + 18, 5, '#ffffff', 'center');
      ctx.globalAlpha = 1;
    }
  }

  function render() {
    ctx.setTransform(S, 0, 0, S, 0, 0);
    ctx.imageSmoothingEnabled = false;
    if (shakeT > 0) ctx.translate(Math.round(rnd(-2, 2)), Math.round(rnd(-2, 2)));
    Worlds.draw(world, ctx, camX, W, H, GROUND_Y, t);
    ctx.save();
    ctx.translate(-Math.round(camX), 0);
    drawGround();
    if (mode === 'level') { drawFlags(); drawFinish(); }
    drawSolids();
    drawItems();
    drawEnemies();
    drawPlayer();
    drawParts();
    ctx.restore();
    if (hasAvalanche) drawAvalanche();
    drawHUD();
  }

  return {
    init, startEndless, startLevel, stop, pause, resume, layout, setSafe, input, CHARS,
    // для отладки из консоли: Game.debug.spawn('dog'), Game.debug.boost()
    debug: { spawn: (kind, dx) => spawnEnemy(camX + W * (dx || 0.7), kind, GROUND_Y), boost: () => startBoost(), tp: x => { player.x = x; player.y = 20; player.vy = 0; }, time: s => { t = s; }, state: () => ({ t: Math.round(t), speed: Math.round(speed), score: score() }), item: type => items.push({ type, x: player.x, y: player.y, w: 8, h: 14, bob: 0 }) },
    set onGameOver(fn) { onOver = fn; },
    set onLevelEnd(fn) { onLevelEnd = fn; },
    set onSwap(fn) { onSwap = fn; },
    get running() { return running; },
    get paused() { return paused; },
    get mode() { return mode; },
  };
})();
