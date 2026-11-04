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
      DT.text(this, 160, 104, '块  ·  CHUNK  FOREST', { font: 'zh', size: 8, color: '#29366f', stroke: null });

      // 캐릭터
      DT.HEROES.forEach((h, i) => {
        const hs = this.add.sprite(118 + i * 30, 150, 'hero_' + h.id, 0).setScale(2);
        hs.play(h.id + '_idle');
        this.tweens.add({ targets: hs, y: 144, yoyo: true, repeat: -1, duration: 500, delay: i * 160, ease: 'Sine.easeInOut' });
      });
      const orb = this.add.image(206, 152, 'orb').setScale(1.5);
      const inner = this.add.sprite(206, 152, 'mush', 2).setScale(1.2);
      inner.play('mush_struggle');
      this.tweens.add({ targets: [orb, inner], angle: { from: -8, to: 8 }, yoyo: true, repeat: -1, duration: 260 });
      orb.setDepth(1);
      [['mush', 40], ['frog', 84], ['snail', 236], ['bird', 270]].forEach((m, i) => {
        const s = this.add.sprite(m[1], 216, m[0], 0).play(m[0] + '_walk');
        this.tweens.add({ targets: s, x: m[1] + 26, yoyo: true, repeat: -1, duration: 1800 + i * 300, onYoyo: () => s.setFlipX(true), onRepeat: () => s.setFlipX(false) });
      });

      const start = DT.text(this, 160, 182, this.isTouch() ? '공격 버튼을 눌러 시작' : 'Z 키를 눌러 시작', { font: 'ko', size: 12, color: '#f4f4f4', strokeThickness: 3 });
      this.tweens.add({ targets: start, alpha: 0.15, yoyo: true, repeat: -1, duration: 450 });
      DT.text(this, 160, 198, '← →  이동     SPACE  점프     Z  씨앗탄', { font: 'ko', size: 8, color: '#ffffff', stroke: '#1a1c2c', strokeThickness: 2 });
      DT.text(this, 160, 210, this.isTouch() ? '점프 버튼: 스토리 보기' : 'SPACE: 스토리 보기', { font: 'ko', size: 8, color: '#ffcd75', stroke: '#1a1c2c', strokeThickness: 2 });
      DT.ptext(this, 4, 3, 'HI ' + DT.pad(DT.getHi(), 7), { tint: 0xffcd75 });
      DT.ptext(this, 316, 3, 'V' + DT.VERSION, { ox: 1, tint: 0x566c86 });
      DT.text(this, 160, 232, '© 진담중국어  ·  PROTOTYPE', { font: 'ko', size: 7, color: '#ffffff', stroke: '#1a1c2c', strokeThickness: 2 });

      this.starting = false;
      this.input.on('pointerdown', () => this.begin());
      DT.Audio.music(false);
    }
    isTouch() { return ('ontouchstart' in window) || navigator.maxTouchPoints > 0; }
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
      if (DT.Input.justDown('jump')) this.begin(true);
      else if (DT.Input.justDown('fire') || DT.Input.justDown('confirm')) this.begin(false);
    }
  }

  class GameOverScene extends Phaser.Scene {
    constructor() { super('GameOver'); }
    init(d) { this.run = (d && d.run) || DT.newRun('tuk'); this.d = { score: this.run.score }; }
    create() {
      DT.setupCamera(this);
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
      this.input.on('pointerdown', () => this.retry());
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
      if (DT.Input.anyStart()) this.retry();
    }
  }

  class EndingScene extends Phaser.Scene {
    constructor() { super('Ending'); }
    init(d) { const r = (d && d.run) || DT.newRun('tuk'); this.d = { score: r.score, maxCombo: r.maxCombo, learned: r.learned }; }
    create() {
      DT.setupCamera(this);
      this.add.image(0, 0, 'bg_huangshan').setOrigin(0);
      DT.saveHi(this.d.score || 0);
      DT.Audio.sfx('perfect');
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
      this.input.on('pointerdown', () => this.ready && this.scene.start('Title'));
    }
    update() {
      DT.Input.update();
      if (this.ready && DT.Input.anyStart()) this.scene.start('Title');
    }
  }

  DT.BootScene = BootScene;
  DT.TitleScene = TitleScene;
  DT.GameOverScene = GameOverScene;
  DT.EndingScene = EndingScene;
})();
