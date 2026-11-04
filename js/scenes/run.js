/* 주인공 선택 · 파워업 카드 선택 (로그라이크 성장) */
(function () {
  'use strict';
  const DT = window.DT;

  function statBars(stats) {
    const B = DT.BASE_STATS;
    return [
      ['공격력', DT.clamp(stats.dmg / 3, 0.15, 1)],
      ['사거리', DT.clamp((stats.seedVx / B.seedVx - 0.6) / 1.2, 0.15, 1)],
      ['공격속도', DT.clamp((B.fireInterval / stats.fireInterval - 0.5) / 1.5, 0.15, 1)],
      ['이동속도', DT.clamp((stats.move / B.move - 0.7) / 0.8, 0.15, 1)],
      ['체력', DT.clamp(stats.maxHp / 6, 0.15, 1)]
    ];
  }
  DT.statBars = statBars;

  class SelectScene extends Phaser.Scene {
    constructor() { super('Select'); }
    create() {
      DT.setupCamera(this);
      this.add.image(0, 0, 'bg_forest').setOrigin(0);
      DT.ambient(this, 'forest', 1);
      this.add.rectangle(0, 0, DT.W, DT.H, 0xffffff, 0.25).setOrigin(0);
      DT.text(this, 160, 18, '함께 모험할 정령을 골라 주세요!', { font: 'ko', size: 13, color: '#ffffff', strokeThickness: 4 });
      this.sel = 0;
      this.cards = DT.HEROES.map((h, i) => {
        const x = 12 + i * 102, y = 34;
        const c = this.add.container(x, y);
        const g = this.add.graphics();
        const spr = this.add.sprite(49, 40, 'hero_' + h.id, 0).setScale(3);
        spr.play(h.id + '_idle');
        const name = DT.text(this, 49, 72, h.name, { font: 'ko', size: 15, color: h.color, strokeThickness: 3 });
        const title = DT.text(this, 49, 86, h.title, { font: 'ko', size: 8, color: '#ffffff', stroke: null });
        const desc = DT.text(this, 49, 103, h.desc, { font: 'ko', size: 8, color: '#e8f4ff', stroke: null, align: 'center' });
        c.add([g, spr, name, title, desc]);
        const bars = statBars(DT.newRun(h.id).stats);
        bars.forEach((b, k) => {
          const by = 122 + k * 11;
          c.add(DT.text(this, 6, by, b[0], { font: 'ko', size: 7, color: '#ffffff', stroke: null, ox: 0 }));
          const bg = this.add.rectangle(42, by - 2, 50, 5, 0x1a1c2c, 0.6).setOrigin(0);
          const fg = this.add.rectangle(42, by - 2, Math.round(50 * b[1]), 5, Phaser.Display.Color.HexStringToColor(h.color).color).setOrigin(0);
          c.add([bg, fg]);
        });
        const zone = this.add.zone(x + 49, y + 90, 98, 180).setInteractive({ useHandCursor: true });
        zone.on('pointerdown', () => { if (this.sel === i) this.choose(); else { this.sel = i; this.refresh(); DT.Audio.sfx('select'); } });
        return { c, g, spr, x, y };
      });
      DT.text(this, 160, 226, '← → 선택    Z(공격) 결정', { font: 'ko', size: 9, color: '#ffffff', strokeThickness: 3 });
      this.refresh();
      this.done = false;
      DT.Audio.music(true, 'menu');
    }
    refresh() {
      this.cards.forEach((k, i) => {
        const on = i === this.sel, g = k.g;
        g.clear();
        g.fillStyle(0x1a1c2c, 1); g.fillRect(1, 0, 96, 182); g.fillRect(0, 1, 98, 180);
        g.fillStyle(on ? 0xffcd75 : 0x94b0c2, 1); g.fillRect(2, 1, 94, 180); g.fillRect(1, 2, 96, 178);
        g.fillStyle(on ? 0x3b5dc9 : 0x29366f, 0.95); g.fillRect(3, 3, 92, 176);
        g.fillStyle(0xffffff, 0.15); g.fillRect(3, 3, 92, 4);
        k.c.setY(on ? k.y - 3 : k.y);
        k.spr.play(DT.HEROES[i].id + (on ? '_run' : '_idle'), true);
      });
    }
    choose() {
      if (this.done) return;
      this.done = true;
      DT.Audio.sfx('start');
      const h = DT.HEROES[this.sel];
      this.cards[this.sel].spr.play(h.id + '_win');
      this.cameras.main.flash(150, 255, 255, 255);
      const run = DT.newRun(h.id);
      const seen = DT.store.get('dentree_story', '0') === '1';
      this.time.delayedCall(500, () => {
        if (seen) this.scene.start('Game', { run });
        else this.scene.start('Intro', { next: 'Game', data: { run } });
      });
    }
    update() {
      DT.Input.update();
      if (this.done) return;
      const I = DT.Input;
      let s = this.sel;
      if (I.justDown('left')) s = (s + 2) % 3;
      if (I.justDown('right')) s = (s + 1) % 3;
      if (s !== this.sel) { this.sel = s; this.refresh(); DT.Audio.sfx('select'); }
      if (I.justDown('fire') || I.justDown('confirm')) this.choose();
    }
  }

  const ICON = { seed: null, seed2: null, leaf: 'leaf', spark: 'spark', petal: 'petal', bubble: 'bubble', orb: 'orb', heart: 'heart', ring: 'ring', token: 'token' };

  class UpgradeScene extends Phaser.Scene {
    constructor() { super('Upgrade'); }
    init(d) { this.run = d.run; this.picks = d.picks || 1; }
    create() {
      DT.setupCamera(this);
      const next = DT.DATA.stages[this.run.stage];
      const theme = next && DT.THEMES[next.theme] ? next.theme : 'forest';
      this.add.image(0, 0, 'bg_' + theme).setOrigin(0);
      DT.ambient(this, theme, 1);
      this.add.rectangle(0, 0, DT.W, DT.H, 0x1a1c2c, 0.45).setOrigin(0);
      const t = DT.ptext(this, 160, 14, 'POWER UP!', { ox: 0.5, tint: 0xffcd75, scale: 0.5 });
      this.tweens.add({ targets: t, scale: 2.5, duration: 350, ease: 'Back.easeOut' });
      this.sub = DT.text(this, 160, 42, '', { font: 'ko', size: 10, color: '#ffffff', strokeThickness: 3 });
      this.statLine = DT.text(this, 160, 206, '', { font: 'ko', size: 8, color: '#e8f4ff', strokeThickness: 2 });
      DT.text(this, 160, 222, '← → 선택    Z(공격) 결정    ·    다음: ' + (next ? next.name : ''), { font: 'ko', size: 8, color: '#ffcd75', strokeThickness: 2 });
      this.cardObjs = [];
      this.deal();
      DT.Audio.music(true, 'menu');
    }
    deal() {
      this.cardObjs.forEach(o => o.c.destroy());
      this.cardObjs = [];
      this.options = DT.rollUpgrades(this.run, 3);
      if (!this.options.length) { this.finish(); return; }
      this.sel = 0; this.busy = false;
      this.sub.setText(this.picks > 1 ? '퀴즈 한 번에 정답! 카드를 ' + this.picks + '장 고를 수 있어요' : '카드를 1장 골라 주세요');
      const n = this.options.length, w = 92, gap = 8, x0 = 160 - (n * w + (n - 1) * gap) / 2;
      this.options.forEach((u, i) => {
        const x = x0 + i * (w + gap), y = 56;
        const c = this.add.container(x, y + 30).setAlpha(0);
        const g = this.add.graphics();
        const iconKey = ICON[u.icon] === undefined || ICON[u.icon] === null ? 'seed_' + this.run.hero : ICON[u.icon];
        const icon = this.add.image(46, 34, iconKey, iconKey === 'spark' ? 1 : 0).setScale(iconKey === 'orb' || iconKey === 'ring' ? 1.4 : 3);
        if (u.icon === 'seed2') icon.setX(38);
        const lv = this.run.levels[u.id] || 0;
        const name = DT.text(this, 46, 72, u.name, { font: 'ko', size: 12, color: '#ffcd75', strokeThickness: 3 });
        const desc = DT.text(this, 46, 96, u.desc, { font: 'ko', size: 8, color: '#ffffff', stroke: null, wrap: 80 });
        const lvText = DT.ptext(this, 46, 122, u.max >= 99 ? '' : 'LV ' + lv + '>' + (lv + 1), { ox: 0.5, tint: 0x73eff7 });
        c.add([g, icon, name, desc, lvText]);
        if (u.icon === 'seed2') c.add(this.add.image(55, 30, iconKey).setScale(3));
        const zone = this.add.zone(x + 46, y + 68, w, 136).setInteractive({ useHandCursor: true });
        zone.on('pointerdown', () => { if (this.busy) return; if (this.sel === i) this.pick(); else { this.sel = i; this.refresh(); DT.Audio.sfx('select'); } });
        this.tweens.add({ targets: c, y, alpha: 1, delay: i * 90, duration: 260, ease: 'Back.easeOut' });
        this.cardObjs.push({ c, g, x, y, zone });
      });
      this.refresh();
      this.updateStats();
    }
    updateStats() {
      const s = this.run.stats;
      this.statLine.setText('공격 ' + s.dmg + '  ·  사거리 ' + Math.round(s.seedVx) + '  ·  연사 ' + (s.fireInterval / 1000).toFixed(2) + '초  ·  이동 ' + Math.round(s.move) +
        '  ·  체력 ' + this.run.hp + '/' + s.maxHp + (s.multishot > 1 ? '  ·  ' + s.multishot + '발' : ''));
    }
    refresh() {
      this.cardObjs.forEach((k, i) => {
        const on = i === this.sel, g = k.g;
        g.clear();
        g.fillStyle(0x1a1c2c, 1); g.fillRect(1, 0, 90, 136); g.fillRect(0, 1, 92, 134);
        g.fillStyle(on ? 0xffcd75 : 0x94b0c2, 1); g.fillRect(2, 1, 88, 134); g.fillRect(1, 2, 90, 132);
        g.fillStyle(on ? 0x3b5dc9 : 0x29366f, 1); g.fillRect(3, 3, 86, 130);
        g.fillStyle(0xffffff, on ? 0.2 : 0.1); g.fillRect(3, 3, 86, 46);
        k.c.setScale(on ? 1.04 : 1);
      });
    }
    pick() {
      if (this.busy) return;
      this.busy = true;
      const u = this.options[this.sel], k = this.cardObjs[this.sel];
      DT.applyUpgrade(this.run, u.id);
      DT.Audio.sfx('levelup');
      this.cameras.main.flash(120, 255, 240, 180);
      const fx = this.add.particles(0, 0, 'star', { speed: { min: 60, max: 180 }, lifespan: 700, gravityY: 200, scale: { start: 1, end: 0 }, emitting: false,
        tint: [0xffcd75, 0xa7f070, 0x73eff7] });
      fx.explode(20, k.x + 46, k.y + 50);
      this.tweens.add({ targets: k.c, y: k.y - 10, duration: 200, yoyo: true });
      this.updateStats();
      this.picks--;
      this.time.delayedCall(700, () => { if (this.picks > 0) this.deal(); else this.finish(); });
    }
    finish() {
      this.scene.start('Game', { run: this.run });
    }
    update() {
      DT.Input.update();
      if (this.busy || !this.cardObjs.length) return;
      const I = DT.Input, n = this.cardObjs.length;
      let s = this.sel;
      if (I.justDown('left')) s = (s + n - 1) % n;
      if (I.justDown('right')) s = (s + 1) % n;
      if (s !== this.sel) { this.sel = s; this.refresh(); DT.Audio.sfx('select'); }
      if (I.justDown('fire') || I.justDown('confirm')) this.pick();
    }
  }

  DT.SelectScene = SelectScene;
  DT.UpgradeScene = UpgradeScene;
})();
