/* 스토리 컷신: 6컷 도트 연출 + 타자기 자막
   Z(공격)/탭: 다음 · SPACE(점프)/SKIP: 건너뛰기 */
(function () {
  'use strict';
  const DT = window.DT;

  const LINES = [
    '옛날 옛적, 말이 ‘덩어리’로 열리는 신기한 숲이 있었어요.\n말의 나무에는 喝水, 吃饭 같은 말 덩어리가 주렁주렁!',
    '숲의 친구들은 덩어리 말을 주고받으며\n사이좋게 이야기했지요.',
    '그런데 어느 날 밤, 땅속 깊은 곳에서\n거대 혼동버섯이 깨어났어요!',
    '혼란의 포자가 퍼지자 덩어리들은 산산조각!\n몬스터들이 조각을 몽땅 가져가 버렸어요.',
    '그때, 말의 나무가 마지막 힘으로 씨앗 세 알을 떨어뜨렸어요.\n새싹 툭이, 물방울 퐁이, 도토리 도토가 태어났어요!',
    '“씨앗탄으로 봉인하고, 몸으로 밀어서 날려 버리자!\n사라진 말의 조각을 모두 되찾을 거야!”'
  ];

  class IntroScene extends Phaser.Scene {
    constructor() { super('Intro'); }
    init(d) { this.nextKey = (d && d.next) || 'Title'; this.nextData = (d && d.data) || {}; }

    create() {
      DT.setupCamera(this);
      this.layer = this.add.container(0, 0);
      this.shot = -1; this.typing = false; this.ending = false;
      // 영화 같은 위아래 검은 띠 + 자막
      this.add.rectangle(0, 0, DT.W, 22, 0x000000).setOrigin(0).setDepth(50);
      this.add.rectangle(0, 192, DT.W, 48, 0x000000).setOrigin(0).setDepth(50);
      this.sub = DT.text(this, 160, 214, '', { font: 'ko', size: 10, color: '#ffffff', stroke: null, align: 'center', depth: 51 });
      this.sub.setLineSpacing(3);
      this.hint = DT.ptext(this, 316, 232, 'Z NEXT  SPACE SKIP', { ox: 1, oy: 1, tint: 0x566c86, depth: 51 });
      const skip = DT.ptext(this, 314, 7, 'SKIP >>', { ox: 1, tint: 0xffcd75, depth: 52 });
      this.add.zone(290, 11, 60, 20).setDepth(52).setInteractive({ useHandCursor: true }).on('pointerdown', (p, x, y, ev) => { ev && ev.stopPropagation && ev.stopPropagation(); this.finish(); });
      this.tweens.add({ targets: skip, alpha: 0.4, yoyo: true, repeat: -1, duration: 600 });
      this.input.on('pointerdown', (p) => { if (p.worldY > 22 || p.worldX < 260) this.advance(); });
      DT.Audio.music(true, 'story');
      this.orbit = [];
      this.nextShot();
    }

    add2(o) { this.layer.add(o); return o; }

    chunk(x, y, label) {
      const c = this.add.container(x, y);
      c.add(this.add.image(0, 0, 'chunkTok'));
      c.add(DT.text(this, 0, 1, label, { font: 'zh', size: 9, color: '#1a1c2c', stroke: null }));
      return this.add2(c);
    }

    nextShot() {
      this.shot++;
      if (this.shot >= LINES.length) { this.finish(); return; }
      const cam = this.cameras.main;
      const build = () => {
        this.tweens.killAll(); this.time.removeAllEvents();
        this.layer.removeAll(true); this.orbit = [];
        this['shot' + this.shot]();
        this.type(LINES[this.shot]);
        cam.fadeIn(300, 0, 0, 0);
      };
      if (this.shot === 0) build();
      else { cam.fadeOut(260, 0, 0, 0); cam.once('camerafadeoutcomplete', build); }
    }

    type(str) {
      this.full = str; this.shown = 0; this.typing = true; this.autoAt = 0;
      this.sub.setText('');
      this.typeTimer = this.time.addEvent({ delay: 38, loop: true, callback: () => {
        this.shown++;
        this.sub.setText(this.full.slice(0, this.shown));
        if (this.shown % 2 === 0 && this.full[this.shown] && this.full[this.shown].trim()) DT.Audio.sfx('blip');
        if (this.shown >= this.full.length) this.doneTyping();
      } });
    }
    doneTyping() {
      if (this.typeTimer) this.typeTimer.remove();
      this.typing = false;
      this.sub.setText(this.full);
      this.autoAt = this.time.now + 2600;
    }
    advance() {
      if (this.ending) return;
      if (this.typing) this.doneTyping();
      else this.nextShot();
    }
    finish() {
      if (this.ending) return;
      this.ending = true;
      DT.store.set('dentree_story', '1');
      DT.Audio.music(false);
      const cam = this.cameras.main;
      cam.fadeOut(400, 0, 0, 0);
      cam.once('camerafadeoutcomplete', () => this.scene.start(this.nextKey, this.nextData));
    }

    /* ── 컷 1: 평화로운 말의 나무 ── */
    shot0() {
      this.add2(this.add.image(0, 0, 'bg_forest').setOrigin(0));
      this.add2(this.add.image(160, 194, 'tree').setOrigin(0.5, 1));
      ['喝水', '吃饭', '看书', '听歌', '唱歌'].forEach((w, i) => this.orbit.push({ o: this.chunk(160, 90, w), a: i * 1.256, rx: 92, ry: 34, cy: 92, sp: 0.012 }));
      this.add2(DT.ambient(this, 'forest', 1));
      this.layer.setScale(1.08).setPosition(-13, -6);
      this.tweens.add({ targets: this.layer, scale: 1, x: 0, y: 0, duration: 5000, ease: 'Sine.easeOut' });
    }
    /* ── 컷 2: 덩어리 말을 주고받는 친구들 ── */
    shot1() {
      this.add2(this.add.image(0, 0, 'bg_jiuzhaigou').setOrigin(0));
      const a = this.add2(this.add.sprite(96, 170, 'mush', 0).setScale(2.4));
      const b = this.add2(this.add.sprite(224, 170, 'frog', 0).setScale(2.4).setFlipX(true));
      [a, b].forEach((s, i) => this.tweens.add({ targets: s, y: 164, yoyo: true, repeat: -1, duration: 400, delay: i * 200 }));
      const pass = (from, to, word, delay) => {
        const c = this.chunk(from, 128, word);
        c.setAlpha(0);
        this.tweens.add({ targets: c, alpha: 1, x: to, delay, duration: 1100, ease: 'Sine.easeInOut',
          onUpdate: (tw) => { c.y = 128 - Math.sin(tw.progress * Math.PI) * 30; },
          onComplete: () => { DT.Audio.sfx('collect'); this.tweens.add({ targets: c, alpha: 0, duration: 300 }); } });
      };
      pass(110, 210, '喝水', 300); pass(210, 110, '吃饭', 1700); pass(110, 210, '看书', 3100);
      const heart = this.add2(this.add.image(160, 96, 'heart').setScale(2).setAlpha(0));
      this.tweens.add({ targets: heart, alpha: 1, y: 86, delay: 900, duration: 500, yoyo: true, repeat: 2 });
    }
    /* ── 컷 3: 거대 혼동버섯 등장 ── */
    shot2() {
      this.add2(this.add.image(0, 0, 'bg_night').setOrigin(0));
      this.add2(this.add.image(160, 194, 'tree').setOrigin(0.5, 1).setTint(0x6a6a9a).setAlpha(0.6));
      const boss = this.add2(this.add.sprite(160, 270, 'mush', 0).setScale(5).setOrigin(0.5, 1).setTint(0xc9a0ff));
      this.time.delayedCall(400, () => { DT.Audio.sfx('rumble'); this.cameras.main.shake(1200, 0.006); });
      this.tweens.add({ targets: boss, y: 196, delay: 400, duration: 1400, ease: 'Back.easeOut' });
      const eyes = this.add2(this.add.rectangle(160, 160, 30, 4, 0xff3355).setAlpha(0));
      this.tweens.add({ targets: eyes, alpha: 1, delay: 1900, duration: 120, yoyo: true, repeat: 5 });
      const spores = this.add.particles(0, 0, 'glow', {
        x: { min: 110, max: 210 }, y: { min: 120, max: 150 }, lifespan: 2400, frequency: 40, emitting: false,
        speedX: { min: -70, max: 70 }, speedY: { min: -50, max: 10 }, tint: [0xb55088, 0xc9a0ff, 0x73eff7], alpha: { start: 1, end: 0 }
      });
      this.add2(spores);
      this.time.delayedCall(1700, () => spores.start());
    }
    /* ── 컷 4: 덩어리가 산산조각, 몬스터가 조각을 가져감 ── */
    shot3() {
      this.add2(this.add.image(0, 0, 'bg_night').setOrigin(0));
      const words = ['喝水', '吃饭', '看书', '唱歌'];
      words.forEach((w, i) => {
        const x = 52 + i * 72, c = this.chunk(x, 84, w);
        this.tweens.add({ targets: c, x: x + 2, yoyo: true, repeat: 6, duration: 50, delay: 300 + i * 250 });
        this.time.delayedCall(800 + i * 250, () => {
          c.destroy(); DT.Audio.sfx('shatter');
          this.cameras.main.shake(120, 0.004);
          [-1, 1].forEach((d, k) => {
            const t = this.add2(this.add.image(x, 84, 'token'));
            const l = this.add2(DT.text(this, x, 85, w[k], { font: 'zh', size: 9, color: '#1a1c2c', stroke: null }));
            this.tweens.add({ targets: [t, l], x: x + d * 22, y: 112 + Math.random() * 30, angle: d * 40, duration: 600, ease: 'Cubic.easeOut' });
            this.tweens.add({ targets: [t, l], x: -40, y: 170, delay: 1500 + i * 120, duration: 1400, ease: 'Cubic.easeIn' });
          });
        });
      });
      ['thief', 'gob', 'bird', 'mush'].forEach((k, i) => {
        const m = this.add2(this.add.sprite(360 + i * 34, k === 'bird' ? 120 : 176, k, 0).setScale(2).setFlipX(true));
        m.play(k + '_walk');
        this.tweens.add({ targets: m, x: -60, delay: 1700 + i * 140, duration: 2600 });
      });
    }
    /* ── 컷 5: 씨앗 세 알 → 주인공 탄생 ── */
    shot4() {
      this.add2(this.add.image(0, 0, 'bg_forest').setOrigin(0));
      const tree = this.add2(this.add.image(160, 194, 'tree').setOrigin(0.5, 1));
      this.tweens.add({ targets: tree, alpha: 0.75, yoyo: true, repeat: -1, duration: 300 });
      DT.HEROES.forEach((h, i) => {
        const x = 110 + i * 50;
        const seed = this.add2(this.add.image(160, 60, 'seed_' + h.id).setScale(2));
        this.tweens.add({ targets: seed, x, y: 176, delay: 500 + i * 450, duration: 900, ease: 'Bounce.easeOut',
          onComplete: () => {
            seed.destroy();
            DT.Audio.sfx('sparkle');
            this.cameras.main.flash(120, 255, 255, 220);
            const r = this.add2(this.add.sprite(x, 176, 'ring', 0).setTint(0xffcd75).setScale(1.4)); r.play('fx_ring');
            const hs = this.add2(this.add.sprite(x, 176, 'hero_' + h.id, 9).setScale(2.4));
            hs.play(h.id + '_win');
            this.tweens.add({ targets: hs, y: 160, yoyo: true, duration: 260, ease: 'Quad.easeOut' });
            this.add2(DT.text(this, x, 132, h.name, { font: 'ko', size: 10, color: h.color, strokeThickness: 3 }));
          } });
      });
    }
    /* ── 컷 6: 결심! 봉인 시범 ── */
    shot5() {
      this.add2(this.add.image(0, 0, 'bg_guilin').setOrigin(0));
      const hero = this.add2(this.add.sprite(80, 168, 'hero_tuk', 0).setScale(2.4));
      hero.play('tuk_idle');
      const mon = this.add2(this.add.sprite(236, 168, 'mush', 0).setScale(2.4).setFlipX(true));
      mon.play('mush_walk');
      const shell = this.add2(this.add.image(236, 168, 'orb').setScale(2.4).setAlpha(0));
      for (let i = 0; i < 3; i++) {
        this.time.delayedCall(500 + i * 380, () => {
          hero.setFrame(7);
          DT.Audio.sfx('shoot');
          const s = this.add2(this.add.image(96, 170, 'seed_tuk').setScale(2));
          this.tweens.addCounter({ from: 0, to: 1, duration: 420, onUpdate: (tw) => {
            const t = tw.getValue(); s.x = 96 + (226 - 96) * t; s.y = 170 - Math.sin(t * Math.PI) * 26; s.angle = t * 540;
          }, onComplete: () => {
            s.destroy(); DT.Audio.sfx('hit', i + 1);
            mon.setTintFill(0xffffff); this.time.delayedCall(60, () => mon.clearTint());
            shell.setAlpha(0.3 + i * 0.3);
            if (i === 2) { DT.Audio.sfx('seal'); mon.play('mush_struggle'); this.tweens.add({ targets: [shell, mon], angle: { from: -8, to: 8 }, yoyo: true, repeat: -1, duration: 180 }); }
          } });
        });
      }
      // 봉인된 구체를 몸으로 밀어 굴림
      this.time.delayedCall(1900, () => {
        hero.play('tuk_run');
        hero.play('tuk_push'); this.tweens.add({ targets: hero, x: 212, duration: 500, onComplete: () => {
          DT.Audio.sfx('kick'); hero.anims.stop(); hero.setFrame(12); this.time.delayedCall(300, () => hero.play('tuk_win'));
          this.tweens.killTweensOf([shell, mon]);
          this.tweens.add({ targets: [shell, mon], x: 380, angle: 720, duration: 900, ease: 'Quad.easeIn' });
        } });
      });
      const logo = this.add2(DT.text(this, 160, 70, '덩어리 숲', { font: 'ko', size: 30, color: '#a7f070', stroke: '#1a1c2c', strokeThickness: 5 }).setAlpha(0));
      this.tweens.add({ targets: logo, alpha: 1, y: 62, delay: 2600, duration: 700, ease: 'Back.easeOut' });
    }

    update() {
      DT.Input.update();
      const I = DT.Input;
      if (I.justDown('jump') || I.justDown('confirm')) { this.finish(); return; }
      if (I.justDown('fire')) this.advance();
      this.orbit.forEach(k => { k.a += k.sp; k.o.setPosition(Math.round(160 + Math.cos(k.a) * k.rx), Math.round(k.cy + Math.sin(k.a) * k.ry)); });
      if (!this.typing && this.autoAt && this.time.now > this.autoAt && !this.ending) { this.autoAt = 0; this.nextShot(); }
    }
  }

  DT.IntroScene = IntroScene;
})();
