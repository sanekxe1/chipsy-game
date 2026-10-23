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

  // ---------- смена дня и ночи в городе ----------
  const CYCLE = 90; // секунд на полный круг: день → закат → ночь → рассвет
  const SKIES = {
    day: ['#5fb8ef', '#73c4f2', '#8ccff4', '#a6daf6', '#bfe4f8', '#d6eef9'],
    sunset: ['#5b4f8f', '#7d5f9c', '#b46e9e', '#e48a98', '#f7a98a', '#ffc98a'],
    night: ['#0f1030', '#141640', '#1b1e50', '#22265c', '#2a2f68', '#343a74'],
    dawn: ['#4a5a9c', '#7a7ab8', '#c08ab0', '#f0a8a0', '#ffd0a0', '#ffe6b8'],
  };
  // [доля круга, небо, темнота 0..1]
  const STOPS = [[0, 'day', 0], [0.3, 'day', 0], [0.42, 'sunset', 0.5], [0.52, 'night', 1], [0.8, 'night', 1], [0.9, 'dawn', 0.4], [1, 'day', 0]];
  const hex = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  const mix = (a, b, k) => {
    const x = hex(a), y = hex(b);
    return 'rgb(' + x.map((v, i) => Math.round(v + (y[i] - v) * k)).join(',') + ')';
  };
  function timeOfDay(t) {
    const ph = (t / CYCLE) % 1;
    let i = 0;
    while (STOPS[i + 1][0] < ph) i++;
    const [p0, s0, d0] = STOPS[i], [p1, s1, d1] = STOPS[i + 1];
    const k = p1 > p0 ? (ph - p0) / (p1 - p0) : 0;
    return { ph, dark: d0 + (d1 - d0) * k, sky: SKIES[s0].map((col, j) => mix(col, SKIES[s1][j], k)) };
  }

  function city(c) {
    const { ctx, W, gy, t } = c;
    const tod = timeOfDay(t), d = tod.dark;
    bands(ctx, W, tod.sky, -4, gy);
    // звёзды ночью
    if (d > 0.6) {
      ctx.globalAlpha = (d - 0.6) / 0.4;
      ctx.fillStyle = '#ffffff';
      for (let i = 0; i < 40; i++) ctx.fillRect(Math.floor(hash(i + 50) * W), Math.floor(hash(i + 90) * (gy - 70)), 1, 1);
      ctx.globalAlpha = 1;
    }
    // солнце садится и встаёт, ночью — луна
    const sx = Math.round(W * 0.7);
    let sunY = null;
    if (tod.ph < 0.5) sunY = gy - 125 + Math.pow(tod.ph / 0.5, 2) * 115;
    else if (tod.ph > 0.85) sunY = gy - 10 - (tod.ph - 0.85) / 0.15 * 115;
    if (sunY !== null) {
      ctx.fillStyle = mix('#fff6c0', '#ff9a50', d * 1.6 > 1 ? 1 : d * 1.6);
      ctx.beginPath(); ctx.arc(sx, sunY, 16, 0, Math.PI * 2); ctx.fill();
    }
    if (d > 0.7) {
      ctx.globalAlpha = (d - 0.7) / 0.3;
      ctx.fillStyle = '#f4f1d0';
      ctx.beginPath(); ctx.arc(W * 0.25, gy - 112, 10, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = tod.sky[0];
      ctx.beginPath(); ctx.arc(W * 0.25 + 5, gy - 115, 9, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
    }
    // дальние дома: окна зажигаются к вечеру и горят ровно (без мигания)
    const houseCol = d < 0.5 ? mix('#8a9bb8', '#6c4f7c', d * 2) : mix('#6c4f7c', '#2a2440', (d - 0.5) * 2);
    layer(c, 0.15, 34, (i, x) => {
      const h = 40 + Math.floor(hash(i) * 60), w = 26 + Math.floor(hash(i + 2) * 10);
      ctx.fillStyle = houseCol;
      ctx.fillRect(x, gy - h, w, h);
      let k = 0;
      for (let wy = gy - h + 5; wy < gy - 8; wy += 8) {
        for (let wx = x + 4; wx < x + w - 4; wx += 7, k++) {
          const lit = hash(i * 97 + k) < d * 0.75;
          ctx.fillStyle = lit ? '#ffd27a' : (d < 0.3 ? '#9fb6d6' : 'rgba(0,0,0,0.15)');
          ctx.fillRect(wx, wy, 3, 3);
        }
      }
    });
    // бетонные башни-элеваторы, как на фото Сони
    layer(c, 0.35, 170, (i, x) => {
      if (hash(i + 4) < 0.25) return;
      const h = 90 + Math.floor(hash(i + 9) * 40);
      ctx.fillStyle = mix('#c9c2b6', '#4f4a55', d);
      ctx.fillRect(x, gy - h, 70, h);
      ctx.fillStyle = mix('#e0dacf', '#5d5862', d);
      ctx.fillRect(x + 6, gy - h + 6, 58, h * 0.45);
      ctx.fillStyle = mix('#9a9387', '#3a3640', d);
      for (let k = 0; k < 4; k++) ctx.fillRect(x + k * 22, gy - h, 6, h);
      ctx.fillStyle = mix('#c9805a', '#6a4a40', d);
      ctx.fillRect(x + 30, gy - h + 10, 3, 14);
    });
    // фонари на набережной загораются в темноте
    layer(c, 0.7, 120, (i, x) => {
      ctx.fillStyle = '#2f2538';
      ctx.fillRect(x, gy - 46, 2, 46);
      ctx.fillRect(x - 3, gy - 48, 8, 3);
      if (d > 0.35) {
        ctx.fillStyle = 'rgba(255,233,168,' + ((d - 0.35) * 0.5).toFixed(2) + ')';
        ctx.beginPath(); ctx.arc(x + 1, gy - 44, 12, 0, Math.PI * 2); ctx.fill();
      }
      ctx.fillStyle = d > 0.35 ? '#fff1b8' : '#8a8f99';
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
