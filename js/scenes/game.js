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
      this.climb = this.stage.climb || null;
      // 씬 객체는 재사용되므로 스테이지별 상태를 매번 초기화
      this.boss = null; this.goal = null; this.crumbles = null; this.movers = null; this.moverSprites = [];
      this.hazard = null; this.hazardBody = null; this.riding = null; this.lastSec = undefined;
      this.lastCombo = null; this.pauseBox = null; this.flag = null; this.ambientFx = null;
      this.mapH = this.stage.map.length * DT.TILE;
      this.physics.world.setBounds(0, 0, DT.W, this.mapH);
      // 화면에 고정되는 UI 레이어 (세로로 스크롤되는 등반 맵에서도 HUD가 그대로)
      this.ui = this.add.container(0, 0).setDepth(60);
      this.physics.world.gravity.y = T.GRAVITY;

      // 상태값
      this.facing = 1;
      this.lastGroundAt = -1e9; this.jumpBufferUntil = 0; this.jumping = false;
      this.nextFireAt = 0; this.shootPoseUntil = 0; this.invUntil = 0; this.hurtUntil = 0; this.knockUntil = 0;
      this.powerUntil = 0; this.wasOnGround = true; this.airStart = 0;
      this.started = false; this.cleared = false; this.dead = false; this.isPaused = false; this.hurry = false;
      this.fireLocked = true; this.controlLocked = false; this.winPose = false; this.hitStopping = false;
      this.chainCombo = 0; this.chainUntil = 0;
      this.strikeUntil = 0; this.dropUntil = 0; this.pushing = false; this.dropkick = false; this.strikeAnim = 'kick';
      this.inventory = []; this.completed = new Set(); this.dropIndex = 0;
      this.hudCache = {};

      this.theme = DT.THEMES[this.stage.theme] ? this.stage.theme : 'forest';
      this.bg = this.add.image(0, 0, 'bg_' + this.theme).setOrigin(0).setDepth(-10);
      this.terrain = [];
      this.spawns = [];
      this.buildMap();
      this.buildDropQueue();

      // 오브젝트 그룹
      this.seeds = this.physics.add.group();
      this.enemies = this.physics.add.group();
      this.frags = this.physics.add.group();
      this.waves = this.physics.add.group();
      this.eshots = this.physics.add.group();   // 몬스터·보스가 쏜 탄
      this.poops = this.physics.add.group();    // 똥강아지가 남긴 똥
      this.createFx();
      this.createPlayer();
      this.spawns.forEach(s => this.spawnEnemy(s));
      this.stageEnemyTotal = this.spawns.length;
      if (this.stage.boss) this.createBoss(this.stage.boss);

      // 충돌
      // ↓ + 점프: 발판 아래로 내려가기 (일방향 발판만 통과, 바닥·벽은 그대로)
      this.physics.add.collider(this.player, this.terrain, null, (a, b) => {
        const z = a === this.player ? b : a;
        return !this.dead && !(z.oneWay && this.time.now < this.dropUntil);
      });
      this.physics.add.collider(this.enemies, this.terrain, null, (e) => e.state !== 'dead');
      this.physics.add.collider(this.seeds, this.terrain, (a, b) => this.popSeed(a.isSeed ? a : b));
      this.physics.add.collider(this.frags, this.terrain);
      this.physics.add.collider(this.waves, this.terrain);
      this.physics.add.collider(this.eshots, this.terrain, (a, b) => { const sh = a.isShot ? a : b; this.popShot(sh); },
        (a, b) => { const sh = a.isShot ? a : b, z = a.isShot ? b : a; return !(sh.solidOnly && z.oneWay); });
      this.physics.add.collider(this.poops, this.terrain);
      this.physics.add.overlap(this.player, this.eshots, (a, b) => {
        const sh = a.isShot ? a : b;
        if (!sh.active || this.dead || this.cleared || this.time.now < this.invUntil) return;
        this.popShot(sh); this.hurtPlayer(sh);
      });
      this.physics.add.overlap(this.player, this.poops, (a, b) => {
        const pp = a.isPoop ? a : b;
        if (!pp.active || this.dead || this.cleared || this.time.now < this.invUntil) return;
        this.popText(pp.x, pp.y - 10, '으악, 똥!', 0x8a4b2a);
        DT.Audio.sfx('squish');
        this.fxDust.explode(6, pp.x, pp.y);
        pp.destroy();
        this.hurtPlayer(pp);
      });
      this.physics.add.overlap(this.seeds, this.eshots, (a, b) => {
        const sd = a.isSeed ? a : b, sh = a.isSeed ? b : a;
        if (!sd.active || !sh.active || sh.unbreakable) return;
        sd.destroy(); this.popShot(sh); this.addScore(20);
      });
      this.physics.add.overlap(this.waves, this.enemies, (a, b) => { const w = a.isWave ? a : b, e = a.isWave ? b : a; this.waveHit(w, e); });
      this.physics.add.overlap(this.seeds, this.enemies, this.onSeedEnemy, (a, b) => { const e = a.isSeed ? b : a; return e.state === 'active' || e.state === 'sealed'; }, this);
      this.physics.add.collider(this.player, this.enemies, null, (a, b) => { const e = a === this.player ? b : a; return e.state === 'sealed' && !this.dead; });
      this.physics.add.overlap(this.player, this.enemies, this.onPlayerEnemy, null, this);
      this.physics.add.overlap(this.enemies, this.enemies, this.onEnemyEnemy, null, this);
      this.physics.add.overlap(this.player, this.frags, this.onCollect, null, this);
      this.physics.add.overlap(this.enemies, this.frags, this.onEnemyFrag, null, this);

      this.buildHud();
      if (this.climb) this.setupClimb();
      this.readySequence();
      this.musicSpec = this.stage.boss ? { boss: this.stage.world } : { stage: this.stageIndex, world: this.stage.world, climb: !!this.climb };
      DT.Audio.music(true, this.musicSpec);
    }

    /* ───────────── 맵 ───────────── */
    buildMap() {
      const map = this.stage.map, S = DT.TILE;
      const at = (r, c) => (map[r] && map[r][c]) || '.';
      const rng = DT.rng(this.stageIndex * 97 + 13);
      this.slopes = {};
      for (let r = 0; r < map.length; r++) {
        for (let c = 0; c < map[r].length; c++) {
          const ch = map[r][c];
          const x = c * S, y = r * S;
          if (ch === '#') {
            const top = r > 0 && at(r - 1, c) !== '#';
            this.add.image(x, y, (top ? 'groundTop_' : 'stone_') + this.theme, Math.floor(rng() * 4)).setOrigin(0).setDepth(-2);
          } else if (ch === '=' || ch === 'G') {
            if (ch === 'G') this.goal = { x: x + 8, y };
            const isP = (q) => q === '=' || q === 'G';
            const l = !isP(at(r, c - 1)), rr = !isP(at(r, c + 1));
            const key = l && rr ? 'platLR' : l ? 'platL' : rr ? 'platR' : 'plat';
            this.add.image(x, y, key + '_' + this.theme, key === 'plat' ? Math.floor(rng() * 4) : 0).setOrigin(0).setDepth(-2);
            // 장식
            const roll = rng();
            const green = this.theme !== 'jiuzhaigou';
            if (green && roll < 0.22) this.add.image(x + 4 + Math.floor(rng() * 6), y, 'deco_tuft').setOrigin(0, 1).setDepth(-3);
            else if (this.theme === 'forest' && roll < 0.3) this.add.image(x + 5 + Math.floor(rng() * 5), y, 'deco_shroom').setOrigin(0, 1).setDepth(-3);
            else if (roll < 0.4) this.add.image(x + 6, y, rng() < 0.5 ? 'deco_flower' : 'deco_flower2').setOrigin(0, 1).setDepth(-3);
          } else if (ch === '/' || ch === '\\') {
            this.slopes[r + ',' + c] = ch;
          } else if (ch === 'C') {
            const t = this.physics.add.staticImage(x + 8, y + 4, 'crumble_' + this.theme).setDepth(-2);
            t.body.setSize(16, 8); t.body.checkCollision.down = t.body.checkCollision.left = t.body.checkCollision.right = false;
            t.crumble = true; t.home = { x: x + 8, y: y + 4 };
            (this.crumbles = this.crumbles || []).push(t);
          } else if (ch === 'M') {
            (this.movers = this.movers || []).push({ x: x + 8, y: y + 4 });
          } else if (ch === 'P') {
            this.playerSpawn = { x: x + 8, y: y + 16 - 8 * DT.SPR - 0.5 };
          } else if (DT.ENEMY_CODES[ch]) {
            const kind = DT.ENEMY_CODES[ch];
            this.spawns.push({ kind, x: x + 8, y: DT.ENEMY_DEFS[kind].fly ? y + 8 : y + 16 - 8 * DT.SPR - 0.5 });
          }
        }
      }
      this.drawSlopes();
      // 물리 바디: 벽은 직사각형으로 병합, 발판은 위에서만 밟히는 일방향
      const runs = [];
      for (let r = 0; r < map.length; r++) {
        let c = 0;
        while (c < 20) {
          let ch = at(r, c);
          if (ch === 'G') ch = '=';
          if (ch === '#' || ch === '=') {
            const same = (q) => (q === 'G' ? '=' : q) === ch;
            let e = c; while (same(at(r, e + 1))) e++;
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

    /* ── 경사로(45도): 오르막·내리막. 위에서만 밟히고, 내려갈 땐 미끄러짐 ── */
    drawSlopes() {
      const keys = Object.keys(this.slopes);
      if (!keys.length) return;
      const key = 'slopes_' + this.stageIndex;
      if (this.textures.exists(key)) this.textures.remove(key);
      const tex = this.textures.createCanvas(key, DT.W, this.mapH), ctx = tex.getContext();
      const T2 = DT.THEMES[this.theme], [body, spk, hi] = T2.plat, [t0, t1, t2] = T2.top;
      const px = (x, y, col) => { ctx.fillStyle = col; ctx.fillRect(x, y, 1, 1); };
      keys.forEach(k => {
        const [r, c] = k.split(',').map(Number), ch = this.slopes[k];
        for (let lx = 0; lx < 16; lx++) {
          const x = c * 16 + lx, sY = this.slopeSurfaceY(ch, r, lx);
          px(x, sY, t0); px(x, sY + 1, t1); px(x, sY + 2, t1); px(x, sY + 3, (x % 3) ? t1 : t2);
          for (let y = 4; y < 8; y++) px(x, sY + y, ((x + y) % 5 === 0) ? spk : ((x * 7 + y) % 11 === 0 ? hi : body));
          px(x, sY + 8, '#1a1c2c');
        }
      });
      tex.refresh();
      this.add.image(0, 0, key).setOrigin(0).setDepth(-2);
    }
    slopeSurfaceY(ch, r, lx) { return ch === '/' ? r * 16 + 15 - lx : r * 16 + lx; }
    // (x, 발밑 y)에서 경사로 표면 찾기
    slopeAt(x, yb) {
      const c = Math.floor(x / 16), lx = Math.floor(x) - c * 16;
      const r0 = Math.floor(yb / 16);
      for (let r = r0 - 1; r <= r0 + 1; r++) {
        const ch = this.slopes[r + ',' + c];
        if (!ch) continue;
        const sY = this.slopeSurfaceY(ch, r, lx);
        if (yb >= sY - 5 && yb <= sY + 9) return { s: sY, down: ch === '/' ? -1 : 1 };
      }
      return null;
    }
    // 몸이 경사로 위에 있으면 표면에 붙임 (아래에서 위로 뛰어오를 때는 통과)
    stickToSlope(body) {
      if (!body || !body.enable || body.velocity.y < -1) return null;
      const hit = this.slopeAt(body.center.x, body.bottom);
      if (!hit) return null;
      body.y = hit.s - body.height;
      if (body.velocity.y > 0) body.velocity.y = 0;
      return hit;
    }
    applySlopes() {
      if (!this.slopes || !Object.keys(this.slopes).length) { this.onSlope = null; return; }
      const p = this.player;
      this.onSlope = (!this.dead && this.time.now >= this.dropUntil) ? this.stickToSlope(p.body) : null;
      this.enemies.getChildren().forEach(e => {
        if (!e.active || e.state === 'dead' || (e.flyer && e.state === 'active')) { e.onSlope = null; return; }
        e.onSlope = this.stickToSlope(e.body);
      });
      [this.frags, this.poops, this.waves].forEach(g => g.getChildren().forEach(o => { if (o.active) o.onSlope = this.stickToSlope(o.body); }));
      this.seeds.getChildren().forEach(sd => { if (sd.active && sd.mode === 'roll') this.stickToSlope(sd.body); });
    }

    addBody(x, y, w, h, oneWay) {
      const z = this.add.zone(x + w / 2, y + h / 2, w, h);
      this.physics.add.existing(z, true);
      if (oneWay) {
        z.oneWay = true;
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
      this.ambientFx = DT.ambient(this, this.theme, -5);
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
      this.ui.add(t);
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
      const onGround = b.blocked.down || b.touching.down || !!this.onSlope;
      if (onGround) this.lastGroundAt = time;
      const locked = this.controlLocked;
      const knock = time < this.knockUntil;

      let target = 0;
      if (!locked) { if (I.isDown('left')) target -= 1; if (I.isDown('right')) target += 1; }
      if (target !== 0) this.facing = target;
      if (!knock) {
        const nv = Phaser.Math.Linear(b.velocity.x, target * this.S.move, onGround ? T.PLAYER_ACCEL : T.PLAYER_AIR_ACCEL);
        b.setVelocityX(target === 0 && Math.abs(nv) < 3 ? 0 : nv);
        // 경사로: 가만히 있어도 아래로 미끄러지고, 내리막으로 달리면 더 빨라짐 · 오르막은 느림
        if (this.onSlope) {
          const d = this.onSlope.down, dt = this.game.loop.delta / 1000;
          if (target === 0) b.setVelocityX(DT.clamp(this.slideVx = (this.slideVx || 0) + d * 300 * dt, -170, 170));
          else if (target === d) b.setVelocityX(target * this.S.move * 1.7);
          else b.setVelocityX(target * this.S.move * 0.7);
          if (Math.abs(b.velocity.x) > 80 && time > (this.slideDustAt || 0)) { this.slideDustAt = time + 70; this.fxDust.explode(2, p.x - d * 4, p.y + 8); }
        } else this.slideVx = 0;
        if (this.onSlope && target === 0) this.slideVx = b.velocity.x;
      }

      // 점프 (코요테 타임 + 입력 버퍼 + 가변 높이)
      if (!locked && I.justDown('jump')) {
        if (I.isDown('down') && onGround && this.onOneWay()) {
          this.dropUntil = time + 260;
          b.setVelocityY(60);
          this.fxDust.explode(3, p.x, p.y + 8);
        } else this.jumpBufferUntil = time + T.JUMP_BUFFER_MS;
      }
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

    // 발밑이 일방향 발판(=·무너지는·움직이는)인지
    onOneWay() {
      if (this.onSlope) return true;
      const p = this.player, y = p.body.bottom + 1;
      const hits = this.physics.overlapRect(p.body.x + 1, y, p.body.width - 2, 3, true, true);
      if (!hits.length) return false;
      return hits.every(bd => bd.gameObject && (bd.gameObject.oneWay || bd.gameObject.crumble || bd.gameObject.isMover));
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
      DT.Audio.sfx('shoot', this.heroDef.shot);
    }

    popSeed(s) {
      if (!s || !s.isSeed || !s.active) return;
      // 도토리는 바닥에 닿아도 계속 굴러가고, 벽에 부딪혀야 터짐
      if (s.mode === 'roll' && !(s.body.blocked.left || s.body.blocked.right)) return;
      this.fxLeaf.explode(3, s.x, s.y);
      s.destroy();
    }

    /* ───────────── 몬스터 ───────────── */
    /* ───────────── 진담 점프: 아래에서 올라오는 가시덩굴/독초를 피해 꼭대기로 ───────────── */
    setupClimb() {
      const c = this.climb, cam = this.cameras.main;
      cam.setBounds(0, 0, DT.W, this.mapH);
      cam.startFollow(this.player, true, 1, 0.12, 0, 30);
      cam.on('followupdate', () => this.syncScreenLayer());
      this.timeLeft = c.time * 1000;
      this.hazardY = this.mapH + 10;
      this.hazard = this.add.tileSprite(0, this.hazardY, DT.W, 40, 'hazard_' + c.hazard).setOrigin(0, 0).setDepth(30);
      this.hazardBody = this.add.rectangle(0, this.hazardY + 39, DT.W, this.mapH + 80, c.hazard === 'thorn' ? 0x2f5a2a : 0x4a2560).setOrigin(0, 0).setDepth(30);
      this.hazardGlow = this.add.rectangle(0, this.hazardY - 4, DT.W, 4, c.hazard === 'thorn' ? 0xb13e53 : 0xb55088, 0.35).setOrigin(0).setDepth(29);
      // 골 깃발
      if (this.goal) {
        this.flag = this.add.image(this.goal.x, this.goal.y, 'goalflag').setOrigin(0.15, 1).setDepth(5);
        this.tweens.add({ targets: this.flag, scaleX: 0.92, yoyo: true, repeat: -1, duration: 300 });
      }
      // 무너지는 발판
      if (this.crumbles) {
        this.physics.add.collider(this.player, this.crumbles, (a, b) => {
          const t = a === this.player ? b : a;
          if (!t.falling && this.player.body.touching.down) this.startCrumble(t);
        }, () => this.time.now >= this.dropUntil);
        this.physics.add.collider(this.enemies, this.crumbles, null, (e) => e.state !== 'dead');
      }
      // 움직이는 발판 (좌우 왕복, 위에 서면 함께 이동)
      this.moverSprites = (this.movers || []).map((m, i) => {
        const sp = this.physics.add.image(m.x, m.y, 'mplat_' + this.theme).setDepth(-1);
        sp.body.setAllowGravity(false); sp.body.setImmovable(true); sp.isMover = true;
        sp.body.checkCollision.down = sp.body.checkCollision.left = sp.body.checkCollision.right = false;
        sp.speed = 34 + (i % 3) * 8; sp.dir = i % 2 ? -1 : 1;
        sp.body.setVelocityX(sp.speed * sp.dir);
        return sp;
      });
      if (this.moverSprites.length) {
        this.physics.add.collider(this.player, this.moverSprites, (a, b) => { this.riding = a === this.player ? b : a; }, () => this.time.now >= this.dropUntil);
        this.physics.add.collider(this.enemies, this.moverSprites, null, (e) => e.state !== 'dead');
        this.physics.add.collider(this.frags, this.moverSprites);
      }
      // HUD: 남은 시간 · 높이
      this.hudTime = DT.ptext(this, 316, 10, 'TIME 00', { ox: 1, tint: 0xffcd75, depth: 41 });
      this.hudHeight = this.add.graphics().setDepth(41);
      this.ui.add([this.hudTime, this.hudHeight]);
      this.hazardName = c.hazard === 'thorn' ? '가시덩굴' : '독초';
      this.syncScreenLayer();
    }

    startCrumble(t) {
      t.falling = true;
      this.tweens.add({ targets: t, x: t.home.x + 1, yoyo: true, repeat: 5, duration: 40, onComplete: () => {
        t.body.enable = false;
        this.tweens.add({ targets: t, y: t.home.y + 20, alpha: 0, duration: 260 });
        this.fxDust.explode(5, t.x, t.y);
        DT.Audio.sfx('crumble');
        this.time.delayedCall(3200, () => {
          if (!t.active) return;
          t.setPosition(t.home.x, t.home.y).setAlpha(0); t.body.enable = true; t.body.reset(t.home.x, t.home.y); t.falling = false;
          this.tweens.add({ targets: t, alpha: 1, duration: 300 });
        });
      } });
    }

    // 화면 고정 레이어(HUD·배경)를 카메라 위치에 맞춤
    syncScreenLayer() {
      const v = this.cameras.main.worldView;
      this.ui.setPosition(v.x, v.y);
      this.bg.setPosition(v.x, v.y);
      if (this.ambientFx) this.ambientFx.setPosition(v.x, v.y);
    }

    updateClimb(time, delta) {
      const c = this.climb, p = this.player;
      // 움직이는 발판 왕복 + 올라탄 플레이어 이동
      (this.moverSprites || []).forEach(sp => {
        if (sp.x < 32) sp.dir = 1; else if (sp.x > 288) sp.dir = -1;
        sp.body.setVelocityX(sp.speed * sp.dir);
      });
      if (this.riding && p.body.touching.down && !this.dead) p.x += this.riding.body.deltaX();
      this.riding = null;
      if (!this.started || this.cleared || this.dead) return;
      // 제한 시간
      this.timeLeft -= delta;
      const sec = Math.max(0, Math.ceil(this.timeLeft / 1000));
      if (sec !== this.lastSec) {
        this.lastSec = sec;
        this.hudTime.setText('TIME ' + DT.pad(sec, 2)).setTint(sec <= 10 ? 0xb13e53 : 0xffcd75);
        if (sec <= 10 && sec > 0) DT.Audio.sfx('tick');
        if (sec === 0) { this.banner('TIME UP!', 0xb13e53, 2.5, 1000); this.hintText(this.hazardName + '이(가) 빨라져요! 서둘러요!'); }
      }
      // 올라오는 위험 지대: 점점 빨라지고, 너무 뒤처지면 화면 아래까지 따라옴
      const elapsed = (time - this.stageStartAt) / 1000;
      let speed = elapsed < 2.5 ? 0 : c.speed + elapsed * 0.18;
      if (this.timeLeft <= 0) speed *= 4;
      this.hazardY -= speed * delta / 1000;
      const viewBottom = this.cameras.main.worldView.bottom;
      if (this.hazardY > viewBottom + 14) this.hazardY = viewBottom + 14;
      this.hazard.setY(this.hazardY);
      this.hazardBody.setY(this.hazardY + 39);
      this.hazard.tilePositionX = Math.sin(time / 500) * 6;
      this.hazardGlow.setY(this.hazardY - 4).setAlpha(0.25 + Math.sin(time / 120) * 0.12);
      if (Math.random() < 0.3) this.fxPx.emitParticleAt(Math.random() * 320, this.hazardY + 2, 1);
      // 닿으면 피해 + 위로 튕겨 올림
      if (p.body.bottom > this.hazardY + 5 && time >= this.invUntil) {
        this.hurtPlayer({ x: p.x, y: p.y + 20 });
        p.body.setVelocity(0, -420);
        this.popText(p.x, p.y - 14, 'OUCH!', 0xb13e53);
      }
      // 몬스터·조각도 삼킴
      this.enemies.getChildren().forEach(e => { if (e.active && e.state !== 'dead' && e.y > this.hazardY + 4) this.killEnemy(e, 1); });
      this.frags.getChildren().slice().forEach(f => { if (f.active && f.y > this.hazardY) { if (f.label) f.label.destroy(); f.destroy(); } });
      // 높이 게이지
      const g = this.hudHeight; g.clear();
      const top = this.goal ? this.goal.y : 48, prog = DT.clamp((this.mapH - p.y) / (this.mapH - top), 0, 1);
      const hz = DT.clamp((this.mapH - this.hazardY) / (this.mapH - top), 0, 1);
      g.fillStyle(DT.C.ink, 0.8); g.fillRect(310, 24, 6, 170);
      g.fillStyle(0xb13e53, 0.9); g.fillRect(311, 25 + 168 * (1 - hz), 4, 168 * hz);
      g.fillStyle(0xa7f070, 1); g.fillRect(309, 24 + 168 * (1 - prog), 8, 3);
      g.fillStyle(0xffcd75, 1); g.fillRect(309, 22, 8, 3);
      // 골인
      if (this.goal && p.y < this.goal.y) this.climbClear();
    }

    climbClear() {
      if (this.cleared) return;
      const bonus = Math.max(0, Math.ceil(this.timeLeft / 1000)) * 100;
      this.banner('GOAL!', 0xa7f070, 3, 1400);
      if (bonus) { this.popText(this.player.x, this.player.y - 20, 'TIME BONUS +' + bonus, 0xffcd75, 1, 1500); this.addScore(bonus); }
      this.addScore(5000);
      DT.Audio.sfx('perfect');
      this.enemies.getChildren().slice().forEach(e => { if (e.state !== 'dead') this.killEnemy(e, e.x < 160 ? -1 : 1); });
      this.stageClear();
    }

    /* ───────────── 보스: 작은 적을 봉인한 구체로만 공격 가능 ───────────── */
    createBoss(def) {
      const b = this.boss = this.physics.add.sprite(250, 198, def.kind, 0);
      b.setScale(3.2).setTint(def.tint || 0xffffff).setDepth(5).setFlipX(true);
      b.body.setSize(12, 14).setOffset(2, 2);
      b.setCollideWorldBounds(true);
      b.def = def; b.hp = b.maxHp = def.hp; b.dir = -1; b.state = 'spawn';
      b.nextAttack = 0; b.nextSpawn = 0; b.invUntil = 0; b.attack = null; b.airborne = false;
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
      this.ui.add([this.bossName, this.bossBar]);
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
      b.crown.setPosition(Math.round(b.x), Math.round(b.y - 28));
      if (b.state !== 'active') return;
      const body = b.body, onGround = body.blocked.down || body.touching.down;
      const rage = b.hp <= b.maxHp / 2;
      if (time < b.invUntil) b.setTintFill(Math.floor(time / 60) % 2 ? 0xffffff : 0xff6070);
      else if (b.attack && b.attack.warn && time < b.attack.at) b.setTint(Math.floor(time / 80) % 2 ? 0xffffff : (b.def.tint || 0xffffff));
      else b.setTint(b.def.tint || 0xffffff);

      // 착지 충격파
      if (b.airborne && onGround && body.velocity.y >= 0) {
        b.airborne = false;
        this.cameras.main.shake(140, 0.008);
        DT.Audio.sfx('bump');
        if (b.shockOnLand) {
          [-1, 1].forEach(d => { const sh = this.fireShot('shock', b.x + d * 22, body.bottom - 5, d * 150, 0, { anim: 'shock_go', solidOnly: true, unbreakable: true, life: 2200 }); sh.isShock = true; });
          b.shockOnLand = false;
        }
      }
      if (!onGround) b.airborne = true;

      // 진행 중인 공격
      const A = b.attack;
      if (A) {
        if (A.type === 'charge') {
          if (time < A.at) body.setVelocityX(0);
          else {
            body.setVelocityX(A.dir * 270);
            if (time > A.at + 100 && (body.blocked.left || body.blocked.right)) {
              this.cameras.main.shake(200, 0.01); DT.Audio.sfx('bump');
              body.setVelocity(-A.dir * 80, -160); b.attack = null; b.nextAttack = time + 1100;
            } else if (time > A.at + 2400) b.attack = null;
          }
        } else if (time >= A.at && !A.fired) {
          A.fired = true;
          this.bossFire(A, rage);
          b.attack = null;
          b.nextAttack = time + Phaser.Math.Between(1700, 2600) * (rage ? 0.65 : 1);
        } else if (time < A.at) body.setVelocityX(0);
        b.setFlipX((A.dir || b.dir) < 0);
      } else {
        // 걷기 + 다음 공격 고르기
        if (body.blocked.left) b.dir = 1; else if (body.blocked.right) b.dir = -1;
        const spd = (b.def.kind === 'thief' ? 50 : 30) * (rage ? 1.5 : 1);
        if (onGround) body.setVelocityX(b.dir * spd);
        b.setFlipX(b.dir < 0);
        if (onGround && time > b.nextAttack) this.bossChoose(time, rage);
      }

      // 졸개는 계속 조금씩 나옴 (구체 재료)
      const minions = this.enemies.getChildren().filter(e => e.state !== 'dead').length;
      if (time > b.nextSpawn && minions < 3) { b.nextSpawn = time + (rage ? 3200 : 4400); this.bossSummon(1); }
    }

    bossChoose(time, rage) {
      const b = this.boss;
      const MOVES = {
        mush: ['jump', 'spores', 'charge', 'summon', 'spores'],
        gob: ['rain', 'charge', 'jump', 'summon', 'rain'],
        frog: ['bigjump', 'spores', 'jump', 'summon', 'bigjump'],
        thief: ['charge', 'rain', 'spores', 'summon', 'charge']
      }[b.def.kind] || ['jump', 'spores', 'charge', 'summon'];
      let type = MOVES[Math.floor(Math.random() * MOVES.length)];
      if (type === b.lastMove && Math.random() < 0.6) type = MOVES[(MOVES.indexOf(type) + 1) % MOVES.length];
      b.lastMove = type;
      const dir = this.player.x < b.x ? -1 : 1;
      b.dir = dir;
      const warn = type === 'jump' || type === 'bigjump' ? 350 : 650;
      b.attack = { type, dir, at: time + warn, warn: true };
      this.emote(b, '!');
      DT.Audio.sfx('warn');
      if (type === 'jump' || type === 'bigjump') {
        this.time.delayedCall(warn, () => {
          if (b.state !== 'active') return;
          const big = type === 'bigjump';
          b.body.setVelocityY(big ? -430 : -320);
          b.body.setVelocityX(DT.clamp((this.player.x - b.x) * (big ? 1.4 : 1), -190, 190));
          b.shockOnLand = true; b.airborne = true;
        });
        b.attack.fired = true; b.attack = null;
        b.nextAttack = time + warn + Phaser.Math.Between(1800, 2600) * (rage ? 0.65 : 1);
      }
      if (type === 'charge') this.tweens.add({ targets: b, x: b.x - dir * 4, yoyo: true, repeat: 3, duration: 70 });
    }

    bossFire(A, rage) {
      const b = this.boss, p = this.player;
      if (A.type === 'spores') {
        const n = rage ? 7 : 5, base = Math.atan2(p.y - b.y, p.x - b.x);
        for (let i = 0; i < n; i++) {
          const a = base + (i - (n - 1) / 2) * 0.28, sp = 105;
          this.fireShot('spore', b.x + Math.cos(a) * 20, b.y + Math.sin(a) * 20 - 6, Math.cos(a) * sp, Math.sin(a) * sp, { tint: b.def.tint, life: 3200 });
        }
        DT.Audio.sfx('fire');
      } else if (A.type === 'rain') {
        const n = rage ? 6 : 4;
        for (let i = 0; i < n; i++) {
          const tx = i === 0 ? p.x : 30 + Math.random() * 260;
          this.time.delayedCall(i * 140, () => {
            if (b.state !== 'active') return;
            this.lob('peach', b.x, b.y - 20, tx, 212, 1.0 + Math.random() * 0.3, { tint: b.def.kind === 'gob' ? 0x566c86 : 0xffffff, scale: 1.4 });
            DT.Audio.sfx('throw');
          });
        }
      } else if (A.type === 'summon') {
        this.bossSummon(rage ? 3 : 2);
      }
    }

    bossSummon(n) {
      const b = this.boss;
      for (let i = 0; i < n; i++) {
        const kind = b.def.minions[Math.floor(Math.random() * b.def.minions.length)];
        const sx = DT.clamp(b.x + Phaser.Math.Between(-40, 40), 30, 290);
        const e = this.spawnEnemy({ kind, x: sx, y: DT.ENEMY_DEFS[kind].fly ? b.y - 40 : b.y - 30 });
        e.body.setVelocity(Phaser.Math.Between(-90, 90), -230);
        this.time.delayedCall(450, () => { if (e.active && e.state === 'spawn') e.state = 'active'; });
      }
      this.emote(b, '!');
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
      DT.Audio.sfx('bosshit');
      b.body.setVelocity(((src && src.x < b.x) ? 1 : -1) * 120, -180);
      if (b.hp <= 0) this.bossDie();
      else if (b.hp === Math.floor(b.maxHp / 2)) this.banner('BOSS ANGRY!', 0xb13e53, 2.2, 1000);
    }

    bossDie() {
      const b = this.boss;
      b.state = 'dead';
      this.eshots.clear(true, true);
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
      e.knockUntil = 0; e.lastHitAt = 0; e.nextDecayAt = 0; e.nextTick = 0; e.attackUntil = 0;
      e.shell = this.add.image(e.x, e.y, 'orb_' + this.hero).setVisible(false).setDepth(7).setScale(DT.SPR);
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
      const b = e.body, onGround = b.blocked.down || b.touching.down || !!e.onSlope;
      // 봉인 게이지가 찰수록 느려짐 (구체에 갇히기 직전엔 거의 못 움직임)
      const slow = e.hits > 0 ? Math.max(0.3, 1 - 0.6 * e.hits / e.hp) : 1;
      const spd = e.def.speed * (e.angry ? T.ANGRY_MULT : 1) * (this.hurry ? 1.15 : 1) * slow;
      if (time < e.knockUntil) return;
      if (b.blocked.left) e.dir = 1; else if (b.blocked.right) e.dir = -1;
      const p = this.player;
      if (e.kind !== 'frog') e.play(e.kind + (e.hits > 0 ? '_struggle' : '_walk'), true);
      if (e.hits > 0) {
        if (time > (e.sweatAt || 0)) { e.sweatAt = time + 700; this.fxPx.emitParticleAt(e.x + Phaser.Math.Between(-5, 5), e.y - 10, 2); }
        if (this.struggleAI(e, time, onGround, spd)) { e.setFlipX(e.dir < 0); return; }
      }

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
        const vy0 = this.cameras.main.worldView.y;
        const ty = DT.clamp(p.y - 10, vy0 + 34, vy0 + 196);
        e.baseY += Math.sign(ty - e.baseY) * 0.25 * (e.angry ? 1.6 : 1);
        b.setVelocityX(e.dir * spd);
        b.setVelocityY((e.baseY + Math.sin(e.phase) * 14 - e.y) * 4);
      } else if (e.kind === 'frog') {
        if (onGround) {
          b.setVelocityX(0);
          if (time > e.nextAct) {
            e.dir = p.x < e.x ? -1 : 1;
            const weak = e.hits > 0 ? 0.55 : 1;
            b.setVelocityY((p.y < e.y - 20 ? -330 : -230) * weak);
            b.setVelocityX(e.dir * (e.angry ? 120 : 85) * weak);
            e.nextAct = time + Phaser.Math.Between(1300, 2300) / (e.angry ? 1.4 : 1);
          }
        }
        e.anims.stop();
        e.setFrame(onGround ? 0 : 1);
      } else if (e.kind === 'snail') {
        if (onGround && !this.groundAhead(e)) e.dir *= -1;
        b.setVelocityX(e.dir * spd);
      } else if (e.kind === 'dragon' || e.kind === 'monkey' || e.kind === 'puppy') {
        if (this.specialAI(e, time, onGround, spd)) return;
        if (onGround && !this.groundAhead(e)) e.dir *= -1;
        b.setVelocityX(e.dir * spd);
      }
      e.setFlipX(e.dir < 0);
    }

    /* ── 봉인되기 직전: 몬스터마다 다르게 버둥거림 ── */
    struggleAI(e, time, onGround, spd) {
      const b = e.body, p = this.player;
      switch (e.kind) {
        case 'gob': // 제자리에서 폴짝폴짝 털어내려 함
          if (onGround && time > (e.strugNext || 0)) { e.strugNext = time + 360; b.setVelocity(Phaser.Math.Between(-35, 35), -150); }
          return true;
        case 'thief': // 플레이어 반대쪽으로 도망
          e.dir = p.x < e.x ? 1 : -1; b.setVelocityX(e.dir * spd * 1.3); return true;
        case 'snail': // 껍데기 속에 쏙 숨어 꼼짝 안 함
          b.setVelocityX(0); e.anims.stop(); e.setFrame(2); return true;
        case 'monkey': // 부르르 떨며 제자리
          b.setVelocityX(Math.floor(time / 90) % 2 ? 22 : -22); return true;
        case 'puppy': // 허둥지둥 빙글빙글
          if (time > (e.strugNext || 0)) { e.strugNext = time + 380; e.dir *= -1; }
          b.setVelocityX(e.dir * spd * 1.4); return true;
        case 'bird': // 날갯짓이 엉망이 되어 점점 아래로
          e.baseY = Math.min(e.baseY + 0.35, this.cameras.main.worldView.y + 200); e.phase += 0.08; return false;
        case 'dragon': // 불 대신 연기만 콜록
          if (time > (e.strugNext || 0)) { e.strugNext = time + 600; this.fxDust.explode(3, e.x + e.dir * 10, e.y - 2); }
          return false;
        default: return false; // 혼동버섯 · 개구리: 느려지기만 (개구리는 점프가 약해짐)
      }
    }

    /* ── 몬스터 탄 ── */
    fireShot(key, x, y, vx, vy, opt) {
      opt = opt || {};
      const sh = this.eshots.create(x, y, key, 0);
      sh.isShot = true; sh.bornAt = this.time.now; sh.life = opt.life || 2600;
      sh.solidOnly = !!opt.solidOnly; sh.unbreakable = !!opt.unbreakable;
      sh.setDepth(14).setScale(opt.scale || 1);
      if (opt.tint) sh.setTint(opt.tint);
      sh.body.setAllowGravity(!!opt.gravity);
      sh.body.setSize(sh.width * 0.8, sh.height * 0.8);
      sh.body.setVelocity(vx, vy);
      if (opt.anim) sh.play(opt.anim);
      if (opt.spin) sh.body.setAngularVelocity(opt.spin);
      sh.setFlipX(vx < 0);
      return sh;
    }
    popShot(sh) {
      if (!sh || !sh.active) return;
      this.fxPx.explode(5, sh.x, sh.y);
      sh.destroy();
    }
    // 포물선으로 (tx,ty)에 떨어지도록 던지기
    lob(key, x, y, tx, ty, flight, opt) {
      const g = T.GRAVITY, t = flight || 0.9;
      const vx = DT.clamp((tx - x) / t, -170, 170);
      const vy = Math.max(-400, (ty - y - 0.5 * g * t * t) / t);
      return this.fireShot(key, x, y, vx, vy, Object.assign({ gravity: true, spin: vx < 0 ? -500 : 500 }, opt || {}));
    }
    updateShots(time) {
      this.eshots.getChildren().slice().forEach(sh => {
        if (!sh.active) return;
        if (time - sh.bornAt > sh.life || sh.x < -20 || sh.x > DT.W + 20 || sh.y > this.mapH + 20) sh.destroy();
        else if (sh.isShock && Math.abs(sh.body.velocity.x) < 5) this.popShot(sh);
      });
      this.poops.getChildren().slice().forEach(pp => {
        if (!pp.active) return;
        const age = time - pp.bornAt;
        if (age > 7500) pp.setVisible(Math.floor(time / 100) % 2 === 0);
        if (age > 9000 || (this.climb && pp.y > this.hazardY)) pp.destroy();
      });
    }

    // 불뿜이 · 던짐원숭이 · 똥강아지 공격
    specialAI(e, time, onGround, spd) {
      const p = this.player, b = e.body;
      const dx = p.x - e.x, dy = p.y - e.y;
      if (time < e.attackUntil) { b.setVelocityX(0); return true; }
      if (e.hits > 0) return false;
      if (e.kind === 'dragon') {
        if (onGround && time > e.nextAct && Math.abs(dy) < 26 && Math.abs(dx) < 220) {
          e.dir = dx < 0 ? -1 : 1; e.setFlipX(e.dir < 0);
          e.attackUntil = time + 700; e.nextAct = time + Phaser.Math.Between(2600, 4200) / (e.angry ? 1.4 : 1);
          this.emote(e, '!');
          e.setTintFill(0xffcd75); this.time.delayedCall(140, () => this.applyTint(e)); this.time.delayedCall(280, () => { if (e.active) e.setTintFill(0xffcd75); }); this.time.delayedCall(400, () => this.applyTint(e));
          this.time.delayedCall(420, () => {
            if (!e.active || e.state !== 'active') return;
            this.fireShot('fireball', e.x + e.dir * 12, e.y + 1, e.dir * 135, 0, { anim: 'fireball_fly', solidOnly: true, scale: DT.SPR });
            DT.Audio.sfx('fire');
          });
          return true;
        }
      } else if (e.kind === 'monkey') {
        if (onGround && time > e.nextAct && Math.abs(dx) < 230 && Math.abs(dy) < 120) {
          e.dir = dx < 0 ? -1 : 1; e.setFlipX(e.dir < 0);
          e.attackUntil = time + 500; e.nextAct = time + Phaser.Math.Between(2400, 3800) / (e.angry ? 1.4 : 1);
          e.anims.stop(); e.setFrame(1);
          this.time.delayedCall(250, () => {
            if (!e.active || e.state !== 'active') return;
            this.lob('peach', e.x, e.y - 8, p.x + Phaser.Math.Between(-12, 12), p.y, 0.85 + Math.random() * 0.2, { scale: DT.SPR });
            DT.Audio.sfx('throw');
            e.play('monkey_walk');
          });
          return true;
        }
      } else if (e.kind === 'puppy') {
        if (onGround && time > e.nextAct && this.poops.countActive(true) < 7) {
          e.nextAct = time + Phaser.Math.Between(2600, 4000);
          e.attackUntil = time + 300;
          const pp = this.poops.create(e.x - e.dir * 9, e.y + 4, 'poop');
          pp.isPoop = true; pp.bornAt = time; pp.setDepth(4).setScale(DT.SPR);
          pp.body.setSize(8, 5).setOffset(0, 2);
          DT.Audio.sfx('poot');
          this.emote(e, '♥');
          return true;
        }
      }
      return false;
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
      this.ui.add(t);
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
      const b = e.body, pushed = e.pushedAt === time;
      if (e.onSlope && !pushed) b.setVelocityX(DT.clamp(b.velocity.x + e.onSlope.down * 260 * this.game.loop.delta / 1000, -150, 150));
      else if (!pushed && time > (e.inchUntil || 0)) b.setVelocityX(b.velocity.x * 0.85);
      const left = this.S.sealTime + (e.kind === 'snail' ? 1500 : 0) - (time - e.sealedAt);
      const warn = left < T.SEAL_WARN;
      // 빠져나가려는 몸부림 (풀리기 직전일수록 자주)
      if (!pushed && time > (e.strugNext || 0)) {
        e.strugNext = time + (warn ? 450 : 1100) + Math.random() * 300;
        const onG = b.blocked.down || b.touching.down;
        if (['gob', 'frog', 'monkey', 'puppy'].indexOf(e.kind) >= 0 && onG) { b.setVelocityY(e.kind === 'frog' ? -170 : -110); DT.Audio.sfx('tick'); }
        else if (e.kind === 'thief' || e.kind === 'mush') { b.setVelocityX((Math.random() < 0.5 ? -1 : 1) * 28); e.inchUntil = time + 220; }
        else if (e.kind === 'bird' && onG) b.setVelocityY(-80);
        else if (e.kind === 'dragon') this.fxDust.explode(4, e.x, e.y - 10);
      }
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
      w.body.setSize(8, 14).setOffset(10, 6);   // 몸통은 좁게 → 한 칸 틈으로도 물이 흘러내림
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
      const onG = b.blocked.down || b.touching.down || !!w.onSlope;
      if (!onG && b.velocity.y > 40) {
        // 떨어지는 중: 가늘고 길게 (폭포)
        w.setScale(DT.SPR * 0.55, DT.SPR * 1.35);
        if (Math.random() < 0.6) this.fxPx.emitParticleAt(w.x + Phaser.Math.Between(-3, 3), w.y - 6, 1);
        w.wasFalling = true;
      } else if (onG && w.wasFalling) {
        // 착지: 첨벙! 같은 방향으로 계속 흐름
        w.wasFalling = false;
        w.setScale(DT.SPR);
        this.fxPx.explode(10, w.x, w.y + 6);
        DT.Audio.sfx('shoot', 'line');
      }
      // 넓은 물결 범위로 적 휩쓸기 (몸통이 좁아도 그림만큼 판정)
      this.enemies.getChildren().forEach(e => {
        if (e.active && (e.state === 'active' || e.state === 'sealed' || e.state === 'spawn') && Math.abs(e.x - w.x) < 18 && Math.abs(e.y - w.y) < 16) this.chainKill(w, e);
      });
      if (w.onSlope && w.dir !== w.onSlope.down) { w.dir = w.onSlope.down; w.rollDir = w.dir; w.setFlipX(w.dir < 0); }   // 경사로에서는 아래쪽으로 흐름
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
      if (age > w.life || w.y > this.mapH + 20) this.endWave(w);
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
        const fx = DT.clamp(e.x, 28, 292), fy = DT.clamp(e.y, 28, this.mapH - 40);
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
      const t1 = DT.text(this, 160, 54, v.hanzi, { font: 'zh', size: 18, color: '#a7f070', strokeThickness: 3, depth: 56 });
      const t2 = DT.text(this, 160, 74, v.pinyin + '  ·  ' + v.meaning, { font: 'ko', size: 9, color: '#f4f4f4', depth: 56 });
      const t3 = DT.text(this, 160, 86, reward, { font: 'ko', size: 8, color: '#ffcd75', depth: 56 });
      const all = [box, t1, t2, t3];
      this.ui.add(all);
      all.forEach(o => o.setAlpha(0));
      this.tweens.add({ targets: all, alpha: 1, duration: 150 });
      this.tweens.add({ targets: all, alpha: 0, delay: 2000, duration: 300, onComplete: () => all.forEach(o => o.destroy()) });
      this.fxStar.explode(12, this.player.x, this.player.y);
      DT.FX.play(this, 'collect', this.player.x, this.player.y + 10, { depth: 34 });
    }

    /* ───────────── HUD ───────────── */
    buildHud() {
      const n0 = this.children.list.length;
      this.buildHudInner();
      this.ui.add(this.children.list.slice(n0).filter(o => o !== this.ui));
    }

    buildHudInner() {
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
      const ready = DT.ptext(this, 160, 134, this.climb ? 'CLIMB TO THE FLAG!' : 'READY?', { ox: 0.5, oy: 0.5, tint: 0xf4f4f4, scale: 1, depth: 60 });
      this.ui.add([title, name, ready]);
      this.time.delayedCall(1500, () => {
        title.destroy(); name.destroy(); ready.destroy();
        this.banner('GO!', 0xa7f070, 3, 400);
        DT.Audio.sfx('go');
        this.enemies.getChildren().forEach(e => { if (e.state === 'spawn') { e.state = 'active'; e.setAlpha(1); } });
        this.started = true; this.fireLocked = false;
        if (this.boss) this.boss.state = 'active';
        if (this.climb) this.hintText('아래에서 ' + this.hazardName + '이(가) 올라와요! 깃발까지 올라가요!');
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
        this.ui.add([this.pauseBox, this.pauseText]);
        DT.Audio.music(false);
      } else {
        this.physics.world.resume(); this.tweens.resumeAll(); this.anims.resumeAll(); this.time.paused = false;
        if (this.pauseBox) { this.pauseBox.destroy(); this.pauseText.destroy(); }
        DT.Audio.music(true, this.musicSpec);
      }
    }

    update(time) {
      DT.Input.update();
      if (DT.Input.justDown('pause') && this.started && !this.cleared && !this.dead) this.togglePause();
      if (this.isPaused) return;
      time = this.time.now;

      this.applySlopes();
      this.updatePlayer(time);
      this.enemies.getChildren().slice().forEach(e => this.updateEnemy(e, time));
      this.seeds.getChildren().slice().forEach(s => {
        if (!s.active) return;
        if (s.mode === 'roll') s.body.setVelocityX(s.dir * s.speed);
        if (s.mode && s.mode !== 'arc' && Math.abs(s.x - s.startX) > s.range) { this.fxLeaf.explode(2, s.x, s.y); s.destroy(); return; }
        if (s.mode === 'line') s.setAlpha(1 - Math.max(0, Math.abs(s.x - s.startX) / s.range - 0.7) * 2);
        if (time - s.bornAt > T.SEED_LIFE * (s.mode === 'roll' ? 1.6 : 1) || s.x < -10 || s.x > DT.W + 10 || s.y > this.mapH + 10) s.destroy();
      });
      this.waves.getChildren().slice().forEach(w => this.updateWave(w, time));
      this.updateFrags(time);
      this.updateBoss(time);
      this.updateShots(time);
      if (this.climb) this.updateClimb(time, this.game.loop.delta);
      else this.syncScreenLayer();

      if (this.started && !this.cleared && !this.dead) {
        if (!this.hurry && !this.boss && !this.climb && time - this.stageStartAt > T.HURRY_TIME) {
          this.hurry = true;
          this.banner('HURRY UP!', 0xb13e53, 2.5, 1200);
          DT.Audio.setTempo(1.15);
          DT.Audio.sfx('hurry');
          this.enemies.getChildren().forEach(e => { if (e.state === 'active') { e.angry = true; this.applyTint(e); } });
        }
        if (this.climb) { /* 골인으로만 클리어 */ }
        else if (this.boss ? this.boss.state === 'dead' : this.aliveCount() === 0) this.stageClear();
      }
      if (this.dead && this.player.y > this.mapH + 40) this.player.body.setVelocity(0, 0);
      this.updateHud(time);
    }
  }

  DT.GameScene = GameScene;
})();
