/* 시작점: 데이터·글꼴 로딩 → Phaser 게임 생성 */
(function () {
  'use strict';
  const DT = window.DT;

  function withTimeout(p, ms) {
    return Promise.race([p, new Promise(res => setTimeout(() => res(null), ms))]);
  }

  async function loadData() {
    try {
      const res = await withTimeout(fetch('data/game-data.json', { cache: 'no-cache' }), 6000);
      if (!res || !res.ok) throw new Error('HTTP ' + (res ? res.status : 'timeout'));
      const json = await res.json();
      if (!DT.validateData(json)) throw new Error('데이터 형식 오류');
      return json;
    } catch (e) {
      // file:// 로 열었거나 JSON이 깨졌을 때 → 내장 기본 데이터 사용
      console.warn('[덩어리 숲] data/game-data.json 대신 내장 데이터를 사용합니다:', e.message);
      return JSON.parse(JSON.stringify(DT.DEFAULT_DATA));
    }
  }

  async function loadFonts() {
    if (!document.fonts || !document.fonts.load) return;
    await withTimeout(Promise.all([
      document.fonts.load('16px "Do Hyeon"', '덩어리 숲 조각'),
      document.fonts.load('16px "ZCOOL KuaiLe"', '喝水吃饭看书睡觉开车听歌')
    ]).catch(() => null), 3000);
  }

  DT.boot = async function () {
    DT.setLoading(35, '데이터 불러오는 중…');
    DT.DATA = DT.prepareData(await loadData());
    DT.setLoading(55, '글꼴 준비 중…');
    await loadFonts();
    DT.setLoading(75, '게임 엔진 시작…');
    DT.setupTouch();
    // 세로로 돌리면 자동 일시정지
    const portrait = window.matchMedia('(orientation: portrait)');
    const onOrient = () => {
      if (!document.body.classList.contains('touch-on') || !portrait.matches || !DT.game) return;
      const g = DT.game.scene.getScene('Game');
      if (g && g.sys.isActive() && g.started && !g.isPaused && !g.cleared && !g.dead) g.togglePause();
    };
    if (portrait.addEventListener) portrait.addEventListener('change', onOrient); else if (portrait.addListener) portrait.addListener(onOrient);
    window.addEventListener('resize', () => { if (DT.game && DT.game.scale) DT.game.scale.refresh(); });

    const Z = DT.Z;
    DT.game = new Phaser.Game({
      type: Phaser.AUTO,
      parent: 'game',
      width: DT.W * Z,
      height: DT.H * Z,
      backgroundColor: '#1a1c2c',
      pixelArt: true,
      roundPixels: true,
      audio: { noAudio: true },
      input: { activePointers: 3 },
      scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
      physics: { default: 'arcade', arcade: { gravity: { y: DT.TUNING.GRAVITY }, debug: false } },
      scene: [DT.BootScene, DT.TitleScene, DT.SelectScene, DT.IntroScene, DT.GameScene, DT.QuizScene, DT.UpgradeScene, DT.GameOverScene, DT.EndingScene, DT.HallScene, DT.NameEntryScene, DT.StageStoryScene, DT.DexScene, DT.SettingsScene, DT.OverlayScene],
      callbacks: {
        postBoot: (game) => {
          game.canvas.addEventListener('webglcontextlost', () => DT.showError('그래픽 장치가 초기화되었습니다.', '페이지를 새로고침해 주세요.'));
        }
      }
    });
  };
})();
