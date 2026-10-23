# Чипсы моя жизнь

Сборник мини-игр в виде Telegram Mini App. Первая игра — «Хочу чипсов» (бесконечный раннер).

Чистый HTML5 Canvas + Web Audio, без сборки и зависимостей. Вся графика и звук генерируются кодом.

## Запуск локально

```bash
cd chipsy-game && python3 -m http.server 8765
```

Открыть http://localhost:8765. Управление на ПК: стрелки / A-D, прыжок — пробел или стрелка вверх, пауза — Esc.

## Файлы

- `index.html`, `style.css` — экраны: меню сборника, выбор героя, игра, пауза, конец игры
- `js/sprites.js` — пиксель-арт (персонажи, враги, предметы, тайлы)
- `js/game.js` — движок раннера: физика, генерация уровня, враги, бустеры, лавина, рекорды
- `js/audio.js` — 8-bit музыка и звуки
- `js/main.js` — UI, экранные кнопки, интеграция с Telegram

Отладка в консоли браузера: `Game.debug.spawn('work')`, `Game.debug.boost()`.

## Подключение к Telegram

1. Выложить папку на любой HTTPS-хостинг (GitHub Pages, Vercel, Netlify).
2. В Telegram открыть @BotFather → `/newbot` → задать имя и username бота.
3. В @BotFather: `/mybots` → бот → Bot Settings → Configure Mini App → Enable → вставить HTTPS-ссылку.
4. Там же можно настроить кнопку меню (Menu Button), чтобы игра открывалась из чата с ботом.
