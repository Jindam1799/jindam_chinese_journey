/* 부트 · 타이틀 · 게임오버 · 엔딩 씬 */
(function () {
  'use strict';
  const DT = window.DT;

  class BootScene extends Phaser.Scene {
    constructor() { super('Boot'); }
    preload() {
      DT.setLoading(80, '이펙트 불러오는 중…');
      DT.FX.preload(this);
    }
    create() {
      DT.setLoading(88, '도트 그래픽 생성 중…');
      DT.Art.build(this);
      DT.FX.build(this);
      DT.setLoading(100, '완료!');
      DT.hideLoading();
      this.scene.launch('Overlay');
      this.scene.start('Title');
    }
  }

  class TitleScene extends Phaser.Scene {
    constructor() { super('Title'); }
    create() {
      DT.setupCamera(this);
      this.add.image(0, 0, 'bg_forest').setOrigin(0);
      for (let c = 0; c < 20; c++) this.add.image(c * 16, 224, 'groundTop_forest', c % 4).setOrigin(0);
      DT.ambient(this, 'forest', 0);

      // 로고
      const shadow = DT.text(this, 162, 58, '덩어리 숲', { font: 'ko', size: 38, color: '#257179', stroke: '#1a1c2c', strokeThickness: 6 });
      const logo = DT.text(this, 160, 56, '덩어리 숲', { font: 'ko', size: 38, color: '#a7f070', stroke: '#1a1c2c', strokeThickness: 6 });
      this.tweens.add({ targets: [logo, shadow], y: '-=3', yoyo: true, repeat: -1, duration: 900, ease: 'Sine.easeInOut' });
      DT.text(this, 160, 88, '사라진 말의 조각', { font: 'ko', size: 14, color: '#ffcd75', strokeThickness: 3 });

      // 말의 나무: 로고 아래에 조용히 서서 반짝이는 열매를 떨어뜨림
      const tree = this.add.image(160, 225, 'tree').setOrigin(0.5, 1).setScale(0.72).setAlpha(0.95);
      this.tweens.add({ targets: tree, scaleX: 0.73, yoyo: true, repeat: -1, duration: 2400, ease: 'Sine.easeInOut' });
      this.add.particles(0, 0, 'glow', {
        x: { min: 115, max: 205 }, y: { min: 120, max: 160 }, lifespan: 2600, frequency: 260,
        speedY: { min: 6, max: 18 }, speedX: { min: -6, max: 6 }, alpha: { start: 1, end: 0 }, scale: { start: 1, end: 0.4 }
      });
      [['mush', 40], ['frog', 84], ['snail', 236], ['bird', 270]].forEach((m, i) => {
        const s = this.add.sprite(m[1], 216, m[0], 0).play(m[0] + '_walk');
        this.tweens.add({ targets: s, x: m[1] + 26, yoyo: true, repeat: -1, duration: 1800 + i * 300, onYoyo: () => s.setFlipX(true), onRepeat: () => s.setFlipX(false) });
      });

      // 메뉴: 게임 시작 · 도감 · 명예의 전당 · 설정
      this.menu = [['게임 시작', 'start'], ['도감', 'dex'], ['명예의 전당', 'hall'], ['설정', 'settings']].map((m, i) => {
        const x = 52 + i * 72;
        const t = DT.text(this, x, 182, m[0], { font: 'ko', size: 11, color: '#ffffff', strokeThickness: 3 });
        this.add.zone(x, 182, 66, 18).setInteractive({ useHandCursor: true }).on('pointerdown', (p, lx, ly, ev) => { if (ev) ev.stopPropagation(); this.sel = i; this.pick(); });
        return { t, act: m[1], x };
      });
      this.sel = 0;
      this.cursor = this.add.image(0, 182, 'cursor').setOrigin(1, 0.5);
      this.tweens.add({ targets: this.cursor, alpha: 0.3, yoyo: true, repeat: -1, duration: 300 });
      this.refreshMenu();
      DT.text(this, 160, 198, '← →  이동     SPACE  점프     Z  씨앗탄', { font: 'ko', size: 8, color: '#ffffff', stroke: '#1a1c2c', strokeThickness: 2 });
      DT.text(this, 160, 211, this.isTouch() ? '◀▶ 메뉴 고르기 · 공격 버튼 결정' : '←→ 메뉴 고르기 · Z 결정', { font: 'ko', size: 8, color: '#ffcd75', stroke: '#1a1c2c', strokeThickness: 2 });
      DT.ptext(this, 4, 3, 'HI ' + DT.pad(DT.getHi(), 7), { tint: 0xffcd75 });
      DT.ptext(this, 4, 12, 'V' + DT.VERSION, { tint: 0x566c86 });
      DT.text(this, 160, 231, DT.COPYRIGHT, { font: 'ko', size: 7, color: '#ffffff', stroke: '#1a1c2c', strokeThickness: 2 });

      this.starting = false;
      DT.Audio.music(true, 'title');
    }
    isTouch() { return ('ontouchstart' in window) || navigator.maxTouchPoints > 0; }
    refreshMenu() {
      this.menu.forEach((m, i) => m.t.setColor(i === this.sel ? '#ffcd75' : '#ffffff').setScale(i === this.sel ? 1.12 : 1));
      const m = this.menu[this.sel];
      this.cursor.setX(m.x - m.t.width * 0.56 - 1);
    }
    pick() {
      const a = this.menu[this.sel].act;
      if (a === 'start') this.begin(false);
      else if (a === 'dex') { DT.Audio.sfx('select'); this.scene.start('Dex', { tab: 'hero' }); }
      else if (a === 'hall') { DT.Audio.sfx('select'); this.scene.start('Hall', { next: 'Title' }); }
      else if (a === 'settings') { DT.Audio.unlock(); DT.openSettings(); }
    }
    begin(story) {
      if (this.starting) return;
      this.starting = true;
      DT.Audio.unlock();
      DT.tryLandscape();
      DT.Audio.sfx('start');
      this.cameras.main.flash(150, 255, 255, 255);
      this.time.delayedCall(350, () => {
        if (story) this.scene.start('Intro', { next: 'Title' });
        else this.scene.start('Select');
      });
    }
    update() {
      DT.Input.update();
      const I = DT.Input, n = this.menu.length;
      if (I.justDown('left') || I.justDown('up')) { this.sel = (this.sel + n - 1) % n; this.refreshMenu(); DT.Audio.sfx('select'); }
      if (I.justDown('right') || I.justDown('down')) { this.sel = (this.sel + 1) % n; this.refreshMenu(); DT.Audio.sfx('select'); }
      if (I.justDown('fire') || I.justDown('confirm')) this.pick();
    }
  }

  class GameOverScene extends Phaser.Scene {
    constructor() { super('GameOver'); }
    init(d) { this.run = (d && d.run) || DT.newRun('tuk'); this.d = { score: this.run.score }; this.recorded = !!(d && d.recorded); }
    create() {
      DT.setupCamera(this);
      if (!this.recorded && DT.HOF.qualifies(this.run.score)) {
        const st = DT.DATA.stages[this.run.stage];
        this.scene.start('NameEntry', { score: this.run.score, hero: this.run.hero, stage: st ? st.id : '', next: { key: 'GameOver', data: { run: this.run, recorded: true } } });
        return;
      }
      this.add.rectangle(0, 0, DT.W, DT.H, DT.C.ink, 1).setOrigin(0);
      const go = DT.ptext(this, 160, 60, 'GAME OVER', { ox: 0.5, oy: 0.5, tint: 0xb13e53, scale: 0.5 });
      this.tweens.add({ targets: go, scale: 3, duration: 500, ease: 'Bounce.easeOut' });
      DT.ptext(this, 160, 92, 'SCORE ' + DT.pad(this.d.score || 0, 7), { ox: 0.5, tint: 0xf4f4f4 });
      DT.ptext(this, 160, 104, 'HI    ' + DT.pad(DT.getHi(), 7), { ox: 0.5, tint: 0xffcd75 });
      const tuk = this.add.sprite(160, 132, 'hero_' + this.run.hero, 8).setScale(2);
      this.tweens.add({ targets: tuk, angle: { from: -6, to: 6 }, yoyo: true, repeat: -1, duration: 300 });
      this.count = 9;
      this.cont = DT.ptext(this, 160, 162, 'CONTINUE? 9', { ox: 0.5, tint: 0x73eff7, scale: 2 });
      DT.text(this, 160, 186, '공격(Z) 버튼: 이 스테이지 다시 도전', { font: 'ko', size: 9, color: '#f4f4f4', stroke: null });
      DT.text(this, 160, 200, '파워업은 그대로! 점수는 0부터 다시 시작해요', { font: 'ko', size: 8, color: '#94b0c2', stroke: null });
      this.timer = this.time.addEvent({
        delay: 1000, repeat: 9, callback: () => {
          this.count--;
          if (this.count >= 0) { this.cont.setText('CONTINUE? ' + this.count); DT.Audio.sfx('tick'); }
          else this.scene.start('Title');
        }
      });
      this.ready = false;
      this.time.delayedCall(600, () => { this.ready = true; });
      this.input.on('pointerdown', () => { if (!DT.overlayJustClicked()) this.retry(); });
    }
    retry() {
      if (!this.ready) return;
      this.ready = false;
      DT.Audio.sfx('start');
      this.run.score = 0; this.run.hp = this.run.stats.maxHp;
      this.scene.start('Game', { run: this.run });
    }
    update() {
      DT.Input.update();
      if (this.cont && DT.Input.anyStart()) this.retry();
    }
  }

  class EndingScene extends Phaser.Scene {
    constructor() { super('Ending'); }
    init(d) { const r = this.run = (d && d.run) || DT.newRun('tuk'); this.d = { score: r.score, maxCombo: r.maxCombo, learned: r.learned }; }
    create() {
      DT.setupCamera(this);
      this.add.image(0, 0, 'bg_huangshan').setOrigin(0);
      DT.saveHi(this.d.score || 0);
      DT.Audio.sfx('perfect');
      DT.Audio.music(true, 'title');
      DT.panel(this, 30, 16, 260, 208, { border: DT.C.yellow, fill: DT.C.ink, alpha: 0.95 });
      const t = DT.ptext(this, 160, 28, 'ALL CLEAR!', { ox: 0.5, tint: 0xffcd75, scale: 0.5 });
      this.tweens.add({ targets: t, scale: 2.5, duration: 400, ease: 'Back.easeOut' });
      DT.text(this, 160, 52, '프로토타입을 모두 클리어했어요!', { font: 'ko', size: 10, color: '#a7f070', stroke: null });
      DT.ptext(this, 160, 64, 'SCORE ' + DT.pad(this.d.score || 0, 7) + '   MAX COMBO ' + (this.d.maxCombo || 0), { ox: 0.5, tint: 0xf4f4f4 });
      DT.text(this, 160, 82, '이번에 모은 덩어리', { font: 'ko', size: 9, color: '#73eff7', stroke: null });
      const learned = (this.d.learned || []).map(id => DT.DATA.vocabById[id]).filter(Boolean);
      if (!learned.length) DT.text(this, 160, 110, '(아직 없음 — 조각을 모아 보세요!)', { font: 'ko', size: 9, color: '#94b0c2', stroke: null });
      learned.slice(0, 15).forEach((v, i) => {
        const col = i % 3, row = Math.floor(i / 3);
        const x = 40 + col * 82, y = 98 + row * 20;
        DT.text(this, x, y, v.hanzi, { font: 'zh', size: 11, color: '#ffcd75', ox: 0 });
        DT.text(this, x + 26, y - 3, v.pinyin, { font: 'py', size: 6, color: '#f4f4f4', stroke: null, ox: 0 });
        DT.text(this, x + 26, y + 4, v.meaning, { font: 'ko', size: 6, color: '#94b0c2', stroke: null, ox: 0 });
      });
      const s = DT.text(this, 160, 208, '공격(Z) 버튼: 처음부터', { font: 'ko', size: 10, color: '#f4f4f4' });
      this.tweens.add({ targets: s, alpha: 0.2, yoyo: true, repeat: -1, duration: 450 });
      this.ready = false;
      this.time.delayedCall(1200, () => { this.ready = true; });
      DT.text(this, 160, 232, DT.COPYRIGHT, { font: 'ko', size: 6, color: '#e8f4ff', strokeThickness: 2 });
      this.input.on('pointerdown', () => this.ready && !DT.overlayJustClicked() && this.leave());
    }
    leave() {
      this.ready = false;
      if (DT.HOF.qualifies(this.d.score)) this.scene.start('NameEntry', { score: this.d.score, hero: this.run.hero, stage: 'CLEAR', next: 'Title' });
      else this.scene.start('Hall', { next: 'Title' });
    }
    update() {
      DT.Input.update();
      if (this.ready && DT.Input.anyStart()) this.leave();
    }
  }

  DT.BootScene = BootScene;
  DT.TitleScene = TitleScene;
  DT.GameOverScene = GameOverScene;
  DT.EndingScene = EndingScene;
})();
