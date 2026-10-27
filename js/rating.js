'use strict';
// Общий рейтинг: отправка рекордов и загрузка таблиц с облачной функции (server/rating).
// Пока URL пустой, рейтинг выключен: кнопка в меню показывает «скоро».
// Игрока сервер узнаёт по подписанным данным Telegram (initData), поэтому отправлять можно только из Telegram.

const Rating = (() => {
  // url — адрес облачной функции из Yandex Cloud; initData — только для проверок в обычном браузере
  const cfg = { url: 'https://functions.yandexcloud.net/d4eh10fcg65c8dmphif7', initData: '' };
  const tg = window.Telegram && window.Telegram.WebApp;
  const initData = () => cfg.initData || (tg && tg.initData) || '';

  const enabled = () => !!cfg.url;
  const canSubmit = () => enabled() && !!initData();

  async function call(body) {
    // text/plain — простой запрос, без предварительного OPTIONS
    const r = await fetch(cfg.url, { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: JSON.stringify(body) });
    if (!r.ok) throw new Error('rating ' + r.status);
    return r.json();
  }

  // рекорд отправляем молча: нет сети — не страшно, лучший результат уйдёт со следующей партией
  function submit(game, score, legacy) {
    if (!canSubmit() || !(score > 0)) return;
    call({ a: 'submit', game, score, legacy: !!legacy, initData: initData() }).catch(() => {});
  }

  function load(game) {
    return call({ a: 'top', game, initData: initData() });
  }

  // один раз переносим рекорды, поставленные до появления рейтинга (только в «за всё время»)
  function sendLegacy(bests) {
    if (!canSubmit()) return;
    try { if (localStorage.getItem('rating_legacy_sent') === '1') return; } catch (e) { return; }
    for (const game in bests) submit(game, bests[game], true);
    try { localStorage.setItem('rating_legacy_sent', '1'); } catch (e) { /* нет доступа */ }
  }

  return { enabled, canSubmit, submit, load, sendLegacy, cfg };
})();
