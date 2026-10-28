// Бот для «Тольяттинской суеты»: проверяет, бывают ли ситуации без выхода.
// Каждые 0.05 с перебирает манёвры (влево / прямо / вправо, затем снова один из трёх) на ~1.5 с вперёд
// по прямолинейному прогнозу машин и выбирает тот, где дольше всего нет аварии.
// Аварии такого бота почти целиком — «тупики». В браузере: открыть суету, подключить скрипт, TolyBot.run(20).
window.TolyBot = (() => {
  const D = Toly.debug;
  const STEER = 170, H = 180;
  const hit = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

  function plan() {
    const s = D.raw(), p = s.player;
    const minX = s.roadX + 3, maxX = s.roadX + s.LANE * s.LANES + 8 - 3 - p.w;
    const vy = c => (c.opp ? s.speed + c.v : s.speed - c.v * s.slow * s.cityMult);
    const acts = [-1, 0, 1];
    let best = null;
    for (const a1 of acts) for (const a2 of acts) {
      // руль с инерцией — как в игре (в дождь отзывается медленнее)
      let x = p.x, vx = p.vx, ok = 0, scr = 0;
      const k = Math.min(1, (28 - 14 * (s.rainA || 0)) / 60);
      for (let tau = 1 / 60; tau <= 1.5; tau += 1 / 60) {
        const dir = tau < 0.3 ? a1 : a2;
        vx += (dir * STEER - vx) * k;
        x = Math.max(minX, Math.min(maxX, x + vx / 60));
        const me = { x, y: p.y, w: p.w, h: p.h };
        let dead = false;
        for (const c of s.cars) {
          if (c.knocked) continue;
          const cc = { x: c.x, y: c.y + vy(c) * tau, w: c.w, h: c.h };
          if (!hit(me, cc)) continue;
          const ox = Math.min(me.x + me.w, cc.x + cc.w) - Math.max(me.x, cc.x);
          if (ox > 6) { dead = true; break; }
          scr++;
        }
        if (dead) break;
        ok = tau;
      }
      // дольше живём, меньше царапин, меньше дёргаемся
      const score = ok * 1000 - scr * 5 - (a1 !== 0) - (a2 !== 0) * 0.5;
      if (!best || score > best.score) best = { score, a1, ok };
    }
    return best;
  }

  // одна поездка до аварии (или до maxKm): сколько проехали и был ли это «тупик»
  function ride(maxKm) {
    Toly.start(); Toly.pause();
    const dt = 1 / 60;
    let trapped = false;
    for (let i = 0; i < 60 * 60 * 30; i++) {
      const s = D.raw();
      if (s.crashed || !Toly.running) break;
      if (s.dist / 8 / 1000 >= maxKm) break;
      if (i % 3 === 0) {
        const b = plan();
        Toly.input.left = b.a1 < 0; Toly.input.right = b.a1 > 0;
        // лучший манёвр уже ведёт в аварию раньше чем через 1.5 с — выхода не было
        if (b.ok < 1.45) trapped = trapped || b.ok < 0.6;
      }
      D.step(dt);
    }
    const s = D.raw();
    Toly.input.left = Toly.input.right = false;
    const km = s.dist / 8 / 1000;
    Toly.stop();
    return { km, crashed: s.crashed, trapped: s.crashed && trapped };
  }

  function run(n, maxKm) {
    let km = 0, crashes = 0;
    for (let i = 0; i < n; i++) { const r = ride(maxKm || 3); km += r.km; if (r.crashed) crashes++; }
    return { поездок: n, км: +km.toFixed(1), аварий: crashes, 'аварий на 10 км': +(crashes / km * 10).toFixed(2) };
  }
  return { run, ride, plan };
})();
