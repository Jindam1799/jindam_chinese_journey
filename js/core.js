/* 공통 설정·유틸리티. 밸런스 조정은 TUNING 값만 바꾸면 됩니다. */
(function () {
  'use strict';
  const DT = (window.DT = window.DT || {});

  DT.VERSION = '0.3.0';
  DT.W = 320;   // 논리 해상도 (16px 타일 20 x 15)
  DT.H = 240;
  DT.TILE = 16;

  // 화면 크기에 맞춰 내부 배율 결정 → 도트는 선명하게, 한글/한자는 고해상도로
  DT.computeZoom = function () {
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    const fit = Math.min(window.innerWidth / DT.W, window.innerHeight / DT.H) * dpr;
    return Math.max(2, Math.min(6, Math.ceil(fit)));
  };
  DT.Z = DT.computeZoom();

  DT.TUNING = {
    GRAVITY: 760,
    PLAYER_SPEED: 92,
    PLAYER_ACCEL: 0.38,      // 지상 가속 (0~1, 클수록 즉각적)
    PLAYER_AIR_ACCEL: 0.22,
    JUMP_VELOCITY: 300,
    JUMP_CUT: 110,           // 점프 버튼을 일찍 떼면 이 속도로 상승이 잘림
    COYOTE_MS: 90,           // 발판에서 떨어진 직후에도 점프 허용
    JUMP_BUFFER_MS: 110,     // 착지 직전 입력도 점프로 인정
    MAX_FALL: 340,

    SEED_VX: 225,            // 씨앗탄 수평 속도
    SEED_VY: -95,            // 씨앗탄 발사 시 위쪽 속도 (포물선)
    SEED_GRAVITY: 470,       // 씨앗탄 전용 중력
    SEED_LIFE: 1500,
    FIRE_INTERVAL: 190,      // 연사 간격(ms)
    FIRE_INTERVAL_POWER: 120,
    MAX_SEEDS: 4,

    HIT_DECAY_DELAY: 1800,   // 마지막 명중 후 이 시간이 지나면 봉인 게이지 감소
    HIT_DECAY_STEP: 600,
    SEAL_TIME: 6500,         // 봉인 유지 시간
    SEAL_WARN: 2000,         // 풀리기 전 경고 시간
    ROLL_SPEED: 235,         // 날아가는 구체 속도
    ROLL_MAX_BOUNCES: 3,     // 벽에 이만큼 튕기면 폭발
    ROLL_MAX_TIME: 4500,
    ANGRY_MULT: 1.45,

    MAX_HP_CAP: 6,
    PUSH_SPEED: 38,          // 구체를 밀 때 속도
    STRIKE_REACH: 22,        // 발차기·주먹이 닿는 거리
    INVINCIBLE_MS: 1600,
    HURRY_TIME: 60000,
    COMBO_BASE: 500          // 연쇄 n번째 = 500 x n 점
  };

  DT.SPR = 1.2; // 캐릭터·몬스터 표시 배율

  DT.ENEMY_DEFS = {
    mush:  { name: '혼동버섯',     hp: 3, speed: 34 },
    gob:   { name: '먹깨비',       hp: 3, speed: 30 },
    thief: { name: '단어도둑',     hp: 4, speed: 52 },
    bird:  { name: '성조새',       hp: 2, speed: 42, fly: true },
    frog:  { name: '병음개구리',   hp: 3, speed: 30 },
    snail: { name: '느림보달팽이', hp: 6, speed: 16 }
  };
  DT.ENEMY_CODES = { m: 'mush', k: 'gob', t: 'thief', b: 'bird', f: 'frog', s: 'snail' };

  /* ── 로그라이크: 기본 능력치 (처음엔 느리고 사거리가 짧음) ── */
  DT.BASE_STATS = {
    dmg: 1, seedVx: 150, fireInterval: 340, move: 82, jump: 300,
    maxHp: 3, sealTime: 6500, multishot: 1, orbSpeed: 235, orbBounces: 3, magnet: 0
  };

  DT.HEROES = [
    { id: 'tuk', name: '툭이', title: '새싹 정령', shot: 'arc', orb: 'roll', desc: '포물선 씨앗탄\n구체는 데굴데굴 굴러가요', color: '#a7f070',
      mods: {} },
    { id: 'pong', name: '퐁이', title: '물방울 정령', shot: 'line', orb: 'wave', desc: '일직선 물방울탄\n구체는 물결이 되어 흘러가요', color: '#73eff7',
      mods: { fireInterval: 0.72, move: 1.14, seedVx: 0.86 } },
    { id: 'doto', name: '도토', title: '도토리 정령', shot: 'roll', orb: 'blast', desc: '굴러가는 도토리탄\n구체가 펑! 주변까지 휩쓸어요', color: '#ffcd75',
      mods: { dmg: 1, fireInterval: 1.25, move: 0.9, maxHp: 1, seedVx: 1.08 } }
  ];

  DT.UPGRADES = [
    { id: 'power',  name: '씨앗 파워',   desc: '공격력 +1',             max: 3, icon: 'seed',   apply: (s) => { s.dmg += 1; } },
    { id: 'range',  name: '멀리 던지기', desc: '사거리 +20%',           max: 4, icon: 'leaf',   apply: (s) => { s.seedVx *= 1.2; } },
    { id: 'rapid',  name: '빠른 손',     desc: '공격 속도 +20%',        max: 4, icon: 'spark',  apply: (s) => { s.fireInterval *= 0.82; } },
    { id: 'speed',  name: '날쌘 발',     desc: '이동 속도 +12%',        max: 3, icon: 'petal',  apply: (s) => { s.move *= 1.12; } },
    { id: 'jump',   name: '구름 점프',   desc: '점프력 +8%',            max: 2, icon: 'bubble', apply: (s) => { s.jump *= 1.08; } },
    { id: 'multi',  name: '쌍둥이 씨앗', desc: '한 번에 1발 더 발사',   max: 2, icon: 'seed2',  apply: (s) => { s.multishot += 1; } },
    { id: 'seal',   name: '단단한 봉인', desc: '봉인 유지 시간 +2초',   max: 2, icon: 'orb',    apply: (s) => { s.sealTime += 2000; } },
    { id: 'heart',  name: '튼튼한 마음', desc: '최대 체력 +1, 모두 회복', max: 2, icon: 'heart', apply: (s, run) => { s.maxHp += 1; run.hp = s.maxHp; } },
    { id: 'orb',    name: '씽씽 구체',   desc: '구체 속도·범위·지속 강화', max: 2, icon: 'ring',  apply: (s) => { s.orbSpeed *= 1.15; s.orbBounces += 1; } },
    { id: 'magnet', name: '조각 자석',   desc: '가까운 조각을 끌어당겨요', max: 2, icon: 'token', apply: (s) => { s.magnet += 45; } },
    { id: 'heal',   name: '꿀물 한 잔',  desc: '체력을 모두 회복',      max: 99, icon: 'heart', apply: (s, run) => { run.hp = s.maxHp; },
      when: (run) => run.hp < run.stats.maxHp }
  ];

  DT.newRun = function (heroId) {
    const hero = DT.HEROES.find(h => h.id === heroId) || DT.HEROES[0];
    const s = Object.assign({}, DT.BASE_STATS);
    const m = hero.mods;
    if (m.fireInterval) s.fireInterval *= m.fireInterval;
    if (m.move) s.move *= m.move;
    if (m.seedVx) s.seedVx *= m.seedVx;
    if (m.dmg) s.dmg += m.dmg;
    if (m.maxHp) s.maxHp += m.maxHp;
    return { hero: hero.id, stats: s, levels: {}, hp: s.maxHp, score: 0, stage: 0, learned: [], maxCombo: 0 };
  };

  // 파워업 카드 3장 뽑기 (최대 레벨 제외)
  DT.rollUpgrades = function (run, n) {
    const pool = DT.UPGRADES.filter(u => (run.levels[u.id] || 0) < u.max && (!u.when || u.when(run)));
    return DT.shuffle(pool).slice(0, n || 3);
  };
  DT.applyUpgrade = function (run, id) {
    const u = DT.UPGRADES.find(x => x.id === id);
    if (!u) return;
    u.apply(run.stats, run);
    run.levels[id] = (run.levels[id] || 0) + 1;
  };

  DT.FONT = {
    ko: '"Do Hyeon","Apple SD Gothic Neo","Malgun Gothic","Noto Sans KR",sans-serif',
    zh: '"ZCOOL KuaiLe","Noto Sans SC","PingFang SC","Microsoft YaHei","Noto Sans CJK SC",sans-serif',
    py: '"Trebuchet MS","Segoe UI","Helvetica Neue",Arial,sans-serif'
  };

  DT.C = {
    ink: 0x1a1c2c, navy: 0x29366f, teal: 0x257179, green: 0x38b764, lime: 0xa7f070,
    yellow: 0xffcd75, orange: 0xef7d57, red: 0xb13e53, cyan: 0x73eff7, white: 0xf4f4f4,
    grey: 0x94b0c2, slate: 0x566c86, dark: 0x333c57
  };

  DT.store = {
    get(k, d) { try { const v = window.localStorage.getItem(k); return v === null ? d : v; } catch (e) { return d; } },
    set(k, v) { try { window.localStorage.setItem(k, String(v)); } catch (e) { /* 저장소 없음 */ } }
  };
  DT.getHi = () => parseInt(DT.store.get('dentree_hi', '10000'), 10) || 10000;
  DT.saveHi = (score) => { if (score > DT.getHi()) DT.store.set('dentree_hi', Math.floor(score)); };

  DT.pad = (n, len) => String(Math.max(0, Math.floor(n))).padStart(len, '0');
  DT.clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  DT.rng = function (seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };
  DT.shuffle = function (arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  };

  // 모바일: 전체화면 + 가로 고정 시도 (지원하지 않는 브라우저는 조용히 무시)
  DT.tryLandscape = function () {
    if (!document.body.classList.contains('touch-on')) return;
    try {
      const el = document.documentElement;
      const req = el.requestFullscreen || el.webkitRequestFullscreen;
      const p = req && !document.fullscreenElement ? req.call(el) : null;
      const lock = () => { if (screen.orientation && screen.orientation.lock) screen.orientation.lock('landscape').catch(() => {}); };
      if (p && p.then) p.then(lock).catch(() => {}); else lock();
    } catch (e) { /* 무시 */ }
  };

  // 모든 씬: 320x240 월드를 Z배 확대해서 보여줌
  DT.setupCamera = function (scene) {
    const cam = scene.cameras.main;
    cam.setZoom(DT.Z);
    cam.centerOn(DT.W / 2, DT.H / 2);
    cam.setRoundPixels(true);
    return cam;
  };

  // 한글/한자 텍스트 (해상도 = 배율이라 확대해도 선명)
  DT.text = function (scene, x, y, str, opt) {
    opt = opt || {};
    const style = {
      fontFamily: DT.FONT[opt.font || 'ko'],
      fontSize: (opt.size || 10) + 'px',
      color: opt.color || '#f4f4f4',
      align: opt.align || 'center'
    };
    if (opt.stroke !== null) {
      style.stroke = opt.stroke || '#1a1c2c';
      style.strokeThickness = opt.strokeThickness === undefined ? 2 : opt.strokeThickness;
    }
    if (opt.wrap) style.wordWrap = { width: opt.wrap, useAdvancedWrap: true };
    const t = scene.add.text(Math.round(x), Math.round(y), str, style);
    t.setResolution(DT.Z);
    if (opt.wrap) t.setWordWrapWidth(opt.wrap, true);
    t.setOrigin(opt.ox === undefined ? 0.5 : opt.ox, opt.oy === undefined ? 0.5 : opt.oy);
    if (opt.depth !== undefined) t.setDepth(opt.depth);
    return t;
  };

  // 오락실 픽셀 폰트 (영문·숫자)
  DT.ptext = function (scene, x, y, str, opt) {
    opt = opt || {};
    const t = scene.add.bitmapText(Math.round(x), Math.round(y), 'pixel', String(str).toUpperCase());
    t.setOrigin(opt.ox || 0, opt.oy || 0);
    if (opt.tint !== undefined) t.setTint(opt.tint);
    if (opt.scale) t.setScale(opt.scale);
    if (opt.depth !== undefined) t.setDepth(opt.depth);
    return t;
  };

  // 도트 느낌의 패널 (모서리를 깎은 사각형)
  DT.panel = function (scene, x, y, w, h, opt) {
    opt = opt || {};
    const g = scene.add.graphics();
    const border = opt.border === undefined ? DT.C.cyan : opt.border;
    const fill = opt.fill === undefined ? DT.C.navy : opt.fill;
    g.fillStyle(DT.C.ink, opt.alpha === undefined ? 1 : opt.alpha);
    g.fillRect(x + 1, y, w - 2, h); g.fillRect(x, y + 1, w, h - 2);
    g.fillStyle(border, 1);
    g.fillRect(x + 2, y + 1, w - 4, h - 2); g.fillRect(x + 1, y + 2, w - 2, h - 4);
    g.fillStyle(fill, 1);
    g.fillRect(x + 3, y + 2, w - 6, h - 4); g.fillRect(x + 2, y + 3, w - 4, h - 6);
    if (opt.shine !== false) { g.fillStyle(0xffffff, 0.12); g.fillRect(x + 3, y + 3, w - 6, 2); }
    if (opt.depth !== undefined) g.setDepth(opt.depth);
    return g;
  };

  // 테마별 배경 파티클 (꽃잎 · 스프링클 · 물방울 · 반짝이 · 눈송이)
  DT.ambient = function (scene, theme, depth) {
    const fall = { y: { min: -10, max: 0 }, x: { min: 0, max: 320 }, rotate: { min: 0, max: 360 }, lifespan: 9000 };
    const cfg = {
      forest: Object.assign({ key: 'petal', speedY: { min: 14, max: 30 }, speedX: { min: -14, max: 10 }, frequency: 520 }, fall),
      guilin: Object.assign({ key: 'petal', speedY: { min: 12, max: 26 }, speedX: { min: -16, max: 6 }, frequency: 650 }, fall),
      zhangjiajie: { key: 'glow', y: { min: 20, max: 220 }, x: { min: 10, max: 310 }, speedY: { min: -8, max: 8 }, speedX: { min: -8, max: 8 }, lifespan: 2600, frequency: 340, alpha: { start: 1, end: 0 } },
      jiuzhaigou: Object.assign({ key: 'maple', speedY: { min: 16, max: 32 }, speedX: { min: -18, max: 8 }, frequency: 420 }, fall),
      huangshan: { key: 'cloudpuff', y: { min: 30, max: 200 }, x: { min: -10, max: 0 }, speedX: { min: 8, max: 18 }, speedY: { min: -2, max: 2 }, lifespan: 22000, frequency: 1400, alpha: { start: 0.8, end: 0.8 } }
    }[theme] || null;
    if (!cfg) return null;
    const key = cfg.key; delete cfg.key;
    return scene.add.particles(0, 0, key, cfg).setDepth(depth || -5);
  };

  // 스테이지 덩어리로 퀴즈 자동 출제 (짝꿍 · 빈칸 · 듣기)
  DT.makeQuiz = function (stage) {
    const D = DT.DATA;
    const hand = (stage.quiz || []).map(id => D.quizById[id]).filter(Boolean);
    if (hand.length) return hand[Math.floor(Math.random() * hand.length)];
    const ids = Array.from(new Set([].concat(...D.stages.filter(s => s.world === stage.world).map(s => s.chunks))));
    const pool = ids.map(id => D.vocabById[id]).filter(Boolean);
    const words = new Set(D.vocab.map(v => v.hanzi));
    const v = D.vocabById[stage.chunks[Math.floor(Math.random() * stage.chunks.length)]];
    const reveal = { hanzi: v.hanzi, pinyin: v.pinyin, meaning: v.meaning };
    const uniq = (a) => Array.from(new Set(a));
    let type = ['pair', 'blank', 'listen'][Math.floor(Math.random() * 3)];
    const first = v.hanzi[0], rest = v.hanzi.slice(1);
    if (type === 'pair') {
      const d = DT.shuffle(uniq(pool.map(x => x.hanzi.slice(1)).filter(x => x !== rest && !words.has(first + x)))).slice(0, 3);
      if (d.length === 3) return { id: 'auto', type, prompt: first + ' + ？', promptKo: '‘' + first + '(' + v.chars[0].p + ')’와 짝이 되는 말을 고르세요.',
        options: [rest].concat(d), answer: rest, hint: v.hanzi + ' ' + v.pinyin + ' = ' + v.meaning, reveal };
      type = 'listen';
    }
    if (type === 'blank') {
      const d = DT.shuffle(uniq(pool.map(x => x.hanzi[0]).filter(x => x !== first && !words.has(x + rest)))).slice(0, 3);
      if (d.length === 3) return { id: 'auto', type, prompt: '＿ + ' + rest, promptKo: '‘' + rest + '’ 앞에 올 말을 고르세요. (' + v.meaning + ')',
        options: [first].concat(d), answer: first, hint: v.hanzi + ' ' + v.pinyin + ' = ' + v.meaning, reveal };
    }
    const d = DT.shuffle(pool.filter(x => x.id !== v.id).map(x => x.hanzi)).slice(0, 3);
    return { id: 'auto', type: 'listen', audio: v.hanzi, audioPinyin: v.pinyin, promptKo: '잘 듣고 알맞은 덩어리를 고르세요.',
      options: [v.hanzi].concat(d), answer: v.hanzi, hint: v.pinyin + ' — ‘' + v.meaning + '’라는 뜻이에요.', reveal };
  };

  // 게임 데이터 검증 (잘못된 JSON이면 기본 데이터 사용)
  DT.validateData = function (d) {
    if (!d || !Array.isArray(d.vocab) || !Array.isArray(d.quiz) || !Array.isArray(d.stages) || !d.stages.length) return false;
    for (const s of d.stages) {
      if (!Array.isArray(s.map) || s.map.length !== 15) return false;
      if (s.map.some(r => typeof r !== 'string' || r.length !== 20)) return false;
      if (!s.map.join('').includes('P')) return false;
    }
    return true;
  };
  DT.prepareData = function (d) {
    d.vocabById = {};
    d.vocab.forEach(v => { d.vocabById[v.id] = v; });
    d.quizById = {};
    d.quiz.forEach(q => { d.quizById[q.id] = q; });
    return d;
  };
})();
