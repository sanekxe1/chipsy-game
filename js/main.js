'use strict';
// Экраны, управление и интеграция с Telegram Mini App.
(() => {
  const $ = s => document.querySelector(s);
  const tg = window.Telegram && window.Telegram.WebApp;
  const tgVer = v => !!(tg && tg.isVersionAtLeast && tg.isVersionAtLeast(v));
  const safe = fn => { try { fn(); } catch (e) { /* старый клиент Telegram */ } };
  const mobileTg = tg && ['ios', 'android'].includes(tg.platform);

  if (tg) {
    safe(() => tg.ready());
    safe(() => tg.expand());
    if (tgVer('7.7')) safe(() => tg.disableVerticalSwipes());
    if (tgVer('6.1')) {
      safe(() => tg.setHeaderColor('#6fd0f5'));
      safe(() => tg.setBackgroundColor('#6fd0f5'));
    }
    // на телефоне — во весь экран, без шапки Telegram
    if (mobileTg && tgVer('8.0')) safe(() => tg.requestFullscreen());
  }
  window.haptic = type => {
    if (tgVer('6.1') && tg.HapticFeedback) safe(() => tg.HapticFeedback.impactOccurred(type));
  };

  const ITEM_NAMES = { chip: 'ЧИПСЫ', kibble: 'КОРМ' };
  const HERO_INFO = {
    sasha: 'Мир: Волга<br>Бустер: мотоцикл',
    sonya: 'Мир: Город<br>Бустер: энергетик',
    chips: 'Мир: Квартира<br>Бустер: пёрышко<br>Прыгает выше всех',
  };

  let current = 'menu';
  let hero = 'sasha';
  let lastLevel = 0;
  let previewTimer = 0;

  // ---------- Ориентация ----------
  const isPortrait = () => window.matchMedia('(orientation: portrait) and (pointer: coarse)').matches;
  function onOrientation() {
    if (isPortrait()) {
      if (current === 'game') doPause();
      if (current === 'toly-game') tolyPause();
    } else if (mobileTg && tgVer('8.0')) {
      safe(() => tg.lockOrientation());
    }
    if (Game.running) Game.layout(false);
    if (Toly.running) Toly.layout(false);
    if (Trap.running) Trap.layout();
  }
  window.addEventListener('resize', onOrientation);

  // Отступы Telegram (кнопки в полноэкранном режиме) передаём игре, чтобы HUD не прятался под ними
  function readSafe() {
    const cs = getComputedStyle(document.documentElement);
    const px = n => parseFloat(cs.getPropertyValue(n)) || 0;
    const s = {
      top: px('--tg-safe-area-inset-top') + px('--tg-content-safe-area-inset-top'),
      left: px('--tg-safe-area-inset-left'),
      right: px('--tg-safe-area-inset-right'),
    };
    Game.setSafe(s);
    Toly.setSafe(Object.assign({}, s));
  }
  if (tg && tg.onEvent) {
    safe(() => tg.onEvent('safeAreaChanged', readSafe));
    safe(() => tg.onEvent('contentSafeAreaChanged', readSafe));
    safe(() => tg.onEvent('fullscreenChanged', readSafe));
  }

  // ---------- Экраны ----------
  function show(name) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    $('#scr-' + name).classList.add('active');
    current = name;
    clearInterval(previewTimer);
    if (name === 'select') renderHeroes();
    if (name === 'mode') renderMode();
    if (name === 'levels') renderLevels();
    if (name === 'toly') renderToly();
    if (name === 'trap') Trap.start(); else if (Trap.running) Trap.stop();
    if (tgVer('6.1')) safe(() => (name === 'menu' ? tg.BackButton.hide() : tg.BackButton.show()));
  }

  const overlayOpen = () => document.querySelector('.overlay.show');
  function hideOverlays() { document.querySelectorAll('.overlay').forEach(o => o.classList.remove('show')); }

  function goBack() {
    Sound.play('click');
    if (current === 'select') show('menu');
    else if (current === 'mode') show('select');
    else if (current === 'levels') show('mode');
    else if (current === 'game') {
      if (overlayOpen()) exitGame();
      else doPause();
    } else if (current === 'toly' || current === 'trap') show('menu');
    else if (current === 'toly-game') {
      if (overlayOpen()) tolyExit();
      else tolyPause();
    }
  }
  if (tgVer('6.1')) safe(() => tg.BackButton.onClick(goBack));
  document.querySelectorAll('[data-back]').forEach(b => b.addEventListener('click', () => { Sound.play('click'); show(b.dataset.back); }));

  // ---------- Отрисовка спрайтов в DOM-канвасы ----------
  function drawInto(cv, img, bg) {
    const c = cv.getContext('2d');
    c.imageSmoothingEnabled = false;
    c.fillStyle = bg || '#8fdcf7';
    if (bg === null) c.clearRect(0, 0, cv.width, cv.height); else c.fillRect(0, 0, cv.width, cv.height);
    c.drawImage(img, Math.round((cv.width - img.width) / 2), Math.round(cv.height - img.height - 3));
  }

  const heroBg = id => Worlds.sky(Game.CHARS[id].world);

  function drawMenuScene() {
    const cv = $('#menu-scene');
    const c = cv.getContext('2d');
    c.imageSmoothingEnabled = false;
    const gy = cv.height - 16;
    c.clearRect(0, 0, cv.width, cv.height);
    c.drawImage(SPR.hills[0], 200, gy - SPR.hills[0].height + 2);
    c.drawImage(SPR.bushes[0], 10, gy - SPR.bushes[0].height + 1);
    c.drawImage(SPR.bushes[1], 270, gy - SPR.bushes[1].height + 1);
    for (let x = 0; x < cv.width; x += 16) c.drawImage(SPR.world.volga.top, x, gy);
    c.drawImage(SPR.q[0], 132, gy - 46);
    c.drawImage(SPR.chip, 136, gy - 58);
    c.drawImage(SPR.sasha.run[0], 100, gy - SPR.sasha.run[0].height + 1);
    c.drawImage(SPR.sonya.run[1], 118, gy - SPR.sonya.run[1].height + 1);
    c.drawImage(SPR.chips.run[0], 160, gy - SPR.chips.run[0].height + 1);
    c.drawImage(SPR.kibble, 182, gy - 10);
    drawInto($('#tile-icon'), SPR.chipsPack, null);
    drawInto($('#tile-toly-icon'), TSPR.granta, null);
    // иконка «Трэп хаты»: домик с дымком
    const ti = $('#tile-trap-icon').getContext('2d');
    ti.fillStyle = '#1b1626'; ti.fillRect(2, 6, 12, 9); ti.fillRect(1, 5, 14, 2); ti.fillRect(4, 3, 8, 2); ti.fillRect(6, 1, 4, 2);
    ti.fillStyle = '#d9a76e'; ti.fillRect(3, 7, 10, 7);
    ti.fillStyle = '#e33b2e'; ti.fillRect(2, 5, 12, 1); ti.fillRect(5, 3, 6, 2); ti.fillRect(7, 2, 2, 1);
    ti.fillStyle = '#4cc3f0'; ti.fillRect(4, 8, 3, 3);
    ti.fillStyle = '#6b4420'; ti.fillRect(9, 9, 3, 5);
    ti.fillStyle = '#c9ced6'; ti.fillRect(12, 0, 1, 1); ti.fillRect(13, 1, 1, 1);
    drawInto($('#rotate-cat'), SPR.chips.run[0], null);
  }

  function animate(list) {
    let f = 0;
    const tick = () => {
      f++;
      for (const [cv, id] of list) {
        const set = SPR[id];
        const img = id === 'sasha' && (f % 16) >= 10 ? set.moto[f % 2] : set.run[f % 2];
        drawInto(cv, img, heroBg(id));
      }
    };
    tick();
    previewTimer = setInterval(tick, 160);
  }

  function renderHeroes() {
    const box = $('#heroes');
    box.innerHTML = '';
    const canvases = [];
    for (const id of Object.keys(Game.CHARS)) {
      const c = Game.CHARS[id];
      const b = document.createElement('button');
      b.className = 'card';
      b.innerHTML =
        '<canvas width="30" height="25"></canvas>' +
        '<div class="card-name">' + c.name.toUpperCase() + '</div>' +
        '<div class="card-info">' + HERO_INFO[id] + '</div>' +
        '<div class="card-best"><i class="st">★</i> ' + Progress.total(id) + ' · рекорд ' + Records.get(id) + '</div>';
      b.addEventListener('click', () => { Sound.init(); Sound.play('click'); hero = id; show('mode'); });
      box.appendChild(b);
      canvases.push([b.querySelector('canvas'), id]);
    }
    animate(canvases);
  }

  function renderBank() {
    const b = Bank.get();
    $('#bank-coins').textContent = b.coins;
    $('#starts').textContent = b.starts;
    $('#buy-start').disabled = b.coins < Bank.START_PRICE;
    $('#use-start-row').classList.toggle('off', b.starts < 1);
    if (b.starts < 1) $('#use-start').checked = false;
  }

  function renderMode() {
    renderBank();
    drawInto($('#bank-icon'), Game.CHARS[hero].item === 'kibble' ? SPR.kibble : SPR.chip, null);
    $('#mode-title').textContent = Game.CHARS[hero].name.toUpperCase();
    $('#m-levels-desc').innerHTML = '<i class="st">★</i> ' + Progress.total(hero) + ' из ' + LEVELS[hero].length * 3;
    $('#m-endless-desc').textContent = 'рекорд: ' + Records.get(hero);
    animate([[$('#mode-hero'), hero]]);
  }

  function renderLevels() {
    $('#levels-title').textContent = 'УРОВНИ · ' + Game.CHARS[hero].name.toUpperCase();
    const box = $('#levels');
    box.innerHTML = '';
    const p = Progress.get(hero);
    LEVELS[hero].forEach((lv, i) => {
      const open = Progress.unlocked(hero, i);
      const st = p.stars[i] || 0;
      const b = document.createElement('button');
      b.className = 'card lvl' + (open ? '' : ' lock');
      b.innerHTML =
        '<div class="num">' + (open ? i + 1 : '🔒') + '</div>' +
        '<div class="card-name">' + lv.name.toUpperCase() + '</div>' +
        '<div class="lvl-stars"><b>' + '★'.repeat(st) + '</b>' + '★'.repeat(3 - st) + '</div>' +
        (lv.escape ? '<div class="tag">ПОБЕГ</div>' : '');
      b.addEventListener('click', () => {
        if (!open) { Sound.play('bump'); return; }
        startLevel(i);
      });
      box.appendChild(b);
    });
  }

  // ---------- Тольяттинская суета ----------
  function renderToly() {
    $('#toly-desc').textContent = 'рекорд: ' + Toly.Rec.get() + ' · монет: ' + Toly.Rec.coins();
    const cv = $('#toly-hero'), c = cv.getContext('2d');
    c.imageSmoothingEnabled = false;
    c.fillStyle = '#5cae3c'; c.fillRect(0, 0, cv.width, cv.height);
    c.fillStyle = '#4a4a52'; c.fillRect(22, 0, 22, cv.height);
    c.fillStyle = '#f2f2f2'; for (let y = 1; y < cv.height; y += 8) c.fillRect(32, y, 1, 4);
    c.drawImage(TSPR.savely, 5, cv.height - TSPR.savely.height - 2);
    c.drawImage(TSPR.granta, 24, 2);
  }

  function tolyStart() {
    Sound.init();
    hideOverlays();
    show('toly-game');
    readSafe();
    Toly.start();
  }
  function tolyPause() {
    if (Toly.pause()) { updateSoundLabels(); $('#t-ov-pause').classList.add('show'); }
  }
  function tolyExit() {
    Toly.stop();
    hideOverlays();
    show('toly');
  }
  Toly.init($('#cv2'), $('#stage2'));
  Trap.init($('#cv3'), $('#stage3'));
  $('#tile-trap').addEventListener('click', () => { Sound.init(); Sound.play('click'); show('trap'); });
  Toly.onGameOver = r => {
    $('#t-score').textContent = r.score;
    $('#t-best').textContent = r.best;
    $('#t-coins').textContent = r.coins;
    $('#t-dist').textContent = r.dist + ' м';
    $('#t-scr').textContent = r.scrapes;
    $('#t-new').classList.toggle('show', r.isNew);
    $('#t-total').textContent = 'Монет всего: ' + r.total;
    $('#t-ov-over').classList.add('show');
    if (r.isNew) window.haptic('heavy');
  };
  // дальний свет: кнопка показывает, через сколько секунд снова можно моргнуть
  Toly.onFlashUI = v => {
    const b = $('#t-flash');
    b.classList.toggle('cooldown', v > 0);
    b.classList.toggle('active', v < 0);
    $('#t-flash-txt').textContent = v > 0 ? v + ' С' : v < 0 ? 'ВКЛ' : 'ДАЛЬНИЙ';
  };
  $('#t-flash').addEventListener('pointerdown', e => { e.preventDefault(); if (!Toly.flash()) Sound.play('bump'); });
  $('#tile-toly').addEventListener('click', () => { Sound.init(); Sound.play('click'); show('toly'); });
  $('#toly-go').addEventListener('click', tolyStart);
  $('#t-pause').addEventListener('click', tolyPause);
  $('#t-resume').addEventListener('click', () => { $('#t-ov-pause').classList.remove('show'); Toly.resume(); });
  $('#t-exit').addEventListener('click', tolyExit);
  $('#t-again').addEventListener('click', tolyStart);
  $('#t-back').addEventListener('click', tolyExit);

  // ---------- Игра ----------
  function enterGame() {
    Sound.init();
    hideOverlays();
    show('game');
    readSafe();
  }

  function startLevel(i) {
    lastLevel = i;
    enterGame();
    Game.startLevel(hero, i);
  }

  function startEndless() {
    const headStart = $('#use-start').checked && Bank.useStart();
    enterGame();
    Game.startEndless(hero, headStart);
  }

  function doPause() {
    if (Game.pause()) {
      updateSoundLabels();
      $('#ov-pause').classList.add('show');
    }
  }

  function exitGame() {
    Game.stop();
    hideOverlays();
    show(Game.mode === 'level' ? 'levels' : 'mode');
  }

  Game.init($('#cv'), $('#stage'));
  // водка: экранные кнопки меняются местами, на клавиатуре — стрелки
  let swapped = false;
  Game.onSwap = on => {
    swapped = on;
    Game.input.left = Game.input.right = false;
    document.querySelectorAll('.ctl.down').forEach(b => b.classList.remove('down'));
    $('#controls').classList.toggle('swapped', on);
  };
  Game.onGameOver = r => {
    $('#o-score').textContent = r.score;
    $('#o-best').textContent = r.best;
    $('#o-items').textContent = r.collected;
    $('#o-item-label').textContent = ITEM_NAMES[Game.CHARS[r.charId].item];
    $('#o-dist').textContent = r.dist + ' м';
    $('#o-new').classList.toggle('show', r.isNew);
    $('#o-bank').textContent = '+' + r.collected + ' в копилку · всего ' + Bank.get().coins;
    $('#ov-over').classList.add('show');
    if (r.isNew) window.haptic('heavy');
  };
  Game.onLevelEnd = r => {
    const fmt = s => Math.floor(s / 60) + ':' + String(Math.floor(s % 60)).padStart(2, '0');
    $('#l-title').textContent = r.won ? 'УРОВЕНЬ ПРОЙДЕН!' : 'НЕ ПОЛУЧИЛОСЬ';
    $('#l-stars').innerHTML = '<b>' + '★'.repeat(r.stars) + '</b>' + '★'.repeat(3 - r.stars);
    $('#l-stars').style.display = r.won ? '' : 'none';
    $('#l-time').textContent = fmt(r.time);
    $('#l-item-label').textContent = ITEM_NAMES[Game.CHARS[r.hero].item];
    $('#l-items').textContent = r.collected + '/' + r.total;
    $('#l-hint').textContent = r.won
      ? 'Звёзды: финиш · 80% ' + ITEM_NAMES[Game.CHARS[r.hero].item].toLowerCase() + ' · ' + (r.escape ? 'без потери жизней' : 'быстрее ' + fmt(r.par))
      : 'Попробуй ещё раз — у тебя получится!';
    $('#l-bank').textContent = '+' + r.collected + ' в копилку · всего ' + Bank.get().coins;
    const hasNext = r.won && r.idx + 1 < LEVELS[r.hero].length;
    $('#l-next').style.display = hasNext ? '' : 'none';
    $('#ov-level').classList.add('show');
  };

  // ---------- Кнопки ----------
  function updateSoundLabels() {
    const txt = 'ЗВУК: ' + (Sound.enabled ? 'ВКЛ' : 'ВЫКЛ');
    $('#btn-sound').textContent = txt;
    $('#p-sound').textContent = txt;
    $('#t-sound').textContent = txt;
  }
  const toggleSound = () => { Sound.init(); Sound.toggle(); Sound.play('click'); updateSoundLabels(); };

  $('#btn-sound').addEventListener('click', toggleSound);
  $('#p-sound').addEventListener('click', toggleSound);
  $('#t-sound').addEventListener('click', toggleSound);
  $('#tile-chips').addEventListener('click', () => { Sound.init(); Sound.play('click'); show('select'); });
  $('#m-levels').addEventListener('click', () => { Sound.play('click'); show('levels'); });
  $('#m-endless').addEventListener('click', startEndless);
  $('#buy-start').addEventListener('click', () => {
    if (Bank.buyStart()) { Sound.play('boost'); window.haptic('medium'); $('#use-start').checked = true; }
    else Sound.play('bump');
    renderBank();
  });
  $('#use-start').addEventListener('change', () => Sound.play('click'));
  $('#btn-pause').addEventListener('click', doPause);
  $('#p-resume').addEventListener('click', () => { $('#ov-pause').classList.remove('show'); Game.resume(); });
  $('#p-menu').addEventListener('click', exitGame);
  $('#o-again').addEventListener('click', startEndless);
  $('#o-back').addEventListener('click', exitGame);
  $('#l-again').addEventListener('click', () => startLevel(lastLevel));
  $('#l-next').addEventListener('click', () => startLevel(lastLevel + 1));
  $('#l-list').addEventListener('click', exitGame);

  // Удержание экранных кнопок (мультитач: можно держать «вперёд» и жать прыжок)
  function hold(el, key, inp) {
    inp = inp || Game.input;
    const on = e => {
      e.preventDefault();
      if (key === 'jump' && !inp.jump) inp.jumpBuf = 0.12;
      inp[key] = true;
      el.classList.add('down');
    };
    const off = e => {
      e.preventDefault();
      inp[key] = false;
      el.classList.remove('down');
    };
    el.addEventListener('pointerdown', on);
    el.addEventListener('pointerup', off);
    el.addEventListener('pointercancel', off);
    el.addEventListener('pointerleave', off);
    el.addEventListener('contextmenu', e => e.preventDefault());
  }
  hold($('#b-left'), 'left');
  hold($('#b-right'), 'right');
  hold($('#b-jump'), 'jump');
  hold($('#t-left'), 'left', Toly.input);
  hold($('#t-right'), 'right', Toly.input);

  // Клавиатура (для ПК / Telegram Desktop)
  const KEYS = { ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right', Space: 'jump', ArrowUp: 'jump', KeyW: 'jump' };
  window.addEventListener('keydown', e => {
    if (current === 'toly-game') {
      if (e.code === 'Escape' || e.code === 'KeyP') { tolyPause(); return; }
      const k = KEYS[e.code];
      if (k === 'left' || k === 'right') { e.preventDefault(); Toly.input[k] = true; }
      if (k === 'jump' && !e.repeat) { e.preventDefault(); Toly.flash(); }
      return;
    }
    if (current !== 'game') return;
    if (e.code === 'Escape' || e.code === 'KeyP') { doPause(); return; }
    let k = KEYS[e.code];
    if (!k) return;
    if (swapped && k !== 'jump') k = k === 'left' ? 'right' : 'left';
    e.preventDefault();
    if (k === 'jump' && !Game.input.jump) Game.input.jumpBuf = 0.12;
    Game.input[k] = true;
  });
  window.addEventListener('keyup', e => {
    let k = KEYS[e.code];
    if (!k) return;
    if (k === 'left' || k === 'right') Toly.input[k] = false;
    if (swapped && k !== 'jump') k = k === 'left' ? 'right' : 'left';
    Game.input[k] = false;
  });

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) return;
    if (current === 'game') doPause();
    if (current === 'toly-game') tolyPause();
  });

  updateSoundLabels();
  drawMenuScene();
  onOrientation();
})();
