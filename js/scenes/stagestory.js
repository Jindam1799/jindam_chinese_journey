/* 스테이지 시작 전 짧은 이야기 장면 (배경 + 등장 몬스터 행진 + 주인공/보스 대사)
   Z(공격)/탭: 다음 · SPACE(점프)/SKIP: 건너뛰기 · 설정에서 끌 수 있음 */
(function () {
  'use strict';
  const DT = window.DT;

  // 다음 스테이지로 이동 (이야기 켜져 있으면 이야기 먼저)
  DT.toStage = function (scene, run) {
    const st = DT.DATA.stages[run.stage];
    const on = DT.store.get('dentree_stagestory', '1') === '1';
    if (on && st && st.story && st.story.length) scene.scene.start('StageStory', { run });
    else scene.scene.start('Game', { run });
  };

  class StageStoryScene extends Phaser.Scene {
    constructor() { super('StageStory'); }
    init(d) { this.run = d.run; this.stage = DT.DATA.stages[this.run.stage]; this.idx = -1; this.ending = false; }

    create() {
      DT.setupCamera(this);
      const st = this.stage, hero = DT.HEROES.find(h => h.id === this.run.hero) || DT.HEROES[0];
      this.hero = hero;
      const theme = DT.THEMES[st.theme] ? st.theme : 'forest';
      this.add.image(0, 0, st.boss ? 'bg_night' : 'bg_' + theme).setOrigin(0);
      if (st.boss) this.add.image(0, 0, 'bg_' + theme).setOrigin(0).setAlpha(0.35);
      DT.ambient(this, theme, 1);
      for (let c = 0; c < 20; c++) this.add.image(c * 16, 178, 'groundTop_' + theme, c % 4).setOrigin(0);

      // 이 스테이지에 나오는 몬스터 행진
      const kinds = Array.from(new Set(st.map.join('').split('').map(ch => DT.ENEMY_CODES[ch]).filter(Boolean))).slice(0, 5);
      (st.boss ? st.boss.minions : kinds).forEach((k, i) => {
        const fly = DT.ENEMY_DEFS[k].fly;
        const m = this.add.sprite(340 + i * 34, fly ? 130 : 169, k, 0).setScale(DT.SPR * 1.3).setFlipX(true);
        m.play(k + '_walk');
        this.tweens.add({ targets: m, x: -40, duration: 7000 + i * 400, repeat: -1, delay: i * 500 });
        if (fly) this.tweens.add({ targets: m, y: 120, yoyo: true, repeat: -1, duration: 500 });
      });

      // 주인공 / 보스
      this.heroSpr = this.add.sprite(64, 160, 'hero_' + hero.id, 0).setScale(3.4);
      this.heroSpr.play(hero.id + '_idle');
      this.tweens.add({ targets: this.heroSpr, y: 156, yoyo: true, repeat: -1, duration: 420, ease: 'Sine.easeInOut' });
      if (st.boss) {
        this.bossSpr = this.add.sprite(248, 176, st.boss.kind, 0).setOrigin(0.5, 1).setScale(4.2).setTint(st.boss.tint).setFlipX(true);
        this.bossSpr.play(st.boss.kind + '_walk');
        this.add.image(248, 176 - 16 * 4.2 + 4, 'crown').setScale(1.8);
      }
      if (st.climb) {
        const hz = this.add.tileSprite(0, 200, DT.W, 40, 'hazard_' + st.climb.hazard).setOrigin(0).setDepth(5);
        this.tweens.add({ targets: hz, y: 186, yoyo: true, repeat: -1, duration: 900, ease: 'Sine.easeInOut' });
      }

      // 위: 스테이지 제목 / 아래: 대사 상자
      this.add.rectangle(0, 0, DT.W, 22, 0x000000, 0.85).setOrigin(0).setDepth(20);
      DT.ptext(this, 6, 7, 'STAGE ' + st.id, { tint: 0x73eff7, depth: 21 });
      DT.text(this, 160, 11, st.name, { font: 'ko', size: 10, color: '#ffcd75', stroke: null, depth: 21 });
      const skip = DT.ptext(this, 284, 7, 'SKIP >>', { ox: 1, tint: 0xffcd75, depth: 21 });
      this.tweens.add({ targets: skip, alpha: 0.4, yoyo: true, repeat: -1, duration: 600 });
      this.add.zone(262, 11, 52, 22).setDepth(22).setInteractive({ useHandCursor: true }).on('pointerdown', (p, x, y, ev) => { if (ev) ev.stopPropagation(); this.finish(); });
      this.box = DT.panel(this, 8, 188, 304, 48, { border: DT.C.yellow, fill: DT.C.ink, alpha: 0.92, depth: 20 });
      this.nameTag = DT.text(this, 18, 197, '', { font: 'ko', size: 9, color: '#ffcd75', stroke: null, ox: 0, depth: 21 });
      this.line = DT.text(this, 18, 207, '', { font: 'ko', size: 10, color: '#ffffff', stroke: null, ox: 0, oy: 0, depth: 21, wrap: 284, align: 'left' });
      this.line.setLineSpacing(2);
      DT.ptext(this, 306, 230, 'Z', { ox: 1, oy: 1, tint: 0x566c86, depth: 21 });
      this.input.on('pointerdown', (p) => { if (DT.overlayJustClicked()) return; if (p.worldY > 22 || p.worldX < 230) this.advance(); });
      DT.Audio.music(true, st.boss ? { boss: st.world } : 'menu');
      this.next();
    }

    next() {
      this.idx++;
      const L = this.stage.story;
      if (this.idx >= L.length) { this.finish(); return; }
      const [who, text] = L[this.idx];
      const isHero = who === 'H', isBoss = who === 'B';
      this.nameTag.setText(isHero ? this.hero.name : isBoss ? this.stage.boss.name : '이야기');
      this.nameTag.setColor(isHero ? this.hero.color : isBoss ? '#ef7d57' : '#73eff7');
      this.heroSpr.setAlpha(isBoss ? 0.55 : 1);
      if (isHero) { this.heroSpr.play(this.hero.id + '_win'); this.time.delayedCall(600, () => this.heroSpr.play(this.hero.id + '_idle')); }
      if (this.bossSpr) {
        this.bossSpr.setAlpha(isBoss ? 1 : 0.6);
        if (isBoss) { this.cameras.main.shake(400, 0.006); DT.Audio.sfx('rumble'); }
      }
      this.full = text; this.shown = 0; this.typing = true; this.autoAt = 0;
      if (this.typeTimer) this.typeTimer.remove();
      this.typeTimer = this.time.addEvent({ delay: 32, loop: true, callback: () => {
        this.shown++;
        this.line.setText(this.full.slice(0, this.shown));
        if (this.shown % 3 === 0) DT.Audio.sfx('blip');
        if (this.shown >= this.full.length) this.doneTyping();
      } });
    }
    doneTyping() {
      if (this.typeTimer) this.typeTimer.remove();
      this.typing = false; this.line.setText(this.full);
      this.autoAt = this.time.now + 3200;
    }
    advance() { if (this.ending) return; if (this.typing) this.doneTyping(); else this.next(); }
    finish() {
      if (this.ending) return;
      this.ending = true;
      const cam = this.cameras.main;
      cam.fadeOut(300, 0, 0, 0);
      cam.once('camerafadeoutcomplete', () => this.scene.start('Game', { run: this.run }));
    }
    update() {
      DT.Input.update();
      const I = DT.Input;
      if (I.justDown('jump') || I.justDown('confirm')) { this.finish(); return; }
      if (I.justDown('fire')) this.advance();
      if (!this.typing && this.autoAt && this.time.now > this.autoAt && !this.ending) { this.autoAt = 0; this.next(); }
    }
  }

  DT.StageStoryScene = StageStoryScene;
})();
