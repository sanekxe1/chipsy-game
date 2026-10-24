'use strict';
// «Тольяттинская суета»: Гранта едет по четырёхполосной трассе (вид сверху),
// игрок рулит влево-вправо, обгоняет попутных и уворачивается от встречных.
// Задел боком — царапина, игра идёт дальше; врезался — авария, конец.

const Toly = (() => {
  const H = 180;
  const LANE = 28, LANES = 4, ROAD_W = LANE * LANES + 8;
  const STEER = 120;           // скорость руления, px/с
  const PLAYER_BOTTOM = H - 14;
  const TRAFFIC = [            // вид, вес, скорость попутной/встречной (px/с)
    { kind: 'priora', w: 30, same: [55, 85], opp: [70, 100] },
    { kind: 'gle', w: 15, same: [65, 95], opp: [80, 110] },
    { kind: 'm5', w: 14, same: [75, 105], opp: [90, 120] },
    { kind: 'porsche', w: 10, same: [85, 115], opp: [100, 130] },
    { kind: 'kamaz', w: 11, same: [40, 60], opp: [55, 75] },
    { kind: 'moto', w: 12, same: [70, 100], opp: [80, 110] },
  ];

  let canvas, ctx, stage, W = 360, S = 2, safe = { top: 0 };
  let running = false, paused = false, raf = 0, last = 0;
  let t, dist, speed, slow, coins, scrapes, roadX, player, cars, coinsList, parts, texts, deco;
  let nextCar, nextCoin, nextDeco, crashed, crashT, shakeT, banner, best, countdown, scrapeCD;
  const input = { left: false, right: false };
  let onOver = null;

  const rnd = (a, b) => a + Math.random() * (b - a);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const haptic = type => window.haptic && window.haptic(type);
  const laneX = i => roadX + 4 + i * LANE + LANE / 2;
  const score = () => Math.floor(dist / 8) + coins * 10;
  const hit = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

  const Rec = {
    get() { try { return parseInt(localStorage.getItem('toly_best'), 10) || 0; } catch (e) { return 0; } },
    set(v) { try { localStorage.setItem('toly_best', String(v)); } catch (e) { /* нет доступа */ } },
    coins() { try { return parseInt(localStorage.getItem('toly_coins'), 10) || 0; } catch (e) { return 0; } },
    addCoins(n) { try { localStorage.setItem('toly_coins', String(this.coins() + n)); } catch (e) { /* нет доступа */ } },
  };

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
    t = 0; dist = 0; speed = 0; slow = 1; coins = 0; scrapes = 0;
    cars = []; coinsList = []; parts = []; texts = []; deco = [];
    nextCar = 120; nextCoin = 60; nextDeco = 0;
    crashed = false; crashT = 0; shakeT = 0; scrapeCD = 0;
    countdown = 3.4;
    banner = null;
    best = Rec.get();
    player = { x: laneX(2) - 7, y: PLAYER_BOTTOM - 24, w: 14, h: 24, vx: 0, spin: 0 };
    input.left = input.right = false;
    for (let y = -40; y < H + 20; y += 10) addDeco(y);
    running = true; paused = false;
    last = performance.now();
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(frame);
    Sound.play('tick');
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

  // ---------------- Мир ----------------
  function addDeco(y) {
    const side = Math.random() < 0.5 ? -1 : 1;
    const edge = side < 0 ? roadX - 10 : roadX + ROAD_W + 10;
    const far = side < 0 ? 4 : W - 4;
    const x = rnd(Math.min(edge, far), Math.max(edge, far));
    const r = Math.random();
    let kind;
    if (Math.abs(x - (side < 0 ? roadX : roadX + ROAD_W)) < 16 && r < 0.25) kind = 'lamp';
    else if (r < 0.06) kind = 'sign';
    else if (r < 0.1) kind = 'billboard';
    else if (r < 0.2) kind = 'house';
    else kind = 'tree';
    if (kind === 'lamp') deco.push({ kind, x: side < 0 ? roadX - 6 : roadX + ROAD_W + 4, y, side });
    else if (kind === 'sign' || kind === 'billboard') deco.push({ kind, x: side < 0 ? roadX - 50 : roadX + ROAD_W + 10, y, side });
    else deco.push({ kind, x, y, v: Math.floor(Math.random() * 3), c: Math.floor(Math.random() * 4) });
  }

  function lanesBlocked(y) {
    // сколько полос занято рядом по высоте — чтобы всегда оставался проезд
    const busy = new Set();
    for (const c of cars) if (Math.abs(c.y - y) < 70) busy.add(c.lane);
    return busy;
  }

  function spawnCar() {
    const d = Math.min(1, dist / 30000);
    let total = TRAFFIC.reduce((a, b) => a + b.w, 0), r = Math.random() * total, def = TRAFFIC[0];
    for (const tr of TRAFFIC) { r -= tr.w; if (r <= 0) { def = tr; break; } }
    const busy = lanesBlocked(-60);
    if (busy.size >= 2) return;
    // попутные полосы — правые (2, 3), встречные — левые (0, 1)
    const opp = Math.random() < 0.35 + 0.15 * d;
    const lanes = (opp ? [0, 1] : [2, 3]).filter(l => !busy.has(l));
    if (!lanes.length) return;
    const lane = lanes[Math.floor(Math.random() * lanes.length)];
    const variants = TSPR.cars[def.kind];
    const v = variants[Math.floor(Math.random() * variants.length)];
    const img = v[opp ? 1 : 0];
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

    if (crashed) {
      crashT -= dt;
      speed = Math.max(0, speed - 300 * dt);
      player.spin += dt * 9;
      if (Math.random() < dt * 30) parts.push({ x: player.x + 7 + rnd(-4, 4), y: player.y + 12, vx: rnd(-20, 20), vy: rnd(-40, -10), life: 0.8, color: Math.random() < 0.5 ? '#5b5466' : '#2a2a33', size: 3 });
      if (crashT <= 0) { finish(); return; }
    } else {
      // скорость растёт со временем; после царапины машина ненадолго притормаживает
      slow = Math.min(1, slow + dt * 0.6);
      speed = (100 + 170 * (1 - Math.exp(-t / 70))) * slow;
    }
    const dy = speed * dt;
    dist += dy;

    // руление
    if (!crashed) {
      const dir = (input.right ? 1 : 0) - (input.left ? 1 : 0);
      player.vx += (dir * STEER - player.vx) * Math.min(1, dt * 12);
      player.x += player.vx * dt;
      const minX = roadX + 3, maxX = roadX + ROAD_W - 3 - player.w;
      if (player.x < minX || player.x > maxX) {
        player.x = clamp(player.x, minX, maxX);
        scrape(player.x < minX + 1 ? player.x : player.x + player.w, player.y + 12, true);
      }
    }

    // обочина
    for (const dcr of deco) dcr.y += dy;
    deco = deco.filter(o => o.y < H + 60);
    nextDeco -= dy;
    while (nextDeco <= 0) { addDeco(-30 - Math.random() * 20); nextDeco += 10; }

    // трафик: попутные едут медленнее нас, встречные — навстречу
    for (const c of cars) {
      c.y += c.opp ? dy + c.v * dt : dy - c.v * dt * slow;
      if (c.kind === 'moto') c.x = laneX(c.lane) - c.w / 2 + Math.sin(t * 2 + c.wob) * 5;
    }
    // в одной полосе машины не проезжают сквозь друг друга: догнавший тормозит
    for (const a of cars) {
      for (const b of cars) {
        if (a === b || a.lane !== b.lane || a.opp !== b.opp) continue;
        // лидер — тот, кто едет впереди по своему направлению
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
      nextCar = rnd(50, 105) * (1 - 0.45 * d);
    }

    // монетки
    for (const cn of coinsList) cn.y += dy;
    nextCoin -= dy;
    if (nextCoin <= 0) { spawnCoins(); nextCoin = rnd(220, 420); }
    if (!crashed) {
      for (const cn of coinsList) {
        if (!cn.taken && hit(player, cn)) {
          cn.taken = true; coins++;
          texts.push({ x: cn.x + 4, y: cn.y, text: '+10', life: 0.7 });
          Sound.play('coin');
        }
      }
    }
    coinsList = coinsList.filter(c => !c.taken && c.y < H + 20);

    // столкновения
    if (!crashed) {
      for (const c of cars) {
        if (!hit(player, c)) continue;
        const ox = Math.min(player.x + player.w, c.x + c.w) - Math.max(player.x, c.x);
        if (ox <= 6) {
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
      ctx.fillStyle = '#1b1626'; ctx.fillRect(x - 1, y - 1, 42, 12);
      ctx.fillStyle = '#2b5fbf'; ctx.fillRect(x, y, 40, 10);
      text('ТОЛЬЯТТИ', x + 20, y + 3, 4, '#ffffff', 'center');
    } else if (o.kind === 'billboard') {
      ctx.fillStyle = '#1b1626'; ctx.fillRect(x - 1, y - 1, 42, 18);
      ctx.fillStyle = '#ffffff'; ctx.fillRect(x, y, 40, 16);
      ctx.fillStyle = '#2b5fbf'; ctx.fillRect(x, y, 40, 3);
      text('LADA', x + 20, y + 5, 6, '#2b5fbf', 'center');
    }
  }

  function drawRoad() {
    const x0 = roadX;
    ctx.fillStyle = '#1b1626'; ctx.fillRect(x0 - 2, -4, ROAD_W + 4, H + 8);
    ctx.fillStyle = '#9a9488'; ctx.fillRect(x0 - 1, -4, ROAD_W + 2, H + 8);
    ctx.fillStyle = '#4a4a52'; ctx.fillRect(x0 + 2, -4, ROAD_W - 4, H + 8);
    // крошка асфальта
    ctx.fillStyle = '#56565f';
    const off = dist % 64;
    for (let i = 0; i < 40; i++) {
      const px = x0 + 4 + ((i * 37) % (ROAD_W - 8));
      const py = ((i * 53 + off * 2) % (H + 64)) - 32;
      ctx.fillRect(px, Math.round(py), 2, 1);
    }
    // разметка: края сплошные, двойная сплошная по центру, пунктир между полосами
    ctx.fillStyle = '#f2f2f2';
    ctx.fillRect(x0 + 3, -4, 1, H + 8);
    ctx.fillRect(x0 + ROAD_W - 4, -4, 1, H + 8);
    const mid = x0 + 4 + 2 * LANE;
    ctx.fillRect(mid - 2, -4, 1, H + 8);
    ctx.fillRect(mid + 1, -4, 1, H + 8);
    const dash = dist % 24;
    for (const lx of [x0 + 4 + LANE, x0 + 4 + 3 * LANE]) {
      for (let y = -24 + dash; y < H; y += 24) ctx.fillRect(lx, Math.round(y), 1, 12);
    }
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

    // предупреждение о встречке у верхнего края
    for (const c of cars) {
      if (c.opp && c.y < -4 && c.y > -90 && Math.floor(t * 8) % 2) {
        const cx = Math.round(c.x + c.w / 2);
        ctx.fillStyle = '#e33b2e';
        ctx.fillRect(cx - 3, 2, 7, 2); ctx.fillRect(cx - 2, 4, 5, 2); ctx.fillRect(cx - 1, 6, 3, 2);
      }
    }
    for (const cn of coinsList) ctx.drawImage(TSPR.coin[Math.floor(t * 6 + cn.y / 40) % 2 ? 1 : 0], Math.round(cn.x + (Math.floor(t * 6 + cn.y / 40) % 2 ? 1 : 0)), Math.round(cn.y));
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

    for (const q of parts) { ctx.fillStyle = q.color; ctx.fillRect(Math.round(q.x), Math.round(q.y), q.size, q.size); }
    for (const tx of texts) {
      ctx.globalAlpha = Math.min(1, tx.life * 2);
      text(tx.text, Math.round(tx.x), Math.round(tx.y), 5, '#ffd23f', 'center');
      ctx.globalAlpha = 1;
    }
    drawHUD();
  }

  function drawHUD() {
    const top = Math.round(safe.topL || 0) + 6;
    const lx = 8, rx = W - 8;
    text(String(score()), lx, top, 8, '#ffffff', 'left');
    text('РЕКОРД ' + Math.max(best, score()), lx, top + 11, 5, '#ffe08a', 'left');
    ctx.drawImage(TSPR.coin[0], lx, top + 20);
    text('x' + coins, lx + 12, top + 22, 6, '#ffffff', 'left');
    text(Math.round(speed * 0.6) + ' КМ/Ч', rx - 30, top, 7, '#ffffff', 'right');
    if (countdown > 0) {
      const n = Math.ceil(countdown);
      text(n > 3 ? '3' : String(n), Math.round(W / 2), Math.round(H * 0.32), 24, '#ffd23f', 'center');
      text('ТОЛЬЯТТИНСКАЯ СУЕТА', Math.round(W / 2), Math.round(H * 0.32) + 32, 6, '#ffffff', 'center');
    }
    if (banner) {
      ctx.globalAlpha = Math.min(1, banner.t * 2);
      text(banner.text, Math.round(W / 2), Math.round(H * 0.32), 14, banner.text === 'АВАРИЯ!' ? '#e33b2e' : '#ffd23f', 'center');
      ctx.globalAlpha = 1;
    }
  }

  return {
    init, start, stop, pause, resume, layout, setSafe, input, Rec,
    set onGameOver(fn) { onOver = fn; },
    get running() { return running; },
  };
})();
