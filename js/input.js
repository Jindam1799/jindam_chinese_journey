/* 입력: 키보드 + 모바일 터치 버튼을 하나의 상태로 합칩니다.
   게임 동작은 left / right / jump / fire 네 가지뿐입니다. (퀴즈 메뉴용 up/down/confirm 보조) */
(function () {
  'use strict';
  const DT = (window.DT = window.DT || {});

  const ACTIONS = ['left', 'right', 'up', 'down', 'jump', 'fire', 'confirm', 'pause'];
  const KEYMAP = {
    ArrowLeft: 'left', KeyA: 'left',
    ArrowRight: 'right', KeyD: 'right',
    ArrowUp: 'up', KeyW: 'up',
    ArrowDown: 'down', KeyS: 'down',
    Space: 'jump',
    KeyZ: 'fire', KeyJ: 'fire',
    Enter: 'confirm', NumpadEnter: 'confirm',
    KeyP: 'pause', Escape: 'pause'
  };

  const keyHeld = {}, touchHeld = {}, hit = {};
  let pressed = {};
  ACTIONS.forEach(a => { keyHeld[a] = false; touchHeld[a] = false; hit[a] = false; });

  function down(table, act) {
    if (!table[act] && !keyHeld[act] && !touchHeld[act]) hit[act] = true;
    table[act] = true;
  }

  window.addEventListener('keydown', (e) => {
    if (e.code === 'KeyM') { if (!e.repeat && DT.Audio) DT.Audio.toggleMute(); return; }
    const act = KEYMAP[e.code];
    if (!act) return;
    e.preventDefault();
    if (e.repeat) return;
    down(keyHeld, act);
  }, { passive: false });

  window.addEventListener('keyup', (e) => {
    const act = KEYMAP[e.code];
    if (act) keyHeld[act] = false;
  });

  window.addEventListener('blur', () => {
    ACTIONS.forEach(a => { keyHeld[a] = false; touchHeld[a] = false; });
  });

  DT.Input = {
    // 씬 update() 맨 앞에서 한 번 호출 → 이번 프레임에 새로 눌린 버튼 계산
    update() {
      pressed = {};
      ACTIONS.forEach(a => { pressed[a] = hit[a]; hit[a] = false; });
    },
    isDown(a) { return keyHeld[a] || touchHeld[a]; },
    justDown(a) { return !!pressed[a]; },
    anyStart() { return pressed.fire || pressed.confirm || pressed.jump; },
    touchDown(a) { down(touchHeld, a); },
    touchUp(a) { touchHeld[a] = false; }
  };

  // ── 모바일 터치 버튼 연결 ──
  DT.setupTouch = function () {
    const root = document.getElementById('touch');
    if (!root) return;
    const isTouch = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
    const show = () => document.body.classList.add('touch-on');
    if (isTouch) show();
    window.addEventListener('touchstart', show, { once: true, passive: true });

    root.querySelectorAll('[data-act]').forEach((btn) => {
      const act = btn.getAttribute('data-act');
      const on = (e) => {
        e.preventDefault();
        if (btn.setPointerCapture && e.pointerId !== undefined) { try { btn.setPointerCapture(e.pointerId); } catch (err) { /* 무시 */ } }
        btn.classList.add('on');
        if (DT.Audio) DT.Audio.unlock();
        DT.Input.touchDown(act);
      };
      const off = (e) => {
        if (e) e.preventDefault();
        btn.classList.remove('on');
        DT.Input.touchUp(act);
      };
      btn.addEventListener('pointerdown', on);
      btn.addEventListener('pointerup', off);
      btn.addEventListener('pointercancel', off);
      btn.addEventListener('lostpointercapture', () => off());
      btn.addEventListener('contextmenu', (e) => e.preventDefault());
    });

    const mute = document.getElementById('mute-btn');
    if (mute) {
      mute.addEventListener('click', () => { if (DT.Audio) { DT.Audio.unlock(); DT.Audio.toggleMute(); } });
    }
  };
})();
