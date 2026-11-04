/* pixelfx 스프라이트 시트 → Phaser 애니메이션
   assets/fx/manifest.json (tools/pixelfx/export.mjs 가 생성)을 읽어 모든 이펙트를 자동으로 불러옵니다.
   사용: DT.FX.play(scene, 'poof', x, y, { flip, depth, scale })
   불러오지 못한 이펙트는 조용히 건너뛰므로(null 반환) 게임은 그대로 진행됩니다. */
(function () {
  'use strict';
  const DT = (window.DT = window.DT || {});
  const BASE = 'assets/fx/';

  DT.FX = {
    manifest: { effects: {} },

    // BootScene.preload 에서 호출
    preload(scene) {
      scene.load.json('fx_manifest', BASE + 'manifest.json');
      scene.load.once('filecomplete-json-fx_manifest', (key, type, data) => {
        if (!data || !data.effects) return;
        this.manifest = data;
        Object.keys(data.effects).forEach(k => {
          const e = data.effects[k];
          scene.load.atlas('fx_' + k, BASE + e.png, BASE + e.json);
        });
      });
      scene.load.on('loaderror', (file) => {
        if (String(file.key).indexOf('fx_') === 0) console.warn('[pixelfx] 불러오지 못함:', file.src);
      });
    },

    // BootScene.create 에서 호출: 시트마다 애니메이션 생성
    build(scene) {
      const fx = this.manifest.effects || {};
      Object.keys(fx).forEach(k => {
        const e = fx[k], tex = 'fx_' + k;
        if (!scene.textures.exists(tex) || scene.anims.exists('fxa_' + k)) return;
        const names = scene.textures.get(tex).getFrameNames()
          .filter(n => n !== '__BASE')
          .sort((a, b) => parseInt(a.split(' ').pop(), 10) - parseInt(b.split(' ').pop(), 10));
        if (!names.length) return;
        scene.anims.create({
          key: 'fxa_' + k,
          frames: names.map(n => ({ key: tex, frame: n })),
          frameRate: e.fps || 15,
          repeat: e.loop ? -1 : 0
        });
      });
    },

    has(key) { return !!(this.manifest.effects || {})[key]; },

    play(scene, key, x, y, opt) {
      opt = opt || {};
      const e = (this.manifest.effects || {})[key];
      if (!e || !scene.anims.exists('fxa_' + key)) return null;
      const s = scene.add.sprite(Math.round(x), Math.round(y), 'fx_' + key);
      s.setOrigin(e.pivot[0] / e.frameSize[0], e.pivot[1] / e.frameSize[1]);
      if (opt.flip) s.setFlipX(true);
      s.setScale((opt.scale || 1) * 0.8);
      if (opt.alpha !== undefined) s.setAlpha(opt.alpha);
      s.setDepth(opt.depth === undefined ? 32 : opt.depth);
      s.play('fxa_' + key);
      if (!e.loop) s.once('animationcomplete', () => s.destroy());
      return s;
    }
  };
})();
