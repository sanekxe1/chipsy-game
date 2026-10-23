'use strict';
// «Хочу чипсов» — бесконечный раннер. Мир в логических пикселях, канвас масштабируется под экран.

const Records = {
  get(id) {
    try { return parseInt(localStorage.getItem('chips_best_' + id), 10) || 0; } catch (e) { return 0; }
  },
  set(id, v) {
    try { localStorage.setItem('chips_best_' + id, String(v)); } catch (e) { /* нет доступа */ }
  },
};

const Game = (() => {
  const GRAV = 900;
  const BOOST_TIME = 6.5;

  const CHARS = {
    sasha: { name: 'Саша', item: 'chipsPack', boost: 'motoIcon', jump: 330, theme: 'work', w: 10, h: 18, boostText: 'МОТОЦИКЛ!' },
    sonya: { name: 'Соня', item: 'chipsPack', boost: 'energy', jump: 330, theme: 'work', w: 10, h: 18, boostText: 'АДРЕНАЛИН!' },
    chips: { name: 'Чипс', item: 'kibble', boost: 'feather', jump: 395, theme: 'cat', w: 14, h: 10, boostText: 'ПЁРЫШКО!' },
  };
  const ITEM_SIZE = { chipsPack: { w: 10, h: 12 }, kibble: { w: 8, h: 7 } };

  // kind: walker — идёт, hopper — прыгает, flyer — летит волной, static — стоит, sprayer — шланг с водой
  const ENEMIES = {
    work: { kind: 'walker', speed: 22, w: 14, h: 12, label: 'РАБОТА' },
    deadline: { kind: 'walker', speed: 40, w: 12, h: 14, label: 'ДЕДЛАЙН' },
    email: { kind: 'flyer', speed: 38, w: 14, h: 9, label: 'СРОЧНО!', amp: 10 },
    alarm: { kind: 'hopper', speed: 30, w: 12, h: 11 },
    bill: { kind: 'flyer', speed: 22, w: 10, h: 11, label: 'ЖКХ', amp: 16 },
    dishes: { kind: 'static', w: 14, h: 13 },
    vacuum: { kind: 'walker', speed: 48, w: 16, h: 10 },
    carrier: { kind: 'walker', speed: 20, w: 16, h: 11, label: 'К ВЕТУ' },
    hose: { kind: 'sprayer', w: 14, h: 9 },
    cucumber: { kind: 'static', w: 16, h: 6 },
    clipper: { kind: 'flyer', speed: 34, w: 14, h: 9, amp: 12 },
    spray: { kind: 'flyer', speed: 26, w: 9, h: 13, amp: 8 },
  };
  const THEMES = {
    work: { pool: ['work', 'work', 'deadline', 'email', 'alarm', 'bill', 'dishes'], wall: ['deadline', 'work', 'email', 'bill', 'alarm'], color: '#4a3358', color2: '#6b4a7d' },
    cat: { pool: ['vacuum', 'vacuum', 'carrier', 'clipper', 'spray', 'hose', 'cucumber'], wall: ['vacuum', 'spray', 'clipper', 'hose'], color: '#2f7fd6', color2: '#7fc8ff' },
  };

  let canvas, ctx, stage;
  let W = 256, H = 300, S = 2, groundY = 276;
  let running = false, paused = false, raf = 0, last = 0;
  let ch, charId, theme;
  let t, camX, speed, mult, genX, firstChunk, nextBoostX, avW;
  let player, solids, enemies, items, parts, texts;
  let lives, collected, kills, boostT, shakeT, banner, dying, deathT, best;
  const input = { left: false, right: false, jump: false, jumpBuf: 0 };
  let onOver = null;

  const rnd = (a, b) => a + Math.random() * (b - a);
  const randi = (a, b) => Math.floor(rnd(a, b + 1));
  const pick = arr => arr[Math.floor(Math.random() * arr.length)];
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const hit = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  const hash = i => { const s = Math.sin(i * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
  const haptic = type => window.haptic && window.haptic(type);

  function init(cv, st) {
    canvas = cv; stage = st;
    ctx = canvas.getContext('2d');
  }

  // Логический размер подбирается под экран один раз при старте, дальше меняется только масштаб.
  function layout(recompute) {
    const r = stage.getBoundingClientRect();
    if (!r.width || !r.height) return;
    if (recompute) {
      const a = r.width / r.height;
      H = clamp(Math.round(200 / a), 170, 360);
      W = clamp(Math.round(H * a), 192, 420);
      groundY = H - 24;
    }
    const sc = Math.min(r.width / W, r.height / H);
    canvas.style.width = Math.floor(W * sc) + 'px';
    canvas.style.height = Math.floor(H * sc) + 'px';
    S = clamp(Math.round(sc * (window.devicePixelRatio || 1)), 1, 5);
    canvas.width = W * S;
    canvas.height = H * S;
  }

  function start(id) {
    charId = id; ch = CHARS[id]; theme = THEMES[ch.theme];
    layout(true);
    t = 0; camX = 0; speed = 60; mult = 1; genX = -32; firstChunk = true; nextBoostX = 900; avW = 22;
    solids = []; enemies = []; items = []; parts = []; texts = [];
    lives = 3; collected = 0; kills = 0; boostT = 0; shakeT = 0; dying = false; deathT = 0;
    banner = { text: 'ВПЕРЁД!', sub: id === 'chips' ? 'Собирай корм и беги от пылесосов!' : 'Собирай чипсы и беги от дедлайнов!', t: 2.4 };
    best = Records.get(id);
    player = { x: Math.round(W * 0.35), y: groundY - ch.h, w: ch.w, h: ch.h, vx: 0, vy: 0, onGround: true, coyote: 0, inv: 0, jumping: false, anim: 0, prevBottom: 0 };
    input.left = input.right = input.jump = false; input.jumpBuf = 0;
    while (genX < W + 80) genChunk();
    running = true; paused = false;
    last = performance.now();
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(frame);
    Sound.play('start');
    Sound.startMusic();
  }

  function stop() {
    running = false;
    cancelAnimationFrame(raf);
    Sound.stopMusic();
  }

  function pause() {
    if (!running || paused || dying) return false;
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
    render();
    raf = requestAnimationFrame(frame);
  }

  const score = () => Math.floor(camX / 16) + collected * 5 + kills * 10;

  // ---------------- Генерация мира ----------------
  function addGround(x, w) {
    const prev = solids.find(s => s.type === 'ground' && s.x + s.w === x);
    if (prev) prev.w += w;
    else solids.push({ x, y: groundY, w, h: 80, type: 'ground' });
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

  function spawnEnemy(x, kind) {
    kind = kind || pick(theme.pool);
    const d = ENEMIES[kind];
    const e = { kind, d, x, y: 0, w: d.w, h: d.h, vx: 0, vy: 0, t: 0, phase: Math.random() * 6, dir: -1, dead: false, hopT: rnd(0.4, 1.2), onGround: false };
    if (d.kind === 'flyer') {
      e.baseY = groundY - rnd(24, 50) - d.h;
      e.y = e.baseY;
    } else {
      e.y = groundY - d.h - 30;
    }
    enemies.push(e);
  }

  function genChunk() {
    const d = Math.min(1, camX / 9000);
    if (firstChunk) {
      firstChunk = false;
      const L = Math.ceil((W + 112) / 16) * 16;
      addGround(genX, L);
      itemLine(Math.round(W * 0.6), groundY - 16, 4);
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
      const y = groundY - 48;
      const q = new Set([randi(0, n - 1)]);
      if (Math.random() < 0.4) q.add(randi(0, n - 1));
      for (let i = 0; i < n; i++) solids.push({ x: px + i * 16, y, w: 16, h: 16, type: q.has(i) ? 'q' : 'brick', bumpT: 0 });
      if (Math.random() < 0.6) itemLine(px + 8, y - 14, n);
      if (Math.random() < 0.35) itemArc(px + n * 8, y - 52, 3, 30);
    } else if (r < 0.52) {
      // коробки, через которые надо перепрыгнуть
      const hgt = Math.random() < 0.5 ? 1 : 2;
      const bx = x0 + 16 * randi(2, L / 16 - 3);
      for (let j = 0; j < hgt; j++) solids.push({ x: bx, y: groundY - 16 * (j + 1), w: 16, h: 16, type: 'box', bumpT: 0 });
      if (hgt === 2 && Math.random() < 0.5) solids.push({ x: bx - 16, y: groundY - 16, w: 16, h: 16, type: 'box', bumpT: 0 });
      itemArc(bx + 8, groundY - 16 * hgt - 34, 3, 36);
    } else if (r < 0.72) {
      itemLine(x0 + 24, groundY - 16, randi(3, 5));
    }

    let n = Math.random() < 0.45 + 0.4 * d ? 1 : 0;
    if (Math.random() < d * 0.55) n++;
    for (let i = 0; i < n; i++) spawnEnemy(x0 + 40 + Math.random() * (L - 64));

    if (nextBoostX < x0 + L) {
      const bx = Math.max(nextBoostX, x0 + 24);
      items.push({ type: 'boost', x: bx, y: groundY - 40, w: 14, h: 12, bob: 0 });
      nextBoostX = bx + 1300 + Math.random() * 1100;
    }

    genX = x0 + L;
    if (Math.random() < 0.3 + 0.2 * d) {
      const g = 8 * randi(3, 5 + Math.floor(d * 3));
      if (Math.random() < 0.6) itemArc(genX + g / 2, groundY - 52, 3, g + 8);
      genX += g;
    }
  }

  // ---------------- Физика ----------------
  function collideX(o, px) {
    for (const s of solids) {
      if (!hit(o, s)) continue;
      if (px + o.w <= s.x + 0.01) { o.x = s.x - o.w; o.hitWall = 1; }
      else if (px >= s.x + s.w - 0.01) { o.x = s.x + s.w; o.hitWall = -1; }
    }
  }

  function collideY(o, py, isPlayer) {
    let bumped = false;
    for (const s of solids) {
      if (!hit(o, s)) continue;
      if (py + o.h <= s.y + 0.01) {
        o.y = s.y - o.h; o.vy = 0; o.onGround = true;
      } else if (py >= s.y + s.h - 0.01) {
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
    if (s.type === 'q' && !s.used) {
      s.used = true;
      if (Math.random() < 0.15 && boostT <= 0) {
        items.push({ type: 'boost', x: s.x + 1, y: s.y - 16, w: 14, h: 12, bob: 0 });
        Sound.play('bump');
      } else {
        const sz = ITEM_SIZE[ch.item];
        items.push({ type: 'pop', x: s.x + 8 - sz.w / 2, y: s.y - sz.h, w: sz.w, h: sz.h, vy: -170, life: 0.45 });
        collect(s.x + 8, s.y - 8);
      }
    } else {
      Sound.play('bump');
    }
    // враг, стоящий на блоке, слетает
    for (const e of enemies) {
      if (!e.dead && Math.abs(e.y + e.h - s.y) < 2 && e.x + e.w > s.x && e.x < s.x + s.w) killEnemy(e, true);
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

  function groundUnder(x) {
    return solids.some(s => s.type === 'ground' && x >= s.x && x + player.w <= s.x + s.w);
  }

  function respawn() {
    let x = camX + W * 0.42;
    for (let i = 0; i < 40 && !groundUnder(x); i++) x += 8;
    player.x = x;
    player.y = groundY - 110;
    player.vy = 0;
    player.inv = Math.max(player.inv, 1.5);
  }

  function startBoost() {
    boostT = BOOST_TIME;
    banner = { text: ch.boostText, t: 1.3 };
    Sound.play('boost');
    haptic('medium');
  }

  function finish() {
    stop();
    const sc = score();
    const isNew = sc > best;
    if (isNew) Records.set(charId, sc);
    if (onOver) onOver({ score: sc, best: Math.max(sc, best), isNew, collected, kills, dist: Math.floor(camX / 16), charId });
  }

  // ---------------- Обновление ----------------
  function update(dt) {
    t += dt;
    if (banner) { banner.t -= dt; if (banner.t <= 0) banner = null; }
    shakeT = Math.max(0, shakeT - dt);
    if (!dying) {
      const base = 62 + 78 * (1 - Math.exp(-t / 90));
      mult += ((boostT > 0 ? 1.75 : 1) - mult) * Math.min(1, dt * 3);
      speed = base * mult;
      camX += speed * dt;
      boostT = Math.max(0, boostT - dt);
    }
    while (genX < camX + W + 80) genChunk();
    avW += ((boostT > 0 ? 4 : 22) - avW) * Math.min(1, dt * 2);
    for (const s of solids) if (s.bumpT > 0) s.bumpT = Math.max(0, s.bumpT - dt);

    updatePlayer(dt);
    updateEnemies(dt);
    updateItems(dt);
    updateParts(dt);

    // обрывки из лавины
    if (!dying && Math.random() < dt * 6) {
      const color = ch.theme === 'cat' ? (Math.random() < 0.5 ? '#ffffff' : '#7fc8ff') : (Math.random() < 0.7 ? '#ffffff' : '#e33b2e');
      parts.push({ x: camX + avW, y: rnd(10, groundY), vx: rnd(20, 60), vy: rnd(-30, 20), life: rnd(0.4, 0.9), color, size: 2 });
    }

    const cut = camX - 64;
    solids = solids.filter(s => s.x + s.w > cut);
    items = items.filter(i => !i.dead && i.x + i.w > cut);
  }

  function updatePlayer(dt) {
    const p = player;
    p.anim += dt;
    if (dying) {
      p.vy += GRAV * dt;
      p.y += p.vy * dt;
      deathT -= dt;
      if (deathT <= 0) finish();
      return;
    }
    p.inv = Math.max(0, p.inv - dt);
    const dir = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    p.vx = speed + dir * 95;

    if (input.jumpBuf > 0) input.jumpBuf -= dt;
    if (input.jumpBuf > 0 && (p.onGround || p.coyote > 0)) {
      p.vy = -ch.jump;
      p.onGround = false; p.coyote = 0; p.jumping = true; input.jumpBuf = 0;
      Sound.play('jump');
    }
    if (p.jumping && !input.jump && p.vy < -150) p.vy = -150;
    p.vy = Math.min(p.vy + GRAV * dt, 520);

    const px = p.x, py = p.y;
    p.prevBottom = py + p.h;
    p.x += p.vx * dt;
    collideX(p, px);
    p.y += p.vy * dt;
    p.onGround = false;
    collideY(p, py, true);
    if (p.onGround) { p.coyote = 0.09; p.jumping = false; } else p.coyote -= dt;

    const maxX = camX + W - 10 - p.w;
    if (p.x > maxX) p.x = maxX;

    if (p.x < camX + avW - 2 || p.y > H + 24) {
      if (p.inv <= 0) hurt();
      if (!dying) respawn();
    }

    if (boostT > 0 && Math.random() < dt * 40) {
      const c = charId === 'sasha' ? '#c9ced6' : charId === 'sonya' ? (Math.random() < 0.5 ? '#ffd23f' : '#ff5a1f') : '#ff8fd1';
      parts.push({ x: p.x - 2, y: p.y + rnd(0, p.h), vx: rnd(-60, -20), vy: rnd(-15, 15), life: 0.35, color: c, size: 2 });
    }
  }

  const jetRect = e => ({ x: e.x + e.w / 2 - 3, y: e.y - 46, w: 6, h: 46 });

  function updateEnemies(dt) {
    const p = player;
    for (const e of enemies) {
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
        if (d.kind === 'sprayer') {
          const ph = (e.t + e.phase) % 2.6;
          e.jet = e.onGround && ph < 1.0;
          e.warn = e.onGround && ph > 2.2;
        }
      }
      if (e.y > H + 40 || e.x + e.w < camX - 64) { e.gone = true; continue; }
      if (dying) continue;

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
      else collect(it.x + it.w / 2, it.y);
    }
  }

  function updateParts(dt) {
    for (const q of parts) { q.x += q.vx * dt; q.y += q.vy * dt; q.vy += 120 * dt; q.life -= dt; }
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

  function layer(par, spacing, fn) {
    const off = camX * par;
    for (let i = Math.floor((off - 100) / spacing); i * spacing - off < W + 8; i++) {
      fn(i, Math.round(i * spacing - off + hash(i) * spacing * 0.5));
    }
  }

  function drawBackground() {
    ctx.fillStyle = '#6fd0f5';
    ctx.fillRect(-4, -4, W + 8, H + 8);
    ctx.fillStyle = '#8fdcf7';
    ctx.fillRect(-4, groundY - 120, W + 8, 120);
    ctx.fillStyle = '#b2e9fa';
    ctx.fillRect(-4, groundY - 60, W + 8, 60);
    layer(0.12, 80, (i, x) => {
      if (hash(i + 7) < 0.25) return;
      ctx.drawImage(SPR.clouds[i & 1], x, 10 + Math.floor(hash(i + 3) * Math.max(20, groundY - 130)));
    });
    layer(0.3, 120, (i, x) => {
      const img = SPR.hills[i & 1];
      ctx.drawImage(img, x, groundY - img.height + 2);
    });
    layer(0.6, 100, (i, x) => {
      if (hash(i + 11) < 0.3) return;
      const img = SPR.bushes[i & 1];
      ctx.drawImage(img, x, groundY - img.height + 1);
    });
  }

  function drawSolids() {
    for (const s of solids) {
      if (s.x > camX + W + 16 || s.x + s.w < camX - 16) continue;
      if (s.type === 'ground') {
        const sx = Math.round(s.x);
        for (let x = 0; x < s.w; x += 16) {
          const w = Math.min(16, s.w - x);
          ctx.drawImage(SPR.ground, 0, 0, w, 24, sx + x, groundY, w, 24);
        }
        ctx.fillStyle = '#1b1626';
        ctx.fillRect(sx - 1, groundY, 1, H - groundY);
        ctx.fillRect(sx + s.w, groundY, 1, H - groundY);
        continue;
      }
      let y = s.y;
      if (s.bumpT > 0) y -= Math.sin((0.18 - s.bumpT) / 0.18 * Math.PI) * 4;
      const img = s.type === 'brick' ? SPR.brick : s.type === 'box' ? SPR.box : s.used ? SPR.qUsed : SPR.q[Math.floor(t * 3) % 2];
      ctx.drawImage(img, Math.round(s.x), Math.round(y));
    }
  }

  function drawItems() {
    for (const it of items) {
      if (it.x > camX + W + 16) continue;
      if (it.type === 'boost') {
        const b = Math.sin(t * 5) * 2;
        const glow = Math.floor(t * 8) % 2 ? '#ffffff' : '#ffd23f';
        ctx.fillStyle = glow;
        const cx = Math.round(it.x + it.w / 2), cy = Math.round(it.y + it.h / 2 + b);
        ctx.fillRect(cx - 11, cy, 2, 2); ctx.fillRect(cx + 9, cy, 2, 2);
        ctx.fillRect(cx, cy - 11, 2, 2); ctx.fillRect(cx, cy + 9, 2, 2);
        spr(SPR[ch.boost], cx, it.y + it.h + 2 + b);
      } else {
        const b = it.type === 'pop' ? 0 : Math.sin(t * 4 + it.bob) * 1.5;
        spr(SPR[ch.item], it.x + it.w / 2, it.y + it.h + 1 + b);
      }
    }
  }

  function drawEnemies() {
    for (const e of enemies) {
      if (e.x > camX + W + 32) continue;
      const frames = SPR.en[e.kind];
      const img = frames[Math.floor(e.t * 6) % frames.length];
      const cx = e.x + e.w / 2, bottom = e.y + e.h + 1;
      if (e.jet || e.warn) drawJet(e);
      if (e.squash) spr(img, cx, bottom, e.dir > 0, 0.35);
      else spr(img, cx, bottom, e.dir > 0);
      if (e.d.label && !e.dead) label(e.d.label, cx, e.y - 2);
    }
  }

  function drawJet(e) {
    const cx = Math.round(e.x + e.w / 2);
    if (e.warn) {
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
    if (p.inv > 0 && !dying && Math.floor(p.inv * 12) % 2 === 0) return;
    const set = SPR[charId];
    const cx = p.x + p.w / 2, bottom = p.y + p.h + 1;
    let img;
    if (boostT > 0 && charId === 'sasha') img = set.moto[Math.floor(t * 10) % 2];
    else if (!p.onGround || dying) img = set.jump;
    else img = set.run[Math.floor(p.anim * (6 + speed / 18)) % 2];

    if (boostT > 0 && charId === 'sonya') {
      // энергетическая аура
      ctx.fillStyle = Math.floor(t * 12) % 2 ? 'rgba(255,210,63,0.55)' : 'rgba(255,90,31,0.45)';
      ctx.fillRect(Math.round(p.x - 3), Math.round(p.y - 4), p.w + 6, p.h + 5);
    }
    spr(img, cx, bottom, false, dying ? -1 : 0);
    if (boostT > 0 && charId === 'chips') {
      spr(SPR.feather, cx + 18, p.y + 2 + Math.sin(t * 9) * 3);
    }
  }

  function drawParts() {
    for (const q of parts) {
      ctx.fillStyle = q.color;
      ctx.fillRect(Math.round(q.x), Math.round(q.y), q.size, q.size);
    }
    for (const tx of texts) {
      ctx.globalAlpha = Math.min(1, tx.life * 2);
      text(tx.text, Math.round(tx.x), Math.round(tx.y), 5, tx.color, 'center');
      ctx.globalAlpha = 1;
    }
  }

  function drawAvalanche() {
    const w = Math.round(avW);
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
    const list = theme.wall;
    let i = 0;
    for (let y = groundY + 2; y > -16; y -= 13, i++) {
      const frames = SPR.en[list[i % list.length]];
      const img = frames[Math.floor(t * 6 + i) % frames.length];
      spr(img, w - 6 + Math.sin(t * 6 + i * 1.7) * 3, y + Math.sin(t * 8 + i) * 1.5);
    }
    // предупреждение, если лавина близко
    if (!dying && player.x - camX < avW + 40 && Math.floor(t * 6) % 2) {
      text('!', w + 8, Math.round(player.y - 14), 8, '#e33b2e', 'left');
    }
  }

  function drawHUD() {
    const hx = 32;
    for (let i = 0; i < 3; i++) ctx.drawImage(i < lives ? SPR.heart : SPR.heartEmpty, hx + i * 10, 6);
    const icon = SPR[ch.item];
    ctx.drawImage(icon, hx, 17);
    text('x' + collected, hx + 2 + icon.width, 19, 6, '#ffffff');
    const sc = score();
    text(String(sc), Math.round(W / 2), 6, 8, '#ffffff', 'center');
    text('РЕКОРД ' + Math.max(best, sc), Math.round(W / 2), 17, 5, '#ffe08a', 'center');
    if (boostT > 0) {
      const bw = 40;
      ctx.fillStyle = '#1b1626';
      ctx.fillRect(hx - 1, 33, bw + 2, 5);
      ctx.fillStyle = Math.floor(t * 8) % 2 ? '#ffd23f' : '#ff5a1f';
      ctx.fillRect(hx, 34, Math.round(bw * boostT / BOOST_TIME), 3);
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
    drawBackground();
    ctx.save();
    ctx.translate(-Math.round(camX), 0);
    drawSolids();
    drawItems();
    drawEnemies();
    drawPlayer();
    drawParts();
    ctx.restore();
    drawAvalanche();
    drawHUD();
  }

  return {
    init, start, stop, pause, resume, layout, input, CHARS,
    // для отладки из консоли: Game.debug.spawn('work'), Game.debug.boost()
    debug: { spawn: (kind, dx) => spawnEnemy(camX + W * (dx || 0.7), kind), boost: () => startBoost() },
    set onGameOver(fn) { onOver = fn; },
    get running() { return running; },
    get paused() { return paused; },
  };
})();
