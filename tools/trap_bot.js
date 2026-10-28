// Бот для «Трэп хаты»: играет партии без экранов, чтобы подобрать баланс.
// skill: 'good' — внимательный игрок, 'avg' — обычный (реже следит за запасами и настроением).
window.TrapBot = (() => {
  const D = Trap.debug;
  const BASE = { food: 150, cigs: 220, beer: 120, energy: 110, meds: 230 };
  // привычки игрока; good — внимательный, avg — обычный. TrapBot.P можно менять из консоли
  const P = {
    good: { docFree: 75, docPaid: 35, cook: true, eat: 50, smoke: 55, beer: 45, rest: 45, lowF: 2, lowC: 2, tf: 3, tc: 3, energy: 6, meds: true, rentSave: true, rap: true, polina: true, poop: 3, phoneBuy: 2500, laptop: 1800, fine: 1500, partyHp: 65, shopper: 'serezha' },
    // новичок: раздаёт всем всё подряд, энергетики не покупает, кучки убирает редко
    casual: { eat: 25, smoke: 30, beer: 50, rest: 25, lowF: 1, lowC: 1, tf: 2, tc: 2, energy: 0, meds: false, rentSave: false, rap: false, polina: false, poop: 40, phoneBuy: 1500, laptop: 1500, fine: 1000, partyHp: 0, shopper: 'serezha' },
    avg: { docFree: 50, docPaid: 0, eat: 40, smoke: 50, beer: 35, rest: 25, lowF: 1, lowC: 1, tf: 2, tc: 2, energy: 0, meds: false, rentSave: false, rap: false, polina: false, poop: 25, phoneBuy: 1e9, laptop: 2500, fine: 3000, partyHp: 40, shopper: 'serezha' },
  };

  function pickChoice(g, ev, skill) {
    const ch = ev.choices, m = g.res.money, o = P[skill];
    const okc = c => c && (!c.ok || c.ok());
    const find = s => ch.find(c => c.label.includes(s));
    let c = null;
    const t = ev.title;
    if (t.includes('телефон')) c = m > o.phoneBuy ? find('КУПИТЬ') : find('ЗАБИТЬ');
    else if (t.includes('ПОТОП') || t.includes('потоп')) c = (m > 2000 && find('МАСТЕР')) || find('ЧИНИТ') || find('ПОТОМ');
    else if (t.includes('компьютер')) c = m > o.laptop ? find('ПОЧИНИТЬ') : find('БЕЗ');
    else if (t.includes('полицию')) c = m > o.fine ? find('ШТРАФ') : find('ДОГОВОРИТЬСЯ');
    else if (t.includes('ТУСОВКА')) c = g.people.filter(p => p.alive && !p.away).every(p => p.health > o.partyHp) ? find('УСТРОИТЬ') : find('НЕ');
    if (!okc(c)) c = ch.find(okc);
    c.fn();
    ev.choices = null;
  }

  function morning(g, skill) {
    const o = P[skill];
    if (g.event && g.event.choices) pickChoice(g, g.event, skill);
    const ps = g.people.filter(p => p.alive && !p.away);
    const n = ps.length;
    // задания
    const rapFree = g.flags.rapFree, rap = g.flags.rap;
    let rapMoney = g.res.money - 1000;
    for (const p of ps) {
      if (p.flags.search || p.flags.repair) continue;
      let task = 'work';
      if (p.broken || (p.ill && p.ill.type === 'flu')) task = 'rest';
      if (p.happy < o.rest) task = 'rest';
      if (p.flags.gig && !p.broken) task = 'work';
      if (rap && (rapFree || (o.rap && rapMoney > 300 && (p.happy < 60 || p.crave > 60)))) {
        if (p.task !== 'rap') p.taskBefore = p.task;
        task = 'rap'; if (!rapFree) rapMoney -= 300;
      }
      p.task = task;
    }
    // магазин: когда запасы кончаются
    const need = g.res.food < o.lowF * n + 1 || g.res.cigs < o.lowC * n;
    let shopper = null;
    if (need) {
      const cand = ps.filter(p => !p.flags.search && !p.flags.repair && p.task !== 'rap' && !p.flags.gig);
      cand.sort((a, b) => (a.task === 'rest' ? -2 : 0) - (b.task === 'rest' ? -2 : 0) + (a.id === o.shopper ? -1 : 0) - (b.id === o.shopper ? -1 : 0));
      shopper = cand[0];
      if (shopper) shopper.task = 'shop';
    }
    // мало еды — кто-то готовит ужин (лучше Рома), если он не нужен в магазине
    if (o.cook && g.res.food < n) {
      const c = ps.filter(p => p.task === 'work' && !p.flags.gig && !p.flags.search && !p.flags.repair).sort((a, b) => (a.id === 'roma' ? -1 : 0) - (b.id === 'roma' ? -1 : 0))[0];
      if (c) c.task = 'cook';
    }
    // врач: бесплатный по ОМС — когда кому-то нехорошо, платный — только если совсем плохо
    const minHp = Math.min(...ps.map(p => p.health));
    const free = !g.lastDoctor || g.day - g.lastDoctor >= 10;
    if ((free && minHp < (o.docFree || 0)) || (!free && minHp < (o.docPaid || 0) && g.res.money > 1500)) g.doctorToday = true;
    // раздача: кому нужнее
    const give = (k, want) => {
      const list = ps.filter(want).sort((a, b) => (k === 'food' ? b.hunger - a.hunger : k === 'cigs' ? b.crave - a.crave : a.happy - b.happy));
      let left = g.res[k];
      for (const p of ps) p.plan[k] = false;
      for (const p of list) if (left > 0) { p.plan[k] = true; left--; }
    };
    give('food', p => p.task !== 'rap' && p.hunger > o.eat);
    give('cigs', p => p.crave > o.smoke && p.task !== 'rap');
    give('beer', p => p.happy < o.beer && p.health > 50);
    give('energy', p => o.energy && p.task === 'work' && p.id !== 'serezha' && !p.broken && p.health > 45 && p.hunger < 70);
    give('meds', p => !!p.ill);
    // покупки
    let cart = null;
    if (shopper) {
      cart = { food: 0, cigs: 0, beer: 0, energy: 0, meds: 0 };
      const toRent = 7 - g.day % 7;
      // еда и сигареты — в первую очередь; откладывать на аренду только то, что останется
      let budget = g.res.money - (rap && !rapFree ? ps.filter(p => p.task === 'rap').length * 300 : 0);
      const price = k => D.price(BASE[k]);
      const buy = k => { if (budget >= price(k)) { cart[k]++; budget -= price(k); return true; } return false; };
      const tf = o.tf * n + 2, tc = o.tc * n;
      for (let i = 0; i < 20; i++) {
        let any = false;
        if (g.res.food + cart.food < tf) any = buy('food') || any;
        if (g.res.cigs + cart.cigs < tc) any = buy('cigs') || any;
        if (!any) break;
      }
      if (o.rentSave) budget -= toRent <= 2 ? Math.min(budget, 750 + 150 * Math.floor(g.day / 7)) : 0;
      if (o.meds && g.res.meds + cart.meds < 1) buy('meds');
      if (o.beer > 40 && g.res.beer + cart.beer < 1) buy('beer');
      // энергетик окупается вчетверо: внимательный игрок держит запас на дни до следующего магазина
      for (let i = 0; i < o.energy && g.res.energy + cart.energy < o.energy && budget > 600; i++) buy('energy');
    }
    D.begin(cart);
  }

  function day(g, skill) {
    const o = P[skill];
    let cleanT = 0;
    for (let i = 0; i < 2000 && g.phase === 'day'; i++) {
      if (g.knock) {
        const id = g.knock, Rm = g.people.find(p => p.id === 'roma');
        const open = id !== 'polina' || !o.polina || Rm.happy < 70 || g.res.food > 4;
        D.answer(open);
      }
      cleanT += 1 / 15;
      if (g.poops.length && cleanT > o.poop) { g.poops = []; cleanT = 0; }
      D.step(1 / 15);
    }
  }

  // одна партия: сколько дней прожили
  function play(skill, maxDays) {
    document.querySelector('#tr-new').click();
    const g = D.raw();
    for (let k = 0; k < (maxDays || 150) && g.phase !== 'over'; k++) {
      if (g.phase !== 'morning') break;
      morning(g, skill);
      day(g, skill);
    }
    return g.day;
  }

  function run(skill, n, maxDays) {
    const days = [];
    for (let i = 0; i < n; i++) days.push(play(skill, maxDays));
    days.sort((a, b) => a - b);
    const avg = days.reduce((a, b) => a + b, 0) / n;
    return { skill, avg: Math.round(avg * 10) / 10, median: days[Math.floor(n / 2)], min: days[0], max: days[n - 1], days };
  }
  return { play, run, P };
})();
