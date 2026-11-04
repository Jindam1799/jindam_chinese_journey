/* 16비트 풍 음악·효과음 (WebAudio 실시간 합성 → 음원 파일 없음) + 중국어 발음(TTS)
   - 스테이지마다 다른 곡: 월드별 중국 5음계(궁·상·치·우) + 스테이지 번호를 씨앗으로 자동 작곡
   - 악기: 리드(비브라토) · 고쟁 플럭 · 피리 · 베이스 · 패드 · 드럼 + 에코(딜레이) */
(function () {
  'use strict';
  const DT = (window.DT = window.DT || {});
  const S = DT.store;

  let ctx = null, master = null, sfxBus = null, musicBus = null, echo = null, noiseBuf = null;
  let muted = S ? S.get('dentree_mute', '0') === '1' : false;
  let bgmVol = S ? parseFloat(S.get('dentree_bgm', '0.6')) : 0.6;
  let sfxVol = S ? parseFloat(S.get('dentree_sfx', '0.8')) : 0.8;
  let voiceOn = S ? S.get('dentree_voice', '1') === '1' : true;

  function ensure() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      try { ctx = new AC(); } catch (e) { return null; }
      master = ctx.createGain(); master.gain.value = muted ? 0 : 0.9;
      const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 3;
      master.connect(comp); comp.connect(ctx.destination);
      sfxBus = ctx.createGain(); sfxBus.gain.value = 0.55 * sfxVol; sfxBus.connect(master);
      musicBus = ctx.createGain(); musicBus.gain.value = 0.42 * bgmVol; musicBus.connect(master);
      // 에코: 16비트 게임기 특유의 잔향
      echo = ctx.createDelay(1); echo.delayTime.value = 0.21;
      const fb = ctx.createGain(); fb.gain.value = 0.3;
      const wet = ctx.createGain(); wet.gain.value = 0.22;
      const tone = ctx.createBiquadFilter(); tone.type = 'lowpass'; tone.frequency.value = 2600;
      echo.connect(tone); tone.connect(fb); fb.connect(echo); tone.connect(wet); wet.connect(master);
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 0.6, ctx.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    return ctx;
  }

  const midi = (n) => 440 * Math.pow(2, (n - 69) / 12);
  function env(g, t0, a, peak, d, sus, rel, end) {
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t0 + a);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak * sus), t0 + a + d);
    g.gain.setValueAtTime(Math.max(0.0002, peak * sus), Math.max(t0 + a + d, end - rel));
    g.gain.exponentialRampToValueAtTime(0.0001, end);
  }
  function out(node, bus, send) {
    node.connect(bus);
    if (send && echo) { const s = ctx.createGain(); s.gain.value = send; node.connect(s); s.connect(echo); }
  }

  /* ───────── 악기 ───────── */
  const INST = {
    lead(t, f, d, v, bus) {
      const g = ctx.createGain(), lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 3000; lp.Q.value = 1.5;
      const o1 = ctx.createOscillator(), o2 = ctx.createOscillator();
      o1.type = 'square'; o2.type = 'sawtooth'; o1.frequency.value = f; o2.frequency.value = f; o2.detune.value = 8;
      const lfo = ctx.createOscillator(), lg = ctx.createGain(); lfo.frequency.value = 5.6; lg.gain.setValueAtTime(0, t); lg.gain.linearRampToValueAtTime(f * 0.007, t + Math.min(0.25, d * 0.6));
      lfo.connect(lg); lg.connect(o1.frequency); lg.connect(o2.frequency);
      const m = ctx.createGain(); m.gain.value = 0.5; o1.connect(m); o2.connect(m); m.connect(lp); lp.connect(g);
      env(g, t, 0.008, v, 0.08, 0.7, 0.06, t + d);
      out(g, bus, 0.35);
      [o1, o2, lfo].forEach(o => { o.start(t); o.stop(t + d + 0.05); });
    },
    pluck(t, f, d, v, bus) { // 고쟁 느낌: 살짝 아래에서 미끄러져 올라오는 뜯는 소리
      const g = ctx.createGain(), lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 3;
      lp.frequency.setValueAtTime(5200, t); lp.frequency.exponentialRampToValueAtTime(700, t + 0.35);
      const o1 = ctx.createOscillator(), o2 = ctx.createOscillator();
      o1.type = 'triangle'; o2.type = 'square';
      [o1, o2].forEach(o => { o.frequency.setValueAtTime(f * 0.97, t); o.frequency.exponentialRampToValueAtTime(f, t + 0.035); });
      const m2 = ctx.createGain(); m2.gain.value = 0.35; o2.connect(m2); m2.connect(lp); o1.connect(lp); lp.connect(g);
      const len = Math.max(0.35, d * 1.6);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t + len);
      out(g, bus, 0.4);
      [o1, o2].forEach(o => { o.start(t); o.stop(t + len + 0.02); });
    },
    flute(t, f, d, v, bus) {
      const g = ctx.createGain(), o = ctx.createOscillator(), o2 = ctx.createOscillator();
      o.type = 'sine'; o2.type = 'triangle'; o.frequency.value = f; o2.frequency.value = f * 2;
      const lfo = ctx.createOscillator(), lg = ctx.createGain(); lfo.frequency.value = 5; lg.gain.setValueAtTime(0, t); lg.gain.linearRampToValueAtTime(f * 0.01, t + 0.3);
      lfo.connect(lg); lg.connect(o.frequency);
      const m = ctx.createGain(); m.gain.value = 0.15; o2.connect(m); m.connect(g); o.connect(g);
      env(g, t, 0.05, v, 0.1, 0.85, 0.08, t + d);
      out(g, bus, 0.45);
      [o, o2, lfo].forEach(x => { x.start(t); x.stop(t + d + 0.05); });
      noise({ t: t - ctx.currentTime, d: 0.06, v: v * 0.25, f: 2500, filter: 'bandpass', bus });
    },
    bass(t, f, d, v, bus) {
      const g = ctx.createGain(), lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 800;
      const o1 = ctx.createOscillator(), o2 = ctx.createOscillator();
      o1.type = 'triangle'; o2.type = 'square'; o1.frequency.value = f; o2.frequency.value = f;
      const m = ctx.createGain(); m.gain.value = 0.3; o2.connect(m); m.connect(lp); o1.connect(lp); lp.connect(g);
      env(g, t, 0.005, v, 0.1, 0.6, 0.04, t + d);
      out(g, bus, 0);
      [o1, o2].forEach(o => { o.start(t); o.stop(t + d + 0.05); });
    },
    pad(t, f, d, v, bus) {
      const g = ctx.createGain(), lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1100;
      [-9, 9].forEach(dt => { const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; o.detune.value = dt; o.connect(lp); o.start(t); o.stop(t + d + 0.5); });
      lp.connect(g);
      env(g, t, 0.25, v, 0.2, 0.8, 0.4, t + d + 0.4);
      out(g, bus, 0.3);
    },
    kick(t, v, bus) {
      const g = ctx.createGain(), o = ctx.createOscillator(); o.type = 'sine';
      o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.14);
      g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
      o.connect(g); out(g, bus, 0); o.start(t); o.stop(t + 0.2);
    },
    snare(t, v, bus) {
      noise({ t: t - ctx.currentTime, d: 0.13, v: v * 0.8, f: 1900, filter: 'bandpass', bus, send: 0.2 });
      tone({ t: t - ctx.currentTime, f: 200, f2: 120, d: 0.07, v: v * 0.6, type: 'triangle', bus });
    },
    hat(t, v, bus, open) { noise({ t: t - ctx.currentTime, d: open ? 0.09 : 0.025, v, f: 8000, filter: 'highpass', bus }); }
  };

  function tone(o) {
    if (!ctx || muted) return;
    const t0 = ctx.currentTime + (o.t || 0), d = o.d || 0.1;
    const osc = ctx.createOscillator(), g = ctx.createGain();
    osc.type = o.type || 'square';
    osc.frequency.setValueAtTime(o.f || 440, t0);
    if (o.f2) osc.frequency.exponentialRampToValueAtTime(Math.max(20, o.f2), t0 + (o.slide || d));
    if (o.vib) { const l = ctx.createOscillator(), lg = ctx.createGain(); l.frequency.value = o.vib; lg.gain.value = (o.f || 440) * 0.04; l.connect(lg); lg.connect(osc.frequency); l.start(t0); l.stop(t0 + d + 0.02); }
    const v = o.v === undefined ? 0.2 : o.v;
    g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(v, t0 + 0.005); g.gain.exponentialRampToValueAtTime(0.0001, t0 + d);
    osc.connect(g); out(g, o.bus || sfxBus, o.send || 0);
    osc.start(t0); osc.stop(t0 + d + 0.02);
  }
  function noise(o) {
    if (!ctx || muted) return;
    const t0 = ctx.currentTime + (o.t || 0), d = o.d || 0.1;
    const src = ctx.createBufferSource(); src.buffer = noiseBuf;
    const f = ctx.createBiquadFilter(); f.type = o.filter || 'lowpass';
    f.frequency.setValueAtTime(o.f || 4000, t0);
    if (o.f2) f.frequency.exponentialRampToValueAtTime(o.f2, t0 + d);
    const g = ctx.createGain();
    g.gain.setValueAtTime(o.v === undefined ? 0.25 : o.v, t0); g.gain.exponentialRampToValueAtTime(0.0001, t0 + d);
    src.connect(f); f.connect(g); out(g, o.bus || sfxBus, o.send || 0);
    src.start(t0); src.stop(t0 + d + 0.02);
  }
  const play = (inst, at, n, d, v) => { if (ctx && !muted) INST[inst](ctx.currentTime + at, midi(n), d, v, sfxBus); };
  const arp = (inst, notes, step, v, d) => notes.forEach((n, i) => play(inst, i * step, n, d || step * 1.5, v));

  /* ───────── 효과음 (재미있게!) ───────── */
  const SFX = {
    shoot(mode) {
      if (mode === 'line') { tone({ f: 380, f2: 1300, d: 0.09, v: 0.12, type: 'sine', slide: 0.06 }); tone({ f: 1600, d: 0.03, t: 0.05, v: 0.05, type: 'sine' }); }
      else if (mode === 'roll') { tone({ f: 520, f2: 260, d: 0.06, v: 0.14, type: 'triangle' }); noise({ d: 0.02, v: 0.12, f: 3000, filter: 'highpass' }); }
      else { tone({ f: 820, f2: 1500, d: 0.07, v: 0.08 }); play('pluck', 0, 96, 0.05, 0.05); }
    },
    jump() { tone({ f: 260, f2: 720, d: 0.16, v: 0.1, type: 'square', vib: 18, slide: 0.12 }); },
    land() { noise({ d: 0.06, v: 0.08, f: 700 }); tone({ f: 110, f2: 70, d: 0.05, v: 0.06, type: 'triangle' }); },
    hit(n) { tone({ f: 420 + (n || 0) * 90, f2: 200, d: 0.07, v: 0.13, type: 'triangle' }); noise({ d: 0.04, v: 0.14, f: 3200 }); },
    seal() { [0, 0.05, 0.1].forEach((t, i) => tone({ f: 600 + i * 300, f2: 900 + i * 300, d: 0.05, t, v: 0.1, type: 'sine' })); arp('pluck', [72, 76, 79, 84], 0.04, 0.12); },
    tick() { tone({ f: 1250, d: 0.025, v: 0.05 }); },
    unseal() { tone({ f: 700, f2: 180, d: 0.25, v: 0.12, type: 'sawtooth', vib: 12 }); noise({ d: 0.15, v: 0.1, f: 3000 }); },
    kick() { noise({ d: 0.18, v: 0.14, f: 400, f2: 3500, filter: 'bandpass' }); tone({ f: 150, f2: 55, d: 0.12, v: 0.22, type: 'square' }); noise({ d: 0.05, v: 0.25, f: 2200, t: 0.01 }); },
    bump() { tone({ f: 620, d: 0.04, v: 0.1, type: 'square' }); tone({ f: 310, d: 0.05, t: 0.02, v: 0.1, type: 'triangle' }); },
    kill(n) {
      const k = Math.min(n || 1, 8), scale = [0, 2, 4, 7, 9, 12, 14, 16, 19];
      noise({ d: 0.12, v: 0.2, f: 5000, f2: 500 });
      for (let i = 0; i < Math.min(k + 1, 5); i++) play('pluck', 0.03 + i * 0.035, 72 + scale[Math.min(8, k - 1 + i)], 0.08, 0.1);
    },
    burst() { noise({ d: 0.35, v: 0.3, f: 3500, f2: 150 }); tone({ f: 130, f2: 40, d: 0.3, v: 0.2, type: 'triangle' }); arp('pluck', [88, 91, 96, 100], 0.03, 0.06); },
    hurt() { tone({ f: 700, f2: 160, d: 0.32, v: 0.14, type: 'sine', vib: 14, slide: 0.3 }); noise({ d: 0.08, v: 0.12, f: 1500 }); },
    die() { arp('lead', [72, 69, 67, 64, 60, 55], 0.13, 0.11, 0.16); },
    collect() { tone({ f: 988, d: 0.07, v: 0.09 }); tone({ f: 1319, d: 0.16, t: 0.06, v: 0.09 }); },
    chunk() { arp('lead', [72, 76, 79, 84], 0.07, 0.1, 0.1); arp('pluck', [60, 67, 72, 76, 84], 0.05, 0.1); },
    steal() { tone({ f: 500, f2: 1500, d: 0.18, v: 0.1, type: 'sine', slide: 0.16 }); tone({ f: 1500, f2: 400, d: 0.2, t: 0.18, v: 0.1, type: 'sine' }); },
    go() { arp('lead', [67, 72, 76, 79], 0.07, 0.1, 0.12); play('lead', 0.3, 84, 0.3, 0.11); },
    hurry() { [0, 0.22, 0.44].forEach(t => { tone({ f: 880, d: 0.1, t, v: 0.12 }); tone({ f: 660, d: 0.1, t: t + 0.11, v: 0.12 }); }); },
    clear() { arp('lead', [67, 72, 76, 79, 76, 79, 84], 0.1, 0.11, 0.14); arp('bass', [48, 55, 60, 64], 0.18, 0.18, 0.2); arp('pluck', [84, 88, 91, 96], 0.05, 0.08); },
    select() { tone({ f: 880, d: 0.035, v: 0.07 }); },
    right() { arp('pluck', [76, 80, 83, 88], 0.07, 0.13); tone({ f: 1760, d: 0.2, t: 0.28, v: 0.06, type: 'sine' }); },
    wrong() { tone({ f: 220, f2: 150, d: 0.3, v: 0.13, type: 'sawtooth', vib: 8 }); },
    start() { noise({ d: 0.35, v: 0.12, f: 300, f2: 6000, filter: 'bandpass' }); arp('lead', [60, 67, 72, 76, 79, 84], 0.05, 0.1); },
    perfect() { arp('lead', [72, 76, 79, 84, 88, 91, 96], 0.05, 0.11); arp('pluck', [60, 64, 67, 72], 0.1, 0.12); },
    blip() { tone({ f: 1320, d: 0.02, v: 0.03 }); },
    rumble() { noise({ d: 1.2, v: 0.35, f: 300, f2: 60 }); tone({ f: 55, f2: 35, d: 1.2, v: 0.25, type: 'sawtooth' }); },
    shatter() { noise({ d: 0.3, v: 0.25, f: 8000, f2: 1500, filter: 'highpass' }); arp('pluck', [96, 91, 88, 84], 0.04, 0.07); },
    sparkle() { arp('pluck', [84, 88, 91, 96, 100], 0.05, 0.1); },
    crumble() { noise({ d: 0.18, v: 0.2, f: 1200, f2: 200 }); tone({ f: 180, f2: 90, d: 0.12, v: 0.1, type: 'square' }); },
    levelup() { arp('lead', [72, 79, 84, 88, 91], 0.06, 0.1, 0.12); arp('pluck', [96, 100, 103], 0.05, 0.07); },
    fire() { noise({ d: 0.3, v: 0.22, f: 900, f2: 3000, filter: 'bandpass' }); tone({ f: 220, f2: 110, d: 0.25, v: 0.08, type: 'sawtooth' }); },
    throw() { noise({ d: 0.12, v: 0.12, f: 600, f2: 2400, filter: 'bandpass' }); tone({ f: 500, f2: 900, d: 0.08, v: 0.06, type: 'triangle' }); },
    poot() { tone({ f: 140, f2: 70, d: 0.22, v: 0.16, type: 'sawtooth', vib: 22 }); noise({ d: 0.12, v: 0.08, f: 300 }); },
    squish() { noise({ d: 0.15, v: 0.2, f: 500, f2: 150 }); tone({ f: 260, f2: 90, d: 0.18, v: 0.12, type: 'sine', vib: 30 }); },
    warn() { tone({ f: 880, d: 0.06, v: 0.1 }); tone({ f: 660, d: 0.08, t: 0.08, v: 0.1 }); },
    bosshit() { noise({ d: 0.4, v: 0.35, f: 2500, f2: 100 }); tone({ f: 90, f2: 30, d: 0.4, v: 0.3, type: 'square' }); arp('lead', [79, 72], 0.08, 0.1); }
  };

  /* ───────── 자동 작곡기 (중국 5음계) ───────── */
  const MODES = { gong: [0, 2, 4, 7, 9], shang: [0, 2, 5, 7, 10], zhi: [0, 2, 5, 7, 9], yu: [0, 3, 5, 7, 10] };
  const STYLES = {
    title: { mode: 'gong', root: 65, bpm: 128, lead: 'pluck', lead2: 'lead', bass: 'bounce', drums: 'pop', arp: true },
    menu: { mode: 'gong', root: 67, bpm: 112, lead: 'pluck', lead2: 'flute', bass: 'soft', drums: 'soft', pad: true },
    story: { mode: 'zhi', root: 62, bpm: 84, lead: 'pluck', lead2: 'flute', bass: 'soft', drums: null, pad: true },
    w1: { mode: 'gong', root: 60, bpm: 132, lead: 'pluck', lead2: 'lead', bass: 'bounce', drums: 'pop' },
    w2: { mode: 'shang', root: 62, bpm: 142, lead: 'lead', lead2: 'pluck', bass: 'drive', drums: 'rock', arp: true },
    w3: { mode: 'zhi', root: 67, bpm: 120, lead: 'flute', lead2: 'pluck', bass: 'soft', drums: 'soft', pad: true },
    w4: { mode: 'yu', root: 57, bpm: 150, lead: 'lead', lead2: 'flute', bass: 'drive', drums: 'rock', pad: true, arp: true },
    boss: { mode: 'yu', root: 52, bpm: 164, lead: 'lead', lead2: 'lead', bass: 'ostinato', drums: 'boss', arp: true }
  };
  const PROG = { gong: [0, 9, 5, 7], shang: [0, 10, 5, 7], zhi: [0, 5, 10, 7], yu: [0, 8, 3, 10] };
  const RHYTHMS = [ // 한 마디(16칸)의 음 시작 위치와 길이
    [[0, 3], [3, 1], [4, 2], [6, 2], [8, 4], [12, 2], [14, 2]],
    [[0, 2], [2, 2], [4, 4], [8, 2], [10, 2], [12, 4]],
    [[0, 4], [4, 2], [6, 1], [7, 1], [8, 6], [14, 2]],
    [[0, 1], [1, 1], [2, 2], [4, 2], [6, 2], [8, 3], [11, 1], [12, 4]],
    [[0, 6], [6, 2], [8, 2], [10, 2], [12, 2], [14, 2]],
    [[2, 2], [4, 2], [6, 2], [8, 4], [12, 1], [13, 1], [14, 2]]
  ];

  function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

  function compose(styleName, seed, extra) {
    const st = Object.assign({}, STYLES[styleName] || STYLES.w1, extra || {});
    const R = rng(seed * 7919 + styleName.length * 31);
    const sc = MODES[st.mode], prog = PROG[st.mode];
    const deg = (i) => st.root + sc[((i % 5) + 5) % 5] + 12 * Math.floor(i / 5);
    const ev = []; // [step, inst, note, len, vel]
    const BAR = 16;
    // 멜로디: 동기(motif) 반복 구조 A A' B A
    const makeBars = (startDeg, hi) => {
      const bars = [];
      let cur = startDeg;
      for (let b = 0; b < 4; b++) {
        const rh = RHYTHMS[Math.floor(R() * RHYTHMS.length)];
        const notes = rh.map(([s, l], k) => {
          const step = R() < 0.5 ? 1 : (R() < 0.5 ? -1 : (R() < 0.5 ? 2 : -2));
          cur = Math.max(hi - 3, Math.min(hi + 6, cur + step));
          if (b === 3 && k === rh.length - 1) cur = hi + (R() < 0.5 ? 0 : 5);
          return [s, l, cur];
        });
        bars.push(notes);
      }
      return bars;
    };
    const A = makeBars(5, 5), B = makeBars(8, 7);
    const A2 = A.map((bar, i) => i === 3 ? bar.map(([s, l, d], k) => [s, l, k === bar.length - 1 ? d + 2 : d]) : bar);
    const form = [A, A2, B, A];
    form.forEach((sec, si) => sec.forEach((bar, bi) => {
      const base = (si * 4 + bi) * BAR;
      const inst = si === 2 ? st.lead2 : st.lead;
      bar.forEach(([s, l, d]) => ev.push([base + s, inst, deg(d), l, inst === 'pluck' ? 0.16 : inst === 'flute' ? 0.13 : 0.09]));
      // 화음/베이스/드럼
      const chordRoot = st.root - 24 + prog[bi % 4] + (si === 2 ? 0 : 0);
      const minor = (st.mode === 'yu') ? [0, 8].indexOf(prog[bi % 4]) < 0 && prog[bi % 4] !== 3 && prog[bi % 4] !== 10 : prog[bi % 4] === 9;
      const third = minor ? 3 : 4;
      if (st.bass === 'bounce') [[0, 0], [6, 12], [8, 0], [14, 12]].forEach(([s, o]) => ev.push([base + s, 'bass', chordRoot + o, 2, 0.32]));
      else if (st.bass === 'drive') for (let s = 0; s < 16; s += 2) ev.push([base + s, 'bass', chordRoot + (s % 8 === 6 ? 12 : 0), 1.5, 0.28]);
      else if (st.bass === 'ostinato') for (let s = 0; s < 16; s++) if (s % 2 === 0 || s % 8 === 7) ev.push([base + s, 'bass', chordRoot + [0, 0, 12, 0, 7, 0, 12, 3][s % 8], 1, 0.3]);
      else [[0, 0], [8, 7]].forEach(([s, o]) => ev.push([base + s, 'bass', chordRoot + o, 7, 0.25]));
      if (st.pad) [0, third, 7].forEach(o => ev.push([base, 'pad', chordRoot + 24 + o, 15, 0.035]));
      if (st.arp && si !== 0) for (let s = 0; s < 16; s += 2) ev.push([base + s, 'pluck', chordRoot + 36 + [0, third, 7, 12][(s / 2) % 4], 1, 0.05]);
      const last = (si === 3 && bi === 3);
      const D = st.drums;
      if (D === 'pop') { [0, 8].forEach(s => ev.push([base + s, 'kick', 0, 0, 0.5])); [4, 12].forEach(s => ev.push([base + s, 'snare', 0, 0, 0.3])); for (let s = 2; s < 16; s += 4) ev.push([base + s, 'hat', 0, 0, 0.07]); }
      else if (D === 'rock') { [0, 6, 8, 10].forEach(s => ev.push([base + s, 'kick', 0, 0, 0.5])); [4, 12].forEach(s => ev.push([base + s, 'snare', 0, 0, 0.32])); for (let s = 0; s < 16; s += 2) ev.push([base + s, 'hat', 0, 0, 0.06]); }
      else if (D === 'boss') { for (let s = 0; s < 16; s += 4) ev.push([base + s, 'kick', 0, 0, 0.55]); [4, 12, 14].forEach(s => ev.push([base + s, 'snare', 0, 0, 0.3])); for (let s = 0; s < 16; s++) ev.push([base + s, 'hat', 0, 0, s % 2 ? 0.03 : 0.06]); }
      else if (D === 'soft') { ev.push([base, 'kick', 0, 0, 0.35]); ev.push([base + 8, 'hat', 0, 0, 0.08, 1]); ev.push([base + 12, 'snare', 0, 0, 0.12]); }
      if (last && D) [12, 13, 14, 15].forEach(s => ev.push([base + s, 'snare', 0, 0, 0.2 + (s - 12) * 0.04]));
    }));
    return { bpm: st.bpm, steps: 4 * 4 * BAR, ev };
  }

  /* ───────── 재생기 ───────── */
  let song = null, timer = null, stepIdx = 0, nextT = 0, tempoMul = 1, byStep = null, pendingSpec = null;
  function schedule() {
    if (!ctx || !song) return;
    if (ctx.state !== 'running') return;
    const stepDur = 60 / (song.bpm * tempoMul) / 4;
    if (nextT < ctx.currentTime - 0.2) nextT = ctx.currentTime + 0.05;   // 멈춰 있다가 다시 시작될 때 밀린 음을 한꺼번에 내지 않음
    while (nextT < ctx.currentTime + 0.15) {
      const list = byStep[stepIdx % song.steps];
      if (list && !muted && bgmVol > 0) list.forEach(([, inst, n, len, v, open]) => {
        if (inst === 'kick' || inst === 'snare') INST[inst](nextT, v, musicBus);
        else if (inst === 'hat') INST.hat(nextT, v, musicBus, open);
        else INST[inst](nextT, midi(n), len * stepDur, v, musicBus);
      });
      nextT += stepDur; stepIdx++;
    }
  }
  function startSong(s) {
    song = s; byStep = {};
    s.ev.forEach(e => { (byStep[e[0]] = byStep[e[0]] || []).push(e); });
    stepIdx = 0; nextT = ctx.currentTime + 0.06; tempoMul = 1;
    if (timer) clearInterval(timer);
    timer = setInterval(schedule, 30);
  }

  // music(false) 정지 · music(true,'title'|'menu'|'story') · music(true,{stage:n, world:w}) · music(true,{boss:w}) · music(true,{climb:n, world:w})
  function songFor(spec) {
    if (typeof spec === 'string') return compose(spec === 'main' ? 'w1' : spec, spec.length * 13 + 1);
    if (spec && spec.boss) return compose('boss', 100 + spec.boss, { root: [52, 50, 55, 45][(spec.boss - 1) % 4] });
    if (spec && spec.stage !== undefined) {
      const w = 'w' + Math.min(4, Math.max(1, spec.world || 1));
      return compose(w, spec.stage + 1, spec.climb ? { bpm: STYLES[w].bpm + 14, drums: 'rock' } : null);
    }
    return compose('w1', 1);
  }

  // 중국어 발음
  let zhVoice = null;
  function pickVoice() {
    if (!('speechSynthesis' in window)) return null;
    const vs = window.speechSynthesis.getVoices() || [];
    zhVoice = vs.find(v => /zh[-_]CN/i.test(v.lang)) || vs.find(v => /^zh/i.test(v.lang)) || null;
    return zhVoice;
  }
  if ('speechSynthesis' in window) { try { pickVoice(); window.speechSynthesis.onvoiceschanged = pickVoice; } catch (e) { /* 무시 */ } }

  const updateMuteBtn = () => { const b = document.getElementById('mute-btn'); if (b) b.textContent = muted ? '♪✕' : '♪'; };

  DT.Audio = {
    unlock() { ensure(); },
    sfx(name, arg) { try { if (ensure() && SFX[name]) SFX[name](arg); } catch (e) { /* 소리 실패는 무시 */ } },
    music(on, spec) {
      if (timer) { clearInterval(timer); timer = null; }
      song = null; pendingSpec = null;
      if (!on) return;
      // 브라우저가 아직 소리를 허용하지 않았으면(첫 클릭·키 입력 전) 기다렸다가 시작
      if (!ctx || ctx.state !== 'running') { pendingSpec = spec === undefined ? 'w1' : spec; ensure(); if (!ctx || ctx.state !== 'running') return; pendingSpec = null; }
      try { startSong(songFor(spec === undefined ? 'w1' : spec)); } catch (e) { console.warn('[audio]', e); }
    },
    setTempo(mul) { tempoMul = mul || 1; },
    get playing() { return !!(song && timer); },
    get muted() { return muted; },
    toggleMute() {
      muted = !muted;
      S.set('dentree_mute', muted ? '1' : '0');
      if (master) master.gain.value = muted ? 0 : 0.9;
      if (muted && 'speechSynthesis' in window) { try { window.speechSynthesis.cancel(); } catch (e) { /* 무시 */ } }
      updateMuteBtn();
    },
    get bgmVol() { return bgmVol; }, get sfxVol() { return sfxVol; }, get voiceOn() { return voiceOn; },
    setBgmVol(v) { bgmVol = DT.clamp(v, 0, 1); S.set('dentree_bgm', bgmVol); if (musicBus) musicBus.gain.value = 0.42 * bgmVol; },
    setSfxVol(v) { sfxVol = DT.clamp(v, 0, 1); S.set('dentree_sfx', sfxVol); if (sfxBus) sfxBus.gain.value = 0.55 * sfxVol; },
    setVoice(on) { voiceOn = !!on; S.set('dentree_voice', voiceOn ? '1' : '0'); },
    canSpeak() { return voiceOn && 'speechSynthesis' in window && typeof window.SpeechSynthesisUtterance === 'function'; },
    hasZhVoice() { return !!(zhVoice || pickVoice()); },
    speak(text) {
      if (muted || !this.canSpeak()) return false;
      try {
        const u = new window.SpeechSynthesisUtterance(text);
        u.lang = 'zh-CN'; u.rate = 0.8; u.pitch = 1.1;
        if (zhVoice || pickVoice()) u.voice = zhVoice;
        window.speechSynthesis.cancel(); window.speechSynthesis.speak(u);
        return true;
      } catch (e) { return false; }
    }
  };

  function unlockAndPlay() {
    if (!ensure()) return;
    const go = () => { if (pendingSpec !== null && ctx.state === 'running') { const sp = pendingSpec; pendingSpec = null; DT.Audio.music(true, sp); } };
    if (ctx.state === 'running') go(); else ctx.resume().then(go).catch(() => {});
  }
  ['keydown', 'pointerdown', 'touchstart', 'click'].forEach(ev => window.addEventListener(ev, unlockAndPlay, { passive: true }));
  document.addEventListener('visibilitychange', () => {
    if (!ctx) return;
    if (document.hidden) ctx.suspend().catch(() => {}); else ctx.resume().catch(() => {});
  });
  window.addEventListener('load', updateMuteBtn);
})();
