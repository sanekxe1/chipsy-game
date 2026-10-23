'use strict';
// Экраны, управление и интеграция с Telegram Mini App.
(() => {
  const $ = s => document.querySelector(s);
  const tg = window.Telegram && window.Telegram.WebApp;
  const tgVer = v => !!(tg && tg.isVersionAtLeast && tg.isVersionAtLeast(v));
  const safe = fn => { try { fn(); } catch (e) { /* старый клиент Telegram */ } };

  if (tg) {
    safe(() => tg.ready());
    safe(() => tg.expand());
    if (tgVer('7.7')) safe(() => tg.disableVerticalSwipes());
    if (tgVer('6.1')) {
      safe(() => tg.setHeaderColor('#6fd0f5'));
      safe(() => tg.setBackgroundColor('#6fd0f5'));
    }
  }
  window.haptic = type => {
    if (tgVer('6.1') && tg.HapticFeedback) safe(() => tg.HapticFeedback.impactOccurred(type));
  };

  const ITEM_NAMES = { chipsPack: 'ЧИПСЫ', kibble: 'КОРМ' };
  const HERO_INFO = {
    sasha: 'Собирает: чипсы<br>Бустер: мотоцикл',
    sonya: 'Собирает: чипсы<br>Бустер: энергетик',
    chips: 'Собирает: корм<br>Бустер: пёрышко<br>Прыгает выше всех',
  };

  let current = 'menu';
  let lastHero = 'sasha';
  let previewTimer = 0;

  // ---------- Экраны ----------
  function show(name) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    $('#scr-' + name).classList.add('active');
    current = name;
    clearInterval(previewTimer);
    if (name === 'select') renderHeroes();
    if (tgVer('6.1')) safe(() => (name === 'menu' ? tg.BackButton.hide() : tg.BackButton.show()));
  }

  function goBack() {
    Sound.play('click');
    if (current === 'select') show('menu');
    else if (current === 'game') {
      if ($('#ov-pause').classList.contains('show') || $('#ov-over').classList.contains('show')) toMenu();
      else doPause();
    }
  }
  if (tgVer('6.1')) safe(() => tg.BackButton.onClick(goBack));

  // ---------- Отрисовка спрайтов в DOM-канвасы ----------
  function drawInto(cv, img, scale) {
    const c = cv.getContext('2d');
    c.imageSmoothingEnabled = false;
    c.clearRect(0, 0, cv.width, cv.height);
    const s = scale || 1;
    c.drawImage(img, Math.round((cv.width - img.width * s) / 2), Math.round(cv.height - img.height * s - 3), img.width * s, img.height * s);
  }

  function drawMenuScene() {
    const cv = $('#menu-scene');
    const c = cv.getContext('2d');
    c.imageSmoothingEnabled = false;
    const gy = cv.height - 16;
    c.fillStyle = '#6fd0f5';
    c.fillRect(0, 0, cv.width, cv.height);
    c.drawImage(SPR.hills[0], 120, gy - SPR.hills[0].height + 2);
    c.drawImage(SPR.bushes[0], 6, gy - SPR.bushes[0].height + 1);
    c.drawImage(SPR.bushes[1], 150, gy - SPR.bushes[1].height + 1);
    for (let x = 0; x < cv.width; x += 16) c.drawImage(SPR.ground, x, gy);
    c.drawImage(SPR.q[0], 92, gy - 46);
    c.drawImage(SPR.chipsPack, 97, gy - 62);
    c.drawImage(SPR.sasha.run[0], 60, gy - SPR.sasha.run[0].height + 1);
    c.drawImage(SPR.sonya.run[1], 78, gy - SPR.sonya.run[1].height + 1);
    c.drawImage(SPR.chips.run[0], 118, gy - SPR.chips.run[0].height + 1);
    c.drawImage(SPR.kibble, 140, gy - 10);
    drawInto($('#tile-icon'), SPR.chipsPack);
  }

  function renderHeroes() {
    const box = $('#heroes');
    box.innerHTML = '';
    const canvases = [];
    for (const id of Object.keys(Game.CHARS)) {
      const c = Game.CHARS[id];
      const b = document.createElement('button');
      b.className = 'hero';
      b.innerHTML =
        '<canvas width="30" height="25"></canvas>' +
        '<div><div class="hero-name">' + c.name.toUpperCase() + '</div>' +
        '<div class="hero-info">' + HERO_INFO[id] + '</div>' +
        '<div class="hero-best">Рекорд: ' + Records.get(id) + '</div></div>';
      b.addEventListener('click', () => startGame(id));
      box.appendChild(b);
      canvases.push([b.querySelector('canvas'), id]);
    }
    let f = 0;
    const tick = () => {
      f++;
      for (const [cv, id] of canvases) {
        const set = SPR[id];
        // Саша иногда показывает мотоцикл
        const img = id === 'sasha' && (f % 16) >= 10 ? set.moto[f % 2] : set.run[f % 2];
        drawInto(cv, img);
      }
    };
    tick();
    previewTimer = setInterval(tick, 160);
  }

  // ---------- Игра ----------
  function startGame(id) {
    Sound.init();
    lastHero = id;
    $('#ov-over').classList.remove('show');
    $('#ov-pause').classList.remove('show');
    show('game');
    Game.start(id);
  }

  function doPause() {
    if (Game.pause()) {
      updateSoundLabels();
      $('#ov-pause').classList.add('show');
    }
  }

  function toMenu() {
    Game.stop();
    $('#ov-over').classList.remove('show');
    $('#ov-pause').classList.remove('show');
    show('menu');
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
  $('#sel-back').addEventListener('click', () => { Sound.play('click'); show('menu'); });
  $('#btn-pause').addEventListener('click', doPause);
  $('#p-resume').addEventListener('click', () => { $('#ov-pause').classList.remove('show'); Game.resume(); });
  $('#p-menu').addEventListener('click', toMenu);
  $('#o-again').addEventListener('click', () => startGame(lastHero));
  $('#o-heroes').addEventListener('click', () => { $('#ov-over').classList.remove('show'); show('select'); });

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
  window.addEventListener('resize', () => { if (Game.running) Game.layout(false); });

  updateSoundLabels();
  drawMenuScene();
})();
