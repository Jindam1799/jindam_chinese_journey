// 4개 월드 × 8스테이지(x-8 보스) 데이터를 만들어 data/game-data.json 에 씁니다.
// 사용법: node tools/build-stages.cjs   (같은 시드 → 같은 맵. 손으로 고친 맵을 지키려면 이 스크립트 대신 JSON을 직접 수정)
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');

/* ── 어휘: 월드마다 9개 덩어리 ── */
const W = (id, hanzi, pinyin, meaning, reward) => ({
  id, hanzi, pinyin, meaning, reward,
  chars: Array.from(hanzi).map((h, i) => ({ h, p: pinyin.split(' ')[i] }))
});
const VOCAB = [
  // 월드 1: 하루 생활
  [W('heshui', '喝水', 'hē shuǐ', '물을 마시다', 'heal'), W('chifan', '吃饭', 'chī fàn', '밥을 먹다', 'score'), W('kanshu', '看书', 'kàn shū', '책을 보다', 'power'),
   W('shuijiao', '睡觉', 'shuì jiào', '잠을 자다', 'heal'), W('xishou', '洗手', 'xǐ shǒu', '손을 씻다', 'score'), W('shuaya', '刷牙', 'shuā yá', '이를 닦다', 'power'),
   W('chuanyi', '穿衣', 'chuān yī', '옷을 입다', 'score'), W('paobu', '跑步', 'pǎo bù', '달리기하다', 'power'), W('changge', '唱歌', 'chàng gē', '노래를 부르다', 'heal')],
  // 월드 2: 학교와 놀이
  [W('shangxue', '上学', 'shàng xué', '학교에 가다', 'score'), W('xiezi', '写字', 'xiě zì', '글씨를 쓰다', 'power'), W('huahua', '画画', 'huà huà', '그림을 그리다', 'heal'),
   W('tiaowu', '跳舞', 'tiào wǔ', '춤을 추다', 'power'), W('tingge', '听歌', 'tīng gē', '노래를 듣다', 'heal'), W('daqiu', '打球', 'dǎ qiú', '공놀이하다', 'score'),
   W('youyong', '游泳', 'yóu yǒng', '수영하다', 'power'), W('kaiche', '开车', 'kāi chē', '운전하다', 'score'), W('huijia', '回家', 'huí jiā', '집에 가다', 'heal')],
  // 월드 3: 음식과 집
  [W('chitang', '吃糖', 'chī táng', '사탕을 먹다', 'score'), W('henai', '喝奶', 'hē nǎi', '우유를 마시다', 'heal'), W('zuofan', '做饭', 'zuò fàn', '밥을 하다', 'power'),
   W('hecha', '喝茶', 'hē chá', '차를 마시다', 'heal'), W('maicai', '买菜', 'mǎi cài', '장을 보다', 'score'), W('xizao', '洗澡', 'xǐ zǎo', '목욕하다', 'heal'),
   W('qichuang', '起床', 'qǐ chuáng', '일어나다', 'power'), W('kaimen', '开门', 'kāi mén', '문을 열다', 'score'), W('kanhai', '看海', 'kàn hǎi', '바다를 보다', 'power')],
  // 월드 4: 자연과 여행
  [W('pashan', '爬山', 'pá shān', '산에 오르다', 'power'), W('kanhua', '看花', 'kàn huā', '꽃을 보다', 'heal'), W('zuochuan', '坐船', 'zuò chuán', '배를 타다', 'score'),
   W('xiayu', '下雨', 'xià yǔ', '비가 오다', 'heal'), W('guafeng', '刮风', 'guā fēng', '바람이 불다', 'power'), W('kanyun', '看云', 'kàn yún', '구름을 보다', 'score'),
   W('zhaoxiang', '照相', 'zhào xiàng', '사진을 찍다', 'score'), W('weiyu', '喂鱼', 'wèi yú', '물고기 밥을 주다', 'heal'), W('zhongshu', '种树', 'zhòng shù', '나무를 심다', 'power')]
];

/* ── 월드 ── */
const WORLDS = [
  { theme: 'guilin', place: '구이린', names: ['리강 나루터', '코끼리 코 바위', '대나무 뗏목길', '양숴 들판', '달빛 언덕', '노을 강변', '안개 봉우리'],
    mix: ['mush', 'mush', 'gob', 'snail', 'bird'],
    boss: { kind: 'mush', name: '거대 혼동버섯', hp: 6, tint: 0xe6b8ff, minions: ['mush', 'gob'] } },
  { theme: 'zhangjiajie', place: '장자제', names: ['기둥 숲 입구', '구름 다리', '천자산', '금편 계곡', '하늘 사다리', '천문동 앞', '안개 절벽'],
    mix: ['mush', 'gob', 'gob', 'snail', 'bird', 'frog'],
    boss: { kind: 'gob', name: '왕먹깨비', hp: 7, tint: 0xb8c8ff, minions: ['gob', 'snail', 'bird'] } },
  { theme: 'jiuzhaigou', place: '주자이거우', names: ['다섯 빛깔 호수', '거울 호수', '진주 여울', '노르랑 폭포', '단풍 숲길', '판다 호수', '긴 바다'],
    mix: ['frog', 'frog', 'mush', 'bird', 'thief', 'snail'],
    boss: { kind: 'frog', name: '대왕 병음개구리', hp: 8, tint: 0xffd0a0, minions: ['frog', 'mush', 'bird'] } },
  { theme: 'huangshan', place: '황산', names: ['영객송 쉼터', '구름 바다', '광명정', '서해 협곡', '시신봉', '연꽃봉', '일출 정상'],
    mix: ['thief', 'gob', 'frog', 'bird', 'snail', 'mush', 'thief'],
    boss: { kind: 'thief', name: '도둑대왕', hp: 10, tint: 0xffe08a, minions: ['thief', 'snail', 'bird', 'gob'] } }
];

/* ── 발판 배치 (5·8·11행) ── */
const LAYOUTS = [
  ['#....==========....#', '#=====........=====#', '#...============...#'],
  ['#=====.....========#', '#..===..======..===#', '#=======....=======#'],
  ['#..======..======..#', '#=======....=======#', '#.....========.....#'],
  ['#=====.===..===.===#', '#.====..====..====.#', '#===....====....===#'],
  ['#=======....=======#', '#....==========....#', '#=====........=====#'],
  ['#...====....====...#', '#==....======....==#', '#....====..====....#'],
  ['#.=============....#', '#....=============.#', '#.=============....#'],
  ['#===.===.===.===.==#', '#.===.===.===.===..#', '#===.===.===.===.==#']
];
const BOSS_LAYOUT = ['#===............===#', '#......======......#', '#====..........====#'];
const CODE = { mush: 'm', gob: 'k', thief: 't', bird: 'b', frog: 'f', snail: 's' };

function rng(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const E = '#..................#';
const set = (row, c, ch) => row.slice(0, c) + ch + row.slice(c + 1);

function makeMap(layout, enemies, R) {
  const m = ['....................', E, E, E, E, layout[0], E, E, layout[1], E, E, layout[2], E, '#.........P........#', '####################'];
  // 놓을 수 있는 칸: 발판(5·8·11행) 바로 위, 바닥(13행)은 시작 위치에서 먼 곳
  const spots = [];
  [5, 8, 11].forEach(r => { for (let c = 1; c < 19; c++) if (m[r][c] === '=') spots.push([r - 1, c]); });
  for (let c = 1; c < 19; c++) if (Math.abs(c - 10) >= 6) spots.push([13, c]);
  const air = [];
  [2, 6, 9].forEach(r => { for (let c = 2; c < 18; c++) air.push([r, c]); });
  const used = new Set();
  const take = (list) => {
    for (let tries = 0; tries < 200; tries++) {
      const [r, c] = list[Math.floor(R() * list.length)];
      if ([-1, 0, 1].some(d => used.has(r + ',' + (c + d)))) continue;
      used.add(r + ',' + c);
      return [r, c];
    }
    return null;
  };
  enemies.forEach(kind => {
    const p = take(kind === 'bird' ? air : spots);
    if (p) m[p[0]] = set(m[p[0]], p[1], CODE[kind]);
  });
  return m;
}

/* ── 진담 점프: 세로로 긴 등반 맵 (아래에서 가시덩굴·독초가 올라옴) ── */
function makeClimbMap(rows, R, mix, count) {
  const m = [];
  m.push('....................');
  m.push(E); m.push(E);
  m.push('#=========G========#');           // 골 발판 + 깃발
  for (let r = 4; r < rows - 2; r++) m.push(E);
  m.push('#.........P........#');
  m.push('####################');
  // 3줄마다 발판 줄: 조각 2~3개, 일부는 무너지는 발판(C) 또는 움직이는 발판(M)
  const platRows = [];
  for (let r = rows - 4; r >= 6; r -= 3) platRows.push(r);
  platRows.forEach((r, i) => {
    let row = E;
    const roll = R();
    if (i > 1 && roll < 0.16) {
      const c = 2 + Math.floor(R() * 14);
      row = set(row, c, 'M');
      // 움직이는 발판 줄에는 양 끝에 작은 쉼터를 둠
      row = set(set(row, 1, '='), 2, '=');
    } else {
      const segs = 2 + Math.floor(R() * 2);
      const zones = segs === 2 ? [[1, 9], [10, 18]] : [[1, 6], [7, 12], [13, 18]];
      zones.forEach(([a, b]) => {
        const w = 3 + Math.floor(R() * Math.min(4, b - a - 1));
        const st = a + Math.floor(R() * Math.max(1, b - a - w + 1));
        const crumble = i > 0 && R() < 0.22;
        for (let c = st; c < Math.min(19, st + w); c++) row = set(row, c, crumble ? 'C' : '=');
      });
    }
    m[r] = row;
  });
  // 몬스터: 단단한 발판(=) 위에만
  const spots = [];
  platRows.forEach(r => { for (let c = 1; c < 19; c++) if (m[r][c] === '=' && r < rows - 6) spots.push([r - 1, c]); });
  const used = new Set();
  for (let i = 0; i < count && spots.length; i++) {
    const kind = mix[Math.floor(R() * mix.length)];
    if (kind === 'bird') {
      const r = 5 + Math.floor(R() * (rows - 14)), c = 3 + Math.floor(R() * 14);
      if (m[r][c] === '.') m[r] = set(m[r], c, 'b');
      continue;
    }
    for (let t = 0; t < 30; t++) {
      const [r, c] = spots[Math.floor(R() * spots.length)];
      if ([-1, 0, 1].some(d => used.has(r + ',' + (c + d)))) continue;
      used.add(r + ',' + c); m[r] = set(m[r], c, CODE[kind]); break;
    }
  }
  return m;
}

const stages = [];
WORLDS.forEach((w, wi) => {
  const pool = VOCAB[wi].map(v => v.id);
  for (let n = 0; n < 8; n++) {
    const id = `${wi + 1}-${n + 1}`;
    const R = rng(wi * 100 + n * 7 + 3);
    const chunks = [0, 1, 2].map(k => pool[(n * 3 + k) % pool.length]);
    if (n === 7) {
      stages.push({ id, name: `${w.place} · ${w.boss.name}`, theme: w.theme, chunks, map: makeMap(BOSS_LAYOUT, [], R),
        boss: w.boss, world: wi + 1 });
      continue;
    }
    const count = Math.min(16, 10 + Math.floor(n * 0.7) + wi);
    const enemies = [];
    for (let i = 0; i < count; i++) enemies.push(w.mix[Math.floor(R() * w.mix.length)]);
    const layout = LAYOUTS[(wi * 3 + n) % LAYOUTS.length];
    stages.push({ id, name: `${w.place} · ${w.names[n]}`, theme: w.theme, chunks, map: makeMap(layout, enemies, R), world: wi + 1 });
    if (n === 3) {
      // x-4 다음: 진담 점프 등반 미션
      const CR = rng(wi * 999 + 17);
      const rows = 52 + wi * 6;
      stages.push({ id: `${wi + 1}-J`, name: `${w.place} · 진담 점프!`, theme: w.theme, chunks: [0, 1, 2].map(k => pool[(k * 4 + wi) % pool.length]),
        map: makeClimbMap(rows, CR, w.mix, 8 + wi * 2), world: wi + 1,
        climb: { time: 75 - wi * 5, hazard: wi % 2 === 0 ? 'thorn' : 'poison', speed: 9 + wi * 1.5 } });
    }
  }
});

const vocab = [].concat(...VOCAB);
stages.forEach(s => {
  if ((!s.climb && s.map.length !== 15) || s.map.some(r => r.length !== 20)) throw new Error('맵 크기 오류 ' + s.id);
});
const data = { version: 3, vocab, quiz: [], stages };
fs.writeFileSync(path.join(ROOT, 'data/game-data.json'), JSON.stringify(data, null, 1));
console.log(`스테이지 ${stages.length}개 (보스 ${stages.filter(s => s.boss).length}), 어휘 ${vocab.length}개`);
stages.forEach(s => console.log(s.id.padEnd(4), String(s.map.join('').replace(/[^mktbfs]/g, '').length).padStart(2), s.boss ? 'BOSS ' + s.boss.name : s.name));
