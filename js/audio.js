/* 칩튠 효과음/배경음 (WebAudio로 실시간 합성 → 음원 파일 없음) + 중국어 발음(TTS) */
(function () {
  'use strict';
  const DT = (window.DT = window.DT || {});

  let ctx = null, master = null, sfxBus = null, musicBus = null, noiseBuf = null;
  let muted = DT.store ? DT.store.get('dentree_mute', '0') === '1' : false;
  let musicTimer = null, musicStep = 0, musicNext = 0, musicOn = false;

  function ensure() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      try { ctx = new AC(); } catch (e) { return null; }
      master = ctx.createGain(); master.gain.value = muted ? 0 : 0.9; master.connect(ctx.destination);
      sfxBus = ctx.createGain(); sfxBus.gain.value = 0.55; sfxBus.connect(master);
      musicBus = ctx.createGain(); musicBus.gain.value = 0.2; musicBus.connect(master);
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 0.5, ctx.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    if (ctx.state === 'suspended') { ctx.resume().catch(() => {}); }
    return ctx;
  }

  function tone(o) {
    if (!ctx || muted) return;
    const t0 = ctx.currentTime + (o.t || 0);
    const d = o.d || 0.1;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = o.type || 'square';
    osc.frequency.setValueAtTime(o.f || 440, t0);
    if (o.f2) osc.frequency.exponentialRampToValueAtTime(Math.max(20, o.f2), t0 + d);
    const v = o.v === undefined ? 0.2 : o.v;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(v, t0 + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + d);
    osc.connect(g); g.connect(o.bus || sfxBus);
    osc.start(t0); osc.stop(t0 + d + 0.02);
  }

  function noise(o) {
    if (!ctx || muted) return;
    const t0 = ctx.currentTime + (o.t || 0);
    const d = o.d || 0.1;
    const src = ctx.createBufferSource(); src.buffer = noiseBuf;
    const f = ctx.createBiquadFilter(); f.type = o.filter || 'lowpass';
    f.frequency.setValueAtTime(o.f || 4000, t0);
    if (o.f2) f.frequency.exponentialRampToValueAtTime(o.f2, t0 + d);
    const g = ctx.createGain();
    g.gain.setValueAtTime(o.v === undefined ? 0.25 : o.v, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + d);
    src.connect(f); f.connect(g); g.connect(o.bus || sfxBus);
    src.start(t0); src.stop(t0 + d + 0.02);
  }

  const midi = (n) => 440 * Math.pow(2, (n - 69) / 12);
  const arp = (notes, step, type, v) => notes.forEach((n, i) => tone({ f: midi(n), d: step * 1.6, t: i * step, type: type || 'square', v: v || 0.12 }));

  const SFX = {
    shoot() { tone({ f: 700, f2: 1400, d: 0.07, v: 0.07 }); noise({ d: 0.04, v: 0.05, f: 6000, filter: 'highpass' }); },
    jump() { tone({ f: 330, f2: 760, d: 0.11, v: 0.08, type: 'square' }); },
    land() { noise({ d: 0.05, v: 0.06, f: 900 }); },
    hit(n) { tone({ f: 260 + (n || 0) * 70, f2: 140, d: 0.07, v: 0.12, type: 'square' }); noise({ d: 0.05, v: 0.12, f: 2500 }); },
    seal() { arp([72, 76, 79, 84, 88], 0.045, 'triangle', 0.16); },
    tick() { tone({ f: 1200, d: 0.03, v: 0.05, type: 'square' }); },
    unseal() { tone({ f: 600, f2: 150, d: 0.22, v: 0.12, type: 'sawtooth' }); noise({ d: 0.15, v: 0.1, f: 3000 }); },
    kick() { tone({ f: 180, f2: 620, d: 0.09, v: 0.16, type: 'square' }); noise({ d: 0.08, v: 0.15, f: 1800 }); },
    bump() { tone({ f: 140, f2: 90, d: 0.07, v: 0.12, type: 'triangle' }); },
    kill(n) {
      const base = 64 + Math.min(n || 1, 8) * 2;
      tone({ f: midi(base), f2: midi(base + 12), d: 0.12, v: 0.14 });
      tone({ f: midi(base + 7), d: 0.14, t: 0.05, v: 0.1, type: 'triangle' });
      noise({ d: 0.18, v: 0.18, f: 5000, f2: 400 });
    },
    burst() { noise({ d: 0.4, v: 0.3, f: 3000, f2: 120 }); tone({ f: 120, f2: 40, d: 0.35, v: 0.2, type: 'triangle' }); },
    hurt() { tone({ f: 520, f2: 90, d: 0.32, v: 0.16, type: 'sawtooth' }); noise({ d: 0.12, v: 0.15, f: 1500 }); },
    die() { arp([67, 63, 60, 55, 48], 0.12, 'square', 0.13); },
    collect() { tone({ f: 1046, d: 0.06, v: 0.1 }); tone({ f: 1568, d: 0.1, t: 0.05, v: 0.1 }); },
    chunk() { arp([72, 76, 79, 84, 79, 84, 88], 0.06, 'square', 0.12); },
    steal() { tone({ f: 900, f2: 300, d: 0.2, v: 0.1, type: 'square' }); },
    go() { arp([60, 64, 67, 72], 0.07, 'square', 0.13); },
    hurry() { [0, 0.25, 0.5].forEach(t => tone({ f: 880, d: 0.12, t, v: 0.12 })); },
    clear() { arp([67, 72, 76, 79, 76, 79, 84], 0.09, 'square', 0.13); arp([48, 55, 60, 64], 0.16, 'triangle', 0.14); },
    select() { tone({ f: 880, d: 0.04, v: 0.07 }); },
    right() { arp([76, 80, 83, 88], 0.07, 'square', 0.13); },
    wrong() { tone({ f: 220, f2: 160, d: 0.25, v: 0.14, type: 'sawtooth' }); },
    start() { arp([60, 67, 72, 76, 79, 84], 0.05, 'square', 0.12); },
    blip() { tone({ f: 1320, d: 0.025, v: 0.035, type: 'square' }); },
    rumble() { noise({ d: 1.2, v: 0.35, f: 300, f2: 60 }); tone({ f: 55, f2: 35, d: 1.2, v: 0.25, type: 'sawtooth' }); },
    shatter() { noise({ d: 0.3, v: 0.25, f: 8000, f2: 1500, filter: 'highpass' }); arp([88, 84, 79, 76], 0.04, 'square', 0.08); },
    sparkle() { arp([84, 88, 91, 96, 100], 0.05, 'triangle', 0.1); },
    perfect() { arp([72, 76, 79, 84, 88, 91, 96], 0.05, 'square', 0.13); }
  };

  // ── 배경음: 짧은 오리지널 루프 (150BPM, 8분음표 32스텝) ──
  const LEAD = [72, 0, 76, 79, 81, 79, 76, 0, 74, 0, 76, 74, 72, 0, 69, 0,
                72, 0, 76, 79, 84, 83, 81, 79, 81, 79, 76, 74, 76, 0, 0, 0];
  const BASS = [48, 0, 55, 0, 48, 0, 55, 0, 45, 0, 52, 0, 45, 0, 52, 0,
                41, 0, 48, 0, 41, 0, 48, 0, 43, 0, 50, 0, 43, 0, 47, 0];
  const STEP = 0.2;
  const TRACKS = {
    main: { lead: LEAD, bass: BASS, step: 0.2, leadType: 'square', drums: true },
    story: {
      lead: [69, 72, 76, 72, 69, 72, 76, 79, 65, 69, 72, 69, 65, 69, 72, 76,
             60, 64, 67, 64, 60, 64, 67, 72, 67, 71, 74, 71, 67, 71, 74, 79],
      bass: [45, 0, 0, 0, 0, 0, 0, 0, 41, 0, 0, 0, 0, 0, 0, 0, 48, 0, 0, 0, 0, 0, 0, 0, 43, 0, 0, 0, 0, 0, 0, 0],
      step: 0.24, leadType: 'triangle', drums: false
    }
  };
  let track = TRACKS.main;

  function scheduleMusic() {
    if (!ctx || !musicOn) return;
    while (musicNext < ctx.currentTime + 0.25) {
      const i = musicStep % 32, tr = track, st = tr.step;
      const dt = musicNext - ctx.currentTime;
      if (!muted) {
        if (tr.lead[i]) tone({ f: midi(tr.lead[i]), d: st * (tr.drums ? 0.9 : 1.6), t: dt, v: tr.drums ? 0.09 : 0.11, type: tr.leadType, bus: musicBus });
        if (tr.bass[i]) tone({ f: midi(tr.bass[i]), d: tr.drums ? st * 1.8 : st * 7.5, t: dt, v: 0.22, type: 'triangle', bus: musicBus });
        if (tr.drums && i % 2 === 1) noise({ d: 0.03, v: 0.05, f: 7000, filter: 'highpass', t: dt, bus: musicBus });
        if (tr.drums && i % 8 === 0) noise({ d: 0.08, v: 0.12, f: 400, t: dt, bus: musicBus });
      }
      musicNext += st;
      musicStep++;
    }
  }

  // ── 중국어 발음 (브라우저 TTS) ──
  let zhVoice = null;
  function pickVoice() {
    if (!('speechSynthesis' in window)) return null;
    const vs = window.speechSynthesis.getVoices() || [];
    zhVoice = vs.find(v => /zh[-_]CN/i.test(v.lang)) || vs.find(v => /^zh/i.test(v.lang)) || null;
    return zhVoice;
  }
  if ('speechSynthesis' in window) {
    try { pickVoice(); window.speechSynthesis.onvoiceschanged = pickVoice; } catch (e) { /* 무시 */ }
  }

  DT.Audio = {
    unlock() { ensure(); },
    sfx(name, arg) { try { if (ensure() && SFX[name]) SFX[name](arg); } catch (e) { /* 소리 실패는 무시 */ } },
    music(on, name) {
      musicOn = !!on;
      track = TRACKS[name || 'main'] || TRACKS.main;
      if (musicTimer) { clearInterval(musicTimer); musicTimer = null; }
      if (musicOn && ensure()) {
        musicStep = 0; musicNext = ctx.currentTime + 0.05;
        musicTimer = setInterval(scheduleMusic, 60);
      }
    },
    get muted() { return muted; },
    toggleMute() {
      muted = !muted;
      DT.store.set('dentree_mute', muted ? '1' : '0');
      if (master) master.gain.value = muted ? 0 : 0.9;
      if (muted && 'speechSynthesis' in window) { try { window.speechSynthesis.cancel(); } catch (e) { /* 무시 */ } }
      const b = document.getElementById('mute-btn');
      if (b) b.textContent = muted ? '♪✕' : '♪';
    },
    canSpeak() { return 'speechSynthesis' in window && typeof window.SpeechSynthesisUtterance === 'function'; },
    hasZhVoice() { return !!(zhVoice || pickVoice()); },
    speak(text) {
      if (muted || !this.canSpeak()) return false;
      try {
        const u = new window.SpeechSynthesisUtterance(text);
        u.lang = 'zh-CN'; u.rate = 0.8; u.pitch = 1.1;
        if (zhVoice || pickVoice()) u.voice = zhVoice;
        window.speechSynthesis.cancel();
        window.speechSynthesis.speak(u);
        return true;
      } catch (e) { return false; }
    }
  };

  // 첫 입력 때 오디오 활성화 (브라우저 자동재생 정책)
  ['keydown', 'pointerdown', 'touchstart'].forEach(ev =>
    window.addEventListener(ev, () => ensure(), { passive: true }));
  document.addEventListener('visibilitychange', () => {
    if (!ctx) return;
    if (document.hidden) ctx.suspend().catch(() => {}); else ctx.resume().catch(() => {});
  });
  window.addEventListener('load', () => {
    const b = document.getElementById('mute-btn');
    if (b) b.textContent = muted ? '♪✕' : '♪';
  });
})();
