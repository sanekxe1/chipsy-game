'use strict';
// Логика общего рейтинга — без привязки к окружению: облачная функция (index.js) подставляет
// HMAC из Node и хранилище Object Storage, а в браузере её можно проверить с WebCrypto и памятью.
//
// Хранилище: по одному JSON на игру —
//   { best: {uid: очки}, week: {key: '2026-W44', scores: {uid: очки}}, names: {uid: 'Имя'} }

(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.RatingCore = factory();
})(typeof self !== 'undefined' ? self : this, () => {
  // какие игры и какой результат правдоподобен (защита от явной ерунды из консоли)
  const GAMES = { chips: 1e6, toly: 1e6, trap: 3650 };
  const TOP = 20;
  const MAX_AGE = 24 * 3600;           // подпись Telegram действует сутки

  // неделя по Москве, с понедельника: '2026-W44'
  function weekKey(now) {
    const d = new Date(now + 3 * 3600 * 1000);
    const day = (d.getUTCDay() + 6) % 7;                 // пн = 0
    d.setUTCDate(d.getUTCDate() - day + 3);              // четверг этой недели определяет год
    const year = d.getUTCFullYear();
    const jan4 = new Date(Date.UTC(year, 0, 4));
    const week = 1 + Math.round(((d - jan4) / 864e5 - 3 + ((jan4.getUTCDay() + 6) % 7)) / 7);
    return year + '-W' + String(week).padStart(2, '0');
  }

  const hex = bytes => Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');

  // Проверка initData Mini App: secret = HMAC("WebAppData", token), hash = HMAC(secret, строки key=value по алфавиту)
  // hmac(key, message) → Promise<Uint8Array>; key и message — строки или байты
  async function verify(initData, botToken, hmac, now) {
    if (!initData || typeof initData !== 'string') return null;
    const params = new URLSearchParams(initData);
    const hash = params.get('hash');
    if (!hash) return null;
    params.delete('hash');
    const check = [...params.entries()].map(([k, v]) => k + '=' + v).sort().join('\n');
    const secret = await hmac('WebAppData', botToken);
    if (hex(await hmac(secret, check)) !== hash) return null;
    const authDate = Number(params.get('auth_date'));
    if (!authDate || now / 1000 - authDate > MAX_AGE) return null;
    let user;
    try { user = JSON.parse(params.get('user')); } catch (e) { return null; }
    if (!user || !user.id) return null;
    return user;
  }

  const displayName = u => {
    const n = [u.first_name, u.last_name].filter(Boolean).join(' ').trim() || (u.username ? '@' + u.username : 'Игрок');
    return n.slice(0, 24);
  };

  function emptyBoard() { return { best: {}, week: { key: '', scores: {} }, names: {} }; }

  // таблица: места по убыванию очков; при равенстве — кто раньше попал в таблицу
  function ranked(scores, names) {
    return Object.keys(scores).map(uid => ({ uid, name: names[uid] || 'Игрок', score: scores[uid] }))
      .sort((a, b) => b.score - a.score);
  }
  function view(scores, names, me) {
    const list = ranked(scores, names);
    const top = list.slice(0, TOP).map((r, i) => ({ place: i + 1, name: r.name, score: r.score, me: r.uid === me }));
    const i = me ? list.findIndex(r => r.uid === me) : -1;
    return { top, me: i >= 0 ? { place: i + 1, score: list[i].score } : null, total: list.length };
  }

  // store: { load(game) → Promise<board|null>, save(game, board) → Promise }
  async function handle(body, env) {
    const { store, botToken, hmac } = env;
    const now = env.now || Date.now();
    const game = body && body.game;
    if (!GAMES[game]) return { status: 400, data: { error: 'game' } };
    const user = body.initData ? await verify(body.initData, botToken, hmac, now) : null;
    const uid = user ? String(user.id) : null;
    const key = weekKey(now);
    let board = (await store.load(game)) || emptyBoard();
    // новая неделя — недельная таблица начинается заново
    if (board.week.key !== key) board.week = { key, scores: {} };

    if (body.a === 'submit') {
      if (!uid) return { status: 401, data: { error: 'auth' } };
      const score = Math.floor(Number(body.score));
      if (!(score > 0 && score <= GAMES[game])) return { status: 400, data: { error: 'score' } };
      let changed = board.names[uid] !== displayName(user);
      board.names[uid] = displayName(user);
      if (!(board.best[uid] >= score)) { board.best[uid] = score; changed = true; }
      // старые рекорды из телефона (до появления рейтинга) идут только в «за всё время»
      if (!body.legacy && !(board.week.scores[uid] >= score)) { board.week.scores[uid] = score; changed = true; }
      if (changed) await store.save(game, board);
    } else if (body.a !== 'top') return { status: 400, data: { error: 'action' } };

    return { status: 200, data: { game, week: key, all: view(board.best, board.names, uid), weekly: view(board.week.scores, board.names, uid) } };
  }

  return { handle, verify, weekKey, GAMES, hex };
});
