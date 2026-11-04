/* 설정 · 명예의 전당 · 이름 입력 */
(function () {
  'use strict';
  const DT = window.DT;
  DT.COPYRIGHT = '© 2026 진담중국어 (Jindam Chinese). All rights reserved.';

  /* ───────── 명예의 전당 기록 ───────── */
  const HOF_KEY = 'dentree_hof';
  const RIVALS = [ // 처음부터 들어 있는 라이벌 기록
    ['PANDA', 'pong', 58000, '3-J'], ['LONG', 'doto', 46500, '3-4'], ['NIHAO', 'tuk', 39200, '2-8'],
    ['JINDM', 'tuk', 31800, '2-6'], ['XIONG', 'doto', 24600, '2-3'], ['MAOMI', 'pong', 18900, '1-8'],
    ['HOUZI', 'tuk', 14200, '1-6'], ['XIAO', 'pong', 10500, '1-J'], ['TUKI', 'tuk', 7300, '1-3'], ['ABC', 'doto', 4200, '1-2']
  ].map(r => ({ name: r[0], hero: r[1], score: r[2], stage: r[3] }));

  DT.HOF = {
    list() {
      let l = null;
      try { l = JSON.parse(DT.store.get(HOF_KEY, 'null')); } catch (e) { l = null; }
      if (!Array.isArray(l) || !l.length) l = RIVALS.slice();
      return l.sort((a, b) => b.score - a.score).slice(0, 10);
    },
    qualifies(score) { const l = this.list(); return score > 0 && (l.length < 10 || score > l[l.length - 1].score); },
    add(entry) {
      const l = this.list(); l.push(entry);
      l.sort((a, b) => b.score - a.score);
      DT.store.set(HOF_KEY, JSON.stringify(l.slice(0, 10)));
      return l.findIndex(e => e === entry);
    },
    top() { const l = this.list(); return l.length ? l[0].score : 0; }
  };
  const oldHi = DT.getHi;
  DT.getHi = () => Math.max(oldHi(), DT.HOF.top());

  /* ───────── 설정 (어느 화면에서든 열 수 있음) ───────── */
  DT.openSettings = function () {
    const g = DT.game; if (!g) return;
    if (g.scene.isActive('Settings')) return;
    const under = g.scene.getScenes(true).map(s => s.sys.settings.key).filter(k => k !== 'Boot');
    under.forEach(k => g.scene.pause(k));
    g.scene.run('Settings', { under });
    g.scene.bringToTop('Settings');
  };

  class SettingsScene extends Phaser.Scene {
    constructor() { super('Settings'); }
    init(d) { this.under = (d && d.under) || []; }
    create() {
      DT.setupCamera(this);
      this.add.rectangle(0, 0, DT.W, DT.H, DT.C.ink, 0.8).setOrigin(0);
      DT.panel(this, 40, 14, 240, 218, { border: DT.C.yellow, fill: DT.C.navy });
      DT.ptext(this, 160, 20, 'SETTINGS', { ox: 0.5, tint: 0xffcd75, scale: 2 });
      DT.text(this, 160, 42, '설정', { font: 'ko', size: 10, color: '#73eff7', stroke: null });
      const A = DT.Audio;
      this.items = [
        { label: '배경 음악', type: 'vol', get: () => A.bgmVol, set: (v) => { A.setBgmVol(v); } },
        { label: '효과음', type: 'vol', get: () => A.sfxVol, set: (v) => { A.setSfxVol(v); A.sfx('collect'); } },
        { label: '중국어 발음 듣기', type: 'bool', get: () => A.voiceOn, set: (v) => { A.setVoice(v); if (v) A.speak('你好'); } },
        { label: '화면 흔들림', type: 'bool', get: () => DT.store.get('dentree_shake', '1') === '1', set: (v) => DT.store.set('dentree_shake', v ? '1' : '0') },
        { label: '스테이지 이야기', type: 'bool', get: () => DT.store.get('dentree_stagestory', '1') === '1', set: (v) => DT.store.set('dentree_stagestory', v ? '1' : '0') },
        { label: '게임 끝내기 (로비로)', type: 'lobby' },
        { label: '돌아가기', type: 'close' }
      ];
      this.sel = 0;
      this.rows = this.items.map((it, i) => {
        const y = 60 + i * 20;
        const bg = this.add.rectangle(56, y - 9, 208, 19, 0xffffff, 0).setOrigin(0);
        const lab = DT.text(this, 64, y, it.label, { font: 'ko', size: 10, color: '#ffffff', stroke: null, ox: 0 });
        const val = DT.text(this, 256, y, '', { font: 'ko', size: 10, color: '#ffcd75', stroke: null, ox: 1 });
        const bar = this.add.graphics();
        const z = this.add.zone(160, y, 208, 20).setInteractive({ useHandCursor: true });
        z.on('pointerdown', (p) => {
          this.sel = i;
          if (it.type === 'vol') { it.set(DT.clamp(Math.round(((p.worldX - 170) / 86) * 10) / 10, 0, 1)); }
          else this.activate();
          this.refresh();
        });
        return { bg, lab, val, bar, y };
      });
      DT.text(this, 160, 206, '↑↓ 고르기 · ←→ 바꾸기 · Z 결정  (모바일: ◀▶ 바꾸기 · 점프 다음 · 공격 결정)', { font: 'ko', size: 6, color: '#94b0c2', stroke: null });
      DT.text(this, 160, 220, DT.COPYRIGHT, { font: 'ko', size: 6, color: '#94b0c2', stroke: null });
      this.refresh();
    }
    refresh() {
      this.items.forEach((it, i) => {
        const r = this.rows[i], on = i === this.sel;
        r.bg.setFillStyle(0xffcd75, on ? 0.18 : 0);
        r.lab.setColor(on ? '#ffcd75' : '#ffffff');
        r.bar.clear();
        if (it.type === 'vol') {
          const v = it.get();
          for (let k = 0; k < 10; k++) { r.bar.fillStyle(k < Math.round(v * 10) ? 0xa7f070 : 0x333c57, 1); r.bar.fillRect(170 + k * 8.6, r.y - 4, 7, 8); }
          r.val.setText('');
        } else if (it.type === 'bool') r.val.setText(it.get() ? '켜기' : '끄기');
        else if (it.type === 'lobby') { const inLobby = this.under.indexOf('Title') >= 0; r.val.setText(inLobby ? '' : (this.confirmLobby ? '한 번 더!' : '▶')); r.lab.setAlpha(inLobby ? 0.4 : 1); }
        else r.val.setText('▶');
      });
    }
    activate() {
      const it = this.items[this.sel];
      if (it.type === 'bool') { it.set(!it.get()); DT.Audio.sfx('select'); }
      else if (it.type === 'close') this.close();
      else if (it.type === 'lobby') {
        if (this.under.indexOf('Title') >= 0) return;
        if (!this.confirmLobby) { this.confirmLobby = true; DT.Audio.sfx('warn'); return; }
        // 진행 중인 판을 끝내고 로비(타이틀)로
        const g = this.game;
        DT.Audio.music(false);
        DT.Audio.setTempo(1);
        g.scene.getScenes(false).forEach(sc => { const k = sc.sys.settings.key; if (k !== 'Settings' && k !== 'Title' && (g.scene.isActive(k) || g.scene.isPaused(k))) g.scene.stop(k); });
        this.scene.stop();
        g.scene.start('Title');
      }
    }
    change(d) {
      const it = this.items[this.sel];
      if (it.type === 'vol') it.set(DT.clamp(Math.round((it.get() + d * 0.1) * 10) / 10, 0, 1));
      else if (it.type === 'bool') it.set(d > 0);
      DT.Audio.sfx('select');
      this.refresh();
    }
    close() {
      const g = this.game;
      this.under.forEach(k => { if (g.scene.isPaused(k)) g.scene.resume(k); });
      this.scene.stop();
    }
    update() {
      DT.Input.update();
      const I = DT.Input, n = this.items.length;
      if (I.justDown('up') || I.justDown('down') || I.justDown('jump')) this.confirmLobby = false;
      if (I.justDown('up')) { this.sel = (this.sel + n - 1) % n; this.refresh(); DT.Audio.sfx('select'); }
      if (I.justDown('down') || I.justDown('jump')) { this.sel = (this.sel + 1) % n; this.refresh(); DT.Audio.sfx('select'); }
      if (I.justDown('left')) this.change(-1);
      if (I.justDown('right')) this.change(1);
      if (I.justDown('fire') || I.justDown('confirm')) { this.activate(); this.refresh(); }
      if (I.justDown('pause')) this.close();
    }
  }

  /* ───────── 명예의 전당 ───────── */
  class HallScene extends Phaser.Scene {
    constructor() { super('Hall'); }
    init(d) { this.highlight = d && d.highlight !== undefined ? d.highlight : -1; this.next = (d && d.next) || 'Title'; }
    create() {
      DT.setupCamera(this);
      this.add.image(0, 0, 'bg_huangshan').setOrigin(0);
      this.add.rectangle(0, 0, DT.W, DT.H, DT.C.ink, 0.55).setOrigin(0);
      const t = DT.ptext(this, 160, 12, 'HALL OF FAME', { ox: 0.5, tint: 0xffcd75, scale: 2 });
      this.tweens.add({ targets: t, alpha: 0.7, yoyo: true, repeat: -1, duration: 500 });
      DT.text(this, 160, 36, '명예의 전당', { font: 'ko', size: 12, color: '#ffffff', strokeThickness: 3 });
      DT.panel(this, 26, 46, 268, 160, { border: DT.C.yellow, fill: DT.C.ink, alpha: 0.9 });
      DT.ptext(this, 40, 52, 'RANK  NAME          SCORE  STAGE', { tint: 0x94b0c2 });
      const medal = [0xffcd75, 0xdfe6f0, 0xef7d57];
      DT.HOF.list().forEach((e, i) => {
        const y = 66 + i * 13.5, on = i === this.highlight;
        const tint = on ? 0xa7f070 : (i < 3 ? medal[i] : 0xf4f4f4);
        if (on) { const r = this.add.rectangle(30, y - 2, 260, 12, 0xa7f070, 0.18).setOrigin(0); this.tweens.add({ targets: r, alpha: 0.3, yoyo: true, repeat: -1, duration: 300 }); }
        DT.ptext(this, 44, y, String(i + 1).padStart(2, ' ') + '.', { tint });
        this.add.image(80, y + 3, 'hero_' + (e.hero || 'tuk'), 0).setScale(0.6);
        DT.ptext(this, 92, y, String(e.name).slice(0, 6), { tint });
        DT.ptext(this, 230, y, DT.pad(e.score, 7), { ox: 1, tint });
        DT.ptext(this, 280, y, e.stage || '', { ox: 1, tint: 0x73eff7 });
      });
      DT.text(this, 160, 216, '공격(Z) 버튼: 돌아가기', { font: 'ko', size: 9, color: '#ffffff', strokeThickness: 2 });
      DT.text(this, 160, 231, DT.COPYRIGHT, { font: 'ko', size: 6, color: '#e8f4ff', strokeThickness: 2 });
      this.ready = false;
      this.time.delayedCall(500, () => { this.ready = true; });
      this.input.on('pointerdown', () => this.leave());
      if (this.highlight >= 0) DT.Audio.sfx('perfect');
    }
    leave() { if (!this.ready) return; this.ready = false; DT.Audio.sfx('select'); this.scene.start(this.next.key || this.next, this.next.data || {}); }
    update() { DT.Input.update(); if (DT.Input.anyStart()) this.leave(); }
  }

  /* ───────── 이름 입력 (오락실 방식) ───────── */
  const CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789♥-.';
  class NameEntryScene extends Phaser.Scene {
    constructor() { super('NameEntry'); }
    init(d) { this.d = d; this.slots = [0, 0, 0, 0, 0]; this.len = 1; this.pos = 0; this.done = false; }
    create() {
      DT.setupCamera(this);
      this.add.image(0, 0, 'bg_guilin').setOrigin(0);
      this.add.rectangle(0, 0, DT.W, DT.H, DT.C.ink, 0.6).setOrigin(0);
      const t = DT.ptext(this, 160, 30, 'NEW RECORD!', { ox: 0.5, tint: 0xa7f070, scale: 0.5 });
      this.tweens.add({ targets: t, scale: 2.5, duration: 400, ease: 'Back.easeOut' });
      DT.text(this, 160, 58, '명예의 전당에 이름을 남겨요!', { font: 'ko', size: 12, color: '#ffffff', strokeThickness: 3 });
      DT.ptext(this, 160, 74, 'SCORE ' + DT.pad(this.d.score, 7), { ox: 0.5, tint: 0xffcd75 });
      this.add.sprite(160, 104, 'hero_' + this.d.hero, 9).setScale(2).play(this.d.hero + '_win');
      this.letters = this.slots.map((_, i) => DT.ptext(this, 112 + i * 24, 130, 'A', { ox: 0.5, tint: 0xffffff, scale: 3 }));
      this.under = this.add.rectangle(0, 156, 16, 3, 0xffcd75).setOrigin(0.5);
      this.tweens.add({ targets: this.under, alpha: 0.2, yoyo: true, repeat: -1, duration: 250 });
      this.endBtn = DT.text(this, 160, 176, '', { font: 'ko', size: 10, color: '#a7f070', strokeThickness: 3 });
      DT.text(this, 160, 196, '←→(↑↓) 글자 바꾸기 · Z 다음 글자 · SPACE 지우기', { font: 'ko', size: 8, color: '#e8f4ff', stroke: null });
      DT.text(this, 160, 208, '모바일: ◀▶ 글자 · 공격 다음 · 점프 지우기', { font: 'ko', size: 8, color: '#e8f4ff', stroke: null });
      this.refresh();
    }
    name() { return this.slots.slice(0, Math.min(5, this.len)).map(i => CHARS[i]).join('').replace(/[.-]+$/, ''); }
    refresh() {
      this.letters.forEach((l, i) => { l.setText(i < this.len ? CHARS[this.slots[i]] : '').setTint(i === this.pos ? 0xffcd75 : 0xffffff); });
      this.under.setX(112 + this.pos * 24).setVisible(this.pos < 5);
      this.endBtn.setText(this.pos >= 5 ? '▶ END  공격(Z) 버튼으로 등록!' : 'Z를 눌러 다음 글자로 (ENTER: 바로 등록)');
    }
    commit() {
      if (this.done) return;
      this.done = true;
      const entry = { name: this.name() || 'TUKI', hero: this.d.hero, score: this.d.score, stage: this.d.stage };
      const rank = DT.HOF.add(entry);
      DT.Audio.sfx('levelup');
      this.time.delayedCall(400, () => this.scene.start('Hall', { highlight: rank, next: this.d.next || 'Title' }));
    }
    update() {
      DT.Input.update();
      if (this.done) return;
      const I = DT.Input;
      if (this.pos < 5) {
        let c = this.slots[this.pos];
        if (I.justDown('right') || I.justDown('up')) c = (c + 1) % CHARS.length;
        if (I.justDown('left') || I.justDown('down')) c = (c + CHARS.length - 1) % CHARS.length;
        if (c !== this.slots[this.pos]) { this.slots[this.pos] = c; DT.Audio.sfx('select'); this.refresh(); }
      }
      if (I.justDown('confirm')) { this.commit(); return; }
      if (I.justDown('fire')) {
        if (this.pos >= 5) { this.commit(); return; }
        this.pos++;
        if (this.pos < 5) { this.len = Math.max(this.len, this.pos + 1); this.slots[this.pos] = this.slots[this.pos - 1]; }
        DT.Audio.sfx('collect'); this.refresh();
      }
      if (I.justDown('jump') && this.pos > 0) { this.pos--; this.len = this.pos + 1; DT.Audio.sfx('bump'); this.refresh(); }
    }
  }


  /* ───────── 도감 (캐릭터 · 몬스터) ───────── */
  const MON_INFO = {
    mush: ['머리에 ?를 띄우며 발판 위를 왔다 갔다 해요. 가끔 깡충 뛰어요.', '구이린'],
    gob: ['먹물로 만들어진 장난꾸러기. 이쪽으로 폴짝폴짝 뛰어와요.', '구이린 · 장자제'],
    thief: ['떨어진 한자 조각을 훔쳐 가요! 빨리 주워야 해요.', '주자이거우 · 황산'],
    bird: ['물결처럼 오르락내리락 날아다녀요. 맞히기 어렵지만 약해요.', '모든 곳'],
    frog: ['한참 웅크렸다가 크게 점프해요. 착지할 곳을 조심!', '장자제 · 주자이거우'],
    snail: ['아주 느리지만 껍데기가 단단해서 여러 번 맞혀야 해요.', '모든 곳'],
    dragon: ['같은 높이에 있으면 반짝인 뒤 입에서 불덩이를 뿜어요.', '주자이거우 · 황산'],
    monkey: ['복숭아를 포물선으로 던져요. 씨앗탄으로 맞혀 없앨 수 있어요.', '장자제 · 주자이거우 · 황산'],
    puppy: ['지나가며 똥을 누고 가요. 밟으면 아야! 체력이 줄어요.', '구이린 · 장자제 · 황산']
  };
  const BOSS_INFO = [
    { kind: 'mush', name: '거대 혼동버섯', tint: 0xe6b8ff, where: '1-8 구이린', desc: '혼란의 포자를 부채꼴로 뿜고, 돌진하고, 충격파 점프를 해요.' },
    { kind: 'gob', name: '왕먹깨비', tint: 0xb8c8ff, where: '2-8 장자제', desc: '먹물 덩어리를 비처럼 던지고 벽까지 돌진해요.' },
    { kind: 'frog', name: '대왕 병음개구리', tint: 0xffd0a0, where: '3-8 주자이거우', desc: '하늘 높이 뛰어올라 착지할 때 충격파를 일으켜요.' },
    { kind: 'thief', name: '도둑대왕', tint: 0xffe08a, where: '4-8 황산', desc: '빠르게 돌진하고 물건을 던지는 숲의 조각 도둑 우두머리.' }
  ];
  const SHOT_TEXT = { arc: '포물선 씨앗탄', line: '일직선 물방울탄', roll: '바닥을 굴러가는 도토리탄' };
  const ORB_TEXT = { roll: '새싹 구체가 데굴데굴 굴러가며 적을 쓰러뜨려요.', wave: '물방울 구체가 물결이 되어 바닥을 따라 흘러가요.', blast: '도토리 구체가 펑! 터지며 주변 적까지 휩쓸어요.' };

  class DexScene extends Phaser.Scene {
    constructor() { super('Dex'); }
    init(d) { this.tab = (d && d.tab) || 'hero'; this.sel = 0; }
    create() {
      DT.setupCamera(this);
      this.add.image(0, 0, 'bg_guilin').setOrigin(0);
      this.add.rectangle(0, 0, DT.W, DT.H, DT.C.ink, 0.5).setOrigin(0);
      this.layer = this.add.container(0, 0);
      this.build();
    }
    entries() {
      if (this.tab === 'hero') return DT.HEROES.map(h => ({ type: 'hero', h }));
      return DT.ENEMY_KINDS.map(k => ({ type: 'mon', k })).concat(BOSS_INFO.map(b => ({ type: 'boss', b })));
    }
    build() {
      this.layer.removeAll(true);
      const L = (o) => { this.layer.add(o); return o; };
      const list = this.entries();
      this.sel = DT.clamp(this.sel, 0, list.length - 1);
      L(DT.text(this, 160, 12, '도감', { font: 'ko', size: 16, color: '#ffcd75', strokeThickness: 4 }));
      // 탭: 캐릭터 / 몬스터 (점프 버튼 또는 탭을 눌러 전환)
      [['hero', '캐릭터', 120], ['mon', '몬스터', 200]].forEach(([k, label, x]) => {
        const on = this.tab === k;
        L(this.add.rectangle(x, 30, 64, 14, on ? 0xffcd75 : 0x1a1c2c, on ? 1 : 0.7));
        L(DT.text(this, x, 30, label, { font: 'ko', size: 9, color: on ? '#1a1c2c' : '#ffffff', stroke: null }));
        L(this.add.zone(x, 30, 64, 14).setInteractive({ useHandCursor: true }).on('pointerdown', () => { if (this.tab !== k) { this.tab = k; this.sel = 0; DT.Audio.sfx('collect'); this.build(); } }));
      });
      // 썸네일 줄
      const n = list.length, w = this.tab === 'hero' ? 40 : 22, x0 = 160 - (n * w) / 2 + w / 2;
      list.forEach((e, i) => {
        const x = x0 + i * w, y = 52, on = i === this.sel;
        L(this.add.rectangle(x, y, w - 3, 22, on ? 0xffcd75 : 0x1a1c2c, on ? 0.9 : 0.7));
        const key = e.type === 'hero' ? 'hero_' + e.h.id : e.type === 'mon' ? e.k : e.b.kind;
        const sp = L(this.add.sprite(x, y, key, 0).setScale(e.type === 'hero' ? 1.2 : 1));
        if (e.type === 'boss') { sp.setTint(e.b.tint); L(this.add.image(x, y - 9, 'crown').setScale(0.6)); }
        L(this.add.zone(x, y, w - 2, 22).setInteractive({ useHandCursor: true }).on('pointerdown', () => { this.sel = i; DT.Audio.sfx('select'); this.build(); }));
      });
      // 상세
      L(DT.panel(this, 14, 68, 292, 142, { border: DT.C.yellow, fill: DT.C.ink, alpha: 0.92 }));
      const e = list[this.sel];
      if (e.type === 'hero') {
        const h = e.h, st = DT.newRun(h.id).stats;
        const big = L(this.add.sprite(64, 124, 'hero_' + h.id, 0).setScale(4)); big.play(h.id + '_run');
        L(this.add.image(64, 180, 'orb_' + h.id).setScale(1.6));
        L(DT.text(this, 118, 82, h.name + '  ·  ' + h.title, { font: 'ko', size: 13, color: h.color, strokeThickness: 3, ox: 0 }));
        L(DT.text(this, 118, 100, '공격: ' + SHOT_TEXT[h.shot], { font: 'ko', size: 9, color: '#ffffff', stroke: null, ox: 0 }));
        L(DT.text(this, 118, 113, '구체: ' + ORB_TEXT[h.orb], { font: 'ko', size: 8, color: '#e8f4ff', stroke: null, ox: 0, wrap: 180, align: 'left' }));
        DT.statBars(st).forEach((b, k) => {
          const by = 140 + k * 12;
          L(DT.text(this, 118, by, b[0], { font: 'ko', size: 8, color: '#ffffff', stroke: null, ox: 0 }));
          L(this.add.rectangle(170, by - 2, 120, 5, 0x333c57).setOrigin(0));
          L(this.add.rectangle(170, by - 2, Math.round(120 * b[1]), 5, Phaser.Display.Color.HexStringToColor(h.color).color).setOrigin(0));
        });
      } else if (e.type === 'mon') {
        const k = e.k, def = DT.ENEMY_DEFS[k], info = MON_INFO[k] || ['', ''];
        const big = L(this.add.sprite(64, 130, k, 0).setScale(4)); big.play(k + '_walk');
        L(this.add.image(64, 130, 'orb_tuk').setScale(4.4).setAlpha(0.25));
        L(DT.text(this, 118, 84, def.name, { font: 'ko', size: 14, color: '#ffcd75', strokeThickness: 3, ox: 0 }));
        L(DT.text(this, 118, 108, info[0], { font: 'ko', size: 9, color: '#ffffff', stroke: null, ox: 0, oy: 0, wrap: 180, align: 'left' }).setOrigin(0, 0));
        L(DT.text(this, 118, 150, '나오는 곳: ' + info[1], { font: 'ko', size: 8, color: '#73eff7', stroke: null, ox: 0 }));
        L(DT.text(this, 118, 164, '봉인까지: ' + def.hp + '번 맞히기', { font: 'ko', size: 8, color: '#a7f070', stroke: null, ox: 0 }));
        for (let i = 0; i < def.hp; i++) L(this.add.image(206 + i * 9, 164, 'heart').setOrigin(0, 0.5));
      } else {
        const b = e.b;
        const big = L(this.add.sprite(64, 168, b.kind, 0).setOrigin(0.5, 1).setScale(5).setTint(b.tint)); big.play(b.kind + '_walk');
        L(this.add.image(64, 168 - 16 * 5 + 6, 'crown').setScale(2));
        L(DT.text(this, 118, 84, b.name, { font: 'ko', size: 14, color: '#ef7d57', strokeThickness: 3, ox: 0 }));
        L(DT.ptext(this, 118, 96, 'BOSS  ' + b.where.split(' ')[0], { tint: 0xb13e53 }));
        L(DT.text(this, 118, 116, b.desc, { font: 'ko', size: 9, color: '#ffffff', stroke: null, ox: 0, oy: 0, wrap: 180, align: 'left' }).setOrigin(0, 0));
        L(DT.text(this, 118, 160, '약점: 졸개를 봉인한 구체로만 공격할 수 있어요!', { font: 'ko', size: 8, color: '#a7f070', stroke: null, ox: 0, wrap: 180, align: 'left' }));
      }
      L(DT.text(this, 160, 218, '←→ 넘기기 · 점프(SPACE) ' + (this.tab === 'hero' ? '몬스터 보기' : '캐릭터 보기') + ' · 공격(Z) 돌아가기', { font: 'ko', size: 8, color: '#ffffff', strokeThickness: 2 }));
      L(DT.text(this, 160, 232, DT.COPYRIGHT, { font: 'ko', size: 6, color: '#e8f4ff', strokeThickness: 2 }));
    }
    update() {
      DT.Input.update();
      const I = DT.Input, n = this.entries().length;
      if (I.justDown('left') || I.justDown('up')) { this.sel = (this.sel + n - 1) % n; DT.Audio.sfx('select'); this.build(); }
      if (I.justDown('right') || I.justDown('down')) { this.sel = (this.sel + 1) % n; DT.Audio.sfx('select'); this.build(); }
      if (I.justDown('jump')) { this.tab = this.tab === 'hero' ? 'mon' : 'hero'; this.sel = 0; DT.Audio.sfx('collect'); this.build(); }
      if (I.justDown('fire') || I.justDown('confirm') || I.justDown('pause')) { DT.Audio.sfx('select'); this.scene.start('Title'); }
    }
  }

  DT.DexScene = DexScene;
  DT.SettingsScene = SettingsScene;
  DT.HallScene = HallScene;
  DT.NameEntryScene = NameEntryScene;
})();
