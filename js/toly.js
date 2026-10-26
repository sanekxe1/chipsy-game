'use strict';
// «Тольяттинская суета»: Гранта едет по четырёхполосной трассе (вид сверху),
// игрок рулит влево-вправо, обгоняет попутных и уворачивается от встречных.
// Задел боком — царапина, игра идёт дальше; врезался — авария, конец.
// Помощники: табличка «ТОЛЬЯТТИ» (−20% скорости на 7 с), дальний свет (центр свободен 3 с),
// звонок Леси (5 с можно ехать по обочине). Помехи: ямы, дождь, ночь.

const Toly = (() => {
  const H = 180;
  const LANE = 28, LANES = 6, ROAD_W = LANE * LANES + 8;
  const OPP_LANES = [0, 1, 2], SAME_LANES = [3, 4, 5]; // слева встречка, справа попутные
  const SHOULDER = 24;          // насколько можно уехать на обочину во время звонка
  const STEER = 170;            // скорость руления, px/с
  const PLAYER_BOTTOM = H - 14;
  const CITY_TIME = 7, CITY_SLOW = 0.8;
  const FLASH_TIME = 3, FLASH_CD = 12;
  const CALL_TIME = 7;
  const HOLE_PENALTY = 50;
  const CYCLE = 80;             // секунд на день → вечер → ночь → утро
  const TRAFFIC = [             // вид, вес, скорость попутной/встречной (px/с)
    { kind: 'priora', w: 30, same: [55, 85], opp: [70, 100] },
    { kind: 'gle', w: 15, same: [65, 95], opp: [80, 110] },
    { kind: 'm5', w: 14, same: [75, 105], opp: [90, 120] },
    { kind: 'porsche', w: 10, same: [85, 115], opp: [100, 130] },
    { kind: 'kamaz', w: 11, same: [40, 60], opp: [55, 75] },
    { kind: 'moto', w: 12, same: [70, 100], opp: [80, 110] },
  ];

  let canvas, ctx, stage, W = 360, S = 2, safe = { top: 0 };
  let running = false, paused = false, raf = 0, last = 0;
  let t, dist, speed, slow, coins, scrapes, penalty, roadX, player, cars, coinsList, parts, texts, deco, holes, pickups;
  let nextCar, nextCoin, nextDeco, nextSign, nextHole, nextPhone, crashed, crashT, shakeT, banner, best, countdown, scrapeCD;
  let raceT, cityT, cityMult, flashT, flashCD, callT, rain, rainA, rainTimer, drops, lastFlashUI;
  const input = { left: false, right: false };
  let onOver = null, onFlashUI = null;

  const rnd = (a, b) => a + Math.random() * (b - a);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const haptic = type => window.haptic && window.haptic(type);
  const laneX = i => roadX + 4 + i * LANE + LANE / 2;
  const score = () => Math.max(0, Math.floor(dist / 8) + coins * 10 - penalty);
  const hit = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

  const Rec = {
    get() { try { return parseInt(localStorage.getItem('toly_best'), 10) || 0; } catch (e) { return 0; } },
    set(v) { try { localStorage.setItem('toly_best', String(v)); } catch (e) { /* нет доступа */ } },
    coins() { try { return parseInt(localStorage.getItem('toly_coins'), 10) || 0; } catch (e) { return 0; } },
    addCoins(n) { try { localStorage.setItem('toly_coins', String(this.coins() + n)); } catch (e) { /* нет доступа */ } },
  };

  // темнота 0..1 по кругу: день → вечер → ночь → утро
  const DARK = [[0, 0], [0.35, 0], [0.45, 0.55], [0.55, 1], [0.8, 1], [0.9, 0.3], [1, 0]];
  function darkness() {
    const ph = (t / CYCLE) % 1;
    let i = 0;
    while (DARK[i + 1][0] < ph) i++;
    const [p0, d0] = DARK[i], [p1, d1] = DARK[i + 1];
    return d0 + (d1 - d0) * ((ph - p0) / (p1 - p0));
  }

  function init(cv, st) { canvas = cv; stage = st; ctx = canvas.getContext('2d'); }

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
    safe.topL = (safe.top || 0) / sc;
  }
  function setSafe(s) { safe = s; if (running) layout(false); }

  function start() {
    layout(true);
    roadX = Math.round(W / 2 - ROAD_W / 2);
    t = 0; dist = 0; speed = 0; slow = 1; coins = 0; scrapes = 0; penalty = 0;
    cars = []; coinsList = []; parts = []; texts = []; deco = []; holes = []; pickups = []; drops = [];
    nextCar = 120; nextCoin = 60; nextDeco = 0; nextSign = 2600; nextHole = 900; nextPhone = 2200;
    crashed = false; crashT = 0; shakeT = 0; scrapeCD = 0;
    raceT = 0; cityT = 0; cityMult = 1; flashT = 0; flashCD = FLASH_CD; callT = 0;
    rain = false; rainA = 0; rainTimer = rnd(25, 40);
    lastFlashUI = null;
    countdown = 3.4;
    banner = null;
    best = Rec.get();
    player = { x: laneX(4) - 7, y: PLAYER_BOTTOM - 24, w: 14, h: 24, vx: 0, spin: 0 };
    input.left = input.right = false;
    for (let y = -40; y < H + 20; y += 10) addDeco(y);
    running = true; paused = false;
    last = performance.now();
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(frame);
    Sound.play('tick');
    flashUI();
  }

  function stop() { running = false; cancelAnimationFrame(raf); Sound.stopMusic(); }
  function pause() {
    if (!running || paused || crashed) return false;
    paused = true; Sound.stopMusic(); return true;
  }
  function resume() {
    if (!running || !paused) return;
    paused = false; last = performance.now();
    input.left = input.right = false;
    if (countdown <= 0) Sound.startMusic('race');
  }

  function frame(ts) {
    if (!running) return;
    const dt = Math.min(0.033, Math.max(0, (ts - last) / 1000));
    last = ts;
    if (!paused) update(dt);
    if (running) render();
    raf = requestAnimationFrame(frame);
  }

  // ---------------- Дальний свет ----------------
  // сообщает кнопке, сколько секунд до готовности (0 — можно жать)
  function flashUI() {
    const v = flashT > 0 ? -1 : Math.ceil(flashCD);
    if (v !== lastFlashUI) { lastFlashUI = v; if (onFlashUI) onFlashUI(v); }
  }

  function flash() {
    if (!running || paused || crashed || countdown > 0 || flashT > 0 || flashCD > 0) return false;
    flashT = FLASH_TIME;
    // машины с двух центральных полос уходят в крайние
    for (const c of cars) {
      if (c.lane === 2) c.lane = 1;
      else if (c.lane === 3) c.lane = 4;
    }
    banner = { text: 'ДАЛЬНИЙ!', sub: 'Центр свободен на 3 секунды', t: 1.4 };
    Sound.play('flash');
    haptic('medium');
    flashUI();
    return true;
  }

  // ---------------- Мир ----------------
  function addDeco(y) {
    const side = Math.random() < 0.5 ? -1 : 1;
    const edge = side < 0 ? roadX - 10 : roadX + ROAD_W + 10;
    const far = side < 0 ? 4 : W - 4;
    const x = rnd(Math.min(edge, far), Math.max(edge, far));
    const r = Math.random();
    let kind;
    if (Math.abs(x - (side < 0 ? roadX : roadX + ROAD_W)) < 16 && r < 0.25) kind = 'lamp';
    else if (r < 0.05) kind = 'billboard';
    else if (r < 0.15) kind = 'house';
    else kind = 'tree';
    if (kind === 'lamp') deco.push({ kind, x: side < 0 ? roadX - 6 : roadX + ROAD_W + 4, y, side });
    else if (kind === 'billboard') deco.push({ kind, x: side < 0 ? roadX - 50 : roadX + ROAD_W + 10, y, side });
    else deco.push({ kind, x, y, v: Math.floor(Math.random() * 3), c: Math.floor(Math.random() * 4) });
  }

  function lanesBlocked(y) {
    // какие полосы заняты рядом по высоте — чтобы всегда оставался проезд
    const busy = new Set();
    for (const c of cars) if (Math.abs(c.y - y) < 70) busy.add(c.lane);
    return busy;
  }

  function spawnCar() {
    const d = Math.min(1, dist / 30000);
    const total = TRAFFIC.reduce((a, b) => a + b.w, 0);
    let r = Math.random() * total, def = TRAFFIC[0];
    for (const tr of TRAFFIC) { r -= tr.w; if (r <= 0) { def = tr; break; } }
    const busy = lanesBlocked(-60);
    if (busy.size >= 4) return;
    // при дальнем свете две центральные полосы (2 и 3) не занимаем
    const opp = Math.random() < 0.35 + 0.15 * d;
    const lanes = (opp ? OPP_LANES : SAME_LANES).filter(l => !busy.has(l) && !(flashT > 0 && (l === 2 || l === 3)));
    if (!lanes.length) return;
    const lane = lanes[Math.floor(Math.random() * lanes.length)];
    const variants = TSPR.cars[def.kind];
    const img = variants[Math.floor(Math.random() * variants.length)][opp ? 1 : 0];
    const range = opp ? def.opp : def.same;
    cars.push({
      kind: def.kind, img, opp, lane,
      x: laneX(lane) - (img.width - 2) / 2, y: -img.height - 4,
      w: img.width - 2, h: img.height - 2,
      v: rnd(range[0], range[1]), wob: Math.random() * 6,
    });
  }

  function spawnCoins() {
    const lane = Math.floor(Math.random() * LANES);
    const n = 3 + Math.floor(Math.random() * 3);
    for (let i = 0; i < n; i++) coinsList.push({ x: laneX(lane) - 4, y: -12 - i * 18, w: 8, h: 8 });
  }

  // ---------------- Обновление ----------------
  function update(dt) {
    t += dt;
    shakeT = Math.max(0, shakeT - dt);
    scrapeCD = Math.max(0, scrapeCD - dt);
    if (banner) { banner.t -= dt; if (banner.t <= 0) banner = null; }

    if (countdown > 0) {
      const before = Math.ceil(countdown);
      countdown -= dt;
      if (countdown <= 0) {
        banner = { text: 'ПОЕХАЛИ!', t: 1 };
        Sound.play('go');
        Sound.startMusic('race');
      } else if (Math.ceil(countdown) !== before) Sound.play('tick');
      return;
    }

    raceT += dt;
    // таймеры помощников
    cityT = Math.max(0, cityT - dt);
    cityMult += ((cityT > 0 ? CITY_SLOW : 1) - cityMult) * Math.min(1, dt * 2);
    if (flashT > 0) { flashT = Math.max(0, flashT - dt); if (flashT === 0) flashCD = FLASH_CD; }
    else flashCD = Math.max(0, flashCD - dt);
    flashUI();
    if (callT > 0) {
      callT = Math.max(0, callT - dt);
      if (callT === 0) texts.push({ x: player.x + 7, y: player.y - 8, text: 'ПОКА, ЛЕСЯ!', life: 1 });
    }

    // погода: дождь начинается и заканчивается сам
    rainTimer -= dt;
    if (rainTimer <= 0) {
      rain = !rain;
      rainTimer = rain ? rnd(15, 22) : rnd(30, 55);
      if (rain) banner = { text: 'ДОЖДЬ!', sub: 'Дорога скользкая', t: 1.6 };
    }
    rainA += ((rain ? 1 : 0) - rainA) * Math.min(1, dt * 0.8);

    if (crashed) {
      crashT -= dt;
      speed = Math.max(0, speed - 300 * dt);
      player.spin += dt * 9;
      if (Math.random() < dt * 30) parts.push({ x: player.x + 7 + rnd(-4, 4), y: player.y + 12, vx: rnd(-20, 20), vy: rnd(-40, -10), life: 0.8, color: Math.random() < 0.5 ? '#5b5466' : '#2a2a33', size: 3 });
      if (crashT <= 0) { finish(); return; }
    } else {
      // скорость растёт со временем; после царапины и в городе машина притормаживает
      slow = Math.min(1, slow + dt * 0.6);
      // плавный разгон: целевая скорость растёт со временем, а машина догоняет её постепенно
      const target = (90 + 180 * (1 - Math.exp(-raceT / 90))) * slow * cityMult;
      speed += (target - speed) * Math.min(1, dt * (speed < target ? 0.9 : 3));
    }
    const dy = speed * dt;
    dist += dy;

    // руление (в дождь машина отзывается медленнее); во время звонка можно на обочину
    if (!crashed) {
      let dir = (input.right ? 1 : 0) - (input.left ? 1 : 0);
      const minX = roadX + 3, maxX = roadX + ROAD_W - 3 - player.w;
      const offRoad = player.x < minX - 0.5 || player.x > maxX + 0.5;
      // звонок кончился, а мы на обочине: руль наружу не работает, машину уводит обратно на дорогу
      if (callT === 0 && offRoad) dir = player.x < minX ? 1 : -1;
      // руль отзывчивый; в дождь машина слушается хуже
      player.vx += (dir * STEER - player.vx) * Math.min(1, dt * (28 - 14 * rainA));
      player.x += player.vx * dt;
      if (callT > 0) {
        player.x = clamp(player.x, minX - SHOULDER, maxX + SHOULDER);
        if ((player.x < minX || player.x > maxX) && Math.random() < dt * 20) parts.push({ x: player.x + rnd(0, 14), y: player.y + 24, vx: rnd(-20, 20), vy: rnd(10, 40), life: 0.4, color: '#c9a26b', size: 2 });
      } else if (offRoad) {
        if (player.x > minX - 0.5 && player.x < maxX + 0.5) player.x = clamp(player.x, minX, maxX);
      } else if (player.x < minX || player.x > maxX) {
        player.x = clamp(player.x, minX, maxX);
        scrape(player.x < minX + 1 ? player.x : player.x + player.w, player.y + 12, true);
      }
    }

    // обочина и табличка «ТОЛЬЯТТИ»
    for (const o of deco) o.y += dy;
    deco = deco.filter(o => o.y < H + 60);
    nextDeco -= dy;
    while (nextDeco <= 0) { addDeco(-30 - Math.random() * 20); nextDeco += 10; }
    nextSign -= dy;
    if (nextSign <= 0) {
      deco.push({ kind: 'sign', x: roadX + ROAD_W + 6, y: -20 });
      nextSign = rnd(3500, 5000);
    }
    for (const o of deco) {
      if (o.kind === 'sign' && !o.used && o.y > player.y) {
        o.used = true;
        cityT = CITY_TIME;
        banner = { text: 'ТОЛЬЯТТИ', sub: 'Город: скорость −20% на 7 секунд', t: 2 };
        Sound.play('checkpoint');
      }
    }

    // трафик: попутные едут медленнее нас, встречные — навстречу
    for (const c of cars) {
      c.y += c.opp ? dy + c.v * dt : dy - c.v * dt * slow * cityMult;
      const tx = laneX(c.lane) - c.w / 2 + (c.kind === 'moto' ? Math.sin(t * 2 + c.wob) * 5 : 0);
      c.x += (tx - c.x) * Math.min(1, dt * (c.kind === 'moto' ? 20 : 5));
    }
    // в одной полосе машины не проезжают сквозь друг друга: догнавший тормозит
    for (const a of cars) {
      for (const b of cars) {
        if (a === b || a.lane !== b.lane || a.opp !== b.opp) continue;
        const lead = a.opp ? (a.y > b.y ? a : b) : (a.y < b.y ? a : b);
        const fol = lead === a ? b : a;
        const gap = a.opp ? lead.y - (fol.y + fol.h) : fol.y - (lead.y + lead.h);
        if (gap < 8) {
          fol.v = Math.min(fol.v, lead.v);
          if (gap < 4) fol.y = a.opp ? lead.y - fol.h - 4 : lead.y + lead.h + 4;
        }
      }
    }
    cars = cars.filter(c => c.y < H + 80 && c.y > -200);
    nextCar -= dy;
    if (nextCar <= 0) {
      spawnCar();
      const d = Math.min(1, dist / 30000);
      nextCar = rnd(38, 80) * (1 - 0.4 * d);
    }

    // монетки, телефон, ямы
    for (const cn of coinsList) cn.y += dy;
    nextCoin -= dy;
    if (nextCoin <= 0) { spawnCoins(); nextCoin = rnd(220, 420); }
    for (const p of pickups) p.y += dy;
    nextPhone -= dy;
    if (nextPhone <= 0) {
      const lane = Math.floor(Math.random() * LANES);
      pickups.push({ kind: 'phone', x: laneX(lane) - 4, y: -14, w: 9, h: 12 });
      nextPhone = rnd(3000, 4800);
    }
    for (const hl of holes) hl.y += dy;
    nextHole -= dy;
    if (nextHole <= 0) {
      const lane = Math.floor(Math.random() * LANES);
      if (!lanesBlocked(-20).has(lane)) holes.push({ x: laneX(lane) - 6 + rnd(-4, 4), y: -10, w: 12, h: 6 });
      nextHole = rnd(500, 1100);
    }

    if (!crashed) {
      for (const cn of coinsList) {
        if (!cn.taken && hit(player, cn)) {
          cn.taken = true; coins++;
          texts.push({ x: cn.x + 4, y: cn.y, text: '+10', life: 0.7 });
          Sound.play('coin');
        }
      }
      for (const p of pickups) {
        if (!p.taken && hit(player, p)) {
          p.taken = true;
          callT = CALL_TIME;
          banner = { text: 'ЗВОНИТ ЛЕСЯ!', sub: CALL_TIME + ' секунд можно ехать по обочине', t: 1.6 };
          Sound.play('ring');
          haptic('medium');
        }
      }
      for (const hl of holes) {
        if (hl.hit) continue;
        const box = { x: hl.x + 2, y: hl.y + 1, w: hl.w - 4, h: hl.h - 2 };
        if (hit(player, box)) {
          hl.hit = true;
          penalty += HOLE_PENALTY;
          slow = Math.min(slow, 0.6);
          shakeT = 0.35;
          texts.push({ x: hl.x + 6, y: hl.y - 6, text: 'ЯМА! −' + HOLE_PENALTY, life: 1 });
          Sound.play('thump');
          haptic('heavy');
          for (let i = 0; i < 6; i++) parts.push({ x: hl.x + 6, y: hl.y + 3, vx: rnd(-40, 40), vy: rnd(-50, 0), life: 0.4, color: '#6a6a72', size: 2 });
        }
      }
    }
    coinsList = coinsList.filter(c => !c.taken && c.y < H + 20);
    pickups = pickups.filter(p => !p.taken && p.y < H + 20);
    holes = holes.filter(hl => hl.y < H + 20);

    // столкновения; пока возвращаемся с обочины после звонка — только царапины, без аварий
    if (!crashed) {
      const returning = callT === 0 && (player.x < roadX + 3 || player.x > roadX + ROAD_W - 3 - player.w);
      for (const c of cars) {
        if (!hit(player, c)) continue;
        const ox = Math.min(player.x + player.w, c.x + c.w) - Math.max(player.x, c.x);
        if (ox <= 6 || returning) {
          // задел боком — отталкиваемся и едем дальше
          const left = player.x + player.w / 2 < c.x + c.w / 2;
          player.x += left ? -(ox + 1) : ox + 1;
          player.vx = left ? -60 : 60;
          scrape(left ? player.x + player.w : player.x, Math.max(player.y, c.y) + 8, false);
        } else {
          crash();
          break;
        }
      }
    }

    // капли дождя
    if (rainA > 0.05) {
      const n = Math.floor(rainA * 90 * dt * 10);
      for (let i = 0; i < n; i++) drops.push({ x: rnd(-20, W + 20), y: rnd(-20, H), life: rnd(0.15, 0.35) });
    }
    for (const d of drops) { d.x -= 60 * dt; d.y += 260 * dt; d.life -= dt; }
    drops = drops.filter(d => d.life > 0);

    for (const q of parts) { q.x += q.vx * dt; q.y += q.vy * dt + dy * 0.5; q.life -= dt; }
    parts = parts.filter(q => q.life > 0);
    for (const tx of texts) { tx.y -= 20 * dt; tx.life -= dt; }
    texts = texts.filter(tx => tx.life > 0);
  }

  function scrape(x, y, wall) {
    for (let i = 0; i < 4; i++) parts.push({ x, y: y + rnd(-6, 6), vx: rnd(-60, 60), vy: rnd(-60, 30), life: 0.35, color: Math.random() < 0.5 ? '#ffd23f' : '#ffffff', size: 1 });
    if (scrapeCD > 0) return;
    scrapeCD = 0.5;
    slow = Math.min(slow, 0.85);
    shakeT = 0.15;
    if (!wall) { scrapes++; texts.push({ x, y: y - 10, text: 'ЦАРАПИНА!', life: 0.9 }); }
    Sound.play('screech');
    haptic('light');
  }

  function crash() {
    crashed = true;
    crashT = 1.6;
    shakeT = 0.5;
    banner = { text: 'АВАРИЯ!', t: 2 };
    Sound.stopMusic();
    Sound.play('crash');
    haptic('heavy');
    for (let i = 0; i < 24; i++) parts.push({ x: player.x + 7, y: player.y + 4, vx: rnd(-90, 90), vy: rnd(-90, 60), life: rnd(0.4, 1), color: ['#ffd23f', '#ff7b1c', '#e33b2e', '#ffffff'][i % 4], size: 2 });
  }

  function finish() {
    stop();
    const sc = score();
    const isNew = sc > best;
    if (isNew) Rec.set(sc);
    Rec.addCoins(coins);
    if (onOver) onOver({ score: sc, best: Math.max(best, sc), isNew, coins, scrapes, dist: Math.floor(dist / 8), total: Rec.coins() });
  }

  // ---------------- Отрисовка ----------------
  function text(str, x, y, size, color, align) {
    ctx.font = size + 'px "Press Start 2P", monospace';
    ctx.textAlign = align || 'left';
    ctx.textBaseline = 'top';
    ctx.fillStyle = '#1b1626';
    ctx.fillText(str, x + 1, y + 1);
    ctx.fillStyle = color;
    ctx.fillText(str, x, y);
  }

  function drawDeco(o) {
    const x = Math.round(o.x), y = Math.round(o.y);
    if (o.kind === 'tree') {
      const img = TSPR.trees[o.v];
      ctx.drawImage(img, x - img.width / 2, y - img.height / 2);
    } else if (o.kind === 'house') {
      const cols = ['#a5432e', '#7a5a3a', '#8b93a1', '#5f4b66'];
      ctx.fillStyle = '#1b1626'; ctx.fillRect(x - 15, y - 12, 30, 24);
      ctx.fillStyle = cols[o.c]; ctx.fillRect(x - 14, y - 11, 28, 22);
      ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(x, y - 11, 14, 22);
    } else if (o.kind === 'lamp') {
      ctx.fillStyle = '#5b5466'; ctx.fillRect(x, y, 3, 3);
      ctx.fillRect(o.side < 0 ? x + 2 : x - 6, y + 1, 7, 1);
      ctx.fillStyle = '#fff3b0'; ctx.fillRect(o.side < 0 ? x + 8 : x - 8, y, 2, 3);
    } else if (o.kind === 'sign') {
      // большая синяя табличка города на столбе
      ctx.fillStyle = '#5b5466'; ctx.fillRect(x + 22, y + 14, 2, 10);
      ctx.fillStyle = '#1b1626'; ctx.fillRect(x - 1, y - 1, 48, 16);
      ctx.fillStyle = '#2b5fbf'; ctx.fillRect(x, y, 46, 14);
      ctx.fillStyle = '#ffffff'; ctx.fillRect(x + 1, y + 1, 44, 1); ctx.fillRect(x + 1, y + 12, 44, 1);
      text('ТОЛЬЯТТИ', x + 23, y + 4, 5, '#ffffff', 'center');
    } else if (o.kind === 'billboard') {
      ctx.fillStyle = '#1b1626'; ctx.fillRect(x - 1, y - 1, 42, 18);
      ctx.fillStyle = '#ffffff'; ctx.fillRect(x, y, 40, 16);
      ctx.fillStyle = '#2b5fbf'; ctx.fillRect(x, y, 40, 3);
      text('LADA', x + 20, y + 5, 6, '#2b5fbf', 'center');
    }
  }

  function drawRoad() {
    const x0 = roadX;
    // во время звонка обочина подсвечена — по ней можно ехать
    if (callT > 0) {
      ctx.fillStyle = Math.floor(t * 4) % 2 ? '#c9a26b' : '#b8915a';
      ctx.fillRect(x0 - SHOULDER - 2, -4, SHOULDER, H + 8);
      ctx.fillRect(x0 + ROAD_W + 2, -4, SHOULDER, H + 8);
    }
    ctx.fillStyle = '#1b1626'; ctx.fillRect(x0 - 2, -4, ROAD_W + 4, H + 8);
    ctx.fillStyle = '#9a9488'; ctx.fillRect(x0 - 1, -4, ROAD_W + 2, H + 8);
    ctx.fillStyle = rainA > 0.3 ? '#3f4048' : '#4a4a52';
    ctx.fillRect(x0 + 2, -4, ROAD_W - 4, H + 8);
    ctx.fillStyle = '#56565f';
    const off = dist % 64;
    for (let i = 0; i < 40; i++) {
      const px = x0 + 4 + ((i * 37) % (ROAD_W - 8));
      const py = ((i * 53 + off * 2) % (H + 64)) - 32;
      ctx.fillRect(px, Math.round(py), 2, 1);
    }
    // лужи-блики в дождь
    if (rainA > 0.3) {
      ctx.fillStyle = 'rgba(159,208,240,' + (0.25 * rainA).toFixed(2) + ')';
      for (let i = 0; i < 8; i++) ctx.fillRect(x0 + 8 + ((i * 41) % (ROAD_W - 24)), Math.round(((i * 71 + off * 3) % (H + 40)) - 20), 12, 3);
    }
    // разметка: края сплошные, двойная сплошная по центру, пунктир между полосами
    ctx.fillStyle = '#f2f2f2';
    ctx.fillRect(x0 + 3, -4, 1, H + 8);
    ctx.fillRect(x0 + ROAD_W - 4, -4, 1, H + 8);
    const mid = x0 + 4 + 3 * LANE;
    ctx.fillRect(mid - 2, -4, 1, H + 8);
    ctx.fillRect(mid + 1, -4, 1, H + 8);
    const dash = dist % 24;
    for (const lx of [1, 2, 4, 5].map(i => x0 + 4 + i * LANE)) {
      for (let y = -24 + dash; y < H; y += 24) ctx.fillRect(lx, Math.round(y), 1, 12);
    }
  }

  // фары, фонари и задние огни поверх затемнения
  function drawLights(dark) {
    const beams = flashT > 0 ? (Math.floor(t * 8) % 2 ? 0.55 : 0.1) : dark * 0.22;
    ctx.globalCompositeOperation = 'lighter';
    if (beams > 0.02 && !crashed) {
      ctx.fillStyle = 'rgba(255,240,170,' + beams.toFixed(2) + ')';
      const cx = player.x + player.w / 2, y0 = player.y;
      for (let k = 0; k < 60; k += 3) {
        const half = 4 + k * 0.35;
        ctx.fillRect(Math.round(cx - half), Math.round(y0 - k - 3), Math.round(half * 2), 3);
      }
    }
    if (dark > 0.2) {
      for (const c of cars) {
        if (c.opp) {
          ctx.fillStyle = 'rgba(255,240,170,' + (dark * 0.18).toFixed(2) + ')';
          const cx = c.x + c.w / 2, y0 = c.y + c.h;
          for (let k = 0; k < 36; k += 3) {
            const half = 3 + k * 0.3;
            ctx.fillRect(Math.round(cx - half), Math.round(y0 + k), Math.round(half * 2), 3);
          }
        } else {
          ctx.fillStyle = 'rgba(227,59,46,' + (dark * 0.5).toFixed(2) + ')';
          ctx.fillRect(Math.round(c.x - 1), Math.round(c.y + c.h - 3), c.w + 2, 5);
        }
      }
      ctx.fillStyle = 'rgba(255,233,168,' + (dark * 0.3).toFixed(2) + ')';
      for (const o of deco) {
        if (o.kind !== 'lamp') continue;
        ctx.beginPath(); ctx.arc(o.x + (o.side < 0 ? 9 : -7), o.y + 1, 12, 0, Math.PI * 2); ctx.fill();
      }
    }
    ctx.globalCompositeOperation = 'source-over';
  }

  function render() {
    ctx.setTransform(S, 0, 0, S, 0, 0);
    ctx.imageSmoothingEnabled = false;
    if (shakeT > 0) ctx.translate(Math.round(rnd(-2, 2)), Math.round(rnd(-2, 2)));
    // трава с полосками
    ctx.fillStyle = '#5cae3c'; ctx.fillRect(-4, -4, W + 8, H + 8);
    ctx.fillStyle = '#55a337';
    const goff = dist % 32;
    for (let y = -32 + goff; y < H; y += 32) ctx.fillRect(-4, Math.round(y), W + 8, 16);
    for (const o of deco) if (o.kind === 'house' || o.kind === 'tree') drawDeco(o);
    drawRoad();
    for (const o of deco) if (o.kind !== 'house' && o.kind !== 'tree') drawDeco(o);
    for (const hl of holes) ctx.drawImage(TSPR.hole, Math.round(hl.x), Math.round(hl.y));

    // предупреждение о встречке у верхнего края
    for (const c of cars) {
      if (c.opp && c.y < -4 && c.y > -90 && Math.floor(t * 8) % 2) {
        const cx = Math.round(c.x + c.w / 2);
        ctx.fillStyle = '#e33b2e';
        ctx.fillRect(cx - 3, 2, 7, 2); ctx.fillRect(cx - 2, 4, 5, 2); ctx.fillRect(cx - 1, 6, 3, 2);
      }
    }
    for (const cn of coinsList) {
      const f = Math.floor(t * 6 + cn.y / 40) % 2;
      ctx.drawImage(TSPR.coin[f], Math.round(cn.x + f), Math.round(cn.y));
    }
    for (const p of pickups) {
      if (Math.floor(t * 6) % 2) { ctx.fillStyle = '#ff8fb8'; ctx.fillRect(Math.round(p.x - 3), Math.round(p.y + 4), 2, 2); ctx.fillRect(Math.round(p.x + 10), Math.round(p.y + 4), 2, 2); }
      ctx.drawImage(TSPR.phone, Math.round(p.x), Math.round(p.y + Math.sin(t * 6) * 1.5));
    }
    for (const c of cars) ctx.drawImage(c.img, Math.round(c.x - 1), Math.round(c.y - 1));

    // игрок
    const img = scrapeCD > 0.35 && Math.floor(t * 20) % 2 ? TSPR.grantaHit : TSPR.granta;
    const px = Math.round(player.x - 1), py = Math.round(player.y - 1);
    if (player.spin) {
      ctx.save();
      ctx.translate(px + img.width / 2, py + img.height / 2);
      ctx.rotate(player.spin);
      ctx.drawImage(img, -img.width / 2, -img.height / 2);
      ctx.restore();
    } else {
      ctx.drawImage(img, px, py);
    }

    // ночь и дождь
    const dark = darkness();
    const shade = Math.min(0.62, dark * 0.6 + rainA * 0.12);
    if (shade > 0.01) {
      ctx.fillStyle = 'rgba(8,12,35,' + shade.toFixed(2) + ')';
      ctx.fillRect(-4, -4, W + 8, H + 8);
    }
    drawLights(dark);
    if (drops.length) {
      ctx.fillStyle = 'rgba(190,215,255,0.7)';
      for (const d of drops) { ctx.fillRect(Math.round(d.x), Math.round(d.y), 1, 4); ctx.fillRect(Math.round(d.x) - 1, Math.round(d.y) + 4, 1, 2); }
    }

    for (const q of parts) { ctx.fillStyle = q.color; ctx.fillRect(Math.round(q.x), Math.round(q.y), q.size, q.size); }
    for (const tx of texts) {
      ctx.globalAlpha = Math.min(1, tx.life * 2);
      text(tx.text, Math.round(tx.x), Math.round(tx.y), 5, '#ffd23f', 'center');
      ctx.globalAlpha = 1;
    }
    drawHUD();
  }

  // телефон с Лесей у края экрана во время звонка
  function drawCall(x, y) {
    ctx.fillStyle = '#1b1626'; ctx.fillRect(x - 1, y - 1, 52, 82);
    ctx.fillStyle = '#2a2a33'; ctx.fillRect(x, y, 50, 80);
    ctx.fillStyle = '#ffe3ef'; ctx.fillRect(x + 3, y + 6, 44, 64);
    const img = TSPR.lesya;
    ctx.drawImage(img, x + 25 - img.width, y + 9, img.width * 2, img.height * 2);
    text('ЛЕСЯ', x + 25, y + 45, 6, '#e33b2e', 'center');
    ctx.drawImage(SPR.heart, x + 21, y + 54);
    ctx.fillStyle = '#1b1626'; ctx.fillRect(x + 5, y + 64, 40, 4);
    ctx.fillStyle = '#5cc93a'; ctx.fillRect(x + 6, y + 65, Math.round(38 * callT / CALL_TIME), 2);
    ctx.fillStyle = '#8b93a1'; ctx.fillRect(x + 20, y + 73, 10, 3);
  }

  function drawHUD() {
    const top = Math.round(safe.topL || 0) + 6;
    const lx = 8, rx = W - 8;
    text(String(score()), lx, top, 8, '#ffffff', 'left');
    text('РЕКОРД ' + Math.max(best, score()), lx, top + 11, 5, '#ffe08a', 'left');
    ctx.drawImage(TSPR.coin[0], lx, top + 20);
    text('x' + coins, lx + 12, top + 22, 6, '#ffffff', 'left');
    text(Math.round(speed * 0.6) + ' КМ/Ч', rx - 30, top, 7, '#ffffff', 'right');
    let ey = top + 12;
    if (cityT > 0) {
      text('ГОРОД −20%', rx - 30, ey, 5, '#9fd0f0', 'right');
      ctx.fillStyle = '#1b1626'; ctx.fillRect(rx - 72, ey + 8, 42, 4);
      ctx.fillStyle = '#3d7be0'; ctx.fillRect(rx - 71, ey + 9, Math.round(40 * cityT / CITY_TIME), 2);
      ey += 16;
    }
    if (rain) text('ДОЖДЬ', rx - 30, ey, 5, '#9fd0f0', 'right');
    if (callT > 0) drawCall(lx, top + 34);
    if (countdown > 0) {
      const n = Math.ceil(countdown);
      text(n > 3 ? '3' : String(n), Math.round(W / 2), Math.round(H * 0.32), 24, '#ffd23f', 'center');
      text('ТОЛЬЯТТИНСКАЯ СУЕТА', Math.round(W / 2), Math.round(H * 0.32) + 32, 6, '#ffffff', 'center');
    }
    if (banner) {
      ctx.globalAlpha = Math.min(1, banner.t * 2);
      const y = Math.round(H * 0.3);
      text(banner.text, Math.round(W / 2), y, 12, banner.text === 'АВАРИЯ!' ? '#e33b2e' : '#ffd23f', 'center');
      if (banner.sub) text(banner.sub, Math.round(W / 2), y + 17, 5, '#ffffff', 'center');
      ctx.globalAlpha = 1;
    }
  }

  return {
    init, start, stop, pause, resume, layout, setSafe, flash, input, Rec,
    // для отладки из консоли: Toly.debug.time(45), Toly.debug.rain(), Toly.debug.call(), Toly.debug.sign()
    debug: {
      time: s => { t = s; },
      rain: () => { rainTimer = 0; },
      call: () => { pickups.push({ kind: 'phone', x: player.x + 2, y: player.y, w: 9, h: 12 }); },
      sign: () => { nextSign = 0; },
      hole: () => { holes.push({ x: player.x + 1, y: player.y - 40, w: 12, h: 6 }); },
      ready: () => { flashCD = 0; },
      state: () => ({ t: Math.round(t), callT: +callT.toFixed(1), cityT: +cityT.toFixed(1), flashT: +flashT.toFixed(1), flashCD: Math.ceil(flashCD), rain, x: Math.round(player.x), road: [roadX, roadX + ROAD_W] }),
    },
    set onGameOver(fn) { onOver = fn; },
    set onFlashUI(fn) { onFlashUI = fn; },
    get running() { return running; },
  };
})();
