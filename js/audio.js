'use strict';
// 8-bit музыка и звуки на Web Audio API, без аудиофайлов.
const Sound = (() => {
  let ctx = null, master, musicGain, sfxGain, noiseBuf;
  let enabled = true;
  try { enabled = localStorage.getItem('chips_sound') !== 'off'; } catch (e) { /* нет доступа */ }

  let musicOn = false, nextTime = 0, step = 0, timer = 0;
  const STEP = 60 / 152 / 2; // восьмые ноты

  const NOTES = { C: 0, 'C#': 1, D: 2, 'D#': 3, E: 4, F: 5, 'F#': 6, G: 7, 'G#': 8, A: 9, 'A#': 10, B: 11 };
  const f = name => {
    const m = /^([A-G]#?)(\d)$/.exec(name);
    return 440 * Math.pow(2, (NOTES[m[1]] + (+m[2] + 1) * 12 - 69) / 12);
  };

  // Мелодия: 8 тактов по 8 восьмых, '-' — пауза
  const MEL = (
    'E5 G5 C6 G5 E5 G5 A5 G5 ' +
    'E5 - C5 E5 A5 - G5 - ' +
    'F5 A5 C6 A5 F5 A5 C6 D6 ' +
    'B5 - G5 - D5 G5 B5 - ' +
    'C6 B5 A5 G5 E5 G5 C6 - ' +
    'A5 G5 E5 C5 E5 - A4 - ' +
    'F5 E5 F5 A5 G5 F5 E5 D5 ' +
    'G5 - D5 - B4 D5 G5 -'
  ).split(' ');
  const BASS = ['C3', 'A2', 'F2', 'G2', 'C3', 'A2', 'F2', 'G2'];

  function init() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = enabled ? 0.5 : 0;
    master.connect(ctx.destination);
    musicGain = ctx.createGain();
    musicGain.gain.value = 0.32;
    musicGain.connect(master);
    sfxGain = ctx.createGain();
    sfxGain.gain.value = 0.7;
    sfxGain.connect(master);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }

  function tone(type, f0, f1, t0, dur, vol, dest) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t0);
    if (f1 && f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t0 + dur);
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    o.connect(g); g.connect(dest || sfxGain);
    o.start(t0); o.stop(t0 + dur + 0.02);
  }

  function noise(t0, dur, vol, freq, dest, q) {
    const s = ctx.createBufferSource();
    s.buffer = noiseBuf;
    const fl = ctx.createBiquadFilter();
    fl.type = 'bandpass'; fl.frequency.value = freq; fl.Q.value = q || 1;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    s.connect(fl); fl.connect(g); g.connect(dest || sfxGain);
    s.start(t0, Math.random() * 0.5); s.stop(t0 + dur + 0.02);
  }

  function meow(t0) {
    const o = ctx.createOscillator(), g = ctx.createGain(), fl = ctx.createBiquadFilter();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(480, t0);
    o.frequency.linearRampToValueAtTime(780, t0 + 0.14);
    o.frequency.linearRampToValueAtTime(420, t0 + 0.45);
    fl.type = 'lowpass';
    fl.frequency.setValueAtTime(900, t0);
    fl.frequency.linearRampToValueAtTime(2400, t0 + 0.15);
    fl.frequency.linearRampToValueAtTime(800, t0 + 0.45);
    g.gain.setValueAtTime(0.001, t0);
    g.gain.linearRampToValueAtTime(0.35, t0 + 0.05);
    g.gain.linearRampToValueAtTime(0.25, t0 + 0.3);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.5);
    o.connect(fl); fl.connect(g); g.connect(sfxGain);
    o.start(t0); o.stop(t0 + 0.55);
  }

  function play(name) {
    if (!ctx || !enabled) return;
    const t = ctx.currentTime + 0.005;
    switch (name) {
      case 'jump': tone('square', 260, 640, t, 0.15, 0.22); break;
      case 'crunch':
        noise(t, 0.06, 0.6, 2600, null, 0.8);
        noise(t + 0.05, 0.05, 0.45, 3600, null, 0.8);
        tone('square', 990, 1480, t, 0.07, 0.1);
        break;
      case 'kibble': tone('square', 1300, 1900, t, 0.06, 0.13); noise(t, 0.04, 0.35, 3200); break;
      case 'stomp': tone('square', 240, 70, t, 0.14, 0.3); noise(t, 0.08, 0.3, 900); break;
      case 'bump': tone('square', 150, 90, t, 0.08, 0.3); break;
      case 'hurt': tone('sawtooth', 520, 110, t, 0.35, 0.22); break;
      case 'meow': meow(t); break;
      case 'boost':
        ['C5', 'E5', 'G5', 'C6', 'E6', 'G6'].forEach((n, i) => tone('square', f(n), null, t + i * 0.055, 0.09, 0.16));
        break;
      case 'over':
        ['G4', 'E4', 'C4', 'G3'].forEach((n, i) => {
          tone('square', f(n), null, t + i * 0.2, 0.22, 0.18);
          tone('triangle', f(n) / 2, null, t + i * 0.2, 0.25, 0.3);
        });
        break;
      case 'start':
        ['C5', 'G5', 'C6'].forEach((n, i) => tone('square', f(n), null, t + i * 0.08, 0.1, 0.16));
        break;
      case 'click': tone('square', 700, 900, t, 0.05, 0.12); break;
      case 'bark':
        [0, 0.16].forEach(d => { tone('sawtooth', 380, 180, t + d, 0.1, 0.25); noise(t + d, 0.08, 0.3, 700); });
        break;
      case 'spring': tone('square', 200, 900, t, 0.25, 0.2); break;
      case 'jump2': tone('square', 400, 900, t, 0.12, 0.2); break;
      case 'tick': tone('square', 880, null, t, 0.08, 0.18); break;
      case 'swap':
        tone('sawtooth', 300, 600, t, 0.15, 0.2);
        tone('sawtooth', 600, 300, t + 0.15, 0.15, 0.2);
        break;
      case 'break':
        noise(t, 0.18, 0.6, 1200, null, 0.6);
        tone('square', 300, 60, t, 0.15, 0.2);
        break;
      case 'checkpoint':
        ['E5', 'A5'].forEach((n, i) => tone('square', f(n), null, t + i * 0.1, 0.12, 0.16));
        break;
      case 'win':
        ['C5', 'E5', 'G5', 'C6', 'G5', 'C6', 'E6'].forEach((n, i) => {
          tone('square', f(n), null, t + i * 0.12, 0.14, 0.16);
          tone('triangle', f(n) / 2, null, t + i * 0.12, 0.14, 0.3);
        });
        break;
    }
  }

  function schedule() {
    while (nextTime < ctx.currentTime + 0.15) {
      const i = step % 64, bar = i >> 3;
      const m = MEL[i];
      if (m !== '-') tone('square', f(m), null, nextTime, STEP * 0.9, 0.16, musicGain);
      const root = f(BASS[bar]);
      tone('triangle', i % 2 ? root * 2 : root, null, nextTime, STEP * 0.95, 0.4, musicGain);
      if (i % 4 === 0) tone('sine', 140, 45, nextTime, 0.12, 0.6, musicGain);
      if (i % 2 === 1) noise(nextTime, 0.035, 0.12, 8000, musicGain, 1.5);
      if (i % 8 === 4) noise(nextTime, 0.09, 0.22, 1800, musicGain, 0.7);
      nextTime += STEP;
      step++;
    }
  }

  function startMusic() {
    if (!ctx || musicOn) return;
    musicOn = true;
    nextTime = ctx.currentTime + 0.1;
    schedule();
    timer = setInterval(schedule, 40);
  }

  function stopMusic() {
    musicOn = false;
    clearInterval(timer);
  }

  function toggle() {
    enabled = !enabled;
    try { localStorage.setItem('chips_sound', enabled ? 'on' : 'off'); } catch (e) { /* нет доступа */ }
    if (master) master.gain.value = enabled ? 0.5 : 0;
    return enabled;
  }

  return { init, play, startMusic, stopMusic, toggle, get enabled() { return enabled; } };
})();
