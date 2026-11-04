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
    '새싹 정령 툭이는 말의 나무 가지 끝, 가장 여린 새싹에서 깨어났어요.\n포물선 씨앗탄을 던지고, 무엇이든 고르게 잘해요!',
    '물방울 정령 퐁이는 리강의 맑은 물방울에서 깨어났어요.\n누구보다 빠르게 달리며 물방울탄을 일직선으로 쏘아요!',
    '도토리 정령 도토는 황산 소나무의 도토리에서 깨어났어요.\n도토리 구체를 뻥 날려 펑! 터뜨리면 주변 몬스터까지 한꺼번에!',
    '세 정령은 힘을 모아 길을 떠났어요.\n“봉인하고 차서 날려 버리자! 말의 조각을 모두 되찾자!”'
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
      this.sub = DT.text(this, 160, 214, '', { font: 'ko', size: 10, color: '#ffffff', stroke: null, align: 'center', depth: 51, wrap: 304 });
      this.sub.setLineSpacing(3);
      this.hint = DT.ptext(this, 6, 7, 'Z NEXT  SPACE SKIP', { tint: 0x566c86, depth: 51 });
      const skip = DT.ptext(this, 284, 7, 'SKIP >>', { ox: 1, tint: 0xffcd75, depth: 52 });
      this.add.zone(262, 11, 52, 20).setDepth(52).setInteractive({ useHandCursor: true }).on('pointerdown', (p, x, y, ev) => { ev && ev.stopPropagation && ev.stopPropagation(); this.finish(); });
      this.tweens.add({ targets: skip, alpha: 0.4, yoyo: true, repeat: -1, duration: 600 });
      this.input.on('pointerdown', (p) => { if (DT.overlayJustClicked()) return; if (p.worldY > 22 || p.worldX < 230) this.advance(); });
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
      cam.once('camerafadeoutcomplete', () => {
        if (this.nextKey === 'Stage') DT.toStage(this, this.nextData.run);
        else this.scene.start(this.nextKey, this.nextData);
      });
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
    /* ── 컷 6: 툭이 소개 (말의 나무) ── */
    shot5() {
      this.add2(this.add.image(0, 0, 'bg_forest').setOrigin(0));
      this.add2(this.add.image(250, 194, 'tree').setOrigin(0.5, 1).setScale(0.8));
      const tuk = this.add2(this.add.sprite(80, 120, 'hero_tuk', 5).setScale(2.6));
      this.tweens.add({ targets: tuk, y: 172, duration: 700, ease: 'Bounce.easeOut', onComplete: () => {
        tuk.play('tuk_idle');
        const target = this.add2(this.add.sprite(220, 172, 'mush', 0).setScale(2.4).setFlipX(true)); target.play('mush_walk');
        for (let i = 0; i < 3; i++) this.time.delayedCall(300 + i * 380, () => {
          tuk.setFrame(7); DT.Audio.sfx('shoot', 'arc');
          const s = this.add2(this.add.image(96, 170, 'seed_tuk').setScale(2));
          this.tweens.addCounter({ from: 0, to: 1, duration: 450, onUpdate: (tw) => { const t = tw.getValue(); s.x = 96 + 118 * t; s.y = 170 - Math.sin(t * Math.PI) * 34; s.angle = t * 540; },
            onComplete: () => { s.destroy(); DT.Audio.sfx('hit', i + 1); target.setTintFill(0xffffff); this.time.delayedCall(60, () => target.clearTint()); } });
        });
      } });
      this.add2(DT.text(this, 160, 76, '툭이', { font: 'ko', size: 22, color: '#a7f070', strokeThickness: 4 }));
      this.add2(DT.text(this, 160, 100, '포물선 씨앗탄! 뭐든지 골고루!', { font: 'ko', size: 11, color: '#ffffff', strokeThickness: 3 }));
    }
    /* ── 컷 7: 퐁이 소개 (리강) ── */
    shot6() {
      this.add2(this.add.image(0, 0, 'bg_guilin').setOrigin(0));
      const pong = this.add2(this.add.sprite(-20, 172, 'hero_pong', 0).setScale(2.6));
      pong.play('pong_run');
      this.tweens.add({ targets: pong, x: 90, duration: 700, ease: 'Quad.easeOut', onComplete: () => {
        pong.play('pong_idle');
        for (let i = 0; i < 3; i++) this.time.delayedCall(250 + i * 260, () => {
          pong.setFrame(7); DT.Audio.sfx('shoot', 'line');
          const d = this.add2(this.add.image(108, 174, 'seed_pong').setScale(2.4, 1.6));
          this.tweens.add({ targets: d, x: 360, duration: 500, onComplete: () => d.destroy() });
        });
      } });
      const drops = this.add.particles(0, 0, 'bubble', { x: { min: 0, max: 320 }, y: 200, speedY: { min: -40, max: -15 }, lifespan: 2500, frequency: 120, alpha: { start: 1, end: 0 } });
      this.add2(drops);
      this.add2(DT.text(this, 220, 120, '퐁이', { font: 'ko', size: 22, color: '#73eff7', strokeThickness: 4 }));
      this.add2(DT.text(this, 220, 144, '빠르다! 일직선!', { font: 'ko', size: 11, color: '#ffffff', strokeThickness: 3 }));
    }
    /* ── 컷 8: 도토 소개 (황산) — 도토리 구체를 날려 펑! 주변까지 한꺼번에 ── */
    shot7() {
      this.add2(this.add.image(0, 0, 'bg_huangshan').setOrigin(0));
      const doto = this.add2(this.add.sprite(52, 172, 'hero_doto', 0).setScale(2.6));
      doto.play('doto_idle');
      // 도토리 구체에 갇힌 몬스터 하나 + 저 멀리 몬스터 무리
      const orb = this.add2(this.add.image(84, 172, 'orb_doto').setScale(2.4));
      const inner = this.add2(this.add.sprite(84, 172, 'mush', 2).setScale(2));
      inner.play('mush_struggle');
      this.tweens.add({ targets: [orb, inner], angle: { from: -6, to: 6 }, yoyo: true, repeat: 3, duration: 120 });
      const crowd = [['gob', 214, 172], ['snail', 240, 172], ['frog', 266, 172], ['bird', 238, 140]].map(([k, x, y]) => {
        const m = this.add2(this.add.sprite(x, y, k, 0).setScale(2.2).setFlipX(true)); m.play(k + '_walk'); return m;
      });
      // 뻥 차기!
      this.time.delayedCall(800, () => {
        doto.anims.stop(); doto.setFrame(12);
        DT.Audio.sfx('kick');
        this.add2(DT.text(this, 74, 146, '뻥!', { font: 'ko', size: 12, color: '#ffcd75', strokeThickness: 3 }));
        this.tweens.addCounter({ from: 0, to: 1, duration: 650, ease: 'Quad.easeIn', onUpdate: (tw) => {
          const t = tw.getValue(); const x = 84 + (240 - 84) * t, y = 172 - Math.sin(t * Math.PI) * 30;
          orb.setPosition(x, y).setAngle(t * 720); inner.setPosition(x, y).setAngle(t * 720);
        }, onComplete: () => {
          // 펑! 폭발 → 주변 몬스터까지 모두 날아감
          orb.destroy(); inner.destroy();
          DT.Audio.sfx('burst');
          this.cameras.main.shake(320, 0.012);
          this.cameras.main.flash(120, 255, 236, 180);
          const fx = DT.FX.play(this, 'poof', 240, 182, { scale: 1.6, depth: 30 });
          if (fx) this.layer.add(fx);
          const r = this.add2(this.add.sprite(240, 168, 'ring', 0).setTint(0xffcd75).setScale(3.2)); r.play('fx_ring');
          this.add2(DT.text(this, 240, 118, '펑!', { font: 'ko', size: 26, color: '#ef7d57', strokeThickness: 5 }));
          crowd.forEach((m, i) => {
            const dir = m.x < 240 ? -1 : 1;
            this.tweens.add({ targets: m, x: m.x + dir * (90 + i * 20), y: m.y - 120 - i * 15, angle: dir * 540, alpha: 0, duration: 900, ease: 'Quad.easeOut' });
          });
          const sp = this.add.particles(0, 0, 'star', { speed: { min: 80, max: 220 }, lifespan: 800, gravityY: 250, scale: { start: 1.4, end: 0 }, emitting: false,
            tint: [0xffcd75, 0xef7d57, 0xf2c38a] });
          this.add2(sp); sp.explode(30, 240, 168);
          doto.play('doto_win');
        } });
      });
      this.add2(DT.text(this, 110, 86, '도토', { font: 'ko', size: 22, color: '#ffcd75', strokeThickness: 4 }));
      this.add2(DT.text(this, 110, 110, '날리고, 펑! 한꺼번에!', { font: 'ko', size: 11, color: '#ffffff', strokeThickness: 3 }));
    }
    /* ── 컷 9: 결심! 봉인 시범 ── */
    shot8() {
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
