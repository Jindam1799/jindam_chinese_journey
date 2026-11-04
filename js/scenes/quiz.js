/* 스테이지 클리어 후 중국어 퀴즈: 방향키로 선택, 공격(Z) 버튼으로 확정. 터치는 직접 눌러도 됨 */
(function () {
  'use strict';
  const DT = window.DT;
  const TYPE_LABEL = { pair: '짝꿍 어휘 고르기', blank: '빈칸 채우기', listen: '듣고 고르기' };

  class QuizScene extends Phaser.Scene {
    constructor() { super('Quiz'); }

    init(d) {
      this.q = d.question;
      this.attempts = 0;
      this.done = false;
      this.sel = 0;
    }

    create() {
      DT.setupCamera(this);
      const q = this.q;
      this.add.rectangle(0, 0, DT.W, DT.H, DT.C.ink, 0.75).setOrigin(0);
      const root = this.add.container(0, 0);
      root.add(DT.panel(this, 22, 20, 276, 204, { border: DT.C.cyan, fill: DT.C.navy }));
      const title = DT.ptext(this, 160, 27, 'BONUS QUIZ', { ox: 0.5, tint: 0xffcd75, scale: 2 });
      this.tweens.add({ targets: title, alpha: 0.6, yoyo: true, repeat: -1, duration: 400 });
      root.add(title);
      root.add(DT.text(this, 160, 52, TYPE_LABEL[q.type] || '퀴즈', { font: 'ko', size: 9, color: '#73eff7', stroke: null }));

      this.canSpeak = DT.Audio.canSpeak() && !DT.Audio.muted;
      if (q.type === 'listen') {
        const spk = this.add.image(140, 76, 'speaker').setScale(2).setInteractive({ useHandCursor: true });
        spk.on('pointerdown', () => this.playAudio());
        this.tweens.add({ targets: spk, scale: 2.25, yoyo: true, repeat: -1, duration: 350 });
        root.add(spk);
        root.add(DT.text(this, 172, 76, 'SPACE\n다시 듣기', { font: 'ko', size: 8, color: '#ffcd75', stroke: null, ox: 0 }));
        // 음성이 없는 환경이면 병음을 보여줌
        this.pinyinText = DT.text(this, 160, 94, '( ' + (q.audioPinyin || '') + ' )', { font: 'py', size: 9, color: '#a7f070', stroke: null });
        this.pinyinText.setVisible(!this.canSpeak);
        root.add(this.pinyinText);
        if (!this.canSpeak) root.add(DT.text(this, 160, 104, '소리를 낼 수 없어 병음으로 보여드려요', { font: 'ko', size: 7, color: '#94b0c2', stroke: null }));
        this.time.delayedCall(450, () => this.playAudio());
      } else {
        root.add(DT.text(this, 160, 78, q.prompt, { font: 'zh', size: 22, color: '#f4f4f4', strokeThickness: 3 }));
      }
      root.add(DT.text(this, 160, 112, q.promptKo || '', { font: 'ko', size: 9, color: '#f4f4f4', stroke: null, wrap: 250 }));

      // 보기 2x2
      const opts = DT.shuffle(q.options);
      this.opts = opts.map((value, i) => {
        const col = i % 2, row = Math.floor(i / 2);
        const x = 40 + col * 124, y = 124 + row * 34;
        const c = this.add.container(x, y);
        const g = this.add.graphics();
        const label = DT.text(this, 58, 15, value, { font: 'zh', size: value.length > 1 ? 15 : 17, color: '#f4f4f4', strokeThickness: 2 });
        const num = DT.ptext(this, 5, 4, String(i + 1), { tint: 0x94b0c2 });
        const mark = DT.ptext(this, 104, 4, '', { ox: 1, tint: 0xb13e53 });
        c.add([g, label, num, mark]);
        const zone = this.add.zone(x + 58, y + 15, 116, 30).setInteractive({ useHandCursor: true });
        zone.on('pointerdown', () => { if (this.done) return; this.sel = i; this.refresh(); this.choose(i); });
        return { value, c, g, label, mark, x, y, disabled: false };
      });

      this.cursor = this.add.image(0, 0, 'cursor').setOrigin(1, 0.5);
      this.tweens.add({ targets: this.cursor, x: '-=3', yoyo: true, repeat: -1, duration: 220 });
      this.hint = DT.text(this, 160, 200, '', { font: 'ko', size: 9, color: '#ffcd75', stroke: null, wrap: 250 });
      DT.text(this, 160, 216, '← → ↑ ↓ 선택    Z(공격) 확정' + (q.type === 'listen' ? '    SPACE 다시 듣기' : ''),
        { font: 'ko', size: 7, color: '#94b0c2', stroke: null });
      this.refresh();
      this.cursorBase = null;
      DT.Audio.music(true, 'menu');
    }

    drawBox(o, state) {
      const g = o.g; g.clear();
      const colors = {
        idle: [DT.C.slate, DT.C.dark], sel: [DT.C.yellow, 0x3b5dc9],
        off: [DT.C.dark, 0x262b44], ok: [DT.C.lime, DT.C.green]
      }[state];
      g.fillStyle(DT.C.ink, 1); g.fillRect(1, 0, 114, 30); g.fillRect(0, 1, 116, 28);
      g.fillStyle(colors[0], 1); g.fillRect(2, 1, 112, 28); g.fillRect(1, 2, 114, 26);
      g.fillStyle(colors[1], 1); g.fillRect(3, 3, 110, 24);
      if (state !== 'off') { g.fillStyle(0xffffff, 0.12); g.fillRect(3, 3, 110, 3); }
      o.label.setAlpha(state === 'off' ? 0.35 : 1);
    }

    refresh() {
      this.opts.forEach((o, i) => this.drawBox(o, o.ok ? 'ok' : o.disabled ? 'off' : i === this.sel ? 'sel' : 'idle'));
      const o = this.opts[this.sel];
      this.tweens.killTweensOf(this.cursor);
      this.cursor.setPosition(o.x - 1, o.y + 15);
      this.tweens.add({ targets: this.cursor, x: o.x - 4, yoyo: true, repeat: -1, duration: 220 });
    }

    moveSel(delta) {
      let s = this.sel;
      for (let k = 0; k < 4; k++) {
        s = (s + delta + 4) % 4;
        if (!this.opts[s].disabled) break;
      }
      return s;
    }

    playAudio() {
      if (this.q.type !== 'listen') return;
      const ok = DT.Audio.speak(this.q.audio);
      if (!ok && this.pinyinText) this.pinyinText.setVisible(true);
    }

    update() {
      DT.Input.update();
      if (this.done) return;
      const I = DT.Input;
      let s = this.sel;
      if (I.justDown('left')) s = this.moveSel(-1);
      if (I.justDown('right')) s = this.moveSel(1);
      if (I.justDown('up') && s >= 2 && !this.opts[s - 2].disabled) s -= 2;
      if (I.justDown('down') && s < 2 && !this.opts[s + 2].disabled) s += 2;
      if (s !== this.sel) { this.sel = s; DT.Audio.sfx('select'); this.refresh(); }
      if (I.justDown('fire') || I.justDown('confirm')) this.choose(this.sel);
      else if (I.justDown('jump')) this.playAudio();
    }

    choose(i) {
      const o = this.opts[i];
      if (this.done || o.disabled) return;
      if (o.value === this.q.answer) this.correct(o);
      else this.wrong(o);
    }

    correct(o) {
      this.done = true;
      o.ok = true;
      this.refresh();
      this.cursor.setVisible(false);
      const bonus = [1000, 500, 300][Math.min(this.attempts, 2)];
      DT.Audio.sfx('right');
      const r = this.q.reveal;
      if (r) this.time.delayedCall(300, () => DT.Audio.speak(r.hanzi));
      this.hint.setText('');
      const box = DT.panel(this, 60, 150, 200, 66, { border: DT.C.lime, fill: DT.C.ink });
      const t0 = DT.ptext(this, 160, 156, 'GREAT! +' + bonus, { ox: 0.5, tint: 0xa7f070, scale: 0.5 });
      this.tweens.add({ targets: t0, scale: 2, duration: 300, ease: 'Back.easeOut' });
      if (r) {
        DT.text(this, 160, 184, r.hanzi, { font: 'zh', size: 16, color: '#ffcd75', strokeThickness: 3 });
        DT.text(this, 160, 202, r.pinyin + '  ·  ' + r.meaning, { font: 'ko', size: 9, color: '#f4f4f4', stroke: null });
      }
      const fx = this.add.particles(0, 0, 'star', {
        speed: { min: 60, max: 180 }, angle: { min: 200, max: 340 }, lifespan: 900, gravityY: 250,
        scale: { start: 1, end: 0 }, tint: [0xffcd75, 0xa7f070, 0x73eff7, 0xef7d57], emitting: false
      });
      fx.explode(24, o.x + 58, o.y + 15);
      fx.setDepth(10);
      this.time.delayedCall(2300, () => {
        const game = this.scene.get('Game');
        const next = game.nextStageData(bonus, this.attempts === 0);
        this.scene.stop('Game');
        this.scene.start(next.key, next.data);
      });
    }

    wrong(o) {
      this.attempts++;
      o.disabled = true;
      o.mark.setText('X');
      DT.Audio.sfx('wrong');
      this.cameras.main.shake(120, 0.004);
      this.tweens.add({ targets: o.c, x: o.x + 3, yoyo: true, repeat: 3, duration: 40, onComplete: () => o.c.setX(o.x) });
      this.hint.setText('힌트: ' + (this.q.hint || '다시 골라 보세요!'));
      if (this.q.type === 'listen' && this.pinyinText) this.pinyinText.setVisible(true);
      this.sel = this.moveSel(1);
      this.refresh();
    }
  }

  DT.QuizScene = QuizScene;
})();
