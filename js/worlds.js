'use strict';
// Фоны трёх миров. Каждый слой двигается со своим параллаксом относительно камеры.
//   volga — Саша: Волга и Жигулёвские горы
//   city  — Соня: закатный город, бетонные башни, набережная
//   flat  — Чипс: квартира, обои, окна, мебель

const Worlds = (() => {
  const hash = i => { const s = Math.sin(i * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
  const noise = x => {
    const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f);
    return hash(i) * (1 - u) + hash(i + 1) * u;
  };

  // вызывает fn(i, x) для объектов слоя, расставленных с шагом spacing
  function layer(c, par, spacing, fn) {
    const off = c.camX * par;
    for (let i = Math.floor((off - 160) / spacing); i * spacing - off < c.W + 8; i++) {
      fn(i, Math.round(i * spacing - off + hash(i) * spacing * 0.4));
    }
  }

  function bands(ctx, W, colors, y0, y1) {
    const n = colors.length, h = (y1 - y0) / n;
    colors.forEach((col, i) => { ctx.fillStyle = col; ctx.fillRect(-4, Math.floor(y0 + i * h), W + 8, Math.ceil(h) + 1); });
  }

  // горный хребет: высота по шуму
  function ridge(c, par, base, amp, scale, color, seed) {
    const { ctx, W } = c;
    ctx.fillStyle = color;
    for (let x = -2; x < W + 2; x += 2) {
      const wx = (x + c.camX * par) / scale + seed;
      const h = Math.round(amp * (0.55 * noise(wx) + 0.3 * noise(wx * 2.3) + 0.15 * noise(wx * 5.1)));
      ctx.fillRect(x, base - h, 2, h + 2);
    }
  }

  function volga(c) {
    const { ctx, W, gy, t } = c;
    bands(ctx, W, ['#6fcbf2', '#86d4f4', '#9edcf6', '#b6e5f8'], -4, gy - 40);
    layer(c, 0.08, 90, (i, x) => {
      if (hash(i + 7) < 0.3) return;
      ctx.drawImage(SPR.clouds[i & 1], x, 6 + Math.floor(hash(i + 3) * Math.max(10, gy - 120)));
    });
    // Жигули: дальний светлый хребет и ближний лесистый с известняковыми обрывами
    ridge(c, 0.12, gy - 36, 70, 70, '#8fb98a', 3);
    ridge(c, 0.2, gy - 34, 46, 45, '#5f9a5a', 11);
    layer(c, 0.2, 130, (i, x) => {
      if (hash(i + 5) < 0.5) return;
      ctx.fillStyle = '#d9d0a8';
      ctx.fillRect(x, gy - 52, 18, 6);
      ctx.fillRect(x + 4, gy - 46, 12, 5);
    });
    // Волга
    ctx.fillStyle = '#4e9fd1';
    ctx.fillRect(-4, gy - 36, W + 8, 26);
    ctx.fillStyle = '#6fb8e3';
    ctx.fillRect(-4, gy - 36, W + 8, 3);
    ctx.fillStyle = '#ffffff';
    layer(c, 0.35, 23, (i, x) => {
      const y = gy - 32 + Math.floor(hash(i + 1) * 18);
      ctx.fillRect(x + Math.round(Math.sin(t * 2 + i) * 2), y, 4 + Math.floor(hash(i) * 5), 1);
    });
    // песчаный берег и кусты
    ctx.fillStyle = '#e8d39a';
    ctx.fillRect(-4, gy - 10, W + 8, 10);
    layer(c, 0.6, 110, (i, x) => {
      if (hash(i + 11) < 0.35) return;
      const img = SPR.bushes[i & 1];
      ctx.drawImage(img, x, gy - img.height + 1);
    });
  }

  function city(c) {
    const { ctx, W, gy, t } = c;
    bands(ctx, W, ['#5b4f8f', '#7d5f9c', '#b46e9e', '#e48a98', '#f7a98a', '#ffc98a'], -4, gy);
    // солнце
    const sx = Math.round(W * 0.72 - c.camX * 0.03 % (W + 80));
    ctx.fillStyle = '#ffe9a8';
    ctx.beginPath(); ctx.arc(sx, gy - 62, 22, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff6d6';
    ctx.beginPath(); ctx.arc(sx, gy - 62, 16, 0, Math.PI * 2); ctx.fill();
    // дальние дома с окнами
    layer(c, 0.15, 34, (i, x) => {
      const h = 40 + Math.floor(hash(i) * 60), w = 26 + Math.floor(hash(i + 2) * 10);
      ctx.fillStyle = '#6c4f7c';
      ctx.fillRect(x, gy - h, w, h);
      ctx.fillStyle = '#ffd27a';
      for (let wy = gy - h + 5; wy < gy - 8; wy += 8) {
        for (let wx = x + 4; wx < x + w - 4; wx += 7) if (hash(wx * 3 + wy) > 0.6) ctx.fillRect(wx, wy, 3, 3);
      }
    });
    // бетонные башни-элеваторы, как на фото Сони
    layer(c, 0.35, 170, (i, x) => {
      if (hash(i + 4) < 0.25) return;
      const h = 90 + Math.floor(hash(i + 9) * 40);
      ctx.fillStyle = '#b8b0a3';
      ctx.fillRect(x, gy - h, 70, h);
      ctx.fillStyle = '#d6d0c4';
      ctx.fillRect(x + 6, gy - h + 6, 58, h * 0.45);
      ctx.fillStyle = '#8e877b';
      for (let k = 0; k < 4; k++) ctx.fillRect(x + k * 22, gy - h, 6, h);
      ctx.fillStyle = '#c9805a';
      ctx.fillRect(x + 30, gy - h + 10, 3, 14);
    });
    // фонари на набережной
    layer(c, 0.7, 120, (i, x) => {
      ctx.fillStyle = '#2f2538';
      ctx.fillRect(x, gy - 46, 2, 46);
      ctx.fillRect(x - 3, gy - 48, 8, 3);
      ctx.fillStyle = Math.floor(t * 2 + i) % 7 ? '#ffe9a8' : '#fff6d6';
      ctx.fillRect(x - 2, gy - 45, 6, 3);
    });
  }

  function flat(c) {
    const { ctx, W, gy } = c;
    // обои в полоску
    ctx.fillStyle = '#f4e1c8';
    ctx.fillRect(-4, -4, W + 8, gy + 8);
    ctx.fillStyle = '#ead1b0';
    const off = Math.round(c.camX * 0.3) % 12;
    for (let x = -off; x < W + 12; x += 12) ctx.fillRect(x, -4, 4, gy + 4);
    // окна с видом на город
    layer(c, 0.3, 190, (i, x) => {
      const y = gy - 110;
      ctx.fillStyle = '#ffffff'; ctx.fillRect(x - 2, y - 2, 56, 64);
      ctx.fillStyle = '#7fcff5'; ctx.fillRect(x, y, 52, 60);
      ctx.fillStyle = '#ffffff'; ctx.fillRect(x + 8, y + 10, 14, 5); ctx.fillRect(x + 12, y + 7, 8, 3);
      ctx.fillStyle = '#9aa7c7';
      for (let k = 0; k < 5; k++) { const h = 12 + Math.floor(hash(i * 5 + k) * 22); ctx.fillRect(x + k * 11, y + 60 - h, 9, h); }
      ctx.fillStyle = '#ffffff'; ctx.fillRect(x + 25, y, 2, 60); ctx.fillRect(x, y + 28, 52, 2);
      ctx.fillStyle = '#e38b8b'; ctx.fillRect(x - 8, y - 4, 10, 70); ctx.fillRect(x + 50, y - 4, 10, 70);
      ctx.fillStyle = '#c96d6d'; ctx.fillRect(x - 8, y - 6, 68, 4);
    });
    // картины с рыбкой
    layer(c, 0.3, 190, (i, x) => {
      const px = x + 100, y = gy - 96;
      ctx.fillStyle = '#9c6a3a'; ctx.fillRect(px, y, 26, 20);
      ctx.fillStyle = '#bfe6f5'; ctx.fillRect(px + 3, y + 3, 20, 14);
      ctx.fillStyle = '#ff9a3c'; ctx.fillRect(px + 8, y + 8, 8, 4); ctx.fillRect(px + 16, y + 7, 3, 6);
    });
    // плинтус
    ctx.fillStyle = '#ffffff'; ctx.fillRect(-4, gy - 6, W + 8, 6);
    ctx.fillStyle = '#d9c7ad'; ctx.fillRect(-4, gy - 6, W + 8, 1);
    // мебель: диван, цветок, когтеточка, книжная полка
    layer(c, 0.6, 150, (i, x) => {
      const kind = Math.floor(hash(i + 21) * 4);
      if (kind === 0) {
        ctx.fillStyle = '#4f6fb8'; ctx.fillRect(x, gy - 30, 64, 24); ctx.fillRect(x - 4, gy - 22, 72, 16);
        ctx.fillStyle = '#6a8bd6'; ctx.fillRect(x + 3, gy - 27, 28, 10); ctx.fillRect(x + 33, gy - 27, 28, 10);
        ctx.fillStyle = '#3a2b20'; ctx.fillRect(x, gy - 6, 4, 6); ctx.fillRect(x + 60, gy - 6, 4, 6);
      } else if (kind === 1) {
        ctx.fillStyle = '#c0603a'; ctx.fillRect(x + 4, gy - 16, 14, 16);
        ctx.fillStyle = '#3f9e4a';
        ctx.fillRect(x + 9, gy - 40, 4, 24); ctx.fillRect(x, gy - 34, 10, 4); ctx.fillRect(x + 12, gy - 30, 10, 4); ctx.fillRect(x + 2, gy - 26, 8, 4);
      } else if (kind === 2) {
        ctx.fillStyle = '#d9c39a'; ctx.fillRect(x + 6, gy - 50, 6, 50);
        ctx.fillStyle = '#a8743a'; ctx.fillRect(x - 6, gy - 54, 30, 6); ctx.fillRect(x - 4, gy - 28, 26, 5); ctx.fillRect(x - 6, gy - 4, 30, 4);
      } else {
        ctx.fillStyle = '#8a5a2c'; ctx.fillRect(x, gy - 58, 40, 58);
        const cols = ['#e33b2e', '#3d7be0', '#ffd23f', '#5cc93a', '#8a5cf0'];
        for (let r = 0; r < 3; r++) {
          ctx.fillStyle = '#6b4420'; ctx.fillRect(x + 2, gy - 58 + 4 + r * 18 + 14, 36, 2);
          for (let b = 0; b < 6; b++) { ctx.fillStyle = cols[(b + r + i) % 5]; ctx.fillRect(x + 4 + b * 6, gy - 58 + 6 + r * 18, 4, 12); }
        }
      }
    });
  }

  const DRAW = { volga, city, flat };
  const SKY = { volga: '#6fcbf2', city: '#5b4f8f', flat: '#f4e1c8' };

  const PIT = { volga: '#2b5f8a', city: '#1f4466', flat: '#4a2e18' };

  return {
    draw(world, ctx, camX, W, H, gy, t) {
      ctx.fillStyle = PIT[world];
      ctx.fillRect(-4, gy, W + 8, H - gy + 4);
      DRAW[world]({ ctx, camX, W, H, gy, t });
    },
    sky: world => SKY[world],
  };
})();
