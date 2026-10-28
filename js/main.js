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


  let current = 'menu';
  let chapter = 0;
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
    if (name === 'mode') renderMode();
    if (name === 'levels') renderLevels();
    if (name === 'toly') renderToly();
    if (name === 'rating') renderRating();
    if (name === 'trap') Trap.start(); else if (Trap.running) Trap.stop();
    if (tgVer('6.1')) safe(() => (name === 'menu' ? tg.BackButton.hide() : tg.BackButton.show()));
  }

  const overlayOpen = () => document.querySelector('.overlay.show');
  function hideOverlays() { document.querySelectorAll('.overlay').forEach(o => o.classList.remove('show')); }

  function goBack() {
    Sound.play('click');
    if (current === 'mode') show('menu');
    else if (current === 'levels') show('mode');
    else if (current === 'game') {
      if (overlayOpen()) exitGame();
      else doPause();
    } else if (current === 'toly' || current === 'trap' || current === 'rating') show('menu');
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

  // превью героя: трое по очереди, каждый на фоне своего мира
  function animate(cv) {
    let f = 0;
    const tick = () => {
      f++;
      const id = Game.HEROES[Math.floor(f / 14) % 3];
      const set = SPR[id];
      const img = id === 'sasha' && (f % 14) >= 9 ? set.moto[f % 2] : set.run[f % 2];
      drawInto(cv, img, heroBg(id));
    };
    tick();
    previewTimer = setInterval(tick, 160);
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
    drawInto($('#bank-icon'), SPR.chip, null);
    $('#m-levels-desc').innerHTML = '<i class="st">★</i> ' + Progress.total() + ' из ' + CAMPAIGN.length * 3;
    $('#m-endless-desc').textContent = 'рекорд: ' + Records.get();
    animate($('#mode-hero'));
  }

  // глава по умолчанию — та, где первый непройденный открытый уровень
  function currentChapter() {
    const p = Progress.get();
    let i = CAMPAIGN.findIndex((lv, k) => Progress.unlocked(k) && !p.stars[k]);
    if (i < 0) i = CAMPAIGN.length - 1;
    return CAMPAIGN[i].chapter;
  }

  function renderLevels(ch) {
    chapter = ch === undefined ? currentChapter() : ch;
    $('#levels-title').textContent = 'УРОВНИ';
    const tabs = $('#chapters');
    tabs.innerHTML = '';
    CHAPTERS.forEach((c, k) => {
      const b = document.createElement('button');
      b.className = 'chap' + (k === chapter ? ' on' : '');
      b.textContent = c.name;
      b.addEventListener('click', () => { Sound.play('click'); renderLevels(k); });
      tabs.appendChild(b);
    });
    $('#chapter-text').textContent = CHAPTERS[chapter].text;
    const box = $('#levels');
    box.innerHTML = '';
    const p = Progress.get();
    CAMPAIGN.forEach((lv, i) => {
      if (lv.chapter !== chapter) return;
      const open = Progress.unlocked(i);
      const st = p.stars[i] || 0;
      const b = document.createElement('button');
      b.className = 'card lvl' + (open ? '' : ' lock');
      b.innerHTML =
        '<div class="num">' + (open ? i + 1 : '🔒') + '</div>' +
        '<div class="card-name">' + lv.name.toUpperCase() + '</div>' +
        '<div class="lvl-stars"><b>' + '★'.repeat(st) + '</b>' + '★'.repeat(3 - st) + '</div>' +
        (lv.final ? '<div class="tag">ФИНАЛ</div>' : lv.escape ? '<div class="tag">ЭСТАФЕТА</div>' : '');
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
    Rating.submit('toly', r.score);
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
    Game.startLevel(i);
  }

  function startEndless() {
    const headStart = $('#use-start').checked && Bank.useStart();
    enterGame();
    Game.startEndless(headStart);
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
    Rating.submit('chips', r.score);
    $('#o-score').textContent = r.score;
    $('#o-best').textContent = r.best;
    $('#o-items').textContent = r.collected;
    $('#o-item-label').textContent = 'СОБРАНО';
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
    $('#l-item-label').textContent = 'СОБРАНО';
    $('#l-items').textContent = r.collected + '/' + r.total;
    $('#l-hint').textContent = r.won
      ? 'Звёзды: финиш · 80% добычи · ' + (r.escape ? 'без потери жизней' : 'быстрее ' + fmt(r.par))
      : 'Попробуй ещё раз — у тебя получится!';
    $('#l-bank').textContent = '+' + r.collected + ' в копилку · всего ' + Bank.get().coins;
    const hasNext = r.won && r.idx + 1 < CAMPAIGN.length;
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
  $('#btn-rating').addEventListener('click', () => { Sound.init(); Sound.play('click'); show('rating'); });

  // ---------- Общий рейтинг ----------
  const RT_GAMES = [
    { id: 'chips', name: 'ХОЧУ ЧИПСОВ', unit: 'очк.' },
    { id: 'toly', name: 'ТОЛЬЯТТИНСКАЯ СУЕТА', unit: 'очк.' },
    { id: 'trap', name: 'ТРЭП ХАТА', unit: 'дн.' },
  ];
  let rtGame = 'chips', rtReq = 0;
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  // даты текущей недели по Москве: «27.10–2.11»
  function weekDates() {
    const d = new Date(Date.now() + 3 * 3600e3), day = (d.getUTCDay() + 6) % 7;
    const mon = new Date(d.getTime() - day * 864e5), sun = new Date(mon.getTime() + 6 * 864e5);
    const f = x => x.getUTCDate() + '.' + String(x.getUTCMonth() + 1).padStart(2, '0');
    return f(mon) + '–' + f(sun);
  }
  function rtList(el, meEl, v, unit, empty) {
    el.innerHTML = v.top.length
      ? v.top.map(r => '<li class="' + (r.me ? 'me' : '') + (r.place <= 3 ? ' p' + r.place : '') + '"><b>' + r.place + '</b><span>' + esc(r.name) + '</span><i>' + r.score + ' ' + unit + '</i></li>').join('')
      : '<li class="empty">' + empty + '</li>';
    meEl.textContent = v.me && v.me.place > v.top.length ? 'Ты — ' + v.me.place + ' место (' + v.me.score + ' ' + unit + ')' : '';
  }
  function renderRating() {
    const tabs = $('#rt-tabs');
    tabs.innerHTML = '';
    for (const g of RT_GAMES) {
      const b = document.createElement('button');
      b.className = 'rt-tab' + (g.id === rtGame ? ' on' : '');
      b.textContent = g.name;
      b.addEventListener('click', () => { Sound.play('click'); rtGame = g.id; renderRating(); });
      tabs.appendChild(b);
    }
    $('#rt-week-dates').textContent = weekDates();
    const note = $('#rt-note'), all = $('#rt-all'), week = $('#rt-week');
    $('#rt-me-all').textContent = $('#rt-me-week').textContent = '';
    if (!Rating.enabled()) {
      note.textContent = 'Рейтинг скоро заработает — сервер ещё подключается.';
      all.innerHTML = week.innerHTML = '';
      return;
    }
    note.textContent = Rating.canSubmit() ? '' : 'Чтобы попасть в рейтинг, играй через Telegram.';
    all.innerHTML = week.innerHTML = '<li class="empty">Загрузка…</li>';
    const req = ++rtReq, g = RT_GAMES.find(x => x.id === rtGame);
    Rating.load(rtGame).then(d => {
      if (req !== rtReq || current !== 'rating') return;
      rtList(all, $('#rt-me-all'), d.all, g.unit, 'Пока пусто — стань первым!');
      rtList(week, $('#rt-me-week'), d.weekly, g.unit, 'На этой неделе ещё никто не играл');
    }).catch(() => {
      if (req !== rtReq) return;
      all.innerHTML = week.innerHTML = '<li class="empty">Не удалось загрузить. Проверь интернет.</li>';
    });
  }
  // рекорды, поставленные до рейтинга, — один раз в таблицу «за всё время»
  const localBest = k => { try { return parseInt(localStorage.getItem(k), 10) || 0; } catch (e) { return 0; } };
  Rating.sendLegacy({ chips: Records.get(), toly: localBest('toly_best'), trap: localBest('trap_best') });
  $('#p-sound').addEventListener('click', toggleSound);
  $('#t-sound').addEventListener('click', toggleSound);
  $('#tile-chips').addEventListener('click', () => { Sound.init(); Sound.play('click'); show('mode'); });
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
    if (!document.hidden) { if (current === 'trap' && !Trap.running) Trap.start(); return; }
    if (current === 'game') doPause();
    if (current === 'toly-game') tolyPause();
    if (current === 'trap') Trap.stop();
  });

  // ---------- Что нового ----------
  // Каждому игроку один раз показываем самую свежую запись. Новое обновление — новая запись с новым id сверху.
  const NEWS = [
    {
      id: '2026-10-28',
      title: '28 ОКТЯБРЯ',
      html:
        '<h3>🚗 Тольяттинская суета</h3><ul>' +
          '<li><b>Почти без тупиков:</b> машины больше не выстраиваются стенкой в соседних полосах — выход есть всегда</li>' +
          '<li>⚡ <b>Энергетик</b> на дороге — щит на 5 секунд, аварии не страшны</li>' +
          '<li>Задетую боком машину сносит в соседнюю полосу</li>' +
          '<li>Встречка едет медленнее, дождь и ночь вдвое короче и не идут одновременно</li></ul>' +
        '<h3>🏚 Трэп хата</h3><ul>' +
          '<li>🩺 <b>Врач на дом</b> — кнопка в утреннем окне: по ОМС бесплатно раз в 10 дней, чаще — 500₽. Лечит всех, кто дома</li>' +
          '<li>🍲 <b>Готовка</b> теперь кормит всех общим ужином, а вдвоём-втроём готовят ещё сытнее</li>' +
          '<li>Вика правда встаёт к плите и кормит всю хату</li>' +
          '<li>Отдых и дота поднимают настроение в полтора раза сильнее</li>' +
          '<li>Спорт Ромы лечит вдвое сильнее, штраф полиции втрое меньше, новый телефон Ромы вдвое дешевле</li>' +
          '<li>Халтурка с энергетиком даёт ×4 к оплате</li>' +
          '<li>💨 Серёжа делает дэб, когда вейпит, а Дамир иногда стреляет у него вейп. Вейп со временем немного сильнее</li>' +
          '<li>🌿 По дороге в магазин можно найти <b>шишь</b> — скурить всей хатой или выбросить. Курят все или никто, потом пробивает на хавчик, а кто-то может словить бледного</li>' +
          '<li>Карточки жильцов больше не прячутся под кнопками и вырезом камеры iPhone</li></ul>',
    },
    {
      id: '2026-10-27',
      title: '27 ОКТЯБРЯ',
      html:
        '<h3>🏆 Общий рейтинг</h3><ul>' +
          '<li>Кнопка «РЕЙТИНГ» в меню: топ игроков по каждой игре — за всё время и за эту неделю</li>' +
          '<li>Чтобы попасть в таблицу, открывай игру через бота и доигрывай до конца</li></ul>' +
        '<h3>🏃 Хочу чипсов</h3><ul>' +
          '<li>Героя больше не выбираешь — забег начинается случайным героем</li>' +
          '<li><b>Эстафета!</b> Пробеги мимо следующего героя — сменятся герой, мир, враги и бустеры</li>' +
          '<li>Уровни — общая кампания «Чипсы идут домой»: 3 главы по 4 уровня, финал через все три мира</li>' +
          '<li>Рекорд теперь один общий, прогресс уровней начинается заново</li></ul>' +
        '<h3>🏚 Трэп хата</h3><ul>' +
          '<li><b>Чем дальше — тем труднее:</b> растут цены, раз в неделю аренда, ребята быстрее устают, заказчики требовательнее</li>' +
          '<li>Неприятности: потоп, сломанный компьютер, полиция, задержка оплаты</li>' +
          '<li>Радости: 💰 халтурка, 💵 500₽ на улице, 🎤 «Реп над Волгой» — иногда друзья зовут бесплатно</li>' +
          '<li>Новый гость — <b>Савелий</b> из «Тольяттинской суеты». Полина иногда приходит с пакетом</li>' +
          '<li>Девушка Серёжи теперь — <b>Альтушка Серёжи</b></li>' +
          '<li>Отдых сильнее поднимает настроение; дешевле лекарства, аренда и ремонт</li>' +
          '<li>Обучение можно открыть прямо при планировании дня</li></ul>',
    },
  ];
  const NEWS_KEY = 'news_seen';
  // показываем все записи, которых игрок ещё не видел (id — даты, сравниваются как строки)
  function showNews() {
    let seen = '';
    try { seen = localStorage.getItem(NEWS_KEY) || ''; } catch (e) { return; }
    const fresh = NEWS.filter(n => n.id > seen);
    if (!fresh.length) return;
    $('#news-title').textContent = 'ЧТО НОВОГО' + (fresh.length === 1 ? ' · ' + fresh[0].title : '');
    $('#news-body').innerHTML = fresh.map(n => (fresh.length > 1 ? '<h2 class="news-date">' + n.title + '</h2>' : '') + n.html).join('');
    $('#news-body').scrollTop = 0;
    $('#ov-news').classList.add('show');
  }
  $('#news-ok').addEventListener('click', () => {
    Sound.init(); Sound.play('click');
    $('#ov-news').classList.remove('show');
    try { localStorage.setItem(NEWS_KEY, NEWS[0].id); } catch (e) { /* нет доступа */ }
  });

  updateSoundLabels();
  drawMenuScene();
  onOrientation();
  showNews();
})();
