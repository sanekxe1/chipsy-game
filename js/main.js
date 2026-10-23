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

  const ITEM_NAMES = { chipsPack: 'ЧИПСЫ', kibble: 'КОРМ' };
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
    } else if (mobileTg && tgVer('8.0')) {
      safe(() => tg.lockOrientation());
    }
    if (Game.running) Game.layout(false);
  }
  window.addEventListener('resize', onOrientation);

  // Отступы Telegram (кнопки в полноэкранном режиме) передаём игре, чтобы HUD не прятался под ними
  function readSafe() {
    const cs = getComputedStyle(document.documentElement);
    const px = n => parseFloat(cs.getPropertyValue(n)) || 0;
    Game.setSafe({
      top: px('--tg-safe-area-inset-top') + px('--tg-content-safe-area-inset-top'),
      left: px('--tg-safe-area-inset-left'),
      right: px('--tg-safe-area-inset-right'),
    });
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
    c.drawImage(SPR.chipsPack, 137, gy - 62);
    c.drawImage(SPR.sasha.run[0], 100, gy - SPR.sasha.run[0].height + 1);
    c.drawImage(SPR.sonya.run[1], 118, gy - SPR.sonya.run[1].height + 1);
    c.drawImage(SPR.chips.run[0], 160, gy - SPR.chips.run[0].height + 1);
    c.drawImage(SPR.kibble, 182, gy - 10);
    drawInto($('#tile-icon'), SPR.chipsPack, null);
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

  function renderMode() {
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
    enterGame();
    Game.startEndless(hero);
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
  Game.onGameOver = r => {
    $('#o-score').textContent = r.score;
    $('#o-best').textContent = r.best;
    $('#o-items').textContent = r.collected;
    $('#o-item-label').textContent = ITEM_NAMES[Game.CHARS[r.charId].item];
    $('#o-dist').textContent = r.dist + ' м';
    $('#o-new').classList.toggle('show', r.isNew);
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
    const hasNext = r.won && r.idx + 1 < LEVELS[r.hero].length;
    $('#l-next').style.display = hasNext ? '' : 'none';
    $('#ov-level').classList.add('show');
  };

  // ---------- Кнопки ----------
  function updateSoundLabels() {
    const txt = 'ЗВУК: ' + (Sound.enabled ? 'ВКЛ' : 'ВЫКЛ');
    $('#btn-sound').textContent = txt;
    $('#p-sound').textContent = txt;
  }
  const toggleSound = () => { Sound.init(); Sound.toggle(); Sound.play('click'); updateSoundLabels(); };

  $('#btn-sound').addEventListener('click', toggleSound);
  $('#p-sound').addEventListener('click', toggleSound);
  $('#tile-chips').addEventListener('click', () => { Sound.init(); Sound.play('click'); show('select'); });
  $('#m-levels').addEventListener('click', () => { Sound.play('click'); show('levels'); });
  $('#m-endless').addEventListener('click', startEndless);
  $('#btn-pause').addEventListener('click', doPause);
  $('#p-resume').addEventListener('click', () => { $('#ov-pause').classList.remove('show'); Game.resume(); });
  $('#p-menu').addEventListener('click', exitGame);
  $('#o-again').addEventListener('click', startEndless);
  $('#o-back').addEventListener('click', exitGame);
  $('#l-again').addEventListener('click', () => startLevel(lastLevel));
  $('#l-next').addEventListener('click', () => startLevel(lastLevel + 1));
  $('#l-list').addEventListener('click', exitGame);

  // Удержание экранных кнопок (мультитач: можно держать «вперёд» и жать прыжок)
  function hold(el, key) {
    const on = e => {
      e.preventDefault();
      if (key === 'jump' && !Game.input.jump) Game.input.jumpBuf = 0.12;
      Game.input[key] = true;
      el.classList.add('down');
    };
    const off = e => {
      e.preventDefault();
      Game.input[key] = false;
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

  // Клавиатура (для ПК / Telegram Desktop)
  const KEYS = { ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right', Space: 'jump', ArrowUp: 'jump', KeyW: 'jump' };
  window.addEventListener('keydown', e => {
    if (current !== 'game') return;
    if (e.code === 'Escape' || e.code === 'KeyP') { doPause(); return; }
    const k = KEYS[e.code];
    if (!k) return;
    e.preventDefault();
    if (k === 'jump' && !Game.input.jump) Game.input.jumpBuf = 0.12;
    Game.input[k] = true;
  });
  window.addEventListener('keyup', e => {
    const k = KEYS[e.code];
    if (k) Game.input[k] = false;
  });

  document.addEventListener('visibilitychange', () => { if (document.hidden && current === 'game') doPause(); });

  updateSoundLabels();
  drawMenuScene();
  onOrientation();
})();
