/* 메인 전투 씬: 이동 · 점프 · 포물선 씨앗탄 · 봉인 · 구체 날리기 · 연쇄 처치 */
(function () {
  'use strict';
  const DT = window.DT;
  const T = DT.TUNING;

  class GameScene extends Phaser.Scene {
    constructor() { super('Game'); }

    init(data) {
      this.run = (data && data.run) || DT.newRun('tuk');
      this.S = this.run.stats;
      this.hero = this.run.hero;
      this.heroDef = DT.HEROES.find(h => h.id === this.hero) || DT.HEROES[0];
      this.stageIndex = this.run.stage || 0;
      this.score = this.run.score || 0;
      this.hp = Math.min(this.run.hp || this.S.maxHp, this.S.maxHp);
      this.learned = (this.run.learned || []).slice();
      this.maxCombo = this.run.maxCombo || 0;
    }

    create() {
      DT.setupCamera(this);
      this.stage = DT.DATA.stages[this.stageIndex];
      this.physics.world.setBounds(0, 0, DT.W, DT.H);
      this.physics.world.gravity.y = T.GRAVITY;

      // 상태값
      this.facing = 1;
      this.lastGroundAt = -1e9; this.jumpBufferUntil = 0; this.jumping = false;
      this.nextFireAt = 0; this.shootPoseUntil = 0; this.invUntil = 0; this.hurtUntil = 0; this.knockUntil = 0;
      this.powerUntil = 0; this.wasOnGround = true; this.airStart = 0;
      this.started = false; this.cleared = false; this.dead = false; this.isPaused = false; this.hurry = false;
      this.fireLocked = true; this.controlLocked = false; this.winPose = false; this.hitStopping = false;
      this.chainCombo = 0; this.chainUntil = 0;
      this.strikeUntil = 0; this.pushing = false; this.dropkick = false; this.strikeAnim = 'kick';
      this.inventory = []; this.completed = new Set(); this.dropIndex = 0;
      this.hudCache = {};

      this.theme = DT.THEMES[this.stage.theme] ? this.stage.theme : 'forest';
      this.add.image(0, 0, 'bg_' + this.theme).setOrigin(0).setDepth(-10);
      this.terrain = [];
      this.spawns = [];
      this.buildMap();
      this.buildDropQueue();

      // 오브젝트 그룹
      this.seeds = this.physics.add.group();
      this.enemies = this.physics.add.group();
      this.frags = this.physics.add.group();
      this.waves = this.physics.add.group();
      this.createFx();
      this.createPlayer();
      this.spawns.forEach(s => this.spawnEnemy(s));
      this.stageEnemyTotal = this.spawns.length;
      if (this.stage.boss) this.createBoss(this.stage.boss);

      // 충돌
      this.physics.add.collider(this.player, this.terrain, null, () => !this.dead);
      this.physics.add.collider(this.enemies, this.terrain, null, (e) => e.state !== 'dead');
      this.physics.add.collider(this.seeds, this.terrain, (a, b) => this.popSeed(a.isSeed ? a : b));
      this.physics.add.collider(this.frags, this.terrain);
      this.physics.add.collider(this.waves, this.terrain);
      this.physics.add.overlap(this.waves, this.enemies, (a, b) => { const w = a.isWave ? a : b, e = a.isWave ? b : a; this.waveHit(w, e); });
      this.physics.add.overlap(this.seeds, this.enemies, this.onSeedEnemy, (a, b) => { const e = a.isSeed ? b : a; return e.state === 'active' || e.state === 'sealed'; }, this);
      this.physics.add.collider(this.player, this.enemies, null, (a, b) => { const e = a === this.player ? b : a; return e.state === 'sealed' && !this.dead; });
      this.physics.add.overlap(this.player, this.enemies, this.onPlayerEnemy, null, this);
      this.physics.add.overlap(this.enemies, this.enemies, this.onEnemyEnemy, null, this);
      this.physics.add.overlap(this.player, this.frags, this.onCollect, null, this);
      this.physics.add.overlap(this.enemies, this.frags, this.onEnemyFrag, null, this);

      this.buildHud();
      this.readySequence();
      DT.Audio.music(true);
    }

    /* ───────────── 맵 ───────────── */
    buildMap() {
      const map = this.stage.map, S = DT.TILE;
      const at = (r, c) => (map[r] && map[r][c]) || '.';
      const rng = DT.rng(this.stageIndex * 97 + 13);
      for (let r = 0; r < map.length; r++) {
        for (let c = 0; c < map[r].length; c++) {
          const ch = map[r][c];
          const x = c * S, y = r * S;
          if (ch === '#') {
            const top = r > 0 && at(r - 1, c) !== '#';
            this.add.image(x, y, (top ? 'groundTop_' : 'stone_') + this.theme, Math.floor(rng() * 4)).setOrigin(0).setDepth(-2);
          } else if (ch === '=') {
            const l = at(r, c - 1) !== '=', rr = at(r, c + 1) !== '=';
            const key = l && rr ? 'platLR' : l ? 'platL' : rr ? 'platR' : 'plat';
            this.add.image(x, y, key + '_' + this.theme, key === 'plat' ? Math.floor(rng() * 4) : 0).setOrigin(0).setDepth(-2);
            // 장식
            const roll = rng();
            const green = this.theme !== 'jiuzhaigou';
            if (green && roll < 0.22) this.add.image(x + 4 + Math.floor(rng() * 6), y, 'deco_tuft').setOrigin(0, 1).setDepth(-3);
            else if (this.theme === 'forest' && roll < 0.3) this.add.image(x + 5 + Math.floor(rng() * 5), y, 'deco_shroom').setOrigin(0, 1).setDepth(-3);
            else if (roll < 0.4) this.add.image(x + 6, y, rng() < 0.5 ? 'deco_flower' : 'deco_flower2').setOrigin(0, 1).setDepth(-3);
          } else if (ch === 'P') {
            this.playerSpawn = { x: x + 8, y: y + 16 - 8 * DT.SPR - 0.5 };
          } else if (DT.ENEMY_CODES[ch]) {
            const kind = DT.ENEMY_CODES[ch];
            this.spawns.push({ kind, x: x + 8, y: DT.ENEMY_DEFS[kind].fly ? y + 8 : y + 16 - 8 * DT.SPR - 0.5 });
          }
        }
      }
      // 물리 바디: 벽은 직사각형으로 병합, 발판은 위에서만 밟히는 일방향
      const runs = [];
      for (let r = 0; r < map.length; r++) {
        let c = 0;
        while (c < 20) {
          const ch = at(r, c);
          if (ch === '#' || ch === '=') {
            let e = c; while (at(r, e + 1) === ch) e++;
            runs.push({ ch, r, c0: c, c1: e, h: 1 });
            c = e + 1;
          } else c++;
        }
      }
      const solids = runs.filter(u => u.ch === '#');
      const merged = [];
      solids.forEach(u => {
        const prev = merged.find(m => m.c0 === u.c0 && m.c1 === u.c1 && m.r + m.h === u.r);
        if (prev) prev.h++; else merged.push(Object.assign({}, u));
      });
      merged.forEach(m => this.addBody(m.c0 * S, m.r * S, (m.c1 - m.c0 + 1) * S, m.h * S, false));
      runs.filter(u => u.ch === '=').forEach(u => this.addBody(u.c0 * S, u.r * S, (u.c1 - u.c0 + 1) * S, 8, true));
    }

    addBody(x, y, w, h, oneWay) {
      const z = this.add.zone(x + w / 2, y + h / 2, w, h);
      this.physics.add.existing(z, true);
      if (oneWay) {
        z.body.checkCollision.down = false;
        z.body.checkCollision.left = false;
        z.body.checkCollision.right = false;
      }
      this.terrain.push(z);
    }

    buildDropQueue() {
      const chars = [];
      (this.stage.chunks || []).forEach(id => {
        const v = DT.DATA.vocabById[id];
        if (v) v.chars.forEach(ch => chars.push({ h: ch.h, p: ch.p }));
      });
      this.dropQueue = chars;
    }

    /* ───────────── 이펙트 ───────────── */
    createFx() {
      const base = { emitting: false };
      this.fxLeaf = this.add.particles(0, 0, 'leaf', Object.assign({
        speed: { min: 40, max: 120 }, angle: { min: 0, max: 360 }, lifespan: { min: 250, max: 550 },
        gravityY: 300, rotate: { min: 0, max: 360 }, scale: { start: 1, end: 0.3 }
      }, base)).setDepth(30);
      this.fxStar = this.add.particles(0, 0, 'star', Object.assign({
        speed: { min: 60, max: 190 }, angle: { min: 0, max: 360 }, lifespan: { min: 300, max: 700 },
        gravityY: 200, scale: { start: 1, end: 0 }, tint: [0xffcd75, 0xf4f4f4, 0xa7f070, 0x73eff7, 0xef7d57]
      }, base)).setDepth(31);
      this.fxPx = this.add.particles(0, 0, 'px', Object.assign({
        speed: { min: 30, max: 140 }, angle: { min: 0, max: 360 }, lifespan: { min: 200, max: 500 },
        gravityY: 260, scale: { start: 1, end: 0 }, tint: [0xa7f070, 0x38b764, 0xf4f4f4]
      }, base)).setDepth(30);
      this.fxDust = this.add.particles(0, 0, 'px', Object.assign({
        speedX: { min: -40, max: 40 }, speedY: { min: -30, max: -5 }, lifespan: 300,
        scale: { start: 1, end: 0 }, tint: 0x94b0c2, alpha: { start: 0.8, end: 0 }
      }, base)).setDepth(8);
      DT.ambient(this, this.theme, -5);
    }

    ring(x, y, tint, scale) {
      const r = this.add.sprite(x, y, 'ring', 0).setTint(tint || 0xffffff).setScale(scale || 1).setDepth(29);
      r.play('fx_ring');
      r.once('animationcomplete', () => r.destroy());
    }

    popText(x, y, str, tint, scale, life) {
      const t = DT.ptext(this, DT.clamp(x, 20, 300), y, str, { ox: 0.5, oy: 0.5, tint: tint === undefined ? 0xffffff : tint, scale: scale || 1, depth: 45 });
      this.tweens.add({ targets: t, y: y - 16, alpha: { from: 1, to: 0 }, duration: life || 800, ease: 'Cubic.easeIn', onComplete: () => t.destroy() });
      return t;
    }

    comboText(x, y, n, pts) {
      const cx = DT.clamp(x, 44, 276);
      const colors = [0xffcd75, 0xef7d57, 0x73eff7, 0xa7f070];
      if (this.lastCombo) { this.lastCombo.forEach(o => { this.tweens.killTweensOf(o); o.destroy(); }); }
      const t1 = DT.ptext(this, cx, y - 14, 'COMBO ×' + n, { ox: 0.5, oy: 0.5, tint: colors[n % 4], depth: 46 });
      const t2 = DT.ptext(this, cx, y - 4, '+' + pts, { ox: 0.5, oy: 0.5, tint: 0xf4f4f4, depth: 46 });
      t1.setScale(2.4); t2.setScale(0.5);
      this.lastCombo = [t1, t2];
      this.tweens.add({ targets: t1, scale: n >= 3 ? 1.5 : 1, duration: 260, ease: 'Back.easeOut' });
      this.tweens.add({ targets: t2, scale: 1, duration: 260, ease: 'Back.easeOut' });
      this.tweens.add({ targets: [t1, t2], y: '-=14', alpha: 0, delay: 650, duration: 450, onComplete: () => { t1.destroy(); t2.destroy(); if (this.lastCombo && this.lastCombo[0] === t1) this.lastCombo = null; } });
    }

    banner(str, tint, scale, life) {
      const t = DT.ptext(this, 160, 112, str, { ox: 0.5, oy: 0.5, tint: tint || 0xffcd75, scale: 0.5, depth: 60 });
      this.tweens.add({ targets: t, scale: scale || 3, duration: 280, ease: 'Back.easeOut' });
      this.tweens.add({ targets: t, alpha: 0, delay: life || 900, duration: 300, onComplete: () => t.destroy() });
      return t;
    }

    hitStop(ms) {
      if (this.hitStopping || this.isPaused) return;
      this.hitStopping = true;
      this.physics.world.pause();
      this.time.delayedCall(ms, () => {
        this.hitStopping = false;
        if (!this.isPaused) this.physics.world.resume();
      });
    }

    /* ───────────── 플레이어 ───────────── */
    createPlayer() {
      const sp = this.playerSpawn || { x: 160, y: 200 };
      const p = this.player = this.physics.add.sprite(sp.x, sp.y, 'hero_' + this.hero, 0);
      p.setScale(DT.SPR);
      p.body.setSize(10, 13).setOffset(3, 3);
      p.body.setMaxVelocity(1000, T.MAX_FALL);
      p.setCollideWorldBounds(true);
      p.setDepth(10);
      p.play(this.hero + '_idle');
    }

    updatePlayer(time) {
      const p = this.player, b = p.body, I = DT.Input;
      if (this.dead) { p.angle += 12; return; }
      const onGround = b.blocked.down || b.touching.down;
      if (onGround) this.lastGroundAt = time;
      const locked = this.controlLocked;
      const knock = time < this.knockUntil;

      let target = 0;
      if (!locked) { if (I.isDown('left')) target -= 1; if (I.isDown('right')) target += 1; }
      if (target !== 0) this.facing = target;
      if (!knock) {
        const nv = Phaser.Math.Linear(b.velocity.x, target * this.S.move, onGround ? T.PLAYER_ACCEL : T.PLAYER_AIR_ACCEL);
        b.setVelocityX(target === 0 && Math.abs(nv) < 3 ? 0 : nv);
      }

      // 점프 (코요테 타임 + 입력 버퍼 + 가변 높이)
      if (!locked && I.justDown('jump')) this.jumpBufferUntil = time + T.JUMP_BUFFER_MS;
      if (!knock && time < this.jumpBufferUntil && time - this.lastGroundAt <= T.COYOTE_MS) {
        b.setVelocityY(-this.S.jump);
        this.jumpBufferUntil = 0; this.lastGroundAt = -1e9; this.jumping = true;
        this.fxDust.explode(4, p.x, p.y + 8);
        DT.Audio.sfx('jump');
      }
      if (this.jumping && !I.isDown('jump') && b.velocity.y < -T.JUMP_CUT) b.setVelocityY(-T.JUMP_CUT);
      if (b.velocity.y >= 0) this.jumping = false;
      let gy = 0;
      if (!onGround) {
        if (Math.abs(b.velocity.y) < 45 && I.isDown('jump')) gy = -T.GRAVITY * 0.45; // 정점에서 살짝 떠 있는 느낌
        else if (b.velocity.y > 0) gy = T.GRAVITY * 0.22;                            // 내려올 땐 조금 빠르게
      }
      b.setGravityY(gy);

      // 착지
      if (onGround && !this.wasOnGround) {
        if (time - this.airStart > 180) { this.fxDust.explode(5, p.x, p.y + 8); DT.Audio.sfx('land'); }
      }
      if (!onGround && this.wasOnGround) this.airStart = time;
      this.wasOnGround = onGround;

      // 구체 밀기: 땅에서 구체 쪽으로 걸어가면 천천히 밀림
      this.pushing = false;
      if (onGround && target !== 0 && !knock) {
        const o = this.findOrb(target, 16, 10);
        if (o) {
          o.pushedAt = time;
          o.body.setVelocityX(target * T.PUSH_SPEED);
          b.setVelocityX(target * T.PUSH_SPEED);
          this.pushing = true;
        }
      }
      // 구체 옆에서 공격 버튼 → 발차기 / 주먹 / (공중) 드롭킥
      if (!locked && !this.fireLocked && I.justDown('fire')) {
        const o = this.findOrb(this.facing, T.STRIKE_REACH, onGround ? 14 : 22);
        if (o) this.strike(o, onGround, time);
      }
      if (this.dropkick && (onGround || time > this.strikeUntil)) { this.dropkick = false; }
      p.setAngle(this.dropkick ? -28 * this.facing : 0);

      // 공격 (누르고 있으면 자동 연사)
      if (!locked && !this.fireLocked && I.isDown('fire') && time >= this.nextFireAt && time > this.strikeUntil) {
        if (this.seeds.countActive(true) < T.MAX_SEEDS * this.S.multishot) {
          this.shoot(time);
          this.nextFireAt = time + this.S.fireInterval * (time < this.powerUntil ? 0.6 : 1);
        }
      }

      // 애니메이션
      p.setFlipX(this.facing < 0);
      let anim;
      if (this.winPose) anim = 'win';
      else if (time < this.hurtUntil) anim = 'hurt';
      else if (time < this.strikeUntil) anim = this.strikeAnim;
      else if (this.pushing) anim = 'push';
      else if (time < this.shootPoseUntil) anim = 'shoot';
      else if (!onGround) anim = b.velocity.y < 0 ? 'jump' : 'fall';
      else if (Math.abs(b.velocity.x) > 12) anim = 'run';
      else anim = 'idle';
      p.play(this.hero + '_' + anim, true);

      p.setAlpha(time < this.invUntil ? (Math.floor(time / 60) % 2 ? 0.3 : 1) : 1);
      if (time < this.powerUntil) {
        p.setTint(Math.floor(time / 80) % 2 ? 0xffffff : 0xffe9a0);
        if (Math.random() < 0.25) this.fxPx.emitParticleAt(p.x + Phaser.Math.Between(-6, 6), p.y + Phaser.Math.Between(-6, 6), 1);
      } else if (p.tintTopLeft !== 0xffffff) p.clearTint();
    }

    // 플레이어 앞(dir 방향)에 있는 봉인 구체 찾기
    findOrb(dir, reach, dyMax) {
      const p = this.player;
      let best = null, bd = 1e9;
      this.enemies.getChildren().forEach(e => {
        if (!e.active || e.state !== 'sealed') return;
        const dx = (e.x - p.x) * dir, dy = Math.abs(e.y - p.y);
        if (dx > -4 && dx < reach && dy < dyMax && dx < bd) { best = e; bd = dx; }
      });
      return best;
    }

    strike(e, onGround, time) {
      const p = this.player;
      this.strikeUntil = time + 240;
      if (!onGround) { this.strikeAnim = 'kick'; this.dropkick = true; p.body.setVelocity(this.facing * 130, -50); }
      else { this.strikeAlt = !this.strikeAlt; this.strikeAnim = this.strikeAlt ? 'kick' : 'punch'; }
      this.nextFireAt = time + 260;
      const hx = (p.x + e.x) / 2, hy = (p.y + e.y) / 2;
      const sp = this.add.sprite(hx, hy, 'spark', 0).setDepth(35).setScale(2);
      sp.play('fx_spark'); sp.once('animationcomplete', () => sp.destroy());
      this.fxStar.explode(6, hx, hy);
      this.popText(hx, hy - 12, this.dropkick ? 'DROP KICK!' : this.strikeAnim === 'kick' ? 'KICK!' : 'PUNCH!', 0xffcd75);
      this.launchOrb(e, this.facing);
    }

    shoot(time) {
      const p = this.player, dir = this.facing, power = time < this.powerUntil;
      const sx = p.x + dir * 8, sy = p.y + 3;
      const n = this.S.multishot;
      const vys = n === 1 ? [T.SEED_VY] : n === 2 ? [T.SEED_VY, T.SEED_VY - 85] : [T.SEED_VY + 30, T.SEED_VY - 50, T.SEED_VY - 130];
      const mode = this.heroDef.shot;
      vys.forEach((vy, i) => {
        const s = this.seeds.create(sx, sy, 'seed_' + this.hero);
        s.setDepth(9);
        s.setScale(DT.SPR * (power ? 1.4 : 1));
        s.body.setSize(8, 8);
        s.isSeed = true; s.mode = mode; s.dir = dir; s.bornAt = time; s.startX = sx; s.dmg = this.S.dmg + (power ? 1 : 0);
        if (mode === 'line') {
          // 물방울: 중력 없이 일직선. 여러 발이면 위아래로 살짝 퍼짐
          s.body.setAllowGravity(false);
          s.speed = this.S.seedVx * 1.5;
          s.range = this.S.seedVx * 0.62;
          s.body.setVelocity(dir * s.speed, n === 1 ? 0 : (i - (n - 1) / 2) * 40);
          s.setScale(DT.SPR * 1.25 * (power ? 1.4 : 1), DT.SPR * 0.85 * (power ? 1.4 : 1));
        } else if (mode === 'roll') {
          // 도토리: 살짝 떴다가 바닥을 따라 굴러감 (발판 끝에서는 아래로 떨어져 계속 굴러감)
          s.body.setAllowGravity(true);
          s.speed = this.S.seedVx * 0.95 * (1 - i * 0.12);
          s.range = this.S.seedVx * 0.85;
          s.body.setVelocity(dir * s.speed, -70 - i * 40);
          s.body.setBounce(0, 0.25);
          s.body.setAngularVelocity(dir * 900);
        } else {
          s.body.setAllowGravity(true);
          s.body.setGravityY(T.SEED_GRAVITY - T.GRAVITY);
          s.body.setVelocity(dir * this.S.seedVx * (1 - i * 0.06) + p.body.velocity.x * 0.2, vy);
          s.body.setAngularVelocity(dir * 720);
        }
      });

      const sp = this.add.sprite(sx + dir * 3, sy, 'spark', 0).setDepth(11);
      sp.play('fx_spark'); sp.once('animationcomplete', () => sp.destroy());
      this.fxLeaf.explode(power ? 4 : 2, sx, sy);
      this.shootPoseUntil = time + 110;
      DT.Audio.sfx('shoot');
    }

    popSeed(s) {
      if (!s || !s.isSeed || !s.active) return;
      // 도토리는 바닥에 닿아도 계속 굴러가고, 벽에 부딪혀야 터짐
      if (s.mode === 'roll' && !(s.body.blocked.left || s.body.blocked.right)) return;
      this.fxLeaf.explode(3, s.x, s.y);
      s.destroy();
    }

    /* ───────────── 몬스터 ───────────── */
    /* ───────────── 보스: 작은 적을 봉인한 구체로만 공격 가능 ───────────── */
    createBoss(def) {
      const b = this.boss = this.physics.add.sprite(250, 198, def.kind, 0);
      b.setScale(3.2).setTint(def.tint || 0xffffff).setDepth(5).setFlipX(true);
      b.body.setSize(12, 14).setOffset(2, 2);
      b.setCollideWorldBounds(true);
      b.def = def; b.hp = b.maxHp = def.hp; b.dir = -1; b.state = 'spawn';
      b.nextJump = 0; b.nextSpawn = 0; b.invUntil = 0;
      b.play(def.kind + '_walk');
      b.crown = this.add.image(b.x, b.y - 30, 'crown').setDepth(6).setScale(1.4);
      this.physics.add.collider(b, this.terrain, null, () => b.state !== 'dead');
      this.physics.add.overlap(this.player, b, () => {
        if (b.state === 'active' && !this.dead && !this.cleared && this.time.now >= this.invUntil) this.hurtPlayer(b);
      });
      this.physics.add.overlap(this.seeds, b, (a, c) => {
        const sd = a.isSeed ? a : c;
        if (!sd.active || b.state === 'dead') return;
        this.fxPx.explode(4, sd.x, sd.y); sd.destroy();
        DT.Audio.sfx('tick');
        if (!this.bossHintAt || this.time.now - this.bossHintAt > 6000) { this.bossHintAt = this.time.now; this.popText(b.x, b.y - 34, 'NO DAMAGE', 0x94b0c2); this.hintText('보스는 작은 적을 봉인한 구체로만 공격할 수 있어요!'); }
      });
      this.physics.add.overlap(this.enemies, b, (a, c) => {
        const e = a === b ? c : a;
        if (e.state === 'rolling') { this.bossHit(e); this.burstOrb(e); }
      });
      this.physics.add.overlap(this.waves, b, (a, c) => {
        const w = a === b ? c : a;
        if (w.isWave && !w.hitBoss) { w.hitBoss = true; this.bossHit(w); }
      });
      // HUD: 보스 이름과 체력
      this.bossName = DT.text(this, 160, 25, def.name, { font: 'ko', size: 9, color: '#ffcd75', strokeThickness: 3, depth: 42 });
      this.bossBar = this.add.graphics().setDepth(42);
      this.drawBossBar();
    }

    drawBossBar() {
      const g = this.bossBar, b = this.boss; g.clear();
      g.fillStyle(DT.C.ink, 1); g.fillRect(99, 31, 122, 6);
      g.fillStyle(0x566c86, 1); g.fillRect(100, 32, 120, 4);
      g.fillStyle(b.hp > b.maxHp / 2 ? 0xef7d57 : 0xb13e53, 1); g.fillRect(100, 32, Math.round(120 * Math.max(0, b.hp) / b.maxHp), 4);
      g.fillStyle(0xffffff, 0.35); g.fillRect(100, 32, Math.round(120 * Math.max(0, b.hp) / b.maxHp), 1);
    }

    updateBoss(time) {
      const b = this.boss;
      if (!b || !b.active) return;
      b.crown.setPosition(Math.round(b.x), Math.round(b.y - 28 + (b.anims.currentFrame && b.anims.currentFrame.index === 2 ? 1 : 0)));
      if (b.state !== 'active') return;
      const body = b.body, onGround = body.blocked.down || body.touching.down;
      const rage = b.hp <= b.maxHp / 2;
      if (body.blocked.left) b.dir = 1; else if (body.blocked.right) b.dir = -1;
      const spd = (b.def.kind === 'thief' ? 50 : 30) * (rage ? 1.5 : 1);
      if (onGround) body.setVelocityX(b.dir * spd);
      if (onGround && time > b.nextJump) {
        b.dir = this.player.x < b.x ? -1 : 1;
        body.setVelocityY(b.def.kind === 'frog' ? -380 : -300);
        body.setVelocityX(b.dir * spd * 2.2);
        b.nextJump = time + Phaser.Math.Between(2600, 4200) / (rage ? 1.4 : 1);
        if (onGround) this.time.delayedCall(700, () => { if (b.active) this.cameras.main.shake(120, 0.004); });
      }
      b.setFlipX(b.dir < 0);
      if (time < b.invUntil) b.setTintFill(Math.floor(time / 60) % 2 ? 0xffffff : 0xff6070);
      else b.setTint(b.def.tint || 0xffffff);
      // 졸개 소환 (항상 구체로 만들 재료가 있도록)
      const minions = this.enemies.getChildren().filter(e => e.state !== 'dead').length;
      if (time > b.nextSpawn && minions < (rage ? 5 : 4)) {
        b.nextSpawn = time + (rage ? 2400 : 3400);
        const kind = b.def.minions[Math.floor(Math.random() * b.def.minions.length)];
        const sx = DT.clamp(b.x + Phaser.Math.Between(-30, 30), 30, 290);
        const e = this.spawnEnemy({ kind, x: sx, y: DT.ENEMY_DEFS[kind].fly ? b.y - 40 : b.y - 30 });
        e.body.setVelocity(Phaser.Math.Between(-80, 80), -220);
        this.time.delayedCall(450, () => { if (e.active && e.state === 'spawn') e.state = 'active'; });
        this.emote(b, '!');
      }
    }

    bossHit(src) {
      const b = this.boss, now = this.time.now;
      if (!b || b.state !== 'active' || now < b.invUntil) return;
      b.hp--; b.invUntil = now + 700;
      this.drawBossBar();
      this.addScore(2000);
      this.popText(b.x, b.y - 36, 'BOSS HIT! +2000', 0xffcd75, 1, 1000);
      this.cameras.main.shake(260, 0.012);
      this.hitStop(140);
      this.ring(b.x, b.y, 0xffffff, 2.2);
      this.fxStar.explode(20, b.x, b.y);
      DT.FX.play(this, 'poof', b.x, b.y + 20, { depth: 33 });
      DT.Audio.sfx('burst');
      b.body.setVelocity(((src && src.x < b.x) ? 1 : -1) * 120, -180);
      if (b.hp <= 0) this.bossDie();
      else if (b.hp === Math.floor(b.maxHp / 2)) this.banner('BOSS ANGRY!', 0xb13e53, 2.2, 1000);
    }

    bossDie() {
      const b = this.boss;
      b.state = 'dead';
      this.addScore(20000);
      DT.Audio.music(false);
      this.enemies.getChildren().slice().forEach(e => { if (e.state !== 'dead') this.killEnemy(e, e.x < b.x ? -1 : 1); });
      for (let i = 0; i < 6; i++) this.time.delayedCall(i * 220, () => {
        DT.FX.play(this, 'poof', b.x + Phaser.Math.Between(-24, 24), b.y + Phaser.Math.Between(-10, 30), { depth: 34 });
        this.fxStar.explode(14, b.x, b.y); DT.Audio.sfx('kill', i + 2); this.cameras.main.shake(160, 0.01);
      });
      this.time.delayedCall(1400, () => {
        this.banner('BOSS CLEAR! +20000', 0xffcd75, 2, 1600);
        b.body.checkCollision.none = true; b.setCollideWorldBounds(false);
        b.body.setVelocity(0, -200); b.setFlipY(true); b.crown.setVisible(false);
        this.cameras.main.flash(200, 255, 255, 255);
      });
    }

    spawnEnemy(spec) {
      const e = this.enemies.create(spec.x, spec.y, spec.kind, 0);
      e.setScale(DT.SPR);
      e.body.setSize(12, 14).setOffset(2, 2);
      e.setCollideWorldBounds(true);
      e.setDepth(6);
      e.kind = spec.kind; e.def = DT.ENEMY_DEFS[spec.kind];
      e.hp = e.def.hp; e.hits = 0; e.state = 'spawn'; e.angry = false;
      e.dir = spec.x < DT.W / 2 ? 1 : -1;
      e.nextAct = this.time.now + Phaser.Math.Between(1500, 3000);
      e.knockUntil = 0; e.lastHitAt = 0; e.nextDecayAt = 0; e.nextTick = 0;
      e.shell = this.add.image(e.x, e.y, 'orb').setVisible(false).setDepth(7).setScale(DT.SPR);
      e.flyer = !!e.def.fly;
      if (e.flyer) { e.body.setAllowGravity(false); e.baseY = spec.y; e.phase = Math.random() * 6; }
      e.play(spec.kind + '_walk');
      e.setAlpha(0);
      const puff = this.add.sprite(spec.x, spec.y, 'puff', 0).setDepth(12).setVisible(false);
      this.time.delayedCall(Phaser.Math.Between(100, 600), () => {
        puff.setVisible(true).play('fx_puff'); puff.once('animationcomplete', () => puff.destroy());
        if (e.active) e.setAlpha(1);
      });
      return e;
    }

    groundAhead(e) {
      const x = e.x + e.dir * 9 * DT.SPR;
      const hits = this.physics.overlapRect(x - 1, e.body.bottom + 1, 2, 4, false, true);
      return hits.length > 0;
    }

    updateEnemy(e, time) {
      if (!e.active) return;
      e.shell.setPosition(Math.round(e.x), Math.round(e.y));
      switch (e.state) {
        case 'spawn': e.body.setVelocityX(0); break;
        case 'active': this.enemyAI(e, time); this.updateSealGauge(e, time); break;
        case 'sealed': this.updateSealed(e, time); break;
        case 'rolling': this.updateRolling(e, time); break;
        default: break;
      }
    }

    enemyAI(e, time) {
      const b = e.body, onGround = b.blocked.down || b.touching.down;
      const spd = e.def.speed * (e.angry ? T.ANGRY_MULT : 1) * (this.hurry ? 1.15 : 1);
      if (time < e.knockUntil) return;
      if (b.blocked.left) e.dir = 1; else if (b.blocked.right) e.dir = -1;
      const p = this.player;

      if (e.kind === 'mush') {
        if (onGround && !this.groundAhead(e)) e.dir *= -1;
        b.setVelocityX(e.dir * spd);
        if (onGround && time > e.nextAct) {
          b.setVelocityY(-170);
          e.nextAct = time + Phaser.Math.Between(2200, 4200);
          if (Math.random() < 0.5) this.emote(e, '?');
        }
      } else if (e.kind === 'gob') {
        if (onGround) {
          if (!this.groundAhead(e)) e.dir *= -1;
          b.setVelocityX(e.dir * spd * 0.6);
          if (time > e.nextAct) {
            e.dir = p.x < e.x ? -1 : 1;
            b.setVelocityY(p.y < e.y - 20 ? -300 : -200);
            b.setVelocityX(e.dir * spd * 2.4);
            e.nextAct = time + Phaser.Math.Between(1100, 2000) / (e.angry ? 1.4 : 1);
          }
        }
      } else if (e.kind === 'thief') {
        let target = p;
        let best = 130;
        this.frags.getChildren().forEach(f => {
          if (!f.active || f.collected) return;
          const d = Math.abs(f.x - e.x) + Math.abs(f.y - e.y) * 1.5;
          if (d < best) { best = d; target = f; }
        });
        if (onGround) {
          if (Math.abs(target.x - e.x) > 6) e.dir = target.x < e.x ? -1 : 1;
          b.setVelocityX(e.dir * spd);
          if (time > e.nextAct && target.y < e.y - 20 && Math.abs(target.x - e.x) < 60) {
            b.setVelocityY(-305);
            e.nextAct = time + 1400;
          }
        }
      }
      else if (e.kind === 'bird') {
        // 물결 모양으로 날며 플레이어 높이로 천천히 다가옴
        e.phase += 0.06;
        const ty = DT.clamp(p.y - 10, 34, 196);
        e.baseY += Math.sign(ty - e.baseY) * 0.25 * (e.angry ? 1.6 : 1);
        b.setVelocityX(e.dir * spd);
        b.setVelocityY((e.baseY + Math.sin(e.phase) * 14 - e.y) * 4);
      } else if (e.kind === 'frog') {
        if (onGround) {
          b.setVelocityX(0);
          if (time > e.nextAct) {
            e.dir = p.x < e.x ? -1 : 1;
            b.setVelocityY(p.y < e.y - 20 ? -330 : -230);
            b.setVelocityX(e.dir * (e.angry ? 120 : 85));
            e.nextAct = time + Phaser.Math.Between(1300, 2300) / (e.angry ? 1.4 : 1);
          }
        }
        e.anims.stop();
        e.setFrame(onGround ? 0 : 1);
      } else if (e.kind === 'snail') {
        if (onGround && !this.groundAhead(e)) e.dir *= -1;
        b.setVelocityX(e.dir * spd);
      }
      e.setFlipX(e.dir < 0);
    }

    updateSealGauge(e, time) {
      if (e.hits > 0 && time - e.lastHitAt > T.HIT_DECAY_DELAY && time > e.nextDecayAt) {
        e.hits--; e.nextDecayAt = time + T.HIT_DECAY_STEP;
      }
      if (e.hits > 0) {
        const r = e.hits / e.hp;
        e.shell.setVisible(true).setAlpha(0.25 + 0.4 * r).setScale((0.7 + 0.25 * r) * DT.SPR).setRotation(0);
      } else e.shell.setVisible(false);
    }

    hintText(str) {
      const t = DT.text(this, 160, 200, str, { font: 'ko', size: 10, color: '#ffffff', strokeThickness: 3, depth: 60 });
      this.tweens.add({ targets: t, alpha: 0, delay: 2200, duration: 400, onComplete: () => t.destroy() });
    }

    emote(e, ch) {
      const t = DT.ptext(this, e.x, e.y - 12, ch, { ox: 0.5, oy: 1, tint: ch === '!' ? 0xef7d57 : 0x73eff7, depth: 44 });
      this.tweens.add({ targets: t, y: t.y - 6, alpha: 0, delay: 350, duration: 400, onComplete: () => t.destroy() });
    }

    applyTint(e) {
      if (!e.active) return;
      if (e.angry && e.state === 'active') e.setTint(0xff9a8a); else e.clearTint();
    }

    onSeedEnemy(a, b) {
      const s = a.isSeed ? a : b, e = a.isSeed ? b : a;
      if (!s.active || !e.active || !s.isSeed) return;
      const dir = s.dir, dmg = s.dmg;
      this.fxPx.explode(5, s.x, s.y);
      s.destroy();
      if (e.state === 'active') this.hitEnemy(e, dir, dmg);
      else if (e.state === 'sealed') {
        // 구체는 씨앗탄으로 날릴 수 없음: 봉인 시간만 조금 늘어남 (직접 밀어야 함)
        e.sealedAt = Math.min(this.time.now, e.sealedAt + 400);
        e.shell.setTintFill(0xffffff); this.time.delayedCall(50, () => e.active && e.shell.clearTint());
        DT.Audio.sfx('tick');

      }
    }

    hitEnemy(e, dir, dmg) {
      const now = this.time.now;
      e.hits += dmg; e.lastHitAt = now;
      e.setTintFill(0xffffff);
      this.time.delayedCall(60, () => this.applyTint(e));
      e.knockUntil = now + 110;
      e.body.setVelocityX(dir * 55);
      this.fxStar.explode(2, e.x, e.y);
      DT.Audio.sfx('hit', e.hits);
      this.addScore(10);
      if (e.hits >= e.hp) this.sealEnemy(e);
    }

    sealEnemy(e) {
      const now = this.time.now;
      e.state = 'sealed'; e.sealedAt = now; e.hits = 0; e.nextTick = 0;
      e.clearTint();
      e.body.setVelocity(0, -70);
      e.body.setAllowGravity(true);
      e.body.pushable = false;
      if (!this.sealHintShown) { this.sealHintShown = true; this.hintText('구체에 다가가 공격 버튼으로 차요! 밀거나 위에 올라탈 수도 있어요'); }
      e.play(e.kind + '_struggle');
      e.shell.setVisible(true).setAlpha(0.95).setScale(1.7 * DT.SPR).setRotation(0);
      this.tweens.add({ targets: e.shell, scale: DT.SPR, duration: 260, ease: 'Back.easeOut' });
      this.ring(e.x, e.y, 0xa7f070, 1);
      this.fxLeaf.explode(10, e.x, e.y);
      this.popText(e.x, e.y - 14, '+100', 0xa7f070);
      this.addScore(100);
      this.hitStop(35);
      DT.Audio.sfx('seal');
    }

    updateSealed(e, time) {
      if (e.pushedAt !== time) e.body.setVelocityX(e.body.velocity.x * 0.85);
      const left = this.S.sealTime - (time - e.sealedAt);
      const warn = left < T.SEAL_WARN;
      e.shell.x += Math.round(Math.sin(time / (warn ? 30 : 90)) * (warn ? 1.5 : 0.6));
      e.x !== undefined && e.setFlipX(Math.floor(time / 300) % 2 === 0);
      if (warn) {
        e.shell.setAlpha(Math.floor(time / 90) % 2 ? 0.45 : 0.95);
        if (time > e.nextTick) { DT.Audio.sfx('tick'); e.nextTick = time + 380; }
      }
      if (left <= 0) this.unseal(e);
    }

    unseal(e) {
      e.state = 'active'; e.angry = true; e.hits = 0; e.body.pushable = true;
      e.shell.setVisible(false).setAlpha(1);
      e.play(e.kind + '_walk');
      e.body.setVelocityY(-160);
      if (e.flyer) { e.body.setAllowGravity(false); e.baseY = e.y - 20; }
      this.fxPx.explode(10, e.x, e.y);
      this.emote(e, '!');
      this.applyTint(e);
      DT.Audio.sfx('unseal');
    }

    launchOrb(e, dir) {
      e.body.pushable = true;
      const kind = this.heroDef.orb;
      if (kind === 'blast') return this.blastOrb(e, dir);
      if (kind === 'wave') return this.waveOrb(e, dir);
      const now = this.time.now;
      e.state = 'rolling'; e.rollDir = dir; e.combo = 1; e.bounces = 0; e.rolledAt = now; e.nextTrail = 0;
      e.shell.setAlpha(1).setVisible(true);
      e.body.setVelocity(dir * this.S.orbSpeed, -120);
      this.ring(e.x, e.y, 0xffcd75, 1);
      this.fxStar.explode(4, e.x, e.y);
      this.cameras.main.shake(80, 0.003);
      this.hitStop(45);
      DT.Audio.sfx('kick');
    }

    updateRolling(e, time) {
      const b = e.body;
      if ((b.blocked.left && e.rollDir < 0) || (b.blocked.right && e.rollDir > 0)) {
        e.rollDir *= -1; e.bounces++;
        this.fxDust.explode(6, e.x - e.rollDir * 8, e.y);
        this.cameras.main.shake(60, 0.002);
        DT.Audio.sfx('bump');
        if (e.bounces > this.S.orbBounces) { this.burstOrb(e); return; }
      }
      b.setVelocityX(e.rollDir * this.S.orbSpeed);
      e.shell.rotation += e.rollDir * 0.35;
      e.rotation = e.shell.rotation;
      if (time > e.nextTrail) { this.fxLeaf.emitParticleAt(e.x - e.rollDir * 8, e.y + 4, 1); e.nextTrail = time + 45; }
      if (time - e.rolledAt > T.ROLL_MAX_TIME) this.burstOrb(e);
    }

    onEnemyEnemy(a, b) {
      const hittable = (x) => x.state === 'active' || x.state === 'sealed' || x.state === 'spawn';
      if (a.state === 'rolling' && hittable(b)) this.orbHit(a, b);
      else if (b.state === 'rolling' && hittable(a)) this.orbHit(b, a);
    }

    // 날아가는 구체가 다른 몬스터와 충돌 → 연쇄 처치
    orbHit(orb, victim) { this.chainKill(orb, victim); }

    // 구체·폭발·물결 공통: 연쇄 n번째 처치
    chainKill(src, victim) {
      src.combo++;
      const n = src.combo, pts = T.COMBO_BASE * n, orb = src;
      this.killEnemy(victim, orb.rollDir || (victim.x < src.x ? -1 : 1));
      this.addScore(pts);
      this.comboText(victim.x, victim.y, n, pts);
      this.registerCombo(n);
      this.hitStop(55 + n * 12);
      this.cameras.main.shake(110, 0.004 + 0.0015 * n);
      if (!DT.FX.play(this, 'poof', victim.x, victim.y + 8 * DT.SPR, { depth: 33, scale: 0.75 })) this.ring(victim.x, victim.y, 0xffffff, 1 + n * 0.15);
      this.fxStar.explode(8 + n * 3, victim.x, victim.y);
      DT.Audio.sfx('kill', n);
    }

    // 도토: 구체가 그 자리에서 펑! 범위 안의 적을 모두 연쇄 처치
    blastOrb(e, dir) {
      if (e.state !== 'sealed') return;
      e.state = 'blasting'; e.combo = 1; e.rollDir = dir;
      e.body.setVelocity(0, 0);
      this.tweens.add({ targets: e.shell, scale: DT.SPR * 1.5, duration: 140, yoyo: true });
      e.shell.setTintFill(0xffffff);
      DT.Audio.sfx('kick');
      this.time.delayedCall(150, () => {
        if (!e.active) return;
        const R = 40 + (this.S.orbBounces - 3) * 12;
        this.ring(e.x, e.y, 0xffcd75, R / 14);
        this.cameras.main.shake(220, 0.009);
        this.cameras.main.flash(80, 255, 236, 180);
        this.hitStop(80);
        const targets = this.enemies.getChildren().filter(o => o !== e && o.active &&
          (o.state === 'active' || o.state === 'sealed' || o.state === 'spawn') && Phaser.Math.Distance.Between(o.x, o.y, e.x, e.y) <= R);
        targets.sort((a, b) => Phaser.Math.Distance.Between(a.x, a.y, e.x, e.y) - Phaser.Math.Distance.Between(b.x, b.y, e.x, e.y));
        targets.forEach((o, i) => this.time.delayedCall(i * 70, () => { if (o.active && o.state !== 'dead') this.chainKill(e, o); }));
        if (this.boss && this.boss.state === 'active' && Phaser.Math.Distance.Between(this.boss.x, this.boss.y, e.x, e.y) <= R + 26) this.bossHit(e);
        e.state = 'rolling';
        e.shell.clearTint();
        this.burstOrb(e);
      });
    }

    // 퐁이: 구체가 터져 물결이 되어 바닥을 따라 흘러감
    waveOrb(e, dir) {
      if (e.state !== 'sealed') return;
      const w = this.waves.create(e.x, e.y, 'wave', 0);
      w.isWave = true; w.dir = dir; w.combo = 1; w.rollDir = dir; w.bornAt = this.time.now; w.nextFrame = 0; w.bounces = 0;
      w.setScale(DT.SPR).setDepth(12).setFlipX(dir < 0);
      w.body.setSize(26, 16).setOffset(1, 4);
      w.body.setVelocity(dir * this.S.orbSpeed * 0.9, -40);
      w.life = 2600 + (this.S.orbBounces - 3) * 900;
      DT.Audio.sfx('kick');
      this.ring(e.x, e.y, 0x73eff7, 1.2);
      this.cameras.main.shake(100, 0.004);
      // 봉인된 몬스터는 물결의 첫 희생자
      e.state = 'rolling'; e.combo = 0;
      this.killEnemy(e, dir);
      this.addScore(T.COMBO_BASE);
      this.popText(e.x, e.y - 10, '+' + T.COMBO_BASE, 0x73eff7);
      this.registerCombo(1);
    }

    updateWave(w, time) {
      if (!w.active) return;
      const b = w.body;
      if ((b.blocked.left && w.dir < 0) || (b.blocked.right && w.dir > 0)) {
        w.bounces++;
        this.fxPx.explode(8, w.x + w.dir * 10, w.y);
        if (w.bounces > 1) { this.endWave(w); return; }
        w.dir *= -1; w.rollDir = w.dir; w.setFlipX(w.dir < 0);
      }
      b.setVelocityX(w.dir * this.S.orbSpeed * 0.9);
      if (time > w.nextFrame) { w.setFrame(w.frame.name === 0 ? 1 : 0); w.nextFrame = time + 110; this.fxPx.emitParticleAt(w.x - w.dir * 10, w.y + 6, 2); }
      const age = time - w.bornAt;
      if (age > w.life - 500) w.setAlpha((w.life - age) / 500);
      if (age > w.life || w.y > DT.H + 20) this.endWave(w);
    }

    waveHit(w, e) {
      if (!w.active || !e.active) return;
      if (e.state === 'active' || e.state === 'sealed' || e.state === 'spawn') this.chainKill(w, e);
    }

    endWave(w) {
      if (!w.active) return;
      const n = w.combo;
      this.fxPx.explode(14, w.x, w.y);
      DT.FX.play(this, 'poof', w.x, w.y + 10, { depth: 33, scale: 0.6 });
      DT.Audio.sfx('bump');
      if (n >= 3) this.banner(n >= 4 ? 'FANTASTIC!' : 'GREAT!', 0x73eff7, 2.5);
      w.destroy();
    }

    burstOrb(e) {
      if (e.state !== 'rolling') return;
      const n = e.combo;
      this.killEnemy(e, e.rollDir);
      this.addScore(T.COMBO_BASE);
      this.popText(e.x, e.y - 10, '+' + T.COMBO_BASE, 0xffcd75);
      this.registerCombo(n);
      DT.FX.play(this, 'poof', e.x, e.y + 8 * DT.SPR, { depth: 33 }) || this.ring(e.x, e.y, 0xffcd75, 1.6);
      this.fxStar.explode(16, e.x, e.y);
      this.fxLeaf.explode(12, e.x, e.y);
      this.cameras.main.shake(160, 0.006);
      DT.Audio.sfx('burst');
      if (!this.boss && n >= this.stageEnemyTotal && n >= 3) {
        this.time.delayedCall(250, () => {
          this.banner('PERFECT!', 0x73eff7, 3, 1200);
          this.popText(160, 140, '+10000', 0xffcd75, 2, 1400);
          this.addScore(10000);
          this.cameras.main.flash(120, 255, 255, 255);
          DT.Audio.sfx('perfect');
        });
      } else if (n >= 4) this.time.delayedCall(200, () => this.banner('FANTASTIC!', 0xef7d57, 2.5));
      else if (n >= 3) this.time.delayedCall(200, () => this.banner('GREAT!', 0xa7f070, 2.5));
    }

    killEnemy(e, dir) {
      if (e.state === 'dead') return;
      const wasOrb = e.state === 'sealed' || e.state === 'rolling';
      e.state = 'dead';
      if (wasOrb) this.fxPx.explode(12, e.x, e.y);
      e.shell.setVisible(false);
      e.clearTint();
      e.play(e.kind + '_struggle');
      e.setFlipY(true);
      e.setCollideWorldBounds(false);
      e.body.checkCollision.none = true;
      e.body.setAllowGravity(true);
      e.body.setVelocity(dir * Phaser.Math.Between(60, 120), -230);
      e.body.setAngularVelocity(dir * 540);
      e.setDepth(20);
      this.time.delayedCall(650, () => {
        const fx = DT.clamp(e.x, 28, 292), fy = DT.clamp(e.y, 28, 200);
        this.spawnFragment(fx, fy);
        e.shell.destroy();
        e.destroy();
      });
    }

    registerCombo(n) {
      this.chainCombo = Math.max(n, this.time.now < this.chainUntil ? this.chainCombo : 0);
      this.chainUntil = this.time.now + 2200;
      this.maxCombo = Math.max(this.maxCombo, n);
    }

    /* ───────────── 플레이어 피격 ───────────── */
    onPlayerEnemy(a, b) {
      const e = a === this.player ? b : a;
      if (e.state !== 'active' || this.dead || this.cleared) return;
      if (this.time.now < this.invUntil) return;
      this.hurtPlayer(e);
    }

    hurtPlayer(e) {
      const now = this.time.now, p = this.player;
      this.hp--;
      this.invUntil = now + T.INVINCIBLE_MS;
      this.hurtUntil = now + 350;
      this.knockUntil = now + 260;
      const dir = p.x < e.x ? -1 : 1;
      p.body.setVelocity(dir * 140, -200);
      this.cameras.main.shake(180, 0.008);
      this.cameras.main.flash(90, 177, 62, 83);
      this.hitStop(90);
      DT.Audio.sfx('hurt');
      if (this.hp <= 0) this.die();
    }

    die() {
      if (this.dead) return;
      this.dead = true; this.fireLocked = true;
      const p = this.player;
      p.play(this.hero + '_hurt');
      p.setCollideWorldBounds(false);
      p.body.checkCollision.none = true;
      p.body.setVelocity(0, -280);
      DT.Audio.music(false);
      DT.Audio.sfx('die');
      DT.saveHi(this.score);
      this.time.delayedCall(1700, () => {
        this.run.score = this.score; this.run.learned = this.learned; this.run.maxCombo = this.maxCombo;
        this.scene.start('GameOver', { run: this.run });
      });
    }

    /* ───────────── 중국어 조각 ───────────── */
    nextDropChar() {
      if (!this.dropQueue.length) return null;
      const ch = this.dropQueue[this.dropIndex % this.dropQueue.length];
      this.dropIndex++;
      return ch;
    }

    spawnFragment(x, y) {
      if (this.dead) return;
      const ch = this.nextDropChar();
      if (!ch) return;
      const f = this.frags.create(x, y, 'token');
      f.setDepth(15);
      f.body.setSize(12, 12);
      f.body.setVelocity(Phaser.Math.Between(-40, 40), -150);
      f.body.setBounce(0.35);
      f.body.setDragX(90);
      f.setCollideWorldBounds(true);
      f.isFrag = true; f.ch = ch; f.bornAt = this.time.now; f.collected = false;
      f.label = DT.text(this, x, y, ch.h, { font: 'zh', size: 9, color: '#1a1c2c', stroke: null, depth: 16 });
      this.ring(x, y, 0xffcd75, 0.6);
      if (this.cleared) this.time.delayedCall(250, () => this.onCollect(this.player, f));
    }

    updateFrags(time) {
      this.frags.getChildren().slice().forEach(f => {
        if (!f.active) return;
        if (f.label) f.label.setPosition(Math.round(f.x), Math.round(f.y + 1));
        if (this.S.magnet && !this.dead) {
          const dx = this.player.x - f.x, dy = this.player.y - f.y, d = Math.hypot(dx, dy);
          if (d < this.S.magnet) { f.body.setVelocity(dx / d * 160, dy / d * 160); f.body.setAllowGravity(false); }
          else f.body.setAllowGravity(true);
        }
        const age = time - f.bornAt;
        if (age > 7000) {
          const vis = Math.floor(time / 100) % 2 === 0;
          f.setVisible(vis); if (f.label) f.label.setVisible(vis);
        }
        if (age > 9500) { if (f.label) f.label.destroy(); f.destroy(); }
      });
    }

    onCollect(a, b) {
      const f = a && a.isFrag ? a : b;
      if (!f || !f.isFrag || !f.active || f.collected || this.dead) return;
      f.collected = true;
      this.inventory.push(f.ch);
      this.addScore(50);
      DT.Audio.sfx('collect');
      // 글자 + 병음 표시
      const lab = f.label; f.label = null;
      if (lab) this.tweens.add({ targets: lab, x: 270, y: 12, scale: 0.6, alpha: 0, duration: 450, ease: 'Cubic.easeIn', onComplete: () => lab.destroy() });
      const py = DT.text(this, f.x, f.y - 12, f.ch.h + ' ' + f.ch.p, { font: 'zh', size: 9, color: '#ffcd75', depth: 46 });
      this.tweens.add({ targets: py, y: py.y - 14, alpha: 0, delay: 500, duration: 500, onComplete: () => py.destroy() });
      this.fxStar.explode(4, f.x, f.y);
      f.destroy();
      this.checkChunks();
      this.refreshInventory();
    }

    onEnemyFrag(a, b) {
      const f = a.isFrag ? a : b, e = a.isFrag ? b : a;
      if (e.kind !== 'thief' || e.state !== 'active' || !f.active || f.collected) return;
      f.collected = true;
      this.popText(f.x, f.y - 8, 'STOLEN!', 0xef7d57);
      this.emote(e, '!');
      DT.Audio.sfx('steal');
      if (f.label) f.label.destroy();
      f.destroy();
    }

    checkChunks() {
      (this.stage.chunks || []).forEach(id => {
        if (this.completed.has(id)) return;
        const v = DT.DATA.vocabById[id];
        if (!v) return;
        const used = [];
        for (const c of v.chars) {
          const i = this.inventory.findIndex((x, j) => x.h === c.h && used.indexOf(j) < 0);
          if (i < 0) return;
          used.push(i);
        }
        this.inventory = this.inventory.filter((_, j) => used.indexOf(j) < 0);
        this.completed.add(id);
        if (this.learned.indexOf(id) < 0) this.learned.push(id);
        this.onChunk(v);
      });
    }

    onChunk(v) {
      let reward = '';
      if (v.reward === 'heal') {
        if (this.hp < this.S.maxHp) { this.hp++; reward = '체력 +1'; } else { this.addScore(1000); reward = '체력 MAX! +1000'; }
      } else if (v.reward === 'power') {
        this.powerUntil = this.time.now + 8000; reward = '씨앗탄 강화! (8초)';
      } else { this.addScore(2000); reward = '점수 +2000'; }
      DT.Audio.sfx('chunk');
      this.time.delayedCall(250, () => DT.Audio.speak(v.hanzi));

      const box = DT.panel(this, 92, 34, 136, 58, { border: DT.C.yellow, fill: DT.C.ink, alpha: 0.95, depth: 55 });
      const t0 = DT.ptext(this, 160, 39, 'CHUNK GET!', { ox: 0.5, tint: 0xffcd75, depth: 56 });
      const t1 = DT.text(this, 160, 58, v.hanzi, { font: 'zh', size: 18, color: '#a7f070', strokeThickness: 3, depth: 56 });
      const t2 = DT.text(this, 160, 74, v.pinyin + '  ·  ' + v.meaning, { font: 'ko', size: 9, color: '#f4f4f4', depth: 56 });
      const t3 = DT.text(this, 160, 86, reward, { font: 'ko', size: 8, color: '#ffcd75', depth: 56 });
      const all = [box, t0, t1, t2, t3];
      all.forEach(o => o.setAlpha(0));
      this.tweens.add({ targets: all, alpha: 1, duration: 150 });
      this.tweens.add({ targets: all, alpha: 0, delay: 2000, duration: 300, onComplete: () => all.forEach(o => o.destroy()) });
      this.fxStar.explode(12, this.player.x, this.player.y);
      DT.FX.play(this, 'collect', this.player.x, this.player.y + 10, { depth: 34 });
    }

    /* ───────────── HUD ───────────── */
    buildHud() {
      this.add.rectangle(0, 0, DT.W, 18, DT.C.ink, 0.82).setOrigin(0).setDepth(40);
      this.add.rectangle(0, 18, DT.W, 1, DT.C.teal, 1).setOrigin(0).setDepth(40);
      DT.ptext(this, 4, 1, '1P', { tint: 0xef7d57, depth: 41 });
      this.hudScore = DT.ptext(this, 20, 1, '0000000', { tint: 0xf4f4f4, depth: 41 });
      DT.ptext(this, 112, 1, 'HI', { tint: 0xef7d57, depth: 41 });
      this.hudHi = DT.ptext(this, 128, 1, '0000000', { tint: 0xffcd75, depth: 41 });
      DT.ptext(this, 300, 1, 'STAGE ' + this.stage.id, { ox: 1, tint: 0x73eff7, depth: 41 });
      this.hearts = [];
      for (let i = 0; i < T.MAX_HP_CAP; i++) this.hearts.push(this.add.image(4 + i * 9, 10, 'heart').setOrigin(0).setDepth(41));
      this.hudCombo = DT.ptext(this, 112, 10, '', { tint: 0xef7d57, depth: 41 });
      DT.text(this, 236, 14, '조각', { font: 'ko', size: 7, color: '#94b0c2', stroke: null, ox: 1, depth: 41 });
      this.invSlots = [];
      for (let i = 0; i < 7; i++) {
        this.invSlots.push(DT.text(this, 245 + i * 11, 14, '', { font: 'zh', size: 8, color: '#ffcd75', strokeThickness: 2, depth: 41 }));
      }
    }

    refreshInventory() {
      this.invSlots.forEach((s, i) => s.setText(this.inventory[i] ? this.inventory[i].h : ''));
    }

    updateHud(time) {
      const c = this.hudCache;
      if (c.score !== this.score) {
        c.score = this.score;
        this.hudScore.setText(DT.pad(this.score, 7));
        const hi = Math.max(this.score, DT.getHi());
        this.hudHi.setText(DT.pad(hi, 7));
      }
      if (c.hp !== this.hp) {
        c.hp = this.hp;
        this.hearts.forEach((h, i) => h.setVisible(i < this.S.maxHp).setTexture(i < this.hp ? 'heart' : 'heartEmpty'));
      }
      const combo = time < this.chainUntil && this.chainCombo >= 2 ? this.chainCombo : 0;
      if (c.combo !== combo) { c.combo = combo; this.hudCombo.setText(combo ? 'COMBO ×' + combo : ''); }
      if (time < this.powerUntil) this.hudCombo.setText('POWER ' + Math.ceil((this.powerUntil - time) / 1000) + (combo ? '  ×' + combo : ''));
      else if (c.powerShown) this.hudCombo.setText(combo ? 'COMBO ×' + combo : '');
      c.powerShown = time < this.powerUntil;
    }

    addScore(n) { this.score += n; }

    /* ───────────── 진행 ───────────── */
    readySequence() {
      const title = DT.ptext(this, 160, 96, 'STAGE ' + this.stage.id, { ox: 0.5, oy: 0.5, tint: 0x73eff7, scale: 2, depth: 60 });
      const name = DT.text(this, 160, 114, this.stage.name || '', { font: 'ko', size: 12, color: '#ffcd75', strokeThickness: 3, depth: 60 });
      const ready = DT.ptext(this, 160, 134, 'READY?', { ox: 0.5, oy: 0.5, tint: 0xf4f4f4, scale: 1, depth: 60 });
      this.time.delayedCall(1500, () => {
        title.destroy(); name.destroy(); ready.destroy();
        this.banner('GO!', 0xa7f070, 3, 400);
        DT.Audio.sfx('go');
        this.enemies.getChildren().forEach(e => { if (e.state === 'spawn') { e.state = 'active'; e.setAlpha(1); } });
        this.started = true; this.fireLocked = false;
        if (this.boss) this.boss.state = 'active';
        this.stageStartAt = this.time.now;
      });
    }

    aliveCount() { return this.enemies.getChildren().filter(e => e.state !== 'dead').length; }

    stageClear() {
      this.cleared = true; this.fireLocked = true;
      const clearTime = this.time.now - this.stageStartAt;
      const D = this.boss ? 1800 : 0;
      this.time.delayedCall(500 + D, () => {
        this.frags.getChildren().slice().forEach((f, i) => this.time.delayedCall(i * 120, () => this.onCollect(this.player, f)));
      });
      this.time.delayedCall(1500 + D, () => {
        DT.Audio.music(false);
        DT.Audio.sfx('clear');
        this.controlLocked = true; this.winPose = true;
        this.player.body.setVelocityX(0);
        this.banner('STAGE CLEAR!', 0xffcd75, 2.5, 1800);
        if (clearTime < 60000) {
          const bonus = clearTime < 35000 ? 3000 : 1000;
          this.time.delayedCall(500, () => { this.popText(160, 140, 'TIME BONUS +' + bonus, 0xa7f070, 1, 1500); this.addScore(bonus); });
        }
      });
      this.time.delayedCall(3700 + D, () => this.openQuiz());
    }

    openQuiz() {
      if (this.dead) return;
      DT.saveHi(this.score);
      const q = DT.makeQuiz(this.stage);
      if (!q) { this.goNext(0); return; }
      this.scene.pause();
      this.scene.launch('Quiz', { question: q, stageId: this.stage.id });
    }

    // 퀴즈 결과를 받아 다음 스테이지 데이터 계산
    // 퀴즈 결과 → 파워업 선택 → 다음 스테이지 (마지막이면 엔딩)
    nextStageData(bonus, firstTry) {
      const run = this.run;
      run.score = this.score + (bonus || 0);
      run.hp = this.hp; run.learned = this.learned; run.maxCombo = this.maxCombo;
      DT.saveHi(run.score);
      if (this.stageIndex + 1 < DT.DATA.stages.length) {
        run.stage = this.stageIndex + 1;
        return { key: 'Upgrade', data: { run, picks: firstTry ? 2 : 1 } };
      }
      return { key: 'Ending', data: { run } };
    }

    goNext(bonus) {
      const n = this.nextStageData(bonus);
      this.scene.start(n.key, n.data);
    }

    togglePause() {
      this.isPaused = !this.isPaused;
      if (this.isPaused) {
        this.physics.world.pause(); this.tweens.pauseAll(); this.anims.pauseAll(); this.time.paused = true;
        this.pauseBox = DT.panel(this, 110, 96, 100, 40, { depth: 70 });
        this.pauseText = DT.ptext(this, 160, 104, 'PAUSE', { ox: 0.5, tint: 0xffcd75, scale: 2, depth: 71 });
        DT.Audio.music(false);
      } else {
        this.physics.world.resume(); this.tweens.resumeAll(); this.anims.resumeAll(); this.time.paused = false;
        if (this.pauseBox) { this.pauseBox.destroy(); this.pauseText.destroy(); }
        DT.Audio.music(true);
      }
    }

    update(time) {
      DT.Input.update();
      if (DT.Input.justDown('pause') && this.started && !this.cleared && !this.dead) this.togglePause();
      if (this.isPaused) return;
      time = this.time.now;

      this.updatePlayer(time);
      this.enemies.getChildren().slice().forEach(e => this.updateEnemy(e, time));
      this.seeds.getChildren().slice().forEach(s => {
        if (!s.active) return;
        if (s.mode === 'roll') s.body.setVelocityX(s.dir * s.speed);
        if (s.mode && s.mode !== 'arc' && Math.abs(s.x - s.startX) > s.range) { this.fxLeaf.explode(2, s.x, s.y); s.destroy(); return; }
        if (s.mode === 'line') s.setAlpha(1 - Math.max(0, Math.abs(s.x - s.startX) / s.range - 0.7) * 2);
        if (time - s.bornAt > T.SEED_LIFE * (s.mode === 'roll' ? 1.6 : 1) || s.x < -10 || s.x > DT.W + 10 || s.y > DT.H + 10) s.destroy();
      });
      this.waves.getChildren().slice().forEach(w => this.updateWave(w, time));
      this.updateFrags(time);
      this.updateBoss(time);

      if (this.started && !this.cleared && !this.dead) {
        if (!this.hurry && !this.boss && time - this.stageStartAt > T.HURRY_TIME) {
          this.hurry = true;
          this.banner('HURRY UP!', 0xb13e53, 2.5, 1200);
          DT.Audio.sfx('hurry');
          this.enemies.getChildren().forEach(e => { if (e.state === 'active') { e.angry = true; this.applyTint(e); } });
        }
        if (this.boss ? this.boss.state === 'dead' : this.aliveCount() === 0) this.stageClear();
      }
      if (this.dead && this.player.y > DT.H + 40) this.player.body.setVelocity(0, 0);
      this.updateHud(time);
    }
  }

  DT.GameScene = GameScene;
})();
