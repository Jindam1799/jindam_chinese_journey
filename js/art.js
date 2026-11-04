/* 도트 텍스처·픽셀 폰트·애니메이션을 런타임에 생성 (이미지 파일 없음) */
(function () {
  'use strict';
  const DT = (window.DT = window.DT || {});
  const G = () => DT.GRIDS;

  function canvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
  function drawGrid(ctx, rows, pal, ox, oy) {
    for (let y = 0; y < rows.length; y++) {
      const r = rows[y];
      for (let x = 0; x < r.length; x++) {
        const col = pal[r[x]];
        if (!col) continue;
        ctx.fillStyle = col; ctx.fillRect(ox + x, oy + y, 1, 1);
      }
    }
  }
  function px(ctx, x, y, col) { ctx.fillStyle = col; ctx.fillRect(Math.round(x), Math.round(y), 1, 1); }
  function rect(ctx, x, y, w, h, col) { ctx.fillStyle = col; ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); }
  function disc(ctx, cx, cy, r, col) {
    ctx.fillStyle = col;
    for (let y = -r; y <= r; y++) {
      const w = Math.floor(Math.sqrt(r * r - y * y) + 0.3);
      ctx.fillRect(Math.round(cx - w), Math.round(cy + y), w * 2 + 1, 1);
    }
  }
  function ellipse(ctx, cx, cy, rx, ry, col) {
    ctx.fillStyle = col;
    for (let y = -ry; y <= ry; y++) {
      const w = Math.floor(rx * Math.sqrt(1 - (y * y) / (ry * ry)) + 0.3);
      ctx.fillRect(Math.round(cx - w), Math.round(cy + y), w * 2 + 1, 1);
    }
  }

  function addFrames(scene, key, w, h, n, draw) {
    if (scene.textures.exists(key)) return;
    const c = canvas(w * n, h);
    const ctx = c.getContext('2d');
    for (let i = 0; i < n; i++) draw(ctx, i * w, i);
    const tex = scene.textures.addCanvas(key, c);
    for (let i = 0; i < n; i++) tex.add(i, 0, i * w, 0, w, h);
  }
  function addSheet(scene, key, frames, pal) {
    const w = frames[0][0].length, h = frames[0].length;
    addFrames(scene, key, w, h, frames.length, (ctx, ox, i) => drawGrid(ctx, frames[i], pal, ox, 0));
  }
  function addSingle(scene, key, w, h, draw) {
    if (scene.textures.exists(key)) return;
    const c = canvas(w, h);
    draw(c.getContext('2d'));
    scene.textures.addCanvas(key, c);
  }

  /* ── 주인공: 툭이 프레임을 색 바꾸기 + 머리 장식 교체로 생성 ── */
  function heroFrames(base, colorMap, topper) {
    return base.map(rows => {
      let r = rows.map(line => line.replace(/[GgD]/g, ch => colorMap[ch] || ch));
      if (topper) {
        const t = rows.findIndex(line => line.indexOf('K') >= 0);
        const out = r.slice();
        for (let i = 0; i < t; i++) out[i] = '................';
        topper.forEach((line, i) => { const y = t - topper.length + i; if (y >= 0) out[y] = line; });
        r = out;
      }
      return r;
    });
  }

  /* ── 봉인 구체 20x20 ── */
  function drawOrb(ctx) {
    for (let y = 0; y < 20; y++) {
      for (let x = 0; x < 20; x++) {
        const dx = x + 0.5 - 10, dy = y + 0.5 - 10;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d > 9.6) continue;
        if (d > 8.5) px(ctx, x, y, '#257179');
        else if (d > 7.4) px(ctx, x, y, 'rgba(56,183,100,0.85)');
        else px(ctx, x, y, 'rgba(167,240,112,0.3)');
      }
    }
    [[5, 4], [4, 5], [6, 4], [4, 6], [3, 7], [7, 3], [5, 5]].forEach(p => px(ctx, p[0], p[1], 'rgba(244,244,244,0.95)'));
    [[14, 15], [15, 14], [13, 16]].forEach(p => px(ctx, p[0], p[1], 'rgba(244,244,244,0.5)'));
    [[10, 0], [11, 0], [12, 1], [9, 1]].forEach(p => px(ctx, p[0], p[1], '#a7f070'));
    px(ctx, 10, 1, '#38b764'); px(ctx, 11, 1, '#38b764');
  }

  /* ───────────── 맵 테마 ───────────── */
  const THEMES = {
    forest: {
      sky: [[0, '#4fb8f0'], [0.5, '#9fdcff'], [0.78, '#d8f4ff'], [1, '#effbe4']],
      brick: ['#e8a75d', '#ffd79a', '#b86f3a', '#7a4424'], top: ['#c8f58a', '#5cc96a', '#2f9a58'],
      plat: ['#a0602e', '#6b3a1e', '#c98a52'], ambient: 'petal'
    },
    // 구이린 산수: 석회암 + 대나무
    guilin: {
      sky: [[0, '#8fd3f4'], [0.45, '#cdeefa'], [0.7, '#fbe9d4'], [1, '#d8f0e4']],
      brick: ['#9fb8a8', '#d4e4d6', '#6e8c7c', '#44604f'], top: ['#c8f58a', '#5cc96a', '#2f9a58'],
      plat: ['#7bbf5a', '#4f8f3a', '#b8e68a'], bamboo: true, ambient: 'petal'
    },
    // 장자제: 붉은 사암 기둥 + 이끼
    zhangjiajie: {
      sky: [[0, '#7cc6f2'], [0.5, '#cfeaf8'], [1, '#f4f2ea']],
      brick: ['#c8a07a', '#ecd2b0', '#9a7452', '#5e4430'], top: ['#b8e68a', '#5aa85a', '#2f7a48'],
      plat: ['#a0703e', '#6e4a28', '#cc9a5e'], ambient: 'glow'
    },
    // 주자이거우: 석회화 단 + 단풍
    jiuzhaigou: {
      sky: [[0, '#6ec2f5'], [0.5, '#c4ecfb'], [1, '#e6fbf6']],
      brick: ['#e8dcc0', '#fff6e0', '#bfae88', '#7c6c4a'], top: ['#ffd27a', '#f2a65a', '#d0603a'],
      plat: ['#8a5a34', '#5e3a1e', '#b8743a'], ambient: 'maple'
    },
    // 황산: 화강암 + 소나무
    huangshan: {
      sky: [[0, '#5a7fd0'], [0.35, '#f2a8a0'], [0.6, '#ffd8a6'], [1, '#fff4e0']],
      brick: ['#c9ccd6', '#eef0f6', '#8f94a6', '#555a6e'], top: ['#9fd88a', '#3f8f5a', '#2a5e44'],
      plat: ['#8f94a6', '#5e6478', '#c9ccd6'], ambient: 'cloudpuff'
    }
  };
  DT.THEMES = THEMES;

  function drawBrick(ctx, ox, rng, grassTop, T) {
    const [base, hi, sh, mortar] = T.brick;
    rect(ctx, ox, 0, 16, 16, mortar);
    [[0, 0, 8], [8, 0, 8], [-4, 8, 8], [4, 8, 8], [12, 8, 8]].forEach(b => {
      const x0 = Math.max(0, b[0]), x1 = Math.min(16, b[0] + b[2]) - 1;
      if (x1 <= x0) return;
      const y0 = b[1], y1 = b[1] + 7;
      rect(ctx, ox + x0, y0, x1 - x0, y1 - y0, base);
      rect(ctx, ox + x0, y0, x1 - x0, 1, hi); rect(ctx, ox + x0, y0, 1, y1 - y0, hi);
      rect(ctx, ox + x0, y1 - 1, x1 - x0, 1, sh);
    });
    for (let i = 0; i < 3; i++) px(ctx, ox + Math.floor(rng() * 16), Math.floor(rng() * 16), hi);
    if (grassTop) {
      const [t0, t1, t2] = T.top;
      rect(ctx, ox, 0, 16, 3, t1); rect(ctx, ox, 0, 16, 1, t0);
      for (let x = 0; x < 16; x++) {
        if (rng() < 0.5) px(ctx, ox + x, 3, t1);
        if (rng() < 0.25) px(ctx, ox + x, 4, t2);
        if (rng() < 0.3) px(ctx, ox + x, 1, t0);
      }
    }
  }
  function drawPlatform(ctx, ox, rng, cap, T) {
    const [body, spk, hi] = T.plat, [t0, t1, t2] = T.top;
    rect(ctx, ox, 3, 16, 4, body);
    for (let i = 0; i < 6; i++) px(ctx, ox + Math.floor(rng() * 16), 3 + Math.floor(rng() * 4), spk);
    for (let i = 0; i < 3; i++) px(ctx, ox + Math.floor(rng() * 16), 4 + Math.floor(rng() * 3), hi);
    rect(ctx, ox, 7, 16, 1, T.fluffy ? '#9fc4e4' : '#1a1c2c');
    rect(ctx, ox, 0, 16, 3, t1); rect(ctx, ox, 0, 16, 1, t0);
    for (let x = 0; x < 16; x++) {
      if (rng() < 0.55) px(ctx, ox + x, 3, t1);
      if (rng() < 0.3) px(ctx, ox + x, 4, t2);
    }
    if (T.bamboo) {
      rect(ctx, ox, 3, 16, 4, '#7bbf5a');
      for (let x = 3; x < 16; x += 5) rect(ctx, ox + x, 3, 1, 4, '#3f7f2a');
      rect(ctx, ox, 4, 16, 1, '#b8e68a');
    }
    if (T.sprinkles) {
      const cols = ['#f4566a', '#41a6f6', '#ffcd75', '#7bd389', '#b55088'];
      for (let i = 0; i < 4; i++) px(ctx, ox + 1 + Math.floor(rng() * 14), 1 + Math.floor(rng() * 2), cols[Math.floor(rng() * cols.length)]);
    }
    if (T.fluffy) {
      for (let x = 0; x < 16; x += 4) px(ctx, ox + x + 1, 7, '#dbeeff');
    }
    if (cap === 'l' || cap === 'lr') { ctx.clearRect(ox, 0, 1, 1); ctx.clearRect(ox, 7, 1, 1); rect(ctx, ox, 1, 1, 6, T.fluffy ? '#9fc4e4' : '#1a1c2c'); }
    if (cap === 'r' || cap === 'lr') { ctx.clearRect(ox + 15, 0, 1, 1); ctx.clearRect(ox + 15, 7, 1, 1); rect(ctx, ox + 15, 1, 1, 6, T.fluffy ? '#9fc4e4' : '#1a1c2c'); }
  }

  const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
  function hex(c) { return [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)]; }
  function gradient(ctx, stops, W, H) {
    const st = stops.map(s => [s[0], hex(s[1])]);
    const img = ctx.createImageData(W, H), levels = 8;
    for (let y = 0; y < H; y++) {
      const t = y / (H - 1);
      let k = 0; while (k < st.length - 2 && t > st[k + 1][0]) k++;
      const a = st[k], b = st[k + 1];
      const lt = Math.max(0, Math.min(1, (t - a[0]) / Math.max(0.0001, b[0] - a[0])));
      const q = lt * levels, qi = Math.floor(q), frac = q - qi;
      for (let x = 0; x < W; x++) {
        const th = (BAYER[(y % 4) * 4 + (x % 4)] + 0.5) / 16;
        const step = Math.min(1, (qi + (frac > th ? 1 : 0)) / levels);
        const i = (y * W + x) * 4;
        for (let c = 0; c < 3; c++) img.data[i + c] = Math.round(a[1][c] + (b[1][c] - a[1][c]) * step);
        img.data[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
  }
  function cloud(ctx, x, y, s, shade) {
    disc(ctx, x - 10 * s, y + 2 * s, 7 * s, shade); disc(ctx, x + 10 * s, y + 2 * s, 7 * s, shade);
    disc(ctx, x, y + 1 * s, 10 * s, shade);
    disc(ctx, x - 10 * s, y, 7 * s, '#ffffff'); disc(ctx, x + 10 * s, y, 7 * s, '#ffffff'); disc(ctx, x, y - 3 * s, 10 * s, '#ffffff');
    rect(ctx, x - 16 * s, y, 32 * s, 6 * s, '#ffffff');
  }
  function sun(ctx, x, y) {
    disc(ctx, x, y, 22, 'rgba(255,240,150,0.25)');
    disc(ctx, x, y, 17, 'rgba(255,230,120,0.35)');
    disc(ctx, x, y, 13, '#ffd94a'); disc(ctx, x - 3, y - 3, 8, '#fff1a0');
    px(ctx, x - 5, y + 1, '#1a1c2c'); px(ctx, x + 4, y + 1, '#1a1c2c');
    rect(ctx, x - 2, y + 5, 5, 1, '#e8873a'); px(ctx, x - 3, y + 4, '#e8873a'); px(ctx, x + 3, y + 4, '#e8873a');
    px(ctx, x - 8, y + 4, '#ff9ea8'); px(ctx, x + 7, y + 4, '#ff9ea8');
  }
  function hills(ctx, rng, base, col, rmin, rmax, step, W, H) {
    for (let x = -10; x < W + 20; x += step) {
      const r = Math.floor(rmin + rng() * (rmax - rmin));
      const cy = base - r * 0.5 + rng() * 6;
      disc(ctx, x, cy, r, col); rect(ctx, x - r, cy, r * 2 + 1, H - cy, col);
    }
  }

  function karst(ctx, x, base, w, h, col, hi) {
    // 둥근 탑 모양 석회암 봉우리
    for (let y = 0; y < h; y++) {
      const t = y / h;
      const ww = w * (0.35 + 0.65 * Math.pow(Math.sin(Math.min(1, t * 1.6) * Math.PI / 2), 0.7));
      rect(ctx, x - ww / 2, base - h + y, ww, 1, col);
      if (hi && t < 0.9) rect(ctx, x - ww / 2, base - h + y, Math.max(1, ww * 0.25), 1, hi);
    }
  }
  function mistBand(ctx, y0, y1, col, rng, W) {
    for (let y = y0; y < y1; y++) for (let x = (y % 2); x < W; x += 2) {
      const k = 1 - Math.abs((y - (y0 + y1) / 2) / ((y1 - y0) / 2));
      if (rng() < k * 0.85) px(ctx, x, y, col);
    }
  }
  function pine(ctx, x, y, s, flip) {
    const d = flip ? -1 : 1;
    for (let i = 0; i < 30 * s; i++) rect(ctx, x + Math.sin(i / 9) * 3 * d, y + i, 3, 1, '#5e3a1e');
    [[0, -2, 16], [10, 4, 12], [-8, 8, 10], [18, 10, 9]].forEach(b => {
      ellipse(ctx, x + b[0] * d * s, y + b[1] * s, b[2] * s, 3 * s, '#2a5e44');
      ellipse(ctx, x + b[0] * d * s - 1, y + b[1] * s - 1, b[2] * s * 0.7, 2 * s, '#3f8f5a');
    });
  }

  function drawThemeBg(ctx, name) {
    const W = DT.W, H = DT.H, rng = DT.rng(name.length * 31 + 7), T = THEMES[name];
    gradient(ctx, T.sky, W, H);
    if (name === 'forest') {
      sun(ctx, 262, 46);
      cloud(ctx, 60, 44, 1, '#d8eefc'); cloud(ctx, 170, 30, 0.8, '#d8eefc'); cloud(ctx, 120, 78, 0.6, '#d8eefc');
      hills(ctx, rng, 150, '#9fe0a0', 18, 30, 26, W, H);
      hills(ctx, rng, 176, '#6ccf78', 12, 22, 20, W, H);
      for (let x = 10; x < W; x += 38 + Math.floor(rng() * 20)) {
        const y = 160 + rng() * 14;
        rect(ctx, x - 2, y, 5, 26, '#8a5a34');
        disc(ctx, x, y - 6, 12, '#3fae5a'); disc(ctx, x - 3, y - 9, 6, '#7bd389');
        for (let k = 0; k < 3; k++) px(ctx, x - 6 + rng() * 12, y - 12 + rng() * 10, '#ff6b6b');
      }
      for (let i = 0; i < 70; i++) px(ctx, rng() * W, 196 + rng() * 40, ['#ffffff', '#ffcd75', '#ff8cc6', '#c9a6ff'][i % 4]);
    } else if (name === 'guilin') {
      // 桂林山水: 겹겹의 카르스트 봉우리와 리강, 대나무 뗏목
      sun(ctx, 250, 40);
      cloud(ctx, 70, 34, 0.7, '#e4f4fb');
      const far = ['#b9dccf', '#8cc4ad', '#5fa889'];
      [[150, 34, 0.9], [168, 26, 1.1], [184, 20, 1.3]].forEach((L, li) => {
        for (let x = -10; x < W + 30; x += L[1] + Math.floor(rng() * 12)) karst(ctx, x, L[0] + 2, 22 * L[2] + rng() * 10, (50 + rng() * 40) * L[2], far[li], li === 2 ? '#7cc0a0' : null);
        mistBand(ctx, L[0] - 8, L[0] + 2, '#eef8f4', rng, W);
      });
      // 강물과 반사
      rect(ctx, 0, 184, W, 56, '#6cc4d8');
      for (let y = 186; y < H; y += 4) for (let x = (y / 4 % 2) * 8; x < W; x += 18) rect(ctx, x, y, 8, 1, '#a8e6f0');
      for (let x = -10; x < W + 30; x += 30) { const h = 10 + rng() * 10; rect(ctx, x, 186, 14, h * 0.6, 'rgba(95,168,137,0.35)'); }
      // 뗏목과 어부
      rect(ctx, 200, 200, 40, 3, '#c9a05a'); for (let x = 200; x < 240; x += 5) px(ctx, x, 201, '#8a6a3a');
      rect(ctx, 218, 188, 3, 12, '#1a1c2c'); ellipse(ctx, 219, 187, 6, 2, '#e8c47a'); rect(ctx, 214, 194, 1, 1, '#1a1c2c');
      for (let i = 0; i < 22; i++) px(ctx, 222 + i, 192 - i * 0.6, '#5e3a1e');
      [[60, 60], [80, 52], [100, 64]].forEach(b => { px(ctx, b[0], b[1], '#333c57'); px(ctx, b[0] - 1, b[1] - 1, '#333c57'); px(ctx, b[0] + 1, b[1] - 1, '#333c57'); });
    } else if (name === 'zhangjiajie') {
      // 张家界: 하늘로 솟은 사암 기둥과 구름 띠
      sun(ctx, 60, 40);
      const pillar = (x, top, w, col, sh, cap) => {
        for (let y = top; y < H; y++) { const ww = w + Math.sin(y / 7 + x) * 1.5; rect(ctx, x - ww / 2, y, ww, 1, col); rect(ctx, x - ww / 2, y, Math.max(1, ww * 0.3), 1, sh); }
        for (let y = top + 6; y < H; y += 9 + Math.floor(rng() * 6)) rect(ctx, x - w / 2, y, w, 1, sh);
        ellipse(ctx, x, top, w * 0.75, 4, cap); ellipse(ctx, x - 2, top - 2, w * 0.45, 3, '#7bd389');
        if (rng() < 0.6) pine(ctx, x + w * 0.2, top - 10, 0.35, rng() < 0.5);
      };
      for (let x = 0; x < W + 20; x += 22 + Math.floor(rng() * 14)) pillar(x, 70 + rng() * 40, 10 + rng() * 6, '#d9c0a8', '#e8d6c2', '#9fc89a');
      mistBand(ctx, 120, 150, '#ffffff', rng, W);
      for (let x = 10; x < W + 20; x += 34 + Math.floor(rng() * 18)) pillar(x, 100 + rng() * 50, 16 + rng() * 8, '#b88a62', '#d2a87e', '#5aa85a');
      mistBand(ctx, 170, 205, '#ffffff', rng, W);
      cloud(ctx, 180, 50, 0.8, '#e4f4fb'); cloud(ctx, 280, 74, 0.6, '#e4f4fb');
    } else if (name === 'jiuzhaigou') {
      // 九寨沟: 설산, 단풍 숲, 에메랄드 호수와 계단 폭포
      const mtn = (x, y, w, h, col) => { for (let i = 0; i < h; i++) { const ww = (i / h) * w; rect(ctx, x - ww, y + i, ww * 2 + 1, 1, col); if (i < h * 0.28) rect(ctx, x - ww, y + i, ww * 2 + 1, 1, '#ffffff'); } };
      mtn(80, 40, 80, 100, '#9cb8d8'); mtn(240, 30, 90, 110, '#8aa8cc');
      cloud(ctx, 160, 46, 0.7, '#e4f4fb');
      const autumn = ['#f2a65a', '#e8673a', '#ffd27a', '#c0503a', '#7bbf5a'];
      for (let x = -6; x < W + 10; x += 9) { const r = 7 + rng() * 6; disc(ctx, x, 128 + rng() * 10, r, autumn[Math.floor(rng() * autumn.length)]); }
      rect(ctx, 0, 136, W, 20, '#5e7a4a');
      for (let x = -6; x < W + 10; x += 8) { const r = 6 + rng() * 5; disc(ctx, x, 146 + rng() * 8, r, autumn[Math.floor(rng() * autumn.length)]); }
      // 계단식 폭포 (노르랑)
      for (let k = 0; k < 3; k++) {
        const y = 154 + k * 14;
        rect(ctx, 0, y, W, 12, ['#3fc8c0', '#2fb2c8', '#1e9fd0'][k]);
        for (let x = 0; x < W; x += 2) if (rng() < 0.55) rect(ctx, x, y + 9, 1, 3 + Math.floor(rng() * 4), '#ffffff');
        rect(ctx, 0, y, W, 1, '#c8fff6');
      }
      rect(ctx, 0, 196, W, 44, '#1e9fd0');
      for (let y = 198; y < H; y += 5) for (let x = (y % 2) * 7; x < W; x += 16) rect(ctx, x, y, 7, 1, '#7fe0f0');
      for (let i = 0; i < 10; i++) { const x = rng() * W, y = 200 + rng() * 30; rect(ctx, x, y, 1, 4, '#8a5a34'); }
    } else if (name === 'huangshan') {
      // 黄山: 일출 하늘, 뾰족한 화강암 봉우리, 구름 바다, 영객송
      disc(ctx, 230, 120, 26, 'rgba(255,220,140,0.35)'); disc(ctx, 230, 120, 16, '#ffd94a'); disc(ctx, 227, 117, 10, '#fff1a0');
      const peak = (x, base, w, h, col, hi) => {
        for (let i = 0; i < h; i++) { const t = i / h, ww = w * Math.pow(t, 0.8) + 2; const jag = Math.sin(i * 1.3 + x) * 1.5;
          rect(ctx, x - ww / 2 + jag, base - h + i, ww, 1, col); rect(ctx, x - ww / 2 + jag, base - h + i, Math.max(1, ww * 0.22), 1, hi); }
      };
      for (let x = -10; x < W + 20; x += 26 + Math.floor(rng() * 16)) peak(x, 150, 26 + rng() * 14, 50 + rng() * 50, '#7a7f9e', '#a6a9c2');
      mistBand(ctx, 128, 168, '#ffffff', rng, W);
      for (let i = 0; i < 6; i++) cloud(ctx, rng() * W, 150 + rng() * 20, 0.9 + rng() * 0.5, '#f2e6f0');
      for (let x = 0; x < W + 20; x += 40 + Math.floor(rng() * 20)) peak(x, 214, 34 + rng() * 14, 46 + rng() * 40, '#5e6478', '#8f94a6');
      peak(46, 200, 40, 70, '#5e6478', '#8f94a6');
      pine(ctx, 54, 128, 1, false);
      rect(ctx, 0, 206, W, 34, '#fff4e0');
      for (let i = 0; i < 4; i++) cloud(ctx, i * 90 + 30, 214, 1.1, '#f2e6f0');
    }
  }

  /* ── 밤 배경 (스토리 컷신용) ── */
  function drawNightBg(ctx) {
    const W = DT.W, H = DT.H, rng = DT.rng(7);
    gradient(ctx, [[0, '#141626'], [0.35, '#29366f'], [0.65, '#3b2f6e'], [0.85, '#4a2860'], [1, '#1b1430']], W, H);
    for (let i = 0; i < 80; i++) px(ctx, rng() * W, rng() * 120, rng() < 0.3 ? '#73eff7' : '#f4f4f4');
    disc(ctx, 258, 52, 14, '#ffcd75'); disc(ctx, 255, 49, 11, '#ffe3a6');
    hills(ctx, rng, 160, '#231c48', 14, 26, 20, W, H);
    hills(ctx, rng, 186, '#17122e', 10, 20, 16, W, H);
  }

  /* ── 말의 나무 (스토리용) 150x160 ── */
  function drawTree(ctx) {
    const rng = DT.rng(11);
    for (let y = 70; y < 160; y++) { const w = 10 + Math.max(0, (y - 120)) * 0.9; rect(ctx, 75 - w, y, w * 2, 1, '#6b4020'); }
    for (let y = 70; y < 160; y++) { const w = 7 + Math.max(0, (y - 124)) * 0.7; rect(ctx, 73 - w, y, w * 1.6, 1, '#8a5a34'); }
    for (let y = 72; y < 150; y++) if (y % 9 < 5) rect(ctx, 68, y, 2, 1, '#b8743a');
    for (let i = 0; i < 18; i++) { rect(ctx, 48 + i, 70 - i * 0.8, 3, 3, '#8a5a34'); rect(ctx, 98 - i, 70 - i * 0.8, 3, 3, '#8a5a34'); }
    const blobs = [[75, 40, 34], [42, 52, 24], [108, 52, 24], [58, 24, 22], [94, 24, 22], [75, 14, 18], [28, 66, 14], [122, 66, 14]];
    blobs.forEach(b => disc(ctx, b[0], b[1] + 2, b[2], '#2f8f4a'));
    blobs.forEach(b => disc(ctx, b[0], b[1], b[2] - 1, '#3fae5a'));
    blobs.forEach(b => disc(ctx, b[0] - b[2] * 0.25, b[1] - b[2] * 0.25, b[2] * 0.62, '#6ccf78'));
    blobs.forEach(b => disc(ctx, b[0] - b[2] * 0.4, b[1] - b[2] * 0.4, b[2] * 0.25, '#c8f58a'));
    for (let i = 0; i < 16; i++) {
      const x = 20 + Math.floor(rng() * 110), y = 8 + Math.floor(rng() * 66);
      disc(ctx, x, y, 2, 'rgba(255,205,117,0.45)'); px(ctx, x, y, '#ffcd75'); px(ctx, x - 1, y, '#fff2c4');
    }
  }

  /* ── 픽셀 폰트 5x7 (+그림자) ── */
  const GLYPHS = {
    '0': '01110 10001 10011 10101 11001 10001 01110', '1': '00100 01100 00100 00100 00100 00100 01110',
    '2': '01110 10001 00001 00010 00100 01000 11111', '3': '11110 00001 00001 01110 00001 00001 11110',
    '4': '00010 00110 01010 10010 11111 00010 00010', '5': '11111 10000 11110 00001 00001 10001 01110',
    '6': '00110 01000 10000 11110 10001 10001 01110', '7': '11111 00001 00010 00100 01000 01000 01000',
    '8': '01110 10001 10001 01110 10001 10001 01110', '9': '01110 10001 10001 01111 00001 00010 01100',
    A: '01110 10001 10001 11111 10001 10001 10001', B: '11110 10001 10001 11110 10001 10001 11110',
    C: '01110 10001 10000 10000 10000 10001 01110', D: '11100 10010 10001 10001 10001 10010 11100',
    E: '11111 10000 10000 11110 10000 10000 11111', F: '11111 10000 10000 11110 10000 10000 10000',
    G: '01110 10001 10000 10111 10001 10001 01111', H: '10001 10001 10001 11111 10001 10001 10001',
    I: '01110 00100 00100 00100 00100 00100 01110', J: '00111 00010 00010 00010 00010 10010 01100',
    K: '10001 10010 10100 11000 10100 10010 10001', L: '10000 10000 10000 10000 10000 10000 11111',
    M: '10001 11011 10101 10101 10001 10001 10001', N: '10001 10001 11001 10101 10011 10001 10001',
    O: '01110 10001 10001 10001 10001 10001 01110', P: '11110 10001 10001 11110 10000 10000 10000',
    Q: '01110 10001 10001 10001 10101 10010 01101', R: '11110 10001 10001 11110 10100 10010 10001',
    S: '01111 10000 10000 01110 00001 00001 11110', T: '11111 00100 00100 00100 00100 00100 00100',
    U: '10001 10001 10001 10001 10001 10001 01110', V: '10001 10001 10001 10001 10001 01010 00100',
    W: '10001 10001 10001 10101 10101 10101 01010', X: '10001 10001 01010 00100 01010 10001 10001',
    Y: '10001 10001 10001 01010 00100 00100 00100', Z: '11111 00001 00010 00100 01000 10000 11111',
    ' ': '00000 00000 00000 00000 00000 00000 00000', '!': '00100 00100 00100 00100 00100 00000 00100',
    '?': '01110 10001 00001 00010 00100 00000 00100', '.': '00000 00000 00000 00000 00000 01100 01100',
    ':': '00000 01100 01100 00000 01100 01100 00000', '-': '00000 00000 00000 11111 00000 00000 00000',
    '+': '00000 00100 00100 11111 00100 00100 00000', '×': '00000 10001 01010 00100 01010 10001 00000',
    '/': '00001 00010 00010 00100 01000 01000 10000', '(': '00010 00100 01000 01000 01000 00100 00010',
    ')': '01000 00100 00010 00010 00010 00100 01000', ',': '00000 00000 00000 00000 01100 00100 01000',
    "'": '00100 00100 01000 00000 00000 00000 00000', '<': '00010 00100 01000 10000 01000 00100 00010',
    '>': '01000 00100 00010 00001 00010 00100 01000', '=': '00000 00000 11111 00000 11111 00000 00000',
    '♥': '00000 01010 11111 11111 01110 00100 00000', '%': '11001 11010 00010 00100 01000 01011 10011'
  };
  const FONT_CHARS = Object.keys(GLYPHS).join('');
  const CELL_W = 7, CELL_H = 9, PER_ROW = 16;

  function buildFont(scene) {
    if (scene.cache.bitmapFont.exists('pixel')) return;
    const rows = Math.ceil(FONT_CHARS.length / PER_ROW);
    addSingle(scene, 'pixelfont', CELL_W * PER_ROW, CELL_H * rows, (ctx) => {
      Array.from(FONT_CHARS).forEach((ch, idx) => {
        const gx = (idx % PER_ROW) * CELL_W, gy = Math.floor(idx / PER_ROW) * CELL_H;
        const g = GLYPHS[ch].split(' ');
        for (const pass of [['#1a1c2c', 1], ['#ffffff', 0]]) {
          ctx.fillStyle = pass[0];
          for (let y = 0; y < 7; y++) for (let x = 0; x < 5; x++) if (g[y][x] === '1') ctx.fillRect(gx + x + pass[1], gy + y + pass[1], 1, 1);
        }
      });
    });
    const data = Phaser.GameObjects.RetroFont.Parse(scene, {
      image: 'pixelfont', width: CELL_W, height: CELL_H, chars: FONT_CHARS,
      charsPerRow: PER_ROW, spacing: { x: 0, y: 0 }, offset: { x: 0, y: 0 }, lineSpacing: 2
    });
    scene.cache.bitmapFont.add('pixel', data);
  }

  DT.ENEMY_KINDS = ['mush', 'gob', 'thief', 'bird', 'frog', 'snail', 'dragon', 'monkey', 'puppy'];

  DT.Art = {
    build(scene) {
      const g = G(), P = g.PALETTE;
      // 주인공 3명
      addSheet(scene, 'hero_tuk', g.tuk, P);
      addSheet(scene, 'hero_pong', heroFrames(g.tuk, { G: 'Q', g: 'q', D: 'N' }, g.TOPPERS.pong), P);
      addSheet(scene, 'hero_doto', heroFrames(g.tuk, { G: 'A', g: 'a', D: 'B' }, g.TOPPERS.doto), P);
      addSheet(scene, 'seed_tuk', g.seed, P);
      addSheet(scene, 'seed_pong', g.seed.map(r => r.map(l => l.replace(/[GgD]/g, c => ({ G: 'Q', g: 'q', D: 'N' })[c]))), P);
      addSheet(scene, 'seed_doto', g.seed.map(r => r.map(l => l.replace(/[GgD]/g, c => ({ G: 'A', g: 'a', D: 'B' })[c]))), P);
      DT.ENEMY_KINDS.forEach(k => addSheet(scene, k, g[k], P));
      ['heart', 'heartEmpty', 'leaf', 'star', 'spark', 'cursor', 'speaker', 'fireball', 'peach', 'poop'].forEach(k => addSheet(scene, k, g[k], P));
      // 보스 공격: 충격파 · 포자탄
      addFrames(scene, 'shock', 16, 10, 2, (ctx, ox, f) => {
        for (let x = 0; x < 16; x++) { const h = Math.round(3 + 6 * Math.sin((x / 15) * Math.PI) * (f ? 0.8 : 1)); rect(ctx, ox + x, 10 - h, 1, h, x % 3 === f ? '#ffffff' : '#ffcd75'); }
        rect(ctx, ox, 9, 16, 1, '#ef7d57');
      });
      addSingle(scene, 'spore', 8, 8, (ctx) => { disc(ctx, 4, 4, 3, '#b55088'); disc(ctx, 3, 3, 1, '#ffd0f0'); px(ctx, 6, 5, '#7a2f6a'); });
      Object.keys(g.deco).forEach(k => addSheet(scene, 'deco_' + k, [g.deco[k]], P));

      addSingle(scene, 'orb', 20, 20, drawOrb);
      addSingle(scene, 'px', 2, 2, (ctx) => rect(ctx, 0, 0, 2, 2, '#fff'));
      addSingle(scene, 'glow', 5, 5, (ctx) => {
        ctx.fillStyle = 'rgba(255,240,160,0.35)'; ctx.fillRect(1, 0, 3, 5); ctx.fillRect(0, 1, 5, 3);
        ctx.fillStyle = '#fff6c8'; ctx.fillRect(2, 1, 1, 3); ctx.fillRect(1, 2, 3, 1);
      });
      // 테마별 떠다니는 효과
      addSingle(scene, 'petal', 4, 3, (ctx) => { rect(ctx, 1, 0, 2, 1, '#ffb3d1'); rect(ctx, 0, 1, 4, 1, '#ff8cc6'); rect(ctx, 1, 2, 2, 1, '#ffb3d1'); });
      addSingle(scene, 'maple', 5, 5, (ctx) => { rect(ctx, 2, 0, 1, 5, '#e8673a'); rect(ctx, 0, 2, 5, 1, '#e8673a'); rect(ctx, 1, 1, 3, 3, '#f2a65a'); px(ctx, 2, 2, '#ffd27a'); });
      addSingle(scene, 'cloudpuff', 9, 5, (ctx) => { disc(ctx, 3, 3, 2, '#ffffff'); disc(ctx, 6, 2, 2, '#ffffff'); rect(ctx, 1, 3, 7, 2, '#ffffff'); });
      addSingle(scene, 'crown', 14, 8, (ctx) => {
        rect(ctx, 0, 2, 14, 6, '#1a1c2c'); rect(ctx, 1, 4, 12, 3, '#ffcd75');
        [[1, 1], [6, 0], [11, 1]].forEach(p => { rect(ctx, p[0], p[1], 2, 4, '#1a1c2c'); rect(ctx, p[0] + 0.5, p[1] + 1, 1, 3, '#ffcd75'); });
        px(ctx, 4, 5, '#f4566a'); px(ctx, 7, 5, '#41a6f6'); px(ctx, 10, 5, '#7bd389'); rect(ctx, 1, 4, 12, 1, '#fff2c4');
      });
      addSingle(scene, 'sprinkle', 1, 3, (ctx) => rect(ctx, 0, 0, 1, 3, '#ffffff'));
      addSingle(scene, 'bubble', 6, 6, (ctx) => {
        for (let y = 0; y < 6; y++) for (let x = 0; x < 6; x++) { const d = Math.hypot(x + 0.5 - 3, y + 0.5 - 3); if (d <= 3 && d > 2) px(ctx, x, y, '#ffffff'); }
        px(ctx, 2, 1, '#ffffff'); px(ctx, 1, 2, '#ffffff');
      });
      addSingle(scene, 'flake', 5, 5, (ctx) => { rect(ctx, 2, 0, 1, 5, '#ffffff'); rect(ctx, 0, 2, 5, 1, '#ffffff'); px(ctx, 1, 1, '#e8f4ff'); px(ctx, 3, 3, '#e8f4ff'); px(ctx, 3, 1, '#e8f4ff'); px(ctx, 1, 3, '#e8f4ff'); });
      addSingle(scene, 'token', 14, 14, (ctx) => {
        rect(ctx, 1, 0, 12, 14, '#1a1c2c'); rect(ctx, 0, 1, 14, 12, '#1a1c2c');
        rect(ctx, 2, 1, 10, 12, '#ffcd75'); rect(ctx, 1, 2, 12, 10, '#ffcd75');
        rect(ctx, 2, 2, 10, 9, '#fff2cf'); rect(ctx, 2, 2, 4, 1, '#ffffff');
        rect(ctx, 10, 0, 3, 2, '#38b764'); px(ctx, 11, 0, '#a7f070');
      });
      addSingle(scene, 'chunkTok', 30, 16, (ctx) => {
        rect(ctx, 1, 0, 28, 16, '#1a1c2c'); rect(ctx, 0, 1, 30, 14, '#1a1c2c');
        rect(ctx, 2, 1, 26, 14, '#a7f070'); rect(ctx, 1, 2, 28, 12, '#a7f070');
        rect(ctx, 2, 2, 26, 11, '#eaffd4'); rect(ctx, 3, 2, 8, 1, '#ffffff');
      });
      addFrames(scene, 'ring', 32, 32, 4, (ctx, ox, i) => {
        const r = [4, 8, 11, 14][i], th = [3, 2, 2, 1][i];
        for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) {
          const d = Math.sqrt((x + 0.5 - 16) ** 2 + (y + 0.5 - 16) ** 2);
          if (d <= r && d > r - th) px(ctx, ox + x, y, '#ffffff');
        }
      });
      addFrames(scene, 'puff', 16, 16, 4, (ctx, ox, i) => {
        const r = [6, 7, 5, 3][i];
        disc(ctx, ox + 8, 8, r, i < 2 ? '#f4f4f4' : '#94b0c2');
        if (i < 3) disc(ctx, ox + 8 - r / 2, 8 - r / 2, Math.max(1, r / 3), '#ffffff');
      });
      // 테마별 지형·배경
      Object.keys(THEMES).forEach(name => {
        const T = THEMES[name], rng = DT.rng(name.length * 17 + 3);
        addFrames(scene, 'stone_' + name, 16, 16, 4, (ctx, ox) => drawBrick(ctx, ox, rng, false, T));
        addFrames(scene, 'groundTop_' + name, 16, 16, 4, (ctx, ox) => drawBrick(ctx, ox, rng, true, T));
        addFrames(scene, 'plat_' + name, 16, 8, 4, (ctx, ox) => drawPlatform(ctx, ox, rng, '', T));
        addFrames(scene, 'platL_' + name, 16, 8, 1, (ctx, ox) => drawPlatform(ctx, ox, rng, 'l', T));
        addFrames(scene, 'platR_' + name, 16, 8, 1, (ctx, ox) => drawPlatform(ctx, ox, rng, 'r', T));
        addFrames(scene, 'platLR_' + name, 16, 8, 1, (ctx, ox) => drawPlatform(ctx, ox, rng, 'lr', T));
        addSingle(scene, 'bg_' + name, DT.W, DT.H, (ctx) => drawThemeBg(ctx, name));
        // 진담 점프용: 무너지는 발판(금 간 발판) · 움직이는 발판(3칸)
        addSingle(scene, 'crumble_' + name, 16, 8, (ctx) => {
          drawPlatform(ctx, 0, rng, 'lr', T);
          [[4, 2], [5, 3], [6, 4], [6, 5], [11, 1], [10, 2], [10, 3], [11, 4]].forEach(p => px(ctx, p[0], p[1], '#1a1c2c'));
          rect(ctx, 0, 7, 16, 1, '#b13e53');
        });
        addSingle(scene, 'mplat_' + name, 48, 8, (ctx) => {
          drawPlatform(ctx, 0, rng, 'l', T); drawPlatform(ctx, 16, rng, '', T); drawPlatform(ctx, 32, rng, 'r', T);
          rect(ctx, 22, 4, 4, 2, '#ffcd75'); px(ctx, 21, 5, '#ffcd75'); px(ctx, 26, 4, '#ffcd75');
        });
      });
      addSingle(scene, 'bg_night', DT.W, DT.H, drawNightBg);
      // 진담 점프: 올라오는 가시덩굴 / 독초 (가로로 이어지는 32x40 타일)
      addSingle(scene, 'hazard_thorn', 32, 40, (ctx) => {
        const rng = DT.rng(5);
        rect(ctx, 0, 10, 32, 30, '#2f5a2a');
        for (let y = 12; y < 40; y += 3) for (let x = (y % 2) * 2; x < 32; x += 5) rect(ctx, x, y, 3, 1, '#3f7f3a');
        for (let x = 0; x < 32; x++) { const h = 3 + Math.round(Math.abs(Math.sin(x * 0.9)) * 6); rect(ctx, x, 10 - h, 1, h, '#3f7f3a'); }
        [[2, 1], [9, 3], [15, 0], [22, 2], [28, 1]].forEach(t => { rect(ctx, t[0], t[1] + 2, 2, 3, '#b13e53'); px(ctx, t[0], t[1], '#ff8c9a'); px(ctx, t[0] + 1, t[1] + 1, '#ff8c9a'); });
        for (let i = 0; i < 10; i++) { const x = Math.floor(rng() * 30), y = 14 + Math.floor(rng() * 24); px(ctx, x, y, '#b13e53'); px(ctx, x + 1, y - 1, '#ff8c9a'); }
      });
      addSingle(scene, 'hazard_poison', 32, 40, (ctx) => {
        const rng = DT.rng(9);
        rect(ctx, 0, 10, 32, 30, '#4a2560');
        for (let y = 12; y < 40; y += 3) for (let x = (y % 2) * 3; x < 32; x += 6) rect(ctx, x, y, 3, 1, '#6a3a80');
        for (let x = 0; x < 32; x++) { const h = 2 + Math.round(Math.abs(Math.sin(x * 0.7 + 1)) * 8); rect(ctx, x, 10 - h, 1, h, x % 4 < 2 ? '#7bd389' : '#5aa85a'); }
        [[4, 3], [13, 1], [20, 4], [27, 2]].forEach(b => { disc(ctx, b[0], b[1] + 8, 2, '#c46ad8'); px(ctx, b[0] - 1, b[1] + 7, '#f0c0ff'); });
        for (let i = 0; i < 8; i++) { const x = Math.floor(rng() * 30), y = 14 + Math.floor(rng() * 24); disc(ctx, x, y, 1, '#c46ad8'); }
      });
      addSingle(scene, 'goalflag', 18, 30, (ctx) => {
        rect(ctx, 1, 0, 2, 30, '#1a1c2c'); rect(ctx, 1, 0, 1, 30, '#94b0c2');
        rect(ctx, 3, 1, 14, 10, '#1a1c2c'); rect(ctx, 3, 2, 13, 8, '#f4566a'); rect(ctx, 3, 2, 13, 2, '#ff8c9a');
        rect(ctx, 7, 4, 5, 4, '#ffcd75'); px(ctx, 9, 5, '#f4566a');
        disc(ctx, 2, 0, 1, '#ffcd75');
      });
      // 퐁이의 물결 (오른쪽으로 흐르는 파도) 2프레임
      addFrames(scene, 'wave', 28, 20, 2, (ctx, ox, f) => {
        for (let x = 0; x < 28; x++) {
          const t = x / 27;
          const h = Math.round(4 + 13 * Math.pow(Math.sin(Math.min(1, t * 1.15) * Math.PI * 0.5), 2) * (t < 0.85 ? 1 : (1 - t) * 6.6));
          const y0 = 20 - h;
          rect(ctx, ox + x, y0, 1, h, '#41a6f6');
          rect(ctx, ox + x, y0 + 2, 1, Math.max(0, h - 6), '#2f7fd0');
          rect(ctx, ox + x, y0, 1, 2, (x + f * 2) % 5 === 0 ? '#ffffff' : '#b8e6ff');
          if ((x + f * 3) % 6 === 0) px(ctx, ox + x, y0 + 4 + ((x + f) % 3), '#b8e6ff');
        }
        rect(ctx, ox + 21, 2 + f, 4, 2, '#ffffff'); rect(ctx, ox + 24, 4 + f, 2, 2, '#b8e6ff');
        px(ctx, ox + 18, 1 + f * 2, '#ffffff');
      });
      addSingle(scene, 'tree', 150, 160, drawTree);

      buildFont(scene);
      this.anims(scene);
    },

    anims(scene) {
      const A = scene.anims;
      const mk = (key, tex, frames, rate, repeat) => {
        if (A.exists(key)) return;
        A.create({ key, frames: frames.map(f => ({ key: tex, frame: f })), frameRate: rate, repeat: repeat === undefined ? -1 : repeat });
      };
      ['tuk', 'pong', 'doto'].forEach(h => {
        const t = 'hero_' + h;
        mk(h + '_idle', t, [0, 0, 1, 1, 0, 0, 1, 2], 4);
        mk(h + '_run', t, [3, 0, 4, 0], 12);
        mk(h + '_jump', t, [5], 1);
        mk(h + '_fall', t, [6], 1);
        mk(h + '_shoot', t, [7], 1);
        mk(h + '_hurt', t, [8], 1);
        mk(h + '_win', t, [9, 0], 4);
        mk(h + '_push', t, [10, 11], 6);
        mk(h + '_kick', t, [12], 1);
        mk(h + '_punch', t, [13], 1);
      });
      DT.ENEMY_KINDS.forEach(k => {
        mk(k + '_walk', k, [0, 1], k === 'thief' || k === 'bird' ? 8 : 5);
        mk(k + '_struggle', k, [2, 3], 9);
      });
      mk('fireball_fly', 'fireball', [0, 1], 12);
      mk('shock_go', 'shock', [0, 1], 12);
      mk('fx_spark', 'spark', [0, 1, 2], 24, 0);
      mk('fx_ring', 'ring', [0, 1, 2, 3], 24, 0);
      mk('fx_puff', 'puff', [0, 1, 2, 3], 14, 0);
    }
  };
})();
