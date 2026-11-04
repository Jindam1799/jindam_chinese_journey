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

  DT.SettingsScene = SettingsScene;
  DT.HallScene = HallScene;
  DT.NameEntryScene = NameEntryScene;
})();
